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

export interface DocumentCategory {
  id: string;
  name: string; // e.g. "Công việc", "Cá nhân", "Mẫu giấy tờ", "Tài chính & Hóa đơn", "Hợp đồng & Pháp lý", "Dự án"
  color: string; // 'emerald' | 'amber' | 'blue' | 'purple' | 'rose' | 'teal' | 'indigo' | 'cyan' | 'zinc'
  icon?: string; // 'Briefcase' | 'User' | 'FileCheck' | 'DollarSign' | 'Scale' | 'FolderKanban' | 'FileText' | 'Bookmark'
  description?: string;
  isDefault?: boolean;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number; // in bytes
  webViewLink?: string;
  category: 'document' | 'spreadsheet' | 'presentation' | 'pdf' | 'image' | 'archive' | 'other';
  classification?: string; // ID or name of DocumentCategory e.g. 'work' | 'personal' | 'templates' | 'finance' | 'legal' | 'projects' | 'other'
  tags?: string[];
  isSyncedToDrive: boolean;
  driveFileId?: string;
  uploadedAt: string;
  syncStatus?: 'synced' | 'local_only' | 'syncing' | 'sync_error';
  syncError?: string;
  downloadUrl?: string;
  previewUrl?: string;
  textContent?: string;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
  alertOffsetMinutes: number;
  isConnected: boolean;
  timezone?: string; // default 'Asia/Ho_Chi_Minh' (UTC+7)
  webhookUrl?: string;
  webhookSecret?: string;
  morningBriefingHour?: number; // 0-23, default 7 (7:00 AM VN)
  morningBriefingMinute?: number; // 0-59, default 0
  eveningBriefingHour?: number; // 0-23, default 21 (9:00 PM VN)
  eveningBriefingMinute?: number; // 0-59, default 0
  enableMorningBriefing?: boolean; // default true
  enableEveningBriefing?: boolean; // default true
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

export interface DriveServiceAccountConfig {
  clientEmail: string;
  privateKey: string;
  projectId?: string;
  folderId: string;
  folderName?: string;
  isEnabled: boolean;
  isConnected: boolean;
  lastTestedAt?: string;
  lastSyncAt?: string;
  serviceAccountRawJson?: string;
  errorMessage?: string;
}

export interface UserProfile {
  name: string;
  email: string;
  avatarUrl: string;
  isGoogleConnected: boolean;
}

export interface SecurityPinSettings {
  isEnabled: boolean;
  hasCustomPin: boolean;
  autolockMinutes: number;
  hint: string;
  updatedAt?: string;
}
