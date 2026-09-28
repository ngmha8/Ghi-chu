import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { Task, Note, DriveFile, TelegramConfig, NotificationLog } from '../src/types/index.ts';
import { processTaskRecurrenceOnComplete, formatRecurringLabel } from './recurringEngine.ts';
import {
  getDbTasks,
  saveDbTask,
  deleteDbTask,
  getDbNotes,
  saveDbNote,
  deleteDbNote,
  getDbFiles,
  saveDbFile,
  getDbTelegramConfig,
  saveDbTelegramConfig,
  addDbNotificationLog,
  getConversationHistory,
  appendConversationTurn,
} from './firebaseDb.ts';
import {
  sendTelegramMessage,
  sendTelegramMessageWithResult,
  editTelegramMessageText,
  sendTelegramChatAction,
  answerCallbackQuery,
  buildTaskReminderKeyboard,
  buildTaskListKeyboard,
  setTelegramBotCommands,
  getTelegramUpdates,
  getTelegramWebhookInfo,
  deleteTelegramWebhook,
  isTelegramBotTokenValid,
  TelegramInlineKeyboard,
} from './telegramHelper.ts';
import { transcribeTelegramVoice } from './voiceTranscriber.ts';
import { generateDailyBriefing } from './dailyBriefing.ts';
import { generateNoteFromCompletedTask } from './aiService.ts';
import { savePersistentBinary } from './storageService.ts';

// Track recent update IDs to prevent duplicate processing on Telegram webhook retries
const processedUpdateMap = new Map<number, number>();

interface PendingTelegramNoteDraft {
  id: string;
  taskId: string;
  taskTitle: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: number;
}
const pendingNoteDrafts = new Map<string, PendingTelegramNoteDraft>();

function isDuplicateTelegramUpdate(updateId?: number): boolean {
  if (!updateId) return false;
  const now = Date.now();
  // Purge entries older than 5 minutes
  for (const [id, ts] of processedUpdateMap.entries()) {
    if (now - ts > 300000) processedUpdateMap.delete(id);
  }
  if (processedUpdateMap.has(updateId)) {
    return true;
  }
  processedUpdateMap.set(updateId, now);
  return false;
}

// Helper for Vietnam Timezone (UTC+7)
function getTimeInZone(date: Date = new Date(), timeZone: string = 'Asia/Ho_Chi_Minh') {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';

  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = parseInt(get('hour') || '0', 10);
  const minute = parseInt(get('minute') || '0', 10);
  const second = parseInt(get('second') || '0', 10);
  const dateStr = `${year}-${month}-${day}`;

  return { date, dateStr, hour, minute, second, timeZone };
}

export interface TelegramEngineContext {
  gemini: GoogleGenAI;
  uploadsDir: string;
  processAiChat: (
    message: string,
    enableSearch?: boolean,
    sessionId?: string,
    history?: { role: string; content: string }[]
  ) => Promise<{
    reply: string;
    groundingSources?: { title: string; url: string }[];
    retrievedContext?: any;
  }>;
}

/**
 * Central update processor for ALL incoming Telegram events (Webhook or Polling)
 */
