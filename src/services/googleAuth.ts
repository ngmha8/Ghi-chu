import firebaseConfig from '../../firebase-applet-config.json';

export interface GoogleOAuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export type GoogleAuthStatus = 'authenticated' | 'expired' | 'unauthenticated';

// In-memory & storage token cache
const OAUTH_TOKEN_KEY = 'google_oauth_access_token';
const OAUTH_USER_KEY = 'google_oauth_user_profile';
const OAUTH_EXPIRES_AT_KEY = 'google_oauth_expires_at';
const CUSTOM_CLIENT_ID_KEY = 'app_custom_google_client_id';

let cachedAccessToken: string | null = typeof window !== 'undefined'
  ? (sessionStorage.getItem(OAUTH_TOKEN_KEY) || localStorage.getItem(OAUTH_TOKEN_KEY))
  : null;

let cachedUser: GoogleOAuthUser | null = null;
let cachedExpiresAt: number | null = null;

if (typeof window !== 'undefined') {
  try {
    const rawUser = sessionStorage.getItem(OAUTH_USER_KEY) || localStorage.getItem(OAUTH_USER_KEY);
    if (rawUser) cachedUser = JSON.parse(rawUser);

    const rawExp = sessionStorage.getItem(OAUTH_EXPIRES_AT_KEY) || localStorage.getItem(OAUTH_EXPIRES_AT_KEY);
    if (rawExp) cachedExpiresAt = parseInt(rawExp, 10) || null;
  } catch (e) {
    console.warn('Error reading cached Google Auth:', e);
  }
}

type AuthListener = (user: GoogleOAuthUser | null, token: string | null, status?: GoogleAuthStatus) => void;
const authListeners = new Set<AuthListener>();

declare global {
  interface Window {
    google?: any;
  }
}

/**
 * Get active Google OAuth Client ID
 */
export function getActiveGoogleClientId(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem(CUSTOM_CLIENT_ID_KEY);
    if (custom && custom.trim()) return custom.trim();
  }
  const envClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
  if (envClientId) {
    return envClientId;
  }
  return firebaseConfig?.oAuthClientId || '';
}

export function setCustomGoogleClientId(clientId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(CUSTOM_CLIENT_ID_KEY, clientId.trim());
  }
}

/**
 * Synchronous getter for cached user profile
 */
export const getCachedGoogleUser = (): GoogleOAuthUser | null => {
  if (!cachedUser && typeof window !== 'undefined') {
    try {
      const rawUser = sessionStorage.getItem(OAUTH_USER_KEY) || localStorage.getItem(OAUTH_USER_KEY);
      if (rawUser) cachedUser = JSON.parse(rawUser);
    } catch (e) {}
  }
  return cachedUser;
};

/**
 * Check if the stored Google access token is expired based on timestamp
 */
export const isGoogleTokenExpired = (): boolean => {
  if (typeof window === 'undefined') return false;
  const token = getGoogleAccessToken();
  if (!token) return true;

  if (cachedExpiresAt) {
    return Date.now() >= cachedExpiresAt;
  }
  const rawExp = sessionStorage.getItem(OAUTH_EXPIRES_AT_KEY) || localStorage.getItem(OAUTH_EXPIRES_AT_KEY);
  if (rawExp) {
    const exp = parseInt(rawExp, 10);
    if (!isNaN(exp)) {
      cachedExpiresAt = exp;
      return Date.now() >= exp;
    }
  }
  return false;
};

/**
 * Get the current comprehensive Google Auth snapshot
 */
export const getGoogleAuthSnapshot = (): {
  status: GoogleAuthStatus;
  user: GoogleOAuthUser | null;
  token: string | null;
  expiresAt: number | null;
} => {
  const token = getGoogleAccessToken();
  const user = getCachedGoogleUser();
  const expired = isGoogleTokenExpired();

  if (token && user && !expired) {
    return { status: 'authenticated', user, token, expiresAt: cachedExpiresAt };
  } else if (token && user && expired) {
    return { status: 'expired', user, token, expiresAt: cachedExpiresAt };
  } else {
    return { status: 'unauthenticated', user: null, token: null, expiresAt: null };
  }
};

/**
 * Load Google Identity Services script dynamically
 */
export function loadGoogleGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const existingScript = document.getElementById('google-gis-sdk');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Không thể tải Google Identity Services SDK')));
      if ((existingScript as any).readyState === 'loaded' || (existingScript as any).readyState === 'complete') {
        resolve();
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gis-sdk';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Không thể tải Google Identity Services SDK'));
    document.head.appendChild(script);
  });
}

/**
 * Proactively validate token with Google APIs
 */
