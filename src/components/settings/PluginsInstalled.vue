<script setup lang="ts">
/**
 * PluginsInstalled Component
 *
 * Installed tab content showing installed plugins with update/uninstall options.
 * Features:
 * - List of installed plugins
 * - Update button for plugins with available updates
 * - Uninstall with confirmation dialog
 * - Loading states per plugin
 * - Toast notifications for success/error
 */

import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { usePluginStore } from '@/stores/pluginStore';
import type { IPlugin } from '@/services/storage/entities';
import InstalledPluginCard from './InstalledPluginCard.vue';
import PluginContentViewer from './PluginContentViewer.vue';

const emit = defineEmits<{
  /** Emitted when user wants to open a snippet in the editor */
  openSnippet: [itemTitle: string];
}>();
const { t } = useI18n({ useScope: 'global' });
const $q = useQuasar();
const pluginStore = usePluginStore();

// Set of plugin IDs currently being updated
const updatingIds = ref<Set<string>>(new Set());

// Set of plugin IDs currently being uninstalled
const uninstallingIds = ref<Set<string>>(new Set());

// Whether we're currently updating all plugins
const isUpdatingAll = ref(false);

// Whether we're currently clearing all plugins
const isClearingAll = ref(false);

// Show clear all confirmation dialog
const showClearAllDialog = ref(false);

// Plugin being viewed (null = show list, plugin = show content viewer)
const viewingPlugin = ref<IPlugin | null>(null);

// Plugin pending uninstall confirmation
const pluginToUninstall = ref<IPlugin | null>(null);

// Show uninstall confirmation dialog
const showUninstallDialog = ref(false);

// Get installed plugins count
const installedCount = computed(() => pluginStore.installed.length);

// Get update info for a specific plugin
function getUpdateInfo(pluginId: string) {
  return pluginStore.updates.find((u) => u.pluginId === pluginId);
}

// Handle view plugin content
function handleView(plugin: IPlugin): void {
  viewingPlugin.value = plugin;
}

// Handle back from content viewer
function handleBack(): void {
  viewingPlugin.value = null;
}

// Handle open snippet from content viewer
function handleOpenSnippet(itemTitle: string): void {
  emit('openSnippet', itemTitle);
}

// Handle plugin update
async function handleUpdate(plugin: IPlugin): Promise<void> {
  if (updatingIds.value.has(plugin.id)) return;

  // Get the marketplace plugin for update
  const marketplacePlugin = pluginStore.getMarketplacePlugin(plugin.id);
  if (!marketplacePlugin) {
    $q.notify({
      type: 'negative',
      message: t('plugins.updateError') || 'Failed to update plugin',
      caption: 'Plugin not found in marketplace',
      icon: 'mdi-alert-circle',
      position: 'bottom-right',
    });
    return;
  }

  updatingIds.value.add(plugin.id);

  try {
    const success = await pluginStore.updatePlugin(marketplacePlugin);

    if (success) {
      $q.notify({
        type: 'positive',
        message: t('plugins.updateSuccess') || 'Plugin updated successfully',
        icon: 'mdi-check-circle',
        position: 'bottom-right',
      });
    } else {
      $q.notify({
        type: 'negative',
        message: t('plugins.updateError') || 'Failed to update plugin',
        caption: pluginStore.error ?? undefined,
        icon: 'mdi-alert-circle',
        position: 'bottom-right',
      });
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: t('plugins.updateError') || 'Failed to update plugin',
      caption: error instanceof Error ? error.message : undefined,
      icon: 'mdi-alert-circle',
      position: 'bottom-right',
    });
  } finally {
    updatingIds.value.delete(plugin.id);
  }
}

// Open uninstall confirmation dialog
function confirmUninstall(plugin: IPlugin): void {
  pluginToUninstall.value = plugin;
  showUninstallDialog.value = true;
}

// Handle plugin uninstall
async function handleUninstall(): Promise<void> {
  const plugin = pluginToUninstall.value;
  if (!plugin || uninstallingIds.value.has(plugin.id)) return;

  showUninstallDialog.value = false;
  uninstallingIds.value.add(plugin.id);

  try {
    const success = await pluginStore.uninstallPlugin(plugin.id);

    if (success) {
      $q.notify({
        type: 'positive',
        message: t('plugins.uninstallSuccess') || 'Plugin uninstalled successfully',
        icon: 'mdi-check-circle',
        position: 'bottom-right',
      });
    } else {
      $q.notify({
        type: 'negative',
        message: t('plugins.uninstallError') || 'Failed to uninstall plugin',
        caption: pluginStore.error ?? undefined,
        icon: 'mdi-alert-circle',
        position: 'bottom-right',
      });
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: t('plugins.uninstallError') || 'Failed to uninstall plugin',
      caption: error instanceof Error ? error.message : undefined,
      icon: 'mdi-alert-circle',
      position: 'bottom-right',
    });
  } finally {
    uninstallingIds.value.delete(plugin.id);
    pluginToUninstall.value = null;
  }
}

