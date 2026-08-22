import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { DriveFile } from '../types/index.ts';

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

export const DEFAULT_APP_FOLDER_NAME = 'AI Assistant Documents';
const STORAGE_FOLDER_KEY = 'ai_app_drive_folder_id';
const STORAGE_FOLDER_NAME_KEY = 'ai_app_drive_folder_name';
const STORAGE_TOKEN_KEY = 'ai_app_google_drive_access_token';
const STORAGE_USER_KEY = 'ai_app_google_user_info';
const STORAGE_CLIENT_ID_KEY = 'ai_app_custom_google_client_id';
const STORAGE_TOKEN_TIMESTAMP_KEY = 'ai_app_google_token_timestamp';

export const DEFAULT_OAUTH_CLIENT_ID = (firebaseConfig as any).oAuthClientId || '378918995371-n7a1ekm2uarv95ts7e25i0f3e3tgunb7.apps.googleusercontent.com';

export function getCustomGoogleClientId(): string {
  const envClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
  const stored = localStorage.getItem(STORAGE_CLIENT_ID_KEY) || '';

  // Clear any outdated mismatched client ID
  if (stored.includes('797950767923')) {
    localStorage.removeItem(STORAGE_CLIENT_ID_KEY);
  }

  if (stored.trim()) {
    return stored.trim();
  }

  if (envClientId.trim()) {
    return envClientId.trim();
  }

  return DEFAULT_OAUTH_CLIENT_ID;
}

export function setCustomGoogleClientId(clientId: string): void {
  if (clientId.trim()) {
    localStorage.setItem(STORAGE_CLIENT_ID_KEY, clientId.trim());
  } else {
    localStorage.removeItem(STORAGE_CLIENT_ID_KEY);
  }
}

function getFirebaseApp() {
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
}

const auth = getAuth(getFirebaseApp());

const provider = new GoogleAuthProvider();
SCOPES.forEach(scope => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account'
});

let isSigningIn = false;
let cachedAccessToken: string | null = localStorage.getItem(STORAGE_TOKEN_KEY);
let cachedUser: any | null = (() => {
  try {
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

// Auto-refresh timer reference
let autoRefreshTimer: any = null;

function saveTokenWithTimestamp(token: string) {
  cachedAccessToken = token;
  localStorage.setItem(STORAGE_TOKEN_KEY, token);
  localStorage.setItem(STORAGE_TOKEN_TIMESTAMP_KEY, Date.now().toString());
  startAutoRefreshScheduler();
}

export function isTokenNearingExpiry(): boolean {
  const ts = localStorage.getItem(STORAGE_TOKEN_TIMESTAMP_KEY);
  if (!ts) return false;
  const ageMs = Date.now() - parseInt(ts, 10);
  // Near expiry if older than 50 minutes (3000 seconds)
  return ageMs > 50 * 60 * 1000;
}

/**
 * Start background timer to auto-refresh token every 45 minutes
 */
export function startAutoRefreshScheduler() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
  }
  // Check every 10 minutes, refresh if older than 45 minutes
  autoRefreshTimer = setInterval(async () => {
    if (getAccessToken() && isTokenNearingExpiry()) {
      console.log('🔄 [Google OAuth] Token is nearing 50-minute threshold. Attempting background auto-refresh...');
      try {
        await refreshAccessTokenSilently();
        console.log('✅ [Google OAuth] Token successfully auto-refreshed in background!');
      } catch (err) {
        console.warn('⚠️ [Google OAuth] Background silent refresh failed, will prompt when active:', err);
      }
    }
  }, 10 * 60 * 1000);
}

export const initGoogleAuth = (
  onAuthChange?: (user: User | null, token: string | null) => void
) => {
  // If we have cached token and user in localStorage, notify immediately
  if (cachedUser && cachedAccessToken && onAuthChange) {
    onAuthChange(cachedUser as User, cachedAccessToken);
  }

  // Start background auto-refresh if logged in
  if (cachedAccessToken) {
    startAutoRefreshScheduler();
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      cachedUser = user;
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      }));
      if (onAuthChange) onAuthChange(user, cachedAccessToken);
    } else if (!localStorage.getItem(STORAGE_TOKEN_KEY)) {
      cachedAccessToken = null;
      cachedUser = null;
      if (onAuthChange) onAuthChange(null, null);
    }
  });
};

