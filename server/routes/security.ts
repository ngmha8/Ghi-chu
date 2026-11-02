import { Router, Request, Response } from 'express';
import {
  getDbSecurityPinConfig,
  saveDbSecurityPin,
  saveDbSecurityPinSettings,
  verifyDbSecurityPin,
} from '../firebaseDb.ts';

const router = Router();

// Sliding-window failed verification rate-limit tracker
interface FailedPinTracker {
  count: number;
  lockedUntil: number;
  lastAttemptAt: number;
}
const pinRateLimitMap = new Map<string, FailedPinTracker>();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30000; // 30-second lockout after 5 consecutive failures

function getClientIdentifier(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'global_client';
}

// GET /api/security/pin
router.get('/pin', async (_req: Request, res: Response) => {
  try {
    const config = await getDbSecurityPinConfig();
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi đọc cấu hình mã PIN' });
  }
});

// POST /api/security/verify-pin - Protected with Rate-Limiting & Sliding Lockout
router.post('/verify-pin', async (req: Request, res: Response) => {
  try {
    const { pin } = req.body;
    const clientKey = getClientIdentifier(req);
    const now = Date.now();
    const config = await getDbSecurityPinConfig();

    let tracker = pinRateLimitMap.get(clientKey);

    // Clean up tracker if expired (idle for more than 5 minutes and not locked)
    if (tracker && tracker.lockedUntil <= now && now - tracker.lastAttemptAt > 300000) {
      pinRateLimitMap.delete(clientKey);
      tracker = undefined;
    }

    // Check if client is currently in lockout window
    if (tracker && tracker.lockedUntil > now) {
      const remainingSeconds = Math.ceil((tracker.lockedUntil - now) / 1000);
      return res.status(429).json({
        isValid: false,
        isEnabled: config.isEnabled,
        isLocked: true,
        retryAfterSeconds: remainingSeconds,
        error: `Mã PIN đã bị tạm khóa do nhập sai nhiều lần. Vui lòng đợi ${remainingSeconds} giây để thử lại.`,
      });
    }

    const isValid = await verifyDbSecurityPin(pin);

    if (isValid) {
      // Reset rate limit tracker on successful PIN entry
      pinRateLimitMap.delete(clientKey);
      return res.json({
        isValid: true,
        isEnabled: config.isEnabled,
        isLocked: false,
        remainingAttempts: MAX_FAILED_ATTEMPTS,
      });
    }

    // Handle failed verification attempt
    if (!tracker) {
      tracker = { count: 1, lockedUntil: 0, lastAttemptAt: now };
    } else {
      tracker.count += 1;
      tracker.lastAttemptAt = now;
    }

    if (tracker.count >= MAX_FAILED_ATTEMPTS) {
      tracker.lockedUntil = now + LOCKOUT_DURATION_MS;
      pinRateLimitMap.set(clientKey, tracker);
      return res.status(429).json({
        isValid: false,
        isEnabled: config.isEnabled,
        isLocked: true,
        retryAfterSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
        error: `Đã nhập sai mã PIN ${MAX_FAILED_ATTEMPTS} lần liên tiếp. Hệ thống tạm khóa 30 giây để bảo vệ an toàn.`,
      });
    }

    pinRateLimitMap.set(clientKey, tracker);
    const remaining = MAX_FAILED_ATTEMPTS - tracker.count;
    return res.json({
      isValid: false,
      isEnabled: config.isEnabled,
      isLocked: false,
      remainingAttempts: remaining,
      error: `Mã PIN không đúng (Còn ${remaining} lần thử trước khi tạm khóa)`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi kiểm tra mã PIN' });
  }
});

// PUT /api/security/pin
router.put('/pin', async (req: Request, res: Response) => {
  try {
    const { newPin, pin, hint, oldPin } = req.body;
    const targetPin = (newPin || pin || '').toString().trim();
    if (!targetPin || targetPin.length < 4) {
      return res.status(400).json({ error: 'Mã PIN bảo mật phải có từ 4 đến 8 chữ số' });
    }

    const currentConfig = await getDbSecurityPinConfig();
    if (oldPin !== undefined && currentConfig.hasCustomPin) {
      const isOldValid = await verifyDbSecurityPin(oldPin);
      if (!isOldValid) {
        return res.status(401).json({ error: 'Mã PIN hiện tại không chính xác' });
      }
    }

    const updated = await saveDbSecurityPin(targetPin, hint);
    res.json({
      success: true,
      message: 'Đã cập nhật mã PIN bảo mật (Salted SHA-256) thành công cho toàn bộ hệ thống',
      settings: updated,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lưu mã PIN' });
  }
});

// PUT /api/security/pin/settings
router.put('/pin/settings', async (req: Request, res: Response) => {
  try {
    const { isEnabled, autolockMinutes, hint } = req.body;
    const updates: any = {};
    if (isEnabled !== undefined) updates.isEnabled = Boolean(isEnabled);
    if (autolockMinutes !== undefined) updates.autolockMinutes = Number(autolockMinutes);
    if (hint !== undefined) updates.hint = String(hint).trim();

    const updated = await saveDbSecurityPinSettings(updates);
    res.json({
      success: true,
      message: 'Đã lưu cài đặt bảo mật thành công',
      settings: updated,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi cập nhật cài đặt bảo mật' });
  }
});

export default router;
