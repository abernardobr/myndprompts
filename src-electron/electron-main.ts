/**
 * Electron Main Process
 *
 * Main entry point for the Electron application.
 * Sets up the BrowserWindow and IPC handlers.
 */

import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { getFileSystemService } from '../src/electron/main/services/file-system.service';
import { getFileWatcherService } from '../src/electron/main/services/file-watcher.service';
import { getGitService } from '../src/electron/main/services/git.service';
import { getFileIndexerService } from '../src/electron/main/services/file-indexer.service';
import { getUpdateService } from '../src/electron/main/services/update.service';
import { getExportImportService } from '../src/electron/main/services/export-import.service';
import { getStorageMigrationService } from '../src/electron/main/services/storage-migration.service';
import { getSecureStorageService } from '../src/electron/main/services/secure-storage.service';
import { getAIModelFetcherService } from '../src/electron/main/services/ai-model-fetcher.service';
import type {
  IReadFileOptions,
  IWriteFileOptions,
  IWatcherOptions,
} from '../src/services/file-system/types';
import type { IGitLogOptions } from '../src/services/git/types';
import type { IExportOptions, IImportOptions } from '../src/services/export-import/types';

// needed in case process is undefined under Linux
const platform = process.platform || os.platform();

// Read version from package.json (app.getVersion() returns Electron version in dev mode)
let appVersion = '0.0.0';
try {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { version: string };
  appVersion = packageJson.version;
} catch {
  appVersion = app.getVersion();
}

const currentDir = fileURLToPath(new URL('.', import.meta.url));

// Set the app name as early as possible (before ready event)
// This affects the macOS menu bar name
if (platform === 'darwin') {
  app.name = 'MyndPrompts';
}

let mainWindow: BrowserWindow | undefined;

// Initialize services
const fileSystemService = getFileSystemService();
const fileWatcherService = getFileWatcherService();
const gitService = getGitService();

/**
 * Create the application menu
 */
function createApplicationMenu(): void {
  const isMac = platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: 'MyndPrompts',
            submenu: [
              { role: 'about' as const, label: 'About MyndPrompts' },
              { type: 'separator' as const },
              {
                label: 'Settings',
                accelerator: 'Cmd+,',
                click: () => {
                  mainWindow?.webContents.send('menu:settings');
                },
              },
              {
                label: 'Check for Updates...',
                click: () => {
                  mainWindow?.webContents.send('menu:check-for-updates');
                },
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const, label: 'Hide MyndPrompts' },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const, label: 'Quit MyndPrompts' },
            ],
          },
        ]
      : []),
    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Prompt',
          accelerator: isMac ? 'Cmd+N' : 'Ctrl+N',
          click: () => {
            mainWindow?.webContents.send('menu:new-prompt');
          },
        },
        {
          label: 'Open Prompt',
          accelerator: isMac ? 'Cmd+O' : 'Ctrl+O',
          click: () => {
            mainWindow?.webContents.send('menu:open-prompt');
          },
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: isMac ? 'Cmd+S' : 'Ctrl+S',
          click: () => {
            mainWindow?.webContents.send('menu:save');
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' as const },
              { role: 'delete' as const },
              { role: 'selectAll' as const },
            ]
          : [
              { role: 'delete' as const },
              { type: 'separator' as const },
              { role: 'selectAll' as const },
            ]),
      ],
    },
    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    },
    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates...',
          click: () => {
            mainWindow?.webContents.send('menu:check-for-updates');
          },
        },
        { type: 'separator' },
        {
          label: 'Open Help',
          click: () => {
            mainWindow?.webContents.send('menu:help');
          },
        },
        {
          label: 'MyndPrompts Documentation',
          click: async () => {
            await shell.openExternal('https://myndprompts.com');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function createWindow() {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    icon: path.resolve(currentDir, 'icons/icon.png'), // tray icon
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    useContentSize: true,
    frame: platform !== 'darwin',
    titleBarStyle: platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: platform === 'darwin' ? { x: 13, y: 12 } : undefined,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // More info: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/electron-preload-script
      preload: path.resolve(
        currentDir,
        path.join(
          process.env.QUASAR_ELECTRON_PRELOAD_FOLDER,
          'electron-preload' + process.env.QUASAR_ELECTRON_PRELOAD_EXTENSION
        )
      ),
    },
  });

  // Set the main window for file watcher events
  fileWatcherService.setMainWindow(mainWindow);

  // Initialize storage directories
  await fileSystemService.initializeDirectories();

  if (process.env.DEV) {
    await mainWindow.loadURL(process.env.APP_URL);
  } else {
    await mainWindow.loadFile('index.html');
  }

  if (process.env.DEBUGGING) {
    // if on DEV or Production with debug enabled
    mainWindow.webContents.openDevTools();
  } else {
    // we're on production; no access to devtools pls
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools();
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = undefined;
    fileWatcherService.setMainWindow(null);
  });
}

