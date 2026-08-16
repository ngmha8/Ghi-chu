import React, { useState, useMemo } from 'react';
import { Note, Task, DriveFile } from '../types/index.js';
import { X, FileText, Paperclip } from 'lucide-react';
import { TagAutocompleteInput } from './TagAutocompleteInput.js';

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (noteData: Partial<Note>) => void;
  tasks: Task[];
  files: DriveFile[];
  existingNotes?: Note[];
}

export const NoteModal: React.FC<NoteModalProps> = ({
  isOpen,
  onClose,
  onSave,
  tasks,
  files,
  existingNotes = [],
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

  // Collect all unique tags for suggestions
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    const defaults = ['Ghi chú', 'Kế hoạch', 'Ý tưởng', 'Cuộc họp', 'Tài liệu', 'Khảo sát', 'Dự án'];
    defaults.forEach(t => set.add(t));
    tasks.forEach(t => t.tags?.forEach(tag => tag && set.add(tag.trim())));
    existingNotes.forEach(n => n.tags?.forEach(tag => tag && set.add(tag.trim())));
    return Array.from(set).filter(Boolean);
  }, [tasks, existingNotes]);

  // Current tags array
  const currentTags = useMemo(() => {
    return tagsInput.split(',').map(t => t.trim()).filter(Boolean);
  }, [tagsInput]);

  const handleToggleTag = (tagToAdd: string) => {
    const exists = currentTags.some(t => t.toLowerCase() === tagToAdd.toLowerCase());
    if (exists) {
      const updated = currentTags.filter(t => t.toLowerCase() !== tagToAdd.toLowerCase());
      setTagsInput(updated.join(', '));
    } else {
      const updated = [...currentTags, tagToAdd];
      setTagsInput(updated.join(', '));
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const parsedTags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);

    onSave({
      title,
      content,
      tags: parsedTags,
      linkedTaskIds: selectedTaskIds,
      attachedFileIds: selectedFileIds,
      isPinned: false,
    });

    setTitle('');
    setContent('');
    setTagsInput('');
    setSelectedTaskIds([]);
    setSelectedFileIds([]);
    onClose();
  };

  const toggleTaskSelect = (taskId: string) => {
    if (selectedTaskIds.includes(taskId)) {
      setSelectedTaskIds(selectedTaskIds.filter(id => id !== taskId));
    } else {
      setSelectedTaskIds([...selectedTaskIds, taskId]);
    }
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
            <FileText className="w-5 h-5 text-[#D4AF37]" />
            <h2 className="text-base font-editorial-serif font-bold text-white">Tạo Ghi Chú Mới</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-sm text-[#888888] hover:text-white hover:bg-[#1A1A1A] transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[#E0E0E0] font-editorial-serif font-bold mb-1">Tiêu đề ghi chú (*)</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tiêu đề ghi chú..."
              className="w-full p-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] text-xs focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div>
            <label className="block text-[#E0E0E0] font-editorial-serif font-bold mb-1">Nội dung (Hỗ trợ Markdown)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Nhập nội dung ghi chú ở đây..."
              rows={6}
              className="w-full p-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] text-xs focus:outline-none focus:border-[#D4AF37] font-mono"
            />
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
              placeholder="vd: #Kế hoạch, #AI (gõ # để gợi ý danh sách)..."
            />
          </div>

          {/* Select Linked Tasks */}
          {tasks.length > 0 && (
            <div>
              <label className="block text-[#E0E0E0] font-editorial-serif font-bold mb-1">Liên kết Công việc (Task)</label>
              <div className="space-y-1 max-h-28 overflow-y-auto p-2 bg-[#0C0C0C] rounded-sm border border-[#2A2A2A]">
                {tasks.map(t => (
                  <label key={t.id} className="flex items-center gap-2 text-[#E0E0E0] cursor-pointer p-1 hover:bg-[#1A1A1A] rounded-sm">
                    <input
                      type="checkbox"
                      checked={selectedTaskIds.includes(t.id)}
                      onChange={() => toggleTaskSelect(t.id)}
                      className="accent-[#D4AF37] rounded-sm"
                    />
                    <span className="truncate">{t.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Select Attached Drive Files */}
          {files.length > 0 && (
            <div>
              <label className="block text-[#E0E0E0] font-editorial-serif font-bold mb-1">Đính kèm Tài liệu Google Drive</label>
              <div className="space-y-1 max-h-28 overflow-y-auto p-2 bg-[#0C0C0C] rounded-sm border border-[#2A2A2A]">
                {files.map(f => (
                  <label key={f.id} className="flex items-center gap-2 text-[#E0E0E0] cursor-pointer p-1 hover:bg-[#1A1A1A] rounded-sm">
                    <input
                      type="checkbox"
                      checked={selectedFileIds.includes(f.id)}
                      onChange={() => toggleFileSelect(f.id)}
                      className="accent-[#D4AF37] rounded-sm"
                    />
                    <Paperclip className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span className="truncate">{f.name}</span>
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
              Lưu Ghi Chú
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
