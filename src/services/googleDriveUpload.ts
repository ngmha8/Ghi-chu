import { getGoogleAccessToken, signInWithGoogleWorkspace } from './googleAuth.js';

/**
 * Uploads a local vault file to user's Google Drive via the server proxy endpoint
 * using their personal Google Account OAuth Token.
 */
export async function uploadLocalFileToUserGoogleDrive(
  fileId: string,
  targetFolderId?: string
): Promise<{ driveFileId: string; webViewLink: string; file: any }> {
  let token = getGoogleAccessToken();

  if (!token) {
    // Interactive 1-click prompt
    const authResult = await signInWithGoogleWorkspace();
    if (!authResult || !authResult.accessToken) {
      throw new Error('Vui lòng đăng nhập tài khoản Google để cấp quyền tải lên Google Drive');
    }
    token = authResult.accessToken;
  }

  const res = await fetch(`/api/files/upload-to-user-drive/${fileId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ folderId: targetFolderId }),
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