void app.whenReady().then(() => {
  createApplicationMenu();
  void createWindow();
});

app.on('window-all-closed', () => {
  if (platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === undefined) {
    void createWindow();
  }
});

// Clean up watchers on quit
app.on('before-quit', () => {
  void fileWatcherService.unwatchAll();
});

// Security: Prevent new window creation
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});

// ================================
// App IPC Handlers
// ================================

ipcMain.handle('app:get-version', () => {
  return appVersion;
});

ipcMain.handle('app:get-platform', () => {
  return platform;
});

ipcMain.handle('app:get-user-data-path', () => {
  return app.getPath('userData');
});

// Toggle macOS traffic light visibility (for fullscreen dialogs)
ipcMain.handle('app:set-traffic-lights-visible', (_event, visible: boolean) => {
  if (mainWindow && platform === 'darwin') {
    mainWindow.setWindowButtonVisibility(visible);
  }
});

// ================================
// Dialog IPC Handlers
// ================================

interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
}

interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

ipcMain.handle('dialog:open', async (_event, options: OpenDialogOptions) => {
  if (!mainWindow) {
    return { canceled: true, filePaths: [] };
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    title: options.title ?? 'Open',
    defaultPath: options.defaultPath,
    filters: options.filters,
    properties: options.properties ?? ['openFile'],
  });

  return {
    canceled: result.canceled,
    filePaths: result.filePaths,
  };
});

ipcMain.handle('dialog:save', async (_event, options: SaveDialogOptions) => {
  if (!mainWindow) {
    return { canceled: true, filePath: undefined };
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: options.title ?? 'Save',
    defaultPath: options.defaultPath,
    filters: options.filters,
  });

  return {
    canceled: result.canceled,
    filePath: result.filePath,
  };
});

// ================================
// File System IPC Handlers
// ================================

// Configuration
ipcMain.handle('fs:get-base-path', () => {
  return fileSystemService.getBasePath();
});

ipcMain.handle('fs:get-config', () => {
  return fileSystemService.getConfig();
});

ipcMain.handle('fs:initialize-directories', async () => {
  await fileSystemService.initializeDirectories();
});

ipcMain.handle('fs:is-path-allowed', (_event, filePath: string) => {
  return fileSystemService.isPathAllowed(filePath);
});

// Basic file operations
ipcMain.handle('fs:read-file', async (_event, filePath: string, options?: IReadFileOptions) => {
  return fileSystemService.readFile(filePath, options);
});

ipcMain.handle('fs:read-file-as-data-url', async (_event, filePath: string, mimeType?: string) => {
  return fileSystemService.readFileAsDataUrl(filePath, mimeType);
});

ipcMain.handle(
  'fs:write-file',
  async (_event, filePath: string, content: string, options?: IWriteFileOptions) => {
    return fileSystemService.writeFile(filePath, content, options);
  }
);

