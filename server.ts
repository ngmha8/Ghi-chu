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
import { Task, Note, DriveFile, TelegramConfig, NotificationLog, DriveServiceAccountConfig, AiMemoryFact, AiLearningInsight, AiLearningStats } from './src/types/index.ts';
import {
  initializeFirestoreData,
  getDbTasks,
  saveDbTask,
  deleteDbTask,
  getDbNotes,
  saveDbNote,
  deleteDbNote,
  getDbCategories,
  saveDbCategories,
  saveDbCategory,
  deleteDbCategory,
  getDbFiles,
  saveDbFile,
  deleteDbFile,
  getDbTelegramConfig,
  saveDbTelegramConfig,
  getDbNotificationLogs,
  addDbNotificationLog,
  getDbDriveServiceAccountConfig,
  saveDbDriveServiceAccountConfig,
  getDbSecurityPinConfig,
  getDbSecurityPin,
  saveDbSecurityPin,
  saveDbSecurityPinSettings,
  verifyDbSecurityPin,
  getConversationHistory,
  appendConversationTurn,
  clearConversationHistory,
  getDbAiMemories,
  getActiveDbAiMemories,
  saveDbAiMemory,
  deleteDbAiMemory,
  getDbAiInsights,
  saveDbAiInsight,
  deleteDbAiInsight,
  getDbAiLearningStats,
  cachedTasks,
  cachedNotes,
  cachedFiles,
  cachedTelegramConfig,
  cachedNotificationLogs,
  cachedDriveServiceAccountConfig,
  cachedAiMemories,
  cachedAiInsights
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
  synthesizeLearnedPromptContext,
  triggerPassiveLearningExtraction,
  runAutonomousCognitiveReflection
} from './server/aiLearningEngine.ts';
import {
  sendTelegramMessage,
  sendTelegramChatAction,
  answerCallbackQuery,
  buildTaskReminderKeyboard,
  buildTaskListKeyboard,
  setTelegramBotCommands,
  deleteTelegramWebhook,
  getTelegramWebhookInfo,
  TelegramInlineKeyboard
} from './server/telegramHelper.ts';
import {
  processTelegramUpdate,
  startTelegramPollingDaemon,
  stopTelegramPollingDaemon,
  TelegramEngineContext
} from './server/telegramBotEngine.ts';
import { transcribeTelegramVoice, transcribeAudioBuffer } from './server/voiceTranscriber.ts';
import { generateDailyBriefing } from './server/dailyBriefing.ts';
import { safeGenerateContent, GEMINI_MODEL_FALLBACK_CHAIN } from './server/geminiHelper.ts';
import { fetchLiveWeather } from './server/weatherService.ts';

const _dirname = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
const UPLOADS_DIR = path.join(_dirname, 'data', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch (e) {}
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(process.cwd(), 'public')));

// Explicit Favicon Routes
app.get('/favicon.svg', (req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), 'public', 'favicon.svg'));
});

app.get('/favicon.ico', (req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), 'public', 'favicon.svg'), {
    headers: { 'Content-Type': 'image/svg+xml' }
  });
});

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
// 2.5 DOCUMENT CATEGORIES API ROUTES (PERSISTED ON SERVER/STORAGE)
// -------------------------------------------------------------
app.get('/api/categories', async (req: Request, res: Response) => {
  const categories = await getDbCategories();
  res.json(categories);
});

app.post('/api/categories', async (req: Request, res: Response) => {
  if (Array.isArray(req.body)) {
    const savedList = await saveDbCategories(req.body);
    return res.json(savedList);
  }
  const newCat = {
    id: req.body.id || `cat-${Date.now()}`,
    name: req.body.name || 'Phân loại mới',
    color: req.body.color || 'emerald',
    icon: req.body.icon || 'Tag',
    description: req.body.description || '',
    isDefault: req.body.isDefault ?? false,
  };
  const saved = await saveDbCategory(newCat);
  res.status(201).json(saved);
});

app.put('/api/categories/:id', async (req: Request, res: Response) => {
  const catId = req.params.id;
  const currentCats = await getDbCategories();
  const existing = currentCats.find(c => c.id === catId);
  const updated = {
    ...(existing || { id: catId, color: 'emerald', icon: 'Tag', isDefault: false }),
    ...req.body,
    id: catId,
  };
  const saved = await saveDbCategory(updated);
  res.json(saved);
});

