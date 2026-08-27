import { Type, FunctionDeclaration } from '@google/genai';
import {
  getDbTasks,
  saveDbTask,
  deleteDbTask,
  getDbNotes,
  saveDbNote,
  deleteDbNote,
  getDbFiles,
  saveDbFile,
  getDbTelegramConfig,
  getDbCategories,
  getDbAiMemories,
  getActiveDbAiMemories,
  saveDbAiMemory,
  deleteDbAiMemory,
  getDbAiPersonaConfig,
  saveDbAiPersonaConfig,
} from './firebaseDb.ts';
import { searchSemanticDocuments } from './embeddingService.ts';
import { fetchLiveWeather } from './weatherService.ts';
import { Task, Note, DriveFile, AiMemoryFact } from '../src/types/index.ts';

// 1. Function Declarations for Gemini Tool Calling
export const aiFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: 'semanticSearchDocuments',
    description: 'Tìm kiếm ngữ nghĩa (Semantic Vector Search) trên toàn bộ kho ghi chú và tệp tin/tài liệu. Sử dụng khi người dùng hỏi các câu hỏi tự nhiên như "Hôm trước mình có ghi lại thông tin về hợp đồng máy móc ở đâu nhỉ?", "Tài liệu nào liên quan đến bảo mật và PIN?", "Tìm thông tin về kế hoạch du lịch Đà Lạt"... mà từ khóa có thể không trùng khớp 100%.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        naturalQuery: {
          type: Type.STRING,
          description: 'Câu hỏi hoặc cụm từ tự nhiên mô tả nội dung cần tìm kiếm',
        },
        targetType: {
          type: Type.STRING,
          enum: ['all', 'notes', 'files'],
          description: 'Phạm vi tìm kiếm: all (tất cả), notes (chỉ ghi chú), files (chỉ tài liệu/file)',
        },
      },
      required: ['naturalQuery'],
    },
  },
  {
    name: 'createTask',
    description: 'Tạo mới một công việc (Task) với tiêu đề, thời hạn (deadline ISO hoặc chuỗi giờ Việt Nam), độ ưu tiên (low, medium, high), mô tả chi tiết và tags.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: 'Tiêu đề công việc cần làm, ví dụ: "Họp chiến lược sản phẩm quý 3", "Gửi email báo giá cho khách hàng VIP"',
        },
        deadline: {
          type: Type.STRING,
          description: 'Thời hạn hoàn thành định dạng ISO 8601 (YYYY-MM-DDTHH:mm:ssZ) hoặc chuỗi ngày giờ Việt Nam (ví dụ: "chiều mai 15h", "20h tối nay", "thứ 6 tuần này lúc 9h sáng").',
        },
        priority: {
          type: Type.STRING,
          enum: ['low', 'medium', 'high'],
          description: 'Mức độ ưu tiên của công việc (mặc định: medium, nếu gấp hoặc quan trọng thì chọn high)',
        },
        description: {
          type: Type.STRING,
          description: 'Mô tả chi tiết nội dung, mục tiêu hoặc hướng dẫn thực hiện công việc',
        },
        tags: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Các nhãn phân loại, ví dụ: ["Công việc", "Khẩn", "Dự án A", "Cá nhân", "Tài chính"]',
        },
        reminderOffsetMinutes: {
          type: Type.NUMBER,
          description: 'Số phút nhắc nhở trước deadline qua Telegram/In-App (mặc định: 15)',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'completeTask',
    description: 'Đánh dấu hoàn thành một công việc dựa vào ID hoặc tìm kiếm theo từ khóa/tên công việc.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        taskId: {
          type: Type.STRING,
          description: 'ID của công việc nếu biết trước',
        },
        taskQuery: {
          type: Type.STRING,
          description: 'Từ khóa hoặc tên công việc cần hoàn thành nếu không có ID, ví dụ: "nộp báo cáo", "họp khách hàng"',
        },
      },
    },
  },
  {
    name: 'deleteTask',
    description: 'Xóa một công việc khỏi hệ thống theo ID hoặc theo tên/từ khóa.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        taskId: {
          type: Type.STRING,
          description: 'ID công việc cần xóa',
        },
        taskQuery: {
          type: Type.STRING,
          description: 'Từ khóa hoặc tên công việc cần xóa nếu không có ID',
        },
      },
    },
  },
  {
    name: 'createNote',
    description: 'Tạo một ghi chú cá nhân mới (Note) để lưu trữ ý tưởng, tài liệu, dàn ý, giải pháp kỹ thuật, hoặc thông tin quan trọng.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: 'Tiêu đề ghi chú rõ ràng, súc tích',
        },
        content: {
          type: Type.STRING,
          description: 'Nội dung chi tiết của ghi chú (hỗ trợ Markdown, gạch đầu dòng, code block)',
        },
        tags: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Danh sách tags/nhãn phân loại',
        },
        isPinned: {
          type: Type.BOOLEAN,
          description: 'Có ghim ghi chú quan trọng này lên đầu danh sách hay không',
        },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'queryNotes',
    description: 'Tra cứu danh sách ghi chú cá nhân (Notes) theo từ khóa tìm kiếm hoặc lọc các ghi chú đã ghim (pinned).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        searchKeyword: {
          type: Type.STRING,
          description: 'Từ khóa tìm kiếm trong tiêu đề, nội dung hoặc tags của ghi chú',
        },
        onlyPinned: {
          type: Type.BOOLEAN,
          description: 'Chỉ lấy những ghi chú quan trọng được ghim',
        },
      },
    },
  },
  {
    name: 'deleteNote',
    description: 'Xóa một ghi chú khỏi hệ thống theo ID hoặc theo tên/từ khóa.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        noteId: {
          type: Type.STRING,
          description: 'ID của ghi chú cần xóa',
        },
        noteQuery: {
          type: Type.STRING,
          description: 'Từ khóa hoặc tiêu đề của ghi chú cần xóa',
        },
      },
    },
  },
  {
    name: 'queryFiles',
    description: 'Tra cứu danh sách tài liệu/tệp tin (Files/Google Drive) theo nhóm phân loại, định dạng hoặc từ khóa.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        classification: {
          type: Type.STRING,
          description: 'Nhóm phân loại tài liệu (ví dụ: "work", "personal", "finance", "legal", "templates", "projects", "Công việc", "Hợp đồng", "Tài chính")',
        },
        category: {
          type: Type.STRING,
          enum: ['all', 'document', 'spreadsheet', 'presentation', 'pdf', 'image', 'archive', 'other'],
          description: 'Định dạng file (pdf, spreadsheet, document...)',
        },
        searchKeyword: {
          type: Type.STRING,
          description: 'Tên file hoặc từ khóa tìm kiếm',
        },
      },
    },
  },
  {
    name: 'queryTasks',
    description: 'Tra cứu danh sách công việc theo trạng thái (todo, in_progress, completed) hoặc theo ngày/từ khóa dựa trên giờ Việt Nam (UTC+7).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: {
          type: Type.STRING,
          enum: ['all', 'pending', 'completed', 'today', 'tomorrow', 'overdue'],
          description: 'Bộ lọc trạng thái công việc',
        },
        searchKeyword: {
          type: Type.STRING,
          description: 'Từ khóa tìm kiếm trong tiêu đề hoặc mô tả',
        },
      },
    },
  },
  {
    name: 'rememberUserFact',
    description: 'Ghi nhớ một thói quen, sở thích, danh tính, quy tắc hoặc chuyên môn của người dùng vào bộ nhớ dài hạn của AI (Long-Term Self-Learning Memory). Gọi hàm này khi người dùng yêu cầu "Hãy nhớ...", "Ghi nhớ rằng...", "Từ nay hãy...", hoặc khi người dùng chia sẻ thông tin cá nhân quan trọng.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        fact: {
          type: Type.STRING,
          description: 'Nội dung sự thật hoặc quy tắc cô đọng cần ghi nhớ (ví dụ: "Người dùng thích xưng hô là Alex", "Luôn ưu tiên họp vào buổi sáng", "Chuyên môn chính là React và AI")',
        },
        category: {
          type: Type.STRING,
          enum: ['preference', 'identity', 'rule', 'workflow', 'domain_knowledge', 'habit'],
          description: 'Phân loại nhóm ký ức: preference (sở thích), identity (danh tính), rule (quy tắc), workflow (quy trình làm việc), domain_knowledge (chuyên môn), habit (thói quen)',
        },
      },
      required: ['fact'],
    },
  },
  {
    name: 'forgetUserFact',
    description: 'Xóa hoặc hủy bỏ một ký ức/thói quen đã ghi nhớ trước đây khi người dùng yêu cầu "Quên thói quen...", "Xóa ký ức...", "Không cần nhớ quy tắc...".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        factQuery: {
          type: Type.STRING,
          description: 'Từ khóa hoặc nội dung ký ức cần quên',
        },
        memoryId: {
          type: Type.STRING,
          description: 'ID của ký ức nếu biết chính xác',
        },
      },
    },
  },
  {
    name: 'queryMemories',
    description: 'Tra cứu danh sách những điều AI đã tự học và ghi nhớ về người dùng trong bộ nhớ dài hạn.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: {
          type: Type.STRING,
          description: 'Phân loại ký ức cần tìm kiếm (preference, identity, rule, workflow, domain_knowledge, habit, hoặc all)',
        },
      },
    },
  },
  {
    name: 'getLiveWeather',
    description: 'Tra cứu tình hình thời tiết trực tiếp, nhiệt độ, độ ẩm, khả năng mưa và cảnh báo thời tiết cho Bắc Giang hoặc bất kỳ tỉnh thành nào. Mặc định tự động lấy tại Bắc Giang (nơi ở của người dùng).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        location: {
          type: Type.STRING,
          description: 'Tên tỉnh thành hoặc khu vực (ví dụ: "Bắc Giang", "Việt Yên", "Hà Nội", "Đà Nẵng", "TP. Hồ Chí Minh"). Mặc định: "Bắc Giang"',
        },
        forecastDay: {
          type: Type.STRING,
          enum: ['today', 'tomorrow'],
          description: 'Thời điểm: today (hôm nay) hoặc tomorrow (ngày mai). Mặc định: today',
        },
      },
    },
  },
];

