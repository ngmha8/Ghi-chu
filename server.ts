import dns from 'node:dns';
// Force Node.js to resolve IPv4 addresses before IPv6 to avoid ConnectTimeoutError on environments without IPv6 routing
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

// Persistence & Background Services
import { initializeFirestoreData } from './server/firebaseDb.ts';
import { startBackgroundScheduler } from './server/scheduler.ts';
import { startTelegramPollingDaemon } from './server/telegramBotEngine.ts';
import { getTelegramEngineContext } from './server/routes/telegram.ts';
import { UPLOADS_DIR } from './server/aiService.ts';

// Modular Route Controllers
import tasksRouter from './server/routes/tasks.ts';
import notesRouter from './server/routes/notes.ts';
import categoriesRouter from './server/routes/categories.ts';
import filesRouter from './server/routes/files.ts';
import driveServiceAccountRouter from './server/routes/driveServiceAccount.ts';
import telegramRouter from './server/routes/telegram.ts';
import aiRouter from './server/routes/ai.ts';
import securityRouter from './server/routes/security.ts';
import systemRouter from './server/routes/system.ts';

// Ensure data and uploads directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch (e) {}
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body Parsers & Static Assets
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(process.cwd(), 'public')));

// Favicon Explicit Resolvers
app.get('/favicon.svg', (_req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), 'public', 'favicon.svg'));
});

app.get('/favicon.ico', (_req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), 'public', 'favicon.svg'), {
    headers: { 'Content-Type': 'image/svg+xml' },
  });
});

// Initialize Cloud Firestore & Local Backup Synchronization on Boot
initializeFirestoreData().catch(err => {
  console.warn('Firebase background sync warning:', err);
});

// -------------------------------------------------------------
// MOUNT MODULAR API ROUTERS
// -------------------------------------------------------------
app.use('/', systemRouter);
app.use('/api', systemRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/notes', notesRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/files', filesRouter);
app.use('/api/drive-service-account', driveServiceAccountRouter);
app.use('/api/telegram', telegramRouter);
app.use('/api/security', securityRouter);
app.use('/api', aiRouter);

// -------------------------------------------------------------
// VITE SPA MIDDLEWARE & APPLICATION BOOTSTRAP
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);

    // Start background Vietnam timezone scheduler
    startBackgroundScheduler(30000);

    // Start background Telegram polling daemon
    startTelegramPollingDaemon(getTelegramEngineContext()).catch(err => {
      console.warn('[Telegram Polling Daemon] startup notice:', err?.message || err);
    });
  });
}

startServer();
