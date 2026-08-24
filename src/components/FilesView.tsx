import React, { useState, useRef, useEffect, useMemo } from 'react';
import { DriveFile, Task, Note, DriveServiceAccountConfig, DocumentCategory } from '../types/index.js';
import { TagSearchInput } from './TagSearchInput.js';
import { api } from '../services/api.js';
import {
  initGoogleAuth,
  signInWithGoogleWorkspace,
  googleSignOut,
  getGoogleAccessToken
} from '../services/googleAuth.js';
import { uploadLocalFileToUserGoogleDrive } from '../services/googleDriveUpload.js';
import { User as FirebaseUser } from 'firebase/auth';
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
  Plus,
  Sparkles,
  Eye,
  Download,
  X,
  FileCheck,
  Calendar,
  Layers,
  File,
  Edit3,
  Link,
  FolderOpen,
  AlertCircle,
  AlertTriangle,
  FileUp,
  Cloud,
  CloudOff,
  Clock,
  Check,
  ArrowUpRight,
  Maximize2,
  Folder,
  Settings,
  FolderLock,
  Tag,
  ChevronDown,
  Briefcase,
  User,
  DollarSign,
  Scale,
  FolderKanban,
  Globe,
  Key,
  Copy
} from 'lucide-react';
import {
  getStoredCategories,
  saveStoredCategories,
  resolveCategory,
  CATEGORY_COLORS,
  DEFAULT_DOCUMENT_CATEGORIES
} from '../services/docClassification.js';
import { ManageCategoriesModal, renderCategoryIcon } from './ManageCategoriesModal.js';

interface FilesViewProps {
  files: DriveFile[];
  tasks: Task[];
  notes: Note[];
  onFileUpload: (fileData: Partial<DriveFile>) => Promise<DriveFile | null> | void;
  onFileDelete: (id: string) => void;
  onFileUpdate?: (id: string, fileData: Partial<DriveFile>) => void;
  openAiChatWithPrompt: (prompt: string) => void;
  onNavigateToSettings?: () => void;
}

