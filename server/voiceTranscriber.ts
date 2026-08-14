import { GoogleGenAI } from '@google/genai';

/**
 * Transcribes a Telegram voice or audio message using Gemini Multimodal Audio
 */
export async function transcribeTelegramVoice(
  botToken: string,
  fileId: string,
  gemini: GoogleGenAI
): Promise<string> {
  try {
    // 1. Get file path from Telegram
    const fileMetaRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    const fileMeta: any = await fileMetaRes.json();
    if (!fileMeta.ok || !fileMeta.result?.file_path) {
      throw new Error(fileMeta.description || 'Không lấy được thông tin file âm thanh từ Telegram');
    }

    const filePath = fileMeta.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

    // 2. Download audio binary
    const audioRes = await fetch(downloadUrl);
    if (!audioRes.ok) {
      throw new Error(`Tải file âm thanh thất bại: ${audioRes.statusText}`);
    }

    const arrayBuffer = await audioRes.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    // 3. Determine MIME type (Telegram voice is typically audio/ogg or audio/oga)
    let mimeType = 'audio/ogg';
    if (filePath.endsWith('.mp3')) mimeType = 'audio/mp3';
    else if (filePath.endsWith('.wav')) mimeType = 'audio/wav';
    else if (filePath.endsWith('.m4a')) mimeType = 'audio/m4a';

    // 4. Multimodal Audio Transcription with Gemini 3.7 Flash
    const prompt = 'Bạn là chuyên gia nhận dạng giọng nói tiếng Việt độ chính xác cao. Hãy chuyển đổi toàn bộ âm thanh trong file ghi âm này thành văn bản tiếng Việt chuẩn ngữ pháp, dấu chấm phẩy rõ ràng. Chỉ trả về nội dung nguyên văn câu nói của người dùng, không thêm lời chào hay giải thích nào khác.';

    const response = await gemini.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: [
        {
          inlineData: {
            mimeType,
            data: base64Audio,
          },
        },
        prompt,
      ],
    });

    const transcribed = (response.text || '').trim();
    return transcribed;
  } catch (err: any) {
    console.error('transcribeTelegramVoice error:', err);
    throw new Error(`Nhận diện giọng nói thất bại: ${err?.message || 'Lỗi xử lý file âm thanh'}`);
  }
}
