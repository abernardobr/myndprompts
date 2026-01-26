/**
 * Storage Migration Service (Main Process)
 *
 * Handles storage migration operations - moving all MyndPrompts data
 * from one location to another on the same computer.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { BrowserWindow } from 'electron';
import { FileSystemService } from './file-system.service';
import { DEFAULT_DIRECTORIES } from '../../../services/file-system/types';

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Error codes for migration failures
 */
export enum MigrationErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  DISK_FULL = 'DISK_FULL',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  FILE_IN_USE = 'FILE_IN_USE',
  COPY_FAILED = 'COPY_FAILED',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  DATABASE_UPDATE_FAILED = 'DATABASE_UPDATE_FAILED',
  CANCELLED = 'CANCELLED',
  ROLLBACK_FAILED = 'ROLLBACK_FAILED',
  MANIFEST_ERROR = 'MANIFEST_ERROR',
  UNKNOWN = 'UNKNOWN',
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Progress information during migration
 */
export interface IMigrationProgress {
  phase: 'validating' | 'planning' | 'copying' | 'verifying' | 'completing';
  totalFiles: number;
  copiedFiles: number;
  totalBytes: number;
  copiedBytes: number;
  currentFile: string;
  currentDirectory: string;
  canCancel: boolean;
}

/**
 * Result of a migration operation
 */
export interface IMigrationResult {
  success: boolean;
  cancelled?: boolean;
  sourcePath: string;
  destinationPath: string;
  filesCopied: number;
  bytesCopied: number;
  duration: number;
  errors: string[];
}

/**
 * Directory information for migration planning
 */
export interface IMigrationDirectoryInfo {
  name: string;
  path: string;
  fileCount: number;
  size: number;
  exists: boolean;
}

/**
 * Migration plan with all directories to copy
 */
export interface IMigrationPlan {
  directories: IMigrationDirectoryInfo[];
  totalFiles: number;
  totalSize: number;
}

/**
 * Validation result for destination path
 */
export interface IMigrationValidation {
  valid: boolean;
  error?: string;
  availableSpace?: number;
  requiredSpace?: number;
}

/**
 * Verification result after migration
 */
export interface IMigrationVerification {
  verified: boolean;
  discrepancies: string[];
  sourceFileCount: number;
  destFileCount: number;
}

/**
 * Migration manifest for tracking and recovery
 */
export interface IMigrationManifest {
  version: string;
  startedAt: string;
  sourcePath: string;
  destinationPath: string;
  expectedFiles: number;
  expectedBytes: number;
  copiedFiles: string[];
  copiedBytes: number;
  status: 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'rolled_back';
  lastUpdated: string;
  error?: string;
  errorCode?: MigrationErrorCode;
}

/**
 * Custom error for migration cancellation
 */
export class MigrationCancelledError extends Error {
  constructor(message: string = 'Migration cancelled by user') {
    super(message);
    this.name = 'MigrationCancelledError';
  }
}

/**
 * Custom error for migration failures
 */
export class MigrationError extends Error {
  constructor(
    message: string,
    public readonly code: MigrationErrorCode,
    public readonly recoverable: boolean = false,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}

// ============================================================================
// Storage Migration Service
// ============================================================================

/**
 * Service for migrating storage to a new location
 */
export class StorageMigrationService {
  private fileSystemService: FileSystemService;
  private cancellationRequested: boolean = false;
  private currentOperation: string = '';
  private currentManifest: IMigrationManifest | null = null;

  // Manifest filename for tracking migration state
  private readonly MANIFEST_FILENAME = '.migration-manifest.json';
  private readonly MANIFEST_VERSION = '1.0';

  // Storage directories to migrate (in order)
  private readonly STORAGE_DIRS = [
    DEFAULT_DIRECTORIES.PROMPTS,
    DEFAULT_DIRECTORIES.SNIPPETS,
    DEFAULT_DIRECTORIES.PERSONAS,
    DEFAULT_DIRECTORIES.TEMPLATES,
    DEFAULT_DIRECTORIES.PROJECTS,
    DEFAULT_DIRECTORIES.BACKUPS,
  ];

