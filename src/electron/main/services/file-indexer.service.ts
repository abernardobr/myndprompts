/**
 * File Indexer Service (Main Process)
 *
 * Crawls directories and extracts file metadata while respecting
 * language-specific ignore patterns. Used for the File Sync feature.
 */

import * as fs from 'fs/promises';
import type { Dirent } from 'fs';
import * as path from 'path';
import picomatch from 'picomatch';

/**
 * Indexed file metadata
 */
export interface IIndexedFile {
  fileName: string;
  normalizedName: string;
  fullPath: string;
  relativePath: string;
  extension: string;
  size: number;
  modifiedAt: Date;
}

/**
 * Indexing progress information
 */
export interface IIndexProgress {
  phase: 'scanning' | 'indexing' | 'complete' | 'cancelled' | 'error';
  current: number;
  total: number;
  currentFile?: string;
  error?: string;
}

/**
 * Language/framework ignore patterns
 */
interface IIgnorePatterns {
  common: string[];
  javascript: string[];
  python: string[];
  java: string[];
  go: string[];
  rust: string[];
  cpp: string[];
  dotnet: string[];
  ruby: string[];
  php: string[];
  [key: string]: string[];
}

/**
 * Project type markers - files that indicate a project type
 */
interface IProjectMarkers {
  [key: string]: string[];
}

/**
 * Service for indexing directories and extracting file metadata
 */
export class FileIndexerService {
  private static instance: FileIndexerService | null = null;
  private abortControllers: Map<string, AbortController> = new Map();

  /**
   * Ignore patterns by project type
   */
  private readonly IGNORE_PATTERNS: IIgnorePatterns = {
    // Always ignored
    common: [
      '**/node_modules/**',
      '**/.git/**',
      '**/.svn/**',
      '**/.hg/**',
      '**/CVS/**',
      '**/.DS_Store',
      '**/Thumbs.db',
      '**/*.log',
      '**/.env*',
      '**/dist/**',
      '**/build/**',
      '**/out/**',
      '**/.cache/**',
      '**/coverage/**',
      '**/.nyc_output/**',
      '**/*.min.js',
      '**/*.min.css',
      '**/*.map',
      '**/.idea/**',
      '**/.vscode/**',
    ],

    // JavaScript/TypeScript
    javascript: [
      '**/bower_components/**',
      '**/.npm/**',
      '**/.yarn/**',
      '**/jspm_packages/**',
      '**/.pnp.*',
      '**/.next/**',
      '**/.nuxt/**',
    ],

    // Python
    python: [
      '**/__pycache__/**',
      '**/*.pyc',
      '**/*.pyo',
      '**/*.pyd',
      '**/.Python/**',
      '**/env/**',
      '**/venv/**',
      '**/.venv/**',
      '**/pip-wheel-metadata/**',
      '**/*.egg-info/**',
      '**/.eggs/**',
      '**/.mypy_cache/**',
      '**/.pytest_cache/**',
      '**/.tox/**',
    ],

    // Java/Kotlin
    java: [
      '**/target/**',
      '**/*.class',
      '**/*.jar',
      '**/*.war',
      '**/*.ear',
      '**/.gradle/**',
      '**/gradle/**',
      '**/*.iml',
    ],

    // Go
    go: ['**/vendor/**', '**/*.exe', '**/*.dll', '**/*.so', '**/*.dylib'],

    // Rust
    rust: ['**/target/**', '**/*.rlib', '**/*.rmeta'],

    // C/C++
    cpp: [
      '**/*.o',
      '**/*.obj',
      '**/*.a',
      '**/*.lib',
      '**/*.dll',
      '**/*.so',
      '**/*.dylib',
      '**/cmake-build-*/**',
      '**/.cmake/**',
    ],

    // .NET
    dotnet: [
      '**/bin/**',
      '**/obj/**',
      '**/*.dll',
      '**/*.exe',
      '**/*.pdb',
      '**/packages/**',
      '**/.vs/**',
    ],

    // Ruby
    ruby: ['**/vendor/bundle/**', '**/.bundle/**', '**/*.gem'],

    // PHP
    php: ['**/vendor/**', '**/composer.phar'],
  };

