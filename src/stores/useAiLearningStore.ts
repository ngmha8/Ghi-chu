import { create } from 'zustand';
import {
  AiMemoryFact,
  AiLearningInsight,
  AiLearningStats
} from '../types/index.js';
import { api } from '../services/api.js';

interface AiLearningState {
  aiMemories: AiMemoryFact[];
  aiInsights: AiLearningInsight[];
  aiStats: AiLearningStats | null;
  isLoading: boolean;

  setAiMemories: (memories: AiMemoryFact[]) => void;
  setAiInsights: (insights: AiLearningInsight[]) => void;
  setAiStats: (stats: AiLearningStats | null) => void;
  refreshAiLearningData: () => Promise<void>;
}

export const useAiLearningStore = create<AiLearningState>((set) => ({
  aiMemories: [],
  aiInsights: [],
  aiStats: null,
  isLoading: false,

  setAiMemories: (aiMemories) => set({ aiMemories }),
  setAiInsights: (aiInsights) => set({ aiInsights }),
  setAiStats: (aiStats) => set({ aiStats }),

  refreshAiLearningData: async () => {
    try {
      set({ isLoading: true });
      const [mems, ins, stats] = await Promise.all([
        api.getAiMemories().catch(() => []),
        api.getAiInsights().catch(() => []),
        api.getAiLearningStats().catch(() => null),
      ]);
      set({
        aiMemories: mems,
        aiInsights: ins,
        aiStats: stats,
        isLoading: false,
      });
    } catch (e) {
      console.warn('Error refreshing AI learning data:', e);
      set({ isLoading: false });
    }
  },
}));
