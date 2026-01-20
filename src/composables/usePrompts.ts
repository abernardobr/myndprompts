/**
 * Prompts Composable
 *
 * Provides prompt management functionality including:
 * - Loading and saving prompts
 * - Creating and deleting prompts
 * - Recent files access
 * - Integration with UI store for tab management
 */

import { computed, onMounted, onUnmounted } from 'vue';
import { usePromptStore } from '@/stores/promptStore';
import { useUIStore } from '@/stores/uiStore';
import type { IPromptFile } from '@/services/file-system/types';

export function usePrompts() {
  const promptStore = usePromptStore();
  const uiStore = useUIStore();

  // State
  const isLoading = computed(() => promptStore.isLoading);
  const error = computed(() => promptStore.error);
  const recentFiles = computed(() => promptStore.recentFiles);
  const allPrompts = computed(() => promptStore.allPrompts);
  const hasUnsavedChanges = computed(() => promptStore.hasUnsavedPrompts);

  /**
   * Initialize the prompt system
   */
  async function initialize(): Promise<void> {
    await promptStore.initialize();
    await promptStore.refreshAllPrompts();
  }

  /**
   * Open a prompt file and create a tab for it
   * @param filePath - Path to the prompt file
   * @param paneId - Optional pane ID to open the tab in (uses active pane if not specified)
   */
  async function openPrompt(filePath: string, paneId?: string): Promise<IPromptFile> {
    const prompt = await promptStore.loadPrompt(filePath);

    // Open tab in UI (using pane-aware method if panes exist)
    if (uiStore.editorPanes.length > 0) {
      uiStore.openTabInPane(
        {
          filePath: prompt.filePath,
          fileName: prompt.fileName,
          title: prompt.metadata.title,
          isDirty: false,
          isPinned: false,
        },
        paneId
      );
    } else {
      uiStore.openTab({
        filePath: prompt.filePath,
        fileName: prompt.fileName,
        title: prompt.metadata.title,
        isDirty: false,
        isPinned: false,
      });
    }

    return prompt;
  }

  /**
   * Create a new prompt and open it in a tab
   * @param title - Title for the new prompt
   * @param content - Initial content
   * @param category - Optional category/folder
   * @param paneId - Optional pane ID to open the tab in
   */
  async function createNewPrompt(
    title: string,
    content: string = '',
    category?: string,
    paneId?: string
  ): Promise<IPromptFile> {
    const prompt = await promptStore.createPrompt(title, content, category);

    // Open tab in UI (using pane-aware method if panes exist)
    if (uiStore.editorPanes.length > 0) {
      uiStore.openTabInPane(
        {
          filePath: prompt.filePath,
          fileName: prompt.fileName,
          title: prompt.metadata.title,
          isDirty: false,
          isPinned: false,
        },
        paneId
      );
    } else {
      uiStore.openTab({
        filePath: prompt.filePath,
        fileName: prompt.fileName,
        title: prompt.metadata.title,
        isDirty: false,
        isPinned: false,
      });
    }

    return prompt;
  }

  /**
   * Save the currently active prompt
   */
  async function saveActivePrompt(): Promise<void> {
    const activeTab = uiStore.activeTab;
    if (!activeTab) return;

    await promptStore.savePrompt(activeTab.filePath);
    uiStore.setTabDirty(activeTab.id, false);
  }

  /**
   * Save a specific prompt by file path
   */
  async function savePrompt(filePath: string): Promise<void> {
    await promptStore.savePrompt(filePath);

    // Update tab dirty state
    const tab = uiStore.openTabs.find((t) => t.filePath === filePath);
    if (tab) {
      uiStore.setTabDirty(tab.id, false);
    }
  }

  /**
   * Update content for a prompt (marks as dirty)
   */
  function updateContent(filePath: string, content: string): void {
    promptStore.updatePromptContent(filePath, content);

    // Update tab dirty state
    const tab = uiStore.openTabs.find((t) => t.filePath === filePath);
    if (tab) {
      const isDirty = promptStore.isPromptDirty(filePath);
      uiStore.setTabDirty(tab.id, isDirty);
    }
  }

  /**
   * Get content for a prompt
   */
  function getContent(filePath: string): string | undefined {
    return promptStore.getPromptContent(filePath);
  }

  /**
   * Get cached prompt data
   */
  function getPrompt(filePath: string): IPromptFile | undefined {
    return promptStore.getCachedPrompt(filePath);
  }

  /**
   * Check if a prompt has unsaved changes
   */
  function isDirty(filePath: string): boolean {
    return promptStore.isPromptDirty(filePath);
  }

  /**
   * Close a prompt (removes from cache and closes tab)
   */
  function closePrompt(filePath: string): void {
    // Close tab
    const tab = uiStore.openTabs.find((t) => t.filePath === filePath);
    if (tab) {
      uiStore.closeTab(tab.id);
    }

    // Unload from cache
    promptStore.unloadPrompt(filePath);
  }

  /**
   * Delete a prompt file
   */
  async function deletePrompt(filePath: string): Promise<void> {
    // Close tab first
    closePrompt(filePath);

    // Delete file
    await promptStore.deletePrompt(filePath);
  }

  /**
   * Reload a prompt from disk
   */
  async function reloadPrompt(filePath: string): Promise<IPromptFile> {
    const prompt = await promptStore.reloadPrompt(filePath);

    // Update tab dirty state
    const tab = uiStore.openTabs.find((t) => t.filePath === filePath);
    if (tab) {
      uiStore.setTabDirty(tab.id, false);
    }

    return prompt;
  }

  /**
   * Save all unsaved prompts
   */
  async function saveAllPrompts(): Promise<void> {
    const unsavedPaths = promptStore.unsavedPromptPaths;
    for (const filePath of unsavedPaths) {
      await savePrompt(filePath);
    }
  }

  // ================================
  // Generic File Operations (for code/text files)
  // ================================

  /**
   * Open a generic file and load its content
   * @param filePath - Path to the file
   */
  async function openFile(filePath: string): Promise<string> {
    return promptStore.loadFile(filePath);
  }

  /**
   * Get content for any file (prompt or generic)
   */
  function getFileContent(filePath: string): string | undefined {
    return promptStore.getFileContent(filePath);
  }

  /**
   * Update content for any file (prompt or generic)
   */
  function updateFileContent(filePath: string, content: string): void {
    promptStore.updateFileContent(filePath, content);
  }

  /**
   * Save a generic file
   */
  async function saveGenericFile(filePath: string): Promise<void> {
    await promptStore.saveFile(filePath);
  }

  /**
   * Check if a generic file is dirty
   */
  function isFileDirty(filePath: string): boolean {
    return promptStore.isFileDirty(filePath);
  }

  /**
   * Handle keyboard shortcuts for prompt operations
   */
  function handleKeyboardShortcut(event: KeyboardEvent): void {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? event.metaKey : event.ctrlKey;

    // Ctrl/Cmd + S - Save
    if (modKey && !event.shiftKey && event.key === 's') {
      event.preventDefault();
      void saveActivePrompt();
      return;
    }

    // Ctrl/Cmd + Shift + S - Save All
    if (modKey && event.shiftKey && event.key === 'S') {
      event.preventDefault();
      void saveAllPrompts();
      return;
    }
  }

  /**
   * Setup keyboard shortcuts
   */
  function setupKeyboardShortcuts(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyboardShortcut);
    }
  }

  /**
   * Cleanup keyboard shortcuts
   */
  function cleanupKeyboardShortcuts(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleKeyboardShortcut);
    }
  }

  // Setup and cleanup on mount/unmount
  onMounted(() => {
    setupKeyboardShortcuts();
  });

  onUnmounted(() => {
    cleanupKeyboardShortcuts();
  });

  return {
    // State
    isLoading,
    error,
    recentFiles,
    allPrompts,
    hasUnsavedChanges,

    // Actions
    initialize,
    openPrompt,
    createNewPrompt,
    saveActivePrompt,
    savePrompt,
    updateContent,
    getContent,
    getPrompt,
    isDirty,
    closePrompt,
    deletePrompt,
    reloadPrompt,
    saveAllPrompts,

    // Generic file operations
    openFile,
    getFileContent,
    updateFileContent,
    saveGenericFile,
    isFileDirty,
  };
}
