<script setup lang="ts">
/**
 * EditorArea Component
 *
 * Main content area containing the editor panes with split view support.
 * Uses Splitpanes for resizable split views.
 */

import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { Splitpanes, Pane } from 'splitpanes';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useUIStore } from '@/stores/uiStore';
import { usePrompts } from '@/composables/usePrompts';
import EditorPane from './EditorPane.vue';
import NewPromptDialog from '@/components/dialogs/NewPromptDialog.vue';
import OpenPromptDialog from '@/components/dialogs/OpenPromptDialog.vue';

// Interface for EditorPane exposed methods
interface IEditorPaneExposed {
  layout: () => void;
}

const $q = useQuasar();
const { t } = useI18n();
const uiStore = useUIStore();
const prompts = usePrompts();

// Dialog states
const showNewPromptDialog = ref(false);
const showOpenPromptDialog = ref(false);

// Editor pane refs for layout updates
const paneRefs = ref<Map<string, IEditorPaneExposed>>(new Map());

// Computed properties
const editorPanes = computed(() => uiStore.editorPanes);
const activePaneId = computed(() => uiStore.activePaneId);
const splitDirection = computed(() => uiStore.splitDirection);
const isSplitView = computed(() => uiStore.isSplitView);
const hasAnyTabs = computed(() => editorPanes.value.some((p) => p.tabs.length > 0));

// Keyboard shortcuts for reference
const shortcuts = [
  { keys: 'Ctrl+N', description: 'New Prompt' },
  { keys: 'Ctrl+O', description: 'Open File' },
  { keys: 'Ctrl+S', description: 'Save' },
  { keys: 'Ctrl+\\', description: 'Split Editor' },
  { keys: 'Ctrl+Shift+F', description: 'Search' },
  { keys: 'Ctrl+,', description: 'Settings' },
];

// Snippet triggers for reference
const snippetTriggers = computed(() => [
  { trigger: '@', description: t('snippetsPanel.triggerHelp.all') },
  { trigger: '#', description: t('snippetsPanel.triggerHelp.text') },
  { trigger: '$', description: t('snippetsPanel.triggerHelp.code') },
  { trigger: '!', description: t('snippetsPanel.triggerHelp.templates') },
  { trigger: '^', description: t('snippetsPanel.triggerHelp.files') },
]);

// Welcome screen actions
function handleNewPromptClick(): void {
  showNewPromptDialog.value = true;
}

