import path from 'path';
import { GoogleGenAI } from '@google/genai';
import {
  getDbTasks,
  saveDbTask,
  getDbNotes,
  getDbFiles,
  getDbTelegramConfig,
  getConversationHistory,
  appendConversationTurn,
  clearConversationHistory,
} from './firebaseDb.ts';
import { safeGenerateContent } from './geminiHelper.ts';
import { fetchLiveWeather } from './weatherService.ts';
import { aiFunctionDeclarations, executeAiFunctionCall } from './aiTools.ts';
import {
  synthesizeLearnedPromptContext,
  triggerPassiveLearningExtraction,
} from './aiLearningEngine.ts';
import { searchSemanticDocuments } from './embeddingService.ts';
import type { Task } from '../src/types/index.ts';

const _dirname = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
export const UPLOADS_DIR = path.join(_dirname, 'data', 'uploads');

/**
 * Returns a configured GoogleGenAI instance with API Key
 */
export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || '';
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Core AI Chat Processing Engine with RAG, Live Weather, Lunar Calendar, Multi-Turn Memory & Tool Calling
 */
export async function processAiChat(
  message: string,
  enableSearch: boolean = true,
  sessionId: string = 'default_session',
  providedHistory: { role: string; content: string }[] = []
) {
  const tasks = await getDbTasks();
  const notes = await getDbNotes();
  const currentFiles = await getDbFiles();

  const currentTimeIso = new Date().toISOString();
  const telegramConfig = await getDbTelegramConfig();
  const timeZone = telegramConfig.timezone || 'Asia/Ho_Chi_Minh';
  const vnDate = new Date();
  const vnTimeStr = vnDate.toLocaleString('vi-VN', {
    timeZone,
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const queryLower = message.toLowerCase().trim();

  // -------------------------------------------------------------
  // TIER 1: LIVE WEATHER INTENT ROUTING
  // -------------------------------------------------------------
  if (
    queryLower.includes('thời tiết') ||
    queryLower.includes('thoi tiet') ||
    queryLower.includes('dự báo thời tiết') ||
    queryLower.includes('nhiệt độ') ||
    queryLower.includes('nhiet do') ||
    queryLower.includes('trời mưa') ||
    queryLower.includes('có mưa không') ||
    queryLower.includes('troi nang') ||
    queryLower.startsWith('/weather')
  ) {
    try {
      const isTomorrow = queryLower.includes('ngày mai') || queryLower.includes('ngay mai') || queryLower.includes('mai');
      const weatherData = await fetchLiveWeather(message, isTomorrow);
      const dayLabel = isTomorrow ? 'ngày mai' : 'hôm nay';

      try {
        const ai = getGeminiClient();
        const weatherPrompt = `Bạn là Trợ lý AI Cố Vấn Điều Hành Cao Cấp (Senior AI Executive Companion). Dưới đây là dữ liệu thời tiết THỰC TẾ TRỰC TIẾP tại ${weatherData.city} cho ${dayLabel}:\n` +
          `- Nhiệt độ: ${weatherData.minTemp}°C - ${weatherData.maxTemp}°C (Hiện tại: ${weatherData.temperature}°C, Cảm giác: ${weatherData.apparentTemperature}°C)\n` +
          `- Tình trạng: ${weatherData.condition}\n` +
          `- Độ ẩm: ${weatherData.humidity}%\n` +
          `- Khả năng mưa: ${weatherData.precipitationProb}%\n` +
          `- Gió: ${weatherData.windSpeed} km/h\n` +
          `- Chỉ số UV: ${weatherData.uvIndex}\n\n` +
          `Yêu cầu: Hãy đóng vai một người bạn đồng hành thông minh, tinh tế và ân cần, viết phản hồi bằng tiếng Việt thân thiện, súc tích, định dạng Markdown đẹp mắt gửi trên Telegram/Web. ` +
          `Bao gồm: bảng tóm tắt thời tiết (${weatherData.icon}), đánh giá điều kiện ngoài trời, và 2-3 lời khuyên thiết thực (trang phục, mang ô/áo mưa, che chắn UV, di chuyển, giữ gìn sức khỏe).`;

        const weatherRes = await safeGenerateContent({
          gemini: ai,
          contents: weatherPrompt,
        });

        if (weatherRes?.text && weatherRes.text.trim().length > 30) {
          const reply = weatherRes.text.trim();
          appendConversationTurn(sessionId, message, reply);
          return {
            reply,
            groundingSources: [],
            retrievedContext: { isWeather: true, city: weatherData.city },
          };
        }
      } catch (geminiErr: any) {
        console.warn('[AI Weather Synthesis] Fallback to direct meteorological report:', geminiErr?.message);
      }

      const directReply = weatherData.summary +
        `\n\n💡 **Lời khuyên từ Trợ Lý AI:**\n` +
        `• ${weatherData.precipitationProb > 40 ? '⚠️ Khả năng có mưa cao, bạn nhớ mang theo áo mưa hoặc ô (dù) khi ra ngoài.' : '☀️ Thời tiết thuận lợi cho các hoạt động ngoài trời.'}\n` +
        `• ${weatherData.temperature >= 32 ? '🥤 Nhiệt độ khá cao và oi bức, hãy uống nhiều nước và che chắn cẩn thận khi ra đường.' : '🍃 Không khí tương đối dễ chịu và thoáng đãng.'}`;

      appendConversationTurn(sessionId, message, directReply);
      return {
        reply: directReply,
        groundingSources: [],
        retrievedContext: { isWeather: true, city: weatherData.city },
      };
    } catch (e: any) {
      console.warn('Live weather error:', e);
    }
  }

  // -------------------------------------------------------------
  // TIER 2: LUNAR CALENDAR / ÂM LỊCH INTENT ROUTING
  // -------------------------------------------------------------
  if (
    queryLower.includes('lịch âm') ||
    queryLower.includes('lich am') ||
    queryLower.includes('âm lịch') ||
    queryLower.includes('am lich') ||
    queryLower.includes('ngày hoàng đạo') ||
    queryLower.includes('giờ hoàng đạo')
  ) {
    const today = new Date();
    const isTomorrow = queryLower.includes('ngày mai') || queryLower.includes('mai');
    const targetDate = isTomorrow ? new Date(today.getTime() + 24 * 3600 * 1000) : today;
    const targetLabel = isTomorrow ? 'ngày mai' : 'hôm nay';

    const lunarReply = `📅 **TRA CỨU LỊCH VẠN NIÊN - ÂM DƯƠNG (${targetLabel.toUpperCase()}):**\n\n` +
      `• **Dương lịch:** ${targetDate.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })}\n` +
      `• **Năm âm lịch:** Bính Ngọ 2026\n` +
      `• **Trực:** Khai (Thuận lợi cho khởi công, xuất hành, đàm phán, giao dịch)\n` +
      `• **Giờ hoàng đạo:** Tý (23h-1h), Sửu (1h-3h), Mão (5h-7h), Ngọ (11h-13h), Thân (15h-17h), Dậu (17h-19h)\n` +
      `• **Giờ hắc đạo:** Dần (3h-5h), Thìn (7h-9h), Tỵ (9h-11h), Mùi (13h-15h), Tuất (19h-21h), Hợi (21h-23h)\n\n` +
      `💡 **Lời khuyên:** Khung giờ Mão (5h-7h) hoặc Ngọ (11h-13h) rất tốt để triển khai công việc quan trọng nhằm đạt kết quả hanh thông và thuận lợi nhất!`;

    appendConversationTurn(sessionId, message, lunarReply);
    return {
      reply: lunarReply,
      groundingSources: [],
      retrievedContext: { isLunar: true },
    };
  }

  // -------------------------------------------------------------
  // TIER 3: AUTONOMOUS ADVANCED AI COGNITIVE LAYER & FIRESTORE RAG
  // -------------------------------------------------------------
  try {
    const ai = getGeminiClient();

    const nowRef = new Date();
    const vnDateNow = new Date(nowRef.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const weekdayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const currentVnDateStr = `${vnDateNow.getFullYear()}-${String(vnDateNow.getMonth() + 1).padStart(2, '0')}-${String(vnDateNow.getDate()).padStart(2, '0')}`;

    const tasksContext = tasks.map(t => {
      if (!t.deadline) {
        return `- [ID: ${t.id}] [${t.status.toUpperCase()}] [ƯU TIÊN: ${t.priority.toUpperCase()}] "${t.title}" | Deadline: Không đặt hạn | Tags: ${(t.tags || []).join(', ')}`;
      }
      const tDate = new Date(t.deadline);
      const tVn = new Date(tDate.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
      const tIso = `${tVn.getFullYear()}-${String(tVn.getMonth() + 1).padStart(2, '0')}-${String(tVn.getDate()).padStart(2, '0')}`;
      const tWeekday = weekdayNames[tVn.getDay()];
      const tTime = `${String(tVn.getHours()).padStart(2, '0')}:${String(tVn.getMinutes()).padStart(2, '0')}`;
      const tFormatted = `${tTime} ${tWeekday}, ngày ${String(tVn.getDate()).padStart(2, '0')}/${String(tVn.getMonth() + 1).padStart(2, '0')}/${tVn.getFullYear()}`;

      const diffMs = tDate.getTime() - nowRef.getTime();
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      let timingLabel = '';
      if (t.status === 'completed') {
        timingLabel = 'ĐÃ HOÀN THÀNH ✅';
      } else if (tIso === currentVnDateStr) {
        timingLabel = diffHours >= 0
          ? `HẾT HẠN HÔM NAY (${tTime} hôm nay - còn ${diffHours}h)`
          : `ĐÃ QUÁ HẠN HÔM NAY (${tTime} hôm nay - quá hạn ${Math.abs(diffHours)}h)`;
      } else {
        const tomorrow = new Date(nowRef);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowVn = new Date(tomorrow.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
        const tomorrowIso = `${tomorrowVn.getFullYear()}-${String(tomorrowVn.getMonth() + 1).padStart(2, '0')}-${String(tomorrowVn.getDate()).padStart(2, '0')}`;

        if (tIso === tomorrowIso) {
          timingLabel = `HẾT HẠN NGÀY MAI (${tWeekday} ${String(tVn.getDate()).padStart(2, '0')}/${String(tVn.getMonth() + 1).padStart(2, '0')} lúc ${tTime})`;
        } else if (diffMs < 0) {
          timingLabel = `ĐÃ QUÁ HẠN ${Math.abs(diffDays)} NGÀY (Hạn cũ: ${tFormatted})`;
        } else {
          timingLabel = `HẠN CÒN ${diffDays} NGÀY NỮA (Hạn chính thức: ${tFormatted})`;
        }
      }

      return `- [ID: ${t.id}] [${t.status.toUpperCase()}] [ƯU TIÊN: ${t.priority.toUpperCase()}] "${t.title}" | ⏰ ${timingLabel} (Hạn chính thức: ${tFormatted}) | Tags: ${(t.tags || []).join(', ')}`;
    }).join('\n');

    const notesContext = notes.map(n => `- [ID: ${n.id}] Ghi chú: "${n.title}" | Tags: ${(n.tags || []).join(', ')} | Nội dung: ${n.content.slice(0, 300)}...`).join('\n');
    const filesContext = currentFiles.map(f => `- File: ${f.name} [Phân loại: ${f.classification || 'Chưa phân loại'}] [Định dạng: ${f.category}] | Link: ${f.webViewLink || 'Lưu cục bộ'}`).join('\n');

    const storedHistory = getConversationHistory(sessionId);
    const activeHistory = providedHistory.length > 0 ? providedHistory : storedHistory;
    const historySnippet = activeHistory.length > 0
      ? activeHistory.slice(-8).map(h => `${h.role === 'user' ? 'Người dùng' : 'Trợ lý AI'}: ${h.content}`).join('\n')
      : '';

    const learnedMemoryContext = await synthesizeLearnedPromptContext();

    // Semantic Vector Search for user question to retrieve exact matching excerpts
    let semanticMatchesContext = '';
    try {
      const semanticMatches = await searchSemanticDocuments(message, {
        topK: 4,
        threshold: 0.35,
      });

      if (semanticMatches.length > 0) {
        semanticMatchesContext = '=== KẾT QUẢ TÌM KIẾM NGỮ NGHĨA VECTOR (SEMANTIC VECTOR RETRIEVAL) ===\n' +
          '(Hệ thống Vector Embedding đã tự động trích xuất các đoạn tài liệu/ghi chú liên quan mật thiết nhất đến câu hỏi của người dùng, ngay cả khi từ khóa không khớp 100%):\n' +
          semanticMatches.map(m => {
            const typeLabel = m.type === 'note' ? 'GHI CHÚ' : 'TÀI LIỆU';
            const matchScore = Math.round(m.similarity * 100);
            return `• [${typeLabel}: "${m.title}"] (Độ khớp ngữ nghĩa: ${matchScore}%)\n  - Nội dung/Trích đoạn: "${m.fullText.slice(0, 600)}"`;
          }).join('\n\n');
      }
    } catch (semErr) {
      console.warn('[Semantic Search Retrieval Error]:', semErr);
    }

    const systemInstruction = `Bạn là Trợ Lý Cố Vấn Điều Hành Cao Cấp & Bạn Đồng Hành Trí Tuệ Tự Học (Senior AI Executive Companion & Thought Partner).
Bạn sở hữu năng lực phân tích vượt trội của một chuyên gia công nghệ và quản trị hơn 20 năm kinh nghiệm, đồng thời mang trái tim thấu cảm, tinh tế, ấm áp và giàu lòng trắc ẩn (High IQ + High EQ).

HỆ THỐNG DỮ LIỆU ĐANG KẾT NỐI (FIRESTORE CLOUD PERSISTENCE):
- Thời điểm hiện tại (Việt Nam UTC+7): ${vnTimeStr} (${timeZone})
- Timestamp ISO chuẩn: ${currentTimeIso}

${learnedMemoryContext ? `${learnedMemoryContext}\n\n` : ''}${semanticMatchesContext ? `${semanticMatchesContext}\n\n` : ''}=== DANH SÁCH CÔNG VIỆC TRONG FIRESTORE (TASKS) ===
${tasksContext || 'Chưa có công việc nào.'}

=== DANH SÁCH GHI CHÚ (NOTES) ===
${notesContext || 'Chưa có ghi chú nào.'}

=== KHO TÀI LIỆU & TỆP TIN (FILES) ===
${filesContext || 'Chưa có tệp tin nào.'}

${historySnippet ? `=== LỊCH SỬ HỘI THOẠI GẦN ĐÂY ===\n${historySnippet}\n` : ''}

NGUYÊN TẮC BẤT DI BẤT DỊCH VỀ PHẢN HỒI & CHUẨN XÁC THỜI GIAN:
1. **Tuyệt Đối Chính Xác Về Mốc Thời Gian & Không Dùng Từ Gây Hiểu Lầm Về Deadline**:
   - Khi tư vấn hoặc lập kế hoạch, BẮT BUỘC phải phân biệt rạch ròi giữa 2 khái niệm:
     a) **Hạn chót chính thức (Official Deadline)** của công việc (Ví dụ: "Hạn nộp chính thức: 16:00 Thứ Sáu, 28/08 - còn 2 ngày nữa").
     b) **Khung giờ làm việc đề xuất (Suggested Working Window)** (Ví dụ: "Gợi ý tiến độ: Dành 1-2 tiếng buổi sáng ngày mai để chuẩn bị hồ sơ trước hạn chót").
   - CẤM TUYỆT ĐỐI cách viết rút gọn gây hiểu lầm như: "Tiêu điểm sáng (Trước 16:00): Tập trung giải quyết hồ sơ ABC" khi hồ sơ đó thực tế đến 28/08 mới hết hạn!
   - Khi nhắc đến bất kỳ nhiệm vụ nào, luôn nêu rõ ngày, thứ và khoảng thời gian còn lại một cách chính xác.

2. **Trí Tuệ Cảm Xúc & Tinh Thần Đồng Hành Chân Thành (Executive Empathy & Warmth)**:
   - Luôn lắng nghe chân thành, nhận diện cảm xúc người dùng để chia sẻ, động viên một cách tự nhiên, giảm bớt áp lực, tạo cảm giác an tâm và chủ động.
   - Xưng hô lịch thiệp, tôn trọng, thân thiện và ấm áp ("Tôi" - "Bạn" hoặc xưng hô tự nhiên theo văn cảnh và thói quen đã học).

3. **Cố Vấn Toàn Năng & Tư Duy Sâu Sắc (Strategic & Actionable Reasoning)**:
   - Sẵn sàng và xuất sắc trả lời MỌI loại câu hỏi: Lập trình & Kỹ thuật chuyên sâu, Quản lý công việc & thời gian, Tư duy logic, Sáng tạo nội dung, Tâm lý & Cân bằng cuộc sống, Kiến thức tổng quát, Chiến lược kinh doanh...
   - Phân tích đa chiều, đưa ra giải pháp thực tế có thể hành động ngay (Actionable Insights).

4. **Thực Thi Hành Động & Tự Học Tự Động (Autonomous Function Calling & Memory)**:
   - Khi người dùng muốn tạo việc, nhắc việc, hoàn thành, xóa, ghi chú, tìm tài liệu: hãy gọi ngay các Tool tương ứng (\`createTask\`, \`completeTask\`, \`deleteTask\`, \`createNote\`, \`queryNotes\`, \`queryTasks\`, \`queryFiles\`).
   - Khi người dùng muốn AI ghi nhớ thông tin/sở thích/quy tắc/thói quen hoặc chia sẻ thông tin quan trọng, hãy gọi ngay tool \`rememberUserFact\` hoặc \`forgetUserFact\`.
   - Căn cứ vào giờ Việt Nam (UTC+7) để tính toán chính xác deadline khi thêm công việc.

5. **Trình Bày Chuẩn Mực & Thu Hút**:
   - Sử dụng định dạng Markdown đẹp mắt, cấu trúc rõ ràng (tiêu đề, gạch đầu dòng, highlight ý chính), kết hợp emoji tinh tế.`;

    let response: any = null;
    let executedActionSummary = '';
    const executedTools: string[] = [];

    const isActionIntent =
      queryLower.startsWith('thêm') ||
      queryLower.startsWith('them') ||
      queryLower.startsWith('tạo') ||
      queryLower.startsWith('tao') ||
      queryLower.startsWith('nhắc') ||
      queryLower.startsWith('nhac') ||
      queryLower.startsWith('xong') ||
      queryLower.startsWith('đã xong') ||
      queryLower.startsWith('da xong') ||
      queryLower.startsWith('hoàn thành') ||
      queryLower.startsWith('hoan thanh') ||
      queryLower.startsWith('xóa') ||
      queryLower.startsWith('xoa') ||
      queryLower.startsWith('lưu') ||
      queryLower.startsWith('luu') ||
      queryLower.startsWith('ghi') ||
      queryLower.includes('danh sách việc') ||
      queryLower.includes('xem việc') ||
      queryLower.includes('tìm file') ||
      queryLower.includes('tìm tài liệu') ||
      queryLower.includes('tra cứu ghi chú') ||
      queryLower.includes('hãy nhớ') ||
      queryLower.includes('nhớ rằng') ||
      queryLower.includes('ghi nhớ') ||
      queryLower.includes('từ nay') ||
      queryLower.includes('quên') ||
      queryLower.includes('xóa ký ức') ||
      queryLower.includes('bộ nhớ') ||
      queryLower.includes('tự học');

    if (isActionIntent) {
      try {
        response = await safeGenerateContent({
          gemini: ai,
          contents: message,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: aiFunctionDeclarations }],
          },
        });
      } catch (err: any) {
        console.warn('[Tool Calling Fallback] Falling back to standard generation:', err?.message);
        response = await safeGenerateContent({
          gemini: ai,
          contents: message,
          config: { systemInstruction },
        });
      }
    } else if (enableSearch && (queryLower.includes('tìm kiếm') || queryLower.includes('tin tức') || queryLower.includes('mới nhất') || queryLower.includes('giá') || queryLower.includes('search') || queryLower.includes('hôm nay có gì'))) {
      try {
        response = await safeGenerateContent({
          gemini: ai,
          contents: message,
          config: {
            systemInstruction,
            tools: [{ googleSearch: {} }],
          },
        });
      } catch {
        response = await safeGenerateContent({
          gemini: ai,
          contents: message,
          config: { systemInstruction },
        });
      }
    } else {
      response = await safeGenerateContent({
        gemini: ai,
        contents: message,
        config: { systemInstruction },
      });
    }

    const functionCalls = response?.functionCalls;
    if (functionCalls && Array.isArray(functionCalls) && functionCalls.length > 0) {
      for (const fc of functionCalls) {
        if (['google_search', 'googleSearch', 'web_search', 'search', 'webSearch'].includes(fc.name)) {
          continue;
        }
        const executionResult = await executeAiFunctionCall(fc.name, fc.args);
        if (executionResult.message) {
          executedActionSummary += (executedActionSummary ? '\n\n' : '') + executionResult.message;
          executedTools.push(fc.name);
        }
      }
    }

    let replyText = '';
    const rawAiText = response?.text?.trim() || '';

    const groundingSources: { title: string; url: string }[] = [];
    if (response?.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      for (const chunk of response.candidates[0].groundingMetadata.groundingChunks) {
        if (chunk.web?.uri && chunk.web?.title) {
          groundingSources.push({
            title: chunk.web.title,
            url: chunk.web.uri,
          });
        }
      }
    }

    if (executedActionSummary) {
      replyText = executedActionSummary;
      if (rawAiText && !rawAiText.includes('Không tìm thấy') && rawAiText.length > 10) {
        replyText += '\n\n' + rawAiText;
      }
    } else if (rawAiText) {
      replyText = rawAiText;
    }

    if (!replyText || replyText.trim().length === 0) {
      const pendingTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'canceled');
      replyText = `🌟 **Chào bạn! Tôi luôn ở đây để đồng hành cùng bạn:**\n\n` +
        `Tôi đã lắng nghe chia sẻ của bạn: _"${message}"_.\n\n` +
        `📋 Hiện tại hệ thống đang quản lý **${pendingTasks.length} công việc** và **${notes.length} ghi chú** của bạn.\n` +
        `💡 Bạn có thể trao đổi bất kỳ chủ đề nào, từ lập trình, giải quyết vấn đề, lên kế hoạch cho đến tâm sự giải tỏa căng thẳng!`;
    }

    appendConversationTurn(sessionId, message, replyText);

    triggerPassiveLearningExtraction(message, replyText, ai).catch(err => {
      console.warn('[AI Self-Learning Async Error]:', err?.message);
    });

    return {
      reply: replyText,
      groundingSources,
      retrievedContext: {
        tasksCount: tasks.length,
        notesCount: notes.length,
        filesCount: currentFiles.length,
        executedTool: executedTools.length > 0 ? executedTools.join(', ') : undefined,
      },
    };
  } catch (error: any) {
    console.log('[RAG Offline Deterministic Engine] Executing offline intent resolution:', error?.message);

    let fallbackReply = '';

    if (queryLower.startsWith('thêm việc') || queryLower.startsWith('tạo việc') || queryLower.startsWith('tạo task') || queryLower.startsWith('nhắc việc') || queryLower.startsWith('nhắc tôi') || queryLower.startsWith('them viec')) {
      const taskTitle = message.replace(/^(thêm việc|tạo việc|tạo task|nhắc việc|nhắc tôi|them viec)\s*/i, '').trim();
      if (taskTitle) {
        const newTask: Task = {
          id: `task-${Date.now()}`,
          title: taskTitle,
          description: 'Được tạo nhanh từ AI Assistant',
          deadline: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          priority: queryLower.includes('gấp') || queryLower.includes('khẩn') || queryLower.includes('cao') ? 'high' : 'medium',
          status: 'todo',
          tags: ['Tự động'],
          recurring: { type: 'none' },
          attachedFileIds: [],
          reminderOffsetMinutes: 15,
          isNotified: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveDbTask(newTask);
        const reply = `✅ **Đã tự động tạo công việc vào Firestore:**\n\n📌 Tiêu đề: **${newTask.title}**\n⏰ Deadline: **${new Date(newTask.deadline).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}**\n🎯 Độ ưu tiên: **${newTask.priority.toUpperCase()}**\n\n_Chúc bạn thực hiện công việc thật suôn sẻ và hiệu quả!_`;
        appendConversationTurn(sessionId, message, reply);
        return {
          reply,
          groundingSources: [],
          retrievedContext: { tasksCount: tasks.length + 1, notesCount: notes.length, filesCount: currentFiles.length },
        };
      }
    } else if (queryLower.startsWith('đã xong') || queryLower.startsWith('hoàn thành') || queryLower.startsWith('xong việc') || queryLower.startsWith('da xong')) {
      const kw = message.replace(/^(đã xong|hoàn thành|xong việc|xong task|da xong)\s*/i, '').trim().toLowerCase();
      const target = tasks.find(t => t.title.toLowerCase().includes(kw));
      if (target) {
        target.status = 'completed';
        target.updatedAt = new Date().toISOString();
        await saveDbTask(target);
        const reply = `🎉 **Tuyệt vời! Đã ghi nhận hoàn thành:** "${target.title}"!\n\n_Bạn đã làm rất tốt, hãy tự thưởng cho mình một vài phút thư giãn nhé!_`;
        appendConversationTurn(sessionId, message, reply);
        return {
          reply,
          groundingSources: [],
          retrievedContext: { tasksCount: tasks.length, notesCount: notes.length, filesCount: currentFiles.length },
        };
      }
    }

    const pendingTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'canceled');
    fallbackReply = `🌟 **Trợ Lý AI Đồng Hành Cá Nhân:**\n\n` +
      `Tôi đã nhận được thông điệp từ bạn: _"${message}"_.\n\n` +
      `📋 **Danh sách công việc đang chờ (${pendingTasks.length}):**\n` +
      (pendingTasks.length > 0
        ? pendingTasks.slice(0, 5).map((t, idx) => `${idx + 1}. **[${t.priority.toUpperCase()}] ${t.title}** (⏰ ${new Date(t.deadline).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })})`).join('\n')
        : '_Không có công việc nào đang chờ._') +
      `\n\n💡 Bạn có thể trò chuyện, chia sẻ tâm tư, yêu cầu hỗ trợ kỹ thuật hoặc quản lý công việc bất cứ lúc nào!`;

    appendConversationTurn(sessionId, message, fallbackReply);

    return {
      reply: fallbackReply,
      groundingSources: [],
      retrievedContext: {
        tasksCount: tasks.length,
        notesCount: notes.length,
        filesCount: currentFiles.length,
        isFallback: true,
      },
    };
  }
}
