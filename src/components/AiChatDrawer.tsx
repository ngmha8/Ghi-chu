import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, AiPersonaConfig, AiCommunicationStyle } from '../types/index.ts';
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
  Database,
  BrainCircuit,
  HeartHandshake,
  Zap,
  Clock,
  Calendar,
  CloudSun,
  Lightbulb,
  Mic,
  Settings2,
  Volume2,
  VolumeX,
  UserCheck,
  Save
} from 'lucide-react';
import { VoiceInputButton } from './VoiceInputButton.tsx';
import { api } from '../services/api.ts';

interface AiChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string, enableSearch: boolean) => Promise<void>;
  onClearMessages: () => void;
  initialPrompt?: string;
}

type AiChatMode = 'executive' | 'deep_think' | 'empathy';

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
  const [activeMode, setActiveMode] = useState<AiChatMode>('executive');
  const [isCopied, setIsCopied] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Quick Persona Modal state
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [personaConfig, setPersonaConfig] = useState<AiPersonaConfig | null>(null);
  const [isSavingPersona, setIsSavingPersona] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadPersona();
    }
  }, [isOpen]);

  const loadPersona = async () => {
    try {
      const p = await api.getAiPersonaConfig();
      setPersonaConfig(p);
    } catch (e) {
      console.warn('Could not load persona in drawer:', e);
    }
  };

  const handleSaveQuickPersona = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personaConfig) return;
    setIsSavingPersona(true);
    try {
      const updated = await api.saveAiPersonaConfig(personaConfig);
      setPersonaConfig(updated);
      setIsPersonaModalOpen(false);
    } catch (err: any) {
      alert(`Lỗi khi lưu thiết lập: ${err?.message}`);
    } finally {
      setIsSavingPersona(false);
    }
  };

  // Instant Audio Readout (Web Speech API TTS)
  const handleSpeakText = (text: string, msgId: string) => {
    if (!('speechSynthesis' in window)) {
      alert('Trình duyệt của bạn không hỗ trợ tính năng phát âm thanh.');
      return;
    }

    if (speakingMessageId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();
    
    // Clean markdown before speaking
    const cleanText = text
      .replace(/[*#_`~>[\]]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .slice(0, 1500);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'vi-VN';
    utterance.rate = personaConfig?.speechRate || 1.05;
    utterance.pitch = 1.0;

    // Pick Vietnamese voice if available
    const voices = window.speechSynthesis.getVoices();
    const vnVoice = voices.find(v => v.lang.includes('vi') || v.name.toLowerCase().includes('vietnam') || v.name.toLowerCase().includes('vietnamese'));
    if (vnVoice) {
      utterance.voice = vnVoice;
    }

    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    setSpeakingMessageId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    let query = inputText.trim();
    if (activeMode === 'deep_think') {
      query = `[Chế độ Cố vấn Chiến lược & Phân tích Sâu]: ${query}`;
    } else if (activeMode === 'empathy') {
      query = `[Chế độ Lắng nghe & Đồng hành Tâm sự]: ${query}`;
    }

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
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[540px] bg-[#0F0F0F] border-l border-[#2A2A2A] shadow-2xl flex flex-col transition-all duration-300">
      
      {/* Drawer Header */}
      <div className="p-4 bg-[#151515] border-b border-[#2A2A2A] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-sm bg-[#1A1A1A] border border-[#D4AF37]/50 flex items-center justify-center shadow-inner">
            <Sparkles className="w-4.5 h-4.5 text-[#D4AF37]" />
          </div>
          <div>
            <h2 className="text-sm font-editorial-serif font-bold text-white flex items-center gap-2">
              <span>Senior AI Executive Companion</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#0C0C0C] text-[#D4AF37] border border-[#D4AF37]/40 font-mono tracking-wider">
                Gemini 3.7
              </span>
            </h2>
            <p className="text-[10px] text-[#888888] italic">
              {personaConfig?.userHonorific ? `Gọi bạn: ${personaConfig.userHonorific}` : 'Đồng hành nhân văn'} • {personaConfig?.aiHonorific ? `AI: ${personaConfig.aiHonorific}` : 'Phân tích sắc sảo'} • Trực tiếp Firestore
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsPersonaModalOpen(true)}
            className="p-1.5 rounded-sm text-[#888888] hover:text-[#D4AF37] hover:bg-[#1A1A1A] transition-colors cursor-pointer"
            title="Tùy chỉnh xưng hô & phong cách AI"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClearMessages}
            className="p-1.5 rounded-sm text-[#888888] hover:text-[#E0E0E0] hover:bg-[#1A1A1A] transition-colors cursor-pointer"
            title="Xóa lịch sử trò chuyện"
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

      {/* Quick Persona Customization Modal */}
      {isPersonaModalOpen && personaConfig && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-[#151515] border border-[#D4AF37]/40 rounded-lg p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#D4AF37]" />
                Tùy Chỉnh Xưng Hô & Phong Cách AI
              </h3>
              <button onClick={() => setIsPersonaModalOpen(false)} className="text-[#888888] hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveQuickPersona} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#CCCCCC] font-semibold mb-1">
                  Cách AI gọi bạn (User Honorific):
                </label>
                <input
                  type="text"
                  value={personaConfig.userHonorific || ''}
                  onChange={(e) => setPersonaConfig({ ...personaConfig, userHonorific: e.target.value })}
                  placeholder="Ví dụ: Anh Nam, Sếp, Bạn, Em..."
                  className="w-full px-3 py-2 bg-[#0C0C0C] border border-[#333333] rounded-sm text-[#E0E0E0] focus:border-[#D4AF37] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[#CCCCCC] font-semibold mb-1">
                  Cách AI tự xưng (AI Honorific):
                </label>
                <input
                  type="text"
                  value={personaConfig.aiHonorific || ''}
                  onChange={(e) => setPersonaConfig({ ...personaConfig, aiHonorific: e.target.value })}
                  placeholder="Ví dụ: Em, Tôi, Trợ lý..."
                  className="w-full px-3 py-2 bg-[#0C0C0C] border border-[#333333] rounded-sm text-[#E0E0E0] focus:border-[#D4AF37] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[#CCCCCC] font-semibold mb-1">
                  Phong cách đồng hành:
                </label>
                <select
                  value={personaConfig.communicationStyle || 'warm_empathetic'}
                  onChange={(e) => setPersonaConfig({ ...personaConfig, communicationStyle: e.target.value as AiCommunicationStyle })}
                  className="w-full px-3 py-2 bg-[#0C0C0C] border border-[#333333] rounded-sm text-[#E0E0E0] focus:border-[#D4AF37] focus:outline-none"
                >
                  <option value="warm_empathetic">🌿 Tận tụy & Thấu cảm ấm áp</option>
                  <option value="executive_concise">⚡ Chánh văn phòng súc tích & Hành động</option>
                  <option value="strategic_advisor">🧠 Cố vấn chiến lược & Phân tích sâu</option>
                  <option value="energetic_action">🔥 Tràn đầy năng lượng & Thúc đẩy bứt phá</option>
                </select>
              </div>

              <div>
                <label className="block text-[#CCCCCC] font-semibold mb-1">
                  Lời nhắc quy tắc đặc biệt:
                </label>
                <input
                  type="text"
                  value={personaConfig.customInstructions || ''}
                  onChange={(e) => setPersonaConfig({ ...personaConfig, customInstructions: e.target.value })}
                  placeholder="Ví dụ: Ưu tiên tóm tắt hành động trước 16h00..."
                  className="w-full px-3 py-2 bg-[#0C0C0C] border border-[#333333] rounded-sm text-[#E0E0E0] focus:border-[#D4AF37] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={() => setIsPersonaModalOpen(false)}
                  className="px-3 py-1.5 rounded-sm bg-[#222222] text-[#888888] hover:text-white"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSavingPersona}
                  className="px-4 py-1.5 rounded-sm bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSavingPersona ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Persona Mode Switcher */}
      <div className="px-3 py-2 bg-[#121212] border-b border-[#222222] flex items-center gap-1.5 overflow-x-auto text-[11px]">
        <button
          onClick={() => setActiveMode('executive')}
          className={`px-2.5 py-1 rounded-sm flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
            activeMode === 'executive'
              ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/50 font-medium'
              : 'text-[#888888] hover:text-[#CCCCCC] bg-[#1A1A1A] border border-transparent'
          }`}
        >
          <Zap className="w-3 h-3" />
          <span>⚡ Đa Năng & Hành Động</span>
        </button>

        <button
          onClick={() => setActiveMode('deep_think')}
          className={`px-2.5 py-1 rounded-sm flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
            activeMode === 'deep_think'
              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/50 font-medium'
              : 'text-[#888888] hover:text-[#CCCCCC] bg-[#1A1A1A] border border-transparent'
          }`}
        >
          <BrainCircuit className="w-3 h-3" />
          <span>🧠 Tư Duy & Cố Vấn Sâu</span>
        </button>

        <button
          onClick={() => setActiveMode('empathy')}
          className={`px-2.5 py-1 rounded-sm flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
            activeMode === 'empathy'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/50 font-medium'
              : 'text-[#888888] hover:text-[#CCCCCC] bg-[#1A1A1A] border border-transparent'
          }`}
        >
          <HeartHandshake className="w-3 h-3" />
          <span>🌿 Lắng Nghe & Tâm Sự</span>
        </button>
      </div>

      {/* RAG & Search Status Bar */}
      <div className="px-4 py-1.5 bg-[#0C0C0C] border-b border-[#2A2A2A] flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 text-[#888888]">
          <Database className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>Firestore Cloud Database Active</span>
        </div>

        <label className="flex items-center gap-1.5 cursor-pointer text-[#E0E0E0]">
          <input
            type="checkbox"
            checked={enableSearch}
            onChange={(e) => setEnableSearch(e.target.checked)}
            className="w-3.5 h-3.5 accent-[#D4AF37] rounded-sm cursor-pointer"
          />
          <Globe className={`w-3.5 h-3.5 ${enableSearch ? 'text-[#D4AF37]' : 'text-[#666666]'}`} />
          <span>Web Search Grounding</span>
        </label>
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.length === 0 ? (
          <div className="py-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-[#181818] border border-[#D4AF37]/30 flex items-center justify-center mx-auto text-[#D4AF37]">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-editorial-serif font-bold text-white">Tôi có thể đồng hành gì cùng bạn hôm nay?</h3>
              <p className="text-xs text-[#888888] italic max-w-xs mx-auto leading-relaxed">
                Hỏi bất kỳ điều gì từ công việc, kỹ thuật lập trình, giải quyết vấn đề đến chia sẻ tâm tư cuộc sống:
              </p>
            </div>

            {/* Quick Prompt Cards */}
            <div className="grid grid-cols-1 gap-2 text-left pt-2">
              {[
                {
                  icon: <BrainCircuit className="w-3.5 h-3.5 text-indigo-400" />,
                  title: 'Bạn đã ghi nhớ và học được những gì về thói quen và quy tắc của tôi?',
                },
                {
                  icon: <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />,
                  title: 'Hôm nay tôi có những công việc nào gấp cần ưu tiên giải quyết?',
                },
                {
                  icon: <Lightbulb className="w-3.5 h-3.5 text-blue-400" />,
                  title: 'Phân tích giúp tôi chiến lược quản lý thời gian hiệu quả theo Ma trận Eisenhower.',
                },
                {
                  icon: <Zap className="w-3.5 h-3.5 text-amber-400" />,
                  title: 'Hãy suy ngẫm dữ liệu và đưa ra đúc kết chiến lược tăng hiệu suất tuần này.',
                },
                {
                  icon: <HeartHandshake className="w-3.5 h-3.5 text-emerald-400" />,
                  title: 'Dạo này tôi thấy khá căng thẳng vì khối lượng công việc, bạn có lời khuyên gì không?',
                },
                {
                  icon: <Calendar className="w-3.5 h-3.5 text-purple-400" />,
                  title: 'Tra cứu lịch âm hôm nay, xem ngày và giờ hoàng đạo xuất hành.',
                },
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInputText(item.title);
                  }}
                  className="w-full p-2.5 rounded-sm bg-[#151515] hover:bg-[#1A1A1A] border border-[#262626] text-xs text-[#E0E0E0] text-left transition-all hover:border-[#D4AF37]/50 flex items-start gap-2.5 group cursor-pointer"
                >
                  <span className="shrink-0 mt-0.5">{item.icon}</span>
                  <span className="leading-relaxed font-editorial-serif italic group-hover:text-white transition-colors">{item.title}</span>
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
                <div className="w-7 h-7 rounded-sm bg-[#1A1A1A] border border-[#2A2A2A] text-[#D4AF37] flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-[88%] space-y-2`}>
                <div
                  className={`p-3.5 rounded-sm text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[#D4AF37] text-black font-semibold shadow-md'
                      : 'bg-[#151515] border border-[#2A2A2A] text-[#E0E0E0]'
                  }`}
                >
                  {msg.content}
                </div>

                {/* Grounding Sources */}
                {msg.groundingSources && msg.groundingSources.length > 0 && (
                  <div className="p-2.5 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] text-[10px] space-y-1.5">
                    <span className="font-bold text-[#D4AF37] flex items-center gap-1 uppercase tracking-wider">
                      <Globe className="w-3 h-3" /> Nguồn tra cứu Google Search:
                    </span>
                    <div className="space-y-1">
                      {msg.groundingSources.map((src, idx) => (
                        <a
                          key={idx}
                          href={src.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#888888] hover:text-[#D4AF37] truncate flex items-center gap-1 transition-colors"
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
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => handleSpeakText(msg.content, msg.id)}
                        className="hover:text-[#D4AF37] flex items-center gap-1 cursor-pointer transition-colors"
                        title={speakingMessageId === msg.id ? 'Dừng đọc' : 'Nghe giọng đọc tiếng Việt'}
                      >
                        {speakingMessageId === msg.id ? (
                          <VolumeX className="w-3.5 h-3.5 text-[#D4AF37] animate-pulse" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                        <span>{speakingMessageId === msg.id ? 'Dừng' : 'Đọc'}</span>
                      </button>

                      <button
                        onClick={() => handleCopy(msg.content, msg.id)}
                        className="hover:text-[#E0E0E0] flex items-center gap-0.5 cursor-pointer transition-colors"
                      >
                        {isCopied === msg.id ? <Check className="w-3 h-3 text-[#D4AF37]" /> : <Copy className="w-3 h-3" />}
                        <span>{isCopied === msg.id ? 'Đã sao chép' : 'Sao chép'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-sm bg-[#1A1A1A] border border-[#2A2A2A] text-[#E0E0E0] flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-center gap-2.5 p-3 rounded-sm bg-[#151515] border border-[#2A2A2A] text-xs text-[#D4AF37] font-semibold animate-pulse">
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            <span>AI Assistant đang xử lý ngữ cảnh & tạo phản hồi thông minh...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handleSend} className="p-3 bg-[#151515] border-t border-[#2A2A2A] space-y-2">
        <div className="relative flex items-center gap-1.5">
          <input
            type="text"
            placeholder={
              activeMode === 'executive'
                ? 'Hỏi hoặc ra lệnh bằng chữ hoặc giọng nói...'
                : activeMode === 'deep_think'
                ? 'Nhập vấn đề phức tạp để AI phân tích...'
                : 'Chia sẻ tâm tư, câu chuyện của bạn...'
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading}
            className="flex-1 pl-3.5 pr-2 py-2.5 bg-[#0C0C0C] border border-[#2A2A2A] rounded-sm text-xs text-[#E0E0E0] placeholder-[#666666] focus:outline-none focus:border-[#D4AF37] transition-colors"
          />

          <VoiceInputButton
            onTranscript={(text) => {
              setInputText((prev) => (prev ? `${prev} ${text}` : text));
            }}
            size="sm"
            title="Nhập bằng giọng nói tiếng Việt"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-2 rounded-sm bg-[#D4AF37] hover:bg-[#c29f2e] disabled:opacity-50 text-black transition-colors cursor-pointer shadow-sm flex items-center justify-center shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>

    </div>
  );
};
