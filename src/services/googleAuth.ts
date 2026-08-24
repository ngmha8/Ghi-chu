import firebaseConfig from '../../firebase-applet-config.json';

export interface GoogleOAuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

// In-memory & storage token cache
const OAUTH_TOKEN_KEY = 'google_oauth_access_token';
const OAUTH_USER_KEY = 'google_oauth_user_profile';
const CUSTOM_CLIENT_ID_KEY = 'app_custom_google_client_id';

let cachedAccessToken: string | null = typeof window !== 'undefined' ? (sessionStorage.getItem(OAUTH_TOKEN_KEY) || localStorage.getItem(OAUTH_TOKEN_KEY)) : null;
let cachedUser: GoogleOAuthUser | null = null;

if (typeof window !== 'undefined') {
  try {
    const rawUser = sessionStorage.getItem(OAUTH_USER_KEY) || localStorage.getItem(OAUTH_USER_KEY);
    if (rawUser) cachedUser = JSON.parse(rawUser);
  } catch (e) {}
}

const authListeners = new Set<(user: GoogleOAuthUser | null, token: string | null) => void>();

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
 * Listen to Google Auth state
 */
export const initGoogleAuth = (
  onSuccess?: (user: any, token: string | null) => void,
  onFailure?: () => void
) => {
  const listener = (user: GoogleOAuthUser | null, token: string | null) => {
    if (user && token) {
      if (onSuccess) onSuccess(user, token);
    } else {
      if (onFailure) onFailure();
    }
  };

  authListeners.add(listener);

  // Initial trigger if already logged in
  if (cachedUser && cachedAccessToken) {
    listener(cachedUser, cachedAccessToken);
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
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
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

          if (typeof window !== 'undefined') {
            sessionStorage.setItem(OAUTH_TOKEN_KEY, accessToken);
            localStorage.setItem(OAUTH_TOKEN_KEY, accessToken);
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
          authListeners.forEach(fn => fn(userProfile, accessToken));

          resolve({ user: userProfile, accessToken });
        },
        error_callback: (err: any) => {
          // If the user closed the popup window manually, treat as cancellation rather than hard error
          const msg = err?.message || '';
          if (err?.type === 'popup_closed' || msg.toLowerCase().includes('popup window closed') || msg.toLowerCase().includes('popup_closed')) {
            reject(new Error('Đã hủy đăng nhập Google (cửa sổ xác thực đã được đóng).'));
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
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(OAUTH_TOKEN_KEY);
    localStorage.removeItem(OAUTH_TOKEN_KEY);
    sessionStorage.removeItem(OAUTH_USER_KEY);
    localStorage.removeItem(OAUTH_USER_KEY);
  }
  authListeners.forEach(fn => fn(null, null));
};

