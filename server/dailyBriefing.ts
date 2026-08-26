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
 * Generates an executive, highly humanized, empathetic AI Morning or Evening briefing
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
  
  // Format today's date in Vietnam timezone (YYYY-MM-DD)
  const vnFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayIso = vnFormatter.format(now); // e.g. "2026-08-25" in Vietnam

  const todayTasks = tasks.filter(t => {
    if (!t.deadline) return false;
    const taskVnDate = vnFormatter.format(new Date(t.deadline));
    return taskVnDate === todayIso;
  });
  const completedToday = tasks.filter(t => t.status === 'completed');
  const pendingTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'canceled');
  const highPriority = pendingTasks.filter(t => t.priority === 'high');

  const tasksSummary = tasks.map(t => `- [${t.status.toUpperCase()}] [${t.priority.toUpperCase()}] "${t.title}" (Hạn: ${new Date(t.deadline).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })})`).join('\n');

  if (type === 'morning') {
    const prompt = `Bạn là Trợ Lý Cố Vấn Điều Hành Cao Cấp (Senior AI Executive Companion & Thought Partner) của tôi, kết hợp giữa năng lực phân tích xuất sắc và sự thấu cảm, ấm áp, nhân văn.

Hãy soạn một bản tin "🌅 BẢN TIN ĐIỂM HẸN BUỔI SÁNG (MORNING BRIEFING)" gửi lên Telegram cá nhân.

THÔNG TIN HÔM NAY:
- Ngày: ${dateStr}
- Tổng số việc cần làm hôm nay: ${todayTasks.length}
- Việc ưu tiên cao: ${highPriority.length}
- Danh sách công việc hiện có trong Firestore:
${tasksSummary || 'Chưa có công việc nào trong hệ thống.'}

TIÊU CHUẨN NỘI DUNG & NHÂN TÍNH HÓA (Format Markdown cho Telegram):
1. 🌅 **LỜI CHÀO NGÀY MỚI TRUYỀN CẢM HỨNG**: Tươi sáng, chân thành, tiếp thêm động lực tích cực.
2. 🎯 **TIÊU ĐIỂM CÔNG VIỆC TRỌNG TÂM**: Nhấn mạnh 1-3 việc khẩn cấp nhất, gợi ý chiến lược giải quyết thông minh (chia nhỏ việc, khung giờ vàng tập trung).
3. 🌤️ **NHỊP SỐNG & SỨC KHỎE**: Lời nhắc nhẹ nhàng về uống nước, khởi động buổi sáng hoặc giữ tâm thế thoải mái.
4. 💡 **GÓC SUY NGẪM / PRODUCTIVITY TIP**: 1 triết lý ngắn gọn, sâu sắc về năng suất hoặc tư duy làm việc thông minh.

Viết bằng tiếng Việt tinh tế, tự nhiên, truyền cảm hứng, dùng emoji sinh động và chuẩn Markdown.`;

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

      const reportText = res?.text || `🌅 *BẢN TIN ĐIỂM HẸN BUỔI SÁNG*\n\nChào ngày mới ${dateStr}!\n\n📋 *Hôm nay bạn có ${todayTasks.length} công việc cần xử lý.*\nChúc bạn một ngày làm việc hiệu quả và tràn đầy năng lượng!`;

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
        reportText: `🌅 *BẢN TIN ĐIỂM HẸN BUỔI SÁNG - ${dateStr}*\n\nChào bạn một ngày mới an lành và tràn đầy nhiệt huyết!\n\n🎯 *Tiêu điểm hôm nay:* Bạn có *${todayTasks.length} công việc* và *${highPriority.length} việc ưu tiên cao* đang chờ xử lý.\n\n✨ *Lời khuyên hiệu suất:* Hãy bắt đầu ngày mới bằng việc quan trọng nhất để làm chủ toàn bộ thời gian còn lại!`,
        generatedAt: now.toISOString(),
      };
    }
  } else {
    // Evening Briefing
    const prompt = `Bạn là Trợ Lý Cố Vấn Điều Hành Cao Cấp (Senior AI Executive Companion & Thought Partner) của tôi, thấu hiểu, ân cần và sâu sắc.

Hãy soạn một bản "🌙 BÁO CÁO TỔNG KẾT NGÀY & KẾ HOẠCH NGÀY MAI (EVENING BRIEFING)" gửi lên Telegram.

THÔNG TIN TỔNG KẾT HÔM NAY (${dateStr}):
- Số việc đã hoàn thành: ${completedToday.length}
- Số việc còn tồn đọng: ${pendingTasks.length}
- Danh sách công việc:
${tasksSummary || 'Không có việc nào'}

TIÊU CHUẨN NỘI DUNG & NHÂN TÍNH HÓA (Format Markdown cho Telegram):
1. 🌙 **LỜI CHÀO BUỔI TỐI ẤM ÁP & THẤU HIỂU**: Ghi nhận một ngày nỗ lực của người dùng.
2. 🏆 **VINH DANH NHỮNG TIẾN TRÌNH ĐÃ ĐẠT ĐƯỢC**: Khen ngợi cụ thể các công việc đã hoàn thành hoặc nỗ lực giải quyết vấn đề.
3. ⏳ **ĐIỂM NHÌN NGÀY MAI**: 1-2 lưu ý ngắn gọn để mai bước vào công việc một cách thảnh thơi, không âu lo.
4. 🌿 **LỜI NHẮC NGHỈ NGƠI & TÁI TẠO NĂNG LƯỢNG**: Động viên rời xa màn hình, thư giãn tâm trí để có giấc ngủ sâu trọn vẹn.

Viết bằng tiếng Việt ấm áp, lịch thiệp, nhiều cảm xúc nhân văn, định dạng Markdown bắt mắt.`;

    try {
      const res = await safeGenerateContent({
        gemini,
        contents: prompt,
      });

      const reportText = res?.text || `🌙 *BÁO CÁO TỔNG KẾT BUỔI TỐI*\n\n${dateStr}\n\n🏆 Bạn đã hoàn thành ${completedToday.length} công việc hôm nay!\nChúc bạn có một buổi tối thư giãn và ngon giấc!`;

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
        reportText: `🌙 *BÁO CÁO TỔNG KẾT BUỔI TỐI - ${dateStr}*\n\n🏆 *Thành quả hôm nay:* Bạn đã hoàn thành xuất sắc *${completedToday.length} công việc*!\n⏳ Còn *${pendingTasks.length} công việc* đã được lưu trữ ngăn nắp để bạn tiếp tục vào ngày mai.\n\n🌿 *Thư giãn tâm trí:* Hãy gác lại mọi âu lo, chúc bạn có một buổi tối bình yên và một giấc ngủ thật sâu!`,
        generatedAt: now.toISOString(),
      };
    }
  }
}
