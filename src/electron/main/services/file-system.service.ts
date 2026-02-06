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
   * Read a file as base64 data URL (for images and binary files)
   */
  async readFileAsDataUrl(filePath: string, mimeType?: string): Promise<string> {
    const validPath = this.validatePath(filePath);
    const buffer = await fs.readFile(validPath);
    const base64 = buffer.toString('base64');

    // Determine MIME type from extension if not provided
    const ext = path.extname(validPath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
      '.ico': 'image/x-icon',
      '.tiff': 'image/tiff',
      '.tif': 'image/tiff',
    };
    const mime = mimeType ?? mimeMap[ext] ?? 'application/octet-stream';

    return `data:${mime};base64,${base64}`;
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
   * Export a file to a user-selected absolute path outside the base directory.
   * This method bypasses the normal path traversal check since the path is
   * explicitly chosen by the user via the system file dialog.
   * Only use this for export operations where the user has selected the destination.
   */
  async exportFile(
    absolutePath: string,
    content: string,
    options?: IWriteFileOptions
  ): Promise<IFileOperationResult> {
    try {
      // Basic security checks - no null bytes allowed
      if (absolutePath.includes('\0')) {
        throw new Error('Invalid path: contains null bytes');
      }

      // Ensure it's an absolute path
      if (!path.isAbsolute(absolutePath)) {
        throw new Error('Export path must be absolute');
      }

      const normalizedPath = path.normalize(absolutePath);
      const encoding = options?.encoding ?? 'utf-8';

      // Create parent directories if requested
      if (options?.createDirectories) {
        const dirPath = path.dirname(normalizedPath);
        await fs.mkdir(dirPath, { recursive: true });
      }

      await fs.writeFile(normalizedPath, content, { encoding });
      return { success: true, path: normalizedPath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        path: absolutePath,
      };
    }
  }

  /**
   * Write binary file content to a directory (for drag-and-drop without file path)
   * @param destDir - Destination directory path
   * @param fileName - Name of the file to create
   * @param content - Binary content as Uint8Array
   * @returns New file path or error
   */
  async writeBinaryFileToDirectory(
    destDir: string,
    fileName: string,
    content: Uint8Array
  ): Promise<{ success: boolean; newPath?: string; error?: string }> {
    try {
      const validDestDir = this.validatePath(destDir);

      // Validate destination is a directory
      const destStats = await fs.stat(validDestDir);
      if (!destStats.isDirectory()) {
        return { success: false, error: 'Destination is not a directory' };
      }

      // Get unique file name
      const uniqueName = await this.getUniqueFileName(validDestDir, fileName);
      const destPath = path.join(validDestDir, uniqueName);

      // Write the file
      await fs.writeFile(destPath, Buffer.from(content));

      return { success: true, newPath: destPath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
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
   * Generate a unique file name by appending (1), (2), etc. if needed
   */
  private async getUniqueFileName(destDir: string, fileName: string): Promise<string> {
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    let newName = fileName;

    for (let counter = 1; counter <= 1000; counter++) {
      const fullPath = path.join(destDir, newName);
      try {
        await fs.access(fullPath);
        // File exists, try next number
        newName = `${baseName} (${counter})${ext}`;
      } catch {
        // File doesn't exist, use this name
        return newName;
      }
    }
    // Fallback after 1000 attempts
    return `${baseName} (${Date.now()})${ext}`;
  }

  /**
   * Generate a unique directory name by appending (1), (2), etc. if needed
   */
  private async getUniqueDirName(destDir: string, dirName: string): Promise<string> {
    let newName = dirName;

    for (let counter = 1; counter <= 1000; counter++) {
      const fullPath = path.join(destDir, newName);
      try {
        await fs.access(fullPath);
        // Directory exists, try next number
        newName = `${dirName} (${counter})`;
      } catch {
        // Directory doesn't exist, use this name
        return newName;
      }
    }
    // Fallback after 1000 attempts
    return `${dirName} (${Date.now()})`;
  }

  /**
   * Copy a file to a destination directory (with automatic name collision handling)
   * @param sourcePath - Full path to source file
   * @param destDir - Destination directory path
   * @returns New file path or error
   */
  async copyFileToDirectory(
    sourcePath: string,
    destDir: string
  ): Promise<{ success: boolean; newPath?: string; error?: string }> {
    try {
      // Validate source exists and is a file
      const sourceStats = await fs.stat(sourcePath);
      if (!sourceStats.isFile()) {
        return { success: false, error: 'Source is not a file' };
      }

      // Validate destination is a directory
      const destStats = await fs.stat(destDir);
      if (!destStats.isDirectory()) {
        return { success: false, error: 'Destination is not a directory' };
      }

      // Get unique file name
      const originalName = path.basename(sourcePath);
      const uniqueName = await this.getUniqueFileName(destDir, originalName);
      const destPath = path.join(destDir, uniqueName);

      // Copy the file
      await fs.copyFile(sourcePath, destPath);

      return { success: true, newPath: destPath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Copy a directory recursively to a destination (with automatic name collision handling)
   * @param sourcePath - Full path to source directory
   * @param destDir - Destination parent directory
   * @returns New directory path or error
   */
  async copyDirectoryToDirectory(
    sourcePath: string,
    destDir: string
  ): Promise<{ success: boolean; newPath?: string; error?: string }> {
    try {
      // Validate source exists and is a directory
      const sourceStats = await fs.stat(sourcePath);
      if (!sourceStats.isDirectory()) {
        return { success: false, error: 'Source is not a directory' };
      }

      // Validate destination is a directory
      const destStats = await fs.stat(destDir);
      if (!destStats.isDirectory()) {
        return { success: false, error: 'Destination is not a directory' };
      }

      // Get unique directory name
      const originalName = path.basename(sourcePath);
      const uniqueName = await this.getUniqueDirName(destDir, originalName);
      const destPath = path.join(destDir, uniqueName);

      // Copy the directory recursively (Node.js 16.7+)
      await fs.cp(sourcePath, destPath, { recursive: true });

      return { success: true, newPath: destPath };
    } catch (error) {
      console.error('Failed to copy directory:', error);
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
   * Get file information for external paths (no path validation)
   * Used for drag-and-drop from external file managers
   */
  async getExternalFileInfo(filePath: string): Promise<IFileInfo | null> {
    try {
      const normalizedPath = path.normalize(filePath);
      const stats = await fs.stat(normalizedPath);
      return {
        path: normalizedPath,
        name: path.basename(normalizedPath),
        extension: path.extname(normalizedPath),
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
      console.log(`[deleteDirectory] Deleting: ${validPath}, recursive: ${recursive}`);

      // Helper to check if path exists
      const checkExists = async (p: string): Promise<boolean> => {
        try {
          await fs.access(p);
          return true;
        } catch {
          return false;
        }
      };

      // Check if directory exists before deletion
      const existsBefore = await checkExists(validPath);
      console.log(`[deleteDirectory] Exists before: ${existsBefore}`);

      if (recursive) {
        await fs.rm(validPath, { recursive: true, force: true });
      } else {
        await fs.rmdir(validPath);
      }

      // Check if directory still exists after deletion
      const existsAfter = await checkExists(validPath);
      console.log(`[deleteDirectory] Exists after: ${existsAfter}`);

      if (existsAfter) {
        console.error(`[deleteDirectory] Directory still exists after deletion!`);
        // List what's in the directory
        try {
          const contents = await fs.readdir(validPath);
          console.log(`[deleteDirectory] Directory contents:`, contents);
        } catch (e) {
          console.log(`[deleteDirectory] Could not read directory:`, e);
        }
        // Try one more time with a slight delay
        await new Promise((resolve) => setTimeout(resolve, 100));
        await fs.rm(validPath, { recursive: true, force: true });
        const existsFinal = await checkExists(validPath);
        console.log(`[deleteDirectory] Exists after retry: ${existsFinal}`);
      }

      return { success: true, path: validPath };
    } catch (error) {
      console.error(`[deleteDirectory] Error:`, error);
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
      // Skip hidden directories and files like .git
      if (entry.name.startsWith('.')) {
        continue;
      }

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
   * List all files in a directory recursively (flat list)
   * Returns IFileInfo array for all files found
   */
  async listFilesRecursive(dirPath: string): Promise<IFileInfo[]> {
    const validPath = this.validatePath(dirPath);
    const results: IFileInfo[] = [];

    const processDirectory = async (currentPath: string): Promise<void> => {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const entryPath = path.join(currentPath, entry.name);

          if (entry.isDirectory()) {
            // Recursively process subdirectories
            await processDirectory(entryPath);
          } else {
            // Get file stats and add to results
            try {
              const stats = await fs.stat(entryPath);
              results.push({
                path: entryPath,
                name: entry.name,
                extension: path.extname(entry.name),
                size: stats.size,
                isDirectory: false,
                createdAt: stats.birthtime,
                modifiedAt: stats.mtime,
              });
            } catch {
              // Skip files we can't stat
            }
          }
        }
      } catch {
        // Skip directories we can't read
      }
    };

    await processDirectory(validPath);
    return results;
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
