<script setup lang="ts">
/**
 * MainLayout Component
 *
 * VSCode-like application layout with:
 * - Activity Bar (left, fixed width)
 * - Sidebar (collapsible, resizable)
 * - Editor Area (main content)
 * - Bottom Panel (collapsible, resizable)
 * - Status Bar (bottom, fixed height)
 *
 * Uses splitpanes for resizable panels.
 */

import { computed, onMounted } from 'vue';
import { Splitpanes, Pane } from 'splitpanes';
import 'splitpanes/dist/splitpanes.css';

import { useUIStore } from '@/stores/uiStore';
import { useAppStore } from '@/stores/appStore';
import ActivityBar from '@/components/layout/ActivityBar.vue';
import Sidebar from '@/components/layout/Sidebar.vue';
import EditorArea from '@/components/layout/EditorArea.vue';
import BottomPanel from '@/components/layout/BottomPanel.vue';
import StatusBar from '@/components/layout/StatusBar.vue';

const uiStore = useUIStore();
const appStore = useAppStore();

// Computed layout values
const sidebarCollapsed = computed(() => uiStore.sidebarCollapsed);
const panelCollapsed = computed(() => uiStore.panelCollapsed);
const panelHeight = computed(() => uiStore.panelHeight);
const sidebarWidth = computed(() => uiStore.sidebarWidth);

// Calculate pane sizes as percentages
const sidebarSize = computed(() => {
  if (sidebarCollapsed.value) return 0;
  // Convert pixel width to percentage (assuming typical screen width)
  // This will be recalculated by splitpanes
  return Math.min(30, Math.max(15, (sidebarWidth.value / 1200) * 100));
});

const panelSize = computed(() => {
  if (panelCollapsed.value) return 0;
  // Convert pixel height to percentage
  return Math.min(50, Math.max(15, (panelHeight.value / 600) * 100));
});

const editorSize = computed(() => 100 - panelSize.value);

// Handle sidebar resize
function onSidebarResize(panes: { size: number }[]): void {
  if (panes[0] && panes[0].size > 0) {
    // Convert percentage back to pixels (approximate)
    const containerWidth = window.innerWidth - 48; // minus activity bar
    const newWidth = (panes[0].size / 100) * containerWidth;
    uiStore.setSidebarWidth(newWidth);
  }
}

// Handle vertical resize (editor/panel)
function onVerticalResize(panes: { size: number }[]): void {
  if (panes[1] && panes[1].size > 0) {
    // Convert percentage back to pixels
    const containerHeight = window.innerHeight - 22 - 35; // minus status bar and tab bar
    const newHeight = (panes[1].size / 100) * containerHeight;
    uiStore.setPanelHeight(newHeight);
  }
}

// Initialize stores on mount
onMounted(async () => {
  await Promise.all([appStore.initialize(), uiStore.initialize()]);
});
</script>

<template>
  <div class="main-layout">
    <!-- Activity Bar -->
    <ActivityBar class="main-layout__activity-bar" />

    <!-- Main content area with sidebar and editor -->
    <Splitpanes
      class="main-layout__horizontal"
      @resized="onSidebarResize"
    >
      <!-- Sidebar pane -->
      <Pane
        v-if="!sidebarCollapsed"
        :size="sidebarSize"
        :min-size="15"
        :max-size="40"
        class="main-layout__sidebar-pane"
      >
        <Sidebar />
      </Pane>

      <!-- Editor and Panel area -->
      <Pane
        :size="sidebarCollapsed ? 100 : 100 - sidebarSize"
        class="main-layout__content-pane"
      >
        <Splitpanes
          horizontal
          class="main-layout__vertical"
          @resized="onVerticalResize"
        >
          <!-- Editor area -->
          <Pane
            :size="editorSize"
            :min-size="30"
            class="main-layout__editor-pane"
          >
            <EditorArea />
          </Pane>

          <!-- Bottom panel -->
          <Pane
            v-if="!panelCollapsed"
            :size="panelSize"
            :min-size="15"
            :max-size="50"
            class="main-layout__panel-pane"
          >
            <BottomPanel />
          </Pane>
        </Splitpanes>
      </Pane>
    </Splitpanes>

    <!-- Status Bar -->
    <StatusBar class="main-layout__status-bar" />
  </div>
</template>

<style lang="scss">
// Global styles for splitpanes (not scoped)
.splitpanes {
  background-color: transparent;
}

.splitpanes__pane {
  background-color: transparent;
}

// Splitter styles - override library defaults
// Library class naming:
//   .splitpanes--vertical = default (no prop) = panes side by side (left-right)
//   .splitpanes--horizontal = horizontal prop = panes stacked (top-bottom)

// Vertical divider (between sidebar and editor) - splitpanes--vertical (default, no prop)
.splitpanes.splitpanes--vertical > .splitpanes__splitter {
  width: 5px !important;
  min-width: 5px !important;
  background-color: var(--splitter-line, #3c3c3c) !important;
  border: none !important;
  margin: 0 !important;
  cursor: col-resize !important;

  &:hover {
    background-color: var(--splitter-hover-bg, #007acc) !important;
  }

  // Remove default pseudo-elements
  &::before,
  &::after {
    display: none !important;
  }
}

// Horizontal divider (between editor and bottom panel) - splitpanes--horizontal (horizontal prop)
.splitpanes.splitpanes--horizontal > .splitpanes__splitter {
  height: 5px !important;
  min-height: 5px !important;
  background-color: var(--splitter-line, #3c3c3c) !important;
  border: none !important;
  margin: 0 !important;
  cursor: row-resize !important;

  &:hover {
    background-color: var(--splitter-hover-bg, #007acc) !important;
  }

  // Remove default pseudo-elements
  &::before,
  &::after {
    display: none !important;
  }
}

// Dragging state - disable all transitions and keep splitter highlighted
.splitpanes--dragging {
  // Keep splitter highlighted
  > .splitpanes__splitter {
    background-color: var(--splitter-hover-bg, #007acc) !important;
  }

  // Disable all transitions during drag
  &,
  & *,
  & .splitpanes__pane,
  & .splitpanes__splitter {
    transition: none !important;
  }
}

// Light theme splitter
.body--light {
  --splitter-line: #e0e0e0;
  --splitter-hover-bg: #007acc;
}

// Dark theme splitter
.body--dark {
  --splitter-line: #3c3c3c;
  --splitter-hover-bg: #007acc;
}
</style>

<style lang="scss" scoped>
.main-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background-color: var(--layout-bg, #1e1e1e);

  // Main horizontal layout (activity bar + content)
  display: grid;
  grid-template-columns: 48px 1fr;
  grid-template-rows: 1fr 22px;
  grid-template-areas:
    'activity content'
    'status status';

  &__activity-bar {
    grid-area: activity;
  }

  &__horizontal {
    grid-area: content;
    height: 100%;
  }

  &__status-bar {
    grid-area: status;
  }

  &__sidebar-pane {
    overflow: hidden;
  }

  &__content-pane {
    overflow: hidden;
  }

  &__vertical {
    height: 100%;
  }

  &__editor-pane {
    overflow: hidden;
  }

  &__panel-pane {
    overflow: hidden;
  }
}

// Light theme
.body--light .main-layout {
  --layout-bg: #f3f3f3;
}

// Dark theme
.body--dark .main-layout {
  --layout-bg: #1e1e1e;
}
</style>
