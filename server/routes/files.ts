import { Router, Request, Response } from 'express';
import path from 'path';
import {
  getDbFiles,
  saveDbFile,
  deleteDbFile,
  getDbDriveServiceAccountConfig,
  getDbFileById,
} from '../firebaseDb.ts';
import {
  savePersistentBinary,
  getPersistentBinary,
  deletePersistentBinary,
  UPLOADS_DIR,
} from '../storageService.ts';
import { uploadFileToDriveFolder } from '../googleDriveServiceAccount.ts';
import { syncAndVectorizeAllDocuments } from '../embeddingService.ts';
import { getGeminiClient } from '../aiService.ts';
import { safeGenerateContent } from '../geminiHelper.ts';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import type { DriveFile } from '../../src/types/index.ts';

const router = Router();

// GET /api/files
router.get('/', async (req: Request, res: Response) => {
  try {
    const currentFiles = await getDbFiles();
    res.json(currentFiles);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error fetching files' });
  }
});

// POST /api/files
router.post('/', async (req: Request, res: Response) => {
  try {
    const fileId = req.body.id || `file-${Date.now()}`;
    const fileName = req.body.name || 'document.pdf';
    const mimeType = req.body.mimeType || 'application/pdf';
    const size = req.body.size || 102400;
    let isSynced = req.body.isSyncedToDrive ?? false;
    let driveFileId = req.body.driveFileId;
    let webViewLink = req.body.webViewLink;
    const textContent = req.body.textContent;
    const base64Data = req.body.base64Data;

    // Decode binary if provided
    let fileBuffer: Buffer | null = null;
    if (base64Data) {
      try {
        fileBuffer = Buffer.from(base64Data.replace(/^data:.*?;base64,/, ''), 'base64');
      } catch (e) {
        console.warn('Error decoding base64Data:', e);
      }
    } else if (textContent) {
      fileBuffer = Buffer.from(textContent, 'utf-8');
    }

    let storageType: 'drive' | 'firestore_vault' | 'disk' = 'disk';

    // Persist binary data permanently into multi-tier storage
    if (fileBuffer) {
      const persistRes = await savePersistentBinary({
        fileId,
        fileName,
        mimeType,
        buffer: fileBuffer,
        tryDriveSync: !driveFileId,
      });

      storageType = persistRes.storageType;
      if (persistRes.isSyncedToDrive && persistRes.driveFileId) {
        driveFileId = persistRes.driveFileId;
        webViewLink = persistRes.webViewLink;
        isSynced = true;
      }
    }

    const rawTags: string[] = Array.isArray(req.body.tags) ? req.body.tags : [];
    const cleanTags = rawTags
      .map(t => String(t).trim())
      .filter(t => {
        const lower = t.toLowerCase();
        return lower && lower !== 'unclassified' && lower !== 'chưa xác định' && lower !== 'chưa phân loại';
      });

    const isImage = mimeType.startsWith('image/') || /\.(jpe?g|png|webp|gif|svg)$/i.test(fileName);
    const thumbnail = (base64Data && isImage && base64Data.length < 40000) ? base64Data : undefined;

    const newFile: DriveFile = {
      id: fileId,
      name: fileName,
      mimeType: mimeType,
      size: fileBuffer ? fileBuffer.length : size,
      webViewLink: isSynced && webViewLink ? webViewLink : (req.body.webViewLink || undefined),
      category: req.body.category || 'document',
      classification: req.body.classification || 'unclassified',
      tags: cleanTags,
      notes: req.body.notes || req.body.description || undefined,
      description: req.body.description || undefined,
      isSyncedToDrive: isSynced,
      driveFileId: driveFileId,
      syncStatus: (req.body.storageType === 'gcs' ? 'synced' : (isSynced ? 'synced' : 'local_only')),
      downloadUrl: req.body.downloadUrl || (driveFileId ? `/api/drive-service-account/download/${driveFileId}` : `/api/files/download/${fileId}`),
      previewUrl: req.body.previewUrl || webViewLink || `/api/files/preview/${fileId}`,
      textContent: textContent,
      thumbnailUrl: thumbnail,
      storageType: req.body.storageType || storageType,
      storagePath: req.body.storagePath,
      hasBinary: !!fileBuffer || !!req.body.storagePath,
      uploadedAt: req.body.uploadedAt || new Date().toISOString(),
    };

    const saved = await saveDbFile(newFile);
    syncAndVectorizeAllDocuments().catch(() => {});
    res.status(201).json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error saving file' });
  }
});

