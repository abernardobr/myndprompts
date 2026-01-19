<script setup lang="ts">
/**
 * BottomPanel Component
 *
 * Collapsible bottom panel with tabs for Output, Problems, Git Changes, and AI Chat.
 * Similar to VSCode's integrated terminal/panel area.
 */

import { computed } from 'vue';
import { useUIStore, type PanelTab } from '@/stores/uiStore';
import { useI18n } from 'vue-i18n';

const { t: _t } = useI18n({ useScope: 'global' });
const uiStore = useUIStore();

const activePanel = computed(() => uiStore.activePanel);
const panelCollapsed = computed(() => uiStore.panelCollapsed);

interface PanelTabItem {
  id: PanelTab;
  label: string;
  icon: string;
  badge?: number;
}

const panelTabs: PanelTabItem[] = [
  { id: 'output', label: 'Output', icon: 'terminal' },
  { id: 'problems', label: 'Problems', icon: 'error_outline', badge: 0 },
  { id: 'gitChanges', label: 'Git Changes', icon: 'git' },
  { id: 'aiChat', label: 'AI Chat', icon: 'smart_toy' },
];

function selectTab(tabId: PanelTab): void {
  uiStore.setActivePanel(tabId);
}

function _togglePanel(): void {
  uiStore.togglePanel();
}

function closePanel(): void {
  uiStore.setPanelCollapsed(true);
}

function _maximizePanel(): void {
  // Placeholder for maximize functionality
  // console.log('Maximize panel');
}
</script>

<template>
  <div
    v-if="!panelCollapsed"
    class="bottom-panel"
  >
    <!-- Panel header with tabs -->
    <div class="bottom-panel__header">
      <div class="bottom-panel__tabs">
        <button
          v-for="tab in panelTabs"
          :key="tab.id"
          :class="['bottom-panel__tab', { 'bottom-panel__tab--active': activePanel === tab.id }]"
          @click="selectTab(tab.id)"
        >
          <q-icon
            :name="tab.icon"
            size="14px"
          />
          <span>{{ tab.label }}</span>
          <q-badge
            v-if="tab.badge && tab.badge > 0"
            :label="tab.badge"
            color="negative"
            class="bottom-panel__badge"
          />
        </button>
      </div>

      <div class="bottom-panel__actions">
        <q-btn
          flat
          dense
          round
          size="sm"
          icon="open_in_full"
          @click="maximizePanel"
        >
          <q-tooltip>Maximize Panel</q-tooltip>
        </q-btn>
        <q-btn
          flat
          dense
          round
          size="sm"
          icon="close"
          @click="closePanel"
        >
          <q-tooltip>Close Panel</q-tooltip>
        </q-btn>
      </div>
    </div>

    <!-- Panel content -->
    <div class="bottom-panel__content">
      <!-- Output tab -->
      <div
        v-if="activePanel === 'output'"
        class="bottom-panel__pane"
      >
        <div class="bottom-panel__empty">
          <q-icon
            name="terminal"
            size="32px"
            class="text-grey-6 q-mb-sm"
          />
          <p class="text-grey-6 text-caption">No output to display</p>
        </div>
      </div>

      <!-- Problems tab -->
      <div
        v-else-if="activePanel === 'problems'"
        class="bottom-panel__pane"
      >
        <div class="bottom-panel__empty">
          <q-icon
            name="check_circle"
            size="32px"
            class="text-green q-mb-sm"
          />
          <p class="text-grey-6 text-caption">No problems detected</p>
        </div>
      </div>

      <!-- Git Changes tab -->
      <div
        v-else-if="activePanel === 'gitChanges'"
        class="bottom-panel__pane"
      >
        <div class="bottom-panel__empty">
          <q-icon
            name="git"
            size="32px"
            class="text-grey-6 q-mb-sm"
          />
          <p class="text-grey-6 text-caption">Git integration coming soon</p>
        </div>
      </div>

      <!-- AI Chat tab -->
      <div
        v-else-if="activePanel === 'aiChat'"
        class="bottom-panel__pane"
      >
        <div class="bottom-panel__empty">
          <q-icon
            name="smart_toy"
            size="32px"
            class="text-grey-6 q-mb-sm"
          />
          <p class="text-grey-6 text-caption">AI Chat will be available in Task 12</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.bottom-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--panel-bg, #1e1e1e);
  border-top: 1px solid var(--border-color, #3c3c3c);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 35px;
    padding: 0 8px;
    background-color: var(--header-bg, #252526);
    border-bottom: 1px solid var(--border-color, #3c3c3c);
  }

  &__tabs {
    display: flex;
    gap: 2px;
  }

  &__tab {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 12px;
    font-size: 12px;
    color: var(--tab-text, #969696);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      color: var(--tab-hover-text, #cccccc);
      background-color: var(--tab-hover-bg, rgba(255, 255, 255, 0.05));
    }

    &--active {
      color: var(--tab-active-text, #ffffff);
      border-bottom-color: var(--tab-active-border, #007acc);
    }
  }

  &__badge {
    font-size: 9px;
    min-height: 14px;
    padding: 0 4px;
  }

  &__actions {
    display: flex;
    gap: 2px;
  }

  &__content {
    flex: 1;
    overflow: hidden;
  }

  &__pane {
    height: 100%;
    overflow: auto;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 24px;
    text-align: center;

    p {
      margin: 0;
    }
  }
}

// Light theme
.body--light .bottom-panel {
  --panel-bg: #f3f3f3;
  --header-bg: #f3f3f3;
  --border-color: #e7e7e7;
  --tab-text: #5f6a79;
  --tab-hover-text: #3b3b3b;
  --tab-hover-bg: rgba(0, 0, 0, 0.05);
  --tab-active-text: #333333;
  --tab-active-border: #007acc;
}

// Dark theme
.body--dark .bottom-panel {
  --panel-bg: #1e1e1e;
  --header-bg: #252526;
  --border-color: #3c3c3c;
  --tab-text: #969696;
  --tab-hover-text: #cccccc;
  --tab-hover-bg: rgba(255, 255, 255, 0.05);
  --tab-active-text: #ffffff;
  --tab-active-border: #007acc;
}
</style>
