import Dexie, { type Table } from 'dexie';
import type {
  IUserAuth,
  IAppConfig,
  IUIState,
  IRecentFile,
  IProjectIndexCache,
  ISyncStatus,
  IGitStatus,
  IAIProviderConfig,
  IProject,
  IProjectFolder,
  IFileIndexEntry,
  IPlugin,
} from './entities';

/**
 * MyndPrompt IndexedDB Database
 *
 * This database stores application state and configuration.
 * File content (prompts, snippets) is stored on the file system.
 */
export class MyndPromptDB extends Dexie {
  userAuth!: Table<IUserAuth, string>;
  appConfig!: Table<IAppConfig, string>;
  uiState!: Table<IUIState, string>;
  recentFiles!: Table<IRecentFile, string>;
  projectIndexCache!: Table<IProjectIndexCache, string>;
  syncStatus!: Table<ISyncStatus, string>;
  gitStatus!: Table<IGitStatus, string>;
  aiProviders!: Table<IAIProviderConfig, string>;
  projects!: Table<IProject, string>;
  projectFolders!: Table<IProjectFolder, string>;
  fileIndex!: Table<IFileIndexEntry, string>;
  plugins!: Table<IPlugin, string>;

  constructor() {
    super('MyndPromptDB');

    // Version 1: Initial schema
    this.version(1).stores({
      userAuth: 'id, email',
      appConfig: 'key',
      uiState: 'id',
      recentFiles: 'id, filePath, fileType, lastOpenedAt, isPinned',
      projectIndexCache: 'id, projectPath, lastIndexed',
      syncStatus: 'id, filePath, status',
      gitStatus: 'id, filePath, status',
      aiProviders: 'id, provider, isEnabled',
    });

    // Version 2: Add projects table for project metadata
    this.version(2).stores({
      userAuth: 'id, email',
      appConfig: 'key',
      uiState: 'id',
      recentFiles: 'id, filePath, fileType, lastOpenedAt, isPinned',
      projectIndexCache: 'id, projectPath, lastIndexed',
      syncStatus: 'id, filePath, status',
      gitStatus: 'id, filePath, status',
      aiProviders: 'id, provider, isEnabled',
      projects: '&folderPath, id, name, createdAt',
    });

    // Version 3: Add File Sync tables (projectFolders and fileIndex)
    this.version(3).stores({
      userAuth: 'id, email',
      appConfig: 'key',
      uiState: 'id',
      recentFiles: 'id, filePath, fileType, lastOpenedAt, isPinned',
      projectIndexCache: 'id, projectPath, lastIndexed',
      syncStatus: 'id, filePath, status',
      gitStatus: 'id, filePath, status',
      aiProviders: 'id, provider, isEnabled',
      projects: '&folderPath, id, name, createdAt',
      projectFolders: '&id, projectPath, folderPath, [projectPath+folderPath], status',
      fileIndex:
        '&id, projectFolderId, normalizedName, fullPath, [projectFolderId+fullPath], extension',
    });

    // Version 4: Add plugins table for marketplace plugin management
    this.version(4).stores({
      userAuth: 'id, email',
      appConfig: 'key',
      uiState: 'id',
      recentFiles: 'id, filePath, fileType, lastOpenedAt, isPinned',
      projectIndexCache: 'id, projectPath, lastIndexed',
      syncStatus: 'id, filePath, status',
      gitStatus: 'id, filePath, status',
      aiProviders: 'id, provider, isEnabled',
      projects: '&folderPath, id, name, createdAt',
      projectFolders: '&id, projectPath, folderPath, [projectPath+folderPath], status',
      fileIndex:
        '&id, projectFolderId, normalizedName, fullPath, [projectFolderId+fullPath], extension',
      plugins: '&id, version, type, *tags, installedAt, updatedAt',
    });

    // Add hooks for automatic date handling
    this.userAuth.hook('creating', (_primKey, obj) => {
      if (!obj.lastLoginAt) {
        obj.lastLoginAt = new Date();
      }
    });

    this.appConfig.hook('creating', (_primKey, obj) => {
      if (!obj.updatedAt) {
        obj.updatedAt = new Date();
      }
    });

    this.appConfig.hook('updating', (modifications) => {
      return { ...modifications, updatedAt: new Date() };
    });

    this.recentFiles.hook('creating', (_primKey, obj) => {
      if (!obj.lastOpenedAt) {
        obj.lastOpenedAt = new Date();
      }
    });

    this.projects.hook('creating', (_primKey, obj) => {
      const now = new Date();
      if (!obj.createdAt) {
        obj.createdAt = now;
      }
      if (!obj.updatedAt) {
        obj.updatedAt = now;
      }
    });

    this.projects.hook('updating', (modifications) => {
      return { ...modifications, updatedAt: new Date() };
    });

    // File Sync: projectFolders hooks
    this.projectFolders.hook('creating', (_primKey, obj) => {
      if (!obj.addedAt) {
        obj.addedAt = new Date();
      }
    });

    // File Sync: fileIndex hooks
    this.fileIndex.hook('creating', (_primKey, obj) => {
      if (!obj.indexedAt) {
        obj.indexedAt = new Date();
      }
    });

    // Plugins hooks
    this.plugins.hook('creating', (_primKey, obj) => {
      const now = new Date();
      if (!obj.installedAt) {
        obj.installedAt = now;
      }
      if (!obj.updatedAt) {
        obj.updatedAt = now;
      }
    });

    this.plugins.hook('updating', (modifications) => {
      return { ...modifications, updatedAt: new Date() };
    });
  }
}

// Singleton database instance
let dbInstance: MyndPromptDB | null = null;

/**
 * Get the database instance (singleton)
 */
export function getDB(): MyndPromptDB {
  if (!dbInstance) {
    dbInstance = new MyndPromptDB();
  }
  return dbInstance;
}

/**
 * Reset the database instance (useful for testing)
 */
export async function resetDB(): Promise<void> {
  if (dbInstance) {
    await dbInstance.delete();
    dbInstance = null;
  }
}

/**
 * Close the database connection
 */
export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