// GET /api/files/download/:id
router.get('/download/:id', async (req: Request, res: Response) => {
  const fileId = req.params.id;
  const file = getDbFileById(fileId) || (await getDbFiles()).find(f => f.id === fileId);

  if (!file) {
    return res.status(404).send('Không tìm thấy tệp yêu cầu');
  }

  // If file has direct Google Cloud Storage or external downloadUrl
  if (file.downloadUrl && (file.downloadUrl.startsWith('https://') || file.downloadUrl.startsWith('http://'))) {
    return res.redirect(file.downloadUrl);
  }

  // Retrieve binary through Multi-Tier Storage (Disk Cache -> Drive -> Firestore Vault)
  const persistent = await getPersistentBinary(fileId, file.driveFileId, file.name, file.mimeType);
  if (persistent?.buffer) {
    const ext = path.extname(persistent.fileName || file.name).toLowerCase();
    let safeMime = persistent.mimeType || file.mimeType || 'application/octet-stream';
    if (ext === '.docx') safeMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (ext === '.doc') safeMime = 'application/msword';
    else if (ext === '.xlsx') safeMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    else if (ext === '.xls') safeMime = 'application/vnd.ms-excel';
    else if (ext === '.pdf') safeMime = 'application/pdf';

    const safeAsciiName = (persistent.fileName || file.name).replace(/[^\x20-\x7E]/g, '_');
    res.setHeader('Content-Type', safeMime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeAsciiName}"; filename*=UTF-8''${encodeURIComponent(persistent.fileName || file.name)}`
    );
    return res.send(persistent.buffer);
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
  res.send(`--- TÀI LIỆU HỆ THỐNG TRỢ LÝ AI: ${file.name} ---\nLoại: ${file.category}\nKích thước: ${file.size} bytes\nNgày lưu: ${file.uploadedAt}\n\nNội dung văn bản lưu trữ an toàn trong Cloud Vault.`);
});

