<script setup lang="ts">
/**
 * MonacoEditor Component
 *
 * A wrapper component for Monaco Editor optimized for markdown/prompt editing.
 * Features:
 * - Lazy loading of Monaco Editor
 * - Theme synchronization with app theme
 * - YAML frontmatter highlighting
 * - Custom snippet autocomplete
 * - Editor state persistence
 */

import { ref, watch, onMounted, onBeforeUnmount, computed, shallowRef } from 'vue';
import * as monaco from 'monaco-editor';
import {
  lightTheme,
  darkTheme,
  getDefaultEditorOptions,
  getEditorState,
  restoreEditorState,
  type EditorState,
} from './editor-config';
import { initializeMarkdownLanguage } from './markdown-language';
import { initializeSnippetProvider } from './snippet-provider';
import { useUIStore } from '@/stores/uiStore';

/**
 * Props interface
 */
interface Props {
  modelValue: string;
  language?: string;
  readOnly?: boolean;
  minimap?: boolean;
  lineNumbers?: 'on' | 'off' | 'relative' | 'interval';
  wordWrap?: 'on' | 'off' | 'wordWrapColumn' | 'bounded';
  tabId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  language: 'markdown',
  readOnly: false,
  minimap: true,
  lineNumbers: 'on',
  wordWrap: 'on',
  tabId: '',
});

/**
 * Emits
 */
const emit = defineEmits<{
  'update:modelValue': [value: string];
  change: [value: string];
  save: [value: string];
  ready: [editor: monaco.editor.IStandaloneCodeEditor];
  cursorChange: [position: monaco.Position];
  selectionChange: [selection: monaco.Selection];
}>();

// DOM ref
const editorContainer = ref<HTMLDivElement | null>(null);

// Editor instance (shallowRef to avoid Vue proxy issues)
const editor = shallowRef<monaco.editor.IStandaloneCodeEditor | null>(null);

// Store
const uiStore = useUIStore();

// Theme tracking
const isDark = computed(() => uiStore.isDarkMode);
const currentTheme = computed(() => (isDark.value ? 'myndprompts-dark' : 'myndprompts-light'));

// Loading state
const isLoading = ref(true);
const loadError = ref<string | null>(null);

// Editor state cache (for persistence)
const editorStateCache = new Map<string, EditorState>();

// Disposables for cleanup
let disposables: monaco.IDisposable[] = [];

// Flag to prevent update loops
let isUpdatingFromProp = false;

/**
 * Initialize Monaco themes
 */
function initializeThemes(): void {
  monaco.editor.defineTheme('myndprompts-light', lightTheme);
  monaco.editor.defineTheme('myndprompts-dark', darkTheme);
}

/**
 * Initialize the editor
 */
function initializeEditor(): void {
  if (!editorContainer.value) {
    loadError.value = 'Editor container not found';
    return;
  }

  try {
    isLoading.value = true;
    loadError.value = null;

    // Initialize themes
    initializeThemes();

    // Initialize markdown language features
    initializeMarkdownLanguage();

    // Initialize snippet provider
    const snippetDisposable = initializeSnippetProvider();
    disposables.push(snippetDisposable);

    // Create editor with options
    const options: monaco.editor.IStandaloneEditorConstructionOptions = {
      ...getDefaultEditorOptions(),
      value: props.modelValue,
      language: props.language,
      theme: currentTheme.value,
      readOnly: props.readOnly,
      lineNumbers: props.lineNumbers,
      wordWrap: props.wordWrap,
      minimap: {
        enabled: props.minimap,
        maxColumn: 80,
        renderCharacters: false,
      },
    };

    editor.value = monaco.editor.create(editorContainer.value, options);

    // Setup event listeners
    setupEventListeners();

    // Restore editor state if available
    if (props.tabId && editorStateCache.has(props.tabId)) {
      const state = editorStateCache.get(props.tabId);
      if (state) {
        restoreEditorState(editor.value, state);
      }
    }

    isLoading.value = false;
    emit('ready', editor.value);
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Failed to initialize editor';
    isLoading.value = false;
    console.error('Monaco Editor initialization error:', err);
  }
}

/**
 * Setup editor event listeners
 */
function setupEventListeners(): void {
  if (!editor.value) return;

  // Content change listener
  const contentChangeDisposable = editor.value.onDidChangeModelContent(() => {
    if (isUpdatingFromProp) return;

    const value = editor.value?.getValue() ?? '';
    emit('update:modelValue', value);
    emit('change', value);
  });
  disposables.push(contentChangeDisposable);

  // Cursor position change listener
  const cursorChangeDisposable = editor.value.onDidChangeCursorPosition((e) => {
    emit('cursorChange', e.position);
  });
  disposables.push(cursorChangeDisposable);

  // Selection change listener
  const selectionChangeDisposable = editor.value.onDidChangeCursorSelection((e) => {
    emit('selectionChange', e.selection);
  });
  disposables.push(selectionChangeDisposable);

  // Save command (Ctrl+S / Cmd+S)
  const saveActionDisposable = editor.value.addAction({
    id: 'myndprompts.save',
    label: 'Save',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
    run: () => {
      const value = editor.value?.getValue() ?? '';
      emit('save', value);
    },
  });
  disposables.push(saveActionDisposable);

  // Focus/blur handlers for state persistence
  const blurDisposable = editor.value.onDidBlurEditorWidget(() => {
    if (props.tabId && editor.value) {
      editorStateCache.set(props.tabId, getEditorState(editor.value));
    }
  });
  disposables.push(blurDisposable);
}

