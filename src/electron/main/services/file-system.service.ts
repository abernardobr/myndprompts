/**
 * File System Service (Main Process)
 *
 * Handles all file system operations in the Electron main process.
 * Includes security measures to prevent path traversal attacks.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type {
  IFileInfo,
  IDirectoryListing,
  IDirectoryInfo,
  IDirectoryContentsCount,
  IFileOperationResult,
  IReadFileOptions,
  IWriteFileOptions,
  IFileStorageConfig,
} from '../../../services/file-system/types';
import { DEFAULT_DIRECTORIES, FILE_EXTENSIONS } from '../../../services/file-system/types';

/**
 * Service for file system operations in the main process
 */
export class FileSystemService {
  private basePath: string;
  private config: IFileStorageConfig;

  constructor(basePath?: string) {
    this.basePath = basePath ?? path.join(os.homedir(), DEFAULT_DIRECTORIES.BASE);
    this.config = this.createConfig(this.basePath);
  }

  /**
   * Create the storage configuration
   */
  private createConfig(basePath: string): IFileStorageConfig {
    return {
      baseDir: basePath,
      promptsDir: path.join(basePath, DEFAULT_DIRECTORIES.PROMPTS),
      snippetsDir: path.join(basePath, DEFAULT_DIRECTORIES.SNIPPETS),
      personasDir: path.join(basePath, DEFAULT_DIRECTORIES.PERSONAS),
      templatesDir: path.join(basePath, DEFAULT_DIRECTORIES.TEMPLATES),
      projectsDir: path.join(basePath, DEFAULT_DIRECTORIES.PROJECTS),
      backupsDir: path.join(basePath, DEFAULT_DIRECTORIES.BACKUPS),
    };
  }

  /**
   * Get the storage configuration
   */
  getConfig(): IFileStorageConfig {
    return { ...this.config };
  }

  /**
   * Get the base path
   */
  getBasePath(): string {
    return this.basePath;
  }

  /**
   * Validate a path to prevent path traversal attacks
   * Returns the normalized absolute path if valid, throws if invalid
   */
  validatePath(filePath: string): string {
    const normalizedPath = path.normalize(filePath);
    const absolutePath = path.isAbsolute(normalizedPath)
      ? normalizedPath
      : path.resolve(this.basePath, normalizedPath);

    // Check for path traversal attempts
    if (!absolutePath.startsWith(this.basePath)) {
      throw new Error(`Path traversal detected: ${filePath}`);
    }

    // Check for null bytes (common attack vector)
    if (filePath.includes('\0')) {
      throw new Error('Invalid path: contains null bytes');
    }

    return absolutePath;
  }

