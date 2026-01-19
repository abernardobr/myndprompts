import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db';
import { BaseRepository } from './base.repository';
import type { IFileIndexEntry } from '../entities';

/**
 * Repository for managing file index entries in IndexedDB.
 * Stores indexed file metadata for fast autocomplete search in the File Sync feature.
 */
export class FileIndexRepository extends BaseRepository<IFileIndexEntry, string> {
  private static instance: FileIndexRepository | null = null;

  private constructor() {
    super(getDB().fileIndex);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): FileIndexRepository {
    if (!FileIndexRepository.instance) {
      FileIndexRepository.instance = new FileIndexRepository();
    }
    return FileIndexRepository.instance;
  }

  /**
   * Get all files indexed for a specific project folder
   */
  async getByProjectFolder(projectFolderId: string): Promise<IFileIndexEntry[]> {
    return this.table.where('projectFolderId').equals(projectFolderId).toArray();
  }

  /**
   * Search files by name within a specific project folder
   * Uses normalizedName for diacritics-insensitive search
   */
  async searchByName(projectFolderId: string, query: string): Promise<IFileIndexEntry[]> {
    const normalizedQuery = this.normalizeString(query);

    return this.table
      .where('projectFolderId')
      .equals(projectFolderId)
      .filter((entry) => entry.normalizedName.includes(normalizedQuery))
      .toArray();
  }

  /**
   * Search files by name across all indexed folders
   * Uses normalizedName for diacritics-insensitive search
   */
  async searchByNameGlobal(query: string): Promise<IFileIndexEntry[]> {
    const normalizedQuery = this.normalizeString(query);

    return this.table.filter((entry) => entry.normalizedName.includes(normalizedQuery)).toArray();
  }

  /**
   * Add multiple file index entries in bulk
   */
  async addEntries(entries: IFileIndexEntry[]): Promise<void> {
    await this.table.bulkAdd(entries);
  }

  /**
   * Remove all file entries for a specific project folder
   */
  async removeByProjectFolder(projectFolderId: string): Promise<void> {
    await this.table.where('projectFolderId').equals(projectFolderId).delete();
  }

  /**
   * Remove a file entry by its full path
   */
  async removeByPath(fullPath: string): Promise<void> {
    await this.table.where('fullPath').equals(fullPath).delete();
  }

  /**
   * Upsert a single file entry
   */
  async upsertEntry(entry: IFileIndexEntry): Promise<void> {
    await this.table.put(entry);
  }

  /**
   * Get a file entry by its full path within a project folder
   */
  async getByPath(projectFolderId: string, fullPath: string): Promise<IFileIndexEntry | undefined> {
    return this.table
      .where('[projectFolderId+fullPath]')
      .equals([projectFolderId, fullPath])
      .first();
  }

  /**
   * Get files by extension
   */
  async getByExtension(extension: string): Promise<IFileIndexEntry[]> {
    return this.table.where('extension').equals(extension).toArray();
  }

  /**
   * Get file count for a project folder
   */
  async getCountByProjectFolder(projectFolderId: string): Promise<number> {
    return this.table.where('projectFolderId').equals(projectFolderId).count();
  }

  /**
   * Create a new file index entry with generated ID
   */
  createEntry(
    projectFolderId: string,
    fileName: string,
    fullPath: string,
    relativePath: string,
    extension: string,
    size: number,
    modifiedAt: Date
  ): IFileIndexEntry {
    return {
      id: uuidv4(),
      projectFolderId,
      fileName,
      normalizedName: this.normalizeString(fileName),
      fullPath,
      relativePath,
      extension,
      size,
      modifiedAt,
      indexedAt: new Date(),
    };
  }

  /**
   * Normalize a string for diacritics-insensitive search
   * Converts to lowercase, removes diacritics using NFD normalization
   */
  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    FileIndexRepository.instance = null;
  }
}

// Export a convenience function to get the repository
export function getFileIndexRepository(): FileIndexRepository {
  return FileIndexRepository.getInstance();
}
