<template>
  <div class="audio-player">
    <!-- Hidden audio element -->
    <audio
      ref="audioRef"
      :src="audioUrl"
      preload="metadata"
      @loadedmetadata="onLoad"
      @timeupdate="onTimeUpdate"
      @ended="onEnded"
      @error="onError"
    />

    <!-- Player card -->
    <div
      v-if="!hasError"
      class="audio-player__card"
    >
      <!-- Artwork / Icon -->
      <div class="audio-player__artwork">
        <q-icon
          name="music_note"
          size="96px"
          color="primary"
        />
      </div>

      <!-- File name -->
      <div class="audio-player__title">{{ fileName }}</div>

      <!-- Progress -->
      <div class="audio-player__progress">
        <span class="audio-player__time">{{ formatTime(currentTime) }}</span>
        <div class="audio-player__progress-bar-container">
          <input
            type="range"
            class="audio-player__progress-bar"
            :value="currentTime"
            :max="duration"
            step="0.1"
            @input="onSeek"
          />
          <div
            class="audio-player__progress-filled"
            :style="{ width: progressPercent + '%' }"
          />
        </div>
        <span class="audio-player__time">{{ formatTime(duration) }}</span>
      </div>

      <!-- Controls -->
      <div class="audio-player__controls">
        <q-btn
          flat
          round
          icon="replay_10"
          size="md"
          @click="seek(-10)"
        >
          <q-tooltip>Rewind 10s</q-tooltip>
        </q-btn>
        <q-btn
          round
          color="primary"
          size="lg"
          :icon="isPlaying ? 'pause' : 'play_arrow'"
          @click="togglePlay"
        >
          <q-tooltip>{{ isPlaying ? 'Pause' : 'Play' }}</q-tooltip>
        </q-btn>
        <q-btn
          flat
          round
          icon="forward_10"
          size="md"
          @click="seek(10)"
        >
          <q-tooltip>Forward 10s</q-tooltip>
        </q-btn>
      </div>

      <!-- Volume slider -->
      <div class="audio-player__volume">
        <q-btn
          flat
          round
          dense
          :icon="volumeIcon"
          @click="toggleMute"
        />
        <input
          type="range"
          class="audio-player__volume-slider"
          :value="volume"
          min="0"
          max="100"
          @input="onVolumeChange"
        />
      </div>
    </div>

    <!-- Error state -->
    <div
      v-if="hasError"
      class="audio-player__error"
    >
      <q-icon
        name="error_outline"
        size="64px"
        color="grey-6"
      />
      <p class="audio-player__error-text">Unable to play this audio format</p>
      <p class="audio-player__error-file">{{ fileName }}</p>
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
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useUIStore } from 'src/stores/uiStore';

/**
 * AudioPlayer - Plays audio files with a music-player-like interface
 */

