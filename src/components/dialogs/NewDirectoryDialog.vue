<script setup lang="ts">
/**
 * NewDirectoryDialog Component
 *
 * Dialog for creating a new directory within a project or nested directory.
 */

import { ref, computed, watch } from 'vue';

interface Props {
  modelValue: boolean;
  parentPath: string;
  parentName?: string;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'create', data: { name: string; parentPath: string }): void;
}

const props = withDefaults(defineProps<Props>(), {
  parentName: 'parent directory',
});
const emit = defineEmits<Emits>();

// Form state
const name = ref('');
const nameInput = ref<HTMLInputElement | null>(null);

// Validation
const nameError = computed(() => {
  if (!name.value.trim()) {
    return 'Name is required';
  }
  if (name.value.length > 100) {
    return 'Name must be 100 characters or less';
  }
  // Check for invalid characters in folder name
  if (/[<>:"/\\|?*]/.test(name.value)) {
    return 'Name contains invalid characters';
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
    parentPath: props.parentPath,
  });
  emit('update:modelValue', false);
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && isValid.value) {
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
      class="new-directory-dialog"
      @keydown="handleKeydown"
    >
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">New Directory</div>
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
        <div class="text-caption text-grey q-mb-md">
          Create a new directory in: <strong>{{ parentName }}</strong>
        </div>

        <q-input
          ref="nameInput"
          v-model="name"
          label="Directory Name"
          outlined
          autofocus
          :error="!!nameError && name.length > 0"
          :error-message="nameError"
        />
      </q-card-section>

      <q-card-actions
        align="right"
        class="q-px-md q-pb-md"
      >
        <q-btn
          flat
          label="Cancel"
          color="grey"
          @click="handleClose"
        />
        <q-btn
          unelevated
          label="Create"
          color="primary"
          :disable="!isValid"
          @click="handleCreate"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style lang="scss" scoped>
.new-directory-dialog {
  min-width: 400px;
  max-width: 500px;
}
</style>
