import { Router, Request, Response } from 'express';
import {
  getDbTelegramConfig,
  saveDbTelegramConfig,
  getDbNotificationLogs,
  addDbNotificationLog,
} from '../firebaseDb.ts';
import {
  sendTelegramMessage,
  setTelegramBotCommands,
  deleteTelegramWebhook,
  getTelegramWebhookInfo,
  telegramApiFetch,
  TelegramInlineKeyboard,
} from '../telegramHelper.ts';
import {
  processTelegramUpdate,
  startTelegramPollingDaemon,
  TelegramEngineContext,
} from '../telegramBotEngine.ts';
import { getGeminiClient, processAiChat, UPLOADS_DIR } from '../aiService.ts';
import type { NotificationLog } from '../../src/types/index.ts';

const router = Router();

export function getTelegramEngineContext(): TelegramEngineContext {
  return {
    gemini: getGeminiClient(),
    uploadsDir: UPLOADS_DIR,
    processAiChat: (message, enableSearch, sessionId, history) =>
      processAiChat(message, enableSearch, sessionId, history),
  };
}

// GET /api/telegram/config
router.get('/config', async (req: Request, res: Response) => {
  try {
    const config = await getDbTelegramConfig();
    const logs = await getDbNotificationLogs();
    res.json({ config, logs });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error fetching telegram config' });
  }
});

// POST /api/telegram/config
router.post('/config', async (req: Request, res: Response) => {
  try {
    const updated = await saveDbTelegramConfig(req.body);
    res.json({ success: true, config: updated });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error saving telegram config' });
  }
});

// POST /api/telegram/test
router.post('/test', async (req: Request, res: Response) => {
  try {
    const telegramConfig = await getDbTelegramConfig();
    const msgText = req.body.message || 'Xin chào! Hệ thống AI Personal Assistant đã kết nối Telegram & Firestore thành công!';
    const newLog: NotificationLog = {
      id: `notif-${Date.now()}`,
      title: '💬 Thử nghiệm kết nối Telegram Bot (Cloud Firestore)',
      message: msgText,
      channel: 'telegram',
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
    await addDbNotificationLog(newLog);

    const keyboard: TelegramInlineKeyboard = [
      [
        { text: '📋 Xem việc hôm nay', callback_data: 'cmd:today' },
        { text: '🌤️ Thời tiết', callback_data: 'cmd:weather' }
      ],
      [
        { text: '🌅 Bản tin sáng', callback_data: 'cmd:morning' },
        { text: '🌙 Báo cáo tối', callback_data: 'cmd:evening' }
      ]
    ];

    const delivered = await sendTelegramMessage(telegramConfig.botToken, telegramConfig.chatId, msgText, keyboard);
    res.json({ success: true, log: newLog, telegramDelivered: delivered });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error sending test message' });
  }
});

// POST /api/telegram/set-webhook
router.post('/set-webhook', async (req: Request, res: Response) => {
  const telegramConfig = await getDbTelegramConfig();
  const { webhookUrl, secretToken } = req.body;
  if (!telegramConfig.botToken) {
    return res.status(400).json({ error: 'Chưa cấu hình Telegram Bot Token.' });
  }

  const host = req.get('host');
  const targetUrl = webhookUrl || `https://${host}/api/telegram/webhook`;
  const webhookSecret = secretToken || telegramConfig.webhookSecret || `sec_${Buffer.from(telegramConfig.botToken).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)}`;

  try {
    const payload: any = {
      url: targetUrl,
      secret_token: webhookSecret,
      drop_pending_updates: false,
    };

    const data = await telegramApiFetch(`bot${telegramConfig.botToken}/setWebhook`, {
      method: 'POST',
      body: payload,
      timeoutMs: 12000,
    });
    if (data.ok) {
      await saveDbTelegramConfig({
        webhookSecret,
        webhookUrl: targetUrl,
      });

      await addDbNotificationLog({
        id: `notif-${Date.now()}`,
        title: '🔗 Đã kích hoạt Webhook 2 chiều Telegram (Có Secret Token)',
        message: `Kích hoạt Webhook bảo mật tới ${targetUrl}`,
        channel: 'telegram',
        status: 'sent',
        timestamp: new Date().toISOString(),
      });
      return res.json({ success: true, webhookUrl: targetUrl, telegramResponse: data });
    } else {
      return res.status(400).json({ error: data.description || data.error || 'Không thể cài đặt Webhook trên Telegram' });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Lỗi kết nối tới Telegram API' });
  }
});

// GET /api/telegram/webhook-info
router.get('/webhook-info', async (req: Request, res: Response) => {
  const telegramConfig = await getDbTelegramConfig();
  if (!telegramConfig.botToken) {
    return res.status(400).json({ error: 'Chưa cấu hình Telegram Bot Token.' });
  }
  try {
    const data = await telegramApiFetch(`bot${telegramConfig.botToken}/getWebhookInfo`, {
      method: 'GET',
      timeoutMs: 8000,
    });
    res.json({ success: true, info: data.result || data, currentConfig: telegramConfig });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Lỗi kiểm tra Webhook' });
  }
});

// POST /api/telegram/webhook
router.post('/webhook', async (req: Request, res: Response) => {
  const telegramConfig = await getDbTelegramConfig();

  if (telegramConfig.webhookSecret) {
    const incomingSecret = req.get('x-telegram-bot-api-secret-token');
    if (incomingSecret && incomingSecret !== telegramConfig.webhookSecret) {
      console.warn('⚠️ Từ chối Telegram webhook: Secret token không hợp lệ.');
      return res.status(403).json({ error: 'Invalid secret token' });
    }
  }

  // Acknowledge Telegram API immediately
  res.status(200).json({ ok: true });

  // Process update asynchronously
  const updateBody = req.body || {};
  processTelegramUpdate(updateBody, getTelegramEngineContext()).catch(err => {
    console.warn('[Telegram Webhook Async Processing Error]:', err);
  });
});

// POST /api/telegram/set-commands
router.post('/set-commands', async (req: Request, res: Response) => {
  const telegramConfig = await getDbTelegramConfig();
  if (!telegramConfig.botToken) {
    return res.status(400).json({ error: 'Chưa cấu hình Telegram Bot Token.' });
  }
  const success = await setTelegramBotCommands(telegramConfig.botToken);
  res.json({
    success,
    message: success
      ? 'Đã cấu hình danh sách lệnh nhanh (/) thành công trên máy chủ Telegram!'
      : 'Không thể cập nhật danh sách lệnh lên Telegram',
  });
});

// POST /api/telegram/delete-webhook
router.post('/delete-webhook', async (req: Request, res: Response) => {
  const telegramConfig = await getDbTelegramConfig();
  if (!telegramConfig.botToken) {
    return res.status(400).json({ error: 'Chưa cấu hình Telegram Bot Token.' });
  }
  const deleted = await deleteTelegramWebhook(telegramConfig.botToken);
  await saveDbTelegramConfig({
    webhookUrl: '',
    webhookSecret: '',
  });
  startTelegramPollingDaemon(getTelegramEngineContext());
  res.json({
    success: deleted,
    message: 'Đã hủy Webhook. Hệ thống tự động chuyển sang chế độ Long-Polling tức thì.',
  });
});

export default router;