/**
 * Silent Token Refresh using Google Identity Services (GIS)
 * Seamlessly renews Google Drive Access Token without popup interaction.
 */
export async function refreshAccessTokenSilently(): Promise<string> {
  const customId = getCustomGoogleClientId();
  const effectiveClientId = customId || DEFAULT_OAUTH_CLIENT_ID;

  return new Promise((resolve, reject) => {
    const initClient = () => {
      try {
        const client = (window as any).google?.accounts?.oauth2?.initTokenClient({
          client_id: effectiveClientId,
          scope: SCOPES.join(' '),
          prompt: '', // Silent renew
          callback: async (response: any) => {
            if (response.error) {
              reject(new Error(response.error_description || response.error));
              return;
            }
            if (response.access_token) {
              saveTokenWithTimestamp(response.access_token);
              resolve(response.access_token);
            } else {
              reject(new Error('Silent refresh did not return access token'));
            }
          }
        });

        if (!client) {
          throw new Error('GIS client not available');
        }

        client.requestAccessToken({ prompt: '' });
      } catch (err) {
        reject(err);
      }
    };

    if ((window as any).google?.accounts?.oauth2) {
      initClient();
    } else {
      const script = document.getElementById('google-gis-script') || document.createElement('script');
      script.id = 'google-gis-script';
      (script as HTMLScriptElement).src = 'https://accounts.google.com/gsi/client';
      script.onload = () => initClient();
      script.onerror = () => reject(new Error('Could not load Google GIS'));
      if (!document.getElementById('google-gis-script')) {
        document.body.appendChild(script);
      }
    }
  });
}

/**
 * Direct Google OAuth flow using Google Identity Services (GIS)
 * Works as a robust fallback without being blocked by Firebase Auth unauthorized domain.
 */
