import type {
  Task,
  Note,
  DriveFile,
  TelegramConfig,
  NotificationLog,
  UserProfile,
  DocumentCategory,
  AiMemoryFact,
  AiLearningInsight
} from '../src/types/index.ts';

export const initialCategories: DocumentCategory[] = [
  {
    id: 'unclassified',
    name: 'Chưa xác định',
    color: 'zinc',
    icon: 'HelpCircle',
    description: 'Tài liệu mới tải lên chờ phân loại cụ thể',
    isDefault: true,
  },
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
  location: 'Bắc Giang',
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
  location: 'Bắc Giang',
};

export const initialAiMemories: AiMemoryFact[] = [
  {
    id: 'mem-location',
    category: 'identity',
    fact: 'Người dùng đang sinh sống và làm việc tại Bắc Giang (Việt Nam). Mọi câu hỏi chung về thời tiết, khu vực hoặc ngữ cảnh địa phương khi không nêu rõ tên thành phố khác mặc định phải áp dụng tại Bắc Giang.',
    confidence: 1.0,
    source: 'explicit',
    occurrences: 10,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mem-1',
    category: 'preference',
    fact: 'Người dùng đánh giá cao phong cách giao tiếp súc tích, trực diện, luận điểm có cấu trúc gạch đầu dòng rõ ràng và giải pháp có tính hành động cao.',
    confidence: 0.95,
    source: 'reflection',
    occurrences: 4,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mem-2',
    category: 'identity',
    fact: 'Múi giờ hoạt động chuẩn là Việt Nam (Asia/Ho_Chi_Minh / UTC+7). Khung giờ công việc tích cực từ 07:00 đến 22:00.',
    confidence: 0.98,
    source: 'reflection',
    occurrences: 5,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mem-3',
    category: 'domain_knowledge',
    fact: 'Lĩnh vực công tác và quan tâm chính: Phát triển ứng dụng Web hiệu năng cao, Trí tuệ nhân tạo, Tự động hóa quy trình và Quản trị năng suất cá nhân.',
    confidence: 0.92,
    source: 'reflection',
    occurrences: 3,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mem-4',
    category: 'workflow',
    fact: 'Khi tiếp nhận yêu cầu có yếu tố gấp/khẩn cấp, tự động gán độ ưu tiên High và thiết lập thông báo Telegram trước thời hạn 15-30 phút.',
    confidence: 0.9,
    source: 'task_pattern',
    occurrences: 3,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const initialAiInsights: AiLearningInsight[] = [
  {
    id: 'insight-1',
    title: 'Nhịp sinh học và Hiệu suất Tập trung',
    summary: 'Người dùng thường xử lý các đầu việc chiến lược và công nghệ vào buổi sáng và đầu giờ chiều.',
    actionableAdvice: 'Ưu tiên xếp các công việc tư duy sâu và giải quyết vấn đề kỹ thuật phức tạp vào khung giờ 08:30 - 11:30.',
    category: 'focus',
    confidenceScore: 0.88,
    generatedAt: new Date().toISOString(),
  },
  {
    id: 'insight-2',
    title: 'Tối ưu Hóa Quy Trình Ghi Chú & Quản Lý File',
    summary: 'Các tài liệu công việc và kỹ thuật có xu hướng được tra cứu thường xuyên cùng với các ghi chú liên quan.',
    actionableAdvice: 'Tự động liên kết các tài liệu Drive liên quan khi tạo công việc mới có cùng chủ đề.',
    category: 'productivity',
    confidenceScore: 0.85,
    generatedAt: new Date().toISOString(),
  }
];

export const initialAiPersonaConfig: import('../src/types/index.ts').AiPersonaConfig = {
  userHonorific: 'Bạn',
  aiHonorific: 'Tôi',
  communicationStyle: 'warm_empathetic',
  focusDomain: 'Phát triển ứng dụng Web, Trí tuệ nhân tạo, Tự động hóa & Năng suất',
  location: 'Bắc Giang',
  speechRate: 1.05,
  speechPitch: 1.0,
  autoSpeakResponse: false,
  customInstructions: 'Luôn lắng nghe, thấu cảm, phản hồi nhanh chóng, phân chia các ý chính mạch lạc và hành động dứt khoát.',
  updatedAt: new Date().toISOString(),
};

