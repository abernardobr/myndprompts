/**
 * File Path Provider for Monaco Editor
 *
 * Provides completion suggestions for file paths from indexed folders.
 * Triggered by the ^ character.
 */

import * as monaco from 'monaco-editor';
import { useFileSyncStore } from '@/stores/fileSyncStore';

/**
 * Creates a Monaco completion provider for file path suggestions.
 * Triggered by the ^ character.
 */
export function createFilePathProvider(): monaco.languages.CompletionItemProvider {
  return {
    triggerCharacters: ['^'],

    async provideCompletionItems(
      model: monaco.editor.ITextModel,
      position: monaco.Position,
      _context: monaco.languages.CompletionContext,
      _token: monaco.CancellationToken
    ): Promise<monaco.languages.CompletionList> {
      const fileSyncStore = useFileSyncStore();

      // Get text on current line up to cursor
      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      // Check if triggered by ^
      const triggerMatch = textUntilPosition.match(/\^([^\s]*)$/);
      if (!triggerMatch) {
        return { suggestions: [] };
      }

      const query = triggerMatch[1] !== undefined && triggerMatch[1] !== '' ? triggerMatch[1] : '';

      // Search indexed files
      let files;
      try {
        files = await fileSyncStore.searchFiles(query);
      } catch {
        return { suggestions: [] };
      }

      if (files.length === 0) {
        return { suggestions: [] };
      }

      // Calculate replacement range (from ^ to cursor)
      const range: monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: position.column - triggerMatch[0].length,
        endColumn: position.column,
      };

      // Create suggestions
      const suggestions: monaco.languages.CompletionItem[] = files.map((file, index) => ({
        label: {
          label: file.fileName,
          description: file.relativePath,
        },
        kind: getFileKind(file.extension),
        insertText: file.fullPath,
        detail: file.relativePath,
        documentation: {
          value: [
            `**File:** ${file.fileName}`,
            `**Path:** \`${file.fullPath}\``,
            `**Size:** ${formatFileSize(file.size)}`,
            `**Modified:** ${file.modifiedAt.toLocaleDateString()}`,
          ].join('\n\n'),
        },
        range,
        sortText: String(index).padStart(4, '0'), // Preserve relevance order from store
        filterText: `^${file.normalizedName}`,
      }));

      return { suggestions };
    },
  };
}

/**
 * Get appropriate CompletionItemKind based on file extension.
 */
function getFileKind(extension: string): monaco.languages.CompletionItemKind {
  const codeExtensions = [
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.vue',
    '.svelte',
    '.py',
    '.rb',
    '.php',
    '.java',
    '.kt',
    '.scala',
    '.go',
    '.rs',
    '.c',
    '.cpp',
    '.h',
    '.hpp',
    '.cs',
    '.fs',
    '.swift',
    '.m',
    '.sh',
    '.bash',
    '.zsh',
    '.sql',
  ];

  const textExtensions = [
    '.md',
    '.mdx',
    '.txt',
    '.rst',
    '.json',
    '.yaml',
    '.yml',
    '.toml',
    '.xml',
    '.html',
    '.htm',
    '.css',
    '.scss',
    '.sass',
    '.less',
    '.env',
    '.ini',
    '.conf',
    '.cfg',
  ];

  if (codeExtensions.includes(extension)) {
    return monaco.languages.CompletionItemKind.File;
  }
  if (textExtensions.includes(extension)) {
    return monaco.languages.CompletionItemKind.Text;
  }
  return monaco.languages.CompletionItemKind.File;
}

/**
 * Format file size for display.
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Initialize the file path provider.
 * Returns a disposable to clean up the provider.
 */
export function initializeFilePathProvider(): monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider('markdown', createFilePathProvider());
}
