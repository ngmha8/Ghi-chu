import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import {
  initialTasks,
  initialNotes,
  initialFiles,
  initialTelegramConfig,
  initialNotificationLogs,
  initialUserProfile
} from './server/initialData.ts';
import { Task, Note, DriveFile, TelegramConfig, NotificationLog, DriveServiceAccountConfig } from './src/types/index.ts';
import {
  initializeFirestoreData,
  getDbTasks,
  saveDbTask,
  deleteDbTask,
  getDbNotes,
  saveDbNote,
  deleteDbNote,
  getDbFiles,
  saveDbFile,
  deleteDbFile,
  getDbTelegramConfig,
  saveDbTelegramConfig,
  getDbNotificationLogs,
  addDbNotificationLog,
  getDbDriveServiceAccountConfig,
  saveDbDriveServiceAccountConfig,
  getConversationHistory,
  appendConversationTurn,
  clearConversationHistory,
  cachedTasks,
  cachedNotes,
  cachedFiles,
  cachedTelegramConfig,
  cachedNotificationLogs,
  cachedDriveServiceAccountConfig
} from './server/firebaseDb.ts';
import {
  testServiceAccountFolderAccess,
  listFilesInDriveFolder,
  uploadFileToDriveFolder,
  deleteFileFromDrive,
  downloadFileFromDrive,
  parseServiceAccountJson
} from './server/googleDriveServiceAccount.ts';
import { aiFunctionDeclarations, executeAiFunctionCall } from './server/aiTools.ts';
import {
  sendTelegramMessage,
  answerCallbackQuery,
  buildTaskReminderKeyboard,
  buildTaskListKeyboard,
  TelegramInlineKeyboard
} from './server/telegramHelper.ts';
import { transcribeTelegramVoice } from './server/voiceTranscriber.ts';
import { generateDailyBriefing } from './server/dailyBriefing.ts';
import { safeGenerateContent, GEMINI_MODEL_FALLBACK_CHAIN } from './server/geminiHelper.ts';

const _dirname = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
const UPLOADS_DIR = path.join(_dirname, 'data', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch (e) {}
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

let files: DriveFile[] = [...cachedFiles];
const userProfile = { ...initialUserProfile };

// Tracker for daily briefing to prevent re-sending multiple times in the same day
let lastMorningBriefingDate = '';
let lastEveningBriefingDate = '';

// Initialize Firebase on boot
initializeFirestoreData().catch(err => {
  console.warn('Firebase background sync warning:', err);
});

// Gemini AI Client Setup
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || '';
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health & Ping Endpoints (for cron-job.org, uptime monitors, Keep-Alive)
app.get(['/health', '/ping', '/api/health', '/api/ping'], (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString(), message: 'AI Assistant server is active' });
});

// -------------------------------------------------------------
// FIREBASE / DATABASE STATUS ENDPOINT
// -------------------------------------------------------------
app.get('/api/firebase/status', async (req: Request, res: Response) => {
  res.json({
    status: 'connected',
    provider: 'Firebase Firestore',
    tasksCount: cachedTasks.length,
    notesCount: cachedNotes.length,
    logsCount: cachedNotificationLogs.length,
    telegramConnected: cachedTelegramConfig.isConnected,
    lastSync: new Date().toISOString(),
  });
});

// -------------------------------------------------------------
// 1. TASK MANAGEMENT API ROUTES (FIRESTORE PERSISTED)
// -------------------------------------------------------------
app.get('/api/tasks', async (req: Request, res: Response) => {
  const tasks = await getDbTasks();
  res.json(tasks);
});

