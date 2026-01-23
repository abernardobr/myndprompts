<script setup lang="ts">
/**
 * LibraryDialog Component
 *
 * Revamped Library Dialog with item-centric view.
 * Shows all prompts/items from all plugins in a searchable list.
 * Features:
 * - Master-detail layout (list on left, preview on right)
 * - Search across all items
 * - Arrow key navigation
 * - Install whole library with one click
 */

import { ref, computed, watch, onUnmounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { usePluginStore } from '@/stores/pluginStore';
import { useAppStore } from '@/stores/appStore';
import { PLUGIN_TYPE_INFO } from '@/services/plugins/types';
import type { IMarketplacePlugin } from '@/services/plugins/types';
import type { IPluginItem, IPlugin, PluginType } from '@/services/storage/entities';

// Tab types
type TabType = 'library' | 'installed';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const { t } = useI18n({ useScope: 'global' });
const $q = useQuasar();
const pluginStore = usePluginStore();
const appStore = useAppStore();

// Check if on macOS
const isMac = computed(() => appStore.isMac);

// Refs
const activeTab = ref<TabType>('library');
const searchQuery = ref('');
const selectedIndex = ref(0);
const showPreview = ref(false);
const listContainerRef = ref<HTMLElement | null>(null);
const installingPluginIds = ref<Set<string>>(new Set());
const uninstallingPluginIds = ref<Set<string>>(new Set());

// Filter state
const selectedTypes = ref<PluginType[]>([]);
const selectedTags = ref<string[]>([]);
const selectedLanguage = ref<string | null>(null);

// Interface for flattened items (works for both marketplace and installed)
interface IFlattenedItem {
  item: IPluginItem;
  plugin: IMarketplacePlugin | IPlugin;
  itemIndex: number;
  isInstalled: boolean;
}

// Dialog visibility
const isOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

// Normalize string for diacritics-insensitive search
function normalizeForSearch(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Flatten all items from marketplace plugins (Library tab)
const flattenedMarketplaceItems = computed<IFlattenedItem[]>(() => {
  const items: IFlattenedItem[] = [];

  for (const plugin of pluginStore.availablePlugins) {
    plugin.items.forEach((item, index) => {
      items.push({
        item,
        plugin,
        itemIndex: index,
        isInstalled: false,
      });
    });
  }

  return items;
});

// Flatten all items from installed plugins (Installed tab)
const flattenedInstalledItems = computed<IFlattenedItem[]>(() => {
  const items: IFlattenedItem[] = [];

  for (const plugin of pluginStore.installed) {
    plugin.items.forEach((item, index) => {
      items.push({
        item,
        plugin,
        itemIndex: index,
        isInstalled: true,
      });
    });
  }

  return items;
});

// Flatten items based on active tab
const flattenedItems = computed<IFlattenedItem[]>(() => {
  return activeTab.value === 'library'
    ? flattenedMarketplaceItems.value
    : flattenedInstalledItems.value;
});

// Available filter options - computed from flattenedItems (same source that displays items)
const availableTypes = computed<PluginType[]>(() => {
  const types = new Set<PluginType>();
  for (const entry of flattenedItems.value) {
    const type = entry.item.type ?? entry.plugin.type;
    if (type) {
      types.add(type);
    }
  }
  return Array.from(types);
});

const availableTags = computed<string[]>(() => {
  const tags = new Set<string>();
  for (const entry of flattenedItems.value) {
    // Item-level tags
    entry.item.tags?.forEach((tag) => tags.add(tag));
    // Plugin-level tags
    entry.plugin.tags?.forEach((tag) => tags.add(tag));
  }
  return Array.from(tags).sort();
});

const availableLanguages = computed<string[]>(() => {
  const languages = new Set<string>();
  for (const entry of flattenedItems.value) {
    const lang = entry.item.language ?? entry.plugin.language;
    if (lang) {
      languages.add(lang.toUpperCase());
    }
  }
  return Array.from(languages).sort();
});

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return (
    selectedTypes.value.length > 0 ||
    selectedTags.value.length > 0 ||
    selectedLanguage.value !== null
  );
});

// Clear all filters
function clearFilters(): void {
  selectedTypes.value = [];
  selectedTags.value = [];
  selectedLanguage.value = null;
}

// Remove a single tag from the selected tags
function removeTag(tag: string): void {
  const index = selectedTags.value.indexOf(tag);
  if (index > -1) {
    selectedTags.value.splice(index, 1);
  }
}

