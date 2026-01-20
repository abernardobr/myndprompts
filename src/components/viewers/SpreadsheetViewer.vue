<template>
  <div class="spreadsheet-viewer">
    <div class="spreadsheet-viewer__card">
      <!-- Icon with extension badge -->
      <div class="spreadsheet-viewer__icon-container">
        <q-icon
          :name="spreadsheetIcon"
          size="96px"
          color="positive"
        />
        <q-badge
          :label="fileExtension.toUpperCase()"
          color="positive"
          class="spreadsheet-viewer__badge"
        />
      </div>

      <!-- File name -->
      <div class="spreadsheet-viewer__name">{{ fileName }}</div>

      <!-- File size -->
      <div
        v-if="fileSize"
        class="spreadsheet-viewer__size"
      >
        {{ fileSize }}
      </div>

      <!-- Actions -->
      <div class="spreadsheet-viewer__actions">
        <q-btn
          v-for="action in availableActions"
          :key="action.id"
          :label="action.label"
          :icon="action.icon"
          outline
          color="positive"
          class="spreadsheet-viewer__action-btn"
          @click="action.handler"
        >
          <q-tooltip>{{ action.tooltip }}</q-tooltip>
        </q-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { externalAppService } from '@/services/external-apps';

/**
 * SpreadsheetViewer - Displays spreadsheet files with options to open in external applications
 */

interface Props {
  /** Full path to the spreadsheet file */
  filePath: string;
  /** Display name of the file */
  fileName: string;
  /** Optional MIME type */
  mimeType?: string;
}

const props = defineProps<Props>();

// State
const fileSize = ref<string>('');
const platform = ref<NodeJS.Platform>('darwin');

// Computed
const fileExtension = computed(() => {
  const ext = props.fileName.split('.').pop() ?? '';
  return ext.toLowerCase();
});

const spreadsheetIcon = computed(() => {
  switch (fileExtension.value) {
    case 'xls':
    case 'xlsx':
      return 'grid_on';
    case 'ods':
      return 'table_chart';
    case 'csv':
    case 'tsv':
      return 'view_list';
    case 'numbers':
      return 'grid_on';
    default:
      return 'table_chart';
  }
});

const fileManagerName = computed(() => {
  return externalAppService.getFileManagerName();
});

interface IAction {
  id: string;
  label: string;
  icon: string;
  tooltip: string;
  handler: () => void;
}

const availableActions = computed<IAction[]>(() => {
  const actions: IAction[] = [];
  const ext = fileExtension.value;

  // Open with default app - always available
  actions.push({
    id: 'open-default',
    label: 'Open with Default App',
    icon: 'open_in_new',
    tooltip: 'Open file with system default application',
    handler: () => void openWithDefault(),
  });

  // Platform-specific app options
  if (platform.value === 'darwin') {
    // macOS specific apps
    if (['xls', 'xlsx', 'csv', 'ods', 'tsv'].includes(ext)) {
      actions.push({
        id: 'open-excel',
        label: 'Open in Excel',
        icon: 'grid_on',
        tooltip: 'Open in Microsoft Excel',
        handler: () => void openInApp('Microsoft Excel'),
      });
      actions.push({
        id: 'open-numbers',
        label: 'Open in Numbers',
        icon: 'table_chart',
        tooltip: 'Open in Apple Numbers',
        handler: () => void openInApp('Numbers'),
      });
    }

    if (ext === 'numbers') {
      actions.push({
        id: 'open-numbers',
        label: 'Open in Numbers',
        icon: 'table_chart',
        tooltip: 'Open in Apple Numbers',
        handler: () => void openInApp('Numbers'),
      });
    }
  } else if (platform.value === 'win32') {
    // Windows specific apps
    if (['xls', 'xlsx', 'csv', 'ods', 'tsv'].includes(ext)) {
      actions.push({
        id: 'open-excel',
        label: 'Open in Excel',
        icon: 'grid_on',
        tooltip: 'Open in Microsoft Excel',
        handler: () => void openInApp('EXCEL.EXE'),
      });
    }
  }

  // Show in Finder/Explorer - always available
  actions.push({
    id: 'show-in-folder',
    label: `Show in ${fileManagerName.value}`,
    icon: 'folder_open',
    tooltip: `Reveal file in ${fileManagerName.value}`,
    handler: () => void showInFolder(),
  });

  return actions;
});

// Methods
async function openWithDefault(): Promise<void> {
  const result = await externalAppService.openWithDefault(props.filePath);
  if (!result.success) {
    console.error('Failed to open file:', result.error);
  }
}

async function openInApp(appName: string): Promise<void> {
  const result = await externalAppService.openInApp(props.filePath, appName);
  if (!result.success) {
    console.error(`Failed to open in ${appName}:`, result.error);
    // Fallback to default app
    await openWithDefault();
  }
}

async function showInFolder(): Promise<void> {
  await externalAppService.showInFolder(props.filePath);
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

async function loadFileInfo(): Promise<void> {
  try {
    // Get platform
    platform.value = await externalAppService.getPlatform();

    // Get file size
    if (window.fileSystemAPI?.getFileInfo) {
      const info = await window.fileSystemAPI.getFileInfo(props.filePath);
      if (info?.size !== undefined) {
        fileSize.value = formatFileSize(info.size);
      }
    }
  } catch {
    // Silently ignore - file info is optional
  }
}

onMounted(() => {
  void loadFileInfo();
});
</script>

<style lang="scss" scoped>
.spreadsheet-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background-color: var(--q-dark-page, #121212);

  .body--light & {
    background-color: #f5f5f5;
  }
}

.spreadsheet-viewer__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 40px;
  max-width: 500px;
  width: 100%;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);

  .body--light & {
    background-color: #fff;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  }
}

.spreadsheet-viewer__icon-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 140px;
  height: 140px;
  background: linear-gradient(135deg, rgba(33, 186, 69, 0.15), rgba(33, 186, 69, 0.05));
  border-radius: 20px;

  .body--light & {
    background: linear-gradient(135deg, rgba(33, 186, 69, 0.12), rgba(33, 186, 69, 0.04));
  }
}

.spreadsheet-viewer__badge {
  position: absolute;
  bottom: -8px;
  right: -8px;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 4px;
}

.spreadsheet-viewer__name {
  font-size: 1.2rem;
  font-weight: 500;
  text-align: center;
  color: rgba(255, 255, 255, 0.9);
  word-break: break-word;
  max-width: 100%;

  .body--light & {
    color: rgba(0, 0, 0, 0.85);
  }
}

.spreadsheet-viewer__size {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.5);

  .body--light & {
    color: rgba(0, 0, 0, 0.5);
  }
}

.spreadsheet-viewer__actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  margin-top: 12px;
}

.spreadsheet-viewer__action-btn {
  width: 100%;
  justify-content: flex-start;
  padding: 12px 20px;

  :deep(.q-btn__content) {
    justify-content: flex-start;
  }

  :deep(.q-icon) {
    margin-right: 12px;
  }
}
</style>
