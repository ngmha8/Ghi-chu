import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  Firestore
} from 'firebase/firestore';
import { Task, Note, TelegramConfig, NotificationLog } from '../types/index.ts';

// Config
import firebaseConfig from '../../firebase-applet-config.json';

let dbInstance: Firestore | null = null;

export function getClientDb(): Firestore | null {
  if (dbInstance) return dbInstance;
  if (!firebaseConfig || !firebaseConfig.apiKey) return null;
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
    dbInstance = getFirestore(app, dbId);
    return dbInstance;
  } catch (err) {
    console.warn('Failed to initialize client Firestore:', err);
    return null;
  }
}

/**
 * Subscribe to real-time Tasks updates from Firestore
 */
export function subscribeTasks(onUpdate: (tasks: Task[]) => void): () => void {
  const db = getClientDb();
  if (!db) return () => {};

  try {
    const q = collection(db, 'tasks');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) return;
      const tasks: Task[] = [];
      snapshot.forEach((d) => {
        tasks.push({ id: d.id, ...d.data() } as Task);
      });
      tasks.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
      onUpdate(tasks);
    }, (error) => {
      console.warn('Firestore tasks realtime snapshot error:', error);
    });
    return unsubscribe;
  } catch (e) {
    console.warn('Could not subscribe to tasks:', e);
    return () => {};
  }
}

/**
 * Subscribe to real-time Notes updates from Firestore
 */
export function subscribeNotes(onUpdate: (notes: Note[]) => void): () => void {
  const db = getClientDb();
  if (!db) return () => {};

  try {
    const q = collection(db, 'notes');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) return;
      const notes: Note[] = [];
      snapshot.forEach((d) => {
        notes.push({ id: d.id, ...d.data() } as Note);
      });
      notes.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      onUpdate(notes);
    }, (error) => {
      console.warn('Firestore notes realtime snapshot error:', error);
    });
    return unsubscribe;
  } catch (e) {
    console.warn('Could not subscribe to notes:', e);
    return () => {};
  }
}

/**
 * Subscribe to real-time Telegram / Notification logs from Firestore
 */
export function subscribeNotifications(onUpdate: (logs: NotificationLog[]) => void): () => void {
  const db = getClientDb();
  if (!db) return () => {};

  try {
    const q = collection(db, 'notifications');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) return;
      const logs: NotificationLog[] = [];
      snapshot.forEach((d) => {
        logs.push({ id: d.id, ...d.data() } as NotificationLog);
      });
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onUpdate(logs);
    }, (error) => {
      console.warn('Firestore notifications realtime snapshot error:', error);
    });
    return unsubscribe;
  } catch (e) {
    console.warn('Could not subscribe to notifications:', e);
    return () => {};
  }
}

/**
 * Subscribe to Telegram config updates from Firestore
 */
export function subscribeTelegramConfig(onUpdate: (config: TelegramConfig) => void): () => void {
  const db = getClientDb();
  if (!db) return () => {};

  try {
    const docRef = doc(db, 'config', 'telegram');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(docSnap.data() as TelegramConfig);
      }
    }, (error) => {
      console.warn('Firestore config snapshot error:', error);
    });
    return unsubscribe;
  } catch (e) {
    console.warn('Could not subscribe to telegram config:', e);
    return () => {};
  }
}
