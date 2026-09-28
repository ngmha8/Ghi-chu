import { create } from 'zustand';
import { Task } from '../types/index.js';
import { api } from '../services/api.js';
import { processTaskRecurrenceOnComplete } from '../utils/recurring.js';

export interface RecurringToastInfo {
  title: string;
  summary: string;
  nextDate: string;
}

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  isTaskModalOpen: boolean;
  editingTask: Task | null;
  analyzingTask: Task | null;
  completingTaskForNote: Task | null;
  pendingTaskCompletionUpdates: Partial<Task> | null;
  recurringToast: RecurringToastInfo | null;

  // Actions
  setTasks: (tasks: Task[]) => void;
  fetchTasks: () => Promise<void>;
  createTask: (taskData: Partial<Task>) => Promise<Task | null>;
  updateTask: (id: string, updates: Partial<Task>, options?: { skipNotePrompt?: boolean }) => Promise<void>;
  applyTaskUpdate: (id: string, updates: Partial<Task>, previousTaskParam?: Task) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  reorderTasks: (newOrderedTasks: Task[]) => Promise<void>;
  
  // Modals & UI triggers
  openTaskModal: (taskToEdit?: Task | null) => void;
  closeTaskModal: () => void;
  setAnalyzingTask: (task: Task | null) => void;
  setCompletingTaskForNote: (task: Task | null, updates?: Partial<Task> | null) => void;
  setRecurringToast: (toast: RecurringToastInfo | null) => void;
}

const getInitialCachedTasks = (): Task[] => {
  try {
    const cached = localStorage.getItem('cached_tasks');
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
};

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: getInitialCachedTasks(),
  isLoading: false,
  isTaskModalOpen: false,
  editingTask: null,
  analyzingTask: null,
  completingTaskForNote: null,
  pendingTaskCompletionUpdates: null,
  recurringToast: null,

  setTasks: (tasks) => set({ tasks }),

  fetchTasks: async () => {
    try {
      set({ isLoading: true });
      const tasks = await api.getTasks();
      set({ tasks, isLoading: false });
    } catch (err) {
      console.warn('Error fetching tasks from server:', err);
      set({ isLoading: false });
    }
  },

  createTask: async (taskData: Partial<Task>) => {
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
    set(state => ({ tasks: [optimisticTask, ...state.tasks] }));

    try {
      const created = await api.createTask(taskData);
      set(state => ({
        tasks: state.tasks.map(t => (t.id === tempId ? created : t)),
      }));
      return created;
    } catch (err) {
      console.error('Error creating task, rolling back:', err);
      set(state => ({
        tasks: state.tasks.filter(t => t.id !== tempId),
      }));
      return null;
    }
  },

  applyTaskUpdate: async (id: string, updates: Partial<Task>, previousTaskParam?: Task) => {
    const state = get();
    const previousTask = previousTaskParam || state.tasks.find(t => t.id === id);
    let finalUpdates = { ...updates };
    let recurrenceNotice: string | null = null;
    let nextDateStr: string | null = null;

    if (updates.status === 'completed' && previousTask && previousTask.status !== 'completed') {
      const recResult = processTaskRecurrenceOnComplete({
        ...previousTask,
        ...updates,
      });

      if (recResult.isRecurring) {
        finalUpdates = {
          deadline: recResult.updatedTask.deadline,
          status: recResult.updatedTask.status, // stays in_progress
          isNotified: false,
          lastNotifiedAt: undefined,
          recurring: recResult.updatedTask.recurring,
        };
        recurrenceNotice = recResult.summary || null;
        nextDateStr = recResult.formattedNextDate;
      }
    }

    // 0ms Optimistic UI update
    set(s => ({
      tasks: s.tasks.map(t => (t.id === id ? { ...t, ...finalUpdates, updatedAt: new Date().toISOString() } : t)),
    }));

    if (recurrenceNotice && previousTask) {
      set({
        recurringToast: {
          title: previousTask.title,
          summary: recurrenceNotice,
          nextDate: nextDateStr || '',
        }
      });
      setTimeout(() => {
        set({ recurringToast: null });
      }, 7000);
    }

    try {
      const updated = await api.updateTask(id, finalUpdates);
      set(s => ({
        tasks: s.tasks.map(t => (t.id === id ? updated : t)),
      }));
    } catch (err) {
      console.error('Error updating task, rolling back:', err);
      if (previousTask) {
        set(s => ({
          tasks: s.tasks.map(t => (t.id === id ? previousTask! : t)),
        }));
      }
    }
  },

  updateTask: async (id: string, updates: Partial<Task>, options?: { skipNotePrompt?: boolean }) => {
    const state = get();
    const previousTask = state.tasks.find(t => t.id === id);

    // If task is being marked completed and user hasn't skipped prompt
    if (
      updates.status === 'completed' &&
      previousTask &&
      previousTask.status !== 'completed' &&
      !options?.skipNotePrompt
    ) {
      set({
        completingTaskForNote: previousTask,
        pendingTaskCompletionUpdates: updates,
      });
      return;
    }

    await state.applyTaskUpdate(id, updates, previousTask);
  },

  deleteTask: async (id: string) => {
    const previousTasks = get().tasks;
    // 0ms Optimistic UI deletion
    set({ tasks: previousTasks.filter(t => t.id !== id) });

    try {
      await api.deleteTask(id);
    } catch (err) {
      console.error('Error deleting task, rolling back:', err);
      set({ tasks: previousTasks });
    }
  },

  reorderTasks: async (newOrderedTasks: Task[]) => {
    // 0ms Optimistic UI reordering
    set({ tasks: newOrderedTasks });
    try {
      const orderedIds = newOrderedTasks.map(t => t.id);
      await api.reorderTasks(orderedIds);
    } catch (err) {
      console.error('Error persisting reordered tasks:', err);
    }
  },

  openTaskModal: (taskToEdit = null) => {
    set({
      editingTask: taskToEdit,
      isTaskModalOpen: true,
    });
  },

  closeTaskModal: () => {
    set({
      editingTask: null,
      isTaskModalOpen: false,
    });
  },

  setAnalyzingTask: (task) => set({ analyzingTask: task }),

  setCompletingTaskForNote: (task, updates = null) => {
    set({
      completingTaskForNote: task,
      pendingTaskCompletionUpdates: updates,
    });
  },

  setRecurringToast: (toast) => set({ recurringToast: toast }),
}));
