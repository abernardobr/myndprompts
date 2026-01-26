<script setup lang="ts">
/**
 * StorageSection Component
 *
 * Settings section for managing storage - displays storage location
 * and provides export/import functionality with progress tracking.
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { usePromptStore } from '@/stores/promptStore';
import { useSnippetStore } from '@/stores/snippetStore';
import { useUIStore } from '@/stores/uiStore';
import type {
  IExportProgress,
  IImportProgress,
  ExportImportErrorCode,
} from '@/services/export-import/types';
import MoveStorageDialog from '@/components/dialogs/MoveStorageDialog.vue';

const { t } = useI18n({ useScope: 'global' });
const $q = useQuasar();
const promptStore = usePromptStore();
const snippetStore = useSnippetStore();
const uiStore = useUIStore();

// Check if running in Electron
const isElectron = computed((): boolean => window?.fileSystemAPI !== undefined);

// Storage path (display version with ~ for home dir)
const storagePath = ref('~/.myndprompt');
// Full storage path for file operations
const fullStoragePath = ref('');

// Loading states
const isExporting = ref(false);
const isImporting = ref(false);

// Move storage dialog
const showMoveDialog = ref(false);

// Progress tracking
const progress = ref<IExportProgress | IImportProgress | null>(null);
let unsubscribeProgress: (() => void) | null = null;

// Computed progress percentage
const progressPercent = computed((): number => {
  if (!progress.value || progress.value.total === 0) return 0;
  return progress.value.current / progress.value.total;
});

// Computed progress label
const progressLabel = computed((): string => {
  if (!progress.value) return '';
  const phaseKey = `settings.storage.progress.${progress.value.phase}`;
  return t(phaseKey);
});

/**
 * Get a localized error message from an error code or raw message
 */
function getLocalizedErrorMessage(errorCode?: ExportImportErrorCode, rawMessage?: string): string {
  // If we have an error code, try to get the localized message
  if (errorCode) {
    const localizedKey = `settings.storage.errors.${errorCode}`;
    const localized = t(localizedKey);
    // Check if translation exists (not the key itself)
    if (localized !== localizedKey) {
      return localized;
    }
  }

  // Fall back to raw message if provided
  if (rawMessage) {
    // Try to extract a user-friendly message from common error patterns
    if (rawMessage.includes('EACCES') || rawMessage.includes('EPERM')) {
      return t('settings.storage.errors.PERMISSION_DENIED');
    }
    if (rawMessage.includes('ENOENT')) {
      return t('settings.storage.errors.FILE_NOT_FOUND');
    }
    if (rawMessage.includes('ENOSPC')) {
      return t('settings.storage.errors.WRITE_ERROR');
    }
    return rawMessage;
  }

  return t('settings.storage.errors.UNKNOWN_ERROR');
}

// Load storage path and subscribe to progress on mount
onMounted(async () => {
  if (isElectron.value && window.fileSystemAPI !== undefined) {
    try {
      const basePath = await window.fileSystemAPI.getBasePath();
      // Store full path for file operations
      fullStoragePath.value = basePath;
      // Replace home directory with ~ for display
      // Supports macOS (/Users/), Windows (C:\Users\), and Linux (/home/)
      storagePath.value = basePath
        .replace(/^\/Users\/[^/]+/, '~')
        .replace(/^\/home\/[^/]+/, '~')
        .replace(/^C:\\Users\\[^\\]+/, '~');
    } catch {
      // Keep default
    }

    // Subscribe to progress events
    unsubscribeProgress = window.fileSystemAPI.onExportImportProgress((p) => {
      progress.value = p;
    });
  }
});

// Unsubscribe from progress events on unmount
onUnmounted(() => {
  if (unsubscribeProgress) {
    unsubscribeProgress();
    unsubscribeProgress = null;
  }
});

/**
 * Open storage folder in system file explorer
 */
async function openStorageInExplorer(): Promise<void> {
  if (!window.externalAppsAPI || !fullStoragePath.value) return;

  try {
    // Use openWithDefault to open the directory in the file manager
    const result = await window.externalAppsAPI.openWithDefault(fullStoragePath.value);
    if (!result.success) {
      console.error('Failed to open storage folder:', result.error);
    }
  } catch (err) {
    console.error('Failed to open storage folder:', err);
  }
}

/**
 * Handle export button click
 */
