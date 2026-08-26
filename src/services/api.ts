import {
  Task,
  Note,
  DriveFile,
  TelegramConfig,
  NotificationLog,
  ChatMessage,
  DriveServiceAccountConfig,
  SecurityPinSettings,
  DocumentCategory,
  AiMemoryFact,
  AiLearningInsight,
  AiLearningStats,
  AiPersonaConfig
} from '../types/index.js';

export const api = {
  // Category Endpoints (Document Classification)
  getCategories: async (): Promise<DocumentCategory[]> => {
    const res = await fetch('/api/categories');
    if (!res.ok) throw new Error('Failed to fetch categories');
    return res.json();
  },

  saveCategories: async (categories: DocumentCategory[]): Promise<DocumentCategory[]> => {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(categories),
    });
    if (!res.ok) throw new Error('Failed to save categories');
    return res.json();
  },

  createCategory: async (category: Partial<DocumentCategory>): Promise<DocumentCategory> => {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(category),
    });
    if (!res.ok) throw new Error('Failed to create category');
    return res.json();
  },

  updateCategory: async (id: string, updates: Partial<DocumentCategory>): Promise<DocumentCategory> => {
    const res = await fetch(`/api/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update category');
    return res.json();
  },

  deleteCategory: async (id: string): Promise<{ success: boolean; id: string }> => {
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete category');
    return res.json();
  },
  // Task Endpoints
  getTasks: async (): Promise<Task[]> => {
    const res = await fetch('/api/tasks');
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
  },

  createTask: async (task: Partial<Task>): Promise<Task> => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    if (!res.ok) throw new Error('Failed to create task');
    return res.json();
  },

  updateTask: async (id: string, updates: Partial<Task>): Promise<Task> => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update task');
    return res.json();
  },

  deleteTask: async (id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete task');
    return res.json();
  },

  // Note Endpoints
  getNotes: async (): Promise<Note[]> => {
    const res = await fetch('/api/notes');
    if (!res.ok) throw new Error('Failed to fetch notes');
    return res.json();
  },

  createNote: async (note: Partial<Note>): Promise<Note> => {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(note),
    });
    if (!res.ok) throw new Error('Failed to create note');
    return res.json();
  },

  updateNote: async (id: string, updates: Partial<Note>): Promise<Note> => {
    const res = await fetch(`/api/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update note');
    return res.json();
  },

  deleteNote: async (id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete note');
    return res.json();
  },

  // File Endpoints
  getFiles: async (): Promise<DriveFile[]> => {
    const res = await fetch('/api/files');
    if (!res.ok) throw new Error('Failed to fetch files');
    return res.json();
  },

  uploadFile: async (fileData: Partial<DriveFile>): Promise<DriveFile> => {
    const res = await fetch('/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fileData),
    });
    if (!res.ok) throw new Error('Failed to upload file');
    return res.json();
  },

  deleteFile: async (id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`/api/files/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete file');
    return res.json();
  },

  updateFile: async (id: string, fileData: Partial<DriveFile>): Promise<DriveFile> => {
    const res = await fetch(`/api/files/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fileData),
    });
    if (!res.ok) throw new Error('Failed to update file');
    return res.json();
  },

  syncFileToDrive: async (id: string, driveData: { driveFileId: string; webViewLink?: string }): Promise<{ success: boolean; file: DriveFile }> => {
    const res = await fetch(`/api/files/sync-drive/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(driveData),
    });
    if (!res.ok) throw new Error('Failed to sync file status');
    return res.json();
  },

  // Telegram Config & Webhook Bot Endpoints
  getTelegramConfig: async (): Promise<{ config: TelegramConfig; logs: NotificationLog[] }> => {
    const res = await fetch('/api/telegram/config');
    if (!res.ok) throw new Error('Failed to fetch Telegram config');
    return res.json();
  },

  updateTelegramConfig: async (config: Partial<TelegramConfig>): Promise<{ success: boolean; config: TelegramConfig }> => {
    const res = await fetch('/api/telegram/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error('Failed to update Telegram config');
    return res.json();
  },

  sendTestTelegramMessage: async (message?: string): Promise<{ success: boolean; log: NotificationLog }> => {
    const res = await fetch('/api/telegram/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error('Failed to send test Telegram message');
    return res.json();
  },

  sendTelegramCommand: async (command: string): Promise<{ success: boolean; reply: string }> => {
    const res = await fetch('/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });
    if (!res.ok) throw new Error('Failed to send Telegram command');
    return res.json();
  },

  setTelegramWebhook: async (webhookUrl?: string): Promise<{ success: boolean; webhookUrl: string; telegramResponse?: any }> => {
    const res = await fetch('/api/telegram/set-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Lỗi thiết lập Webhook Telegram');
    }
    return res.json();
  },

  getTelegramWebhookInfo: async (): Promise<{ success: boolean; info: any; currentConfig: TelegramConfig }> => {
    const res = await fetch('/api/telegram/webhook-info');
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Không thể kiểm tra Webhook Info');
    }
    return res.json();
  },

  // Scheduler Cron check
  checkScheduler: async (): Promise<{ checkedAt: string; triggeredCount: number; alerts: NotificationLog[] }> => {
    const res = await fetch('/api/scheduler/check');
    if (!res.ok) throw new Error('Failed to check scheduler');
    return res.json();
  },

  // Daily Briefing Endpoint
  generateBriefing: async (type: 'morning' | 'evening', sendToTelegram: boolean = true): Promise<{
    success: boolean;
    briefing: {
      type: 'morning' | 'evening';
      title: string;
      reportText: string;
      generatedAt: string;
    };
    delivered: boolean;
    log: NotificationLog;
  }> => {
    const res = await fetch('/api/briefing/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, sendToTelegram }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to generate briefing');
    }
    return res.json();
  },

  // AI Chat Endpoint with Multi-Turn Memory
  sendChatMessage: async (
    message: string,
    enableSearch: boolean = false,
    history: { role: string; content: string }[] = [],
    sessionId: string = 'web_user_session'
  ): Promise<{
    reply: string;
    groundingSources?: { title: string; url: string }[];
    retrievedContext?: any;
  }> => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, enableSearch, history, sessionId }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'AI Chat error');
    }
    return res.json();
  },

  clearChatMemory: async (sessionId: string = 'web_user_session'): Promise<{ success: boolean }> => {
    const res = await fetch('/api/chat/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    if (!res.ok) throw new Error('Failed to clear chat memory');
    return res.json();
  },

  // System Schema
  getSystemSchema: async (): Promise<{ postgresql: string; redis: string }> => {
    const res = await fetch('/api/system/schema');
    if (!res.ok) throw new Error('Failed to fetch system schema');
    return res.json();
  },

  // Google Drive Service Account API
  getDriveServiceAccountConfig: async (): Promise<DriveServiceAccountConfig> => {
    const res = await fetch('/api/drive-service-account/config');
    if (!res.ok) throw new Error('Failed to fetch Drive Service Account config');
    return res.json();
  },

  updateDriveServiceAccountConfig: async (config: Partial<DriveServiceAccountConfig>): Promise<{ success: boolean; config: DriveServiceAccountConfig }> => {
    const res = await fetch('/api/drive-service-account/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to update Drive Service Account config');
    }
    return res.json();
  },

  testDriveServiceAccount: async (payload: {
    clientEmail?: string;
    privateKey?: string;
    folderId?: string;
    serviceAccountRawJson?: string;
  }): Promise<{
    success: boolean;
    folderName: string;
    canEdit: boolean;
    owners: string[];
    message: string;
  }> => {
    const res = await fetch('/api/drive-service-account/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Kiểm tra kết nối Service Account thất bại');
    }
    return data;
  },

  syncDriveServiceAccount: async (): Promise<{
    success: boolean;
    syncedCount: number;
    files: DriveFile[];
    lastSyncAt: string;
  }> => {
    const res = await fetch('/api/drive-service-account/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Lỗi đồng bộ tệp từ Google Drive');
    }
    return data;
  },

  // Centralized Security PIN API (persists across all devices, browsers, and Render deploys)
  getSecurityPinSettings: async (): Promise<SecurityPinSettings> => {
    try {
      const res = await fetch('/api/security/pin');
      if (!res.ok) {
        return { isEnabled: true, hasCustomPin: false, autolockMinutes: 0, hint: 'Mã PIN mặc định ban đầu là 1234' };
      }
      const data = await res.json();
      return {
        isEnabled: data.isEnabled !== undefined ? data.isEnabled : true,
        hasCustomPin: Boolean(data.hasCustomPin),
        autolockMinutes: data.autolockMinutes !== undefined ? data.autolockMinutes : 0,
        hint: data.hint || 'Mã PIN mặc định ban đầu là 1234',
        updatedAt: data.updatedAt,
      };
    } catch {
      return { isEnabled: true, hasCustomPin: false, autolockMinutes: 0, hint: 'Mã PIN mặc định ban đầu là 1234' };
    }
  },

  verifySecurityPin: async (pin: string): Promise<{ isValid: boolean; isEnabled: boolean }> => {
    try {
      const res = await fetch('/api/security/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) return { isValid: false, isEnabled: true };
      const data = await res.json();
      return { isValid: Boolean(data.isValid), isEnabled: data.isEnabled !== false };
    } catch {
      // Fallback
      return { isValid: false, isEnabled: true };
    }
  },

  updateSecurityPin: async (params: {
    newPin: string;
    hint?: string;
    oldPin?: string;
  }): Promise<{ success: boolean; message: string; settings: SecurityPinSettings }> => {
    const res = await fetch('/api/security/pin', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Không thể cập nhật mã PIN lên máy chủ');
    }
    return data;
  },

  updateSecurityPinSettings: async (params: {
    isEnabled?: boolean;
    autolockMinutes?: number;
    hint?: string;
  }): Promise<{ success: boolean; message: string; settings: SecurityPinSettings }> => {
    const res = await fetch('/api/security/pin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Không thể cập nhật cài đặt bảo mật lên máy chủ');
    }
    return data;
  },

  // AI Autonomous Self-Learning & Memory APIs
  getAiLearningStats: async (): Promise<AiLearningStats> => {
    const res = await fetch('/api/ai/learning/stats');
    if (!res.ok) throw new Error('Không thể tải thống kê tự học của AI');
    return res.json();
  },

  getAiMemories: async (): Promise<AiMemoryFact[]> => {
    const res = await fetch('/api/ai/learning/memories');
    if (!res.ok) throw new Error('Không thể tải danh sách ký ức AI');
    return res.json();
  },

  saveAiMemory: async (memory: Partial<AiMemoryFact>): Promise<AiMemoryFact> => {
    const res = await fetch('/api/ai/learning/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memory),
    });
    if (!res.ok) throw new Error('Không thể lưu ký ức cho AI');
    return res.json();
  },

  deleteAiMemory: async (id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`/api/ai/learning/memories/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Không thể xóa ký ức AI');
    return res.json();
  },

  toggleAiMemory: async (id: string): Promise<AiMemoryFact> => {
    const res = await fetch(`/api/ai/learning/memories/${id}/toggle`, { method: 'PATCH' });
    if (!res.ok) throw new Error('Không thể bật/tắt ký ức');
    return res.json();
  },

  getAiInsights: async (): Promise<AiLearningInsight[]> => {
    const res = await fetch('/api/ai/learning/insights');
    if (!res.ok) throw new Error('Không thể tải danh sách đúc kết AI');
    return res.json();
  },

  triggerAiSelfReflection: async (): Promise<{ success: boolean; insights: AiLearningInsight[]; message: string }> => {
    const res = await fetch('/api/ai/learning/reflect', { method: 'POST' });
    if (!res.ok) throw new Error('Lỗi khi kích hoạt phiên tự học và suy ngẫm');
    return res.json();
  },

  // AI Persona & Honorifics
  getAiPersonaConfig: async (): Promise<AiPersonaConfig> => {
    const res = await fetch('/api/ai/persona');
    if (!res.ok) throw new Error('Không thể tải cấu hình AI Persona');
    return res.json();
  },

  saveAiPersonaConfig: async (config: Partial<AiPersonaConfig>): Promise<AiPersonaConfig> => {
    const res = await fetch('/api/ai/persona', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error('Không thể lưu cấu hình AI Persona');
    return res.json();
  },
};
