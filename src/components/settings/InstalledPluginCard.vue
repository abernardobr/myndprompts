<script setup lang="ts">
/**
 * InstalledPluginCard Component
 *
 * Card component for displaying installed plugin information.
 * Shows installation date, update availability, and uninstall option.
 */

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { IPlugin } from '@/services/storage/entities';
import type { IPluginUpdateInfo } from '@/services/plugins/types';
import { formatPluginType, getPluginTypeIcon, getPluginTypeColor } from '@/services/plugins/types';

const props = defineProps<{
  plugin: IPlugin;
  updateInfo?: IPluginUpdateInfo;
  updating?: boolean;
  uninstalling?: boolean;
}>();

const emit = defineEmits<{
  update: [plugin: IPlugin];
  uninstall: [plugin: IPlugin];
  view: [plugin: IPlugin];
}>();

const { t, d } = useI18n({ useScope: 'global' });

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

// Check if update is available
const hasUpdate = computed(() => !!props.updateInfo);

// Format the installation date
const formattedInstallDate = computed(() => {
  const date = props.plugin.installedAt;
  if (!date) return '';

  // Use vue-i18n date formatting if available, otherwise use toLocaleDateString
  try {
    return d(date, 'short');
  } catch {
    return date.toLocaleDateString();
  }
});

// Format the update date
const formattedUpdateDate = computed(() => {
  const date = props.plugin.updatedAt;
  if (!date || date.getTime() === props.plugin.installedAt?.getTime()) return '';

  try {
    return d(date, 'short');
  } catch {
    return date.toLocaleDateString();
  }
});
</script>

<template>
  <q-card
    flat
    bordered
    class="installed-plugin-card"
  >
    <q-card-section class="installed-plugin-card__content">
      <div class="row items-start justify-between no-wrap">
        <!-- Plugin Info -->
        <div class="col installed-plugin-card__info">
          <!-- Header: Icon, Name, Version -->
          <div class="row items-center q-gutter-sm">
            <q-icon
              :name="typeIcon"
              size="24px"
              :color="typeColor"
            />
            <span class="text-subtitle1 text-weight-medium installed-plugin-card__name">
              {{ displayName }}
            </span>
            <q-chip
              dense
              size="sm"
              outline
              class="installed-plugin-card__version"
            >
              v{{ plugin.version }}
            </q-chip>
            <q-chip
              v-if="hasUpdate"
              dense
              size="sm"
              color="orange"
              text-color="white"
              icon="mdi-update"
            >
              v{{ updateInfo?.availableVersion }}
            </q-chip>
          </div>

          <!-- Description -->
          <div
            v-if="plugin.description"
            class="text-body2 text-grey-7 q-mt-xs installed-plugin-card__description"
          >
            {{ plugin.description }}
          </div>

          <!-- Type and items count -->
          <div class="text-caption text-grey q-mt-xs installed-plugin-card__meta">
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
            class="q-mt-sm installed-plugin-card__tags"
          >
            <q-chip
              v-for="tag in plugin.tags"
              :key="tag"
              dense
              size="sm"
              class="installed-plugin-card__tag"
            >
              {{ tag }}
            </q-chip>
          </div>

          <!-- Installation info -->
          <div class="q-mt-sm text-caption text-grey-6 installed-plugin-card__dates">
            <q-icon
              name="mdi-calendar-check"
              size="12px"
              class="q-mr-xs"
            />
            {{ t('plugins.installedOn') || 'Installed' }}: {{ formattedInstallDate }}
            <template v-if="formattedUpdateDate">
              <span class="q-mx-sm">·</span>
              <q-icon
                name="mdi-update"
                size="12px"
                class="q-mr-xs"
              />
              {{ t('plugins.updatedOn') || 'Updated' }}: {{ formattedUpdateDate }}
            </template>
          </div>
        </div>

        <!-- Actions -->
        <div class="col-auto installed-plugin-card__actions">
          <div class="column q-gutter-sm">
            <!-- View Button -->
            <q-btn
              flat
              dense
              color="primary"
              :label="t('plugins.view') || 'View'"
              no-caps
              size="sm"
              icon="mdi-eye-outline"
              @click="emit('view', plugin)"
            />

            <!-- Update Button -->
            <q-btn
              v-if="hasUpdate"
              :loading="updating"
              color="orange"
              text-color="white"
              :label="
                t('plugins.updateTo', { version: updateInfo?.availableVersion }) ||
                `Update to v${updateInfo?.availableVersion}`
              "
              no-caps
              unelevated
              size="sm"
              icon="mdi-update"
              @click="emit('update', plugin)"
            />

            <!-- Uninstall Button -->
            <q-btn
              :loading="uninstalling"
              color="negative"
              flat
              :label="t('plugins.uninstall') || 'Uninstall'"
              no-caps
              size="sm"
              icon="mdi-delete-outline"
              @click="emit('uninstall', plugin)"
            />
          </div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<style lang="scss" scoped>
.installed-plugin-card {
  transition: border-color 0.2s ease;

  &:hover {
    border-color: var(--q-primary);
  }

  &__content {
    padding: 16px;
  }

  &__info {
    min-width: 0;
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

  &__dates {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
  }

  &__actions {
    margin-left: 16px;
  }
}

.body--light .installed-plugin-card {
  --tag-bg: rgba(0, 0, 0, 0.05);
}

.body--dark .installed-plugin-card {
  --tag-bg: rgba(255, 255, 255, 0.1);
}
</style>
