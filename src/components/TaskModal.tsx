import React, { useState, useEffect, useMemo } from 'react';
import { Task, DriveFile, Note, RecurringType, RecurringUnit } from '../types/index.js';
import {
  X,
  CheckSquare,
  Paperclip,
  Repeat,
  Calendar,
  Clock,
  Sparkles,
  Bell,
  Tag,
  Plus,
  Check,
  Hash,
  Search,
} from 'lucide-react';
import { VoiceInputButton } from './VoiceInputButton.tsx';
import {
  normalizeRecurringRule,
  computeNextRecurringDeadline,
  getUnitLabel,
  formatDateTimeVi,
} from '../utils/recurring.js';

export type ReminderTimeUnit = 'day' | 'hour' | 'minute';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: Partial<Task>) => void;
  initialTask?: Task | null;
  files: DriveFile[];
  existingTasks?: Task[];
  existingNotes?: Note[];
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTask,
  files,
  existingTasks = [],
  existingNotes = [],
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [status, setStatus] = useState<Task['status']>('todo');
  
  // Tag Management State (Custom tags and existing tag selector)
  const [selectedTags, setSelectedTags] = useState<string[]>(['Công việc']);
  const [customTagInput, setCustomTagInput] = useState<string>('');
  const [customCreatedTags, setCustomCreatedTags] = useState<string[]>([]);
  const [tagSearchQuery, setTagSearchQuery] = useState<string>('');
  
  // Recurring state: Unit, Interval, and Auto-reschedule on completion
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurringUnit, setRecurringUnit] = useState<RecurringUnit>('month');
  const [recurringInterval, setRecurringInterval] = useState<number>(3);
  const [repeatOnComplete, setRepeatOnComplete] = useState<boolean>(true);

  // Flexible Reminder State: Unit (day / hour / minute) and value
  const [reminderUnit, setReminderUnit] = useState<ReminderTimeUnit>('minute');
  const [reminderValue, setReminderValue] = useState<number>(15);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

  // Collect all unique existing tags across tasks, notes, presets, and newly created custom tags
  const allAvailableTags = useMemo(() => {
    const set = new Set<string>();
    const defaults = [
      'Công việc',
      'Báo cáo',
      'Tài chính',
      'Họp',
      'Quan trọng',
      'Khẩn cấp',
      'Dự án',
      'Cá nhân',
      'Kế hoạch',
      'Khách hàng',
      'Nhân sự',
      'AI',
      'Hợp đồng',
      'Theo dõi',
    ];
    defaults.forEach(t => set.add(t));
    existingTasks.forEach(t => t.tags?.forEach(tag => tag && set.add(tag.trim().replace(/^#+/, ''))));
    existingNotes.forEach(n => n.tags?.forEach(tag => tag && set.add(tag.trim().replace(/^#+/, ''))));
    customCreatedTags.forEach(t => t && set.add(t.trim().replace(/^#+/, '')));
    selectedTags.forEach(t => t && set.add(t.trim().replace(/^#+/, '')));
    return Array.from(set).filter(Boolean);
  }, [existingTasks, existingNotes, customCreatedTags, selectedTags]);

  // Filter available tags for the quick palette
  const displayedAvailableTags = useMemo(() => {
    if (!tagSearchQuery.trim()) return allAvailableTags;
    const query = tagSearchQuery.toLowerCase().trim();
    return allAvailableTags.filter(tag => tag.toLowerCase().includes(query));
  }, [allAvailableTags, tagSearchQuery]);

  // Tag manipulation helpers
  const handleAddCustomTag = () => {
    if (!customTagInput.trim()) return;
    const newTags = customTagInput
      .split(',')
      .map(t => t.trim().replace(/^#+/, ''))
      .filter(Boolean);

    if (newTags.length === 0) return;

    setSelectedTags(prev => {
      const existingLower = new Set(prev.map(t => t.toLowerCase()));
      const toAdd = newTags.filter(t => !existingLower.has(t.toLowerCase()));
      return [...prev, ...toAdd];
    });

    setCustomCreatedTags(prev => {
      const existingLower = new Set(prev.map(t => t.toLowerCase()));
      const toAdd = newTags.filter(t => !existingLower.has(t.toLowerCase()));
      return [...prev, ...toAdd];
    });

    setCustomTagInput('');
  };

  const handleCustomTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleAddCustomTag();
    } else if (e.key === ',') {
      e.preventDefault();
      e.stopPropagation();
      handleAddCustomTag();
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedTags(prev => prev.filter(t => t.toLowerCase() !== tagToRemove.toLowerCase()));
  };

  const handleToggleTag = (tagToToggle: string) => {
    const isSelected = selectedTags.some(t => t.toLowerCase() === tagToToggle.toLowerCase());
    if (isSelected) {
      handleRemoveTag(tagToToggle);
    } else {
      setSelectedTags(prev => [...prev, tagToToggle]);
    }
  };

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title);
      setDescription(initialTask.description);
      // Format deadline to datetime-local input YYYY-MM-DDTHH:mm
      const d = new Date(initialTask.deadline);
      const isoStr = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setDeadline(isoStr);
      setPriority(initialTask.priority);
      setStatus(initialTask.status);
      
      const initialTags = Array.isArray(initialTask.tags)
        ? initialTask.tags.map(t => t.trim().replace(/^#+/, '')).filter(Boolean)
        : [];
      setSelectedTags(initialTags.length > 0 ? initialTags : ['Công việc']);
      setCustomTagInput('');
      setTagSearchQuery('');
      
      const norm = normalizeRecurringRule(initialTask.recurring);
      setIsRecurring(norm.isRecurring);
      setRecurringUnit(norm.unit);
      setRecurringInterval(norm.interval);
      setRepeatOnComplete(norm.repeatOnComplete);

      const offset = initialTask.reminderOffsetMinutes ?? 15;
      if (offset >= 1440 && offset % 1440 === 0) {
        setReminderUnit('day');
        setReminderValue(Math.max(1, offset / 1440));
      } else if (offset >= 60 && offset % 60 === 0) {
        setReminderUnit('hour');
        setReminderValue(Math.max(1, offset / 60));
      } else {
        setReminderUnit('minute');
        setReminderValue(Math.max(1, offset));
      }

      setSelectedFileIds(initialTask.attachedFileIds || []);
    } else {
      setTitle('');
      setDescription('');
      const defaultDeadline = new Date(Date.now() + 24 * 3600 * 1000);
      const isoStr = new Date(defaultDeadline.getTime() - defaultDeadline.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setDeadline(isoStr);
      setPriority('medium');
      setStatus('todo');
      setSelectedTags(['Công việc']);
      setCustomTagInput('');
      setTagSearchQuery('');
      setIsRecurring(false);
      setRecurringUnit('month');
      setRecurringInterval(3); // Default 3 months as user example
      setRepeatOnComplete(true);
      setReminderUnit('minute');
      setReminderValue(15);
      setSelectedFileIds([]);
    }
  }, [initialTask, isOpen]);

  // Total calculated offset in minutes for storage and scheduler
  const calculatedOffsetMinutes = useMemo(() => {
    const val = Math.max(1, Number(reminderValue) || 1);
    if (reminderUnit === 'day') return val * 1440;
    if (reminderUnit === 'hour') return val * 60;
    return val;
  }, [reminderUnit, reminderValue]);

  // Seamless switch between reminder units with smart value adaptation
  const handleSwitchReminderUnit = (newUnit: ReminderTimeUnit) => {
    if (newUnit === reminderUnit) return;
    const currentTotalMins = calculatedOffsetMinutes;
    setReminderUnit(newUnit);

    if (newUnit === 'day') {
      const days = Math.max(1, Math.round(currentTotalMins / 1440));
      setReminderValue(days);
    } else if (newUnit === 'hour') {
      const hours = Math.max(1, Math.round(currentTotalMins / 60));
      setReminderValue(hours);
    } else {
      setReminderValue(Math.max(1, Math.min(currentTotalMins, 1440)));
    }
  };

  // Live Calculation preview of exact alert timestamp
  const reminderNotificationPreview = useMemo(() => {
    if (!deadline) return null;
    try {
      const deadlineTime = new Date(deadline).getTime();
      if (isNaN(deadlineTime)) return null;

      const alertTime = new Date(deadlineTime - calculatedOffsetMinutes * 60 * 1000);
      const now = Date.now();
      const isPast = alertTime.getTime() <= now;

      const formattedAlertTime = alertTime.toLocaleString('vi-VN', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const unitLabel = reminderUnit === 'day' 
        ? `${reminderValue} ngày` 
        : reminderUnit === 'hour' 
          ? `${reminderValue} giờ` 
          : `${reminderValue} phút`;

      return {
        formattedAlertTime,
        unitLabel,
        isPast,
      };
    } catch {
      return null;
    }
  }, [deadline, calculatedOffsetMinutes, reminderUnit, reminderValue]);

  // Live Recurrence Preview calculation
  const recurrencePreview = useMemo(() => {
    if (!isRecurring || !deadline) return null;
    try {
      const d = new Date(deadline);
      if (isNaN(d.getTime())) return null;
      return computeNextRecurringDeadline(d, {
        type: 'interval',
        unit: recurringUnit,
        interval: recurringInterval,
        repeatOnComplete,
      });
    } catch {
      return null;
    }
  }, [isRecurring, deadline, recurringUnit, recurringInterval, repeatOnComplete]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // If there is any uncommitted text in customTagInput, include it
    let finalTagsList = [...selectedTags];
    if (customTagInput.trim()) {
      const pendingTags = customTagInput
        .split(',')
        .map(t => t.trim().replace(/^#+/, ''))
        .filter(Boolean);
      const existingLower = new Set(finalTagsList.map(t => t.toLowerCase()));
      pendingTags.forEach(t => {
        if (!existingLower.has(t.toLowerCase())) {
          finalTagsList.push(t);
        }
      });
    }

    const cleanedTags = Array.from(new Set(
      finalTagsList
        .map(t => t.trim().replace(/^#+/, ''))
        .filter(Boolean)
    ));

    const deadlineIso = new Date(deadline).toISOString();

    onSave({
      title,
      description,
      deadline: deadlineIso,
      priority,
      status,
      tags: cleanedTags,
      recurring: isRecurring
        ? {
            type: 'interval',
            unit: recurringUnit,
            interval: Math.max(1, Number(recurringInterval) || 1),
            repeatOnComplete,
            completedCycles: initialTask?.recurring?.completedCycles || 0,
            lastCompletedAt: initialTask?.recurring?.lastCompletedAt,
            originalDeadline: initialTask?.recurring?.originalDeadline || deadlineIso,
          }
        : { type: 'none' },
      reminderOffsetMinutes: calculatedOffsetMinutes,
      attachedFileIds: selectedFileIds,
    });

    onClose();
  };

  const toggleFileSelect = (fileId: string) => {
    if (selectedFileIds.includes(fileId)) {
      setSelectedFileIds(selectedFileIds.filter(id => id !== fileId));
    } else {
      setSelectedFileIds([...selectedFileIds, fileId]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#151515] border border-[#2A2A2A] rounded-sm w-full max-w-lg p-6 space-y-4 shadow-2xl relative my-8 max-h-[92vh] overflow-y-auto">
        
        <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-[#D4AF37]" />
            <h2 className="text-base font-editorial-serif font-bold text-white">
              {initialTask ? 'Chỉnh sửa công việc' : 'Tạo công việc mới'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-sm text-[#888888] hover:text-white hover:bg-[#1A1A1A] transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[#E0E0E0] font-editorial-serif font-bold">Tên công việc (*)</label>
              <VoiceInputButton
                size="sm"
                onTranscript={(text) => setTitle((prev) => (prev ? `${prev} ${text}` : text))}
                title="Đọc tên công việc bằng giọng nói"
              />
            </div>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập hoặc bấm micro đọc tên công việc..."
              className="w-full p-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] text-xs focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[#E0E0E0] font-editorial-serif font-bold">Mô tả công việc</label>
              <VoiceInputButton
                size="sm"
                onTranscript={(text) => setDescription((prev) => (prev ? `${prev} ${text}` : text))}
                title="Đọc mô tả công việc bằng giọng nói"
              />
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Chi tiết yêu cầu, ghi chú triển khai hoặc đọc bằng giọng nói..."
              rows={3}
              className="w-full p-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] text-xs focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[#E0E0E0] font-editorial-serif font-bold mb-1">⏰ Hạn chót chính thức (Deadline)</label>
              <input
                type="datetime-local"
                required
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full p-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] text-xs focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-[#E0E0E0] font-editorial-serif font-bold mb-1">Độ ưu tiên</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full p-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] text-xs focus:outline-none focus:border-[#D4AF37]"
              >
                <option value="low" className="bg-[#151515]">Thấp (Low)</option>
                <option value="medium" className="bg-[#151515]">Trung bình (Medium)</option>
                <option value="high" className="bg-[#151515]">Khẩn cấp (High)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[#E0E0E0] font-editorial-serif font-bold mb-1">
                Chu kỳ lặp lại (Recurring)
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm min-h-[38px] items-center">
                <label
                  className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xs cursor-pointer select-none transition-all ${
                    !isRecurring
                      ? 'bg-[#1E1E1E] text-white border border-[#3E3E3E] font-semibold'
                      : 'text-[#888888] hover:text-[#CCCCCC]'
                  }`}
                >
                  <input
                    type="radio"
                    name="recurring_toggle_choice"
                    checked={!isRecurring}
                    onChange={() => setIsRecurring(false)}
                    className="w-3.5 h-3.5 accent-[#D4AF37] cursor-pointer"
                  />
                  <span className="text-[11px] whitespace-nowrap">Không lặp lại</span>
                </label>

                <label
                  className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xs cursor-pointer select-none transition-all ${
                    isRecurring
                      ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/50 font-semibold'
                      : 'text-[#888888] hover:text-[#CCCCCC]'
                  }`}
                >
                  <input
                    type="radio"
                    name="recurring_toggle_choice"
                    checked={isRecurring}
                    onChange={() => setIsRecurring(true)}
                    className="w-3.5 h-3.5 accent-[#D4AF37] cursor-pointer"
                  />
                  <span className="text-[11px] whitespace-nowrap flex items-center gap-1">
                    <Repeat className="w-3 h-3 text-[#D4AF37]" />
                    <span>Lặp lại</span>
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-[#E0E0E0] font-editorial-serif font-bold mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Bell className="w-3 h-3 text-[#D4AF37]" />
                  <span>Báo trước Telegram</span>
                </span>
                <span className="text-[10px] text-[#D4AF37] font-sans font-bold">
                  {reminderUnit === 'day' ? `${reminderValue} ngày` : reminderUnit === 'hour' ? `${reminderValue} giờ` : `${reminderValue} phút`}
                </span>
              </label>

              {/* Mode switch pills: Theo Ngày | Theo Giờ | Theo Phút */}
              <div className="grid grid-cols-3 gap-1 p-0.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm">
                <button
                  type="button"
                  onClick={() => handleSwitchReminderUnit('day')}
                  className={`py-1 text-[11px] font-bold rounded-xs transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                    reminderUnit === 'day'
                      ? 'bg-[#D4AF37] text-black shadow-xs font-bold'
                      : 'text-[#888888] hover:text-white'
                  }`}
                >
                  <Calendar className="w-3 h-3" />
                  <span>Ngày</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchReminderUnit('hour')}
                  className={`py-1 text-[11px] font-bold rounded-xs transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                    reminderUnit === 'hour'
                      ? 'bg-[#D4AF37] text-black shadow-xs font-bold'
                      : 'text-[#888888] hover:text-white'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  <span>Giờ</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchReminderUnit('minute')}
                  className={`py-1 text-[11px] font-bold rounded-xs transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                    reminderUnit === 'minute'
                      ? 'bg-[#D4AF37] text-black shadow-xs font-bold'
                      : 'text-[#888888] hover:text-white'
                  }`}
                >
                  <span>Phút</span>
                </button>
              </div>
            </div>
          </div>

          {/* NHẮC NHỞ TELEGRAM CHI TIẾT & CHỌN MỐC LINH HOẠT */}
          <div className="p-3 bg-[#0F0F0F] border border-[#2A2A2A] rounded-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#E0E0E0] flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>
                  Tùy chỉnh thời gian báo trước ({reminderUnit === 'day' ? 'Số Ngày' : reminderUnit === 'hour' ? 'Số Giờ' : 'Số Phút'})
                </span>
              </span>
              <span className="text-[10px] text-zinc-400">
                Gửi trước: <strong className="text-[#D4AF37]">{reminderUnit === 'day' ? `${reminderValue} ngày` : reminderUnit === 'hour' ? `${reminderValue} giờ` : `${reminderValue} phút`}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2 relative">
                <input
                  type="number"
                  min={1}
                  max={reminderUnit === 'day' ? 365 : reminderUnit === 'hour' ? 8760 : 525600}
                  value={reminderValue}
                  onChange={(e) => setReminderValue(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full p-2 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] text-xs font-mono font-bold focus:outline-none focus:border-[#D4AF37]"
                  placeholder={`Nhập số ${reminderUnit === 'day' ? 'ngày' : reminderUnit === 'hour' ? 'giờ' : 'phút'}...`}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#888888] font-medium pointer-events-none">
                  {reminderUnit === 'day' ? 'ngày trước' : reminderUnit === 'hour' ? 'giờ trước' : 'phút trước'}
                </span>
              </div>

              <div>
                <select
                  value={reminderUnit}
                  onChange={(e) => handleSwitchReminderUnit(e.target.value as ReminderTimeUnit)}
                  className="w-full p-2 bg-[#141414] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] text-xs font-semibold focus:outline-none focus:border-[#D4AF37] cursor-pointer"
                >
                  <option value="day" className="bg-[#1A1A1A]">Đơn vị: Ngày</option>
                  <option value="hour" className="bg-[#1A1A1A]">Đơn vị: Giờ</option>
                  <option value="minute" className="bg-[#1A1A1A]">Đơn vị: Phút</option>
                </select>
              </div>
            </div>

            {/* Gợi ý mốc chọn nhanh theo đơn vị đang chọn */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[10px] text-[#777777] font-medium shrink-0">Mốc nhanh:</span>
              {reminderUnit === 'day' && (
                <>
                  {[1, 2, 3, 5, 7, 10, 14, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setReminderValue(d)}
                      className={`px-2 py-0.5 text-[10px] font-medium rounded-xs border transition-colors cursor-pointer ${
                        reminderValue === d
                          ? 'bg-[#D4AF37] text-black border-[#D4AF37] font-bold'
                          : 'bg-[#141414] border-[#2A2A2A] text-zinc-300 hover:text-white hover:border-[#444]'
                      }`}
                    >
                      {d} ngày
                    </button>
                  ))}
                </>
              )}
              {reminderUnit === 'hour' && (
                <>
                  {[1, 2, 3, 4, 6, 8, 12, 24, 48].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setReminderValue(h)}
                      className={`px-2 py-0.5 text-[10px] font-medium rounded-xs border transition-colors cursor-pointer ${
                        reminderValue === h
                          ? 'bg-[#D4AF37] text-black border-[#D4AF37] font-bold'
                          : 'bg-[#141414] border-[#2A2A2A] text-zinc-300 hover:text-white hover:border-[#444]'
                      }`}
                    >
                      {h} giờ
                    </button>
                  ))}
                </>
              )}
              {reminderUnit === 'minute' && (
                <>
                  {[10, 15, 30, 45, 60, 90, 120].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setReminderValue(m)}
                      className={`px-2 py-0.5 text-[10px] font-medium rounded-xs border transition-colors cursor-pointer ${
                        reminderValue === m
                          ? 'bg-[#D4AF37] text-black border-[#D4AF37] font-bold'
                          : 'bg-[#141414] border-[#2A2A2A] text-zinc-300 hover:text-white hover:border-[#444]'
                      }`}
                    >
                      {m} phút
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Trực quan hóa thời gian dự kiến gửi thông báo */}
            {reminderNotificationPreview && (
              <div className={`p-2 rounded-xs border flex items-center justify-between gap-2 text-[11px] ${
                reminderNotificationPreview.isPast
                  ? 'bg-amber-950/20 border-amber-800/40 text-amber-300'
                  : 'bg-[#141414] border-[#222222] text-[#A0A0A0]'
              }`}>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                  <span>
                    Dự kiến gửi: <strong className="text-white font-mono">{reminderNotificationPreview.formattedAlertTime}</strong>
                    {' '}(trước deadline <span className="text-[#D4AF37] font-semibold">{reminderNotificationPreview.unitLabel}</span>)
                  </span>
                </div>
                {reminderNotificationPreview.isPast && (
                  <span className="text-[10px] bg-amber-900/40 text-amber-200 px-1.5 py-0.5 rounded-xs border border-amber-700/50 shrink-0">
                    Sẽ gửi ngay khi lưu
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ADVANCED RECURRING CONFIGURATION PANEL */}
          {isRecurring && (
            <div className="p-3.5 bg-[#0F0F0F] border border-[#D4AF37]/40 rounded-sm space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-[#252525]">
                <div className="flex items-center gap-1.5 text-[#D4AF37] font-semibold text-xs">
                  <Repeat className="w-3.5 h-3.5" />
                  <span>Cài đặt Đơn vị & Khoảng thời gian Lặp lại</span>
                </div>
                <span className="text-[10px] text-[#888888] bg-[#1A1A1A] px-2 py-0.5 rounded-sm border border-[#2A2A2A]">
                  Tự động chuyển lịch khi Hoàn thành
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Chọn đơn vị tính thời gian */}
                <div>
                  <label className="block text-[#B0B0B0] font-medium mb-1">
                    1. Đơn vị tính thời gian (*)
                  </label>
                  <select
                    value={recurringUnit}
                    onChange={(e) => setRecurringUnit(e.target.value as RecurringUnit)}
                    className="w-full p-2 bg-[#181818] border border-[#333333] rounded-sm text-[#E0E0E0] text-xs focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="month" className="bg-[#181818]">Tháng (Months)</option>
                    <option value="day" className="bg-[#181818]">Ngày (Days)</option>
                    <option value="year" className="bg-[#181818]">Năm (Years)</option>
                    <option value="week" className="bg-[#181818]">Tuần (Weeks)</option>
                  </select>
                </div>

                {/* 2. Chọn khoảng thời gian lặp lại */}
                <div>
                  <label className="block text-[#B0B0B0] font-medium mb-1">
                    2. Khoảng thời gian lặp (*)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      required
                      value={recurringInterval}
                      onChange={(e) => setRecurringInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-24 p-2 bg-[#181818] border border-[#333333] rounded-sm text-[#E0E0E0] text-xs focus:outline-none focus:border-[#D4AF37] font-bold text-center"
                    />
                    <span className="text-xs text-[#E0E0E0] font-medium">
                      {getUnitLabel(recurringUnit, recurringInterval)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Presets based on chosen unit */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[10px] text-[#777777]">Chọn nhanh:</span>
                {recurringUnit === 'month' && (
                  <>
                    {[1, 2, 3, 6, 12].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setRecurringInterval(num)}
                        className={`text-[10px] px-2 py-0.5 rounded-sm transition-colors cursor-pointer border ${
                          recurringInterval === num
                            ? 'bg-[#D4AF37] text-black border-[#D4AF37] font-bold'
                            : 'bg-[#181818] text-[#AAAAAA] border-[#2A2A2A] hover:text-white hover:border-[#444444]'
                        }`}
                      >
                        {num === 3 ? '3 tháng (Quý)' : num === 6 ? '6 tháng (Bán niên)' : num === 12 ? '12 tháng (Năm)' : `${num} tháng`}
                      </button>
                    ))}
                  </>
                )}

                {recurringUnit === 'day' && (
                  <>
                    {[1, 3, 7, 14, 30, 90].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setRecurringInterval(num)}
                        className={`text-[10px] px-2 py-0.5 rounded-sm transition-colors cursor-pointer border ${
                          recurringInterval === num
                            ? 'bg-[#D4AF37] text-black border-[#D4AF37] font-bold'
                            : 'bg-[#181818] text-[#AAAAAA] border-[#2A2A2A] hover:text-white hover:border-[#444444]'
                        }`}
                      >
                        {num} ngày
                      </button>
                    ))}
                  </>
                )}

                {recurringUnit === 'year' && (
                  <>
                    {[1, 2, 3, 5].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setRecurringInterval(num)}
                        className={`text-[10px] px-2 py-0.5 rounded-sm transition-colors cursor-pointer border ${
                          recurringInterval === num
                            ? 'bg-[#D4AF37] text-black border-[#D4AF37] font-bold'
                            : 'bg-[#181818] text-[#AAAAAA] border-[#2A2A2A] hover:text-white hover:border-[#444444]'
                        }`}
                      >
                        {num} năm
                      </button>
                    ))}
                  </>
                )}

                {recurringUnit === 'week' && (
                  <>
                    {[1, 2, 4].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setRecurringInterval(num)}
                        className={`text-[10px] px-2 py-0.5 rounded-sm transition-colors cursor-pointer border ${
                          recurringInterval === num
                            ? 'bg-[#D4AF37] text-black border-[#D4AF37] font-bold'
                            : 'bg-[#181818] text-[#AAAAAA] border-[#2A2A2A] hover:text-white hover:border-[#444444]'
                        }`}
                      >
                        {num} tuần
                      </button>
                    ))}
                  </>
                )}
              </div>

              {/* Dynamic Recurrence Simulation Box */}
              {recurrencePreview && (
                <div className="p-2.5 bg-[#050505] border border-[#262626] rounded-sm space-y-1.5 text-[11px] leading-relaxed">
                  <div className="flex items-center gap-1.5 text-[#D4AF37] font-bold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Mô phỏng chu kỳ hoạt động:</span>
                  </div>
                  <div className="text-[#CCCCCC] pl-5 space-y-1">
                    <p>
                      • <strong className="text-white">Đợt hiện tại:</strong> Cảnh báo vào{' '}
                      <span className="text-[#E0E0E0] font-semibold">{formatDateTimeVi(deadline)}</span>{' '}
                      (Telegram gửi trước {reminderUnit === 'day' ? `${reminderValue} ngày` : reminderUnit === 'hour' ? `${reminderValue} giờ` : `${reminderValue} phút`}).
                    </p>
                    <p>
                      • <strong className="text-white">Sau khi nhấn Hoàn thành:</strong> Hệ thống sẽ tự động dời thời gian cảnh báo sang{' '}
                      <strong className="text-[#D4AF37] bg-[#D4AF37]/10 px-1 py-0.5 rounded-xs border border-[#D4AF37]/30">
                        {recurrencePreview.formattedNextDate}
                      </strong>{' '}
                      <span className="text-[#888888] font-medium">({recurrencePreview.summary})</span>, đồng thời đặt lại trạng thái chờ và kích hoạt lại lịch thông báo mới.
                    </p>
                  </div>
                </div>
              )}

              {/* Toggle: Auto repeat on complete */}
              <label className="flex items-center gap-2 text-[#CCCCCC] cursor-pointer pt-1 hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={repeatOnComplete}
                  onChange={(e) => setRepeatOnComplete(e.target.checked)}
                  className="accent-[#D4AF37] w-3.5 h-3.5 rounded-xs cursor-pointer"
                />
                <span className="text-[11px] font-medium">
                  Tự động chuyển thời gian cảnh báo sang chu kỳ tiếp theo sau khi nhấn Hoàn thành
                </span>
              </label>
            </div>
          )}

          {/* QUẢN LÝ THẺ TAGS: CHỌN TỪ THẺ CÓ SẴN HOẶC TẠO THẺ TÙY CHỈNH MỚI */}
          <div className="p-3.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm space-y-3">
            <div className="flex items-center justify-between border-b border-[#222222] pb-2">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#D4AF37]" />
                <label className="text-xs font-editorial-serif font-bold text-white tracking-wide">
                  Thẻ Phân Loại (Tags)
                </label>
                <span className="text-[10px] font-mono text-[#D4AF37] bg-[#D4AF37]/10 px-1.5 py-0.5 rounded-xs border border-[#D4AF37]/20">
                  {selectedTags.length} đã chọn
                </span>
              </div>
              {selectedTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTags([])}
                  className="text-[10px] text-[#888888] hover:text-rose-400 cursor-pointer transition-colors"
                >
                  Xóa tất cả
                </button>
              )}
            </div>

            {/* 1. Danh sách các thẻ đang chọn (Active Tags Badges) */}
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-[#777777] tracking-wider block">
                Thẻ áp dụng cho công việc:
              </span>
              {selectedTags.length === 0 ? (
                <div className="p-2.5 rounded-xs bg-[#141414] border border-dashed border-[#2A2A2A] text-center text-[#777777] text-[11px]">
                  Chưa có thẻ nào. Hãy chọn từ danh sách có sẵn bên dưới hoặc gõ thẻ mới.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 p-2 bg-[#141414] border border-[#222222] rounded-xs min-h-[38px] items-center">
                  {selectedTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-semibold shadow-xs animate-in fade-in"
                    >
                      <Hash className="w-3 h-3 opacity-70" />
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:bg-[#D4AF37]/30 text-[#D4AF37] hover:text-white rounded-xs p-0.5 transition-colors cursor-pointer"
                        title={`Gỡ thẻ #${tag}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Nhập thẻ tùy chỉnh mới (Add Custom Tag Input) */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] uppercase font-bold text-[#777777] tracking-wider block">
                Tạo thẻ tùy chỉnh mới:
              </span>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Hash className="w-3.5 h-3.5 text-[#666666] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={handleCustomTagKeyDown}
                    placeholder="Gõ tên thẻ mới (vd: Hợp đồng, Chiến dịch Q4, Khách hàng VIP)..."
                    className="w-full pl-8 pr-3 py-1.5 bg-[#141414] border border-[#2A2A2A] rounded-xs text-[#E0E0E0] text-xs focus:outline-none focus:border-[#D4AF37] placeholder:text-[#666666]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomTag}
                  disabled={!customTagInput.trim()}
                  className="px-3 py-1.5 bg-[#1E1E1E] hover:bg-[#D4AF37] text-[#CCCCCC] hover:text-black border border-[#333333] hover:border-[#D4AF37] rounded-xs text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm thẻ</span>
                </button>
              </div>
              <p className="text-[10px] text-[#666666] italic">
                * Nhấn <strong>Enter</strong> hoặc phím dấu phẩy (<strong>,</strong>) để thêm nhanh thẻ mới.
              </p>
            </div>

            {/* 3. Bảng chọn nhanh từ các thẻ có sẵn (Select from Existing Tags Palette) */}
            <div className="space-y-1.5 pt-1 border-t border-[#1F1F1F]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-[#777777] tracking-wider">
                  Chọn từ thẻ có sẵn trong hệ thống:
                </span>
                {allAvailableTags.length > 6 && (
                  <div className="relative w-36 sm:w-44">
                    <Search className="w-3 h-3 text-[#666666] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={tagSearchQuery}
                      onChange={(e) => setTagSearchQuery(e.target.value)}
                      placeholder="Lọc thẻ..."
                      className="w-full pl-6 pr-2 py-0.5 bg-[#141414] border border-[#2A2A2A] rounded-xs text-[#E0E0E0] text-[10px] focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-[#121212] border border-[#202020] rounded-xs">
                {displayedAvailableTags.length === 0 ? (
                  <span className="text-[11px] text-[#666666] italic p-1">
                    {tagSearchQuery ? 'Không tìm thấy thẻ phù hợp' : 'Không có thẻ nào'}
                  </span>
                ) : (
                  displayedAvailableTags.map((tag) => {
                    const isSelected = selectedTags.some(t => t.toLowerCase() === tag.toLowerCase());
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleToggleTag(tag)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xs text-[11px] font-medium border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#D4AF37] text-black border-[#D4AF37] font-bold shadow-xs'
                            : 'bg-[#181818] border-[#2A2A2A] text-[#AAAAAA] hover:text-white hover:border-[#444444]'
                        }`}
                        title={isSelected ? `Bấm để bỏ chọn thẻ #${tag}` : `Bấm để chọn thẻ #${tag}`}
                      >
                        {isSelected ? (
                          <Check className="w-3 h-3 stroke-[2.5]" />
                        ) : (
                          <Plus className="w-3 h-3 opacity-60" />
                        )}
                        <span>{tag}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Attach Google Drive File Checklist */}
          {files.length > 0 && (
            <div>
              <label className="block text-[#E0E0E0] font-editorial-serif font-bold mb-1">Đính kèm Tệp Google Drive</label>
              <div className="space-y-1 max-h-32 overflow-y-auto p-2 bg-[#0C0C0C] rounded-sm border border-[#2A2A2A]">
                {files.map(file => (
                  <label key={file.id} className="flex items-center gap-2 text-[#E0E0E0] cursor-pointer p-1 hover:bg-[#1A1A1A] rounded-sm">
                    <input
                      type="checkbox"
                      checked={selectedFileIds.includes(file.id)}
                      onChange={() => toggleFileSelect(file.id)}
                      className="accent-[#D4AF37] rounded-sm"
                    />
                    <Paperclip className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span className="truncate">{file.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#2A2A2A]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-sm bg-[#0C0C0C] hover:bg-[#1A1A1A] text-[#E0E0E0] text-xs font-bold uppercase tracking-wider border border-[#2A2A2A] transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-sm bg-[#D4AF37] hover:bg-[#c29f2e] text-black text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Lưu Công Việc
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

