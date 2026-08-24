import React, { useState } from 'react';
import { TelegramConfig, NotificationLog } from '../types/index.js';
import {
  Bot,
  MessageSquare,
  Zap,
  Settings,
  Clock,
  Sparkles,
  Sun,
  Moon,
  Mic,
  Volume2,
  CalendarCheck2,
  Radio,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Menu,
  RefreshCw,
  CornerDownRight,
  MousePointerClick
} from 'lucide-react';

interface TelegramBotViewProps {
  telegramConfig: TelegramConfig;
  notificationLogs: NotificationLog[];
  onUpdateConfig: (config: Partial<TelegramConfig>) => void;
  onSendTestMessage: (message?: string) => void;
  onSendTelegramCommand: (command: string) => Promise<{ success: boolean; reply: string }>;
  onNavigateToSettings?: () => void;
}

export const TelegramBotView: React.FC<TelegramBotViewProps> = ({
  telegramConfig,
  notificationLogs,
  onUpdateConfig,
  onSendTestMessage,
  onSendTelegramCommand,
  onNavigateToSettings
}) => {
  // Daily Briefing State
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState<'morning' | 'evening' | null>(null);
  const [briefingStatus, setBriefingStatus] = useState<string | null>(null);
  const [briefingPreview, setBriefingPreview] = useState<{ title: string; text: string } | null>(null);

  // Command registration and Webhook toggle state
  const [actionStatus, setActionStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isUpdatingCommands, setIsUpdatingCommands] = useState(false);
  const [isSwitchingPolling, setIsSwitchingPolling] = useState(false);

  // Telegram 2-Way Bot Simulator Chat State
  const [simulatorChat, setSimulatorChat] = useState<Array<{ sender: 'user' | 'bot'; text: string; time: string }>>([
    {
      sender: 'bot',
      text: '🤖 *Chào bạn! Tôi là Telegram AI Productivity Assistant (2-Way Interactive Bot).* \n\nBạn có thể gửi tin nhắn thoại hoặc văn bản (ví dụ: "Thời tiết hôm nay", "Thêm việc họp sáng mai", /morning, /evening) hoặc bấm các nút bên dưới để điều khiển.',
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [customCommandInput, setCustomCommandInput] = useState('');
  const [isBotThinking, setIsBotThinking] = useState(false);

  // Register bot commands (/) with Telegram API
  const handleRegisterCommands = async () => {
    setIsUpdatingCommands(true);
    setActionStatus(null);
    try {
      const res = await fetch('/api/telegram/set-commands', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setActionStatus({ type: 'success', message: '✅ ' + data.message });
      } else {
        setActionStatus({ type: 'error', message: '❌ ' + (data.error || data.message) });
      }
    } catch (err: any) {
      setActionStatus({ type: 'error', message: `❌ Lỗi kết nối: ${err.message}` });
    } finally {
      setIsUpdatingCommands(false);
    }
  };

  // Delete Webhook & Enable Background Long-Polling
  const handleDeleteWebhookToPolling = async () => {
    setIsSwitchingPolling(true);
    setActionStatus(null);
    try {
      const res = await fetch('/api/telegram/delete-webhook', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setActionStatus({ type: 'success', message: '✅ ' + data.message });
      } else {
        setActionStatus({ type: 'error', message: '❌ ' + (data.error || data.message) });
      }
    } catch (err: any) {
      setActionStatus({ type: 'error', message: `❌ Lỗi kết nối: ${err.message}` });
    } finally {
      setIsSwitchingPolling(false);
    }
  };

  // Handler for Interactive Telegram Command
  const handleExecuteCommand = async (cmdText: string) => {
    if (!cmdText.trim()) return;

    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    setSimulatorChat(prev => [...prev, { sender: 'user', text: cmdText, time: timeStr }]);
    setIsBotThinking(true);

    try {
      const response = await onSendTelegramCommand(cmdText);
      setSimulatorChat(prev => [
        ...prev,
        {
          sender: 'bot',
          text: response.reply || '✅ Lệnh đã được xử lý thành công!',
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err: any) {
      setSimulatorChat(prev => [
        ...prev,
        {
          sender: 'bot',
          text: `⚠️ Lỗi xử lý: ${err.message || 'Không thể kết nối dịch vụ AI Telegram'}`,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsBotThinking(false);
    }
  };

  // Handler to manually trigger Morning / Evening Briefings
  const handleTriggerBriefing = async (type: 'morning' | 'evening') => {
    setIsGeneratingBriefing(type);
    setBriefingStatus(`⏳ Đang kích hoạt tổng hợp AI Briefing (${type === 'morning' ? 'Bản Tin Sáng' : 'Báo Cáo Tối'})...`);
    setBriefingPreview(null);

    try {
      const cmd = type === 'morning' ? '/morning' : '/evening';
      const result = await onSendTelegramCommand(cmd);

      if (result.success) {
        setBriefingStatus(`✅ Đã tạo và bắn thành công ${type === 'morning' ? 'Bản Tin Sáng' : 'Báo Cáo Tối'} tới Telegram của bạn!`);
        setBriefingPreview({
          title: type === 'morning' ? '☀️ AI Executive Morning Briefing' : '🌙 AI Executive Evening Report',
          text: result.reply
        });
      } else {
        setBriefingStatus(`❌ Lỗi gửi briefing: ${result.reply}`);
      }
    } catch (err: any) {
      setBriefingStatus(`❌ Lỗi kết nối: ${err.message}`);
    } finally {
      setIsGeneratingBriefing(null);
    }
  };

  const isConfigured = !!telegramConfig.botToken && !!telegramConfig.chatId;

  return (
    <div className="space-y-6 pb-12">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#151515] border border-[#2A2A2A] p-5 rounded-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-sm bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/30">
            <Bot className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-editorial-serif font-bold text-white">Trung Tâm Tương Tác & Phản Hồi Trực Tiếp Telegram</h1>
              {isConfigured ? (
                <span className="text-[10px] bg-[#0C0C0C] text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Bot Đã Kết Nối
                </span>
              ) : (
                <span className="text-[10px] bg-[#0C0C0C] text-amber-400 border border-amber-800/60 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Chưa Cấu Hình Token
                </span>
              )}
            </div>
            <p className="text-xs text-[#888888] italic">
              Tương tác 2 chiều thông minh: Nhận diện giọng nói (Voice to Task), Quoted Reply (Xong/Hoãn), Nút bấm Inline và AI Daily Briefing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isConfigured && (
            <button
              onClick={handleRegisterCommands}
              disabled={isUpdatingCommands}
              className="px-3 py-2 rounded-sm bg-[#0C0C0C] hover:bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/40 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Đăng ký menu lệnh nhanh (/) trên ứng dụng Telegram"
            >
              <Menu className="w-3.5 h-3.5" />
              <span>{isUpdatingCommands ? 'Đang Đăng Ký...' : 'Đăng Ký Menu (/) Telegram'}</span>
            </button>
          )}

          {onNavigateToSettings && (
            <button
              onClick={onNavigateToSettings}
              className="px-3 py-2 rounded-sm bg-[#0C0C0C] hover:bg-[#1A1A1A] text-[#E0E0E0] hover:text-[#D4AF37] border border-[#2A2A2A] hover:border-[#D4AF37]/50 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Đi tới trang Cài Đặt để chỉnh sửa Bot Token, Chat ID hoặc Webhook"
            >
              <Settings className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Cài Đặt Bot</span>
            </button>
          )}

          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-bold uppercase tracking-wider">
            <Radio className="w-3.5 h-3.5 text-[#D4AF37] animate-pulse" />
            <span className="hidden sm:inline">2-Way Live Active</span>
          </span>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionStatus && (
        <div
          className={`p-3 rounded-sm text-xs border flex items-center justify-between ${
            actionStatus.type === 'success'
              ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
              : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
          }`}
        >
          <span>{actionStatus.message}</span>
          <button
            onClick={() => setActionStatus(null)}
            className="text-xs opacity-60 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Direct Telegram Interaction Feature Badges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Voice to Task */}
        <div className="bg-[#151515] border border-[#2A2A2A] hover:border-[#D4AF37]/40 p-4 rounded-sm space-y-2 transition-all">
          <div className="flex items-center gap-2 text-emerald-400">
            <Mic className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider">1. Ghi Âm & Tin Nhắn Thoại (Voice)</h3>
          </div>
          <p className="text-[11px] text-[#A0A0A0] leading-relaxed">
            Giữ micro trên Telegram nói tự nhiên bằng tiếng Việt. Gemini AI giải mã âm thanh và tự động tạo công việc/ghi chú kèm thời hạn và mức độ ưu tiên.
          </p>
        </div>

        {/* Card 2: Quoted Message Actions */}
        <div className="bg-[#151515] border border-[#2A2A2A] hover:border-[#D4AF37]/40 p-4 rounded-sm space-y-2 transition-all">
          <div className="flex items-center gap-2 text-amber-400">
            <CornerDownRight className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider">2. Quoted Reply (Trả lời trích dẫn)</h3>
          </div>
          <p className="text-[11px] text-[#A0A0A0] leading-relaxed">
            Vuốt để trả lời tin nhắc việc của Bot trên Telegram với từ khóa: <em>"Xong rồi"</em>, <em>"Hoãn 15 phút"</em>, <em>"Xóa đi"</em> để thao tác tức thì.
          </p>
        </div>

        {/* Card 3: Interactive Inline Keyboards */}
        <div className="bg-[#151515] border border-[#2A2A2A] hover:border-[#D4AF37]/40 p-4 rounded-sm space-y-2 transition-all">
          <div className="flex items-center gap-2 text-indigo-400">
            <MousePointerClick className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider">3. Nút Bấm Inline 1-Click</h3>
          </div>
          <p className="text-[11px] text-[#A0A0A0] leading-relaxed">
            Tất cả thông báo nhắc nhở và báo cáo đều đính kèm nút bấm <strong>[✅ Đã xong]</strong>, <strong>[⏰ Hoãn]</strong>, <strong>[📋 Việc hôm nay]</strong>.
          </p>
        </div>
      </div>

      {/* AI Daily Briefing & Voice to Task Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Module 1: AI Daily Briefing Center */}
        <div className="bg-[#151515] border border-[#D4AF37]/40 p-5 rounded-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2">
            <div className="flex items-center gap-2 text-[#D4AF37]">
              <CalendarCheck2 className="w-4 h-4" />
              <h2 className="text-sm font-bold uppercase tracking-wider">
                Bản Tin Sáng & Tối (AI Daily Briefing)
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
                  Bản Tin Sáng ({(telegramConfig.morningBriefingHour ?? 7).toString().padStart(2, '0')}:{(telegramConfig.morningBriefingMinute ?? 0).toString().padStart(2, '0')})
                </span>
                <span className="text-[10px] text-[#666666] group-hover:text-[#D4AF37]">Gửi Ngay →</span>
              </div>
              <p className="text-[11px] text-[#888888]">
                {isGeneratingBriefing === 'morning' ? '⏳ Đang tổng hợp AI...' : 'Thời tiết, việc ưu tiên hôm nay, mẹo tập trung (Giờ VN)'}
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
                  Báo Cáo Tối ({(telegramConfig.eveningBriefingHour ?? 21).toString().padStart(2, '0')}:{(telegramConfig.eveningBriefingMinute ?? 0).toString().padStart(2, '0')})
                </span>
                <span className="text-[10px] text-[#666666] group-hover:text-[#D4AF37]">Gửi Ngay →</span>
              </div>
              <p className="text-[11px] text-[#888888]">
                {isGeneratingBriefing === 'evening' ? '⏳ Đang tổng hợp AI...' : 'Tổng kết việc đã xong, việc tồn & kế hoạch mai (Giờ VN)'}
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
                Nhận Diện Tin Nhắn Thoại & Tệp
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
              <span className="bg-[#151515] px-2 py-1 rounded border border-[#2A2A2A]">🧠 Gemini Audio Decoding</span>
              <span>➔</span>
              <span className="bg-[#151515] px-2 py-1 rounded border border-[#2A2A2A]">⚡ Autonomous Tool Calling</span>
              <span>➔</span>
              <span className="bg-[#151515] px-2 py-1 rounded border border-[#2A2A2A]">🔥 Firestore Realtime Sync</span>
            </div>
          </div>

          <div className="space-y-1 text-xs">
            <span className="text-[11px] text-[#888888] font-bold">Thử nghiệm câu lệnh mẫu:</span>
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

      {/* Interactive Telegram 2-Way Bot Simulator & Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Simulator (8 cols) */}
        <div className="lg:col-span-8 bg-[#151515] border border-[#2A2A2A] rounded-sm p-5 space-y-4">
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
          <div className="p-4 bg-[#0C0C0C] rounded-sm border border-[#2A2A2A] h-[380px] overflow-y-auto space-y-3">
            {simulatorChat.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] p-3 rounded-sm text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.sender === 'user'
                      ? 'bg-[#D4AF37] text-black font-semibold shadow'
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
              className="px-5 py-2.5 rounded-sm bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
            >
              Gửi
            </button>
          </div>
        </div>

        {/* Right Notification Audit Trail (4 cols) */}
        <div className="lg:col-span-4 bg-[#151515] border border-[#2A2A2A] rounded-sm p-5 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#D4AF37]" />
                <h3 className="text-sm font-editorial-serif font-bold text-white">Lịch Sử Thông Báo</h3>
              </div>
              <span className="text-[10px] text-[#666666] font-mono">{notificationLogs.length} events</span>
            </div>

            <div className="space-y-2 max-h-[360px] overflow-y-auto">
              {notificationLogs.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#666666] italic">
                  Chưa có thông báo nào được ghi nhận.
                </div>
              ) : (
                notificationLogs.map(log => (
                  <div key={log.id} className="p-3 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-editorial-serif font-bold text-white truncate max-w-[170px]">{log.title}</span>
                      <span className="text-[9px] font-mono text-[#666666]">
                        {new Date(log.timestamp).toLocaleTimeString('vi-VN')}
                      </span>
                    </div>
                    <p className="text-[#888888] text-[11px] leading-snug line-clamp-2">{log.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bottom Settings Link Card */}
          {onNavigateToSettings && (
            <div className="pt-3 border-t border-[#2A2A2A]">
              <button
                onClick={onNavigateToSettings}
                className="w-full py-2 bg-[#0C0C0C] hover:bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#D4AF37]/50 text-[#D4AF37] rounded-sm text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Mở Cài Đặt Token & Webhook</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
