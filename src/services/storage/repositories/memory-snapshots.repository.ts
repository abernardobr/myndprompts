import { v4 as uuidv4 } from 'uuid';
import Dexie from 'dexie';
import { getDB } from '../db';
import { BaseRepository } from './base.repository';
import type { IMemorySnapshot } from '../entities';
import type { MemoryStrategy } from '../../chat/types';

/**
 * Repository for managing serialized LangChain memory snapshots.
 *
 * Stores and retrieves memory state per session so that conversation
 * context can be restored when resuming a session.
 */
export class MemorySnapshotsRepository extends BaseRepository<IMemorySnapshot, string> {
  private static instance: MemorySnapshotsRepository | null = null;

  private constructor() {
    super(getDB().memorySnapshots);
  }

  static getInstance(): MemorySnapshotsRepository {
    if (!MemorySnapshotsRepository.instance) {
      MemorySnapshotsRepository.instance = new MemorySnapshotsRepository();
    }
    return MemorySnapshotsRepository.instance;
  }

  /**
   * Save a new memory snapshot for a session
   */
  async saveSnapshot(
    sessionId: string,
    strategy: MemoryStrategy,
    serializedState: string
  ): Promise<IMemorySnapshot> {
    const snapshot: IMemorySnapshot = {
      id: uuidv4(),
      sessionId,
      strategy,
      serializedState,
      createdAt: new Date(),
    };

    await this.create(snapshot);
    return snapshot;
  }

  /**
   * Get the most recent snapshot for a session
   */
  async getLatest(sessionId: string): Promise<IMemorySnapshot | undefined> {
    const snapshots = await this.table
      .where('[sessionId+createdAt]')
      .between([sessionId, Dexie.minKey], [sessionId, Dexie.maxKey])
      .reverse()
      .limit(1)
      .toArray();
    return snapshots[0];
  }

  /**
   * Get all snapshots for a session ordered by createdAt
   */
  async getBySession(sessionId: string): Promise<IMemorySnapshot[]> {
    return this.table
      .where('[sessionId+createdAt]')
      .between([sessionId, Dexie.minKey], [sessionId, Dexie.maxKey])
      .toArray();
  }

  /**
   * Delete all snapshots for a session
   */
  async deleteSessionSnapshots(sessionId: string): Promise<void> {
    const snapshots = await this.getBySession(sessionId);
    const ids = snapshots.map((s) => s.id);
    if (ids.length > 0) {
      await this.deleteMany(ids);
    }
  }

  /**
   * Keep only the N most recent snapshots for a session, deleting older ones
   */
  async pruneOldSnapshots(sessionId: string, keepCount = 5): Promise<void> {
    const snapshots = await this.table
      .where('[sessionId+createdAt]')
      .between([sessionId, Dexie.minKey], [sessionId, Dexie.maxKey])
      .reverse()
      .toArray();

    if (snapshots.length <= keepCount) return;

    const toDelete = snapshots.slice(keepCount).map((s) => s.id);
    await this.deleteMany(toDelete);
  }

  static resetInstance(): void {
    MemorySnapshotsRepository.instance = null;
  }
}

/**
 * Get the MemorySnapshotsRepository singleton
 */
export function getMemorySnapshotsRepository(): MemorySnapshotsRepository {
  return MemorySnapshotsRepository.getInstance();
}
