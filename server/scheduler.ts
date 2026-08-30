import {
  getDbTasks,
  saveDbTask,
  getDbNotes,
  getDbTelegramConfig,
  saveDbTelegramConfig,
  addDbNotificationLog,
} from './firebaseDb.ts';
import { getGeminiClient } from './aiService.ts';
import { generateDailyBriefing } from './dailyBriefing.ts';
import { runProactiveRiskCheck } from './proactiveRiskDetector.ts';
import { syncAndVectorizeAllDocuments } from './embeddingService.ts';
import {
  sendTelegramMessage,
  buildTaskReminderKeyboard,
  TelegramInlineKeyboard,
} from './telegramHelper.ts';
import type { Task, NotificationLog } from '../src/types/index.ts';

// In-flight mutex locks to prevent simultaneous duplicate calls within rapid scheduler ticks
let isMorningDispatching = false;
let isEveningDispatching = false;
let lastVectorSyncTimestamp = 0;

/**
 * Helper to extract time parts in a specific timezone (defaults to Vietnam Asia/Ho_Chi_Minh)
 */
export function getTimeInZone(date: Date = new Date(), timeZone: string = 'Asia/Ho_Chi_Minh') {
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

/**
 * Executes a single background scheduler tick to monitor task deadlines, proactive risks and dispatch scheduled briefings
 */
export async function runSchedulerCheck() {
  const telegramConfig = await getDbTelegramConfig();
  const timeZone = telegramConfig.timezone || 'Asia/Ho_Chi_Minh';
  const tzInfo = getTimeInZone(new Date(), timeZone);
  const nowMs = tzInfo.date.getTime();
  const todayStr = tzInfo.dateStr;
  const currentHour = tzInfo.hour;
  const currentMinute = tzInfo.minute;

  const tasks = await getDbTasks();
  const notes = await getDbNotes();
  const newTriggeredAlerts: NotificationLog[] = [];

  // A. Check Task Deadline Alerts (Standard exact deadline alert)
  for (const t of tasks) {
    if (t.status === 'completed' || t.status === 'canceled') continue;
    if (t.isNotified) continue;

    const deadlineTime = new Date(t.deadline).getTime();
    const diffMinutes = (deadlineTime - nowMs) / (1000 * 60);

    if (diffMinutes > 0 && diffMinutes <= (t.reminderOffsetMinutes || telegramConfig.alertOffsetMinutes || 15)) {
      const updatedTask: Task = {
        ...t,
        isNotified: true,
        lastNotifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveDbTask(updatedTask);

      const alertLog: NotificationLog = {
        id: `notif-${Date.now()}-${t.id}`,
        title: `⏰ Nhắc việc: ${t.title}`,
        message: `Công việc "${t.title}" sắp đến deadline vào ${new Date(t.deadline).toLocaleTimeString('vi-VN', { timeZone, hour: '2-digit', minute: '2-digit' })} (${Math.round(diffMinutes)} phút nữa)!`,
        channel: 'telegram',
        status: 'sent',
        timestamp: new Date().toISOString(),
        taskId: t.id,
      };
      await addDbNotificationLog(alertLog);
      newTriggeredAlerts.push(alertLog);

      if (telegramConfig.botToken && telegramConfig.chatId && telegramConfig.enabled !== false) {
        const alertText = `⏰ *NHẮC NHỞ DEADLINE*\n\n📌 Công việc: *${t.title}*\n⏳ Hạn chót: *${new Date(t.deadline).toLocaleString('vi-VN', { timeZone })}* (còn ${Math.round(diffMinutes)} phút)\n🎯 Mức độ: *${t.priority.toUpperCase()}*\n\n👇 *Bấm nút bên dưới để xử lý nhanh ngay trên Telegram:*`;
        sendTelegramMessage(
          telegramConfig.botToken,
          telegramConfig.chatId,
          alertText,
          buildTaskReminderKeyboard(t)
        ).catch(err => console.warn('Scheduler telegram push error:', err));
      }
    }
  }

  // B. AI Proactive Push Notifications & Smart Risk Alerting (High priority < 3h, Medium < 1.5h, Overload)
  try {
    await runProactiveRiskCheck();
  } catch (proactiveErr) {
    console.warn('[Scheduler] Proactive risk check error:', proactiveErr);
  }

  // C. Periodic Document Vector Synchronization (every 10 minutes)
  if (nowMs - lastVectorSyncTimestamp > 10 * 60 * 1000) {
    lastVectorSyncTimestamp = nowMs;
    syncAndVectorizeAllDocuments().catch(err => console.warn('[Scheduler] Vector sync error:', err));
  }

  // D. Automated Daily Briefings Dispatch (Configurable hours in Vietnam Timezone)
  if (telegramConfig.isConnected && telegramConfig.botToken && telegramConfig.chatId && telegramConfig.enabled !== false) {
    const morningHour = telegramConfig.morningBriefingHour ?? 7;
    const morningMinute = telegramConfig.morningBriefingMinute ?? 0;
    const isMorningEnabled = telegramConfig.enableMorningBriefing !== false;

    const eveningHour = telegramConfig.eveningBriefingHour ?? 21;
    const eveningMinute = telegramConfig.eveningBriefingMinute ?? 0;
    const isEveningEnabled = telegramConfig.enableEveningBriefing !== false;

    // Morning briefing check: Deduplicate using Firestore persistence + mutex lock
    const morningTargetMinutes = morningHour * 60 + morningMinute;
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    const isMorningTimeWindow = currentTotalMinutes >= morningTargetMinutes && currentTotalMinutes <= morningTargetMinutes + 60;

    if (isMorningEnabled && !isMorningDispatching && telegramConfig.lastMorningBriefingDate !== todayStr && isMorningTimeWindow) {
      isMorningDispatching = true;
      console.log(`[Scheduler] 🌅 Dispatching Morning Briefing at VN Time: ${currentHour}:${currentMinute.toString().padStart(2, '0')} (${todayStr})`);
      
      // Immediately write date lock to Firestore before slow AI generation
      saveDbTelegramConfig({
        lastMorningBriefingDate: todayStr,
        lastMorningBriefingSentAt: new Date().toISOString(),
      }).catch(err => console.warn('[Scheduler] Error saving morning briefing lock:', err));

      generateDailyBriefing('morning', getGeminiClient(), tasks, notes)
        .then(async (morningBriefing) => {
          await sendTelegramMessage(telegramConfig.botToken, telegramConfig.chatId, morningBriefing.reportText, [
            [{ text: '📋 Xem việc hôm nay', callback_data: 'cmd:today' }, { text: '🌤️ Thời tiết', callback_data: 'cmd:weather' }]
          ]);
          await addDbNotificationLog({
            id: `notif-${Date.now()}-morning-auto`,
            title: morningBriefing.title,
            message: morningBriefing.reportText.slice(0, 100) + '...',
            channel: 'telegram',
            status: 'sent',
            timestamp: new Date().toISOString(),
          });
        })
        .catch(e => console.warn('Auto morning briefing error:', e))
        .finally(() => {
          isMorningDispatching = false;
        });
    }

    // Evening briefing check: Deduplicate using Firestore persistence + mutex lock
    const eveningTargetMinutes = eveningHour * 60 + eveningMinute;
    const isEveningTimeWindow = currentTotalMinutes >= eveningTargetMinutes && currentTotalMinutes <= eveningTargetMinutes + 60;

    if (isEveningEnabled && !isEveningDispatching && telegramConfig.lastEveningBriefingDate !== todayStr && isEveningTimeWindow) {
      isEveningDispatching = true;
      console.log(`[Scheduler] 🌙 Dispatching Evening Briefing at VN Time: ${currentHour}:${currentMinute.toString().padStart(2, '0')} (${todayStr})`);

      // Immediately write date lock to Firestore before slow AI generation
      saveDbTelegramConfig({
        lastEveningBriefingDate: todayStr,
        lastEveningBriefingSentAt: new Date().toISOString(),
      }).catch(err => console.warn('[Scheduler] Error saving evening briefing lock:', err));

      generateDailyBriefing('evening', getGeminiClient(), tasks, notes)
        .then(async (eveningBriefing) => {
          await sendTelegramMessage(telegramConfig.botToken, telegramConfig.chatId, eveningBriefing.reportText, [
            [{ text: '📋 Xem việc hôm nay', callback_data: 'cmd:today' }, { text: '📋 Tất cả việc', callback_data: 'cmd:tasks' }]
          ]);
          await addDbNotificationLog({
            id: `notif-${Date.now()}-evening-auto`,
            title: eveningBriefing.title,
            message: eveningBriefing.reportText.slice(0, 100) + '...',
            channel: 'telegram',
            status: 'sent',
            timestamp: new Date().toISOString(),
          });
        })
        .catch(e => console.warn('Auto evening briefing error:', e))
        .finally(() => {
          isEveningDispatching = false;
        });
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    vnTime: `${todayStr} ${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}:${tzInfo.second.toString().padStart(2, '0')}`,
    timezone: timeZone,
    triggeredCount: newTriggeredAlerts.length,
    alerts: newTriggeredAlerts,
  };
}

let schedulerTimer: NodeJS.Timeout | null = null;

export function startBackgroundScheduler(intervalMs = 30000) {
  if (schedulerTimer) return;
  console.log(`⏰ Vietnam Timezone Background Scheduler initialized (${intervalMs / 1000}s tick)`);
  schedulerTimer = setInterval(() => {
    runSchedulerCheck().catch(err => console.warn('[Background Scheduler] tick error:', err));
  }, intervalMs);
}

export function stopBackgroundScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
