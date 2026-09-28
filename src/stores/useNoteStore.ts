import { create } from 'zustand';
import { Note } from '../types/index.js';
import { api } from '../services/api.js';

export interface NoteCreatedToastInfo {
  taskTitle: string;
  noteTitle: string;
}

interface NoteState {
  notes: Note[];
  isLoading: boolean;
  isNoteModalOpen: boolean;
  activeNoteId: string | null;
  selectedTag: string;
  noteCreatedToast: NoteCreatedToastInfo | null;

  // Actions
  setNotes: (notes: Note[]) => void;
  fetchNotes: () => Promise<void>;
  createNote: (noteData: Partial<Note>) => Promise<Note | null>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;

  // Modals & UI triggers
  openNoteModal: () => void;
  closeNoteModal: () => void;
  setActiveNoteId: (id: string | null) => void;
  setSelectedTag: (tag: string) => void;
  setNoteCreatedToast: (toast: NoteCreatedToastInfo | null) => void;
}

const sortNotesList = (notesList: Note[]): Note[] => {
  return [...notesList].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    const timeA = new Date(a.noteDate || a.createdAt || a.updatedAt || 0).getTime();
    const timeB = new Date(b.noteDate || b.createdAt || b.updatedAt || 0).getTime();
    return timeB - timeA;
  });
};

const getInitialCachedNotes = (): Note[] => {
  try {
    const cached = localStorage.getItem('cached_notes');
    return cached ? sortNotesList(JSON.parse(cached)) : [];
  } catch {
    return [];
  }
};

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: getInitialCachedNotes(),
  isLoading: false,
  isNoteModalOpen: false,
  activeNoteId: null,
  selectedTag: 'all',
  noteCreatedToast: null,

  setNotes: (notes) => set({ notes: sortNotesList(notes) }),

  fetchNotes: async () => {
    try {
      set({ isLoading: true });
      const rawNotes = await api.getNotes();
      set({ notes: sortNotesList(rawNotes), isLoading: false });
    } catch (err) {
      console.warn('Error fetching notes from server:', err);
      set({ isLoading: false });
    }
  },

  createNote: async (noteData: Partial<Note>) => {
    const tempId = `temp-note-${Date.now()}`;
    const isoNoteDate = noteData.noteDate || noteData.createdAt || new Date().toISOString();
    const optimisticNote: Note = {
      id: tempId,
      title: noteData.title || 'Ghi chú mới',
      content: noteData.content || '',
      tags: noteData.tags || [],
      linkedTaskIds: noteData.linkedTaskIds || [],
      attachedFileIds: noteData.attachedFileIds || [],
      isPinned: noteData.isPinned ?? false,
      noteDate: isoNoteDate,
      createdAt: isoNoteDate,
      updatedAt: new Date().toISOString(),
    };

    set(state => ({
      notes: sortNotesList([optimisticNote, ...state.notes]),
    }));

    try {
      const created = await api.createNote(noteData);
      set(state => ({
        notes: sortNotesList(state.notes.map(n => (n.id === tempId ? created : n))),
      }));
      return created;
    } catch (err) {
      console.error('Error creating note, rolling back:', err);
      set(state => ({
        notes: state.notes.filter(n => n.id !== tempId),
      }));
      return null;
    }
  },

  updateNote: async (id: string, updates: Partial<Note>) => {
    let previousNote: Note | undefined;
    set(state => {
      previousNote = state.notes.find(n => n.id === id);
      const next = state.notes.map(n => (n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n));
      return { notes: sortNotesList(next) };
    });

    try {
      const updated = await api.updateNote(id, updates);
      set(state => ({
        notes: sortNotesList(state.notes.map(n => (n.id === id ? updated : n))),
      }));
    } catch (err) {
      console.error('Error updating note, rolling back:', err);
      if (previousNote) {
        set(state => ({
          notes: sortNotesList(state.notes.map(n => (n.id === id ? previousNote! : n))),
        }));
      }
    }
  },

  deleteNote: async (id: string) => {
    const previousNotes = get().notes;
    set({ notes: previousNotes.filter(n => n.id !== id) });

    try {
      await api.deleteNote(id);
    } catch (err) {
      console.error('Error deleting note, rolling back:', err);
      set({ notes: previousNotes });
    }
  },

  openNoteModal: () => set({ isNoteModalOpen: true }),
  closeNoteModal: () => set({ isNoteModalOpen: false }),
  setActiveNoteId: (id) => set({ activeNoteId: id }),
  setSelectedTag: (tag) => set({ selectedTag: tag }),
  setNoteCreatedToast: (toast) => set({ noteCreatedToast: toast }),
}));
