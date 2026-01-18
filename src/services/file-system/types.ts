/**
 * File System Types and Interfaces
 *
 * Defines types for file operations, prompts, snippets, and file watching.
 */

/**
 * File storage configuration paths
 */
export interface IFileStorageConfig {
  baseDir: string;
  promptsDir: string;
  snippetsDir: string;
  personasDir: string;
  templatesDir: string;
  projectsDir: string;
  backupsDir: string;
}

/**
 * Supported file types
 */
export type FileType = 'prompt' | 'snippet' | 'persona' | 'template';

/**
 * Prompt metadata stored in YAML frontmatter
 */
export interface IPromptMetadata {
  id: string;
  title: string;
  description?: string;
  category?: string;
  tags: string[];
  aiProvider?: 'anthropic' | 'openai' | 'google' | 'xai' | 'ollama';
  isFavorite: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}

/**
 * Snippet metadata stored in YAML frontmatter
 */
export interface ISnippetMetadata {
  id: string;
  name: string;
  type: 'persona' | 'code' | 'text' | 'template';
  shortcut: string;
  description?: string;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Parsed file with frontmatter and content
 */
export interface IParsedFile<T = IPromptMetadata | ISnippetMetadata> {
  metadata: T;
  content: string;
  filePath: string;
  fileName: string;
}

/**
 * Prompt file with parsed data
 */
export interface IPromptFile extends IParsedFile<IPromptMetadata> {
  fileType: 'prompt';
}

/**
 * Snippet file with parsed data
 */
export interface ISnippetFile extends IParsedFile<ISnippetMetadata> {
  fileType: 'snippet';
}

/**
 * File info returned from file system operations
 */
export interface IFileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  isDirectory: boolean;
  createdAt: Date;
  modifiedAt: Date;
}

/**
 * Directory listing result
 */
export interface IDirectoryListing {
  path: string;
  files: IFileInfo[];
  directories: IFileInfo[];
}

/**
 * Directory tree node for hierarchical display
 */
export interface IDirectoryInfo {
  path: string;
  name: string;
  parentPath: string | null;
  children: IDirectoryInfo[];
  files: IFileInfo[];
  promptCount: number;
  isEmpty: boolean;
}

/**
 * Directory contents count
 */
export interface IDirectoryContentsCount {
  files: number;
  directories: number;
}

/**
 * File watcher event types
 */
export type FileWatcherEventType = 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';

/**
 * File watcher event data
 */
export interface IFileWatcherEvent {
  type: FileWatcherEventType;
  path: string;
  stats?: {
    size: number;
    mtime: Date;
  };
}

/**
 * Options for reading files
 */
export interface IReadFileOptions {
  encoding?: BufferEncoding;
}

/**
 * Options for writing files
 */
export interface IWriteFileOptions {
  encoding?: BufferEncoding;
  createDirectories?: boolean;
}

/**
 * Options for file watcher
 */
export interface IWatcherOptions {
  persistent?: boolean;
  ignoreInitial?: boolean;
  ignored?: string | RegExp | string[];
  depth?: number;
  awaitWriteFinish?:
    | boolean
    | {
        stabilityThreshold?: number;
        pollInterval?: number;
      };
}

/**
 * Result of a file operation
 */
export interface IFileOperationResult {
  success: boolean;
  error?: string;
  path?: string;
}

/**
 * File system API exposed to renderer via IPC
 */
export interface IFileSystemAPI {
  // Basic file operations
  readFile: (filePath: string, options?: IReadFileOptions) => Promise<string>;
  writeFile: (
    filePath: string,
    content: string,
    options?: IWriteFileOptions
  ) => Promise<IFileOperationResult>;
  deleteFile: (filePath: string) => Promise<IFileOperationResult>;
  copyFile: (source: string, destination: string) => Promise<IFileOperationResult>;
  moveFile: (source: string, destination: string) => Promise<IFileOperationResult>;
  fileExists: (filePath: string) => Promise<boolean>;
  getFileInfo: (filePath: string) => Promise<IFileInfo | null>;

  // Directory operations
  readDirectory: (dirPath: string) => Promise<IDirectoryListing>;
  createDirectory: (dirPath: string) => Promise<IFileOperationResult>;
  deleteDirectory: (dirPath: string, recursive?: boolean) => Promise<IFileOperationResult>;
  directoryExists: (dirPath: string) => Promise<boolean>;
  renameDirectory: (dirPath: string, newName: string) => Promise<string>;
  listDirectoryTree: (dirPath: string) => Promise<IDirectoryInfo>;
  getDirectoryContentsCount: (dirPath: string) => Promise<IDirectoryContentsCount>;
  isDirectoryEmpty: (dirPath: string) => Promise<boolean>;

  // Path utilities
  getBasePath: () => Promise<string>;
  joinPath: (...paths: string[]) => Promise<string>;
  getFileName: (filePath: string) => Promise<string>;
  getFileExtension: (filePath: string) => Promise<string>;
  getDirectoryName: (filePath: string) => Promise<string>;

  // File watching
  watchPath: (path: string, options?: IWatcherOptions) => Promise<string>;
  unwatchPath: (watcherId: string) => Promise<void>;
  unwatchAll: () => Promise<void>;

  // Events from main process
  onFileChange: (callback: (event: IFileWatcherEvent) => void) => () => void;
}

/**
 * Default file extensions
 */
export const FILE_EXTENSIONS = {
  PROMPT: '.md',
  SNIPPET: '.snippet.md',
  PERSONA: '.persona.md',
  TEMPLATE: '.template.md',
} as const;

/**
 * Default directory names
 */
export const DEFAULT_DIRECTORIES = {
  BASE: '.myndprompt',
  PROMPTS: 'prompts',
  SNIPPETS: 'snippets',
  PERSONAS: 'personas',
  TEMPLATES: 'templates',
  PROJECTS: 'projects',
  BACKUPS: 'backups',
} as const;
