<script setup lang="ts">
/**
 * PluginCard Component
 *
 * Reusable card component for displaying plugin information.
 * Used in both Marketplace and Installed views.
 */

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { IMarketplacePlugin } from '@/services/plugins/types';
import { formatPluginType, getPluginTypeIcon, getPluginTypeColor } from '@/services/plugins/types';

const props = defineProps<{
  plugin: IMarketplacePlugin;
  installing?: boolean;
}>();

const emit = defineEmits<{
  install: [plugin: IMarketplacePlugin];
  view: [plugin: IMarketplacePlugin];
}>();

const { t } = useI18n({ useScope: 'global' });

// Computed properties for display
const typeIcon = computed(() => getPluginTypeIcon(props.plugin.type));
const typeColor = computed(() => getPluginTypeColor(props.plugin.type));
const typeLabel = computed(() => formatPluginType(props.plugin.type));

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

          <!-- Type and items count -->
          <div class="text-caption text-grey q-mt-xs plugin-card__meta">
            <q-icon
              :name="typeIcon"
              size="12px"
              class="q-mr-xs"
            />
            {{ typeLabel }}
            <span class="q-mx-xs">·</span>
            {{ plugin.items.length }} {{ t('plugins.items') || 'items' }}
          </div>

          <!-- Tags -->
          <div
            v-if="plugin.tags.length > 0"
            class="q-mt-sm plugin-card__tags"
          >
            <q-chip
              v-for="tag in plugin.tags"
              :key="tag"
              dense
              size="sm"
              class="plugin-card__tag"
            >
              {{ tag }}
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

  &__meta {
    display: flex;
    align-items: center;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  &__tag {
    background-color: var(--tag-bg, rgba(0, 0, 0, 0.05));
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
