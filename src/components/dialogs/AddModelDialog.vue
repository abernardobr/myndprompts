<script setup lang="ts">
/**
 * AddModelWizard Component
 *
 * Inline wizard for adding AI models, rendered inside the AI Integration section.
 * Step 1: Select provider
 * Step 2: Enter API key (or base URL for Ollama)
 * Step 3: Fetch and select models from provider API
 */

import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { useAIProviderStore } from '@/stores/aiProviderStore';
import { AI_PROVIDER_META, AI_PROVIDER_ORDER } from '@/constants/ai-providers';
import type { AIProviderType } from '@/services/storage/entities';

interface Emits {
  (e: 'close'): void;
  (e: 'modelAdded'): void;
}

const emit = defineEmits<Emits>();

const { t } = useI18n({ useScope: 'global' });
const $q = useQuasar();
const aiStore = useAIProviderStore();

// Wizard state
const step = ref(1);
const selectedProvider = ref<AIProviderType | null>(null);

// Step 2 state
const apiKeyInput = ref('');
const showApiKey = ref(false);
const isSavingKey = ref(false);
const baseUrlInput = ref('');

// Step 3 state
const isFetchingModels = ref(false);
const fetchError = ref('');
const availableModels = ref<Array<{ id: string; name: string; provider: string }>>([]);
const searchFilter = ref('');
const addedModelIds = ref<Set<string>>(new Set());

// Computed
const selectedMeta = computed(() =>
  selectedProvider.value ? AI_PROVIDER_META[selectedProvider.value] : null
);

const providerConfig = computed(() =>
  selectedProvider.value ? aiStore.getProviderConfig(selectedProvider.value) : undefined
);

const hasExistingKey = computed(() => providerConfig.value?.hasApiKey ?? false);