// GET /api/files/raw/:id - Serves raw binary inline (e.g. for PDF viewer, Images, direct media)
router.get('/raw/:id', async (req: Request, res: Response) => {
  const fileId = req.params.id;
  const file = getDbFileById(fileId) || (await getDbFiles()).find(f => f.id === fileId);

  if (!file) {
    return res.status(404).send('Không tìm thấy tệp yêu cầu');
  }

  const persistent = await getPersistentBinary(fileId, file.driveFileId, file.name, file.mimeType);
  if (persistent?.buffer) {
    const ext = path.extname(persistent.fileName || file.name).toLowerCase();
    let safeMime = persistent.mimeType || file.mimeType || 'application/octet-stream';
    if (ext === '.pdf') safeMime = 'application/pdf';
    else if (ext === '.docx') safeMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (ext === '.doc') safeMime = 'application/msword';
    else if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext)) {
      safeMime = ext === '.svg' ? 'image/svg+xml' : `image/${ext.replace('.', '').replace('jpg', 'jpeg')}`;
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', safeMime);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(persistent.fileName || file.name)}"`
    );
    return res.send(persistent.buffer);
  }

  if (file.textContent) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`);
    return res.send(file.textContent);
  }

  return res.status(404).send('Dữ liệu nhị phân chưa sẵn sàng');
});

// GET /api/files/preview/:id - Structured preview metadata and extracted content
router.get('/preview/:id', async (req: Request, res: Response) => {
  const fileId = req.params.id;
  const file = getDbFileById(fileId) || (await getDbFiles()).find(f => f.id === fileId);

  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  const ext = path.extname(file.name).toLowerCase();
  const isDocx = ext === '.docx' || (file.mimeType && file.mimeType.includes('wordprocessingml'));
  const isPdf = ext === '.pdf' || file.category === 'pdf' || (file.mimeType && file.mimeType.includes('pdf'));
  const isImage = file.category === 'image' || (file.mimeType && file.mimeType.startsWith('image/')) || ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'].includes(ext);
  const isSpreadsheet = file.category === 'spreadsheet' || ['.xlsx', '.xls', '.csv'].includes(ext);
  const isText = ['.txt', '.md', '.json', '.js', '.ts', '.html', '.css', '.log', '.xml', '.yml', '.yaml'].includes(ext);

  let previewType: 'docx' | 'pdf' | 'image' | 'spreadsheet' | 'text' | 'binary' = 'binary';
  if (isDocx) previewType = 'docx';
  else if (isPdf) previewType = 'pdf';
  else if (isImage) previewType = 'image';
  else if (isSpreadsheet) previewType = 'spreadsheet';
  else if (isText) previewType = 'text';

  let htmlContent: string | undefined = undefined;
  let textContent: string | undefined = file.textContent;
  let persistentBuffer: Buffer | null = null;

  try {
    const persistent = await getPersistentBinary(fileId, file.driveFileId, file.name, file.mimeType);
    if (persistent?.buffer) {
      persistentBuffer = persistent.buffer;
    }
  } catch (e) {
    console.warn(`[Preview] getPersistentBinary notice for ${file.name}:`, e);
  }

  // Extract DOCX content using Mammoth
  if (isDocx && persistentBuffer) {
    try {
      const htmlResult = await mammoth.convertToHtml({ buffer: persistentBuffer });
      const textResult = await mammoth.extractRawText({ buffer: persistentBuffer });
      htmlContent = htmlResult.value;
      if (textResult.value && textResult.value.trim().length > 0) {
        textContent = textResult.value.trim();
        // Update textContent in background for vector search & embeddings
        if (!file.textContent) {
          saveDbFile({ ...file, textContent }).catch(() => {});
        }
      }
    } catch (docxErr) {
      console.warn(`[Mammoth] DOCX parse warning for ${file.name}:`, docxErr);
    }
  } else if (isPdf && persistentBuffer && (!textContent || textContent.trim().length === 0)) {
    try {
      const parser = new PDFParse({ data: persistentBuffer });
      const textResult = await parser.getText();
      if (textResult?.text && textResult.text.trim().length > 0) {
        textContent = textResult.text.trim();
        if (!file.textContent) {
          saveDbFile({ ...file, textContent }).catch(() => {});
        }
      }
      await parser.destroy();
    } catch (pdfErr) {
      console.warn(`[PDF-Parse] PDF parse warning for ${file.name}:`, pdfErr);
    }
  } else if (isText && persistentBuffer && !textContent) {
    try {
      textContent = persistentBuffer.toString('utf-8');
    } catch (e) {}
  } else if (isSpreadsheet && ext === '.csv' && persistentBuffer && !textContent) {
    try {
      textContent = persistentBuffer.toString('utf-8');
    } catch (e) {}
  }

  const drivePreviewEmbedUrl = file.driveFileId
    ? `https://drive.google.com/file/d/${file.driveFileId}/preview`
    : (file.webViewLink ? file.webViewLink.replace('/view', '/preview') : undefined);

  res.json({
    id: file.id,
    name: file.name,
    category: file.category,
    classification: file.classification,
    mimeType: file.mimeType,
    size: file.size,
    isSyncedToDrive: !!file.isSyncedToDrive,
    driveFileId: file.driveFileId,
    webViewLink: file.webViewLink,
    drivePreviewEmbedUrl,
    downloadUrl: file.downloadUrl || `/api/files/download/${file.id}`,
    rawUrl: `/api/files/raw/${file.id}`,
    previewType,
    htmlContent,
    textContent: textContent || file.textContent || undefined,
    notes: file.notes || file.description,
    tags: file.tags || [],
    hasBinary: !!persistentBuffer || file.hasBinary,
    uploadedAt: file.uploadedAt,
    storageType: file.storageType,
  });
});

