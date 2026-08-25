import { Task } from '../src/types/index.ts';

export interface TelegramInlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export type TelegramInlineKeyboard = TelegramInlineButton[][];

/**
 * Send a chat action (typing, upload_document, record_voice) to provide instant visual feedback to user
 */
export async function sendTelegramChatAction(
  botToken: string,
  chatId: string | number,
  action: 'typing' | 'upload_document' | 'record_voice' | 'find_location' = 'typing'
): Promise<boolean> {
  if (!botToken || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        action,
      }),
    });
    const data: any = await res.json();
    return !!data.ok;
  } catch (err) {
    return false;
  }
}

/**
 * Split long message text (> 4000 chars) into safe logical chunks for Telegram API limit (4096 chars)
 */
export function splitTelegramMessage(text: string, maxLen = 3900): string[] {
  if (!text || text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    // Try finding the best splitting point: newline > period > space
    let splitIdx = remaining.lastIndexOf('\n\n', maxLen);
    if (splitIdx < maxLen * 0.5) {
      splitIdx = remaining.lastIndexOf('\n', maxLen);
    }
    if (splitIdx < maxLen * 0.5) {
      splitIdx = remaining.lastIndexOf('. ', maxLen);
      if (splitIdx > 0) splitIdx += 1;
    }
    if (splitIdx < maxLen * 0.5) {
      splitIdx = remaining.lastIndexOf(' ', maxLen);
    }
    if (splitIdx <= 0) {
      splitIdx = maxLen;
    }

    chunks.push(remaining.slice(0, splitIdx).trim());
    remaining = remaining.slice(splitIdx).trim();
  }

  return chunks;
}

/**
 * Send message with Markdown support, auto chunking for long content, and optional Inline Keyboard
 * Returns message ID of first sent chunk if successful
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string | number,
  text: string,
  inlineKeyboard?: TelegramInlineKeyboard,
  replyToMessageId?: number
): Promise<boolean> {
  const result = await sendTelegramMessageWithResult(botToken, chatId, text, inlineKeyboard, replyToMessageId);
  return result.success;
}

export async function sendTelegramMessageWithResult(
  botToken: string,
  chatId: string | number,
  text: string,
  inlineKeyboard?: TelegramInlineKeyboard,
  replyToMessageId?: number
): Promise<{ success: boolean; messageId?: number }> {
  if (!botToken || !chatId || !text) return { success: false };

  const chunks = splitTelegramMessage(text);
  let overallSuccess = true;
  let firstMessageId: number | undefined = undefined;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const isLastChunk = i === chunks.length - 1;

    const payload: any = {
      chat_id: chatId,
      text: chunk,
      parse_mode: 'Markdown',
    };

    if (isLastChunk && inlineKeyboard && inlineKeyboard.length > 0) {
      payload.reply_markup = {
        inline_keyboard: inlineKeyboard,
      };
    }

    if (i === 0 && replyToMessageId) {
      payload.reply_to_message_id = replyToMessageId;
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: any = await res.json();

      if (data.ok) {
        if (i === 0 && data.result?.message_id) {
          firstMessageId = data.result.message_id;
        }
        continue;
      }

      // If markdown error (e.g. Can't find end of entities), fallback without parse_mode
      console.warn('Telegram Markdown error, attempting plain-text fallback:', data.description);
      delete payload.parse_mode;
      const fallbackRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const fallbackData: any = await fallbackRes.json();
      if (fallbackData.ok) {
        if (i === 0 && fallbackData.result?.message_id) {
          firstMessageId = fallbackData.result.message_id;
        }
      } else {
        console.error('sendTelegramMessage failed:', fallbackData);
        overallSuccess = false;
      }
    } catch (err) {
      console.warn('sendTelegramMessage network error:', err);
      overallSuccess = false;
    }
  }

  return { success: overallSuccess, messageId: firstMessageId };
}

/**
 * Edit an existing Telegram message in-place for seamless real-time updates (e.g. from Transcribing -> Result)
 */
export async function editTelegramMessageText(
  botToken: string,
  chatId: string | number,
  messageId: number,
  text: string,
  inlineKeyboard?: TelegramInlineKeyboard
): Promise<boolean> {
  if (!botToken || !chatId || !messageId || !text) return false;

  const payload: any = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: 'Markdown',
  };

  if (inlineKeyboard && inlineKeyboard.length > 0) {
    payload.reply_markup = {
      inline_keyboard: inlineKeyboard,
    };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data: any = await res.json();
    if (data.ok) return true;

    // Fallback without parse_mode if formatting fails
    delete payload.parse_mode;
    const fallbackRes = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const fallbackData: any = await fallbackRes.json();
    return !!fallbackData.ok;
  } catch (err) {
    console.warn('editTelegramMessageText network error:', err);
    return false;
  }
}

