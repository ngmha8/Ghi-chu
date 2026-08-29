import {
  getDbTasks,
  saveDbTask,
  getDbTelegramConfig,
  addDbNotificationLog,
} from './firebaseDb.ts';
import {
  sendTelegramMessage,
  TelegramInlineKeyboard,
} from './telegramHelper.ts';
import type { Task, NotificationLog } from '../src/types/index.ts';

// In-memory tracker to prevent duplicate proactive alerts within short windows
// Map of taskId -> last alerted timestamp + risk stage
const proactiveAlertTracker = new Map<string, { stage: string; timestamp: number }>();

export interface TaskRiskAssessment {
  task: Task;
  riskLevel: 'critical_3h' | 'warning_90m' | 'overdue_recovery' | 'none';
  remainingMinutes: number;
  deadlineVn: string;
  recommendation: string;
}

/**
 * Assess risk for a single task
 */
export function assessTaskRisk(task: Task, nowMs: number, timeZone: string = 'Asia/Ho_Chi_Minh'): TaskRiskAssessment {
  if (task.status === 'completed' || task.status === 'canceled' || !task.deadline) {
    return {
      task,
      riskLevel: 'none',
      remainingMinutes: 0,
      deadlineVn: '',
      recommendation: '',
    };
  }

  const deadlineMs = new Date(task.deadline).getTime();
  const diffMinutes = (deadlineMs - nowMs) / (1000 * 60);

  const deadlineVn = new Date(task.deadline).toLocaleString('vi-VN', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });

  // 1. High priority nearing deadline (< 3 hours / 180 mins)
  if (task.priority === 'high' && diffMinutes > 15 && diffMinutes <= 180) {
    const hoursLeft = Math.floor(diffMinutes / 60);
    const minsLeft = Math.round(diffMinutes % 60);
    const timeStr = hoursLeft > 0 ? `${hoursLeft} giờ ${minsLeft > 0 ? `${minsLeft} phút` : ''}` : `${minsLeft} phút`;

    return {
      task,
      riskLevel: 'critical_3h',
      remainingMinutes: Math.round(diffMinutes),
      deadlineVn,
      recommendation: `🚨 Nhiệm vụ trọng tâm mức độ **CAO** chỉ còn **${timeStr}**. Bạn nên ưu tiên xử lý dứt điểm công việc này ngay bây giờ để tránh áp lực cận giờ!`,
    };
  }

  // 2. Medium priority nearing deadline (< 1.5 hours / 90 mins)
  if (task.priority === 'medium' && diffMinutes > 15 && diffMinutes <= 90) {
    const minsLeft = Math.round(diffMinutes);
    return {
      task,
      riskLevel: 'warning_90m',
      remainingMinutes: minsLeft,
      deadlineVn,
      recommendation: `⚡ Công việc sắp đến hạn trong **${minsLeft} phút**. Hãy kiểm tra các khâu chuẩn bị cuối cùng để hoàn thành đúng tiến độ.`,
    };
  }

  // 3. Overdue tasks (expired between 15m and 12 hours ago)
  if (diffMinutes < -15 && diffMinutes >= -720) {
    const overdueHours = Math.abs(Math.round(diffMinutes / 60));
    return {
      task,
      riskLevel: 'overdue_recovery',
      remainingMinutes: Math.round(diffMinutes),
      deadlineVn,
      recommendation: `⚠️ Công việc đã quá hạn khoảng **${overdueHours} tiếng**. Nếu đã hoàn thành, hãy bấm xác nhận hoặc dời lịch phù hợp.`,
    };
  }

  return {
    task,
    riskLevel: 'none',
    remainingMinutes: Math.round(diffMinutes),
    deadlineVn,
    recommendation: '',
  };
}

/**
 * Builds interactive Telegram keyboard for proactive alerts
 */
export function buildProactiveAlertKeyboard(task: Task): TelegramInlineKeyboard {
  return [
    [
      { text: '✅ Đã hoàn thành', callback_data: `done:${task.id}` },
      { text: '⏰ Gia hạn +1h', callback_data: `snooze:${task.id}:60` },
    ],
    [
      { text: '⏳ Gia hạn +3h', callback_data: `snooze:${task.id}:180` },
      { text: '📋 Xem việc hôm nay', callback_data: 'cmd:today' },
    ],
  ];
}

/**
 * Runs proactive risk detection across all tasks and sends smart Telegram push notifications
 */
