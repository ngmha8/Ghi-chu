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
  Save
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
  }, [selectedNoteId]);

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

  // Collect all unique tags across notes & tasks
  const allTags = useMemo(() => {
    const set = new Set<string>();
    const defaults = ['Ghi chú', 'Kế hoạch', 'Ý tưởng', 'Cuộc họp', 'Tài liệu', 'Khảo sát', 'Dự án'];
    defaults.forEach(t => set.add(t));
    notes.forEach(n => n.tags?.forEach(tag => tag && set.add(tag.trim())));
    tasks?.forEach(t => t.tags?.forEach(tag => tag && set.add(tag.trim())));
    return Array.from(set).filter(Boolean);
  }, [notes, tasks]);

  const filteredNotes = notes.filter(note => {
    if (selectedTag !== 'all' && !note.tags.includes(selectedTag)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      // Handle #tag query
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
            <p className="text-xs text-[#888888] italic">Trình soạn thảo Markdown, tự động lưu & liên kết với công việc, tài liệu</p>
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
        
        {/* Left Column (4 cols): Notes List */}
        <div className="lg:col-span-4 space-y-3">
          {/* Search & Tag Filter */}
          <div className="p-3 bg-[#151515] rounded-sm border border-[#2A2A2A] space-y-2">
            <TagSearchInput
              placeholder="Tìm ghi chú (gõ # để lọc tag)..."
              value={search}
              onChange={setSearch}
              availableTags={allTags}
            />

            <div className="flex items-center gap-1.5 overflow-x-auto pt-1 no-scrollbar">
              <button
                onClick={() => setSelectedTag('all')}
                className={`px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                  selectedTag === 'all' ? 'bg-[#D4AF37] text-black' : 'bg-[#0C0C0C] text-[#888888] border border-[#2A2A2A] hover:text-[#E0E0E0]'
                }`}
              >
                Tất cả
              </button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                    selectedTag === tag ? 'bg-[#D4AF37] text-black' : 'bg-[#0C0C0C] text-[#888888] border border-[#2A2A2A] hover:text-[#E0E0E0]'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Notes Cards Stream */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredNotes.map(note => {
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
                    <div className="flex items-center gap-1">
                      {note.tags.map((t, idx) => (
                        <span key={idx} className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-[#0C0C0C] text-[#888888] border border-[#2A2A2A]">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column (8 cols): Editor Area */}
        <div className="lg:col-span-8 bg-[#151515] border border-[#2A2A2A] rounded-sm p-6 space-y-4">
          {currentNote ? (
            <>
              {/* Note Header & Save / AI Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2A2A2A] pb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onNoteUpdate(currentNote.id, { isPinned: !currentNote.isPinned })}
                    className={`p-1.5 rounded-sm border transition-all cursor-pointer ${
                      currentNote.isPinned ? 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/50' : 'bg-[#0C0C0C] text-[#888888] border-[#2A2A2A]'
                    }`}
                    title="Ghim ghi chú"
                  >
                    <Pin className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setIsPreviewMode(!isPreviewMode)}
                    className={`px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border transition-all cursor-pointer ${
                      isPreviewMode ? 'bg-[#D4AF37] text-black border-[#D4AF37]' : 'bg-[#0C0C0C] text-[#E0E0E0] border-[#2A2A2A]'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{isPreviewMode ? 'Sửa Code' : 'Xem Preview'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openAiChatWithPrompt(`Tóm tắt nội dung ghi chú này giúp tôi: "${currentNote.title}"\nNội dung: ${currentNote.content}`)}
                    className="px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/30 hover:bg-[#D4AF37] hover:text-black transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI Tóm tắt</span>
                  </button>

                  <button
                    onClick={handleSave}
                    className="px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider bg-[#D4AF37] hover:bg-[#c29f2e] text-black flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {isSaving ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{isSaving ? 'Đã lưu!' : 'Lưu Ghi Chú'}</span>
                  </button>

                  <button
                    onClick={() => onNoteDelete(currentNote.id)}
                    className="p-1.5 rounded-sm bg-[#0C0C0C] hover:bg-rose-950 hover:border-rose-500 text-rose-400 border border-[#2A2A2A] transition-colors cursor-pointer"
                    title="Xóa ghi chú"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Title & Tags Input */}
              <div className="space-y-2">
                <input
                  type="text"
                  value={editorTitle}
                  onChange={(e) => setEditorTitle(e.target.value)}
                  placeholder="Tiêu đề ghi chú..."
                  className="w-full text-xl font-editorial-serif font-bold text-white bg-transparent border-b border-[#2A2A2A] focus:border-[#D4AF37] pb-2 focus:outline-none"
                />

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#888888]">
                    <span className="flex items-center gap-1 font-editorial-serif font-bold text-[#E0E0E0]">
                      <Tag className="w-3.5 h-3.5 text-[#D4AF37]" /> Tags (Gõ # để gợi ý danh sách)
                    </span>
                    <span className="text-[10px] italic">Phân cách bằng dấu phẩy</span>
                  </div>
                  <TagAutocompleteInput
                    value={editorTags}
                    onChange={setEditorTags}
                    availableTags={allTags}
                    placeholder="Gõ # để gợi ý tag (vd: #AI, #Kế hoạch)..."
                  />
                </div>
              </div>

              {/* Markdown Formatting Quick Bar */}
              {!isPreviewMode && (
                <div className="flex items-center gap-1 p-1 bg-[#0C0C0C] rounded-sm border border-[#2A2A2A] text-[#AAAAAA]">
                  <button onClick={() => insertTextAtCursor('**', '**')} className="p-1.5 hover:bg-[#1A1A1A] hover:text-[#D4AF37] rounded-sm text-xs cursor-pointer" title="In đậm">
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => insertTextAtCursor('*', '*')} className="p-1.5 hover:bg-[#1A1A1A] hover:text-[#D4AF37] rounded-sm text-xs cursor-pointer" title="In nghiêng">
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => insertTextAtCursor('# ')} className="p-1.5 hover:bg-[#1A1A1A] hover:text-[#D4AF37] rounded-sm text-xs cursor-pointer" title="Tiêu đề H1">
                    <Heading className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => insertTextAtCursor('- ')} className="p-1.5 hover:bg-[#1A1A1A] hover:text-[#D4AF37] rounded-sm text-xs cursor-pointer" title="Danh sách">
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => insertTextAtCursor('```typescript\n', '\n```')} className="p-1.5 hover:bg-[#1A1A1A] hover:text-[#D4AF37] rounded-sm text-xs cursor-pointer" title="Khối Code">
                    <Code className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => insertTextAtCursor('[Tên link](', ')')} className="p-1.5 hover:bg-[#1A1A1A] hover:text-[#D4AF37] rounded-sm text-xs cursor-pointer" title="Chèn Link">
                    <Link className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Editor Textarea vs Preview Mode */}
              {isPreviewMode ? (
                <div className="p-4 bg-[#0C0C0C] rounded-sm border border-[#2A2A2A] min-h-[350px] text-[#E0E0E0] text-sm whitespace-pre-wrap font-editorial-serif leading-relaxed">
                  {editorContent}
                </div>
              ) : (
                <textarea
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                  placeholder="Nhập nội dung ghi chú ở đây (Hỗ trợ định dạng Markdown)..."
                  rows={14}
                  className="w-full p-4 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] text-sm focus:outline-none focus:border-[#D4AF37] font-mono leading-relaxed"
                />
              )}

              {/* Linked Tasks & Attachments Metadata Footer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#2A2A2A] text-xs">
                <div>
                  <span className="font-bold text-[#888888] uppercase text-[10px] tracking-wider block mb-1">Công việc liên kết:</span>
                  <div className="flex flex-wrap gap-1">
                    {tasks.filter(t => currentNote.linkedTaskIds?.includes(t.id)).length > 0 ? (
                      tasks.filter(t => currentNote.linkedTaskIds?.includes(t.id)).map(t => (
                        <span key={t.id} className="px-2 py-0.5 rounded-sm bg-[#1A1A1A] text-[#D4AF37] border border-[#2A2A2A]">
                          {t.title}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-[#666666] italic">Chưa liên kết công việc nào</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="font-bold text-[#888888] uppercase text-[10px] tracking-wider block mb-1">Tài liệu đính kèm:</span>
                  <div className="flex flex-wrap gap-1">
                    {files.filter(f => currentNote.attachedFileIds?.includes(f.id)).length > 0 ? (
                      files.filter(f => currentNote.attachedFileIds?.includes(f.id)).map(f => (
                        <span key={f.id} className="px-2 py-0.5 rounded-sm bg-[#1A1A1A] text-[#E0E0E0] border border-[#2A2A2A] flex items-center gap-1">
                          <Paperclip className="w-3 h-3 text-[#D4AF37]" />
                          <span>{f.name}</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-[#666666] italic">Chưa đính kèm tệp nào</span>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-[#777777] font-editorial-serif">
              Chọn hoặc tạo một ghi chú để bắt đầu soạn thảo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
