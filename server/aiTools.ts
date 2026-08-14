import { Type, FunctionDeclaration } from '@google/genai';
import {
  getDbTasks,
  saveDbTask,
  deleteDbTask,
  getDbNotes,
  saveDbNote,
  deleteDbNote
} from './firebaseDb.ts';
import { Task, Note } from '../src/types/index.ts';

// 1. Function Declarations for Gemini Tool Calling
export const aiFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: 'createTask',
    description: 'Tạo mới một công việc (Task) với tiêu đề, thời hạn (deadline ISO hoặc datetime), độ ưu tiên (low, medium, high), ghi chú mô tả và tags.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: 'Tiêu đề công việc cần làm, ví dụ: "Họp báo cáo quý 3", "Gửi email cho khách hàng A"',
        },
        deadline: {
          type: Type.STRING,
          description: 'Thời hạn hoàn thành định dạng ISO 8601 (YYYY-MM-DDTHH:mm:ssZ hoặc YYYY-MM-DDTHH:mm). Ví dụ: 2026-08-15T15:00:00Z',
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
    name: 'queryTasks',
    description: 'Tra cứu danh sách công việc theo trạng thái (todo, in_progress, completed) hoặc theo ngày/từ khóa.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: {
          type: Type.STRING,
          enum: ['all', 'pending', 'completed', 'today'],
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

// Helper to compute a smart future deadline if user says e.g. "ngày mai lúc 3h chiều"
export function parseRelativeDate(text: string): string {
  const now = new Date();
  const lower = text.toLowerCase();
  
  if (lower.includes('ngày mai') || lower.includes('mai')) {
    now.setDate(now.getDate() + 1);
  } else if (lower.includes('ngày kia')) {
    now.setDate(now.getDate() + 2);
  } else if (lower.includes('tuần sau')) {
    now.setDate(now.getDate() + 7);
  }

  // Parse hour if mentioned
  const hourMatch = lower.match(/(\d{1,2})\s*(h|giờ|pm|am|:)/i);
  if (hourMatch) {
    let h = parseInt(hourMatch[1], 10);
    if (lower.includes('chiều') || lower.includes('tối') || lower.includes('pm')) {
      if (h < 12) h += 12;
    }
    now.setHours(h, 0, 0, 0);
  } else {
    // Default to 17:00
    now.setHours(17, 0, 0, 0);
  }

  return now.toISOString();
}

// 2. Dispatcher for tool invocations
export async function executeAiFunctionCall(name: string, args: any): Promise<{ success: boolean; data?: any; message: string }> {
  console.log(`🤖 AI Tool Executed: [${name}] with args:`, args);

  if (name === 'createTask') {
    let deadlineStr = args.deadline;
    if (!deadlineStr || isNaN(Date.parse(deadlineStr))) {
      deadlineStr = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
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
    return {
      success: true,
      data: saved,
      message: `✅ Đã tạo thành công công việc: "${saved.title}" (Hạn chót: ${new Date(saved.deadline).toLocaleString('vi-VN')}, Ưu tiên: ${saved.priority.toUpperCase()})`,
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

  if (name === 'queryTasks') {
    const tasks = await getDbTasks();
    let filtered = tasks;

    if (args.status === 'pending') {
      filtered = tasks.filter(t => t.status !== 'completed' && t.status !== 'canceled');
    } else if (args.status === 'completed') {
      filtered = tasks.filter(t => t.status === 'completed');
    } else if (args.status === 'today') {
      const todayStr = new Date().toISOString().split('T')[0];
      filtered = tasks.filter(t => t.deadline.startsWith(todayStr) && t.status !== 'completed');
    }

    if (args.searchKeyword) {
      const kw = String(args.searchKeyword).toLowerCase();
      filtered = filtered.filter(t => t.title.toLowerCase().includes(kw) || t.description.toLowerCase().includes(kw));
    }

    return {
      success: true,
      data: filtered,
      message: `Tìm thấy ${filtered.length} công việc phù hợp.`,
    };
  }

  return {
    success: false,
    message: `Không tìm thấy hàm xử lý cho tool: ${name}`,
  };
}
