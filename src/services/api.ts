import { Task, Note, DriveFile, TelegramConfig, NotificationLog, ChatMessage } from '../types/index.js';

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

  // AI Chat Endpoint
  sendChatMessage: async (message: string, enableSearch: boolean = false): Promise<{
    reply: string;
    groundingSources?: { title: string; url: string }[];
    retrievedContext?: any;
  }> => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, enableSearch }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'AI Chat error');
    }
    return res.json();
  },

  // System Schema
  getSystemSchema: async (): Promise<{ postgresql: string; redis: string }> => {
    const res = await fetch('/api/system/schema');
    if (!res.ok) throw new Error('Failed to fetch system schema');
    return res.json();
  }
};
