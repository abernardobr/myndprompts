<template>
  <div class="image-viewer">
    <!-- Toolbar -->
    <div class="image-viewer__toolbar">
      <q-btn
        flat
        dense
        round
        icon="zoom_out"
        :disable="zoomIndex <= 0"
        @click="zoomOut"
      >
        <q-tooltip>Zoom Out</q-tooltip>
      </q-btn>
      <span class="image-viewer__zoom-level">{{ zoomLevel }}%</span>
      <q-btn
        flat
        dense
        round
        icon="zoom_in"
        :disable="zoomIndex >= ZOOM_LEVELS.length - 1"
        @click="zoomIn"
      >
        <q-tooltip>Zoom In</q-tooltip>
      </q-btn>
      <q-separator
        vertical
        spaced
      />
      <q-btn
        flat
        dense
        round
        icon="fit_screen"
        @click="fitToWindow"
      >
        <q-tooltip>Fit to Window</q-tooltip>
      </q-btn>
      <q-btn
        flat
        dense
        round
        icon="crop_free"
        @click="resetZoom"
      >
        <q-tooltip>Reset (100%)</q-tooltip>
      </q-btn>
      <q-separator
        vertical
        spaced
      />
      <span class="image-viewer__info">{{ imageInfo }}</span>
    </div>

    <!-- Image container -->
    <div
      ref="containerRef"
      class="image-viewer__container"
      :class="{ 'image-viewer__container--grabbing': isPanning }"
      @wheel.prevent="handleWheel"
      @mousedown="startPan"
      @mousemove="doPan"
      @mouseup="endPan"
      @mouseleave="endPan"
    >
      <div
        v-if="!hasError && isLoading"
        class="image-viewer__loading"
      >
        <q-spinner
          size="48px"
          color="primary"
        />
      </div>

      <img
        v-show="!hasError && !isLoading"
        ref="imageRef"
        :src="imageUrl"
        :style="imageStyle"
        class="image-viewer__image"
        @load="onImageLoad"
        @error="onImageError"
      />

      <!-- Error state -->
      <div
        v-if="hasError"
        class="image-viewer__error"
      >
        <q-icon
          name="broken_image"
          size="64px"
          color="grey-6"
        />
        <p class="image-viewer__error-text">Failed to load image</p>
        <p class="image-viewer__error-file">{{ fileName }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useUIStore } from 'src/stores/uiStore';

/**
 * ImageViewer - Displays images with zoom and pan controls
 */

interface Props {
  /** Full path to the image file */
  filePath: string;
  /** Display name of the file */
  fileName: string;
  /** Optional MIME type */
  mimeType?: string;
}

const props = defineProps<Props>();

const uiStore = useUIStore();

// Zoom levels available
const ZOOM_LEVELS = [10, 25, 50, 75, 100, 150, 200, 300, 400];
const DEFAULT_ZOOM_INDEX = 4; // 100%

// Refs
const containerRef = ref<HTMLDivElement | null>(null);
const imageRef = ref<HTMLImageElement | null>(null);

// State
const isLoading = ref(true);
const hasError = ref(false);
const zoomIndex = ref(DEFAULT_ZOOM_INDEX);
const imageWidth = ref(0);
const imageHeight = ref(0);
const fileSize = ref<string>('');
const imageDataUrl = ref<string>('');

// Pan state
const isPanning = ref(false);
const panStart = ref({ x: 0, y: 0 });
const panOffset = ref({ x: 0, y: 0 });
const currentPanOffset = ref({ x: 0, y: 0 });

// The image URL comes from the loaded data URL
const imageUrl = computed(() => imageDataUrl.value);

const zoomLevel = computed(() => ZOOM_LEVELS[zoomIndex.value] ?? 100);

const imageStyle = computed(() => {
  const scale = zoomLevel.value / 100;
  const translateX = currentPanOffset.value.x;
  const translateY = currentPanOffset.value.y;

  return {
    transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
    transformOrigin: 'center center',
    cursor: zoomLevel.value > 100 ? (isPanning.value ? 'grabbing' : 'grab') : 'default',
  };
});

const imageInfo = computed(() => {
  const parts: string[] = [];

  if (imageWidth.value && imageHeight.value) {
    parts.push(`${imageWidth.value} x ${imageHeight.value}`);
  }

  if (fileSize.value) {
    parts.push(fileSize.value);
  }

  return parts.join(' | ') || props.fileName;
});

// Methods
function zoomIn(): void {
  if (zoomIndex.value < ZOOM_LEVELS.length - 1) {
    zoomIndex.value++;
  }
}

function zoomOut(): void {
  if (zoomIndex.value > 0) {
    zoomIndex.value--;
  }
}

function resetZoom(): void {
  zoomIndex.value = DEFAULT_ZOOM_INDEX;
  currentPanOffset.value = { x: 0, y: 0 };
  panOffset.value = { x: 0, y: 0 };
}

