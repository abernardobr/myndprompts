<script setup lang="ts">
/**
 * PluginCard Component
 *
 * Reusable card component for displaying plugin information.
 * Used in both Marketplace and Installed views.
 */

import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { IMarketplacePlugin } from '@/services/plugins/types';
import { getPluginTypeIcon, getPluginTypeColor, PLUGIN_TYPE_INFO } from '@/services/plugins/types';
import type { PluginType } from '@/services/storage/entities';

const props = defineProps<{
  plugin: IMarketplacePlugin;
  installing?: boolean;
}>();

const emit = defineEmits<{
  install: [plugin: IMarketplacePlugin];
  view: [plugin: IMarketplacePlugin];
}>();

const { t } = useI18n({ useScope: 'global' });

// Get all unique types from plugin (plugin-level + item-level)
const pluginTypes = computed((): PluginType[] => {
  const types: PluginType[] = [];
  if (props.plugin.type) {
    types.push(props.plugin.type);
  }
  props.plugin.items.forEach((item) => {
    if (item.type && !types.includes(item.type)) {
      types.push(item.type);
    }
  });
  return types;
});

// Get all unique tags from plugin (plugin-level + item-level)
const pluginTags = computed((): string[] => {
  const tags = [...props.plugin.tags];
  props.plugin.items.forEach((item) => {
    item.tags?.forEach((tag) => {
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    });
  });
  return tags;
});

// Get unique languages from plugin items
const pluginLanguages = computed((): string[] => {
  const languages = new Set<string>();
  props.plugin.items.forEach((item) => {
    if (item.language) {
      languages.add(item.language);
    }
  });
  return Array.from(languages).sort((a, b) => a.localeCompare(b));
});

// Visible languages (max 3)
const visibleLanguages = computed(() => pluginLanguages.value.slice(0, 3));
const hiddenLanguagesCount = computed(() => Math.max(0, pluginLanguages.value.length - 3));

// Maximum number of visible tags
const MAX_VISIBLE_TAGS = 4;

// Visible tags (first 4)
const visibleTags = computed(() => pluginTags.value.slice(0, MAX_VISIBLE_TAGS));

// Remaining tags count
const remainingTagsCount = computed(() => Math.max(0, pluginTags.value.length - MAX_VISIBLE_TAGS));

// Show all tags popup
const showAllTagsPopup = ref(false);

// Type display info for each type
const typeDisplayInfo = computed(() =>
  pluginTypes.value.map((type) => ({
    type,
    icon: PLUGIN_TYPE_INFO[type]?.icon ?? 'mdi-puzzle',
    color: PLUGIN_TYPE_INFO[type]?.color ?? 'grey',
    label: PLUGIN_TYPE_INFO[type]?.label ?? type,
  }))
);

// For backwards compatibility - use first type for main display
const typeIcon = computed(() =>
  pluginTypes.value.length > 0 ? getPluginTypeIcon(pluginTypes.value[0]) : 'mdi-puzzle'
);
const typeColor = computed(() =>
  pluginTypes.value.length > 0 ? getPluginTypeColor(pluginTypes.value[0]) : 'grey'
);

// Get display name - use name field if available, fallback to formatted ID
const displayName = computed(() => {
  if (props.plugin.name) {
    return props.plugin.name;
  }
  // Fallback: Convert ID like "development-personas" to "Development Personas"
  return props.plugin.id
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
});
</script>

