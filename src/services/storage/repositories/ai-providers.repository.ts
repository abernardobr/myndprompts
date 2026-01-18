import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db';
import { BaseRepository } from './base.repository';
import type { IAIProviderConfig, AIProviderType } from '../entities';
import { DEFAULT_AI_PROVIDERS } from '../entities';

/**
 * Repository for managing AI provider configurations.
 *
 * Note: API keys are stored in the system keychain, not in IndexedDB.
 * This repository only tracks configuration and the presence of keys.
 */
export class AIProvidersRepository extends BaseRepository<IAIProviderConfig, string> {
  private static instance: AIProvidersRepository | null = null;

  private constructor() {
    super(getDB().aiProviders);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AIProvidersRepository {
    if (!AIProvidersRepository.instance) {
      AIProvidersRepository.instance = new AIProvidersRepository();
    }
    return AIProvidersRepository.instance;
  }

  /**
   * Initialize default providers if not exists
   */
  async initializeDefaults(): Promise<void> {
    const count = await this.count();
    if (count === 0) {
      const providers = DEFAULT_AI_PROVIDERS.map((p) => ({
        ...p,
        id: uuidv4(),
      }));
      await this.createMany(providers);
    }
  }

  /**
   * Get provider by type
   */
  async getByProvider(provider: AIProviderType): Promise<IAIProviderConfig | undefined> {
    return this.findFirst((p) => p.provider === provider);
  }

  /**
   * Get all enabled providers
   */
  async getEnabledProviders(): Promise<IAIProviderConfig[]> {
    return this.filter((p) => p.isEnabled);
  }

  /**
   * Enable a provider
   */
  async enableProvider(provider: AIProviderType): Promise<void> {
    const config = await this.getByProvider(provider);
    if (config) {
      await this.update(config.id, { isEnabled: true });
    }
  }

  /**
   * Disable a provider
   */
  async disableProvider(provider: AIProviderType): Promise<void> {
    const config = await this.getByProvider(provider);
    if (config) {
      await this.update(config.id, { isEnabled: false });
    }
  }

  /**
   * Set API key presence flag
   */
  async setHasApiKey(provider: AIProviderType, hasKey: boolean): Promise<void> {
    const config = await this.getByProvider(provider);
    if (config) {
      await this.update(config.id, { hasApiKey: hasKey });
    }
  }

  /**
   * Update default model for a provider
   */
  async setDefaultModel(provider: AIProviderType, model: string): Promise<void> {
    const config = await this.getByProvider(provider);
    if (config) {
      await this.update(config.id, { defaultModel: model });
    }
  }

  /**
   * Update base URL (for Ollama or custom endpoints)
   */
  async setBaseUrl(provider: AIProviderType, baseUrl: string): Promise<void> {
    const config = await this.getByProvider(provider);
    if (config) {
      await this.update(config.id, { baseUrl });
    }
  }

  /**
   * Record last usage of a provider
   */
  async recordUsage(provider: AIProviderType): Promise<void> {
    const config = await this.getByProvider(provider);
    if (config) {
      await this.update(config.id, { lastUsedAt: new Date() });
    }
  }

  /**
   * Get providers with API keys configured
   */
  async getConfiguredProviders(): Promise<IAIProviderConfig[]> {
    return this.filter((p) => p.hasApiKey);
  }

  /**
   * Get provider configuration summary
   */
  async getProvidersSummary(): Promise<{
    total: number;
    enabled: number;
    configured: number;
  }> {
    const all = await this.getAll();

    return {
      total: all.length,
      enabled: all.filter((p) => p.isEnabled).length,
      configured: all.filter((p) => p.hasApiKey).length,
    };
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    AIProvidersRepository.instance = null;
  }
}

// Export a convenience function to get the repository
export function getAIProvidersRepository(): AIProvidersRepository {
  return AIProvidersRepository.getInstance();
}
