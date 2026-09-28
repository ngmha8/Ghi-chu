import fs from 'fs';
import path from 'path';
import { getGeminiClient } from './aiService.ts';
import { getDbNotes, getDbFiles } from './firebaseDb.ts';
import type { Note, DriveFile } from '../src/types/index.ts';

const _dirname = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
const DATA_DIR = path.join(process.cwd(), 'data');
const EMBEDDING_CACHE_FILE = path.join(DATA_DIR, 'embeddings_cache.json');

export const PRIMARY_EMBEDDING_MODEL = 'gemini-embedding-2-preview';
export const EMBEDDING_DIMENSIONS = 3072;

export interface DocumentVector {
  id: string;
  type: 'note' | 'file';
  title: string;
  content: string;
  tags: string[];
  classification?: string;
  category?: string;
  vector: number[];
  model: string;
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
  similarity: number; // Normalized hybrid score 0.0 - 1.0
  denseSimilarity?: number; // Raw Cosine similarity on 768D embedding (0.0 - 1.0)
  sparseScore?: number; // Raw BM25 score
  rrfScore?: number; // Reciprocal Rank Fusion score
  matchMethod?: 'hybrid' | 'dense' | 'sparse';
  relevanceExplanation?: string;
}

// In-Memory Dense Vector Store
const vectorCache = new Map<string, DocumentVector>();
let isVectorizing = false;

// -------------------------------------------------------------
// 1. SPARSE RETRIEVAL ENGINE: BM25 (Best Matching 25)
// -------------------------------------------------------------
export class BM25Engine {
  private k1: number = 1.2;
  private b: number = 0.75;
  private docLengths = new Map<string, number>();
  private docTokenFreqs = new Map<string, Map<string, number>>();
  private termDocFreqs = new Map<string, number>();
  private totalDocs: number = 0;
  private avgDocLength: number = 0;
  private docMetadata = new Map<string, {
    id: string;
    type: 'note' | 'file';
    title: string;
    content: string;
    tags: string[];
    classification?: string;
    category?: string;
  }>();

  public clear() {
    this.docLengths.clear();
    this.docTokenFreqs.clear();
    this.termDocFreqs.clear();
    this.docMetadata.clear();
    this.totalDocs = 0;
    this.avgDocLength = 0;
  }

