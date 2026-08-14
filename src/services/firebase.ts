import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Client-side Firebase configuration loaded from root configuration
let firebaseConfig: any = null;

try {
  // @ts-ignore
  import('../../firebase-applet-config.json').then((module) => {
    firebaseConfig = module.default || module;
  });
} catch (e) {
  // fallback if dynamic import not available
}

export function getClientFirebase() {
  if (!firebaseConfig) return null;
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
  return { app, db };
}
