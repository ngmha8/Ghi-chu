import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Task, Note, DriveFile } from '../types/index.js';
import {
  Search,
  CheckSquare,
  FileText,
  FolderSync,
  Tag,
  Hash,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileCode,
  FileImage,
  ExternalLink,
  X
} from 'lucide-react';

interface GlobalSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  tasks: Task[];
  notes: Note[];
  files: DriveFile[];
  availableTags?: string[];
  onSelectTask: (task: Task) => void;
  onSelectNote: (note: Note) => void;
  onSelectFile: (file: DriveFile) => void;
  placeholder?: string;
  className?: string;
}

type SearchItem =
  | { type: 'tag'; id: string; name: string }
  | { type: 'task'; id: string; data: Task }
  | { type: 'note'; id: string; data: Note }
  | { type: 'file'; id: string; data: DriveFile };

export const GlobalSearchInput: React.FC<GlobalSearchInputProps> = ({
  value,
  onChange,
  tasks,
  notes,
  files,
  availableTags = [],
  onSelectTask,
  onSelectNote,
  onSelectFile,
  placeholder = 'Tìm kiếm công việc, ghi chú, tài liệu (gõ # để gợi ý tag)...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [tagQuery, setTagQuery] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<(HTMLButtonElement | null)[]>([]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check if cursor is on a #tag query
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart || val.length;
    onChange(val);

    const textBeforeCursor = val.slice(0, cursorPos);
    const lastHashIdx = textBeforeCursor.lastIndexOf('#');

    if (lastHashIdx !== -1) {
      const q = textBeforeCursor.slice(lastHashIdx + 1);
      if (!/[\s]/.test(q)) {
        setTagQuery(q.toLowerCase());
        setIsOpen(true);
        setSelectedIndex(0);
        return;
      }
    }

    setTagQuery(null);
    setIsOpen(true);
    setSelectedIndex(0);
  };

  // Extract search queries
  const { isHashMode, rawQuery, cleanQuery, tagFilterQueries } = useMemo(() => {
    const q = value.trim().toLowerCase();
    const isHash = q.startsWith('#') || tagQuery !== null;
    const tags = q.match(/#([\w\p{L}]+)/gu)?.map(t => t.slice(1).toLowerCase()) || [];
    const clean = q.replace(/#([\w\p{L}]+)/gu, '').trim();

    return {
      isHashMode: isHash,
      rawQuery: q,
      cleanQuery: clean,
      tagFilterQueries: tags,
    };
  }, [value, tagQuery]);

  // Tag suggestions when in hashtag mode
  const matchingTags = useMemo(() => {
    if (!tagQuery && tagQuery !== '') return [];
    return availableTags.filter(t => t.toLowerCase().includes(tagQuery)).slice(0, 8);
  }, [availableTags, tagQuery]);

  // Filter Tasks
  const matchedTasks = useMemo(() => {
    if (!value.trim()) return [];
    return tasks.filter(task => {
      const titleMatch = !cleanQuery || task.title.toLowerCase().includes(cleanQuery);
      const descMatch = !cleanQuery || (task.description && task.description.toLowerCase().includes(cleanQuery));
      const textMatch = titleMatch || descMatch;

      const tagMatch =
        tagFilterQueries.length === 0 ||
        tagFilterQueries.every(tq => task.tags?.some(t => t.toLowerCase().includes(tq)));

      const fallbackMatch = task.tags?.some(t => t.toLowerCase().includes(rawQuery));

      return (textMatch && tagMatch) || fallbackMatch;
    }).slice(0, 6);
  }, [tasks, value, cleanQuery, tagFilterQueries, rawQuery]);

  // Filter Notes
  const matchedNotes = useMemo(() => {
    if (!value.trim()) return [];
    return notes.filter(note => {
      const titleMatch = !cleanQuery || note.title.toLowerCase().includes(cleanQuery);
      const contentMatch = !cleanQuery || note.content.toLowerCase().includes(cleanQuery);
      const textMatch = titleMatch || contentMatch;

      const tagMatch =
        tagFilterQueries.length === 0 ||
        tagFilterQueries.every(tq => note.tags?.some(t => t.toLowerCase().includes(tq)));

      const fallbackMatch = note.tags?.some(t => t.toLowerCase().includes(rawQuery));

      return (textMatch && tagMatch) || fallbackMatch;
    }).slice(0, 6);
  }, [notes, value, cleanQuery, tagFilterQueries, rawQuery]);

  // Filter Files
  const matchedFiles = useMemo(() => {
    if (!value.trim()) return [];
    return files.filter(file => {
      const nameMatch = !cleanQuery || file.name.toLowerCase().includes(cleanQuery);
      const catMatch = !cleanQuery || file.category.toLowerCase().includes(cleanQuery);

      const linkedTasks = tasks.filter(t => t.attachedFileIds?.includes(file.id));
      const linkedNotes = notes.filter(n => n.attachedFileIds?.includes(file.id));
      const fileTags = [
        ...linkedTasks.flatMap(t => t.tags || []),
        ...linkedNotes.flatMap(n => n.tags || []),
        file.category,
      ];

      const tagMatch =
        tagFilterQueries.length === 0 ||
        tagFilterQueries.every(tq => fileTags.some(t => t.toLowerCase().includes(tq)));

      const fallbackMatch = fileTags.some(t => t.toLowerCase().includes(rawQuery));

      return ((nameMatch || catMatch) && tagMatch) || fallbackMatch;
    }).slice(0, 6);
  }, [files, tasks, notes, value, cleanQuery, tagFilterQueries, rawQuery]);

  // Flatten items for keyboard navigation
  const flatItems: SearchItem[] = useMemo(() => {
    if (tagQuery !== null) {
      return matchingTags.map(t => ({ type: 'tag' as const, id: `tag-${t}`, name: t }));
    }

    const items: SearchItem[] = [];
    matchedTasks.forEach(t => items.push({ type: 'task', id: `task-${t.id}`, data: t }));
    matchedNotes.forEach(n => items.push({ type: 'note', id: `note-${n.id}`, data: n }));
    matchedFiles.forEach(f => items.push({ type: 'file', id: `file-${f.id}`, data: f }));
    return items;
  }, [tagQuery, matchingTags, matchedTasks, matchedNotes, matchedFiles]);

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && listRef.current[selectedIndex]) {
      listRef.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex, isOpen]);

  // Handle selecting an item
  const handleSelectItem = (item: SearchItem) => {
    if (item.type === 'tag') {
      const cleanTag = item.name.replace(/^#+/, '').trim();
      const cursorPos = inputRef.current?.selectionStart || value.length;
      const textBeforeCursor = value.slice(0, cursorPos);
      const lastHashIdx = textBeforeCursor.lastIndexOf('#');

      let newText = '';
      if (lastHashIdx !== -1) {
        const prefix = value.slice(0, lastHashIdx);
        const textAfterCursor = value.slice(cursorPos);
        const suffix = textAfterCursor.replace(/^[^\s]*/, '');
        newText = `${prefix}#${cleanTag} ${suffix}`.trimStart();
      } else {
        newText = `${value.trim()} #${cleanTag} `.trimStart();
      }

      onChange(newText);
      setTagQuery(null);
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    if (item.type === 'task') {
      onSelectTask(item.data);
      setIsOpen(false);
    } else if (item.type === 'note') {
      onSelectNote(item.data);
      setIsOpen(false);
    } else if (item.type === 'file') {
      onSelectFile(item.data);
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || flatItems.length === 0) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % flatItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + flatItems.length) % flatItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatItems[selectedIndex]) {
        handleSelectItem(flatItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const totalResultsCount = matchedTasks.length + matchedNotes.length + matchedFiles.length;

  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return <FolderSync className="w-4 h-4 text-[#D4AF37]" />;
    if (mimeType.includes('pdf')) return <FileText className="w-4 h-4 text-red-400" />;
    if (mimeType.includes('sheet') || mimeType.includes('csv') || mimeType.includes('excel'))
      return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
    if (mimeType.includes('image')) return <FileImage className="w-4 h-4 text-purple-400" />;
    if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('typescript'))
      return <FileCode className="w-4 h-4 text-blue-400" />;
    return <FileText className="w-4 h-4 text-[#D4AF37]" />;
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Input Row */}
      <div className="relative flex items-center">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#666666] pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2 bg-[#151515] border border-[#2A2A2A] rounded-sm text-xs text-[#E0E0E0] placeholder-[#666666] focus:outline-none focus:border-[#D4AF37] transition-all"
        />

        {value && (
          <div className="absolute right-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setTagQuery(null);
                inputRef.current?.focus();
              }}
              className="p-1 text-[#666666] hover:text-[#E0E0E0] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Global Results Dropdown */}
      {isOpen && (value.trim() || tagQuery !== null) && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#121212] border border-[#D4AF37]/60 rounded-sm shadow-2xl overflow-hidden max-h-[480px] overflow-y-auto divide-y divide-[#222222] animate-in fade-in slide-in-from-top-1 duration-150">
          
          {/* Header Summary */}
          <div className="px-3 py-2 bg-[#181818] flex items-center justify-between text-[11px] text-[#A0A0A0]">
            <span className="flex items-center gap-1.5 font-medium text-[#D4AF37]">
              <Search className="w-3.5 h-3.5 text-[#D4AF37]" />
              {tagQuery !== null
                ? `Gợi ý Tag: "${tagQuery || '#'}"`
                : `Kết quả tìm kiếm cho: "${value}"`}
            </span>
            <span className="text-[10px] text-[#777]">
              {tagQuery !== null
                ? `${matchingTags.length} tag`
                : `${totalResultsCount} kết quả`} • Dùng ↑ ↓ Enter
            </span>
          </div>

          {/* Hashtag Suggestion List Mode */}
          {tagQuery !== null && (
            <div className="py-1">
              {matchingTags.length > 0 ? (
                matchingTags.map((tag, idx) => {
                  const isSelected = flatItems[selectedIndex]?.id === `tag-${tag}`;
                  return (
                    <button
                      key={tag}
                      ref={el => { listRef.current[idx] = el; }}
                      type="button"
                      onClick={() => handleSelectItem({ type: 'tag', id: `tag-${tag}`, name: tag })}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#D4AF37]/20 text-[#D4AF37] font-semibold border-l-2 border-[#D4AF37]'
                          : 'text-[#E0E0E0] hover:bg-[#1A1A1A]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[#D4AF37] font-bold">#</span>
                        <span>{tag}</span>
                      </div>
                      <span className="text-[10px] text-[#888888]">Chèn tag</span>
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-3 text-xs text-[#888888] text-center">
                  Không tìm thấy tag phù hợp với &quot;#{tagQuery}&quot;
                </div>
              )}
            </div>
          )}

          {/* Regular Results Mode: Tasks, Notes, Files */}
          {tagQuery === null && (
            <div>
              {totalResultsCount === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-[#888888] flex flex-col items-center gap-2">
                  <AlertCircle className="w-6 h-6 text-[#666666]" />
                  <span>Không tìm thấy công việc, ghi chú hoặc tài liệu nào khớp với từ khóa.</span>
                  <span className="text-[11px] text-[#555555]">Thử tìm bằng tên không dấu, từ khóa chính hoặc gõ # để lọc theo tag.</span>
                </div>
              ) : (
                <div className="divide-y divide-[#1F1F1F]">
                  
                  {/* Tasks Section */}
                  {matchedTasks.length > 0 && (
                    <div className="py-1">
                      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#D4AF37] bg-[#161616] flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <CheckSquare className="w-3 h-3 text-[#D4AF37]" /> Công việc ({matchedTasks.length})
                        </span>
                        <span className="text-[9px] text-[#666]">Nhấn để mở & chỉnh sửa</span>
                      </div>
                      {matchedTasks.map(task => {
                        const itemIndex = flatItems.findIndex(i => i.id === `task-${task.id}`);
                        const isSelected = itemIndex === selectedIndex;

                        return (
                          <button
                            key={task.id}
                            ref={el => { listRef.current[itemIndex] = el; }}
                            type="button"
                            onClick={() => handleSelectItem({ type: 'task', id: `task-${task.id}`, data: task })}
                            onMouseEnter={() => setSelectedIndex(itemIndex)}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#D4AF37]/20 text-white font-medium border-l-2 border-[#D4AF37]'
                                : 'text-[#D0D0D0] hover:bg-[#1A1A1A]'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <span className="mt-0.5 shrink-0">
                                {task.status === 'completed' ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                                )}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium truncate text-[#EDEDED] flex items-center gap-2">
                                  <span>{task.title}</span>
                                  {task.priority === 'high' && (
                                    <span className="text-[9px] px-1 py-0.2 bg-red-900/40 text-red-300 border border-red-800/40 rounded shrink-0">
                                      Cao
                                    </span>
                                  )}
                                </div>
                                {task.description && (
                                  <p className="text-[11px] text-[#888888] truncate mt-0.5">
                                    {task.description}
                                  </p>
                                )}
                                {task.tags && task.tags.length > 0 && (
                                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                                    {task.tags.map(t => (
                                      <span key={t} className="text-[9px] bg-[#222222] text-[#A0A0A0] px-1.5 py-0.5 rounded">
                                        #{t}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <span className="text-[10px] text-[#777] shrink-0 flex items-center gap-1">
                              Mở task <ArrowRight className="w-3 h-3 text-[#D4AF37]" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Notes Section */}
                  {matchedNotes.length > 0 && (
                    <div className="py-1">
                      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#D4AF37] bg-[#161616] flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <FileText className="w-3 h-3 text-[#D4AF37]" /> Ghi chú ({matchedNotes.length})
                        </span>
                        <span className="text-[9px] text-[#666]">Nhấn để xem ghi chú</span>
                      </div>
                      {matchedNotes.map(note => {
                        const itemIndex = flatItems.findIndex(i => i.id === `note-${note.id}`);
                        const isSelected = itemIndex === selectedIndex;

                        return (
                          <button
                            key={note.id}
                            ref={el => { listRef.current[itemIndex] = el; }}
                            type="button"
                            onClick={() => handleSelectItem({ type: 'note', id: `note-${note.id}`, data: note })}
                            onMouseEnter={() => setSelectedIndex(itemIndex)}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#D4AF37]/20 text-white font-medium border-l-2 border-[#D4AF37]'
                                : 'text-[#D0D0D0] hover:bg-[#1A1A1A]'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <FileText className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium truncate text-[#EDEDED]">
                                  {note.title}
                                </div>
                                {note.content && (
                                  <p className="text-[11px] text-[#888888] truncate mt-0.5">
                                    {note.content.replace(/[#*`_]/g, '')}
                                  </p>
                                )}
                                {note.tags && note.tags.length > 0 && (
                                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                                    {note.tags.map(t => (
                                      <span key={t} className="text-[9px] bg-[#222222] text-[#A0A0A0] px-1.5 py-0.5 rounded">
                                        #{t}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <span className="text-[10px] text-[#777] shrink-0 flex items-center gap-1">
                              Xem ghi chú <ArrowRight className="w-3 h-3 text-[#D4AF37]" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Files Section */}
                  {matchedFiles.length > 0 && (
                    <div className="py-1">
                      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#D4AF37] bg-[#161616] flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <FolderSync className="w-3 h-3 text-[#D4AF37]" /> Tài liệu & Tệp ({matchedFiles.length})
                        </span>
                        <span className="text-[9px] text-[#666]">Nhấn để xem tệp</span>
                      </div>
                      {matchedFiles.map(file => {
                        const itemIndex = flatItems.findIndex(i => i.id === `file-${file.id}`);
                        const isSelected = itemIndex === selectedIndex;

                        return (
                          <button
                            key={file.id}
                            ref={el => { listRef.current[itemIndex] = el; }}
                            type="button"
                            onClick={() => handleSelectItem({ type: 'file', id: `file-${file.id}`, data: file })}
                            onMouseEnter={() => setSelectedIndex(itemIndex)}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#D4AF37]/20 text-white font-medium border-l-2 border-[#D4AF37]'
                                : 'text-[#D0D0D0] hover:bg-[#1A1A1A]'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <span className="mt-0.5 shrink-0">
                                {getFileIcon(file.mimeType)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium truncate text-[#EDEDED] flex items-center gap-2">
                                  <span>{file.name}</span>
                                  <span className="text-[9px] px-1.5 py-0.2 bg-[#222222] text-[#A0A0A0] rounded uppercase">
                                    {file.category}
                                  </span>
                                </div>
                                <div className="text-[10px] text-[#777] mt-0.5 flex items-center gap-2">
                                  {file.size && <span>{(file.size / 1024).toFixed(1)} KB</span>}
                                  {file.syncStatus === 'synced' && (
                                    <span className="text-emerald-400">Đã đồng bộ Drive</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <span className="text-[10px] text-[#777] shrink-0 flex items-center gap-1">
                              Xem tài liệu <ExternalLink className="w-3 h-3 text-[#D4AF37]" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
