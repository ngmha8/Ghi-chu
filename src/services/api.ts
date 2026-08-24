import { Task, Note, DriveFile, TelegramConfig, NotificationLog, ChatMessage, DriveServiceAccountConfig } from '../types/index.js';

export const api = {
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
  }
};