// Filtered items based on search query and filters (OR logic for filters)
const filteredItems = computed<IFlattenedItem[]>(() => {
  let items = flattenedItems.value;

  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = normalizeForSearch(searchQuery.value.trim());

    items = items.filter((entry) => {
      const { item, plugin } = entry;

      // Search in item fields
      const title = normalizeForSearch(item.title ?? '');
      const description = normalizeForSearch(item.description ?? '');
      const content = normalizeForSearch(item.content ?? '');
      const tags = normalizeForSearch((item.tags ?? []).join(' '));
      const language = normalizeForSearch(item.language ?? '');

      // Search in plugin fields
      const pluginName = normalizeForSearch(plugin.name ?? '');
      const pluginTags = normalizeForSearch((plugin.tags ?? []).join(' '));

      return (
        title.includes(query) ||
        description.includes(query) ||
        content.includes(query) ||
        tags.includes(query) ||
        language.includes(query) ||
        pluginName.includes(query) ||
        pluginTags.includes(query)
      );
    });
  }

  // Apply filters with OR logic across categories
  // Item passes if it matches ANY active filter category
  if (hasActiveFilters.value) {
    items = items.filter((entry) => {
      const { item, plugin } = entry;
      const itemType = item.type ?? plugin.type;
      const itemLang = (item.language ?? plugin.language)?.toUpperCase();
      const itemTags = [...(item.tags ?? []), ...(plugin.tags ?? [])];

      // Check each active filter category - OR logic means item passes if it matches ANY
      const typeFilterActive = selectedTypes.value.length > 0;
      const tagsFilterActive = selectedTags.value.length > 0;
      const langFilterActive = selectedLanguage.value !== null;

      const matchesType = typeFilterActive && itemType && selectedTypes.value.includes(itemType);
      const matchesTags =
        tagsFilterActive && selectedTags.value.some((tag) => itemTags.includes(tag));
      const matchesLanguage = langFilterActive && itemLang === selectedLanguage.value;

      // OR logic: pass if item matches ANY of the active filter categories
      return Boolean(matchesType) || Boolean(matchesTags) || Boolean(matchesLanguage);
    });
  }

  return items;
});

// Currently selected item
const selectedItem = computed<IFlattenedItem | null>(() => {
  if (filteredItems.value.length === 0) return null;
  const index = Math.min(selectedIndex.value, filteredItems.value.length - 1);
  return filteredItems.value[index] ?? null;
});

// Get type info for display
function getTypeInfo(item: IPluginItem, plugin: IMarketplacePlugin | IPlugin) {
  const type = item.type ?? plugin.type;
  if (!type) return null;
  return PLUGIN_TYPE_INFO[type] ?? null;
}

// Get type label
function getTypeLabel(item: IPluginItem, plugin: IMarketplacePlugin | IPlugin): string {
  const info = getTypeInfo(item, plugin);
  return info?.label ?? 'Unknown';
}

// Get type icon
function getTypeIcon(item: IPluginItem, plugin: IMarketplacePlugin | IPlugin): string {
  const info = getTypeInfo(item, plugin);
  return info?.icon ?? 'mdi-file-document-outline';
}

// Get type color
function getTypeColor(item: IPluginItem, plugin: IMarketplacePlugin | IPlugin): string {
  const info = getTypeInfo(item, plugin);
  return info?.color ?? 'grey';
}

// Check if plugin is being installed
function isInstalling(pluginId: string): boolean {
  return installingPluginIds.value.has(pluginId);
}

// Check if plugin is being uninstalled
function isUninstalling(pluginId: string): boolean {
  return uninstallingPluginIds.value.has(pluginId);
}

// Handle install plugin
async function handleInstall(plugin: IMarketplacePlugin): Promise<void> {
  if (installingPluginIds.value.has(plugin.id)) return;

  installingPluginIds.value.add(plugin.id);

  try {
    const success = await pluginStore.installPlugin(plugin);

    if (success) {
      $q.notify({
        type: 'positive',
        message: t('plugins.installSuccess') || 'Library installed successfully',
        caption: `${plugin.items.length} items added`,
        icon: 'mdi-check-circle',
        position: 'bottom-right',
      });
    } else {
      $q.notify({
        type: 'negative',
        message: t('plugins.installError') || 'Failed to install library',
        caption: pluginStore.error ?? undefined,
        icon: 'mdi-alert-circle',
        position: 'bottom-right',
      });
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: t('plugins.installError') || 'Failed to install library',
      caption: error instanceof Error ? error.message : undefined,
      icon: 'mdi-alert-circle',
      position: 'bottom-right',
    });
  } finally {
    installingPluginIds.value.delete(plugin.id);
  }
}

