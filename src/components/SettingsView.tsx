import React, { useState, useEffect } from 'react';
import { TelegramConfig, DriveFile, DriveServiceAccountConfig } from '../types/index.js';
import { api } from '../services/api.js';
import {
  signInWithGoogle,
  signInWithGoogleGIS,
  refreshAccessTokenSilently,
  setCustomAccessToken,
  getCustomGoogleClientId,
  setCustomGoogleClientId,
  logOutGoogle,
  initGoogleAuth,
  getOrCreateAppFolder,
  syncLocalFileToGoogleDrive,
  getAccessToken,
  getGoogleUser,
  DriveFolderInfo,
  DEFAULT_APP_FOLDER_NAME
} from '../services/googleDriveAuth.ts';
import firebaseConfig from '../../firebase-applet-config.json';
import { User } from 'firebase/auth';
import {
  Settings,
  Bot,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Copy,
  ExternalLink,
  RefreshCw,
  LogOut,
  Sparkles,
  Link2,
  Folder,
  Send,
  Zap,
  FolderOpen,
  HelpCircle,
  PlusCircle,
  Eye,
  EyeOff,
  Cloud,
  Check,
  Cpu,
  Radio,
  Clock,
  KeyRound,
  Layers,
  Globe,
  Key,
  Sun,
  Moon
} from 'lucide-react';

