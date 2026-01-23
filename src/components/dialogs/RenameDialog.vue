<script setup lang="ts">
/**
 * RenameDialog Component
 *
 * Dialog for renaming items (prompts, snippets, projects, or directories).
 * For snippet types, also allows editing description and tags.
 * Used by ExplorerPanel and SnippetsPanel.
 */

import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSnippetStore } from '@/stores/snippetStore';
import { getLanguageLabel } from '@/constants/languages';

interface Props {
  modelValue: boolean;
  currentName: string;
  currentDescription?: string;
  currentTags?: string[];
  currentLanguage?: string | null;
  itemType: 'prompt' | 'snippet' | 'persona' | 'template' | 'text' | 'project' | 'directory';
}

interface RenameResult {
  name: string;
  description?: string;
  tags?: string[];
  language?: string | null;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'rename', newName: string): void;
  (e: 'save', result: RenameResult): void;
}

const props = withDefaults(defineProps<Props>(), {
  currentDescription: '',
  currentTags: () => [],
  currentLanguage: null,
});
const emit = defineEmits<Emits>();

const { t } = useI18n({ useScope: 'global' });
const snippetStore = useSnippetStore();

// Check if this is a snippet type (supports extended editing)
const isSnippetType = computed(() =>
  ['snippet', 'persona', 'template', 'text'].includes(props.itemType)
);

// Form state
const newName = ref('');
const description = ref('');
const tags = ref<string[]>([]);
const language = ref<string | null>(null);
const filteredTagOptions = ref<string[]>([]);
const filteredLanguageOptions = ref<{ value: string; label: string }[]>([]);
const nameInput = ref<HTMLInputElement | null>(null);

// Get all unique tags from all snippets
const allExistingTags = computed(() => {
  const tagSet = new Set<string>();
  for (const snippet of snippetStore.allSnippets) {
    for (const tag of snippet.metadata.tags) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
});

// Get all unique languages from all snippets (with labels)
const allExistingLanguages = computed(() => {
  const langSet = new Set<string>();
  for (const snippet of snippetStore.allSnippets) {
    if (snippet.metadata.language) {
      langSet.add(snippet.metadata.language);
    }
  }
  return Array.from(langSet)
    .map((code) => ({ value: code, label: getLanguageLabel(code) }))
    .sort((a, b) => a.label.localeCompare(b.label));
});

/**
 * Normalize a string for diacritics-insensitive comparison.
 * Example: "Café" -> "cafe"
 */
function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Filter tag options based on user input with diacritics support
 */
function filterTags(val: string, update: (callback: () => void) => void): void {
  update(() => {
    if (!val) {
      filteredTagOptions.value = allExistingTags.value;
    } else {
      const normalizedSearch = normalizeForSearch(val);
      filteredTagOptions.value = allExistingTags.value.filter((tag) =>
        normalizeForSearch(tag).includes(normalizedSearch)
      );
    }
  });
}

/**
 * Handle creating a new tag from user input
 */
function createTag(
  inputValue: string,
  doneFn: (item: string, mode: 'add' | 'add-unique' | 'toggle') => void
): void {
  const trimmed = inputValue.trim();
  if (trimmed) {
    doneFn(trimmed, 'add-unique');
  }
}

/**
 * Filter language options based on user input
 */
function filterLanguages(val: string, update: (callback: () => void) => void): void {
  update(() => {
    if (!val) {
      filteredLanguageOptions.value = allExistingLanguages.value;
    } else {
      const normalizedSearch = normalizeForSearch(val);
      filteredLanguageOptions.value = allExistingLanguages.value.filter((lang) =>
        normalizeForSearch(lang.label).includes(normalizedSearch)
      );
    }
  });
}

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

// Check if anything has changed
const hasChanges = computed(() => {
  if (newName.value.trim() !== props.currentName) return true;
  if (isSnippetType.value) {
    if (description.value !== (props.currentDescription ?? '')) return true;
    const currentTagsStr = JSON.stringify([...(props.currentTags ?? [])].sort());
    const newTagsStr = JSON.stringify([...tags.value].sort());
    if (currentTagsStr !== newTagsStr) return true;
    if (language.value !== (props.currentLanguage ?? null)) return true;
  }
  return false;
});

const isValid = computed(() => !nameError.value && hasChanges.value);

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

// Button label - "Save" for snippets (since we edit more than name), "Rename" for others
const buttonLabel = computed(() => (isSnippetType.value ? t('common.save') : t('common.rename')));

// Reset form when dialog opens
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      newName.value = props.currentName;
      description.value = props.currentDescription ?? '';
      tags.value = [...(props.currentTags ?? [])];
      language.value = props.currentLanguage ?? null;
      filteredTagOptions.value = allExistingTags.value;
      filteredLanguageOptions.value = allExistingLanguages.value;
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

  if (isSnippetType.value) {
    // Emit full save with all fields for snippets
    emit('save', {
      name: newName.value.trim(),
      description: description.value,
      tags: tags.value,
      language: language.value,
    });
  } else {
    // Emit just rename for non-snippets (backwards compatibility)
    emit('rename', newName.value.trim());
  }
  emit('update:modelValue', false);
}

