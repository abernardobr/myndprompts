<script setup lang="ts">
/**
 * EditorPane Component
 *
 * A single editor pane with its own tab bar and Monaco editor.
 * Used within EditorArea to support split view functionality.
 */

import { ref, computed, watch, nextTick, onMounted, inject } from 'vue';
import { useUIStore, type IEditorPane, type IOpenTab } from '@/stores/uiStore';
import { usePrompts } from '@/composables/usePrompts';
import { useAutoSave } from '@/composables/useAutoSave';
import { useQuasar } from 'quasar';
import MonacoEditor from '@/components/editor/MonacoEditor.vue';
import MarkdownPreview from '@/components/editor/MarkdownPreview.vue';
import FileViewer from '@/components/viewers/FileViewer.vue';
import { FileCategory, getMonacoLanguage } from '@services/file-system/file-types';

// Interface for MonacoEditor exposed methods
interface IMonacoEditorExposed {
  layout: () => void;
}

interface Props {
  pane: IEditorPane;
  isActive: boolean;
  showCloseButton?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showCloseButton: true,
});

const emit = defineEmits<{
  (e: 'focus'): void;
  (e: 'close'): void;
  (e: 'split', direction: 'horizontal' | 'vertical'): void;
}>();

const $q = useQuasar();
const uiStore = useUIStore();
const prompts = usePrompts();

// Helper to save any file type
async function saveAnyFile(filePath: string): Promise<void> {
  // Find the tab to determine file category
  const tab = props.pane.tabs.find((t) => t.filePath === filePath);
  const category = tab?.fileCategory ?? FileCategory.MARKDOWN;
  if (category === FileCategory.MARKDOWN) {
    await prompts.savePrompt(filePath);
  } else {
    await prompts.saveGenericFile(filePath);
  }
}

// Auto-save setup for this pane
const autoSave = useAutoSave({
  onSave: async (filePath: string) => {
    await saveAnyFile(filePath);
  },
  onSaveError: (filePath: string, error: Error) => {
    console.error('[AutoSave] Failed to save:', filePath, error);
    showError(`Auto-save failed: ${error.message}`);
  },
});

// Editor ref with exposed methods
const editorRef = ref<IMonacoEditorExposed | null>(null);

// Drag state for tabs
const draggedTab = ref<IOpenTab | null>(null);
const dragOverIndex = ref<number | null>(null);

// Loading state
const isLoadingContent = ref(false);

// Computed properties
const tabs = computed(() => props.pane.tabs);
const activeTabId = computed(() => props.pane.activeTabId);
const activeTab = computed(() => tabs.value.find((t) => t.id === activeTabId.value));

const activeContent = computed({
  get: () => {
    if (!activeTab.value) return '';
    const content = prompts.getFileContent(activeTab.value.filePath);
    if (content !== undefined) return content;
    // Only provide default content for markdown files
    const category = activeTab.value.fileCategory ?? FileCategory.MARKDOWN;
    if (category === FileCategory.MARKDOWN) {
      return getDefaultContent(activeTab.value.title);
    }
    return '';
  },
  set: (value: string) => {
    if (activeTab.value) {
      const category = activeTab.value.fileCategory ?? FileCategory.MARKDOWN;
      if (category === FileCategory.MARKDOWN) {
        prompts.updateContent(activeTab.value.filePath, value);
      } else {
        prompts.updateFileContent(activeTab.value.filePath, value);
      }
    }
  },
});

// Check if active tab is a text/code file that should be edited in Monaco
const isTextFile = computed(() => {
  if (!activeTab.value) return false;
  // Default to markdown for legacy tabs that don't have fileCategory set
  const category = activeTab.value.fileCategory ?? FileCategory.MARKDOWN;
  return category === FileCategory.MARKDOWN || category === FileCategory.CODE;
});

// Check if active tab is a markdown file (supports preview)
const isMarkdownFile = computed(() => {
  if (!activeTab.value) return false;
  const category = activeTab.value.fileCategory ?? FileCategory.MARKDOWN;
  return category === FileCategory.MARKDOWN;
});

// View mode for markdown files: 'edit' or 'preview'
type ViewMode = 'edit' | 'preview';
const viewMode = ref<ViewMode>('edit');

// Toggle between edit and preview mode
function toggleViewMode(): void {
  viewMode.value = viewMode.value === 'edit' ? 'preview' : 'edit';
}

// Reset to edit mode when changing tabs
watch(activeTabId, () => {
  viewMode.value = 'edit';
});

