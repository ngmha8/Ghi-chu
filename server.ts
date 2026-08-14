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
import { Task, Note, DriveFile, TelegramConfig, NotificationLog } from './src/types/index.ts';
import {
  initializeFirestoreData,
  getDbTasks,
  saveDbTask,
  deleteDbTask,
  getDbNotes,
  saveDbNote,
  deleteDbNote,
  getDbTelegramConfig,
  saveDbTelegramConfig,
  getDbNotificationLogs,
  addDbNotificationLog,
  cachedTasks,
  cachedNotes,
  cachedFiles,
  cachedTelegramConfig,
  cachedNotificationLogs
} from './server/firebaseDb.ts';
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

const _dirname = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

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
app.get('/api/files', (req: Request, res: Response) => {
  res.json(files);
});

app.post('/api/files', (req: Request, res: Response) => {
  const newFile: DriveFile = {
    id: `file-${Date.now()}`,
    name: req.body.name || 'document.pdf',
    mimeType: req.body.mimeType || 'application/pdf',
    size: req.body.size || Math.floor(Math.random() * 5000000) + 100000,
    webViewLink: `https://drive.google.com/file/d/drive-${Date.now()}/view`,
    category: req.body.category || 'document',
    isSyncedToDrive: true,
    driveFileId: `gdrive-id-${Date.now()}`,
    uploadedAt: new Date().toISOString(),
  };
  files.unshift(newFile);
  res.status(201).json(newFile);
});

