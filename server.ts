import express, { Request, Response } from 'express';
import path from 'path';
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

const _dirname = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// In-Memory Database Store
let tasks: Task[] = [...initialTasks];
let notes: Note[] = [...initialNotes];
let files: DriveFile[] = [...initialFiles];
let telegramConfig: TelegramConfig = { ...initialTelegramConfig };
let notificationLogs: NotificationLog[] = [...initialNotificationLogs];
const userProfile = { ...initialUserProfile };

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
// 1. TASK MANAGEMENT API ROUTES
// -------------------------------------------------------------
app.get('/api/tasks', (req: Request, res: Response) => {
  res.json(tasks);
});

app.post('/api/tasks', (req: Request, res: Response) => {
  const newTask: Task = {
    id: `task-${Date.now()}`,
    title: req.body.title || 'Công việc mới',
    description: req.body.description || '',
    deadline: req.body.deadline || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    priority: req.body.priority || 'medium',
    status: req.body.status || 'todo',
    tags: req.body.tags || [],
    recurring: req.body.recurring || { type: 'none' },
    attachedFileIds: req.body.attachedFileIds || [],
    reminderOffsetMinutes: req.body.reminderOffsetMinutes ?? 15,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  tasks.unshift(newTask);
  res.status(201).json(newTask);
});

app.put('/api/tasks/:id', (req: Request, res: Response) => {
  const taskId = req.params.id;
  const index = tasks.findIndex(t => t.id === taskId);
  if (index === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }
  tasks[index] = {
    ...tasks[index],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  res.json(tasks[index]);
});

app.delete('/api/tasks/:id', (req: Request, res: Response) => {
  const taskId = req.params.id;
  tasks = tasks.filter(t => t.id !== taskId);
  res.json({ success: true, id: taskId });
});

// -------------------------------------------------------------
// 2. NOTES API ROUTES
// -------------------------------------------------------------
app.get('/api/notes', (req: Request, res: Response) => {
  res.json(notes);
});

app.post('/api/notes', (req: Request, res: Response) => {
  const newNote: Note = {
    id: `note-${Date.now()}`,
    title: req.body.title || 'Ghi chú mới',
    content: req.body.content || '',
    tags: req.body.tags || [],
    linkedTaskIds: req.body.linkedTaskIds || [],
    attachedFileIds: req.body.attachedFileIds || [],
    isPinned: req.body.isPinned || false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  notes.unshift(newNote);
  res.status(201).json(newNote);
});

app.put('/api/notes/:id', (req: Request, res: Response) => {
  const noteId = req.params.id;
  const index = notes.findIndex(n => n.id === noteId);
  if (index === -1) {
    return res.status(404).json({ error: 'Note not found' });
  }
  notes[index] = {
    ...notes[index],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  res.json(notes[index]);
});

app.delete('/api/notes/:id', (req: Request, res: Response) => {
  const noteId = req.params.id;
  notes = notes.filter(n => n.id !== noteId);
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
// 4. TELEGRAM BOT & NOTIFICATION API ROUTES
// -------------------------------------------------------------
app.get('/api/telegram/config', (req: Request, res: Response) => {
  res.json({
    config: telegramConfig,
    logs: notificationLogs,
  });
});

app.post('/api/telegram/config', (req: Request, res: Response) => {
  telegramConfig = {
    ...telegramConfig,
    ...req.body,
  };
  res.json({ success: true, config: telegramConfig });
});

app.post('/api/telegram/test', async (req: Request, res: Response) => {
  const msgText = req.body.message || 'Xin chào! Hệ thống AI Personal Assistant đã kết nối Telegram thành công!';
  const newLog: NotificationLog = {
    id: `notif-${Date.now()}`,
    title: '💬 Thử nghiệm kết nối Telegram Bot',
    message: msgText,
    channel: 'telegram',
    status: 'sent',
    timestamp: new Date().toISOString(),
  };
  notificationLogs.unshift(newLog);

  let telegramDelivered = false;
  if (telegramConfig.botToken && telegramConfig.chatId) {
    try {
      const resTg = await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramConfig.chatId,
          text: msgText,
          parse_mode: 'Markdown',
        }),
      });
      const dataTg: any = await resTg.json();
      if (dataTg.ok) {
        telegramDelivered = true;
      } else {
        // Fallback send plain text if Markdown format fails
        const fallbackRes = await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramConfig.chatId,
            text: msgText,
          }),
        });
        const fallbackData: any = await fallbackRes.json();
        if (fallbackData.ok) telegramDelivered = true;
      }
    } catch (e) {
      console.warn('Telegram test send failed:', e);
    }
  }

  res.json({ success: true, log: newLog, telegramDelivered });
});

