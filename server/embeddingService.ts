import fs from 'fs';
import path from 'path';
import { getGeminiClient } from './aiService.ts';
import { getDbNotes, getDbFiles } from './firebaseDb.ts';
import type { Note, DriveFile } from '../src/types/index.ts';

const _dirname = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
const DATA_DIR = path.join(process.cwd(), 'data');
const EMBEDDING_CACHE_FILE = path.join(DATA_DIR, 'embeddings_cache.json');

export interface DocumentVector {
  id: string;
  type: 'note' | 'file';
  title: string;
  content: string;
  tags: string[];
  classification?: string;
  category?: string;
  vector: number[];
  hash: string;
  updatedAt: string;
}

export interface SemanticSearchResult {
  id: string;
  type: 'note' | 'file';
  title: string;
  snippet: string;
  fullText: string;
  tags: string[];
  classification?: string;
  category?: string;
  similarity: number; // 0.0 to 1.0
  relevanceExplanation?: string;
}

// In-Memory Vector Store
const vectorCache = new Map<string, DocumentVector>();
let isVectorizing = false;

// Simple string hash for cache invalidation
function computeTextHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString();
}

/**
 * Load saved vector embeddings from disk
 */
export function loadEmbeddingCacheFromDisk() {
  try {
    if (fs.existsSync(EMBEDDING_CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(EMBEDDING_CACHE_FILE, 'utf-8'));
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.id && Array.isArray(item.vector)) {
            vectorCache.set(item.id, item);
          }
        }
        console.log(`🧠 [Semantic Embedding Store] Loaded ${vectorCache.size} vectors from disk.`);
      }
    }
  } catch (err) {
    console.warn('[Semantic Embedding Store] Could not read vector cache:', err);
  }
}

/**
 * Save vector embeddings to disk
 */
export function saveEmbeddingCacheToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const items = Array.from(vectorCache.values());
    fs.writeFileSync(EMBEDDING_CACHE_FILE, JSON.stringify(items), 'utf-8');
  } catch (err) {
    console.warn('[Semantic Embedding Store] Could not persist vector cache:', err);
  }
}

/**
 * Generate embedding vector using Gemini Embedding Model (text-embedding-004 or gemini-embedding-2-preview)
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const cleanText = text.trim().slice(0, 4000);
  if (!cleanText) return null;

  try {
    const ai = getGeminiClient();
    // Try text-embedding-004 first
    try {
      const response = await ai.models.embedContent({
        model: 'text-embedding-004',
        contents: cleanText,
      });

      const values = (response as any)?.embedding?.values || response?.embeddings?.[0]?.values;
      if (values && Array.isArray(values) && values.length > 0) {
        return values;
      }
    } catch (modelErr: any) {
      // Fallback to gemini-embedding-2-preview or text-embedding-004
      const response2 = await ai.models.embedContent({
        model: 'gemini-embedding-2-preview',
        contents: cleanText,
      });

      const values2 = (response2 as any)?.embedding?.values || response2?.embeddings?.[0]?.values;
      if (values2 && Array.isArray(values2) && values2.length > 0) {
        return values2;
      }
    }
  } catch (err: any) {
    console.warn('[Gemini Embedding Error] API fallback to keyword vector:', err?.message);
  }

  return null;
}

/**
 * Calculates cosine similarity between two vectors (-1 to 1)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return Math.max(0, Math.min(1, dotProduct / denominator));
}

/**
 * Lightweight token-based Jaccard/N-Gram semantic fallback similarity
 */
function tokenSimilarityFallback(textA: string, textB: string): number {
  const tokenize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\w\s\u00C0-\u1EF9]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1);

  const tokensA = new Set(tokenize(textA));
  const tokensB = new Set(tokenize(textB));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  tokensA.forEach(t => {
    if (tokensB.has(t)) intersection++;
  });

  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Re-indexes all notes and files in background to ensure semantic vectors are up to date
 */
