<script setup lang="ts">
/**
 * EditPromptDialog Component
 *
 * Dialog for editing prompt properties (name, category, tags, and language).
 * Replaces the simple rename functionality for prompts.
 */

import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '@/stores/settingsStore';

interface Props {
  modelValue: boolean;
  currentName: string;
  currentCategory?: string;
  currentTags?: string[];
  currentLanguage?: string;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'save', data: { name: string; category?: string; tags?: string[]; language?: string }): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n({ useScope: 'global' });

// Settings store for categories
const settingsStore = useSettingsStore();

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
const category = ref<string | null>(null);
const tags = ref<string[]>([]);
const language = ref<string | null>(null);
const newTag = ref('');
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
  const currentTagsStr = [...(props.currentTags ?? [])].sort().join(',');
  const newTagsStr = [...tags.value].sort().join(',');
  const tagsChanged = currentTagsStr !== newTagsStr;
  const languageChanged = (language.value ?? '') !== (props.currentLanguage ?? '');
  return nameChanged || categoryChanged || tagsChanged || languageChanged;
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
      tags.value = [...(props.currentTags ?? [])];
      language.value = props.currentLanguage ?? null;
      newTag.value = '';
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
    tags: tags.value.length > 0 ? tags.value : undefined,
    language: language.value ?? undefined,
  });
  emit('update:modelValue', false);
}

// Add a tag
function addTag(): void {
  const tag = newTag.value.trim();
  if (tag && !tags.value.includes(tag)) {
    tags.value.push(tag);
    newTag.value = '';
  }
}

// Remove a tag
function removeTag(index: number): void {
  tags.value.splice(index, 1);
}

// Handle tag input keydown
function handleTagKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault();
    addTag();
  }
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
          class="q-mb-md"
          data-testid="edit-prompt-category-select"
        />

        <!-- Tags Input -->
        <div class="q-mb-md">
          <div class="text-body2 q-mb-xs">{{ t('dialogs.editPrompt.tags') }}</div>
          <div class="tags-container q-mb-sm">
            <q-chip
              v-for="(tag, index) in tags"
              :key="index"
              removable
              color="primary"
              text-color="white"
              size="sm"
              @remove="removeTag(index)"
            >
              {{ tag }}
            </q-chip>
          </div>
          <q-input
            v-model="newTag"
            :placeholder="t('dialogs.editPrompt.tagsPlaceholder')"
            outlined
            dense
            @keydown="handleTagKeydown"
          >
            <template #append>
              <q-btn
                flat
                round
                dense
                icon="add"
                :disable="!newTag.trim()"
                @click="addTag"
              />
            </template>
          </q-input>
        </div>

        <!-- Language Select -->
        <q-select
          v-model="language"
          :options="languageOptions"
          :label="t('dialogs.editPrompt.language')"
          outlined
          emit-value
          map-options
          clearable
          data-testid="edit-prompt-language-select"
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

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 32px;
}
</style>
