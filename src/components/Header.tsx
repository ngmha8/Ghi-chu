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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-4 shrink-0 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <div className="w-10 h-10 rounded-sm bg-[#151515] border border-[#2A2A2A] flex items-center justify-center text-[#D4AF37]">
            <Sparkles className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-editorial-serif italic text-2xl text-[#D4AF37] tracking-tight">
                Architect.OS
              </h1>
              <span className="text-[9px] uppercase tracking-[0.2em] font-bold px-2 py-0.5 rounded-sm bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/30">
                v2.4.0
              </span>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-[#888888] hidden sm:block">AI Productivity Suite</p>
          </div>
        </div>

        {/* Global Search Input with instant tasks, notes, files list results */}
        <div className="flex-1 max-w-lg hidden md:block relative">
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

        {/* Actions & Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Create Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={openNewTaskModal}
              className="px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-sm bg-[#D4AF37] text-black hover:bg-[#c29f2e] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span className="hidden sm:inline">Thêm Task</span>
            </button>
            <button
              onClick={openNewNoteModal}
              className="px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-sm bg-[#1A1A1A] border border-[#2A2A2A] text-[#E0E0E0] hover:border-[#D4AF37]/50 hover:text-[#D4AF37] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span className="hidden sm:inline">Ghi Chú</span>
            </button>
          </div>

          {/* AI Assistant Chat & Voice Mode Triggers */}
          <button
            onClick={onOpenVoiceFocus}
            className="px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-sm bg-[#151515] border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title="Mở chế độ đàm thoại giọng nói 2 chiều toàn màn hình (Focus Mode)"
          >
            <Mic className="w-3.5 h-3.5 text-[#D4AF37] animate-pulse" />
            <span className="hidden lg:inline">Thoại 2 Chiều</span>
          </button>

          <button
            onClick={() => setIsAiDrawerOpen(!isAiDrawerOpen)}
            className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-sm flex items-center gap-2 transition-all cursor-pointer ${
              isAiDrawerOpen
                ? 'bg-[#D4AF37] text-black border border-[#D4AF37]'
                : 'bg-[#151515] border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#1A1A1A]'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            <span className="hidden md:inline">Hỏi AI</span>
          </button>

          {/* Cloud Firestore & Google Drive Status */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-[#151515] border border-[#2A2A2A] rounded-sm text-[11px] text-[#A0A0A0]">
            <span className="text-amber-400 font-bold flex items-center gap-1">
              🔥 Firestore
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-[#151515] border border-[#2A2A2A] rounded-sm text-[11px] text-[#A0A0A0]">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span>Drive Sync</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>

          {/* Quick Lock Button */}
          <button
            type="button"
            onClick={onLockApp}
            className="p-2 rounded-sm bg-[#151515] hover:bg-[#202020] text-[#888888] hover:text-[#D4AF37] border border-[#2A2A2A] hover:border-[#D4AF37]/40 transition-colors cursor-pointer flex items-center gap-1.5"
            title="Khóa ứng dụng (Yêu cầu mã PIN)"
          >
            <Lock className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span className="hidden xl:inline text-xs font-bold text-[#D4AF37]">Khóa PIN</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="border-t border-[#2A2A2A] bg-[#0A0A0A] px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 py-1 text-xs">
          
          {/* Main Navigation Tabs */}
          <div className="flex items-center gap-1 sm:gap-4 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-2 font-medium flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'text-[#D4AF37] border-b-2 border-[#D4AF37] font-bold'
                  : 'text-[#888888] hover:text-[#E0E0E0]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-3 py-2 font-medium flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'tasks'
                  ? 'text-[#D4AF37] border-b-2 border-[#D4AF37] font-bold'
                  : 'text-[#888888] hover:text-[#E0E0E0]'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Công việc (Tasks)</span>
            </button>

            <button
              onClick={() => setActiveTab('notes')}
              className={`px-3 py-2 font-medium flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'notes'
                  ? 'text-[#D4AF37] border-b-2 border-[#D4AF37] font-bold'
                  : 'text-[#888888] hover:text-[#E0E0E0]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Ghi chú (Notes)</span>
            </button>

            <button
              onClick={() => setActiveTab('files')}
              className={`px-3 py-2 font-medium flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'files'
                  ? 'text-[#D4AF37] border-b-2 border-[#D4AF37] font-bold'
                  : 'text-[#888888] hover:text-[#E0E0E0]'
              }`}
            >
              <FolderSync className="w-3.5 h-3.5" />
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
              className={`h-8 px-2.5 py-1.5 font-medium flex items-center gap-2 rounded-sm transition-all duration-200 cursor-pointer border ${
                isSettingsActive
                  ? 'text-[#D4AF37] border-[#D4AF37]/50 bg-[#151515]'
                  : 'text-[#888888] hover:text-[#E0E0E0] border-transparent hover:border-[#2A2A2A] hover:bg-[#121212]'
              }`}
              title={isSettingsActive ? getActiveTabTitle() : 'Cài đặt & Tính năng mở rộng'}
            >
              <div className="relative flex items-center justify-center">
                <Settings className={`w-4 h-4 transition-transform duration-300 ${isDropdownOpen ? 'rotate-90 text-[#D4AF37]' : ''} ${isSettingsActive ? 'text-[#D4AF37]' : ''}`} />
                {isSettingsActive && !isDropdownOpen && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#D4AF37] ring-1 ring-[#0A0A0A]" />
                )}
              </div>

              {/* Text label only appears when hovered/dropdown is open */}
              {isDropdownOpen && (
                <div className="flex items-center gap-1.5 animate-fadeIn overflow-hidden whitespace-nowrap">
                  <span className="text-xs font-semibold text-[#D4AF37]">
                    {isSettingsActive ? getActiveTabTitle() : 'Cài Đặt & Mở Rộng'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 rotate-180 text-[#D4AF37]" />
                </div>
              )}
            </button>

            {/* Dropdown Menu List */}
            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-[#141414] border border-[#2A2A2A] rounded-lg shadow-2xl z-50 py-1.5 backdrop-blur-md animate-fadeIn divide-y divide-[#222222]">
                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#666666] flex items-center justify-between">
                  <span>Hệ thống & Trí tuệ AI</span>
                  <span className="text-[#D4AF37]">4 tính năng</span>
                </div>

                <div className="p-1 space-y-0.5">
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

