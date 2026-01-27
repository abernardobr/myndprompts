/**
 * AI Model Fetcher Service
 *
 * Runs in the Electron main process. Fetches available models from
 * each AI provider's API. Uses SecureStorageService to retrieve API
 * keys so that keys never cross the IPC boundary.
 */

import { getSecureStorageService } from './secure-storage.service';
import type { AIProviderType } from '../../../services/storage/entities';

export interface IProviderModel {
  id: string;
  name: string;
  provider: AIProviderType;
}

export interface IFetchModelsResult {
  success: boolean;
  models: IProviderModel[];
  error?: string;
}

export class AIModelFetcherService {
  private static instance: AIModelFetcherService | null = null;

  private constructor() {}

  static getInstance(): AIModelFetcherService {
    if (!AIModelFetcherService.instance) {
      AIModelFetcherService.instance = new AIModelFetcherService();
    }
    return AIModelFetcherService.instance;
  }

  /**
   * Fetch available models from a provider's API.
   */
  async fetchModels(provider: AIProviderType, baseUrl?: string): Promise<IFetchModelsResult> {
    try {
      switch (provider) {
        case 'openai':
          return await this.fetchOpenAIModels();
        case 'anthropic':
          return await this.fetchAnthropicModels();
        case 'google':
          return await this.fetchGoogleModels();
        case 'groq':
          return await this.fetchGroqModels();
        case 'ollama':
          return await this.fetchOllamaModels(baseUrl ?? 'http://localhost:11434');
        default:
          return { success: false, models: [], error: `Unknown provider: ${provider as string}` };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, models: [], error: message };
    }
  }

  // ============================
  // Provider-specific fetchers
  // ============================

  private async fetchOpenAIModels(): Promise<IFetchModelsResult> {
    const apiKey = this.getKey('openai');
    if (apiKey === null)
      return { success: false, models: [], error: 'No API key configured for OpenAI' };

    const res = await this.httpGet('https://api.openai.com/v1/models', {
      Authorization: `Bearer ${apiKey}`,
    });

    const body = JSON.parse(res) as { data: Array<{ id: string }> };
    const chatPrefixes = ['gpt-4', 'gpt-3.5', 'o1', 'o3', 'o4', 'chatgpt-'];
    const models: IProviderModel[] = body.data
      .filter((m) => chatPrefixes.some((p) => m.id.startsWith(p)))
      .map((m) => ({ id: m.id, name: m.id, provider: 'openai' as AIProviderType }))
      .sort((a, b) => a.id.localeCompare(b.id));

    return { success: true, models };
  }

  private async fetchAnthropicModels(): Promise<IFetchModelsResult> {
    const apiKey = this.getKey('anthropic');
    if (apiKey === null)
      return { success: false, models: [], error: 'No API key configured for Anthropic' };

    const res = await this.httpGet('https://api.anthropic.com/v1/models', {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    });

    const body = JSON.parse(res) as { data: Array<{ id: string; display_name?: string }> };
    const models: IProviderModel[] = body.data.map((m) => ({
      id: m.id,
      name: m.display_name ?? m.id,
      provider: 'anthropic' as AIProviderType,
    }));

    return { success: true, models };
  }

  private async fetchGoogleModels(): Promise<IFetchModelsResult> {
    const apiKey = this.getKey('google');
    if (apiKey === null)
      return { success: false, models: [], error: 'No API key configured for Google' };

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const res = await this.httpGet(url, {});

    const body = JSON.parse(res) as {
      models: Array<{ name: string; displayName?: string; supportedGenerationMethods?: string[] }>;
    };

    const models: IProviderModel[] = body.models
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => {
        const id = m.name.replace(/^models\//, '');
        return { id, name: m.displayName ?? id, provider: 'google' as AIProviderType };
      });

    return { success: true, models };
  }

  private async fetchGroqModels(): Promise<IFetchModelsResult> {
    const apiKey = this.getKey('groq');
    if (apiKey === null)
      return { success: false, models: [], error: 'No API key configured for Groq' };

    const res = await this.httpGet('https://api.groq.com/openai/v1/models', {
      Authorization: `Bearer ${apiKey}`,
    });

    const body = JSON.parse(res) as { data: Array<{ id: string }> };
    const models: IProviderModel[] = body.data
      .map((m) => ({ id: m.id, name: m.id, provider: 'groq' as AIProviderType }))
      .sort((a, b) => a.id.localeCompare(b.id));

    return { success: true, models };
  }

  private async fetchOllamaModels(baseUrl: string): Promise<IFetchModelsResult> {
    const url = `${baseUrl.replace(/\/$/, '')}/api/tags`;
    const res = await this.httpGet(url, {});

    const body = JSON.parse(res) as { models: Array<{ name: string; model?: string }> };
    const models: IProviderModel[] = (body.models ?? []).map((m) => ({
      id: m.model ?? m.name,
      name: m.name,
      provider: 'ollama' as AIProviderType,
    }));

    return { success: true, models };
  }

  // ============================
  // Helpers
  // ============================

  private getKey(provider: string): string | null {
    const secureStorage = getSecureStorageService();
    return secureStorage.getApiKey(provider);
  }

  /**
   * Simple HTTP GET using Node's built-in fetch (Electron ≥28).
   * 10s timeout.
   */
  private async httpGet(url: string, headers: Record<string, string>): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  static resetInstance(): void {
    AIModelFetcherService.instance = null;
  }
}

export function getAIModelFetcherService(): AIModelFetcherService {
  return AIModelFetcherService.getInstance();
}
