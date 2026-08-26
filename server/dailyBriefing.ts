import { GoogleGenAI } from '@google/genai';
import { Task, Note } from '../src/types/index.ts';
import { safeGenerateContent } from './geminiHelper.ts';

export interface DailyBriefingResult {
  type: 'morning' | 'noon' | 'evening';
  title: string;
  reportText: string;
  generatedAt: string;
}

/**
 * Format date in Vietnam timezone (UTC+7)
 */
function getVnDateParts(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
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

  const year = parseInt(get('year'), 10);
  const month = parseInt(get('month'), 10);
  const day = parseInt(get('day'), 10);
  const hour = parseInt(get('hour'), 10);
  const minute = parseInt(get('minute'), 10);
  const dateIsoStr = `${get('year')}-${get('month')}-${get('day')}`;

  const weekdayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  // Create a localized date object to accurately get day of week in VN timezone
  const vnDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const weekdayStr = weekdayNames[vnDate.getDay()];
  const displayDateStr = `${weekdayStr}, ngày ${day < 10 ? '0' + day : day}/${month < 10 ? '0' + month : month}/${year}`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    dateIsoStr,
    weekdayStr,
    displayDateStr,
    timeStr: `${hour < 10 ? '0' + hour : hour}:${minute < 10 ? '0' + minute : minute}`,
  };
}

/**
 * Formats a task with precise temporal context to prevent AI deadline hallucinations
 */
function formatTaskWithTemporalContext(task: Task, currentVn: ReturnType<typeof getVnDateParts>): string {
  if (!task.deadline) {
    return `- [${task.status.toUpperCase()}] [${task.priority.toUpperCase()}] "${task.title}" (Không đặt deadline) | Tags: ${(task.tags || []).join(', ')}`;
  }

  const taskDateObj = new Date(task.deadline);
  const taskVn = getVnDateParts(taskDateObj);

  const diffMs = taskDateObj.getTime() - new Date().getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  let relativeTimeDesc = '';
  if (task.status === 'completed') {
    relativeTimeDesc = 'ĐÃ HOÀN THÀNH ✅';
  } else if (taskVn.dateIsoStr === currentVn.dateIsoStr) {
    relativeTimeDesc = diffHours >= 0
      ? `HẾT HẠN HÔM NAY (${taskVn.timeStr} hôm nay, còn ${diffHours}h)`
      : `QUÁ HẠN HÔM NAY (Quá hạn ${Math.abs(diffHours)}h)`;
  } else {
    // Tomorrow check
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = getVnDateParts(tomorrow).dateIsoStr;

    if (taskVn.dateIsoStr === tomorrowIso) {
      relativeTimeDesc = `HẾT HẠN NGÀY MAI (${taskVn.weekdayStr}, ${taskVn.day}/${taskVn.month} lúc ${taskVn.timeStr})`;
    } else if (diffMs < 0) {
      relativeTimeDesc = `ĐÃ QUÁ HẠN ${Math.abs(diffDays)} NGÀY (Hạn cũ: ${taskVn.timeStr} ${taskVn.weekdayStr}, ${taskVn.day}/${taskVn.month}/${taskVn.year})`;
    } else {
      relativeTimeDesc = `HẠN CÒN ${diffDays} NGÀY NỮA (Hạn chính thức: ${taskVn.timeStr} ${taskVn.weekdayStr}, ngày ${taskVn.day}/${taskVn.month}/${taskVn.year})`;
    }
  }

  return `- [${task.status.toUpperCase()}] [ƯU TIÊN: ${task.priority.toUpperCase()}] "${task.title}" | ⏰ ${relativeTimeDesc} | Tags: ${(task.tags || []).join(', ')}`;
}

/**
 * Generates an executive, highly humanized, empathetic AI Daily Briefing (Morning, Noon, or Evening)
 * with strict temporal precision and zero misleading deadline statements.
 */
