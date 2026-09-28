import React, { useMemo } from 'react';
import { Repeat, CheckCircle2, X } from 'lucide-react';

// Domain Zustand Stores
import { useTaskStore } from './stores/useTaskStore.js';
import { useNoteStore } from './stores/useNoteStore.js';
import { useFileStore } from './stores/useFileStore.js';
import { useSystemStore } from './stores/useSystemStore.js';
import { useSyncManager } from './stores/useSyncManager.js';

// Views & Components
import { Header } from './components/Header.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { TasksView } from './components/TasksView.tsx';
import { NotesView } from './components/NotesView.tsx';
import { FilesView } from './components/FilesView.tsx';
import { TelegramBotView } from './components/TelegramBotView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { SystemArchView } from './components/SystemArchView.tsx';
import { AiLearningView } from './components/AiLearningView.tsx';

// Modals
import { AiChatDrawer } from './components/AiChatDrawer.tsx';
import { TaskModal } from './components/TaskModal.tsx';
import { NoteModal } from './components/NoteModal.tsx';
import { CompleteTaskNoteModal } from './components/CompleteTaskNoteModal.tsx';
import { TaskAiAnalysisModal } from './components/TaskAiAnalysisModal.tsx';
import { PinLockScreen } from './components/PinLockScreen.tsx';
import { VoiceFocusModeModal } from './components/VoiceFocusModeModal.tsx';

