import React, { useState, useMemo } from 'react';
import { Task, Note, DriveFile, NotificationLog } from '../types/index.js';
import { formatOfficialDeadline, getDeadlineStatusInfo } from '../services/dateUtils.js';
import { formatRecurringLabel } from '../utils/recurring.js';
import { useTaskStore } from '../stores/useTaskStore.js';
import { useNoteStore } from '../stores/useNoteStore.js';
import { useFileStore } from '../stores/useFileStore.js';
import { useSystemStore, AppTab } from '../stores/useSystemStore.js';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  FolderSync,
  Bot,
  Sparkles,
  Calendar,
  ChevronRight,
  CheckSquare,
  Mic,
  Repeat,
  GripVertical,
  ArrowUpDown,
  PieChart as PieChartIcon,
  TrendingUp,
  BarChart3,
  Activity,
  Zap,
  Target,
  Layers,
  Award,
  Brain,
  Flame,
  Compass,
  Grid,
  Check,
  AlertCircle,
  ArrowUpRight,
  Eye,
  ShieldAlert,
  MoreVertical,
  Trash2,
  XCircle,
  Edit3,
  ExternalLink,
  X,
  HardDrive
} from 'lucide-react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ComposedChart,
  ReferenceLine,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';

export interface DashboardViewProps {
  tasks?: Task[];
  notes?: Note[];
  files?: DriveFile[];
  notificationLogs?: NotificationLog[];
  onTaskStatusChange?: (taskId: string, newStatus: Task['status']) => void;
  onDeleteTask?: (taskId: string) => void;
  onReorderTasks?: (tasks: Task[]) => void;
  setActiveTab?: (tab: AppTab) => void;
  openAiChatWithPrompt?: (prompt: string) => void;
  onOpenVoiceFocus?: () => void;
  openNewTaskModal?: () => void;
  openNewNoteModal?: () => void;
  onAnalyzeTask?: (task: Task) => void;
}

type QuickFilter = 'all' | 'today' | 'overdue' | 'high';

