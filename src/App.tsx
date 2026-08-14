import React, { useState, useEffect } from 'react';
import { Task, Note, DriveFile, TelegramConfig, NotificationLog, ChatMessage } from './types/index.js';
import { api } from './services/api.js';
import {
  subscribeTasks,
  subscribeNotes,
  subscribeNotifications,
  subscribeTelegramConfig,
} from './services/firebase.ts';

import { Header } from './components/Header.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { TasksView } from './components/TasksView.tsx';
import { NotesView } from './components/NotesView.tsx';
import { FilesView } from './components/FilesView.tsx';
import { TelegramBotView } from './components/TelegramBotView.tsx';
import { SystemArchView } from './components/SystemArchView.tsx';
import { AiChatDrawer } from './components/AiChatDrawer.tsx';
import { TaskModal } from './components/TaskModal.tsx';
import { NoteModal } from './components/NoteModal.tsx';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tasks' | 'notes' | 'files' | 'telegram' | 'architecture'>('dashboard');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>({
    botToken: '',
    chatId: '',
    enabled: true,
    alertOffsetMinutes: 15,
    isConnected: true,
  });
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);

  // AI Assistant Chat Drawer State
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [aiPromptToTrigger, setAiPromptToTrigger] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: '👋 Xin chào! Tôi là AI Personal Assistant. Tôi có thể giúp bạn kiểm tra danh sách công việc, tóm tắt ghi chú, hoặc tìm kiếm thông tin mới nhất trên Google Search khi bạn yêu cầu.',
      timestamp: new Date().toISOString(),
    }
  ]);

  // Modals state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');

  // Initial Fetching & Firestore Realtime Subscriptions
  useEffect(() => {
    async function loadData() {
      try {
        const [tasksData, notesData, filesData, telegramData] = await Promise.all([
          api.getTasks(),
          api.getNotes(),
          api.getFiles(),
          api.getTelegramConfig(),
        ]);
        setTasks(tasksData);
        setNotes(notesData);
        setFiles(filesData);
        setTelegramConfig(telegramData.config);
        setNotificationLogs(telegramData.logs);
      } catch (err) {
        console.error('Error fetching initial data:', err);
      }
    }
    loadData();

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

    return () => {
      unsubTasks();
      unsubNotes();
      unsubNotifs();
      unsubConfig();
      clearInterval(cronInterval);
    };
  }, []);

  // -------------------------------------------------------------
  // TASK HANDLERS
  // -------------------------------------------------------------
  const handleTaskCreate = async (taskData: Partial<Task>) => {
    try {
      const created = await api.createTask(taskData);
      setTasks(prev => [created, ...prev]);
    } catch (err) {
      console.error('Error creating task:', err);
    }
  };

  const handleTaskUpdate = async (id: string, updates: Partial<Task>) => {
    try {
      const updated = await api.updateTask(id, updates);
      setTasks(prev => prev.map(t => (t.id === id ? updated : t)));
    } catch (err) {
      console.error('Error updating task:', err);
    }
  };

  const handleTaskDelete = async (id: string) => {
    try {
      await api.deleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // -------------------------------------------------------------
  // NOTE HANDLERS
  // -------------------------------------------------------------
  const handleNoteCreate = async (noteData: Partial<Note>) => {
    try {
      const created = await api.createNote(noteData);
      setNotes(prev => [created, ...prev]);
    } catch (err) {
      console.error('Error creating note:', err);
    }
  };

  const handleNoteUpdate = async (id: string, updates: Partial<Note>) => {
    try {
      const updated = await api.updateNote(id, updates);
      setNotes(prev => prev.map(n => (n.id === id ? updated : n)));
    } catch (err) {
      console.error('Error updating note:', err);
    }
  };

  const handleNoteDelete = async (id: string) => {
    try {
      await api.deleteNote(id);
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Error deleting note:', err);
    }
  };

  // -------------------------------------------------------------
  // FILE HANDLERS
  // -------------------------------------------------------------
  const handleFileUpload = async (fileData: Partial<DriveFile>) => {
    try {
      const created = await api.uploadFile(fileData);
      setFiles(prev => [created, ...prev]);
    } catch (err) {
      console.error('Error uploading file:', err);
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

    setChatMessages(prev => [...prev, userMsg]);

    try {
      const res = await api.sendChatMessage(text, enableSearch);
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

  const openAiChatWithPrompt = (promptText: string) => {
    setAiPromptToTrigger(promptText);
    setIsAiDrawerOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#E0E0E0] font-sans selection:bg-[#D4AF37] selection:text-black">
      {/* Header Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openNewTaskModal={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
        openNewNoteModal={() => setIsNoteModalOpen(true)}
        isAiDrawerOpen={isAiDrawerOpen}
        setIsAiDrawerOpen={setIsAiDrawerOpen}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        unreadNotifsCount={notificationLogs.length}
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
            onFileUpload={handleFileUpload}
            onFileDelete={handleFileDelete}
            openAiChatWithPrompt={openAiChatWithPrompt}
          />
        )}

        {activeTab === 'telegram' && (
          <TelegramBotView
            telegramConfig={telegramConfig}
            notificationLogs={notificationLogs}
            onUpdateConfig={handleUpdateTelegramConfig}
            onSendTestMessage={handleSendTestTelegramMessage}
            onSendTelegramCommand={handleSendTelegramCommand}
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
        onClearMessages={() => setChatMessages([])}
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
      />

      {/* Note Creation Modal */}
      <NoteModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        onSave={handleNoteCreate}
        tasks={tasks}
        files={files}
      />
    </div>
  );
}
