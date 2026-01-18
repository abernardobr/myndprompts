import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db';
import { BaseRepository } from './base.repository';
import type { ISyncStatus, SyncStatusType } from '../entities';

/**
 * Repository for managing file synchronization status with Google Drive.
 */
export class SyncStatusRepository extends BaseRepository<ISyncStatus, string> {
  private static instance: SyncStatusRepository | null = null;

  private constructor() {
    super(getDB().syncStatus);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SyncStatusRepository {
    if (!SyncStatusRepository.instance) {
      SyncStatusRepository.instance = new SyncStatusRepository();
    }
    return SyncStatusRepository.instance;
  }

  /**
   * Get sync status for a specific file
   */
  async getByFilePath(filePath: string): Promise<ISyncStatus | undefined> {
    return this.findFirst((s) => s.filePath === filePath);
  }

  /**
   * Set or update sync status for a file
   */
  async setStatus(
    filePath: string,
    status: SyncStatusType,
    localHash: string,
    remoteHash?: string
  ): Promise<void> {
    const existing = await this.getByFilePath(filePath);

    if (existing) {
      await this.update(existing.id, {
        status,
        localHash,
        remoteHash,
        localModifiedAt: new Date(),
      });
    } else {
      await this.create({
        id: uuidv4(),
        filePath,
        status,
        localHash,
        remoteHash,
        localModifiedAt: new Date(),
      });
    }
  }

  /**
   * Mark a file as synced
   */
  async markSynced(filePath: string, hash: string): Promise<void> {
    const existing = await this.getByFilePath(filePath);

    if (existing) {
      await this.update(existing.id, {
        status: 'synced',
        localHash: hash,
        remoteHash: hash,
        lastSyncedHash: hash,
        lastSyncedAt: new Date(),
      });
    } else {
      await this.create({
        id: uuidv4(),
        filePath,
        status: 'synced',
        localHash: hash,
        remoteHash: hash,
        lastSyncedHash: hash,
        localModifiedAt: new Date(),
        lastSyncedAt: new Date(),
      });
    }
  }

  /**
   * Mark a file as having local changes
   */
  async markLocalChanges(filePath: string, newHash: string): Promise<void> {
    const existing = await this.getByFilePath(filePath);

    if (existing) {
      const newStatus: SyncStatusType =
        existing.remoteHash && existing.remoteHash !== existing.lastSyncedHash
          ? 'conflict'
          : 'pending';

      await this.update(existing.id, {
        status: newStatus,
        localHash: newHash,
        localModifiedAt: new Date(),
      });
    } else {
      await this.create({
        id: uuidv4(),
        filePath,
        status: 'local-only',
        localHash: newHash,
        localModifiedAt: new Date(),
      });
    }
  }

  /**
   * Mark a file as having remote changes
   */
  async markRemoteChanges(
    filePath: string,
    remoteHash: string,
    remoteModifiedAt: Date
  ): Promise<void> {
    const existing = await this.getByFilePath(filePath);

    if (existing) {
      const newStatus: SyncStatusType =
        existing.localHash !== existing.lastSyncedHash ? 'conflict' : 'pending';

      await this.update(existing.id, {
        status: newStatus,
        remoteHash,
        remoteModifiedAt,
      });
    } else {
      await this.create({
        id: uuidv4(),
        filePath,
        status: 'remote-only',
        localHash: '',
        remoteHash,
        localModifiedAt: new Date(),
        remoteModifiedAt,
      });
    }
  }

  /**
   * Get all files with a specific status
   */
  async getByStatus(status: SyncStatusType): Promise<ISyncStatus[]> {
    return this.table.where('status').equals(status).toArray();
  }

  /**
   * Get all files with pending changes
   */
  async getPendingFiles(): Promise<ISyncStatus[]> {
    return this.getByStatus('pending');
  }

  /**
   * Get all files with conflicts
   */
  async getConflicts(): Promise<ISyncStatus[]> {
    return this.getByStatus('conflict');
  }

  /**
   * Check if a file has unsync changes
   */
  async hasUnsyncedChanges(filePath: string): Promise<boolean> {
    const status = await this.getByFilePath(filePath);
    return status !== undefined && status.status !== 'synced';
  }

  /**
   * Remove sync status for a file
   */
  async removeByFilePath(filePath: string): Promise<void> {
    const existing = await this.getByFilePath(filePath);
    if (existing) {
      await this.delete(existing.id);
    }
  }

  /**
   * Get sync summary statistics
   */
  async getSyncSummary(): Promise<{
    synced: number;
    pending: number;
    conflicts: number;
    localOnly: number;
    remoteOnly: number;
  }> {
    const all = await this.getAll();

    return {
      synced: all.filter((s) => s.status === 'synced').length,
      pending: all.filter((s) => s.status === 'pending').length,
      conflicts: all.filter((s) => s.status === 'conflict').length,
      localOnly: all.filter((s) => s.status === 'local-only').length,
      remoteOnly: all.filter((s) => s.status === 'remote-only').length,
    };
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    SyncStatusRepository.instance = null;
  }
}

// Export a convenience function to get the repository
export function getSyncStatusRepository(): SyncStatusRepository {
  return SyncStatusRepository.getInstance();
}
