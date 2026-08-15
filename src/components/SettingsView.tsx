import React, { useState, useEffect } from 'react';
import { TelegramConfig, DriveFile } from '../types/index.js';
import { api } from '../services/api.js';
import {
  signInWithGoogle,
  logOutGoogle,
  initGoogleAuth,
  getOrCreateAppFolder,
  syncLocalFileToGoogleDrive,
  getAccessToken,
  getGoogleUser,
  DriveFolderInfo,
  DEFAULT_APP_FOLDER_NAME
} from '../services/googleDriveAuth.ts';
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
  Layers
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
  const [showToken, setShowToken] = useState(false);
  const [testMessageText, setTestMessageText] = useState('Xin chào! Đây là thông báo kiểm tra từ mục Cài Đặt của AI Assistant.');
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);
  const [isActivatingWebhook, setIsActivatingWebhook] = useState(false);
  const [showCreateBotGuide, setShowCreateBotGuide] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [isCheckingWebhookInfo, setIsCheckingWebhookInfo] = useState(false);
  const [telegramSavedSuccess, setTelegramSavedSuccess] = useState(false);

  const webhookUrl = `${window.location.origin}/api/telegram/webhook`;

  // --- Google Drive State ---
  const [googleUser, setGoogleUser] = useState<User | null>(getGoogleUser());
  const [accessToken, setAccessToken] = useState<string | null>(getAccessToken());
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [driveAuthError, setDriveAuthError] = useState<string | null>(null);
  const [driveStatusMsg, setDriveStatusMsg] = useState<string | null>(null);
  const [appFolder, setAppFolder] = useState<DriveFolderInfo | null>(null);
  const [customFolderName, setCustomFolderName] = useState('');
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

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
      alertOffsetMinutes: alertOffset,
      enabled: true,
      isConnected: true,
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

  // Google Login & Folder Setup
  const handleGoogleLogin = async () => {
    setIsAuthenticating(true);
    setDriveAuthError(null);
    try {
      const { user, accessToken: token } = await signInWithGoogle();
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
        <section className="space-y-4 pt-4">
          <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2">
            <div className="flex items-center gap-2 text-[#D4AF37]">
              <HardDrive className="w-5 h-5" />
              <h2 className="text-base font-editorial-serif font-bold text-white tracking-wide">
                2. Cấu Hình Google Drive & Thư Mục Chuyên Biệt
              </h2>
            </div>
            <span className="text-[11px] text-emerald-400 font-mono px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40">
              Single-Folder Isolation
            </span>
          </div>

          {/* Drive Status & Error Alerts */}
          {driveStatusMsg && (
            <div className="p-3 rounded-sm bg-[#151515] border border-[#D4AF37] text-xs text-[#D4AF37] font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{driveStatusMsg}</span>
            </div>
          )}

          {driveAuthError && (
            <div className="p-3 rounded-sm bg-rose-950/40 border border-rose-800 text-xs text-rose-300 font-medium flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{driveAuthError}</span>
              </div>
              <button onClick={() => setDriveAuthError(null)} className="text-xs hover:text-white cursor-pointer">✕</button>
            </div>
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
                        <span>Thời lượng Token:</span>
                        <span className="text-emerald-400 font-mono">60 phút (OAuth 2.0)</span>
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
              <div className="pt-2">
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
