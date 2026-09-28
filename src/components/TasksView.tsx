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
  Check
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

const priorityWeights: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export const sortTasksByOption = (taskList: Task[], option: TaskSortOption): Task[] => {
  return [...taskList].sort((a, b) => {
    switch (option) {
      case 'deadline_asc': {
        const timeA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const timeB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        const validA = !isNaN(timeA) && timeA !== Infinity;
        const validB = !isNaN(timeB) && timeB !== Infinity;
        if (validA && validB) {
          if (timeA !== timeB) return timeA - timeB;
        } else if (validA && !validB) {
          return -1;
        } else if (!validA && validB) {
          return 1;
        }
        return (a.order ?? 0) - (b.order ?? 0);
      }
      case 'deadline_desc': {
        const timeA = a.deadline ? new Date(a.deadline).getTime() : -Infinity;
        const timeB = b.deadline ? new Date(b.deadline).getTime() : -Infinity;
        const validA = !isNaN(timeA) && timeA !== -Infinity;
        const validB = !isNaN(timeB) && timeB !== -Infinity;
        if (validA && validB) {
          if (timeA !== timeB) return timeB - timeA;
        } else if (validA && !validB) {
          return -1;
        } else if (!validA && validB) {
          return 1;
        }
        return (a.order ?? 0) - (b.order ?? 0);
      }
      case 'priority_desc': {
        const weightA = priorityWeights[a.priority] || 0;
        const weightB = priorityWeights[b.priority] || 0;
        if (weightB !== weightA) return weightB - weightA;
        const timeA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const timeB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) return timeA - timeB;
        return (a.order ?? 0) - (b.order ?? 0);
      }
      case 'priority_asc': {
        const weightA = priorityWeights[a.priority] || 0;
        const weightB = priorityWeights[b.priority] || 0;
        if (weightA !== weightB) return weightA - weightB;
        const timeA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const timeB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) return timeA - timeB;
        return (a.order ?? 0) - (b.order ?? 0);
      }
      case 'created_desc': {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        if (timeB !== timeA) return timeB - timeA;
        return (a.order ?? 0) - (b.order ?? 0);
      }
      case 'created_asc': {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return (a.order ?? 0) - (b.order ?? 0);
      }
      case 'title_asc': {
        const comp = a.title.localeCompare(b.title, 'vi', { sensitivity: 'base' });
        if (comp !== 0) return comp;
        return (a.order ?? 0) - (b.order ?? 0);
      }
      case 'custom':
      default:
        return (a.order ?? 0) - (b.order ?? 0);
    }
  });
};

const getSortLabel = (option: TaskSortOption): string => {
  switch (option) {
    case 'deadline_asc':
      return 'Hạn chót gần nhất';
    case 'deadline_desc':
      return 'Hạn chót xa nhất';
    case 'priority_desc':
      return 'Ưu tiên: Cao → Thấp';
    case 'priority_asc':
      return 'Ưu tiên: Thấp → Cao';
    case 'created_desc':
      return 'Mới nhất';
    case 'created_asc':
      return 'Cũ nhất';
    case 'title_asc':
      return 'Tiêu đề (A-Z)';
    case 'custom':
    default:
      return 'Tùy chỉnh / Kéo thả';
  }
};

