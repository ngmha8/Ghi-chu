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
import {
  verifyPin,
  verifyPinAsync,
  verifyPinDetailedAsync,
  unlockSession,
  getPinSettings,
  fetchPinSettingsFromServer,
  PinSettings
} from '../services/pinSecurity.js';

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
  const [settings, setSettings] = useState<PinSettings>(() => getPinSettings());
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync settings with server immediately on mount
  useEffect(() => {
    fetchPinSettingsFromServer().then(s => {
      setSettings(s);
      if (!s.isEnabled) {
        unlockSession();
        onUnlock();
      }
    });
  }, [onUnlock]);

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
      const res = await verifyPinDetailedAsync(newPin);
      if (res.isValid) {
        triggerSuccessUnlock();
        return;
      }
      if (res.isLocked) {
        setCooldownSeconds(res.retryAfterSeconds || 30);
        setErrorMsg(res.error || 'Đã nhập sai quá nhiều lần. Vui lòng đợi 30 giây.');
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
        setPinInput('');
        return;
      }
      // If user typed maximum 8 digits and it is wrong, trigger full failure
      if (newPin.length >= 8) {
        handleVerify(newPin);
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

    const res = await verifyPinDetailedAsync(pinToTest);
    if (res.isValid) {
      triggerSuccessUnlock();
    } else {
      if (res.isLocked) {
        setCooldownSeconds(res.retryAfterSeconds || 30);
        setErrorMsg(res.error || 'Đã nhập sai 5 lần liên tiếp. Hệ thống tạm khóa 30 giây.');
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
        setPinInput('');
        return;
      }

      const nextFailed = failedAttempts + 1;
      setFailedAttempts(nextFailed);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setPinInput('');

      if (res.remainingAttempts !== undefined) {
        if (res.remainingAttempts <= 0) {
          setCooldownSeconds(30);
          setErrorMsg('Đã nhập sai 5 lần. Vui lòng đợi 30 giây để thử lại.');
        } else {
          setErrorMsg(res.error || `Mã PIN không đúng! (Còn ${res.remainingAttempts} lần thử)`);
        }
      } else if (nextFailed >= 5) {
        setCooldownSeconds(30);
        setErrorMsg('Đã nhập sai 5 lần. Vui lòng đợi 30 giây để thử lại.');
      } else {
        setErrorMsg(`Mã PIN không đúng! (Còn ${5 - nextFailed} lần thử)`);
      }
    }
  };

  return (
    <div className="pin-lock-container fixed inset-0 z-500 bg-slate-100/95 dark:bg-[#0A0E17]/95 backdrop-blur-md text-slate-800 dark:text-slate-100 flex flex-col items-center justify-center p-4 select-none overflow-y-auto transition-colors duration-200">
      {/* Background Decorative Ambient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/10 dark:bg-blue-500/15 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      {/* Hidden input for software keyboard on mobile/tablets */}
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        value={pinInput}
        onChange={async (e) => {
          const val = e.target.value.replace(/\D/g, '').slice(0, 8);
          setPinInput(val);
          if (val.length >= 4) {
            const ok = await verifyPinAsync(val);
            if (ok) {
              triggerSuccessUnlock();
            }
          }
        }}
        className="opacity-0 absolute -z-10 w-0 h-0"
        aria-hidden="true"
      />

      {/* Lock Container Card */}
      <div className="w-full max-w-sm relative z-10 flex flex-col items-center bg-white dark:bg-[#131C2E] border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xl dark:shadow-2xl p-6 sm:p-7 transition-colors">
        
        {/* Brand & Security Header */}
        <div className="flex flex-col items-center mb-5 text-center">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm mb-3 border ${
            isUnlocking
              ? 'bg-emerald-50 text-emerald-600 border-emerald-300 dark:bg-emerald-500/20 dark:border-emerald-500 dark:text-emerald-400 scale-110 shadow-emerald-500/20'
              : 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-[#1A263D] dark:border-blue-500/40 dark:text-blue-400'
          }`}>
            {isUnlocking ? (
              <Unlock className="w-7 h-7 animate-bounce" />
            ) : (
              <Lock className="w-7 h-7" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <h1 className="font-sans text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Architect.OS
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700/50">
              Security
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide mt-1">
            Hệ Thống Được Bảo Vệ Bằng Mã PIN
          </p>
        </div>

        {/* PIN Input Indicator Box */}
        <div className={`w-full bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-4 shadow-2xs transition-all duration-200 ${
          isShaking ? 'animate-[shake_0.4s_ease-in-out] border-rose-500/80 bg-rose-50/50 dark:bg-rose-950/20' : ''
        }`}>
          <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 font-medium mb-2.5">
            <span>Nhập mã PIN để mở khóa:</span>
            <button
              type="button"
              onClick={() => setShowDigits(!showDigits)}
              className="text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 flex items-center gap-1 transition-colors cursor-pointer"
            >
              {showDigits ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span className="text-[10px] uppercase font-bold">{showDigits ? 'Ẩn' : 'Hiện'}</span>
            </button>
          </div>

          {/* Dots / Characters Display */}
          <div className="flex items-center justify-center gap-3 py-1.5 min-h-10">
            {[0, 1, 2, 3].map((index) => {
              const hasDigit = index < pinInput.length;
              return (
                <div
                  key={index}
                  className={`w-4 h-4 rounded-full transition-all duration-200 flex items-center justify-center font-mono font-bold text-xs ${
                    hasDigit
                      ? isUnlocking
                        ? 'bg-emerald-500 scale-110 shadow-sm text-white'
                        : 'bg-blue-600 scale-110 shadow-sm text-white dark:bg-blue-500 dark:shadow-[0_0_8px_rgba(59,130,246,0.6)]'
                      : 'bg-slate-200 border border-slate-300 dark:bg-[#182338] dark:border-slate-700'
                  }`}
                >
                  {hasDigit && showDigits ? pinInput[index] : ''}
                </div>
              );
            })}
            {/* Show extra dots if PIN length > 4 */}
            {pinInput.length > 4 && (
              <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold ml-1">
                +{pinInput.length - 4}
              </span>
            )}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mt-2.5 p-2 bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-300 rounded-lg text-center text-xs flex items-center justify-center gap-1.5 animate-in fade-in font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Cooldown notice */}
          {cooldownSeconds > 0 && (
            <div className="mt-2 text-center text-xs text-amber-600 dark:text-amber-400 font-mono font-bold">
              ⏱️ Thử lại sau: {cooldownSeconds}s
            </div>
          )}
        </div>

        {/* Keypad Grid (0-9) */}
        <div className="w-full grid grid-cols-3 gap-2 mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigitPress(digit)}
              disabled={cooldownSeconds > 0 || isUnlocking}
              className="pin-digit-btn h-13 sm:h-14 rounded-xl flex items-center justify-center cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed select-none"
            >
              <span className="font-mono text-2xl font-bold tracking-tight pointer-events-none select-none">{digit}</span>
            </button>
          ))}

          {/* Clear Button */}
          <button
            type="button"
            onClick={handleClear}
            disabled={cooldownSeconds > 0 || isUnlocking || pinInput.length === 0}
            className="h-13 sm:h-14 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 hover:text-slate-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center cursor-pointer dark:bg-[#101726] dark:hover:bg-[#1A2438] dark:border-slate-800 dark:text-slate-300 dark:hover:text-white disabled:opacity-25 disabled:cursor-not-allowed select-none"
          >
            Xóa
          </button>

          {/* Zero Button */}
          <button
            type="button"
            onClick={() => handleDigitPress('0')}
            disabled={cooldownSeconds > 0 || isUnlocking}
            className="pin-digit-btn h-13 sm:h-14 rounded-xl flex items-center justify-center cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed select-none"
          >
            <span className="font-mono text-2xl font-bold tracking-tight pointer-events-none select-none">0</span>
          </button>

          {/* Backspace Button */}
          <button
            type="button"
            onClick={handleBackspace}
            disabled={cooldownSeconds > 0 || isUnlocking || pinInput.length === 0}
            className="h-13 sm:h-14 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 hover:text-blue-600 transition-all flex items-center justify-center cursor-pointer dark:bg-[#101726] dark:hover:bg-[#1A2438] dark:border-slate-800 dark:text-slate-300 dark:hover:text-blue-400 disabled:opacity-25 disabled:cursor-not-allowed select-none"
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
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mb-3 animate-in fade-in"
          >
            <KeyRound className="w-4 h-4" />
            <span>Xác Nhận Mở Khóa</span>
          </button>
        )}

        {/* PIN Hint & Recovery Footer */}
        <div className="w-full text-center space-y-2 pt-2.5 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowHint(!showHint)}
            className="text-xs text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{showHint ? 'Ẩn gợi ý mã PIN' : 'Gợi ý mã PIN / Quên mã PIN?'}</span>
          </button>

          {showHint && (
            <div className="p-3 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-700 dark:text-slate-300 text-left space-y-1.5 shadow-2xs animate-in fade-in">
              <div className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>Thông tin bảo mật:</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                • {settings.hasCustomPin 
                    ? (settings.hint && settings.hint !== 'Mã PIN mặc định là 1234' && settings.hint !== 'Mã PIN mặc định ban đầu là 1234'
                        ? `Gợi ý: ${settings.hint}` 
                        : 'Mã PIN đã được chủ tài khoản thiết lập tùy chỉnh.')
                    : (settings.hint || 'Mã PIN mặc định ban đầu là: 1234')}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
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
