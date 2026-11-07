import { Router, Request, Response } from 'express';
import {
  getDbDriveServiceAccountConfig,
  saveDbDriveServiceAccountConfig,
  getDbFiles,
  saveDbFile,
} from '../firebaseDb.ts';
import {
  testServiceAccountFolderAccess,
  listFilesInDriveFolder,
  downloadFileFromDrive,
  parseServiceAccountJson,
  getServiceAccountAccessToken,
} from '../googleDriveServiceAccount.ts';
import type { DriveServiceAccountConfig } from '../../src/types/index.ts';

const router = Router();

// GET /api/drive-service-account/config
router.get('/config', async (req: Request, res: Response) => {
  try {
    const config = await getDbDriveServiceAccountConfig();
    res.json({
      ...config,
      privateKey: config.privateKey ? '******** (Đã lưu an toàn trên Server)' : '',
      hasPrivateKey: !!config.privateKey,
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error fetching Service Account config' });
  }
});

// POST /api/drive-service-account/config
router.post('/config', async (req: Request, res: Response) => {
  try {
    let { clientEmail, privateKey, projectId, folderId, isEnabled, serviceAccountRawJson } = req.body;
    const currentConfig = await getDbDriveServiceAccountConfig();

    if (serviceAccountRawJson && serviceAccountRawJson.trim()) {
      const parsed = parseServiceAccountJson(serviceAccountRawJson);
      if (parsed) {
        clientEmail = parsed.clientEmail;
        privateKey = parsed.privateKey;
        if (parsed.projectId) projectId = parsed.projectId;
      }
    }

    if (!privateKey || privateKey.includes('********')) {
      privateKey = currentConfig.privateKey;
    }

    const updated = await saveDbDriveServiceAccountConfig({
      clientEmail: clientEmail !== undefined ? clientEmail.trim() : currentConfig.clientEmail,
      privateKey: privateKey !== undefined ? privateKey : currentConfig.privateKey,
      projectId: projectId !== undefined ? projectId : currentConfig.projectId,
      folderId: folderId !== undefined ? folderId.trim() : currentConfig.folderId,
      isEnabled: isEnabled !== undefined ? isEnabled : currentConfig.isEnabled,
    });

    res.json({
      success: true,
      config: {
        ...updated,
        privateKey: updated.privateKey ? '******** (Đã lưu an toàn)' : '',
        hasPrivateKey: !!updated.privateKey,
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Lỗi lưu cấu hình Google Drive Service Account' });
  }
});

// POST /api/drive-service-account/test
router.post('/test', async (req: Request, res: Response) => {
  try {
    let { clientEmail, privateKey, folderId, serviceAccountRawJson } = req.body;
    const currentConfig = await getDbDriveServiceAccountConfig();

    if (serviceAccountRawJson && serviceAccountRawJson.trim()) {
      const parsed = parseServiceAccountJson(serviceAccountRawJson);
      if (parsed) {
        clientEmail = parsed.clientEmail;
        privateKey = parsed.privateKey;
      }
    }

    if (!privateKey || privateKey.includes('********')) {
      privateKey = currentConfig.privateKey;
    }
    if (!clientEmail) clientEmail = currentConfig.clientEmail;
    if (!folderId) folderId = currentConfig.folderId;

    const testConfig: DriveServiceAccountConfig = {
      ...currentConfig,
      clientEmail,
      privateKey,
      folderId,
    };

    const result = await testServiceAccountFolderAccess(testConfig);

    await saveDbDriveServiceAccountConfig({
      clientEmail,
      privateKey,
      folderId,
      isConnected: true,
      folderName: result.folderName,
      lastTestedAt: new Date().toISOString(),
      driveType: result.driveType,
      isSharedDrive: result.isSharedDrive,
      canUploadDirectlyWithRobot: result.canUploadDirectlyWithRobot,
      diagnosticAdvice: result.diagnosticAdvice,
      errorMessage: undefined,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    await saveDbDriveServiceAccountConfig({
      isConnected: false,
      errorMessage: err?.message,
    });
    res.status(400).json({
      success: false,
      error: err?.message || 'Lỗi kiểm tra kết nối Service Account với Google Drive',
    });
  }
});

// POST /api/drive-service-account/sync
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const config = await getDbDriveServiceAccountConfig();
    if (!config.clientEmail || !config.privateKey || !config.folderId) {
      return res.status(400).json({ error: 'Chưa cấu hình Service Account hoặc Folder ID' });
    }

    const driveFiles = await listFilesInDriveFolder(config);
    const existingDbFiles = await getDbFiles();

    const mergedFiles = [...existingDbFiles];
    for (const df of driveFiles) {
      const existingIdx = mergedFiles.findIndex(
        f => f.driveFileId === df.driveFileId || f.name.toLowerCase() === df.name.toLowerCase()
      );
      if (existingIdx >= 0) {
        mergedFiles[existingIdx] = {
          ...mergedFiles[existingIdx],
          driveFileId: df.driveFileId,
          webViewLink: df.webViewLink,
          isSyncedToDrive: true,
          syncStatus: 'synced',
          size: df.size || mergedFiles[existingIdx].size,
        };
      } else {
        mergedFiles.unshift(df);
      }
    }

    for (const f of mergedFiles) {
      await saveDbFile(f);
    }

    await saveDbDriveServiceAccountConfig({
      lastSyncAt: new Date().toISOString(),
      isConnected: true,
    });

    res.json({
      success: true,
      syncedCount: driveFiles.length,
      files: mergedFiles,
      lastSyncAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Lỗi đồng bộ tệp từ Google Drive' });
  }
});

// GET /api/drive-service-account/download/:driveFileId
router.get('/download/:driveFileId', async (req: Request, res: Response) => {
  try {
    const config = await getDbDriveServiceAccountConfig();
    const driveFileId = req.params.driveFileId;
    const { buffer, mimeType, fileName } = await downloadFileFromDrive(config, driveFileId);

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName || 'document')}"`);
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).send('Không thể tải tệp từ Google Drive');
  }
});

// Helper: Fetch Google Drive files with pagination
async function fetchDriveFilesPaginated(token: string, query: string, maxPages = 4): Promise<any[]> {
  let allFiles: any[] = [];
  let pageToken: string | undefined = undefined;
  const fields = encodeURIComponent('nextPageToken,files(id,name,mimeType,size,modifiedTime,createdTime,webViewLink)');

  for (let page = 0; page < maxPages; page++) {
    const pageTokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${fields}&pageSize=250&supportsAllDrives=true&includeItemsFromAllDrives=true${pageTokenParam}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      break;
    }
    const data: any = await res.json().catch(() => ({}));
    if (data.files && Array.isArray(data.files)) {
      allFiles = allFiles.concat(data.files);
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return allFiles;
}

// POST /api/drive-service-account/scan-duplicates - Inspect & Detect Duplicate Files on Google Drive
router.post('/scan-duplicates', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const userToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const config = await getDbDriveServiceAccountConfig();
    const scope = req.body?.scope === 'all' ? 'all' : 'folder';
    const folderId = req.body?.folderId || config?.folderId;

    let token = userToken;
    if (!token && config?.clientEmail && config?.privateKey) {
      token = await getServiceAccountAccessToken(config.clientEmail, config.privateKey);
    }

    if (!token) {
      return res.status(401).json({ error: 'Yêu cầu đăng nhập Google Drive để quét tệp trùng lặp' });
    }

    // Determine query by scope
    let q = "trashed = false and mimeType != 'application/vnd.google-apps.folder'";
    if (scope === 'folder' && folderId && folderId.trim().length > 0) {
      q = `'${folderId.trim()}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`;
    }

    const driveFiles = await fetchDriveFilesPaginated(token, q, 4);

    // Group files by normalized filename
    const groups: Record<string, any[]> = {};
    for (const f of driveFiles) {
      const key = (f.name || '').trim().toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    }

    const duplicateGroups: Array<{
      name: string;
      keeper: any;
      duplicates: any[];
      totalCopies: number;
      reclaimableBytes: number;
    }> = [];

    let totalDuplicateFiles = 0;
    let totalSpaceReclaimable = 0;

    for (const [, fileList] of Object.entries(groups)) {
      if (fileList.length > 1) {
        // Sort: Non-stubs (size >= 1000) first, then largest size, then newest modifiedTime
        fileList.sort((a, b) => {
          const sizeA = parseInt(a.size || '0', 10);
          const sizeB = parseInt(b.size || '0', 10);
          const isAStub = sizeA < 1000;
          const isBStub = sizeB < 1000;
          if (isAStub !== isBStub) return isAStub ? 1 : -1;
          if (sizeA !== sizeB) return sizeB - sizeA;
          const timeA = new Date(a.modifiedTime || a.createdTime || 0).getTime();
          const timeB = new Date(b.modifiedTime || b.createdTime || 0).getTime();
          return timeB - timeA;
        });

        const keeper = fileList[0];
        const duplicates = fileList.slice(1).map(dup => {
          const size = parseInt(dup.size || '0', 10);
          return {
            ...dup,
            sizeNumber: size,
            isStub: size < 1000,
          };
        });

        const reclaimableBytes = duplicates.reduce((acc, d) => acc + (d.sizeNumber || 0), 0);
        totalDuplicateFiles += duplicates.length;
        totalSpaceReclaimable += reclaimableBytes;

        duplicateGroups.push({
          name: keeper.name,
          keeper: {
            ...keeper,
            sizeNumber: parseInt(keeper.size || '0', 10),
          },
          duplicates,
          totalCopies: fileList.length,
          reclaimableBytes,
        });
      }
    }

    // Sort groups with most duplicates or largest reclaimable bytes first
    duplicateGroups.sort((a, b) => b.reclaimableBytes - a.reclaimableBytes || b.totalCopies - a.totalCopies);

    res.json({
      success: true,
      scope,
      totalScanned: driveFiles.length,
      totalGroups: duplicateGroups.length,
      totalDuplicateFiles,
      totalSpaceReclaimable,
      groups: duplicateGroups,
    });
  } catch (err: any) {
    console.error('Scan duplicates error:', err);
    res.status(500).json({ error: err?.message || 'Lỗi khi quét tệp trùng trên Google Drive' });
  }
});

// POST /api/drive-service-account/clean-duplicates - Intelligent Deduplication on Google Drive
router.post('/clean-duplicates', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const userToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const config = await getDbDriveServiceAccountConfig();
    const scope = req.body?.scope === 'all' ? 'all' : 'folder';
    const folderId = req.body?.folderId || config?.folderId;
    const specificFileIds: string[] | undefined = Array.isArray(req.body?.specificFileIds) ? req.body.specificFileIds : undefined;

    let token = userToken;
    if (!token && config?.clientEmail && config?.privateKey) {
      token = await getServiceAccountAccessToken(config.clientEmail, config.privateKey);
    }

    if (!token) {
      return res.status(401).json({ error: 'Yêu cầu đăng nhập Google hoặc cấu hình Service Account' });
    }

    let cleanedCount = 0;
    const details: string[] = [];
    const keepersToUpdate: any[] = [];

    // Case 1: Delete specific file IDs chosen by user
    if (specificFileIds && specificFileIds.length > 0) {
      for (const fileId of specificFileIds) {
        try {
          const delRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          if (!delRes.ok && (delRes.status === 403 || delRes.status === 401)) {
            await fetch(
              `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`,
              {
                method: 'PATCH',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ trashed: true }),
              }
            );
          }
          cleanedCount++;
          details.push(`Đã xóa bản trùng (ID: ${fileId})`);
        } catch (delErr) {
          console.warn(`Could not delete file ${fileId}:`, delErr);
        }
      }
    } else {
      // Case 2: Auto-scan and eliminate all duplicates, keeping the single best keeper
      let q = "trashed = false and mimeType != 'application/vnd.google-apps.folder'";
      if (scope === 'folder' && folderId && folderId.trim().length > 0) {
        q = `'${folderId.trim()}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`;
      }

      const driveFiles = await fetchDriveFilesPaginated(token, q, 4);

      // Group files by normalized filename
      const groups: Record<string, any[]> = {};
      for (const f of driveFiles) {
        const key = (f.name || '').trim().toLowerCase();
        if (!groups[key]) groups[key] = [];
        groups[key].push(f);
      }

      for (const [, fileList] of Object.entries(groups)) {
        if (fileList.length > 1) {
          // Sort: Genuine files (size >= 1000B) first; then larger files; then newer modifiedTime
          fileList.sort((a, b) => {
            const sizeA = parseInt(a.size || '0', 10);
            const sizeB = parseInt(b.size || '0', 10);
            const isAStub = sizeA < 1000;
            const isBStub = sizeB < 1000;
            if (isAStub !== isBStub) {
              return isAStub ? 1 : -1; // non-stubs first
            }
            if (sizeA !== sizeB) {
              return sizeB - sizeA; // larger file first
            }
            const timeA = new Date(a.modifiedTime || a.createdTime || 0).getTime();
            const timeB = new Date(b.modifiedTime || b.createdTime || 0).getTime();
            return timeB - timeA;
          });

          const keeper = fileList[0];
          keepersToUpdate.push(keeper);
          const duplicates = fileList.slice(1);

          for (const dup of duplicates) {
            try {
              // Delete duplicate from Drive
              const delRes = await fetch(
                `https://www.googleapis.com/drive/v3/files/${dup.id}?supportsAllDrives=true`,
                {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${token}` },
                }
              );
              if (!delRes.ok && (delRes.status === 403 || delRes.status === 401)) {
                // Move to trash via PATCH if hard delete is restricted
                await fetch(
                  `https://www.googleapis.com/drive/v3/files/${dup.id}?supportsAllDrives=true`,
                  {
                    method: 'PATCH',
                    headers: {
                      Authorization: `Bearer ${token}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ trashed: true }),
                  }
                );
              }
              cleanedCount++;
              const dupSizeStr = dup.size ? `${(parseInt(dup.size, 10) / 1024).toFixed(1)} KB` : '0 KB';
              const keeperSizeStr = keeper.size ? `${(parseInt(keeper.size, 10) / 1024).toFixed(1)} KB` : '0 KB';
              details.push(`Đã xóa bản sao "${dup.name}" (${dupSizeStr}), bảo toàn bản chính (${keeperSizeStr})`);
            } catch (delErr) {
              console.warn(`Could not delete duplicate ${dup.id}:`, delErr);
            }
          }
        }
      }
    }

    // Update local database to point exclusively to genuine keepers
    const currentDbFiles = await getDbFiles();
    let dbUpdatedCount = 0;
    for (const keeper of keepersToUpdate) {
      const match = currentDbFiles.find(
        f => f.name.trim().toLowerCase() === keeper.name.trim().toLowerCase()
      );
      if (match) {
        match.driveFileId = keeper.id;
        match.webViewLink = keeper.webViewLink || `https://drive.google.com/file/d/${keeper.id}/view`;
        match.isSyncedToDrive = true;
        match.syncStatus = 'synced';
        if (keeper.size) {
          match.size = parseInt(keeper.size, 10);
        }
        await saveDbFile(match);
        dbUpdatedCount++;
      }
    }

    res.json({
      success: true,
      cleanedCount,
      details,
      dbUpdatedCount,
      message: cleanedCount > 0
        ? `Đã dọn dẹp thành công ${cleanedCount} tệp trùng lặp và bản sao trên Google Drive!`
        : 'Không phát hiện tệp trùng lặp nào trên Google Drive.',
    });
  } catch (err: any) {
    console.error('Clean duplicates error:', err);
    res.status(500).json({ error: err?.message || 'Lỗi khi dọn dẹp tệp trùng trên Google Drive' });
  }
});

export default router;
