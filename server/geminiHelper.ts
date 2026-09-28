import { GoogleGenAI } from '@google/genai';

/**
 * Standard, production-grade Gemini fallback chain.
 * Prioritizes high-throughput, low-latency models officially available in the Google GenAI production API.
 * 1. gemini-3.6-flash: Ultra-fast, highly reliable, recommended replacement for flash
 * 2. gemini-3.8-flash: Official state-of-the-art flash model
 * 3. gemini-flash-latest: Official rolling alias from Google
 * 4. gemini-3.5-flash-lite / gemini-3.1-flash-lite: Lightweight high-efficiency models
 */
export const GEMINI_MODEL_FALLBACK_CHAIN = [
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

/**
 * Normalizes model names to currently active production endpoints in Google GenAI API.
 * Google GenAI API returns 404/NOT_FOUND for deprecated models (e.g. gemini-2.5-flash is retired
 * in favor of gemini-3.6-flash, and gemini-2.5-flash-lite is retired in favor of gemini-3.5-flash-lite).
 * This mapping eliminates wasteful 404 network round-trips.
 */
export function normalizeModelAlias(model: string): string {
  const clean = model.trim().toLowerCase();
  if (clean === 'gemini-2.5-flash' || clean === 'gemini-3.7-flash' || clean === 'gemini-3.5-flash') {
    return 'gemini-3.6-flash';
  }
  if (clean === 'gemini-2.5-flash-lite') {
    return 'gemini-3.5-flash-lite';
  }
  if (clean === 'gemini-2.5-pro') {
    return 'gemini-3.6-flash';
  }
  return model;
}

export interface SafeGenerateOptions {
  gemini: GoogleGenAI;
  contents: any;
  config?: any;
  models?: string[];
  maxRetriesPerModel?: number;
}

export interface SafeGenerateStreamOptions {
  gemini: GoogleGenAI;
  contents: any;
  config?: any;
  models?: string[];
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Executes a Gemini generateContentStream call with intelligent multi-model failover.
 * Returns the native async iterable stream directly without buffering.
 */
export async function safeGenerateContentStream(options: SafeGenerateStreamOptions): Promise<{
  stream: AsyncIterable<any>;
  modelUsed: string;
}> {
  const {
    gemini,
    contents,
    config,
    models = GEMINI_MODEL_FALLBACK_CHAIN,
  } = options;

  let lastError: any = null;

  // Normalize models and deduplicate to avoid repeated tries on the same target model
  const resolvedModels = Array.from(new Set(models.map(normalizeModelAlias)));

  for (const model of resolvedModels) {
    try {
      const responseStream = await gemini.models.generateContentStream({
        model,
        contents,
        config,
      });
      return { stream: responseStream, modelUsed: model };
    } catch (err: any) {
      lastError = err;
      const errMessage = (err?.message || String(err)).toLowerCase();
      console.warn(`[safeGenerateContentStream] Model ${model} failed, trying next:`, errMessage);
      continue;
    }
  }

  // Graceful fallback: try basic config without tools if complex tools caused failure
  if (config && (config.tools || config.toolConfig)) {
    const basicConfig = {
      ...config,
      tools: undefined,
      toolConfig: undefined,
    };
    for (const fallbackModel of resolvedModels) {
      try {
        const responseStream = await gemini.models.generateContentStream({
          model: fallbackModel,
          contents,
          config: basicConfig,
        });
        return { stream: responseStream, modelUsed: fallbackModel };
      } catch {
        // try next
      }
    }
  }

  throw lastError;
}

/**
 * Executes a Gemini generateContent call with intelligent multi-model failover,
 * instant 429 quota exhaustion fallback, and graceful tool-compatibility degradation.
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

  // Normalize models and deduplicate
  const resolvedModels = Array.from(new Set(models.map(normalizeModelAlias)));

  for (const model of resolvedModels) {
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
        if (isQuotaExhausted) {
          break;
        }

        // On temporary 503 overload, do a quick jittered retry once
        if (isOverloaded && attempt < maxRetriesPerModel) {
          const delayMs = 300 + Math.floor(Math.random() * 200);
          await wait(delayMs);
          continue;
        }

        // If tool configuration error or parameter unsupported on this model, break to next model
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
      for (const fallbackModel of resolvedModels) {
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
