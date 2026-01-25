/**
 * UI Store
 *
 * Manages UI state including layout, theme, tabs, and panels.
 * State is persisted to IndexedDB for restoration across sessions.
 */

import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { Dark } from 'quasar';
import { getUIStateRepository } from '@/services/storage';
import type { IUIState, IEditorSplitConfig } from '@/services/storage';
import { setAppLocale } from '@/boot/i18n';
import { FileCategory, getFileCategory, getMimeType } from '@/services/file-system/file-types';
import { getBasename } from '@/utils/path.utils';

// Re-export FileCategory for convenience
export { FileCategory } from '@/services/file-system/file-types';

/**
 * Activity bar view types
 */
export type ActivityView = 'explorer' | 'search' | 'snippets' | 'favorites' | 'git' | 'ai';

/**
 * Panel tab types
 */
export type PanelTab = 'output' | 'problems' | 'gitChanges' | 'aiChat';

/**
 * Theme options
 */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Tab information for open files
 */
export interface IOpenTab {
  id: string;
  filePath: string;
  fileName: string;
  title: string;
  isDirty: boolean;
  isPinned: boolean;
  /** File category - determines which viewer to use */
  fileCategory: FileCategory;
  /** Optional MIME type for media files */
  mimeType?: string;
}

/**
 * Split direction types
 */
export type SplitDirection = 'horizontal' | 'vertical';

/**
 * Editor pane interface for runtime use
 */
export interface IEditorPane {
  id: string;
  tabs: IOpenTab[];
  activeTabId?: string;
  size?: number;
}

/**
 * Default UI state values
 */
const DEFAULT_UI_STATE: Omit<IUIState, 'id'> = {
  openTabs: [],
  activeTab: undefined,
  sidebarWidth: 280,
  sidebarCollapsed: false,
  panelHeight: 200,
  panelCollapsed: true,
  theme: 'system',
  locale: 'en-US',
};

/**
 * Generate unique pane ID
 */
