import fs from 'fs';
import path from 'path';
import { Task, Note, DriveFile, TelegramConfig, NotificationLog } from '../src/types/index.ts';
import {
  initialTasks,
  initialNotes,
  initialFiles,
  initialTelegramConfig,
  initialNotificationLogs
} from './initialData.ts';

const _dirname = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

// In-Memory cache for high-speed access & offline resilience
export let cachedTasks: Task[] = [...initialTasks];
export let cachedNotes: Note[] = [...initialNotes];
export let cachedFiles: DriveFile[] = [...initialFiles];
export let cachedTelegramConfig: TelegramConfig = { ...initialTelegramConfig };
export let cachedNotificationLogs: NotificationLog[] = [...initialNotificationLogs];

// Local JSON file backup path
const DATA_DIR = path.join(_dirname, 'data');
const LOCAL_CONFIG_FILE = path.join(DATA_DIR, 'telegram_config.json');
const LOCAL_TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const LOCAL_NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const LOCAL_FILES_FILE = path.join(DATA_DIR, 'files.json');

if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}

// Read local backups if present
try {
  if (fs.existsSync(LOCAL_CONFIG_FILE)) {
    const data = JSON.parse(fs.readFileSync(LOCAL_CONFIG_FILE, 'utf-8'));
    cachedTelegramConfig = { ...cachedTelegramConfig, ...data };
  }
  if (fs.existsSync(LOCAL_TASKS_FILE)) {
    const data = JSON.parse(fs.readFileSync(LOCAL_TASKS_FILE, 'utf-8'));
    if (Array.isArray(data) && data.length > 0) cachedTasks = data;
  }
  if (fs.existsSync(LOCAL_NOTES_FILE)) {
    const data = JSON.parse(fs.readFileSync(LOCAL_NOTES_FILE, 'utf-8'));
    if (Array.isArray(data) && data.length > 0) cachedNotes = data;
  }
  if (fs.existsSync(LOCAL_FILES_FILE)) {
    const data = JSON.parse(fs.readFileSync(LOCAL_FILES_FILE, 'utf-8'));
    if (Array.isArray(data) && data.length > 0) cachedFiles = data;
  }
} catch (e) {
  console.warn('Could not read local backup files:', e);
}

function saveLocalBackups() {
  try {
    fs.writeFileSync(LOCAL_CONFIG_FILE, JSON.stringify(cachedTelegramConfig, null, 2), 'utf-8');
    fs.writeFileSync(LOCAL_TASKS_FILE, JSON.stringify(cachedTasks, null, 2), 'utf-8');
    fs.writeFileSync(LOCAL_NOTES_FILE, JSON.stringify(cachedNotes, null, 2), 'utf-8');
    fs.writeFileSync(LOCAL_FILES_FILE, JSON.stringify(cachedFiles, null, 2), 'utf-8');
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
