<script setup lang="ts">
/**
 * Sidebar Component
 *
 * Displays content based on the active activity bar selection.
 * Contains panels for Explorer, Search, Snippets, Git, AI, and Settings.
 */

import { computed } from 'vue';
import { useUIStore } from '@/stores/uiStore';
import { useI18n } from 'vue-i18n';

// Sub-components for each view
import ExplorerPanel from './sidebar/ExplorerPanel.vue';
import SearchPanel from './sidebar/SearchPanel.vue';
import SnippetsPanel from './sidebar/SnippetsPanel.vue';
import FavoritesPanel from './sidebar/FavoritesPanel.vue';
import GitPanel from './sidebar/GitPanel.vue';
import SettingsPanel from './sidebar/SettingsPanel.vue';

const { t } = useI18n({ useScope: 'global' });
const uiStore = useUIStore();

const activeActivity = computed(() => uiStore.activeActivity);

const currentTitle = computed(() => {
  const titles: Record<string, string> = {
    explorer: t('sidebar.explorer'),
    search: t('sidebar.search'),
    snippets: t('sidebar.snippets'),
    favorites: t('sidebar.favorites'),
    git: t('sidebar.sourceControl'),
    settings: t('sidebar.settings'),
  };
  return titles[activeActivity.value] ?? t('common.loading');
});
</script>

<template>
  <div
    class="sidebar"
    data-testid="sidebar"
  >
    <div
      class="sidebar__header"
      data-testid="sidebar-header"
    >
      <span class="sidebar__title">{{ currentTitle }}</span>
    </div>

    <div class="sidebar__content">
      <ExplorerPanel v-if="activeActivity === 'explorer'" />
      <SearchPanel v-else-if="activeActivity === 'search'" />
      <SnippetsPanel v-else-if="activeActivity === 'snippets'" />
      <FavoritesPanel v-else-if="activeActivity === 'favorites'" />
      <GitPanel v-else-if="activeActivity === 'git'" />
      <SettingsPanel v-else-if="activeActivity === 'settings'" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0; // Allow shrinking in flex/grid contexts
  background-color: var(--sidebar-bg, #252526);
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 35px;
    min-height: 35px;
    flex-shrink: 0;
    padding: 0 8px 0 20px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--sidebar-title-color, #bbbbbb);
    background-color: var(--sidebar-header-bg, #252526);
    border-bottom: 1px solid var(--border-color, #1e1e1e);
  }

  &__title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__content {
    flex: 1;
    min-height: 0; // Allow content to shrink
    overflow: hidden;
  }
}

// Light theme overrides
.body--light .sidebar {
  --sidebar-bg: #f3f3f3;
  --sidebar-header-bg: #f3f3f3;
  --sidebar-title-color: #6f6f6f;
  --border-color: #e7e7e7;
}

// Dark theme overrides
.body--dark .sidebar {
  --sidebar-bg: #252526;
  --sidebar-header-bg: #252526;
  --sidebar-title-color: #bbbbbb;
  --border-color: #1e1e1e;
}
</style>
