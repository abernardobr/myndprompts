<script setup lang="ts">
/**
 * MoveStorageDialog Component
 *
 * Multi-step wizard dialog for moving storage to a new location.
 * Steps: Select Destination -> Confirm -> Progress -> Complete/Error
 */

import { ref, computed, watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import type {
  IMigrationProgress,
  IMigrationValidation,
  IMigrationPlan,
  IMigrationResult,
  IMigrationVerification,
  MigrationErrorCode,
} from '@/electron/preload/index';
import { getMigrationRepository } from '@/services/storage/repositories';

type DialogStep = 'select' | 'confirm' | 'progress' | 'complete' | 'error';

interface Props {
  modelValue: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'migration-complete', newPath: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n({ useScope: 'global' });
const $q = useQuasar();

// State
const step = ref<DialogStep>('select');
const sourcePath = ref<string>('');
const destinationPath = ref<string>('');
const isValidating = ref(false);
const validationResult = ref<IMigrationValidation | null>(null);
const migrationPlan = ref<IMigrationPlan | null>(null);
const progress = ref<IMigrationProgress | null>(null);
const result = ref<IMigrationResult | null>(null);
const verification = ref<IMigrationVerification | null>(null);
const errorMessage = ref<string | null>(null);
const errorCode = ref<MigrationErrorCode | null>(null);
const errorRecoverable = ref(false);
const isDeleting = ref(false);
const isRollingBack = ref(false);

// Progress listener cleanup function
let progressCleanup: (() => void) | null = null;

// Computed
const progressPercentage = computed(() => {
  if (!progress.value || progress.value.totalFiles === 0) return 0;
  return Math.round((progress.value.copiedFiles / progress.value.totalFiles) * 100);
});

const bytesProgressPercentage = computed(() => {
  if (!progress.value || progress.value.totalBytes === 0) return 0;
  return Math.round((progress.value.copiedBytes / progress.value.totalBytes) * 100);
});

const phaseLabel = computed(() => {
  if (!progress.value) return '';
  const phaseMap: Record<string, string> = {
    validating: t('settings.storage.moveStorage.phase.validating'),
    planning: t('settings.storage.moveStorage.phase.planning'),
    copying: t('settings.storage.moveStorage.phase.copying'),
    verifying: t('settings.storage.moveStorage.phase.verifying'),
    completing: t('settings.storage.moveStorage.phase.completing'),
  };
  return phaseMap[progress.value.phase] ?? progress.value.phase;
});

const canProceedToConfirm = computed(() => {
  return destinationPath.value && validationResult.value?.valid === true;
});

// Watch for dialog open
watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen) {
      await initializeDialog();
    } else {
      cleanupProgressListener();
    }
  }
);

// Cleanup on unmount
onUnmounted(() => {
  cleanupProgressListener();
});

async function initializeDialog(): Promise<void> {
  // Reset state
  step.value = 'select';
  destinationPath.value = '';
  validationResult.value = null;
  migrationPlan.value = null;
  progress.value = null;
  result.value = null;
  verification.value = null;
  errorMessage.value = null;
  errorCode.value = null;
  errorRecoverable.value = false;
  isDeleting.value = false;
  isRollingBack.value = false;

  // Get current storage path
  try {
    sourcePath.value = await window.fileSystemAPI.getBasePath();
  } catch (err) {
    console.error('Failed to get base path:', err);
    sourcePath.value = '';
  }

  // Set up progress listener
  setupProgressListener();
}

function setupProgressListener(): void {
  cleanupProgressListener();
  progressCleanup = window.fileSystemAPI.onMigrationProgress((prog) => {
    progress.value = prog;
  });
}

function cleanupProgressListener(): void {
  if (progressCleanup) {
    progressCleanup();
    progressCleanup = null;
  }
}

async function selectFolder(): Promise<void> {
  try {
    const result = await window.fileSystemAPI.selectMigrationFolder();
    if (!result.cancelled && result.path) {
      destinationPath.value = result.path;
      await validateDestination();
    }
  } catch (err) {
    console.error('Failed to select folder:', err);
    $q.notify({
      type: 'negative',
      message: t('settings.storage.moveStorage.errorNotification'),
      position: 'bottom',
      timeout: 3000,
    });
  }
}