interface SettingsViewProps {
  telegramConfig: TelegramConfig;
  onUpdateTelegramConfig: (config: Partial<TelegramConfig>) => void;
  onSendTestTelegramMessage: (message?: string) => void;
  files: DriveFile[];
  onFileUpdate?: (id: string, fileData: Partial<DriveFile>) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  telegramConfig,
  onUpdateTelegramConfig,
  onSendTestTelegramMessage,
  files,
  onFileUpdate
}) => {
  const [activeSection, setActiveSection] = useState<'all' | 'telegram' | 'drive' | 'system'>('all');

  // --- Telegram State ---
  const [tokenInput, setTokenInput] = useState(telegramConfig.botToken || '');
  const [chatIdInput, setChatIdInput] = useState(telegramConfig.chatId || '');
  const [alertOffset, setAlertOffset] = useState(telegramConfig.alertOffsetMinutes || 15);
  const [timezone, setTimezone] = useState(telegramConfig.timezone || 'Asia/Ho_Chi_Minh');
  const [morningHour, setMorningHour] = useState(telegramConfig.morningBriefingHour ?? 7);
  const [morningMinute, setMorningMinute] = useState(telegramConfig.morningBriefingMinute ?? 0);
  const [eveningHour, setEveningHour] = useState(telegramConfig.eveningBriefingHour ?? 21);
  const [eveningMinute, setEveningMinute] = useState(telegramConfig.eveningBriefingMinute ?? 0);
  const [enableMorningBriefing, setEnableMorningBriefing] = useState(telegramConfig.enableMorningBriefing !== false);
  const [enableEveningBriefing, setEnableEveningBriefing] = useState(telegramConfig.enableEveningBriefing !== false);
  const [showToken, setShowToken] = useState(false);
  const [testMessageText, setTestMessageText] = useState('Xin chào! Đây là thông báo kiểm tra từ mục Cài Đặt của AI Assistant.');
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);
  const [isActivatingWebhook, setIsActivatingWebhook] = useState(false);
  const [showCreateBotGuide, setShowCreateBotGuide] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [isCheckingWebhookInfo, setIsCheckingWebhookInfo] = useState(false);
  const [telegramSavedSuccess, setTelegramSavedSuccess] = useState(false);

  // Live Vietnam Clock for user visual confirmation
  const [currentVnClock, setCurrentVnClock] = useState<string>(() => {
    return new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      try {
        setCurrentVnClock(new Date().toLocaleTimeString('vi-VN', { timeZone: timezone || 'Asia/Ho_Chi_Minh' }));
      } catch (e) {
        setCurrentVnClock(new Date().toLocaleTimeString('vi-VN'));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [timezone]);

  useEffect(() => {
    setTokenInput(telegramConfig.botToken || '');
    setChatIdInput(telegramConfig.chatId || '');
    setAlertOffset(telegramConfig.alertOffsetMinutes || 15);
    setTimezone(telegramConfig.timezone || 'Asia/Ho_Chi_Minh');
    setMorningHour(telegramConfig.morningBriefingHour ?? 7);
    setMorningMinute(telegramConfig.morningBriefingMinute ?? 0);
    setEveningHour(telegramConfig.eveningBriefingHour ?? 21);
    setEveningMinute(telegramConfig.eveningBriefingMinute ?? 0);
    setEnableMorningBriefing(telegramConfig.enableMorningBriefing !== false);
    setEnableEveningBriefing(telegramConfig.enableEveningBriefing !== false);
  }, [telegramConfig]);

  const webhookUrl = `${window.location.origin}/api/telegram/webhook`;

  // --- Google Drive State ---
  const [googleUser, setGoogleUser] = useState<any | null>(getGoogleUser());
  const [accessToken, setAccessToken] = useState<string | null>(getAccessToken());
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [driveAuthError, setDriveAuthError] = useState<string | null>(null);
  const [driveStatusMsg, setDriveStatusMsg] = useState<string | null>(null);
  const [appFolder, setAppFolder] = useState<DriveFolderInfo | null>(null);
  const [customFolderName, setCustomFolderName] = useState('');
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [showManualTokenInput, setShowManualTokenInput] = useState(false);
  const [showClientIdInput, setShowClientIdInput] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [clientIdInput, setClientIdInput] = useState(getCustomGoogleClientId());
  const [isSubmittingManualToken, setIsSubmittingManualToken] = useState(false);

  // --- Service Account (Multi-Device Fixed Folder) State ---
  const [saConfig, setSaConfig] = useState<DriveServiceAccountConfig>({
    clientEmail: '',
    privateKey: '',
    folderId: '',
    isEnabled: true,
    isConnected: false,
  });
  const [saEmailInput, setSaEmailInput] = useState('');
  const [saKeyInput, setSaKeyInput] = useState('');
  const [saFolderIdInput, setSaFolderIdInput] = useState('');
  const [saJsonInput, setSaJsonInput] = useState('');
  const [saInputMode, setSaInputMode] = useState<'json' | 'manual'>('json');
  const [isTestingSa, setIsTestingSa] = useState(false);
  const [isSyncingSa, setIsSyncingSa] = useState(false);
  const [isSavingSa, setIsSavingSa] = useState(false);
  const [saTestResult, setSaTestResult] = useState<any>(null);
  const [saError, setSaError] = useState<string | null>(null);
  const [saSuccessMsg, setSaSuccessMsg] = useState<string | null>(null);
  const [showSaKey, setShowSaKey] = useState(false);
  const [showSaGuide, setShowSaGuide] = useState(false);

  const currentHostname = window.location.hostname;
  const currentOrigin = window.location.origin;
  const firebaseProjectId = (firebaseConfig as any).projectId || 'amplified-rhythm-nlsxp';
  const firebaseAuthDomainUrl = `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/providers`;

  // Load Service Account Config on mount
  useEffect(() => {
    api.getDriveServiceAccountConfig()
      .then(cfg => {
        setSaConfig(cfg);
        setSaEmailInput(cfg.clientEmail || '');
        setSaFolderIdInput(cfg.folderId || '');
      })
      .catch(err => console.warn('Could not load Service Account config:', err));
  }, []);

  // Sync token and chatId if updated externally
  useEffect(() => {
    setTokenInput(telegramConfig.botToken || '');
    setChatIdInput(telegramConfig.chatId || '');
    setAlertOffset(telegramConfig.alertOffsetMinutes || 15);
  }, [telegramConfig]);

  // Observe Google Auth
  useEffect(() => {
    const unsubscribe = initGoogleAuth((user, token) => {
      setGoogleUser(user);
      setAccessToken(token);
      if (token) {
        setDriveAuthError(null);
        getOrCreateAppFolder(token)
          .then(folder => {
            setAppFolder(folder);
            setCustomFolderName(folder.name);
          })
          .catch(e => console.warn('Could not init app folder:', e));
      }
    });
    return () => unsubscribe();
  }, []);

  // Handle Telegram Config Save
  const handleSaveTelegramConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateTelegramConfig({
      botToken: tokenInput.trim(),
      chatId: chatIdInput.trim(),
      alertOffsetMinutes: Number(alertOffset),
      enabled: true,
      isConnected: true,
      timezone: timezone || 'Asia/Ho_Chi_Minh',
      morningBriefingHour: Number(morningHour),
      morningBriefingMinute: Number(morningMinute),
      eveningBriefingHour: Number(eveningHour),
      eveningBriefingMinute: Number(eveningMinute),
      enableMorningBriefing,
      enableEveningBriefing,
    });

    setTelegramSavedSuccess(true);
    setTimeout(() => setTelegramSavedSuccess(false), 4000);

    if (tokenInput.trim()) {
      await handleSetWebhook();
    }
  };

  const handleSetWebhook = async () => {
    setIsActivatingWebhook(true);
    setWebhookStatus(null);
    try {
      const res = await api.setTelegramWebhook(webhookUrl);
      if (res.success) {
        setWebhookStatus('✅ Đã kích hoạt Webhook 2 chiều Telegram thành công!');
      }
    } catch (err: any) {
      setWebhookStatus(`❌ ${err.message || 'Chưa thể cài đặt Webhook. Hãy kiểm tra lại Bot Token.'}`);
    } finally {
      setIsActivatingWebhook(false);
    }
  };

  const handleCheckWebhookInfo = async () => {
    setIsCheckingWebhookInfo(true);
    setWebhookInfo(null);
    try {
      const res = await api.getTelegramWebhookInfo();
      setWebhookInfo(res.info || res);
    } catch (err: any) {
      setWebhookInfo({ error: err.message });
    } finally {
      setIsCheckingWebhookInfo(false);
    }
  };

  // Service Account Handlers
  const handleSaveSaConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingSa(true);
    setSaError(null);
    setSaSuccessMsg(null);
    try {
      const payload: Partial<DriveServiceAccountConfig> = {
        folderId: saFolderIdInput.trim(),
        isEnabled: true,
      };

      if (saInputMode === 'json' && saJsonInput.trim()) {
        payload.serviceAccountRawJson = saJsonInput.trim();
      } else {
        payload.clientEmail = saEmailInput.trim();
        if (saKeyInput.trim() && !saKeyInput.includes('********')) {
          payload.privateKey = saKeyInput.trim();
        }
      }

      const res = await api.updateDriveServiceAccountConfig(payload);
      setSaConfig(res.config);
      setSaEmailInput(res.config.clientEmail || '');
      setSaSuccessMsg('✅ Đã lưu cấu hình Google Service Account thành công!');
      setTimeout(() => setSaSuccessMsg(null), 4000);
    } catch (err: any) {
      setSaError(err.message || 'Lỗi lưu cấu hình Service Account');
    } finally {
      setIsSavingSa(false);
    }
  };

  const handleTestSaConnection = async () => {
    setIsTestingSa(true);
    setSaError(null);
    setSaSuccessMsg(null);
    setSaTestResult(null);
    try {
      const payload: any = {
        folderId: saFolderIdInput.trim() || saConfig.folderId,
      };
      if (saInputMode === 'json' && saJsonInput.trim()) {
        payload.serviceAccountRawJson = saJsonInput.trim();
      } else {
        if (saEmailInput.trim()) payload.clientEmail = saEmailInput.trim();
        if (saKeyInput.trim() && !saKeyInput.includes('********')) payload.privateKey = saKeyInput.trim();
      }

      const res = await api.testDriveServiceAccount(payload);
      setSaTestResult(res);
      setSaSuccessMsg(`🎉 Kết nối thành công! Thư mục Drive: "${res.folderName}"`);
      const updatedCfg = await api.getDriveServiceAccountConfig();
      setSaConfig(updatedCfg);
      setSaEmailInput(updatedCfg.clientEmail || '');
      setSaFolderIdInput(updatedCfg.folderId || '');
    } catch (err: any) {
      setSaError(err.message || 'Kiểm tra kết nối Service Account thất bại');
    } finally {
      setIsTestingSa(false);
    }
  };

  const handleSyncSaFiles = async () => {
    setIsSyncingSa(true);
    setSaError(null);
    setSaSuccessMsg(null);
    try {
      const res = await api.syncDriveServiceAccount();
      setSaSuccessMsg(`✅ Đã đồng bộ thành công ${res.syncedCount} tệp từ Google Drive vào hệ thống!`);
      const updatedCfg = await api.getDriveServiceAccountConfig();
      setSaConfig(updatedCfg);
      setTimeout(() => setSaSuccessMsg(null), 5000);
    } catch (err: any) {
      setSaError(err.message || 'Lỗi đồng bộ tệp từ Google Drive');
    } finally {
      setIsSyncingSa(false);
    }
  };

  // Google Login & Folder Setup
  const handleGoogleLogin = async () => {
    setIsAuthenticating(true);
    setDriveAuthError(null);
    try {
      // If already connected, attempt seamless silent refresh first
      if (googleUser || accessToken) {
        try {
          const freshToken = await refreshAccessTokenSilently();
          if (freshToken) {
            setAccessToken(freshToken);
            const folder = await getOrCreateAppFolder(freshToken);
            setAppFolder(folder);
            setCustomFolderName(folder.name);
            setDriveStatusMsg(`Đã tự động gia hạn token Google Drive thành công! Thư mục: 📁 ${folder.name}`);
            setTimeout(() => setDriveStatusMsg(null), 5000);
            return;
          }
        } catch (silentErr) {
          console.log('Silent refresh unavailable, proceeding with standard sign in...', silentErr);
        }
      }

      const result = await signInWithGoogleGIS().catch(() => signInWithGoogle());
      const { user, accessToken: token } = result;
      setGoogleUser(user);
      setAccessToken(token);

      const folder = await getOrCreateAppFolder(token);
      setAppFolder(folder);
      setCustomFolderName(folder.name);

      setDriveStatusMsg(`Đã kết nối Google Drive! Đang liên kết với thư mục: 📁 ${folder.name}`);
      setTimeout(() => setDriveStatusMsg(null), 5000);
    } catch (err: any) {
      console.error('Login error:', err);
      setDriveAuthError(err.message || 'Đăng nhập Google thất bại');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleDirectGISLogin = async () => {
    setIsAuthenticating(true);
    setDriveAuthError(null);
    try {
      const { user, accessToken: token } = await signInWithGoogleGIS();
      setGoogleUser(user);
      setAccessToken(token);

      const folder = await getOrCreateAppFolder(token);
      setAppFolder(folder);
      setCustomFolderName(folder.name);

      setDriveStatusMsg(`Đã kết nối Google Drive (GIS Direct)! Đang liên kết với thư mục: 📁 ${folder.name}`);
      setTimeout(() => setDriveStatusMsg(null), 5000);
    } catch (err: any) {
      console.error('Direct GIS Login error:', err);
      setDriveAuthError(err.message || 'Đăng nhập trực tiếp qua Google OAuth thất bại');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleManualTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;

    setIsSubmittingManualToken(true);
    setDriveAuthError(null);

    try {
      const { user, accessToken: token } = await setCustomAccessToken(manualToken.trim());
      setGoogleUser(user);
      setAccessToken(token);

      const folder = await getOrCreateAppFolder(token);
      setAppFolder(folder);
      setCustomFolderName(folder.name);

      setDriveStatusMsg(`Đã xác thực thành công Access Token! Đang liên kết: 📁 ${folder.name}`);
      setShowManualTokenInput(false);
      setManualToken('');
      setTimeout(() => setDriveStatusMsg(null), 5000);
    } catch (err: any) {
      setDriveAuthError(err.message || 'Access Token không hợp lệ');
    } finally {
      setIsSubmittingManualToken(false);
    }
  };

  const handleSaveClientId = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomGoogleClientId(clientIdInput.trim());
    setShowClientIdInput(false);
    setDriveStatusMsg(clientIdInput.trim() ? 'Đã lưu Google Client ID tùy chỉnh!' : 'Đã xóa Google Client ID tùy chỉnh.');
    setTimeout(() => setDriveStatusMsg(null), 4000);
  };

  const handleGoogleLogout = async () => {
    await logOutGoogle();
    setGoogleUser(null);
    setAccessToken(null);
    setAppFolder(null);
    setDriveStatusMsg('Đã ngắt kết nối Google Drive.');
    setTimeout(() => setDriveStatusMsg(null), 4000);
  };

  const handleSaveAppFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      handleGoogleLogin();
      return;
    }
    const newName = customFolderName.trim() || DEFAULT_APP_FOLDER_NAME;
    setIsSavingFolder(true);
    setDriveAuthError(null);

    try {
      localStorage.removeItem('ai_app_drive_folder_id');
      const folder = await getOrCreateAppFolder(accessToken, newName);
      setAppFolder(folder);
      setCustomFolderName(folder.name);
      setDriveStatusMsg(`Đã chuyển liên kết sang thư mục: 📁 ${folder.name}`);
      setTimeout(() => setDriveStatusMsg(null), 4000);
    } catch (err: any) {
      setDriveAuthError(err.message || 'Lỗi khi đổi thư mục Google Drive');
    } finally {
      setIsSavingFolder(false);
    }
  };

  const handleSyncAllLocalFiles = async () => {
    if (!accessToken) {
      handleGoogleLogin();
      return;
    }

    const unsyncedFiles = files.filter(f => !f.isSyncedToDrive || f.syncStatus === 'local_only');
    if (unsyncedFiles.length === 0) {
      setDriveStatusMsg('Tất cả tài liệu đã được lưu trong thư mục Google Drive!');
      setTimeout(() => setDriveStatusMsg(null), 3000);
      return;
    }

    setIsSyncingAll(true);
    let count = 0;
    for (const f of unsyncedFiles) {
      try {
        const updated = await syncLocalFileToGoogleDrive(f, accessToken, appFolder?.id);
        if (onFileUpdate) onFileUpdate(f.id, updated);
        count++;
      } catch (err: any) {
        console.warn(`Could not sync ${f.name}:`, err);
      }
    }
    setIsSyncingAll(false);
    setDriveStatusMsg(`Đã đẩy thành công ${count}/${unsyncedFiles.length} tệp vào thư mục 📁 ${appFolder?.name || DEFAULT_APP_FOLDER_NAME}!`);
    setTimeout(() => setDriveStatusMsg(null), 5000);
  };

  const isUnauthorizedDomain = driveAuthError?.includes('unauthorized-domain') || driveAuthError?.includes('auth/unauthorized-domain');

  const syncedCount = files.filter(f => f.isSyncedToDrive && f.syncStatus === 'synced').length;
  const localOnlyCount = files.length - syncedCount;
  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
  const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#151515] border border-[#2A2A2A] p-5 rounded-sm shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-sm bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/30">
            <Settings className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-editorial-serif font-bold text-white">Cài Đặt & Cấu Hình Tích Hợp</h1>
              <span className="text-[10px] bg-[#0C0C0C] text-[#D4AF37] border border-[#D4AF37]/30 px-2 py-0.5 rounded font-mono font-bold">
                Centralized Config Center
              </span>
            </div>
            <p className="text-xs text-[#888888] italic mt-0.5">
              Quản lý tập trung thông số kết nối Telegram Bot, Google Drive Folder, thông báo deadline và mô hình AI
            </p>
          </div>
        </div>

        {/* Section Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto bg-[#0C0C0C] p-1 rounded-sm border border-[#2A2A2A]">
          <button
            onClick={() => setActiveSection('all')}
            className={`px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeSection === 'all' ? 'bg-[#D4AF37] text-black shadow' : 'text-[#888888] hover:text-white'
            }`}
          >
            Tất Cả
          </button>
          <button
            onClick={() => setActiveSection('telegram')}
            className={`px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'telegram' ? 'bg-[#D4AF37] text-black shadow' : 'text-[#888888] hover:text-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Telegram Bot</span>
          </button>
          <button
            onClick={() => setActiveSection('drive')}
            className={`px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'drive' ? 'bg-[#D4AF37] text-black shadow' : 'text-[#888888] hover:text-white'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Google Drive</span>
          </button>
          <button
            onClick={() => setActiveSection('system')}
            className={`px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'system' ? 'bg-[#D4AF37] text-black shadow' : 'text-[#888888] hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>AI & Hệ Thống</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: TELEGRAM BOT CONFIGURATION */}
      {/* ======================================================== */}
      {(activeSection === 'all' || activeSection === 'telegram') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2">
            <div className="flex items-center gap-2 text-[#D4AF37]">
              <Bot className="w-5 h-5" />
              <h2 className="text-base font-editorial-serif font-bold text-white tracking-wide">
                1. Cấu Hình Telegram Bot (2-Way Interactive Bot)
              </h2>
            </div>
            <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              Webhook & Voice Ready
            </span>
          </div>

          {/* Quick Guide to Create Bot */}
          <div className="bg-[#151515] border border-[#2A2A2A] p-4 rounded-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-bold uppercase tracking-wider">
                <HelpCircle className="w-4 h-4" />
                <span>Hướng dẫn 4 bước tạo Bot Telegram riêng miễn phí</span>
              </div>
              <button
                onClick={() => setShowCreateBotGuide(!showCreateBotGuide)}
                className="text-xs bg-[#1A1A1A] hover:bg-[#252525] text-[#D4AF37] px-2.5 py-1 rounded border border-[#D4AF37]/30 transition-colors cursor-pointer font-bold"
              >
                {showCreateBotGuide ? '▲ Ẩn Hướng Dẫn' : '➕ Xem 4 Bước Tạo Bot (@BotFather)'}
              </button>
            </div>

            {showCreateBotGuide && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[11px] pt-2 animate-in fade-in">
                <div className="p-3 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm space-y-1">
                  <span className="font-bold text-[#D4AF37] uppercase">Bước 1: Tìm @BotFather</span>
                  <p className="text-[#CCCCCC]">Mở Telegram ➔ Tìm kiếm <strong>@BotFather</strong> (tích xanh) ➔ Bấm <strong>Start</strong>.</p>
                </div>
                <div className="p-3 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm space-y-1">
                  <span className="font-bold text-[#D4AF37] uppercase">Bước 2: Gõ /newbot</span>
                  <p className="text-[#CCCCCC]">Đặt tên hiển thị và đặt username kết thúc bằng chữ <code className="bg-black text-[#D4AF37] px-1 font-mono">bot</code>.</p>
                </div>
                <div className="p-3 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm space-y-1">
                  <span className="font-bold text-[#D4AF37] uppercase">Bước 3: Sao Chép Token</span>
                  <p className="text-[#CCCCCC]">BotFather trả về API Token (dạng <code className="bg-black text-[#D4AF37] px-1 font-mono">789...:AAH...</code>). Hãy copy chuỗi này.</p>
                </div>
                <div className="p-3 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm space-y-1">
                  <span className="font-bold text-[#D4AF37] uppercase">Bước 4: Dán & Kích Hoạt</span>
                  <p className="text-[#CCCCCC]">Dán Token vào ô bên dưới ➔ Bấm <strong>Lưu Cấu Hình</strong> ➔ Bấm <strong>Kích Hoạt Webhook</strong>.</p>
                </div>
              </div>
            )}
          </div>

          {/* Telegram Settings Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Form Column (7 cols) */}
            <div className="lg:col-span-7 bg-[#151515] border border-[#2A2A2A] p-5 rounded-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#D4AF37]" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Thông Số Kết Nối Bot</h3>
                </div>
                {telegramSavedSuccess && (
                  <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 animate-in fade-in">
                    <Check className="w-3.5 h-3.5" /> Đã lưu thành công!
                  </span>
                )}
              </div>

              <form onSubmit={handleSaveTelegramConfig} className="space-y-4 text-xs">
                {/* Bot Token Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[#AAAAAA] font-bold uppercase tracking-wider text-[10px]">
                      Telegram Bot Token (từ @BotFather)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="text-[10px] text-[#888888] hover:text-[#D4AF37] flex items-center gap-1 cursor-pointer"
                    >
                      {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showToken ? 'Ẩn Token' : 'Hiện Token'}</span>
                    </button>
                  </div>
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Ví dụ: 7891234560:AAH8xY_demo_token..."
                    className="w-full p-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] font-mono text-xs focus:outline-none focus:border-[#D4AF37]"
                  />
                  <p className="text-[11px] text-[#666666] mt-1 italic">
                    Token dùng để gửi nhắc nhở deadline, báo cáo sáng/tối và nhận lệnh tin nhắn thoại từ Telegram.
                  </p>
                </div>

                {/* Chat ID Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[#AAAAAA] font-bold uppercase tracking-wider text-[10px]">
                      Telegram Chat ID / User ID
                    </label>
                    <span className="text-[10px] text-[#D4AF37] font-medium">✨ Tự động nhận diện khi nhắn tin cho Bot</span>
                  </div>
                  <input
                    type="text"
                    value={chatIdInput}
                    onChange={(e) => setChatIdInput(e.target.value)}
                    placeholder="Ví dụ: 5786910216 (Hệ thống sẽ tự động cập nhật khi bạn nhắn /start)"
                    className="w-full p-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] font-mono text-xs focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                {/* Múi Giờ & Đồng Hồ Thực Tế */}
                <div className="p-3 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[#D4AF37] font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Múi Giờ Điểm Tin & Nhắc Việc
                    </label>
                    <span className="text-[10px] bg-[#1A1A1A] text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded font-mono font-bold">
                      🕒 Giờ VN hiện tại: {currentVnClock}
                    </span>
                  </div>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full p-2 bg-[#151515] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] text-xs focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (GMT+7 - Giờ Việt Nam) [Khuyên dùng]</option>
                    <option value="Asia/Bangkok">Asia/Bangkok (GMT+7)</option>
                    <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (GMT+9)</option>
                    <option value="UTC">UTC (GMT+0)</option>
                  </select>
                  <p className="text-[10px] text-[#888888] italic">
                    Hệ thống sẽ đồng bộ lịch điểm tin sáng/tối chính xác theo múi giờ này, không phụ thuộc vào giờ của máy chủ cloud.
                  </p>
                </div>

                {/* Khung giờ Điểm tin Buổi Sáng & Báo cáo Buổi Tối */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm">
                  {/* Morning Briefing Schedule */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-amber-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                        <Sun className="w-3 h-3" />
                        Điểm Tin Buổi Sáng
                      </label>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enableMorningBriefing}
                          onChange={(e) => setEnableMorningBriefing(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-7 h-4 bg-[#2A2A2A] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                      </label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={morningHour}
                        disabled={!enableMorningBriefing}
                        onChange={(e) => setMorningHour(Number(e.target.value))}
                        className="flex-1 p-1.5 bg-[#151515] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] text-xs focus:outline-none focus:border-[#D4AF37] disabled:opacity-40"
                      >
                        {Array.from({ length: 24 }).map((_, h) => (
                          <option key={h} value={h}>
                            {h.toString().padStart(2, '0')}:00 {h < 12 ? 'AM' : 'PM'}
                          </option>
                        ))}
                      </select>
                      <select
                        value={morningMinute}
                        disabled={!enableMorningBriefing}
                        onChange={(e) => setMorningMinute(Number(e.target.value))}
                        className="w-16 p-1.5 bg-[#151515] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] text-xs focus:outline-none focus:border-[#D4AF37] disabled:opacity-40"
                      >
                        <option value={0}>00p</option>
                        <option value={15}>15p</option>
                        <option value={30}>30p</option>
                        <option value={45}>45p</option>
                      </select>
                    </div>
                    <p className="text-[10px] text-[#666666]">
                      {enableMorningBriefing ? `Tự động gửi lúc ${morningHour.toString().padStart(2, '0')}:${morningMinute.toString().padStart(2, '0')} sáng VN` : 'Đang tắt'}
                    </p>
                  </div>

                  {/* Evening Briefing Schedule */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-indigo-300 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                        <Moon className="w-3 h-3" />
                        Báo Cáo Buổi Tối
                      </label>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enableEveningBriefing}
                          onChange={(e) => setEnableEveningBriefing(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-7 h-4 bg-[#2A2A2A] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                      </label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={eveningHour}
                        disabled={!enableEveningBriefing}
                        onChange={(e) => setEveningHour(Number(e.target.value))}
                        className="flex-1 p-1.5 bg-[#151515] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] text-xs focus:outline-none focus:border-[#D4AF37] disabled:opacity-40"
                      >
                        {Array.from({ length: 24 }).map((_, h) => (
                          <option key={h} value={h}>
                            {h.toString().padStart(2, '0')}:00 {h < 12 ? 'AM' : 'PM'}
                          </option>
                        ))}
                      </select>
                      <select
                        value={eveningMinute}
                        disabled={!enableEveningBriefing}
                        onChange={(e) => setEveningMinute(Number(e.target.value))}
                        className="w-16 p-1.5 bg-[#151515] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] text-xs focus:outline-none focus:border-[#D4AF37] disabled:opacity-40"
                      >
                        <option value={0}>00p</option>
                        <option value={15}>15p</option>
                        <option value={30}>30p</option>
                        <option value={45}>45p</option>
                      </select>
                    </div>
                    <p className="text-[10px] text-[#666666]">
                      {enableEveningBriefing ? `Tự động gửi lúc ${eveningHour.toString().padStart(2, '0')}:${eveningMinute.toString().padStart(2, '0')} tối VN` : 'Đang tắt'}
                    </p>
                  </div>
                </div>

                {/* Reminder Timing */}
                <div>
                  <label className="block text-[#AAAAAA] font-bold uppercase tracking-wider text-[10px] mb-1">
                    Cảnh Báo Trước Deadline (Phút)
                  </label>
                  <select
                    value={alertOffset}
                    onChange={(e) => setAlertOffset(Number(e.target.value))}
                    className="w-full p-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] text-xs focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value={10}>10 phút trước deadline</option>
                    <option value={15}>15 phút trước deadline (Khuyên dùng)</option>
                    <option value={30}>30 phút trước deadline</option>
                    <option value={60}>1 giờ trước deadline</option>
                    <option value={120}>2 giờ trước deadline</option>
                  </select>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-sm bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer shadow-md"
                  >
                    Lưu Cấu Hình Telegram
                  </button>
                </div>
              </form>
            </div>

            {/* Webhook & Test Column (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              {/* Webhook Controller */}
              <div className="bg-[#151515] border border-[#2A2A2A] p-5 rounded-sm space-y-3">
                <div className="flex items-center gap-2 border-b border-[#2A2A2A] pb-2">
                  <Link2 className="w-4 h-4 text-[#D4AF37]" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Đường Dẫn Webhook Telegram</h3>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 bg-[#0C0C0C] p-2 rounded-sm border border-[#2A2A2A]">
                    <input
                      type="text"
                      readOnly
                      value={webhookUrl}
                      className="bg-transparent text-[11px] font-mono text-[#AAAAAA] w-full focus:outline-none truncate"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(webhookUrl);
                        setCopiedWebhook(true);
                        setTimeout(() => setCopiedWebhook(false), 2000);
                      }}
                      title="Sao chép Webhook URL"
                      className="p-1 hover:text-[#D4AF37] text-[#888888] transition-colors cursor-pointer shrink-0"
                    >
                      {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={handleSetWebhook}
                      disabled={isActivatingWebhook}
                      className="py-2 px-2 rounded-sm bg-[#1A1A1A] hover:bg-[#D4AF37] hover:text-black text-[#D4AF37] border border-[#D4AF37]/40 font-bold uppercase tracking-wider text-[10px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isActivatingWebhook ? 'Đang kích hoạt...' : 'Kích Hoạt Webhook'}</span>
                    </button>

                    <button
                      onClick={handleCheckWebhookInfo}
                      disabled={isCheckingWebhookInfo}
                      className="py-2 px-2 rounded-sm bg-[#1A1A1A] hover:bg-white hover:text-black text-white border border-[#2A2A2A] font-bold uppercase tracking-wider text-[10px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>{isCheckingWebhookInfo ? 'Đang tra...' : 'Kiểm Tra Webhook'}</span>
                    </button>
                  </div>

                  {webhookStatus && (
                    <div className="text-xs p-2.5 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] font-medium leading-relaxed animate-in fade-in">
                      {webhookStatus}
                    </div>
                  )}

                  {webhookInfo && (
                    <div className="p-2.5 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] space-y-1 text-[11px] font-mono animate-in fade-in">
                      <div className="font-bold text-[#D4AF37] uppercase">📊 Trạng thái từ Telegram Server:</div>
                      <div className="text-[#CCCCCC] truncate">URL: {webhookInfo.url || 'Chưa liên kết'}</div>
                      <div className="text-[#CCCCCC]">Pending Updates: {webhookInfo.pending_update_count ?? 0}</div>
                      {webhookInfo.last_error_message && (
                        <div className="text-rose-400 font-sans mt-1">⚠️ {webhookInfo.last_error_message}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Test Alert Sender */}
              <div className="bg-[#151515] border border-[#2A2A2A] p-5 rounded-sm space-y-3">
                <div className="flex items-center gap-2 border-b border-[#2A2A2A] pb-2">
                  <Zap className="w-4 h-4 text-[#D4AF37]" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Gửi Thông Báo Thử Nghiệm</h3>
                </div>

                <div className="space-y-2 text-xs">
                  <textarea
                    value={testMessageText}
                    onChange={(e) => setTestMessageText(e.target.value)}
                    rows={2}
                    className="w-full p-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-xs text-[#E0E0E0] focus:outline-none focus:border-[#D4AF37]"
                  />
                  <button
                    onClick={() => onSendTestTelegramMessage(testMessageText)}
                    className="w-full py-2 rounded-sm bg-[#1A1A1A] hover:bg-[#D4AF37] hover:text-black text-[#D4AF37] border border-[#D4AF37]/40 font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Bắn Tin Thử Tới Telegram</span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* SECTION 2: GOOGLE DRIVE CONFIGURATION */}
      {/* ======================================================== */}
      {(activeSection === 'all' || activeSection === 'drive') && (
        <section className="space-y-6 pt-4">
          <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2">
            <div className="flex items-center gap-2 text-[#D4AF37]">
              <HardDrive className="w-5 h-5" />
              <h2 className="text-base font-editorial-serif font-bold text-white tracking-wide">
                2. Cấu Hình Google Drive & Thư Mục Cố Định Cho Mọi Máy Tính
              </h2>
            </div>
            <span className="text-[11px] text-[#D4AF37] font-mono px-2.5 py-0.5 rounded bg-[#D4AF37]/10 border border-[#D4AF37]/30">
              Server-Side Service Account + Client OAuth
            </span>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* METHOD 1: GOOGLE SERVICE ACCOUNT (SERVER-SIDE MULTI-DEVICE) */}
          {/* ------------------------------------------------------------- */}
          <div className="bg-[#151515] border border-[#D4AF37]/50 rounded-sm p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37]">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Google Service Account (Tài Khoản Dịch Vụ - Tối Ưu Nhất)
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono font-bold border border-emerald-800">
                      Khuyên Dùng
                    </span>
                  </div>
                  <p className="text-xs text-[#AAAAAA] mt-0.5">
                    Cố định 1 thư mục duy nhất trên Google Drive cho <strong className="text-[#D4AF37]">mọi máy tính</strong> mà không cần người dùng phải đăng nhập Google.
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span className={`text-[11px] px-2.5 py-1 rounded font-mono font-bold flex items-center gap-1.5 ${
                  saConfig.isConnected
                    ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-700'
                    : 'bg-[#0C0C0C] text-[#888888] border border-[#2A2A2A]'
                }`}>
                  {saConfig.isConnected ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Đã Kết Nối Thư Mục: {saConfig.folderName || 'Drive Folder'}</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Chưa Kết Nối</span>
                    </>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setShowSaGuide(!showSaGuide)}
                  className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer ml-1"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{showSaGuide ? 'Ẩn Hướng Dẫn' : 'Xem Hướng Dẫn 4 Bước'}</span>
                </button>
              </div>
            </div>

            {/* Guide Step-by-Step Box */}
            {showSaGuide && (
              <div className="p-4 bg-[#0C0C0C] border border-[#D4AF37]/30 rounded-sm space-y-3 animate-in fade-in">
                <div className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>Hướng dẫn thiết lập Google Service Account trong 2 phút:</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-[11px] text-[#CCCCCC]">
                  <div className="p-2.5 bg-[#151515] border border-[#2A2A2A] rounded space-y-1">
                    <div className="font-bold text-[#D4AF37]">Bước 1: Tạo Service Account</div>
                    <p className="text-[#AAAAAA]">
                      Vào <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noreferrer" className="text-[#D4AF37] underline">GCP Service Accounts <ExternalLink className="w-2.5 h-2.5 inline" /></a> ➔ Bấm <strong>Create Service Account</strong> (Đặt tên tùy ý, ví dụ: <code>drive-bot</code>).
                    </p>
                  </div>
                  <div className="p-2.5 bg-[#151515] border border-[#2A2A2A] rounded space-y-1">
                    <div className="font-bold text-[#D4AF37]">Bước 2: Bật Google Drive API</div>
                    <p className="text-[#AAAAAA]">
                      Vào <a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noreferrer" className="text-[#D4AF37] underline">Google Drive API <ExternalLink className="w-2.5 h-2.5 inline" /></a> ➔ Bấm <strong>Enable (Bật)</strong>.
                    </p>
                  </div>
                  <div className="p-2.5 bg-[#151515] border border-[#2A2A2A] rounded space-y-1">
                    <div className="font-bold text-[#D4AF37]">Bước 3: Tải Key JSON</div>
                    <p className="text-[#AAAAAA]">
                      Chọn Service Account vừa tạo ➔ Tab <strong>Keys</strong> ➔ <strong>Add Key ➔ Create new key (JSON)</strong> ➔ Tải file về máy.
                    </p>
                  </div>
                  <div className="p-2.5 bg-[#151515] border border-[#2A2A2A] rounded space-y-1">
                    <div className="font-bold text-[#D4AF37]">Bước 4: Share Thư Mục Drive</div>
                    <p className="text-[#AAAAAA]">
                      Mở Google Drive cá nhân ➔ Chuột phải vào Thư mục cần dùng ➔ Chọn <strong>Chia sẻ (Share)</strong> ➔ Dán email Service Account vào với quyền <strong>Người chỉnh sửa (Editor)</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Success & Error alerts */}
            {saSuccessMsg && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-600/80 rounded text-xs text-emerald-300 font-bold flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{saSuccessMsg}</span>
                </div>
                <button onClick={() => setSaSuccessMsg(null)} className="text-xs text-emerald-400 hover:text-white">✕</button>
              </div>
            )}

            {saError && (
              <div className="p-3 bg-rose-950/60 border border-rose-700/80 rounded text-xs text-rose-300 font-bold flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{saError}</span>
                </div>
                <button onClick={() => setSaError(null)} className="text-xs text-rose-300 hover:text-white">✕</button>
              </div>
            )}

            {/* Service Account Form */}
            <div className="space-y-4">
              {/* Folder ID Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[#AAAAAA] font-bold uppercase tracking-wider text-[10px]">
                    Google Drive Folder ID (ID Thư mục cần cố định) <span className="text-[#D4AF37]">*</span>
                  </label>
                  <span className="text-[10px] text-[#888888]">
                    Lấy chuỗi sau <code className="text-[#D4AF37] font-mono font-bold">/folders/ID_Ở_ĐÂY</code> trên thanh URL trình duyệt
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={saFolderIdInput}
                    onChange={(e) => setSaFolderIdInput(e.target.value)}
                    placeholder="Ví dụ: 1a2B3c4D5e6F7g8H9i0JkLmNoPqRsTuVw"
                    className="flex-1 p-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] font-mono text-xs focus:outline-none focus:border-[#D4AF37]"
                  />
                  {saFolderIdInput && (
                    <a
                      href={`https://drive.google.com/drive/folders/${saFolderIdInput.trim()}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2.5 bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[#D4AF37] border border-[#2A2A2A] rounded-sm text-xs flex items-center gap-1 shrink-0"
                      title="Mở thư mục trên Google Drive"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Mở</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Mode Switch: JSON vs Manual */}
              <div className="flex items-center gap-3 border-b border-[#222222] pb-2">
                <button
                  type="button"
                  onClick={() => setSaInputMode('json')}
                  className={`text-xs font-bold pb-1 cursor-pointer transition-colors ${
                    saInputMode === 'json' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'text-[#888888] hover:text-white'
                  }`}
                >
                  📄 Dán Trực Tiếp File JSON Key Tải Về (Nhanh nhất)
                </button>
                <button
                  type="button"
                  onClick={() => setSaInputMode('manual')}
                  className={`text-xs font-bold pb-1 cursor-pointer transition-colors ${
                    saInputMode === 'manual' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'text-[#888888] hover:text-white'
                  }`}
                >
                  ✏️ Nhập Client Email & Private Key Riêng
                </button>
              </div>

              {saInputMode === 'json' ? (
                <div>
                  <label className="block text-[#AAAAAA] font-bold uppercase tracking-wider text-[10px] mb-1">
                    Nội dung File JSON Key Service Account:
                  </label>
                  <textarea
                    rows={4}
                    value={saJsonInput}
                    onChange={(e) => setSaJsonInput(e.target.value)}
                    placeholder='Mở file .json tải về từ Google Cloud, copy toàn bộ nội dung và dán vào đây (dạng: {"type": "service_account", "client_email": "...", "private_key": "..."})'
                    className="w-full p-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] font-mono text-xs focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#AAAAAA] font-bold uppercase tracking-wider text-[10px] mb-1">
                      Service Account Client Email
                    </label>
                    <input
                      type="text"
                      value={saEmailInput}
                      onChange={(e) => setSaEmailInput(e.target.value)}
                      placeholder="Ví dụ: drive-bot@project-id.iam.gserviceaccount.com"
                      className="w-full p-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] font-mono text-xs focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[#AAAAAA] font-bold uppercase tracking-wider text-[10px]">
                        Private Key (RSA PEM)
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowSaKey(!showSaKey)}
                        className="text-[10px] text-[#888888] hover:text-[#D4AF37] flex items-center gap-1"
                      >
                        {showSaKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{showSaKey ? 'Ẩn' : 'Hiện'}</span>
                      </button>
                    </div>
                    <input
                      type={showSaKey ? 'text' : 'password'}
                      value={saKeyInput}
                      onChange={(e) => setSaKeyInput(e.target.value)}
                      placeholder="-----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----"
                      className="w-full p-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] font-mono text-xs focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-[#2A2A2A]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestSaConnection}
                    disabled={isTestingSa || (!saFolderIdInput.trim() && !saConfig.folderId)}
                    className="py-2 px-4 rounded-sm bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[#D4AF37] border border-[#D4AF37]/50 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingSa ? 'animate-spin' : ''}`} />
                    <span>{isTestingSa ? 'Đang kiểm tra...' : '1. Kiểm Tra Kết Nối'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveSaConfig()}
                    disabled={isSavingSa}
                    className="py-2 px-4 rounded-sm bg-[#D4AF37] hover:bg-[#c29f2e] text-black text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSavingSa ? 'Đang lưu...' : '2. Lưu Cấu Hình'}</span>
                  </button>
                </div>

                {saConfig.isConnected && (
                  <button
                    type="button"
                    onClick={handleSyncSaFiles}
                    disabled={isSyncingSa}
                    className="py-2 px-4 rounded-sm bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 border border-emerald-600 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>{isSyncingSa ? 'Đang đồng bộ...' : 'Đồng Bộ Tệp Drive Ngay'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* METHOD 2: CLIENT GOOGLE OAUTH ACCOUNT (OPTIONAL) */}
          {/* ------------------------------------------------------------- */}
          <div className="pt-2">
            <div className="text-xs font-bold text-[#888888] uppercase tracking-wider mb-2">
              Tùy Chọn Khác: Đăng Nhập Tài Khoản Google Cá Nhân (Client-Side OAuth)
            </div>
          </div>

          {/* Drive Status Alert */}
          {driveStatusMsg && (
            <div className="p-3 rounded-sm bg-[#151515] border border-[#D4AF37] text-xs text-[#D4AF37] font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{driveStatusMsg}</span>
            </div>
          )}

          {/* Actionable Error Alert for Unauthorized Domain / Origin Mismatch */}
          {(isUnauthorizedDomain || driveAuthError?.includes('origin_mismatch') || driveAuthError?.includes('400')) && (
            <div className="p-4 rounded-sm bg-[#181111] border border-rose-600/80 space-y-3 animate-in fade-in shadow-lg">
              <div className="flex items-center justify-between border-b border-rose-800/40 pb-2">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Khắc Phục Lỗi Google OAuth (origin_mismatch / unauthorized-domain)</span>
                </div>
                <button
                  onClick={() => setDriveAuthError(null)}
                  className="text-xs text-[#888888] hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-[#E0E0E0] leading-relaxed">
                Google bảo mật OAuth bằng cách chỉ cho phép ứng dụng đã khai báo đúng <strong>JavaScript Origin</strong> hoặc sử dụng <strong>Access Token</strong> trực tiếp. Chọn 1 trong 2 cách giải quyết nhanh nhất bên dưới:
              </p>

              {/* Quick Choice Box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                
                {/* Method A: OAuth Playground Token (Fastest, 30 seconds, 100% works) */}
                <div className="p-3 bg-[#0C0C0C] border border-[#D4AF37]/50 rounded-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#D4AF37] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Cách 1: Lấy Token Nhanh (100% Thành Công)
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono">Khuyên Dùng</span>
                  </div>
                  <p className="text-[11px] text-[#AAAAAA]">
                    Lấy Access Token từ trang chính thức của Google trong 30 giây:
                  </p>
                  <ol className="text-[11px] text-[#CCCCCC] list-decimal list-inside space-y-1">
                    <li>Mở <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noreferrer" className="text-[#D4AF37] hover:underline font-bold inline-flex items-center gap-0.5">Google OAuth Playground <ExternalLink className="w-2.5 h-2.5 inline" /></a></li>
                    <li>Tìm <strong>Drive API v3</strong> ➔ tích chọn <code className="text-[#D4AF37] text-[10px]">.../auth/drive.file</code></li>
                    <li>Bấm <strong>Authorize APIs</strong> ➔ Đăng nhập tài khoản của bạn</li>
                    <li>Bấm <strong>Exchange authorization code for tokens</strong></li>
                    <li>Copy chuỗi <strong>Access token</strong> dán vào nút bên dưới:</li>
                  </ol>
                  <button
                    type="button"
                    onClick={() => { setShowManualTokenInput(true); setShowClientIdInput(false); }}
                    className="w-full py-1.5 bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold text-xs rounded-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 mt-2"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Dán Access Token & Kết Nối Ngay</span>
                  </button>
                </div>

                {/* Method B: Own Client ID (Standard Google button) */}
                <div className="p-3 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-[#AAAAAA]" />
                      Cách 2: Cấu Hình Client ID Cá Nhân
                    </span>
                  </div>
                  <p className="text-[11px] text-[#AAAAAA]">
                    Tạo Google OAuth Client ID của riêng bạn trên Google Cloud để nút Đăng Nhập hoạt động mãi mãi:
                  </p>
                  <div className="flex items-center justify-between bg-[#151515] p-1.5 rounded border border-[#222222]">
                    <span className="text-[11px] text-[#888888]">Origin cần thêm:</span>
                    <div className="flex items-center gap-1">
                      <code className="text-[#D4AF37] font-mono text-[10px] font-bold truncate max-w-[150px]">{currentOrigin}</code>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(currentOrigin);
                          setCopiedOrigin(true);
                          setTimeout(() => setCopiedOrigin(false), 2000);
                        }}
                        className="p-1 text-[#888888] hover:text-white"
                        title="Sao chép Origin"
                      >
                        {copiedOrigin ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowClientIdInput(true); setShowManualTokenInput(false); }}
                    className="w-full py-1.5 bg-[#1A1A1A] hover:bg-[#252525] text-white border border-[#333333] font-bold text-xs rounded-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 mt-2"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Nhập Client ID Tùy Chỉnh</span>
                  </button>
                </div>

              </div>
            </div>
          )}

          {driveAuthError && !isUnauthorizedDomain && !driveAuthError?.includes('origin_mismatch') && !driveAuthError?.includes('400') && (
            <div className="p-3 rounded-sm bg-rose-950/40 border border-rose-800 text-xs text-rose-300 font-medium flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{driveAuthError}</span>
              </div>
              <button onClick={() => setDriveAuthError(null)} className="text-xs hover:text-white cursor-pointer">✕</button>
            </div>
          )}

          {/* Client ID Customization Drawer */}
          {showClientIdInput && (
            <form onSubmit={handleSaveClientId} className="p-4 bg-[#151515] border border-[#D4AF37]/50 rounded-sm space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-bold uppercase tracking-wider">
                  <Settings className="w-4 h-4" />
                  <span>Cấu Hình Google OAuth Client ID Riêng</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowClientIdInput(false)}
                  className="text-xs text-[#888888] hover:text-white cursor-pointer"
                >
                  ✕ Đóng
                </button>
              </div>

              <div className="text-[11px] text-[#CCCCCC] space-y-1.5 bg-[#0C0C0C] p-3 rounded border border-[#222222]">
                <div>1. Mở <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-[#D4AF37] hover:underline font-bold inline-flex items-center gap-0.5">Google Cloud Credentials <ExternalLink className="w-2.5 h-2.5 inline" /></a> ➔ Bấm <strong>Create Credentials (Tạo thông tin xác thực)</strong> ➔ <strong>OAuth client ID</strong>.</div>
                <div>2. Application type chọn <strong>Web application</strong>.</div>
                <div>3. Tại mục <strong>Authorized JavaScript origins</strong>, thêm: <code className="text-[#D4AF37] bg-[#1A1A1A] px-1 font-mono">{currentOrigin}</code></div>
                <div>4. Bấm <strong>Create</strong> rồi sao chép mã <strong>Client ID</strong> dán vào ô bên dưới:</div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={clientIdInput}
                  onChange={(e) => setClientIdInput(e.target.value)}
                  placeholder="Ví dụ: 123456789-abcdef.apps.googleusercontent.com"
                  className="flex-1 p-2 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-xs text-[#E0E0E0] font-mono focus:outline-none focus:border-[#D4AF37]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold text-xs rounded-sm transition-colors cursor-pointer"
                >
                  Lưu Client ID
                </button>
              </div>
            </form>
          )}

          {/* Manual Token Drawer */}
          {showManualTokenInput && (
            <form onSubmit={handleManualTokenSubmit} className="p-4 bg-[#151515] border border-[#D4AF37]/50 rounded-sm space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-bold uppercase tracking-wider">
                  <Key className="w-4 h-4" />
                  <span>Dán Google OAuth Access Token</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowManualTokenInput(false)}
                  className="text-xs text-[#888888] hover:text-white cursor-pointer"
                >
                  ✕ Đóng
                </button>
              </div>
              <p className="text-[11px] text-[#888888]">
                Dán chuỗi Access Token (bắt đầu bằng <code className="text-[#D4AF37] font-mono">ya29...</code>) lấy từ <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noreferrer" className="text-[#D4AF37] hover:underline inline-flex items-center gap-0.5">Google OAuth Playground <ExternalLink className="w-2.5 h-2.5 inline" /></a>:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Dán token dạng: ya29.a0AcM6123..."
                  className="flex-1 p-2 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-xs text-[#E0E0E0] font-mono focus:outline-none focus:border-[#D4AF37]"
                />
                <button
                  type="submit"
                  disabled={isSubmittingManualToken || !manualToken.trim()}
                  className="px-4 py-2 bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold text-xs rounded-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingManualToken ? 'Đang kiểm tra...' : 'Xác Thực & Kết Nối'}
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Account & OAuth Auth Card (5 cols) */}
            <div className="lg:col-span-5 bg-[#151515] border border-[#2A2A2A] p-5 rounded-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Tài Khoản Google OAuth</h3>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                    googleUser ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60' : 'bg-[#0C0C0C] text-[#888888] border border-[#2A2A2A]'
                  }`}>
                    {googleUser ? 'Đã Kết Nối' : 'Chưa Kết Nối'}
                  </span>
                </div>

                {googleUser ? (
                  <div className="p-4 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm space-y-3">
                    <div className="flex items-center gap-3">
                      {googleUser.photoURL ? (
                        <img src={googleUser.photoURL} alt={googleUser.displayName || 'User'} className="w-10 h-10 rounded-full border border-[#D4AF37]/50" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#D4AF37] text-black font-bold flex items-center justify-center text-sm">
                          {googleUser.email?.charAt(0).toUpperCase() || 'G'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{googleUser.displayName || 'Google User'}</div>
                        <div className="text-[11px] text-[#888888] font-mono truncate">{googleUser.email}</div>
                      </div>
                    </div>

                    <div className="text-[11px] text-[#AAAAAA] space-y-1 pt-2 border-t border-[#2A2A2A]">
                      <div className="flex items-center justify-between">
                        <span>Quyền hạn:</span>
                        <span className="text-[#D4AF37] font-mono">drive.file (Cách ly an toàn)</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Trạng thái Access Token:</span>
                        <span className="text-emerald-400 font-mono">Đã lưu & Sẵn sàng</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-[#0C0C0C] border border-dashed border-[#2A2A2A] rounded-sm text-center space-y-2">
                    <HardDrive className="w-8 h-8 text-[#666666] mx-auto" />
                    <p className="text-xs text-[#AAAAAA]">
                      Chưa kết nối tài khoản Google. Hãy đăng nhập để lưu trữ tài liệu trực tiếp vào Google Drive.
                    </p>
                  </div>
                )}
              </div>

              {/* Login / Logout Action Button */}
              <div className="pt-2 space-y-2">
                {googleUser ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleGoogleLogin}
                      disabled={isAuthenticating}
                      className="py-2 px-3 rounded-sm bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[#D4AF37] border border-[#D4AF37]/40 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      title="Gia hạn Access Token khi hết hạn"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Gia Hạn Token</span>
                    </button>
                    <button
                      onClick={handleGoogleLogout}
                      className="py-2 px-3 rounded-sm bg-[#0C0C0C] hover:bg-rose-950 text-rose-400 border border-rose-800/60 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Đăng Xuất</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={handleGoogleLogin}
                      disabled={isAuthenticating}
                      className="w-full py-2.5 px-4 rounded-sm bg-white hover:bg-neutral-100 text-neutral-900 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow cursor-pointer"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                      </svg>
                      <span>{isAuthenticating ? 'Đang kết nối...' : 'Đăng Nhập Tài Khoản Google'}</span>
                    </button>

                    <div className="flex items-center justify-between gap-1 pt-1 flex-wrap text-[11px]">
                      <button
                        type="button"
                        onClick={handleDirectGISLogin}
                        disabled={isAuthenticating}
                        className="text-[#888888] hover:text-[#D4AF37] underline cursor-pointer flex items-center gap-1"
                      >
                        <span>⚡ Đăng nhập GIS</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setShowClientIdInput(!showClientIdInput); setShowManualTokenInput(false); }}
                        className="text-[#D4AF37] font-semibold hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Settings className="w-3 h-3 text-[#D4AF37]" />
                        <span>⚙️ Nhập Client ID</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setShowManualTokenInput(!showManualTokenInput); setShowClientIdInput(false); }}
                        className="text-[#888888] hover:text-[#D4AF37] underline cursor-pointer flex items-center gap-1"
                      >
                        <Key className="w-3 h-3" />
                        <span>Nhập Token</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Dedicated Folder Settings Card (7 cols) */}
            <div className="lg:col-span-7 bg-[#151515] border border-[#2A2A2A] p-5 rounded-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-[#D4AF37]" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Cấu Hình Thư Mục Chuyên Biệt</h3>
                </div>
                {appFolder?.webViewLink && (
                  <a
                    href={appFolder.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#D4AF37] hover:underline flex items-center gap-1"
                  >
                    <span>Mở Folder trên Drive</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <form onSubmit={handleSaveAppFolder} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[#AAAAAA] font-bold uppercase tracking-wider text-[10px] mb-1">
                    Tên thư mục lưu trữ trên Google Drive:
                  </label>
                  <input
                    type="text"
                    value={customFolderName}
                    onChange={(e) => setCustomFolderName(e.target.value)}
                    placeholder="Ví dụ: AI Assistant Documents"
                    className="w-full p-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] font-mono text-xs focus:outline-none focus:border-[#D4AF37]"
                  />
                  <p className="text-[11px] text-[#666666] mt-1.5 italic">
                    Ứng dụng sẽ tự động tạo hoặc tìm thư mục này trên Drive của bạn để lưu toàn bộ tệp tài liệu một cách riêng biệt và độc lập.
                  </p>
                </div>

                {/* Storage Scope Notice */}
                <div className="p-3 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm space-y-1.5 text-[11px]">
                  <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Nguyên lý Cách Ly Tuyệt Đối (Single-Folder Scope):</span>
                  </div>
                  <p className="text-[#AAAAAA] leading-relaxed">
                    • Mọi tệp tải lên hoặc đồng bộ chỉ lưu vào thư mục này (`parents: [folderId]`).<br />
                    • Hệ thống không đọc, không quét và không thay đổi bất kỳ tệp cá nhân nào khác ngoài thư mục trên Google Drive của bạn.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={isSavingFolder}
                    className="px-4 py-2 rounded-sm bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isSavingFolder ? 'Đang Lưu...' : 'Lưu Tên Thư Mục'}
                  </button>

                  {localOnlyCount > 0 && googleUser && (
                    <button
                      type="button"
                      onClick={handleSyncAllLocalFiles}
                      disabled={isSyncingAll}
                      className="px-3 py-2 rounded-sm bg-[#1A1A1A] hover:bg-[#252525] text-emerald-400 border border-emerald-500/40 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      <span>Đẩy {localOnlyCount} tệp cục bộ vào Folder</span>
                    </button>
                  )}
                </div>
              </form>

              {/* Statistics */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#2A2A2A] text-center text-xs">
                <div className="p-2 bg-[#0C0C0C] rounded border border-[#2A2A2A]">
                  <span className="text-[10px] text-[#666666] uppercase block">Dung lượng</span>
                  <span className="font-bold text-white">{totalMb} MB</span>
                </div>
                <div className="p-2 bg-[#0C0C0C] rounded border border-[#2A2A2A]">
                  <span className="text-[10px] text-[#666666] uppercase block">Đã vào Drive</span>
                  <span className="font-bold text-emerald-400">{syncedCount} tệp</span>
                </div>
                <div className="p-2 bg-[#0C0C0C] rounded border border-[#2A2A2A]">
                  <span className="text-[10px] text-[#666666] uppercase block">Chưa đồng bộ</span>
                  <span className="font-bold text-amber-400">{localOnlyCount} tệp</span>
                </div>
              </div>

            </div>

          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* SECTION 3: SYSTEM & AI ENGINE CONFIGURATION */}
      {/* ======================================================== */}
      {(activeSection === 'all' || activeSection === 'system') && (
        <section className="space-y-4 pt-4">
          <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2">
            <div className="flex items-center gap-2 text-[#D4AF37]">
              <Cpu className="w-5 h-5" />
              <h2 className="text-base font-editorial-serif font-bold text-white tracking-wide">
                3. Cấu Hình AI Model & Tự Động Hóa Hệ Thống
              </h2>
            </div>
            <span className="text-[11px] text-amber-400 font-mono">
              Gemini 2.5 & 3.7 Multimodal
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* AI Engine Status */}
            <div className="p-4 bg-[#151515] border border-[#2A2A2A] rounded-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                  Mô Hình AI Cốt Lõi
                </span>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/40">
                  Active
                </span>
              </div>
              <p className="text-[#AAAAAA] text-[11px]">
                Sử dụng <strong>Gemini 2.5 Flash</strong> cho AI Chat, tóm tắt ghi chú và trích xuất thông tin.
              </p>
              <div className="text-[10px] font-mono text-[#666666]">SDK: @google/genai</div>
            </div>

            {/* Google Search Grounding */}
            <div className="p-4 bg-[#151515] border border-[#2A2A2A] rounded-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-[#D4AF37]" />
                  Google Search Grounding
                </span>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/40">
                  Enabled
                </span>
              </div>
              <p className="text-[#AAAAAA] text-[11px]">
                Tự động tra cứu Google Search thời gian thực khi được hỏi về thời tiết, tin tức, lịch trình hiện hành.
              </p>
              <div className="text-[10px] font-mono text-[#666666]">Grounding: Google Search Tool</div>
            </div>

            {/* Cron Deadline Scheduler */}
            <div className="p-4 bg-[#151515] border border-[#2A2A2A] rounded-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#D4AF37]" />
                  Quét Deadline Định Kỳ
                </span>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/40">
                  Mỗi 30 giây
                </span>
              </div>
              <p className="text-[#AAAAAA] text-[11px]">
                Tiến trình nền tự động tính toán khoảng cách deadline và gửi cảnh báo tự động qua Telegram Bot.
              </p>
              <div className="text-[10px] font-mono text-[#666666]">Anti-duplicate Check: Enabled</div>
            </div>
          </div>
        </section>
      )}

    </div>
  );
};
