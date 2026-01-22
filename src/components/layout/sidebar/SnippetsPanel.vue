<script setup lang="ts">
/**
 * SnippetsPanel Component
 *
 * Displays and manages code snippets, personas, and templates.
 * Allows browsing, searching, creating, and inserting snippets.
 */

import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSnippetStore } from '@/stores/snippetStore';
import { usePromptStore } from '@/stores/promptStore';
import { useUIStore, FileCategory } from '@/stores/uiStore';
import type { ISnippetFile, ISnippetMetadata } from '@/services/file-system/types';
import NewSnippetDialog from '@/components/dialogs/NewSnippetDialog.vue';
import RenameDialog from '@/components/dialogs/RenameDialog.vue';

const { t } = useI18n({ useScope: 'global' });

const snippetStore = useSnippetStore();
const promptStore = usePromptStore();
const uiStore = useUIStore();

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

// Selected tags for filtering
const selectedTags = ref<string[]>([]);

// Selected snippet for preview
const selectedSnippet = ref<ISnippetFile | null>(null);
const selectedIndex = ref(-1);

// Ref for the snippet list container (for keyboard navigation focus)
const snippetListRef = ref<HTMLElement | null>(null);

// Snippet categories with counts
const snippetCategories = computed(() => [
  {
    id: 'persona' as const,
    label: t('snippetsPanel.personas'),
    icon: 'person',
    trigger: '@',
    count: snippetStore.personaSnippets.length,
  },
  {
    id: 'text' as const,
    label: t('snippetsPanel.textSnippets'),
    icon: 'text_snippet',
    trigger: '#',
    count: snippetStore.textSnippets.length,
  },
  {
    id: 'code' as const,
    label: t('snippetsPanel.codeSnippets'),
    icon: 'code',
    trigger: '$',
    count: snippetStore.codeSnippets.length,
  },
  {
    id: 'template' as const,
    label: t('snippetsPanel.templates'),
    icon: 'article',
    trigger: '!',
    count: snippetStore.templateSnippets.length,
  },
]);

