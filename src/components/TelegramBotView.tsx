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
  PlusCircle
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

  const webhookUrl = `${window.location.origin}/api/telegram/webhook`;

  // Telegram 2-Way Bot Simulator Chat State
  const [simulatorChat, setSimulatorChat] = useState<Array<{ sender: 'user' | 'bot'; text: string; time: string }>>([
    {
      sender: 'bot',
      text: '🤖 *Chào bạn! Tôi là Telegram AI Productivity Assistant (2-Way Chat).*\n\nBạn có thể gửi bất kỳ câu hỏi nào (ví dụ: "Thời tiết hôm nay", "Công việc nào sắp hết hạn?") hoặc sử dụng các lệnh bên dưới.',
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
            <h1 className="text-xl font-editorial-serif font-bold text-white">Giao tiếp 2 chiều với ChatAI qua Telegram</h1>
            <p className="text-xs text-[#888888] italic">Nhắn tin trực tiếp với Trợ lý AI trên ứng dụng Telegram hoặc gửi câu hỏi tra cứu dữ liệu cá nhân</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            <span>AI 2-Way Chat Active</span>
          </span>
        </div>
      </div>

      {/* Group Chat & Direct Chat Fix Guide Banner */}
      <div className="bg-[#151515] border border-[#D4AF37]/40 p-4 rounded-sm space-y-3">
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
            {showCreateBotGuide ? '▲ Đóng Hướng Dẫn Tạo Bot' : '➕ Hướng Dẫn Tạo Bot Mới'}
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
                  Gõ lệnh <code className="bg-black text-[#D4AF37] px-1 py-0.5 rounded font-mono">/newbot</code> ➔ Đặt tên hiển thị (vd: <em>AI Productivity Assistant</em>) ➔ Đặt username cho Bot kết thúc bằng <code className="bg-black text-[#D4AF37] px-1 py-0.5 rounded font-mono">bot</code> (vd: <em>MyPersonalAI_Assistant_bot</em>).
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
                  Dán Token vào ô <strong>Telegram Bot Token</strong> bên dưới ➔ Bấm <strong>Lưu Cấu Hình</strong> ➔ Bấm <strong>Kích hoạt Webhook Tự động</strong>. Nhắn `/start` cho Bot mới để hoàn tất!
                </p>
              </div>
            </div>

            <div className="p-2.5 bg-[#1A1A1A] border border-[#D4AF37]/30 rounded-sm text-[#D4AF37] text-[11px] flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span><strong>Mẹo nhỏ:</strong> Muốn Bot tự đọc & trả lời mọi câu hỏi trong Nhóm mà không cần gõ <code className="bg-black text-[#D4AF37] px-1 py-0.5 rounded font-mono">/ask</code>, hãy nhắn <code className="bg-black text-[#D4AF37] px-1 py-0.5 rounded font-mono">/mybots</code> cho @BotFather ➔ Chọn Bot ➔ <strong>Bot Settings</strong> ➔ <strong>Group Privacy</strong> ➔ Bấm <strong>Turn off</strong>.</span>
            </div>
          </div>
        )}

        <p className="text-xs text-[#CCCCCC] leading-relaxed">
          Nếu bạn nhắn câu hỏi trong <strong>Nhóm Telegram (Group Chat)</strong> như trong ảnh mà Bot không trả lời, đó là do cơ chế <em>Group Privacy</em> mặc định của Telegram chặn tin nhắn thường. Hãy sử dụng 1 trong 3 giải pháp sau:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm space-y-1.5">
            <div className="font-bold text-[#D4AF37] flex items-center gap-1">
              <span>1️⃣ Chat 1-1 trực tiếp với Bot</span>
            </div>
            <p className="text-[#AAAAAA] text-[11px] leading-relaxed">
              Mở khung chat riêng 1-1 với Bot (không trong Nhóm). Nhắn tin bất kỳ như <em>"Thời tiết hôm nay"</em> hay <em>"Tổng hợp lịch làm việc sắp tới"</em>, AI sẽ trả lời tức thì 100%.
            </p>
          </div>

          <div className="p-3 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm space-y-1.5">
            <div className="font-bold text-[#D4AF37] flex items-center gap-1">
              <span>2️⃣ Dùng lệnh /ask trong Nhóm</span>
            </div>
            <p className="text-[#AAAAAA] text-[11px] leading-relaxed">
              Khi ở trong Nhóm, gõ thêm <strong>/ask</strong> ở đầu câu hỏi. Ví dụ: <code className="text-[#D4AF37] bg-[#1A1A1A] px-1 py-0.5 rounded font-mono text-[10px]">/ask Tổng hợp lịch làm việc sắp tới</code>
            </p>
          </div>

          <div className="p-3 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm space-y-1.5">
            <div className="font-bold text-[#D4AF37] flex items-center gap-1">
              <span>3️⃣ Tắt Group Privacy trên @BotFather</span>
            </div>
            <p className="text-[#AAAAAA] text-[11px] leading-relaxed">
              Vào Telegram tìm <strong>@BotFather</strong> → gõ <code className="text-[#D4AF37] bg-[#1A1A1A] px-1 py-0.5 rounded font-mono text-[10px]">/mybots</code> → chọn Bot → <strong>Bot Settings</strong> → <strong>Group Privacy</strong> → bấm <strong>Turn off</strong> để Bot tự đọc mọi tin nhắn trong Nhóm.
            </p>
          </div>
        </div>
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
                  <span className="text-[10px] text-[#D4AF37]">✨ Tự động cập nhật khi bạn nhắn tin cho Bot</span>
                </div>
                <input
                  type="text"
                  value={chatIdInput}
                  onChange={(e) => setChatIdInput(e.target.value)}
                  placeholder="Ví dụ: 123456789 (Hệ thống tự nhận diện khi bạn chat)"
                  className="w-full p-2 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] font-mono text-xs focus:outline-none focus:border-[#D4AF37]"
                />
                <p className="mt-1 text-[11px] text-[#888888]">
                  💡 <strong>Mẹo:</strong> Sau khi kích hoạt Webhook, bạn chỉ cần mở Bot trên Telegram và nhắn <code className="bg-[#1A1A1A] text-[#D4AF37] px-1 py-0.5 rounded font-mono">/start</code>, hệ thống sẽ tự động bắt và điền Chat ID của bạn vào đây.
                </p>
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
              <h2 className="text-sm font-editorial-serif font-bold text-white">Khung Chat Mô Phỏng Telegram AI (2-Way Live)</h2>
            </div>
            <span className="text-[10px] text-[#D4AF37] px-2 py-0.5 rounded-sm bg-[#0C0C0C] border border-[#D4AF37]/30 font-mono">
              AI Chat Ready
            </span>
          </div>

          {/* Quick Command & AI Prompt Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleExecuteCommand('Thời tiết Bắc Giang hôm nay')}
              className="px-2.5 py-1 rounded-sm bg-[#0C0C0C] text-[#D4AF37] border border-[#2A2A2A] hover:bg-[#D4AF37] hover:text-black text-xs font-bold transition-colors cursor-pointer"
            >
              🌤️ Thời tiết hôm nay
            </button>
            <button
              onClick={() => handleExecuteCommand('/today')}
              className="px-2.5 py-1 rounded-sm bg-[#0C0C0C] text-[#D4AF37] border border-[#2A2A2A] hover:bg-[#D4AF37] hover:text-black text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              /today (Deadline)
            </button>
            <button
              onClick={() => handleExecuteCommand('/tasks')}
              className="px-2.5 py-1 rounded-sm bg-[#0C0C0C] text-[#D4AF37] border border-[#2A2A2A] hover:bg-[#D4AF37] hover:text-black text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              /tasks (Công việc)
            </button>
            <button
              onClick={() => handleExecuteCommand('/notes')}
              className="px-2.5 py-1 rounded-sm bg-[#0C0C0C] text-[#D4AF37] border border-[#2A2A2A] hover:bg-[#D4AF37] hover:text-black text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              /notes (Ghi chú)
            </button>
            <button
              onClick={() => handleExecuteCommand('Hỏi AI về lịch họp dự án')}
              className="px-2.5 py-1 rounded-sm bg-[#0C0C0C] text-[#D4AF37] border border-[#2A2A2A] hover:bg-[#D4AF37] hover:text-black text-xs font-bold transition-colors cursor-pointer"
            >
              💬 Hỏi AI tự nhiên
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
              placeholder="Nhập tin nhắn hoặc câu hỏi bất kỳ (vd: /today, thời tiết hôm nay, hỏi deadline)..."
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
