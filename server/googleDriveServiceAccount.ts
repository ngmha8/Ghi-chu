import crypto from 'crypto';
import { DriveServiceAccountConfig, DriveFile } from '../src/types/index.ts';

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedAuthToken: CachedToken | null = null;

/**
 * Base64 URL encode utility
 */
function base64UrlEncode(data: string | Buffer): string {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Format private key to ensure proper PEM structure
 */
export function formatPrivateKey(key: string): string {
  if (!key) return '';
  let cleaned = key.trim();
  // Handle escaped \n strings
  if (cleaned.includes('\\n')) {
    cleaned = cleaned.replace(/\\n/g, '\n');
  }
  return cleaned;
}

/**
 * Parses and extracts Service Account credentials from JSON string
 */
export function parseServiceAccountJson(jsonString: string): {
  clientEmail: string;
  privateKey: string;
  projectId?: string;
} | null {
  try {
    const data = JSON.parse(jsonString);
    if (data.client_email && data.private_key) {
      return {
        clientEmail: data.client_email,
        privateKey: formatPrivateKey(data.private_key),
        projectId: data.project_id,
      };
    }
  } catch (e) {
    // Not valid JSON
  }
  return null;
}

/**
 * Generate OAuth 2.0 Access Token using Google Service Account RS256 JWT
 */
export async function getServiceAccountAccessToken(
  clientEmail: string,
  privateKey: string,
  forceRefresh = false
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if valid for at least 5 more minutes
  if (!forceRefresh && cachedAuthToken && cachedAuthToken.expiresAt > now + 300) {
    return cachedAuthToken.token;
  }

  const formattedKey = formatPrivateKey(privateKey);
  if (!clientEmail || !formattedKey) {
    throw new Error('Thiếu Client Email hoặc Private Key của Service Account');
  }

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  let signature: Buffer;
  try {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signatureInput);
    signature = signer.sign(formattedKey);
  } catch (err: any) {
    throw new Error(`Lỗi Private Key không hợp lệ: ${err?.message || 'RSA sign failed'}`);
  }

  const encodedSignature = base64UrlEncode(signature);
  const jwt = `${signatureInput}.${encodedSignature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });

  const data = await tokenRes.json();
  if (!tokenRes.ok || !data.access_token) {
    const msg = data.error_description || data.error || 'Xác thực Google Service Account thất bại';
    throw new Error(msg);
  }

  cachedAuthToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in || 3600),
  };

  return data.access_token;
}

/**
 * Test connection to Service Account and verify access to the target Folder ID
 */
export async function testServiceAccountFolderAccess(
  config: DriveServiceAccountConfig
): Promise<{
  success: boolean;
  folderName: string;
  canEdit: boolean;
  owners: string[];
  message: string;
}> {
  const token = await getServiceAccountAccessToken(config.clientEmail, config.privateKey, true);

  if (!config.folderId) {
    throw new Error('Vui lòng cung cấp Google Drive Folder ID');
  }

  const cleanFolderId = config.folderId.trim();

  // Get Folder details from Drive API
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${cleanFolderId}?fields=id,name,mimeType,capabilities,owners,shared,permissions&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const folderData = await res.json();

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        `Không tìm thấy Thư mục (Folder ID: ${cleanFolderId}). Vui lòng kiểm tra lại ID và chắc chắn rằng bạn đã CHIA SẺ (Share) thư mục này cho email: ${config.clientEmail} với quyền Người chỉnh sửa (Editor).`
      );
    }
    if (res.status === 403) {
      throw new Error(
        `Bị từ chối truy cập (403 Forbidden). Bạn cần mở Google Drive ➔ Chuột phải vào Thư mục ➔ Chọn Chia sẻ (Share) ➔ Thêm email: ${config.clientEmail} vào với quyền Chỉnh sửa (Editor).`
      );
    }
    throw new Error(folderData.error?.message || 'Lỗi kiểm tra quyền truy cập thư mục Google Drive');
  }

  if (folderData.mimeType !== 'application/vnd.google-apps.folder') {
    throw new Error(`ID được cung cấp (${folderData.name}) là một tệp tin, không phải là thư mục Google Drive.`);
  }

  const canEdit = !!(folderData.capabilities?.canAddChildren || folderData.capabilities?.canEdit);
  const owners = folderData.owners?.map((o: any) => o.displayName || o.emailAddress) || [];

  return {
    success: true,
    folderName: folderData.name || 'Google Drive Shared Folder',
    canEdit,
    owners,
    message: canEdit
      ? `Đã liên kết thành công với thư mục "${folderData.name}". Service Account có toàn quyền đọc và tải tệp lên.`
      : `Đã kết nối được thư mục "${folderData.name}", nhưng Service Account chỉ có quyền Xem (Viewer). Hãy cấp quyền Người chỉnh sửa (Editor) trên Google Drive để tải file lên.`,
  };
}

/**
 * List files inside the linked Google Drive folder
 */
export async function listFilesInDriveFolder(
  config: DriveServiceAccountConfig
): Promise<DriveFile[]> {
  const token = await getServiceAccountAccessToken(config.clientEmail, config.privateKey);
  const cleanFolderId = config.folderId.trim();

  const q = encodeURIComponent(`'${cleanFolderId}' in parents and trashed = false`);
  const fields = encodeURIComponent(
    'files(id,name,mimeType,size,webViewLink,webContentLink,createdTime,modifiedTime,iconLink,thumbnailLink)'
  );

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Lỗi tải danh sách tệp từ Google Drive');
  }

  const driveFiles: DriveFile[] = (data.files || []).map((f: any) => {
    let category: DriveFile['category'] = 'document';
    const mime = (f.mimeType || '').toLowerCase();

    if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) {
      category = 'spreadsheet';
    } else if (mime.includes('pdf')) {
      category = 'pdf';
    } else if (mime.includes('presentation') || mime.includes('powerpoint')) {
      category = 'presentation';
    } else if (mime.includes('image')) {
      category = 'image';
    } else if (mime.includes('zip') || mime.includes('tar') || mime.includes('rar')) {
      category = 'archive';
    }

    return {
      id: `drive-${f.id}`,
      name: f.name || 'Untitled Document',
      mimeType: f.mimeType || 'application/octet-stream',
      size: f.size ? parseInt(f.size, 10) : 0,
      webViewLink: f.webViewLink,
      category,
      isSyncedToDrive: true,
      driveFileId: f.id,
      uploadedAt: f.createdTime || new Date().toISOString(),
      syncStatus: 'synced',
      downloadUrl: `/api/drive-service-account/download/${f.id}`,
      previewUrl: f.webViewLink,
    };
  });

  return driveFiles;
}

/**
 * Upload a file directly into the shared Google Drive folder using Service Account
 */
export async function uploadFileToDriveFolder(
  config: DriveServiceAccountConfig,
  fileName: string,
  mimeType: string,
  fileBuffer: Buffer
): Promise<{
  id: string;
  name: string;
  webViewLink?: string;
  size: number;
}> {
  const token = await getServiceAccountAccessToken(config.clientEmail, config.privateKey);
  const cleanFolderId = config.folderId.trim();

  const metadata = {
    name: fileName,
    parents: [cleanFolderId],
    mimeType: mimeType,
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody = Buffer.concat([
    Buffer.from(
      delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${mimeType}\r\n` +
        'Content-Transfer-Encoding: base64\r\n\r\n'
    ),
    Buffer.from(fileBuffer.toString('base64')),
    Buffer.from(closeDelimiter),
  ]);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': multipartRequestBody.length.toString(),
      },
      body: multipartRequestBody,
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Lỗi tải tệp lên Google Drive qua Service Account');
  }

  return {
    id: data.id,
    name: data.name,
    webViewLink: data.webViewLink,
    size: data.size ? parseInt(data.size, 10) : fileBuffer.length,
  };
}

/**
 * Delete a file in Google Drive
 */
export async function deleteFileFromDrive(
  config: DriveServiceAccountConfig,
  driveFileId: string
): Promise<boolean> {
  const token = await getServiceAccountAccessToken(config.clientEmail, config.privateKey);

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${driveFileId}?supportsAllDrives=true`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok && res.status !== 404) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || 'Lỗi xóa tệp trên Google Drive');
  }

  return true;
}

/**
 * Download file stream/buffer from Google Drive
 */
export async function downloadFileFromDrive(
  config: DriveServiceAccountConfig,
  driveFileId: string
): Promise<{ buffer: Buffer; mimeType?: string; fileName?: string }> {
  const token = await getServiceAccountAccessToken(config.clientEmail, config.privateKey);

  // First fetch metadata for name & mimeType
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=id,name,mimeType&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const metaData = await metaRes.json().catch(() => ({}));
  const fileName = metaData.name || 'document';
  const mimeType = metaData.mimeType || 'application/octet-stream';

  // Then fetch content
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error('Không thể tải tệp từ Google Drive');
  }

  const arrayBuffer = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType,
    fileName,
  };
}
