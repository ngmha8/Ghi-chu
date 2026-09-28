import { create } from 'zustand';
import {
  AppTheme,
  TelegramConfig,
  NotificationLog,
  ChatMessage
} from '../types/index.js';
import { getSavedTheme, applyTheme } from '../services/theme.js';
import { api } from '../services/api.js';
import {
  isSessionUnlocked,
  lockSession as lockPinSession,
  getPinSettings,
  fetchPinSettingsFromServer
} from '../services/pinSecurity.js';

export type AppTab =
  | 'dashboard'
  | 'tasks'
  | 'notes'
  | 'files'
  | 'telegram'
  | 'ai-learning'
  | 'settings'
  | 'architecture';

interface SystemState {
  theme: AppTheme;
  isUnlocked: boolean;
  activeTab: AppTab;
  searchQuery: string;
  telegramConfig: TelegramConfig;
  notificationLogs: NotificationLog[];

  // AI Chat & Voice Modals
  isAiDrawerOpen: boolean;
  aiPromptToTrigger: string;
  isVoiceFocusOpen: boolean;
  chatMessages: ChatMessage[];

  // Actions
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  setIsUnlocked: (unlocked: boolean) => void;
  lockApp: () => void;
  checkPinStatus: () => Promise<void>;
  setActiveTab: (tab: AppTab) => void;
  setSearchQuery: (query: string) => void;

  // Telegram actions
  setTelegramConfig: (config: TelegramConfig) => void;
  setNotificationLogs: (logs: NotificationLog[]) => void;
  addNotificationLog: (log: NotificationLog) => void;
  updateTelegramConfig: (updates: Partial<TelegramConfig>) => Promise<void>;
  sendTestTelegramMessage: (msg?: string) => Promise<void>;
  sendTelegramCommand: (cmd: string) => Promise<{ success: boolean; reply: string }>;

  // AI & Voice Drawer
  openAiDrawer: (prompt?: string) => void;
  closeAiDrawer: () => void;
  openVoiceFocus: () => void;
  closeVoiceFocus: () => void;
  sendChatMessage: (text: string, enableSearch: boolean) => Promise<void>;
  clearChatMessages: () => Promise<void>;
}

const getInitialCachedTelegram = (): { config: TelegramConfig; logs: NotificationLog[] } => {
  const defaultConfig: TelegramConfig = {
    botToken: '',
    chatId: '',
    enabled: true,
    alertOffsetMinutes: 15,
    isConnected: true,
  };
  try {
    const cached = localStorage.getItem('cached_telegram_config');
    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        config: parsed?.config || defaultConfig,
        logs: Array.isArray(parsed?.logs) ? parsed.logs : [],
      };
    }
  } catch {}
  return { config: defaultConfig, logs: [] };
};

const initialTelegramData = getInitialCachedTelegram();

const initialTheme = getSavedTheme();
applyTheme(initialTheme);

export const useSystemStore = create<SystemState>((set, get) => ({
  theme: initialTheme,
  isUnlocked: isSessionUnlocked(),
  activeTab: 'dashboard',
  searchQuery: '',
  telegramConfig: initialTelegramData.config,
  notificationLogs: initialTelegramData.logs,

  isAiDrawerOpen: false,
  aiPromptToTrigger: '',
  isVoiceFocusOpen: false,
  chatMessages: [
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: '👋 Xin chào! Tôi là AI Personal Assistant với năng lực Tự Học & Trí Tuệ Thấu Cảm. Tôi liên tục tiếp thu phong cách và quy tắc làm việc của bạn để hỗ trợ nhanh và chuẩn xác nhất.',
      timestamp: new Date().toISOString(),
    }
  ],

  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },

  toggleTheme: () => {
    const current = get().theme;
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    set({ theme: next });
  },

  setIsUnlocked: (unlocked) => set({ isUnlocked: unlocked }),

  lockApp: () => {
    lockPinSession();
    set({ isUnlocked: false });
  },

  checkPinStatus: async () => {
    try {
      const pinCfg = await fetchPinSettingsFromServer();
      if (!pinCfg.isEnabled) {
        set({ isUnlocked: true });
      }
    } catch {
      // Fallback
    }
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setTelegramConfig: (config) => set({ telegramConfig: config }),

  setNotificationLogs: (logs) => set({ notificationLogs: logs }),

  addNotificationLog: (log) => set(s => ({ notificationLogs: [log, ...s.notificationLogs] })),

  updateTelegramConfig: async (updates) => {
    try {
      const res = await api.updateTelegramConfig(updates);
      set({ telegramConfig: res.config });
    } catch (err) {
      console.error('Error updating Telegram config in store:', err);
    }
  },

  sendTestTelegramMessage: async (msg) => {
    try {
      const res = await api.sendTestTelegramMessage(msg);
      set(s => ({ notificationLogs: [res.log, ...s.notificationLogs] }));
    } catch (err) {
      console.error('Error sending test Telegram message:', err);
    }
  },

  sendTelegramCommand: async (cmd) => {
    return api.sendTelegramCommand(cmd);
  },

  openAiDrawer: (prompt = '') => {
    set({
      isAiDrawerOpen: true,
      aiPromptToTrigger: prompt,
    });
  },

  closeAiDrawer: () => {
    set({
      isAiDrawerOpen: false,
      aiPromptToTrigger: '',
    });
  },

  openVoiceFocus: () => set({ isVoiceFocusOpen: true }),
  closeVoiceFocus: () => set({ isVoiceFocusOpen: false }),

  sendChatMessage: async (text: string, enableSearch: boolean) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const assistantMsgId = `ai-${Date.now()}`;
    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };

    const history = get().chatMessages;
    set({ chatMessages: [...history, userMsg, initialAssistantMsg] });

    const historyPayload = history.slice(-6).map(m => ({
      role: m.role,
      content: m.content,
    }));

    let fullReply = '';

    await api.streamChatMessage(
      text,
      enableSearch,
      historyPayload,
      'web_user_session',
      (chunk: string) => {
        fullReply += chunk;
        set(s => ({
          chatMessages: s.chatMessages.map(m => (m.id === assistantMsgId ? { ...m, content: fullReply } : m))
        }));
      },
      (doneData) => {
        set(s => ({
          chatMessages: s.chatMessages.map(m =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: doneData.reply || fullReply,
                  groundingSources: doneData.groundingSources,
                  retrievedContext: doneData.retrievedContext,
                }
              : m
          )
        }));
      },
      (error) => {
        set(s => ({
          chatMessages: s.chatMessages.map(m =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: fullReply
                    ? fullReply + `\n\n⚠️ _[Đứt đoạn luồng: ${error}]_`
                    : `❌ Rất tiếc, đã có lỗi khi gọi AI Assistant: ${error}`,
                }
              : m
          )
        }));
      }
    );
  },

  clearChatMessages: async () => {
    set({ chatMessages: [] });
    try {
      await api.clearChatMemory('web_user_session');
    } catch (e) {
      console.warn('Could not clear backend chat session memory:', e);
    }
  },
}));
