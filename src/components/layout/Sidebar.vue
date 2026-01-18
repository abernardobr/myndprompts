<script setup lang="ts">
/**
 * Sidebar Component
 *
 * Displays content based on the active activity bar selection.
 * Contains panels for Explorer, Search, Snippets, Git, AI, and Settings.
 */

import { computed } from 'vue';
import { useUIStore } from '@/stores/uiStore';
import { useAppStore } from '@/stores/appStore';
import { useI18n } from 'vue-i18n';

// Sub-components for each view (placeholders for now)
import ExplorerPanel from './sidebar/ExplorerPanel.vue';
import SearchPanel from './sidebar/SearchPanel.vue';
import SnippetsPanel from './sidebar/SnippetsPanel.vue';
import GitPanel from './sidebar/GitPanel.vue';
import AIPanel from './sidebar/AIPanel.vue';
import SettingsPanel from './sidebar/SettingsPanel.vue';

const { t: _t } = useI18n();
const uiStore = useUIStore();
const appStore = useAppStore();

// Platform detection for macOS traffic lights
const isMac = computed(() => appStore.isMac);

const activeActivity = computed(() => uiStore.activeActivity);

const panelTitles: Record<string, string> = {
  explorer: 'Explorer',
  search: 'Search',
  snippets: 'Snippets',
  git: 'Source Control',
  ai: 'AI Assistant',
  settings: 'Settings',
};

const currentTitle = computed(() => panelTitles[activeActivity.value] ?? 'Panel');
</script>

<template>
  <div
    class="sidebar"
    :class="{ 'sidebar--macos': isMac }"
  >
    <!-- macOS traffic light spacer -->
    <div
      v-if="isMac"
      class="sidebar__titlebar-spacer"
    />
    <div class="sidebar__header">
      <span class="sidebar__title">{{ currentTitle }}</span>
    </div>

    <div class="sidebar__content">
      <ExplorerPanel v-if="activeActivity === 'explorer'" />
      <SearchPanel v-else-if="activeActivity === 'search'" />
      <SnippetsPanel v-else-if="activeActivity === 'snippets'" />
      <GitPanel v-else-if="activeActivity === 'git'" />
      <AIPanel v-else-if="activeActivity === 'ai'" />
      <SettingsPanel v-else-if="activeActivity === 'settings'" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--sidebar-bg, #252526);

  // macOS traffic light spacer
  &__titlebar-spacer {
    height: 28px;
    min-height: 28px;
    flex-shrink: 0;
    -webkit-app-region: drag;
    background-color: var(--sidebar-header-bg, #252526);
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 35px;
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
