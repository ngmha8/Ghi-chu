import React, { useState, useRef, useEffect } from 'react';
import { GlobalSearchInput } from './GlobalSearchInput.js';
import { Task, Note, DriveFile, AppTheme, AppFontSize } from '../types/index.js';
import {
  CheckSquare,
  FileText,
  FolderSync,
  Sparkles,
  Layers,
  Plus,
  HardDrive,
  ShieldCheck,
  Bot,
  Settings,
  Lock,
  Brain,
  ChevronDown,
  Mic,
  Sun,
  Moon,
  TrendingUp,
  Flame,
  User,
  Palette,
  Check,
  Type,
  Menu,
  X
} from 'lucide-react';
import { THEME_OPTIONS } from '../services/theme.js';
import { FONT_SIZE_OPTIONS } from '../services/fontSize.js';
import { useSystemStore, AppTab } from '../stores/useSystemStore.js';
import { useTaskStore } from '../stores/useTaskStore.js';
import { useNoteStore } from '../stores/useNoteStore.js';
import { useFileStore } from '../stores/useFileStore.js';

export interface HeaderProps {
  activeTab?: AppTab;
  setActiveTab?: (tab: AppTab) => void;
  openNewTaskModal?: () => void;
  openNewNoteModal?: () => void;
  isAiDrawerOpen?: boolean;
  setIsAiDrawerOpen?: (open: boolean) => void;
  onOpenVoiceFocus?: () => void;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  unreadNotifsCount?: number;
  availableTags?: string[];
  tasks?: Task[];
  notes?: Note[];
  files?: DriveFile[];
  onSelectTask?: (task: Task) => void;
  onSelectNote?: (note: Note) => void;
  onSelectFile?: (file: DriveFile) => void;
  onLockApp?: () => void;
  theme?: AppTheme;
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab,
  openNewTaskModal: propOpenNewTaskModal,
  openNewNoteModal: propOpenNewNoteModal,
  isAiDrawerOpen: propIsAiDrawerOpen,
  setIsAiDrawerOpen: propSetIsAiDrawerOpen,
  onOpenVoiceFocus: propOnOpenVoiceFocus,
  searchQuery: propSearchQuery,
  setSearchQuery: propSetSearchQuery,
  availableTags = ['Công việc', 'Báo cáo', 'Tài chính', 'Kế hoạch', 'Dự án', 'Architecture', 'AI'],
  tasks: propTasks,
  notes: propNotes,
  files: propFiles,
  onSelectTask: propOnSelectTask,
  onSelectNote: propOnSelectNote,
  onSelectFile: propOnSelectFile,
  onLockApp: propOnLockApp,
  theme: propTheme,
  onToggleTheme: propOnToggleTheme,
}) => {
  // Store slices
  const storeTheme = useSystemStore(s => s.theme);
  const storeToggleTheme = useSystemStore(s => s.toggleTheme);
  const storeActiveTab = useSystemStore(s => s.activeTab);
  const storeSetActiveTab = useSystemStore(s => s.setActiveTab);
  const storeOpenAiDrawer = useSystemStore(s => s.openAiDrawer);
  const storeCloseAiDrawer = useSystemStore(s => s.closeAiDrawer);
  const storeOpenVoiceFocus = useSystemStore(s => s.openVoiceFocus);
  const storeSearchQuery = useSystemStore(s => s.searchQuery);
  const storeSetSearchQuery = useSystemStore(s => s.setSearchQuery);
  const storeLockApp = useSystemStore(s => s.lockApp);

  const storeTasks = useTaskStore(s => s.tasks);
  const storeOpenTaskModal = useTaskStore(s => s.openTaskModal);
  const storeNotes = useNoteStore(s => s.notes);
  const storeOpenNoteModal = useNoteStore(s => s.openNoteModal);
  const storeFiles = useFileStore(s => s.files);

  // Resolved effective values
  const activeTab = propActiveTab ?? storeActiveTab;
  const setActiveTab = propSetActiveTab ?? storeSetActiveTab;
  const openNewTaskModal = propOpenNewTaskModal ?? (() => storeOpenTaskModal(null));
  const openNewNoteModal = propOpenNewNoteModal ?? storeOpenNoteModal;
  const setIsAiDrawerOpen = propSetIsAiDrawerOpen ?? ((open: boolean) => open ? storeOpenAiDrawer() : storeCloseAiDrawer());
  const onOpenVoiceFocus = propOnOpenVoiceFocus ?? storeOpenVoiceFocus;
  const searchQuery = propSearchQuery ?? storeSearchQuery;
  const setSearchQuery = propSetSearchQuery ?? storeSetSearchQuery;
  const tasks = propTasks ?? storeTasks;
  const notes = propNotes ?? storeNotes;
  const files = propFiles ?? storeFiles;
  const onLockApp = propOnLockApp ?? storeLockApp;
  const theme = propTheme ?? storeTheme;
  const onToggleTheme = propOnToggleTheme ?? storeToggleTheme;

  const onSelectTask = propOnSelectTask ?? ((task: Task) => {
    storeOpenTaskModal(task);
    setActiveTab('tasks');
  });
  const onSelectNote = propOnSelectNote ?? ((_note: Note) => {
    setActiveTab('notes');
  });
  const onSelectFile = propOnSelectFile ?? ((_file: DriveFile) => {
    setActiveTab('files');
  });

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const storeSetTheme = useSystemStore(s => s.setTheme);
  const storeFontSize = useSystemStore(s => s.fontSize);
  const storeSetFontSize = useSystemStore(s => s.setFontSize);

  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);
  const themePickerRef = useRef<HTMLDivElement>(null);

  const handleCycleFontSize = () => {
    const sizes: AppFontSize[] = ['small', 'medium', 'large', 'xlarge'];
    const currentIdx = sizes.indexOf(storeFontSize);
    const nextIdx = (currentIdx + 1) % sizes.length;
    storeSetFontSize(sizes[nextIdx]);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target as Node)) {
        setIsThemePickerOpen(false);
      }
    };
    if (isThemePickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isThemePickerOpen]);

  const isSettingsActive = ['telegram', 'ai-learning', 'settings', 'architecture'].includes(activeTab);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsDropdownOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsDropdownOpen(false);
    }, 200);
  };

  const getActiveTabTitle = () => {
    switch (activeTab) {
      case 'telegram': return 'Telegram Bot';
      case 'ai-learning': return 'Tự Học & Tâm Trí AI';
      case 'settings': return 'Cài Đặt';
      case 'architecture': return 'Kiến trúc & DB';
      default: return 'Cài Đặt';
    }
  };

  const activeTasksCount = tasks.filter(t => t.status !== 'completed' && t.status !== 'canceled').length;

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const handleSelectTab = (tabId: AppTab) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
        setIsDropdownOpen(false);
        setIsThemePickerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Body scroll lock when mobile menu is open (prevent background page from scrolling)
  useEffect(() => {
    if (isMobileMenuOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalTouchAction = document.body.style.touchAction;

      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.touchAction = originalTouchAction;
      };
    }
  }, [isMobileMenuOpen]);

  const TAB_DEFINITIONS: {
    id: AppTab;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    category: 'main' | 'settings';
    badge?: number;
  }[] = [
    {
      id: 'dashboard',
      title: 'Bảng Điều Khiển',
      description: 'Tổng quan hệ thống, widget & tiến độ',
      icon: Layers,
      category: 'main'
    },
    {
      id: 'tasks',
      title: 'Công Việc',
      description: 'Quản lý nhiệm vụ, deadline & ưu tiên',
      icon: CheckSquare,
      category: 'main',
      badge: activeTasksCount
    },
    {
      id: 'notes',
      title: 'Ghi Chú',
      description: 'Sổ tay, tag phân loại & tìm kiếm',
      icon: FileText,
      category: 'main',
      badge: notes.length
    },
    {
      id: 'files',
      title: 'Google Drive',
      description: 'Kho lưu trữ tài liệu & đồng bộ',
      icon: FolderSync,
      category: 'main',
      badge: files.length
    },
    {
      id: 'analytics',
      title: 'Thống Kê & Phân Tích',
      description: 'Báo cáo năng suất & biểu đồ',
      icon: TrendingUp,
      category: 'main'
    },
    {
      id: 'telegram',
      title: 'Telegram Bot',
      description: 'Thông báo & tương tác 2 chiều',
      icon: Bot,
      category: 'settings'
    },
    {
      id: 'ai-learning',
      title: 'Tự Học & Tâm Trí AI',
      description: 'Ký ức, xưng hô & suy ngẫm',
      icon: Brain,
      category: 'settings'
    },
    {
      id: 'settings',
      title: 'Cài Đặt Hệ Thống',
      description: 'Drive API, Gemini & Khóa PIN',
      icon: Settings,
      category: 'settings'
    },
    {
      id: 'architecture',
      title: 'Kiến Trúc & DB Schema',
      description: 'Sơ đồ hạ tầng & Firestore rules',
      icon: ShieldCheck,
      category: 'settings'
    }
  ];

  const activeTabDef = TAB_DEFINITIONS.find(t => t.id === activeTab) || TAB_DEFINITIONS[0];

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#111827]/95 border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 backdrop-blur-md transition-colors shadow-2xs">
      {/* Tier 1: Main Brand, Search & Executive Actions */}
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Brand & Logo */}
        <div
          className="flex items-center gap-2.5 sm:gap-3 shrink-0 cursor-pointer select-none"
          onClick={() => setActiveTab('dashboard')}
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-600 border border-blue-500/30 flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0">
            A
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
              Architect.OS
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700/50 whitespace-nowrap hidden sm:inline-block">
              PRO
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden xl:inline">
              V2.4.0
            </span>
          </div>
        </div>

        {/* Global Search Center Bar */}
        <div className="flex-1 min-w-0 max-w-md lg:max-w-lg mx-1 sm:mx-3 relative">
          <GlobalSearchInput
            placeholder="Tìm kiếm công việc, ghi chú, tài liệu (Ctrl+K)..."
            value={searchQuery}
            onChange={setSearchQuery}
            tasks={tasks}
            notes={notes}
            files={files}
            availableTags={availableTags}
            onSelectTask={onSelectTask}
            onSelectNote={onSelectNote}
            onSelectFile={onSelectFile}
          />
        </div>

        {/* Actions & Profiles */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Firestore & Drive Active Status Indicators */}
          <div className="hidden xl:flex items-center gap-2 mr-1">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 dark:bg-[#131E31] border border-slate-200 dark:border-[#22334D] text-[11px] text-slate-700 dark:text-slate-300"
              title="Cloud Firestore đồng bộ thời gian thực"
            >
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium">Firestore</span>
            </div>
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 dark:bg-[#131E31] border border-slate-200 dark:border-[#22334D] text-[11px] text-slate-700 dark:text-slate-300"
              title="Google Drive kết nối sẵn sàng"
            >
              <HardDrive className="w-3.5 h-3.5 text-blue-600 dark:text-emerald-400" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="font-medium">Drive</span>
            </div>
          </div>

          {/* Quick Create Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={openNewTaskModal}
              className="px-3 sm:px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0 whitespace-nowrap"
              title="Tạo công việc mới"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Thêm Task</span>
              <span className="sm:hidden">Task</span>
            </button>
            <button
              onClick={openNewNoteModal}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 dark:bg-[#152033] dark:border-[#283B59] dark:text-slate-200 dark:hover:border-blue-500/50 dark:hover:text-white dark:hover:bg-[#1E2E48] transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
              title="Tạo ghi chú mới"
            >
              <Plus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">Ghi Chú</span>
              <span className="sm:hidden">Note</span>
            </button>
          </div>

          {/* Theme & Font Size Quick Switcher & Lock Controls */}
          <div className="flex items-center gap-1 border-l border-slate-200 dark:border-[#22334D] pl-1.5 sm:pl-2">
            <div className="relative" ref={themePickerRef}>
              <button
                type="button"
                onClick={() => setIsThemePickerOpen(!isThemePickerOpen)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                  isThemePickerOpen
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 ring-2 ring-blue-500/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-blue-400 dark:hover:bg-[#1E2B42]'
                }`}
                title="Tùy chọn giao diện & cỡ chữ: Nền sáng/tối, đổi cỡ chữ hệ thống"
              >
                {theme === 'light' && <Sun className="w-4 h-4 text-amber-500" />}
                {theme === 'light-blue' && <Sun className="w-4 h-4 text-sky-500" />}
                {theme === 'light-pink' && <Sun className="w-4 h-4 text-rose-500" />}
                {theme === 'light-purple' && <Sun className="w-4 h-4 text-purple-500" />}
                {theme === 'dark' && <Moon className="w-4 h-4 text-amber-400" />}
                {theme === 'dark-gray' && <Moon className="w-4 h-4 text-slate-300" />}
                {theme === 'dark-navy' && <Palette className="w-4 h-4 text-blue-400" />}
              </button>

              {/* Theme & Font Size Selection Dropdown Popover */}
              {isThemePickerOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white dark:bg-[#152033] border border-slate-200 dark:border-[#22334D] rounded-xl shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-100 dark:border-[#22334D]/60 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      Giao Diện & Cỡ Chữ
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleTheme();
                      }}
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                      title="Chuyển sang chủ đề tiếp theo"
                    >
                      Đổi màu nhanh
                    </button>
                  </div>

                  {/* 1. Nhóm Chủ Đề Sáng */}
                  <div className="mb-2">
                    <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Chủ Đề Sáng
                    </div>
                    <div className="space-y-1 mt-1">
                      {THEME_OPTIONS.filter(o => o.category === 'light').map(opt => {
                        const isSelected = theme === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              storeSetTheme(opt.id);
                              setIsThemePickerOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-[#1A263D] text-blue-700 dark:text-blue-300 font-semibold ring-1 ring-blue-500/30'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E2C44]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className="w-4 h-4 rounded-full border shrink-0 shadow-2xs"
                                style={{ backgroundColor: opt.bgHex, borderColor: opt.borderHex }}
                              />
                              <div className="min-w-0">
                                <div className="truncate font-medium">{opt.name}</div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{opt.description}</div>
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 ml-1.5" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Nhóm Chủ Đề Tối */}
                  <div className="pt-1 border-t border-slate-100 dark:border-[#22334D]/60 mb-2">
                    <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Chủ Đề Tối
                    </div>
                    <div className="space-y-1 mt-1">
                      {THEME_OPTIONS.filter(o => o.category === 'dark').map(opt => {
                        const isSelected = theme === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              storeSetTheme(opt.id);
                              setIsThemePickerOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-[#1A263D] text-blue-700 dark:text-blue-300 font-semibold ring-1 ring-blue-500/30'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E2C44]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className="w-4 h-4 rounded-full border shrink-0 shadow-2xs"
                                style={{ backgroundColor: opt.bgHex, borderColor: opt.borderHex }}
                              />
                              <div className="min-w-0">
                                <div className="truncate font-medium">{opt.name}</div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{opt.description}</div>
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 ml-1.5" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Tùy Chọn Cỡ Chữ Hệ Thống (Accessible Font Sizing) */}
                  <div className="pt-2 border-t border-slate-100 dark:border-[#22334D]/60">
                    <div className="flex items-center justify-between px-2 py-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Type className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        Cỡ Chữ Hệ Thống
                      </span>
                      <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded border border-blue-200/50 dark:border-blue-800/50">
                        {FONT_SIZE_OPTIONS.find(f => f.id === storeFontSize)?.scalePercent}% ({FONT_SIZE_OPTIONS.find(f => f.id === storeFontSize)?.pixelSize}px)
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-[#0E1522] rounded-lg mt-1 border border-slate-200/80 dark:border-[#22334D]">
                      {FONT_SIZE_OPTIONS.map((opt) => {
                        const isSelected = storeFontSize === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => storeSetFontSize(opt.id)}
                            className={`py-1.5 px-1 rounded-md text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                              isSelected
                                ? 'bg-white dark:bg-[#1E2E48] text-blue-700 dark:text-blue-300 font-bold shadow-xs border border-blue-500/30'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-[#1A263D]'
                            }`}
                            title={`${opt.name}: ${opt.description}`}
                          >
                            <span className="text-xs font-bold leading-tight">{opt.label}</span>
                            <span className="text-[9px] opacity-80 font-mono">{opt.scalePercent}%</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 px-2 mt-1 truncate">
                      {FONT_SIZE_OPTIONS.find(f => f.id === storeFontSize)?.description}
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#22334D]/60 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsThemePickerOpen(false);
                        setActiveTab('settings');
                      }}
                      className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                    >
                      Tùy chỉnh chi tiết trong Cài Đặt →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Font Size Switch Button */}
            <button
              type="button"
              onClick={handleCycleFontSize}
              className="h-8 px-1.5 sm:px-2 rounded-lg flex items-center gap-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#1E2B42] transition-colors cursor-pointer text-xs font-semibold"
              title={`Cỡ chữ: ${FONT_SIZE_OPTIONS.find(f => f.id === storeFontSize)?.name}. Nhấp để đổi nhanh`}
            >
              <Type className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="font-mono text-[11px] font-bold hidden sm:inline">
                {FONT_SIZE_OPTIONS.find(f => f.id === storeFontSize)?.label}
              </span>
            </button>

            <button
              type="button"
              onClick={onLockApp}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#1E2B42] transition-colors cursor-pointer"
              title="Khóa ứng dụng (Yêu cầu mã PIN)"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>

          {/* User Profile Avatar */}
          <div
            className="w-8 h-8 rounded-full bg-blue-600 border border-blue-500/30 flex items-center justify-center text-white shrink-0 shadow-sm cursor-pointer"
            title="Tài khoản Quản trị viên"
            onClick={() => setActiveTab('settings')}
          >
            <User className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Tier 2: Seamless Tab Navigation Bar (Desktop) & Collapsible Mobile Dropdown Button (Mobile) */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-3 sm:px-6 lg:px-8 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 min-h-[48px]">
          
          {/* MOBILE VIEW (< md): Icon-only Button & Quick Actions */}
          <div className="md:hidden w-full flex items-center justify-between gap-2 py-1.5" ref={mobileMenuRef}>
            {/* The Icon-only Menu Trigger Button (No text "Bảng Điều Khiển") */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white flex items-center justify-center shadow-xs transition-all cursor-pointer shrink-0 relative"
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng"}
              title={isMobileMenuOpen ? "Đóng menu" : "Mở menu"}
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 stroke-[2.4]" />
              ) : (
                <Menu className="w-5 h-5 stroke-[2.4]" />
              )}
              {activeTasksCount > 0 && !isMobileMenuOpen && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center font-mono border-2 border-white dark:border-[#111827]">
                  {activeTasksCount > 9 ? '9+' : activeTasksCount}
                </span>
              )}
            </button>

            {/* Quick Actions on Mobile */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={openNewTaskModal}
                className="h-8 px-2.5 rounded-lg bg-blue-50 text-blue-700 dark:bg-[#1E2E48] dark:text-blue-300 text-xs font-semibold flex items-center gap-1 border border-blue-200/50 dark:border-blue-700/50 cursor-pointer"
                title="Tạo công việc mới"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Task</span>
              </button>
              <button
                type="button"
                onClick={openNewNoteModal}
                className="h-8 px-2.5 rounded-lg bg-slate-100 text-slate-700 dark:bg-[#1B2433] dark:text-slate-300 text-xs font-semibold flex items-center gap-1 border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Tạo ghi chú mới"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ghi chú</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAiDrawerOpen(true)}
                className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 dark:bg-[#1E2E48] dark:text-[#D4AF37] border border-blue-200/60 dark:border-blue-700/40 flex items-center justify-center cursor-pointer shadow-2xs hover:bg-blue-100 transition-colors"
                title="Hỏi AI"
              >
                <Sparkles className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onOpenVoiceFocus}
                className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 dark:bg-[#1E2028] dark:text-slate-200 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center cursor-pointer shadow-2xs hover:bg-slate-200 transition-colors"
                title="Thoại 2 chiều"
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile Overlay & Scrollable Menu (With background scroll lock) */}
          {isMobileMenuOpen && (
            <>
              {/* Fullscreen Backdrop (clicks close menu, touchAction: none locks gestures) */}
              <div
                className="md:hidden fixed inset-0 top-[112px] bg-slate-950/60 dark:bg-black/80 backdrop-blur-xs z-40 animate-in fade-in duration-150"
                onClick={() => setIsMobileMenuOpen(false)}
                style={{ touchAction: 'none' }}
              />

              {/* Scrollable Menu Panel (overscroll-contain, touchAction: pan-y, max-h-[calc(100dvh-128px)]) */}
              <div
                className="md:hidden fixed inset-x-2.5 sm:inset-x-4 top-[116px] max-h-[calc(100dvh-128px)] z-50 bg-white dark:bg-[#131924] border border-slate-200 dark:border-[#22334D] rounded-2xl shadow-2xl overflow-y-auto overscroll-contain flex flex-col animate-in fade-in slide-in-from-top-2 duration-150 divide-y divide-slate-100 dark:divide-[#1E2B40]"
                onClick={(e) => e.stopPropagation()}
                style={{
                  touchAction: 'pan-y',
                  WebkitOverflowScrolling: 'touch'
                }}
              >
                {/* Header */}
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#0E1522] flex items-center justify-between sticky top-0 z-10 border-b border-slate-100 dark:border-[#1E2B40]">
                  <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-500 dark:text-slate-400">
                    Menu Điều Hướng Ứng Dụng
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                    title="Đóng menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Primary views section */}
                <div className="p-2 space-y-1">
                  <div className="px-2 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Phân Hệ Chính
                  </div>
                  {TAB_DEFINITIONS.filter(t => t.category === 'main').map((item) => {
                    const isCurrent = activeTab === item.id;
                    const ItemIcon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectTab(item.id);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-blue-600 text-white font-bold shadow-xs'
                            : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C273B]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isCurrent
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 text-slate-600 dark:bg-[#1C273B] dark:text-slate-300'
                          }`}>
                            <ItemIcon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold leading-tight truncate">
                              {item.title}
                            </div>
                            <div className={`text-[10px] truncate ${
                              isCurrent ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'
                            }`}>
                              {item.description}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {item.badge !== undefined && item.badge > 0 && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                              isCurrent
                                ? 'bg-white text-blue-700'
                                : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60'
                            }`}>
                              {item.badge}
                            </span>
                          )}
                          {isCurrent && (
                            <Check className="w-4 h-4 text-white ml-1 shrink-0" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Settings & Tools section */}
                <div className="p-2 space-y-1">
                  <div className="px-2 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Cài Đặt & Mở Rộng
                  </div>
                  {TAB_DEFINITIONS.filter(t => t.category === 'settings').map((item) => {
                    const isCurrent = activeTab === item.id;
                    const ItemIcon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectTab(item.id);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-blue-600 text-white font-bold shadow-xs'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1C273B]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isCurrent
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 text-slate-600 dark:bg-[#1C273B] dark:text-slate-300'
                          }`}>
                            <ItemIcon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold leading-tight truncate">
                              {item.title}
                            </div>
                            <div className={`text-[10px] truncate ${
                              isCurrent ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'
                            }`}>
                              {item.description}
                            </div>
                          </div>
                        </div>

                        {isCurrent && (
                          <Check className="w-4 h-4 text-white ml-2 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Quick actions row */}
                <div className="p-2.5 bg-slate-50/70 dark:bg-[#0E1522]/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMobileMenuOpen(false);
                      openNewTaskModal();
                    }}
                    className="flex-1 py-2 px-2 rounded-lg bg-blue-50 text-blue-700 dark:bg-[#1E2E48] dark:text-blue-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-blue-200/50 dark:border-blue-700/50 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm Task</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMobileMenuOpen(false);
                      openNewNoteModal();
                    }}
                    className="flex-1 py-2 px-2 rounded-lg bg-slate-100 text-slate-700 dark:bg-[#1B2433] dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ghi Chú</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMobileMenuOpen(false);
                      onLockApp();
                    }}
                    className="py-2 px-3 rounded-lg bg-slate-100 text-slate-600 dark:bg-[#1B2433] dark:text-slate-300 text-xs font-medium flex items-center justify-center gap-1 border border-slate-200 dark:border-slate-700 cursor-pointer"
                    title="Khóa ứng dụng"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Khóa</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* DESKTOP VIEW (hidden md:flex): Full Navigation Tabs and Settings */}
          <div className="hidden md:flex items-center justify-between w-full h-12">
            {/* Main Navigation Tabs */}
            <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar h-full">
              {/* 1. Dashboard */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`h-full px-3 sm:px-3.5 text-xs sm:text-sm font-medium flex items-center gap-1.5 whitespace-nowrap transition-all border-b-2 cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'text-blue-600 font-bold border-blue-600 dark:text-blue-400 dark:border-blue-500'
                    : 'text-slate-600 hover:text-slate-900 border-transparent hover:border-slate-300 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Dashboard</span>
              </button>

              {/* 2. Công việc (Tasks) */}
              <button
                onClick={() => setActiveTab('tasks')}
                className={`h-full px-3 sm:px-3.5 text-xs sm:text-sm font-medium flex items-center gap-1.5 whitespace-nowrap transition-all border-b-2 cursor-pointer ${
                  activeTab === 'tasks'
                    ? 'text-blue-600 font-bold border-blue-600 dark:text-blue-400 dark:border-blue-500'
                    : 'text-slate-600 hover:text-slate-900 border-transparent hover:border-slate-300 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                <span>Công việc</span>
                {activeTasksCount > 0 && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                    activeTab === 'tasks'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200 dark:border dark:border-blue-700/50'
                      : 'bg-slate-100 text-slate-600 dark:bg-[#1E2B42] dark:text-slate-400'
                  }`}>
                    {activeTasksCount}
                  </span>
                )}
              </button>

              {/* 3. Ghi chú (Notes) */}
              <button
                onClick={() => setActiveTab('notes')}
                className={`h-full px-3 sm:px-3.5 text-xs sm:text-sm font-medium flex items-center gap-1.5 whitespace-nowrap transition-all border-b-2 cursor-pointer ${
                  activeTab === 'notes'
                    ? 'text-blue-600 font-bold border-blue-600 dark:text-blue-400 dark:border-blue-500'
                    : 'text-slate-600 hover:text-slate-900 border-transparent hover:border-slate-300 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Ghi chú</span>
                {notes.length > 0 && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                    activeTab === 'notes'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200 dark:border dark:border-blue-700/50'
                      : 'bg-slate-100 text-slate-600 dark:bg-[#1E2B42] dark:text-slate-400'
                  }`}>
                    {notes.length}
                  </span>
                )}
              </button>

              {/* 4. Google Drive */}
              <button
                onClick={() => setActiveTab('files')}
                className={`h-full px-3 sm:px-3.5 text-xs sm:text-sm font-medium flex items-center gap-1.5 whitespace-nowrap transition-all border-b-2 cursor-pointer ${
                  activeTab === 'files'
                    ? 'text-blue-600 font-bold border-blue-600 dark:text-blue-400 dark:border-blue-500'
                    : 'text-slate-600 hover:text-slate-900 border-transparent hover:border-slate-300 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <FolderSync className="w-4 h-4" />
                <span>Google Drive</span>
                {files.length > 0 && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                    activeTab === 'files'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200 dark:border dark:border-blue-700/50'
                      : 'bg-slate-100 text-slate-600 dark:bg-[#1E2B42] dark:text-slate-400'
                  }`}>
                    {files.length}
                  </span>
                )}
              </button>

              {/* 5. Thống kê & Phân tích (Analytics) - First class tab */}
              <button
                onClick={() => setActiveTab('analytics')}
                className={`h-full px-3 sm:px-3.5 text-xs sm:text-sm font-medium flex items-center gap-1.5 whitespace-nowrap transition-all border-b-2 cursor-pointer ${
                  activeTab === 'analytics'
                    ? 'text-blue-600 font-bold border-blue-600 dark:text-blue-400 dark:border-blue-500'
                    : 'text-slate-600 hover:text-slate-900 border-transparent hover:border-slate-300 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>Thống kê & Phân tích</span>
              </button>
            </nav>

            {/* Right Side Settings & Tools Dropdown Trigger */}
            <div
              className="relative shrink-0"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`h-8 px-2.5 sm:px-3 text-xs font-semibold flex items-center gap-1.5 rounded-lg transition-all cursor-pointer border ${
                  isSettingsActive
                    ? 'text-blue-600 border-blue-300 bg-blue-50 dark:text-[#D4AF37] dark:border-[#D4AF37]/60 dark:bg-[#D4AF37]/15'
                    : 'text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50 dark:text-[#AAAAAA] dark:hover:text-white dark:border-[#2A2A2A] dark:bg-[#121212] dark:hover:bg-[#1A1A1A]'
                }`}
                title={isSettingsActive ? getActiveTabTitle() : 'Cài đặt & Tính năng mở rộng'}
              >
                <div className="relative flex items-center justify-center">
                  <Settings className={`w-3.5 h-3.5 transition-transform duration-300 ${isDropdownOpen ? 'rotate-90' : ''}`} />
                  {isSettingsActive && !isDropdownOpen && (
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-[#D4AF37]" />
                  )}
                </div>

                <span className="hidden sm:inline">
                  {isSettingsActive ? getActiveTabTitle() : 'Cài Đặt'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu List */}
              {isDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#2A2A2A] rounded-xl shadow-xl z-50 py-1.5 backdrop-blur-md animate-fadeIn divide-y divide-slate-100 dark:divide-[#222222]">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#666666] flex items-center justify-between">
                    <span>Hệ thống & AI</span>
                    <span className="text-blue-600 dark:text-[#D4AF37]">Trợ lý & Cài đặt</span>
                  </div>

                  <div className="p-1 space-y-0.5">
                    {/* AI Assistant Chat Trigger */}
                    <button
                      onClick={() => {
                        setIsAiDrawerOpen(true);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full px-3 py-2 rounded-lg flex items-center justify-between text-left transition-colors cursor-pointer text-slate-700 hover:bg-slate-50 dark:text-[#CCCCCC] dark:hover:text-[#D4AF37] dark:hover:bg-[#1E1E1E]"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-md bg-blue-50 text-blue-600 dark:bg-[#D4AF37]/15 dark:text-[#D4AF37]">
                          <Sparkles className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                            Trò Chuyện & Hỏi AI
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-[#777777]">Tra cứu, phân tích & tóm tắt</div>
                        </div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#1A1A1A] border border-slate-200 dark:border-[#333333] text-blue-600 dark:text-[#D4AF37] font-mono">Mở</span>
                    </button>

                    {/* Two-Way Voice Focus Mode Trigger */}
                    <button
                      onClick={() => {
                        onOpenVoiceFocus();
                        setIsDropdownOpen(false);
                      }}
                      className="w-full px-3 py-2 rounded-lg flex items-center justify-between text-left transition-colors cursor-pointer text-slate-700 hover:bg-slate-50 dark:text-[#CCCCCC] dark:hover:text-[#D4AF37] dark:hover:bg-[#1E1E1E]"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-md bg-blue-50 text-blue-600 dark:bg-[#D4AF37]/15 dark:text-[#D4AF37]">
                          <Mic className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                            Thoại 2 Chiều (Voice)
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-[#777777]">Đàm thoại tương tác âm thanh</div>
                        </div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#1A1A1A] border border-slate-200 dark:border-[#333333] text-blue-600 dark:text-[#D4AF37] font-mono">Mic</span>
                    </button>

                    {/* 1. Telegram Bot */}
                    <button
                      onClick={() => {
                        setActiveTab('telegram');
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-lg flex items-center justify-between text-left transition-colors cursor-pointer ${
                        activeTab === 'telegram'
                          ? 'bg-blue-50 text-blue-700 font-bold dark:bg-[#D4AF37]/15 dark:text-[#D4AF37]'
                          : 'text-slate-700 hover:bg-slate-50 dark:text-[#CCCCCC] dark:hover:text-white dark:hover:bg-[#1E1E1E]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-md ${activeTab === 'telegram' ? 'bg-blue-100 text-blue-700 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]' : 'bg-slate-100 text-slate-600 dark:bg-[#1E1E1E] dark:text-[#888888]'}`}>
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold">Telegram Bot</div>
                          <div className="text-[10px] text-slate-400 dark:text-[#777777]">Thông báo & Tương tác 2 chiều</div>
                        </div>
                      </div>
                      {activeTab === 'telegram' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-[#D4AF37]" />
                      )}
                    </button>

                    {/* 2. Tự Học & Tâm Trí AI */}
                    <button
                      onClick={() => {
                        setActiveTab('ai-learning');
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-lg flex items-center justify-between text-left transition-colors cursor-pointer ${
                        activeTab === 'ai-learning'
                          ? 'bg-indigo-50 text-indigo-700 font-bold dark:bg-indigo-500/15 dark:text-indigo-300'
                          : 'text-slate-700 hover:bg-slate-50 dark:text-[#CCCCCC] dark:hover:text-white dark:hover:bg-[#1E1E1E]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-md ${activeTab === 'ai-learning' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400' : 'bg-slate-100 text-slate-600 dark:bg-[#1E1E1E] dark:text-indigo-400/80'}`}>
                          <Brain className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold flex items-center gap-1.5">
                            Tự Học & Tâm Trí AI
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-[#777777]">Ký ức, Xưng hô & Suy ngẫm</div>
                        </div>
                      </div>
                      {activeTab === 'ai-learning' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                      )}
                    </button>

                    {/* 3. Cài Đặt */}
                    <button
                      onClick={() => {
                        setActiveTab('settings');
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-lg flex items-center justify-between text-left transition-colors cursor-pointer ${
                        activeTab === 'settings'
                          ? 'bg-blue-50 text-blue-700 font-bold dark:bg-[#D4AF37]/15 dark:text-[#D4AF37]'
                          : 'text-slate-700 hover:bg-slate-50 dark:text-[#CCCCCC] dark:hover:text-white dark:hover:bg-[#1E1E1E]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-md ${activeTab === 'settings' ? 'bg-blue-100 text-blue-700 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]' : 'bg-slate-100 text-slate-600 dark:bg-[#1E1E1E] dark:text-[#888888]'}`}>
                          <Settings className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold">Cài Đặt Hệ Thống</div>
                          <div className="text-[10px] text-slate-400 dark:text-[#777777]">Drive API, Gemini & Khóa PIN</div>
                        </div>
                      </div>
                      {activeTab === 'settings' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-[#D4AF37]" />
                      )}
                    </button>

                    {/* 4. Kiến trúc & DB Schema */}
                    <button
                      onClick={() => {
                        setActiveTab('architecture');
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-lg flex items-center justify-between text-left transition-colors cursor-pointer ${
                        activeTab === 'architecture'
                          ? 'bg-blue-50 text-blue-700 font-bold dark:bg-[#D4AF37]/15 dark:text-[#D4AF37]'
                          : 'text-slate-700 hover:bg-slate-50 dark:text-[#CCCCCC] dark:hover:text-white dark:hover:bg-[#1E1E1E]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-md ${activeTab === 'architecture' ? 'bg-blue-100 text-blue-700 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]' : 'bg-slate-100 text-slate-600 dark:bg-[#1E1E1E] dark:text-[#888888]'}`}>
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold">Kiến trúc & DB Schema</div>
                          <div className="text-[10px] text-slate-400 dark:text-[#777777]">Sơ đồ hạ tầng & Firestore rules</div>
                        </div>
                      </div>
                      {activeTab === 'architecture' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-[#D4AF37]" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