// Cancel uninstall
function cancelUninstall(): void {
  showUninstallDialog.value = false;
  pluginToUninstall.value = null;
}

// Clear all plugins (for troubleshooting corrupt data)
async function handleClearAll(): Promise<void> {
  if (isClearingAll.value) return;

  showClearAllDialog.value = false;
  isClearingAll.value = true;

  try {
    await pluginStore.clearAllPlugins();
    $q.notify({
      type: 'positive',
      message: t('plugins.clearAllSuccess') || 'All plugins cleared successfully',
      icon: 'mdi-check-circle',
      position: 'bottom-right',
    });
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: t('plugins.clearAllError') || 'Failed to clear plugins',
      caption: error instanceof Error ? error.message : undefined,
      icon: 'mdi-alert-circle',
      position: 'bottom-right',
    });
  } finally {
    isClearingAll.value = false;
  }
}

// Get display name - use name field if available, fallback to formatted ID
function getPluginDisplayName(plugin: IPlugin): string {
  if (plugin.name) {
    return plugin.name;
  }
  // Fallback: Convert ID like "development-personas" to "Development Personas"
  return plugin.id
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Update all plugins with available updates
async function updateAll(): Promise<void> {
  if (isUpdatingAll.value) return;

  const pluginsToUpdate = pluginStore.installed.filter((p) =>
    pluginStore.updates.some((u) => u.pluginId === p.id)
  );

  if (pluginsToUpdate.length === 0) return;

  isUpdatingAll.value = true;
  let successCount = 0;
  let failCount = 0;

  for (const plugin of pluginsToUpdate) {
    const marketplacePlugin = pluginStore.getMarketplacePlugin(plugin.id);
    if (!marketplacePlugin) {
      failCount++;
      continue;
    }

    updatingIds.value.add(plugin.id);

    try {
      const success = await pluginStore.updatePlugin(marketplacePlugin);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    } catch {
      failCount++;
    } finally {
      updatingIds.value.delete(plugin.id);
    }
  }

  isUpdatingAll.value = false;

  // Show summary notification
  if (successCount > 0 && failCount === 0) {
    $q.notify({
      type: 'positive',
      message: `${successCount} plugin(s) updated successfully`,
      icon: 'mdi-check-circle',
      position: 'bottom-right',
    });
  } else if (successCount > 0 && failCount > 0) {
    $q.notify({
      type: 'warning',
      message: `${successCount} updated, ${failCount} failed`,
      icon: 'mdi-alert',
      position: 'bottom-right',
    });
  } else if (failCount > 0) {
    $q.notify({
      type: 'negative',
      message: `Failed to update ${failCount} plugin(s)`,
      icon: 'mdi-alert-circle',
      position: 'bottom-right',
    });
  }
}
</script>

<template>
  <div class="plugins-installed">
    <!-- Content Viewer Mode -->
    <PluginContentViewer
      v-if="viewingPlugin"
      :plugin="viewingPlugin"
      is-installed
      @back="handleBack"
      @open-snippet="handleOpenSnippet"
    />

    <!-- List Mode -->
    <template v-else>
      <!-- Empty state -->
      <div
        v-if="installedCount === 0"
        class="plugins-installed__empty"
      >
        <q-icon
          name="mdi-puzzle-outline"
          size="64px"
          color="grey-5"
        />
        <div class="text-h6 text-grey-6 q-mt-md">
          {{ t('plugins.noPluginsInstalled') || 'No plugins installed' }}
        </div>
        <div class="text-body2 text-grey-7 q-mt-sm">
          {{
            t('plugins.noPluginsInstalledHint') ||
            'Visit the Marketplace to discover and install plugins'
          }}
        </div>
      </div>

      <!-- Installed plugins list -->
      <template v-else>
        <!-- Header with update all button -->
        <div
          v-if="pluginStore.hasUpdates"
          class="plugins-installed__header"
        >
          <div class="row items-center justify-between">
            <div class="text-body2 text-orange">
              <q-icon
                name="mdi-update"
                size="18px"
                class="q-mr-xs"
              />
              {{ pluginStore.updateCount }}
              {{ t('plugins.updatesAvailable') || 'updates available' }}
            </div>
            <q-btn
              color="orange"
              text-color="white"
              :label="t('plugins.updateAll') || 'Update All'"
              no-caps
              unelevated
              size="sm"
              icon="mdi-update"
              :loading="isUpdatingAll"
              :disable="isUpdatingAll"
              @click="updateAll"
            />
          </div>
        </div>

        <!-- Plugin list -->
        <div class="plugins-installed__list">
          <InstalledPluginCard
            v-for="plugin in pluginStore.installed"
            :key="plugin.id"
            :plugin="plugin"
            :update-info="getUpdateInfo(plugin.id)"
            :updating="updatingIds.has(plugin.id)"
            :uninstalling="uninstallingIds.has(plugin.id)"
            @update="handleUpdate"
            @uninstall="confirmUninstall"
            @view="handleView"
          />
        </div>

        <!-- Footer with refresh and clear all -->
        <div class="plugins-installed__footer">
          <q-btn
            flat
            dense
            no-caps
            color="grey"
            icon="mdi-refresh"
            :label="t('common.refresh') || 'Refresh'"
            :loading="pluginStore.isLoading"
            @click="pluginStore.refreshInstalled()"
          />
          <q-btn
            flat
            dense
            no-caps
            color="negative"
            icon="mdi-delete-sweep"
            :label="t('plugins.clearAll') || 'Clear All'"
            :loading="isClearingAll"
            @click="showClearAllDialog = true"
          >
            <q-tooltip>{{
              t('plugins.clearAllTooltip') || 'Remove all installed plugins (for troubleshooting)'
            }}</q-tooltip>
          </q-btn>
        </div>
      </template>
    </template>

    <!-- Uninstall confirmation dialog -->
    <q-dialog
      v-model="showUninstallDialog"
      persistent
      class="uninstall-dialog-wrapper"
    >
      <q-card class="plugins-installed__dialog">
        <q-card-section class="row items-center">
          <q-icon
            name="mdi-alert-circle"
            color="negative"
            size="32px"
            class="q-mr-md"
          />
          <div>
            <div class="text-h6">
              {{ t('plugins.uninstallTitle') || 'Uninstall Plugin' }}
            </div>
            <div class="text-body2 text-grey">
              {{
                t('plugins.uninstallMessage', {
                  name: pluginToUninstall ? getPluginDisplayName(pluginToUninstall) : '',
                }) ||
                `Are you sure you want to uninstall "${pluginToUninstall ? getPluginDisplayName(pluginToUninstall) : ''}"?`
              }}
            </div>
          </div>
        </q-card-section>

        <q-card-section class="text-body2 text-grey-7">
          {{
            t('plugins.uninstallWarning') || 'This will remove all items provided by this plugin.'
          }}
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            flat
            :label="t('common.cancel') || 'Cancel'"
            color="grey"
            @click="cancelUninstall"
          />
          <q-btn
            flat
            :label="t('plugins.uninstall') || 'Uninstall'"
            color="negative"
            @click="handleUninstall"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Clear All confirmation dialog -->
    <q-dialog
      v-model="showClearAllDialog"
      persistent
      class="uninstall-dialog-wrapper"
    >
      <q-card class="plugins-installed__dialog">
        <q-card-section class="row items-center">
          <q-icon
            name="mdi-delete-sweep"
            color="negative"
            size="32px"
            class="q-mr-md"
          />
          <div>
            <div class="text-h6">
              {{ t('plugins.clearAllTitle') || 'Clear All Plugins' }}
            </div>
            <div class="text-body2 text-grey">
              {{
                t('plugins.clearAllMessage') ||
                'Are you sure you want to remove all installed plugins?'
              }}
            </div>
          </div>
        </q-card-section>

        <q-card-section class="text-body2 text-grey-7">
          {{
            t('plugins.clearAllWarning') ||
            'This will remove all plugin metadata from storage. Use this to fix corrupt data.'
          }}
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            flat
            :label="t('common.cancel') || 'Cancel'"
            color="grey"
            @click="showClearAllDialog = false"
          />
          <q-btn
            flat
            :label="t('plugins.clearAll') || 'Clear All'"
            color="negative"
            @click="handleClearAll"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<style lang="scss" scoped>
.plugins-installed {
  height: 100%;
  display: flex;
  flex-direction: column;

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 16px;
    text-align: center;
    flex: 1;
  }

  &__header {
    padding: 12px 16px;
    background-color: var(--header-bg, rgba(255, 152, 0, 0.1));
    border-bottom: 1px solid var(--border-color, #e0e0e0);
  }

  &__list {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__footer {
    display: flex;
    justify-content: space-between;
    padding: 8px 16px;
    border-top: 1px solid var(--border-color, #e0e0e0);
  }

  &__dialog {
    min-width: 350px;
  }
}

.body--light .plugins-installed {
  --header-bg: rgba(255, 152, 0, 0.1);
  --border-color: #e0e0e0;
}

.body--dark .plugins-installed {
  --header-bg: rgba(255, 152, 0, 0.15);
  --border-color: #3c3c3c;
}
</style>

<style lang="scss">
// Global styles for uninstall dialog (must be non-scoped to affect Quasar's dialog container)
.uninstall-dialog-wrapper {
  z-index: 10000 !important;

  .q-dialog__backdrop {
    z-index: 9999 !important;
  }

  .q-dialog__inner {
    z-index: 10000 !important;
  }
}
</style>
