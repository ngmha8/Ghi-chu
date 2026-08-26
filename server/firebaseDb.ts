import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  deleteDoc,
  Firestore,
} from 'firebase/firestore';
import type {
  Task,
  Note,
  DriveFile,
  TelegramConfig,
  NotificationLog,
  DriveServiceAccountConfig,
  DocumentCategory,
  AiMemoryFact,
  AiLearningInsight,
  AiLearningStats,
  AiPersonaConfig
} from '../src/types/index.ts';
import {
  initialTasks,
  initialNotes,
  initialFiles,
  initialTelegramConfig,
  initialNotificationLogs,
  initialCategories,
  initialAiMemories,
  initialAiInsights,
  initialAiPersonaConfig
} from './initialData.ts';

const _dirname = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

export const initialDriveServiceAccountConfig: DriveServiceAccountConfig = {
  clientEmail: '',
  privateKey: '',
  projectId: '',
  folderId: '',
  folderName: '',
  isEnabled: false,
  isConnected: false,
};

export interface SecurityPinConfig {
  pin: string;
  isEnabled: boolean;
  autolockMinutes: number;
  hint: string;
  updatedAt: string;
}

export const defaultSecurityPin = process.env.ADMIN_PIN || process.env.APP_PIN || '1234';

export let cachedSecurityPinConfig: SecurityPinConfig = {
  pin: defaultSecurityPin,
  isEnabled: true,
  autolockMinutes: 0,
  hint: defaultSecurityPin === '1234' ? 'Mã PIN mặc định là 1234' : 'Mã PIN bảo vệ hệ thống',
  updatedAt: new Date().toISOString(),
};

// In-Memory cache for high-speed access & offline resilience
export let cachedCategories: DocumentCategory[] = [...initialCategories];
export let cachedTasks: Task[] = [...initialTasks];
export let cachedNotes: Note[] = [...initialNotes];
export let cachedFiles: DriveFile[] = [...initialFiles];
export let cachedTelegramConfig: TelegramConfig = { ...initialTelegramConfig };
export let cachedNotificationLogs: NotificationLog[] = [...initialNotificationLogs];
export let cachedDriveServiceAccountConfig: DriveServiceAccountConfig = { ...initialDriveServiceAccountConfig };
export let cachedSecurityPin: string = defaultSecurityPin;
export let cachedAiMemories: AiMemoryFact[] = [...initialAiMemories];
export let cachedAiInsights: AiLearningInsight[] = [...initialAiInsights];
export let cachedAiPersonaConfig: AiPersonaConfig = { ...initialAiPersonaConfig };

// Local JSON file backup path
const CWD_DATA_DIR = path.join(process.cwd(), 'data');
const LOCAL_DATA_DIR = path.join(_dirname, 'data');
const DATA_DIR = CWD_DATA_DIR;

try {
  if (!fs.existsSync(CWD_DATA_DIR)) fs.mkdirSync(CWD_DATA_DIR, { recursive: true });
  if (!fs.existsSync(LOCAL_DATA_DIR)) fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
} catch (e) {}

// Helper to safely load JSON from primary or secondary location
function loadJsonFileSafe(fileName: string): any {
  const primary = path.join(CWD_DATA_DIR, fileName);
  const secondary = path.join(LOCAL_DATA_DIR, fileName);
  try {
    if (fs.existsSync(primary)) {
      return JSON.parse(fs.readFileSync(primary, 'utf-8'));
    }
    if (fs.existsSync(secondary)) {
      return JSON.parse(fs.readFileSync(secondary, 'utf-8'));
    }
  } catch (e) {
    // ignore
  }
  return null;
}