export const validateGoogleAccessToken = async (
  tokenToCheck?: string
): Promise<{ valid: boolean; user?: GoogleOAuthUser | null; reason?: string }> => {
  const token = tokenToCheck || getGoogleAccessToken();
  if (!token) {
    return { valid: false, reason: 'Chưa có token' };
  }

  // Check client-side expiry first
  if (isGoogleTokenExpired()) {
    // Session expired
    const snapshot = getGoogleAuthSnapshot();
    authListeners.forEach(fn => fn(snapshot.user, token, 'expired'));
    return { valid: false, user: snapshot.user, reason: 'Token đã hết hạn' };
  }

  try {
    const res = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(token)}`);
    if (res.ok) {
      const info = await res.json();
      // Token is active and recognized by Google
      const curUser = getCachedGoogleUser();
      const updatedUser: GoogleOAuthUser = {
        uid: curUser?.uid || info.sub || 'google_user',
        displayName: curUser?.displayName || info.email || 'Tài khoản Google',
        email: info.email || curUser?.email || null,
        photoURL: curUser?.photoURL || null,
      };

      cachedUser = updatedUser;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(OAUTH_USER_KEY, JSON.stringify(updatedUser));
        localStorage.setItem(OAUTH_USER_KEY, JSON.stringify(updatedUser));
      }

      authListeners.forEach(fn => fn(updatedUser, token, 'authenticated'));
      return { valid: true, user: updatedUser };
    } else {
      // Google rejected token (400 or 401)
      console.warn('Google token validation failed:', res.status);
      const curUser = getCachedGoogleUser();
      // Mark as expired / invalid
      authListeners.forEach(fn => fn(curUser, token, 'expired'));
      return { valid: false, user: curUser, reason: 'Phiên Google đã hết hạn trên máy chủ Google' };
    }
  } catch (err) {
    // If offline / network error, don't invalidate aggressively
    console.warn('Unable to reach Google token validation service:', err);
    return { valid: true, user: getCachedGoogleUser() };
  }
};

/**
 * Sync state across tabs or after external storage changes
 */
export const syncAuthStateFromStorage = () => {
  if (typeof window === 'undefined') return;
  try {
    const token = sessionStorage.getItem(OAUTH_TOKEN_KEY) || localStorage.getItem(OAUTH_TOKEN_KEY);
    const rawUser = sessionStorage.getItem(OAUTH_USER_KEY) || localStorage.getItem(OAUTH_USER_KEY);
    const rawExp = sessionStorage.getItem(OAUTH_EXPIRES_AT_KEY) || localStorage.getItem(OAUTH_EXPIRES_AT_KEY);

    cachedAccessToken = token;
    cachedUser = rawUser ? JSON.parse(rawUser) : null;
    cachedExpiresAt = rawExp ? parseInt(rawExp, 10) : null;

    const snapshot = getGoogleAuthSnapshot();
    authListeners.forEach(fn => fn(snapshot.user, snapshot.token, snapshot.status));
  } catch (e) {
    console.warn('Error syncing auth state from storage:', e);
  }
};

// Cross-tab and window focus listeners
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === OAUTH_TOKEN_KEY || e.key === OAUTH_USER_KEY || e.key === OAUTH_EXPIRES_AT_KEY) {
      syncAuthStateFromStorage();
    }
  });

  // Re-check validity when user returns to the tab
  window.addEventListener('focus', () => {
    const token = getGoogleAccessToken();
    if (token) {
      validateGoogleAccessToken(token).catch(() => {});
    }
  });
}

/**
 * Listen to Google Auth state
 */
export const initGoogleAuth = (
  onSuccess?: (user: GoogleOAuthUser | null, token: string | null, status?: GoogleAuthStatus) => void,
  onFailure?: () => void
) => {
  const listener: AuthListener = (user, token, status) => {
    if (user && token && status !== 'expired') {
      if (onSuccess) onSuccess(user, token, status || 'authenticated');
    } else if (status === 'expired') {
      if (onSuccess) onSuccess(user, token, 'expired');
    } else {
      if (onFailure) onFailure();
    }
  };

  authListeners.add(listener);

  // Initial trigger with snapshot
  const snapshot = getGoogleAuthSnapshot();
  if (snapshot.status === 'authenticated') {
    listener(snapshot.user, snapshot.token, 'authenticated');
    // Also perform silent async verification in background
    if (snapshot.token) {
      validateGoogleAccessToken(snapshot.token).catch(() => {});
    }
  } else if (snapshot.status === 'expired') {
    listener(snapshot.user, snapshot.token, 'expired');
  } else {
    listener(null, null, 'unauthenticated');
  }

  return () => {
    authListeners.delete(listener);
  };
};

/**
 * 1-Click Interactive Google Sign-In with Workspace Drive Scopes via Google Identity Services
 */
export const signInWithGoogleWorkspace = async (): Promise<{
  user: GoogleOAuthUser;
  accessToken: string;
} | null> => {
  const clientId = getActiveGoogleClientId();
  if (!clientId) {
    throw new Error('Chưa cấu hình Google OAuth Client ID. Vui lòng kiểm tra lại cấu hình.');
  }

  await loadGoogleGisScript();

  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services chưa sẵn sàng trên trình duyệt.');
  }

  return new Promise((resolve, reject) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: async (response: any) => {
          if (response.error) {
            console.error('GIS Error:', response);
            reject(new Error(`Lỗi ủy quyền Google: ${response.error_description || response.error}`));
            return;
          }

          if (!response.access_token) {
            reject(new Error('Không nhận được Access Token từ Google.'));
            return;
          }

          const accessToken = response.access_token;
          cachedAccessToken = accessToken;

          const expiresInSec = typeof response.expires_in === 'number'
            ? response.expires_in
            : parseInt(response.expires_in, 10) || 3600;
          const expiresAt = Date.now() + (expiresInSec * 1000);
          cachedExpiresAt = expiresAt;

          if (typeof window !== 'undefined') {
            sessionStorage.setItem(OAUTH_TOKEN_KEY, accessToken);
            localStorage.setItem(OAUTH_TOKEN_KEY, accessToken);
            sessionStorage.setItem(OAUTH_EXPIRES_AT_KEY, String(expiresAt));
            localStorage.setItem(OAUTH_EXPIRES_AT_KEY, String(expiresAt));
          }

          // Fetch user profile info
          let userProfile: GoogleOAuthUser = {
            uid: 'google_user_' + Date.now(),
            displayName: 'Tài khoản Google',
            email: null,
            photoURL: null,
          };

          try {
            const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (profileRes.ok) {
              const data = await profileRes.json();
              userProfile = {
                uid: data.id || userProfile.uid,
                displayName: data.name || data.email || 'Tài khoản Google',
                email: data.email || null,
                photoURL: data.picture || null,
              };
            }
          } catch (e) {
            console.warn('Could not fetch Google userinfo:', e);
          }

          cachedUser = userProfile;
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(OAUTH_USER_KEY, JSON.stringify(userProfile));
            localStorage.setItem(OAUTH_USER_KEY, JSON.stringify(userProfile));
          }

          // Notify listeners
          authListeners.forEach(fn => fn(userProfile, accessToken, 'authenticated'));

          resolve({ user: userProfile, accessToken });
        },
        error_callback: (err: any) => {
          const msg = err?.message || err?.type || '';
          if (err?.type === 'popup_closed' || msg.toLowerCase().includes('popup window closed') || msg.toLowerCase().includes('popup_closed')) {
            reject(new Error('Đã đóng cửa sổ đăng nhập Google. Nếu gặp thông báo origin_mismatch, hãy sao chép link trang web hiện tại và thêm vào mục Authorized JavaScript origins trong Google Cloud Console.'));
            return;
          }
          if (msg.toLowerCase().includes('origin_mismatch') || msg.toLowerCase().includes('origin mismatch')) {
            reject(new Error(`Lỗi origin_mismatch: Địa chỉ '${typeof window !== 'undefined' ? window.location.origin : ''}' chưa được thêm vào Authorized JavaScript origins trong Google Cloud Console.`));
            return;
          }
          console.warn('GIS Client notification:', err);
          reject(new Error(msg || 'Đã hủy hoặc gặp lỗi trong quá trình xác thực Google.'));
        },
      });

      client.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      console.error('Error initiating GIS:', err);
      reject(err);
    }
  });
};

export const getGoogleAccessToken = (): string | null => {
  if (!cachedAccessToken && typeof window !== 'undefined') {
    cachedAccessToken = sessionStorage.getItem(OAUTH_TOKEN_KEY) || localStorage.getItem(OAUTH_TOKEN_KEY);
  }
  return cachedAccessToken;
};

export const setGoogleAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      sessionStorage.setItem(OAUTH_TOKEN_KEY, token);
      localStorage.setItem(OAUTH_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(OAUTH_TOKEN_KEY);
      localStorage.removeItem(OAUTH_TOKEN_KEY);
      sessionStorage.removeItem(OAUTH_EXPIRES_AT_KEY);
      localStorage.removeItem(OAUTH_EXPIRES_AT_KEY);
    }
  }
};

export const googleSignOut = async () => {
  const token = getGoogleAccessToken();
  if (token && window.google?.accounts?.oauth2?.revoke) {
    try {
      window.google.accounts.oauth2.revoke(token, () => {});
    } catch (e) {}
  }
  cachedAccessToken = null;
  cachedUser = null;
  cachedExpiresAt = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(OAUTH_TOKEN_KEY);
    localStorage.removeItem(OAUTH_TOKEN_KEY);
    sessionStorage.removeItem(OAUTH_USER_KEY);
    localStorage.removeItem(OAUTH_USER_KEY);
    sessionStorage.removeItem(OAUTH_EXPIRES_AT_KEY);
    localStorage.removeItem(OAUTH_EXPIRES_AT_KEY);
  }
  authListeners.forEach(fn => fn(null, null, 'unauthenticated'));
};