  /**
   * Check if a path is allowed (within base directory)
   */
  isPathAllowed(filePath: string): boolean {
    try {
      this.validatePath(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initialize the storage directories
   */
  async initializeDirectories(): Promise<void> {
    const directories = [
      this.config.baseDir,
      this.config.promptsDir,
      this.config.snippetsDir,
      this.config.personasDir,
      this.config.templatesDir,
      this.config.projectsDir,
      this.config.backupsDir,
    ];

    for (const dir of directories) {
      await this.createDirectory(dir);
    }
  }

  /**
   * Read a file
   */
  async readFile(filePath: string, options?: IReadFileOptions): Promise<string> {
    const validPath = this.validatePath(filePath);
    const encoding = options?.encoding ?? 'utf-8';
    return fs.readFile(validPath, { encoding });
  }

  /**
   * Write a file
   */
  async writeFile(
    filePath: string,
    content: string,
    options?: IWriteFileOptions
  ): Promise<IFileOperationResult> {
    try {
      const validPath = this.validatePath(filePath);
      const encoding = options?.encoding ?? 'utf-8';

      // Create parent directories if requested
      if (options?.createDirectories) {
        const dirPath = path.dirname(validPath);
        await fs.mkdir(dirPath, { recursive: true });
      }

      await fs.writeFile(validPath, content, { encoding });
      return { success: true, path: validPath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        path: filePath,
      };
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(filePath: string): Promise<IFileOperationResult> {
    try {
      const validPath = this.validatePath(filePath);
      await fs.unlink(validPath);
      return { success: true, path: validPath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        path: filePath,
      };
    }
  }

  /**
   * Copy a file
   */
  async copyFile(source: string, destination: string): Promise<IFileOperationResult> {
    try {
      const validSource = this.validatePath(source);
      const validDest = this.validatePath(destination);

      // Create parent directories for destination
      const destDir = path.dirname(validDest);
      await fs.mkdir(destDir, { recursive: true });

      await fs.copyFile(validSource, validDest);
      return { success: true, path: validDest };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Move/rename a file
   */
  async moveFile(source: string, destination: string): Promise<IFileOperationResult> {
    try {
      const validSource = this.validatePath(source);
      const validDest = this.validatePath(destination);

      // Create parent directories for destination
      const destDir = path.dirname(validDest);
      await fs.mkdir(destDir, { recursive: true });

      await fs.rename(validSource, validDest);
      return { success: true, path: validDest };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      const validPath = this.validatePath(filePath);
      const stats = await fs.stat(validPath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(filePath: string): Promise<IFileInfo | null> {
    try {
      const validPath = this.validatePath(filePath);
      const stats = await fs.stat(validPath);
      return {
        path: validPath,
        name: path.basename(validPath),
        extension: path.extname(validPath),
        size: stats.size,
        isDirectory: stats.isDirectory(),
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      };
    } catch {
      return null;
    }
  }

  /**
   * Read a directory
   */
  async readDirectory(dirPath: string): Promise<IDirectoryListing> {
    const validPath = this.validatePath(dirPath);
    const entries = await fs.readdir(validPath, { withFileTypes: true });

    const files: IFileInfo[] = [];
    const directories: IFileInfo[] = [];

    for (const entry of entries) {
      const entryPath = path.join(validPath, entry.name);
      const stats = await fs.stat(entryPath);

      const info: IFileInfo = {
        path: entryPath,
        name: entry.name,
        extension: path.extname(entry.name),
        size: stats.size,
        isDirectory: entry.isDirectory(),
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      };

      if (entry.isDirectory()) {
        directories.push(info);
      } else {
        files.push(info);
      }
    }

    return { path: validPath, files, directories };
  }

  /**
   * Create a directory
   */
  async createDirectory(dirPath: string): Promise<IFileOperationResult> {
    try {
      // For base directory creation, use the path directly
      const validPath = dirPath.startsWith(this.basePath) ? dirPath : this.validatePath(dirPath);

      await fs.mkdir(validPath, { recursive: true });
      return { success: true, path: validPath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        path: dirPath,
      };
    }
  }

  /**
   * Delete a directory
   */
  async deleteDirectory(
    dirPath: string,
    recursive: boolean = false
  ): Promise<IFileOperationResult> {
    try {
      const validPath = this.validatePath(dirPath);
      if (recursive) {
        await fs.rm(validPath, { recursive: true, force: true });
      } else {
        await fs.rmdir(validPath);
      }
      return { success: true, path: validPath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        path: dirPath,
      };
    }
  }

  /**
   * Check if a directory exists
   */
  async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const validPath = this.validatePath(dirPath);
      const stats = await fs.stat(validPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Rename a directory (returns new path)
   */
  async renameDirectory(dirPath: string, newName: string): Promise<string> {
    const validPath = this.validatePath(dirPath);
    const parentDir = path.dirname(validPath);
    const newPath = path.join(parentDir, newName);

    // Validate new path is also within allowed area
    this.validatePath(newPath);

    // Check if target already exists
    const exists = await this.directoryExists(newPath);
    if (exists) {
      throw new Error(`Directory already exists: ${newName}`);
    }

    await fs.rename(validPath, newPath);
    return newPath;
  }

  /**
   * List directory tree recursively
   */
  async listDirectoryTree(dirPath: string): Promise<IDirectoryInfo> {
    const validPath = this.validatePath(dirPath);
    const stats = await fs.stat(validPath);

    if (!stats.isDirectory()) {
      throw new Error(`Not a directory: ${dirPath}`);
    }

    const name = path.basename(validPath);
    const parentPath = path.dirname(validPath);

    const entries = await fs.readdir(validPath, { withFileTypes: true });

    const children: IDirectoryInfo[] = [];
    const files: IFileInfo[] = [];

    for (const entry of entries) {
      const entryPath = path.join(validPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively get child directories
        const childInfo = await this.listDirectoryTree(entryPath);
        children.push(childInfo);
      } else {
        // Get file info
        const fileStats = await fs.stat(entryPath);
        files.push({
          path: entryPath,
          name: entry.name,
          extension: path.extname(entry.name),
          size: fileStats.size,
          isDirectory: false,
          createdAt: fileStats.birthtime,
          modifiedAt: fileStats.mtime,
        });
      }
    }

    // Count prompts (markdown files with .md extension)
    const promptPattern = new RegExp(`${FILE_EXTENSIONS.PROMPT}$`);
    let promptCount = files.filter((f) => promptPattern.test(f.name)).length;

    // Add prompt counts from child directories
    for (const child of children) {
      promptCount += child.promptCount;
    }

    return {
      path: validPath,
      name,
      parentPath: parentPath === validPath ? null : parentPath,
      children,
      files,
      promptCount,
      isEmpty: children.length === 0 && files.length === 0,
    };
  }

  /**
   * Get directory contents count
   */
  async getDirectoryContentsCount(dirPath: string): Promise<IDirectoryContentsCount> {
    const validPath = this.validatePath(dirPath);
    const entries = await fs.readdir(validPath, { withFileTypes: true });

    let files = 0;
    let directories = 0;

    for (const entry of entries) {
      if (entry.isDirectory()) {
        directories++;
        // Recursively count subdirectory contents
        const subPath = path.join(validPath, entry.name);
        const subCount = await this.getDirectoryContentsCount(subPath);
        files += subCount.files;
        directories += subCount.directories;
      } else {
        files++;
      }
    }

    return { files, directories };
  }

  /**
   * Check if a directory is empty
   */
  async isDirectoryEmpty(dirPath: string): Promise<boolean> {
    const validPath = this.validatePath(dirPath);
    const entries = await fs.readdir(validPath);
    return entries.length === 0;
  }

  /**
   * Join path segments safely
   */
  joinPath(...segments: string[]): string {
    return path.join(...segments);
  }

  /**
   * Get file name from path
   */
  getFileName(filePath: string): string {
    return path.basename(filePath);
  }

  /**
   * Get file extension from path
   */
  getFileExtension(filePath: string): string {
    return path.extname(filePath);
  }

  /**
   * Get directory name from path
   */
  getDirectoryName(filePath: string): string {
    return path.dirname(filePath);
  }

  /**
   * List all markdown files in a directory (recursive)
   */
  async listMarkdownFiles(dirPath: string, pattern?: RegExp): Promise<IFileInfo[]> {
    const validPath = this.validatePath(dirPath);
    const result: IFileInfo[] = [];
    const defaultPattern = /\.md$/;
    const filePattern = pattern ?? defaultPattern;

    async function walkDir(currentPath: string, service: FileSystemService): Promise<void> {
      const listing = await service.readDirectory(currentPath);

      for (const file of listing.files) {
        if (filePattern.test(file.name)) {
          result.push(file);
        }
      }

      for (const dir of listing.directories) {
        await walkDir(dir.path, service);
      }
    }

    await walkDir(validPath, this);
    return result;
  }

  /**
   * Create a backup of a file
   */
  async backupFile(filePath: string): Promise<IFileOperationResult> {
    try {
      const validPath = this.validatePath(filePath);
      const fileName = path.basename(validPath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `${fileName}.${timestamp}.bak`;
      const backupPath = path.join(this.config.backupsDir, backupName);

      await this.copyFile(validPath, backupPath);
      return { success: true, path: backupPath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        path: filePath,
      };
    }
  }
}

// Singleton instance
let fileSystemServiceInstance: FileSystemService | null = null;

/**
 * Get the file system service instance
 */
export function getFileSystemService(basePath?: string): FileSystemService {
  if (!fileSystemServiceInstance) {
    fileSystemServiceInstance = new FileSystemService(basePath);
  }
  return fileSystemServiceInstance;
}

/**
 * Reset the service instance (for testing)
 */
export function resetFileSystemService(): void {
  fileSystemServiceInstance = null;
}
