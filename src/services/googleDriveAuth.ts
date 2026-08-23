import { DriveFile } from '../types/index.ts';

export const DEFAULT_APP_FOLDER_NAME = 'AI Assistant Documents';
const STORAGE_FOLDER_KEY = 'ai_app_drive_folder_id';
const STORAGE_FOLDER_NAME_KEY = 'ai_app_drive_folder_name';

// Clear out legacy OAuth keys so nothing triggers popup
if (typeof window !== 'undefined') {
  localStorage.removeItem('ai_app_google_drive_access_token');
  localStorage.removeItem('ai_app_google_user_info');
  localStorage.removeItem('ai_app_google_token_timestamp');
  localStorage.removeItem('ai_app_custom_google_client_id');
}

export const DEFAULT_OAUTH_CLIENT_ID = '';

export function getCustomGoogleClientId(): string {
  return '';
}

export function setCustomGoogleClientId(_clientId: string): void {}

export interface DriveFolderInfo {
  id: string;
  name: string;
  webViewLink?: string;
}

export function getAccessToken(): string | null {
  return null;
}

export function getGoogleUser(): any | null {
  return null;
}

export function setCustomAccessToken(_token: string): void {}

export function isTokenNearingExpiry(): boolean {
  return false;
}

export const initGoogleAuth = (
  onAuthChange?: (user: any | null, token: string | null) => void
) => {
  if (onAuthChange) onAuthChange(null, null);
  return () => {};
};

export async function refreshAccessTokenSilently(): Promise<string> {
  throw new Error('OAuth đã được chuyển hoàn toàn sang Service Account');
}

export async function signInWithGoogleGIS(_clientId?: string): Promise<{ user: any; accessToken: string }> {
  throw new Error('OAuth đã được chuyển hoàn toàn sang Service Account');
}

export async function signInWithGoogle(): Promise<{ user: any; accessToken: string }> {
  throw new Error('OAuth đã được chuyển hoàn toàn sang Service Account');
}

export async function logOutGoogle(): Promise<void> {}

export async function validateGoogleToken(_token: string): Promise<boolean> {
  return false;
}

export async function getOrCreateAppFolder(
  _accessToken?: string,
  folderName: string = DEFAULT_APP_FOLDER_NAME
): Promise<DriveFolderInfo> {
  const cachedFolderId = localStorage.getItem(STORAGE_FOLDER_KEY);
  const cachedFolderName = localStorage.getItem(STORAGE_FOLDER_NAME_KEY) || folderName;

  if (cachedFolderId) {
    return {
      id: cachedFolderId,
      name: cachedFolderName,
      webViewLink: `https://drive.google.com/drive/folders/${cachedFolderId}`
    };
  }

  return {
    id: 'service-account-folder',
    name: folderName,
    webViewLink: undefined
  };
}

export async function uploadFileToGoogleDrive(
  _file: File,
  _accessToken: string,
  _folderId?: string
): Promise<DriveFile> {
  throw new Error('Sử dụng tải tệp trực tiếp qua Service Account');
}

export async function fetchGoogleDriveFiles(
  _accessToken: string,
  _folderName: string = DEFAULT_APP_FOLDER_NAME
): Promise<{ files: DriveFile[]; folder: DriveFolderInfo }> {
  return { files: [], folder: { id: '', name: DEFAULT_APP_FOLDER_NAME } };
}

export async function deleteFileFromGoogleDrive(_fileId: string, _accessToken: string): Promise<boolean> {
  return true;
}

export async function syncLocalFileToGoogleDrive(
  _file: DriveFile,
  _accessToken: string,
  _folderId?: string
): Promise<DriveFile> {
  return _file;
}
