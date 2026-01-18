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
    expect(anthropic?.isEnabled).toBe(false);
  });

  it('should enable and disable providers', async () => {
    const repo = getAIProvidersRepository();
    await repo.initializeDefaults();

    await repo.enableProvider('anthropic');
    let config = await repo.getByProvider('anthropic');
    expect(config?.isEnabled).toBe(true);

    await repo.disableProvider('anthropic');
    config = await repo.getByProvider('anthropic');
    expect(config?.isEnabled).toBe(false);
  });

  it('should set API key presence flag', async () => {
    const repo = getAIProvidersRepository();
    await repo.initializeDefaults();

    await repo.setHasApiKey('openai', true);
    const config = await repo.getByProvider('openai');
    expect(config?.hasApiKey).toBe(true);
  });

  it('should update default model', async () => {
    const repo = getAIProvidersRepository();
    await repo.initializeDefaults();

    await repo.setDefaultModel('anthropic', 'claude-opus-4-20250514');
    const config = await repo.getByProvider('anthropic');
    expect(config?.defaultModel).toBe('claude-opus-4-20250514');
  });

  it('should update base URL for Ollama', async () => {
    const repo = getAIProvidersRepository();
    await repo.initializeDefaults();

    await repo.setBaseUrl('ollama', 'http://remote-server:11434');
    const config = await repo.getByProvider('ollama');
    expect(config?.baseUrl).toBe('http://remote-server:11434');
  });

  it('should get enabled providers', async () => {
    const repo = getAIProvidersRepository();
    await repo.initializeDefaults();

    await repo.enableProvider('anthropic');
    await repo.enableProvider('openai');

    const enabled = await repo.getEnabledProviders();
    expect(enabled).toHaveLength(2);
  });

  it('should get configured providers', async () => {
    const repo = getAIProvidersRepository();
    await repo.initializeDefaults();

    await repo.setHasApiKey('anthropic', true);
    await repo.setHasApiKey('google', true);

    const configured = await repo.getConfiguredProviders();
    expect(configured).toHaveLength(2);
  });

  it('should record usage', async () => {
    const repo = getAIProvidersRepository();
    await repo.initializeDefaults();

    await repo.recordUsage('anthropic');
    const config = await repo.getByProvider('anthropic');
    expect(config?.lastUsedAt).toBeDefined();
  });

  it('should get providers summary', async () => {
    const repo = getAIProvidersRepository();
    await repo.initializeDefaults();

    await repo.enableProvider('anthropic');
    await repo.setHasApiKey('anthropic', true);
    await repo.setHasApiKey('openai', true);

    const summary = await repo.getProvidersSummary();
    expect(summary.total).toBeGreaterThanOrEqual(5);
    expect(summary.enabled).toBe(1);
    expect(summary.configured).toBe(2);
  });
});
