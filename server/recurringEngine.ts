import { Task, RecurringRule, RecurringUnit } from '../src/types/index.js';

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
    next.setDate(1);
    next.setMonth(next.getMonth() + safeInterval);
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

  if (rule.type === 'daily') unit = 'day';
  else if (rule.type === 'weekly') unit = 'week';
  else if (rule.type === 'monthly') unit = 'month';
  else if (rule.type === 'hourly') unit = 'hour';
  else if (rule.type === 'yearly') unit = 'year';

  const repeatOnComplete = rule.repeatOnComplete !== false;

  return {
    isRecurring: true,
    unit,
    interval,
    repeatOnComplete,
  };
}

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

export function formatRecurringLabel(rule?: RecurringRule | null): string {
  const norm = normalizeRecurringRule(rule);
  if (!norm.isRecurring) {
    return 'Không lặp lại';
  }
  return `Lặp mỗi ${getUnitLabel(norm.unit, norm.interval)}`;
}

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

export function processTaskRecurrenceOnComplete(task: Task): {
  updatedTask: Task;
  isRecurring: boolean;
  nextDeadline?: string;
  summary?: string;
  formattedNextDate?: string;
} {
  const norm = normalizeRecurringRule(task.recurring);

  if (!norm.isRecurring || !norm.repeatOnComplete) {
    return {
      updatedTask: {
        ...task,
        status: 'completed',
        updatedAt: new Date().toISOString(),
      },
      isRecurring: false,
    };
  }

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
    status: 'in_progress',
    isNotified: false,
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
