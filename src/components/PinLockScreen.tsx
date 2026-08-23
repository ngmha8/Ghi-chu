import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  Unlock,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Delete
} from 'lucide-react';
import { verifyPin, verifyPinAsync, unlockSession, getPinSettings } from '../services/pinSecurity.js';

interface PinLockScreenProps {
  onUnlock: () => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({ onUnlock }) => {
  const [pinInput, setPinInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [showDigits, setShowDigits] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [showHint, setShowHint] = useState(false);
  
  const settings = getPinSettings();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input automatically
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldownSeconds > 0) {
      const timer = setTimeout(() => {
        setCooldownSeconds(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownSeconds]);

  // Handle keyboard typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (cooldownSeconds > 0 || isUnlocking) return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigitPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleVerify(pinInput);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pinInput, cooldownSeconds, isUnlocking]);

  const handleDigitPress = async (digit: string) => {
    if (cooldownSeconds > 0 || isUnlocking) return;
    if (pinInput.length >= 8) return;

    setErrorMsg(null);
    const newPin = pinInput + digit;
    setPinInput(newPin);

    // Auto verify if reached 4 or more digits
    if (newPin.length >= 4) {
      if (verifyPin(newPin) || (await verifyPinAsync(newPin))) {
        triggerSuccessUnlock();
      }
    }
  };

  const handleBackspace = () => {
    if (cooldownSeconds > 0 || isUnlocking) return;
    setErrorMsg(null);
    setPinInput(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (cooldownSeconds > 0 || isUnlocking) return;
    setErrorMsg(null);
    setPinInput('');
  };

  const triggerSuccessUnlock = () => {
    setIsUnlocking(true);
    setErrorMsg(null);
    setTimeout(() => {
      unlockSession();
      onUnlock();
    }, 400);
  };

  const handleVerify = async (pinToTest: string) => {
    if (cooldownSeconds > 0 || isUnlocking) return;
    if (!pinToTest) {
      setErrorMsg('Vui lòng nhập mã PIN');
      return;
    }

    const isValid = verifyPin(pinToTest) || (await verifyPinAsync(pinToTest));
    if (isValid) {
      triggerSuccessUnlock();
    } else {
      const nextFailed = failedAttempts + 1;
      setFailedAttempts(nextFailed);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setPinInput('');

      if (nextFailed >= 5) {
        setCooldownSeconds(30);
        setErrorMsg('Đã nhập sai 5 lần. Vui lòng đợi 30 giây để thử lại.');
      } else {
        setErrorMsg(`Mã PIN không đúng! (Còn ${5 - nextFailed} lần thử)`);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-500 bg-[#090909] text-[#E0E0E0] flex flex-col items-center justify-center p-4 select-none overflow-y-auto">
      {/* Background Decorative Ambient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-amber-600/5 rounded-full blur-3xl" />
      </div>

      {/* Hidden input for software keyboard on mobile/tablets */}
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        value={pinInput}
        onChange={(e) => {
          const val = e.target.value.replace(/\D/g, '').slice(0, 8);
          setPinInput(val);
          if (val.length >= 4 && verifyPin(val)) {
            triggerSuccessUnlock();
          }
        }}
        className="opacity-0 absolute -z-10 w-0 h-0"
        aria-hidden="true"
      />

      {/* Lock Container */}
      <div className="w-full max-w-sm relative z-10 flex flex-col items-center">
        
        {/* Brand & Security Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-2xl mb-4 border ${
            isUnlocking
              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 scale-110'
              : 'bg-[#151515] border-[#D4AF37]/40 text-[#D4AF37]'
          }`}>
            {isUnlocking ? (
              <Unlock className="w-8 h-8 animate-bounce" />
            ) : (
              <Lock className="w-8 h-8" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <h1 className="font-editorial-serif italic text-2xl text-[#D4AF37] tracking-tight">
              Architect.OS
            </h1>
            <span className="text-[9px] uppercase tracking-[0.2em] font-bold px-2 py-0.5 rounded-sm bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/30">
              Security
            </span>
          </div>
          <p className="text-xs text-[#888888] uppercase tracking-widest mt-1">
            Hệ Thống Được Bảo Vệ Bằng Mã PIN
          </p>
        </div>

        {/* PIN Input Indicator Box */}
        <div className={`w-full bg-[#121212] border border-[#2A2A2A] rounded-xl p-5 mb-5 shadow-2xl transition-all duration-200 ${
          isShaking ? 'animate-[shake_0.4s_ease-in-out] border-rose-500/80 bg-rose-950/20' : ''
        }`}>
          <div className="flex items-center justify-between text-xs text-[#888888] mb-3">
            <span className="font-medium">Nhập mã PIN để mở khóa:</span>
            <button
              type="button"
              onClick={() => setShowDigits(!showDigits)}
              className="text-[#AAAAAA] hover:text-[#D4AF37] flex items-center gap-1 transition-colors cursor-pointer"
            >
              {showDigits ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span className="text-[10px] uppercase font-bold">{showDigits ? 'Ẩn' : 'Hiện'}</span>
            </button>
          </div>

          {/* Dots / Characters Display */}
          <div className="flex items-center justify-center gap-3 py-2 min-h-12">
            {[0, 1, 2, 3].map((index) => {
              const hasDigit = index < pinInput.length;
              return (
                <div
                  key={index}
                  className={`w-4 h-4 rounded-full transition-all duration-200 flex items-center justify-center font-mono font-bold text-sm ${
                    hasDigit
                      ? isUnlocking
                        ? 'bg-emerald-400 scale-110 shadow-[0_0_10px_rgba(52,211,153,0.8)]'
                        : 'bg-[#D4AF37] scale-110 shadow-[0_0_8px_rgba(212,175,55,0.6)] text-black'
                      : 'bg-[#222222] border border-[#333333]'
                  }`}
                >
                  {hasDigit && showDigits ? pinInput[index] : ''}
                </div>
              );
            })}
            {/* Show extra dots if PIN length > 4 */}
            {pinInput.length > 4 && (
              <span className="text-xs font-mono text-[#D4AF37] ml-1">
                +{pinInput.length - 4}
              </span>
            )}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mt-3 p-2 bg-rose-950/50 border border-rose-800/80 rounded text-center text-xs text-rose-300 flex items-center justify-center gap-1.5 animate-in fade-in">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Cooldown notice */}
          {cooldownSeconds > 0 && (
            <div className="mt-2 text-center text-xs text-amber-400 font-mono">
              ⏱️ Thử lại sau: {cooldownSeconds}s
            </div>
          )}
        </div>

        {/* Keypad Grid (0-9) */}
        <div className="w-full grid grid-cols-3 gap-2.5 mb-5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigitPress(digit)}
              disabled={cooldownSeconds > 0 || isUnlocking}
              className="h-14 rounded-xl bg-[#151515] hover:bg-[#202020] active:bg-[#D4AF37] active:text-black border border-[#262626] hover:border-[#D4AF37]/50 text-white font-mono text-xl font-bold transition-all shadow-md flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {digit}
            </button>
          ))}

          {/* Clear Button */}
          <button
            type="button"
            onClick={handleClear}
            disabled={cooldownSeconds > 0 || isUnlocking || pinInput.length === 0}
            className="h-14 rounded-xl bg-[#121212] hover:bg-[#1C1C1C] border border-[#222222] text-[#888888] hover:text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
          >
            Xóa
          </button>

          {/* Zero Button */}
          <button
            type="button"
            onClick={() => handleDigitPress('0')}
            disabled={cooldownSeconds > 0 || isUnlocking}
            className="h-14 rounded-xl bg-[#151515] hover:bg-[#202020] active:bg-[#D4AF37] active:text-black border border-[#262626] hover:border-[#D4AF37]/50 text-white font-mono text-xl font-bold transition-all shadow-md flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            0
          </button>

          {/* Backspace Button */}
          <button
            type="button"
            onClick={handleBackspace}
            disabled={cooldownSeconds > 0 || isUnlocking || pinInput.length === 0}
            className="h-14 rounded-xl bg-[#121212] hover:bg-[#1C1C1C] border border-[#222222] text-[#888888] hover:text-[#D4AF37] transition-all flex items-center justify-center cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Submit Button (for longer PINs or explicit submit) */}
        {pinInput.length >= 4 && (
          <button
            type="button"
            onClick={() => handleVerify(pinInput)}
            disabled={cooldownSeconds > 0 || isUnlocking}
            className="w-full py-3 rounded-xl bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer mb-3 animate-in fade-in"
          >
            <KeyRound className="w-4 h-4" />
            <span>Xác Nhận Mở Khóa</span>
          </button>
        )}

        {/* PIN Hint & Recovery Footer */}
        <div className="w-full text-center space-y-2 pt-2 border-t border-[#222222]">
          <button
            type="button"
            onClick={() => setShowHint(!showHint)}
            className="text-xs text-[#888888] hover:text-[#D4AF37] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{showHint ? 'Ẩn gợi ý mã PIN' : 'Gợi ý mã PIN / Quên mã PIN?'}</span>
          </button>

          {showHint && (
            <div className="p-3 bg-[#121212] border border-[#2A2A2A] rounded-lg text-xs text-[#CCCCCC] text-left space-y-1.5 animate-in fade-in">
              <div className="font-bold text-[#D4AF37] flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>Thông tin bảo mật:</span>
              </div>
              <p className="text-[11px] text-[#AAAAAA]">
                • {settings.hint || 'Mã PIN mặc định ban đầu là: 1234'}
              </p>
              <p className="text-[11px] text-[#777777]">
                • Bạn có thể đổi mã PIN hoặc tắt tính năng này bất cứ lúc nào trong mục <strong>Cài Đặt ➔ Bảo Mật & Mã PIN</strong> sau khi đăng nhập.
              </p>
            </div>
          )}
        </div>

      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
};
