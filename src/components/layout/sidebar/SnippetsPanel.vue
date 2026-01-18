<script setup lang="ts">
/**
 * SnippetsPanel Component
 *
 * Displays and manages code snippets, personas, and templates.
 * Allows browsing, searching, creating, and inserting snippets.
 */

import { ref, computed, onMounted } from 'vue';
import { useSnippetStore } from '@/stores/snippetStore';
import type { ISnippetFile, ISnippetMetadata } from '@/services/file-system/types';
import NewSnippetDialog from '@/components/dialogs/NewSnippetDialog.vue';
import RenameDialog from '@/components/dialogs/RenameDialog.vue';

const snippetStore = useSnippetStore();

// Check if running in Electron
const isElectron = computed(() => typeof window !== 'undefined' && !!window.fileSystemAPI);

// Dialog state
const showNewSnippetDialog = ref(false);
const showRenameDialog = ref(false);
const renameTarget = ref<{ snippet: ISnippetFile; currentName: string } | null>(null);

// Search query
const searchQuery = ref('');

// Selected category filter
const selectedCategory = ref<ISnippetMetadata['type'] | null>(null);

// Snippet categories with counts
const snippetCategories = computed(() => [
  {
    id: 'persona' as const,
    label: 'Personas',
    icon: 'person',
    trigger: '@',
    count: snippetStore.personaSnippets.length,
  },
  {
    id: 'text' as const,
    label: 'Text Snippets',
    icon: 'text_snippet',
    trigger: '#',
    count: snippetStore.textSnippets.length,
  },
  {
    id: 'code' as const,
    label: 'Code Snippets',
    icon: 'code',
    trigger: '$',
    count: snippetStore.codeSnippets.length,
  },
  {
    id: 'template' as const,
    label: 'Templates',
    icon: 'article',
    trigger: '!',
    count: snippetStore.templateSnippets.length,
  },
]);

// Filtered snippets based on category and search
const filteredSnippets = computed(() => {
  let snippets = snippetStore.allSnippets;

  // Filter by category
  if (selectedCategory.value !== null) {
    snippets = snippets.filter((s) => s.metadata.type === selectedCategory.value);
  }

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim();
    snippets = snippets.filter(
      (s) =>
        s.metadata.name.toLowerCase().includes(query) ||
        s.metadata.shortcut.toLowerCase().includes(query) ||
        (s.metadata.description?.toLowerCase().includes(query) ?? false) ||
        s.metadata.tags.some((t) => t.toLowerCase().includes(query))
    );
  }

  return snippets;
});

// Total snippets count
const totalSnippets = computed(() => snippetStore.allSnippets.length);

// Select/deselect category
function selectCategory(id: ISnippetMetadata['type']): void {
  selectedCategory.value = selectedCategory.value === id ? null : id;
}

// Get icon for snippet type
function getSnippetIcon(type: ISnippetMetadata['type']): string {
  switch (type) {
    case 'persona':
      return 'person';
    case 'code':
      return 'code';
    case 'template':
      return 'article';
    default:
      return 'text_snippet';
  }
}

// Copy snippet shortcut to clipboard
async function copyShortcut(snippet: ISnippetFile): Promise<void> {
  try {
    await navigator.clipboard.writeText(snippet.metadata.shortcut);
  } catch (err) {
    console.error('Failed to copy shortcut:', err);
  }
}

// Insert snippet content at cursor (emits event to be handled by parent)
function insertSnippet(snippet: ISnippetFile): void {
  // This will be connected to the editor via an event bus or store
  // For now, we copy the content to clipboard
  navigator.clipboard.writeText(snippet.content).catch(console.error);
}

// Delete snippet
async function deleteSnippet(snippet: ISnippetFile): Promise<void> {
  try {
    await snippetStore.deleteSnippet(snippet.filePath);
  } catch (err) {
    console.error('Failed to delete snippet:', err);
  }
}

// Open rename dialog
function openRenameDialog(snippet: ISnippetFile): void {
  renameTarget.value = {
    snippet,
    currentName: snippet.metadata.name,
  };
  showRenameDialog.value = true;
}

// Get item type for rename dialog
function getRenameItemType(snippet: ISnippetFile): 'snippet' | 'persona' | 'template' | 'text' {
  if (snippet.metadata.type === 'persona') return 'persona';
  if (snippet.metadata.type === 'template') return 'template';
  if (snippet.metadata.type === 'text') return 'text';
  return 'snippet';
}

// Handle rename
async function handleRename(newName: string): Promise<void> {
  if (!renameTarget.value) return;

  try {
    await snippetStore.renameSnippet(renameTarget.value.snippet.filePath, newName);
  } catch (err) {
    console.error('Failed to rename snippet:', err);
  }
}

// Handle new snippet creation
async function handleCreateSnippet(data: {
  name: string;
  type: ISnippetMetadata['type'];
  description: string;
}): Promise<void> {
  try {
    await snippetStore.createSnippet(data.name, data.type, '');
    // If a description was provided, update the snippet
    // This would require loading and updating the metadata
  } catch (err) {
    console.error('Failed to create snippet:', err);
  }
}

