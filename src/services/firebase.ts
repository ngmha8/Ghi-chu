import { Task, Note, DriveFile, TelegramConfig, NotificationLog } from '../types/index.ts';

// Clean interface stubs - data is synced over Express API with 0 background gRPC errors
export function subscribeTasks(_onUpdate: (tasks: Task[]) => void): () => void {
  return () => {};
}

export function subscribeNotes(_onUpdate: (notes: Note[]) => void): () => void {
  return () => {};
}

export function subscribeNotifications(_onUpdate: (logs: NotificationLog[]) => void): () => void {
  return () => {};
}

export function subscribeTelegramConfig(_onUpdate: (config: TelegramConfig) => void): () => void {
  return () => {};
}

export function subscribeFiles(_onUpdate: (files: DriveFile[]) => void): () => void {
  return () => {};
}