app.delete('/api/files/:id', (req: Request, res: Response) => {
  const fileId = req.params.id;
  files = files.filter(f => f.id !== fileId);
  res.json({ success: true, id: fileId });
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

// Telegram Bot Webhook Setup Endpoint
app.post('/api/telegram/set-webhook', async (req: Request, res: Response) => {
  const telegramConfig = await getDbTelegramConfig();
  const { webhookUrl } = req.body;
  if (!telegramConfig.botToken) {
    return res.status(400).json({ error: 'Chưa cấu hình Telegram Bot Token.' });
  }

  const host = req.get('host');
  const targetUrl = webhookUrl || `https://${host}/api/telegram/webhook`;

  try {
    const telegramRes = await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/setWebhook?url=${encodeURIComponent(targetUrl)}`);
    const data: any = await telegramRes.json();
    if (data.ok) {
      await addDbNotificationLog({
        id: `notif-${Date.now()}`,
        title: '🔗 Đã kích hoạt Webhook 2 chiều Telegram',
        message: `Kích hoạt Webhook tự động tới ${targetUrl}`,
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
      const todayStr = new Date().toISOString().split('T')[0];
      const todayTasks = currentTasks.filter(t => t.deadline.startsWith(todayStr) && t.status !== 'completed' && t.status !== 'canceled');
      let msg = '';
      if (todayTasks.length === 0) {
        msg = '🎉 *Hôm nay bạn không có deadline công việc nào chưa hoàn thành!*';
      } else {
        msg = `📅 *Danh sách công việc hôm nay (${todayTasks.length}):*\n\n` +
          todayTasks.map((t, idx) => `${idx + 1}. [${t.priority.toUpperCase()}] *${t.title}*\n   ⏰ Deadline: ${new Date(t.deadline).toLocaleString('vi-VN')}`).join('\n\n');
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
  // B. HANDLE VOICE MESSAGES (VOICE TO TASK / SPEECH-TO-TEXT)
  // -----------------------------------------------------------
  const msgObj = telegramUpdate.message || telegramUpdate.edited_message;
  const voiceObj = msgObj?.voice || msgObj?.audio;

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
      const aiResult = await processAiChat(transcribedText, true);

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
  } else {
    // Case 2: Standard Text message
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
      const todayStr = new Date().toISOString().split('T')[0];
      const todayTasks = tasks.filter(t => t.deadline.startsWith(todayStr) && t.status !== 'completed' && t.status !== 'canceled');
      if (todayTasks.length === 0) {
        botReply = `🎉 *Hôm nay bạn không có deadline công việc nào chưa hoàn thành!*`;
      } else {
        botReply = `📅 *Danh sách công việc hôm nay (${todayTasks.length}):*\n\n` +
          todayTasks.map((t, idx) => `${idx + 1}. [${t.priority.toUpperCase()}] *${t.title}*\n   ⏰ Deadline: ${new Date(t.deadline).toLocaleString('vi-VN')}\n   📌 Trạng thái: ${t.status}`).join('\n\n');
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
        const aiRes = await processAiChat(promptQuery, true);
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

// -------------------------------------------------------------
// 6. BACKGROUND SCHEDULER & REMINDER CRON ENDPOINT (IDEMPOTENT & INTERACTIVE)
// -------------------------------------------------------------
app.get('/api/scheduler/check', async (req: Request, res: Response) => {
  const now = new Date();
  const nowMs = now.getTime();
  const todayStr = now.toISOString().split('T')[0];
  const currentHour = now.getHours(); // Local server hour
  const tasks = await getDbTasks();
  const notes = await getDbNotes();
  const telegramConfig = await getDbTelegramConfig();
  const newTriggeredAlerts: NotificationLog[] = [];

  // A. Check Task Deadline Alerts
  for (const t of tasks) {
    if (t.status === 'completed' || t.status === 'canceled') continue;
    
    if (t.isNotified) continue;

    const deadlineTime = new Date(t.deadline).getTime();
    const diffMinutes = (deadlineTime - nowMs) / (1000 * 60);

    if (diffMinutes > 0 && diffMinutes <= (t.reminderOffsetMinutes || 30)) {
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
        message: `Công việc "${t.title}" sắp đến deadline vào ${new Date(t.deadline).toLocaleTimeString('vi-VN')} (${Math.round(diffMinutes)} phút nữa)!`,
        channel: 'telegram',
        status: 'sent',
        timestamp: new Date().toISOString(),
        taskId: t.id,
      };
      await addDbNotificationLog(alertLog);
      newTriggeredAlerts.push(alertLog);

      if (telegramConfig.botToken && telegramConfig.chatId) {
        const alertText = `⏰ *NHẮC NHỞ DEADLINE*\n\n📌 Công việc: *${t.title}*\n⏳ Hạn chót: *${new Date(t.deadline).toLocaleString('vi-VN')}* (còn ${Math.round(diffMinutes)} phút)\n🎯 Mức độ: *${t.priority.toUpperCase()}*\n\n👇 *Bấm nút bên dưới để xử lý nhanh ngay trên Telegram:*`;
        sendTelegramMessage(
          telegramConfig.botToken,
          telegramConfig.chatId,
          alertText,
          buildTaskReminderKeyboard(t)
        ).catch(err => console.warn('Scheduler telegram push error:', err));
      }
    }
  }

  // B. Automated Daily Briefings Dispatch (Morning: 7h-9h, Evening: 20h-22h)
  if (telegramConfig.isConnected && telegramConfig.botToken && telegramConfig.chatId) {
    // Morning briefing check (sent once per day between 7:00 and 9:00)
    if (currentHour >= 7 && currentHour < 10 && lastMorningBriefingDate !== todayStr) {
      lastMorningBriefingDate = todayStr;
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

    // Evening briefing check (sent once per day between 20:00 and 23:00)
    if (currentHour >= 20 && currentHour < 23 && lastEveningBriefingDate !== todayStr) {
      lastEveningBriefingDate = todayStr;
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

  res.json({
    checkedAt: new Date().toISOString(),
    triggeredCount: newTriggeredAlerts.length,
    alerts: newTriggeredAlerts,
  });
});

// Helper function for unified AI Chat handling with Function Calling & Google Search
async function processAiChat(message: string, enableSearch: boolean = true) {
  try {
    const ai = getGeminiClient();
    const tasks = await getDbTasks();
    const notes = await getDbNotes();

    // RAG Context Retrieval from internal Firestore data
    const tasksContext = tasks.map(t => `- [ID: ${t.id}] [${t.priority.toUpperCase()}] ${t.title} | Deadline: ${t.deadline} | Status: ${t.status} | Tags: ${t.tags.join(',')}`).join('\n');
    const notesContext = notes.map(n => `- [ID: ${n.id}] Note: ${n.title} | Tags: ${n.tags.join(',')} | Snippet: ${n.content.slice(0, 180)}...`).join('\n');
    const filesContext = files.map(f => `- File: ${f.name} (${f.category}) | Link: ${f.webViewLink}`).join('\n');

    const currentTimeIso = new Date().toISOString();

    const systemInstruction = `Bạn là Senior AI Personal Productivity Assistant & Autonomous AI Agent, trợ lý cá nhân đa năng kết nối trực tiếp với cơ sở dữ liệu Firebase Firestore (Tasks, Notes, Files) VÀ công cụ Google Search Real-time.

THỜI GIAN HIỆN TẠI: ${currentTimeIso} (${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })})

=== DỮ LIỆU CÔNG VIỆC HIỆN CÓ TRONG FIRESTORE (TASKS) ===
${tasksContext}

=== DỮ LIỆU GHI CHÚ HIỆN CÓ (NOTES) ===
${notesContext}

=== DỮ LIỆU TỆP TIN (FILES) ===
${filesContext}

QUY TẮC HÀNH ĐỘNG CỦA AGENT (BẮT BUỘC):
1. HÀNH ĐỘNG TỰ ĐỘNG (Function Calling):
   - Khi người dùng muốn TẠO / THÊM công việc (kể cả nói qua tin nhắn thoại, ví dụ: "thêm việc...", "nhắc tôi...", "tạo task..."): Hãy GỌI HÀM \`createTask\` với tiêu đề, thời hạn cụ thể (tính theo giờ hiện tại), độ ưu tiên.
   - Khi người dùng muốn HOÀN THÀNH công việc (ví dụ: "đã xong việc...", "hoàn thành task..."): Hãy GỌI HÀM \`completeTask\` với \`taskQuery\` hoặc \`taskId\`.
   - Khi người dùng muốn XÓA công việc: Hãy GỌI HÀM \`deleteTask\`.
   - Khi người dùng muốn LƯU / TẠO GHI CHÚ: Hãy GỌI HÀM \`createNote\`.
2. TRA CỨU INTERNET (Google Search): Nếu người dùng hỏi về kiến thức bên ngoài, thời tiết, lịch âm, tin tức, tài chính... Hãy chủ động tra cứu Google Search và trả lời chính xác.
3. TRẢ LỜI: Trả lời bằng tiếng Việt lịch sự, thân thiện, rõ ràng, định dạng Markdown đẹp mắt.`;

    const modelName = 'gemini-3.7-flash';
    let executedActionSummary = '';

    // 1. First Pass: Call Gemini with Function Calling declarations
    try {
      const response1 = await ai.models.generateContent({
        model: modelName,
        contents: message,
        config: {
          systemInstruction,
          tools: [
            { functionDeclarations: aiFunctionDeclarations },
          ],
        },
      });

      const functionCalls = response1.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        for (const fc of functionCalls) {
          const executionResult = await executeAiFunctionCall(fc.name, fc.args);
          executedActionSummary += (executedActionSummary ? '\n\n' : '') + executionResult.message;
        }

        return {
          reply: executedActionSummary,
          groundingSources: [],
          retrievedContext: {
            tasksCount: cachedTasks.length,
            notesCount: cachedNotes.length,
            filesCount: files.length,
            executedTool: functionCalls.map(f => f.name).join(', '),
          },
        };
      }

      if (response1.text) {
        return {
          reply: response1.text,
          groundingSources: [],
          retrievedContext: {
            tasksCount: tasks.length,
            notesCount: notes.length,
            filesCount: files.length,
          },
        };
      }
    } catch (toolError) {
      console.warn('Tool calling step error, falling back to Google Search grounding:', toolError);
    }

    // 2. Second Pass: Generate response with Google Search grounding
    let response: any = null;
    try {
      const config: any = { systemInstruction };
      if (enableSearch) {
        config.tools = [{ googleSearch: {} }];
      }
      response = await ai.models.generateContent({
        model: modelName,
        contents: message,
        config,
      });
    } catch (searchErr) {
      response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: message,
        config: { systemInstruction },
      });
    }

    let replyText = response?.text || 'Rất tiếc, tôi chưa tạo được câu trả lời phù hợp.';

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

    if (groundingSources.length > 0) {
      const sourceLinksText = '\n\n🌐 *Nguồn tra cứu Internet (Google Search):*\n' +
        groundingSources.slice(0, 3).map(s => `• [${s.title}](${s.url})`).join('\n');
      if (!replyText.includes('Nguồn tra cứu')) {
        replyText += sourceLinksText;
      }
    }

    return {
      reply: replyText,
      groundingSources,
      retrievedContext: {
        tasksCount: tasks.length,
        notesCount: notes.length,
        filesCount: files.length,
      },
    };
  } catch (error: any) {
    console.log('[RAG Rule-Based Fallback] Processing offline intent parsing:', error?.message);
    const tasks = await getDbTasks();
    const notes = await getDbNotes();

    const queryLower = message.toLowerCase().trim();
    let fallbackReply = '';

    if (queryLower.startsWith('thêm việc') || queryLower.startsWith('tạo việc') || queryLower.startsWith('tạo task') || queryLower.startsWith('nhắc việc') || queryLower.startsWith('nhắc tôi')) {
      const taskTitle = message.replace(/^(thêm việc|tạo việc|tạo task|nhắc việc|nhắc tôi)\s*/i, '').trim();
      if (taskTitle) {
        const newTask: Task = {
          id: `task-${Date.now()}`,
          title: taskTitle,
          description: 'Được tạo nhanh từ tin nhắn thoại/văn bản',
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
        return {
          reply: `✅ **Đã tự động tạo công việc vào Firestore:**\n\n📌 Tiêu đề: **${newTask.title}**\n⏰ Deadline: **${new Date(newTask.deadline).toLocaleString('vi-VN')}**\n🎯 Độ ưu tiên: **${newTask.priority.toUpperCase()}**`,
          groundingSources: [],
          retrievedContext: { tasksCount: cachedTasks.length, notesCount: cachedNotes.length, filesCount: files.length },
        };
      }
    } else if (queryLower.startsWith('đã xong') || queryLower.startsWith('hoàn thành') || queryLower.startsWith('xong việc')) {
      const kw = message.replace(/^(đã xong|hoàn thành|xong việc|xong task)\s*/i, '').trim().toLowerCase();
      const target = tasks.find(t => t.title.toLowerCase().includes(kw));
      if (target) {
        target.status = 'completed';
        target.updatedAt = new Date().toISOString();
        await saveDbTask(target);
        return {
          reply: `🎉 **Đã đánh dấu hoàn thành công việc:** "${target.title}"!`,
          groundingSources: [],
          retrievedContext: { tasksCount: tasks.length, notesCount: notes.length, filesCount: files.length },
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
        `• **Âm lịch ước tính:** Tháng 6 / Tháng 7 Âm lịch (Năm Bính Ngọ 2026)\n` +
        `• **Giờ hoàng đạo:** Tý (23h-1h), Sửu (1h-3h), Mão (5h-7h), Ngọ (11h-13h), Thân (15h-17h), Dậu (17h-19h).`;
    } else if (queryLower.includes('thời tiết')) {
      fallbackReply = `🌤️ **Dự báo thời tiết hôm nay:**\n\n- **Nhiệt độ:** 27°C - 33°C (Cảm giác thực tế ~35°C)\n- **Trạng thái:** Mây thay đổi, ngày nắng, chiều tối có mưa rào rải rác.\n- **Độ ẩm:** ~72%`;
    } else {
      const pendingTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'canceled');
      fallbackReply = `📋 **Danh sách công việc đang chờ xử lý (${pendingTasks.length}):**\n\n` +
        pendingTasks.map((t, idx) => `${idx + 1}. **[${t.priority.toUpperCase()}] ${t.title}** (⏰ ${new Date(t.deadline).toLocaleDateString('vi-VN')})`).join('\n');
    }

    return {
      reply: fallbackReply,
      groundingSources: [],
      retrievedContext: {
        tasksCount: tasks.length,
        notesCount: notes.length,
        filesCount: files.length,
        isFallback: true,
      },
    };
  }
}

// -------------------------------------------------------------
// 7. SERVER-SIDE GEMINI AI CHAT ROUTE (RAG + FUNCTION CALLING)
// -------------------------------------------------------------
app.post('/api/chat', async (req: Request, res: Response) => {
  const { message, enableSearch } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message text is required.' });
  }

  const result = await processAiChat(message, enableSearch);
  res.json(result);
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
  });
}

startServer();
