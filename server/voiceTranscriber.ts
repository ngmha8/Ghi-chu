import { GoogleGenAI } from '@google/genai';
import { safeGenerateContent } from './geminiHelper.ts';
import { telegramApiFetch } from './telegramHelper.ts';

/**
 * Transcribes any audio buffer (Telegram voice, Web browser microphone recording, etc.)
 * using Gemini Multimodal Audio with robust fallback across models.
 */
export async function transcribeAudioBuffer(
  audioBuffer: Buffer,
  mimeType: string,
  gemini: GoogleGenAI
): Promise<string> {
  const base64Audio = audioBuffer.toString('base64');

  // Normalize MIME types for Gemini
  let normalizedMimeType = mimeType;
  if (mimeType.includes('ogg') || mimeType.includes('oga') || mimeType.includes('opus')) {
    normalizedMimeType = 'audio/ogg';
  } else if (mimeType.includes('webm')) {
    normalizedMimeType = 'audio/webm';
  } else if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
    normalizedMimeType = 'audio/mp4';
  } else if (mimeType.includes('wav')) {
    normalizedMimeType = 'audio/wav';
  } else if (mimeType.includes('mp3') || mimeType.includes('mpeg')) {
    normalizedMimeType = 'audio/mp3';
  }

  const prompt =
    'Bạn là chuyên gia nhận dạng và phiên âm giọng nói tiếng Việt độ chính xác cao. ' +
    'Nhiệm vụ: Lắng nghe kỹ lưỡng tệp âm thanh/tin nhắn thoại này và chuyển đổi thành văn bản tiếng Việt chuẩn ngữ pháp, có dấu đầy đủ, chuẩn xác từng từ (bao gồm cả các câu ngắn 1-3 giây như "hôm nay có việc gì", "thêm việc họp lúc 3h chiều", "chào bạn", v.v.). ' +
    'QUY TẮC: Chỉ xuất ra nguyên văn nội dung câu nói của người dùng. Tuyệt đối không thêm lời giải thích, ghi chú hay chào hỏi dư thừa.';

  try {
    const response = await safeGenerateContent({
      gemini,
      contents: [
        {
          inlineData: {
            mimeType: normalizedMimeType,
            data: base64Audio,
          },
        },
        prompt,
      ],
      models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.7-flash', 'gemini-3.5-flash'],
    });

    let transcribed = (response?.text || '').trim();
    // Clean up any surrounding quotes or markdown artifacts if Gemini wrapped it
    transcribed = transcribed.replace(/^["'“”]+|["'“”]+$/g, '').trim();

    return transcribed;
  } catch (err: any) {
    console.error('[Audio Transcription Error]:', err);
    throw new Error(`Nhận diện giọng nói thất bại: ${err?.message || 'Lỗi xử lý file âm thanh'}`);
  }
}

/**
 * Transcribes a Telegram voice or audio message using Gemini Multimodal Audio
 * with automated retries and multi-model fallback.
 */
export async function transcribeTelegramVoice(
  botToken: string,
  fileId: string,
  gemini: GoogleGenAI
): Promise<string> {
  // 1. Get file path from Telegram
  const fileMeta = await telegramApiFetch(`bot${botToken}/getFile?file_id=${fileId}`, {
    method: 'GET',
    timeoutMs: 10000,
  });

  if (!fileMeta.ok || !fileMeta.result?.file_path) {
    throw new Error(fileMeta.description || fileMeta.error || 'Không lấy được thông tin file âm thanh từ Telegram');
  }

  const filePath = fileMeta.result.file_path;
  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

  // 2. Download audio binary
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let arrayBuffer: ArrayBuffer;
  try {
    const audioRes = await fetch(downloadUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!audioRes.ok) {
      throw new Error(`Tải file âm thanh thất bại: ${audioRes.statusText}`);
    }
    arrayBuffer = await audioRes.arrayBuffer();
  } catch (err: any) {
    clearTimeout(timer);
    throw new Error(`Lỗi tải âm thanh từ Telegram: ${err?.message || err}`);
  }

  const buffer = Buffer.from(arrayBuffer);

  // 3. Determine MIME type
  let mimeType = 'audio/ogg';
  if (filePath.endsWith('.mp3')) mimeType = 'audio/mp3';
  else if (filePath.endsWith('.wav')) mimeType = 'audio/wav';
  else if (filePath.endsWith('.m4a')) mimeType = 'audio/mp4';
  else if (filePath.endsWith('.oga') || filePath.endsWith('.ogg')) mimeType = 'audio/ogg';

  return transcribeAudioBuffer(buffer, mimeType, gemini);
}
