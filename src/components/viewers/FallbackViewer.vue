<template>
  <div class="fallback-viewer">
    <div class="fallback-viewer__card">
      <!-- Icon -->
      <div class="fallback-viewer__icon-container">
        <q-icon
          name="block"
          size="96px"
          color="grey-6"
        />
      </div>

      <!-- Message -->
      <div class="fallback-viewer__message">This file type cannot be previewed</div>

      <!-- File name -->
      <div class="fallback-viewer__filename">{{ fileName }}</div>

      <!-- File size -->
      <div
        v-if="fileSize"
        class="fallback-viewer__size"
      >
        {{ fileSize }}
      </div>

      <!-- Actions -->
      <div class="fallback-viewer__actions">
        <q-btn
          :label="`Show in ${fileManagerName}`"
          icon="folder_open"
          color="primary"
          unelevated
          class="fallback-viewer__action-btn"
          @click="showInFolder"
        >
          <q-tooltip>Reveal file in {{ fileManagerName }}</q-tooltip>
        </q-btn>

        <q-btn
          label="Open with Default App"
          icon="open_in_new"
          color="primary"
          outline
          class="fallback-viewer__action-btn"
          @click="openWithDefault"
        >
          <q-tooltip>Open file with system default application</q-tooltip>
        </q-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { externalAppService } from '@/services/external-apps';

/**
 * FallbackViewer - Displays unsupported file types with option to open externally
 */

interface Props {
  /** Full path to the file */
  filePath: string;
  /** Display name of the file */
  fileName: string;
  /** Optional MIME type */
  mimeType?: string;
}

const props = defineProps<Props>();

// State
const fileSize = ref<string>('');

// Computed
const fileManagerName = computed(() => {
  return externalAppService.getFileManagerName();
});

// Methods
async function showInFolder(): Promise<void> {
  await externalAppService.showInFolder(props.filePath);
}

async function openWithDefault(): Promise<void> {
  const result = await externalAppService.openWithDefault(props.filePath);
  if (!result.success) {
    console.error('Failed to open file:', result.error);
  }
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
.fallback-viewer {
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

.fallback-viewer__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 40px;
  max-width: 400px;
  width: 100%;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);

  .body--light & {
    background-color: #fff;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  }
}

.fallback-viewer__icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 140px;
  height: 140px;
  background: linear-gradient(135deg, rgba(158, 158, 158, 0.15), rgba(158, 158, 158, 0.05));
  border-radius: 20px;

  .body--light & {
    background: linear-gradient(135deg, rgba(158, 158, 158, 0.12), rgba(158, 158, 158, 0.04));
  }
}

.fallback-viewer__message {
  font-size: 1.1rem;
  font-weight: 500;
  text-align: center;
  color: rgba(255, 255, 255, 0.7);

  .body--light & {
    color: rgba(0, 0, 0, 0.6);
  }
}

.fallback-viewer__filename {
  font-size: 0.95rem;
  font-family: monospace;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  word-break: break-all;
  max-width: 100%;
  padding: 8px 16px;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 8px;

  .body--light & {
    color: rgba(0, 0, 0, 0.5);
    background-color: rgba(0, 0, 0, 0.05);
  }
}

.fallback-viewer__size {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.4);

  .body--light & {
    color: rgba(0, 0, 0, 0.4);
  }
}

.fallback-viewer__actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  margin-top: 8px;
}

.fallback-viewer__action-btn {
  width: 100%;
}
</style>
