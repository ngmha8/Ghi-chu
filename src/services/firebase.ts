import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  setLogLevel,
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
} from 'firebase/firestore';
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

// Silence offline/transient connection warning logs in browser console
try {
  setLogLevel('error');
} catch (e) {}

// Initialize Firebase App & Firestore Database with auto-detect long polling for sandbox/proxy compatibility
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}
export const db = firestoreInstance;

// -------------------------------------------------------------
// REAL-TIME FIRESTORE SUBSCRIPTIONS
// -------------------------------------------------------------

export function subscribeTasks(onUpdate: (tasks: Task[]) => void): () => void {
  try {
    const colRef = collection(db, 'tasks');
    return onSnapshot(colRef, (snapshot) => {
      if (snapshot.empty) return;
      const tasks: Task[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Task;
        tasks.push({ ...data, id: docSnap.id });
      });
      try { localStorage.setItem('cached_tasks', JSON.stringify(tasks)); } catch {}
      // Sort tasks by priority or createdAt if present
      onUpdate(tasks);
    }, (error) => {
      // Benign offline fallback handler
      if (error?.code !== 'unavailable') {
        console.warn('Firestore tasks subscription status:', error?.message || error);
      }
    });
  } catch (err) {
    console.warn('Could not initialize tasks subscription:', err);
    return () => {};
  }
}

export function subscribeNotes(onUpdate: (notes: Note[]) => void): () => void {
  try {
    const colRef = collection(db, 'notes');
    return onSnapshot(colRef, (snapshot) => {
      if (snapshot.empty) return;
      const notes: Note[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Note;
        notes.push({ ...data, id: docSnap.id });
      });
      try { localStorage.setItem('cached_notes', JSON.stringify(notes)); } catch {}
      onUpdate(notes);
    }, (error) => {
      if (error?.code !== 'unavailable') {
        console.warn('Firestore notes subscription status:', error?.message || error);
      }
    });
  } catch (err) {
    console.warn('Could not initialize notes subscription:', err);
    return () => {};
  }
}

export function subscribeCategories(onUpdate: (categories: DocumentCategory[]) => void): () => void {
  try {
    const colRef = collection(db, 'categories');
    return onSnapshot(colRef, (snapshot) => {
      if (snapshot.empty) return;
      const categories: DocumentCategory[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as DocumentCategory;
        categories.push({ ...data, id: docSnap.id });
      });
      try { localStorage.setItem('cached_categories', JSON.stringify(categories)); } catch {}
      onUpdate(categories);
    }, (error) => {
      if (error?.code !== 'unavailable') {
        console.warn('Firestore categories subscription status:', error?.message || error);
      }
    });
  } catch (err) {
    console.warn('Could not initialize categories subscription:', err);
    return () => {};
  }
}

export function subscribeFiles(onUpdate: (files: DriveFile[]) => void): () => void {
  try {
    const colRef = collection(db, 'files');
    return onSnapshot(colRef, (snapshot) => {
      if (snapshot.empty) return;
      const files: DriveFile[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as DriveFile;
        files.push({ ...data, id: docSnap.id });
      });
      try { localStorage.setItem('cached_files', JSON.stringify(files)); } catch {}
      onUpdate(files);
    }, (error) => {
      if (error?.code !== 'unavailable') {
        console.warn('Firestore files subscription status:', error?.message || error);
      }
    });
  } catch (err) {
    console.warn('Could not initialize files subscription:', err);
    return () => {};
  }
}

export function subscribeTelegramConfig(onUpdate: (config: TelegramConfig) => void): () => void {
  try {
    const docRef = doc(db, 'config', 'telegram');
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const configData = docSnap.data() as TelegramConfig;
        try { localStorage.setItem('cached_telegram_config', JSON.stringify({ config: configData, logs: [] })); } catch {}
        onUpdate(configData);
      }
    }, (error) => {
      if (error?.code !== 'unavailable') {
        console.warn('Firestore telegram config subscription status:', error?.message || error);
      }
    });
  } catch (err) {
    console.warn('Could not initialize telegram config subscription:', err);
    return () => {};
  }
}

export function subscribeNotifications(onUpdate: (logs: NotificationLog[]) => void): () => void {
  try {
    const colRef = collection(db, 'notifications');
    return onSnapshot(colRef, (snapshot) => {
      if (snapshot.empty) return;
      const logs: NotificationLog[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as NotificationLog;
        logs.push({ ...data, id: docSnap.id });
      });
      onUpdate(logs);
    }, (error) => {
      if (error?.code !== 'unavailable') {
        console.warn('Firestore notifications subscription status:', error?.message || error);
      }
    });
  } catch (err) {
    console.warn('Could not initialize notifications subscription:', err);
    return () => {};
  }
}

export function subscribeAiMemories(onUpdate: (memories: AiMemoryFact[]) => void): () => void {
  try {
    const colRef = collection(db, 'ai_memories');
    return onSnapshot(colRef, (snapshot) => {
      if (snapshot.empty) return;
      const memories: AiMemoryFact[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as AiMemoryFact;
        memories.push({ ...data, id: docSnap.id });
      });
      onUpdate(memories.sort((a, b) => (b.confidence || 0) - (a.confidence || 0)));
    }, (error) => {
      console.warn('Firestore ai_memories subscription fallback:', error);
    });
  } catch (err) {
    console.warn('Could not initialize ai_memories subscription:', err);
    return () => {};
  }
}

export function subscribeAiInsights(onUpdate: (insights: AiLearningInsight[]) => void): () => void {
  try {
    const colRef = collection(db, 'ai_insights');
    return onSnapshot(colRef, (snapshot) => {
      if (snapshot.empty) return;
      const insights: AiLearningInsight[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as AiLearningInsight;
        insights.push({ ...data, id: docSnap.id });
      });
      onUpdate(insights.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()));
    }, (error) => {
      console.warn('Firestore ai_insights subscription fallback:', error);
    });
  } catch (err) {
    console.warn('Could not initialize ai_insights subscription:', err);
    return () => {};
  }
}

