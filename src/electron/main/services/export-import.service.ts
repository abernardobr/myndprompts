/**
 * Export/Import Service (Main Process)
 *
 * Handles export and import operations for MyndPrompts data.
 * Creates ZIP archives with an index.json manifest and extracts them back.
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import archiver from 'archiver';
import extractZip from 'extract-zip';
import { BrowserWindow } from 'electron';
import { getFileSystemService, FileSystemService } from './file-system.service';
import type {
  IExportManifest,
  IExportFileEntry,
  IExportOptions,
  IImportOptions,
  IExportResult,
  IImportResult,
  IExportStatistics,
  IImportConflict,
  IValidationResult,
  ConflictResolution,
  ExportFileType,
  IExportProgress,
  IImportProgress,
  ExportImportErrorCode,
} from '../../../services/export-import/types';
import {
  DEFAULT_EXPORT_OPTIONS,
  DEFAULT_IMPORT_OPTIONS,
  EXPORT_FORMAT_VERSION,
  ERROR_CODES,
  ExportError,
  ImportError,
  MAX_IMPORT_FILE_SIZE,
  LARGE_FILE_WARNING_SIZE,
} from '../../../services/export-import/types';

// Storage directory names
const STORAGE_DIRS = {
  PROMPTS: 'prompts',
  SNIPPETS: 'snippets',
  PERSONAS: 'personas',
  TEMPLATES: 'templates',
  PROJECTS: 'projects',
} as const;

/**
 * Service for export/import operations in the main process
 */
export class ExportImportService {
  private fileSystemService: FileSystemService;
  private basePath: string;
  private appVersion: string;

  constructor(basePath?: string) {
    this.fileSystemService = getFileSystemService(basePath);
    this.basePath = this.fileSystemService.getBasePath();
    // Read app version from package.json
    this.appVersion = this.getAppVersion();
  }

  /**
   * Get the app version from package.json
   */
  private getAppVersion(): string {
    try {
      // In production, package.json might be in different locations
      // Try to read from the app resources or use a fallback
      return '0.1.8'; // Fallback version
    } catch {
      return '0.0.0';
    }
  }

