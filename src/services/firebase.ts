import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
} from 'firebase/firestore';
import type { Task, Note, DriveFile, TelegramConfig, NotificationLog, DocumentCategory } from '../types/index.ts';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App & Firestore Database
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

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
      // Sort tasks by priority or createdAt if present
      onUpdate(tasks);
    }, (error) => {
      console.warn('Firestore tasks subscription fallback:', error);
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
      onUpdate(notes);
    }, (error) => {
      console.warn('Firestore notes subscription fallback:', error);
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
      onUpdate(categories);
    }, (error) => {
      console.warn('Firestore categories subscription fallback:', error);
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
      onUpdate(files);
    }, (error) => {
      console.warn('Firestore files subscription fallback:', error);
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
        onUpdate(docSnap.data() as TelegramConfig);
      }
    }, (error) => {
      console.warn('Firestore telegram config subscription fallback:', error);
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
      console.warn('Firestore notifications subscription fallback:', error);
    });
  } catch (err) {
    console.warn('Could not initialize notifications subscription:', err);
    return () => {};
  }
}