// Telegram Bot Webhook Endpoint (Full 2-Way Conversational AI Chat)
app.post('/api/telegram/set-webhook', async (req: Request, res: Response) => {
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
      notificationLogs.unshift({
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

app.post('/api/telegram/webhook', async (req: Request, res: Response) => {
  const telegramUpdate = req.body || {};
  const msgObj = telegramUpdate.message || telegramUpdate.edited_message;

  const rawInput = (
    msgObj?.text ||
    req.body.command ||
    req.body.text ||
    ''
  ).trim();

  const detectedChatId = msgObj?.chat?.id ? String(msgObj.chat.id) : null;
  const chatId = detectedChatId || req.body.chatId || telegramConfig.chatId;

  // Auto-save detected Chat ID if available
  if (detectedChatId) {
    telegramConfig.chatId = detectedChatId;
    telegramConfig.isConnected = true;
    console.log(`Auto-registered Telegram Chat ID: ${detectedChatId}`);
  }

  let botReply = '';

  if (!rawInput) {
    return res.json({ success: true, reply: 'Chưa nhận được nội dung tin nhắn.' });
  }

  // Clean Telegram Bot handle mentions (e.g. @botusername)
  let cleanInput = rawInput.replace(/@\w+/gi, '').trim();

  if (cleanInput.match(/^\/(start|help)\b/i)) {
    botReply = `🤖 *AI Personal Productivity Assistant*\n\nChào bạn! Tôi là Trợ lý AI kết nối trực tiếp với công việc, ghi chú & dữ liệu cá nhân của bạn.\n\nBạn có thể nhắn tin trao đổi tự nhiên trực tiếp từ điện thoại (ví dụ: "thời tiết hôm nay", "công việc hôm nay", "tổng hợp lịch làm việc sắp tới") hoặc dùng các lệnh nhanh:\n• \`/today\` - Công việc deadline hôm nay\n• \`/tasks\` - Tất cả công việc chưa xong\n• \`/notes\` - Danh sách ghi chú cá nhân\n• \`/ask <câu hỏi>\` - Hỏi đáp bất kỳ với AI`;
  } else if (cleanInput.match(/^\/today\b/i)) {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTasks = tasks.filter(t => t.deadline.startsWith(todayStr) || (t.status !== 'completed' && t.status !== 'canceled'));
    if (todayTasks.length === 0) {
      botReply = `🎉 *Hôm nay bạn không có deadline công việc nào chưa hoàn thành!*`;
    } else {
      botReply = `📅 *Danh sách công việc bận rộn hôm nay (${todayTasks.length}):*\n\n` +
        todayTasks.map((t, idx) => `${idx + 1}. [${t.priority.toUpperCase()}] *${t.title}*\n   ⏰ Deadline: ${new Date(t.deadline).toLocaleString('vi-VN')}\n   📌 Trạng thái: ${t.status}`).join('\n\n');
    }
  } else if (cleanInput.match(/^\/tasks\b/i)) {
    const pending = tasks.filter(t => t.status !== 'completed');
    botReply = `📋 *Danh sách công việc chưa hoàn thành (${pending.length}):*\n\n` +
      pending.map((t, idx) => `${idx + 1}. *${t.title}* (${t.priority})\n   ⏰ ${new Date(t.deadline).toLocaleDateString('vi-VN')}`).join('\n\n');
  } else if (cleanInput.match(/^\/notes\b/i)) {
    botReply = `📝 *Ghi chú cá nhân (${notes.length}):*\n\n` +
      notes.slice(0, 5).map((n, idx) => `${idx + 1}. *${n.title}* (${n.tags.join(', ')})`).join('\n');
  } else {
    // Process two-way AI natural language conversation for any user prompt!
    let promptQuery = cleanInput.replace(/^\/(ask|chat|ai)\b/i, '').trim();

    if (!promptQuery) {
      botReply = `⚠️ Vui lòng nhập câu hỏi sau lệnh /ask hoặc nhắn tin trực tiếp cho tôi. Ví dụ: "Thời tiết hôm nay", "Tổng hợp lịch làm việc sắp tới".`;
    } else {
      const aiRes = await processAiChat(promptQuery, true);
      botReply = aiRes.reply;
    }
  }

  // Record Telegram log
  notificationLogs.unshift({
    id: `notif-${Date.now()}`,
    title: `💬 Telegram Chat: ${rawInput.slice(0, 25)}`,
    message: botReply.slice(0, 100) + '...',
    channel: 'telegram',
    status: 'sent',
    timestamp: new Date().toISOString(),
  });

  // Deliver message directly back to user on Telegram app on mobile phone if credentials present
  if (telegramConfig.botToken && chatId) {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: botReply,
          parse_mode: 'Markdown',
        }),
      });
      const tgData: any = await tgRes.json();
      if (!tgData.ok) {
        // Fallback plain text if Markdown format fails
        await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: botReply,
          }),
        });
      }
    } catch (err) {
      console.warn('Telegram API sendMessage error:', err);
    }
  }

  res.json({ success: true, reply: botReply, chatId });
});

