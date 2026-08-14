import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types/index.js';
import {
  Sparkles,
  Send,
  X,
  Globe,
  Bot,
  User,
  ExternalLink,
  Trash2,
  Copy,
  Check,
  Database
} from 'lucide-react';

interface AiChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string, enableSearch: boolean) => Promise<void>;
  onClearMessages: () => void;
  initialPrompt?: string;
}

export const AiChatDrawer: React.FC<AiChatDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  onClearMessages,
  initialPrompt,
}) => {
  const [inputText, setInputText] = useState('');
  const [enableSearch, setEnableSearch] = useState(true);
  const [isCopied, setIsCopied] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (initialPrompt) {
      setInputText(initialPrompt);
    }
  }, [initialPrompt]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const query = inputText;
    setInputText('');
    setIsLoading(true);

    try {
      await onSendMessage(query, enableSearch);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(id);
    setTimeout(() => setIsCopied(null), 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] bg-[#0F0F0F] border-l border-[#2A2A2A] shadow-2xl flex flex-col transition-all duration-300">
      
      {/* Drawer Header */}
      <div className="p-4 bg-[#151515] border-b border-[#2A2A2A] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-sm bg-[#1A1A1A] border border-[#D4AF37]/40 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div>
            <h2 className="text-sm font-editorial-serif font-bold text-white flex items-center gap-1.5">
              <span>Senior AI Assistant & Agent</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-sm bg-[#0C0C0C] text-[#D4AF37] border border-[#D4AF37]/30 uppercase font-mono tracking-wider">
                Gemini 3.7
              </span>
            </h2>
            <p className="text-[10px] text-[#888888] italic">Function Calling + Firestore Real-Time + Web Search</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClearMessages}
            className="p-1.5 rounded-sm text-[#888888] hover:text-[#E0E0E0] hover:bg-[#1A1A1A] transition-colors cursor-pointer"
            title="Xóa lịch sử chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-sm text-[#888888] hover:text-[#E0E0E0] hover:bg-[#1A1A1A] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* RAG & Search Toggle Bar */}
      <div className="px-4 py-2 bg-[#0C0C0C] border-b border-[#2A2A2A] flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-[#AAAAAA]">
          <Database className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>Dữ liệu nội bộ: Tasks, Notes & Drive</span>
        </div>

        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-[#E0E0E0]">
          <input
            type="checkbox"
            checked={enableSearch}
            onChange={(e) => setEnableSearch(e.target.checked)}
            className="w-3.5 h-3.5 accent-[#D4AF37] rounded-sm"
          />
          <Globe className={`w-3.5 h-3.5 ${enableSearch ? 'text-[#D4AF37]' : 'text-[#666666]'}`} />
          <span>Web Search</span>
        </label>
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.length === 0 ? (
          <div className="py-8 space-y-4 text-center">
            <Sparkles className="w-10 h-10 text-[#D4AF37] mx-auto" />
            <h3 className="text-sm font-editorial-serif font-bold text-white">Tôi có thể giúp gì cho công việc của bạn?</h3>
            <p className="text-xs text-[#888888] italic max-w-xs mx-auto leading-relaxed">
              AI chỉ kích hoạt khi bạn đặt câu hỏi. Hãy chọn các câu hỏi gợi ý bên dưới hoặc nhập nội dung riêng:
            </p>

            <div className="space-y-2 text-left pt-2">
              {[
                'Hôm nay tôi có những công việc nào cần hoàn thành gấp?',
                'Deadline của tệp Báo cáo Tài chính Quý 3 là khi nào?',
                'Tóm tắt giúp tôi tất cả ghi chú về kiến trúc AI và RAG.',
                'Tìm kiếm tin tức công nghệ mới nhất hôm nay trên Google Search.'
              ].map((promptText, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInputText(promptText);
                  }}
                  className="w-full p-2.5 rounded-sm bg-[#151515] hover:bg-[#1A1A1A] border border-[#2A2A2A] text-xs text-[#E0E0E0] text-left transition-colors hover:border-[#D4AF37]/50 font-editorial-serif italic cursor-pointer"
                >
                  💡 "{promptText}"
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-sm bg-[#1A1A1A] border border-[#2A2A2A] text-[#D4AF37] flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-[85%] space-y-2`}>
                <div
                  className={`p-3.5 rounded-sm text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[#D4AF37] text-black font-semibold'
                      : 'bg-[#151515] border border-[#2A2A2A] text-[#E0E0E0]'
                  }`}
                >
                  {msg.content}
                </div>

                {/* Grounding Sources */}
                {msg.groundingSources && msg.groundingSources.length > 0 && (
                  <div className="p-2.5 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] text-[10px] space-y-1">
                    <span className="font-bold text-[#D4AF37] flex items-center gap-1 uppercase tracking-wider">
                      <Globe className="w-3 h-3" /> Google Search:
                    </span>
                    <div className="space-y-1">
                      {msg.groundingSources.map((src, idx) => (
                        <a
                          key={idx}
                          href={src.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-[#888888] hover:text-[#D4AF37] truncate flex items-center gap-1 transition-colors"
                        >
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{src.title || src.url}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[9px] font-mono text-[#666666] px-1">
                  <span>{new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => handleCopy(msg.content, msg.id)}
                      className="hover:text-[#E0E0E0] flex items-center gap-0.5 cursor-pointer"
                    >
                      {isCopied === msg.id ? <Check className="w-3 h-3 text-[#D4AF37]" /> : <Copy className="w-3 h-3" />}
                      <span>{isCopied === msg.id ? 'Đã chép' : 'Sao chép'}</span>
                    </button>
                  )}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-sm bg-[#1A1A1A] border border-[#2A2A2A] text-[#E0E0E0] flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-center gap-2 p-3 rounded-sm bg-[#151515] border border-[#2A2A2A] text-xs text-[#D4AF37] font-bold animate-pulse">
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            <span>AI Assistant đang tra cứu RAG & tạo phản hồi...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handleSend} className="p-3 bg-[#151515] border-t border-[#2A2A2A] space-y-2">
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="Hỏi AI về công việc, deadline, ghi chú hoặc internet..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading}
            className="w-full pl-3 pr-10 py-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-xs text-[#E0E0E0] placeholder-[#666666] focus:outline-none focus:border-[#D4AF37]"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="absolute right-2 p-1.5 rounded-sm bg-[#D4AF37] hover:bg-[#c29f2e] disabled:opacity-50 text-black transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>

    </div>
  );
};
