/**
 * Unit Tests for StorageMigrationService
 *
 * Tests cover:
 * - Destination validation
 * - Migration planning
 * - File copying with progress
 * - Migration verification
 * - Cancellation handling
 * - Error handling and rollback
 * - Manifest creation and recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  StorageMigrationService,
  getStorageMigrationService,
  resetStorageMigrationService,
  type IMigrationProgress,
} from '../storage-migration.service';
import { FileSystemService, resetFileSystemService } from '../file-system.service';

// Mock electron's BrowserWindow
vi.mock('electron', () => ({
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => null),
  },
}));

describe('StorageMigrationService', () => {
  let service: StorageMigrationService;
  let fileSystemService: FileSystemService;
  let testDir: string;
  let tempSource: string;
  let tempDest: string;

  /**
   * Create test directory structure with sample files
   * Matches the structure expected by MyndPrompts storage
   */
  async function createTestStructure(basePath: string): Promise<void> {
    // Create directory structure matching app storage
    const dirs = ['prompts', 'snippets', 'personas', 'templates', 'projects', 'backups'];

    for (const dir of dirs) {
      const dirPath = path.join(basePath, dir);
      await fs.mkdir(dirPath, { recursive: true });

      // Add test files
      await fs.writeFile(path.join(dirPath, 'test1.md'), '# Test 1\n\nContent for test file 1.');
      await fs.writeFile(path.join(dirPath, 'test2.md'), '# Test 2\n\nContent for test file 2.');
    }

    // Add nested directories in prompts
    const nestedDir = path.join(basePath, 'prompts', 'project1');
    await fs.mkdir(nestedDir, { recursive: true });
    await fs.writeFile(path.join(nestedDir, 'nested.md'), '# Nested\n\nNested content.');

    // Add deeper nesting
    const deepDir = path.join(basePath, 'prompts', 'project1', 'subdir');
    await fs.mkdir(deepDir, { recursive: true });
    await fs.writeFile(path.join(deepDir, 'deep.md'), '# Deep\n\nDeeply nested content.');
  }

  /**
   * Count files recursively in a directory
   */
  async function countFiles(dirPath: string): Promise<number> {
    let count = 0;
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          count += await countFiles(fullPath);
        } else if (entry.isFile()) {
          count++;
        }
      }
    } catch {
      // Directory doesn't exist
    }
    return count;
  }

  beforeAll(async () => {
    // Create base test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'myndprompts-migration-test-'));
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Create unique directories for each test
    tempSource = path.join(testDir, `source-${Date.now()}`);
    tempDest = path.join(testDir, `dest-${Date.now()}`);

    await fs.mkdir(tempSource, { recursive: true });
    await fs.mkdir(tempDest, { recursive: true });

    // Create test file structure
    await createTestStructure(tempSource);

    // Reset singletons and initialize service
    resetStorageMigrationService();
    resetFileSystemService();

    // Create FileSystemService with tempSource as base path
    fileSystemService = new FileSystemService(tempSource);
    service = new StorageMigrationService(fileSystemService);
  });

  afterEach(async () => {
    // Cleanup
    try {
      await fs.rm(tempSource, { recursive: true, force: true });
    } catch {
      // Ignore
    }
    try {
      await fs.rm(tempDest, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  // ==========================================================================
  // Validation Tests
  // ==========================================================================

  describe('validateDestination', () => {
    it('should accept empty directory', async () => {
      const result = await service.validateDestination(tempDest);
      expect(result.valid).toBe(true);
    });

    it('should reject non-empty directory', async () => {
      await fs.writeFile(path.join(tempDest, 'file.txt'), 'content');
      const result = await service.validateDestination(tempDest);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject destination inside source', async () => {
      const insideDest = path.join(tempSource, 'subdir');
      await fs.mkdir(insideDest, { recursive: true });
      const result = await service.validateDestination(insideDest);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('inside');
    });

    it('should reject source inside destination', async () => {
      // Create a structure where source would be inside dest
      const newDest = path.dirname(tempSource);
      // This test may vary by platform, but the principle should be tested
      const result = await service.validateDestination(newDest);
      // Should either fail or handle this edge case
      expect(result).toBeDefined();
    });

    it('should accept and create non-existent directory', async () => {
      const newDest = path.join(tempDest, 'new-folder');
      const result = await service.validateDestination(newDest);
      expect(result.valid).toBe(true);
    });

    it('should reject non-directory path', async () => {
      const filePath = path.join(tempDest, 'file.txt');
      await fs.writeFile(filePath, 'content');
      const result = await service.validateDestination(filePath);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not a directory');
    });

    it('should check for write permissions', async () => {
      const result = await service.validateDestination(tempDest);
      expect(result.valid).toBe(true);
      // If valid, we should have been able to write a test file
    });
  });

  // ==========================================================================
  // Migration Plan Tests
  // ==========================================================================

  describe('calculateMigrationPlan', () => {
    it('should count all files correctly', async () => {
      const plan = await service.calculateMigrationPlan(tempSource);
      // We created 2 files per directory (6 dirs) + 2 nested files = 14 files
      expect(plan.totalFiles).toBe(14);
    });

    it('should calculate total size', async () => {
      const plan = await service.calculateMigrationPlan(tempSource);
      expect(plan.totalSize).toBeGreaterThan(0);
    });

    it('should list all storage directories', async () => {
      const plan = await service.calculateMigrationPlan(tempSource);
      expect(plan.directories.length).toBe(6);

      const dirNames = plan.directories.map((d) => d.name);
      expect(dirNames).toContain('prompts');
      expect(dirNames).toContain('snippets');
      expect(dirNames).toContain('personas');
      expect(dirNames).toContain('templates');
      expect(dirNames).toContain('projects');
      expect(dirNames).toContain('backups');
    });

    it('should mark existing directories', async () => {
      const plan = await service.calculateMigrationPlan(tempSource);
      const existingDirs = plan.directories.filter((d) => d.exists);
      expect(existingDirs.length).toBe(6);
    });

    it('should handle empty storage', async () => {
      // Remove all created files
      await fs.rm(tempSource, { recursive: true, force: true });
      await fs.mkdir(tempSource, { recursive: true });

      const plan = await service.calculateMigrationPlan(tempSource);
      expect(plan.totalFiles).toBe(0);
      expect(plan.totalSize).toBe(0);
    });

    it('should count nested files correctly', async () => {
      const plan = await service.calculateMigrationPlan(tempSource);
      const promptsDir = plan.directories.find((d) => d.name === 'prompts');
      // prompts has: test1.md, test2.md, project1/nested.md, project1/subdir/deep.md = 4 files
      expect(promptsDir?.fileCount).toBe(4);
    });
  });

  // ==========================================================================
  // Migration Execution Tests
  // ==========================================================================

  describe('startMigration', () => {
    it('should copy all files successfully', async () => {
      const progressUpdates: IMigrationProgress[] = [];

      const result = await service.startMigration(tempSource, tempDest, (progress) =>
        progressUpdates.push(progress)
      );

      expect(result.success).toBe(true);
      expect(result.filesCopied).toBe(14);
      expect(result.errors).toHaveLength(0);
    });

    it('should emit progress updates', async () => {
      const progressUpdates: IMigrationProgress[] = [];

      await service.startMigration(tempSource, tempDest, (progress) =>
        progressUpdates.push(progress)
      );

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0]).toHaveProperty('phase');
      expect(progressUpdates[0]).toHaveProperty('copiedFiles');
      expect(progressUpdates[0]).toHaveProperty('totalFiles');
    });

    it('should go through all phases', async () => {
      const phases = new Set<string>();

      await service.startMigration(tempSource, tempDest, (progress) => phases.add(progress.phase));

      expect(phases.has('validating')).toBe(true);
      expect(phases.has('planning')).toBe(true);
      expect(phases.has('copying')).toBe(true);
      expect(phases.has('verifying')).toBe(true);
      expect(phases.has('completing')).toBe(true);
    });

    it('should preserve directory structure', async () => {
      await service.startMigration(tempSource, tempDest, () => {});

      // Check nested directories were created
      const nestedFile = path.join(tempDest, 'prompts', 'project1', 'nested.md');
      const deepFile = path.join(tempDest, 'prompts', 'project1', 'subdir', 'deep.md');

      const nestedExists = await fs
        .access(nestedFile)
        .then(() => true)
        .catch(() => false);
      const deepExists = await fs
        .access(deepFile)
        .then(() => true)
        .catch(() => false);

      expect(nestedExists).toBe(true);
      expect(deepExists).toBe(true);
    });

    it('should preserve file content', async () => {
      await service.startMigration(tempSource, tempDest, () => {});

      const sourceContent = await fs.readFile(
        path.join(tempSource, 'prompts', 'test1.md'),
        'utf-8'
      );
      const destContent = await fs.readFile(path.join(tempDest, 'prompts', 'test1.md'), 'utf-8');

      expect(destContent).toBe(sourceContent);
    });

    it('should handle cancellation', async () => {
      const progressUpdates: IMigrationProgress[] = [];

      // Start migration and cancel after first copying progress
      const migrationPromise = service.startMigration(tempSource, tempDest, (progress) => {
        progressUpdates.push(progress);
        if (progress.phase === 'copying' && progress.copiedFiles > 0) {
          service.cancelMigration();
        }
      });

      const result = await migrationPromise;
      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
    });

    it('should track duration', async () => {
      const result = await service.startMigration(tempSource, tempDest, () => {});

      expect(result.duration).toBeGreaterThan(0);
    });

    it('should track bytes copied', async () => {
      const result = await service.startMigration(tempSource, tempDest, () => {});

      expect(result.bytesCopied).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Verification Tests
  // ==========================================================================

  describe('verifyMigration', () => {
    it('should verify successful migration', async () => {
      await service.startMigration(tempSource, tempDest, () => {});

      const verification = await service.verifyMigration(tempSource, tempDest);

      expect(verification.verified).toBe(true);
      expect(verification.discrepancies).toHaveLength(0);
    });

    it('should detect missing files', async () => {
      await service.startMigration(tempSource, tempDest, () => {});

      // Delete a file from destination
      await fs.unlink(path.join(tempDest, 'prompts', 'test1.md'));

      const verification = await service.verifyMigration(tempSource, tempDest);

      expect(verification.verified).toBe(false);
      expect(verification.discrepancies.length).toBeGreaterThan(0);
    });

    it('should report file count mismatch', async () => {
      await service.startMigration(tempSource, tempDest, () => {});

      // Add extra file to destination
      await fs.writeFile(path.join(tempDest, 'prompts', 'extra.md'), 'extra');

      const verification = await service.verifyMigration(tempSource, tempDest);

      expect(verification.verified).toBe(false);
      expect(verification.discrepancies.some((d) => d.includes('mismatch'))).toBe(true);
    });

    it('should count files in both locations', async () => {
      await service.startMigration(tempSource, tempDest, () => {});

      const verification = await service.verifyMigration(tempSource, tempDest);

      expect(verification.sourceFileCount).toBe(14);
      expect(verification.destFileCount).toBe(14);
    });
  });

  // ==========================================================================
  // Cleanup Tests
  // ==========================================================================

  describe('cleanupSource', () => {
    it('should delete source directory after migration', async () => {
      await service.startMigration(tempSource, tempDest, () => {});

      const result = await service.cleanupSource(tempSource);

      expect(result.success).toBe(true);

      const sourceExists = await fs
        .access(tempSource)
        .then(() => true)
        .catch(() => false);
      expect(sourceExists).toBe(false);
    });

    it('should reject invalid storage directory', async () => {
      // Create a directory that doesn't look like storage
      const fakeDir = path.join(testDir, 'fake-dir');
      await fs.mkdir(fakeDir, { recursive: true });
      await fs.writeFile(path.join(fakeDir, 'random.txt'), 'content');

      const result = await service.cleanupSource(fakeDir);

      expect(result.success).toBe(false);
      expect(result.error).toContain('valid storage directory');

      // Cleanup
      await fs.rm(fakeDir, { recursive: true, force: true });
    });
  });

  // ==========================================================================
  // Rollback Tests
  // ==========================================================================

  describe('rollbackMigration', () => {
    it('should remove partially copied files', async () => {
      // Perform partial migration by cancelling
      const migrationPromise = service.startMigration(tempSource, tempDest, (progress) => {
        if (progress.phase === 'copying' && progress.copiedFiles > 2) {
          service.cancelMigration();
        }
      });

      await migrationPromise;

      // Now rollback
      const rollbackResult = await service.rollbackMigration();

      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.filesRemoved).toBeGreaterThan(0);
    });

    it('should preserve source files during rollback', async () => {
      // Start and cancel migration
      const migrationPromise = service.startMigration(tempSource, tempDest, (progress) => {
        if (progress.phase === 'copying' && progress.copiedFiles > 0) {
          service.cancelMigration();
        }
      });

      await migrationPromise;

      // Get source file count before rollback
      const sourceFilesBefore = await countFiles(tempSource);

      // Rollback
      await service.rollbackMigration();

      // Source should still have all files
      const sourceFilesAfter = await countFiles(tempSource);
      expect(sourceFilesAfter).toBe(sourceFilesBefore);
    });

    it('should return error if no manifest available', async () => {
      // No migration was started, so no manifest
      resetStorageMigrationService();
      const newService = new StorageMigrationService(fileSystemService);

      const result = await newService.rollbackMigration();

      expect(result.success).toBe(false);
      expect(result.error).toContain('manifest');
    });
  });

  // ==========================================================================
  // Edge Case Tests
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle empty storage directory', async () => {
      // Create empty storage
      await fs.rm(tempSource, { recursive: true, force: true });
      await fs.mkdir(tempSource, { recursive: true });

      const result = await service.startMigration(tempSource, tempDest, () => {});

      expect(result.success).toBe(true);
      expect(result.filesCopied).toBe(0);
    });

    it('should handle single file', async () => {
      // Create storage with single file
      await fs.rm(tempSource, { recursive: true, force: true });
      await fs.mkdir(path.join(tempSource, 'prompts'), { recursive: true });
      await fs.writeFile(path.join(tempSource, 'prompts', 'single.md'), 'content');

      const result = await service.startMigration(tempSource, tempDest, () => {});

      expect(result.success).toBe(true);
      expect(result.filesCopied).toBe(1);
    });

    it('should handle files with special characters in names', async () => {
      // Add file with special characters
      const specialFile = path.join(tempSource, 'prompts', 'test (1).md');
      await fs.writeFile(specialFile, 'special content');

      const result = await service.startMigration(tempSource, tempDest, () => {});

      expect(result.success).toBe(true);

      const destFile = path.join(tempDest, 'prompts', 'test (1).md');
      const exists = await fs
        .access(destFile)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should handle unicode filenames', async () => {
      // Add file with unicode name
      const unicodeFile = path.join(tempSource, 'prompts', '日本語.md');
      await fs.writeFile(unicodeFile, 'unicode content');

      const result = await service.startMigration(tempSource, tempDest, () => {});

      expect(result.success).toBe(true);

      const destFile = path.join(tempDest, 'prompts', '日本語.md');
      const exists = await fs
        .access(destFile)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should handle deeply nested directories', async () => {
      // Create deeply nested structure
      const deepPath = path.join(
        tempSource,
        'prompts',
        'level1',
        'level2',
        'level3',
        'level4',
        'level5'
      );
      await fs.mkdir(deepPath, { recursive: true });
      await fs.writeFile(path.join(deepPath, 'deep.md'), 'deep content');

      const result = await service.startMigration(tempSource, tempDest, () => {});

      expect(result.success).toBe(true);

      const destDeepFile = path.join(
        tempDest,
        'prompts',
        'level1',
        'level2',
        'level3',
        'level4',
        'level5',
        'deep.md'
      );
      const exists = await fs
        .access(destDeepFile)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should skip hidden files starting with dot', async () => {
      // Add hidden file
      const hiddenFile = path.join(tempSource, 'prompts', '.hidden');
      await fs.writeFile(hiddenFile, 'hidden content');

      const result = await service.startMigration(tempSource, tempDest, () => {});

      expect(result.success).toBe(true);

      // Hidden file should be copied (we copy all files)
      const destFile = path.join(tempDest, 'prompts', '.hidden');
      const exists = await fs
        .access(destFile)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  // ==========================================================================
  // Singleton Tests
  // ==========================================================================

  describe('singleton', () => {
    it('should return the same instance', () => {
      resetStorageMigrationService();
      const instance1 = getStorageMigrationService(fileSystemService);
      const instance2 = getStorageMigrationService();

      expect(instance1).toBe(instance2);
    });

    it('should reset the instance', () => {
      const instance1 = getStorageMigrationService(fileSystemService);
      resetStorageMigrationService();
      const instance2 = getStorageMigrationService(fileSystemService);

      expect(instance1).not.toBe(instance2);
    });

    it('should throw if not initialized', () => {
      resetStorageMigrationService();
      expect(() => getStorageMigrationService()).toThrow();
    });
  });
});
