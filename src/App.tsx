import React, { useState, useEffect, useMemo } from 'react';
import { Task, Note, DriveFile, TelegramConfig, NotificationLog, ChatMessage, DocumentCategory, AiMemoryFact, AiLearningInsight, AiLearningStats } from './types/index.js';
import { api } from './services/api.js';
import {
  fetchCategoriesFromServer,
  syncCategoriesToServer,
  getStoredCategories
} from './services/docClassification.js';
import {
  subscribeTasks,
  subscribeNotes,
  subscribeFiles,
  subscribeCategories,
  subscribeNotifications,
  subscribeTelegramConfig,
  subscribeAiMemories,
  subscribeAiInsights
} from './services/firebase.ts';

import { Header } from './components/Header.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { TasksView } from './components/TasksView.tsx';
import { NotesView } from './components/NotesView.tsx';
import { FilesView } from './components/FilesView.tsx';
import { TelegramBotView } from './components/TelegramBotView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { SystemArchView } from './components/SystemArchView.tsx';
import { AiLearningView } from './components/AiLearningView.tsx';
import { AiChatDrawer } from './components/AiChatDrawer.tsx';
import { TaskModal } from './components/TaskModal.tsx';
import { NoteModal } from './components/NoteModal.tsx';
import { PinLockScreen } from './components/PinLockScreen.tsx';
import { VoiceFocusModeModal } from './components/VoiceFocusModeModal.tsx';
import {
  isSessionUnlocked,
  lockSession,
  updateActivityTimestamp,
  getPinSettings,
  fetchPinSettingsFromServer
} from './services/pinSecurity.js';

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => isSessionUnlocked());
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tasks' | 'notes' | 'files' | 'telegram' | 'ai-learning' | 'settings' | 'architecture'>('dashboard');

  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const cached = localStorage.getItem('cached_tasks');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [notes, setNotes] = useState<Note[]>(() => {
    try {
      const cached = localStorage.getItem('cached_notes');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [files, setFiles] = useState<DriveFile[]>(() => {
    try {
      const cached = localStorage.getItem('cached_files');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [categories, setCategories] = useState<DocumentCategory[]>(() => {
    try {
      const cached = localStorage.getItem('cached_categories');
      if (cached) return JSON.parse(cached);
    } catch {}
    return getStoredCategories();
  });
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>(() => {
    try {
      const cached = localStorage.getItem('cached_telegram_config');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.config) return parsed.config;
      }
    } catch {}
    return {
      botToken: '',
      chatId: '',
      enabled: true,
      alertOffsetMinutes: 15,
      isConnected: true,
    };
  });
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>(() => {
    try {
      const cached = localStorage.getItem('cached_telegram_config');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed?.logs)) return parsed.logs;
      }
    } catch {}
    return [];
  });

  // AI Autonomous Self-Learning & Mind State
  const [aiMemories, setAiMemories] = useState<AiMemoryFact[]>([]);
  const [aiInsights, setAiInsights] = useState<AiLearningInsight[]>([]);
  const [aiStats, setAiStats] = useState<AiLearningStats | null>(null);

  // AI Assistant Chat Drawer State
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [isVoiceFocusOpen, setIsVoiceFocusOpen] = useState(false);
  const [aiPromptToTrigger, setAiPromptToTrigger] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: '👋 Xin chào! Tôi là AI Personal Assistant với năng lực Tự Học & Trí Tuệ Thấu Cảm. Tôi liên tục tiếp thu phong cách và quy tắc làm việc của bạn để hỗ trợ nhanh và chuẩn xác nhất.',
      timestamp: new Date().toISOString(),
    }
  ]);

  // Modals state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');

  const refreshAiLearningData = async () => {
    try {
      const [mems, ins, stats] = await Promise.all([
        api.getAiMemories(),
        api.getAiInsights(),
        api.getAiLearningStats(),
      ]);
      setAiMemories(mems);
      setAiInsights(ins);
      setAiStats(stats);
    } catch (e) {
      console.warn('Error refreshing AI learning data:', e);
    }
  };

  // Collect all available tags across tasks and notes
  const allAvailableTags = useMemo(() => {
    const set = new Set<string>();
    const defaults = ['Công việc', 'Báo cáo', 'Tài chính', 'Họp', 'Kế hoạch', 'Dự án', 'Architecture', 'AI', 'Google Drive'];
    defaults.forEach(t => set.add(t));
    tasks.forEach(t => t.tags?.forEach(tag => tag && set.add(tag.trim())));
    notes.forEach(n => n.tags?.forEach(tag => tag && set.add(tag.trim())));
    categories.forEach(c => set.add(c.name));
    return Array.from(set).filter(Boolean);
  }, [tasks, notes, categories]);

  // Initial Fetching & Firestore Realtime Subscriptions
  useEffect(() => {
    let isMounted = true;
    let retryTimer: any = null;

    async function loadData(retryAttempt = 0) {
      try {
        const results = await Promise.allSettled([
          api.getTasks(),
          api.getNotes(),
          api.getFiles(),
          api.getTelegramConfig(),
          fetchCategoriesFromServer(),
          api.getAiMemories().catch(() => []),
          api.getAiInsights().catch(() => []),
          api.getAiLearningStats().catch(() => null),
        ]);

        if (!isMounted) return;

        let needsRetry = false;

        // Tasks
        if (results[0].status === 'fulfilled') {
          setTasks(results[0].value);
        } else {
          needsRetry = true;
        }

        // Notes
        if (results[1].status === 'fulfilled') {
          setNotes(results[1].value);
        } else {
          needsRetry = true;
        }

        // Files
        if (results[2].status === 'fulfilled') {
          setFiles(results[2].value);
        }

        // Telegram Config & Notification Logs
        if (results[3].status === 'fulfilled') {
          setTelegramConfig(results[3].value.config);
          setNotificationLogs(results[3].value.logs);
        }

        // Categories
        if (results[4].status === 'fulfilled' && results[4].value && results[4].value.length > 0) {
          setCategories(results[4].value);
        }

        // AI Memories
        if (results[5].status === 'fulfilled' && Array.isArray(results[5].value) && results[5].value.length > 0) {
          setAiMemories(results[5].value);
        }

        // AI Insights
        if (results[6].status === 'fulfilled' && Array.isArray(results[6].value) && results[6].value.length > 0) {
          setAiInsights(results[6].value);
        }

        // AI Stats
        if (results[7].status === 'fulfilled' && results[7].value) {
          setAiStats(results[7].value);
        }

        // If core data had a transient fetch error (e.g. server cold-starting), schedule automatic retry
        if (needsRetry && retryAttempt < 3) {
          retryTimer = setTimeout(() => {
            if (isMounted) loadData(retryAttempt + 1);
          }, 2000 * (retryAttempt + 1));
        }
      } catch (err) {
        console.warn('Initial data load attempt error (fallback active):', err);
        if (retryAttempt < 3) {
          retryTimer = setTimeout(() => {
            if (isMounted) loadData(retryAttempt + 1);
          }, 2500);
        }
      }
    }
    loadData();

    // Auto re-fetch when device reconnects to internet
    const handleOnline = () => {
      loadData(0);
    };
    window.addEventListener('online', handleOnline);

    // Sync PIN configuration from server
    fetchPinSettingsFromServer().then(pinCfg => {
      if (!pinCfg.isEnabled) {
        setIsUnlocked(true);
      }
    }).catch(() => {});

    // 1. Subscribe to Real-time Firestore Listeners
    const unsubTasks = subscribeTasks((liveTasks) => {
      if (liveTasks && liveTasks.length > 0) {
        setTasks(liveTasks);
      }
    });

    const unsubNotes = subscribeNotes((liveNotes) => {
      if (liveNotes && liveNotes.length > 0) {
        setNotes(liveNotes);
      }
    });

    const unsubCategories = subscribeCategories((liveCats) => {
      if (liveCats && liveCats.length > 0) {
        setCategories(liveCats);
      }
    });

    const unsubFiles = subscribeFiles((liveFiles) => {
      if (liveFiles && liveFiles.length > 0) {
        setFiles(liveFiles);
      }
    });

    const unsubNotifs = subscribeNotifications((liveLogs) => {
      if (liveLogs && liveLogs.length > 0) {
        setNotificationLogs(liveLogs);
      }
    });

    const unsubConfig = subscribeTelegramConfig((liveConfig) => {
      if (liveConfig) {
        setTelegramConfig(liveConfig);
      }
    });

    const unsubMemories = subscribeAiMemories((liveMems) => {
      if (liveMems && liveMems.length > 0) {
        setAiMemories(liveMems);
      }
    });

    const unsubInsights = subscribeAiInsights((liveIns) => {
      if (liveIns && liveIns.length > 0) {
        setAiInsights(liveIns);
      }
    });

    // 2. Cron Scheduler Background Check every 30s
    const cronInterval = setInterval(async () => {
      try {
        const checkRes = await api.checkScheduler();
        if (checkRes.alerts && checkRes.alerts.length > 0) {
          setNotificationLogs(prev => [...checkRes.alerts, ...prev]);
        }
      } catch (err) {
        // Silent catch for background checks
      }
    }, 30000);

    // User Activity & Auto-Lock Monitor
    const handleUserActivity = () => {
      updateActivityTimestamp();
    };

    window.addEventListener('mousedown', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity, { passive: true });

    // Check auto-lock every 15 seconds
    const lockCheckInterval = setInterval(() => {
      const pinSettings = getPinSettings();
      if (pinSettings.isEnabled && pinSettings.autolockMinutes > 0) {
        if (!isSessionUnlocked()) {
          setIsUnlocked(false);
        }
      }
    }, 15000);

    return () => {
      isMounted = false;
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener('online', handleOnline);
      unsubTasks();
      unsubNotes();
      unsubCategories();
      unsubFiles();
      unsubNotifs();
      unsubConfig();
      unsubMemories();
      unsubInsights();
      clearInterval(cronInterval);
      clearInterval(lockCheckInterval);
      window.removeEventListener('mousedown', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
    };
  }, []);

  const handleLockApp = () => {
    lockSession();
    setIsUnlocked(false);
  };

  // -------------------------------------------------------------
  // TASK HANDLERS (Optimistic UI - 0ms Updates & Rollback)
  // -------------------------------------------------------------
  const handleTaskCreate = async (taskData: Partial<Task>) => {
    const tempId = `temp-task-${Date.now()}`;
    const optimisticTask: Task = {
      id: tempId,
      title: taskData.title || 'Công việc mới',
      description: taskData.description || '',
      priority: taskData.priority || 'medium',
      status: taskData.status || 'todo',
      deadline: taskData.deadline || new Date().toISOString(),
      tags: taskData.tags || [],
      attachedFileIds: taskData.attachedFileIds || [],
      recurring: taskData.recurring || { type: 'none' },
      reminderOffsetMinutes: taskData.reminderOffsetMinutes ?? 15,
      isNotified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 0ms Optimistic UI insertion
    setTasks(prev => [optimisticTask, ...prev]);

    try {
      const created = await api.createTask(taskData);
      // Replace temporary task with actual server entity
      setTasks(prev => prev.map(t => (t.id === tempId ? created : t)));
    } catch (err) {
      console.error('Error creating task, rolling back:', err);
      setTasks(prev => prev.filter(t => t.id !== tempId));
    }
  };

  const handleTaskUpdate = async (id: string, updates: Partial<Task>) => {
    // 0ms Optimistic UI update
    let previousTask: Task | undefined;
    setTasks(prev => {
      previousTask = prev.find(t => t.id === id);
      return prev.map(t => (t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t));
    });

    try {
      const updated = await api.updateTask(id, updates);
      setTasks(prev => prev.map(t => (t.id === id ? updated : t)));
    } catch (err) {
      console.error('Error updating task, rolling back:', err);
      if (previousTask) {
        setTasks(prev => prev.map(t => (t.id === id ? previousTask! : t)));
      }
    }
  };

  const handleTaskDelete = async (id: string) => {
    let previousTasks = tasks;
    // 0ms Optimistic UI deletion
    setTasks(prev => {
      previousTasks = prev;
      return prev.filter(t => t.id !== id);
    });

    try {
      await api.deleteTask(id);
    } catch (err) {
      console.error('Error deleting task, rolling back:', err);
      setTasks(previousTasks);
    }
  };

  // -------------------------------------------------------------
  // NOTE HANDLERS (Optimistic UI - 0ms Updates & Rollback)
  // -------------------------------------------------------------
  const handleNoteCreate = async (noteData: Partial<Note>) => {
    const tempId = `temp-note-${Date.now()}`;
    const optimisticNote: Note = {
      id: tempId,
      title: noteData.title || 'Ghi chú mới',
      content: noteData.content || '',
      tags: noteData.tags || [],
      linkedTaskIds: noteData.linkedTaskIds || [],
      attachedFileIds: noteData.attachedFileIds || [],
      isPinned: noteData.isPinned ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setNotes(prev => [optimisticNote, ...prev]);

    try {
      const created = await api.createNote(noteData);
      setNotes(prev => prev.map(n => (n.id === tempId ? created : n)));
    } catch (err) {
      console.error('Error creating note, rolling back:', err);
      setNotes(prev => prev.filter(n => n.id !== tempId));
    }
  };

  const handleNoteUpdate = async (id: string, updates: Partial<Note>) => {
    let previousNote: Note | undefined;
    setNotes(prev => {
      previousNote = prev.find(n => n.id === id);
      return prev.map(n => (n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n));
    });

    try {
      const updated = await api.updateNote(id, updates);
      setNotes(prev => prev.map(n => (n.id === id ? updated : n)));
    } catch (err) {
      console.error('Error updating note, rolling back:', err);
      if (previousNote) {
        setNotes(prev => prev.map(n => (n.id === id ? previousNote! : n)));
      }
    }
  };

  const handleNoteDelete = async (id: string) => {
    let previousNotes = notes;
    setNotes(prev => {
      previousNotes = prev;
      return prev.filter(n => n.id !== id);
    });

    try {
      await api.deleteNote(id);
    } catch (err) {
      console.error('Error deleting note, rolling back:', err);
      setNotes(previousNotes);
    }
  };

  // -------------------------------------------------------------
  // FILE HANDLERS
  // -------------------------------------------------------------
  const handleFileUpload = async (fileData: Partial<DriveFile>): Promise<DriveFile | null> => {
    try {
      const created = await api.uploadFile(fileData);
      setFiles(prev => [created, ...prev.filter(f => f.id !== created.id)]);
      return created;
    } catch (err) {
      console.error('Error uploading file:', err);
      return null;
    }
  };

  const handleFileDelete = async (id: string) => {
    try {
      await api.deleteFile(id);
      setFiles(prev => prev.filter(f => f.id !== id));
    } catch (err) {
      console.error('Error deleting file:', err);
    }
  };

  const handleFileUpdate = async (id: string, fileData: Partial<DriveFile>) => {
    try {
      const updated = await api.updateFile(id, fileData);
      setFiles(prev => prev.map(f => f.id === id ? updated : f));
    } catch (err) {
      console.error('Error updating file:', err);
    }
  };

  const handleSaveCategories = async (newCategories: DocumentCategory[]) => {
    setCategories(newCategories);
    try {
      const saved = await syncCategoriesToServer(newCategories);
      setCategories(saved);
    } catch (err) {
      console.error('Error syncing categories:', err);
    }
  };

  // -------------------------------------------------------------
  // TELEGRAM HANDLERS
  // -------------------------------------------------------------
  const handleUpdateTelegramConfig = async (configUpdates: Partial<TelegramConfig>) => {
    try {
      const res = await api.updateTelegramConfig(configUpdates);
      setTelegramConfig(res.config);
    } catch (err) {
      console.error('Error updating Telegram config:', err);
    }
  };

  const handleSendTestTelegramMessage = async (msg?: string) => {
    try {
      const res = await api.sendTestTelegramMessage(msg);
      setNotificationLogs(prev => [res.log, ...prev]);
    } catch (err) {
      console.error('Error sending test Telegram message:', err);
    }
  };

  const handleSendTelegramCommand = async (cmd: string) => {
    return api.sendTelegramCommand(cmd);
  };

  // -------------------------------------------------------------
  // AI CHAT HANDLERS
  // -------------------------------------------------------------
  const handleSendChatMessage = async (text: string, enableSearch: boolean) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const updatedHistory = [...chatMessages, userMsg];
    setChatMessages(updatedHistory);

    try {
      const historyPayload = chatMessages.slice(-6).map(m => ({
        role: m.role,
        content: m.content,
      }));
      const res = await api.sendChatMessage(text, enableSearch, historyPayload, 'web_user_session');
      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toISOString(),
        groundingSources: res.groundingSources,
        retrievedContext: res.retrievedContext,
      };
      setChatMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        role: 'assistant',
        content: `❌ Rất tiếc, đã có lỗi khi gọi AI Assistant: ${err.message}`,
        timestamp: new Date().toISOString(),
      };
      setChatMessages(prev => [...prev, errorMsg]);
    }
  };

  const handleClearChatMessages = async () => {
    setChatMessages([]);
    try {
      await api.clearChatMemory('web_user_session');
    } catch (e) {
      console.warn('Could not clear backend chat session memory:', e);
    }
  };

  const openAiChatWithPrompt = (promptText: string) => {
    setAiPromptToTrigger(promptText);
    setIsAiDrawerOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#E0E0E0] font-sans selection:bg-[#D4AF37] selection:text-black">
      {/* PIN Security Lock Screen */}
      {!isUnlocked && (
        <PinLockScreen onUnlock={() => setIsUnlocked(true)} />
      )}

      {/* Header Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openNewTaskModal={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
        openNewNoteModal={() => setIsNoteModalOpen(true)}
        isAiDrawerOpen={isAiDrawerOpen}
        setIsAiDrawerOpen={setIsAiDrawerOpen}
        onOpenVoiceFocus={() => setIsVoiceFocusOpen(true)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        unreadNotifsCount={notificationLogs.length}
        availableTags={allAvailableTags}
        tasks={tasks}
        notes={notes}
        files={files}
        onSelectTask={(task) => {
          setEditingTask(task);
          setIsTaskModalOpen(true);
          setActiveTab('tasks');
        }}
        onSelectNote={(_note) => {
          setActiveTab('notes');
        }}
        onSelectFile={(_file) => {
          setActiveTab('files');
        }}
        onLockApp={handleLockApp}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            tasks={tasks}
            notes={notes}
            files={files}
            notificationLogs={notificationLogs}
            onTaskStatusChange={(taskId, newStatus) => handleTaskUpdate(taskId, { status: newStatus })}
            setActiveTab={setActiveTab}
            openAiChatWithPrompt={openAiChatWithPrompt}
            onOpenVoiceFocus={() => setIsVoiceFocusOpen(true)}
            openNewTaskModal={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
            openNewNoteModal={() => setIsNoteModalOpen(true)}
          />
        )}

        {activeTab === 'tasks' && (
          <TasksView
            tasks={tasks}
            files={files}
            notes={notes}
            onTaskCreate={handleTaskCreate}
            onTaskUpdate={handleTaskUpdate}
            onTaskDelete={handleTaskDelete}
            openAiChatWithPrompt={openAiChatWithPrompt}
            openNewTaskModal={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
            editTask={(task) => { setEditingTask(task); setIsTaskModalOpen(true); }}
          />
        )}

        {activeTab === 'notes' && (
          <NotesView
            notes={notes}
            tasks={tasks}
            files={files}
            onNoteCreate={handleNoteCreate}
            onNoteUpdate={handleNoteUpdate}
            onNoteDelete={handleNoteDelete}
            openAiChatWithPrompt={openAiChatWithPrompt}
            openNewNoteModal={() => setIsNoteModalOpen(true)}
          />
        )}

        {activeTab === 'files' && (
          <FilesView
            files={files}
            tasks={tasks}
            notes={notes}
            categories={categories}
            onSaveCategories={handleSaveCategories}
            onFileUpload={handleFileUpload}
            onFileDelete={handleFileDelete}
            onFileUpdate={handleFileUpdate}
            openAiChatWithPrompt={openAiChatWithPrompt}
            onNavigateToSettings={() => setActiveTab('settings')}
          />
        )}

        {activeTab === 'telegram' && (
          <TelegramBotView
            telegramConfig={telegramConfig}
            notificationLogs={notificationLogs}
            onUpdateConfig={handleUpdateTelegramConfig}
            onSendTestMessage={handleSendTestTelegramMessage}
            onSendTelegramCommand={handleSendTelegramCommand}
            onNavigateToSettings={() => setActiveTab('settings')}
          />
        )}

        {activeTab === 'ai-learning' && (
          <AiLearningView
            memories={aiMemories}
            insights={aiInsights}
            stats={aiStats}
            onRefresh={refreshAiLearningData}
            onOpenAiDrawerWithPrompt={openAiChatWithPrompt}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            telegramConfig={telegramConfig}
            onUpdateTelegramConfig={handleUpdateTelegramConfig}
            onSendTestTelegramMessage={handleSendTestTelegramMessage}
            files={files}
            onFileUpdate={handleFileUpdate}
            onLockApp={handleLockApp}
          />
        )}

        {activeTab === 'architecture' && (
          <SystemArchView />
        )}
      </main>

      {/* AI Assistant Chat Drawer */}
      <AiChatDrawer
        isOpen={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        messages={chatMessages}
        onSendMessage={handleSendChatMessage}
        onClearMessages={handleClearChatMessages}
        initialPrompt={aiPromptToTrigger}
      />

      {/* Task Creation / Editing Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={(taskData) => {
          if (editingTask) {
            handleTaskUpdate(editingTask.id, taskData);
          } else {
            handleTaskCreate(taskData);
          }
        }}
        initialTask={editingTask}
        files={files}
        existingTasks={tasks}
        existingNotes={notes}
      />

      {/* Note Creation Modal */}
      <NoteModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        onSave={handleNoteCreate}
        tasks={tasks}
        files={files}
        existingNotes={notes}
      />

      {/* Fullscreen Voice Assistant Focus Mode Modal */}
      <VoiceFocusModeModal
        isOpen={isVoiceFocusOpen}
        onClose={() => setIsVoiceFocusOpen(false)}
        onSendMessage={handleSendChatMessage}
        messages={chatMessages}
        openAiChatWithPrompt={openAiChatWithPrompt}
      />
    </div>
  );
}