// Read local backups if present
try {
  const categoriesData = loadJsonFileSafe('categories.json');
  if (Array.isArray(categoriesData) && categoriesData.length > 0) {
    cachedCategories = categoriesData;
  }

  const cfgData = loadJsonFileSafe('telegram_config.json');
  if (cfgData) cachedTelegramConfig = { ...cachedTelegramConfig, ...cfgData };

  const saData = loadJsonFileSafe('drive_service_account.json');
  if (saData) cachedDriveServiceAccountConfig = { ...cachedDriveServiceAccountConfig, ...saData };

  const tasksData = loadJsonFileSafe('tasks.json');
  if (Array.isArray(tasksData)) cachedTasks = tasksData;

  const notesData = loadJsonFileSafe('notes.json');
  if (Array.isArray(notesData)) cachedNotes = notesData;

  const filesData = loadJsonFileSafe('files.json');
  if (Array.isArray(filesData)) cachedFiles = filesData;

  const memData = loadJsonFileSafe('ai_memories.json');
  if (Array.isArray(memData) && memData.length > 0) cachedAiMemories = memData;

  const insData = loadJsonFileSafe('ai_insights.json');
  if (Array.isArray(insData) && insData.length > 0) cachedAiInsights = insData;

  const personaData = loadJsonFileSafe('ai_persona.json');
  if (personaData && typeof personaData === 'object') {
    cachedAiPersonaConfig = { ...cachedAiPersonaConfig, ...personaData };
  }

  const pinData = loadJsonFileSafe('security_pin.json');
  if (pinData) {
    if (pinData.pin) cachedSecurityPin = pinData.pin.toString();
    cachedSecurityPinConfig = {
      ...cachedSecurityPinConfig,
      ...pinData,
      pin: pinData.pin ? pinData.pin.toString() : cachedSecurityPin,
    };
  }
} catch (e) {
  console.warn('Could not read local backup files:', e);
}

function saveLocalBackups() {
  const dataMap: Record<string, string> = {
    'categories.json': JSON.stringify(cachedCategories, null, 2),
    'telegram_config.json': JSON.stringify(cachedTelegramConfig, null, 2),
    'drive_service_account.json': JSON.stringify(cachedDriveServiceAccountConfig, null, 2),
    'tasks.json': JSON.stringify(cachedTasks, null, 2),
    'notes.json': JSON.stringify(cachedNotes, null, 2),
    'files.json': JSON.stringify(cachedFiles, null, 2),
    'ai_memories.json': JSON.stringify(cachedAiMemories, null, 2),
    'ai_insights.json': JSON.stringify(cachedAiInsights, null, 2),
    'ai_persona.json': JSON.stringify(cachedAiPersonaConfig, null, 2),
    'security_pin.json': JSON.stringify(cachedSecurityPinConfig, null, 2),
  };

  const targetDirs = Array.from(new Set([CWD_DATA_DIR, LOCAL_DATA_DIR]));
  for (const dir of targetDirs) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      for (const [fName, content] of Object.entries(dataMap)) {
        fs.writeFileSync(path.join(dir, fName), content, 'utf-8');
      }
    } catch (e) {
      console.warn(`Error saving local backup to ${dir}:`, e);
    }
  }
}

// -------------------------------------------------------------
// FIREBASE FIRESTORE INITIALIZATION & CLOUD PERSISTENCE
// -------------------------------------------------------------
let firestoreDb: Firestore | null = null;

// Safe cleaner to strip undefined properties for Firestore
function cleanForFirestore<T>(data: T): Record<string, any> {
  const result: Record<string, any> = {};
  if (!data || typeof data !== 'object') return result;
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

try {
  const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(firebaseConfigPath)) {
    const fbConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
    const fbApp = getApps().length > 0 ? getApp() : initializeApp(fbConfig);
    firestoreDb = getFirestore(fbApp, fbConfig.firestoreDatabaseId || '(default)');
    console.log(`🔥 Firebase Firestore initialized (DB: ${fbConfig.firestoreDatabaseId || 'default'})`);
  }
} catch (err) {
  console.warn('Firebase Firestore initialization warning (using local persistence):', err);
}

// Async Cloud Sync Helpers (Non-blocking)
async function firestoreSetDoc(collectionName: string, docId: string, data: any) {
  if (!firestoreDb) return;
  try {
    const cleanData = cleanForFirestore(data);
    await setDoc(doc(firestoreDb, collectionName, docId), cleanData);
  } catch (err) {
    console.warn(`Firestore save error on ${collectionName}/${docId}:`, err);
  }
}

