<script setup lang="ts">
/**
 * ConfiguredModelsList Component
 *
 * Displays the user's configured AI models with actions
 * to set default or remove models.
 */

import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { useAIProviderStore } from '@/stores/aiProviderStore';
import { AI_PROVIDER_META } from '@/constants/ai-providers';

const { t } = useI18n({ useScope: 'global' });
const $q = useQuasar();
const aiStore = useAIProviderStore();

async function setDefault(id: string): Promise<void> {
  await aiStore.setDefaultModel(id);
  $q.notify({ type: 'positive', message: t('ai.models.defaultSet') });
}

function removeModel(id: string): void {
  $q.dialog({
    title: t('ai.models.remove'),
    message: t('ai.models.removeConfirm'),
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void (async () => {
      await aiStore.removeModel(id);
      $q.notify({ type: 'info', message: t('ai.models.modelRemoved') });
    })();
  });
}
</script>

<template>
  <div class="configured-models-list">
    <!-- Empty state -->
    <div
      v-if="aiStore.orderedModels.length === 0"
      class="configured-models-list__empty"
    >
      <q-icon
        name="model_training"
        size="32px"
      />
      <span>{{ t('ai.models.empty') }}</span>
    </div>

    <!-- Model list -->
    <q-list
      v-else
      separator
      class="configured-models-list__list"
    >
      <q-item
        v-for="model in aiStore.orderedModels"
        :key="model.id"
        class="configured-models-list__item"
      >
        <q-item-section avatar>
          <q-icon
            :name="AI_PROVIDER_META[model.provider]?.icon ?? 'smart_toy'"
            size="22px"
            class="configured-models-list__icon"
          />
        </q-item-section>
        <q-item-section>
          <q-item-label class="configured-models-list__model-name">
            {{ model.modelName }}
          </q-item-label>
          <q-item-label caption>
            {{ t(`ai.providers.${model.provider}`) }}
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <div class="configured-models-list__actions">
            <q-badge
              v-if="model.isDefault"
              color="primary"
              :label="t('ai.models.default')"
              class="q-mr-sm"
            />
            <q-btn
              v-if="!model.isDefault"
              flat
              dense
              size="sm"
              :label="t('ai.models.setDefault')"
              @click="setDefault(model.id)"
            />
            <q-btn
              flat
              dense
              size="sm"
              color="negative"
              icon="delete_outline"
              @click="removeModel(model.id)"
            />
          </div>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<style lang="scss" scoped>
.configured-models-list {
  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 32px 16px;
    color: var(--empty-color, #858585);
    font-size: 13px;
  }

  &__list {
    border: 1px solid var(--list-border, #3c3c3c);
    border-radius: 6px;
  }

  &__item {
    min-height: 48px;
  }

  &__icon {
    color: var(--icon-color, #cccccc);
  }

  &__model-name {
    font-size: 13px;
    font-weight: 500;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

.body--light .configured-models-list {
  --empty-color: #6f6f6f;
  --list-border: #d4d4d4;
  --icon-color: #333333;
}

.body--dark .configured-models-list {
  --empty-color: #858585;
  --list-border: #3c3c3c;
  --icon-color: #cccccc;
}
</style>