/**
 * Register standard Bot Commands with Telegram API so the '/' menu shows on mobile & desktop
 */
export async function setTelegramBotCommands(botToken: string): Promise<boolean> {
  if (!botToken) return false;
  try {
    const commands = [
      { command: 'today', description: '📋 Danh sách deadline công việc hôm nay' },
      { command: 'tasks', description: '📋 Tất cả công việc chưa hoàn thành' },
      { command: 'notes', description: '📝 Ghi chú cá nhân & ý tưởng' },
      { command: 'morning', description: '🌅 Bản tin sáng AI Executive Briefing' },
      { command: 'evening', description: '🌙 Báo cáo tổng kết tối AI' },
      { command: 'weather', description: '🌤️ Dự báo thời tiết cập nhật' },
      { command: 'ask', description: '🤖 Trợ lý AI hỏi đáp & tạo việc nhanh' },
      { command: 'help', description: '💡 Hướng dẫn ra lệnh & Tin nhắn thoại' },
    ];

    const res = await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands }),
    });
    const data: any = await res.json();
    return !!data.ok;
  } catch (err) {
    console.warn('setTelegramBotCommands error:', err);
    return false;
  }
}

/**
 * Answer a Telegram Callback Query to dismiss the button loading spinner
 */
export async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  text?: string,
  showAlert: boolean = false
): Promise<boolean> {
  if (!botToken || !callbackQueryId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || 'Đã tiếp nhận yêu cầu!',
        show_alert: showAlert,
      }),
    });
    const data: any = await res.json();
    return !!data.ok;
  } catch (err) {
    console.warn('answerCallbackQuery error:', err);
    return false;
  }
}

/**
 * Fetch updates for Long Polling
 */
export async function getTelegramUpdates(
  botToken: string,
  offset: number = 0,
  timeoutSeconds: number = 20
): Promise<{ ok: boolean; result: any[] }> {
  if (!botToken) return { ok: false, result: [] };
  try {
    const url = `https://api.telegram.org/bot${botToken}/getUpdates?offset=${offset}&timeout=${timeoutSeconds}&allowed_updates=["message","edited_message","callback_query"]`;
    const res = await fetch(url);
    const data: any = await res.json();
    return data;
  } catch (err) {
    return { ok: false, result: [] };
  }
}

/**
 * Delete active webhook (useful before starting Long Polling)
 */
export async function deleteTelegramWebhook(botToken: string): Promise<boolean> {
  if (!botToken) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook?drop_pending_updates=false`, {
      method: 'POST',
    });
    const data: any = await res.json();
    return !!data.ok;
  } catch (err) {
    return false;
  }
}

/**
 * Get Webhook Info
 */
export async function getTelegramWebhookInfo(botToken: string): Promise<any> {
  if (!botToken) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const data: any = await res.json();
    return data.result || null;
  } catch (err) {
    return null;
  }
}

/**
 * Build inline keyboard for a specific Task reminder
 */
export function buildTaskReminderKeyboard(task: Task): TelegramInlineKeyboard {
  return [
    [
      { text: '✅ Đã xong', callback_data: `done:${task.id}` },
      { text: '⏰ Hoãn 15p', callback_data: `snooze:${task.id}:15` },
      { text: '⏰ Hoãn 1h', callback_data: `snooze:${task.id}:60` },
    ],
    [
      { text: '📋 Việc hôm nay', callback_data: 'cmd:today' },
      { text: '🗑️ Xóa việc này', callback_data: `del:${task.id}` },
    ]
  ];
}

/**
 * Build interactive keyboard for task lists (/today or /tasks)
 */
export function buildTaskListKeyboard(tasks: Task[]): TelegramInlineKeyboard {
  const keyboard: TelegramInlineKeyboard = [];

  // Add individual quick-complete buttons for up to 3 pending tasks
  const pendingTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'canceled').slice(0, 3);
  for (const t of pendingTasks) {
    keyboard.push([
      { text: `✅ Xong: ${t.title.slice(0, 22)}`, callback_data: `done:${t.id}` },
      { text: '⏰ +15p', callback_data: `snooze:${t.id}:15` },
    ]);
  }

  // Quick navigation row
  keyboard.push([
    { text: '📋 Việc hôm nay', callback_data: 'cmd:today' },
    { text: '📋 Tất cả việc', callback_data: 'cmd:tasks' },
    { text: '📝 Ghi chú', callback_data: 'cmd:notes' },
  ]);

  keyboard.push([
    { text: '🌅 Bản tin sáng', callback_data: 'cmd:morning' },
    { text: '🌙 Báo cáo tối', callback_data: 'cmd:evening' },
    { text: '🌤️ Thời tiết', callback_data: 'cmd:weather' },
  ]);

  return keyboard;
}
