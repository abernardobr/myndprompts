/**
 * Migration Repository
 *
 * Handles database path updates during storage migration.
 * Updates all records containing file paths from old base path to new base path.
 */

import { getDB } from '../db';
import type {
  IProject,
  IProjectFolder,
  IFileIndexEntry,
  IRecentFile,
  IProjectIndexCache,
  ISyncStatus,
  IGitStatus,
  IUIState,
  IAppConfig,
  ICachedFileInfo,
} from '../entities';

/**
 * Result of path update operation for a single table
 */
export interface ITableUpdateResult {
  tableName: string;
  recordsUpdated: number;
  errors: string[];
}

/**
 * Result of full migration path update
 */
export interface IMigrationPathUpdateResult {
  success: boolean;
  totalRecordsUpdated: number;
  tableResults: ITableUpdateResult[];
  errors: string[];
}

/**
 * Result of path verification
 */
export interface IPathVerificationResult {
  valid: boolean;
  invalidPaths: Array<{
    table: string;
    id: string;
    path: string;
  }>;
}

/**
 * Repository for handling database path updates during storage migration.
 * All operations use transactions to ensure atomicity.
 */
export class MigrationRepository {
  /**
   * Update all paths in the database from old base path to new base path.
   * Uses a transaction to ensure atomicity - all updates succeed or none do.
   *
   * @param oldBasePath - The old storage base path
   * @param newBasePath - The new storage base path
   * @returns Result with counts of updated records per table
   */
  async updateAllPaths(
    oldBasePath: string,
    newBasePath: string
  ): Promise<IMigrationPathUpdateResult> {
    const db = getDB();
    const tableResults: ITableUpdateResult[] = [];
    const errors: string[] = [];
    let totalRecordsUpdated = 0;

    try {
      // Use a transaction to ensure atomicity across all tables
      await db.transaction(
        'rw',
        [
          db.projects,
          db.projectFolders,
          db.fileIndex,
          db.recentFiles,
          db.projectIndexCache,
          db.syncStatus,
          db.gitStatus,
          db.uiState,
          db.appConfig,
        ],
        async () => {
          // 1. Update projects table (special handling - folderPath is primary key)
          const projectsResult = await this.updateProjectsPaths(oldBasePath, newBasePath);
          tableResults.push(projectsResult);
          totalRecordsUpdated += projectsResult.recordsUpdated;
          errors.push(...projectsResult.errors);

          // 2. Update projectFolders table
          const projectFoldersResult = await this.updateProjectFoldersPaths(
            oldBasePath,
            newBasePath
          );
          tableResults.push(projectFoldersResult);
          totalRecordsUpdated += projectFoldersResult.recordsUpdated;
          errors.push(...projectFoldersResult.errors);

          // 3. Update fileIndex table
          const fileIndexResult = await this.updateFileIndexPaths(oldBasePath, newBasePath);
          tableResults.push(fileIndexResult);
          totalRecordsUpdated += fileIndexResult.recordsUpdated;
          errors.push(...fileIndexResult.errors);

          // 4. Update recentFiles table
          const recentFilesResult = await this.updateRecentFilesPaths(oldBasePath, newBasePath);
          tableResults.push(recentFilesResult);
          totalRecordsUpdated += recentFilesResult.recordsUpdated;
          errors.push(...recentFilesResult.errors);

          // 5. Update projectIndexCache table
          const projectIndexResult = await this.updateProjectIndexCachePaths(
            oldBasePath,
            newBasePath
          );
          tableResults.push(projectIndexResult);
          totalRecordsUpdated += projectIndexResult.recordsUpdated;
          errors.push(...projectIndexResult.errors);

          // 6. Update syncStatus table
          const syncStatusResult = await this.updateSyncStatusPaths(oldBasePath, newBasePath);
          tableResults.push(syncStatusResult);
          totalRecordsUpdated += syncStatusResult.recordsUpdated;
          errors.push(...syncStatusResult.errors);

          // 7. Update gitStatus table
          const gitStatusResult = await this.updateGitStatusPaths(oldBasePath, newBasePath);
          tableResults.push(gitStatusResult);
          totalRecordsUpdated += gitStatusResult.recordsUpdated;
          errors.push(...gitStatusResult.errors);

          // 8. Update uiState table (open tabs, active tab)
          const uiStateResult = await this.updateUIStatePaths(oldBasePath, newBasePath);
          tableResults.push(uiStateResult);
          totalRecordsUpdated += uiStateResult.recordsUpdated;
          errors.push(...uiStateResult.errors);

          // 9. Update appConfig table (storage path config)
          const appConfigResult = await this.updateAppConfigPaths(oldBasePath, newBasePath);
          tableResults.push(appConfigResult);
          totalRecordsUpdated += appConfigResult.recordsUpdated;
          errors.push(...appConfigResult.errors);
        }
      );

      return {
        success: errors.length === 0,
        totalRecordsUpdated,
        tableResults,
        errors,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error during path update';
      return {
        success: false,
        totalRecordsUpdated: 0,
        tableResults,
        errors: [errorMsg],
      };
    }
  }

  /**
   * Verify all paths in the database point to the new location
   *
   * @param newBasePath - The expected new base path
   * @returns Verification result with any invalid paths found
   */
  async verifyPaths(newBasePath: string): Promise<IPathVerificationResult> {
    const db = getDB();
    const invalidPaths: IPathVerificationResult['invalidPaths'] = [];

    // Check projects
    const projects = await db.projects.toArray();
    for (const project of projects) {
      if (!project.folderPath.startsWith(newBasePath)) {
        invalidPaths.push({
          table: 'projects',
          id: project.id,
          path: project.folderPath,
        });
      }
    }

    // Check projectFolders - only check projectPath (folderPath can be external)
    const projectFolders = await db.projectFolders.toArray();
    for (const folder of projectFolders) {
      if (!folder.projectPath.startsWith(newBasePath)) {
        invalidPaths.push({
          table: 'projectFolders',
          id: folder.id,
          path: folder.projectPath,
        });
      }
    }

    // Check recentFiles
    const recentFiles = await db.recentFiles.toArray();
    for (const file of recentFiles) {
      if (!file.filePath.startsWith(newBasePath)) {
        invalidPaths.push({
          table: 'recentFiles',
          id: file.id,
          path: file.filePath,
        });
      }
    }

    return {
      valid: invalidPaths.length === 0,
      invalidPaths,
    };
  }

  // ============================================================================
  // Private Helper Methods for Each Table
  // ============================================================================

  /**
   * Update paths in projects table
   * Note: folderPath is the primary key, so we need to delete and re-insert
   */
  private async updateProjectsPaths(
    oldBasePath: string,
    newBasePath: string
  ): Promise<ITableUpdateResult> {
    const db = getDB();
    const result: ITableUpdateResult = {
      tableName: 'projects',
      recordsUpdated: 0,
      errors: [],
    };

    try {
      const projects = await db.projects.toArray();

      for (const project of projects) {
        if (project.folderPath.startsWith(oldBasePath)) {
          // Update folderPath (primary key)
          const newFolderPath = this.replacePath(project.folderPath, oldBasePath, newBasePath);

          // Update associatedFolders array
          const newAssociatedFolders = project.associatedFolders.map((folder) =>
            folder.startsWith(oldBasePath)
              ? this.replacePath(folder, oldBasePath, newBasePath)
              : folder
          );

          // Create updated project
          const updatedProject: IProject = {
            ...project,
            folderPath: newFolderPath,
            associatedFolders: newAssociatedFolders,
          };

          // Delete old record and insert new one (primary key changed)
          await db.projects.delete(project.folderPath);
          await db.projects.add(updatedProject);

          result.recordsUpdated++;
        }
      }
    } catch (error) {
      result.errors.push(`projects: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Update paths in projectFolders table
   */
  private async updateProjectFoldersPaths(
    oldBasePath: string,
    newBasePath: string
  ): Promise<ITableUpdateResult> {
    const db = getDB();
    const result: ITableUpdateResult = {
      tableName: 'projectFolders',
      recordsUpdated: 0,
      errors: [],
    };

    try {
      const projectFolders = await db.projectFolders.toArray();

      for (const folder of projectFolders) {
        let needsUpdate = false;
        const updates: Partial<IProjectFolder> = {};

        // Update projectPath (always points to MyndPrompts storage)
        if (folder.projectPath.startsWith(oldBasePath)) {
          updates.projectPath = this.replacePath(folder.projectPath, oldBasePath, newBasePath);
          needsUpdate = true;
        }

        // folderPath is external folder - only update if it's within our storage
        // (typically it's external, but handle edge case)
        if (folder.folderPath.startsWith(oldBasePath)) {
          updates.folderPath = this.replacePath(folder.folderPath, oldBasePath, newBasePath);
          needsUpdate = true;
        }

        if (needsUpdate) {
          await db.projectFolders.update(folder.id, updates);
          result.recordsUpdated++;
        }
      }
    } catch (error) {
      result.errors.push(
        `projectFolders: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return result;
  }

  /**
   * Update paths in fileIndex table
   */
  private async updateFileIndexPaths(
    oldBasePath: string,
    newBasePath: string
  ): Promise<ITableUpdateResult> {
    const db = getDB();
    const result: ITableUpdateResult = {
      tableName: 'fileIndex',
      recordsUpdated: 0,
      errors: [],
    };

    try {
      const fileIndexes = await db.fileIndex.toArray();

      for (const entry of fileIndexes) {
        // fullPath might be within our storage (if indexing internal files)
        if (entry.fullPath.startsWith(oldBasePath)) {
          const updates: Partial<IFileIndexEntry> = {
            fullPath: this.replacePath(entry.fullPath, oldBasePath, newBasePath),
          };
          await db.fileIndex.update(entry.id, updates);
          result.recordsUpdated++;
        }
      }
    } catch (error) {
      result.errors.push(`fileIndex: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Update paths in recentFiles table
   */
  private async updateRecentFilesPaths(
    oldBasePath: string,
    newBasePath: string
  ): Promise<ITableUpdateResult> {
    const db = getDB();
    const result: ITableUpdateResult = {
      tableName: 'recentFiles',
      recordsUpdated: 0,
      errors: [],
    };

    try {
      const recentFiles = await db.recentFiles.toArray();

      for (const file of recentFiles) {
        if (file.filePath.startsWith(oldBasePath)) {
          const updates: Partial<IRecentFile> = {
            filePath: this.replacePath(file.filePath, oldBasePath, newBasePath),
          };
          await db.recentFiles.update(file.id, updates);
          result.recordsUpdated++;
        }
      }
    } catch (error) {
      result.errors.push(
        `recentFiles: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return result;
  }

  /**
   * Update paths in projectIndexCache table
   */
  private async updateProjectIndexCachePaths(
    oldBasePath: string,
    newBasePath: string
  ): Promise<ITableUpdateResult> {
    const db = getDB();
    const result: ITableUpdateResult = {
      tableName: 'projectIndexCache',
      recordsUpdated: 0,
      errors: [],
    };

    try {
      const caches = await db.projectIndexCache.toArray();

      for (const cache of caches) {
        let needsUpdate = false;
        const updates: Partial<IProjectIndexCache> = {};

        // Update projectPath
        if (cache.projectPath.startsWith(oldBasePath)) {
          updates.projectPath = this.replacePath(cache.projectPath, oldBasePath, newBasePath);
          needsUpdate = true;
        }

        // Update paths in cached files array
        const updatedFiles = cache.files.map((file: ICachedFileInfo) => {
          if (file.path.startsWith(oldBasePath)) {
            needsUpdate = true;
            return {
              ...file,
              path: this.replacePath(file.path, oldBasePath, newBasePath),
            };
          }
          return file;
        });

        if (needsUpdate) {
          updates.files = updatedFiles;
          await db.projectIndexCache.update(cache.id, updates);
          result.recordsUpdated++;
        }
      }
    } catch (error) {
      result.errors.push(
        `projectIndexCache: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return result;
  }

  /**
   * Update paths in syncStatus table
   */
  private async updateSyncStatusPaths(
    oldBasePath: string,
    newBasePath: string
  ): Promise<ITableUpdateResult> {
    const db = getDB();
    const result: ITableUpdateResult = {
      tableName: 'syncStatus',
      recordsUpdated: 0,
      errors: [],
    };

    try {
      const syncStatuses = await db.syncStatus.toArray();

      for (const status of syncStatuses) {
        if (status.filePath.startsWith(oldBasePath)) {
          const updates: Partial<ISyncStatus> = {
            filePath: this.replacePath(status.filePath, oldBasePath, newBasePath),
          };
          await db.syncStatus.update(status.id, updates);
          result.recordsUpdated++;
        }
      }
    } catch (error) {
      result.errors.push(`syncStatus: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Update paths in gitStatus table
   */
  private async updateGitStatusPaths(
    oldBasePath: string,
    newBasePath: string
  ): Promise<ITableUpdateResult> {
    const db = getDB();
    const result: ITableUpdateResult = {
      tableName: 'gitStatus',
      recordsUpdated: 0,
      errors: [],
    };

    try {
      const gitStatuses = await db.gitStatus.toArray();

      for (const status of gitStatuses) {
        if (status.filePath.startsWith(oldBasePath)) {
          const updates: Partial<IGitStatus> = {
            filePath: this.replacePath(status.filePath, oldBasePath, newBasePath),
          };
          await db.gitStatus.update(status.id, updates);
          result.recordsUpdated++;
        }
      }
    } catch (error) {
      result.errors.push(`gitStatus: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Update paths in uiState table (open tabs, active tab, editor panes)
   */
  private async updateUIStatePaths(
    oldBasePath: string,
    newBasePath: string
  ): Promise<ITableUpdateResult> {
    const db = getDB();
    const result: ITableUpdateResult = {
      tableName: 'uiState',
      recordsUpdated: 0,
      errors: [],
    };

    try {
      const uiStates = await db.uiState.toArray();

      for (const state of uiStates) {
        let needsUpdate = false;
        const updates: Partial<IUIState> = {};

        // Update openTabs array
        const updatedOpenTabs = state.openTabs.map((tab) => {
          if (tab.startsWith(oldBasePath)) {
            needsUpdate = true;
            return this.replacePath(tab, oldBasePath, newBasePath);
          }
          return tab;
        });
        if (needsUpdate) {
          updates.openTabs = updatedOpenTabs;
        }

        // Update activeTab
        if (state.activeTab?.startsWith(oldBasePath)) {
          updates.activeTab = this.replacePath(state.activeTab, oldBasePath, newBasePath);
          needsUpdate = true;
        }

        // Update editor split panes
        if (state.editorSplit) {
          let splitUpdated = false;
          const updatedPanes = state.editorSplit.panes.map((pane) => {
            const updatedTabs = pane.tabs.map((tab) => {
              if (tab.startsWith(oldBasePath)) {
                splitUpdated = true;
                return this.replacePath(tab, oldBasePath, newBasePath);
              }
              return tab;
            });

            let updatedActiveTab = pane.activeTab;
            if (pane.activeTab?.startsWith(oldBasePath)) {
              updatedActiveTab = this.replacePath(pane.activeTab, oldBasePath, newBasePath);
              splitUpdated = true;
            }

            return {
              ...pane,
              tabs: updatedTabs,
              activeTab: updatedActiveTab,
            };
          });

          if (splitUpdated) {
            updates.editorSplit = {
              ...state.editorSplit,
              panes: updatedPanes,
            };
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          await db.uiState.update(state.id, updates);
          result.recordsUpdated++;
        }
      }
    } catch (error) {
      result.errors.push(`uiState: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Update paths in appConfig table
   */
  private async updateAppConfigPaths(
    oldBasePath: string,
    newBasePath: string
  ): Promise<ITableUpdateResult> {
    const db = getDB();
    const result: ITableUpdateResult = {
      tableName: 'appConfig',
      recordsUpdated: 0,
      errors: [],
    };

    // Config keys that may contain paths
    const pathConfigKeys = [
      'storage.basePath',
      'prompts.directory',
      'snippets.directory',
      'personas.directory',
      'templates.directory',
      'backup.directory',
      'projects.directory',
    ];

    try {
      for (const key of pathConfigKeys) {
        const config = await db.appConfig.get(key);

        if (config && typeof config.value === 'string' && config.value.startsWith(oldBasePath)) {
          const updates: Partial<IAppConfig> = {
            value: this.replacePath(config.value, oldBasePath, newBasePath),
          };
          await db.appConfig.update(key, updates);
          result.recordsUpdated++;
        }
      }
    } catch (error) {
      result.errors.push(`appConfig: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Replace old base path with new base path in a path string
   */
  private replacePath(path: string, oldBasePath: string, newBasePath: string): string {
    // Ensure we only replace the base path prefix, not occurrences within the path
    if (path.startsWith(oldBasePath)) {
      return newBasePath + path.slice(oldBasePath.length);
    }
    return path;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let instance: MigrationRepository | null = null;

/**
 * Get the singleton instance of MigrationRepository
 */
export function getMigrationRepository(): MigrationRepository {
  if (!instance) {
    instance = new MigrationRepository();
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetMigrationRepository(): void {
  instance = null;
}
