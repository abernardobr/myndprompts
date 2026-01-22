<script setup lang="ts">
/**
 * PluginsSection Component
 *
 * Main plugins section with Marketplace and Installed tabs.
 * Manages plugin discovery, installation, updates, and uninstallation.
 */

import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePluginStore } from '@/stores/pluginStore';
import PluginsMarketplace from './PluginsMarketplace.vue';
import PluginsInstalled from './PluginsInstalled.vue';

const emit = defineEmits<{
  /** Emitted when user wants to open a snippet in the editor */
  openSnippet: [itemTitle: string];
}>();

const { t } = useI18n({ useScope: 'global' });
const pluginStore = usePluginStore();

// Forward open snippet event
function handleOpenSnippet(itemTitle: string): void {
  emit('openSnippet', itemTitle);
}

// Active tab state
const activeTab = ref('marketplace');

// Initialize store when component mounts
onMounted(async () => {
  console.log('[PluginsSection] Component mounted, isInitialized:', pluginStore.isInitialized);
  if (!pluginStore.isInitialized) {
    console.log('[PluginsSection] Calling pluginStore.initialize()...');
    await pluginStore.initialize();
    console.log('[PluginsSection] Initialize complete');
  }
});

// Retry initialization after error
async function retryInitialize(): Promise<void> {
  pluginStore.clearError();
  await pluginStore.initialize();
}
</script>

<template>
  <div class="plugins-section">
    <!-- Loading state during initial load -->
    <div
      v-if="pluginStore.isLoading && !pluginStore.isInitialized"
      class="plugins-section__loading"
    >
      <q-spinner
        color="primary"
        size="48px"
      />
      <div class="q-mt-md text-grey">
        {{ t('plugins.loadingPlugins') || 'Loading plugins...' }}
      </div>
    </div>

    <!-- Error state during initial load -->
    <div
      v-else-if="pluginStore.error && !pluginStore.isInitialized"
      class="plugins-section__error"
    >
      <q-icon
        name="mdi-alert-circle-outline"
        size="64px"
        color="negative"
      />
      <div class="q-mt-md text-negative text-h6">
        {{
          pluginStore.isOffline
            ? t('plugins.offline') || 'You appear to be offline. Please check your connection.'
            : t('plugins.fetchError') || 'Failed to load plugins. Please try again.'
        }}
      </div>
      <q-btn
        color="primary"
        icon="mdi-refresh"
        :label="t('common.retry') || 'Retry'"
        class="q-mt-lg"
        @click="retryInitialize"
      />
    </div>

    <!-- Main content with tabs -->
    <template v-else>
      <!-- Tab Navigation -->
      <q-tabs
        v-model="activeTab"
        dense
        class="plugins-section__tabs text-grey"
        active-color="primary"
        indicator-color="primary"
        align="left"
        narrow-indicator
      >
        <q-tab
          name="marketplace"
          no-caps
        >
          <div class="row items-center no-wrap q-gutter-x-sm">
            <q-icon
              name="mdi-store"
              size="18px"
            />
            <span>{{ t('plugins.marketplace') || 'Marketplace' }}</span>
            <q-badge
              v-if="pluginStore.availablePlugins.length > 0"
              color="grey-7"
              text-color="white"
              :label="pluginStore.availablePlugins.length"
            />
          </div>
        </q-tab>

        <q-tab
          name="installed"
          no-caps
        >
          <div class="row items-center no-wrap q-gutter-x-sm">
            <q-icon
              name="mdi-puzzle-check"
              size="18px"
            />
            <span>{{ t('plugins.installed') || 'Installed' }}</span>
            <q-badge
              v-if="pluginStore.installed.length > 0"
              color="primary"
              :label="pluginStore.installed.length"
            />
            <q-badge
              v-if="pluginStore.hasUpdates"
              color="orange"
              :label="pluginStore.updateCount"
            >
              <q-tooltip>
                {{ t('plugins.updatesAvailable') || 'Updates available' }}
              </q-tooltip>
            </q-badge>
          </div>
        </q-tab>
      </q-tabs>

      <q-separator />

      <!-- Tab Panels -->
      <q-tab-panels
        v-model="activeTab"
        animated
        class="plugins-section__panels"
      >
        <q-tab-panel
          name="marketplace"
          class="q-pa-none"
        >
          <PluginsMarketplace />
        </q-tab-panel>

        <q-tab-panel
          name="installed"
          class="q-pa-none"
        >
          <PluginsInstalled @open-snippet="handleOpenSnippet" />
        </q-tab-panel>
      </q-tab-panels>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.plugins-section {
  height: 100%;
  display: flex;
  flex-direction: column;

  &__loading,
  &__error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 16px;
    text-align: center;
    flex: 1;
  }

  &__tabs {
    flex-shrink: 0;
  }

  &__panels {
    flex: 1;
    overflow: hidden;
    background-color: transparent;

    :deep(.q-tab-panel) {
      height: 100%;
      padding: 0;
    }
  }
}
</style>
