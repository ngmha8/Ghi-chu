// PIN Security Service for Personal Assistant with Centralized Server Sync & SHA-256 Hashing
import { api } from './api.js';
import { SecurityPinSettings } from '../types/index.js';

const STORAGE_PIN_HASH_KEY = 'ai_app_security_pin_hash';
const STORAGE_PIN_SALT_KEY = 'ai_app_security_pin_salt';
const STORAGE_PIN_LEGACY_KEY = 'ai_app_security_pin';
const STORAGE_PIN_ENABLED_KEY = 'ai_app_pin_enabled';
const STORAGE_AUTOLOCK_KEY = 'ai_app_autolock_minutes';
const SESSION_UNLOCKED_KEY = 'ai_app_session_unlocked';
const STORAGE_LAST_ACTIVE_KEY = 'ai_app_last_active_time';
const STORAGE_PIN_HINT_KEY = 'ai_app_pin_hint';
const STORAGE_HAS_CUSTOM_PIN_KEY = 'ai_app_has_custom_pin';

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

/**
 * Sync PIN Settings from Central Server (Render DB / Server Store)
 */
export async function fetchPinSettingsFromServer(): Promise<PinSettings> {
  try {
    const serverSettings = await api.getSecurityPinSettings();
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_PIN_ENABLED_KEY, serverSettings.isEnabled ? 'true' : 'false');
      localStorage.setItem(STORAGE_AUTOLOCK_KEY, serverSettings.autolockMinutes.toString());
      localStorage.setItem(STORAGE_PIN_HINT_KEY, serverSettings.hint || 'Mã PIN mặc định ban đầu là 1234');
      localStorage.setItem(STORAGE_HAS_CUSTOM_PIN_KEY, serverSettings.hasCustomPin ? 'true' : 'false');
    }
    return {
      isEnabled: serverSettings.isEnabled,
      hasCustomPin: serverSettings.hasCustomPin,
      autolockMinutes: serverSettings.autolockMinutes,
      hint: serverSettings.hint || 'Mã PIN mặc định ban đầu là 1234',
    };
  } catch (e) {
    return getPinSettings();
  }
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
  const hasCustomVal = localStorage.getItem(STORAGE_HAS_CUSTOM_PIN_KEY);

  const hasCustom = hasCustomVal === 'true' || Boolean(savedHash) || Boolean(legacyPin && legacyPin !== DEFAULT_PIN);

  return {
    isEnabled: isEnabledVal === null ? true : isEnabledVal === 'true',
    hasCustomPin: hasCustom,
    autolockMinutes: autolockVal ? parseInt(autolockVal, 10) : 0,
    hint: hintVal || 'Mã PIN mặc định ban đầu là 1234',
  };
}

export async function setPin(newPin: string, hint?: string, oldPin?: string): Promise<boolean> {
  if (!newPin || newPin.length < 4) return false;
  
  try {
    // 1. Save to Central Server Database (syncs for all browsers, devices & Render instances)
    await api.updateSecurityPin({
      newPin: newPin.trim(),
      hint: hint !== undefined ? hint.trim() : undefined,
      oldPin: oldPin ? oldPin.trim() : undefined,
    });

    // 2. Update local cryptographic cache
    const salt = generateSalt();
    const hashed = await hashPin(newPin, salt);
    const quickHash = quickSyncHash(newPin, salt);

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_PIN_SALT_KEY, salt);
      localStorage.setItem(STORAGE_PIN_HASH_KEY, hashed);
      localStorage.setItem('ai_app_security_pin_quick', quickHash);
      localStorage.setItem(STORAGE_HAS_CUSTOM_PIN_KEY, 'true');
      localStorage.removeItem(STORAGE_PIN_LEGACY_KEY); // Remove plaintext pin

      if (hint !== undefined) {
        localStorage.setItem(STORAGE_PIN_HINT_KEY, hint);
      }
    }
    return true;
  } catch (error) {
    console.error('Failed to update PIN on server:', error);
    throw error;
  }
}

export async function setPinEnabled(enabled: boolean): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_PIN_ENABLED_KEY, enabled ? 'true' : 'false');
    if (!enabled) {
      sessionStorage.setItem(SESSION_UNLOCKED_KEY, 'true');
    }
  }

  try {
    await api.updateSecurityPinSettings({ isEnabled: enabled });
  } catch (e) {
    console.warn('Failed to sync PIN enabled state to server:', e);
  }
}

export async function setAutolockMinutes(minutes: number): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_AUTOLOCK_KEY, minutes.toString());
  }

  try {
    await api.updateSecurityPinSettings({ autolockMinutes: minutes });
  } catch (e) {
    console.warn('Failed to sync autolock minutes to server:', e);
  }
}

/**
 * Async verify PIN using Server API with fallback to local SHA-256 cryptographic digest
 */
export async function verifyPinAsync(inputPin: string): Promise<boolean> {
  if (typeof window === 'undefined') return inputPin === DEFAULT_PIN;

  try {
    // 1. Verify directly with Server (authoritative source across all machines & browsers)
    const result = await api.verifySecurityPin(inputPin);
    if (result.isValid) {
      // Refresh local hash on successful verify
      const salt = generateSalt();
      const hashed = await hashPin(inputPin, salt);
      const quickHash = quickSyncHash(inputPin, salt);
      localStorage.setItem(STORAGE_PIN_SALT_KEY, salt);
      localStorage.setItem(STORAGE_PIN_HASH_KEY, hashed);
      localStorage.setItem('ai_app_security_pin_quick', quickHash);
      localStorage.setItem(STORAGE_HAS_CUSTOM_PIN_KEY, inputPin !== DEFAULT_PIN ? 'true' : 'false');
      return true;
    } else {
      // Server is online and explicitly stated the PIN is incorrect
      return false;
    }
  } catch {
    // In case server is temporarily unreachable (offline mode), fallback to local cache
  }

  // 2. Offline / Local fallback check
  const hasCustom = localStorage.getItem(STORAGE_HAS_CUSTOM_PIN_KEY) === 'true';
  const savedHash = localStorage.getItem(STORAGE_PIN_HASH_KEY);
  const salt = localStorage.getItem(STORAGE_PIN_SALT_KEY);
  const legacyPin = localStorage.getItem(STORAGE_PIN_LEGACY_KEY);

  if (hasCustom && !savedHash) {
    // If a custom PIN is active on server, reject default 1234
    return false;
  }

  if (!savedHash || !salt) {
    if (legacyPin) return inputPin === legacyPin;
    return inputPin === DEFAULT_PIN;
  }

  const inputHash = await hashPin(inputPin, salt);
  return inputHash === savedHash;
}

/**
 * Synchronous verify PIN (supports quick hash and default PIN fallback)
 */
export function verifyPin(inputPin: string): boolean {
  if (typeof window === 'undefined') return inputPin === DEFAULT_PIN;

  const hasCustom = localStorage.getItem(STORAGE_HAS_CUSTOM_PIN_KEY) === 'true';
  const savedHash = localStorage.getItem(STORAGE_PIN_HASH_KEY);
  const quickHash = localStorage.getItem('ai_app_security_pin_quick');
  const salt = localStorage.getItem(STORAGE_PIN_SALT_KEY);
  const legacyPin = localStorage.getItem(STORAGE_PIN_LEGACY_KEY);

  if (hasCustom && !savedHash) {
    return false;
  }

  if (!savedHash || !salt) {
    if (legacyPin) return inputPin === legacyPin;
    return inputPin === DEFAULT_PIN;
  }

  if (quickHash) {
    return quickSyncHash(inputPin, salt) === quickHash;
  }

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
