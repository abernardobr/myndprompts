<script setup lang="ts">
/**
 * StatusBar Component
 *
 * Bottom status bar showing file info, cursor position, encoding, etc.
 * Similar to VSCode's status bar.
 */

import { computed, ref, onMounted } from 'vue';
import { useUIStore } from '@/stores/uiStore';
import { useFileSyncStore } from '@/stores/fileSyncStore';
import { useProjectStore } from '@/stores/projectStore';
import { useTheme } from '@/composables/useTheme';
import { useI18n } from 'vue-i18n';
import FileSyncDialog from '@/components/dialogs/FileSyncDialog.vue';

const { t } = useI18n({ useScope: 'global' });
const uiStore = useUIStore();
const fileSyncStore = useFileSyncStore();
const projectStore = useProjectStore();
const { isDark, themeMode, toggleTheme } = useTheme();

// File Sync Dialog state
const showFileSyncDialog = ref(false);

// Get current project based on active tab
const currentProject = computed(() => {
  const activeTab = uiStore.activeTab;
  if (activeTab?.filePath === undefined || activeTab.filePath === '') return null;
  return projectStore.getProjectForPath(activeTab.filePath);
});

const currentProjectPath = computed(() => currentProject.value?.folderPath ?? '');

const activeTab = computed(() => uiStore.activeTab);

// Check if running in Electron
const isElectron = computed((): boolean => window?.fileSystemAPI !== undefined);

// File Sync status
const fileSyncStatus = computed(() => fileSyncStore.syncStatus);
const hasActiveIndexing = computed(() => fileSyncStore.hasActiveIndexing);
const currentOperation = computed(() => fileSyncStore.currentOperation);

// Initialize stores on mount
onMounted(async () => {
  if (isElectron.value && !fileSyncStore.isInitialized) {
    await fileSyncStore.initialize();
  }
  if (!projectStore.isInitialized) {
    await projectStore.initialize();
  }
});

function openFileSyncDialog(): void {
  showFileSyncDialog.value = true;
}
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

async function cancelFileIndexing(): Promise<void> {
  await fileSyncStore.cancelAllIndexing();
}
</script>

<template>
  <div
    class="status-bar"
    data-testid="status-bar"
  >
    <!-- Left side -->
    <div class="status-bar__left">
      <!-- Git branch (placeholder) -->
      <div
        class="status-bar__item status-bar__item--clickable"
        data-testid="git-branch"
      >
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
        data-testid="cursor-position"
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
        data-testid="current-language"
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

      <!-- File Sync Status -->
      <div
        v-if="isElectron"
        class="status-bar__sync"
      >
        <!-- Up to date -->
        <div
          v-if="fileSyncStatus.isUpToDate && !hasActiveIndexing"
          class="status-bar__sync-status status-bar__sync-status--clickable"
          @click="openFileSyncDialog"
        >
          <q-icon
            name="cloud_done"
            size="14px"
            class="text-positive"
          />
          <q-tooltip>{{ t('fileSync.upToDate') }}</q-tooltip>
        </div>

        <!-- Indexing in progress -->
        <div
          v-else-if="hasActiveIndexing"
          class="status-bar__sync-progress"
        >
          <q-spinner-ios
            size="12px"
            color="white"
          />
          <span class="status-bar__sync-text">
            {{ t('fileSync.indexing') }}
            <template
              v-if="currentOperation?.current !== undefined && currentOperation.current > 0"
            >
              ({{ currentOperation.current }})
            </template>
          </span>
          <q-btn
            flat
            dense
            round
            size="xs"
            icon="close"
            class="status-bar__sync-cancel"
            @click="cancelFileIndexing"
          >
            <q-tooltip>{{ t('fileSync.cancelIndexing') }}</q-tooltip>
          </q-btn>
        </div>

        <!-- Has errors -->
        <div
          v-else-if="fileSyncStatus.errors > 0"
          class="status-bar__sync-status status-bar__sync-status--clickable"
          @click="openFileSyncDialog"
        >
          <q-icon
            name="cloud_off"
            size="14px"
            class="text-negative"
          />
          <span class="status-bar__sync-error-count">{{ fileSyncStatus.errors }}</span>
          <q-tooltip>{{ t('fileSync.hasErrors', { count: fileSyncStatus.errors }) }}</q-tooltip>
        </div>

        <!-- Needs sync (pending folders) -->
        <div
          v-else-if="fileSyncStatus.pending > 0"
          class="status-bar__sync-status status-bar__sync-status--clickable"
          @click="openFileSyncDialog"
        >
          <q-icon
            name="cloud_sync"
            size="14px"
            class="text-warning"
          />
          <q-tooltip>{{ t('fileSync.needsSync') }}</q-tooltip>
        </div>
      </div>

      <!-- File Sync Dialog -->
      <FileSyncDialog
        v-model="showFileSyncDialog"
        :project-path="currentProjectPath"
      />

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

  &__sync {
    display: flex;
    align-items: center;
    padding: 0 8px;
  }

  &__sync-status {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: default;

    &--clickable {
      cursor: pointer;
      padding: 0 4px;
      border-radius: 2px;

      &:hover {
        background-color: var(--statusbar-hover-bg, rgba(255, 255, 255, 0.12));
      }
    }
  }

  &__sync-error-count {
    font-size: 11px;
    color: var(--statusbar-error, #ff6b6b);
  }

  &__sync-progress {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__sync-text {
    font-size: 11px;
    color: var(--statusbar-text, #ffffff);
  }

  &__sync-cancel {
    margin-left: 4px;
    opacity: 0.7;
    color: var(--statusbar-text, #ffffff);

    &:hover {
      opacity: 1;
    }
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