// Get the Monaco Editor language based on file extension
const editorLanguage = computed(() => {
  if (!activeTab.value) return 'markdown';
  return getMonacoLanguage(activeTab.value.filePath);
});

// Generate default content for new files
function getDefaultContent(title: string): string {
  return `---
title: ${title}
description: A brief description of this prompt
tags:
  - general
---

# ${title}

Write your prompt content here...
`;
}

// Handle content changes
function handleContentChange(content: string): void {
  if (activeTab.value) {
    prompts.updateContent(activeTab.value.filePath, content);
    autoSave.scheduleAutoSave(activeTab.value.filePath);
  }
}

// Handle content updates from preview (e.g., checkbox toggles)
function handlePreviewContentUpdate(content: string): void {
  if (activeTab.value) {
    prompts.updateContent(activeTab.value.filePath, content);
    autoSave.scheduleAutoSave(activeTab.value.filePath);
  }
}

// Handle save
async function handleSave(): Promise<void> {
  if (activeTab.value) {
    autoSave.cancelAutoSave(activeTab.value.filePath);
    try {
      await saveAnyFile(activeTab.value.filePath);
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  }
}

// Show error notification
function showError(message: string): void {
  $q.notify({
    type: 'negative',
    message,
    position: 'top',
    timeout: 4000,
  });
}

// Load content when active tab changes
watch(
  activeTab,
  async (newTab) => {
    if (!newTab) return;

    // Only load content for text/code files (handled by prompts composable)
    // Non-text files (images, videos, etc.) are handled by FileViewer component internally
    const category = newTab.fileCategory ?? FileCategory.MARKDOWN;
    if (category !== FileCategory.MARKDOWN && category !== FileCategory.CODE) {
      return;
    }

    const existingContent = prompts.getFileContent(newTab.filePath);
    if (existingContent !== undefined) {
      await nextTick();
      editorRef.value?.layout?.();
      return;
    }

    try {
      isLoadingContent.value = true;
      // Use different loading method based on file category
      if (category === FileCategory.MARKDOWN) {
        await prompts.openPrompt(newTab.filePath);
      } else {
        await prompts.openFile(newTab.filePath);
      }
    } catch (error) {
      console.error('Failed to load file:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
        uiStore.closeTabInPane(newTab.id, props.pane.id);
        showError(`File not found: ${newTab.fileName}`);
      }
    } finally {
      isLoadingContent.value = false;
      await nextTick();
      editorRef.value?.layout?.();
    }
  },
  { immediate: true }
);

// Tab actions
function selectTab(tabId: string): void {
  uiStore.setActiveTabInPane(tabId, props.pane.id);
  emit('focus');
}

function closeTab(tabId: string, event: Event): void {
  event.stopPropagation();
  autoSave.cleanupFile(tabs.value.find((t) => t.id === tabId)?.filePath ?? '');
  uiStore.closeTabInPane(tabId, props.pane.id);
}

function closeOtherTabs(tabId: string): void {
  const tabsToClose = tabs.value.filter((t) => t.id !== tabId);
  tabsToClose.forEach((t) => {
    autoSave.cleanupFile(t.filePath);
    uiStore.closeTabInPane(t.id, props.pane.id);
  });
}

function closeAllTabs(): void {
  // Create a copy of the tabs array to avoid mutation during iteration
  const tabsToClose = [...tabs.value];
  tabsToClose.forEach((t) => {
    autoSave.cleanupFile(t.filePath);
  });
  tabsToClose.forEach((t) => {
    uiStore.closeTabInPane(t.id, props.pane.id);
  });
}

function pinTab(tabId: string): void {
  uiStore.pinTab(tabId);
}

function unpinTab(tabId: string): void {
  uiStore.unpinTab(tabId);
}

// Drag and drop handlers
function onDragStart(event: DragEvent, tab: IOpenTab, _index: number): void {
  draggedTab.value = tab;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', tab.id);
    event.dataTransfer.setData('application/x-pane-id', props.pane.id);
  }
}

function onDragOver(event: DragEvent, index: number): void {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
  dragOverIndex.value = index;
}

function onDragLeave(): void {
  dragOverIndex.value = null;
}

function onDrop(event: DragEvent, toIndex: number): void {
  event.preventDefault();
  const sourcePaneId = event.dataTransfer?.getData('application/x-pane-id');
  const tabId = event.dataTransfer?.getData('text/plain');

  if (tabId) {
    if (sourcePaneId === props.pane.id && draggedTab.value) {
      // Reorder within same pane
      const fromIndex = tabs.value.findIndex((t) => t.id === draggedTab.value?.id);
      if (fromIndex !== -1 && fromIndex !== toIndex) {
        uiStore.reorderTabsInPane(fromIndex, toIndex, props.pane.id);
      }
    } else if (sourcePaneId && sourcePaneId !== props.pane.id) {
      // Move from different pane
      uiStore.moveTabToPane(tabId, props.pane.id);
    }
  }

  draggedTab.value = null;
  dragOverIndex.value = null;
}

