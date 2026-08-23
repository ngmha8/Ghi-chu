// PIN Security Service for Personal Assistant

const STORAGE_PIN_KEY = 'ai_app_security_pin';
const STORAGE_PIN_ENABLED_KEY = 'ai_app_pin_enabled';
const STORAGE_AUTOLOCK_KEY = 'ai_app_autolock_minutes';
const SESSION_UNLOCKED_KEY = 'ai_app_session_unlocked';
const STORAGE_LAST_ACTIVE_KEY = 'ai_app_last_active_time';
const STORAGE_PIN_HINT_KEY = 'ai_app_pin_hint';

export const DEFAULT_PIN = '1234';

export interface PinSettings {
  isEnabled: boolean;
  hasCustomPin: boolean;
  autolockMinutes: number; // 0 = only on reload/close, 5, 15, 30, 60
  hint: string;
}

export function getPinSettings(): PinSettings {
  if (typeof window === 'undefined') {
    return { isEnabled: true, hasCustomPin: false, autolockMinutes: 0, hint: 'Mã mặc định là 1234' };
  }
  
  const savedPin = localStorage.getItem(STORAGE_PIN_KEY);
  const isEnabledVal = localStorage.getItem(STORAGE_PIN_ENABLED_KEY);
  const autolockVal = localStorage.getItem(STORAGE_AUTOLOCK_KEY);
  const hintVal = localStorage.getItem(STORAGE_PIN_HINT_KEY);

  return {
    isEnabled: isEnabledVal === null ? true : isEnabledVal === 'true',
    hasCustomPin: Boolean(savedPin && savedPin !== DEFAULT_PIN),
    autolockMinutes: autolockVal ? parseInt(autolockVal, 10) : 0,
    hint: hintVal || 'Mã PIN mặc định ban đầu là 1234',
  };
}

export function getCurrentPin(): string {
  if (typeof window === 'undefined') return DEFAULT_PIN;
  return localStorage.getItem(STORAGE_PIN_KEY) || DEFAULT_PIN;
}

export function setPin(newPin: string, hint?: string): boolean {
  if (!newPin || newPin.length < 4) return false;
  localStorage.setItem(STORAGE_PIN_KEY, newPin);
  if (hint !== undefined) {
    localStorage.setItem(STORAGE_PIN_HINT_KEY, hint);
  }
  return true;
}

export function setPinEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_PIN_ENABLED_KEY, enabled ? 'true' : 'false');
  if (!enabled) {
    sessionStorage.setItem(SESSION_UNLOCKED_KEY, 'true');
  }
}

export function setAutolockMinutes(minutes: number): void {
  localStorage.setItem(STORAGE_AUTOLOCK_KEY, minutes.toString());
}

export function verifyPin(inputPin: string): boolean {
  const currentPin = getCurrentPin();
  return inputPin === currentPin;
}

export function isSessionUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  const settings = getPinSettings();
  if (!settings.isEnabled) return true;

  const isUnlocked = sessionStorage.getItem(SESSION_UNLOCKED_KEY) === 'true';
  if (!isUnlocked) return false;

  // Check auto-lock timer if configured (> 0)
  if (settings.autolockMinutes > 0) {
    const lastActive = parseInt(localStorage.getItem(STORAGE_LAST_ACTIVE_KEY) || '0', 10);
    const now = Date.now();
    const maxInactiveMs = settings.autolockMinutes * 60 * 1000;
    if (now - lastActive > maxInactiveMs) {
      // Inactive timeout reached -> lock
      lockSession();
      return false;
    }
  }

  return true;
}

export function unlockSession(): void {
  sessionStorage.setItem(SESSION_UNLOCKED_KEY, 'true');
  updateActivityTimestamp();
}

export function lockSession(): void {
  sessionStorage.removeItem(SESSION_UNLOCKED_KEY);
}

export function updateActivityTimestamp(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_LAST_ACTIVE_KEY, Date.now().toString());
  }
}
