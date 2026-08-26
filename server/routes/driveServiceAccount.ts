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

export default router;