export async function syncAndVectorizeAllDocuments(): Promise<number> {
  if (isVectorizing) return vectorCache.size;
  isVectorizing = true;

  try {
    const notes = await getDbNotes();
    const files = await getDbFiles();

    let updatedCount = 0;

    // 1. Vectorize Notes
    for (const note of notes) {
      const combinedText = `Tiêu đề: ${note.title}\nThẻ: ${(note.tags || []).join(', ')}\nNội dung: ${note.content}`;
      const hash = computeTextHash(combinedText);
      const cached = vectorCache.get(`note-${note.id}`);

      if (!cached || cached.hash !== hash) {
        const vector = await generateEmbedding(combinedText);
        if (vector) {
          vectorCache.set(`note-${note.id}`, {
            id: note.id,
            type: 'note',
            title: note.title,
            content: note.content,
            tags: note.tags || [],
            vector,
            hash,
            updatedAt: note.updatedAt || new Date().toISOString(),
          });
          updatedCount++;
          // Small delay to respect rate limits
          await new Promise(r => setTimeout(r, 100));
        }
      }
    }

    // 2. Vectorize Files
    for (const file of files) {
      const fileText = `Tên tài liệu: ${file.name}\nPhân loại: ${file.classification || 'Chưa phân loại'}\nĐịnh dạng: ${file.category}\nThẻ: ${(file.tags || []).join(', ')}\n${file.textContent ? `Nội dung: ${file.textContent.slice(0, 1500)}` : ''}`;
      const hash = computeTextHash(fileText);
      const cached = vectorCache.get(`file-${file.id}`);

      if (!cached || cached.hash !== hash) {
        const vector = await generateEmbedding(fileText);
        if (vector) {
          vectorCache.set(`file-${file.id}`, {
            id: file.id,
            type: 'file',
            title: file.name,
            content: file.textContent || fileText,
            tags: file.tags || [],
            classification: file.classification,
            category: file.category,
            vector,
            hash,
            updatedAt: file.uploadedAt || new Date().toISOString(),
          });
          updatedCount++;
          await new Promise(r => setTimeout(r, 100));
        }
      }
    }

    if (updatedCount > 0) {
      saveEmbeddingCacheToDisk();
      console.log(`✨ [Semantic Embedding] Successfully vectorized ${updatedCount} new/updated documents.`);
    }

    return vectorCache.size;
  } catch (err) {
    console.warn('[Semantic Embedding] Vectorization background error:', err);
    return vectorCache.size;
  } finally {
    isVectorizing = false;
  }
}

/**
 * Perform Semantic Vector Search across Notes and Files
 */
export async function searchSemanticDocuments(
  query: string,
  options: {
    topK?: number;
    threshold?: number;
    type?: 'all' | 'notes' | 'files';
  } = {}
): Promise<SemanticSearchResult[]> {
  const { topK = 5, threshold = 0.45, type = 'all' } = options;
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  // Generate vector for query
  const queryVector = await generateEmbedding(cleanQuery);
  const results: SemanticSearchResult[] = [];

  const allDocs = Array.from(vectorCache.values());

  // Also read current live notes and files in case some aren't in vector cache yet
  const liveNotes = await getDbNotes();
  const liveFiles = await getDbFiles();

  // If vector is available, perform cosine similarity
  if (queryVector) {
    for (const doc of allDocs) {
      if (type !== 'all' && (type === 'notes' ? doc.type !== 'note' : doc.type !== 'file')) {
        continue;
      }

      const similarity = cosineSimilarity(queryVector, doc.vector);
      if (similarity >= threshold) {
        // Build readable snippet
        const snippet = doc.content.length > 250 ? `${doc.content.slice(0, 250)}...` : doc.content;
        results.push({
          id: doc.id,
          type: doc.type,
          title: doc.title,
          snippet,
          fullText: doc.content,
          tags: doc.tags,
          classification: doc.classification,
          category: doc.category,
          similarity: parseFloat(similarity.toFixed(4)),
        });
      }
    }
  }

  // Fallback / Supplementary: check live notes and files that might not be in vector cache or if queryVector was null
  if (results.length === 0 || !queryVector) {
    const qLower = cleanQuery.toLowerCase();
    
    if (type === 'all' || type === 'notes') {
      for (const n of liveNotes) {
        const fullDocStr = `${n.title} ${n.content} ${(n.tags || []).join(' ')}`.toLowerCase();
        const score = tokenSimilarityFallback(cleanQuery, fullDocStr);
        const hasKeyword = fullDocStr.includes(qLower);
        const finalScore = hasKeyword ? Math.max(score, 0.75) : score;

        if (finalScore >= 0.25) {
          results.push({
            id: n.id,
            type: 'note',
            title: n.title,
            snippet: n.content.length > 250 ? `${n.content.slice(0, 250)}...` : n.content,
            fullText: n.content,
            tags: n.tags || [],
            similarity: parseFloat(finalScore.toFixed(4)),
          });
        }
      }
    }

    if (type === 'all' || type === 'files') {
      for (const f of liveFiles) {
        const fullDocStr = `${f.name} ${f.classification || ''} ${f.category} ${(f.tags || []).join(' ')} ${f.textContent || ''}`.toLowerCase();
        const score = tokenSimilarityFallback(cleanQuery, fullDocStr);
        const hasKeyword = fullDocStr.includes(qLower);
        const finalScore = hasKeyword ? Math.max(score, 0.75) : score;

        if (finalScore >= 0.25) {
          results.push({
            id: f.id,
            type: 'file',
            title: f.name,
            snippet: f.textContent ? (f.textContent.length > 250 ? `${f.textContent.slice(0, 250)}...` : f.textContent) : `Tài liệu: ${f.name} [${f.classification || f.category}]`,
            fullText: f.textContent || f.name,
            tags: f.tags || [],
            classification: f.classification,
            category: f.category,
            similarity: parseFloat(finalScore.toFixed(4)),
          });
        }
      }
    }
  }

  // Sort descending by similarity score
  results.sort((a, b) => b.similarity - a.similarity);

  // Return Top K items
  return results.slice(0, topK);
}

// Initialize on module load
loadEmbeddingCacheFromDisk();
// Trigger initial vectorization asynchronously
setTimeout(() => {
  syncAndVectorizeAllDocuments().catch(err => console.warn('Vector init error:', err));
}, 2000);