// All unique tags from all snippets, sorted alphabetically (case-insensitive)
const allTags = computed(() => {
  const tagSet = new Set<string>();
  for (const snippet of snippetStore.allSnippets) {
    for (const tag of snippet.metadata.tags) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
});

// Tag options for the q-select component
const tagOptions = computed(() => allTags.value);

// Filtered tag options based on search input (with diacritics support)
const filteredTagOptions = ref<string[]>([]);

// Filter function for tag select (handles diacritics)
function filterTags(val: string, update: (fn: () => void) => void): void {
  update(() => {
    if (val === '') {
      filteredTagOptions.value = tagOptions.value;
    } else {
      const needle = val.toLowerCase();
      filteredTagOptions.value = tagOptions.value.filter((tag) =>
        tag
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .includes(needle.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
      );
    }
  });
}

// Clear selected tags
function clearTags(): void {
  selectedTags.value = [];
}

// Filtered snippets based on category, tags, and search
const filteredSnippets = computed(() => {
  let snippets = snippetStore.allSnippets;

  // Filter by category
  if (selectedCategory.value !== null) {
    snippets = snippets.filter((s) => s.metadata.type === selectedCategory.value);
  }

  // Filter by selected tags (snippet must have ALL selected tags)
  if (selectedTags.value.length > 0) {
    snippets = snippets.filter((s) =>
      selectedTags.value.every((tag) =>
        s.metadata.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
      )
    );
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

// Check if preview pane is open
const isPreviewOpen = computed(() => selectedSnippet.value !== null);

// Preview content - syncs with editor if snippet is open there
const previewContent = computed(() => {
  if (!selectedSnippet.value) return '';

  // Check if the snippet is open in the editor (promptStore has the live content)
  const editorContent = promptStore.getFileContent(selectedSnippet.value.filePath);
  if (editorContent !== undefined) {
    return editorContent;
  }

  // Fall back to snippet's own content
  return selectedSnippet.value.content;
});

// Select/deselect category
function selectCategory(id: ISnippetMetadata['type']): void {
  selectedCategory.value = selectedCategory.value === id ? null : id;
  // Reset selection when category changes
  selectedSnippet.value = null;
  selectedIndex.value = -1;
}

// Select a snippet for preview
async function selectSnippet(snippet: ISnippetFile, index: number): Promise<void> {
  selectedIndex.value = index;

  // If content is empty, try loading from file
  if (!snippet.content || snippet.content.trim() === '') {
    try {
      const loadedSnippet = await snippetStore.loadSnippet(snippet.filePath);
      selectedSnippet.value = loadedSnippet;
    } catch (err) {
      console.warn('Failed to load snippet content:', err);
      selectedSnippet.value = snippet;
    }
  } else {
    selectedSnippet.value = snippet;
  }

  // Keep focus on the list for keyboard navigation
  void nextTick(() => {
    snippetListRef.value?.focus();
  });
}

// Close the preview pane
function closePreview(): void {
  selectedSnippet.value = null;
  selectedIndex.value = -1;
}

// Keyboard navigation handler
async function handleKeyDown(event: KeyboardEvent): Promise<void> {
  if (filteredSnippets.value.length === 0) return;

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      if (selectedIndex.value < filteredSnippets.value.length - 1) {
        await selectSnippet(
          filteredSnippets.value[selectedIndex.value + 1],
          selectedIndex.value + 1
        );
        scrollToSelectedItem();
      } else if (selectedIndex.value === -1) {
        await selectSnippet(filteredSnippets.value[0], 0);
        scrollToSelectedItem();
      }
      break;
    case 'ArrowUp':
      event.preventDefault();
      if (selectedIndex.value > 0) {
        await selectSnippet(
          filteredSnippets.value[selectedIndex.value - 1],
          selectedIndex.value - 1
        );
        scrollToSelectedItem();
      }
      break;
    case 'Escape':
      event.preventDefault();
      closePreview();
      break;
    case 'Enter':
      event.preventDefault();
      if (selectedSnippet.value) {
        insertSnippet(selectedSnippet.value);
      }
      break;
  }
}

// Scroll to keep selected item visible
function scrollToSelectedItem(): void {
  void nextTick(() => {
    const selectedElement = snippetListRef.value?.querySelector('.snippets-panel__item--selected');
    selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    // Ensure the list keeps focus for continued keyboard navigation
    snippetListRef.value?.focus();
  });
}

// Watch for filtered snippets changes to reset selection if needed
watch(filteredSnippets, (newSnippets) => {
  if (selectedSnippet.value) {
    // Check if selected snippet is still in filtered list
    const stillExists = newSnippets.some((s) => s.filePath === selectedSnippet.value?.filePath);
    if (!stillExists) {
      selectedSnippet.value = null;
      selectedIndex.value = -1;
    } else {
      // Update index if list changed
      selectedIndex.value = newSnippets.findIndex(
        (s) => s.filePath === selectedSnippet.value?.filePath
      );
    }
  }
});

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

// Open snippet in editor tab
async function openSnippet(snippet: ISnippetFile): Promise<void> {
  try {
    // Load the snippet to ensure we have the latest data
    const loadedSnippet = await snippetStore.loadSnippet(snippet.filePath);

    // Open a tab for the snippet
    uiStore.openTab({
      filePath: loadedSnippet.filePath,
      fileName: loadedSnippet.fileName,
      title: loadedSnippet.metadata.name,
      isDirty: false,
      isPinned: false,
      fileCategory: FileCategory.MARKDOWN,
    });
  } catch (err) {
    console.error('Failed to open snippet:', err);
  }
}

// Delete snippet
async function deleteSnippet(snippet: ISnippetFile): Promise<void> {
  try {
    // Close preview if we're deleting the selected snippet
    if (selectedSnippet.value?.filePath === snippet.filePath) {
      closePreview();
    }
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

// Handle rename (for backwards compatibility with non-snippet items)
async function handleRename(newName: string): Promise<void> {
  if (!renameTarget.value) return;

  try {
    await snippetStore.renameSnippet(renameTarget.value.snippet.filePath, newName);
  } catch (err) {
    console.error('Failed to rename snippet:', err);
  }
}

// Handle save (for snippets with name, description, tags)
async function handleSaveSnippet(result: {
  name: string;
  description?: string;
  tags?: string[];
}): Promise<void> {
  if (!renameTarget.value) return;

  const snippet = renameTarget.value.snippet;
  let currentFilePath = snippet.filePath;

  try {
    const nameChanged = result.name !== snippet.metadata.name;
    const descriptionChanged = result.description !== (snippet.metadata.description ?? '');
    const tagsChanged =
      JSON.stringify([...(result.tags ?? [])].sort()) !==
      JSON.stringify([...(snippet.metadata.tags ?? [])].sort());

    // If name changed, rename first (this also loads it into cache and returns new path)
    if (nameChanged) {
      const renameResult = await snippetStore.renameSnippet(currentFilePath, result.name);
      currentFilePath = renameResult.newFilePath;
    }

    // Update description and tags if changed
    if (descriptionChanged || tagsChanged) {
      // Load the snippet into cache first (required by updateSnippetMetadata)
      await snippetStore.loadSnippet(currentFilePath);

      // Now update the metadata
      await snippetStore.updateSnippetMetadata(currentFilePath, {
        description: result.description,
        tags: result.tags,
      });
    }

    // Refresh the snippet list to show updated tags
    await snippetStore.refreshAllSnippets();
  } catch (err) {
    console.error('Failed to save snippet:', err);
  }
}

// Handle new snippet creation
async function handleCreateSnippet(data: {
  name: string;
  type: ISnippetMetadata['type'];
  description: string;
  tags: string[];
}): Promise<void> {
  try {
    await snippetStore.createSnippet(data.name, data.type, '', data.tags);
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

// Cleanup keyboard listeners
onUnmounted(() => {
  // Remove any global listeners if needed
});
</script>

<template>
  <div
    class="snippets-panel"
    data-testid="snippets-panel"
  >
    <!-- Header with search and add button -->
    <div class="snippets-panel__header">
      <q-input
        v-model="searchQuery"
        :placeholder="t('snippetsPanel.searchPlaceholder')"
        outlined
        dense
        clearable
        class="snippets-panel__search"
        data-testid="snippet-search"
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
        data-testid="new-snippet-btn"
        @click="showNewSnippetDialog = true"
      >
        <q-tooltip>{{ t('snippetsPanel.createNew') }}</q-tooltip>
      </q-btn>
    </div>

    <!-- Category filters -->
    <div
      class="snippets-panel__categories"
      data-testid="snippet-type-filter"
    >
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
        <q-badge
          v-if="category.count > 0"
          :label="category.count"
          color="primary"
          class="snippets-panel__badge"
        />
        <span class="snippets-panel__trigger">{{ category.trigger }}</span>
      </div>
    </div>

    <!-- Tag filter -->
    <div
      v-if="allTags.length > 0"
      class="snippets-panel__tag-filter"
    >
      <q-select
        v-model="selectedTags"
        :options="filteredTagOptions"
        multiple
        use-chips
        use-input
        clearable
        dense
        outlined
        input-debounce="0"
        :placeholder="
          selectedTags.length === 0 ? t('snippetsPanel.filterByTags') || 'Filter by tags...' : ''
        "
        class="snippets-panel__tag-select"
        popup-content-class="snippets-panel__tag-popup"
        @filter="filterTags"
        @clear="clearTags"
      >
        <template #prepend>
          <q-icon
            name="sell"
            size="18px"
          />
        </template>
        <template #selected-item="scope">
          <q-chip
            dense
            removable
            size="sm"
            color="primary"
            text-color="white"
            class="q-my-none q-ml-none q-mr-xs"
            @remove="scope.removeAtIndex(scope.index)"
          >
            {{ scope.opt }}
          </q-chip>
        </template>
        <template #no-option>
          <q-item>
            <q-item-section class="text-grey">
              {{ t('snippetsPanel.noTagsFound') || 'No tags found' }}
            </q-item-section>
          </q-item>
        </template>
      </q-select>
    </div>

    <!-- Main content area with list and preview -->
    <div :class="['snippets-panel__main', { 'snippets-panel__main--with-preview': isPreviewOpen }]">
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
              {{ t('snippetsPanel.browserMode') }}
            </p>
            <p class="text-grey-7 text-caption text-center q-mt-sm">
              {{ t('snippetsPanel.browserModeHint') }}
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
              {{ t('snippetsPanel.noSnippets') }} {{ t('snippetsPanel.noSnippetsHint') }}
            </p>
            <p
              v-else-if="searchQuery"
              class="text-grey-6 text-caption"
            >
              {{ t('snippetsPanel.noMatchingSnippets') }}
            </p>
            <p
              v-else
              class="text-grey-6 text-caption"
            >
              {{ t('snippetsPanel.noCategorySnippets') }}
            </p>
          </div>

          <!-- Snippet items -->
          <div
            v-else
            ref="snippetListRef"
            class="snippets-panel__list"
            data-testid="snippet-list"
            tabindex="0"
            @keydown="handleKeyDown"
          >
            <div
              v-for="(snippet, index) in filteredSnippets"
              :key="snippet.filePath"
              :class="[
                'snippets-panel__item',
                {
                  'snippets-panel__item--selected': selectedSnippet?.filePath === snippet.filePath,
                },
              ]"
              data-testid="snippet-item"
              @click="selectSnippet(snippet, index)"
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
                <div
                  v-if="snippet.metadata.tags.length > 0"
                  class="snippets-panel__item-tags"
                >
                  <q-chip
                    v-for="tag in snippet.metadata.tags"
                    :key="tag"
                    dense
                    size="xs"
                    color="grey-7"
                    text-color="white"
                    class="snippets-panel__item-tag"
                  >
                    {{ tag }}
                  </q-chip>
                </div>
              </div>
              <div
                v-if="!isPreviewOpen"
                class="snippets-panel__item-actions"
              >
                <q-btn
                  flat
                  dense
                  round
                  size="sm"
                  icon="open_in_new"
                  @click.stop="openSnippet(snippet)"
                >
                  <q-tooltip>{{ t('common.open') }}</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  dense
                  round
                  size="sm"
                  icon="content_copy"
                  @click.stop="copyShortcut(snippet)"
                >
                  <q-tooltip>{{ t('snippetsPanel.copyShortcut') }}</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  dense
                  round
                  size="sm"
                  icon="add_box"
                  @click.stop="insertSnippet(snippet)"
                >
                  <q-tooltip>{{ t('snippetsPanel.copyContent') }}</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  dense
                  round
                  size="sm"
                  icon="edit"
                  @click.stop="openRenameDialog(snippet)"
                >
                  <q-tooltip>{{ t('common.rename') }}</q-tooltip>
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
                  <q-tooltip>{{ t('common.delete') }}</q-tooltip>
                </q-btn>
              </div>
            </div>
          </div>
        </q-scroll-area>
      </div>

      <!-- Preview pane -->
      <div
        v-if="isPreviewOpen"
        class="snippets-panel__preview"
      >
        <div class="snippets-panel__preview-header">
          <div class="snippets-panel__preview-title">
            <q-icon
              :name="getSnippetIcon(selectedSnippet!.metadata.type)"
              size="18px"
              class="q-mr-sm"
            />
            {{ selectedSnippet!.metadata.name }}
          </div>
          <q-btn
            flat
            dense
            round
            size="sm"
            icon="close"
            @click="closePreview"
          >
            <q-tooltip>{{ t('common.close') }}</q-tooltip>
          </q-btn>
        </div>
        <div class="snippets-panel__preview-meta">
          <div class="snippets-panel__preview-meta-row">
            <span class="snippets-panel__preview-shortcut">{{
              selectedSnippet!.metadata.shortcut
            }}</span>
            <div class="snippets-panel__preview-actions">
              <q-btn
                flat
                dense
                round
                size="sm"
                icon="open_in_new"
                @click="openSnippet(selectedSnippet!)"
              >
                <q-tooltip>{{ t('common.open') }}</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                size="sm"
                icon="content_copy"
                @click="copyShortcut(selectedSnippet!)"
              >
                <q-tooltip>{{ t('snippetsPanel.copyShortcut') }}</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                size="sm"
                icon="add_box"
                @click="insertSnippet(selectedSnippet!)"
              >
                <q-tooltip>{{ t('snippetsPanel.copyContent') }}</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                size="sm"
                icon="edit"
                @click="openRenameDialog(selectedSnippet!)"
              >
                <q-tooltip>{{ t('common.rename') }}</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                size="sm"
                icon="delete"
                color="negative"
                @click="deleteSnippet(selectedSnippet!)"
              >
                <q-tooltip>{{ t('common.delete') }}</q-tooltip>
              </q-btn>
            </div>
          </div>
          <span
            v-if="selectedSnippet!.metadata.description"
            class="snippets-panel__preview-description"
          >
            {{ selectedSnippet!.metadata.description }}
          </span>
        </div>
        <q-scroll-area class="snippets-panel__preview-content">
          <pre class="snippets-panel__preview-code">{{ previewContent }}</pre>
        </q-scroll-area>
      </div>
    </div>

    <!-- Help footer -->
    <div class="snippets-panel__footer">
      <div class="snippets-panel__help-trigger">
        <q-icon
          name="help_outline"
          size="16px"
          class="text-grey-6"
        />
        <q-tooltip
          anchor="top middle"
          self="bottom middle"
          max-width="280px"
        >
          <div class="snippets-help">
            <div class="snippets-help__title">{{ t('snippetsPanel.triggerHelp.title') }}</div>
            <div class="snippets-help__section">
              <div class="snippets-help__row">
                <kbd>@</kbd>
                <span>{{ t('snippetsPanel.triggerHelp.all') }}</span>
              </div>
              <div class="snippets-help__row">
                <kbd>#</kbd>
                <span>{{ t('snippetsPanel.triggerHelp.text') }}</span>
              </div>
              <div class="snippets-help__row">
                <kbd>$</kbd>
                <span>{{ t('snippetsPanel.triggerHelp.code') }}</span>
              </div>
              <div class="snippets-help__row">
                <kbd>!</kbd>
                <span>{{ t('snippetsPanel.triggerHelp.templates') }}</span>
              </div>
              <div class="snippets-help__row">
                <kbd>^</kbd>
                <span>{{ t('snippetsPanel.triggerHelp.files') }}</span>
              </div>
            </div>
            <div class="snippets-help__tip">{{ t('snippetsPanel.triggerHelp.tip') }}</div>
          </div>
        </q-tooltip>
      </div>
      <span class="text-caption text-grey-6">{{ t('snippetsPanel.insertTip') }}</span>
    </div>

    <!-- New Snippet Dialog -->
    <NewSnippetDialog
      v-model="showNewSnippetDialog"
      @create="handleCreateSnippet"
    />

    <!-- Rename/Edit Dialog -->
    <RenameDialog
      v-model="showRenameDialog"
      :current-name="renameTarget?.currentName ?? ''"
      :current-description="renameTarget?.snippet?.metadata.description ?? ''"
      :current-tags="renameTarget?.snippet?.metadata.tags ?? []"
      :item-type="renameTarget?.snippet ? getRenameItemType(renameTarget.snippet) : 'snippet'"
      @rename="handleRename"
      @save="handleSaveSnippet"
    />
  </div>
</template>

<style lang="scss" scoped>
.snippets-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-width: 0;
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

    :deep(.q-field__native) {
      font-size: 12px;
    }
  }

  &__categories {
    padding: 8px 0;
    border-bottom: 1px solid var(--border-color, #3c3c3c);
    flex-shrink: 0;
  }

  &__tag-filter {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color, #3c3c3c);
    flex-shrink: 0;
  }

  &__tag-select {
    :deep(.q-field__native) {
      font-size: 12px;
      min-height: 24px;
    }

    :deep(.q-field__control) {
      min-height: 32px;
    }

    :deep(.q-chip) {
      font-size: 11px;
    }

    :deep(.q-field__prepend) {
      padding-right: 8px;
    }
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

  &__main {
    display: flex;
    flex: 1;
    overflow: hidden;

    &--with-preview {
      .snippets-panel__content {
        flex: 0 0 40%;
        min-width: 200px;
        border-right: 1px solid var(--border-color, #3c3c3c);
      }

      .snippets-panel__preview {
        flex: 1;
      }
    }
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
    outline: none;

    &:focus {
      outline: none;
    }
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

    &--selected {
      background-color: var(--item-selected, #094771);

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

  &__item-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    margin-top: 3px;
  }

  &__item-tag {
    font-size: 9px !important;
    height: 16px !important;
    min-height: 16px !important;
    padding: 0 6px !important;

    :deep(.q-chip__content) {
      font-size: 9px;
    }
  }

  &__item-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  // Preview pane styles
  &__preview {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background-color: var(--preview-bg, #1e1e1e);
  }

  &__preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color, #3c3c3c);
    flex-shrink: 0;
  }

  &__preview-title {
    display: flex;
    align-items: center;
    font-size: 13px;
    font-weight: 500;
    color: var(--preview-title-color, #ffffff);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__preview-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color, #3c3c3c);
    flex-shrink: 0;
  }

  &__preview-meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  &__preview-shortcut {
    font-family: monospace;
    font-size: 12px;
    color: var(--preview-shortcut-color, #9cdcfe);
  }

  &__preview-actions {
    display: flex;
    gap: 2px;
  }

  &__preview-description {
    font-size: 12px;
    color: var(--preview-description-color, #808080);
  }

  &__preview-content {
    flex: 1;
    overflow: hidden;
  }

  &__preview-code {
    margin: 0;
    padding: 12px;
    font-family:
      'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.5;
    color: var(--preview-code-color, #d4d4d4);
    white-space: pre-wrap;
    word-break: break-word;
    background: transparent;
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    border-top: 1px solid var(--border-color, #3c3c3c);
    flex-shrink: 0;
  }

  &__help-trigger {
    display: flex;
    align-items: center;
    cursor: help;
    padding: 2px;
    border-radius: 4px;

    &:hover {
      background-color: var(--item-hover-bg, rgba(255, 255, 255, 0.1));
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
  --item-selected: #cce5ff;
  --item-icon-color: #0550ae;
  --item-name-color: #3b3b3b;
  --item-shortcut-color: #6f6f6f;
  --kbd-bg: #e0e0e0;
  --kbd-color: #0550ae;
  --preview-bg: #f5f5f5;
  --preview-title-color: #3b3b3b;
  --preview-shortcut-color: #0550ae;
  --preview-description-color: #6f6f6f;
  --preview-code-color: #3b3b3b;
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
  --item-selected: #094771;
  --item-icon-color: #9cdcfe;
  --item-name-color: #cccccc;
  --item-shortcut-color: #808080;
  --kbd-bg: #3c3c3c;
  --kbd-color: #9cdcfe;
  --preview-bg: #1e1e1e;
  --preview-title-color: #ffffff;
  --preview-shortcut-color: #9cdcfe;
  --preview-description-color: #808080;
  --preview-code-color: #d4d4d4;
}
</style>
