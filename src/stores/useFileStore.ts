import { create } from 'zustand';
import { DriveFile, DocumentCategory } from '../types/index.js';
import { api } from '../services/api.js';
import {
  fetchCategoriesFromServer,
  syncCategoriesToServer,
  getStoredCategories
} from '../services/docClassification.js';

interface FileState {
  files: DriveFile[];
  categories: DocumentCategory[];
  isLoading: boolean;

  // Actions
  setFiles: (files: DriveFile[]) => void;
  setCategories: (categories: DocumentCategory[]) => void;
  fetchFiles: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  uploadFile: (fileData: Partial<DriveFile>) => Promise<DriveFile | null>;
  updateFile: (id: string, fileData: Partial<DriveFile>) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  saveCategories: (newCategories: DocumentCategory[]) => Promise<void>;
}

const getInitialCachedFiles = (): DriveFile[] => {
  try {
    const cached = localStorage.getItem('cached_files');
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
};

const getInitialCachedCategories = (): DocumentCategory[] => {
  try {
    const cached = localStorage.getItem('cached_categories');
    if (cached) return JSON.parse(cached);
  } catch {}
  return getStoredCategories();
};

export const useFileStore = create<FileState>((set, get) => ({
  files: getInitialCachedFiles(),
  categories: getInitialCachedCategories(),
  isLoading: false,

  setFiles: (files) => set({ files }),
  setCategories: (categories) => set({ categories }),

  fetchFiles: async () => {
    try {
      set({ isLoading: true });
      const files = await api.getFiles();
      set({ files, isLoading: false });
    } catch (err) {
      console.warn('Error fetching files:', err);
      set({ isLoading: false });
    }
  },

  fetchCategories: async () => {
    try {
      const cats = await fetchCategoriesFromServer();
      if (cats && cats.length > 0) {
        set({ categories: cats });
      }
    } catch (err) {
      console.warn('Error fetching categories:', err);
    }
  },

  uploadFile: async (fileData) => {
    try {
      const created = await api.uploadFile(fileData);
      set(s => ({
        files: [created, ...s.files.filter(f => f.id !== created.id)],
      }));
      return created;
    } catch (err) {
      console.error('Error uploading file:', err);
      return null;
    }
  },

  updateFile: async (id, fileData) => {
    try {
      const updated = await api.updateFile(id, fileData);
      set(s => ({
        files: s.files.map(f => (f.id === id ? updated : f)),
      }));
    } catch (err) {
      console.error('Error updating file:', err);
    }
  },

  deleteFile: async (id) => {
    try {
      await api.deleteFile(id);
      set(s => ({
        files: s.files.filter(f => f.id !== id),
      }));
    } catch (err) {
      console.error('Error deleting file:', err);
    }
  },

  saveCategories: async (newCategories) => {
    set({ categories: newCategories });
    try {
      const saved = await syncCategoriesToServer(newCategories);
      set({ categories: saved });
    } catch (err) {
      console.error('Error syncing categories:', err);
    }
  },
}));
