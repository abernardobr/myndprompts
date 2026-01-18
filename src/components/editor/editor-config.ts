/**
 * Monaco Editor Configuration
 *
 * Configuration options for the Monaco editor instance.
 * Provides default settings for markdown editing with prompt-specific features.
 */

import type * as monaco from 'monaco-editor';

/**
 * Editor theme definitions for light and dark modes
 */
export interface EditorTheme {
  base: 'vs' | 'vs-dark' | 'hc-black';
  inherit: boolean;
  rules: monaco.editor.ITokenThemeRule[];
  colors: Record<string, string>;
}

/**
 * Light theme configuration - matches app light mode
 */
export const lightTheme: EditorTheme = {
  base: 'vs',
  inherit: true,
  rules: [
    // YAML frontmatter
    { token: 'metatag', foreground: '7c3aed' },
    { token: 'metatag.yaml', foreground: '7c3aed' },
    { token: 'keyword.yaml', foreground: '0550ae' },
    { token: 'string.yaml', foreground: '0a3069' },

    // Markdown
    { token: 'emphasis', fontStyle: 'italic' },
    { token: 'strong', fontStyle: 'bold' },
    { token: 'keyword.md', foreground: '7c3aed' },
    { token: 'string.link.md', foreground: '0550ae' },
    { token: 'variable.md', foreground: 'cf222e' },
    { token: 'comment', foreground: '6e7781' },

    // Code blocks
    { token: 'string.code', foreground: '0a3069' },
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#1a1a1a',
    'editorLineNumber.foreground': '#8c8c8c',
    'editorLineNumber.activeForeground': '#1a1a1a',
    'editor.selectionBackground': '#add6ff',
    'editor.lineHighlightBackground': '#f5f5f5',
    'editorCursor.foreground': '#7c3aed',
    'editorWhitespace.foreground': '#d0d0d0',
    'editorIndentGuide.background': '#e0e0e0',
    'editorIndentGuide.activeBackground': '#c0c0c0',
  },
};

/**
 * Dark theme configuration - matches app dark mode
 */
export const darkTheme: EditorTheme = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    // YAML frontmatter
    { token: 'metatag', foreground: 'a78bfa' },
    { token: 'metatag.yaml', foreground: 'a78bfa' },
    { token: 'keyword.yaml', foreground: '79c0ff' },
    { token: 'string.yaml', foreground: 'a5d6ff' },

    // Markdown
    { token: 'emphasis', fontStyle: 'italic' },
    { token: 'strong', fontStyle: 'bold' },
    { token: 'keyword.md', foreground: 'a78bfa' },
    { token: 'string.link.md', foreground: '79c0ff' },
    { token: 'variable.md', foreground: 'ff7b72' },
    { token: 'comment', foreground: '8b949e' },

    // Code blocks
    { token: 'string.code', foreground: 'a5d6ff' },
  ],
  colors: {
    'editor.background': '#1e1e1e',
    'editor.foreground': '#e0e0e0',
    'editorLineNumber.foreground': '#6e6e6e',
    'editorLineNumber.activeForeground': '#e0e0e0',
    'editor.selectionBackground': '#264f78',
    'editor.lineHighlightBackground': '#2d2d2d',
    'editorCursor.foreground': '#a78bfa',
    'editorWhitespace.foreground': '#4a4a4a',
    'editorIndentGuide.background': '#3c3c3c',
    'editorIndentGuide.activeBackground': '#5a5a5a',
  },
};

/**
 * Default editor options for markdown editing
 */
export function getDefaultEditorOptions(): monaco.editor.IStandaloneEditorConstructionOptions {
  return {
    // Basic settings
    language: 'markdown',
    automaticLayout: true,
    theme: 'myndprompts-dark',

    // Font settings
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    fontLigatures: true,
    lineHeight: 22,

    // Display settings
    lineNumbers: 'on',
    renderLineHighlight: 'line',
    renderWhitespace: 'selection',
    minimap: {
      enabled: true,
      maxColumn: 80,
      renderCharacters: false,
    },
    scrollbar: {
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
    },

    // Editing settings
    wordWrap: 'on',
    wrappingIndent: 'same',
    tabSize: 2,
    insertSpaces: true,
    autoIndent: 'full',
    formatOnPaste: false,
    formatOnType: false,

    // Features
    folding: true,
    foldingStrategy: 'indentation',
    showFoldingControls: 'mouseover',
    bracketPairColorization: { enabled: true },
    guides: {
      indentation: true,
      bracketPairs: true,
    },

    // Suggestions and autocomplete
    quickSuggestions: {
      other: true,
      comments: false,
      strings: true,
    },
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'on',
    tabCompletion: 'on',
    wordBasedSuggestions: 'currentDocument',

    // Cursor settings
    cursorStyle: 'line',
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    smoothScrolling: true,

    // Selection
    multiCursorModifier: 'ctrlCmd',
    columnSelection: false,

    // Accessibility
    accessibilitySupport: 'auto',

    // Padding
    padding: {
      top: 10,
      bottom: 10,
    },
  };
}

/**
 * Diff editor options for comparing prompts
 */
export function getDiffEditorOptions(): monaco.editor.IStandaloneDiffEditorConstructionOptions {
  return {
    ...getDefaultEditorOptions(),
    renderSideBySide: true,
    enableSplitViewResizing: true,
    originalEditable: false,
    renderOverviewRuler: true,
    ignoreTrimWhitespace: false,
  };
}

/**
 * Read-only editor options for preview mode
 */
export function getReadOnlyEditorOptions(): monaco.editor.IStandaloneEditorConstructionOptions {
  return {
    ...getDefaultEditorOptions(),
    readOnly: true,
    domReadOnly: true,
    renderLineHighlight: 'none',
    minimap: { enabled: false },
    scrollbar: {
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8,
    },
  };
}

/**
 * Editor state that can be saved and restored
 */
export interface EditorState {
  viewState: monaco.editor.ICodeEditorViewState | null;
  scrollTop: number;
  scrollLeft: number;
}

/**
 * Get the current editor state for persistence
 */
export function getEditorState(editor: monaco.editor.IStandaloneCodeEditor): EditorState {
  return {
    viewState: editor.saveViewState(),
    scrollTop: editor.getScrollTop(),
    scrollLeft: editor.getScrollLeft(),
  };
}

/**
 * Restore editor state from saved state
 */
export function restoreEditorState(
  editor: monaco.editor.IStandaloneCodeEditor,
  state: EditorState
): void {
  if (state.viewState) {
    editor.restoreViewState(state.viewState);
  }
  editor.setScrollTop(state.scrollTop);
  editor.setScrollLeft(state.scrollLeft);
}