app.delete('/api/categories/:id', async (req: Request, res: Response) => {
  const catId = req.params.id;
  await deleteDbCategory(catId);
  res.json({ success: true, id: catId });
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
// 3.4. CENTRALIZED SECURITY PIN API ROUTES (CROSS-DEVICE & RENDER)
// -------------------------------------------------------------
app.get('/api/security/pin', async (_req: Request, res: Response) => {
  try {
    const config = await getDbSecurityPinConfig();
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi đọc cấu hình mã PIN' });
  }
});

app.post('/api/security/verify-pin', async (req: Request, res: Response) => {
  try {
    const { pin } = req.body;
    const isValid = await verifyDbSecurityPin(pin);
    const config = await getDbSecurityPinConfig();
    res.json({ isValid, isEnabled: config.isEnabled });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi kiểm tra mã PIN' });
  }
});

app.put('/api/security/pin', async (req: Request, res: Response) => {
  try {
    const { newPin, pin, hint, oldPin } = req.body;
    const targetPin = (newPin || pin || '').toString().trim();
    if (!targetPin || targetPin.length < 4) {
      return res.status(400).json({ error: 'Mã PIN bảo mật phải có từ 4 đến 8 chữ số' });
    }

    const currentConfig = await getDbSecurityPinConfig();
    if (oldPin !== undefined && currentConfig.hasCustomPin) {
      const isOldValid = await verifyDbSecurityPin(oldPin);
      if (!isOldValid) {
        return res.status(401).json({ error: 'Mã PIN hiện tại không chính xác' });
      }
    }

    const updated = await saveDbSecurityPin(targetPin, hint);
    res.json({
      success: true,
      message: 'Đã cập nhật mã PIN bảo mật thành công cho toàn bộ hệ thống',
      settings: {
        isEnabled: updated.isEnabled,
        hasCustomPin: updated.pin !== '1234',
        autolockMinutes: updated.autolockMinutes,
        hint: updated.hint,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lưu mã PIN' });
  }
});

app.put('/api/security/pin/settings', async (req: Request, res: Response) => {
  try {
    const { isEnabled, autolockMinutes, hint } = req.body;
    const updates: any = {};
    if (isEnabled !== undefined) updates.isEnabled = Boolean(isEnabled);
    if (autolockMinutes !== undefined) updates.autolockMinutes = Number(autolockMinutes);
    if (hint !== undefined) updates.hint = String(hint).trim();

    const updated = await saveDbSecurityPinSettings(updates);
    res.json({
      success: true,
      message: 'Đã lưu cài đặt bảo mật thành công',
      settings: {
        isEnabled: updated.isEnabled,
        hasCustomPin: updated.pin !== '1234',
        autolockMinutes: updated.autolockMinutes,
        hint: updated.hint,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi cập nhật cài đặt bảo mật' });
  }
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

// Helper for Telegram Engine Context
function getTelegramEngineContext(): TelegramEngineContext {
  return {
    gemini: getGeminiClient(),
    uploadsDir: UPLOADS_DIR,
    processAiChat: (message, enableSearch, sessionId, history) =>
      processAiChat(message, enableSearch, sessionId, history),
  };
}

// Telegram Bot Webhook Handler (Immediate 200 OK + Async AI Processing to prevent Telegram Retry Loops)
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

  // Acknowledge Telegram API immediately to satisfy the 5-second Webhook timeout
  res.status(200).json({ ok: true });

  // Process update asynchronously in the background
  const updateBody = req.body || {};
  processTelegramUpdate(updateBody, getTelegramEngineContext()).catch(err => {
    console.warn('[Telegram Webhook Async Processing Error]:', err);
  });
});

// -------------------------------------------------------------
// WEB APP VOICE RECOGNITION & MULTIMODAL DICTATION API
// -------------------------------------------------------------
app.post('/api/voice/transcribe', async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType = 'audio/webm' } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: 'Thiếu dữ liệu âm thanh (audioBase64).' });
    }

    const buffer = Buffer.from(audioBase64, 'base64');
    const ai = getGeminiClient();
    const transcribedText = await transcribeAudioBuffer(buffer, mimeType, ai);

    res.json({
      success: true,
      text: transcribedText,
    });
  } catch (err: any) {
    console.error('API voice transcribe error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Lỗi nhận diện âm thanh',
    });
  }
});

app.post('/api/voice/process-ai', async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType = 'audio/webm', enableSearch = true, sessionId = 'web_voice' } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: 'Thiếu dữ liệu âm thanh (audioBase64).' });
    }

    const buffer = Buffer.from(audioBase64, 'base64');
    const ai = getGeminiClient();
    const transcribedText = await transcribeAudioBuffer(buffer, mimeType, ai);

    if (!transcribedText || transcribedText.trim().length === 0) {
      return res.json({
        success: false,
        error: 'Không nhận diện được giọng nói trong bản ghi âm.',
      });
    }

    const aiResult = await processAiChat(transcribedText, enableSearch, sessionId);

    res.json({
      success: true,
      transcript: transcribedText,
      reply: aiResult.reply,
      groundingSources: aiResult.groundingSources || [],
    });
  } catch (err: any) {
    console.error('API voice process-ai error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Lỗi xử lý âm thanh AI',
    });
  }
});

