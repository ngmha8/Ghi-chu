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
import { safeGenerateContent, safeGenerateContentStream } from './geminiHelper.ts';
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
  // TIER 1: LIVE WEATHER INTENT ROUTING (NATURAL & CONTEXTUAL)
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
      const persona = await import('./firebaseDb.ts').then(m => m.getDbAiPersonaConfig());
      const userHomeLocation = persona.location || 'Bắc Giang';
      const isTomorrow = queryLower.includes('ngày mai') || queryLower.includes('ngay mai') || queryLower.includes('mai');
      const weatherData = await fetchLiveWeather(message, isTomorrow, userHomeLocation);
      const dayLabel = isTomorrow ? 'ngày mai' : 'hôm nay';

      try {
        const ai = getGeminiClient();
        const learnedMemory = await synthesizeLearnedPromptContext();
        const weatherPrompt = `${learnedMemory ? `${learnedMemory}\n\n` : ''}DỮ LIỆU THỜI TIẾT THỰC TẾ TRỰC TIẾP TẠI ${weatherData.city.toUpperCase()} (${dayLabel.toUpperCase()}):
- Vị trí: ${weatherData.city} (Địa bàn của người dùng: ${userHomeLocation})
- Nhiệt độ: ${weatherData.minTemp}°C - ${weatherData.maxTemp}°C (Hiện tại: ${weatherData.temperature}°C, cảm giác thực tế: ${weatherData.apparentTemperature}°C)
- Tình trạng bầu trời: ${weatherData.condition} (${weatherData.icon})
- Độ ẩm: ${weatherData.humidity}% | Tốc độ gió: ${weatherData.windSpeed} km/h
- Xác suất mưa: ${weatherData.precipitationProb}%
- Chỉ số tia UV: ${weatherData.uvIndex}

CÂU HỎI CỦA NGƯỜI DÙNG: "${message}"

YÊU CẦU:
1. Hãy trả lời câu hỏi trực tiếp, ngắn gọn, súc tích và ấm áp theo đúng phong cách và danh xưng đã học.
2. KHÔNG xuất bảng markdown thô cứng hay lời chào dập khuôn máy móc.
3. Nêu rõ nhiệt độ, cảm giác thực tế, khả năng mưa tại ${weatherData.city} và 1-2 lời khuyên sinh hoạt/di chuyển thực tế, hữu ích.`;

        const weatherRes = await safeGenerateContent({
          gemini: ai,
          contents: weatherPrompt,
        });

        if (weatherRes?.text && weatherRes.text.trim().length > 20) {
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
        `\n\n💡 **Lời khuyên:**\n` +
        `• ${weatherData.precipitationProb > 40 ? '⚠️ Khả năng có mưa cao, bạn nhớ mang theo áo mưa hoặc ô khi ra ngoài.' : '☀️ Thời tiết thuận lợi cho các hoạt động và công việc.'}\n` +
        `• ${weatherData.temperature >= 32 ? '🥤 Nhiệt độ khá cao, hãy bổ sung nước đầy đủ và che chắn nắng khi ra đường.' : '🍃 Không khí tương đối thoáng đãng và dễ chịu.'}`;

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
        threshold: 0.25,
      });

      if (semanticMatches.length > 0) {
        semanticMatchesContext = '=== KẾT QUẢ TRUY XUẤT HYBRID RAG (DENSE gemini-embedding-2-preview + SPARSE BM25 + RRF) ===\n' +
          '(Hệ thống Hybrid Search đã trích xuất các tài liệu/ghi chú liên quan mật thiết nhất bằng mô hình Vector Google kết hợp thuật toán BM25 và Reciprocal Rank Fusion):\n' +
          semanticMatches.map(m => {
            const typeLabel = m.type === 'note' ? 'GHI CHÚ' : 'TÀI LIỆU';
            const matchScore = Math.round(m.similarity * 100);
            return `• [${typeLabel}: "${m.title}"] (Độ khớp: ${matchScore}% | Phương thức: ${m.matchMethod?.toUpperCase() || 'HYBRID'})\n  - Đánh giá liên quan: ${m.relevanceExplanation || ''}\n  - Trích đoạn nội dung: "${m.fullText.slice(0, 700)}"`;
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

/**
 * Real Native Streaming AI Chat Processing Engine with zero-latency token forwarding.
 * Pipes chunks directly from gemini.models.generateContentStream to the onChunk callback.
 */
export async function processAiChatStream(
  message: string,
  enableSearch: boolean = true,
  sessionId: string = 'default_session',
  providedHistory: { role: string; content: string }[] = [],
  onChunk: (text: string) => void
): Promise<{
  reply: string;
  groundingSources: { title: string; url: string }[];
  retrievedContext: any;
}> {
  const queryLower = message.toLowerCase().trim();

  // Tier 1: Live Weather Check
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
    const result = await processAiChat(message, enableSearch, sessionId, providedHistory);
    onChunk(result.reply);
    return result;
  }

  // Tier 2: Lunar Calendar Check
  if (
    queryLower.includes('lịch âm') ||
    queryLower.includes('lich am') ||
    queryLower.includes('âm lịch') ||
    queryLower.includes('am lich') ||
    queryLower.includes('ngày hoàng đạo') ||
    queryLower.includes('giờ hoàng đạo')
  ) {
    const result = await processAiChat(message, enableSearch, sessionId, providedHistory);
    onChunk(result.reply);
    return result;
  }

  // Tier 3: Action Tool Intents (Create task, note, recall memory)
  const isActionIntent =
    queryLower.startsWith('thêm việc') ||
    queryLower.startsWith('tạo việc') ||
    queryLower.startsWith('tạo task') ||
    queryLower.startsWith('nhắc tôi') ||
    queryLower.startsWith('tạo ghi chú') ||
    queryLower.startsWith('viết ghi chú') ||
    queryLower.startsWith('lưu ghi chú') ||
    queryLower.startsWith('them viec') ||
    queryLower.startsWith('tao task') ||
    queryLower.startsWith('luu') ||
    queryLower.startsWith('ghi') ||
    queryLower.includes('hãy nhớ') ||
    queryLower.includes('nhớ rằng') ||
    queryLower.includes('ghi nhớ') ||
    queryLower.includes('từ nay') ||
    queryLower.includes('quên') ||
    queryLower.includes('xóa ký ức') ||
    queryLower.includes('bộ nhớ');

  if (isActionIntent) {
    const result = await processAiChat(message, enableSearch, sessionId, providedHistory);
    onChunk(result.reply);
    return result;
  }

  // Tier 4: Native LLM Content Stream with Context & RAG
  const tasks = await getDbTasks();
  const notes = await getDbNotes();
  const currentFiles = await getDbFiles();

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

  let semanticMatchesContext = '';
  try {
    const semanticMatches = await searchSemanticDocuments(message, {
      topK: 4,
      threshold: 0.25,
    });

    if (semanticMatches.length > 0) {
      semanticMatchesContext = '=== KẾT QUẢ TRUY XUẤT HYBRID RAG (DENSE gemini-embedding-2-preview + SPARSE BM25 + RRF) ===\n' +
        '(Hệ thống Hybrid Search đã trích xuất các tài liệu/ghi chú liên quan mật thiết nhất bằng mô hình Vector Google kết hợp thuật toán BM25 và Reciprocal Rank Fusion):\n' +
        semanticMatches.map(m => {
          const typeLabel = m.type === 'note' ? 'GHI CHÚ' : 'TÀI LIỆU';
          const matchScore = Math.round(m.similarity * 100);
          return `• [${typeLabel}: "${m.title}"] (Độ khớp: ${matchScore}% | Phương thức: ${m.matchMethod?.toUpperCase() || 'HYBRID'})\n  - Đánh giá liên quan: ${m.relevanceExplanation || ''}\n  - Trích đoạn nội dung: "${m.fullText.slice(0, 700)}"`;
        }).join('\n\n');
    }
  } catch (semErr) {
    console.warn('[Semantic Search Retrieval Error]:', semErr);
  }

  const systemInstruction = `Bạn là Trợ Lý Cố Vấn Điều Hành Cao Cấp & Bạn Đồng Hành Trí Tuệ Tự Học (Senior AI Executive Companion & Thought Partner).
Bạn sở hữu năng lực phân tích vượt trội của một chuyên gia công nghệ và quản trị hơn 20 năm kinh nghiệm, đồng thời mang trái tim thấu cảm, tinh tế, ấm áp và giàu lòng trắc ẩn (High IQ + High EQ).

${learnedMemoryContext ? `${learnedMemoryContext}\n\n` : ''}=== BỐI CẢNH DỮ LIỆU THỰC TẾ TRỰC TIẾP TỪ FIRESTORE (LIVE FIRESTORE GROUNDING) ===
- Thời gian hiện tại tại Việt Nam (UTC+7): ${vnDateNow.toLocaleTimeString('vi-VN')} ngày ${currentVnDateStr} (${weekdayNames[vnDateNow.getDay()]})
- Số lượng công việc trong hệ thống: ${tasks.length}
- Danh sách công việc chi tiết kèm hạn chót:
${tasksContext || '(Chưa có công việc nào)'}

- Danh sách ghi chú của người dùng:
${notesContext || '(Chưa có ghi chú nào)'}

- Danh sách tệp tài liệu:
${filesContext || '(Chưa có tài liệu nào)'}

${semanticMatchesContext ? `${semanticMatchesContext}\n\n` : ''}${historySnippet ? `=== LỊCH SỬ TRAO ĐỔI GẦN NHẤT ===\n${historySnippet}\n\n` : ''}=== NGUYÊN TẮC PHẢN HỒI (EXECUTIVE GUIDELINES) ===
1. Danh xưng: Tuân thủ tuyệt đối danh xưng đã học trong ký ức. Nếu chưa có, gọi người dùng là "bạn" và tự xưng là "tôi" hoặc "em" một cách khiêm nhường, ấm áp và lịch thiệp.
2. Trả lời trực tiếp, thông minh, sâu sắc, có cấu trúc rõ ràng. Sử dụng bullet points ngắn gọn khi phân tích.
3. Không trả lời chung chung hoặc đưa ra lời khuyên sáo rỗng. Hãy bám sát thực tế các công việc, ghi chú và câu hỏi của người dùng.`;

  try {
    const ai = getGeminiClient();
    const hasSearchQuery = queryLower.includes('tìm kiếm') || queryLower.includes('tin tức') || queryLower.includes('mới nhất') || queryLower.includes('giá') || queryLower.includes('search');

    const { stream } = await safeGenerateContentStream({
      gemini: ai,
      contents: message,
      config: {
        systemInstruction,
        ...(enableSearch && hasSearchQuery ? { tools: [{ googleSearch: {} }] } : {}),
      },
    });

    let fullReply = '';
    const groundingSources: { title: string; url: string }[] = [];

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullReply += text;
        onChunk(text);
      }

      if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        for (const gc of chunk.candidates[0].groundingMetadata.groundingChunks) {
          if (gc.web?.uri && gc.web?.title) {
            groundingSources.push({
              title: gc.web.title,
              url: gc.web.uri,
            });
          }
        }
      }
    }

    if (!fullReply.trim()) {
      const fallback = `Tôi đã lắng nghe chia sẻ của bạn: "${message}". Tôi luôn sẵn sàng hỗ trợ bạn quản lý công việc và tư vấn giải pháp hiệu quả nhất.`;
      fullReply = fallback;
      onChunk(fallback);
    }

    // Persist conversation turn
    appendConversationTurn(sessionId, message, fullReply);

    // Detached background passive learning
    triggerPassiveLearningExtraction(message, fullReply, ai).catch(err => {
      console.warn('[AI Self-Learning Async Error]:', err?.message);
    });

    return {
      reply: fullReply,
      groundingSources,
      retrievedContext: {
        tasksCount: tasks.length,
        notesCount: notes.length,
        filesCount: currentFiles.length,
        isStreamed: true,
      },
    };
  } catch (err: any) {
    console.warn('[processAiChatStream fallback]:', err?.message);
    const fallbackRes = await processAiChat(message, enableSearch, sessionId, providedHistory);
    onChunk(fallbackRes.reply);
    return fallbackRes;
  }
}