  /**
   * Emit progress events to the renderer process
   */
  private emitProgress(progress: IExportProgress | IImportProgress): void {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.webContents.send('export-import:progress', progress);
    }
  }

  /**
   * Export all data to a ZIP file
   */
  async exportData(destPath: string, options?: IExportOptions): Promise<IExportResult> {
    const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options };

    try {
      // Emit initial progress
      this.emitProgress({
        phase: 'reading',
        current: 0,
        total: 0,
      });

      // Read all files from storage directories
      const files = await this.readAllStorageFiles(opts);

      // Emit reading complete progress
      this.emitProgress({
        phase: 'reading',
        current: files.length,
        total: files.length,
      });

      // Generate the manifest
      const manifest = this.generateManifest(files);

      // Emit compressing start
      this.emitProgress({
        phase: 'compressing',
        current: 0,
        total: files.length,
      });

      // Create the ZIP archive
      await this.createZipArchive(destPath, manifest, files, opts);

      // Emit writing complete
      this.emitProgress({
        phase: 'writing',
        current: files.length,
        total: files.length,
      });

      return {
        success: true,
        path: destPath,
        statistics: manifest.statistics,
      };
    } catch (error) {
      console.error('[ExportImportService] Export failed:', error);

      // Handle specific error types
      if (error instanceof ExportError) {
        return {
          success: false,
          error: error.message,
          errorCode: error.code,
        };
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Detect specific error types from message
      let errorCode: ExportImportErrorCode = ERROR_CODES.UNKNOWN_ERROR;
      if (errorMessage.includes('EACCES') || errorMessage.includes('EPERM')) {
        errorCode = ERROR_CODES.PERMISSION_DENIED;
      } else if (errorMessage.includes('ENOSPC')) {
        errorCode = ERROR_CODES.WRITE_ERROR;
      }

      return {
        success: false,
        error: errorMessage,
        errorCode,
      };
    }
  }

  /**
   * Import data from a ZIP file
   */
  async importData(zipPath: string, options?: IImportOptions): Promise<IImportResult> {
    const opts = { ...DEFAULT_IMPORT_OPTIONS, ...options };
    const conflictResolution = opts.conflictResolution ?? 'rename';

    const emptyStats: IExportStatistics = {
      totalFiles: 0,
      prompts: 0,
      snippets: 0,
      personas: 0,
      templates: 0,
      projects: 0,
    };

    try {
      // Emit validating progress
      this.emitProgress({
        phase: 'validating',
        current: 0,
        total: 1,
      });

      // Validate the ZIP file first
      const validation = await this.validateExport(zipPath);
      if (!validation.valid) {
        // Get the first error code from validation errors
        const firstErrorCode = validation.validationErrors?.[0]?.code ?? ERROR_CODES.UNKNOWN_ERROR;
        return {
          success: false,
          error: validation.errors.join('; '),
          errorCode: firstErrorCode,
          imported: emptyStats,
          skipped: 0,
          conflicts: [],
        };
      }

      // Emit extracting progress
      this.emitProgress({
        phase: 'extracting',
        current: 0,
        total: 1,
      });

      // Extract to temporary directory
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'myndprompts-import-'));

      try {
        await extractZip(zipPath, { dir: tempDir });

        // Emit extracting complete
        this.emitProgress({
          phase: 'extracting',
          current: 1,
          total: 1,
        });

        // Read the manifest
        const manifestPath = path.join(tempDir, 'index.json');
        const manifestContent = await fs.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestContent) as IExportManifest;

        // Import files
        const imported: IExportStatistics = { ...emptyStats };
        const conflicts: IImportConflict[] = [];
        let skipped = 0;

        const totalFiles = manifest.files.length;
        let fileIndex = 0;

        for (const fileEntry of manifest.files) {
          fileIndex++;
          const sourcePath = path.join(tempDir, fileEntry.relativePath);
          const targetPath = path.join(this.basePath, fileEntry.relativePath);

          // Emit copying progress
          this.emitProgress({
            phase: 'copying',
            current: fileIndex,
            total: totalFiles,
            currentFile: fileEntry.relativePath,
          });

          // Check if file exists in source (in extracted ZIP)
          const sourceExists = await this.fileExists(sourcePath);
          if (!sourceExists) {
            console.warn(`[ExportImportService] File missing in ZIP: ${fileEntry.relativePath}`);
            skipped++;
            continue;
          }

          // Check if target already exists
          const targetExists = await this.fileExists(targetPath);

          if (targetExists) {
            const resolution = await this.resolveConflict(
              targetPath,
              conflictResolution,
              sourcePath
            );

            if (resolution.action === 'skip') {
              skipped++;
              conflicts.push({
                path: fileEntry.relativePath,
                resolution: 'skip',
              });
              continue;
            } else if (resolution.action === 'rename' && resolution.newPath) {
              conflicts.push({
                path: fileEntry.relativePath,
                resolution: 'rename',
                newPath: resolution.newPath,
              });
              await this.copyFileWithDirs(sourcePath, resolution.newPath);
            } else {
              // Replace
              conflicts.push({
                path: fileEntry.relativePath,
                resolution: 'replace',
              });
              await this.copyFileWithDirs(sourcePath, targetPath);
            }
          } else {
            // No conflict, just copy
            await this.copyFileWithDirs(sourcePath, targetPath);
          }

          // Update statistics
          this.incrementStatistic(imported, fileEntry.type);
        }

        imported.totalFiles =
          imported.prompts +
          imported.snippets +
          imported.personas +
          imported.templates +
          imported.projects;

        return {
          success: true,
          imported,
          skipped,
          conflicts,
        };
      } finally {
        // Clean up temporary directory
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error('[ExportImportService] Import failed:', error);

      // Handle specific error types
      if (error instanceof ImportError) {
        return {
          success: false,
          error: error.message,
          errorCode: error.code,
          imported: emptyStats,
          skipped: 0,
          conflicts: [],
        };
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Detect specific error types from message
      let errorCode: ExportImportErrorCode = ERROR_CODES.UNKNOWN_ERROR;
      if (errorMessage.includes('EACCES') || errorMessage.includes('EPERM')) {
        errorCode = ERROR_CODES.PERMISSION_DENIED;
      } else if (errorMessage.includes('ENOENT')) {
        errorCode = ERROR_CODES.FILE_NOT_FOUND;
      } else if (
        errorMessage.includes('invalid signature') ||
        errorMessage.includes('bad archive')
      ) {
        errorCode = ERROR_CODES.CORRUPTED_ZIP;
      }

      return {
        success: false,
        error: errorMessage,
        errorCode,
        imported: emptyStats,
        skipped: 0,
        conflicts: [],
      };
    }
  }

  /**
   * Validate an export ZIP file with comprehensive error checking
   */
  async validateExport(zipPath: string): Promise<IValidationResult> {
    const errors: string[] = [];
    const validationErrors: { message: string; code?: ExportImportErrorCode }[] = [];
    const warnings: string[] = [];

    try {
      // Check file exists
      const exists = await this.fileExists(zipPath);
      if (!exists) {
        return {
          valid: false,
          errors: ['ZIP file does not exist'],
          validationErrors: [
            { message: 'ZIP file does not exist', code: ERROR_CODES.FILE_NOT_FOUND },
          ],
        };
      }

      // Check file extension
      if (!zipPath.toLowerCase().endsWith('.zip')) {
        errors.push('File must be a ZIP archive');
        validationErrors.push({
          message: 'File must be a ZIP archive',
          code: ERROR_CODES.INVALID_ZIP,
        });
      }

      // Check file size
      const stats = await fs.stat(zipPath);
      if (stats.size === 0) {
        return {
          valid: false,
          errors: ['ZIP file is empty'],
          validationErrors: [{ message: 'ZIP file is empty', code: ERROR_CODES.EMPTY_FILE }],
        };
      }

      // Check if file is too large
      if (stats.size > MAX_IMPORT_FILE_SIZE) {
        return {
          valid: false,
          errors: [
            `File size (${this.formatFileSize(stats.size)}) exceeds maximum allowed (${this.formatFileSize(MAX_IMPORT_FILE_SIZE)})`,
          ],
          validationErrors: [
            {
              message: `File size exceeds maximum allowed`,
              code: ERROR_CODES.FILE_TOO_LARGE,
            },
          ],
        };
      }

      // Warn for large files
      if (stats.size > LARGE_FILE_WARNING_SIZE) {
        warnings.push(`Large file (${this.formatFileSize(stats.size)}) may take longer to process`);
      }

      // Extract to temp and validate structure
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'myndprompts-validate-'));

      try {
        try {
          await extractZip(zipPath, { dir: tempDir });
        } catch (extractError) {
          const extractMessage =
            extractError instanceof Error ? extractError.message : 'Unknown error';
          return {
            valid: false,
            errors: [`Failed to extract ZIP: ${extractMessage}`],
            validationErrors: [
              { message: 'ZIP file is corrupted or invalid', code: ERROR_CODES.CORRUPTED_ZIP },
            ],
          };
        }

        // Check for index.json
        const indexPath = path.join(tempDir, 'index.json');
        const indexExists = await this.fileExists(indexPath);

        if (!indexExists) {
          errors.push('Missing index.json manifest file');
          validationErrors.push({
            message: 'Missing index.json manifest file',
            code: ERROR_CODES.MISSING_MANIFEST,
          });
        } else {
          // Validate manifest
          try {
            const manifestContent = await fs.readFile(indexPath, 'utf-8');
            const manifest: unknown = JSON.parse(manifestContent);
            const manifestValidation = this.validateManifestDetailed(manifest);
            errors.push(...manifestValidation.errors);
            validationErrors.push(...manifestValidation.validationErrors);
          } catch (parseError) {
            errors.push('Invalid index.json: failed to parse JSON');
            validationErrors.push({
              message: 'Invalid index.json: failed to parse JSON',
              code: ERROR_CODES.INVALID_MANIFEST,
            });
          }
        }
      } finally {
        // Clean up temp
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Detect permission errors
      if (errorMessage.includes('EACCES') || errorMessage.includes('EPERM')) {
        errors.push('Permission denied');
        validationErrors.push({
          message: 'Permission denied',
          code: ERROR_CODES.PERMISSION_DENIED,
        });
      } else {
        errors.push(`Validation error: ${errorMessage}`);
        validationErrors.push({ message: errorMessage, code: ERROR_CODES.UNKNOWN_ERROR });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      validationErrors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Read all files from storage directories
   */
  private async readAllStorageFiles(
    options: Required<IExportOptions>
  ): Promise<IExportFileEntry[]> {
    const files: IExportFileEntry[] = [];

    const dirsToProcess: { dir: string; type: ExportFileType; include: boolean }[] = [
      { dir: STORAGE_DIRS.PROMPTS, type: 'prompt', include: options.includePrompts },
      { dir: STORAGE_DIRS.SNIPPETS, type: 'snippet', include: options.includeSnippets },
      { dir: STORAGE_DIRS.PERSONAS, type: 'persona', include: options.includePersonas },
      { dir: STORAGE_DIRS.TEMPLATES, type: 'template', include: options.includeTemplates },
      { dir: STORAGE_DIRS.PROJECTS, type: 'project', include: options.includeProjects },
    ];

    for (const { dir, type, include } of dirsToProcess) {
      if (!include) continue;

      const dirPath = path.join(this.basePath, dir);
      const dirExists = await this.directoryExists(dirPath);

      if (!dirExists) continue;

      const dirFiles = await this.readDirectoryRecursive(dirPath, dir, type, options);
      files.push(...dirFiles);
    }

    return files;
  }

  /**
   * Read a directory recursively and return file entries
   */
  private async readDirectoryRecursive(
    dirPath: string,
    relativeDirPath: string,
    type: ExportFileType,
    options: Required<IExportOptions>
  ): Promise<IExportFileEntry[]> {
    const files: IExportFileEntry[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        const relativeEntryPath = path.join(relativeDirPath, entry.name);

        if (entry.isDirectory()) {
          // Recurse into subdirectory
          const subFiles = await this.readDirectoryRecursive(
            entryPath,
            relativeEntryPath,
            type,
            options
          );
          files.push(...subFiles);
        } else {
          // Process file
          const stats = await fs.stat(entryPath);
          const fileEntry: IExportFileEntry = {
            relativePath: relativeEntryPath,
            type,
            size: stats.size,
          };

          // Generate checksum if requested
          if (options.generateChecksums) {
            fileEntry.checksum = await this.calculateChecksum(entryPath);
          }

          // Extract metadata from markdown files
          if (entry.name.endsWith('.md')) {
            const metadata = await this.extractMetadata(entryPath);
            if (metadata) {
              fileEntry.metadata = metadata;
            }
          }

          files.push(fileEntry);
        }
      }
    } catch (error) {
      console.warn(`[ExportImportService] Could not read directory: ${dirPath}`, error);
    }

    return files;
  }

  /**
   * Generate the export manifest
   */
  private generateManifest(files: IExportFileEntry[]): IExportManifest {
    const statistics: IExportStatistics = {
      totalFiles: files.length,
      prompts: files.filter((f) => f.type === 'prompt').length,
      snippets: files.filter((f) => f.type === 'snippet').length,
      personas: files.filter((f) => f.type === 'persona').length,
      templates: files.filter((f) => f.type === 'template').length,
      projects: files.filter((f) => f.type === 'project').length,
    };

    return {
      version: EXPORT_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion: this.appVersion,
      statistics,
      files,
    };
  }

  /**
   * Create a ZIP archive with the manifest and files
   */
  private async createZipArchive(
    destPath: string,
    manifest: IExportManifest,
    files: IExportFileEntry[],
    _options: Required<IExportOptions>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fsSync.createWriteStream(destPath);
      const archive = archiver('zip', {
        zlib: { level: 9 }, // Maximum compression
      });

      let filesAdded = 0;
      const totalFiles = files.length;

      output.on('close', () => {
        resolve();
      });

      archive.on('error', (err) => {
        reject(err);
      });

      // Track progress as files are added to archive
      archive.on('entry', (entry) => {
        filesAdded++;
        this.emitProgress({
          phase: 'compressing',
          current: filesAdded,
          total: totalFiles + 1, // +1 for index.json
          currentFile: entry.name,
        });
      });

      archive.pipe(output);

      // Add index.json manifest
      archive.append(JSON.stringify(manifest, null, 2), { name: 'index.json' });

      // Add all files
      for (const fileEntry of files) {
        const filePath = path.join(this.basePath, fileEntry.relativePath);
        archive.file(filePath, { name: fileEntry.relativePath });
      }

      void archive.finalize();
    });
  }

  /**
   * Validate manifest schema (legacy - returns string array)
   */
  private validateManifest(manifest: unknown): string[] {
    return this.validateManifestDetailed(manifest).errors;
  }

  /**
   * Validate manifest schema with detailed error information
   */
  private validateManifestDetailed(manifest: unknown): {
    errors: string[];
    validationErrors: { message: string; code?: ExportImportErrorCode }[];
  } {
    const errors: string[] = [];
    const validationErrors: { message: string; code?: ExportImportErrorCode }[] = [];

    if (!manifest || typeof manifest !== 'object') {
      return {
        errors: ['Invalid manifest format'],
        validationErrors: [
          { message: 'Invalid manifest format', code: ERROR_CODES.INVALID_MANIFEST },
        ],
      };
    }

    const m = manifest as Record<string, unknown>;

    if (!m.version) {
      errors.push('Missing version field');
      validationErrors.push({
        message: 'Missing version field',
        code: ERROR_CODES.INVALID_MANIFEST,
      });
    }

    if (!m.exportedAt) {
      errors.push('Missing exportedAt field');
      validationErrors.push({
        message: 'Missing exportedAt field',
        code: ERROR_CODES.INVALID_MANIFEST,
      });
    }

    if (!Array.isArray(m.files)) {
      errors.push('Missing or invalid files array');
      validationErrors.push({
        message: 'Missing or invalid files array',
        code: ERROR_CODES.INVALID_MANIFEST,
      });
    }

    // Check version compatibility
    if (m.version && !this.isVersionCompatible(m.version as string)) {
      errors.push(`Incompatible export version: ${String(m.version)}`);
      validationErrors.push({
        message: `Incompatible export version: ${String(m.version)}`,
        code: ERROR_CODES.VERSION_INCOMPATIBLE,
      });
    }

    // Validate files array structure
    if (Array.isArray(m.files)) {
      const invalidFiles = (m.files as unknown[]).filter((f) => {
        if (!f || typeof f !== 'object') return true;
        const file = f as Record<string, unknown>;
        return !file.relativePath || typeof file.relativePath !== 'string';
      });

      if (invalidFiles.length > 0) {
        errors.push(`${invalidFiles.length} file entries have invalid format`);
        validationErrors.push({
          message: `${invalidFiles.length} file entries have invalid format`,
          code: ERROR_CODES.INVALID_MANIFEST,
        });
      }
    }

    return { errors, validationErrors };
  }

  /**
   * Check if export version is compatible
   */
  private isVersionCompatible(version: string): boolean {
    const [major] = version.split('.').map(Number);
    return major === 1; // Accept all 1.x versions
  }

  /**
   * Calculate MD5 checksum for a file
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Extract metadata from markdown frontmatter
   */
  private async extractMetadata(
    filePath: string
  ): Promise<{ id?: string; title?: string; category?: string; tags?: string[] } | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Check for frontmatter
      if (!content.startsWith('---')) {
        return null;
      }

      const endIndex = content.indexOf('---', 3);
      if (endIndex === -1) {
        return null;
      }

      const frontmatter = content.substring(3, endIndex).trim();
      const metadata: { id?: string; title?: string; category?: string; tags?: string[] } = {};

      // Simple YAML-like parsing
      const lines = frontmatter.split('\n');
      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        const key = line.substring(0, colonIndex).trim();
        let value = line.substring(colonIndex + 1).trim();

        // Remove quotes if present
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        if (key === 'id') metadata.id = value;
        if (key === 'title') metadata.title = value;
        if (key === 'category') metadata.category = value;
        if (key === 'tags') {
          // Parse tags array
          const tagsMatch = value.match(/\[(.*)\]/);
          if (tagsMatch?.[1] !== undefined) {
            metadata.tags = tagsMatch[1]
              .split(',')
              .map((t) => t.trim().replace(/['"]/g, ''))
              .filter((t) => t.length > 0);
          }
        }
      }

      return Object.keys(metadata).length > 0 ? metadata : null;
    } catch {
      return null;
    }
  }

  /**
   * Resolve file conflict
   */
  private async resolveConflict(
    targetPath: string,
    resolution: ConflictResolution,
    _sourcePath: string
  ): Promise<{ action: ConflictResolution; newPath?: string }> {
    if (resolution === 'skip') {
      return { action: 'skip' };
    }

    if (resolution === 'replace') {
      return { action: 'replace' };
    }

    // Rename strategy
    const dir = path.dirname(targetPath);
    const ext = path.extname(targetPath);
    const baseName = path.basename(targetPath, ext);

    let counter = 1;
    let newPath = path.join(dir, `${baseName} (imported)${ext}`);

    while (await this.fileExists(newPath)) {
      counter++;
      newPath = path.join(dir, `${baseName} (imported ${counter})${ext}`);
    }

    return { action: 'rename', newPath };
  }

  /**
   * Copy a file, creating directories if needed
   */
  private async copyFileWithDirs(sourcePath: string, destPath: string): Promise<void> {
    const destDir = path.dirname(destPath);
    await fs.mkdir(destDir, { recursive: true });
    await fs.copyFile(sourcePath, destPath);
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Check if a directory exists
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Increment the appropriate statistic counter
   */
  private incrementStatistic(stats: IExportStatistics, type: ExportFileType): void {
    switch (type) {
      case 'prompt':
        stats.prompts++;
        break;
      case 'snippet':
        stats.snippets++;
        break;
      case 'persona':
        stats.personas++;
        break;
      case 'template':
        stats.templates++;
        break;
      case 'project':
        stats.projects++;
        break;
    }
  }
}

// Singleton instance
let exportImportServiceInstance: ExportImportService | null = null;

/**
 * Get the export/import service instance
 */
export function getExportImportService(basePath?: string): ExportImportService {
  if (!exportImportServiceInstance) {
    exportImportServiceInstance = new ExportImportService(basePath);
  }
  return exportImportServiceInstance;
}

/**
 * Reset the service instance (for testing)
 */
export function resetExportImportService(): void {
  exportImportServiceInstance = null;
}
