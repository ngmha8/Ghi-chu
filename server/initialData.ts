import { Task, Note, DriveFile, TelegramConfig, NotificationLog, UserProfile } from '../src/types/index.js';

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