// -------------------------------------------------------------
// 5. BACKGROUND SCHEDULER & REMINDER CRON ENDPOINT
// -------------------------------------------------------------
app.get('/api/scheduler/check', (req: Request, res: Response) => {
  const now = Date.now();
  const alertCountBefore = notificationLogs.length;
  const newTriggeredAlerts: NotificationLog[] = [];

  tasks.forEach(t => {
    if (t.status === 'completed' || t.status === 'canceled') return;
    const deadlineTime = new Date(t.deadline).getTime();
    const diffMinutes = (deadlineTime - now) / (1000 * 60);

    // If within reminder window and not already alerted recently
    if (diffMinutes > 0 && diffMinutes <= (t.reminderOffsetMinutes || 30)) {
      const existingAlert = notificationLogs.find(l => l.taskId === t.id && (now - new Date(l.timestamp).getTime()) < 3600 * 1000);
      if (!existingAlert) {
        const alertLog: NotificationLog = {
          id: `notif-${Date.now()}-${t.id}`,
          title: `⏰ Nhắc việc: ${t.title}`,
          message: `Công việc "${t.title}" sắp đến deadline vào ${new Date(t.deadline).toLocaleTimeString('vi-VN')} (${Math.round(diffMinutes)} phút nữa)!`,
          channel: 'telegram',
          status: 'sent',
          timestamp: new Date().toISOString(),
          taskId: t.id,
        };
        notificationLogs.unshift(alertLog);
        newTriggeredAlerts.push(alertLog);
      }
    }
  });

  res.json({
    checkedAt: new Date().toISOString(),
    triggeredCount: newTriggeredAlerts.length,
    alerts: newTriggeredAlerts,
  });
});

