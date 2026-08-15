import { GoogleGenAI } from '@google/genai';

export const GEMINI_MODEL_FALLBACK_CHAIN = [
  'gemini-3.7-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
];

export interface SafeGenerateOptions {
  gemini: GoogleGenAI;
  contents: any;
  config?: any;
  models?: string[];
  maxRetriesPerModel?: number;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Executes a Gemini generateContent call with automatic retry on 503/429
 * and seamless fallback across recommended Gemini models.
 */
export async function safeGenerateContent(options: SafeGenerateOptions): Promise<any> {
  const {
    gemini,
    contents,
    config,
    models = GEMINI_MODEL_FALLBACK_CHAIN,
    maxRetriesPerModel = 2
  } = options;

  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
      try {
        const response = await gemini.models.generateContent({
          model,
          contents,
          config,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMessage = err?.message || String(err);
        const isTransient =
          errMessage.includes('503') ||
          errMessage.includes('429') ||
          errMessage.includes('high demand') ||
          errMessage.includes('UNAVAILABLE') ||
          errMessage.includes('RESOURCE_EXHAUSTED') ||
          errMessage.includes('overloaded');

        if (isTransient && attempt < maxRetriesPerModel) {
          // Exponential backoff with small random jitter
          const delayMs = attempt * 400 + Math.floor(Math.random() * 200);
          await wait(delayMs);
          continue;
        }

        // If not transient, or max retries reached for this model, break and try next model
        break;
      }
    }
  }

  throw lastError;
}