// Handle uninstall plugin
function handleUninstall(plugin: IPlugin): void {
  if (uninstallingPluginIds.value.has(plugin.id)) return;

  // Show confirmation dialog
  $q.dialog({
    title: t('plugins.uninstallTitle') || 'Uninstall Library',
    message: (
      t('plugins.uninstallMessage') || 'Are you sure you want to uninstall "{name}"?'
    ).replace('{name}', plugin.name),
    persistent: true,
    ok: {
      label: t('plugins.uninstall') || 'Uninstall',
      color: 'negative',
      flat: true,
    },
    cancel: {
      label: t('common.cancel') || 'Cancel',
      flat: true,
    },
  }).onOk(() => {
    uninstallingPluginIds.value.add(plugin.id);

    void (async () => {
      try {
        const success = await pluginStore.uninstallPlugin(plugin.id);

        if (success) {
          $q.notify({
            type: 'positive',
            message: t('plugins.uninstallSuccess') || 'Library uninstalled successfully',
            caption: `${plugin.items.length} items removed`,
            icon: 'mdi-check-circle',
            position: 'bottom-right',
          });
          // Reset selection if the current item was from the uninstalled plugin
          selectedIndex.value = 0;
        } else {
          $q.notify({
            type: 'negative',
            message: t('plugins.uninstallError') || 'Failed to uninstall library',
            caption: pluginStore.error ?? undefined,
            icon: 'mdi-alert-circle',
            position: 'bottom-right',
          });
        }
      } catch (error) {
        $q.notify({
          type: 'negative',
          message: t('plugins.uninstallError') || 'Failed to uninstall library',
          caption: error instanceof Error ? error.message : undefined,
          icon: 'mdi-alert-circle',
          position: 'bottom-right',
        });
      } finally {
        uninstallingPluginIds.value.delete(plugin.id);
      }
    })();
  });
}

// Handle keyboard navigation
function handleKeyDown(event: KeyboardEvent): void {
  if (!isOpen.value) return;

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      if (selectedIndex.value < filteredItems.value.length - 1) {
        selectedIndex.value++;
        scrollToSelected();
      }
      break;
    case 'ArrowUp':
      event.preventDefault();
      if (selectedIndex.value > 0) {
        selectedIndex.value--;
        scrollToSelected();
      }
      break;
    case 'Enter':
      event.preventDefault();
      if (selectedItem.value) {
        if (selectedItem.value.isInstalled) {
          handleUninstall(selectedItem.value.plugin as IPlugin);
        } else {
          void handleInstall(selectedItem.value.plugin as IMarketplacePlugin);
        }
      }
      break;
    case 'Escape':
      event.preventDefault();
      handleClose();
      break;
  }
}

