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
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777777] pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          title={value ? `Đang tìm: ${value}` : undefined}
          placeholder={placeholder}
          className={`w-full pl-9 pr-10 py-2 bg-[#0C0C0C] hover:bg-[#111111] border border-[#2E2E2E] rounded-sm text-[13px] text-[#EDEDED] placeholder-[#666666] focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 transition-all ${inputClassName}`}
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
            className="absolute right-2.5 p-1 rounded-sm text-[#777777] hover:text-[#E0E0E0] hover:bg-[#222222] transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#121212] border border-[#D4AF37]/60 rounded-sm shadow-2xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-[#222222] animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-1.5 bg-[#181818] flex items-center justify-between text-[11px] text-[#A0A0A0] border-b border-[#2A2A2A]">
            <span className="flex items-center gap-1 font-medium text-[#D4AF37]">
              <Tag className="w-3 h-3 text-[#D4AF37]" />
              {searchQuery ? `Tìm tag: "${searchQuery}"` : 'Danh sách Tag gợi ý'}
            </span>
            <span className="text-[10px] text-[#777]">Dùng ↑ ↓ tự động lọc, Enter để chọn</span>
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
                        ? 'bg-[#D4AF37]/25 text-[#D4AF37] font-semibold border-l-2 border-[#D4AF37] pl-2.5'
                        : 'text-[#E0E0E0] hover:bg-[#1A1A1A]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[#D4AF37] font-bold">#</span>
                      <span>{tag}</span>
                    </div>
                    {isAlreadyInSearch && (
                      <span className="text-[10px] text-[#D4AF37] flex items-center gap-1 bg-[#D4AF37]/15 border border-[#D4AF37]/30 px-1.5 py-0.5 rounded">
                        <Check className="w-2.5 h-2.5" /> Đang lọc
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-3 py-3 text-xs text-[#888888] text-center flex flex-col items-center gap-1">
              <span>Không tìm thấy tag phù hợp</span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => insertTag(searchQuery)}
                  className="mt-1 text-[11px] text-[#D4AF37] hover:underline cursor-pointer flex items-center gap-1"
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
