<script setup lang="ts">
/**
 * CategoryListEditor Component
 *
 * Editable list of prompt categories for the settings panel.
 * Allows adding, editing, deleting, and reordering categories.
 */

import { ref, computed, onMounted } from 'vue';
import { useSettingsStore, type ICategory } from '@/stores/settingsStore';
import { useI18n } from 'vue-i18n';

const { t } = useI18n({ useScope: 'global' });
const settingsStore = useSettingsStore();

// Local state
const newCategoryName = ref('');
const editingCategory = ref<string | null>(null);
const editingValue = ref('');
const isAdding = ref(false);
const error = ref<string | null>(null);

// Computed
const categories = computed(() => settingsStore.categories);
const isLoading = computed(() => settingsStore.isLoading);

// Initialize store on mount
onMounted(async () => {
  if (!settingsStore.isInitialized) {
    await settingsStore.initialize();
  }
});

// Validation
function validateCategoryName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return t('settingsPanel.categoryRequired');
  }
  if (trimmed.length > 50) {
    return t('settingsPanel.categoryTooLong');
  }
  return null;
}

// Actions
async function handleAddCategory(): Promise<void> {
  const validationError = validateCategoryName(newCategoryName.value);
  if (validationError) {
    error.value = validationError;
    return;
  }

  try {
    error.value = null;
    await settingsStore.addCategory(newCategoryName.value);
    newCategoryName.value = '';
    isAdding.value = false;
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('settingsPanel.failedToAdd');
  }
}

function startEditing(category: ICategory): void {
  editingCategory.value = category.value;
  editingValue.value = category.label;
  error.value = null;
}

function cancelEditing(): void {
  editingCategory.value = null;
  editingValue.value = '';
  error.value = null;
}

async function saveEditing(): Promise<void> {
  if (!editingCategory.value) return;

  const validationError = validateCategoryName(editingValue.value);
  if (validationError) {
    error.value = validationError;
    return;
  }

  try {
    error.value = null;
    await settingsStore.updateCategory(editingCategory.value, editingValue.value);
    editingCategory.value = null;
    editingValue.value = '';
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('settingsPanel.failedToUpdate');
  }
}

async function handleDeleteCategory(category: ICategory): Promise<void> {
  try {
    error.value = null;
    await settingsStore.removeCategory(category.value);
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('settingsPanel.failedToDelete');
  }
}

async function handleResetToDefaults(): Promise<void> {
  try {
    error.value = null;
    await settingsStore.resetCategoriesToDefaults();
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('settingsPanel.failedToReset');
  }
}

function handleKeydown(event: KeyboardEvent, action: 'add' | 'edit'): void {
  if (event.key === 'Enter') {
    if (action === 'add') {
      void handleAddCategory();
    } else {
      void saveEditing();
    }
  } else if (event.key === 'Escape') {
    if (action === 'add') {
      isAdding.value = false;
      newCategoryName.value = '';
    } else {
      cancelEditing();
    }
  }
}

function startAdding(): void {
  isAdding.value = true;
  error.value = null;
}

function cancelAdding(): void {
  isAdding.value = false;
  newCategoryName.value = '';
  error.value = null;
}
</script>