export async function signInWithGoogleGIS(clientId?: string): Promise<{ user: any; accessToken: string }> {
  const customId = getCustomGoogleClientId();
  const effectiveClientId = clientId || customId || DEFAULT_OAUTH_CLIENT_ID;

  return new Promise((resolve, reject) => {
    const initClient = () => {
      try {
        const client = (window as any).google?.accounts?.oauth2?.initTokenClient({
          client_id: effectiveClientId,
          scope: SCOPES.join(' '),
          callback: async (response: any) => {
            if (response.error) {
              const errMsg = response.error_description || response.error;
              if (errMsg.includes('origin_mismatch') || response.error === 'origin_mismatch') {
                reject(new Error(`Lỗi 400: origin_mismatch - Tên miền ${window.location.origin} chưa được thêm vào Authorized JavaScript origins trên Google Cloud Console.`));
              } else {
                reject(new Error(errMsg));
              }
              return;
            }
            if (response.access_token) {
              saveTokenWithTimestamp(response.access_token);

              let fakeUser: any = {
                uid: 'google-oauth-user',
                email: 'Google Drive User',
                displayName: 'Google Drive Account',
                photoURL: ''
              };

              try {
                const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${response.access_token}` }
                });
                if (userRes.ok) {
                  const userData = await userRes.json();
                  fakeUser = {
                    uid: userData.sub || 'google-user',
                    email: userData.email,
                    displayName: userData.name || userData.email,
                    photoURL: userData.picture || ''
                  };
                }
              } catch (e) {
                console.warn('Could not fetch userinfo:', e);
              }

              cachedUser = fakeUser;
              localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(fakeUser));
              resolve({ user: fakeUser, accessToken: response.access_token });
            } else {
              reject(new Error('Không nhận được Access Token từ Google.'));
            }
          }
        });

        if (!client) {
          throw new Error('Google Identity Services client initialization failed');
        }

        client.requestAccessToken({ prompt: 'consent' });
      } catch (err: any) {
        reject(err);
      }
    };

    if ((window as any).google?.accounts?.oauth2) {
      initClient();
    } else {
      const existingScript = document.getElementById('google-gis-script');
      if (existingScript) {
        existingScript.addEventListener('load', () => initClient());
      } else {
        const script = document.createElement('script');
        script.id = 'google-gis-script';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => initClient();
        script.onerror = () => reject(new Error('Không thể tải Google Identity Services SDK'));
        document.body.appendChild(script);
      }
    }
  });
}

export const signInWithGoogle = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Không lấy được Access Token từ Google Auth. Hãy cấp quyền truy cập Drive.');
    }

    saveTokenWithTimestamp(credential.accessToken);
    cachedUser = result.user;
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify({
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL
    }));

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Firebase Google Sign In Error:', error);

    // If unauthorized-domain, try fallback to Google Identity Services automatically
    if (error?.code === 'auth/unauthorized-domain' || error?.message?.includes('unauthorized-domain')) {
      console.log('Attempting GIS token client fallback due to auth/unauthorized-domain...');
      try {
        return await signInWithGoogleGIS();
      } catch (gisErr: any) {
        console.warn('GIS fallback also had error:', gisErr);
        // Throw the original descriptive error
        throw error;
      }
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const setCustomAccessToken = async (token: string): Promise<{ user: any; accessToken: string }> => {
  const cleanToken = token.trim();
  if (!cleanToken) {
    throw new Error('Token không được để trống.');
  }

  // Validate token
  const isValid = await validateGoogleToken(cleanToken);
  if (!isValid) {
    throw new Error('Access Token không hợp lệ hoặc đã hết hạn. Hãy kiểm tra lại.');
  }

  saveTokenWithTimestamp(cleanToken);

  let fakeUser: any = {
    uid: 'custom-token-user',
    email: 'Token User',
    displayName: 'Google Drive Account',
    photoURL: ''
  };

  try {
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${cleanToken}` }
    });
    if (userRes.ok) {
      const userData = await userRes.json();
      fakeUser = {
        uid: userData.sub || 'custom-user',
        email: userData.email,
        displayName: userData.name || userData.email,
        photoURL: userData.picture || ''
      };
    }
  } catch (e) {
    console.warn('Could not fetch user profile with custom token:', e);
  }

  cachedUser = fakeUser;
  localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(fakeUser));
  return { user: fakeUser, accessToken: cleanToken };
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken || localStorage.getItem(STORAGE_TOKEN_KEY);
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (token) {
    localStorage.setItem(STORAGE_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
  }
};

export const getGoogleUser = (): any | null => {
  return cachedUser;
};

export const logOutGoogle = async () => {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Firebase signout warning:', e);
  }
  cachedAccessToken = null;
  cachedUser = null;
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_USER_KEY);
  localStorage.removeItem(STORAGE_FOLDER_KEY);
};

/**
 * Validates whether the active Access Token is still alive or expired
 */
export async function validateGoogleToken(token: string): Promise<boolean> {
  try {
    const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface DriveFolderInfo {
  id: string;
  name: string;
  webViewLink: string;
}

/**
 * Get or automatically create the dedicated single folder in user's Google Drive
 */
export async function getOrCreateAppFolder(
  accessToken: string,
  customFolderName?: string
): Promise<DriveFolderInfo> {
  const folderName = customFolderName || localStorage.getItem(STORAGE_FOLDER_NAME_KEY) || DEFAULT_APP_FOLDER_NAME;
  const cachedFolderId = localStorage.getItem(STORAGE_FOLDER_KEY);

  // 1. Check if cached folder exists and is valid
  if (cachedFolderId) {
    try {
      const checkRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${cachedFolderId}?fields=id,name,mimeType,trashed,webViewLink`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (checkRes.ok) {
        const folder = await checkRes.json();
        if (!folder.trashed && folder.mimeType === 'application/vnd.google-apps.folder') {
          return {
            id: folder.id,
            name: folder.name,
            webViewLink: folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`,
          };
        }
      }
    } catch (e) {
      console.warn('Cached folder check failed, querying by name:', e);
    }
  }

  // 2. Search for existing folder by name
  const query = encodeURIComponent(`mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`);
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)&pageSize=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!searchRes.ok) {
    if (searchRes.status === 401) {
      throw new Error('TOKEN_EXPIRED: Phiên đăng nhập Google đã hết hạn. Vui lòng đăng nhập lại.');
    }
    const err = await searchRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Không thể tìm kiếm thư mục trên Google Drive');
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    const existingFolder = searchData.files[0];
    localStorage.setItem(STORAGE_FOLDER_KEY, existingFolder.id);
    localStorage.setItem(STORAGE_FOLDER_NAME_KEY, existingFolder.name);
    return {
      id: existingFolder.id,
      name: existingFolder.name,
      webViewLink: existingFolder.webViewLink || `https://drive.google.com/drive/folders/${existingFolder.id}`,
    };
  }

  // 3. Create dedicated folder if not found
  const createRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    }
  );

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Không thể tạo thư mục riêng trên Google Drive');
  }

  const newFolder = await createRes.json();
  localStorage.setItem(STORAGE_FOLDER_KEY, newFolder.id);
  localStorage.setItem(STORAGE_FOLDER_NAME_KEY, newFolder.name);

  return {
    id: newFolder.id,
    name: newFolder.name,
    webViewLink: newFolder.webViewLink || `https://drive.google.com/drive/folders/${newFolder.id}`,
  };
}

