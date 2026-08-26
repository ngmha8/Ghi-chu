import { GoogleGenAI } from '@google/genai';
import {
  getDbAiMemories,
  getActiveDbAiMemories,
  saveDbAiMemory,
  deleteDbAiMemory,
  getDbAiInsights,
  saveDbAiInsight,
  getDbTasks,
  getDbNotes,
  getDbFiles,
  getDbTelegramConfig,
  getDbAiPersonaConfig,
  saveDbAiPersonaConfig,
} from './firebaseDb.ts';
import { AiMemoryFact, AiLearningInsight, AiMemoryCategory, AiPersonaConfig } from '../src/types/index.ts';
import { safeGenerateContent } from './geminiHelper.ts';

// -------------------------------------------------------------
// 1. DYNAMIC MEMORY SYNTHESIS (INJECT INTO SYSTEM PROMPT)
// -------------------------------------------------------------
export async function synthesizeLearnedPromptContext(): Promise<string> {
  const activeMemories = await getActiveDbAiMemories();
  const insights = await getDbAiInsights();
  const persona = await getDbAiPersonaConfig();

  const styleDescriptions: Record<string, string> = {
    warm_empathetic: 'Tận tụy, thấu cảm sâu sắc, ấm áp, giàu năng lượng tích cực và luôn mang lại cảm giác an tâm tuyệt đối.',
    executive_concise: 'Sắc sảo, dứt khoát, đi thẳng vào trọng tâm, tối đa hóa thời gian và hành động chuẩn xác như một Chánh văn phòng cao cấp.',
    strategic_advisor: 'Tư duy chiến lược đa chiều, phân tích rủi ro - cơ hội, hướng dẫn tầm nhìn dài hạn và tối ưu hóa hệ thống.',
    energetic_action: 'Tràn đầy nhiệt huyết, thúc đẩy hành động ngay, truyền cảm hứng vượt qua trì hoãn và ăn mừng từng bước tiến nhỏ.',
  };

  let memoryContext = `=== QUY TẮC XƯNG HÔ & HỒ SƠ ĐỒNG HÀNH CÁ NHÂN HÓA (STRICT AI PERSONA & HONORIFICS) ===\n` +
    `- DANH XƯNG BẮT BUỘC KHI GỌI NGƯỜI DÙNG: "${persona.userHonorific || 'Bạn'}"\n` +
    `  (Ví dụ cách nói tự nhiên: "Chào ${persona.userHonorific || 'bạn'}", "${persona.userHonorific || 'Bạn'} có thể xem qua...", "Chúc ${persona.userHonorific || 'bạn'} một ngày làm việc hiệu quả")\n` +
    `- DANH XƯNG CỦA TRỢ LÝ AI: "${persona.aiHonorific || 'Tôi'}"\n` +
    `  (Ví dụ: "${persona.aiHonorific || 'Tôi'} xin tóm tắt...", "${persona.aiHonorific || 'Tôi'} đã cập nhật xong công việc cho ${persona.userHonorific || 'bạn'}")\n` +
    `- PHONG CÁCH ĐỒNG HÀNH: ${styleDescriptions[persona.communicationStyle] || styleDescriptions.warm_empathetic}\n` +
    `- LĨNH VỰC TRỌNG TÂM: ${persona.focusDomain || 'Công nghệ, Quản trị dự án & Năng suất'}\n` +
    (persona.customInstructions ? `- LỜI NHẮC ĐẶC BIỆT CỦA NGƯỜI DÙNG: "${persona.customInstructions}"\n` : '') +
    `- QUY TẮC TIẾP NHẬN HƯỚNG DẪN XƯNG HÔ: Bất kỳ khi nào người dùng nhắn nhắc đổi cách gọi (ví dụ: "Hãy gọi tôi là...", "Xưng em nhé", "Gọi anh là Nam"), hãy tôn trọng tuyệt đối, cập nhật ngay vào xưng hô trong câu trả lời này và gọi tool rememberUserFact để ghi nhớ vĩnh viễn!\n\n`;

  if (activeMemories.length > 0 || insights.length > 0) {
    memoryContext += `=== BỘ NHỚ HỌC TẬP & KÝ ỨC DÀI HẠN (LONG-TERM AI MEMORY) ===\n` +
      `AI đã học và ghi nhớ các đặc điểm, thói quen và quy tắc sau đây của người dùng. Hãy tự động tuân thủ:\n\n`;

    // Group memories by category
    const grouped: Record<string, string[]> = {
      preference: [],
      identity: [],
      rule: [],
      workflow: [],
      domain_knowledge: [],
      habit: [],
    };

    const categoryLabels: Record<string, string> = {
      preference: '🌟 Sở thích & Phong cách giao tiếp',
      identity: '👤 Danh tính & Thông tin cá nhân',
      rule: '🔒 Quy tắc bắt buộc người dùng đặt ra',
      workflow: '⚙️ Quy trình xử lý công việc ưa thích',
      domain_knowledge: '📚 Chuyên môn & Dự án trọng tâm',
      habit: '⏳ Thói quen sinh hoạt & Nhịp làm việc',
    };

    for (const m of activeMemories) {
      const list = grouped[m.category] || grouped.preference;
      list.push(`• ${m.fact} (Độ tin cậy: ${Math.round((m.confidence || 0.8) * 100)}%)`);
    }

    for (const [catKey, label] of Object.entries(categoryLabels)) {
      const items = grouped[catKey];
      if (items && items.length > 0) {
        memoryContext += `[${label}]:\n${items.join('\n')}\n\n`;
      }
    }

    if (insights.length > 0) {
      memoryContext += `[💡 Đúc kết Quy luật & Năng suất (Recent Insights)]:\n`;
      for (const ins of insights.slice(0, 3)) {
        memoryContext += `• ${ins.title}: ${ins.summary} ➔ Lời khuyên: ${ins.actionableAdvice}\n`;
      }
      memoryContext += '\n';
    }
  }

  return memoryContext.trim();
}

