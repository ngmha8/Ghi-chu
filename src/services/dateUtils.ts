/**
 * Date and Official Deadline utilities for Vietnam Timezone (Asia/Ho_Chi_Minh / UTC+7)
 */

export function formatOfficialDeadline(deadline: string | undefined | null): string {
  if (!deadline) return 'Không đặt hạn chót';
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return deadline;

  const weekdayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const weekday = weekdayNames[d.getDay()];
  const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return `${timeStr} ${weekday}, ${dateStr}`;
}

export function formatDeadlineShort(deadline: string | undefined | null): string {
  if (!deadline) return 'Không đặt hạn';
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return deadline;

  const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  return `${timeStr} - ${dateStr}`;
}

export interface DeadlineStatusInfo {
  label: string;
  isOverdue: boolean;
  isToday: boolean;
  isTomorrow: boolean;
  badgeClass: string;
  remainingText: string;
}

export function getDeadlineStatusInfo(
  deadline: string | undefined | null,
  status: string = 'todo'
): DeadlineStatusInfo {
  if (!deadline) {
    return {
      label: 'Không thời hạn',
      isOverdue: false,
      isToday: false,
      isTomorrow: false,
      badgeClass: 'bg-zinc-800 text-zinc-400 border-zinc-700',
      remainingText: 'Không giới hạn thời gian',
    };
  }

  const d = new Date(deadline);
  if (isNaN(d.getTime())) {
    return {
      label: deadline,
      isOverdue: false,
      isToday: false,
      isTomorrow: false,
      badgeClass: 'bg-zinc-800 text-zinc-400 border-zinc-700',
      remainingText: '',
    };
  }

  if (status === 'completed') {
    return {
      label: 'Đã hoàn thành ✅',
      isOverdue: false,
      isToday: false,
      isTomorrow: false,
      badgeClass: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50',
      remainingText: 'Đã xong',
    };
  }

  if (status === 'canceled') {
    return {
      label: 'Đã hủy',
      isOverdue: false,
      isToday: false,
      isTomorrow: false,
      badgeClass: 'bg-zinc-900 text-zinc-500 border-zinc-800',
      remainingText: 'Đã hủy',
    };
  }

  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const deadlineStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  const isToday = deadlineStr === todayStr;
  const isTomorrow = deadlineStr === tomorrowStr;
  const isOverdue = diffMs < 0;

  if (isOverdue) {
    const overdueDays = Math.abs(diffDays);
    const overdueHours = Math.abs(diffHours);
    const text = overdueDays >= 1 ? `Quá hạn ${overdueDays} ngày` : `Quá hạn ${overdueHours}h`;
    return {
      label: `⚠️ ${text}`,
      isOverdue: true,
      isToday,
      isTomorrow: false,
      badgeClass: 'bg-rose-950/60 text-rose-300 border-rose-800/60',
      remainingText: text,
    };
  }

  if (isToday) {
    const text = diffHours <= 1 ? 'Hết hạn trong vòng 1 giờ' : `Còn ${diffHours} giờ (Hôm nay)`;
    return {
      label: `🔥 ${text}`,
      isOverdue: false,
      isToday: true,
      isTomorrow: false,
      badgeClass: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
      remainingText: text,
    };
  }

  if (isTomorrow) {
    return {
      label: `⏳ Hết hạn ngày mai (${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`,
      isOverdue: false,
      isToday: false,
      isTomorrow: true,
      badgeClass: 'bg-sky-950/50 text-sky-300 border-sky-800/50',
      remainingText: 'Hết hạn ngày mai',
    };
  }

  return {
    label: `⏰ Còn ${diffDays} ngày nữa`,
    isOverdue: false,
    isToday: false,
    isTomorrow: false,
    badgeClass: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60',
    remainingText: `Còn ${diffDays} ngày`,
  };
}