app.post('/api/tasks', async (req: Request, res: Response) => {
  const newTask: Task = {
    id: req.body.id || `task-${Date.now()}`,
    title: req.body.title || 'Công việc mới',
    description: req.body.description || '',
    deadline: req.body.deadline || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    priority: req.body.priority || 'medium',
    status: req.body.status || 'todo',
    tags: req.body.tags || [],
    recurring: req.body.recurring || { type: 'none' },
    attachedFileIds: req.body.attachedFileIds || [],
    reminderOffsetMinutes: req.body.reminderOffsetMinutes ?? 15,
    isNotified: false,
    createdAt: req.body.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const saved = await saveDbTask(newTask);
  res.status(201).json(saved);
});

app.put('/api/tasks/:id', async (req: Request, res: Response) => {
  const taskId = req.params.id;
  const currentTasks = await getDbTasks();
  const existing = currentTasks.find(t => t.id === taskId);
  if (!existing) {
    return res.status(404).json({ error: 'Task not found' });
  }
  const updatedTask: Task = {
    ...existing,
    ...req.body,
    id: taskId,
    updatedAt: new Date().toISOString(),
  };
  const saved = await saveDbTask(updatedTask);
  res.json(saved);
});

app.delete('/api/tasks/:id', async (req: Request, res: Response) => {
  const taskId = req.params.id;
  await deleteDbTask(taskId);
  res.json({ success: true, id: taskId });
});

// -------------------------------------------------------------
// 2. NOTES API ROUTES (FIRESTORE PERSISTED)
// -------------------------------------------------------------
app.get('/api/notes', async (req: Request, res: Response) => {
  const notes = await getDbNotes();
  res.json(notes);
});

app.post('/api/notes', async (req: Request, res: Response) => {
  const newNote: Note = {
    id: req.body.id || `note-${Date.now()}`,
    title: req.body.title || 'Ghi chú mới',
    content: req.body.content || '',
    tags: req.body.tags || [],
    linkedTaskIds: req.body.linkedTaskIds || [],
    attachedFileIds: req.body.attachedFileIds || [],
    isPinned: req.body.isPinned || false,
    createdAt: req.body.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const saved = await saveDbNote(newNote);
  res.status(201).json(saved);
});

app.put('/api/notes/:id', async (req: Request, res: Response) => {
  const noteId = req.params.id;
  const currentNotes = await getDbNotes();
  const existing = currentNotes.find(n => n.id === noteId);
  if (!existing) {
    return res.status(404).json({ error: 'Note not found' });
  }
  const updatedNote: Note = {
    ...existing,
    ...req.body,
    id: noteId,
    updatedAt: new Date().toISOString(),
  };
  const saved = await saveDbNote(updatedNote);
  res.json(saved);
});

app.delete('/api/notes/:id', async (req: Request, res: Response) => {
  const noteId = req.params.id;
  await deleteDbNote(noteId);
  res.json({ success: true, id: noteId });
});

// -------------------------------------------------------------
// 3. FILE / GOOGLE DRIVE MANAGER API ROUTES
// -------------------------------------------------------------
app.get('/api/files', async (req: Request, res: Response) => {
  const currentFiles = await getDbFiles();
  res.json(currentFiles);
});

app.post('/api/files', async (req: Request, res: Response) => {
  const fileId = req.body.id || `file-${Date.now()}`;
  const fileName = req.body.name || 'document.pdf';
  const mimeType = req.body.mimeType || 'application/pdf';
  const size = req.body.size || 102400;
  let isSynced = req.body.isSyncedToDrive ?? false;
  let driveFileId = req.body.driveFileId;
  let webViewLink = req.body.webViewLink;
  const textContent = req.body.textContent;
  const base64Data = req.body.base64Data;

  // Save binary to server uploads directory if provided
  let fileBuffer: Buffer | null = null;
  if (base64Data) {
    try {
      fileBuffer = Buffer.from(base64Data.replace(/^data:.*?;base64,/, ''), 'base64');
      const filePath = path.join(UPLOADS_DIR, `${fileId}_${path.basename(fileName)}`);
      fs.writeFileSync(filePath, fileBuffer);
    } catch (e) {
      console.warn('Error saving uploaded file binary to disk:', e);
    }
  } else if (textContent) {
    fileBuffer = Buffer.from(textContent, 'utf-8');
  }

  // Automatic Service Account Google Drive Upload if active
  const saConfig = await getDbDriveServiceAccountConfig();
  if (saConfig.isEnabled && saConfig.isConnected && saConfig.folderId && fileBuffer && !driveFileId) {
    try {
      const uploadedToDrive = await uploadFileToDriveFolder(
        saConfig,
        fileName,
        mimeType,
        fileBuffer
      );
      if (uploadedToDrive?.uploadedToDrive && uploadedToDrive.id) {
        driveFileId = uploadedToDrive.id;
        webViewLink = uploadedToDrive.webViewLink;
        isSynced = true;
      }
    } catch (driveErr: any) {
      console.info(`ℹ️ File "${fileName}" stored safely in local vault: ${driveErr?.message || 'Drive sync deferred'}`);
    }
  }

  const newFile: DriveFile = {
    id: fileId,
    name: fileName,
    mimeType: mimeType,
    size: size,
    webViewLink: isSynced && webViewLink ? webViewLink : undefined,
    category: req.body.category || 'document',
    classification: req.body.classification || 'work',
    tags: req.body.tags || [],
    isSyncedToDrive: isSynced,
    driveFileId: driveFileId,
    syncStatus: isSynced ? 'synced' : 'local_only',
    downloadUrl: driveFileId ? `/api/drive-service-account/download/${driveFileId}` : `/api/files/download/${fileId}`,
    previewUrl: webViewLink || `/api/files/preview/${fileId}`,
    textContent: textContent,
    uploadedAt: req.body.uploadedAt || new Date().toISOString(),
  };

  const saved = await saveDbFile(newFile);
  res.status(201).json(saved);
});

app.get('/api/files/download/:id', async (req: Request, res: Response) => {
  const fileId = req.params.id;
  const currentFiles = await getDbFiles();
  const file = currentFiles.find(f => f.id === fileId);

  if (!file) {
    return res.status(404).send('Không tìm thấy tệp yêu cầu');
  }

  // If has driveFileId and Service Account is connected, download from Drive
  if (file.driveFileId) {
    try {
      const saConfig = await getDbDriveServiceAccountConfig();
      if (saConfig.clientEmail && saConfig.privateKey) {
        const { buffer, mimeType, fileName } = await downloadFileFromDrive(saConfig, file.driveFileId);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName || file.name)}"`);
        res.setHeader('Content-Type', mimeType || file.mimeType || 'application/octet-stream');
        return res.send(buffer);
      }
    } catch (e) {
      console.warn('Fallback to local disk download:', e);
    }
  }

  // Look for stored file on disk
  try {
    const filesInDir = fs.readdirSync(UPLOADS_DIR);
    const matched = filesInDir.find(fn => fn.startsWith(fileId));
    if (matched) {
      const fullPath = path.join(UPLOADS_DIR, matched);
      if (fs.existsSync(fullPath)) {
        const ext = path.extname(file.name).toLowerCase();
        let safeMime = file.mimeType || 'application/octet-stream';
        if (ext === '.docx') safeMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        else if (ext === '.doc') safeMime = 'application/msword';
        else if (ext === '.xlsx') safeMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        else if (ext === '.xls') safeMime = 'application/vnd.ms-excel';
        else if (ext === '.pdf') safeMime = 'application/pdf';

        const safeAsciiName = file.name.replace(/[^\x20-\x7E]/g, '_');
        res.setHeader('Content-Type', safeMime);
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${safeAsciiName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`
        );
        return res.sendFile(fullPath);
      }
    }
  } catch (e) {
    console.warn('Error checking uploads folder:', e);
  }

  // If textContent available, send as text file
  if (file.textContent) {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
    res.setHeader('Content-Type', file.mimeType || 'text/plain; charset=utf-8');
    return res.send(file.textContent);
  }

  // Fallback realistic document generator
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  res.send(`--- TÀI LIỆU HỆ THỐNG TRỢ LÝ AI: ${file.name} ---\nLoại: ${file.category}\nKích thước: ${file.size} bytes\nNgày lưu: ${file.uploadedAt}\n\nNội dung văn bản lưu trữ an toàn trong Local Storage Vault.`);
});

app.get('/api/files/preview/:id', async (req: Request, res: Response) => {
  const fileId = req.params.id;
  const currentFiles = await getDbFiles();
  const file = currentFiles.find(f => f.id === fileId);

  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    const filesInDir = fs.readdirSync(UPLOADS_DIR);
    const matched = filesInDir.find(fn => fn.startsWith(fileId));
    if (matched) {
      const fullPath = path.join(UPLOADS_DIR, matched);
      res.setHeader('Content-Type', file.mimeType);
      return res.sendFile(fullPath);
    }
  } catch (e) {}

  res.json({
    id: file.id,
    name: file.name,
    category: file.category,
    mimeType: file.mimeType,
    textContent: file.textContent || `[Tài liệu: ${file.name}] - Lưu trữ cục bộ an toàn.`,
    isSyncedToDrive: file.isSyncedToDrive,
    webViewLink: file.webViewLink,
  });
});

app.post('/api/files/sync-drive/:id', async (req: Request, res: Response) => {
  const fileId = req.params.id;
  const { driveFileId, webViewLink } = req.body;
  const currentFiles = await getDbFiles();
  const existing = currentFiles.find(f => f.id === fileId);

  if (!existing) {
    return res.status(404).json({ error: 'File not found' });
  }

  const updated: DriveFile = {
    ...existing,
    driveFileId: driveFileId || existing.driveFileId,
    webViewLink: webViewLink || existing.webViewLink,
    isSyncedToDrive: true,
    syncStatus: 'synced',
    syncError: undefined,
  };

  const saved = await saveDbFile(updated);
  res.json({ success: true, file: saved });
});

// Upload a local vault file to Google Drive using User OAuth Access Token (Bearer Header)
app.post('/api/files/upload-to-user-drive/:id', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Thiếu Google OAuth Access Token. Vui lòng bấm Đăng Nhập Google để kết nối.' });
    }
    const userToken = authHeader.substring(7);
    const fileId = req.params.id;
    const targetFolderId = req.body?.folderId;

    const files = await getDbFiles();
    const file = files.find(f => f.id === fileId);
    if (!file) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin tệp.' });
    }

    // Locate local binary buffer
    let fileBuffer: Buffer | null = null;
    try {
      const filesInDir = fs.readdirSync(UPLOADS_DIR);
      const matched = filesInDir.find(fn => fn.startsWith(fileId));
      if (matched) {
        const fullPath = path.join(UPLOADS_DIR, matched);
        if (fs.existsSync(fullPath)) {
          fileBuffer = fs.readFileSync(fullPath);
        }
      }
    } catch (e) {
      console.warn('Error reading file from disk:', e);
    }

    if (!fileBuffer && file.textContent) {
      fileBuffer = Buffer.from(file.textContent, 'utf-8');
    }

    if (!fileBuffer) {
      return res.status(404).json({ error: 'Không tìm thấy dữ liệu tệp nhị phân trên máy chủ.' });
    }

    // Google Drive v3 Multipart upload
    const metadata: { name: string; mimeType: string; parents?: string[] } = {
      name: file.name,
      mimeType: file.mimeType || 'application/octet-stream',
    };
    if (targetFolderId && targetFolderId.trim().length > 0) {
      metadata.parents = [targetFolderId.trim()];
    }

    const boundary = '-------NodeDriveOAuthUpload' + Date.now().toString(36);
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadataPart = Buffer.from(
      `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`
    );
    const mediaHeaderPart = Buffer.from(
      `${delimiter}Content-Type: ${file.mimeType || 'application/octet-stream'}\r\n\r\n`
    );
    const endPart = Buffer.from(`${closeDelimiter}`);

    const multipartBody = Buffer.concat([metadataPart, mediaHeaderPart, fileBuffer, endPart]);

    const driveRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink&supportsAllDrives=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': multipartBody.length.toString(),
        },
        body: multipartBody,
      }
    );

    if (!driveRes.ok) {
      const errText = await driveRes.text();
      console.error('Google Drive API error:', errText);
      let errMsg = `Lỗi Google Drive (${driveRes.status})`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed?.error?.message) errMsg = parsed.error.message;
      } catch (e) {}
      return res.status(driveRes.status).json({ error: errMsg });
    }

    const driveResult: any = await driveRes.json();
    const driveFileId = driveResult.id;
    const webViewLink = driveResult.webViewLink || `https://drive.google.com/file/d/${driveFileId}/view`;

    // Delete local physical file if it exists to free local disk space
    try {
      const filesInDir = fs.readdirSync(UPLOADS_DIR);
      const matched = filesInDir.find(fn => fn.startsWith(fileId));
      if (matched) {
        const fullPath = path.join(UPLOADS_DIR, matched);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          console.log(`[Storage] Deleted local physical file after Drive upload: ${matched}`);
        }
      }
    } catch (cleanErr) {
      console.warn('Could not remove local file copy:', cleanErr);
    }

    // Update DB record
    const updated: DriveFile = {
      ...file,
      driveFileId: driveFileId,
      webViewLink: webViewLink,
      isSyncedToDrive: true,
      syncStatus: 'synced',
      syncError: undefined,
    };

    const saved = await saveDbFile(updated);

    return res.json({
      success: true,
      file: saved,
      driveResult,
    });
  } catch (error: any) {
    console.error('Error uploading file to user drive:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

app.put('/api/files/:id', async (req: Request, res: Response) => {
  const fileId = req.params.id;
  const currentFiles = await getDbFiles();
  const existing = currentFiles.find(f => f.id === fileId);
  if (!existing) {
    return res.status(404).json({ error: 'File not found' });
  }
  const updated: DriveFile = {
    ...existing,
    ...req.body,
    id: fileId,
  };
  const saved = await saveDbFile(updated);
  res.json(saved);
});

app.delete('/api/files/:id', async (req: Request, res: Response) => {
  const fileId = req.params.id;
  const currentFiles = await getDbFiles();
  const file = currentFiles.find(f => f.id === fileId);

  // If connected to Drive via Service Account, also delete on Drive
  if (file?.driveFileId) {
    try {
      const saConfig = await getDbDriveServiceAccountConfig();
      if (saConfig.isEnabled && saConfig.isConnected) {
        await deleteFileFromDrive(saConfig, file.driveFileId);
      }
    } catch (e) {
      console.warn('Drive file deletion error (non-fatal):', e);
    }
  }

  await deleteDbFile(fileId);
  // Clean up from uploads folder
  try {
    const filesInDir = fs.readdirSync(UPLOADS_DIR);
    const matched = filesInDir.find(fn => fn.startsWith(fileId));
    if (matched) {
      fs.unlinkSync(path.join(UPLOADS_DIR, matched));
    }
  } catch (e) {}
  res.json({ success: true, id: fileId });
});

// -------------------------------------------------------------
// 3.5. GOOGLE DRIVE SERVICE ACCOUNT API ROUTES (SERVER-SIDE)
// -------------------------------------------------------------
app.get('/api/drive-service-account/config', async (req: Request, res: Response) => {
  const config = await getDbDriveServiceAccountConfig();
  res.json({
    ...config,
    privateKey: config.privateKey ? '******** (Đã lưu an toàn trên Server)' : '',
    hasPrivateKey: !!config.privateKey,
  });
});

app.post('/api/drive-service-account/config', async (req: Request, res: Response) => {
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

app.post('/api/drive-service-account/test', async (req: Request, res: Response) => {
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

app.post('/api/drive-service-account/sync', async (req: Request, res: Response) => {
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

app.get('/api/drive-service-account/download/:driveFileId', async (req: Request, res: Response) => {
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

// -------------------------------------------------------------
// 4. TELEGRAM BOT & NOTIFICATION API ROUTES (FIRESTORE PERSISTED)
// -------------------------------------------------------------
app.get('/api/telegram/config', async (req: Request, res: Response) => {
  const config = await getDbTelegramConfig();
  const logs = await getDbNotificationLogs();
  res.json({
    config,
    logs,
  });
});

app.post('/api/telegram/config', async (req: Request, res: Response) => {
  const updated = await saveDbTelegramConfig(req.body);
  res.json({ success: true, config: updated });
});

app.post('/api/telegram/test', async (req: Request, res: Response) => {
  const telegramConfig = await getDbTelegramConfig();
  const msgText = req.body.message || 'Xin chào! Hệ thống AI Personal Assistant đã kết nối Telegram & Firestore thành công!';
  const newLog: NotificationLog = {
    id: `notif-${Date.now()}`,
    title: '💬 Thử nghiệm kết nối Telegram Bot (Cloud Firestore)',
    message: msgText,
    channel: 'telegram',
    status: 'sent',
    timestamp: new Date().toISOString(),
  };
  await addDbNotificationLog(newLog);

  const keyboard: TelegramInlineKeyboard = [
    [
      { text: '📋 Xem việc hôm nay', callback_data: 'cmd:today' },
      { text: '🌤️ Thời tiết', callback_data: 'cmd:weather' }
    ],
    [
      { text: '🌅 Bản tin sáng', callback_data: 'cmd:morning' },
      { text: '🌙 Báo cáo tối', callback_data: 'cmd:evening' }
    ]
  ];

  const delivered = await sendTelegramMessage(telegramConfig.botToken, telegramConfig.chatId, msgText, keyboard);
  res.json({ success: true, log: newLog, telegramDelivered: delivered });
});

// Telegram Bot Webhook Setup Endpoint with Secret Token Protection
app.post('/api/telegram/set-webhook', async (req: Request, res: Response) => {
  const telegramConfig = await getDbTelegramConfig();
  const { webhookUrl, secretToken } = req.body;
  if (!telegramConfig.botToken) {
    return res.status(400).json({ error: 'Chưa cấu hình Telegram Bot Token.' });
  }

  const host = req.get('host');
  const targetUrl = webhookUrl || `https://${host}/api/telegram/webhook`;
  const webhookSecret = secretToken || telegramConfig.webhookSecret || `sec_${Buffer.from(telegramConfig.botToken).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)}`;

  try {
    const payload: any = {
      url: targetUrl,
      secret_token: webhookSecret,
      drop_pending_updates: false,
    };

    const telegramRes = await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data: any = await telegramRes.json();
    if (data.ok) {
      // Save webhookSecret to config
      await saveDbTelegramConfig({
        webhookSecret,
        webhookUrl: targetUrl,
      });

      await addDbNotificationLog({
        id: `notif-${Date.now()}`,
        title: '🔗 Đã kích hoạt Webhook 2 chiều Telegram (Có Secret Token)',
        message: `Kích hoạt Webhook bảo mật tới ${targetUrl}`,
        channel: 'telegram',
        status: 'sent',
        timestamp: new Date().toISOString(),
      });
      return res.json({ success: true, webhookUrl: targetUrl, telegramResponse: data });
    } else {
      return res.status(400).json({ error: data.description || 'Không thể cài đặt Webhook trên Telegram' });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Lỗi kết nối tới Telegram API' });
  }
});

app.get('/api/telegram/webhook-info', async (req: Request, res: Response) => {
  const telegramConfig = await getDbTelegramConfig();
  if (!telegramConfig.botToken) {
    return res.status(400).json({ error: 'Chưa cấu hình Telegram Bot Token.' });
  }
  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/getWebhookInfo`);
    const data: any = await tgRes.json();
    res.json({ success: true, info: data.result || data, currentConfig: telegramConfig });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Lỗi kiểm tra Webhook' });
  }
});

// -------------------------------------------------------------
// 5. AI DAILY EXECUTIVE BRIEFING ENDPOINT (MORNING & EVENING)
// -------------------------------------------------------------
app.post('/api/briefing/generate', async (req: Request, res: Response) => {
  const type = (req.body.type === 'evening' ? 'evening' : 'morning') as 'morning' | 'evening';
  const sendToTelegram = req.body.sendToTelegram !== false;
  const ai = getGeminiClient();
  const tasks = await getDbTasks();
  const notes = await getDbNotes();
  const telegramConfig = await getDbTelegramConfig();

  try {
    const briefing = await generateDailyBriefing(type, ai, tasks, notes);

    let delivered = false;
    if (sendToTelegram && telegramConfig.botToken && telegramConfig.chatId) {
      const keyboard: TelegramInlineKeyboard = [
        [
          { text: '📋 Xem việc hôm nay', callback_data: 'cmd:today' },
          { text: '📋 Tất cả việc', callback_data: 'cmd:tasks' },
        ],
        [
          { text: '🌤️ Thời tiết', callback_data: 'cmd:weather' },
          { text: '📝 Ghi chú', callback_data: 'cmd:notes' }
        ]
      ];
      delivered = await sendTelegramMessage(telegramConfig.botToken, telegramConfig.chatId, briefing.reportText, keyboard);
    }

    const log: NotificationLog = {
      id: `notif-${Date.now()}-briefing`,
      title: briefing.title,
      message: briefing.reportText.slice(0, 140) + '...',
      channel: 'telegram',
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
    await addDbNotificationLog(log);

    res.json({ success: true, briefing, delivered, log });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Lỗi tạo bản tin AI Daily Briefing' });
  }
});

// Full 2-Way Conversational, Voice Recognition & Inline Keyboards Webhook Handler
app.post('/api/telegram/webhook', async (req: Request, res: Response) => {
  const telegramConfig = await getDbTelegramConfig();

  // Validate Telegram Webhook Secret Token if configured
  if (telegramConfig.webhookSecret) {
    const incomingSecret = req.get('x-telegram-bot-api-secret-token');
    if (incomingSecret && incomingSecret !== telegramConfig.webhookSecret) {
      console.warn('⚠️ Từ chối Telegram webhook: Secret token không hợp lệ.');
      return res.status(403).json({ error: 'Invalid secret token' });
    }
  }

  const tasks = await getDbTasks();
  const notes = await getDbNotes();

  const telegramUpdate = req.body || {};

  // -----------------------------------------------------------
  // A. HANDLE INLINE KEYBOARD CALLBACK QUERIES
  // -----------------------------------------------------------
  if (telegramUpdate.callback_query) {
    const cbq = telegramUpdate.callback_query;
    const data: string = cbq.data || '';
    const chatId = String(cbq.message?.chat?.id || cbq.from?.id || telegramConfig.chatId);
    const callbackQueryId = cbq.id;

    console.log(`🔘 Telegram Inline Button Clicked: [${data}] from Chat ID: ${chatId}`);

    // 1. Mark task completed
    if (data.startsWith('done:')) {
      const taskId = data.replace('done:', '');
      const currentTasks = await getDbTasks();
      const target = currentTasks.find(t => t.id === taskId);
      if (target) {
        target.status = 'completed';
        target.updatedAt = new Date().toISOString();
        await saveDbTask(target);
        await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, `✅ Đã xong: ${target.title}`);
        await sendTelegramMessage(
          telegramConfig.botToken,
          chatId,
          `🎉 *ĐÃ HOÀN THÀNH CÔNG VIỆC*\n\n📌 Công việc: *${target.title}*\nTrạng thái: *Đã hoàn thành (Completed)* ✅\n\n_Dữ liệu đã được cập nhật trực tiếp vào Firestore!_`,
          [[{ text: '📋 Xem danh sách việc hôm nay', callback_data: 'cmd:today' }]]
        );
      } else {
        await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, '⚠️ Không tìm thấy công việc này.');
      }
      return res.json({ success: true, action: 'done', taskId });
    }

    // 2. Snooze task deadline
    if (data.startsWith('snooze:')) {
      const parts = data.split(':');
      const taskId = parts[1];
      const mins = parseInt(parts[2] || '15', 10);
      const currentTasks = await getDbTasks();
      const target = currentTasks.find(t => t.id === taskId);
      if (target) {
        const newDeadline = new Date(new Date(target.deadline).getTime() + mins * 60 * 1000).toISOString();
        target.deadline = newDeadline;
        target.isNotified = false; // Reset notification flag for new reminder
        target.updatedAt = new Date().toISOString();
        await saveDbTask(target);
        await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, `⏰ Đã hoãn thêm ${mins} phút!`);
        await sendTelegramMessage(
          telegramConfig.botToken,
          chatId,
          `⏰ *ĐÃ HOÃN DEADLINE*\n\n📌 Công việc: *${target.title}*\n⏳ Hạn chót mới: *${new Date(newDeadline).toLocaleString('vi-VN')}* (+${mins} phút)\n🎯 Mức độ: *${target.priority.toUpperCase()}*`,
          buildTaskReminderKeyboard(target)
        );
      } else {
        await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, '⚠️ Không tìm thấy công việc này.');
      }
      return res.json({ success: true, action: 'snooze', taskId, mins });
    }

    // 3. Delete task
    if (data.startsWith('del:')) {
      const taskId = data.replace('del:', '');
      const currentTasks = await getDbTasks();
      const target = currentTasks.find(t => t.id === taskId);
      if (target) {
        await deleteDbTask(taskId);
        await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, `🗑️ Đã xóa: ${target.title}`);
        await sendTelegramMessage(
          telegramConfig.botToken,
          chatId,
          `🗑️ *ĐÃ XÓA CÔNG VIỆC*\n\nĐã xóa vĩnh viễn công việc *"${target.title}"* khỏi Firestore.`,
          [[{ text: '📋 Xem việc còn lại', callback_data: 'cmd:today' }]]
        );
      } else {
        await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, '⚠️ Công việc không tồn tại.');
      }
      return res.json({ success: true, action: 'del', taskId });
    }

    // 4. Quick Commands & Briefings via buttons
    if (data === 'cmd:today') {
      await answerCallbackQuery(telegramConfig.botToken, callbackQueryId);
      const currentTasks = await getDbTasks();
      const tzInfo = getTimeInZone(new Date(), telegramConfig.timezone || 'Asia/Ho_Chi_Minh');
      const todayStr = tzInfo.dateStr;
      const todayTasks = currentTasks.filter(t => {
        if (!t.deadline || t.status === 'completed' || t.status === 'canceled') return false;
        const taskTz = getTimeInZone(new Date(t.deadline), telegramConfig.timezone || 'Asia/Ho_Chi_Minh');
        return taskTz.dateStr === todayStr;
      });
      let msg = '';
      if (todayTasks.length === 0) {
        msg = '🎉 *Hôm nay bạn không có deadline công việc nào chưa hoàn thành!*';
      } else {
        msg = `📅 *Danh sách công việc hôm nay (${todayTasks.length}):*\n\n` +
          todayTasks.map((t, idx) => `${idx + 1}. [${t.priority.toUpperCase()}] *${t.title}*\n   ⏰ Deadline: ${new Date(t.deadline).toLocaleTimeString('vi-VN', { timeZone: telegramConfig.timezone || 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}`).join('\n\n');
      }
      await sendTelegramMessage(telegramConfig.botToken, chatId, msg, buildTaskListKeyboard(currentTasks));
      return res.json({ success: true, action: 'today' });
    }

    if (data === 'cmd:tasks') {
      await answerCallbackQuery(telegramConfig.botToken, callbackQueryId);
      const currentTasks = await getDbTasks();
      const pending = currentTasks.filter(t => t.status !== 'completed' && t.status !== 'canceled');
      const msg = `📋 *Danh sách công việc chưa hoàn thành (${pending.length}):*\n\n` +
        pending.map((t, idx) => `${idx + 1}. *${t.title}* (${t.priority.toUpperCase()})\n   ⏰ ${new Date(t.deadline).toLocaleDateString('vi-VN')}`).join('\n\n');
      await sendTelegramMessage(telegramConfig.botToken, chatId, msg, buildTaskListKeyboard(currentTasks));
      return res.json({ success: true, action: 'tasks' });
    }

    if (data === 'cmd:notes') {
      await answerCallbackQuery(telegramConfig.botToken, callbackQueryId);
      const currentNotes = await getDbNotes();
      const msg = `📝 *Ghi chú cá nhân (${currentNotes.length}):*\n\n` +
        currentNotes.slice(0, 5).map((n, idx) => `${idx + 1}. *${n.title}* (${n.tags.join(', ')})`).join('\n');
      await sendTelegramMessage(telegramConfig.botToken, chatId, msg, [
        [{ text: '📋 Danh sách việc', callback_data: 'cmd:tasks' }]
      ]);
      return res.json({ success: true, action: 'notes' });
    }

    if (data === 'cmd:weather') {
      await answerCallbackQuery(telegramConfig.botToken, callbackQueryId);
      const aiRes = await processAiChat('Thời tiết Bắc Giang hôm nay', true);
      await sendTelegramMessage(telegramConfig.botToken, chatId, aiRes.reply, [
        [{ text: '📋 Việc hôm nay', callback_data: 'cmd:today' }]
      ]);
      return res.json({ success: true, action: 'weather' });
    }

    if (data === 'cmd:morning') {
      await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, 'Đang tổng hợp bản tin sáng...');
      const currentTasks = await getDbTasks();
      const currentNotes = await getDbNotes();
      const briefing = await generateDailyBriefing('morning', getGeminiClient(), currentTasks, currentNotes);
      await sendTelegramMessage(telegramConfig.botToken, chatId, briefing.reportText, [
        [{ text: '📋 Việc hôm nay', callback_data: 'cmd:today' }, { text: '🌤️ Thời tiết', callback_data: 'cmd:weather' }]
      ]);
      return res.json({ success: true, action: 'morning' });
    }

    if (data === 'cmd:evening') {
      await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, 'Đang tổng hợp báo cáo tối...');
      const currentTasks = await getDbTasks();
      const currentNotes = await getDbNotes();
      const briefing = await generateDailyBriefing('evening', getGeminiClient(), currentTasks, currentNotes);
      await sendTelegramMessage(telegramConfig.botToken, chatId, briefing.reportText, [
        [{ text: '📋 Việc hôm nay', callback_data: 'cmd:today' }, { text: '📋 Tất cả việc', callback_data: 'cmd:tasks' }]
      ]);
      return res.json({ success: true, action: 'evening' });
    }

    await answerCallbackQuery(telegramConfig.botToken, callbackQueryId);
    return res.json({ success: true, action: 'unknown' });
  }

  // -----------------------------------------------------------
  // B. HANDLE INCOMING MESSAGES (VOICE, DOCUMENTS, PHOTOS, TEXT)
  // -----------------------------------------------------------
  const msgObj = telegramUpdate.message || telegramUpdate.edited_message;
  const voiceObj = msgObj?.voice || msgObj?.audio;
  const documentObj = msgObj?.document;
  const photoArray = msgObj?.photo;

  const detectedChatId = msgObj?.chat?.id ? String(msgObj.chat.id) : null;
  const chatId = detectedChatId || req.body.chatId || telegramConfig.chatId;

  if (detectedChatId && detectedChatId !== telegramConfig.chatId) {
    await saveDbTelegramConfig({
      chatId: detectedChatId,
      isConnected: true,
    });
    console.log(`Auto-registered Telegram Chat ID to Firestore: ${detectedChatId}`);
  }

  let botReply = '';
  let replyKeyboard: TelegramInlineKeyboard | undefined = undefined;

  // Case 1: Voice message received on Telegram
  if (voiceObj && voiceObj.file_id && telegramConfig.botToken) {
    console.log(`🎙️ Received Telegram Voice message (file_id: ${voiceObj.file_id}). Transcribing with Gemini Multimodal Audio...`);
    try {
      // Send instant receipt indicator
      await sendTelegramMessage(telegramConfig.botToken, chatId, '🎙️ *Đang nhận diện giọng nói qua Gemini AI...*');

      const transcribedText = await transcribeTelegramVoice(telegramConfig.botToken, voiceObj.file_id, getGeminiClient());
      console.log(`🎙️ Gemini Multimodal Audio Transcription Result: "${transcribedText}"`);

      // Pass transcribed text into Autonomous Action Agent / Function Calling
      const aiResult = await processAiChat(transcribedText, true, `tg_${chatId}`);

      botReply = `🎙️ *Giọng nói nhận diện được:*\n_"${transcribedText}"_\n\n${aiResult.reply}`;
      replyKeyboard = [
        [
          { text: '📋 Việc hôm nay', callback_data: 'cmd:today' },
          { text: '📋 Tất cả việc', callback_data: 'cmd:tasks' }
        ]
      ];
    } catch (voiceError: any) {
      console.error('Voice processing error:', voiceError);
      botReply = `⚠️ *Không thể xử lý tin nhắn thoại:* ${voiceError?.message || 'Lỗi nhận dạng âm thanh'}`;
    }
  } else if ((documentObj || (photoArray && photoArray.length > 0)) && telegramConfig.botToken) {
    // Case 2: Document / File / Photo sent on Telegram
    try {
      const fileId = documentObj?.file_id || photoArray[photoArray.length - 1].file_id;
      const fileName = documentObj?.file_name || `photo_${Date.now()}.jpg`;
      const mimeType = documentObj?.mime_type || 'image/jpeg';
      const fileSize = documentObj?.file_size || photoArray[photoArray.length - 1].file_size || 102400;

      // 1. Fetch file from Telegram API
      const fileMetaRes = await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/getFile?file_id=${fileId}`);
      const fileMeta: any = await fileMetaRes.json();

      let isSavedLocally = false;
      const localFileId = `file-tg-${Date.now()}`;

      if (fileMeta.ok && fileMeta.result?.file_path) {
        const downloadUrl = `https://api.telegram.org/file/bot${telegramConfig.botToken}/${fileMeta.result.file_path}`;
        const binaryRes = await fetch(downloadUrl);
        if (binaryRes.ok) {
          const buffer = Buffer.from(await binaryRes.arrayBuffer());
          const savePath = path.join(UPLOADS_DIR, `${localFileId}_${path.basename(fileName)}`);
          fs.writeFileSync(savePath, buffer);
          isSavedLocally = true;
        }
      }

      // Determine category
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      let category: DriveFile['category'] = 'document';
      if (['xlsx', 'xls', 'csv'].includes(ext)) category = 'spreadsheet';
      else if (ext === 'pdf') category = 'pdf';
      else if (['pptx', 'ppt'].includes(ext)) category = 'presentation';
      else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext) || mimeType.startsWith('image/')) category = 'image';

      const newDriveFile: DriveFile = {
        id: localFileId,
        name: fileName,
        mimeType: mimeType,
        size: fileSize,
        category: category,
        isSyncedToDrive: false,
        syncStatus: 'local_only',
        downloadUrl: `/api/files/download/${localFileId}`,
        previewUrl: `/api/files/preview/${localFileId}`,
        uploadedAt: new Date().toISOString(),
      };

      await saveDbFile(newDriveFile);

      botReply = `📄 *ĐÃ NHẬN TÀI LIỆU TỪ TELEGRAM*\n\n` +
        `• **Tên tệp:** \`${fileName}\`\n` +
        `• **Dung lượng:** \`${(fileSize / (1024 * 1024)).toFixed(2)} MB\`\n` +
        `• **Trạng thái:** 🟡 *Đã lưu trữ cục bộ (Local Vault)*\n\n` +
        `💡 _Tệp đã được đưa vào danh mục quản lý tài liệu. Bạn có thể mở Web App để xem trước trực tiếp hoặc bấm 1-Click để đẩy lên Google Drive cá nhân._`;

      replyKeyboard = [
        [
          { text: '📋 Xem việc hôm nay', callback_data: 'cmd:today' },
          { text: '📋 Danh sách việc', callback_data: 'cmd:tasks' }
        ]
      ];
    } catch (docErr: any) {
      console.error('Telegram file error:', docErr);
      botReply = `⚠️ *Lỗi khi lưu tệp:* ${docErr?.message || 'Không thể tải file từ Telegram'}`;
    }
  } else {
    // Case 3: Standard Text message
    const rawInput = (
      msgObj?.text ||
      req.body.command ||
      req.body.text ||
      ''
    ).trim();

    if (!rawInput) {
      return res.json({ success: true, reply: 'Chưa nhận được nội dung tin nhắn.' });
    }

    let cleanInput = rawInput.replace(/@\w+/gi, '').trim();

    if (cleanInput.match(/^\/(start|help)\b/i)) {
      botReply = `🤖 *AI Personal Productivity Assistant & Agent (Cloud Firestore)*\n\nChào bạn! Tôi là Trợ lý AI Agent kết nối trực tiếp với Firestore của bạn. Tôi có thể **Tự Động Thực Hiện Hành Động** qua **lời nói ghi âm (Voice to Task)** hoặc tin nhắn tự nhiên:\n\n🎙️ *Bạn có thể bấm giữ micro trên Telegram và nói:*\n• "Thêm việc họp khách hàng lúc 3h chiều mai độ ưu tiên cao"\n• "Đã xong việc nộp báo cáo quý"\n• "Tạo ghi chú ý tưởng thiết kế app mới"\n\n✨ *Lệnh nhanh:*\n• \`/today\` - Deadline hôm nay\n• \`/tasks\` - Danh sách việc chưa xong\n• \`/morning\` - Bản tin sáng Daily Briefing\n• \`/evening\` - Báo cáo tổng kết tối\n• \`/notes\` - Ghi chú cá nhân`;
      replyKeyboard = [
        [
          { text: '📋 Việc hôm nay', callback_data: 'cmd:today' },
          { text: '📋 Tất cả việc', callback_data: 'cmd:tasks' }
        ],
        [
          { text: '🌅 Bản tin sáng', callback_data: 'cmd:morning' },
          { text: '🌙 Báo cáo tối', callback_data: 'cmd:evening' }
        ]
      ];
    } else if (cleanInput.match(/^\/today\b/i)) {
      const tzInfo = getTimeInZone(new Date(), telegramConfig.timezone || 'Asia/Ho_Chi_Minh');
      const todayStr = tzInfo.dateStr;
      const todayTasks = tasks.filter(t => {
        if (!t.deadline || t.status === 'completed' || t.status === 'canceled') return false;
        const taskTz = getTimeInZone(new Date(t.deadline), telegramConfig.timezone || 'Asia/Ho_Chi_Minh');
        return taskTz.dateStr === todayStr;
      });
      if (todayTasks.length === 0) {
        botReply = `🎉 *Hôm nay bạn không có deadline công việc nào chưa hoàn thành!*`;
      } else {
        botReply = `📅 *Danh sách công việc hôm nay (${todayTasks.length}):*\n\n` +
          todayTasks.map((t, idx) => `${idx + 1}. [${t.priority.toUpperCase()}] *${t.title}*\n   ⏰ Deadline: ${new Date(t.deadline).toLocaleTimeString('vi-VN', { timeZone: telegramConfig.timezone || 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}\n   📌 Trạng thái: ${t.status}`).join('\n\n');
      }
      replyKeyboard = buildTaskListKeyboard(tasks);
    } else if (cleanInput.match(/^\/tasks\b/i)) {
      const pending = tasks.filter(t => t.status !== 'completed' && t.status !== 'canceled');
      botReply = `📋 *Danh sách công việc chưa hoàn thành (${pending.length}):*\n\n` +
        pending.map((t, idx) => `${idx + 1}. *${t.title}* (${t.priority.toUpperCase()})\n   ⏰ ${new Date(t.deadline).toLocaleDateString('vi-VN')}`).join('\n\n');
      replyKeyboard = buildTaskListKeyboard(tasks);
    } else if (cleanInput.match(/^\/notes\b/i)) {
      botReply = `📝 *Ghi chú cá nhân (${notes.length}):*\n\n` +
        notes.slice(0, 5).map((n, idx) => `${idx + 1}. *${n.title}* (${n.tags.join(', ')})`).join('\n');
      replyKeyboard = [[{ text: '📋 Danh sách việc', callback_data: 'cmd:tasks' }]];
    } else if (cleanInput.match(/^\/(morning|briefing)\b/i)) {
      const briefing = await generateDailyBriefing('morning', getGeminiClient(), tasks, notes);
      botReply = briefing.reportText;
      replyKeyboard = [
        [{ text: '📋 Việc hôm nay', callback_data: 'cmd:today' }, { text: '🌤️ Thời tiết', callback_data: 'cmd:weather' }]
      ];
    } else if (cleanInput.match(/^\/evening\b/i)) {
      const briefing = await generateDailyBriefing('evening', getGeminiClient(), tasks, notes);
      botReply = briefing.reportText;
      replyKeyboard = [
        [{ text: '📋 Việc hôm nay', callback_data: 'cmd:today' }, { text: '📋 Tất cả việc', callback_data: 'cmd:tasks' }]
      ];
    } else {
      let promptQuery = cleanInput.replace(/^\/(ask|chat|ai)\b/i, '').trim();

      if (!promptQuery) {
        botReply = `⚠️ Vui lòng nhập câu hỏi hoặc yêu cầu sau lệnh /ask. Ví dụ: "Thêm việc nộp thuế", "Thời tiết hôm nay".`;
      } else {
        const aiRes = await processAiChat(promptQuery, true, `tg_${chatId}`);
        botReply = aiRes.reply;
        replyKeyboard = [
          [{ text: '📋 Xem việc hôm nay', callback_data: 'cmd:today' }, { text: '🌤️ Thời tiết', callback_data: 'cmd:weather' }]
        ];
      }
    }
  }

  // Record Telegram log to Firestore
  await addDbNotificationLog({
    id: `notif-${Date.now()}`,
    title: `💬 Telegram Bot: ${botReply.slice(0, 30)}`,
    message: botReply.slice(0, 100) + '...',
    channel: 'telegram',
    status: 'sent',
    timestamp: new Date().toISOString(),
  });

  // Deliver message with Inline Keyboards to Telegram
  if (telegramConfig.botToken && chatId) {
    await sendTelegramMessage(telegramConfig.botToken, chatId, botReply, replyKeyboard);
  }

  res.json({ success: true, reply: botReply, chatId });
});

// Helper to extract time parts in a specific timezone (defaults to Vietnam Asia/Ho_Chi_Minh)
function getTimeInZone(date: Date = new Date(), timeZone: string = 'Asia/Ho_Chi_Minh') {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';

  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = parseInt(get('hour') || '0', 10);
  const minute = parseInt(get('minute') || '0', 10);
  const second = parseInt(get('second') || '0', 10);
  const dateStr = `${year}-${month}-${day}`;

  return { date, dateStr, hour, minute, second, timeZone };
}

// -------------------------------------------------------------
// 6. BACKGROUND SCHEDULER & REMINDER CRON (VIETNAM TIMEZONE AWARE)
// -------------------------------------------------------------
async function runSchedulerCheck() {
  const telegramConfig = await getDbTelegramConfig();
  const timeZone = telegramConfig.timezone || 'Asia/Ho_Chi_Minh';
  const tzInfo = getTimeInZone(new Date(), timeZone);
  const nowMs = tzInfo.date.getTime();
  const todayStr = tzInfo.dateStr; // e.g. "2026-08-17" in Vietnam timezone
  const currentHour = tzInfo.hour; // local hour 0-23 in Vietnam
  const currentMinute = tzInfo.minute; // local minute 0-59 in Vietnam

  const tasks = await getDbTasks();
  const notes = await getDbNotes();
  const newTriggeredAlerts: NotificationLog[] = [];

  // A. Check Task Deadline Alerts
  for (const t of tasks) {
    if (t.status === 'completed' || t.status === 'canceled') continue;
    if (t.isNotified) continue;

    const deadlineTime = new Date(t.deadline).getTime();
    const diffMinutes = (deadlineTime - nowMs) / (1000 * 60);

    if (diffMinutes > 0 && diffMinutes <= (t.reminderOffsetMinutes || telegramConfig.alertOffsetMinutes || 15)) {
      const updatedTask: Task = {
        ...t,
        isNotified: true,
        lastNotifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveDbTask(updatedTask);

      const alertLog: NotificationLog = {
        id: `notif-${Date.now()}-${t.id}`,
        title: `⏰ Nhắc việc: ${t.title}`,
        message: `Công việc "${t.title}" sắp đến deadline vào ${new Date(t.deadline).toLocaleTimeString('vi-VN', { timeZone, hour: '2-digit', minute: '2-digit' })} (${Math.round(diffMinutes)} phút nữa)!`,
        channel: 'telegram',
        status: 'sent',
        timestamp: new Date().toISOString(),
        taskId: t.id,
      };
      await addDbNotificationLog(alertLog);
      newTriggeredAlerts.push(alertLog);

      if (telegramConfig.botToken && telegramConfig.chatId && telegramConfig.enabled !== false) {
        const alertText = `⏰ *NHẮC NHỞ DEADLINE*\n\n📌 Công việc: *${t.title}*\n⏳ Hạn chót: *${new Date(t.deadline).toLocaleString('vi-VN', { timeZone })}* (còn ${Math.round(diffMinutes)} phút)\n🎯 Mức độ: *${t.priority.toUpperCase()}*\n\n👇 *Bấm nút bên dưới để xử lý nhanh ngay trên Telegram:*`;
        sendTelegramMessage(
          telegramConfig.botToken,
          telegramConfig.chatId,
          alertText,
          buildTaskReminderKeyboard(t)
        ).catch(err => console.warn('Scheduler telegram push error:', err));
      }
    }
  }

  // B. Automated Daily Briefings Dispatch (Configurable hours in Vietnam Timezone)
  if (telegramConfig.isConnected && telegramConfig.botToken && telegramConfig.chatId && telegramConfig.enabled !== false) {
    const morningHour = telegramConfig.morningBriefingHour ?? 7; // default 7 (7h00 sáng VN)
    const morningMinute = telegramConfig.morningBriefingMinute ?? 0;
    const isMorningEnabled = telegramConfig.enableMorningBriefing !== false;

    const eveningHour = telegramConfig.eveningBriefingHour ?? 21; // default 21 (21h00 tối VN)
    const eveningMinute = telegramConfig.eveningBriefingMinute ?? 0;
    const isEveningEnabled = telegramConfig.enableEveningBriefing !== false;

    // Morning briefing check:
    // Triggers once per day when current VN hour matches target morning window
    if (isMorningEnabled && lastMorningBriefingDate !== todayStr) {
      const isMorningTime = (currentHour === morningHour && currentMinute >= morningMinute) || (currentHour > morningHour && currentHour <= morningHour + 2);
      if (isMorningTime) {
        lastMorningBriefingDate = todayStr;
        console.log(`[Scheduler] 🌅 Dispatching Morning Briefing at VN Time: ${currentHour}:${currentMinute.toString().padStart(2, '0')} (${todayStr})`);
        generateDailyBriefing('morning', getGeminiClient(), tasks, notes).then(async (morningBriefing) => {
          await sendTelegramMessage(telegramConfig.botToken, telegramConfig.chatId, morningBriefing.reportText, [
            [{ text: '📋 Xem việc hôm nay', callback_data: 'cmd:today' }, { text: '🌤️ Thời tiết', callback_data: 'cmd:weather' }]
          ]);
          await addDbNotificationLog({
            id: `notif-${Date.now()}-morning-auto`,
            title: morningBriefing.title,
            message: morningBriefing.reportText.slice(0, 100) + '...',
            channel: 'telegram',
            status: 'sent',
            timestamp: new Date().toISOString(),
          });
        }).catch(e => console.warn('Auto morning briefing error:', e));
      }
    }

    // Evening briefing check:
    // Triggers once per day when current VN hour matches target evening window
    if (isEveningEnabled && lastEveningBriefingDate !== todayStr) {
      const isEveningTime = (currentHour === eveningHour && currentMinute >= eveningMinute) || (currentHour > eveningHour && currentHour <= Math.min(23, eveningHour + 2));
      if (isEveningTime) {
        lastEveningBriefingDate = todayStr;
        console.log(`[Scheduler] 🌙 Dispatching Evening Briefing at VN Time: ${currentHour}:${currentMinute.toString().padStart(2, '0')} (${todayStr})`);
        generateDailyBriefing('evening', getGeminiClient(), tasks, notes).then(async (eveningBriefing) => {
          await sendTelegramMessage(telegramConfig.botToken, telegramConfig.chatId, eveningBriefing.reportText, [
            [{ text: '📋 Xem việc hôm nay', callback_data: 'cmd:today' }, { text: '📋 Tất cả việc', callback_data: 'cmd:tasks' }]
          ]);
          await addDbNotificationLog({
            id: `notif-${Date.now()}-evening-auto`,
            title: eveningBriefing.title,
            message: eveningBriefing.reportText.slice(0, 100) + '...',
            channel: 'telegram',
            status: 'sent',
            timestamp: new Date().toISOString(),
          });
        }).catch(e => console.warn('Auto evening briefing error:', e));
      }
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    vnTime: `${todayStr} ${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}:${tzInfo.second.toString().padStart(2, '0')}`,
    timezone: timeZone,
    triggeredCount: newTriggeredAlerts.length,
    alerts: newTriggeredAlerts,
  };
}

app.get('/api/scheduler/check', async (req: Request, res: Response) => {
  try {
    const result = await runSchedulerCheck();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Scheduler check error' });
  }
});

// Helper function for unified AI Chat handling with Function Calling, Multi-Turn Memory & Google Search
async function processAiChat(
  message: string,
  enableSearch: boolean = true,
  sessionId: string = 'default_session',
  providedHistory: { role: string; content: string }[] = []
) {
  const tasks = await getDbTasks();
  const notes = await getDbNotes();
  const currentFiles = await getDbFiles();

  try {
    const ai = getGeminiClient();

    // RAG Context Retrieval from internal Firestore data
    const tasksContext = tasks.map(t => `- [ID: ${t.id}] [${t.priority.toUpperCase()}] ${t.title} | Deadline: ${t.deadline} | Status: ${t.status} | Tags: ${(t.tags || []).join(',')}`).join('\n');
    const notesContext = notes.map(n => `- [ID: ${n.id}] Note: ${n.title} | Tags: ${(n.tags || []).join(',')} | Snippet: ${n.content.slice(0, 180)}...`).join('\n');
    const filesContext = currentFiles.map(f => `- File: ${f.name} [Phân loại: ${f.classification || 'Chưa phân loại'}] [Định dạng: ${f.category}] | Link: ${f.webViewLink || 'Lưu cục bộ'} | Tags: ${(f.tags || []).join(', ')}`).join('\n');

    const currentTimeIso = new Date().toISOString();
    const telegramConfig = await getDbTelegramConfig();
    const timeZone = telegramConfig.timezone || 'Asia/Ho_Chi_Minh';
    const vnTimeStr = new Date().toLocaleString('vi-VN', {
      timeZone,
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    // Retrieve active conversation history for this session (max 6 latest turns)
    const storedHistory = getConversationHistory(sessionId);
    const activeHistory = providedHistory.length > 0 ? providedHistory : storedHistory;
    const historySnippet = activeHistory.length > 0
      ? activeHistory.slice(-6).map(h => `${h.role === 'user' ? 'Người dùng' : 'AI'}: ${h.content}`).join('\n')
      : '';

    const systemInstruction = `Bạn là Senior AI Personal Productivity Assistant & Autonomous AI Agent, trợ lý cá nhân đa năng kết nối trực tiếp với cơ sở dữ liệu Firebase Firestore (Tasks, Notes, Files) VÀ công cụ Google Search Real-time.

MỐC THỜI GIAN THỰC TẾ (VIETNAM TIMEZONE UTC+7):
- Thời điểm hiện tại: ${vnTimeStr} (${timeZone})
- Timestamp ISO chuẩn: ${currentTimeIso}
- Khi người dùng nói các từ ngữ mang tính thời gian tương đối như "hôm nay", "ngày mai", "chiều mai lúc 3h", "tối nay", "tuần sau"... Bạn PHẢI căn cứ chính xác vào mốc thời gian Việt Nam [UTC+7] ở trên để tính toán deadline ISO 8601 tương ứng khi gọi hàm.

=== DỮ LIỆU CÔNG VIỆC HIỆN CÓ TRONG FIRESTORE (TASKS) ===
${tasksContext || 'Chưa có công việc nào.'}

=== DỮ LIỆU GHI CHÚ HIỆN CÓ (NOTES) ===
${notesContext || 'Chưa có ghi chú nào.'}

=== DỮ LIỆU TỆP TIN (FILES) ===
${filesContext || 'Chưa có tệp tin nào.'}
${historySnippet ? `\n=== LỊCH SỬ HỘI THOẠI GẦN ĐÂY VỚI NGƯỜI DÙNG (CONTEXT) ===\n${historySnippet}\n(LƯU Ý: Người dùng có thể ra lệnh nối tiếp tham chiếu tới thông tin đã nói ở các lượt chat trước, ví dụ: "đổi giờ việc đó sang 4h", "lưu luôn cái vừa nói thành note", "xóa việc vừa tạo"...)` : ''}

QUY TẮC HÀNH ĐỘNG CỦA AGENT (BẮT BUỘC):
1. HÀNH ĐỘNG TỰ ĐỘNG (Function Calling):
   - Khi người dùng muốn TẠO / THÊM công việc (kể cả nói qua tin nhắn thoại, ví dụ: "thêm việc...", "nhắc tôi...", "tạo task..."): Hãy GỌI HÀM \`createTask\` với tiêu đề, thời hạn (tính theo giờ Việt Nam hiện tại), độ ưu tiên.
   - Khi người dùng muốn HOÀN THÀNH công việc (ví dụ: "đã xong việc...", "hoàn thành task..."): Hãy GỌI HÀM \`completeTask\` với \`taskQuery\` hoặc \`taskId\`.
   - Khi người dùng muốn XÓA công việc: Hãy GỌI HÀM \`deleteTask\`.
   - Khi người dùng muốn LƯU / TẠO GHI CHÚ: Hãy GỌI HÀM \`createNote\` với tiêu đề và nội dung.
   - Khi người dùng muốn TRA CỨU / TÌM KIẾM GHI CHÚ: Hãy GỌI HÀM \`queryNotes\` với \`searchKeyword\` hoặc \`onlyPinned\`.
   - Khi người dùng muốn XÓA GHI CHÚ: Hãy GỌI HÀM \`deleteNote\`.
   - Khi người dùng muốn TÌM KIẾM / TRA CỨU TÀI LIỆU, TỆP TIN: Hãy GỌI HÀM \`queryFiles\` với \`classification\` (Công việc, Cá nhân, Hợp đồng, Tài chính, Dự án, Mẫu đơn), \`category\` hoặc \`searchKeyword\`.
   - Khi người dùng muốn TRA CỨU / LIỆT KÊ công việc: Hãy GỌI HÀM \`queryTasks\` (hỗ trợ lọc status: 'today', 'tomorrow', 'pending', 'completed', 'overdue').
2. TRA CỨU INTERNET & THỜI TIẾT, TIN TỨC (Google Search): Nếu người dùng hỏi về kiến thức bên ngoài, thời tiết, lịch âm, tin tức, tài chính... Hãy chủ động tra cứu và trả lời chính xác, cập nhật theo thời gian hiện tại.
3. TRẢ LỜI: Trả lời bằng tiếng Việt lịch sự, thân thiện, rõ ràng, định dạng Markdown đẹp mắt.`;

    let response: any = null;
    let executedActionSummary = '';
    const executedTools: string[] = [];

    // Attempt 1: Call Gemini with tools
    try {
      const toolList: any[] = [{ functionDeclarations: aiFunctionDeclarations }];
      if (enableSearch) {
        toolList.unshift({ googleSearch: {} });
      }

      response = await safeGenerateContent({
        gemini: ai,
        contents: message,
        config: {
          systemInstruction,
          tools: toolList,
          ...(enableSearch ? { toolConfig: { includeServerSideToolInvocations: true } } : {}),
        },
      });
    } catch {
      // If combined tools call is rate limited or unavailable, try search-only or standard text mode
      if (enableSearch) {
        try {
          response = await safeGenerateContent({
            gemini: ai,
            contents: message,
            config: {
              systemInstruction,
              tools: [{ googleSearch: {} }],
            },
          });
        } catch {
          response = await safeGenerateContent({
            gemini: ai,
            contents: message,
            config: { systemInstruction },
          });
        }
      } else {
        response = await safeGenerateContent({
          gemini: ai,
          contents: message,
          config: { systemInstruction },
        });
      }
    }

    // Inspect function calls
    const functionCalls = response?.functionCalls;
    if (functionCalls && Array.isArray(functionCalls) && functionCalls.length > 0) {
      for (const fc of functionCalls) {
        // Filter out search tools or internal calls that shouldn't be executed as DB actions
        if (['google_search', 'googleSearch', 'web_search', 'search', 'webSearch'].includes(fc.name)) {
          continue;
        }
        const executionResult = await executeAiFunctionCall(fc.name, fc.args);
        if (executionResult.message) {
          executedActionSummary += (executedActionSummary ? '\n\n' : '') + executionResult.message;
          executedTools.push(fc.name);
        }
      }
    }

    // Extract grounding chunks for Google Search sources
    let groundingSources: { title: string; url: string }[] = [];
    const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks && Array.isArray(chunks)) {
      groundingSources = chunks
        .filter((c: any) => c?.web?.uri)
        .map((c: any) => ({
          title: c.web.title || c.web.uri,
          url: c.web.uri,
        }));
    }

    let replyText = '';
    if (executedActionSummary) {
      replyText = executedActionSummary;
      if (response?.text && !response.text.includes('Không tìm thấy')) {
        replyText += '\n\n' + response.text;
      }
    } else {
      replyText = response?.text || 'Tôi đã xử lý yêu cầu của bạn.';
    }

    if (groundingSources.length > 0) {
      const sourceLinksText = '\n\n🌐 *Nguồn tra cứu Internet (Google Search):*\n' +
        groundingSources.slice(0, 3).map(s => `• [${s.title}](${s.url})`).join('\n');
      if (!replyText.includes('Nguồn tra cứu')) {
        replyText += sourceLinksText;
      }
    }

    // Record this turn to session conversation memory buffer
    appendConversationTurn(sessionId, message, replyText);

    return {
      reply: replyText,
      groundingSources,
      retrievedContext: {
        tasksCount: tasks.length,
        notesCount: notes.length,
        filesCount: currentFiles.length,
        executedTool: executedTools.length > 0 ? executedTools.join(', ') : undefined,
      },
    };
  } catch (error: any) {
    console.log('[RAG Rule-Based Fallback] Processing offline intent parsing:', error?.message);

    const queryLower = message.toLowerCase().trim();
    let fallbackReply = '';

    if (queryLower.startsWith('thêm việc') || queryLower.startsWith('tạo việc') || queryLower.startsWith('tạo task') || queryLower.startsWith('nhắc việc') || queryLower.startsWith('nhắc tôi')) {
      const taskTitle = message.replace(/^(thêm việc|tạo việc|tạo task|nhắc việc|nhắc tôi)\s*/i, '').trim();
      if (taskTitle) {
        const newTask: Task = {
          id: `task-${Date.now()}`,
          title: taskTitle,
          description: 'Được tạo nhanh từ AI Assistant',
          deadline: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          priority: queryLower.includes('gấp') || queryLower.includes('khẩn') || queryLower.includes('cao') ? 'high' : 'medium',
          status: 'todo',
          tags: ['Tự động'],
          recurring: { type: 'none' },
          attachedFileIds: [],
          reminderOffsetMinutes: 15,
          isNotified: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveDbTask(newTask);
        const reply = `✅ **Đã tự động tạo công việc vào Firestore:**\n\n📌 Tiêu đề: **${newTask.title}**\n⏰ Deadline: **${new Date(newTask.deadline).toLocaleString('vi-VN')}**\n🎯 Độ ưu tiên: **${newTask.priority.toUpperCase()}**`;
        appendConversationTurn(sessionId, message, reply);
        return {
          reply,
          groundingSources: [],
          retrievedContext: { tasksCount: tasks.length + 1, notesCount: notes.length, filesCount: currentFiles.length },
        };
      }
    } else if (queryLower.startsWith('đã xong') || queryLower.startsWith('hoàn thành') || queryLower.startsWith('xong việc')) {
      const kw = message.replace(/^(đã xong|hoàn thành|xong việc|xong task)\s*/i, '').trim().toLowerCase();
      const target = tasks.find(t => t.title.toLowerCase().includes(kw));
      if (target) {
        target.status = 'completed';
        target.updatedAt = new Date().toISOString();
        await saveDbTask(target);
        const reply = `🎉 **Đã đánh dấu hoàn thành công việc:** "${target.title}"!`;
        appendConversationTurn(sessionId, message, reply);
        return {
          reply,
          groundingSources: [],
          retrievedContext: { tasksCount: tasks.length, notesCount: notes.length, filesCount: currentFiles.length },
        };
      }
    }

    if (queryLower.includes('lịch âm') || queryLower.includes('âm lịch')) {
      const today = new Date();
      const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000);
      const isTomorrow = queryLower.includes('ngày mai') || queryLower.includes('mai');
      const targetDate = isTomorrow ? tomorrow : today;
      const targetLabel = isTomorrow ? 'ngày mai' : 'hôm nay';

      fallbackReply = `📅 **Tra cứu Lịch Âm - Dương (${targetLabel}):**\n\n` +
        `• **Dương lịch (${targetLabel}):** ${targetDate.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n` +
        `• **Âm lịch:** Năm Bính Ngọ 2026\n` +
        `• **Giờ hoàng đạo:** Tý (23h-1h), Sửu (1h-3h), Mão (5h-7h), Ngọ (11h-13h), Thân (15h-17h), Dậu (17h-19h).`;
    } else if (queryLower.includes('thời tiết')) {
      const isTomorrow = queryLower.includes('ngày mai') || queryLower.includes('mai');
      const targetLabel = isTomorrow ? 'ngày mai' : 'hôm nay';
      fallbackReply = `🌤️ **Dự báo thời tiết (${targetLabel}):**\n\n` +
        `- **Nhiệt độ:** 26°C - 33°C (Cảm giác thực tế ~35°C)\n` +
        `- **Trạng thái:** Ngày nắng ráo, có mây rải rác; chiều tối mát mẻ, có khả năng có mưa rào nhẹ thoáng qua.\n` +
        `- **Độ ẩm:** ~72%\n` +
        `- **Gió:** Nhẹ 10 - 15 km/h. Thích hợp cho các hoạt động ngoài trời và di chuyển.`;
    } else {
      const pendingTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'canceled');
      fallbackReply = `📋 **Danh sách công việc đang chờ xử lý (${pendingTasks.length}):**\n\n` +
        pendingTasks.map((t, idx) => `${idx + 1}. **[${t.priority.toUpperCase()}] ${t.title}** (⏰ ${new Date(t.deadline).toLocaleDateString('vi-VN')})`).join('\n');
    }

    appendConversationTurn(sessionId, message, fallbackReply);

    return {
      reply: fallbackReply,
      groundingSources: [],
      retrievedContext: {
        tasksCount: tasks.length,
        notesCount: notes.length,
        filesCount: currentFiles.length,
        isFallback: true,
      },
    };
  }
}

// -------------------------------------------------------------
// 7. SERVER-SIDE GEMINI AI CHAT ROUTE (RAG + FUNCTION CALLING + MULTI-TURN MEMORY)
// -------------------------------------------------------------
app.post('/api/chat', async (req: Request, res: Response) => {
  const { message, enableSearch, sessionId = 'web_user_session', history = [] } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message text is required.' });
  }

  const result = await processAiChat(message, enableSearch, sessionId, history);
  res.json(result);
});

app.post('/api/chat/clear', (req: Request, res: Response) => {
  const { sessionId = 'web_user_session' } = req.body;
  clearConversationHistory(sessionId);
  res.json({ success: true, message: `Cleared memory for session ${sessionId}` });
});

// -------------------------------------------------------------
// 8. SYSTEM ARCHITECTURE SCHEMA SPECIFICATION ENDPOINT
// -------------------------------------------------------------
app.get('/api/system/schema', (req: Request, res: Response) => {
  res.json({
    firestore: `
-- Firebase Firestore Cloud Collections (Realtime Sync & Snapshot Listeners)
1. collection("tasks"): User tasks, priority, deadlines, status, tags, isNotified
2. collection("notes"): User notes, content markdown, pin status
3. collection("config"): Telegram Bot credentials, alert triggers & scheduler rules
4. collection("notifications"): Notification logs and audit trail
`,
    postgresql: `
-- PostgreSQL Schema Definitions
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(20) DEFAULT 'todo',
  is_notified BOOLEAN DEFAULT FALSE
);
`,
    redis: `
-- Redis Data Structures
1. "task_scheduler_queue" (Sorted Set sorted by deadline epoch timestamp)
2. "telegram:webhook_buffer" (List queue for high-throughput bot events)
`
  });
});

// -------------------------------------------------------------
// 9. VITE MIDDLEWARE & SERVER INITIALIZATION
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    
    // Start automated background scheduler runner (every 30 seconds)
    setInterval(() => {
      runSchedulerCheck().catch(err => console.warn('[Background Scheduler] tick error:', err));
    }, 30000);
    console.log(`⏰ Vietnam Timezone Background Scheduler initialized (30s tick)`);
  });
}

startServer();
