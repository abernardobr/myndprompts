import { contextBridge, ipcRenderer, webUtils } from 'electron';
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
import type {
  IExportOptions,
  IImportOptions,
  IExportResult,
  IImportResult,
  IValidationResult,
  IExportProgress,
  IImportProgress,
} from '../../services/export-import/types';
import type {
  IGitStatusSummary,
  IGitCommit,
  IGitBranch,
  IGitRemote,
  IGitCheckResult,
  IGitRepoCheckResult,
  IGitInitResult,
  IGitCloneResult,
  IGitCommitResult,
  IGitOperationResult,
  IGitLogOptions,
  IStashEntry,
  IStashResult,
} from '../../services/git/types';

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

// File Indexing types (for File Sync feature)
export interface IIndexedFile {
  fileName: string;
  normalizedName: string;
  fullPath: string;
  relativePath: string;
  extension: string;
  size: number;
  modifiedAt: Date;
}

export interface IIndexProgress {
  operationId: string;
  phase: 'scanning' | 'indexing' | 'complete' | 'cancelled' | 'error';
  current: number;
  total: number;
  currentFile?: string;
  error?: string;
}

// Type definitions for exposed API
export interface ElectronAPI {
  // App info
  getVersion: () => Promise<string>;
  getPlatform: () => Promise<NodeJS.Platform>;
  getUserDataPath: () => Promise<string>;

  // Window controls
  setTrafficLightsVisible: (visible: boolean) => Promise<void>;

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
  readFileAsDataUrl: (filePath: string, mimeType?: string) => Promise<string>;
  writeFile: (
    filePath: string,
    content: string,
    options?: IWriteFileOptions
  ) => Promise<IFileOperationResult>;
  exportFile: (
    absolutePath: string,
    content: string,
    options?: IWriteFileOptions
  ) => Promise<IFileOperationResult>;
  deleteFile: (filePath: string) => Promise<IFileOperationResult>;
  copyFile: (source: string, destination: string) => Promise<IFileOperationResult>;
  copyFileToDirectory: (
    sourcePath: string,
    destDir: string
  ) => Promise<{ success: boolean; newPath?: string; error?: string }>;
  writeBinaryFileToDirectory: (
    destDir: string,
    fileName: string,
    content: Uint8Array
  ) => Promise<{ success: boolean; newPath?: string; error?: string }>;
  copyDirectory: (
    sourcePath: string,
    destDir: string
  ) => Promise<{ success: boolean; newPath?: string; error?: string }>;
  moveFile: (source: string, destination: string) => Promise<IFileOperationResult>;
  fileExists: (filePath: string) => Promise<boolean>;
  getFileInfo: (filePath: string) => Promise<IFileInfo | null>;
  getExternalFileInfo: (filePath: string) => Promise<IFileInfo | null>;

  // Directory operations
  readDirectory: (dirPath: string) => Promise<IDirectoryListing>;
  createDirectory: (dirPath: string) => Promise<IFileOperationResult>;
  deleteDirectory: (dirPath: string, recursive?: boolean) => Promise<IFileOperationResult>;
  directoryExists: (dirPath: string) => Promise<boolean>;
  renameDirectory: (dirPath: string, newName: string) => Promise<string>;
  listDirectoryTree: (dirPath: string) => Promise<IDirectoryInfo>;
  getDirectoryContentsCount: (dirPath: string) => Promise<IDirectoryContentsCount>;
  isDirectoryEmpty: (dirPath: string) => Promise<boolean>;
  listFilesRecursive: (dirPath: string) => Promise<IFileInfo[]>;

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

  // File Indexing (File Sync feature)
  startIndexing: (folderPath: string, operationId: string) => Promise<IIndexedFile[]>;
  cancelIndexing: (operationId: string) => Promise<boolean>;
  onIndexProgress: (callback: (data: IIndexProgress) => void) => () => void;

  // Export/Import
  exportData: (destPath: string, options?: IExportOptions) => Promise<IExportResult>;
  importData: (zipPath: string, options?: IImportOptions) => Promise<IImportResult>;
  validateExport: (zipPath: string) => Promise<IValidationResult>;
  onExportImportProgress: (
    callback: (progress: IExportProgress | IImportProgress) => void
  ) => () => void;

  // Utility for drag-and-drop (synchronous, runs in preload context)
  getPathForFile: (file: File) => string;
}

// External Apps API
export interface ExternalAppsAPI {
  showInFolder: (filePath: string) => Promise<void>;
  openWithDefault: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  openInApp: (filePath: string, appName: string) => Promise<{ success: boolean; error?: string }>;
}

