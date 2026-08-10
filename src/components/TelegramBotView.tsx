import React, { useState } from 'react';
import { TelegramConfig, NotificationLog } from '../types/index.js';
import {
  Bot,
  Send,
  CheckCircle2,
  MessageSquare,
  Zap,
  Settings,
  Clock
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

  // Telegram 2-Way Bot Simulator Chat State
  const [simulatorChat, setSimulatorChat] = useState<Array<{ sender: 'user' | 'bot'; text: string; time: string }>>([
    {
      sender: 'bot',
      text: '🤖 *Chào bạn! Tôi là Telegram Productivity Assistant Bot.*\n\nHệ thống đã sẵn sàng tự động nhắc nhở deadline và nhận lệnh tra cứu công việc.\n\nNhấn các nút bên dưới hoặc nhập lệnh để thử nghiệm!',
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [customCommandInput, setCustomCommandInput] = useState('');
  const [isBotThinking, setIsBotThinking] = useState(false);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConfig({
      botToken: tokenInput,
      chatId: chatIdInput,
      enabled: true,
      isConnected: true,
    });
  };

  const handleExecuteCommand = async (cmd: string) => {
    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    setSimulatorChat(prev => [...prev, { sender: 'user', text: cmd, time: timeStr }]);
    setIsBotThinking(true);

    try {
      const res = await onSendTelegramCommand(cmd);
      setSimulatorChat(prev => [
        ...prev,
        { sender: 'bot', text: res.reply || 'Đã nhận lệnh.', time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) }
      ]);
    } catch (err: any) {
      setSimulatorChat(prev => [
        ...prev,
        { sender: 'bot', text: `❌ Lỗi thực thi lệnh: ${err.message}`, time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) }
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
            <h1 className="text-xl font-editorial-serif font-bold text-white">Tích hợp Telegram Bot & Nhắc việc Tự động</h1>
            <p className="text-xs text-[#888888] italic">Gửi thông báo deadline tự động & hỗ trợ tra cứu công việc 2 chiều qua Webhook Bot</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
            <span>Webhook Ready</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Col (5 cols): Bot Setup Form & Test Notifications */}
        <div className="lg:col-span-5 space-y-6">
          {/* Configuration Form */}
          <div className="p-5 rounded-sm bg-[#151515] border border-[#2A2A2A] space-y-4">
            <div className="flex items-center gap-2 border-b border-[#2A2A2A] pb-3">
              <Settings className="w-4 h-4 text-[#D4AF37]" />
              <h2 className="text-sm font-editorial-serif font-bold text-white">Cấu hình Telegram Bot Token</h2>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#AAAAAA] font-bold uppercase tracking-wider text-[10px] mb-1">Telegram Bot Token (BotFather)</label>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="7891234560:AAH8xY_demo_token..."
                  className="w-full p-2 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] font-mono text-xs focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-[#AAAAAA] font-bold uppercase tracking-wider text-[10px] mb-1">Telegram Chat ID / User ID</label>
                <input
                  type="text"
                  value={chatIdInput}
                  onChange={(e) => setChatIdInput(e.target.value)}
                  placeholder="123456789"
                  className="w-full p-2 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] font-mono text-xs focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-[#AAAAAA] font-bold uppercase tracking-wider text-[10px] mb-1">Nhắc nhở trước deadline (Phút)</label>
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

          {/* Test Telegram Alert Box */}
          <div className="p-5 rounded-sm bg-[#151515] border border-[#2A2A2A] space-y-3">
            <div className="flex items-center gap-2 border-b border-[#2A2A2A] pb-2">
              <Zap className="w-4 h-4 text-[#D4AF37]" />
              <h3 className="text-sm font-editorial-serif font-bold text-white">Bắn thông báo thử nghiệm</h3>
            </div>

            <textarea
              value={testMessageText}
              onChange={(e) => setTestMessageText(e.target.value)}
              rows={3}
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
              <h2 className="text-sm font-editorial-serif font-bold text-white">Trình Mô Phỏng Telegram Bot (2-Way Interactive)</h2>
            </div>
            <span className="text-[10px] text-[#888888] px-2 py-0.5 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] font-mono">
              /api/telegram/webhook
            </span>
          </div>

          {/* Quick Command Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleExecuteCommand('/today')}
              className="px-2.5 py-1 rounded-sm bg-[#0C0C0C] text-[#D4AF37] border border-[#2A2A2A] hover:bg-[#D4AF37] hover:text-black text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              /today (Hôm nay)
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
              onClick={() => handleExecuteCommand('/ask Hôm nay tôi có việc gì cần làm gấp?')}
              className="px-2.5 py-1 rounded-sm bg-[#0C0C0C] text-[#D4AF37] border border-[#2A2A2A] hover:bg-[#D4AF37] hover:text-black text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              /ask (Hỏi AI)
            </button>
          </div>

          {/* Telegram Simulator Chat Box */}
          <div className="p-4 bg-[#0C0C0C] rounded-sm border border-[#2A2A2A] h-[320px] overflow-y-auto space-y-3">
            {simulatorChat.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-sm text-xs leading-relaxed whitespace-pre-wrap ${
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
                <Bot className="w-4 h-4" />
                <span>Telegram Bot đang xử lý câu hỏi...</span>
              </div>
            )}
          </div>

          {/* Custom Telegram Input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Nhập lệnh Telegram (vd: /today, /ask Deadline dự án A)..."
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
              Gửi Lệnh
            </button>
          </div>
        </div>

      </div>

      {/* Notification Log History Stream */}
      <div className="p-5 rounded-sm bg-[#151515] border border-[#2A2A2A] space-y-3">
        <div className="flex items-center gap-2 border-b border-[#2A2A2A] pb-2">
          <Clock className="w-4 h-4 text-[#D4AF37]" />
          <h3 className="text-sm font-editorial-serif font-bold text-white">Lịch sử thông báo đã phát (Notification Audit Trail)</h3>
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
