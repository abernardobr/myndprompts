/**
 * Prompt Store
 *
 * Manages prompt state including loaded prompts, content cache, and file operations.
 * Integrates with the file system service for persistence.
 */

import { defineStore } from 'pinia';
import { ref, computed, shallowRef } from 'vue';
import { getPromptFileService } from '@/services/file-system';
import { getRecentFilesRepository } from '@/services/storage';
import { useUIStore } from '@/stores/uiStore';
import type { IPromptFile, IFileWatcherEvent } from '@/services/file-system/types';
import type { IRecentFile } from '@/services/storage';

/**
 * Prompt content cache entry
 */
interface IPromptCache {
  prompt: IPromptFile;
  originalContent: string;
  currentContent: string;
  isDirty: boolean;
}

export const usePromptStore = defineStore('prompts', () => {
  // Check if running in Electron environment
  const isElectron = () => typeof window !== 'undefined' && !!window.fileSystemAPI;

  // Service instances
  const promptService = getPromptFileService();
  const recentFilesRepository = getRecentFilesRepository();

  // State
  const isInitialized = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Prompt cache - keyed by file path
  const promptCache = shallowRef<Map<string, IPromptCache>>(new Map());

  /**
   * Generic file content cache entry (for non-markdown files like code files)
   */
  interface IFileCache {
    originalContent: string;
    currentContent: string;
    isDirty: boolean;
  }

  // Generic file cache - for code/text files that aren't prompts
  const fileCache = shallowRef<Map<string, IFileCache>>(new Map());

  // Recent files
  const recentFiles = ref<IRecentFile[]>([]);

  // All prompts list (for explorer)
  const allPrompts = ref<IPromptFile[]>([]);

  // File watcher cleanup
  let fileChangeCleanup: (() => void) | null = null;

  // Getters
  const loadedPromptPaths = computed(() => Array.from(promptCache.value.keys()));

  const hasUnsavedPrompts = computed(() => {
    for (const cache of promptCache.value.values()) {
      if (cache.isDirty) return true;
    }
    return false;
  });

  const unsavedPromptPaths = computed(() => {
    const paths: string[] = [];
    for (const [path, cache] of promptCache.value.entries()) {
      if (cache.isDirty) paths.push(path);
    }
    return paths;
  });

  /**
   * Get all favorite prompts
   */
  const favoritePrompts = computed(() => {
    return allPrompts.value.filter((p) => p.metadata.isFavorite);
  });

  // Actions

  /**
   * Initialize the store and file service
   */
  async function initialize(): Promise<void> {
    if (isInitialized.value) return;

    try {
      isLoading.value = true;
      error.value = null;

      // Initialize the prompt file service
      await promptService.initialize();

      // Load recent files
      await refreshRecentFiles();

      // Set up file change listener
      fileChangeCleanup = promptService.onFileChange('promptStore', handleFileChange);

      isInitialized.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to initialize prompt store';
      console.error('Failed to initialize prompt store:', err);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Clean up resources
   */
  async function cleanup(): Promise<void> {
    if (fileChangeCleanup) {
      fileChangeCleanup();
      fileChangeCleanup = null;
    }

    await promptService.cleanup();
    promptCache.value.clear();
    isInitialized.value = false;
  }

  /**
   * Handle file change events from the watcher
   */
  function handleFileChange(event: IFileWatcherEvent): void {
    const { type, path } = event;

    if (type === 'change') {
      // File was modified externally - mark for reload
      const cached = promptCache.value.get(path);
      if (cached && !cached.isDirty) {
        // Auto-reload if no unsaved changes
        void reloadPrompt(path);
      }
    } else if (type === 'unlink') {
      // File was deleted - remove from cache
      promptCache.value.delete(path);
    }

    // Refresh all prompts list
    void refreshAllPrompts();
  }

  /**
   * Refresh the recent files list
   */
  async function refreshRecentFiles(): Promise<void> {
    try {
      // Clean up files that no longer exist on disk
      await recentFilesRepository.removeNonExistentFiles();
      recentFiles.value = await recentFilesRepository.getRecentFiles(10);
    } catch (err) {
      console.error('Failed to refresh recent files:', err);
    }
  }

  /**
   * Refresh all prompts list
   */
  async function refreshAllPrompts(): Promise<void> {
    try {
      allPrompts.value = await promptService.listPrompts();
    } catch (err) {
      console.error('Failed to refresh prompts list:', err);
    }
  }

  /**
   * Load a prompt by file path
   */
  async function loadPrompt(filePath: string): Promise<IPromptFile> {
    // Check cache first
    const cached = promptCache.value.get(filePath);
    if (cached) {
      return cached.prompt;
    }

    if (!isElectron()) {
      throw new Error('Loading prompts is only available in the desktop app');
    }

    try {
      isLoading.value = true;
      error.value = null;

      const prompt = await promptService.loadPrompt(filePath);

      // Add to cache
      const newCache = new Map(promptCache.value);
      newCache.set(filePath, {
        prompt,
        originalContent: prompt.content,
        currentContent: prompt.content,
        isDirty: false,
      });
      promptCache.value = newCache;

      // Add to recent files
      await recentFilesRepository.addRecentFile(filePath, prompt.fileName, 'prompt');
      await refreshRecentFiles();

      return prompt;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load prompt';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Reload a prompt from disk (discarding any changes)
   */
  async function reloadPrompt(filePath: string): Promise<IPromptFile> {
    if (!isElectron()) {
      throw new Error('Reloading prompts is only available in the desktop app');
    }

    try {
      const prompt = await promptService.loadPrompt(filePath);

      // Update cache
      const newCache = new Map(promptCache.value);
      newCache.set(filePath, {
        prompt,
        originalContent: prompt.content,
        currentContent: prompt.content,
        isDirty: false,
      });
      promptCache.value = newCache;

      return prompt;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to reload prompt';
      throw err;
    }
  }

  /**
   * Get prompt content from cache
   */
  function getPromptContent(filePath: string): string | undefined {
    return promptCache.value.get(filePath)?.currentContent;
  }

  /**
   * Get cached prompt
   */
  function getCachedPrompt(filePath: string): IPromptFile | undefined {
    return promptCache.value.get(filePath)?.prompt;
  }

  /**
   * Update prompt content in cache (marks as dirty)
   */
  function updatePromptContent(filePath: string, content: string): void {
    const cached = promptCache.value.get(filePath);
    if (!cached) return;

    const isDirty = content !== cached.originalContent;

    const newCache = new Map(promptCache.value);
    newCache.set(filePath, {
      ...cached,
      currentContent: content,
      isDirty,
    });
    promptCache.value = newCache;
  }

  /**
   * Check if a prompt has unsaved changes
   */
  function isPromptDirty(filePath: string): boolean {
    return promptCache.value.get(filePath)?.isDirty ?? false;
  }

  /**
   * Save a prompt to disk
   */
  async function savePrompt(filePath: string): Promise<void> {
    if (!isElectron()) {
      throw new Error('Saving prompts is only available in the desktop app');
    }

    const cached = promptCache.value.get(filePath);
    if (!cached) {
      throw new Error(`Prompt not loaded: ${filePath}`);
    }

    try {
      isLoading.value = true;
      error.value = null;

      // Update prompt content
      const updatedPrompt: IPromptFile = {
        ...cached.prompt,
        content: cached.currentContent,
      };

      await promptService.savePrompt(updatedPrompt);

      // Update cache
      const newCache = new Map(promptCache.value);
      newCache.set(filePath, {
        prompt: updatedPrompt,
        originalContent: cached.currentContent,
        currentContent: cached.currentContent,
        isDirty: false,
      });
      promptCache.value = newCache;

      // Update recent files
      await recentFilesRepository.addRecentFile(filePath, updatedPrompt.fileName, 'prompt');
      await refreshRecentFiles();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save prompt';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Create a new prompt
   */
  async function createPrompt(
    title: string,
    content: string = '',
    category?: string
  ): Promise<IPromptFile> {
    if (!isElectron()) {
      throw new Error('Creating prompts is only available in the desktop app');
    }

    try {
      isLoading.value = true;
      error.value = null;

      const prompt = await promptService.createPrompt(title, content, category);

      // Add to cache
      const newCache = new Map(promptCache.value);
      newCache.set(prompt.filePath, {
        prompt,
        originalContent: prompt.content,
        currentContent: prompt.content,
        isDirty: false,
      });
      promptCache.value = newCache;

      // Add to recent files
      await recentFilesRepository.addRecentFile(prompt.filePath, prompt.fileName, 'prompt');
      await refreshRecentFiles();
      await refreshAllPrompts();

      return prompt;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create prompt';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Delete a prompt
   */
  async function deletePrompt(filePath: string): Promise<void> {
    if (!isElectron()) {
      throw new Error('Deleting prompts is only available in the desktop app');
    }

    try {
      isLoading.value = true;
      error.value = null;

      await promptService.deletePrompt(filePath);

      // Remove from cache
      const newCache = new Map(promptCache.value);
      newCache.delete(filePath);
      promptCache.value = newCache;

      // Remove from recent files
      await recentFilesRepository.removeRecentFile(filePath);
      await refreshRecentFiles();
      await refreshAllPrompts();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete prompt';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Rename a prompt (changes title and file name)
   * Returns the new file path and updated prompt
   */
  async function renamePrompt(
    filePath: string,
    newTitle: string
  ): Promise<{ newFilePath: string; prompt: IPromptFile }> {
    if (!isElectron()) {
      throw new Error('Renaming prompts is only available in the desktop app');
    }

    try {
      isLoading.value = true;
      error.value = null;

      // Get current cache state
      const cached = promptCache.value.get(filePath);

      // Rename via service
      const renamedPrompt = await promptService.renamePrompt(filePath, newTitle);

      // Update cache - remove old path and add new path
      const newCache = new Map(promptCache.value);
      newCache.delete(filePath);
      newCache.set(renamedPrompt.filePath, {
        prompt: renamedPrompt,
        originalContent: cached?.currentContent ?? renamedPrompt.content,
        currentContent: cached?.currentContent ?? renamedPrompt.content,
        isDirty: cached?.isDirty ?? false,
      });
      promptCache.value = newCache;

      // Update UI store tabs
      const uiStore = useUIStore();
      uiStore.updateTabFilePath(filePath, renamedPrompt.filePath, newTitle);

      // Update recent files
      await recentFilesRepository.removeRecentFile(filePath);
      await recentFilesRepository.addRecentFile(
        renamedPrompt.filePath,
        renamedPrompt.fileName,
        'prompt'
      );
      await refreshRecentFiles();
      await refreshAllPrompts();

      return { newFilePath: renamedPrompt.filePath, prompt: renamedPrompt };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to rename prompt';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Move a prompt to a different directory
   */
  async function movePrompt(
    filePath: string,
    targetDir: string,
    overwrite: boolean = false
  ): Promise<{ newFilePath: string; prompt: IPromptFile }> {
    if (!isElectron()) {
      throw new Error('Moving prompts is only available in the desktop app');
    }

    try {
      isLoading.value = true;
      error.value = null;

      // Get current cache state
      const cached = promptCache.value.get(filePath);

      // Move via service
      const movedPrompt = await promptService.movePromptToDirectory(filePath, targetDir, overwrite);

      // Update cache - remove old path and add new path
      const newCache = new Map(promptCache.value);
      newCache.delete(filePath);
      newCache.set(movedPrompt.filePath, {
        prompt: movedPrompt,
        originalContent: cached?.currentContent ?? movedPrompt.content,
        currentContent: cached?.currentContent ?? movedPrompt.content,
        isDirty: cached?.isDirty ?? false,
      });
      promptCache.value = newCache;

      // Update UI store tabs
      const uiStore = useUIStore();
      uiStore.updateTabFilePath(filePath, movedPrompt.filePath, movedPrompt.metadata.title);

      // Update recent files
      await recentFilesRepository.removeRecentFile(filePath);
      await recentFilesRepository.addRecentFile(
        movedPrompt.filePath,
        movedPrompt.fileName,
        'prompt'
      );
      await refreshRecentFiles();
      await refreshAllPrompts();

      return { newFilePath: movedPrompt.filePath, prompt: movedPrompt };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to move prompt';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Create a new prompt in a specific directory
   */
  async function createPromptInDirectory(
    dirPath: string,
    title: string,
    content: string = ''
  ): Promise<IPromptFile> {
    if (!isElectron()) {
      throw new Error('Creating prompts is only available in the desktop app');
    }

    try {
      isLoading.value = true;
      error.value = null;

      const prompt = await promptService.createPromptInDirectory(dirPath, title, content);

      // Add to cache
      const newCache = new Map(promptCache.value);
      newCache.set(prompt.filePath, {
        prompt,
        originalContent: prompt.content,
        currentContent: prompt.content,
        isDirty: false,
      });
      promptCache.value = newCache;

      // Add to recent files
      await recentFilesRepository.addRecentFile(prompt.filePath, prompt.fileName, 'prompt');
      await refreshRecentFiles();
      await refreshAllPrompts();

      return prompt;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create prompt';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Update prompt metadata
   */
  async function updatePromptMetadata(
    filePath: string,
    updates: Partial<IPromptFile['metadata']>
  ): Promise<IPromptFile> {
    if (!isElectron()) {
      throw new Error('Updating prompt metadata is only available in the desktop app');
    }

    try {
      isLoading.value = true;
      error.value = null;

      const prompt = await promptService.updatePromptMetadata(filePath, updates);

      // Update cache
      const cached = promptCache.value.get(filePath);
      if (cached) {
        const newCache = new Map(promptCache.value);
        newCache.set(filePath, {
          ...cached,
          prompt,
        });
        promptCache.value = newCache;
      }

      return prompt;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update prompt metadata';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Remove a prompt from cache (without deleting the file)
   */
  function unloadPrompt(filePath: string): void {
    const newCache = new Map(promptCache.value);
    newCache.delete(filePath);
    promptCache.value = newCache;
  }

  // ================================
  // Generic File Operations (for code/text files)
  // ================================

  /**
   * Load a generic text file and cache its content
   * @param filePath - Path to the file
   */
  async function loadFile(filePath: string): Promise<string> {
    if (!isElectron()) {
      throw new Error('Loading files is only available in the desktop app');
    }

    // Check if already cached
    const cached = fileCache.value.get(filePath);
    if (cached) {
      return cached.currentContent;
    }

    try {
      const content = await window.fileSystemAPI.readFile(filePath);

      // Add to cache
      const newCache = new Map(fileCache.value);
      newCache.set(filePath, {
        originalContent: content,
        currentContent: content,
        isDirty: false,
      });
      fileCache.value = newCache;

      return content;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load file';
      throw err;
    }
  }

  /**
   * Get generic file content from cache
   * @param filePath - Path to the file
   */
  function getFileContent(filePath: string): string | undefined {
    // First check file cache
    const fileCached = fileCache.value.get(filePath);
    if (fileCached) {
      return fileCached.currentContent;
    }
    // Fall back to prompt cache for backward compatibility
    return promptCache.value.get(filePath)?.currentContent;
  }

  /**
   * Update generic file content in cache (marks as dirty)
   * @param filePath - Path to the file
   * @param content - New content
   */
  function updateFileContent(filePath: string, content: string): void {
    const cached = fileCache.value.get(filePath);
    if (!cached) return;

    const isDirty = content !== cached.originalContent;

    const newCache = new Map(fileCache.value);
    newCache.set(filePath, {
      ...cached,
      currentContent: content,
      isDirty,
    });
    fileCache.value = newCache;

    // Update tab dirty state
    const uiStore = useUIStore();
    uiStore.setTabDirty(filePath, isDirty);
  }

  /**
   * Check if a generic file has unsaved changes
   * @param filePath - Path to the file
   */
  function isFileDirty(filePath: string): boolean {
    return fileCache.value.get(filePath)?.isDirty ?? false;
  }

  /**
   * Save a generic file to disk
   * @param filePath - Path to the file
   */
  async function saveFile(filePath: string): Promise<void> {
    if (!isElectron()) {
      throw new Error('Saving files is only available in the desktop app');
    }

    const cached = fileCache.value.get(filePath);
    if (!cached) {
      throw new Error('File not found in cache');
    }

    try {
      await window.fileSystemAPI.writeFile(filePath, cached.currentContent);

      // Update cache to mark as not dirty
      const newCache = new Map(fileCache.value);
      newCache.set(filePath, {
        ...cached,
        originalContent: cached.currentContent,
        isDirty: false,
      });
      fileCache.value = newCache;

      // Update tab dirty state
      const uiStore = useUIStore();
      uiStore.setTabDirty(filePath, false);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save file';
      throw err;
    }
  }

  /**
   * Unload a generic file from cache
   * @param filePath - Path to the file
   */
  function unloadFile(filePath: string): void {
    const newCache = new Map(fileCache.value);
    newCache.delete(filePath);
    fileCache.value = newCache;
  }

  /**
   * Clear error state
   */
  function clearError(): void {
    error.value = null;
  }

  return {
    // State
    isInitialized,
    isLoading,
    error,
    recentFiles,
    allPrompts,

    // Getters
    loadedPromptPaths,
    hasUnsavedPrompts,
    unsavedPromptPaths,
    favoritePrompts,

    // Actions
    initialize,
    cleanup,
    refreshRecentFiles,
    refreshAllPrompts,
    loadPrompt,
    reloadPrompt,
    getPromptContent,
    getCachedPrompt,
    updatePromptContent,
    isPromptDirty,
    savePrompt,
    createPrompt,
    createPromptInDirectory,
    deletePrompt,
    renamePrompt,
    movePrompt,
    updatePromptMetadata,
    unloadPrompt,
    clearError,

    // Generic file operations
    loadFile,
    getFileContent,
    updateFileContent,
    isFileDirty,
    saveFile,
    unloadFile,
  };
});
