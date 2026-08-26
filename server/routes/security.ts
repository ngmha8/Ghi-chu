import { Router, Request, Response } from 'express';
import {
  getDbSecurityPinConfig,
  saveDbSecurityPin,
  saveDbSecurityPinSettings,
  verifyDbSecurityPin,
} from '../firebaseDb.ts';

const router = Router();

// GET /api/security/pin
router.get('/pin', async (_req: Request, res: Response) => {
  try {
    const config = await getDbSecurityPinConfig();
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi đọc cấu hình mã PIN' });
  }
});

// POST /api/security/verify-pin
router.post('/verify-pin', async (req: Request, res: Response) => {
  try {
    const { pin } = req.body;
    const isValid = await verifyDbSecurityPin(pin);
    const config = await getDbSecurityPinConfig();
    res.json({ isValid, isEnabled: config.isEnabled });
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
      message: 'Đã cập nhật mã PIN bảo mật thành công cho toàn bộ hệ thống',
      settings: {
        isEnabled: updated.isEnabled,
        hasCustomPin: updated.pin !== '1234',
        autolockMinutes: updated.autolockMinutes,
        hint: updated.hint,
        updatedAt: updated.updatedAt,
      },
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
      settings: {
        isEnabled: updated.isEnabled,
        hasCustomPin: updated.pin !== '1234',
        autolockMinutes: updated.autolockMinutes,
        hint: updated.hint,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi cập nhật cài đặt bảo mật' });
  }
});

export default router;
