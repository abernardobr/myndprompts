<script setup lang="ts">
/**
 * PluginsMarketplace Component
 *
 * Marketplace tab content showing available plugins with search and filters.
 * Features:
 * - Search bar with diacritics-insensitive search
 * - Type filter (multi-select chips)
 * - Tags filter (multi-select)
 * - Plugin cards with install button
 * - Loading and empty states
 */

import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { usePluginStore } from '@/stores/pluginStore';
import { PLUGIN_TYPE_INFO } from '@/services/plugins/types';
import type { PluginType } from '@/services/storage/entities';
import type { IMarketplacePlugin } from '@/services/plugins/types';
import PluginCard from './PluginCard.vue';
import PluginContentViewer from './PluginContentViewer.vue';

const { t } = useI18n({ useScope: 'global' });
const $q = useQuasar();
const pluginStore = usePluginStore();

// Local state for search (with debounce)
const localSearchQuery = ref('');
const searchDebounceTimer = ref<ReturnType<typeof setTimeout> | null>(null);

// Set of plugin IDs currently being installed
const installingIds = ref<Set<string>>(new Set());

// Plugin being viewed (null = show list, plugin = show content viewer)
const viewingPlugin = ref<IMarketplacePlugin | null>(null);

// Plugin type options for filter
const pluginTypes = computed(() =>
  Object.values(PLUGIN_TYPE_INFO).map((info) => ({
    value: info.type,
    label: info.label,
    icon: info.icon,
    color: info.color,
  }))
);

// Sync local search with store (debounced)
function onSearchChange(value: string | number | null): void {
  if (searchDebounceTimer.value) {
    clearTimeout(searchDebounceTimer.value);
  }

  searchDebounceTimer.value = setTimeout(() => {
    pluginStore.setSearchQuery(String(value ?? ''));
  }, 300);
}

// Toggle type filter
function toggleType(type: PluginType): void {
  const current = [...pluginStore.selectedTypes];
  const index = current.indexOf(type);

  if (index >= 0) {
    current.splice(index, 1);
  } else {
    current.push(type);
  }

  pluginStore.setSelectedTypes(current);
}

// Check if type is selected
function isTypeSelected(type: PluginType): boolean {
  return pluginStore.selectedTypes.includes(type);
}

// Toggle tag filter
function toggleTag(tag: string): void {
  const current = [...pluginStore.selectedTags];
  const index = current.indexOf(tag);

  if (index >= 0) {
    current.splice(index, 1);
  } else {
    current.push(tag);
  }

  pluginStore.setSelectedTags(current);
}

// Check if tag is selected
function isTagSelected(tag: string): boolean {
  return pluginStore.selectedTags.includes(tag);
}

// Clear all filters
function clearFilters(): void {
  localSearchQuery.value = '';
  pluginStore.clearFilters();
}

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return (
    pluginStore.searchQuery !== '' ||
    pluginStore.selectedTypes.length > 0 ||
    pluginStore.selectedTags.length > 0
  );
});

// Handle view plugin content
function handleView(plugin: IMarketplacePlugin): void {
  viewingPlugin.value = plugin;
}

// Handle back from content viewer
function handleBack(): void {
  viewingPlugin.value = null;
}

// Handle plugin installation
async function handleInstall(plugin: IMarketplacePlugin): Promise<void> {
  if (installingIds.value.has(plugin.id)) return;

  installingIds.value.add(plugin.id);

  try {
    const success = await pluginStore.installPlugin(plugin);

    if (success) {
      $q.notify({
        type: 'positive',
        message: t('plugins.installSuccess') || 'Plugin installed successfully',
        icon: 'mdi-check-circle',
        position: 'bottom-right',
      });
    } else {
      $q.notify({
        type: 'negative',
        message: t('plugins.installError') || 'Failed to install plugin',
        caption: pluginStore.error ?? undefined,
        icon: 'mdi-alert-circle',
        position: 'bottom-right',
      });
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: t('plugins.installError') || 'Failed to install plugin',
      caption: error instanceof Error ? error.message : undefined,
      icon: 'mdi-alert-circle',
      position: 'bottom-right',
    });
  } finally {
    installingIds.value.delete(plugin.id);
  }
}