ipcMain.handle(
  'fs:export-file',
  async (_event, absolutePath: string, content: string, options?: IWriteFileOptions) => {
    return fileSystemService.exportFile(absolutePath, content, options);
  }
);

ipcMain.handle('fs:delete-file', async (_event, filePath: string) => {
  return fileSystemService.deleteFile(filePath);
});

ipcMain.handle('fs:copy-file', async (_event, source: string, destination: string) => {
  return fileSystemService.copyFile(source, destination);
});

ipcMain.handle('fs:copy-file-to-directory', async (_event, sourcePath: string, destDir: string) => {
  return fileSystemService.copyFileToDirectory(sourcePath, destDir);
});

ipcMain.handle(
  'fs:write-binary-file-to-directory',
  async (_event, destDir: string, fileName: string, content: Uint8Array) => {
    return fileSystemService.writeBinaryFileToDirectory(destDir, fileName, content);
  }
);

ipcMain.handle('fs:copy-directory', async (_event, sourcePath: string, destDir: string) => {
  return fileSystemService.copyDirectoryToDirectory(sourcePath, destDir);
});

ipcMain.handle('fs:move-file', async (_event, source: string, destination: string) => {
  return fileSystemService.moveFile(source, destination);
});

ipcMain.handle('fs:file-exists', async (_event, filePath: string) => {
  return fileSystemService.fileExists(filePath);
});

ipcMain.handle('fs:get-file-info', async (_event, filePath: string) => {
  return fileSystemService.getFileInfo(filePath);
});

ipcMain.handle('fs:get-external-file-info', async (_event, filePath: string) => {
  return fileSystemService.getExternalFileInfo(filePath);
});

// Directory operations
ipcMain.handle('fs:read-directory', async (_event, dirPath: string) => {
  return fileSystemService.readDirectory(dirPath);
});

ipcMain.handle('fs:create-directory', async (_event, dirPath: string) => {
  return fileSystemService.createDirectory(dirPath);
});

ipcMain.handle('fs:delete-directory', async (_event, dirPath: string, recursive?: boolean) => {
  return fileSystemService.deleteDirectory(dirPath, recursive);
});

ipcMain.handle('fs:directory-exists', async (_event, dirPath: string) => {
  return fileSystemService.directoryExists(dirPath);
});

// Path utilities
ipcMain.handle('fs:join-path', (_event, ...paths: string[]) => {
  return fileSystemService.joinPath(...paths);
});

ipcMain.handle('fs:get-file-name', (_event, filePath: string) => {
  return fileSystemService.getFileName(filePath);
});

ipcMain.handle('fs:get-file-extension', (_event, filePath: string) => {
  return fileSystemService.getFileExtension(filePath);
});

ipcMain.handle('fs:get-directory-name', (_event, filePath: string) => {
  return fileSystemService.getDirectoryName(filePath);
});

// File listing
ipcMain.handle(
  'fs:list-markdown-files',
  async (_event, dirPath: string, patternString?: string) => {
    const pattern = patternString ? new RegExp(patternString) : undefined;
    return fileSystemService.listMarkdownFiles(dirPath, pattern);
  }
);

ipcMain.handle('fs:backup-file', async (_event, filePath: string) => {
  return fileSystemService.backupFile(filePath);
});

// File watching
ipcMain.handle('fs:watch-path', (_event, watchPath: string, options?: IWatcherOptions) => {
  return fileWatcherService.watch(watchPath, options);
});

ipcMain.handle('fs:unwatch-path', async (_event, watcherId: string) => {
  return fileWatcherService.unwatch(watcherId);
});

ipcMain.handle('fs:unwatch-all', async () => {
  return fileWatcherService.unwatchAll();
});

// Additional directory operations
ipcMain.handle('fs:rename-directory', async (_event, dirPath: string, newName: string) => {
  return fileSystemService.renameDirectory(dirPath, newName);
});

ipcMain.handle('fs:list-directory-tree', async (_event, dirPath: string) => {
  return fileSystemService.listDirectoryTree(dirPath);
});

