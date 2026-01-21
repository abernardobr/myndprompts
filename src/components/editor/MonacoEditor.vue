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
import { initializeFilePathProvider } from './file-path-provider';
import { useUIStore } from '@/stores/uiStore';
import { useI18n } from 'vue-i18n';

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
  filePath?: string;
}

const props = withDefaults(defineProps<Props>(), {
  language: 'markdown',
  readOnly: false,
  minimap: true,
  lineNumbers: 'on',
  wordWrap: 'on',
  tabId: '',
  filePath: '',
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

// i18n
const { t } = useI18n({ useScope: 'global' });

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

    // Initialize file path provider (^ trigger for file autocomplete)
    const filePathDisposable = initializeFilePathProvider();
    disposables.push(filePathDisposable);

    // Create a model with the file path as URI (for file-path-provider to know current file)
    const modelUri = props.filePath
      ? monaco.Uri.file(props.filePath)
      : monaco.Uri.parse(`inmemory://model/${props.tabId || Date.now()}`);

    // Check if model already exists and dispose it
    const existingModel = monaco.editor.getModel(modelUri);
    if (existingModel) {
      existingModel.dispose();
    }

    // Create the model with file path URI
    const model = monaco.editor.createModel(props.modelValue, props.language, modelUri);

    // Create editor with options
    const options: monaco.editor.IStandaloneEditorConstructionOptions = {
      ...getDefaultEditorOptions(),
      model,
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
 * Check if the current file is a markdown file
 */
function isMarkdownFile(): boolean {
  return props.language === 'markdown' || props.filePath.toLowerCase().endsWith('.md');
}

/**
 * Get the directory containing the current file
 */
async function getFileDirectory(): Promise<string> {
  if (!props.filePath) return '';
  return await window.fileSystemAPI.getDirectoryName(props.filePath);
}

/**
 * Insert an image into the editor
 * @param imagePath - The source path of the image to insert
 */
async function insertImage(imagePath: string): Promise<void> {
  if (!editor.value || !props.filePath) return;

  try {
    // Get the directory of the current file
    const fileDir = await getFileDirectory();
    if (!fileDir) return;

    // Create images folder if it doesn't exist
    const imagesDir = await window.fileSystemAPI.joinPath(fileDir, 'images');
    const imagesDirExists = await window.fileSystemAPI.directoryExists(imagesDir);
    if (!imagesDirExists) {
      await window.fileSystemAPI.createDirectory(imagesDir);
    }

    // Copy the image to the images folder
    const result = await window.fileSystemAPI.copyFileToDirectory(imagePath, imagesDir);
    if (!result.success || !result.newPath) {
      console.error('Failed to copy image:', result.error);
      return;
    }

    // Get the filename for the markdown syntax
    const fileName = await window.fileSystemAPI.getFileName(result.newPath);

    // Use angle bracket syntax for paths with special characters (spaces, parentheses, etc.)
    // This is standard markdown and handles all special characters
    const hasSpecialChars = /[\s()[\]#?]/.test(fileName);
    const markdownPath = hasSpecialChars ? `<images/${fileName}>` : `images/${fileName}`;

    // Insert markdown image syntax at cursor position
    const imageMarkdown = `![${fileName}](${markdownPath})`;
    insertText(imageMarkdown);
  } catch (error) {
    console.error('Failed to insert image:', error);
  }
}

/**
 * Open file picker to select an image
 */
async function openImagePicker(): Promise<void> {
  try {
    const result = await window.electronAPI.showOpenDialog({
      title: 'Select Image',
      filters: [
        {
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'],
        },
      ],
      properties: ['openFile'],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      await insertImage(result.filePaths[0]);
    }
  } catch (error) {
    console.error('Failed to open image picker:', error);
  }
}

/**
 * Handle drag over event
 */
function handleDragOver(event: DragEvent): void {
  if (!isMarkdownFile()) return;

  // Check if dragging files
  if (event.dataTransfer?.types.includes('Files')) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }
}

/**
 * Handle drop event for images
 */
async function handleDrop(event: DragEvent): Promise<void> {
  if (!isMarkdownFile()) return;

  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return;

  // Check if any file is an image
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'];

  for (const file of Array.from(files)) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (imageExtensions.includes(ext)) {
      event.preventDefault();
      event.stopPropagation();

      // Get the actual file path using Electron's webUtils
      const filePath = window.fileSystemAPI.getPathForFile(file);
      if (filePath) {
        await insertImage(filePath);
      }
    }
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

  // Insert Image action (context menu) - only for markdown files
  if (isMarkdownFile()) {
    const insertImageActionDisposable = editor.value.addAction({
      id: 'myndprompts.insertImage',
      label: t('editor.insertImage'),
      contextMenuGroupId: 'modification',
      contextMenuOrder: 1.5,
      run: () => {
        void openImagePicker();
      },
    });
    disposables.push(insertImageActionDisposable);
  }

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

// Update model URI when file path changes (for file-path-provider to know current file)
watch(
  () => props.filePath,
  (newFilePath) => {
    if (!editor.value) return;

    const currentModel = editor.value.getModel();
    if (!currentModel) return;

    // Create new model URI
    const newUri = newFilePath
      ? monaco.Uri.file(newFilePath)
      : monaco.Uri.parse(`inmemory://model/${props.tabId || Date.now()}`);

    // If URI hasn't changed, skip
    if (currentModel.uri.toString() === newUri.toString()) return;

    // Get current content and cursor position
    const content = currentModel.getValue();
    const cursorPosition = editor.value.getPosition();

    // Check if model with this URI already exists
    const existingModel = monaco.editor.getModel(newUri);
    if (existingModel && existingModel !== currentModel) {
      existingModel.dispose();
    }

    // Create new model with updated URI
    const newModel = monaco.editor.createModel(content, props.language, newUri);

    // Set the new model on the editor
    editor.value.setModel(newModel);

    // Restore cursor position
    if (cursorPosition) {
      editor.value.setPosition(cursorPosition);
    }

    // Dispose old model
    currentModel.dispose();

    console.log('[MonacoEditor] Model URI updated:', newUri.toString());
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
      @dragover="handleDragOver"
      @drop="handleDrop"
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
