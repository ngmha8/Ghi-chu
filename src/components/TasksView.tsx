import React, { useState, useMemo } from 'react';
import { Task, DriveFile, Note } from '../types/index.js';
import { TagSearchInput } from './TagSearchInput.js';
import { TaskCalendarView } from './TaskCalendarView.js';
import { formatOfficialDeadline, getDeadlineStatusInfo } from '../services/dateUtils.js';
import { formatRecurringLabel } from '../utils/recurring.js';
import { useTaskStore } from '../stores/useTaskStore.js';
import { useNoteStore } from '../stores/useNoteStore.js';
import { useFileStore } from '../stores/useFileStore.js';
import { useSystemStore } from '../stores/useSystemStore.js';
import {
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Calendar,
  Trash2,
  Edit2,
  Paperclip,
  Repeat,
  Sparkles,
  Filter,
  X,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  GripVertical,
  ArrowUpDown,
  Layers,
  Check,
  Maximize2,
  Mic,
  Download,
  AlertTriangle,
  ExternalLink,
  Flame,
  FileText,
  FileCheck,
  Lightbulb,
  Tag,
  Bot
} from 'lucide-react';

export interface TasksViewProps {
  tasks?: Task[];
  files?: DriveFile[];
  notes?: Note[];
  onTaskCreate?: (task: Partial<Task>) => void;
  onTaskUpdate?: (id: string, updates: Partial<Task>) => void;
  onTaskDelete?: (id: string) => void;
  onReorderTasks?: (tasks: Task[]) => void;
  openAiChatWithPrompt?: (prompt: string) => void;
  openNewTaskModal?: () => void;
  editTask?: (task: Task) => void;
  onAnalyzeTask?: (task: Task) => void;
}

export type TaskSortOption =
  | 'custom'
  | 'deadline_asc'
  | 'deadline_desc'
  | 'priority_desc'
  | 'priority_asc'
  | 'created_desc'
  | 'created_asc'
  | 'title_asc';