// Menu API (events from application menu)
export interface MenuAPI {
  onSettings: (callback: () => void) => () => void;
  onNewPrompt: (callback: () => void) => () => void;
  onOpen: (callback: () => void) => () => void;
  onSave: (callback: () => void) => () => void;
  onCheckForUpdates: (callback: () => void) => () => void;
  onHelp: (callback: () => void) => () => void;
}

// Update API
export interface IUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  downloadUrl?: string;
}

export interface IUpdateCheckResult {
  success: boolean;
  updateInfo?: IUpdateInfo;
  error?: string;
}

export interface UpdateAPI {
  checkForUpdates: () => Promise<IUpdateCheckResult>;
  checkForUpdatesForce: () => Promise<IUpdateCheckResult>;
  getCurrentVersion: () => Promise<string>;
  openDownloadPage: (url: string) => Promise<void>;
}

// Git API
export interface GitAPI {
  // Prerequisites
  isInstalled: () => Promise<IGitCheckResult>;
  isRepo: (path: string) => Promise<IGitRepoCheckResult>;

  // Repository operations
  init: (path: string) => Promise<IGitInitResult>;
  clone: (repoUrl: string, targetPath: string) => Promise<IGitCloneResult>;
  setWorkingDirectory: (path: string) => Promise<void>;

  // Status and staging
  status: (path?: string) => Promise<IGitStatusSummary>;
  add: (files: string[] | 'all', path?: string) => Promise<IGitOperationResult>;
  unstage: (files: string[], path?: string) => Promise<IGitOperationResult>;

  // Commit operations
  commit: (message: string, path?: string) => Promise<IGitCommitResult>;
  log: (options?: IGitLogOptions, path?: string) => Promise<IGitCommit[]>;
  diff: (
    filePath?: string,
    commitHash?: string,
    cached?: boolean,
    path?: string
  ) => Promise<string>;
  discardChanges: (filePath: string, path?: string) => Promise<IGitOperationResult>;

  // Remote operations
  push: (remote?: string, branch?: string, path?: string) => Promise<IGitOperationResult>;
  pull: (remote?: string, branch?: string, path?: string) => Promise<IGitOperationResult>;
  fetch: (remote?: string, path?: string) => Promise<IGitOperationResult>;
  remotes: (path?: string) => Promise<IGitRemote[]>;
  addRemote: (name: string, url: string, path?: string) => Promise<IGitOperationResult>;
  removeRemote: (name: string, path?: string) => Promise<IGitOperationResult>;

  // Branch operations
  branches: (path?: string) => Promise<IGitBranch[]>;
  createBranch: (name: string, path?: string) => Promise<IGitOperationResult>;
  switchBranch: (name: string, path?: string) => Promise<IGitOperationResult>;
  deleteBranch: (name: string, force?: boolean, path?: string) => Promise<IGitOperationResult>;

  // Stash operations
  stash: (message?: string, path?: string) => Promise<IGitOperationResult>;
  stashPop: (path?: string) => Promise<IStashResult>;
  stashList: (path?: string) => Promise<IStashEntry[]>;

  // Configuration
  getConfig: (path?: string) => Promise<{ name?: string; email?: string }>;
  setConfig: (
    name: string,
    email: string,
    global?: boolean,
    path?: string
  ) => Promise<IGitOperationResult>;

  // Tracked files (files that have been committed)
  getTrackedFiles: (path?: string) => Promise<string[]>;

