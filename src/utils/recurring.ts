import { Task, RecurringRule, RecurringUnit } from '../types/index.js';

/**
 * Calculates the next recurring date based on a base date, a time unit (day, month, year, week, hour),
 * and an interval count (e.g. 3 months, 1 year, 14 days).
 *
 * Guaranteed to handle leap years, month-end capping, and preserves exact local hours & minutes.
 */
export function calculateNextRecurringDate(
  baseDateInput: Date | string,
  unit: RecurringUnit,
  interval: number = 1
): Date {
  const baseDate = typeof baseDateInput === 'string' ? new Date(baseDateInput) : new Date(baseDateInput.getTime());
  const next = new Date(baseDate.getTime());
  const safeInterval = Math.max(1, Math.floor(interval || 1));

  if (unit === 'day') {
    next.setDate(next.getDate() + safeInterval);
  } else if (unit === 'week') {
    next.setDate(next.getDate() + safeInterval * 7);
  } else if (unit === 'month') {
    const targetDay = baseDate.getDate();
    // Set to 1st of month before altering month to prevent unintended overflow
    next.setDate(1);
    next.setMonth(next.getMonth() + safeInterval);
    // Find last day of target month (e.g. 28/29 for Feb, 30 for Apr, 31 for Dec)
    const maxDays = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(targetDay, maxDays));
  } else if (unit === 'year') {
    const targetDay = baseDate.getDate();
    const targetMonth = baseDate.getMonth();
    next.setDate(1);
    next.setFullYear(next.getFullYear() + safeInterval);
    next.setMonth(targetMonth);
    const maxDays = new Date(next.getFullYear(), targetMonth + 1, 0).getDate();
    next.setDate(Math.min(targetDay, maxDays));
  } else if (unit === 'hour') {
    next.setHours(next.getHours() + safeInterval);
  }

  return next;
}

/**
 * Normalizes any RecurringRule (including legacy 'daily', 'weekly', 'monthly')
 * into the standard { isRecurring, unit, interval, repeatOnComplete } representation.
 */
export function normalizeRecurringRule(rule?: RecurringRule | null): {
  isRecurring: boolean;
  unit: RecurringUnit;
  interval: number;
  repeatOnComplete: boolean;
} {
  if (!rule || rule.type === 'none') {
    return {
      isRecurring: false,
      unit: 'month',
      interval: 1,
      repeatOnComplete: false,
    };
  }

  let unit: RecurringUnit = rule.unit || 'month';
  let interval = rule.interval && rule.interval > 0 ? rule.interval : 1;

  // Legacy mappings
  if (rule.type === 'daily') {
    unit = 'day';
  } else if (rule.type === 'weekly') {
    unit = 'week';
  } else if (rule.type === 'monthly') {
    unit = 'month';
  } else if (rule.type === 'hourly') {
    unit = 'hour';
  } else if (rule.type === 'yearly') {
    unit = 'year';
  }

  const repeatOnComplete = rule.repeatOnComplete !== false;

  return {
    isRecurring: true,
    unit,
    interval,
    repeatOnComplete,
  };
}

/**
 * Returns human-readable Vietnamese label for recurring unit
 */
export function getUnitLabel(unit: RecurringUnit, interval: number = 1): string {
  switch (unit) {
    case 'day':
      return interval === 1 ? 'ngày' : `${interval} ngày`;
    case 'month':
      return interval === 1 ? 'tháng' : `${interval} tháng`;
    case 'year':
      return interval === 1 ? 'năm' : `${interval} năm`;
    case 'week':
      return interval === 1 ? 'tuần' : `${interval} tuần`;
    case 'hour':
      return interval === 1 ? 'giờ' : `${interval} giờ`;
    default:
      return `${interval} chu kỳ`;
  }
}

/**
 * Formats a clean, readable recurring summary badge/label
 * e.g. "Lặp mỗi 3 tháng", "Lặp mỗi 1 năm", "Không lặp lại"
 */
export function formatRecurringLabel(rule?: RecurringRule | null): string {
  const norm = normalizeRecurringRule(rule);
  if (!norm.isRecurring) {
    return 'Không lặp lại';
  }
  return `Lặp mỗi ${getUnitLabel(norm.unit, norm.interval)}`;
}

/**
 * Formats date into Vietnamese display string: dd/MM/yyyy HH:mm
 */
export function formatDateTimeVi(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Given a deadline and a recurring rule, calculates the next deadline ISO string
 * and helpful preview texts for UI feedback.
 */
export function computeNextRecurringDeadline(
  currentDeadline: string | Date,
  rule: RecurringRule
): {
  nextDeadlineIso: string;
  formattedNextDate: string;
  summary: string;
} {
  const norm = normalizeRecurringRule(rule);
  const nextDate = calculateNextRecurringDate(currentDeadline, norm.unit, norm.interval);
  const nextDeadlineIso = nextDate.toISOString();
  const formattedNextDate = formatDateTimeVi(nextDate);
  const summary = `sau ${getUnitLabel(norm.unit, norm.interval)} (${formattedNextDate})`;

  return {
    nextDeadlineIso,
    formattedNextDate,
    summary,
  };
}

/**
 * Core business logic: Process task completion for a recurring task.
 * If the task is configured to repeat on completion:
 * - Advances deadline to the next scheduled cycle
 * - Sets status back to 'in_progress'
 * - Resets reminder flags (isNotified = false, lastNotifiedAt = undefined)
 * - Increments completed cycles counter
 * - Updates updatedAt and lastCompletedAt timestamps
 */
export function processTaskRecurrenceOnComplete(task: Task): {
  updatedTask: Task;
  isRecurring: boolean;
  nextDeadline?: string;
  formattedNextDate?: string;
  summary?: string;
} {
  const norm = normalizeRecurringRule(task.recurring);

  if (!norm.isRecurring || !norm.repeatOnComplete) {
    // Normal completion
    return {
      updatedTask: {
        ...task,
        status: 'completed',
        updatedAt: new Date().toISOString(),
      },
      isRecurring: false,
    };
  }

  // Calculate next deadline
  const currentDeadline = task.deadline || new Date().toISOString();
  const { nextDeadlineIso, formattedNextDate, summary } = computeNextRecurringDeadline(
    currentDeadline,
    task.recurring
  );

  const updatedCycles = (task.recurring.completedCycles || 0) + 1;
  const nowIso = new Date().toISOString();

  const updatedTask: Task = {
    ...task,
    deadline: nextDeadlineIso,
    status: 'in_progress', // Ready for next cycle
    isNotified: false, // Re-enable Telegram reminder for next cycle
    lastNotifiedAt: undefined,
    recurring: {
      ...task.recurring,
      type: 'interval',
      unit: norm.unit,
      interval: norm.interval,
      repeatOnComplete: true,
      completedCycles: updatedCycles,
      lastCompletedAt: nowIso,
      originalDeadline: task.recurring.originalDeadline || currentDeadline,
    },
    updatedAt: nowIso,
  };

  return {
    updatedTask,
    isRecurring: true,
    nextDeadline: nextDeadlineIso,
    formattedNextDate,
    summary: `Đã hoàn thành chu kỳ #${updatedCycles}! Hạn chót tự động dời sang ${formattedNextDate} (+${getUnitLabel(norm.unit, norm.interval)}).`,
  };
}
