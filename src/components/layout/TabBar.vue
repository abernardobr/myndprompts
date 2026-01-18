<script setup lang="ts">
/**
 * TabBar Component
 *
 * Displays and manages open file tabs similar to VSCode.
 * Supports tab reordering, pinning, and context menus.
 */

import { computed, ref } from 'vue';
import { useUIStore, type IOpenTab } from '@/stores/uiStore';
import { useI18n } from 'vue-i18n';

const { t: _t } = useI18n();
const uiStore = useUIStore();

const openTabs = computed(() => uiStore.openTabs);
const activeTabId = computed(() => uiStore.activeTabId);

// Drag state
const draggedTab = ref<IOpenTab | null>(null);
const dragOverIndex = ref<number | null>(null);

function selectTab(tabId: string): void {
  uiStore.setActiveTab(tabId);
}

function closeTab(tabId: string, event: MouseEvent): void {
  event.stopPropagation();
  uiStore.closeTab(tabId);
}

function closeOtherTabs(tabId: string): void {
  uiStore.closeOtherTabs(tabId);
}

function closeAllTabs(): void {
  uiStore.closeAllTabs();
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
  if (draggedTab.value) {
    const fromIndex = openTabs.value.findIndex((t) => t.id === draggedTab.value?.id);
    if (fromIndex !== -1 && fromIndex !== toIndex) {
      uiStore.reorderTabs(fromIndex, toIndex);
    }
  }
  draggedTab.value = null;
  dragOverIndex.value = null;
}

function onDragEnd(): void {
  draggedTab.value = null;
  dragOverIndex.value = null;
}

function getFileIcon(fileName: string): string {
  if (fileName.endsWith('.snippet.md')) return 'code';
  if (fileName.endsWith('.persona.md')) return 'person';
  if (fileName.endsWith('.template.md')) return 'article';
  if (fileName.endsWith('.md')) return 'description';
  return 'insert_drive_file';
}
</script>

<template>
  <div class="tab-bar">
    <div class="tab-bar__tabs">
      <div
        v-for="(tab, index) in openTabs"
        :key="tab.id"
        :class="[
          'tab-bar__tab',
          {
            'tab-bar__tab--active': activeTabId === tab.id,
            'tab-bar__tab--pinned': tab.isPinned,
            'tab-bar__tab--dirty': tab.isDirty,
            'tab-bar__tab--drag-over': dragOverIndex === index,
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
          class="tab-bar__pin-icon"
        />
        <q-icon
          :name="getFileIcon(tab.fileName)"
          size="16px"
          class="tab-bar__file-icon"
        />
        <span class="tab-bar__tab-title">{{ tab.title }}</span>
        <span
          v-if="tab.isDirty"
          class="tab-bar__dirty-indicator"
          >●</span
        >
        <q-btn
          v-if="!tab.isPinned"
          flat
          dense
          round
          size="xs"
          icon="close"
          class="tab-bar__close-btn"
          @click="closeTab(tab.id, $event)"
        >
          <q-tooltip>Close</q-tooltip>
        </q-btn>

        <!-- Context menu -->
        <q-menu context-menu>
          <q-list
            dense
            style="min-width: 150px"
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
          </q-list>
        </q-menu>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-if="openTabs.length === 0"
      class="tab-bar__empty"
    >
      <span class="text-grey-6 text-caption">No files open</span>
    </div>

    <!-- Tab bar actions -->
    <div class="tab-bar__actions">
      <q-btn
        v-if="openTabs.length > 0"
        flat
        dense
        round
        size="sm"
        icon="more_horiz"
      >
        <q-tooltip>Tab Actions</q-tooltip>
        <q-menu>
          <q-list
            dense
            style="min-width: 150px"
          >
            <q-item
              v-close-popup
              clickable
              @click="closeAllTabs"
            >
              <q-item-section>Close All Tabs</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.tab-bar {
  display: flex;
  align-items: center;
  height: 35px;
  background-color: var(--tabbar-bg, #252526);
  border-bottom: 1px solid var(--border-color, #1e1e1e);
  overflow: hidden;

  &__tabs {
    display: flex;
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;

    // Hide scrollbar but allow scrolling
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

      .tab-bar__close-btn {
        opacity: 1;
      }
    }

    &--active {
      background-color: var(--tab-active-bg, #1e1e1e);
      border-bottom: 1px solid var(--tab-active-border, #1e1e1e);
      margin-bottom: -1px;

      .tab-bar__close-btn {
        opacity: 1;
      }
    }

    &--pinned {
      min-width: auto;
      padding: 0 8px;

      .tab-bar__tab-title {
        max-width: 80px;
      }
    }

    &--dirty {
      .tab-bar__tab-title {
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

    .tab-bar__tab--active & {
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
  }
}

// Light theme
.body--light .tab-bar {
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
.body--dark .tab-bar {
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
