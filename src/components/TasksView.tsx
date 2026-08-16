import React, { useState, useMemo } from 'react';
import { Task, DriveFile, Note } from '../types/index.js';
import { TagSearchInput } from './TagSearchInput.js';
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
  Sparkles
} from 'lucide-react';

interface TasksViewProps {
  tasks: Task[];
  files: DriveFile[];
  notes: Note[];
  onTaskCreate: (task: Partial<Task>) => void;
  onTaskUpdate: (id: string, updates: Partial<Task>) => void;
  onTaskDelete: (id: string) => void;
  openAiChatWithPrompt: (prompt: string) => void;
  openNewTaskModal: () => void;
  editTask: (task: Task) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  notes,
  onTaskUpdate,
  onTaskDelete,
  openAiChatWithPrompt,
  openNewTaskModal,
  editTask,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'calendar'>('list');

  // Collect all unique available tags
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    const defaults = ['Công việc', 'Báo cáo', 'Tài chính', 'Họp', 'Quan trọng', 'Khẩn cấp', 'Dự án', 'Cá nhân'];
    defaults.forEach(t => set.add(t));
    tasks.forEach(t => t.tags?.forEach(tag => tag && set.add(tag.trim())));
    notes?.forEach(n => n.tags?.forEach(tag => tag && set.add(tag.trim())));
    return Array.from(set).filter(Boolean);
  }, [tasks, notes]);

  const filteredTasks = tasks.filter(task => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      // Handle #tag query
      const tagQueries = q.match(/#([\w\p{L}]+)/gu)?.map(t => t.slice(1).toLowerCase()) || [];
      const nonTagQ = q.replace(/#([\w\p{L}]+)/gu, '').trim();

      const matchTitle = !nonTagQ || task.title.toLowerCase().includes(nonTagQ);
      const matchDesc = !nonTagQ || task.description.toLowerCase().includes(nonTagQ);
      const matchText = matchTitle || matchDesc;

      const matchAllTags = tagQueries.length === 0 || tagQueries.every(tq => 
        task.tags.some(t => t.toLowerCase().includes(tq))
      );

      // Simple fallback if no explicit #
      const matchAnyTag = task.tags.some(t => t.toLowerCase().includes(q));

      return (matchText && matchAllTags) || matchAnyTag;
    }
    return true;
  });

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
            <p className="text-xs text-[#888888] italic">Theo dõi deadline, cài đặt lặp lại & nhắc nhở Telegram tự động</p>
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
              className={`px-3 py-1 text-xs uppercase font-bold tracking-wider rounded-sm transition-all cursor-pointer ${
                viewMode === 'calendar' ? 'bg-[#D4AF37] text-black' : 'text-[#888888] hover:text-[#E0E0E0]'
              }`}
            >
              Lịch Deadline
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

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#151515] p-3 rounded-sm border border-[#2A2A2A]">
        <div className="flex-1">
          <TagSearchInput
            placeholder="Lọc công việc theo từ khóa hoặc gõ # để chọn tag..."
            value={search}
            onChange={setSearch}
            availableTags={availableTags}
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-xs text-[#E0E0E0] focus:outline-none focus:border-[#D4AF37]"
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
            className="px-3 py-1.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-xs text-[#E0E0E0] focus:outline-none focus:border-[#D4AF37]"
          >
            <option value="all">Tất cả Độ ưu tiên</option>
            <option value="high">Ưu tiên Cao (High)</option>
            <option value="medium">Ưu tiên Trung bình (Medium)</option>
            <option value="low">Ưu tiên Thấp (Low)</option>
          </select>
        </div>
      </div>

      {/* 1. LIST VIEW MODE */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="p-12 text-center rounded-sm bg-[#151515] border border-[#2A2A2A]">
              <Clock className="w-8 h-8 text-[#666666] mx-auto mb-3" />
              <p className="text-[#E0E0E0] font-editorial-serif text-sm">Không tìm thấy công việc phù hợp.</p>
              <p className="text-xs text-[#777777] mt-1">Hãy tạo công việc mới hoặc điều chỉnh bộ lọc.</p>
            </div>
          ) : (
            filteredTasks.map(task => {
              const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'completed' && task.status !== 'canceled';

              return (
                <div
                  key={task.id}
                  className={`p-4 rounded-sm border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isOverdue
                      ? 'bg-rose-950/20 border-rose-900/60'
                      : task.status === 'completed'
                      ? 'bg-[#0C0C0C] border-[#2A2A2A] opacity-60'
                      : 'bg-[#151515] border-[#2A2A2A] hover:border-[#333333]'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={task.status === 'completed'}
                      onChange={(e) => onTaskUpdate(task.id, { status: e.target.checked ? 'completed' : 'todo' })}
                      className="mt-1 w-4 h-4 rounded-sm border-[#2A2A2A] bg-[#0C0C0C] text-[#D4AF37] focus:ring-[#D4AF37] cursor-pointer"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
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

                        {task.recurring.type !== 'none' && (
                          <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm bg-[#1A1A1A] text-sky-300 border border-sky-500/30 flex items-center gap-1">
                            <Repeat className="w-3 h-3" />
                            <span>Lặp: {task.recurring.type}</span>
                          </span>
                        )}

                        <span className={`text-xs ${isOverdue ? 'text-rose-400 font-semibold' : 'text-[#888888] italic'}`}>
                          ⏰ {new Date(task.deadline).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
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
                      onClick={() => openAiChatWithPrompt(`Phân tích và chia nhỏ công việc này thành các bước chi tiết: "${task.title}". Mô tả: ${task.description}`)}
                      className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-sm bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/30 hover:bg-[#D4AF37] hover:text-black transition-colors flex items-center gap-1 cursor-pointer"
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

      {/* 2. KANBAN BOARD VIEW MODE */}
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
              <div key={colStatus} className="p-4 rounded-sm bg-[#151515] border border-[#2A2A2A] space-y-3">
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
                      className="p-3 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] space-y-2 hover:border-[#D4AF37]/50 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm ${
                          task.priority === 'high' ? 'bg-rose-500/20 text-rose-300' : 'bg-[#1A1A1A] text-[#888888]'
                        }`}>
                          {task.priority.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-[#777777]">
                          {new Date(task.deadline).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <h4 className="text-xs font-editorial-serif font-bold text-white leading-snug">{task.title}</h4>
                      <p className="text-[11px] text-[#888888] line-clamp-2">{task.description}</p>
                      <div className="flex items-center justify-between pt-1 border-t border-[#2A2A2A]">
                        <button
                          onClick={() => editTask(task)}
                          className="text-[10px] font-bold uppercase text-[#D4AF37] hover:underline cursor-pointer"
                        >
                          Chi tiết
                        </button>
                        <select
                          value={task.status}
                          onChange={(e) => onTaskUpdate(task.id, { status: e.target.value as any })}
                          className="text-[10px] bg-[#1A1A1A] border border-[#2A2A2A] text-[#E0E0E0] rounded-sm px-1 py-0.5"
                        >
                          <option value="todo">Todo</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Done</option>
                          <option value="canceled">Canceled</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. CALENDAR TIMELINE VIEW MODE */}
      {viewMode === 'calendar' && (
        <div className="p-6 rounded-sm bg-[#151515] border border-[#2A2A2A] space-y-4">
          <div className="flex items-center gap-2 border-b border-[#2A2A2A] pb-3">
            <Calendar className="w-5 h-5 text-[#D4AF37]" />
            <h2 className="text-base font-editorial-serif font-bold text-white">Lịch Deadline & Lộ trình thực hiện</h2>
          </div>

          <div className="space-y-3">
            {filteredTasks.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()).map(task => (
              <div key={task.id} className="flex items-start gap-4 p-3 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A]">
                <div className="shrink-0 w-28 text-center p-2 rounded-sm bg-[#1A1A1A] border border-[#D4AF37]/30">
                  <span className="block text-xs font-bold text-[#D4AF37]">
                    {new Date(task.deadline).toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="block text-[10px] text-[#888888]">
                    {new Date(task.deadline).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-editorial-serif font-bold text-white">{task.title}</span>
                    <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-sm ${
                      task.priority === 'high' ? 'bg-rose-500/20 text-rose-300' : 'bg-[#1A1A1A] text-[#888888]'
                    }`}>
                      {task.priority}
                    </span>
                  </div>
                  <p className="text-xs text-[#888888]">{task.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
