export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'canceled';

export interface TaskAnalysisStep {
  step: number;
  title: string;
  description: string;
  estimatedMinutes?: number;
}

export interface TaskAnalysisResult {
  summary: string;
  urgencyEvaluation: {
    level: 'critical' | 'high' | 'medium' | 'low';
    score: number; // 0 - 100
    label: string;
    explanation: string;
  };
  complexityEvaluation: {
    level: 'simple' | 'moderate' | 'complex';
    label: string;
    explanation: string;
  };
  keyTakeaways: string[];
  actionPlan: TaskAnalysisStep[];
  suggestedCompletionWindow: string;
  markdownReport: string;
}

export type RecurringUnit = 'day' | 'month' | 'year' | 'week' | 'hour';
export type RecurringType = 'none' | 'interval' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurringRule {
  type: RecurringType;
  unit?: RecurringUnit; // Đơn vị: ngày, tháng, năm, tuần, giờ
  interval?: number; // Khoảng thời gian: e.g. 1, 3, 6, 12...
  repeatOnComplete?: boolean; // Tự động dời thời gian cảnh báo sang chu kỳ tiếp theo sau khi hoàn thành
  daysOfWeek?: string[]; // ['Mon', 'Wed', 'Fri']
  completedCycles?: number; // Số chu kỳ đã hoàn thành
  lastCompletedAt?: string; // Thời điểm hoàn thành gần nhất
  originalDeadline?: string; // Hạn chót gốc ban đầu
}

export interface Task {
  id: string;
  order?: number;
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
  overdueReminderCount?: number; // Số lần đã gửi thông báo nhắc lại khi quá hạn
  lastOverdueNotifiedAt?: string; // Thời điểm gửi thông báo nhắc lại gần nhất
  stopOverdueReminders?: boolean; // Tắt nhắc nhở quá hạn cho riêng công việc này
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
  noteDate?: string; // Thời gian ghi chú do người dùng chọn/nhập (ISO string)
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
  notes?: string; // Chú thích / ghi chú chi tiết cho tài liệu để tìm kiếm nhanh
  description?: string; // Mô tả vắn tắt hoặc trích xuất tóm lược
  isSyncedToDrive: boolean;
  driveFileId?: string;
  uploadedAt: string;
  syncStatus?: 'synced' | 'local_only' | 'syncing' | 'sync_error';
  syncError?: string;
  downloadUrl?: string;
  previewUrl?: string;
  textContent?: string;
  base64Data?: string;
  thumbnailUrl?: string;
  storageType?: 'drive' | 'gcs' | 'firestore_vault' | 'disk';
  storagePath?: string;
  hasBinary?: boolean;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
  alertOffsetMinutes: number;
  isConnected: boolean;
  timezone?: string; // default 'Asia/Ho_Chi_Minh' (UTC+7)
  location?: string; // default 'Bắc Giang'
  webhookUrl?: string;
  webhookSecret?: string;
  morningBriefingHour?: number; // 0-23, default 7 (7:00 AM VN)
  morningBriefingMinute?: number; // 0-59, default 0
  eveningBriefingHour?: number; // 0-23, default 21 (9:00 PM VN)
  eveningBriefingMinute?: number; // 0-59, default 0
  enableMorningBriefing?: boolean; // default true
  enableEveningBriefing?: boolean; // default true
  lastMorningBriefingDate?: string; // e.g. '2026-08-30'
  lastMorningBriefingSentAt?: string; // ISO string
  lastEveningBriefingDate?: string; // e.g. '2026-08-30'
  lastEveningBriefingSentAt?: string; // ISO string

  // Overdue Recurring Reminder / Nagging Settings
  enableOverdueReminders?: boolean; // Bật/tắt gửi thông báo nhắc lại khi đến hạn mà chưa hoàn thành hoặc gia hạn
  overdueReminderIntervalMinutes?: number; // Khoảng thời gian giãn cách giữa các lần gửi nhắc lại (phút): 15, 30, 45, 60, 120...
  maxOverdueReminders?: number; // Số lần gửi nhắc lại tối đa: 1, 3, 5, 10, 0 = không giới hạn
  escalateOverdueTone?: boolean; // Tự động leo thang cấp độ cảnh báo AI và đưa ra gợi ý giải quyết khi quá hạn kéo dài
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
  location?: string; // e.g. 'Bắc Giang'
}

export interface SecurityPinSettings {
  isEnabled: boolean;
  hasCustomPin: boolean;
  autolockMinutes: number;
  hint: string;
  updatedAt?: string;
}

export type AiMemoryCategory = 'preference' | 'identity' | 'rule' | 'workflow' | 'domain_knowledge' | 'habit';

export interface AiMemoryFact {
  id: string;
  category: AiMemoryCategory;
  fact: string;
  confidence: number; // 0.1 to 1.0
  source: 'chat' | 'voice' | 'explicit' | 'reflection' | 'task_pattern';
  occurrences: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiLearningInsight {
  id: string;
  title: string;
  summary: string;
  actionableAdvice: string;
  category: 'productivity' | 'focus' | 'workload' | 'pattern';
  generatedAt: string;
  confidenceScore: number;
}

export interface AiLearningStats {
  totalMemories: number;
  activeMemoriesCount: number;
  insightsCount: number;
  topCategories: { category: string; count: number }[];
  learningLevel: string; // 'Tập sự' | 'Thấu hiểu' | 'Đồng hành thông thái' | 'Cố vấn tri kỷ'
  learningScore: number; // 0 - 100
  lastReflectedAt?: string;
}

export type AiCommunicationStyle = 'warm_empathetic' | 'executive_concise' | 'strategic_advisor' | 'energetic_action';

export interface AiPersonaConfig {
  userHonorific: string; // e.g. "Anh Nam", "Chị Hà", "Bạn", "Tôi", "Alex", "Sếp"
  aiHonorific: string; // e.g. "Em", "Tôi", "Trợ lý", "Tiểu Mai", "Jarvis"
  communicationStyle: AiCommunicationStyle;
  focusDomain: string; // e.g. "Công nghệ, Quản trị dự án & Năng suất", "Y tế & An toàn", "Kinh doanh & Tài chính"
  location?: string; // e.g. "Bắc Giang"
  speechRate: number; // 0.8 to 1.5, default 1.05
  speechPitch: number; // 0.8 to 1.3, default 1.0
  autoSpeakResponse: boolean;
  customInstructions?: string; // e.g. "Luôn ghi chú các việc gấp lên trước, tóm tắt ý chính"
  updatedAt?: string;
}

export type AppTheme = 'dark' | 'light';

