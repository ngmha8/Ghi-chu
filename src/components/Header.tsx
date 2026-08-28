import React, { useState, useRef } from 'react';
import { GlobalSearchInput } from './GlobalSearchInput.js';
import { Task, Note, DriveFile } from '../types/index.js';
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
  Mic
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'dashboard' | 'tasks' | 'notes' | 'files' | 'telegram' | 'ai-learning' | 'settings' | 'architecture';
  setActiveTab: (tab: 'dashboard' | 'tasks' | 'notes' | 'files' | 'telegram' | 'ai-learning' | 'settings' | 'architecture') => void;
  openNewTaskModal: () => void;
  openNewNoteModal: () => void;
  isAiDrawerOpen: boolean;
  setIsAiDrawerOpen: (open: boolean) => void;
  onOpenVoiceFocus?: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  unreadNotifsCount: number;
  availableTags?: string[];
  tasks?: Task[];
  notes?: Note[];
  files?: DriveFile[];
  onSelectTask?: (task: Task) => void;
  onSelectNote?: (note: Note) => void;
  onSelectFile?: (file: DriveFile) => void;
  onLockApp?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  openNewTaskModal,
  openNewNoteModal,
  isAiDrawerOpen,
  setIsAiDrawerOpen,
  onOpenVoiceFocus = () => {},
  searchQuery,
  setSearchQuery,
  unreadNotifsCount,
  availableTags = ['Công việc', 'Báo cáo', 'Tài chính', 'Kế hoạch', 'Dự án', 'Architecture', 'AI'],
  tasks = [],
  notes = [],
  files = [],
  onSelectTask = () => {},
  onSelectNote = () => {},
  onSelectFile = () => {},
  onLockApp = () => {},
}) => {
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
      case 'architecture': return 'Kiến trúc & DB Schema';
      default: return 'Cấu hình & Mở rộng';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0F0F0F]/95 backdrop-blur border-b border-[#2A2A2A] text-[#E0E0E0]">
      {/* Top Navbar Row */}
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-2 sm:gap-3 md:gap-4">
        
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-sm bg-[#151515] border border-[#2A2A2A] flex items-center justify-center text-[#D4AF37] shrink-0">
            <Sparkles className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#D4AF37]" />
          </div>
          <div className="shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="font-editorial-serif italic text-xl sm:text-2xl text-[#D4AF37] tracking-tight whitespace-nowrap">
                Architect.OS
              </h1>
              <span className="text-[8px] sm:text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-sm bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/30 whitespace-nowrap">
                v2.4.0
              </span>
            </div>
            <p className="text-[9px] uppercase tracking-widest text-[#888888] hidden sm:block whitespace-nowrap">AI Productivity Suite</p>
          </div>
        </div>

        {/* Global Search Input - Dedicated Section that flexes dynamically without pushing buttons out */}
        <div className="flex-1 min-w-0 max-w-lg lg:max-w-xl mx-1 sm:mx-3 relative">
          <GlobalSearchInput
            placeholder="Tìm kiếm công việc, ghi chú, tài liệu (gõ # để gợi ý tag)..."
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

        {/* Actions & Profile (Always stays in viewport without clipping) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Quick Create Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={openNewTaskModal}
              className="px-2.5 sm:px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-sm bg-[#D4AF37] text-black hover:bg-[#c29f2e] transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0 whitespace-nowrap"
              title="Tạo công việc mới"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span className="hidden sm:inline">Thêm Task</span>
              <span className="sm:hidden">Task</span>
            </button>
            <button
              onClick={openNewNoteModal}
              className="px-2.5 sm:px-3.5 py-2 text-xs font-semibold uppercase tracking-wider rounded-sm bg-[#161616] border border-[#2E2E2E] text-[#E0E0E0] hover:border-[#D4AF37]/50 hover:text-[#D4AF37] hover:bg-[#1C1C1C] transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
              title="Tạo ghi chú mới"
            >
              <Plus className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span className="hidden sm:inline">Ghi Chú</span>
              <span className="sm:hidden">Note</span>
            </button>
          </div>

          {/* Unified Cloud Firestore & Google Drive Status Pill */}
          <div className="hidden xl:flex items-center gap-2 px-2.5 py-1.5 bg-[#141414] border border-[#282828] rounded-sm text-[11px] text-[#A0A0A0] shrink-0 whitespace-nowrap" title="Firestore DB & Google Drive tự động đồng bộ thời gian thực">
            <span className="text-amber-400 font-bold flex items-center gap-1">
              🔥 <span>Firestore</span>
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[#333]">•</span>
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <HardDrive className="w-3.5 h-3.5" />
              <span>Drive</span>
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>

          {/* Quick Lock PIN Button - guaranteed visible */}
          <button
            type="button"
            onClick={onLockApp}
            className="px-2.5 sm:px-3 py-2 rounded-sm bg-[#151515] hover:bg-[#202020] text-[#D4AF37] border border-[#2A2A2A] hover:border-[#D4AF37]/40 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap"
            title="Khóa ứng dụng (Yêu cầu mã PIN)"
          >
            <Lock className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span className="text-xs font-bold text-[#D4AF37] hidden md:inline">Khóa PIN</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="border-t border-[#2A2A2A] bg-[#0A0A0A] px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 py-2">
          
          {/* Main Navigation Tabs */}
          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2.5 sm:px-5 sm:py-3 text-sm sm:text-[14.5px] font-semibold flex items-center gap-2.5 whitespace-nowrap rounded-md transition-all duration-200 cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'text-[#D4AF37] bg-[#D4AF37]/15 border-b-2 border-[#D4AF37] shadow-[0_2px_12px_rgba(212,175,55,0.15)] font-bold'
                  : 'text-[#AAAAAA] hover:text-white hover:bg-[#1A1A1A] border-b-2 border-transparent'
              }`}
            >
              <Layers className={`w-4.5 h-4.5 transition-colors ${activeTab === 'dashboard' ? 'text-[#D4AF37]' : 'text-[#888888]'}`} />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-4 py-2.5 sm:px-5 sm:py-3 text-sm sm:text-[14.5px] font-semibold flex items-center gap-2.5 whitespace-nowrap rounded-md transition-all duration-200 cursor-pointer ${
                activeTab === 'tasks'
                  ? 'text-[#D4AF37] bg-[#D4AF37]/15 border-b-2 border-[#D4AF37] shadow-[0_2px_12px_rgba(212,175,55,0.15)] font-bold'
                  : 'text-[#AAAAAA] hover:text-white hover:bg-[#1A1A1A] border-b-2 border-transparent'
              }`}
            >
              <CheckSquare className={`w-4.5 h-4.5 transition-colors ${activeTab === 'tasks' ? 'text-[#D4AF37]' : 'text-[#888888]'}`} />
              <span>Công việc (Tasks)</span>
              {tasks.filter(t => t.status !== 'completed' && t.status !== 'canceled').length > 0 && (
                <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded-full ${
                  activeTab === 'tasks' ? 'bg-[#D4AF37] text-black font-bold' : 'bg-[#222222] text-[#AAAAAA]'
                }`}>
                  {tasks.filter(t => t.status !== 'completed' && t.status !== 'canceled').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('notes')}
              className={`px-4 py-2.5 sm:px-5 sm:py-3 text-sm sm:text-[14.5px] font-semibold flex items-center gap-2.5 whitespace-nowrap rounded-md transition-all duration-200 cursor-pointer ${
                activeTab === 'notes'
                  ? 'text-[#D4AF37] bg-[#D4AF37]/15 border-b-2 border-[#D4AF37] shadow-[0_2px_12px_rgba(212,175,55,0.15)] font-bold'
                  : 'text-[#AAAAAA] hover:text-white hover:bg-[#1A1A1A] border-b-2 border-transparent'
              }`}
            >
              <FileText className={`w-4.5 h-4.5 transition-colors ${activeTab === 'notes' ? 'text-[#D4AF37]' : 'text-[#888888]'}`} />
              <span>Ghi chú (Notes)</span>
              {notes.length > 0 && (
                <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded-full ${
                  activeTab === 'notes' ? 'bg-[#D4AF37] text-black font-bold' : 'bg-[#222222] text-[#AAAAAA]'
                }`}>
                  {notes.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('files')}
              className={`px-4 py-2.5 sm:px-5 sm:py-3 text-sm sm:text-[14.5px] font-semibold flex items-center gap-2.5 whitespace-nowrap rounded-md transition-all duration-200 cursor-pointer ${
                activeTab === 'files'
                  ? 'text-[#D4AF37] bg-[#D4AF37]/15 border-b-2 border-[#D4AF37] shadow-[0_2px_12px_rgba(212,175,55,0.15)] font-bold'
                  : 'text-[#AAAAAA] hover:text-white hover:bg-[#1A1A1A] border-b-2 border-transparent'
              }`}
            >
              <FolderSync className={`w-4.5 h-4.5 transition-colors ${activeTab === 'files' ? 'text-[#D4AF37]' : 'text-[#888888]'}`} />
              <span>Google Drive</span>
            </button>
          </div>

          {/* Right Side Settings & Tools Dropdown Trigger (Hover-activated List) */}
          <div
            className="relative shrink-0"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`h-10 px-3.5 py-2 text-sm font-semibold flex items-center gap-2.5 rounded-md transition-all duration-200 cursor-pointer border ${
                isSettingsActive
                  ? 'text-[#D4AF37] border-[#D4AF37]/60 bg-[#D4AF37]/15 shadow-[0_2px_10px_rgba(212,175,55,0.15)]'
                  : 'text-[#AAAAAA] hover:text-white border-[#2A2A2A] hover:border-[#444444] bg-[#121212] hover:bg-[#1A1A1A]'
              }`}
              title={isSettingsActive ? getActiveTabTitle() : 'Cài đặt & Tính năng mở rộng'}
            >
              <div className="relative flex items-center justify-center">
                <Settings className={`w-4.5 h-4.5 transition-transform duration-300 ${isDropdownOpen ? 'rotate-90 text-[#D4AF37]' : ''} ${isSettingsActive ? 'text-[#D4AF37]' : ''}`} />
                {isSettingsActive && !isDropdownOpen && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#D4AF37] ring-2 ring-[#0A0A0A]" />
                )}
              </div>

              <span className={`text-xs font-bold uppercase tracking-wider hidden sm:inline ${isSettingsActive ? 'text-[#D4AF37]' : 'text-[#CCCCCC]'}`}>
                {isSettingsActive ? getActiveTabTitle() : 'Cài Đặt'}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-[#D4AF37]' : 'text-[#777777]'}`} />
            </button>

            {/* Dropdown Menu List */}
            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-[#141414] border border-[#2A2A2A] rounded-lg shadow-2xl z-50 py-1.5 backdrop-blur-md animate-fadeIn divide-y divide-[#222222]">
                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#666666] flex items-center justify-between">
                  <span>Hệ thống & Trí tuệ AI</span>
                  <span className="text-[#D4AF37]">Trợ lý & Cài đặt</span>
                </div>

                <div className="p-1 space-y-0.5">
                  {/* AI Assistant Chat Trigger */}
                  <button
                    onClick={() => {
                      setIsAiDrawerOpen(true);
                      setIsDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2.5 rounded-md flex items-center justify-between text-left transition-colors cursor-pointer text-[#CCCCCC] hover:text-[#D4AF37] hover:bg-[#1E1E1E]"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-md bg-[#D4AF37]/15 text-[#D4AF37]">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                          Trò Chuyện & Hỏi AI
                        </div>
                        <div className="text-[10px] text-[#777777]">Tra cứu, phân tích & tóm tắt</div>
                      </div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1A1A1A] border border-[#333333] text-[#D4AF37] font-mono">Mở</span>
                  </button>

                  {/* Two-Way Voice Focus Mode Trigger */}
                  <button
                    onClick={() => {
                      onOpenVoiceFocus();
                      setIsDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2.5 rounded-md flex items-center justify-between text-left transition-colors cursor-pointer text-[#CCCCCC] hover:text-[#D4AF37] hover:bg-[#1E1E1E]"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-md bg-[#D4AF37]/15 text-[#D4AF37]">
                        <Mic className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                          Thoại 2 Chiều (Voice)
                        </div>
                        <div className="text-[10px] text-[#777777]">Đàm thoại tương tác âm thanh</div>
                      </div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1A1A1A] border border-[#333333] text-[#D4AF37] font-mono">Mic</span>
                  </button>

                  {/* 1. Telegram Bot */}
                  <button
                    onClick={() => {
                      setActiveTab('telegram');
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 rounded-md flex items-center justify-between text-left transition-colors cursor-pointer ${
                      activeTab === 'telegram'
                        ? 'bg-[#D4AF37]/15 text-[#D4AF37] font-bold'
                        : 'text-[#CCCCCC] hover:text-white hover:bg-[#1E1E1E]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-md ${activeTab === 'telegram' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-[#1E1E1E] text-[#888888]'}`}>
                        <Bot className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold">Telegram Bot</div>
                        <div className="text-[10px] text-[#777777]">Thông báo & Tương tác 2 chiều</div>
                      </div>
                    </div>
                    {activeTab === 'telegram' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                    )}
                  </button>

                  {/* 2. Tự Học & Tâm Trí AI */}
                  <button
                    onClick={() => {
                      setActiveTab('ai-learning');
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 rounded-md flex items-center justify-between text-left transition-colors cursor-pointer ${
                      activeTab === 'ai-learning'
                        ? 'bg-indigo-500/15 text-indigo-300 font-bold'
                        : 'text-[#CCCCCC] hover:text-white hover:bg-[#1E1E1E]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-md ${activeTab === 'ai-learning' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-[#1E1E1E] text-indigo-400/80'}`}>
                        <Brain className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold flex items-center gap-1.5">
                          Tự Học & Tâm Trí AI
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        </div>
                        <div className="text-[10px] text-[#777777]">Ký ức, Xưng hô & Suy ngẫm</div>
                      </div>
                    </div>
                    {activeTab === 'ai-learning' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    )}
                  </button>

                  {/* 3. Cài Đặt */}
                  <button
                    onClick={() => {
                      setActiveTab('settings');
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 rounded-md flex items-center justify-between text-left transition-colors cursor-pointer ${
                      activeTab === 'settings'
                        ? 'bg-[#D4AF37]/15 text-[#D4AF37] font-bold'
                        : 'text-[#CCCCCC] hover:text-white hover:bg-[#1E1E1E]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-md ${activeTab === 'settings' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-[#1E1E1E] text-[#888888]'}`}>
                        <Settings className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold">Cài Đặt</div>
                        <div className="text-[10px] text-[#777777]">Drive API, Gemini & Khóa PIN</div>
                      </div>
                    </div>
                    {activeTab === 'settings' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                    )}
                  </button>

                  {/* 4. Kiến trúc & DB Schema */}
                  <button
                    onClick={() => {
                      setActiveTab('architecture');
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 rounded-md flex items-center justify-between text-left transition-colors cursor-pointer ${
                      activeTab === 'architecture'
                        ? 'bg-[#D4AF37]/15 text-[#D4AF37] font-bold'
                        : 'text-[#CCCCCC] hover:text-white hover:bg-[#1E1E1E]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-md ${activeTab === 'architecture' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-[#1E1E1E] text-[#888888]'}`}>
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold">Kiến trúc & DB Schema</div>
                        <div className="text-[10px] text-[#777777]">Sơ đồ hạ tầng & Firestore rules</div>
                      </div>
                    </div>
                    {activeTab === 'architecture' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
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

