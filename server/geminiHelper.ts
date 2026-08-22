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
 * Executes a Gemini generateContent call with intelligent multi-model failover,
 * instant 429 quota exhaustion fallback, and tool-compatibility degradation.
 */
export async function safeGenerateContent(options: SafeGenerateOptions): Promise<any> {
  const {
    gemini,
    contents,
    config,
    models = GEMINI_MODEL_FALLBACK_CHAIN,
    maxRetriesPerModel = 1,
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
        const errMessage = (err?.message || String(err)).toLowerCase();
        
        const isQuotaExhausted =
          errMessage.includes('429') ||
          errMessage.includes('quota') ||
          errMessage.includes('resource_exhausted') ||
          errMessage.includes('rate-limit') ||
          errMessage.includes('rate_limit');

        const isOverloaded =
          errMessage.includes('503') ||
          errMessage.includes('unavailable') ||
          errMessage.includes('high demand') ||
          errMessage.includes('overloaded');

        // On 429 quota exhaustion, immediately switch to the next model in the fallback chain
        // without wasting time retrying the exhausted model.
        if (isQuotaExhausted) {
          break;
        }

        // On temporary 503 overload, do a quick jittered retry once
        if (isOverloaded && attempt < maxRetriesPerModel) {
          const delayMs = 300 + Math.floor(Math.random() * 200);
          await wait(delayMs);
          continue;
        }

        // If tool configuration error or parameter unsupported on this model, break to next model or degradation
        break;
      }
    }
  }

  // If all models failed with the provided config (e.g. combined tools not supported or quota across models),
  // try one final graceful pass with basic config if config had complex tools
  if (config && (config.tools || config.toolConfig)) {
    try {
      const basicConfig = {
        ...config,
        tools: undefined,
        toolConfig: undefined,
      };
      for (const fallbackModel of models) {
        try {
          const res = await gemini.models.generateContent({
            model: fallbackModel,
            contents,
            config: basicConfig,
          });
          return res;
        } catch {
          // Continue to next fallback
        }
      }
    } catch {
      // Ignore degradation error, throw original lastError
    }
  }

  throw lastError;
}
