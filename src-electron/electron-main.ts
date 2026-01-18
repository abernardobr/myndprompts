/**
 * Electron Main Process
 *
 * Main entry point for the Electron application.
 * Sets up the BrowserWindow and IPC handlers.
 */

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { getFileSystemService } from '../src/electron/main/services/file-system.service';
import { getFileWatcherService } from '../src/electron/main/services/file-watcher.service';
import type {
  IReadFileOptions,
  IWriteFileOptions,
  IWatcherOptions,
} from '../src/services/file-system/types';

// needed in case process is undefined under Linux
const platform = process.platform || os.platform();

const currentDir = fileURLToPath(new URL('.', import.meta.url));

let mainWindow: BrowserWindow | undefined;

// Initialize services
const fileSystemService = getFileSystemService();
const fileWatcherService = getFileWatcherService();

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

void app.whenReady().then(createWindow);

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
  return app.getVersion();
});

ipcMain.handle('app:get-platform', () => {
  return platform;
});

ipcMain.handle('app:get-user-data-path', () => {
  return app.getPath('userData');
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

// Basic file operations
ipcMain.handle('fs:read-file', async (_event, filePath: string, options?: IReadFileOptions) => {
  return fileSystemService.readFile(filePath, options);
});

ipcMain.handle(
  'fs:write-file',
  async (_event, filePath: string, content: string, options?: IWriteFileOptions) => {
    return fileSystemService.writeFile(filePath, content, options);
  }
);

ipcMain.handle('fs:delete-file', async (_event, filePath: string) => {
  return fileSystemService.deleteFile(filePath);
});

ipcMain.handle('fs:copy-file', async (_event, source: string, destination: string) => {
  return fileSystemService.copyFile(source, destination);
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