async function handleExport(): Promise<void> {
  if (window.electronAPI === undefined || window.fileSystemAPI === undefined) return;

  // Show save dialog
  const result = await window.electronAPI.showSaveDialog({
    title: t('settings.storage.exportDialogTitle'),
    defaultPath: `myndprompts-export-${new Date().toISOString().split('T')[0]}.zip`,
    filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
  });

  if (result.canceled || result.filePath === undefined) {
    return;
  }

  isExporting.value = true;
  progress.value = null;

  try {
    const exportResult = await window.fileSystemAPI.exportData(result.filePath);

    if (exportResult.success) {
      const stats = exportResult.statistics;
      $q.notify({
        type: 'positive',
        message: t('settings.storage.exportSuccess'),
        caption: stats
          ? t('settings.storage.exportSummary', {
              prompts: stats.prompts,
              snippets: stats.snippets,
              total: stats.totalFiles,
            })
          : result.filePath,
        timeout: 5000,
      });
    } else {
      // Get localized error message from the result
      const errorMessage = getLocalizedErrorMessage(exportResult.errorCode, exportResult.error);
      throw new Error(errorMessage);
    }
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);

    $q.notify({
      type: 'negative',
      message: t('settings.storage.exportError'),
      caption: getLocalizedErrorMessage(undefined, rawMessage),
      timeout: 5000,
    });
  } finally {
    isExporting.value = false;
    progress.value = null;
  }
}

/**
 * Handle import button click
 */
async function handleImport(): Promise<void> {
  if (window.electronAPI === undefined || window.fileSystemAPI === undefined) return;

  // Show open dialog
  const result = await window.electronAPI.showOpenDialog({
    title: t('settings.storage.importDialogTitle'),
    filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths[0] === undefined) {
    return;
  }

  const zipPath = result.filePaths[0];

  isImporting.value = true;
  progress.value = null;

  try {
    // Validate first
    const validation = await window.fileSystemAPI.validateExport(zipPath);

    if (!validation.valid) {
      // Get the first error code from validationErrors if available
      const errorCode = validation.validationErrors?.[0]?.code;
      const errorMessage = getLocalizedErrorMessage(
        errorCode as ExportImportErrorCode | undefined,
        validation.errors.join('; ')
      );
      throw new Error(errorMessage);
    }

    // Import the data
    const importResult = await window.fileSystemAPI.importData(zipPath, {
      conflictResolution: 'rename',
    });

    if (importResult.success) {
      // Refresh stores
      await promptStore.refreshAllPrompts();
      await snippetStore.refreshAllSnippets();

      const stats = importResult.imported;
      $q.notify({
        type: 'positive',
        message: t('settings.storage.importSuccess'),
        caption: t('settings.storage.importSummary', {
          prompts: stats.prompts,
          snippets: stats.snippets,
          total: stats.totalFiles,
          skipped: importResult.skipped,
        }),
        timeout: 5000,
      });
    } else {
      // Get localized error message from the result
      const errorMessage = getLocalizedErrorMessage(importResult.errorCode, importResult.error);
      throw new Error(errorMessage);
    }
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);

    $q.notify({
      type: 'negative',
      message: t('settings.storage.importError'),
      caption: getLocalizedErrorMessage(undefined, rawMessage),
      timeout: 5000,
    });
  } finally {
    isImporting.value = false;
    progress.value = null;
  }
}

/**
 * Handle migration complete event from MoveStorageDialog
 */
async function handleMigrationComplete(newPath: string): Promise<void> {
  // Update full path for file operations
  fullStoragePath.value = newPath;
  // Update displayed path (replace home directory with ~ for display)
  // Supports macOS (/Users/), Windows (C:\Users\), and Linux (/home/)
  storagePath.value = newPath
    .replace(/^\/Users\/[^/]+/, '~')
    .replace(/^\/home\/[^/]+/, '~')
    .replace(/^C:\\Users\\[^\\]+/, '~');

  // IMPORTANT: Clear all state that contains old absolute paths
  // Open tabs have file paths from the old storage location
  uiStore.closeAllTabs();

  // Clear all caches that are keyed by old absolute file paths
  promptStore.clearAllCaches();
  snippetStore.clearAllCaches();

  // Clear recent files (they all point to old storage location)
  await promptStore.clearAllRecentFiles();

  // Refresh stores to load data from new location
  await promptStore.refreshAllPrompts();
  await snippetStore.refreshAllSnippets();

  // Show success notification
  $q.notify({
    type: 'positive',
    message: t('settings.storage.moveStorage.successNotification'),
    position: 'bottom',
    timeout: 3000,
  });
}
</script>

