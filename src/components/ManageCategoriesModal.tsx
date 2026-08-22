import React, { useState } from 'react';
import { DocumentCategory } from '../types/index.js';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  RotateCcw,
  Tag,
  Briefcase,
  User,
  FileCheck,
  DollarSign,
  Scale,
  FolderKanban,
  FileText,
  Bookmark,
  Archive,
  Layers,
  Sparkles
} from 'lucide-react';
import { DEFAULT_DOCUMENT_CATEGORIES, CATEGORY_COLORS } from '../services/docClassification.js';

interface ManageCategoriesModalProps {
  categories: DocumentCategory[];
  onSaveCategories: (categories: DocumentCategory[]) => void;
  onClose: () => void;
  fileCounts?: Record<string, number>;
}

const AVAILABLE_ICONS = [
  { name: 'Briefcase', label: 'Cặp công tác (Công việc)', component: Briefcase },
  { name: 'User', label: 'Cá nhân', component: User },
  { name: 'FileCheck', label: 'Biểu mẫu / Mẫu đơn', component: FileCheck },
  { name: 'DollarSign', label: 'Tài chính / Tiền tệ', component: DollarSign },
  { name: 'Scale', label: 'Pháp lý / Hợp đồng', component: Scale },
  { name: 'FolderKanban', label: 'Dự án / Quản lý', component: FolderKanban },
  { name: 'FileText', label: 'Tài liệu / Văn bản', component: FileText },
  { name: 'Bookmark', label: 'Đánh dấu quan trọng', component: Bookmark },
  { name: 'Archive', label: 'Lưu trữ / Kho lưu', component: Archive },
  { name: 'Tag', label: 'Nhãn chung', component: Tag },
];

const AVAILABLE_COLORS = [
  { id: 'emerald', name: 'Xanh lá (Emerald)', hex: '#10B981' },
  { id: 'blue', name: 'Xanh dương (Blue)', hex: '#0EA5E9' },
  { id: 'amber', name: 'Vàng hổ phách (Amber)', hex: '#F59E0B' },
  { id: 'teal', name: 'Xanh mòng két (Teal)', hex: '#14B8A6' },
  { id: 'rose', name: 'Đỏ hồng (Rose)', hex: '#F43F5E' },
  { id: 'purple', name: 'Tím (Purple)', hex: '#A855F7' },
  { id: 'indigo', name: 'Xanh chàm (Indigo)', hex: '#6366F1' },
  { id: 'cyan', name: 'Xanh ngọc (Cyan)', hex: '#06B6D4' },
  { id: 'zinc', name: 'Xám bạc (Zinc)', hex: '#71717A' },
];

export const renderCategoryIcon = (iconName?: string, className: string = 'w-4 h-4') => {
  switch (iconName) {
    case 'Briefcase': return <Briefcase className={className} />;
    case 'User': return <User className={className} />;
    case 'FileCheck': return <FileCheck className={className} />;
    case 'DollarSign': return <DollarSign className={className} />;
    case 'Scale': return <Scale className={className} />;
    case 'FolderKanban': return <FolderKanban className={className} />;
    case 'Bookmark': return <Bookmark className={className} />;
    case 'Archive': return <Archive className={className} />;
    case 'Tag': return <Tag className={className} />;
    default: return <FileText className={className} />;
  }
};

