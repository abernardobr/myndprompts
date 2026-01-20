/**
 * File Path Provider for Monaco Editor
 *
 * Provides completion suggestions for file paths from indexed folders
 * and from the current project (if the file being edited is in a project).
 * Triggered by the ^ character.
 */

import * as monaco from 'monaco-editor';
import { useFileSyncStore } from '@/stores/fileSyncStore';
import { useProjectStore } from '@/stores/projectStore';

/**
 * Interface for file info from the file system API
 */
interface IFileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  isDirectory: boolean;
  createdAt: Date;
  modifiedAt: Date;
}

/**
 * Unified file suggestion interface
 */
interface IFileSuggestion {
  fileName: string;
  fullPath: string;
  relativePath: string;
  extension: string;
  size: number;
  modifiedAt: Date;
  normalizedName: string;
  source: 'indexed' | 'project';
}

/**
 * Get project files using the file system API
 */
async function getProjectFiles(projectPath: string): Promise<IFileSuggestion[]> {
  if (!window?.fileSystemAPI) {
    return [];
  }

  try {
    const files: IFileInfo[] = await window.fileSystemAPI.listFilesRecursive(projectPath);
    return files.map((file) => ({
      fileName: file.name,
      fullPath: file.path,
      relativePath: file.path.replace(projectPath, '').replace(/^\//, ''),
      extension: file.extension,
      size: file.size,
      modifiedAt: new Date(file.modifiedAt),
      normalizedName: file.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
      source: 'project' as const,
    }));
  } catch {
    return [];
  }
}

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
      const projectStore = useProjectStore();

      // Ensure project store is initialized
      if (!projectStore.isInitialized) {
        try {
          await projectStore.initialize();
        } catch (err) {
          console.warn('[file-path-provider] Failed to initialize project store:', err);
        }
      }

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
      const queryLower = query.toLowerCase();

      // Get current file path from model URI
      const currentFilePath = model.uri.scheme === 'file' ? model.uri.fsPath : '';

      // Debug: log model URI info
      console.log('[file-path-provider] Model URI:', {
        scheme: model.uri.scheme,
        fsPath: model.uri.fsPath,
        path: model.uri.path,
        currentFilePath,
      });

      // Find project for current file
      const currentProject =
        currentFilePath !== '' ? projectStore.getProjectForPath(currentFilePath) : null;

      // Debug: log project info
      console.log('[file-path-provider] Project lookup:', {
        currentFilePath,
        currentProject: currentProject
          ? { name: currentProject.name, folderPath: currentProject.folderPath }
          : null,
        allProjects: projectStore.allProjects.map((p) => ({
          name: p.name,
          folderPath: p.folderPath,
        })),
      });

      // Collect all file suggestions
      const allSuggestions: IFileSuggestion[] = [];
      const seenPaths = new Set<string>();

      // 1. Get project files if we're in a project
      if (currentProject !== null) {
        const projectFiles = await getProjectFiles(currentProject.folderPath);
        console.log('[file-path-provider] Project files found:', projectFiles.length);
        for (const file of projectFiles) {
          // Filter by query if provided
          if (
            queryLower === '' ||
            file.normalizedName.includes(queryLower) ||
            file.fileName.toLowerCase().includes(queryLower)
          ) {
            if (!seenPaths.has(file.fullPath)) {
              seenPaths.add(file.fullPath);
              allSuggestions.push(file);
            }
          }
        }
      }

      // 2. Get indexed files from file sync
      try {
        const indexedFiles = await fileSyncStore.searchFiles(query);
        for (const file of indexedFiles) {
          if (!seenPaths.has(file.fullPath)) {
            seenPaths.add(file.fullPath);
            allSuggestions.push({
              fileName: file.fileName,
              fullPath: file.fullPath,
              relativePath: file.relativePath,
              extension: file.extension,
              size: file.size,
              modifiedAt: file.modifiedAt,
              normalizedName: file.normalizedName,
              source: 'indexed',
            });
          }
        }
      } catch {
        // Continue even if indexed files fail
      }

      if (allSuggestions.length === 0) {
        return { suggestions: [] };
      }

      // Calculate replacement range (from ^ to cursor)
      const range: monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: position.column - triggerMatch[0].length,
        endColumn: position.column,
      };

      // Create suggestions - project files first, then indexed files
      const suggestions: monaco.languages.CompletionItem[] = allSuggestions.map((file, index) => ({
        label: {
          label: file.fileName,
          description: file.source === 'project' ? `📁 ${file.relativePath}` : file.relativePath,
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
            file.source === 'project' ? '*(from current project)*' : '*(from indexed folders)*',
          ].join('\n\n'),
        },
        range,
        sortText: String(index).padStart(4, '0'),
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
 * Common languages to register the file path provider for
 */
const SUPPORTED_LANGUAGES = [
  'markdown',
  'javascript',
  'typescript',
  'json',
  'html',
  'css',
  'scss',
  'less',
  'python',
  'java',
  'go',
  'rust',
  'c',
  'cpp',
  'csharp',
  'swift',
  'php',
  'ruby',
  'shell',
  'yaml',
  'xml',
  'sql',
  'plaintext',
  'vue',
];

/**
 * Initialize the file path provider.
 * Returns a disposable to clean up all registered providers.
 */
export function initializeFilePathProvider(): monaco.IDisposable {
  const provider = createFilePathProvider();
  const disposables = SUPPORTED_LANGUAGES.map((lang) =>
    monaco.languages.registerCompletionItemProvider(lang, provider)
  );

  return {
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
