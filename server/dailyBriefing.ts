import { GoogleGenAI } from '@google/genai';
import { Task, Note } from '../src/types/index.ts';
import { safeGenerateContent } from './geminiHelper.ts';

export interface DailyBriefingResult {
  type: 'morning' | 'evening';
  title: string;
  reportText: string;
  generatedAt: string;
}

/**
 * Formats a Date object to localized Vietnam date string (YYYY-MM-DD)
 */
function getVnDateIso(d: Date | string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date(d));
}

/**
 * Formats a deadline to a full, unambiguous Vietnamese timestamp:
 * e.g. "16:00 Thứ Sáu, 28/08/2026"
 */
function formatFullDeadline(dateStr: string): string {
  if (!dateStr) return 'Không có hạn chót';
  const d = new Date(dateStr);
  const time = d.toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const weekday = d.toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'long',
  });
  const date = d.toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return `${time} ${weekday}, ${date}`;
}

/**
 * Generates an executive, concise, factually precise Morning or Evening briefing
 */
export async function generateDailyBriefing(
  type: 'morning' | 'evening',
  gemini: GoogleGenAI,
  tasks: Task[],
  notes: Note[]
): Promise<DailyBriefingResult> {
  const now = new Date();
  const dateStr = now.toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  
  const todayIso = getVnDateIso(now);
  
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowIso = getVnDateIso(tomorrow);
  const tomorrowWeekday = tomorrow.toLocaleDateString('vi-VN', {
    weekday: 'long',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  const tomorrowDateStr = tomorrow.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  // Categorize tasks accurately by dates
  const todayTasks = tasks.filter(t => {
    if (!t.deadline || t.status === 'completed' || t.status === 'canceled') return false;
    return getVnDateIso(t.deadline) === todayIso;
  });

  const tomorrowTasks = tasks.filter(t => {
    if (!t.deadline || t.status === 'completed' || t.status === 'canceled') return false;
    return getVnDateIso(t.deadline) === tomorrowIso;
  });

  const upcomingTasks = tasks.filter(t => {
    if (!t.deadline || t.status === 'completed' || t.status === 'canceled') return false;
    const taskIso = getVnDateIso(t.deadline);
    return taskIso > tomorrowIso;
  });

  const overdueTasks = tasks.filter(t => {
    if (!t.deadline || t.status === 'completed' || t.status === 'canceled') return false;
    const taskIso = getVnDateIso(t.deadline);
    return taskIso < todayIso;
  });

  const completedToday = tasks.filter(t => {
    if (t.status !== 'completed') return false;
    if (!t.updatedAt) return true;
    return getVnDateIso(t.updatedAt) === todayIso;
  });

  const allPendingTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'canceled');
  const highPriority = allPendingTasks.filter(t => t.priority === 'high');

  // Build categorized context strings with unambiguous full deadlines
  const todayTasksText = todayTasks.length > 0
    ? todayTasks.map(t => `- [${t.priority.toUpperCase()}] "${t.title}" | Hạn chót chính xác: ${formatFullDeadline(t.deadline)}`).join('\n')
    : 'Không có công việc nào đến hạn hôm nay.';

  const tomorrowTasksText = tomorrowTasks.length > 0
    ? tomorrowTasks.map(t => `- [${t.priority.toUpperCase()}] "${t.title}" | Hạn chót chính xác: ${formatFullDeadline(t.deadline)}`).join('\n')
    : 'Chưa có công việc nào có hạn chót vào ngày mai.';

  const upcomingTasksText = upcomingTasks.length > 0
    ? upcomingTasks.map(t => `- [${t.priority.toUpperCase()}] "${t.title}" | Hạn chót chính xác: ${formatFullDeadline(t.deadline)}`).join('\n')
    : 'Không có công việc sắp tới trong tuần.';

  const overdueTasksText = overdueTasks.length > 0
    ? overdueTasks.map(t => `- [QUÁ HẠN] [${t.priority.toUpperCase()}] "${t.title}" | Hạn chót gốc: ${formatFullDeadline(t.deadline)}`).join('\n')
    : 'Không có công việc quá hạn.';

  const completedTodayText = completedToday.length > 0
    ? completedToday.map(t => `- ✅ "${t.title}"`).join('\n')
    : 'Hôm nay chưa có việc nào được đánh dấu hoàn thành.';

  if (type === 'morning') {
    const prompt = `Bạn là Trợ Lý Điều Hành Cấp Cao (Executive Assistant / Chief of Staff) chuyên nghiệp, đáng tin cậy và chuẩn xác tuyệt đối.

Hãy soạn một bản "🌅 BẢN TIN ĐIỂM HẸN BUỔI SÁNG (MORNING BRIEFING)" gửi lên Telegram cá nhân.

THÔNG TIN THỰC TẾ TRONG HỆ THỐNG:
- Thời gian: ${dateStr}
- Việc cần làm hôm nay: ${todayTasks.length} việc
- Việc ưu tiên cao (HIGH): ${highPriority.length} việc
- Việc quá hạn cần xử lý: ${overdueTasks.length} việc

CHI TIẾT CÔNG VIỆC:
=== VIỆC ĐẾN HẠN HÔM NAY ===
${todayTasksText}

=== VIỆC QUÁ HẠN (NẾU CÓ) ===
${overdueTasksText}

=== VIỆC QUAN TRỌNG SẮP TỚI TRONG TUẦN (LƯU Ý DEADLINE THỰC TẾ) ===
${upcomingTasksText}

NGUYÊN TẮC SOẠN THẢO (BẮT BUỘC TUÂN THỦ):
1. **Văn phong Trợ lý Điều hành Thực thụ (Executive Tone)**:
   - Ngắn gọn, gãy gọn, điềm đạm, tôn trọng và chuyên nghiệp.
   - Tuyệt đối KHÔNG viết văn hoa, sáo rỗng, triết lý dài dòng hay dùng từ ngữ phóng đại.
2. **CHÍNH XÁC TUYỆT ĐỐI VỀ THỜI GIAN & HẠN CHÓT (DEADLINE PRECISION)**:
   - Khi nhắc đến bất kỳ công việc nào, PHẢI nêu rõ hạn chót chính xác (giờ, thứ, ngày/tháng).
   - Nếu gợi ý người dùng chuẩn bị trước cho một việc của những ngày sau, PHẢI ghi rõ: "Hạn chót chính thức: [Giờ Thứ, Ngày/Tháng]". Tuyệt đối không dùng cách diễn đạt gây hiểu lầm là việc đó hết hạn hôm nay.
3. **Cấu trúc bản tin rõ ràng, dễ đọc trên di động**:
   - 🌅 **Chào buổi sáng**: 1 câu ngắn gọn, lịch sự.
   - 🎯 **Trọng tâm hôm nay**: Liệt kê 1-3 việc cấp thiết nhất hôm nay kèm giờ cụ thể.
   - 📅 **Lưu ý tiến độ tuần**: Nhắc ngắn gọn các việc lớn sắp tới (ghi rõ ngày hạn chót thực tế).
   - 💡 **Gợi ý hành động**: 1 lời khuyên thực tế, ngắn gọn để tối ưu hóa thời gian hôm nay.`;

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

      const reportText = res?.text || `🌅 *BẢN TIN BUỔI SÁNG - ${dateStr}*\n\nChào Anh/Chị! Chúc Anh/Chị một ngày làm việc hiệu quả.\n\n🎯 *Trọng tâm hôm nay:*\n${todayTasksText}\n\n📅 *Việc sắp tới trong tuần:*\n${upcomingTasksText}`;

      return {
        type: 'morning',
        title: `🌅 Bản tin buổi sáng (${now.toLocaleDateString('vi-VN')})`,
        reportText,
        generatedAt: now.toISOString(),
      };
    } catch (e: any) {
      console.warn('Morning briefing Gemini error, using fallback:', e);
      return {
        type: 'morning',
        title: `🌅 Bản tin buổi sáng (${now.toLocaleDateString('vi-VN')})`,
        reportText: `🌅 *BẢN TIN BUỔI SÁNG - ${dateStr}*\n\nChào Anh/Chị! Hôm nay hệ thống ghi nhận:\n• *${todayTasks.length} việc* cần hoàn thành trong ngày.\n• *${highPriority.length} việc* ưu tiên cao.\n\n🎯 *Việc hôm nay:*\n${todayTasksText}`,
        generatedAt: now.toISOString(),
      };
    }
  } else {
    // Evening Briefing
    const prompt = `Bạn là Trợ Lý Điều Hành Cấp Cao (Executive Assistant / Chief of Staff) chuyên nghiệp, điềm đạm và chính xác tuyệt đối.

Hãy soạn một bản "🌙 BÁO CÁO TỔNG KẾT NGÀY & ĐIỂM NHÌN NGÀY MAI (EVENING BRIEFING)" gửi lên Telegram.

THÔNG TIN THỰC TẾ HÔM NAY (${dateStr}):
- Ngày mai là: ${tomorrowWeekday}, ngày ${tomorrowDateStr}
- Số việc đã hoàn thành hôm nay: ${completedToday.length}
- Số việc tồn đọng chưa xong: ${allPendingTasks.length}

CHI TIẾT CÔNG VIỆC:
=== VIỆC ĐÃ HOÀN THÀNH HÔM NAY ===
${completedTodayText}

=== VIỆC ĐẾN HẠN VÀO NGÀY MAI (${tomorrowWeekday}, ${tomorrowDateStr}) ===
${tomorrowTasksText}

=== VIỆC SẮP TỚI CẦN LƯU Ý TRONG TUẦN (LƯU Ý DEADLINE CHÍNH THỨC) ===
${upcomingTasksText}

=== VIỆC ĐANG QUÁ HẠN (NẾU CÓ) ===
${overdueTasksText}

NGUYÊN TẮC SOẠN THẢO (BẮT BUỘC TUÂN THỦ NGHIÊM NGẶT):
1. **Văn phong Chuẩn mực, Tinh gọn (Executive Tone)**:
   - Ngắn gọn, súc tích, chuyên nghiệp, thể hiện sự chu đáo của người trợ lý.
   - Tuyệt đối TRÁNH các câu văn hoa sáo rỗng như "Một ngày dài lại khép lại, hoàng hôn đã nhường chỗ...", "bảng kết quả chưa xuất hiện chiếc tích xanh...", "trút bỏ bận bề ngoài cánh cửa...".
2. **CHỐNG GÂY HIỂU LẦM VỀ HẠN CHÓT (CRITICAL DEADLINE ACCURACY)**:
   - Trong mục "ĐIỂM NHÌN NGÀY MAI (${tomorrowWeekday}, ${tomorrowDateStr})":
     + Nếu công việc CÓ HẠN VÀO NGÀY MAI: Ghi rõ "*Hạn chót: [Giờ] ngày mai*".
     + Nếu công việc CÓ HẠN VÀO CÁC NGÀY SAU (ví dụ: ngày 28/08) nhưng muốn gợi ý làm sớm: BẮT BUỘC phải ghi rõ ràng: "*Gợi ý chuẩn bị trước (Hạn chót chính thức: 16:00 Thứ Sáu, 28/08)*". Tuyệt đối KHÔNG được ghi tắt như "Hạn chót: 16:00" dưới tiêu đề ngày mai, vì sẽ làm người dùng hiểu lầm là hết hạn vào ngày mai!
3. **Cấu trúc báo cáo**:
   - 🌙 **Tổng kết hôm nay**: Số việc hoàn thành / ghi nhận nhanh gọn.
   - ⏳ **Điểm nhìn ngày mai (${tomorrowWeekday}, ${tomorrowDateStr})**: Danh sách việc cần xử lý ngày mai, kèm deadline chính xác tuyệt đối.
   - 📅 **Lưu ý tuần**: 1-2 nhiệm vụ quan trọng sắp tới (ghi rõ ngày giờ hạn chót).
   - 🌿 **Lời chúc buổi tối**: 1 câu ngắn gọn, chúc nghỉ ngơi và tái tạo năng lượng.`;

    try {
      const res = await safeGenerateContent({
        gemini,
        contents: prompt,
      });

      const reportText = res?.text || `🌙 *BÁO CÁO TỔNG KẾT BUỔI TỐI - ${dateStr}*\n\n• Hoàn thành hôm nay: *${completedToday.length} việc*\n• Việc còn tồn: *${allPendingTasks.length} việc*\n\n⏳ *Kế hoạch ngày mai (${tomorrowWeekday}, ${tomorrowDateStr}):*\n${tomorrowTasksText}\n\nChúc Anh/Chị có một buổi tối nghỉ ngơi trọn vẹn!`;

      return {
        type: 'evening',
        title: `🌙 Báo cáo tổng kết tối (${now.toLocaleDateString('vi-VN')})`,
        reportText,
        generatedAt: now.toISOString(),
      };
    } catch (e: any) {
      console.warn('Evening briefing Gemini error, using fallback:', e);
      return {
        type: 'evening',
        title: `🌙 Báo cáo tổng kết tối (${now.toLocaleDateString('vi-VN')})`,
        reportText: `🌙 *BÁO CÁO TỔNG KẾT BUỔI TỐI - ${dateStr}*\n\n• Hoàn thành hôm nay: *${completedToday.length} việc*\n• Việc đang thực hiện: *${allPendingTasks.length} việc*\n\n⏳ *Kế hoạch ngày mai (${tomorrowWeekday}, ${tomorrowDateStr}):*\n${tomorrowTasksText}\n\nChúc Anh/Chị buổi tối an lành!`,
        generatedAt: now.toISOString(),
      };
    }
  }
}

