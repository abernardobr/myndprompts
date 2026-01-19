/**
 * File Sync Store
 *
 * Pinia store for managing file sync state, including folder configurations,
 * indexing status, and search functionality for the File Sync feature.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getProjectFolderRepository } from '@/services/storage/repositories/project-folder.repository';
import { getFileIndexRepository } from '@/services/storage/repositories/file-index.repository';
import type { IProjectFolder, IFileIndexEntry } from '@/services/storage/entities';

/**
 * Active indexing operation state
 */
interface IIndexingOperation {
  operationId: string;
  folderId: string;
  phase: 'scanning' | 'indexing' | 'complete' | 'cancelled' | 'error';
  current: number;
  currentFile?: string;
  error?: string;
}

export const useFileSyncStore = defineStore('fileSync', () => {
  // Check if running in Electron environment
  const isElectron = (): boolean => window?.fileSystemAPI !== undefined;

  // State
  const isInitialized = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const projectFolders = ref<IProjectFolder[]>([]);
  const activeIndexingOperations = ref<Map<string, IIndexingOperation>>(new Map());
  const cleanupFunctions = ref<(() => void)[]>([]);
  const activeWatchers = ref<Map<string, string>>(new Map()); // folderId -> watcherId

  /**
   * Normalize a file name for diacritics-insensitive matching
   */
  function normalizeFileName(fileName: string): string {
    return fileName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  // Computed: check if there's any active indexing
  const hasActiveIndexing = computed(() => activeIndexingOperations.value.size > 0);

  // Computed: overall sync status
  const syncStatus = computed(() => {
    const total = projectFolders.value.length;
    const indexed = projectFolders.value.filter((f) => f.status === 'indexed').length;
    const pending = projectFolders.value.filter((f) => f.status === 'pending').length;
    const indexing = projectFolders.value.filter((f) => f.status === 'indexing').length;
    const errors = projectFolders.value.filter((f) => f.status === 'error').length;
    return {
      total,
      indexed,
      pending,
      indexing,
      errors,
      isUpToDate: total > 0 && indexed === total && errors === 0,
    };
  });

  // Computed: current operation (first active one)
  const currentOperation = computed(() => {
    const ops = Array.from(activeIndexingOperations.value.values());
    return ops.length > 0 ? ops[0] : null;
  });

  /**
   * Initialize the store
   */
  async function initialize(): Promise<void> {
    if (isInitialized.value) return;

    isLoading.value = true;
    try {
      const repo = getProjectFolderRepository();
      projectFolders.value = await repo.getAllFolders();

      // Set up progress listener
      if (isElectron() && window.fileSystemAPI.onIndexProgress !== undefined) {
        const cleanup = window.fileSystemAPI.onIndexProgress(handleIndexProgress);
        cleanupFunctions.value.push(cleanup);
      }

      // Set up file change listener for real-time index updates
      if (isElectron() && window.fileSystemAPI.onFileChange !== undefined) {
        const cleanup = window.fileSystemAPI.onFileChange((event) => {
          void handleFileChange(event);
        });
        cleanupFunctions.value.push(cleanup);
      }

      isInitialized.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to initialize file sync';
      console.error('Failed to initialize file sync store:', err);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Add a new folder to sync for a project
   */
  async function addFolder(
    projectPath: string,
    folderPath: string
  ): Promise<IProjectFolder | null> {
    try {
      const repo = getProjectFolderRepository();

      // Check for duplicate
      const existing = projectFolders.value.find(
        (f) => f.projectPath === projectPath && f.folderPath === folderPath
      );
      if (existing) {
        error.value = 'Folder already added';
        return null;
      }

      const folder = await repo.addFolder(projectPath, folderPath);
      projectFolders.value.push(folder);
      return folder;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to add folder';
      return null;
    }
  }

  /**
   * Remove a folder from sync
   */
  async function removeFolder(folderId: string): Promise<void> {
    try {
      // Stop watching the folder first
      await stopWatching(folderId);

      const folderRepo = getProjectFolderRepository();
      const indexRepo = getFileIndexRepository();

      // Remove all indexed files first
      await indexRepo.removeByProjectFolder(folderId);
      // Remove folder config
      await folderRepo.removeFolder(folderId);

      projectFolders.value = projectFolders.value.filter((f) => f.id !== folderId);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to remove folder';
    }
  }

  /**
   * Start indexing a folder
   */
  async function startIndexing(folderId: string): Promise<void> {
    const folder = projectFolders.value.find((f) => f.id === folderId);
    if (folder === undefined) return;
    if (!isElectron()) return;

    const operationId = crypto.randomUUID();
    activeIndexingOperations.value.set(operationId, {
      operationId,
      folderId,
      phase: 'scanning',
      current: 0,
    });

    try {
      // Update status to indexing
      const folderRepo = getProjectFolderRepository();
      await folderRepo.updateStatus(folderId, 'indexing');
      folder.status = 'indexing';

      // Start indexing via IPC
      const files = await window.fileSystemAPI.startIndexing(folder.folderPath, operationId);

      // Clear existing entries and save new ones
      const indexRepo = getFileIndexRepository();
      await indexRepo.removeByProjectFolder(folderId);

      const entries: IFileIndexEntry[] = files.map((f) => ({
        id: crypto.randomUUID(),
        projectFolderId: folderId,
        fileName: f.fileName,
        normalizedName: f.normalizedName,
        fullPath: f.fullPath,
        relativePath: f.relativePath,
        extension: f.extension,
        size: f.size,
        modifiedAt: new Date(f.modifiedAt),
        indexedAt: new Date(),
      }));

      if (entries.length > 0) {
        await indexRepo.addEntries(entries);
      }

      // Update folder stats
      await folderRepo.updateIndexStats(folderId, entries.length);
      await folderRepo.updateStatus(folderId, 'indexed');

      folder.status = 'indexed';
      folder.fileCount = entries.length;
      folder.lastIndexedAt = new Date();
      folder.errorMessage = undefined;

      // Start watching the folder for changes
      await startWatching(folderId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Indexing failed';

      if (errorMsg !== 'Aborted') {
        const folderRepo = getProjectFolderRepository();
        await folderRepo.updateStatus(folderId, 'error', errorMsg);
        folder.status = 'error';
        folder.errorMessage = errorMsg;
      }
    } finally {
      activeIndexingOperations.value.delete(operationId);
    }
  }

  /**
   * Cancel an active indexing operation
   */
  async function cancelIndexing(operationId: string): Promise<void> {
    if (isElectron()) {
      await window.fileSystemAPI.cancelIndexing(operationId);
    }
    activeIndexingOperations.value.delete(operationId);
  }

  /**
   * Cancel all active indexing operations
   */
  async function cancelAllIndexing(): Promise<void> {
    for (const [operationId] of activeIndexingOperations.value) {
      await cancelIndexing(operationId);
    }
  }

  /**
   * Handle progress updates from main process
   */
  function handleIndexProgress(data: {
    operationId: string;
    phase: string;
    current: number;
    currentFile?: string;
    error?: string;
  }): void {
    const operation = activeIndexingOperations.value.get(data.operationId);
    if (operation !== undefined) {
      operation.phase = data.phase as IIndexingOperation['phase'];
      operation.current = data.current;
      operation.currentFile = data.currentFile;
      operation.error = data.error;
    }
  }

  /**
   * Start watching a folder for file changes
   */
  async function startWatching(folderId: string): Promise<void> {
    const folder = projectFolders.value.find((f) => f.id === folderId);
    if (folder === undefined || activeWatchers.value.has(folderId)) return;
    if (window.fileSystemAPI?.watchPath === undefined) return;

    try {
      const watcherId = await window.fileSystemAPI.watchPath(folder.folderPath, {
        persistent: true,
        ignoreInitial: true,
        depth: 99,
      });
      activeWatchers.value.set(folderId, watcherId);
    } catch (err) {
      console.error('Failed to start watcher for folder:', folderId, err);
    }
  }

  /**
   * Stop watching a specific folder
   */
  async function stopWatching(folderId: string): Promise<void> {
    const watcherId = activeWatchers.value.get(folderId);
    if (watcherId !== undefined && window.fileSystemAPI?.unwatchPath !== undefined) {
      try {
        await window.fileSystemAPI.unwatchPath(watcherId);
      } catch (err) {
        console.error('Failed to stop watcher:', watcherId, err);
      }
      activeWatchers.value.delete(folderId);
    }
  }

  /**
   * Stop all active watchers
   */
  async function stopAllWatchers(): Promise<void> {
    for (const [folderId] of activeWatchers.value) {
      await stopWatching(folderId);
    }
  }

  /**
   * Handle file change events from file watcher
   */
  async function handleFileChange(event: { type: string; path: string }): Promise<void> {
    // Find which folder this file belongs to
    const folder = projectFolders.value.find((f) => event.path.startsWith(f.folderPath + '/'));
    if (folder === undefined || folder.status !== 'indexed') return;

    const indexRepo = getFileIndexRepository();
    const fileName = event.path.split('/').pop() ?? '';

    // Skip common ignored files
    if (fileName.startsWith('.') || fileName === 'node_modules') return;

    // Extract extension safely
    const getExtension = (name: string): string => {
      if (!name.includes('.')) return '';
      const parts = name.split('.');
      const ext = parts.pop();
      return ext !== undefined ? '.' + ext.toLowerCase() : '';
    };

    try {
      switch (event.type) {
        case 'add': {
          // Add new file to index
          const entry: IFileIndexEntry = {
            id: crypto.randomUUID(),
            projectFolderId: folder.id,
            fileName: fileName,
            normalizedName: normalizeFileName(fileName),
            fullPath: event.path,
            relativePath: event.path.slice(folder.folderPath.length + 1),
            extension: getExtension(fileName),
            size: 0,
            modifiedAt: new Date(),
            indexedAt: new Date(),
          };
          await indexRepo.upsertEntry(entry);
          folder.fileCount++;
          break;
        }

        case 'unlink': {
          // Remove file from index
          await indexRepo.removeByPath(event.path);
          folder.fileCount = Math.max(0, folder.fileCount - 1);
          break;
        }

        case 'change': {
          // Update modification time (optional)
          // Could re-index content if needed in the future
          break;
        }
      }
    } catch (err) {
      console.error('Failed to handle file change:', event, err);
    }
  }

  /**
   * Search indexed files
   */
  async function searchFiles(query: string, projectPath?: string): Promise<IFileIndexEntry[]> {
    if (query.trim() === '') return [];

    const indexRepo = getFileIndexRepository();
    const normalizedQuery = query
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    let results: IFileIndexEntry[] = [];

    if (projectPath !== undefined && projectPath !== '') {
      // Search within specific project's folders
      const foldersToSearch = projectFolders.value.filter((f) => f.projectPath === projectPath);
      for (const folder of foldersToSearch) {
        const folderResults = await indexRepo.searchByName(folder.id, normalizedQuery);
        results.push(...folderResults);
      }
    } else {
      // Search all indexed folders
      results = await indexRepo.searchByNameGlobal(normalizedQuery);
    }

    // Sort by relevance
    results.sort((a, b) => {
      const aExact = a.normalizedName === normalizedQuery;
      const bExact = b.normalizedName === normalizedQuery;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      const aStarts = a.normalizedName.startsWith(normalizedQuery);
      const bStarts = b.normalizedName.startsWith(normalizedQuery);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      return a.fileName.localeCompare(b.fileName);
    });

    return results.slice(0, 50);
  }

  /**
   * Start background indexing for pending/stale folders
   */
  async function startBackgroundIndexing(): Promise<void> {
    // Get folders that need indexing
    const foldersToIndex = projectFolders.value.filter((f) => {
      // Index pending folders
      if (f.status === 'pending') return true;

      // Re-index folders with errors
      if (f.status === 'error') return true;

      // Re-index if last indexed more than 24 hours ago
      if (f.status === 'indexed' && f.lastIndexedAt !== undefined) {
        const hoursSinceLastIndex =
          (Date.now() - new Date(f.lastIndexedAt).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastIndex > 24) return true;
      }

      return false;
    });

    // Index sequentially to avoid overwhelming the system
    for (const folder of foldersToIndex) {
      // Check if we've been cancelled (store cleanup)
      if (!isInitialized.value) break;

      try {
        await startIndexing(folder.id);
      } catch (err) {
        console.error('Background indexing failed for folder:', folder.folderPath, err);
      }

      // Small delay between folders
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  /**
   * Get folders for a specific project
   */
  function getFoldersForProject(projectPath: string): IProjectFolder[] {
    return projectFolders.value.filter((f) => f.projectPath === projectPath);
  }

  /**
   * Clear error state
   */
  function clearError(): void {
    error.value = null;
  }

  /**
   * Cleanup on unmount
   */
  function cleanup(): void {
    // Stop all watchers (fire and forget)
    void stopAllWatchers();

    for (const fn of cleanupFunctions.value) {
      fn();
    }
    cleanupFunctions.value = [];
  }

  return {
    // State
    isInitialized,
    isLoading,
    error,
    projectFolders,
    activeIndexingOperations,

    // Computed
    hasActiveIndexing,
    syncStatus,
    currentOperation,

    // Actions
    initialize,
    addFolder,
    removeFolder,
    startIndexing,
    cancelIndexing,
    cancelAllIndexing,
    searchFiles,
    startBackgroundIndexing,
    getFoldersForProject,
    clearError,
    cleanup,
    startWatching,
    stopWatching,
    stopAllWatchers,
  };
});
