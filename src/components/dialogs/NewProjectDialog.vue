<script setup lang="ts">
/**
 * NewProjectDialog Component
 *
 * Dialog for creating a new project with name and optional description.
 */

import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

interface Props {
  modelValue: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'create', data: { name: string; description?: string }): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n({ useScope: 'global' });

// Form state
const name = ref('');
const description = ref('');
const nameInput = ref<HTMLInputElement | null>(null);

// Validation
const nameError = computed(() => {
  if (!name.value.trim()) {
    return t('validation.required');
  }
  if (name.value.length > 100) {
    return t('validation.maxLength', { max: 100 });
  }
  // Check for invalid characters in folder name
  if (/[<>:"/\\|?*]/.test(name.value)) {
    return t('validation.invalidFormat');
  }
  return '';
});

const isValid = computed(() => !nameError.value);

// Reset form when dialog opens
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      name.value = '';
      description.value = '';
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

function handleCreate(): void {
  if (!isValid.value) return;

  emit('create', {
    name: name.value.trim(),
    description: description.value.trim() || undefined,
  });
  emit('update:modelValue', false);
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && isValid.value && !event.shiftKey) {
    handleCreate();
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
      class="new-project-dialog"
      data-testid="new-project-dialog"
      @keydown="handleKeydown"
    >
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">{{ t('dialogs.newProject.title') }}</div>
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
        <q-input
          ref="nameInput"
          v-model="name"
          :label="t('dialogs.newProject.name')"
          :placeholder="t('dialogs.newProject.namePlaceholder')"
          outlined
          autofocus
          :error="!!nameError && name.length > 0"
          :error-message="nameError"
          class="q-mb-md"
          data-testid="project-name-input"
        />

        <q-input
          v-model="description"
          :label="t('dialogs.newProject.description')"
          :placeholder="t('dialogs.newProject.descriptionPlaceholder')"
          outlined
          type="textarea"
          rows="3"
          data-testid="project-description-input"
        />
      </q-card-section>

      <q-card-actions
        align="right"
        class="q-px-md q-pb-md"
      >
        <q-btn
          flat
          :label="t('common.cancel')"
          color="grey"
          data-testid="cancel-btn"
          @click="handleClose"
        />
        <q-btn
          unelevated
          :label="t('common.create')"
          color="primary"
          :disable="!isValid"
          data-testid="create-project-btn"
          @click="handleCreate"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style lang="scss" scoped>
.new-project-dialog {
  min-width: 400px;
  max-width: 500px;
}
</style>
