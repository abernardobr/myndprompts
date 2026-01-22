<script setup lang="ts">
/**
 * UpdateDialog Component
 *
 * Dialog for displaying update information and actions.
 * States: checking, update-available, up-to-date, error
 */

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

interface IUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  downloadUrl?: string;
}

interface Props {
  modelValue: boolean;
  updateInfo: IUpdateInfo | null;
  isChecking: boolean;
  error: string | null;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'download'): void;
  (e: 'remind-later'): void;
  (e: 'skip-version'): void;
  (e: 'retry'): void;
}

const props = withDefaults(defineProps<Props>(), {
  updateInfo: null,
  error: null,
});
const emit = defineEmits<Emits>();

const { t } = useI18n({ useScope: 'global' });

// Determine the current state
const state = computed(() => {
  if (props.isChecking) return 'checking';
  if (props.error) return 'error';
  if (props.updateInfo?.updateAvailable) return 'update-available';
  return 'up-to-date';
});

// Dialog title based on state
const dialogTitle = computed(() => {
  switch (state.value) {
    case 'checking':
      return t('dialogs.update.checking');
    case 'error':
      return t('dialogs.update.errorTitle');
    case 'update-available':
      return t('dialogs.update.available');
    default:
      return t('dialogs.update.upToDate');
  }
});

// Icon based on state
const stateIcon = computed(() => {
  switch (state.value) {
    case 'checking':
      return 'sync';
    case 'error':
      return 'error_outline';
    case 'update-available':
      return 'system_update';
    default:
      return 'check_circle';
  }
});

// Icon color based on state
const iconColor = computed(() => {
  switch (state.value) {
    case 'checking':
      return 'primary';
    case 'error':
      return 'negative';
    case 'update-available':
      return 'primary';
    default:
      return 'positive';
  }
});

function handleClose(): void {
  emit('update:modelValue', false);
}

function handleDownload(): void {
  emit('download');
}

function handleRemindLater(): void {
  emit('remind-later');
}

function handleSkipVersion(): void {
  emit('skip-version');
}

function handleRetry(): void {
  emit('retry');
}
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card
      class="update-dialog"
      data-testid="update-dialog"
    >
      <!-- Header -->
      <q-card-section class="row items-center q-pb-none">
        <q-icon
          :name="stateIcon"
          :color="iconColor"
          size="24px"
          class="q-mr-sm"
          :class="{ 'update-dialog__spin': state === 'checking' }"
        />
        <div class="text-h6">{{ dialogTitle }}</div>
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
      <q-card-section class="q-pt-lg">
        <!-- Checking state -->
        <div
          v-if="state === 'checking'"
          class="update-dialog__checking"
        >
          <q-spinner-dots
            color="primary"
            size="40px"
          />
          <p class="text-body2 q-mt-md text-center text-grey-7">
            {{ t('dialogs.update.checking') }}
          </p>
        </div>

        <!-- Error state -->
        <div
          v-else-if="state === 'error'"
          class="update-dialog__error"
        >
          <q-icon
            name="cloud_off"
            size="48px"
            color="grey-5"
          />
          <p class="text-body2 q-mt-md text-center text-grey-7">
            {{ error }}
          </p>
        </div>

        <!-- Update available state -->
        <div
          v-else-if="state === 'update-available'"
          class="update-dialog__content"
        >
          <p class="text-body1 q-mb-md">
            {{ t('dialogs.update.newVersion') }}
          </p>

          <div class="update-dialog__versions">
            <div class="update-dialog__version-row">
              <span class="text-grey-7">{{ t('dialogs.update.currentVersion') }}:</span>
              <span class="text-weight-medium">{{ updateInfo?.currentVersion }}</span>
            </div>
            <div class="update-dialog__version-row">
              <span class="text-grey-7">{{ t('dialogs.update.latestVersion') }}:</span>
              <span class="text-weight-medium text-primary">{{ updateInfo?.latestVersion }}</span>
            </div>
          </div>
        </div>

        <!-- Up to date state -->
        <div
          v-else
          class="update-dialog__uptodate"
        >
          <q-icon
            name="check_circle"
            size="48px"
            color="positive"
          />
          <p class="text-body1 q-mt-md text-center">
            {{ t('dialogs.update.upToDateMessage') }}
          </p>
          <p
            v-if="updateInfo"
            class="text-caption text-grey-7 text-center q-mt-sm"
          >
            {{ t('dialogs.update.currentVersion') }}: {{ updateInfo.currentVersion }}
          </p>
        </div>
      </q-card-section>

      <!-- Actions -->
      <q-card-actions
        align="right"
        class="q-px-md q-pb-md"
      >
        <!-- Error actions -->
        <template v-if="state === 'error'">
          <q-btn
            flat
            :label="t('dialogs.update.close')"
            color="grey"
            @click="handleClose"
          />
          <q-btn
            unelevated
            :label="t('dialogs.update.retry')"
            color="primary"
            @click="handleRetry"
          />
        </template>

        <!-- Update available actions -->
        <template v-else-if="state === 'update-available'">
          <q-btn
            flat
            :label="t('dialogs.update.skipVersion')"
            color="grey"
            size="sm"
            @click="handleSkipVersion"
          />
          <q-btn
            flat
            :label="t('dialogs.update.remindLater')"
            color="grey"
            @click="handleRemindLater"
          />
          <q-btn
            unelevated
            :label="t('dialogs.update.downloadBtn')"
            color="primary"
            icon="download"
            @click="handleDownload"
          />
        </template>

        <!-- Up to date / Checking actions -->
        <template v-else>
          <q-btn
            flat
            :label="t('dialogs.update.close')"
            color="grey"
            :disable="state === 'checking'"
            @click="handleClose"
          />
        </template>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style lang="scss" scoped>
.update-dialog {
  min-width: 400px;
  max-width: 500px;

  &__spin {
    animation: spin 1.5s linear infinite;
  }

  &__checking {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px 0;
  }

  &__error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px 0;
  }

  &__content {
    padding: 8px 0;
  }

  &__versions {
    background-color: var(--versions-bg, rgba(0, 0, 0, 0.05));
    border-radius: 8px;
    padding: 16px;
  }

  &__version-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;

    &:not(:last-child) {
      border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
    }
  }

  &__uptodate {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px 0;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

// Dark theme
.body--dark .update-dialog {
  &__versions {
    --versions-bg: rgba(255, 255, 255, 0.05);
    --border-color: rgba(255, 255, 255, 0.1);
  }
}
</style>