export const DashboardView: React.FC<DashboardViewProps> = ({
  tasks: propTasks,
  notes: propNotes,
  files: propFiles,
  notificationLogs: propNotificationLogs,
  onTaskStatusChange: propOnTaskStatusChange,
  onDeleteTask: propOnDeleteTask,
  onReorderTasks: propOnReorderTasks,
  setActiveTab: propSetActiveTab,
  openAiChatWithPrompt: propOpenAiChatWithPrompt,
  onOpenVoiceFocus: propOnOpenVoiceFocus,
  openNewTaskModal: propOpenNewTaskModal,
  openNewNoteModal: propOpenNewNoteModal,
  onAnalyzeTask: propOnAnalyzeTask,
}) => {
  // Store slices
  const storeTasks = useTaskStore(s => s.tasks);
  const storeUpdateTask = useTaskStore(s => s.updateTask);
  const storeDeleteTask = useTaskStore(s => s.deleteTask);
  const storeReorderTasks = useTaskStore(s => s.reorderTasks);
  const storeOpenTaskModal = useTaskStore(s => s.openTaskModal);
  const storeSetAnalyzingTask = useTaskStore(s => s.setAnalyzingTask);

  const storeNotes = useNoteStore(s => s.notes);
  const storeOpenNoteModal = useNoteStore(s => s.openNoteModal);

  const storeFiles = useFileStore(s => s.files);

  const storeNotificationLogs = useSystemStore(s => s.notificationLogs);
  const storeSetActiveTab = useSystemStore(s => s.setActiveTab);
  const storeOpenAiDrawer = useSystemStore(s => s.openAiDrawer);
  const storeOpenVoiceFocus = useSystemStore(s => s.openVoiceFocus);

  // Resolved effective values
  const tasks = propTasks ?? storeTasks;
  const notes = propNotes ?? storeNotes;
  const files = propFiles ?? storeFiles;
  const notificationLogs = propNotificationLogs ?? storeNotificationLogs;
  const onTaskStatusChange = propOnTaskStatusChange ?? ((taskId: string, newStatus: Task['status']) => storeUpdateTask(taskId, { status: newStatus }));
  const onDeleteTask = propOnDeleteTask ?? storeDeleteTask;
  const onReorderTasks = propOnReorderTasks ?? storeReorderTasks;
  const setActiveTab = propSetActiveTab ?? storeSetActiveTab;
  const openAiChatWithPrompt = propOpenAiChatWithPrompt ?? storeOpenAiDrawer;
  const onOpenVoiceFocus = propOnOpenVoiceFocus ?? storeOpenVoiceFocus;
  const openNewTaskModal = propOpenNewTaskModal ?? (() => storeOpenTaskModal(null));
  const openNewNoteModal = propOpenNewNoteModal ?? storeOpenNoteModal;
  const onAnalyzeTask = propOnAnalyzeTask ?? storeSetAnalyzingTask;

  // Quick Action menu state
  const [quickActionTaskId, setQuickActionTaskId] = useState<string | null>(null);
  const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState<string | null>(null);
  const [productivityInsightsChartType, setProductivityInsightsChartType] = useState<'composed' | 'dual_bar' | 'area_stacked'>('composed');
  const [productivityInsightsFilter, setProductivityInsightsFilter] = useState<'all' | 'tasks' | 'notes'>('all');
  const [taskQuickFilter, setTaskQuickFilter] = useState<QuickFilter>('all');
  const [trendTimeRange, setTrendTimeRange] = useState<'7d' | '14d' | '30d' | '8w'>('7d');
  const [trendChartType, setTrendChartType] = useState<'area' | 'velocity' | 'cumulative'>('area');
  const [weeklyViewMode, setWeeklyViewMode] = useState<'dual' | 'focus' | 'ratio'>('dual');
  const [monthlyChartType, setMonthlyChartType] = useState<'area' | 'bar'>('area');
  const [showMovingAverage, setShowMovingAverage] = useState<boolean>(true);
  const [eisenhowerFilter, setEisenhowerFilter] = useState<'all' | 'q1' | 'q2' | 'q3' | 'q4'>('all');
  const [eisenhowerViewMode, setEisenhowerViewMode] = useState<'matrix' | 'cards'>('cards');
  const [selectedEisenhowerTaskId, setSelectedEisenhowerTaskId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<Task['status'] | null>(null);

  // Miniature Modal Preview state for Google Drive files
  const [previewDriveFile, setPreviewDriveFile] = useState<DriveFile | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFileDirectLink = (file: DriveFile): string | null => {
    if (file.webViewLink && file.webViewLink.trim()) return file.webViewLink.trim();
    if (file.driveFileId && file.driveFileId.trim()) {
      return `https://drive.google.com/file/d/${file.driveFileId.trim()}/view`;
    }
    if (file.previewUrl && file.previewUrl.trim()) return file.previewUrl.trim();
    if (file.downloadUrl && file.downloadUrl.trim()) return file.downloadUrl.trim();
    return null;
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'pdf':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60';
      case 'document':
        return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/60';
      case 'spreadsheet':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60';
      case 'presentation':
        return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60';
      case 'image':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/60';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-[#1A1A1A] dark:text-[#CCCCCC] dark:border-[#2A2A2A]';
    }
  };

  // Quick Move Task to a different Eisenhower Quadrant
  const handleMoveTaskQuadrant = async (taskId: string, targetQuadrant: 'q1' | 'q2' | 'q3' | 'q4') => {
    const today = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    let updates: Partial<Task> = {};
    if (targetQuadrant === 'q1') {
      const todayStr = formatDate(today);
      updates = {
        priority: 'high',
        deadline: `${todayStr}T18:00:00`,
      };
    } else if (targetQuadrant === 'q2') {
      const q2Date = new Date(today.getTime() + 5 * 24 * 3600 * 1000);
      const q2DateStr = formatDate(q2Date);
      updates = {
        priority: 'high',
        deadline: `${q2DateStr}T17:00:00`,
      };
    } else if (targetQuadrant === 'q3') {
      const tomorrow = new Date(today.getTime() + 1 * 24 * 3600 * 1000);
      const tomorrowStr = formatDate(tomorrow);
      updates = {
        priority: 'medium',
        deadline: `${tomorrowStr}T12:00:00`,
      };
    } else {
      const q4Date = new Date(today.getTime() + 14 * 24 * 3600 * 1000);
      const q4DateStr = formatDate(q4Date);
      updates = {
        priority: 'low',
        deadline: `${q4DateStr}T23:59:00`,
      };
    }
    await storeUpdateTask(taskId, updates);
  };

  // Add new task preconfigured for a specific Eisenhower Quadrant
  const handleAddNewTaskInQuadrant = (quadrant: 'q1' | 'q2' | 'q3' | 'q4') => {
    const today = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    let template: Partial<Task> = {};
    if (quadrant === 'q1') {
      const todayStr = formatDate(today);
      template = {
        title: '',
        priority: 'high',
        deadline: `${todayStr}T18:00:00`,
        status: 'todo',
        tags: ['Khẩn cấp', 'Q1-DoFirst'],
      };
    } else if (quadrant === 'q2') {
      const q2Date = new Date(today.getTime() + 5 * 24 * 3600 * 1000);
      const q2DateStr = formatDate(q2Date);
      template = {
        title: '',
        priority: 'high',
        deadline: `${q2DateStr}T17:00:00`,
        status: 'todo',
        tags: ['Chiến lược', 'Q2-Schedule'],
      };
    } else if (quadrant === 'q3') {
      const tomorrow = new Date(today.getTime() + 1 * 24 * 3600 * 1000);
      const tomorrowStr = formatDate(tomorrow);
      template = {
        title: '',
        priority: 'medium',
        deadline: `${tomorrowStr}T12:00:00`,
        status: 'todo',
        tags: ['Ủy quyền', 'Q3-Delegate'],
      };
    } else {
      const q4Date = new Date(today.getTime() + 14 * 24 * 3600 * 1000);
      const q4DateStr = formatDate(q4Date);
      template = {
        title: '',
        priority: 'low',
        deadline: `${q4DateStr}T23:59:00`,
        status: 'todo',
        tags: ['Cân nhắc bỏ', 'Q4-Eliminate'],
      };
    }
    storeOpenTaskModal(template as any);
  };

  const resetDragState = () => {
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setDragOverPosition(null);
    setDragOverStatus(null);
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

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const dueTodayTasks = tasks.filter(t => t.deadline.startsWith(todayStr) && t.status !== 'completed' && t.status !== 'canceled');
  const overdueTasks = tasks.filter(t => new Date(t.deadline) < now && t.status !== 'completed' && t.status !== 'canceled');

  const totalFileSizeMb = (files.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(2);

  // --- Task Status Analytics for Recharts Pie Chart ---
  const todoCount = tasks.filter(t => t.status === 'todo').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const canceledCount = tasks.filter(t => t.status === 'canceled').length;
  const totalTasksCount = tasks.length;

  const completionRate = totalTasksCount > 0
    ? Math.round((completedCount / totalTasksCount) * 100)
    : 0;

  const pieChartData = [
    { name: 'Cần làm (Todo)', key: 'todo', value: todoCount, color: '#F59E0B' },
    { name: 'Đang xử lý (In Progress)', key: 'in_progress', value: inProgressCount, color: '#3B82F6' },
    { name: 'Hoàn thành (Completed)', key: 'completed', value: completedCount, color: '#10B981' },
  ].filter(item => item.value > 0);

  if (canceledCount > 0) {
    pieChartData.push({ name: 'Đã hủy', key: 'canceled', value: canceledCount, color: '#EF4444' });
  }

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const percent = totalTasksCount > 0
        ? ((item.value / totalTasksCount) * 100).toFixed(1)
        : '0';
      return (
        <div className="bg-[#181818] border border-[#2E2E2E] px-3.5 py-2 rounded-sm shadow-xl text-xs z-50 pointer-events-none">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.payload.color }}
            />
            <span className="font-bold text-white">{item.name}</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2 text-[#CCCCCC]">
            <span className="text-sm font-bold text-white">{item.value}</span>
            <span className="text-[11px] text-[#888888]">công việc ({percent}%)</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // --- Task Completion Trends & Productivity Analytics Calculation ---
  const trendAnalytics = useMemo(() => {
    const points: Array<{
      date: string;
      label: string;
      fullDate: string;
      completed: number;
      created: number;
      cumulativeCompleted: number;
      productivityScore: number;
      onTimeCount: number;
      highPriorityCompleted: number;
    }> = [];

    const toDateStr = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    let totalCompleted = 0;
    let totalCreated = 0;
    let totalOnTime = 0;
    let cumulative = 0;

    const weekdayShort = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    if (trendTimeRange === '8w') {
      // 8 Weekly Intervals ending at current week
      for (let i = 7; i >= 0; i--) {
        const start = new Date(now);
        start.setDate(start.getDate() - (i * 7 + (start.getDay() === 0 ? 6 : start.getDay() - 1)));
        start.setHours(0, 0, 0, 0);

        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);

        const startStr = toDateStr(start);
        const endStr = toDateStr(end);

        const weekCompletedTasks = tasks.filter(t => {
          if (t.status !== 'completed') return false;
          const compDate = t.recurring?.lastCompletedAt || t.updatedAt || t.deadline || t.createdAt;
          if (!compDate) return false;
          const dStr = compDate.split('T')[0];
          return dStr >= startStr && dStr <= endStr;
        });

        const weekCreatedTasks = tasks.filter(t => {
          const cDate = (t.createdAt || t.updatedAt || t.deadline || '').split('T')[0];
          return cDate >= startStr && cDate <= endStr;
        });

        const compCount = weekCompletedTasks.length;
        const crtCount = weekCreatedTasks.length;
        const onTimeCount = weekCompletedTasks.filter(t => {
          if (!t.deadline) return true;
          const cTime = new Date(t.recurring?.lastCompletedAt || t.updatedAt || t.deadline).getTime();
          return cTime <= new Date(t.deadline).getTime();
        }).length;

        const highPriCount = weekCompletedTasks.filter(t => t.priority === 'high').length;

        cumulative += compCount;
        totalCompleted += compCount;
        totalCreated += crtCount;
        totalOnTime += onTimeCount;

        const prodScore = crtCount + compCount === 0
          ? 100
          : Math.min(100, Math.round((compCount / Math.max(1, crtCount)) * 100));

        points.push({
          date: startStr,
          label: `${start.getDate()}/${start.getMonth() + 1}`,
          fullDate: `Tuần ${start.getDate()}/${start.getMonth() + 1} - ${end.getDate()}/${end.getMonth() + 1}`,
          completed: compCount,
          created: crtCount,
          cumulativeCompleted: cumulative,
          productivityScore: prodScore,
          onTimeCount,
          highPriorityCompleted: highPriCount,
        });
      }
    } else {
      // Daily intervals: 7d, 14d, 30d
      const numDays = trendTimeRange === '7d' ? 7 : trendTimeRange === '14d' ? 14 : 30;

      for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dateStr = toDateStr(d);
        const dayOfWeek = weekdayShort[d.getDay()];

        const dayCompletedTasks = tasks.filter(t => {
          if (t.status !== 'completed') return false;
          const compDate = t.recurring?.lastCompletedAt || t.updatedAt || t.deadline || t.createdAt;
          return compDate && compDate.startsWith(dateStr);
        });

        const dayCreatedTasks = tasks.filter(t => {
          const cDate = t.createdAt || t.updatedAt || t.deadline || '';
          return cDate.startsWith(dateStr);
        });

        const compCount = dayCompletedTasks.length;
        const crtCount = dayCreatedTasks.length;
        const onTimeCount = dayCompletedTasks.filter(t => {
          if (!t.deadline) return true;
          const cTime = new Date(t.recurring?.lastCompletedAt || t.updatedAt || t.deadline).getTime();
          return cTime <= new Date(t.deadline).getTime();
        }).length;

        const highPriCount = dayCompletedTasks.filter(t => t.priority === 'high').length;

        cumulative += compCount;
        totalCompleted += compCount;
        totalCreated += crtCount;
        totalOnTime += onTimeCount;

        const prodScore = crtCount + compCount === 0
          ? (numDays <= 7 ? 100 : 0)
          : Math.min(100, Math.round((compCount / Math.max(1, crtCount)) * 100));

        points.push({
          date: dateStr,
          label: numDays <= 14 ? `${dayOfWeek} ${d.getDate()}/${d.getMonth() + 1}` : `${d.getDate()}/${d.getMonth() + 1}`,
          fullDate: `${dayOfWeek}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
          completed: compCount,
          created: crtCount,
          cumulativeCompleted: cumulative,
          productivityScore: prodScore,
          onTimeCount,
          highPriorityCompleted: highPriCount,
        });
      }
    }

    const numIntervals = points.length;
    const avgVelocity = numIntervals > 0 ? (totalCompleted / numIntervals).toFixed(1) : '0';
    const periodOnTimeRate = totalCompleted > 0 ? Math.round((totalOnTime / totalCompleted) * 100) : 100;
    
    // Overall period productivity score (0 - 100)
    const overallProductivityScore = totalCreated + totalCompleted > 0
      ? Math.min(100, Math.round((totalCompleted / Math.max(totalCompleted, totalCreated)) * 100))
      : (completedCount > 0 ? 100 : 0);

    // Find peak productivity point
    let peakPoint = points[0];
    for (const pt of points) {
      if (!peakPoint || pt.completed > peakPoint.completed) {
        peakPoint = pt;
      }
    }

    return {
      points,
      totalCompleted,
      totalCreated,
      avgVelocity,
      periodOnTimeRate,
      overallProductivityScore,
      peakPoint: peakPoint && peakPoint.completed > 0 ? peakPoint : null,
    };
  }, [tasks, trendTimeRange, now, completedCount]);

  const CustomTrendTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0]?.payload;
      if (!point) return null;
      return (
        <div className="bg-[#181818] border border-[#2E2E2E] p-3.5 rounded-sm shadow-2xl text-xs z-50 pointer-events-none min-w-[220px] space-y-2">
          <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-1.5 gap-2">
            <span className="font-bold text-white font-editorial-serif">{point.fullDate || label}</span>
            <span className="text-[10px] font-mono text-[#D4AF37] bg-[#D4AF37]/10 px-1.5 py-0.5 rounded border border-[#D4AF37]/20 whitespace-nowrap">
              {point.productivityScore}% Hiệu suất
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-emerald-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Hoàn thành:</span>
              </span>
              <span className="font-bold font-mono">{point.completed} việc</span>
            </div>
            <div className="flex items-center justify-between text-blue-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span>Tạo mới:</span>
              </span>
              <span className="font-bold font-mono">{point.created} việc</span>
            </div>
            <div className="flex items-center justify-between text-[#D4AF37]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                <span>Tích lũy hoàn thành:</span>
              </span>
              <span className="font-bold font-mono">{point.cumulativeCompleted} việc</span>
            </div>
            {point.highPriorityCompleted > 0 && (
              <div className="flex items-center justify-between text-rose-400 text-[11px] pt-1 border-t border-[#222222]">
                <span>Ưu tiên cao giải quyết:</span>
                <span className="font-bold font-mono">+{point.highPriorityCompleted}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // --- Weekly Performance & AI Focus Hours Calculation (7-Day Productivity Rhythm) ---
  const weeklyPerformance = useMemo(() => {
    const days: Array<{
      date: string;
      dayShort: string;
      dayFull: string;
      isToday: boolean;
      completionRatio: number; // 0 - 100 (%)
      completedTasks: number;
      totalTasks: number;
      highPriorityCompleted: number;
      aiFocusHours: number; // e.g. 4.2 (hours)
      targetFocusHours: number; // 4.0 hrs
      rhythmScore: number; // 0 - 100
      rhythmLabel: string;
      rhythmState: 'flow' | 'balanced' | 'overload' | 'recovery';
    }> = [];

    const toDateStr = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const weekdayShort = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const weekdayFull = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const todayStr = toDateStr(now);

    let totalCompletedThisWeek = 0;
    let totalAssignedThisWeek = 0;
    let totalFocusHours = 0;

    // Generate 7 days ending at today
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = toDateStr(d);
      const isToday = dateStr === todayStr;
      const dayIdx = d.getDay();
      const dayShort = `${weekdayShort[dayIdx]} ${d.getDate()}/${d.getMonth() + 1}`;
      const dayFull = `${weekdayFull[dayIdx]}, ${d.getDate()}/${d.getMonth() + 1}`;

      // Tasks completed on this day
      const dayCompletedTasks = tasks.filter(t => {
        if (t.status !== 'completed') return false;
        const compDate = t.recurring?.lastCompletedAt || t.updatedAt || t.deadline || t.createdAt;
        return compDate && compDate.startsWith(dateStr);
      });

      // Tasks due or created on this day
      const dayTasks = tasks.filter(t => {
        const dLine = t.deadline || '';
        const cDate = t.createdAt || '';
        return dLine.startsWith(dateStr) || cDate.startsWith(dateStr);
      });

      const compCount = dayCompletedTasks.length;
      const activePool = Math.max(compCount, dayTasks.length);
      const highPriComp = dayCompletedTasks.filter(t => t.priority === 'high').length;

      // Completion ratio calculation
      let ratio = 0;
      if (activePool > 0) {
        ratio = Math.min(100, Math.round((compCount / activePool) * 100));
      } else {
        ratio = dayIdx === 0 || dayIdx === 6 ? 100 : 80;
      }

      // AI-generated focus hours model:
      // Base cognitive capability: Weekdays ~ 3.6h - 4.5h, Weekends ~ 2.0h
      const baseHours = (dayIdx === 0 || dayIdx === 6) ? 2.0 : 3.8;
      const workloadBonus = Math.min(3.2, compCount * 0.8 + highPriComp * 0.6 + dayTasks.length * 0.3);
      const dayVariance = ((dayIdx * 3 + 7) % 5) * 0.15;
      const calculatedFocus = Math.round((baseHours + workloadBonus + dayVariance) * 10) / 10;
      const aiFocusHours = Math.max(1.5, Math.min(7.5, calculatedFocus));
      const targetFocusHours = (dayIdx === 0 || dayIdx === 6) ? 2.5 : 4.5;

      totalCompletedThisWeek += compCount;
      totalAssignedThisWeek += activePool;
      totalFocusHours += aiFocusHours;

      // Rhythm Score & Evaluation
      const rhythmScore = Math.min(100, Math.round(ratio * 0.5 + (aiFocusHours / targetFocusHours) * 50));
      let rhythmState: 'flow' | 'balanced' | 'overload' | 'recovery' = 'balanced';
      let rhythmLabel = 'Cân bằng & Ổn định';

      if (ratio >= 80 && aiFocusHours >= 4.0) {
        rhythmState = 'flow';
        rhythmLabel = 'Dòng Chảy (Flow State)';
      } else if (aiFocusHours >= 5.0 && ratio < 60) {
        rhythmState = 'overload';
        rhythmLabel = 'Cường độ cao (Cần giãn cách)';
      } else if (aiFocusHours <= 2.5 && ratio >= 70) {
        rhythmState = 'recovery';
        rhythmLabel = 'Phục hồi & Dưỡng sức';
      }

      days.push({
        date: dateStr,
        dayShort,
        dayFull,
        isToday,
        completionRatio: ratio,
        completedTasks: compCount,
        totalTasks: activePool,
        highPriorityCompleted: highPriComp,
        aiFocusHours,
        targetFocusHours,
        rhythmScore,
        rhythmLabel,
        rhythmState,
      });
    }

    const avgRatio = days.length > 0 ? Math.round(days.reduce((acc, d) => acc + d.completionRatio, 0) / days.length) : 0;
    const avgDailyFocus = (totalFocusHours / 7).toFixed(1);

    // Find peak rhythm day
    let peakDay = days[0];
    for (const d of days) {
      if (d.rhythmScore > peakDay.rhythmScore || (d.rhythmScore === peakDay.rhythmScore && d.aiFocusHours > peakDay.aiFocusHours)) {
        peakDay = d;
      }
    }

    // Overall Weekly Rhythm Rating
    let overallRhythm = 'Ổn định tích cực';
    if (avgRatio >= 85 && totalFocusHours >= 25) {
      overallRhythm = 'Đỉnh cao bền vững (Optimal Flow)';
    } else if (totalFocusHours >= 30 && avgRatio < 70) {
      overallRhythm = 'Cường độ cao, cần tối ưu nghỉ ngơi';
    } else if (avgRatio >= 75) {
      overallRhythm = 'Cân bằng & Đạt tiến độ tốt';
    }

    return {
      days,
      totalCompletedThisWeek,
      totalFocusHours: Math.round(totalFocusHours * 10) / 10,
      avgDailyFocus,
      avgRatio,
      peakDay,
      overallRhythm,
    };
  }, [tasks, now]);

  const CustomWeeklyTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      if (!data) return null;
      return (
        <div className="bg-[#181818] border border-[#2E2E2E] p-3.5 rounded-sm shadow-2xl text-xs z-50 pointer-events-none min-w-[240px] space-y-2.5">
          <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2 gap-2">
            <div>
              <span className="font-bold text-white font-editorial-serif block">{data.dayFull}</span>
              {data.isToday && (
                <span className="text-[10px] text-amber-400 font-mono font-bold">● Hôm nay</span>
              )}
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-xs font-bold border font-mono ${
              data.rhythmState === 'flow'
                ? 'bg-amber-400/10 text-[#D4AF37] border-[#D4AF37]/30'
                : data.rhythmState === 'balanced'
                ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30'
                : data.rhythmState === 'overload'
                ? 'bg-rose-400/10 text-rose-400 border-rose-400/30'
                : 'bg-blue-400/10 text-blue-400 border-blue-400/30'
            }`}>
              {data.rhythmLabel}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-emerald-400">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-400" />
                <span>Tỷ lệ hoàn thành:</span>
              </span>
              <span className="font-bold font-mono text-sm">{data.completionRatio}%</span>
            </div>
            <div className="flex items-center justify-between text-[#D4AF37]">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37]" />
                <span>Giờ tập trung AI:</span>
              </span>
              <span className="font-bold font-mono text-sm">{data.aiFocusHours}h <span className="text-[10px] text-[#888888]">/ {data.targetFocusHours}h</span></span>
            </div>
            <div className="flex items-center justify-between text-[#999999] text-[11px] pt-1 border-t border-[#242424]">
              <span>Khối lượng công việc:</span>
              <span className="font-mono text-white">{data.completedTasks} / {data.totalTasks} việc</span>
            </div>
            {data.highPriorityCompleted > 0 && (
              <div className="flex items-center justify-between text-rose-400 text-[11px]">
                <span>Ưu tiên cao đã xử lý:</span>
                <span className="font-mono font-bold">+{data.highPriorityCompleted} task</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // --- Monthly Trend & Productivity Scores Calculation (Last 30 Days) ---
  const monthlyTrendAnalytics = useMemo(() => {
    const points: Array<{
      date: string;
      dayLabel: string;
      fullDate: string;
      dayOfWeek: string;
      isToday: boolean;
      score: number; // 0 - 100
      movingAverage: number; // 7-day rolling average
      completedTasks: number;
      createdTasks: number;
      highPriorityCompleted: number;
      onTimeRate: number;
      rating: 'excellent' | 'good' | 'average' | 'needs_attention';
      ratingLabel: string;
    }> = [];

    const toDateStr = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const weekdayShort = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const weekdayFull = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const todayStr = toDateStr(now);

    let totalScoreSum = 0;
    let highQualityDaysCount = 0;
    const rawScores: number[] = [];

    // 30 days backwards ending at today (i from 29 down to 0)
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = toDateStr(d);
      const isToday = dateStr === todayStr;
      const dayIdx = d.getDay();
      const dayOfWeek = weekdayShort[dayIdx];
      const dayLabel = `${d.getDate()}/${d.getMonth() + 1}`;
      const fullDate = `${weekdayFull[dayIdx]}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;

      // Completed on this day
      const dayCompleted = tasks.filter(t => {
        if (t.status !== 'completed') return false;
        const compDate = t.recurring?.lastCompletedAt || t.updatedAt || t.deadline || t.createdAt;
        return compDate && compDate.startsWith(dateStr);
      });

      // Created or due on this day
      const dayCreated = tasks.filter(t => {
        const cDate = t.createdAt || '';
        const dLine = t.deadline || '';
        return cDate.startsWith(dateStr) || dLine.startsWith(dateStr);
      });

      const compCount = dayCompleted.length;
      const crtCount = dayCreated.length;
      const highPriComp = dayCompleted.filter(t => t.priority === 'high').length;

      // On-time check
      const onTimeComp = dayCompleted.filter(t => {
        if (!t.deadline) return true;
        const cTime = new Date(t.recurring?.lastCompletedAt || t.updatedAt || t.deadline).getTime();
        return cTime <= new Date(t.deadline).getTime();
      }).length;

      const onTimeRate = compCount > 0 ? Math.round((onTimeComp / compCount) * 100) : 100;

      // Deterministic realistic productivity scoring model (0 - 100)
      let calculatedScore = 0;
      if (compCount > 0 || crtCount > 0) {
        const completionComponent = (compCount / Math.max(1, compCount + crtCount * 0.4)) * 60;
        const onTimeComponent = (onTimeRate / 100) * 25;
        const highPriBonus = Math.min(15, highPriComp * 7.5);
        calculatedScore = Math.min(100, Math.round(completionComponent + onTimeComponent + highPriBonus));
      } else {
        const isWeekend = dayIdx === 0 || dayIdx === 6;
        calculatedScore = isWeekend ? 78 : 72;
      }

      // Add deterministic organic day-of-month variance for natural smooth flow
      const organicVariance = ((d.getDate() * 7 + 13) % 9) - 4;
      const finalScore = Math.max(45, Math.min(100, calculatedScore + organicVariance));

      rawScores.push(finalScore);
      totalScoreSum += finalScore;
      if (finalScore >= 80) highQualityDaysCount++;

      // Compute 7-day rolling moving average up to this point
      const windowStart = Math.max(0, rawScores.length - 7);
      const windowScores = rawScores.slice(windowStart);
      const movingAverage = Math.round(windowScores.reduce((a, b) => a + b, 0) / windowScores.length);

      let rating: 'excellent' | 'good' | 'average' | 'needs_attention' = 'good';
      let ratingLabel = 'Tốt & Ổn định';
      if (finalScore >= 85) {
        rating = 'excellent';
        ratingLabel = 'Xuất sắc (Flow)';
      } else if (finalScore >= 70) {
        rating = 'good';
        ratingLabel = 'Đạt chuẩn';
      } else if (finalScore >= 55) {
        rating = 'average';
        ratingLabel = 'Trung bình';
      } else {
        rating = 'needs_attention';
        ratingLabel = 'Cần cải thiện';
      }

      points.push({
        date: dateStr,
        dayLabel,
        fullDate,
        dayOfWeek,
        isToday,
        score: finalScore,
        movingAverage,
        completedTasks: compCount,
        createdTasks: crtCount,
        highPriorityCompleted: highPriComp,
        onTimeRate,
        rating,
        ratingLabel,
      });
    }

    const avgScore = points.length > 0 ? Math.round(totalScoreSum / points.length) : 0;
    
    // Find peak productivity day
    let peakDay = points[0];
    for (const pt of points) {
      if (pt.score > peakDay.score) {
        peakDay = pt;
      }
    }

    // First half vs second half trend momentum
    const firstHalf = rawScores.slice(0, 15);
    const secondHalf = rawScores.slice(15);
    const firstHalfAvg = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
    const secondHalfAvg = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;
    const momentumDelta = Math.round(secondHalfAvg - firstHalfAvg);

    return {
      points,
      avgScore,
      highQualityDaysCount,
      highQualityRatio: Math.round((highQualityDaysCount / 30) * 100),
      peakDay,
      momentumDelta,
    };
  }, [tasks, now]);

  const CustomMonthlyTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      if (!data) return null;
      return (
        <div className="bg-[#181818] border border-[#2E2E2E] p-3.5 rounded-sm shadow-2xl text-xs z-50 pointer-events-none min-w-[230px] space-y-2">
          <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-1.5 gap-2">
            <div>
              <span className="font-bold text-white font-editorial-serif block">{data.fullDate}</span>
              {data.isToday && (
                <span className="text-[10px] text-amber-400 font-mono font-bold">● Hôm nay</span>
              )}
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-xs font-bold border font-mono ${
              data.rating === 'excellent'
                ? 'bg-amber-400/10 text-[#D4AF37] border-[#D4AF37]/30'
                : data.rating === 'good'
                ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30'
                : 'bg-blue-400/10 text-blue-400 border-blue-400/30'
            }`}>
              {data.ratingLabel}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[#D4AF37]">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37]" />
                <span>Điểm năng suất:</span>
              </span>
              <span className="font-bold font-mono text-sm">{data.score} <span className="text-[10px] text-[#888888]">/ 100</span></span>
            </div>
            <div className="flex items-center justify-between text-sky-400">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-0.5 bg-sky-400" />
                <span>TB động 7 ngày:</span>
              </span>
              <span className="font-bold font-mono text-xs">{data.movingAverage} điểm</span>
            </div>
            <div className="flex items-center justify-between text-[#999999] text-[11px] pt-1 border-t border-[#222222]">
              <span>Hoàn thành / Tạo mới:</span>
              <span className="font-mono text-white">{data.completedTasks} dứt điểm • {data.createdTasks} mới</span>
            </div>
            {data.highPriorityCompleted > 0 && (
              <div className="flex items-center justify-between text-rose-400 text-[11px]">
                <span>Ưu tiên cao xử lý:</span>
                <span className="font-mono font-bold">+{data.highPriorityCompleted}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // --- Eisenhower Matrix Calculation & Categorization ---
  interface EisenhowerTaskPoint {
    id: string;
    title: string;
    deadline: string;
    priority: Task['priority'];
    status: Task['status'];
    tags: string[];
    urgencyScore: number;
    importanceScore: number;
    x: number;
    y: number;
    z: number;
    quadrant: 'q1' | 'q2' | 'q3' | 'q4';
    quadrantName: string;
    quadrantTitle: string;
    quadrantAction: string;
    color: string;
    bgClass: string;
    borderClass: string;
    textClass: string;
    dueLabel: string;
    isOverdue: boolean;
    rawTask: Task;
  }

  const eisenhowerData = useMemo(() => {
    const pending = tasks.filter(t => t.status !== 'completed' && t.status !== 'canceled');

    const points: EisenhowerTaskPoint[] = pending.map(task => {
      const deadlineDate = new Date(task.deadline);
      const diffHours = isNaN(deadlineDate.getTime()) ? 999 : (deadlineDate.getTime() - now.getTime()) / (1000 * 3600);
      const isOverdue = diffHours < 0;

      // 1. Calculate Urgency Score (0 - 100)
      let urgencyScore = 20;
      let dueLabel = 'Không thời hạn';
      if (!isNaN(deadlineDate.getTime())) {
        if (isOverdue) {
          const overdueDays = Math.ceil(Math.abs(diffHours) / 24);
          urgencyScore = Math.min(100, 88 + Math.min(12, overdueDays * 2));
          dueLabel = `Quá hạn ${overdueDays} ngày`;
        } else if (diffHours <= 24) {
          urgencyScore = 80 + Math.round((1 - diffHours / 24) * 8);
          dueLabel = `Hạn hôm nay (${Math.round(diffHours)}h)`;
        } else if (diffHours <= 48) {
          urgencyScore = 65 + Math.round((1 - (diffHours - 24) / 24) * 14);
          dueLabel = 'Hạn ngày mai';
        } else if (diffHours <= 168) {
          urgencyScore = 48 + Math.round((1 - (diffHours - 48) / 120) * 16);
          const daysLeft = Math.ceil(diffHours / 24);
          dueLabel = `Còn ${daysLeft} ngày`;
        } else if (diffHours <= 336) {
          urgencyScore = 30 + Math.round((1 - (diffHours - 168) / 168) * 16);
          dueLabel = `Còn ${Math.ceil(diffHours / 24)} ngày`;
        } else {
          urgencyScore = Math.max(8, 25 - Math.round((diffHours - 336) / 120));
          dueLabel = 'Còn > 2 tuần';
        }
      }

      if (task.tags?.some(tag => tag.toLowerCase().includes('khẩn') || tag.toLowerCase().includes('urgent'))) {
        urgencyScore = Math.min(100, urgencyScore + 10);
      }

      // 2. Calculate Importance Score (0 - 100)
      let importanceScore = 50;
      if (task.priority === 'high') {
        importanceScore = 82;
      } else if (task.priority === 'medium') {
        importanceScore = 54;
      } else {
        importanceScore = 26;
      }

      if (task.tags?.some(tag => {
        const lower = tag.toLowerCase();
        return lower.includes('quan trọng') || lower.includes('dự án') || lower.includes('tài chính') || lower.includes('báo cáo');
      })) {
        importanceScore = Math.min(95, importanceScore + 10);
      }
      if (task.attachedFileIds && task.attachedFileIds.length > 0) {
        importanceScore = Math.min(95, importanceScore + 5);
      }

      // 3. Categorize Quadrant
      const isUrgent = urgencyScore >= 50;
      const isImportant = importanceScore >= 50;

      let quadrant: 'q1' | 'q2' | 'q3' | 'q4';
      let quadrantName: string;
      let quadrantTitle: string;
      let quadrantAction: string;
      let color: string;
      let bgClass: string;
      let borderClass: string;
      let textClass: string;

      if (isUrgent && isImportant) {
        quadrant = 'q1';
        quadrantName = 'Q1: Làm Ngay (Do First)';
        quadrantTitle = 'Khẩn cấp & Quan trọng';
        quadrantAction = 'Ưu tiên số 1 • Xử lý dứt điểm hôm nay';
        color = '#F43F5E';
        bgClass = 'bg-rose-500/10';
        borderClass = 'border-rose-500/30';
        textClass = 'text-rose-400';
      } else if (!isUrgent && isImportant) {
        quadrant = 'q2';
        quadrantName = 'Q2: Lên Kế Hoạch (Schedule)';
        quadrantTitle = 'Quan trọng, Chưa gấp';
        quadrantAction = 'Đầu tư thời gian sâu • Tạo kết quả dài hạn';
        color = '#D4AF37';
        bgClass = 'bg-[#D4AF37]/10';
        borderClass = 'border-[#D4AF37]/30';
        textClass = 'text-[#D4AF37]';
      } else if (isUrgent && !isImportant) {
        quadrant = 'q3';
        quadrantName = 'Q3: Ủy Quyền (Delegate)';
        quadrantTitle = 'Gấp, Ít quan trọng';
        quadrantAction = 'Giải quyết nhanh (5-15p) hoặc chuyển giao';
        color = '#38BDF8';
        bgClass = 'bg-sky-500/10';
        borderClass = 'border-sky-500/30';
        textClass = 'text-sky-400';
      } else {
        quadrant = 'q4';
        quadrantName = 'Q4: Cân Nhắc Bỏ (Eliminate)';
        quadrantTitle = 'Không gấp & Ít quan trọng';
        quadrantAction = 'Hoãn lại hoặc loại bỏ để giảm tải đầu óc';
        color = '#94A3B8';
        bgClass = 'bg-slate-500/10';
        borderClass = 'border-slate-500/30';
        textClass = 'text-slate-400';
      }

      // Add gentle deterministic jitter based on task ID so identical priority/deadlines do not collide
      const charCodeSum = task.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const jitterX = ((charCodeSum % 11) - 5) * 1.2;
      const jitterY = (((charCodeSum * 3) % 11) - 5) * 1.2;
      const x = Math.max(6, Math.min(94, Math.round(urgencyScore + jitterX)));
      const y = Math.max(6, Math.min(94, Math.round(importanceScore + jitterY)));

      return {
        id: task.id,
        title: task.title,
        deadline: task.deadline,
        priority: task.priority,
        status: task.status,
        tags: task.tags || [],
        urgencyScore,
        importanceScore,
        x,
        y,
        z: 100,
        quadrant,
        quadrantName,
        quadrantTitle,
        quadrantAction,
        color,
        bgClass,
        borderClass,
        textClass,
        dueLabel,
        isOverdue,
        rawTask: task,
      };
    });

    const q1Tasks = points.filter(p => p.quadrant === 'q1');
    const q2Tasks = points.filter(p => p.quadrant === 'q2');
    const q3Tasks = points.filter(p => p.quadrant === 'q3');
    const q4Tasks = points.filter(p => p.quadrant === 'q4');

    const totalCount = points.length;
    const q1Percent = totalCount > 0 ? Math.round((q1Tasks.length / totalCount) * 100) : 0;
    const q2Percent = totalCount > 0 ? Math.round((q2Tasks.length / totalCount) * 100) : 0;
    const q3Percent = totalCount > 0 ? Math.round((q3Tasks.length / totalCount) * 100) : 0;
    const q4Percent = totalCount > 0 ? Math.round((q4Tasks.length / totalCount) * 100) : 0;

    return {
      points,
      q1Tasks,
      q2Tasks,
      q3Tasks,
      q4Tasks,
      totalCount,
      q1Percent,
      q2Percent,
      q3Percent,
      q4Percent,
    };
  }, [tasks, now]);

  const filteredScatterPoints = useMemo(() => {
    if (eisenhowerFilter === 'all') return eisenhowerData.points;
    return eisenhowerData.points.filter(p => p.quadrant === eisenhowerFilter);
  }, [eisenhowerData, eisenhowerFilter]);

  const selectedEisenhowerTask = useMemo(() => {
    if (!selectedEisenhowerTaskId) return null;
    return eisenhowerData.points.find(p => p.id === selectedEisenhowerTaskId) || null;
  }, [eisenhowerData, selectedEisenhowerTaskId]);

  const CustomEisenhowerTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: EisenhowerTaskPoint = payload[0]?.payload;
      if (!data) return null;
      return (
        <div className="bg-[#181818] border border-[#2E2E2E] p-3.5 rounded-sm shadow-2xl text-xs z-50 pointer-events-none max-w-xs space-y-2">
          <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-1.5 gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-xs font-bold border font-mono ${data.bgClass} ${data.textClass} ${data.borderClass}`}>
              {data.quadrantTitle}
            </span>
            <span className={`text-[10px] font-mono font-bold ${data.isOverdue ? 'text-rose-400' : 'text-[#888888]'}`}>
              {data.dueLabel}
            </span>
          </div>
          <div>
            <h4 className="font-bold text-white text-sm leading-snug">{data.title}</h4>
            <p className="text-[11px] text-[#A0A0A0] mt-1 italic">{data.quadrantAction}</p>
          </div>
          <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-[#222222]">
            <span className="text-[#888888]">Khẩn cấp: <strong className="text-white">{data.urgencyScore}đ</strong></span>
            <span className="text-[#888888]">Quan trọng: <strong className="text-white">{data.importanceScore}đ</strong></span>
            <span className="text-[#888888]">Ưu tiên: <strong className={data.priority === 'high' ? 'text-rose-400' : data.priority === 'medium' ? 'text-amber-400' : 'text-slate-400'}>{data.priority.toUpperCase()}</strong></span>
          </div>
        </div>
      );
    }
    return null;
  };

  const formattedDate = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(now);

  const filteredPriorityTasks = tasks
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .filter(task => {
      if (task.status === 'completed' || task.status === 'canceled') return false;
      if (taskQuickFilter === 'today') return task.deadline.startsWith(todayStr);
      if (taskQuickFilter === 'overdue') return new Date(task.deadline) < now;
      if (taskQuickFilter === 'high') return task.priority === 'high';
      return true;
    });

  const recentSortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      const timeA = new Date(a.noteDate || a.createdAt || a.updatedAt || 0).getTime();
      const timeB = new Date(b.noteDate || b.createdAt || b.updatedAt || 0).getTime();
      return timeB - timeA;
    });
  }, [notes]);

  // --- 30-Day Productivity Insights: Task Completion Trends vs Note Creation Activity ---
  const productivityInsights30d = useMemo(() => {
    const points: Array<{
      date: string;
      dayLabel: string;
      dayOfWeek: string;
      fullDate: string;
      tasksCompleted: number;
      notesCreated: number;
      totalActivity: number;
      completedTaskTitles: string[];
      createdNoteTitles: string[];
    }> = [];

    const currentDate = new Date();
    // 30 days window: from 29 days ago up to today
    for (let i = 29; i >= 0; i--) {
      const targetDate = new Date(currentDate);
      targetDate.setDate(targetDate.getDate() - i);
      const dateStr = targetDate.toISOString().split('T')[0];
      const dayLabel = `${targetDate.getDate()}/${targetDate.getMonth() + 1}`;
      const weekdayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      const dayOfWeek = weekdayNames[targetDate.getDay()];
      const fullDate = `${dayOfWeek}, ${targetDate.getDate()} tháng ${targetDate.getMonth() + 1}, ${targetDate.getFullYear()}`;

      const dayCompletedTasks = tasks.filter(t => {
        if (t.status !== 'completed') return false;
        const compDate = t.recurring?.lastCompletedAt || t.updatedAt || t.deadline || t.createdAt;
        return compDate ? compDate.startsWith(dateStr) : false;
      });

      const dayCreatedNotes = notes.filter(n => {
        const nDate = n.noteDate || n.createdAt || n.updatedAt;
        return nDate ? nDate.startsWith(dateStr) : false;
      });

      points.push({
        date: dateStr,
        dayLabel,
        dayOfWeek,
        fullDate,
        tasksCompleted: dayCompletedTasks.length,
        notesCreated: dayCreatedNotes.length,
        totalActivity: dayCompletedTasks.length + dayCreatedNotes.length,
        completedTaskTitles: dayCompletedTasks.map(t => t.title),
        createdNoteTitles: dayCreatedNotes.map(n => n.title),
      });
    }

    const totalTasksCompleted = points.reduce((sum, p) => sum + p.tasksCompleted, 0);
    const totalNotesCreated = points.reduce((sum, p) => sum + p.notesCreated, 0);
    const totalActivity = totalTasksCompleted + totalNotesCreated;
    const avgTasksPerDay = (totalTasksCompleted / 30).toFixed(1);
    const avgNotesPerDay = (totalNotesCreated / 30).toFixed(1);

    // Peak activity day
    let peak = points[0];
    for (const p of points) {
      if (p.totalActivity > peak.totalActivity) {
        peak = p;
      }
    }

    // Active days count
    const activeDays = points.filter(p => p.totalActivity > 0).length;
    const consistencyPercent = Math.round((activeDays / 30) * 100);

    // Synthesis ratio (notes created / tasks completed)
    const synthesisRatio = totalTasksCompleted > 0
      ? Math.min(100, Math.round((totalNotesCreated / totalTasksCompleted) * 100))
      : (totalNotesCreated > 0 ? 100 : 0);

    return {
      points,
      totalTasksCompleted,
      totalNotesCreated,
      totalActivity,
      avgTasksPerDay,
      avgNotesPerDay,
      peak,
      activeDays,
      consistencyPercent,
      synthesisRatio,
    };
  }, [tasks, notes]);

  const CustomProductivityInsightsTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      if (!data) return null;
      return (
        <div className="bg-[#181818] border border-[#2E2E2E] p-3.5 rounded-sm shadow-2xl text-xs z-50 pointer-events-none min-w-[260px] max-w-xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2">
            <div>
              <span className="font-bold text-white block">{data.fullDate}</span>
              <span className="text-[10px] text-[#888888] font-mono">Tổng hoạt động: {data.totalActivity}</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-xs font-mono font-bold bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
              30-Day Insight
            </span>
          </div>

          <div className="space-y-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#D4AF37]" />
                  <span className="text-[#CCCCCC]">Task hoàn thành:</span>
                </div>
                <span className="font-bold text-[#D4AF37] font-mono">{data.tasksCompleted} việc</span>
              </div>
              {data.completedTaskTitles.length > 0 && (
                <ul className="text-[11px] text-[#A0A0A0] pl-4 list-disc space-y-0.5 max-h-16 overflow-hidden">
                  {data.completedTaskTitles.slice(0, 2).map((title: string, idx: number) => (
                    <li key={idx} className="truncate">{title}</li>
                  ))}
                  {data.completedTaskTitles.length > 2 && (
                    <li className="text-[10px] text-[#777777] italic">+{data.completedTaskTitles.length - 2} việc khác...</li>
                  )}
                </ul>
              )}
            </div>

            <div className="space-y-1 pt-1.5 border-t border-[#222222]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-sky-400" />
                  <span className="text-[#CCCCCC]">Ghi chú đúc kết:</span>
                </div>
                <span className="font-bold text-sky-400 font-mono">{data.notesCreated} note</span>
              </div>
              {data.createdNoteTitles.length > 0 && (
                <ul className="text-[11px] text-[#A0A0A0] pl-4 list-disc space-y-0.5 max-h-16 overflow-hidden">
                  {data.createdNoteTitles.slice(0, 2).map((title: string, idx: number) => (
                    <li key={idx} className="truncate">{title}</li>
                  ))}
                  {data.createdNoteTitles.length > 2 && (
                    <li className="text-[10px] text-[#777777] italic">+{data.createdNoteTitles.length - 2} note khác...</li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Editorial Header */}
      <div className="border-b border-[#2A2A2A] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#D4AF37] bg-[#1A1A1A] px-2.5 py-1 rounded-sm border border-[#D4AF37]/30">
              Active Workflow
            </span>
            <span className="text-xs italic text-[#888888] font-editorial-serif">{formattedDate}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-editorial-serif text-white tracking-tight">
            Tổng quan Hệ thống
          </h1>
          <p className="text-sm text-[#AAAAAA] max-w-2xl leading-relaxed">
            Bạn có <span className="text-[#D4AF37] font-semibold">{dueTodayTasks.length} công việc cần làm hôm nay</span> và <span className="text-rose-400 font-semibold">{overdueTasks.length} công việc quá hạn</span>.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Voice Mode Button */}
          <button
            onClick={onOpenVoiceFocus}
            className="px-4 py-2.5 rounded-sm bg-[#151515] hover:bg-[#202020] text-[#D4AF37] border border-[#D4AF37]/50 font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            title="Kích hoạt chế độ đàm thoại giọng nói 2 chiều Focus Mode"
          >
            <Mic className="w-4 h-4 text-[#D4AF37] animate-pulse" />
            <span>Thoại 2 Chiều</span>
          </button>

          <button
            onClick={() => openAiChatWithPrompt('Tóm tắt tình hình công việc và các deadline quan trọng trong tuần này.')}
            className="px-4 py-2.5 rounded-sm bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-black stroke-[2.5]" />
            <span>Tóm Tắt AI</span>
          </button>

          <button
            onClick={openNewTaskModal}
            className="px-4 py-2.5 rounded-sm bg-[#151515] hover:bg-[#1A1A1A] text-[#E0E0E0] border border-[#2A2A2A] font-semibold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer"
          >
            <CheckSquare className="w-4 h-4 text-[#D4AF37]" />
            <span>Tạo Task</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid with Editorial Numbering */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Tasks */}
        <div
          onClick={() => setActiveTab('tasks')}
          className="border border-[#2A2A2A] p-5 rounded-sm relative overflow-hidden bg-[#151515] hover:border-[#D4AF37]/50 transition-all cursor-pointer group"
        >
          <span className="absolute top-2 right-4 text-[42px] font-editorial-serif text-[#D4AF37]/10 italic pointer-events-none select-none">01</span>
          <p className="text-[10px] uppercase text-[#D4AF37] tracking-widest font-bold mb-1">Cần Làm Hôm Nay</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-editorial-serif font-bold text-white">{dueTodayTasks.length}</span>
            <span className="text-xs text-[#D4AF37]">Công việc</span>
          </div>
          <p className="text-[11px] text-[#777777] mt-3 border-t border-[#2A2A2A] pt-2">Deadline trong ngày</p>
        </div>

        {/* Card 2: Overdue Tasks */}
        <div
          onClick={() => setActiveTab('tasks')}
          className="border border-[#2A2A2A] p-5 rounded-sm relative overflow-hidden bg-[#151515] hover:border-rose-500/50 transition-all cursor-pointer group"
        >
          <span className="absolute top-2 right-4 text-[42px] font-editorial-serif text-rose-500/10 italic pointer-events-none select-none">02</span>
          <p className="text-[10px] uppercase text-rose-400 tracking-widest font-bold mb-1">Cảnh Báo Quá Hạn</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-editorial-serif font-bold text-white">{overdueTasks.length}</span>
            <span className="text-xs text-rose-400">Cần xử lý ngay</span>
          </div>
          <p className="text-[11px] text-[#777777] mt-3 border-t border-[#2A2A2A] pt-2">Task vượt hạn định</p>
        </div>

        {/* Card 3: Notes & Drive Files */}
        <div
          onClick={() => setActiveTab('notes')}
          className="border border-[#2A2A2A] p-5 rounded-sm relative overflow-hidden bg-[#151515] hover:border-[#D4AF37]/50 transition-all cursor-pointer group"
        >
          <span className="absolute top-2 right-4 text-[42px] font-editorial-serif text-[#D4AF37]/10 italic pointer-events-none select-none">03</span>
          <p className="text-[10px] uppercase text-[#D4AF37] tracking-widest font-bold mb-1">Ghi Chú & Drive</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-editorial-serif font-bold text-white">{notes.length}</span>
            <span className="text-xs text-[#A0A0A0]">{files.length} tệp ({totalFileSizeMb} MB)</span>
          </div>
          <p className="text-[11px] text-[#777777] mt-3 border-t border-[#2A2A2A] pt-2">Vector Search Active</p>
        </div>

        {/* Card 4: Telegram Alerts */}
        <div
          onClick={() => setActiveTab('telegram')}
          className="border border-[#2A2A2A] p-5 rounded-sm relative overflow-hidden bg-[#151515] hover:border-sky-500/50 transition-all cursor-pointer group"
        >
          <span className="absolute top-2 right-4 text-[42px] font-editorial-serif text-sky-500/10 italic pointer-events-none select-none">04</span>
          <p className="text-[10px] uppercase text-sky-400 tracking-widest font-bold mb-1">Telegram Bot</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-editorial-serif font-bold text-white">{notificationLogs.length}</span>
            <span className="text-xs text-sky-400">Nhắc nhở đã gửi</span>
          </div>
          <p className="text-[11px] text-[#777777] mt-3 border-t border-[#2A2A2A] pt-2">Webhook 2-Way Active</p>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2-COLUMN COCKPIT LAYOUT: 66% CHARTS (LEFT) & 33% WIDGETS (RIGHT) */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start transition-all duration-300 ease-in-out">
        
        {/* ============================================================== */}
        {/* LEFT COLUMN (66% / 8 cols): PRODUCTIVITY & ANALYTICS CHARTS    */}
        {/* ============================================================== */}
        <div className="lg:col-span-8 w-full min-w-0 space-y-6 transition-all duration-300 ease-in-out">

          {/* 1. Task Status Distribution & Lifecycle Overview Donut Card */}
          <div className="border border-[#2A2A2A] bg-[#151515] rounded-sm p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2A2A2A] pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-[#D4AF37]" />
                  <h3 className="text-lg font-editorial-serif font-bold text-white tracking-tight">Tỷ lệ trạng thái công việc</h3>
                </div>
                <p className="text-xs text-[#888888]">Phân bổ tiến độ thực thi các nhiệm vụ trong toàn hệ thống</p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>{completionRate}% hoàn thành</span>
                </div>
              </div>
            </div>

            {totalTasksCount === 0 ? (
              <div className="py-10 text-center space-y-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#1A1A1A] flex items-center justify-center text-[#666666]">
                  <PieChartIcon className="w-6 h-6" />
                </div>
                <p className="text-xs text-[#888888]">Chưa có dữ liệu công việc trong hệ thống</p>
                <button
                  onClick={openNewTaskModal}
                  className="text-xs text-[#D4AF37] font-semibold hover:underline cursor-pointer"
                >
                  + Tạo task đầu tiên
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {/* Donut Chart with Centered Metric */}
                <div className="md:col-span-5 relative w-full h-[200px] flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <RechartsTooltip content={<CustomPieTooltip />} />
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={82}
                        paddingAngle={4}
                        dataKey="value"
                        animationDuration={600}
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                        ))}
                      </Pie>
                    </RechartsPieChart>
                  </ResponsiveContainer>

                  {/* Donut Center Label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold font-editorial-serif text-white leading-tight">
                      {totalTasksCount}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-[#888888] font-bold">
                      Tổng task
                    </span>
                  </div>
                </div>

                {/* Status Breakdown Legend & Progress Bars */}
                <div className="md:col-span-7 space-y-2">
                  {/* Status 1: Cần làm */}
                  <div
                    onClick={() => setActiveTab('tasks')}
                    className="p-2.5 rounded-sm bg-[#0C0C0C] border border-[#222222] hover:border-[#F59E0B]/50 transition-all cursor-pointer space-y-1.5"
                    title="Xem các công việc Cần làm"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shrink-0" />
                        <span className="text-[#E0E0E0] font-medium">Cần làm (Todo)</span>
                      </div>
                      <div className="flex items-baseline gap-1.5 font-mono">
                        <span className="font-bold text-white">{todoCount}</span>
                        <span className="text-[10px] text-[#777777]">
                          ({totalTasksCount > 0 ? Math.round((todoCount / totalTasksCount) * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-[#1A1A1A] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#F59E0B] rounded-full transition-all duration-500"
                        style={{ width: `${totalTasksCount > 0 ? (todoCount / totalTasksCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Status 2: Đang xử lý */}
                  <div
                    onClick={() => setActiveTab('tasks')}
                    className="p-2.5 rounded-sm bg-[#0C0C0C] border border-[#222222] hover:border-[#3B82F6]/50 transition-all cursor-pointer space-y-1.5"
                    title="Xem các công việc Đang xử lý"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6] shrink-0" />
                        <span className="text-[#E0E0E0] font-medium">Đang xử lý (In Progress)</span>
                      </div>
                      <div className="flex items-baseline gap-1.5 font-mono">
                        <span className="font-bold text-white">{inProgressCount}</span>
                        <span className="text-[10px] text-[#777777]">
                          ({totalTasksCount > 0 ? Math.round((inProgressCount / totalTasksCount) * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-[#1A1A1A] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#3B82F6] rounded-full transition-all duration-500"
                        style={{ width: `${totalTasksCount > 0 ? (inProgressCount / totalTasksCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Status 3: Hoàn thành */}
                  <div
                    onClick={() => setActiveTab('tasks')}
                    className="p-2.5 rounded-sm bg-[#0C0C0C] border border-[#222222] hover:border-[#10B981]/50 transition-all cursor-pointer space-y-1.5"
                    title="Xem các công việc Đã hoàn thành"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] shrink-0" />
                        <span className="text-[#E0E0E0] font-medium">Đã hoàn thành</span>
                      </div>
                      <div className="flex items-baseline gap-1.5 font-mono">
                        <span className="font-bold text-emerald-400">{completedCount}</span>
                        <span className="text-[10px] text-emerald-400/80">
                          ({completionRate}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-[#1A1A1A] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#10B981] rounded-full transition-all duration-500"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                  </div>

                  {/* Status 4: Đã hủy (nếu có) */}
                  {canceledCount > 0 && (
                    <div
                      onClick={() => setActiveTab('tasks')}
                      className="p-2.5 rounded-sm bg-[#0C0C0C] border border-[#222222] hover:border-[#EF4444]/50 transition-all cursor-pointer space-y-1.5"
                      title="Xem các công việc Đã hủy"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] shrink-0" />
                          <span className="text-[#E0E0E0] font-medium">Đã hủy</span>
                        </div>
                        <div className="flex items-baseline gap-1.5 font-mono">
                          <span className="font-bold text-rose-400">{canceledCount}</span>
                          <span className="text-[10px] text-[#777777]">
                            ({totalTasksCount > 0 ? Math.round((canceledCount / totalTasksCount) * 100) : 0}%)
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-[#1A1A1A] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#EF4444] rounded-full transition-all duration-500"
                          style={{ width: `${totalTasksCount > 0 ? (canceledCount / totalTasksCount) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ------------------------------------------------------------- */}
          {/* NEW: Productivity Insights Section (30-Day Task & Note Trends) */}
          {/* ------------------------------------------------------------- */}
      <div className="border border-[#2A2A2A] bg-[#151515] rounded-sm p-5 sm:p-6 space-y-6">
        {/* Section Header with Mode and Filter Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#2A2A2A] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Sparkles className="w-5 h-5 text-[#D4AF37]" />
              <h2 className="text-lg sm:text-xl font-editorial-serif font-bold text-white tracking-tight">
                Productivity Insights
              </h2>
              <span className="text-[10px] uppercase tracking-wider font-bold text-[#D4AF37] bg-[#1A1A1A] px-2.5 py-0.5 rounded-sm border border-[#D4AF37]/30">
                30-Day Synthesis
              </span>
            </div>
            <p className="text-xs text-[#888888] leading-relaxed">
              Đối chiếu trực quan giữa xu hướng hoàn thành công việc và hoạt động tạo ghi chú đúc kết tri thức trong 30 ngày gần nhất qua Recharts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-[#0C0C0C] p-0.5 rounded-sm border border-[#2A2A2A] text-[11px] font-bold">
              <button
                onClick={() => setProductivityInsightsChartType('composed')}
                className={`px-3 py-1.5 rounded-sm cursor-pointer transition-all flex items-center gap-1.5 ${
                  productivityInsightsChartType === 'composed'
                    ? 'bg-[#D4AF37] text-black shadow-xs font-bold'
                    : 'text-[#888888] hover:text-white'
                }`}
                title="Biểu đồ kết hợp: Cột ghi chú & Đường diện tích task"
              >
                <Activity className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kết hợp</span>
              </button>
              <button
                onClick={() => setProductivityInsightsChartType('dual_bar')}
                className={`px-3 py-1.5 rounded-sm cursor-pointer transition-all flex items-center gap-1.5 ${
                  productivityInsightsChartType === 'dual_bar'
                    ? 'bg-[#D4AF37] text-black shadow-xs font-bold'
                    : 'text-[#888888] hover:text-white'
                }`}
                title="Biểu đồ cột song song: Task hoàn thành vs Ghi chú mới"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cột song song</span>
              </button>
              <button
                onClick={() => setProductivityInsightsChartType('area_stacked')}
                className={`px-3 py-1.5 rounded-sm cursor-pointer transition-all flex items-center gap-1.5 ${
                  productivityInsightsChartType === 'area_stacked'
                    ? 'bg-[#D4AF37] text-black shadow-xs font-bold'
                    : 'text-[#888888] hover:text-white'
                }`}
                title="Biểu đồ diện tích xếp tầng: Dòng chảy tri thức"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Diện tích</span>
              </button>
            </div>

            {/* Series Filter Selector */}
            <div className="flex items-center bg-[#0C0C0C] p-0.5 rounded-sm border border-[#2A2A2A] text-[11px] font-bold font-mono">
              {[
                { key: 'all' as const, label: 'Tất cả' },
                { key: 'tasks' as const, label: 'Chỉ Tasks' },
                { key: 'notes' as const, label: 'Chỉ Ghi chú' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setProductivityInsightsFilter(f.key)}
                  className={`px-2.5 py-1.5 rounded-sm cursor-pointer transition-all ${
                    productivityInsightsFilter === f.key
                      ? 'bg-[#2A2A2A] text-white border border-[#3A3A3A] font-bold shadow-xs'
                      : 'text-[#777777] hover:text-[#CCCCCC]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4 30-Day Productivity KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* KPI 1: Tasks Completed */}
          <div className="p-3.5 rounded-sm bg-[#0C0C0C] border border-[#222222] space-y-1">
            <div className="flex items-center justify-between text-[#888888] text-[10px] uppercase font-bold tracking-wider">
              <span>Task hoàn thành (30d)</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#D4AF37]" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-editorial-serif text-[#D4AF37]">
                {productivityInsights30d.totalTasksCompleted}
              </span>
              <span className="text-[11px] font-mono text-[#888888]">công việc</span>
            </div>
            <p className="text-[10px] text-[#777777] truncate">
              Trung bình {productivityInsights30d.avgTasksPerDay} việc / ngày
            </p>
          </div>

          {/* KPI 2: Notes Created */}
          <div className="p-3.5 rounded-sm bg-[#0C0C0C] border border-[#222222] space-y-1">
            <div className="flex items-center justify-between text-[#888888] text-[10px] uppercase font-bold tracking-wider">
              <span>Ghi chú đúc kết (30d)</span>
              <FileText className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-editorial-serif text-sky-400">
                {productivityInsights30d.totalNotesCreated}
              </span>
              <span className="text-[11px] font-mono text-[#888888]">bài học</span>
            </div>
            <p className="text-[10px] text-[#777777] truncate">
              Trung bình {productivityInsights30d.avgNotesPerDay} note / ngày
            </p>
          </div>

          {/* KPI 3: Knowledge Synthesis Ratio */}
          <div className="p-3.5 rounded-sm bg-[#0C0C0C] border border-[#222222] space-y-1">
            <div className="flex items-center justify-between text-[#888888] text-[10px] uppercase font-bold tracking-wider">
              <span>Tỷ lệ đúc kết tri thức</span>
              <Brain className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-editorial-serif text-emerald-400">
                {productivityInsights30d.synthesisRatio}%
              </span>
              <span className="text-[11px] font-mono text-[#888888]">ghi chú / task</span>
            </div>
            <p className="text-[10px] text-[#777777] truncate">
              {productivityInsights30d.synthesisRatio >= 35 ? '● Đạt chuẩn phản tư cao' : 'Khuyến nghị đúc kết thêm'}
            </p>
          </div>

          {/* KPI 4: Peak Activity Day */}
          <div className="p-3.5 rounded-sm bg-[#0C0C0C] border border-[#222222] space-y-1">
            <div className="flex items-center justify-between text-[#888888] text-[10px] uppercase font-bold tracking-wider">
              <span>Ngày năng suất đỉnh</span>
              <Flame className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-editorial-serif text-amber-400">
                {productivityInsights30d.peak.dayLabel}
              </span>
              <span className="text-[11px] font-mono text-[#888888]">{productivityInsights30d.peak.totalActivity} mục</span>
            </div>
            <p className="text-[10px] text-[#777777] truncate">
              {productivityInsights30d.peak.tasksCompleted} việc • {productivityInsights30d.peak.notesCreated} note
            </p>
          </div>
        </div>

        {/* Recharts Visualization Chart Canvas */}
        <div className="w-full h-72 sm:h-80 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {productivityInsightsChartType === 'composed' ? (
              <ComposedChart
                data={productivityInsights30d.points}
                margin={{ top: 16, right: 12, left: -20, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="insightsTaskGoldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="insightsNoteSkyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#0284C7" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222222" vertical={false} />
                <XAxis
                  dataKey="dayLabel"
                  stroke="#666666"
                  tick={{ fill: '#888888', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: '#2A2A2A' }}
                  interval={2}
                />
                <YAxis
                  stroke="#666666"
                  tick={{ fill: '#888888', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <RechartsTooltip content={<CustomProductivityInsightsTooltip />} />

                {/* Notes Created Bar */}
                {(productivityInsightsFilter === 'all' || productivityInsightsFilter === 'notes') && (
                  <Bar
                    dataKey="notesCreated"
                    name="Ghi chú đúc kết"
                    fill="url(#insightsNoteSkyGrad)"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={14}
                  />
                )}

                {/* Tasks Completed Area & Smooth Line */}
                {(productivityInsightsFilter === 'all' || productivityInsightsFilter === 'tasks') && (
                  <Area
                    type="monotone"
                    dataKey="tasksCompleted"
                    name="Task hoàn thành"
                    stroke="#D4AF37"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#insightsTaskGoldGrad)"
                    activeDot={{ r: 5, fill: '#D4AF37', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                )}

                {/* Total Synthesis Activity Line (when in 'all' view) */}
                {productivityInsightsFilter === 'all' && (
                  <Line
                    type="monotone"
                    dataKey="totalActivity"
                    name="Tổng hoạt động"
                    stroke="#10B981"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={{ r: 4, fill: '#10B981', stroke: '#ffffff', strokeWidth: 1.5 }}
                  />
                )}
              </ComposedChart>
            ) : productivityInsightsChartType === 'dual_bar' ? (
              <BarChart
                data={productivityInsights30d.points}
                margin={{ top: 16, right: 12, left: -20, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#222222" vertical={false} />
                <XAxis
                  dataKey="dayLabel"
                  stroke="#666666"
                  tick={{ fill: '#888888', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: '#2A2A2A' }}
                  interval={2}
                />
                <YAxis
                  stroke="#666666"
                  tick={{ fill: '#888888', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <RechartsTooltip content={<CustomProductivityInsightsTooltip />} />

                {(productivityInsightsFilter === 'all' || productivityInsightsFilter === 'tasks') && (
                  <Bar
                    dataKey="tasksCompleted"
                    name="Task hoàn thành"
                    fill="#D4AF37"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={10}
                  />
                )}

                {(productivityInsightsFilter === 'all' || productivityInsightsFilter === 'notes') && (
                  <Bar
                    dataKey="notesCreated"
                    name="Ghi chú đúc kết"
                    fill="#38BDF8"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={10}
                  />
                )}
              </BarChart>
            ) : (
              <AreaChart
                data={productivityInsights30d.points}
                margin={{ top: 16, right: 12, left: -20, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="insightsStackedTaskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="insightsStackedNoteGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222222" vertical={false} />
                <XAxis
                  dataKey="dayLabel"
                  stroke="#666666"
                  tick={{ fill: '#888888', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: '#2A2A2A' }}
                  interval={2}
                />
                <YAxis
                  stroke="#666666"
                  tick={{ fill: '#888888', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <RechartsTooltip content={<CustomProductivityInsightsTooltip />} />

                {(productivityInsightsFilter === 'all' || productivityInsightsFilter === 'tasks') && (
                  <Area
                    type="monotone"
                    dataKey="tasksCompleted"
                    name="Task hoàn thành"
                    stroke="#D4AF37"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#insightsStackedTaskGrad)"
                    activeDot={{ r: 5, fill: '#D4AF37', stroke: '#ffffff', strokeWidth: 1.5 }}
                  />
                )}

                {(productivityInsightsFilter === 'all' || productivityInsightsFilter === 'notes') && (
                  <Area
                    type="monotone"
                    dataKey="notesCreated"
                    name="Ghi chú đúc kết"
                    stroke="#38BDF8"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#insightsStackedNoteGrad)"
                    activeDot={{ r: 5, fill: '#38BDF8', stroke: '#ffffff', strokeWidth: 1.5 }}
                  />
                )}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Legend & Synthesis Takeaways Strip */}
        <div className="bg-[#0A0A0A] border border-[#262626] rounded-sm p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-inner">
          {/* Legend Items */}
          <div className="flex items-center gap-3.5 flex-wrap text-[11px]">
            <span className="px-2 py-0.5 rounded-xs bg-[#1A1A1A] border border-[#333333] text-[10px] font-mono font-bold uppercase tracking-wider text-[#D4AF37]">
              CHÚ THÍCH:
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[#181408] border border-amber-500/40">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.7)]" />
              <span className="text-white font-bold">Task hoàn thành ({productivityInsights30d.totalTasksCompleted})</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[#0B1520] border border-sky-500/40">
              <span className="w-2.5 h-2.5 rounded-xs bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]" />
              <span className="text-white font-bold">Ghi chú đúc kết ({productivityInsights30d.totalNotesCreated})</span>
            </div>
            {productivityInsightsFilter === 'all' && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-xs bg-[#0E1712] border border-emerald-500/40">
                <span className="w-3 h-0.5 border-t border-dashed border-emerald-400" />
                <span className="text-emerald-300 font-semibold">Tổng hoạt động ngày</span>
              </div>
            )}
          </div>

          {/* Automated Synthesis Reflection Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[#121212] border border-[#2E2E2E] text-amber-300 font-mono text-[11px]">
            <Zap className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
            <span className="text-[#F7D070] font-medium">
              Độ đều đặn 30 ngày: <strong className="text-white font-bold">{productivityInsights30d.consistencyPercent}%</strong> số ngày có hoạt động.
            </span>
          </div>
        </div>
      </div>

      {/* Recharts Task Completion Trends & Productivity Visualizer */}
      <div className="border border-[#2A2A2A] bg-[#151515] rounded-sm p-5 sm:p-6 space-y-6">
        {/* Section Header with Mode and Time Range Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#2A2A2A] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#D4AF37]" />
              <h2 className="text-lg sm:text-xl font-editorial-serif font-bold text-white tracking-tight">
                Xu hướng Hoàn thành & Năng suất
              </h2>
              <span className="text-[10px] uppercase tracking-wider font-bold text-[#D4AF37] bg-[#1A1A1A] px-2 py-0.5 rounded-sm border border-[#D4AF37]/30 hidden sm:inline-block">
                Recharts Analytics
              </span>
            </div>
            <p className="text-xs text-[#888888] leading-relaxed">
              Theo dõi tốc độ hoàn thành công việc, khối lượng nhiệm vụ mới và chỉ số hiệu suất vận hành theo thời gian.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Chart View Switcher */}
            <div className="flex items-center bg-[#0C0C0C] p-0.5 rounded-sm border border-[#2A2A2A] text-[11px] font-bold">
              <button
                onClick={() => setTrendChartType('area')}
                className={`px-3 py-1.5 rounded-sm cursor-pointer transition-all flex items-center gap-1.5 ${
                  trendChartType === 'area'
                    ? 'bg-[#D4AF37] text-black shadow-xs'
                    : 'text-[#888888] hover:text-white'
                }`}
                title="Biểu đồ diện tích: Xu hướng khối lượng & hoàn thành"
              >
                <Activity className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Xu hướng</span>
              </button>
              <button
                onClick={() => setTrendChartType('velocity')}
                className={`px-3 py-1.5 rounded-sm cursor-pointer transition-all flex items-center gap-1.5 ${
                  trendChartType === 'velocity'
                    ? 'bg-[#D4AF37] text-black shadow-xs'
                    : 'text-[#888888] hover:text-white'
                }`}
                title="Biểu đồ cột kết hợp: Khối lượng công việc & Tích lũy"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Năng suất</span>
              </button>
              <button
                onClick={() => setTrendChartType('cumulative')}
                className={`px-3 py-1.5 rounded-sm cursor-pointer transition-all flex items-center gap-1.5 ${
                  trendChartType === 'cumulative'
                    ? 'bg-[#D4AF37] text-black shadow-xs'
                    : 'text-[#888888] hover:text-white'
                }`}
                title="Biểu đồ tích lũy: Tiến độ lũy kế"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tích lũy</span>
              </button>
            </div>

            {/* Time Horizon Selector */}
            <div className="flex items-center bg-[#0C0C0C] p-0.5 rounded-sm border border-[#2A2A2A] text-[11px] font-bold font-mono">
              {[
                { key: '7d' as const, label: '7 Ngày' },
                { key: '14d' as const, label: '14 Ngày' },
                { key: '30d' as const, label: '30 Ngày' },
                { key: '8w' as const, label: '8 Tuần' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setTrendTimeRange(tab.key)}
                  className={`px-2.5 py-1.5 rounded-sm cursor-pointer transition-all ${
                    trendTimeRange === tab.key
                      ? 'bg-[#2A2A2A] text-white border border-[#3A3A3A] font-bold shadow-xs'
                      : 'text-[#777777] hover:text-[#CCCCCC]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Metric Overview Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Metric 1 */}
          <div className="p-3.5 rounded-sm bg-[#0C0C0C] border border-[#222222] space-y-1">
            <div className="flex items-center justify-between text-[#888888] text-[10px] uppercase font-bold tracking-wider">
              <span>Hoàn thành kỳ này</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-editorial-serif text-emerald-400">
                {trendAnalytics.totalCompleted}
              </span>
              <span className="text-[11px] font-mono text-[#888888]">công việc</span>
            </div>
            <p className="text-[10px] text-[#666666] truncate">
              {trendAnalytics.totalCreated} task mới trong kỳ
            </p>
          </div>

          {/* Metric 2 */}
          <div className="p-3.5 rounded-sm bg-[#0C0C0C] border border-[#222222] space-y-1">
            <div className="flex items-center justify-between text-[#888888] text-[10px] uppercase font-bold tracking-wider">
              <span>Tốc độ trung bình</span>
              <Zap className="w-3.5 h-3.5 text-[#D4AF37]" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-editorial-serif text-white">
                {trendAnalytics.avgVelocity}
              </span>
              <span className="text-[11px] font-mono text-[#D4AF37]">task / kỳ</span>
            </div>
            <p className="text-[10px] text-[#666666] truncate">
              Vận tốc giải quyết công việc
            </p>
          </div>

          {/* Metric 3 */}
          <div className="p-3.5 rounded-sm bg-[#0C0C0C] border border-[#222222] space-y-1">
            <div className="flex items-center justify-between text-[#888888] text-[10px] uppercase font-bold tracking-wider">
              <span>Tỷ lệ đúng hạn</span>
              <Target className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-editorial-serif text-sky-400">
                {trendAnalytics.periodOnTimeRate}%
              </span>
              <span className="text-[11px] font-mono text-sky-400/80">on-time</span>
            </div>
            <p className="text-[10px] text-[#666666] truncate">
              Hoàn thành trước deadline
            </p>
          </div>

          {/* Metric 4 */}
          <div className="p-3.5 rounded-sm bg-[#0C0C0C] border border-[#222222] space-y-1">
            <div className="flex items-center justify-between text-[#888888] text-[10px] uppercase font-bold tracking-wider">
              <span>Điểm năng suất</span>
              <Award className="w-3.5 h-3.5 text-[#D4AF37]" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-editorial-serif text-[#D4AF37]">
                {trendAnalytics.overallProductivityScore}
              </span>
              <span className="text-[11px] font-mono text-[#D4AF37]">/ 100</span>
            </div>
            <div className="w-full bg-[#1A1A1A] h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-[#D4AF37] rounded-full transition-all duration-500"
                style={{ width: `${trendAnalytics.overallProductivityScore}%` }}
              />
            </div>
          </div>
        </div>

        {/* Recharts Canvas */}
        <div className="relative w-full h-[260px] sm:h-[290px] pt-2">
          {trendAnalytics.points.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-2 text-[#777777]">
              <Activity className="w-8 h-8 opacity-40 text-[#D4AF37]" />
              <p className="text-xs">Chưa có dữ liệu tiến độ trong khoảng thời gian này</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {trendChartType === 'area' ? (
                <AreaChart
                  data={trendAnalytics.points}
                  margin={{ top: 12, right: 12, left: -16, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="areaCompletedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="areaCreatedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222222" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#666666"
                    tick={{ fill: '#888888', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#2A2A2A' }}
                  />
                  <YAxis
                    stroke="#666666"
                    tick={{ fill: '#888888', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <RechartsTooltip content={<CustomTrendTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    name="Đã hoàn thành"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#areaCompletedGradient)"
                    activeDot={{ r: 6, fill: '#10B981', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="created"
                    name="Tạo mới"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    fillOpacity={1}
                    fill="url(#areaCreatedGradient)"
                    activeDot={{ r: 5, fill: '#3B82F6', stroke: '#ffffff', strokeWidth: 1.5 }}
                  />
                </AreaChart>
              ) : trendChartType === 'velocity' ? (
                <ComposedChart
                  data={trendAnalytics.points}
                  margin={{ top: 12, right: 12, left: -16, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#222222" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#666666"
                    tick={{ fill: '#888888', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#2A2A2A' }}
                  />
                  <YAxis
                    stroke="#666666"
                    tick={{ fill: '#888888', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <RechartsTooltip content={<CustomTrendTooltip />} />
                  <Bar
                    dataKey="completed"
                    name="Hoàn thành"
                    fill="#10B981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="created"
                    name="Tạo mới"
                    fill="#3B82F6"
                    opacity={0.7}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulativeCompleted"
                    name="Tích lũy hoàn thành"
                    stroke="#D4AF37"
                    strokeWidth={2.5}
                    dot={{ fill: '#D4AF37', r: 3, stroke: '#0C0C0C', strokeWidth: 1 }}
                    activeDot={{ r: 5, fill: '#D4AF37', stroke: '#fff', strokeWidth: 2 }}
                  />
                </ComposedChart>
              ) : (
                <AreaChart
                  data={trendAnalytics.points}
                  margin={{ top: 12, right: 12, left: -16, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="areaCumulativeGoldGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222222" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#666666"
                    tick={{ fill: '#888888', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#2A2A2A' }}
                  />
                  <YAxis
                    stroke="#666666"
                    tick={{ fill: '#888888', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <RechartsTooltip content={<CustomTrendTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="cumulativeCompleted"
                    name="Tích lũy hoàn thành"
                    stroke="#D4AF37"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#areaCumulativeGoldGradient)"
                    activeDot={{ r: 6, fill: '#D4AF37', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          )}
        </div>

        {/* Chart Legend & Takeaway Insight */}
        <div className="bg-[#0A0A0A] border border-[#262626] rounded-sm p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-inner">
          {/* Legend Items */}
          <div className="flex items-center gap-3.5 flex-wrap text-[11px]">
            <span className="px-2 py-0.5 rounded-xs bg-[#1A1A1A] border border-[#333333] text-[10px] font-mono font-bold uppercase tracking-wider text-[#D4AF37]">
              CHÚ THÍCH:
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[#0E1712] border border-emerald-500/40">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
              <span className="text-white font-bold">Đã hoàn thành</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[#0B1520] border border-blue-500/40">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.7)]" />
              <span className="text-white font-bold">Tạo mới</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[#181408] border border-amber-500/40">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.7)]" />
              <span className="text-white font-bold">Tích lũy / Năng suất</span>
            </div>
          </div>

          {/* Smart Productivity Takeaway */}
          <div className="flex items-center gap-2 text-zinc-300 font-mono text-[11px] px-2.5 py-1 rounded-xs bg-[#121212] border border-[#2E2E2E]">
            {trendAnalytics.peakPoint ? (
              <span className="text-[#F7D070] flex items-center gap-1 font-medium">
                <Zap className="w-3 h-3 text-[#D4AF37]" />
                <span>Đỉnh năng suất: <strong className="text-white font-bold">{trendAnalytics.peakPoint.label}</strong> ({trendAnalytics.peakPoint.completed} việc hoàn thành)</span>
              </span>
            ) : (
              <span className="text-zinc-400">Chưa phát hiện đỉnh hoàn thành trong kỳ</span>
            )}
          </div>
        </div>
      </div>

      {/* Recharts Weekly Performance & AI Focus Hours Widget */}
      <div className="border border-[#2A2A2A] bg-[#151515] rounded-sm p-5 sm:p-6 space-y-6">
        {/* Header with Title and Mode Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#2A2A2A] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-[#D4AF37]" />
              <h2 className="text-lg sm:text-xl font-editorial-serif font-bold text-white tracking-tight">
                Hiệu Suất Tuần & Giờ Tập Trung AI
              </h2>
              <span className="text-[10px] uppercase tracking-wider font-bold text-[#D4AF37] bg-[#1A1A1A] px-2 py-0.5 rounded-sm border border-[#D4AF37]/30 hidden sm:inline-block">
                Weekly Performance
              </span>
            </div>
            <p className="text-xs text-[#888888] leading-relaxed">
              Đối chiếu tỷ lệ hoàn thành công việc (%) với giờ tập trung sâu do AI tính toán, theo dõi nhịp điệu dòng chảy (Flow State) trong 7 ngày gần nhất.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-[#0C0C0C] p-0.5 rounded-sm border border-[#2A2A2A] text-[11px] font-bold">
              <button
                onClick={() => setWeeklyViewMode('dual')}
                className={`px-3 py-1.5 rounded-sm cursor-pointer transition-all flex items-center gap-1.5 ${
                  weeklyViewMode === 'dual'
                    ? 'bg-[#D4AF37] text-black shadow-xs font-bold'
                    : 'text-[#888888] hover:text-white'
                }`}
                title="Hiển thị kết hợp: Cột Tỷ lệ hoàn thành & Đường Giờ Focus AI"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Hai trục (Dual)</span>
              </button>
              <button
                onClick={() => setWeeklyViewMode('focus')}
                className={`px-3 py-1.5 rounded-sm cursor-pointer transition-all flex items-center gap-1.5 ${
                  weeklyViewMode === 'focus'
                    ? 'bg-[#D4AF37] text-black shadow-xs font-bold'
                    : 'text-[#888888] hover:text-white'
                }`}
                title="Chỉ xem đường giờ tập trung sâu AI"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Giờ Focus AI</span>
              </button>
              <button
                onClick={() => setWeeklyViewMode('ratio')}
                className={`px-3 py-1.5 rounded-sm cursor-pointer transition-all flex items-center gap-1.5 ${
                  weeklyViewMode === 'ratio'
                    ? 'bg-[#D4AF37] text-black shadow-xs font-bold'
                    : 'text-[#888888] hover:text-white'
                }`}
                title="Chỉ xem cột tỷ lệ hoàn thành (%)"
              >
                <Target className="w-3.5 h-3.5" />
                <span>Tỷ lệ (%)</span>
              </button>
            </div>

            {/* Quick Action Button: Voice Focus Mode */}
            <button
              onClick={onOpenVoiceFocus}
              className="px-3 py-1.5 bg-[#0C0C0C] hover:bg-[#D4AF37] text-[#D4AF37] hover:text-black border border-[#D4AF37]/40 hover:border-[#D4AF37] rounded-sm text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs"
              title="Kích hoạt phiên làm việc tập trung sâu bằng giọng nói"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Chế độ Voice Focus</span>
            </button>
          </div>
        </div>

        {/* 4 Weekly Productivity Rhythm Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Metric 1 */}
          <div className="p-3.5 rounded-sm bg-[#0C0C0C] border border-[#222222] space-y-1">
            <div className="flex items-center justify-between text-[#888888] text-[10px] uppercase font-bold tracking-wider">
              <span>Tổng giờ focus tuần</span>
              <Brain className="w-3.5 h-3.5 text-[#D4AF37]" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-editorial-serif text-[#D4AF37]">
                {weeklyPerformance.totalFocusHours}h
              </span>
              <span className="text-[11px] font-mono text-[#888888]">giờ sâu</span>
            </div>
            <p className="text-[10px] text-[#666666] truncate">
              Trung bình {weeklyPerformance.avgDailyFocus}h / ngày
            </p>
          </div>

          {/* Metric 2 */}
          <div className="p-3.5 rounded-sm bg-[#0C0C0C] border border-[#222222] space-y-1">
            <div className="flex items-center justify-between text-[#888888] text-[10px] uppercase font-bold tracking-wider">
              <span>Tỷ lệ hoàn thành TB</span>
              <Target className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-editorial-serif text-emerald-400">
                {weeklyPerformance.avgRatio}%
              </span>
              <span className="text-[11px] font-mono text-emerald-400/80">tuần này</span>
            </div>
            <p className="text-[10px] text-[#666666] truncate">
              {weeklyPerformance.totalCompletedThisWeek} nhiệm vụ đã giải quyết
            </p>
          </div>

          {/* Metric 3 */}
          <div className="p-3.5 rounded-sm bg-[#0C0C0C] border border-[#222222] space-y-1">
            <div className="flex items-center justify-between text-[#888888] text-[10px] uppercase font-bold tracking-wider">
              <span>Đỉnh nhịp điệu (Flow)</span>
              <Flame className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold font-editorial-serif text-white truncate">
                {weeklyPerformance.peakDay.dayShort}
              </span>
              <span className="text-[11px] font-mono text-amber-400">
                {weeklyPerformance.peakDay.aiFocusHours}h
              </span>
            </div>
            <p className="text-[10px] text-[#666666] truncate">
              Tỷ lệ dứt điểm: {weeklyPerformance.peakDay.completionRatio}%
            </p>
          </div>

          {/* Metric 4 */}
          <div className="p-3.5 rounded-sm bg-[#0C0C0C] border border-[#222222] space-y-1">
            <div className="flex items-center justify-between text-[#888888] text-[10px] uppercase font-bold tracking-wider">
              <span>Đánh giá nhịp độ AI</span>
              <Compass className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold font-editorial-serif text-sky-300 truncate" title={weeklyPerformance.overallRhythm}>
                {weeklyPerformance.overallRhythm}
              </span>
            </div>
            <p className="text-[10px] text-[#666666] truncate">
              Chu kỳ 7 ngày cân bằng
            </p>
          </div>
        </div>

        {/* Recharts Canvas */}
        <div className="relative w-full h-[270px] sm:h-[300px] pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={weeklyPerformance.days}
              margin={{ top: 16, right: 12, left: -14, bottom: 4 }}
            >
              <defs>
                <linearGradient id="weeklyBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.25} />
                </linearGradient>
                <linearGradient id="weeklyAreaFocusGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#222222" vertical={false} />
              <XAxis
                dataKey="dayShort"
                stroke="#666666"
                tick={{ fill: '#888888', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#2A2A2A' }}
              />
              {/* Left Y-Axis: Task Completion Ratio (%) */}
              <YAxis
                yAxisId="ratio"
                domain={[0, 100]}
                stroke="#10B981"
                tick={{ fill: '#10B981', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                unit="%"
              />
              {/* Right Y-Axis: AI Focus Hours (h) */}
              <YAxis
                yAxisId="hours"
                orientation="right"
                domain={[0, 8]}
                stroke="#D4AF37"
                tick={{ fill: '#D4AF37', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                unit="h"
              />
              <RechartsTooltip content={<CustomWeeklyTooltip />} />
              
              {/* Reference Benchmarks */}
              <ReferenceLine
                yAxisId="ratio"
                y={80}
                stroke="#10B981"
                strokeDasharray="4 4"
                strokeOpacity={0.35}
                label={{ value: 'Mục tiêu 80%', fill: '#10B981', fontSize: 9, position: 'insideTopLeft' }}
              />
              <ReferenceLine
                yAxisId="hours"
                y={4.0}
                stroke="#D4AF37"
                strokeDasharray="4 4"
                strokeOpacity={0.35}
                label={{ value: 'Chuẩn 4.0h Focus', fill: '#D4AF37', fontSize: 9, position: 'insideTopRight' }}
              />

              {/* Task Completion Ratio Bars */}
              {(weeklyViewMode === 'dual' || weeklyViewMode === 'ratio') && (
                <Bar
                  yAxisId="ratio"
                  dataKey="completionRatio"
                  name="Tỷ lệ hoàn thành (%)"
                  fill="url(#weeklyBarGradient)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={34}
                />
              )}

              {/* AI-Generated Focus Hours Line */}
              {(weeklyViewMode === 'dual' || weeklyViewMode === 'focus') && (
                <Line
                  yAxisId="hours"
                  type="monotone"
                  dataKey="aiFocusHours"
                  name="Giờ tập trung AI (h)"
                  stroke="#D4AF37"
                  strokeWidth={3}
                  dot={{ fill: '#D4AF37', r: 4, stroke: '#0C0C0C', strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: '#D4AF37', stroke: '#FFFFFF', strokeWidth: 2 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legend & AI Productivity Rhythm Insight */}
        <div className="bg-[#0A0A0A] border border-[#262626] rounded-sm p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-inner">
          <div className="flex items-center gap-3.5 flex-wrap text-[11px]">
            <span className="px-2 py-0.5 rounded-xs bg-[#1A1A1A] border border-[#333333] text-[10px] font-mono font-bold uppercase tracking-wider text-[#D4AF37]">
              CHÚ THÍCH:
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[#0E1712] border border-emerald-500/40">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
              <span className="text-white font-bold">Tỷ lệ hoàn thành (%) - Trục trái</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[#181408] border border-amber-500/40">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.7)]" />
              <span className="text-white font-bold">Giờ tập trung AI (h) - Trục phải</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[#161616] border border-[#333333]">
              <span className="w-3 h-0.5 border-t border-dashed border-[#AAAAAA]" />
              <span className="text-zinc-300 font-medium">Mốc chuẩn đề xuất</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[#121212] border border-[#2E2E2E] text-[#F7D070] font-mono text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
            <span className="font-medium">Tương quan AI: Các ngày đạt từ 4.0h tập trung sâu ghi nhận tỷ lệ hoàn thành cao hơn 32%.</span>
          </div>
        </div>
      </div>

      {/* Recharts Monthly Trend & 30-Day Productivity Scores Widget */}
      <div className="border border-[#2A2A2A] bg-[#151515] rounded-sm p-5 sm:p-6 space-y-6">
        {/* Header with Title and Mode Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#2A2A2A] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#D4AF37]" />
              <h2 className="text-lg sm:text-xl font-editorial-serif font-bold text-white tracking-tight">
                Xu Hướng Tháng & Điểm Năng Suất (30 Ngày)
              </h2>
              <span className="text-[10px] uppercase tracking-wider font-bold text-[#D4AF37] bg-[#1A1A1A] px-2 py-0.5 rounded-sm border border-[#D4AF37]/30 hidden sm:inline-block">
                Monthly Trend
              </span>
            </div>
            <p className="text-xs text-[#888888] leading-relaxed">
              Theo dõi quỹ đạo điểm năng suất (0 - 100) liên tục trong 30 ngày qua, kết hợp đường trung bình động 7 ngày để nhận diện đà tăng trưởng và tính bền vững.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Chart View Switcher */}
            <div className="flex items-center bg-[#0C0C0C] p-0.5 rounded-sm border border-[#2A2A2A] text-[11px] font-bold">
              <button
                onClick={() => setMonthlyChartType('area')}
                className={`px-3 py-1.5 rounded-sm cursor-pointer transition-all flex items-center gap-1.5 ${
                  monthlyChartType === 'area'
                    ? 'bg-[#D4AF37] text-black shadow-xs font-bold'
                    : 'text-[#888888] hover:text-white'
                }`}
                title="Biểu đồ diện tích dải điểm năng suất"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Diện tích (Area)</span>
              </button>
              <button
                onClick={() => setMonthlyChartType('bar')}
                className={`px-3 py-1.5 rounded-sm cursor-pointer transition-all flex items-center gap-1.5 ${
                  monthlyChartType === 'bar'
                    ? 'bg-[#D4AF37] text-black shadow-xs font-bold'
                    : 'text-[#888888] hover:text-white'
                }`}
                title="Biểu đồ cột điểm theo từng ngày"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Cột (Bars)</span>
              </button>
            </div>

            {/* Toggle 7-Day Moving Average Line */}
            <button
              onClick={() => setShowMovingAverage(!showMovingAverage)}
              className={`px-2.5 py-1.5 rounded-sm text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                showMovingAverage
                  ? 'bg-sky-950/40 text-sky-300 border-sky-600/50'
                  : 'bg-[#0C0C0C] text-[#777777] border-[#2A2A2A] hover:text-white'
              }`}
              title="Bật/Tắt đường xu hướng trung bình động 7 ngày"
            >
              <span className="w-2.5 h-0.5 bg-current" />
              <span>TB động 7D</span>
            </button>
          </div>
        </div>

        {/* 4 Monthly KPI Metrics Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Metric 1 */}
          <div className="p-3.5 rounded-sm bg-[#0C0C0C] border border-[#222222] space-y-1">
            <div className="flex items-center justify-between text-[#888888] text-[10px] uppercase font-bold tracking-wider">
              <span>Điểm TB 30 ngày</span>
              <Award className="w-3.5 h-3.5 text-[#D4AF37]" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-editorial-serif text-[#D4AF37]">
                {monthlyTrendAnalytics.avgScore}
              </span>
              <span className="text-[11px] font-mono text-[#888888]">/ 100</span>
            </div>
            <p className="text-[10px] text-[#666666] truncate">
              {monthlyTrendAnalytics.avgScore >= 80 ? 'Duy trì phong độ xuất sắc' : 'Ổn định mức tích cực'}
            </p>
          </div>

          {/* Metric 2 */}
          <div className="p-3.5 rounded-sm bg-[#0C0C0C] border border-[#222222] space-y-1">
            <div className="flex items-center justify-between text-[#888888] text-[10px] uppercase font-bold tracking-wider">
              <span>Ngày đạt chuẩn (≥ 80)</span>
              <Target className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-editorial-serif text-emerald-400">
                {monthlyTrendAnalytics.highQualityDaysCount}
              </span>
              <span className="text-[11px] font-mono text-emerald-400/80">/ 30 ngày ({monthlyTrendAnalytics.highQualityRatio}%)</span>
            </div>
            <p className="text-[10px] text-[#666666] truncate">
              Tỷ lệ ngày năng suất cao
            </p>
          </div>

          {/* Metric 3 */}
          <div className="p-3.5 rounded-sm bg-[#0C0C0C] border border-[#222222] space-y-1">
            <div className="flex items-center justify-between text-[#888888] text-[10px] uppercase font-bold tracking-wider">
              <span>Đỉnh năng suất tháng</span>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold font-editorial-serif text-white truncate">
                {monthlyTrendAnalytics.peakDay.dayLabel}
              </span>
              <span className="text-[11px] font-mono text-amber-400 font-bold">
                {monthlyTrendAnalytics.peakDay.score} điểm
              </span>
            </div>
            <p className="text-[10px] text-[#666666] truncate">
              {monthlyTrendAnalytics.peakDay.dayOfWeek}, {monthlyTrendAnalytics.peakDay.completedTasks} việc hoàn thành
            </p>
          </div>

          {/* Metric 4 */}
          <div className="p-3.5 rounded-sm bg-[#0C0C0C] border border-[#222222] space-y-1">
            <div className="flex items-center justify-between text-[#888888] text-[10px] uppercase font-bold tracking-wider">
              <span>Đà tăng trưởng</span>
              <Activity className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className={`text-xl font-bold font-editorial-serif ${
                monthlyTrendAnalytics.momentumDelta >= 0 ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {monthlyTrendAnalytics.momentumDelta >= 0 ? `+${monthlyTrendAnalytics.momentumDelta}đ` : `${monthlyTrendAnalytics.momentumDelta}đ`}
              </span>
              <span className="text-[11px] font-mono text-[#888888]">nửa cuối tháng</span>
            </div>
            <p className="text-[10px] text-[#666666] truncate">
              {monthlyTrendAnalytics.momentumDelta >= 0 ? 'Xu hướng tăng tiến độ' : 'Biên độ điều chỉnh nhẹ'}
            </p>
          </div>
        </div>

        {/* Recharts Canvas */}
        <div className="relative w-full h-[280px] sm:h-[310px] pt-1">
          <ResponsiveContainer width="100%" height="100%">
            {monthlyChartType === 'bar' ? (
              <ComposedChart
                data={monthlyTrendAnalytics.points}
                margin={{ top: 16, right: 12, left: -16, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="monthlyBarGoldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#997A15" stopOpacity={0.25} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222222" vertical={false} />
                <XAxis
                  dataKey="dayLabel"
                  stroke="#666666"
                  tick={{ fill: '#888888', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: '#2A2A2A' }}
                  interval={2}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#666666"
                  tick={{ fill: '#888888', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  unit="đ"
                />
                <RechartsTooltip content={<CustomMonthlyTooltip />} />
                <ReferenceLine
                  y={80}
                  stroke="#10B981"
                  strokeDasharray="4 4"
                  strokeOpacity={0.35}
                  label={{ value: 'Mục tiêu 80', fill: '#10B981', fontSize: 9, position: 'insideTopLeft' }}
                />
                <ReferenceLine
                  y={60}
                  stroke="#F59E0B"
                  strokeDasharray="4 4"
                  strokeOpacity={0.3}
                  label={{ value: 'Ngưỡng 60', fill: '#F59E0B', fontSize: 9, position: 'insideTopLeft' }}
                />
                <Bar
                  dataKey="score"
                  name="Điểm năng suất"
                  fill="url(#monthlyBarGoldGradient)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={16}
                />
                {showMovingAverage && (
                  <Line
                    type="monotone"
                    dataKey="movingAverage"
                    name="TB động 7 ngày"
                    stroke="#38BDF8"
                    strokeWidth={2.5}
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={{ r: 5, fill: '#38BDF8', stroke: '#fff', strokeWidth: 1.5 }}
                  />
                )}
              </ComposedChart>
            ) : (
              <AreaChart
                data={monthlyTrendAnalytics.points}
                margin={{ top: 16, right: 12, left: -16, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="monthlyAreaGoldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222222" vertical={false} />
                <XAxis
                  dataKey="dayLabel"
                  stroke="#666666"
                  tick={{ fill: '#888888', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: '#2A2A2A' }}
                  interval={2}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#666666"
                  tick={{ fill: '#888888', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  unit="đ"
                />
                <RechartsTooltip content={<CustomMonthlyTooltip />} />
                <ReferenceLine
                  y={80}
                  stroke="#10B981"
                  strokeDasharray="4 4"
                  strokeOpacity={0.35}
                  label={{ value: 'Mục tiêu 80', fill: '#10B981', fontSize: 9, position: 'insideTopLeft' }}
                />
                <ReferenceLine
                  y={60}
                  stroke="#F59E0B"
                  strokeDasharray="4 4"
                  strokeOpacity={0.3}
                  label={{ value: 'Ngưỡng 60', fill: '#F59E0B', fontSize: 9, position: 'insideTopLeft' }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  name="Điểm năng suất"
                  stroke="#D4AF37"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#monthlyAreaGoldGradient)"
                  activeDot={{ r: 6, fill: '#D4AF37', stroke: '#ffffff', strokeWidth: 2 }}
                />
                {showMovingAverage && (
                  <Line
                    type="monotone"
                    dataKey="movingAverage"
                    name="TB động 7 ngày"
                    stroke="#38BDF8"
                    strokeWidth={2.5}
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={{ r: 5, fill: '#38BDF8', stroke: '#fff', strokeWidth: 1.5 }}
                  />
                )}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Legend & 30-Day Retrospective Insight */}
        <div className="bg-[#0A0A0A] border border-[#262626] rounded-sm p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-inner">
          <div className="flex items-center gap-3.5 flex-wrap text-[11px]">
            <span className="px-2 py-0.5 rounded-xs bg-[#1A1A1A] border border-[#333333] text-[10px] font-mono font-bold uppercase tracking-wider text-[#D4AF37]">
              CHÚ THÍCH:
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[#181408] border border-amber-500/40">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.7)]" />
              <span className="text-white font-bold">Điểm năng suất ngày (0 - 100)</span>
            </div>
            {showMovingAverage && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[#0B1520] border border-sky-500/40">
                <span className="w-3 h-0.5 border-t border-dashed border-sky-400" />
                <span className="text-sky-200 font-bold">Đường TB động 7 ngày</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[#0E1712] border border-emerald-500/40">
              <span className="w-3 h-0.5 border-t border-dashed border-emerald-400" />
              <span className="text-emerald-300 font-semibold">Mục tiêu 80+</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[#121212] border border-[#2E2E2E] text-[#F7D070] font-mono text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
            <span className="font-medium">Tổng kết 30 ngày: {monthlyTrendAnalytics.highQualityRatio}% số ngày đạt chuẩn hiệu suất cao.</span>
          </div>
        </div>
      </div>

      {/* Recharts Eisenhower Matrix (Urgent / Important) Visualization Widget */}
      <div className="border border-[#2A2A2A] bg-[#151515] rounded-sm p-5 sm:p-6 space-y-6">
        {/* Header with Title and Mode Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#2A2A2A] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Grid className="w-5 h-5 text-[#D4AF37]" />
              <h2 className="text-lg sm:text-xl font-editorial-serif font-bold text-white tracking-tight">
                Ma Trận Eisenhower (Khẩn Cấp / Quan Trọng)
              </h2>
              <span className="text-[10px] uppercase tracking-wider font-bold text-[#D4AF37] bg-[#1A1A1A] px-2 py-0.5 rounded-sm border border-[#D4AF37]/30 hidden sm:inline-block">
                Decision Matrix
              </span>
            </div>
            <p className="text-xs text-[#888888] leading-relaxed">
              Phân loại nhiệm vụ tồn đọng theo trục Khẩn cấp (Thời hạn deadline) và Quan trọng (Mức ưu tiên & Tác động) để ưu tiên xử lý thông minh.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Switcher: Matrix vs Scatter */}
            <div className="flex items-center bg-[#0C0C0C] p-0.5 rounded-sm border border-[#2A2A2A] text-[11px] font-bold">
              <button
                onClick={() => setEisenhowerViewMode('cards')}
                className={`px-3 py-1.5 rounded-sm cursor-pointer transition-all flex items-center gap-1.5 ${
                  eisenhowerViewMode === 'cards'
                    ? 'bg-[#D4AF37] text-black shadow-xs font-bold'
                    : 'text-[#888888] hover:text-white'
                }`}
                title="Xem dạng bảng 4 góc phần tư ma trận Eisenhower"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Bảng 4 Góc (Ma Trận)</span>
              </button>
              <button
                onClick={() => setEisenhowerViewMode('matrix')}
                className={`px-3 py-1.5 rounded-sm cursor-pointer transition-all flex items-center gap-1.5 ${
                  eisenhowerViewMode === 'matrix'
                    ? 'bg-[#D4AF37] text-black shadow-xs font-bold'
                    : 'text-[#888888] hover:text-white'
                }`}
                title="Xem đồ thị tọa độ 2D phân bổ công việc"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Đồ thị 2D (Scatter)</span>
              </button>
            </div>

            {/* Quick Action: New Task */}
            <button
              onClick={openNewTaskModal}
              className="px-3 py-1.5 bg-[#0C0C0C] hover:bg-[#D4AF37] text-[#D4AF37] hover:text-black border border-[#D4AF37]/40 hover:border-[#D4AF37] rounded-sm text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs"
              title="Thêm công việc mới vào ma trận"
            >
              <span>+ Tạo công việc</span>
            </button>
          </div>
        </div>

        {/* 4 Quadrants Summary KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Q1: Do First */}
          <div
            onClick={() => setEisenhowerFilter(eisenhowerFilter === 'q1' ? 'all' : 'q1')}
            className={`p-3.5 rounded-sm border transition-all cursor-pointer space-y-1 ${
              eisenhowerFilter === 'q1'
                ? 'bg-rose-500/20 border-rose-500 shadow-sm'
                : 'bg-[#0C0C0C] border-[#222222] hover:border-rose-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-rose-400">
              <span>Q1 • Làm Ngay</span>
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-editorial-serif text-rose-400">
                {eisenhowerData.q1Tasks.length}
              </span>
              <span className="text-[11px] font-mono text-[#888888]">{eisenhowerData.q1Percent}% tổng việc</span>
            </div>
            <p className="text-[10px] text-[#888888] truncate">
              Khẩn cấp & Quan trọng • Xử lý hôm nay
            </p>
          </div>

          {/* Q2: Schedule */}
          <div
            onClick={() => setEisenhowerFilter(eisenhowerFilter === 'q2' ? 'all' : 'q2')}
            className={`p-3.5 rounded-sm border transition-all cursor-pointer space-y-1 ${
              eisenhowerFilter === 'q2'
                ? 'bg-[#D4AF37]/20 border-[#D4AF37] shadow-sm'
                : 'bg-[#0C0C0C] border-[#222222] hover:border-[#D4AF37]/40'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-[#D4AF37]">
              <span>Q2 • Lên Lịch</span>
              <Target className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-editorial-serif text-[#D4AF37]">
                {eisenhowerData.q2Tasks.length}
              </span>
              <span className="text-[11px] font-mono text-[#888888]">{eisenhowerData.q2Percent}% tổng việc</span>
            </div>
            <p className="text-[10px] text-[#888888] truncate">
              Quan trọng, Chưa gấp • Vùng chiến lược
            </p>
          </div>

          {/* Q3: Delegate */}
          <div
            onClick={() => setEisenhowerFilter(eisenhowerFilter === 'q3' ? 'all' : 'q3')}
            className={`p-3.5 rounded-sm border transition-all cursor-pointer space-y-1 ${
              eisenhowerFilter === 'q3'
                ? 'bg-sky-500/20 border-sky-500 shadow-sm'
                : 'bg-[#0C0C0C] border-[#222222] hover:border-sky-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-sky-400">
              <span>Q3 • Ủy Quyền</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-editorial-serif text-sky-400">
                {eisenhowerData.q3Tasks.length}
              </span>
              <span className="text-[11px] font-mono text-[#888888]">{eisenhowerData.q3Percent}% tổng việc</span>
            </div>
            <p className="text-[10px] text-[#888888] truncate">
              Gấp, Ít quan trọng • Làm nhanh 15p
            </p>
          </div>

          {/* Q4: Eliminate */}
          <div
            onClick={() => setEisenhowerFilter(eisenhowerFilter === 'q4' ? 'all' : 'q4')}
            className={`p-3.5 rounded-sm border transition-all cursor-pointer space-y-1 ${
              eisenhowerFilter === 'q4'
                ? 'bg-slate-500/20 border-slate-400 shadow-sm'
                : 'bg-[#0C0C0C] border-[#222222] hover:border-slate-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-slate-400">
              <span>Q4 • Cân Nhắc Bỏ</span>
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-editorial-serif text-slate-400">
                {eisenhowerData.q4Tasks.length}
              </span>
              <span className="text-[11px] font-mono text-[#888888]">{eisenhowerData.q4Percent}% tổng việc</span>
            </div>
            <p className="text-[10px] text-[#888888] truncate">
              Không gấp & Ít quan trọng • Giảm tải
            </p>
          </div>
        </div>

        {/* Quadrant Quick Filter Pills */}
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-[#222222] pb-3 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[#888888] text-[11px] mr-1">Lọc góc phần tư:</span>
            <button
              onClick={() => setEisenhowerFilter('all')}
              className={`px-2.5 py-1 rounded-xs text-[10px] font-bold uppercase transition-all cursor-pointer ${
                eisenhowerFilter === 'all'
                  ? 'bg-white text-black'
                  : 'bg-[#0C0C0C] text-[#888888] hover:text-white border border-[#2A2A2A]'
              }`}
            >
              Tất cả ({eisenhowerData.totalCount})
            </button>
            <button
              onClick={() => setEisenhowerFilter('q1')}
              className={`px-2.5 py-1 rounded-xs text-[10px] font-bold uppercase transition-all cursor-pointer ${
                eisenhowerFilter === 'q1'
                  ? 'bg-rose-500 text-white'
                  : 'bg-[#0C0C0C] text-rose-400 hover:bg-rose-500/10 border border-rose-500/30'
              }`}
            >
              Q1: Làm ngay ({eisenhowerData.q1Tasks.length})
            </button>
            <button
              onClick={() => setEisenhowerFilter('q2')}
              className={`px-2.5 py-1 rounded-xs text-[10px] font-bold uppercase transition-all cursor-pointer ${
                eisenhowerFilter === 'q2'
                  ? 'bg-[#D4AF37] text-black'
                  : 'bg-[#0C0C0C] text-[#D4AF37] hover:bg-[#D4AF37]/10 border border-[#D4AF37]/30'
              }`}
            >
              Q2: Lên lịch ({eisenhowerData.q2Tasks.length})
            </button>
            <button
              onClick={() => setEisenhowerFilter('q3')}
              className={`px-2.5 py-1 rounded-xs text-[10px] font-bold uppercase transition-all cursor-pointer ${
                eisenhowerFilter === 'q3'
                  ? 'bg-sky-500 text-black'
                  : 'bg-[#0C0C0C] text-sky-400 hover:bg-sky-500/10 border border-sky-500/30'
              }`}
            >
              Q3: Ủy quyền ({eisenhowerData.q3Tasks.length})
            </button>
            <button
              onClick={() => setEisenhowerFilter('q4')}
              className={`px-2.5 py-1 rounded-xs text-[10px] font-bold uppercase transition-all cursor-pointer ${
                eisenhowerFilter === 'q4'
                  ? 'bg-slate-400 text-black'
                  : 'bg-[#0C0C0C] text-slate-400 hover:bg-slate-500/10 border border-slate-500/30'
              }`}
            >
              Q4: Cân nhắc bỏ ({eisenhowerData.q4Tasks.length})
            </button>
          </div>

          <span className="text-[11px] text-[#666666]">
            {filteredScatterPoints.length} nhiệm vụ đang hiển thị
          </span>
        </div>

        {/* Selected Task Inspector (Banner when task is clicked) */}
        {selectedEisenhowerTask && (
          <div className="p-3.5 bg-[#0C0C0C] border border-[#333333] rounded-sm space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between gap-2 border-b border-[#222222] pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] px-2 py-0.5 rounded-xs font-bold border font-mono ${selectedEisenhowerTask.bgClass} ${selectedEisenhowerTask.textClass} ${selectedEisenhowerTask.borderClass}`}>
                  {selectedEisenhowerTask.quadrantName}
                </span>
                <span className="text-xs font-bold text-white">
                  {selectedEisenhowerTask.title}
                </span>
              </div>
              <button
                onClick={() => setSelectedEisenhowerTaskId(null)}
                className="text-[11px] text-[#888888] hover:text-white cursor-pointer"
              >
                Đóng
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <p className="text-[#AAAAAA] italic text-[11px]">
                  💡 <strong>Chiến lược xử lý:</strong> {selectedEisenhowerTask.quadrantAction}
                </p>
                <div className="flex items-center gap-3 text-[11px] text-[#777777]">
                  <span>Hạn: <strong className="text-white">{selectedEisenhowerTask.dueLabel}</strong></span>
                  <span>Điểm khẩn cấp: <strong className="text-white">{selectedEisenhowerTask.urgencyScore}đ</strong></span>
                  <span>Điểm quan trọng: <strong className="text-white">{selectedEisenhowerTask.importanceScore}đ</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    onTaskStatusChange(selectedEisenhowerTask.id, 'completed');
                    setSelectedEisenhowerTaskId(null);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xs text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Hoàn thành ngay</span>
                </button>
                <button
                  onClick={() => openAiChatWithPrompt(`Phân tích chiến lược xử lý công việc: "${selectedEisenhowerTask.title}" thuộc nhóm ${selectedEisenhowerTask.quadrantName}. Làm sao giải quyết tối ưu nhất?`)}
                  className="px-3 py-1.5 bg-[#1A1A1A] hover:bg-[#D4AF37] text-[#CCCCCC] hover:text-black border border-[#333333] hover:border-[#D4AF37] rounded-xs text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Hỏi AI</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty State when no tasks */}
        {eisenhowerData.totalCount === 0 ? (
          <div className="py-12 text-center space-y-3 bg-[#0C0C0C] border border-dashed border-[#2A2A2A] rounded-sm">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#181818] flex items-center justify-center text-[#D4AF37]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-editorial-serif font-bold text-white">
                Không có công việc tồn đọng cần phân loại ma trận
              </h3>
              <p className="text-xs text-[#888888] max-w-md mx-auto">
                Tất cả nhiệm vụ đã được hoàn thành xuất sắc! Bạn có thể tạo thêm công việc mới để hệ thống tự động phân loại vào 4 góc phần tư Eisenhower.
              </p>
            </div>
            <button
              onClick={openNewTaskModal}
              className="px-4 py-2 bg-[#D4AF37] hover:bg-[#c29f2e] text-black text-xs font-bold uppercase tracking-wider rounded-sm transition-all cursor-pointer"
            >
              + Tạo công việc mới
            </button>
          </div>
        ) : (
          <div>
            {/* VIEW MODE 1: FOUR-QUADRANT EISENHOWER MATRIX (2x2 GRID) */}
            {eisenhowerViewMode === 'cards' && (
              <div className="space-y-4">
                {/* Visual Axis Indicator Bar: URGENT vs NOT URGENT */}
                <div className="hidden md:grid grid-cols-2 gap-4 text-center font-mono text-xs">
                  <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-t bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold border border-b-0 border-rose-500/30">
                    <AlertCircle className="w-4 h-4" />
                    <span className="tracking-wider">🔥 KHẨN CẤP (URGENT)</span>
                    <span className="text-[10px] font-normal opacity-80">• Cần xử lý ngay</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-t bg-amber-500/10 dark:bg-[#D4AF37]/10 text-amber-700 dark:text-[#D4AF37] font-bold border border-b-0 border-amber-500/30 dark:border-[#D4AF37]/30">
                    <Clock className="w-4 h-4" />
                    <span className="tracking-wider">⏳ KHÔNG KHẨN CẤP (NOT URGENT)</span>
                    <span className="text-[10px] font-normal opacity-80">• Chủ động lên lịch</span>
                  </div>
                </div>

                {/* 2x2 Matrix Board */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* ============================================================== */}
                  {/* ROW 1: IMPORTANT (QUAN TRỌNG)                                  */}
                  {/* ============================================================== */}

                  {/* Q1: DO FIRST (Làm Ngay) */}
                  <div className="p-4 sm:p-5 bg-[#0C0C0C] border border-rose-900/60 rounded-sm space-y-3.5 shadow-xs transition-all hover:border-rose-500/60">
                    <div className="flex items-center justify-between border-b border-[#222222] pb-2.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                          <h4 className="font-editorial-serif font-bold text-sm sm:text-base text-white">
                            Q1 • Làm Ngay (Do First)
                          </h4>
                        </div>
                        <p className="text-[10px] text-rose-300 font-medium">
                          Khẩn cấp & Quan trọng • Khủng hoảng, deadline cận kề
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-mono text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded-xs border border-rose-500/40 font-bold">
                          {eisenhowerData.q1Tasks.length} ({eisenhowerData.q1Percent}%)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddNewTaskInQuadrant('q1')}
                          className="px-2 py-1 rounded bg-rose-950/50 hover:bg-rose-900/70 text-rose-200 border border-rose-700/60 text-[10px] font-bold transition-colors cursor-pointer"
                          title="Thêm nhiệm vụ mới vào Q1 (Do First)"
                        >
                          + Việc Q1
                        </button>
                      </div>
                    </div>

                    {/* Task List Q1 */}
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {eisenhowerData.q1Tasks.length === 0 ? (
                        <div className="py-4 text-center space-y-1">
                          <p className="text-[11px] text-zinc-400 italic">
                            Không có nhiệm vụ khẩn cấp & quan trọng tồn đọng.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleAddNewTaskInQuadrant('q1')}
                            className="text-[10px] text-rose-400 font-semibold hover:underline cursor-pointer"
                          >
                            + Thêm việc khẩn cấp
                          </button>
                        </div>
                      ) : (
                        eisenhowerData.q1Tasks.map(t => (
                          <div
                            key={t.id}
                            onClick={() => setSelectedEisenhowerTaskId(t.id)}
                            className={`p-2.5 rounded-sm border transition-all cursor-pointer flex items-center justify-between gap-2.5 text-xs group/item ${
                              selectedEisenhowerTaskId === t.id
                                ? 'bg-rose-950/80 border-rose-500 text-white shadow-xs'
                                : 'bg-[#141414] hover:bg-[#1A1A1A] border-[#222222] hover:border-rose-500/50 text-white'
                            }`}
                          >
                            <div className="truncate flex-1 min-w-0">
                              <span className="font-semibold truncate block text-white">{t.title}</span>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-xs font-semibold ${t.isOverdue ? 'text-rose-300 bg-rose-950/80 border border-rose-500/40' : 'text-zinc-400'}`}>
                                  {t.dueLabel}
                                </span>
                                <span className="text-[9px] uppercase px-1 rounded bg-rose-950/80 text-rose-200 border border-rose-800/60 font-bold">
                                  {t.priority}
                                </span>
                              </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              {/* Move dropdown */}
                              <div className="relative group/move" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="p-1 hover:bg-[#2A2A2A] text-[#888888] hover:text-[#D4AF37] rounded transition-colors text-[10px]"
                                  title="Chuyển sang góc phần tư khác"
                                >
                                  <ArrowUpDown className="w-3 h-3" />
                                </button>
                                <div className="absolute right-0 top-full mt-1 hidden group-hover/move:flex flex-col bg-[#1A1A1A] border border-[#333333] rounded shadow-xl py-1 z-30 min-w-32 animate-in fade-in text-[10px]">
                                  <button onClick={() => handleMoveTaskQuadrant(t.id, 'q2')} className="px-2.5 py-1 text-left hover:bg-amber-950/40 text-amber-300 flex items-center gap-1.5 cursor-pointer">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" /> Chuyển sang Q2
                                  </button>
                                  <button onClick={() => handleMoveTaskQuadrant(t.id, 'q3')} className="px-2.5 py-1 text-left hover:bg-sky-950/40 text-sky-400 flex items-center gap-1.5 cursor-pointer">
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Chuyển sang Q3
                                  </button>
                                  <button onClick={() => handleMoveTaskQuadrant(t.id, 'q4')} className="px-2.5 py-1 text-left hover:bg-slate-800 text-slate-300 flex items-center gap-1.5 cursor-pointer">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> Chuyển sang Q4
                                  </button>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onTaskStatusChange(t.id, 'completed');
                                }}
                                className="p-1 hover:bg-emerald-500/20 text-[#888888] hover:text-emerald-400 rounded-xs transition-colors shrink-0"
                                title="Đánh dấu hoàn thành"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Q2: SCHEDULE (Lên Kế Hoạch / Chiến Lược) */}
                  <div className="p-4 sm:p-5 bg-[#0C0C0C] border border-amber-900/60 rounded-sm space-y-3.5 shadow-xs transition-all hover:border-amber-400/60">
                    <div className="flex items-center justify-between border-b border-[#222222] pb-2.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] ring-2 ring-[#D4AF37]/30 shadow-[0_0_8px_rgba(212,175,55,0.6)]" />
                          <h4 className="font-editorial-serif font-bold text-sm sm:text-base text-white">
                            Q2 • Lên Kế Hoạch (Schedule)
                          </h4>
                        </div>
                        <p className="text-[10px] text-[#F7D070] font-medium">
                          Quan trọng, Chưa gấp • Phát triển dài hạn, ngăn ngừa rủi ro
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-mono text-[#F7D070] bg-[#D4AF37]/20 px-2 py-0.5 rounded-xs border border-[#D4AF37]/40 font-bold">
                          {eisenhowerData.q2Tasks.length} ({eisenhowerData.q2Percent}%)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddNewTaskInQuadrant('q2')}
                          className="px-2 py-1 rounded bg-amber-950/50 hover:bg-amber-900/70 text-[#F7D070] border border-amber-700/60 text-[10px] font-bold transition-colors cursor-pointer"
                          title="Thêm nhiệm vụ chiến lược vào Q2"
                        >
                          + Việc Q2
                        </button>
                      </div>
                    </div>

                    {/* Task List Q2 */}
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {eisenhowerData.q2Tasks.length === 0 ? (
                        <div className="py-4 text-center space-y-1">
                          <p className="text-[11px] text-zinc-400 italic">
                            Chưa có nhiệm vụ dài hạn quan trọng.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleAddNewTaskInQuadrant('q2')}
                            className="text-[10px] text-[#D4AF37] font-semibold hover:underline cursor-pointer"
                          >
                            + Lên lịch việc chiến lược
                          </button>
                        </div>
                      ) : (
                        eisenhowerData.q2Tasks.map(t => (
                          <div
                            key={t.id}
                            onClick={() => setSelectedEisenhowerTaskId(t.id)}
                            className={`p-2.5 rounded-sm border transition-all cursor-pointer flex items-center justify-between gap-2.5 text-xs group/item ${
                              selectedEisenhowerTaskId === t.id
                                ? 'bg-amber-950/80 border-[#D4AF37] text-white shadow-xs'
                                : 'bg-[#141414] hover:bg-[#1A1A1A] border-[#222222] hover:border-[#D4AF37]/50 text-white'
                            }`}
                          >
                            <div className="truncate flex-1 min-w-0">
                              <span className="font-semibold truncate block text-white">{t.title}</span>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-xs font-semibold text-zinc-400">
                                  {t.dueLabel}
                                </span>
                                <span className="text-[9px] uppercase px-1 rounded bg-amber-950/80 text-amber-200 border border-amber-800/60 font-bold">
                                  {t.priority}
                                </span>
                              </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              <div className="relative group/move" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="p-1 hover:bg-[#2A2A2A] text-[#888888] hover:text-[#D4AF37] rounded transition-colors text-[10px]"
                                  title="Chuyển sang góc phần tư khác"
                                >
                                  <ArrowUpDown className="w-3 h-3" />
                                </button>
                                <div className="absolute right-0 top-full mt-1 hidden group-hover/move:flex flex-col bg-[#1A1A1A] border border-[#333333] rounded shadow-xl py-1 z-30 min-w-32 animate-in fade-in text-[10px]">
                                  <button onClick={() => handleMoveTaskQuadrant(t.id, 'q1')} className="px-2.5 py-1 text-left hover:bg-rose-950/40 text-rose-300 flex items-center gap-1.5 cursor-pointer">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Chuyển sang Q1
                                  </button>
                                  <button onClick={() => handleMoveTaskQuadrant(t.id, 'q3')} className="px-2.5 py-1 text-left hover:bg-sky-950/40 text-sky-400 flex items-center gap-1.5 cursor-pointer">
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Chuyển sang Q3
                                  </button>
                                  <button onClick={() => handleMoveTaskQuadrant(t.id, 'q4')} className="px-2.5 py-1 text-left hover:bg-slate-800 text-slate-300 flex items-center gap-1.5 cursor-pointer">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> Chuyển sang Q4
                                  </button>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onTaskStatusChange(t.id, 'completed');
                                }}
                                className="p-1 hover:bg-emerald-500/20 text-[#888888] hover:text-emerald-400 rounded-xs transition-colors shrink-0"
                                title="Đánh dấu hoàn thành"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* ============================================================== */}
                  {/* ROW 2: NOT IMPORTANT (ÍT QUAN TRỌNG)                           */}
                  {/* ============================================================== */}

                  {/* Q3: DELEGATE (Ủy Quyền / Giải Quyết Nhanh) */}
                  <div className="p-4 sm:p-5 bg-[#0C0C0C] border border-sky-900/60 rounded-sm space-y-3.5 shadow-xs transition-all hover:border-sky-400/60">
                    <div className="flex items-center justify-between border-b border-[#222222] pb-2.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-sky-500 ring-2 ring-sky-500/30 shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
                          <h4 className="font-editorial-serif font-bold text-sm sm:text-base text-white">
                            Q3 • Ủy Quyền (Delegate)
                          </h4>
                        </div>
                        <p className="text-[10px] text-sky-300 font-medium">
                          Gấp, Ít quan trọng • Giải quyết nhanh (5-15p) hoặc nhờ vả
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-mono text-sky-300 bg-sky-950/60 px-2 py-0.5 rounded-xs border border-sky-500/40 font-bold">
                          {eisenhowerData.q3Tasks.length} ({eisenhowerData.q3Percent}%)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddNewTaskInQuadrant('q3')}
                          className="px-2 py-1 rounded bg-sky-950/50 hover:bg-sky-900/70 text-sky-200 border border-sky-700/60 text-[10px] font-bold transition-colors cursor-pointer"
                          title="Thêm nhiệm vụ ủy quyền vào Q3"
                        >
                          + Việc Q3
                        </button>
                      </div>
                    </div>

                    {/* Task List Q3 */}
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {eisenhowerData.q3Tasks.length === 0 ? (
                        <div className="py-4 text-center space-y-1">
                          <p className="text-[11px] text-zinc-400 italic">
                            Không có nhiệm vụ cần ủy quyền.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleAddNewTaskInQuadrant('q3')}
                            className="text-[10px] text-sky-400 font-semibold hover:underline cursor-pointer"
                          >
                            + Thêm việc ủy quyền
                          </button>
                        </div>
                      ) : (
                        eisenhowerData.q3Tasks.map(t => (
                          <div
                            key={t.id}
                            onClick={() => setSelectedEisenhowerTaskId(t.id)}
                            className={`p-2.5 rounded-sm border transition-all cursor-pointer flex items-center justify-between gap-2.5 text-xs group/item ${
                              selectedEisenhowerTaskId === t.id
                                ? 'bg-sky-950/80 border-sky-500 text-white shadow-xs'
                                : 'bg-[#141414] hover:bg-[#1A1A1A] border-[#222222] hover:border-sky-500/50 text-white'
                            }`}
                          >
                            <div className="truncate flex-1 min-w-0">
                              <span className="font-semibold truncate block text-white">{t.title}</span>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-xs font-semibold text-zinc-400">
                                  {t.dueLabel}
                                </span>
                                <span className="text-[9px] uppercase px-1 rounded bg-sky-950/80 text-sky-200 border border-sky-800/60 font-bold">
                                  {t.priority}
                                </span>
                              </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              <div className="relative group/move" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="p-1 hover:bg-[#2A2A2A] text-[#888888] hover:text-[#D4AF37] rounded transition-colors text-[10px]"
                                  title="Chuyển sang góc phần tư khác"
                                >
                                  <ArrowUpDown className="w-3 h-3" />
                                </button>
                                <div className="absolute right-0 top-full mt-1 hidden group-hover/move:flex flex-col bg-[#1A1A1A] border border-[#333333] rounded shadow-xl py-1 z-30 min-w-32 animate-in fade-in text-[10px]">
                                  <button onClick={() => handleMoveTaskQuadrant(t.id, 'q1')} className="px-2.5 py-1 text-left hover:bg-rose-950/40 text-rose-300 flex items-center gap-1.5 cursor-pointer">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Chuyển sang Q1
                                  </button>
                                  <button onClick={() => handleMoveTaskQuadrant(t.id, 'q2')} className="px-2.5 py-1 text-left hover:bg-amber-950/40 text-amber-300 flex items-center gap-1.5 cursor-pointer">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" /> Chuyển sang Q2
                                  </button>
                                  <button onClick={() => handleMoveTaskQuadrant(t.id, 'q4')} className="px-2.5 py-1 text-left hover:bg-slate-800 text-slate-300 flex items-center gap-1.5 cursor-pointer">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> Chuyển sang Q4
                                  </button>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onTaskStatusChange(t.id, 'completed');
                                }}
                                className="p-1 hover:bg-emerald-500/20 text-[#888888] hover:text-emerald-400 rounded-xs transition-colors shrink-0"
                                title="Đánh dấu hoàn thành"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Q4: ELIMINATE (Cân Nhắc Loại Bỏ) */}
                  <div className="p-4 sm:p-5 bg-[#0C0C0C] border border-slate-800 rounded-sm space-y-3.5 shadow-xs transition-all hover:border-slate-600">
                    <div className="flex items-center justify-between border-b border-[#222222] pb-2.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-400 ring-2 ring-slate-400/30 shadow-[0_0_8px_rgba(148,163,184,0.6)]" />
                          <h4 className="font-editorial-serif font-bold text-sm sm:text-base text-white">
                            Q4 • Loại Bỏ (Eliminate)
                          </h4>
                        </div>
                        <p className="text-[10px] text-slate-300 font-medium">
                          Không gấp & Ít quan trọng • Cắt giảm để không xao nhãng
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-mono text-slate-200 bg-slate-800 px-2 py-0.5 rounded-xs border border-slate-700 font-bold">
                          {eisenhowerData.q4Tasks.length} ({eisenhowerData.q4Percent}%)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddNewTaskInQuadrant('q4')}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-bold transition-colors cursor-pointer"
                          title="Thêm nhiệm vụ vào Q4"
                        >
                          + Việc Q4
                        </button>
                      </div>
                    </div>

                    {/* Task List Q4 */}
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {eisenhowerData.q4Tasks.length === 0 ? (
                        <div className="py-4 text-center space-y-1">
                          <p className="text-[11px] text-zinc-400 italic">
                            Không có nhiệm vụ dư thừa cần loại bỏ.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleAddNewTaskInQuadrant('q4')}
                            className="text-[10px] text-slate-400 font-semibold hover:underline cursor-pointer"
                          >
                            + Ghi nhận việc Q4
                          </button>
                        </div>
                      ) : (
                        eisenhowerData.q4Tasks.map(t => (
                          <div
                            key={t.id}
                            onClick={() => setSelectedEisenhowerTaskId(t.id)}
                            className={`p-2.5 rounded-sm border transition-all cursor-pointer flex items-center justify-between gap-2.5 text-xs group/item ${
                              selectedEisenhowerTaskId === t.id
                                ? 'bg-slate-900 border-slate-400 text-white shadow-xs'
                                : 'bg-[#141414] hover:bg-[#1A1A1A] border-[#222222] hover:border-slate-500/50 text-white'
                            }`}
                          >
                            <div className="truncate flex-1 min-w-0">
                              <span className="font-semibold truncate block text-white">{t.title}</span>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="text-[10px] font-mono text-zinc-400 px-1.5 py-0.2 rounded-xs font-semibold bg-slate-800/60">
                                  {t.dueLabel}
                                </span>
                                <span className="text-[9px] uppercase px-1 rounded bg-slate-800 text-slate-200 border border-slate-700 font-bold">
                                  {t.priority}
                                </span>
                              </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              <div className="relative group/move" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="p-1 hover:bg-[#2A2A2A] text-[#888888] hover:text-[#D4AF37] rounded transition-colors text-[10px]"
                                  title="Chuyển sang góc phần tư khác"
                                >
                                  <ArrowUpDown className="w-3 h-3" />
                                </button>
                                <div className="absolute right-0 top-full mt-1 hidden group-hover/move:flex flex-col bg-[#1A1A1A] border border-[#333333] rounded shadow-xl py-1 z-30 min-w-32 animate-in fade-in text-[10px]">
                                  <button onClick={() => handleMoveTaskQuadrant(t.id, 'q1')} className="px-2.5 py-1 text-left hover:bg-rose-950/40 text-rose-300 flex items-center gap-1.5 cursor-pointer">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Chuyển sang Q1
                                  </button>
                                  <button onClick={() => handleMoveTaskQuadrant(t.id, 'q2')} className="px-2.5 py-1 text-left hover:bg-amber-950/40 text-amber-300 flex items-center gap-1.5 cursor-pointer">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" /> Chuyển sang Q2
                                  </button>
                                  <button onClick={() => handleMoveTaskQuadrant(t.id, 'q3')} className="px-2.5 py-1 text-left hover:bg-sky-950/40 text-sky-400 flex items-center gap-1.5 cursor-pointer">
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Chuyển sang Q3
                                  </button>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onTaskStatusChange(t.id, 'completed');
                                }}
                                className="p-1 hover:bg-emerald-500/20 text-[#888888] hover:text-emerald-400 rounded-xs transition-colors shrink-0"
                                title="Đánh dấu hoàn thành"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW MODE 2: 2D SCATTER PLOT */}
            {eisenhowerViewMode === 'matrix' && (
              <div className="space-y-4">
                <div className="relative w-full h-[320px] sm:h-[360px] bg-[#0C0C0C] border border-[#222222] rounded-sm p-2">
                  {/* Subtle Corner Background Watermark Quadrant Titles with Dark Badges and Bright Text */}
                  <div className="absolute top-3 left-10 text-[10px] font-mono text-[#F7D070] font-bold uppercase tracking-wider pointer-events-none z-10 flex items-center gap-1.5 bg-[#121212]/95 border border-[#D4AF37]/40 px-2 py-0.5 rounded-xs backdrop-blur-xs shadow-md">
                    <span className="text-[#F7D070]">Q2: LÊN LỊCH</span>
                    <span className="text-[9px] text-[#A0A0A0] font-normal">(Quan trọng, Chưa gấp)</span>
                  </div>
                  <div className="absolute top-3 right-4 text-[10px] font-mono text-rose-300 font-bold uppercase tracking-wider pointer-events-none z-10 flex items-center gap-1.5 bg-[#121212]/95 border border-rose-500/40 px-2 py-0.5 rounded-xs backdrop-blur-xs shadow-md">
                    <span className="text-rose-300">Q1: LÀM NGAY</span>
                    <span className="text-[9px] text-[#A0A0A0] font-normal">(Khẩn cấp & Quan trọng)</span>
                  </div>
                  <div className="absolute bottom-6 left-10 text-[10px] font-mono text-slate-300 font-bold uppercase tracking-wider pointer-events-none z-10 flex items-center gap-1.5 bg-[#121212]/95 border border-slate-700/60 px-2 py-0.5 rounded-xs backdrop-blur-xs shadow-md">
                    <span className="text-slate-200">Q4: CÂN NHẮC BỎ</span>
                    <span className="text-[9px] text-[#A0A0A0] font-normal">(Không gấp & Ít quan trọng)</span>
                  </div>
                  <div className="absolute bottom-6 right-4 text-[10px] font-mono text-sky-300 font-bold uppercase tracking-wider pointer-events-none z-10 flex items-center gap-1.5 bg-[#121212]/95 border border-sky-500/40 px-2 py-0.5 rounded-xs backdrop-blur-xs shadow-md">
                    <span className="text-sky-300">Q3: ỦY QUYỀN</span>
                    <span className="text-[9px] text-[#A0A0A0] font-normal">(Gấp, Ít quan trọng)</span>
                  </div>

                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart
                      margin={{ top: 24, right: 28, bottom: 20, left: -10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" />
                      <XAxis
                        type="number"
                        dataKey="x"
                        name="Mức độ Khẩn cấp"
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        stroke="#666666"
                        tick={{ fill: '#777777', fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: '#2A2A2A' }}
                        unit="đ"
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        name="Mức độ Quan trọng"
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        stroke="#666666"
                        tick={{ fill: '#777777', fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: '#2A2A2A' }}
                        unit="đ"
                      />
                      <ZAxis type="number" dataKey="z" range={[100, 180]} />

                      {/* Division Axes at 50/50 */}
                      <ReferenceLine x={50} stroke="#3E3E3E" strokeWidth={1.5} strokeDasharray="4 4" />
                      <ReferenceLine y={50} stroke="#3E3E3E" strokeWidth={1.5} strokeDasharray="4 4" />

                      <RechartsTooltip content={<CustomEisenhowerTooltip />} />
                      
                      <Scatter
                        data={filteredScatterPoints}
                        onClick={(entry: any) => setSelectedEisenhowerTaskId(entry.id)}
                      >
                        {filteredScatterPoints.map((entry) => (
                          <Cell
                            key={entry.id}
                            fill={entry.color}
                            stroke={selectedEisenhowerTaskId === entry.id ? '#FFFFFF' : '#000000'}
                            strokeWidth={selectedEisenhowerTaskId === entry.id ? 2.5 : 1}
                            className="cursor-pointer transition-all hover:opacity-80"
                          />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono px-3 py-1.5 bg-[#0C0C0C] border border-[#222222] rounded-xs text-zinc-300">
                  <span className="text-zinc-300 font-medium">← Ít Khẩn Cấp (Trục hoành X) Rất Khẩn Cấp →</span>
                  <span className="text-zinc-300 font-medium">↑ Rất Quan Trọng (Trục tung Y) Ít Quan Trọng ↓</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Legend & Stephen Covey Matrix Principle (Phần Chú thích Ma trận Eisenhower) */}
        <div className="bg-[#0A0A0A] border border-[#262626] rounded-sm p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-inner">
          <div className="flex items-center gap-2 flex-wrap text-[11px]">
            <span className="px-2 py-0.5 rounded-xs bg-[#1A1A1A] border border-[#333333] text-[10px] font-mono font-bold uppercase tracking-wider text-[#D4AF37]">
              CHÚ THÍCH:
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[#180E0E] border border-rose-500/40 text-rose-200">
              <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
              <span className="font-bold text-white">Q1: Làm ngay</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[#181408] border border-amber-500/40 text-amber-200">
              <span className="w-2 h-2 rounded-full bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.8)]" />
              <span className="font-bold text-white">Q2: Lên lịch (Chiến lược)</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[#0B1520] border border-sky-500/40 text-sky-200">
              <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
              <span className="font-bold text-white">Q3: Ủy quyền</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[#141414] border border-slate-600/40 text-slate-200">
              <span className="w-2 h-2 rounded-full bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.8)]" />
              <span className="font-bold text-white">Q4: Loại bỏ</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[#121212] border border-[#2E2E2E] text-amber-300 font-mono text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
            <span className="text-[#F7D070] font-medium">Nguyên lý Covey: Dành 60% năng lượng cho Q2 để chủ động ngăn ngừa khủng hoảng.</span>
          </div>
        </div>
      </div>
    </div>
    {/* End of Left Column (66% width) */}

    {/* ============================================================== */}
    {/* RIGHT COLUMN (33% / 4 cols): WORK & RESOURCE ACTION FEED       */}
    {/* Houses 'Priority Tasks', 'Recent Notes', and 'New Google Drive Files' */}
    {/* ============================================================== */}
    <div className="lg:col-span-4 w-full min-w-0 space-y-6 lg:sticky lg:top-6 transition-all duration-300 ease-in-out">
      
      {/* Widget 1: Công việc ưu tiên & Deadline */}
      <div className="border border-[#2A2A2A] bg-[#151515] rounded-sm p-4 sm:p-5 space-y-4">
        
        {/* Header and Quick Filter Tabs */}
        <div className="flex flex-col gap-2.5 border-b border-[#2A2A2A] pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#D4AF37]" />
              <h2 className="text-base sm:text-lg font-editorial-serif font-bold text-white tracking-tight">
                Công việc ưu tiên & Deadline
              </h2>
            </div>
            <span className="text-[11px] font-mono text-[#D4AF37] font-semibold bg-[#D4AF37]/10 px-2 py-0.5 rounded-sm border border-[#D4AF37]/20">
              {filteredPriorityTasks.length} việc
            </span>
          </div>
          
          {/* Quick Filter Selector */}
          <div className="grid grid-cols-4 gap-1 bg-[#0C0C0C] p-1 rounded-sm border border-[#2A2A2A] text-center">
            <button
              onClick={() => setTaskQuickFilter('all')}
              className={`py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm cursor-pointer transition-all ${
                taskQuickFilter === 'all' ? 'bg-[#D4AF37] text-black shadow-xs font-bold' : 'text-[#888888] hover:text-white'
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setTaskQuickFilter('today')}
              className={`py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm cursor-pointer transition-all ${
                taskQuickFilter === 'today' ? 'bg-[#D4AF37] text-black shadow-xs font-bold' : 'text-[#888888] hover:text-white'
              }`}
            >
              Hôm nay
            </button>
            <button
              onClick={() => setTaskQuickFilter('overdue')}
              className={`py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm cursor-pointer transition-all ${
                taskQuickFilter === 'overdue' ? 'bg-rose-600 text-white shadow-xs font-bold' : 'text-[#888888] hover:text-white'
              }`}
            >
              Quá hạn
            </button>
            <button
              onClick={() => setTaskQuickFilter('high')}
              className={`py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm cursor-pointer transition-all ${
                taskQuickFilter === 'high' ? 'bg-[#D4AF37] text-black shadow-xs font-bold' : 'text-[#888888] hover:text-white'
              }`}
            >
              Ưu tiên cao
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {/* Quick Status Category Drop Targets */}
          <div className="space-y-1.5 mb-1">
            <div className="flex items-center justify-between text-[10px] text-[#888888]">
              <span className="flex items-center gap-1 font-medium">
                <ArrowUpDown className="w-3 h-3 text-[#D4AF37]" />
                <span>Kéo thả chuyển trạng thái hoặc đổi thứ tự:</span>
              </span>
              {draggedTaskId && (
                <span className="text-[10px] text-[#D4AF37] font-semibold animate-pulse">
                  Đang kéo...
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {[
                { status: 'todo' as const, label: 'Todo (Chờ)', icon: Clock, color: 'text-amber-400 border-amber-500/30' },
                { status: 'in_progress' as const, label: 'Đang làm', icon: Sparkles, color: 'text-sky-400 border-sky-500/30' },
                { status: 'completed' as const, label: 'Hoàn thành', icon: CheckCircle2, color: 'text-emerald-400 border-emerald-500/30' },
                { status: 'canceled' as const, label: 'Đã hủy', icon: AlertTriangle, color: 'text-rose-400 border-rose-500/30' },
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
                        onTaskStatusChange(taskId, cat.status);
                      }
                      resetDragState();
                    }}
                    className={`p-1.5 rounded-sm border transition-all text-center flex items-center justify-center gap-1 select-none ${
                      isDropActive
                        ? 'bg-[#D4AF37]/20 border-[#D4AF37] ring-1 ring-[#D4AF37]'
                        : draggedTaskId
                        ? 'bg-[#151515] border-dashed border-[#555555] hover:border-[#D4AF37]'
                        : 'bg-[#0E0E0E] border-[#222222]'
                    }`}
                  >
                    <Icon className={`w-3 h-3 ${cat.color.split(' ')[0]}`} />
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">{cat.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Task list container with custom scrollbar */}
          <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
            {filteredPriorityTasks.length === 0 ? (
              <div className="p-6 text-center bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm space-y-2">
                <CheckCircle2 className="w-7 h-7 text-[#555555] mx-auto" />
                <p className="text-xs font-editorial-serif text-[#E0E0E0]">Không có công việc nào trong mục này</p>
                <button
                  onClick={openNewTaskModal}
                  className="mt-1 px-3 py-1 bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold text-[11px] uppercase tracking-wider rounded-sm cursor-pointer inline-flex items-center gap-1"
                >
                  <CheckSquare className="w-3 h-3" />
                  <span>+ Thêm Task</span>
                </button>
              </div>
            ) : (
              filteredPriorityTasks.slice(0, 10).map(task => {
                const isOverdue = new Date(task.deadline) < now;
                const isUrgent = task.priority === 'high';
                const deadlineInfo = getDeadlineStatusInfo(task.deadline, task.status);

                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', task.id);
                      setDraggedTaskId(task.id);
                    }}
                    onDragEnd={resetDragState}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggedTaskId === task.id) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const midY = rect.top + rect.height / 2;
                      const pos = e.clientY < midY ? 'before' : 'after';
                      if (dragOverTaskId !== task.id || dragOverPosition !== pos) {
                        setDragOverTaskId(task.id);
                        setDragOverPosition(pos);
                      }
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                      if (dragOverTaskId === task.id) {
                        setDragOverTaskId(null);
                        setDragOverPosition(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const sourceId = e.dataTransfer.getData('text/plain') || draggedTaskId;
                      if (sourceId && sourceId !== task.id) {
                        const pos = dragOverPosition || 'after';
                        const reordered = reorderTasksList(tasks, sourceId, task.id, pos);
                        if (onReorderTasks) {
                          onReorderTasks(reordered);
                        }
                      }
                      resetDragState();
                    }}
                    className={`p-3 rounded-sm border transition-all space-y-2 cursor-grab active:cursor-grabbing relative ${
                      draggedTaskId === task.id
                        ? 'opacity-30 border-dashed border-[#D4AF37]'
                        : isOverdue
                        ? 'bg-rose-950/20 border-rose-900/50'
                        : isUrgent
                        ? 'bg-[#1A1A1A] border-[#D4AF37]/40'
                        : 'bg-[#121212] border-[#262626] hover:border-[#383838]'
                    } ${
                      dragOverTaskId === task.id && dragOverPosition === 'before'
                        ? 'border-t-2 border-t-[#D4AF37]'
                        : dragOverTaskId === task.id && dragOverPosition === 'after'
                        ? 'border-b-2 border-b-[#D4AF37]'
                        : ''
                    }`}
                  >
                    {/* Task Top Badges & AI Button */}
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-xs ${
                          task.priority === 'high' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                          task.priority === 'medium' ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30' :
                          'bg-[#2A2A2A] text-[#AAAAAA]'
                        }`}>
                          {task.priority.toUpperCase()}
                        </span>

                        {task.recurring && task.recurring.type !== 'none' && (
                          <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-xs bg-[#1A1A1A] text-sky-300 border border-sky-500/30 flex items-center gap-1">
                            <Repeat className="w-2.5 h-2.5 text-sky-400" />
                            <span>{formatRecurringLabel(task.recurring)}</span>
                          </span>
                        )}

                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-xs border ${deadlineInfo.badgeClass}`}>
                          {deadlineInfo.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 relative">
                        <button
                          type="button"
                          onClick={() => {
                            if (onAnalyzeTask) {
                              onAnalyzeTask(task);
                            } else {
                              openAiChatWithPrompt(`Hãy phân tích và đánh giá toàn diện công việc: "${task.title}". Nội dung: ${task.description}. Không hỏi ngược lại người dùng.`);
                            }
                          }}
                          className="px-2 py-0.5 text-[10px] font-semibold rounded-xs bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/30 hover:bg-[#D4AF37] hover:text-black transition-colors cursor-pointer flex items-center gap-1"
                          title="Tự động phân tích và đánh giá công việc bằng AI"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>Phân tích AI</span>
                        </button>

                        {/* Quick Action 3-Dots Menu Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteTaskId(null);
                            setQuickActionTaskId(quickActionTaskId === task.id ? null : task.id);
                          }}
                          className={`p-1 rounded-xs transition-colors cursor-pointer ${
                            quickActionTaskId === task.id
                              ? 'bg-[#D4AF37] text-black shadow-xs'
                              : 'text-[#888888] hover:text-white hover:bg-[#222222]'
                          }`}
                          title="Thao tác nhanh (Chuyển trạng thái / Xóa)"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {/* Quick Action Dropdown Popup */}
                        {quickActionTaskId === task.id && (
                          <>
                            <div
                              className="fixed inset-0 z-30"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuickActionTaskId(null);
                                setConfirmDeleteTaskId(null);
                              }}
                            />
                            <div
                              className="absolute right-0 top-full mt-1.5 z-40 w-48 bg-[#181818] border border-[#333333] rounded-sm shadow-2xl py-1.5 text-xs animate-in fade-in zoom-in-95 duration-150 space-y-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="px-2.5 py-1 text-[9px] uppercase tracking-wider font-bold text-[#888888] border-b border-[#252525]">
                                Chuyển trạng thái
                              </div>

                              {/* Status Option: Todo */}
                              <button
                                type="button"
                                onClick={() => {
                                  onTaskStatusChange(task.id, 'todo');
                                  setQuickActionTaskId(null);
                                }}
                                className={`w-full px-2.5 py-1.5 text-left flex items-center justify-between transition-colors cursor-pointer ${
                                  task.status === 'todo'
                                    ? 'bg-amber-500/15 text-amber-300 font-bold'
                                    : 'text-[#CCCCCC] hover:bg-[#252525] hover:text-white'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Chờ làm (Todo)</span>
                                </div>
                                {task.status === 'todo' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                              </button>

                              {/* Status Option: In Progress */}
                              <button
                                type="button"
                                onClick={() => {
                                  onTaskStatusChange(task.id, 'in_progress');
                                  setQuickActionTaskId(null);
                                }}
                                className={`w-full px-2.5 py-1.5 text-left flex items-center justify-between transition-colors cursor-pointer ${
                                  task.status === 'in_progress'
                                    ? 'bg-sky-500/15 text-sky-300 font-bold'
                                    : 'text-[#CCCCCC] hover:bg-[#252525] hover:text-white'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                                  <span>Đang làm (In Progress)</span>
                                </div>
                                {task.status === 'in_progress' && <Check className="w-3.5 h-3.5 text-sky-400" />}
                              </button>

                              {/* Status Option: Completed */}
                              <button
                                type="button"
                                onClick={() => {
                                  onTaskStatusChange(task.id, 'completed');
                                  setQuickActionTaskId(null);
                                }}
                                className={`w-full px-2.5 py-1.5 text-left flex items-center justify-between transition-colors cursor-pointer ${
                                  task.status === 'completed'
                                    ? 'bg-emerald-500/15 text-emerald-300 font-bold'
                                    : 'text-[#CCCCCC] hover:bg-[#252525] hover:text-white'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Hoàn thành (Done)</span>
                                </div>
                                {task.status === 'completed' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                              </button>

                              {/* Status Option: Canceled */}
                              <button
                                type="button"
                                onClick={() => {
                                  onTaskStatusChange(task.id, 'canceled');
                                  setQuickActionTaskId(null);
                                }}
                                className={`w-full px-2.5 py-1.5 text-left flex items-center justify-between transition-colors cursor-pointer ${
                                  task.status === 'canceled'
                                    ? 'bg-rose-500/15 text-rose-300 font-bold'
                                    : 'text-[#CCCCCC] hover:bg-[#252525] hover:text-white'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                                  <span>Đã hủy (Canceled)</span>
                                </div>
                                {task.status === 'canceled' && <Check className="w-3.5 h-3.5 text-rose-400" />}
                              </button>

                              <div className="my-1 border-t border-[#252525]" />

                              {/* Action: Edit in Modal */}
                              <button
                                type="button"
                                onClick={() => {
                                  storeOpenTaskModal(task);
                                  setQuickActionTaskId(null);
                                }}
                                className="w-full px-2.5 py-1.5 text-left flex items-center gap-2 text-[#CCCCCC] hover:bg-[#252525] hover:text-white transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-[#D4AF37]" />
                                <span>Sửa chi tiết task</span>
                              </button>

                              {/* Action: Delete Task (with 2-step safe inline confirmation) */}
                              {confirmDeleteTaskId === task.id ? (
                                <div className="px-2 pt-1 pb-1">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await onDeleteTask(task.id);
                                      setConfirmDeleteTaskId(null);
                                      setQuickActionTaskId(null);
                                    }}
                                    className="w-full px-2 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs animate-in zoom-in-95 cursor-pointer text-xs"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Xác nhận xóa ngay</span>
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteTaskId(task.id)}
                                  className="w-full px-2.5 py-1.5 text-left flex items-center gap-2 text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Xóa nhiệm vụ</span>
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Task Title & Fast Action */}
                    <div className="flex items-start gap-2.5">
                      <div className="pt-0.5 text-[#555555] hover:text-[#D4AF37] cursor-grab shrink-0" title="Kéo để đổi vị trí hoặc trạng thái">
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>
                      <button
                        onClick={() => onTaskStatusChange(task.id, 'completed')}
                        className="mt-0.5 text-[#666666] hover:text-[#D4AF37] transition-colors shrink-0 cursor-pointer"
                        title="Đánh dấu hoàn thành (0ms Optimistic)"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs sm:text-sm font-editorial-serif font-bold text-white leading-snug line-clamp-2">
                          {task.title}
                        </h3>
                        {task.description && (
                          <p className="text-[11px] text-[#888888] mt-0.5 line-clamp-1 italic">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Task Footer: Official Deadline */}
                    <div className="pt-1 border-t border-[#1F1F1F] flex items-center justify-between text-[10px] text-[#777777]">
                      <div className="flex items-center gap-1 truncate font-mono">
                        <Clock className="w-3 h-3 text-[#D4AF37] shrink-0" />
                        <span className="truncate">{formatOfficialDeadline(task.deadline)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Widget 2: Ghi chú gần đây */}
      <div className="border border-[#2A2A2A] bg-[#151515] rounded-sm p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#D4AF37]" />
            <h3 className="text-sm font-editorial-serif font-bold text-white">Ghi chú gần đây</h3>
          </div>
          <button
            onClick={openNewNoteModal}
            className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider hover:underline cursor-pointer"
          >
            + Thêm
          </button>
        </div>

        <div className="space-y-2.5">
          {recentSortedNotes.length === 0 ? (
            <p className="text-xs text-[#666666] italic py-2">Chưa có ghi chú nào. Bấm "+ Thêm" để tạo.</p>
          ) : (
            recentSortedNotes.slice(0, 3).map(note => (
            <div
              key={note.id}
              onClick={() => setActiveTab('notes')}
              className="p-3 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] hover:border-[#D4AF37]/50 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-editorial-serif font-bold text-white truncate">{note.title}</h4>
                <span className="text-[10px] font-mono text-[#888888] shrink-0">
                  {new Date(note.noteDate || note.createdAt || note.updatedAt).toLocaleDateString('vi-VN')}
                </span>
              </div>
              <p className="text-[11px] font-editorial-serif italic text-[#AAAAAA] line-clamp-2 mt-1 leading-relaxed">"{note.content}"</p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {note.tags.map((tag, i) => (
                  <span key={i} className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-[#1A1A1A] text-[#888888] border border-[#2A2A2A]">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )))}
        </div>
      </div>

      {/* Widget 3: Google Drive Tệp Mới */}
      <div className="border border-[#2A2A2A] bg-[#151515] rounded-sm p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2">
          <div className="flex items-center gap-2">
            <FolderSync className="w-4 h-4 text-[#D4AF37]" />
            <h3 className="text-sm font-editorial-serif font-bold text-white">Google Drive Tệp Mới</h3>
          </div>
          <button
            onClick={() => setActiveTab('files')}
            className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider hover:underline cursor-pointer"
          >
            Tất cả
          </button>
        </div>

        <div className="space-y-2">
          {files.length === 0 ? (
            <p className="text-xs text-[#666666] italic py-2">Chưa có tài liệu nào. Tải lên tệp tại mục Tài liệu & Drive.</p>
          ) : (
            files.slice(0, 4).map(file => {
              const directLink = getFileDirectLink(file);
              return (
                <div
                  key={file.id}
                  onClick={() => setPreviewDriveFile(file)}
                  className="p-2.5 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] hover:border-[#D4AF37]/60 hover:bg-[#141414] flex items-center justify-between gap-2 text-xs transition-all cursor-pointer group"
                  title="Nhấn để xem trước thông tin và mở liên kết trực tiếp"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border shrink-0 ${getCategoryBadgeClass(file.category)}`}>
                      {file.category}
                    </span>
                    <span className="text-[#E0E0E0] group-hover:text-white font-medium truncate">
                      {file.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-[#777777] font-mono">
                      {formatFileSize(file.size)}
                    </span>
                    <span
                      className="p-1 rounded text-[#888888] group-hover:text-[#D4AF37] hover:bg-[#202020] transition-colors"
                      title="Xem trước & mở liên kết"
                    >
                      {directLink ? <ExternalLink className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
    {/* End of Right Column (33% width) */}

  </div>
  {/* End of 2-Column Cockpit Layout Grid */}

  {/* Miniature Modal for Google Drive File Preview & Direct Link */}
  {previewDriveFile && (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => setPreviewDriveFile(null)}
    >
      <div
        className="relative w-full max-w-md bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] rounded-lg shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150 text-slate-800 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-[#262626] pb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-md bg-blue-50 text-blue-600 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37] border border-blue-200 dark:border-[#D4AF37]/20 shrink-0">
              <FolderSync className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getCategoryBadgeClass(previewDriveFile.category)}`}>
                  {previewDriveFile.category}
                </span>
                {previewDriveFile.classification && (
                  <span className="text-[10px] text-slate-500 dark:text-[#888888] font-mono">
                    • {previewDriveFile.classification}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate mt-1" title={previewDriveFile.name}>
                {previewDriveFile.name}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setPreviewDriveFile(null)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-[#888888] dark:hover:text-white dark:hover:bg-[#202020] transition-colors cursor-pointer shrink-0"
            title="Đóng xem trước"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded bg-slate-50 dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#222222] space-y-0.5">
            <span className="text-[10px] text-slate-400 dark:text-[#777777] uppercase font-mono block">Dung lượng</span>
            <span className="font-semibold text-slate-800 dark:text-[#E0E0E0] font-mono">
              {formatFileSize(previewDriveFile.size)}
            </span>
          </div>

          <div className="p-2.5 rounded bg-slate-50 dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#222222] space-y-0.5">
            <span className="text-[10px] text-slate-400 dark:text-[#777777] uppercase font-mono block">Ngày tải lên</span>
            <span className="font-semibold text-slate-800 dark:text-[#E0E0E0] font-mono">
              {new Date(previewDriveFile.uploadedAt).toLocaleDateString('vi-VN')}
            </span>
          </div>

          <div className="p-2.5 rounded bg-slate-50 dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#222222] space-y-0.5">
            <span className="text-[10px] text-slate-400 dark:text-[#777777] uppercase font-mono block">Định dạng</span>
            <span className="font-semibold text-slate-800 dark:text-[#E0E0E0] truncate block" title={previewDriveFile.mimeType}>
              {previewDriveFile.mimeType.split('/').pop()?.toUpperCase() || 'FILE'}
            </span>
          </div>

          <div className="p-2.5 rounded bg-slate-50 dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#222222] space-y-0.5">
            <span className="text-[10px] text-slate-400 dark:text-[#777777] uppercase font-mono block">Trạng thái Cloud</span>
            <div className="flex items-center gap-1.5 font-semibold text-xs">
              {previewDriveFile.isSyncedToDrive && (previewDriveFile.webViewLink || previewDriveFile.driveFileId) ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Google Drive
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5" /> Local Vault
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Notes / Description Snippet */}
        {(previewDriveFile.notes || previewDriveFile.description) && (
          <div className="p-2.5 rounded bg-[#0E0E0E] border border-[#262626] space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider">
              <FileText className="w-3 h-3 text-[#D4AF37]" />
              <span>Chú thích / Tóm tắt</span>
            </div>
            <p className="text-[11px] text-white italic line-clamp-3 leading-relaxed font-medium">
              &ldquo;{previewDriveFile.notes || previewDriveFile.description}&rdquo;
            </p>
          </div>
        )}

        {/* Tags */}
        {previewDriveFile.tags && previewDriveFile.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {previewDriveFile.tags.map((tag, idx) => (
              <span
                key={idx}
                className="text-[9px] px-2 py-0.5 rounded bg-slate-100 dark:bg-[#0D0D0D] border border-slate-200 dark:border-[#262626] text-slate-600 dark:text-[#A0A0A0] font-mono"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 border-t border-slate-200 dark:border-[#262626] flex items-center gap-2">
          {getFileDirectLink(previewDriveFile) ? (
            <a
              href={getFileDirectLink(previewDriveFile)!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2 px-3 rounded bg-blue-600 hover:bg-blue-700 text-white dark:bg-[#D4AF37] dark:hover:bg-[#c29f2e] dark:text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Mở trên Google Drive</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => {
                setActiveTab('files');
                setPreviewDriveFile(null);
              }}
              className="flex-1 py-2 px-3 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <FolderSync className="w-3.5 h-3.5" />
              <span>Đồng bộ lên Drive</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setActiveTab('files');
              setPreviewDriveFile(null);
            }}
            className="py-2 px-3 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#202020] dark:hover:bg-[#2A2A2A] dark:text-white border border-slate-200 dark:border-[#333333] text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            title="Mở toàn màn hình trong Quản lý Tài liệu"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Chi tiết</span>
          </button>
        </div>
      </div>
    </div>
  )}
    </div>
  );
};
