import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Task, Note, DriveFile, TelegramConfig, NotificationLog } from '../src/types/index.ts';
import {
  initialTasks,
  initialNotes,
  initialFiles,
  initialTelegramConfig,
  initialNotificationLogs
} from './initialData.ts';

const _dirname = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

// 1. Load Firebase configuration from firebase-applet-config.json
let firebaseConfig: any = null;
try {
  const configFile = path.join(_dirname, 'firebase-applet-config.json');
  if (fs.existsSync(configFile)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
  }
} catch (err) {
  console.warn('Error reading firebase-applet-config.json:', err);
}

let db: any = null;
let isFirestoreAvailable = false;

if (firebaseConfig && firebaseConfig.apiKey) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
    db = getFirestore(app, dbId);
    isFirestoreAvailable = true;
    console.log(`🔥 Firebase Firestore successfully connected (DB: ${dbId})`);
  } catch (err) {
    console.error('⚠️ Could not initialize Firestore, using local fallback:', err);
    isFirestoreAvailable = false;
  }
} else {
  console.log('ℹ️ No Firebase configuration detected, running in local storage mode.');
}

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
} catch (e) {
  console.warn('Could not read local backup files:', e);
}

function saveLocalBackups() {
  try {
    fs.writeFileSync(LOCAL_CONFIG_FILE, JSON.stringify(cachedTelegramConfig, null, 2), 'utf-8');
    fs.writeFileSync(LOCAL_TASKS_FILE, JSON.stringify(cachedTasks, null, 2), 'utf-8');
    fs.writeFileSync(LOCAL_NOTES_FILE, JSON.stringify(cachedNotes, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Error saving local backup:', e);
  }
}

// -------------------------------------------------------------
// FIRESTORE INITIALIZATION & SEEDING
// -------------------------------------------------------------
export async function initializeFirestoreData() {
  if (!isFirestoreAvailable || !db) return;

  try {
    // 1. Sync Config
    const configDocRef = doc(db, 'config', 'telegram');
    const configSnap = await getDoc(configDocRef);
    if (configSnap.exists()) {
      cachedTelegramConfig = { ...cachedTelegramConfig, ...(configSnap.data() as TelegramConfig) };
    } else {
      await setDoc(configDocRef, cachedTelegramConfig);
    }

    // 2. Sync Tasks
    const tasksCol = collection(db, 'tasks');
    const tasksSnap = await getDocs(tasksCol);
    if (!tasksSnap.empty) {
      const fetchedTasks: Task[] = [];
      tasksSnap.forEach(d => {
        fetchedTasks.push({ id: d.id, ...d.data() } as Task);
      });
      cachedTasks = fetchedTasks;
    } else {
      // Seed initial tasks
      for (const t of cachedTasks) {
        await setDoc(doc(db, 'tasks', t.id), t);
      }
    }

    // 3. Sync Notes
    const notesCol = collection(db, 'notes');
    const notesSnap = await getDocs(notesCol);
    if (!notesSnap.empty) {
      const fetchedNotes: Note[] = [];
      notesSnap.forEach(d => {
        fetchedNotes.push({ id: d.id, ...d.data() } as Note);
      });
      cachedNotes = fetchedNotes;
    } else {
      // Seed initial notes
      for (const n of cachedNotes) {
        await setDoc(doc(db, 'notes', n.id), n);
      }
    }

    // 4. Sync Notifications
    const notifsCol = collection(db, 'notifications');
    const notifsSnap = await getDocs(notifsCol);
    if (!notifsSnap.empty) {
      const fetchedNotifs: NotificationLog[] = [];
      notifsSnap.forEach(d => {
        fetchedNotifs.push({ id: d.id, ...d.data() } as NotificationLog);
      });
      cachedNotificationLogs = fetchedNotifs.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } else {
      for (const log of cachedNotificationLogs) {
        await setDoc(doc(db, 'notifications', log.id), log);
      }
    }

    saveLocalBackups();
    console.log('✅ Firebase Firestore synchronized successfully!');
  } catch (err) {
    console.error('Error synchronizing with Firestore:', err);
  }
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

  if (isFirestoreAvailable && db) {
    setDoc(doc(db, 'tasks', task.id), task).catch(e =>
      console.warn(`Firestore task save error (${task.id}):`, e)
    );
  }
  return task;
}

export async function deleteDbTask(id: string): Promise<boolean> {
  cachedTasks = cachedTasks.filter(t => t.id !== id);
  saveLocalBackups();

  if (isFirestoreAvailable && db) {
    deleteDoc(doc(db, 'tasks', id)).catch(e =>
      console.warn(`Firestore task delete error (${id}):`, e)
    );
  }
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

  if (isFirestoreAvailable && db) {
    setDoc(doc(db, 'notes', note.id), note).catch(e =>
      console.warn(`Firestore note save error (${note.id}):`, e)
    );
  }
  return note;
}

export async function deleteDbNote(id: string): Promise<boolean> {
  cachedNotes = cachedNotes.filter(n => n.id !== id);
  saveLocalBackups();

  if (isFirestoreAvailable && db) {
    deleteDoc(doc(db, 'notes', id)).catch(e =>
      console.warn(`Firestore note delete error (${id}):`, e)
    );
  }
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

  if (isFirestoreAvailable && db) {
    setDoc(doc(db, 'config', 'telegram'), cachedTelegramConfig).catch(e =>
      console.warn('Firestore telegram config save error:', e)
    );
  }
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

  if (isFirestoreAvailable && db) {
    setDoc(doc(db, 'notifications', log.id), log).catch(e =>
      console.warn('Firestore notification save error:', e)
    );
  }
  return log;
}
