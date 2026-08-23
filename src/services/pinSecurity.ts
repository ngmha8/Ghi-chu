// PIN Security Service for Personal Assistant with Cryptographic SHA-256 Hashing

const STORAGE_PIN_HASH_KEY = 'ai_app_security_pin_hash';
const STORAGE_PIN_SALT_KEY = 'ai_app_security_pin_salt';
const STORAGE_PIN_LEGACY_KEY = 'ai_app_security_pin';
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

/**
 * Generate a random cryptographic salt
 */
function generateSalt(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

/**
 * SHA-256 Hash using browser Web Crypto API with synchronous fallback
 */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}:architect_os_secure_salt`);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Synchronous DJB2+SDBM fallback if Web Crypto is unavailable in non-secure context
  let hash = 5381;
  const str = `${salt}:${pin}:architect_os_secure_salt`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Quick synchronous hash check fallback for instant keypad response
 */
function quickSyncHash(pin: string, salt: string): string {
  let hash = 5381;
  const str = `${salt}:${pin}:architect_os_secure_salt`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export function getPinSettings(): PinSettings {
  if (typeof window === 'undefined') {
    return { isEnabled: true, hasCustomPin: false, autolockMinutes: 0, hint: 'Mã mặc định là 1234' };
  }
  
  const savedHash = localStorage.getItem(STORAGE_PIN_HASH_KEY);
  const legacyPin = localStorage.getItem(STORAGE_PIN_LEGACY_KEY);
  const isEnabledVal = localStorage.getItem(STORAGE_PIN_ENABLED_KEY);
  const autolockVal = localStorage.getItem(STORAGE_AUTOLOCK_KEY);
  const hintVal = localStorage.getItem(STORAGE_PIN_HINT_KEY);

  // Auto-migrate legacy plain text pin if exists
  if (legacyPin && !savedHash) {
    setPin(legacyPin, hintVal || undefined);
    localStorage.removeItem(STORAGE_PIN_LEGACY_KEY);
  }

  const hasCustom = Boolean(savedHash) || Boolean(legacyPin && legacyPin !== DEFAULT_PIN);

  return {
    isEnabled: isEnabledVal === null ? true : isEnabledVal === 'true',
    hasCustomPin: hasCustom,
    autolockMinutes: autolockVal ? parseInt(autolockVal, 10) : 0,
    hint: hintVal || 'Mã PIN mặc định ban đầu là 1234',
  };
}

export async function setPin(newPin: string, hint?: string): Promise<boolean> {
  if (!newPin || newPin.length < 4) return false;
  
  const salt = generateSalt();
  const hashed = await hashPin(newPin, salt);
  const quickHash = quickSyncHash(newPin, salt);

  localStorage.setItem(STORAGE_PIN_SALT_KEY, salt);
  localStorage.setItem(STORAGE_PIN_HASH_KEY, hashed);
  localStorage.setItem('ai_app_security_pin_quick', quickHash);
  localStorage.removeItem(STORAGE_PIN_LEGACY_KEY); // Remove plaintext pin

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

/**
 * Async verify PIN using SHA-256 cryptographic digest
 */
export async function verifyPinAsync(inputPin: string): Promise<boolean> {
  if (typeof window === 'undefined') return inputPin === DEFAULT_PIN;

  const savedHash = localStorage.getItem(STORAGE_PIN_HASH_KEY);
  const salt = localStorage.getItem(STORAGE_PIN_SALT_KEY);
  const legacyPin = localStorage.getItem(STORAGE_PIN_LEGACY_KEY);

  // Case 1: No saved hash yet -> check default PIN
  if (!savedHash || !salt) {
    if (legacyPin) return inputPin === legacyPin;
    return inputPin === DEFAULT_PIN;
  }

  // Case 2: SHA-256 verify
  const inputHash = await hashPin(inputPin, salt);
  return inputHash === savedHash;
}

/**
 * Synchronous verify PIN (supports quick hash and default PIN fallback)
 */
export function verifyPin(inputPin: string): boolean {
  if (typeof window === 'undefined') return inputPin === DEFAULT_PIN;

  const savedHash = localStorage.getItem(STORAGE_PIN_HASH_KEY);
  const quickHash = localStorage.getItem('ai_app_security_pin_quick');
  const salt = localStorage.getItem(STORAGE_PIN_SALT_KEY);
  const legacyPin = localStorage.getItem(STORAGE_PIN_LEGACY_KEY);

  if (!savedHash || !salt) {
    if (legacyPin) return inputPin === legacyPin;
    return inputPin === DEFAULT_PIN;
  }

  if (quickHash) {
    return quickSyncHash(inputPin, salt) === quickHash;
  }

  // Fallback check
  return false;
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
