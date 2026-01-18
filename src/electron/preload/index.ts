import { contextBridge, ipcRenderer } from 'electron';
import type {
  IFileInfo,
  IDirectoryListing,
  IDirectoryInfo,
  IDirectoryContentsCount,
  IFileOperationResult,
  IReadFileOptions,
  IWriteFileOptions,
  IWatcherOptions,
  IFileWatcherEvent,
  IFileStorageConfig,
} from '../../services/file-system/types';

// Dialog options
export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
}

export interface OpenDialogResult {
  canceled: boolean;
  filePaths: string[];
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface SaveDialogResult {
  canceled: boolean;
  filePath?: string;
}

// Type definitions for exposed API
export interface ElectronAPI {
  // App info
  getVersion: () => Promise<string>;
  getPlatform: () => Promise<NodeJS.Platform>;
  getUserDataPath: () => Promise<string>;

  // Dialogs
  showOpenDialog: (options: OpenDialogOptions) => Promise<OpenDialogResult>;
  showSaveDialog: (options: SaveDialogOptions) => Promise<SaveDialogResult>;
}

// File System API
export interface FileSystemAPI {
  // Configuration
  getBasePath: () => Promise<string>;
  getConfig: () => Promise<IFileStorageConfig>;
  initializeDirectories: () => Promise<void>;

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
  joinPath: (...paths: string[]) => Promise<string>;
  getFileName: (filePath: string) => Promise<string>;
  getFileExtension: (filePath: string) => Promise<string>;
  getDirectoryName: (filePath: string) => Promise<string>;

  // File listing
  listMarkdownFiles: (dirPath: string, patternString?: string) => Promise<IFileInfo[]>;
  backupFile: (filePath: string) => Promise<IFileOperationResult>;

  // File watching
  watchPath: (path: string, options?: IWatcherOptions) => Promise<string>;
  unwatchPath: (watcherId: string) => Promise<boolean>;
  unwatchAll: () => Promise<void>;

  // Events from main process
  onFileChange: (callback: (event: IFileWatcherEvent) => void) => () => void;
}

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
const electronApi: ElectronAPI = {
  getVersion: () => ipcRenderer.invoke('app:get-version') as Promise<string>,
  getPlatform: () => ipcRenderer.invoke('app:get-platform') as Promise<NodeJS.Platform>,
  getUserDataPath: () => ipcRenderer.invoke('app:get-user-data-path') as Promise<string>,
  showOpenDialog: (options) =>
    ipcRenderer.invoke('dialog:open', options) as Promise<OpenDialogResult>,
  showSaveDialog: (options) =>
    ipcRenderer.invoke('dialog:save', options) as Promise<SaveDialogResult>,
};

const fileSystemApi: FileSystemAPI = {
  // Configuration
  getBasePath: () => ipcRenderer.invoke('fs:get-base-path') as Promise<string>,
  getConfig: () => ipcRenderer.invoke('fs:get-config') as Promise<IFileStorageConfig>,
  initializeDirectories: () => ipcRenderer.invoke('fs:initialize-directories') as Promise<void>,

  // Basic file operations
  readFile: (filePath, options) =>
    ipcRenderer.invoke('fs:read-file', filePath, options) as Promise<string>,
  writeFile: (filePath, content, options) =>
    ipcRenderer.invoke(
      'fs:write-file',
      filePath,
      content,
      options
    ) as Promise<IFileOperationResult>,
  deleteFile: (filePath) =>
    ipcRenderer.invoke('fs:delete-file', filePath) as Promise<IFileOperationResult>,
  copyFile: (source, destination) =>
    ipcRenderer.invoke('fs:copy-file', source, destination) as Promise<IFileOperationResult>,
  moveFile: (source, destination) =>
    ipcRenderer.invoke('fs:move-file', source, destination) as Promise<IFileOperationResult>,
  fileExists: (filePath) => ipcRenderer.invoke('fs:file-exists', filePath) as Promise<boolean>,
  getFileInfo: (filePath) =>
    ipcRenderer.invoke('fs:get-file-info', filePath) as Promise<IFileInfo | null>,

  // Directory operations
  readDirectory: (dirPath) =>
    ipcRenderer.invoke('fs:read-directory', dirPath) as Promise<IDirectoryListing>,
  createDirectory: (dirPath) =>
    ipcRenderer.invoke('fs:create-directory', dirPath) as Promise<IFileOperationResult>,
  deleteDirectory: (dirPath, recursive) =>
    ipcRenderer.invoke('fs:delete-directory', dirPath, recursive) as Promise<IFileOperationResult>,
  directoryExists: (dirPath) =>
    ipcRenderer.invoke('fs:directory-exists', dirPath) as Promise<boolean>,
  renameDirectory: (dirPath, newName) =>
    ipcRenderer.invoke('fs:rename-directory', dirPath, newName) as Promise<string>,
  listDirectoryTree: (dirPath) =>
    ipcRenderer.invoke('fs:list-directory-tree', dirPath) as Promise<IDirectoryInfo>,
  getDirectoryContentsCount: (dirPath) =>
    ipcRenderer.invoke(
      'fs:get-directory-contents-count',
      dirPath
    ) as Promise<IDirectoryContentsCount>,
  isDirectoryEmpty: (dirPath) =>
    ipcRenderer.invoke('fs:is-directory-empty', dirPath) as Promise<boolean>,

  // Path utilities
  joinPath: (...paths) => ipcRenderer.invoke('fs:join-path', ...paths) as Promise<string>,
  getFileName: (filePath) => ipcRenderer.invoke('fs:get-file-name', filePath) as Promise<string>,
  getFileExtension: (filePath) =>
    ipcRenderer.invoke('fs:get-file-extension', filePath) as Promise<string>,
  getDirectoryName: (filePath) =>
    ipcRenderer.invoke('fs:get-directory-name', filePath) as Promise<string>,

  // File listing
  listMarkdownFiles: (dirPath, patternString) =>
    ipcRenderer.invoke('fs:list-markdown-files', dirPath, patternString) as Promise<IFileInfo[]>,
  backupFile: (filePath) =>
    ipcRenderer.invoke('fs:backup-file', filePath) as Promise<IFileOperationResult>,

  // File watching
  watchPath: (path, options) =>
    ipcRenderer.invoke('fs:watch-path', path, options) as Promise<string>,
  unwatchPath: (watcherId) => ipcRenderer.invoke('fs:unwatch-path', watcherId) as Promise<boolean>,
  unwatchAll: () => ipcRenderer.invoke('fs:unwatch-all') as Promise<void>,

  // Events from main process
  onFileChange: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: IFileWatcherEvent) => {
      callback(data);
    };
    ipcRenderer.on('fs:file-change', handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('fs:file-change', handler);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronApi);
contextBridge.exposeInMainWorld('fileSystemAPI', fileSystemApi);

// Type augmentation for window object
declare global {
  interface Window {
    electronAPI: ElectronAPI;
    fileSystemAPI: FileSystemAPI;
  }
}
