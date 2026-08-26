import { Router, Request, Response } from 'express';
import {
  getDbTasks,
  getDbNotes,
  getDbTelegramConfig,
  addDbNotificationLog,
  getDbAiPersonaConfig,
  saveDbAiPersonaConfig,
  getDbAiLearningStats,
  getDbAiMemories,
  saveDbAiMemory,
  deleteDbAiMemory,
  getDbAiInsights,
  clearConversationHistory,
} from '../firebaseDb.ts';
import { getGeminiClient, processAiChat } from '../aiService.ts';
import { generateDailyBriefing } from '../dailyBriefing.ts';
import { transcribeAudioBuffer } from '../voiceTranscriber.ts';
import { runAutonomousCognitiveReflection } from '../aiLearningEngine.ts';
import { sendTelegramMessage, TelegramInlineKeyboard } from '../telegramHelper.ts';
import { searchSemanticDocuments, syncAndVectorizeAllDocuments } from '../embeddingService.ts';
import { runProactiveRiskCheck } from '../proactiveRiskDetector.ts';
import type { AiMemoryFact, NotificationLog } from '../../src/types/index.ts';

const router = Router();

// POST /api/chat
router.post('/chat', async (req: Request, res: Response) => {
  const { message, enableSearch, sessionId = 'web_user_session', history = [] } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message text is required.' });
  }
  const result = await processAiChat(message, enableSearch, sessionId, history);
  res.json(result);
});

// POST /api/chat/stream (SSE Streaming)
router.post('/chat/stream', async (req: Request, res: Response) => {
  const { message, enableSearch, sessionId = 'web_user_session', history = [] } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message text is required.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const sendSse = (event: string, payload: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const result = await processAiChat(message, enableSearch, sessionId, history);
    const reply = result.reply || '';

    const chunkSize = 24;
    for (let i = 0; i < reply.length; i += chunkSize) {
      const piece = reply.slice(i, i + chunkSize);
      sendSse('chunk', { text: piece });
      await new Promise(r => setTimeout(r, 15));
    }

    sendSse('done', {
      reply: result.reply,
      groundingSources: result.groundingSources,
      retrievedContext: result.retrievedContext,
    });
  } catch (err: any) {
    console.error('[Chat Streaming Error]:', err);
    sendSse('error', { error: err?.message || 'Lỗi xử lý phản hồi AI' });
  } finally {
    res.end();
  }
});

// POST /api/chat/clear
router.post('/chat/clear', (req: Request, res: Response) => {
  const { sessionId = 'web_user_session' } = req.body;
  clearConversationHistory(sessionId);
  res.json({ success: true, message: `Cleared memory for session ${sessionId}` });
});

// POST /api/briefing/generate
router.post('/briefing/generate', async (req: Request, res: Response) => {
  const type = (req.body.type === 'evening' ? 'evening' : 'morning') as 'morning' | 'evening';
  const sendToTelegram = req.body.sendToTelegram !== false;
  const ai = getGeminiClient();
  const tasks = await getDbTasks();
  const notes = await getDbNotes();
  const telegramConfig = await getDbTelegramConfig();

  try {
    const briefing = await generateDailyBriefing(type, ai, tasks, notes);

    let delivered = false;
    if (sendToTelegram && telegramConfig.botToken && telegramConfig.chatId) {
      const keyboard: TelegramInlineKeyboard = [
        [
          { text: '📋 Xem việc hôm nay', callback_data: 'cmd:today' },
          { text: '📋 Tất cả việc', callback_data: 'cmd:tasks' },
        ],
        [
          { text: '🌤️ Thời tiết', callback_data: 'cmd:weather' },
          { text: '📝 Ghi chú', callback_data: 'cmd:notes' }
        ]
      ];
      delivered = await sendTelegramMessage(telegramConfig.botToken, telegramConfig.chatId, briefing.reportText, keyboard);
    }

    const log: NotificationLog = {
      id: `notif-${Date.now()}-briefing`,
      title: briefing.title,
      message: briefing.reportText.slice(0, 140) + '...',
      channel: 'telegram',
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
    await addDbNotificationLog(log);

    res.json({ success: true, briefing, delivered, log });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Lỗi tạo bản tin AI Daily Briefing' });
  }
});

// POST /api/voice/transcribe
router.post('/voice/transcribe', async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType = 'audio/webm' } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: 'Thiếu dữ liệu âm thanh (audioBase64).' });
    }

    const buffer = Buffer.from(audioBase64, 'base64');
    const ai = getGeminiClient();
    const transcribedText = await transcribeAudioBuffer(buffer, mimeType, ai);

    res.json({
      success: true,
      text: transcribedText,
    });
  } catch (err: any) {
    console.error('API voice transcribe error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Lỗi nhận diện âm thanh',
    });
  }
});

