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
  'https://www.googleapis.com/auth/drive.readonly'
];

export const DEFAULT_APP_FOLDER_NAME = 'AI Assistant Documents';
const STORAGE_FOLDER_KEY = 'ai_app_drive_folder_id';
const STORAGE_FOLDER_NAME_KEY = 'ai_app_drive_folder_name';

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
let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;

export const initGoogleAuth = (
  onAuthChange?: (user: User | null, token: string | null) => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    cachedUser = user;
    if (user) {
      if (onAuthChange) onAuthChange(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onAuthChange) onAuthChange(null, null);
    }
  });
};

export const signInWithGoogle = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Không lấy được Access Token từ Google Auth. Hãy cấp quyền truy cập Drive.');
    }

    cachedAccessToken = credential.accessToken;
    cachedUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const getGoogleUser = (): User | null => {
  return cachedUser;
};

export const logOutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  cachedUser = null;
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