ipcMain.handle('fs:get-directory-contents-count', async (_event, dirPath: string) => {
  return fileSystemService.getDirectoryContentsCount(dirPath);
});

ipcMain.handle('fs:is-directory-empty', async (_event, dirPath: string) => {
  return fileSystemService.isDirectoryEmpty(dirPath);
});

ipcMain.handle('fs:list-files-recursive', async (_event, dirPath: string) => {
  return fileSystemService.listFilesRecursive(dirPath);
});

// ================================
// Git IPC Handlers
// ================================

// Prerequisites
ipcMain.handle('git:is-installed', async () => {
  return gitService.isGitInstalled();
});

ipcMain.handle('git:is-repo', async (_event, repoPath: string) => {
  return gitService.isGitRepo(repoPath);
});

// Repository operations
ipcMain.handle('git:init', async (_event, repoPath: string) => {
  return gitService.init(repoPath);
});

ipcMain.handle('git:clone', async (_event, repoUrl: string, targetPath: string) => {
  return gitService.clone(repoUrl, targetPath);
});

ipcMain.handle('git:set-working-directory', (_event, repoPath: string) => {
  gitService.setWorkingDirectory(repoPath);
});

// Status and staging
ipcMain.handle('git:status', async (_event, repoPath?: string) => {
  return gitService.status(repoPath);
});

ipcMain.handle('git:add', async (_event, files: string[] | 'all', repoPath?: string) => {
  return gitService.add(files, repoPath);
});

ipcMain.handle('git:unstage', async (_event, files: string[], repoPath?: string) => {
  return gitService.unstage(files, repoPath);
});

// Commit operations
ipcMain.handle('git:commit', async (_event, message: string, repoPath?: string) => {
  return gitService.commit(message, repoPath);
});

ipcMain.handle('git:log', async (_event, options: IGitLogOptions, repoPath?: string) => {
  return gitService.log(options, repoPath);
});

ipcMain.handle(
  'git:diff',
  async (_event, filePath?: string, commitHash?: string, cached?: boolean, repoPath?: string) => {
    return gitService.diff(filePath, commitHash, cached, repoPath);
  }
);

ipcMain.handle('git:discard-changes', async (_event, filePath: string, repoPath?: string) => {
  return gitService.discardChanges(filePath, repoPath);
});

// Remote operations
ipcMain.handle('git:push', async (_event, remote?: string, branch?: string, repoPath?: string) => {
  return gitService.push(remote, branch, repoPath);
});

ipcMain.handle('git:pull', async (_event, remote?: string, branch?: string, repoPath?: string) => {
  return gitService.pull(remote, branch, repoPath);
});

ipcMain.handle('git:fetch', async (_event, remote?: string, repoPath?: string) => {
  return gitService.fetch(remote, repoPath);
});

ipcMain.handle('git:remotes', async (_event, repoPath?: string) => {
  return gitService.remotes(repoPath);
});

ipcMain.handle('git:add-remote', async (_event, name: string, url: string, repoPath?: string) => {
  return gitService.addRemote(name, url, repoPath);
});

ipcMain.handle('git:remove-remote', async (_event, name: string, repoPath?: string) => {
  return gitService.removeRemote(name, repoPath);
});

// Branch operations
ipcMain.handle('git:branches', async (_event, repoPath?: string) => {
  return gitService.branches(repoPath);
});

ipcMain.handle('git:create-branch', async (_event, name: string, repoPath?: string) => {
  return gitService.createBranch(name, repoPath);
});

ipcMain.handle('git:switch-branch', async (_event, name: string, repoPath?: string) => {
  return gitService.switchBranch(name, repoPath);
});

ipcMain.handle(
  'git:delete-branch',
  async (_event, name: string, force?: boolean, repoPath?: string) => {
    return gitService.deleteBranch(name, force, repoPath);
  }
);

// Stash operations
ipcMain.handle('git:stash', async (_event, message?: string, repoPath?: string) => {
  return gitService.stash(message, repoPath);
});

