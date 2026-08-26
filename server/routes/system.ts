import { Router, Request, Response } from 'express';
import path from 'path';
import {
  cachedTasks,
  cachedNotes,
  cachedNotificationLogs,
  cachedTelegramConfig,
} from '../firebaseDb.ts';
import { runSchedulerCheck } from '../scheduler.ts';

const router = Router();

// GET /health, /ping, /api/health, /api/ping
router.get(['/health', '/ping'], (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    time: new Date().toISOString(),
    message: 'AI Assistant server is active and running',
  });
});

// GET /api/firebase/status
router.get('/firebase/status', async (req: Request, res: Response) => {
  try {
    res.json({
      status: 'connected',
      provider: 'Firebase Firestore',
      tasksCount: cachedTasks.length,
      notesCount: cachedNotes.length,
      logsCount: cachedNotificationLogs.length,
      telegramConnected: cachedTelegramConfig.isConnected,
      lastSync: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error checking Firebase status' });
  }
});

// GET /api/scheduler/check
router.get('/scheduler/check', async (req: Request, res: Response) => {
  try {
    const result = await runSchedulerCheck();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Scheduler check error' });
  }
});

// GET /api/system/schema
router.get('/system/schema', (req: Request, res: Response) => {
  res.json({
    firestore: `
-- Firebase Firestore Cloud Collections (Realtime Sync & Snapshot Listeners)
1. collection("tasks"): User tasks, priority, deadlines, status, tags, isNotified
2. collection("notes"): User notes, content markdown, pin status
3. collection("config"): Telegram Bot credentials, alert triggers & scheduler rules
4. collection("notifications"): Notification logs and audit trail
`,
    postgresql: `
-- PostgreSQL Schema Definitions
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(20) DEFAULT 'todo',
  is_notified BOOLEAN DEFAULT FALSE
);
`,
    redis: `
-- Redis Data Structures
1. "task_scheduler_queue" (Sorted Set sorted by deadline epoch timestamp)
2. "telegram:webhook_buffer" (List queue for high-throughput bot events)
`,
  });
});

export default router;
