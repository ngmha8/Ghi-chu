import React, { useState, useEffect } from 'react';
import { TelegramConfig, DriveFile, DriveServiceAccountConfig } from '../types/index.js';
import { api } from '../services/api.js';
import {
  initGoogleAuth,
  signInWithGoogleWorkspace,
  googleSignOut,
  GoogleOAuthUser,
} from '../services/googleAuth.js';
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
  Moon,
  Lock,
  Unlock,
  ShieldAlert
} from 'lucide-react';
import {
  getPinSettings,
  fetchPinSettingsFromServer,
  setPin,
  setPinEnabled,
  setAutolockMinutes,
  verifyPin,
  verifyPinAsync,
  DEFAULT_PIN,
  lockSession,
  PinSettings
} from '../services/pinSecurity.js';

interface SettingsViewProps {
  telegramConfig: TelegramConfig;
  onUpdateTelegramConfig: (config: Partial<TelegramConfig>) => void;
  onSendTestTelegramMessage: (message?: string) => void;
  files: DriveFile[];
  onFileUpdate?: (id: string, fileData: Partial<DriveFile>) => void;
  onLockApp?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  telegramConfig,
  onUpdateTelegramConfig,
  onSendTestTelegramMessage,
  files,
  onFileUpdate,
  onLockApp
}) => {
  const [activeSection, setActiveSection] = useState<'all' | 'telegram' | 'drive' | 'security' | 'system'>('all');

  // --- PIN Security State ---
  const [pinSettings, setPinSettingsState] = useState<PinSettings>(() => getPinSettings());
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinHintInput, setPinHintInput] = useState(pinSettings.hint || '');
  const [showPinSecrets, setShowPinSecrets] = useState(false);
  const [pinStatusMsg, setPinStatusMsg] = useState<string | null>(null);
  const [pinErrorMsg, setPinErrorMsg] = useState<string | null>(null);
  const [isChangingPin, setIsChangingPin] = useState(false);

  // Sync PIN settings from central server on mount
  useEffect(() => {
    fetchPinSettingsFromServer()
      .then(s => {
        setPinSettingsState(s);
        if (s.hint) setPinHintInput(s.hint);
      })
      .catch(() => {});
  }, []);

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
  const [copiedWebhook, setCopiedWebhook] = useState(false);

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

  // --- Service Account (Multi-Device Fixed Folder) State ---
  const [saConfig, setSaConfig] = useState<DriveServiceAccountConfig>({
    clientEmail: '',
    privateKey: '',
    folderId: localStorage.getItem('app_sa_folder_id') || '',
    isEnabled: true,
    isConnected: false,
  });
  const [saEmailInput, setSaEmailInput] = useState('');
  const [saKeyInput, setSaKeyInput] = useState('');
  const [saFolderIdInput, setSaFolderIdInput] = useState(localStorage.getItem('app_sa_folder_id') || '');
  const [saJsonInput, setSaJsonInput] = useState('');
  const [saInputMode, setSaInputMode] = useState<'json' | 'manual'>('json');
  const [isEditingSaConfig, setIsEditingSaConfig] = useState(false);
  const [isTestingSa, setIsTestingSa] = useState(false);
  const [isSyncingSa, setIsSyncingSa] = useState(false);
  const [isSavingSa, setIsSavingSa] = useState(false);
  const [saTestResult, setSaTestResult] = useState<any>(null);
  const [saError, setSaError] = useState<string | null>(null);
  const [saSuccessMsg, setSaSuccessMsg] = useState<string | null>(null);
  const [showSaKey, setShowSaKey] = useState(false);
  const [showSaGuide, setShowSaGuide] = useState(false);

  // Google OAuth User State
  const [googleUser, setGoogleUser] = useState<GoogleOAuthUser | null>(null);
  const [isLoggingInGoogle, setIsLoggingInGoogle] = useState(false);
  const [oauthStatusMsg, setOauthStatusMsg] = useState<string | null>(null);

  // Listen to Google Auth
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

  const handleGoogleSignIn = async () => {
    setIsLoggingInGoogle(true);
    setOauthStatusMsg(null);
    try {
      const res = await signInWithGoogleWorkspace();
      if (res?.user) {
        setGoogleUser(res.user);
        setOauthStatusMsg(`✅ Đã kết nối tài khoản Google: ${res.user.email}`);
        setTimeout(() => setOauthStatusMsg(null), 4000);
      }
    } catch (err: any) {
      setOauthStatusMsg(`❌ ${err?.message || 'Đăng nhập Google thất bại'}`);
    } finally {
      setIsLoggingInGoogle(false);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await googleSignOut();
      setGoogleUser(null);
      setOauthStatusMsg('Đã đăng xuất tài khoản Google.');
      setTimeout(() => setOauthStatusMsg(null), 3000);
    } catch (e) {}
  };

  // Load Service Account Config on mount
  useEffect(() => {
    api.getDriveServiceAccountConfig()
      .then(cfg => {
        setSaConfig(cfg);
        setSaEmailInput(cfg.clientEmail || '');
        if (cfg.folderId) {
          setSaFolderIdInput(cfg.folderId);
          localStorage.setItem('app_sa_folder_id', cfg.folderId);
        }
      })
      .catch(err => console.warn('Could not load Service Account config:', err));
  }, []);

  // Sync token and chatId if updated externally
  useEffect(() => {
    setTokenInput(telegramConfig.botToken || '');
    setChatIdInput(telegramConfig.chatId || '');
    setAlertOffset(telegramConfig.alertOffsetMinutes || 15);
  }, [telegramConfig]);

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
      if (res.config.folderId) {
        setSaFolderIdInput(res.config.folderId);
        localStorage.setItem('app_sa_folder_id', res.config.folderId);
      }
      setIsEditingSaConfig(false);
      setSaSuccessMsg('✅ Đã lưu cấu hình Google Service Account cố định thành công!');
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

  const syncedCount = files.filter(f => f.isSyncedToDrive && f.syncStatus === 'synced').length;
  const localOnlyCount = files.length - syncedCount;
  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
  const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);

  // --- PIN Security Handlers ---
  const handleTogglePin = async (enabled: boolean) => {
    await setPinEnabled(enabled);
    const updated = getPinSettings();
    setPinSettingsState(updated);
    setPinStatusMsg(enabled ? '✅ Đã BẬT yêu cầu mã PIN khi truy cập trên tất cả thiết bị!' : '⚠️ Đã TẮT bảo vệ mã PIN.');
    setTimeout(() => setPinStatusMsg(null), 4000);
  };

  const handleAutolockChange = async (mins: number) => {
    await setAutolockMinutes(mins);
    const updated = getPinSettings();
    setPinSettingsState(updated);
    setPinStatusMsg(
      mins === 0
        ? '✅ Tự động khóa: Khi tải lại trang hoặc mở tab mới.'
        : `✅ Tự động khóa: Sau ${mins} phút không thao tác.`
    );
    setTimeout(() => setPinStatusMsg(null), 4000);
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinErrorMsg(null);
    setPinStatusMsg(null);

    if (newPinInput.length < 4) {
      setPinErrorMsg('Mã PIN mới phải có ít nhất 4 chữ số!');
      return;
    }

    if (newPinInput !== confirmPinInput) {
      setPinErrorMsg('Mã PIN xác nhận không khớp!');
      return;
    }

    setIsChangingPin(true);
    try {
      // If custom PIN exists or old PIN is required
      if (pinSettings.hasCustomPin || currentPinInput.trim() !== '') {
        const isCurrentValid = await verifyPinAsync(currentPinInput.trim());
        if (!isCurrentValid) {
          setPinErrorMsg('Mã PIN hiện tại không đúng!');
          setIsChangingPin(false);
          return;
        }
      }

      await setPin(newPinInput.trim(), pinHintInput.trim(), currentPinInput.trim());
      const updated = await fetchPinSettingsFromServer();
      setPinSettingsState(updated);
      setCurrentPinInput('');
      setNewPinInput('');
      setConfirmPinInput('');
      setPinStatusMsg('🎉 Đã đổi mã PIN mới thành công! Hệ thống đã đồng bộ cho mọi thiết bị và trình duyệt.');
      setTimeout(() => setPinStatusMsg(null), 5000);
    } catch (err: any) {
      setPinErrorMsg(err?.message || 'Không thể lưu mã PIN lên máy chủ.');
    } finally {
      setIsChangingPin(false);
    }
  };

  const handleLockNow = () => {
    if (onLockApp) {
      onLockApp();
    } else {
      lockSession();
      window.location.reload();
    }
  };

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
              Quản lý tập trung thông số kết nối Telegram Bot, Google Drive Folder, mã PIN bảo mật và mô hình AI
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
            onClick={() => setActiveSection('security')}
            className={`px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'security' ? 'bg-[#D4AF37] text-black shadow' : 'text-[#888888] hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Mã PIN & Bảo Mật</span>
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
                2. Cấu Hình Google Drive & Đồng Bộ Tài Liệu
              </h2>
            </div>
            <span className="text-[11px] text-[#D4AF37] font-mono px-2.5 py-0.5 rounded bg-[#D4AF37]/10 border border-[#D4AF37]/30">
              OAuth 1-Click + Service Account
            </span>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* METHOD A: 1-CLICK GOOGLE OAUTH ACCOUNT (PERSONAL DRIVE SYNC) */}
          {/* ------------------------------------------------------------- */}
          <div className="bg-[#151515] border border-emerald-500/50 rounded-sm p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-400">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Đăng Nhập Google Cá Nhân (1-Click Google OAuth)
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono font-bold border border-emerald-800">
                      Tiện Lợi Nhất ⭐
                    </span>
                  </div>
                  <p className="text-xs text-[#AAAAAA] mt-0.5">
                    Đăng nhập tài khoản Google của bạn để <strong className="text-emerald-400">đẩy file lưu cục bộ trực tiếp lên Google Drive cá nhân</strong> chỉ với 1 click.
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                {googleUser ? (
                  <div className="flex items-center gap-2 bg-emerald-950/70 border border-emerald-700 px-3 py-1.5 rounded text-xs font-mono text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Đã kết nối: <strong>{googleUser.email}</strong></span>
                  </div>
                ) : (
                  <span className="text-xs bg-[#0C0C0C] text-[#888888] border border-[#2A2A2A] px-3 py-1.5 rounded font-mono">
                    Chưa đăng nhập
                  </span>
                )}
              </div>
            </div>

            {oauthStatusMsg && (
              <div className="p-3 bg-[#0C0C0C] border border-emerald-600/60 text-emerald-400 text-xs font-bold rounded-sm animate-in fade-in">
                {oauthStatusMsg}
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
              <div className="text-xs text-[#888888]">
                {googleUser
                  ? 'Tài khoản của bạn đã sẵn sàng. Tại trang Tài Liệu, bấm "Lưu lên Drive" trên bất kỳ file nào để đồng bộ ngay.'
                  : 'Bấm nút bên dưới để cấp quyền kết nối Google Drive cho tài khoản Google của bạn:'}
              </div>

              {googleUser ? (
                <button
                  type="button"
                  onClick={handleGoogleSignOut}
                  className="px-4 py-2 bg-[#0C0C0C] hover:bg-rose-950/80 text-rose-400 border border-rose-800/80 rounded-sm text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Đăng Xuất Tài Khoản Google
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoggingInGoogle}
                  className="px-4 py-2.5 bg-white hover:bg-[#E0E0E0] text-black font-bold rounded-sm text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md transition-all disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>{isLoggingInGoogle ? 'Đang xác thực...' : 'Đăng Nhập Bằng Google'}</span>
                </button>
              )}
            </div>
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

            {/* Service Account Form or Active Status Display */}
            {saConfig.clientEmail && !isEditingSaConfig ? (
              <div className="space-y-4">
                {/* Active Permanent Configuration Card */}
                <div className="p-4 bg-[#0F1710] border border-emerald-500/40 rounded-sm space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-emerald-900/50 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                        Cấu hình Google Drive đã lưu vĩnh viễn trên Server
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                      Tự động duy trì cho mọi lần đăng nhập
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 bg-[#0C0C0C]/80 border border-[#2A2A2A] rounded">
                      <span className="text-[10px] text-[#888888] uppercase block tracking-wider font-bold mb-0.5">
                        Thư mục Drive cố định
                      </span>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[#D4AF37] font-bold truncate">
                          {saConfig.folderName || 'AI Assistant Documents'}
                        </span>
                        {saConfig.folderId && (
                          <a
                            href={`https://drive.google.com/drive/folders/${saConfig.folderId.trim()}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[#D4AF37] border border-[#D4AF37]/30 rounded text-[11px] flex items-center gap-1 shrink-0 transition-colors"
                            title="Mở thư mục trên Google Drive"
                          >
                            <FolderOpen className="w-3 h-3" />
                            <span>Mở Drive</span>
                          </a>
                        )}
                      </div>
                      <span className="text-[10px] text-[#666666] font-mono block mt-1 truncate">
                        ID: {saConfig.folderId}
                      </span>
                    </div>

                    <div className="p-2.5 bg-[#0C0C0C]/80 border border-[#2A2A2A] rounded">
                      <span className="text-[10px] text-[#888888] uppercase block tracking-wider font-bold mb-0.5">
                        Tài khoản Service Account
                      </span>
                      <div className="text-white font-mono text-[11px] truncate font-bold">
                        {saConfig.clientEmail}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 mt-1 font-mono">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>Khóa JSON Key: Đã lưu bảo mật</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#AAAAAA] leading-relaxed">
                    💡 <strong className="text-white">Bạn không cần phải nhập lại JSON Key hay Folder ID khi đăng nhập hay đổi máy.</strong> Mọi tác vụ tải file, đồng bộ và AI Agent đều sẽ tự động kết nối qua tài khoản dịch vụ này.
                  </p>

                  {/* Actions for active config */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-emerald-900/40">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTestSaConnection}
                        disabled={isTestingSa}
                        className="py-1.5 px-3 rounded-sm bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[#D4AF37] border border-[#D4AF37]/50 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isTestingSa ? 'animate-spin' : ''}`} />
                        <span>{isTestingSa ? 'Đang kiểm tra...' : 'Kiểm Tra Lại Kết Nối'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsEditingSaConfig(true)}
                        className="py-1.5 px-3 rounded-sm bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[#AAAAAA] hover:text-white border border-[#333333] text-xs font-bold tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span>✏️ Thay Đổi / Nhập Key Khác</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleSyncSaFiles}
                      disabled={isSyncingSa}
                      className="py-1.5 px-4 rounded-sm bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow disabled:opacity-50"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>{isSyncingSa ? 'Đang đồng bộ...' : 'Đồng Bộ Tệp Drive Ngay'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in">
                {isEditingSaConfig && (
                  <div className="flex items-center justify-between pb-2 border-b border-[#2A2A2A]">
                    <span className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
                      ✏️ Chỉnh sửa / Thay thế Cấu hình Service Account
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingSaConfig(false)}
                      className="text-xs text-[#888888] hover:text-white underline cursor-pointer"
                    >
                      ✕ Hủy chỉnh sửa (Giữ cấu hình hiện tại)
                    </button>
                  </div>
                )}

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
                      <span>{isSavingSa ? 'Đang lưu...' : '2. Lưu Cấu Hình Cố Định'}</span>
                    </button>
                  </div>

                  {isEditingSaConfig && (
                    <button
                      type="button"
                      onClick={() => setIsEditingSaConfig(false)}
                      className="py-2 px-3 text-xs text-[#888888] hover:text-white"
                    >
                      Hủy
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Statistics summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 bg-[#151515] rounded-sm border border-[#2A2A2A] text-center">
              <span className="text-[10px] text-[#888888] uppercase block tracking-wider font-bold">Tổng Dung Lượng Tệp</span>
              <span className="text-lg font-bold text-white mt-1 block">{totalMb} MB</span>
            </div>
            <div className="p-4 bg-[#151515] rounded-sm border border-[#2A2A2A] text-center">
              <span className="text-[10px] text-[#888888] uppercase block tracking-wider font-bold">Đã Vào Google Drive</span>
              <span className="text-lg font-bold text-emerald-400 mt-1 block">{syncedCount} tệp</span>
            </div>
            <div className="p-4 bg-[#151515] rounded-sm border border-[#2A2A2A] text-center">
              <span className="text-[10px] text-[#888888] uppercase block tracking-wider font-bold">Chưa Đồng Bộ</span>
              <span className="text-lg font-bold text-amber-400 mt-1 block">{localOnlyCount} tệp</span>
            </div>
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* SECTION 3: PIN SECURITY & SCREEN LOCK CONFIGURATION */}
      {/* ======================================================== */}
      {(activeSection === 'all' || activeSection === 'security') && (
        <section className="space-y-4 pt-4">
          <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2">
            <div className="flex items-center gap-2 text-[#D4AF37]">
              <Lock className="w-5 h-5" />
              <h2 className="text-base font-editorial-serif font-bold text-white tracking-wide">
                3. Bảo Mật Truy Cập & Khóa Màn Hình Bằng Mã PIN
              </h2>
            </div>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
              pinSettings.isEnabled ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60' : 'bg-[#151515] text-[#888888] border border-[#2A2A2A]'
            }`}>
              {pinSettings.isEnabled ? '🔐 Đang Bật Bảo Vệ' : '🔓 Đang Tắt'}
            </span>
          </div>

          {/* Status Alerts */}
          {pinStatusMsg && (
            <div className="p-3.5 rounded-sm bg-[#151515] border border-emerald-500/80 text-xs text-emerald-300 font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{pinStatusMsg}</span>
            </div>
          )}

          {pinErrorMsg && (
            <div className="p-3.5 rounded-sm bg-rose-950/50 border border-rose-800 text-xs text-rose-300 font-bold flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{pinErrorMsg}</span>
              </div>
              <button onClick={() => setPinErrorMsg(null)} className="text-xs hover:text-white cursor-pointer">✕</button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Overview & Quick Controls (5 cols) */}
            <div className="lg:col-span-5 bg-[#151515] border border-[#2A2A2A] p-5 rounded-sm space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Trạng Thái Bảo Mật PIN</h3>
                  </div>
                  <span className="text-[10px] text-[#D4AF37] font-mono font-bold">
                    {pinSettings.hasCustomPin ? 'Mã PIN tùy chỉnh' : 'Mã PIN mặc định (1234)'}
                  </span>
                </div>

                {/* Main Toggle */}
                <div className="p-4 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <KeyRound className="w-4 h-4 text-[#D4AF37]" />
                        <span>Yêu cầu nhập mã PIN khi truy cập</span>
                      </div>
                      <p className="text-[11px] text-[#888888] mt-0.5">
                        Khóa toàn bộ giao diện cho đến khi nhập đúng mã PIN bảo mật
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pinSettings.isEnabled}
                        onChange={(e) => handleTogglePin(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[#2A2A2A] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D4AF37]"></div>
                    </label>
                  </div>
                </div>

                {/* Auto-lock Timeout Dropdown */}
                <div className="p-4 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#E0E0E0] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>Thời gian tự động khóa khi rảnh:</span>
                    </label>
                  </div>
                  <select
                    value={pinSettings.autolockMinutes}
                    onChange={(e) => handleAutolockChange(Number(e.target.value))}
                    disabled={!pinSettings.isEnabled}
                    className="w-full p-2.5 bg-[#151515] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] text-xs focus:outline-none focus:border-[#D4AF37] disabled:opacity-40"
                  >
                    <option value={0}>Chỉ khóa khi tải lại trang / đóng trình duyệt</option>
                    <option value={5}>Khóa sau 5 phút không hoạt động</option>
                    <option value={15}>Khóa sau 15 phút không hoạt động</option>
                    <option value={30}>Khóa sau 30 phút không hoạt động</option>
                    <option value={60}>Khóa sau 60 phút không hoạt động</option>
                  </select>
                </div>
              </div>

              {/* Quick Lock Trigger Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleLockNow}
                  className="w-full py-2.5 px-4 rounded-sm bg-[#1A1A1A] hover:bg-[#252525] text-[#D4AF37] border border-[#D4AF37]/50 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow"
                >
                  <Lock className="w-4 h-4 text-[#D4AF37]" />
                  <span>🔒 Khóa Màn Hình Ứng Dụng Ngay (Lock Now)</span>
                </button>
              </div>
            </div>

            {/* Change PIN Code Form (7 cols) */}
            <div className="lg:col-span-7 bg-[#151515] border border-[#2A2A2A] p-5 rounded-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#D4AF37]" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Đổi Mã PIN Bảo Mật</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPinSecrets(!showPinSecrets)}
                  className="text-xs text-[#888888] hover:text-[#D4AF37] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {showPinSecrets ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPinSecrets ? 'Ẩn ký tự' : 'Hiện ký tự'}</span>
                </button>
              </div>

              <form onSubmit={handleChangePin} className="space-y-3.5 text-xs">
                
                {/* Current PIN (if needed) */}
                <div>
                  <label className="block text-[#AAAAAA] font-bold uppercase tracking-wider text-[10px] mb-1">
                    Mã PIN hiện tại:
                  </label>
                  <input
                    type={showPinSecrets ? 'text' : 'password'}
                    value={currentPinInput}
                    onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder={pinSettings.hasCustomPin ? 'Nhập mã PIN đang dùng...' : 'Mặc định là 1234 nếu chưa đổi'}
                    className="w-full p-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] font-mono text-xs focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* New PIN */}
                  <div>
                    <label className="block text-[#AAAAAA] font-bold uppercase tracking-wider text-[10px] mb-1">
                      Mã PIN mới (4 - 8 số):
                    </label>
                    <input
                      type={showPinSecrets ? 'text' : 'password'}
                      value={newPinInput}
                      onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      placeholder="Ví dụ: 8888 hoặc 9999"
                      className="w-full p-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] font-mono text-xs focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  {/* Confirm New PIN */}
                  <div>
                    <label className="block text-[#AAAAAA] font-bold uppercase tracking-wider text-[10px] mb-1">
                      Nhập lại mã PIN mới:
                    </label>
                    <input
                      type={showPinSecrets ? 'text' : 'password'}
                      value={confirmPinInput}
                      onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      placeholder="Nhập lại chính xác mã PIN mới"
                      className="w-full p-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] font-mono text-xs focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* Hint Input */}
                <div>
                  <label className="block text-[#AAAAAA] font-bold uppercase tracking-wider text-[10px] mb-1">
                    Gợi ý mã PIN (Tùy chọn - hiển thị khi bấm Quên mã):
                  </label>
                  <input
                    type="text"
                    value={pinHintInput}
                    onChange={(e) => setPinHintInput(e.target.value)}
                    placeholder="Ví dụ: Năm sinh hoặc 4 số cuối điện thoại..."
                    className="w-full p-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] text-xs focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div className="p-3 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[11px] text-[#888888] space-y-1">
                  <div className="font-bold text-[#D4AF37] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Lưu ý an toàn:</span>
                  </div>
                  <p>
                    • Mã PIN được lưu trữ an toàn trong trình duyệt cục bộ của bạn.<br />
                    • Nếu quên mã PIN, bạn có thể kiểm tra gợi ý đã đặt hoặc sử dụng mã mặc định ban đầu là <strong>1234</strong>.
                  </p>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isChangingPin || !newPinInput || !confirmPinInput}
                    className="px-5 py-2.5 rounded-sm bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow disabled:opacity-40"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isChangingPin ? 'Đang Lưu...' : 'Lưu Mã PIN Mới'}</span>
                  </button>
                </div>
              </form>
            </div>

          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* SECTION 4: SYSTEM & AI ENGINE CONFIGURATION */}
      {/* ======================================================== */}
      {(activeSection === 'all' || activeSection === 'system') && (
        <section className="space-y-4 pt-4">
          <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2">
            <div className="flex items-center gap-2 text-[#D4AF37]">
              <Cpu className="w-5 h-5" />
              <h2 className="text-base font-editorial-serif font-bold text-white tracking-wide">
                4. Cấu Hình AI Model & Tự Động Hóa Hệ Thống
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
