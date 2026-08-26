import { Router, Request, Response } from 'express';
import {
  getDbCategories,
  saveDbCategories,
  saveDbCategory,
  deleteDbCategory,
} from '../firebaseDb.ts';
import type { DocumentCategory } from '../../src/types/index.ts';

const router = Router();

// GET /api/categories
router.get('/', async (req: Request, res: Response) => {
  try {
    const categories = await getDbCategories();
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error fetching categories' });
  }
});

// POST /api/categories (supports array batch or single category)
router.post('/', async (req: Request, res: Response) => {
  try {
    if (Array.isArray(req.body)) {
      const savedList = await saveDbCategories(req.body);
      return res.json(savedList);
    }
    const newCat: DocumentCategory = {
      id: req.body.id || `cat-${Date.now()}`,
      name: req.body.name || 'Phân loại mới',
      color: req.body.color || 'emerald',
      icon: req.body.icon || 'Tag',
      description: req.body.description || '',
      isDefault: req.body.isDefault ?? false,
    };
    const saved = await saveDbCategory(newCat);
    res.status(201).json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error saving category' });
  }
});

// PUT /api/categories/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const catId = req.params.id;
    const currentCats = await getDbCategories();
    const existing = currentCats.find(c => c.id === catId);
    const updated: DocumentCategory = {
      ...(existing || { id: catId, color: 'emerald', icon: 'Tag', isDefault: false, name: 'Phân loại' }),
      ...req.body,
      id: catId,
    };
    const saved = await saveDbCategory(updated);
    res.json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error updating category' });
  }
});

// DELETE /api/categories/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const catId = req.params.id;
    await deleteDbCategory(catId);
    res.json({ success: true, id: catId });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error deleting category' });
  }
});

export default router;
