/**
 * Test setup for IndexedDB tests
 *
 * This file sets up fake-indexeddb for testing Dexie in Node.js
 */
import 'fake-indexeddb/auto';

import { beforeEach, afterEach } from 'vitest';
import { resetDB } from '../db';
import { AuthRepository } from '../repositories/auth.repository';
import { ConfigRepository } from '../repositories/config.repository';
import { UIStateRepository } from '../repositories/ui-state.repository';
import { RecentFilesRepository } from '../repositories/recent-files.repository';
import { SyncStatusRepository } from '../repositories/sync-status.repository';
import { GitStatusRepository } from '../repositories/git-status.repository';
import { AIProvidersRepository } from '../repositories/ai-providers.repository';
import { ProjectIndexRepository } from '../repositories/project-index.repository';

/**
 * Reset database and repository instances before each test
 */
export function setupStorageTests(): void {
  beforeEach(async () => {
    // Reset all singleton instances
    AuthRepository.resetInstance();
    ConfigRepository.resetInstance();
    UIStateRepository.resetInstance();
    RecentFilesRepository.resetInstance();
    SyncStatusRepository.resetInstance();
    GitStatusRepository.resetInstance();
    AIProvidersRepository.resetInstance();
    ProjectIndexRepository.resetInstance();

    // Reset database
    await resetDB();
  });

  afterEach(async () => {
    // Cleanup after tests
    await resetDB();
  });
}