  /**
   * High-accuracy multilingual & Vietnamese tokenizer
   * Preserves accents, alphanumeric codes (e.g. NV-001, TASK-12), and hashtags (#báo_cáo)
   */
  public tokenize(text: string): string[] {
    if (!text) return [];
    const normalized = text.toLowerCase();
    const tokens = normalized.match(/[\p{L}\p{N}_\-#]+/gu) || [];
    return tokens.filter(t => t.length > 1);
  }

  public addDocument(doc: {
    id: string;
    type: 'note' | 'file';
    title: string;
    content: string;
    tags: string[];
    classification?: string;
    category?: string;
  }) {
    const key = `${doc.type}-${doc.id}`;
    const fullText = `${doc.title} ${doc.tags.join(' ')} ${doc.content} ${doc.classification || ''} ${doc.category || ''}`;
    const tokens = this.tokenize(fullText);

    // Give higher weighting to titles and tags
    const titleTokens = this.tokenize(doc.title);
    const tagTokens = this.tokenize(doc.tags.join(' '));

    const freqMap = new Map<string, number>();
    for (const t of tokens) {
      freqMap.set(t, (freqMap.get(t) || 0) + 1);
    }
    for (const t of titleTokens) {
      freqMap.set(t, (freqMap.get(t) || 0) + 2);
    }
    for (const t of tagTokens) {
      freqMap.set(t, (freqMap.get(t) || 0) + 2);
    }

    const docLen = tokens.length + titleTokens.length * 2 + tagTokens.length * 2;
    this.docLengths.set(key, docLen);
    this.docTokenFreqs.set(key, freqMap);
    this.docMetadata.set(key, doc);

    for (const term of freqMap.keys()) {
      this.termDocFreqs.set(term, (this.termDocFreqs.get(term) || 0) + 1);
    }
    this.totalDocs = this.docLengths.size;

    let sumLen = 0;
    for (const len of this.docLengths.values()) {
      sumLen += len;
    }
    this.avgDocLength = this.totalDocs > 0 ? sumLen / this.totalDocs : 1;
  }

  public search(
    query: string,
    filterType: 'all' | 'notes' | 'files' = 'all',
    topK: number = 25
  ): Array<{ key: string; score: number; doc: any }> {
    if (this.totalDocs === 0) return [];
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const scores = new Map<string, number>();
    const N = this.totalDocs;

    for (const term of queryTokens) {
      const n_q = this.termDocFreqs.get(term) || 0;
      if (n_q === 0) continue;

      // Robertson-Spärck Jones IDF
      const idf = Math.log(1 + (N - n_q + 0.5) / (n_q + 0.5));

      for (const [key, freqMap] of this.docTokenFreqs.entries()) {
        const metadata = this.docMetadata.get(key);
        if (!metadata) continue;
        if (filterType !== 'all' && (filterType === 'notes' ? metadata.type !== 'note' : metadata.type !== 'file')) {
          continue;
        }

        const tf = freqMap.get(term) || 0;
        if (tf === 0) continue;

        const docLen = this.docLengths.get(key) || 1;
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / this.avgDocLength));
        const termScore = idf * (numerator / denominator);

        scores.set(key, (scores.get(key) || 0) + termScore);
      }
    }

    // Exact phrase and tag bonuses
    const queryLower = query.toLowerCase().trim();
    for (const [key, doc] of this.docMetadata.entries()) {
      if (filterType !== 'all' && (filterType === 'notes' ? doc.type !== 'note' : doc.type !== 'file')) {
        continue;
      }

      const titleLower = doc.title.toLowerCase();
      if (titleLower.includes(queryLower)) {
        scores.set(key, (scores.get(key) || 0) + 3.5);
      }
      for (const tag of doc.tags) {
        if (tag.toLowerCase() === queryLower || `#${tag.toLowerCase()}` === queryLower) {
          scores.set(key, (scores.get(key) || 0) + 4.5);
        }
      }
    }

    return Array.from(scores.entries())
      .map(([key, score]) => ({
        key,
        score,
        doc: this.docMetadata.get(key)!,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

export const bm25Index = new BM25Engine();

// -------------------------------------------------------------
// 2. DENSE RETRIEVAL: Google text-embedding-004 (768 Dimensions)
// -------------------------------------------------------------

/**
 * Resilient deterministic pseudo-dense vector fallback
 * Generates normalized 768-dimensional vectors when completely offline
 */
export function generateLocalDenseVector(text: string, dimensions: number = EMBEDDING_DIMENSIONS): number[] {
  const vec = new Array(dimensions).fill(0);
  const clean = text.toLowerCase().replace(/[^\w\s\u00C0-\u1EF9]/g, ' ');
  const words = clean.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return vec;

  for (const word of words) {
    let h1 = 0;
    for (let i = 0; i < word.length; i++) {
      h1 = ((h1 << 5) - h1) + word.charCodeAt(i);
      h1 |= 0;
    }
    const idx1 = Math.abs(h1) % dimensions;
    vec[idx1] += 1.0;

    if (word.length >= 3) {
      for (let i = 0; i <= word.length - 3; i++) {
        const tri = word.slice(i, i + 3);
        let h2 = 0;
        for (let j = 0; j < tri.length; j++) {
          h2 = ((h2 << 5) - h2) + tri.charCodeAt(j);
          h2 |= 0;
        }
        const idx2 = Math.abs(h2) % dimensions;
        vec[idx2] += 0.5;
      }
    }
  }

  // L2 Normalize
  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vec[i] /= norm;
    }
  }
  return vec;
}

function computeTextHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString();
}

/**
 * Generate 3072-dimensional dense vector using Google's gemini-embedding-2-preview model
 */
export async function generateEmbedding(text: string): Promise<{ vector: number[]; model: string }> {
  const cleanText = text.trim().slice(0, 4000);
  if (!cleanText) {
    return { vector: generateLocalDenseVector('', EMBEDDING_DIMENSIONS), model: 'local-dense' };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.trim().length > 0) {
    const ai = getGeminiClient();

    // 1. Primary: gemini-embedding-2-preview (official model in @google/genai SDK)
    try {
      const response = await ai.models.embedContent({
        model: PRIMARY_EMBEDDING_MODEL,
        contents: cleanText,
      });

      const values = (response as any)?.embeddings?.[0]?.values || (response as any)?.embedding?.values;
      if (values && Array.isArray(values) && values.length > 0) {
        return { vector: values, model: PRIMARY_EMBEDDING_MODEL };
      }
    } catch (err: any) {
      console.warn(`[Embedding] Primary ${PRIMARY_EMBEDDING_MODEL} failed, attempting resilient local:`, err?.message);
    }
  }

  // 2. Resilient local fallback
  return {
    vector: generateLocalDenseVector(cleanText, EMBEDDING_DIMENSIONS),
    model: 'local-dense',
  };
}

/**
 * Calculates cosine similarity between two dense vectors (-1.0 to 1.0)
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

// -------------------------------------------------------------
// 3. CACHE STORAGE MANAGEMENT
// -------------------------------------------------------------
export function loadEmbeddingCacheFromDisk() {
  try {
    if (fs.existsSync(EMBEDDING_CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(EMBEDDING_CACHE_FILE, 'utf-8'));
      if (Array.isArray(data)) {
        for (const item of data) {
          // Validate model & dimension compatibility (768D)
          if (item.id && Array.isArray(item.vector) && item.vector.length === EMBEDDING_DIMENSIONS) {
            vectorCache.set(item.id, item);
          }
        }
        console.log(`🧠 [Hybrid RAG Store] Loaded ${vectorCache.size} dense vectors (${PRIMARY_EMBEDDING_MODEL}) from disk.`);
      }
    }
  } catch (err) {
    // Gracefully handle cache load failure
  }
}

export function saveEmbeddingCacheToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const items = Array.from(vectorCache.values());
    fs.writeFileSync(EMBEDDING_CACHE_FILE, JSON.stringify(items), 'utf-8');
  } catch (err) {
    // Gracefully handle cache save failure
  }
}

// -------------------------------------------------------------
// 4. SYNCHRONIZATION & RE-INDEXING (HYBRID)
// -------------------------------------------------------------
export async function syncAndVectorizeAllDocuments(): Promise<number> {
  if (isVectorizing) return vectorCache.size;
  isVectorizing = true;

  try {
    const notes = await getDbNotes();
    const files = await getDbFiles();

    // Rebuild BM25 Sparse Index in Memory
    bm25Index.clear();
    for (const note of notes) {
      bm25Index.addDocument({
        id: note.id,
        type: 'note',
        title: note.title,
        content: note.content,
        tags: note.tags || [],
      });
    }

    for (const file of files) {
      const fileNotes = file.notes || file.description || '';
      bm25Index.addDocument({
        id: file.id,
        type: 'file',
        title: file.name,
        content: fileNotes ? `${fileNotes}\n${file.textContent || ''}` : (file.textContent || file.name),
        tags: file.tags || [],
        classification: file.classification,
        category: file.category,
      });
    }

    let updatedCount = 0;

    // 1. Vectorize Notes
    for (const note of notes) {
      const combinedText = `Tiêu đề: ${note.title}\nThẻ: ${(note.tags || []).join(', ')}\nNội dung: ${note.content}`;
      const hash = computeTextHash(combinedText);
      const cached = vectorCache.get(`note-${note.id}`);

      // Re-index if hash changed or if vector dimension is not 768
      if (!cached || cached.hash !== hash || cached.vector.length !== EMBEDDING_DIMENSIONS) {
        const { vector, model } = await generateEmbedding(combinedText);
        if (vector) {
          vectorCache.set(`note-${note.id}`, {
            id: note.id,
            type: 'note',
            title: note.title,
            content: note.content,
            tags: note.tags || [],
            vector,
            model,
            hash,
            updatedAt: note.updatedAt || new Date().toISOString(),
          });
          updatedCount++;
          await new Promise(r => setTimeout(r, 60));
        }
      }
    }

    // 2. Vectorize Files
    for (const file of files) {
      const fileNotes = file.notes || file.description || '';
      const fileText = `Tên tài liệu: ${file.name}\nPhân loại: ${file.classification || 'Chưa phân loại'}\nĐịnh dạng: ${file.category}\nThẻ: ${(file.tags || []).join(', ')}\n${fileNotes ? `Chú thích / Ghi chú: ${fileNotes}\n` : ''}${file.textContent ? `Nội dung: ${file.textContent.slice(0, 2000)}` : ''}`;
      const hash = computeTextHash(fileText);
      const cached = vectorCache.get(`file-${file.id}`);

      if (!cached || cached.hash !== hash || cached.vector.length !== EMBEDDING_DIMENSIONS) {
        const { vector, model } = await generateEmbedding(fileText);
        if (vector) {
          vectorCache.set(`file-${file.id}`, {
            id: file.id,
            type: 'file',
            title: file.name,
            content: fileNotes ? `${fileNotes}\n${file.textContent || ''}` : (file.textContent || fileText),
            tags: file.tags || [],
            classification: file.classification,
            category: file.category,
            vector,
            model,
            hash,
            updatedAt: file.uploadedAt || new Date().toISOString(),
          });
          updatedCount++;
          await new Promise(r => setTimeout(r, 60));
        }
      }
    }

    if (updatedCount > 0) {
      saveEmbeddingCacheToDisk();
      console.log(`✨ [Hybrid RAG] Vectorized ${updatedCount} documents with ${PRIMARY_EMBEDDING_MODEL} (${EMBEDDING_DIMENSIONS}D).`);
    }

    return vectorCache.size;
  } catch (err) {
    console.warn('[Hybrid RAG] Sync error:', err);
    return vectorCache.size;
  } finally {
    isVectorizing = false;
  }
}

// -------------------------------------------------------------
// 5. HYBRID SEARCH: Dense + BM25 + Reciprocal Rank Fusion (RRF)
// -------------------------------------------------------------
export async function searchSemanticDocuments(
  query: string,
  options: {
    topK?: number;
    threshold?: number;
    type?: 'all' | 'notes' | 'files';
  } = {}
): Promise<SemanticSearchResult[]> {
  const { topK = 5, threshold = 0.30, type = 'all' } = options;
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  // Parallel Execution: Dense Embedding Retrieval + Sparse BM25 Retrieval
  const [embedResult, bm25Results] = await Promise.all([
    generateEmbedding(cleanQuery),
    Promise.resolve(bm25Index.search(cleanQuery, type, 30)),
  ]);

  const queryVector = embedResult.vector;
  const allDenseDocs = Array.from(vectorCache.values());

  // 1. Dense Scoring
  const denseRanked: Array<{ key: string; doc: DocumentVector; denseSim: number }> = [];
  if (queryVector && queryVector.length === EMBEDDING_DIMENSIONS) {
    for (const doc of allDenseDocs) {
      if (type !== 'all' && (type === 'notes' ? doc.type !== 'note' : doc.type !== 'file')) {
        continue;
      }
      const sim = cosineSimilarity(queryVector, doc.vector);
      if (sim >= threshold) {
        denseRanked.push({
          key: `${doc.type}-${doc.id}`,
          doc,
          denseSim: sim,
        });
      }
    }
    denseRanked.sort((a, b) => b.denseSim - a.denseSim);
  }

  // 2. Build Rank Position Maps for RRF
  const RRF_K = 60; // Standard reciprocal rank fusion constant
  const denseRankMap = new Map<string, { rank: number; score: number; doc: DocumentVector }>();
  denseRanked.forEach((item, index) => {
    denseRankMap.set(item.key, { rank: index + 1, score: item.denseSim, doc: item.doc });
  });

  const sparseRankMap = new Map<string, { rank: number; score: number; doc: any }>();
  bm25Results.forEach((item, index) => {
    sparseRankMap.set(item.key, { rank: index + 1, score: item.score, doc: item.doc });
  });

  // 3. Compute Reciprocal Rank Fusion (RRF) Scores
  const allCandidateKeys = new Set<string>([...denseRankMap.keys(), ...sparseRankMap.keys()]);
  const fusionResults: SemanticSearchResult[] = [];

  for (const key of allCandidateKeys) {
    const denseEntry = denseRankMap.get(key);
    const sparseEntry = sparseRankMap.get(key);

    const denseComponent = denseEntry ? 1.0 / (RRF_K + denseEntry.rank) : 0;
    const sparseComponent = sparseEntry ? 1.0 / (RRF_K + sparseEntry.rank) : 0;
    const rrfScore = denseComponent + sparseComponent;

    const doc = denseEntry ? denseEntry.doc : sparseEntry!.doc;
    const denseSim = denseEntry ? parseFloat(denseEntry.score.toFixed(4)) : undefined;
    const sparseScore = sparseEntry ? parseFloat(sparseEntry.score.toFixed(2)) : undefined;

    let matchMethod: 'hybrid' | 'dense' | 'sparse' = 'hybrid';
    let explanation = '';

    if (denseEntry && sparseEntry) {
      matchMethod = 'hybrid';
      explanation = `Khớp cả ngữ nghĩa trừu tượng (${PRIMARY_EMBEDDING_MODEL}: ${Math.round(denseEntry.score * 100)}%) và từ khóa chính xác (BM25: điểm ${sparseEntry.score.toFixed(1)})`;
    } else if (denseEntry) {
      matchMethod = 'dense';
      explanation = `Khớp ngữ nghĩa chuyên sâu (${PRIMARY_EMBEDDING_MODEL}: ${Math.round(denseEntry.score * 100)}%)`;
    } else {
      matchMethod = 'sparse';
      explanation = `Khớp từ khóa chính xác / mã số / tên riêng (BM25: điểm ${sparseEntry!.score.toFixed(1)})`;
    }

    // Normalized overall similarity (0.0 to 1.0)
    let normalizedSimilarity = 0;
    if (denseSim !== undefined && sparseScore !== undefined) {
      normalizedSimilarity = Math.min(1.0, denseSim * 0.7 + Math.min(1.0, sparseScore / 10) * 0.3);
    } else if (denseSim !== undefined) {
      normalizedSimilarity = denseSim;
    } else if (sparseScore !== undefined) {
      normalizedSimilarity = Math.min(0.95, 0.5 + Math.min(0.45, sparseScore / 20));
    }

    const snippet = doc.content && doc.content.length > 250
      ? `${doc.content.slice(0, 250)}...`
      : (doc.content || doc.title);

    fusionResults.push({
      id: doc.id,
      type: doc.type,
      title: doc.title,
      snippet,
      fullText: doc.content || doc.title,
      tags: doc.tags || [],
      classification: doc.classification,
      category: doc.category,
      similarity: parseFloat(normalizedSimilarity.toFixed(4)),
      denseSimilarity: denseSim,
      sparseScore,
      rrfScore: parseFloat(rrfScore.toFixed(6)),
      matchMethod,
      relevanceExplanation: explanation,
    });
  }

  // Sort primarily by RRF score descending
  fusionResults.sort((a, b) => (b.rrfScore || 0) - (a.rrfScore || 0));

  return fusionResults.slice(0, topK);
}

// -------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------
loadEmbeddingCacheFromDisk();

// Trigger initial asynchronous sync & BM25 indexing
setTimeout(() => {
  syncAndVectorizeAllDocuments().catch(err => {
    console.warn('Hybrid RAG vector init error:', err?.message);
  });
}, 1500);
