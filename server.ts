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
let genAIClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
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

app.post('/api/telegram/test', (req: Request, res: Response) => {
  const newLog: NotificationLog = {
    id: `notif-${Date.now()}`,
    title: '💬 Kiểm tra kết nối Telegram Bot',
    message: req.body.message || 'Xin chào! Hệ thống AI Personal Assistant đã kết nối Telegram thành công!',
    channel: 'telegram',
    status: 'sent',
    timestamp: new Date().toISOString(),
  };
  notificationLogs.unshift(newLog);
  res.json({ success: true, log: newLog });
});

// Telegram Bot Webhook Endpoint (Processes /tasks, /today, /notes, /ask)
app.post('/api/telegram/webhook', async (req: Request, res: Response) => {
  const { command, text } = req.body;
  const inputCmd = (command || text || '').trim();

  let botReply = '';

  if (inputCmd.startsWith('/start') || inputCmd.startsWith('/help')) {
    botReply = `🤖 *AI Productivity Assistant Bot*\n\nCác lệnh hỗ trợ:\n• \`/today\` - Công việc có deadline hôm nay\n• \`/tasks\` - Tất cả công việc cần làm\n• \`/notes\` - Danh sách ghi chú quan trọng\n• \`/ask <câu hỏi>\` - Hỏi AI Assistant về dữ liệu cá nhân hoặc internet`;
  } else if (inputCmd.startsWith('/today')) {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTasks = tasks.filter(t => t.deadline.startsWith(todayStr) || (t.status !== 'completed' && t.status !== 'canceled'));
    if (todayTasks.length === 0) {
      botReply = `🎉 *Hôm nay bạn không có deadline công việc nào chưa hoàn thành!*`;
    } else {
      botReply = `📅 *Danh sách công việc bận rộn trong ngày (${todayTasks.length}):*\n\n` +
        todayTasks.map((t, idx) => `${idx + 1}. [${t.priority.toUpperCase()}] *${t.title}*\n   ⏰ Deadline: ${new Date(t.deadline).toLocaleString('vi-VN')}\n   📌 Trạng thái: ${t.status}`).join('\n\n');
    }
  } else if (inputCmd.startsWith('/tasks')) {
    const pending = tasks.filter(t => t.status !== 'completed');
    botReply = `📋 *Danh sách công việc chưa hoàn thành (${pending.length}):*\n\n` +
      pending.map((t, idx) => `${idx + 1}. *${t.title}* (${t.priority})\n   ⏰ ${new Date(t.deadline).toLocaleDateString('vi-VN')}`).join('\n\n');
  } else if (inputCmd.startsWith('/notes')) {
    botReply = `📝 *Ghi chú quan trọng (${notes.length}):*\n\n` +
      notes.slice(0, 5).map((n, idx) => `${idx + 1}. *${n.title}* (${n.tags.join(', ')})`).join('\n');
  } else if (inputCmd.startsWith('/ask')) {
    const userQuery = inputCmd.replace('/ask', '').trim();
    if (!userQuery) {
      botReply = `⚠️ Vui lòng nhập câu hỏi sau lệnh /ask. Ví dụ: \`/ask Hôm nay tôi có việc gì khẩn?\``;
    } else {
      try {
        const ai = getGeminiClient();
        const contextPrompt = `Dữ liệu công việc hiện tại của user: ${JSON.stringify(tasks.map(t => ({ title: t.title, deadline: t.deadline, priority: t.priority, status: t.status })))}\n\nTrả lời ngắn gọn cho Telegram user về: "${userQuery}"`;
        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: contextPrompt,
        });
        botReply = `💡 *AI Phản hồi:* \n\n${response.text || 'Không có phản hồi từ AI.'}`;
      } catch (err) {
        botReply = `🤖 *AI Phản hồi:* Tôi đã nhận được câu hỏi: "${userQuery}".\n(Hiện tại bạn có ${tasks.filter(t => t.status !== 'completed').length} công việc đang chờ làm).`;
      }
    }
  } else {
    botReply = `🤖 Tôi nhận được: "${inputCmd}". Nhập \`/help\` để xem danh sách lệnh!`;
  }

  // Record Telegram bot log
  notificationLogs.unshift({
    id: `notif-${Date.now()}`,
    title: `🤖 Telegram Command: ${inputCmd.slice(0, 20)}`,
    message: botReply.slice(0, 100) + '...',
    channel: 'telegram',
    status: 'sent',
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, reply: botReply });
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

// -------------------------------------------------------------
// 6. SERVER-SIDE GEMINI AI CHAT ROUTE (RAG + WEB SEARCH)
// -------------------------------------------------------------
app.post('/api/chat', async (req: Request, res: Response) => {
  const { message, enableSearch } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message text is required.' });
  }

  try {
    const ai = getGeminiClient();

    // RAG Context Retrieval from internal data
    const tasksContext = tasks.map(t => `- [${t.priority.toUpperCase()}] ${t.title} | Deadline: ${t.deadline} | Status: ${t.status} | Tags: ${t.tags.join(',')}`).join('\n');
    const notesContext = notes.map(n => `- Note: ${n.title} | Tags: ${n.tags.join(',')} | Content snippet: ${n.content.slice(0, 200)}...`).join('\n');
    const filesContext = files.map(f => `- File: ${f.name} (${f.category}) | Link: ${f.webViewLink}`).join('\n');

    const systemInstruction = `Bạn là Senior AI Personal Productivity Assistant, một trợ lý cá nhân thông minh tuyệt đối tin cậy.
Bạn có quyền truy cập trực tiếp vào hệ thống dữ liệu công việc (Tasks), Ghi chú (Notes), và Tệp lưu trữ (Google Drive) của người dùng:

=== DỮ LIỆU CÔNG VIỆC (TASKS) ===
${tasksContext}

=== DỮ LIỆU GHI CHÚ (NOTES) ===
${notesContext}

=== DỮ LIỆU TỆP GOOGLE DRIVE (FILES) ===
${filesContext}

NGUYÊN TẮC PHẢN HỒI:
1. Khi người dùng hỏi về công việc, deadline, ghi chú, tệp tin ("Hôm nay có việc gì?", "Deadline của tài liệu A?", "Tóm tắt ghi chú X"), hãy trả lời chính xác, mạch lạc, có cấu trúc sử dụng định dạng Markdown.
2. Khi người dùng hỏi thông tin kiến thức ngoài hoặc xu hướng tin tức, hãy bật Search Grounding và tổng hợp ngắn gọn.
3. Luôn giữ phong cách giao tiếp lịch sự, chuyên nghiệp, hỗ trợ tối đa cho năng suất làm việc của người dùng.
4. Trả lời bằng tiếng Việt trừ khi người dùng yêu cầu ngôn ngữ khác.`;

    const config: any = {
      systemInstruction,
    };

    if (enableSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: message,
      config,
    });

    const replyText = response.text || 'Rất tiếc, tôi chưa tạo được câu trả lời phù hợp.';

    // Extract Grounding Sources if available
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

    res.json({
      reply: replyText,
      groundingSources,
      retrievedContext: {
        tasksCount: tasks.length,
        notesCount: notes.length,
        filesCount: files.length,
      },
    });
  } catch (error: any) {
    console.error('Gemini API Chat Error:', error);
    res.status(500).json({
      error: 'Không thể xử lý phản hồi từ AI Assistant.',
      details: error.message || String(error),
    });
  }
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