interface Props {
  /** Full path to the audio file */
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
const audioRef = ref<HTMLAudioElement | null>(null);

// State
const isPlaying = ref(false);
const hasError = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const volume = ref(100);
const isMuted = ref(false);

// Computed
const audioUrl = computed(() => {
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
  if (!audioRef.value || hasError.value) return;

  if (isPlaying.value) {
    audioRef.value.pause();
    isPlaying.value = false;
  } else {
    void audioRef.value.play();
    isPlaying.value = true;
  }
}

function toggleMute(): void {
  if (!audioRef.value) return;

  isMuted.value = !isMuted.value;
  audioRef.value.muted = isMuted.value;
}

function onLoad(): void {
  if (audioRef.value) {
    duration.value = audioRef.value.duration;
  }
}

function onTimeUpdate(): void {
  if (audioRef.value) {
    currentTime.value = audioRef.value.currentTime;
  }
}

function onEnded(): void {
  isPlaying.value = false;
  currentTime.value = 0;
  if (audioRef.value) {
    audioRef.value.currentTime = 0;
  }
}

async function onError(): Promise<void> {
  // Check if file exists - if not, close the tab
  try {
    if (window.fileSystemAPI?.getFileInfo) {
      const fileInfo = await window.fileSystemAPI.getFileInfo(props.filePath);
      if (!fileInfo) {
        console.warn('Audio file not found, closing tab:', props.filePath);
        uiStore.closeTab(props.filePath);
        return;
      }
    }
  } catch {
    // File doesn't exist, close the tab
    console.warn('Audio file not found, closing tab:', props.filePath);
    uiStore.closeTab(props.filePath);
    return;
  }

  hasError.value = true;
}

function onSeek(event: Event): void {
  const target = event.target as HTMLInputElement;
  const time = parseFloat(target.value);

  if (audioRef.value) {
    audioRef.value.currentTime = time;
    currentTime.value = time;
  }
}

function onVolumeChange(event: Event): void {
  const target = event.target as HTMLInputElement;
  volume.value = parseInt(target.value);

  if (audioRef.value) {
    audioRef.value.volume = volume.value / 100;
    isMuted.value = volume.value === 0;
  }
}

function seek(delta: number): void {
  if (audioRef.value) {
    const newTime = Math.max(0, Math.min(duration.value, currentTime.value + delta));
    audioRef.value.currentTime = newTime;
    currentTime.value = newTime;
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
      if (audioRef.value) audioRef.value.volume = volume.value / 100;
      break;
    case 'ArrowDown':
      event.preventDefault();
      volume.value = Math.max(0, volume.value - 10);
      if (audioRef.value) audioRef.value.volume = volume.value / 100;
      break;
    case 'm':
    case 'M':
      toggleMute();
      break;
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);

  // Stop playback when component unmounts
  if (audioRef.value) {
    audioRef.value.pause();
  }
});
</script>

<style lang="scss" scoped>
.audio-player {
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

.audio-player__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 32px;
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

.audio-player__artwork {
  width: 160px;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(124, 58, 237, 0.1));
  border-radius: 12px;

  .body--light & {
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(124, 58, 237, 0.05));
  }
}

.audio-player__title {
  font-size: 1.1rem;
  font-weight: 500;
  text-align: center;
  color: rgba(255, 255, 255, 0.9);
  word-break: break-word;
  max-width: 100%;

  .body--light & {
    color: rgba(0, 0, 0, 0.85);
  }
}

.audio-player__progress {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.audio-player__progress-bar-container {
  flex: 1;
  position: relative;
  height: 6px;
}

.audio-player__progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  cursor: pointer;
  z-index: 2;

  .body--light & {
    background: rgba(0, 0, 0, 0.1);
  }

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    background: var(--q-primary, #7c3aed);
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  &::-moz-range-thumb {
    width: 14px;
    height: 14px;
    background: var(--q-primary, #7c3aed);
    border-radius: 50%;
    border: none;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  &::-webkit-slider-runnable-track {
    height: 6px;
    background: transparent;
  }

  &::-moz-range-track {
    height: 6px;
    background: transparent;
  }
}

.audio-player__progress-filled {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--q-primary, #7c3aed);
  border-radius: 3px;
  pointer-events: none;
  z-index: 1;
}

.audio-player__time {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  font-variant-numeric: tabular-nums;
  min-width: 40px;
  text-align: center;

  .body--light & {
    color: rgba(0, 0, 0, 0.5);
  }
}

.audio-player__controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.audio-player__volume {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 200px;
}

.audio-player__volume-slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  cursor: pointer;

  .body--light & {
    background: rgba(0, 0, 0, 0.1);
  }

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    background: var(--q-primary, #7c3aed);
    border-radius: 50%;
    cursor: pointer;
  }

  &::-moz-range-thumb {
    width: 12px;
    height: 12px;
    background: var(--q-primary, #7c3aed);
    border-radius: 50%;
    border: none;
    cursor: pointer;
  }
}

.audio-player__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
}

.audio-player__error-text {
  margin: 0;
  font-size: 1.1rem;
  color: var(--q-grey-6, #757575);
}

.audio-player__error-file {
  margin: 0;
  font-size: 0.85rem;
  color: var(--q-grey-7, #616161);
  font-family: monospace;
  word-break: break-all;
  max-width: 300px;
}
</style>
