<script setup lang="ts">
/**
 * AIIntegrationSection Component
 *
 * Settings section for AI integration. Shows a curated list of
 * configured models and a button to add new ones via an inline wizard.
 * Includes a collapsible API Keys section for managing provider keys.
 *
 * When the wizard is active, the main content is hidden and the wizard
 * takes over the entire section area. Closing the wizard returns to
 * the main content.
 */

import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { useAIProviderStore } from '@/stores/aiProviderStore';
import { AI_PROVIDER_META, AI_PROVIDER_ORDER } from '@/constants/ai-providers';
import ConfiguredModelsList from '@/components/settings/ConfiguredModelsList.vue';
import AddModelWizard from '@/components/dialogs/AddModelDialog.vue';

const { t } = useI18n({ useScope: 'global' });
const $q = useQuasar();
const aiStore = useAIProviderStore();

const showWizard = ref(false);
const showApiKeysSection = ref(false);

// API key management state per provider
const apiKeyInputs = ref<Record<string, string>>({});
const showApiKeys = ref<Record<string, boolean>>({});
const savingKeys = ref<Record<string, boolean>>({});
const deletingKeys = ref<Record<string, boolean>>({});

onMounted(async () => {
  if (!aiStore.isInitialized) {
    await aiStore.initialize();
  }
});

function onModelAdded(): void {
  // Models list auto-updates via store reactivity
}

function onWizardClose(): void {
  showWizard.value = false;
}

// API Key management
async function saveApiKey(provider: string): Promise<void> {
  const key = apiKeyInputs.value[provider]?.trim();
  if (key === undefined || key === null || key === '') return;

  savingKeys.value[provider] = true;
  try {
    await aiStore.saveApiKey(provider as import('@/services/storage/entities').AIProviderType, key);
    apiKeyInputs.value[provider] = '';
    $q.notify({ type: 'positive', message: t('ai.messages.keySaved') });
  } catch {
    $q.notify({ type: 'negative', message: t('ai.messages.keySaveError') });
  } finally {
    savingKeys.value[provider] = false;
  }
}

function deleteApiKey(provider: string): void {
  $q.dialog({
    title: t('ai.actions.deleteKey'),
    message: t('ai.messages.deleteKeyConfirm'),
    cancel: true,
    persistent: true,
  }).onOk(() => {
    deletingKeys.value[provider] = true;
    void (async () => {
      try {
        await aiStore.deleteApiKey(
          provider as import('@/services/storage/entities').AIProviderType
        );
        $q.notify({ type: 'info', message: t('ai.messages.keyDeleted') });
      } catch {
        $q.notify({ type: 'negative', message: t('ai.messages.keyDeleteError') });
      } finally {
        deletingKeys.value[provider] = false;
      }
    })();
  });
}
</script>

