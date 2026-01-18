/**
 * Snippet Store
 *
 * Pinia store for managing snippets (personas, templates, text snippets, code snippets).
 * Handles loading, caching, creating, updating, and deleting snippets.
 */

import { defineStore } from 'pinia';
import { ref, computed, shallowRef } from 'vue';
import { getPromptFileService } from '@/services/file-system';
import { setUserSnippetsProvider } from '@/components/editor/snippet-provider';
import { useUIStore } from '@/stores/uiStore';
import type { ISnippetFile, ISnippetMetadata } from '@/services/file-system/types';

/**
 * Snippet cache entry
 */
interface ISnippetCache {
  snippet: ISnippetFile;
  originalContent: string;
  isDirty: boolean;
}

export const useSnippetStore = defineStore('snippets', () => {
  // Check if running in Electron environment
  const isElectron = () => typeof window !== 'undefined' && !!window.fileSystemAPI;

  // Services
  const snippetService = getPromptFileService();

  // State
  const isInitialized = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // All snippets list (loaded from file system)
  const allSnippets = ref<ISnippetFile[]>([]);

  // Snippet cache for loaded/editing snippets (using shallowRef for Map)
  const snippetCache = shallowRef<Map<string, ISnippetCache>>(new Map());

  // Computed: snippets by type
  const personaSnippets = computed(() =>
    allSnippets.value.filter((s) => s.metadata.type === 'persona')
  );

  const textSnippets = computed(() => allSnippets.value.filter((s) => s.metadata.type === 'text'));

  const codeSnippets = computed(() => allSnippets.value.filter((s) => s.metadata.type === 'code'));

  const templateSnippets = computed(() =>
    allSnippets.value.filter((s) => s.metadata.type === 'template')
  );

  // Computed: shortcut map for quick lookup
  const shortcutMap = computed(() => {
    const map = new Map<string, ISnippetFile>();
    for (const snippet of allSnippets.value) {
      map.set(snippet.metadata.shortcut.toLowerCase(), snippet);
    }
    return map;
  });

  // Computed: loaded snippet paths
  const loadedSnippetPaths = computed(() => Array.from(snippetCache.value.keys()));

  // Computed: unsaved snippets
  const unsavedSnippetPaths = computed(() => {
    const paths: string[] = [];
    snippetCache.value.forEach((cached, path) => {
      if (cached.isDirty) {
        paths.push(path);
      }
    });
    return paths;
  });

  // Computed: has unsaved changes
  const hasUnsavedSnippets = computed(() => unsavedSnippetPaths.value.length > 0);

  /**
   * Initialize the snippet store
   */
  async function initialize(): Promise<void> {
    // Always set up the snippets provider for Monaco editor autocomplete
    setUserSnippetsProvider({
      getAll: () => allSnippets.value,
      getByType: (type: string) => allSnippets.value.filter((s) => s.metadata.type === type),
    });

    if (isInitialized.value) return;

    try {
      isLoading.value = true;
      error.value = null;

      await snippetService.initialize();
      await refreshAllSnippets();

      isInitialized.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to initialize snippets';
      console.error('Failed to initialize snippet store:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Refresh the list of all snippets
   */
  async function refreshAllSnippets(): Promise<void> {
    try {
      isLoading.value = true;
      allSnippets.value = await snippetService.listSnippets();
    } catch (err) {
      console.error('Failed to refresh snippets:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Load a snippet by file path
   */
  async function loadSnippet(filePath: string): Promise<ISnippetFile> {
    // Check cache first
    const cached = snippetCache.value.get(filePath);
    if (cached) {
      return cached.snippet;
    }

    if (!isElectron()) {
      throw new Error('Loading snippets is only available in the desktop app');
    }

    try {
      const snippet = await snippetService.loadSnippet(filePath);

      // Add to cache
      const newCache = new Map(snippetCache.value);
      newCache.set(filePath, {
        snippet,
        originalContent: snippet.content,
        isDirty: false,
      });
      snippetCache.value = newCache;

      return snippet;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load snippet';
      throw err;
    }
  }

  /**
   * Get cached snippet
   */
  function getCachedSnippet(filePath: string): ISnippetFile | undefined {
    return snippetCache.value.get(filePath)?.snippet;
  }

  /**
   * Get snippet content
   */
  function getSnippetContent(filePath: string): string | undefined {
    return snippetCache.value.get(filePath)?.snippet.content;
  }

  /**
   * Update snippet content (marks as dirty if changed)
   */
  function updateSnippetContent(filePath: string, content: string): void {
    const cached = snippetCache.value.get(filePath);
    if (!cached) return;

    const isDirty = content !== cached.originalContent;

    const newCache = new Map(snippetCache.value);
    newCache.set(filePath, {
      ...cached,
      snippet: {
        ...cached.snippet,
        content,
      },
      isDirty,
    });
    snippetCache.value = newCache;
  }

  /**
   * Check if snippet is dirty
   */
  function isSnippetDirty(filePath: string): boolean {
    return snippetCache.value.get(filePath)?.isDirty ?? false;
  }

  /**
   * Save a snippet
   */
  async function saveSnippet(filePath: string): Promise<void> {
    if (!isElectron()) {
      throw new Error('Saving snippets is only available in the desktop app');
    }

    const cached = snippetCache.value.get(filePath);
    if (!cached) {
      throw new Error(`Snippet not loaded: ${filePath}`);
    }

    try {
      // Update timestamps
      const updatedSnippet: ISnippetFile = {
        ...cached.snippet,
        metadata: {
          ...cached.snippet.metadata,
          updatedAt: new Date().toISOString(),
        },
      };

      await snippetService.saveSnippet(updatedSnippet);

      // Update cache
      const newCache = new Map(snippetCache.value);
      newCache.set(filePath, {
        snippet: updatedSnippet,
        originalContent: updatedSnippet.content,
        isDirty: false,
      });
      snippetCache.value = newCache;

      // Refresh all snippets list
      await refreshAllSnippets();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save snippet';
      throw err;
    }
  }

  /**
   * Create a new snippet
   */
  async function createSnippet(
    name: string,
    type: ISnippetMetadata['type'] = 'text',
    content: string = ''
  ): Promise<ISnippetFile> {
    if (!isElectron()) {
      throw new Error('Creating snippets is only available in the desktop app');
    }

    try {
      isLoading.value = true;
      const snippet = await snippetService.createSnippet(name, type, content);

      // Add to cache
      const newCache = new Map(snippetCache.value);
      newCache.set(snippet.filePath, {
        snippet,
        originalContent: content,
        isDirty: false,
      });
      snippetCache.value = newCache;

      // Refresh all snippets list
      await refreshAllSnippets();

      return snippet;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create snippet';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Delete a snippet
   */
  async function deleteSnippet(filePath: string): Promise<void> {
    if (!isElectron()) {
      throw new Error('Deleting snippets is only available in the desktop app');
    }

    try {
      await snippetService.deleteSnippet(filePath);

      // Remove from cache
      const newCache = new Map(snippetCache.value);
      newCache.delete(filePath);
      snippetCache.value = newCache;

      // Refresh all snippets list
      await refreshAllSnippets();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete snippet';
      throw err;
    }
  }

  /**
   * Rename a snippet (changes name and file name)
   * Returns the new file path and updated snippet
   */
  async function renameSnippet(
    filePath: string,
    newName: string
  ): Promise<{ newFilePath: string; snippet: ISnippetFile }> {
    if (!isElectron()) {
      throw new Error('Renaming snippets is only available in the desktop app');
    }

    try {
      isLoading.value = true;
      error.value = null;

      // Get current cache state
      const cached = snippetCache.value.get(filePath);

      // Rename via service
      const renamedSnippet = await snippetService.renameSnippet(filePath, newName);

      // Update cache - remove old path and add new path
      const newCache = new Map(snippetCache.value);
      newCache.delete(filePath);
      newCache.set(renamedSnippet.filePath, {
        snippet: renamedSnippet,
        originalContent: cached?.snippet.content ?? renamedSnippet.content,
        isDirty: cached?.isDirty ?? false,
      });
      snippetCache.value = newCache;

      // Update UI store tabs
      const uiStore = useUIStore();
      uiStore.updateTabFilePath(filePath, renamedSnippet.filePath, newName);

      // Refresh all snippets list
      await refreshAllSnippets();

      return { newFilePath: renamedSnippet.filePath, snippet: renamedSnippet };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to rename snippet';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Unload snippet from cache
   */
  function unloadSnippet(filePath: string): void {
    const newCache = new Map(snippetCache.value);
    newCache.delete(filePath);
    snippetCache.value = newCache;
  }

  /**
   * Find snippet by shortcut
   */
  function findByShortcut(shortcut: string): ISnippetFile | undefined {
    return shortcutMap.value.get(shortcut.toLowerCase());
  }

  /**
   * Search snippets by query
   */
  function searchSnippets(query: string): ISnippetFile[] {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return allSnippets.value;

    return allSnippets.value.filter(
      (s) =>
        s.metadata.name.toLowerCase().includes(lowerQuery) ||
        s.metadata.shortcut.toLowerCase().includes(lowerQuery) ||
        (s.metadata.description?.toLowerCase().includes(lowerQuery) ?? false) ||
        s.metadata.tags.some((t) => t.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get snippets by type
   */
  function getSnippetsByType(type: ISnippetMetadata['type']): ISnippetFile[] {
    return allSnippets.value.filter((s) => s.metadata.type === type);
  }

  /**
   * Update snippet metadata
   */
  async function updateSnippetMetadata(
    filePath: string,
    updates: Partial<ISnippetMetadata>
  ): Promise<ISnippetFile> {
    const cached = snippetCache.value.get(filePath);
    if (!cached) {
      throw new Error(`Snippet not loaded: ${filePath}`);
    }

    const updatedSnippet: ISnippetFile = {
      ...cached.snippet,
      metadata: {
        ...cached.snippet.metadata,
        ...updates,
        updatedAt: new Date().toISOString(),
      },
    };

    await snippetService.saveSnippet(updatedSnippet);

    // Update cache
    const newCache = new Map(snippetCache.value);
    newCache.set(filePath, {
      ...cached,
      snippet: updatedSnippet,
    });
    snippetCache.value = newCache;

    // Refresh all snippets list
    await refreshAllSnippets();

    return updatedSnippet;
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
    allSnippets,

    // Computed
    personaSnippets,
    textSnippets,
    codeSnippets,
    templateSnippets,
    shortcutMap,
    loadedSnippetPaths,
    unsavedSnippetPaths,
    hasUnsavedSnippets,

    // Actions
    initialize,
    refreshAllSnippets,
    loadSnippet,
    getCachedSnippet,
    getSnippetContent,
    updateSnippetContent,
    isSnippetDirty,
    saveSnippet,
    createSnippet,
    deleteSnippet,
    renameSnippet,
    unloadSnippet,
    findByShortcut,
    searchSnippets,
    getSnippetsByType,
    updateSnippetMetadata,
    clearError,
  };
});
