import React, { useState, useRef, useEffect } from 'react';
import { DriveFile, Task, Note } from '../types/index.ts';
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
  LogIn,
  LogOut,
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
  FolderLock
} from 'lucide-react';
import {
  signInWithGoogle,
  logOutGoogle,
  initGoogleAuth,
  uploadFileToGoogleDrive,
  fetchGoogleDriveFiles,
  deleteFileFromGoogleDrive,
  syncLocalFileToGoogleDrive,
  validateGoogleToken,
  getOrCreateAppFolder,
  getAccessToken,
  getGoogleUser,
  DriveFolderInfo,
  DEFAULT_APP_FOLDER_NAME
} from '../services/googleDriveAuth.ts';
import { User } from 'firebase/auth';

interface FilesViewProps {
  files: DriveFile[];
  tasks: Task[];
  notes: Note[];
  onFileUpload: (fileData: Partial<DriveFile>) => void;
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
  const [categoryFilter, setCategoryFilter] = useState<DriveFile['category'] | 'all'>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tokenExpired, setTokenExpired] = useState(false);

  // Google Auth state
  const [googleUser, setGoogleUser] = useState<User | null>(getGoogleUser());
  const [accessToken, setAccessToken] = useState<string | null>(getAccessToken());
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Dedicated Single Folder state
  const [appFolder, setAppFolder] = useState<DriveFolderInfo | null>(null);
  const [isChangingFolder, setIsChangingFolder] = useState(false);
  const [customFolderNameInput, setCustomFolderNameInput] = useState('');

  // Syncing state per file
  const [syncingFileIds, setSyncingFileIds] = useState<Record<string, boolean>>({});

  // Real Upload progress
  const [uploadProgress, setUploadProgress] = useState<{
    fileName: string;
    progress: number;
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

  // Initialize and observe Google Auth changes
  useEffect(() => {
    const unsubscribe = initGoogleAuth((user, token) => {
      setGoogleUser(user);
      setAccessToken(token);
      if (token) {
        setTokenExpired(false);
        setAuthError(null);
        // Load dedicated folder
        getOrCreateAppFolder(token)
          .then(folder => {
            setAppFolder(folder);
            setCustomFolderNameInput(folder.name);
          })
          .catch(e => console.warn('Could not init app folder:', e));
      }
    });
    return () => unsubscribe();
  }, []);

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

  // Handle Google OAuth Sign In
  const handleGoogleLogin = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const { user, accessToken: token } = await signInWithGoogle();
      setGoogleUser(user);
      setAccessToken(token);
      setTokenExpired(false);

      // Initialize dedicated app folder
      const folder = await getOrCreateAppFolder(token);
      setAppFolder(folder);
      setCustomFolderNameInput(folder.name);

      setSyncStatusMsg(`Đã kết nối Google Drive! Đang liên kết với thư mục: 📁 ${folder.name}`);
      setTimeout(() => setSyncStatusMsg(null), 5000);
    } catch (err: any) {
      console.error('Login error:', err);
      setAuthError(err.message || 'Đăng nhập Google thất bại');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logOutGoogle();
    setGoogleUser(null);
    setAccessToken(null);
    setAppFolder(null);
    setSyncStatusMsg('Đã ngắt kết nối Google Drive.');
    setTimeout(() => setSyncStatusMsg(null), 4000);
  };

  // Change or Rename Dedicated Folder
  const handleSaveAppFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    const newName = customFolderNameInput.trim() || DEFAULT_APP_FOLDER_NAME;
    setIsChangingFolder(false);
    setIsSyncing(true);

    try {
      localStorage.removeItem('ai_app_drive_folder_id'); // force query/create new folder
      const folder = await getOrCreateAppFolder(accessToken, newName);
      setAppFolder(folder);
      setSyncStatusMsg(`Đã chuyển kết nối sang thư mục: 📁 ${folder.name}`);
      setTimeout(() => setSyncStatusMsg(null), 4000);
    } catch (err: any) {
      setAuthError(err.message || 'Lỗi khi đổi thư mục Google Drive');
    } finally {
      setIsSyncing(false);
    }
  };

  // Two-Way Sync: Fetch user's Google Drive files STRICTLY from dedicated folder
  const handleSyncFromDrive = async () => {
    if (!accessToken) {
      handleGoogleLogin();
      return;
    }

    setIsSyncing(true);
    setSyncStatusMsg(null);
    setAuthError(null);

    try {
      const { files: driveFiles, folder } = await fetchGoogleDriveFiles(accessToken, appFolder?.id);
      setAppFolder(folder);

      if (driveFiles.length > 0) {
        const existingIds = new Set(files.map(f => f.driveFileId || f.id));
        for (const df of driveFiles) {
          if (!existingIds.has(df.driveFileId || df.id)) {
            onFileUpload(df);
          }
        }
        setSyncStatusMsg(`Đã đồng bộ ${driveFiles.length} tệp từ thư mục "📁 ${folder.name}"!`);
      } else {
        setSyncStatusMsg(`Thư mục "📁 ${folder.name}" trên Google Drive hiện chưa có tệp.`);
      }
      setTimeout(() => setSyncStatusMsg(null), 5000);
    } catch (err: any) {
      console.error('Fetch Drive error:', err);
      if (err.message?.includes('TOKEN_EXPIRED') || err.message?.includes('401')) {
        setTokenExpired(true);
        setAuthError('Phiên đăng nhập Google Drive đã hết hạn. Hãy bấm "Đăng nhập lại" để gia hạn.');
      } else {
        setAuthError(err.message || 'Lỗi khi đồng bộ từ Google Drive');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // 1-Click Sync Single Local File into the Dedicated Folder
  const handleSyncSingleFileToDrive = async (file: DriveFile) => {
    if (!accessToken) {
      handleGoogleLogin();
      return;
    }

    setSyncingFileIds(prev => ({ ...prev, [file.id]: true }));
    setAuthError(null);

    try {
      const updated = await syncLocalFileToGoogleDrive(file, accessToken, appFolder?.id);
      if (onFileUpdate) {
        onFileUpdate(file.id, updated);
      }
      if (previewFile?.id === file.id) {
        setPreviewFile(updated);
      }
      setSyncStatusMsg(`Đã tải "${file.name}" vào thư mục 📁 ${appFolder?.name || DEFAULT_APP_FOLDER_NAME}!`);
      setTimeout(() => setSyncStatusMsg(null), 4000);
    } catch (err: any) {
      console.error('Sync file error:', err);
      if (err.message?.includes('TOKEN_EXPIRED') || err.message?.includes('401')) {
        setTokenExpired(true);
        setAuthError('Phiên Google hết hạn. Vui lòng đăng nhập lại để đẩy tệp lên Drive.');
      } else {
        setAuthError(`Lỗi khi đẩy tệp lên Google Drive: ${err.message}`);
      }
    } finally {
      setSyncingFileIds(prev => ({ ...prev, [file.id]: false }));
    }
  };

  // Sync All Unsynced Local Files into Dedicated Folder
  const handleSyncAllLocalFiles = async () => {
    if (!accessToken) {
      handleGoogleLogin();
      return;
    }

    const unsyncedFiles = files.filter(f => !f.isSyncedToDrive || f.syncStatus === 'local_only');
    if (unsyncedFiles.length === 0) {
      setSyncStatusMsg('Tất cả tài liệu đã được đồng bộ lên Google Drive!');
      setTimeout(() => setSyncStatusMsg(null), 3000);
      return;
    }

    setIsSyncing(true);
    let count = 0;
    for (const f of unsyncedFiles) {
      try {
        setSyncingFileIds(prev => ({ ...prev, [f.id]: true }));
        const updated = await syncLocalFileToGoogleDrive(f, accessToken, appFolder?.id);
        if (onFileUpdate) onFileUpdate(f.id, updated);
        count++;
      } catch (err: any) {
        console.warn(`Could not sync ${f.name}:`, err);
      } finally {
        setSyncingFileIds(prev => ({ ...prev, [f.id]: false }));
      }
    }
    setIsSyncing(false);
    setSyncStatusMsg(`Đã đồng bộ ${count}/${unsyncedFiles.length} tệp vào thư mục 📁 ${appFolder?.name || DEFAULT_APP_FOLDER_NAME}!`);
    setTimeout(() => setSyncStatusMsg(null), 5000);
  };

  const detectCategory = (filename: string, mimeType: string): DriveFile['category'] => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['xlsx', 'xls', 'csv'].includes(ext) || mimeType.includes('spreadsheet') || mimeType.includes('sheet')) return 'spreadsheet';
    if (ext === 'pdf' || mimeType.includes('pdf')) return 'pdf';
    if (['pptx', 'ppt', 'key'].includes(ext) || mimeType.includes('presentation')) return 'presentation';
    if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext) || mimeType.startsWith('image/')) return 'image';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
    return 'document';
  };

  const getFileIcon = (category: DriveFile['category']) => {
    switch (category) {
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

  // Process Upload: Uploads strictly into the dedicated folder
  const handleProcessUpload = async (rawFile: File) => {
    const category = detectCategory(rawFile.name, rawFile.type);
    const fileId = `file-${Date.now()}`;

    setUploadProgress({
      active: true,
      fileName: rawFile.name,
      progress: 15,
      statusText: accessToken ? `Đang chuẩn bị tải vào thư mục 📁 ${appFolder?.name || DEFAULT_APP_FOLDER_NAME}...` : 'Đang xử lý lưu tệp cục bộ...'
    });

    let uploadedDriveId: string | undefined = undefined;
    let uploadedWebViewLink: string | undefined = undefined;
    let isSynced = false;

    // 1. Convert to base64 for local server persistence
    let base64Data = '';
    try {
      base64Data = await fileToBase64(rawFile);
    } catch (e) {}

    // 2. Direct upload into dedicated folder if OAuth is active
    if (accessToken) {
      try {
        setUploadProgress(prev => prev ? { ...prev, progress: 50, statusText: `Đang đẩy tệp vào thư mục 📁 ${appFolder?.name || DEFAULT_APP_FOLDER_NAME}...` } : null);
        const driveResult = await uploadFileToGoogleDrive(rawFile, rawFile.name, rawFile.type, accessToken, appFolder?.id);
        uploadedDriveId = driveResult.id;
        uploadedWebViewLink = driveResult.webViewLink;
        isSynced = true;
        setUploadProgress(prev => prev ? { ...prev, progress: 85, statusText: 'Đã lưu vào thư mục Drive thành công!' } : null);
      } catch (err: any) {
        console.warn('Google Drive direct upload failed, saving locally:', err);
        if (err.message?.includes('TOKEN_EXPIRED') || err.message?.includes('401')) {
          setTokenExpired(true);
        }
      }
    }

    // 3. Save to backend database & local uploads vault
    const filePayload: Partial<DriveFile> & { base64Data?: string } = {
      id: fileId,
      name: rawFile.name,
      mimeType: rawFile.type || 'application/octet-stream',
      size: rawFile.size,
      category: category,
      isSyncedToDrive: isSynced,
      syncStatus: isSynced ? 'synced' : 'local_only',
      driveFileId: uploadedDriveId,
      webViewLink: uploadedWebViewLink,
      downloadUrl: `/api/files/download/${fileId}`,
      previewUrl: `/api/files/preview/${fileId}`,
      base64Data: base64Data,
    };

    onFileUpload(filePayload);

    setUploadProgress(prev => prev ? { ...prev, progress: 100, statusText: isSynced ? `Đã lưu vào thư mục "${appFolder?.name || DEFAULT_APP_FOLDER_NAME}"!` : 'Đã lưu vào bộ nhớ an toàn (Chưa đồng bộ Drive)' } : null);
    setTimeout(() => {
      setUploadProgress(null);
    }, 1000);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach((f: File) => {
        handleProcessUpload(f);
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTriggerPicker = () => {
    fileInputRef.current?.click();
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    const targetFile = fileToDelete;
    setFileToDelete(null);

    // If connected to Google Drive and has a legitimate driveFileId, delete on Drive as well
    if (accessToken && targetFile.driveFileId && !targetFile.driveFileId.startsWith('file-') && !targetFile.driveFileId.startsWith('drive-id-')) {
      try {
        await deleteFileFromGoogleDrive(targetFile.driveFileId, accessToken);
      } catch (err) {
        console.warn('Could not delete file from Google Drive:', err);
      }
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

  const filteredFiles = files.filter(f => {
    if (categoryFilter !== 'all' && f.category !== categoryFilter) return false;
    if (search.trim()) {
      return f.name.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
  const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
  const syncedCount = files.filter(f => f.isSyncedToDrive && f.syncStatus === 'synced').length;
  const localOnlyCount = files.length - syncedCount;

  // Find linked tasks/notes for preview modal
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
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-editorial-serif font-bold text-white">Quản lý Tài liệu & Kho Tệp</h1>
              <span className="text-[10px] bg-[#0C0C0C] text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded font-mono">
                📁 {appFolder?.name || DEFAULT_APP_FOLDER_NAME}
              </span>
            </div>
            <p className="text-xs text-[#888888] italic">
              Tài liệu được lưu trữ cách ly an toàn trong một thư mục chuyên biệt trên Google Drive
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick External Link to Google Drive folder */}
          {appFolder?.webViewLink && (
            <a
              href={appFolder.webViewLink}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-sm bg-[#0C0C0C] hover:bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/40 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
              title="Mở thư mục này trực tiếp trên Google Drive"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Mở Drive</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {/* Shortcut to Settings */}
          {onNavigateToSettings && (
            <button
              onClick={onNavigateToSettings}
              className="px-3 py-2 rounded-sm bg-[#0C0C0C] hover:bg-[#1A1A1A] text-[#E0E0E0] border border-[#2A2A2A] hover:border-[#D4AF37]/50 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Đi tới trang Cài Đặt để cấu hình tài khoản Google hoặc đổi tên thư mục"
            >
              <Settings className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Cài Đặt Drive</span>
            </button>
          )}

          {/* Sync from Google Drive Dedicated Folder */}
          <button
            onClick={handleSyncFromDrive}
            disabled={isSyncing}
            className="px-3 py-2 rounded-sm bg-[#0C0C0C] hover:bg-[#1A1A1A] text-[#E0E0E0] border border-[#2A2A2A] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Đồng bộ danh sách tệp từ thư mục riêng về ứng dụng"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#D4AF37] ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Đang tải...' : 'Lấy tệp từ Drive'}</span>
          </button>

          {/* 1-Click Sync All Unsynced */}
          {googleUser && localOnlyCount > 0 && (
            <button
              onClick={handleSyncAllLocalFiles}
              disabled={isSyncing}
              className="px-3 py-2 rounded-sm bg-[#1A1A1A] hover:bg-[#252525] text-emerald-400 border border-emerald-500/40 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Đẩy toàn bộ tài liệu cục bộ vào thư mục riêng trên Drive"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Đẩy {localOnlyCount} tệp vào Drive</span>
            </button>
          )}

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

      {/* Token Expired Action Banner */}
      {tokenExpired && (
        <div className="p-3.5 rounded-sm bg-amber-950/50 border border-amber-500 text-xs text-amber-200 font-medium flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span><strong>Phiên Google Drive đã hết hạn (60 phút):</strong> Vui lòng gia hạn để tiếp tục tải tệp trực tiếp vào thư mục.</span>
          </div>
          <button
            onClick={handleGoogleLogin}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px] uppercase tracking-wider rounded-sm cursor-pointer shadow"
          >
            Đăng Nhập Lại Ngay
          </button>
        </div>
      )}

      {/* Auth Error Banner */}
      {authError && !tokenExpired && (
        <div className="p-3 rounded-sm bg-rose-950/40 border border-rose-800 text-xs text-rose-300 font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{authError}</span>
          </div>
          <button onClick={() => setAuthError(null)} className="text-xs hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* Storage & Sync Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-sm bg-[#151515] border border-[#2A2A2A] flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider">Dung lượng sử dụng</span>
            <div className="text-xl font-editorial-serif font-bold text-white">{totalMb} MB <span className="text-xs text-[#666666] font-normal font-sans">/ 15 GB</span></div>
          </div>
          <HardDrive className="w-8 h-8 text-[#D4AF37]/40" />
        </div>

        <div className="p-4 rounded-sm bg-[#151515] border border-[#2A2A2A] flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider">Đã lưu trong Thư mục</span>
            <div className="text-xl font-editorial-serif font-bold text-emerald-400">{syncedCount} tệp</div>
          </div>
          <CheckCircle2 className="w-8 h-8 text-emerald-400/40" />
        </div>

        <div className="p-4 rounded-sm bg-[#151515] border border-[#2A2A2A] flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider">Lưu trữ nội bộ (Local)</span>
            <div className="text-xl font-editorial-serif font-bold text-amber-400">{localOnlyCount} tệp</div>
          </div>
          <CloudOff className="w-8 h-8 text-amber-400/40" />
        </div>

        <div className="p-4 rounded-sm bg-[#151515] border border-[#2A2A2A] flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider">Chế độ kết nối</span>
            <div className="text-xs font-bold flex items-center gap-1.5 mt-1">
              {googleUser ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> 1 Thư mục riêng
                </span>
              ) : (
                <span className="text-[#888888]">Chưa liên kết</span>
              )}
            </div>
          </div>
          <FolderLock className={`w-8 h-8 ${googleUser ? 'text-emerald-400/40' : 'text-[#888888]/40'}`} />
        </div>
      </div>

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
        className={`p-7 rounded-sm border border-dashed text-center transition-all cursor-pointer group ${
          dragOver ? 'border-[#D4AF37] bg-[#1A1A1A]' : 'border-[#2A2A2A] bg-[#151515] hover:border-[#D4AF37]'
        }`}
      >
        <UploadCloud className="w-9 h-9 text-[#D4AF37] mx-auto mb-2.5 group-hover:scale-110 transition-transform" />
        <h3 className="text-sm font-editorial-serif font-bold text-white group-hover:text-[#D4AF37] transition-colors">
          Kéo thả tệp vào đây hoặc nhấn để Tải tài liệu lên
        </h3>
        <p className="text-xs text-[#888888] italic mt-1 max-w-lg mx-auto">
          {googleUser ? (
            <span className="text-emerald-400 font-medium">⚡ Tự động tải thẳng vào thư mục 📁 "{appFolder?.name || DEFAULT_APP_FOLDER_NAME}" trên Google Drive!</span>
          ) : (
            <span>Hỗ trợ PDF, Excel, Word, hình ảnh và văn bản. Đăng nhập Google Drive để kết nối với thư mục riêng.</span>
          )}
        </p>
      </div>

      {/* Search & Category Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#151515] p-3 rounded-sm border border-[#2A2A2A]">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]" />
          <input
            type="text"
            placeholder="Tìm kiếm tài liệu trong thư mục theo tên tệp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-xs text-[#E0E0E0] focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {(['all', 'document', 'spreadsheet', 'presentation', 'pdf', 'image'] as const).map(cat => (
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
        {filteredFiles.map(file => {
          const linkedTasks = getLinkedTasks(file.id);
          const linkedNotes = getLinkedNotes(file.id);
          const isSynced = file.isSyncedToDrive && file.syncStatus === 'synced' && !!file.webViewLink;
          const isSyncingThis = !!syncingFileIds[file.id];

          return (
            <div
              key={file.id}
              className="p-4 rounded-sm bg-[#151515] border border-[#2A2A2A] hover:border-[#D4AF37]/50 transition-all space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div
                    onClick={() => setPreviewFile(file)}
                    className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1 group"
                  >
                    <div className="p-2.5 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] shrink-0 group-hover:border-[#D4AF37]/40 transition-colors">
                      {getFileIcon(file.category)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-editorial-serif font-bold text-white truncate group-hover:text-[#D4AF37] transition-colors" title={file.name}>
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
                      title="Xem trước tài liệu nhúng"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={file.downloadUrl || `/api/files/download/${file.id}`}
                      download={file.name}
                      className="p-1.5 rounded-sm bg-[#0C0C0C] hover:bg-[#1A1A1A] text-[#888888] hover:text-[#D4AF37] border border-[#2A2A2A] transition-colors cursor-pointer"
                      title="Tải tệp về máy tính"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => {
                        setEditingUrlFile(file);
                        setInputUrl(file.webViewLink || '');
                      }}
                      className="p-1.5 rounded-sm bg-[#0C0C0C] hover:bg-[#1A1A1A] text-[#888888] hover:text-[#D4AF37] border border-[#2A2A2A] transition-colors cursor-pointer"
                      title="Gắn liên kết Google Drive"
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

                {/* Honest Sync Status Badge */}
                <div className="flex items-center justify-between text-[10px]">
                  {isSynced ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/60 font-mono">
                      <CheckCircle2 className="w-3 h-3" /> Đã lưu trong thư mục
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-800/60 font-mono">
                      <CloudOff className="w-3 h-3" /> Lưu trữ cục bộ (Chưa lên Drive)
                    </span>
                  )}

                  {/* 1-Click Upload to Google Drive Folder */}
                  {!isSynced && (
                    <button
                      onClick={() => handleSyncSingleFileToDrive(file)}
                      disabled={isSyncingThis}
                      className="text-[10px] font-bold text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer bg-[#0C0C0C] px-2 py-0.5 rounded border border-[#2A2A2A]"
                      title={`Đẩy tệp này vào thư mục "${appFolder?.name || DEFAULT_APP_FOLDER_NAME}"`}
                    >
                      <Cloud className={`w-3 h-3 ${isSyncingThis ? 'animate-spin' : ''}`} />
                      <span>{isSyncingThis ? 'Đang đẩy...' : '☁️ Vào thư mục'}</span>
                    </button>
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
              <div className="flex items-center justify-between pt-2 border-t border-[#2A2A2A]">
                <button
                  onClick={() => openAiChatWithPrompt(`Hãy phân tích và tóm tắt nội dung tài liệu "${file.name}" (Loại: ${file.category}, Dung lượng: ${(file.size / (1024 * 1024)).toFixed(2)} MB)`)}
                  className="text-[10px] font-bold text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Hỏi AI về file</span>
                </button>

                {isSynced && file.webViewLink ? (
                  <a
                    href={file.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2 py-1 rounded-sm bg-emerald-950/40 text-emerald-400 border border-emerald-800/80 hover:bg-emerald-600 hover:text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                    title="Mở tệp trực tiếp trong Google Drive"
                  >
                    <span>Mở Google Drive</span>
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
          );
        })}
      </div>

      {/* Change Folder Modal */}
      {isChangingFolder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#151515] border border-[#2A2A2A] w-full max-w-md rounded-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-[#D4AF37]" />
                <h3 className="font-editorial-serif font-bold text-white text-sm">Chỉ định Thư Mục Google Drive</h3>
              </div>
              <button
                onClick={() => setIsChangingFolder(false)}
                className="p-1 text-[#888888] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAppFolder} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#888888] font-bold uppercase text-[10px] mb-1.5">
                  Tên thư mục trên Google Drive:
                </label>
                <p className="text-[#666666] text-[11px] mb-2 italic">
                  Hệ thống sẽ tự động tìm hoặc tạo thư mục có tên này trên Google Drive của bạn để lưu toàn bộ tài liệu một cách riêng biệt.
                </p>
                <input
                  type="text"
                  placeholder="Ví dụ: AI Assistant Documents"
                  value={customFolderNameInput}
                  onChange={(e) => setCustomFolderNameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2A2A2A]">
                <button
                  type="button"
                  onClick={() => setIsChangingFolder(false)}
                  className="px-3 py-1.5 bg-[#0C0C0C] hover:bg-[#1A1A1A] text-white border border-[#2A2A2A] rounded-sm cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold uppercase tracking-wider rounded-sm cursor-pointer"
                >
                  Lưu & Áp Dụng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mandatory User Confirmation Dialog for File Deletion */}
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
              Bạn có chắc chắn muốn xóa tệp <strong className="text-white font-mono">"{fileToDelete.name}"</strong> khỏi thư mục <strong className="text-[#D4AF37]">📁 {appFolder?.name || DEFAULT_APP_FOLDER_NAME}</strong>?
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

      {/* Edit URL Modal */}
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
                <p className="text-[#666666] text-[11px] mb-2 italic">
                  Dán đường link chia sẻ từ Google Drive (ví dụ: https://drive.google.com/file/d/1A2B3C.../view hoặc https://docs.google.com/document/d/...)
                </p>
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

      {/* Enhanced In-App Document Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#151515] border border-[#2A2A2A] w-full max-w-2xl max-h-[90vh] flex flex-col rounded-sm shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#2A2A2A] p-4 bg-[#111111]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded bg-[#0C0C0C] border border-[#2A2A2A] shrink-0">
                  {getFileIcon(previewFile.category)}
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
              {/* Metadata Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-[#0C0C0C] p-3 rounded-sm border border-[#2A2A2A]">
                <div>
                  <span className="text-[9px] text-[#666666] font-mono uppercase block">Dung lượng:</span>
                  <span className="font-bold text-white">{(previewFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
                <div>
                  <span className="text-[9px] text-[#666666] font-mono uppercase block">Phân loại:</span>
                  <span className="font-bold text-[#D4AF37] uppercase">{previewFile.category}</span>
                </div>
                <div>
                  <span className="text-[9px] text-[#666666] font-mono uppercase block">Thư mục Drive:</span>
                  <span className="text-white truncate block">📁 {appFolder?.name || DEFAULT_APP_FOLDER_NAME}</span>
                </div>
                <div>
                  <span className="text-[9px] text-[#666666] font-mono uppercase block">Trạng thái:</span>
                  {previewFile.isSyncedToDrive && previewFile.webViewLink ? (
                    <span className="text-emerald-400 font-bold">🟢 Google Cloud</span>
                  ) : (
                    <span className="text-amber-400 font-bold">🟡 Local Vault</span>
                  )}
                </div>
              </div>

              {/* In-App Document Viewer Area */}
              <div className="bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm p-4 min-h-[200px] max-h-[300px] overflow-y-auto">
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
                      <span>Mở link gốc</span>
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
                      Tệp nhị phân đã được lưu trữ an toàn trong kho dữ liệu. Bạn có thể tải tệp về máy tính hoặc đẩy trực tiếp vào thư mục Google Drive.
                    </p>
                  </div>
                )}
              </div>

              {/* Cloud Sync & Action Panel */}
              {(!previewFile.isSyncedToDrive || !previewFile.webViewLink) ? (
                <div className="p-3.5 bg-amber-950/30 border border-amber-700/50 rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                      <CloudOff className="w-4 h-4" />
                      <span>Tài liệu đang lưu trữ cục bộ</span>
                    </div>
                    <p className="text-[11px] text-[#A0A0A0]">
                      Nhấn vào đây để tải tệp vào thư mục 📁 <strong>"{appFolder?.name || DEFAULT_APP_FOLDER_NAME}"</strong> trên Google Drive của bạn.
                    </p>
                  </div>
                  <button
                    onClick={() => handleSyncSingleFileToDrive(previewFile)}
                    disabled={!!syncingFileIds[previewFile.id]}
                    className="px-4 py-2 bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold text-xs uppercase tracking-wider rounded-sm shrink-0 flex items-center justify-center gap-1.5 cursor-pointer shadow"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>{syncingFileIds[previewFile.id] ? 'Đang đẩy lên...' : 'Đẩy Vào Thư Mục Drive'}</span>
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
                  const cat = previewFile.category;
                  setPreviewFile(null);
                  openAiChatWithPrompt(`Hãy phân tích và tóm tắt chuyên sâu nội dung tài liệu "${fname}" (Loại: ${cat}). Đưa ra các điểm chính và đề xuất hành động tiếp theo.`);
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
    </div>
  );
};
