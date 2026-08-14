import React, { useState } from 'react';
import { TelegramConfig, NotificationLog } from '../types/index.js';
import { api } from '../services/api.js';
import {
  Bot,
  Send,
  CheckCircle2,
  MessageSquare,
  Zap,
  Settings,
  Clock,
  Link2,
  Copy,
  Sparkles,
  HelpCircle,
  PlusCircle,
  Sun,
  Moon,
  Mic,
  Volume2,
  CalendarCheck2,
  Radio
} from 'lucide-react';

interface TelegramBotViewProps {
  telegramConfig: TelegramConfig;
  notificationLogs: NotificationLog[];
  onUpdateConfig: (config: Partial<TelegramConfig>) => void;
  onSendTestMessage: (message?: string) => void;
  onSendTelegramCommand: (command: string) => Promise<{ success: boolean; reply: string }>;
}

export const TelegramBotView: React.FC<TelegramBotViewProps> = ({
  telegramConfig,
  notificationLogs,
  onUpdateConfig,
  onSendTestMessage,
  onSendTelegramCommand,
}) => {
  const [tokenInput, setTokenInput] = useState(telegramConfig.botToken || '');
  const [chatIdInput, setChatIdInput] = useState(telegramConfig.chatId || '');
  const [testMessageText, setTestMessageText] = useState('Xin chào! Đây là thông báo kiểm tra từ AI Assistant.');
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);
  const [isActivatingWebhook, setIsActivatingWebhook] = useState(false);
  const [showCreateBotGuide, setShowCreateBotGuide] = useState(false);

  // Daily Briefing State
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState<'morning' | 'evening' | null>(null);
  const [briefingStatus, setBriefingStatus] = useState<string | null>(null);
  const [briefingPreview, setBriefingPreview] = useState<{ title: string; text: string } | null>(null);

  const webhookUrl = `${window.location.origin}/api/telegram/webhook`;

  // Telegram 2-Way Bot Simulator Chat State
  const [simulatorChat, setSimulatorChat] = useState<Array<{ sender: 'user' | 'bot'; text: string; time: string }>>([
    {
      sender: 'bot',
      text: '🤖 *Chào bạn! Tôi là Telegram AI Productivity Assistant (2-Way Chat & Voice).* \n\nBạn có thể gửi tin nhắn thoại hoặc tin nhắn văn bản (ví dụ: "Thời tiết hôm nay", "Thêm việc họp sáng mai", /morning, /evening) hoặc bấm các nút bên dưới.',
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [customCommandInput, setCustomCommandInput] = useState('');
  const [isBotThinking, setIsBotThinking] = useState(false);

  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [isCheckingWebhookInfo, setIsCheckingWebhookInfo] = useState(false);

  const handleSetWebhook = async () => {
    setIsActivatingWebhook(true);
    setWebhookStatus(null);
    try {
      const res = await api.setTelegramWebhook(webhookUrl);
      if (res.success) {
        setWebhookStatus('✅ Đã kết nối Webhook 2 chiều Telegram thành công!');
      }
    } catch (err: any) {
      setWebhookStatus(`❌ ${err.message || 'Chưa thể cài đặt Webhook. Hãy kiểm tra lại Bot Token.'}`);
    } finally {
      setIsActivatingWebhook(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConfig({
      botToken: tokenInput,
      chatId: chatIdInput,
      enabled: true,
      isConnected: true,
    });
    if (tokenInput.trim()) {
      await handleSetWebhook();
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

  const handleTriggerBriefing = async (type: 'morning' | 'evening') => {
    setIsGeneratingBriefing(type);
    setBriefingStatus(null);
    try {
      const res = await api.generateBriefing(type, true);
      if (res.success) {
        setBriefingPreview({
          title: res.briefing.title,
          text: res.briefing.reportText,
        });
        setBriefingStatus(
          res.delivered
            ? `✅ Đã tổng hợp và gửi thành công ${type === 'morning' ? 'Bản Tin Sáng' : 'Báo Cáo Tối'} đến Telegram!`
            : `⚠️ Đã tạo bản tin thành công, nhưng chưa gửi được đến Telegram (Vui lòng kiểm tra Bot Token & Chat ID).`
        );
      }
    } catch (err: any) {
      setBriefingStatus(`❌ Lỗi: ${err.message || 'Không thể tạo bản tin'}`);
    } finally {
      setIsGeneratingBriefing(null);
    }
  };

  const handleExecuteCommand = async (cmd: string) => {
    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    setSimulatorChat(prev => [...prev, { sender: 'user', text: cmd, time: timeStr }]);
    setIsBotThinking(true);

    try {
      const res = await onSendTelegramCommand(cmd);
      setSimulatorChat(prev => [
        ...prev,
        { sender: 'bot', text: res.reply || 'Đã nhận câu hỏi từ bạn.', time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) }
      ]);
    } catch (err: any) {
      setSimulatorChat(prev => [
        ...prev,
        { sender: 'bot', text: `❌ Lỗi thực thi: ${err.message}`, time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) }
      ]);
    } finally {
      setIsBotThinking(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#151515] border border-[#2A2A2A] p-5 rounded-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-sm bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/30">
            <Bot className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div>
            <h1 className="text-xl font-editorial-serif font-bold text-white">Giao tiếp 2 chiều & Tự động hóa qua Telegram</h1>
            <p className="text-xs text-[#888888] italic">Nhận diện tin nhắn thoại (Voice to Task), AI Daily Briefing buổi sáng/tối và nút bấm Inline tương tác tức thì</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-bold uppercase tracking-wider">
            <Radio className="w-3.5 h-3.5 text-[#D4AF37] animate-pulse" />
            <span>Phase 3 Automation Active</span>
          </span>
        </div>
      </div>

      {/* PHASE 3 HIGHLIGHT SECTION: AI Daily Briefing & Voice to Task Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Module 1: AI Daily Briefing Center */}
        <div className="bg-[#151515] border border-[#D4AF37]/40 p-5 rounded-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2">
            <div className="flex items-center gap-2 text-[#D4AF37]">
              <CalendarCheck2 className="w-4 h-4" />
              <h2 className="text-sm font-bold uppercase tracking-wider">
                1. AI Daily Executive Briefing (Sáng & Tối)
              </h2>
            </div>
            <span className="text-[10px] bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/30 px-2 py-0.5 rounded font-mono">
              Auto Cron Scheduler
            </span>
          </div>

          <p className="text-xs text-[#CCCCCC] leading-relaxed">
            Hệ thống tự động tổng hợp tình hình thời tiết, các deadline trong ngày, mức độ ưu tiên và gửi báo cáo chuyên nghiệp tới Telegram của bạn:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              onClick={() => handleTriggerBriefing('morning')}
              disabled={isGeneratingBriefing !== null}
              className="p-3 bg-[#0C0C0C] hover:bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#D4AF37] rounded-sm text-left transition-all cursor-pointer group disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
                  <Sun className="w-4 h-4 text-amber-400" />
                  Bản Tin Sáng (07:30)
                </span>
                <span className="text-[10px] text-[#666666] group-hover:text-[#D4AF37]">Gửi Ngay →</span>
              </div>
              <p className="text-[11px] text-[#888888]">
                {isGeneratingBriefing === 'morning' ? '⏳ Đang tổng hợp AI...' : 'Thời tiết, việc ưu tiên hôm nay, mẹo tập trung'}
              </p>
            </button>

            <button
              onClick={() => handleTriggerBriefing('evening')}
              disabled={isGeneratingBriefing !== null}
              className="p-3 bg-[#0C0C0C] hover:bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#D4AF37] rounded-sm text-left transition-all cursor-pointer group disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-indigo-300 text-xs flex items-center gap-1.5">
                  <Moon className="w-4 h-4 text-indigo-300" />
                  Báo Cáo Tối (21:30)
                </span>
                <span className="text-[10px] text-[#666666] group-hover:text-[#D4AF37]">Gửi Ngay →</span>
              </div>
              <p className="text-[11px] text-[#888888]">
                {isGeneratingBriefing === 'evening' ? '⏳ Đang tổng hợp AI...' : 'Tổng kết việc đã xong, việc tồn & kế hoạch mai'}
              </p>
            </button>
          </div>

          {briefingStatus && (
            <div className="text-xs p-2.5 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] text-[#CCCCCC]">
              {briefingStatus}
            </div>
          )}

          {briefingPreview && (
            <div className="p-3 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm space-y-1.5 max-h-36 overflow-y-auto">
              <div className="text-[11px] font-bold text-[#D4AF37] flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{briefingPreview.title}</span>
              </div>
              <div className="text-[11px] text-[#CCCCCC] whitespace-pre-wrap font-mono leading-relaxed">
                {briefingPreview.text}
              </div>
            </div>
          )}
        </div>

        {/* Module 2: Voice-to-Task with Gemini Multimodal Audio */}
        <div className="bg-[#151515] border border-[#D4AF37]/40 p-5 rounded-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2">
            <div className="flex items-center gap-2 text-[#D4AF37]">
              <Mic className="w-4 h-4 text-[#D4AF37]" />
              <h2 className="text-sm font-bold uppercase tracking-wider">
                2. Nhận Diện Tin Nhắn Thoại (Voice to Task)
              </h2>
            </div>
            <span className="text-[10px] bg-[#1A1A1A] text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">
              Gemini Multimodal Audio
            </span>
          </div>

          <p className="text-xs text-[#CCCCCC] leading-relaxed">
            Bạn có thể nhấn giữ biểu tượng Micro trên Telegram để nói tiếng Việt tự nhiên. AI sẽ tự động giải mã âm thanh và gọi hàm tạo công việc tương ứng:
          </p>

          <div className="p-3 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm space-y-2 text-xs">
            <div className="text-[11px] font-bold text-[#D4AF37] uppercase tracking-wide flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Quy trình xử lý âm thanh tự động:</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-[#AAAAAA] flex-wrap">
              <span className="bg-[#151515] px-2 py-1 rounded border border-[#2A2A2A]">🎙️ Telegram Voice (.oga/.ogg)</span>
              <span>➔</span>
              <span className="bg-[#151515] px-2 py-1 rounded border border-[#2A2A2A]">🧠 Gemini 3.7 Audio Decoding</span>
              <span>➔</span>
              <span className="bg-[#151515] px-2 py-1 rounded border border-[#2A2A2A]">⚡ Function Calling (createTask)</span>
              <span>➔</span>
              <span className="bg-[#151515] px-2 py-1 rounded border border-[#2A2A2A]">🔥 Firestore Realtime Sync</span>
            </div>
          </div>

          <div className="space-y-1 text-xs">
            <span className="text-[11px] text-[#888888] font-bold">Thử nghiệm câu lệnh giọng nói mẫu:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => handleExecuteCommand('Thêm việc chuẩn bị tài liệu dự án trước 4h chiều mai độ ưu tiên cao')}
                className="px-2 py-1 rounded bg-[#0C0C0C] hover:bg-[#1A1A1A] text-emerald-400 border border-emerald-500/30 text-[11px] transition-colors cursor-pointer"
              >
                🎙️ "Thêm việc chuẩn bị tài liệu trước 4h chiều mai..."
              </button>
              <button
                onClick={() => handleExecuteCommand('Đã xong việc nộp báo cáo')}
                className="px-2 py-1 rounded bg-[#0C0C0C] hover:bg-[#1A1A1A] text-amber-300 border border-amber-500/30 text-[11px] transition-colors cursor-pointer"
              >
                🎙️ "Đã xong việc nộp báo cáo"
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Group Chat & Direct Chat Fix Guide Banner */}
      <div className="bg-[#151515] border border-[#2A2A2A] p-4 rounded-sm space-y-3">
        <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2 text-[#D4AF37]">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4" />
            <h2 className="text-sm font-bold uppercase tracking-wider">
              💡 Hướng dẫn tạo Bot riêng & Mẹo đặt câu hỏi từ Điện thoại
            </h2>
          </div>
          <button
            onClick={() => setShowCreateBotGuide(!showCreateBotGuide)}
            className="text-xs bg-[#1A1A1A] hover:bg-[#252525] text-[#D4AF37] px-2.5 py-1 rounded border border-[#D4AF37]/30 transition-colors cursor-pointer font-bold"
          >
            {showCreateBotGuide ? '▲ Đóng Hướng Dẫn' : '➕ Xem 4 Bước Tạo Bot Mới'}
          </button>
        </div>

        {/* Expandable Step-by-Step Bot Creation Guide */}
        {showCreateBotGuide && (
          <div className="bg-[#0C0C0C] p-4 rounded-sm border border-[#2A2A2A] space-y-3 text-xs">
            <h3 className="font-bold text-white text-sm flex items-center gap-2 text-[#D4AF37]">
              <PlusCircle className="w-4 h-4" />
              4 Bước Tạo Telegram Bot Mới Dành Riêng Cho App (Chưa tới 2 phút)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
              <div className="p-3 bg-[#151515] border border-[#2A2A2A] rounded-sm space-y-1">
                <span className="font-bold text-[#D4AF37] uppercase tracking-wide">Bước 1: Mở @BotFather</span>
                <p className="text-[#CCCCCC]">
                  Mở ứng dụng Telegram trên điện thoại ➔ Tìm kiếm <strong>@BotFather</strong> (có tích xanh xác minh) ➔ Bấm <strong>Start</strong>.
                </p>
              </div>

              <div className="p-3 bg-[#151515] border border-[#2A2A2A] rounded-sm space-y-1">
                <span className="font-bold text-[#D4AF37] uppercase tracking-wide">Bước 2: Tạo Bot mới</span>
                <p className="text-[#CCCCCC]">
                  Gõ lệnh <code className="bg-black text-[#D4AF37] px-1 py-0.5 rounded font-mono">/newbot</code> ➔ Đặt tên hiển thị (vd: <em>AI Productivity Assistant</em>) ➔ Đặt username cho Bot kết thúc bằng <code className="bg-black text-[#D4AF37] px-1 py-0.5 rounded font-mono">bot</code> (vd: <em>MyPersonalAI_bot</em>).
                </p>
              </div>

              <div className="p-3 bg-[#151515] border border-[#2A2A2A] rounded-sm space-y-1">
                <span className="font-bold text-[#D4AF37] uppercase tracking-wide">Bước 3: Lấy HTTP API Token</span>
                <p className="text-[#CCCCCC]">
                  BotFather sẽ gửi cho bạn 1 dãy Token (vd: <code className="bg-black text-[#D4AF37] px-1 py-0.5 rounded font-mono">7891234560:AAH...</code>). Sao chép (Copy) chuỗi Token này.
                </p>
              </div>

              <div className="p-3 bg-[#151515] border border-[#2A2A2A] rounded-sm space-y-1">
                <span className="font-bold text-[#D4AF37] uppercase tracking-wide">Bước 4: Nhập vào App & Kích hoạt</span>
                <p className="text-[#CCCCCC]">
                  Dán Token vào ô <strong>Telegram Bot Token</strong> bên dưới ➔ Bấm <strong>Lưu Cấu Hình</strong> ➔ Bấm <strong>Kích hoạt Webhook</strong>. Nhắn `/start` cho Bot để hoàn tất!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Col (5 cols): Bot Setup Form & Webhook Settings */}
        <div className="lg:col-span-5 space-y-6">
          {/* Configuration Form */}
          <div className="p-5 rounded-sm bg-[#151515] border border-[#2A2A2A] space-y-4">
            <div className="flex items-center gap-2 border-b border-[#2A2A2A] pb-3">
              <Settings className="w-4 h-4 text-[#D4AF37]" />
              <h2 className="text-sm font-editorial-serif font-bold text-white">Cấu hình Telegram Bot</h2>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#AAAAAA] font-bold uppercase tracking-wider text-[10px] mb-1">Telegram Bot Token (từ @BotFather)</label>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Ví dụ: 7891234560:AAH8xY_demo_token..."
                  className="w-full p-2 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] font-mono text-xs focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[#AAAAAA] font-bold uppercase tracking-wider text-[10px]">Telegram Chat ID / User ID</label>
                  <span className="text-[10px] text-[#D4AF37]">✨ Tự động nhận diện khi nhắn tin</span>
                </div>
                <input
                  type="text"
                  value={chatIdInput}
                  onChange={(e) => setChatIdInput(e.target.value)}
                  placeholder="Ví dụ: 123456789 (Hệ thống tự động điền khi bạn chat)"
                  className="w-full p-2 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] font-mono text-xs focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-[#AAAAAA] font-bold uppercase tracking-wider text-[10px] mb-1">Cảnh báo trước deadline (Phút)</label>
                <select
                  value={telegramConfig.alertOffsetMinutes}
                  onChange={(e) => onUpdateConfig({ alertOffsetMinutes: Number(e.target.value) })}
                  className="w-full p-2 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] text-xs focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value={15}>15 phút trước deadline</option>
                  <option value={30}>30 phút trước deadline</option>
                  <option value={60}>1 giờ trước deadline</option>
                  <option value={120}>2 giờ trước deadline</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-sm bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer"
                >
                  Lưu Cấu Hình
                </button>
              </div>
            </form>
          </div>

          {/* Webhook Connection Control */}
          <div className="p-5 rounded-sm bg-[#151515] border border-[#2A2A2A] space-y-3">
            <div className="flex items-center gap-2 border-b border-[#2A2A2A] pb-2">
              <Link2 className="w-4 h-4 text-[#D4AF37]" />
              <h3 className="text-sm font-editorial-serif font-bold text-white">Đường dẫn Webhook Telegram</h3>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-[#0C0C0C] p-2 rounded-sm border border-[#2A2A2A]">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="bg-transparent text-[11px] font-mono text-[#AAAAAA] w-full focus:outline-none"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(webhookUrl)}
                  title="Sao chép Webhook URL"
                  className="p-1 hover:text-[#D4AF37] text-[#888888] transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleSetWebhook}
                  disabled={isActivatingWebhook}
                  className="py-2 px-2 rounded-sm bg-[#1A1A1A] hover:bg-[#D4AF37] hover:text-black text-[#D4AF37] border border-[#D4AF37]/40 font-bold uppercase tracking-wider text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isActivatingWebhook ? 'Đang bật...' : 'Kích hoạt Webhook'}</span>
                </button>

                <button
                  onClick={handleCheckWebhookInfo}
                  disabled={isCheckingWebhookInfo}
                  className="py-2 px-2 rounded-sm bg-[#1A1A1A] hover:bg-white hover:text-black text-white border border-[#2A2A2A] font-bold uppercase tracking-wider text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>{isCheckingWebhookInfo ? 'Đang tra...' : 'Kiểm Tra Webhook'}</span>
                </button>
              </div>

              {webhookStatus && (
                <div className="text-xs p-2 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] font-medium leading-relaxed">
                  {webhookStatus}
                </div>
              )}

              {webhookInfo && (
                <div className="p-2.5 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] space-y-1 text-[11px] font-mono">
                  <div className="font-bold text-[#D4AF37] uppercase">📊 Kết quả từ Telegram Server:</div>
                  <div className="text-[#CCCCCC] break-all">
                    URL: {webhookInfo.url || 'Chưa đăng ký'}
                  </div>
                  <div className="text-[#CCCCCC]">
                    Pending Updates: {webhookInfo.pending_update_count ?? 0}
                  </div>
                  {webhookInfo.last_error_message && (
                    <div className="text-red-400 font-sans mt-1">
                      ⚠️ Lỗi Telegram gần nhất: {webhookInfo.last_error_message}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Test Telegram Alert Box */}
          <div className="p-5 rounded-sm bg-[#151515] border border-[#2A2A2A] space-y-3">
            <div className="flex items-center gap-2 border-b border-[#2A2A2A] pb-2">
              <Zap className="w-4 h-4 text-[#D4AF37]" />
              <h3 className="text-sm font-editorial-serif font-bold text-white">Gửi thông báo thử nghiệm</h3>
            </div>

            <textarea
              value={testMessageText}
              onChange={(e) => setTestMessageText(e.target.value)}
              rows={2}
              className="w-full p-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-xs text-[#E0E0E0] focus:outline-none focus:border-[#D4AF37]"
            />

            <button
              onClick={() => onSendTestMessage(testMessageText)}
              className="w-full py-2 rounded-sm bg-[#1A1A1A] hover:bg-[#D4AF37] hover:text-black text-[#D4AF37] border border-[#D4AF37]/40 font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Gửi Ngay Telegram</span>
            </button>
          </div>
        </div>

        {/* Right Col (7 cols): Interactive Telegram 2-Way Bot Simulator */}
        <div className="lg:col-span-7 bg-[#151515] border border-[#2A2A2A] rounded-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#D4AF37]" />
              <h2 className="text-sm font-editorial-serif font-bold text-white">Khung Chat & Voice Simulator Telegram (2-Way Live)</h2>
            </div>
            <span className="text-[10px] text-[#D4AF37] px-2 py-0.5 rounded-sm bg-[#0C0C0C] border border-[#D4AF37]/30 font-mono">
              Voice & Briefing Ready
            </span>
          </div>

          {/* Quick Command & AI Agent Action Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleExecuteCommand('Thêm việc họp khách hàng lúc 3h chiều mai độ ưu tiên cao')}
              className="px-2.5 py-1 rounded-sm bg-[#1A1A1A] text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500 hover:text-black text-xs font-bold transition-colors cursor-pointer"
            >
              ✨ + Tạo việc tự động
            </button>
            <button
              onClick={() => handleExecuteCommand('Đã xong việc nộp báo cáo quý')}
              className="px-2.5 py-1 rounded-sm bg-[#1A1A1A] text-amber-300 border border-amber-500/40 hover:bg-amber-400 hover:text-black text-xs font-bold transition-colors cursor-pointer"
            >
              🎉 Đánh dấu xong việc
            </button>
            <button
              onClick={() => handleExecuteCommand('/morning')}
              className="px-2.5 py-1 rounded-sm bg-[#0C0C0C] text-amber-400 border border-amber-500/30 hover:bg-amber-400 hover:text-black text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
            >
              <Sun className="w-3.5 h-3.5" />
              <span>/morning</span>
            </button>
            <button
              onClick={() => handleExecuteCommand('/evening')}
              className="px-2.5 py-1 rounded-sm bg-[#0C0C0C] text-indigo-300 border border-indigo-500/30 hover:bg-indigo-300 hover:text-black text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
            >
              <Moon className="w-3.5 h-3.5" />
              <span>/evening</span>
            </button>
            <button
              onClick={() => handleExecuteCommand('/today')}
              className="px-2.5 py-1 rounded-sm bg-[#0C0C0C] text-[#D4AF37] border border-[#2A2A2A] hover:bg-[#D4AF37] hover:text-black text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              /today
            </button>
            <button
              onClick={() => handleExecuteCommand('Thời tiết Bắc Giang hôm nay')}
              className="px-2.5 py-1 rounded-sm bg-[#0C0C0C] text-[#D4AF37] border border-[#2A2A2A] hover:bg-[#D4AF37] hover:text-black text-xs font-bold transition-colors cursor-pointer"
            >
              🌤️ Thời tiết
            </button>
          </div>

          {/* Telegram Simulator Chat Box */}
          <div className="p-4 bg-[#0C0C0C] rounded-sm border border-[#2A2A2A] h-[340px] overflow-y-auto space-y-3">
            {simulatorChat.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] p-3 rounded-sm text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.sender === 'user'
                      ? 'bg-[#D4AF37] text-black font-semibold'
                      : 'bg-[#151515] border border-[#2A2A2A] text-[#E0E0E0] font-sans'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[9px] text-[#666666] font-mono mt-1 px-1">{msg.time}</span>
              </div>
            ))}

            {isBotThinking && (
              <div className="flex items-center gap-2 text-xs text-[#D4AF37] font-bold animate-pulse">
                <Bot className="w-4 h-4 text-[#D4AF37]" />
                <span>AI Chatbot Telegram đang xử lý phản hồi...</span>
              </div>
            )}
          </div>

          {/* Custom Telegram Input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Nhập tin nhắn hoặc câu hỏi bất kỳ (vd: /morning, /evening, /today, thời tiết hôm nay)..."
              value={customCommandInput}
              onChange={(e) => setCustomCommandInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customCommandInput.trim()) {
                  handleExecuteCommand(customCommandInput);
                  setCustomCommandInput('');
                }
              }}
              className="flex-1 p-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-xs text-[#E0E0E0] focus:outline-none focus:border-[#D4AF37]"
            />
            <button
              onClick={() => {
                if (customCommandInput.trim()) {
                  handleExecuteCommand(customCommandInput);
                  setCustomCommandInput('');
                }
              }}
              className="px-4 py-2.5 rounded-sm bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
            >
              Gửi
            </button>
          </div>
        </div>

      </div>

      {/* Notification Log History Stream */}
      <div className="p-5 rounded-sm bg-[#151515] border border-[#2A2A2A] space-y-3">
        <div className="flex items-center gap-2 border-b border-[#2A2A2A] pb-2">
          <Clock className="w-4 h-4 text-[#D4AF37]" />
          <h3 className="text-sm font-editorial-serif font-bold text-white">Lịch sử tương tác qua Telegram Bot (Notification Audit Trail)</h3>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto">
          {notificationLogs.map(log => (
            <div key={log.id} className="p-3 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <div className="font-editorial-serif font-bold text-white">{log.title}</div>
                <div className="text-[#888888]">{log.message}</div>
              </div>
              <span className="text-[10px] font-mono text-[#666666] shrink-0">
                {new Date(log.timestamp).toLocaleTimeString('vi-VN')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
