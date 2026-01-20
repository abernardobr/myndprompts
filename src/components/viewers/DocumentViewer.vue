<template>
  <div class="document-viewer">
    <div class="document-viewer__card">
      <!-- Icon with extension badge -->
      <div class="document-viewer__icon-container">
        <q-icon
          :name="documentIcon"
          size="96px"
          color="primary"
        />
        <q-badge
          :label="fileExtension.toUpperCase()"
          color="primary"
          class="document-viewer__badge"
        />
      </div>

      <!-- File name -->
      <div class="document-viewer__name">{{ fileName }}</div>

      <!-- File size -->
      <div
        v-if="fileSize"
        class="document-viewer__size"
      >
        {{ fileSize }}
      </div>

      <!-- Actions -->
      <div class="document-viewer__actions">
        <q-btn
          v-for="action in availableActions"
          :key="action.id"
          :label="action.label"
          :icon="action.icon"
          outline
          color="primary"
          class="document-viewer__action-btn"
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
 * DocumentViewer - Displays document files with options to open in external applications
 */

interface Props {
  /** Full path to the document file */
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

const documentIcon = computed(() => {
  switch (fileExtension.value) {
    case 'pdf':
      return 'picture_as_pdf';
    case 'doc':
    case 'docx':
      return 'description';
    case 'odt':
      return 'description';
    case 'rtf':
      return 'article';
    case 'pages':
      return 'description';
    case 'tex':
      return 'functions';
    default:
      return 'insert_drive_file';
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
    if (['doc', 'docx', 'rtf', 'odt'].includes(ext)) {
      actions.push({
        id: 'open-word',
        label: 'Open in Word',
        icon: 'description',
        tooltip: 'Open in Microsoft Word',
        handler: () => void openInApp('Microsoft Word'),
      });
      actions.push({
        id: 'open-pages',
        label: 'Open in Pages',
        icon: 'description',
        tooltip: 'Open in Apple Pages',
        handler: () => void openInApp('Pages'),
      });
    }

    if (ext === 'pdf') {
      actions.push({
        id: 'open-preview',
        label: 'Open in Preview',
        icon: 'preview',
        tooltip: 'Open in Preview',
        handler: () => void openInApp('Preview'),
      });
    }
  } else if (platform.value === 'win32') {
    // Windows specific apps
    if (['doc', 'docx', 'rtf'].includes(ext)) {
      actions.push({
        id: 'open-word',
        label: 'Open in Word',
        icon: 'description',
        tooltip: 'Open in Microsoft Word',
        handler: () => void openInApp('WINWORD.EXE'),
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
.document-viewer {
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

.document-viewer__card {
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

.document-viewer__icon-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 140px;
  height: 140px;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(124, 58, 237, 0.05));
  border-radius: 20px;

  .body--light & {
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(124, 58, 237, 0.04));
  }
}

.document-viewer__badge {
  position: absolute;
  bottom: -8px;
  right: -8px;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 4px;
}

.document-viewer__name {
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

.document-viewer__size {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.5);

  .body--light & {
    color: rgba(0, 0, 0, 0.5);
  }
}

.document-viewer__actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  margin-top: 12px;
}

.document-viewer__action-btn {
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