  // Remove Git (delete .git folder)
  removeGit: (path: string) => Promise<IGitOperationResult>;
}

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
const electronApi: ElectronAPI = {
  getVersion: () => ipcRenderer.invoke('app:get-version') as Promise<string>,
  getPlatform: () => ipcRenderer.invoke('app:get-platform') as Promise<NodeJS.Platform>,
  getUserDataPath: () => ipcRenderer.invoke('app:get-user-data-path') as Promise<string>,
  setTrafficLightsVisible: (visible) =>
    ipcRenderer.invoke('app:set-traffic-lights-visible', visible) as Promise<void>,
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
  readFileAsDataUrl: (filePath, mimeType) =>
    ipcRenderer.invoke('fs:read-file-as-data-url', filePath, mimeType) as Promise<string>,
  writeFile: (filePath, content, options) =>
    ipcRenderer.invoke(
      'fs:write-file',
      filePath,
      content,
      options
    ) as Promise<IFileOperationResult>,
  exportFile: (absolutePath, content, options) =>
    ipcRenderer.invoke(
      'fs:export-file',
      absolutePath,
      content,
      options
    ) as Promise<IFileOperationResult>,
  deleteFile: (filePath) =>
    ipcRenderer.invoke('fs:delete-file', filePath) as Promise<IFileOperationResult>,
  copyFile: (source, destination) =>
    ipcRenderer.invoke('fs:copy-file', source, destination) as Promise<IFileOperationResult>,
  copyFileToDirectory: (sourcePath, destDir) =>
    ipcRenderer.invoke('fs:copy-file-to-directory', sourcePath, destDir) as Promise<{
      success: boolean;
      newPath?: string;
      error?: string;
    }>,
  writeBinaryFileToDirectory: (destDir, fileName, content) =>
    ipcRenderer.invoke('fs:write-binary-file-to-directory', destDir, fileName, content) as Promise<{
      success: boolean;
      newPath?: string;
      error?: string;
    }>,
  copyDirectory: (sourcePath, destDir) =>
    ipcRenderer.invoke('fs:copy-directory', sourcePath, destDir) as Promise<{
      success: boolean;
      newPath?: string;
      error?: string;
    }>,
  moveFile: (source, destination) =>
    ipcRenderer.invoke('fs:move-file', source, destination) as Promise<IFileOperationResult>,
  fileExists: (filePath) => ipcRenderer.invoke('fs:file-exists', filePath) as Promise<boolean>,
  getFileInfo: (filePath) =>
    ipcRenderer.invoke('fs:get-file-info', filePath) as Promise<IFileInfo | null>,
  getExternalFileInfo: (filePath) =>
    ipcRenderer.invoke('fs:get-external-file-info', filePath) as Promise<IFileInfo | null>,

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
  listFilesRecursive: (dirPath) =>
    ipcRenderer.invoke('fs:list-files-recursive', dirPath) as Promise<IFileInfo[]>,

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

  // File Indexing (File Sync feature)
  startIndexing: (folderPath, operationId) =>
    ipcRenderer.invoke('fs:start-indexing', folderPath, operationId) as Promise<IIndexedFile[]>,
  cancelIndexing: (operationId) =>
    ipcRenderer.invoke('fs:cancel-indexing', operationId) as Promise<boolean>,
  onIndexProgress: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: IIndexProgress): void => {
      callback(data);
    };
    ipcRenderer.on('fs:index-progress', handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('fs:index-progress', handler);
    };
  },

  // Export/Import
  exportData: (destPath, options) =>
    ipcRenderer.invoke('fs:export-data', destPath, options) as Promise<IExportResult>,
  importData: (zipPath, options) =>
    ipcRenderer.invoke('fs:import-data', zipPath, options) as Promise<IImportResult>,
  validateExport: (zipPath) =>
    ipcRenderer.invoke('fs:validate-export', zipPath) as Promise<IValidationResult>,
  onExportImportProgress: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: IExportProgress | IImportProgress
    ): void => {
      callback(progress);
    };
    ipcRenderer.on('export-import:progress', handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('export-import:progress', handler);
    };
  },

  // Get file path for dropped files (uses Electron's webUtils)
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
};

const externalAppsApi: ExternalAppsAPI = {
  showInFolder: (filePath) =>
    ipcRenderer.invoke('external-apps:show-in-folder', filePath) as Promise<void>,
  openWithDefault: (filePath) =>
    ipcRenderer.invoke('external-apps:open-default', filePath) as Promise<{
      success: boolean;
      error?: string;
    }>,
  openInApp: (filePath, appName) =>
    ipcRenderer.invoke('external-apps:open-in-app', filePath, appName) as Promise<{
      success: boolean;
      error?: string;
    }>,
};

