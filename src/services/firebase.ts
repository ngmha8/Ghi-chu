import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  setLogLevel,
  collection,
  onSnapshot,
  doc,
  Firestore,
} from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import type {
  Task,
  Note,
  DriveFile,
  TelegramConfig,
  NotificationLog,
  DocumentCategory,
  AiMemoryFact,
  AiLearningInsight
} from '../types/index.ts';
import firebaseConfig from '../../firebase-applet-config.json';
import { api } from './api.ts';

// -------------------------------------------------------------
// FIRESTORE LOGGING CONFIGURATION
// Silence internal gRPC stream lifecycle & idle disconnection logs
// (e.g. "CANCELLED: Disconnecting idle stream. Timed out waiting for new targets")
// -------------------------------------------------------------
try {
  setLogLevel('silent');
} catch (e) {
  // Ignore fallback
}

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);

// Initialize Firestore Database singleton
let firestoreInstance: Firestore;
try {
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
} catch (e) {
  firestoreInstance = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId || '(default)');
}
export const db: Firestore = firestoreInstance;

// Helper: Check if client has active authenticated credentials to listen directly to Firestore
function canDirectStream(): boolean {
  try {
    return !!auth.currentUser && !auth.currentUser.isAnonymous;
  } catch {
    return false;
  }
}

// -------------------------------------------------------------
// SECURE & RESILIENT REAL-TIME DATA SYNCHRONIZATION
// Under strict Firestore security rules (where unauthenticated direct
// client listeners are forbidden to protect database integrity),
// the client synchronizes via the server-side API when unauthenticated,
// or via Firestore onSnapshot when authenticated.
// -------------------------------------------------------------

export function subscribeTasks(onUpdate: (tasks: Task[]) => void): () => void {
  let isSubscribed = true;

  // 1. Direct Firestore onSnapshot if authenticated
  if (canDirectStream()) {
    try {
      const colRef = collection(db, 'tasks');
      const unsub = onSnapshot(colRef, (snapshot) => {
        if (!isSubscribed || snapshot.empty) return;
        const tasks: Task[] = [];
        snapshot.forEach(docSnap => {
          tasks.push({ ...(docSnap.data() as Task), id: docSnap.id });
        });
        try { localStorage.setItem('cached_tasks', JSON.stringify(tasks)); } catch {}
        onUpdate(tasks);
      }, () => {
        // Silent fallback to API sync on stream disconnect or permission change
      });
      return () => {
        isSubscribed = false;
        unsub();
      };
    } catch {
      // Continue to API sync fallback
    }
  }

  // 2. Server-side API Sync with auto-refresh on window focus & periodic interval
  const syncFromApi = async () => {
    if (!isSubscribed) return;
    try {
      const tasks = await api.getTasks();
      if (isSubscribed && Array.isArray(tasks) && tasks.length > 0) {
        onUpdate(tasks);
      }
    } catch {
      // Silent error handler
    }
  };

  const handleFocus = () => {
    if (document.visibilityState === 'visible') {
      syncFromApi();
    }
  };

  const handleCustomSync = () => {
    syncFromApi();
  };

  window.addEventListener('visibilitychange', handleFocus);
  window.addEventListener('focus', handleFocus);
  window.addEventListener('app:tasks-sync', handleCustomSync);
  const intervalId = setInterval(syncFromApi, 25000);

  return () => {
    isSubscribed = false;
    clearInterval(intervalId);
    window.removeEventListener('visibilitychange', handleFocus);
    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('app:tasks-sync', handleCustomSync);
  };
}

export function subscribeNotes(onUpdate: (notes: Note[]) => void): () => void {
  let isSubscribed = true;

  if (canDirectStream()) {
    try {
      const colRef = collection(db, 'notes');
      const unsub = onSnapshot(colRef, (snapshot) => {
        if (!isSubscribed || snapshot.empty) return;
        const notes: Note[] = [];
        snapshot.forEach(docSnap => {
          notes.push({ ...(docSnap.data() as Note), id: docSnap.id });
        });
        try { localStorage.setItem('cached_notes', JSON.stringify(notes)); } catch {}
        onUpdate(notes);
      }, () => {});
      return () => {
        isSubscribed = false;
        unsub();
      };
    } catch {}
  }

  const syncFromApi = async () => {
    if (!isSubscribed) return;
    try {
      const notes = await api.getNotes();
      if (isSubscribed && Array.isArray(notes) && notes.length > 0) {
        onUpdate(notes);
      }
    } catch {}
  };

  const handleFocus = () => {
    if (document.visibilityState === 'visible') syncFromApi();
  };

  window.addEventListener('visibilitychange', handleFocus);
  window.addEventListener('focus', handleFocus);
  window.addEventListener('app:notes-sync', syncFromApi);
  const intervalId = setInterval(syncFromApi, 30000);

  return () => {
    isSubscribed = false;
    clearInterval(intervalId);
    window.removeEventListener('visibilitychange', handleFocus);
    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('app:notes-sync', syncFromApi);
  };
}

export function subscribeCategories(onUpdate: (categories: DocumentCategory[]) => void): () => void {
  let isSubscribed = true;

  if (canDirectStream()) {
    try {
      const colRef = collection(db, 'categories');
      const unsub = onSnapshot(colRef, (snapshot) => {
        if (!isSubscribed || snapshot.empty) return;
        const categories: DocumentCategory[] = [];
        snapshot.forEach(docSnap => {
          categories.push({ ...(docSnap.data() as DocumentCategory), id: docSnap.id });
        });
        try { localStorage.setItem('cached_categories', JSON.stringify(categories)); } catch {}
        onUpdate(categories);
      }, () => {});
      return () => {
        isSubscribed = false;
        unsub();
      };
    } catch {}
  }

  const syncFromApi = async () => {
    if (!isSubscribed) return;
    try {
      const categories = await api.getCategories();
      if (isSubscribed && Array.isArray(categories) && categories.length > 0) {
        onUpdate(categories);
      }
    } catch {}
  };

  const handleFocus = () => {
    if (document.visibilityState === 'visible') syncFromApi();
  };

  window.addEventListener('visibilitychange', handleFocus);
  window.addEventListener('focus', handleFocus);
  const intervalId = setInterval(syncFromApi, 60000);

  return () => {
    isSubscribed = false;
    clearInterval(intervalId);
    window.removeEventListener('visibilitychange', handleFocus);
    window.removeEventListener('focus', handleFocus);
  };
}

