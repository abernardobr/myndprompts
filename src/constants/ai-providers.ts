import type { AIProviderType } from '@/services/storage/entities';

/**
 * Static metadata for each AI provider.
 * Used for UI rendering and validation.
 * Models are now fetched dynamically from provider APIs.
 */
export interface IAIProviderMeta {
  type: AIProviderType;
  icon: string;
  requiresApiKey: boolean;
  requiresBaseUrl: boolean;
  defaultBaseUrl?: string;
  docsUrl: string;
}

export const AI_PROVIDER_META: Record<AIProviderType, IAIProviderMeta> = {
  anthropic: {
    type: 'anthropic',
    icon: 'smart_toy',
    requiresApiKey: true,
    requiresBaseUrl: false,
    docsUrl: 'https://docs.anthropic.com/',
  },
  openai: {
    type: 'openai',
    icon: 'psychology',
    requiresApiKey: true,
    requiresBaseUrl: false,
    docsUrl: 'https://platform.openai.com/docs/',
  },
  google: {
    type: 'google',
    icon: 'auto_awesome',
    requiresApiKey: true,
    requiresBaseUrl: false,
    docsUrl: 'https://ai.google.dev/docs',
  },
  groq: {
    type: 'groq',
    icon: 'bolt',
    requiresApiKey: true,
    requiresBaseUrl: false,
    docsUrl: 'https://console.groq.com/docs',
  },
  ollama: {
    type: 'ollama',
    icon: 'dns',
    requiresApiKey: false,
    requiresBaseUrl: true,
    defaultBaseUrl: 'http://localhost:11434',
    docsUrl: 'https://ollama.com/',
  },
};

/**
 * Ordered list of provider types for consistent UI rendering
 */
export const AI_PROVIDER_ORDER: AIProviderType[] = [
  'anthropic',
  'openai',
  'google',
  'groq',
  'ollama',
];