async function validateDestination(): Promise<void> {
  if (!destinationPath.value) return;

  isValidating.value = true;
  validationResult.value = null;

  try {
    validationResult.value = await window.fileSystemAPI.validateMigrationDestination(
      destinationPath.value
    );
  } catch (err) {
    console.error('Validation failed:', err);
    validationResult.value = {
      valid: false,
      error: err instanceof Error ? err.message : 'Validation failed',
    };
  } finally {
    isValidating.value = false;
  }
}

async function proceedToConfirm(): Promise<void> {
  if (!canProceedToConfirm.value) return;

  try {
    migrationPlan.value = await window.fileSystemAPI.calculateMigrationPlan();
    step.value = 'confirm';
  } catch (err) {
    console.error('Failed to calculate migration plan:', err);
    errorMessage.value = err instanceof Error ? err.message : 'Failed to calculate migration plan';
    step.value = 'error';
  }
}

async function startMigration(): Promise<void> {
  step.value = 'progress';
  progress.value = null;
  errorMessage.value = null;
  errorCode.value = null;
  errorRecoverable.value = false;

  try {
    result.value = await window.fileSystemAPI.startMigration(destinationPath.value);

    if (result.value.success) {
      // Update database paths from old location to new location
      const migrationRepo = getMigrationRepository();
      const dbUpdateResult = await migrationRepo.updateAllPaths(
        sourcePath.value,
        destinationPath.value
      );

      if (!dbUpdateResult.success) {
        // Database update failed - log errors but continue
        // Files are already copied, so we show completion with warnings
        console.error('Database path update errors:', dbUpdateResult.errors);
      }

      // Verify the migration
      verification.value = await window.fileSystemAPI.verifyMigration(destinationPath.value);
      step.value = 'complete';
    } else if (result.value.cancelled) {
      // User cancelled
      step.value = 'select';
      $q.notify({
        type: 'warning',
        message: t('settings.storage.moveStorage.cancelled'),
        position: 'bottom',
        timeout: 3000,
      });
    } else {
      // Migration failed
      errorMessage.value = result.value.errors.join(', ') || 'Migration failed';
      // Check if any files were copied (partial migration)
      errorRecoverable.value = (result.value.filesCopied ?? 0) > 0;
      step.value = 'error';
    }
  } catch (err) {
    console.error('Migration failed:', err);
    errorMessage.value = err instanceof Error ? err.message : 'Migration failed';
    // Extract error code if available
    if (err && typeof err === 'object' && 'code' in err) {
      errorCode.value = (err as { code: MigrationErrorCode }).code;
    }
    errorRecoverable.value = true; // Assume recoverable for caught errors
    step.value = 'error';
  }
}

async function cancelMigration(): Promise<void> {
  try {
    await window.fileSystemAPI.cancelMigration();
  } catch (err) {
    console.error('Failed to cancel migration:', err);
  }
}

async function deleteOldStorage(): Promise<void> {
  isDeleting.value = true;

  try {
    await window.fileSystemAPI.cleanupOldStorage(sourcePath.value);
    $q.notify({
      type: 'positive',
      message: t('settings.storage.moveStorage.cleanupSuccess'),
      position: 'bottom',
      timeout: 3000,
    });
  } catch (err) {
    console.error('Failed to delete old storage:', err);
    $q.notify({
      type: 'negative',
      message: t('settings.storage.moveStorage.cleanupError'),
      position: 'bottom',
      timeout: 3000,
    });
  } finally {
    isDeleting.value = false;
  }
}

function finishMigration(): void {
  emit('migration-complete', destinationPath.value);
  close();
}

function close(): void {
  if (step.value === 'progress') {
    // Don't close during migration
    return;
  }
  emit('update:modelValue', false);
}

function retryMigration(): void {
  step.value = 'select';
  errorMessage.value = null;
  errorCode.value = null;
  errorRecoverable.value = false;
}

