<script setup lang="ts">
/**
 * EditPromptDialog Component
 *
 * Dialog for editing prompt properties (name and category).
 * Replaces the simple rename functionality for prompts.
 */

import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '@/stores/settingsStore';

interface Props {
  modelValue: boolean;
  currentName: string;
  currentCategory?: string;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'save', data: { name: string; category?: string }): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n({ useScope: 'global' });

// Settings store for categories
const settingsStore = useSettingsStore();

// Form state
const name = ref('');
const category = ref<string | null>(null);
const nameInput = ref<HTMLInputElement | null>(null);

// Validation
const nameError = computed(() => {
  if (!name.value.trim()) {
    return 'Name is required';
  }
  if (name.value.length > 100) {
    return 'Name must be 100 characters or less';
  }
  return '';
});

const isValid = computed(() => !nameError.value);

const hasChanges = computed(() => {
  const nameChanged = name.value.trim() !== props.currentName;
  const categoryChanged = (category.value ?? '') !== (props.currentCategory ?? '');
  return nameChanged || categoryChanged;
});

// Categories from settings store
const categories = computed(() => settingsStore.categories);

// Initialize settings store on mount
onMounted(async () => {
  if (!settingsStore.isInitialized) {
    await settingsStore.initialize();
  }
});

// Reset form when dialog opens
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      name.value = props.currentName;
      category.value = props.currentCategory ?? null;
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

function handleSave(): void {
  if (!isValid.value) return;

  emit('save', {
    name: name.value.trim(),
    category: category.value ?? undefined,
  });
  emit('update:modelValue', false);
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && isValid.value && hasChanges.value) {
    handleSave();
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
      class="edit-prompt-dialog"
      data-testid="edit-prompt-dialog"
      @keydown="handleKeydown"
    >
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">{{ t('common.edit') }}</div>
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
          :label="t('dialogs.newSnippet.name')"
          outlined
          autofocus
          :error="!!nameError && name.length > 0"
          :error-message="nameError"
          class="q-mb-md"
          data-testid="edit-prompt-name-input"
        />

        <q-select
          v-model="category"
          :options="categories"
          :label="t('dialogs.newPrompt.category')"
          outlined
          emit-value
          map-options
          clearable
          data-testid="edit-prompt-category-select"
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
          :label="t('common.save')"
          color="primary"
          :disable="!isValid || !hasChanges"
          data-testid="save-btn"
          @click="handleSave"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style lang="scss" scoped>
.edit-prompt-dialog {
  min-width: 400px;
  max-width: 500px;
}
</style>