ipcMain.handle('git:stash-pop', async (_event, repoPath?: string) => {
  return gitService.stashPop(repoPath);
});

ipcMain.handle('git:stash-list', async (_event, repoPath?: string) => {
  return gitService.stashList(repoPath);
});

// Configuration
ipcMain.handle('git:get-config', async (_event, repoPath?: string) => {
  return gitService.getConfig(repoPath);
});

ipcMain.handle(
  'git:set-config',
  async (_event, name: string, email: string, global?: boolean, repoPath?: string) => {
    return gitService.setConfig(name, email, global, repoPath);
  }
);

// Tracked files (files that have been committed)
ipcMain.handle('git:tracked-files', async (_event, repoPath?: string) => {
  return gitService.getTrackedFiles(repoPath);
});

// Remove Git (delete .git folder)
ipcMain.handle('git:remove', async (_event, repoPath: string) => {
  return gitService.removeGit(repoPath);
});

// ================================
// File Indexing IPC Handlers (File Sync feature)
// ================================

ipcMain.handle('fs:start-indexing', async (event, folderPath: string, operationId: string) => {
  console.log(`[IPC] fs:start-indexing called for: ${folderPath} (operationId: ${operationId})`);

  const indexer = getFileIndexerService();
  const window = BrowserWindow.fromWebContents(event.sender);

  try {
    const files = await indexer.indexDirectory(folderPath, operationId, (progress) => {
      window?.webContents.send('fs:index-progress', { operationId, ...progress });
    });

    console.log(`[IPC] fs:start-indexing completed for: ${folderPath} (${files.length} files)`);
    return files;
  } catch (error) {
    console.error(`[IPC] fs:start-indexing error for: ${folderPath}`, error);
    throw error;
  }
});

ipcMain.handle('fs:cancel-indexing', (_event, operationId: string) => {
  const indexer = getFileIndexerService();
  return indexer.cancelIndexing(operationId);
});

// ================================
// External Apps IPC Handlers
// ================================

// Show file in folder (Finder on macOS, Explorer on Windows)
ipcMain.handle('external-apps:show-in-folder', (_event, filePath: string) => {
  shell.showItemInFolder(filePath);
});

