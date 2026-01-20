<template>
  <div
    ref="playerRef"
    class="video-player"
    :class="{ 'video-player--fullscreen': isFullscreen }"
    @mousemove="showControlsTemporarily"
    @mouseleave="hideControlsDelayed"
  >
    <!-- Video element -->
    <video
      ref="videoRef"
      class="video-player__video"
      :src="videoUrl"
      preload="metadata"
      @loadedmetadata="onMetadataLoaded"
      @timeupdate="onTimeUpdate"
      @ended="onEnded"
      @error="onError"
      @waiting="isBuffering = true"
      @canplay="isBuffering = false"
      @click="togglePlay"
      @dblclick="toggleFullscreen"
    />

    <!-- Loading/Buffering state -->
    <div
      v-if="isBuffering && !hasError"
      class="video-player__loading"
    >
      <q-spinner
        size="48px"
        color="white"
      />
    </div>

    <!-- Play button overlay (when paused) -->
    <div
      v-if="!isPlaying && !hasError && !isBuffering && duration > 0"
      class="video-player__play-overlay"
      @click="togglePlay"
    >
      <q-btn
        round
        color="white"
        text-color="dark"
        size="xl"
        icon="play_arrow"
      />
    </div>

    <!-- Custom controls overlay -->
    <div
      v-if="!hasError"
      class="video-player__controls"
      :class="{ 'video-player__controls--visible': showControls || !isPlaying }"
      @click.stop
    >
      <!-- Progress bar -->
      <div class="video-player__progress-container">
        <input
          type="range"
          class="video-player__progress"
          :value="currentTime"
          :max="duration"
          step="0.1"
          @input="onSeek"
          @mousedown="isSeeking = true"
          @mouseup="isSeeking = false"
        />
        <div
          class="video-player__progress-filled"
          :style="{ width: progressPercent + '%' }"
        />
      </div>

      <div class="video-player__controls-row">
        <!-- Play/Pause -->
        <q-btn
          flat
          round
          dense
          color="white"
          :icon="isPlaying ? 'pause' : 'play_arrow'"
          @click="togglePlay"
        />

        <!-- Volume -->
        <q-btn
          flat
          round
          dense
          color="white"
          :icon="volumeIcon"
          @click="toggleMute"
        />
        <input
          type="range"
          class="video-player__volume"
          :value="volume"
          min="0"
          max="100"
          @input="onVolumeChange"
        />

        <!-- Time display -->
        <span class="video-player__time">
          {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
        </span>

        <!-- Spacer -->
        <div class="video-player__spacer" />

        <!-- Fullscreen -->
        <q-btn
          flat
          round
          dense
          color="white"
          :icon="isFullscreen ? 'fullscreen_exit' : 'fullscreen'"
          @click="toggleFullscreen"
        />
      </div>
    </div>

    <!-- Error state -->
    <div
      v-if="hasError"
      class="video-player__error"
    >
      <q-icon
        name="error_outline"
        size="64px"
        color="grey-6"
      />
      <p class="video-player__error-text">Unable to play this video format</p>
      <p class="video-player__error-file">{{ fileName }}</p>
      <q-btn
        outline
        color="primary"
        label="Show in Finder"
        icon="folder_open"
        @click="showInFinder"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useUIStore } from 'src/stores/uiStore';

/**
 * VideoPlayer - Plays video files with custom controls
 */

interface Props {
  /** Full path to the video file */
  filePath: string;
  /** Display name of the file */
  fileName: string;
  /** Optional MIME type */
  mimeType?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'showInFinder', filePath: string): void;
}>();

const uiStore = useUIStore();

// Refs
const playerRef = ref<HTMLDivElement | null>(null);
const videoRef = ref<HTMLVideoElement | null>(null);

// State
const isPlaying = ref(false);
const isBuffering = ref(false);
const hasError = ref(false);
const isSeeking = ref(false);
const isFullscreen = ref(false);
const showControls = ref(true);
const currentTime = ref(0);
const duration = ref(0);
const volume = ref(100);
const isMuted = ref(false);

let hideControlsTimeout: ReturnType<typeof setTimeout> | null = null;

// Computed
const videoUrl = computed(() => {
  // Convert file path to file:// URL
  const encodedPath = props.filePath.split('/').map(encodeURIComponent).join('/');
  return `file://${encodedPath}`;
});

const progressPercent = computed(() => {
  if (duration.value === 0) return 0;
  return (currentTime.value / duration.value) * 100;
});

const volumeIcon = computed(() => {
  if (isMuted.value || volume.value === 0) return 'volume_off';
  if (volume.value < 50) return 'volume_down';
  return 'volume_up';
});

// Methods
function togglePlay(): void {
  if (!videoRef.value || hasError.value) return;

  if (isPlaying.value) {
    videoRef.value.pause();
  } else {
    void videoRef.value.play();
  }
  isPlaying.value = !isPlaying.value;
}

function toggleMute(): void {
  if (!videoRef.value) return;

  isMuted.value = !isMuted.value;
  videoRef.value.muted = isMuted.value;
}

function toggleFullscreen(): void {
  if (!playerRef.value) return;

  if (!isFullscreen.value) {
    if (playerRef.value.requestFullscreen) {
      void playerRef.value.requestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      void document.exitFullscreen();
    }
  }
}

function onMetadataLoaded(): void {
  if (videoRef.value) {
    duration.value = videoRef.value.duration;
  }
}

function onTimeUpdate(): void {
  if (videoRef.value && !isSeeking.value) {
    currentTime.value = videoRef.value.currentTime;
  }
}

function onEnded(): void {
  isPlaying.value = false;
}

