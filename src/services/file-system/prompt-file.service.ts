/**
 * Prompt File Service (Renderer Process)
 *
 * High-level service for managing prompt and snippet files.
 * Uses the IPC bridge to communicate with the main process.
 */

import { getFrontmatterService } from './frontmatter.service';
import type {
  IPromptFile,
  ISnippetFile,
  IPromptMetadata,
  ISnippetMetadata,
  IFileStorageConfig,
  IFileWatcherEvent,
  IWatcherOptions,
  IDirectoryInfo,
  IDirectoryContentsCount,
  FileType,
} from './types';
import { FILE_EXTENSIONS } from './types';

/**
 * Service for managing prompt and snippet files in the renderer process
 */
export class PromptFileService {
  private frontmatterService = getFrontmatterService();
  private fileChangeListeners: Map<string, ((event: IFileWatcherEvent) => void)[]> = new Map();
  private globalCleanup: (() => void) | null = null;

  /**
   * Check if running in Electron environment
   */
  private isElectron(): boolean {
    return typeof window !== 'undefined' && !!window.fileSystemAPI;
  }

  /**
   * Get the file system API (throws if not in Electron)
   */
  private getAPI() {
    if (!this.isElectron()) {
      throw new Error('File system API is only available in Electron environment');
    }
    return window.fileSystemAPI;
  }

  /**
   * Initialize the service and set up file watching
   */
  async initialize(): Promise<void> {
    if (!this.isElectron()) return;

    const api = this.getAPI();
    await api.initializeDirectories();

    // Set up global file change listener
    this.globalCleanup = api.onFileChange((event) => {
      this.handleFileChange(event);
    });
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.globalCleanup) {
      this.globalCleanup();
      this.globalCleanup = null;
    }

    if (this.isElectron()) {
      await this.getAPI().unwatchAll();
    }