// Set Bot Quick-Command Menu (/) on Telegram API
app.post('/api/telegram/set-commands', async (req: Request, res: Response) => {
  const telegramConfig = await getDbTelegramConfig();
  if (!telegramConfig.botToken) {
    return res.status(400).json({ error: 'Chưa cấu hình Telegram Bot Token.' });
  }
  const success = await setTelegramBotCommands(telegramConfig.botToken);
  res.json({
    success,
    message: success
      ? 'Đã cấu hình danh sách lệnh nhanh (/) thành công trên máy chủ Telegram!'
      : 'Không thể cập nhật danh sách lệnh lên Telegram',
  });
});

// Delete Webhook and switch to Automatic Background Long Polling
app.post('/api/telegram/delete-webhook', async (req: Request, res: Response) => {
  const telegramConfig = await getDbTelegramConfig();
  if (!telegramConfig.botToken) {
    return res.status(400).json({ error: 'Chưa cấu hình Telegram Bot Token.' });
  }
  const deleted = await deleteTelegramWebhook(telegramConfig.botToken);
  await saveDbTelegramConfig({
    webhookUrl: '',
    webhookSecret: '',
  });
  // Trigger long polling
  startTelegramPollingDaemon(getTelegramEngineContext());
  res.json({
    success: deleted,
    message: 'Đã hủy Webhook. Hệ thống tự động chuyển sang chế độ Long-Polling tức thì.',
  });
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

// Helper function for unified AI Chat handling with Intent Classification, Function Calling, Live Weather & Multi-Model AI
async function processAiChat(
  message: string,
  enableSearch: boolean = true,
  sessionId: string = 'default_session',
  providedHistory: { role: string; content: string }[] = []
) {
  const tasks = await getDbTasks();
  const notes = await getDbNotes();
  const currentFiles = await getDbFiles();

  const currentTimeIso = new Date().toISOString();
  const telegramConfig = await getDbTelegramConfig();
  const timeZone = telegramConfig.timezone || 'Asia/Ho_Chi_Minh';
  const vnDate = new Date();
  const vnTimeStr = vnDate.toLocaleString('vi-VN', {
    timeZone,
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const queryLower = message.toLowerCase().trim();

  // -------------------------------------------------------------
  // TIER 1: LIVE WEATHER INTENT ROUTING
  // -------------------------------------------------------------
  if (
    queryLower.includes('thời tiết') ||
    queryLower.includes('thoi tiet') ||
    queryLower.includes('dự báo thời tiết') ||
    queryLower.includes('nhiệt độ') ||
    queryLower.includes('nhiet do') ||
    queryLower.includes('trời mưa') ||
    queryLower.includes('có mưa không') ||
    queryLower.includes('troi nang') ||
    queryLower.startsWith('/weather')
  ) {
    try {
      const isTomorrow = queryLower.includes('ngày mai') || queryLower.includes('ngay mai') || queryLower.includes('mai');
      const weatherData = await fetchLiveWeather(message, isTomorrow);
      const dayLabel = isTomorrow ? 'ngày mai' : 'hôm nay';

      // Ask Gemini to synthesize rich, human-like advice based on live weather data
      try {
        const ai = getGeminiClient();
        const weatherPrompt = `Bạn là Trợ lý AI Cố Vấn Điều Hành Cao Cấp (Senior AI Executive Companion). Dưới đây là dữ liệu thời tiết THỰC TẾ TRỰC TIẾP tại ${weatherData.city} cho ${dayLabel}:\n` +
          `- Nhiệt độ: ${weatherData.minTemp}°C - ${weatherData.maxTemp}°C (Hiện tại: ${weatherData.temperature}°C, Cảm giác: ${weatherData.apparentTemperature}°C)\n` +
          `- Tình trạng: ${weatherData.condition}\n` +
          `- Độ ẩm: ${weatherData.humidity}%\n` +
          `- Khả năng mưa: ${weatherData.precipitationProb}%\n` +
          `- Gió: ${weatherData.windSpeed} km/h\n` +
          `- Chỉ số UV: ${weatherData.uvIndex}\n\n` +
          `Yêu cầu: Hãy đóng vai một người bạn đồng hành thông minh, tinh tế và ân cần, viết phản hồi bằng tiếng Việt thân thiện, súc tích, định dạng Markdown đẹp mắt gửi trên Telegram/Web. ` +
          `Bao gồm: bảng tóm tắt thời tiết (${weatherData.icon}), đánh giá điều kiện ngoài trời, và 2-3 lời khuyên thiết thực (trang phục, mang ô/áo mưa, che chắn UV, di chuyển, giữ gìn sức khỏe).`;

        const weatherRes = await safeGenerateContent({
          gemini: ai,
          contents: weatherPrompt,
        });

        if (weatherRes?.text && weatherRes.text.trim().length > 30) {
          const reply = weatherRes.text.trim();
          appendConversationTurn(sessionId, message, reply);
          return {
            reply,
            groundingSources: [],
            retrievedContext: { isWeather: true, city: weatherData.city },
          };
        }
      } catch (geminiErr: any) {
        console.warn('[AI Weather Synthesis] Fallback to direct meteorological report:', geminiErr?.message);
      }

      // Direct meteorological report fallback (zero-dependency, always works)
      const directReply = weatherData.summary +
        `\n\n💡 **Lời khuyên từ Trợ Lý AI:**\n` +
        `• ${weatherData.precipitationProb > 40 ? '⚠️ Khả năng có mưa cao, bạn nhớ mang theo áo mưa hoặc ô (dù) khi ra ngoài.' : '☀️ Thời tiết thuận lợi cho các hoạt động ngoài trời.'}\n` +
        `• ${weatherData.temperature >= 32 ? '🥤 Nhiệt độ khá cao và oi bức, hãy uống nhiều nước và che chắn cẩn thận khi ra đường.' : '🍃 Không khí tương đối dễ chịu và thoáng đãng.'}`;

      appendConversationTurn(sessionId, message, directReply);
      return {
        reply: directReply,
        groundingSources: [],
        retrievedContext: { isWeather: true, city: weatherData.city },
      };
    } catch (e: any) {
      console.warn('Live weather error:', e);
    }
  }

  // -------------------------------------------------------------
  // TIER 2: LUNAR CALENDAR / ÂM LỊCH INTENT ROUTING
  // -------------------------------------------------------------
  if (
    queryLower.includes('lịch âm') ||
    queryLower.includes('lich am') ||
    queryLower.includes('âm lịch') ||
    queryLower.includes('am lich') ||
    queryLower.includes('ngày hoàng đạo') ||
    queryLower.includes('giờ hoàng đạo')
  ) {
    const today = new Date();
    const isTomorrow = queryLower.includes('ngày mai') || queryLower.includes('mai');
    const targetDate = isTomorrow ? new Date(today.getTime() + 24 * 3600 * 1000) : today;
    const targetLabel = isTomorrow ? 'ngày mai' : 'hôm nay';

    const lunarReply = `📅 **TRA CỨU LỊCH VẠN NIÊN - ÂM DƯƠNG (${targetLabel.toUpperCase()}):**\n\n` +
      `• **Dương lịch:** ${targetDate.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })}\n` +
      `• **Năm âm lịch:** Bính Ngọ 2026\n` +
      `• **Trực:** Khai (Thuận lợi cho khởi công, xuất hành, đàm phán, giao dịch)\n` +
      `• **Giờ hoàng đạo:** Tý (23h-1h), Sửu (1h-3h), Mão (5h-7h), Ngọ (11h-13h), Thân (15h-17h), Dậu (17h-19h)\n` +
      `• **Giờ hắc đạo:** Dần (3h-5h), Thìn (7h-9h), Tỵ (9h-11h), Mùi (13h-15h), Tuất (19h-21h), Hợi (21h-23h)\n\n` +
      `💡 **Lời khuyên:** Khung giờ Mão (5h-7h) hoặc Ngọ (11h-13h) rất tốt để triển khai công việc quan trọng nhằm đạt kết quả hanh thông và thuận lợi nhất!`;

    appendConversationTurn(sessionId, message, lunarReply);
    return {
      reply: lunarReply,
      groundingSources: [],
      retrievedContext: { isLunar: true },
    };
  }

  // -------------------------------------------------------------
  // TIER 3: AUTONOMOUS ADVANCED AI COGNITIVE LAYER & FIRESTORE RAG
  // -------------------------------------------------------------
  try {
    const ai = getGeminiClient();

    // Helper to format full deadline in Vietnamese
    const formatDeadlineForAi = (dateStr: string) => {
      if (!dateStr) return 'Không có hạn chót';
      const d = new Date(dateStr);
      const time = d.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false });
      const weekday = d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long' });
      const date = d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });
      return `${time} ${weekday}, ${date}`;
    };

    // RAG Context Retrieval from internal Firestore data
    const tasksContext = tasks.map(t => `- [ID: ${t.id}] [${t.priority.toUpperCase()}] "${t.title}" | Hạn chót chính thức: ${formatDeadlineForAi(t.deadline)} (ISO: ${t.deadline}) | Trạng thái: ${t.status} | Tags: ${(t.tags || []).join(',')}`).join('\n');
    const notesContext = notes.map(n => `- [ID: ${n.id}] Ghi chú: "${n.title}" | Tags: ${(n.tags || []).join(',')} | Nội dung: ${n.content.slice(0, 200)}...`).join('\n');
    const filesContext = currentFiles.map(f => `- File: ${f.name} [Phân loại: ${f.classification || 'Chưa phân loại'}] [Định dạng: ${f.category}] | Link: ${f.webViewLink || 'Lưu cục bộ'}`).join('\n');

    // Retrieve active conversation history for this session (multi-turn memory)
    const storedHistory = getConversationHistory(sessionId);
    const activeHistory = providedHistory.length > 0 ? providedHistory : storedHistory;
    const historySnippet = activeHistory.length > 0
      ? activeHistory.slice(-8).map(h => `${h.role === 'user' ? 'Người dùng' : 'Trợ lý AI'}: ${h.content}`).join('\n')
      : '';

    // Autonomous Continuous Learning & Memory Synthesis
    const learnedMemoryContext = await synthesizeLearnedPromptContext();

    const systemInstruction = `Bạn là Trợ Lý Điều Hành Cấp Cao & Bạn Đồng Hành Trí Tuệ (Senior Executive Assistant & Cognitive Partner).
Bạn sở hữu năng lực phân tích xuất sắc của một chuyên gia công nghệ và cố vấn quản trị hơn 20 năm kinh nghiệm, với phong cách làm việc chuyên nghiệp, chu đáo, tinh gọn và chuẩn xác tuyệt đối.

HỆ THỐNG DỮ LIỆU ĐANG KẾT NỐI (FIRESTORE CLOUD PERSISTENCE):
- Thời điểm hiện tại (Việt Nam UTC+7): ${vnTimeStr} (${timeZone})
- Timestamp ISO chuẩn: ${currentTimeIso}

${learnedMemoryContext ? `${learnedMemoryContext}\n\n` : ''}=== DANH SÁCH CÔNG VIỆC TRONG FIRESTORE (TASKS) ===
${tasksContext || 'Chưa có công việc nào.'}

=== DANH SÁCH GHI CHÚ (NOTES) ===
${notesContext || 'Chưa có ghi chú nào.'}

=== KHO TÀI LIỆU & TỆP TIN (FILES) ===
${filesContext || 'Chưa có tệp tin nào.'}

${historySnippet ? `=== LỊCH SỬ HỘI THOẠI GẦN ĐÂY ===\n${historySnippet}\n` : ''}

QUY TẮC PHẢN HỒI BẮT BUỘC (EXECUTIVE STANDARD):
1. **Phong cách Trợ lý Điều hành Thực thụ (Concise & Executive Tone)**:
   - Trả lời ngắn gọn, súc tích, đi thẳng vào trọng tâm, có cấu trúc rõ ràng (bullet points, in đậm từ khóa).
   - Tuyệt đối TRÁNH các câu văn hoa sáo rỗng, triết lý dài dòng, ví von cảm xúc quá đà (như "hoàng hôn buông xuống", "chiếc tích xanh", "nhịp lặng tích lũy").
   - Xưng hô lịch thiệp, tôn trọng và tự nhiên như một Trợ lý điều hành đắc lực.
2. **CHÍNH XÁC TUYỆT ĐỐI VỀ HẠN CHÓT & THỜI GIAN (DEADLINE ACCURACY)**:
   - Khi liệt kê hoặc nhắc đến công việc, BẮT BUỘC phải ghi rõ cả Thứ, Ngày/Tháng và Giờ hạn chót chính xác (Ví dụ: "16:00 Thứ Sáu, 28/08/2026").
   - Tuyệt đối KHÔNG viết mập mờ chỉ có giờ (ví dụ "Hạn chót: 16:00") khi nói về kế hoạch ngày mai nếu việc đó thực chất có hạn chót vào ngày khác (như 28/08).
   - Nếu bạn muốn gợi ý người dùng chuẩn bị trước cho một công việc của các ngày sau, phải ghi rõ ràng: "💡 Gợi ý chuẩn bị trước (Hạn chót chính thức: 16:00 Thứ Sáu, 28/08)".
3. **Cố Vấn Toàn Năng & Giải Pháp Hành Động (Actionable & Deep Reasoning)**:
   - Sẵn sàng giải đáp kỹ thuật, quản lý công việc, logic, chiến lược với các bước thực thi rõ ràng (Actionable Insights).
4. **Thực thi Hành động Tự động (Autonomous Function Calling & Memory)**:
   - Khi người dùng muốn tạo việc, nhắc việc, hoàn thành, xóa, ghi chú, tìm tài liệu: hãy gọi ngay các Tool tương ứng (\`createTask\`, \`completeTask\`, \`deleteTask\`, \`createNote\`, \`queryNotes\`, \`queryTasks\`, \`queryFiles\`).
   - Khi người dùng muốn AI ghi nhớ thông tin/sở thích/quy tắc/thói quen, hãy gọi ngay tool \`rememberUserFact\` hoặc \`forgetUserFact\`.
   - Căn cứ vào giờ Việt Nam (UTC+7) để tính toán chính xác deadline khi thêm công việc.
5. **Trình bày Chuẩn mực**:
   - Sử dụng định dạng Markdown tinh gọn, dễ đọc trên cả máy tính lẫn điện thoại Telegram.`;

    let response: any = null;
    let executedActionSummary = '';
    const executedTools: string[] = [];

    // Check if the user query suggests an action or tool invocation
    const isActionIntent =
      queryLower.startsWith('thêm') ||
      queryLower.startsWith('them') ||
      queryLower.startsWith('tạo') ||
      queryLower.startsWith('tao') ||
      queryLower.startsWith('nhắc') ||
      queryLower.startsWith('nhac') ||
      queryLower.startsWith('xong') ||
      queryLower.startsWith('đã xong') ||
      queryLower.startsWith('da xong') ||
      queryLower.startsWith('hoàn thành') ||
      queryLower.startsWith('hoan thanh') ||
      queryLower.startsWith('xóa') ||
      queryLower.startsWith('xoa') ||
      queryLower.startsWith('lưu') ||
      queryLower.startsWith('luu') ||
      queryLower.startsWith('ghi') ||
      queryLower.includes('danh sách việc') ||
      queryLower.includes('xem việc') ||
      queryLower.includes('tìm file') ||
      queryLower.includes('tìm tài liệu') ||
      queryLower.includes('tra cứu ghi chú') ||
      queryLower.includes('hãy nhớ') ||
      queryLower.includes('nhớ rằng') ||
      queryLower.includes('ghi nhớ') ||
      queryLower.includes('từ nay') ||
      queryLower.includes('quên') ||
      queryLower.includes('xóa ký ức') ||
      queryLower.includes('bộ nhớ') ||
      queryLower.includes('tự học');

    if (isActionIntent) {
      try {
        response = await safeGenerateContent({
          gemini: ai,
          contents: message,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: aiFunctionDeclarations }],
          },
        });
      } catch (err: any) {
        console.warn('[Tool Calling Fallback] Falling back to standard generation:', err?.message);
        response = await safeGenerateContent({
          gemini: ai,
          contents: message,
          config: { systemInstruction },
        });
      }
    } else if (enableSearch && (queryLower.includes('tìm kiếm') || queryLower.includes('tin tức') || queryLower.includes('mới nhất') || queryLower.includes('giá') || queryLower.includes('search') || queryLower.includes('hôm nay có gì'))) {
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
      // General conversation, reasoning, emotional intelligence & Q&A
      response = await safeGenerateContent({
        gemini: ai,
        contents: message,
        config: { systemInstruction },
      });
    }

    // Inspect function calls
    const functionCalls = response?.functionCalls;
    if (functionCalls && Array.isArray(functionCalls) && functionCalls.length > 0) {
      for (const fc of functionCalls) {
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

    let replyText = '';
    const rawAiText = response?.text?.trim() || '';

    // Extract grounding sources if available
    const groundingSources: { title: string; url: string }[] = [];
    if (response?.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      for (const chunk of response.candidates[0].groundingMetadata.groundingChunks) {
        if (chunk.web?.uri && chunk.web?.title) {
          groundingSources.push({
            title: chunk.web.title,
            url: chunk.web.uri,
          });
        }
      }
    }

    if (executedActionSummary) {
      replyText = executedActionSummary;
      if (rawAiText && !rawAiText.includes('Không tìm thấy') && rawAiText.length > 10) {
        replyText += '\n\n' + rawAiText;
      }
    } else if (rawAiText) {
      replyText = rawAiText;
    }

    // If still empty or no text produced, build thoughtful personalized fallback
    if (!replyText || replyText.trim().length === 0) {
      const pendingTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'canceled');
      replyText = `🌟 **Chào bạn! Tôi luôn ở đây để đồng hành cùng bạn:**\n\n` +
        `Tôi đã lắng nghe chia sẻ của bạn: _"${message}"_.\n\n` +
        `📋 Hiện tại hệ thống đang quản lý **${pendingTasks.length} công việc** và **${notes.length} ghi chú** của bạn.\n` +
        `💡 Bạn có thể trao đổi bất kỳ chủ đề nào, từ lập trình, giải quyết vấn đề, lên kế hoạch cho đến tâm sự giải tỏa căng thẳng!`;
    }

    // Record this turn to session conversation memory buffer
    appendConversationTurn(sessionId, message, replyText);

    // Asynchronously trigger Autonomous Meta-Cognitive Self-Learning in background
    triggerPassiveLearningExtraction(message, replyText, ai).catch(err => {
      console.warn('[AI Self-Learning Async Error]:', err?.message);
    });

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
    console.log('[RAG Offline Deterministic Engine] Executing offline intent resolution:', error?.message);

    let fallbackReply = '';

    if (queryLower.startsWith('thêm việc') || queryLower.startsWith('tạo việc') || queryLower.startsWith('tạo task') || queryLower.startsWith('nhắc việc') || queryLower.startsWith('nhắc tôi') || queryLower.startsWith('them viec')) {
      const taskTitle = message.replace(/^(thêm việc|tạo việc|tạo task|nhắc việc|nhắc tôi|them viec)\s*/i, '').trim();
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
        const reply = `✅ **Đã tự động tạo công việc vào Firestore:**\n\n📌 Tiêu đề: **${newTask.title}**\n⏰ Deadline: **${new Date(newTask.deadline).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}**\n🎯 Độ ưu tiên: **${newTask.priority.toUpperCase()}**\n\n_Chúc bạn thực hiện công việc thật suôn sẻ và hiệu quả!_`;
        appendConversationTurn(sessionId, message, reply);
        return {
          reply,
          groundingSources: [],
          retrievedContext: { tasksCount: tasks.length + 1, notesCount: notes.length, filesCount: currentFiles.length },
        };
      }
    } else if (queryLower.startsWith('đã xong') || queryLower.startsWith('hoàn thành') || queryLower.startsWith('xong việc') || queryLower.startsWith('da xong')) {
      const kw = message.replace(/^(đã xong|hoàn thành|xong việc|xong task|da xong)\s*/i, '').trim().toLowerCase();
      const target = tasks.find(t => t.title.toLowerCase().includes(kw));
      if (target) {
        target.status = 'completed';
        target.updatedAt = new Date().toISOString();
        await saveDbTask(target);
        const reply = `🎉 **Tuyệt vời! Đã ghi nhận hoàn thành:** "${target.title}"!\n\n_Bạn đã làm rất tốt, hãy tự thưởng cho mình một vài phút thư giãn nhé!_`;
        appendConversationTurn(sessionId, message, reply);
        return {
          reply,
          groundingSources: [],
          retrievedContext: { tasksCount: tasks.length, notesCount: notes.length, filesCount: currentFiles.length },
        };
      }
    }

    const pendingTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'canceled');
    fallbackReply = `🌟 **Trợ Lý AI Đồng Hành Cá Nhân:**\n\n` +
      `Tôi đã nhận được thông điệp từ bạn: _"${message}"_.\n\n` +
      `📋 **Danh sách công việc đang chờ (${pendingTasks.length}):**\n` +
      (pendingTasks.length > 0
        ? pendingTasks.slice(0, 5).map((t, idx) => `${idx + 1}. **[${t.priority.toUpperCase()}] ${t.title}** (⏰ ${new Date(t.deadline).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })})`).join('\n')
        : '_Không có công việc nào đang chờ._') +
      `\n\n💡 Bạn có thể trò chuyện, chia sẻ tâm tư, yêu cầu hỗ trợ kỹ thuật hoặc quản lý công việc bất cứ lúc nào!`;

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
// 7.1. AI AUTONOMOUS SELF-LEARNING & LONG-TERM MEMORY ENDPOINTS
// -------------------------------------------------------------
app.get('/api/ai/learning/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getDbAiLearningStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ai/learning/memories', async (req: Request, res: Response) => {
  try {
    const memories = await getDbAiMemories();
    res.json(memories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/learning/memories', async (req: Request, res: Response) => {
  try {
    const { fact, category = 'preference', confidence = 0.95 } = req.body;
    if (!fact || typeof fact !== 'string') {
      return res.status(400).json({ error: 'Nội dung sự thật/quy tắc (fact) là bắt buộc.' });
    }

    const newMemory: AiMemoryFact = {
      id: req.body.id || `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      category: ['preference', 'identity', 'rule', 'workflow', 'domain_knowledge', 'habit'].includes(category)
        ? category
        : 'preference',
      fact: fact.trim(),
      confidence: Number(confidence) || 0.95,
      source: req.body.source || 'explicit',
      occurrences: Number(req.body.occurrences) || 1,
      isActive: req.body.isActive !== false,
      createdAt: req.body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await saveDbAiMemory(newMemory);
    res.json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/ai/learning/memories/:id', async (req: Request, res: Response) => {
  try {
    await deleteDbAiMemory(req.params.id);
    res.json({ success: true, message: 'Đã xóa ký ức khỏi bộ nhớ dài hạn.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/ai/learning/memories/:id/toggle', async (req: Request, res: Response) => {
  try {
    const memories = await getDbAiMemories();
    const target = memories.find(m => m.id === req.params.id);
    if (!target) {
      return res.status(404).json({ error: 'Không tìm thấy ký ức.' });
    }

    target.isActive = !target.isActive;
    target.updatedAt = new Date().toISOString();
    await saveDbAiMemory(target);
    res.json(target);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ai/learning/insights', async (req: Request, res: Response) => {
  try {
    const insights = await getDbAiInsights();
    res.json(insights);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/learning/reflect', async (req: Request, res: Response) => {
  try {
    const aiClient = getGeminiClient();
    const result = await runAutonomousCognitiveReflection(aiClient);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
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

    // Start background Telegram Daemon (Auto-polling & Webhook listener)
    startTelegramPollingDaemon(getTelegramEngineContext()).catch(err => {
      console.warn('[Telegram Polling Daemon] startup notice:', err?.message || err);
    });
  });
}

startServer();
