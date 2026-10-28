import { getGoogleAccessToken, signInWithGoogleWorkspace } from './googleAuth.js';

/**
 * Uploads a local vault file to user's Google Drive via the server proxy endpoint
 * using their personal Google Account OAuth Token.
 */
export async function uploadLocalFileToUserGoogleDrive(
  fileId: string,
  targetFolderId?: string,
  base64Data?: string
): Promise<{ driveFileId: string; webViewLink: string; file: any }> {
  let token = getGoogleAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`/api/files/upload-to-user-drive/${fileId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ folderId: targetFolderId, base64Data }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      errData?.error || `Lỗi tải lên Google Drive (HTTP ${res.status}). Vui lòng kiểm tra lại quyền truy cập.`
    );
  }

  const data = await res.json();

  return {
    driveFileId: data.file.driveFileId,
    webViewLink: data.file.webViewLink,
    file: data.file,
  };
}