// Scroll to keep selected item visible
function scrollToSelected(): void {
  void nextTick(() => {
    const container = listContainerRef.value;
    if (!container) return;

    const selectedElement = container.querySelector('.library-item--selected');
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
}

// Select item by index and open preview
function selectItem(index: number): void {
  selectedIndex.value = index;
  // Open preview panel when clicking a card
  showPreview.value = true;
}

// Close preview panel
function closePreview(): void {
  showPreview.value = false;
}

// Hide/show macOS traffic lights when dialog opens/closes
async function setTrafficLightsVisible(visible: boolean): Promise<void> {
  if (isMac.value && window.electronAPI?.setTrafficLightsVisible) {
    try {
      await window.electronAPI.setTrafficLightsVisible(visible);
    } catch (error) {
      console.warn('[LibraryDialog] Failed to toggle traffic lights:', error);
    }
  }
}

// Handle close
function handleClose(): void {
  isOpen.value = false;
}

// Reset state when tab, search, or filters change
watch([activeTab, searchQuery, selectedTypes, selectedTags, selectedLanguage], () => {
  selectedIndex.value = 0;
});

// Handle dialog open/close
watch(isOpen, async (open) => {
  if (open) {
    await setTrafficLightsVisible(false);

    // Initialize plugin store if needed
    if (!pluginStore.isInitialized) {
      await pluginStore.initialize();
    }

    // Reset state
    activeTab.value = 'library';
    searchQuery.value = '';
    selectedIndex.value = 0;
    selectedTypes.value = [];
    selectedTags.value = [];
    selectedLanguage.value = null;

    // Add keyboard listener
    window.addEventListener('keydown', handleKeyDown);
  } else {
    await setTrafficLightsVisible(true);
    window.removeEventListener('keydown', handleKeyDown);
  }
});

// Cleanup on unmount
onUnmounted(() => {
  if (isOpen.value) {
    void setTrafficLightsVisible(true);
  }
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <q-dialog
    v-model="isOpen"
    persistent
    maximized
    transition-show="fade"
    transition-hide="fade"
    class="library-dialog-wrapper"
  >
    <q-card class="library-dialog">
      <!-- Header with inline tabs -->
      <q-card-section class="library-dialog__header">
        <div class="library-dialog__title-row">
          <q-icon
            name="mdi-bookshelf"
            size="24px"
            class="library-dialog__icon"
          />
          <div class="library-dialog__title">{{ t('plugins.title') || 'Library' }}</div>

          <!-- Inline Tabs -->
          <div class="library-dialog__tabs-wrapper">
            <q-btn-toggle
              v-model="activeTab"
              no-caps
              rounded
              unelevated
              toggle-color="primary"
              color="grey-8"
              text-color="grey-4"
              :options="[
                { value: 'library', slot: 'library' },
                { value: 'installed', slot: 'installed' },
              ]"
              class="library-dialog__tab-toggle"
            >
              <template #library>
                <div class="library-dialog__tab-btn">
                  <q-icon
                    name="mdi-store"
                    size="16px"
                  />
                  <span>{{ t('plugins.marketplace') || 'Marketplace' }}</span>
                  <q-badge
                    v-if="pluginStore.availablePlugins.length > 0"
                    color="grey-6"
                    text-color="white"
                  >
                    {{ pluginStore.availablePlugins.length }}
                  </q-badge>
                </div>
              </template>
              <template #installed>
                <div class="library-dialog__tab-btn">
                  <q-icon
                    name="mdi-check-circle-outline"
                    size="16px"
                  />
                  <span>{{ t('plugins.installed') || 'Installed' }}</span>
                  <q-badge
                    v-if="pluginStore.installed.length > 0"
                    color="green"
                    text-color="white"
                  >
                    {{ pluginStore.installed.length }}
                  </q-badge>
                </div>
              </template>
            </q-btn-toggle>
          </div>

          <q-badge
            v-if="filteredItems.length > 0"
            color="grey-7"
            text-color="white"
            class="library-dialog__count-badge"
          >
            {{ filteredItems.length }}
            {{
              filteredItems.length === 1 ? t('common.item') || 'item' : t('common.items') || 'items'
            }}
          </q-badge>

          <q-space />

          <div class="library-dialog__hint">
            <kbd>↑</kbd><kbd>↓</kbd> {{ t('plugins.hintNavigate') || 'navigate' }}
            <span class="q-mx-sm">•</span>
            <kbd>Enter</kbd>
            {{
              activeTab === 'library'
                ? t('plugins.hintInstall') || 'install library'
                : t('plugins.hintUninstall') || 'uninstall'
            }}
            <span class="q-mx-sm">•</span>
            <kbd>Esc</kbd> {{ t('plugins.hintClose') || 'close' }}
          </div>
        </div>
        <div class="library-dialog__actions">
          <!-- Refresh button -->
          <q-btn
            v-if="pluginStore.isInitialized"
            flat
            dense
            round
            icon="mdi-refresh"
            color="grey"
            :loading="pluginStore.isLoading"
            @click="pluginStore.refreshMarketplace(true)"
          >
            <q-tooltip>{{ t('common.refresh') || 'Refresh' }}</q-tooltip>
          </q-btn>
          <!-- Close button -->
          <q-btn
            flat
            dense
            round
            icon="close"
            class="library-dialog__close"
            @click="handleClose"
          />
        </div>
      </q-card-section>

      <!-- Search Bar -->
      <div class="library-dialog__search">
        <q-input
          v-model="searchQuery"
          dense
          outlined
          autofocus
          :placeholder="t('plugins.searchItems') || 'Search templates, personas, snippets...'"
          clearable
          class="library-dialog__search-input"
        >
          <template #prepend>
            <q-icon name="mdi-magnify" />
          </template>
        </q-input>

        <!-- Filters Row -->
        <div class="library-dialog__filters">
          <!-- Type Filter (chips/multi-select) -->
          <div class="library-dialog__filter-group">
            <q-select
              v-model="selectedTypes"
              :options="availableTypes"
              :option-label="(opt: PluginType) => PLUGIN_TYPE_INFO[opt]?.label || opt"
              multiple
              dense
              outlined
              emit-value
              use-chips
              clearable
              :placeholder="t('plugins.filterByType') || 'Type'"
              class="library-dialog__filter-select"
              popup-content-class="library-dialog__filter-popup"
            >
              <template #prepend>
                <q-icon
                  name="mdi-shape-outline"
                  size="18px"
                />
              </template>
            </q-select>
          </div>

          <!-- Tags Filter (multi-select) -->
          <div class="library-dialog__filter-group library-dialog__filter-group--tags">
            <q-select
              v-model="selectedTags"
              :options="availableTags"
              multiple
              dense
              outlined
              emit-value
              use-chips
              clearable
              :placeholder="t('plugins.filterByTags') || 'Tags'"
              class="library-dialog__filter-select library-dialog__filter-select--tags"
              popup-content-class="library-dialog__filter-popup"
            >
              <template #prepend>
                <q-icon
                  name="mdi-tag-multiple-outline"
                  size="18px"
                />
              </template>
              <template #selected-item="scope">
                <q-chip
                  v-if="scope.index < 3"
                  dense
                  removable
                  clickable
                  color="grey-8"
                  text-color="grey-4"
                  size="sm"
                  class="library-dialog__tag-chip"
                  @remove="removeTag(scope.opt)"
                >
                  {{ scope.opt }}
                </q-chip>
                <span
                  v-else-if="scope.index === 3"
                  class="library-dialog__more-tags"
                >
                  +{{ selectedTags.length - 3 }}
                </span>
              </template>
            </q-select>
          </div>

          <!-- Language Filter (single select) -->
          <div class="library-dialog__filter-group">
            <q-select
              v-model="selectedLanguage"
              :options="availableLanguages"
              dense
              outlined
              emit-value
              clearable
              :placeholder="t('plugins.filterByLanguage') || 'Language'"
              class="library-dialog__filter-select library-dialog__filter-select--language"
              popup-content-class="library-dialog__filter-popup"
            >
              <template #prepend>
                <q-icon
                  name="mdi-translate"
                  size="18px"
                />
              </template>
            </q-select>
          </div>

          <!-- Clear Filters Button -->
          <q-btn
            v-if="hasActiveFilters"
            flat
            dense
            no-caps
            color="grey"
            icon="mdi-filter-off-outline"
            :label="t('plugins.clearFilters') || 'Clear'"
            class="library-dialog__clear-filters"
            @click="clearFilters"
          />
        </div>
      </div>

      <q-separator />

      <!-- Main Content -->
      <div class="library-dialog__content">
        <!-- Loading State -->
        <div
          v-if="pluginStore.isLoading && !pluginStore.isInitialized"
          class="library-dialog__state"
        >
          <q-spinner
            color="primary"
            size="48px"
          />
          <div class="q-mt-md text-grey">
            {{ t('plugins.loadingPlugins') || 'Loading library...' }}
          </div>
        </div>

        <!-- Error State -->
        <div
          v-else-if="pluginStore.error && flattenedItems.length === 0"
          class="library-dialog__state"
        >
          <q-icon
            :name="pluginStore.isOffline ? 'mdi-wifi-off' : 'mdi-alert-circle-outline'"
            size="64px"
            :color="pluginStore.isOffline ? 'warning' : 'negative'"
          />
          <div
            class="q-mt-md text-h6"
            :class="pluginStore.isOffline ? 'text-warning' : 'text-negative'"
          >
            {{
              pluginStore.isOffline
                ? t('plugins.offline') || 'You appear to be offline'
                : t('plugins.fetchError') || 'Failed to load library'
            }}
          </div>
          <q-btn
            color="primary"
            icon="mdi-refresh"
            :label="t('common.retry') || 'Retry'"
            class="q-mt-lg"
            @click="pluginStore.refreshMarketplace(true)"
          />
        </div>

        <!-- Empty State -->
        <div
          v-else-if="filteredItems.length === 0"
          class="library-dialog__state"
        >
          <q-icon
            :name="activeTab === 'installed' ? 'mdi-package-variant' : 'mdi-magnify-close'"
            size="64px"
            color="grey-5"
          />
          <div class="q-mt-md text-grey text-h6">
            <template v-if="activeTab === 'installed' && !searchQuery && !hasActiveFilters">
              {{ t('plugins.noInstalledLibraries') || 'No installed libraries' }}
            </template>
            <template v-else>
              {{
                searchQuery || hasActiveFilters
                  ? t('plugins.noItemsFound') || 'No items found'
                  : t('plugins.noPluginsFound') || 'No items available'
              }}
            </template>
          </div>
          <div
            v-if="activeTab === 'installed' && !searchQuery && !hasActiveFilters"
            class="text-caption text-grey q-mt-sm"
          >
            {{ t('plugins.goToMarketplace') || 'Browse the Marketplace tab to install libraries' }}
          </div>
          <div
            v-else-if="searchQuery || hasActiveFilters"
            class="text-caption text-grey q-mt-sm"
          >
            {{ t('plugins.tryDifferentSearch') || 'Try a different search term or adjust filters' }}
          </div>
          <q-btn
            v-if="hasActiveFilters"
            color="primary"
            icon="mdi-filter-off-outline"
            :label="t('plugins.clearFilters') || 'Clear Filters'"
            class="q-mt-md"
            outline
            no-caps
            @click="clearFilters"
          />
          <q-btn
            v-if="activeTab === 'installed' && !searchQuery && !hasActiveFilters"
            color="primary"
            icon="mdi-store"
            :label="t('plugins.browseMarketplace') || 'Browse Marketplace'"
            class="q-mt-md"
            no-caps
            unelevated
            @click="activeTab = 'library'"
          />
        </div>

        <!-- Master-Detail Layout -->
        <template v-else>
          <!-- Item List/Grid (Left Panel) -->
          <div
            ref="listContainerRef"
            class="library-dialog__list"
            :class="{ 'library-dialog__list--grid': !showPreview }"
          >
            <div
              v-for="(entry, index) in filteredItems"
              :key="`${entry.plugin.id}-${entry.itemIndex}`"
              class="library-item"
              :class="{
                'library-item--selected': index === selectedIndex,
                'library-item--card': !showPreview,
              }"
              @click="selectItem(index)"
            >
              <!-- Item Header -->
              <div class="library-item__header">
                <q-icon
                  :name="getTypeIcon(entry.item, entry.plugin)"
                  :color="getTypeColor(entry.item, entry.plugin)"
                  size="20px"
                  class="library-item__type-icon"
                />
                <div class="library-item__title">{{ entry.item.title }}</div>
              </div>

              <!-- Item Description -->
              <div
                v-if="entry.item.description"
                class="library-item__description"
              >
                {{ entry.item.description }}
              </div>

              <!-- Item Meta -->
              <div class="library-item__meta">
                <!-- Type Badge -->
                <q-badge
                  :color="getTypeColor(entry.item, entry.plugin)"
                  text-color="white"
                  class="library-item__type-badge"
                >
                  {{ getTypeLabel(entry.item, entry.plugin) }}
                </q-badge>

                <!-- Language Badge -->
                <q-badge
                  v-if="entry.item.language"
                  color="blue-grey"
                  text-color="white"
                  class="library-item__lang-badge"
                >
                  <q-icon
                    name="mdi-translate"
                    size="12px"
                    class="q-mr-xs"
                  />
                  {{ entry.item.language.toUpperCase() }}
                </q-badge>

                <!-- Plugin/Library Info -->
                <div class="library-item__plugin">
                  <q-icon
                    name="mdi-puzzle-outline"
                    size="14px"
                    class="q-mr-xs"
                  />
                  {{ entry.plugin.name }}
                </div>
              </div>

              <!-- Tags -->
              <div
                v-if="entry.item.tags && entry.item.tags.length > 0"
                class="library-item__tags"
              >
                <q-chip
                  v-for="tag in entry.item.tags.slice(0, 3)"
                  :key="tag"
                  dense
                  size="sm"
                  color="grey-8"
                  text-color="grey-4"
                  class="library-item__tag"
                >
                  {{ tag }}
                </q-chip>
                <span
                  v-if="entry.item.tags.length > 3"
                  class="library-item__more-tags"
                >
                  +{{ entry.item.tags.length - 3 }}
                </span>
              </div>
            </div>
          </div>

          <!-- Preview Panel (Right Panel) - Collapsible -->
          <div
            v-if="showPreview"
            class="library-dialog__preview"
          >
            <template v-if="selectedItem">
              <!-- Preview Header -->
              <div class="preview-header">
                <div class="preview-header__title-row">
                  <q-icon
                    :name="getTypeIcon(selectedItem.item, selectedItem.plugin)"
                    :color="getTypeColor(selectedItem.item, selectedItem.plugin)"
                    size="28px"
                  />
                  <div class="preview-header__title">{{ selectedItem.item.title }}</div>
                  <!-- Close Preview Button -->
                  <q-btn
                    flat
                    dense
                    round
                    icon="mdi-close"
                    color="grey"
                    class="preview-header__close"
                    @click.stop="closePreview"
                  >
                    <q-tooltip>{{ t('common.close') || 'Close' }}</q-tooltip>
                  </q-btn>
                </div>
                <div
                  v-if="selectedItem.item.description"
                  class="preview-header__description"
                >
                  {{ selectedItem.item.description }}
                </div>

                <!-- Meta Info -->
                <div class="preview-header__meta">
                  <div class="preview-header__meta-item">
                    <q-icon
                      name="mdi-puzzle-outline"
                      size="16px"
                    />
                    <span>{{ selectedItem.plugin.name }}</span>
                    <span class="text-grey-6">v{{ selectedItem.plugin.version }}</span>
                  </div>
                  <div
                    v-if="selectedItem.item.language"
                    class="preview-header__meta-item"
                  >
                    <q-icon
                      name="mdi-translate"
                      size="16px"
                    />
                    <span>{{ selectedItem.item.language.toUpperCase() }}</span>
                  </div>
                  <div class="preview-header__meta-item">
                    <q-icon
                      name="mdi-package-variant"
                      size="16px"
                    />
                    <span>{{ selectedItem.plugin.items.length }} items in library</span>
                  </div>
                </div>

                <!-- Tags -->
                <div
                  v-if="selectedItem.item.tags && selectedItem.item.tags.length > 0"
                  class="preview-header__tags"
                >
                  <q-chip
                    v-for="tag in selectedItem.item.tags"
                    :key="tag"
                    dense
                    size="sm"
                    outline
                    color="primary"
                  >
                    {{ tag }}
                  </q-chip>
                </div>

                <!-- Action Button (Install / Uninstall) -->
                <div class="preview-header__actions">
                  <!-- Install Button (Marketplace tab) -->
                  <q-btn
                    v-if="!selectedItem.isInstalled"
                    color="primary"
                    icon="mdi-download"
                    :label="
                      t('plugins.installLibrary') ||
                      `Install Library (${selectedItem.plugin.items.length} items)`
                    "
                    :loading="isInstalling(selectedItem.plugin.id)"
                    no-caps
                    unelevated
                    class="full-width"
                    @click="handleInstall(selectedItem.plugin as IMarketplacePlugin)"
                  />
                  <!-- Uninstall Button (Installed tab) -->
                  <q-btn
                    v-else
                    color="negative"
                    icon="mdi-delete-outline"
                    :label="t('plugins.uninstall') || 'Uninstall'"
                    :loading="isUninstalling(selectedItem.plugin.id)"
                    no-caps
                    outline
                    class="full-width"
                    @click="handleUninstall(selectedItem.plugin as IPlugin)"
                  />
                </div>
              </div>

              <q-separator />

              <!-- Content Preview -->
              <div class="preview-content">
                <div class="preview-content__label">
                  <q-icon
                    name="mdi-text"
                    size="16px"
                    class="q-mr-xs"
                  />
                  Content Preview
                </div>
                <pre class="preview-content__code">{{ selectedItem.item.content }}</pre>
              </div>
            </template>
          </div>
        </template>
      </div>
    </q-card>
  </q-dialog>
</template>

<style lang="scss" scoped>
.library-dialog {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  max-width: 100vw;
  max-height: 100vh;
  margin: 0;
  border-radius: 0;
  background-color: var(--dialog-bg, #1e1e1e);
  -webkit-app-region: no-drag; // CRITICAL: Prevent underlying drag regions from intercepting clicks

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background-color: var(--header-bg, #252526);
    border-bottom: 1px solid var(--border-color, #3c3c3c);
    -webkit-app-region: no-drag; // Ensure header is fully clickable
  }

  &__title-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  &__tabs-wrapper {
    flex-shrink: 0;
  }

  &__tab-toggle {
    :deep(.q-btn) {
      padding: 4px 12px;
      min-height: 32px;
    }
  }

  &__tab-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 500;

    .q-badge {
      font-size: 10px;
      padding: 2px 6px;
    }
  }

  &__count-badge {
    flex-shrink: 0;
  }

  &__hint {
    font-size: 11px;
    color: var(--text-tertiary, #6f6f6f);
    flex-shrink: 0;
    white-space: nowrap;

    kbd {
      display: inline-block;
      padding: 2px 6px;
      margin: 0 2px;
      font-family: inherit;
      font-size: 10px;
      background-color: var(--kbd-bg, rgba(255, 255, 255, 0.1));
      border-radius: 3px;
      border: 1px solid var(--kbd-border, rgba(255, 255, 255, 0.2));
    }
  }

  &__icon {
    color: var(--icon-color, #858585);
    flex-shrink: 0;
  }

  &__title {
    font-size: 16px;
    font-weight: 500;
    color: var(--title-color, #cccccc);
    flex-shrink: 0;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__close {
    color: var(--close-color, #858585);

    &:hover {
      color: var(--close-hover-color, #ffffff);
    }
  }

  &__search {
    padding: 12px 16px;
    background-color: var(--header-bg, #252526);
  }

  &__search-input {
    :deep(.q-field__control) {
      background-color: var(--input-bg, rgba(255, 255, 255, 0.1));
    }
  }

  &__filters {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
    flex-wrap: wrap;
  }

  &__filter-group {
    flex: 0 0 auto;
  }

  &__filter-select {
    min-width: 160px;
    max-width: 240px;

    :deep(.q-field__control) {
      min-height: 36px;
      background-color: var(--input-bg, rgba(255, 255, 255, 0.1));
    }

    :deep(.q-chip) {
      margin: 2px;
    }

    &--tags {
      min-width: 400px;
      max-width: 600px;

      :deep(.q-field__control-container) {
        flex-wrap: nowrap;
        overflow: hidden;
      }

      // Hide the counter
      :deep(.q-field__counter) {
        display: none;
      }
    }

    &--language {
      min-width: 120px;
      max-width: 140px;
    }
  }

  &__clear-filters {
    margin-left: auto;
  }

  &__more-tags {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary, #858585);
    padding: 2px 6px;
    background-color: var(--input-bg, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
    margin-left: 4px;
  }

  &__tag-chip {
    -webkit-app-region: no-drag;
    cursor: pointer;

    :deep(.q-chip__icon--remove) {
      cursor: pointer;
      -webkit-app-region: no-drag;
    }
  }

  &__content {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  &__state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 16px;
    text-align: center;
  }

  &__list {
    width: 400px;
    min-width: 350px;
    max-width: 450px;
    overflow-y: auto;
    border-right: 1px solid var(--border-color, #3c3c3c);
    background-color: var(--list-bg, #252526);

    // Grid mode when preview is closed
    &--grid {
      width: 100%;
      max-width: 100%;
      border-right: none;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 12px;
      padding: 16px;
      align-content: start;
    }
  }

  &__preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background-color: var(--preview-bg, #1e1e1e);
  }
}

// Item Card
.library-item {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, #3c3c3c);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;

  &:hover {
    background-color: var(--item-hover-bg, rgba(255, 255, 255, 0.05));
  }

  &--selected {
    background-color: var(--item-selected-bg, rgba(0, 120, 212, 0.2));
    border-left: 3px solid var(--accent-color, #0078d4);
    padding-left: 13px;

    &:hover {
      background-color: var(--item-selected-bg, rgba(0, 120, 212, 0.2));
    }
  }

  // Card mode styles for grid layout
  &--card {
    border: 1px solid var(--border-color, #3c3c3c);
    border-radius: 8px;
    border-bottom: 1px solid var(--border-color, #3c3c3c);
    background-color: var(--card-bg, #2d2d2d);

    &:hover {
      background-color: var(--card-hover-bg, #333333);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      transform: translateY(-2px);
    }

    &.library-item--selected {
      border-color: var(--accent-color, #0078d4);
      border-left-width: 1px;
      padding-left: 16px;
      box-shadow: 0 0 0 1px var(--accent-color, #0078d4);
    }
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  &__type-icon {
    flex-shrink: 0;
  }

  &__title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary, #cccccc);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__description {
    font-size: 12px;
    color: var(--text-secondary, #858585);
    margin-bottom: 8px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 6px;
  }

  &__type-badge {
    font-size: 10px;
    padding: 2px 6px;
  }

  &__lang-badge {
    font-size: 10px;
    padding: 2px 6px;
  }

  &__plugin {
    display: flex;
    align-items: center;
    font-size: 11px;
    color: var(--text-tertiary, #6f6f6f);
    margin-left: auto;
  }

  &__tags {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  &__tag {
    font-size: 10px;
    height: 18px;
  }

  &__more-tags {
    font-size: 10px;
    color: var(--text-tertiary, #6f6f6f);
  }
}

// Preview Panel
.preview-header {
  padding: 20px;
  background-color: var(--preview-header-bg, #252526);

  &__title-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  &__title {
    flex: 1;
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary, #cccccc);
  }

  &__close {
    flex-shrink: 0;
    opacity: 0.7;

    &:hover {
      opacity: 1;
    }
  }

  &__description {
    font-size: 14px;
    color: var(--text-secondary, #858585);
    margin-bottom: 16px;
    line-height: 1.5;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 16px;
  }

  &__meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-secondary, #858585);
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 16px;
  }

  &__actions {
    margin-top: 16px;
  }
}

.preview-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px;

  &__label {
    display: flex;
    align-items: center;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary, #858585);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  &__code {
    flex: 1;
    margin: 0;
    padding: 16px;
    overflow: auto;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
    font-size: 13px;
    line-height: 1.6;
    color: var(--code-text, #d4d4d4);
    background-color: var(--code-bg, #1e1e1e);
    border-radius: 6px;
    border: 1px solid var(--border-color, #3c3c3c);
    white-space: pre-wrap;
    word-wrap: break-word;
  }
}

// Light theme
.body--light .library-dialog {
  --dialog-bg: #f5f5f5;
  --header-bg: #ffffff;
  --list-bg: #ffffff;
  --preview-bg: #f5f5f5;
  --preview-header-bg: #ffffff;
  --border-color: #e0e0e0;
  --icon-color: #6f6f6f;
  --title-color: #333333;
  --close-color: #6f6f6f;
  --close-hover-color: #333333;
  --input-bg: rgba(0, 0, 0, 0.05);
  --kbd-bg: rgba(0, 0, 0, 0.08);
  --kbd-border: rgba(0, 0, 0, 0.15);
  --item-hover-bg: rgba(0, 0, 0, 0.04);
  --item-selected-bg: rgba(0, 120, 212, 0.1);
  --accent-color: #0078d4;
  --text-primary: #333333;
  --text-secondary: #666666;
  --text-tertiary: #888888;
  --code-bg: #f8f8f8;
  --code-text: #333333;
  --card-bg: #ffffff;
  --card-hover-bg: #f8f8f8;
}

// Dark theme
.body--dark .library-dialog {
  --dialog-bg: #1e1e1e;
  --header-bg: #252526;
  --list-bg: #252526;
  --preview-bg: #1e1e1e;
  --preview-header-bg: #252526;
  --border-color: #3c3c3c;
  --icon-color: #858585;
  --title-color: #cccccc;
  --close-color: #858585;
  --close-hover-color: #ffffff;
  --input-bg: rgba(255, 255, 255, 0.1);
  --kbd-bg: rgba(255, 255, 255, 0.1);
  --kbd-border: rgba(255, 255, 255, 0.2);
  --item-hover-bg: rgba(255, 255, 255, 0.05);
  --item-selected-bg: rgba(0, 120, 212, 0.2);
  --accent-color: #0078d4;
  --text-primary: #cccccc;
  --text-secondary: #858585;
  --text-tertiary: #6f6f6f;
  --code-bg: #1e1e1e;
  --code-text: #d4d4d4;
  --card-bg: #2d2d2d;
  --card-hover-bg: #333333;
}
</style>

<style lang="scss">
// Global styles for dialog wrapper
.library-dialog-wrapper {
  z-index: 9999 !important;

  .q-dialog__backdrop {
    z-index: 9998 !important;
  }

  .q-dialog__inner {
    z-index: 9999 !important;
  }
}

// Filter popup styles - must have high z-index to appear above dialog
.library-dialog__filter-popup {
  z-index: 10000 !important;
  max-height: 300px;

  .q-item {
    min-height: 36px;
    padding: 4px 12px;
  }
}

// Ensure all q-menu popups from this dialog appear on top
.q-menu {
  &.library-dialog__filter-popup {
    z-index: 10000 !important;
  }
}
</style>
