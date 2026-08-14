export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'canceled';

export type RecurringType = 'none' | 'hourly' | 'daily' | 'weekly' | 'monthly';

export interface RecurringRule {
  type: RecurringType;
  interval?: number;
  daysOfWeek?: string[]; // ['Mon', 'Wed', 'Fri']
}

export interface Task {
  id: string;
  title: string;
  description: string;
  deadline: string; // ISO string or YYYY-MM-DDTHH:mm
  priority: TaskPriority;
  status: TaskStatus;
  tags: string[];
  recurring: RecurringRule;
  attachedFileIds: string[];
  reminderOffsetMinutes: number; // e.g., 15 mins before deadline
  isNotified?: boolean; // Anti-duplicate reminder flag
  lastNotifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string; // Markdown / Rich text
  tags: string[];
  linkedTaskIds: string[];
  attachedFileIds: string[];
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number; // in bytes
  webViewLink?: string;
  category: 'document' | 'spreadsheet' | 'presentation' | 'pdf' | 'image' | 'archive' | 'other';
  isSyncedToDrive: boolean;
  driveFileId?: string;
  uploadedAt: string;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
  alertOffsetMinutes: number;
  isConnected: boolean;
}

export interface NotificationLog {
  id: string;
  title: string;
  message: string;
  channel: 'telegram' | 'in_app';
  status: 'sent' | 'failed' | 'scheduled';
  timestamp: string;
  taskId?: string;
}

export interface GroundingSource {
  title: string;
  url: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  groundingSources?: GroundingSource[];
  retrievedContext?: {
    tasks?: string[];
    notes?: string[];
    files?: string[];
  };
  isLoading?: boolean;
}

export interface UserProfile {
  name: string;
  email: string;
  avatarUrl: string;
  isGoogleConnected: boolean;
}