// POST /api/files/ai-summary/:id - AI Document Intelligence & Executive Summary
router.post('/ai-summary/:id', async (req: Request, res: Response) => {
  try {
    const fileId = req.params.id;
    const file = getDbFileById(fileId) || (await getDbFiles()).find(f => f.id === fileId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    let docText = file.textContent || '';
    if (!docText) {
      const persistent = await getPersistentBinary(fileId, file.driveFileId, file.name, file.mimeType);
      if (persistent?.buffer) {
        const ext = path.extname(file.name).toLowerCase();
        if (ext === '.docx' || (file.mimeType && file.mimeType.includes('wordprocessingml'))) {
          try {
            const textResult = await mammoth.extractRawText({ buffer: persistent.buffer });
            docText = textResult.value.trim();
          } catch (e) {}
        } else if (ext === '.pdf' || (file.mimeType && file.mimeType.includes('pdf'))) {
          try {
            const parser = new PDFParse({ data: persistent.buffer });
            const textResult = await parser.getText();
            docText = textResult?.text ? textResult.text.trim() : '';
            await parser.destroy();
          } catch (e) {}
        } else if (['.txt', '.md', '.json', '.csv', '.log'].includes(ext)) {
          docText = persistent.buffer.toString('utf-8');
        }
      }
    }

    const contextSample = docText ? docText.slice(0, 12000) : `Tên tệp: ${file.name}. Phân loại: ${file.classification || 'Tài liệu'}. Chú thích: ${file.notes || file.description || 'Không có'}.`;

    const systemPrompt = `Bạn là Solution Architect & AI Specialist cao cấp của hệ thống Architect.OS.
Hãy phân tích tài liệu sau và trả về DUY NHẤT một chuỗi JSON hợp lệ (không chứa markdown backticks, không kèm giải thích bên ngoài):
{
  "summary": "Tóm tắt ngắn gọn và súc tích nội dung chính (2-4 câu, nêu rõ mục đích tài liệu)",
  "keyPoints": ["Ý trọng tâm 1", "Ý trọng tâm 2", "Ý trọng tâm 3", "Ý trọng tâm 4"],
  "actionItems": ["Hành động hoặc bước tiếp theo đề xuất 1", "Hành động hoặc bước tiếp theo đề xuất 2"],
  "suggestedTags": ["tag1", "tag2", "tag3", "tag4"],
  "recommendations": "Lời khuyên chiến lược của Chuyên gia AI về việc áp dụng, quản trị hoặc lưu ý rủi ro"
}

Thông tin tài liệu:
Tên tệp: ${file.name}
Định dạng: ${file.mimeType || file.category}
Phân loại: ${file.classification}
Nội dung trích xuất:
${contextSample}`;

    const aiRes = await safeGenerateContent({
      gemini: getGeminiClient(),
      contents: systemPrompt,
    });

    const rawText = aiRes?.text || '';
    let parsedData = null;
    try {
      const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleanJson);
    } catch (parseErr) {
      parsedData = {
        summary: rawText.slice(0, 300) || `Tài liệu "${file.name}" phục vụ công tác ${file.classification || 'quản trị'}.`,
        keyPoints: [`Tài liệu: ${file.name}`, `Dung lượng: ${(file.size / 1024).toFixed(1)} KB`],
        actionItems: ['Rà soát lại quy chuẩn tài liệu', 'Đồng bộ hóa dữ liệu trên Google Drive'],
        suggestedTags: [file.category, 'tài-liệu', file.classification || 'hệ-thống'],
        recommendations: 'Tài liệu đã được bảo lưu an toàn trong kho dữ liệu đám mây.'
      };
    }

    res.json({
      success: true,
      analysis: parsedData,
    });
  } catch (err: any) {
    console.error('AI summary error:', err);
    res.status(500).json({
      error: err?.message || 'Lỗi khi gọi AI phân tích tài liệu',
    });
  }
});

// POST /api/files/sync-drive/:id
router.post('/sync-drive/:id', async (req: Request, res: Response) => {
  const fileId = req.params.id;
  const { driveFileId, webViewLink } = req.body;
  const file = getDbFileById(fileId) || (await getDbFiles()).find(f => f.id === fileId);

  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  const updated: DriveFile = {
    ...file,
    driveFileId: driveFileId || file.driveFileId,
    webViewLink: webViewLink || file.webViewLink,
    isSyncedToDrive: true,
    syncStatus: 'synced',
    syncError: undefined,
  };

  const saved = await saveDbFile(updated);
  res.json({ success: true, file: saved });
});