// Initialize snippet store (provider is set up automatically in store.initialize())
onMounted(async () => {
  // Only initialize store if in Electron
  if (!isElectron.value) return;

  try {
    await snippetStore.initialize();
  } catch (err) {
    console.warn('Failed to initialize snippet store:', err);
  }
});
</script>

<template>
  <div class="snippets-panel">
    <!-- Header with search and add button -->
    <div class="snippets-panel__header">
      <q-input
        v-model="searchQuery"
        placeholder="Search snippets..."
        outlined
        dense
        clearable
        class="snippets-panel__search"
      >
        <template #prepend>
          <q-icon
            name="search"
            size="18px"
          />
        </template>
      </q-input>
      <q-btn
        flat
        dense
        round
        icon="add"
        @click="showNewSnippetDialog = true"
      >
        <q-tooltip>Create new snippet</q-tooltip>
      </q-btn>
    </div>

    <!-- Category filters -->
    <div class="snippets-panel__categories">
      <div
        v-for="category in snippetCategories"
        :key="category.id"
        :class="[
          'snippets-panel__category',
          { 'snippets-panel__category--selected': selectedCategory === category.id },
        ]"
        @click="selectCategory(category.id)"
      >
        <q-icon
          :name="category.icon"
          size="18px"
        />
        <span class="snippets-panel__category-label">{{ category.label }}</span>
        <span class="snippets-panel__trigger">{{ category.trigger }}</span>
        <q-badge
          v-if="category.count > 0"
          :label="category.count"
          color="primary"
          class="snippets-panel__badge"
        />
      </div>
    </div>

    <!-- Snippets list -->
    <div class="snippets-panel__content">
      <q-scroll-area class="snippets-panel__scroll">
        <!-- Browser mode message -->
        <div
          v-if="!isElectron"
          class="snippets-panel__browser-mode"
        >
          <q-icon
            name="info"
            size="32px"
            class="text-grey-6 q-mb-sm"
          />
          <p class="text-grey-6 text-caption text-center">
            Snippets panel is available in the desktop app.
          </p>
          <p class="text-grey-7 text-caption text-center q-mt-sm">
            Running in browser preview mode.
          </p>
        </div>

        <!-- Loading state -->
        <div
          v-else-if="snippetStore.isLoading"
          class="snippets-panel__loading"
        >
          <q-spinner-dots
            color="primary"
            size="32px"
          />
        </div>

        <!-- Empty state -->
        <div
          v-else-if="filteredSnippets.length === 0"
          class="snippets-panel__empty"
        >
          <q-icon
            name="code"
            size="32px"
            class="text-grey-6 q-mb-sm"
          />
          <p
            v-if="totalSnippets === 0"
            class="text-grey-6 text-caption"
          >
            No snippets yet. Click + to create your first snippet.
          </p>
          <p
            v-else-if="searchQuery"
            class="text-grey-6 text-caption"
          >
            No snippets match your search.
          </p>
          <p
            v-else
            class="text-grey-6 text-caption"
          >
            No snippets in this category.
          </p>
        </div>

        <!-- Snippet items -->
        <div
          v-else
          class="snippets-panel__list"
        >
          <div
            v-for="snippet in filteredSnippets"
            :key="snippet.filePath"
            class="snippets-panel__item"
          >
            <div class="snippets-panel__item-icon">
              <q-icon
                :name="getSnippetIcon(snippet.metadata.type)"
                size="18px"
              />
            </div>
            <div class="snippets-panel__item-content">
              <div class="snippets-panel__item-name">{{ snippet.metadata.name }}</div>
              <div class="snippets-panel__item-shortcut">{{ snippet.metadata.shortcut }}</div>
            </div>
            <div class="snippets-panel__item-actions">
              <q-btn
                flat
                dense
                round
                size="sm"
                icon="content_copy"
                @click.stop="copyShortcut(snippet)"
              >
                <q-tooltip>Copy shortcut</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                size="sm"
                icon="add_box"
                @click.stop="insertSnippet(snippet)"
              >
                <q-tooltip>Copy content</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                size="sm"
                icon="edit"
                @click.stop="openRenameDialog(snippet)"
              >
                <q-tooltip>Rename</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                size="sm"
                icon="delete"
                color="negative"
                @click.stop="deleteSnippet(snippet)"
              >
                <q-tooltip>Delete snippet</q-tooltip>
              </q-btn>
            </div>
          </div>
        </div>
      </q-scroll-area>
    </div>

    <!-- Help footer -->
    <div class="snippets-panel__footer">
      <q-icon
        name="help_outline"
        size="16px"
        class="text-grey-6"
      />
      <span class="text-caption text-grey-6"> Type <kbd>@</kbd> in editor to insert snippets </span>
      <q-tooltip
        anchor="top middle"
        self="bottom middle"
        max-width="280px"
      >
        <div class="snippets-help">
          <div class="snippets-help__title">Insert Snippets in Editor</div>
          <div class="snippets-help__section">
            <div class="snippets-help__row">
              <kbd>@</kbd>
              <span>All snippets (universal)</span>
            </div>
            <div class="snippets-help__row">
              <kbd>#</kbd>
              <span>Text snippets only</span>
            </div>
            <div class="snippets-help__row">
              <kbd>$</kbd>
              <span>Code snippets only</span>
            </div>
            <div class="snippets-help__row">
              <kbd>!</kbd>
              <span>Templates only</span>
            </div>
          </div>
          <div class="snippets-help__tip">Start typing after the trigger to filter results</div>
        </div>
      </q-tooltip>
    </div>

    <!-- New Snippet Dialog -->
    <NewSnippetDialog
      v-model="showNewSnippetDialog"
      @create="handleCreateSnippet"
    />

    <!-- Rename Dialog -->
    <RenameDialog
      v-model="showRenameDialog"
      :current-name="renameTarget?.currentName ?? ''"
      :item-type="renameTarget?.snippet ? getRenameItemType(renameTarget.snippet) : 'snippet'"
      @rename="handleRename"
    />
  </div>