async function firestoreDeleteDoc(collectionName: string, docId: string) {
  if (!firestoreDb) return;
  try {
    await deleteDoc(doc(firestoreDb, collectionName, docId));
  } catch (err) {
    console.warn(`Firestore delete error on ${collectionName}/${docId}:`, err);
  }
}

export async function initializeFirestoreData() {
  saveLocalBackups();
  if (!firestoreDb) {
    console.log('✅ Local storage initialized successfully.');
    return;
  }

  try {
    console.log('🔄 Synchronizing data with Firebase Firestore Cloud...');

    // 1. Sync Tasks
    const tasksSnap = await getDocs(collection(firestoreDb, 'tasks'));
    if (!tasksSnap.empty) {
      const cloudTasks: Task[] = [];
      tasksSnap.forEach(d => {
        cloudTasks.push({ ...(d.data() as Task), id: d.id });
      });
      cachedTasks = cloudTasks;
      console.log(`📥 Loaded ${cloudTasks.length} tasks from Firebase Firestore.`);
    } else {
      console.log(`📤 Seeding ${cachedTasks.length} tasks to Firebase Firestore...`);
      for (const t of cachedTasks) {
        await firestoreSetDoc('tasks', t.id, t);
      }
    }

    // 2. Sync Notes
    const notesSnap = await getDocs(collection(firestoreDb, 'notes'));
    if (!notesSnap.empty) {
      const cloudNotes: Note[] = [];
      notesSnap.forEach(d => {
        cloudNotes.push({ ...(d.data() as Note), id: d.id });
      });
      cachedNotes = cloudNotes;
      console.log(`📥 Loaded ${cloudNotes.length} notes from Firebase Firestore.`);
    } else {
      console.log(`📤 Seeding ${cachedNotes.length} notes to Firebase Firestore...`);
      for (const n of cachedNotes) {
        await firestoreSetDoc('notes', n.id, n);
      }
    }

    // 3. Sync Categories
    const categoriesSnap = await getDocs(collection(firestoreDb, 'categories'));
    if (!categoriesSnap.empty) {
      const cloudCats: DocumentCategory[] = [];
      categoriesSnap.forEach(d => {
        cloudCats.push({ ...(d.data() as DocumentCategory), id: d.id });
      });
      cachedCategories = cloudCats;
      console.log(`📥 Loaded ${cloudCats.length} categories from Firebase Firestore.`);
    } else {
      console.log(`📤 Seeding ${cachedCategories.length} categories to Firebase Firestore...`);
      for (const c of cachedCategories) {
        await firestoreSetDoc('categories', c.id, c);
      }
    }

    // 4. Sync Files
    const filesSnap = await getDocs(collection(firestoreDb, 'files'));
    if (!filesSnap.empty) {
      const cloudFiles: DriveFile[] = [];
      filesSnap.forEach(d => {
        cloudFiles.push({ ...(d.data() as DriveFile), id: d.id });
      });
      cachedFiles = cloudFiles;
      console.log(`📥 Loaded ${cloudFiles.length} files from Firebase Firestore.`);
    } else if (cachedFiles.length > 0) {
      for (const f of cachedFiles) {
        await firestoreSetDoc('files', f.id, f);
      }
    }

    // 5. Sync Telegram Config
    const tgDocSnap = await getDoc(doc(firestoreDb, 'config', 'telegram'));
    if (tgDocSnap.exists()) {
      cachedTelegramConfig = { ...cachedTelegramConfig, ...(tgDocSnap.data() as TelegramConfig) };
      console.log(`📥 Loaded Telegram Config from Firebase Firestore.`);
    } else {
      await firestoreSetDoc('config', 'telegram', cachedTelegramConfig);
    }

    // 6. Sync Google Drive Service Account Config
    const saDocSnap = await getDoc(doc(firestoreDb, 'config', 'drive_service_account'));
    if (saDocSnap.exists()) {
      cachedDriveServiceAccountConfig = { ...cachedDriveServiceAccountConfig, ...(saDocSnap.data() as DriveServiceAccountConfig) };
      console.log(`📥 Loaded Google Drive Service Account Config from Firebase Firestore.`);
    } else if (cachedDriveServiceAccountConfig.clientEmail) {
      await firestoreSetDoc('config', 'drive_service_account', cachedDriveServiceAccountConfig);
    }

    // 7. Sync Security PIN Settings
    const pinDocSnap = await getDoc(doc(firestoreDb, 'settings', 'security_pin'));
    if (pinDocSnap.exists()) {
      const cloudPin = pinDocSnap.data() as SecurityPinConfig;
      cachedSecurityPinConfig = { ...cachedSecurityPinConfig, ...cloudPin };
      if (cloudPin.pin) cachedSecurityPin = cloudPin.pin;
      console.log(`📥 Loaded Security PIN Config from Firebase Firestore.`);
    } else {
      await firestoreSetDoc('settings', 'security_pin', cachedSecurityPinConfig);
    }

    // 8. Sync AI Learned Memories (Self-Learning Memory Store)
    const memsSnap = await getDocs(collection(firestoreDb, 'ai_memories'));
    if (!memsSnap.empty) {
      const cloudMems: AiMemoryFact[] = [];
      memsSnap.forEach(d => {
        cloudMems.push({ ...(d.data() as AiMemoryFact), id: d.id });
      });
      cachedAiMemories = cloudMems;
      console.log(`📥 Loaded ${cloudMems.length} learned AI memories from Firebase Firestore.`);
    } else if (cachedAiMemories.length > 0) {
      console.log(`📤 Seeding ${cachedAiMemories.length} initial AI memories to Firestore...`);
      for (const m of cachedAiMemories) {
        await firestoreSetDoc('ai_memories', m.id, m);
      }
    }

    // 9. Sync AI Learning Insights
    const insSnap = await getDocs(collection(firestoreDb, 'ai_insights'));
    if (!insSnap.empty) {
      const cloudIns: AiLearningInsight[] = [];
      insSnap.forEach(d => {
        cloudIns.push({ ...(d.data() as AiLearningInsight), id: d.id });
      });
      cachedAiInsights = cloudIns;
      console.log(`📥 Loaded ${cloudIns.length} AI learning insights from Firebase Firestore.`);
    } else if (cachedAiInsights.length > 0) {
      for (const ins of cachedAiInsights) {
        await firestoreSetDoc('ai_insights', ins.id, ins);
      }
    }

    // Save final merged state to local backups
    saveLocalBackups();
    console.log('✅ Firebase Firestore synchronization completed successfully.');
  } catch (err) {
    console.warn('⚠️ Firestore initialization sync error (fallback to local state):', err);
  }
}