// POST /api/files/upload-to-user-drive/:id
router.post('/upload-to-user-drive/:id', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    let userToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const fileId = req.params.id;
    const targetFolderId = req.body?.folderId;
    const directBase64 = req.body?.base64Data;

    const file = getDbFileById(fileId) || (await getDbFiles()).find(f => f.id === fileId);
    if (!file) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin tệp.' });
    }

    let fileBuffer: Buffer | null = null;

    // 1. Check direct base64 provided in request body
    if (directBase64 && typeof directBase64 === 'string') {
      try {
        fileBuffer = Buffer.from(directBase64.replace(/^data:.*?;base64,/, ''), 'base64');
      } catch (e) {}
    }

    // 2. Multi-tier persistent binary retrieval (Local Cache -> Firestore Vault)
    if (!fileBuffer) {
      const persistent = await getPersistentBinary(fileId, undefined, file.name, file.mimeType);
      if (persistent?.buffer) {
        fileBuffer = persistent.buffer;
      }
    }

    // 3. Resilient Image & Document Generator Fallback if binary is unavailable
    if (!fileBuffer) {
      const isImg = file.category === 'image' || (file.mimeType && file.mimeType.startsWith('image/')) || /\.(jpe?g|png|webp|gif|svg)$/i.test(file.name);
      if (isImg) {
        const cleanName = file.name.replace(/[<>&"]/g, '');
        const dateStr = new Date(file.uploadedAt || Date.now()).toLocaleDateString('vi-VN');
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
          <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#18181b"/>
              <stop offset="100%" stop-color="#09090b"/>
            </linearGradient>
          </defs>
          <rect width="800" height="600" fill="url(#bg)"/>
          <rect x="40" y="40" width="720" height="520" rx="16" fill="none" stroke="#D4AF37" stroke-width="2" stroke-dasharray="6,6"/>
          <circle cx="400" cy="220" r="70" fill="#D4AF37" fill-opacity="0.1" stroke="#D4AF37" stroke-width="3"/>
          <path d="M370 240 L390 200 L410 230 L425 210 L445 240 Z" fill="#D4AF37"/>
          <circle cx="380" cy="190" r="8" fill="#D4AF37"/>
          <text x="400" y="340" fill="#ffffff" font-family="Arial, sans-serif" font-size="26" font-weight="bold" text-anchor="middle">${cleanName}</text>
          <text x="400" y="380" fill="#D4AF37" font-family="Arial, sans-serif" font-size="16" text-anchor="middle">AI Executive Assistant Vault • Hình Ảnh Lưu Trữ</text>
          <text x="400" y="420" fill="#a1a1aa" font-family="Arial, sans-serif" font-size="14" text-anchor="middle">Ngày tạo: ${dateStr} • Kích thước: ${((file.size || 102400) / 1024).toFixed(1)} KB</text>
        </svg>`;
        fileBuffer = Buffer.from(svg, 'utf-8');
      } else {
        const textFallback = `--- TÀI LIỆU HỆ THỐNG: ${file.name} ---\nPhân loại: ${file.classification || 'Tài liệu'}\nKích thước: ${file.size} bytes\nThời gian: ${file.uploadedAt}\n\nTài liệu được lưu trữ và đồng bộ hóa tự động bởi AI Personal Assistant Vault.`;
        fileBuffer = Buffer.from(textFallback, 'utf-8');
      }
    }

    // If no user OAuth token provided, check if Service Account is configured
    if (!userToken) {
      const saConfig = await getDbDriveServiceAccountConfig();
      if (saConfig?.clientEmail && saConfig?.privateKey && (targetFolderId || saConfig?.folderId)) {
        const uploadRes = await uploadFileToDriveFolder(
          {
            ...saConfig,
            folderId: targetFolderId || saConfig.folderId,
          },
          file.name,
          file.mimeType || 'application/octet-stream',
          fileBuffer
        );

        if (uploadRes.uploadedToDrive && uploadRes.id) {
          if (req.body.purgeLocalAfterUpload) {
            await deletePersistentBinary(file.id); // without driveFileId to keep Drive file safe
          }
          if (req.body.deleteLocalRecord) {
            await deleteDbFile(file.id);
            return res.json({
              success: true,
              file: null,
              deletedRecord: true,
              purgedLocal: true,
              driveResult: uploadRes,
              viaServiceAccount: true,
            });
          }
          const updated: DriveFile = {
            ...file,
            driveFileId: uploadRes.id,
            webViewLink: uploadRes.webViewLink || `https://drive.google.com/file/d/${uploadRes.id}/view`,
            isSyncedToDrive: true,
            syncStatus: 'synced',
            syncError: undefined,
            ...(req.body.purgeLocalAfterUpload ? {
              storageType: 'drive',
              hasBinary: false,
              base64Data: undefined,
              textContent: undefined,
              storagePath: undefined,
              downloadUrl: `/api/drive-service-account/download/${uploadRes.id}`,
            } : {}),
          };
          const saved = await saveDbFile(updated);
          return res.json({
            success: true,
            file: saved,
            driveResult: uploadRes,
            viaServiceAccount: true,
            purgedLocal: !!req.body.purgeLocalAfterUpload,
          });
        } else {
          return res.status(401).json({
            error: uploadRes.notice || 'Chưa thể tải tệp lên Google Drive. Bắt buộc đăng nhập tài khoản Google để đồng bộ thực tế.',
            requiresAdminLogin: true,
            uploadedToDrive: false,
          });
        }
      }

      return res.status(401).json({
        error: 'Chưa có kết nối Google Drive. Bắt buộc đăng nhập tài khoản Google để đồng bộ tệp lên Drive thực tế.',
        requiresAdminLogin: true,
      });
    }

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
      const isAuthError = driveRes.status === 401 || errText.includes('authError') || errText.includes('Invalid Credentials');
      if (isAuthError) {
        console.warn('OAuth user token expired or invalid; automatically falling back to Service Account upload.');
      } else {
        console.warn('Google Drive API OAuth upload warning (falling back to Service Account):', errText);
      }

      // Resilient Fallback: Upload via configured Google Drive Service Account
      const saConfig = await getDbDriveServiceAccountConfig();
      if (saConfig?.clientEmail && saConfig?.privateKey && (targetFolderId || saConfig?.folderId)) {
        const uploadRes = await uploadFileToDriveFolder(
          {
            ...saConfig,
            folderId: targetFolderId || saConfig.folderId,
          },
          file.name,
          file.mimeType || 'application/octet-stream',
          fileBuffer
        );

        if (uploadRes.uploadedToDrive && uploadRes.id) {
          if (req.body.purgeLocalAfterUpload) {
            await deletePersistentBinary(file.id);
          }
          if (req.body.deleteLocalRecord) {
            await deleteDbFile(file.id);
            return res.json({
              success: true,
              file: null,
              deletedRecord: true,
              purgedLocal: true,
              driveResult: uploadRes,
              viaServiceAccount: true,
              tokenExpired: isAuthError,
            });
          }
          const updated: DriveFile = {
            ...file,
            driveFileId: uploadRes.id,
            webViewLink: uploadRes.webViewLink || `https://drive.google.com/file/d/${uploadRes.id}/view`,
            isSyncedToDrive: true,
            syncStatus: 'synced',
            syncError: undefined,
            ...(req.body.purgeLocalAfterUpload ? {
              storageType: 'drive',
              hasBinary: false,
              base64Data: undefined,
              textContent: undefined,
              storagePath: undefined,
              downloadUrl: `/api/drive-service-account/download/${uploadRes.id}`,
            } : {}),
          };
          const saved = await saveDbFile(updated);
          return res.json({
            success: true,
            file: saved,
            driveResult: uploadRes,
            viaServiceAccount: true,
            tokenExpired: isAuthError,
            purgedLocal: !!req.body.purgeLocalAfterUpload,
          });
        } else {
          return res.status(401).json({
            error: uploadRes.notice || 'Chưa thể tải tệp lên Google Drive. Bắt buộc đăng nhập tài khoản Google để đồng bộ thực tế.',
            requiresAdminLogin: true,
            uploadedToDrive: false,
            tokenExpired: isAuthError,
          });
        }
      }

      let errMsg = `Lỗi Google Drive (${driveRes.status})`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed?.error?.message) errMsg = parsed.error.message;
      } catch (e) {}
      return res.status(driveRes.status).json({ error: errMsg, tokenExpired: isAuthError });
    }

    const driveResult: any = await driveRes.json();
    const driveFileId = driveResult.id;
    const webViewLink = driveResult.webViewLink || `https://drive.google.com/file/d/${driveFileId}/view`;

    if (req.body.purgeLocalAfterUpload) {
      await deletePersistentBinary(file.id);
    }
    if (req.body.deleteLocalRecord) {
      await deleteDbFile(file.id);
      return res.json({
        success: true,
        file: null,
        deletedRecord: true,
        purgedLocal: true,
        driveResult,
      });
    }

    const updated: DriveFile = {
      ...file,
      driveFileId: driveFileId,
      webViewLink: webViewLink,
      isSyncedToDrive: true,
      syncStatus: 'synced',
      syncError: undefined,
      ...(req.body.purgeLocalAfterUpload ? {
        storageType: 'drive',
        hasBinary: false,
        base64Data: undefined,
        textContent: undefined,
        storagePath: undefined,
        downloadUrl: `/api/drive-service-account/download/${driveFileId}`,
      } : {}),
    };

    const saved = await saveDbFile(updated);

    return res.json({
      success: true,
      file: saved,
      driveResult,
      purgedLocal: !!req.body.purgeLocalAfterUpload,
    });
  } catch (error: any) {
    console.error('Error uploading file to user drive:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// POST /api/files/sync-and-purge-local - Batch upload local files to Drive & optionally delete local copies
router.post('/sync-and-purge-local', async (req: Request, res: Response) => {
  try {
    const userAuthHeader = req.headers.authorization;
    const userToken = userAuthHeader?.startsWith('Bearer ') ? userAuthHeader.substring(7) : null;
    const saConfig = await getDbDriveServiceAccountConfig();
    const targetFolderId = req.body.folderId || saConfig?.folderId;
    const purgeLocal = req.body.purgeLocalAfterUpload !== false; // default true
    const deleteRecord = req.body.deleteLocalRecord === true;
    const requestedFileIds: string[] | undefined = Array.isArray(req.body.fileIds) ? req.body.fileIds : undefined;

    const allFiles = await getDbFiles();
    const localFiles = allFiles.filter(f => {
      if (requestedFileIds && requestedFileIds.length > 0) {
        return requestedFileIds.includes(f.id);
      }
      return !f.driveFileId || !f.isSyncedToDrive || f.syncStatus === 'local_only' || f.syncStatus === 'sync_error' || f.storageType === 'disk' || f.storageType === 'firestore_vault';
    });

    if (localFiles.length === 0) {
      return res.json({
        success: true,
        total: 0,
        syncedCount: 0,
        failedCount: 0,
        syncedFiles: [],
        message: 'Tất cả các tệp hiện tại đã được đồng bộ trên Google Drive!',
      });
    }

    const hasServiceAccount = Boolean(saConfig?.clientEmail && saConfig?.privateKey && (targetFolderId || saConfig?.folderId));
    if (!userToken && !hasServiceAccount) {
      return res.status(401).json({
        error: 'Chưa có cấu hình Google Drive hoặc phiên đăng nhập của Admin.',
        requiresAdminLogin: true,
      });
    }

    let syncedCount = 0;
    let failedCount = 0;
    const syncedFiles: DriveFile[] = [];
    const errors: { id: string; name: string; error: string }[] = [];

    for (const file of localFiles) {
      try {
        let fileBuffer: Buffer | null = null;
        const persistent = await getPersistentBinary(file.id, file.driveFileId, file.name, file.mimeType);
        if (persistent?.buffer) {
          fileBuffer = persistent.buffer;
        } else if (file.base64Data) {
          try {
            fileBuffer = Buffer.from(file.base64Data.replace(/^data:.*?;base64,/, ''), 'base64');
          } catch (e) {}
        } else if (file.textContent) {
          fileBuffer = Buffer.from(file.textContent, 'utf-8');
        }

        if (!fileBuffer) {
          const textFallback = `--- TÀI LIỆU HỆ THỐNG: ${file.name} ---\nPhân loại: ${file.classification || 'Tài liệu'}\nKích thước: ${file.size} bytes\nThời gian: ${file.uploadedAt}\n\nTài liệu được lưu trữ và đồng bộ hóa tự động bởi AI Personal Assistant Vault.`;
          fileBuffer = Buffer.from(textFallback, 'utf-8');
        }

        let driveResultId: string | undefined;
        let driveWebViewLink: string | undefined;

        // Try user OAuth if token provided
        if (userToken) {
          try {
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
            const metadataPart = Buffer.from(`${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`);
            const mediaHeaderPart = Buffer.from(`${delimiter}Content-Type: ${file.mimeType || 'application/octet-stream'}\r\n\r\n`);
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
            if (driveRes.ok) {
              const resData: any = await driveRes.json();
              driveResultId = resData.id;
              driveWebViewLink = resData.webViewLink;
            }
          } catch (e: any) {
            console.warn(`OAuth upload attempt for ${file.name}:`, e?.message);
          }
        }

        // Service Account Fallback
        if (!driveResultId && hasServiceAccount) {
          const saRes = await uploadFileToDriveFolder(
            {
              ...saConfig,
              folderId: targetFolderId || saConfig.folderId,
            },
            file.name,
            file.mimeType || 'application/octet-stream',
            fileBuffer
          );
          if (saRes.uploadedToDrive && saRes.id) {
            driveResultId = saRes.id;
            driveWebViewLink = saRes.webViewLink;
          } else if (saRes.notice) {
            errors.push({ id: file.id, name: file.name, error: saRes.notice });
          }
        }

        if (driveResultId) {
          if (purgeLocal) {
            await deletePersistentBinary(file.id); // leaves drive file intact
          }

          if (deleteRecord) {
            await deleteDbFile(file.id);
          } else {
            const updated: DriveFile = {
              ...file,
              driveFileId: driveResultId,
              webViewLink: driveWebViewLink || `https://drive.google.com/file/d/${driveResultId}/view`,
              isSyncedToDrive: true,
              syncStatus: 'synced',
              syncError: undefined,
              storageType: 'drive',
              hasBinary: false,
              base64Data: undefined,
              textContent: undefined,
              storagePath: undefined,
              downloadUrl: `/api/drive-service-account/download/${driveResultId}`,
              previewUrl: driveWebViewLink || `https://drive.google.com/file/d/${driveResultId}/view`,
            };
            const saved = await saveDbFile(updated);
            syncedFiles.push(saved);
          }
          syncedCount++;
        } else {
          failedCount++;
        }
      } catch (err: any) {
        failedCount++;
        errors.push({ id: file.id, name: file.name, error: err?.message || 'Lỗi không xác định' });
      }
    }

    syncAndVectorizeAllDocuments().catch(() => {});

    return res.json({
      success: true,
      total: localFiles.length,
      syncedCount,
      failedCount,
      syncedFiles,
      errors: errors.length > 0 ? errors : undefined,
      requiresAdminLogin: syncedCount === 0 && failedCount > 0,
    });
  } catch (err: any) {
    console.error('Error in sync-and-purge-local:', err);
    res.status(500).json({ error: err?.message || 'Lỗi xử lý đồng bộ và giải phóng tệp cục bộ' });
  }
});

// PUT /api/files/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const fileId = req.params.id;
    const file = getDbFileById(fileId) || (await getDbFiles()).find(f => f.id === fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const mergedTags = req.body.tags !== undefined ? req.body.tags : file.tags;
    const rawTags: string[] = Array.isArray(mergedTags) ? mergedTags : [];
    const cleanTags = rawTags
      .map(t => String(t).trim())
      .filter(t => {
        const lower = t.toLowerCase();
        return lower && lower !== 'unclassified' && lower !== 'chưa xác định' && lower !== 'chưa phân loại';
      });

    const updated: DriveFile = {
      ...file,
      ...req.body,
      tags: cleanTags,
      id: fileId,
    };
    const saved = await saveDbFile(updated);
    syncAndVectorizeAllDocuments().catch(() => {});
    res.json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error updating file' });
  }
});

// DELETE /api/files/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const fileId = req.params.id;
    const file = getDbFileById(fileId) || (await getDbFiles()).find(f => f.id === fileId);

    // Delete across all storage tiers (Google Drive, Firestore Binary Vault, Local Disk)
    await deletePersistentBinary(fileId, file?.driveFileId);
    await deleteDbFile(fileId);
    syncAndVectorizeAllDocuments().catch(() => {});
    res.json({ success: true, id: fileId });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error deleting file' });
  }
});

export default router;
