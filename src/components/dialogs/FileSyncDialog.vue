<script setup lang="ts">
/**
 * FileSyncDialog Component
 *
 * Dialog for managing File Sync folders for a project.
 * Allows adding and removing external folders for file path autocomplete.
 */

import { computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { useFileSyncStore } from '@/stores/fileSyncStore';
import type { IProjectFolder } from '@/services/storage/entities';

interface Props {
  modelValue: boolean;
  projectPath: string;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n({ useScope: 'global' });
const $q = useQuasar();
const fileSyncStore = useFileSyncStore();

// Get folders for current project
const folders = computed(() => {
  if (props.projectPath === '') return [];
  return fileSyncStore.getFoldersForProject(props.projectPath);
});

const hasActiveIndexing = computed(() => fileSyncStore.hasActiveIndexing);
const currentOperation = computed(() => fileSyncStore.currentOperation);

// Initialize store on mount
onMounted(async () => {
  if (!fileSyncStore.isInitialized) {
    await fileSyncStore.initialize();
  }
});

// Refresh folders when dialog opens
watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen) {
      if (!fileSyncStore.isInitialized) {
        await fileSyncStore.initialize();
      } else {
        // Reset any folders stuck in "indexing" status from previous sessions
        await fileSyncStore.resetStuckFolders();
      }
    }
  }
);

function handleClose(): void {
  emit('update:modelValue', false);
}

async function addFolder(): Promise<void> {
  if (props.projectPath === '' || window.electronAPI === undefined) return;

  try {
    const result = await window.electronAPI.showOpenDialog({
      properties: ['openDirectory'],
      title: t('fileSync.selectFolder'),
    });

    if (!result.canceled && result.filePaths[0] !== undefined) {
      const folder = await fileSyncStore.addFolder(props.projectPath, result.filePaths[0]);
      if (folder !== null) {
        $q.notify({
          type: 'positive',
          message: t('success.created'),
          position: 'top',
          timeout: 3000,
        });
        await fileSyncStore.startIndexing(folder.id);
      } else if (fileSyncStore.error !== null) {
        $q.notify({
          type: 'negative',
          message: fileSyncStore.error,
          position: 'top',
          timeout: 5000,
        });
        fileSyncStore.clearError();
      }
    }
  } catch (err) {
    console.error('Failed to add sync folder:', err);
    $q.notify({
      type: 'negative',
      message: 'Failed to add folder',
      position: 'top',
      timeout: 5000,
    });
  }
}

async function removeFolder(folder: IProjectFolder): Promise<void> {
  // Don't allow removal while indexing
  if (folder.status === 'indexing') {
    $q.notify({
      type: 'warning',
      message: t('fileSync.cannotRemoveWhileIndexing'),
      position: 'top',
      timeout: 3000,
    });
    return;
  }
  await fileSyncStore.removeFolder(folder.id);
}

async function syncFolder(folder: IProjectFolder): Promise<void> {
  await fileSyncStore.startIndexing(folder.id);
}

async function stopSyncFolder(folder: IProjectFolder): Promise<void> {
  // Find the operation ID for this folder
  const operationId = folder.id;
  await fileSyncStore.cancelIndexing(operationId);
}

async function stopAllSync(): Promise<void> {
  await fileSyncStore.cancelAllIndexing();
}