export async function generateDailyBriefing(
  type: 'morning' | 'noon' | 'evening',
  gemini: GoogleGenAI,
  tasks: Task[],
  notes: Note[]
): Promise<DailyBriefingResult> {
  const now = new Date();
  const currentVn = getVnDateParts(now);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowVn = getVnDateParts(tomorrow);

  // Categorize tasks precisely
  const pendingTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'canceled');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  const todayTasks = pendingTasks.filter(t => {
    if (!t.deadline) return false;
    return getVnDateParts(new Date(t.deadline)).dateIsoStr === currentVn.dateIsoStr;
  });

  const tomorrowTasks = pendingTasks.filter(t => {
    if (!t.deadline) return false;
    return getVnDateParts(new Date(t.deadline)).dateIsoStr === tomorrowVn.dateIsoStr;
  });

  const upcomingTasks = pendingTasks.filter(t => {
    if (!t.deadline) return false;
    const taskIso = getVnDateParts(new Date(t.deadline)).dateIsoStr;
    return taskIso !== currentVn.dateIsoStr && taskIso !== tomorrowVn.dateIsoStr && new Date(t.deadline).getTime() > now.getTime();
  });

  const overdueTasks = pendingTasks.filter(t => {
    if (!t.deadline) return false;
    const taskIso = getVnDateParts(new Date(t.deadline)).dateIsoStr;
    return taskIso !== currentVn.dateIsoStr && new Date(t.deadline).getTime() < now.getTime();
  });

  const highPriority = pendingTasks.filter(t => t.priority === 'high');

  // Detailed formatted task representations
  const formattedTasksList = tasks.map(t => formatTaskWithTemporalContext(t, currentVn)).join('\n');

  // -------------------------------------------------------------
  // PROMPT DEFINITIONS ACCORDING TO BRIEFING TYPE
  // -------------------------------------------------------------
  let briefingTitle = '';
  let prompt = '';

  const temporalRules = `
=== NGUYÊN TẮC BẤT DI BẤT DỊCH VỀ THỜI GIAN & HẠN CHÓT (STRICT TEMPORAL GROUNDING):
1. **Tuyệt đối không gây hiểu lầm về Deadline thực tế**:
   - Khi nhắc tới bất kỳ nhiệm vụ nào, BẮT BUỘC phải ghi rõ ràng ngày giờ hết hạn chính thức (Ví dụ: "Hạn chót chính thức: 16:00 Thứ Sáu, 28/08 (còn 2 ngày nữa)").
   - PHÂN BIỆT RẠCH RÒI giữa "Khung giờ gợi ý làm việc" (Suggested Focus Window) và "Hạn chót thực tế" (Official Deadline).
   - Ví dụ SAI GÂY HIỂU LẦM: "Tiêu điểm sáng (Trước 16:00): Tập trung giải quyết hồ sơ ABC" -> Người dùng sẽ tưởng là hết hạn 16h ngày mai!
   - Ví dụ ĐÚNG CHUẨN MỰC: "🎯 Gợi ý tiến độ: Dành khung giờ làm việc buổi sáng để chuẩn bị hồ sơ ABC (Hạn chót nộp chính thức: 16:00 Thứ Sáu, 28/08 - còn 2 ngày nữa)".
2. **Nhân tính hóa & Tinh thần Cố vấn Cấp cao (Executive Empathy)**:
   - Giao tiếp chân thành, ấm áp, thấu hiểu, mang lại cảm giác an tâm, chủ động, không sáo rỗng hay áp lực.
   - Thể hiện sự tinh tế của một người bạn đồng hành trí tuệ và trợ lý điều hành hơn 20 năm kinh nghiệm.
   - Trình bày định dạng Markdown Telegram đẹp mắt, chia mục rõ ràng, sử dụng emoji tinh tế.
`;

  if (type === 'morning') {
    briefingTitle = `🌅 Bản tin điểm hẹn buổi sáng (${currentVn.displayDateStr})`;
    prompt = `Bạn là Trợ Lý Cố Vấn Điều Hành Cao Cấp (Senior AI Executive Companion) của tôi.
Hãy soạn bản tin "🌅 BẢN TIN ĐIỂM HẸN BUỔI SÁNG (MORNING BRIEFING)" gửi qua Telegram cá nhân.

THÔNG TIN THỜI GIAN & HỆ THỐNG:
- Thời điểm hiện tại: ${currentVn.timeStr} - ${currentVn.displayDateStr}
- Công việc hết hạn HÔM NAY: ${todayTasks.length} việc
- Công việc hết hạn NGÀY MAI: ${tomorrowTasks.length} việc
- Công việc ưu tiên cao (HIGH): ${highPriority.length} việc
- Công việc sắp tới trong tuần: ${upcomingTasks.length} việc
- Công việc đã quá hạn cần xử lý: ${overdueTasks.length} việc

CHI TIẾT TOÀN BỘ CÔNG VIỆC TRONG HỆ THỐNG:
${formattedTasksList || 'Hiện không có công việc nào trong hệ thống.'}

${temporalRules}

CẤU TRÚC BẢN TIN BUỔI SÁNG:
1. 🌅 **LỜI CHÀO NGÀY MỚI TRUYỀN CẢM HỨNG**: Ấm áp, tràn đầy năng lượng tích cực và thấu cảm.
2. 🎯 **TIÊU ĐIỂM HÔM NAY & THỨ TỰ ƯU TIÊN**: Nêu rõ các việc cần xử lý hôm nay (ghi đúng giờ hết hạn hôm nay). Nếu hôm nay không có deadline, gợi ý giải quyết các việc quan trọng sắp tới kèm ngày hết hạn chính xác.
3. 🗺️ **LỘ TRÌNH KHUYÊN DÙNG**: Gợi ý phân bổ thời gian hợp lý (Khung giờ tập trung sâu buổi sáng, rà soát buổi chiều).
4. 🌿 **CHĂM SÓC THÂN TÂM & NĂNG LƯỢNG**: Lời nhắc uống nước, giữ tâm thế thoải mái và 1 câu triết lý sống/năng suất ngắn gọn sâu sắc.`;
  } else if (type === 'noon') {
    briefingTitle = `☀️ Bản tin tiếp năng lượng buổi trưa (${currentVn.displayDateStr})`;
    prompt = `Bạn là Trợ Lý Cố Vấn Điều Hành Cao Cấp (Senior AI Executive Companion) của tôi.
Hãy soạn bản tin "☀️ BẢN TIN TIẾP NĂNG LƯỢNG BUỔI TRƯA (MIDDAY REFOCUS)" gửi qua Telegram.

THÔNG TIN THỜI GIAN & HỆ THỐNG:
- Thời điểm hiện tại: ${currentVn.timeStr} - ${currentVn.displayDateStr}
- Công việc hết hạn chiều/tối nay: ${todayTasks.length} việc
- Danh sách công việc:
${formattedTasksList || 'Không có việc nào'}

${temporalRules}

CẤU TRÚC BẢN TIN TRƯA:
1. ☀️ **LỜI HỎI THĂM TRƯA**: Nhắc người dùng nghỉ ngơi, ăn trưa và thư giãn mắt.
2. 📊 **ĐIỂM LẠI TIẾN ĐỘ & NHIỆM VỤ CHIỀU**: Nhẹ nhàng điểm qua các việc cần giải quyết trong buổi chiều nay nếu có.
3. 🧘 **TÁI TẠO NĂNG LƯỢNG**: Lời khuyên 10-15 phút chợp mắt hoặc thả lỏng để chiều làm việc hiệu quả.`;
  } else {
    // Evening Briefing
    briefingTitle = `🌙 Báo cáo tổng kết ngày & Kế hoạch ngày mai (${currentVn.displayDateStr})`;
    prompt = `Bạn là Trợ Lý Cố Vấn Điều Hành Cao Cấp (Senior AI Executive Companion) của tôi.
Hãy soạn bản "🌙 BÁO CÁO TỔNG KẾT NGÀY & KẾ HOẠCH NGÀY MAI (EVENING BRIEFING)" gửi qua Telegram.

THÔNG TIN TỔNG KẾT NGÀY HÔM NAY:
- Hôm nay: ${currentVn.displayDateStr}
- Ngày mai: ${tomorrowVn.displayDateStr}
- Số việc đã hoàn thành hôm nay: ${completedTasks.length} việc
- Số việc tồn đọng cần giải quyết: ${pendingTasks.length} việc
- Việc hết hạn ngày mai (${tomorrowVn.weekdayStr}, ${tomorrowVn.day}/${tomorrowVn.month}): ${tomorrowTasks.length} việc
- Việc sắp tới các ngày sau: ${upcomingTasks.length} việc

CHI TIẾT DANH SÁCH CÔNG VIỆC:
${formattedTasksList || 'Không có việc nào.'}

${temporalRules}

CẤU TRÚC BẢN TIN BUỔI TỐI:
1. 🌙 **LỜI CHÀO BUỔI TỐI ẤM ÁP & TRI ÂN**: Ghi nhận một ngày nỗ lực và cống hiến của người dùng.
2. 🏆 **VINH DANH TIẾN ĐỘ & THÀNH QUẢ**: Khen ngợi những việc đã hoàn thành hoặc những bước tiến thực tế trong ngày.
3. ⏳ **ĐIỂM NHÌN NGÀY MAI (${tomorrowVn.displayDateStr})**:
   - Nếu ngày mai có việc đến hạn: Nêu rõ tên việc và giờ hết hạn chính thức của ngày mai.
   - Nếu ngày mai KHÔNG có việc đến hạn: Nêu rõ ngày mai không có deadline áp lực, gợi ý chủ động chuẩn bị các việc sắp tới (BẮT BUỘC ghi rõ ngày hạn chót thực tế của các việc đó, ví dụ: "Hạn chính thức: 16:00 Thứ Sáu 28/08 - còn 2 ngày").
4. 🌿 **LỜI NHẮC NGHỈ NGƠI & TÁI TẠO NĂNG LƯỢNG**: Động viên rời xa thiết bị công việc, thư giãn trọn vẹn để có giấc ngủ sâu và tái tạo tinh lực cho ngày mới.`;
  }

  try {
    let res: any = null;
    try {
      res = await safeGenerateContent({
        gemini,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
    } catch {
      res = await safeGenerateContent({
        gemini,
        contents: prompt,
      });
    }

    const reportText = res?.text || (type === 'morning'
      ? `🌅 *BẢN TIN BUỔI SÁNG - ${currentVn.displayDateStr}*\n\nChào ngày mới! Chúc bạn một ngày làm việc hanh thông và tràn đầy năng lượng!\n\n📋 *Tiêu điểm hôm nay:* Bạn có *${todayTasks.length} việc cần xử lý hôm nay* và *${pendingTasks.length} việc đang mở*.`
      : `🌙 *BÁO CÁO TỔNG KẾT TỐI - ${currentVn.displayDateStr}*\n\n🏆 *Thành quả hôm nay:* Bạn đã hoàn thành *${completedTasks.length} việc*!\n⏳ *Ngày mai (${tomorrowVn.displayDateStr}):* Có *${tomorrowTasks.length} deadline*. Hãy an tâm nghỉ ngơi thật ngon giấc!`
    );

    return {
      type,
      title: briefingTitle,
      reportText,
      generatedAt: now.toISOString(),
    };
  } catch (e: any) {
    console.warn(`[Daily Briefing ${type}] Gemini error, using fallback:`, e);
    return {
      type,
      title: briefingTitle,
      reportText: type === 'morning'
        ? `🌅 *BẢN TIN ĐIỂM HẸN BUỔI SÁNG - ${currentVn.displayDateStr}*\n\nChào bạn một ngày mới an lành và tràn đầy nhiệt huyết!\n\n🎯 *Tiêu điểm hôm nay:* Bạn có *${todayTasks.length} công việc* và *${highPriority.length} việc ưu tiên cao*.\n✨ *Chúc bạn một ngày làm chủ thời gian và gặt hái nhiều kết quả tốt đẹp!*`
        : `🌙 *BÁO CÁO TỔNG KẾT TỐI - ${currentVn.displayDateStr}*\n\n🏆 *Thành quả hôm nay:* Bạn đã hoàn thành xuất sắc *${completedTasks.length} công việc*!\n⏳ Còn *${pendingTasks.length} việc* đã được phân loại ngăn nắp.\n🌿 *Chúc bạn có một buổi tối bình yên và một giấc ngủ thật sâu!*`,
      generatedAt: now.toISOString(),
    };
  }
}
