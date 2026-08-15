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
 * Generates an executive AI Morning or Evening briefing
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
  const todayIso = now.toISOString().split('T')[0];

  const todayTasks = tasks.filter(t => t.deadline.startsWith(todayIso));
  const completedToday = tasks.filter(t => t.status === 'completed');
  const pendingTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'canceled');
  const highPriority = pendingTasks.filter(t => t.priority === 'high');

  const tasksSummary = tasks.map(t => `- [${t.status.toUpperCase()}] [${t.priority.toUpperCase()}] "${t.title}" (Hạn: ${new Date(t.deadline).toLocaleTimeString('vi-VN')})`).join('\n');

  if (type === 'morning') {
    const prompt = `Bạn là Senior AI Executive Assistant của tôi. Hãy soạn một bản tin "🌅 BẢN TIN ĐIỂM HẸN BUỔI SÁNG (MORNING BRIEFING)" thật chuyên nghiệp, truyền cảm hứng và súc tích để gửi lên Telegram cá nhân.

THÔNG TIN HÔM NAY:
- Ngày: ${dateStr}
- Tổng số việc cần làm hôm nay: ${todayTasks.length}
- Việc ưu tiên cao: ${highPriority.length}
- Danh sách công việc hiện có trong Firestore:
${tasksSummary || 'Chưa có công việc nào trong hệ thống.'}

YÊU CẦU ĐỊNH DẠNG (Bắt buộc dùng Markdown đẹp cho Telegram):
1. 🌅 **TIÊU ĐỀ BUỔI SÁNG & LỜI CHÚC TRÀN ĐẦY NĂNG LƯỢNG**
2. 🌤️ **DỰ BÁO THỜI TIẾT & NHỊP SỐNG**: Ngắn gọn (1-2 câu).
3. 🎯 **TIÊU ĐIỂM CÔNG VIỆC QUAN TRỌNG HÔM NAY**: Liệt kê các deadline khẩn cấp cần ưu tiên giải quyết trước.
4. 💡 **LỜI KHUYÊN HIỆU SUẤT TRONG NGÀY (PRODUCTIVITY TIP)**: 1 câu triết lý hoặc mẹo tập trung sâu.

Viết bằng tiếng Việt, dùng emoji sinh động, định dạng Markdown rõ ràng.`;

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
        reportText: `🌅 *BẢN TIN ĐIỂM HẸN BUỔI SÁNG - ${dateStr}*\n\n🎯 *Tiêu điểm hôm nay:* Bạn có *${todayTasks.length} công việc* và *${highPriority.length} việc ưu tiên cao* đang chờ xử lý.\n\n✨ *Mẹo nhỏ:* Hãy bắt đầu ngày mới bằng việc khó nhất để tối đa hóa hiệu suất!`,
        generatedAt: now.toISOString(),
      };
    }
  } else {
    // Evening Briefing
    const prompt = `Bạn là Senior AI Executive Assistant của tôi. Hãy soạn một bản "🌙 BÁO CÁO TỔNG KẾT NGÀY & KẾ HOẠCH NGÀY MAI (EVENING BRIEFING)" gửi lên Telegram.

THÔNG TIN TỔNG KẾT HÔM NAY (${dateStr}):
- Số việc đã hoàn thành: ${completedToday.length}
- Số việc còn tồn đọng: ${pendingTasks.length}
- Danh sách công việc:
${tasksSummary || 'Không có việc nào'}

YÊU CẦU ĐỊNH DẠNG (Markdown Telegram):
1. 🌙 **LỜI CHÀO BUỔI TỐI & TỔNG KẾT NHANH**
2. 🏆 **THÀNH QUẢ ĐÃ ĐẠT ĐƯỢC HÔM NAY**: Khen ngợi và tóm tắt việc đã làm xong.
3. ⏳ **VIỆC CẦN LƯU Ý CHO NGÀY MAI**: 1-2 gạch đầu dòng chuẩn bị.
4. 🧘 **LỜI NHẮC NGHỈ NGƠI & TÁI TẠO NĂNG LƯỢNG**.

Viết ngắn gọn, chuyên nghiệp, tiếng Việt lịch thiệp, nhiều emoji ấm áp.`;

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
        reportText: `🌙 *BÁO CÁO TỔNG KẾT BUỔI TỐI - ${dateStr}*\n\n🏆 *Thành quả:* Hôm nay bạn đã giải quyết được *${completedToday.length} công việc*!\n⏳ Còn *${pendingTasks.length} công việc* sẽ tiếp tục xử lý ngày mai.\n\n✨ Chúc bạn có một giấc ngủ thật ngon để nạp năng lượng!`,
        generatedAt: now.toISOString(),
      };
    }
  }
}