// -------------------------------------------------------------
// CRUD METHODS (DOCUMENT CATEGORIES)
// -------------------------------------------------------------
export async function getDbCategories(): Promise<DocumentCategory[]> {
  return cachedCategories;
}

export async function saveDbCategories(categories: DocumentCategory[]): Promise<DocumentCategory[]> {
  if (Array.isArray(categories) && categories.length > 0) {
    cachedCategories = categories;
    saveLocalBackups();
    for (const c of categories) {
      firestoreSetDoc('categories', c.id, c);
    }
  }
  return cachedCategories;
}

export async function saveDbCategory(category: DocumentCategory): Promise<DocumentCategory> {
  const index = cachedCategories.findIndex(c => c.id === category.id);
  if (index >= 0) {
    cachedCategories[index] = { ...cachedCategories[index], ...category };
  } else {
    cachedCategories.push(category);
  }
  saveLocalBackups();
  firestoreSetDoc('categories', category.id, category);
  return category;
}

export async function deleteDbCategory(id: string): Promise<boolean> {
  cachedCategories = cachedCategories.filter(c => c.id !== id);
  saveLocalBackups();
  firestoreDeleteDoc('categories', id);
  return true;
}

// -------------------------------------------------------------
// CRUD METHODS (TASK)
// -------------------------------------------------------------
export async function getDbTasks(): Promise<Task[]> {
  return cachedTasks;
}

