import { getPluginRepository } from '../storage/repositories';
import { getPromptFileService } from '../file-system';
import type { IPlugin, PluginType } from '../storage/entities';
import type { ISnippetMetadata } from '../file-system/types';
import type { IMarketplacePlugin, IPluginUpdateInfo, IPluginOperationResult } from './types';

/**
 * Service for managing plugins from marketplace and local storage.
 * Handles fetching, installing, updating, and uninstalling plugins.
 */
export class PluginService {
  private static instance: PluginService;

  private readonly marketplaceUrl = 'https://www.myndprompts.com/plugins';
  private readonly cacheDurationMs = 5 * 60 * 1000; // 5 minutes

  private marketplaceCache: IMarketplacePlugin[] | null = null;
  private lastFetchTime: number = 0;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): PluginService {
    if (!PluginService.instance) {
      PluginService.instance = new PluginService();
    }
    return PluginService.instance;
  }

  // ==========================================
  // Marketplace Operations
  // ==========================================

  /**
   * Fetch all plugins from the marketplace API
   * Uses caching to avoid excessive API calls
   */
  async fetchMarketplace(forceRefresh = false): Promise<IMarketplacePlugin[]> {
    const now = Date.now();
    const cacheValid =
      !forceRefresh &&
      this.marketplaceCache !== null &&
      now - this.lastFetchTime < this.cacheDurationMs;

    if (cacheValid && this.marketplaceCache) {
      console.log('[PluginService] Returning cached marketplace data');
      return this.marketplaceCache;
    }

    try {
      console.log('[PluginService] Fetching from:', this.marketplaceUrl);
      const response = await fetch(this.marketplaceUrl);

      console.log('[PluginService] Response status:', response.status, response.statusText);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as IMarketplacePlugin[];
      console.log('[PluginService] Raw data received:', data.length, 'items');

      // Validate and clean the data
      this.marketplaceCache = data.filter((plugin) => this.isValidPlugin.call(this, plugin));
      console.log('[PluginService] Valid plugins after filtering:', this.marketplaceCache.length);
      this.lastFetchTime = now;

      return this.marketplaceCache;
    } catch (error) {
      console.error('[PluginService] Fetch error:', error);
      // If we have cached data, return it even if stale
      if (this.marketplaceCache) {
        console.warn('[PluginService] Using stale marketplace cache due to fetch error');
        return this.marketplaceCache;
      }
      throw error;
    }
  }

  /**
   * Get available plugins (marketplace minus already installed)
   */
  async getAvailablePlugins(forceRefresh = false): Promise<IMarketplacePlugin[]> {
    const [marketplace, installedIds] = await Promise.all([
      this.fetchMarketplace(forceRefresh),
      getPluginRepository().getInstalledIds(),
    ]);

    return marketplace.filter((plugin) => !installedIds.has(plugin.id));
  }

  /**
   * Clear the marketplace cache
   */
  clearCache(): void {
    this.marketplaceCache = null;
    this.lastFetchTime = 0;
  }

  // ==========================================
  // Local Operations
  // ==========================================

  /**
   * Get all installed plugins
   */
  async getInstalledPlugins(): Promise<IPlugin[]> {
    return getPluginRepository().getAllPlugins();
  }

  /**
   * Get installed plugins by type
   */
  async getInstalledByType(type: PluginType): Promise<IPlugin[]> {
    return getPluginRepository().getByType(type);
  }

  /**
   * Map plugin type to snippet type
   * Handles both singular and plural forms from marketplace
   */
  private mapPluginTypeToSnippetType(pluginType: string): ISnippetMetadata['type'] {
    // Normalize the type - handle both singular and plural forms
    const normalizedType = pluginType.toLowerCase().replace(/s$/, '');

    switch (normalizedType) {
      case 'persona':
        return 'persona';
      case 'text_snippet':
        return 'text';
      case 'code_snippet':
        return 'code';
      case 'template':
        return 'template';
      default:
        console.warn(`[PluginService] Unknown plugin type "${pluginType}", defaulting to "text"`);
        return 'text';
    }
  }

  /**
   * Install a plugin from the marketplace
   * This stores the plugin metadata in IndexedDB and creates snippet files for each item
   */
  async installPlugin(plugin: IMarketplacePlugin): Promise<IPluginOperationResult> {
    try {
      // Check if already installed
      const isInstalled = await getPluginRepository().isInstalled(plugin.id);
      if (isInstalled) {
        return {
          success: false,
          error: 'Plugin is already installed',
        };
      }

      // Deep clone to strip Vue reactive proxies and ensure plain objects for IndexedDB
      const cleanPlugin = JSON.parse(
        JSON.stringify({
          id: plugin.id,
          name: plugin.name,
          description: plugin.description,
          version: plugin.version,
          type: plugin.type,
          tags: plugin.tags,
          items: plugin.items,
        })
      ) as Omit<import('../storage/entities').IPlugin, 'installedAt' | 'updatedAt'>;

      // Install the plugin metadata in IndexedDB
      await getPluginRepository().install(cleanPlugin);

      // Create snippet files for each plugin item
      const snippetService = getPromptFileService();
      const snippetType = this.mapPluginTypeToSnippetType(plugin.type);
      console.log(
        `[PluginService] Installing plugin "${plugin.id}" with type "${plugin.type}" -> snippetType "${snippetType}"`
      );

      for (const item of cleanPlugin.items) {
        try {
          console.log(
            `[PluginService] Creating snippet "${item.title}" with type "${snippetType}" and tags:`,
            cleanPlugin.tags
          );
          await snippetService.createSnippet(
            item.title,
            snippetType,
            item.content,
            cleanPlugin.tags,
            item.description
          );
        } catch (err) {
          // Log but don't fail the whole installation if one snippet fails
          // (e.g., if a snippet with that name already exists)
          console.warn(`[PluginService] Failed to create snippet "${item.title}":`, err);
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update an installed plugin to a new version
   */
  async updatePlugin(plugin: IMarketplacePlugin): Promise<IPluginOperationResult> {
    try {
      // Check if installed
      const isInstalled = await getPluginRepository().isInstalled(plugin.id);
      if (!isInstalled) {
        return {
          success: false,
          error: 'Plugin is not installed',
        };
      }

      // Deep clone to strip Vue reactive proxies and ensure plain objects for IndexedDB
      const cleanPlugin = JSON.parse(
        JSON.stringify({
          id: plugin.id,
          name: plugin.name,
          description: plugin.description,
          version: plugin.version,
          type: plugin.type,
          tags: plugin.tags,
          items: plugin.items,
        })
      ) as Omit<import('../storage/entities').IPlugin, 'installedAt' | 'updatedAt'>;

      // Update the plugin
      await getPluginRepository().updatePlugin(cleanPlugin);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Uninstall a plugin and remove its associated snippet files
   */
  async uninstallPlugin(id: string): Promise<IPluginOperationResult> {
    try {
      // Get the plugin data before uninstalling (to know which snippets to delete)
      const plugin = await getPluginRepository().getPluginById(id);
      if (!plugin) {
        return {
          success: false,
          error: 'Plugin is not installed',
        };
      }

      // Delete the snippet files that were created during installation
      const snippetService = getPromptFileService();
      const allSnippets = await snippetService.listSnippets();

      for (const item of plugin.items) {
        // Find the snippet file by matching the title/name
        const matchingSnippet = allSnippets.find((snippet) => snippet.metadata.name === item.title);

        if (matchingSnippet) {
          try {
            console.log(
              `[PluginService] Deleting snippet "${item.title}" at ${matchingSnippet.filePath}`
            );
            await snippetService.deleteSnippet(matchingSnippet.filePath);
          } catch (err) {
            // Log but don't fail the whole uninstallation if one snippet fails to delete
            console.warn(`[PluginService] Failed to delete snippet "${item.title}":`, err);
          }
        } else {
          console.warn(`[PluginService] Snippet "${item.title}" not found for deletion`);
        }
      }

      // Remove plugin metadata from IndexedDB
      await getPluginRepository().uninstall(id);
      console.log(`[PluginService] Plugin "${id}" uninstalled successfully`);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if a plugin is installed
   */
  async isPluginInstalled(id: string): Promise<boolean> {
    return getPluginRepository().isInstalled(id);
  }

  // ==========================================
  // Update Checking
  // ==========================================

  /**
   * Check for available updates for installed plugins
   */
  async checkForUpdates(): Promise<IPluginUpdateInfo[]> {
    const [marketplace, installed] = await Promise.all([
      this.fetchMarketplace(),
      this.getInstalledPlugins(),
    ]);

    const marketplaceMap = new Map(marketplace.map((p) => [p.id, p]));
    const updates: IPluginUpdateInfo[] = [];

    for (const plugin of installed) {
      const marketplaceVersion = marketplaceMap.get(plugin.id);
      if (marketplaceVersion && this.hasUpdate(plugin.version, marketplaceVersion.version)) {
        updates.push({
          pluginId: plugin.id,
          currentVersion: plugin.version,
          availableVersion: marketplaceVersion.version,
        });
      }
    }

    return updates;
  }

  /**
   * Get update info for a specific plugin
   */
  async getUpdateForPlugin(pluginId: string): Promise<IPluginUpdateInfo | null> {
    const updates = await this.checkForUpdates();
    return updates.find((u) => u.pluginId === pluginId) ?? null;
  }

  /**
   * Compare versions to determine if an update is available
   * Returns true if availableVersion > installedVersion
   */
  hasUpdate(installedVersion: string, availableVersion: string): boolean {
    return this.compareVersions(availableVersion, installedVersion) > 0;
  }

  /**
   * Compare two semantic versions
   * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map((p) => parseInt(p, 10) || 0);
    const parts2 = v2.split('.').map((p) => parseInt(p, 10) || 0);

    // Pad arrays to same length
    const maxLength = Math.max(parts1.length, parts2.length);
    while (parts1.length < maxLength) parts1.push(0);
    while (parts2.length < maxLength) parts2.push(0);

    for (let i = 0; i < maxLength; i++) {
      if (parts1[i] > parts2[i]) return 1;
      if (parts1[i] < parts2[i]) return -1;
    }

    return 0;
  }

  // ==========================================
  // Utilities
  // ==========================================

  /**
   * Validate that a plugin object has required fields
   */
  private isValidPlugin(plugin: unknown): plugin is IMarketplacePlugin {
    if (!plugin || typeof plugin !== 'object') return false;

    const p = plugin as Record<string, unknown>;
    return (
      typeof p.id === 'string' &&
      typeof p.name === 'string' &&
      typeof p.version === 'string' &&
      typeof p.type === 'string' &&
      Array.isArray(p.tags) &&
      Array.isArray(p.items)
    );
  }

  /**
   * Get the marketplace plugin data for an installed plugin (for updates)
   */
  async getMarketplacePlugin(id: string): Promise<IMarketplacePlugin | null> {
    const marketplace = await this.fetchMarketplace();
    return marketplace.find((p) => p.id === id) ?? null;
  }

  /**
   * Get all unique tags from marketplace
   */
  async getMarketplaceTags(): Promise<string[]> {
    const marketplace = await this.fetchMarketplace();
    const tags = new Set<string>();

    for (const plugin of marketplace) {
      for (const tag of plugin.tags) {
        tags.add(tag);
      }
    }

    return Array.from(tags).sort();
  }

  /**
   * Filter marketplace plugins by type
   */
  async getMarketplaceByType(type: PluginType): Promise<IMarketplacePlugin[]> {
    const marketplace = await this.fetchMarketplace();
    return marketplace.filter((p) => p.type === type);
  }

  /**
   * Clear all installed plugins from IndexedDB and delete their associated snippet files (for troubleshooting)
   */
  async clearAllPlugins(): Promise<void> {
    // Get all installed plugins before clearing
    const installedPlugins = await getPluginRepository().getAllPlugins();

    if (installedPlugins.length > 0) {
      // Delete all snippet files associated with the plugins
      const snippetService = getPromptFileService();
      const allSnippets = await snippetService.listSnippets();

      for (const plugin of installedPlugins) {
        for (const item of plugin.items) {
          const matchingSnippet = allSnippets.find(
            (snippet) => snippet.metadata.name === item.title
          );

          if (matchingSnippet) {
            try {
              console.log(
                `[PluginService] Deleting snippet "${item.title}" at ${matchingSnippet.filePath}`
              );
              await snippetService.deleteSnippet(matchingSnippet.filePath);
            } catch (err) {
              console.warn(`[PluginService] Failed to delete snippet "${item.title}":`, err);
            }
          }
        }
      }
    }

    // Clear all plugin metadata from IndexedDB
    await getPluginRepository().clearAllPlugins();
    console.log('[PluginService] All plugins cleared');
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    PluginService.instance = undefined as unknown as PluginService;
  }
}

// Export convenience function to get the service
export function getPluginService(): PluginService {
  return PluginService.getInstance();
}
