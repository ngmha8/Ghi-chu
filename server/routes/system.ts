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

// GET/HEAD /health, /ping, /cron, /keepalive, /api/health, /api/ping, /api/cron, /api/keepalive
router.all(['/health', '/ping', '/cron', '/keepalive', '/api/health', '/api/ping', '/api/cron', '/api/keepalive'], (_req: Request, res: Response) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Access-Control-Allow-Origin': '*',
  });
  res.status(200).json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    message: 'AI Assistant server is active and running',
  });
});

// GET /api/firebase/status
router.get('/firebase/status', async (req: Request, res: Response) => {
  try {
    res.set({ 'Access-Control-Allow-Origin': '*' });
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

// GET/HEAD /scheduler/check, /api/scheduler/check
router.all(['/scheduler/check', '/api/scheduler/check'], async (_req: Request, res: Response) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Access-Control-Allow-Origin': '*',
  });
  try {
    // Run scheduler check in background and return immediate healthy response to prevent gateway timeout
    const resultPromise = runSchedulerCheck();
    
    // If request completes fast within 800ms, return full result; otherwise return fast acknowledgment
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('timeout'), 800));
    const race = await Promise.race([resultPromise, timeoutPromise]);

    if (race !== 'timeout') {
      res.status(200).json(race);
    } else {
      res.status(200).json({
        status: 'ok',
        acknowledged: true,
        message: 'Scheduler check triggered in background',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err: any) {
    console.warn('[Scheduler Route] Error during check:', err);
    res.status(200).json({ status: 'ok', message: 'Scheduler triggered with fallback', timestamp: new Date().toISOString() });
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
