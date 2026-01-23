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

// Plugin type options for filter (dynamically from marketplace data)
const pluginTypes = computed(() =>
  pluginStore.allTypes.map((type) => {
    const info = PLUGIN_TYPE_INFO[type];
    return {
      value: type,
      label: info?.label ?? type,
      icon: info?.icon ?? 'mdi-puzzle',
      color: info?.color ?? 'grey',
    };
  })
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

// Local state for tags filter input
const tagsFilterText = ref('');

// Local state for language filter input
const languageFilterText = ref('');

// Update tags filter
function onTagsChange(value: string[]): void {
  pluginStore.setSelectedTags(value);
}

// Normalize string for diacritics-insensitive search
function normalizeForSearch(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Filter tags function for q-select
function filterTags(val: string, update: (fn: () => void) => void): void {
  update(() => {
    tagsFilterText.value = val;
  });
}

// Computed filtered tag options for the select
const filteredTagOptions = computed(() => {
  if (!tagsFilterText.value) {
    return pluginStore.allTags;
  }
  const needle = normalizeForSearch(tagsFilterText.value);
  return pluginStore.allTags.filter((tag) => normalizeForSearch(tag).includes(needle));
});

// Filter languages function for q-select
function filterLanguages(val: string, update: (fn: () => void) => void): void {
  update(() => {
    languageFilterText.value = val;
  });
}

// Computed filtered language options
const filteredLanguageOptions = computed(() => {
  if (!languageFilterText.value) {
    return pluginStore.allLanguages;
  }
  const needle = normalizeForSearch(languageFilterText.value);
  return pluginStore.allLanguages.filter((lang) => normalizeForSearch(lang).includes(needle));
});

// Update language filter
function onLanguageChange(value: string | null): void {
  pluginStore.setSelectedLanguage(value);
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
    pluginStore.selectedTags.length > 0 ||
    pluginStore.selectedLanguage !== null
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
          class="plugins-marketplace__filter-group plugins-marketplace__filter-group--tags"
        >
          <span class="plugins-marketplace__filter-label">
            {{ t('plugins.filterByTags') || 'Tags' }}:
          </span>
          <q-select
            :model-value="pluginStore.selectedTags"
            :options="filteredTagOptions"
            multiple
            dense
            outlined
            use-input
            use-chips
            input-debounce="0"
            dropdown-icon="mdi-chevron-down"
            :placeholder="
              pluginStore.selectedTags.length === 0
                ? t('plugins.selectTags') || 'Select tags...'
                : ''
            "
            class="plugins-marketplace__tags-select"
            popup-content-class="plugins-marketplace__tags-dropdown"
            @update:model-value="onTagsChange"
            @filter="filterTags"
            @input-value="(val) => (tagsFilterText = val)"
          >
            <template #selected-item="scope">
              <q-chip
                removable
                dense
                color="secondary"
                text-color="white"
                class="q-ma-xs"
                @remove="scope.removeAtIndex(scope.index)"
              >
                {{ scope.opt }}
              </q-chip>
            </template>
            <template #no-option>
              <q-item>
                <q-item-section class="text-grey">
                  {{ t('plugins.noTagsFound') || 'No tags found' }}
                </q-item-section>
              </q-item>
            </template>
          </q-select>
        </div>

        <!-- Language Filter -->
        <div
          v-if="pluginStore.allLanguages.length > 0"
          class="plugins-marketplace__filter-group plugins-marketplace__filter-group--language"
        >
          <span class="plugins-marketplace__filter-label">
            {{ t('plugins.filterByLanguage') || 'Language' }}:
          </span>
          <q-select
            :model-value="pluginStore.selectedLanguage"
            :options="filteredLanguageOptions"
            dense
            outlined
            clearable
            use-input
            input-debounce="0"
            dropdown-icon="mdi-chevron-down"
            :placeholder="t('plugins.selectLanguage') || 'Select language...'"
            class="plugins-marketplace__language-select"
            popup-content-class="plugins-marketplace__language-dropdown"
            @update:model-value="onLanguageChange"
            @filter="filterLanguages"
          >
            <template #no-option>
              <q-item>
                <q-item-section class="text-grey">
                  {{ t('plugins.noLanguagesFound') || 'No languages found' }}
                </q-item-section>
              </q-item>
            </template>
          </q-select>
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

  &__filter-group--tags {
    align-items: center;
  }

  &__filter-group--language {
    align-items: center;
  }

  &__tags-select {
    flex: 1;
    min-width: 200px;
    max-width: 400px;

    :deep(.q-field__control) {
      min-height: 32px;
      background-color: var(--input-bg, rgba(0, 0, 0, 0.05));
    }

    :deep(.q-field__native) {
      min-height: 28px;
      padding: 2px 8px;
    }

    :deep(.q-chip) {
      font-size: 11px;
      height: 20px;
    }
  }

  &__language-select {
    flex: 1;
    min-width: 150px;
    max-width: 250px;

    :deep(.q-field__control) {
      min-height: 32px;
      background-color: var(--input-bg, rgba(0, 0, 0, 0.05));
    }

    :deep(.q-field__native) {
      min-height: 28px;
      padding: 2px 8px;
    }
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

<style lang="scss">
// Global styles for dropdown (rendered in portal outside component)
.plugins-marketplace__tags-dropdown {
  z-index: 9999 !important;
}

.plugins-marketplace__language-dropdown {
  z-index: 9999 !important;
}
</style>