const filteredModels = computed(() => {
  if (!searchFilter.value) return availableModels.value;
  const q = searchFilter.value.toLowerCase();
  return availableModels.value.filter(
    (m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
  );
});

// Reset state on mount
onMounted(() => {
  step.value = 1;
  selectedProvider.value = null;
  apiKeyInput.value = '';
  showApiKey.value = false;
  baseUrlInput.value = '';
  isFetchingModels.value = false;
  fetchError.value = '';
  availableModels.value = [];
  searchFilter.value = '';
  addedModelIds.value = new Set();
});

// Step 1: Select provider
function selectProvider(provider: AIProviderType): void {
  selectedProvider.value = provider;
  const meta = AI_PROVIDER_META[provider];
  const config = aiStore.getProviderConfig(provider);

  // Set default base URL for providers that need it
  if (meta.requiresBaseUrl) {
    baseUrlInput.value = config?.baseUrl ?? meta.defaultBaseUrl ?? '';
  }

  step.value = 2;
}

// Step 2: Save API key and continue
async function saveKeyAndContinue(): Promise<void> {
  if (!selectedProvider.value) return;
  const meta = selectedMeta.value;
  if (!meta) return;

  if (meta.requiresApiKey && !hasExistingKey.value) {
    if (!apiKeyInput.value.trim()) return;
    isSavingKey.value = true;
    try {
      await aiStore.saveApiKey(selectedProvider.value, apiKeyInput.value.trim());
      apiKeyInput.value = '';
      $q.notify({ type: 'positive', message: t('ai.messages.keySaved') });
    } catch {
      $q.notify({ type: 'negative', message: t('ai.messages.keySaveError') });
      isSavingKey.value = false;
      return;
    } finally {
      isSavingKey.value = false;
    }
  }

  // Save base URL if changed (Ollama)
  if (meta.requiresBaseUrl && baseUrlInput.value.trim()) {
    await aiStore.setBaseUrl(selectedProvider.value, baseUrlInput.value.trim());
  }

  step.value = 3;
  await fetchModels();
}

// Step 2: Continue with existing key
async function continueWithExistingKey(): Promise<void> {
  if (!selectedProvider.value) return;
  const meta = selectedMeta.value;

  // Save base URL if Ollama
  if (meta?.requiresBaseUrl === true && baseUrlInput.value.trim() !== '') {
    await aiStore.setBaseUrl(selectedProvider.value, baseUrlInput.value.trim());
  }

  step.value = 3;
  await fetchModels();
}

// Step 3: Fetch models from provider API
async function fetchModels(): Promise<void> {
  if (!selectedProvider.value) return;

  isFetchingModels.value = true;
  fetchError.value = '';

  try {
    const config = aiStore.getProviderConfig(selectedProvider.value);
    const baseUrl = config?.baseUrl;
    const result = await aiStore.fetchProviderModels(selectedProvider.value, baseUrl);

    if (result.success) {
      availableModels.value = result.models;

      // Mark models already added
      const existingModels = aiStore.configuredModels;
      const existingSet = new Set(
        existingModels.filter((m) => m.provider === selectedProvider.value).map((m) => m.modelId)
      );
      addedModelIds.value = existingSet;
    } else {
      fetchError.value = result.error ?? t('ai.wizard.fetchError');
    }
  } catch {
    fetchError.value = t('ai.wizard.fetchError');
  } finally {
    isFetchingModels.value = false;
  }
}

// Add a model
async function addModel(model: { id: string; name: string }): Promise<void> {
  if (!selectedProvider.value) return;

  try {
    await aiStore.addModel(selectedProvider.value, model.id, model.name);
    addedModelIds.value = new Set([...addedModelIds.value, model.id]);
    $q.notify({ type: 'positive', message: t('ai.models.modelAdded') });
    emit('modelAdded');
  } catch {
    $q.notify({ type: 'negative', message: t('common.error') });
  }
}

function close(): void {
  emit('close');
}

function isModelAdded(modelId: string): boolean {
  return addedModelIds.value.has(modelId);
}
</script>

<template>
  <div class="add-model-wizard">
    <!-- Header with close button -->
    <div class="add-model-wizard__header">
      <div class="add-model-wizard__title">{{ t('ai.wizard.title') }}</div>
      <q-btn
        flat
        round
        dense
        icon="close"
        @click="close"
      />
    </div>

    <q-separator class="q-mb-md" />

    <!-- Stepper -->
    <q-stepper
      v-model="step"
      flat
      animated
      class="add-model-wizard__stepper"
    >
      <!-- Step 1: Select Provider -->
      <q-step
        :name="1"
        :title="t('ai.wizard.step1Title')"
        icon="cloud"
        :done="step > 1"
      >
        <p class="add-model-wizard__step-desc">{{ t('ai.wizard.step1Description') }}</p>
        <div class="add-model-wizard__provider-grid">
          <q-card
            v-for="providerType in AI_PROVIDER_ORDER"
            :key="providerType"
            flat
            bordered
            class="add-model-wizard__provider-card"
            :class="{
              'add-model-wizard__provider-card--selected': selectedProvider === providerType,
            }"
            @click="selectProvider(providerType)"
          >
            <q-card-section class="add-model-wizard__provider-content">
              <q-icon
                :name="AI_PROVIDER_META[providerType].icon"
                size="28px"
              />
              <span class="add-model-wizard__provider-name">
                {{ t(`ai.providers.${providerType}`) }}
              </span>
            </q-card-section>
          </q-card>
        </div>
      </q-step>

      <!-- Step 2: API Key / Base URL -->
      <q-step
        :name="2"
        :title="t('ai.wizard.step2Title')"
        icon="key"
        :done="step > 2"
      >
        <p class="add-model-wizard__step-desc">{{ t('ai.wizard.step2Description') }}</p>

        <!-- Already has key -->
        <template v-if="selectedMeta?.requiresApiKey && hasExistingKey">
          <div class="add-model-wizard__key-status">
            <q-icon
              name="check_circle"
              color="positive"
              size="24px"
            />
            <span>{{ t('ai.wizard.keyAlreadyConfigured') }}</span>
          </div>
          <div class="add-model-wizard__actions">
            <q-btn
              flat
              :label="t('ai.wizard.changeKey')"
              @click="
                () => {
                  const config = providerConfig;
                  if (config) {
                    aiStore.deleteApiKey(selectedProvider!).then(() => {
                      aiStore.refreshProviders();
                    });
                  }
                }
              "
            />
            <q-btn
              color="primary"
              :label="t('common.next')"
              @click="continueWithExistingKey"
            />
          </div>
        </template>

        <!-- Needs API key -->
        <template v-else-if="selectedMeta?.requiresApiKey && !hasExistingKey">
          <div class="add-model-wizard__key-input">
            <q-input
              v-model="apiKeyInput"
              :type="showApiKey ? 'text' : 'password'"
              dense
              outlined
              :placeholder="t('ai.fields.apiKeyPlaceholder')"
              class="add-model-wizard__input"
            >
              <template #append>
                <q-icon
                  :name="showApiKey ? 'visibility_off' : 'visibility'"
                  class="cursor-pointer"
                  @click="showApiKey = !showApiKey"
                />
              </template>
            </q-input>
          </div>
          <div class="add-model-wizard__actions">
            <q-btn
              flat
              :label="t('common.back')"
              @click="step = 1"
            />
            <q-btn
              color="primary"
              :label="t('ai.wizard.saveAndContinue')"
              :loading="isSavingKey"
              :disable="!apiKeyInput.trim()"
              @click="saveKeyAndContinue"
            />
          </div>
        </template>

        <!-- No API key required (Ollama) - show base URL -->
        <template v-else>
          <div class="add-model-wizard__hint">
            <q-icon
              name="info"
              size="18px"
            />
            <span>{{ t('ai.messages.noApiKeyRequired') }}</span>
          </div>
          <template v-if="selectedMeta?.requiresBaseUrl">
            <label class="add-model-wizard__label">{{ t('ai.fields.baseUrl') }}</label>
            <q-input
              v-model="baseUrlInput"
              dense
              outlined
              :placeholder="t('ai.fields.baseUrlPlaceholder')"
              class="add-model-wizard__input q-mb-sm"
            />
          </template>
          <div class="add-model-wizard__actions">
            <q-btn
              flat
              :label="t('common.back')"
              @click="step = 1"
            />
            <q-btn
              color="primary"
              :label="t('common.next')"
              @click="saveKeyAndContinue"
            />
          </div>
        </template>
      </q-step>

      <!-- Step 3: Select Models -->
      <q-step
        :name="3"
        :title="t('ai.wizard.step3Title')"
        icon="list"
      >
        <p class="add-model-wizard__step-desc">{{ t('ai.wizard.step3Description') }}</p>

        <!-- Loading -->
        <div
          v-if="isFetchingModels"
          class="add-model-wizard__loading"
        >
          <q-spinner size="32px" />
          <span>{{ t('ai.wizard.fetchingModels') }}</span>
        </div>

        <!-- Error -->
        <div
          v-else-if="fetchError"
          class="add-model-wizard__error"
        >
          <q-icon
            name="error"
            color="negative"
            size="24px"
          />
          <span>{{ fetchError }}</span>
          <q-btn
            flat
            dense
            color="primary"
            :label="t('common.retry')"
            @click="fetchModels"
          />
        </div>

        <!-- Models list -->
        <template v-else>
          <q-input
            v-if="availableModels.length > 5"
            v-model="searchFilter"
            dense
            outlined
            :placeholder="t('common.search')"
            class="add-model-wizard__search q-mb-sm"
          >
            <template #prepend>
              <q-icon name="search" />
            </template>
          </q-input>

          <div
            v-if="filteredModels.length === 0"
            class="add-model-wizard__empty"
          >
            {{ t('ai.wizard.noModelsFound') }}
          </div>

          <q-list
            class="add-model-wizard__model-list"
            separator
          >
            <q-item
              v-for="model in filteredModels"
              :key="model.id"
            >
              <q-item-section>
                <q-item-label>{{ model.name }}</q-item-label>
                <q-item-label
                  v-if="model.name !== model.id"
                  caption
                  >{{ model.id }}</q-item-label
                >
              </q-item-section>
              <q-item-section side>
                <q-badge
                  v-if="isModelAdded(model.id)"
                  color="grey"
                  :label="t('ai.wizard.alreadyAdded')"
                />
                <q-btn
                  v-else
                  dense
                  flat
                  color="primary"
                  :label="t('ai.wizard.addModel')"
                  @click="addModel(model)"
                />
              </q-item-section>
            </q-item>
          </q-list>
        </template>

        <div class="add-model-wizard__actions q-mt-md">
          <q-btn
            flat
            :label="t('common.back')"
            @click="step = 2"
          />
          <q-btn
            color="primary"
            :label="t('ai.wizard.done')"
            @click="close"
          />
        </div>
      </q-step>
    </q-stepper>
  </div>
