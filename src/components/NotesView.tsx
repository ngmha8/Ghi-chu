import React, { useState, useEffect, useMemo } from 'react';
import { Note, Task, DriveFile } from '../types/index.js';
import { TagSearchInput } from './TagSearchInput.js';
import { TagAutocompleteInput } from './TagAutocompleteInput.js';
import {
  FileText,
  Plus,
  Search,
  Pin,
  Tag,
  Paperclip,
  Check,
  Trash2,
  Sparkles,
  Eye,
  Code,
  Bold,
  Italic,
  List,
  Heading,
  Link,
  Save,
  RotateCcw,
  Calendar
} from 'lucide-react';

interface NotesViewProps {
  notes: Note[];
  tasks: Task[];
  files: DriveFile[];
  onNoteCreate: (note: Partial<Note>) => void;
  onNoteUpdate: (id: string, updates: Partial<Note>) => void;
  onNoteDelete: (id: string) => void;
  openAiChatWithPrompt: (prompt: string) => void;
  openNewNoteModal: () => void;
}

type NoteDateFilter = 'all' | '7days' | '30days';

export const NotesView: React.FC<NotesViewProps> = ({
  notes,
  tasks,
  files,
  onNoteUpdate,
  onNoteDelete,
  openAiChatWithPrompt,
  openNewNoteModal,
}) => {
  const [selectedNoteId, setSelectedNoteId] = useState<string>(notes[0]?.id || '');
  const [search, setSearch] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<NoteDateFilter>('all');
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const currentNote = notes.find(n => n.id === selectedNoteId) || notes[0];

  const [editorTitle, setEditorTitle] = useState(currentNote?.title || '');
  const [editorContent, setEditorContent] = useState(currentNote?.content || '');
  const [editorTags, setEditorTags] = useState(currentNote?.tags?.join(', ') || '');

  useEffect(() => {
    if (currentNote) {
      setEditorTitle(currentNote.title);
      setEditorContent(currentNote.content);
      setEditorTags(currentNote.tags.join(', '));
    }
  }, [selectedNoteId, currentNote?.id]);

  // Handle Save Note
  const handleSave = () => {
    if (!currentNote) return;
    setIsSaving(true);
    const parsedTags = editorTags.split(',').map(t => t.trim()).filter(Boolean);
    onNoteUpdate(currentNote.id, {
      title: editorTitle,
      content: editorContent,
      tags: parsedTags,
    });
    setTimeout(() => setIsSaving(false), 500);
  };

  // Insert markdown helpers
  const insertTextAtCursor = (prefix: string, suffix: string = '') => {
    setEditorContent(prev => `${prev}\n${prefix} Text ${suffix}`);
  };

  // Collect all unique tags across notes & tasks with counts
  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    notes.forEach(n => {
      n.tags?.forEach(tag => {
        const clean = tag.trim();
        if (clean) map.set(clean, (map.get(clean) || 0) + 1);
      });
    });
    return map;
  }, [notes]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    const defaults = ['Ghi chú', 'Kế hoạch', 'Ý tưởng', 'Cuộc họp', 'Tài liệu', 'Khảo sát', 'Dự án'];
    defaults.forEach(t => set.add(t));
    notes.forEach(n => n.tags?.forEach(tag => tag && set.add(tag.trim())));
    tasks?.forEach(t => t.tags?.forEach(tag => tag && set.add(tag.trim())));
    return Array.from(set).filter(Boolean);
  }, [notes, tasks]);

  const filteredNotes = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return notes.filter(note => {
      // Tag filter
      if (selectedTag !== 'all' && !note.tags.some(t => t.toLowerCase() === selectedTag.toLowerCase())) return false;

      // Date range filter
      const noteDate = new Date(note.updatedAt || note.createdAt);
      if (dateFilter === '7days' && noteDate < sevenDaysAgo) return false;
      if (dateFilter === '30days' && noteDate < thirtyDaysAgo) return false;

      // Search text
      if (search.trim()) {
        const q = search.toLowerCase();
        const tagQueries = q.match(/#([\w\p{L}]+)/gu)?.map(t => t.slice(1).toLowerCase()) || [];
        const nonTagQ = q.replace(/#([\w\p{L}]+)/gu, '').trim();

        const matchTitle = !nonTagQ || note.title.toLowerCase().includes(nonTagQ);
        const matchContent = !nonTagQ || note.content.toLowerCase().includes(nonTagQ);
        const matchText = matchTitle || matchContent;

        const matchAllTags = tagQueries.length === 0 || tagQueries.every(tq => 
          note.tags.some(t => t.toLowerCase().includes(tq))
        );

        const matchAnyTag = note.tags.some(t => t.toLowerCase().includes(q));

        return (matchText && matchAllTags) || matchAnyTag;
      }
      return true;
    });
  }, [notes, selectedTag, dateFilter, search]);

  const hasActiveFilters = selectedTag !== 'all' || dateFilter !== 'all' || search.trim() !== '';

  const handleResetFilters = () => {
    setSelectedTag('all');
    setDateFilter('all');
    setSearch('');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#151515] border border-[#2A2A2A] p-5 rounded-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-sm bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/30">
            <FileText className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div>
            <h1 className="text-xl font-editorial-serif font-bold text-white">Ghi chú thông minh (Smart Notes)</h1>
            <p className="text-xs text-[#888888] italic">Optimistic 0ms UI • Lọc đa chiều • Trình soạn Markdown & Vector Semantic Search</p>
          </div>
        </div>

        <button
          onClick={openNewNoteModal}
          className="px-4 py-2 rounded-sm bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Tạo Ghi Chú</span>
        </button>
      </div>

      {/* Main Split Layout: Left Notes Navigation, Right Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (4 cols): Notes List & Filter Engine */}
        <div className="lg:col-span-4 space-y-3">
          
          {/* Search & Tag Filter Box */}
          <div className="p-3.5 bg-[#151515] rounded-sm border border-[#2A2A2A] space-y-3">
            <TagSearchInput
              placeholder="Tìm ghi chú (gõ # để lọc tag)..."
              value={search}
              onChange={setSearch}
              availableTags={allTags}
            />

            {/* Date Range Selector */}
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#777777]">Thời gian:</span>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as NoteDateFilter)}
                className="px-2.5 py-1 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-xs text-[#E0E0E0] focus:outline-none focus:border-[#D4AF37]"
              >
                <option value="all">Tất cả thời gian</option>
                <option value="7days">7 ngày qua</option>
                <option value="30days">30 ngày qua</option>
              </select>
            </div>

            {/* Tag Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1 no-scrollbar border-t border-[#222222]">
              <button
                onClick={() => setSelectedTag('all')}
                className={`px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                  selectedTag === 'all' ? 'bg-[#D4AF37] text-black font-bold' : 'bg-[#0C0C0C] text-[#888888] border border-[#2A2A2A] hover:text-[#E0E0E0]'
                }`}
              >
                Tất cả ({notes.length})
              </button>
              {Array.from(tagCounts.entries()).map(([tag, count]) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? 'all' : tag)}
                  className={`px-2.5 py-1 rounded-sm text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer border ${
                    selectedTag === tag ? 'bg-[#D4AF37] text-black font-bold border-[#D4AF37]' : 'bg-[#0C0C0C] text-[#888888] border-[#2A2A2A] hover:text-[#E0E0E0]'
                  }`}
                >
                  <span>#{tag}</span>
                  <span className={`text-[9px] px-1 rounded-full ${selectedTag === tag ? 'bg-black/30 text-black' : 'bg-[#1A1A1A] text-[#666666]'}`}>
                    {count}
                  </span>
                </button>
              ))}
            </div>

            {/* Filter Count & Reset */}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-[#222222]">
              <span className="text-[#888888]">
                Hiển thị <strong className="text-[#D4AF37]">{filteredNotes.length}</strong> / {notes.length}
              </span>
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="text-[10px] text-[#AAAAAA] hover:text-rose-400 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Xóa bộ lọc</span>
                </button>
              )}
            </div>
          </div>

          {/* Notes Cards Stream */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredNotes.length === 0 ? (
              <div className="p-8 text-center rounded-sm bg-[#151515] border border-[#2A2A2A] text-xs text-[#777777]">
                Không có ghi chú nào khớp với bộ lọc.
              </div>
            ) : (
              filteredNotes.map(note => {
                const isSelected = note.id === selectedNoteId;

                return (
                  <div
                    key={note.id}
                    onClick={() => setSelectedNoteId(note.id)}
                    className={`p-3.5 rounded-sm border transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-[#1A1A1A] border-[#D4AF37]'
                        : 'bg-[#151515] border-[#2A2A2A] hover:border-[#333333]'
                    }`}
                  >
                    {note.isPinned && (
                      <Pin className="w-3.5 h-3.5 text-[#D4AF37] absolute top-3 right-3 fill-[#D4AF37]" />
                    )}

                    <h3 className="text-xs font-editorial-serif font-bold text-white pr-6 truncate">{note.title || 'Ghi chú chưa đặt tên'}</h3>
                    <p className="text-[11px] font-editorial-serif italic text-[#AAAAAA] line-clamp-2 mt-1 leading-relaxed">"{note.content || 'Nội dung trống...'}"</p>

                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[#2A2A2A]">
                      <span className="text-[10px] font-mono text-[#777777]">
                        {new Date(note.updatedAt).toLocaleDateString('vi-VN')}
                      </span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {note.tags.map((t, idx) => (
                          <span key={idx} className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-[#0C0C0C] text-[#888888] border border-[#2A2A2A]">
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column (8 cols): Editor Area */}
        <div className="lg:col-span-8 bg-[#151515] border border-[#2A2A2A] rounded-sm p-6 space-y-4">
          {currentNote ? (
            <>
              {/* Note Header & Save / AI Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2A2A2A] pb-4">
                <input
                  type="text"
                  value={editorTitle}
                  onChange={(e) => setEditorTitle(e.target.value)}
                  placeholder="Tiêu đề ghi chú..."
                  className="bg-transparent text-lg font-editorial-serif font-bold text-white focus:outline-none placeholder-[#555555] flex-1"
                />

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openAiChatWithPrompt(`Tóm tắt và trích xuất các ý chính, hành động cần làm từ ghi chú này: "${editorTitle}". Nội dung: ${editorContent}`)}
                    className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/30 hover:bg-[#D4AF37] hover:text-black transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">AI Tóm tắt</span>
                  </button>

                  <button
                    onClick={() => setIsPreviewMode(!isPreviewMode)}
                    className={`p-1.5 rounded-sm border transition-colors cursor-pointer ${
                      isPreviewMode ? 'bg-[#D4AF37] text-black border-[#D4AF37]' : 'bg-[#1A1A1A] text-[#E0E0E0] border-[#2A2A2A]'
                    }`}
                    title={isPreviewMode ? 'Chuyển sang chế độ Chỉnh sửa' : 'Xem trước Markdown'}
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-3 py-1.5 rounded-sm bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold text-xs uppercase tracking-widest flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {isSaving ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{isSaving ? 'Đã lưu' : 'Lưu'}</span>
                  </button>

                  <button
                    onClick={() => onNoteDelete(currentNote.id)}
                    className="p-1.5 rounded-sm bg-[#1A1A1A] border border-[#2A2A2A] hover:bg-rose-950/50 hover:border-rose-500 text-rose-400 transition-colors cursor-pointer"
                    title="Xóa ghi chú"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Markdown Helper Formatting Toolbar */}
              {!isPreviewMode && (
                <div className="flex items-center gap-1 bg-[#0C0C0C] p-1.5 rounded-sm border border-[#2A2A2A] overflow-x-auto">
                  <button
                    onClick={() => insertTextAtCursor('**', '**')}
                    className="p-1 text-[#888888] hover:text-white rounded-sm hover:bg-[#1A1A1A] cursor-pointer"
                    title="In đậm (Bold)"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => insertTextAtCursor('*', '*')}
                    className="p-1 text-[#888888] hover:text-white rounded-sm hover:bg-[#1A1A1A] cursor-pointer"
                    title="In nghiêng (Italic)"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => insertTextAtCursor('### ')}
                    className="p-1 text-[#888888] hover:text-white rounded-sm hover:bg-[#1A1A1A] cursor-pointer"
                    title="Tiêu đề H3"
                  >
                    <Heading className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => insertTextAtCursor('- ')}
                    className="p-1 text-[#888888] hover:text-white rounded-sm hover:bg-[#1A1A1A] cursor-pointer"
                    title="Danh sách gạch đầu dòng"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => insertTextAtCursor('```typescript\n', '\n```')}
                    className="p-1 text-[#888888] hover:text-white rounded-sm hover:bg-[#1A1A1A] cursor-pointer"
                    title="Khối mã (Code block)"
                  >
                    <Code className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Note Content Editor / Preview */}
              {isPreviewMode ? (
                <div className="min-h-[350px] p-4 bg-[#0C0C0C] rounded-sm border border-[#2A2A2A] text-sm text-[#D0D0D0] whitespace-pre-wrap leading-relaxed font-sans">
                  {editorContent || 'Chưa có nội dung...'}
                </div>
              ) : (
                <textarea
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                  placeholder="Viết nội dung ghi chú (hỗ trợ Markdown)..."
                  rows={14}
                  className="w-full bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm p-4 text-sm text-[#E0E0E0] focus:outline-none focus:border-[#D4AF37] font-mono leading-relaxed resize-y"
                />
              )}

              {/* Tags Autocomplete Input */}
              <div className="space-y-1.5 pt-2 border-t border-[#2A2A2A]">
                <label className="text-[10px] uppercase font-bold tracking-wider text-[#888888] flex items-center gap-1">
                  <Tag className="w-3 h-3 text-[#D4AF37]" />
                  <span>Thẻ phân loại (Tags)</span>
                </label>
                <TagAutocompleteInput
                  value={editorTags}
                  onChange={setEditorTags}
                  availableTags={allTags}
                  placeholder="Thêm thẻ (gõ # để gợi ý tag, cách nhau bởi dấu phẩy)..."
                />
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-[#777777]">
              Chọn hoặc tạo mới một ghi chú để bắt đầu soạn thảo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
