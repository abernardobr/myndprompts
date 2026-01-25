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

        <!-- YouTube Embed -->
        <div class="help-dialog__video-container">
          <iframe
            width="560"
            height="315"
            src="https://www.youtube.com/embed/videoseries?si=8N4-LxVDBN2q2PWZ&list=PLoX2c-TEp-0aAcL1cyq0TV5tsEQJ_VNCd"
            title="MyndPrompts Help Videos"
            frameborder="0"
            allow="
              accelerometer;
              autoplay;
              clipboard-write;
              encrypted-media;
              gyroscope;
              picture-in-picture;
              web-share;
            "
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen
          />
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
  min-width: 620px;
  max-width: 700px;

  &__video-container {
    position: relative;
    width: 100%;
    padding-bottom: 56.25%; /* 16:9 aspect ratio */
    height: 0;
    overflow: hidden;
    border-radius: 8px;
    background-color: #000;

    iframe {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: none;
    }
  }

  &__actions {
    display: flex;
    align-items: center;
  }
}
</style>
