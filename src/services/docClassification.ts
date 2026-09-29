import { DocumentCategory } from '../types/index.js';
import { api } from './api.js';

export const DEFAULT_DOCUMENT_CATEGORIES: DocumentCategory[] = [
  {
    id: 'unclassified',
    name: 'Chưa xác định',
    color: 'zinc',
    icon: 'HelpCircle',
    description: 'Tài liệu mới tải lên chờ phân loại cụ thể',
    isDefault: true,
  },
  {
    id: 'work',
    name: 'Công việc',
    color: 'emerald',
    icon: 'Briefcase',
    description: 'Tài liệu dự án, công việc chuyên môn, quy trình công ty',
    isDefault: true,
  },
  {
    id: 'personal',
    name: 'Cá nhân',
    color: 'blue',
    icon: 'User',
    description: 'Giấy tờ tùy thân, tài liệu học tập, hồ sơ cá nhân',
    isDefault: true,
  },
  {
    id: 'templates',
    name: 'Mẫu giấy tờ',
    color: 'amber',
    icon: 'FileCheck',
    description: 'Biểu mẫu, tờ trình, mẫu đơn, template báo cáo chuẩn',
    isDefault: true,
  },
  {
    id: 'finance',
    name: 'Tài chính',
    color: 'teal',
    icon: 'DollarSign',
    description: 'Báo cáo tài chính, hóa đơn, bảng kê chi phí, ngân sách',
    isDefault: true,
  },
  {
    id: 'legal',
    name: 'Hợp đồng',
    color: 'rose',
    icon: 'Scale',
    description: 'Hợp đồng lao động, hợp đồng kinh tế, văn bản pháp lý',
    isDefault: true,
  },
  {
    id: 'projects',
    name: 'Dự án',
    color: 'purple',
    icon: 'FolderKanban',
    description: 'Kế hoạch triển khai, thuyết minh dự án, sơ đồ kiến trúc',
    isDefault: true,
  },
  {
    id: 'other',
    name: 'Khác',
    color: 'zinc',
    icon: 'FileText',
    description: 'Tài liệu tổng hợp hoặc chưa phân nhóm cụ thể',
    isDefault: true,
  },
];

const STORAGE_KEY = 'ai_app_doc_categories_v1';

export function getStoredCategories(): DocumentCategory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DOCUMENT_CATEGORIES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Ensure 'unclassified' exists in category list
      const hasUnclassified = parsed.some(c => c.id === 'unclassified' || c.name.toLowerCase() === 'chưa xác định');
      if (!hasUnclassified) {
        return [DEFAULT_DOCUMENT_CATEGORIES[0], ...parsed];
      }
      return parsed;
    }
    return DEFAULT_DOCUMENT_CATEGORIES;
  } catch (e) {
    return DEFAULT_DOCUMENT_CATEGORIES;
  }
}

export function saveStoredCategories(categories: DocumentCategory[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  } catch (e) {
    console.warn('Could not save document categories to localStorage:', e);
  }
}

export async function fetchCategoriesFromServer(): Promise<DocumentCategory[]> {
  try {
    const serverCategories = await api.getCategories();
    if (Array.isArray(serverCategories) && serverCategories.length > 0) {
      saveStoredCategories(serverCategories);
      return serverCategories;
    }
  } catch (e) {
    console.warn('Could not fetch categories from server, using local cache:', e);
  }
  return getStoredCategories();
}

export async function syncCategoriesToServer(categories: DocumentCategory[]): Promise<DocumentCategory[]> {
  saveStoredCategories(categories);
  try {
    const saved = await api.saveCategories(categories);
    saveStoredCategories(saved);
    return saved;
  } catch (e) {
    console.warn('Could not save categories to server:', e);
    return categories;
  }
}

export function resolveCategory(
  classificationIdOrName?: string,
  categories: DocumentCategory[] = DEFAULT_DOCUMENT_CATEGORIES
): DocumentCategory {
  if (!classificationIdOrName) {
    return categories.find(c => c.id === 'unclassified' || c.name.toLowerCase() === 'chưa xác định') || categories.find(c => c.id === 'other') || DEFAULT_DOCUMENT_CATEGORIES[0];
  }

  const trimmed = classificationIdOrName.trim();

  // 1. Direct ID match
  const matchById = categories.find(c => c.id === trimmed);
  if (matchById) return matchById;

  // 2. Case-insensitive Name match
  const matchByName = categories.find(c => c.name.toLowerCase() === trimmed.toLowerCase());
  if (matchByName) return matchByName;

  // 3. Normalized ID match
  const matchByNormalizedId = categories.find(c => c.id.toLowerCase() === trimmed.toLowerCase());
  if (matchByNormalizedId) return matchByNormalizedId;

  // 4. If ID is raw timestamp format (e.g. cat-1787642812780) and no custom name found in categories,
  // check if we can format nicely or fallback gracefully
  let displayName = trimmed;
  if (/^cat-\d+$/i.test(trimmed)) {
    // If it's a technical ID but unmapped, try checking if there's any newly created custom category or show clean label
    displayName = 'Phân loại mới';
  }

  return {
    id: trimmed,
    name: displayName,
    color: 'zinc',
    icon: 'FileText',
    description: 'Phân loại tài liệu',
  };
}

export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; activeBg: string; activeText: string }> = {
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800/60',
    activeBg: 'bg-emerald-600 dark:bg-emerald-500',
    activeText: 'text-white dark:text-black',
  },
  blue: {
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-400',
    border: 'border-sky-200 dark:border-sky-800/60',
    activeBg: 'bg-sky-600 dark:bg-sky-500',
    activeText: 'text-white dark:text-black',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-800 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800/60',
    activeBg: 'bg-amber-600 dark:bg-amber-500',
    activeText: 'text-white dark:text-black',
  },
  teal: {
    bg: 'bg-teal-50 dark:bg-teal-950/40',
    text: 'text-teal-700 dark:text-teal-400',
    border: 'border-teal-200 dark:border-teal-800/60',
    activeBg: 'bg-teal-600 dark:bg-teal-500',
    activeText: 'text-white dark:text-black',
  },
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-800/60',
    activeBg: 'bg-rose-600 dark:bg-rose-500',
    activeText: 'text-white dark:text-black',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800/60',
    activeBg: 'bg-purple-600 dark:bg-purple-500',
    activeText: 'text-white dark:text-black',
  },
  indigo: {
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-400',
    border: 'border-indigo-200 dark:border-indigo-800/60',
    activeBg: 'bg-indigo-600 dark:bg-indigo-500',
    activeText: 'text-white dark:text-black',
  },
  cyan: {
    bg: 'bg-cyan-50 dark:bg-cyan-950/40',
    text: 'text-cyan-700 dark:text-cyan-400',
    border: 'border-cyan-200 dark:border-cyan-800/60',
    activeBg: 'bg-cyan-600 dark:bg-cyan-500',
    activeText: 'text-white dark:text-black',
  },
  zinc: {
    bg: 'bg-slate-100 dark:bg-zinc-800/60',
    text: 'text-slate-700 dark:text-zinc-300',
    border: 'border-slate-200 dark:border-zinc-700',
    activeBg: 'bg-slate-700 dark:bg-zinc-300',
    activeText: 'text-white dark:text-black',
  },
};
