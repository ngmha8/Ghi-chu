import React, { useState, useRef } from 'react';
import { GlobalSearchInput } from './GlobalSearchInput.js';
import { Task, Note, DriveFile, AppTheme } from '../types/index.js';
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
  User
} from 'lucide-react';
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

  return (
    <header className="sticky top-0 z-40 bg-[#0F0F0F]/95 backdrop-blur border-b border-[#2A2A2A] text-[#E0E0E0] transition-colors">
      {/* Tier 1: Main Brand, Search & Executive Actions */}
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Brand & Logo */}
        <div
          className="flex items-center gap-2.5 sm:gap-3 shrink-0 cursor-pointer select-none"
          onClick={() => setActiveTab('dashboard')}
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-600 dark:bg-[#151515] border border-blue-500/20 dark:border-[#2A2A2A] flex items-center justify-center text-white dark:text-[#D4AF37] font-bold text-base shadow-sm shrink-0">
            A
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-[#D4AF37] whitespace-nowrap">
              Architect.OS
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 dark:bg-[#1A1A1A] dark:text-[#D4AF37] dark:border-[#D4AF37]/30 whitespace-nowrap hidden sm:inline-block">
              PRO
            </span>
            <span className="text-[10px] text-slate-400 dark:text-[#777777] hidden xl:inline">
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
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#282828] text-[11px] text-slate-700 dark:text-[#A0A0A0]"
              title="Cloud Firestore đồng bộ thời gian thực"
            >
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium">Firestore</span>
            </div>
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#282828] text-[11px] text-slate-700 dark:text-[#A0A0A0]"
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
              className="px-3 sm:px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white dark:bg-[#D4AF37] dark:text-black dark:hover:bg-[#c29f2e] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0 whitespace-nowrap"
              title="Tạo công việc mới"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Thêm Task</span>
              <span className="sm:hidden">Task</span>
            </button>
            <button
              onClick={openNewNoteModal}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 dark:bg-[#161616] dark:border-[#2E2E2E] dark:text-[#E0E0E0] dark:hover:border-[#D4AF37]/50 dark:hover:text-[#D4AF37] dark:hover:bg-[#1C1C1C] transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
              title="Tạo ghi chú mới"
            >
              <Plus className="w-3.5 h-3.5 text-blue-600 dark:text-[#D4AF37]" />
              <span className="hidden sm:inline">Ghi Chú</span>
              <span className="sm:hidden">Note</span>
            </button>
          </div>

          {/* Theme & Lock Controls */}
          <div className="flex items-center gap-1 border-l border-slate-200 dark:border-[#2A2A2A] pl-1.5 sm:pl-2">
            <button
              type="button"
              onClick={onToggleTheme}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-[#D4AF37] dark:hover:bg-[#202020] transition-colors cursor-pointer"
              title={theme === 'light' ? 'Chuyển sang Chủ đề Tối (Gold & Obsidian)' : 'Chuyển sang Chủ đề Sáng (Executive Precision)'}
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4 text-blue-600" />
              ) : (
                <Sun className="w-4 h-4 text-[#D4AF37]" />
              )}
            </button>

            <button
              type="button"
              onClick={onLockApp}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-[#D4AF37] dark:hover:bg-[#202020] transition-colors cursor-pointer"
              title="Khóa ứng dụng (Yêu cầu mã PIN)"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>

          {/* User Profile Avatar */}
          <div
            className="w-8 h-8 rounded-full bg-blue-600 dark:bg-[#1A1A1A] border border-blue-500/20 dark:border-[#333] flex items-center justify-center text-white dark:text-[#D4AF37] shrink-0 shadow-xs cursor-pointer"
            title="Tài khoản Quản trị viên"
            onClick={() => setActiveTab('settings')}
          >
            <User className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Tier 2: Seamless Tab Navigation Bar */}
      <div className="border-t border-slate-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] px-3 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 h-12">
          
          {/* Main Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar h-full">
            {/* 1. Dashboard */}
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`h-full px-3 sm:px-3.5 text-xs sm:text-sm font-medium flex items-center gap-1.5 whitespace-nowrap transition-all border-b-2 cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'text-blue-600 font-bold border-blue-600 dark:text-[#D4AF37] dark:border-[#D4AF37]'
                  : 'text-slate-600 hover:text-slate-900 border-transparent hover:border-slate-300 dark:text-[#AAAAAA] dark:hover:text-white'
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
                  ? 'text-blue-600 font-bold border-blue-600 dark:text-[#D4AF37] dark:border-[#D4AF37]'
                  : 'text-slate-600 hover:text-slate-900 border-transparent hover:border-slate-300 dark:text-[#AAAAAA] dark:hover:text-white'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span>Công việc</span>
              {activeTasksCount > 0 && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                  activeTab === 'tasks'
                    ? 'bg-blue-100 text-blue-700 dark:bg-[#D4AF37] dark:text-black'
                    : 'bg-slate-100 text-slate-600 dark:bg-[#222222] dark:text-[#AAAAAA]'
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
                  ? 'text-blue-600 font-bold border-blue-600 dark:text-[#D4AF37] dark:border-[#D4AF37]'
                  : 'text-slate-600 hover:text-slate-900 border-transparent hover:border-slate-300 dark:text-[#AAAAAA] dark:hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Ghi chú</span>
              {notes.length > 0 && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                  activeTab === 'notes'
                    ? 'bg-blue-100 text-blue-700 dark:bg-[#D4AF37] dark:text-black'
                    : 'bg-slate-100 text-slate-600 dark:bg-[#222222] dark:text-[#AAAAAA]'
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
                  ? 'text-blue-600 font-bold border-blue-600 dark:text-[#D4AF37] dark:border-[#D4AF37]'
                  : 'text-slate-600 hover:text-slate-900 border-transparent hover:border-slate-300 dark:text-[#AAAAAA] dark:hover:text-white'
              }`}
            >
              <FolderSync className="w-4 h-4" />
              <span>Google Drive</span>
              {files.length > 0 && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                  activeTab === 'files'
                    ? 'bg-blue-100 text-blue-700 dark:bg-[#D4AF37] dark:text-black'
                    : 'bg-slate-100 text-slate-600 dark:bg-[#222222] dark:text-[#AAAAAA]'
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
                  ? 'text-blue-600 font-bold border-blue-600 dark:text-[#D4AF37] dark:border-[#D4AF37]'
                  : 'text-slate-600 hover:text-slate-900 border-transparent hover:border-slate-300 dark:text-[#AAAAAA] dark:hover:text-white'
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
    </header>
  );
};
