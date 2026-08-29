import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  placeholder?: string;
  title?: string;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscript,
  className = '',
  size = 'md',
  title = 'Nhập liệu bằng giọng nói tiếng Việt (Gemini AI & Web Speech)',
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const [permissionError, setPermissionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopAll();
    };
  }, []);

  const stopAll = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {}
    }
    setIsRecording(false);
  };

  const startRecording = async () => {
    setIsRecording(true);
    setRecordingSeconds(0);
    audioChunksRef.current = [];

    // Start timer
    timerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);

    // Try Web Speech API first for zero-latency local speech-to-text
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    let speechRecognitionSucceeded = false;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'vi-VN';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript && transcript.trim()) {
            speechRecognitionSucceeded = true;
            onTranscript(transcript.trim());
            stopAll();
          }
        };

        recognition.onerror = (err: any) => {
          console.warn('Web Speech API error, falling back to Gemini Multimodal Audio:', err);
        };

        recognition.onend = () => {
          // If ended without recognition result, proceed to fallback buffer
        };

        recognition.start();
        speechRecognitionRef.current = recognition;
      } catch (e) {
        console.warn('SpeechRecognition initialization error:', e);
      }
    }

    // Simultaneously capture MediaRecorder audio stream as robust Gemini multimodal fallback
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop stream tracks
        stream.getTracks().forEach((track) => track.stop());

        if (speechRecognitionSucceeded) return;

        // Process audio with Gemini AI backend
        if (audioChunksRef.current.length > 0) {
          setIsProcessing(true);
          try {
            const audioBlob = new Blob(audioChunksRef.current, {
              type: mediaRecorder.mimeType || 'audio/webm',
            });
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
              const base64Data = (reader.result as string).split(',')[1];
              if (!base64Data) {
                setIsProcessing(false);
                return;
              }

              const res = await fetch('/api/voice/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  audioBase64: base64Data,
                  mimeType: audioBlob.type || 'audio/webm',
                }),
              });

              const data = await res.json();
              if (data.success && data.text && data.text.trim()) {
                onTranscript(data.text.trim());
              }
              setIsProcessing(false);
            };
          } catch (apiErr) {
            console.error('Gemini Voice fallback error:', apiErr);
            setIsProcessing(false);
          }
        }
      };

      mediaRecorder.start();
    } catch (mediaErr: any) {
      console.warn('Cannot access microphone:', mediaErr);
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setPermissionError('Vui lòng cho phép quyền truy cập Micro trên trình duyệt để ghi âm.');
      setTimeout(() => setPermissionError(null), 4000);
    }
  };

  const handleToggle = () => {
    if (isRecording) {
      stopAll();
    } else {
      startRecording();
    }
  };

  const sizeClasses = {
    sm: 'p-1.5 text-xs',
    md: 'p-2 text-sm',
    lg: 'p-2.5 text-base',
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isProcessing}
        title={title}
        className={`relative rounded-sm flex items-center gap-1.5 transition-all cursor-pointer select-none ${
          isRecording
            ? 'bg-red-500/20 text-red-400 border border-red-500/60 animate-pulse'
            : isProcessing
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
            : 'bg-[#1C1C1C] hover:bg-[#252525] text-[#A0A0A0] hover:text-[#D4AF37] border border-[#333333]'
        } ${sizeClasses[size]} ${className}`}
      >
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
        ) : isRecording ? (
          <>
            <MicOff className="w-4 h-4 text-red-400" />
            <span className="text-[11px] font-mono font-bold text-red-400">
              {recordingSeconds}s
            </span>
          </>
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </button>

      {permissionError && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-neutral-900 text-amber-300 border border-amber-500/50 rounded text-[11px] whitespace-nowrap shadow-xl z-50">
          ⚠️ {permissionError}
        </span>
      )}

      {isRecording && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-red-950 text-red-200 border border-red-700/60 rounded text-[10px] whitespace-nowrap shadow-lg z-50 animate-bounce">
          🎙️ Đang nghe... Bấm để dừng
        </span>
      )}

      {isProcessing && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-amber-950 text-amber-200 border border-amber-700/60 rounded text-[10px] whitespace-nowrap shadow-lg z-50">
          ✨ Gemini AI đang nhận diện...
        </span>
      )}
    </div>
  );
};