export const ManageCategoriesModal: React.FC<ManageCategoriesModalProps> = ({
  categories,
  onSaveCategories,
  onClose,
  fileCounts = {},
}) => {
  const [list, setList] = useState<DocumentCategory[]>(categories);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State for creating or editing
  const [nameInput, setNameInput] = useState('');
  const [colorInput, setColorInput] = useState('emerald');
  const [iconInput, setIconInput] = useState('Briefcase');
  const [descInput, setDescInput] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);

  const startEdit = (cat: DocumentCategory) => {
    setEditingId(cat.id);
    setNameInput(cat.name);
    setColorInput(cat.color || 'emerald');
    setIconInput(cat.icon || 'Briefcase');
    setDescInput(cat.description || '');
    setIsAddingNew(false);
  };

  const startAddNew = () => {
    setEditingId(null);
    setNameInput('');
    setColorInput('emerald');
    setIconInput('Briefcase');
    setDescInput('');
    setIsAddingNew(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nameInput.trim();
    if (!cleanName) return;

    if (isAddingNew) {
      const newId = `cat-${Date.now()}`;
      const newCat: DocumentCategory = {
        id: newId,
        name: cleanName,
        color: colorInput,
        icon: iconInput,
        description: descInput.trim() || undefined,
        isDefault: false,
      };
      const updated = [...list, newCat];
      setList(updated);
      onSaveCategories(updated);
      setIsAddingNew(false);
      setNameInput('');
    } else if (editingId) {
      const updated = list.map(c => {
        if (c.id === editingId) {
          return {
            ...c,
            name: cleanName,
            color: colorInput,
            icon: iconInput,
            description: descInput.trim() || undefined,
          };
        }
        return c;
      });
      setList(updated);
      onSaveCategories(updated);
      setEditingId(null);
    }
  };

  const handleDeleteItem = (id: string) => {
    if (list.length <= 1) {
      alert('Hệ thống cần giữ ít nhất 1 phân loại tài liệu.');
      return;
    }
    const updated = list.filter(c => c.id !== id);
    setList(updated);
    onSaveCategories(updated);
    if (editingId === id) setEditingId(null);
  };

  const handleResetDefaults = () => {
    if (confirm('Bạn có chắc muốn khôi phục danh sách phân loại về mặc định?')) {
      setList(DEFAULT_DOCUMENT_CATEGORIES);
      onSaveCategories(DEFAULT_DOCUMENT_CATEGORIES);
      setIsAddingNew(false);
      setEditingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[#151515] border border-[#2A2A2A] w-full max-w-2xl max-h-[90vh] flex flex-col rounded-sm shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2A2A2A] bg-[#101010]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-[#1A1A1A] border border-[#D4AF37]/30 text-[#D4AF37]">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-editorial-serif font-bold text-white text-base">Quản Lý Phân Loại Tài Liệu</h2>
              <p className="text-xs text-[#888888] italic">Tùy chỉnh linh hoạt các nhóm hồ sơ: Công việc, Cá nhân, Mẫu giấy tờ...</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#888888] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* Top Actions */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={startAddNew}
              className={`px-3.5 py-2 rounded-sm font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow ${
                isAddingNew
                  ? 'bg-[#D4AF37] text-black ring-2 ring-[#D4AF37]/40'
                  : 'bg-[#0C0C0C] hover:bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/40'
              }`}
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>+ Thêm Phân Loại Mới</span>
            </button>

            <button
              onClick={handleResetDefaults}
              className="text-[#888888] hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              title="Khôi phục danh mục mẫu chuẩn"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Khôi phục mặc định</span>
            </button>
          </div>

          {/* Form Create / Edit */}
          {(isAddingNew || editingId) && (
            <form
              onSubmit={handleSaveItem}
              className="p-4 bg-[#0C0C0C] border border-[#D4AF37]/40 rounded-sm space-y-4 animate-in fade-in"
            >
              <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2">
                <span className="text-[#D4AF37] font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {isAddingNew ? 'Tạo Phân Loại Tài Liệu Mới' : 'Chỉnh Sửa Phân Loại'}
                </span>
                <button
                  type="button"
                  onClick={() => { setIsAddingNew(false); setEditingId(null); }}
                  className="text-[#888888] hover:text-white cursor-pointer"
                >
                  ✕ Hủy
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#AAAAAA] font-bold uppercase text-[10px] mb-1">
                    Tên Phân Loại * (Ví dụ: Công việc, Cá nhân, Mẫu giấy tờ)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nhập tên phân loại..."
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="w-full px-3 py-2 bg-[#151515] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-[#AAAAAA] font-bold uppercase text-[10px] mb-1">
                    Mô Tả Ngắn
                  </label>
                  <input
                    type="text"
                    placeholder="Mô tả mục đích sử dụng..."
                    value={descInput}
                    onChange={(e) => setDescInput(e.target.value)}
                    className="w-full px-3 py-2 bg-[#151515] border border-[#2A2A2A] rounded-sm text-[#E0E0E0] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              {/* Color Selection */}
              <div>
                <label className="block text-[#AAAAAA] font-bold uppercase text-[10px] mb-1.5">
                  Màu Sắc Đại Diện
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {AVAILABLE_COLORS.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setColorInput(c.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border transition-all cursor-pointer ${
                        colorInput === c.id
                          ? 'border-[#D4AF37] bg-[#1A1A1A] text-white ring-1 ring-[#D4AF37]'
                          : 'border-[#2A2A2A] bg-[#151515] text-[#AAAAAA] hover:text-white'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.hex }} />
                      <span>{c.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon Selection */}
              <div>
                <label className="block text-[#AAAAAA] font-bold uppercase text-[10px] mb-1.5">
                  Biểu Tượng (Icon)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {AVAILABLE_ICONS.map(ic => {
                    const IconComp = ic.component;
                    return (
                      <button
                        key={ic.name}
                        type="button"
                        onClick={() => setIconInput(ic.name)}
                        className={`flex items-center gap-1.5 p-2 rounded text-[11px] border transition-all cursor-pointer text-left ${
                          iconInput === ic.name
                            ? 'border-[#D4AF37] bg-[#1A1A1A] text-[#D4AF37] font-bold ring-1 ring-[#D4AF37]'
                            : 'border-[#2A2A2A] bg-[#151515] text-[#888888] hover:text-white'
                        }`}
                      >
                        <IconComp className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{ic.label.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2A2A2A]">
                <button
                  type="button"
                  onClick={() => { setIsAddingNew(false); setEditingId(null); }}
                  className="px-3 py-1.5 bg-[#151515] hover:bg-[#1A1A1A] text-[#AAAAAA] hover:text-white border border-[#2A2A2A] rounded-sm cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold uppercase tracking-wider rounded-sm cursor-pointer shadow"
                >
                  {isAddingNew ? 'Lưu Phân Loại Mới' : 'Cập Nhật Thay Đổi'}
                </button>
              </div>
            </form>
          )}

          {/* Existing Categories List */}
          <div className="space-y-2">
            <span className="text-[#888888] font-bold uppercase tracking-wider text-[10px]">
              Danh Sách Phân Loại Hiện Có ({list.length})
            </span>
            <div className="grid grid-cols-1 gap-2">
              {list.map(cat => {
                const colorConfig = CATEGORY_COLORS[cat.color] || CATEGORY_COLORS.zinc;
                const fileCount = fileCounts[cat.id] || fileCounts[cat.name] || 0;

                return (
                  <div
                    key={cat.id}
                    className="p-3 bg-[#0C0C0C] border border-[#2A2A2A] hover:border-[#3A3A3A] rounded-sm flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`p-2 rounded border ${colorConfig.bg} ${colorConfig.text} ${colorConfig.border}`}>
                        {renderCategoryIcon(cat.icon, 'w-4 h-4')}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-white text-xs">{cat.name}</h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded border font-mono ${colorConfig.bg} ${colorConfig.text} ${colorConfig.border}`}>
                            {fileCount} tài liệu
                          </span>
                          {cat.isDefault && (
                            <span className="text-[9px] text-[#666666] border border-[#222222] px-1.5 py-0.2 rounded">
                              Mặc định
                            </span>
                          )}
                        </div>
                        {cat.description && (
                          <p className="text-[11px] text-[#777777] italic truncate mt-0.5">{cat.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(cat)}
                        className="p-1.5 rounded bg-[#151515] hover:bg-[#202020] text-[#AAAAAA] hover:text-[#D4AF37] border border-[#2A2A2A] transition-colors cursor-pointer"
                        title="Chỉnh sửa phân loại này"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(cat.id)}
                        className="p-1.5 rounded bg-[#151515] hover:bg-rose-950/80 text-[#AAAAAA] hover:text-rose-400 border border-[#2A2A2A] transition-colors cursor-pointer"
                        title="Xóa phân loại này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#2A2A2A] bg-[#101010] flex items-center justify-between text-[11px] text-[#888888]">
          <span>💡 Phân loại giúp lọc nhanh tài liệu theo mục đích sử dụng (Công việc, Cá nhân, Mẫu đơn...).</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold uppercase tracking-wider rounded-sm cursor-pointer shadow"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
