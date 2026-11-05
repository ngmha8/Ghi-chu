import React, { useState, useRef, useEffect, useMemo } from 'react';
import { DriveFile, Task, Note, DriveServiceAccountConfig, DocumentCategory } from '../types/index.js';
import { TagSearchInput } from './TagSearchInput.js';
import { PdfCanvasViewer } from './PdfCanvasViewer.js';
import { api } from '../services/api.js';
import { useFileStore } from '../stores/useFileStore.js';
import { useTaskStore } from '../stores/useTaskStore.js';
import { useNoteStore } from '../stores/useNoteStore.js';
import { useSystemStore } from '../stores/useSystemStore.js';
import {
  initGoogleAuth,
  signInWithGoogleWorkspace,
  googleSignOut,
  getGoogleAccessToken,
  GoogleOAuthUser
} from '../services/googleAuth.js';
import { uploadLocalFileToUserGoogleDrive } from '../services/googleDriveUpload.js';
import {
  uploadFileToStorage,
  isCloudStorageConfigured,
  deleteFileFromStorage,
} from '../services/storage.js';
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
  Bot,
  FileSearch,
  Copy,
  BookOpen,
  Table,
  Lightbulb,
  Folder,
  Settings,
  FolderLock,
  Tag,
  ChevronDown,
  ChevronUp,
  Briefcase,
  User,
  DollarSign,
  Scale,
  FolderKanban,
  Globe,
  Key,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  NotebookPen,
  MessageSquareQuote,
  Info,
  Shield,
  Lock,
  CheckSquare,
  Square,
  LayoutGrid,
  List
} from 'lucide-react';
import {
  getStoredCategories,
  saveStoredCategories,
  fetchCategoriesFromServer,
  syncCategoriesToServer,
  resolveCategory,
  CATEGORY_COLORS,
  DEFAULT_DOCUMENT_CATEGORIES
} from '../services/docClassification.js';
import { ManageCategoriesModal, renderCategoryIcon } from './ManageCategoriesModal.js';

export interface UploadQueueItem {
  id: string;
  fileId: string;
  file: File;
  name: string;
  size: number;
  category: DriveFile['category'];
  classification: string;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  statusText: string;
  error?: string;
  isSyncedToDrive?: boolean;
}

export interface FilesViewProps {
  files?: DriveFile[];
  tasks?: Task[];
  notes?: Note[];
  categories?: DocumentCategory[];
  onSaveCategories?: (newCategories: DocumentCategory[]) => void;
  onFileUpload?: (fileData: Partial<DriveFile>) => Promise<DriveFile | null> | void;
  onFileDelete?: (id: string) => void;
  onFileUpdate?: (id: string, fileData: Partial<DriveFile>) => void;
  openAiChatWithPrompt?: (prompt: string) => void;
  onNavigateToSettings?: () => void;
}