// Open file with system default application
ipcMain.handle('external-apps:open-default', async (_event, filePath: string) => {
  try {
    const error = await shell.openPath(filePath);
    if (error) {
      return { success: false, error };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
});

// Open file in a specific application
ipcMain.handle('external-apps:open-in-app', async (_event, filePath: string, appName: string) => {
  try {
    const isMac = platform === 'darwin';
    const isWindows = platform === 'win32';

    if (isMac) {
      // On macOS, use 'open -a' command
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      try {
        await execAsync(`open -a "${appName}" "${filePath}"`);
        return { success: true };
      } catch (execErr) {
        return {
          success: false,
          error: execErr instanceof Error ? execErr.message : 'Failed to open application',
        };
      }
    } else if (isWindows) {
      // On Windows, use 'start' command with application
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      try {
        // Windows command to open file with specific app
        await execAsync(`start "" "${appName}" "${filePath}"`);
        return { success: true };
      } catch (execErr) {
        // Fallback to just opening with default app
        const error = await shell.openPath(filePath);
        if (error) {
          return { success: false, error };
        }
        return { success: true };
      }
    } else {
      // On Linux, try xdg-open as fallback
      const error = await shell.openPath(filePath);
      if (error) {
        return { success: false, error };
      }
      return { success: true };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
});

// ================================
// Update IPC Handlers
// ================================

ipcMain.handle('update:check', async () => {
  const updateService = getUpdateService();
  return updateService.checkForUpdates();
});

ipcMain.handle('update:check-force', async () => {
  const updateService = getUpdateService();
  return updateService.checkForUpdates(true);
});

ipcMain.handle('update:get-current-version', () => {
  return appVersion;
});

ipcMain.handle('update:open-download-page', async (_event, url: string) => {
  await shell.openExternal(url);
});

// ================================
// Export/Import IPC Handlers
// ================================

ipcMain.handle('fs:export-data', async (_event, destPath: string, options?: IExportOptions) => {
  const exportImportService = getExportImportService();
  return exportImportService.exportData(destPath, options);
});

ipcMain.handle('fs:import-data', async (_event, zipPath: string, options?: IImportOptions) => {
  const exportImportService = getExportImportService();
  return exportImportService.importData(zipPath, options);
});

ipcMain.handle('fs:validate-export', async (_event, zipPath: string) => {
  const exportImportService = getExportImportService();
  return exportImportService.validateExport(zipPath);
});

// ================================
// Storage Migration IPC Handlers
// ================================

ipcMain.handle('fs:select-migration-folder', async () => {
  if (!mainWindow) {
    return { cancelled: true, path: null };
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select New Storage Location',
    buttonLabel: 'Select Folder',
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { cancelled: true, path: null };
  }
  return { cancelled: false, path: result.filePaths[0] };
});

ipcMain.handle('fs:validate-migration-destination', async (_event, destPath: string) => {
  const migrationService = getStorageMigrationService(fileSystemService);
  return migrationService.validateDestination(destPath);
});

ipcMain.handle('fs:calculate-migration-plan', async () => {
  const migrationService = getStorageMigrationService(fileSystemService);
  const sourcePath = fileSystemService.getBasePath();
  return migrationService.calculateMigrationPlan(sourcePath);
});

ipcMain.handle('fs:start-migration', async (event, destPath: string) => {
  const migrationService = getStorageMigrationService(fileSystemService);
  const sourcePath = fileSystemService.getBasePath();

  return migrationService.startMigration(sourcePath, destPath, (progress) => {
    // Send progress to renderer
    event.sender.send('fs:migration-progress', progress);
  });
});

ipcMain.handle('fs:cancel-migration', () => {
  const migrationService = getStorageMigrationService(fileSystemService);
  migrationService.cancelMigration();
  return { cancelled: true };
});

ipcMain.handle('fs:verify-migration', async (_event, destPath: string) => {
  const migrationService = getStorageMigrationService(fileSystemService);
  const sourcePath = fileSystemService.getBasePath();
  return migrationService.verifyMigration(sourcePath, destPath);
});

ipcMain.handle('fs:cleanup-old-storage', async (_event, sourcePath: string) => {
  const migrationService = getStorageMigrationService(fileSystemService);
  await migrationService.cleanupSource(sourcePath);
  return { success: true };
});

ipcMain.handle('fs:rollback-migration', async () => {
  const migrationService = getStorageMigrationService(fileSystemService);
  return migrationService.rollbackMigration();
});

// ================================
// Secure Storage IPC Handlers (AI API Keys)
// ================================

ipcMain.handle('secure-storage:save-api-key', (_event, provider: string, key: string): void => {
  const secureStorage = getSecureStorageService();
  secureStorage.saveApiKey(provider, key);
});

ipcMain.handle('secure-storage:get-api-key', (_event, provider: string): string | null => {
  const secureStorage = getSecureStorageService();
  return secureStorage.getApiKey(provider);
});

ipcMain.handle('secure-storage:delete-api-key', (_event, provider: string): boolean => {
  const secureStorage = getSecureStorageService();
  return secureStorage.deleteApiKey(provider);
});

ipcMain.handle('secure-storage:has-api-key', (_event, provider: string): boolean => {
  const secureStorage = getSecureStorageService();
  return secureStorage.hasApiKey(provider);
});

// ================================
// AI Models IPC Handlers
// ================================

ipcMain.handle('ai-models:fetch', async (_event, provider: string, baseUrl?: string) => {
  const fetcher = getAIModelFetcherService();
  return fetcher.fetchModels(
    provider as import('../src/services/storage/entities').AIProviderType,
    baseUrl
  );
});
