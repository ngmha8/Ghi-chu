import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Tag, Hash, Check, X } from 'lucide-react';

interface TagSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  availableTags: string[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export const TagSearchInput: React.FC<TagSearchInputProps> = ({
  value,
  onChange,
  availableTags,
  placeholder = 'Tìm kiếm (gõ # để gợi ý tag)...',
  className = '',
  inputClassName = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hashPos, setHashPos] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart || val.length;
    onChange(val);

    const textBeforeCursor = val.slice(0, cursorPos);
    const lastHashIdx = textBeforeCursor.lastIndexOf('#');

    if (lastHashIdx !== -1) {
      const query = textBeforeCursor.slice(lastHashIdx + 1);
      if (!/[\s]/.test(query)) {
        setHashPos(lastHashIdx);
        setSearchQuery(query.toLowerCase());
        setIsOpen(true);
        setSelectedIndex(0);
        return;
      }
    }

    setIsOpen(false);
    setHashPos(null);
  };

  // Filtered tags for dropdown
  const filteredTags = useMemo(() => {
    if (!searchQuery) return availableTags;
    return availableTags.filter(t =>
      t.toLowerCase().includes(searchQuery)
    ).sort((a, b) => {
      const aStarts = a.toLowerCase().startsWith(searchQuery);
      const bStarts = b.toLowerCase().startsWith(searchQuery);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.localeCompare(b);
    });
  }, [availableTags, searchQuery]);

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && itemsRef.current[selectedIndex]) {
      itemsRef.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex, isOpen]);

  // Construct text when a tag is applied
  const buildTagText = (tagToInsert: string) => {
    const cleanTag = tagToInsert.replace(/^#+/, '').trim();
    const cursorPos = inputRef.current?.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const textAfterCursor = value.slice(cursorPos);

    if (hashPos !== null && hashPos >= 0) {
      const prefix = value.slice(0, hashPos);
      const suffix = textAfterCursor.replace(/^[^\s]*/, '');
      return `${prefix}#${cleanTag} ${suffix}`.trimStart();
    } else {
      return `${value.trim()} #${cleanTag} `.trimStart();
    }
  };

  // Live preview filter as user navigates without closing dropdown
  const applyLiveTagPreview = (tagToInsert: string) => {
    const newText = buildTagText(tagToInsert);
    onChange(newText);
  };

  // Insert tag and close dropdown
  const insertTag = (tagToInsert: string) => {
    const newText = buildTagText(tagToInsert);
    onChange(newText);
    setIsOpen(false);
    setSearchQuery('');
    setHashPos(null);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredTags.length === 0) {
      if (e.key === '#' && !isOpen) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (selectedIndex + 1) % filteredTags.length;
      setSelectedIndex(nextIndex);
      if (filteredTags[nextIndex]) {
        applyLiveTagPreview(filteredTags[nextIndex]);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (selectedIndex - 1 + filteredTags.length) % filteredTags.length;
      setSelectedIndex(prevIndex);
      if (filteredTags[prevIndex]) {
        applyLiveTagPreview(filteredTags[prevIndex]);
      }
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (filteredTags[selectedIndex]) {
        e.preventDefault();
        insertTag(filteredTags[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative flex items-center w-full">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          title={value ? `Đang tìm: ${value}` : undefined}
          placeholder={placeholder}
          className={`w-full pl-9 pr-10 py-2 bg-slate-50 dark:bg-[#0E1522] hover:bg-slate-100 dark:hover:bg-[#131D2E] border border-slate-200 dark:border-[#22334D] rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all ${inputClassName}`}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setIsOpen(false);
              setSearchQuery('');
              setHashPos(null);
              inputRef.current?.focus();
            }}
            title="Xóa tìm kiếm"
            className="absolute right-2.5 p-1 rounded text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#1E2C44] transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#152033] border border-slate-200 dark:border-[#22334D] rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-[#22334D]/60 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-1.5 bg-slate-50 dark:bg-[#0E1522] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-[#22334D]">
            <span className="flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400">
              <Tag className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              {searchQuery ? `Tìm tag: "${searchQuery}"` : 'Danh sách Tag gợi ý'}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">Dùng ↑ ↓ để chọn, Enter xác nhận</span>
          </div>

          {filteredTags.length > 0 ? (
            <div className="py-1">
              {filteredTags.map((tag, idx) => {
                const isHighlighted = idx === selectedIndex;
                const isAlreadyInSearch = value.toLowerCase().includes(`#${tag.toLowerCase()}`) || value.toLowerCase().includes(tag.toLowerCase());

                return (
                  <button
                    key={tag}
                    ref={el => { itemsRef.current[idx] = el; }}
                    type="button"
                    onClick={() => insertTag(tag)}
                    onMouseEnter={() => {
                      setSelectedIndex(idx);
                      applyLiveTagPreview(tag);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      isHighlighted
                        ? 'bg-blue-50 dark:bg-[#1A263D] text-blue-600 dark:text-blue-400 font-semibold border-l-2 border-blue-600 dark:border-blue-500 pl-2.5'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1A263D]/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600 dark:text-blue-400 font-bold">#</span>
                      <span>{tag}</span>
                    </div>
                    {isAlreadyInSearch && (
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 px-1.5 py-0.5 rounded">
                        <Check className="w-2.5 h-2.5" /> Đang lọc
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400 text-center flex flex-col items-center gap-1">
              <span>Không tìm thấy tag phù hợp</span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => insertTag(searchQuery)}
                  className="mt-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Tag className="w-3 h-3" /> Lọc theo: <b>#{searchQuery}</b>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
