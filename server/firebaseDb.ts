import fs from 'fs';
import path from 'path';
import { Task, Note, DriveFile, TelegramConfig, NotificationLog, DriveServiceAccountConfig } from '../src/types/index.ts';
import {
  initialTasks,
  initialNotes,
  initialFiles,
  initialTelegramConfig,
  initialNotificationLogs
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
export let cachedTasks: Task[] = [...initialTasks];
export let cachedNotes: Note[] = [...initialNotes];
export let cachedFiles: DriveFile[] = [...initialFiles];
export let cachedTelegramConfig: TelegramConfig = { ...initialTelegramConfig };
export let cachedNotificationLogs: NotificationLog[] = [...initialNotificationLogs];
export let cachedDriveServiceAccountConfig: DriveServiceAccountConfig = { ...initialDriveServiceAccountConfig };
export let cachedSecurityPin: string = defaultSecurityPin;

// Local JSON file backup path
const DATA_DIR = path.join(_dirname, 'data');
const LOCAL_CONFIG_FILE = path.join(DATA_DIR, 'telegram_config.json');
const LOCAL_TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const LOCAL_NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const LOCAL_FILES_FILE = path.join(DATA_DIR, 'files.json');
const LOCAL_DRIVE_SA_FILE = path.join(DATA_DIR, 'drive_service_account.json');
const LOCAL_SECURITY_PIN_FILE = path.join(DATA_DIR, 'security_pin.json');

if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}

// Read local backups if present
try {
  if (fs.existsSync(LOCAL_CONFIG_FILE)) {
    const data = JSON.parse(fs.readFileSync(LOCAL_CONFIG_FILE, 'utf-8'));
    cachedTelegramConfig = { ...cachedTelegramConfig, ...data };
  }
  if (fs.existsSync(LOCAL_DRIVE_SA_FILE)) {
    const data = JSON.parse(fs.readFileSync(LOCAL_DRIVE_SA_FILE, 'utf-8'));
    cachedDriveServiceAccountConfig = { ...cachedDriveServiceAccountConfig, ...data };
  }
  if (fs.existsSync(LOCAL_TASKS_FILE)) {
    const data = JSON.parse(fs.readFileSync(LOCAL_TASKS_FILE, 'utf-8'));
    if (Array.isArray(data)) cachedTasks = data;
  }
  if (fs.existsSync(LOCAL_NOTES_FILE)) {
    const data = JSON.parse(fs.readFileSync(LOCAL_NOTES_FILE, 'utf-8'));
    if (Array.isArray(data)) cachedNotes = data;
  }
  if (fs.existsSync(LOCAL_FILES_FILE)) {
    const data = JSON.parse(fs.readFileSync(LOCAL_FILES_FILE, 'utf-8'));
    if (Array.isArray(data)) cachedFiles = data;
  }
  if (fs.existsSync(LOCAL_SECURITY_PIN_FILE)) {
    const data = JSON.parse(fs.readFileSync(LOCAL_SECURITY_PIN_FILE, 'utf-8'));
    if (data) {
      if (data.pin) cachedSecurityPin = data.pin.toString();
      cachedSecurityPinConfig = {
        ...cachedSecurityPinConfig,
        ...data,
        pin: data.pin ? data.pin.toString() : cachedSecurityPin,
      };
    }
  }
} catch (e) {
  console.warn('Could not read local backup files:', e);
}

function saveLocalBackups() {
  try {
    fs.writeFileSync(LOCAL_CONFIG_FILE, JSON.stringify(cachedTelegramConfig, null, 2), 'utf-8');
    fs.writeFileSync(LOCAL_DRIVE_SA_FILE, JSON.stringify(cachedDriveServiceAccountConfig, null, 2), 'utf-8');
    fs.writeFileSync(LOCAL_TASKS_FILE, JSON.stringify(cachedTasks, null, 2), 'utf-8');
    fs.writeFileSync(LOCAL_NOTES_FILE, JSON.stringify(cachedNotes, null, 2), 'utf-8');
    fs.writeFileSync(LOCAL_FILES_FILE, JSON.stringify(cachedFiles, null, 2), 'utf-8');
    fs.writeFileSync(LOCAL_SECURITY_PIN_FILE, JSON.stringify(cachedSecurityPinConfig, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Error saving local backup:', e);
  }
}

export async function initializeFirestoreData() {
  saveLocalBackups();
  console.log('✅ Local storage initialized successfully.');
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
  return task;
}

export async function deleteDbTask(id: string): Promise<boolean> {
  cachedTasks = cachedTasks.filter(t => t.id !== id);
  saveLocalBackups();
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
  return note;
}

export async function deleteDbNote(id: string): Promise<boolean> {
  cachedNotes = cachedNotes.filter(n => n.id !== id);
  saveLocalBackups();
  return true;
}

// -------------------------------------------------------------
// CRUD METHODS (FILES)
// -------------------------------------------------------------
export async function getDbFiles(): Promise<DriveFile[]> {
  return cachedFiles.map(f => {
    // If it has a legitimate Google Drive ID/view link, mark as synced
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
  return file;
}

export async function deleteDbFile(id: string): Promise<boolean> {
  cachedFiles = cachedFiles.filter(f => f.id !== id);
  saveLocalBackups();
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

// Memory buffer mapped by session/chat ID with auto-pruning (max 10 recent turns, 24h TTL)
const conversationMemoryStore = new Map<string, ConversationTurn[]>();

export function getConversationHistory(sessionId: string): ConversationTurn[] {
  const history = conversationMemoryStore.get(sessionId) || [];
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  // Filter out expired turns (> 24 hours)
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
  // Keep maximum last 10 turns (5 full user-assistant dialogues)
  if (current.length > 10) {
    current.splice(0, current.length - 10);
  }
  conversationMemoryStore.set(sessionId, current);
}

export function clearConversationHistory(sessionId: string): void {
  conversationMemoryStore.delete(sessionId);
}

