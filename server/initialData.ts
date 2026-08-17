import { Task, Note, DriveFile, TelegramConfig, NotificationLog, UserProfile } from '../src/types/index.js';

export const initialTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Nộp báo cáo tài chính Quý 3 cho Giám đốc',
    description: 'Tổng hợp số liệu doanh thu, chi phí vận hành và lợi nhuận gộp từ các phòng ban.',
    deadline: new Date(Date.now() + 2 * 3600 * 1000).toISOString(), // 2 hours from now
    priority: 'high',
    status: 'todo',
    tags: ['Tài chính', 'Báo cáo', 'Khẩn'],
    recurring: { type: 'monthly', interval: 1 },
    attachedFileIds: ['file-1', 'file-2'],
    reminderOffsetMinutes: 30,
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'task-2',
    title: 'Họp với nhóm Kỹ thuật về Kiến trúc AI RAG Server',
    description: 'Thảo luận về giải pháp lưu trữ Vector DB (Pinecone) và tích hợp Google Drive OAuth2 API.',
    deadline: new Date(Date.now() + 5 * 3600 * 1000).toISOString(), // 5 hours from now
    priority: 'high',
    status: 'in_progress',
    tags: ['AI', 'Architecture', 'Họp'],
    recurring: { type: 'weekly', daysOfWeek: ['Mon', 'Thu'] },
    attachedFileIds: ['file-3'],
    reminderOffsetMinutes: 15,
    createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
  },
  {
    id: 'task-3',
    title: 'Cấu hình Telegram Bot Webhook & Auto Notify Cron',
    description: 'Kiểm tra token Telegram Bot, cấu hình endpoint /api/telegram/webhook và kích hoạt cron scheduler.',
    deadline: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), // 1 day from now
    priority: 'medium',
    status: 'in_progress',
    tags: ['Telegram', 'DevOps'],
    recurring: { type: 'none' },
    attachedFileIds: [],
    reminderOffsetMinutes: 60,
    createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
  },
  {
    id: 'task-4',
    title: 'Review thiết kế UI Dashboard & Note Editor',
    description: 'Đánh giá giao diện Dark/Light mode, độ tương phản và responsive trên mobile.',
    deadline: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    priority: 'low',
    status: 'completed',
    tags: ['UI/UX', 'Design'],
    recurring: { type: 'none' },
    attachedFileIds: [],
    reminderOffsetMinutes: 15,
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: 'task-5',
    title: 'Kiểm tra sao lưu dữ liệu tự động lên Google Drive',
    description: 'Đảm bảo tất cả các ghi chú quan trọng và tệp tin PDF đều được đồng bộ hóa thành công.',
    deadline: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
    priority: 'medium',
    status: 'todo',
    tags: ['Google Drive', 'Backup'],
    recurring: { type: 'daily', interval: 1 },
    attachedFileIds: ['file-4'],
    reminderOffsetMinutes: 30,
    createdAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
  }
];

export const initialNotes: Note[] = [
  {
    id: 'note-1',
    title: 'Kế hoạch triển khai AI Personal Assistant Quý 3',
    content: `# Triển khai Hệ thống AI Personal Productivity Assistant

## 🎯 Mục tiêu
- Xây dựng AI Assistant tích hợp **Task Management**, **Notes**, **Google Drive** và **Telegram Bot**.
- Hệ thống hỗ trợ RAG (Retrieval-Augmented Generation) tìm kiếm dữ liệu nội bộ và Google Search grounding.

## 🛠️ Công nghệ chủ đạo
1. **Frontend**: React 19 + Vite + Tailwind CSS + Lucide Icons + Motion.
2. **Backend**: Express.js REST API + Node.js Cron Scheduler.
3. **AI Layer**: Gemini 3.6 Flash với Search Grounding & Dynamic Context RAG.
4. **Integration**: Google Drive Sync & Telegram Webhook Bot.

## 📌 Hướng phát triển tiếp theo
- Triển khai Redis queue xử lý tin nhắn Telegram tốc độ cao.
- Mở rộng Postgres schema cho multi-tenant authentication.`,
    tags: ['Kế hoạch', 'AI', 'Architecture'],
    linkedTaskIds: ['task-1', 'task-2'],
    attachedFileIds: ['file-1', 'file-3'],
    isPinned: true,
    createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'note-2',
    title: 'Hướng dẫn sử dụng Telegram Bot & Lệnh hỗ trợ',
    content: `# Telegram Bot Commands & Workflow

Bot hỗ trợ kiểm tra công việc và truy vấn AI trực tiếp từ nhắn tin Telegram:

- \`/tasks\` : Hiển thị toàn bộ danh sách công việc đang chờ xử lý.
- \`/today\` : Danh sách các công việc có deadline trong ngày hôm nay.
- \`/ask <câu hỏi>\` : Hỏi trực tiếp AI Assistant (truy vấn task, ghi chú hoặc tìm kiếm internet).
- \`/notes\` : Xem nhanh các ghi chú ghim quan trọng.

⚡ *Mẹo*: Đảm bảo đã nhập đúng Telegram Bot Token và Chat ID trong bảng Cấu hình.`,
    tags: ['Telegram', 'Hướng dẫn'],
    linkedTaskIds: ['task-3'],
    attachedFileIds: [],
    isPinned: true,
    createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'note-3',
    title: 'Ghi chú cuộc họp Chiến lược Hạ tầng Cloud & OAuth2',
    content: `### Nội dung cuộc họp ngày 08/08:
- Đã thống nhất luồng OAuth2 Google Drive với quy trình đính kèm tệp linh hoạt.
- Đặt thời hạn tự động nhắc nhở mặc định là 15-30 phút trước mốc deadline.
- AI Chat chỉ hoạt động On-Demand để tối ưu chi phí API và độ chính xác dữ liệu.`,
    tags: ['Họp', 'OAuth2', 'Cloud'],
    linkedTaskIds: ['task-2'],
    attachedFileIds: ['file-2'],
    isPinned: false,
    createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
  }
];

