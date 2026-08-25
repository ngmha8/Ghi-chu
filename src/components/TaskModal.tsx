import React, { useState, useEffect, useMemo } from 'react';
import { Task, DriveFile, Note, RecurringType } from '../types/index.js';
import { X, CheckSquare, Paperclip } from 'lucide-react';
import { TagAutocompleteInput } from './TagAutocompleteInput.js';
import { VoiceInputButton } from './VoiceInputButton.tsx';

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
  const [tagsInput, setTagsInput] = useState('');
  const [recurringType, setRecurringType] = useState<RecurringType>('none');
  const [reminderOffset, setReminderOffset] = useState<number>(15);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

  // Collect all unique existing tags across tasks and notes
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    const defaults = ['Công việc', 'Báo cáo', 'Tài chính', 'Họp', 'Quan trọng', 'Khẩn cấp', 'Dự án', 'Cá nhân'];
    defaults.forEach(t => set.add(t));
    existingTasks.forEach(t => t.tags?.forEach(tag => tag && set.add(tag.trim())));
    existingNotes.forEach(n => n.tags?.forEach(tag => tag && set.add(tag.trim())));
    return Array.from(set).filter(Boolean);
  }, [existingTasks, existingNotes]);

  // Current entered tags array
  const currentTags = useMemo(() => {
    return tagsInput.split(',').map(t => t.trim()).filter(Boolean);
  }, [tagsInput]);

  // Quick toggle / add a tag
  const handleToggleTag = (tagToAdd: string) => {
    const exists = currentTags.some(t => t.toLowerCase() === tagToAdd.toLowerCase());
    if (exists) {
      // Remove tag
      const updated = currentTags.filter(t => t.toLowerCase() !== tagToAdd.toLowerCase());
      setTagsInput(updated.join(', '));
    } else {
      // Add tag
      const updated = [...currentTags, tagToAdd];
      setTagsInput(updated.join(', '));
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
      setTagsInput(initialTask.tags.join(', '));
      setRecurringType(initialTask.recurring?.type || 'none');
      setReminderOffset(initialTask.reminderOffsetMinutes || 15);
      setSelectedFileIds(initialTask.attachedFileIds || []);
    } else {
      setTitle('');
      setDescription('');
      const defaultDeadline = new Date(Date.now() + 24 * 3600 * 1000);
      const isoStr = new Date(defaultDeadline.getTime() - defaultDeadline.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setDeadline(isoStr);
      setPriority('medium');
      setStatus('todo');
      setTagsInput('Công việc');
      setRecurringType('none');
      setReminderOffset(15);
      setSelectedFileIds([]);
    }
  }, [initialTask, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const parsedTags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);

    onSave({
      title,
      description,
      deadline: new Date(deadline).toISOString(),
      priority,
      status,
      tags: parsedTags,
      recurring: { type: recurringType },
      reminderOffsetMinutes: reminderOffset,
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
      <div className="bg-[#151515] border border-[#2A2A2A] rounded-sm w-full max-w-lg p-6 space-y-4 shadow-2xl relative my-8">
        
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
              <label className="block text-[#E0E0E0] font-editorial-serif font-bold mb-1">Thời hạn (Deadline)</label>
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
              <label className="block text-[#E0E0E0] font-editorial-serif font-bold mb-1">Cấu hình Lặp lại (Recurring)</label>
              <select
                value={recurringType}
                onChange={(e) => setRecurringType(e.target.value as any)}
                className="w-full p-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] text-xs focus:outline-none focus:border-[#D4AF37]"
              >
                <option value="none" className="bg-[#151515]">Không lặp lại</option>
                <option value="hourly" className="bg-[#151515]">Theo giờ</option>
                <option value="daily" className="bg-[#151515]">Theo ngày</option>
                <option value="weekly" className="bg-[#151515]">Theo tuần</option>
                <option value="monthly" className="bg-[#151515]">Theo tháng</option>
              </select>
            </div>

            <div>
              <label className="block text-[#E0E0E0] font-editorial-serif font-bold mb-1">Nhắc nhở Telegram trước</label>
              <select
                value={reminderOffset}
                onChange={(e) => setReminderOffset(Number(e.target.value))}
                className="w-full p-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] text-xs focus:outline-none focus:border-[#D4AF37]"
              >
                <option value={15} className="bg-[#151515]">15 phút trước deadline</option>
                <option value={30} className="bg-[#151515]">30 phút trước deadline</option>
                <option value={60} className="bg-[#151515]">1 giờ trước deadline</option>
                <option value={120} className="bg-[#151515]">2 giờ trước deadline</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[#E0E0E0] font-editorial-serif font-bold">
                Tags (Gõ # để mở danh sách gợi ý & tìm kiếm)
              </label>
              <span className="text-[10px] text-[#888888] italic">
                Phân cách bằng dấu phẩy
              </span>
            </div>
            <TagAutocompleteInput
              value={tagsInput}
              onChange={setTagsInput}
              availableTags={availableTags}
              placeholder="vd: #Báo cáo, #Tài chính (gõ # để gợi ý danh sách)..."
            />
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