</template>

<style lang="scss" scoped>
.snippets-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color, #3c3c3c);
    flex-shrink: 0;
  }

  &__search {
    flex: 1;

    :deep(.q-field__control) {
      height: 28px;
      min-height: 28px;
    }

    :deep(.q-field__native) {
      font-size: 12px;
      padding: 0;
    }
  }

  &__categories {
    padding: 8px 0;
    border-bottom: 1px solid var(--border-color, #3c3c3c);
    flex-shrink: 0;
  }

  &__category {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    cursor: pointer;
    color: var(--category-text, #cccccc);
    transition: background-color 0.15s;

    &:hover {
      background-color: var(--category-hover, #2a2d2e);
    }

    &--selected {
      background-color: var(--category-selected, #37373d);
    }
  }

  &__category-label {
    flex: 1;
    font-size: 13px;
  }

  &__trigger {
    font-family: monospace;
    font-size: 11px;
    padding: 1px 4px;
    border-radius: 3px;
    background-color: var(--trigger-bg, #3c3c3c);
    color: var(--trigger-color, #9cdcfe);
  }

  &__badge {
    font-size: 10px;
  }

  &__content {
    flex: 1;
    overflow: hidden;
  }

  &__scroll {
    height: 100%;
  }

  &__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100px;
  }

  &__browser-mode {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 150px;
    padding: 20px;
    text-align: center;
  }

  &__list {
    padding: 8px 0;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    cursor: pointer;
    transition: background-color 0.15s;

    &:hover {
      background-color: var(--item-hover, #2a2d2e);

      .snippets-panel__item-actions {
        opacity: 1;
      }
    }
  }

  &__item-icon {
    color: var(--item-icon-color, #9cdcfe);
  }

  &__item-content {
    flex: 1;
    min-width: 0;
  }

  &__item-name {
    font-size: 13px;
    color: var(--item-name-color, #cccccc);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__item-shortcut {
    font-family: monospace;
    font-size: 11px;
    color: var(--item-shortcut-color, #808080);
  }

  &__item-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    border-top: 1px solid var(--border-color, #3c3c3c);
    cursor: help;
    flex-shrink: 0;

    kbd {
      display: inline-block;
      padding: 1px 5px;
      font-family: monospace;
      font-size: 11px;
      background-color: var(--kbd-bg, #3c3c3c);
      border-radius: 3px;
      color: var(--kbd-color, #e0e0e0);
    }
  }
}

// Help tooltip styles (not scoped)
.snippets-help {
  padding: 4px;

  &__title {
    font-weight: 600;
    font-size: 13px;
    margin-bottom: 10px;
    color: #ffffff;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 10px;

    kbd {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      padding: 2px 6px;
      font-family: monospace;
      font-size: 12px;
      font-weight: 600;
      background-color: rgba(255, 255, 255, 0.15);
      border-radius: 4px;
      color: #ffffff;
    }

    span {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.9);
    }
  }

  &__tip {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
    font-style: italic;
  }
}

// Light theme
.body--light .snippets-panel {
  --border-color: #e7e7e7;
  --category-text: #3b3b3b;
  --category-hover: #e8e8e8;
  --category-selected: #e4e4e4;
  --trigger-bg: #e8e8e8;
  --trigger-color: #0550ae;
  --item-hover: #e8e8e8;
  --item-icon-color: #0550ae;
  --item-name-color: #3b3b3b;
  --item-shortcut-color: #6f6f6f;
  --kbd-bg: #e0e0e0;
  --kbd-color: #0550ae;
}

// Dark theme
.body--dark .snippets-panel {
  --border-color: #3c3c3c;
  --category-text: #cccccc;
  --category-hover: #2a2d2e;
  --category-selected: #37373d;
  --trigger-bg: #3c3c3c;
  --trigger-color: #9cdcfe;
  --item-hover: #2a2d2e;
  --item-icon-color: #9cdcfe;
  --item-name-color: #cccccc;
  --item-shortcut-color: #808080;
  --kbd-bg: #3c3c3c;
  --kbd-color: #9cdcfe;
}
</style>
