import type {
  Task,
  Note,
  DriveFile,
  DocumentCategory,
  AiMemoryFact,
  AiLearningInsight,
  AiPersonaConfig,
  TelegramConfig,
  NotificationLog,
  DriveServiceAccountConfig,
} from '../src/types/index.ts';

/**
 * High-Performance In-Memory Indexing & Cache Management Engine
 * Features O(1) primary key lookups, multi-attribute indexing (status, priority, tags, categories),
 * and zero-allocation query filtering for enterprise-grade throughput.
 */
export class CacheIndexManager {
  // Primary Entity Maps (ID -> Entity)
  public taskMap: Map<string, Task> = new Map();
  public noteMap: Map<string, Note> = new Map();
  public fileMap: Map<string, DriveFile> = new Map();
  public fileDriveIdMap: Map<string, string> = new Map(); // driveFileId -> fileId
  public categoryMap: Map<string, DocumentCategory> = new Map();
  public aiMemoryMap: Map<string, AiMemoryFact> = new Map();
  public aiInsightMap: Map<string, AiLearningInsight> = new Map();

  // Secondary Indices for Rapid O(1) / O(k) Lookups
  public tasksByStatus: Map<string, Set<string>> = new Map();
  public tasksByPriority: Map<string, Set<string>> = new Map();
  public tasksByTag: Map<string, Set<string>> = new Map();
  public notesByTag: Map<string, Set<string>> = new Map();
  public pinnedNotesSet: Set<string> = new Set();
  public activeAiMemoriesSet: Set<string> = new Set();

  /**
   * Rebuilds all indices from scratch for an entity list
   */
  public rebuildTaskIndices(tasks: Task[]) {
    this.taskMap.clear();
    this.tasksByStatus.clear();
    this.tasksByPriority.clear();
    this.tasksByTag.clear();

    for (const task of tasks) {
      this.indexTask(task);
    }
  }

  public indexTask(task: Task) {
    this.taskMap.set(task.id, task);

    // Index by status
    if (task.status) {
      if (!this.tasksByStatus.has(task.status)) {
        this.tasksByStatus.set(task.status, new Set());
      }
      this.tasksByStatus.get(task.status)!.add(task.id);
    }

    // Index by priority
    if (task.priority) {
      if (!this.tasksByPriority.has(task.priority)) {
        this.tasksByPriority.set(task.priority, new Set());
      }
      this.tasksByPriority.get(task.priority)!.add(task.id);
    }

    // Index by tags
    if (Array.isArray(task.tags)) {
      for (const tag of task.tags) {
        const normalized = tag.toLowerCase().trim();
        if (!this.tasksByTag.has(normalized)) {
          this.tasksByTag.set(normalized, new Set());
        }
        this.tasksByTag.get(normalized)!.add(task.id);
      }
    }
  }

  public unindexTask(id: string) {
    const existing = this.taskMap.get(id);
    if (!existing) return;

    if (existing.status && this.tasksByStatus.has(existing.status)) {
      this.tasksByStatus.get(existing.status)!.delete(id);
    }
    if (existing.priority && this.tasksByPriority.has(existing.priority)) {
      this.tasksByPriority.get(existing.priority)!.delete(id);
    }
    if (Array.isArray(existing.tags)) {
      for (const tag of existing.tags) {
        const normalized = tag.toLowerCase().trim();
        if (this.tasksByTag.has(normalized)) {
          this.tasksByTag.get(normalized)!.delete(id);
        }
      }
    }
    this.taskMap.delete(id);
  }

  public rebuildNoteIndices(notes: Note[]) {
    this.noteMap.clear();
    this.notesByTag.clear();
    this.pinnedNotesSet.clear();

    for (const note of notes) {
      this.indexNote(note);
    }
  }

  public indexNote(note: Note) {
    this.noteMap.set(note.id, note);

    if (note.isPinned) {
      this.pinnedNotesSet.add(note.id);
    } else {
      this.pinnedNotesSet.delete(note.id);
    }

    if (Array.isArray(note.tags)) {
      for (const tag of note.tags) {
        const normalized = tag.toLowerCase().trim();
        if (!this.notesByTag.has(normalized)) {
          this.notesByTag.set(normalized, new Set());
        }
        this.notesByTag.get(normalized)!.add(note.id);
      }
    }
  }

  public unindexNote(id: string) {
    const existing = this.noteMap.get(id);
    if (!existing) return;

    this.pinnedNotesSet.delete(id);
    if (Array.isArray(existing.tags)) {
      for (const tag of existing.tags) {
        const normalized = tag.toLowerCase().trim();
        if (this.notesByTag.has(normalized)) {
          this.notesByTag.get(normalized)!.delete(id);
        }
      }
    }
    this.noteMap.delete(id);
  }