// -------------------------------------------------------------
// 2. PASSIVE CONTINUOUS EXTRACTION (ASYNC BACKGROUND LEARNER)
// -------------------------------------------------------------
export async function triggerPassiveLearningExtraction(
  userMessage: string,
  assistantReply: string,
  geminiClient: GoogleGenAI | null
): Promise<void> {
  if (!geminiClient) return;

  const msgTrimmed = userMessage.trim();
  if (msgTrimmed.length < 5 || msgTrimmed.startsWith('/') || msgTrimmed.toLowerCase().includes('thời tiết')) {
    return;
  }

  try {
    const extractionPrompt = `Bạn là Module Trí Tuệ Tự Học & Quản Lý Ký Ức Dài Hạn (AI Meta-Cognitive Learning Engine).
Nhiệm vụ của bạn là phân tích đoạn hội thoại vừa diễn ra giữa Người dùng và Trợ lý AI để trích xuất các "Sự thật / Thói quen / Sở thích / Quy tắc / Danh xưng / Chuyên môn" mới về người dùng nếu có.

ĐOẠN HỘI THOẠI VỪA DIỄN RA:
- Người dùng: "${userMessage}"
- Trợ lý AI: "${assistantReply.slice(0, 300)}..."

HƯỚNG DẪN TRÍCH XUẤT:
1. Chỉ trích xuất thông tin CÓ GIÁ TRỊ LÂU DÀI về người dùng (ví dụ: "Người dùng thích...", "Người dùng làm nghề...", "Người dùng yêu cầu xưng hô...", "Quy tắc khi tạo việc...", "Sở thích lập trình...", "Thói quen deadline...").
2. BỎ QUA các yêu cầu nhất thời ngắn hạn (ví dụ: "hôm nay ăn gì", "xem thời tiết", "tính toán 1+1").
3. Nếu không có thông tin dài hạn mới nào cần ghi nhớ, hãy trả về mảng rỗng [].

HÃY TRẢ VỀ DUY NHẤT ĐỊNH DẠNG JSON KHÔNG KÈM TEXT GIẢI THÍCH:
[
  {
    "category": "preference" | "identity" | "rule" | "workflow" | "domain_knowledge" | "habit",
    "fact": "Mô tả sự thật hoặc quy tắc cô đọng bằng tiếng Việt",
    "confidence": 0.85
  }
]`;

    const response = await safeGenerateContent({
      gemini: geminiClient,
      contents: extractionPrompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response?.text?.trim();
    if (!text || text === '[]' || !text.startsWith('[')) return;

    const extractedItems: any[] = JSON.parse(text);
    if (!Array.isArray(extractedItems) || extractedItems.length === 0) return;

    const existingMemories = await getDbAiMemories();

    for (const item of extractedItems) {
      if (!item.fact || typeof item.fact !== 'string' || item.fact.length < 6) continue;

      const category: AiMemoryCategory = ['preference', 'identity', 'rule', 'workflow', 'domain_knowledge', 'habit'].includes(item.category)
        ? item.category
        : 'preference';

      // Check if duplicate or highly similar fact exists
      const cleanNewFact = item.fact.toLowerCase().trim();
      const existing = existingMemories.find(
        m => m.fact.toLowerCase().includes(cleanNewFact) || cleanNewFact.includes(m.fact.toLowerCase())
      );

      if (existing) {
        // Reinforce existing memory
        await saveDbAiMemory({
          ...existing,
          occurrences: (existing.occurrences || 1) + 1,
          confidence: Math.min(0.99, (existing.confidence || 0.8) + 0.05),
          updatedAt: new Date().toISOString(),
        });
        console.log(`🧠 [AI Self-Learning] Reinforced existing memory: "${existing.fact}" (Occurrences: ${existing.occurrences + 1})`);
      } else {
        // Create new memory fact
        const newFact: AiMemoryFact = {
          id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          category,
          fact: item.fact.trim(),
          confidence: Math.min(0.95, Math.max(0.6, Number(item.confidence) || 0.85)),
          source: 'chat',
          occurrences: 1,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveDbAiMemory(newFact);
        console.log(`✨ [AI Self-Learning] Learned new user fact: [${category}] "${newFact.fact}"`);
      }
    }
  } catch (err: any) {
    console.warn('[AI Passive Learning Extraction Error]:', err?.message);
  }
}

// -------------------------------------------------------------
// 3. AUTONOMOUS COGNITIVE SELF-REFLECTION (DEEP ANALYSIS)
// -------------------------------------------------------------
export async function runAutonomousCognitiveReflection(
  geminiClient: GoogleGenAI | null
): Promise<{
  success: boolean;
  insights: AiLearningInsight[];
  message: string;
}> {
  if (!geminiClient) {
    return {
      success: false,
      insights: [],
      message: 'Gemini client chưa sẵn sàng',
    };
  }

  try {
    const tasks = await getDbTasks();
    const notes = await getDbNotes();
    const files = await getDbFiles();
    const memories = await getDbAiMemories();
    const telegramConfig = await getDbTelegramConfig();

    const tasksSummary = tasks.map(t => ({
      title: t.title,
      priority: t.priority,
      status: t.status,
      deadline: t.deadline,
      tags: t.tags,
      createdAt: t.createdAt,
    }));

    const notesSummary = notes.map(n => ({
      title: n.title,
      tags: n.tags,
      isPinned: n.isPinned,
      contentSnippet: n.content.slice(0, 150),
    }));

    const filesSummary = files.map(f => ({
      name: f.name,
      category: f.category,
      classification: f.classification,
    }));

    const reflectionPrompt = `Bạn là Trợ Lý Cố Vấn Tự Học & Quản Trị Nhận Thức Cấp Cao (Senior Autonomous AI Cognitive Partner).
Dưới đây là toàn bộ dữ liệu lịch sử hoạt động, công việc, ghi chú và tài liệu của người dùng trong hệ thống:

1. DANH SÁCH CÔNG VIỆC (${tasks.length} tasks):
${JSON.stringify(tasksSummary, null, 2)}

2. DANH SÁCH GHI CHÚ (${notes.length} notes):
${JSON.stringify(notesSummary, null, 2)}

3. KHO TÀI LIỆU (${files.length} files):
${JSON.stringify(filesSummary, null, 2)}

4. CÁC KÝ ỨC HIỆN TẠI ĐÃ HỌC ĐƯỢC:
${JSON.stringify(memories.map(m => `[${m.category}] ${m.fact}`), null, 2)}

NHIỆM VỤ SUY NGẪM & TỰ HỌC (DEEP COGNITIVE REFLECTION):
Hãy phân tích mẫu hình hành vi (Behavioral Patterns), tần suất làm việc, phân bố độ ưu tiên, thói quen ghi chép và tài liệu để rút ra:
1. **2 - 4 Đúc kết chiến lược sâu sắc (Insights)** về năng suất, điểm nghẽn (bottlenecks) hoặc nhịp làm việc tối ưu.
2. Mỗi insight phải có tiêu đề hấp dẫn, tóm tắt hiện trạng và **Lời khuyên hành động cụ thể (Actionable Advice)**.

HÃY TRẢ VỀ DUY NHẤT ĐỊNH DẠNG JSON HỢP LỆ:
[
  {
    "title": "Tiêu đề đúc kết (Ví dụ: 'Tối ưu hóa Thời gian Xử lý Task Khẩn Cấp')",
    "summary": "Tóm tắt nhận định và phân tích mẫu hình của người dùng",
    "actionableAdvice": "Lời khuyên chiến lược cụ thể giúp cải thiện 20-30% hiệu suất",
    "category": "productivity" | "focus" | "workload" | "pattern",
    "confidenceScore": 0.92
  }
]`;

    const response = await safeGenerateContent({
      gemini: geminiClient,
      contents: reflectionPrompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response?.text?.trim();
    if (!text || !text.startsWith('[')) {
      throw new Error('Không nhận được JSON hợp lệ từ mô hình tự học.');
    }

    const generatedInsights: any[] = JSON.parse(text);
    const savedInsights: AiLearningInsight[] = [];

    for (const item of generatedInsights) {
      if (!item.title || !item.summary) continue;

      const insight: AiLearningInsight = {
        id: `insight-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: item.title,
        summary: item.summary,
        actionableAdvice: item.actionableAdvice || 'Tiếp tục duy trì thói quen làm việc có kế hoạch.',
        category: ['productivity', 'focus', 'workload', 'pattern'].includes(item.category) ? item.category : 'productivity',
        confidenceScore: Number(item.confidenceScore) || 0.88,
        generatedAt: new Date().toISOString(),
      };

      await saveDbAiInsight(insight);
      savedInsights.push(insight);
    }

    return {
      success: true,
      insights: savedInsights,
      message: `Đã hoàn thành phiên tự học & suy ngẫm sâu sắc, tạo mới ${savedInsights.length} đúc kết chiến lược.`,
    };
  } catch (err: any) {
    console.error('[AI Cognitive Reflection Error]:', err);
    return {
      success: false,
      insights: [],
      message: err?.message || 'Lỗi xử lý phiên tự học',
    };
  }
}
