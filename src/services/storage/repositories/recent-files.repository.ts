import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db';
import { BaseRepository } from './base.repository';
import type { IRecentFile } from '../entities';

/**
 * Repository for managing recently opened files.
 */
export class RecentFilesRepository extends BaseRepository<IRecentFile, string> {
  private static instance: RecentFilesRepository | null = null;
  private static readonly MAX_RECENT_FILES = 20;

  private constructor() {
    super(getDB().recentFiles);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): RecentFilesRepository {
    if (!RecentFilesRepository.instance) {
      RecentFilesRepository.instance = new RecentFilesRepository();
    }
    return RecentFilesRepository.instance;
  }

  /**
   * Add or update a file in the recent files list
   */
  async addRecentFile(
    filePath: string,
    fileName: string,
    fileType: 'prompt' | 'snippet' | 'persona'
  ): Promise<void> {
    // Check if file already exists
    const existing = await this.findFirst((f) => f.filePath === filePath);

    if (existing) {
      // Update last opened time
      await this.update(existing.id, { lastOpenedAt: new Date() });
    } else {
      // Add new entry
      await this.create({
        id: uuidv4(),
        filePath,
        fileName,
        fileType,
        lastOpenedAt: new Date(),
        isPinned: false,
      });

      // Cleanup old entries if we exceed the limit
      await this.cleanupOldEntries();
    }
  }

  /**
   * Get recent files ordered by last opened date
   */
  async getRecentFiles(limit?: number): Promise<IRecentFile[]> {
    const files = await this.table
      .orderBy('lastOpenedAt')
      .reverse()
      .limit(limit ?? RecentFilesRepository.MAX_RECENT_FILES)
      .toArray();

    return files;
  }

  /**
   * Get pinned files
   */
  async getPinnedFiles(): Promise<IRecentFile[]> {
    return this.filter((f) => f.isPinned);
  }

  /**
   * Get recent files by type
   */
  async getRecentFilesByType(
    fileType: 'prompt' | 'snippet' | 'persona',
    limit?: number
  ): Promise<IRecentFile[]> {
    return this.table
      .where('fileType')
      .equals(fileType)
      .reverse()
      .limit(limit ?? 10)
      .toArray();
  }

  /**
   * Pin a file
   */
  async pinFile(filePath: string): Promise<void> {
    const file = await this.findFirst((f) => f.filePath === filePath);
    if (file) {
      await this.update(file.id, { isPinned: true });
    }
  }

  /**
   * Unpin a file
   */
  async unpinFile(filePath: string): Promise<void> {
    const file = await this.findFirst((f) => f.filePath === filePath);
    if (file) {
      await this.update(file.id, { isPinned: false });
    }
  }

  /**
   * Toggle pin state
   */
  async togglePin(filePath: string): Promise<boolean> {
    const file = await this.findFirst((f) => f.filePath === filePath);
    if (file) {
      const newPinState = !file.isPinned;
      await this.update(file.id, { isPinned: newPinState });
      return newPinState;
    }
    return false;
  }

  /**
   * Remove a file from recent files
   */
  async removeRecentFile(filePath: string): Promise<void> {
    const file = await this.findFirst((f) => f.filePath === filePath);
    if (file) {
      await this.delete(file.id);
    }
  }

  /**
   * Remove old entries to keep the list within limits
   */
  private async cleanupOldEntries(): Promise<void> {
    const count = await this.count();
    if (count > RecentFilesRepository.MAX_RECENT_FILES) {
      // Get all non-pinned files ordered by lastOpenedAt
      const nonPinned = await this.table.filter((f) => !f.isPinned).sortBy('lastOpenedAt');

      // Calculate how many to remove
      const toRemove = count - RecentFilesRepository.MAX_RECENT_FILES;
      const idsToRemove = nonPinned.slice(0, toRemove).map((f) => f.id);

      if (idsToRemove.length > 0) {
        await this.deleteMany(idsToRemove);
      }
    }
  }

  /**
   * Clear all recent files (except pinned)
   */
  async clearNonPinned(): Promise<void> {
    const nonPinned = await this.filter((f) => !f.isPinned);
    const ids = nonPinned.map((f) => f.id);
    await this.deleteMany(ids);
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    RecentFilesRepository.instance = null;
  }
}

// Export a convenience function to get the repository
export function getRecentFilesRepository(): RecentFilesRepository {
  return RecentFilesRepository.getInstance();
}
