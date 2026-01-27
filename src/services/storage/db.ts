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
  IConfiguredModel,
  IChatSession,
  IChatMessage,
  IMemorySnapshot,
  IPDFDocument,
  IPDFAnnotation,
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
  configuredModels!: Table<IConfiguredModel, string>;
  chatSessions!: Table<IChatSession, string>;
  chatMessages!: Table<IChatMessage, string>;
  memorySnapshots!: Table<IMemorySnapshot, string>;
  pdfDocuments!: Table<IPDFDocument, string>;
  pdfAnnotations!: Table<IPDFAnnotation, string>;
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

    // Version 5: Migrate xai provider to groq
    this.version(5)
      .stores({
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
      })
      .upgrade(async (tx) => {
        const aiProviders = tx.table<IAIProviderConfig, string>('aiProviders');
        const xaiProvider = await aiProviders.where('provider').equals('xai').first();
        if (xaiProvider !== undefined) {
          await aiProviders.update(xaiProvider.id, {
            provider: 'groq' as const,
            defaultModel: 'llama-3.3-70b-versatile',
          });
        }
      });

    // Version 6: Add configuredModels table, simplify aiProviders
    this.version(6)
      .stores({
        userAuth: 'id, email',
        appConfig: 'key',
        uiState: 'id',
        recentFiles: 'id, filePath, fileType, lastOpenedAt, isPinned',
        projectIndexCache: 'id, projectPath, lastIndexed',
        syncStatus: 'id, filePath, status',
        gitStatus: 'id, filePath, status',
        aiProviders: 'id, provider',
        configuredModels: '&id, provider, modelId, isDefault, addedAt',
        projects: '&folderPath, id, name, createdAt',
        projectFolders: '&id, projectPath, folderPath, [projectPath+folderPath], status',
        fileIndex:
          '&id, projectFolderId, normalizedName, fullPath, [projectFolderId+fullPath], extension',
        plugins: '&id, version, type, *tags, installedAt, updatedAt',
      })
      .upgrade(async (tx) => {
        // Migrate enabled providers with default models into configuredModels
        const aiProviders = tx.table<IAIProviderConfig, string>('aiProviders');
        const configuredModelsTable = tx.table<IConfiguredModel, string>('configuredModels');
        const allProviders: IAIProviderConfig[] = await aiProviders.toArray();

        let isFirstDefault = true;
        for (const provider of allProviders) {
          if (
            provider.isEnabled === true &&
            provider.defaultModel !== undefined &&
            provider.defaultModel !== ''
          ) {
            const { v4 } = await import('uuid');
            await configuredModelsTable.add({
              id: v4(),
              provider: provider.provider,
              modelId: provider.defaultModel,
              modelName: provider.defaultModel,
              isDefault: isFirstDefault,
              addedAt: new Date(),
            });
            isFirstDefault = false;
          }
        }
      });

    // Version 7: Add chat tables
    this.version(7).stores({
      userAuth: 'id, email',
      appConfig: 'key',
      uiState: 'id',
      recentFiles: 'id, filePath, fileType, lastOpenedAt, isPinned',
      projectIndexCache: 'id, projectPath, lastIndexed',
      syncStatus: 'id, filePath, status',
      gitStatus: 'id, filePath, status',
      aiProviders: 'id, provider',
      configuredModels: '&id, provider, modelId, isDefault, addedAt',
      chatSessions: '&id, updatedAt, isArchived',
      chatMessages: '&id, sessionId, [sessionId+createdAt], parentMessageId',
      memorySnapshots: '&id, sessionId, [sessionId+createdAt]',
      pdfDocuments: '&id, sessionId',
      pdfAnnotations: '&id, documentId, sessionId',
      projects: '&folderPath, id, name, createdAt',
      projectFolders: '&id, projectPath, folderPath, [projectPath+folderPath], status',
      fileIndex:
        '&id, projectFolderId, normalizedName, fullPath, [projectFolderId+fullPath], extension',
      plugins: '&id, version, type, *tags, installedAt, updatedAt',
    });

    // Add hooks for automatic date handling
    this.userAuth.hook('creating', (_primKey, obj) => {
      if (obj.lastLoginAt === undefined || obj.lastLoginAt === null) {
        obj.lastLoginAt = new Date();
      }
    });

    this.appConfig.hook('creating', (_primKey, obj) => {
      if (obj.updatedAt === undefined || obj.updatedAt === null) {
        obj.updatedAt = new Date();
      }
    });

    this.appConfig.hook('updating', (modifications) => {
      return { ...modifications, updatedAt: new Date() };
    });

    this.recentFiles.hook('creating', (_primKey, obj) => {
      if (obj.lastOpenedAt === undefined || obj.lastOpenedAt === null) {
        obj.lastOpenedAt = new Date();
      }
    });

    this.projects.hook('creating', (_primKey, obj) => {
      const now = new Date();
      if (obj.createdAt === undefined || obj.createdAt === null) {
        obj.createdAt = now;
      }
      if (obj.updatedAt === undefined || obj.updatedAt === null) {
        obj.updatedAt = now;
      }
    });

    this.projects.hook('updating', (modifications) => {
      return { ...modifications, updatedAt: new Date() };
    });

    // File Sync: projectFolders hooks
    this.projectFolders.hook('creating', (_primKey, obj) => {
      if (obj.addedAt === undefined || obj.addedAt === null) {
        obj.addedAt = new Date();
      }
    });

    // File Sync: fileIndex hooks
    this.fileIndex.hook('creating', (_primKey, obj) => {
      if (obj.indexedAt === undefined || obj.indexedAt === null) {
        obj.indexedAt = new Date();
      }
    });

    // Plugins hooks
    // ConfiguredModels hooks
    this.configuredModels.hook('creating', (_primKey, obj) => {
      if (obj.addedAt === undefined || obj.addedAt === null) {
        obj.addedAt = new Date();
      }
    });

    this.plugins.hook('creating', (_primKey, obj) => {
      const now = new Date();
      if (obj.installedAt === undefined || obj.installedAt === null) {
        obj.installedAt = now;
      }
      if (obj.updatedAt === undefined || obj.updatedAt === null) {
        obj.updatedAt = now;
      }
    });

    this.plugins.hook('updating', (modifications) => {
      return { ...modifications, updatedAt: new Date() };
    });

    // Chat: chatSessions hooks
    this.chatSessions.hook('creating', (_primKey, obj: IChatSession) => {
      const now = new Date();
      if (obj.createdAt === undefined || obj.createdAt === null) {
        obj.createdAt = now;
      }
      if (obj.updatedAt === undefined || obj.updatedAt === null) {
        obj.updatedAt = now;
      }
    });

    this.chatSessions.hook('updating', (modifications) => {
      return { ...modifications, updatedAt: new Date() };
    });

    // Chat: chatMessages hooks
    this.chatMessages.hook('creating', (_primKey, obj: IChatMessage) => {
      if (obj.createdAt === undefined || obj.createdAt === null) {
        obj.createdAt = new Date();
      }
    });

    // Chat: memorySnapshots hooks
    this.memorySnapshots.hook('creating', (_primKey, obj: IMemorySnapshot) => {
      if (obj.createdAt === undefined || obj.createdAt === null) {
        obj.createdAt = new Date();
      }
    });

    // Chat: pdfDocuments hooks
    this.pdfDocuments.hook('creating', (_primKey, obj: IPDFDocument) => {
      if (obj.addedAt === undefined || obj.addedAt === null) {
        obj.addedAt = new Date();
      }
    });

    // Chat: pdfAnnotations hooks
    this.pdfAnnotations.hook('creating', (_primKey, obj: IPDFAnnotation) => {
      if (obj.createdAt === undefined || obj.createdAt === null) {
        obj.createdAt = new Date();
      }
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