function handleKeydown(event: KeyboardEvent): void {
  // Only handle Enter on the name input, not the tag input
  if (event.key === 'Enter' && isValid.value && event.target === nameInput.value) {
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
      class="rename-dialog"
      data-testid="rename-dialog"
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
        <!-- Name input -->
        <q-input
          ref="nameInput"
          v-model="newName"
          :label="t('dialogs.rename.newName')"
          outlined
          autofocus
          :error="!!nameError && newName.length > 0"
          :error-message="nameError"
          data-testid="rename-input"
          :class="{ 'q-mb-md': isSnippetType }"
        />

        <!-- Extended fields for snippets -->
        <template v-if="isSnippetType">
          <!-- Description -->
          <q-input
            v-model="description"
            :label="t('dialogs.newSnippet.description')"
            :placeholder="t('dialogs.newSnippet.descriptionPlaceholder')"
            outlined
            type="textarea"
            rows="2"
            maxlength="200"
            class="q-mb-md"
          />

          <!-- Tags -->
          <div class="tags-section">
            <q-select
              v-model="tags"
              :options="filteredTagOptions"
              :label="t('dialogs.newSnippet.tags') || 'Tags'"
              outlined
              multiple
              use-chips
              use-input
              input-debounce="0"
              new-value-mode="add-unique"
              :hint="
                t('dialogs.newSnippet.tagsHint') ||
                'Select existing tags or type to create new ones'
              "
              @filter="filterTags"
              @new-value="createTag"
            >
              <template #no-option>
                <q-item>
                  <q-item-section class="text-grey">
                    {{ t('dialogs.newSnippet.tagsEmpty') || 'No tags yet' }}
                  </q-item-section>
                </q-item>
              </template>
              <template #selected-item="scope">
                <q-chip
                  removable
                  dense
                  color="primary"
                  text-color="white"
                  @remove="scope.removeAtIndex(scope.index)"
                >
                  {{ scope.opt }}
                </q-chip>
              </template>
            </q-select>
          </div>

          <!-- Language -->
          <div class="language-section">
            <q-select
              v-model="language"
              :options="filteredLanguageOptions"
              option-value="value"
              option-label="label"
              emit-value
              map-options
              :label="t('dialogs.newSnippet.language') || 'Language'"
              outlined
              clearable
              use-input
              input-debounce="0"
              :hint="t('dialogs.newSnippet.languageHint') || 'Select the content language'"
              @filter="filterLanguages"
            >
              <template #prepend>
                <q-icon
                  name="translate"
                  size="20px"
                />
              </template>
              <template #no-option>
                <q-item>
                  <q-item-section class="text-grey">
                    {{ t('snippetsPanel.noLanguagesFound') || 'No languages found' }}
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
          </div>
        </template>
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
          :label="buttonLabel"
          color="primary"
          :disable="!isValid"
          data-testid="rename-btn"
          @click="handleSave"
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

.tags-section {
  margin-top: 8px;
}

.language-section {
  margin-top: 16px;
}
</style>
