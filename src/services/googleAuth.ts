import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const provider = new GoogleAuthProvider();
// Workspace Drive scope for full sync
provider.addScope('https://www.googleapis.com/auth/drive.file');

// In-memory & sessionStorage token cache
let cachedAccessToken: string | null = typeof window !== 'undefined' ? sessionStorage.getItem('google_oauth_access_token') : null;
let isSigningIn = false;

/**
 * Listen to Firebase Auth state
 */
export const initGoogleAuth = (
  onSuccess?: (user: User, token: string | null) => void,
  onFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (!cachedAccessToken && typeof window !== 'undefined') {
        cachedAccessToken = sessionStorage.getItem('google_oauth_access_token');
      }
      if (onSuccess) onSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (typeof window !== 'undefined') sessionStorage.removeItem('google_oauth_access_token');
      if (onFailure) onFailure();
    }
  });
};

/**
 * 1-Click Interactive Google Sign-In with Workspace Drive Scopes
 */
export const signInWithGoogleWorkspace = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Không lấy được OAuth Access Token từ Google');
    }

    cachedAccessToken = credential.accessToken;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('google_oauth_access_token', cachedAccessToken);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getGoogleAccessToken = (): string | null => {
  if (!cachedAccessToken && typeof window !== 'undefined') {
    cachedAccessToken = sessionStorage.getItem('google_oauth_access_token');
  }
  return cachedAccessToken;
};

export const setGoogleAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      sessionStorage.setItem('google_oauth_access_token', token);
    } else {
      sessionStorage.removeItem('google_oauth_access_token');
    }
  }
};

export const googleSignOut = async () => {
  await signOut(auth);
  setGoogleAccessToken(null);
};
