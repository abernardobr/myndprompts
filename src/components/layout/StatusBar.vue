<script setup lang="ts">
/**
 * StatusBar Component
 *
 * Bottom status bar showing file info, cursor position, encoding, etc.
 * Similar to VSCode's status bar.
 */

import { computed, ref } from 'vue';
import { useUIStore } from '@/stores/uiStore';
import { useTheme } from '@/composables/useTheme';
import { useI18n } from 'vue-i18n';

const { t: _t } = useI18n();
const uiStore = useUIStore();
const { isDark, themeMode, toggleTheme } = useTheme();

const activeTab = computed(() => uiStore.activeTab);
const panelCollapsed = computed(() => uiStore.panelCollapsed);

// Status items (will be dynamic based on active file)
const cursorPosition = ref({ line: 1, column: 1 });
const encoding = ref('UTF-8');
const lineEnding = ref('LF');
const fileType = ref('Markdown');

// Notification/sync status
const syncStatus = ref<'synced' | 'syncing' | 'error'>('synced');
const notificationCount = ref(0);

// Theme icon based on current mode
const themeIcon = computed(() => {
  if (themeMode.value === 'system') return 'mdi-laptop';
  return isDark.value ? 'mdi-moon-waning-crescent' : 'mdi-white-balance-sunny';
});

const themeLabel = computed(() => {
  switch (themeMode.value) {
    case 'light':
      return 'Light';
    case 'dark':
      return 'Dark';
    case 'system':
      return 'System';
    default:
      return 'Theme';
  }
});

function togglePanel(): void {
  uiStore.togglePanel();
}

function _showNotifications(): void {
  // Placeholder for notifications panel
  // console.log('Show notifications');
}
</script>

<template>
  <div class="status-bar">
    <!-- Left side -->
    <div class="status-bar__left">
      <!-- Git branch (placeholder) -->
      <div class="status-bar__item status-bar__item--clickable">
        <q-icon
          name="git"
          size="14px"
        />
        <span>main</span>
        <q-tooltip>Current Branch</q-tooltip>
      </div>

      <!-- Sync status -->
      <div
        :class="[
          'status-bar__item',
          'status-bar__item--clickable',
          `status-bar__item--${syncStatus}`,
        ]"
      >
        <q-icon
          :name="
            syncStatus === 'syncing'
              ? 'sync'
              : syncStatus === 'error'
                ? 'sync_problem'
                : 'cloud_done'
          "
          size="14px"
          :class="{ 'animate-spin': syncStatus === 'syncing' }"
        />
        <q-tooltip>
          {{
            syncStatus === 'synced'
              ? 'All changes saved'
              : syncStatus === 'syncing'
                ? 'Syncing...'
                : 'Sync error'
          }}
        </q-tooltip>
      </div>

      <!-- Problems/Errors -->
      <div
        class="status-bar__item status-bar__item--clickable"
        @click="togglePanel"
      >
        <q-icon
          name="error_outline"
          size="14px"
        />
        <span>0</span>
        <q-icon
          name="warning_amber"
          size="14px"
          class="q-ml-xs"
        />
        <span>0</span>
        <q-tooltip>Errors and Warnings</q-tooltip>
      </div>
    </div>

    <!-- Right side -->
    <div class="status-bar__right">
      <!-- Cursor position -->
      <div
        v-if="activeTab"
        class="status-bar__item status-bar__item--clickable"
      >
        <span>Ln {{ cursorPosition.line }}, Col {{ cursorPosition.column }}</span>
        <q-tooltip>Go to Line</q-tooltip>
      </div>

      <!-- Encoding -->
      <div
        v-if="activeTab"
        class="status-bar__item status-bar__item--clickable"
      >
        <span>{{ encoding }}</span>
        <q-tooltip>Select Encoding</q-tooltip>
      </div>

      <!-- Line ending -->
      <div
        v-if="activeTab"
        class="status-bar__item status-bar__item--clickable"
      >
        <span>{{ lineEnding }}</span>
        <q-tooltip>Select End of Line Sequence</q-tooltip>
      </div>

      <!-- File type -->
      <div
        v-if="activeTab"
        class="status-bar__item status-bar__item--clickable"
      >
        <span>{{ fileType }}</span>
        <q-tooltip>Select Language Mode</q-tooltip>
      </div>

      <!-- Theme toggle -->
      <div
        class="status-bar__item status-bar__item--clickable"
        @click="toggleTheme"
      >
        <q-icon
          :name="themeIcon"
          size="14px"
        />
        <q-tooltip>
          Theme: {{ themeLabel }}
          <br />
          <span class="text-caption">Ctrl+Shift+T to toggle</span>
        </q-tooltip>
      </div>

      <!-- Notifications -->
      <div
        class="status-bar__item status-bar__item--clickable"
        @click="showNotifications"
      >
        <q-icon
          :name="notificationCount > 0 ? 'notifications_active' : 'notifications_none'"
          size="14px"
        />
        <q-badge
          v-if="notificationCount > 0"
          :label="notificationCount"
          color="primary"
          class="status-bar__notification-badge"
        />
        <q-tooltip>Notifications</q-tooltip>
      </div>

      <!-- Panel toggle -->
      <div
        class="status-bar__item status-bar__item--clickable"
        @click="togglePanel"
      >
        <q-icon
          :name="panelCollapsed ? 'expand_less' : 'expand_more'"
          size="14px"
        />
        <q-tooltip>{{ panelCollapsed ? 'Show Panel' : 'Hide Panel' }}</q-tooltip>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 22px;
  padding: 0 8px;
  font-size: 12px;
  background-color: var(--statusbar-bg, #007acc);
  color: var(--statusbar-text, #ffffff);

  &__left,
  &__right {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 6px;
    height: 22px;
    white-space: nowrap;

    &--clickable {
      cursor: pointer;

      &:hover {
        background-color: var(--statusbar-hover-bg, rgba(255, 255, 255, 0.12));
      }
    }

    &--synced {
      color: var(--statusbar-text, #ffffff);
    }

    &--syncing {
      color: var(--statusbar-warning, #ffcc00);
    }

    &--error {
      color: var(--statusbar-error, #ff6b6b);
    }
  }

  &__notification-badge {
    font-size: 9px;
    min-height: 14px;
    padding: 0 4px;
    margin-left: -2px;
  }
}

// Animation for sync icon
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

// Light theme - uses different status bar color
.body--light .status-bar {
  --statusbar-bg: #007acc;
  --statusbar-text: #ffffff;
  --statusbar-hover-bg: rgba(255, 255, 255, 0.12);
  --statusbar-warning: #ffcc00;
  --statusbar-error: #ff6b6b;
}

// Dark theme
.body--dark .status-bar {
  --statusbar-bg: #007acc;
  --statusbar-text: #ffffff;
  --statusbar-hover-bg: rgba(255, 255, 255, 0.12);
  --statusbar-warning: #ffcc00;
  --statusbar-error: #ff6b6b;
}
</style>
