import React, { useState, useMemo } from 'react';
import { Task } from '../types/index.js';
import { formatOfficialDeadline, getDeadlineStatusInfo } from '../services/dateUtils.js';
import { formatRecurringLabel } from '../utils/recurring.js';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Repeat,
  Edit2,
  Trash2,
  Sparkles,
  CalendarCheck
} from 'lucide-react';

interface TaskCalendarViewProps {
  tasks: Task[];
  onTaskUpdate: (id: string, updates: Partial<Task>) => void;
  onTaskDelete: (id: string) => void;
  editTask: (task: Task) => void;
  openNewTaskModal: () => void;
}

const WEEKDAY_NAMES = [
  { full: 'Thứ Hai', short: 'T2' },
  { full: 'Thứ Ba', short: 'T3' },
  { full: 'Thứ Tư', short: 'T4' },
  { full: 'Thứ Năm', short: 'T5' },
  { full: 'Thứ Sáu', short: 'T6' },
  { full: 'Thứ Bảy', short: 'T7' },
  { full: 'Chủ Nhật', short: 'CN' },
];

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const TaskCalendarView: React.FC<TaskCalendarViewProps> = ({
  tasks,
  onTaskUpdate,
  onTaskDelete,
  editTask,
  openNewTaskModal,
}) => {
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => formatDateKey(today), [today]);

  const [currentDate, setCurrentDate] = useState<Date>(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-11

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleGoToday = () => {
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDateKey(todayKey);
  };

  // Map tasks to dates based on deadline
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach(task => {
      if (!task.deadline) return;
      const d = new Date(task.deadline);
      if (isNaN(d.getTime())) return;
      const key = formatDateKey(d);
      const list = map.get(key) || [];
      list.push(task);
      map.set(key, list);
    });

    // Sort tasks in each date by deadline time
    map.forEach(list => {
      list.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    });

    return map;
  }, [tasks]);

  // Generate calendar grid cells (Monday start)
  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const totalDaysInMonth = lastDayOfMonth.getDate();

    // Day of week: 0 is Sunday, 1 is Monday... convert so Monday is 0, Sunday is 6
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6;

    const days = [];

    // 1. Previous month padding
    const prevMonthLastDate = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dateNum = prevMonthLastDate - i;
      const dateObj = new Date(currentYear, currentMonth - 1, dateNum);
      const key = formatDateKey(dateObj);
      days.push({
        date: dateObj,
        dateNum,
        dateKey: key,
        isCurrentMonth: false,
        isToday: key === todayKey,
        tasks: tasksByDate.get(key) || [],
      });
    }

    // 2. Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateObj = new Date(currentYear, currentMonth, d);
      const key = formatDateKey(dateObj);
      days.push({
        date: dateObj,
        dateNum: d,
        dateKey: key,
        isCurrentMonth: true,
        isToday: key === todayKey,
        tasks: tasksByDate.get(key) || [],
      });
    }

    // 3. Next month padding to fill complete weeks (35 or 42 cells)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let n = 1; n <= remaining; n++) {
      const dateObj = new Date(currentYear, currentMonth + 1, n);
      const key = formatDateKey(dateObj);
      days.push({
        date: dateObj,
        dateNum: n,
        dateKey: key,
        isCurrentMonth: false,
        isToday: key === todayKey,
        tasks: tasksByDate.get(key) || [],
      });
    }

    return days;
  }, [currentYear, currentMonth, todayKey, tasksByDate]);

  // Monthly stats
  const monthStats = useMemo(() => {
    let totalInMonth = 0;
    let completedInMonth = 0;
    let highPriorityInMonth = 0;
    let overdueInMonth = 0;

    calendarGrid.forEach(cell => {
      if (cell.isCurrentMonth) {
        cell.tasks.forEach(t => {
          totalInMonth++;
          if (t.status === 'completed') completedInMonth++;
          if (t.priority === 'high') highPriorityInMonth++;
          const d = new Date(t.deadline);
          if (d < today && t.status !== 'completed' && t.status !== 'canceled') {
            overdueInMonth++;
          }
        });
      }
    });

    return { totalInMonth, completedInMonth, highPriorityInMonth, overdueInMonth };
  }, [calendarGrid, today]);

  // Selected date details
  const selectedDateTasks = useMemo(() => {
    return tasksByDate.get(selectedDateKey) || [];
  }, [tasksByDate, selectedDateKey]);

  const selectedDateFormatted = useMemo(() => {
    const parts = selectedDateKey.split('-');
    if (parts.length !== 3) return selectedDateKey;
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  }, [selectedDateKey]);

  return (
    <div className="space-y-4">
      {/* Calendar Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-sm bg-[#151515] border border-[#2A2A2A]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-sm bg-[#1C1C1C] border border-[#D4AF37]/40 text-[#D4AF37]">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-editorial-serif font-bold text-white tracking-wide capitalize">
                Tháng {String(currentMonth + 1).padStart(2, '0')}, {currentYear}
              </h2>
              <button
                onClick={handleGoToday}
                className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-xs bg-[#1F1F1F] text-[#D4AF37] border border-[#D4AF37]/30 hover:bg-[#D4AF37] hover:text-black transition-colors cursor-pointer"
              >
                Hôm nay
              </button>
            </div>
            <p className="text-xs text-[#888888]">
              Khối lượng công việc trong tháng: <strong className="text-white">{monthStats.totalInMonth}</strong> công việc
              {monthStats.completedInMonth > 0 && (
                <span> • <strong className="text-emerald-400">{monthStats.completedInMonth}</strong> đã hoàn thành</span>
              )}
              {monthStats.overdueInMonth > 0 && (
                <span> • <strong className="text-rose-400">{monthStats.overdueInMonth}</strong> quá hạn</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm">
            <button
              onClick={handlePrevMonth}
              title="Tháng trước"
              className="p-2 text-[#AAAAAA] hover:text-white hover:bg-[#1A1A1A] transition-colors cursor-pointer border-r border-[#2A2A2A]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMonth}
              title="Tháng sau"
              className="p-2 text-[#AAAAAA] hover:text-white hover:bg-[#1A1A1A] transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={openNewTaskModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D4AF37] text-black text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-[#E5C158] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tạo việc</span>
          </button>
        </div>
      </div>

      {/* Main Month Calendar Grid */}
      <div className="bg-[#151515] border border-[#2A2A2A] rounded-sm overflow-hidden shadow-xl">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-[#2A2A2A] bg-[#0E0E0E]">
          {WEEKDAY_NAMES.map((w, idx) => (
            <div
              key={idx}
              className={`py-2.5 text-center text-[11px] font-bold uppercase tracking-wider border-r last:border-r-0 border-[#2A2A2A] ${
                idx >= 5 ? 'text-amber-500/80' : 'text-[#888888]'
              }`}
            >
              <span className="hidden sm:inline">{w.full}</span>
              <span className="sm:hidden">{w.short}</span>
            </div>
          ))}
        </div>

        {/* Day Grid Cells */}
        <div className="grid grid-cols-7 auto-rows-fr bg-[#111111]">
          {calendarGrid.map((cell, idx) => {
            const isSelected = cell.dateKey === selectedDateKey;
            const hasTasks = cell.tasks.length > 0;

            return (
              <div
                key={idx}
                onClick={() => setSelectedDateKey(cell.dateKey)}
                className={`min-h-[105px] p-2 border-r border-b border-[#222222] transition-colors flex flex-col justify-between cursor-pointer relative ${
                  !cell.isCurrentMonth
                    ? 'bg-[#0B0B0B]/70 opacity-40 hover:opacity-75'
                    : isSelected
                    ? 'bg-[#1D1D1D] ring-1 ring-inset ring-[#D4AF37]'
                    : 'bg-[#131313] hover:bg-[#181818]'
                }`}
              >
                {/* Date Header in cell */}
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-xs font-bold rounded-sm w-6 h-6 flex items-center justify-center ${
                        cell.isToday
                          ? 'bg-[#D4AF37] text-black shadow-xs font-black'
                          : isSelected
                          ? 'bg-white/10 text-white font-black'
                          : cell.isCurrentMonth
                          ? 'text-[#DDDDDD]'
                          : 'text-[#666666]'
                      }`}
                    >
                      {cell.dateNum}
                    </span>
                    {cell.isToday && (
                      <span className="hidden md:inline text-[9px] text-[#D4AF37] font-semibold px-1 rounded-xs bg-[#D4AF37]/10">
                        Nay
                      </span>
                    )}
                  </div>

                  {hasTasks && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        cell.tasks.some(t => t.priority === 'high' && t.status !== 'completed')
                          ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                          : 'bg-[#222222] text-[#AAAAAA]'
                      }`}
                      title={`${cell.tasks.length} công việc`}
                    >
                      {cell.tasks.length}
                    </span>
                  )}
                </div>

                {/* Task preview items inside cell (up to 2 visible chips on compact, 3 on larger) */}
                <div className="space-y-1 flex-1 overflow-hidden">
                  {cell.tasks.slice(0, 3).map((task) => {
                    const isCompleted = task.status === 'completed';
                    const isOverdue = new Date(task.deadline) < today && !isCompleted;
                    const timeStr = new Date(task.deadline).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={task.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          editTask(task);
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded-xs truncate flex items-center gap-1 border transition-colors hover:brightness-125 ${
                          isCompleted
                            ? 'bg-emerald-950/30 text-emerald-300/80 border-emerald-900/40 line-through'
                            : isOverdue
                            ? 'bg-rose-950/50 text-rose-200 border-rose-800/60 font-medium'
                            : task.priority === 'high'
                            ? 'bg-rose-950/30 text-rose-300 border-rose-900/40'
                            : 'bg-[#1E1E1E] text-[#CCCCCC] border-[#2E2E2E]'
                        }`}
                        title={`${timeStr} - ${task.title} (${task.priority.toUpperCase()})`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isCompleted
                              ? 'bg-emerald-400'
                              : task.priority === 'high'
                              ? 'bg-rose-500'
                              : task.priority === 'medium'
                              ? 'bg-[#D4AF37]'
                              : 'bg-zinc-400'
                          }`}
                        />
                        <span className="text-[9px] text-[#888888] shrink-0">{timeStr}</span>
                        <span className="truncate">{task.title}</span>
                      </div>
                    );
                  })}

                  {cell.tasks.length > 3 && (
                    <div className="text-[9px] text-[#888888] font-medium pl-1">
                      +{cell.tasks.length - 3} việc khác
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Inspector & Task Detail Panel */}
      <div className="p-4 rounded-sm bg-[#151515] border border-[#2A2A2A] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#252525] pb-3">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-[#D4AF37]" />
            <div>
              <h3 className="text-sm font-editorial-serif font-bold text-white capitalize">
                Chi tiết công việc: {selectedDateFormatted}
              </h3>
              <p className="text-xs text-[#888888]">
                {selectedDateTasks.length === 0
                  ? 'Chưa có công việc nào có hạn vào ngày này.'
                  : `Có ${selectedDateTasks.length} công việc cần xử lý.`}
              </p>
            </div>
          </div>

          <button
            onClick={openNewTaskModal}
            className="self-start sm:self-auto flex items-center gap-1.5 text-xs text-[#D4AF37] hover:underline cursor-pointer font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm công việc vào ngày này</span>
          </button>
        </div>

        {selectedDateTasks.length === 0 ? (
          <div className="py-8 text-center bg-[#0C0C0C] border border-dashed border-[#2A2A2A] rounded-sm space-y-2">
            <Clock className="w-6 h-6 text-[#555555] mx-auto" />
            <p className="text-xs text-[#888888]">Ngày này trống lịch. Không có công việc nào tới hạn.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {selectedDateTasks.map((task) => {
              const isCompleted = task.status === 'completed';
              const isOverdue = new Date(task.deadline) < today && !isCompleted;
              const deadlineInfo = getDeadlineStatusInfo(task.deadline, task.status);

              return (
                <div
                  key={task.id}
                  className={`p-3 rounded-sm border space-y-2 transition-all ${
                    isOverdue
                      ? 'bg-rose-950/20 border-rose-900/60'
                      : isCompleted
                      ? 'bg-[#0E0E0E] border-[#222222] opacity-70'
                      : 'bg-[#101010] border-[#2A2A2A] hover:border-[#3E3E3E]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isCompleted}
                        onChange={(e) =>
                          onTaskUpdate(task.id, { status: e.target.checked ? 'completed' : 'todo' })
                        }
                        className="mt-1 w-4 h-4 rounded-sm border-[#333333] bg-[#0C0C0C] text-[#D4AF37] focus:ring-[#D4AF37] cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span
                            className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.2 rounded-xs ${
                              task.priority === 'high'
                                ? 'bg-rose-500/20 text-rose-300'
                                : task.priority === 'medium'
                                ? 'bg-[#D4AF37]/20 text-[#D4AF37]'
                                : 'bg-[#2A2A2A] text-[#888888]'
                            }`}
                          >
                            {task.priority.toUpperCase()}
                          </span>

                          <span
                            className={`text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.2 rounded-xs ${
                              task.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : task.status === 'in_progress'
                                ? 'bg-sky-500/20 text-sky-300'
                                : 'bg-[#1F1F1F] text-[#CCCCCC]'
                            }`}
                          >
                            {task.status}
                          </span>

                          {task.recurring && task.recurring.type !== 'none' && (
                            <span
                              className="text-[9px] px-1.5 py-0.2 rounded-xs bg-[#1A1A1A] text-sky-300 border border-sky-500/30 flex items-center gap-1"
                              title={formatRecurringLabel(task.recurring)}
                            >
                              <Repeat className="w-2.5 h-2.5 text-sky-400" />
                              <span>{formatRecurringLabel(task.recurring)}</span>
                              {task.recurring.completedCycles ? (
                                <span className="text-[8px] bg-sky-950 px-1 rounded-xs">
                                  #{task.recurring.completedCycles}
                                </span>
                              ) : null}
                            </span>
                          )}
                        </div>

                        <h4
                          className={`text-xs font-editorial-serif font-bold ${
                            isCompleted ? 'line-through text-[#777777]' : 'text-white'
                          }`}
                        >
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-[11px] text-[#888888] line-clamp-2 mt-0.5">{task.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => editTask(task)}
                        title="Chỉnh sửa công việc"
                        className="p-1 rounded-sm text-[#888888] hover:text-[#D4AF37] hover:bg-[#1A1A1A] transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onTaskDelete(task.id)}
                        title="Xóa công việc"
                        className="p-1 rounded-sm text-[#888888] hover:text-rose-400 hover:bg-[#1A1A1A] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-[#222222] text-[#888888]">
                    <span className="flex items-center gap-1 text-[#D4AF37]">
                      <Clock className="w-3 h-3" />
                      <span>{formatOfficialDeadline(task.deadline)}</span>
                    </span>

                    {deadlineInfo.isOverdue && (
                      <span className="text-rose-400 font-semibold flex items-center gap-0.5">
                        <AlertCircle className="w-3 h-3" />
                        <span>Quá hạn</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
