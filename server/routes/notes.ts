import { Router, Request, Response } from 'express';
import {
  getDbNotes,
  saveDbNote,
  deleteDbNote,
  queryDbNotes,
  getDbNoteById,
} from '../firebaseDb.ts';
import type { Note } from '../../src/types/index.ts';

const router = Router();

// GET /api/notes (supports filter queries: isPinned, tag, search)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { isPinned, tag, search } = req.query;
    if (isPinned !== undefined || tag || search) {
      const filtered = queryDbNotes({
        isPinned: isPinned === 'true' ? true : isPinned === 'false' ? false : undefined,
        tag: tag as string,
        search: search as string,
      });
      return res.json(filtered);
    }
    const notes = await getDbNotes();
    res.json(notes);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error fetching notes' });
  }
});

// GET /api/notes/:id (O(1) indexed lookup)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const note = getDbNoteById(req.params.id);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(note);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error fetching note' });
  }
});

// POST /api/notes
router.post('/', async (req: Request, res: Response) => {
  try {
    const newNote: Note = {
      id: req.body.id || `note-${Date.now()}`,
      title: req.body.title || 'Ghi chú mới',
      content: req.body.content || '',
      tags: req.body.tags || [],
      linkedTaskIds: req.body.linkedTaskIds || [],
      attachedFileIds: req.body.attachedFileIds || [],
      isPinned: req.body.isPinned || false,
      createdAt: req.body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const saved = await saveDbNote(newNote);
    res.status(201).json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error creating note' });
  }
});

// PUT /api/notes/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const noteId = req.params.id;
    const existing = getDbNoteById(noteId) || (await getDbNotes()).find(n => n.id === noteId);
    if (!existing) {
      return res.status(404).json({ error: 'Note not found' });
    }
    const updatedNote: Note = {
      ...existing,
      ...req.body,
      id: noteId,
      updatedAt: new Date().toISOString(),
    };
    const saved = await saveDbNote(updatedNote);
    res.json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error updating note' });
  }
});

// DELETE /api/notes/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const noteId = req.params.id;
    await deleteDbNote(noteId);
    res.json({ success: true, id: noteId });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error deleting note' });
  }
});

export default router;
