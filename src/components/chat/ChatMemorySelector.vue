<script setup lang="ts">
/**
 * ChatMemorySelector Component
 *
 * Compact inline dropdown for selecting and configuring the
 * conversation memory strategy. Shows additional config inputs
 * (windowSize, maxTokens) depending on the selected strategy.
 */

import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useChatStore } from '@/stores/chatStore';
import type { MemoryStrategy, IMemoryConfig } from '@/services/chat/types';

const { t } = useI18n({ useScope: 'global' });
const chatStore = useChatStore();

interface StrategyOption {
  label: string;
  value: MemoryStrategy;
  description: string;
}

const strategies: StrategyOption[] = [
  { value: 'buffer', label: 'chat.memory.buffer', description: 'chat.memory.bufferDesc' },
  {
    value: 'buffer-window',
    label: 'chat.memory.bufferWindow',
    description: 'chat.memory.bufferWindowDesc',
  },
  { value: 'summary', label: 'chat.memory.summary', description: 'chat.memory.summaryDesc' },
  {
    value: 'summary-buffer',
    label: 'chat.memory.summaryBuffer',
    description: 'chat.memory.summaryBufferDesc',
  },
  { value: 'vector', label: 'chat.memory.vector', description: 'chat.memory.vectorDesc' },
];

const selectedStrategy = ref<MemoryStrategy>(
  chatStore.activeSession?.memoryStrategy ?? 'buffer-window'
);
const windowSize = ref(
  (chatStore.activeSession?.memoryConfig as IMemoryConfig | undefined)?.windowSize ?? 10
);
const maxTokens = ref(
  (chatStore.activeSession?.memoryConfig as IMemoryConfig | undefined)?.maxTokens ?? 2000
);

const showWindowSize = (s: MemoryStrategy) => s === 'buffer-window' || s === 'summary-buffer';
const showMaxTokens = (s: MemoryStrategy) => s === 'summary' || s === 'summary-buffer';

// Sync when active session changes
watch(
  () => chatStore.activeSession,
  (session) => {
    if (session) {
      selectedStrategy.value = session.memoryStrategy;
      const cfg = session.memoryConfig as IMemoryConfig | undefined;
      windowSize.value = cfg?.windowSize ?? 10;
      maxTokens.value = cfg?.maxTokens ?? 2000;
    }
  }
);

function buildConfig(): IMemoryConfig {
  const config: IMemoryConfig = {};
  if (showWindowSize(selectedStrategy.value)) {
    config.windowSize = windowSize.value;
  }
  if (showMaxTokens(selectedStrategy.value)) {
    config.maxTokens = maxTokens.value;
  }
  return config;
}

async function onStrategyChange(value: MemoryStrategy): Promise<void> {
  selectedStrategy.value = value;
  await chatStore.setMemoryStrategy(value, buildConfig());
}

async function onConfigChange(): Promise<void> {
  await chatStore.setMemoryStrategy(selectedStrategy.value, buildConfig());
}
</script>

<template>
  <div class="chat-memory-selector">
    <q-select
      :model-value="selectedStrategy"
      :options="strategies"
      option-value="value"
      :option-label="(opt: StrategyOption) => t(opt.label)"
      emit-value
      map-options
      dense
      outlined
      :label="t('chat.memory.title')"
      class="chat-memory-selector__select"
      @update:model-value="onStrategyChange"
    >
      <template #option="{ opt, itemProps }">
        <q-item v-bind="itemProps">
          <q-item-section>
            <q-item-label>{{ t(opt.label) }}</q-item-label>
            <q-item-label caption>{{ t(opt.description) }}</q-item-label>
          </q-item-section>
        </q-item>
      </template>
    </q-select>

    <!-- Window size input -->
    <q-input
      v-if="showWindowSize(selectedStrategy)"
      v-model.number="windowSize"
      type="number"
      dense
      outlined
      :min="1"
      :max="100"
      class="chat-memory-selector__config-input"
      :label="t('chat.memory.windowSizeLabel')"
      @update:model-value="onConfigChange"
    />

    <!-- Max tokens input -->
    <q-input
      v-if="showMaxTokens(selectedStrategy)"
      v-model.number="maxTokens"
      type="number"
      dense
      outlined
      :min="100"
      :max="128000"
      :step="500"
      class="chat-memory-selector__config-input"
      :label="t('chat.memory.maxTokensLabel')"
      @update:model-value="onConfigChange"
    />
  </div>
</template>

<style lang="scss" scoped>
.chat-memory-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__select {
    width: 100%;
  }

  &__config-input {
    width: 100%;
  }
}
</style>
