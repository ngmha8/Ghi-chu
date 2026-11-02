import { getGoogleAccessToken, setGoogleAccessToken } from './googleAuth.js';

/**
 * Uploads a local vault file to user's Google Drive via the server proxy endpoint
 * using their personal Google Account OAuth Token or Service Account fallback.
 */
export async function uploadLocalFileToUserGoogleDrive(
  fileId: string,
  targetFolderId?: string,
  base64Data?: string,
  purgeLocalAfterUpload: boolean = true,
  deleteLocalRecord: boolean = false
): Promise<{
  driveFileId?: string;
  webViewLink?: string;
  file: any;
  notice?: string;
  requiresAdminLogin?: boolean;
}> {
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
    body: JSON.stringify({
      folderId: targetFolderId,
      base64Data,
      purgeLocalAfterUpload,
      deleteLocalRecord,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    if (res.status === 401 || errData?.tokenExpired) {
      setGoogleAccessToken(null);
    }
    throw new Error(
      errData?.error || `Lỗi tải lên Google Drive (HTTP ${res.status}). Vui lòng kiểm tra lại quyền truy cập.`
    );
  }

  const data = await res.json();
  if (data?.tokenExpired) {
    setGoogleAccessToken(null);
  }

  const driveFileId = data.file?.driveFileId || data.driveResult?.id;
  if (!driveFileId) {
    if (data?.tokenExpired || data?.requiresAdminLogin) {
      setGoogleAccessToken(null);
    }
    throw new Error(
      data?.error || data?.notice || 'Chưa thể tải tệp lên Google Drive. Bắt buộc đăng nhập tài khoản Google để đồng bộ thực tế.'
    );
  }

  return {
    driveFileId,
    webViewLink: data.file?.webViewLink || data.driveResult?.webViewLink,
    file: data.file,
    notice: data.notice,
    requiresAdminLogin: false,
  };
}
