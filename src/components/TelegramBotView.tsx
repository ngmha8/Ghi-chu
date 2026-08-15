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
  AlertCircle
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

  // Telegram 2-Way Bot Simulator Chat State
  const [simulatorChat, setSimulatorChat] = useState<Array<{ sender: 'user' | 'bot'; text: string; time: string }>>([
    {
      sender: 'bot',
      text: '🤖 *Chào bạn! Tôi là Telegram AI Productivity Assistant (2-Way Interactive Bot).* \n\nBạn có thể gửi tin nhắn thoại hoặc tin nhắn văn bản (ví dụ: "Thời tiết hôm nay", "Thêm việc họp sáng mai", /morning, /evening) hoặc bấm các nút bên dưới để điều khiển.',
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [customCommandInput, setCustomCommandInput] = useState('');
  const [isBotThinking, setIsBotThinking] = useState(false);

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
              <h1 className="text-xl font-editorial-serif font-bold text-white">Trung Tâm Tương Tác & Trợ Lý Telegram</h1>
              {isConfigured ? (
                <span className="text-[10px] bg-[#0C0C0C] text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Bot Đã Kết Nối
                </span>
              ) : (
                <span className="text-[10px] bg-[#0C0C0C] text-amber-400 border border-amber-800/60 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Chưa Có Token
                </span>
              )}
            </div>
            <p className="text-xs text-[#888888] italic">
              Nhận diện tin nhắn thoại (Voice to Task), AI Daily Briefing buổi sáng/tối và tương tác 2 chiều thời gian thực
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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

      {/* AI Daily Briefing & Voice to Task Overview */}
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
              <span className="bg-[#151515] px-2 py-1 rounded border border-[#2A2A2A]">🧠 Gemini Audio Decoding</span>
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
