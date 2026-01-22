<script setup lang="ts">
/**
 * PluginContentViewer Component
 *
 * Displays plugin items one by one with pagination.
 * Shows the content of each item (persona, template, snippet).
 */

import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { IPluginItem } from '@/services/storage/entities';
import type { IMarketplacePlugin } from '@/services/plugins/types';
import type { IPlugin } from '@/services/storage/entities';

const props = defineProps<{
  plugin: IMarketplacePlugin | IPlugin;
  /** Whether the plugin is installed (allows opening snippets) */
  isInstalled?: boolean;
}>();

const emit = defineEmits<{
  back: [];
  /** Emitted when user wants to open a snippet in the editor */
  openSnippet: [itemTitle: string];
}>();

const { t } = useI18n({ useScope: 'global' });

// Current item index (0-based)
const currentIndex = ref(0);

// Total items
const totalItems = computed(() => props.plugin.items.length);

// Current item
const currentItem = computed<IPluginItem | undefined>(() => {
  return props.plugin.items[currentIndex.value];
});

// Navigation
function goToFirst(): void {
  currentIndex.value = 0;
}

function goToPrevious(): void {
  if (currentIndex.value > 0) {
    currentIndex.value--;
  }
}

function goToNext(): void {
  if (currentIndex.value < totalItems.value - 1) {
    currentIndex.value++;
  }
}

function goToLast(): void {
  currentIndex.value = totalItems.value - 1;
}

// Check navigation states
const canGoPrevious = computed(() => currentIndex.value > 0);
const canGoNext = computed(() => currentIndex.value < totalItems.value - 1);

// Handle back button
function handleBack(): void {
  emit('back');
}

// Handle open snippet in editor
function handleOpenSnippet(): void {
  if (currentItem.value) {
    emit('openSnippet', currentItem.value.title);
  }
}
</script>

<template>
  <div class="plugin-content-viewer">
    <!-- Header with back button and plugin info -->
    <div class="plugin-content-viewer__header">
      <q-btn
        flat
        dense
        icon="mdi-arrow-left"
        :label="t('common.back') || 'Back'"
        class="plugin-content-viewer__back-btn"
        @click="handleBack"
      />
      <div class="plugin-content-viewer__title">
        <span class="text-weight-medium">{{ plugin.name }}</span>
        <q-chip
          dense
          size="sm"
          outline
        >
          v{{ plugin.version }}
        </q-chip>
      </div>
    </div>

    <q-separator />

    <!-- Content area -->
    <div class="plugin-content-viewer__content">
      <template v-if="currentItem">
        <!-- Item header -->
        <div class="plugin-content-viewer__item-header">
          <div class="plugin-content-viewer__item-title">
            <div class="text-h6">{{ currentItem.title }}</div>
            <q-chip
              v-if="currentItem.language"
              dense
              size="sm"
              outline
            >
              {{ currentItem.language }}
            </q-chip>
          </div>
          <!-- Open button (only shown for installed plugins) -->
          <q-btn
            v-if="isInstalled"
            flat
            dense
            no-caps
            color="primary"
            icon="open_in_new"
            :label="t('common.open') || 'Open'"
            @click="handleOpenSnippet"
          />
        </div>

        <!-- Item content -->
        <div class="plugin-content-viewer__item-content">
          <pre class="plugin-content-viewer__pre">{{ currentItem.content }}</pre>
        </div>
      </template>

      <!-- Empty state -->
      <div
        v-else
        class="plugin-content-viewer__empty"
      >
        <q-icon
          name="mdi-file-outline"
          size="48px"
          color="grey-5"
        />
        <div class="text-grey q-mt-md">
          {{ t('plugins.noContent') || 'No content available' }}
        </div>
      </div>
    </div>

    <!-- Pagination footer -->
    <div class="plugin-content-viewer__footer">
      <div class="plugin-content-viewer__pagination">
        <q-btn
          flat
          dense
          round
          icon="mdi-page-first"
          :disable="!canGoPrevious"
          @click="goToFirst"
        />
        <q-btn
          flat
          dense
          round
          icon="mdi-chevron-left"
          :disable="!canGoPrevious"
          @click="goToPrevious"
        />

        <span class="plugin-content-viewer__page-info">
          {{ currentIndex + 1 }} / {{ totalItems }}
        </span>

        <q-btn
          flat
          dense
          round
          icon="mdi-chevron-right"
          :disable="!canGoNext"
          @click="goToNext"
        />
        <q-btn
          flat
          dense
          round
          icon="mdi-page-last"
          :disable="!canGoNext"
          @click="goToLast"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.plugin-content-viewer {
  height: 100%;
  display: flex;
  flex-direction: column;

  &__header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
  }

  &__back-btn {
    flex-shrink: 0;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
  }

  &__content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  &__item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
  }

  &__item-title {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  &__item-content {
    overflow-x: auto;
  }

  &__pre {
    margin: 0;
    padding: 16px;
    background-color: var(--pre-bg, #f5f5f5);
    border-radius: 8px;
    font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
  }

  &__footer {
    padding: 12px 16px;
    border-top: 1px solid var(--border-color, #e0e0e0);
  }

  &__pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  &__page-info {
    min-width: 60px;
    text-align: center;
    font-size: 14px;
    color: var(--text-secondary, #666);
  }
}

.body--light .plugin-content-viewer {
  --border-color: #e0e0e0;
  --pre-bg: #f5f5f5;
  --text-secondary: #666;
}

.body--dark .plugin-content-viewer {
  --border-color: #3c3c3c;
  --pre-bg: #1e1e1e;
  --text-secondary: #999;
}
</style>