/**
 * Smart relative date parser strictly bound to Vietnam Timezone (Asia/Ho_Chi_Minh / UTC+7)
 */
export function parseRelativeDate(text: string, baseDate: Date = new Date(), timeZone: string = 'Asia/Ho_Chi_Minh'): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(baseDate);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  
  let targetYear = parseInt(get('year') || '2026', 10);
  let targetMonth = parseInt(get('month') || '1', 10) - 1; // 0-indexed
  let targetDay = parseInt(get('day') || '1', 10);
  let targetHour = 17; // default 17:00 VN
  let targetMinute = 0;

  const lower = text.toLowerCase();

  // Day offset
  if (lower.includes('hôm nay') || lower.includes('nay')) {
    // Keep today
  } else if (lower.includes('ngày mai') || lower.includes('mai')) {
    targetDay += 1;
  } else if (lower.includes('ngày kia') || lower.includes('mốt')) {
    targetDay += 2;
  } else if (lower.includes('tuần sau') || lower.includes('tuần tới')) {
    targetDay += 7;
  }

  // Parse specific explicit hour (e.g., "15h", "15:30", "3h chiều", "8h sáng", "9h tối", "20:00")
  const timeWithColon = lower.match(/(\d{1,2})[:h](\d{1,2})/i);
  const hourSingle = lower.match(/(\d{1,2})\s*(h|giờ|g|pm|am)\b/i);

  if (timeWithColon) {
    let h = parseInt(timeWithColon[1], 10);
    const m = parseInt(timeWithColon[2], 10);
    if ((lower.includes('chiều') || lower.includes('tối') || lower.includes('pm')) && h < 12) {
      h += 12;
    }
    targetHour = h;
    targetMinute = isNaN(m) ? 0 : m;
  } else if (hourSingle) {
    let h = parseInt(hourSingle[1], 10);
    if ((lower.includes('chiều') || lower.includes('tối') || lower.includes('pm')) && h < 12) {
      h += 12;
    }
    targetHour = h;
    targetMinute = 0;
  } else if (lower.includes('sáng')) {
    targetHour = 9;
  } else if (lower.includes('trưa')) {
    targetHour = 12;
  } else if (lower.includes('chiều')) {
    targetHour = 15;
  } else if (lower.includes('tối')) {
    targetHour = 20;
  } else if (lower.includes('đêm')) {
    targetHour = 22;
  }

  // Construct target Date in UTC+7
  const resultDate = new Date(Date.UTC(targetYear, targetMonth, targetDay, targetHour - 7, targetMinute, 0));
  return resultDate.toISOString();
}

