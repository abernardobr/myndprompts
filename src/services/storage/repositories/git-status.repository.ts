import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db';
import { BaseRepository } from './base.repository';
import type { IGitStatus, GitStatusType } from '../entities';

/**
 * Repository for managing Git status of files.
 */
export class GitStatusRepository extends BaseRepository<IGitStatus, string> {
  private static instance: GitStatusRepository | null = null;

  private constructor() {
    super(getDB().gitStatus);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): GitStatusRepository {
    if (!GitStatusRepository.instance) {
      GitStatusRepository.instance = new GitStatusRepository();
    }
    return GitStatusRepository.instance;
  }

  /**
   * Get git status for a specific file
   */
  async getByFilePath(filePath: string): Promise<IGitStatus | undefined> {
    return this.findFirst((s) => s.filePath === filePath);
  }

  /**
   * Set or update git status for a file
   */
  async setStatus(filePath: string, status: GitStatusType): Promise<void> {
    const existing = await this.getByFilePath(filePath);

    if (existing) {
      await this.update(existing.id, { status });
    } else {
      await this.create({
        id: uuidv4(),
        filePath,
        status,
      });
    }
  }

  /**
   * Mark a file as committed
   */
  async markCommitted(filePath: string, commitHash: string, commitMessage: string): Promise<void> {
    const existing = await this.getByFilePath(filePath);

    if (existing) {
      await this.update(existing.id, {
        status: 'clean',
        lastCommitHash: commitHash,
        lastCommitMessage: commitMessage,
      });
    } else {
      await this.create({
        id: uuidv4(),
        filePath,
        status: 'clean',
        lastCommitHash: commitHash,
        lastCommitMessage: commitMessage,
      });
    }
  }

  /**
   * Get all files with a specific status
   */
  async getByStatus(status: GitStatusType): Promise<IGitStatus[]> {
    return this.table.where('status').equals(status).toArray();
  }

  /**
   * Get all modified files
   */
  async getModifiedFiles(): Promise<IGitStatus[]> {
    return this.getByStatus('modified');
  }

  /**
   * Get all staged files
   */
  async getStagedFiles(): Promise<IGitStatus[]> {
    return this.getByStatus('staged');
  }

  /**
   * Get all untracked files
   */
  async getUntrackedFiles(): Promise<IGitStatus[]> {
    return this.getByStatus('untracked');
  }

  /**
   * Check if a file has uncommitted changes
   */
  async hasUncommittedChanges(filePath: string): Promise<boolean> {
    const status = await this.getByFilePath(filePath);
    return status !== undefined && status.status !== 'clean';
  }

  /**
   * Bulk update git statuses
   */
  async bulkUpdateStatus(
    updates: Array<{ filePath: string; status: GitStatusType }>
  ): Promise<void> {
    for (const update of updates) {
      await this.setStatus(update.filePath, update.status);
    }
  }

  /**
   * Remove git status for a file
   */
  async removeByFilePath(filePath: string): Promise<void> {
    const existing = await this.getByFilePath(filePath);
    if (existing) {
      await this.delete(existing.id);
    }
  }

  /**
   * Get git summary statistics
   */
  async getGitSummary(): Promise<{
    clean: number;
    modified: number;
    staged: number;
    untracked: number;
    deleted: number;
  }> {
    const all = await this.getAll();

    return {
      clean: all.filter((s) => s.status === 'clean').length,
      modified: all.filter((s) => s.status === 'modified').length,
      staged: all.filter((s) => s.status === 'staged').length,
      untracked: all.filter((s) => s.status === 'untracked').length,
      deleted: all.filter((s) => s.status === 'deleted').length,
    };
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    GitStatusRepository.instance = null;
  }
}

// Export a convenience function to get the repository
export function getGitStatusRepository(): GitStatusRepository {
  return GitStatusRepository.getInstance();
}
