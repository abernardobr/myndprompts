/**
 * Plugin Store
 *
 * Pinia store for managing plugins from marketplace and local storage.
 * Handles fetching, installing, updating, and uninstalling plugins.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getPluginService } from '@/services/plugins';
import { useSnippetStore } from '@/stores/snippetStore';
import type { IPlugin, PluginType } from '@/services/storage/entities';
import type { IMarketplacePlugin, IPluginUpdateInfo } from '@/services/plugins/types';

export const usePluginStore = defineStore('plugins', () => {
  // Service instance
  const pluginService = getPluginService();

  // ================================
  // State
  // ================================

  const isInitialized = ref(false);
  const isLoading = ref(false);
  const isMarketplaceLoading = ref(false);
  const error = ref<string | null>(null);
  const isOffline = ref(false);

  // Plugin data
  const marketplace = ref<IMarketplacePlugin[]>([]);
  const installed = ref<IPlugin[]>([]);
  const updates = ref<IPluginUpdateInfo[]>([]);

  // Filter state
  const searchQuery = ref('');
  const selectedTypes = ref<PluginType[]>([]);
  const selectedTags = ref<string[]>([]);
  const selectedLanguage = ref<string | null>(null);

  // ================================
  // Computed / Getters
  // ================================

  /**
   * Available plugins (marketplace minus installed)
   */
  const availablePlugins = computed(() => {
    const installedIds = new Set(installed.value.map((p) => p.id));
    return marketplace.value.filter((p) => !installedIds.has(p.id));
  });

  /**
   * Get all types from a plugin (plugin-level and item-level)
   */
  function getPluginTypes(plugin: IMarketplacePlugin | IPlugin): PluginType[] {
    const types: PluginType[] = [];
    if (plugin.type) {
      types.push(plugin.type);
    }
    plugin.items.forEach((item) => {
      if (item.type && !types.includes(item.type)) {
        types.push(item.type);
      }
    });
    return types;
  }

  /**
   * Get all tags from a plugin (plugin-level and item-level)
   */
  function getPluginTags(plugin: IMarketplacePlugin | IPlugin): string[] {
    const tags = [...plugin.tags];
    plugin.items.forEach((item) => {
      item.tags?.forEach((tag) => {
        if (!tags.includes(tag)) {
          tags.push(tag);
        }
      });
    });
    return tags;
  }

  /**
   * Get all unique languages from a plugin's items
   */
  function getPluginLanguages(plugin: IMarketplacePlugin | IPlugin): string[] {
    const languages = new Set<string>();
    plugin.items.forEach((item) => {
      if (item.language) {
        languages.add(item.language);
      }
    });
    return Array.from(languages);
  }

  /**
   * Filtered marketplace plugins based on search query, type, and tags
   * Uses diacritics-insensitive search
   */
  const filteredMarketplace = computed(() => {
    let result = availablePlugins.value;

    // Filter by search query (diacritics-insensitive)
    if (searchQuery.value) {
      const query = normalizeForSearch(searchQuery.value);
      result = result.filter((p) => {
        const types = normalizeForSearch(getPluginTypes(p).join(' '));
        const tags = normalizeForSearch(getPluginTags(p).join(' '));
        const id = normalizeForSearch(p.id);
        const name = normalizeForSearch(p.name);
        return (
          types.includes(query) ||
          tags.includes(query) ||
          id.includes(query) ||
          name.includes(query)
        );
      });
    }

    // Filter by type (check both plugin-level and item-level types)
    if (selectedTypes.value.length > 0) {
      result = result.filter((p) => {
        const pluginTypes = getPluginTypes(p);
        return selectedTypes.value.some((t) => pluginTypes.includes(t));
      });
    }

    // Filter by tags (check both plugin-level and item-level tags)
    if (selectedTags.value.length > 0) {
      result = result.filter((p) => {
        const pluginTags = getPluginTags(p);
        return selectedTags.value.some((tag) => pluginTags.includes(tag));
      });
    }

    // Filter by language (check item-level languages)
    const lang = selectedLanguage.value;
    if (lang) {
      result = result.filter((p) => {
        const pluginLanguages = getPluginLanguages(p);
        return pluginLanguages.includes(lang);
      });
    }

    return result;
  });

  /**
   * All unique tags from marketplace and installed plugins (including item-level tags)
   */
  const allTags = computed(() => {
    const tags = new Set<string>();
    [...marketplace.value, ...installed.value].forEach((p) => {
      // Plugin-level tags
      p.tags.forEach((tag) => tags.add(tag));
      // Item-level tags
      p.items.forEach((item) => {
        item.tags?.forEach((tag) => tags.add(tag));
      });
    });
    return Array.from(tags).sort();
  });

  /**
   * All unique languages from marketplace and installed plugins (item-level)
   */
  const allLanguages = computed(() => {
    const languages = new Set<string>();
    [...marketplace.value, ...installed.value].forEach((p) => {
      getPluginLanguages(p).forEach((lang) => languages.add(lang));
    });
    return Array.from(languages).sort((a, b) => a.localeCompare(b));
  });

  /**
   * All unique types from marketplace and installed plugins (including item-level types)
   */
  const allTypes = computed(() => {
    const types = new Set<PluginType>();
    [...marketplace.value, ...installed.value].forEach((p) => {
      // Plugin-level type
      if (p.type) {
        types.add(p.type);
      }
      // Item-level types
      p.items.forEach((item) => {
        if (item.type) {
          types.add(item.type);
        }
      });
    });
    return Array.from(types);
  });

  /**
   * Whether there are any updates available
   */
  const hasUpdates = computed(() => updates.value.length > 0);

  /**
   * Number of available updates
   */
  const updateCount = computed(() => updates.value.length);

  // ================================
  // Utilities
  // ================================

  /**
   * Normalize string for diacritics-insensitive search
   */
  function normalizeForSearch(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  // ================================
  // Actions
  // ================================

  /**
   * Initialize the store
   * Loads installed plugins and fetches marketplace
   */
  async function initialize(): Promise<void> {
    console.log('[PluginStore] initialize called, isInitialized:', isInitialized.value);
    if (isInitialized.value) return;

    try {
      isLoading.value = true;
      error.value = null;

      console.log('[PluginStore] Loading installed plugins and fetching marketplace...');
      // Load installed plugins and marketplace in parallel
      await Promise.all([refreshInstalled(), refreshMarketplace()]);

      // Check for updates
      console.log('[PluginStore] Checking for updates...');
      await checkForUpdates();

      isInitialized.value = true;
      console.log('[PluginStore] Initialization complete');
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to initialize plugin store';
      console.error('[PluginStore] Failed to initialize plugin store:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Check if browser is online
   */
  function checkOnlineStatus(): boolean {
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      return navigator.onLine;
    }
    return true; // Assume online if we can't check
  }

  /**
   * Refresh marketplace plugins from API
   */
  async function refreshMarketplace(forceRefresh = false): Promise<void> {
    console.log('[PluginStore] refreshMarketplace called, forceRefresh:', forceRefresh);
    try {
      isLoading.value = true;
      isMarketplaceLoading.value = true;
      error.value = null;
      isOffline.value = false;

      // Check if we're offline before attempting fetch
      if (!checkOnlineStatus()) {
        console.log('[PluginStore] Device appears to be offline');
        isOffline.value = true;
        error.value = 'offline';
        return;
      }

      console.log('[PluginStore] Fetching marketplace plugins...');
      marketplace.value = await pluginService.fetchMarketplace(forceRefresh);
      console.log('[PluginStore] Fetched', marketplace.value.length, 'plugins from marketplace');
    } catch (err) {
      console.error('[PluginStore] Failed to fetch marketplace:', err);
      // Check if error is due to being offline
      if (!checkOnlineStatus()) {
        isOffline.value = true;
        error.value = 'offline';
      } else {
        error.value = err instanceof Error ? err.message : 'Failed to fetch marketplace';
      }
      // Don't throw - allow using cached/empty data
    } finally {
      isLoading.value = false;
      isMarketplaceLoading.value = false;
    }
  }

  /**
   * Refresh installed plugins from local storage
   */
  async function refreshInstalled(): Promise<void> {
    try {
      installed.value = await pluginService.getInstalledPlugins();
    } catch (err) {
      console.error('Failed to refresh installed plugins:', err);
      throw err;
    }
  }

  /**
   * Check for available updates
   */
  async function checkForUpdates(): Promise<void> {
    try {
      updates.value = await pluginService.checkForUpdates();
    } catch (err) {
      console.error('Failed to check for updates:', err);
      // Don't throw - updates checking is not critical
    }
  }

  /**
   * Install a plugin from marketplace
   * @returns true if successful, false otherwise
   */
  async function installPlugin(plugin: IMarketplacePlugin): Promise<boolean> {
    try {
      isLoading.value = true;
      error.value = null;

      const result = await pluginService.installPlugin(plugin);

      if (!result.success) {
        error.value = result.error ?? 'Failed to install plugin';
        return false;
      }

      // Refresh installed plugins
      await refreshInstalled();

      // Refresh snippets to show newly installed plugin items
      const snippetStore = useSnippetStore();
      await snippetStore.refreshAllSnippets();

      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to install plugin';
      console.error('Failed to install plugin:', err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Update an installed plugin to a new version
   * @returns true if successful, false otherwise
   */
  async function updatePlugin(plugin: IMarketplacePlugin): Promise<boolean> {
    try {
      isLoading.value = true;
      error.value = null;

      const result = await pluginService.updatePlugin(plugin);

      if (!result.success) {
        error.value = result.error ?? 'Failed to update plugin';
        return false;
      }

      // Refresh installed plugins and update info
      await Promise.all([refreshInstalled(), checkForUpdates()]);

      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update plugin';
      console.error('Failed to update plugin:', err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Uninstall a plugin
   * @returns true if successful, false otherwise
   */
  async function uninstallPlugin(id: string): Promise<boolean> {
    try {
      isLoading.value = true;
      error.value = null;

      const result = await pluginService.uninstallPlugin(id);

      if (!result.success) {
        error.value = result.error ?? 'Failed to uninstall plugin';
        return false;
      }

      // Refresh installed plugins, update info, and refresh snippets (since we deleted snippet files)
      const snippetStore = useSnippetStore();
      await Promise.all([refreshInstalled(), checkForUpdates(), snippetStore.refreshAllSnippets()]);

      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to uninstall plugin';
      console.error('Failed to uninstall plugin:', err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  // ================================
  // Filter Actions
  // ================================

  /**
   * Set the search query
   */
  function setSearchQuery(query: string): void {
    searchQuery.value = query;
  }

  /**
   * Set selected types filter
   */
  function setSelectedTypes(types: PluginType[]): void {
    selectedTypes.value = types;
  }

  /**
   * Set selected tags filter
   */
  function setSelectedTags(tags: string[]): void {
    selectedTags.value = tags;
  }

  /**
   * Set selected language filter
   */
  function setSelectedLanguage(language: string | null): void {
    selectedLanguage.value = language;
  }

  /**
   * Clear all filters
   */
  function clearFilters(): void {
    searchQuery.value = '';
    selectedTypes.value = [];
    selectedTags.value = [];
    selectedLanguage.value = null;
  }

  // ================================
  // Helper Methods
  // ================================

  /**
   * Get installed plugins by type
   */
  function getInstalledByType(type: PluginType): IPlugin[] {
    return installed.value.filter((p) => p.type === type);
  }

  /**
   * Get update info for a specific plugin
   */
  function getUpdateForPlugin(id: string): IPluginUpdateInfo | undefined {
    return updates.value.find((u) => u.pluginId === id);
  }

  /**
   * Get marketplace plugin by ID
   */
  function getMarketplacePlugin(id: string): IMarketplacePlugin | undefined {
    return marketplace.value.find((p) => p.id === id);
  }

  /**
   * Check if a plugin is installed
   */
  function isPluginInstalled(id: string): boolean {
    return installed.value.some((p) => p.id === id);
  }

  /**
   * Clear error state
   */
  function clearError(): void {
    error.value = null;
  }

  /**
   * Clear marketplace cache and refresh
   */
  async function clearCacheAndRefresh(): Promise<void> {
    pluginService.clearCache();
    await refreshMarketplace(true);
  }

  /**
   * Clear all installed plugins from IndexedDB and delete their snippet files (for troubleshooting corrupt data)
   */
  async function clearAllPlugins(): Promise<void> {
    try {
      await pluginService.clearAllPlugins();
      installed.value = [];
      updates.value = [];

      // Refresh snippets since we deleted snippet files
      const snippetStore = useSnippetStore();
      await snippetStore.refreshAllSnippets();
    } catch (err) {
      console.error('Failed to clear all plugins:', err);
      throw err;
    }
  }

  return {
    // State
    isInitialized,
    isLoading,
    isMarketplaceLoading,
    error,
    isOffline,
    marketplace,
    installed,
    updates,
    searchQuery,
    selectedTypes,
    selectedTags,
    selectedLanguage,

    // Computed / Getters
    availablePlugins,
    filteredMarketplace,
    allTags,
    allTypes,
    allLanguages,
    hasUpdates,
    updateCount,

    // Utility functions
    getPluginTypes,
    getPluginTags,
    getPluginLanguages,

    // Actions
    initialize,
    refreshMarketplace,
    refreshInstalled,
    checkForUpdates,
    installPlugin,
    updatePlugin,
    uninstallPlugin,

    // Filter Actions
    setSearchQuery,
    setSelectedTypes,
    setSelectedTags,
    setSelectedLanguage,
    clearFilters,

    // Helper Methods
    getInstalledByType,
    getUpdateForPlugin,
    getMarketplacePlugin,
    isPluginInstalled,
    clearError,
    clearCacheAndRefresh,
    clearAllPlugins,
  };
});
