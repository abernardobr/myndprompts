import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db';
import { BaseRepository } from './base.repository';
import type { IProjectIndexCache, ICachedFileInfo } from '../entities';

/**
 * Repository for managing project index cache.
 *
 * Caches file metadata for fast search without rescanning the filesystem.
 */
export class ProjectIndexRepository extends BaseRepository<IProjectIndexCache, string> {
  private static instance: ProjectIndexRepository | null = null;

  private constructor() {
    super(getDB().projectIndexCache);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ProjectIndexRepository {
    if (!ProjectIndexRepository.instance) {
      ProjectIndexRepository.instance = new ProjectIndexRepository();
    }
    return ProjectIndexRepository.instance;
  }

  /**
   * Get cached index for a project path
   */
  async getByProjectPath(projectPath: string): Promise<IProjectIndexCache | undefined> {
    return this.findFirst((p) => p.projectPath === projectPath);
  }

  /**
   * Update or create project index cache
   */
  async updateIndex(projectPath: string, files: ICachedFileInfo[]): Promise<void> {
    const existing = await this.getByProjectPath(projectPath);

    if (existing) {
      await this.update(existing.id, {
        files,
        lastIndexed: new Date(),
      });
    } else {
      await this.create({
        id: uuidv4(),
        projectPath,
        files,
        lastIndexed: new Date(),
      });
    }
  }

  /**
   * Add or update a single file in the index
   */
  async updateFile(projectPath: string, fileInfo: ICachedFileInfo): Promise<void> {
    const index = await this.getByProjectPath(projectPath);

    if (index) {
      const files = index.files.filter((f) => f.path !== fileInfo.path);
      files.push(fileInfo);
      await this.update(index.id, { files, lastIndexed: new Date() });
    } else {
      await this.create({
        id: uuidv4(),
        projectPath,
        files: [fileInfo],
        lastIndexed: new Date(),
      });
    }
  }

  /**
   * Remove a file from the index
   */
  async removeFile(projectPath: string, filePath: string): Promise<void> {
    const index = await this.getByProjectPath(projectPath);

    if (index) {
      const files = index.files.filter((f) => f.path !== filePath);
      await this.update(index.id, { files });
    }
  }

  /**
   * Search files by name pattern
   */
  async searchByName(projectPath: string, pattern: string): Promise<ICachedFileInfo[]> {
    const index = await this.getByProjectPath(projectPath);
    if (!index) return [];

    const lowerPattern = pattern.toLowerCase();
    return index.files.filter((f) => f.name.toLowerCase().includes(lowerPattern));
  }

  /**
   * Search files by tag
   */
  async searchByTag(projectPath: string, tag: string): Promise<ICachedFileInfo[]> {
    const index = await this.getByProjectPath(projectPath);
    if (!index) return [];

    const lowerTag = tag.toLowerCase();
    return index.files.filter((f) => f.tags.some((t) => t.toLowerCase() === lowerTag));
  }

  /**
   * Search files by extension
   */
  async searchByExtension(projectPath: string, extension: string): Promise<ICachedFileInfo[]> {
    const index = await this.getByProjectPath(projectPath);
    if (!index) return [];

    return index.files.filter((f) => f.extension === extension);
  }

  /**
   * Get file info by path
   */
  async getFileInfo(projectPath: string, filePath: string): Promise<ICachedFileInfo | undefined> {
    const index = await this.getByProjectPath(projectPath);
    if (!index) return undefined;

    return index.files.find((f) => f.path === filePath);
  }

  /**
   * Check if index is stale (older than specified hours)
   */
  async isIndexStale(projectPath: string, maxAgeHours = 24): Promise<boolean> {
    const index = await this.getByProjectPath(projectPath);
    if (!index) return true;

    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    const age = Date.now() - index.lastIndexed.getTime();
    return age > maxAgeMs;
  }

  /**
   * Get index statistics
   */
  async getIndexStats(
    projectPath: string
  ): Promise<{ fileCount: number; lastIndexed: Date | null } | null> {
    const index = await this.getByProjectPath(projectPath);
    if (!index) return null;

    return {
      fileCount: index.files.length,
      lastIndexed: index.lastIndexed,
    };
  }

  /**
   * Remove project index
   */
  async removeProjectIndex(projectPath: string): Promise<void> {
    const index = await this.getByProjectPath(projectPath);
    if (index) {
      await this.delete(index.id);
    }
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    ProjectIndexRepository.instance = null;
  }
}

// Export a convenience function to get the repository
export function getProjectIndexRepository(): ProjectIndexRepository {
  return ProjectIndexRepository.getInstance();
}