// POST /api/voice/process-ai
router.post('/voice/process-ai', async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType = 'audio/webm', enableSearch = true, sessionId = 'web_voice' } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: 'Thiếu dữ liệu âm thanh (audioBase64).' });
    }

    const buffer = Buffer.from(audioBase64, 'base64');
    const ai = getGeminiClient();
    const transcribedText = await transcribeAudioBuffer(buffer, mimeType, ai);

    if (!transcribedText || transcribedText.trim().length === 0) {
      return res.json({
        success: false,
        error: 'Không nhận diện được giọng nói trong bản ghi âm.',
      });
    }

    const aiResult = await processAiChat(transcribedText, enableSearch, sessionId);

    res.json({
      success: true,
      transcript: transcribedText,
      reply: aiResult.reply,
      groundingSources: aiResult.groundingSources || [],
    });
  } catch (err: any) {
    console.error('API voice process-ai error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Lỗi xử lý âm thanh AI',
    });
  }
});

// GET /api/ai/persona & POST /api/ai/persona
router.get('/ai/persona', async (req: Request, res: Response) => {
  try {
    const config = await getDbAiPersonaConfig();
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ai/persona', async (req: Request, res: Response) => {
  try {
    const updated = await saveDbAiPersonaConfig(req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// AI Long-term Self-Learning routes
router.get('/ai/learning/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getDbAiLearningStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/ai/learning/memories', async (req: Request, res: Response) => {
  try {
    const memories = await getDbAiMemories();
    res.json(memories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ai/learning/memories', async (req: Request, res: Response) => {
  try {
    const { fact, category = 'preference', confidence = 0.95 } = req.body;
    if (!fact || typeof fact !== 'string') {
      return res.status(400).json({ error: 'Nội dung sự thật/quy tắc (fact) là bắt buộc.' });
    }

    const newMemory: AiMemoryFact = {
      id: req.body.id || `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      category: ['preference', 'identity', 'rule', 'workflow', 'domain_knowledge', 'habit'].includes(category)
        ? category
        : 'preference',
      fact: fact.trim(),
      confidence: Number(confidence) || 0.95,
      source: req.body.source || 'explicit',
      occurrences: Number(req.body.occurrences) || 1,
      isActive: req.body.isActive !== false,
      createdAt: req.body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await saveDbAiMemory(newMemory);
    res.json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/ai/learning/memories/:id', async (req: Request, res: Response) => {
  try {
    await deleteDbAiMemory(req.params.id);
    res.json({ success: true, message: 'Đã xóa ký ức khỏi bộ nhớ dài hạn.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/ai/learning/memories/:id/toggle', async (req: Request, res: Response) => {
  try {
    const memories = await getDbAiMemories();
    const target = memories.find(m => m.id === req.params.id);
    if (!target) {
      return res.status(404).json({ error: 'Không tìm thấy ký ức.' });
    }

    target.isActive = !target.isActive;
    target.updatedAt = new Date().toISOString();
    await saveDbAiMemory(target);
    res.json(target);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/ai/learning/insights', async (req: Request, res: Response) => {
  try {
    const insights = await getDbAiInsights();
    res.json(insights);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ai/learning/reflect', async (req: Request, res: Response) => {
  try {
    const aiClient = getGeminiClient();
    const result = await runAutonomousCognitiveReflection(aiClient);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/ai/semantic-search
router.post('/ai/semantic-search', async (req: Request, res: Response) => {
  try {
    const { query, topK = 5, threshold = 0.35, type = 'all' } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Nội dung tìm kiếm (query) là bắt buộc.' });
    }

    const results = await searchSemanticDocuments(query, {
      topK: Number(topK) || 5,
      threshold: Number(threshold) || 0.35,
      type: ['all', 'notes', 'files'].includes(type) ? type : 'all',
    });

    res.json({
      success: true,
      query,
      count: results.length,
      results,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/ai/proactive-check (Manual trigger for proactive risk detection)
router.post('/ai/proactive-check', async (req: Request, res: Response) => {
  try {
    const report = await runProactiveRiskCheck();
    res.json({ success: true, report });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/ai/vector-sync (Manual trigger to re-vectorize notes and files)
router.post('/ai/vector-sync', async (req: Request, res: Response) => {
  try {
    const totalVectors = await syncAndVectorizeAllDocuments();
    res.json({ success: true, totalVectors });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