function onDragEnd(): void {
  draggedTab.value = null;
  dragOverIndex.value = null;
}

// Split actions
function splitRight(): void {
  emit('split', 'horizontal');
}

function splitDown(): void {
  emit('split', 'vertical');
}

// Inject settings dialog opener from MainLayout
const openSettingsDialog = inject<() => void>('openSettingsDialog');

// Settings action
function handleSettingsClick(): void {
  openSettingsDialog?.();
}

// File icon helper
function getFileIcon(fileName: string): string {
  const lowerName = fileName.toLowerCase();
  // Special markdown types
  if (lowerName.endsWith('.snippet.md')) return 'code';
  if (lowerName.endsWith('.persona.md')) return 'person';
  if (lowerName.endsWith('.template.md')) return 'article';
  if (lowerName.endsWith('.md')) return 'description';
  // Images
  if (/\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/.test(lowerName)) return 'image';
  // Videos
  if (/\.(mp4|webm|mov|avi|mkv)$/.test(lowerName)) return 'movie';
  // Audio
  if (/\.(mp3|wav|ogg|flac|aac|m4a)$/.test(lowerName)) return 'audiotrack';
  // Documents
  if (/\.(pdf|doc|docx)$/.test(lowerName)) return 'article';
  // Spreadsheets
  if (/\.(xls|xlsx|csv)$/.test(lowerName)) return 'grid_on';
  // Default
  return 'insert_drive_file';
}

// Handle pane click to set it as active
function handlePaneClick(): void {
  if (!props.isActive) {
    emit('focus');
  }
}

// Expose layout method for parent to trigger resize
function layout(): void {
  editorRef.value?.layout?.();
}

defineExpose({ layout });

onMounted(() => {
  // Ensure content is loaded for initial text/code tab
  if (activeTab.value) {
    const category = activeTab.value.fileCategory ?? FileCategory.MARKDOWN;
    if (category === FileCategory.MARKDOWN || category === FileCategory.CODE) {
      const existingContent = prompts.getFileContent(activeTab.value.filePath);
      if (existingContent === undefined) {
        if (category === FileCategory.MARKDOWN) {
          void prompts.openPrompt(activeTab.value.filePath);
        } else {
          void prompts.openFile(activeTab.value.filePath);
        }
      }
    }
  }
});
</script>