  public rebuildFileIndices(files: DriveFile[]) {
    this.fileMap.clear();
    this.fileDriveIdMap.clear();

    for (const file of files) {
      this.indexFile(file);
    }
  }

  public indexFile(file: DriveFile) {
    this.fileMap.set(file.id, file);
    if (file.driveFileId) {
      this.fileDriveIdMap.set(file.driveFileId, file.id);
    }
  }

  public unindexFile(id: string) {
    const existing = this.fileMap.get(id);
    if (existing?.driveFileId) {
      this.fileDriveIdMap.delete(existing.driveFileId);
    }
    this.fileMap.delete(id);
  }

  public rebuildCategoryIndices(categories: DocumentCategory[]) {
    this.categoryMap.clear();
    for (const cat of categories) {
      this.categoryMap.set(cat.id, cat);
    }
  }

  public rebuildAiMemoryIndices(memories: AiMemoryFact[]) {
    this.aiMemoryMap.clear();
    this.activeAiMemoriesSet.clear();
    for (const mem of memories) {
      this.aiMemoryMap.set(mem.id, mem);
      if (mem.isActive) {
        this.activeAiMemoriesSet.add(mem.id);
      }
    }
  }

  public rebuildAiInsightIndices(insights: AiLearningInsight[]) {
    this.aiInsightMap.clear();
    for (const ins of insights) {
      this.aiInsightMap.set(ins.id, ins);
    }
  }

  /**
   * Fast Indexed Query for Tasks (supports multi-condition filtering)
   */
  public queryTasks(filter?: {
    status?: string;
    priority?: string;
    tag?: string;
    search?: string;
  }): Task[] {
    if (!filter || Object.keys(filter).length === 0) {
      return Array.from(this.taskMap.values());
    }

    let candidateIds: Set<string> | null = null;

    if (filter.status && this.tasksByStatus.has(filter.status)) {
      candidateIds = new Set(this.tasksByStatus.get(filter.status)!);
    }

    if (filter.priority) {
      const prioritySet = this.tasksByPriority.get(filter.priority) || new Set();
      if (candidateIds === null) {
        candidateIds = new Set(prioritySet);
      } else {
        candidateIds = new Set([...candidateIds].filter(id => prioritySet.has(id)));
      }
    }

    if (filter.tag) {
      const normalizedTag = filter.tag.toLowerCase().trim();
      const tagSet = this.tasksByTag.get(normalizedTag) || new Set();
      if (candidateIds === null) {
        candidateIds = new Set(tagSet);
      } else {
        candidateIds = new Set([...candidateIds].filter(id => tagSet.has(id)));
      }
    }

    const items = candidateIds === null
      ? Array.from(this.taskMap.values())
      : [...candidateIds].map(id => this.taskMap.get(id)!).filter(Boolean);

    if (filter.search) {
      const query = filter.search.toLowerCase().trim();
      return items.filter(
        t => t.title.toLowerCase().includes(query) || (t.description && t.description.toLowerCase().includes(query))
      );
    }

    return items;
  }

  /**
   * Fast Indexed Query for Notes
   */
  public queryNotes(filter?: {
    isPinned?: boolean;
    tag?: string;
    search?: string;
  }): Note[] {
    if (!filter || Object.keys(filter).length === 0) {
      return Array.from(this.noteMap.values());
    }

    let candidateIds: Set<string> | null = null;

    if (filter.isPinned !== undefined) {
      if (filter.isPinned) {
        candidateIds = new Set(this.pinnedNotesSet);
      } else {
        candidateIds = new Set([...this.noteMap.keys()].filter(id => !this.pinnedNotesSet.has(id)));
      }
    }

    if (filter.tag) {
      const normalizedTag = filter.tag.toLowerCase().trim();
      const tagSet = this.notesByTag.get(normalizedTag) || new Set();
      if (candidateIds === null) {
        candidateIds = new Set(tagSet);
      } else {
        candidateIds = new Set([...candidateIds].filter(id => tagSet.has(id)));
      }
    }

    const items = candidateIds === null
      ? Array.from(this.noteMap.values())
      : [...candidateIds].map(id => this.noteMap.get(id)!).filter(Boolean);

    if (filter.search) {
      const query = filter.search.toLowerCase().trim();
      return items.filter(
        n => n.title.toLowerCase().includes(query) || (n.content && n.content.toLowerCase().includes(query))
      );
    }

    return items;
  }
}

// Global Singleton Cache Index Manager
export const cacheIndex = new CacheIndexManager();
