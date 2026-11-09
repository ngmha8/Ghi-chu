import React, { useState, useEffect, useMemo } from 'react';
import { Note, Task, DriveFile } from '../types/index.js';
import { TagSearchInput } from './TagSearchInput.js';
import { TagAutocompleteInput } from './TagAutocompleteInput.js';
import { useNoteStore } from '../stores/useNoteStore.js';
import { useTaskStore } from '../stores/useTaskStore.js';
import { useFileStore } from '../stores/useFileStore.js';
import { useSystemStore } from '../stores/useSystemStore.js';
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
  Calendar,
  ArrowUpDown
} from 'lucide-react';

export interface NotesViewProps {
  notes?: Note[];
  tasks?: Task[];
  files?: DriveFile[];
  onNoteCreate?: (note: Partial<Note>) => void;
  onNoteUpdate?: (id: string, updates: Partial<Note>) => void;
  onNoteDelete?: (id: string) => void;
  openAiChatWithPrompt?: (prompt: string) => void;
  openNewNoteModal?: () => void;
}

type NoteDateFilter = 'all' | '7days' | '30days';
type NoteSortOrder = 'newest' | 'oldest' | 'title';

const getLocalIsoString = (date: Date = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const NotesView: React.FC<NotesViewProps> = ({
  notes: propNotes,
  tasks: propTasks,
  files: propFiles,
  onNoteCreate: propOnNoteCreate,
  onNoteUpdate: propOnNoteUpdate,
  onNoteDelete: propOnNoteDelete,
  openAiChatWithPrompt: propOpenAiChatWithPrompt,
  openNewNoteModal: propOpenNewNoteModal,
}) => {
  // Store slices
  const storeNotes = useNoteStore(s => s.notes);
  const storeCreateNote = useNoteStore(s => s.createNote);
  const storeUpdateNote = useNoteStore(s => s.updateNote);
  const storeDeleteNote = useNoteStore(s => s.deleteNote);
  const storeOpenNoteModal = useNoteStore(s => s.openNoteModal);

  const storeTasks = useTaskStore(s => s.tasks);
  const storeFiles = useFileStore(s => s.files);
  const storeOpenAiDrawer = useSystemStore(s => s.openAiDrawer);

  // Resolved values
  const notes = propNotes ?? storeNotes;
  const tasks = propTasks ?? storeTasks;
  const files = propFiles ?? storeFiles;
  const onNoteCreate = propOnNoteCreate ?? storeCreateNote;
  const onNoteUpdate = propOnNoteUpdate ?? storeUpdateNote;
  const onNoteDelete = propOnNoteDelete ?? storeDeleteNote;
  const openAiChatWithPrompt = propOpenAiChatWithPrompt ?? storeOpenAiDrawer;
  const openNewNoteModal = propOpenNewNoteModal ?? storeOpenNoteModal;
  const [selectedNoteId, setSelectedNoteId] = useState<string>(notes[0]?.id || '');
  const [search, setSearch] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<NoteDateFilter>('all');
  const [sortOrder, setSortOrder] = useState<NoteSortOrder>('newest');
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

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

  // Sắp xếp ghi chú: Mặc định gần nhất lên trên (ưu tiên ghi chú ghim)
  const filteredNotes = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const list = notes.filter(note => {
      // Tag filter
      if (selectedTag !== 'all' && !note.tags.some(t => t.toLowerCase() === selectedTag.toLowerCase())) return false;

      // Date range filter
      const noteDate = new Date(note.noteDate || note.createdAt || note.updatedAt);
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

    return list.sort((a, b) => {
      // 1. Ghi chú được ghim luôn xếp trên cùng
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;

      if (sortOrder === 'title') {
        return (a.title || '').localeCompare(b.title || '', 'vi');
      }

      const timeA = new Date(a.noteDate || a.createdAt || a.updatedAt || 0).getTime();
      const timeB = new Date(b.noteDate || b.createdAt || b.updatedAt || 0).getTime();

      if (sortOrder === 'oldest') {
        return timeA - timeB;
      }

      // 'newest' (Mặc định): Gần nhất lên trên
      return timeB - timeA;
    });
  }, [notes, selectedTag, dateFilter, search, sortOrder]);

  // Tự động chọn ghi chú đầu tiên (ghi chú mới nhất/gần nhất) nếu chưa chọn
  useEffect(() => {
    if ((!selectedNoteId || !notes.some(n => n.id === selectedNoteId)) && filteredNotes.length > 0) {
      setSelectedNoteId(filteredNotes[0].id);
    }
  }, [filteredNotes, notes, selectedNoteId]);

  const currentNote = useMemo(() => {
    return notes.find(n => n.id === selectedNoteId) || filteredNotes[0] || notes[0];
  }, [notes, selectedNoteId, filteredNotes]);

  const [editorTitle, setEditorTitle] = useState(currentNote?.title || '');
  const [editorContent, setEditorContent] = useState(currentNote?.content || '');
  const [editorTags, setEditorTags] = useState(currentNote?.tags?.join(', ') || '');
  const [editorNoteDate, setEditorNoteDate] = useState<string>('');

  useEffect(() => {
    if (currentNote) {
      setEditorTitle(currentNote.title);
      setEditorContent(currentNote.content);
      setEditorTags(currentNote.tags?.join(', ') || '');
      const rawDate = currentNote.noteDate || currentNote.createdAt;
      setEditorNoteDate(rawDate ? getLocalIsoString(new Date(rawDate)) : getLocalIsoString());
    }
  }, [selectedNoteId, currentNote?.id]);

  // Handle Save Note
  const handleSave = () => {
    if (!currentNote) return;
    setIsSaving(true);
    const parsedTags = editorTags.split(',').map(t => t.trim()).filter(Boolean);
    const isoDate = editorNoteDate ? new Date(editorNoteDate).toISOString() : currentNote.noteDate;
    onNoteUpdate(currentNote.id, {
      title: editorTitle,
      content: editorContent,
      tags: parsedTags,
      noteDate: isoDate,
      createdAt: isoDate,
    });
    setTimeout(() => setIsSaving(false), 500);
  };

  // Insert markdown helpers
  const insertTextAtCursor = (prefix: string, suffix: string = '') => {
    setEditorContent(prev => `${prev}\n${prefix} Text ${suffix}`);
  };

  const hasActiveFilters = selectedTag !== 'all' || dateFilter !== 'all' || search.trim() !== '';

  const handleResetFilters = () => {
    setSelectedTag('all');
    setDateFilter('all');
    setSearch('');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#152033] border border-slate-200 dark:border-[#22334D] p-5 rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 flex items-center">
              <FileText className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Ghi chú & Nhật ký Tri thức
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:border dark:border-blue-700/50 text-xs font-semibold">
              Knowledge Base
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Lưu trữ tài liệu, đúc kết bài học sau mỗi nhiệm vụ hoàn thành và đồng bộ tự động với Google Drive
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => openAiChatWithPrompt('Hãy phân tích tất cả các ghi chú hiện có và trích xuất 5 bài học cốt lõi.')}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#0E1522] dark:hover:bg-[#1A263D] dark:text-slate-200 dark:border dark:border-[#22334D] text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="hidden sm:inline">AI Trích xuất</span>
          </button>
          <button
            onClick={openNewNoteModal}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Tạo Ghi Chú Mới</span>
          </button>
        </div>
      </div>

      {/* 4 Stats Cards Metric Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white dark:bg-[#152033] p-4 rounded-xl shadow-xs border border-slate-200 dark:border-[#22334D] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase">
              TỔNG SỐ GHI CHÚ
            </span>
            <span className="text-xs font-bold text-slate-300 dark:text-slate-600">01</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{notes.length}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">ghi chú</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {notes.filter(n => n.tags?.some(t => t.toLowerCase().includes('hoàn') || t.toLowerCase().includes('đúc'))).length || 3} đúc kết
            </span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white dark:bg-[#152033] p-4 rounded-xl shadow-xs border border-slate-200 dark:border-[#22334D] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 tracking-wider uppercase">
              ĐÃ ĐỒNG BỘ DRIVE
            </span>
            <span className="text-xs font-bold text-slate-300 dark:text-slate-600">02</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{files.length} / {files.length}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">tệp lưu</span>
          </div>
          <div className="mt-2 text-xs text-sky-600 dark:text-sky-400 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
            <span>Vector Search Active</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white dark:bg-[#152033] p-4 rounded-xl shadow-xs border border-slate-200 dark:border-[#22334D] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 tracking-wider uppercase">
              TAGS PHỔ BIẾN
            </span>
            <span className="text-xs font-bold text-slate-300 dark:text-slate-600">03</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {allTags.slice(0, 3).map(tag => (
              <span key={tag} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#0E1522] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#22334D] font-mono text-[10px]">
                #{tag}
              </span>
            ))}
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {allTags.length} thẻ phân loại hoạt động
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white dark:bg-[#152033] p-4 rounded-xl shadow-xs border border-slate-200 dark:border-[#22334D] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 tracking-wider uppercase">
              ĐÚC KẾT & AI VECTOR
            </span>
            <span className="text-xs font-bold text-slate-300 dark:text-slate-600">04</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {tasks.length > 0 ? Math.min(100, Math.round((notes.length / tasks.length) * 100)) : 83}%
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">tri thức</span>
          </div>
          <div className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
            RAG Hybrid Firestore
          </div>
        </div>
      </div>

      {/* Main Split Layout: Left Notes Navigation, Right Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (4 cols): Notes List & Filter Engine */}
        <div className="lg:col-span-4 space-y-3">
          
          {/* Search & Tag Filter Box */}
          <div className="p-4 bg-white dark:bg-[#152033] rounded-2xl border border-slate-200 dark:border-[#22334D] space-y-3.5 shadow-xs">
            <TagSearchInput
              placeholder="Tìm ghi chú (gõ # để lọc tag)..."
              value={search}
              onChange={setSearch}
              availableTags={allTags}
            />

            {/* Date Range Selector */}
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Thời gian:</span>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as NoteDateFilter)}
                className="px-2.5 py-1 bg-white dark:bg-[#0E1522] border border-slate-200 dark:border-[#22334D] rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value="all" className="bg-white dark:bg-[#0E1522] text-slate-800 dark:text-slate-200">Tất cả thời gian</option>
                <option value="7days" className="bg-white dark:bg-[#0E1522] text-slate-800 dark:text-slate-200">7 ngày qua</option>
                <option value="30days" className="bg-white dark:bg-[#0E1522] text-slate-800 dark:text-slate-200">30 ngày qua</option>
              </select>
            </div>

            {/* Tag Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1 no-scrollbar border-t border-slate-100 dark:border-[#22334D]/60">
              <button
                onClick={() => setSelectedTag('all')}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                  selectedTag === 'all'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100 dark:bg-[#0E1522] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#22334D] hover:bg-slate-200 dark:hover:bg-[#1E2C44] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Tất cả ({notes.length})
              </button>
              {Array.from(tagCounts.entries()).map(([tag, count]) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? 'all' : tag)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer border ${
                    selectedTag === tag
                      ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-xs'
                      : 'bg-slate-100 dark:bg-[#0E1522] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#22334D] hover:bg-slate-200 dark:hover:bg-[#1E2C44] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>#{tag}</span>
                  <span className={`text-[9px] px-1 rounded-full font-mono ${selectedTag === tag ? 'bg-white/20 text-white font-bold' : 'bg-slate-200 dark:bg-[#1E2C44] text-slate-600 dark:text-slate-300'}`}>
                    {count}
                  </span>
                </button>
              ))}
            </div>

            {/* Filter Count, Sort Order Selector & Reset */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-slate-100 dark:border-[#22334D]/60">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">
                  Hiển thị <strong className="text-blue-600 dark:text-blue-400 font-bold">{filteredNotes.length}</strong> / {notes.length}
                </span>
                {hasActiveFilters && (
                  <button
                    onClick={handleResetFilters}
                    className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 cursor-pointer"
                    title="Xóa bộ lọc tìm kiếm & thẻ"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Xóa lọc</span>
                  </button>
                )}
              </div>

              {/* Bộ chọn sắp xếp ghi chú */}
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-[#0E1522] px-2 py-0.5 rounded-lg border border-slate-200 dark:border-[#22334D]">
                <ArrowUpDown className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">Xếp:</span>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as NoteSortOrder)}
                  className="bg-transparent text-[11px] text-blue-600 dark:text-blue-400 font-semibold focus:outline-none cursor-pointer"
                  title="Thứ tự sắp xếp ghi chú"
                >
                  <option value="newest" className="bg-white dark:bg-[#0E1522] text-slate-800 dark:text-slate-200">Gần nhất lên trên</option>
                  <option value="oldest" className="bg-white dark:bg-[#0E1522] text-slate-800 dark:text-slate-200">Cũ nhất trước</option>
                  <option value="title" className="bg-white dark:bg-[#0E1522] text-slate-800 dark:text-slate-200">Tiêu đề (A-Z)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notes Cards Stream */}
          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {filteredNotes.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white dark:bg-[#152033] border border-slate-200 dark:border-[#22334D] text-xs text-slate-500 dark:text-slate-400 shadow-xs">
                Không có ghi chú nào khớp với bộ lọc.
              </div>
            ) : (
              filteredNotes.map(note => {
                const isSelected = note.id === selectedNoteId;

                return (
                  <div
                    key={note.id}
                    onClick={() => setSelectedNoteId(note.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer relative shadow-2xs ${
                      isSelected
                        ? 'bg-blue-50/70 dark:bg-[#1A263D] border-2 border-blue-600 dark:border-blue-500 shadow-sm'
                        : 'bg-white dark:bg-[#152033] border-slate-200 dark:border-[#22334D] hover:border-blue-400 dark:hover:border-blue-500/60'
                    }`}
                  >
                    {note.isPinned && (
                      <Pin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 absolute top-3.5 right-3.5 fill-blue-600 dark:fill-blue-400" />
                    )}

                    <h3 className="text-sm font-sans font-bold text-slate-900 dark:text-slate-100 pr-6 truncate">{note.title || 'Ghi chú chưa đặt tên'}</h3>
                    <p className="text-xs font-sans italic text-slate-600 dark:text-slate-300 line-clamp-2 mt-1.5 leading-relaxed">&ldquo;{note.content || 'Nội dung trống...'}&rdquo;</p>

                    <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-slate-100 dark:border-[#22334D]/60">
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1" title="Thời gian ghi chú">
                        <Calendar className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>
                          {new Date(note.noteDate || note.createdAt || note.updatedAt).toLocaleString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {note.tags.map((t, idx) => (
                          <span key={idx} className="text-[10px] uppercase font-medium px-1.5 py-0.5 rounded bg-slate-50 dark:bg-[#0E1522] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#22334D]">
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
        <div className="lg:col-span-8 bg-white dark:bg-[#152033] border border-slate-200 dark:border-[#22334D] rounded-2xl p-6 space-y-4 shadow-xs">
          {currentNote ? (
            <>
              {/* Note Header & Save / AI Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-[#22334D] pb-4">
                <input
                  type="text"
                  value={editorTitle}
                  onChange={(e) => setEditorTitle(e.target.value)}
                  placeholder="Tiêu đề ghi chú..."
                  className="bg-transparent text-lg font-sans font-bold text-slate-900 dark:text-slate-100 focus:outline-none placeholder-slate-400 dark:placeholder-slate-500 flex-1 tracking-tight"
                />

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openAiChatWithPrompt(`Tóm tắt và trích xuất các ý chính, hành động cần làm từ ghi chú này: "${editorTitle}". Nội dung: ${editorContent}`)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-[#0E1522] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#22334D] hover:bg-slate-50 dark:hover:bg-[#1A263D] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span className="hidden sm:inline">AI TÓM TẮT</span>
                  </button>

                  <button
                    onClick={() => setIsPreviewMode(!isPreviewMode)}
                    className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                      isPreviewMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-[#0E1522] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#22334D] hover:bg-slate-50 dark:hover:bg-[#1A263D]'
                    }`}
                    title={isPreviewMode ? 'Chuyển sang chế độ Chỉnh sửa' : 'Xem trước Markdown'}
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    {isSaving ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{isSaving ? 'ĐÃ LƯU' : 'LƯU'}</span>
                  </button>

                  <button
                    onClick={() => onNoteDelete(currentNote.id)}
                    className="p-2 rounded-lg bg-white dark:bg-[#0E1522] border border-slate-200 dark:border-[#22334D] hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-300 dark:hover:border-rose-800 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                    title="Xóa ghi chú"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Note Time Meta Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 dark:bg-[#0E1522] px-3 py-2 rounded-lg border border-slate-200 dark:border-[#22334D] text-xs">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Thời gian ghi chú:</span>
                  <input
                    type="datetime-local"
                    value={editorNoteDate}
                    onChange={(e) => setEditorNoteDate(e.target.value)}
                    className="bg-white dark:bg-[#152033] border border-slate-200 dark:border-[#22334D] rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditorNoteDate(getLocalIsoString(new Date()))}
                    className="px-2 py-0.5 rounded text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
                    title="Đặt lại về thời điểm hiện tại"
                  >
                    Bây giờ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date();
                      today.setHours(8, 0, 0, 0);
                      setEditorNoteDate(getLocalIsoString(today));
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
                  >
                    Hôm nay (08:00)
                  </button>
                </div>
              </div>

              {/* Markdown Helper Formatting Toolbar */}
              {!isPreviewMode && (
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#0E1522] p-1.5 rounded-lg border border-slate-200 dark:border-[#22334D] overflow-x-auto text-slate-600 dark:text-slate-300">
                  <button
                    onClick={() => insertTextAtCursor('**', '**')}
                    className="p-1 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-[#1E2C44] cursor-pointer"
                    title="In đậm (Bold)"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => insertTextAtCursor('*', '*')}
                    className="p-1 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-[#1E2C44] cursor-pointer"
                    title="In nghiêng (Italic)"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => insertTextAtCursor('### ')}
                    className="p-1 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-[#1E2C44] cursor-pointer"
                    title="Tiêu đề H3"
                  >
                    <Heading className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => insertTextAtCursor('- ')}
                    className="p-1 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-[#1E2C44] cursor-pointer"
                    title="Danh sách gạch đầu dòng"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => insertTextAtCursor('```typescript\n', '\n```')}
                    className="p-1 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-[#1E2C44] cursor-pointer"
                    title="Khối mã (Code block)"
                  >
                    <Code className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Note Content Editor / Preview */}
              {isPreviewMode ? (
                <div className="min-h-[350px] p-4 bg-white dark:bg-[#0E1522] rounded-lg border border-slate-200 dark:border-[#22334D] text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed font-sans shadow-inner">
                  {editorContent || 'Chưa có nội dung...'}
                </div>
              ) : (
                <textarea
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                  placeholder="Viết nội dung ghi chú (hỗ trợ Markdown)..."
                  rows={14}
                  className="w-full bg-white dark:bg-[#0E1522] border border-slate-200 dark:border-[#22334D] rounded-lg p-4 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500/20 font-sans leading-relaxed resize-y shadow-2xs placeholder-slate-400 dark:placeholder-slate-500"
                />
              )}

              {/* Tags Autocomplete Input */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-[#22334D]">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-blue-600 dark:text-blue-400" />
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
            <div className="p-12 text-center text-slate-400 dark:text-slate-500">
              Chọn hoặc tạo mới một ghi chú để bắt đầu soạn thảo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