export default function App() {
  // 1. Initialize central data sync (Firestore, backend retry, auto-lock, cron)
  useSyncManager();

  // 2. Sliced System Subscriptions
  const isUnlocked = useSystemStore(s => s.isUnlocked);
  const setIsUnlocked = useSystemStore(s => s.setIsUnlocked);
  const activeTab = useSystemStore(s => s.activeTab);
  const isAiDrawerOpen = useSystemStore(s => s.isAiDrawerOpen);
  const closeAiDrawer = useSystemStore(s => s.closeAiDrawer);
  const openAiDrawer = useSystemStore(s => s.openAiDrawer);
  const aiPromptToTrigger = useSystemStore(s => s.aiPromptToTrigger);
  const isVoiceFocusOpen = useSystemStore(s => s.isVoiceFocusOpen);
  const closeVoiceFocus = useSystemStore(s => s.closeVoiceFocus);
  const chatMessages = useSystemStore(s => s.chatMessages);
  const sendChatMessage = useSystemStore(s => s.sendChatMessage);
  const clearChatMessages = useSystemStore(s => s.clearChatMessages);

  // 3. Sliced Task Subscriptions
  const tasks = useTaskStore(s => s.tasks);
  const isTaskModalOpen = useTaskStore(s => s.isTaskModalOpen);
  const editingTask = useTaskStore(s => s.editingTask);
  const closeTaskModal = useTaskStore(s => s.closeTaskModal);
  const createTask = useTaskStore(s => s.createTask);
  const updateTask = useTaskStore(s => s.updateTask);
  const applyTaskUpdate = useTaskStore(s => s.applyTaskUpdate);
  const analyzingTask = useTaskStore(s => s.analyzingTask);
  const setAnalyzingTask = useTaskStore(s => s.setAnalyzingTask);
  const completingTaskForNote = useTaskStore(s => s.completingTaskForNote);
  const pendingTaskCompletionUpdates = useTaskStore(s => s.pendingTaskCompletionUpdates);
  const setCompletingTaskForNote = useTaskStore(s => s.setCompletingTaskForNote);
  const recurringToast = useTaskStore(s => s.recurringToast);
  const setRecurringToast = useTaskStore(s => s.setRecurringToast);

  // 4. Sliced Note Subscriptions
  const notes = useNoteStore(s => s.notes);
  const isNoteModalOpen = useNoteStore(s => s.isNoteModalOpen);
  const closeNoteModal = useNoteStore(s => s.closeNoteModal);
  const createNote = useNoteStore(s => s.createNote);
  const noteCreatedToast = useNoteStore(s => s.noteCreatedToast);
  const setNoteCreatedToast = useNoteStore(s => s.setNoteCreatedToast);

  // 5. Sliced File Subscriptions
  const files = useFileStore(s => s.files);
  const categories = useFileStore(s => s.categories);

  // Collect available tags across domain items
  const allAvailableTags = useMemo(() => {
    const set = new Set<string>();
    const defaults = ['Công việc', 'Báo cáo', 'Tài chính', 'Họp', 'Kế hoạch', 'Dự án', 'Architecture', 'AI', 'Google Drive'];
    defaults.forEach(t => set.add(t));
    tasks.forEach(t => t.tags?.forEach(tag => tag && set.add(tag.trim())));
    notes.forEach(n => n.tags?.forEach(tag => tag && set.add(tag.trim())));
    categories.forEach(c => set.add(c.name));
    return Array.from(set).filter(Boolean);
  }, [tasks, notes, categories]);

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#E0E0E0] font-sans selection:bg-[#D4AF37] selection:text-black">
      {/* PIN Security Lock Screen */}
      {!isUnlocked && (
        <PinLockScreen onUnlock={() => setIsUnlocked(true)} />
      )}

      {/* Header Bar - Zero prop-drilling, self-connected with Zustand */}
      <Header availableTags={allAvailableTags} />

      {/* Main Domain Views */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'tasks' && <TasksView />}
        {activeTab === 'notes' && <NotesView />}
        {activeTab === 'files' && <FilesView />}
        {activeTab === 'telegram' && <TelegramBotView />}
        {activeTab === 'ai-learning' && <AiLearningView />}
        {activeTab === 'settings' && <SettingsView />}
        {activeTab === 'architecture' && <SystemArchView />}
      </main>

      {/* AI Assistant Chat Drawer */}
      <AiChatDrawer
        isOpen={isAiDrawerOpen}
        onClose={closeAiDrawer}
        messages={chatMessages}
        onSendMessage={sendChatMessage}
        onClearMessages={clearChatMessages}
        initialPrompt={aiPromptToTrigger}
      />

      {/* Task Creation / Editing Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={closeTaskModal}
        onSave={(taskData) => {
          if (editingTask) {
            updateTask(editingTask.id, taskData);
          } else {
            createTask(taskData);
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
        onClose={closeNoteModal}
        onSave={createNote}
        tasks={tasks}
        files={files}
        existingNotes={notes}
      />

      {/* Interactive AI Note Creation on Task Completion Modal */}
      <CompleteTaskNoteModal
        isOpen={Boolean(completingTaskForNote)}
        task={completingTaskForNote}
        availableTags={allAvailableTags}
        onClose={() => setCompletingTaskForNote(null, null)}
        onCompleteOnly={async (task) => {
          const upd = pendingTaskCompletionUpdates || { status: 'completed' };
          setCompletingTaskForNote(null, null);
          await applyTaskUpdate(task.id, upd, task);
        }}
        onConfirmSaveNote={async (task, noteData) => {
          await createNote(noteData);
          const upd = pendingTaskCompletionUpdates || { status: 'completed' };
          setCompletingTaskForNote(null, null);
          await applyTaskUpdate(task.id, upd, task);

          setNoteCreatedToast({
            taskTitle: task.title,
            noteTitle: noteData.title,
          });
          setTimeout(() => setNoteCreatedToast(null), 6000);
        }}
      />

      {/* Instant AI Task Analysis Modal */}
      <TaskAiAnalysisModal
        isOpen={Boolean(analyzingTask)}
        onClose={() => setAnalyzingTask(null)}
        task={analyzingTask}
        onSaveAsNote={async (title, content, tags, linkedTaskId) => {
          await createNote({
            title,
            content,
            tags,
            linkedTaskIds: linkedTaskId ? [linkedTaskId] : [],
            attachedFileIds: [],
            isPinned: false,
          });
          setNoteCreatedToast({
            taskTitle: analyzingTask?.title || 'Công việc',
            noteTitle: title,
          });
          setTimeout(() => setNoteCreatedToast(null), 6000);
        }}
        onOpenAiChat={(prompt) => {
          setAnalyzingTask(null);
          openAiDrawer(prompt);
        }}
      />

      {/* Fullscreen Voice Assistant Focus Mode Modal */}
      <VoiceFocusModeModal
        isOpen={isVoiceFocusOpen}
        onClose={closeVoiceFocus}
        onSendMessage={sendChatMessage}
        messages={chatMessages}
        openAiChatWithPrompt={openAiDrawer}
      />

      {/* Floating Recurrence Transition Toast */}
      {recurringToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-[#121212] border border-[#D4AF37] rounded-sm p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="p-2 rounded-xs bg-[#D4AF37]/15 text-[#D4AF37] shrink-0 mt-0.5">
              <Repeat className="w-5 h-5 animate-spin-slow" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
                  Hoàn thành chu kỳ & Tự động lặp lại
                </span>
              </div>
              <h4 className="text-sm font-editorial-serif font-bold text-white leading-snug">
                {recurringToast.title}
              </h4>
              <p className="text-xs text-[#CCCCCC] leading-relaxed">
                {recurringToast.summary}
              </p>
              {recurringToast.nextDate && (
                <div className="text-[11px] text-[#A0A0A0] pt-1 flex items-center gap-1">
                  <span>Hạn chót chu kỳ kế tiếp:</span>
                  <span className="text-[#D4AF37] font-semibold">{recurringToast.nextDate}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setRecurringToast(null)}
              className="text-[#777777] hover:text-white p-1 rounded-xs transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Saved Note Toast */}
      {noteCreatedToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-[#121212] border border-emerald-500/60 rounded-sm p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="p-2 rounded-xs bg-emerald-500/15 text-emerald-400 shrink-0 mt-0.5">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Đã tạo ghi chú đúc kết thành công!
                </span>
              </div>
              <h4 className="text-sm font-editorial-serif font-bold text-white leading-snug">
                {noteCreatedToast.noteTitle}
              </h4>
              <p className="text-xs text-[#CCCCCC] leading-relaxed">
                Đã đúc kết bài học từ công việc "{noteCreatedToast.taskTitle}" và lưu trữ an toàn trong mục Ghi Chú.
              </p>
            </div>
            <button
              onClick={() => setNoteCreatedToast(null)}
              className="text-[#777777] hover:text-white p-1 rounded-xs transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