export async function saveDbTask(task: Task): Promise<Task> {
  const index = cachedTasks.findIndex(t => t.id === task.id);
  if (index >= 0) {
    cachedTasks[index] = task;
  } else {
    cachedTasks.unshift(task);
  }
  saveLocalBackups();
  firestoreSetDoc('tasks', task.id, task);
  return task;
}

export async function deleteDbTask(id: string): Promise<boolean> {
  cachedTasks = cachedTasks.filter(t => t.id !== id);
  saveLocalBackups();
  firestoreDeleteDoc('tasks', id);
  return true;
}

// -------------------------------------------------------------
// CRUD METHODS (NOTE)
// -------------------------------------------------------------
export async function getDbNotes(): Promise<Note[]> {
  return cachedNotes;
}

export async function saveDbNote(note: Note): Promise<Note> {
  const index = cachedNotes.findIndex(n => n.id === note.id);
  if (index >= 0) {
    cachedNotes[index] = note;
  } else {
    cachedNotes.unshift(note);
  }
  saveLocalBackups();
  firestoreSetDoc('notes', note.id, note);
  return note;
}

export async function deleteDbNote(id: string): Promise<boolean> {
  cachedNotes = cachedNotes.filter(n => n.id !== id);
  saveLocalBackups();
  firestoreDeleteDoc('notes', id);
  return true;
}

// -------------------------------------------------------------
// CRUD METHODS (FILES)
// -------------------------------------------------------------
export async function getDbFiles(): Promise<DriveFile[]> {
  return cachedFiles.map(f => {
    const isRealDrive = !!(f.driveFileId && !f.driveFileId.startsWith('file-') && !f.driveFileId.startsWith('drive-id-') && f.webViewLink && f.webViewLink.includes('drive.google.com/file/d/'));
    return {
      ...f,
      isSyncedToDrive: isRealDrive,
      syncStatus: f.syncStatus || (isRealDrive ? 'synced' : 'local_only'),
      downloadUrl: f.downloadUrl || `/api/files/download/${f.id}`,
      previewUrl: f.previewUrl || `/api/files/preview/${f.id}`,
    };
  });
}

export async function saveDbFile(file: DriveFile): Promise<DriveFile> {
  const index = cachedFiles.findIndex(f => f.id === file.id);
  if (index >= 0) {
    cachedFiles[index] = file;
  } else {
    cachedFiles.unshift(file);
  }
  saveLocalBackups();
  firestoreSetDoc('files', file.id, file);
  return file;
}

export async function deleteDbFile(id: string): Promise<boolean> {
  cachedFiles = cachedFiles.filter(f => f.id !== id);
  saveLocalBackups();
  firestoreDeleteDoc('files', id);
  return true;
}

// -------------------------------------------------------------
// CRUD METHODS (TELEGRAM CONFIG)
// -------------------------------------------------------------
export async function getDbTelegramConfig(): Promise<TelegramConfig> {
  return cachedTelegramConfig;
}

export async function saveDbTelegramConfig(config: Partial<TelegramConfig>): Promise<TelegramConfig> {
  cachedTelegramConfig = {
    ...cachedTelegramConfig,
    ...config,
  };
  saveLocalBackups();
  firestoreSetDoc('config', 'telegram', cachedTelegramConfig);
  return cachedTelegramConfig;
}

// -------------------------------------------------------------
// CRUD METHODS (GOOGLE DRIVE SERVICE ACCOUNT CONFIG)
// -------------------------------------------------------------
export async function getDbDriveServiceAccountConfig(): Promise<DriveServiceAccountConfig> {
  return cachedDriveServiceAccountConfig;
}