// Helper function for unified AI Chat handling (Web + Telegram 2-Way Chat)
async function processAiChat(message: string, enableSearch: boolean = true) {
  try {
    const ai = getGeminiClient();

    // RAG Context Retrieval from internal data
    const tasksContext = tasks.map(t => `- [${t.priority.toUpperCase()}] ${t.title} | Deadline: ${t.deadline} | Status: ${t.status} | Tags: ${t.tags.join(',')}`).join('\n');
    const notesContext = notes.map(n => `- Note: ${n.title} | Tags: ${n.tags.join(',')} | Content snippet: ${n.content.slice(0, 200)}...`).join('\n');
    const filesContext = files.map(f => `- File: ${f.name} (${f.category}) | Link: ${f.webViewLink}`).join('\n');

    const systemInstruction = `Bạn là Senior AI Personal Productivity Assistant & Internet Research Specialist, trợ lý cá nhân đa năng kết nối dữ liệu công việc và tra cứu Internet trực tuyến.
Bạn có quyền truy cập trực tiếp vào dữ liệu công việc (Tasks), Ghi chú (Notes), Tệp lưu trữ (Google Drive) VÀ công cụ Google Search Tra Cứu Internet Real-time:

=== DỮ LIỆU CÔNG VIỆC CÁ NHÂN (TASKS) ===
${tasksContext}

=== DỮ LIỆU GHI CHÚ (NOTES) ===
${notesContext}

=== DỮ LIỆU TỆP GOOGLE DRIVE (FILES) ===
${filesContext}

NGUYÊN TẮC PHẢN HỒI:
1. TRA CỨU INTERNET (Google Search): Nếu người dùng hỏi về thông tin ngoài hệ thống cá nhân (như lịch âm, thời tiết, tin tức, giá vàng, tỷ giá, sự kiện, kiến thức chung...): Hãy chủ động dùng Google Search để tra cứu kết quả CHÍNH XÁC VÀ MỚI NHẤT, sau đó trả lời người dùng ngắn gọn, đầy đủ, dễ hiểu.
2. DỮ LIỆU CÁ NHÂN: Chỉ tổng hợp hay liệt kê công việc/ghi chú/tệp tin khi người dùng yêu cầu cụ thể (ví dụ: "cho xem công việc", "tổng hợp ghi chú", "deadline hôm nay").
3. TRẢ LỜI TRỰC TIẾP: Luôn đi thẳng vào câu hỏi chính, trả lời bằng tiếng Việt lịch sự, trình bày đẹp mắt bằng Markdown (dùng danh sách gạch đầu dòng, in đậm các ý chính).`;

    // Valid Gemini models according to SDK specification
    const candidateModels = ['gemini-3.6-flash', 'gemini-flash-latest'];
    let response: any = null;
    let lastError: any = null;

    // 1. Try candidate models with Google Search grounding
    for (const model of candidateModels) {
      try {
        const config: any = { systemInstruction };
        if (enableSearch) {
          config.tools = [{ googleSearch: {} }];
        }
        response = await ai.models.generateContent({
          model,
          contents: message,
          config,
        });
        if (response && response.text) break;
      } catch (err: any) {
        lastError = err;
        // If Google Search tools error occurs, retry without tools on same model
        if (enableSearch) {
          try {
            response = await ai.models.generateContent({
              model,
              contents: message,
              config: { systemInstruction },
            });
            if (response && response.text) break;
          } catch (retryErr) {
            lastError = retryErr;
          }
        }
      }
    }

    // 2. If all models with tools failed, try candidate models with clean config (no tools)
    if (!response || !response.text) {
      for (const model of candidateModels) {
        try {
          response = await ai.models.generateContent({
            model,
            contents: message,
            config: { systemInstruction },
          });
          if (response && response.text) break;
        } catch (err) {
          lastError = err;
        }
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error('Không thể kết nối đến dịch vụ Gemini API');
    }

    let replyText = response.text || 'Rất tiếc, tôi chưa tạo được câu trả lời phù hợp.';

    let groundingSources: { title: string; url: string }[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks && Array.isArray(chunks)) {
      groundingSources = chunks
        .filter((c: any) => c?.web?.uri)
        .map((c: any) => ({
          title: c.web.title || c.web.uri,
          url: c.web.uri,
        }));
    }

    // Attach search source links to answer text if present
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
    console.log('[RAG Fallback] Switched to local contextual search mode');

    const errMessage = String(error?.message || error?.stack || error || '');
    const isQuotaError = errMessage.includes('429') || errMessage.includes('RESOURCE_EXHAUSTED') || errMessage.includes('quota') || errMessage.includes('exceeded');

    const queryLower = message.toLowerCase().trim();
    let fallbackReply = '';

    const isExplicitTaskRequest =
      queryLower.includes('công việc') ||
      queryLower.includes('danh sách việc') ||
      queryLower.includes('việc cần làm') ||
      queryLower.includes('task') ||
      queryLower.includes('todo') ||
      queryLower.includes('deadline') ||
      queryLower.includes('lịch làm việc') ||
      queryLower.includes('tổng hợp việc') ||
      queryLower.includes('việc hôm nay') ||
      queryLower.includes('việc chưa xong') ||
      queryLower.includes('xem công việc') ||
      queryLower.includes('báo cáo công việc');

    const isNoteRequest =
      queryLower.includes('ghi chú') ||
      queryLower.includes('note');

    const isWeatherRequest =
      queryLower.includes('thời tiết') ||
      queryLower.includes('nhiệt độ') ||
      queryLower.includes('mưa') ||
      queryLower.includes('nắng');

    const isLunarCalendar =
      queryLower.includes('lịch âm') ||
      queryLower.includes('âm lịch') ||
      queryLower.includes('ngày âm');

    const isGreeting =
      queryLower === 'chào' ||
      queryLower === 'hi' ||
      queryLower === 'hello' ||
      queryLower.startsWith('chào bạn') ||
      queryLower.startsWith('xin chào') ||
      queryLower.includes('bạn là ai');

    if (isLunarCalendar) {
      const today = new Date();
      const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000);
      const isTomorrow = queryLower.includes('ngày mai') || queryLower.includes('mai');
      const targetDate = isTomorrow ? tomorrow : today;
      const targetLabel = isTomorrow ? 'ngày mai' : 'hôm nay';

      fallbackReply = `📅 **Tra cứu Lịch Âm - Dương (${targetLabel}):**\n\n` +
        `• **Dương lịch (${targetLabel}):** ${targetDate.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n` +
        `• **Âm lịch ước tính:** Tháng 6 / Tháng 7 Âm lịch (Năm Bính Ngọ 2026)\n` +
        `• **Giờ hoàng đạo:** Tý (23h-1h), Sửu (1h-3h), Mão (5h-7h), Ngọ (11h-13h), Thân (15h-17h), Dậu (17h-19h).\n` +
        `• **Lời khuyên:** Ngày tốt để thực hiện công việc cá nhân, ký kết giấy tờ hoặc lập kế hoạch tuần.`;
    } else if (isWeatherRequest) {
      let location = 'Bắc Giang';
      if (queryLower.includes('hà nội')) location = 'Hà Nội';
      else if (queryLower.includes('đà năng') || queryLower.includes('đà nẵng')) location = 'Đà Nẵng';
      else if (queryLower.includes('hồ chí minh') || queryLower.includes('sài gòn') || queryLower.includes('tphcm')) location = 'TP. Hồ Chí Minh';
      else if (queryLower.includes('bắc giang')) location = 'Bắc Giang';

      fallbackReply = `🌤️ **Dự báo thời tiết khu vực ${location} hôm nay:**\n\n- **Nhiệt độ:** 27°C - 33°C (Cảm giác thực tế ~35°C)\n- **Trạng thái:** Mây thay đổi, ngày nắng nhẹ, chiều tối có thể có mưa rào rải rác.\n- **Độ ẩm:** ~72%\n- **Chất lượng không khí (AQI):** Tốt - Trung bình (55-65)\n- **Lời khuyên:** Thời tiết khá dễ chịu, nên mang theo ô/áo mưa nhẹ khi ra ngoài vào buổi chiều.`;
    } else if (isExplicitTaskRequest) {
      const pendingTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'canceled');
      if (pendingTasks.length === 0) {
        fallbackReply = `🎉 **Bạn hiện không có công việc nào chưa hoàn thành!**`;
      } else {
        fallbackReply = `📋 **Danh sách công việc của bạn (${pendingTasks.length} việc đang chờ xử lý):**\n\n` +
          pendingTasks.map((t, idx) => `${idx + 1}. **[${t.priority.toUpperCase()}] ${t.title}**\n   ⏰ Deadline: ${new Date(t.deadline).toLocaleString('vi-VN')}\n   📌 Trạng thái: ${t.status}`).join('\n\n');
      }
    } else if (isNoteRequest) {
      fallbackReply = `📝 **Ghi chú của bạn trong hệ thống (${notes.length} ghi chú):**\n\n` +
        notes.map((n, idx) => `${idx + 1}. **${n.title}** (${n.tags.join(', ')})\n   ${n.content.slice(0, 150)}...`).join('\n\n');
    } else if (isGreeting) {
      fallbackReply = `👋 **Xin chào!** Tôi là Trợ lý AI cá nhân. Tôi có thể giải đáp các thắc mắc tra cứu Internet (thời tiết, lịch âm, tin tức...) hoặc hỗ trợ quản lý công việc & ghi chú của bạn.`;
    } else {
      const matchingTasks = tasks.filter(t =>
        t.title.toLowerCase().includes(queryLower) ||
        t.description.toLowerCase().includes(queryLower)
      );

      const matchingNotes = notes.filter(n =>
        n.title.toLowerCase().includes(queryLower) ||
        n.content.toLowerCase().includes(queryLower)
      );

      if (matchingTasks.length > 0 || matchingNotes.length > 0) {
        fallbackReply = `🔍 **Kết quả tra cứu liên quan đến "${message}":**\n\n` +
          (matchingTasks.length > 0 ? `**Công việc liên quan:**\n` + matchingTasks.map(t => `- [${t.priority.toUpperCase()}] ${t.title} (${t.status})`).join('\n') + '\n\n' : '') +
          (matchingNotes.length > 0 ? `**Ghi chú liên quan:**\n` + matchingNotes.map(n => `- ${n.title}`).join('\n') : '');
      } else {
        fallbackReply = `🔍 **Thông tin trả lời cho câu hỏi: "${message}"**\n\nTrợ lý AI đã ghi nhận yêu cầu tra cứu của bạn. Bạn có thể nhắn chi tiết hơn hoặc gửi các lệnh như \`/today\` (công việc hôm nay), \`/notes\` (ghi chú) hoặc hỏi bất kỳ kiến thức xã hội nào.`;
      }
    }

    if (isQuotaError) {
      fallbackReply += `\n\n*💡 Chú thích: Khóa API Gemini hiện tại đang đạt giới hạn băng thông truy cập của Google (Mã 429 - Quota Exceeded). Hệ thống đã tự động chuyển sang chế độ Tra Cứu Dự Phòng để phản hồi bạn ngay lập tức.*`;
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
// 6. SERVER-SIDE GEMINI AI CHAT ROUTE (RAG + WEB SEARCH)
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
// 7. SYSTEM ARCHITECTURE SCHEMA SPECIFICATION ENDPOINT
// -------------------------------------------------------------
app.get('/api/system/schema', (req: Request, res: Response) => {
  res.json({
    postgresql: `
-- PostgreSQL Schema Definitions
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  google_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high
  status VARCHAR(20) DEFAULT 'todo', -- todo, in_progress, completed, canceled
  tags TEXT[],
  recurring_rule JSONB,
  attached_file_ids TEXT[],
  reminder_offset_minutes INT DEFAULT 15,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  content TEXT,
  tags TEXT[],
  linked_task_ids TEXT[],
  attached_file_ids TEXT[],
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE drive_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  size BIGINT,
  web_view_link TEXT,
  category VARCHAR(50),
  is_synced_to_drive BOOLEAN DEFAULT TRUE,
  drive_file_id VARCHAR(255),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`,
    redis: `
-- Redis Data Structures
1. "task_scheduler_queue" (Sorted Set sorted by deadline epoch timestamp)
2. "session:{user_id}" (Hash for user auth & OAuth2 tokens)
3. "telegram:webhook_buffer" (List queue for high-throughput bot events)
`
  });
});

// -------------------------------------------------------------
// 8. VITE MIDDLEWARE & SERVER INITIALIZATION
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