async function rollbackMigration(): Promise<void> {
  isRollingBack.value = true;

  try {
    const rollbackResult = await window.fileSystemAPI.rollbackMigration();

    if (rollbackResult.success) {
      $q.notify({
        type: 'positive',
        message: t('settings.storage.moveStorage.rollbackSuccess', {
          count: rollbackResult.filesRemoved,
        }),
        position: 'bottom',
        timeout: 3000,
      });
      // Reset to select step
      step.value = 'select';
      errorMessage.value = null;
      errorCode.value = null;
      errorRecoverable.value = false;
    } else {
      $q.notify({
        type: 'negative',
        message: rollbackResult.error ?? t('settings.storage.moveStorage.rollbackError'),
        position: 'bottom',
        timeout: 5000,
      });
    }
  } catch (err) {
    console.error('Rollback failed:', err);
    $q.notify({
      type: 'negative',
      message: t('settings.storage.moveStorage.rollbackError'),
      position: 'bottom',
      timeout: 5000,
    });
  } finally {
    isRollingBack.value = false;
  }
}

function getErrorTitle(): string {
  if (!errorCode.value) {
    return t('settings.storage.moveStorage.errorTitle');
  }

  const titleMap: Record<string, string> = {
    DISK_FULL: t('settings.storage.moveStorage.errors.diskFull'),
    PERMISSION_DENIED: t('settings.storage.moveStorage.errors.permissionDenied'),
    FILE_IN_USE: t('settings.storage.moveStorage.errors.fileInUse'),
    VALIDATION_FAILED: t('settings.storage.moveStorage.errors.validationFailed'),
    COPY_FAILED: t('settings.storage.moveStorage.errors.copyFailed'),
    VERIFICATION_FAILED: t('settings.storage.moveStorage.errors.verificationFailed'),
  };

  return titleMap[errorCode.value] ?? t('settings.storage.moveStorage.errorTitle');
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function getValidationErrorMessage(): string {
  if (!validationResult.value?.error) return '';

  // Map common error types to i18n keys
  const errorKey = validationResult.value.error;
  const errorMap: Record<string, string> = {
    NOT_EMPTY: 'settings.storage.moveStorage.destinationNotEmpty',
    INSIDE_SOURCE: 'settings.storage.moveStorage.destinationInsideSource',
    NO_WRITE_PERMISSION: 'settings.storage.moveStorage.noWritePermission',
    NOT_ENOUGH_SPACE: 'settings.storage.moveStorage.notEnoughSpace',
  };

  if (errorMap[errorKey]) {
    return t(errorMap[errorKey]);
  }

  return validationResult.value.error;
}
</script>

<template>
  <Teleport to="body">
    <q-dialog
      :model-value="modelValue"
      persistent
      class="move-storage-dialog-wrapper"
      @update:model-value="close"
    >
      <q-card class="move-storage-dialog">
        <!-- Header -->
        <q-card-section class="row items-center q-pb-none">
          <q-icon
            name="drive_file_move"
            color="primary"
            size="28px"
            class="q-mr-sm"
          />
          <div class="text-h6">{{ t('settings.storage.moveStorage.title') }}</div>
          <q-space />
          <q-btn
            v-if="step !== 'progress'"
            icon="close"
            flat
            round
            dense
            @click="close"
          />
        </q-card-section>

        <q-separator class="q-mt-md" />

        <!-- Step 1: Select Destination -->
        <q-card-section v-if="step === 'select'">
          <p class="text-body2 text-grey-7 q-mb-md">
            {{ t('settings.storage.moveStorage.description') }}
          </p>

          <!-- Current Location -->
          <div class="q-mb-lg">
            <div class="text-subtitle2 q-mb-xs">
              {{ t('settings.storage.moveStorage.currentLocation') }}
            </div>
            <q-input
              :model-value="sourcePath"
              outlined
              readonly
              dense
            >
              <template #prepend>
                <q-icon name="folder" />
              </template>
            </q-input>
          </div>

          <!-- New Location -->
          <div class="q-mb-md">
            <div class="text-subtitle2 q-mb-xs">
              {{ t('settings.storage.moveStorage.newLocation') }}
            </div>
            <q-input
              :model-value="destinationPath"
              :placeholder="t('settings.storage.moveStorage.noFolderSelected')"
              outlined
              readonly
              dense
              :error="validationResult !== null && !validationResult.valid"
              :error-message="getValidationErrorMessage()"
            >
              <template #prepend>
                <q-icon name="folder_open" />
              </template>
              <template #append>
                <q-btn
                  flat
                  round
                  dense
                  icon="folder_open"
                  :loading="isValidating"
                  @click="selectFolder"
                >
                  <q-tooltip>{{ t('settings.storage.moveStorage.selectFolder') }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </div>

          <!-- Validation Status -->
          <div
            v-if="validationResult && validationResult.valid"
            class="text-positive q-mb-md"
          >
            <q-icon
              name="check_circle"
              size="20px"
              class="q-mr-xs"
            />
            {{ t('settings.storage.moveStorage.validDestination') }}
            <span
              v-if="validationResult.availableSpace"
              class="text-grey-6"
            >
              ({{ formatBytes(validationResult.availableSpace) }}
              {{ t('settings.storage.moveStorage.available') }})
            </span>
          </div>
        </q-card-section>

        <!-- Step 2: Confirm -->
        <q-card-section v-else-if="step === 'confirm'">
          <div class="text-subtitle1 q-mb-md">
            {{ t('settings.storage.moveStorage.confirmTitle') }}
          </div>

          <p class="text-body2 text-grey-7 q-mb-md">
            {{ t('settings.storage.moveStorage.confirmMessage') }}
          </p>

          <!-- Migration Plan Summary -->
          <q-card
            flat
            bordered
            class="q-mb-md"
          >
            <q-card-section>
              <div class="text-subtitle2 q-mb-sm">
                {{ t('settings.storage.moveStorage.migrationPlan') }}
              </div>
              <div class="row q-col-gutter-md">
                <div class="col-6">
                  <div class="text-caption text-grey-6">
                    {{ t('settings.storage.moveStorage.totalFiles') }}
                  </div>
                  <div class="text-body1">{{ migrationPlan?.totalFiles || 0 }}</div>
                </div>
                <div class="col-6">
                  <div class="text-caption text-grey-6">
                    {{ t('settings.storage.moveStorage.totalSize') }}
                  </div>
                  <div class="text-body1">{{ formatBytes(migrationPlan?.totalSize || 0) }}</div>
                </div>
              </div>

              <!-- Directory breakdown -->
              <div
                v-if="migrationPlan?.directories.length"
                class="q-mt-md"
              >
                <div class="text-caption text-grey-6 q-mb-xs">
                  {{ t('settings.storage.moveStorage.directories') }}
                </div>
                <div
                  v-for="dir in migrationPlan.directories"
                  :key="dir.name"
                  class="row items-center q-py-xs"
                >
                  <q-icon
                    name="folder"
                    size="18px"
                    class="q-mr-sm text-grey-6"
                  />
                  <span class="text-body2">{{ dir.name }}</span>
                  <q-space />
                  <span class="text-caption text-grey-6">
                    {{ dir.fileCount }} {{ dir.fileCount === 1 ? 'file' : 'files' }}
                  </span>
                </div>
              </div>
            </q-card-section>
          </q-card>

          <!-- Warning -->
          <q-banner
            class="bg-warning-1 text-warning q-mb-md"
            rounded
          >
            <template #avatar>
              <q-icon
                name="warning"
                color="warning"
              />
            </template>
            {{ t('settings.storage.moveStorage.warningMessage') }}
          </q-banner>
        </q-card-section>

        <!-- Step 3: Progress -->
        <q-card-section v-else-if="step === 'progress'">
          <div class="text-center q-mb-lg">
            <q-spinner-gears
              color="primary"
              size="48px"
              class="q-mb-md"
            />
            <div class="text-h6">{{ t('settings.storage.moveStorage.progressTitle') }}</div>
          </div>

          <!-- Phase -->
          <div class="text-center q-mb-md">
            <q-chip
              :label="phaseLabel"
              color="primary"
              text-color="white"
              icon="sync"
            />
          </div>

          <!-- Progress Bar -->
          <div class="q-mb-md">
            <div class="row justify-between q-mb-xs">
              <span class="text-caption">
                {{
                  t('settings.storage.moveStorage.fileProgress', {
                    current: progress?.copiedFiles || 0,
                    total: progress?.totalFiles || 0,
                  })
                }}
              </span>
              <span class="text-caption">{{ progressPercentage }}%</span>
            </div>
            <q-linear-progress
              :value="progressPercentage / 100"
              color="primary"
              size="8px"
              rounded
            />
          </div>

          <!-- Bytes Progress -->
          <div class="q-mb-md">
            <div class="row justify-between q-mb-xs">
              <span class="text-caption">
                {{ formatBytes(progress?.copiedBytes || 0) }} /
                {{ formatBytes(progress?.totalBytes || 0) }}
              </span>
              <span class="text-caption">{{ bytesProgressPercentage }}%</span>
            </div>
            <q-linear-progress
              :value="bytesProgressPercentage / 100"
              color="secondary"
              size="4px"
              rounded
            />
          </div>

          <!-- Current File -->
          <div
            v-if="progress?.currentFile"
            class="text-center q-mb-md"
          >
            <div class="text-caption text-grey-6">
              {{ t('settings.storage.moveStorage.currentFile') }}
            </div>
            <div class="text-body2 ellipsis">{{ progress.currentFile }}</div>
          </div>

          <!-- Current Directory -->
          <div
            v-if="progress?.currentDirectory"
            class="text-center"
          >
            <div class="text-caption text-grey-6">
              {{
                t('settings.storage.moveStorage.copyingDirectory', {
                  directory: progress.currentDirectory,
                })
              }}
            </div>
          </div>
        </q-card-section>

        <!-- Step 4: Complete -->
        <q-card-section v-else-if="step === 'complete'">
          <div class="text-center q-mb-lg">
            <q-icon
              name="check_circle"
              color="positive"
              size="64px"
            />
            <div class="text-h6 q-mt-md">{{ t('settings.storage.moveStorage.completeTitle') }}</div>
            <p class="text-body2 text-grey-7">
              {{ t('settings.storage.moveStorage.successMessage') }}
            </p>
          </div>

          <!-- Summary -->
          <q-card
            flat
            bordered
            class="q-mb-md"
          >
            <q-card-section>
              <div class="text-subtitle2 q-mb-sm">
                {{ t('settings.storage.moveStorage.summary') }}
              </div>
              <div class="row q-col-gutter-md">
                <div class="col-4">
                  <div class="text-caption text-grey-6">
                    {{ t('settings.storage.moveStorage.filesCopied') }}
                  </div>
                  <div class="text-body1">{{ result?.filesCopied || 0 }}</div>
                </div>
                <div class="col-4">
                  <div class="text-caption text-grey-6">
                    {{ t('settings.storage.moveStorage.totalSize') }}
                  </div>
                  <div class="text-body1">{{ formatBytes(result?.bytesCopied || 0) }}</div>
                </div>
                <div class="col-4">
                  <div class="text-caption text-grey-6">
                    {{ t('settings.storage.moveStorage.duration') }}
                  </div>
                  <div class="text-body1">{{ formatDuration(result?.duration || 0) }}</div>
                </div>
              </div>
            </q-card-section>
          </q-card>

          <!-- Verification Status -->
          <div
            v-if="verification"
            class="q-mb-md"
          >
            <div
              v-if="verification.verified"
              class="text-positive"
            >
              <q-icon
                name="verified"
                size="20px"
                class="q-mr-xs"
              />
              {{ t('settings.storage.moveStorage.verificationSuccess') }}
            </div>
            <div
              v-else
              class="text-warning"
            >
              <q-icon
                name="warning"
                size="20px"
                class="q-mr-xs"
              />
              {{ t('settings.storage.moveStorage.verificationWarning') }}
            </div>
          </div>

          <!-- Cleanup Option -->
          <q-card
            flat
            bordered
            class="q-mb-md"
          >
            <q-card-section>
              <div class="text-subtitle2 q-mb-xs">
                {{ t('settings.storage.moveStorage.cleanupTitle') }}
              </div>
              <p class="text-body2 text-grey-7 q-mb-sm">
                {{ t('settings.storage.moveStorage.cleanupMessage') }}
              </p>
              <div class="text-caption text-warning q-mb-md">
                <q-icon
                  name="warning"
                  size="16px"
                  class="q-mr-xs"
                />
                {{ t('settings.storage.moveStorage.cleanupWarning') }}
              </div>
              <div class="row q-gutter-sm">
                <q-btn
                  outline
                  color="negative"
                  :label="t('settings.storage.moveStorage.deleteOldStorage')"
                  :loading="isDeleting"
                  @click="deleteOldStorage"
                />
                <q-btn
                  flat
                  color="grey"
                  :label="t('settings.storage.moveStorage.keepOldStorage')"
                  @click="finishMigration"
                />
              </div>
            </q-card-section>
          </q-card>
        </q-card-section>

        <!-- Step 5: Error -->
        <q-card-section v-else-if="step === 'error'">
          <div class="text-center q-mb-lg">
            <q-icon
              name="error"
              color="negative"
              size="64px"
            />
            <div class="text-h6 text-negative q-mt-md">
              {{ getErrorTitle() }}
            </div>
          </div>

          <q-banner
            class="bg-red-1 text-negative q-mb-md"
            rounded
          >
            {{ errorMessage || t('settings.storage.moveStorage.errorMessage') }}
          </q-banner>

          <!-- Partial migration info -->
          <div
            v-if="result && result.filesCopied > 0"
            class="q-mb-md"
          >
            <q-card
              flat
              bordered
            >
              <q-card-section class="q-pa-sm">
                <div class="row items-center">
                  <q-icon
                    name="info"
                    color="warning"
                    size="20px"
                    class="q-mr-sm"
                  />
                  <span class="text-body2 text-warning">
                    {{
                      t('settings.storage.moveStorage.partialMigrationInfo', {
                        copied: result.filesCopied,
                      })
                    }}
                  </span>
                </div>
              </q-card-section>
            </q-card>
          </div>

          <p class="text-body2 text-grey-7 text-center">
            {{ t('settings.storage.moveStorage.partialMigration') }}
          </p>

          <!-- Rollback option for partial migrations -->
          <div
            v-if="errorRecoverable && result && result.filesCopied > 0"
            class="q-mt-md"
          >
            <q-separator class="q-mb-md" />
            <div class="text-subtitle2 q-mb-xs">
              {{ t('settings.storage.moveStorage.rollbackTitle') }}
            </div>
            <p class="text-caption text-grey-7 q-mb-sm">
              {{ t('settings.storage.moveStorage.rollbackDescription') }}
            </p>
            <q-btn
              outline
              color="warning"
              :label="t('settings.storage.moveStorage.rollbackButton')"
              :loading="isRollingBack"
              icon="undo"
              @click="rollbackMigration"
            />
          </div>
        </q-card-section>

        <!-- Actions -->
        <q-card-actions
          align="right"
          class="q-px-md q-pb-md"
        >
          <!-- Select step actions -->
          <template v-if="step === 'select'">
            <q-btn
              flat
              :label="t('common.cancel')"
              color="grey"
              @click="close"
            />
            <q-btn
              unelevated
              :label="t('common.next')"
              color="primary"
              :disable="!canProceedToConfirm"
              @click="proceedToConfirm"
            />
          </template>

          <!-- Confirm step actions -->
          <template v-else-if="step === 'confirm'">
            <q-btn
              flat
              :label="t('common.back')"
              color="grey"
              @click="step = 'select'"
            />
            <q-btn
              unelevated
              :label="t('settings.storage.moveStorage.move')"
              color="primary"
              @click="startMigration"
            />
          </template>

          <!-- Progress step actions -->
          <template v-else-if="step === 'progress'">
            <q-btn
              flat
              :label="t('common.cancel')"
              color="warning"
              :disable="!progress?.canCancel"
              @click="cancelMigration"
            />
          </template>

          <!-- Complete step actions -->
          <template v-else-if="step === 'complete'">
            <q-btn
              unelevated
              :label="t('common.close')"
              color="primary"
              @click="finishMigration"
            />
          </template>

          <!-- Error step actions -->
          <template v-else-if="step === 'error'">
            <q-btn
              flat
              :label="t('common.close')"
              color="grey"
              @click="close"
            />
            <q-btn
              outline
              :label="t('settings.storage.moveStorage.retry')"
              color="primary"
              @click="retryMigration"
            />
          </template>
        </q-card-actions>
      </q-card>
    </q-dialog>
  </Teleport>
</template>

<style lang="scss" scoped>
.move-storage-dialog {
  min-width: 500px;
  max-width: 600px;
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.bg-warning-1 {
  background-color: rgba(255, 193, 7, 0.1);
}
</style>

<!-- Non-scoped style to ensure dialog appears above maximized parent dialog -->
<style lang="scss">
.move-storage-dialog-wrapper {
  z-index: 20000 !important;
}
</style>