async function syncAll(): Promise<void> {
  // Capture folder IDs at the start to avoid issues with reactive state changes during iteration
  const folderIds = folders.value.map((f) => ({
    id: f.id,
    path: f.folderPath,
    status: f.status,
  }));

  console.log('[FileSyncDialog] syncAll called with folders:', folderIds);

  for (let i = 0; i < folderIds.length; i++) {
    const folderInfo = folderIds[i];
    console.log(
      `[FileSyncDialog] Processing folder ${i + 1}/${folderIds.length}: ${folderInfo.path} (id: ${folderInfo.id})`
    );

    // Get current status from store (might have changed)
    const currentFolder = folders.value.find((f) => f.id === folderInfo.id);
    const currentStatus = currentFolder?.status ?? 'unknown';

    console.log(`[FileSyncDialog] Current status for ${folderInfo.path}: ${currentStatus}`);

    if (currentStatus !== 'indexing') {
      console.log(`[FileSyncDialog] Starting indexing for: ${folderInfo.path}`);
      try {
        await fileSyncStore.startIndexing(folderInfo.id);
        console.log(`[FileSyncDialog] Completed indexing for: ${folderInfo.path}`);
      } catch (err) {
        console.error(`[FileSyncDialog] Error indexing ${folderInfo.path}:`, err);
      }
    } else {
      console.log(`[FileSyncDialog] Skipping ${folderInfo.path} - already indexing`);
    }

    // Small delay between folders to let UI update
    if (i < folderIds.length - 1) {
      console.log('[FileSyncDialog] Waiting 100ms before next folder...');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log('[FileSyncDialog] syncAll completed');
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'indexed':
      return 'positive';
    case 'indexing':
      return 'warning';
    case 'error':
      return 'negative';
    default:
      return 'grey';
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'indexed':
      return 'check_circle';
    case 'indexing':
      return 'sync';
    case 'error':
      return 'error';
    default:
      return 'schedule';
  }
}

function formatPath(fullPath: string): string {
  // Show abbreviated path - truncate long paths from the start
  if (fullPath.length > 50) {
    return '...' + fullPath.slice(-47);
  }
  return fullPath;
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'indexed':
      return t('fileSync.status.indexed');
    case 'indexing':
      return t('fileSync.status.indexing');
    case 'error':
      return t('fileSync.status.error');
    case 'pending':
      return t('fileSync.status.pending');
    default:
      return status;
  }
}
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card
      class="file-sync-dialog"
      data-testid="file-sync-dialog"
    >
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">{{ t('fileSync.title') }}</div>
        <q-space />
        <q-btn
          v-close-popup
          icon="close"
          flat
          round
          dense
          @click="handleClose"
        />
      </q-card-section>

      <q-card-section class="file-sync-dialog__content">
        <!-- Progress bar when indexing -->
        <div
          v-if="hasActiveIndexing && currentOperation"
          class="file-sync-dialog__progress"
        >
          <q-linear-progress
            indeterminate
            color="primary"
            class="q-mb-xs"
          />
          <div class="text-caption text-grey">
            {{ t('fileSync.indexing') }}
            <span
              v-if="currentOperation.currentFile"
              class="text-primary"
            >
              {{ currentOperation.currentFile }}
            </span>
            <span v-if="currentOperation.current > 0">
              ({{ currentOperation.current }} {{ t('fileSync.filesIndexed') }})
            </span>
          </div>
        </div>

        <!-- Folder list -->
        <q-list
          dense
          class="file-sync-dialog__list"
        >
          <q-item
            v-for="folder in folders"
            :key="folder.id"
            class="file-sync-dialog__item"
          >
            <q-item-section avatar>
              <q-icon
                :name="getStatusIcon(folder.status)"
                :color="getStatusColor(folder.status)"
              />
            </q-item-section>

            <q-item-section>
              <q-item-label class="ellipsis">
                {{ formatPath(folder.folderPath) }}
              </q-item-label>
              <q-item-label caption>
                <span v-if="folder.status === 'indexed'">
                  {{ t('fileSync.fileCount', { count: folder.fileCount }) }}
                </span>
                <span
                  v-else-if="folder.status === 'error'"
                  class="text-negative"
                >
                  {{ folder.errorMessage || t('fileSync.status.error') }}
                </span>
                <span v-else>
                  {{ getStatusLabel(folder.status) }}
                </span>
              </q-item-label>
              <q-tooltip>{{ folder.folderPath }}</q-tooltip>
            </q-item-section>

            <q-item-section side>
              <div class="row items-center q-gutter-xs">
                <!-- Sync button (when not indexing) -->
                <q-btn
                  v-if="folder.status !== 'indexing'"
                  flat
                  dense
                  round
                  size="sm"
                  icon="refresh"
                  @click="syncFolder(folder)"
                >
                  <q-tooltip>{{ t('fileSync.syncNow') }}</q-tooltip>
                </q-btn>
                <!-- Stop button (when indexing) -->
                <q-btn
                  v-else
                  flat
                  dense
                  round
                  size="sm"
                  icon="stop"
                  color="warning"
                  @click="stopSyncFolder(folder)"
                >
                  <q-tooltip>{{ t('fileSync.cancelIndexing') }}</q-tooltip>
                </q-btn>
                <!-- Remove button (disabled when indexing) -->
                <q-btn
                  flat
                  dense
                  round
                  size="sm"
                  icon="delete"
                  :color="folder.status === 'indexing' ? 'grey' : 'negative'"
                  :disable="folder.status === 'indexing'"
                  @click="removeFolder(folder)"
                >
                  <q-tooltip>
                    {{
                      folder.status === 'indexing'
                        ? t('fileSync.cannotRemoveWhileIndexing')
                        : t('common.remove')
                    }}
                  </q-tooltip>
                </q-btn>
              </div>
            </q-item-section>
          </q-item>

          <!-- Empty state -->
          <q-item
            v-if="folders.length === 0"
            class="file-sync-dialog__empty"
          >
            <q-item-section>
              <q-item-label class="text-grey-6 text-center">
                {{ t('fileSync.noFolders') }}
              </q-item-label>
              <q-item-label
                caption
                class="text-grey-7 text-center"
              >
                {{ t('fileSync.addFolderHint') }}
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-card-actions
        align="right"
        class="q-px-md q-pb-md"
      >
        <q-btn
          v-if="folders.length > 0 && hasActiveIndexing"
          flat
          :label="t('fileSync.stopAll')"
          color="warning"
          icon="stop"
          @click="stopAllSync"
        />
        <q-btn
          v-else-if="folders.length > 0"
          flat
          :label="t('fileSync.syncAll')"
          color="grey"
          icon="sync"
          @click="syncAll"
        />
        <q-btn
          flat
          :label="t('fileSync.addFolder')"
          color="primary"
          icon="add"
          @click="addFolder"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style lang="scss" scoped>
.file-sync-dialog {
  min-width: 500px;
  max-width: 600px;

  &__content {
    max-height: 400px;
    overflow-y: auto;
  }

  &__progress {
    padding-bottom: 12px;
  }

  &__list {
    min-height: 100px;
  }

  &__item {
    border-radius: 4px;

    &:hover {
      background-color: var(--item-hover-bg, #2a2d2e);
    }
  }

  &__empty {
    padding: 32px 16px;
  }
}

.body--light .file-sync-dialog {
  --item-hover-bg: #e8e8e8;
}

.body--dark .file-sync-dialog {
  --item-hover-bg: #2a2d2e;
}
</style>