function fitToWindow(): void {
  if (!containerRef.value || !imageWidth.value || !imageHeight.value) return;

  const containerRect = containerRef.value.getBoundingClientRect();
  const containerWidth = containerRect.width - 40; // Padding
  const containerHeight = containerRect.height - 40;

  const widthRatio = containerWidth / imageWidth.value;
  const heightRatio = containerHeight / imageHeight.value;
  const fitRatio = Math.min(widthRatio, heightRatio, 1) * 100;

  // Find the closest zoom level
  let closestIndex = 0;
  let closestDiff = Math.abs(ZOOM_LEVELS[0] - fitRatio);

  for (let i = 1; i < ZOOM_LEVELS.length; i++) {
    const diff = Math.abs(ZOOM_LEVELS[i] - fitRatio);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestIndex = i;
    }
  }

  zoomIndex.value = closestIndex;
  currentPanOffset.value = { x: 0, y: 0 };
  panOffset.value = { x: 0, y: 0 };
}

function handleWheel(event: WheelEvent): void {
  // Zoom with scroll wheel
  if (event.deltaY < 0) {
    zoomIn();
  } else {
    zoomOut();
  }
}

function startPan(event: MouseEvent): void {
  // Only pan when zoomed in beyond 100%
  if (zoomLevel.value <= 100) return;

  isPanning.value = true;
  panStart.value = { x: event.clientX, y: event.clientY };
}

function doPan(event: MouseEvent): void {
  if (!isPanning.value) return;

  const deltaX = event.clientX - panStart.value.x;
  const deltaY = event.clientY - panStart.value.y;

  currentPanOffset.value = {
    x: panOffset.value.x + deltaX,
    y: panOffset.value.y + deltaY,
  };
}

function endPan(): void {
  if (isPanning.value) {
    panOffset.value = { ...currentPanOffset.value };
    isPanning.value = false;
  }
}

function onImageLoad(): void {
  isLoading.value = false;
  hasError.value = false;

  if (imageRef.value) {
    imageWidth.value = imageRef.value.naturalWidth;
    imageHeight.value = imageRef.value.naturalHeight;
  }

  // Try to get file size through IPC if available
  void loadFileSize();
}

function onImageError(): void {
  isLoading.value = false;
  hasError.value = true;
}

async function loadFileSize(): Promise<void> {
  try {
    // Check if fileSystemAPI is available
    const getStats = window.fileSystemAPI?.getFileStats as
      | ((path: string) => Promise<{ size?: number } | null>)
      | undefined;
    if (getStats) {
      const stats = await getStats(props.filePath);
      if (stats && typeof stats.size === 'number' && stats.size > 0) {
        fileSize.value = formatFileSize(stats.size);
      }
    }
  } catch {
    // Silently ignore - file size is optional info
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

// Keyboard shortcuts
function handleKeydown(event: KeyboardEvent): void {
  if (event.key === '+' || event.key === '=') {
    zoomIn();
  } else if (event.key === '-') {
    zoomOut();
  } else if (event.key === '0') {
    resetZoom();
  }
}

// Load image as data URL via IPC (required for Electron security)
async function loadImage(): Promise<void> {
  isLoading.value = true;
  hasError.value = false;

  try {
    if (window.fileSystemAPI?.readFileAsDataUrl) {
      const dataUrl = await window.fileSystemAPI.readFileAsDataUrl(props.filePath, props.mimeType);
      imageDataUrl.value = dataUrl;
    } else {
      // Fallback for non-Electron environment (won't work for local files)
      const encodedPath = props.filePath.split('/').map(encodeURIComponent).join('/');
      imageDataUrl.value = `file://${encodedPath}`;
    }
  } catch (err) {
    // Check if file not found (ENOENT) - close the tab
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
      console.warn('Image file not found, closing tab:', props.filePath);
      uiStore.closeTab(props.filePath);
      return;
    }

    console.error('Failed to load image:', err);
    hasError.value = true;
    isLoading.value = false;
  }
}

// Reload image when filePath changes
watch(
  () => props.filePath,
  () => {
    void loadImage();
  }
);

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  void loadImage();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<style lang="scss" scoped>
.image-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--q-dark-page, #121212);

  .body--light & {
    background-color: #f0f0f0;
  }
}

.image-viewer__toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background-color: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;

  .body--light & {
    background-color: rgba(255, 255, 255, 0.9);
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }
}

.image-viewer__zoom-level {
  min-width: 50px;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);

  .body--light & {
    color: rgba(0, 0, 0, 0.8);
  }
}

.image-viewer__info {
  margin-left: auto;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  .body--light & {
    color: rgba(0, 0, 0, 0.6);
  }
}

.image-viewer__container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;

  // Checkerboard background for transparency
  background-color: #1a1a1a;
  background-image:
    linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
    linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
    linear-gradient(-45deg, transparent 75%, #2a2a2a 75%);
  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0px;

  .body--light & {
    background-color: #e0e0e0;
    background-image:
      linear-gradient(45deg, #d0d0d0 25%, transparent 25%),
      linear-gradient(-45deg, #d0d0d0 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #d0d0d0 75%),
      linear-gradient(-45deg, transparent 75%, #d0d0d0 75%);
  }

  &--grabbing {
    cursor: grabbing !important;
  }
}

.image-viewer__image {
  max-width: none;
  max-height: none;
  transition: transform 0.15s ease-out;
  user-select: none;
  -webkit-user-drag: none;
}

.image-viewer__loading {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-viewer__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
}

.image-viewer__error-text {
  margin: 0;
  font-size: 1.1rem;
  color: var(--q-grey-6, #757575);
}

.image-viewer__error-file {
  margin: 0;
  font-size: 0.85rem;
  color: var(--q-grey-7, #616161);
  font-family: monospace;
  word-break: break-all;
  max-width: 300px;
}
</style>