<template>
  <q-card
    flat
    bordered
    class="plugin-card"
  >
    <q-card-section class="plugin-card__content">
      <div class="row items-start justify-between no-wrap">
        <!-- Plugin Info -->
        <div class="col plugin-card__info">
          <!-- Header: Icon, Name, Version -->
          <div class="row items-center q-gutter-sm">
            <q-icon
              :name="typeIcon"
              size="24px"
              :color="typeColor"
            />
            <span class="text-subtitle1 text-weight-medium plugin-card__name">
              {{ displayName }}
            </span>
            <q-chip
              dense
              size="sm"
              outline
              class="plugin-card__version"
            >
              v{{ plugin.version }}
            </q-chip>
          </div>

          <!-- Description -->
          <div
            v-if="plugin.description"
            class="text-body2 text-grey-7 q-mt-xs plugin-card__description"
          >
            {{ plugin.description }}
          </div>

          <!-- Types and items count -->
          <div class="q-mt-xs plugin-card__types">
            <q-chip
              v-for="typeInfo in typeDisplayInfo"
              :key="typeInfo.type"
              dense
              size="sm"
              :color="typeInfo.color"
              text-color="white"
              class="plugin-card__type-chip"
            >
              <q-icon
                :name="typeInfo.icon"
                size="12px"
                class="q-mr-xs"
              />
              {{ typeInfo.label }}
            </q-chip>
            <span class="text-caption text-grey plugin-card__items-count">
              {{ plugin.items.length }} {{ t('plugins.items') || 'items' }}
            </span>
          </div>

          <!-- Languages -->
          <div
            v-if="pluginLanguages.length > 0"
            class="plugin-card__languages"
          >
            <q-chip
              v-for="lang in visibleLanguages"
              :key="lang"
              dense
              size="sm"
              outline
              color="grey"
              class="plugin-card__language"
            >
              {{ lang }}
            </q-chip>
            <q-chip
              v-if="hiddenLanguagesCount > 0"
              dense
              size="sm"
              outline
              color="grey"
              class="plugin-card__language plugin-card__language--more"
            >
              +{{ hiddenLanguagesCount }}
              <q-tooltip>
                {{ pluginLanguages.slice(3).join(', ') }}
              </q-tooltip>
            </q-chip>
          </div>

          <!-- Tags (including item-level tags) -->
          <div
            v-if="pluginTags.length > 0"
            class="q-mt-sm plugin-card__tags"
          >
            <q-chip
              v-for="tag in visibleTags"
              :key="tag"
              dense
              size="sm"
              class="plugin-card__tag"
            >
              {{ tag }}
            </q-chip>
            <!-- Show +X button when there are more tags -->
            <q-chip
              v-if="remainingTagsCount > 0"
              dense
              size="sm"
              clickable
              color="grey-6"
              text-color="white"
              class="plugin-card__tag plugin-card__tag--more"
              @click.stop="showAllTagsPopup = true"
            >
              +{{ remainingTagsCount }}
              <!-- Popup with all tags -->
              <q-popup-proxy
                v-model="showAllTagsPopup"
                anchor="bottom middle"
                self="top middle"
                :offset="[0, 8]"
              >
                <q-card class="plugin-card__tags-popup">
                  <q-card-section class="plugin-card__tags-popup-content">
                    <div class="text-subtitle2 q-mb-sm">
                      {{ t('plugins.allTags') || 'All tags' }} ({{ pluginTags.length }})
                    </div>
                    <div class="plugin-card__tags-popup-list">
                      <q-chip
                        v-for="allTag in pluginTags"
                        :key="allTag"
                        dense
                        size="sm"
                        class="plugin-card__tag"
                      >
                        {{ allTag }}
                      </q-chip>
                    </div>
                  </q-card-section>
                </q-card>
              </q-popup-proxy>
            </q-chip>
          </div>
        </div>

        <!-- Actions -->
        <div class="col-auto plugin-card__actions">
          <div class="column q-gutter-sm">
            <q-btn
              flat
              dense
              color="primary"
              :label="t('plugins.view') || 'View'"
              no-caps
              icon="mdi-eye-outline"
              @click="emit('view', plugin)"
            />
            <q-btn
              :loading="installing"
              color="primary"
              :label="t('plugins.install') || 'Install'"
              no-caps
              unelevated
              @click="emit('install', plugin)"
            />
          </div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<style lang="scss" scoped>
.plugin-card {
  transition: border-color 0.2s ease;

  &:hover {
    border-color: var(--q-primary);
  }

  &__content {
    padding: 16px;
  }

  &__info {
    min-width: 0; // Allow text truncation
  }

  &__name {
    word-break: break-word;
  }

  &__description {
    line-height: 1.4;
  }

  &__version {
    flex-shrink: 0;
  }

  &__types {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  &__type-chip {
    font-size: 11px;
  }

  &__items-count {
    margin-left: 4px;
  }

  &__languages {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }

  &__language {
    font-size: 10px;
    height: 20px;

    :deep(.q-chip__content) {
      padding: 0 6px;
    }
  }

  &__language--more {
    cursor: help;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  &__tag {
    background-color: var(--tag-bg, rgba(0, 0, 0, 0.05));

    &--more {
      cursor: pointer;
      font-weight: 500;
    }
  }

  &__tags-popup {
    max-width: 400px;
    max-height: 300px;
  }

  &__tags-popup-content {
    padding: 12px;
  }

  &__tags-popup-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    max-height: 220px;
    overflow-y: auto;
  }

  &__actions {
    margin-left: 16px;
  }
}

.body--light .plugin-card {
  --tag-bg: rgba(0, 0, 0, 0.05);
}

.body--dark .plugin-card {
  --tag-bg: rgba(255, 255, 255, 0.1);
}
</style>
