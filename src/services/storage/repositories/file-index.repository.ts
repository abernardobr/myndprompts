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
   * Add entries in batches to prevent IndexedDB from timing out on large datasets.
   * Processes entries in chunks and yields to the event loop between batches.
   *
   * @param entries - Array of file index entries to add
   * @param batchSize - Number of entries per batch (default: 1000)
   * @param onProgress - Optional callback for progress updates
   */
  async addEntriesBatched(
    entries: IFileIndexEntry[],
    batchSize: number = 1000,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    const total = entries.length;
    console.log(
      `[FileIndexRepository] addEntriesBatched starting: ${total} entries, batchSize: ${batchSize}`
    );

    for (let i = 0; i < total; i += batchSize) {
      const batch = entries.slice(i, Math.min(i + batchSize, total));
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(total / batchSize);

      try {
        await this.table.bulkAdd(batch);
      } catch (error) {
        // Log error but continue with next batch
        console.error(
          `[FileIndexRepository] Error adding batch ${batchNum}/${totalBatches} (${i}-${i + batch.length}):`,
          error
        );
        // Try adding one by one for this batch to salvage what we can
        let recovered = 0;
        for (const entry of batch) {
          try {
            await this.table.add(entry);
            recovered++;
          } catch {
            // Skip individual entry that fails
          }
        }
        console.log(
          `[FileIndexRepository] Recovered ${recovered}/${batch.length} entries from failed batch`
        );
      }

      // Report progress
      const processed = Math.min(i + batchSize, total);
      onProgress?.(processed, total);

      // Log progress every 5 batches or on last batch
      if (batchNum % 5 === 0 || batchNum === totalBatches) {
        console.log(
          `[FileIndexRepository] Batch ${batchNum}/${totalBatches} complete (${processed}/${total} entries)`
        );
      }

      // Yield to event loop between batches to prevent UI freezing
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    console.log(`[FileIndexRepository] addEntriesBatched complete: ${total} entries saved`);
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