<template>
  <div
    :class="['editor-pane', { 'editor-pane--active': isActive }]"
    data-testid="editor-pane"
    @click="handlePaneClick"
  >
    <!-- Tab bar for this pane -->
    <div class="editor-pane__tab-bar">
      <div class="editor-pane__tabs">
        <div
          v-for="(tab, index) in tabs"
          :key="tab.id"
          :class="[
            'editor-pane__tab',
            {
              'editor-pane__tab--active': activeTabId === tab.id,
              'editor-pane__tab--pinned': tab.isPinned,
              'editor-pane__tab--dirty': tab.isDirty,
              'editor-pane__tab--drag-over': dragOverIndex === index,
            },
          ]"
          draggable="true"
          @click="selectTab(tab.id)"
          @dragstart="onDragStart($event, tab, index)"
          @dragover="onDragOver($event, index)"
          @dragleave="onDragLeave"
          @drop="onDrop($event, index)"
          @dragend="onDragEnd"
        >
          <q-icon
            v-if="tab.isPinned"
            name="push_pin"
            size="14px"
            class="editor-pane__pin-icon"
          />
          <q-icon
            :name="getFileIcon(tab.fileName)"
            size="16px"
            class="editor-pane__file-icon"
          />
          <span class="editor-pane__tab-title">{{ tab.title }}</span>
          <span
            v-if="tab.isDirty"
            class="editor-pane__dirty-indicator"
            >●</span
          >
          <q-btn
            v-if="!tab.isPinned"
            flat
            dense
            round
            size="xs"
            icon="close"
            class="editor-pane__close-btn"
            @click="closeTab(tab.id, $event)"
          >
            <q-tooltip>Close</q-tooltip>
          </q-btn>

          <!-- Tab context menu -->
          <q-menu context-menu>
            <q-list
              dense
              style="min-width: 180px"
            >
              <q-item
                v-close-popup
                clickable
                @click="closeTab(tab.id, $event)"
              >
                <q-item-section>Close</q-item-section>
                <q-item-section side>
                  <span class="text-grey-6 text-caption">Ctrl+W</span>
                </q-item-section>
              </q-item>
              <q-item
                v-close-popup
                clickable
                @click="closeOtherTabs(tab.id)"
              >
                <q-item-section>Close Others</q-item-section>
              </q-item>
              <q-item
                v-close-popup
                clickable
                @click="closeAllTabs"
              >
                <q-item-section>Close All</q-item-section>
              </q-item>
              <q-separator />
              <q-item
                v-if="!tab.isPinned"
                v-close-popup
                clickable
                @click="pinTab(tab.id)"
              >
                <q-item-section>Pin Tab</q-item-section>
              </q-item>
              <q-item
                v-else
                v-close-popup
                clickable
                @click="unpinTab(tab.id)"
              >
                <q-item-section>Unpin Tab</q-item-section>
              </q-item>
              <q-separator />
              <q-item
                v-close-popup
                clickable
                @click="splitRight"
              >
                <q-item-section avatar>
                  <q-icon
                    name="vertical_split"
                    size="18px"
                  />
                </q-item-section>
                <q-item-section>Split Right</q-item-section>
              </q-item>
              <q-item
                v-close-popup
                clickable
                @click="splitDown"
              >
                <q-item-section avatar>
                  <q-icon
                    name="horizontal_split"
                    size="18px"
                  />
                </q-item-section>
                <q-item-section>Split Down</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-if="tabs.length === 0"
        class="editor-pane__empty"
      >
        <span class="text-grey-6 text-caption">No files open</span>
      </div>

      <!-- Tab bar actions -->
      <div class="editor-pane__actions">
        <!-- Preview/Edit toggle for markdown files -->
        <q-btn
          v-if="isMarkdownFile && activeTab"
          flat
          dense
          round
          size="sm"
          :icon="viewMode === 'edit' ? 'visibility' : 'edit'"
          @click="toggleViewMode"
        >
          <q-tooltip>{{ viewMode === 'edit' ? 'Preview' : 'Edit' }}</q-tooltip>
        </q-btn>
        <q-btn
          flat
          dense
          round
          size="sm"
          icon="vertical_split"
          @click="splitRight"
        >
          <q-tooltip>Split Right</q-tooltip>
        </q-btn>
        <q-btn
          flat
          dense
          round
          size="sm"
          icon="horizontal_split"
          @click="splitDown"
        >
          <q-tooltip>Split Down</q-tooltip>
        </q-btn>
        <q-btn
          v-if="showCloseButton"
          flat
          dense
          round
          size="sm"
          icon="close"
          @click="$emit('close')"
        >
          <q-tooltip>Close Pane</q-tooltip>
        </q-btn>
        <q-btn
          flat
          dense
          round
          size="sm"
          icon="settings"
          class="editor-pane__settings-btn"
          @click="handleSettingsClick"
        >
          <q-tooltip>Settings (Ctrl+,)</q-tooltip>
        </q-btn>
      </div>
    </div>

    <!-- Editor content -->
    <div class="editor-pane__content">
      <!-- Loading indicator -->
      <div
        v-if="isLoadingContent"
        class="editor-pane__loading"
      >
        <q-spinner-dots
          color="primary"
          size="40px"
        />
      </div>

      <!-- Markdown Preview mode -->
      <div
        v-else-if="activeTab && isMarkdownFile && viewMode === 'preview'"
        class="editor-pane__preview"
      >
        <MarkdownPreview
          :content="activeContent"
          :file-path="activeTab.filePath"
          @update:content="handlePreviewContentUpdate"
        />
      </div>

      <!-- Monaco Editor for text/code files -->
      <div
        v-else-if="activeTab && isTextFile"
        class="editor-pane__editor"
      >
        <MonacoEditor
          ref="editorRef"
          v-model="activeContent"
          :tab-id="activeTab.id"
          :file-path="activeTab.filePath"
          :language="editorLanguage"
          minimap
          word-wrap="on"
          @change="handleContentChange"
          @save="handleSave"
        />
      </div>

      <!-- FileViewer for other file types -->
      <div
        v-else-if="activeTab && !isTextFile"
        class="editor-pane__viewer"
      >
        <FileViewer
          :file-path="activeTab.filePath"
          :file-name="activeTab.fileName"
          :file-category="activeTab.fileCategory"
          :mime-type="activeTab.mimeType"
        />
      </div>

      <!-- Empty state -->
      <div
        v-else
        class="editor-pane__placeholder"
      >
        <q-icon
          name="description"
          size="48px"
          class="text-grey-5"
        />
        <p class="text-grey-6 q-mt-md">No file selected</p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.editor-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0; // Allow shrinking in flex/grid contexts
  background-color: var(--editor-bg, #1e1e1e);
  border: 1px solid transparent;
  overflow: hidden;

  &--active {
    border-color: var(--pane-active-border, #007acc);
  }

  &__tab-bar {
    display: flex;
    align-items: center;
    height: 35px;
    min-height: 35px;
    background-color: var(--tabbar-bg, #252526);
    border-bottom: 1px solid var(--border-color, #1e1e1e);
    overflow: hidden;
    flex-shrink: 0;
  }

  &__tabs {
    display: flex;
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }

  &__tab {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 35px;
    padding: 0 10px;
    min-width: 100px;
    max-width: 200px;
    cursor: pointer;
    background-color: var(--tab-bg, #2d2d2d);
    border-right: 1px solid var(--border-color, #1e1e1e);
    user-select: none;
    transition: background-color 0.1s;

    &:hover {
      background-color: var(--tab-hover-bg, #2a2d2e);

      .editor-pane__close-btn {
        opacity: 1;
      }
    }

    &--active {
      background-color: var(--tab-active-bg, #1e1e1e);
      border-bottom: 1px solid var(--tab-active-border, #1e1e1e);
      margin-bottom: -1px;

      .editor-pane__close-btn {
        opacity: 1;
      }
    }

    &--pinned {
      min-width: auto;
      padding: 0 8px;

      .editor-pane__tab-title {
        max-width: 80px;
      }
    }

    &--dirty {
      .editor-pane__tab-title {
        font-style: italic;
      }
    }

    &--drag-over {
      border-left: 2px solid var(--drag-indicator, #007acc);
    }
  }

  &__pin-icon {
    color: var(--pin-color, #858585);
    transform: rotate(45deg);
  }

  &__file-icon {
    flex-shrink: 0;
    color: var(--icon-color, #c5c5c5);
  }

  &__tab-title {
    flex: 1;
    font-size: 13px;
    color: var(--tab-text, #969696);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    .editor-pane__tab--active & {
      color: var(--tab-active-text, #ffffff);
    }
  }

  &__dirty-indicator {
    color: var(--dirty-color, #e8e8e8);
    font-size: 10px;
    margin-left: 2px;
  }

  &__close-btn {
    opacity: 0;
    margin-left: auto;
    color: var(--close-btn-color, #969696);

    &:hover {
      background-color: var(--close-btn-hover-bg, rgba(255, 255, 255, 0.1));
    }
  }

  &__empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__actions {
    display: flex;
    padding: 0 4px;
    gap: 2px;
  }

  &__content {
    flex: 1;
    min-height: 0; // Allow shrinking
    overflow: hidden;
    position: relative;
  }

  &__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  &__editor {
    height: 100%;
    overflow: auto;
  }

  &__preview {
    height: 100%;
    overflow: hidden;
  }

  &__viewer {
    height: 100%;
    overflow: hidden;
  }

  &__placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
  }
}

// Light theme
.body--light .editor-pane {
  --editor-bg: #ffffff;
  --pane-active-border: #007acc;
  --tabbar-bg: #f3f3f3;
  --border-color: #e7e7e7;
  --tab-bg: #ececec;
  --tab-hover-bg: #e8e8e8;
  --tab-active-bg: #ffffff;
  --tab-active-border: #ffffff;
  --tab-text: #5f6a79;
  --tab-active-text: #333333;
  --icon-color: #424242;
  --pin-color: #6f6f6f;
  --dirty-color: #5f6a79;
  --close-btn-color: #5f6a79;
  --close-btn-hover-bg: rgba(0, 0, 0, 0.1);
  --drag-indicator: #007acc;
}

// Dark theme
.body--dark .editor-pane {
  --editor-bg: #1e1e1e;
  --pane-active-border: #007acc;
  --tabbar-bg: #252526;
  --border-color: #1e1e1e;
  --tab-bg: #2d2d2d;
  --tab-hover-bg: #2a2d2e;
  --tab-active-bg: #1e1e1e;
  --tab-active-border: #1e1e1e;
  --tab-text: #969696;
  --tab-active-text: #ffffff;
  --icon-color: #c5c5c5;
  --pin-color: #858585;
  --dirty-color: #e8e8e8;
  --close-btn-color: #969696;
  --close-btn-hover-bg: rgba(255, 255, 255, 0.1);
  --drag-indicator: #007acc;
}
</style>