export async function runProactiveRiskCheck(): Promise<{
  inspectedCount: number;
  criticalRisksCount: number;
  alertsSent: number;
  assessments: TaskRiskAssessment[];
}> {
  const telegramConfig = await getDbTelegramConfig();
  const timeZone = telegramConfig.timezone || 'Asia/Ho_Chi_Minh';
  const nowMs = Date.now();

  const tasks = await getDbTasks();
  const assessments: TaskRiskAssessment[] = [];
  let alertsSent = 0;
  let criticalRisksCount = 0;

  for (const t of tasks) {
    const assessment = assessTaskRisk(t, nowMs, timeZone);
    if (assessment.riskLevel !== 'none') {
      assessments.push(assessment);
      if (assessment.riskLevel === 'critical_3h') criticalRisksCount++;

      // Check anti-spam tracker
      const trackerKey = `${t.id}-${assessment.riskLevel}`;
      const lastAlert = proactiveAlertTracker.get(trackerKey);
      const cooldownMs = 2 * 60 * 60 * 1000; // 2 hours cooldown between same alert stage

      if (!lastAlert || nowMs - lastAlert.timestamp > cooldownMs) {
        // Send proactive push notification
        proactiveAlertTracker.set(trackerKey, { stage: assessment.riskLevel, timestamp: nowMs });

        const title = assessment.riskLevel === 'critical_3h'
          ? `🚨 CẢNH BÁO SỚM: Công việc [HIGH] còn < 3h`
          : assessment.riskLevel === 'warning_90m'
          ? `⚡ NHẮC NHỞ TIẾN ĐỘ: Hạn chót sắp tới`
          : `⚠️ RÀ SOÁT CÔNG VIỆC QUÁ HẠN`;

        const messageBody =
          `🤖 *TRỢ LÝ AI - CẢNH BÁO SỚM & ĐIỀU PHỐI CÔNG VIỆC*\n\n` +
          `📌 Công việc: *${t.title}*\n` +
          `🎯 Mức độ ưu tiên: *${t.priority.toUpperCase()}*\n` +
          `⏰ Hạn chót chính thức: *${assessment.deadlineVn}*\n` +
          `⏳ Thời gian còn lại: *${assessment.remainingMinutes > 0 ? `${Math.floor(assessment.remainingMinutes / 60)}h ${assessment.remainingMinutes % 60}p` : `Quá hạn ${Math.abs(Math.round(assessment.remainingMinutes / 60))}h`}*\n\n` +
          `💡 *Khuyến nghị điều hành từ AI:*\n${assessment.recommendation}\n\n` +
          `👇 *Chọn nhanh hành động dưới đây:*`;

        if (telegramConfig.isConnected && telegramConfig.botToken && telegramConfig.chatId && telegramConfig.enabled !== false) {
          sendTelegramMessage(
            telegramConfig.botToken,
            telegramConfig.chatId,
            messageBody,
            buildProactiveAlertKeyboard(t)
          ).catch(err => console.warn('[Proactive Alert Error] Telegram push failed:', err));
        }

        // Log notification to Firestore
        const logItem: NotificationLog = {
          id: `proactive-${nowMs}-${t.id}`,
          title,
          message: `${t.title} (Hạn: ${assessment.deadlineVn})`,
          channel: 'telegram',
          status: 'sent',
          timestamp: new Date().toISOString(),
          taskId: t.id,
        };
        await addDbNotificationLog(logItem);
        alertsSent++;
      }
    }
  }

  // Workload density check: If user has 3 or more tasks due within 4 hours
  const upcomingWithin4h = tasks.filter(t => {
    if (t.status === 'completed' || t.status === 'canceled' || !t.deadline) return false;
    const diff = (new Date(t.deadline).getTime() - nowMs) / (1000 * 60);
    return diff > 0 && diff <= 240;
  });

  if (upcomingWithin4h.length >= 3) {
    const densityKey = `workload-density-${new Date().toISOString().slice(0, 13)}`; // Once per hour max
    const lastDensity = proactiveAlertTracker.get(densityKey);

    if (!lastDensity && telegramConfig.isConnected && telegramConfig.botToken && telegramConfig.chatId) {
      proactiveAlertTracker.set(densityKey, { stage: 'workload_density', timestamp: nowMs });

      const taskListStr = upcomingWithin4h
        .map((t, idx) => `  ${idx + 1}. [${t.priority.toUpperCase()}] *${t.title}* (${new Date(t.deadline).toLocaleTimeString('vi-VN', { timeZone, hour: '2-digit', minute: '2-digit' })})`)
        .join('\n');

      const densityMsg =
        `📊 *AI ĐIỀU PHỐI TẢI CÔNG VIỆC: MẬT ĐỘ CAO TRONG 4 GIỜ TỚI*\n\n` +
        `Bạn đang có **${upcomingWithin4h.length} nhiệm vụ** cùng dồn vào khung giờ sắp tới:\n\n` +
        `${taskListStr}\n\n` +
        `💡 *Lời khuyên chiến lược:* Hãy tập trung hoàn thành các việc HIGH trước, và chủ động cân nhắc gia hạn các việc có thể linh hoạt để duy trì trạng thái làm việc tốt nhất!`;

      sendTelegramMessage(telegramConfig.botToken, telegramConfig.chatId, densityMsg, [
        [{ text: '📋 Xem việc hôm nay', callback_data: 'cmd:today' }],
      ]).catch(e => console.warn('Workload density msg error:', e));
    }
  }

  return {
    inspectedCount: tasks.length,
    criticalRisksCount,
    alertsSent,
    assessments,
  };
}
