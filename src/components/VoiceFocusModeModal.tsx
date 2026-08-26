import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  RefreshCw,
  Send,
  Sliders,
  BrainCircuit,
  HeartHandshake,
  Zap,
  Play,
  Square,
  MessageSquare
} from 'lucide-react';
import { api } from '../services/api.ts';
import type { ChatMessage, AiPersonaConfig } from '../types/index.ts';

interface VoiceFocusModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (text: string, enableSearch: boolean) => Promise<string | void>;
  messages: ChatMessage[];
  openAiChatWithPrompt?: (prompt: string) => void;
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

export const VoiceFocusModeModal: React.FC<VoiceFocusModeModalProps> = ({
  isOpen,
  onClose,
  onSendMessage,
  messages,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [isHandsFreeLoop, setIsHandsFreeLoop] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [personaMode, setPersonaMode] = useState<'executive' | 'deep_think' | 'empathy'>('executive');
  const [personaConfig, setPersonaConfig] = useState<AiPersonaConfig | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [aiSpeechText, setAiSpeechText] = useState<string>('');

  const speechRecognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<any>(null);
  const restartListeningTimerRef = useRef<any>(null);

  // Load persona config
  useEffect(() => {
    if (isOpen) {
      api.getAiPersonaConfig()
        .then(cfg => setPersonaConfig(cfg))
        .catch(err => console.warn('Could not fetch persona:', err));
      
      // Auto-start listening on open
      setTimeout(() => {
        startListeningSession();
      }, 500);
    } else {
      stopAllAudioAndRecognition();
    }

    return () => {
      stopAllAudioAndRecognition();
    };
  }, [isOpen]);

  // Audio level visualizer for microphone
  const startAudioVisualizer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (e) {
      console.warn('Audio visualizer init error:', e);
    }
  };

  const stopAudioVisualizer = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  };

  const stopAllAudioAndRecognition = () => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (restartListeningTimerRef.current) {
      clearTimeout(restartListeningTimerRef.current);
      restartListeningTimerRef.current = null;
    }
    stopAudioVisualizer();
    setVoiceState('idle');
  };

  const startListeningSession = () => {
    stopAllAudioAndRecognition();
    setVoiceState('listening');
    setLiveTranscript('');

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Trình duyệt của bạn không hỗ trợ Web Speech Recognition. Hãy dùng Chrome hoặc Edge để có trải nghiệm thoại tốt nhất.');
      setVoiceState('idle');
      return;
    }

    try {
      startAudioVisualizer();
      const recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN';
      recognition.continuous = true;
      recognition.interimResults = true;

      let finalRecognized = '';

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalRecognized += ' ' + event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        const currentText = (finalRecognized + ' ' + interim).trim();
        setLiveTranscript(currentText);

        // Reset silence timer whenever user speaks
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        if (currentText.length > 2) {
          // If silent for 1.8 seconds after speaking, auto-dispatch message to AI
          silenceTimerRef.current = setTimeout(() => {
            if (currentText.trim().length > 0) {
              dispatchUserSpokenText(currentText.trim());
            }
          }, 1800);
        }
      };

      recognition.onerror = (err: any) => {
        console.warn('Speech recognition error:', err);
        if (err.error === 'no-speech') {
          // Keep listening or restart
        } else {
          setVoiceState('idle');
          stopAudioVisualizer();
        }
      };

      recognition.onend = () => {
        // If ended unexpectedly while still in listening mode, check if we have transcript
        if (voiceState === 'listening' && liveTranscript.trim().length > 0) {
          dispatchUserSpokenText(liveTranscript.trim());
        }
      };

      recognition.start();
      speechRecognitionRef.current = recognition;
    } catch (err) {
      console.warn('SpeechRecognition start error:', err);
      setVoiceState('idle');
      stopAudioVisualizer();
    }
  };

  const dispatchUserSpokenText = async (text: string) => {
    if (!text.trim()) return;

    stopAllAudioAndRecognition();
    setVoiceState('processing');

    let query = text.trim();
    if (personaMode === 'deep_think') {
      query = `[Chế độ Cố vấn Chiến lược & Phân tích Sâu]: ${query}`;
    } else if (personaMode === 'empathy') {
      query = `[Chế độ Lắng nghe & Đồng hành Tâm sự]: ${query}`;
    }

    try {
      await onSendMessage(query, true);

      // Fetch the latest assistant message
      // Wait slightly for store state to populate
      setTimeout(() => {
        // Find latest assistant reply
        const lastMsg = [...messages].reverse().find(m => m.role === 'assistant');
        const replyText = lastMsg ? lastMsg.content : 'Tôi đã xử lý yêu cầu của bạn.';
        setAiSpeechText(replyText);
        speakAiResponse(replyText);
      }, 400);

    } catch (err: any) {
      setVoiceState('idle');
      alert(`Lỗi xử lý AI: ${err?.message}`);
    }
  };

  const speakAiResponse = (rawContent: string) => {
    if (!('speechSynthesis' in window) || isMuted) {
      setVoiceState('idle');
      if (isHandsFreeLoop) {
        restartListeningTimerRef.current = setTimeout(() => {
          startListeningSession();
        }, 1000);
      }
      return;
    }

    window.speechSynthesis.cancel();
    setVoiceState('speaking');

    // Clean markdown before speaking
    const cleanText = rawContent
      .replace(/[*#_`~>[\]]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .slice(0, 1500);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'vi-VN';
    utterance.rate = personaConfig?.speechRate || 1.05;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const vnVoice = voices.find(v => v.lang.includes('vi') || v.name.toLowerCase().includes('vietnam') || v.name.toLowerCase().includes('vietnamese'));
    if (vnVoice) {
      utterance.voice = vnVoice;
    }

    utterance.onend = () => {
      setVoiceState('idle');
      // If Hands-free loop is active, wait 1.2s then auto-listen again
      if (isHandsFreeLoop) {
        restartListeningTimerRef.current = setTimeout(() => {
          startListeningSession();
        }, 1200);
      }
    };

    utterance.onerror = () => {
      setVoiceState('idle');
      if (isHandsFreeLoop) {
        restartListeningTimerRef.current = setTimeout(() => {
          startListeningSession();
        }, 1000);
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const stopAiSpeechAndListen = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    startListeningSession();
  };

  if (!isOpen) return null;

  const latestAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');

  return (
    <div className="fixed inset-0 z-50 bg-[#0C0C0C]/98 backdrop-blur-xl flex flex-col justify-between p-6 sm:p-10 text-white animate-in fade-in duration-300">
      
      {/* Top Header Controls */}
      <div className="flex items-center justify-between w-full max-w-5xl mx-auto border-b border-[#222222] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-sm bg-[#1A1A1A] border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37]">
            <Sparkles className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-editorial-serif font-bold text-white tracking-tight">
                Voice Assistant Focus Mode
              </h2>
              <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-sm bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 font-mono font-bold">
                2-Way Live
              </span>
            </div>
            <p className="text-xs text-[#888888]">Chế độ đàm thoại giọng nói liên tục hai chiều với AI</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Hands-free Continuous Loop Toggle */}
          <button
            onClick={() => setIsHandsFreeLoop(!isHandsFreeLoop)}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm transition-all flex items-center gap-1.5 border cursor-pointer ${
              isHandsFreeLoop
                ? 'bg-[#1A1A1A] text-[#D4AF37] border-[#D4AF37]/40 shadow-sm'
                : 'bg-[#141414] text-[#777777] border-[#2A2A2A]'
            }`}
            title="Tự động lắng nghe lại sau khi AI trả lời xong"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isHandsFreeLoop ? 'animate-spin-slow text-[#D4AF37]' : ''}`} />
            <span className="hidden sm:inline">Rảnh tay (Hands-free)</span>
          </button>

          {/* Mute Toggle */}
          <button
            onClick={() => {
              if (!isMuted && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
              }
              setIsMuted(!isMuted);
            }}
            className={`p-2 rounded-sm border transition-colors cursor-pointer ${
              isMuted
                ? 'bg-rose-950/40 border-rose-800 text-rose-400'
                : 'bg-[#151515] border-[#2A2A2A] text-[#AAAAAA] hover:text-white'
            }`}
            title={isMuted ? 'Bật âm thanh AI' : 'Tắt âm thanh AI'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Persona Mode Switcher */}
          <div className="hidden md:flex items-center bg-[#151515] p-1 rounded-sm border border-[#2A2A2A]">
            <button
              onClick={() => setPersonaMode('executive')}
              className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-sm cursor-pointer transition-all ${
                personaMode === 'executive' ? 'bg-[#D4AF37] text-black' : 'text-[#888888] hover:text-white'
              }`}
            >
              Cố Vấn
            </button>
            <button
              onClick={() => setPersonaMode('deep_think')}
              className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-sm cursor-pointer transition-all ${
                personaMode === 'deep_think' ? 'bg-[#D4AF37] text-black' : 'text-[#888888] hover:text-white'
              }`}
            >
              Phân Tích Sâu
            </button>
            <button
              onClick={() => setPersonaMode('empathy')}
              className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-sm cursor-pointer transition-all ${
                personaMode === 'empathy' ? 'bg-[#D4AF37] text-black' : 'text-[#888888] hover:text-white'
              }`}
            >
              Thấu Cảm
            </button>
          </div>

          {/* Close Button */}
          <button
            onClick={() => {
              stopAllAudioAndRecognition();
              onClose();
            }}
            className="p-2 rounded-sm bg-[#1A1A1A] border border-[#2A2A2A] hover:border-rose-500 text-[#888888] hover:text-white transition-colors cursor-pointer"
            title="Đóng Voice Mode"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Focus Center: Animated Orb & Dynamic Visualizer */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full my-6 space-y-8">
        
        {/* Animated Central Glowing Orb */}
        <div className="relative flex items-center justify-center">
          {/* Outer Ripple Rings */}
          {voiceState === 'listening' && (
            <>
              <div
                className="absolute rounded-full border border-[#D4AF37]/30 animate-ping pointer-events-none"
                style={{ width: `${160 + audioLevel * 1.5}px`, height: `${160 + audioLevel * 1.5}px`, animationDuration: '2s' }}
              />
              <div
                className="absolute rounded-full bg-[#D4AF37]/10 blur-xl pointer-events-none transition-all duration-100"
                style={{ width: `${180 + audioLevel * 2}px`, height: `${180 + audioLevel * 2}px` }}
              />
            </>
          )}

          {voiceState === 'speaking' && (
            <div className="absolute w-56 h-56 rounded-full bg-emerald-500/10 blur-2xl animate-pulse pointer-events-none" />
          )}

          {voiceState === 'processing' && (
            <div className="absolute w-52 h-52 rounded-full bg-sky-500/15 blur-xl animate-spin-slow pointer-events-none" />
          )}

          {/* Core Interactive Disc */}
          <div
            onClick={() => {
              if (voiceState === 'listening') {
                if (liveTranscript.trim().length > 0) {
                  dispatchUserSpokenText(liveTranscript.trim());
                } else {
                  stopAllAudioAndRecognition();
                }
              } else if (voiceState === 'speaking') {
                stopAiSpeechAndListen();
              } else if (voiceState === 'idle') {
                startListeningSession();
              }
            }}
            className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full border-2 flex flex-col items-center justify-center shadow-2xl cursor-pointer transition-all duration-300 transform active:scale-95 ${
              voiceState === 'listening'
                ? 'bg-[#18150B] border-[#D4AF37] text-[#D4AF37] shadow-[#D4AF37]/20'
                : voiceState === 'speaking'
                ? 'bg-[#0E1A14] border-emerald-500 text-emerald-400 shadow-emerald-500/20'
                : voiceState === 'processing'
                ? 'bg-[#0B151F] border-sky-400 text-sky-300 animate-pulse'
                : 'bg-[#151515] border-[#333333] text-[#777777] hover:border-[#D4AF37]/60'
            }`}
          >
            {voiceState === 'listening' && <Mic className="w-12 h-12 stroke-[2.2] animate-bounce-subtle" />}
            {voiceState === 'speaking' && <Volume2 className="w-12 h-12 stroke-[2.2] animate-pulse" />}
            {voiceState === 'processing' && <Sparkles className="w-12 h-12 stroke-[2.2] animate-spin" />}
            {voiceState === 'idle' && <MicOff className="w-12 h-12 stroke-[1.8]" />}

            <span className="text-[10px] uppercase font-bold tracking-widest mt-2">
              {voiceState === 'listening' ? 'Đang nghe...' :
               voiceState === 'speaking' ? 'Đang nói...' :
               voiceState === 'processing' ? 'Đang suy nghĩ...' :
               'Chạm để nói'}
            </span>
          </div>
        </div>

        {/* Live Audio Waveform Bars */}
        <div className="flex items-center gap-1.5 h-10">
          {Array.from({ length: 16 }).map((_, idx) => {
            const isWaveActive = voiceState === 'listening' || voiceState === 'speaking';
            const randomHeight = isWaveActive
              ? Math.max(8, Math.min(36, Math.sin(idx + Date.now() / 200) * 16 + audioLevel * 0.4 + 10))
              : 6;

            return (
              <div
                key={idx}
                className={`w-1.5 rounded-full transition-all duration-75 ${
                  voiceState === 'listening'
                    ? 'bg-[#D4AF37]'
                    : voiceState === 'speaking'
                    ? 'bg-emerald-400'
                    : 'bg-[#2A2A2A]'
                }`}
                style={{ height: `${randomHeight}px` }}
              />
            );
          })}
        </div>

        {/* Dynamic Speech & AI Response Container */}
        <div className="w-full max-w-3xl space-y-4">
          
          {/* User Spoken Live Transcript Bubble */}
          <div className="p-4 rounded-sm bg-[#151515] border border-[#2A2A2A] min-h-[64px] flex items-center justify-center text-center">
            {liveTranscript ? (
              <p className="text-base sm:text-lg font-editorial-serif italic text-white leading-relaxed">
                "{liveTranscript}"
              </p>
            ) : voiceState === 'listening' ? (
              <p className="text-xs text-[#777777] italic flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-ping" />
                Hãy nói bất cứ điều gì (ví dụ: "Tạo công việc họp phòng ban...", "Tìm ghi chú về hợp đồng...")...
              </p>
            ) : (
              <p className="text-xs text-[#555555] italic">Chạm vào biểu tượng Microphone ở giữa để bắt đầu đàm thoại.</p>
            )}
          </div>

          {/* AI Response Display Box */}
          {latestAssistantMessage && (
            <div className="p-5 rounded-sm bg-[#0E0E0E] border border-[#2A2A2A] max-h-48 overflow-y-auto space-y-2">
              <div className="flex items-center justify-between border-b border-[#222222] pb-1.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#D4AF37]">
                    Phản hồi từ AI Assistant
                  </span>
                </div>
                {voiceState === 'speaking' && (
                  <button
                    onClick={() => {
                      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                      setVoiceState('idle');
                    }}
                    className="text-[10px] text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Square className="w-3 h-3 fill-rose-400" />
                    <span>Dừng đọc</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-[#D0D0D0] leading-relaxed whitespace-pre-wrap font-sans">
                {latestAssistantMessage.content}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Quick Suggestions Bar */}
      <div className="w-full max-w-4xl mx-auto border-t border-[#222222] pt-4">
        <p className="text-[10px] uppercase font-bold tracking-wider text-[#777777] mb-2 text-center">
          Gợi ý câu lệnh mẫu:
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {[
            'Hôm nay tôi có những việc gì cần làm?',
            'Tạo việc họp dự án lúc 3 giờ chiều',
            'Tìm kiếm ghi chú về hợp đồng',
            'Rà soát các nguy cơ trễ hạn tuần này',
          ].map((promptText, idx) => (
            <button
              key={idx}
              onClick={() => {
                setLiveTranscript(promptText);
                dispatchUserSpokenText(promptText);
              }}
              className="px-3 py-1.5 rounded-sm bg-[#151515] border border-[#2A2A2A] hover:border-[#D4AF37]/50 text-xs text-[#AAAAAA] hover:text-white transition-all cursor-pointer"
            >
              {promptText}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
};
