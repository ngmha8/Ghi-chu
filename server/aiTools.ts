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
  getDbTelegramConfig
} from './firebaseDb.ts';
import { Task, Note, DriveFile } from '../src/types/index.ts';

// 1. Function Declarations for Gemini Tool Calling
export const aiFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: 'createTask',
    description: 'Tạo mới một công việc (Task) với tiêu đề, thời hạn (deadline ISO hoặc chuỗi giờ Việt Nam), độ ưu tiên (low, medium, high), ghi chú mô tả và tags.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: 'Tiêu đề công việc cần làm, ví dụ: "Họp báo cáo quý 3", "Gửi email cho khách hàng A"',
        },
        deadline: {
          type: Type.STRING,
          description: 'Thời hạn hoàn thành định dạng ISO 8601 (YYYY-MM-DDTHH:mm:ssZ hoặc YYYY-MM-DDTHH:mm) hoặc chuỗi ngày giờ tương đối (ví dụ: "chiều mai 15h", "2026-08-25T14:30:00").',
        },
        priority: {
          type: Type.STRING,
          enum: ['low', 'medium', 'high'],
          description: 'Mức độ ưu tiên của công việc (mặc định: medium)',
        },
        description: {
          type: Type.STRING,
          description: 'Mô tả chi tiết nội dung công việc (nếu có)',
        },
        tags: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Các nhãn phân loại, ví dụ: ["Công việc", "Khẩn", "Dự án A"]',
        },
        reminderOffsetMinutes: {
          type: Type.NUMBER,
          description: 'Số phút nhắc nhở trước deadline (mặc định: 15)',
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
          description: 'Từ khóa hoặc tên công việc cần hoàn thành nếu không có ID, ví dụ: "nộp báo cáo"',
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
    description: 'Tạo một ghi chú cá nhân mới (Note) để lưu trữ ý tưởng, tài liệu, snippet, mật khẩu nháp hoặc thông tin quan trọng.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: 'Tiêu đề ghi chú',
        },
        content: {
          type: Type.STRING,
          description: 'Nội dung chi tiết của ghi chú (hỗ trợ Markdown)',
        },
        tags: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Danh sách tags/nhãn',
        },
        isPinned: {
          type: Type.BOOLEAN,
          description: 'Có ghim ghi chú lên đầu danh sách hay không',
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
    description: 'Tra cứu danh sách tài liệu/tệp tin (Files/Google Drive) theo nhóm phân loại (Công việc, Cá nhân, Hợp đồng, Tài chính, Dự án, Mẫu đơn), định dạng hoặc từ khóa.',
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
];

/**
 * Smart relative date parser strictly bound to Vietnam Timezone (Asia/Ho_Chi_Minh / UTC+7)
 */
export function parseRelativeDate(text: string, baseDate: Date = new Date(), timeZone: string = 'Asia/Ho_Chi_Minh'): string {
  // Extract current date in Vietnam timezone
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

  // Parse specific explicit hour (e.g., "15h", "15:30", "3h chiều", "8h sáng", "9h tối")
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
    
    // If deadline is a natural language expression or missing, parse relative to Vietnam time
    if (!deadlineStr || !deadlineStr.includes('T') || isNaN(Date.parse(deadlineStr))) {
      deadlineStr = parseRelativeDate(deadlineStr || 'ngày mai 17h', new Date(), timeZone);
    } else {
      // Ensure ISO string validity
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
      message: `✅ Đã tạo thành công công việc: "${saved.title}" (Hạn chót: ${deadlineVnStr} [UTC+7], Ưu tiên: ${saved.priority.toUpperCase()})`,
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
        message: `⚠️ Không tìm thấy công việc phù hợp để hoàn thành với từ khóa "${args.taskQuery || args.taskId}".`,
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
      message: `🎉 Đã đánh dấu hoàn thành công việc: "${updated.title}"!`,
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
      message: `🗑️ Đã xóa công việc: "${target.title}".`,
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
      message: `📝 Đã lưu ghi chú mới: "${saved.title}" (Tags: ${saved.tags.join(', ')})`,
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
        message: `⚠️ Không tìm thấy ghi chú nào phù hợp để xóa với từ khóa "${args.noteQuery || args.noteId}".`,
      };
    }

    await deleteDbNote(target.id);
    return {
      success: true,
      message: `🗑️ Đã xóa ghi chú: "${target.title}".`,
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
    }

    if (filtered.length === 0) {
      return {
        success: true,
        data: [],
        message: '📝 Không tìm thấy ghi chú nào phù hợp với yêu cầu.',
      };
    }

    const listText = filtered
      .slice(0, 8)
      .map((n, idx) => {
        const pinBadge = n.isPinned ? '📌 ' : '';
        const snippet = n.content.length > 100 ? `${n.content.slice(0, 100)}...` : n.content;
        return `${idx + 1}. ${pinBadge}**${n.title}**\n   • Tags: [${(n.tags || []).join(', ')}]\n   • Nội dung: _${snippet}_`;
      })
      .join('\n\n');

    return {
      success: true,
      data: filtered,
      message: `📝 **Danh sách ghi chú (${filtered.length}):**\n\n${listText}`,
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
    }

    if (filtered.length === 0) {
      return {
        success: true,
        data: [],
        message: '📂 Không tìm thấy tài liệu nào phù hợp trong kho lưu trữ.',
      };
    }

    const listText = filtered
      .slice(0, 10)
      .map((f, idx) => {
        const driveBadge = f.isSyncedToDrive ? '☁️ [Drive]' : '💾 [Cục bộ]';
        const linkStr = f.webViewLink ? ` | [Mở Drive](${f.webViewLink})` : '';
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
    const todayStr = formatter.format(now); // e.g. "2026-08-23" in Vietnam

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

  // Handle search or external query tools gracefully
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
