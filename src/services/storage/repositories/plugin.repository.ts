import { getDB } from '../db';
import { BaseRepository } from './base.repository';
import type { IPlugin, PluginType } from '../entities';

/**
 * Repository for managing installed plugins in IndexedDB.
 * Plugins are fetched from the marketplace and stored locally when installed.
 */
export class PluginRepository extends BaseRepository<IPlugin, string> {
  private static instance: PluginRepository | null = null;

  private constructor() {
    super(getDB().plugins);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PluginRepository {
    if (!PluginRepository.instance) {
      PluginRepository.instance = new PluginRepository();
    }
    return PluginRepository.instance;
  }

  /**
   * Get all installed plugins
   */
  async getAllPlugins(): Promise<IPlugin[]> {
    return this.table.orderBy('installedAt').reverse().toArray();
  }

  /**
   * Get a plugin by its ID
   */
  async getPluginById(id: string): Promise<IPlugin | undefined> {
    return this.getById(id);
  }

  /**
   * Get plugins by type
   */
  async getByType(type: PluginType): Promise<IPlugin[]> {
    return this.table.where('type').equals(type).toArray();
  }

  /**
   * Get plugins matching any of the given tags
   */
  async getByTags(tags: string[]): Promise<IPlugin[]> {
    if (tags.length === 0) {
      return this.getAllPlugins();
    }

    // Use anyOf for multi-entry index on tags
    const lowerTags = tags.map((t) => t.toLowerCase());
    return this.filter((plugin) =>
      plugin.tags.some((tag) => lowerTags.includes(tag.toLowerCase()))
    );
  }

  /**
   * Get plugins by type and tags
   */
  async getByTypeAndTags(type: PluginType, tags: string[]): Promise<IPlugin[]> {
    const byType = await this.getByType(type);

    if (tags.length === 0) {
      return byType;
    }

    const lowerTags = tags.map((t) => t.toLowerCase());
    return byType.filter((plugin) =>
      plugin.tags.some((tag) => lowerTags.includes(tag.toLowerCase()))
    );
  }

  /**
   * Install a new plugin
   * Note: We deep-clone the plugin data to ensure it's plain objects for IndexedDB storage
   */
  async install(plugin: Omit<IPlugin, 'installedAt' | 'updatedAt'>): Promise<IPlugin> {
    const now = new Date();

    // Deep clone the plugin data to ensure plain objects for IndexedDB
    // This strips out any prototype chains or non-serializable properties
    const cleanPlugin = JSON.parse(JSON.stringify(plugin)) as Omit<
      IPlugin,
      'installedAt' | 'updatedAt'
    >;

    const fullPlugin: IPlugin = {
      ...cleanPlugin,
      installedAt: now,
      updatedAt: now,
    };

    await this.upsert(fullPlugin);
    return fullPlugin;
  }

  /**
   * Update an existing plugin (e.g., when a new version is available)
   * Note: We deep-clone the plugin data to ensure it's plain objects for IndexedDB storage
   */
  async updatePlugin(plugin: Omit<IPlugin, 'installedAt' | 'updatedAt'>): Promise<IPlugin> {
    const existing = await this.getById(plugin.id);
    if (!existing) {
      throw new Error(`Plugin not found: ${plugin.id}`);
    }

    // Deep clone the plugin data to ensure plain objects for IndexedDB
    const cleanPlugin = JSON.parse(JSON.stringify(plugin)) as Omit<
      IPlugin,
      'installedAt' | 'updatedAt'
    >;

    const updatedPlugin: IPlugin = {
      ...cleanPlugin,
      installedAt: existing.installedAt,
      updatedAt: new Date(),
    };

    await this.upsert(updatedPlugin);
    return updatedPlugin;
  }

  /**
   * Uninstall a plugin by ID
   */
  async uninstall(id: string): Promise<void> {
    await this.delete(id);
  }

  /**
   * Check if a plugin is installed
   */
  async isInstalled(id: string): Promise<boolean> {
    return this.exists(id);
  }

  /**
   * Get all unique tags from installed plugins
   */
  async getAllTags(): Promise<string[]> {
    const plugins = await this.getAllPlugins();
    const tags = new Set<string>();

    for (const plugin of plugins) {
      for (const tag of plugin.tags) {
        tags.add(tag);
      }
    }

    return Array.from(tags).sort();
  }

  /**
   * Get installed plugin IDs as a Set (useful for filtering marketplace)
   */
  async getInstalledIds(): Promise<Set<string>> {
    const plugins = await this.getAllPlugins();
    return new Set(plugins.map((p) => p.id));
  }

  /**
   * Get plugin count by type
   */
  async countByType(type: PluginType): Promise<number> {
    return this.table.where('type').equals(type).count();
  }

  /**
   * Search plugins by query (searches in type and tags)
   */
  async search(query: string): Promise<IPlugin[]> {
    const normalizedQuery = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (!normalizedQuery) {
      return this.getAllPlugins();
    }

    return this.filter((plugin) => {
      const normalizedType = plugin.type
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const normalizedTags = plugin.tags
        .join(' ')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      return normalizedType.includes(normalizedQuery) || normalizedTags.includes(normalizedQuery);
    });
  }

  /**
   * Clear all installed plugins (for troubleshooting)
   */
  async clearAllPlugins(): Promise<void> {
    await this.clear();
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    PluginRepository.instance = null;
  }
}

// Export a convenience function to get the repository
export function getPluginRepository(): PluginRepository {
  return PluginRepository.getInstance();
}