async function onError(): Promise<void> {
  // Check if file exists - if not, close the tab
  try {
    if (window.fileSystemAPI?.getFileInfo) {
      const fileInfo = await window.fileSystemAPI.getFileInfo(props.filePath);
      if (!fileInfo) {
        console.warn('Video file not found, closing tab:', props.filePath);
        uiStore.closeTab(props.filePath);
        return;
      }
    }
  } catch {
    // File doesn't exist, close the tab
    console.warn('Video file not found, closing tab:', props.filePath);
    uiStore.closeTab(props.filePath);
    return;
  }

  hasError.value = true;
  isBuffering.value = false;
}

function onSeek(event: Event): void {
  const target = event.target as HTMLInputElement;
  const time = parseFloat(target.value);

  if (videoRef.value) {
    videoRef.value.currentTime = time;
    currentTime.value = time;
  }
}

function onVolumeChange(event: Event): void {
  const target = event.target as HTMLInputElement;
  volume.value = parseInt(target.value);

  if (videoRef.value) {
    videoRef.value.volume = volume.value / 100;
    isMuted.value = volume.value === 0;
  }
}

function showControlsTemporarily(): void {
  showControls.value = true;

  if (hideControlsTimeout) {
    clearTimeout(hideControlsTimeout);
  }

  if (isPlaying.value) {
    hideControlsTimeout = setTimeout(() => {
      showControls.value = false;
    }, 3000);
  }
}

function hideControlsDelayed(): void {
  if (isPlaying.value) {
    hideControlsTimeout = setTimeout(() => {
      showControls.value = false;
    }, 1000);
  }
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function showInFinder(): void {
  emit('showInFinder', props.filePath);

  // Also try to use the external apps API if available
  if (window.externalAppsAPI?.showInFolder) {
    void window.externalAppsAPI.showInFolder(props.filePath);
  }
}

function seek(delta: number): void {
  if (videoRef.value) {
    const newTime = Math.max(0, Math.min(duration.value, currentTime.value + delta));
    videoRef.value.currentTime = newTime;
    currentTime.value = newTime;
  }
}

// Keyboard shortcuts
function handleKeydown(event: KeyboardEvent): void {
  // Ignore if user is typing in an input
  if (event.target instanceof HTMLInputElement) return;

  switch (event.key) {
    case ' ':
      event.preventDefault();
      togglePlay();
      break;
    case 'ArrowLeft':
      event.preventDefault();
      seek(-5);
      break;
    case 'ArrowRight':
      event.preventDefault();
      seek(5);
      break;
    case 'ArrowUp':
      event.preventDefault();
      volume.value = Math.min(100, volume.value + 10);
      if (videoRef.value) videoRef.value.volume = volume.value / 100;
      break;
    case 'ArrowDown':
      event.preventDefault();
      volume.value = Math.max(0, volume.value - 10);
      if (videoRef.value) videoRef.value.volume = volume.value / 100;
      break;
    case 'm':
    case 'M':
      toggleMute();
      break;
    case 'f':
    case 'F':
      toggleFullscreen();
      break;
  }
}

function handleFullscreenChange(): void {
  isFullscreen.value = !!document.fullscreenElement;
}

// Watch for isPlaying changes to manage controls visibility
watch(isPlaying, (playing) => {
  if (!playing) {
    showControls.value = true;
    if (hideControlsTimeout) {
      clearTimeout(hideControlsTimeout);
    }
  }
});

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  document.addEventListener('fullscreenchange', handleFullscreenChange);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('fullscreenchange', handleFullscreenChange);

  if (hideControlsTimeout) {
    clearTimeout(hideControlsTimeout);
  }
});
</script>

<style lang="scss" scoped>
.video-player {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background-color: #000;
  overflow: hidden;

  &--fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 9999;
  }
}

.video-player__video {
  max-width: 100%;
  max-height: 100%;
  cursor: pointer;
}

.video-player__loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
}

.video-player__play-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  cursor: pointer;

  .q-btn {
    opacity: 0.9;

    &:hover {
      opacity: 1;
    }
  }
}

.video-player__controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  padding: 20px 12px 12px;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 20;

  &--visible {
    opacity: 1;
  }
}

.video-player__progress-container {
  position: relative;
  width: 100%;
  height: 4px;
  margin-bottom: 8px;
  cursor: pointer;
}

.video-player__progress {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  cursor: pointer;
  z-index: 2;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    background: #fff;
    border-radius: 50%;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s;
  }

  &:hover::-webkit-slider-thumb {
    opacity: 1;
  }

  &::-moz-range-thumb {
    width: 12px;
    height: 12px;
    background: #fff;
    border-radius: 50%;
    border: none;
    cursor: pointer;
  }

  &::-webkit-slider-runnable-track {
    height: 4px;
    background: transparent;
  }

  &::-moz-range-track {
    height: 4px;
    background: transparent;
  }
}

.video-player__progress-filled {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--q-primary, #7c3aed);
  border-radius: 2px;
  pointer-events: none;
  z-index: 1;
}

.video-player__controls-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.video-player__volume {
  width: 80px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    background: #fff;
    border-radius: 50%;
    cursor: pointer;
  }

  &::-moz-range-thumb {
    width: 12px;
    height: 12px;
    background: #fff;
    border-radius: 50%;
    border: none;
    cursor: pointer;
  }
}

.video-player__time {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.9);
  font-variant-numeric: tabular-nums;
  min-width: 90px;
}

.video-player__spacer {
  flex: 1;
}

.video-player__error {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
  background-color: rgba(0, 0, 0, 0.9);
}

.video-player__error-text {
  margin: 0;
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.7);
}

.video-player__error-file {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.5);
  font-family: monospace;
  word-break: break-all;
  max-width: 300px;
}
</style>