function generatePaneId(): string {
  return `pane-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export const useUIStore = defineStore('ui', () => {
  // Layout state
  const sidebarWidth = ref(DEFAULT_UI_STATE.sidebarWidth);
  const sidebarCollapsed = ref(DEFAULT_UI_STATE.sidebarCollapsed);
  const panelHeight = ref(DEFAULT_UI_STATE.panelHeight);
  const panelCollapsed = ref(DEFAULT_UI_STATE.panelCollapsed);
  const activityBarWidth = ref(48); // Fixed width for activity bar

  // Active views
  const activeActivity = ref<ActivityView>('explorer');
  const activePanel = ref<PanelTab>('output');

  // Theme
  const theme = ref<Theme>(DEFAULT_UI_STATE.theme as Theme);

  // Locale
  const locale = ref(DEFAULT_UI_STATE.locale);

  // Tabs
  const openTabs = ref<IOpenTab[]>([]);
  const activeTabId = ref<string | undefined>(undefined);

  // Editor panes for split view
  const editorPanes = ref<IEditorPane[]>([]);
  const activePaneId = ref<string | undefined>(undefined);
  const splitDirection = ref<SplitDirection>('vertical');
  const isSplitView = computed(() => editorPanes.value.length > 1);

  // Loading state
  const isInitialized = ref(false);

  // Getters
  const activeTab = computed(() => openTabs.value.find((tab) => tab.id === activeTabId.value));

  const activePane = computed(() =>
    editorPanes.value.find((pane) => pane.id === activePaneId.value)
  );

  const hasUnsavedChanges = computed(() => openTabs.value.some((tab) => tab.isDirty));

  const effectiveTheme = computed(() => {
    if (theme.value === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme.value;
  });

  const isDarkMode = computed(() => effectiveTheme.value === 'dark');

  /**
   * Get all tabs that match a specific file category
   */
  function getTabsByCategory(category: FileCategory): IOpenTab[] {
    return openTabs.value.filter((tab) => tab.fileCategory === category);
  }

  // Watch theme changes and apply to Quasar
  watch(
    effectiveTheme,
    (newTheme) => {
      Dark.set(newTheme === 'dark');
    },
    { immediate: true }
  );

  // Listen for system theme changes
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (theme.value === 'system') {
        Dark.set(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    });
  }

  // Actions
  async function initialize(): Promise<void> {
    if (isInitialized.value) return;

    try {
      const repository = getUIStateRepository();
      const savedState = await repository.getState();

      if (savedState) {
        sidebarWidth.value = savedState.sidebarWidth;
        sidebarCollapsed.value = savedState.sidebarCollapsed;
        panelHeight.value = savedState.panelHeight;
        panelCollapsed.value = savedState.panelCollapsed;
        theme.value = savedState.theme as Theme;
        locale.value = savedState.locale;
        // Sync locale with vue-i18n
        setAppLocale(savedState.locale);

        // Restore tabs (without content, just references)
        if (savedState.openTabs.length > 0) {
          openTabs.value = savedState.openTabs.map((filePath) => {
            // Detect file category from extension
            const fileCategory = getFileCategory(filePath);
            const mimeType = getMimeType(filePath);
            const fileName = getBasename(filePath) || filePath;
            return {
              id: filePath,
              filePath,
              fileName,
              title: fileName.replace(/\.md$/, ''),
              isDirty: false,
              isPinned: false,
              fileCategory,
              mimeType,
            };
          });
          activeTabId.value = savedState.activeTab ?? savedState.openTabs[0];
        }

        // Restore split pane configuration
        if (savedState.editorSplit && savedState.editorSplit.panes.length > 0) {
          splitDirection.value = savedState.editorSplit.direction;
          activePaneId.value = savedState.editorSplit.activePaneId;
          editorPanes.value = savedState.editorSplit.panes.map((paneConfig) => ({
            id: paneConfig.id,
            tabs: paneConfig.tabs.map((filePath) => {
              // Find tab in openTabs or create new one
              const existingTab = openTabs.value.find((t) => t.filePath === filePath);
              if (existingTab) return existingTab;
              // Detect file category from extension for new tabs
              const fileCategory = getFileCategory(filePath);
              const mimeType = getMimeType(filePath);
              const fileName = getBasename(filePath) || filePath;
              return {
                id: filePath,
                filePath,
                fileName,
                title: fileName.replace(/\.md$/, ''),
                isDirty: false,
                isPinned: false,
                fileCategory,
                mimeType,
              };
            }),
            activeTabId: paneConfig.activeTab,
            size: paneConfig.size,
          }));
        } else if (openTabs.value.length > 0) {
          // Create default single pane if no split config but has tabs
          const defaultPaneId = generatePaneId();
          editorPanes.value = [
            {
              id: defaultPaneId,
              tabs: [...openTabs.value],
              activeTabId: activeTabId.value,
            },
          ];
          activePaneId.value = defaultPaneId;
        }
      }

      isInitialized.value = true;
    } catch (error) {
      console.error('Failed to initialize UI store:', error);
      isInitialized.value = true;
    }
  }

  async function saveState(): Promise<void> {
    try {
      const repository = getUIStateRepository();

      // Build split config for persistence
      const editorSplit: IEditorSplitConfig | undefined =
        editorPanes.value.length > 0
          ? {
              panes: editorPanes.value.map((pane) => ({
                id: pane.id,
                tabs: pane.tabs.map((t) => t.filePath),
                activeTab: pane.activeTabId,
                size: pane.size,
              })),
              direction: splitDirection.value,
              activePaneId: activePaneId.value ?? editorPanes.value[0]?.id ?? '',
            }
          : undefined;

      await repository.updateState({
        openTabs: openTabs.value.map((tab) => tab.filePath),
        activeTab: activeTabId.value,
        sidebarWidth: sidebarWidth.value,
        sidebarCollapsed: sidebarCollapsed.value,
        panelHeight: panelHeight.value,
        panelCollapsed: panelCollapsed.value,
        theme: theme.value,
        locale: locale.value,
        editorSplit,
      });
    } catch (error) {
      console.error('Failed to save UI state:', error);
    }
  }

  // Theme actions
  function setTheme(newTheme: Theme): void {
    theme.value = newTheme;
    void saveState();
  }

  // Sidebar actions
  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value;
    void saveState();
  }

  function setSidebarWidth(width: number): void {
    sidebarWidth.value = Math.max(200, Math.min(600, width));
    void saveState();
  }

  function setSidebarCollapsed(collapsed: boolean): void {
    sidebarCollapsed.value = collapsed;
    void saveState();
  }

  // Activity bar actions
  function setActiveActivity(activity: ActivityView): void {
    if (activeActivity.value === activity && !sidebarCollapsed.value) {
      // Clicking the same activity toggles sidebar
      sidebarCollapsed.value = true;
    } else {
      activeActivity.value = activity;
      sidebarCollapsed.value = false;
    }
    void saveState();
  }

  // Panel actions
  function togglePanel(): void {
    panelCollapsed.value = !panelCollapsed.value;
    void saveState();
  }

  function setPanelHeight(height: number): void {
    panelHeight.value = Math.max(100, Math.min(500, height));
    void saveState();
  }

  function setPanelCollapsed(collapsed: boolean): void {
    panelCollapsed.value = collapsed;
    void saveState();
  }

  function setActivePanel(panel: PanelTab): void {
    activePanel.value = panel;
    if (panelCollapsed.value) {
      panelCollapsed.value = false;
    }
    void saveState();
  }

  /**
   * Input type for opening a tab (fileCategory defaults to MARKDOWN for backward compatibility)
   */
  type OpenTabInput = Omit<IOpenTab, 'id' | 'fileCategory' | 'mimeType'> & {
    fileCategory?: FileCategory;
    mimeType?: string;
  };

  // Tab actions
  function openTab(tab: OpenTabInput): void {
    // If panes exist, delegate to openTabInPane to ensure pane is updated
    if (editorPanes.value.length > 0) {
      openTabInPane(tab);
      return;
    }

    const existingTab = openTabs.value.find((t) => t.filePath === tab.filePath);

    if (existingTab) {
      // Update fileCategory and mimeType if provided (in case file was re-opened with different info)
      if (tab.fileCategory !== undefined) {
        existingTab.fileCategory = tab.fileCategory;
      }
      if (tab.mimeType !== undefined) {
        existingTab.mimeType = tab.mimeType;
      }
      activeTabId.value = existingTab.id;
    } else {
      const newTab: IOpenTab = {
        ...tab,
        id: tab.filePath,
        // Default to MARKDOWN for backward compatibility
        fileCategory: tab.fileCategory ?? FileCategory.MARKDOWN,
      };
      openTabs.value.push(newTab);
      activeTabId.value = newTab.id;
    }
    void saveState();
  }

  function closeTab(tabId: string): void {
    const tabIndex = openTabs.value.findIndex((t) => t.id === tabId);
    if (tabIndex === -1) return;

    openTabs.value.splice(tabIndex, 1);

    // Also remove from any panes that contain this tab
    for (const pane of editorPanes.value) {
      const paneTabIndex = pane.tabs.findIndex((t) => t.id === tabId);
      if (paneTabIndex !== -1) {
        pane.tabs.splice(paneTabIndex, 1);

        // Update active tab in pane if needed
        if (pane.activeTabId === tabId) {
          if (pane.tabs.length > 0) {
            const newIndex = Math.min(paneTabIndex, pane.tabs.length - 1);
            pane.activeTabId = pane.tabs[newIndex]?.id;
          } else {
            pane.activeTabId = undefined;
          }
        }
      }
    }

    // Close any empty panes (except the last one)
    while (editorPanes.value.length > 1) {
      const emptyPaneIndex = editorPanes.value.findIndex((p) => p.tabs.length === 0);
      if (emptyPaneIndex === -1) break;
      editorPanes.value.splice(emptyPaneIndex, 1);
    }

    // Update active tab if the closed tab was active
    if (activeTabId.value === tabId) {
      if (openTabs.value.length > 0) {
        // Activate the tab at the same index, or the last tab
        const newIndex = Math.min(tabIndex, openTabs.value.length - 1);
        activeTabId.value = openTabs.value[newIndex]?.id;
      } else {
        activeTabId.value = undefined;
      }
    }
    void saveState();
  }

  function closeAllTabs(): void {
    openTabs.value = [];
    activeTabId.value = undefined;
    void saveState();
  }

  function closeOtherTabs(tabId: string): void {
    const tab = openTabs.value.find((t) => t.id === tabId);
    if (tab) {
      openTabs.value = [tab];
      activeTabId.value = tabId;
    }
    void saveState();
  }

  function setActiveTab(tabId: string): void {
    if (openTabs.value.some((t) => t.id === tabId)) {
      activeTabId.value = tabId;
      void saveState();
    }
  }

  function setTabDirty(tabId: string, isDirty: boolean): void {
    const tab = openTabs.value.find((t) => t.id === tabId);
    if (tab) {
      tab.isDirty = isDirty;
    }
  }

  function pinTab(tabId: string): void {
    const tab = openTabs.value.find((t) => t.id === tabId);
    if (tab) {
      tab.isPinned = true;
      // Move pinned tab to the beginning
      const index = openTabs.value.indexOf(tab);
      openTabs.value.splice(index, 1);
      const firstUnpinnedIndex = openTabs.value.findIndex((t) => !t.isPinned);
      if (firstUnpinnedIndex === -1) {
        openTabs.value.push(tab);
      } else {
        openTabs.value.splice(firstUnpinnedIndex, 0, tab);
      }
      void saveState();
    }
  }

  function unpinTab(tabId: string): void {
    const tab = openTabs.value.find((t) => t.id === tabId);
    if (tab) {
      tab.isPinned = false;
      void saveState();
    }
  }

  function reorderTabs(fromIndex: number, toIndex: number): void {
    const [movedTab] = openTabs.value.splice(fromIndex, 1);
    if (movedTab) {
      openTabs.value.splice(toIndex, 0, movedTab);
      void saveState();
    }
  }

  /**
   * Update a tab's file path after rename
   * Preserves fileCategory and mimeType from the original tab
   */
  function updateTabFilePath(oldFilePath: string, newFilePath: string, newTitle: string): void {
    const tab = openTabs.value.find((t) => t.filePath === oldFilePath);
    if (tab) {
      // Preserve fileCategory and mimeType
      const { fileCategory, mimeType } = tab;

      tab.id = newFilePath;
      tab.filePath = newFilePath;
      tab.fileName = getBasename(newFilePath) || newFilePath;
      tab.title = newTitle;
      tab.fileCategory = fileCategory;
      tab.mimeType = mimeType;

      // Update activeTabId if this was the active tab
      if (activeTabId.value === oldFilePath) {
        activeTabId.value = newFilePath;
      }

      // Also update in any editor panes
      for (const pane of editorPanes.value) {
        const paneTab = pane.tabs.find((t) => t.filePath === oldFilePath);
        if (paneTab) {
          paneTab.id = newFilePath;
          paneTab.filePath = newFilePath;
          paneTab.fileName = getBasename(newFilePath) || newFilePath;
          paneTab.title = newTitle;
          paneTab.fileCategory = fileCategory;
          paneTab.mimeType = mimeType;

          if (pane.activeTabId === oldFilePath) {
            pane.activeTabId = newFilePath;
          }
        }
      }

      void saveState();
    }
  }

  // Locale actions
  function setLocale(newLocale: string): void {
    locale.value = newLocale;
    // Sync locale with vue-i18n
    setAppLocale(newLocale);
    void saveState();
  }

  // ==========================================
  // Split Pane Actions
  // ==========================================

  /**
   * Initialize editor panes with a single pane if not already done
   */
  function ensurePaneExists(): void {
    if (editorPanes.value.length === 0) {
      const paneId = generatePaneId();
      editorPanes.value = [
        {
          id: paneId,
          tabs: [...openTabs.value],
          activeTabId: activeTabId.value,
        },
      ];
      activePaneId.value = paneId;
    }
  }

  /**
   * Set the active editor pane
   */
  function setActivePane(paneId: string): void {
    const pane = editorPanes.value.find((p) => p.id === paneId);
    if (pane) {
      activePaneId.value = paneId;
      // Also update global active tab to match pane's active tab
      if (pane.activeTabId) {
        activeTabId.value = pane.activeTabId;
      }
      void saveState();
    }
  }

  /**
   * Split the current editor pane
   * @param direction - 'horizontal' (side by side) or 'vertical' (stacked)
   * @param tabId - Optional tab to move to the new pane (defaults to active tab)
   */
  function splitEditor(direction: SplitDirection, tabId?: string): void {
    ensurePaneExists();

    const currentPane = editorPanes.value.find((p) => p.id === activePaneId.value);
    if (!currentPane || currentPane.tabs.length === 0) return;

    // Determine which tab to split
    const splitTabId = tabId ?? currentPane.activeTabId;
    const tabToSplit = currentPane.tabs.find((t) => t.id === splitTabId);
    if (!tabToSplit) return;

    // Update split direction if different
    splitDirection.value = direction;

    // Create new pane
    const newPaneId = generatePaneId();
    const newPane: IEditorPane = {
      id: newPaneId,
      tabs: [tabToSplit],
      activeTabId: tabToSplit.id,
      size: 50, // Start at 50%
    };

    // Update current pane size
    currentPane.size = 50;

    // Remove tab from current pane if it has more than one tab
    if (currentPane.tabs.length > 1) {
      const tabIndex = currentPane.tabs.findIndex((t) => t.id === splitTabId);
      currentPane.tabs.splice(tabIndex, 1);
      // Set new active tab in current pane
      if (currentPane.activeTabId === splitTabId) {
        currentPane.activeTabId = currentPane.tabs[0]?.id;
      }
    }

    // Insert new pane after current pane
    const currentPaneIndex = editorPanes.value.findIndex((p) => p.id === currentPane.id);
    editorPanes.value.splice(currentPaneIndex + 1, 0, newPane);

    // Set the new pane as active
    activePaneId.value = newPaneId;
    activeTabId.value = tabToSplit.id;

    void saveState();
  }

  /**
   * Close an editor pane
   */
  function closePane(paneId: string): void {
    const paneIndex = editorPanes.value.findIndex((p) => p.id === paneId);
    if (paneIndex === -1 || editorPanes.value.length <= 1) return;

    const closingPane = editorPanes.value[paneIndex];

    // Move tabs from closing pane to adjacent pane
    const targetPaneIndex = paneIndex === 0 ? 1 : paneIndex - 1;
    const targetPane = editorPanes.value[targetPaneIndex];

    if (targetPane && closingPane) {
      // Add tabs from closing pane to target pane (avoid duplicates)
      for (const tab of closingPane.tabs) {
        if (!targetPane.tabs.some((t) => t.id === tab.id)) {
          targetPane.tabs.push(tab);
        }
      }
    }

    // Remove the closing pane
    editorPanes.value.splice(paneIndex, 1);

    // Update active pane
    if (activePaneId.value === paneId && targetPane) {
      activePaneId.value = targetPane.id;
      activeTabId.value = targetPane.activeTabId;
    }

    // Reset size if only one pane left
    if (editorPanes.value.length === 1 && editorPanes.value[0]) {
      editorPanes.value[0].size = undefined;
    }

    void saveState();
  }

  /**
   * Move a tab to a different pane
   */
  function moveTabToPane(tabId: string, targetPaneId: string): void {
    // Find source pane
    let sourcePane: IEditorPane | undefined;
    let tab: IOpenTab | undefined;

    for (const pane of editorPanes.value) {
      const foundTab = pane.tabs.find((t) => t.id === tabId);
      if (foundTab) {
        sourcePane = pane;
        tab = foundTab;
        break;
      }
    }

    if (!sourcePane || !tab) return;

    // Find target pane
    const targetPane = editorPanes.value.find((p) => p.id === targetPaneId);
    if (!targetPane || sourcePane.id === targetPaneId) return;

    // Remove from source pane
    const tabIndex = sourcePane.tabs.findIndex((t) => t.id === tabId);
    sourcePane.tabs.splice(tabIndex, 1);

    // Update source pane active tab if needed
    if (sourcePane.activeTabId === tabId) {
      sourcePane.activeTabId = sourcePane.tabs[0]?.id;
    }

    // Add to target pane (if not already there)
    if (!targetPane.tabs.some((t) => t.id === tabId)) {
      targetPane.tabs.push(tab);
    }
    targetPane.activeTabId = tabId;

    // If source pane is empty, close it
    if (sourcePane.tabs.length === 0 && editorPanes.value.length > 1) {
      closePane(sourcePane.id);
    }

    // Set target pane as active
    activePaneId.value = targetPaneId;
    activeTabId.value = tabId;

    void saveState();
  }

  /**
   * Open a tab in a specific pane
   */
  function openTabInPane(tab: OpenTabInput, paneId?: string): void {
    ensurePaneExists();

    const targetPaneId = paneId ?? activePaneId.value;
    let targetPane = editorPanes.value.find((p) => p.id === targetPaneId);

    // If target pane not found, use first available pane
    if (!targetPane) {
      targetPane = editorPanes.value[0];
      if (!targetPane) {
        // No panes available, add to global tabs only
        const newTab: IOpenTab = {
          ...tab,
          id: tab.filePath,
          fileCategory: tab.fileCategory ?? FileCategory.MARKDOWN,
        };
        if (!openTabs.value.some((t) => t.filePath === tab.filePath)) {
          openTabs.value.push(newTab);
        }
        activeTabId.value = newTab.id;
        void saveState();
        return;
      }
    }

    // Check if tab already exists in any pane
    let existingTab: IOpenTab | undefined;
    let existingPane: IEditorPane | undefined;

    for (const pane of editorPanes.value) {
      const found = pane.tabs.find((t) => t.filePath === tab.filePath);
      if (found) {
        existingTab = found;
        existingPane = pane;
        break;
      }
    }

    if (existingTab && existingPane) {
      // Tab exists, update fileCategory and mimeType if provided, then activate it
      if (tab.fileCategory !== undefined) {
        existingTab.fileCategory = tab.fileCategory;
      }
      if (tab.mimeType !== undefined) {
        existingTab.mimeType = tab.mimeType;
      }
      existingPane.activeTabId = existingTab.id;
      activePaneId.value = existingPane.id;
      activeTabId.value = existingTab.id;
    } else {
      // Create new tab
      const newTab: IOpenTab = {
        ...tab,
        id: tab.filePath,
        fileCategory: tab.fileCategory ?? FileCategory.MARKDOWN,
      };

      // Add to global tabs list
      if (!openTabs.value.some((t) => t.filePath === tab.filePath)) {
        openTabs.value.push(newTab);
      }

      // Add to target pane
      targetPane.tabs.push(newTab);
      targetPane.activeTabId = newTab.id;
      activeTabId.value = newTab.id;
    }

    void saveState();
  }

  /**
   * Set active tab within a specific pane
   */
  function setActiveTabInPane(tabId: string, paneId: string): void {
    const pane = editorPanes.value.find((p) => p.id === paneId);
    if (pane && pane.tabs.some((t) => t.id === tabId)) {
      pane.activeTabId = tabId;
      activePaneId.value = paneId;
      activeTabId.value = tabId;
      void saveState();
    }
  }

  /**
   * Close a tab within a specific pane
   */
  function closeTabInPane(tabId: string, paneId: string): void {
    const pane = editorPanes.value.find((p) => p.id === paneId);
    if (!pane) return;

    const tabIndex = pane.tabs.findIndex((t) => t.id === tabId);
    if (tabIndex === -1) return;

    pane.tabs.splice(tabIndex, 1);

    // Update active tab in pane
    if (pane.activeTabId === tabId) {
      if (pane.tabs.length > 0) {
        const newIndex = Math.min(tabIndex, pane.tabs.length - 1);
        pane.activeTabId = pane.tabs[newIndex]?.id;
        if (activePaneId.value === paneId) {
          activeTabId.value = pane.activeTabId;
        }
      } else {
        pane.activeTabId = undefined;
      }
    }

    // If pane is empty and there are other panes, close it
    if (pane.tabs.length === 0 && editorPanes.value.length > 1) {
      closePane(paneId);
    }

    // Remove from global tabs if not in any pane
    const isInAnyPane = editorPanes.value.some((p) => p.tabs.some((t) => t.id === tabId));
    if (!isInAnyPane) {
      const globalTabIndex = openTabs.value.findIndex((t) => t.id === tabId);
      if (globalTabIndex !== -1) {
        openTabs.value.splice(globalTabIndex, 1);
      }
    }

    void saveState();
  }

  /**
   * Reorder tabs within a specific pane
   */
  function reorderTabsInPane(fromIndex: number, toIndex: number, paneId: string): void {
    const pane = editorPanes.value.find((p) => p.id === paneId);
    if (!pane) return;

    const [movedTab] = pane.tabs.splice(fromIndex, 1);
    if (movedTab) {
      pane.tabs.splice(toIndex, 0, movedTab);
      void saveState();
    }
  }

  /**
   * Update pane sizes after resize
   */
  function updatePaneSizes(sizes: { id: string; size: number }[]): void {
    for (const { id, size } of sizes) {
      const pane = editorPanes.value.find((p) => p.id === id);
      if (pane) {
        pane.size = size;
      }
    }
    void saveState();
  }

  /**
   * Toggle split direction
   */
  function toggleSplitDirection(): void {
    splitDirection.value = splitDirection.value === 'horizontal' ? 'vertical' : 'horizontal';
    void saveState();
  }

  return {
    // State
    sidebarWidth,
    sidebarCollapsed,
    panelHeight,
    panelCollapsed,
    activityBarWidth,
    activeActivity,
    activePanel,
    theme,
    locale,
    openTabs,
    activeTabId,
    isInitialized,

    // Editor pane state
    editorPanes,
    activePaneId,
    splitDirection,

    // Getters
    activeTab,
    activePane,
    hasUnsavedChanges,
    effectiveTheme,
    isDarkMode,
    isSplitView,
    getTabsByCategory,

    // Actions
    initialize,
    saveState,
    setTheme,
    toggleSidebar,
    setSidebarWidth,
    setSidebarCollapsed,
    setActiveActivity,
    togglePanel,
    setPanelHeight,
    setPanelCollapsed,
    setActivePanel,
    openTab,
    closeTab,
    closeAllTabs,
    closeOtherTabs,
    setActiveTab,
    setTabDirty,
    pinTab,
    unpinTab,
    reorderTabs,
    updateTabFilePath,
    setLocale,

    // Split pane actions
    ensurePaneExists,
    setActivePane,
    splitEditor,
    closePane,
    moveTabToPane,
    openTabInPane,
    setActiveTabInPane,
    closeTabInPane,
    reorderTabsInPane,
    updatePaneSizes,
    toggleSplitDirection,
  };
});