export async function saveDbDriveServiceAccountConfig(
  config: Partial<DriveServiceAccountConfig>
): Promise<DriveServiceAccountConfig> {
  cachedDriveServiceAccountConfig = {
    ...cachedDriveServiceAccountConfig,
    ...config,
  };
  saveLocalBackups();
  firestoreSetDoc('config', 'drive_service_account', cachedDriveServiceAccountConfig);
  return cachedDriveServiceAccountConfig;
}

// -------------------------------------------------------------
// CRUD METHODS (SECURITY PIN)
// -------------------------------------------------------------
export async function getDbSecurityPinConfig(): Promise<SecurityPinConfig & { hasCustomPin: boolean }> {
  return {
    ...cachedSecurityPinConfig,
    hasCustomPin: cachedSecurityPinConfig.pin !== '1234',
  };
}

export async function getDbSecurityPin(): Promise<string> {
  return cachedSecurityPinConfig.pin;
}

export async function saveDbSecurityPin(pin: string, hint?: string): Promise<SecurityPinConfig> {
  const cleanPin = pin.trim();
  cachedSecurityPin = cleanPin;
  cachedSecurityPinConfig = {
    ...cachedSecurityPinConfig,
    pin: cleanPin,
    hint: hint !== undefined ? hint.trim() : cachedSecurityPinConfig.hint,
    updatedAt: new Date().toISOString(),
  };
  saveLocalBackups();
  firestoreSetDoc('settings', 'security_pin', cachedSecurityPinConfig);
  return cachedSecurityPinConfig;
}