/**
 * Upload a real file STRICTLY into the dedicated Google Drive single folder
 */
export async function uploadFileToGoogleDrive(
  file: File | Blob,
  fileName: string,
  mimeType: string,
  accessToken: string,
  targetFolderId?: string
): Promise<{ id: string; name: string; mimeType: string; size: number; webViewLink: string; folderId: string }> {
  // Ensure we have the target folder ID
  let folderId = targetFolderId;
  if (!folderId) {
    const folderInfo = await getOrCreateAppFolder(accessToken);
    folderId = folderInfo.id;
  }

  const metadata = {
    name: fileName,
    mimeType: mimeType || 'application/octet-stream',
    parents: [folderId], // STRICTLY store inside this single folder
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file, fileName);

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink,parents',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('TOKEN_EXPIRED: Phiên đăng nhập Google đã hết hạn. Vui lòng đăng nhập lại.');
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Google Drive upload failed (Mã lỗi ${response.status})`);
  }

  const result = await response.json();
  return {
    id: result.id,
    name: result.name || fileName,
    mimeType: result.mimeType || mimeType,
    size: parseInt(result.size, 10) || (file instanceof File ? file.size : 1024),
    webViewLink: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`,
    folderId: folderId,
  };
}

/**
 * 1-Click Sync a Local/Server file into the dedicated single Google Drive folder
 */
