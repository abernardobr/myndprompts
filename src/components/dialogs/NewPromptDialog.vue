<script setup lang="ts">
/**
 * NewPromptDialog Component
 *
 * Dialog for creating a new prompt with title and optional category.
 */

import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '@/stores/settingsStore';

interface Props {
  modelValue: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'create', data: { title: string; category?: string }): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n({ useScope: 'global' });

// Settings store for categories
const settingsStore = useSettingsStore();

// Form state
const title = ref('');
const category = ref('');
const titleInput = ref<HTMLInputElement | null>(null);

// Validation
const titleError = computed(() => {
  if (!title.value.trim()) {
    return t('dialogs.newPrompt.titleRequired');
  }
  if (title.value.length > 100) {
    return t('dialogs.newPrompt.titleTooLong');
  }
  return '';
});

const isValid = computed(() => !titleError.value);

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
      title.value = '';
      category.value = '';
      // Focus title input after dialog opens
      setTimeout(() => {
        titleInput.value?.focus();
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
    title: title.value.trim(),
    category: category.value || undefined,
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
      class="new-prompt-dialog"
      @keydown="handleKeydown"
    >
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">{{ t('dialogs.newPrompt.title') }}</div>
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
          ref="titleInput"
          v-model="title"
          :label="t('dialogs.newPrompt.promptTitle')"
          outlined
          autofocus
          :error="!!titleError && title.length > 0"
          :error-message="titleError"
          class="q-mb-md"
        />

        <q-select
          v-model="category"
          :options="categories"
          :label="t('dialogs.newPrompt.categoryOptional')"
          outlined
          emit-value
          map-options
          clearable
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
          :label="t('common.create')"
          color="primary"
          :disable="!isValid"
          @click="handleCreate"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style lang="scss" scoped>
.new-prompt-dialog {
  min-width: 400px;
  max-width: 500px;
}
</style>