export function subscribeFiles(onUpdate: (files: DriveFile[]) => void): () => void {
  let isSubscribed = true;

  if (canDirectStream()) {
    try {
      const colRef = collection(db, 'files');
      const unsub = onSnapshot(colRef, (snapshot) => {
        if (!isSubscribed || snapshot.empty) return;
        const files: DriveFile[] = [];
        snapshot.forEach(docSnap => {
          files.push({ ...(docSnap.data() as DriveFile), id: docSnap.id });
        });
        try { localStorage.setItem('cached_files', JSON.stringify(files)); } catch {}
        onUpdate(files);
      }, () => {});
      return () => {
        isSubscribed = false;
        unsub();
      };
    } catch {}
  }

  const syncFromApi = async () => {
    if (!isSubscribed) return;
    try {
      const files = await api.getFiles();
      if (isSubscribed && Array.isArray(files) && files.length > 0) {
        onUpdate(files);
      }
    } catch {}
  };

  const handleFocus = () => {
    if (document.visibilityState === 'visible') syncFromApi();
  };

  window.addEventListener('visibilitychange', handleFocus);
  window.addEventListener('focus', handleFocus);
  const intervalId = setInterval(syncFromApi, 45000);

  return () => {
    isSubscribed = false;
    clearInterval(intervalId);
    window.removeEventListener('visibilitychange', handleFocus);
    window.removeEventListener('focus', handleFocus);
  };
}

/**
 * Telegram config contains sensitive bot token and is strictly locked from client direct read.
 * All updates are synced via the authenticated Server API.
 */
export function subscribeTelegramConfig(onUpdate: (config: TelegramConfig) => void): () => void {
  let isSubscribed = true;

  const syncFromApi = async () => {
    if (!isSubscribed) return;
    try {
      const res = await api.getTelegramConfig();
      if (isSubscribed && res && res.config) {
        onUpdate(res.config);
      }
    } catch {}
  };

  const handleFocus = () => {
    if (document.visibilityState === 'visible') syncFromApi();
  };

  window.addEventListener('visibilitychange', handleFocus);
  window.addEventListener('focus', handleFocus);
  const intervalId = setInterval(syncFromApi, 60000);

  return () => {
    isSubscribed = false;
    clearInterval(intervalId);
    window.removeEventListener('visibilitychange', handleFocus);
    window.removeEventListener('focus', handleFocus);
  };
}

export function subscribeNotifications(onUpdate: (logs: NotificationLog[]) => void): () => void {
  let isSubscribed = true;

  const syncFromApi = async () => {
    if (!isSubscribed) return;
    try {
      const res = await api.getTelegramConfig();
      if (isSubscribed && res && Array.isArray(res.logs) && res.logs.length > 0) {
        onUpdate(res.logs);
      }
    } catch {}
  };

  const handleFocus = () => {
    if (document.visibilityState === 'visible') syncFromApi();
  };

  window.addEventListener('visibilitychange', handleFocus);
  window.addEventListener('focus', handleFocus);
  const intervalId = setInterval(syncFromApi, 30000);

  return () => {
    isSubscribed = false;
    clearInterval(intervalId);
    window.removeEventListener('visibilitychange', handleFocus);
    window.removeEventListener('focus', handleFocus);
  };
}

export function subscribeAiMemories(onUpdate: (memories: AiMemoryFact[]) => void): () => void {
  let isSubscribed = true;

  const syncFromApi = async () => {
    if (!isSubscribed) return;
    try {
      const memories = await api.getAiMemories();
      if (isSubscribed && Array.isArray(memories) && memories.length > 0) {
        onUpdate(memories.sort((a, b) => (b.confidence || 0) - (a.confidence || 0)));
      }
    } catch {}
  };

  const handleFocus = () => {
    if (document.visibilityState === 'visible') syncFromApi();
  };

  window.addEventListener('visibilitychange', handleFocus);
  window.addEventListener('focus', handleFocus);
  const intervalId = setInterval(syncFromApi, 60000);

  return () => {
    isSubscribed = false;
    clearInterval(intervalId);
    window.removeEventListener('visibilitychange', handleFocus);
    window.removeEventListener('focus', handleFocus);
  };
}

export function subscribeAiInsights(onUpdate: (insights: AiLearningInsight[]) => void): () => void {
  let isSubscribed = true;

  const syncFromApi = async () => {
    if (!isSubscribed) return;
    try {
      const insights = await api.getAiInsights();
      if (isSubscribed && Array.isArray(insights) && insights.length > 0) {
        onUpdate(insights.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()));
      }
    } catch {}
  };

  const handleFocus = () => {
    if (document.visibilityState === 'visible') syncFromApi();
  };

  window.addEventListener('visibilitychange', handleFocus);
  window.addEventListener('focus', handleFocus);
  const intervalId = setInterval(syncFromApi, 60000);

  return () => {
    isSubscribed = false;
    clearInterval(intervalId);
    window.removeEventListener('visibilitychange', handleFocus);
    window.removeEventListener('focus', handleFocus);
  };
}
