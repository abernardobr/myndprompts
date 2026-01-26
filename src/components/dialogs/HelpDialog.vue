<script setup lang="ts">
/**
 * HelpDialog Component
 *
 * Dialog for displaying help videos from YouTube playlist.
 * Shows on first app launch with option to disable future auto-show.
 */

import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ConfigKeys, getConfigRepository } from '@/services/storage/repositories/config.repository';

interface Props {
  modelValue: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n({ useScope: 'global' });

const dontShowAgain = ref(false);

// YouTube playlist URL
const YOUTUBE_PLAYLIST_URL =
  'https://www.youtube.com/playlist?list=PLoX2c-TEp-0aAcL1cyq0TV5tsEQJ_VNCd';

// Load saved preference when dialog opens
watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen) {
      const configRepository = getConfigRepository();
      const saved = await configRepository.get<boolean>(ConfigKeys.HELP_DIALOG_DONT_SHOW);
      dontShowAgain.value = saved ?? false;
    }
  }
);

async function handleClose(): Promise<void> {
  // Save preference if changed
  if (dontShowAgain.value) {
    const configRepository = getConfigRepository();
    await configRepository.set(ConfigKeys.HELP_DIALOG_DONT_SHOW, true);
  }
  emit('update:modelValue', false);
}

async function handleDontShowChange(value: boolean): Promise<void> {
  dontShowAgain.value = value;
  const configRepository = getConfigRepository();
  await configRepository.set(ConfigKeys.HELP_DIALOG_DONT_SHOW, value);
}

function openYouTubePlaylist(): void {
  void window.updateAPI?.openDownloadPage(YOUTUBE_PLAYLIST_URL);
}
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card class="help-dialog">
      <!-- Header -->
      <q-card-section class="row items-center q-pb-none">
        <q-icon
          name="help_outline"
          color="primary"
          size="24px"
          class="q-mr-sm"
        />
        <div class="text-h6">{{ t('dialogs.help.title') }}</div>
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

      <!-- Content -->
      <q-card-section class="q-pt-md">
        <p class="text-body2 text-grey-7 q-mb-md">
          {{ t('dialogs.help.description') }}
        </p>

        <!-- YouTube Playlist Link -->
        <div
          class="help-dialog__video-container"
          @click="openYouTubePlaylist"
        >
          <div class="help-dialog__video-overlay">
            <q-icon
              name="smart_display"
              size="64px"
              color="red"
            />
            <div class="help-dialog__video-text">
              <span class="text-h6">{{ t('dialogs.help.watchOnYouTube') }}</span>
              <span class="text-caption text-grey-5">{{ t('dialogs.help.clickToOpen') }}</span>
            </div>
          </div>
        </div>
      </q-card-section>

      <!-- Actions -->
      <q-card-actions class="q-px-md q-pb-md help-dialog__actions">
        <q-checkbox
          :model-value="dontShowAgain"
          :label="t('dialogs.help.dontShowAgain')"
          dense
          @update:model-value="handleDontShowChange"
        />
        <q-space />
        <q-btn
          unelevated
          :label="t('dialogs.help.close')"
          color="primary"
          @click="handleClose"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style lang="scss" scoped>
.help-dialog {
  min-width: 520px;
  max-width: 600px;

  &__video-container {
    position: relative;
    width: 100%;
    height: 180px;
    overflow: hidden;
    border-radius: 8px;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      transform: scale(1.02);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    }

    &:hover .help-dialog__video-overlay {
      background: rgba(0, 0, 0, 0.5);
    }
  }

  &__video-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: rgba(0, 0, 0, 0.3);
    transition: background 0.2s ease;
  }

  &__video-text {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    color: white;
  }

  &__actions {
    display: flex;
    align-items: center;
  }
}
</style>