    this.fileChangeListeners.clear();
  }

  /**
   * Handle file change events
   */
  private handleFileChange(event: IFileWatcherEvent): void {
    // Notify all registered listeners
    this.fileChangeListeners.forEach((listeners) => {
      listeners.forEach((listener) => listener(event));
    });
  }

  /**
   * Register a file change listener
   */
  onFileChange(id: string, callback: (event: IFileWatcherEvent) => void): () => void {
    const listeners = this.fileChangeListeners.get(id) ?? [];
    listeners.push(callback);
    this.fileChangeListeners.set(id, listeners);

    // Return cleanup function
    return () => {
      const currentListeners = this.fileChangeListeners.get(id) ?? [];
      const index = currentListeners.indexOf(callback);
      if (index > -1) {
        currentListeners.splice(index, 1);
      }
      if (currentListeners.length === 0) {
        this.fileChangeListeners.delete(id);
      } else {
        this.fileChangeListeners.set(id, currentListeners);
      }
    };
  }

  /**
   * Get storage configuration
   */
  async getConfig(): Promise<IFileStorageConfig> {
    return this.getAPI().getConfig();
  }

  /**
   * Get the base storage path
   */
  async getBasePath(): Promise<string> {
    return this.getAPI().getBasePath();
  }

  // ================================
  // Prompt Operations
  // ================================

  /**
   * Load a prompt file
   */
  async loadPrompt(filePath: string): Promise<IPromptFile> {
    if (!this.isElectron()) {
      throw new Error('File system API is only available in Electron environment');
    }
    const api = this.getAPI();
    const content = await api.readFile(filePath);
    return this.frontmatterService.parsePromptFile(content, filePath);
  }

  /**
   * Save a prompt file
   */
  async savePrompt(prompt: IPromptFile): Promise<void> {
    const api = this.getAPI();
    const content = this.frontmatterService.serializePromptFile(prompt);
    const result = await api.writeFile(prompt.filePath, content, { createDirectories: true });
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to save prompt');
    }
  }

  /**
   * Create a new prompt
   */
  async createPrompt(title: string, content: string = '', category?: string): Promise<IPromptFile> {
    const api = this.getAPI();
    const config = await this.getConfig();
    const { metadata, content: promptContent } = this.frontmatterService.createNewPrompt(
      title,
      content
    );

    if (category) {
      metadata.category = category;
    }

    // Generate file name from title
    const fileName = this.sanitizeFileName(title) + FILE_EXTENSIONS.PROMPT;
    const filePath = await api.joinPath(config.promptsDir, fileName);

    const prompt: IPromptFile = {
      metadata,
      content: promptContent,
      filePath,
      fileName,
      fileType: 'prompt',
    };

    await this.savePrompt(prompt);
    return prompt;
  }

  /**
   * Delete a prompt file
   */
  async deletePrompt(filePath: string): Promise<void> {
    const api = this.getAPI();
    const result = await api.deleteFile(filePath);
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to delete prompt');
    }
  }

  /**
   * List all prompts
   */
  async listPrompts(): Promise<IPromptFile[]> {
    if (!this.isElectron()) return [];
    const api = this.getAPI();
    const config = await this.getConfig();

    // Check if directory exists
    const exists = await api.directoryExists(config.promptsDir);
    if (!exists) {
      return [];
    }

    const files = await api.listMarkdownFiles(config.promptsDir, '\\.md$');
    const prompts: IPromptFile[] = [];

    for (const file of files) {
      // Skip snippet files
      if (
        file.name.includes('.snippet.') ||
        file.name.includes('.persona.') ||
        file.name.includes('.template.')
      ) {
        continue;
      }

      try {
        const prompt = await this.loadPrompt(file.path);
        prompts.push(prompt);
      } catch (error) {
        console.warn(`Failed to load prompt: ${file.path}`, error);
      }
    }

    return prompts;
  }

  /**
   * Update prompt metadata
   */
  async updatePromptMetadata(
    filePath: string,
    updates: Partial<IPromptMetadata>
  ): Promise<IPromptFile> {
    const prompt = await this.loadPrompt(filePath);
    prompt.metadata = {
      ...prompt.metadata,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.savePrompt(prompt);
    return prompt;
  }

  /**
   * Rename a prompt file
   */
  async renamePrompt(filePath: string, newTitle: string): Promise<IPromptFile> {
    const api = this.getAPI();
    const config = await this.getConfig();

    // Load the current prompt
    const prompt = await this.loadPrompt(filePath);

    // Generate new file name from new title
    const newFileName = this.sanitizeFileName(newTitle) + FILE_EXTENSIONS.PROMPT;
    const newFilePath = await api.joinPath(config.promptsDir, newFileName);

    // Check if new path is different from current
    if (newFilePath === filePath) {
      // Just update the title in metadata if file name is the same
      prompt.metadata.title = newTitle;
      prompt.metadata.updatedAt = new Date().toISOString();
      await this.savePrompt(prompt);
      return prompt;
    }

    // Check if target file already exists
    const exists = await api.fileExists(newFilePath);
    if (exists) {
      throw new Error(`A prompt with the name "${newFileName}" already exists`);
    }

    // Move the file to new location
    const moveResult = await api.moveFile(filePath, newFilePath);
    if (!moveResult.success) {
      throw new Error(moveResult.error ?? 'Failed to rename prompt file');
    }

    // Update the prompt object with new path and title
    const renamedPrompt: IPromptFile = {
      ...prompt,
      filePath: newFilePath,
      fileName: newFileName,
      metadata: {
        ...prompt.metadata,
        title: newTitle,
        updatedAt: new Date().toISOString(),
      },
    };

    // Save with updated metadata
    await this.savePrompt(renamedPrompt);

    return renamedPrompt;
  }

  // ================================
  // Snippet Operations
  // ================================

  /**
   * Load a snippet file
   */
  async loadSnippet(filePath: string): Promise<ISnippetFile> {
    const api = this.getAPI();
    const content = await api.readFile(filePath);
    return this.frontmatterService.parseSnippetFile(content, filePath);
  }

  /**
   * Save a snippet file
   */
  async saveSnippet(snippet: ISnippetFile): Promise<void> {
    const api = this.getAPI();
    const content = this.frontmatterService.serializeSnippetFile(snippet);
    const result = await api.writeFile(snippet.filePath, content, { createDirectories: true });
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to save snippet');
    }
  }

  /**
   * Create a new snippet
   */
  async createSnippet(
    name: string,
    type: ISnippetMetadata['type'] = 'text',
    content: string = '',
    tags: string[] = [],
    description?: string
  ): Promise<ISnippetFile> {
    const api = this.getAPI();
    const config = await this.getConfig();
    const { metadata, content: snippetContent } = this.frontmatterService.createNewSnippet(
      name,
      type,
      content,
      tags,
      description
    );

    // Determine directory based on type
    let directory = config.snippetsDir;
    let extension: string = FILE_EXTENSIONS.SNIPPET;

    if (type === 'persona') {
      directory = config.personasDir;
      extension = FILE_EXTENSIONS.PERSONA;
    } else if (type === 'template') {
      directory = config.templatesDir;
      extension = FILE_EXTENSIONS.TEMPLATE;
    }

    // Generate file name from name
    const fileName = this.sanitizeFileName(name) + extension;
    const filePath = await api.joinPath(directory, fileName);

    const snippet: ISnippetFile = {
      metadata,
      content: snippetContent,
      filePath,
      fileName,
      fileType: 'snippet',
    };

    await this.saveSnippet(snippet);
    return snippet;
  }

  /**
   * Delete a snippet file
   */
  async deleteSnippet(filePath: string): Promise<void> {
    const api = this.getAPI();
    const result = await api.deleteFile(filePath);
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to delete snippet');
    }
  }

  /**
   * Rename a snippet file
   */
  async renameSnippet(filePath: string, newName: string): Promise<ISnippetFile> {
    const api = this.getAPI();
    const config = await this.getConfig();

    // Load the current snippet
    const snippet = await this.loadSnippet(filePath);
    const type = snippet.metadata.type;

    // Determine directory and extension based on type
    let directory = config.snippetsDir;
    let extension: string = FILE_EXTENSIONS.SNIPPET;

    if (type === 'persona') {
      directory = config.personasDir;
      extension = FILE_EXTENSIONS.PERSONA;
    } else if (type === 'template') {
      directory = config.templatesDir;
      extension = FILE_EXTENSIONS.TEMPLATE;
    }

    // Generate new file name
    const newFileName = this.sanitizeFileName(newName) + extension;
    const newFilePath = await api.joinPath(directory, newFileName);

    // Check if new path is different from current
    if (newFilePath === filePath) {
      // Just update the name in metadata if file name is the same
      snippet.metadata.name = newName;
      snippet.metadata.updatedAt = new Date().toISOString();
      await this.saveSnippet(snippet);
      return snippet;
    }

    // Check if target file already exists
    const exists = await api.fileExists(newFilePath);
    if (exists) {
      throw new Error(`A snippet with the name "${newFileName}" already exists`);
    }

    // Move the file to new location
    const moveResult = await api.moveFile(filePath, newFilePath);
    if (!moveResult.success) {
      throw new Error(moveResult.error ?? 'Failed to rename snippet file');
    }

    // Update the snippet object with new path and name
    const renamedSnippet: ISnippetFile = {
      ...snippet,
      filePath: newFilePath,
      fileName: newFileName,
      metadata: {
        ...snippet.metadata,
        name: newName,
        updatedAt: new Date().toISOString(),
      },
    };

    // Save with updated metadata
    await this.saveSnippet(renamedSnippet);

    return renamedSnippet;
  }

  /**
   * List all snippets (including personas and templates)
   */
  async listSnippets(type?: ISnippetMetadata['type']): Promise<ISnippetFile[]> {
    if (!this.isElectron()) return [];
    const api = this.getAPI();
    const config = await this.getConfig();
    const snippets: ISnippetFile[] = [];

    // Directories to search based on type
    const directories: string[] = [];
    if (!type || type === 'code' || type === 'text') {
      directories.push(config.snippetsDir);
    }
    if (!type || type === 'persona') {
      directories.push(config.personasDir);
    }
    if (!type || type === 'template') {
      directories.push(config.templatesDir);
    }

    for (const dir of directories) {
      const exists = await api.directoryExists(dir);
      if (!exists) continue;

      const files = await api.listMarkdownFiles(dir, '\\.md$');

      for (const file of files) {
        try {
          const snippet = await this.loadSnippet(file.path);
          if (!type || snippet.metadata.type === type) {
            snippets.push(snippet);
          }
        } catch (error) {
          console.warn(`Failed to load snippet: ${file.path}`, error);
        }
      }
    }

    return snippets;
  }

  /**
   * Find snippet by shortcut
   */
  async findSnippetByShortcut(shortcut: string): Promise<ISnippetFile | null> {
    const snippets = await this.listSnippets();
    return snippets.find((s) => s.metadata.shortcut === shortcut) ?? null;
  }

  // ================================
  // File Watching
  // ================================

  /**
   * Start watching a directory for changes
   */
  async watchDirectory(dirPath: string, options?: IWatcherOptions): Promise<string> {
    const api = this.getAPI();
    return api.watchPath(dirPath, options);
  }

  /**
   * Stop watching a directory
   */
  async unwatchDirectory(watcherId: string): Promise<void> {
    const api = this.getAPI();
    await api.unwatchPath(watcherId);
  }

  /**
   * Watch all prompt/snippet directories
   */
  async watchAllDirectories(): Promise<string[]> {
    const config = await this.getConfig();
    const watcherIds: string[] = [];

    const directories = [
      config.promptsDir,
      config.snippetsDir,
      config.personasDir,
      config.templatesDir,
    ];

    for (const dir of directories) {
      const api = this.getAPI();
      const exists = await api.directoryExists(dir);
      if (exists) {
        const watcherId = await this.watchDirectory(dir, {
          ignoreInitial: true,
          awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
        });
        watcherIds.push(watcherId);
      }
    }

    return watcherIds;
  }

  // ================================
  // Directory Operations
  // ================================

  /**
   * Create a directory inside the prompts folder
   */
  async createProjectDirectory(name: string): Promise<string> {
    const api = this.getAPI();
    const config = await this.getConfig();
    const dirPath = await api.joinPath(config.promptsDir, name);

    // Check if directory already exists
    const exists = await api.directoryExists(dirPath);
    if (exists) {
      throw new Error(`Directory already exists: ${name}`);
    }

    const result = await api.createDirectory(dirPath);
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to create directory');
    }

    return dirPath;
  }

  /**
   * Create a nested directory
   */
  async createNestedDirectory(parentPath: string, name: string): Promise<string> {
    const api = this.getAPI();
    const dirPath = await api.joinPath(parentPath, name);

    // Check if directory already exists
    const exists = await api.directoryExists(dirPath);
    if (exists) {
      throw new Error(`Directory already exists: ${name}`);
    }

    const result = await api.createDirectory(dirPath);
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to create directory');
    }

    return dirPath;
  }

  /**
   * Rename a directory
   */
  async renameDirectory(dirPath: string, newName: string): Promise<string> {
    const api = this.getAPI();
    return api.renameDirectory(dirPath, newName);
  }

  /**
   * Delete a directory
   */
  async deleteDirectory(dirPath: string, recursive: boolean = false): Promise<void> {
    const api = this.getAPI();
    const result = await api.deleteDirectory(dirPath, recursive);
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to delete directory');
    }
  }

  /**
   * Get directory tree for a path
   */
  async getDirectoryTree(dirPath: string): Promise<IDirectoryInfo> {
    const api = this.getAPI();
    return api.listDirectoryTree(dirPath);
  }

  /**
   * Get directory contents count
   */
  async getDirectoryContentsCount(dirPath: string): Promise<IDirectoryContentsCount> {
    const api = this.getAPI();
    return api.getDirectoryContentsCount(dirPath);
  }

  /**
   * Check if a directory is empty
   */
  async isDirectoryEmpty(dirPath: string): Promise<boolean> {
    const api = this.getAPI();
    return api.isDirectoryEmpty(dirPath);
  }

  /**
   * Check if a directory exists
   */
  async directoryExists(dirPath: string): Promise<boolean> {
    const api = this.getAPI();
    return api.directoryExists(dirPath);
  }

  /**
   * Move a prompt to a different directory
   */
  async movePromptToDirectory(
    filePath: string,
    targetDir: string,
    overwrite: boolean = false
  ): Promise<IPromptFile> {
    const api = this.getAPI();

    // Load the current prompt
    const prompt = await this.loadPrompt(filePath);

    // Calculate new path
    const newFilePath = await api.joinPath(targetDir, prompt.fileName);

    // Check if target already exists
    const exists = await api.fileExists(newFilePath);
    if (exists) {
      if (!overwrite) {
        // Throw a specific error that can be caught to show confirmation dialog
        const error = new Error(
          `A file with the name "${prompt.fileName}" already exists in the target directory`
        ) as Error & { code: string; existingPath: string };
        error.code = 'FILE_EXISTS';
        error.existingPath = newFilePath;
        throw error;
      }

      // Delete the existing file before moving
      await api.deleteFile(newFilePath);
    }

    // Move the file
    const moveResult = await api.moveFile(filePath, newFilePath);
    if (!moveResult.success) {
      throw new Error(moveResult.error ?? 'Failed to move prompt');
    }

    // Update and return the prompt object with new path
    const movedPrompt: IPromptFile = {
      ...prompt,
      filePath: newFilePath,
    };

    return movedPrompt;
  }

  /**
   * Create a prompt in a specific directory
   */
  async createPromptInDirectory(
    dirPath: string,
    title: string,
    content: string = ''
  ): Promise<IPromptFile> {
    const api = this.getAPI();
    const { metadata, content: promptContent } = this.frontmatterService.createNewPrompt(
      title,
      content
    );

    // Generate file name from title
    const fileName = this.sanitizeFileName(title) + FILE_EXTENSIONS.PROMPT;
    const filePath = await api.joinPath(dirPath, fileName);

    // Check if file already exists
    const exists = await api.fileExists(filePath);
    if (exists) {
      throw new Error(`A prompt with the name "${fileName}" already exists`);
    }

    const prompt: IPromptFile = {
      metadata,
      content: promptContent,
      filePath,
      fileName,
      fileType: 'prompt',
    };

    await this.savePrompt(prompt);
    return prompt;
  }

  /**
   * Get prompts directory path
   */
  async getPromptsDir(): Promise<string> {
    const config = await this.getConfig();
    return config.promptsDir;
  }

  // ================================
  // Backup Operations
  // ================================

  /**
   * Create a backup of a file
   */
  async backupFile(filePath: string): Promise<string> {
    const api = this.getAPI();
    const result = await api.backupFile(filePath);
    if (!result.success || !result.path) {
      throw new Error(result.error ?? 'Failed to create backup');
    }
    return result.path;
  }

  // ================================
  // Utility Methods
  // ================================

  /**
   * Sanitize a string for use as a file name
   */
  private sanitizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);
  }

  /**
   * Determine file type from path
   */
  getFileType(filePath: string): FileType {
    const lowerPath = filePath.toLowerCase();
    if (lowerPath.endsWith('.persona.md')) return 'persona';
    if (lowerPath.endsWith('.template.md')) return 'template';
    if (lowerPath.endsWith('.snippet.md')) return 'snippet';
    return 'prompt';
  }

  /**
   * Check if a file is a prompt file
   */
  isPromptFile(filePath: string): boolean {
    return this.getFileType(filePath) === 'prompt';
  }

  /**
   * Check if a file is a snippet file (including personas and templates)
   */
  isSnippetFile(filePath: string): boolean {
    const type = this.getFileType(filePath);
    return type === 'snippet' || type === 'persona' || type === 'template';
  }
}

// Singleton instance
let promptFileServiceInstance: PromptFileService | null = null;

/**
 * Get the prompt file service instance
 */
export function getPromptFileService(): PromptFileService {
  if (!promptFileServiceInstance) {
    promptFileServiceInstance = new PromptFileService();
  }
  return promptFileServiceInstance;
}

/**
 * Reset the service instance (for testing)
 */
export async function resetPromptFileService(): Promise<void> {
  if (promptFileServiceInstance) {
    await promptFileServiceInstance.cleanup();
  }
  promptFileServiceInstance = null;
}
