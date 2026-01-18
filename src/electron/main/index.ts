import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import os from 'os';
import { getFileSystemService } from './services/file-system.service';
import { getFileWatcherService } from './services/file-watcher.service';
import type {
  IReadFileOptions,
  IWriteFileOptions,
  IWatcherOptions,
} from '../../services/file-system/types';

// Environment detection
const platform = process.platform || os.platform();
const _isDev = process.env.NODE_ENV !== 'production';

let mainWindow: BrowserWindow | null = null;

// Initialize services
const fileSystemService = getFileSystemService();
const fileWatcherService = getFileWatcherService();

function createWindow(): void {
  // Resolve icon path - works for both dev and production
  const iconPath = path.resolve(
    __dirname,
    process.env.DEV === 'true' || process.env.DEV === '1'
      ? '../../src-electron/icons/icon.png'
      : '../icons/icon.png'
  );

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    useContentSize: true,
    frame: platform !== 'darwin',
    titleBarStyle: platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#1e1e1e',
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.resolve(__dirname, process.env.QUASAR_ELECTRON_PRELOAD ?? ''),
    },
  });

  // Set the main window for file watcher events
  fileWatcherService.setMainWindow(mainWindow);

  // Set app user model ID for Windows notifications
  if (platform === 'win32') {
    app.setAppUserModelId('com.myndprompt.app');
  }

  // Load the app
  if (process.env.DEV === 'true' || process.env.DEV === '1') {
    void mainWindow.loadURL(process.env.APP_URL ?? 'http://localhost:9000');
    mainWindow.webContents.openDevTools();
  } else {
    void mainWindow.loadFile('index.html');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    fileWatcherService.setMainWindow(null);
  });
}

// App lifecycle events
void app.whenReady().then(async () => {
  // Initialize storage directories
  await fileSystemService.initializeDirectories();

  // Set dock icon on macOS
  if (platform === 'darwin' && app.dock) {
    const dockIconPath = path.resolve(
      __dirname,
      process.env.DEV === 'true' || process.env.DEV === '1'
        ? '../../src-electron/icons/icon.png'
        : '../icons/icon.png'
    );
    app.dock.setIcon(dockIconPath);
  }

  createWindow();

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (platform !== 'darwin') {
    app.quit();
  }
});

// Clean up watchers on quit
app.on('before-quit', () => {
  void fileWatcherService.unwatchAll();
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

// Security: Prevent new window creation
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});