/**
 * Update editor content from prop
 */
function updateContent(newValue: string): void {
  if (!editor.value) return;

  const currentValue = editor.value.getValue();
  if (currentValue !== newValue) {
    isUpdatingFromProp = true;
    const position = editor.value.getPosition();
    editor.value.setValue(newValue);
    if (position) {
      editor.value.setPosition(position);
    }
    isUpdatingFromProp = false;
  }
}

/**
 * Update editor theme
 */
function updateTheme(): void {
  if (!editor.value) return;
  monaco.editor.setTheme(currentTheme.value);
}

/**
 * Update editor options
 */
function updateOptions(): void {
  if (!editor.value) return;

  editor.value.updateOptions({
    readOnly: props.readOnly,
    lineNumbers: props.lineNumbers,
    wordWrap: props.wordWrap,
    minimap: {
      enabled: props.minimap,
      maxColumn: 80,
      renderCharacters: false,
    },
  });
}

/**
 * Force editor layout update
 */
function layout(): void {
  editor.value?.layout();
}

/**
 * Focus the editor
 */
function focus(): void {
  editor.value?.focus();
}

/**
 * Get current editor value
 */
function getValue(): string {
  return editor.value?.getValue() ?? '';
}

/**
 * Set cursor position
 */
function setPosition(position: monaco.IPosition): void {
  editor.value?.setPosition(position);
  editor.value?.revealPositionInCenter(position);
}

/**
 * Insert text at cursor position
 */
function insertText(text: string): void {
  if (!editor.value) return;

  const selection = editor.value.getSelection();
  if (selection) {
    editor.value.executeEdits('', [
      {
        range: selection,
        text,
        forceMoveMarkers: true,
      },
    ]);
  }
}

/**
 * Get editor instance (for advanced use)
 */
function getEditor(): monaco.editor.IStandaloneCodeEditor | null {
  return editor.value;
}

// Watch for prop changes
watch(() => props.modelValue, updateContent);
watch(() => isDark.value, updateTheme);
watch(() => [props.readOnly, props.minimap, props.lineNumbers, props.wordWrap], updateOptions);
watch(
  () => props.language,
  (newLang) => {
    if (editor.value) {
      const model = editor.value.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, newLang);
      }
    }
  }
);

// Save state when tab changes
watch(
  () => props.tabId,
  (newTabId, oldTabId) => {
    // Save state for old tab
    if (oldTabId && editor.value) {
      editorStateCache.set(oldTabId, getEditorState(editor.value));
    }

    // Restore state for new tab
    if (newTabId && editor.value && editorStateCache.has(newTabId)) {
      const state = editorStateCache.get(newTabId);
      if (state) {
        restoreEditorState(editor.value, state);
      }
    }
  }
);

// Lifecycle
onMounted(() => {
  initializeEditor();
});

onBeforeUnmount(() => {
  // Save final state
  if (props.tabId && editor.value) {
    editorStateCache.set(props.tabId, getEditorState(editor.value));
  }

  // Dispose all disposables (wrap in try-catch as Monaco may throw "Canceled" errors)
  disposables.forEach((d) => {
    try {
      d.dispose();
    } catch {
      // Ignore disposal errors (Monaco internal cleanup)
    }
  });
  disposables = [];

  // Dispose editor
  try {
    editor.value?.dispose();
  } catch {
    // Ignore disposal errors (Monaco internal cleanup)
  }
  editor.value = null;
});

// Expose methods
defineExpose({
  layout,
  focus,
  getValue,
  setPosition,
  insertText,
  getEditor,
});
</script>

<template>
  <div class="monaco-editor-wrapper">
    <!-- Loading state -->
    <div
      v-if="isLoading"
      class="monaco-editor-loading"
    >
      <q-spinner-dots
        color="primary"
        size="40px"
      />
      <span class="q-mt-sm">Loading editor...</span>
    </div>

    <!-- Error state -->
    <div
      v-else-if="loadError"
      class="monaco-editor-error"
    >
      <q-icon
        name="error"
        color="negative"
        size="40px"
      />
      <span class="q-mt-sm">{{ loadError }}</span>
      <q-btn
        flat
        color="primary"
        label="Retry"
        class="q-mt-md"
        @click="initializeEditor"
      />
    </div>

    <!-- Editor container -->
    <div
      ref="editorContainer"
      class="monaco-editor-container"
      :class="{ 'monaco-editor-hidden': isLoading || loadError }"
    />
  </div>
</template>

<style lang="scss" scoped>
.monaco-editor-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.monaco-editor-container {
  flex: 1;
  min-height: 0;
  width: 100%;

  &.monaco-editor-hidden {
    visibility: hidden;
    position: absolute;
  }
}

.monaco-editor-loading,
.monaco-editor-error {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--mp-text-secondary);
  background-color: var(--mp-editor-bg);
}
</style>
