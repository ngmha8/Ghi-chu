import dns from 'node:dns';
import { Task } from '../src/types/index.ts';

// Force Node.js to resolve IPv4 addresses before IPv6 to eliminate ConnectTimeoutError on environments without IPv6 routing
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

export interface TelegramInlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export type TelegramInlineKeyboard = TelegramInlineButton[][];

/**
 * Validates whether a Telegram Bot Token has the standard format (e.g. 123456789:ABCdefGHI...)
 */
export function isTelegramBotTokenValid(token?: string | null): boolean {
  if (!token || typeof token !== 'string') return false;
  const clean = token.trim();
  if (clean.length < 15) return false;
  if (clean.includes('YOUR_BOT_TOKEN') || clean.includes('PLACEHOLDER')) return false;
  return /^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(clean);
}

/**
 * Resilient wrapper for all Telegram API requests with IPv4 priority, AbortController timeouts, and error shielding
 */
export async function telegramApiFetch(
  endpoint: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    timeoutMs?: number;
  } = {}
): Promise<{ ok: boolean; result?: any; description?: string; error?: any }> {
  const timeoutMs = options.timeoutMs || 10000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const fetchOptions: RequestInit = {
      method: options.method || 'GET',
      headers: { ...(options.headers || {}) },
      signal: controller.signal,
    };

    if (options.body) {
      if (typeof options.body === 'string') {
        fetchOptions.body = options.body;
      } else {
        fetchOptions.body = JSON.stringify(options.body);
        (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
      }
    }

    const url = endpoint.startsWith('http') ? endpoint : `https://api.telegram.org/${endpoint}`;
    const res = await fetch(url, fetchOptions);
    clearTimeout(timer);

    const data: any = await res.json().catch(() => null);
    if (!data) {
      return { ok: false, description: `HTTP ${res.status} ${res.statusText}` };
    }
    return data;
  } catch (err: any) {
    clearTimeout(timer);
    const isTimeout = err?.name === 'AbortError' || err?.code === 'ETIMEDOUT' || err?.message?.includes('timeout');
    if (isTimeout) {
      console.warn(`[Telegram API Timeout]: Request to ${endpoint} timed out after ${timeoutMs}ms`);
    } else {
      console.warn(`[Telegram Network Notice]: Request to ${endpoint} failed:`, err?.message || err);
    }
    return { ok: false, error: err?.message || 'Network request failed', description: err?.message };
  }
}

/**
 * Cleanly escapes raw characters for Telegram HTML
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Converts standard Markdown to Telegram HTML format safely
 */
