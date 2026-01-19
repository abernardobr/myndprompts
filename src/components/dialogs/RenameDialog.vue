<script setup lang="ts">
/**
 * RenameDialog Component
 *
 * Dialog for renaming items (prompts, snippets, projects, or directories).
 * Used by ExplorerPanel and SnippetsPanel.
 */

import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

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

const { t } = useI18n({ useScope: 'global' });

// Form state
const newName = ref('');
const nameInput = ref<HTMLInputElement | null>(null);

// Validation
const nameError = computed(() => {
  if (!newName.value.trim()) {
    return t('validation.required');
  }
  if (newName.value.length > 100) {
    return t('validation.maxLength', { max: 100 });
  }
  // Check for invalid characters in folder names (for projects and directories)
  if (
    (props.itemType === 'project' || props.itemType === 'directory') &&
    /[<>:"/\\|?*]/.test(newName.value)
  ) {
    return t('validation.invalidFormat');
  }
  return '';
});

const isValid = computed(() => !nameError.value && newName.value.trim() !== props.currentName);

// Get display label for item type
const itemTypeLabel = computed(() => {
  switch (props.itemType) {
    case 'prompt':
      return t('dialogs.rename.renamePrompt');
    case 'persona':
      return t('dialogs.newSnippet.persona');
    case 'template':
      return t('dialogs.newSnippet.template');
    case 'text':
      return t('dialogs.newSnippet.textSnippet');
    case 'snippet':
      return t('dialogs.rename.renameSnippet');
    case 'project':
      return t('dialogs.rename.renameProject');
    case 'directory':
      return t('dialogs.rename.renameDirectory');
    default:
      return t('dialogs.rename.title');
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
        <div class="text-h6">{{ itemTypeLabel }}</div>
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
          :label="t('dialogs.rename.newName')"
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
          :label="t('common.cancel')"
          color="grey"
          @click="handleClose"
        />
        <q-btn
          unelevated
          :label="t('common.rename')"
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
