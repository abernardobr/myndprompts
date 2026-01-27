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
   * Set API key presence flag
   */
  async setHasApiKey(provider: AIProviderType, hasKey: boolean): Promise<void> {
    const config = await this.getByProvider(provider);
    if (config) {
      await this.update(config.id, { hasApiKey: hasKey });
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
   * Get providers with API keys configured
   */
  async getConfiguredProviders(): Promise<IAIProviderConfig[]> {
    return this.filter((p) => p.hasApiKey);
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
