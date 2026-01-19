import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db';
import { BaseRepository } from './base.repository';
import type { IProjectFolder, ProjectFolderStatus } from '../entities';

/**
 * Repository for managing project folder configurations in IndexedDB.
 * Stores the relationship between MyndPrompts projects and external folders
 * for the File Sync feature.
 */
export class ProjectFolderRepository extends BaseRepository<IProjectFolder, string> {
  private static instance: ProjectFolderRepository | null = null;

  private constructor() {
    super(getDB().projectFolders);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ProjectFolderRepository {
    if (!ProjectFolderRepository.instance) {
      ProjectFolderRepository.instance = new ProjectFolderRepository();
    }
    return ProjectFolderRepository.instance;
  }

  /**
   * Get all folders associated with a MyndPrompts project
   */
  async getByProjectPath(projectPath: string): Promise<IProjectFolder[]> {
    return this.table.where('projectPath').equals(projectPath).toArray();
  }

  /**
   * Add a new folder to a project
   */
  async addFolder(projectPath: string, folderPath: string): Promise<IProjectFolder> {
    // Check if folder already exists for this project
    const existing = await this.table
      .where('[projectPath+folderPath]')
      .equals([projectPath, folderPath])
      .first();

    if (existing) {
      throw new Error(`Folder "${folderPath}" is already added to this project`);
    }

    const folder: IProjectFolder = {
      id: uuidv4(),
      projectPath,
      folderPath,
      addedAt: new Date(),
      lastIndexedAt: null,
      fileCount: 0,
      status: 'pending',
    };

    await this.create(folder);
    return folder;
  }

  /**
   * Remove a folder from a project
   */
  async removeFolder(id: string): Promise<void> {
    await this.delete(id);
  }

  /**
   * Update the status of a project folder
   */
  async updateStatus(
    id: string,
    status: ProjectFolderStatus,
    errorMessage?: string
  ): Promise<void> {
    const updates: Partial<IProjectFolder> = { status };

    if (status === 'indexed') {
      updates.lastIndexedAt = new Date();
      updates.errorMessage = undefined;
    } else if (status === 'error' && errorMessage !== undefined && errorMessage !== '') {
      updates.errorMessage = errorMessage;
    } else if (status === 'pending' || status === 'indexing') {
      updates.errorMessage = undefined;
    }

    await this.update(id, updates);
  }

  /**
   * Update indexing statistics for a folder
   */
  async updateIndexStats(id: string, fileCount: number): Promise<void> {
    await this.update(id, {
      fileCount,
      lastIndexedAt: new Date(),
    });
  }

  /**
   * Get all project folders
   */
  async getAllFolders(): Promise<IProjectFolder[]> {
    const folders = await this.table.toArray();
    // Sort by addedAt descending (newest first) in JavaScript since addedAt is not indexed
    return folders.sort((a, b) => {
      const aTime = a.addedAt instanceof Date ? a.addedAt.getTime() : 0;
      const bTime = b.addedAt instanceof Date ? b.addedAt.getTime() : 0;
      return bTime - aTime;
    });
  }

  /**
   * Get folders by status
   */
  async getByStatus(status: ProjectFolderStatus): Promise<IProjectFolder[]> {
    return this.table.where('status').equals(status).toArray();
  }

  /**
   * Check if a folder path is already added to any project
   */
  async isFolderAdded(folderPath: string): Promise<boolean> {
    const existing = await this.table.where('folderPath').equals(folderPath).first();
    return existing !== undefined;
  }

  /**
   * Get a folder by its folder path
   */
  async getByFolderPath(folderPath: string): Promise<IProjectFolder | undefined> {
    return this.table.where('folderPath').equals(folderPath).first();
  }

  /**
   * Remove all folders for a project
   */
  async removeAllForProject(projectPath: string): Promise<void> {
    const folders = await this.getByProjectPath(projectPath);
    const ids = folders.map((f) => f.id);
    await this.deleteMany(ids);
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    ProjectFolderRepository.instance = null;
  }
}

// Export a convenience function to get the repository
export function getProjectFolderRepository(): ProjectFolderRepository {
  return ProjectFolderRepository.getInstance();
}
