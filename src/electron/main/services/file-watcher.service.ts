/**
 * File Watcher Service (Main Process)
 *
 * Watches file system changes using chokidar and emits events to the renderer.
 */

import chokidar, { type FSWatcher, type WatchOptions } from 'chokidar';
import { v4 as uuidv4 } from 'uuid';
import type { BrowserWindow } from 'electron';
import type { IFileWatcherEvent, IWatcherOptions } from '../../../services/file-system/types';

/**
 * Watcher instance with metadata
 */
interface WatcherInstance {
  id: string;
  watcher: FSWatcher;
  path: string;
  createdAt: Date;
}

/**
 * Service for watching file system changes
 */
export class FileWatcherService {
  private watchers: Map<string, WatcherInstance> = new Map();
  private mainWindow: BrowserWindow | null = null;

  /**
   * Set the main window reference for sending events
   */
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  /**
   * Convert our watcher options to chokidar options
   */
  private toChokidarOptions(options?: IWatcherOptions): WatchOptions {
    const chokidarOptions: WatchOptions = {
      persistent: options?.persistent ?? true,
      ignoreInitial: options?.ignoreInitial ?? true,
      ignored: options?.ignored,
      depth: options?.depth,
    };

    if (options?.awaitWriteFinish) {
      if (typeof options.awaitWriteFinish === 'boolean') {
        chokidarOptions.awaitWriteFinish = options.awaitWriteFinish;
      } else {
        chokidarOptions.awaitWriteFinish = {
          stabilityThreshold: options.awaitWriteFinish.stabilityThreshold ?? 2000,
          pollInterval: options.awaitWriteFinish.pollInterval ?? 100,
        };
      }
    }

    return chokidarOptions;
  }

  /**
   * Send event to renderer process
   */
  private sendEvent(event: IFileWatcherEvent): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('fs:file-change', event);
    }
  }

  /**
   * Start watching a path
   */
  watch(watchPath: string, options?: IWatcherOptions): string {
    const id = uuidv4();
    const chokidarOptions = this.toChokidarOptions(options);

    const watcher = chokidar.watch(watchPath, chokidarOptions);

    // Set up event handlers
    watcher.on('add', (path, stats) => {
      this.sendEvent({
        type: 'add',
        path,
        stats: stats ? { size: stats.size, mtime: stats.mtime } : undefined,
      });
    });

    watcher.on('change', (path, stats) => {
      this.sendEvent({
        type: 'change',
        path,
        stats: stats ? { size: stats.size, mtime: stats.mtime } : undefined,
      });
    });

    watcher.on('unlink', (path) => {
      this.sendEvent({
        type: 'unlink',
        path,
      });
    });

    watcher.on('addDir', (path, stats) => {
      this.sendEvent({
        type: 'addDir',
        path,
        stats: stats ? { size: stats.size, mtime: stats.mtime } : undefined,
      });
    });

    watcher.on('unlinkDir', (path) => {
      this.sendEvent({
        type: 'unlinkDir',
        path,
      });
    });

    watcher.on('error', (error) => {
      console.error(`File watcher error for ${watchPath}:`, error);
    });

    this.watchers.set(id, {
      id,
      watcher,
      path: watchPath,
      createdAt: new Date(),
    });

    return id;
  }

  /**
   * Stop watching by watcher ID
   */
  async unwatch(watcherId: string): Promise<boolean> {
    const instance = this.watchers.get(watcherId);
    if (!instance) {
      return false;
    }

    await instance.watcher.close();
    this.watchers.delete(watcherId);
    return true;
  }

  /**
   * Stop all watchers
   */
  async unwatchAll(): Promise<void> {
    const closePromises = Array.from(this.watchers.values()).map((instance) =>
      instance.watcher.close()
    );
    await Promise.all(closePromises);
    this.watchers.clear();
  }

  /**
   * Get all active watcher IDs
   */
  getActiveWatchers(): string[] {
    return Array.from(this.watchers.keys());
  }

  /**
   * Get watcher info
   */
  getWatcherInfo(watcherId: string): { id: string; path: string; createdAt: Date } | null {
    const instance = this.watchers.get(watcherId);
    if (!instance) {
      return null;
    }
    return {
      id: instance.id,
      path: instance.path,
      createdAt: instance.createdAt,
    };
  }

  /**
   * Add a path to an existing watcher
   */
  addPath(watcherId: string, path: string): boolean {
    const instance = this.watchers.get(watcherId);
    if (!instance) {
      return false;
    }
    instance.watcher.add(path);
    return true;
  }

  /**
   * Remove a path from an existing watcher
   */
  removePath(watcherId: string, pathToRemove: string): boolean {
    const instance = this.watchers.get(watcherId);
    if (!instance) {
      return false;
    }
    instance.watcher.unwatch(pathToRemove);
    return true;
  }
}

// Singleton instance
let fileWatcherServiceInstance: FileWatcherService | null = null;

/**
 * Get the file watcher service instance
 */
export function getFileWatcherService(): FileWatcherService {
  if (!fileWatcherServiceInstance) {
    fileWatcherServiceInstance = new FileWatcherService();
  }
  return fileWatcherServiceInstance;
}

/**
 * Reset the service instance (for testing)
 */
export async function resetFileWatcherService(): Promise<void> {
  if (fileWatcherServiceInstance) {
    await fileWatcherServiceInstance.unwatchAll();
  }
  fileWatcherServiceInstance = null;
}
