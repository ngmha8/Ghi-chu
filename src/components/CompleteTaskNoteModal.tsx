import React, { useState, useEffect } from 'react';
import { Task, Note } from '../types/index.js';
import { api } from '../services/api.js';
import {
  Sparkles,
  CheckCircle2,
  FileText,
  Clock,
  Tag,
  ArrowRight,
  Loader2,
  X,
  Pin,
  Eye,
  Edit3,
  BookmarkPlus,
  AlertCircle
} from 'lucide-react';

interface CompleteTaskNoteModalProps {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void; // Dismiss without completing
  onCompleteOnly: (task: Task) => void; // Complete task without creating a note
  onConfirmSaveNote: (task: Task, noteData: {
    title: string;
    content: string;
    tags: string[];
    isPinned: boolean;
    linkedTaskIds: string[];
    attachedFileIds: string[];
  }) => Promise<void>; // Create note AND complete task
  availableTags?: string[];
}

type ModalStep = 'prompt' | 'generating' | 'review';

export const CompleteTaskNoteModal: React.FC<CompleteTaskNoteModalProps> = ({
  isOpen,
  task,
  onClose,
  onCompleteOnly,
  onConfirmSaveNote,
  availableTags = [],
}) => {
  const [step, setStep] = useState<ModalStep>('prompt');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Form state for review step
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [previewTab, setPreviewTab] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    if (isOpen && task) {
      setStep('prompt');
      setGenerationError(null);
      setIsSubmitting(false);
      setNoteTitle('');
      setNoteContent('');
      setNoteTags([]);
      setIsPinned(false);
      setPreviewTab('edit');
    }
  }, [isOpen, task?.id]);

  if (!isOpen || !task) return null;

  // Handler: Start AI Note Generation
  const handleStartAiGeneration = async () => {
    setStep('generating');
    setGenerationError(null);

    try {
      const res = await api.generateNoteFromTask(task.id, task);
      if (res && res.success && res.note) {
        setNoteTitle(res.note.title || `Tổng kết: ${task.title}`);
        setNoteContent(res.note.content || '');
        const combinedTags = Array.from(new Set([
          ...(res.note.tags || []),
          ...(task.tags || []),
          'tong-ket',
        ])).filter(Boolean);
        setNoteTags(combinedTags);
        setStep('review');
      } else {
        throw new Error('Không nhận được dữ liệu ghi chú từ AI');
      }
    } catch (err: any) {
      console.error('Error generating AI note from task:', err);
      setGenerationError(err?.message || 'Có lỗi xảy ra khi gọi AI');
      // Fallback draft so user can still create note
      setNoteTitle(`Tổng kết: ${task.title}`);
      setNoteContent(
        `### 🎯 Mục tiêu & Kết quả hoàn thành\n- Công việc: **${task.title}**\n- Phân loại: ${task.priority.toUpperCase()} - ${task.status}\n- Thời điểm hoàn tất: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}\n\n### 📝 Chi tiết thực hiện\n${task.description || 'Không có mô tả chi tiết.'}\n\n### 💡 Bài học kinh nghiệm & Đúc kết\n- Đã hoàn tất công việc theo mục tiêu đề ra.`
      );
      setNoteTags(['tong-ket', 'hoan-thanh', ...(task.tags || [])]);
      setStep('review');
    }
  };

  // Handler: Add Tag
  const handleAddTag = (tagToAdd: string) => {
    const clean = tagToAdd.trim().replace(/^#/, '');
    if (clean && !noteTags.includes(clean)) {
      setNoteTags(prev => [...prev, clean]);
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setNoteTags(prev => prev.filter(t => t !== tagToRemove));
  };

  // Handler: Confirm Note Save
  const handleConfirmSave = async () => {
    if (!noteTitle.trim()) return;
    setIsSubmitting(true);
    try {
      await onConfirmSaveNote(task, {
        title: noteTitle.trim(),
        content: noteContent.trim(),
        tags: noteTags,
        isPinned,
        linkedTaskIds: [task.id],
        attachedFileIds: task.attachedFileIds || [],
      });
      onClose();
    } catch (err) {
      console.error('Error confirming note save:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Complete Only
  const handleCompleteOnlyClick = () => {
    onCompleteOnly(task);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div
        className="w-full max-w-2xl bg-[#151515] border border-[#2A2A2A] rounded-sm shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-[#2A2A2A] flex items-center justify-between bg-[#111111]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-editorial-serif font-bold text-white tracking-wide">
                  {step === 'prompt' && 'Xác nhận hoàn thành công việc'}
                  {step === 'generating' && 'AI đang tổng hợp ghi chú đúc kết'}
                  {step === 'review' && 'Xác nhận tạo ghi chú từ công việc'}
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-sm bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#D4AF37]" />
                  <span>AI Assistant</span>
                </span>
              </div>
              <p className="text-xs text-[#888888] line-clamp-1 mt-0.5">
                {task.title}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#777777] hover:text-white rounded-sm hover:bg-[#222222] transition-colors cursor-pointer"
            title="Đóng mà không hoàn thành"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ======================================================== */}
        {/* STEP 1: PROMPT QUESTION */}
        {/* ======================================================== */}
        {step === 'prompt' && (
          <div className="p-6 space-y-6 overflow-y-auto">
            {/* Task Info Pill */}
            <div className="p-4 rounded-sm bg-[#0E0E0E] border border-[#262626] space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${
                  task.priority === 'high' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                  task.priority === 'medium' ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30' :
                  'bg-[#2A2A2A] text-[#AAAAAA]'
                }`}>
                  Ưu tiên: {task.priority.toUpperCase()}
                </span>

                <div className="flex items-center gap-1.5 text-xs text-[#888888]">
                  <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Hạn chót: {new Date(task.deadline).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>

              <h3 className="text-base font-editorial-serif font-bold text-white leading-snug">
                {task.title}
              </h3>

              {task.description && (
                <p className="text-xs text-[#999999] line-clamp-2 leading-relaxed">
                  {task.description}
                </p>
              )}

              {task.tags && task.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[#1C1C1C]">
                  {task.tags.map(t => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded-xs bg-[#1A1A1A] text-[#A0A0A0] border border-[#2A2A2A]">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Central Question Prompt */}
            <div className="p-5 rounded-sm bg-linear-to-b from-[#1C1A14] to-[#121210] border border-[#D4AF37]/40 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-sm bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center shrink-0 text-[#D4AF37]">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-editorial-serif font-bold text-white">
                    Bạn có muốn AI đúc kết và lưu thông tin công việc này vào Ghi chú không?
                  </h4>
                  <p className="text-xs text-[#BBBBBB] leading-relaxed">
                    Trợ lý Gemini AI sẽ tự động phân tích mục tiêu, tổng hợp kết quả đạt được, và rút ra các <strong className="text-[#D4AF37]">bài học đúc kết (Key Takeaways)</strong> để giúp bạn tích lũy tri thức lâu dài và tra cứu lại bất cứ lúc nào.
                  </p>
                </div>
              </div>

              <div className="text-[11px] text-[#888888] pl-12 flex items-center gap-2">
                <span>💡 Sau khi tạo, bạn sẽ được xem lại và xác nhận bản nháp trước khi lưu vào hệ thống.</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-[#222222]">
              <button
                type="button"
                onClick={handleCompleteOnlyClick}
                className="w-full sm:w-auto px-4 py-2.5 rounded-sm bg-[#1A1A1A] border border-[#2A2A2A] hover:bg-[#222222] hover:border-[#3A3A3A] text-[#CCCCCC] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Không, chỉ hoàn thành việc
              </button>

              <button
                type="button"
                onClick={handleStartAiGeneration}
                className="w-full sm:w-auto px-5 py-2.5 rounded-sm bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md hover:shadow-[#D4AF37]/20 cursor-pointer flex items-center justify-center gap-2 group"
              >
                <Sparkles className="w-4 h-4 text-black group-hover:rotate-12 transition-transform" />
                <span>Có, AI tạo ghi chú ngay</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 2: GENERATING STATE */}
        {/* ======================================================== */}
        {step === 'generating' && (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] animate-pulse">
                <Sparkles className="w-8 h-8 animate-spin-slow" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-t-[#D4AF37] border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
            </div>

            <div className="space-y-1.5 max-w-md">
              <h3 className="text-base font-editorial-serif font-bold text-white">
                Gemini AI đang phân tích dữ liệu công việc...
              </h3>
              <p className="text-xs text-[#888888] leading-relaxed">
                Đang tổng hợp mục tiêu đã đạt, rút trích nội dung mấu chốt, phân loại thẻ ngữ nghĩa và đúc kết kinh nghiệm thực tiễn...
              </p>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-[#666666] pt-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" />
              <span>Chỉ mất khoảng 1 - 2 giây...</span>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 3: REVIEW & CONFIRM NOTE CREATION */}
        {/* ======================================================== */}
        {step === 'review' && (
          <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
            {generationError && (
              <div className="p-3 rounded-sm bg-amber-950/30 border border-amber-800/60 flex items-center gap-2.5 text-xs text-amber-200">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Không thể kết nối Gemini AI trực tuyến, đã tạo bản nháp tổng hợp theo mẫu chuẩn.</span>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase font-bold text-[#A0A0A0] tracking-wider flex items-center gap-1.5">
                  <BookmarkPlus className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Tiêu đề ghi chú đúc kết</span>
                </label>
                <span className="text-[10px] text-[#777777]">Bản nháp do AI đề xuất</span>
              </div>
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Nhập tiêu đề ghi chú..."
                className="w-full px-3.5 py-2.5 rounded-sm bg-[#0E0E0E] border border-[#2A2A2A] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] text-white text-sm outline-hidden font-medium"
              />
            </div>

            {/* Tags Management */}
            <div className="space-y-2">
              <label className="text-xs uppercase font-bold text-[#A0A0A0] tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Thẻ phân loại (Tags)</span>
              </label>

              <div className="flex items-center gap-2 flex-wrap">
                {noteTags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm bg-[#1A1A1A] border border-[#2A2A2A] text-xs text-[#E0E0E0]"
                  >
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-[#777777] hover:text-rose-400 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}

                <div className="inline-flex items-center gap-1">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag(newTagInput);
                      }
                    }}
                    placeholder="+ Thêm thẻ..."
                    className="w-28 px-2 py-1 rounded-sm bg-[#0E0E0E] border border-[#2A2A2A] text-xs text-white outline-hidden focus:border-[#D4AF37]"
                  />
                  {newTagInput && (
                    <button
                      type="button"
                      onClick={() => handleAddTag(newTagInput)}
                      className="px-2 py-1 bg-[#222222] hover:bg-[#333333] text-xs text-white rounded-sm cursor-pointer"
                    >
                      Thêm
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Note Content Editor / Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-[#222222] pb-2">
                <label className="text-xs uppercase font-bold text-[#A0A0A0] tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Nội dung đúc kết (Markdown)</span>
                </label>

                <div className="flex items-center gap-1 bg-[#0E0E0E] p-0.5 rounded-sm border border-[#2A2A2A]">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('edit')}
                    className={`px-2.5 py-1 rounded-xs text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer ${
                      previewTab === 'edit' ? 'bg-[#D4AF37] text-black' : 'text-[#888888] hover:text-white'
                    }`}
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Chỉnh sửa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('preview')}
                    className={`px-2.5 py-1 rounded-xs text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer ${
                      previewTab === 'preview' ? 'bg-[#D4AF37] text-black' : 'text-[#888888] hover:text-white'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>Xem trước</span>
                  </button>
                </div>
              </div>

              {previewTab === 'edit' ? (
                <textarea
                  rows={9}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Nhập nội dung đúc kết..."
                  className="w-full px-3.5 py-2.5 rounded-sm bg-[#0E0E0E] border border-[#2A2A2A] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] text-[#DDDDDD] text-xs font-mono leading-relaxed outline-hidden resize-y"
                />
              ) : (
                <div className="w-full min-h-[180px] max-h-[300px] overflow-y-auto p-4 rounded-sm bg-[#0E0E0E] border border-[#2A2A2A] text-xs text-[#E0E0E0] space-y-2 whitespace-pre-wrap leading-relaxed font-sans">
                  {noteContent}
                </div>
              )}
            </div>

            {/* Pin note toggle */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-[#AAAAAA] hover:text-white">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="w-4 h-4 rounded-xs border-[#333333] bg-[#0E0E0E] text-[#D4AF37] focus:ring-[#D4AF37] cursor-pointer"
                />
                <Pin className={`w-3.5 h-3.5 ${isPinned ? 'text-[#D4AF37]' : 'text-[#666666]'}`} />
                <span>Ghim ghi chú này lên đầu danh sách</span>
              </label>

              <span className="text-[11px] text-[#666666]">
                Liên kết tự động tới Task ID: <code className="text-[#888888]">{task.id.slice(0, 8)}</code>
              </span>
            </div>

            {/* Actions Bar */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#222222]">
              <button
                type="button"
                onClick={handleCompleteOnlyClick}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-4 py-2.5 rounded-sm bg-[#1A1A1A] border border-[#2A2A2A] hover:bg-[#222222] text-[#999999] hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Bỏ qua ghi chú, chỉ hoàn thành task
              </button>

              <div className="w-full sm:w-auto flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep('prompt')}
                  disabled={isSubmitting}
                  className="w-1/2 sm:w-auto px-3.5 py-2.5 rounded-sm bg-[#1A1A1A] border border-[#2A2A2A] text-[#999999] hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Quay lại
                </button>

                <button
                  type="button"
                  onClick={handleConfirmSave}
                  disabled={isSubmitting || !noteTitle.trim()}
                  className="w-1/2 sm:w-auto px-5 py-2.5 rounded-sm bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-black" />
                      <span>Xác nhận tạo ghi chú</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
