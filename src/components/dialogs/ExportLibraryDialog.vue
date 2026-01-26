<script setup lang="ts">
/**
 * ExportLibraryDialog Component
 *
 * Dialog for exporting a project as a library JSON file.
 * Collects name, description, language, and destination folder for the library.
 */

import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

interface Props {
  modelValue: boolean;
  projectPath: string;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (
    e: 'export',
    data: { name: string; description: string; language: string; destinationFolder: string }
  ): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n({ useScope: 'global' });

// Language options
const languageOptions = [
  { label: 'English', value: 'en' },
  { label: 'Portuguese', value: 'pt' },
  { label: 'Spanish', value: 'es' },
  { label: 'French', value: 'fr' },
  { label: 'German', value: 'de' },
  { label: 'Italian', value: 'it' },
  { label: 'Arabic', value: 'ar' },
];

// Form state
const name = ref('');
const description = ref('');
const language = ref('en');
const destinationFolder = ref('');
const nameInput = ref<HTMLInputElement | null>(null);

// Validation
const nameError = computed(() => {
  if (!name.value.trim()) {
    return t('validation.required');
  }
  if (name.value.length > 100) {
    return t('validation.maxLength', { max: 100 });
  }
  return '';
});

const folderError = computed(() => {
  if (!destinationFolder.value) {
    return t('validation.required');
  }
  return '';
});

const isValid = computed(() => !nameError.value && !folderError.value);

// Reset form when dialog opens
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      name.value = '';
      description.value = '';
      language.value = 'en';
      destinationFolder.value = '';
      // Focus name input after dialog opens
      setTimeout(() => {
        nameInput.value?.focus();
      }, 100);
    }
  }
);

function handleClose(): void {
  emit('update:modelValue', false);
}

async function handleBrowseFolder(): Promise<void> {
  const electronAPI = window.electronAPI;
  if (!electronAPI) return;

  const result = await electronAPI.showOpenDialog({
    title: t('dialogs.exportLibrary.selectFolder'),
    properties: ['openDirectory'],
  });

  if (!result.canceled && result.filePaths.length > 0 && result.filePaths[0]) {
    destinationFolder.value = result.filePaths[0];
  }
}

function handleExport(): void {
  if (!isValid.value) return;

  emit('export', {
    name: name.value.trim(),
    description: description.value.trim(),
    language: language.value,
    destinationFolder: destinationFolder.value,
  });
  emit('update:modelValue', false);
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && isValid.value && !event.shiftKey) {
    handleExport();
  }
}
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card
      class="export-library-dialog"
      @keydown="handleKeydown"
    >
      <q-card-section class="row items-center q-pb-none">
        <q-icon
          name="file_download"
          color="primary"
          size="24px"
          class="q-mr-sm"
        />
        <div class="text-h6">{{ t('dialogs.exportLibrary.title') }}</div>
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

      <q-card-section class="q-pt-lg">
        <p class="text-body2 text-grey-7 q-mb-md">
          {{ t('dialogs.exportLibrary.description') }}
        </p>

        <q-input
          ref="nameInput"
          v-model="name"
          :label="t('dialogs.exportLibrary.name')"
          :placeholder="t('dialogs.exportLibrary.namePlaceholder')"
          outlined
          autofocus
          :error="!!nameError && name.length > 0"
          :error-message="nameError"
          class="q-mb-md"
        />

        <q-input
          v-model="description"
          :label="t('dialogs.exportLibrary.libraryDescription')"
          :placeholder="t('dialogs.exportLibrary.descriptionPlaceholder')"
          outlined
          type="textarea"
          rows="3"
          class="q-mb-md"
        />

        <q-select
          v-model="language"
          :options="languageOptions"
          :label="t('dialogs.exportLibrary.language')"
          outlined
          emit-value
          map-options
          class="q-mb-md"
        />

        <!-- Destination Folder -->
        <q-input
          v-model="destinationFolder"
          :label="t('dialogs.exportLibrary.destinationFolder')"
          :placeholder="t('dialogs.exportLibrary.destinationFolderPlaceholder')"
          outlined
          readonly
          :error="!!folderError && !destinationFolder"
          :error-message="folderError"
        >
          <template #append>
            <q-btn
              flat
              round
              dense
              icon="folder_open"
              @click="handleBrowseFolder"
            />
          </template>
        </q-input>
      </q-card-section>

      <q-card-actions
        align="right"
        class="q-px-md q-pb-md"
      >
        <q-btn
          flat
          :label="t('common.cancel')"
          color="grey"
          @click="handleClose"
        />
        <q-btn
          unelevated
          :label="t('dialogs.exportLibrary.export')"
          color="primary"
          :disable="!isValid"
          @click="handleExport"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style lang="scss" scoped>
.export-library-dialog {
  min-width: 400px;
  max-width: 500px;
}
</style>
