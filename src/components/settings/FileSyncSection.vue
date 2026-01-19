<script setup lang="ts">
/**
 * FileSyncSection Component
 *
 * Settings section for managing File Sync - add external folders to sync
 * for file path autocomplete in the editor.
 */

import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFileSyncStore } from '@/stores/fileSyncStore';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import type { IProjectFolder } from '@/services/storage/entities';

const { t } = useI18n({ useScope: 'global' });
const fileSyncStore = useFileSyncStore();
const projectStore = useProjectStore();
const uiStore = useUIStore();

// Check if running in Electron
const isElectron = computed((): boolean => window?.fileSystemAPI !== undefined);

// Get current project based on active tab
const currentProject = computed(() => {
  const activeTab = uiStore.activeTab;
  if (activeTab?.filePath === undefined || activeTab.filePath === '') return null;
  return projectStore.getProjectForPath(activeTab.filePath);
});

// Get current project path
const currentProjectPath = computed(() => currentProject.value?.folderPath ?? null);

// Get folders for current project
const folders = computed(() => {
  if (currentProjectPath.value === null) return [];
  return fileSyncStore.getFoldersForProject(currentProjectPath.value);
});

const syncStatus = computed(() => fileSyncStore.syncStatus);
const hasActiveIndexing = computed(() => fileSyncStore.hasActiveIndexing);
const currentOperation = computed(() => fileSyncStore.currentOperation);

// Initialize store
onMounted(async () => {
  if (isElectron.value && !fileSyncStore.isInitialized) {
    await fileSyncStore.initialize();
  }
  if (!projectStore.isInitialized) {
    await projectStore.initialize();
  }
});

async function addFolder(): Promise<void> {
  if (currentProjectPath.value === null || window.electronAPI === undefined) return;

  const result = await window.electronAPI.showOpenDialog({
    properties: ['openDirectory'],
    title: t('fileSync.selectFolder'),
  });

  if (!result.canceled && result.filePaths[0] !== undefined) {
    const folder = await fileSyncStore.addFolder(currentProjectPath.value, result.filePaths[0]);
    if (folder !== null) {
      await fileSyncStore.startIndexing(folder.id);
    }
  }
}

async function removeFolder(folder: IProjectFolder): Promise<void> {
  await fileSyncStore.removeFolder(folder.id);
}

async function syncFolder(folder: IProjectFolder): Promise<void> {
  await fileSyncStore.startIndexing(folder.id);
}

async function syncAll(): Promise<void> {
  for (const folder of folders.value) {
    if (folder.status !== 'indexing') {
      await fileSyncStore.startIndexing(folder.id);
    }
  }
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
  // Show abbreviated path - replace home directory with ~
  // Note: In Electron renderer, we don't have process.env directly
  // So we'll just truncate long paths from the start
  if (fullPath.length > 40) {
    return '...' + fullPath.slice(-37);
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
  <div class="file-sync-section">
    <!-- Browser mode message -->
    <div
      v-if="!isElectron"
      class="file-sync-section__browser-mode"
    >
      <q-icon
        name="info"
        size="24px"
        class="text-grey-6 q-mr-sm"
      />
      <span class="text-grey-6 text-caption">
        {{ t('fileSync.browserMode') }}
      </span>
    </div>

    <!-- No project selected -->
    <div
      v-else-if="!currentProjectPath"
      class="file-sync-section__no-project"
    >
      <q-icon
        name="folder_off"
        size="24px"
        class="text-grey-6 q-mr-sm"
      />
      <span class="text-grey-6 text-caption">
        {{ t('fileSync.noProject') }}
      </span>
    </div>

    <template v-else>
      <!-- Status summary -->
      <div class="file-sync-section__status">
        <div class="file-sync-section__status-badge">
          <q-badge
            :color="syncStatus.isUpToDate ? 'positive' : folders.length === 0 ? 'grey' : 'warning'"
          >
            <q-icon
              :name="
                syncStatus.isUpToDate
                  ? 'cloud_done'
                  : folders.length === 0
                    ? 'cloud_off'
                    : 'cloud_sync'
              "
              size="12px"
              class="q-mr-xs"
            />
            {{
              syncStatus.isUpToDate
                ? t('fileSync.upToDate')
                : folders.length === 0
                  ? t('fileSync.noFolders')
                  : t('fileSync.needsSync')
            }}
          </q-badge>
        </div>
        <span class="text-caption text-grey">
          {{ t('fileSync.folderCount', { count: folders.length }) }}
        </span>
      </div>

      <!-- Progress bar when indexing -->
      <div
        v-if="hasActiveIndexing && currentOperation"
        class="file-sync-section__progress"
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
        class="file-sync-section__list"
      >
        <q-item
          v-for="folder in folders"
          :key="folder.id"
          class="file-sync-section__item"
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
          </q-item-section>

          <q-item-section side>
            <div class="row items-center q-gutter-xs">
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
              <q-btn
                flat
                dense
                round
                size="sm"
                icon="delete"
                color="negative"
                @click="removeFolder(folder)"
              >
                <q-tooltip>{{ t('common.remove') }}</q-tooltip>
              </q-btn>
            </div>
          </q-item-section>
        </q-item>

        <!-- Empty state -->
        <q-item
          v-if="folders.length === 0"
          class="file-sync-section__empty"
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

      <!-- Actions -->
      <div class="file-sync-section__actions">
        <q-btn
          flat
          dense
          no-caps
          icon="add"
          :label="t('fileSync.addFolder')"
          @click="addFolder"
        />
        <q-btn
          v-if="folders.length > 0 && !syncStatus.isUpToDate"
          flat
          dense
          no-caps
          icon="sync"
          :label="t('fileSync.syncAll')"
          :loading="hasActiveIndexing"
          @click="syncAll"
        />
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.file-sync-section {
  padding: 8px 0;

  &__browser-mode,
  &__no-project {
    display: flex;
    align-items: center;
    padding: 16px 8px;
    color: var(--text-secondary);
  }

  &__status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px 8px;
  }

  &__progress {
    padding: 0 8px 8px;
  }

  &__list {
    max-height: 200px;
    overflow-y: auto;
  }

  &__item {
    border-radius: 4px;

    &:hover {
      background-color: var(--item-hover-bg, #2a2d2e);
    }
  }

  &__empty {
    padding: 16px;
  }

  &__actions {
    display: flex;
    gap: 8px;
    padding: 8px;
    border-top: 1px solid var(--border-color, #3c3c3c);
  }
}

.body--light .file-sync-section {
  --item-hover-bg: #e8e8e8;
  --border-color: #e7e7e7;
}

.body--dark .file-sync-section {
  --item-hover-bg: #2a2d2e;
  --border-color: #3c3c3c;
}
</style>