function handleOpenPromptClick(): void {
  showOpenPromptDialog.value = true;
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

// Dialog event handlers
async function handleCreatePrompt(data: { title: string; category?: string }): Promise<void> {
  try {
    await prompts.createNewPrompt(data.title, '', data.category);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create prompt';
    showError(message);
  }
}

async function handleOpenPromptFile(filePath: string): Promise<void> {
  try {
    await prompts.openPrompt(filePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to open prompt';
    showError(message);
  }
}

// Handle pane resize
function onPanesResized(panes: { size: number }[]): void {
  const sizes = editorPanes.value.map((pane, index) => ({
    id: pane.id,
    size: panes[index]?.size ?? 50,
  }));
  uiStore.updatePaneSizes(sizes);

  // Trigger layout update on all editor panes
  void nextTick(() => {
    paneRefs.value.forEach((ref) => {
      ref?.layout?.();
    });
  });
}

// Handle pane focus
function handlePaneFocus(paneId: string): void {
  uiStore.setActivePane(paneId);
}

// Handle pane close
function handlePaneClose(paneId: string): void {
  uiStore.closePane(paneId);
}

// Handle split from pane
function handleSplit(direction: 'horizontal' | 'vertical'): void {
  uiStore.splitEditor(direction);
}

// Register pane ref
function setPaneRef(paneId: string, el: IEditorPaneExposed | null): void {
  if (el) {
    paneRefs.value.set(paneId, el);
  } else {
    paneRefs.value.delete(paneId);
  }
}

// Keyboard shortcuts handler
function handleKeyboardShortcut(event: KeyboardEvent): void {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? event.metaKey : event.ctrlKey;

  // Ctrl/Cmd + N - New Prompt
  if (modKey && !event.shiftKey && event.key === 'n') {
    event.preventDefault();
    showNewPromptDialog.value = true;
    return;
  }

  // Ctrl/Cmd + O - Open Prompt
  if (modKey && !event.shiftKey && event.key === 'o') {
    event.preventDefault();
    showOpenPromptDialog.value = true;
    return;
  }

  // Ctrl/Cmd + \ - Split Editor Right
  if (modKey && !event.shiftKey && event.key === '\\') {
    event.preventDefault();
    if (hasAnyTabs.value) {
      uiStore.splitEditor('horizontal');
    }
    return;
  }

  // Ctrl/Cmd + Shift + \ - Split Editor Down
  if (modKey && event.shiftKey && event.key === '\\') {
    event.preventDefault();
    if (hasAnyTabs.value) {
      uiStore.splitEditor('vertical');
    }
    return;
  }
}

// Initialize prompt system
onMounted(async () => {
  await prompts.initialize();
  uiStore.ensurePaneExists();
  window.addEventListener('keydown', handleKeyboardShortcut);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyboardShortcut);
});

// Watch for pane changes to trigger layout updates
watch(
  () => editorPanes.value.length,
  async () => {
    await nextTick();
    paneRefs.value.forEach((ref) => {
      ref?.layout?.();
    });
  }
);
</script>

<template>
  <div
    class="editor-area"
    data-testid="editor-area"
  >
    <!-- Split panes editor view -->
    <template v-if="hasAnyTabs || isSplitView">
      <Splitpanes
        :horizontal="splitDirection === 'vertical'"
        class="editor-area__splitpanes"
        @resized="onPanesResized"
      >
        <Pane
          v-for="pane in editorPanes"
          :key="pane.id"
          :size="pane.size ?? 100 / editorPanes.length"
          :min-size="20"
          class="editor-area__pane"
        >
          <EditorPane
            :ref="(el) => setPaneRef(pane.id, el as InstanceType<typeof EditorPane>)"
            :pane="pane"
            :is-active="activePaneId === pane.id"
            :show-close-button="editorPanes.length > 1"
            @focus="handlePaneFocus(pane.id)"
            @close="handlePaneClose(pane.id)"
            @split="handleSplit"
          />
        </Pane>
      </Splitpanes>
    </template>

    <!-- Welcome screen when no files are open -->
    <template v-else>
      <!-- Drag handle for window dragging on welcome screen -->
      <div class="editor-area__drag-handle" />
      <div
        class="editor-area__welcome"
        data-testid="welcome-screen"
      >
        <div class="editor-area__welcome-content">
          <div class="editor-area__logo">
            <img
              src="@/assets/images/logo-icon.png"
              alt="MyndPrompts Logo"
              class="editor-area__logo-img"
            />
          </div>

          <h4 class="editor-area__title">MyndPrompts</h4>
          <p class="editor-area__subtitle">Your AI Prompt Management Studio</p>

          <!-- Start section - centered on top -->
          <div class="editor-area__start">
            <div class="editor-area__links editor-area__links--horizontal">
              <a
                href="#"
                class="editor-area__link"
                @click.prevent="handleNewPromptClick"
              >
                <q-icon
                  name="add"
                  size="18px"
                />
                <span>New Prompt</span>
              </a>
              <a
                href="#"
                class="editor-area__link"
                @click.prevent="handleOpenPromptClick"
              >
                <q-icon
                  name="folder_open"
                  size="18px"
                />
                <span>Open Prompt</span>
              </a>
            </div>
          </div>

          <!-- Help sections - side by side below -->
          <div class="editor-area__sections">
            <!-- Keyboard Shortcuts section -->
            <div class="editor-area__section">
              <h6 class="editor-area__section-title">{{ t('welcome.keyboardShortcuts') }}</h6>
              <div class="editor-area__shortcuts">
                <div
                  v-for="shortcut in shortcuts"
                  :key="shortcut.keys"
                  class="editor-area__shortcut"
                >
                  <kbd class="editor-area__kbd">{{ shortcut.keys }}</kbd>
                  <span class="editor-area__shortcut-desc">{{ shortcut.description }}</span>
                </div>
              </div>
            </div>

            <!-- Snippet Triggers section -->
            <div class="editor-area__section">
              <h6 class="editor-area__section-title">{{ t('welcome.snippetTriggers') }}</h6>
              <div class="editor-area__shortcuts">
                <div
                  v-for="trigger in snippetTriggers"
                  :key="trigger.trigger"
                  class="editor-area__shortcut"
                >
                  <kbd class="editor-area__kbd editor-area__kbd--trigger">{{
                    trigger.trigger
                  }}</kbd>
                  <span class="editor-area__shortcut-desc">{{ trigger.description }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Dialogs -->
    <NewPromptDialog
      v-model="showNewPromptDialog"
      @create="handleCreatePrompt"
    />

    <OpenPromptDialog
      v-model="showOpenPromptDialog"
      @open="handleOpenPromptFile"
    />
  </div>
</template>

<style lang="scss">
// Splitpanes styles (not scoped to apply to library components)
.editor-area__splitpanes {
  height: 100%;

  .splitpanes__pane {
    background-color: transparent;
    overflow: hidden;
  }

  // Vertical splitter (side by side panes)
  &.splitpanes--vertical > .splitpanes__splitter {
    width: 4px !important;
    min-width: 4px !important;
    background-color: var(--splitter-bg, #252526) !important;
    border: none !important;
    margin: 0 !important;
    cursor: col-resize !important;

    &:hover {
      background-color: var(--splitter-hover-bg, #007acc) !important;
    }

    &::before,
    &::after {
      display: none !important;
    }
  }

  // Horizontal splitter (stacked panes)
  &.splitpanes--horizontal > .splitpanes__splitter {
    height: 4px !important;
    min-height: 4px !important;
    background-color: var(--splitter-bg, #252526) !important;
    border: none !important;
    margin: 0 !important;
    cursor: row-resize !important;

    &:hover {
      background-color: var(--splitter-hover-bg, #007acc) !important;
    }

    &::before,
    &::after {
      display: none !important;
    }
  }

  // Dragging state
  &.splitpanes--dragging {
    > .splitpanes__splitter {
      background-color: var(--splitter-hover-bg, #007acc) !important;
    }

    &,
    & *,
    & .splitpanes__pane,
    & .splitpanes__splitter {
      transition: none !important;
    }
  }
}

// Light theme splitter
.body--light .editor-area__splitpanes {
  --splitter-bg: #e0e0e0;
  --splitter-hover-bg: #007acc;
}

// Dark theme splitter
.body--dark .editor-area__splitpanes {
  --splitter-bg: #252526;
  --splitter-hover-bg: #007acc;
}
</style>

<style lang="scss" scoped>
.editor-area {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0; // Allow shrinking in flex/grid contexts
  background-color: var(--editor-bg, #1e1e1e);
  overflow: hidden;

  // macOS drag handle at top for window dragging
  &__drag-handle {
    width: 100%;
    height: 28px;
    flex-shrink: 0;
    -webkit-app-region: drag;
    background-color: var(--editor-bg, #1e1e1e);
  }

  &__pane {
    height: 100%;
    min-height: 0; // Allow shrinking
    overflow: hidden;
  }

  &__welcome {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    overflow: auto;
  }

  &__welcome-content {
    max-width: 600px;
    padding: 40px;
    text-align: center;
    -webkit-app-region: no-drag; // Allow clicking links
  }

  &__logo {
    margin-bottom: 16px;
  }

  &__logo-img {
    width: 80px;
    height: 80px;
    object-fit: contain;
  }

  &__title {
    font-size: 28px;
    font-weight: 300;
    color: var(--title-color, #cccccc);
    margin: 0 0 8px;
  }

  &__subtitle {
    font-size: 14px;
    color: var(--subtitle-color, #858585);
    margin: 0 0 32px;
  }

  &__start {
    margin-bottom: 40px;
  }

  &__sections {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 40px;
    text-align: left;
  }

  &__section {
    min-width: 180px;
  }

  &__section-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--section-title-color, #bbbbbb);
    margin: 0 0 12px;
  }

  &__links {
    display: flex;
    flex-direction: column;
    gap: 8px;

    &--horizontal {
      flex-direction: row;
      justify-content: center;
      gap: 32px;

      .editor-area__link {
        font-size: 15px;
        gap: 10px;
      }
    }
  }

  &__link {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--link-color, #3794ff);
    text-decoration: none;
    padding: 4px 0;

    &:hover {
      color: var(--link-hover-color, #75beff);
      text-decoration: underline;
    }
  }

  &__shortcuts {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__shortcut {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__kbd {
    display: inline-block;
    min-width: 80px;
    padding: 2px 6px;
    font-family: monospace;
    font-size: 11px;
    background-color: var(--kbd-bg, #3c3c3c);
    border: 1px solid var(--kbd-border, #454545);
    border-radius: 3px;
    color: var(--kbd-color, #cccccc);

    &--trigger {
      min-width: 30px;
      text-align: center;
      font-size: 13px;
      font-weight: 600;
    }
  }

  &__shortcut-desc {
    font-size: 13px;
    color: var(--shortcut-desc-color, #cccccc);
  }
}

// Light theme
.body--light .editor-area {
  --editor-bg: #ffffff;
  --title-color: #3b3b3b;
  --subtitle-color: #6f6f6f;
  --section-title-color: #6f6f6f;
  --link-color: #006ab1;
  --link-hover-color: #0078d4;
  --kbd-bg: #eaeaea;
  --kbd-border: #d4d4d4;
  --kbd-color: #3b3b3b;
  --shortcut-desc-color: #3b3b3b;
}

// Dark theme
.body--dark .editor-area {
  --editor-bg: #1e1e1e;
  --title-color: #cccccc;
  --subtitle-color: #858585;
  --section-title-color: #bbbbbb;
  --link-color: #3794ff;
  --link-hover-color: #75beff;
  --kbd-bg: #3c3c3c;
  --kbd-border: #454545;
  --kbd-color: #cccccc;
  --shortcut-desc-color: #cccccc;
}
</style>