export async function saveDbSecurityPinSettings(updates: Partial<SecurityPinConfig>): Promise<SecurityPinConfig> {
  cachedSecurityPinConfig = {
    ...cachedSecurityPinConfig,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  if (updates.pin) {
    cachedSecurityPin = updates.pin.trim();
  }
  saveLocalBackups();
  firestoreSetDoc('settings', 'security_pin', cachedSecurityPinConfig);
  return cachedSecurityPinConfig;
}

export async function verifyDbSecurityPin(pin: string): Promise<boolean> {
  if (!cachedSecurityPinConfig.isEnabled) return true;
  return String(pin).trim() === cachedSecurityPinConfig.pin;
}

// -------------------------------------------------------------
// CRUD METHODS (NOTIFICATIONS)
// -------------------------------------------------------------
export async function getDbNotificationLogs(): Promise<NotificationLog[]> {
  return cachedNotificationLogs;
}

export async function addDbNotificationLog(log: NotificationLog): Promise<NotificationLog> {
  cachedNotificationLogs.unshift(log);
  if (cachedNotificationLogs.length > 100) {
    cachedNotificationLogs.pop();
  }
  firestoreSetDoc('notifications', log.id || `notif-${Date.now()}`, log);
  return log;
}

// -------------------------------------------------------------
// CONVERSATION MEMORY BUFFER (TELEGRAM & WEB MULTI-TURN AI)
// -------------------------------------------------------------
export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const conversationMemoryStore = new Map<string, ConversationTurn[]>();

export function getConversationHistory(sessionId: string): ConversationTurn[] {
  const history = conversationMemoryStore.get(sessionId) || [];
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const validHistory = history.filter(t => t.timestamp > oneDayAgo);
  if (validHistory.length !== history.length) {
    conversationMemoryStore.set(sessionId, validHistory);
  }
  return validHistory;
}

export function appendConversationTurn(
  sessionId: string,
  userMessage: string,
  assistantReply: string
): void {
  const current = getConversationHistory(sessionId);
  const now = Date.now();
  current.push({ role: 'user', content: userMessage, timestamp: now });
  current.push({ role: 'assistant', content: assistantReply, timestamp: now });
  if (current.length > 10) {
    current.splice(0, current.length - 10);
  }
  conversationMemoryStore.set(sessionId, current);
}

export function clearConversationHistory(sessionId: string): void {
  conversationMemoryStore.delete(sessionId);
}

// -------------------------------------------------------------
// CRUD METHODS (AI SELF-LEARNING MEMORY & INSIGHTS)
// -------------------------------------------------------------
export async function getDbAiMemories(): Promise<AiMemoryFact[]> {
  return cachedAiMemories.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
}

export async function getActiveDbAiMemories(): Promise<AiMemoryFact[]> {
  return cachedAiMemories.filter(m => m.isActive !== false);
}

export async function saveDbAiMemory(memory: AiMemoryFact): Promise<AiMemoryFact> {
  const index = cachedAiMemories.findIndex(m => m.id === memory.id);
  if (index >= 0) {
    cachedAiMemories[index] = {
      ...cachedAiMemories[index],
      ...memory,
      updatedAt: new Date().toISOString(),
    };
  } else {
    cachedAiMemories.unshift(memory);
  }
  saveLocalBackups();
  firestoreSetDoc('ai_memories', memory.id, memory);
  return memory;
}

export async function deleteDbAiMemory(id: string): Promise<boolean> {
  cachedAiMemories = cachedAiMemories.filter(m => m.id !== id);
  saveLocalBackups();
  firestoreDeleteDoc('ai_memories', id);
  return true;
}

export async function getDbAiInsights(): Promise<AiLearningInsight[]> {
  return cachedAiInsights.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
}

export async function saveDbAiInsight(insight: AiLearningInsight): Promise<AiLearningInsight> {
  const index = cachedAiInsights.findIndex(i => i.id === insight.id);
  if (index >= 0) {
    cachedAiInsights[index] = insight;
  } else {
    cachedAiInsights.unshift(insight);
  }
  if (cachedAiInsights.length > 50) {
    cachedAiInsights = cachedAiInsights.slice(0, 50);
  }
  saveLocalBackups();
  firestoreSetDoc('ai_insights', insight.id, insight);
  return insight;
}

export async function deleteDbAiInsight(id: string): Promise<boolean> {
  cachedAiInsights = cachedAiInsights.filter(i => i.id !== id);
  saveLocalBackups();
  firestoreDeleteDoc('ai_insights', id);
  return true;
}

export async function getDbAiLearningStats(): Promise<AiLearningStats> {
  const activeMemories = cachedAiMemories.filter(m => m.isActive !== false);
  const total = cachedAiMemories.length;

  const categoryCounts: Record<string, number> = {};
  for (const m of activeMemories) {
    categoryCounts[m.category] = (categoryCounts[m.category] || 0) + 1;
  }

  const topCategories = Object.entries(categoryCounts).map(([cat, count]) => ({
    category: cat,
    count,
  })).sort((a, b) => b.count - a.count);

  // Score calculation: 10 + (activeMemories * 15) + (insights * 10) capped at 100
  const calculatedScore = Math.min(100, 20 + activeMemories.length * 12 + cachedAiInsights.length * 8);

  let learningLevel = 'Tập sự (Novice)';
  if (calculatedScore >= 85) {
    learningLevel = 'Cố vấn tri kỷ (Executive Twin)';
  } else if (calculatedScore >= 60) {
    learningLevel = 'Đồng hành thông thái (Wise Companion)';
  } else if (calculatedScore >= 40) {
    learningLevel = 'Thấu hiểu (Adaptive Partner)';
  }

  const latestInsight = cachedAiInsights[0];

  return {
    totalMemories: total,
    activeMemoriesCount: activeMemories.length,
    insightsCount: cachedAiInsights.length,
    topCategories,
    learningLevel,
    learningScore: calculatedScore,
    lastReflectedAt: latestInsight ? latestInsight.generatedAt : undefined,
  };
}

export async function getDbAiPersonaConfig(): Promise<AiPersonaConfig> {
  return cachedAiPersonaConfig;
}

export async function saveDbAiPersonaConfig(config: Partial<AiPersonaConfig>): Promise<AiPersonaConfig> {
  cachedAiPersonaConfig = {
    ...cachedAiPersonaConfig,
    ...config,
    updatedAt: new Date().toISOString(),
  };
  saveLocalBackups();
  firestoreSetDoc('ai_persona', 'config', cachedAiPersonaConfig);
  return cachedAiPersonaConfig;
}