// Sync store search query to local (for initial value)
watch(
  () => pluginStore.searchQuery,
  (newValue) => {
    if (localSearchQuery.value !== newValue) {
      localSearchQuery.value = newValue;
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="plugins-marketplace">
    <!-- Content Viewer Mode -->
    <PluginContentViewer
      v-if="viewingPlugin"
      :plugin="viewingPlugin"
      @back="handleBack"
    />

    <!-- List Mode -->
    <template v-else>
      <!-- Search Bar -->
      <div class="plugins-marketplace__search">
        <q-input
          v-model="localSearchQuery"
          dense
          outlined
          :placeholder="t('plugins.searchPlaceholder') || 'Search plugins...'"
          clearable
          class="plugins-marketplace__search-input"
          @update:model-value="onSearchChange"
        >
          <template #prepend>
            <q-icon name="mdi-magnify" />
          </template>
        </q-input>
      </div>

      <!-- Filters -->
      <div class="plugins-marketplace__filters">
        <!-- Type Filter -->
        <div class="plugins-marketplace__filter-group">
          <span class="plugins-marketplace__filter-label">
            {{ t('plugins.filterByType') || 'Type' }}:
          </span>
          <div class="plugins-marketplace__filter-chips">
            <q-chip
              v-for="type in pluginTypes"
              :key="type.value"
              :outline="!isTypeSelected(type.value)"
              :color="isTypeSelected(type.value) ? type.color : undefined"
              :text-color="isTypeSelected(type.value) ? 'white' : undefined"
              clickable
              dense
              class="plugins-marketplace__filter-chip"
              @click="toggleType(type.value)"
            >
              <q-icon
                :name="type.icon"
                size="14px"
                class="q-mr-xs"
              />
              {{ type.label }}
            </q-chip>
          </div>
        </div>

        <!-- Tags Filter -->
        <div
          v-if="pluginStore.allTags.length > 0"
          class="plugins-marketplace__filter-group"
        >
          <span class="plugins-marketplace__filter-label">
            {{ t('plugins.filterByTags') || 'Tags' }}:
          </span>
          <div class="plugins-marketplace__filter-chips">
            <q-chip
              v-for="tag in pluginStore.allTags"
              :key="tag"
              :outline="!isTagSelected(tag)"
              :color="isTagSelected(tag) ? 'secondary' : undefined"
              :text-color="isTagSelected(tag) ? 'white' : undefined"
              clickable
              dense
              class="plugins-marketplace__filter-chip"
              @click="toggleTag(tag)"
            >
              {{ tag }}
            </q-chip>
          </div>
        </div>

        <!-- Clear Filters -->
        <div
          v-if="hasActiveFilters"
          class="plugins-marketplace__clear-filters"
        >
          <q-btn
            flat
            dense
            no-caps
            color="primary"
            icon="mdi-filter-remove"
            :label="t('plugins.clearFilters') || 'Clear filters'"
            @click="clearFilters"
          />
        </div>
      </div>

      <q-separator />

      <!-- Plugin List -->
      <div class="plugins-marketplace__list">
        <!-- Loading State -->
        <div
          v-if="pluginStore.isLoading && pluginStore.marketplace.length === 0"
          class="plugins-marketplace__state"
        >
          <q-spinner
            size="48px"
            color="primary"
          />
          <div class="q-mt-md text-grey">
            {{ t('plugins.loadingPlugins') || 'Loading plugins...' }}
          </div>
        </div>

        <!-- Error State -->
        <div
          v-else-if="pluginStore.error && pluginStore.marketplace.length === 0"
          class="plugins-marketplace__state"
        >
          <q-icon
            :name="pluginStore.isOffline ? 'mdi-wifi-off' : 'mdi-alert-circle-outline'"
            size="64px"
            :color="pluginStore.isOffline ? 'warning' : 'negative'"
          />
          <div
            class="q-mt-md"
            :class="pluginStore.isOffline ? 'text-warning' : 'text-negative'"
          >
            {{
              pluginStore.isOffline
                ? t('plugins.offline') || 'You appear to be offline. Please check your connection.'
                : t('plugins.fetchError') || 'Failed to load plugins. Please try again.'
            }}
          </div>
          <q-btn
            flat
            color="primary"
            icon="mdi-refresh"
            :label="t('common.retry') || 'Retry'"
            class="q-mt-md"
            :loading="pluginStore.isMarketplaceLoading"
            @click="pluginStore.refreshMarketplace(true)"
          />
        </div>

        <!-- Empty State -->
        <div
          v-else-if="pluginStore.filteredMarketplace.length === 0"
          class="plugins-marketplace__state"
        >
          <q-icon
            name="mdi-package-variant-closed"
            size="64px"
            color="grey-5"
          />
          <div class="q-mt-md text-grey text-h6">
            {{ t('plugins.noPluginsFound') || 'No plugins found' }}
          </div>
          <div class="text-caption text-grey">
            {{ t('plugins.noPluginsFoundHint') || 'Try adjusting your filters' }}
          </div>
          <q-btn
            v-if="hasActiveFilters"
            flat
            color="primary"
            icon="mdi-filter-remove"
            :label="t('plugins.clearFilters') || 'Clear filters'"
            class="q-mt-md"
            @click="clearFilters"
          />
        </div>

        <!-- Plugin Cards -->
        <div
          v-else
          class="plugins-marketplace__cards"
        >
          <PluginCard
            v-for="plugin in pluginStore.filteredMarketplace"
            :key="plugin.id"
            :plugin="plugin"
            :installing="installingIds.has(plugin.id)"
            @install="handleInstall"
            @view="handleView"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.plugins-marketplace {
  height: 100%;
  display: flex;
  flex-direction: column;

  &__search {
    padding: 16px 16px 8px;
  }

  &__search-input {
    :deep(.q-field__control) {
      background-color: var(--input-bg, rgba(0, 0, 0, 0.05));
    }
  }

  &__filters {
    padding: 8px 16px 16px;
  }

  &__filter-group {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  &__filter-label {
    font-size: 12px;
    color: var(--text-secondary, #666);
    min-width: 40px;
    padding-top: 6px;
  }

  &__filter-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    flex: 1;
  }

  &__filter-chip {
    font-size: 12px;
  }

  &__clear-filters {
    margin-top: 8px;
  }

  &__list {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 16px;
    text-align: center;
  }

  &__cards {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
}

.body--light .plugins-marketplace {
  --input-bg: rgba(0, 0, 0, 0.05);
  --text-secondary: #666;
  --border-color: #e0e0e0;
}

.body--dark .plugins-marketplace {
  --input-bg: rgba(255, 255, 255, 0.1);
  --text-secondary: #999;
  --border-color: #3c3c3c;
}
</style>