export const TasksView: React.FC<TasksViewProps> = ({
  tasks: propTasks,
  files: propFiles,
  notes: propNotes,
  onTaskCreate: propOnTaskCreate,
  onTaskUpdate: propOnTaskUpdate,
  onTaskDelete: propOnTaskDelete,
  onReorderTasks: propOnReorderTasks,
  openAiChatWithPrompt: propOpenAiChatWithPrompt,
  openNewTaskModal: propOpenNewTaskModal,
  editTask: propEditTask,
  onAnalyzeTask: propOnAnalyzeTask,
}) => {
  // Store subscriptions
  const storeTasks = useTaskStore(s => s.tasks);
  const storeCreateTask = useTaskStore(s => s.createTask);
  const storeUpdateTask = useTaskStore(s => s.updateTask);
  const storeDeleteTask = useTaskStore(s => s.deleteTask);
  const storeReorderTasks = useTaskStore(s => s.reorderTasks);
  const storeOpenTaskModal = useTaskStore(s => s.openTaskModal);
  const storeSetAnalyzingTask = useTaskStore(s => s.setAnalyzingTask);

  const storeNotes = useNoteStore(s => s.notes);
  const storeFiles = useFileStore(s => s.files);
  const storeOpenAiDrawer = useSystemStore(s => s.openAiDrawer);
  const storeOpenVoiceFocus = useSystemStore(s => s.openVoiceFocus);
  const storeSendChatMessage = useSystemStore(s => s.sendChatMessage);
  const storeSendTelegramCommand = useSystemStore(s => s.sendTelegramCommand);

  // Fallbacks
  const tasks = propTasks ?? storeTasks;
  const files = propFiles ?? storeFiles;
  const notes = propNotes ?? storeNotes;
  const onTaskCreate = propOnTaskCreate ?? storeCreateTask;
  const onTaskUpdate = propOnTaskUpdate ?? storeUpdateTask;
  const onTaskDelete = propOnTaskDelete ?? storeDeleteTask;
  const onReorderTasks = propOnReorderTasks ?? storeReorderTasks;
  const openAiChatWithPrompt = propOpenAiChatWithPrompt ?? storeOpenAiDrawer;
  const openNewTaskModal = propOpenNewTaskModal ?? (() => storeOpenTaskModal(null));
  const editTask = propEditTask ?? ((task: Task) => storeOpenTaskModal(task));
  const onAnalyzeTask = propOnAnalyzeTask ?? storeSetAnalyzingTask;

  // View & Filter States
  const [viewMode, setViewMode] = useState<'list' | 'matrix' | 'kanban' | 'calendar'>('list');
  const [search, setSearch] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterQuadrant, setFilterQuadrant] = useState<string>('all');
  const [sortBy, setSortBy] = useState<TaskSortOption>('deadline_asc');
  const [isCompletedCollapsed, setIsCompletedCollapsed] = useState<boolean>(false);
  const [quickAddTitle, setQuickAddTitle] = useState<string>('');
  const [quickAddTag, setQuickAddTag] = useState<string>('');
  const [quickAddDeadline, setQuickAddDeadline] = useState<string>('');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // Active Task Inspector
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Inspector draft edit state
  const activeSelectedTask = useMemo(() => {
    if (selectedTaskId) {
      const found = tasks.find(t => t.id === selectedTaskId);
      if (found) return found;
    }
    // Default to first active task
    return tasks.find(t => t.status !== 'completed' && t.status !== 'canceled') || tasks[0] || null;
  }, [tasks, selectedTaskId]);

  const [inspectorTitle, setInspectorTitle] = useState('');
  const [inspectorChecklist, setInspectorChecklist] = useState<Array<{ id: string; text: string; done: boolean }>>([
    { id: '1', text: 'Thu thập liều kế từ các phòng chụp', done: true },
    { id: '2', text: 'Đóng gói và gửi đơn vị kiểm định Trung ương', done: false },
  ]);
  const [newChecklistText, setNewChecklistText] = useState('');

  // Sync title when active task changes
  React.useEffect(() => {
    if (activeSelectedTask) {
      setInspectorTitle(activeSelectedTask.title);
    }
  }, [activeSelectedTask?.id]);

  // Quadrant classification logic
  const getTaskQuadrant = (task: Task): 'Q1' | 'Q2' | 'Q3' | 'Q4' => {
    const deadlineDate = new Date(task.deadline);
    const diffHours = isNaN(deadlineDate.getTime()) ? 999 : (deadlineDate.getTime() - Date.now()) / (1000 * 3600);
    const isUrgent = diffHours <= 48 || (task.tags && task.tags.some(t => t.toLowerCase().includes('khẩn') || t.toLowerCase().includes('q1')));
    const isImportant = task.priority === 'high' || task.priority === 'medium';

    if (isUrgent && isImportant) return 'Q1';
    if (!isUrgent && isImportant) return 'Q2';
    if (isUrgent && !isImportant) return 'Q3';
    return 'Q4';
  };

  // Metrics
  const totalTasks = tasks.length;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const q1Tasks = tasks.filter(t => getTaskQuadrant(t) === 'Q1');
  const q2Tasks = tasks.filter(t => getTaskQuadrant(t) === 'Q2');
  const overdueTasks = tasks.filter(t => {
    if (t.status === 'completed' || t.status === 'canceled' || !t.deadline) return false;
    return new Date(t.deadline).getTime() < Date.now();
  });
  const onTimeRate = totalTasks > 0 ? Math.max(0, Math.round(((totalTasks - overdueTasks.length) / totalTasks) * 100)) : 100;

  // Filter & Sort
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Status
      if (filterStatus === 'in_progress' && t.status !== 'in_progress') return false;
      if (filterStatus === 'completed' && t.status !== 'completed') return false;
      if (filterStatus === 'todo' && t.status !== 'todo') return false;

      // Quadrant
      if (filterQuadrant !== 'all') {
        if (getTaskQuadrant(t) !== filterQuadrant) return false;
      }

      // Search
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(query);
        const matchesDesc = t.description?.toLowerCase().includes(query);
        const matchesTags = t.tags?.some(tag => tag.toLowerCase().includes(query));
        if (!matchesTitle && !matchesDesc && !matchesTags) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'deadline_asc') {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (sortBy === 'priority_desc') {
        const pWeight = { high: 3, medium: 2, low: 1 };
        return (pWeight[b.priority] || 0) - (pWeight[a.priority] || 0);
      }
      return 0;
    });
  }, [tasks, filterStatus, filterQuadrant, search, sortBy]);

  // Tasks in progress vs completed
  const activeTasksList = useMemo(() => {
    return filteredTasks.filter(t => t.status !== 'completed' && t.status !== 'canceled');
  }, [filteredTasks]);

  const completedTasksList = useMemo(() => {
    return filteredTasks.filter(t => t.status === 'completed');
  }, [filteredTasks]);

  // Quick Inline Add Task Handler
  const handleQuickAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickAddTitle.trim()) return;

    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const defaultDeadline = quickAddDeadline || `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T18:00`;

    await onTaskCreate({
      title: quickAddTitle.trim(),
      description: '',
      deadline: defaultDeadline,
      priority: 'medium',
      status: 'in_progress',
      tags: quickAddTag.trim() ? [quickAddTag.trim()] : ['Công việc'],
      attachedFileIds: [],
      reminderOffsetMinutes: 15,
      recurring: { type: 'none' }
    });

    setQuickAddTitle('');
    setQuickAddTag('');
    setQuickAddDeadline('');
    setSaveNotice('Đã thêm công việc thành công!');
    setTimeout(() => setSaveNotice(null), 3000);
  };

  // Inspector Quick Save
  const handleInspectorSave = () => {
    if (!activeSelectedTask) return;
    if (inspectorTitle.trim() && inspectorTitle !== activeSelectedTask.title) {
      onTaskUpdate(activeSelectedTask.id, { title: inspectorTitle.trim() });
    }
    setSaveNotice('Đã lưu thay đổi!');
    setTimeout(() => setSaveNotice(null), 2500);
  };

  // Add checklist item
  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    setInspectorChecklist(prev => [
      ...prev,
      { id: String(Date.now()), text: newChecklistText.trim(), done: false }
    ]);
    setNewChecklistText('');
  };

  // Toggle checklist item
  const handleToggleChecklist = (id: string) => {
    setInspectorChecklist(prev =>
      prev.map(item => item.id === id ? { ...item, done: !item.done } : item)
    );
  };

  return (
    <div className="w-full pb-16 animate-fadeIn">
      {/* 1. Top Page Operational Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center">
              <CheckCircle2 className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Quản lý Công việc
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-[#1E1E1E] dark:text-[#D4AF37] text-xs font-semibold">
              Workspace Pro
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-[#888]">
            Theo dõi tiến độ, phân loại Ma trận Eisenhower và tối ưu hóa nhịp độ làm việc tập trung
          </p>
        </div>

        {/* Actions & View Switcher */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* View Switcher Segmented Control */}
          <div className="flex items-center bg-white dark:bg-[#151515] p-1 rounded-lg border border-slate-200 dark:border-[#2A2A2A] shadow-xs">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-blue-50 text-blue-700 dark:bg-[#2A2A2A] dark:text-[#D4AF37] font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-[#888] dark:hover:text-white'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Danh sách</span>
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-blue-50 text-blue-700 dark:bg-[#2A2A2A] dark:text-[#D4AF37] font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-[#888] dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ma trận 4x4</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-blue-50 text-blue-700 dark:bg-[#2A2A2A] dark:text-[#D4AF37] font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-[#888] dark:hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-blue-50 text-blue-700 dark:bg-[#2A2A2A] dark:text-[#D4AF37] font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-[#888] dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lịch</span>
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => storeOpenVoiceFocus()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#151515] border border-slate-200 dark:border-[#2A2A2A] text-slate-700 dark:text-[#DDD] text-xs font-medium hover:bg-slate-50 dark:hover:bg-[#202020] transition-colors shadow-xs"
            >
              <Mic className="w-3.5 h-3.5 text-blue-600 dark:text-[#D4AF37]" />
              <span className="hidden md:inline">Nhập Voice / AI</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#151515] border border-slate-200 dark:border-[#2A2A2A] text-slate-700 dark:text-[#DDD] text-xs font-medium hover:bg-slate-50 dark:hover:bg-[#202020] transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Xuất báo cáo</span>
            </button>
            <button
              onClick={openNewTaskModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white dark:bg-[#D4AF37] dark:text-black dark:hover:bg-[#c29f2e] text-xs font-semibold transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Thêm Task</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Summary KPI Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Metric 1: Total Tasks */}
        <div className="bg-white dark:bg-[#151515] p-4 rounded-xl shadow-xs border border-slate-200 dark:border-[#2A2A2A] flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-[#888] uppercase tracking-wider mb-1">
              Tổng công việc
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">{totalTasks}</span>
              <span className="text-xs text-slate-500 dark:text-[#777]">nhiệm vụ</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-[#777] mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              <span>{inProgressTasks} đang làm • {completedTasks} xong</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-[#202020] flex items-center justify-center text-blue-600 dark:text-[#D4AF37] shrink-0">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2: Urgent Q1 */}
        <div className="bg-white dark:bg-[#151515] p-4 rounded-xl shadow-xs border border-slate-200 dark:border-[#2A2A2A] flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" />
              <span>Cần xử lý ngay (Q1)</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">{q1Tasks.length}</span>
              <span className="text-xs text-emerald-600 font-semibold">{q1Tasks.length === 0 ? 'An toàn' : 'Cần xử lý'}</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-[#777] mt-1">
              {q1Tasks.length === 0 ? 'Không có việc khẩn cấp tồn đọng' : 'Tập trung giải quyết dứt điểm'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3: Strategic Q2 */}
        <div className="bg-white dark:bg-[#151515] p-4 rounded-xl shadow-xs border border-slate-200 dark:border-[#2A2A2A] flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Chiến lược (Q2)</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-amber-600">{q2Tasks.length}</span>
              <span className="text-xs text-amber-600 font-semibold">Trọng điểm</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-[#777] mt-1">
              Đầu tư 60% năng lượng
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 4: On-Time Rate */}
        <div className="bg-white dark:bg-[#151515] p-4 rounded-xl shadow-xs border border-slate-200 dark:border-[#2A2A2A] flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-[#888] uppercase tracking-wider mb-1">
              Tỷ lệ đúng hạn
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">{onTimeRate}%</span>
              <span className="text-xs text-emerald-600 font-semibold">Tối ưu</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-[#777] mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>{overdueTasks.length === 0 ? 'Không có task trễ hạn' : `${overdueTasks.length} task quá hạn`}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-[#202020] flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Search and Segmented Filter Bar */}
      <div className="bg-white dark:bg-[#151515] p-3 rounded-xl border border-slate-200 dark:border-[#2A2A2A] shadow-xs mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm công việc theo tên, tag, ghi chú liên quan..."
            className="w-full pl-9 pr-12 py-2 text-xs rounded-lg bg-slate-50 dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#2A2A2A] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-slate-200 dark:bg-[#222] text-slate-500 text-[10px] font-mono">
            ⌘K
          </kbd>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Segmented */}
          <div className="inline-flex p-1 rounded-lg bg-slate-100 dark:bg-[#0C0C0C]">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 rounded-md text-xs transition-all ${
                filterStatus === 'all'
                  ? 'bg-white dark:bg-[#2A2A2A] text-blue-600 dark:text-[#D4AF37] font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-[#888]'
              }`}
            >
              Tất cả ({totalTasks})
            </button>
            <button
              onClick={() => setFilterStatus('in_progress')}
              className={`px-3 py-1 rounded-md text-xs transition-all ${
                filterStatus === 'in_progress'
                  ? 'bg-white dark:bg-[#2A2A2A] text-blue-600 dark:text-[#D4AF37] font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-[#888]'
              }`}
            >
              Đang làm ({inProgressTasks})
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-3 py-1 rounded-md text-xs transition-all ${
                filterStatus === 'completed'
                  ? 'bg-white dark:bg-[#2A2A2A] text-blue-600 dark:text-[#D4AF37] font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-[#888]'
              }`}
            >
              Đã xong ({completedTasks})
            </button>
          </div>

          {/* Matrix Dropdown */}
          <select
            value={filterQuadrant}
            onChange={(e) => setFilterQuadrant(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#2A2A2A] text-slate-700 dark:text-[#DDD]"
          >
            <option value="all">Tất cả Ma trận</option>
            <option value="Q1">Q1 • Làm ngay</option>
            <option value="Q2">Q2 • Chiến lược</option>
            <option value="Q3">Q3 • Ủy quyền</option>
            <option value="Q4">Q4 • Loại bỏ</option>
          </select>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#2A2A2A] text-slate-700 dark:text-[#DDD]"
          >
            <option value="deadline_asc">Hạn chót: Gần nhất</option>
            <option value="priority_desc">Ưu tiên: Cao → Thấp</option>
          </select>
        </div>
      </div>

      {saveNotice && (
        <div className="mb-4 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{saveNotice}</span>
        </div>
      )}

      {/* 4. MAIN WORKSPACE: 2-COLUMN LAYOUT (LIST & INSPECTOR) */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Tasks List (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Section: IN PROGRESS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#888]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span className="font-bold uppercase tracking-wider text-slate-700 dark:text-white">
                    ĐANG THỰC HIỆN (IN PROGRESS)
                  </span>
                  <span className="px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700 dark:bg-[#222] dark:text-[#D4AF37] font-bold text-[10px]">
                    {activeTasksList.length}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">Kéo thả để sắp xếp lại</span>
              </div>

              {activeTasksList.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-white dark:bg-[#151515] border border-slate-200 dark:border-[#2A2A2A]">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Không có công việc nào đang chờ!</p>
                  <p className="text-xs text-slate-500 dark:text-[#888] mt-1">Tuyệt vời, bạn đã hoàn thành hết mục tiêu.</p>
                </div>
              ) : (
                activeTasksList.map(task => {
                  const quadrant = getTaskQuadrant(task);
                  const deadlineInfo = getDeadlineStatusInfo(task.deadline, task.status);
                  const isSelected = activeSelectedTask?.id === task.id;

                  return (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className={`p-4 rounded-xl bg-white dark:bg-[#151515] border transition-all cursor-pointer shadow-xs hover:shadow-md ${
                        isSelected
                          ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900/30'
                          : 'border-slate-200 dark:border-[#2A2A2A] hover:border-slate-300 dark:hover:border-[#333]'
                      }`}
                    >
                      {/* Meta Tags Row */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          task.priority === 'high' ? 'bg-rose-100 text-rose-800' :
                          task.priority === 'medium' ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          • {task.priority.toUpperCase()}
                        </span>

                        {task.recurring && task.recurring.type !== 'none' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-[#222] text-slate-700 dark:text-[#CCC] flex items-center gap-1">
                            <Repeat className="w-3 h-3 text-blue-500" />
                            <span>{formatRecurringLabel(task.recurring)}</span>
                          </span>
                        )}

                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{deadlineInfo.label}</span>
                        </span>

                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          quadrant === 'Q1' ? 'bg-rose-50 text-rose-700' :
                          quadrant === 'Q2' ? 'bg-amber-50 text-amber-800' :
                          quadrant === 'Q3' ? 'bg-sky-50 text-sky-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          • {quadrant} • {quadrant === 'Q1' ? 'Làm ngay' : quadrant === 'Q2' ? 'Lên kế hoạch' : quadrant === 'Q3' ? 'Ủy quyền' : 'Loại bỏ'}
                        </span>

                        <div className="ml-auto flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAnalyzeTask(task);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 dark:bg-[#222] dark:hover:bg-[#333] text-blue-600 dark:text-[#D4AF37] text-xs font-semibold transition-colors"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Phân tích AI</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              editTask(task);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onTaskDelete(task.id);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Main Title & Checkbox */}
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={task.status === 'completed'}
                          onChange={(e) => {
                            e.stopPropagation();
                            onTaskUpdate(task.id, { status: e.target.checked ? 'completed' : 'todo' });
                          }}
                          className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-0 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className="text-xs text-slate-600 dark:text-[#888] mt-1 line-clamp-2 leading-relaxed">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Footer Info */}
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-[#222] text-xs text-slate-500 dark:text-[#888]">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-[#AAA]">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formatOfficialDeadline(task.deadline)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {task.tags?.map((t, idx) => (
                            <span key={idx} className="font-mono text-[10px] text-blue-600 dark:text-[#D4AF37]">
                              #{t}
                            </span>
                          ))}
                          {task.attachedFileIds?.length > 0 && (
                            <span className="flex items-center gap-1 text-[11px] text-slate-400">
                              <Paperclip className="w-3 h-3" />
                              <span>{task.attachedFileIds.length}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Section: COMPLETED RECENTLY */}
            {completedTasksList.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#888]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="font-bold uppercase tracking-wider text-slate-700 dark:text-white">
                      HOÀN THÀNH GẦN ĐÂY (COMPLETED)
                    </span>
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 dark:bg-[#222] dark:text-emerald-400 font-bold text-[10px]">
                      {completedTasksList.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsCompletedCollapsed(!isCompletedCollapsed)}
                    className="text-blue-600 dark:text-[#D4AF37] font-semibold hover:underline"
                  >
                    {isCompletedCollapsed ? 'Hiện danh sách đã xong' : 'Ẩn danh sách đã xong'}
                  </button>
                </div>

                {!isCompletedCollapsed && (
                  <div className="space-y-2">
                    {completedTasksList.map(task => (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTaskId(task.id)}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#222] hover:bg-white dark:hover:bg-[#161616] transition-all flex items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <div className="min-w-0">
                            <h4 className="text-xs font-medium text-slate-600 dark:text-[#AAA] line-through truncate">
                              {task.title}
                            </h4>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                              <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 dark:bg-[#222] dark:text-amber-300">
                                {getTaskQuadrant(task)} • KẾ HOẠCH
                              </span>
                              <span>{formatOfficialDeadline(task.deadline).split(',')[0]}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTaskUpdate(task.id, { status: 'in_progress' });
                          }}
                          className="opacity-0 group-hover:opacity-100 text-xs text-blue-600 dark:text-[#D4AF37] hover:underline shrink-0"
                        >
                          Khôi phục
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quick Inline Add Task Bar */}
            <form onSubmit={handleQuickAdd} className="bg-white dark:bg-[#151515] rounded-xl p-2.5 shadow-xs border border-slate-200 dark:border-[#2A2A2A] flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600 dark:text-[#D4AF37] ml-1" />
              <input
                type="text"
                value={quickAddTitle}
                onChange={(e) => setQuickAddTitle(e.target.value)}
                placeholder="+ Thêm nhanh công việc mới (Nhập tiêu đề và ấn Enter)..."
                className="flex-1 bg-transparent py-1 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
              />
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={quickAddTag}
                  onChange={(e) => setQuickAddTag(e.target.value)}
                  placeholder="# Tag"
                  className="w-16 px-2 py-1 text-[11px] rounded bg-slate-100 dark:bg-[#222] text-slate-700 dark:text-[#DDD] outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white dark:bg-[#D4AF37] dark:text-black dark:hover:bg-[#c29f2e] text-xs font-semibold transition-colors"
                >
                  Thêm
                </button>
              </div>
            </form>

            {/* Eisenhower Covey Note Banner */}
            <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-[#141414] border border-blue-100 dark:border-[#2A2A2A] text-slate-800 dark:text-[#CCC] flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <strong className="text-blue-900 dark:text-[#D4AF37] block font-semibold mb-0.5">
                  Nguyên lý Covey & Eisenhower:
                </strong>
                Dành ít nhất 60% thời lượng cho <strong>Q2 (Quan trọng • Không khẩn cấp)</strong> để kiến tạo năng lực bền vững và loại trừ triệt để tình trạng khủng hoảng dồn ứ thời hạn.
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: TASK INSPECTOR PANEL (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4 sticky top-20">
            {activeSelectedTask ? (
              <div className="bg-white dark:bg-[#151515] rounded-xl shadow-xs border border-slate-200 dark:border-[#2A2A2A] p-5 flex flex-col gap-4">
                {/* Inspector Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#222]">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-[#D4AF37]" />
                    <span className="text-sm font-bold text-slate-900 dark:text-white">Chi tiết Công việc</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => editTask(activeSelectedTask)}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-[#222] text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                      title="Mở toàn màn hình"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Task Title */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    TÊN NHIỆM VỤ
                  </span>
                  <input
                    type="text"
                    value={inspectorTitle}
                    onChange={(e) => setInspectorTitle(e.target.value)}
                    onBlur={handleInspectorSave}
                    className="w-full text-sm font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-[#0C0C0C] px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2A2A2A] focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Status & Priority Selectors */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-[#0C0C0C] p-2.5 rounded-lg border border-slate-200 dark:border-[#2A2A2A]">
                    <span className="text-[10px] text-slate-400 block mb-1">Trạng thái</span>
                    <select
                      value={activeSelectedTask.status}
                      onChange={(e) => onTaskUpdate(activeSelectedTask.id, { status: e.target.value as any })}
                      className="w-full bg-transparent text-xs font-semibold text-blue-600 dark:text-[#D4AF37] outline-none cursor-pointer"
                    >
                      <option value="todo">ĐANG CHỜ (Todo)</option>
                      <option value="in_progress">ĐANG LÀM</option>
                      <option value="completed">HOÀN THÀNH</option>
                      <option value="canceled">ĐÃ HỦY</option>
                    </select>
                  </div>

                  <div className="bg-slate-50 dark:bg-[#0C0C0C] p-2.5 rounded-lg border border-slate-200 dark:border-[#2A2A2A]">
                    <span className="text-[10px] text-slate-400 block mb-1">Độ ưu tiên</span>
                    <select
                      value={activeSelectedTask.priority}
                      onChange={(e) => onTaskUpdate(activeSelectedTask.id, { priority: e.target.value as any })}
                      className="w-full bg-transparent text-xs font-semibold text-amber-600 outline-none cursor-pointer"
                    >
                      <option value="high">🔴 CAO (High)</option>
                      <option value="medium">🟡 TRUNG BÌNH (Medium)</option>
                      <option value="low">🟢 THẤP (Low)</option>
                    </select>
                  </div>
                </div>

                {/* Eisenhower Quadrant Selector */}
                <div className="bg-slate-50 dark:bg-[#0C0C0C] p-2.5 rounded-lg border border-slate-200 dark:border-[#2A2A2A]">
                  <span className="text-[10px] text-slate-400 block mb-1">Phân loại Ma trận Eisenhower</span>
                  <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    • {getTaskQuadrant(activeSelectedTask)} • Kế hoạch Chiến lược (Quan trọng • Không khẩn cấp)
                  </div>
                </div>

                {/* AI Suggestion Card */}
                <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-[#1A1A1A] border border-blue-100 dark:border-[#333] space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-[#D4AF37]">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-[#D4AF37]" />
                    <span>Trí tuệ nhân tạo (AI Suggestion)</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-[#AAA] leading-relaxed">
                    Nhiệm vụ có chu kỳ lặp lại dài ({taskRecurringLabel(activeSelectedTask)}). Đã cấu hình Telegram Bot tự động kích hoạt nhắc nhở trước 7 ngày.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => {
                        storeSendTelegramCommand(`/task ${activeSelectedTask.id}`);
                        setSaveNotice('Đã ping thử nghiệm tới Telegram!');
                        setTimeout(() => setSaveNotice(null), 3000);
                      }}
                      className="px-2.5 py-1 rounded bg-white dark:bg-[#222] border border-blue-200 dark:border-[#444] text-[11px] font-semibold text-blue-700 dark:text-white hover:bg-blue-50 transition-colors flex items-center gap-1"
                    >
                      <Bot className="w-3 h-3" />
                      <span>Tạo Bot ping</span>
                    </button>
                    <button
                      onClick={() => {
                        openAiChatWithPrompt(`Hãy tóm tắt và phác thảo mẫu biên bản/kế hoạch thực hiện cho công việc: "${activeSelectedTask.title}".`);
                      }}
                      className="px-2.5 py-1 rounded bg-white dark:bg-[#222] border border-blue-200 dark:border-[#444] text-[11px] font-semibold text-blue-700 dark:text-white hover:bg-blue-50 transition-colors flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3" />
                      <span>Tóm tắt mẫu biên bản</span>
                    </button>
                  </div>
                </div>

                {/* Checklist */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      CHECKLIST / CÁC BƯỚC THỰC HIỆN ({inspectorChecklist.filter(i => i.done).length}/{inspectorChecklist.length})
                    </span>
                  </div>

                  <div className="space-y-1.5 mb-2">
                    {inspectorChecklist.map(item => (
                      <div
                        key={item.id}
                        onClick={() => handleToggleChecklist(item.id)}
                        className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-[#0C0C0C] border border-slate-100 dark:border-[#222] text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-0"
                        />
                        <span className={`flex-1 ${item.done ? 'line-through text-slate-400' : 'text-slate-800 dark:text-[#DDD]'}`}>
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newChecklistText}
                      onChange={(e) => setNewChecklistText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddChecklistItem();
                        }
                      }}
                      placeholder="+ Thêm mục checklist..."
                      className="flex-1 px-2.5 py-1 text-xs rounded bg-slate-50 dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#2A2A2A] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
                    />
                    <button
                      onClick={handleAddChecklistItem}
                      className="px-2.5 py-1 rounded bg-slate-200 dark:bg-[#222] text-xs font-semibold text-slate-700 dark:text-white"
                    >
                      Thêm
                    </button>
                  </div>
                </div>

                {/* Linked Documents & Notes */}
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                    TÀI LIỆU & GHI CHÚ LIÊN KẾT
                  </span>

                  <div className="space-y-2">
                    {files.slice(0, 2).map((file, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#0C0C0C] border border-slate-100 dark:border-[#222] flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Paperclip className="w-4 h-4 text-blue-600 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-medium text-slate-900 dark:text-white truncate block">
                              {file.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {(file.size / (1024 * 1024)).toFixed(2)} MB • Google Drive Sync
                            </span>
                          </div>
                        </div>
                        {file.webViewLink && (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-slate-400 hover:text-blue-600"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-[#222] gap-2">
                  <button
                    onClick={() => onTaskDelete(activeSelectedTask.id)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#2A2A2A] text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onTaskUpdate(activeSelectedTask.id, {
                        status: activeSelectedTask.status === 'completed' ? 'in_progress' : 'completed'
                      })}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{activeSelectedTask.status === 'completed' ? 'Mở lại' : 'Đánh dấu xong'}</span>
                    </button>
                    <button
                      onClick={handleInspectorSave}
                      className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white dark:bg-[#D4AF37] dark:text-black text-xs font-semibold transition-colors"
                    >
                      Lưu
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl bg-white dark:bg-[#151515] border border-slate-200 dark:border-[#2A2A2A]">
                <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-500">Chọn một công việc để xem chi tiết</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. KANBAN BOARD VIEW MODE */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {(['todo', 'in_progress', 'completed', 'canceled'] as const).map(colStatus => {
            const colTasks = filteredTasks.filter(t => t.status === colStatus);
            const colTitleMap = {
              todo: 'Đang chờ (Todo)',
              in_progress: 'Đang làm (In Progress)',
              completed: 'Hoàn thành (Done)',
              canceled: 'Đã hủy (Canceled)'
            };

            return (
              <div
                key={colStatus}
                className="p-4 rounded-xl bg-white dark:bg-[#151515] border border-slate-200 dark:border-[#2A2A2A] shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2A2A2A] pb-2">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    {colTitleMap[colStatus]}
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-[#1A1A1A] dark:text-[#D4AF37]">
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-2.5 min-h-[300px]">
                  {colTasks.map(task => (
                    <div
                      key={task.id}
                      onClick={() => {
                        setSelectedTaskId(task.id);
                        editTask(task);
                      }}
                      className="p-3 rounded-lg bg-slate-50 dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#2A2A2A] space-y-2 hover:border-blue-400 transition-all cursor-pointer shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                          task.priority === 'high' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {task.priority.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatOfficialDeadline(task.deadline).split(',')[0]}</span>
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">{task.title}</h4>
                      {task.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-2">{task.description}</p>
                      )}
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <div className="h-28 border border-dashed border-slate-200 dark:border-[#2A2A2A] rounded-lg flex items-center justify-center text-slate-400 text-xs">
                      Không có task
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. MATRIX 4x4 VIEW MODE */}
      {viewMode === 'matrix' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => {
            const qTasks = filteredTasks.filter(t => getTaskQuadrant(t) === q);
            const qTitle = q === 'Q1' ? 'Q1 • Làm Ngay (Do First)' :
                           q === 'Q2' ? 'Q2 • Lên Kế Hoạch (Schedule)' :
                           q === 'Q3' ? 'Q3 • Ủy Quyền (Delegate)' :
                           'Q4 • Loại Bỏ (Eliminate)';
            const qColor = q === 'Q1' ? 'border-rose-300 text-rose-700' :
                           q === 'Q2' ? 'border-amber-300 text-amber-700' :
                           q === 'Q3' ? 'border-sky-300 text-sky-700' :
                           'border-slate-300 text-slate-700';

            return (
              <div
                key={q}
                className="p-4 rounded-xl bg-white dark:bg-[#151515] border border-slate-200 dark:border-[#2A2A2A] shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#222]">
                  <span className={`text-xs font-bold ${qColor}`}>{qTitle}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#222] font-semibold text-slate-600">
                    {qTasks.length} việc
                  </span>
                </div>
                <div className="space-y-2 min-h-[160px]">
                  {qTasks.map(task => (
                    <div
                      key={task.id}
                      onClick={() => editTask(task)}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#0C0C0C] border border-slate-100 dark:border-[#222] hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-between"
                    >
                      <span className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                        {task.title}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatOfficialDeadline(task.deadline).split(',')[0]}
                      </span>
                    </div>
                  ))}
                  {qTasks.length === 0 && (
                    <div className="h-24 flex items-center justify-center text-xs text-slate-400 italic">
                      Trống
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 7. CALENDAR VIEW MODE */}
      {viewMode === 'calendar' && (
        <TaskCalendarView
          tasks={filteredTasks}
          onTaskUpdate={onTaskUpdate}
          onTaskDelete={onTaskDelete}
          editTask={editTask}
          openNewTaskModal={openNewTaskModal}
        />
      )}
    </div>
  );
};

function taskRecurringLabel(task: Task): string {
  if (!task.recurring || task.recurring.type === 'none') return 'không lặp';
  return formatRecurringLabel(task.recurring);
}