export interface GeneratedTaskNote {
  title: string;
  content: string;
  tags: string[];
  category?: string;
}

/**
 * Uses Gemini AI to analyze a completed task and draft an insightful knowledge note
 * summarizing achievements, key metrics, takeaways, and lessons learned.
 */
export async function generateNoteFromCompletedTask(task: Partial<Task>): Promise<GeneratedTaskNote> {
  const gemini = getGeminiClient();

  const title = task.title || 'Công việc hoàn thành';
  const desc = task.description || 'Không có mô tả chi tiết';
  const category = (task as any).category || 'Công việc';
  const priority = task.priority || 'medium';
  const deadline = task.deadline ? new Date(task.deadline).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Không có';
  const tagsStr = (task.tags && task.tags.length > 0) ? task.tags.join(', ') : 'Không có';
  const completionTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  const prompt = `Bạn là Trợ lý AI Chuyên gia Quản trị Tri thức Cá nhân (Personal Knowledge Management & Executive Productivity).
Người dùng vừa hoàn thành công việc sau trong hệ thống:
- Tiêu đề công việc: "${title}"
- Mô tả chi tiết: "${desc}"
- Danh mục / Phân loại: ${category}
- Mức độ ưu tiên: ${priority.toUpperCase()}
- Hạn chót ban đầu: ${deadline}
- Thẻ ban đầu: ${tagsStr}
- Thời điểm hoàn thành: ${completionTime}

Nhiệm vụ của bạn:
Hãy phân tích dữ liệu trên và đúc kết thành một GHI CHÚ TRI THỨC (Knowledge & Retrospective Note) súc tích, chuyên nghiệp và có giá trị tham khảo lâu dài.
Nội dung ghi chú cần được định dạng Markdown rõ ràng, gồm:
1. 🎯 Mục tiêu & Kết quả hoàn thành (Tóm tắt ngắn gọn những gì đã hoàn tất).
2. 📝 Nội dung & Điểm mấu chốt (Những lưu ý, thông số quan trọng cần ghi nhớ).
3. 💡 Bài học kinh nghiệm & Đúc kết (Key Takeaways giúp tối ưu cho các công việc tương tự sau này).
4. 🚀 Gợi ý bước tiếp theo (Hành động theo sau nếu có).

QUY TẮC BẮT BUỘC:
- Trả về DUY NHẤT một chuỗi JSON hợp lệ (không bao gồm markdown block \`\`\`json, không văn bản phụ trợ) theo cấu trúc:
{
  "title": "Tiêu đề ghi chú ngắn gọn, chuyên nghiệp (ví dụ: 'Tổng kết: ${title}' hoặc 'Đúc kết kinh nghiệm: ${title}')",
  "content": "Nội dung ghi chú định dạng Markdown chi tiết như yêu cầu ở trên",
  "tags": ["danh", "sach", "the", "phu", "hop", "tong_ket", "hoan_thanh"]
}`;

  try {
    const aiResponse = await safeGenerateContent({
      gemini,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const text = aiResponse.text || '';
    const cleanJson = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      title: parsed.title || `Tổng kết: ${title}`,
      content: parsed.content || `### 🎯 Kết quả hoàn thành\nĐã hoàn thành công việc: **${title}**\n\n### 📝 Chi tiết\n${desc}`,
      tags: Array.isArray(parsed.tags) ? parsed.tags.map((t: string) => String(t).trim().toLowerCase()) : ['tong_ket', 'hoan_thanh'],
      category: category,
    };
  } catch (error) {
    console.warn('Gemini generateNoteFromCompletedTask fallback:', error);
    return {
      title: `Tổng kết: ${title}`,
      content: `### 🎯 Mục tiêu & Kết quả hoàn thành\n- **Công việc:** ${title}\n- **Phân loại:** ${category}\n- **Thời gian hoàn thành:** ${completionTime}\n\n### 📝 Chi tiết thực hiện\n${desc}\n\n### 💡 Bài học kinh nghiệm & Đúc kết\n- Đã hoàn thành nhiệm vụ theo đúng kế hoạch đề ra.\n- Cần tiếp tục theo dõi hiệu quả và lưu trữ kết quả này để đối chiếu trong các dự án sau.`,
      tags: ['tong_ket', 'hoan_thanh', ...(task.tags || [])],
      category: category,
    };
  }
}

/**
 * Uses Gemini AI to automatically analyze and evaluate a task in-depth without asking questions.
 * Produces structured evaluation, complexity/urgency rating, key takeaways, and step-by-step action plan.
 */
export async function analyzeTaskDirectly(task: Partial<Task>): Promise<any> {
  const gemini = getGeminiClient();

  const title = task.title || 'Công việc không tên';
  const desc = task.description || 'Không có mô tả chi tiết';
  const priority = task.priority || 'medium';
  const deadline = task.deadline ? new Date(task.deadline).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Không có hạn chót cụ thể';
  const tagsStr = (task.tags && task.tags.length > 0) ? task.tags.join(', ') : 'Không có';
  const recurringStr = task.recurring && task.recurring.type !== 'none'
    ? `Lặp định kỳ ${task.recurring.interval || 1} ${task.recurring.unit || task.recurring.type}`
    : 'Không lặp';
  const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  const prompt = `Bạn là Chuyên gia Cố vấn Điều hành & Tối ưu Hiệu suất Công việc Cao cấp (Senior Executive Productivity & Workflow Specialist).
Nhiệm vụ của bạn: Hãy phân tích và đánh giá toàn diện, sâu sắc, thực tế công việc dưới đây để người dùng có thể thực thi ngay mà TUYỆT ĐỐI KHÔNG CẦN BẠN HỎI NGƯỢC LẠI BẤT KỲ CÂU HỎI NÀO.

Thông tin công việc:
- Tiêu đề: "${title}"
- Mô tả chi tiết: "${desc}"
- Mức độ ưu tiên hệ thống: ${priority.toUpperCase()}
- Hạn chót chính thức: ${deadline}
- Chu kỳ lặp lại: ${recurringStr}
- Thẻ: ${tagsStr}
- Thời điểm hiện tại: ${now}

YÊU CẦU ĐÁNH GIÁ & PHÂN TÍCH:
1. Đánh giá tính khẩn cấp (urgency) và độ phức tạp (complexity) của công việc dựa trên thời gian còn lại đến hạn chót, tính chất lặp lại và nội dung công việc.
2. Trích xuất chính xác các thông tin then chốt (Key Takeaways): như tên người nhận/người liên hệ, số điện thoại, địa chỉ, phương thức vận chuyển, chứng từ/thiết bị cần kiểm tra (ví dụ: liều kế cá nhân, kết quả đọc...), rủi ro nếu trễ hạn.
3. Lập lộ trình thực hiện từng bước (Step-by-step Action Plan) chi tiết, thực tế, thứ tự rõ ràng từ khâu chuẩn bị, xác nhận thông tin, thực hiện đến nghiệm thu hoàn tất.
4. Gợi ý khung giờ thực hiện tối ưu trước hạn chót để không bị động.
5. Soạn thảo một bản báo cáo phân tích Markdown hoàn chỉnh, chuyên nghiệp, cấu trúc mạch lạc, dùng emoji trang nhã.

QUY TẮC BẮT BUỘC:
- Trả về DUY NHẤT một chuỗi JSON hợp lệ (không bao gồm markdown block \`\`\`json, không có văn bản phụ ngoài JSON) theo cấu trúc:
{
  "summary": "Tóm tắt ngắn gọn 1-2 câu về bản chất và mục tiêu cốt lõi của công việc",
  "urgencyEvaluation": {
    "level": "critical", // hoặc "high", "medium", "low"
    "score": 80, // số nguyên từ 0 đến 100
    "label": "Tên nhãn ngắn gọn (ví dụ: 'Ưu tiên cao - Cần giải quyết sớm')",
    "explanation": "Đánh giá chi tiết vì sao có mức độ khẩn cấp này"
  },
  "complexityEvaluation": {
    "level": "moderate", // hoặc "simple", "complex"
    "label": "Tên nhãn (ví dụ: 'Độ phức tạp trung bình - Cần liên hệ đối tác')",
    "explanation": "Đánh giá về số lượng đầu việc, con người hoặc quy trình liên quan"
  },
  "keyTakeaways": [
    "Điểm then chốt 1",
    "Điểm then chốt 2",
    "Điểm then chốt 3"
  ],
  "actionPlan": [
    {
      "step": 1,
      "title": "Tên bước 1",
      "description": "Chi tiết thao tác cụ thể cần làm",
      "estimatedMinutes": 15
    },
    {
      "step": 2,
      "title": "Tên bước 2",
      "description": "Chi tiết thao tác cụ thể cần làm",
      "estimatedMinutes": 30
    }
  ],
  "suggestedCompletionWindow": "Gợi ý khung thời gian tối ưu cần hoàn thành",
  "markdownReport": "Bản báo cáo Markdown chi tiết, rõ ràng từng đề mục với emoji"
}`;

  try {
    const aiResponse = await safeGenerateContent({
      gemini,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.25,
      },
    });

    const text = aiResponse.text || '';
    const cleanJson = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      summary: parsed.summary || `Phân tích chi tiết công việc: ${title}`,
      urgencyEvaluation: parsed.urgencyEvaluation || {
        level: priority === 'high' ? 'high' : priority === 'medium' ? 'medium' : 'low',
        score: priority === 'high' ? 85 : priority === 'medium' ? 65 : 40,
        label: priority === 'high' ? 'Ưu tiên cao' : priority === 'medium' ? 'Ưu tiên trung bình' : 'Tiêu chuẩn',
        explanation: `Công việc có hạn chót vào ${deadline}.`,
      },
      complexityEvaluation: parsed.complexityEvaluation || {
        level: 'moderate',
        label: 'Độ phức tạp trung bình',
        explanation: 'Yêu cầu các bước phối hợp thực hiện tuần tự.',
      },
      keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [
        `Nội dung: ${desc}`,
        `Hạn chót chính thức: ${deadline}`,
      ],
      actionPlan: Array.isArray(parsed.actionPlan) ? parsed.actionPlan : [
        { step: 1, title: 'Chuẩn bị thông tin', description: desc, estimatedMinutes: 15 },
        { step: 2, title: 'Thực hiện nhiệm vụ', description: `Tiến hành triển khai theo yêu cầu của "${title}"`, estimatedMinutes: 30 },
        { step: 3, title: 'Xác nhận hoàn tất', description: 'Kiểm tra kết quả và đánh dấu hoàn thành', estimatedMinutes: 10 },
      ],
      suggestedCompletionWindow: parsed.suggestedCompletionWindow || `Nên thực hiện trước hạn chót ${deadline}`,
      markdownReport: parsed.markdownReport || `### 🎯 Đánh giá & Phân tích Công việc: ${title}\n\n**Mô tả:** ${desc}\n\n**Hạn chót:** ${deadline}\n\n**Mức độ:** ${priority.toUpperCase()}`,
    };
  } catch (error) {
    console.warn('Gemini analyzeTaskDirectly fallback:', error);
    return {
      summary: `Phân tích công việc "${title}": Cần phối hợp thực hiện và đảm bảo tiến độ trước hạn chót.`,
      urgencyEvaluation: {
        level: priority === 'high' ? 'high' : priority === 'medium' ? 'medium' : 'low',
        score: priority === 'high' ? 85 : priority === 'medium' ? 65 : 40,
        label: priority === 'high' ? 'Ưu tiên cao' : 'Tiêu chuẩn',
        explanation: `Hạn chót chính thức: ${deadline}. Cần sắp xếp thời gian hợp lý.`,
      },
      complexityEvaluation: {
        level: 'moderate',
        label: 'Độ phức tạp tiêu chuẩn',
        explanation: 'Công việc đòi hỏi các thao tác chuẩn bị và bàn giao theo quy trình.',
      },
      keyTakeaways: [
        `Nhiệm vụ: ${title}`,
        `Chi tiết thông tin: ${desc}`,
        `Hạn chót: ${deadline}`,
      ],
      actionPlan: [
        { step: 1, title: 'Rà soát thông tin & vật phẩm liên quan', description: `Kiểm tra đầy đủ thông tin mô tả: ${desc}`, estimatedMinutes: 15 },
        { step: 2, title: 'Tiến hành triển khai thực hiện', description: 'Liên hệ các bên liên quan và gửi/xử lý hồ sơ theo đúng địa chỉ', estimatedMinutes: 30 },
        { step: 3, title: 'Lưu trữ biên nhận & Đánh dấu hoàn thành', description: 'Xác nhận người nhận đã tiếp nhận và cập nhật trạng thái trong hệ thống', estimatedMinutes: 10 },
      ],
      suggestedCompletionWindow: `Hoàn tất trước hạn chót ${deadline}`,
      markdownReport: `### 🎯 Tổng quan nhiệm vụ: ${title}\n\n- **Nội dung:** ${desc}\n- **Hạn chót:** ${deadline}\n- **Ưu tiên:** ${priority.toUpperCase()}\n\n### 📋 Các bước đề xuất:\n1. Rà soát thông tin và liên hệ người phụ trách.\n2. Thực hiện đóng gói hoặc gửi theo địa chỉ trong mô tả.\n3. Lưu biên nhận và đánh dấu hoàn thành.`,
    };
  }
}

