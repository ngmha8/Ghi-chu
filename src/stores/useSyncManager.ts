import { useEffect } from 'react';
import { useTaskStore } from './useTaskStore.js';
import { useNoteStore } from './useNoteStore.js';
import { useFileStore } from './useFileStore.js';
import { useSystemStore } from './useSystemStore.js';
import { useAiLearningStore } from './useAiLearningStore.js';
import { api } from '../services/api.js';
import { fetchCategoriesFromServer } from '../services/docClassification.js';
import {
  subscribeTasks,
  subscribeNotes,
  subscribeFiles,
  subscribeCategories,
  subscribeNotifications,
  subscribeTelegramConfig,
  subscribeAiMemories,
  subscribeAiInsights
} from '../services/firebase.js';
import {
  isSessionUnlocked,
  updateActivityTimestamp,
  getPinSettings
} from '../services/pinSecurity.js';

export function useSyncManager() {
  const setTasks = useTaskStore(s => s.setTasks);
  const setNotes = useNoteStore(s => s.setNotes);
  const setFiles = useFileStore(s => s.setFiles);
  const setCategories = useFileStore(s => s.setCategories);
  const setTelegramConfig = useSystemStore(s => s.setTelegramConfig);
  const setNotificationLogs = useSystemStore(s => s.setNotificationLogs);
  const addNotificationLog = useSystemStore(s => s.addNotificationLog);
  const setIsUnlocked = useSystemStore(s => s.setIsUnlocked);
  const checkPinStatus = useSystemStore(s => s.checkPinStatus);
  const setAiMemories = useAiLearningStore(s => s.setAiMemories);
  const setAiInsights = useAiLearningStore(s => s.setAiInsights);
  const setAiStats = useAiLearningStore(s => s.setAiStats);

  useEffect(() => {
    let isMounted = true;
    let retryTimer: any = null;

    async function loadData(retryAttempt = 0) {
      try {
        const results = await Promise.allSettled([
          api.getTasks(),
          api.getNotes(),
          api.getFiles(),
          api.getTelegramConfig(),
          fetchCategoriesFromServer(),
          api.getAiMemories().catch(() => []),
          api.getAiInsights().catch(() => []),
          api.getAiLearningStats().catch(() => null),
        ]);

        if (!isMounted) return;

        let needsRetry = false;

        // Tasks
        if (results[0].status === 'fulfilled') {
          setTasks(results[0].value);
        } else {
          needsRetry = true;
        }

        // Notes
        if (results[1].status === 'fulfilled') {
          setNotes(results[1].value);
        } else {
          needsRetry = true;
        }

        // Files
        if (results[2].status === 'fulfilled') {
          setFiles(results[2].value);
        }

        // Telegram Config & Notification Logs
        if (results[3].status === 'fulfilled') {
          setTelegramConfig(results[3].value.config);
          setNotificationLogs(results[3].value.logs);
        }

        // Categories
        if (results[4].status === 'fulfilled' && results[4].value && results[4].value.length > 0) {
          setCategories(results[4].value);
        }

        // AI Memories
        if (results[5].status === 'fulfilled' && Array.isArray(results[5].value) && results[5].value.length > 0) {
          setAiMemories(results[5].value);
        }

        // AI Insights
        if (results[6].status === 'fulfilled' && Array.isArray(results[6].value) && results[6].value.length > 0) {
          setAiInsights(results[6].value);
        }

        // AI Stats
        if (results[7].status === 'fulfilled' && results[7].value) {
          setAiStats(results[7].value);
        }

        if (needsRetry && retryAttempt < 3) {
          retryTimer = setTimeout(() => {
            if (isMounted) loadData(retryAttempt + 1);
          }, 2000 * (retryAttempt + 1));
        }
      } catch (err) {
        console.warn('Initial data load attempt error (fallback active):', err);
        if (retryAttempt < 3) {
          retryTimer = setTimeout(() => {
            if (isMounted) loadData(retryAttempt + 1);
          }, 2500);
        }
      }
    }

    loadData();

    // Re-fetch when online
    const handleOnline = () => {
      loadData(0);
    };
    window.addEventListener('online', handleOnline);

    // Sync PIN configuration from server
    checkPinStatus();

    // 1. Subscribe to Real-time Firestore Listeners
    const unsubTasks = subscribeTasks((liveTasks) => {
      if (liveTasks && liveTasks.length > 0) {
        setTasks(liveTasks);
      }
    });

    const unsubNotes = subscribeNotes((liveNotes) => {
      if (liveNotes && liveNotes.length > 0) {
        setNotes(liveNotes);
      }
    });

    const unsubCategories = subscribeCategories((liveCats) => {
      if (liveCats && liveCats.length > 0) {
        setCategories(liveCats);
      }
    });

    const unsubFiles = subscribeFiles((liveFiles) => {
      if (liveFiles && liveFiles.length > 0) {
        setFiles(liveFiles);
      }
    });

    const unsubNotifs = subscribeNotifications((liveLogs) => {
      if (liveLogs && liveLogs.length > 0) {
        setNotificationLogs(liveLogs);
      }
    });

    const unsubConfig = subscribeTelegramConfig((liveConfig) => {
      if (liveConfig) {
        setTelegramConfig(liveConfig);
      }
    });

    const unsubMemories = subscribeAiMemories((liveMems) => {
      if (liveMems && liveMems.length > 0) {
        setAiMemories(liveMems);
      }
    });

    const unsubInsights = subscribeAiInsights((liveIns) => {
      if (liveIns && liveIns.length > 0) {
        setAiInsights(liveIns);
      }
    });

    // 2. Cron Scheduler Background Check every 30s
    const cronInterval = setInterval(async () => {
      try {
        const checkRes = await api.checkScheduler();
        if (checkRes.alerts && checkRes.alerts.length > 0) {
          checkRes.alerts.forEach((alert: any) => addNotificationLog(alert));
        }
      } catch (err) {
        // Silent catch for background checks
      }
    }, 30000);

    // User Activity & Auto-Lock Monitor
    const handleUserActivity = () => {
      updateActivityTimestamp();
    };

    window.addEventListener('mousedown', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity, { passive: true });

    // Check auto-lock every 15 seconds
    const lockCheckInterval = setInterval(() => {
      const pinSettings = getPinSettings();
      if (pinSettings.isEnabled && pinSettings.autolockMinutes > 0) {
        if (!isSessionUnlocked()) {
          setIsUnlocked(false);
        }
      }
    }, 15000);

    return () => {
      isMounted = false;
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener('online', handleOnline);
      unsubTasks();
      unsubNotes();
      unsubCategories();
      unsubFiles();
      unsubNotifs();
      unsubConfig();
      unsubMemories();
      unsubInsights();
      clearInterval(cronInterval);
      clearInterval(lockCheckInterval);
      window.removeEventListener('mousedown', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
    };
  }, [
    setTasks,
    setNotes,
    setFiles,
    setCategories,
    setTelegramConfig,
    setNotificationLogs,
    addNotificationLog,
    setIsUnlocked,
    checkPinStatus,
    setAiMemories,
    setAiInsights,
    setAiStats
  ]);
}
