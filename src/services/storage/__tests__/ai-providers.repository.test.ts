import { describe, it, expect } from 'vitest';
import { setupStorageTests } from './setup';
import { getAIProvidersRepository } from '../repositories/ai-providers.repository';

describe('AIProvidersRepository', () => {
  setupStorageTests();

  it('should initialize with default providers', async () => {
    const repo = getAIProvidersRepository();

    await repo.initializeDefaults();

    const providers = await repo.getAll();
    expect(providers.length).toBeGreaterThanOrEqual(5);

    const anthropic = await repo.getByProvider('anthropic');
    expect(anthropic).toBeDefined();
  });

  it('should set API key presence flag', async () => {
    const repo = getAIProvidersRepository();
    await repo.initializeDefaults();

    await repo.setHasApiKey('openai', true);
    const config = await repo.getByProvider('openai');
    expect(config?.hasApiKey).toBe(true);
  });

  it('should update base URL for Ollama', async () => {
    const repo = getAIProvidersRepository();
    await repo.initializeDefaults();

    await repo.setBaseUrl('ollama', 'http://remote-server:11434');
    const config = await repo.getByProvider('ollama');
    expect(config?.baseUrl).toBe('http://remote-server:11434');
  });

  it('should get configured providers', async () => {
    const repo = getAIProvidersRepository();
    await repo.initializeDefaults();

    await repo.setHasApiKey('anthropic', true);
    await repo.setHasApiKey('google', true);

    const configured = await repo.getConfiguredProviders();
    expect(configured).toHaveLength(2);
  });
});