</template>

<style lang="scss" scoped>
.add-model-wizard {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    color: var(--title-color, #cccccc);
  }

  &__stepper {
    background: transparent;
  }

  &__step-desc {
    font-size: 13px;
    color: var(--desc-color, #999999);
    margin-bottom: 16px;
  }

  &__provider-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
  }

  &__provider-card {
    cursor: pointer;
    transition: border-color 0.2s;
    background-color: var(--card-bg, #2d2d30);
    border-color: var(--card-border, #3c3c3c);

    &:hover {
      border-color: var(--primary, #1976d2);
    }

    &--selected {
      border-color: var(--primary, #1976d2);
      border-width: 2px;
    }
  }

  &__provider-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px;
  }

  &__provider-name {
    font-size: 13px;
    font-weight: 500;
    text-align: center;
  }

  &__key-status {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    font-size: 14px;
    color: var(--text-color, #cccccc);
  }

  &__key-input {
    margin-bottom: 16px;
  }

  &__input {
    max-width: 100%;
  }

  &__label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: var(--label-color, #999999);
    margin-bottom: 6px;
  }

  &__hint {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--hint-color, #858585);
    margin-bottom: 16px;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }

  &__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px 0;
    color: var(--desc-color, #999999);
  }

  &__error {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px;
    color: var(--text-color, #cccccc);
  }

  &__search {
    max-width: 100%;
  }

  &__empty {
    text-align: center;
    padding: 24px;
    font-size: 13px;
    color: var(--desc-color, #999999);
  }

  &__model-list {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid var(--card-border, #3c3c3c);
    border-radius: 4px;
  }
}

.body--light .add-model-wizard {
  --title-color: #333333;
  --desc-color: #6f6f6f;
  --card-bg: #ffffff;
  --card-border: #d4d4d4;
  --text-color: #333333;
  --label-color: #6f6f6f;
  --hint-color: #6f6f6f;
}

.body--dark .add-model-wizard {
  --title-color: #cccccc;
  --desc-color: #999999;
  --card-bg: #2d2d30;
  --card-border: #3c3c3c;
  --text-color: #cccccc;
  --label-color: #999999;
  --hint-color: #858585;
}
</style>
