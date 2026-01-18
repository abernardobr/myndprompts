<script setup lang="ts">
/**
 * RenameDialog Component
 *
 * Dialog for renaming items (prompts, snippets, projects, or directories).
 * Used by ExplorerPanel and SnippetsPanel.
 */

import { ref, computed, watch } from 'vue';

interface Props {
  modelValue: boolean;
  currentName: string;
  itemType: 'prompt' | 'snippet' | 'persona' | 'template' | 'text' | 'project' | 'directory';
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'rename', newName: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Form state
const newName = ref('');
const nameInput = ref<HTMLInputElement | null>(null);

// Validation
const nameError = computed(() => {
  if (!newName.value.trim()) {
    return 'Name is required';
  }
  if (newName.value.length > 100) {
    return 'Name must be 100 characters or less';
  }
  // Check for invalid characters in folder names (for projects and directories)
  if (
    (props.itemType === 'project' || props.itemType === 'directory') &&
    /[<>:"/\\|?*]/.test(newName.value)
  ) {
    return 'Name contains invalid characters';
  }
  return '';
});

const isValid = computed(() => !nameError.value && newName.value.trim() !== props.currentName);

// Get display label for item type
const itemTypeLabel = computed(() => {
  switch (props.itemType) {
    case 'prompt':
      return 'Prompt';
    case 'persona':
      return 'Persona';
    case 'template':
      return 'Template';
    case 'text':
      return 'Text Snippet';
    case 'snippet':
      return 'Snippet';
    case 'project':
      return 'Project';
    case 'directory':
      return 'Directory';
    default:
      return 'Item';
  }
});

// Reset form when dialog opens
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      newName.value = props.currentName;
      // Focus and select input after dialog opens
      setTimeout(() => {
        nameInput.value?.focus();
        nameInput.value?.select();
      }, 100);
    }
  }
);

function handleClose(): void {
  emit('update:modelValue', false);
}

function handleRename(): void {
  if (!isValid.value) return;

  emit('rename', newName.value.trim());
  emit('update:modelValue', false);
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && isValid.value) {
    handleRename();
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
      class="rename-dialog"
      @keydown="handleKeydown"
    >
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Rename {{ itemTypeLabel }}</div>
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
          v-model="newName"
          label="New Name"
          outlined
          autofocus
          :error="!!nameError && newName.length > 0"
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
          label="Rename"
          color="primary"
          :disable="!isValid"
          @click="handleRename"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style lang="scss" scoped>
.rename-dialog {
  min-width: 400px;
  max-width: 500px;
}
</style>
