import React, { useState } from 'react';
import { Task, Note, DriveFile, NotificationLog } from '../types/index.js';
import { formatOfficialDeadline, getDeadlineStatusInfo } from '../services/dateUtils.js';
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
  Mic
} from 'lucide-react';

interface DashboardViewProps {
  tasks: Task[];
  notes: Note[];
  files: DriveFile[];
  notificationLogs: NotificationLog[];
  onTaskStatusChange: (taskId: string, newStatus: Task['status']) => void;
  setActiveTab: (tab: 'dashboard' | 'tasks' | 'notes' | 'files' | 'telegram' | 'ai-learning' | 'settings' | 'architecture') => void;
  openAiChatWithPrompt: (prompt: string) => void;
  onOpenVoiceFocus?: () => void;
  openNewTaskModal: () => void;
  openNewNoteModal: () => void;
}

type QuickFilter = 'all' | 'today' | 'overdue' | 'high';

export const DashboardView: React.FC<DashboardViewProps> = ({
  tasks,
  notes,
  files,
  notificationLogs,
  onTaskStatusChange,
  setActiveTab,
  openAiChatWithPrompt,
  onOpenVoiceFocus = () => {},
  openNewTaskModal,
  openNewNoteModal,
}) => {
  const [taskQuickFilter, setTaskQuickFilter] = useState<QuickFilter>('all');
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const dueTodayTasks = tasks.filter(t => t.deadline.startsWith(todayStr) && t.status !== 'completed' && t.status !== 'canceled');
  const overdueTasks = tasks.filter(t => new Date(t.deadline) < now && t.status !== 'completed' && t.status !== 'canceled');

  const totalFileSizeMb = (files.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(2);

  const formattedDate = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(now);

  const filteredPriorityTasks = tasks.filter(task => {
    if (task.status === 'completed' || task.status === 'canceled') return false;
    if (taskQuickFilter === 'today') return task.deadline.startsWith(todayStr);
    if (taskQuickFilter === 'overdue') return new Date(task.deadline) < now;
    if (taskQuickFilter === 'high') return task.priority === 'high';
    return true;
  });

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

      {/* Main Content Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Cols: Priority Tasks & Quick Filters */}
        <div className="lg:col-span-2 space-y-6">
          <div className="border border-[#2A2A2A] bg-[#151515] rounded-sm p-6 space-y-4">
            
            {/* Header and Quick Filter Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2A2A2A] pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#D4AF37]" />
                <h2 className="text-lg font-editorial-serif font-bold text-white">Công việc ưu tiên & Deadline</h2>
              </div>
              
              {/* Quick Filter Selector */}
              <div className="flex items-center bg-[#0C0C0C] p-0.5 rounded-sm border border-[#2A2A2A]">
                <button
                  onClick={() => setTaskQuickFilter('all')}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm cursor-pointer transition-all ${
                    taskQuickFilter === 'all' ? 'bg-[#D4AF37] text-black' : 'text-[#888888] hover:text-white'
                  }`}
                >
                  Tất cả
                </button>
                <button
                  onClick={() => setTaskQuickFilter('today')}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm cursor-pointer transition-all ${
                    taskQuickFilter === 'today' ? 'bg-[#D4AF37] text-black' : 'text-[#888888] hover:text-white'
                  }`}
                >
                  Hôm nay
                </button>
                <button
                  onClick={() => setTaskQuickFilter('overdue')}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm cursor-pointer transition-all ${
                    taskQuickFilter === 'overdue' ? 'bg-rose-600 text-white' : 'text-[#888888] hover:text-white'
                  }`}
                >
                  Quá hạn
                </button>
                <button
                  onClick={() => setTaskQuickFilter('high')}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm cursor-pointer transition-all ${
                    taskQuickFilter === 'high' ? 'bg-[#D4AF37] text-black' : 'text-[#888888] hover:text-white'
                  }`}
                >
                  Ưu tiên cao
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {filteredPriorityTasks.length === 0 ? (
                <div className="p-8 text-center bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-[#555555] mx-auto" />
                  <p className="text-sm font-editorial-serif text-[#E0E0E0]">Không có công việc nào trong mục này</p>
                  <p className="text-xs text-[#777777]">Bấm "Tạo Task" để thêm nhiệm vụ mới.</p>
                  <button
                    onClick={openNewTaskModal}
                    className="mt-2 px-3 py-1.5 bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold text-xs uppercase tracking-wider rounded-sm cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>+ Thêm Task Mới</span>
                  </button>
                </div>
              ) : (
                filteredPriorityTasks.slice(0, 6).map(task => {
                  const isOverdue = new Date(task.deadline) < now;
                  const isUrgent = task.priority === 'high';
                  const deadlineInfo = getDeadlineStatusInfo(task.deadline, task.status);

                  return (
                    <div
                      key={task.id}
                      className={`p-4 rounded-sm border transition-all flex items-start justify-between gap-4 ${
                        isOverdue
                          ? 'bg-rose-950/20 border-rose-900/50'
                          : isUrgent
                          ? 'bg-[#1A1A1A] border-[#D4AF37]/40'
                          : 'bg-[#151515] border-[#2A2A2A] hover:border-[#333333]'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <button
                          onClick={() => onTaskStatusChange(task.id, 'completed')}
                          className="mt-0.5 text-[#666666] hover:text-[#D4AF37] transition-colors shrink-0 cursor-pointer"
                          title="Đánh dấu hoàn thành (0ms Optimistic)"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-sm ${
                              task.priority === 'high' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                              task.priority === 'medium' ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30' :
                              'bg-[#2A2A2A] text-[#AAAAAA]'
                            }`}>
                              {task.priority.toUpperCase()}
                            </span>
                            {task.recurring.type !== 'none' && (
                              <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm bg-[#1A1A1A] text-sky-300 border border-sky-500/30">
                                Lặp: {task.recurring.type}
                              </span>
                            )}
                            
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] text-xs">
                              <Clock className="w-3 h-3 text-[#D4AF37] shrink-0" />
                              <span className="text-[#888888] font-medium">Hạn chót chính thức:</span>
                              <span className="text-[#E0E0E0] font-semibold">
                                {formatOfficialDeadline(task.deadline)}
                              </span>
                            </div>

                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm border ${deadlineInfo.badgeClass}`}>
                              {deadlineInfo.label}
                            </span>
                          </div>
                          <h3 className="text-sm font-editorial-serif font-bold text-white mt-1.5 truncate">{task.title}</h3>
                          <p className="text-xs text-[#888888] mt-0.5 line-clamp-1 leading-relaxed">{task.description}</p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          onClick={() => openAiChatWithPrompt(`Cho tôi gợi ý thực hiện công việc: "${task.title}". Nội dung: ${task.description}`)}
                          className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-sm bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/30 hover:bg-[#D4AF37] hover:text-black transition-colors cursor-pointer"
                        >
                          Gợi ý AI
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Quick Notes & Google Drive Shortcuts */}
        <div className="space-y-6">
          {/* Quick Note Card */}
          <div className="border border-[#2A2A2A] bg-[#151515] rounded-sm p-5 space-y-3">
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
              {notes.length === 0 ? (
                <p className="text-xs text-[#666666] italic py-2">Chưa có ghi chú nào. Bấm "+ Thêm" để tạo.</p>
              ) : (
                notes.slice(0, 3).map(note => (
                <div
                  key={note.id}
                  onClick={() => setActiveTab('notes')}
                  className="p-3 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] hover:border-[#D4AF37]/50 transition-all cursor-pointer"
                >
                  <h4 className="text-xs font-editorial-serif font-bold text-white truncate">{note.title}</h4>
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

          {/* Drive Files Shortcut */}
          <div className="border border-[#2A2A2A] bg-[#151515] rounded-sm p-5 space-y-3">
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
                files.slice(0, 3).map(file => (
                <div
                  key={file.id}
                  className="p-2.5 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="p-1 rounded bg-[#1A1A1A] text-[#D4AF37] font-bold uppercase text-[9px] border border-[#2A2A2A]">
                      {file.category}
                    </span>
                    <span className="text-[#E0E0E0] font-medium truncate">{file.name}</span>
                  </div>
                  <span className="text-[10px] text-[#777777] shrink-0 font-mono">{(file.size / 1024).toFixed(0)} KB</span>
                </div>
              )))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
