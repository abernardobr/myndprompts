import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db';
import { BaseRepository } from './base.repository';
import type { IConfiguredModel, AIProviderType } from '../entities';

/**
 * Repository for managing configured AI models.
 *
 * Each entry represents a model the user has explicitly added
 * to their available model list.
 */
export class ConfiguredModelsRepository extends BaseRepository<IConfiguredModel, string> {
  private static instance: ConfiguredModelsRepository | null = null;

  private constructor() {
    super(getDB().configuredModels);
  }

  static getInstance(): ConfiguredModelsRepository {
    if (!ConfiguredModelsRepository.instance) {
      ConfiguredModelsRepository.instance = new ConfiguredModelsRepository();
    }
    return ConfiguredModelsRepository.instance;
  }

  /**
   * Add a model to the configured list
   */
  async addModel(
    provider: AIProviderType,
    modelId: string,
    modelName: string
  ): Promise<IConfiguredModel> {
    const existing = await this.getAll();
    const isDefault = existing.length === 0;

    const model: IConfiguredModel = {
      id: uuidv4(),
      provider,
      modelId,
      modelName,
      isDefault,
      addedAt: new Date(),
    };

    await this.create(model);
    return model;
  }

  /**
   * Remove a model. If it was default, assign the next remaining as default.
   */
  async removeModel(id: string): Promise<void> {
    const model = await this.getById(id);
    if (!model) return;

    await this.delete(id);

    if (model.isDefault) {
      const remaining = await this.getAll();
      const first = remaining[0];
      if (first !== undefined) {
        await this.update(first.id, { isDefault: true });
      }
    }
  }

  /**
   * Get the current default model
   */
  async getDefaultModel(): Promise<IConfiguredModel | undefined> {
    return this.findFirst((m) => m.isDefault);
  }

  /**
   * Set a model as default (unsets all others)
   */
  async setDefaultModel(id: string): Promise<void> {
    const db = getDB();
    await db.transaction('rw', db.configuredModels, async () => {
      const all = await this.getAll();
      for (const m of all) {
        if (m.isDefault && m.id !== id) {
          await this.update(m.id, { isDefault: false });
        }
      }
      await this.update(id, { isDefault: true });
    });
  }

  /**
   * Check if a specific model from a provider is already configured
   */
  async modelExists(provider: AIProviderType, modelId: string): Promise<boolean> {
    const found = await this.findFirst((m) => m.provider === provider && m.modelId === modelId);
    return found !== undefined;
  }

  /**
   * Get all models for a specific provider
   */
  async getByProvider(provider: AIProviderType): Promise<IConfiguredModel[]> {
    return this.filter((m) => m.provider === provider);
  }

  static resetInstance(): void {
    ConfiguredModelsRepository.instance = null;
  }
}

export function getConfiguredModelsRepository(): ConfiguredModelsRepository {
  return ConfiguredModelsRepository.getInstance();
}