export async function syncLocalFileToGoogleDrive(
  localFile: DriveFile,
  accessToken: string,
  targetFolderId?: string
): Promise<DriveFile> {
  // 1. Fetch file content from backend
  let fileBlob: Blob;
  try {
    const downloadRes = await fetch(localFile.downloadUrl || `/api/files/download/${localFile.id}`);
    if (downloadRes.ok) {
      fileBlob = await downloadRes.blob();
    } else if (localFile.textContent) {
      fileBlob = new Blob([localFile.textContent], { type: localFile.mimeType || 'text/plain' });
    } else {
      fileBlob = new Blob([`Tài liệu: ${localFile.name}`], { type: 'text/plain' });
    }
  } catch {
    fileBlob = new Blob([localFile.textContent || `Tài liệu: ${localFile.name}`], { type: 'text/plain' });
  }

  // 2. Upload strictly into target folder
  const uploaded = await uploadFileToGoogleDrive(
    fileBlob,
    localFile.name,
    localFile.mimeType,
    accessToken,
    targetFolderId
  );

  // 3. Update backend database with real Google Drive URL and file ID
  const syncRes = await fetch(`/api/files/sync-drive/${localFile.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      driveFileId: uploaded.id,
      webViewLink: uploaded.webViewLink,
    }),
  });

  if (syncRes.ok) {
    const data = await syncRes.json();
    return data.file;
  }

  return {
    ...localFile,
    isSyncedToDrive: true,
    syncStatus: 'synced',
    driveFileId: uploaded.id,
    webViewLink: uploaded.webViewLink,
  };
}

/**
 * Fetch ONLY the files that reside STRICTLY inside the dedicated single folder
 */
export async function fetchGoogleDriveFiles(
  accessToken: string,
  targetFolderId?: string
): Promise<{ files: DriveFile[]; folder: DriveFolderInfo }> {
  // 1. Ensure dedicated folder exists
  let folderInfo: DriveFolderInfo;
  if (targetFolderId) {
    folderInfo = {
      id: targetFolderId,
      name: localStorage.getItem(STORAGE_FOLDER_NAME_KEY) || DEFAULT_APP_FOLDER_NAME,
      webViewLink: `https://drive.google.com/drive/folders/${targetFolderId}`,
    };
  } else {
    folderInfo = await getOrCreateAppFolder(accessToken);
  }

  // 2. Fetch files WHERE '${folderInfo.id}' is in parents
  const query = encodeURIComponent(`'${folderInfo.id}' in parents and trashed = false`);
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,size,webViewLink,webContentLink,createdTime,modifiedTime,iconLink,thumbnailLink)&pageSize=100&orderBy=modifiedTime desc`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('TOKEN_EXPIRED: Phiên đăng nhập Google đã hết hạn. Vui lòng đăng nhập lại.');
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Không thể tải danh sách tệp từ thư mục Google Drive');
  }

  const data = await response.json();
  const rawFiles: any[] = data.files || [];

  const parsedFiles: DriveFile[] = rawFiles.map((f: any) => {
    const ext = f.name?.split('.').pop()?.toLowerCase() || '';
    let category: DriveFile['category'] = 'document';
    if (['xlsx', 'xls', 'csv'].includes(ext) || f.mimeType?.includes('spreadsheet') || f.mimeType?.includes('sheet')) {
      category = 'spreadsheet';
    } else if (ext === 'pdf' || f.mimeType?.includes('pdf')) {
      category = 'pdf';
    } else if (['pptx', 'ppt', 'key'].includes(ext) || f.mimeType?.includes('presentation')) {
      category = 'presentation';
    } else if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext) || f.mimeType?.startsWith('image/')) {
      category = 'image';
    }

    return {
      id: f.id,
      name: f.name,
      mimeType: f.mimeType || 'application/octet-stream',
      size: f.size ? parseInt(f.size, 10) : 1024 * 100,
      webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
      category: category,
      isSyncedToDrive: true,
      syncStatus: 'synced',
      driveFileId: f.id,
      downloadUrl: `/api/files/download/${f.id}`,
      previewUrl: `/api/files/preview/${f.id}`,
      uploadedAt: f.createdTime || new Date().toISOString(),
    };
  });

  return { files: parsedFiles, folder: folderInfo };
}

/**
 * Delete a file on Google Drive (User Confirmation required by caller)
 */
export async function deleteFileFromGoogleDrive(fileId: string, accessToken: string): Promise<boolean> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.ok;
}
