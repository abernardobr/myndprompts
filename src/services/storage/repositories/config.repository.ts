import { getDB } from '../db';
import { BaseRepository } from './base.repository';
import type { IAppConfig } from '../entities';

/**
 * Configuration keys used in the application
 */
export const ConfigKeys = {
  PROMPTS_DIR: 'prompts.directory',
  SNIPPETS_DIR: 'snippets.directory',
  PERSONAS_DIR: 'personas.directory',
  TEMPLATES_DIR: 'templates.directory',
  BACKUP_DIR: 'backup.directory',
  AUTO_SAVE: 'editor.autoSave',
  AUTO_SAVE_DELAY: 'editor.autoSaveDelay',
  FONT_SIZE: 'editor.fontSize',
  FONT_FAMILY: 'editor.fontFamily',
  TAB_SIZE: 'editor.tabSize',
  WORD_WRAP: 'editor.wordWrap',
  LINE_NUMBERS: 'editor.lineNumbers',
  MINIMAP_ENABLED: 'editor.minimapEnabled',
  SYNC_ENABLED: 'sync.enabled',
  SYNC_INTERVAL: 'sync.interval',
  SYNC_ON_STARTUP: 'sync.onStartup',
  GIT_AUTO_COMMIT: 'git.autoCommit',
  GIT_COMMIT_ON_SAVE: 'git.commitOnSave',
  TELEMETRY_ENABLED: 'telemetry.enabled',
  FIRST_RUN_COMPLETED: 'app.firstRunCompleted',
  LAST_VERSION: 'app.lastVersion',
  PROMPT_CATEGORIES: 'prompts.categories',
  HELP_DIALOG_DONT_SHOW: 'app.helpDialogDontShow',
} as const;

export type ConfigKey = (typeof ConfigKeys)[keyof typeof ConfigKeys];

/**
 * Repository for managing application configuration.
 */
export class ConfigRepository extends BaseRepository<IAppConfig, string> {
  private static instance: ConfigRepository | null = null;

  private constructor() {
    super(getDB().appConfig);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ConfigRepository {
    if (!ConfigRepository.instance) {
      ConfigRepository.instance = new ConfigRepository();
    }
    return ConfigRepository.instance;
  }

  /**
   * Get a configuration value by key
   */
  async get<T>(key: ConfigKey): Promise<T | undefined> {
    const config = await this.getById(key);
    return config?.value as T | undefined;
  }

  /**
   * Get a configuration value with a default fallback
   */
  async getOrDefault<T>(key: ConfigKey, defaultValue: T): Promise<T> {
    const value = await this.get<T>(key);
    return value ?? defaultValue;
  }

  /**
   * Set a configuration value
   */
  async set<T>(key: ConfigKey, value: T): Promise<void> {
    await this.upsert({
      key,
      value,
      updatedAt: new Date(),
    });
  }

  /**
   * Remove a configuration value
   */
  async remove(key: ConfigKey): Promise<void> {
    await this.delete(key);
  }

  /**
   * Check if a configuration key exists
   */
  async has(key: ConfigKey): Promise<boolean> {
    return this.exists(key);
  }

  /**
   * Get multiple configuration values at once
   */
  async getMany<T extends Record<string, unknown>>(keys: ConfigKey[]): Promise<Partial<T>> {
    const results: Partial<T> = {};
    const configs = await this.table.where('key').anyOf(keys).toArray();

    for (const config of configs) {
      (results as Record<string, unknown>)[config.key] = config.value;
    }

    return results;
  }

  /**
   * Set multiple configuration values at once
   */
  async setMany(configs: Partial<Record<ConfigKey, unknown>>): Promise<void> {
    const entities: IAppConfig[] = Object.entries(configs).map(([key, value]) => ({
      key,
      value,
      updatedAt: new Date(),
    }));
    await this.upsertMany(entities);
  }

  /**
   * Initialize default configuration values if not set
   */
  async initializeDefaults(defaults: Partial<Record<ConfigKey, unknown>>): Promise<void> {
    for (const [key, value] of Object.entries(defaults)) {
      const exists = await this.has(key as ConfigKey);
      if (!exists) {
        await this.set(key as ConfigKey, value);
      }
    }
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    ConfigRepository.instance = null;
  }
}

// Export a convenience function to get the repository
export function getConfigRepository(): ConfigRepository {
  return ConfigRepository.getInstance();
}
