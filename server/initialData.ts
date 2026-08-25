import { Task, Note, DriveFile, TelegramConfig, NotificationLog, UserProfile, DocumentCategory } from '../src/types/index.js';

export const initialCategories: DocumentCategory[] = [
  {
    id: 'work',
    name: 'Công việc',
    color: 'emerald',
    icon: 'Briefcase',
    description: 'Tài liệu dự án, công việc chuyên môn, quy trình công ty',
    isDefault: true,
  },
  {
    id: 'personal',
    name: 'Cá nhân',
    color: 'blue',
    icon: 'User',
    description: 'Giấy tờ tùy thân, tài liệu học tập, hồ sơ cá nhân',
    isDefault: true,
  },
  {
    id: 'templates',
    name: 'Mẫu giấy tờ',
    color: 'amber',
    icon: 'FileCheck',
    description: 'Biểu mẫu, tờ trình, mẫu đơn, template báo cáo chuẩn',
    isDefault: true,
  },
  {
    id: 'finance',
    name: 'Tài chính',
    color: 'teal',
    icon: 'DollarSign',
    description: 'Báo cáo tài chính, hóa đơn, bảng kê chi phí, ngân sách',
    isDefault: true,
  },
  {
    id: 'legal',
    name: 'Hợp đồng',
    color: 'rose',
    icon: 'Scale',
    description: 'Hợp đồng lao động, hợp đồng kinh tế, văn bản pháp lý',
    isDefault: true,
  },
  {
    id: 'projects',
    name: 'Dự án',
    color: 'purple',
    icon: 'FolderKanban',
    description: 'Kế hoạch triển khai, thuyết minh dự án, sơ đồ kiến trúc',
    isDefault: true,
  },
  {
    id: 'other',
    name: 'Khác',
    color: 'zinc',
    icon: 'FileText',
    description: 'Tài liệu tổng hợp hoặc chưa phân nhóm cụ thể',
    isDefault: true,
  },
];

export const initialTasks: Task[] = [];

export const initialNotes: Note[] = [];

export const initialFiles: DriveFile[] = [];

export const initialTelegramConfig: TelegramConfig = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.TELEGRAM_CHAT_ID || '',
  enabled: true,
  alertOffsetMinutes: 15,
  isConnected: false,
  timezone: 'Asia/Ho_Chi_Minh',
  morningBriefingHour: 7,
  morningBriefingMinute: 0,
  eveningBriefingHour: 21,
  eveningBriefingMinute: 0,
  enableMorningBriefing: true,
  enableEveningBriefing: true,
};

export const initialNotificationLogs: NotificationLog[] = [];

export const initialUserProfile: UserProfile = {
  name: 'User',
  email: 'ngmha8@gmail.com',
  avatarUrl: '',
  isGoogleConnected: false,
};
