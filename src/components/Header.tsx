import React from 'react';
import {
  CheckSquare,
  FileText,
  FolderSync,
  Sparkles,
  Layers,
  Plus,
  Search,
  HardDrive,
  ShieldCheck,
  Bot
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'dashboard' | 'tasks' | 'notes' | 'files' | 'telegram' | 'architecture';
  setActiveTab: (tab: 'dashboard' | 'tasks' | 'notes' | 'files' | 'telegram' | 'architecture') => void;
  openNewTaskModal: () => void;
  openNewNoteModal: () => void;
  isAiDrawerOpen: boolean;
  setIsAiDrawerOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  unreadNotifsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  openNewTaskModal,
  openNewNoteModal,
  isAiDrawerOpen,
  setIsAiDrawerOpen,
  searchQuery,
  setSearchQuery,
  unreadNotifsCount,
}) => {
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

        {/* Global Search Input */}
        <div className="flex-1 max-w-md hidden md:block relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]" />
          <input
            type="text"
            placeholder="Tìm kiếm công việc, ghi chú, tệp tin..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#151515] border border-[#2A2A2A] rounded-sm text-xs text-[#E0E0E0] placeholder-[#666666] focus:outline-none focus:border-[#D4AF37] transition-colors"
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

          {/* AI Assistant Chat Trigger */}
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

          {/* Google Drive Status */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-[#151515] border border-[#2A2A2A] rounded-sm text-[11px] text-[#A0A0A0]">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span>Drive Sync</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="border-t border-[#2A2A2A] bg-[#0A0A0A] px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-1 sm:gap-4 overflow-x-auto py-1 no-scrollbar text-xs">
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

          <button
            onClick={() => setActiveTab('telegram')}
            className={`px-3 py-2 font-medium flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'telegram'
                ? 'text-[#D4AF37] border-b-2 border-[#D4AF37] font-bold'
                : 'text-[#888888] hover:text-[#E0E0E0]'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Telegram Bot</span>
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3 py-2 font-medium flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'architecture'
                ? 'text-[#D4AF37] border-b-2 border-[#D4AF37] font-bold'
                : 'text-[#888888] hover:text-[#E0E0E0]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Kiến trúc & DB Schema</span>
          </button>
        </div>
      </div>
    </header>
  );
};