export const initialFiles: DriveFile[] = [
  {
    id: 'file-1',
    name: 'Bao_Cao_Tai_Chinh_Q3_2026.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: 2458000, // 2.45 MB
    category: 'spreadsheet',
    isSyncedToDrive: false,
    syncStatus: 'local_only',
    uploadedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    textContent: 'Mã số, Khoản mục, Kế hoạch, Thực hiện, Tỷ lệ (%)\n01, Doanh thu phần mềm SaaS, 1.200.000.000, 1.350.000.000, 112.5%\n02, Chi phí Cloud Firestore & Gemini API, 85.000.000, 62.000.000, 72.9%\n03, Lợi nhuận gộp, 1.115.000.000, 1.288.000.000, 115.5%'
  },
  {
    id: 'file-2',
    name: 'So_Do_Kien_Truc_He_Thong_AI_Assistant.pdf',
    mimeType: 'application/pdf',
    size: 4120000, // 4.12 MB
    category: 'pdf',
    isSyncedToDrive: false,
    syncStatus: 'local_only',
    uploadedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    textContent: '# KIẾN TRÚC HỆ THỐNG AI PERSONAL PRODUCTIVITY ASSISTANT\n\n1. Client Tier: React 19 + Tailwind CSS + Google Drive OAuth 2.0 Client\n2. Server Tier: Express REST Engine + Background Telegram Polling & Webhook\n3. Storage Tier: Local JSON Vault & Google Drive API v3 Two-Way Synchronization\n4. AI Tier: Gemini 3.7 Flash + Multi-Model Fallback Chain & Grounding'
  },
  {
    id: 'file-3',
    name: 'Slide_Thuyet_Minh_Du_An_AI_Productivity.pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    size: 8900000, // 8.9 MB
    category: 'presentation',
    isSyncedToDrive: false,
    syncStatus: 'local_only',
    uploadedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    textContent: 'SLIDE 1: TỔNG QUAN DỰ ÁN TRỢ LÝ NĂNG SUẤT THÔNG MINH\nSLIDE 2: BÀI TOÁN QUẢN LÝ TASK & DRIVE RỜI RẠC\nSLIDE 3: GIẢI PHÁP TÍCH HỢP TOÀN DIỆN TELEGRAM + AI + DRIVE\nSLIDE 4: LỘ TRÌNH TRIỂN KHAI VÀ HIỆU QUẢ KINH TẾ'
  },
  {
    id: 'file-4',
    name: 'Backup_Database_Schema_PostgreSQL.sql',
    mimeType: 'text/plain',
    size: 345000,
    category: 'document',
    isSyncedToDrive: false,
    syncStatus: 'local_only',
    uploadedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    textContent: '-- DATABASE BACKUP DUMP\nCREATE TABLE IF NOT EXISTS users (id VARCHAR(64) PRIMARY KEY, email VARCHAR(255) NOT NULL);\nCREATE TABLE IF NOT EXISTS tasks (id VARCHAR(64) PRIMARY KEY, title TEXT NOT NULL, deadline TIMESTAMP, status VARCHAR(32));\nCREATE TABLE IF NOT EXISTS drive_files (id VARCHAR(64) PRIMARY KEY, name VARCHAR(255), is_synced BOOLEAN, drive_file_id VARCHAR(255));'
  }
];

export const initialTelegramConfig: TelegramConfig = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '7891234560:AAH8xY_demo_token_productivity_ai',
  chatId: process.env.TELEGRAM_CHAT_ID || '123456789',
  enabled: true,
  alertOffsetMinutes: 15,
  isConnected: true,
  timezone: 'Asia/Ho_Chi_Minh',
  morningBriefingHour: 7,
  morningBriefingMinute: 0,
  eveningBriefingHour: 21,
  eveningBriefingMinute: 0,
  enableMorningBriefing: true,
  enableEveningBriefing: true,
};

export const initialNotificationLogs: NotificationLog[] = [
  {
    id: 'notif-1',
    title: '⏰ Đã gửi nhắc nhở Telegram',
    message: 'Task: Nộp báo cáo tài chính Quý 3 cho Giám đốc (Deadline trong 2 giờ nữa!)',
    channel: 'telegram',
    status: 'sent',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    taskId: 'task-1',
  },
  {
    id: 'notif-2',
    title: '🤖 AI Bot Telegram đã phản hồi /today',
    message: 'Đã gửi danh sách 2 công việc bận rộn trong ngày cho người dùng qua Chat ID 123456789.',
    channel: 'telegram',
    status: 'sent',
    timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  }
];

export const initialUserProfile: UserProfile = {
  name: 'Senior Fullstack Architect',
  email: 'ngmha8@gmail.com',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
  isGoogleConnected: true,
};
