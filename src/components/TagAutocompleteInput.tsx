import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Tag, Check, Hash } from 'lucide-react';

interface TagAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  availableTags: string[];
  placeholder?: string;
  className?: string;
}

export const TagAutocompleteInput: React.FC<TagAutocompleteInputProps> = ({
  value,
  onChange,
  availableTags,
  placeholder = 'Nhập tag (gõ # để gợi ý danh sách)...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hashTriggerPos, setHashTriggerPos] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse existing tags list from input string
  const currentTags = useMemo(() => {
    return value
      .split(',')
      .map(t => t.trim().replace(/^#+/, ''))
      .filter(Boolean);
  }, [value]);

  // Close dropdown when clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Detect # typing or keyword typing after last comma or #
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart || val.length;
    onChange(val);

    // Find if user is typing with # prefix or inside a segment
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastHashIdx = textBeforeCursor.lastIndexOf('#');

    if (lastHashIdx !== -1) {
      const query = textBeforeCursor.slice(lastHashIdx + 1);
      // Check if there are no spaces or commas between hash and cursor
      if (!/[\s,]/.test(query)) {
        setHashTriggerPos(lastHashIdx);
        setSearchQuery(query.toLowerCase());
        setIsOpen(true);
        setSelectedIndex(0);
        return;
      }
    }

    // Also show dropdown if typing after a comma or beginning
    const lastCommaIdx = textBeforeCursor.lastIndexOf(',');
    const currentSegment = (lastCommaIdx !== -1 ? textBeforeCursor.slice(lastCommaIdx + 1) : textBeforeCursor).trim();
    if (currentSegment.length > 0) {
      setHashTriggerPos(lastCommaIdx !== -1 ? lastCommaIdx + 1 : 0);
      setSearchQuery(currentSegment.replace(/^#+/, '').toLowerCase());
      setIsOpen(true);
      setSelectedIndex(0);
    } else {
      setIsOpen(false);
    }
  };

  // Filtered and sorted tags based on query
  const filteredTags = useMemo(() => {
    if (!searchQuery) return availableTags;
    return availableTags.filter(tag =>
      tag.toLowerCase().includes(searchQuery)
    ).sort((a, b) => {
      const aStarts = a.toLowerCase().startsWith(searchQuery);
      const bStarts = b.toLowerCase().startsWith(searchQuery);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.localeCompare(b);
    });
  }, [availableTags, searchQuery]);

  // Insert selected tag into input text
  const insertTag = (tagToInsert: string) => {
    const cleanTagName = tagToInsert.replace(/^#+/, '').trim();
    const cursorPos = inputRef.current?.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const textAfterCursor = value.slice(cursorPos);

    let newText = '';
    if (hashTriggerPos !== null && hashTriggerPos >= 0) {
      const prefix = value.slice(0, hashTriggerPos);
      const endsWithComma = prefix.trimEnd().endsWith(',');
      const formattedPrefix = endsWithComma ? `${prefix.trimEnd()} ` : prefix.length > 0 && !prefix.endsWith(' ') && !prefix.endsWith(',') ? `${prefix.trimEnd()}, ` : prefix;
      const suffix = textAfterCursor.replace(/^[^,]*(\s*,\s*|$)/, '');
      newText = `${formattedPrefix}${cleanTagName}${suffix ? `, ${suffix}` : ', '}`;
    } else {
      // Append tag
      const existing = currentTags.filter(t => t.toLowerCase() !== cleanTagName.toLowerCase());
      newText = [...existing, cleanTagName].join(', ') + ', ';
    }

    onChange(newText);
    setIsOpen(false);
    setSearchQuery('');
    setHashTriggerPos(null);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 50);
  };

  // Keyboard navigation (ArrowDown, ArrowUp, Enter, Escape, Tab)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredTags.length === 0) {
      if (e.key === '#' && !isOpen) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredTags.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredTags.length) % filteredTags.length);
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
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (value.includes('#') || searchQuery) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          className={`w-full p-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] text-xs focus:outline-none focus:border-[#D4AF37] ${className}`}
        />
      </div>

      {/* Dropdown Popup List */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#121212] border border-[#D4AF37]/50 rounded-sm shadow-2xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-[#222222] animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-1.5 bg-[#181818] flex items-center justify-between text-[11px] text-[#A0A0A0] border-b border-[#2A2A2A]">
            <span className="flex items-center gap-1 font-medium text-[#D4AF37]">
              <Tag className="w-3 h-3 text-[#D4AF37]" />
              {searchQuery ? `Tìm kiếm tag: "${searchQuery}"` : 'Danh sách Tag hiện có'}
            </span>
            <span className="text-[10px] text-[#777]">Dùng ↑ ↓ và Enter để chọn</span>
          </div>

          {filteredTags.length > 0 ? (
            <div className="py-1">
              {filteredTags.map((tag, idx) => {
                const isSelectedInInput = currentTags.some(t => t.toLowerCase() === tag.toLowerCase());
                const isHighlighted = idx === selectedIndex;

                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertTag(tag)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      isHighlighted
                        ? 'bg-[#D4AF37]/20 text-[#D4AF37] font-medium'
                        : 'text-[#E0E0E0] hover:bg-[#1A1A1A]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[#D4AF37] font-bold">#</span>
                      <span>{tag}</span>
                    </div>
                    {isSelectedInInput && (
                      <span className="text-[10px] text-[#D4AF37] flex items-center gap-1 bg-[#D4AF37]/10 px-1.5 py-0.5 rounded">
                        <Check className="w-2.5 h-2.5" /> Đã chọn
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
                  <Tag className="w-3 h-3" /> Thêm mới: <b>#{searchQuery}</b>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