// 2. Dispatcher for tool invocations
export async function executeAiFunctionCall(name: string, args: any): Promise<{ success: boolean; data?: any; message: string }> {
  const telegramConfig = await getDbTelegramConfig();
  const timeZone = telegramConfig.timezone || 'Asia/Ho_Chi_Minh';
  console.log(`🤖 AI Tool Executed: [${name}] with args:`, args);

  if (name === 'createTask') {
    let deadlineStr = args.deadline;
    
    if (!deadlineStr || !deadlineStr.includes('T') || isNaN(Date.parse(deadlineStr))) {
      deadlineStr = parseRelativeDate(deadlineStr || 'ngày mai 17h', new Date(), timeZone);
    } else {
      try {
        const parsed = new Date(deadlineStr);
        if (isNaN(parsed.getTime())) {
          deadlineStr = parseRelativeDate('ngày mai 17h', new Date(), timeZone);
        } else {
          deadlineStr = parsed.toISOString();
        }
      } catch {
        deadlineStr = parseRelativeDate('ngày mai 17h', new Date(), timeZone);
      }
    }

    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: args.title || 'Công việc mới',
      description: args.description || '',
      deadline: deadlineStr,
      priority: (args.priority as any) || 'medium',
      status: 'todo',
      tags: args.tags && Array.isArray(args.tags) ? args.tags : ['Cá nhân'],
      recurring: { type: 'none' },
      attachedFileIds: [],
      reminderOffsetMinutes: args.reminderOffsetMinutes ?? 15,
      isNotified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await saveDbTask(newTask);
    const deadlineVnStr = new Date(saved.deadline).toLocaleString('vi-VN', {
      timeZone,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    return {
      success: true,
      data: saved,
      message: `✅ Đã lưu thành công vào Firestore:\n📌 Công việc: **${saved.title}**\n⏰ Hạn chót chính thức: **${deadlineVnStr} [UTC+7]**\n🎯 Độ ưu tiên: **${saved.priority.toUpperCase()}**`,
    };
  }

  if (name === 'completeTask') {
    const tasks = await getDbTasks();
    let target: Task | undefined;

    if (args.taskId) {
      target = tasks.find(t => t.id === args.taskId);
    }
    if (!target && args.taskQuery) {
      const q = String(args.taskQuery).toLowerCase();
      target = tasks.find(t => t.title.toLowerCase().includes(q));
    }

    if (!target) {
      return {
        success: false,
        message: `⚠️ Tôi đã tra cứu nhưng không tìm thấy công việc phù hợp với từ khóa "${args.taskQuery || args.taskId}". Bạn hãy kiểm tra lại tên công việc nhé.`,
      };
    }

    const updated: Task = {
      ...target,
      status: 'completed',
      updatedAt: new Date().toISOString(),
    };
    await saveDbTask(updated);
    return {
      success: true,
      data: updated,
      message: `🎉 Tuyệt vời! Đã hoàn thành công việc: **"${updated.title}"** (Đã đồng bộ lên Cloud Firestore).`,
    };
  }

  if (name === 'deleteTask') {
    const tasks = await getDbTasks();
    let target: Task | undefined;

    if (args.taskId) {
      target = tasks.find(t => t.id === args.taskId);
    }
    if (!target && args.taskQuery) {
      const q = String(args.taskQuery).toLowerCase();
      target = tasks.find(t => t.title.toLowerCase().includes(q));
    }

    if (!target) {
      return {
        success: false,
        message: `⚠️ Không tìm thấy công việc để xóa với từ khóa "${args.taskQuery || args.taskId}".`,
      };
    }

    await deleteDbTask(target.id);
    return {
      success: true,
      message: `🗑️ Đã xóa công việc: **"${target.title}"** khỏi hệ thống.`,
    };
  }

  if (name === 'createNote') {
    const newNote: Note = {
      id: `note-${Date.now()}`,
      title: args.title || 'Ghi chú mới',
      content: args.content || '',
      tags: args.tags && Array.isArray(args.tags) ? args.tags : ['Chung'],
      linkedTaskIds: [],
      attachedFileIds: [],
      isPinned: !!args.isPinned,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await saveDbNote(newNote);
    return {
      success: true,
      data: saved,
      message: `📝 Đã ghi nhận và lưu trữ ghi chú: **"${saved.title}"** (Tags: ${saved.tags.join(', ')})`,
    };
  }

  if (name === 'deleteNote') {
    const notes = await getDbNotes();
    let target: Note | undefined;

    if (args.noteId) {
      target = notes.find(n => n.id === args.noteId);
    }
    if (!target && args.noteQuery) {
      const q = String(args.noteQuery).toLowerCase();
      target = notes.find(n => n.title.toLowerCase().includes(q));
    }

    if (!target) {
      return {
        success: false,
        message: `⚠️ Không tìm thấy ghi chú nào phù hợp với từ khóa "${args.noteQuery || args.noteId}".`,
      };
    }

    await deleteDbNote(target.id);
    return {
      success: true,
      message: `🗑️ Đã xóa vĩnh viễn ghi chú: **"${target.title}"**.`,
    };
  }

  if (name === 'semanticSearchDocuments') {
    const naturalQuery = String(args.naturalQuery || '').trim();
    const targetType = (args.targetType || 'all') as 'all' | 'notes' | 'files';

    if (!naturalQuery) {
      return {
        success: false,
        message: '⚠️ Vui lòng cung cấp nội dung hoặc câu hỏi cần tìm kiếm.',
      };
    }

    const searchResults = await searchSemanticDocuments(naturalQuery, {
      topK: 6,
      threshold: 0.35,
      type: targetType,
    });

    if (searchResults.length === 0) {
      return {
        success: true,
        data: [],
        message: `🔍 Tôi đã quét toàn bộ kho dữ liệu ngữ nghĩa nhưng chưa tìm thấy ghi chú hoặc tệp tin nào tương ứng với nội dung: _"${naturalQuery}"_.`,
      };
    }

    const listText = searchResults
      .map((item, idx) => {
        const typeBadge = item.type === 'note' ? '📝 [Ghi chú]' : '📂 [Tài liệu/File]';
        const simPercent = Math.round(item.similarity * 100);
        return `${idx + 1}. ${typeBadge} **${item.title}** (Khớp ngữ nghĩa: \`${simPercent}%\`)\n   • Nội dung trích xuất: _${item.snippet}_`;
      })
      .join('\n\n');

    return {
      success: true,
      data: searchResults,
      message: `🔍 **KẾT QUẢ TÌM KIẾM NGỮ NGHĨA VECTOR (SEMANTIC RETRIEVAL) CHO: "${naturalQuery}":**\n\n${listText}`,
    };
  }

  if (name === 'queryNotes') {
    const notes = await getDbNotes();
    let filtered = notes;

    if (args.onlyPinned) {
      filtered = filtered.filter(n => n.isPinned);
    }

    if (args.searchKeyword) {
      const kw = String(args.searchKeyword).toLowerCase();
      filtered = filtered.filter(
        n =>
          n.title.toLowerCase().includes(kw) ||
          n.content.toLowerCase().includes(kw) ||
          (n.tags && n.tags.some(t => t.toLowerCase().includes(kw)))
      );

      // If exact keyword match yielded 0 results, fallback to semantic embedding search
      if (filtered.length === 0) {
        const semanticMatches = await searchSemanticDocuments(args.searchKeyword, {
          topK: 5,
          threshold: 0.35,
          type: 'notes',
        });
        if (semanticMatches.length > 0) {
          const matchedIds = new Set(semanticMatches.map(m => m.id));
          filtered = notes.filter(n => matchedIds.has(n.id));
        }
      }
    }

    if (filtered.length === 0) {
      return {
        success: true,
        data: [],
        message: '📝 Tôi đã tìm kiếm trong kho ghi chú nhưng chưa thấy nội dung phù hợp với yêu cầu của bạn.',
      };
    }

    const listText = filtered
      .slice(0, 8)
      .map((n, idx) => {
        const pinBadge = n.isPinned ? '📌 ' : '';
        const snippet = n.content.length > 120 ? `${n.content.slice(0, 120)}...` : n.content;
        return `${idx + 1}. ${pinBadge}**${n.title}**\n   • Tags: \`${(n.tags || []).join(', ')}\`\n   • Trích đoạn: _${snippet}_`;
      })
      .join('\n\n');

    return {
      success: true,
      data: filtered,
      message: `📝 **Ghi chú tìm thấy trong cơ sở dữ liệu (${filtered.length}):**\n\n${listText}`,
    };
  }

  if (name === 'queryFiles') {
    const files = await getDbFiles();
    let filtered = files;

    if (args.classification && args.classification !== 'all') {
      const cls = String(args.classification).toLowerCase();
      filtered = filtered.filter(
        f =>
          (f.classification && f.classification.toLowerCase().includes(cls)) ||
          (f.tags && f.tags.some(t => t.toLowerCase().includes(cls)))
      );
    }

    if (args.category && args.category !== 'all') {
      filtered = filtered.filter(f => f.category === args.category);
    }

    if (args.searchKeyword) {
      const kw = String(args.searchKeyword).toLowerCase();
      filtered = filtered.filter(
        f =>
          f.name.toLowerCase().includes(kw) ||
          (f.classification && f.classification.toLowerCase().includes(kw)) ||
          (f.tags && f.tags.some(t => t.toLowerCase().includes(kw)))
      );

      // If exact keyword match yielded 0 results, fallback to semantic embedding search
      if (filtered.length === 0) {
        const semanticMatches = await searchSemanticDocuments(args.searchKeyword, {
          topK: 5,
          threshold: 0.35,
          type: 'files',
        });
        if (semanticMatches.length > 0) {
          const matchedIds = new Set(semanticMatches.map(m => m.id));
          filtered = files.filter(f => matchedIds.has(f.id));
        }
      }
    }

    if (filtered.length === 0) {
      return {
        success: true,
        data: [],
        message: '📂 Hiện tại chưa tìm thấy tài liệu phù hợp trong kho lưu trữ.',
      };
    }

    const listText = filtered
      .slice(0, 10)
      .map((f, idx) => {
        const driveBadge = f.isSyncedToDrive ? '☁️ [Drive Sync]' : '💾 [Vault Cục Bộ]';
        const linkStr = f.webViewLink ? ` | [Mở xem](${f.webViewLink})` : '';
        return `${idx + 1}. **${f.name}**\n   • Nhóm: \`${f.classification || 'Chưa phân loại'}\` | Định dạng: \`${f.category}\` ${driveBadge}${linkStr}`;
      })
      .join('\n');

    return {
      success: true,
      data: filtered,
      message: `📂 **Danh sách tài liệu tìm thấy (${filtered.length}):**\n\n${listText}`,
    };
  }

  if (name === 'queryTasks') {
    const tasks = await getDbTasks();
    const now = new Date();

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayStr = formatter.format(now); // e.g. "2026-08-25" in Vietnam

    const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
    const tomorrowStr = formatter.format(tomorrow);

    let filtered = tasks;

    if (args.status === 'pending') {
      filtered = tasks.filter(t => t.status !== 'completed' && t.status !== 'canceled');
    } else if (args.status === 'completed') {
      filtered = tasks.filter(t => t.status === 'completed');
    } else if (args.status === 'today') {
      filtered = tasks.filter(t => {
        if (!t.deadline || t.status === 'completed' || t.status === 'canceled') return false;
        const taskDay = formatter.format(new Date(t.deadline));
        return taskDay === todayStr;
      });
    } else if (args.status === 'tomorrow') {
      filtered = tasks.filter(t => {
        if (!t.deadline || t.status === 'completed' || t.status === 'canceled') return false;
        const taskDay = formatter.format(new Date(t.deadline));
        return taskDay === tomorrowStr;
      });
    } else if (args.status === 'overdue') {
      const nowMs = now.getTime();
      filtered = tasks.filter(t => {
        if (!t.deadline || t.status === 'completed' || t.status === 'canceled') return false;
        return new Date(t.deadline).getTime() < nowMs;
      });
    }

    if (args.searchKeyword) {
      const kw = String(args.searchKeyword).toLowerCase();
      filtered = filtered.filter(t => t.title.toLowerCase().includes(kw) || t.description.toLowerCase().includes(kw));
    }

    if (filtered.length === 0) {
      return {
        success: true,
        data: [],
        message: '📋 Hiện tại không có công việc nào thỏa mãn tiêu chí tìm kiếm.',
      };
    }

    const listText = filtered
      .slice(0, 10)
      .map((t, idx) => {
        const dlVn = new Date(t.deadline).toLocaleString('vi-VN', {
          timeZone,
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
        });
        return `${idx + 1}. **[${t.priority.toUpperCase()}] ${t.title}**\n   • Trạng thái: \`${t.status}\` | Hạn chót: ${dlVn} [VN]`;
      })
      .join('\n');

    return {
      success: true,
      data: filtered,
      message: `📋 **Danh sách công việc (${filtered.length}):**\n\n${listText}`,
    };
  }

  // -------------------------------------------------------------
  // AI SELF-LEARNING & LONG-TERM MEMORY FUNCTION CALLS
  // -------------------------------------------------------------
  if (name === 'rememberUserFact') {
    const factText = String(args.fact || '').trim();
    if (!factText) {
      return { success: false, message: 'Thiếu nội dung ký ức cần ghi nhớ.' };
    }

    const category = ['preference', 'identity', 'rule', 'workflow', 'domain_knowledge', 'habit'].includes(args.category)
      ? args.category
      : 'preference';

    const existingMemories = await getDbAiMemories();
    const existing = existingMemories.find(m => m.fact.toLowerCase().includes(factText.toLowerCase()) || factText.toLowerCase().includes(m.fact.toLowerCase()));

    let savedFact: AiMemoryFact;
    if (existing) {
      savedFact = await saveDbAiMemory({
        ...existing,
        occurrences: (existing.occurrences || 1) + 1,
        confidence: Math.min(0.99, (existing.confidence || 0.8) + 0.1),
        updatedAt: new Date().toISOString(),
      });
    } else {
      savedFact = await saveDbAiMemory({
        id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        category: category as any,
        fact: factText,
        confidence: 0.95,
        source: 'explicit',
        occurrences: 1,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Auto-update Persona honorifics if the memory dictates how to call user/AI
    const factLower = factText.toLowerCase();
    const personaUpdates: any = {};
    if (factLower.includes('gọi người dùng là') || factLower.includes('gọi tôi là') || factLower.includes('xưng là')) {
      const match = factText.match(/(?:gọi (?:người dùng|tôi) là|gọi là)\s*["']?([^"'\n,.]+)["']?/i);
      if (match && match[1]) {
        personaUpdates.userHonorific = match[1].trim();
      }
    }
    if (factLower.includes('trợ lý xưng là') || factLower.includes('ai xưng là') || factLower.includes('xưng em') || factLower.includes('xưng tôi')) {
      const matchAi = factText.match(/(?:trợ lý xưng là|ai xưng là|xưng là)\s*["']?([^"'\n,.]+)["']?/i);
      if (matchAi && matchAi[1]) {
        personaUpdates.aiHonorific = matchAi[1].trim();
      } else if (factLower.includes('xưng em')) {
        personaUpdates.aiHonorific = 'Em';
      }
    }
    if (Object.keys(personaUpdates).length > 0) {
      await saveDbAiPersonaConfig(personaUpdates);
    }

    const categoryLabels: Record<string, string> = {
      preference: 'Sở thích & Phong cách',
      identity: 'Danh tính cá nhân',
      rule: 'Quy tắc bắt buộc',
      workflow: 'Quy trình làm việc',
      domain_knowledge: 'Chuyên môn trọng tâm',
      habit: 'Thói quen sinh hoạt',
    };

    return {
      success: true,
      data: savedFact,
      message: `🧠 **Đã tiếp thu và khắc sâu vào bộ nhớ dài hạn của AI:**\n\n• **Phân loại:** \`${categoryLabels[savedFact.category] || savedFact.category}\`\n• **Ký ức:** _"${savedFact.fact}"_\n• **Độ tin cậy:** **${Math.round((savedFact.confidence || 0.95) * 100)}%**\n\n_Tôi sẽ tự động áp dụng thông tin này trong tất cả các tương tác tiếp theo!_`,
    };
  }

  if (name === 'forgetUserFact') {
    const memories = await getDbAiMemories();
    let target = memories.find(m => m.id === args.memoryId);

    if (!target && args.factQuery) {
      const q = String(args.factQuery).toLowerCase();
      target = memories.find(m => m.fact.toLowerCase().includes(q));
    }

    if (!target) {
      return {
        success: false,
        message: `⚠️ Không tìm thấy ký ức nào phù hợp với yêu cầu xóa "${args.factQuery || args.memoryId}".`,
      };
    }

    await deleteDbAiMemory(target.id);
    return {
      success: true,
      message: `🗑️ **Đã xóa khỏi bộ nhớ tự học của AI:**\n\n• Ký ức: _"${target.fact}"_`,
    };
  }

  if (name === 'queryMemories') {
    const memories = await getActiveDbAiMemories();
    let filtered = memories;

    if (args.category && args.category !== 'all') {
      filtered = memories.filter(m => m.category === args.category);
    }

    if (filtered.length === 0) {
      return {
        success: true,
        data: [],
        message: '🧠 Hiện tại AI chưa lưu ký ức nào thuộc phân loại này.',
      };
    }

    const memList = filtered.map((m, idx) => `${idx + 1}. **[${m.category.toUpperCase()}]** ${m.fact} _(Tin cậy: ${Math.round(m.confidence * 100)}%, Củng cố: ${m.occurrences} lần)_`).join('\n');

    return {
      success: true,
      data: filtered,
      message: `🧠 **Những điều AI đã tự học và ghi nhớ về bạn (${filtered.length}):**\n\n${memList}`,
    };
  }

  if (name === 'getLiveWeather') {
    const persona = await getDbAiPersonaConfig();
    const defaultLoc = persona.location || 'Bắc Giang';
    const locationArg = args?.location || defaultLoc;
    const isTomorrow = args?.forecastDay === 'tomorrow';
    const weather = await fetchLiveWeather(locationArg, isTomorrow, defaultLoc);

    return {
      success: true,
      data: weather,
      message: weather.summary,
    };
  }

  // Gracefully handle search or other tool queries
  if (['google_search', 'googleSearch', 'web_search', 'search', 'webSearch'].includes(name)) {
    return {
      success: true,
      message: '',
    };
  }

  return {
    success: true,
    message: '',
  };
}