const gitApi: GitAPI = {
  // Prerequisites
  isInstalled: () => ipcRenderer.invoke('git:is-installed') as Promise<IGitCheckResult>,
  isRepo: (path) => ipcRenderer.invoke('git:is-repo', path) as Promise<IGitRepoCheckResult>,

  // Repository operations
  init: (path) => ipcRenderer.invoke('git:init', path) as Promise<IGitInitResult>,
  clone: (repoUrl, targetPath) =>
    ipcRenderer.invoke('git:clone', repoUrl, targetPath) as Promise<IGitCloneResult>,
  setWorkingDirectory: (path) =>
    ipcRenderer.invoke('git:set-working-directory', path) as Promise<void>,

  // Status and staging
  status: (path) => ipcRenderer.invoke('git:status', path) as Promise<IGitStatusSummary>,
  add: (files, path) => ipcRenderer.invoke('git:add', files, path) as Promise<IGitOperationResult>,
  unstage: (files, path) =>
    ipcRenderer.invoke('git:unstage', files, path) as Promise<IGitOperationResult>,

  // Commit operations
  commit: (message, path) =>
    ipcRenderer.invoke('git:commit', message, path) as Promise<IGitCommitResult>,
  log: (options, path) =>
    ipcRenderer.invoke('git:log', options ?? {}, path) as Promise<IGitCommit[]>,
  diff: (filePath, commitHash, cached, path) =>
    ipcRenderer.invoke('git:diff', filePath, commitHash, cached, path) as Promise<string>,
  discardChanges: (filePath, path) =>
    ipcRenderer.invoke('git:discard-changes', filePath, path) as Promise<IGitOperationResult>,

  // Remote operations
  push: (remote, branch, path) =>
    ipcRenderer.invoke('git:push', remote, branch, path) as Promise<IGitOperationResult>,
  pull: (remote, branch, path) =>
    ipcRenderer.invoke('git:pull', remote, branch, path) as Promise<IGitOperationResult>,
  fetch: (remote, path) =>
    ipcRenderer.invoke('git:fetch', remote, path) as Promise<IGitOperationResult>,
  remotes: (path) => ipcRenderer.invoke('git:remotes', path) as Promise<IGitRemote[]>,
  addRemote: (name, url, path) =>
    ipcRenderer.invoke('git:add-remote', name, url, path) as Promise<IGitOperationResult>,
  removeRemote: (name, path) =>
    ipcRenderer.invoke('git:remove-remote', name, path) as Promise<IGitOperationResult>,

  // Branch operations
  branches: (path) => ipcRenderer.invoke('git:branches', path) as Promise<IGitBranch[]>,
  createBranch: (name, path) =>
    ipcRenderer.invoke('git:create-branch', name, path) as Promise<IGitOperationResult>,
  switchBranch: (name, path) =>
    ipcRenderer.invoke('git:switch-branch', name, path) as Promise<IGitOperationResult>,
  deleteBranch: (name, force, path) =>
    ipcRenderer.invoke('git:delete-branch', name, force, path) as Promise<IGitOperationResult>,

  // Stash operations
  stash: (message, path) =>
    ipcRenderer.invoke('git:stash', message, path) as Promise<IGitOperationResult>,
  stashPop: (path) => ipcRenderer.invoke('git:stash-pop', path) as Promise<IStashResult>,
  stashList: (path) => ipcRenderer.invoke('git:stash-list', path) as Promise<IStashEntry[]>,

  // Configuration
  getConfig: (path) =>
    ipcRenderer.invoke('git:get-config', path) as Promise<{ name?: string; email?: string }>,
  setConfig: (name, email, global, path) =>
    ipcRenderer.invoke('git:set-config', name, email, global, path) as Promise<IGitOperationResult>,

  // Tracked files (files that have been committed)
  getTrackedFiles: (path) => ipcRenderer.invoke('git:tracked-files', path) as Promise<string[]>,

  // Remove Git (delete .git folder)
  removeGit: (path) => ipcRenderer.invoke('git:remove', path) as Promise<IGitOperationResult>,
};

const menuApi: MenuAPI = {
  onSettings: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('menu:settings', handler);
    return () => ipcRenderer.removeListener('menu:settings', handler);
  },
  onNewPrompt: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('menu:new-prompt', handler);
    return () => ipcRenderer.removeListener('menu:new-prompt', handler);
  },
  onOpen: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('menu:open', handler);
    return () => ipcRenderer.removeListener('menu:open', handler);
  },
  onSave: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('menu:save', handler);
    return () => ipcRenderer.removeListener('menu:save', handler);
  },
  onCheckForUpdates: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('menu:check-for-updates', handler);
    return () => ipcRenderer.removeListener('menu:check-for-updates', handler);
  },
  onHelp: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('menu:help', handler);
    return () => ipcRenderer.removeListener('menu:help', handler);
  },
};

const updateApi: UpdateAPI = {
  checkForUpdates: () => ipcRenderer.invoke('update:check') as Promise<IUpdateCheckResult>,
  checkForUpdatesForce: () =>
    ipcRenderer.invoke('update:check-force') as Promise<IUpdateCheckResult>,
  getCurrentVersion: () => ipcRenderer.invoke('update:get-current-version') as Promise<string>,
  openDownloadPage: (url) => ipcRenderer.invoke('update:open-download-page', url) as Promise<void>,
};

contextBridge.exposeInMainWorld('electronAPI', electronApi);
contextBridge.exposeInMainWorld('fileSystemAPI', fileSystemApi);
contextBridge.exposeInMainWorld('externalAppsAPI', externalAppsApi);
contextBridge.exposeInMainWorld('gitAPI', gitApi);
contextBridge.exposeInMainWorld('menuAPI', menuApi);
contextBridge.exposeInMainWorld('updateAPI', updateApi);

// Type augmentation for window object
declare global {
  interface Window {
    electronAPI: ElectronAPI;
    fileSystemAPI: FileSystemAPI;
    externalAppsAPI: ExternalAppsAPI;
    gitAPI: GitAPI;
    menuAPI: MenuAPI;
    updateAPI: UpdateAPI;
  }
}