export const FilesView: React.FC<FilesViewProps> = ({
  files,
  tasks,
  notes,
  onFileUpload,
  onFileDelete,
  onFileUpdate,
  openAiChatWithPrompt,
  onNavigateToSettings
}) => {
  const [search, setSearch] = useState('');
  
  // Document Classification state (Công việc, Cá nhân, Mẫu giấy tờ, Tài chính...)
  const [categories, setCategories] = useState<DocumentCategory[]>(() => getStoredCategories());
  const [selectedClassification, setSelectedClassification] = useState<string>('all');
  const [isManagingCategories, setIsManagingCategories] = useState(false);

  // Format Type Filter (Document, Spreadsheet, PDF...)
  const [formatFilter, setFormatFilter] = useState<DriveFile['category'] | 'all'>('all');

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Service Account State
  const [saConfig, setSaConfig] = useState<DriveServiceAccountConfig | null>(null);
  const [isSyncingSa, setIsSyncingSa] = useState(false);

  // Google OAuth User State
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [isLoggingInGoogle, setIsLoggingInGoogle] = useState(false);
  const [syncingDriveFileId, setSyncingDriveFileId] = useState<string | null>(null);

  // Syncing state per file
  const [syncingFileIds, setSyncingFileIds] = useState<Record<string, boolean>>({});

  // Upload progress for local ingestion
  const [uploadProgress, setUploadProgress] = useState<{
    fileName: string;
    progress: number;
    statusText: string;
    active: boolean;
  } | null>(null);

  // Google Drive Sync Progress State (Progress Bar & Current File)
  const [driveSyncProgress, setDriveSyncProgress] = useState<{
    fileName: string;
    current: number;
    total: number;
    percent: number;
    statusText: string;
    active: boolean;
  } | null>(null);

  // Drag & drop
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // In-App Document Preview Modal
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Custom Google Drive Link Modal
  const [editingUrlFile, setEditingUrlFile] = useState<DriveFile | null>(null);
  const [inputUrl, setInputUrl] = useState('');

  // Delete Confirmation Modal
  const [fileToDelete, setFileToDelete] = useState<DriveFile | null>(null);

  // Quick Inline Category Switcher state (fileId -> open/close)
  const [openCategoryPopoverFileId, setOpenCategoryPopoverFileId] = useState<string | null>(null);

  const [popoverNewCatInput, setPopoverNewCatInput] = useState('');

  // Category Deletion Confirmation & Warning State
  const [categoryToDelete, setCategoryToDelete] = useState<{ category: DocumentCategory; fileCount: number } | null>(null);

  // Initialize Google Auth state listener
  useEffect(() => {
    const unsub = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
      },
      () => {
        setGoogleUser(null);
      }
    );
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  // Load Service Account config on mount
  useEffect(() => {
    api.getDriveServiceAccountConfig()
      .then(cfg => {
        setSaConfig(cfg);
      })
      .catch(e => console.warn('Could not load SA config:', e));
  }, []);

  // Save updated categories
  const handleSaveCategories = (newCategories: DocumentCategory[]) => {
    setCategories(newCategories);
    saveStoredCategories(newCategories);
  };

  // Compute file counts per classification
  const classificationCounts = useMemo(() => {
    const counts: Record<string, number> = { all: files.length };
    categories.forEach(c => { counts[c.id] = 0; });

    files.forEach(f => {
      const cat = f.classification || 'other';
      // Match by ID or Name
      const match = categories.find(c => c.id === cat || c.name.toLowerCase() === cat.toLowerCase());
      const catKey = match ? match.id : (cat || 'other');
      counts[catKey] = (counts[catKey] || 0) + 1;
    });

    return counts;
  }, [files, categories]);

  // Handle Sync with Service Account
  const handleSyncFromServiceAccount = async () => {
    setIsSyncingSa(true);
    setSyncStatusMsg('Đang quét và đồng bộ tệp từ Google Drive (Service Account)...');
    try {
      const res = await api.syncDriveServiceAccount();
      setSyncStatusMsg(`✅ Đã đồng bộ thành công ${res.syncedCount} tệp từ Google Drive!`);
      const cfg = await api.getDriveServiceAccountConfig();
      setSaConfig(cfg);
      window.location.reload();
    } catch (err: any) {
      setSyncStatusMsg(`❌ ${err.message || 'Lỗi khi đồng bộ từ Google Drive'}`);
    } finally {
      setIsSyncingSa(false);
    }
  };

  // Fetch preview content when preview modal opens
  useEffect(() => {
    if (!previewFile) {
      setPreviewContent(null);
      return;
    }

    if (previewFile.textContent) {
      setPreviewContent(previewFile.textContent);
      return;
    }

    // Try fetching preview from backend
    setIsLoadingPreview(true);
    fetch(`/api/files/preview/${previewFile.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.textContent) {
          setPreviewContent(data.textContent);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingPreview(false));
  }, [previewFile]);

  // Handle Google Workspace 1-Click Sign-in
  const handleGoogleSignInClick = async () => {
    setIsLoggingInGoogle(true);
    setAuthError(null);
    try {
      const res = await signInWithGoogleWorkspace();
      if (res?.user) {
        setGoogleUser(res.user);
        setSyncStatusMsg(`✅ Đã kết nối Google Drive tài khoản: ${res.user.email}`);
        setTimeout(() => setSyncStatusMsg(null), 4000);
      }
    } catch (err: any) {
      setAuthError(`Lỗi đăng nhập Google: ${err?.message || 'Không thể xác thực'}`);
    } finally {
      setIsLoggingInGoogle(false);
    }
  };

  const handleGoogleSignOutClick = async () => {
    try {
      await googleSignOut();
      setGoogleUser(null);
      setSyncStatusMsg('Đã đăng xuất tài khoản Google.');
      setTimeout(() => setSyncStatusMsg(null), 3000);
    } catch (err: any) {
      console.warn('Sign out error:', err);
    }
  };

  // 1-Click Sync Local File to Personal Google Drive
  const handleSyncLocalFileToUserDrive = async (file: DriveFile) => {
    setSyncingDriveFileId(file.id);
    setAuthError(null);
    setDriveSyncProgress({
      fileName: file.name,
      current: 1,
      total: 1,
      percent: 25,
      statusText: 'Đang chuẩn bị đẩy tệp lên Google Drive...',
      active: true,
    });
    setSyncStatusMsg(`Đang đẩy tệp "${file.name}" lên Google Drive cá nhân...`);

    try {
      const targetFolderId = saConfig?.folderId || localStorage.getItem('app_sa_folder_id') || undefined;
      
      setDriveSyncProgress(prev => prev ? { ...prev, percent: 60, statusText: 'Đang tải nhị phân lên Google Drive...' } : null);
      const uploaded = await uploadLocalFileToUserGoogleDrive(file.id, targetFolderId);

      setDriveSyncProgress(prev => prev ? { ...prev, percent: 95, statusText: 'Đã hoàn tất lưu Drive & giải phóng bộ nhớ cục bộ...' } : null);

      if (onFileUpdate && uploaded.file) {
        onFileUpdate(file.id, uploaded.file);
      } else if (onFileUpdate) {
        onFileUpdate(file.id, {
          isSyncedToDrive: true,
          driveFileId: uploaded.driveFileId,
          webViewLink: uploaded.webViewLink,
          syncStatus: 'synced',
        } as any);
      }

      setDriveSyncProgress({
        fileName: file.name,
        current: 1,
        total: 1,
        percent: 100,
        statusText: 'Đã lưu Google Drive thành công!',
        active: false,
      });

      setSyncStatusMsg(`✅ Đã lưu "${file.name}" lên Google Drive & dọn dẹp file nội bộ!`);
      setTimeout(() => {
        setSyncStatusMsg(null);
        setDriveSyncProgress(null);
      }, 4000);
    } catch (err: any) {
      console.error('Error syncing file to Drive:', err);
      setAuthError(`Lỗi đồng bộ lên Google Drive: ${err?.message || 'Vui lòng kiểm tra quyền truy cập.'}`);
      setDriveSyncProgress(null);
    } finally {
      setSyncingDriveFileId(null);
    }
  };

  // 1-Click Sync ALL Local Files to Personal Google Drive
  const handleSyncAllLocalFilesToUserDrive = async () => {
    const localFiles = files.filter(f => !f.isSyncedToDrive && f.syncStatus !== 'synced');
    if (localFiles.length === 0) {
      setSyncStatusMsg('Tất cả các tệp hiện tại đã được đồng bộ trên Google Drive!');
      setTimeout(() => setSyncStatusMsg(null), 3000);
      return;
    }

    setAuthError(null);
    setDriveSyncProgress({
      fileName: localFiles[0].name,
      current: 1,
      total: localFiles.length,
      percent: 5,
      statusText: `Bắt đầu đồng bộ 1/${localFiles.length}...`,
      active: true,
    });
    setSyncStatusMsg(`Bắt đầu đồng bộ ${localFiles.length} tệp cục bộ lên Google Drive...`);
    let successCount = 0;
    const targetFolderId = saConfig?.folderId || localStorage.getItem('app_sa_folder_id') || undefined;

    for (let i = 0; i < localFiles.length; i++) {
      const f = localFiles[i];
      const currentPercent = Math.round(((i) / localFiles.length) * 100);
      setSyncingDriveFileId(f.id);
      setDriveSyncProgress({
        fileName: f.name,
        current: i + 1,
        total: localFiles.length,
        percent: Math.max(5, currentPercent),
        statusText: `Đang tải (${i + 1}/${localFiles.length}): ${f.name}...`,
        active: true,
      });

      try {
        const uploaded = await uploadLocalFileToUserGoogleDrive(f.id, targetFolderId);
        if (onFileUpdate && uploaded.file) {
          onFileUpdate(f.id, uploaded.file);
        } else if (onFileUpdate) {
          onFileUpdate(f.id, {
            isSyncedToDrive: true,
            driveFileId: uploaded.driveFileId,
            webViewLink: uploaded.webViewLink,
            syncStatus: 'synced',
          } as any);
        }
        successCount++;
        const nextPercent = Math.round(((i + 1) / localFiles.length) * 100);
        setDriveSyncProgress(prev => prev ? { ...prev, percent: nextPercent, statusText: `Đã xong (${i + 1}/${localFiles.length}): ${f.name}` } : null);
      } catch (err: any) {
        console.error(`Error syncing file ${f.name}:`, err);
        setAuthError(`Lỗi khi tải tệp "${f.name}": ${err?.message || 'Lỗi xác thực'}`);
      }
    }

    setSyncingDriveFileId(null);
    if (successCount > 0) {
      setDriveSyncProgress({
        fileName: `${successCount} tệp`,
        current: successCount,
        total: localFiles.length,
        percent: 100,
        statusText: `Đã đồng bộ thành công ${successCount}/${localFiles.length} tệp!`,
        active: false,
      });
      setSyncStatusMsg(`✅ Đã đồng bộ thành công ${successCount}/${localFiles.length} tệp lên Google Drive & xóa lưu trữ cục bộ!`);
    }

    setTimeout(() => {
      setSyncStatusMsg(null);
      setDriveSyncProgress(null);
    }, 4500);
  };

  // Unified handler to sync all pre-existing files directly from Google Drive
  const handleUnifiedSyncDriveFiles = async () => {
    setAuthError(null);
    setSyncStatusMsg(null);

    // Prefer Service Account if connected or configured
    if (saConfig?.isConnected || (saConfig?.clientEmail && saConfig?.folderId)) {
      setIsSyncingSa(true);
      setSyncStatusMsg('Đang quét và nạp toàn bộ file sẵn có từ thư mục Google Drive (Service Account)...');
      try {
        const res = await api.syncDriveServiceAccount();
        setSyncStatusMsg(`✅ Đã đồng bộ thành công ${res.syncedCount} tệp sẵn có từ Google Drive!`);
        if (res.files && res.files.length > 0) {
          const currentIds = new Set(files.map(f => f.driveFileId || f.id));
          for (const f of res.files) {
            if (!currentIds.has(f.driveFileId || f.id)) {
              onFileUpload(f);
            }
          }
        }
        setTimeout(() => setSyncStatusMsg(null), 5000);
      } catch (err: any) {
        console.error('Service Account sync error:', err);
        setAuthError(`Lỗi đồng bộ Service Account: ${err.message || 'Không thể kết nối Drive. Vui lòng kiểm tra cấu hình trong Cài Đặt.'}`);
      } finally {
        setIsSyncingSa(false);
      }
      return;
    }

    // Not configured yet -> prompt user to open Settings
    setAuthError('Chưa kết nối Google Drive Service Account! Vui lòng vào Cài Đặt để dán Key Service Account.');
  };

  // Change Classification for a file
  const handleUpdateFileClassification = (fileId: string, newClassification: string) => {
    if (onFileUpdate) {
      onFileUpdate(fileId, { classification: newClassification });
    }
    if (previewFile?.id === fileId) {
      setPreviewFile({
        ...previewFile,
        classification: newClassification,
      });
    }
    setOpenCategoryPopoverFileId(null);
  };

  // Create a new classification directly (from popover, top bar, or modal)
  const handleCreateNewCategory = (catName: string, targetFileId?: string) => {
    const trimmed = catName.trim();
    if (!trimmed) return;

    // Check if category already exists (case-insensitive)
    const existing = categories.find(c => c.name.toLowerCase() === trimmed.toLowerCase() || c.id.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      if (targetFileId) {
        handleUpdateFileClassification(targetFileId, existing.id);
      }
      return;
    }

    const PALETTE = ['emerald', 'blue', 'amber', 'teal', 'rose', 'purple', 'indigo', 'cyan'];
    const nextColor = PALETTE[categories.length % PALETTE.length];

    const newCat: DocumentCategory = {
      id: `cat-${Date.now()}`,
      name: trimmed,
      color: nextColor,
      icon: 'Tag',
      description: `Phân loại ${trimmed}`,
      isDefault: false,
    };

    const updated = [...categories, newCat];
    handleSaveCategories(updated);

    if (targetFileId) {
      handleUpdateFileClassification(targetFileId, newCat.id);
    }
  };

  // Request category deletion with active document warning
  const handleRequestDeleteCategory = (cat: DocumentCategory) => {
    if (categories.length <= 1) {
      alert('Hệ thống cần duy trì ít nhất 1 phân loại tài liệu.');
      return;
    }
    const count = classificationCounts[cat.id] || classificationCounts[cat.name] || 0;
    setCategoryToDelete({ category: cat, fileCount: count });
  };

  // Confirm category deletion & migrate any attached files to 'other'
  const handleConfirmDeleteCategory = () => {
    if (!categoryToDelete) return;
    const { category: cat, fileCount } = categoryToDelete;

    // If there are files with this classification, migrate them to 'other'
    if (fileCount > 0 && onFileUpdate) {
      files.forEach(f => {
        const isMatch = f.classification === cat.id || f.classification?.toLowerCase() === cat.name.toLowerCase();
        if (isMatch) {
          onFileUpdate(f.id, { classification: 'other' });
        }
      });
      if (previewFile && (previewFile.classification === cat.id || previewFile.classification?.toLowerCase() === cat.name.toLowerCase())) {
        setPreviewFile({ ...previewFile, classification: 'other' });
      }
    }

    const updatedCategories = categories.filter(c => c.id !== cat.id);
    handleSaveCategories(updatedCategories);

    if (selectedClassification === cat.id) {
      setSelectedClassification('all');
    }

    setCategoryToDelete(null);
    setOpenCategoryPopoverFileId(null);
  };

  const detectFormatCategory = (filename: string, mimeType: string): DriveFile['category'] => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['xlsx', 'xls', 'csv'].includes(ext) || mimeType.includes('spreadsheet') || mimeType.includes('sheet')) return 'spreadsheet';
    if (ext === 'pdf' || mimeType.includes('pdf')) return 'pdf';
    if (['pptx', 'ppt', 'key'].includes(ext) || mimeType.includes('presentation')) return 'presentation';
    if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext) || mimeType.startsWith('image/')) return 'image';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
    return 'document';
  };

  const getFileFormatIcon = (format: DriveFile['category']) => {
    switch (format) {
      case 'spreadsheet': return <FileSpreadsheet className="w-5 h-5 text-[#D4AF37]" />;
      case 'pdf': return <FileText className="w-5 h-5 text-rose-400" />;
      case 'presentation': return <FileText className="w-5 h-5 text-amber-400" />;
      case 'image': return <Image className="w-5 h-5 text-sky-400" />;
      default: return <FileCode className="w-5 h-5 text-[#D4AF37]" />;
    }
  };

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Process Upload
  const handleProcessUpload = async (rawFile: File) => {
    const formatCat = detectFormatCategory(rawFile.name, rawFile.type);
    const fileId = `file-${Date.now()}`;
    // Assign classification based on currently selected filter, or fallback to 'work'
    const targetClassification = selectedClassification !== 'all' ? selectedClassification : 'work';

    setUploadProgress({
      active: true,
      fileName: rawFile.name,
      progress: 30,
      statusText: 'Đang chuẩn bị tệp và mã hóa dữ liệu...'
    });

    let base64Data = '';
    try {
      base64Data = await fileToBase64(rawFile);
    } catch (e) {}

    setUploadProgress({
      active: true,
      fileName: rawFile.name,
      progress: 70,
      statusText: 'Đang lưu trữ và đồng bộ Google Drive...'
    });

    const filePayload: Partial<DriveFile> & { base64Data?: string } = {
      id: fileId,
      name: rawFile.name,
      mimeType: rawFile.type || 'application/octet-stream',
      size: rawFile.size,
      category: formatCat,
      classification: targetClassification,
      tags: [resolveCategory(targetClassification, categories).name],
      isSyncedToDrive: false,
      syncStatus: 'local_only',
      downloadUrl: `/api/files/download/${fileId}`,
      uploadedAt: new Date().toISOString(),
      base64Data: base64Data,
    };

    const created = await onFileUpload(filePayload);

    if (created?.isSyncedToDrive && created?.webViewLink) {
      setUploadProgress({
        active: true,
        fileName: rawFile.name,
        progress: 100,
        statusText: '✅ Đã tải lên và kết nối Google Drive thành công!'
      });
    } else {
      setUploadProgress({
        active: true,
        fileName: rawFile.name,
        progress: 100,
        statusText: '✅ Đã lưu trữ an toàn trong kho dữ liệu & lập chỉ mục AI!'
      });
    }
    setTimeout(() => setUploadProgress(null), 2500);
  };

  const handleTriggerPicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach((f: File) => {
        handleProcessUpload(f);
      });
      e.target.value = '';
    }
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    const targetFile = fileToDelete;
    setFileToDelete(null);
    onFileDelete(targetFile.id);
  };

  const handleSaveCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUrlFile || !onFileUpdate) return;
    const finalUrl = inputUrl.trim();
    if (finalUrl) {
      onFileUpdate(editingUrlFile.id, {
        webViewLink: finalUrl,
        isSyncedToDrive: true,
        syncStatus: 'synced',
      });
      if (previewFile?.id === editingUrlFile.id) {
        setPreviewFile({
          ...previewFile,
          webViewLink: finalUrl,
          isSyncedToDrive: true,
          syncStatus: 'synced',
        });
      }
    }
    setEditingUrlFile(null);
    setInputUrl('');
  };

  // Collect available tags across linked tasks and notes
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    const defaults = ['Công việc', 'Cá nhân', 'Mẫu giấy tờ', 'Tài chính', 'Hợp đồng', 'Báo cáo', 'Dự án', 'Architecture'];
    defaults.forEach(t => set.add(t));
    tasks?.forEach(t => t.tags?.forEach(tag => tag && set.add(tag.trim())));
    notes?.forEach(n => n.tags?.forEach(tag => tag && set.add(tag.trim())));
    categories.forEach(c => set.add(c.name));
    return Array.from(set).filter(Boolean);
  }, [tasks, notes, categories]);

  // Main file filtering: Classification + Format + Search Keyword / #Tags
  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      // 1. Classification filter (Công việc, Cá nhân, Mẫu giấy tờ...)
      if (selectedClassification !== 'all') {
        const fileCat = f.classification || 'other';
        const targetCategory = categories.find(c => c.id === selectedClassification);
        const matchId = fileCat === selectedClassification;
        const matchName = targetCategory && fileCat.toLowerCase() === targetCategory.name.toLowerCase();
        if (!matchId && !matchName) return false;
      }

      // 2. Format filter (Document, Spreadsheet, PDF...)
      if (formatFilter !== 'all' && f.category !== formatFilter) {
        return false;
      }

      // 3. Search query / #tag query
      if (search.trim()) {
        const q = search.toLowerCase();
        const tagQueries = q.match(/#([\w\p{L}]+)/gu)?.map(t => t.slice(1).toLowerCase()) || [];
        const nonTagQ = q.replace(/#([\w\p{L}]+)/gu, '').trim();

        const matchName = !nonTagQ || f.name.toLowerCase().includes(nonTagQ);

        const linkedTasks = tasks.filter(t => t.attachedFileIds?.includes(f.id));
        const linkedNotes = notes.filter(n => n.attachedFileIds?.includes(f.id));
        const resolvedCat = resolveCategory(f.classification, categories);

        const fileTags = [
          ...(f.tags || []),
          resolvedCat.name,
          ...linkedTasks.flatMap(t => t.tags || []),
          ...linkedNotes.flatMap(n => n.tags || []),
          f.category
        ];

        const matchAllTags = tagQueries.length === 0 || tagQueries.every(tq => 
          fileTags.some(t => t.toLowerCase().includes(tq))
        );

        const matchAnyTag = fileTags.some(t => t.toLowerCase().includes(q));

        return (matchName && matchAllTags) || matchAnyTag;
      }
      return true;
    });
  }, [files, selectedClassification, formatFilter, search, categories, tasks, notes]);

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
  const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
  const syncedCount = files.filter(f => f.isSyncedToDrive && f.syncStatus === 'synced').length;
  const localOnlyCount = files.length - syncedCount;

  const getLinkedTasks = (fileId: string) => tasks.filter(t => t.attachedFileIds?.includes(fileId));
  const getLinkedNotes = (fileId: string) => notes.filter(n => n.attachedFileIds?.includes(fileId));

  return (
    <div className="space-y-6 pb-12">
      {/* Hidden Real File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        className="hidden"
      />

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#151515] border border-[#2A2A2A] p-5 rounded-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-sm bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/30">
            <FolderLock className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-editorial-serif font-bold text-white">Quản lý & Phân loại Tài liệu</h1>
              {saConfig?.isConnected ? (
                <span className="text-[10px] bg-emerald-950/80 text-emerald-400 border border-emerald-700/80 px-2.5 py-0.5 rounded font-mono font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Google Drive SA: {saConfig.folderName || 'Thư Mục Cố Định'}</span>
                </span>
              ) : (
                <span className="text-[10px] bg-[#0C0C0C] text-[#AAAAAA] border border-[#2A2A2A] px-2 py-0.5 rounded font-mono">
                  📁 {saConfig?.folderName || 'Google Drive'}
                </span>
              )}
            </div>
            <p className="text-xs text-[#888888] italic">
              Tổ chức hồ sơ linh hoạt: Công việc, Cá nhân, Mẫu giấy tờ, Hợp đồng, Tài chính & Dự án
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Google Account 1-Click Connection Status */}
          {googleUser ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm bg-emerald-950/60 border border-emerald-700/80 text-[11px] font-mono text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="truncate max-w-[140px]" title={googleUser.email || ''}>
                {googleUser.email}
              </span>
              <button
                onClick={handleGoogleSignOutClick}
                className="text-[10px] text-emerald-200/60 hover:text-white underline cursor-pointer ml-1"
                title="Đăng xuất tài khoản Google"
              >
                Thoát
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleSignInClick}
              disabled={isLoggingInGoogle}
              className="px-3 py-2 rounded-sm bg-[#1A1A1A] hover:bg-[#252525] text-white border border-[#3A3A3A] hover:border-[#D4AF37] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50"
              title="Đăng nhập Google Account để đồng bộ 1-Click sang Drive"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{isLoggingInGoogle ? 'Đang kết nối...' : 'Đăng Nhập Google'}</span>
            </button>
          )}

          {/* Quick Category Manager Button */}
          <button
            onClick={() => setIsManagingCategories(true)}
            className="px-3 py-2 rounded-sm bg-[#0C0C0C] hover:bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/40 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            title="Tùy chỉnh, thêm mới hoặc sửa các nhóm phân loại tài liệu"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Phân Loại ({categories.length})</span>
          </button>

          {/* Prominent Sync Pre-existing Files from Google Drive Button */}
          <button
            onClick={handleUnifiedSyncDriveFiles}
            disabled={isSyncing || isSyncingSa}
            className="px-3 py-2 rounded-sm bg-[#1A1A1A] hover:bg-[#252525] text-[#D4AF37] border border-[#D4AF37]/60 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50"
            title="Quét và nạp các tệp mới từ thư mục Google Drive về ứng dụng"
          >
            <FolderSync className={`w-3.5 h-3.5 text-[#D4AF37] ${isSyncing || isSyncingSa ? 'animate-spin' : ''}`} />
            <span>{isSyncing || isSyncingSa ? 'Đang tải...' : 'Đồng Bộ Từ Drive'}</span>
          </button>

          {/* Prominent Sync ALL Local Files to Personal Google Drive Button */}
          {files.some(f => !f.isSyncedToDrive && f.syncStatus !== 'synced') && (
            <button
              onClick={handleSyncAllLocalFilesToUserDrive}
              disabled={!!syncingDriveFileId}
              className="px-3.5 py-2 rounded-sm bg-gradient-to-r from-emerald-950 to-[#1A1A1A] hover:from-emerald-900 hover:to-[#252525] text-emerald-400 border border-emerald-600/80 hover:border-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
              title="Đẩy tất cả các tệp đang lưu cục bộ lên Google Drive cá nhân của bạn"
            >
              <Cloud className={`w-4 h-4 text-emerald-400 ${syncingDriveFileId ? 'animate-bounce' : ''}`} />
              <span>{syncingDriveFileId ? 'Đang Đẩy Lên Drive...' : 'Đồng Bộ File Cục Bộ Lên Drive'}</span>
            </button>
          )}

          {/* Quick External Link to Google Drive folder */}
          {saConfig?.folderId && (
            <a
              href={`https://drive.google.com/drive/folders/${saConfig.folderId}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-sm bg-[#0C0C0C] hover:bg-[#1A1A1A] text-[#E0E0E0] border border-[#2A2A2A] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
              title="Mở thư mục này trực tiếp trên Google Drive"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Mở Drive</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {/* 1-Click Upload Button */}
          <button
            onClick={handleTriggerPicker}
            className="px-4 py-2 rounded-sm bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold text-xs uppercase tracking-widest flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Tải Tệp Lên</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncStatusMsg && (
        <div className="p-3 rounded-sm bg-[#151515] border border-[#D4AF37] text-xs text-[#D4AF37] font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{syncStatusMsg}</span>
        </div>
      )}

      {/* Auth Error Banner */}
      {authError && (
        <div className="p-3.5 rounded-sm bg-rose-950/50 border border-rose-700 text-xs text-rose-200 font-medium flex items-center justify-between flex-wrap gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{authError}</span>
          </div>
          <div className="flex items-center gap-2">
            {onNavigateToSettings && (
              <button
                onClick={onNavigateToSettings}
                className="px-3 py-1 bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold text-[11px] uppercase tracking-wider rounded-sm cursor-pointer shadow flex items-center gap-1"
              >
                <Settings className="w-3 h-3" />
                <span>Mở Cài Đặt Google Drive</span>
              </button>
            )}
            <button onClick={() => setAuthError(null)} className="text-xs text-rose-400 hover:text-white cursor-pointer px-1">✕</button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. PRIMARY DOCUMENT CLASSIFICATION BAR (Công việc, Cá nhân, Mẫu đơn...) */}
      {/* ============================================================== */}
      <div className="bg-[#151515] border border-[#2A2A2A] p-3 rounded-sm space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-[10px] uppercase font-bold text-[#AAAAAA] tracking-wider flex items-center gap-1.5">
            <Tag className="w-3 h-3 text-[#D4AF37]" />
            Phân Loại Tài Liệu Theo Mục Đích:
          </span>
          <button
            onClick={() => setIsManagingCategories(true)}
            className="text-[11px] text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer font-medium"
          >
            <Settings className="w-3 h-3" />
            <span>Tùy biến nhóm phân loại</span>
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {/* Tab ALL */}
          <button
            onClick={() => setSelectedClassification('all')}
            className={`px-3 py-2 rounded-sm text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
              selectedClassification === 'all'
                ? 'bg-[#D4AF37] text-black font-extrabold ring-1 ring-[#D4AF37]'
                : 'bg-[#0C0C0C] text-[#AAAAAA] border border-[#2A2A2A] hover:text-white hover:border-[#3A3A3A]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tất Cả</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${selectedClassification === 'all' ? 'bg-black/20 text-black font-bold' : 'bg-[#1A1A1A] text-[#888888]'}`}>
              {files.length}
            </span>
          </button>

          {/* Dynamic Category Tabs */}
          {categories.map(cat => {
            const count = classificationCounts[cat.id] || 0;
            const isSelected = selectedClassification === cat.id;
            const colorCfg = CATEGORY_COLORS[cat.color] || CATEGORY_COLORS.zinc;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedClassification(cat.id)}
                className={`px-3 py-2 rounded-sm text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shadow-xs border ${
                  isSelected
                    ? `${colorCfg.activeBg} ${colorCfg.activeText} border-transparent ring-2 ring-white/20`
                    : `bg-[#0C0C0C] ${colorCfg.text} ${colorCfg.border} hover:bg-[#1A1A1A]`
                }`}
              >
                {renderCategoryIcon(cat.icon, 'w-3.5 h-3.5')}
                <span>{cat.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                    isSelected ? 'bg-black/20 text-black' : 'bg-[#151515] text-[#AAAAAA]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          {/* Add Category Quick Button */}
          <button
            onClick={() => setIsManagingCategories(true)}
            className="px-2.5 py-2 rounded-sm text-xs font-medium text-[#888888] hover:text-[#D4AF37] bg-[#0C0C0C] border border-dashed border-[#2A2A2A] hover:border-[#D4AF37]/50 whitespace-nowrap flex items-center gap-1 cursor-pointer transition-colors"
            title="Thêm phân loại mới"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Nhóm mới</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. SEARCH BAR & SECONDARY FORMAT FILTER */}
      {/* ============================================================== */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#151515] p-3 rounded-sm border border-[#2A2A2A]">
        <div className="flex-1 w-full">
          <TagSearchInput
            placeholder="Tìm kiếm tài liệu (tên file, nội dung, gõ #tag hoặc phân loại)..."
            value={search}
            onChange={setSearch}
            availableTags={availableTags}
          />
        </div>

        {/* File Format Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {(['all', 'document', 'spreadsheet', 'presentation', 'pdf', 'image'] as const).map(fmt => (
            <button
              key={fmt}
              onClick={() => setFormatFilter(fmt)}
              className={`px-2.5 py-1 rounded-sm text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                formatFilter === fmt
                  ? 'bg-[#2A2A2A] text-white border border-[#444444]'
                  : 'bg-[#0C0C0C] text-[#777777] border border-[#222222] hover:text-[#CCCCCC]'
              }`}
            >
              {fmt === 'all' ? 'TẤT CẢ ĐỊNH DẠNG' : fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Google Drive Sync Progress Indicator if active */}
      {driveSyncProgress && (
        <div className="p-4 rounded-sm bg-[#121E18] border border-emerald-500/80 space-y-2.5 shadow-xl animate-in fade-in">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5 text-emerald-400 font-bold">
              <Cloud className={`w-4 h-4 text-emerald-400 ${driveSyncProgress.active ? 'animate-bounce' : ''}`} />
              <span>
                {driveSyncProgress.statusText}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                {driveSyncProgress.current}/{driveSyncProgress.total} tệp
              </span>
              <span className="font-mono text-emerald-400 font-extrabold text-xs">{driveSyncProgress.percent}%</span>
            </div>
          </div>
          <div className="w-full bg-[#080E0B] h-3 rounded-full overflow-hidden border border-emerald-800/80 p-0.5">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300 ease-out shadow-sm"
              style={{ width: `${Math.max(4, Math.min(100, driveSyncProgress.percent))}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-emerald-300/70 font-mono">
            <span>Tệp đang xử lý: <strong className="text-white">{driveSyncProgress.fileName}</strong></span>
            <span>⚡ Tự động giải phóng lưu trữ cục bộ</span>
          </div>
        </div>
      )}

      {/* Upload Progress Indicator if active */}
      {uploadProgress && (
        <div className="p-4 rounded-sm bg-[#151515] border border-[#D4AF37]/80 space-y-2 animate-pulse shadow-lg">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-[#D4AF37] font-bold">
              <UploadCloud className="w-4 h-4 animate-bounce" />
              <span>{uploadProgress.statusText}: <strong className="text-white">{uploadProgress.fileName}</strong></span>
            </div>
            <span className="font-mono text-[#D4AF37] font-bold">{uploadProgress.progress}%</span>
          </div>
          <div className="w-full bg-[#0C0C0C] h-2.5 rounded-full overflow-hidden border border-[#2A2A2A]">
            <div
              className="bg-[#D4AF37] h-full transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Drag & Drop Upload Box */}
      <div
        onClick={handleTriggerPicker}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            Array.from(e.dataTransfer.files).forEach((f: File) => {
              handleProcessUpload(f);
            });
          }
        }}
        className={`p-6 rounded-sm border border-dashed text-center transition-all cursor-pointer group ${
          dragOver ? 'border-[#D4AF37] bg-[#1A1A1A]' : 'border-[#2A2A2A] bg-[#151515] hover:border-[#D4AF37]'
        }`}
      >
        <UploadCloud className="w-8 h-8 text-[#D4AF37] mx-auto mb-2 group-hover:scale-110 transition-transform" />
        <h3 className="text-sm font-editorial-serif font-bold text-white group-hover:text-[#D4AF37] transition-colors">
          Kéo thả tệp vào đây hoặc nhấn để Tải tài liệu lên
        </h3>
        <p className="text-xs text-[#888888] italic mt-1 max-w-lg mx-auto">
          {selectedClassification !== 'all' ? (
            <span className="text-[#D4AF37] font-medium">
              📁 Tệp mới tải lên sẽ tự động được xếp vào nhóm: <strong>{resolveCategory(selectedClassification, categories).name}</strong>
            </span>
          ) : (
            <span>Hỗ trợ PDF, Excel, Word, PowerPoint, hình ảnh. Có thể thay đổi phân loại linh hoạt bất kỳ lúc nào.</span>
          )}
        </p>
      </div>

      {/* Filter Info / Results Header */}
      <div className="flex items-center justify-between text-xs text-[#888888] px-1">
        <span>
          Hiển thị <strong>{filteredFiles.length}</strong> / {files.length} tài liệu
          {selectedClassification !== 'all' && (
            <span className="ml-1 text-[#D4AF37]">
              • Nhóm "{resolveCategory(selectedClassification, categories).name}"
            </span>
          )}
          {formatFilter !== 'all' && (
            <span className="ml-1 text-sky-400">
              • Định dạng {formatFilter.toUpperCase()}
            </span>
          )}
        </span>

        {(selectedClassification !== 'all' || formatFilter !== 'all' || search) && (
          <button
            onClick={() => {
              setSelectedClassification('all');
              setFormatFilter('all');
              setSearch('');
            }}
            className="text-[11px] text-[#D4AF37] hover:underline cursor-pointer"
          >
            ✕ Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Files Grid */}
      {filteredFiles.length === 0 ? (
        <div className="p-12 text-center bg-[#151515] border border-[#2A2A2A] rounded-sm space-y-3">
          <FileText className="w-12 h-12 text-[#444444] mx-auto" />
          <h3 className="text-base font-editorial-serif font-bold text-white">Chưa có tài liệu nào trong nhóm này</h3>
          <p className="text-xs text-[#888888] max-w-md mx-auto">
            Hãy tải tệp mới lên hoặc chuyển đổi phân loại của các tài liệu hiện có sang nhóm "{resolveCategory(selectedClassification, categories).name}".
          </p>
          <button
            onClick={handleTriggerPicker}
            className="px-4 py-2 bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold text-xs uppercase tracking-wider rounded-sm cursor-pointer shadow"
          >
            + Tải Tệp Vào Nhóm Này
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFiles.map(file => {
            const linkedTasks = getLinkedTasks(file.id);
            const linkedNotes = getLinkedNotes(file.id);
            const isSynced = file.isSyncedToDrive && file.syncStatus === 'synced' && !!file.webViewLink;
            const isSyncingThis = !!syncingFileIds[file.id];
            const resolvedCat = resolveCategory(file.classification, categories);
            const colorCfg = CATEGORY_COLORS[resolvedCat.color] || CATEGORY_COLORS.zinc;
            const isCategoryPopoverOpen = openCategoryPopoverFileId === file.id;

            return (
              <div
                key={file.id}
                className="p-4 rounded-sm bg-[#151515] border border-[#2A2A2A] hover:border-[#D4AF37]/50 transition-all space-y-3 flex flex-col justify-between relative group"
              >
                <div className="space-y-2.5">
                  {/* File Title & Icon */}
                  <div className="flex items-start justify-between gap-3">
                    <div
                      onClick={() => setPreviewFile(file)}
                      className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1 group/title"
                    >
                      <div className="p-2.5 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] shrink-0 group-hover/title:border-[#D4AF37]/40 transition-colors">
                        {getFileFormatIcon(file.category)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-editorial-serif font-bold text-white truncate group-hover/title:text-[#D4AF37] transition-colors" title={file.name}>
                          {file.name}
                        </h3>
                        <span className="text-[10px] text-[#888888] font-mono">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.category.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPreviewFile(file)}
                        className="p-1.5 rounded-sm bg-[#0C0C0C] hover:bg-[#1A1A1A] text-[#888888] hover:text-white border border-[#2A2A2A] transition-colors cursor-pointer"
                        title="Xem trước tài liệu"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={file.downloadUrl || `/api/files/download/${file.id}`}
                        download={file.name}
                        className="p-1.5 rounded-sm bg-[#0C0C0C] hover:bg-[#1A1A1A] text-[#888888] hover:text-[#D4AF37] border border-[#2A2A2A] transition-colors cursor-pointer"
                        title="Tải tệp về máy"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => {
                          setEditingUrlFile(file);
                          setInputUrl(file.webViewLink || '');
                        }}
                        className="p-1.5 rounded-sm bg-[#0C0C0C] hover:bg-[#1A1A1A] text-[#888888] hover:text-[#D4AF37] border border-[#2A2A2A] transition-colors cursor-pointer"
                        title="Gắn link Google Drive"
                      >
                        <Link className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setFileToDelete(file)}
                        className="p-1.5 rounded-sm bg-[#0C0C0C] hover:bg-rose-950 text-rose-400 border border-[#2A2A2A] transition-colors cursor-pointer"
                        title="Xóa tệp"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Classification Badge & Fast Change Dropdown */}
                  <div className="relative">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => setOpenCategoryPopoverFileId(isCategoryPopoverOpen ? null : file.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold border transition-all cursor-pointer ${colorCfg.bg} ${colorCfg.text} ${colorCfg.border} hover:opacity-90 shadow-xs`}
                        title="Bấm vào để đổi nhóm phân loại nhanh"
                      >
                        {renderCategoryIcon(resolvedCat.icon, 'w-3 h-3')}
                        <span>{resolvedCat.name}</span>
                        <ChevronDown className="w-3 h-3 opacity-60" />
                      </button>

                      {/* Storage Sync Badge */}
                      {isSynced ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                          <CheckCircle2 className="w-3 h-3" /> Drive
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-mono">
                          <CloudOff className="w-3 h-3" /> Cục bộ
                        </span>
                      )}
                    </div>

                    {/* Popover Quick Category Selector */}
                    {isCategoryPopoverOpen && (
                      <div className="absolute top-full left-0 mt-1 z-30 w-64 bg-[#181818] border border-[#3A3A3A] rounded shadow-2xl p-2.5 space-y-2 animate-in fade-in">
                        <div className="text-[10px] font-bold text-[#AAAAAA] uppercase px-1 pb-1.5 border-b border-[#2A2A2A] flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Tag className="w-3 h-3 text-[#D4AF37]" />
                            <span>Phân loại tài liệu</span>
                          </span>
                          <button
                            onClick={() => setOpenCategoryPopoverFileId(null)}
                            className="text-[#666666] hover:text-white cursor-pointer px-1 text-xs"
                          >
                            ✕
                          </button>
                        </div>

                        {/* List of categories with Delete button on the right */}
                        <div className="max-h-52 overflow-y-auto space-y-1 pr-0.5 scrollbar-thin">
                          {categories.map(cat => {
                            const cCfg = CATEGORY_COLORS[cat.color] || CATEGORY_COLORS.zinc;
                            const isCurrent = resolvedCat.id === cat.id;
                            const catDocCount = classificationCounts[cat.id] || classificationCounts[cat.name] || 0;

                            return (
                              <div
                                key={cat.id}
                                className={`group/catitem w-full px-2 py-1.5 rounded text-xs flex items-center justify-between transition-colors ${
                                  isCurrent
                                    ? 'bg-[#262626] text-white font-bold border border-[#404040]'
                                    : 'text-[#CCCCCC] hover:bg-[#202020] border border-transparent'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleUpdateFileClassification(file.id, cat.id)}
                                  className="flex-1 text-left flex items-center gap-2 min-w-0 cursor-pointer"
                                  title={`Chọn phân loại "${cat.name}"`}
                                >
                                  <span className={`flex items-center gap-1.5 truncate ${cCfg.text}`}>
                                    {renderCategoryIcon(cat.icon, 'w-3.5 h-3.5 shrink-0')}
                                    <span className="truncate">{cat.name}</span>
                                  </span>
                                  {isCurrent && <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 ml-auto mr-1" />}
                                </button>

                                {/* Delete button on the right */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRequestDeleteCategory(cat);
                                  }}
                                  className="p-1 text-[#666666] hover:text-rose-400 hover:bg-rose-950/60 rounded transition-all cursor-pointer shrink-0 opacity-60 group-hover/catitem:opacity-100 ml-1"
                                  title={`Xóa phân loại "${cat.name}"${catDocCount > 0 ? ` (đang có ${catDocCount} tài liệu)` : ''}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {/* Direct New Category Input Form */}
                        <div className="pt-2 border-t border-[#2A2A2A]">
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (!popoverNewCatInput.trim()) return;
                              handleCreateNewCategory(popoverNewCatInput.trim(), file.id);
                              setPopoverNewCatInput('');
                            }}
                            className="flex items-center gap-1.5"
                          >
                            <input
                              type="text"
                              placeholder="+ Nhập phân loại mới..."
                              value={popoverNewCatInput}
                              onChange={(e) => setPopoverNewCatInput(e.target.value)}
                              className="flex-1 px-2.5 py-1.5 bg-[#0C0C0C] border border-[#333333] rounded text-[11px] text-[#E0E0E0] placeholder:text-[#666666] focus:outline-none focus:border-[#D4AF37]"
                            />
                            <button
                              type="submit"
                              disabled={!popoverNewCatInput.trim()}
                              className="px-2.5 py-1.5 bg-[#D4AF37] hover:bg-[#c29f2e] disabled:opacity-30 disabled:cursor-not-allowed text-black font-bold rounded text-xs shrink-0 cursor-pointer flex items-center justify-center shadow-xs"
                              title="Tạo và gán phân loại mới"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                          </form>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Linked indicators */}
                  {(linkedTasks.length > 0 || linkedNotes.length > 0) && (
                    <div className="flex items-center gap-2 text-[10px] text-[#888888]">
                      {linkedTasks.length > 0 && (
                        <span className="bg-[#0C0C0C] px-1.5 py-0.5 rounded border border-[#2A2A2A] text-emerald-400">
                          ⚡ {linkedTasks.length} task
                        </span>
                      )}
                      {linkedNotes.length > 0 && (
                        <span className="bg-[#0C0C0C] px-1.5 py-0.5 rounded border border-[#2A2A2A] text-[#D4AF37]">
                          📝 {linkedNotes.length} note
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-[#2A2A2A] gap-1">
                  <button
                    onClick={() => openAiChatWithPrompt(`Hãy phân tích và tóm tắt nội dung tài liệu "${file.name}" (Nhóm: ${resolvedCat.name}, Định dạng: ${file.category})`)}
                    className="text-[10px] font-bold text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Hỏi AI</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {/* If local-only, show 1-Click Push to Personal Google Drive */}
                    {!isSynced && (
                      <button
                        onClick={() => handleSyncLocalFileToUserDrive(file)}
                        disabled={syncingDriveFileId === file.id}
                        className="px-2 py-1 rounded-sm bg-[#1A1A1A] hover:bg-[#D4AF37] text-[#D4AF37] hover:text-black border border-[#D4AF37]/50 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                        title="Đẩy file này lên Google Drive cá nhân của bạn"
                      >
                        <Cloud className={`w-3 h-3 ${syncingDriveFileId === file.id ? 'animate-bounce' : ''}`} />
                        <span>{syncingDriveFileId === file.id ? 'Đang lưu...' : 'Lưu lên Drive'}</span>
                      </button>
                    )}

                    {isSynced && file.webViewLink ? (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 rounded-sm bg-emerald-950/40 text-emerald-400 border border-emerald-800/80 hover:bg-emerald-600 hover:text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                        title="Mở tệp trực tiếp trong Google Drive"
                      >
                        <span>Mở Drive</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    ) : (
                      <button
                        onClick={() => setPreviewFile(file)}
                        className="px-2 py-1 rounded-sm bg-[#0C0C0C] text-[#E0E0E0] border border-[#2A2A2A] hover:bg-[#D4AF37] hover:text-black text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>Xem Trước</span>
                        <Eye className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. MANAGE CATEGORIES MODAL */}
      {/* ============================================================== */}
      {isManagingCategories && (
        <ManageCategoriesModal
          categories={categories}
          fileCounts={classificationCounts}
          onSaveCategories={handleSaveCategories}
          onClose={() => setIsManagingCategories(false)}
        />
      )}

      {/* ============================================================== */}
      {/* 4. DELETE CONFIRMATION MODAL */}
      {/* ============================================================== */}
      {fileToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#151515] border border-[#2A2A2A] w-full max-w-md rounded-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded bg-rose-950/40 border border-rose-800">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-editorial-serif font-bold text-white text-base">Xác Nhận Xóa Tài Liệu</h3>
                <p className="text-xs text-[#888888]">Hành động này không thể hoàn tác.</p>
              </div>
            </div>

            <p className="text-xs text-[#CCCCCC] bg-[#0C0C0C] p-3 rounded border border-[#2A2A2A]">
              Bạn có chắc chắn muốn xóa tệp <strong className="text-white font-mono">"{fileToDelete.name}"</strong>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2A2A2A]">
              <button
                onClick={() => setFileToDelete(null)}
                className="px-4 py-2 bg-[#0C0C0C] hover:bg-[#1A1A1A] text-white border border-[#2A2A2A] text-xs font-bold rounded-sm cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider rounded-sm cursor-pointer shadow"
              >
                Xác Nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. EDIT CUSTOM URL MODAL */}
      {/* ============================================================== */}
      {editingUrlFile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#151515] border border-[#2A2A2A] w-full max-w-md rounded-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3">
              <div className="flex items-center gap-2">
                <Link className="w-4 h-4 text-[#D4AF37]" />
                <h3 className="font-editorial-serif font-bold text-white text-sm">Gắn Link Google Drive Thật</h3>
              </div>
              <button
                onClick={() => setEditingUrlFile(null)}
                className="p-1 text-[#888888] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomUrl} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#888888] font-bold uppercase text-[10px] mb-1.5">
                  Tên tài liệu: <span className="text-white normal-case font-normal">{editingUrlFile.name}</span>
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/file/d/..."
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2A2A2A]">
                <button
                  type="button"
                  onClick={() => setEditingUrlFile(null)}
                  className="px-3 py-1.5 bg-[#0C0C0C] hover:bg-[#1A1A1A] text-white border border-[#2A2A2A] rounded-sm cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold uppercase tracking-wider rounded-sm cursor-pointer"
                >
                  Lưu Liên Kết
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 7. ENHANCED IN-APP DOCUMENT PREVIEW & CLASSIFICATION MODAL */}
      {/* ============================================================== */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#151515] border border-[#2A2A2A] w-full max-w-2xl max-h-[90vh] flex flex-col rounded-sm shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#2A2A2A] p-4 bg-[#111111]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded bg-[#0C0C0C] border border-[#2A2A2A] shrink-0">
                  {getFileFormatIcon(previewFile.category)}
                </div>
                <div className="min-w-0">
                  <h3 className="font-editorial-serif font-bold text-white text-sm truncate max-w-md">{previewFile.name}</h3>
                  <span className="text-[10px] font-mono text-[#888888] block">{previewFile.mimeType} • {(previewFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="p-1 text-[#888888] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Preview */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Interactive Classification & Metadata Toolbar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#0C0C0C] p-3 rounded-sm border border-[#2A2A2A]">
                <div>
                  <label className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    Phân Loại Mục Đích (Thay đổi linh hoạt):
                  </label>
                  <select
                    value={previewFile.classification || 'other'}
                    onChange={(e) => {
                      if (e.target.value === '__add_new__') {
                        setIsManagingCategories(true);
                      } else {
                        handleUpdateFileClassification(previewFile.id, e.target.value);
                      }
                    }}
                    className="w-full p-2 bg-[#151515] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] text-xs focus:outline-none focus:border-[#D4AF37]"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.description ? `(${c.description.slice(0, 30)}...)` : ''}
                      </option>
                    ))}
                    <option value="__add_new__">+ Tạo hoặc tùy biến nhóm phân loại...</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[9px] text-[#666666] font-mono uppercase block">Định dạng file:</span>
                    <span className="font-bold text-[#E0E0E0] uppercase">{previewFile.category}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#666666] font-mono uppercase block">Trạng thái lưu:</span>
                    {previewFile.isSyncedToDrive && previewFile.webViewLink ? (
                      <span className="text-emerald-400 font-bold">🟢 Google Drive</span>
                    ) : (
                      <span className="text-amber-400 font-bold">🟡 Local Vault</span>
                    )}
                  </div>
                </div>
              </div>

              {/* In-App Document Viewer Area */}
              <div className="bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm p-4 min-h-[180px] max-h-[280px] overflow-y-auto">
                <div className="flex items-center justify-between mb-3 border-b border-[#2A2A2A] pb-2">
                  <span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#D4AF37]" />
                    Xem trước nội dung văn bản (In-App Document Viewer)
                  </span>
                  {previewFile.isSyncedToDrive && previewFile.webViewLink && (
                    <a
                      href={previewFile.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 font-mono"
                    >
                      <span>Mở link Drive</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>

                {isLoadingPreview ? (
                  <div className="py-12 text-center text-[#888888] space-y-2">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#D4AF37]" />
                    <p className="text-xs">Đang tải bản xem trước tài liệu...</p>
                  </div>
                ) : previewContent ? (
                  <pre className="font-mono text-xs text-[#D0D0D0] whitespace-pre-wrap leading-relaxed bg-[#111111] p-3 rounded border border-[#222222]">
                    {previewContent}
                  </pre>
                ) : (
                  <div className="py-8 text-center text-[#888888] space-y-2">
                    <FileCheck className="w-8 h-8 mx-auto text-[#D4AF37]/50" />
                    <p className="text-xs text-white font-medium">{previewFile.name}</p>
                    <p className="text-[11px] text-[#777777] max-w-sm mx-auto">
                      Tệp nhị phân đã được lưu trữ an toàn trong kho dữ liệu. Bạn có thể tải tệp về máy tính hoặc xem trên Google Drive.
                    </p>
                  </div>
                )}
              </div>

              {/* Cloud Sync & Action Panel */}
              {(!previewFile.isSyncedToDrive || !previewFile.webViewLink) ? (
                <div className="p-3 bg-amber-950/30 border border-amber-700/50 rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                      <CloudOff className="w-4 h-4" />
                      <span>Tài liệu đang lưu trữ cục bộ</span>
                    </div>
                    <p className="text-[11px] text-[#A0A0A0]">
                      Tệp được lưu an toàn trong cơ sở dữ liệu. Nhấn "Đồng bộ từ Drive" ở thanh công cụ để đồng bộ toàn bộ.
                    </p>
                  </div>
                  <button
                    onClick={handleUnifiedSyncDriveFiles}
                    disabled={isSyncing || isSyncingSa}
                    className="px-4 py-2 bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold text-xs uppercase tracking-wider rounded-sm shrink-0 flex items-center justify-center gap-1.5 cursor-pointer shadow"
                  >
                    <FolderSync className={`w-3.5 h-3.5 ${isSyncing || isSyncingSa ? 'animate-spin' : ''}`} />
                    <span>{isSyncing || isSyncingSa ? 'Đang đồng bộ...' : 'Đồng Bộ Từ Drive'}</span>
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-sm flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="truncate max-w-xs sm:max-w-md font-mono text-[11px]">{previewFile.webViewLink}</span>
                  </div>
                  <button
                    onClick={() => {
                      setEditingUrlFile(previewFile);
                      setInputUrl(previewFile.webViewLink || '');
                    }}
                    className="text-[10px] text-[#888888] hover:text-white underline cursor-pointer"
                  >
                    Sửa link
                  </button>
                </div>
              )}

              {/* Linked Tasks & Notes in Preview */}
              {(getLinkedTasks(previewFile.id).length > 0 || getLinkedNotes(previewFile.id).length > 0) && (
                <div className="space-y-2 border-t border-[#2A2A2A] pt-3">
                  <span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">Liên kết trong hệ thống:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {getLinkedTasks(previewFile.id).map(t => (
                      <div key={t.id} className="p-2 rounded bg-[#0C0C0C] border border-[#2A2A2A] flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate text-white font-medium">{t.title}</span>
                      </div>
                    ))}
                    {getLinkedNotes(previewFile.id).map(n => (
                      <div key={n.id} className="p-2 rounded bg-[#0C0C0C] border border-[#2A2A2A] flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                        <span className="truncate text-white font-medium">{n.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-[#2A2A2A] p-4 bg-[#111111]">
              <button
                onClick={() => {
                  const fname = previewFile.name;
                  const catName = resolveCategory(previewFile.classification, categories).name;
                  setPreviewFile(null);
                  openAiChatWithPrompt(`Hãy phân tích và tóm tắt chuyên sâu nội dung tài liệu "${fname}" (Nhóm: ${catName}, Định dạng: ${previewFile.category}). Đưa ra các điểm chính và đề xuất hành động tiếp theo.`);
                }}
                className="px-3 py-1.5 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 rounded-sm font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Hỏi AI Phân Tích File</span>
              </button>

              <div className="flex items-center gap-2">
                <a
                  href={previewFile.downloadUrl || `/api/files/download/${previewFile.id}`}
                  download={previewFile.name}
                  className="px-3 py-1.5 bg-[#0C0C0C] hover:bg-[#1A1A1A] text-white border border-[#2A2A2A] rounded-sm text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải Về Máy</span>
                </a>
                {previewFile.isSyncedToDrive && previewFile.webViewLink && (
                  <a
                    href={previewFile.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow"
                  >
                    <span>Mở Trên Drive</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 8. CATEGORY DELETION CONFIRMATION & WARNING MODAL */}
      {/* ============================================================== */}
      {categoryToDelete && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-in fade-in duration-150">
          <div className="bg-[#151515] border border-[#2A2A2A] w-full max-w-md rounded-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded ${categoryToDelete.fileCount > 0 ? 'bg-amber-950/50 border border-amber-600 text-amber-400' : 'bg-rose-950/40 border border-rose-800 text-rose-400'}`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-editorial-serif font-bold text-white text-base">
                  {categoryToDelete.fileCount > 0 ? 'Cảnh Báo Xóa Phân Loại' : 'Xác Nhận Xóa Phân Loại'}
                </h3>
                <p className="text-xs text-[#888888]">
                  Phân loại: <strong className="text-white">"{categoryToDelete.category.name}"</strong>
                </p>
              </div>
            </div>

            {categoryToDelete.fileCount > 0 ? (
              <div className="p-3.5 bg-amber-950/25 border border-amber-800/80 rounded text-xs space-y-2 text-amber-200">
                <div className="font-bold flex items-center gap-2 text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Cảnh báo: Hiện có <strong>{categoryToDelete.fileCount} tài liệu</strong> đang mang phân loại này!</span>
                </div>
                <p className="text-[11px] text-[#D0D0D0] leading-relaxed">
                  Nếu bạn xóa phân loại <strong>"{categoryToDelete.category.name}"</strong>, toàn bộ {categoryToDelete.fileCount} tài liệu trên sẽ <strong>không bị mất</strong> mà được tự động chuyển sang phân loại mặc định <strong>"Khác"</strong>.
                </p>
              </div>
            ) : (
              <p className="text-xs text-[#CCCCCC] bg-[#0C0C0C] p-3.5 rounded border border-[#2A2A2A]">
                Bạn có chắc chắn muốn xóa phân loại <strong className="text-white">"{categoryToDelete.category.name}"</strong> khỏi danh sách?
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2A2A2A]">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="px-4 py-2 bg-[#0C0C0C] hover:bg-[#1A1A1A] text-white border border-[#2A2A2A] text-xs font-bold rounded-sm cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCategory}
                className={`px-4 py-2 text-white text-xs font-bold uppercase tracking-wider rounded-sm cursor-pointer shadow ${
                  categoryToDelete.fileCount > 0
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {categoryToDelete.fileCount > 0 ? 'Đồng Ý & Chuyển Về Khác' : 'Xác Nhận Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