  constructor(fileSystemService: FileSystemService) {
    this.fileSystemService = fileSystemService;
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Validate a destination path for migration
   * @param destPath - The destination path to validate
   * @returns Validation result with error message if invalid
   */
  async validateDestination(destPath: string): Promise<IMigrationValidation> {
    try {
      const sourcePath = this.fileSystemService.getBasePath();

      // Normalize paths for comparison
      const normalizedSource = path.normalize(sourcePath);
      const normalizedDest = path.normalize(destPath);

      // Check if destination is inside source (would cause infinite loop)
      if (normalizedDest.startsWith(normalizedSource + path.sep)) {
        return {
          valid: false,
          error: 'Destination cannot be inside the current storage location',
        };
      }

      // Check if source is inside destination (would overwrite destination)
      if (normalizedSource.startsWith(normalizedDest + path.sep)) {
        return {
          valid: false,
          error: 'Current storage location cannot be inside the destination',
        };
      }

      // Check if destination exists
      let destExists = false;
      try {
        const stats = await fs.stat(destPath);
        destExists = true;

        if (!stats.isDirectory()) {
          return {
            valid: false,
            error: 'Destination path exists but is not a directory',
          };
        }

        // Check if destination is empty
        const contents = await fs.readdir(destPath);
        if (contents.length > 0) {
          return {
            valid: false,
            error: 'Destination folder must be empty',
          };
        }
      } catch (error) {
        // Destination doesn't exist - that's fine, we'll create it
        destExists = false;
      }

      // Check write permissions by trying to create/write to the directory
      try {
        if (!destExists) {
          await fs.mkdir(destPath, { recursive: true });
        }

        // Try to write a test file
        const testFile = path.join(destPath, '.migration-test');
        await fs.writeFile(testFile, 'test');
        await fs.unlink(testFile);

        // Clean up empty directory if we created it
        if (!destExists) {
          await fs.rmdir(destPath);
        }
      } catch (error) {
        return {
          valid: false,
          error: 'No write permission for the selected folder',
        };
      }

      // Calculate required space
      const plan = await this.calculateMigrationPlan(sourcePath);
      const requiredSpace = plan.totalSize;

      // Check available disk space
      let availableSpace: number | undefined;
      try {
        // Get the drive/mount point for the destination
        const destDir = destExists ? destPath : path.dirname(destPath);
        const stats = await fs.statfs(destDir);
        availableSpace = stats.bfree * stats.bsize;

        // Add 10% buffer for safety
        const requiredWithBuffer = requiredSpace * 1.1;
        if (availableSpace < requiredWithBuffer) {
          return {
            valid: false,
            error: `Not enough disk space. Required: ${this.formatBytes(requiredWithBuffer)}, Available: ${this.formatBytes(availableSpace)}`,
            availableSpace,
            requiredSpace,
          };
        }
      } catch {
        // statfs might not be available on all platforms
        // Continue without space check
      }

      return {
        valid: true,
        availableSpace,
        requiredSpace,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown validation error',
      };
    }
  }

  /**
   * Calculate the migration plan - what directories and files need to be copied
   * @param sourcePath - The source storage path
   * @returns Migration plan with directory details
   */
  async calculateMigrationPlan(sourcePath: string): Promise<IMigrationPlan> {
    const directories: IMigrationDirectoryInfo[] = [];
    let totalFiles = 0;
    let totalSize = 0;

    for (const dirName of this.STORAGE_DIRS) {
      const dirPath = path.join(sourcePath, dirName);

      try {
        const stats = await fs.stat(dirPath);
        if (stats.isDirectory()) {
          const { fileCount, size } = await this.calculateDirectoryStats(dirPath);
          directories.push({
            name: dirName,
            path: dirPath,
            fileCount,
            size,
            exists: true,
          });
          totalFiles += fileCount;
          totalSize += size;
        }
      } catch {
        // Directory doesn't exist
        directories.push({
          name: dirName,
          path: dirPath,
          fileCount: 0,
          size: 0,
          exists: false,
        });
      }
    }

    return {
      directories,
      totalFiles,
      totalSize,
    };
  }

  /**
   * Start the migration process
   * @param sourcePath - Source storage path
   * @param destPath - Destination path
   * @param onProgress - Progress callback
   * @param existingManifest - Optional existing manifest for resuming migrations
   * @returns Migration result
   */
  async startMigration(
    sourcePath: string,
    destPath: string,
    onProgress: (progress: IMigrationProgress) => void,
    existingManifest?: IMigrationManifest
  ): Promise<IMigrationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let filesCopied = 0;
    let bytesCopied = 0;

    // Reset cancellation flag
    this.cancellationRequested = false;

    // Track already copied files (for resume)
    const alreadyCopiedSet = new Set<string>(existingManifest?.copiedFiles ?? []);

    try {
      // Phase 1: Validating (skip if resuming)
      if (!existingManifest) {
        onProgress({
          phase: 'validating',
          totalFiles: 0,
          copiedFiles: 0,
          totalBytes: 0,
          copiedBytes: 0,
          currentFile: '',
          currentDirectory: '',
          canCancel: true,
        });

        const validation = await this.validateDestination(destPath);
        if (!validation.valid) {
          throw new MigrationError(
            validation.error ?? 'Validation failed',
            MigrationErrorCode.VALIDATION_FAILED,
            false,
            { destPath }
          );
        }

        this.checkCancellation();
      }

      // Phase 2: Planning
      onProgress({
        phase: 'planning',
        totalFiles: 0,
        copiedFiles: 0,
        totalBytes: 0,
        copiedBytes: 0,
        currentFile: '',
        currentDirectory: '',
        canCancel: true,
      });

      const plan = await this.calculateMigrationPlan(sourcePath);

      this.checkCancellation();

      // Create destination directory
      await fs.mkdir(destPath, { recursive: true });

      // Create or update migration manifest
      const manifest: IMigrationManifest = existingManifest ?? {
        version: this.MANIFEST_VERSION,
        startedAt: new Date().toISOString(),
        sourcePath,
        destinationPath: destPath,
        expectedFiles: plan.totalFiles,
        expectedBytes: plan.totalSize,
        copiedFiles: [],
        copiedBytes: 0,
        status: 'in_progress',
        lastUpdated: new Date().toISOString(),
      };

      this.currentManifest = manifest;

      // Save manifest to both locations
      await this.saveManifest(manifest, sourcePath);
      await this.saveManifest(manifest, destPath);

      // Count already copied files/bytes
      if (existingManifest) {
        filesCopied = existingManifest.copiedFiles.length;
        bytesCopied = existingManifest.copiedBytes;
        this.log('info', `Resuming migration with ${filesCopied} files already copied`);
      }

      // Phase 3: Copying
      for (const dir of plan.directories) {
        if (!dir.exists) continue;

        this.checkCancellation();

        const destDirPath = path.join(destPath, dir.name);

        onProgress({
          phase: 'copying',
          totalFiles: plan.totalFiles,
          copiedFiles: filesCopied,
          totalBytes: plan.totalSize,
          copiedBytes: bytesCopied,
          currentFile: '',
          currentDirectory: dir.name,
          canCancel: true,
        });

        try {
          const result = await this.copyDirectoryWithProgress(
            dir.path,
            destDirPath,
            dir.name,
            (currentFile, fileCopied, fileSize) => {
              if (fileCopied) {
                filesCopied++;
                bytesCopied += fileSize;

                // Update manifest periodically (every 10 files)
                manifest.copiedFiles.push(currentFile);
                manifest.copiedBytes = bytesCopied;
                if (filesCopied % 10 === 0) {
                  manifest.lastUpdated = new Date().toISOString();
                  this.saveManifestAsync(manifest, destPath);
                }
              }
              onProgress({
                phase: 'copying',
                totalFiles: plan.totalFiles,
                copiedFiles: filesCopied,
                totalBytes: plan.totalSize,
                copiedBytes: bytesCopied,
                currentFile: this.truncatePath(currentFile, 50),
                currentDirectory: dir.name,
                canCancel: true,
              });
            },
            alreadyCopiedSet
          );

          if (!result.success && result.error) {
            errors.push(`Error copying ${dir.name}: ${result.error}`);
          }
        } catch (error) {
          if (error instanceof MigrationCancelledError) {
            // Update manifest on cancellation
            manifest.status = 'cancelled';
            manifest.lastUpdated = new Date().toISOString();
            await this.saveManifest(manifest, sourcePath);
            await this.saveManifest(manifest, destPath);
            throw error;
          }
          if (error instanceof MigrationError) {
            // Update manifest with error
            manifest.status = 'failed';
            manifest.error = error.message;
            manifest.errorCode = error.code;
            manifest.lastUpdated = new Date().toISOString();
            await this.saveManifest(manifest, sourcePath);
            await this.saveManifest(manifest, destPath);

            if (!error.recoverable) {
              throw error;
            }
            errors.push(`Error copying ${dir.name}: ${error.message}`);
          } else {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Error copying ${dir.name}: ${errorMsg}`);
          }
        }
      }

      this.checkCancellation();

      // Phase 4: Verifying
      onProgress({
        phase: 'verifying',
        totalFiles: plan.totalFiles,
        copiedFiles: filesCopied,
        totalBytes: plan.totalSize,
        copiedBytes: bytesCopied,
        currentFile: '',
        currentDirectory: '',
        canCancel: false,
      });

      const verification = await this.verifyMigration(sourcePath, destPath);
      if (!verification.verified) {
        errors.push(...verification.discrepancies);
      }

      // Phase 5: Completing
      onProgress({
        phase: 'completing',
        totalFiles: plan.totalFiles,
        copiedFiles: filesCopied,
        totalBytes: plan.totalSize,
        copiedBytes: bytesCopied,
        currentFile: '',
        currentDirectory: '',
        canCancel: false,
      });

      const duration = Date.now() - startTime;
      const success = errors.length === 0;

      // Update manifest to completed
      manifest.status = success ? 'completed' : 'failed';
      manifest.lastUpdated = new Date().toISOString();
      if (!success) {
        manifest.error = errors.join('; ');
      }
      await this.saveManifest(manifest, sourcePath);
      await this.saveManifest(manifest, destPath);

      // Clean up manifest from source on success
      if (success) {
        try {
          await fs.unlink(path.join(sourcePath, this.MANIFEST_FILENAME));
        } catch {
          // Ignore - cleanup is best effort
        }
      }

      // Only clear manifest on successful completion
      // Keep it available for rollback on failure/cancellation
      if (success) {
        this.currentManifest = null;
      }

      return {
        success,
        sourcePath,
        destinationPath: destPath,
        filesCopied,
        bytesCopied,
        duration,
        errors,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      if (error instanceof MigrationCancelledError) {
        // Keep manifest for potential rollback
        return {
          success: false,
          cancelled: true,
          sourcePath,
          destinationPath: destPath,
          filesCopied,
          bytesCopied,
          duration,
          errors: ['Migration cancelled by user'],
        };
      }

      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.log('error', 'Migration failed', { error: errorMsg, filesCopied, bytesCopied });

      // Keep manifest for potential rollback
      return {
        success: false,
        sourcePath,
        destinationPath: destPath,
        filesCopied,
        bytesCopied,
        duration,
        errors: [...errors, errorMsg],
      };
    }
  }

  /**
   * Verify that migration was successful by comparing source and destination
   * @param sourcePath - Original source path
   * @param destPath - Migration destination path
   * @returns Verification result
   */
  async verifyMigration(sourcePath: string, destPath: string): Promise<IMigrationVerification> {
    const discrepancies: string[] = [];
    let sourceFileCount = 0;
    let destFileCount = 0;

    for (const dirName of this.STORAGE_DIRS) {
      const sourceDir = path.join(sourcePath, dirName);
      const destDir = path.join(destPath, dirName);

      try {
        const sourceStats = await this.calculateDirectoryStats(sourceDir);
        sourceFileCount += sourceStats.fileCount;

        try {
          const destStats = await this.calculateDirectoryStats(destDir);
          destFileCount += destStats.fileCount;

          if (sourceStats.fileCount !== destStats.fileCount) {
            discrepancies.push(
              `${dirName}: File count mismatch (source: ${sourceStats.fileCount}, dest: ${destStats.fileCount})`
            );
          }

          // Allow small size differences due to metadata
          const sizeDiff = Math.abs(sourceStats.size - destStats.size);
          const sizeThreshold = sourceStats.size * 0.01; // 1% tolerance
          if (sizeDiff > sizeThreshold && sizeDiff > 1024) {
            discrepancies.push(
              `${dirName}: Size mismatch (source: ${this.formatBytes(sourceStats.size)}, dest: ${this.formatBytes(destStats.size)})`
            );
          }
        } catch {
          discrepancies.push(`${dirName}: Destination directory not found`);
        }
      } catch {
        // Source directory doesn't exist, check if dest also doesn't exist
        try {
          await fs.stat(destDir);
          discrepancies.push(`${dirName}: Unexpected directory in destination`);
        } catch {
          // Both don't exist, that's fine
        }
      }
    }

    return {
      verified: discrepancies.length === 0,
      discrepancies,
      sourceFileCount,
      destFileCount,
    };
  }

  /**
   * Cancel the ongoing migration
   */
  cancelMigration(): void {
    this.cancellationRequested = true;
  }

  /**
   * Clean up the source directory after successful migration
   * @param sourcePath - The source path to delete
   */
  async cleanupSource(sourcePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Safety check: ensure this is actually our storage directory
      const basePath = this.fileSystemService.getBasePath();
      if (path.normalize(sourcePath) !== path.normalize(basePath)) {
        // Additional safety: check if it looks like a myndprompt storage
        const hasExpectedDirs = await this.looksLikeStorageDir(sourcePath);
        if (!hasExpectedDirs) {
          return {
            success: false,
            error: 'Source path does not appear to be a valid storage directory',
          };
        }
      }

      // Delete the source directory recursively
      await fs.rm(sourcePath, { recursive: true, force: true });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete source directory',
      };
    }
  }

  /**
   * Check for incomplete migration from a previous session
   * @returns The manifest if an incomplete migration is found, null otherwise
   */
  async checkForIncompleteMigration(): Promise<IMigrationManifest | null> {
    try {
      const basePath = this.fileSystemService.getBasePath();

      // Check both the current base path and any manifest in temp locations
      const manifestPath = path.join(basePath, this.MANIFEST_FILENAME);

      try {
        const content = await fs.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(content) as IMigrationManifest;

        // Only return if migration was in progress
        if (manifest.status === 'in_progress') {
          this.log('warn', 'Found incomplete migration', {
            source: manifest.sourcePath,
            dest: manifest.destinationPath,
            copiedFiles: manifest.copiedFiles.length,
          });
          return manifest;
        }
      } catch {
        // No manifest in base path
      }

      return null;
    } catch (error) {
      this.log('error', 'Error checking for incomplete migration', error);
      return null;
    }
  }

  /**
   * Rollback a failed or cancelled migration
   * @param manifest - The migration manifest
   * @returns Result of the rollback operation
   */
  async rollbackMigration(
    manifest?: IMigrationManifest
  ): Promise<{ success: boolean; error?: string; filesRemoved: number }> {
    const targetManifest = manifest ?? this.currentManifest;
    let filesRemoved = 0;

    if (!targetManifest) {
      return {
        success: false,
        error: 'No migration manifest available for rollback',
        filesRemoved: 0,
      };
    }

    this.log('info', 'Starting migration rollback', {
      destination: targetManifest.destinationPath,
      copiedFiles: targetManifest.copiedFiles.length,
    });

    try {
      // Delete all copied files from destination (in reverse order)
      const filesToRemove = [...targetManifest.copiedFiles].reverse();

      for (const relativePath of filesToRemove) {
        const filePath = path.join(targetManifest.destinationPath, relativePath);
        try {
          await fs.unlink(filePath);
          filesRemoved++;
        } catch (err) {
          // Log but continue - file might already be deleted
          this.log('warn', `Failed to remove file during rollback: ${filePath}`, err);
        }
      }

      // Remove empty directories in destination
      await this.removeEmptyDirectories(targetManifest.destinationPath);

      // Update manifest status
      targetManifest.status = 'rolled_back';
      targetManifest.lastUpdated = new Date().toISOString();
      await this.saveManifest(targetManifest, targetManifest.sourcePath);

      // Try to remove manifest from destination
      try {
        await fs.unlink(path.join(targetManifest.destinationPath, this.MANIFEST_FILENAME));
      } catch {
        // Ignore - might not exist
      }

      this.log('info', 'Rollback completed', { filesRemoved });

      return { success: true, filesRemoved };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown rollback error';
      this.log('error', 'Rollback failed', error);
      return { success: false, error: errorMsg, filesRemoved };
    }
  }

  /**
   * Resume a previously interrupted migration
   * @param manifest - The migration manifest to resume from
   * @param onProgress - Progress callback
   * @returns Migration result
   */
  async resumeMigration(
    manifest: IMigrationManifest,
    onProgress: (progress: IMigrationProgress) => void
  ): Promise<IMigrationResult> {
    this.log('info', 'Resuming migration', {
      source: manifest.sourcePath,
      dest: manifest.destinationPath,
      alreadyCopied: manifest.copiedFiles.length,
    });

    // Update manifest to in_progress
    manifest.status = 'in_progress';
    manifest.lastUpdated = new Date().toISOString();
    this.currentManifest = manifest;

    // Continue with startMigration using the already copied files
    return this.startMigration(manifest.sourcePath, manifest.destinationPath, onProgress, manifest);
  }

  /**
   * Emit progress events to the renderer process
   */
  emitProgress(progress: IMigrationProgress): void {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.webContents.send('fs:migration-progress', progress);
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Check if cancellation was requested and throw if so
   */
  private checkCancellation(): void {
    if (this.cancellationRequested) {
      throw new MigrationCancelledError();
    }
  }

  /**
   * Determine progress update frequency based on total file count
   * - Small migrations (< 100 files): Update every file
   * - Medium migrations (100-1000 files): Update every 10 files
   * - Large migrations (> 1000 files): Update every 50 files
   */
  private getProgressUpdateInterval(totalFiles: number): number {
    if (totalFiles < 100) {
      return 1; // Update every file
    } else if (totalFiles <= 1000) {
      return 10; // Update every 10 files
    } else {
      return 50; // Update every 50 files
    }
  }

  /**
   * Copy a directory with progress tracking
   * Uses optimized progress update frequency based on migration size
   * @param alreadyCopiedSet - Set of relative paths already copied (for resume support)
   */
  private async copyDirectoryWithProgress(
    sourcePath: string,
    destPath: string,
    dirName: string,
    onFileProgress: (currentFile: string, copied: boolean, size: number) => void,
    alreadyCopiedSet?: Set<string>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Create destination directory
      await fs.mkdir(destPath, { recursive: true });

      // Get all files recursively
      const files = await this.getAllFiles(sourcePath);

      // Determine update frequency
      const updateInterval = this.getProgressUpdateInterval(files.length);
      let filesCopied = 0;
      let lastDirectory = '';

      for (const file of files) {
        this.checkCancellation();

        const relativePath = path.relative(sourcePath, file.path);
        const fullRelativePath = path.join(dirName, relativePath);
        const destFile = path.join(destPath, relativePath);
        const currentDirectory = path.dirname(relativePath);

        // Skip already copied files (for resume)
        if (alreadyCopiedSet?.has(fullRelativePath)) {
          filesCopied++;
          continue;
        }

        // Check if we should emit progress update
        // Always update on directory change or based on update interval
        const directoryChanged = currentDirectory !== lastDirectory;
        const shouldUpdateProgress =
          directoryChanged || filesCopied % updateInterval === 0 || filesCopied === 0;

        if (shouldUpdateProgress) {
          // Notify about current file
          onFileProgress(fullRelativePath, false, 0);
        }

        lastDirectory = currentDirectory;

        // Create parent directories
        await fs.mkdir(path.dirname(destFile), { recursive: true });

        // Copy the file with error handling
        await this.safeCopyFile(file.path, destFile);

        filesCopied++;

        // Notify file copied (with update frequency optimization)
        const isLastFile = filesCopied === files.length;
        if (shouldUpdateProgress || isLastFile) {
          onFileProgress(fullRelativePath, true, file.size);
        } else {
          // Still count the file but don't emit progress update
          onFileProgress(fullRelativePath, true, file.size);
        }
      }

      return { success: true };
    } catch (error) {
      if (error instanceof MigrationCancelledError || error instanceof MigrationError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get all files in a directory recursively
   */
  private async getAllFiles(dirPath: string): Promise<Array<{ path: string; size: number }>> {
    const files: Array<{ path: string; size: number }> = [];

    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await this.getAllFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const stats = await fs.stat(fullPath);
        files.push({ path: fullPath, size: stats.size });
      }
    }

    return files;
  }

  /**
   * Walk through a directory recursively using an async generator
   * More memory efficient for large directories as it yields files one at a time
   * @param dir - Directory path to walk
   * @yields File path and size for each file found
   */
  private async *walkDirectory(dir: string): AsyncGenerator<{ path: string; size: number }> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        yield* this.walkDirectory(fullPath);
      } else if (entry.isFile()) {
        const stats = await fs.stat(fullPath);
        yield { path: fullPath, size: stats.size };
      }
    }
  }

  /**
   * Calculate directory statistics (file count and total size)
   */
  private async calculateDirectoryStats(
    dirPath: string
  ): Promise<{ fileCount: number; size: number }> {
    let fileCount = 0;
    let size = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          const subStats = await this.calculateDirectoryStats(fullPath);
          fileCount += subStats.fileCount;
          size += subStats.size;
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          fileCount++;
          size += stats.size;
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return { fileCount, size };
  }

  /**
   * Check if a directory looks like a MyndPrompt storage directory
   */
  private async looksLikeStorageDir(dirPath: string): Promise<boolean> {
    let matchingDirs = 0;

    for (const dirName of this.STORAGE_DIRS) {
      try {
        const stats = await fs.stat(path.join(dirPath, dirName));
        if (stats.isDirectory()) {
          matchingDirs++;
        }
      } catch {
        // Directory doesn't exist
      }
    }

    // If at least 2 expected directories exist, it's likely our storage
    return matchingDirs >= 2;
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Truncate a path for display
   */
  private truncatePath(filePath: string, maxLength: number): string {
    if (filePath.length <= maxLength) {
      return filePath;
    }

    const fileName = path.basename(filePath);
    if (fileName.length >= maxLength - 3) {
      return '...' + fileName.slice(-(maxLength - 3));
    }

    const remaining = maxLength - fileName.length - 4; // 4 for ".../"
    const dirPart = path.dirname(filePath);
    return '...' + dirPart.slice(-remaining) + '/' + fileName;
  }

  /**
   * Safely copy a file with detailed error handling
   * @throws MigrationError with specific error code on failure
   */
  private async safeCopyFile(source: string, dest: string): Promise<void> {
    try {
      await fs.copyFile(source, dest);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      // Handle specific error codes
      if (nodeError.code === 'ENOSPC') {
        throw new MigrationError(
          `Disk full while copying: ${path.basename(source)}`,
          MigrationErrorCode.DISK_FULL,
          false,
          { source, dest }
        );
      }

      if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') {
        throw new MigrationError(
          `Permission denied: ${path.basename(source)}`,
          MigrationErrorCode.PERMISSION_DENIED,
          true,
          { source, dest }
        );
      }

      if (nodeError.code === 'EBUSY') {
        throw new MigrationError(
          `File in use: ${path.basename(source)}`,
          MigrationErrorCode.FILE_IN_USE,
          true,
          { source, dest }
        );
      }

      if (nodeError.code === 'ENOENT') {
        // Source file doesn't exist - might have been deleted during migration
        this.log('warn', `Source file not found, skipping: ${source}`);
        return; // Skip this file
      }

      // Generic copy failure
      throw new MigrationError(
        `Copy failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        MigrationErrorCode.COPY_FAILED,
        true,
        { source, dest, originalError: nodeError.code }
      );
    }
  }

  /**
   * Save migration manifest to a directory
   */
  private async saveManifest(manifest: IMigrationManifest, dirPath: string): Promise<void> {
    try {
      const manifestPath = path.join(dirPath, this.MANIFEST_FILENAME);
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    } catch (error) {
      this.log('warn', `Failed to save manifest to ${dirPath}`, error);
    }
  }

  /**
   * Save migration manifest asynchronously (fire and forget)
   */
  private saveManifestAsync(manifest: IMigrationManifest, dirPath: string): void {
    this.saveManifest(manifest, dirPath).catch((err) => {
      this.log('warn', 'Async manifest save failed', err);
    });
  }

  /**
   * Remove empty directories recursively (bottom-up)
   */
  private async removeEmptyDirectories(dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      // First, recursively process subdirectories
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await this.removeEmptyDirectories(path.join(dirPath, entry.name));
        }
      }

      // Check if directory is now empty
      const remainingEntries = await fs.readdir(dirPath);
      if (remainingEntries.length === 0) {
        await fs.rmdir(dirPath);
      }
    } catch (error) {
      // Ignore errors - directory might already be deleted or not exist
      this.log('debug', `Failed to remove directory: ${dirPath}`, error);
    }
  }

  /**
   * Log a message with timestamp and context
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [Migration] [${level.toUpperCase()}]`;

    switch (level) {
      case 'debug':
        // Only log debug in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`${prefix} ${message}`, data ?? '');
        }
        break;
      case 'info':
        console.log(`${prefix} ${message}`, data ?? '');
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`, data ?? '');
        break;
      case 'error':
        console.error(`${prefix} ${message}`, data ?? '');
        break;
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let instance: StorageMigrationService | null = null;

/**
 * Get the singleton instance of StorageMigrationService
 * @param fileSystemService - FileSystemService instance (required on first call)
 * @returns StorageMigrationService instance
 */
export function getStorageMigrationService(
  fileSystemService?: FileSystemService
): StorageMigrationService {
  if (!instance) {
    if (!fileSystemService) {
      throw new Error('FileSystemService is required to initialize StorageMigrationService');
    }
    instance = new StorageMigrationService(fileSystemService);
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetStorageMigrationService(): void {
  instance = null;
}
