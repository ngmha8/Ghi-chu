import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FolderOpen,
  Globe,
  ExternalLink,
  X,
  FileCheck,
  CheckSquare,
  Square,
  Sparkles,
  Info
} from 'lucide-react';
import { api } from '../services/api.js';

export interface DuplicateFileInfo {
  id: string;
  name: string;
  size?: string;
  sizeNumber: number;
  modifiedTime?: string;
  webViewLink?: string;
  isStub: boolean;
}

export interface DuplicateGroup {
  name: string;
  keeper: {
    id: string;
    name: string;
    size?: string;
    sizeNumber: number;
    modifiedTime?: string;
    webViewLink?: string;
  };
  duplicates: DuplicateFileInfo[];
  totalCopies: number;
  reclaimableBytes: number;
}

interface CleanDriveDuplicatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId?: string;
  folderName?: string;
  onCleanCompleted?: (cleanedCount: number) => void;
}

export const CleanDriveDuplicatesModal: React.FC<CleanDriveDuplicatesModalProps> = ({
  isOpen,
  onClose,
  folderId,
  folderName,
  onCleanCompleted,
}) => {
  const [scope, setScope] = useState<'folder' | 'all'>('folder');
  const [isScanning, setIsScanning] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    totalScanned: number;
    totalGroups: number;
    totalDuplicateFiles: number;
    totalSpaceReclaimable: number;
    groups: DuplicateGroup[];
  } | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [cleanSummary, setCleanSummary] = useState<{
    cleanedCount: number;
    message: string;
    details: string[];
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterStubsOnly, setFilterStubsOnly] = useState(false);

  // Auto-scan whenever modal opens or scope changes
  useEffect(() => {
    if (isOpen) {
      handleScan(scope);
    } else {
      setCleanSummary(null);
      setErrorMessage(null);
      setSelectedFileIds(new Set());
    }
  }, [isOpen, scope]);

  const handleScan = async (selectedScope: 'folder' | 'all') => {
    setIsScanning(true);
    setErrorMessage(null);
    setCleanSummary(null);
    try {
      const res = await api.scanDriveDuplicates(folderId, selectedScope);
      setScanResult(res);

      // Default: select all duplicates for one-click clean
      const allDupIds = new Set<string>();
      for (const group of res.groups) {
        for (const dup of group.duplicates) {
          allDupIds.add(dup.id);
        }
      }
      setSelectedFileIds(allDupIds);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể quét tệp trùng lặp trên Google Drive.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleToggleSelectAll = () => {
    if (!scanResult) return;
    const allDupIds = new Set<string>();
    for (const group of scanResult.groups) {
      for (const dup of group.duplicates) {
        if (!filterStubsOnly || dup.isStub) {
          allDupIds.add(dup.id);
        }
      }
    }

    if (selectedFileIds.size >= allDupIds.size) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(allDupIds);
    }
  };

  const handleToggleFileSelection = (id: string) => {
    const updated = new Set(selectedFileIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedFileIds(updated);
  };

  const handleExecuteClean = async (specificIds?: string[]) => {
    setIsCleaning(true);
    setErrorMessage(null);
    try {
      const idsToClean = specificIds || Array.from(selectedFileIds);
      const res = await api.cleanDriveDuplicates(folderId, scope, idsToClean);
      setCleanSummary(res);

      if (onCleanCompleted && res.cleanedCount > 0) {
        onCleanCompleted(res.cleanedCount);
      }

      // Re-scan to show fresh cleaned state
      setTimeout(() => {
        handleScan(scope);
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Lỗi khi xóa tệp trùng lặp.');
    } finally {
      setIsCleaning(false);
    }
  };

  if (!isOpen) return null;

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const displayedGroups = scanResult?.groups.filter(group => {
    if (!filterStubsOnly) return true;
    return group.duplicates.some(d => d.isStub);
  }) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#141414] border border-[#2F2F2F] rounded-md shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#2A2A2A] bg-[#181818] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded bg-rose-950/60 border border-rose-600/40 text-rose-400">
              <ShieldCheck className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-editorial-serif font-bold text-white flex items-center gap-2">
                <span>Dọn Tệp Trùng Lặp Trên Google Drive</span>
                {scanResult && scanResult.totalDuplicateFiles > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    {scanResult.totalDuplicateFiles} bản sao
                  </span>
                )}
              </h2>
              <p className="text-xs text-[#888888]">
                Tự động phát hiện và loại bỏ các bản sao rỗng 260 byte, bản tải lặp lại để giải phóng dung lượng Drive
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#888888] hover:text-white rounded hover:bg-[#252525] transition-colors cursor-pointer"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scope Selector Bar */}
        <div className="px-5 py-3 bg-[#111111] border-b border-[#222222] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#888888] font-medium">Phạm vi quét:</span>
            <div className="flex items-center bg-[#1A1A1A] border border-[#333333] rounded p-0.5">
              <button
                type="button"
                onClick={() => setScope('folder')}
                className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  scope === 'folder'
                    ? 'bg-[#D4AF37] text-black font-bold shadow-xs'
                    : 'text-[#888888] hover:text-white'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>{folderName ? `Thư mục "${folderName}"` : 'Thư mục đồng bộ'}</span>
              </button>
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  scope === 'all'
                    ? 'bg-[#D4AF37] text-black font-bold shadow-xs'
                    : 'text-[#888888] hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Toàn bộ Google Drive</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleScan(scope)}
              disabled={isScanning || isCleaning}
              className="px-3 py-1 rounded bg-[#1C1C1C] hover:bg-[#2A2A2A] text-[#D4AF37] border border-[#D4AF37]/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Đang quét Drive...' : 'Quét Lại'}</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded bg-rose-950/70 border border-rose-600/80 text-rose-200 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white text-xs">✕</button>
            </div>
          )}

          {/* Clean Success Banner */}
          {cleanSummary && (
            <div className="p-3.5 rounded bg-emerald-950/70 border border-emerald-600/80 text-emerald-200 text-xs space-y-1.5 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{cleanSummary.message}</span>
              </div>
              {cleanSummary.details.length > 0 && (
                <div className="max-h-24 overflow-y-auto text-[11px] text-emerald-300/80 pl-6 space-y-0.5">
                  {cleanSummary.details.slice(0, 5).map((detail, idx) => (
                    <div key={idx}>• {detail}</div>
                  ))}
                  {cleanSummary.details.length > 5 && (
                    <div className="italic">...và {cleanSummary.details.length - 5} thao tác khác.</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Scanning State */}
          {isScanning && (
            <div className="p-12 text-center space-y-3">
              <RefreshCw className="w-10 h-10 text-[#D4AF37] animate-spin mx-auto" />
              <h3 className="text-sm font-bold text-white">Đang quét toàn bộ danh sách tệp trên Google Drive...</h3>
              <p className="text-xs text-[#888888] max-w-md mx-auto">
                Hệ thống đang đối chiếu tên tệp, ngày sửa đổi và dung lượng (phát hiện các bản 260 byte và bản lặp lại)...
              </p>
            </div>
          )}

          {/* Cleaned & Scan Results */}
          {!isScanning && scanResult && (
            <>
              {scanResult.totalDuplicateFiles === 0 ? (
                /* No Duplicates Found */
                <div className="p-10 text-center bg-[#181818] border border-[#2A2A2A] rounded-sm space-y-3">
                  <FileCheck className="w-12 h-12 text-emerald-400 mx-auto" />
                  <h3 className="text-base font-editorial-serif font-bold text-white">
                    Google Drive Sạch Sẽ — Không Có Tệp Trùng Lặp!
                  </h3>
                  <p className="text-xs text-[#888888] max-w-md mx-auto leading-relaxed">
                    Đã kiểm tra <strong>{scanResult.totalScanned}</strong> tệp trong {scope === 'folder' ? 'thư mục đồng bộ' : 'toàn bộ Google Drive'}. Tất cả các tệp đều độc bản và không có bản sao rác 260 byte nào.
                  </p>
                </div>
              ) : (
                /* Duplicates Found */
                <div className="space-y-3">
                  {/* Summary Bar */}
                  <div className="p-3 rounded bg-[#1B1814] border border-[#40341B] flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                      <span className="text-[#E0E0E0]">
                        Phát hiện <strong className="text-rose-400 font-bold">{scanResult.totalDuplicateFiles}</strong> bản sao dư thừa trong <strong className="text-white">{scanResult.totalGroups}</strong> nhóm tài liệu.
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[#888888] font-mono">
                        Dung lượng giải phóng: <strong className="text-[#D4AF37]">{formatSize(scanResult.totalSpaceReclaimable)}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setFilterStubsOnly(!filterStubsOnly)}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                          filterStubsOnly
                            ? 'bg-amber-950 text-amber-300 border-amber-600'
                            : 'bg-[#222222] text-[#888888] border-[#333333] hover:text-white'
                        }`}
                      >
                        Chỉ lọc bản rác (&lt;1KB)
                      </button>
                    </div>
                  </div>

                  {/* List of Duplicate Groups */}
                  <div className="space-y-3">
                    {displayedGroups.map((group, groupIdx) => (
                      <div
                        key={groupIdx}
                        className="p-3.5 rounded bg-[#181818] border border-[#2A2A2A] hover:border-[#3A3A3A] transition-colors space-y-2.5"
                      >
                        {/* Group Title */}
                        <div className="flex items-start justify-between gap-2 border-b border-[#252525] pb-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-white break-words" title={group.name}>
                              📄 {group.name}
                            </h4>
                            <span className="text-[10px] text-[#888888] font-mono">
                              Có tổng cộng {group.totalCopies} bản trên Drive • Có thể giải phóng {formatSize(group.reclaimableBytes)}
                            </span>
                          </div>
                        </div>

                        {/* Keeper File (Safely preserved) */}
                        <div className="p-2.5 rounded bg-[#101A14] border border-emerald-800/60 flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px] font-bold uppercase shrink-0">
                              ✅ Bản chuẩn (Giữ lại)
                            </span>
                            <span className="font-mono text-emerald-400 font-semibold text-[11px] shrink-0">
                              {formatSize(group.keeper.sizeNumber)}
                            </span>
                            {group.keeper.modifiedTime && (
                              <span className="text-[10px] text-[#888888] font-mono truncate">
                                Sửa đổi: {new Date(group.keeper.modifiedTime).toLocaleString('vi-VN')}
                              </span>
                            )}
                          </div>

                          {group.keeper.webViewLink && (
                            <a
                              href={group.keeper.webViewLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 shrink-0"
                            >
                              <span>Xem</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>

                        {/* Duplicates to be removed */}
                        <div className="space-y-1.5 pl-2 border-l-2 border-rose-900/60">
                          {group.duplicates.map((dup) => {
                            const isSelected = selectedFileIds.has(dup.id);
                            return (
                              <div
                                key={dup.id}
                                onClick={() => handleToggleFileSelection(dup.id)}
                                className={`p-2 rounded border text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-rose-950/40 border-rose-800 text-rose-200'
                                    : 'bg-[#121212] border-[#262626] text-[#888888] hover:border-[#444444]'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4 text-rose-400 shrink-0" />
                                  ) : (
                                    <Square className="w-4 h-4 text-[#555555] shrink-0" />
                                  )}

                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase shrink-0 ${
                                    dup.isStub
                                      ? 'bg-amber-950/80 text-amber-300 border border-amber-700'
                                      : 'bg-rose-950 text-rose-300 border border-rose-800'
                                  }`}>
                                    {dup.isStub ? '⚠️ Bản rác / Stub' : 'Bản sao thừa'}
                                  </span>

                                  <span className="font-mono font-semibold text-[11px] text-white shrink-0">
                                    {formatSize(dup.sizeNumber)}
                                  </span>

                                  {dup.modifiedTime && (
                                    <span className="text-[10px] text-[#777777] font-mono truncate">
                                      {new Date(dup.modifiedTime).toLocaleString('vi-VN')}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {dup.webViewLink && (
                                    <a
                                      href={dup.webViewLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-[10px] text-[#888888] hover:text-white flex items-center gap-0.5"
                                    >
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleExecuteClean([dup.id]);
                                    }}
                                    disabled={isCleaning}
                                    className="p-1 text-[#888888] hover:text-rose-400 hover:bg-rose-950/50 rounded transition-colors"
                                    title="Xóa ngay bản này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#2A2A2A] bg-[#181818] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            {scanResult && scanResult.totalDuplicateFiles > 0 && (
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="text-[#AAAAAA] hover:text-white cursor-pointer font-medium underline text-xs"
              >
                {selectedFileIds.size > 0 ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </button>
            )}
            <span className="text-[11px] text-[#777777]">
              {selectedFileIds.size > 0 && `Đã chọn ${selectedFileIds.size} bản sao`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-[#252525] hover:bg-[#333333] text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              Đóng
            </button>

            {scanResult && scanResult.totalDuplicateFiles > 0 && (
              <button
                type="button"
                onClick={() => handleExecuteClean(Array.from(selectedFileIds))}
                disabled={isCleaning || selectedFileIds.size === 0}
                className="px-4 py-2 rounded bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                <Trash2 className={`w-3.5 h-3.5 ${isCleaning ? 'animate-spin' : ''}`} />
                <span>
                  {isCleaning
                    ? 'Đang xóa...'
                    : `Xóa ${selectedFileIds.size} Bản Sao Trùng Lặp`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