<template>
  <div class="category-list-editor">
    <!-- Error message -->
    <q-banner
      v-if="error"
      dense
      class="q-mb-sm bg-negative text-white"
    >
      {{ error }}
      <template #action>
        <q-btn
          flat
          dense
          icon="close"
          @click="error = null"
        />
      </template>
    </q-banner>

    <!-- Loading state -->
    <div
      v-if="isLoading"
      class="category-list-editor__loading"
    >
      <q-spinner-dots size="24px" />
      <span>{{ t('settingsPanel.loadingCategories') }}</span>
    </div>

    <!-- Category list -->
    <q-list
      v-else
      dense
      class="category-list-editor__list"
    >
      <q-item
        v-for="category in categories"
        :key="category.value"
        class="category-list-editor__item"
      >
        <!-- Edit mode -->
        <template v-if="editingCategory === category.value">
          <q-item-section>
            <q-input
              v-model="editingValue"
              dense
              outlined
              autofocus
              class="category-list-editor__input"
              @keydown="handleKeydown($event, 'edit')"
            />
          </q-item-section>
          <q-item-section side>
            <div class="category-list-editor__actions">
              <q-btn
                flat
                dense
                round
                icon="check"
                color="positive"
                size="sm"
                @click="saveEditing"
              >
                <q-tooltip>{{ t('common.save') }}</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                icon="close"
                color="grey"
                size="sm"
                @click="cancelEditing"
              >
                <q-tooltip>{{ t('common.cancel') }}</q-tooltip>
              </q-btn>
            </div>
          </q-item-section>
        </template>

        <!-- Display mode -->
        <template v-else>
          <q-item-section>
            <q-item-label>{{ category.label }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <div class="category-list-editor__actions">
              <q-btn
                flat
                dense
                round
                icon="edit"
                color="grey"
                size="sm"
                @click="startEditing(category)"
              >
                <q-tooltip>{{ t('common.edit') }}</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                icon="delete"
                color="grey"
                size="sm"
                @click="handleDeleteCategory(category)"
              >
                <q-tooltip>{{ t('common.delete') }}</q-tooltip>
              </q-btn>
            </div>
          </q-item-section>
        </template>
      </q-item>

      <!-- Add new category -->
      <q-item
        v-if="isAdding"
        class="category-list-editor__item category-list-editor__item--adding"
      >
        <q-item-section>
          <q-input
            v-model="newCategoryName"
            dense
            outlined
            autofocus
            :placeholder="t('settingsPanel.newCategoryPlaceholder')"
            class="category-list-editor__input"
            @keydown="handleKeydown($event, 'add')"
          />
        </q-item-section>
        <q-item-section side>
          <div class="category-list-editor__actions">
            <q-btn
              flat
              dense
              round
              icon="check"
              color="positive"
              size="sm"
              :disable="!newCategoryName.trim()"
              @click="handleAddCategory"
            >
              <q-tooltip>{{ t('common.add') }}</q-tooltip>
            </q-btn>
            <q-btn
              flat
              dense
              round
              icon="close"
              color="grey"
              size="sm"
              @click="cancelAdding"
            >
              <q-tooltip>{{ t('common.cancel') }}</q-tooltip>
            </q-btn>
          </div>
        </q-item-section>
      </q-item>
    </q-list>

    <!-- Action buttons -->
    <div class="category-list-editor__footer">
      <q-btn
        v-if="!isAdding"
        flat
        dense
        no-caps
        icon="add"
        :label="t('settingsPanel.addCategory')"
        color="primary"
        @click="startAdding"
      />
      <q-space />
      <q-btn
        flat
        dense
        no-caps
        icon="restart_alt"
        :label="t('settingsPanel.resetToDefaults')"
        color="grey"
        @click="handleResetToDefaults"
      >
        <q-tooltip>{{ t('settingsPanel.resetToDefaultsTooltip') }}</q-tooltip>
      </q-btn>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.category-list-editor {
  &__loading {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px;
    color: var(--text-secondary, #858585);
    font-size: 13px;
  }

  &__list {
    border: 1px solid var(--border-color, #3c3c3c);
    border-radius: 4px;
    max-height: 300px;
    overflow-y: auto;
  }

  &__item {
    min-height: 40px;

    &:hover {
      background-color: var(--item-hover-bg, #2a2d2e);
    }

    &--adding {
      background-color: var(--item-adding-bg, #1e2021);
    }
  }

  &__input {
    :deep(.q-field__control) {
      height: 32px;
    }

    :deep(.q-field__native) {
      padding: 4px 8px;
    }
  }

  &__actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  &__item:hover &__actions,
  &__item--adding &__actions {
    opacity: 1;
  }

  &__footer {
    display: flex;
    align-items: center;
    padding: 8px 0;
    margin-top: 8px;
  }
}

// Light theme
.body--light .category-list-editor {
  --border-color: #e7e7e7;
  --item-hover-bg: #f5f5f5;
  --item-adding-bg: #fafafa;
  --text-secondary: #6f6f6f;
}

// Dark theme
.body--dark .category-list-editor {
  --border-color: #3c3c3c;
  --item-hover-bg: #2a2d2e;
  --item-adding-bg: #1e2021;
  --text-secondary: #858585;
}
</style>