  /**
   * Marker files that indicate project types
   */
  private readonly PROJECT_MARKERS: IProjectMarkers = {
    javascript: ['package.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb'],
    python: ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'],
    java: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    go: ['go.mod'],
    rust: ['Cargo.toml'],
    cpp: ['CMakeLists.txt', 'Makefile'],
    dotnet: ['*.csproj', '*.sln'],
    ruby: ['Gemfile'],
    php: ['composer.json'],
  };

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): FileIndexerService {
    if (!FileIndexerService.instance) {
      FileIndexerService.instance = new FileIndexerService();
    }
    return FileIndexerService.instance;
  }

  /**
   * Detect project type by checking for marker files
   */
  private async detectProjectType(folderPath: string): Promise<string[]> {
    const types: string[] = [];

    for (const [projectType, markers] of Object.entries(this.PROJECT_MARKERS)) {
      for (const marker of markers) {
        try {
          // Handle glob patterns like *.csproj
          if (marker.includes('*')) {
            const files = await fs.readdir(folderPath);
            const pattern = picomatch(marker);
            if (files.some((file) => pattern(file))) {
              types.push(projectType);
              break;
            }
          } else {
            // Check for exact file match
            await fs.access(path.join(folderPath, marker));
            types.push(projectType);
            break;
          }
        } catch {
          // File doesn't exist, continue checking
        }
      }
    }

    return types;
  }

  /**
   * Build ignore patterns combining common + detected types
   */
  private buildIgnorePatterns(projectTypes: string[]): picomatch.Matcher {
    const patterns = [...this.IGNORE_PATTERNS.common];

    for (const type of projectTypes) {
      const typePatterns = this.IGNORE_PATTERNS[type];
      if (typePatterns) {
        patterns.push(...typePatterns);
      }
    }

    return picomatch(patterns, { dot: true });
  }

  /**
   * Normalize file name for search (remove diacritics, lowercase)
   */
  private normalizeFileName(fileName: string): string {
    return fileName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  /**
   * Main indexing method
   */
  async indexDirectory(
    folderPath: string,
    operationId: string,
    onProgress?: (progress: IIndexProgress) => void
  ): Promise<IIndexedFile[]> {
    const abortController = new AbortController();
    this.abortControllers.set(operationId, abortController);

    try {
      // Notify scanning phase
      onProgress?.({ phase: 'scanning', current: 0, total: 0 });

      // Detect project types
      const projectTypes = await this.detectProjectType(folderPath);
      const isIgnored = this.buildIgnorePatterns(projectTypes);

      const files: IIndexedFile[] = [];

      // Crawl the directory
      await this.crawlDirectory(
        folderPath,
        folderPath,
        isIgnored,
        files,
        abortController.signal,
        onProgress
      );

      // Notify completion
      onProgress?.({ phase: 'complete', current: files.length, total: files.length });

      return files;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        onProgress?.({ phase: 'cancelled', current: 0, total: 0 });
        return [];
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      onProgress?.({ phase: 'error', current: 0, total: 0, error: errorMessage });
      throw error;
    } finally {
      this.abortControllers.delete(operationId);
    }
  }

  /**
   * Recursive directory crawl
   */
  private async crawlDirectory(
    currentPath: string,
    rootPath: string,
    isIgnored: picomatch.Matcher,
    results: IIndexedFile[],
    signal: AbortSignal,
    onProgress?: (progress: IIndexProgress) => void
  ): Promise<void> {
    // Check for abort
    if (signal.aborted) {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      throw error;
    }

    let entries: Dirent[];

    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true, encoding: 'utf-8' });
    } catch (error) {
      // Skip directories we can't read (permissions, etc.)
      console.warn(`Cannot read directory ${currentPath}:`, error);
      return;
    }

    for (const entry of entries) {
      // Check for abort
      if (signal.aborted) {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        throw error;
      }

      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(rootPath, fullPath);

      // Check if should be ignored
      if (isIgnored(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        // Recursively crawl subdirectories
        await this.crawlDirectory(fullPath, rootPath, isIgnored, results, signal, onProgress);
      } else if (entry.isFile()) {
        try {
          const stats = await fs.stat(fullPath);

          results.push({
            fileName: entry.name,
            normalizedName: this.normalizeFileName(entry.name),
            fullPath,
            relativePath,
            extension: path.extname(entry.name).toLowerCase(),
            size: stats.size,
            modifiedAt: stats.mtime,
          });

          // Report progress
          onProgress?.({
            phase: 'indexing',
            current: results.length,
            total: -1, // Unknown total during crawl
            currentFile: relativePath,
          });
        } catch {
          // Skip files we can't stat (permissions, broken symlinks, etc.)
        }
      }
    }
  }

  /**
   * Cancel an indexing operation
   */
  cancelIndexing(operationId: string): boolean {
    const controller = this.abortControllers.get(operationId);
    if (controller) {
      controller.abort();
      return true;
    }
    return false;
  }

  /**
   * Check if an operation is currently running
   */
  isIndexing(operationId: string): boolean {
    return this.abortControllers.has(operationId);
  }

  /**
   * Get all active operation IDs
   */
  getActiveOperations(): string[] {
    return Array.from(this.abortControllers.keys());
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    // Cancel all active operations
    if (FileIndexerService.instance) {
      for (const controller of FileIndexerService.instance.abortControllers.values()) {
        controller.abort();
      }
      FileIndexerService.instance.abortControllers.clear();
    }
    FileIndexerService.instance = null;
  }
}

// Singleton getter function
export function getFileIndexerService(): FileIndexerService {
  return FileIndexerService.getInstance();
}
