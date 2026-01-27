/**
 * AI Provider Store
 *
 * Pinia store for managing AI provider configurations and configured models.
 * Combines IndexedDB persistence (via repositories) with
 * secure API key storage (via Electron's secureStorageAPI).
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getAIProvidersRepository } from '@/services/storage/repositories/ai-providers.repository';
import { getConfiguredModelsRepository } from '@/services/storage/repositories/configured-models.repository';
import type {
  IAIProviderConfig,
  IConfiguredModel,
  AIProviderType,
} from '@/services/storage/entities';
import type { MemoryStrategy, IMemoryConfig } from '@/services/chat/types';
import { AI_PROVIDER_META, AI_PROVIDER_ORDER } from '@/constants/ai-providers';

// ================================
// Chat Defaults (persisted in localStorage)
// ================================

interface IChatDefaults {
  memoryStrategy: MemoryStrategy;
  windowSize: number;
  maxTokens: number;
}

const CHAT_DEFAULTS_KEY = 'myndprompts:chat-defaults';

const DEFAULT_CHAT_DEFAULTS: IChatDefaults = {
  memoryStrategy: 'buffer-window',
  windowSize: 10,
  maxTokens: 2000,
};

function loadChatDefaults(): IChatDefaults {
  try {
    const raw = localStorage.getItem(CHAT_DEFAULTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<IChatDefaults>;
      return { ...DEFAULT_CHAT_DEFAULTS, ...parsed };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_CHAT_DEFAULTS };
}

function persistChatDefaults(defaults: IChatDefaults): void {
  localStorage.setItem(CHAT_DEFAULTS_KEY, JSON.stringify(defaults));
}

export const useAIProviderStore = defineStore('aiProviders', () => {
  const providerRepo = getAIProvidersRepository();
  const modelRepo = getConfiguredModelsRepository();

  // ================================
  // State
  // ================================

  const providers = ref<IAIProviderConfig[]>([]);
  const configuredModels = ref<IConfiguredModel[]>([]);
  const chatDefaults = ref<IChatDefaults>(loadChatDefaults());
  const isInitialized = ref(false);
  const isLoading = ref(false);

  // ================================
  // Computed / Getters
  // ================================

  const configuredProviders = computed(() =>
    providers.value.filter((p) => p.hasApiKey || !AI_PROVIDER_META[p.provider]?.requiresApiKey)
  );

  const orderedProviders = computed(
    () =>
      AI_PROVIDER_ORDER.map((type) => providers.value.find((p) => p.provider === type)).filter(
        Boolean
      ) as IAIProviderConfig[]
  );

  const defaultModel = computed(() => configuredModels.value.find((m) => m.isDefault));

  const modelsByProvider = computed(() => {
    const map: Partial<Record<AIProviderType, IConfiguredModel[]>> = {};
    for (const m of configuredModels.value) {
      if (map[m.provider] === undefined) map[m.provider] = [];
      const list = map[m.provider];
      if (list !== undefined) list.push(m);
    }
    return map;
  });

  const orderedModels = computed(() =>
    [...configuredModels.value].sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
    })
  );

  // ================================
  // Actions
  // ================================

  async function initialize(): Promise<void> {
    if (isInitialized.value) return;
    isLoading.value = true;
    try {
      await providerRepo.initializeDefaults();
      providers.value = await providerRepo.getAll();
      configuredModels.value = await modelRepo.getAll();
      isInitialized.value = true;
    } finally {
      isLoading.value = false;
    }
  }

  async function refreshProviders(): Promise<void> {
    providers.value = await providerRepo.getAll();
  }

  async function refreshConfiguredModels(): Promise<void> {
    configuredModels.value = await modelRepo.getAll();
  }

  async function saveApiKey(provider: AIProviderType, key: string): Promise<void> {
    await window.secureStorageAPI.saveApiKey(provider, key);
    await providerRepo.setHasApiKey(provider, true);
    await refreshProviders();
  }

  async function deleteApiKey(provider: AIProviderType): Promise<void> {
    await window.secureStorageAPI.deleteApiKey(provider);
    await providerRepo.setHasApiKey(provider, false);
    await refreshProviders();
  }

  async function getApiKey(provider: AIProviderType): Promise<string | null> {
    return window.secureStorageAPI.getApiKey(provider);
  }

  async function setBaseUrl(provider: AIProviderType, baseUrl: string): Promise<void> {
    await providerRepo.setBaseUrl(provider, baseUrl);
    await refreshProviders();
  }

  function getProviderConfig(provider: AIProviderType): IAIProviderConfig | undefined {
    return providers.value.find((p) => p.provider === provider);
  }

  /**
   * Fetch models from a provider's API via the main process
   */
  async function fetchProviderModels(
    provider: AIProviderType,
    baseUrl?: string
  ): Promise<{
    success: boolean;
    models: Array<{ id: string; name: string; provider: string }>;
    error?: string;
  }> {
    return window.aiModelsAPI.fetchModels(provider, baseUrl);
  }

  /**
   * Add a model to the configured list
   */
  async function addModel(
    provider: AIProviderType,
    modelId: string,
    modelName: string
  ): Promise<IConfiguredModel> {
    const model = await modelRepo.addModel(provider, modelId, modelName);
    await refreshConfiguredModels();
    return model;
  }

  /**
   * Remove a configured model
   */
  async function removeModel(id: string): Promise<void> {
    await modelRepo.removeModel(id);
    await refreshConfiguredModels();
  }

  /**
   * Set a model as the default
   */
  async function setDefaultModel(id: string): Promise<void> {
    await modelRepo.setDefaultModel(id);
    await refreshConfiguredModels();
  }

  /**
   * Check if a model is already configured
   */
  async function modelExists(provider: AIProviderType, modelId: string): Promise<boolean> {
    return modelRepo.modelExists(provider, modelId);
  }

  /**
   * Update chat defaults (memory strategy, window size, max tokens).
   */
  function updateChatDefaults(updates: Partial<IChatDefaults>): void {
    chatDefaults.value = { ...chatDefaults.value, ...updates };
    persistChatDefaults(chatDefaults.value);
  }

  /**
   * Build an IMemoryConfig from chat defaults.
   */
  function getDefaultMemoryConfig(): IMemoryConfig {
    const d = chatDefaults.value;
    const config: IMemoryConfig = {};
    if (d.memoryStrategy === 'buffer-window' || d.memoryStrategy === 'summary-buffer') {
      config.windowSize = d.windowSize;
    }
    if (d.memoryStrategy === 'summary' || d.memoryStrategy === 'summary-buffer') {
      config.maxTokens = d.maxTokens;
    }
    return config;
  }

  return {
    // State
    providers,
    configuredModels,
    chatDefaults,
    isInitialized,
    isLoading,

    // Computed
    configuredProviders,
    orderedProviders,
    defaultModel,
    modelsByProvider,
    orderedModels,

    // Actions
    initialize,
    refreshProviders,
    refreshConfiguredModels,
    saveApiKey,
    deleteApiKey,
    getApiKey,
    setBaseUrl,
    getProviderConfig,
    fetchProviderModels,
    addModel,
    removeModel,
    setDefaultModel,
    modelExists,
    updateChatDefaults,
    getDefaultMemoryConfig,
  };
});