export const FilesView: React.FC<FilesViewProps> = ({
  files: propFiles,
  tasks: propTasks,
  notes: propNotes,
  categories: propCategories,
  onSaveCategories: propOnSaveCategories,
  onFileUpload: propOnFileUpload,
  onFileDelete: propOnFileDelete,
  onFileUpdate: propOnFileUpdate,
  openAiChatWithPrompt: propOpenAiChatWithPrompt,
  onNavigateToSettings: propOnNavigateToSettings,
}) => {
  // Store slices
  const storeFiles = useFileStore(s => s.files);
  const storeCategories = useFileStore(s => s.categories);
  const storeSaveCategories = useFileStore(s => s.saveCategories);
  const storeUploadFile = useFileStore(s => s.uploadFile);
  const storeDeleteFile = useFileStore(s => s.deleteFile);
  const storeUpdateFile = useFileStore(s => s.updateFile);

  const storeTasks = useTaskStore(s => s.tasks);
  const storeNotes = useNoteStore(s => s.notes);
  const storeOpenAiDrawer = useSystemStore(s => s.openAiDrawer);
  const storeSetActiveTab = useSystemStore(s => s.setActiveTab);

  // Resolved values
  const files = propFiles ?? storeFiles;
  const tasks = propTasks ?? storeTasks;
  const notes = propNotes ?? storeNotes;
  const onSaveCategories = propOnSaveCategories ?? storeSaveCategories;
  const onFileUpload = propOnFileUpload ?? storeUploadFile;
  const onFileDelete = propOnFileDelete ?? storeDeleteFile;
  const onFileUpdate = propOnFileUpdate ?? storeUpdateFile;
  const openAiChatWithPrompt = propOpenAiChatWithPrompt ?? storeOpenAiDrawer;
  const onNavigateToSettings = propOnNavigateToSettings ?? (() => storeSetActiveTab('settings'));

  const [search, setSearch] = useState('');
  
  // Document Classification state (Công việc, Cá nhân, Mẫu giấy tờ, Tài chính...)
  const effectiveCategorySource = propCategories || storeCategories;
  const [internalCategories, setInternalCategories] = useState<DocumentCategory[]>(() => effectiveCategorySource || getStoredCategories());
  const categories = propCategories || (storeCategories.length > 0 ? storeCategories : internalCategories);

  useEffect(() => {
    if (propCategories && propCategories.length > 0) {
      setInternalCategories(propCategories);
    } else if (storeCategories && storeCategories.length > 0) {
      setInternalCategories(storeCategories);
    }
  }, [propCategories, storeCategories]);

  const [selectedClassification, setSelectedClassification] = useState<string>('all');
  const [isManagingCategories, setIsManagingCategories] = useState(false);

  // Format Type Filter (Document, Spreadsheet, PDF...)
  const [formatFilter, setFormatFilter] = useState<DriveFile['category'] | 'all'>('all');

  // Sorting State: by name, upload date (uploadedAt), or size
  const [sortKey, setSortKey] = useState<'uploadedAt' | 'name' | 'size'>(() => {
    return (localStorage.getItem('doc_sort_key') as 'uploadedAt' | 'name' | 'size') || 'uploadedAt';
  });
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => {
    return (localStorage.getItem('doc_sort_order') as 'asc' | 'desc') || 'desc';
  });

  const handleSortChange = (key: 'uploadedAt' | 'name' | 'size', order: 'asc' | 'desc') => {
    setSortKey(key);
    setSortOrder(order);
    try {
      localStorage.setItem('doc_sort_key', key);
      localStorage.setItem('doc_sort_order', order);
    } catch {
      // ignore
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Service Account State
  const [saConfig, setSaConfig] = useState<DriveServiceAccountConfig | null>(null);
  const [isSyncingSa, setIsSyncingSa] = useState(false);

  // Google OAuth User State
  const [googleUser, setGoogleUser] = useState<GoogleOAuthUser | null>(null);
  const [isLoggingInGoogle, setIsLoggingInGoogle] = useState(false);
  const [syncingDriveFileId, setSyncingDriveFileId] = useState<string | null>(null);

  // Syncing state per file
  const [syncingFileIds, setSyncingFileIds] = useState<Record<string, boolean>>({});

  // Network connectivity status
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Upload progress for local ingestion (legacy single-file fallback)
  const [uploadProgress, setUploadProgress] = useState<{
    fileName: string;
    progress: number;
    statusText: string;
    active: boolean;
    isError?: boolean;
  } | null>(null);

  // Batch Multi-File Upload Queue & Statistics
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isUploadPanelExpanded, setIsUploadPanelExpanded] = useState<boolean>(true);

  // Helper for human-readable file size format
  const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Master Overall Multi-File Batch Progress Statistics
  const uploadOverallStats = useMemo(() => {
    if (uploadQueue.length === 0) return null;
    const totalFiles = uploadQueue.length;
    const completedFiles = uploadQueue.filter(i => i.status === 'completed').length;
    const errorFiles = uploadQueue.filter(i => i.status === 'error').length;
    const activeFiles = uploadQueue.filter(i => i.status === 'uploading' || i.status === 'processing').length;
    const pendingFiles = uploadQueue.filter(i => i.status === 'pending').length;

    const totalBytes = uploadQueue.reduce((acc, i) => acc + (i.size || 0), 0);
    const uploadedBytes = uploadQueue.reduce((acc, i) => {
      const frac = (i.progress || 0) / 100;
      return acc + ((i.size || 0) * frac);
    }, 0);

    const overallPercent = totalBytes > 0
      ? Math.min(100, Math.round((uploadedBytes / totalBytes) * 100))
      : Math.round(uploadQueue.reduce((acc, i) => acc + i.progress, 0) / totalFiles);

    const isAllFinished = completedFiles + errorFiles === totalFiles;

    return {
      totalFiles,
      completedFiles,
      errorFiles,
      activeFiles,
      pendingFiles,
      totalBytes,
      uploadedBytes,
      overallPercent,
      isAllFinished,
    };
  }, [uploadQueue]);

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

  // In-App Document Preview Modal & Multi-Mode Viewer
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewTab, setPreviewTab] = useState<'content' | 'drive' | 'ai'>('content');
  const [previewData, setPreviewData] = useState<{
    id: string;
    name: string;
    category: string;
    classification?: string;
    mimeType?: string;
    size?: number;
    isSyncedToDrive: boolean;
    driveFileId?: string;
    webViewLink?: string;
    drivePreviewEmbedUrl?: string;
    downloadUrl?: string;
    rawUrl?: string;
    previewType: 'docx' | 'doc' | 'pdf' | 'image' | 'spreadsheet' | 'text' | 'binary';
    htmlContent?: string;
    textContent?: string;
    notes?: string;
    tags?: string[];
  } | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<{
    summary: string;
    keyPoints: string[];
    actionItems: string[];
    suggestedTags: string[];
    recommendations: string;
  } | null>(null);
  const [isLoadingAiAnalysis, setIsLoadingAiAnalysis] = useState(false);
  const [isApplyingAiNotes, setIsApplyingAiNotes] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Custom Google Drive Link Modal
  const [editingUrlFile, setEditingUrlFile] = useState<DriveFile | null>(null);
  const [inputUrl, setInputUrl] = useState('');

  // Document Note / Annotation Editing State & Modal
  const [editingNoteFile, setEditingNoteFile] = useState<DriveFile | null>(null);
  const [noteInputText, setNoteInputText] = useState('');
  const [noteInputTags, setNoteInputTags] = useState('');
  const [isGeneratingAiNote, setIsGeneratingAiNote] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Delete Confirmation Modal
  const [fileToDelete, setFileToDelete] = useState<DriveFile | null>(null);

  // Quick Inline Category Switcher state (fileId -> open/close) & Fast Tag Search/Add
  const [openCategoryPopoverFileId, setOpenCategoryPopoverFileId] = useState<string | null>(null);
  const [popoverSearchQuery, setPopoverSearchQuery] = useState('');

  // View mode: 'grid' (thẻ) or 'list' (danh sách)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('files_view_mode') as 'grid' | 'list') || 'grid';
    }
    return 'grid';
  });

  const handleSetViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('files_view_mode', mode);
    }
  };

  // Identify all files currently stored locally and not yet synced to Google Drive
  const localFiles = useMemo(() => {
    return files.filter(f => !f.driveFileId || !f.isSyncedToDrive || f.syncStatus === 'local_only' || f.syncStatus === 'sync_error');
  }, [files]);

  // Google Drive Authentication State Gate (Determines whether Drive operational buttons are revealed)
  const isGoogleLoggedIn = Boolean(googleUser?.email || getGoogleAccessToken());

  // Centralized Google Drive Management Dashboard Modal
  const [isDriveManageModalOpen, setIsDriveManageModalOpen] = useState(false);

  // Sync & Purge Local Modal State
  const [isSyncPurgeModalOpen, setIsSyncPurgeModalOpen] = useState(false);
  const [purgeLocalCopyAfterUpload, setPurgeLocalCopyAfterUpload] = useState(true);
  const [deleteLocalRecordAfterUpload, setDeleteLocalRecordAfterUpload] = useState(false);
  const [isSyncingAndPurging, setIsSyncingAndPurging] = useState(false);

  // Category Deletion Confirmation & Warning State
  const [categoryToDelete, setCategoryToDelete] = useState<{ category: DocumentCategory; fileCount: number } | null>(null);

  // Admin Google Login Requirement State & Modal
  const [adminLoginPrompt, setAdminLoginPrompt] = useState<{
    isOpen: boolean;
    pendingFile?: DriveFile | null;
    isSyncAll?: boolean;
    notice?: string;
  } | null>(null);
  const [showOriginHelp, setShowOriginHelp] = useState(() => {
    if (typeof window !== 'undefined') {
      return !window.location.origin.includes('localhost');
    }
    return false;
  });
  const [copiedOrigin, setCopiedOrigin] = useState(false);

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

  // Monitor network connection (online / offline)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setAuthError(null);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setAuthError('⚠️ Đã mất kết nối Internet! Mọi thao tác tải lên và đồng bộ tạm thời bị dừng để tránh báo hoàn tất ảo.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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

  // Save updated categories (syncs with prop handler or backend API)
  const handleSaveCategories = (newCategories: DocumentCategory[]) => {
    // If any categories were removed, migrate any affected files to 'other'
    const remainingIds = new Set(newCategories.map(c => c.id));
    const removedCats = categories.filter(c => !remainingIds.has(c.id));
    if (removedCats.length > 0 && onFileUpdate) {
      files.forEach(f => {
        const isMatched = removedCats.some(rc => f.classification === rc.id || f.classification?.toLowerCase() === rc.name.toLowerCase());
        if (isMatched) {
          onFileUpdate(f.id, { classification: 'other' });
        }
      });
      if (previewFile && removedCats.some(rc => previewFile.classification === rc.id || previewFile.classification?.toLowerCase() === rc.name.toLowerCase())) {
        setPreviewFile({ ...previewFile, classification: 'other' });
      }
    }

    setInternalCategories(newCategories);
    if (propOnSaveCategories) {
      propOnSaveCategories(newCategories);
    } else {
      syncCategoriesToServer(newCategories).catch(e => console.warn('Sync categories error:', e));
    }
  };

  // Helper: check if a category/tag is assigned/selected for a file
  const isCategorySelectedForFile = (file: DriveFile, cat: DocumentCategory): boolean => {
    if (!file || !cat) return false;
    if (file.classification === cat.id || file.classification?.toLowerCase() === cat.name.toLowerCase()) {
      return true;
    }
    if (Array.isArray(file.tags)) {
      return file.tags.some(t => {
        const clean = t.toLowerCase().trim();
        return clean === cat.name.toLowerCase() || clean === cat.id.toLowerCase();
      });
    }
    return false;
  };

  // Helper: get list of all assigned categories for a file
  const getFileSelectedCategories = (file: DriveFile): DocumentCategory[] => {
    if (!file) return [];
    return categories.filter(cat => isCategorySelectedForFile(file, cat));
  };

  // Compute file counts per classification (including multi-tag assignments)
  const classificationCounts = useMemo(() => {
    const counts: Record<string, number> = { all: files.length };
    categories.forEach(c => { counts[c.id] = 0; });

    files.forEach(f => {
      const assigned = categories.filter(c => isCategorySelectedForFile(f, c));
      if (assigned.length === 0) {
        counts['other'] = (counts['other'] || 0) + 1;
      } else {
        assigned.forEach(c => {
          counts[c.id] = (counts[c.id] || 0) + 1;
        });
      }
    });

    return counts;
  }, [files, categories]);

  // Handle Sync with Service Account
  const handleSyncFromServiceAccount = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncStatusMsg('❌ Không có kết nối mạng Internet! Vui lòng kết nối mạng để đồng bộ từ Google Drive.');
      setTimeout(() => setSyncStatusMsg(null), 5000);
      return;
    }
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

  // Handle Intelligent Clean-up of Duplicate Files on Google Drive
  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);
  const handleCleanDriveDuplicates = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setAuthError('❌ Không có kết nối mạng Internet! Vui lòng kết nối mạng để dọn dẹp Google Drive.');
      return;
    }
    setIsCleaningDuplicates(true);
    setSyncStatusMsg('Đang quét và dọn dẹp các tệp trùng lặp và tệp rác trên Google Drive...');
    try {
      const res = await api.cleanDriveDuplicates(saConfig?.folderId);
      setSyncStatusMsg(`✅ ${res.message}`);
      if (res.cleanedCount > 0) {
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
      setTimeout(() => setSyncStatusMsg(null), 6000);
    } catch (err: any) {
      setAuthError(`Lỗi dọn dẹp tệp trùng: ${err?.message || 'Không thể liên lạc Google Drive'}`);
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  // Fetch structured preview data and extracted content when preview modal opens
  useEffect(() => {
    if (!previewFile) {
      setPreviewContent(null);
      setPreviewData(null);
      setAiAnalysis(null);
      setPreviewTab('content');
      setCopiedText(false);
      return;
    }

    setIsLoadingPreview(true);
    fetch(`/api/files/preview/${previewFile.id}`)
      .then(res => res.json())
      .then(data => {
        setPreviewData(data);
        if (data.htmlContent) {
          setPreviewContent(data.htmlContent);
        } else if (data.textContent) {
          setPreviewContent(data.textContent);
        } else if (previewFile.textContent) {
          setPreviewContent(previewFile.textContent);
        } else {
          setPreviewContent(null);
        }
      })
      .catch(err => {
        console.warn('Preview fetch warning:', err);
        if (previewFile.textContent) {
          setPreviewContent(previewFile.textContent);
        }
      })
      .finally(() => setIsLoadingPreview(false));
  }, [previewFile]);

  // Handle AI Document Intelligence generation
  const handleGenerateAiAnalysis = async (fileId: string) => {
    setIsLoadingAiAnalysis(true);
    try {
      const res = await fetch(`/api/files/ai-summary/${fileId}`, { method: 'POST' });
      const data = await res.json();
      if (data?.analysis) {
        setAiAnalysis(data.analysis);
      }
    } catch (e: any) {
      console.warn('AI summary error:', e);
    } finally {
      setIsLoadingAiAnalysis(false);
    }
  };

  // Handle Applying AI Summary to Document Note & Tags
  const handleApplyAiSummaryToNote = async () => {
    if (!previewFile || !aiAnalysis) return;
    setIsApplyingAiNotes(true);
    try {
      const mergedNote = `${aiAnalysis.summary}\n\n📌 Ý chính:\n- ${aiAnalysis.keyPoints.join('\n- ')}\n\n💡 Đề xuất AI:\n${aiAnalysis.recommendations}`;
      const mergedTags = Array.from(new Set([...(previewFile.tags || []), ...(aiAnalysis.suggestedTags || [])]));

      const updated: DriveFile = {
        ...previewFile,
        notes: mergedNote,
        tags: mergedTags,
      };

      if (onFileUpdate) {
        onFileUpdate(previewFile.id, updated);
      }
      setPreviewFile(updated);
      setSyncStatusMsg('✅ Đã lưu tóm tắt và thẻ phân tích của AI vào Chú thích tài liệu!');
      setTimeout(() => setSyncStatusMsg(null), 3500);
    } catch (e) {
      console.warn('Error applying AI note:', e);
    } finally {
      setIsApplyingAiNotes(false);
    }
  };

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
      const msg = err?.message || 'Không thể xác thực';
      if (msg.includes('đã được đóng') || msg.includes('Đã hủy')) {
        setAuthError(msg);
      } else {
        setAuthError(`Lỗi đăng nhập Google: ${msg}`);
      }
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

  // Handler to perform Google Admin Login and immediately resume the pending sync
  const handleAdminLoginAndProceed = async () => {
    setIsLoggingInGoogle(true);
    setAuthError(null);
    try {
      const res = await signInWithGoogleWorkspace();
      if (res?.user) {
        setGoogleUser(res.user);
        const pending = adminLoginPrompt;
        setAdminLoginPrompt(null);
        setSyncStatusMsg(`✅ Đã đăng nhập tài khoản Admin (${res.user.email}). Bắt đầu đồng bộ tệp lên Google Drive...`);

        // Automatically resume the pending sync
        if (pending?.isSyncAll) {
          setTimeout(() => {
            executeSyncAllLocalFiles();
          }, 300);
        } else if (pending?.pendingFile) {
          setTimeout(() => {
            executeSyncSingleFile(pending.pendingFile!);
          }, 300);
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'Không thể xác thực';
      if (msg.includes('đã được đóng') || msg.includes('Đã hủy')) {
        setAuthError(msg);
      } else {
        setAuthError(`Lỗi đăng nhập Google Admin: ${msg}`);
      }
      setShowOriginHelp(true);
    } finally {
      setIsLoggingInGoogle(false);
    }
  };

  // Internal executor for single file sync to Google Drive
  const executeSyncSingleFile = async (file: DriveFile) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setAuthError(`❌ Không có kết nối mạng Internet! Không thể tải tệp "${file.name}" lên Google Drive khi ngoại tuyến.`);
      setDriveSyncProgress(null);
      return;
    }

    // Pre-check: If file is already synced and has driveFileId, avoid redundant duplicate sync!
    if (file.driveFileId && file.isSyncedToDrive && file.syncStatus === 'synced') {
      setSyncStatusMsg(`ℹ️ Tệp "${file.name}" đã được đồng bộ an toàn trên Google Drive.`);
      setTimeout(() => setSyncStatusMsg(null), 3000);
      return;
    }

    setSyncingDriveFileId(file.id);
    setAuthError(null);
    setDriveSyncProgress({
      fileName: file.name,
      current: 1,
      total: 1,
      percent: 25,
      statusText: 'Đang chuẩn bị tải tệp lên Google Drive...',
      active: true,
    });
    setSyncStatusMsg(`Đang đẩy tệp "${file.name}" lên Google Drive...`);

    try {
      const targetFolderId = saConfig?.folderId || localStorage.getItem('app_sa_folder_id') || undefined;
      
      setDriveSyncProgress(prev => prev ? { ...prev, percent: 60, statusText: 'Đang tải dữ liệu tệp lên Google Drive...' } : null);
      const uploaded = await uploadLocalFileToUserGoogleDrive(file.id, targetFolderId, file.base64Data || (file as any).thumbnailUrl);

      setDriveSyncProgress(prev => prev ? { ...prev, percent: 95, statusText: 'Đang xác minh trạng thái lưu trữ...' } : null);

      if (uploaded.driveFileId) {
        // ACTUALLY UPLOADED TO GOOGLE DRIVE
        if (onFileUpdate) {
          onFileUpdate(file.id, {
            ...(uploaded.file || file),
            isSyncedToDrive: true,
            driveFileId: uploaded.driveFileId,
            webViewLink: uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.driveFileId}/view`,
            syncStatus: 'synced',
          });
        }

        setDriveSyncProgress({
          fileName: file.name,
          current: 1,
          total: 1,
          percent: 100,
          statusText: 'Đã lưu Google Drive thành công!',
          active: false,
        });

        setSyncStatusMsg(`✅ Đã lưu "${file.name}" lên Google Drive của Admin thành công!`);
      } else {
        // Saved in Cloud Vault but requires Admin Google Login for personal Drive
        if (onFileUpdate && uploaded.file) {
          onFileUpdate(file.id, {
            ...uploaded.file,
            isSyncedToDrive: false,
            syncStatus: 'local_only',
          });
        }

        setDriveSyncProgress(null);
        setAdminLoginPrompt({
          isOpen: true,
          pendingFile: file,
          isSyncAll: false,
          notice: 'Để đồng bộ tệp trực tiếp vào Google Drive cá nhân, hệ thống yêu cầu đăng nhập bằng Tài khoản Google của Admin (Chủ sở hữu thư mục Drive). Tệp hiện đã được lưu trữ an toàn trong Cloud Vault.',
        });
      }

      setTimeout(() => {
        setSyncStatusMsg(null);
        setDriveSyncProgress(null);
      }, 5000);
    } catch (err: any) {
      console.error('Error syncing file to Drive:', err);
      const msg = err?.message || '';
      if (msg.includes('401') || msg.includes('authError') || msg.includes('xác thực') || msg.includes('quyền truy cập')) {
        setAdminLoginPrompt({
          isOpen: true,
          pendingFile: file,
          isSyncAll: false,
          notice: 'Phiên xác thực Google của Admin đã hết hạn. Vui lòng đăng nhập lại tài khoản Google của Admin để tiếp tục tải tệp lên Drive.',
        });
      } else {
        setAuthError(`Lỗi đồng bộ lên Google Drive: ${msg}`);
      }
      setDriveSyncProgress(null);
    } finally {
      setSyncingDriveFileId(null);
    }
  };

  // 1-Click Sync Local File to Personal Google Drive entry point
  const handleSyncLocalFileToUserDrive = async (file: DriveFile) => {
    const currentToken = getGoogleAccessToken();
    // If Admin account is not logged in, prompt user clearly before attempting
    if (!googleUser && !currentToken) {
      setAdminLoginPrompt({
        isOpen: true,
        pendingFile: file,
        isSyncAll: false,
        notice: `Để đồng bộ tệp "${file.name}" lên Google Drive, hệ thống yêu cầu đăng nhập bằng Tài khoản Google của Admin (Chủ sở hữu thư mục Drive).`,
      });
      return;
    }

    await executeSyncSingleFile(file);
  };

  // Internal executor for syncing all local files
  const executeSyncAllLocalFiles = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setAuthError('❌ Không có kết nối mạng Internet! Không thể đồng bộ tệp lên Google Drive khi thiết bị đang ngoại tuyến.');
      return;
    }

    const localFiles = files.filter(f => !f.isSyncedToDrive && f.syncStatus !== 'synced');
    if (localFiles.length === 0) {
      setSyncStatusMsg('Tất cả các tệp hiện tại đã được đồng bộ trên Google Drive!');
      setTimeout(() => setSyncStatusMsg(null), 3000);
      return;
    }

    const currentToken = getGoogleAccessToken();
    if (!googleUser || !currentToken) {
      setAuthError('⚠️ Bắt buộc phải đăng nhập tài khoản Google trước khi đồng bộ lên Google Drive (Chặn đồng bộ ảo).');
      setAdminLoginPrompt({
        isOpen: true,
        isSyncAll: true,
        notice: 'Để đồng bộ tệp lên Google Drive cá nhân, bạn bắt buộc phải đăng nhập bằng Tài khoản Google của bạn (tránh đồng bộ ảo).',
      });
      handleGoogleSignInClick();
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
    setSyncStatusMsg(`Bắt đầu đồng bộ ${localFiles.length} tệp lên Google Drive của bạn...`);
    let driveSuccessCount = 0;
    let failedCount = 0;
    const targetFolderId = saConfig?.folderId || localStorage.getItem('app_sa_folder_id') || undefined;

    for (let i = 0; i < localFiles.length; i++) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setAuthError('❌ Đã mất kết nối mạng Internet giữa chừng! Đã dừng tiến trình đồng bộ các tệp còn lại.');
        break;
      }
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
        const uploaded = await uploadLocalFileToUserGoogleDrive(f.id, targetFolderId, f.base64Data || (f as any).thumbnailUrl);
        if (uploaded.driveFileId) {
          driveSuccessCount++;
          if (onFileUpdate) {
            onFileUpdate(f.id, {
              ...(uploaded.file || f),
              isSyncedToDrive: true,
              driveFileId: uploaded.driveFileId,
              webViewLink: uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.driveFileId}/view`,
              syncStatus: 'synced',
            });
          }
        } else {
          failedCount++;
        }
        const nextPercent = Math.round(((i + 1) / localFiles.length) * 100);
        setDriveSyncProgress(prev => prev ? { ...prev, percent: nextPercent, statusText: `Đã xử lý (${i + 1}/${localFiles.length}): ${f.name}` } : null);
      } catch (err: any) {
        console.warn(`Sync notice for "${f.name}":`, err?.message || err);
        failedCount++;
        const msg = err?.message || 'Lỗi xác thực';
        const isAuthError = err?.requiresAdminLogin || err?.status === 401 || msg.includes('401') || msg.includes('đăng nhập') || msg.includes('xác thực') || msg.includes('Shared Drive') || msg.includes('hạn mức') || msg.includes('quota') || msg.includes('quyền') || msg.includes('hết hạn');

        if (isAuthError) {
          setGoogleUser(null);
          setAuthError('⚠️ Phiên đăng nhập Google Drive đã hết hạn. Vui lòng đăng nhập lại tài khoản Google để tiếp tục.');
          setDriveSyncProgress(null);
          setAdminLoginPrompt({
            isOpen: true,
            isSyncAll: true,
            notice: 'Để đồng bộ tệp lên Google Drive cá nhân (@gmail.com), hệ thống cần bạn đăng nhập tài khoản Google để cấp quyền lưu trữ.',
          });
          break;
        } else {
          setAuthError(`Lỗi khi tải tệp "${f.name}": ${msg}`);
        }
      }
    }

    setSyncingDriveFileId(null);
    if (driveSuccessCount > 0) {
      setDriveSyncProgress({
        fileName: `${driveSuccessCount} tệp`,
        current: driveSuccessCount,
        total: localFiles.length,
        percent: 100,
        statusText: `Đã đồng bộ lên Google Drive ${driveSuccessCount}/${localFiles.length} tệp!`,
        active: false,
      });
      setSyncStatusMsg(`✅ Đã đồng bộ thành công ${driveSuccessCount}/${localFiles.length} tệp lên Google Drive!${failedCount > 0 ? ` (${failedCount} tệp thất bại)` : ''}`);
    } else {
      setDriveSyncProgress(null);
      setSyncStatusMsg(null);
      setAuthError('❌ Không có tệp nào được tải lên Google Drive. Bắt buộc đăng nhập tài khoản Google để đồng bộ thực tế.');
      setAdminLoginPrompt({
        isOpen: true,
        isSyncAll: true,
        notice: 'Để đồng bộ tệp trực tiếp lên Google Drive, hệ thống yêu cầu đăng nhập bằng Tài khoản Google của bạn (tránh đồng bộ ảo).',
      });
    }

    setTimeout(() => {
      setSyncStatusMsg(null);
      setDriveSyncProgress(null);
    }, 6000);
  };

  // Open Sync & Purge modal or notify if all files are already synced
  const handleOpenSyncPurgeModal = () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setAuthError('❌ Không có kết nối mạng Internet! Không thể thực hiện đồng bộ lên Google Drive khi thiết bị đang ngoại tuyến.');
      return;
    }
    if (localFiles.length === 0) {
      setSyncStatusMsg('✅ Tất cả tệp hiện tại đã được đồng bộ an toàn trên Google Drive!');
      setTimeout(() => setSyncStatusMsg(null), 4000);
      return;
    }
    setIsSyncPurgeModalOpen(true);
  };

  // Execute Batch Sync to Google Drive and Purge local originals
  const handleExecuteSyncAndPurgeLocal = async () => {
    if (localFiles.length === 0) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setAuthError('❌ Không có kết nối mạng Internet! Không thể đồng bộ tệp lên Google Drive & xóa local khi đang ngoại tuyến.');
      return;
    }

    // MANDATORY GOOGLE LOGIN CHECK
    const currentToken = getGoogleAccessToken();
    if (!googleUser || !currentToken) {
      setAuthError('⚠️ Bắt buộc phải đăng nhập tài khoản Google trước khi đồng bộ lên Google Drive.');
      setIsSyncPurgeModalOpen(false);
      handleGoogleSignInClick();
      return;
    }

    setIsSyncingAndPurging(true);
    setAuthError(null);
    setDriveSyncProgress({
      fileName: localFiles[0].name,
      current: 1,
      total: localFiles.length,
      percent: 5,
      statusText: `Bắt đầu đồng bộ 1/${localFiles.length}...`,
      active: true,
    });
    setSyncStatusMsg(`Đang đẩy ${localFiles.length} tệp lên Google Drive & xóa tệp gốc local...`);

    let driveSuccessCount = 0;
    let failedCount = 0;
    const targetFolderId = saConfig?.folderId || localStorage.getItem('app_sa_folder_id') || undefined;

    for (let i = 0; i < localFiles.length; i++) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setAuthError('❌ Mất kết nối mạng Internet giữa chừng! Đã dừng đồng bộ và bảo toàn toàn bộ tệp cục bộ chưa tải lên.');
        break;
      }
      const f = localFiles[i];
      const currentPercent = Math.round((i / localFiles.length) * 100);
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
        const uploaded = await uploadLocalFileToUserGoogleDrive(
          f.id,
          targetFolderId,
          f.base64Data || (f as any).thumbnailUrl,
          purgeLocalCopyAfterUpload,
          deleteLocalRecordAfterUpload
        );

        if (uploaded.driveFileId) {
          driveSuccessCount++;
          if (deleteLocalRecordAfterUpload) {
            if (onFileDelete) onFileDelete(f.id);
          } else if (onFileUpdate) {
            onFileUpdate(f.id, {
              ...(uploaded.file || f),
              isSyncedToDrive: true,
              driveFileId: uploaded.driveFileId,
              webViewLink: uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.driveFileId}/view`,
              syncStatus: 'synced',
              storageType: 'drive',
              hasBinary: false,
              base64Data: undefined,
              textContent: undefined,
              downloadUrl: `/api/drive-service-account/download/${uploaded.driveFileId}`,
              previewUrl: uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.driveFileId}/view`,
            });
          }
        } else {
          failedCount++;
        }

        const nextPercent = Math.round(((i + 1) / localFiles.length) * 100);
        setDriveSyncProgress(prev =>
          prev
            ? {
                ...prev,
                percent: nextPercent,
                statusText: `Đã xử lý (${i + 1}/${localFiles.length}): ${f.name}`,
              }
            : null
        );
      } catch (err: any) {
        console.warn(`Sync notice for "${f.name}":`, err?.message || err);
        failedCount++;
        const msg = err?.message || 'Lỗi xác thực Google Drive';
        const isAuthError = err?.requiresAdminLogin || err?.status === 401 || msg.includes('401') || msg.includes('đăng nhập') || msg.includes('xác thực') || msg.includes('Shared Drive') || msg.includes('hạn mức') || msg.includes('quota') || msg.includes('quyền') || msg.includes('hết hạn');

        if (isAuthError) {
          setGoogleUser(null);
          setAuthError('⚠️ Phiên đăng nhập Google Drive đã hết hạn. Vui lòng đăng nhập lại tài khoản Google để tải tệp lên Drive cá nhân.');
          setIsSyncPurgeModalOpen(false);
          setDriveSyncProgress(null);
          setAdminLoginPrompt({
            isOpen: true,
            isSyncAll: true,
            notice: 'Để đồng bộ tệp lên Google Drive cá nhân (@gmail.com), hệ thống cần bạn đăng nhập tài khoản Google để cấp quyền lưu trữ.',
          });
          break; // Stop immediately to avoid repeating errors across all files
        } else {
          setAuthError(`Lỗi khi tải tệp "${f.name}": ${msg}`);
        }
      }
    }

    setSyncingDriveFileId(null);
    setIsSyncingAndPurging(false);
    setIsSyncPurgeModalOpen(false);

    if (driveSuccessCount > 0) {
      setDriveSyncProgress({
        fileName: `${driveSuccessCount} tệp`,
        current: driveSuccessCount,
        total: localFiles.length,
        percent: 100,
        statusText: `Đã đồng bộ lên Google Drive ${driveSuccessCount}/${localFiles.length} tệp!`,
        active: false,
      });
      setSyncStatusMsg(
        `✅ Đã đồng bộ thành công ${driveSuccessCount}/${localFiles.length} tệp lên Google Drive${
          purgeLocalCopyAfterUpload ? ' và giải phóng tệp gốc lưu trên local' : ''
        }!${failedCount > 0 ? ` (${failedCount} tệp gặp lỗi)` : ''}`
      );
    } else {
      setDriveSyncProgress(null);
      setSyncStatusMsg(null);
      setAuthError('❌ Không có tệp nào được tải lên Google Drive. Bắt buộc đăng nhập tài khoản Google để thực hiện.');
      setAdminLoginPrompt({
        isOpen: true,
        isSyncAll: true,
        notice: 'Để đồng bộ tệp lên Google Drive cá nhân, bạn bắt buộc phải đăng nhập bằng Tài khoản Google của bạn (tránh đồng bộ ảo).',
      });
    }

    setTimeout(() => {
      setSyncStatusMsg(null);
      setDriveSyncProgress(null);
    }, 6000);
  };

  // 1-Click Sync ALL Local Files to Personal Google Drive entry point (alias)
  const handleSyncAllLocalFilesToUserDrive = async () => {
    handleOpenSyncPurgeModal();
  };

  // Unified handler to sync all pre-existing files directly from Google Drive
  const handleUnifiedSyncDriveFiles = async () => {
    setAuthError(null);
    setSyncStatusMsg(null);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setAuthError('❌ Không có kết nối mạng Internet! Không thể đồng bộ từ Google Drive khi thiết bị đang ngoại tuyến.');
      return;
    }

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
    const targetFile = files.find(f => f.id === fileId);
    let updatedTags = targetFile?.tags ? [...targetFile.tags] : [];

    // Filter out obsolete/unclassified tags and placeholder tokens
    updatedTags = updatedTags.filter(t => {
      const clean = t.toLowerCase().trim();
      return clean && clean !== 'unclassified' && clean !== 'chưa xác định' && clean !== 'chưa phân loại';
    });

    if (onFileUpdate) {
      onFileUpdate(fileId, { 
        classification: newClassification,
        tags: updatedTags 
      });
    }
    if (previewFile?.id === fileId) {
      setPreviewFile({
        ...previewFile,
        classification: newClassification,
        tags: updatedTags,
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

  // Toggle a category/tag for a file (Multi-select without closing popover)
  const handleToggleFileCategory = (fileId: string, categoryId: string) => {
    const targetFile = files.find(f => f.id === fileId);
    if (!targetFile) return;

    const targetCat = categories.find(c => c.id === categoryId);
    if (!targetCat) return;

    const isCurrentlySelected = isCategorySelectedForFile(targetFile, targetCat);

    let nextClassification = targetFile.classification || 'other';
    let currentTags = Array.isArray(targetFile.tags) ? [...targetFile.tags] : [];

    // Filter out placeholder tokens
    currentTags = currentTags.filter(t => {
      const clean = t.toLowerCase().trim();
      return clean && clean !== 'unclassified' && clean !== 'chưa xác định' && clean !== 'chưa phân loại';
    });

    if (isCurrentlySelected) {
      // UNCHECK / REMOVE: Remove from tags
      currentTags = currentTags.filter(t => 
        t.toLowerCase() !== targetCat.name.toLowerCase() && 
        t.toLowerCase() !== targetCat.id.toLowerCase()
      );

      // If this category was the primary classification, reassign to another tag or 'other'
      const isPrimary = nextClassification === targetCat.id || nextClassification.toLowerCase() === targetCat.name.toLowerCase();
      if (isPrimary) {
        if (currentTags.length > 0) {
          const firstRemainingCat = categories.find(c => currentTags.some(t => t.toLowerCase() === c.name.toLowerCase() || t.toLowerCase() === c.id.toLowerCase()));
          nextClassification = firstRemainingCat ? firstRemainingCat.id : currentTags[0];
        } else {
          nextClassification = 'other';
        }
      }
    } else {
      // CHECK / ADD: Add tag name to tags
      const alreadyInTags = currentTags.some(t => t.toLowerCase() === targetCat.name.toLowerCase() || t.toLowerCase() === targetCat.id.toLowerCase());
      if (!alreadyInTags) {
        currentTags.push(targetCat.name);
      }

      // If current classification is empty or 'other', set this as primary classification
      if (!nextClassification || nextClassification === 'other' || nextClassification === 'unclassified') {
        nextClassification = targetCat.id;
      }
    }

    const updatedPatch = {
      classification: nextClassification,
      tags: currentTags,
    };

    if (onFileUpdate) {
      onFileUpdate(fileId, updatedPatch);
    }
    if (previewFile?.id === fileId) {
      setPreviewFile({
        ...previewFile,
        ...updatedPatch,
      });
    }
    // Keep popover open so user can toggle multiple tags seamlessly!
  };

  // Add a new tag from popover search input or toggle if already exists
  const handlePopoverAddOrToggle = (fileId: string) => {
    const trimmed = popoverSearchQuery.trim();
    if (!trimmed) return;

    // Check if category already exists (case-insensitive)
    const existing = categories.find(c => 
      c.name.toLowerCase() === trimmed.toLowerCase() || 
      c.id.toLowerCase() === trimmed.toLowerCase()
    );

    if (existing) {
      // If it exists, toggle it for this file
      handleToggleFileCategory(fileId, existing.id);
      setPopoverSearchQuery('');
      return;
    }

    // Otherwise create new category
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

    const updatedCategories = [...categories, newCat];
    handleSaveCategories(updatedCategories);

    // Also attach to this file immediately
    const targetFile = files.find(f => f.id === fileId);
    if (targetFile) {
      let currentTags = Array.isArray(targetFile.tags) ? [...targetFile.tags] : [];
      if (!currentTags.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
        currentTags.push(trimmed);
      }
      const nextClassification = (!targetFile.classification || targetFile.classification === 'other' || targetFile.classification === 'unclassified')
        ? newCat.id
        : targetFile.classification;

      const patch = {
        classification: nextClassification,
        tags: currentTags,
      };

      if (onFileUpdate) onFileUpdate(fileId, patch);
      if (previewFile?.id === fileId) setPreviewFile({ ...previewFile, ...patch });
    }

    setPopoverSearchQuery('');
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

  // =========================================================================
  // MULTI-FILE BATCH UPLOAD ENGINE (Dual-Worker Concurrency & Isolated Progress)
  // =========================================================================
  const handleBatchUpload = async (rawFiles: File[]) => {
    if (!rawFiles || rawFiles.length === 0) return;

    // 0. Pre-check network connectivity before starting batch
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setAuthError('❌ Không có kết nối mạng Internet! Không thể tải lên tệp khi thiết bị đang ngoại tuyến.');
      return;
    }

    const targetClassification = selectedClassification !== 'all' ? selectedClassification : 'unclassified';
    const timestamp = Date.now();

    // Create high-entropy unique IDs for each file to eliminate race condition collisions
    const newItems: UploadQueueItem[] = rawFiles.map((file, idx) => {
      const entropy = Math.random().toString(36).substring(2, 9);
      const uniqueFileId = `file-${timestamp}-${entropy}-${idx}`;
      const queueId = `queue-${timestamp}-${entropy}-${idx}`;
      const formatCat = detectFormatCategory(file.name, file.type);

      return {
        id: queueId,
        fileId: uniqueFileId,
        file,
        name: file.name,
        size: file.size,
        category: formatCat,
        classification: targetClassification,
        progress: 0,
        status: 'pending',
        statusText: 'Đang xếp hàng chờ tải lên...',
      };
    });

    // Enqueue items into multi-file upload queue
    setUploadQueue(prev => [...prev, ...newItems]);
    setIsUploadPanelExpanded(true);

    // Concurrency control: 2 parallel workers (prevents browser socket exhaustion & memory overload)
    const CONCURRENCY_LIMIT = 2;
    const queueToProcess = [...newItems];
    let cursor = 0;

    const updateItem = (id: string, patch: Partial<UploadQueueItem>) => {
      setUploadQueue(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
    };

    const processOneItem = async (item: UploadQueueItem) => {
      // Offline network check per item
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        updateItem(item.id, {
          status: 'error',
          statusText: 'Thất bại: Không có kết nối mạng Internet',
          error: 'Mất kết nối mạng Internet',
          progress: 0,
        });
        return;
      }

      updateItem(item.id, {
        status: 'uploading',
        statusText: 'Đang đọc và chuẩn bị tệp...',
        progress: 15,
      });

      let gcsResult: any = null;
      let base64Data = '';

      try {
        // 1. Direct upload to Google Cloud Storage (GCS) if configured
        if (isCloudStorageConfigured()) {
          try {
            updateItem(item.id, {
              status: 'uploading',
              statusText: 'Đang tải lên Google Cloud Storage (GCS)...',
              progress: 25,
            });

            gcsResult = await uploadFileToStorage(item.file, {
              folder: 'documents',
              customFileName: `${item.fileId}_${item.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
              onProgress: (percent) => {
                const adjusted = Math.min(25 + Math.round(percent * 0.45), 70);
                updateItem(item.id, {
                  progress: adjusted,
                  statusText: `Đang tải lên Cloud Storage (${percent}%)...`,
                });
              }
            });
          } catch (gcsErr) {
            console.warn('[GCS Storage] Direct upload notice, falling back to local server storage:', gcsErr);
          }
        }

        if (!gcsResult) {
          updateItem(item.id, {
            status: 'uploading',
            statusText: 'Đang mã hóa dữ liệu nhị phân...',
            progress: 35,
          });
          try {
            base64Data = await fileToBase64(item.file);
          } catch (e) {
            console.warn('Base64 encoding notice:', e);
          }
        }

        // Online check before committing to backend database
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          throw new Error('Mất kết nối mạng Internet trong quá trình truyền dữ liệu.');
        }

        updateItem(item.id, {
          status: 'processing',
          statusText: 'Đang lưu trữ dữ liệu lên máy chủ và lập chỉ mục...',
          progress: 75,
        });

        const filePayload: Partial<DriveFile> & { base64Data?: string; storagePath?: string } = {
          id: item.fileId,
          name: item.name,
          mimeType: item.file.type || 'application/octet-stream',
          size: item.size,
          category: item.category,
          classification: item.classification,
          tags: [],
          isSyncedToDrive: false,
          syncStatus: gcsResult ? 'synced' : 'local_only',
          storageType: gcsResult ? 'gcs' : undefined,
          storagePath: gcsResult?.storagePath,
          downloadUrl: gcsResult?.downloadUrl || `/api/files/download/${item.fileId}`,
          previewUrl: gcsResult?.downloadUrl || `/api/files/preview/${item.fileId}`,
          uploadedAt: new Date().toISOString(),
          base64Data: base64Data || undefined,
        };

        const created = await onFileUpload(filePayload);

        if (!created) {
          throw new Error(
            (typeof navigator !== 'undefined' && !navigator.onLine)
              ? 'Mất kết nối Internet trong lúc gửi dữ liệu lên máy chủ.'
              : 'Máy chủ từ chối lưu trữ tệp hoặc không phản hồi. Vui lòng kiểm tra lại kết nối mạng.'
          );
        }

        // Auto Drive sync if user is authenticated with Google Account
        let isSyncedToDrive = false;
        const userToken = getGoogleAccessToken();
        if (userToken && !created.isSyncedToDrive && (typeof navigator !== 'undefined' && navigator.onLine)) {
          try {
            updateItem(item.id, {
              status: 'processing',
              statusText: 'Đang tự động lưu tệp lên Google Drive...',
              progress: 90,
            });
            const targetFolderId = saConfig?.folderId || localStorage.getItem('app_sa_folder_id') || undefined;
            const uploaded = await uploadLocalFileToUserGoogleDrive(created.id, targetFolderId, base64Data);
            if (uploaded?.driveFileId) {
              isSyncedToDrive = true;
              if (onFileUpdate && uploaded.file) {
                onFileUpdate(created.id, uploaded.file);
              }
            }
          } catch (driveErr) {
            console.info('Auto Drive upload deferred:', driveErr);
          }
        }

        updateItem(item.id, {
          status: 'completed',
          statusText: isSyncedToDrive
            ? 'Đã tải lên và lưu trữ Google Drive thành công!'
            : gcsResult?.downloadUrl
            ? 'Đã lưu trữ Google Cloud Storage thành công!'
            : 'Đã lưu trữ an toàn & lập chỉ mục AI!',
          progress: 100,
          isSyncedToDrive,
        });

      } catch (err: any) {
        console.error(`Upload error for "${item.name}":`, err);
        const msg = err?.message || 'Lỗi mạng hoặc máy chủ không phản hồi';
        updateItem(item.id, {
          status: 'error',
          statusText: `Lỗi: ${msg}`,
          error: msg,
          progress: 0,
        });
        setAuthError(`❌ Lỗi tải lên tệp "${item.name}": ${msg}`);
      }
    };

    // Worker loop
    const runWorker = async () => {
      while (cursor < queueToProcess.length) {
        const nextItem = queueToProcess[cursor++];
        if (nextItem) {
          await processOneItem(nextItem);
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(CONCURRENCY_LIMIT, queueToProcess.length) },
      () => runWorker()
    );
    await Promise.all(workers);
  };

  // Legacy single file adapter
  const handleProcessUpload = async (rawFile: File) => {
    await handleBatchUpload([rawFile]);
  };

  // Retry an individual failed item
  const handleRetryUploadItem = async (itemId: string) => {
    const target = uploadQueue.find(i => i.id === itemId);
    if (!target) return;
    setUploadQueue(prev => prev.filter(i => i.id !== itemId));
    handleBatchUpload([target.file]);
  };

  // Retry all failed items
  const handleRetryAllFailed = () => {
    const failedItems = uploadQueue.filter(i => i.status === 'error');
    if (failedItems.length === 0) return;
    const filesToRetry = failedItems.map(i => i.file);
    setUploadQueue(prev => prev.filter(i => i.status !== 'error'));
    handleBatchUpload(filesToRetry);
  };

  // Clear all completed uploads
  const handleClearCompletedUploads = () => {
    setUploadQueue(prev => prev.filter(i => i.status !== 'completed'));
  };

  // Remove a single item from the upload queue
  const handleRemoveUploadItem = (itemId: string) => {
    setUploadQueue(prev => prev.filter(i => i.id !== itemId));
  };

  const handleTriggerPicker = () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setAuthError('❌ Không có kết nối mạng Internet! Không thể chọn tải tệp khi thiết bị đang ngoại tuyến.');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setAuthError('❌ Không có kết nối mạng Internet! Không thể tải tệp lên khi đang ngoại tuyến.');
        e.target.value = '';
        return;
      }
      const filesArray = Array.from(e.target.files) as File[];
      e.target.value = '';
      handleBatchUpload(filesArray);
    }
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    const targetFile = fileToDelete;
    setFileToDelete(null);
    if (targetFile.storagePath) {
      deleteFileFromStorage(targetFile.storagePath).catch(() => {});
    }
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

  const handleOpenEditNote = (file: DriveFile) => {
    setEditingNoteFile(file);
    setNoteInputText(file.notes || file.description || '');
    setNoteInputTags(file.tags ? file.tags.join(', ') : '');
  };

  const handleSaveNote = async () => {
    if (!editingNoteFile) return;
    setIsSavingNote(true);
    try {
      const parsedTags = noteInputTags
        .split(',')
        .map(t => t.trim().replace(/^#+/, ''))
        .filter(t => {
          const clean = t.toLowerCase();
          return clean && clean !== 'unclassified' && clean !== 'chưa xác định' && clean !== 'chưa phân loại';
        });

      const trimmedNote = noteInputText.trim();
      const currentTags = (editingNoteFile.tags || []).filter(t => {
        const clean = t.toLowerCase().trim();
        return clean && clean !== 'unclassified' && clean !== 'chưa xác định' && clean !== 'chưa phân loại';
      });

      const updatedData: Partial<DriveFile> = {
        notes: trimmedNote,
        description: trimmedNote,
        tags: parsedTags.length > 0 ? parsedTags : currentTags,
      };

      if (onFileUpdate) {
        await onFileUpdate(editingNoteFile.id, updatedData);
      }

      if (previewFile?.id === editingNoteFile.id) {
        setPreviewFile({
          ...previewFile,
          ...updatedData,
        });
      }
      setEditingNoteFile(null);
    } catch (err) {
      console.error('Error saving document note:', err);
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleGenerateAiNote = async () => {
    if (!editingNoteFile) return;
    setIsGeneratingAiNote(true);
    try {
      const catObj = resolveCategory(editingNoteFile.classification, categories);
      const prompt = `Bạn là trợ lý quản lý tài liệu thông minh. Hãy tạo một đoạn chú thích tóm tắt ngắn gọn (1-2 câu, khoảng 15-30 từ) cho tài liệu sau giúp người dùng tra cứu nhanh chóng và dễ dàng tìm thấy mà không bị phụ thuộc hoàn toàn vào tên tệp:
- Tên tệp: "${editingNoteFile.name}"
- Nhóm phân loại: "${catObj.name}"
- Định dạng: "${editingNoteFile.category}"
${editingNoteFile.textContent ? `- Nội dung trích đoạn: ${editingNoteFile.textContent.slice(0, 400)}` : ''}

Chỉ trả về trực tiếp đoạn văn bản chú thích súc tích, tự nhiên bằng tiếng Việt, không kèm lời giải thích hay ngoặc kép thừa.`;

      const res = await api.sendChatMessage(prompt, false, [], 'doc_note_generator');
      if (res?.reply) {
        const cleaned = res.reply.replace(/^["'\s]+|["'\s]+$/g, '').trim();
        setNoteInputText(cleaned);
      }
    } catch (e) {
      const cleanName = editingNoteFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const catName = resolveCategory(editingNoteFile.classification, categories).name;
      setNoteInputText(`Tài liệu ${cleanName} thuộc nhóm ${catName}, lưu trữ phục vụ tra cứu thông tin và thủ tục.`);
    } finally {
      setIsGeneratingAiNote(false);
    }
  };

  // Collect available tags across files, tasks, notes, and categories
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    const defaults = ['Công việc', 'Cá nhân', 'Mẫu giấy tờ', 'Tài chính', 'Hợp đồng', 'Báo cáo', 'Dự án', 'Architecture', 'Hóa đơn', 'Bảo hiểm', 'Chứng chỉ'];
    defaults.forEach(t => set.add(t));
    files?.forEach(f => f.tags?.forEach(tag => tag && set.add(tag.trim())));
    tasks?.forEach(t => t.tags?.forEach(tag => tag && set.add(tag.trim())));
    notes?.forEach(n => n.tags?.forEach(tag => tag && set.add(tag.trim())));
    categories.forEach(c => set.add(c.name));
    return Array.from(set).filter(Boolean);
  }, [files, tasks, notes, categories]);

  // Main file filtering: Classification + Format + Search Keyword across (Name, Notes, Description, Content, Tags, Categories)
  const filteredFiles = useMemo(() => {
    const filtered = files.filter(f => {
      // 1. Classification filter (Hỗ trợ đa tag - kiểm tra cả phân loại chính và các tag phụ)
      if (selectedClassification !== 'all') {
        const targetCategory = categories.find(c => c.id === selectedClassification);
        if (targetCategory) {
          if (!isCategorySelectedForFile(f, targetCategory)) return false;
        } else {
          const fileCat = f.classification || 'other';
          if (fileCat !== selectedClassification) return false;
        }
      }

      // 2. Format filter (Document, Spreadsheet, PDF...)
      if (formatFilter !== 'all' && f.category !== formatFilter) {
        return false;
      }

      // 3. Search query / #tag query - Full multi-field match (Name, Notes, Description, Content, Category, Tags)
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const tagQueries = q.match(/#([\w\p{L}]+)/gu)?.map(t => t.slice(1).toLowerCase()) || [];
        const nonTagQ = q.replace(/#([\w\p{L}]+)/gu, '').trim();

        const matchName = !nonTagQ || f.name.toLowerCase().includes(nonTagQ);
        const matchNotes = !nonTagQ || (!!f.notes && f.notes.toLowerCase().includes(nonTagQ));
        const matchDescription = !nonTagQ || (!!f.description && f.description.toLowerCase().includes(nonTagQ));
        const matchContent = !nonTagQ || (!!f.textContent && f.textContent.toLowerCase().includes(nonTagQ));

        const linkedTasks = tasks.filter(t => t.attachedFileIds?.includes(f.id));
        const linkedNotes = notes.filter(n => n.attachedFileIds?.includes(f.id));
        const resolvedCat = resolveCategory(f.classification, categories);
        const matchCatName = !nonTagQ || resolvedCat.name.toLowerCase().includes(nonTagQ);

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

        const matchAnyField = matchName || matchNotes || matchDescription || matchContent || matchCatName;

        return (matchAnyField && matchAllTags) || matchAnyTag;
      }
      return true;
    });

    // Apply Sorting Order (By Upload Date, Name, or Size)
    return [...filtered].sort((a, b) => {
      if (sortKey === 'name') {
        const comp = a.name.localeCompare(b.name, 'vi', { sensitivity: 'base', numeric: true });
        return sortOrder === 'asc' ? comp : -comp;
      }

      if (sortKey === 'uploadedAt') {
        const parseTime = (file: DriveFile): number => {
          if (file.uploadedAt) {
            const t = new Date(file.uploadedAt).getTime();
            if (!isNaN(t) && t > 0) return t;
          }
          // Fallback: extract timestamp from ID if matches file-123456789
          const idMatch = file.id?.match(/(\d{10,13})/);
          if (idMatch) return parseInt(idMatch[1], 10);
          return 0;
        };

        const timeA = parseTime(a);
        const timeB = parseTime(b);
        if (timeA !== timeB) {
          return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
        }
        return a.name.localeCompare(b.name, 'vi', { sensitivity: 'base', numeric: true });
      }

      if (sortKey === 'size') {
        const sizeDiff = (a.size || 0) - (b.size || 0);
        return sortOrder === 'asc' ? sizeDiff : -sizeDiff;
      }

      return 0;
    });
  }, [files, selectedClassification, formatFilter, search, categories, tasks, notes, sortKey, sortOrder]);

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
  const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
  const syncedCount = files.filter(f => f.isSyncedToDrive && f.syncStatus === 'synced').length;
  const localOnlyCount = files.length - syncedCount;

  const getLinkedTasks = (fileId: string) => tasks.filter(t => t.attachedFileIds?.includes(fileId));
  const getLinkedNotes = (fileId: string) => notes.filter(n => n.attachedFileIds?.includes(fileId));

  // Shared Category Badge & Multi-Select Popover Component
  const renderCategoryBadgeAndPopover = (file: DriveFile, resolvedCat: DocumentCategory, colorCfg: any) => {
    const isCategoryPopoverOpen = openCategoryPopoverFileId === file.id;
    const assignedCats = getFileSelectedCategories(file);

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            if (isCategoryPopoverOpen) {
              setOpenCategoryPopoverFileId(null);
              setPopoverSearchQuery('');
            } else {
              setOpenCategoryPopoverFileId(file.id);
              setPopoverSearchQuery('');
            }
          }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold border transition-all cursor-pointer ${colorCfg.bg} ${colorCfg.text} ${colorCfg.border} hover:opacity-90 shadow-xs`}
          title="Bấm vào để tìm nhanh hoặc tích chọn nhiều tag phân loại"
        >
          {renderCategoryIcon(resolvedCat.icon, 'w-3 h-3')}
          <span>{resolvedCat.name}</span>
          {assignedCats.length > 1 && (
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-white/20 dark:bg-black/30 font-mono font-bold" title={`Đã gán ${assignedCats.length} tag: ${assignedCats.map(c => c.name).join(', ')}`}>
              +{assignedCats.length - 1}
            </span>
          )}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>

        {/* Popover Quick Category Selector with Top Search, Real-Time Filter & Multi-Select Checkboxes */}
        {isCategoryPopoverOpen && (
          <div className="absolute top-full left-0 mt-1 z-30 w-72 sm:w-80 bg-[#181818] border border-[#3A3A3A] rounded shadow-2xl p-3 space-y-2.5 animate-in fade-in">
            {/* Header */}
            <div className="text-[10px] font-bold text-slate-500 dark:text-[#AAAAAA] uppercase px-0.5 pb-1.5 border-b border-slate-200 dark:border-[#2A2A2A] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-[#D4AF37]" />
                <span>Phân loại tài liệu (Chọn nhiều tag)</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setOpenCategoryPopoverFileId(null);
                  setPopoverSearchQuery('');
                }}
                className="text-slate-400 hover:text-slate-700 dark:text-[#666666] dark:hover:text-white cursor-pointer px-1 text-xs"
                title="Đóng bảng phân loại"
              >
                ✕
              </button>
            </div>

            {/* Top: Fast Tag Search Bar with + Button on the Right */}
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 dark:text-[#777777] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tìm nhanh tag hoặc nhập tên mới..."
                  value={popoverSearchQuery}
                  onChange={(e) => setPopoverSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handlePopoverAddOrToggle(file.id);
                    }
                  }}
                  className="w-full pl-8 pr-6 py-1.5 bg-slate-50 dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#333333] focus:border-blue-500 dark:focus:border-[#D4AF37] rounded text-xs text-slate-800 dark:text-[#E0E0E0] placeholder:text-slate-400 dark:placeholder:text-[#666666] focus:outline-none transition-colors"
                  autoFocus
                />
                {popoverSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setPopoverSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-[#888888] dark:hover:text-white text-xs cursor-pointer"
                    title="Xóa tìm kiếm"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* + Button directly to the right of search bar */}
              <button
                type="button"
                onClick={() => handlePopoverAddOrToggle(file.id)}
                disabled={!popoverSearchQuery.trim()}
                className="h-8 px-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-[#D4AF37] dark:hover:bg-[#c29f2e] text-white dark:text-black disabled:opacity-30 disabled:cursor-not-allowed font-bold rounded text-xs shrink-0 cursor-pointer flex items-center justify-center transition-all shadow-xs"
                title={popoverSearchQuery.trim() ? `Thêm hoặc gắn tag "${popoverSearchQuery.trim()}"` : 'Nhập tên tag để thêm mới'}
              >
                <Plus className="w-4 h-4 stroke-[3]" />
              </button>
            </div>

            {/* List of categories with Multi-Select Checkboxes (Auto-filtered in real-time) */}
            <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5 scrollbar-thin">
              {(() => {
                const q = popoverSearchQuery.trim().toLowerCase();
                const filteredCategories = q
                  ? categories.filter(c => c.name.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q)))
                  : categories;

                if (filteredCategories.length === 0) {
                  return (
                    <div className="py-3 px-2 text-center text-xs text-slate-500 dark:text-[#888888] bg-slate-50 dark:bg-[#121212] rounded border border-dashed border-slate-200 dark:border-[#2A2A2A]">
                      <p>Chưa có tag nào là <strong className="text-slate-800 dark:text-white">"{popoverSearchQuery}"</strong></p>
                      <button
                        type="button"
                        onClick={() => handlePopoverAddOrToggle(file.id)}
                        className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37] dark:hover:bg-[#D4AF37]/30 border border-blue-200 dark:border-[#D4AF37]/40 rounded text-[11px] font-bold cursor-pointer transition-colors"
                      >
                        <Plus className="w-3 h-3 stroke-[3]" />
                        <span>Tạo và gắn tag "{popoverSearchQuery.trim()}"</span>
                      </button>
                    </div>
                  );
                }

                return filteredCategories.map(cat => {
                  const cCfg = CATEGORY_COLORS[cat.color] || CATEGORY_COLORS.zinc;
                  const isSelected = isCategorySelectedForFile(file, cat);
                  const catDocCount = classificationCounts[cat.id] || classificationCounts[cat.name] || 0;

                  return (
                    <div
                      key={cat.id}
                      className={`group/catitem w-full px-2 py-1.5 rounded text-xs flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-blue-50 text-blue-900 border border-blue-200 dark:bg-[#262626] dark:text-white dark:border-[#404040] font-bold shadow-xs'
                          : 'text-slate-600 hover:bg-slate-50 border border-transparent dark:text-[#CCCCCC] dark:hover:bg-[#202020]'
                      }`}
                    >
                      {/* Toggle button with Checkbox */}
                      <button
                        type="button"
                        onClick={() => handleToggleFileCategory(file.id, cat.id)}
                        className="flex-1 text-left flex items-center gap-2 min-w-0 cursor-pointer py-0.5"
                        title={isSelected ? `Bỏ chọn tag "${cat.name}"` : `Tích chọn tag "${cat.name}"`}
                      >
                        {/* Multi-select Checkbox */}
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-600 dark:text-[#D4AF37] shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 dark:text-[#555555] group-hover/catitem:text-slate-600 dark:group-hover/catitem:text-[#888888] shrink-0" />
                        )}

                        {/* Category Icon and Name */}
                        <span className={`flex items-center gap-1.5 truncate ${cCfg.text}`}>
                          {renderCategoryIcon(cat.icon, 'w-3.5 h-3.5 shrink-0')}
                          <span className="truncate">{cat.name}</span>
                        </span>

                        {/* Document count */}
                        <span className="text-[10px] text-slate-400 dark:text-[#666666] font-mono shrink-0 ml-auto mr-1">
                          ({catDocCount})
                        </span>
                      </button>

                      {/* Delete button on the right */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRequestDeleteCategory(cat);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:text-[#666666] dark:hover:text-rose-400 dark:hover:bg-rose-950/60 rounded transition-all cursor-pointer shrink-0 opacity-60 group-hover/catitem:opacity-100 ml-1"
                        title={`Xóa phân loại "${cat.name}"${catDocCount > 0 ? ` (đang có ${catDocCount} tài liệu)` : ''}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Bottom Footer: Selected Tag Count & Done Button */}
            <div className="pt-2 border-t border-slate-200 dark:border-[#2A2A2A] flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500 dark:text-[#888888]">
                Đã chọn: <strong className="text-blue-600 dark:text-[#D4AF37] font-mono">{getFileSelectedCategories(file).length}</strong> tag
              </span>
              <button
                type="button"
                onClick={() => {
                  setOpenCategoryPopoverFileId(null);
                  setPopoverSearchQuery('');
                }}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white dark:bg-[#252525] dark:hover:bg-[#333333] dark:text-white rounded text-[11px] font-bold cursor-pointer transition-colors shadow-xs"
              >
                Xong (Đóng)
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

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
              {isGoogleLoggedIn ? (
                <span className="text-[10px] bg-emerald-950/80 text-emerald-400 border border-emerald-700/80 px-2.5 py-0.5 rounded font-mono font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Google Drive: {googleUser?.email || saConfig?.folderName || 'Đã kết nối'}</span>
                </span>
              ) : (
                <span className="text-[10px] bg-amber-950/40 text-amber-300 border border-amber-600/50 px-2.5 py-0.5 rounded font-mono flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Google Drive: Chưa đăng nhập</span>
                </span>
              )}
            </div>
            <p className="text-xs text-[#888888] italic">
              Tổ chức hồ sơ linh hoạt: Công việc, Cá nhân, Mẫu giấy tờ, Hợp đồng, Tài chính & Dự án
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Category Manager Button (Always available for local document organization) */}
          <button
            onClick={() => setIsManagingCategories(true)}
            className="px-3 py-2 rounded-sm bg-white hover:bg-slate-50 text-blue-600 border border-slate-300 dark:bg-[#0C0C0C] dark:hover:bg-[#1A1A1A] dark:text-[#D4AF37] dark:border-[#D4AF37]/40 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Tùy chỉnh, thêm mới hoặc sửa các nhóm phân loại tài liệu"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Phân Loại ({categories.length})</span>
          </button>

          {/* Conditional Google Drive Master Control Architecture */}
          {!isGoogleLoggedIn ? (
            /* ============================================================== */
            /* 1. NOT LOGGED IN: Single Master Button to Connect Google Drive */
            /* ============================================================== */
            <button
              type="button"
              onClick={handleGoogleSignInClick}
              disabled={isLoggingInGoogle}
              className="px-4 py-2 rounded-sm bg-gradient-to-r from-[#181818] via-[#221C0D] to-[#161616] hover:from-[#242424] hover:to-[#2A2210] text-[#D4AF37] hover:text-[#F3E7A0] border border-[#D4AF37]/70 hover:border-[#D4AF37] text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
              title="Nhấn để đăng nhập tài khoản Google Drive và mở khóa các tính năng: Đẩy lên Drive, Nạp tệp từ Drive, Dọn trùng Drive"
            >
              {isLoggingInGoogle ? (
                <RefreshCw className="w-4 h-4 animate-spin text-[#D4AF37]" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 87.3 78" fill="none">
                  <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z" fill="#0066DA"/>
                  <path d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44C.4 49.9 0 51.45 0 53h27.5L43.65 25z" fill="#00AC47"/>
                  <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 10.15 7.9 13.65z" fill="#EA4335"/>
                  <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.4-4.5 1.2L43.65 25z" fill="#00832D"/>
                  <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.4 4.5-1.2L59.8 53z" fill="#2684FC"/>
                  <path d="M73.4 26.5l-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 53h27.5c0-1.55-.4-3.1-1.2-4.5l-12.7-22z" fill="#FFBA00"/>
                </svg>
              )}
              <span>{isLoggingInGoogle ? 'Đang mở đăng nhập...' : 'Quản Lý Tệp Trên Google Drive'}</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#332508] text-amber-300 border border-amber-600/60 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" />
                Đăng nhập
              </span>
            </button>
          ) : (
            /* ============================================================== */
            /* 2. LOGGED IN: Reveal Full Drive Operational Suite & Controls    */
            /* ============================================================== */
            <>
              {/* Connected Google Account Badge & Opener */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-[11px] font-mono shadow-xs bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-[#064E3B] dark:border-[#059669] dark:text-white">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold text-emerald-700 dark:text-[#6EE7B7]">Drive:</span>
                <button
                  type="button"
                  onClick={() => setIsDriveManageModalOpen(true)}
                  className="font-semibold truncate max-w-[150px] text-emerald-900 dark:text-white hover:underline cursor-pointer"
                  title={`Đã kết nối tài khoản ${googleUser?.email || 'Google'}. Nhấn để mở Trung Tâm Quản Lý Drive`}
                >
                  {googleUser?.email || saConfig?.folderName || 'Đã kết nối'}
                </button>
                <button
                  type="button"
                  onClick={handleGoogleSignOutClick}
                  className="text-[10px] underline cursor-pointer ml-1 font-bold text-emerald-700 hover:text-emerald-900 dark:text-[#6EE7B7] dark:hover:text-white"
                  title="Đăng xuất tài khoản Google"
                >
                  Thoát
                </button>
              </div>

              {/* Master Control Center Dashboard Button */}
              <button
                type="button"
                onClick={() => setIsDriveManageModalOpen(true)}
                className="px-3 py-2 rounded-sm bg-[#1A1A1A] hover:bg-[#252525] text-[#D4AF37] hover:text-white border border-[#D4AF37]/50 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                title="Mở Trung Tâm Quản Lý Google Drive (Chi tiết dung lượng, thư mục, đồng bộ)"
              >
                <HardDrive className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Quản Lý Drive</span>
              </button>

              {/* Dedicated Button to Sync ALL Local Files to Drive & Purge Local Originals */}
              <button
                type="button"
                onClick={handleOpenSyncPurgeModal}
                disabled={isSyncingAndPurging || !!syncingDriveFileId}
                className={`px-3.5 py-2 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50 ${
                  localFiles.length > 0
                    ? 'bg-amber-500 hover:bg-amber-600 text-white border border-amber-600 dark:bg-gradient-to-r dark:from-amber-950 dark:via-[#261B09] dark:to-[#161616] dark:text-[#FEF08A] dark:border-amber-500'
                    : 'bg-slate-100 text-slate-500 border border-slate-200 dark:bg-[#121212] dark:hover:bg-[#1A1A1A] dark:text-zinc-400 dark:border-zinc-800'
                }`}
                title="Đồng bộ tất cả các tệp hiện lưu local nhưng chưa có trên Google Drive và xóa tệp gốc trên local để giải phóng bộ nhớ"
              >
                <UploadCloud
                  className={`w-4 h-4 shrink-0 text-white dark:text-[#FEF08A] ${isSyncingAndPurging ? 'animate-bounce' : ''}`}
                />
                <span className="text-white dark:text-[#FEF08A]">
                  {isSyncingAndPurging ? 'Đang Đẩy Lên Drive...' : 'Đẩy Lên Drive & Xóa Local'}
                </span>
                {localFiles.length > 0 && (
                  <span
                    className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-600 text-white border border-amber-400 dark:bg-amber-950/60 dark:text-[#FEF08A] dark:border-amber-500"
                  >
                    {localFiles.length}
                  </span>
                )}
              </button>

              {/* Prominent Sync Pre-existing Files from Google Drive Button */}
              <button
                type="button"
                onClick={handleUnifiedSyncDriveFiles}
                disabled={isSyncing || isSyncingSa}
                className="px-3 py-2 rounded-sm bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 dark:bg-[#1A1A1A] dark:hover:bg-[#252525] dark:text-[#D4AF37] dark:border-[#D4AF37]/60 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                title="Nạp và hiển thị toàn bộ các tệp có sẵn trên Google Drive về ứng dụng"
              >
                <FolderSync className={`w-3.5 h-3.5 text-blue-600 dark:text-[#D4AF37] ${isSyncing || isSyncingSa ? 'animate-spin' : ''}`} />
                <span>{isSyncing || isSyncingSa ? 'Đang nạp...' : 'Nạp Tệp Từ Drive'}</span>
              </button>

              {/* Clean Duplicate & Stub Files on Google Drive Button */}
              <button
                type="button"
                onClick={handleCleanDriveDuplicates}
                disabled={isCleaningDuplicates}
                className="px-3 py-2 rounded-sm bg-white hover:bg-rose-50 text-rose-700 border border-slate-300 dark:bg-[#1A1212] dark:hover:bg-[#251515] dark:text-rose-300 dark:border-rose-600/50 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                title="Tự động quét Google Drive và xóa các bản sao trùng lặp, tệp rỗng/stub 260 byte để dọn dẹp thư mục"
              >
                <ShieldCheck className={`w-3.5 h-3.5 text-rose-600 dark:text-rose-400 ${isCleaningDuplicates ? 'animate-spin' : ''}`} />
                <span>{isCleaningDuplicates ? 'Đang dọn...' : 'Dọn Trùng Drive'}</span>
              </button>

              {/* Refresh Drive Button */}
              <button
                type="button"
                onClick={handleUnifiedSyncDriveFiles}
                disabled={isSyncingSa || isSyncing}
                className="px-3 py-1.5 rounded-sm bg-white hover:bg-slate-50 text-blue-600 border border-slate-300 dark:bg-[#1A1A1A] dark:hover:bg-[#252525] dark:text-[#D4AF37] dark:hover:text-white dark:border-[#D4AF37]/50 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                title="Làm mới kết nối và kiểm tra lại thư mục Google Drive"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSa ? 'animate-spin' : ''}`} />
                <span>{isSyncingSa ? 'Đang làm mới...' : 'Làm Mới Drive'}</span>
              </button>

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
            </>
          )}

          {/* 1-Click Upload Button (Always available for local document ingestion) */}
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
        <div className="p-3.5 rounded-sm bg-rose-950/70 border border-rose-600 text-xs text-rose-100 font-medium flex items-center justify-between flex-wrap gap-2 animate-in fade-in shadow-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="leading-relaxed">{authError}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setAdminLoginPrompt({
                  isOpen: true,
                  notice: 'Để đồng bộ tệp lên Google Drive cá nhân, hệ thống yêu cầu đăng nhập bằng Tài khoản Google của Admin (Chủ sở hữu thư mục Drive).',
                });
              }}
              className="px-3 py-1 bg-white hover:bg-slate-200 text-black font-bold text-[11px] uppercase tracking-wider rounded-sm cursor-pointer shadow flex items-center gap-1.5 transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-[#4285F4]" />
              <span>Đăng Nhập Google Admin</span>
            </button>
            {onNavigateToSettings && (
              <button
                onClick={onNavigateToSettings}
                className="px-3 py-1 bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold text-[11px] uppercase tracking-wider rounded-sm cursor-pointer shadow flex items-center gap-1 transition-colors"
              >
                <Settings className="w-3 h-3" />
                <span>Cài Đặt Drive</span>
              </button>
            )}
            <button onClick={() => setAuthError(null)} className="text-xs text-rose-300 hover:text-white cursor-pointer px-1">✕</button>
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
                ? 'bg-blue-600 text-white dark:bg-[#D4AF37] dark:text-black font-extrabold ring-1 ring-blue-500 dark:ring-[#D4AF37]'
                : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-[#0C0C0C] dark:text-[#AAAAAA] dark:border-[#2A2A2A] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tất Cả</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${selectedClassification === 'all' ? 'bg-white/20 text-white dark:bg-black/20 dark:text-black font-bold' : 'bg-slate-200 dark:bg-[#1A1A1A] text-slate-600 dark:text-[#888888]'}`}>
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
                    : `bg-white dark:bg-[#0C0C0C] ${colorCfg.text} ${colorCfg.border} hover:bg-slate-50 dark:hover:bg-[#1A1A1A]`
                }`}
              >
                {renderCategoryIcon(cat.icon, 'w-3.5 h-3.5')}
                <span>{cat.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                    isSelected ? 'bg-white/20 text-white dark:bg-black/20 dark:text-black' : 'bg-slate-100 dark:bg-[#151515] text-slate-600 dark:text-[#AAAAAA]'
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
            <span>Nhóm mới</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. SEARCH BAR & SECONDARY FORMAT FILTER */}
      {/* ============================================================== */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#151515] p-3 rounded-sm border border-[#2A2A2A]">
        <div className="flex-1 w-full">
          <TagSearchInput
            placeholder="Tìm kiếm tài liệu (tên file, chú thích, nội dung, gõ #tag hoặc phân loại)..."
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

      {/* Global Offline Network Status Alert Banner */}
      {!isOnline && (
        <div className="p-3.5 rounded-sm bg-amber-950/40 border border-amber-500/80 text-amber-200 flex items-center justify-between gap-3 shadow-md animate-in fade-in">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium">
            <CloudOff className="w-5 h-5 text-amber-400 flex-shrink-0 animate-pulse" />
            <div>
              <strong className="text-amber-300 font-bold">Mất kết nối Internet (Ngoại tuyến):</strong> Thiết bị của bạn đang không có mạng. Tính năng tải tệp lên và đồng bộ Google Drive tạm thời bị khóa để bảo đảm dữ liệu và tránh báo hoàn tất ảo.
            </div>
          </div>
          <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 whitespace-nowrap">
            OFFLINE
          </span>
        </div>
      )}

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

      {/* ============================================================== */}
      {/* 3. EXECUTIVE MULTI-FILE BATCH PROGRESS DASHBOARD */}
      {/* ============================================================== */}
      {uploadOverallStats && (
        <div className="p-4 rounded-sm bg-[#151515] border border-[#D4AF37]/80 shadow-2xl space-y-3 animate-in fade-in transition-all">
          {/* Master Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-sm bg-[#1A1A1A] border border-[#D4AF37]/40 text-[#D4AF37]">
                <UploadCloud className={`w-5 h-5 ${!uploadOverallStats.isAllFinished ? 'animate-bounce text-[#D4AF37]' : 'text-emerald-400'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-editorial-serif font-bold text-white flex items-center gap-1.5">
                    <span>Tiến độ tải lên đa tệp</span>
                    <span className="font-mono text-xs text-[#D4AF37] font-semibold">
                      ({uploadOverallStats.completedFiles}/{uploadOverallStats.totalFiles} tệp hoàn tất)
                    </span>
                  </h3>
                  {uploadOverallStats.isAllFinished ? (
                    uploadOverallStats.errorFiles > 0 ? (
                      <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-600/60 px-2 py-0.5 rounded font-mono font-bold">
                        Đã tải xong với {uploadOverallStats.errorFiles} lỗi
                      </span>
                    ) : (
                      <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-600/60 px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Hoàn tất 100%
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] bg-blue-950/80 text-sky-300 border border-sky-600/60 px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin text-sky-400" />
                      Đang tải {uploadOverallStats.activeFiles} tệp...
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#888888] font-mono mt-0.5">
                  Dung lượng: {formatFileSize(uploadOverallStats.uploadedBytes)} / {formatFileSize(uploadOverallStats.totalBytes)} • Hàng đợi luồng đôi (Dual-Worker Concurrency)
                </p>
              </div>
            </div>

            {/* Master Actions & Master Percentage */}
            <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
              {uploadOverallStats.errorFiles > 0 && (
                <button
                  onClick={handleRetryAllFailed}
                  className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-600/80 rounded-sm cursor-pointer flex items-center gap-1 transition-colors"
                  title="Thử lại các tệp bị lỗi"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Thử lại {uploadOverallStats.errorFiles} lỗi</span>
                </button>
              )}
              {uploadOverallStats.completedFiles > 0 && (
                <button
                  onClick={handleClearCompletedUploads}
                  className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-[#1A1A1A] hover:bg-[#252525] text-[#AAAAAA] hover:text-white border border-[#333333] rounded-sm cursor-pointer transition-colors"
                  title="Xóa danh sách các tệp đã tải xong"
                >
                  Xóa tệp xong
                </button>
              )}
              <button
                onClick={() => setIsUploadPanelExpanded(!isUploadPanelExpanded)}
                className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider bg-[#1A1A1A] hover:bg-[#252525] text-[#D4AF37] border border-[#D4AF37]/40 rounded-sm cursor-pointer flex items-center gap-1 transition-colors"
                title={isUploadPanelExpanded ? 'Thu gọn danh sách chi tiết' : 'Mở rộng xem chi tiết từng tệp'}
              >
                <span>{isUploadPanelExpanded ? 'Thu gọn' : 'Chi tiết'}</span>
                {isUploadPanelExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {uploadOverallStats.isAllFinished && (
                <button
                  onClick={() => setUploadQueue([])}
                  className="p-1 text-[#888888] hover:text-white rounded hover:bg-[#222222] cursor-pointer"
                  title="Đóng bảng tiến độ"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <div className="font-mono text-base font-extrabold text-[#D4AF37] min-w-[50px] text-right">
                {uploadOverallStats.overallPercent}%
              </div>
            </div>
          </div>

          {/* Master Overall Progress Bar */}
          <div className="space-y-1">
            <div className="w-full bg-[#0C0C0C] h-3 rounded-full overflow-hidden border border-[#2A2A2A] p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ease-out shadow-sm ${
                  uploadOverallStats.isAllFinished && uploadOverallStats.errorFiles === 0
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    : uploadOverallStats.errorFiles > 0
                    ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-rose-400'
                    : 'bg-gradient-to-r from-[#B8860B] via-[#D4AF37] to-[#F3E5AB]'
                }`}
                style={{ width: `${Math.max(3, Math.min(100, uploadOverallStats.overallPercent))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-[#888888]">
              <span>Tổng tiến trình tất cả tệp ({uploadOverallStats.completedFiles}/{uploadOverallStats.totalFiles} tệp hoàn tất)</span>
              <span className="font-bold text-white">{uploadOverallStats.overallPercent}%</span>
            </div>
          </div>

          {/* Granular Individual File Item List (Collapsible) */}
          {isUploadPanelExpanded && (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin border-t border-[#222222] pt-2.5">
              {uploadQueue.map((item, index) => {
                const isItemError = item.status === 'error';
                const isItemCompleted = item.status === 'completed';
                const isItemActive = item.status === 'uploading' || item.status === 'processing';

                return (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-sm border transition-all text-xs space-y-1.5 ${
                      isItemError
                        ? 'bg-[#1e1010] border-rose-500/70 text-rose-200'
                        : isItemCompleted
                        ? 'bg-[#0f1712] border-emerald-500/50 text-emerald-100'
                        : isItemActive
                        ? 'bg-[#181818] border-[#D4AF37]/50 text-white'
                        : 'bg-[#121212] border-[#222222] text-[#AAAAAA]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-mono text-[10px] text-[#666666] w-4">{index + 1}.</span>
                        <div className="shrink-0">{getFileFormatIcon(item.category)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate text-white" title={item.name}>
                            {item.name}
                          </div>
                          <div className="text-[10px] text-[#777777] font-mono flex items-center gap-1.5">
                            <span>{formatFileSize(item.size)}</span>
                            <span>•</span>
                            <span className="truncate max-w-[200px]">{item.statusText}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Status Badge & Item Progress */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isItemError ? (
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-mono font-bold">
                              Lỗi
                            </span>
                            <button
                              onClick={() => handleRetryUploadItem(item.id)}
                              className="p-1 hover:bg-rose-900/60 text-rose-300 hover:text-white rounded cursor-pointer"
                              title="Thử lại tệp này"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : isItemCompleted ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px] font-mono font-bold flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-400" />
                            {item.isSyncedToDrive ? 'Drive 100%' : '100%'}
                          </span>
                        ) : isItemActive ? (
                          <span className="px-2 py-0.5 rounded bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/40 text-[10px] font-mono font-bold flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin text-[#D4AF37]" />
                            {item.progress}%
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-[#1A1A1A] text-[#777777] border border-[#2A2A2A] text-[10px] font-mono">
                            Chờ
                          </span>
                        )}

                        <button
                          onClick={() => handleRemoveUploadItem(item.id)}
                          className="p-1 text-[#666666] hover:text-[#AAAAAA] hover:bg-[#252525] rounded cursor-pointer"
                          title="Xóa khỏi hàng đợi"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Item Individual Progress Bar */}
                    <div className="w-full bg-[#0C0C0C] h-1.5 rounded-full overflow-hidden border border-[#252525]">
                      <div
                        className={`h-full transition-all duration-200 ease-out ${
                          isItemError
                            ? 'bg-rose-500'
                            : isItemCompleted
                            ? 'bg-emerald-500'
                            : isItemActive
                            ? 'bg-[#D4AF37]'
                            : 'bg-[#333333]'
                        }`}
                        style={{ width: `${isItemError ? 100 : Math.max(isItemActive ? 5 : 0, item.progress)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Drag & Drop Upload Box */}
      <div
        onClick={handleTriggerPicker}
        onDragOver={(e) => {
          e.preventDefault();
          if (isOnline) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!isOnline) {
            setAuthError('❌ Không thể tải lên khi thiết bị đang ngoại tuyến. Vui lòng kết nối mạng Internet.');
            return;
          }
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const filesArray = Array.from(e.dataTransfer.files) as File[];
            handleBatchUpload(filesArray);
          }
        }}
        className={`p-6 rounded-sm border border-dashed text-center transition-all cursor-pointer group ${
          !isOnline
            ? 'border-amber-600/50 bg-amber-950/10 cursor-not-allowed'
            : dragOver
            ? 'border-[#D4AF37] bg-[#1A1A1A]'
            : 'border-[#2A2A2A] bg-[#151515] hover:border-[#D4AF37]'
        }`}
      >
        {!isOnline ? (
          <>
            <CloudOff className="w-8 h-8 text-amber-400 mx-auto mb-2 animate-pulse" />
            <h3 className="text-sm font-editorial-serif font-bold text-amber-300">
              Thiết bị đang ngoại tuyến — Vui lòng kết nối Internet để tải tài liệu lên
            </h3>
            <p className="text-xs text-amber-200/70 italic mt-1 max-w-lg mx-auto">
              Hệ thống tạm khóa tính năng tải lên để ngăn chặn báo hoàn tất ảo khi không có mạng.
            </p>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Filter Info / Results Header & Sorting Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#151515] p-3 rounded-sm border border-[#2A2A2A]">
        {/* Left: File Count & Active Filters */}
        <div className="flex items-center gap-2 text-xs text-[#888888] flex-wrap">
          <span>
            Hiển thị <strong className="text-white font-mono">{filteredFiles.length}</strong> / {files.length} tài liệu
            {selectedClassification !== 'all' && (
              <span className="ml-1.5 text-[#D4AF37] font-semibold">
                • Nhóm "{resolveCategory(selectedClassification, categories).name}"
              </span>
            )}
            {formatFilter !== 'all' && (
              <span className="ml-1.5 text-sky-400 font-semibold">
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
              className="text-[11px] text-[#D4AF37] hover:underline cursor-pointer font-medium ml-1"
            >
              ✕ Xóa bộ lọc
            </button>
          )}
        </div>

        {/* Right: Modern Sorting Selector & Quick Toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-[#0C0C0C] border border-[#2A2A2A] px-2.5 py-1 rounded-sm text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
            <span className="text-[#888888] font-medium hidden sm:inline">Sắp xếp:</span>
            
            {/* Quick Sort Toggle Buttons: Upload Date vs Name vs Size */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (sortKey === 'uploadedAt') {
                    handleSortChange('uploadedAt', sortOrder === 'desc' ? 'asc' : 'desc');
                  } else {
                    handleSortChange('uploadedAt', 'desc');
                  }
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 ${
                  sortKey === 'uploadedAt'
                    ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/50'
                    : 'text-[#888888] hover:text-white border border-transparent'
                }`}
                title={`Sắp xếp theo Thời gian tải lên (${sortKey === 'uploadedAt' && sortOrder === 'desc' ? 'Mới nhất → Cũ nhất' : 'Cũ nhất → Mới nhất'})`}
              >
                <span>Thời gian</span>
                {sortKey === 'uploadedAt' && (
                  sortOrder === 'desc' ? <ArrowDown className="w-3 h-3 text-[#D4AF37]" /> : <ArrowUp className="w-3 h-3 text-[#D4AF37]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (sortKey === 'name') {
                    handleSortChange('name', sortOrder === 'asc' ? 'desc' : 'asc');
                  } else {
                    handleSortChange('name', 'asc');
                  }
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 ${
                  sortKey === 'name'
                    ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/50'
                    : 'text-[#888888] hover:text-white border border-transparent'
                }`}
                title={`Sắp xếp theo Tên tài liệu (${sortKey === 'name' && sortOrder === 'asc' ? 'A → Z (Tăng dần)' : 'Z → A (Giảm dần)'})`}
              >
                <span>Tên (A-Z)</span>
                {sortKey === 'name' && (
                  sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D4AF37]" /> : <ArrowDown className="w-3 h-3 text-[#D4AF37]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (sortKey === 'size') {
                    handleSortChange('size', sortOrder === 'desc' ? 'asc' : 'desc');
                  } else {
                    handleSortChange('size', 'desc');
                  }
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 ${
                  sortKey === 'size'
                    ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/50'
                    : 'text-[#888888] hover:text-white border border-transparent'
                }`}
                title={`Sắp xếp theo Dung lượng tệp (${sortKey === 'size' && sortOrder === 'desc' ? 'Lớn → Nhỏ' : 'Nhỏ → Lớn'})`}
              >
                <span>Dung lượng</span>
                {sortKey === 'size' && (
                  sortOrder === 'desc' ? <ArrowDown className="w-3 h-3 text-[#D4AF37]" /> : <ArrowUp className="w-3 h-3 text-[#D4AF37]" />
                )}
              </button>
            </div>
          </div>

          {/* Direct Dropdown for full choice */}
          <div className="relative">
            <select
              value={`${sortKey}-${sortOrder}`}
              onChange={(e) => {
                const [k, o] = e.target.value.split('-') as ['uploadedAt' | 'name' | 'size', 'asc' | 'desc'];
                handleSortChange(k, o);
              }}
              className="bg-[#0C0C0C] text-[#E0E0E0] border border-[#2A2A2A] hover:border-[#D4AF37] focus:border-[#D4AF37] focus:outline-none text-[11px] font-semibold rounded-sm px-2.5 py-1.5 pr-7 appearance-none cursor-pointer transition-colors"
            >
              <option value="uploadedAt-desc">🕒 Tải lên: Mới nhất trước</option>
              <option value="uploadedAt-asc">🕒 Tải lên: Cũ nhất trước</option>
              <option value="name-asc">🔤 Tên tệp: A → Z (Tăng dần)</option>
              <option value="name-desc">🔤 Tên tệp: Z → A (Giảm dần)</option>
              <option value="size-desc">💾 Dung lượng: Lớn → Nhỏ</option>
              <option value="size-asc">💾 Dung lượng: Nhỏ → Lớn</option>
            </select>
            <ChevronDown className="w-3 h-3 text-[#888888] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* View Mode Toggle: Grid (Thẻ) vs List (Danh sách) */}
          <div className="flex items-center bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm p-0.5">
            <button
              type="button"
              onClick={() => handleSetViewMode('grid')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#D4AF37] text-black shadow-xs'
                  : 'text-[#888888] hover:text-white'
              }`}
              title="Chế độ xem dạng Thẻ (Grid View)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Dạng Thẻ</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('list')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#D4AF37] text-black shadow-xs'
                  : 'text-[#888888] hover:text-white'
              }`}
              title="Chế độ xem dạng Danh Sách (List View) - hiển thị tên đầy đủ"
            >
              <List className="w-3.5 h-3.5" />
              <span>Dạng Danh Sách</span>
            </button>
          </div>
        </div>
      </div>

      {/* Files Display Section (Empty State / Card Grid View / List View) */}
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
      ) : viewMode === 'grid' ? (
        /* ============================================================== */
        /* OPTION A: DẠNG THẺ (CARD VIEW) - FULL DOCUMENT TITLE LAYOUT   */
        /* ============================================================== */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFiles.map(file => {
            const linkedTasks = getLinkedTasks(file.id);
            const linkedNotes = getLinkedNotes(file.id);
            const isSynced = file.isSyncedToDrive && file.syncStatus === 'synced' && !!file.webViewLink;
            const resolvedCat = resolveCategory(file.classification, categories);
            const colorCfg = CATEGORY_COLORS[resolvedCat.color] || CATEGORY_COLORS.zinc;

            return (
              <div
                key={file.id}
                className="p-4 rounded-sm bg-[#151515] border border-[#2A2A2A] hover:border-[#D4AF37]/50 transition-all space-y-3 flex flex-col justify-between relative group"
              >
                <div className="space-y-3">
                  {/* Row 1: File Icon & Meta on Left, 5 Utility Actions on Right */}
                  <div className="flex items-center justify-between gap-2 border-b border-[#222222] pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        onClick={() => setPreviewFile(file)}
                        className="p-2 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] shrink-0 text-[#D4AF37] cursor-pointer hover:border-[#D4AF37]/60 transition-colors"
                        title="Bấm để xem trước tệp"
                      >
                        {getFileFormatIcon(file.category)}
                      </div>
                      <div className="text-[10px] text-[#888888] font-mono flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded bg-[#0C0C0C] text-[#AAAAAA] font-bold">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB
                        </span>
                        <span>•</span>
                        <span className="uppercase text-[#888888] font-semibold">{file.category}</span>
                        {file.uploadedAt && (
                          <>
                            <span>•</span>
                            <span className="text-zinc-400" title={`Thời gian tải lên: ${new Date(file.uploadedAt).toLocaleString('vi-VN')}`}>
                              {new Date(file.uploadedAt).toLocaleDateString('vi-VN')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Quick Utility Icon Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEditNote(file)}
                        className={`p-1.5 rounded-sm bg-[#0C0C0C] hover:bg-[#1A1A1A] border transition-colors cursor-pointer ${
                          file.notes || file.description ? 'text-[#D4AF37] border-[#D4AF37]/50 shadow-xs' : 'text-[#888888] hover:text-[#D4AF37] border-[#2A2A2A]'
                        }`}
                        title={file.notes || file.description ? `Chú thích: "${file.notes || file.description}" (Bấm để sửa)` : 'Thêm chú thích cho tài liệu'}
                      >
                        <NotebookPen className="w-3.5 h-3.5" />
                      </button>
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
                        className="p-1.5 rounded-sm bg-[#0C0C0C] hover:bg-[#1A1A1A] text-[#888888] hover:text-white border border-[#2A2A2A] transition-colors cursor-pointer"
                        title="Chỉnh sửa liên kết Google Drive"
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

                  {/* Row 2: Full Width Document Name (Complete, Non-Truncated, Multi-line with Graceful Wrapping) */}
                  <div
                    onClick={() => setPreviewFile(file)}
                    className="cursor-pointer group/title block"
                  >
                    <h3
                      className="text-sm font-editorial-serif font-bold text-white group-hover/title:text-[#D4AF37] transition-colors leading-snug break-words"
                      title={file.name}
                    >
                      {file.name}
                    </h3>
                  </div>

                  {/* Row 3: Classification Badge & Storage Sync Badge */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    {renderCategoryBadgeAndPopover(file, resolvedCat, colorCfg)}

                    {/* Storage Sync Badge */}
                    {isSynced ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono" title="Đã lưu trữ vĩnh viễn trên Google Drive">
                        <CheckCircle2 className="w-3 h-3" /> Drive
                      </span>
                    ) : file.storageType === 'gcs' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400 font-mono" title="Lưu trữ trực tiếp trên Google Cloud Storage (GCS)">
                        <Cloud className="w-3 h-3" /> GCS Cloud
                      </span>
                    ) : file.storageType === 'firestore_vault' || file.hasBinary ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-sky-400 font-mono" title="Lưu trữ an toàn vĩnh viễn trên Cloud Vault">
                        <Cloud className="w-3 h-3" /> Cloud Vault
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-mono" title="Lưu trữ cục bộ">
                        <CloudOff className="w-3 h-3" /> Cục bộ
                      </span>
                    )}
                  </div>

                  {/* Row 4: Document Note / Annotation Section */}
                  {file.notes || file.description ? (
                    <div
                      onClick={() => handleOpenEditNote(file)}
                      className={`p-2.5 rounded-sm bg-[#0E0E0E] border hover:border-[#D4AF37] transition-all cursor-pointer group/notebox shadow-xs ${
                        search.trim() && (
                          (file.notes && file.notes.toLowerCase().includes(search.toLowerCase().trim())) ||
                          (file.description && file.description.toLowerCase().includes(search.toLowerCase().trim()))
                        )
                          ? 'border-[#D4AF37] ring-1 ring-[#D4AF37]/40 bg-[#161408]'
                          : 'border-[#262626]'
                      }`}
                      title="Bấm vào để chỉnh sửa chú thích tài liệu"
                    >
                      <div className="flex items-start gap-1.5 text-xs">
                        <NotebookPen className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-mono uppercase font-bold text-[#D4AF37] tracking-wider">
                              Chú thích
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-900 dark:text-white line-clamp-2 leading-relaxed font-semibold">
                            &ldquo;{file.notes || file.description}&rdquo;
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenEditNote(file)}
                      className="w-full text-left px-2.5 py-1.5 rounded-sm bg-[#0E0E0E] hover:bg-[#181818] border border-dashed border-[#2C2C2C] hover:border-[#D4AF37]/60 text-[11px] text-white hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer group/addnote"
                      title="Thêm chú thích giúp tìm kiếm tài liệu nhanh hơn"
                    >
                      <span className="text-white/95 font-medium group-hover/addnote:text-[#D4AF37]">Thêm chú thích tìm kiếm...</span>
                    </button>
                  )}

                  {/* Linked indicators */}
                  {(linkedTasks.length > 0 || linkedNotes.length > 0) && (
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-[#888888]">
                      {linkedTasks.length > 0 && (
                        <span className="bg-emerald-50 dark:bg-[#0C0C0C] px-1.5 py-0.5 rounded border border-emerald-200 dark:border-[#2A2A2A] text-emerald-700 dark:text-emerald-400">
                          ⚡ {linkedTasks.length} task
                        </span>
                      )}
                      {linkedNotes.length > 0 && (
                        <span className="bg-amber-50 dark:bg-[#0C0C0C] px-1.5 py-0.5 rounded border border-amber-200 dark:border-[#2A2A2A] text-amber-800 dark:text-[#D4AF37]">
                          📝 {linkedNotes.length} note
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Action Buttons */}
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

                    {/* Preview Button */}
                    <button
                      onClick={() => setPreviewFile(file)}
                      className="px-2 py-1 rounded-sm bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 dark:bg-[#0C0C0C] dark:text-[#E0E0E0] dark:border-[#2A2A2A] dark:hover:bg-[#D4AF37] dark:hover:text-black text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                      title="Xem trước nội dung văn bản và phân tích AI"
                    >
                      <Eye className="w-2.5 h-2.5 text-blue-600 dark:text-[#D4AF37]" />
                      <span>Xem Trước</span>
                    </button>

                    {isSynced && file.webViewLink && (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-600 hover:text-white dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/80 dark:hover:bg-emerald-600 dark:hover:text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                        title="Mở tệp trực tiếp trong Google Drive"
                      >
                        <span>Mở Drive</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ============================================================== */
        /* OPTION B: DẠNG DANH SÁCH (LIST VIEW) - HIGH DENSITY TABLE ROW */
        /* ============================================================== */
        <div className="space-y-2">
          {filteredFiles.map(file => {
            const isSynced = file.isSyncedToDrive && file.syncStatus === 'synced' && !!file.webViewLink;
            const resolvedCat = resolveCategory(file.classification, categories);
            const colorCfg = CATEGORY_COLORS[resolvedCat.color] || CATEGORY_COLORS.zinc;

            return (
              <div
                key={file.id}
                className="p-3.5 rounded-sm bg-[#151515] border border-[#2A2A2A] hover:border-[#D4AF37]/60 transition-all space-y-2.5 relative group shadow-xs w-full"
              >
                {/* 1. TOP ROW: File Format Icon + FULL-WIDTH Document Title & Meta Line */}
                <div className="flex items-start gap-3 w-full min-w-0">
                  <div
                    onClick={() => setPreviewFile(file)}
                    className="p-2 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] shrink-0 text-[#D4AF37] cursor-pointer hover:border-[#D4AF37]/50 transition-colors mt-0.5"
                    title="Bấm để xem trước tệp"
                  >
                    {getFileFormatIcon(file.category)}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Full Width Document Name - Takes 100% of container width! */}
                    <div className="w-full">
                      <h3
                        onClick={() => setPreviewFile(file)}
                        className="text-sm font-editorial-serif font-bold text-white hover:text-[#D4AF37] cursor-pointer transition-colors leading-snug break-words"
                        title={file.name}
                      >
                        {file.name}
                      </h3>
                    </div>

                    {/* Metadata line stretching across full width */}
                    <div className="text-[11px] text-[#888888] font-mono flex items-center gap-2 flex-wrap">
                      {/* Storage Sync Badge */}
                      {isSynced ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono shrink-0" title="Đã lưu trữ vĩnh viễn trên Google Drive">
                          <CheckCircle2 className="w-3 h-3" /> Drive
                        </span>
                      ) : file.storageType === 'gcs' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400 font-mono shrink-0" title="Lưu trữ trên GCS">
                          <Cloud className="w-3 h-3" /> GCS
                        </span>
                      ) : file.storageType === 'firestore_vault' || file.hasBinary ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-sky-400 font-mono shrink-0" title="Lưu trữ an toàn trên Cloud Vault">
                          <Cloud className="w-3 h-3" /> Vault
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-mono shrink-0" title="Lưu trữ cục bộ">
                          <CloudOff className="w-3 h-3" /> Cục bộ
                        </span>
                      )}

                      <span>•</span>
                      <span className="text-[#CCCCCC] font-semibold">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                      <span>•</span>
                      <span className="uppercase text-[#888888]">{file.category}</span>
                      {file.uploadedAt && (
                        <>
                          <span>•</span>
                          <span className="text-zinc-400" title={`Thời gian tải lên: ${new Date(file.uploadedAt).toLocaleString('vi-VN')}`}>
                            {new Date(file.uploadedAt).toLocaleString('vi-VN')}
                          </span>
                        </>
                      )}
                      {(file.notes || file.description) && (
                        <>
                          <span>•</span>
                          <span
                            onClick={() => handleOpenEditNote(file)}
                            className="text-[#D4AF37]/90 italic font-sans hover:underline cursor-pointer truncate max-w-md"
                            title={`Chú thích: ${file.notes || file.description}`}
                          >
                            📝 &ldquo;{file.notes || file.description}&rdquo;
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. BOTTOM TOOLBAR ROW: Classification on Left, Actions on Right */}
                <div className="pt-2 border-t border-[#222222] flex flex-wrap items-center justify-between gap-2">
                  {/* Left: Classification Badge & Popover */}
                  <div className="flex items-center gap-2">
                    {renderCategoryBadgeAndPopover(file, resolvedCat, colorCfg)}
                  </div>

                  {/* Right: All Actions */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Ask AI */}
                    <button
                      onClick={() => openAiChatWithPrompt(`Hãy phân tích và tóm tắt nội dung tài liệu "${file.name}" (Nhóm: ${resolvedCat.name}, Định dạng: ${file.category})`)}
                      className="px-2.5 py-1 rounded-sm bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 dark:bg-[#1A1813] dark:text-[#D4AF37] dark:hover:bg-[#252216] dark:border-[#D4AF37]/40 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                      title="Phân tích nội dung tài liệu bằng AI"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Hỏi AI</span>
                    </button>

                    {/* Save to Drive or Open Drive */}
                    {!isSynced ? (
                      <button
                        onClick={() => handleSyncLocalFileToUserDrive(file)}
                        disabled={syncingDriveFileId === file.id}
                        className="px-2.5 py-1 rounded-sm bg-[#1A1A1A] hover:bg-[#D4AF37] text-[#D4AF37] hover:text-black border border-[#D4AF37]/50 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                        title="Đẩy tệp này lên Google Drive cá nhân của bạn"
                      >
                        <Cloud className={`w-3 h-3 ${syncingDriveFileId === file.id ? 'animate-bounce' : ''}`} />
                        <span>{syncingDriveFileId === file.id ? 'Đang lưu...' : 'Lưu lên Drive'}</span>
                      </button>
                    ) : file.webViewLink ? (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-600 hover:text-white dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/80 dark:hover:bg-emerald-600 dark:hover:text-white text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                        title="Mở tệp trực tiếp trong Google Drive"
                      >
                        <span>Mở Drive</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    ) : null}

                    {/* Preview Button */}
                    <button
                      onClick={() => setPreviewFile(file)}
                      className="px-2.5 py-1 rounded-sm bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 dark:bg-[#0C0C0C] dark:text-[#E0E0E0] dark:border-[#2A2A2A] dark:hover:bg-[#D4AF37] dark:hover:text-black text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                      title="Xem trước tài liệu"
                    >
                      <Eye className="w-3 h-3 text-blue-600 dark:text-[#D4AF37]" />
                      <span>Xem Trước</span>
                    </button>

                    {/* Action Icons */}
                    <div className="flex items-center gap-0.5 border-l border-[#2A2A2A] pl-1.5 ml-0.5">
                      <button
                        onClick={() => handleOpenEditNote(file)}
                        className={`p-1.5 rounded-sm bg-[#0C0C0C] hover:bg-[#1A1A1A] border transition-colors cursor-pointer ${
                          file.notes || file.description ? 'text-[#D4AF37] border-[#D4AF37]/50 shadow-xs' : 'text-[#888888] hover:text-[#D4AF37] border-[#2A2A2A]'
                        }`}
                        title={file.notes || file.description ? `Chú thích: "${file.notes || file.description}" (Bấm để sửa)` : 'Thêm chú thích cho tài liệu'}
                      >
                        <NotebookPen className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={file.downloadUrl || `/api/files/download/${file.id}`}
                        download={file.name}
                        className="p-1.5 rounded-sm bg-[#0C0C0C] hover:bg-[#1A1A1A] text-[#888888] hover:text-[#D4AF37] border border-[#2A2A2A] transition-colors cursor-pointer"
                        title="Tải về máy"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => {
                          setEditingUrlFile(file);
                          setInputUrl(file.webViewLink || '');
                        }}
                        className="p-1.5 rounded-sm bg-[#0C0C0C] hover:bg-[#1A1A1A] text-[#888888] hover:text-white border border-[#2A2A2A] transition-colors cursor-pointer"
                        title="Chỉnh sửa liên kết Drive"
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
      {/* 7. COMPREHENSIVE IN-APP DOCUMENT PREVIEW & AI SPECIALIST MODAL */}
      {/* ============================================================== */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#151515] border border-slate-300 dark:border-[#2A2A2A] w-full max-w-4xl max-h-[92vh] flex flex-col rounded-sm shadow-2xl overflow-hidden text-slate-800 dark:text-zinc-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#2A2A2A] p-4 bg-slate-50 dark:bg-[#111111]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded bg-slate-100 dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#2A2A2A] shrink-0 text-amber-600 dark:text-[#D4AF37]">
                  {getFileFormatIcon(previewFile.category)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-editorial-serif font-bold text-slate-900 dark:text-white text-base truncate max-w-md sm:max-w-lg">
                      {previewFile.name}
                    </h3>
                    {previewFile.isSyncedToDrive && previewFile.webViewLink ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 shrink-0">
                        🟢 Google Drive
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 shrink-0">
                        🟡 Local Vault
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-[#888888] block">
                    {previewFile.mimeType} • {(previewFile.size / (1024 * 1024)).toFixed(2)} MB • {resolveCategory(previewFile.classification, categories).name}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-[#888888] dark:hover:text-white transition-colors cursor-pointer rounded hover:bg-slate-200 dark:hover:bg-[#202020]"
                title="Đóng xem trước"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center border-b border-slate-200 dark:border-[#2A2A2A] bg-slate-100/70 dark:bg-[#0E0E0E] px-4 gap-2 text-xs font-bold uppercase tracking-wider overflow-x-auto">
              <button
                type="button"
                onClick={() => setPreviewTab('content')}
                className={`py-3 px-3.5 border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
                  previewTab === 'content'
                    ? 'border-blue-600 text-blue-600 dark:border-[#D4AF37] dark:text-[#D4AF37] bg-white dark:bg-[#151515]'
                    : 'border-transparent text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Xem Nội Dung In-App</span>
                {previewData?.previewType && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-[#262626] font-mono">
                    {previewData.previewType.toUpperCase()}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setPreviewTab('drive')}
                className={`py-3 px-3.5 border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
                  previewTab === 'drive'
                    ? 'border-blue-600 text-blue-600 dark:border-[#D4AF37] dark:text-[#D4AF37] bg-white dark:bg-[#151515]'
                    : 'border-transparent text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Cloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Google Drive Cloud Hub</span>
                {previewFile.isSyncedToDrive && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPreviewTab('ai');
                  if (!aiAnalysis && !isLoadingAiAnalysis) {
                    handleGenerateAiAnalysis(previewFile.id);
                  }
                }}
                className={`py-3 px-3.5 border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
                  previewTab === 'ai'
                    ? 'border-blue-600 text-blue-600 dark:border-[#D4AF37] dark:text-[#D4AF37] bg-white dark:bg-[#151515]'
                    : 'border-transparent text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-500 dark:text-[#D4AF37]" />
                <span>AI Specialist (Tóm Tắt &amp; Phân Tích)</span>
                {aiAnalysis && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-mono">
                    SẴN SÀNG
                  </span>
                )}
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* TAB 1: IN-APP DOCUMENT VIEWER */}
              {previewTab === 'content' && (
                <div className="space-y-3">
                  {/* Action row above document */}
                  <div className="flex items-center justify-between text-xs pb-1">
                    <span className="font-bold text-slate-700 dark:text-[#D4AF37] uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      Trình Hiển Thị Tài Liệu Độc Quyền (Local Vault &amp; Cloud Storage)
                    </span>
                    <div className="flex items-center gap-2">
                      {previewContent && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(previewContent || '');
                            setCopiedText(true);
                            setTimeout(() => setCopiedText(false), 2000);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 dark:bg-[#1A1A1A] dark:hover:bg-[#252525] dark:text-[#CCCCCC] dark:border-[#333333] font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          {copiedText ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Đã sao chép</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Sao chép chữ</span>
                            </>
                          )}
                        </button>
                      )}
                      <a
                        href={previewData?.rawUrl || `/api/files/raw/${previewFile.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 dark:bg-[#1A1A1A] dark:hover:bg-[#252525] dark:text-[#CCCCCC] dark:border-[#333333] font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                        title="Mở toàn màn hình trong tab mới"
                      >
                        <Maximize2 className="w-3 h-3" />
                        <span>Mở Tab Mới</span>
                      </a>
                    </div>
                  </div>

                  {/* Document Container */}
                  <div className="bg-slate-50 dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#2A2A2A] rounded-sm p-4 min-h-[300px] max-h-[520px] overflow-y-auto">
                    {isLoadingPreview ? (
                      <div className="py-20 text-center text-slate-500 dark:text-[#888888] space-y-3">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 dark:text-[#D4AF37]" />
                        <p className="text-xs font-medium">Đang trích xuất và hiển thị nội dung tài liệu...</p>
                      </div>
                    ) : (previewData?.previewType === 'docx' || previewData?.previewType === 'doc') && previewData?.htmlContent ? (
                      /* WORD DOCX & DOC RENDERER (Mammoth & WordExtractor Conversion) */
                      <div className="space-y-3">
                        <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded text-[11px] text-blue-800 dark:text-blue-300 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-600" />
                            <span>
                              Đã chuyển đổi cấu trúc Word ({previewData?.previewType === 'doc' ? 'Microsoft Word .doc' : 'Word .docx'}) sang giao diện tương thích trực tiếp.
                            </span>
                          </div>
                          {previewFile.webViewLink && (
                            <a
                              href={previewFile.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold underline text-[11px] shrink-0 flex items-center gap-1"
                            >
                              <span>Mở Google Docs</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <div
                          className="prose dark:prose-invert max-w-none text-slate-800 dark:text-zinc-100 p-5 bg-white dark:bg-[#121212] rounded border border-slate-200 dark:border-[#222222] shadow-xs leading-relaxed text-sm [&_p]:mb-3 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-slate-900 dark:[&_h1]:text-white [&_h1]:border-b [&_h1]:pb-1 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-slate-900 dark:[&_h2]:text-white [&_table]:border-collapse [&_table]:w-full [&_table]:my-3 [&_td]:border [&_td]:border-slate-300 dark:[&_td]:border-[#333333] [&_td]:p-2 [&_th]:border [&_th]:border-slate-300 dark:[&_th]:border-[#333333] [&_th]:p-2 [&_th]:bg-slate-100 dark:[&_th]:bg-[#1A1A1A] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                          dangerouslySetInnerHTML={{ __html: previewData.htmlContent }}
                        />
                      </div>
                    ) : previewData?.previewType === 'spreadsheet' && previewData?.htmlContent ? (
                      /* SPREADSHEET (EXCEL/CSV) RENDERER */
                      <div className="space-y-3">
                        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                            <span>Bảng tính Excel (.xlsx, .xls, .csv) được hiển thị trực quan dạng bảng HTML.</span>
                          </div>
                          {previewFile.webViewLink && (
                            <a
                              href={previewFile.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-semibold underline text-[11px] shrink-0 flex items-center gap-1"
                            >
                              <span>Mở Google Sheets</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <div
                          className="overflow-x-auto p-4 bg-white dark:bg-[#121212] rounded border border-slate-200 dark:border-[#222222] shadow-xs text-xs [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-slate-300 dark:[&_td]:border-[#333333] [&_td]:p-2 [&_th]:border [&_th]:border-slate-300 dark:[&_th]:border-[#333333] [&_th]:p-2 [&_th]:bg-slate-100 dark:[&_th]:bg-[#1A1A1A] [&_td]:whitespace-nowrap"
                          dangerouslySetInnerHTML={{ __html: previewData.htmlContent }}
                        />
                      </div>
                    ) : previewData?.previewType === 'pdf' ? (
                      /* PDF NATIVE VIEWER (Zero-iframe HTML5 Canvas powered by pdfjs-dist) */
                      <div className="w-full">
                        <PdfCanvasViewer
                          url={previewData?.rawUrl || `/api/files/raw/${previewFile.id}`}
                          fileName={previewFile.name}
                          textContent={previewData?.textContent || previewFile.textContent}
                          onDownload={() => {
                            window.open(previewFile.downloadUrl || `/api/files/download/${previewFile.id}`, '_blank');
                          }}
                        />
                      </div>
                    ) : previewData?.previewType === 'image' ? (
                      /* IMAGE VIEWER */
                      <div className="flex flex-col items-center justify-center p-4 bg-slate-100 dark:bg-[#141414] rounded border border-slate-200 dark:border-[#222222]">
                        <img
                          src={`/api/files/raw/${previewFile.id}`}
                          alt={previewFile.name}
                          className="max-h-[440px] max-w-full object-contain rounded shadow-md"
                        />
                        <p className="mt-3 text-[11px] font-mono text-slate-500 dark:text-[#888888]">
                          {previewFile.name} (Định dạng ảnh gốc)
                        </p>
                      </div>
                    ) : previewContent ? (
                      /* TEXT / CODE / SPREADSHEET VIEWER */
                      <pre className="font-mono text-xs text-slate-800 dark:text-[#D0D0D0] whitespace-pre-wrap leading-relaxed bg-white dark:bg-[#111111] p-4 rounded border border-slate-200 dark:border-[#222222] shadow-xs">
                        {previewContent}
                      </pre>
                    ) : (
                      /* EMPTY / BINARY FALLBACK WITH ACTION BUTTONS */
                      <div className="py-10 text-center text-slate-500 dark:text-[#888888] space-y-4">
                        <FileCheck className="w-12 h-12 mx-auto text-amber-500 dark:text-[#D4AF37]/70" />
                        <div className="space-y-1">
                          <p className="text-sm text-slate-800 dark:text-white font-bold">{previewFile.name}</p>
                          <p className="text-xs text-slate-500 dark:text-[#777777] max-w-md mx-auto leading-relaxed">
                            Tệp đã được lưu trữ an toàn trong Multi-Tier Storage (Disk &amp; Cloud Vault). Bạn có thể xem trực tuyến trên Google Drive hoặc tải về máy.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                          {previewFile.webViewLink && (
                            <a
                              href={previewFile.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Mở trên Google Drive / Docs ↗</span>
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setPreviewTab('drive')}
                            className="px-3 py-1.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-[#1E1E1E] dark:hover:bg-[#2A2A2A] dark:text-[#CCCCCC] font-medium text-xs flex items-center gap-1.5 transition-colors"
                          >
                            <Cloud className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Xem Cloud Hub</span>
                          </button>
                          <a
                            href={previewFile.downloadUrl || `/api/files/download/${previewFile.id}`}
                            download={previewFile.name}
                            className="px-3 py-1.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-[#1E1E1E] dark:hover:bg-[#2A2A2A] dark:text-[#CCCCCC] font-medium text-xs flex items-center gap-1.5 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Tải Về Máy</span>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: GOOGLE DRIVE CLOUD HUB */}
              {previewTab === 'drive' && (
                <div className="space-y-4">
                  {previewFile.isSyncedToDrive && (previewFile.driveFileId || previewFile.webViewLink) ? (
                    <div className="space-y-4">
                      {/* Cloud Sync Status Header */}
                      <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/60 rounded flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-300 font-bold text-sm">
                            <Cloud className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            <span>Tài Liệu Đã Lưu Trữ An Toàn Trên Google Drive Cloud</span>
                          </div>
                          <p className="text-xs text-emerald-700 dark:text-emerald-400/90">
                            Thư mục đích: <strong className="font-semibold">AI Assistant Documents</strong> • Hệ thống lưu trữ đồng bộ đám mây
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded bg-emerald-600 text-white dark:bg-emerald-700 text-[11px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1.5 shadow-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Đã Đồng Bộ</span>
                        </span>
                      </div>

                      {/* Zero-iframe Sandbox Architecture Notice */}
                      <div className="p-3.5 bg-blue-50 dark:bg-[#161B22] border border-blue-200 dark:border-blue-900/50 rounded text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
                        <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-bold text-slate-900 dark:text-white">
                            Chế Độ Trực Tiếp (Bảo Vệ Khỏi Lỗi Chặn Iframe Của Trình Duyệt):
                          </p>
                          <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                            Để bảo mật danh tính người dùng và ngăn chặn tấn công giả mạo, Google Drive từ chối hiển thị trong khung iframe lồng nhau. Hãy mở tài liệu trực tiếp trên tab riêng của Google Drive để trải nghiệm toàn bộ công cụ: đọc phân trang, bình luận, in ấn và chia sẻ quyền truy cập.
                          </p>
                        </div>
                      </div>

                      {/* Executive Action Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Primary Action Card */}
                        <a
                          href={previewFile.webViewLink || (previewFile.driveFileId ? `https://drive.google.com/file/d/${previewFile.driveFileId}/view` : '#')}
                          target="_blank"
                          rel="noreferrer"
                          className="p-5 rounded border border-emerald-500/50 hover:border-emerald-500 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 dark:from-emerald-950/40 dark:to-teal-950/20 hover:shadow-lg transition-all flex flex-col justify-between group cursor-pointer"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                                <ExternalLink className="w-5 h-5" />
                              </span>
                              <span className="text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                                Tab Riêng Biệt
                              </span>
                            </div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                              Mở Trực Tiếp Trên Google Drive
                            </h4>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                              Đầy đủ tính năng: Đọc mượt mà, phân trang, phóng to thu nhỏ, in ấn, thêm nhận xét (comments) và kết nối Google Workspace.
                            </p>
                          </div>
                          <div className="mt-4 pt-3 border-t border-emerald-200 dark:border-emerald-800/40 flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 group-hover:translate-x-1 transition-transform">
                            <span>Truy cập Google Drive</span>
                            <ArrowUpRight className="w-4 h-4" />
                          </div>
                        </a>

                        {/* Secondary Action Card */}
                        <div className="p-5 rounded border border-slate-300 dark:border-[#2E2E2E] bg-white dark:bg-[#121212] flex flex-col justify-between shadow-xs">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="w-9 h-9 rounded-full bg-blue-600 dark:bg-[#D4AF37] text-white dark:text-black flex items-center justify-center shadow-md">
                                <Download className="w-5 h-5" />
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                Bản Gốc
                              </span>
                            </div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                              Tải Bản Gốc Về Thiết Bị
                            </h4>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                              Tải tệp nhị phân gốc đã lưu trữ trong kho lưu trữ dữ liệu về máy tính của bạn để sử dụng offline.
                            </p>
                          </div>
                          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                            <a
                              href={previewFile.downloadUrl || `/api/files/download/${previewFile.id}`}
                              download={previewFile.name}
                              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white dark:bg-[#D4AF37] dark:hover:bg-[#c29f2e] dark:text-black font-bold text-xs rounded transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs text-center"
                            >
                              <Download className="w-4 h-4" />
                              <span>Tải Xuống Thiết Bị</span>
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Google Drive Identification Details */}
                      <div className="p-4 bg-slate-50 dark:bg-[#0E0E0E] border border-slate-200 dark:border-[#222222] rounded space-y-2.5 text-xs">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-[#222222]">
                          <span className="font-bold text-slate-800 dark:text-[#E0E0E0] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                            <HardDrive className="w-3.5 h-3.5 text-blue-500 dark:text-[#D4AF37]" />
                            <span>Thông Tin Định Danh Đám Mây (Google Drive Cloud Metadata)</span>
                          </span>
                          {previewFile.webViewLink && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(previewFile.webViewLink || '');
                                setCopiedText(true);
                                setTimeout(() => setCopiedText(false), 2000);
                              }}
                              className="text-[10px] text-blue-600 dark:text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                            >
                              <Copy className="w-3 h-3" />
                              <span>{copiedText ? 'Đã chép link' : 'Sao chép liên kết'}</span>
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 pt-1 font-mono text-[11px]">
                          <div>
                            <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-sans">Mã Định Danh (Drive File ID):</span>
                            <span className="text-slate-900 dark:text-slate-200 select-all font-semibold break-all">
                              {previewFile.driveFileId || 'Chưa định danh'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-sans">Thư Mục Đích:</span>
                            <span className="text-slate-900 dark:text-slate-200 font-semibold font-sans">
                              AI Assistant Documents
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-sans">Loại MIME Đám Mây:</span>
                            <span className="text-slate-900 dark:text-slate-200 break-all">
                              {previewFile.mimeType || 'application/octet-stream'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-sans">Liên Kết Drive:</span>
                            {previewFile.webViewLink ? (
                              <a
                                href={previewFile.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 dark:text-blue-400 underline truncate block hover:text-blue-700 font-sans"
                              >
                                {previewFile.webViewLink}
                              </a>
                            ) : (
                              <span className="text-slate-400 italic font-sans">Không khả dụng</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-50 dark:bg-[#0E0E0E] rounded border border-dashed border-amber-300 dark:border-amber-700/60 space-y-3">
                      <CloudOff className="w-10 h-10 mx-auto text-amber-500" />
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                        Tài liệu hiện đang lưu trữ cục bộ (Local Vault)
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-[#A0A0A0] max-w-md mx-auto leading-relaxed">
                        Để lưu trữ an toàn trên Google Drive và kích hoạt chia sẻ trực tiếp trên toàn hệ sinh thái Google, hãy đồng bộ tệp này lên Google Drive cá nhân của bạn.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleSyncLocalFileToUserDrive(previewFile)}
                        disabled={syncingDriveFileId === previewFile.id}
                        className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white dark:bg-[#D4AF37] dark:hover:bg-[#c29f2e] dark:text-black font-bold text-xs uppercase tracking-wider rounded cursor-pointer shadow-md inline-flex items-center gap-2"
                      >
                        <Cloud className={`w-4 h-4 ${syncingDriveFileId === previewFile.id ? 'animate-bounce' : ''}`} />
                        <span>{syncingDriveFileId === previewFile.id ? 'Đang lưu lên Drive...' : 'Đẩy Lên Google Drive Ngay'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: AI SPECIALIST & DOCUMENT INTELLIGENCE */}
              {previewTab === 'ai' && (
                <div className="space-y-4">
                  {/* AI Header & Trigger */}
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-[#1A1813] dark:to-[#121212] border border-blue-200 dark:border-[#D4AF37]/40 rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-blue-900 dark:text-[#D4AF37] font-bold text-sm">
                        <Bot className="w-4 h-4" />
                        <span>AI Document Intelligence (Trợ Lý Phân Tích &amp; Tóm Tắt)</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-[#A0A0A0]">
                        Trích xuất bản tóm tắt điều hành, nhiệm vụ hành động và khuyến nghị quản trị từ nội dung tài liệu.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleGenerateAiAnalysis(previewFile.id)}
                      disabled={isLoadingAiAnalysis}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white dark:bg-[#D4AF37] dark:hover:bg-[#c29f2e] dark:text-black font-bold text-xs uppercase tracking-wider rounded cursor-pointer shadow flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isLoadingAiAnalysis ? 'animate-spin' : ''}`} />
                      <span>{isLoadingAiAnalysis ? 'AI Đang Phân Tích...' : (aiAnalysis ? 'Phân Tích Lại' : 'Khởi Chạy Phân Tích AI')}</span>
                    </button>
                  </div>

                  {/* AI Results */}
                  {isLoadingAiAnalysis ? (
                    <div className="py-16 text-center text-slate-500 dark:text-[#888888] space-y-3 bg-slate-50 dark:bg-[#0C0C0C] rounded border border-slate-200 dark:border-[#222222]">
                      <RefreshCw className="w-7 h-7 animate-spin mx-auto text-blue-600 dark:text-[#D4AF37]" />
                      <p className="text-xs font-bold text-slate-800 dark:text-white">Gemini đang nghiên cứu văn bản...</p>
                      <p className="text-[11px] text-slate-500 dark:text-[#777777]">Trích xuất ý chính, nhiệm vụ hành động và thẻ từ khóa</p>
                    </div>
                  ) : aiAnalysis ? (
                    <div className="space-y-3 animate-in fade-in">
                      {/* Executive Summary */}
                      <div className="p-3.5 bg-slate-50 dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#2A2A2A] rounded-sm space-y-1.5">
                        <span className="text-[10px] font-bold text-blue-700 dark:text-[#D4AF37] uppercase tracking-wider flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5" />
                          Tóm Tắt Điều Hành (Executive Summary)
                        </span>
                        <p className="text-xs text-slate-800 dark:text-white leading-relaxed font-medium">
                          {aiAnalysis.summary}
                        </p>
                      </div>

                      {/* Key Points & Action Items Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Key Points */}
                        <div className="p-3.5 bg-slate-50 dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#2A2A2A] rounded-sm space-y-2">
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Ý Trọng Tâm / Điểm Then Chốt
                          </span>
                          <ul className="space-y-1.5 text-xs text-slate-700 dark:text-[#CCCCCC]">
                            {aiAnalysis.keyPoints.map((pt, idx) => (
                              <li key={idx} className="flex items-start gap-1.5">
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">•</span>
                                <span>{pt}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Action Items */}
                        <div className="p-3.5 bg-slate-50 dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#2A2A2A] rounded-sm space-y-2">
                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            Nhiệm Vụ &amp; Hành Động Cần Làm
                          </span>
                          <ul className="space-y-1.5 text-xs text-slate-700 dark:text-[#CCCCCC]">
                            {aiAnalysis.actionItems.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-1.5">
                                <span className="text-amber-600 dark:text-amber-400 font-bold shrink-0">→</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* AI Recommendations */}
                      {aiAnalysis.recommendations && (
                        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 rounded-sm space-y-1">
                          <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Lightbulb className="w-3.5 h-3.5" />
                            Khuyến Nghị Của Chuyên Gia AI
                          </span>
                          <p className="text-xs text-slate-800 dark:text-[#D0D0D0] leading-relaxed">
                            {aiAnalysis.recommendations}
                          </p>
                        </div>
                      )}

                      {/* Suggested Tags & Apply Button */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#2A2A2A] rounded-sm">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-[#888888]">Thẻ gợi ý:</span>
                          {aiAnalysis.suggestedTags.map((tag, idx) => (
                            <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-[#1A1A1A] border border-slate-300 dark:border-[#333333] text-blue-600 dark:text-[#D4AF37]">
                              #{tag}
                            </span>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={handleApplyAiSummaryToNote}
                          disabled={isApplyingAiNotes}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded cursor-pointer shadow-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isApplyingAiNotes ? 'Đang lưu...' : 'Lưu Tóm Tắt Này Vào Chú Thích'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-500 dark:text-[#888888] space-y-2">
                      <Sparkles className="w-8 h-8 mx-auto text-amber-500/70" />
                      <p className="text-xs text-slate-700 dark:text-[#CCCCCC]">
                        Nhấn nút <strong>"Khởi Chạy Phân Tích AI"</strong> ở trên để AI quét toàn bộ nội dung và đưa ra tóm tắt chuyên sâu.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* CLASSIFICATION & METADATA ACCORDION */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-[#0C0C0C] p-3 rounded-sm border border-slate-200 dark:border-[#2A2A2A]">
                <div>
                  <label className="text-[10px] text-blue-600 dark:text-[#D4AF37] font-bold uppercase tracking-wider block mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      Phân Loại Mục Đích:
                    </span>
                    {getFileSelectedCategories(previewFile).length > 1 && (
                      <span className="text-[9px] font-mono text-blue-600 dark:text-[#D4AF37]">
                        {getFileSelectedCategories(previewFile).length} tag được chọn
                      </span>
                    )}
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
                    className="w-full p-2 bg-white dark:bg-[#151515] border border-slate-300 dark:border-[#2A2A2A] rounded-sm text-slate-800 dark:text-[#E0E0E0] text-xs focus:outline-none focus:border-blue-500 dark:focus:border-[#D4AF37]"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.description ? `(${c.description.slice(0, 30)}...)` : ''}
                      </option>
                    ))}
                    <option value="__add_new__">+ Tạo hoặc tùy biến nhóm phân loại...</option>
                  </select>

                  {/* Active Tags list chips with remove button */}
                  {(() => {
                    const assignedCats = getFileSelectedCategories(previewFile);
                    if (assignedCats.length > 0) {
                      return (
                        <div className="flex items-center gap-1.5 flex-wrap mt-2">
                          <span className="text-[9px] font-mono uppercase text-slate-400 dark:text-[#666666]">Các tag:</span>
                          {assignedCats.map(ac => (
                            <span
                              key={ac.id}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#333333] text-slate-700 dark:text-[#CCCCCC]"
                            >
                              <span>{ac.name}</span>
                              <button
                                type="button"
                                onClick={() => handleToggleFileCategory(previewFile.id, ac.id)}
                                className="text-slate-400 hover:text-rose-500 cursor-pointer ml-0.5 font-bold"
                                title={`Gỡ tag "${ac.name}"`}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[9px] text-slate-500 dark:text-[#666666] font-mono uppercase block">Định dạng file:</span>
                    <span className="font-bold text-slate-800 dark:text-[#E0E0E0] uppercase">{previewFile.category}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 dark:text-[#666666] font-mono uppercase block">Trạng thái lưu:</span>
                    {previewFile.isSyncedToDrive && previewFile.webViewLink ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">🟢 Google Drive</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-bold">🟡 Local Vault</span>
                    )}
                  </div>
                </div>
              </div>

              {/* NOTE & ANNOTATION BOX */}
              <div className="bg-slate-50 dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#2A2A2A] rounded-sm p-3.5 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#222222] pb-1.5">
                  <span className="text-[10px] font-bold text-blue-600 dark:text-[#D4AF37] uppercase tracking-wider flex items-center gap-1.5">
                    <NotebookPen className="w-3.5 h-3.5" />
                    Chú Thích &amp; Ghi Nhớ Tài Liệu (Hỗ trợ tìm kiếm thông minh)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenEditNote(previewFile)}
                    className="text-[11px] text-blue-600 dark:text-[#D4AF37] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    title="Chỉnh sửa chú thích tài liệu"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{previewFile.notes || previewFile.description ? 'Sửa chú thích' : '+ Thêm chú thích'}</span>
                  </button>
                </div>
                {previewFile.notes || previewFile.description ? (
                  <p className="text-xs text-slate-800 dark:text-white leading-relaxed bg-white dark:bg-[#141414] p-2.5 rounded border border-slate-200 dark:border-[#262626] font-medium whitespace-pre-wrap">
                    &ldquo;{previewFile.notes || previewFile.description}&rdquo;
                  </p>
                ) : (
                  <div className="flex items-center justify-between bg-white dark:bg-[#141414] p-2.5 rounded border border-dashed border-slate-300 dark:border-[#262626]">
                    <span className="text-xs text-slate-500 dark:text-[#E0E0E0]">Chưa có chú thích nào cho tài liệu này.</span>
                    <button
                      type="button"
                      onClick={() => handleOpenEditNote(previewFile)}
                      className="px-2.5 py-1 bg-slate-900 dark:bg-[#222222] hover:bg-blue-600 dark:hover:bg-[#D4AF37] text-white dark:hover:text-black font-bold text-[10px] uppercase tracking-wider rounded transition-colors cursor-pointer"
                    >
                      + Thêm chú thích ngay
                    </button>
                  </div>
                )}
                {(() => {
                  const resolvedPreviewCat = resolveCategory(previewFile.classification, categories);
                  const validTags = (previewFile.tags || []).filter(t => {
                    const clean = t.toLowerCase().trim();
                    return clean && clean !== 'unclassified' && clean !== 'chưa xác định' && clean !== 'chưa phân loại' && clean !== resolvedPreviewCat.name.toLowerCase() && clean !== resolvedPreviewCat.id.toLowerCase();
                  });

                  if (validTags.length === 0) return null;

                  return (
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <span className="text-[10px] text-slate-500 dark:text-[#666666] font-mono uppercase">Thẻ tags:</span>
                      {validTags.map((tag, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#2A2A2A] text-slate-700 dark:text-[#CCCCCC] font-mono">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* LINKED TASKS & NOTES */}
              {(getLinkedTasks(previewFile.id).length > 0 || getLinkedNotes(previewFile.id).length > 0) && (
                <div className="space-y-2 border-t border-slate-200 dark:border-[#2A2A2A] pt-3">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-[#888888] uppercase tracking-wider">Liên kết trong hệ thống:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {getLinkedTasks(previewFile.id).map(t => (
                      <div key={t.id} className="p-2 rounded bg-slate-50 dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#2A2A2A] flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="truncate text-slate-800 dark:text-white font-medium">{t.title}</span>
                      </div>
                    ))}
                    {getLinkedNotes(previewFile.id).map(n => (
                      <div key={n.id} className="p-2 rounded bg-slate-50 dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#2A2A2A] flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-amber-500 dark:text-[#D4AF37] shrink-0" />
                        <span className="truncate text-slate-800 dark:text-white font-medium">{n.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-[#2A2A2A] p-4 bg-slate-50 dark:bg-[#111111]">
              <button
                type="button"
                onClick={() => {
                  const fname = previewFile.name;
                  const catName = resolveCategory(previewFile.classification, categories).name;
                  setPreviewFile(null);
                  openAiChatWithPrompt(`Hãy phân tích và tóm tắt chuyên sâu nội dung tài liệu "${fname}" (Nhóm: ${catName}, Định dạng: ${previewFile.category}). Đưa ra các điểm chính và đề xuất hành động tiếp theo.`);
                }}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-[#D4AF37]/10 dark:hover:bg-[#D4AF37]/20 dark:text-[#D4AF37] dark:border-[#D4AF37]/40 rounded-sm font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Mở Khung Chat AI Về File</span>
              </button>

              <div className="flex items-center gap-2">
                <a
                  href={previewFile.downloadUrl || `/api/files/download/${previewFile.id}`}
                  download={previewFile.name}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 dark:bg-[#0C0C0C] dark:hover:bg-[#1A1A1A] dark:text-white dark:border-[#2A2A2A] rounded-sm text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải Về Máy</span>
                </a>
                {previewFile.isSyncedToDrive && previewFile.webViewLink && (
                  <a
                    href={previewFile.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-colors"
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

      {/* ============================================================== */}
      {/* 9. DOCUMENT NOTE / ANNOTATION EDITOR MODAL */}
      {/* ============================================================== */}
      {editingNoteFile && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-in fade-in duration-150">
          <div className="bg-[#151515] border border-[#2A2A2A] w-full max-w-lg rounded-sm shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#2A2A2A] p-4 bg-[#111111]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded bg-[#0C0C0C] border border-[#D4AF37]/40 text-[#D4AF37] shrink-0">
                  <NotebookPen className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-editorial-serif font-bold text-white text-sm truncate">
                    Chú Thích & Thẻ Tìm Kiếm Tài Liệu
                  </h3>
                  <p className="text-[10px] text-[#888888] truncate font-mono">
                    {editingNoteFile.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingNoteFile(null)}
                className="p-1 text-[#888888] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Document Summary Info */}
              <div className="flex items-center justify-between p-2.5 rounded bg-[#0C0C0C] border border-[#252525] text-[11px]">
                <div className="flex items-center gap-1.5 text-[#AAAAAA]">
                  <span>Nhóm:</span>
                  <strong className="text-white">{resolveCategory(editingNoteFile.classification, categories).name}</strong>
                </div>
                <div className="flex items-center gap-1.5 text-[#888888] font-mono text-[10px]">
                  <span>{(editingNoteFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                  <span>•</span>
                  <span>{editingNoteFile.category.toUpperCase()}</span>
                </div>
              </div>

              {/* Note Textarea & AI Suggestion Button */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-[#D4AF37] uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquareQuote className="w-3.5 h-3.5" />
                    Nội dung chú thích / Mô tả tài liệu:
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateAiNote}
                    disabled={isGeneratingAiNote}
                    className="px-2 py-0.5 rounded bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#D4AF37] border border-[#D4AF37]/40 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                    title="Dùng AI tự động viết chú thích súc tích theo nội dung tệp"
                  >
                    <Sparkles className={`w-3 h-3 ${isGeneratingAiNote ? 'animate-spin' : ''}`} />
                    <span>{isGeneratingAiNote ? 'Đang tạo...' : '✨ AI Gợi Ý Chú Thích'}</span>
                  </button>
                </div>
                <textarea
                  value={noteInputText}
                  onChange={(e) => setNoteInputText(e.target.value)}
                  placeholder="Ví dụ: Giấy chứng nhận tốt nghiệp nộp phòng Đào tạo, Hợp đồng thuê nhà 2026, Bản sao công chứng hồ sơ..."
                  rows={4}
                  className="w-full p-3 bg-[#0C0C0C] border border-[#333333] focus:border-[#D4AF37] focus:outline-none rounded text-xs text-[#E0E0E0] placeholder:text-[#666666] leading-relaxed resize-none"
                  autoFocus
                />
                <div className="flex items-center justify-between text-[10px] text-[#777777]">
                  <span>💡 Giúp tìm kiếm file dễ dàng qua từ khóa hoặc hỏi AI mà không bị phụ thuộc vào tên tệp</span>
                  <span>{noteInputText.length} ký tự</span>
                </div>
              </div>

              {/* Custom Tags Section */}
              <div className="space-y-2 pt-1 border-t border-[#222222]">
                <label className="text-[11px] font-bold text-[#AAAAAA] uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-[#D4AF37]" />
                  Thẻ từ khóa bổ sung (Tags, cách nhau bởi dấu phẩy):
                </label>
                <input
                  type="text"
                  value={noteInputTags}
                  onChange={(e) => setNoteInputTags(e.target.value)}
                  placeholder="Ví dụ: hợp đồng, tài chính, năm 2026, quan trọng..."
                  className="w-full p-2.5 bg-[#0C0C0C] border border-[#333333] focus:border-[#D4AF37] focus:outline-none rounded text-xs text-[#E0E0E0] placeholder:text-[#666666]"
                />

                {/* Quick Tag Recommendations */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-[#666666]">Gợi ý thẻ nhanh:</span>
                  {['Hợp đồng', 'Báo cáo', 'Hóa đơn', 'Bảo hiểm', 'Cá nhân', 'Công việc', 'Chứng chỉ', 'Quan trọng'].map((t) => {
                    const currentList = noteInputTags.split(',').map(s => s.trim().toLowerCase());
                    const isAdded = currentList.includes(t.toLowerCase());
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          if (isAdded) {
                            const filtered = noteInputTags
                              .split(',')
                              .map(s => s.trim())
                              .filter(s => s.toLowerCase() !== t.toLowerCase());
                            setNoteInputTags(filtered.join(', '));
                          } else {
                            const current = noteInputTags.trim();
                            setNoteInputTags(current ? `${current}, ${t}` : t);
                          }
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                          isAdded
                            ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37] font-bold'
                            : 'bg-[#0C0C0C] border-[#2A2A2A] text-[#888888] hover:text-white hover:border-[#444444]'
                        }`}
                      >
                        {isAdded ? `✓ #${t}` : `+ #${t}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 p-4 border-t border-[#2A2A2A] bg-[#111111]">
              <button
                type="button"
                onClick={() => setEditingNoteFile(null)}
                className="px-4 py-2 bg-[#0C0C0C] hover:bg-[#1A1A1A] text-white border border-[#2A2A2A] text-xs font-bold rounded cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={isSavingNote}
                className="px-5 py-2 bg-[#D4AF37] hover:bg-[#c29f2e] text-black text-xs font-bold uppercase tracking-wider rounded cursor-pointer shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{isSavingNote ? 'Đang lưu...' : 'Lưu Chú Thích'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ============================================================== */}
      {/* 3B. SYNC TO DRIVE & PURGE LOCAL COPIES CONFIRMATION MODAL */}
      {/* ============================================================== */}
      {isSyncPurgeModalOpen && (() => {
        const isGoogleAuthActive = !!googleUser && !!getGoogleAccessToken();
        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-[#151515] border border-slate-300 dark:border-[#D4AF37]/60 w-full max-w-lg rounded-sm shadow-2xl overflow-hidden flex flex-col text-slate-800 dark:text-zinc-100">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#2A2A2A] p-4 bg-slate-50 dark:bg-gradient-to-r dark:from-[#1C160B] dark:to-[#121212]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-[#D4AF37]/60 text-amber-700 dark:text-[#D4AF37] shrink-0">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-editorial-serif font-bold text-slate-900 dark:text-white text-base truncate">
                      Đồng Bộ Lên Drive &amp; Xóa Tệp Local
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-[#A0A0A0] truncate font-mono">
                      Giải phóng bộ nhớ lưu trữ cục bộ sang Google Drive
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !isSyncingAndPurging && setIsSyncPurgeModalOpen(false)}
                  disabled={isSyncingAndPurging}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:text-[#888888] dark:hover:text-white transition-colors cursor-pointer disabled:opacity-30"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4 text-xs">
                {/* 1. Google Authentication Status Indicator */}
                {isGoogleAuthActive ? (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-600/60 rounded-sm flex items-center justify-between gap-3 text-emerald-900 dark:text-emerald-200">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold truncate">
                          Tài khoản Google: <span className="font-mono text-slate-900 dark:text-white">{googleUser?.email || googleUser?.name}</span>
                        </p>
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                          ✅ Đã xác thực phiên làm việc. Tệp sẽ được tải trực tiếp lên Google Drive của bạn.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleGoogleSignOutClick}
                      className="text-[10px] text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-white underline font-mono shrink-0 cursor-pointer"
                    >
                      Đổi tài khoản
                    </button>
                  </div>
                ) : (
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-500 rounded-sm space-y-2 text-rose-950 dark:text-rose-100 shadow-sm">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs uppercase tracking-wide text-rose-800 dark:text-rose-200">
                          Bắt buộc đăng nhập Google Drive (Chặn đồng bộ ảo)
                        </h4>
                        <p className="text-[11px] leading-relaxed text-rose-700 dark:text-rose-200/90 mt-0.5">
                          Hệ thống <strong>không cho phép đồng bộ hoặc xóa tệp local</strong> khi chưa xác thực tài khoản Google. Hãy đăng nhập tài khoản Google của bạn để tải tệp thật sự lên Drive.
                        </p>
                      </div>
                    </div>
                    <div className="pt-2 flex items-center justify-between gap-2 border-t border-rose-200 dark:border-rose-900/50">
                      <span className="text-[10px] font-mono text-rose-700 dark:text-rose-300">
                        Yêu cầu quyền truy cập Google Drive
                      </span>
                      <button
                        type="button"
                        onClick={handleGoogleSignInClick}
                        disabled={isLoggingInGoogle}
                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-sm cursor-pointer shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                          <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        <span>{isLoggingInGoogle ? 'Đang kết nối...' : 'Đăng Nhập Google Ngay'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Notice Banner */}
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 rounded-sm text-xs space-y-1">
                  <div className="font-bold flex items-center gap-2 text-amber-800 dark:text-amber-300">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Phát hiện <strong>{localFiles.length} tệp</strong> đang lưu trữ cục bộ chưa có trên Drive:</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-[#D0D0D0] leading-relaxed">
                    Thư mục đích: <strong className="text-slate-900 dark:text-white font-mono">{saConfig?.folderName || 'AI Assistant Documents'}</strong>. Hệ thống sẽ tải các tệp lên Google Drive thật sự, cập nhật liên kết trực tiếp và xóa bản gốc cục bộ để tiết kiệm dung lượng.
                  </p>
                </div>

                {/* Scrollable File List */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-600 dark:text-[#888888] uppercase tracking-wider flex items-center justify-between">
                    <span>Danh sách tệp chuẩn bị đồng bộ:</span>
                    <span className="font-mono text-amber-600 dark:text-[#D4AF37] font-bold">{localFiles.length} tệp</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1 border border-slate-200 dark:border-[#222222] rounded-sm bg-slate-50 dark:bg-[#0C0C0C] p-2">
                    {localFiles.map(f => (
                      <div key={f.id} className="p-2 rounded bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#222222] flex items-center justify-between gap-2 shadow-2xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="p-1 rounded bg-slate-100 dark:bg-[#1E1E1E] border border-slate-200 dark:border-[#2F2F2F] text-amber-600 dark:text-[#D4AF37] shrink-0">
                            {getFileFormatIcon(f.category)}
                          </span>
                          <div className="min-w-0">
                            <p className="text-slate-900 dark:text-white text-xs font-medium truncate">{f.name}</p>
                            <p className="text-[10px] text-slate-500 dark:text-[#888888] font-mono">
                              {(f.size / 1024).toFixed(1)} KB • {resolveCategory(f.classification, categories).name}
                            </p>
                          </div>
                        </div>
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:border-amber-700/50 dark:text-amber-300 text-[10px] font-mono shrink-0">
                          Chưa có Drive
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Checkbox Options */}
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-[#262626]">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={purgeLocalCopyAfterUpload}
                      onChange={e => setPurgeLocalCopyAfterUpload(e.target.checked)}
                      disabled={isSyncingAndPurging}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-[#444444] bg-white dark:bg-[#1A1A1A] text-amber-600 dark:text-[#D4AF37] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-amber-600 dark:accent-[#D4AF37]"
                    />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white text-xs">
                        Xóa tệp gốc lưu trên local sau khi tải lên thành công (Khuyên dùng)
                      </span>
                      <p className="text-[11px] text-slate-600 dark:text-[#888888] leading-relaxed">
                        Giải phóng 100% dung lượng ổ đĩa và database cục bộ. Tài liệu vẫn hiển thị trong ứng dụng và xem trực tiếp từ Google Drive.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={deleteLocalRecordAfterUpload}
                      onChange={e => setDeleteLocalRecordAfterUpload(e.target.checked)}
                      disabled={isSyncingAndPurging}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-[#444444] bg-white dark:bg-[#1A1A1A] text-amber-600 dark:text-[#D4AF37] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-amber-600 dark:accent-[#D4AF37]"
                    />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white text-xs">
                        Xóa luôn danh sách tệp khỏi ứng dụng (Chỉ lưu trên Google Drive)
                      </span>
                      <p className="text-[11px] text-slate-600 dark:text-[#888888] leading-relaxed">
                        Nếu chọn tùy chọn này, các tệp sau khi tải lên sẽ được ẩn khỏi màn hình hiện tại và chỉ xuất hiện khi bạn nhấn &quot;Nạp Tệp Từ Drive&quot;.
                      </p>
                    </div>
                  </label>
                </div>

                {/* In-Modal Progress */}
                {isSyncingAndPurging && driveSyncProgress && (
                  <div className="p-3 bg-slate-100 dark:bg-[#0C0C0C] border border-amber-300 dark:border-[#D4AF37]/40 rounded-sm space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-700 dark:text-[#D4AF37] font-bold flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>{driveSyncProgress.statusText}</span>
                      </span>
                      <span className="text-slate-900 dark:text-white font-mono font-bold">{driveSyncProgress.percent}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-[#222222] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-[#D4AF37] h-full transition-all duration-300"
                        style={{ width: `${driveSyncProgress.percent}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                      ⚡ Tự động giải phóng lưu trữ cục bộ sau khi lưu Google Drive thành công.
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 dark:border-[#2A2A2A] bg-slate-50 dark:bg-[#0E0E0E]">
                <button
                  type="button"
                  onClick={() => setIsSyncPurgeModalOpen(false)}
                  disabled={isSyncingAndPurging}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 dark:bg-[#1A1A1A] dark:hover:bg-[#252525] dark:text-[#AAAAAA] dark:hover:text-white dark:border-[#333333] text-xs font-bold rounded-sm cursor-pointer transition-colors disabled:opacity-50"
                >
                  Hủy Bỏ
                </button>
                {isGoogleAuthActive ? (
                  <button
                    type="button"
                    onClick={handleExecuteSyncAndPurgeLocal}
                    disabled={isSyncingAndPurging}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white dark:bg-[#D4AF37] dark:hover:bg-[#c29f2e] dark:text-black text-xs font-bold uppercase tracking-wider rounded-sm cursor-pointer shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isSyncingAndPurging ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang Đồng Bộ &amp; Xóa Local...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4 stroke-[2.5]" />
                        <span>Bắt Đầu Đồng Bộ &amp; Xóa Local</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleGoogleSignInClick}
                    disabled={isLoggingInGoogle}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider rounded-sm cursor-pointer shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>{isLoggingInGoogle ? 'Đang xác thực...' : 'Đăng Nhập Google Để Đồng Bộ'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* 4. ADMIN GOOGLE LOGIN REQUIREMENT MODAL */}
      {/* ============================================================== */}
      {adminLoginPrompt?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#141414] border border-[#D4AF37]/50 rounded-sm max-w-lg w-full overflow-hidden shadow-[0_0_35px_rgba(212,175,55,0.2)] animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[#1E190B] via-[#161616] to-[#0D1510] border-b border-[#2A2A2A]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37]">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-editorial-serif font-bold text-white tracking-wide">
                      Yêu Cầu Đăng Nhập Tài Khoản Google Admin
                    </h3>
                  </div>
                  <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1 mt-0.5">
                    <Shield className="w-3 h-3 text-amber-400" />
                    <span>Cần quyền Chủ sở hữu để ghi file vào Google Drive cá nhân</span>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdminLoginPrompt(null)}
                className="text-[#888888] hover:text-white cursor-pointer p-1 transition-colors"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs scrollbar-thin">
              {/* Dynamic Context Notice */}
              {adminLoginPrompt.notice && (
                <div className="p-3 bg-amber-950/40 border border-amber-600/60 rounded text-amber-200 text-xs flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed font-medium">{adminLoginPrompt.notice}</span>
                </div>
              )}

              {/* Technical Reason explained with clarity */}
              <div className="p-3.5 bg-[#0C0C0C] border border-[#262626] rounded space-y-2">
                <div className="font-bold text-white flex items-center gap-1.5 uppercase text-[11px] tracking-wider text-[#D4AF37]">
                  <Lock className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Vì sao cần đăng nhập tài khoản Google của Admin?</span>
                </div>
                <p className="text-[#AAAAAA] leading-relaxed text-[11px]">
                  Thư mục Google Drive được kết nối (<strong className="text-white">{saConfig?.folderName || 'AI Assistant Documents'}</strong>) thuộc tài khoản Google cá nhân (<code className="text-amber-300">@gmail.com</code>).
                </p>
                <p className="text-[#AAAAAA] leading-relaxed text-[11px]">
                  Theo quy định của Google: Robot Service Account có hạn mức lưu trữ là <strong className="text-amber-300">0 MB</strong> trên tài khoản cá nhân, nên robot chỉ có thể đọc dữ liệu chứ không thể tự đẩy file mới lên. Do đó, việc lưu tệp vào Drive yêu cầu <strong className="text-white">Đăng nhập Tài khoản Google của Admin</strong> (Chủ sở hữu thư mục Drive) để cấp quyền ghi dữ liệu bằng dung lượng 15 GB+ của Admin.
                </p>
              </div>

              {/* Vault Reassurance */}
              <div className="p-3 bg-emerald-950/30 border border-emerald-600/40 rounded flex items-start gap-2.5 text-[11px] text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="text-white">Tài liệu của bạn luôn an toàn 100%:</strong> Toàn bộ tệp đã được mã hóa và lưu trữ trong Cloud Vault của hệ thống. Bạn có thể xem trước, tải về hoặc để AI phân tích bất kỳ lúc nào ngay cả khi chưa đẩy lên Google Drive.
                </div>
              </div>

              {/* Helpful Origin Mismatch Accordion */}
              <div className="border border-[#262626] rounded bg-[#0A0A0A] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowOriginHelp(!showOriginHelp)}
                  className="w-full p-2.5 text-left text-[11px] font-bold text-[#AAAAAA] hover:text-[#D4AF37] flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <span>💡 Gặp lỗi &quot;Error 400: origin_mismatch&quot; khi đăng nhập?</span>
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showOriginHelp ? 'rotate-180 text-[#D4AF37]' : ''}`} />
                </button>

                {showOriginHelp && (
                  <div className="p-3 border-t border-[#222222] bg-[#0E0E0E] space-y-2.5 text-[11px] text-[#A0A0A0] animate-in fade-in">
                    <p className="leading-relaxed">
                      Lỗi <code className="text-rose-400">origin_mismatch</code> xảy ra khi địa chỉ tên miền của trang web chưa được khai báo trong Google Cloud Console:
                    </p>
                    <div className="p-2 bg-black border border-[#333333] rounded flex items-center justify-between gap-2">
                      <span className="font-mono text-amber-300 text-[10px] truncate select-all">
                        {typeof window !== 'undefined' ? window.location.origin : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            navigator.clipboard.writeText(window.location.origin);
                            setCopiedOrigin(true);
                            setTimeout(() => setCopiedOrigin(false), 2500);
                          }
                        }}
                        className="px-2 py-1 bg-[#222222] hover:bg-[#333333] text-white rounded text-[10px] font-mono flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {copiedOrigin ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Đã sao chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-[#D4AF37]" />
                            <span>Sao chép Link</span>
                          </>
                        )}
                      </button>
                    </div>
                    <ol className="list-decimal pl-4 space-y-1 text-[10px] text-[#888888]">
                      <li>Vào <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-[#D4AF37] underline">Google Cloud Console ➔ Credentials</a>.</li>
                      <li>Chọn OAuth 2.0 Client ID đang sử dụng.</li>
                      <li>Dán link vừa sao chép ở trên vào mục <strong>Authorized JavaScript origins</strong> rồi bấm <strong>Save</strong>.</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-2 p-4 border-t border-[#2A2A2A] bg-[#0E0E0E]">
              <button
                type="button"
                onClick={() => setAdminLoginPrompt(null)}
                className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#252525] text-[#AAAAAA] hover:text-white border border-[#333333] text-xs font-bold rounded cursor-pointer transition-colors"
              >
                Để Sau
              </button>

              <button
                type="button"
                onClick={handleAdminLoginAndProceed}
                disabled={isLoggingInGoogle}
                className="px-5 py-2.5 bg-white hover:bg-slate-200 text-black text-xs font-bold uppercase tracking-wider rounded cursor-pointer shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isLoggingInGoogle ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang kết nối Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Đăng Nhập Google Admin &amp; Tiếp Tục</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. CENTRALIZED GOOGLE DRIVE MANAGEMENT CONTROL CENTER MODAL   */}
      {/* ============================================================== */}
      {isDriveManageModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-60 animate-in fade-in duration-200">
          <div className="bg-[#141414] border border-[#D4AF37]/60 w-full max-w-xl rounded-sm shadow-2xl overflow-hidden flex flex-col text-slate-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#2A2A2A] p-4 bg-gradient-to-r from-[#1E190B] via-[#161616] to-[#0D1510]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37]">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-editorial-serif font-bold text-white text-base">
                    Trung Tâm Quản Lý Tệp Google Drive
                  </h3>
                  <p className="text-[11px] text-[#A0A0A0] font-mono">
                    Điều phối đồng bộ, dọn trùng lặp và lưu trữ đám mây
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDriveManageModalOpen(false)}
                className="p-1 text-[#888888] hover:text-white transition-colors cursor-pointer"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              {/* Account Status Card */}
              <div className="p-3.5 bg-[#0C0C0C] border border-[#262626] rounded-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold text-white text-xs uppercase tracking-wider">
                      Tài Khoản Google Đang Hoạt Động
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleGoogleSignOutClick();
                      setIsDriveManageModalOpen(false);
                    }}
                    className="text-[10px] text-rose-400 hover:text-rose-300 underline font-mono cursor-pointer"
                  >
                    Đăng xuất tài khoản
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono pt-1 text-[#CCCCCC]">
                  <div>
                    <span className="text-[#777777] block text-[10px] uppercase font-sans">Tài khoản Google:</span>
                    <strong className="text-white select-all">{googleUser?.email || 'Tài khoản kết nối'}</strong>
                  </div>
                  <div>
                    <span className="text-[#777777] block text-[10px] uppercase font-sans">Thư mục Drive:</span>
                    <strong className="text-[#D4AF37]">{saConfig?.folderName || 'AI Assistant Documents'}</strong>
                  </div>
                </div>
                {saConfig?.folderId && (
                  <div className="pt-1.5 flex items-center justify-between text-[11px] border-t border-[#1C1C1C]">
                    <span className="text-[#777777]">Mã thư mục: <code className="text-[#999999]">{saConfig.folderId}</code></span>
                    <a
                      href={`https://drive.google.com/drive/folders/${saConfig.folderId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#D4AF37] hover:underline flex items-center gap-1 font-bold"
                    >
                      <span>Mở trên Google Drive</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Storage Stats Grid */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-3 bg-[#0E0E0E] border border-[#222222] rounded-sm">
                  <span className="text-[10px] font-mono text-[#888888] uppercase block">Tổng tài liệu</span>
                  <span className="text-lg font-bold text-white font-mono">{files.length}</span>
                </div>
                <div className="p-3 bg-[#0A1610] border border-emerald-900/60 rounded-sm">
                  <span className="text-[10px] font-mono text-emerald-400 uppercase block">Đã có trên Drive</span>
                  <span className="text-lg font-bold text-emerald-400 font-mono">
                    {files.filter(f => f.isSyncedToDrive).length}
                  </span>
                </div>
                <div className="p-3 bg-[#1C1608] border border-amber-900/60 rounded-sm">
                  <span className="text-[10px] font-mono text-amber-300 uppercase block">Chưa đẩy lên Drive</span>
                  <span className="text-lg font-bold text-amber-300 font-mono">
                    {localFiles.length}
                  </span>
                </div>
              </div>

              {/* Action Suite */}
              <div className="space-y-2 pt-1">
                <span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider block">
                  Bộ Công Cụ Thao Tác Google Drive:
                </span>

                {/* 1. Sync & Purge */}
                <div className="p-3 bg-[#161408] border border-amber-700/60 rounded-sm flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <h4 className="font-bold text-amber-200 text-xs flex items-center gap-1.5">
                      <UploadCloud className="w-4 h-4 text-[#D4AF37]" />
                      <span>Đẩy lên Drive &amp; Xóa Local ({localFiles.length} tệp)</span>
                    </h4>
                    <p className="text-[11px] text-[#C0C0C0]">
                      Tự động tải các tệp local lên Google Drive và giải phóng 100% dung lượng bộ nhớ cục bộ.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDriveManageModalOpen(false);
                      handleOpenSyncPurgeModal();
                    }}
                    disabled={localFiles.length === 0}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-black font-bold text-xs uppercase tracking-wider rounded-sm shrink-0 cursor-pointer shadow transition-colors"
                  >
                    Bắt đầu
                  </button>
                </div>

                {/* 2. Pull from Drive */}
                <div className="p-3 bg-[#0E0E0E] border border-[#262626] rounded-sm flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                      <FolderSync className="w-4 h-4 text-blue-400" />
                      <span>Nạp tệp từ Google Drive về ứng dụng</span>
                    </h4>
                    <p className="text-[11px] text-[#888888]">
                      Quét toàn bộ tệp trong thư mục Drive và đồng bộ danh sách về ứng dụng.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDriveManageModalOpen(false);
                      handleUnifiedSyncDriveFiles();
                    }}
                    disabled={isSyncing || isSyncingSa}
                    className="px-3.5 py-1.5 bg-[#1F1F1F] hover:bg-[#2A2A2A] text-white border border-[#3A3A3A] font-bold text-xs uppercase tracking-wider rounded-sm shrink-0 cursor-pointer shadow transition-colors"
                  >
                    {isSyncing || isSyncingSa ? 'Đang nạp...' : 'Nạp tệp'}
                  </button>
                </div>

                {/* 3. Deduplicate */}
                <div className="p-3 bg-[#160E0E] border border-rose-900/60 rounded-sm flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <h4 className="font-bold text-rose-300 text-xs flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-rose-400" />
                      <span>Dọn dẹp tệp trùng lặp &amp; tệp rỗng trên Drive</span>
                    </h4>
                    <p className="text-[11px] text-[#A0A0A0]">
                      Tự động tìm kiếm các bản sao trùng tên và xóa các stub rỗng để thư mục gọn gàng.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDriveManageModalOpen(false);
                      handleCleanDriveDuplicates();
                    }}
                    disabled={isCleaningDuplicates}
                    className="px-3.5 py-1.5 bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/60 font-bold text-xs uppercase tracking-wider rounded-sm shrink-0 cursor-pointer shadow transition-colors"
                  >
                    {isCleaningDuplicates ? 'Đang dọn...' : 'Dọn trùng'}
                  </button>
                </div>

                {/* 4. Refresh */}
                <div className="p-3 bg-[#0E0E0E] border border-[#262626] rounded-sm flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                      <RefreshCw className="w-4 h-4 text-[#D4AF37]" />
                      <span>Làm mới kết nối &amp; Kiểm tra thư mục</span>
                    </h4>
                    <p className="text-[11px] text-[#888888]">
                      Làm mới token xác thực và kiểm tra trạng thái thư mục Google Drive.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDriveManageModalOpen(false);
                      handleUnifiedSyncDriveFiles();
                    }}
                    disabled={isSyncingSa || isSyncing}
                    className="px-3.5 py-1.5 bg-[#1F1F1F] hover:bg-[#2A2A2A] text-white border border-[#3A3A3A] font-bold text-xs uppercase tracking-wider rounded-sm shrink-0 cursor-pointer shadow transition-colors"
                  >
                    Làm mới
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end p-4 border-t border-[#2A2A2A] bg-[#0E0E0E]">
              <button
                type="button"
                onClick={() => setIsDriveManageModalOpen(false)}
                className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#252525] text-white border border-[#333333] text-xs font-bold rounded-sm cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