<template>
  <div class="ai-integration-section">
    <!-- Loading state -->
    <div
      v-if="aiStore.isLoading"
      class="ai-integration-section__loading"
    >
      <q-spinner size="32px" />
    </div>

    <!-- Inline Wizard (replaces main content when active) -->
    <AddModelWizard
      v-else-if="showWizard"
      @close="onWizardClose"
      @model-added="onModelAdded"
    />

    <!-- Main content -->
    <template v-else>
      <p class="ai-integration-section__description">
        {{ t('ai.description') }}
      </p>

      <!-- Models section -->
      <div class="ai-integration-section__models-header">
        <span class="ai-integration-section__subtitle">{{ t('ai.models.title') }}</span>
        <q-btn
          dense
          color="primary"
          icon="add"
          :label="t('ai.models.addModel')"
          @click="showWizard = true"
        />
      </div>

      <ConfiguredModelsList />

      <!-- API Keys section (collapsible) -->
      <q-expansion-item
        v-model="showApiKeysSection"
        :label="t('ai.fields.apiKey') + 's'"
        icon="key"
        header-class="ai-integration-section__api-keys-header"
        class="ai-integration-section__api-keys q-mt-lg"
      >
        <div class="ai-integration-section__api-keys-list">
          <div
            v-for="providerType in AI_PROVIDER_ORDER.filter(
              (p) => AI_PROVIDER_META[p].requiresApiKey
            )"
            :key="providerType"
            class="ai-integration-section__api-key-row"
          >
            <div class="ai-integration-section__api-key-provider">
              <q-icon
                :name="AI_PROVIDER_META[providerType].icon"
                size="20px"
              />
              <span>{{ t(`ai.providers.${providerType}`) }}</span>
            </div>
            <div class="ai-integration-section__api-key-status">
              <template v-if="aiStore.getProviderConfig(providerType)?.hasApiKey">
                <q-icon
                  name="check_circle"
                  color="positive"
                  size="18px"
                />
                <span class="ai-integration-section__key-masked">{{
                  t('ai.fields.apiKeyMasked')
                }}</span>
                <q-btn
                  flat
                  dense
                  size="sm"
                  color="negative"
                  :label="t('ai.actions.deleteKey')"
                  :loading="deletingKeys[providerType]"
                  @click="deleteApiKey(providerType)"
                />
              </template>
              <template v-else>
                <div class="ai-integration-section__key-input-row">
                  <q-input
                    v-model="apiKeyInputs[providerType]"
                    :type="showApiKeys[providerType] ? 'text' : 'password'"
                    dense
                    outlined
                    :placeholder="t('ai.fields.apiKeyPlaceholder')"
                    class="ai-integration-section__key-input"
                  >
                    <template #append>
                      <q-icon
                        :name="showApiKeys[providerType] ? 'visibility_off' : 'visibility'"
                        class="cursor-pointer"
                        @click="showApiKeys[providerType] = !showApiKeys[providerType]"
                      />
                    </template>
                  </q-input>
                  <q-btn
                    dense
                    color="primary"
                    :label="t('ai.actions.saveKey')"
                    :loading="savingKeys[providerType]"
                    :disable="!apiKeyInputs[providerType]?.trim()"
                    @click="saveApiKey(providerType)"
                  />
                </div>
              </template>
            </div>
          </div>

          <!-- Ollama base URL -->
          <div class="ai-integration-section__api-key-row">
            <div class="ai-integration-section__api-key-provider">
              <q-icon
                :name="AI_PROVIDER_META['ollama'].icon"
                size="20px"
              />
              <span>{{ t('ai.providers.ollama') }}</span>
            </div>
            <div class="ai-integration-section__api-key-status">
              <div class="ai-integration-section__hint">
                <q-icon
                  name="info"
                  size="16px"
                />
                <span>{{ t('ai.messages.noApiKeyRequired') }}</span>
              </div>
            </div>
          </div>
        </div>
      </q-expansion-item>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.ai-integration-section {
  &__description {
    font-size: 13px;
    color: var(--desc-color, #999999);
    margin-bottom: 16px;
    line-height: 1.5;
  }

  &__loading {
    display: flex;
    justify-content: center;
    padding: 32px 0;
  }

  &__models-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  &__subtitle {
    font-size: 14px;
    font-weight: 600;
    color: var(--title-color, #cccccc);
  }

  &__api-keys {
    border: 1px solid var(--border-color, #3c3c3c);
    border-radius: 6px;
  }

  &__api-keys-list {
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  &__api-key-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__api-key-provider {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--name-color, #cccccc);
  }

  &__api-key-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-left: 28px;
  }

  &__key-masked {
    font-size: 13px;
    color: var(--text-color, #cccccc);
  }

  &__key-input-row {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    flex: 1;
  }

  &__key-input {
    flex: 1;
  }

  &__hint {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--hint-color, #858585);
  }
}

.body--light .ai-integration-section {
  --desc-color: #6f6f6f;
  --title-color: #333333;
  --border-color: #d4d4d4;
  --name-color: #333333;
  --text-color: #333333;
  --hint-color: #6f6f6f;
}

.body--dark .ai-integration-section {
  --desc-color: #999999;
  --title-color: #cccccc;
  --border-color: #3c3c3c;
  --name-color: #cccccc;
  --text-color: #cccccc;
  --hint-color: #858585;
}
</style>
