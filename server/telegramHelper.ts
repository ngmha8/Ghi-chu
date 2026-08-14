import { Task } from '../src/types/index.ts';

export interface TelegramInlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export type TelegramInlineKeyboard = TelegramInlineButton[][];

/**
 * Send message with optional Inline Keyboard Markup
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  inlineKeyboard?: TelegramInlineKeyboard
): Promise<boolean> {
  if (!botToken || !chatId) return false;

  const payload: any = {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  };

  if (inlineKeyboard && inlineKeyboard.length > 0) {
    payload.reply_markup = {
      inline_keyboard: inlineKeyboard,
    };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data: any = await res.json();
    if (data.ok) return true;

    // Fallback without Markdown if markdown parsing failed
    delete payload.parse_mode;
    const fallbackRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const fallbackData: any = await fallbackRes.json();
    return !!fallbackData.ok;
  } catch (err) {
    console.warn('sendTelegramMessage error:', err);
    return false;
  }
}

/**
 * Answer a Telegram Callback Query to dismiss the loading animation
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
    { text: '📋 Tất cả việc', callback_data: 'cmd:tasks' },
    { text: '📝 Ghi chú', callback_data: 'cmd:notes' },
    { text: '🌤️ Thời tiết', callback_data: 'cmd:weather' },
  ]);

  return keyboard;
}
