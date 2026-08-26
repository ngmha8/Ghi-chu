import { Router, Request, Response } from 'express';
import {
  getDbTasks,
  saveDbTask,
  deleteDbTask,
  queryDbTasks,
  getDbTaskById,
} from '../firebaseDb.ts';
import type { Task } from '../../src/types/index.ts';

const router = Router();

// GET /api/tasks (supports filter queries: status, priority, tag, search)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, priority, tag, search } = req.query;
    if (status || priority || tag || search) {
      const filtered = queryDbTasks({
        status: status as string,
        priority: priority as string,
        tag: tag as string,
        search: search as string,
      });
      return res.json(filtered);
    }
    const tasks = await getDbTasks();
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error fetching tasks' });
  }
});

// GET /api/tasks/:id (O(1) indexed lookup)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const task = getDbTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error fetching task' });
  }
});

// POST /api/tasks
router.post('/', async (req: Request, res: Response) => {
  try {
    const newTask: Task = {
      id: req.body.id || `task-${Date.now()}`,
      title: req.body.title || 'Công việc mới',
      description: req.body.description || '',
      deadline: req.body.deadline || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      priority: req.body.priority || 'medium',
      status: req.body.status || 'todo',
      tags: req.body.tags || [],
      recurring: req.body.recurring || { type: 'none' },
      attachedFileIds: req.body.attachedFileIds || [],
      reminderOffsetMinutes: req.body.reminderOffsetMinutes ?? 15,
      isNotified: false,
      createdAt: req.body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const saved = await saveDbTask(newTask);
    res.status(201).json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error creating task' });
  }
});

// PUT /api/tasks/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const taskId = req.params.id;
    const existing = getDbTaskById(taskId) || (await getDbTasks()).find(t => t.id === taskId);
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const updatedTask: Task = {
      ...existing,
      ...req.body,
      id: taskId,
      updatedAt: new Date().toISOString(),
    };
    const saved = await saveDbTask(updatedTask);
    res.json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error updating task' });
  }
});

// PATCH /api/tasks/:id/toggle (Quick status toggling)
router.patch('/:id/toggle', async (req: Request, res: Response) => {
  try {
    const taskId = req.params.id;
    const existing = getDbTaskById(taskId) || (await getDbTasks()).find(t => t.id === taskId);
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }
    existing.status = existing.status === 'completed' ? 'todo' : 'completed';
    existing.updatedAt = new Date().toISOString();
    const saved = await saveDbTask(existing);
    res.json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error toggling task' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const taskId = req.params.id;
    await deleteDbTask(taskId);
    res.json({ success: true, id: taskId });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error deleting task' });
  }
});

export default router;