type DateRangePreset = 'all' | 'today' | 'next7' | 'month' | 'overdue' | 'custom';

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
  // Store slices
  const storeTasks = useTaskStore(s => s.tasks);
  const storeCreateTask = useTaskStore(s => s.createTask);
  const storeUpdateTask = useTaskStore(s => s.updateTask);
  const storeDeleteTask = useTaskStore(s => s.deleteTask);
  const storeReorderTasks = useTaskStore(s => s.reorderTasks);
  const storeOpenTaskModal = useTaskStore(s => s.openTaskModal);
  const storeSetAnalyzingTask = useTaskStore(s => s.setAnalyzingTask);

  const storeFiles = useFileStore(s => s.files);
  const storeNotes = useNoteStore(s => s.notes);
  const storeOpenAiDrawer = useSystemStore(s => s.openAiDrawer);

  // Resolved values
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
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<TaskSortOption>('custom');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'calendar'>('list');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<Task['status'] | null>(null);
  const [draggedOverCol, setDraggedOverCol] = useState<string | null>(null);

  const resetDragState = () => {
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setDragOverPosition(null);
    setDragOverStatus(null);
    setDraggedOverCol(null);
  };

  const reorderTasksList = (allTasks: Task[], sourceId: string, targetId: string, position: 'before' | 'after'): Task[] => {
    const sourceTask = allTasks.find(t => t.id === sourceId);
    if (!sourceTask) return allTasks;

    const withoutSource = allTasks.filter(t => t.id !== sourceId);
    const targetIndex = withoutSource.findIndex(t => t.id === targetId);
    if (targetIndex === -1) return allTasks;

    const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
    const copy = [...withoutSource];
    copy.splice(insertIndex, 0, sourceTask);
    return copy.map((t, idx) => ({ ...t, order: idx }));
  };

  const moveAndReorderTask = (
    allTasks: Task[],
    sourceId: string,
    newStatus: Task['status'],
    targetId?: string,
    position: 'before' | 'after' = 'after'
  ): Task[] => {
    const sourceTask = allTasks.find(t => t.id === sourceId);
    if (!sourceTask) return allTasks;

    const updatedTask = { ...sourceTask, status: newStatus };
    const withoutSource = allTasks.filter(t => t.id !== sourceId);

    if (!targetId) {
      const copy = [...withoutSource, updatedTask];
      return copy.map((t, idx) => ({ ...t, order: idx }));
    }

    const targetIndex = withoutSource.findIndex(t => t.id === targetId);
    if (targetIndex === -1) {
      const copy = [...withoutSource, updatedTask];
      return copy.map((t, idx) => ({ ...t, order: idx }));
    }

    const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
    const copy = [...withoutSource];
    copy.splice(insertIndex, 0, updatedTask);
    return copy.map((t, idx) => ({ ...t, order: idx }));
  };

  // Collect all unique available tags with usage counts
  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach(t => {
      t.tags?.forEach(tag => {
        const clean = tag.trim();
        if (clean) map.set(clean, (map.get(clean) || 0) + 1);
      });
    });
    return map;
  }, [tasks]);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    const defaults = ['Công việc', 'Báo cáo', 'Tài chính', 'Họp', 'Quan trọng', 'Khẩn cấp', 'Dự án', 'Cá nhân'];
    defaults.forEach(t => set.add(t));
    tasks.forEach(t => t.tags?.forEach(tag => tag && set.add(tag.trim())));
    notes?.forEach(n => n.tags?.forEach(tag => tag && set.add(tag.trim())));
    return Array.from(set).filter(Boolean);
  }, [tasks, notes]);

  // Multi-dimensional filtering and sorting logic
  const filteredTasks = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const sevenDaysEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const matching = tasks.filter(task => {
      // 1. Status filter
      if (filterStatus !== 'all' && task.status !== filterStatus) return false;

      // 2. Priority filter
      if (filterPriority !== 'all' && task.priority !== filterPriority) return false;

      // 3. Tag filter
      if (selectedTag !== 'all') {
        const hasTag = task.tags?.some(t => t.toLowerCase() === selectedTag.toLowerCase());
        if (!hasTag) return false;
      }

      // 4. Date Range Filter
      const taskDeadline = task.deadline ? new Date(task.deadline) : null;
      if (taskDeadline && !isNaN(taskDeadline.getTime())) {
        if (dateRangePreset === 'today') {
          if (taskDeadline < todayStart || taskDeadline > todayEnd) return false;
        } else if (dateRangePreset === 'next7') {
          if (taskDeadline < todayStart || taskDeadline > sevenDaysEnd) return false;
        } else if (dateRangePreset === 'month') {
          if (taskDeadline < todayStart || taskDeadline > monthEnd) return false;
        } else if (dateRangePreset === 'overdue') {
          if (taskDeadline >= now || task.status === 'completed' || task.status === 'canceled') return false;
        } else if (dateRangePreset === 'custom') {
          if (customStartDate && taskDeadline < new Date(customStartDate)) return false;
          if (customEndDate && taskDeadline > new Date(customEndDate + 'T23:59:59')) return false;
        }
      }

      // 5. Search Text Filter (with #tag query support)
      if (search.trim()) {
        const q = search.toLowerCase();
        const tagQueries = q.match(/#([\w\p{L}]+)/gu)?.map(t => t.slice(1).toLowerCase()) || [];
        const nonTagQ = q.replace(/#([\w\p{L}]+)/gu, '').trim();

        const matchTitle = !nonTagQ || task.title.toLowerCase().includes(nonTagQ);
        const matchDesc = !nonTagQ || task.description.toLowerCase().includes(nonTagQ);
        const matchText = matchTitle || matchDesc;

        const matchAllTags = tagQueries.length === 0 || tagQueries.every(tq => 
          task.tags.some(t => t.toLowerCase().includes(tq))
        );

        const matchAnyTag = task.tags.some(t => t.toLowerCase().includes(q));

        return (matchText && matchAllTags) || matchAnyTag;
      }

      return true;
    });

    return sortTasksByOption(matching, sortBy);
  }, [tasks, filterStatus, filterPriority, selectedTag, dateRangePreset, customStartDate, customEndDate, search, sortBy]);

  const hasActiveFilters = filterStatus !== 'all' || filterPriority !== 'all' || selectedTag !== 'all' || dateRangePreset !== 'all' || search.trim() !== '' || sortBy !== 'custom';

  const handleResetFilters = () => {
    setFilterStatus('all');
    setFilterPriority('all');
    setSelectedTag('all');
    setDateRangePreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setSearch('');
    setSortBy('custom');
  };

  const handleApplySortPermanently = () => {
    if (!onReorderTasks) return;
    const sorted = sortTasksByOption(tasks, sortBy);
    const reorderedWithOrder = sorted.map((t, idx) => ({ ...t, order: idx }));
    onReorderTasks(reorderedWithOrder);
    setSortBy('custom');
    setSaveNotice('Đã lưu thứ tự sắp xếp mới vào danh sách!');
    setTimeout(() => {
      setSaveNotice(null);
    }, 3000);
  };

  // Unified Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    setDraggedTaskId(taskId);
  };

  const handleCardDragOver = (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    if (draggedTaskId === targetTaskId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? 'before' : 'after';
    if (dragOverTaskId !== targetTaskId || dragOverPosition !== pos) {
      setDragOverTaskId(targetTaskId);
      setDragOverPosition(pos);
    }
  };

  const handleCardDropInList = (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (sourceId && sourceId !== targetTaskId) {
      const pos = dragOverPosition || 'after';
      const reordered = reorderTasksList(tasks, sourceId, targetTaskId, pos);
      if (onReorderTasks) {
        onReorderTasks(reordered);
      }
      if (sortBy !== 'custom') {
        setSortBy('custom');
      }
    }
    resetDragState();
  };

  const handleCardDropInKanban = (
    e: React.DragEvent,
    targetTaskId: string,
    colStatus: Task['status']
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (sourceId) {
      const pos = dragOverPosition || 'after';
      const reordered = moveAndReorderTask(tasks, sourceId, colStatus, targetTaskId, pos);
      if (onReorderTasks) {
        onReorderTasks(reordered);
      }
      const sourceTask = tasks.find(t => t.id === sourceId);
      if (sourceTask && sourceTask.status !== colStatus) {
        onTaskUpdate(sourceId, { status: colStatus });
      }
    }
    resetDragState();
  };

  const handleDragOverColumn = (e: React.DragEvent, colStatus: string) => {
    e.preventDefault();
    if (draggedOverCol !== colStatus) {
      setDraggedOverCol(colStatus);
    }
  };

  const handleDragLeaveColumn = () => {
    setDraggedOverCol(null);
  };

  const handleColumnDrop = (e: React.DragEvent, colStatus: Task['status']) => {
    e.preventDefault();
    setDraggedOverCol(null);
    const sourceId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (sourceId) {
      const sourceTask = tasks.find(t => t.id === sourceId);
      const reordered = moveAndReorderTask(tasks, sourceId, colStatus);
      if (onReorderTasks) {
        onReorderTasks(reordered);
      }
      if (sourceTask && sourceTask.status !== colStatus) {
        onTaskUpdate(sourceId, { status: colStatus });
      }
    }
    resetDragState();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Editorial Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#151515] border border-[#2A2A2A] p-5 rounded-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-sm bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/30">
            <CheckCircle2 className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div>
            <h1 className="text-xl font-editorial-serif font-bold text-white">Quản lý công việc (Task Management)</h1>
            <p className="text-xs text-[#888888] italic">Optimistic 0ms UI • Lọc đa chiều • Kéo thả Kanban • Tự động nhắc Telegram</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-[#0C0C0C] p-1 rounded-sm border border-[#2A2A2A]">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 text-xs uppercase font-bold tracking-wider rounded-sm transition-all cursor-pointer ${
                viewMode === 'list' ? 'bg-[#D4AF37] text-black' : 'text-[#888888] hover:text-[#E0E0E0]'
              }`}
            >
              Danh sách
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1 text-xs uppercase font-bold tracking-wider rounded-sm transition-all cursor-pointer ${
                viewMode === 'kanban' ? 'bg-[#D4AF37] text-black' : 'text-[#888888] hover:text-[#E0E0E0]'
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1 text-xs uppercase font-bold tracking-wider rounded-sm transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'calendar' ? 'bg-[#D4AF37] text-black' : 'text-[#888888] hover:text-[#E0E0E0]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Lịch (Calendar)</span>
            </button>
          </div>

          <button
            onClick={openNewTaskModal}
            className="px-4 py-2 rounded-sm bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Tạo Task</span>
          </button>
        </div>
      </div>

      {/* Multi-Dimensional Filter Bar */}
      <div className="bg-[#151515] p-4 rounded-sm border border-[#2A2A2A] space-y-3.5">
        
        {/* Row 1: Search and Select dropdowns */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex-1">
            <TagSearchInput
              placeholder="Lọc công việc theo từ khóa hoặc gõ # để chọn tag..."
              value={search}
              onChange={setSearch}
              availableTags={availableTags}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-xs text-[#E0E0E0] focus:outline-none focus:border-[#D4AF37] cursor-pointer"
            >
              <option value="all">Tất cả Trạng thái</option>
              <option value="todo">Đang chờ (Todo)</option>
              <option value="in_progress">Đang làm (In Progress)</option>
              <option value="completed">Đã xong (Completed)</option>
              <option value="canceled">Đã hủy (Canceled)</option>
            </select>

            {/* Priority Filter */}
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-1.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-xs text-[#E0E0E0] focus:outline-none focus:border-[#D4AF37] cursor-pointer"
            >
              <option value="all">Tất cả Độ ưu tiên</option>
              <option value="high">🔴 Ưu tiên Cao (High)</option>
              <option value="medium">🟡 Ưu tiên Trung bình (Medium)</option>
              <option value="low">🟢 Ưu tiên Thấp (Low)</option>
            </select>

            {/* Date Range Preset Selector */}
            <select
              value={dateRangePreset}
              onChange={(e) => setDateRangePreset(e.target.value as DateRangePreset)}
              className="px-3 py-1.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-xs text-[#E0E0E0] focus:outline-none focus:border-[#D4AF37] cursor-pointer"
            >
              <option value="all">📅 Tất cả ngày</option>
              <option value="today">Hôm nay</option>
              <option value="next7">7 ngày tới</option>
              <option value="month">Tháng này</option>
              <option value="overdue">⚠️ Quá hạn</option>
              <option value="custom">Tùy chỉnh khoảng ngày...</option>
            </select>

            {/* Sorting Control Dropdown */}
            <div className="flex items-center gap-1.5 bg-[#0C0C0C] px-2.5 py-1.5 border border-[#2A2A2A] rounded-sm focus-within:border-[#D4AF37] transition-colors">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as TaskSortOption)}
                className="bg-transparent text-xs text-[#E0E0E0] focus:outline-none focus:text-[#D4AF37] cursor-pointer"
                title="Sắp xếp danh sách công việc theo hạn chót, độ ưu tiên hoặc ngày tạo"
              >
                <option value="custom" className="bg-[#151515] text-[#E0E0E0]">Thứ tự kéo thả (Tùy chỉnh)</option>
                <option value="deadline_asc" className="bg-[#151515] text-[#E0E0E0]">📅 Hạn chót: Gần nhất trước</option>
                <option value="deadline_desc" className="bg-[#151515] text-[#E0E0E0]">📅 Hạn chót: Xa nhất trước</option>
                <option value="priority_desc" className="bg-[#151515] text-[#E0E0E0]">🔴 Ưu tiên: Cao đến Thấp</option>
                <option value="priority_asc" className="bg-[#151515] text-[#E0E0E0]">🟢 Ưu tiên: Thấp đến Cao</option>
                <option value="created_desc" className="bg-[#151515] text-[#E0E0E0]">✨ Ngày tạo: Mới nhất</option>
                <option value="created_asc" className="bg-[#151515] text-[#E0E0E0]">⏳ Ngày tạo: Cũ nhất</option>
                <option value="title_asc" className="bg-[#151515] text-[#E0E0E0]">🔤 Tiêu đề (A → Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Row 2: Custom Date Range Pickers (if custom selected) */}
        {dateRangePreset === 'custom' && (
          <div className="flex items-center gap-3 bg-[#0C0C0C] p-3 rounded-sm border border-[#2A2A2A] text-xs">
            <span className="text-[#888888] font-bold">Từ ngày:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2 py-1 bg-[#151515] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] focus:outline-none focus:border-[#D4AF37]"
            />
            <span className="text-[#888888] font-bold">Đến ngày:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2 py-1 bg-[#151515] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
        )}

        {/* Row 3: Tag Chips Quick-Filter */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 border-t border-[#222222]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#777777] shrink-0">Tags:</span>
          
          <button
            onClick={() => setSelectedTag('all')}
            className={`px-2.5 py-1 text-[11px] rounded-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedTag === 'all'
                ? 'bg-[#D4AF37] text-black font-bold'
                : 'bg-[#0C0C0C] text-[#888888] hover:text-white border border-[#2A2A2A]'
            }`}
          >
            Tất cả ({tasks.length})
          </button>

          {Array.from(tagCounts.entries()).map(([tag, count]) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? 'all' : tag)}
              className={`px-2.5 py-1 text-[11px] rounded-sm whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border ${
                selectedTag === tag
                  ? 'bg-[#D4AF37] text-black font-bold border-[#D4AF37]'
                  : 'bg-[#0C0C0C] text-[#AAAAAA] hover:text-white border-[#2A2A2A] hover:border-[#444444]'
              }`}
            >
              <span>#{tag}</span>
              <span className={`text-[9px] px-1 rounded-full ${selectedTag === tag ? 'bg-black/30 text-black' : 'bg-[#1A1A1A] text-[#777777]'}`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Active Filter Summary Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#222222] text-xs">
          <div className="flex items-center gap-2 flex-wrap text-[#888888]">
            <span>Hiển thị <strong className="text-[#D4AF37]">{filteredTasks.length}</strong> / {tasks.length} công việc</span>
            {hasActiveFilters && (
              <span className="text-[10px] bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-0.5 rounded-sm border border-[#D4AF37]/20">
                Bộ lọc đang kích hoạt
              </span>
            )}
            {sortBy !== 'custom' && (
              <span className="text-[10px] bg-[#D4AF37]/15 text-[#D4AF37] px-2 py-0.5 rounded-sm border border-[#D4AF37]/30 flex items-center gap-1 font-medium">
                <ArrowUpDown className="w-2.5 h-2.5" />
                <span>Xếp theo: {getSortLabel(sortBy)}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {saveNotice && (
              <span className="text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-sm flex items-center gap-1">
                <Check className="w-3 h-3 stroke-[2.5]" />
                {saveNotice}
              </span>
            )}

            {sortBy !== 'custom' && onReorderTasks && (
              <button
                type="button"
                onClick={handleApplySortPermanently}
                className="text-[11px] bg-[#1A1A1A] hover:bg-[#D4AF37] hover:text-black text-[#D4AF37] border border-[#D4AF37]/40 px-2.5 py-1 rounded-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Lưu thứ tự sắp xếp hiện tại thành thứ tự mặc định cho danh sách công việc"
              >
                <Check className="w-3 h-3 stroke-[2.5]" />
                <span>Lưu làm thứ tự gốc</span>
              </button>
            )}

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="text-[11px] text-[#AAAAAA] hover:text-rose-400 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Xóa tất cả bộ lọc</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 1. LIST VIEW MODE */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {/* Quick Status Drop Bar in List View */}
          <div className="space-y-1.5 mb-1">
            <div className="flex flex-wrap items-center justify-between text-[11px] text-[#888888] gap-2">
              <span className="flex items-center gap-1.5 font-medium">
                <ArrowUpDown className="w-3 h-3 text-[#D4AF37]" />
                <span>Kéo thả để sắp xếp thứ tự hoặc chọn sắp xếp nhanh:</span>
              </span>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-[#666666] uppercase font-bold">Xếp nhanh:</span>
                <button
                  type="button"
                  onClick={() => setSortBy(sortBy === 'deadline_asc' ? 'deadline_desc' : 'deadline_asc')}
                  className={`px-2 py-0.5 rounded-sm text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer border ${
                    sortBy === 'deadline_asc' || sortBy === 'deadline_desc'
                      ? 'bg-[#D4AF37] text-black border-[#D4AF37] font-bold'
                      : 'bg-[#0C0C0C] text-[#888888] border-[#2A2A2A] hover:text-[#E0E0E0] hover:border-[#444444]'
                  }`}
                  title="Sắp xếp theo hạn chót (nhấn để đổi chiều gần/xa)"
                >
                  <Calendar className="w-2.5 h-2.5" />
                  <span>Hạn chót {sortBy === 'deadline_asc' ? '↑' : sortBy === 'deadline_desc' ? '↓' : ''}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSortBy(sortBy === 'priority_desc' ? 'priority_asc' : 'priority_desc')}
                  className={`px-2 py-0.5 rounded-sm text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer border ${
                    sortBy === 'priority_desc' || sortBy === 'priority_asc'
                      ? 'bg-[#D4AF37] text-black border-[#D4AF37] font-bold'
                      : 'bg-[#0C0C0C] text-[#888888] border-[#2A2A2A] hover:text-[#E0E0E0] hover:border-[#444444]'
                  }`}
                  title="Sắp xếp theo độ ưu tiên (nhấn để đổi chiều cao/thấp)"
                >
                  <SlidersHorizontal className="w-2.5 h-2.5" />
                  <span>Ưu tiên {sortBy === 'priority_desc' ? '↓' : sortBy === 'priority_asc' ? '↑' : ''}</span>
                </button>

                {sortBy !== 'custom' && (
                  <button
                    type="button"
                    onClick={() => setSortBy('custom')}
                    className="px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-[#1A1A1A] text-[#AAAAAA] hover:text-white border border-[#2A2A2A] transition-all cursor-pointer"
                    title="Khôi phục thứ tự kéo thả ban đầu"
                  >
                    Mặc định
                  </button>
                )}

                {draggedTaskId && (
                  <span className="text-[10px] text-[#D4AF37] font-semibold animate-pulse ml-2">
                    Đang kéo task...
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { status: 'todo' as const, label: 'Todo (Chờ)', icon: Clock, color: 'text-amber-400 border-amber-500/30' },
                { status: 'in_progress' as const, label: 'Đang làm', icon: Sparkles, color: 'text-sky-400 border-sky-500/30' },
                { status: 'completed' as const, label: 'Hoàn thành', icon: CheckCircle2, color: 'text-emerald-400 border-emerald-500/30' },
                { status: 'canceled' as const, label: 'Đã hủy', icon: X, color: 'text-rose-400 border-rose-500/30' },
              ].map(cat => {
                const Icon = cat.icon;
                const isDropActive = dragOverStatus === cat.status;
                return (
                  <div
                    key={cat.status}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverStatus !== cat.status) setDragOverStatus(cat.status);
                    }}
                    onDragLeave={() => {
                      if (dragOverStatus === cat.status) setDragOverStatus(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
                      if (taskId) {
                        onTaskUpdate(taskId, { status: cat.status });
                      }
                      resetDragState();
                    }}
                    className={`p-2 rounded-sm border transition-all text-center flex flex-col items-center justify-center gap-0.5 select-none ${
                      isDropActive
                        ? 'bg-[#D4AF37]/20 border-[#D4AF37] ring-1 ring-[#D4AF37] scale-[1.02]'
                        : draggedTaskId
                        ? 'bg-[#151515] border-dashed border-[#555555] hover:border-[#D4AF37]'
                        : 'bg-[#0E0E0E] border-[#222222]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 ${cat.color.split(' ')[0]}`} />
                      <span className="text-[11px] font-bold text-white uppercase tracking-wider">{cat.label}</span>
                    </div>
                    <span className="text-[9px] text-[#777777]">
                      {isDropActive ? 'Thả để chuyển' : 'Kéo task vào đây'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="p-12 text-center rounded-sm bg-[#151515] border border-[#2A2A2A]">
              <Clock className="w-8 h-8 text-[#666666] mx-auto mb-3" />
              <p className="text-[#E0E0E0] font-editorial-serif text-sm">Không tìm thấy công việc phù hợp.</p>
              <p className="text-xs text-[#777777] mt-1">Hãy tạo công việc mới hoặc điều chỉnh bộ lọc đa chiều phía trên.</p>
            </div>
          ) : (
            filteredTasks.map(task => {
              const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'completed' && task.status !== 'canceled';
              const deadlineInfo = getDeadlineStatusInfo(task.deadline, task.status);

              return (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={resetDragState}
                  onDragOver={(e) => handleCardDragOver(e, task.id)}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    if (dragOverTaskId === task.id) {
                      setDragOverTaskId(null);
                      setDragOverPosition(null);
                    }
                  }}
                  onDrop={(e) => handleCardDropInList(e, task.id)}
                  className={`p-4 rounded-sm border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-grab active:cursor-grabbing relative ${
                    draggedTaskId === task.id
                      ? 'opacity-30 border-dashed border-[#D4AF37]'
                      : isOverdue
                      ? 'bg-rose-950/20 border-rose-900/60'
                      : task.status === 'completed'
                      ? 'bg-[#0C0C0C] border-[#2A2A2A] opacity-60'
                      : 'bg-[#151515] border-[#2A2A2A] hover:border-[#333333]'
                  } ${
                    dragOverTaskId === task.id && dragOverPosition === 'before'
                      ? 'border-t-2 border-t-[#D4AF37]'
                      : dragOverTaskId === task.id && dragOverPosition === 'after'
                      ? 'border-b-2 border-b-[#D4AF37]'
                      : ''
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="pt-1 text-[#555555] hover:text-[#D4AF37] cursor-grab shrink-0" title="Kéo để sắp xếp thứ tự hoặc đổi trạng thái">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <input
                      type="checkbox"
                      checked={task.status === 'completed'}
                      onChange={(e) => onTaskUpdate(task.id, { status: e.target.checked ? 'completed' : 'todo' })}
                      className="mt-1 w-4 h-4 rounded-sm border-[#2A2A2A] bg-[#0C0C0C] text-[#D4AF37] focus:ring-[#D4AF37] cursor-pointer"
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-sm ${
                          task.priority === 'high' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                          task.priority === 'medium' ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30' :
                          'bg-[#2A2A2A] text-[#AAAAAA]'
                        }`}>
                          {task.priority.toUpperCase()}
                        </span>

                        <span className={`text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-sm ${
                          task.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                          task.status === 'in_progress' ? 'bg-sky-500/20 text-sky-300' :
                          task.status === 'canceled' ? 'bg-[#2A2A2A] text-[#888888]' :
                          'bg-[#D4AF37]/20 text-[#D4AF37]'
                        }`}>
                          {task.status}
                        </span>

                        {task.recurring && task.recurring.type !== 'none' && (
                          <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm bg-[#1A1A1A] text-sky-300 border border-sky-500/30 flex items-center gap-1" title={task.recurring.completedCycles ? `Đã hoàn thành ${task.recurring.completedCycles} chu kỳ` : 'Tự động dời lịch khi hoàn thành'}>
                            <Repeat className="w-3 h-3 text-sky-400" />
                            <span>{formatRecurringLabel(task.recurring)}</span>
                            {task.recurring.completedCycles ? (
                              <span className="text-[8px] bg-sky-950 px-1 py-0.2 rounded-xs border border-sky-700/50 text-sky-200">
                                #{task.recurring.completedCycles}
                              </span>
                            ) : null}
                          </span>
                        )}

                        {/* Official Deadline Display */}
                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] text-xs">
                          <Clock className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                          <span className="text-[#888888] font-medium">Hạn chót chính thức:</span>
                          <span className="text-[#E0E0E0] font-semibold">
                            {formatOfficialDeadline(task.deadline)}
                          </span>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm border ${deadlineInfo.badgeClass}`}>
                          {deadlineInfo.label}
                        </span>
                      </div>

                      <h3 className={`text-sm font-editorial-serif font-bold ${task.status === 'completed' ? 'line-through text-[#777777]' : 'text-white'}`}>
                        {task.title}
                      </h3>

                      <p className="text-xs text-[#888888] line-clamp-2 leading-relaxed">{task.description}</p>

                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        {task.tags.map((tag, idx) => (
                          <span key={idx} className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm bg-[#0C0C0C] text-[#AAAAAA] border border-[#2A2A2A]">
                            #{tag}
                          </span>
                        ))}
                        {task.attachedFileIds.length > 0 && (
                          <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/30 flex items-center gap-1">
                            <Paperclip className="w-3 h-3" />
                            <span>{task.attachedFileIds.length} tệp đính kèm</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        if (onAnalyzeTask) {
                          onAnalyzeTask(task);
                        } else {
                          openAiChatWithPrompt(`Hãy phân tích và đánh giá toàn diện công việc: "${task.title}". Mô tả: ${task.description}. Đưa ra đánh giá chuyên sâu và lộ trình từng bước, KHÔNG hỏi ngược lại người dùng.`);
                        }
                      }}
                      className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-sm bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/30 hover:bg-[#D4AF37] hover:text-black transition-colors flex items-center gap-1 cursor-pointer"
                      title="Tự động phân tích và đánh giá công việc bằng AI mà không cần hỏi"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Phân tích AI</span>
                    </button>
                    <button
                      onClick={() => editTask(task)}
                      className="p-1.5 rounded-sm bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#D4AF37] text-[#E0E0E0] transition-colors cursor-pointer"
                      title="Sửa"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onTaskDelete(task.id)}
                      className="p-1.5 rounded-sm bg-[#1A1A1A] border border-[#2A2A2A] hover:bg-rose-950/50 hover:border-rose-500 text-rose-400 transition-colors cursor-pointer"
                      title="Xóa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 2. KANBAN BOARD VIEW MODE (with 0ms Drag & Drop & Visual Reordering) */}
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

            const isColDraggedOver = draggedOverCol === colStatus;

            return (
              <div
                key={colStatus}
                onDragOver={(e) => handleDragOverColumn(e, colStatus)}
                onDragLeave={handleDragLeaveColumn}
                onDrop={(e) => handleColumnDrop(e, colStatus)}
                className={`p-4 rounded-sm bg-[#151515] border transition-all space-y-3 ${
                  isColDraggedOver ? 'border-[#D4AF37] bg-[#1A1810]' : 'border-[#2A2A2A]'
                }`}
              >
                <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2">
                  <h3 className="text-xs font-editorial-serif font-bold text-white uppercase tracking-wider">
                    {colTitleMap[colStatus]}
                  </h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm bg-[#1A1A1A] text-[#D4AF37] border border-[#2A2A2A]">
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-2.5 min-h-[300px]">
                  {colTasks.map(task => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={resetDragState}
                      onDragOver={(e) => handleCardDragOver(e, task.id)}
                      onDragLeave={(e) => {
                        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                        if (dragOverTaskId === task.id) {
                          setDragOverTaskId(null);
                          setDragOverPosition(null);
                        }
                      }}
                      onDrop={(e) => handleCardDropInKanban(e, task.id, colStatus)}
                      className={`p-3 rounded-sm bg-[#0C0C0C] border space-y-2 hover:border-[#D4AF37]/50 transition-all cursor-grab active:cursor-grabbing relative ${
                        draggedTaskId === task.id
                          ? 'opacity-30 border-dashed border-[#D4AF37]'
                          : 'border-[#2A2A2A]'
                      } ${
                        dragOverTaskId === task.id && dragOverPosition === 'before'
                          ? 'border-t-2 border-t-[#D4AF37]'
                          : dragOverTaskId === task.id && dragOverPosition === 'after'
                          ? 'border-b-2 border-b-[#D4AF37]'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <GripVertical className="w-3.5 h-3.5 text-[#555555] hover:text-[#D4AF37] shrink-0" />
                          <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm ${
                            task.priority === 'high' ? 'bg-rose-500/20 text-rose-300' : 'bg-[#1A1A1A] text-[#888888]'
                          }`}>
                            {task.priority.toUpperCase()}
                          </span>
                          {task.recurring && task.recurring.type !== 'none' && (
                            <span className="text-[8px] px-1 py-0.5 rounded-xs bg-[#1A1A1A] text-sky-300 border border-sky-500/30 flex items-center gap-0.5" title={formatRecurringLabel(task.recurring)}>
                              <Repeat className="w-2.5 h-2.5 text-sky-400" />
                              <span>{formatRecurringLabel(task.recurring)}</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#D4AF37] font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatOfficialDeadline(task.deadline).split(',')[0]}</span>
                        </span>
                      </div>
                      <h4 className="text-xs font-editorial-serif font-bold text-white leading-snug">{task.title}</h4>
                      <p className="text-[11px] text-[#888888] line-clamp-2">{task.description}</p>
                      
                      <div className="text-[10px] text-zinc-400 bg-[#151515] p-1.5 rounded-sm border border-zinc-800/80 space-y-0.5">
                        <span className="text-zinc-500 font-medium block">Hạn chót chính thức:</span>
                        <span className="text-zinc-200 font-semibold block">{formatOfficialDeadline(task.deadline)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-[#2A2A2A]">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => editTask(task)}
                            className="text-[10px] font-bold uppercase text-[#D4AF37] hover:underline cursor-pointer"
                          >
                            Chi tiết
                          </button>
                          <button
                            onClick={() => {
                              if (onAnalyzeTask) {
                                onAnalyzeTask(task);
                              } else {
                                openAiChatWithPrompt(`Hãy phân tích và đánh giá toàn diện công việc: "${task.title}". Mô tả: ${task.description}. Không hỏi ngược lại.`);
                              }
                            }}
                            className="text-[10px] font-bold uppercase text-amber-400 hover:text-amber-300 flex items-center gap-0.5 cursor-pointer"
                            title="Tự động phân tích AI"
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>Phân tích</span>
                          </button>
                        </div>
                        <select
                          value={task.status}
                          onChange={(e) => onTaskUpdate(task.id, { status: e.target.value as any })}
                          className="text-[10px] bg-[#1A1A1A] border border-[#2A2A2A] text-[#E0E0E0] rounded-sm px-1 py-0.5 cursor-pointer"
                        >
                          <option value="todo">Todo</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Done</option>
                          <option value="canceled">Canceled</option>
                        </select>
                      </div>
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <div className="h-28 border border-dashed border-[#2A2A2A] rounded-sm flex items-center justify-center text-[#555555] text-xs">
                      Kéo thả task vào đây
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. CALENDAR MONTH VIEW MODE */}
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
