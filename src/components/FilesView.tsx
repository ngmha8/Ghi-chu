import React, { useState } from 'react';
import { DriveFile, Task, Note } from '../types/index.js';
import {
  FolderSync,
  UploadCloud,
  FileText,
  FileSpreadsheet,
  FileCode,
  Image,
  ExternalLink,
  Trash2,
  Search,
  HardDrive,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  Plus
} from 'lucide-react';

interface FilesViewProps {
  files: DriveFile[];
  tasks: Task[];
  notes: Note[];
  onFileUpload: (fileData: Partial<DriveFile>) => void;
  onFileDelete: (id: string) => void;
  openAiChatWithPrompt: (prompt: string) => void;
}

export const FilesView: React.FC<FilesViewProps> = ({
  files,
  onFileUpload,
  onFileDelete,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);

  // File Category Icon Helper
  const getFileIcon = (category: DriveFile['category']) => {
    switch (category) {
      case 'spreadsheet': return <FileSpreadsheet className="w-5 h-5 text-[#D4AF37]" />;
      case 'pdf': return <FileText className="w-5 h-5 text-rose-400" />;
      case 'presentation': return <FileText className="w-5 h-5 text-amber-400" />;
      case 'image': return <Image className="w-5 h-5 text-sky-400" />;
      default: return <FileCode className="w-5 h-5 text-[#D4AF37]" />;
    }
  };

  const handleSimulatedUpload = (fileName?: string) => {
    const defaultName = fileName || `Tailieu_DuAn_AI_${Math.floor(Math.random() * 1000)}.pdf`;
    onFileUpload({
      name: defaultName,
      mimeType: 'application/pdf',
      size: Math.floor(Math.random() * 5000000) + 200000,
      category: 'pdf',
      isSyncedToDrive: true,
    });
  };

  const handleSyncDrive = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 1200);
  };

  const filteredFiles = files.filter(f => {
    if (categoryFilter !== 'all' && f.category !== categoryFilter) return false;
    if (search.trim()) {
      return f.name.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
  const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#151515] border border-[#2A2A2A] p-5 rounded-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-sm bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/30">
            <FolderSync className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div>
            <h1 className="text-xl font-editorial-serif font-bold text-white">Quản lý Tài liệu Google Drive</h1>
            <p className="text-xs text-[#888888] italic">Đồng bộ OAuth2 hai chiều, lưu trữ metadata & liên kết trực tiếp với công việc</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncDrive}
            disabled={isSyncing}
            className="px-3 py-2 rounded-sm bg-[#0C0C0C] hover:bg-[#1A1A1A] text-[#E0E0E0] border border-[#2A2A2A] text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#D4AF37] ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ Drive'}</span>
          </button>

          <button
            onClick={() => handleSimulatedUpload()}
            className="px-4 py-2 rounded-sm bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Tải Tệp Mới</span>
          </button>
        </div>
      </div>

      {/* Storage Status & OAuth2 Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-sm bg-[#151515] border border-[#2A2A2A] flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider">Dung lượng sử dụng</span>
            <div className="text-xl font-editorial-serif font-bold text-white">{totalMb} MB <span className="text-xs text-[#666666] font-normal font-sans">/ 15 GB</span></div>
          </div>
          <HardDrive className="w-8 h-8 text-[#D4AF37]/40" />
        </div>

        <div className="p-4 rounded-sm bg-[#151515] border border-[#2A2A2A] flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider">Trạng thái Google Drive OAuth2</span>
            <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Đã kết nối tài khoản</span>
            </div>
          </div>
          <ShieldCheck className="w-8 h-8 text-emerald-400/40" />
        </div>

        <div className="p-4 rounded-sm bg-[#151515] border border-[#2A2A2A] flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider">Tổng tệp tài liệu</span>
            <div className="text-xl font-editorial-serif font-bold text-white">{files.length} tệp tin</div>
          </div>
          <FileText className="w-8 h-8 text-[#D4AF37]/40" />
        </div>
      </div>

      {/* Drag & Drop Upload Simulator Box */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleSimulatedUpload(e.dataTransfer.files[0].name);
          }
        }}
        className={`p-8 rounded-sm border border-dashed text-center transition-all cursor-pointer ${
          dragOver ? 'border-[#D4AF37] bg-[#1A1A1A]' : 'border-[#2A2A2A] bg-[#151515] hover:border-[#D4AF37]/50'
        }`}
      >
        <UploadCloud className="w-10 h-10 text-[#D4AF37] mx-auto mb-3" />
        <h3 className="text-sm font-editorial-serif font-bold text-white">Kéo thả tệp vào đây hoặc nhấn Tải tệp lên Google Drive</h3>
        <p className="text-xs text-[#888888] italic mt-1 max-w-md mx-auto">
          Hỗ trợ PDF, Excel, Word, PowerPoint, ảnh và mã nguồn. Tệp sẽ tự động mã hóa và lưu vào Google Drive của bạn.
        </p>
      </div>

      {/* Search & Category Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#151515] p-3 rounded-sm border border-[#2A2A2A]">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]" />
          <input
            type="text"
            placeholder="Tìm kiếm tài liệu theo tên tệp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-xs text-[#E0E0E0] focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {(['all', 'document', 'spreadsheet', 'presentation', 'pdf'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                categoryFilter === cat ? 'bg-[#D4AF37] text-black' : 'bg-[#0C0C0C] text-[#888888] border border-[#2A2A2A] hover:text-[#E0E0E0]'
              }`}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Files Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFiles.map(file => (
          <div
            key={file.id}
            className="p-4 rounded-sm bg-[#151515] border border-[#2A2A2A] hover:border-[#D4AF37]/50 transition-all space-y-3 flex flex-col justify-between"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] shrink-0">
                  {getFileIcon(file.category)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-editorial-serif font-bold text-white truncate">{file.name}</h3>
                  <span className="text-[10px] text-[#888888] font-mono">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB • Synced
                  </span>
                </div>
              </div>

              <button
                onClick={() => onFileDelete(file.id)}
                className="p-1.5 rounded-sm bg-[#0C0C0C] hover:bg-rose-950 text-rose-400 border border-[#2A2A2A] transition-colors cursor-pointer"
                title="Xóa tệp"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#2A2A2A]">
              <span className="text-[10px] text-[#666666] font-mono">
                {new Date(file.uploadedAt).toLocaleDateString('vi-VN')}
              </span>

              <a
                href={file.webViewLink || '#'}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded-sm bg-[#0C0C0C] text-[#D4AF37] border border-[#2A2A2A] hover:bg-[#D4AF37] hover:text-black text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
              >
                <span>Google Drive</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