export function convertMarkdownToTelegramHtml(markdown: string): string {
  if (!markdown) return '';

  // Clean any accidental leftover raw placeholder tokens from legacy formats or prompt leakage
  let processed = markdown
    .replace(/(?:_{1,3})?TELEGRAM_INLINE_CODE_\d+(?:_{1,3})?/gi, '')
    .replace(/(?:_{1,3})?TELEGRAM_CODE_BLOCK_\d+(?:_{1,3})?/gi, '');

  // 1. Extract code blocks with syntax highlighting support
  const codeBlocks: { token: string; html: string }[] = [];
  processed = processed.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (_match, lang, code) => {
    const escapedCode = escapeHtml(code.trim());
    // Use strictly alphanumeric token to guarantee zero collisions with markdown regexes
    const token = `TGCODEBLOCKTOKEN${codeBlocks.length}X`;
    const html = lang
      ? `<pre><code class="language-${lang}">${escapedCode}</code></pre>`
      : `<pre><code>${escapedCode}</code></pre>`;
    codeBlocks.push({ token, html });
    return token;
  });

  // 2. Extract inline code
  const inlineCodes: { token: string; html: string }[] = [];
  processed = processed.replace(/`([^`\n]+)`/g, (_match, code) => {
    const escapedCode = escapeHtml(code);
    const token = `TGINLINECODETOKEN${inlineCodes.length}X`;
    inlineCodes.push({ token, html: `<code>${escapedCode}</code>` });
    return token;
  });

  // 3. Escape HTML special characters for the remaining text
  processed = escapeHtml(processed);

  // 4. Convert markdown links: [text](url) -> <a href="url">text</a>
  processed = processed.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2">$1</a>');

  // 5. Convert headers (# Header -> <b>Header</b>)
  processed = processed.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>');

  // 6. Convert blockquotes: > quote -> <blockquote>quote</blockquote>
  processed = processed.replace(/(?:^|\n)&gt;\s*(.+)(?=$|\n)/g, '\n<blockquote>$1</blockquote>');

  // 7. Convert bold: **text** or __text__
  processed = processed.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  processed = processed.replace(/__(.+?)__/g, '<u>$1</u>');

  // 8. Convert standalone *text* to <b>text</b> if bounded by non-word chars or line boundaries
  processed = processed.replace(/(?<=^|[\s(])\*([^*\n]+)\*(?=[\s).,:;!?]|$)/g, '<b>$1</b>');

  // 9. Convert standalone _text_ to <i>text</i> if bounded by non-word chars or line boundaries
  processed = processed.replace(/(?<=^|[\s(])_([^_\n]+)_(?=[\s).,:;!?]|$)/g, '<i>$1</i>');

  // 10. Convert strikethrough: ~~text~~
  processed = processed.replace(/~~(.+?)~~/g, '<s>$1</s>');

  // 11. Restore inline codes (global replace with zero collision)
  for (const item of inlineCodes) {
    processed = processed.split(item.token).join(item.html);
  }

  // 12. Restore code blocks (global replace with zero collision)
  for (const item of codeBlocks) {
    processed = processed.split(item.token).join(item.html);
  }

  // 13. Final safety cleanup to prevent any stray tokens
  processed = processed
    .replace(/(?:_{1,3})?TELEGRAM_INLINE_CODE_\d+(?:_{1,3})?/gi, '')
    .replace(/(?:_{1,3})?TELEGRAM_CODE_BLOCK_\d+(?:_{1,3})?/gi, '')
    .replace(/TG(?:INLINE|CODEBLOCK)TOKEN\d+X/gi, '');

  return processed.trim();
}

/**
 * Strips all HTML tags to guarantee a 100% fail-safe plain text message
 */
export function stripHtmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Send a chat action (typing, upload_document, record_voice) to provide instant visual feedback to user
 */
export async function sendTelegramChatAction(
  botToken: string,
  chatId: string | number,
  action: 'typing' | 'upload_document' | 'record_voice' | 'find_location' = 'typing'
): Promise<boolean> {
  if (!isTelegramBotTokenValid(botToken) || !chatId) return false;
  try {
    const res = await telegramApiFetch(`bot${botToken}/sendChatAction`, {
      method: 'POST',
      body: {
        chat_id: chatId,
        action,
      },
      timeoutMs: 5000,
    });
    return !!res.ok;
  } catch (err) {
    return false;
  }
}

/**
 * Split long message text (> 3800 chars) into safe logical chunks for Telegram API limit (4096 chars)
 */
export function splitTelegramMessage(text: string, maxLen = 3800): string[] {
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
 * Send message with safe HTML/Markdown support, auto chunking for long content, and optional Inline Keyboard
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
  if (!isTelegramBotTokenValid(botToken) || !chatId || !text) return { success: false };

  const chunks = splitTelegramMessage(text);
  let overallSuccess = true;
  let firstMessageId: number | undefined = undefined;

  for (let i = 0; i < chunks.length; i++) {
    const rawChunk = chunks[i];
    const htmlChunk = convertMarkdownToTelegramHtml(rawChunk);
    const isLastChunk = i === chunks.length - 1;

    const payload: any = {
      chat_id: chatId,
      text: htmlChunk,
      parse_mode: 'HTML',
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
      const data = await telegramApiFetch(`bot${botToken}/sendMessage`, {
        method: 'POST',
        body: payload,
        timeoutMs: 12000,
      });

      if (data.ok) {
        if (i === 0 && data.result?.message_id) {
          firstMessageId = data.result.message_id;
        }
        continue;
      }

      // If Telegram entity parsing fails, silently fall back to clean plain text
      delete payload.parse_mode;
      payload.text = stripHtmlToPlainText(rawChunk);

      const fallbackData = await telegramApiFetch(`bot${botToken}/sendMessage`, {
        method: 'POST',
        body: payload,
        timeoutMs: 12000,
      });

      if (fallbackData.ok) {
        if (i === 0 && fallbackData.result?.message_id) {
          firstMessageId = fallbackData.result.message_id;
        }
      } else {
        console.warn('[Telegram Send Error]:', fallbackData.description || fallbackData.error);
        overallSuccess = false;
      }
    } catch (err) {
      console.warn('[Telegram Network Notice]:', err);
      overallSuccess = false;
    }
  }

  return { success: overallSuccess, messageId: firstMessageId };
}

/**
 * Edit an existing Telegram message in-place for seamless real-time updates
 */
export async function editTelegramMessageText(
  botToken: string,
  chatId: string | number,
  messageId: number,
  text: string,
  inlineKeyboard?: TelegramInlineKeyboard
): Promise<boolean> {
  if (!isTelegramBotTokenValid(botToken) || !chatId || !messageId || !text) return false;

  const htmlText = convertMarkdownToTelegramHtml(text);

  const payload: any = {
    chat_id: chatId,
    message_id: messageId,
    text: htmlText,
    parse_mode: 'HTML',
  };

  if (inlineKeyboard && inlineKeyboard.length > 0) {
    payload.reply_markup = {
      inline_keyboard: inlineKeyboard,
    };
  }

  try {
    const data = await telegramApiFetch(`bot${botToken}/editMessageText`, {
      method: 'POST',
      body: payload,
      timeoutMs: 10000,
    });
    if (data.ok) return true;

    // Fallback without parse_mode if formatting fails
    delete payload.parse_mode;
    payload.text = stripHtmlToPlainText(text);
    const fallbackData = await telegramApiFetch(`bot${botToken}/editMessageText`, {
      method: 'POST',
      body: payload,
      timeoutMs: 10000,
    });
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
  if (!isTelegramBotTokenValid(botToken)) return false;
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

    const data = await telegramApiFetch(`bot${botToken}/setMyCommands`, {
      method: 'POST',
      body: { commands },
      timeoutMs: 10000,
    });
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
  if (!isTelegramBotTokenValid(botToken) || !callbackQueryId) return false;
  try {
    const data = await telegramApiFetch(`bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      body: {
        callback_query_id: callbackQueryId,
        text: text || 'Đã tiếp nhận yêu cầu!',
        show_alert: showAlert,
      },
      timeoutMs: 8000,
    });
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
  if (!isTelegramBotTokenValid(botToken)) return { ok: false, result: [] };
  try {
    const data = await telegramApiFetch(
      `bot${botToken}/getUpdates?offset=${offset}&timeout=${timeoutSeconds}&allowed_updates=["message","edited_message","callback_query"]`,
      {
        method: 'GET',
        timeoutMs: (timeoutSeconds + 6) * 1000,
      }
    );
    return {
      ok: !!data.ok,
      result: Array.isArray(data.result) ? data.result : [],
    };
  } catch (err) {
    return { ok: false, result: [] };
  }
}

/**
 * Delete active webhook (useful before starting Long Polling)
 */
export async function deleteTelegramWebhook(botToken: string): Promise<boolean> {
  if (!isTelegramBotTokenValid(botToken)) return false;
  try {
    const data = await telegramApiFetch(`bot${botToken}/deleteWebhook?drop_pending_updates=false`, {
      method: 'POST',
      timeoutMs: 10000,
    });
    return !!data.ok;
  } catch (err) {
    return false;
  }
}

/**
 * Get Webhook Info
 */
export async function getTelegramWebhookInfo(botToken: string): Promise<any> {
  if (!isTelegramBotTokenValid(botToken)) return null;
  try {
    const data = await telegramApiFetch(`bot${botToken}/getWebhookInfo`, {
      method: 'GET',
      timeoutMs: 8000,
    });
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