<template>
  <div class="storage-section">
    <!-- Browser mode message -->
    <div
      v-if="!isElectron"
      class="storage-section__browser-mode"
    >
      <q-icon
        name="info"
        size="24px"
        class="text-grey-6 q-mr-sm"
      />
      <span class="text-grey-6 text-caption">
        {{ t('settings.storage.browserMode') }}
      </span>
    </div>

    <template v-else>
      <!-- Storage Location -->
      <div class="storage-section__row">
        <div class="storage-section__label">
          {{ t('settingsPanel.storageLocation') }}
        </div>
        <div class="storage-section__value storage-section__value--with-action">
          <code class="storage-section__path">{{ storagePath }}</code>
          <q-btn
            flat
            dense
            round
            size="sm"
            icon="folder_open"
            :title="t('settings.storage.openInExplorer')"
            @click="openStorageInExplorer"
          />
        </div>
        <div class="storage-section__hint text-caption text-grey">
          {{ t('settings.storage.locationHint') }}
        </div>
      </div>

      <!-- Export Section -->
      <div class="storage-section__row">
        <div class="storage-section__label">
          {{ t('settings.storage.exportTitle') }}
        </div>
        <div class="storage-section__hint text-caption text-grey q-mb-sm">
          {{ t('settings.storage.exportDescription') }}
        </div>
        <q-btn
          flat
          no-caps
          icon="download"
          :label="
            isExporting ? t('settings.storage.exporting') : t('settings.storage.exportButton')
          "
          :loading="isExporting"
          :disable="isImporting"
          @click="handleExport"
        />
        <!-- Export Progress -->
        <div
          v-if="isExporting && progress"
          class="storage-section__progress q-mt-sm"
        >
          <q-linear-progress
            :value="progressPercent"
            color="primary"
            class="q-mb-xs"
          />
          <div class="storage-section__progress-info text-caption text-grey">
            <span>{{ progressLabel }}</span>
            <span v-if="progress.total > 0"> {{ progress.current }} / {{ progress.total }} </span>
          </div>
          <div
            v-if="progress.currentFile"
            class="storage-section__progress-file text-caption text-grey ellipsis"
          >
            {{ progress.currentFile }}
          </div>
        </div>
      </div>

      <!-- Import Section -->
      <div class="storage-section__row">
        <div class="storage-section__label">
          {{ t('settings.storage.importTitle') }}
        </div>
        <div class="storage-section__hint text-caption text-grey q-mb-xs">
          {{ t('settings.storage.importDescription') }}
        </div>
        <div class="storage-section__warning text-caption text-warning q-mb-sm">
          <q-icon
            name="warning"
            size="14px"
            class="q-mr-xs"
          />
          {{ t('settings.storage.importWarning') }}
        </div>
        <q-btn
          flat
          no-caps
          icon="upload"
          :label="
            isImporting ? t('settings.storage.importing') : t('settings.storage.importButton')
          "
          :loading="isImporting"
          :disable="isExporting"
          @click="handleImport"
        />
        <!-- Import Progress -->
        <div
          v-if="isImporting && progress"
          class="storage-section__progress q-mt-sm"
        >
          <q-linear-progress
            :value="progressPercent"
            color="primary"
            class="q-mb-xs"
          />
          <div class="storage-section__progress-info text-caption text-grey">
            <span>{{ progressLabel }}</span>
            <span v-if="progress.total > 0"> {{ progress.current }} / {{ progress.total }} </span>
          </div>
          <div
            v-if="progress.currentFile"
            class="storage-section__progress-file text-caption text-grey ellipsis"
          >
            {{ progress.currentFile }}
          </div>
        </div>
      </div>

      <!-- Move Storage Section -->
      <div class="storage-section__row">
        <div class="storage-section__label">
          {{ t('settings.storage.moveStorage.sectionTitle') }}
        </div>
        <div class="storage-section__hint text-caption text-grey q-mb-sm">
          {{ t('settings.storage.moveStorage.sectionDescription') }}
        </div>
        <q-btn
          flat
          no-caps
          icon="drive_file_move"
          :label="t('settings.storage.moveStorage.button')"
          :disable="isExporting || isImporting"
          @click="showMoveDialog = true"
        />
      </div>

      <!-- Move Storage Dialog -->
      <MoveStorageDialog
        v-model="showMoveDialog"
        @migration-complete="handleMigrationComplete"
      />
    </template>
  </div>
</template>

<style lang="scss" scoped>
.storage-section {
  padding: 8px 0;

  &__browser-mode {
    display: flex;
    align-items: center;
    padding: 16px 8px;
    color: var(--text-secondary);
  }

  &__row {
    padding: 12px 0;
    border-bottom: 1px solid var(--border-color, #3c3c3c);

    &:last-child {
      border-bottom: none;
    }
  }

  &__label {
    font-weight: 500;
    margin-bottom: 4px;
    color: var(--text-primary);
  }

  &__value {
    margin-bottom: 4px;

    &--with-action {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }

  &__path {
    font-family: 'Fira Code', monospace;
    font-size: 13px;
    padding: 4px 8px;
    background-color: var(--code-bg, #2d2d2d);
    border-radius: 4px;
    color: var(--text-primary);
  }

  &__hint {
    line-height: 1.4;
  }

  &__warning {
    display: flex;
    align-items: center;
  }

  &__progress {
    max-width: 300px;
  }

  &__progress-info {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  &__progress-file {
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.body--light .storage-section {
  --border-color: #e7e7e7;
  --code-bg: #f5f5f5;
  --text-primary: #1d1d1d;
}

.body--dark .storage-section {
  --border-color: #3c3c3c;
  --code-bg: #2d2d2d;
  --text-primary: #d4d4d4;
}
</style>