export async function processTelegramUpdate(
  telegramUpdate: any,
  context: TelegramEngineContext
): Promise<{ success: boolean; reply?: string; action?: string; chatId?: string }> {
  // Deduplicate updates from Telegram webhook retry loops
  if (telegramUpdate.update_id && isDuplicateTelegramUpdate(telegramUpdate.update_id)) {
    console.log(`[Telegram Update] Skipping duplicate update_id: ${telegramUpdate.update_id}`);
    return { success: true, reply: 'Skipped duplicate update' };
  }

  const telegramConfig = await getDbTelegramConfig();
  if (!isTelegramBotTokenValid(telegramConfig.botToken)) {
    return { success: false, reply: 'Chưa cấu hình Telegram Bot Token hợp lệ.' };
  }

  const tasks = await getDbTasks();
  const notes = await getDbNotes();

  // -----------------------------------------------------------
  // 1. INLINE KEYBOARD CALLBACK QUERIES (BUTTON CLICKS)
  // -----------------------------------------------------------
  if (telegramUpdate.callback_query) {
    const cbq = telegramUpdate.callback_query;
    const data: string = cbq.data || '';
    const chatId = String(cbq.message?.chat?.id || cbq.from?.id || telegramConfig.chatId);
    const callbackQueryId = cbq.id;

    console.log(`🔘 Telegram Inline Button: [${data}] from Chat ID: ${chatId}`);

    // A. Done task
    if (
      data.startsWith('done:') ||
      data.startsWith('task:done:') ||
      data.startsWith('task_done:') ||
      data.startsWith('complete:') ||
      data.startsWith('task:complete:')
    ) {
      let taskId = '';
      if (data.startsWith('task:done:')) taskId = data.replace('task:done:', '');
      else if (data.startsWith('task_done:')) taskId = data.replace('task_done:', '');
      else if (data.startsWith('task:complete:')) taskId = data.replace('task:complete:', '');
      else if (data.startsWith('complete:')) taskId = data.replace('complete:', '');
      else if (data.startsWith('done:')) taskId = data.replace('done:', '');
      taskId = taskId.trim();

      const currentTasks = await getDbTasks();
      const target = currentTasks.find(
        t => t.id === taskId || t.id.toLowerCase() === taskId.toLowerCase() || (taskId && t.id.includes(taskId))
      );

      if (target) {
        const recResult = processTaskRecurrenceOnComplete(target);

        if (recResult.isRecurring) {
          await saveDbTask(recResult.updatedTask);
          await answerCallbackQuery(
            telegramConfig.botToken,
            callbackQueryId,
            `🔁 Hoàn thành chu kỳ! Dời sang ${recResult.formattedNextDate}`
          );

          await addDbNotificationLog({
            id: `notif-done-${Date.now()}`,
            title: `🔁 Hoàn thành chu kỳ & lặp lại: ${target.title}`,
            message: `Người dùng xác nhận hoàn thành công việc lặp lại "${target.title}". Hệ thống đã tự động dời sang chu kỳ mới: ${recResult.formattedNextDate}.`,
            channel: 'telegram',
            status: 'sent',
            timestamp: new Date().toISOString(),
            taskId: target.id,
          });

          await sendTelegramMessage(
            telegramConfig.botToken,
            chatId,
            `🎉 *ĐÃ HOÀN THÀNH CHU KỲ CÔNG VIỆC*\n\n📌 Công việc: *${target.title}*\n🔄 Cấu hình: *${formatRecurringLabel(target.recurring)}*\n➡️ Hạn chót mới: *${recResult.formattedNextDate}*\n🔔 Cảnh báo Telegram: *Tự động kích hoạt lại theo lịch mới* ✅\n\n_Dữ liệu đã được tự động lưu và đồng bộ lên Cloud Firestore._`,
            [
              [
                { text: '📋 Việc hôm nay', callback_data: 'cmd:today' },
                { text: '📋 Tất cả việc', callback_data: 'cmd:tasks' }
              ]
            ]
          );
        } else {
          target.status = 'completed';
          target.isNotified = false;
          target.overdueReminderCount = 0;
          target.lastOverdueNotifiedAt = undefined;
          target.updatedAt = new Date().toISOString();
          await saveDbTask(target);
          await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, `✅ Đã hoàn thành: ${target.title}`);
          
          // Log to notification audit trail
          await addDbNotificationLog({
            id: `notif-done-${Date.now()}`,
            title: `✅ Hoàn thành qua Telegram: ${target.title}`,
            message: `Người dùng đã nhấn xác nhận hoàn thành công việc "${target.title}" trực tiếp từ Telegram Bot.`,
            channel: 'telegram',
            status: 'sent',
            timestamp: new Date().toISOString(),
            taskId: target.id,
          });

          await sendTelegramMessage(
            telegramConfig.botToken,
            chatId,
            `🎉 *ĐÃ HOÀN THÀNH CÔNG VIỆC*\n\n📌 Công việc: *${target.title}*\nTrạng thái: *Đã hoàn thành (Completed)* ✅\n\n💡 *Bạn có muốn AI đúc kết thông tin công việc này để lưu vào Ghi Chú không?*`,
            [
              [
                { text: '✨ Có, AI tạo ghi chú', callback_data: `task:note_ai:${target.id}` },
                { text: '⏩ Bỏ qua', callback_data: `task:note_skip:${target.id}` }
              ],
              [
                { text: '📋 Việc hôm nay', callback_data: 'cmd:today' },
                { text: '📋 Tất cả việc', callback_data: 'cmd:tasks' }
              ]
            ]
          );
        }
      } else {
        await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, '⚠️ Không tìm thấy công việc này trong hệ thống.');
      }
      return { success: true, action: 'done', chatId };
    }

    // B. Snooze task
    if (
      data.startsWith('snooze:') ||
      data.startsWith('task:snooze') ||
      data.startsWith('task_snooze') ||
      data.startsWith('postpone:')
    ) {
      let taskId = '';
      let mins = 15;

      if (data.startsWith('task:snooze1h:')) {
        taskId = data.replace('task:snooze1h:', '').trim();
        mins = 60;
      } else if (data.startsWith('task:snooze3h:')) {
        taskId = data.replace('task:snooze3h:', '').trim();
        mins = 180;
      } else if (data.startsWith('task:snooze:')) {
        const parts = data.split(':');
        taskId = parts[2] || '';
        mins = parseInt(parts[3] || '15', 10);
      } else if (data.startsWith('snooze:')) {
        const parts = data.split(':');
        taskId = parts[1] || '';
        mins = parseInt(parts[2] || '15', 10);
      } else {
        taskId = data.replace(/^task:snooze:?|^snooze:?|^postpone:?/, '').trim();
        mins = 15;
      }

      const currentTasks = await getDbTasks();
      const target = currentTasks.find(
        t => t.id === taskId || t.id.toLowerCase() === taskId.toLowerCase() || (taskId && t.id.includes(taskId))
      );

      if (target) {
        const baseTime = target.deadline ? new Date(target.deadline).getTime() : Date.now();
        // If deadline is already overdue, extend from current time
        const referenceTime = baseTime < Date.now() ? Date.now() : baseTime;
        const newDeadline = new Date(referenceTime + mins * 60 * 1000).toISOString();
        target.deadline = newDeadline;
        target.isNotified = false; // reset reminder so user gets reminded before new deadline
        target.overdueReminderCount = 0; // reset overdue nag counter
        target.lastOverdueNotifiedAt = undefined;
        target.stopOverdueReminders = false;
        target.updatedAt = new Date().toISOString();
        await saveDbTask(target);

        const durationText = mins >= 60 ? `${mins / 60} giờ` : `${mins} phút`;
        await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, `⏰ Đã gia hạn thêm ${durationText}!`);
        
        await addDbNotificationLog({
          id: `notif-snooze-${Date.now()}`,
          title: `⏰ Gia hạn qua Telegram: ${target.title} (+${durationText})`,
          message: `Gia hạn hạn chót mới đến: ${new Date(newDeadline).toLocaleString('vi-VN', { timeZone: telegramConfig.timezone || 'Asia/Ho_Chi_Minh' })}`,
          channel: 'telegram',
          status: 'sent',
          timestamp: new Date().toISOString(),
          taskId: target.id,
        });

        await sendTelegramMessage(
          telegramConfig.botToken,
          chatId,
          `⏰ *ĐÃ GIA HẠN DEADLINE THÀNH CÔNG*\n\n📌 Công việc: *${target.title}*\n⏳ Hạn chót mới: *${new Date(newDeadline).toLocaleString('vi-VN', { timeZone: telegramConfig.timezone || 'Asia/Ho_Chi_Minh' })}* (+${durationText})\n🎯 Mức độ: *${target.priority.toUpperCase()}*\n\n_Chu kỳ nhắc nhở đã được thiết lập lại cho hạn mới._`,
          buildTaskReminderKeyboard(target)
        );
      } else {
        await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, '⚠️ Không tìm thấy công việc này.');
      }
      return { success: true, action: 'snooze', chatId };
    }

    // B2. Snooze to tomorrow (Dời sang ngày mai)
    if (data.startsWith('snooze_tomorrow:') || data.startsWith('task:snooze_tomorrow:')) {
      const taskId = data.replace(/^task:snooze_tomorrow:|^snooze_tomorrow:/, '').trim();
      const currentTasks = await getDbTasks();
      const target = currentTasks.find(
        t => t.id === taskId || t.id.toLowerCase() === taskId.toLowerCase() || (taskId && t.id.includes(taskId))
      );

      if (target) {
        // Calculate tomorrow 09:00 AM in user's timezone or +24 hours
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        tomorrow.setHours(9, 0, 0, 0);
        const newDeadline = tomorrow.toISOString();

        target.deadline = newDeadline;
        target.isNotified = false;
        target.overdueReminderCount = 0;
        target.lastOverdueNotifiedAt = undefined;
        target.stopOverdueReminders = false;
        target.updatedAt = new Date().toISOString();
        await saveDbTask(target);

        const timeZone = telegramConfig.timezone || 'Asia/Ho_Chi_Minh';
        await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, '📅 Đã dời hạn sang 09:00 sáng mai!');

        await addDbNotificationLog({
          id: `notif-snooze-tmr-${Date.now()}`,
          title: `📅 Dời việc sang mai: ${target.title}`,
          message: `Đã dời hạn chót đến 09:00 sáng mai (${new Date(newDeadline).toLocaleString('vi-VN', { timeZone })})`,
          channel: 'telegram',
          status: 'sent',
          timestamp: new Date().toISOString(),
          taskId: target.id,
        });

        await sendTelegramMessage(
          telegramConfig.botToken,
          chatId,
          `📅 *ĐÃ DỜI HẠN CHÓT SANG NGÀY MAI*\n\n📌 Công việc: *${target.title}*\n⏳ Hạn mới: *${new Date(newDeadline).toLocaleString('vi-VN', { timeZone })}*\n\n_Hệ thống sẽ nhắc bạn trước deadline mới theo lịch hẹn._`,
          buildTaskReminderKeyboard(target)
        );
      } else {
        await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, '⚠️ Không tìm thấy công việc này.');
      }
      return { success: true, action: 'snooze_tomorrow', chatId };
    }

    // B3. Stop Overdue Nagging (Tắt nhắc nhở quá hạn cho riêng task này)
    if (data.startsWith('stop_nag:') || data.startsWith('task:stop_nag:') || data.startsWith('mute_nag:')) {
      const taskId = data.replace(/^task:stop_nag:|^stop_nag:|^mute_nag:/, '').trim();
      const currentTasks = await getDbTasks();
      const target = currentTasks.find(
        t => t.id === taskId || t.id.toLowerCase() === taskId.toLowerCase() || (taskId && t.id.includes(taskId))
      );

      if (target) {
        target.stopOverdueReminders = true;
        target.updatedAt = new Date().toISOString();
        await saveDbTask(target);

        await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, '🔕 Đã tắt nhắc nhở quá hạn cho việc này!');

        await addDbNotificationLog({
          id: `notif-stopnag-${Date.now()}`,
          title: `🔕 Tắt nhắc nhở quá hạn: ${target.title}`,
          message: `Người dùng đã tắt tính năng gửi nhắc lại quá hạn cho công việc "${target.title}".`,
          channel: 'telegram',
          status: 'sent',
          timestamp: new Date().toISOString(),
          taskId: target.id,
        });

        await sendTelegramMessage(
          telegramConfig.botToken,
          chatId,
          `🔕 *ĐÃ TẮT NHẮC LẠI KHI QUÁ HẠN*\n\n📌 Công việc: *${target.title}*\n\n_Hệ thống sẽ không gửi thêm thông báo nhắc lại cho công việc này. Bạn có thể hoàn thành hoặc dời hạn bất cứ lúc nào trên ứng dụng._`,
          [
            [
              { text: '✅ Đã hoàn thành', callback_data: `done:${target.id}` },
              { text: '⏰ Gia hạn +1h', callback_data: `snooze:${target.id}:60` }
            ],
            [
              { text: '📋 Danh sách việc hôm nay', callback_data: 'cmd:today' }
            ]
          ]
        );
      } else {
        await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, '⚠️ Không tìm thấy công việc này.');
      }
      return { success: true, action: 'stop_nag', chatId };
    }

    // C. Delete task
    if (
      data.startsWith('del:') ||
      data.startsWith('task:del:') ||
      data.startsWith('task:delete:') ||
      data.startsWith('delete:')
    ) {
      let taskId = '';
      if (data.startsWith('task:delete:')) taskId = data.replace('task:delete:', '');
      else if (data.startsWith('task:del:')) taskId = data.replace('task:del:', '');
      else if (data.startsWith('delete:')) taskId = data.replace('delete:', '');
      else if (data.startsWith('del:')) taskId = data.replace('del:', '');
      taskId = taskId.trim();

      const currentTasks = await getDbTasks();
      const target = currentTasks.find(
        t => t.id === taskId || t.id.toLowerCase() === taskId.toLowerCase() || (taskId && t.id.includes(taskId))
      );

      if (target) {
        await deleteDbTask(target.id);
        await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, `🗑️ Đã xóa: ${target.title}`);
        
        await addDbNotificationLog({
          id: `notif-del-${Date.now()}`,
          title: `🗑️ Đã xóa việc từ Telegram: ${target.title}`,
          message: `Công việc "${target.title}" đã được xóa khỏi hệ thống.`,
          channel: 'telegram',
          status: 'sent',
          timestamp: new Date().toISOString(),
        });

        await sendTelegramMessage(
          telegramConfig.botToken,
          chatId,
          `🗑️ *ĐÃ XÓA CÔNG VIỆC*\n\nĐã xóa vĩnh viễn công việc *"${target.title}"* khỏi Firestore.`,
          [[{ text: '📋 Xem việc còn lại', callback_data: 'cmd:today' }]]
        );
      } else {
        await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, '⚠️ Công việc không tồn tại.');
      }
      return { success: true, action: 'del', chatId };
    }

    // D. Quick Buttons
    if (data === 'cmd:today') {
      await answerCallbackQuery(telegramConfig.botToken, callbackQueryId);
      const currentTasks = await getDbTasks();
      const tzInfo = getTimeInZone(new Date(), telegramConfig.timezone || 'Asia/Ho_Chi_Minh');
      const todayStr = tzInfo.dateStr;
      const todayTasks = currentTasks.filter(t => {
        if (!t.deadline || t.status === 'completed' || t.status === 'canceled') return false;
        const taskTz = getTimeInZone(new Date(t.deadline), telegramConfig.timezone || 'Asia/Ho_Chi_Minh');
        return taskTz.dateStr === todayStr;
      });
      let msg = '';
      if (todayTasks.length === 0) {
        msg = '🎉 *Hôm nay bạn không có deadline công việc nào chưa hoàn thành!*';
      } else {
        msg = `📅 *Danh sách công việc đến hạn HÔM NAY (${todayTasks.length}):*\n\n` +
          todayTasks.map((t, idx) => {
            const timeStr = new Date(t.deadline).toLocaleTimeString('vi-VN', { timeZone: telegramConfig.timezone || 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
            return `${idx + 1}. [${t.priority.toUpperCase()}] *${t.title}*\n   ⏰ Hạn chót: *${timeStr} hôm nay*`;
          }).join('\n\n');
      }
      await sendTelegramMessage(telegramConfig.botToken, chatId, msg, buildTaskListKeyboard(currentTasks));
      return { success: true, action: 'today', chatId };
    }

    if (data === 'cmd:tasks') {
      await answerCallbackQuery(telegramConfig.botToken, callbackQueryId);
      const currentTasks = await getDbTasks();
      const pending = currentTasks.filter(t => t.status !== 'completed' && t.status !== 'canceled');
      const weekdayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      const now = new Date();

      const msg = `📋 *Danh sách công việc đang chờ xử lý (${pending.length}):*\n\n` +
        pending.map((t, idx) => {
          if (!t.deadline) return `${idx + 1}. [${t.priority.toUpperCase()}] *${t.title}*\n   ⏰ Không đặt hạn`;
          const d = new Date(t.deadline);
          const vnDate = new Date(d.toLocaleString('en-US', { timeZone: telegramConfig.timezone || 'Asia/Ho_Chi_Minh' }));
          const weekday = weekdayNames[vnDate.getDay()];
          const timeStr = `${String(vnDate.getHours()).padStart(2, '0')}:${String(vnDate.getMinutes()).padStart(2, '0')}`;
          const dateStr = `${String(vnDate.getDate()).padStart(2, '0')}/${String(vnDate.getMonth() + 1).padStart(2, '0')}/${vnDate.getFullYear()}`;
          const diffDays = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const distanceStr = diffDays === 0 ? '(Hôm nay)' : diffDays === 1 ? '(Ngày mai)' : diffDays > 1 ? `(Còn ${diffDays} ngày)` : `(Quá hạn ${Math.abs(diffDays)} ngày)`;

          return `${idx + 1}. [${t.priority.toUpperCase()}] *${t.title}*\n   ⏰ Hạn chót: *${timeStr} ${weekday}, ${dateStr}* ${distanceStr}`;
        }).join('\n\n');
      await sendTelegramMessage(telegramConfig.botToken, chatId, msg, buildTaskListKeyboard(currentTasks));
      return { success: true, action: 'tasks', chatId };
    }

    if (data === 'cmd:notes') {
      await answerCallbackQuery(telegramConfig.botToken, callbackQueryId);
      const currentNotes = await getDbNotes();
      const msg = `📝 *Ghi chú cá nhân (${currentNotes.length}):*\n\n` +
        currentNotes.slice(0, 6).map((n, idx) => `${idx + 1}. *${n.title}* ${n.isPinned ? '📌' : ''} (${(n.tags || []).join(', ')})`).join('\n');
      await sendTelegramMessage(telegramConfig.botToken, chatId, msg, [
        [{ text: '📋 Danh sách việc', callback_data: 'cmd:tasks' }, { text: '🌤️ Thời tiết', callback_data: 'cmd:weather' }]
      ]);
      return { success: true, action: 'notes', chatId };
    }

    if (data === 'cmd:weather') {
      await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, 'Đang kiểm tra thời tiết...');
      await sendTelegramChatAction(telegramConfig.botToken, chatId, 'typing');
      const aiRes = await context.processAiChat('Thời tiết hiện tại ở Việt Nam hôm nay', true, `tg_${chatId}`);
      await sendTelegramMessage(telegramConfig.botToken, chatId, aiRes.reply, [
        [{ text: '📋 Việc hôm nay', callback_data: 'cmd:today' }, { text: '🌅 Bản tin sáng', callback_data: 'cmd:morning' }]
      ]);
      return { success: true, action: 'weather', chatId };
    }

    if (data === 'cmd:morning') {
      await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, 'Đang tổng hợp bản tin sáng...');
      await sendTelegramChatAction(telegramConfig.botToken, chatId, 'typing');
      const currentTasks = await getDbTasks();
      const currentNotes = await getDbNotes();
      const briefing = await generateDailyBriefing('morning', context.gemini, currentTasks, currentNotes);
      await sendTelegramMessage(telegramConfig.botToken, chatId, briefing.reportText, [
        [{ text: '📋 Việc hôm nay', callback_data: 'cmd:today' }, { text: '🌤️ Thời tiết', callback_data: 'cmd:weather' }]
      ]);
      return { success: true, action: 'morning', chatId };
    }

    if (data === 'cmd:evening') {
      await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, 'Đang tổng hợp báo cáo tối...');
      await sendTelegramChatAction(telegramConfig.botToken, chatId, 'typing');
      const currentTasks = await getDbTasks();
      const currentNotes = await getDbNotes();
      const briefing = await generateDailyBriefing('evening', context.gemini, currentTasks, currentNotes);
      await sendTelegramMessage(telegramConfig.botToken, chatId, briefing.reportText, [
        [{ text: '📋 Việc hôm nay', callback_data: 'cmd:today' }, { text: '📋 Tất cả việc', callback_data: 'cmd:tasks' }]
      ]);
      return { success: true, action: 'evening', chatId };
    }

    // =========================================================
    // D1. Generate AI Note from Completed Task (Ask Confirmation)
    // =========================================================
    if (data.startsWith('task:note_ai:') || data.startsWith('note_ai:')) {
      const taskId = data.replace(/^task:note_ai:|^note_ai:/, '').trim();
      const currentTasks = await getDbTasks();
      const target = currentTasks.find(t => t.id === taskId);

      if (!target) {
        await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, '⚠️ Không tìm thấy công việc.');
        return { success: false, action: 'note_ai_not_found', chatId };
      }

      await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, '🤖 AI đang phân tích dữ liệu & đúc kết ghi chú...');
      await sendTelegramChatAction(telegramConfig.botToken, chatId, 'typing');

      try {
        const generated = await generateNoteFromCompletedTask(target);
        const draftId = `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        
        pendingNoteDrafts.set(draftId, {
          id: draftId,
          taskId: target.id,
          taskTitle: target.title,
          title: generated.title,
          content: generated.content,
          tags: generated.tags,
          createdAt: Date.now(),
        });

        const draftPreview =
          `📋 *BẢN NHÁP GHI CHÚ ĐÚC KẾT BỞI AI*\n\n` +
          `📌 *Tiêu đề:* ${generated.title}\n` +
          `🏷️ *Thẻ:* ${generated.tags.map(t => '#' + t).join(' ')}\n\n` +
          `📝 *Nội dung đúc kết:*\n${generated.content}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `👉 *Bạn có xác nhận lưu ghi chú này vào hệ thống Ghi Chú không?*`;

        await sendTelegramMessage(
          telegramConfig.botToken,
          chatId,
          draftPreview,
          [
            [
              { text: '💾 Xác nhận tạo ghi chú', callback_data: `note:confirm:${draftId}` },
              { text: '❌ Hủy bỏ', callback_data: `note:cancel:${draftId}` }
            ],
            [
              { text: '📋 Việc hôm nay', callback_data: 'cmd:today' }
            ]
          ]
        );
      } catch (err: any) {
        console.error('Error generating AI note on Telegram:', err);
        await sendTelegramMessage(
          telegramConfig.botToken,
          chatId,
          `⚠️ Không thể tạo ghi chú tự động bằng AI: ${err?.message || 'Lỗi xử lý'}`,
          [[{ text: '📋 Việc hôm nay', callback_data: 'cmd:today' }]]
        );
      }
      return { success: true, action: 'note_ai_generated', chatId };
    }

    // =========================================================
    // D2. Confirm Save AI Note to Database
    // =========================================================
    if (data.startsWith('note:confirm:') || data.startsWith('note_confirm:')) {
      const draftId = data.replace(/^note:confirm:|^note_confirm:/, '').trim();
      const draft = pendingNoteDrafts.get(draftId);

      if (!draft) {
        await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, '⚠️ Bản nháp đã hết hạn hoặc không tìm thấy.');
        return { success: false, action: 'draft_not_found', chatId };
      }

      const newNote: Note = {
        id: `note-${Date.now()}`,
        title: draft.title,
        content: draft.content,
        tags: draft.tags,
        linkedTaskIds: draft.taskId ? [draft.taskId] : [],
        attachedFileIds: [],
        isPinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveDbNote(newNote);
      pendingNoteDrafts.delete(draftId);

      await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, '✅ Đã lưu ghi chú thành công!');

      await addDbNotificationLog({
        id: `notif-note-saved-${Date.now()}`,
        title: `📝 Tạo ghi chú từ Task: ${draft.title}`,
        message: `Đã lưu thành công ghi chú đúc kết cho công việc "${draft.taskTitle}" qua Telegram Bot.`,
        channel: 'telegram',
        status: 'sent',
        timestamp: new Date().toISOString(),
      });

      await sendTelegramMessage(
        telegramConfig.botToken,
        chatId,
        `🎉 *ĐÃ LƯU GHI CHÚ THÀNH CÔNG VÀO HỆ THỐNG!*\n\n` +
        `📌 *Tiêu đề:* ${newNote.title}\n` +
        `🏷️ *Thẻ:* ${newNote.tags.map(t => '#' + t).join(' ')}\n\n` +
        `_Dữ liệu đã được lưu trữ vĩnh viễn trên Cloud Firestore và đồng bộ về Web App. Bạn có thể mở mục Ghi Chú để tra cứu bất cứ lúc nào._ ✅`,
        [
          [
            { text: '📋 Việc hôm nay', callback_data: 'cmd:today' },
            { text: '📋 Tất cả việc', callback_data: 'cmd:tasks' }
          ]
        ]
      );
      return { success: true, action: 'note_confirmed', chatId };
    }

    // =========================================================
    // D3. Cancel / Skip Note Creation
    // =========================================================
    if (data.startsWith('note:cancel:') || data.startsWith('note_cancel:')) {
      const draftId = data.replace(/^note:cancel:|^note_cancel:/, '').trim();
      const draft = pendingNoteDrafts.get(draftId);
      if (draft) {
        pendingNoteDrafts.delete(draftId);
      }
      await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, 'Đã hủy lưu ghi chú.');
      await sendTelegramMessage(
        telegramConfig.botToken,
        chatId,
        `❌ *ĐÃ HỦY TẠO GHI CHÚ*\n\nCông việc vẫn được lưu ở trạng thái *Đã hoàn thành*. Bạn có thể tự tạo ghi chú thủ công trên Web App khi cần.`,
        [[{ text: '📋 Việc hôm nay', callback_data: 'cmd:today' }]]
      );
      return { success: true, action: 'note_canceled', chatId };
    }

    if (data.startsWith('task:note_skip:') || data.startsWith('note_skip:')) {
      await answerCallbackQuery(telegramConfig.botToken, callbackQueryId, 'Đã bỏ qua tạo ghi chú.');
      await sendTelegramMessage(
        telegramConfig.botToken,
        chatId,
        `👌 *ĐÃ GHI NHẬN HOÀN THÀNH*\n\nBỏ qua lưu ghi chú. Chúc bạn tiếp tục hoàn thành xuất sắc các mục tiêu tiếp theo!`,
        [[{ text: '📋 Việc hôm nay', callback_data: 'cmd:today' }]]
      );
      return { success: true, action: 'note_skipped', chatId };
    }

    await answerCallbackQuery(telegramConfig.botToken, callbackQueryId);
    return { success: true, action: 'unknown', chatId };
  }

  // -----------------------------------------------------------
  // 2. INCOMING MESSAGES (VOICE, DOCUMENTS, PHOTOS, TEXT)
  // -----------------------------------------------------------
  const msgObj = telegramUpdate.message || telegramUpdate.edited_message;
  if (!msgObj) {
    return { success: true, reply: 'Không có dữ liệu tin nhắn.' };
  }

  const voiceObj = msgObj?.voice || msgObj?.audio;
  const documentObj = msgObj?.document;
  const photoArray = msgObj?.photo;
  const locationObj = msgObj?.location;
  const replyToMsg = msgObj?.reply_to_message;
  const messageId = msgObj?.message_id;

  const detectedChatId = msgObj?.chat?.id ? String(msgObj.chat.id) : null;
  const chatId = detectedChatId || telegramConfig.chatId;

  // Auto-sync Chat ID if this message comes from a valid chat
  if (detectedChatId && detectedChatId !== telegramConfig.chatId) {
    await saveDbTelegramConfig({
      chatId: detectedChatId,
      isConnected: true,
    });
    console.log(`Auto-registered Telegram Chat ID to Firestore: ${detectedChatId}`);
  }

  let botReply = '';
  let replyKeyboard: TelegramInlineKeyboard | undefined = undefined;

  // ===========================================================
  // CASE A: VOICE MESSAGE (Gemini Multimodal Audio Transcription)
  // ===========================================================
  if (voiceObj && voiceObj.file_id && telegramConfig.botToken) {
    console.log(`🎙️ [Telegram Voice] file_id: ${voiceObj.file_id} from ${chatId}`);
    try {
      // 1. Send instant visual recording indicator
      await sendTelegramChatAction(telegramConfig.botToken, chatId, 'record_voice');

      // 2. Send immediate status ack and save message ID to edit in-place
      const placeholderRes = await sendTelegramMessageWithResult(
        telegramConfig.botToken,
        chatId,
        '🎙️ *Đang lắng nghe và nhận diện giọng nói qua Gemini AI...*',
        undefined,
        messageId
      );

      // 3. Transcribe audio with Gemini Multimodal Audio
      const transcribedText = await transcribeTelegramVoice(
        telegramConfig.botToken,
        voiceObj.file_id,
        context.gemini
      );

      console.log(`🎙️ Gemini Multimodal Audio Transcribed: "${transcribedText}"`);

      if (!transcribedText || transcribedText.trim().length === 0) {
        botReply =
          '🎙️ *Không nhận diện được giọng nói:*\n\n' +
          'Đoạn ghi âm có thể quá ngắn hoặc âm thanh bị nhỏ/nhiễu. Bạn hãy thử gửi lại tin nhắn thoại to và rõ hơn nhé!';
      } else {
        // Trigger typing indicator while executing AI action
        await sendTelegramChatAction(telegramConfig.botToken, chatId, 'typing');

        // Autonomous AI Agent execution (Function Calling: Create Task, Note, Done, Query)
        const aiResult = await context.processAiChat(transcribedText, true, `tg_${chatId}`);

        botReply = `🎙️ *Giọng nói nhận diện:*\n_"${transcribedText}"_\n\n${aiResult.reply}`;
      }

      replyKeyboard = [
        [
          { text: '📋 Việc hôm nay', callback_data: 'cmd:today' },
          { text: '📋 Tất cả việc', callback_data: 'cmd:tasks' }
        ],
        [
          { text: '🌅 Bản tin sáng', callback_data: 'cmd:morning' },
          { text: '🌤️ Thời tiết', callback_data: 'cmd:weather' }
        ]
      ];

      // 4. Edit the placeholder message in-place for a clean user experience
      if (placeholderRes.messageId) {
        const edited = await editTelegramMessageText(
          telegramConfig.botToken,
          chatId,
          placeholderRes.messageId,
          botReply,
          replyKeyboard
        );

        if (edited) {
          await addDbNotificationLog({
            id: `notif-${Date.now()}`,
            title: `🎙️ Voice: ${botReply.slice(0, 30)}`,
            message: botReply.slice(0, 100) + '...',
            channel: 'telegram',
            status: 'sent',
            timestamp: new Date().toISOString(),
          });
          return { success: true, reply: botReply, chatId };
        }
      }
    } catch (voiceError: any) {
      console.error('Voice processing error:', voiceError);
      botReply = `⚠️ *Không thể xử lý tin nhắn thoại:*\n${voiceError?.message || 'Lỗi nhận dạng âm thanh'}\n\n_Gợi ý: Hãy thử nói lại một câu rõ ràng (ví dụ: "Thêm việc họp dự án lúc 3h chiều mai")_`;
    }
  }

  // ===========================================================
  // CASE B: DOCUMENT / PHOTO ATTACHMENT
  // ===========================================================
  else if ((documentObj || (photoArray && photoArray.length > 0)) && telegramConfig.botToken) {
    try {
      await sendTelegramChatAction(telegramConfig.botToken, chatId, 'upload_document');

      const fileId = documentObj?.file_id || photoArray[photoArray.length - 1].file_id;
      const fileName = documentObj?.file_name || `photo_${Date.now()}.jpg`;
      const mimeType = documentObj?.mime_type || 'image/jpeg';
      const fileSize = documentObj?.file_size || photoArray[photoArray.length - 1].file_size || 102400;

      // 1. Fetch file from Telegram API
      const fileMetaRes = await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/getFile?file_id=${fileId}`);
      const fileMeta: any = await fileMetaRes.json();

      const localFileId = `file-tg-${Date.now()}`;
      let persistRes: any = null;

      if (fileMeta.ok && fileMeta.result?.file_path) {
        const downloadUrl = `https://api.telegram.org/file/bot${telegramConfig.botToken}/${fileMeta.result.file_path}`;
        const binaryRes = await fetch(downloadUrl);
        if (binaryRes.ok) {
          const buffer = Buffer.from(await binaryRes.arrayBuffer());
          persistRes = await savePersistentBinary({
            fileId: localFileId,
            fileName: fileName,
            mimeType: mimeType,
            buffer: buffer,
            tryDriveSync: true,
          });
        }
      }

      // Determine category
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      let category: DriveFile['category'] = 'document';
      if (['xlsx', 'xls', 'csv'].includes(ext)) category = 'spreadsheet';
      else if (ext === 'pdf') category = 'pdf';
      else if (['pptx', 'ppt'].includes(ext)) category = 'presentation';
      else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext) || mimeType.startsWith('image/')) category = 'image';

      const isSynced = !!(persistRes?.isSyncedToDrive && persistRes?.driveFileId);
      const newDriveFile: DriveFile = {
        id: localFileId,
        name: fileName,
        mimeType: mimeType,
        size: fileSize,
        category: category,
        classification: 'unclassified',
        isSyncedToDrive: isSynced,
        driveFileId: persistRes?.driveFileId,
        webViewLink: persistRes?.webViewLink,
        syncStatus: isSynced ? 'synced' : 'local_only',
        downloadUrl: `/api/files/download/${localFileId}`,
        previewUrl: persistRes?.webViewLink || `/api/files/preview/${localFileId}`,
        storageType: persistRes?.storageType || 'firestore_vault',
        hasBinary: true,
        uploadedAt: new Date().toISOString(),
      };

      await saveDbFile(newDriveFile);

      const statusNote = isSynced
        ? `🟢 *Đã lưu trữ Google Drive & Cloud Vault*`
        : `☁️ *Lưu trữ an toàn vĩnh viễn trên Cloud Vault*`;

      botReply = `📄 *ĐÃ LƯU TRỮ TÀI LIỆU TỪ TELEGRAM*\n\n` +
        `• **Tên tệp:** \`${fileName}\`\n` +
        `• **Dung lượng:** \`${(fileSize / (1024 * 1024)).toFixed(2)} MB\`\n` +
        `• **Phân loại:** \`${category.toUpperCase()}\`\n` +
        `• **Trạng thái:** ${statusNote}\n\n` +
        `💡 _Tệp đã được lưu trữ vĩnh viễn trên đám mây và đồng bộ ngay vào Web App._`;

      replyKeyboard = [
        [
          { text: '📋 Xem việc hôm nay', callback_data: 'cmd:today' },
          { text: '📋 Danh sách việc', callback_data: 'cmd:tasks' }
        ]
      ];
    } catch (docErr: any) {
      console.error('Telegram file error:', docErr);
      botReply = `⚠️ *Lỗi khi lưu tệp:* ${docErr?.message || 'Không thể tải file từ Telegram'}`;
    }
  }

  // ===========================================================
  // CASE C: LOCATION SHARED
  // ===========================================================
  else if (locationObj && telegramConfig.botToken) {
    try {
      await sendTelegramChatAction(telegramConfig.botToken, chatId, 'find_location');
      const { latitude, longitude } = locationObj;
      const locationQuery = `Thời tiết và thông tin khu vực tại tọa độ lat: ${latitude}, long: ${longitude} hôm nay`;
      const aiRes = await context.processAiChat(locationQuery, true, `tg_${chatId}`);
      botReply = `📍 *VỊ TRÍ ĐÃ NHẬN (${latitude.toFixed(4)}, ${longitude.toFixed(4)})*\n\n${aiRes.reply}`;
      replyKeyboard = [
        [{ text: '📋 Việc hôm nay', callback_data: 'cmd:today' }, { text: '🌤️ Thời tiết', callback_data: 'cmd:weather' }]
      ];
    } catch (locErr: any) {
      botReply = `⚠️ Không thể kiểm tra vị trí: ${locErr?.message}`;
    }
  }

  // ===========================================================
  // CASE D: TEXT MESSAGE & QUOTED REPLIES
  // ===========================================================
  else {
    const rawInput = (msgObj?.text || '').trim();

    if (!rawInput) {
      return { success: true, reply: 'Chưa nhận được nội dung tin nhắn.' };
    }

    // Send typing action immediately for smooth user feedback
    await sendTelegramChatAction(telegramConfig.botToken, chatId, 'typing');

    let cleanInput = rawInput.replace(/@\w+/gi, '').trim();

    // Check if user is replying to a previous quoted message (e.g. Task reminder alert)
    if (replyToMsg && replyToMsg.text) {
      const quotedText = replyToMsg.text;
      const lowerInput = cleanInput.toLowerCase();

      // Case: User replies "xong rồi", "done", "hoàn thành"
      if (['xong', 'done', 'xong rồi', 'hoàn thành', 'da xong', 'đã xong'].includes(lowerInput)) {
        // Extract task title from quote
        const taskMatch = quotedText.match(/Công việc:\s*\*?([^\n\*]+)\*?/i) || quotedText.match(/📌\s*\*?([^\n\*]+)\*?/i);
        const taskTitle = taskMatch ? taskMatch[1].trim() : '';
        if (taskTitle) {
          const currentTasks = await getDbTasks();
          const target = currentTasks.find(t => t.title.toLowerCase().includes(taskTitle.toLowerCase()));
          if (target) {
            const recResult = processTaskRecurrenceOnComplete(target);
            if (recResult.isRecurring) {
              await saveDbTask(recResult.updatedTask);
              botReply = `🎉 *ĐÃ HOÀN THÀNH CHU KỲ CÔNG VIỆC*\n\n📌 Công việc: *${target.title}*\n🔄 Cấu hình: *${formatRecurringLabel(target.recurring)}*\n➡️ Hạn chót mới: *${recResult.formattedNextDate}*\n🔔 Cảnh báo Telegram: *Tự động kích hoạt lại theo lịch mới* ✅\n\n_Hệ thống đã tự động dời chu kỳ và lưu vào Firestore._`;
            } else {
              target.status = 'completed';
              target.updatedAt = new Date().toISOString();
              await saveDbTask(target);
              botReply = `🎉 *ĐÃ HOÀN THÀNH CÔNG VIỆC*\n\n📌 Công việc: *${target.title}*\n✅ Đã cập nhật trạng thái vào Firestore!\n\n💡 *Bạn có muốn AI đúc kết thông tin công việc này để lưu vào Ghi Chú không?*`;
              replyKeyboard = [
                [
                  { text: '✨ Có, AI tạo ghi chú', callback_data: `task:note_ai:${target.id}` },
                  { text: '⏩ Bỏ qua', callback_data: `task:note_skip:${target.id}` }
                ],
                [
                  { text: '📋 Việc hôm nay', callback_data: 'cmd:today' },
                  { text: '📋 Danh sách việc', callback_data: 'cmd:tasks' }
                ]
              ];
            }
          }
        }
      }
      // Case: User replies "hoãn 30 phút", "hoãn 1h"
      else if (lowerInput.startsWith('hoãn') || lowerInput.startsWith('snooze')) {
        const minsMatch = lowerInput.match(/(\d+)\s*(phút|p|m|giờ|h)?/i);
        let mins = 15;
        if (minsMatch) {
          mins = parseInt(minsMatch[1], 10);
          if (minsMatch[2] && ['giờ', 'h'].includes(minsMatch[2])) mins *= 60;
        }
        const taskMatch = quotedText.match(/Công việc:\s*\*?([^\n\*]+)\*?/i) || quotedText.match(/📌\s*\*?([^\n\*]+)\*?/i);
        const taskTitle = taskMatch ? taskMatch[1].trim() : '';
        if (taskTitle) {
          const currentTasks = await getDbTasks();
          const target = currentTasks.find(t => t.title.toLowerCase().includes(taskTitle.toLowerCase()));
          if (target) {
            const newDeadline = new Date(new Date(target.deadline).getTime() + mins * 60 * 1000).toISOString();
            target.deadline = newDeadline;
            target.isNotified = false;
            target.updatedAt = new Date().toISOString();
            await saveDbTask(target);
            botReply = `⏰ *ĐÃ HOÃN DEADLINE*\n\n📌 Công việc: *${target.title}*\n⏳ Hạn chót mới: *${new Date(newDeadline).toLocaleString('vi-VN', { timeZone: telegramConfig.timezone || 'Asia/Ho_Chi_Minh' })}* (+${mins} phút)`;
            replyKeyboard = buildTaskReminderKeyboard(target);
          }
        }
      }
      // Case: User replies "lưu vào note", "ghi chú lại"
      else if (lowerInput.includes('ghi chú') || lowerInput.includes('note')) {
        const newNote: Note = {
          id: `note-${Date.now()}`,
          title: `Ghi chú từ Telegram (${new Date().toLocaleDateString('vi-VN')})`,
          content: `${quotedText}\n\n_Bình luận:_ ${cleanInput}`,
          tags: ['Telegram', 'Trích dẫn'],
          linkedTaskIds: [],
          attachedFileIds: [],
          isPinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveDbNote(newNote);
        botReply = `📝 *ĐÃ LƯU TRÍCH DẪN THÀNH GHI CHÚ*\n\n📌 Tiêu đề: *${newNote.title}*\n_Nội dung đã được lưu an toàn vào Firestore._`;
        replyKeyboard = [[{ text: '📝 Xem ghi chú', callback_data: 'cmd:notes' }]];
      }
    }

    // Standard command / text router if not handled by contextual quote
    if (!botReply) {
      if (cleanInput.match(/^\/(start|help)\b/i)) {
        botReply = `🤖 *AI PERSONAL PRODUCTIVITY ASSISTANT & AGENT*\n\nChào bạn! Tôi là Trợ lý AI Agent kết nối trực tiếp với Firestore của bạn. Tôi có khả năng **Tự Động Thực Hiện Hành Động** qua **lời nói ghi âm (Voice to Task)** hoặc tin nhắn tự nhiên:\n\n🎙️ *Bạn có thể bấm giữ micro trên Telegram và nói:*\n• "Thêm việc họp khách hàng lúc 3h chiều mai độ ưu tiên cao"\n• "Đã xong việc nộp báo cáo quý"\n• "Tạo ghi chú ý tưởng thiết kế app mới"\n• "Thời tiết Hà Nội hôm nay thế nào?"\n\n✨ *Lệnh nhanh có thể bấm menu hoặc gõ:*\n• \`/today\` - Deadline hôm nay\n• \`/tasks\` - Danh sách việc chưa xong\n• \`/morning\` - Bản tin sáng Daily Briefing\n• \`/evening\` - Báo cáo tổng kết tối\n• \`/notes\` - Ghi chú cá nhân\n• \`/status\` - Kiểm tra trạng thái hệ thống`;
        replyKeyboard = [
          [
            { text: '📋 Việc hôm nay', callback_data: 'cmd:today' },
            { text: '📋 Tất cả việc', callback_data: 'cmd:tasks' }
          ],
          [
            { text: '🌅 Bản tin sáng', callback_data: 'cmd:morning' },
            { text: '🌙 Báo cáo tối', callback_data: 'cmd:evening' }
          ],
          [
            { text: '🌤️ Thời tiết', callback_data: 'cmd:weather' },
            { text: '📝 Ghi chú', callback_data: 'cmd:notes' }
          ]
        ];
      } else if (cleanInput.match(/^\/today\b/i)) {
        const tzInfo = getTimeInZone(new Date(), telegramConfig.timezone || 'Asia/Ho_Chi_Minh');
        const todayStr = tzInfo.dateStr;
        const todayTasks = tasks.filter(t => {
          if (!t.deadline || t.status === 'completed' || t.status === 'canceled') return false;
          const taskTz = getTimeInZone(new Date(t.deadline), telegramConfig.timezone || 'Asia/Ho_Chi_Minh');
          return taskTz.dateStr === todayStr;
        });
        if (todayTasks.length === 0) {
          botReply = `🎉 *Hôm nay bạn không có deadline công việc nào chưa hoàn thành!*`;
        } else {
          botReply = `📅 *Danh sách công việc đến hạn HÔM NAY (${todayTasks.length}):*\n\n` +
            todayTasks.map((t, idx) => {
              const timeStr = new Date(t.deadline).toLocaleTimeString('vi-VN', { timeZone: telegramConfig.timezone || 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
              return `${idx + 1}. [${t.priority.toUpperCase()}] *${t.title}*\n   ⏰ Hạn chót: *${timeStr} hôm nay*\n   📌 Trạng thái: ${t.status}`;
            }).join('\n\n');
        }
        replyKeyboard = buildTaskListKeyboard(tasks);
      } else if (cleanInput.match(/^\/tasks\b/i)) {
        const pending = tasks.filter(t => t.status !== 'completed' && t.status !== 'canceled');
        const weekdayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        const now = new Date();

        botReply = `📋 *Danh sách công việc đang chờ xử lý (${pending.length}):*\n\n` +
          pending.map((t, idx) => {
            if (!t.deadline) return `${idx + 1}. [${t.priority.toUpperCase()}] *${t.title}*\n   ⏰ Không đặt hạn`;
            const d = new Date(t.deadline);
            const vnDate = new Date(d.toLocaleString('en-US', { timeZone: telegramConfig.timezone || 'Asia/Ho_Chi_Minh' }));
            const weekday = weekdayNames[vnDate.getDay()];
            const timeStr = `${String(vnDate.getHours()).padStart(2, '0')}:${String(vnDate.getMinutes()).padStart(2, '0')}`;
            const dateStr = `${String(vnDate.getDate()).padStart(2, '0')}/${String(vnDate.getMonth() + 1).padStart(2, '0')}/${vnDate.getFullYear()}`;
            const diffDays = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const distanceStr = diffDays === 0 ? '(Hôm nay)' : diffDays === 1 ? '(Ngày mai)' : diffDays > 1 ? `(Còn ${diffDays} ngày)` : `(Quá hạn ${Math.abs(diffDays)} ngày)`;

            return `${idx + 1}. [${t.priority.toUpperCase()}] *${t.title}*\n   ⏰ Hạn chót: *${timeStr} ${weekday}, ${dateStr}* ${distanceStr}`;
          }).join('\n\n');
        replyKeyboard = buildTaskListKeyboard(tasks);
      } else if (cleanInput.match(/^\/notes\b/i)) {
        botReply = `📝 *Ghi chú cá nhân (${notes.length}):*\n\n` +
          notes.slice(0, 6).map((n, idx) => `${idx + 1}. *${n.title}* ${n.isPinned ? '📌' : ''} (${(n.tags || []).join(', ')})`).join('\n');
        replyKeyboard = [[{ text: '📋 Danh sách việc', callback_data: 'cmd:tasks' }]];
      } else if (cleanInput.match(/^\/(morning|briefing)\b/i)) {
        const briefing = await generateDailyBriefing('morning', context.gemini, tasks, notes);
        botReply = briefing.reportText;
        replyKeyboard = [
          [{ text: '📋 Việc hôm nay', callback_data: 'cmd:today' }, { text: '🌤️ Thời tiết', callback_data: 'cmd:weather' }]
        ];
      } else if (cleanInput.match(/^\/noon\b/i)) {
        const briefing = await generateDailyBriefing('noon', context.gemini, tasks, notes);
        botReply = briefing.reportText;
        replyKeyboard = [
          [{ text: '📋 Việc hôm nay', callback_data: 'cmd:today' }, { text: '📋 Tất cả việc', callback_data: 'cmd:tasks' }]
        ];
      } else if (cleanInput.match(/^\/evening\b/i)) {
        const briefing = await generateDailyBriefing('evening', context.gemini, tasks, notes);
        botReply = briefing.reportText;
        replyKeyboard = [
          [{ text: '📋 Việc hôm nay', callback_data: 'cmd:today' }, { text: '📋 Tất cả việc', callback_data: 'cmd:tasks' }]
        ];
      } else if (cleanInput.match(/^\/status\b/i)) {
        const pendingCount = tasks.filter(t => t.status !== 'completed' && t.status !== 'canceled').length;
        botReply = `📊 *TRẠNG THÁI HỆ THỐNG TRỢ LÝ AI*\n\n` +
          `• 🗄️ **Cơ sở dữ liệu:** Firebase Firestore (Đã kết nối)\n` +
          `• 📋 **Công việc đang chờ:** \`${pendingCount}\` / \`${tasks.length}\`\n` +
          `• 📝 **Ghi chú cá nhân:** \`${notes.length}\`\n` +
          `• 🤖 **AI Engine:** Gemini 3.7 Flash & Google Search\n` +
          `• ⏰ **Múi giờ vận hành:** \`${telegramConfig.timezone || 'Asia/Ho_Chi_Minh'}\`\n` +
          `• 🔔 **Thông báo tự động:** ${telegramConfig.enabled !== false ? '🟢 Đang bật' : '🔴 Đang tắt'}\n\n` +
          `_Hệ thống luôn lắng nghe phản hồi 24/7._`;
        replyKeyboard = [
          [{ text: '📋 Việc hôm nay', callback_data: 'cmd:today' }, { text: '🌅 Bản tin sáng', callback_data: 'cmd:morning' }]
        ];
      } else {
        // Natural language query or /ask command
        let promptQuery = cleanInput.replace(/^\/(ask|chat|ai)\b/i, '').trim();
        if (!promptQuery) {
          botReply = `⚠️ Vui lòng nhập câu hỏi hoặc yêu cầu sau lệnh /ask. Ví dụ: "Thêm việc nộp thuế", "Thời tiết hôm nay".`;
        } else {
          const aiRes = await context.processAiChat(promptQuery, true, `tg_${chatId}`);
          botReply = aiRes.reply;
          replyKeyboard = [
            [{ text: '📋 Xem việc hôm nay', callback_data: 'cmd:today' }, { text: '🌤️ Thời tiết', callback_data: 'cmd:weather' }]
          ];
        }
      }
    }
  }

  // -----------------------------------------------------------
  // 3. LOG & DELIVER TO TELEGRAM
  // -----------------------------------------------------------
  await addDbNotificationLog({
    id: `notif-${Date.now()}`,
    title: `💬 Telegram Bot: ${botReply.slice(0, 30)}`,
    message: botReply.slice(0, 100) + '...',
    channel: 'telegram',
    status: 'sent',
    timestamp: new Date().toISOString(),
  });

  if (telegramConfig.botToken && chatId && botReply) {
    await sendTelegramMessage(telegramConfig.botToken, chatId, botReply, replyKeyboard, messageId);
  }

  return { success: true, reply: botReply, chatId };
}

// -------------------------------------------------------------
// 4. TELEGRAM BACKGROUND LONG-POLLING DAEMON
// -------------------------------------------------------------
let pollingRunning = false;
let pollingOffset = 0;
let pollingContext: TelegramEngineContext | null = null;
let pollingIntervalHandle: any = null;

/**
 * Start or resume the Telegram Long Polling daemon
 */
export async function startTelegramPollingDaemon(context: TelegramEngineContext) {
  pollingContext = context;
  if (pollingRunning) return;

  const config = await getDbTelegramConfig();
  if (!isTelegramBotTokenValid(config.botToken)) {
    console.log('ℹ️ [Telegram Polling Daemon] Token chưa được cấu hình hoặc chưa hợp lệ. Daemon chờ cấu hình từ người dùng.');
    return;
  }

  // Set up Telegram command menu on Telegram servers
  setTelegramBotCommands(config.botToken).catch(err => {
    console.warn('Could not set Telegram Bot commands menu:', err);
  });

  pollingRunning = true;
  console.log('🤖 [Telegram Polling Daemon] Background runner started...');

  const runPollLoop = async () => {
    let lastWebhookCheckTime = 0;
    let cachedWebhookActive = false;

    while (pollingRunning) {
      try {
        const currentConfig = await getDbTelegramConfig();
        if (!isTelegramBotTokenValid(currentConfig.botToken) || !pollingRunning) {
          await new Promise(r => setTimeout(r, 10000));
          continue;
        }

        // Check if a Webhook is actively registered with Telegram (cached for 5 minutes)
        const now = Date.now();
        if (now - lastWebhookCheckTime > 5 * 60 * 1000) {
          try {
            const webhookInfo = await getTelegramWebhookInfo(currentConfig.botToken);
            cachedWebhookActive = Boolean(webhookInfo && webhookInfo.url && webhookInfo.url.trim().length > 0);
            lastWebhookCheckTime = now;
          } catch (wErr) {
            // Keep previous status on temporary check failure
          }
        }

        // If Webhook is active, Telegram rejects getUpdates calls with 409 Conflict.
        // Therefore, pause polling loop peacefully without spamming Telegram getWebhookInfo.
        if (cachedWebhookActive) {
          await new Promise(r => setTimeout(r, 30000));
          continue;
        }

        // Fetch updates via Long Polling
        const updatesRes = await getTelegramUpdates(currentConfig.botToken, pollingOffset, 15);
        if (updatesRes.ok && Array.isArray(updatesRes.result) && updatesRes.result.length > 0) {
          for (const upd of updatesRes.result) {
            pollingOffset = Math.max(pollingOffset, upd.update_id + 1);
            if (pollingContext) {
              await processTelegramUpdate(upd, pollingContext).catch(err => {
                console.warn('[Telegram Polling] Update handling error:', err);
              });
            }
          }
        }
      } catch (err: any) {
        console.warn('[Telegram Polling] Loop exception, retrying in 5s:', err?.message || err);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  };

  runPollLoop().catch(e => console.warn('[Telegram Polling] Daemon crashed:', e));
}

/**
 * Stop the Telegram Long Polling daemon
 */
export function stopTelegramPollingDaemon() {
  pollingRunning = false;
  if (pollingIntervalHandle) {
    clearInterval(pollingIntervalHandle);
    pollingIntervalHandle = null;
  }
  console.log('🛑 [Telegram Polling Daemon] Stopped.');
}
