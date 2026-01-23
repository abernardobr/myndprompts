/**
 * Frontmatter Service
 *
 * Handles parsing and serializing YAML frontmatter in Markdown files.
 * Uses gray-matter for robust YAML parsing.
 */

// Polyfill Buffer for browser/renderer environment (required by gray-matter)
import { Buffer } from 'buffer';
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}

import matter from 'gray-matter';
import { v4 as uuidv4 } from 'uuid';
import type { IPromptMetadata, ISnippetMetadata, IPromptFile, ISnippetFile } from './types';

/**
 * Service for parsing and serializing YAML frontmatter
 */
export class FrontmatterService {
  /**
   * Parse a file with frontmatter into metadata and content
   */
  parse<T = Record<string, unknown>>(fileContent: string): { metadata: T; content: string } {
    const parsed = matter(fileContent);
    return {
      metadata: parsed.data as T,
      content: parsed.content.trim(),
    };
  }

  /**
   * Remove undefined values from an object (YAML can't serialize undefined)
   */
  private stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
    const result: Partial<T> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        result[key as keyof T] = value as T[keyof T];
      }
    }
    return result;
  }

  /**
   * Serialize metadata and content back to a file with frontmatter
   */
  serialize<T = Record<string, unknown>>(metadata: T, content: string): string {
    // Strip undefined values before serializing (YAML doesn't handle undefined)
    const cleanMetadata = this.stripUndefined(metadata as Record<string, unknown>);
    return matter.stringify(content, cleanMetadata);
  }

  /**
   * Parse a prompt file
   */
  parsePromptFile(fileContent: string, filePath: string): IPromptFile {
    const { metadata, content } = this.parse<Partial<IPromptMetadata>>(fileContent);
    const now = new Date().toISOString();

    // Ensure required fields have defaults
    const completeMetadata: IPromptMetadata = {
      id: metadata.id ?? uuidv4(),
      title: metadata.title ?? this.extractTitleFromPath(filePath),
      description: metadata.description,
      category: metadata.category,
      tags: metadata.tags ?? [],
      aiProvider: metadata.aiProvider,
      isFavorite: metadata.isFavorite ?? false,
      isPinned: metadata.isPinned ?? false,
      createdAt: metadata.createdAt ?? now,
      updatedAt: metadata.updatedAt ?? now,
      version: metadata.version ?? 1,
    };

    return {
      metadata: completeMetadata,
      content,
      filePath,
      fileName: this.extractFileName(filePath),
      fileType: 'prompt',
    };
  }

  /**
   * Parse a snippet file
   */
  parseSnippetFile(fileContent: string, filePath: string): ISnippetFile {
    const { metadata, content } = this.parse<Partial<ISnippetMetadata>>(fileContent);
    const now = new Date().toISOString();

    // Ensure required fields have defaults
    const completeMetadata: ISnippetMetadata = {
      id: metadata.id ?? uuidv4(),
      name: metadata.name ?? this.extractNameFromPath(filePath),
      type: metadata.type ?? 'text',
      shortcut:
        metadata.shortcut ??
        `@${this.extractNameFromPath(filePath).toLowerCase().replace(/\s+/g, '-')}`,
      description: metadata.description,
      tags: metadata.tags ?? [],
      language: metadata.language,
      createdAt: metadata.createdAt ?? now,
      updatedAt: metadata.updatedAt ?? now,
    };

    return {
      metadata: completeMetadata,
      content,
      filePath,
      fileName: this.extractFileName(filePath),
      fileType: 'snippet',
    };
  }

  /**
   * Serialize a prompt file to string
   */
  serializePromptFile(prompt: IPromptFile): string {
    const metadata: IPromptMetadata = {
      ...prompt.metadata,
      updatedAt: new Date().toISOString(),
    };
    return this.serialize(metadata, prompt.content);
  }

  /**
   * Serialize a snippet file to string
   */
  serializeSnippetFile(snippet: ISnippetFile): string {
    const metadata: ISnippetMetadata = {
      ...snippet.metadata,
      updatedAt: new Date().toISOString(),
    };
    return this.serialize(metadata, snippet.content);
  }

  /**
   * Create a new prompt with default metadata
   */
  createNewPrompt(
    title: string,
    content: string = ''
  ): { metadata: IPromptMetadata; content: string } {
    const now = new Date().toISOString();
    return {
      metadata: {
        id: uuidv4(),
        title,
        tags: [],
        isFavorite: false,
        isPinned: false,
        createdAt: now,
        updatedAt: now,
        version: 1,
      },
      content,
    };
  }

  /**
   * Create a new snippet with default metadata
   */
  createNewSnippet(
    name: string,
    type: ISnippetMetadata['type'] = 'text',
    content: string = '',
    tags: string[] = [],
    language?: string,
    description?: string
  ): { metadata: ISnippetMetadata; content: string } {
    const now = new Date().toISOString();
    const shortcut = `@${name.toLowerCase().replace(/\s+/g, '-')}`;
    return {
      metadata: {
        id: uuidv4(),
        name,
        type,
        shortcut,
        description,
        tags,
        language,
        createdAt: now,
        updatedAt: now,
      },
      content,
    };
  }

  /**
   * Update prompt version and timestamp
   */
  updatePromptVersion(metadata: IPromptMetadata): IPromptMetadata {
    return {
      ...metadata,
      version: metadata.version + 1,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Extract file name from path
   */
  private extractFileName(filePath: string): string {
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] ?? '';
  }

  /**
   * Extract title from file path (remove extension, convert to title case)
   */
  private extractTitleFromPath(filePath: string): string {
    const fileName = this.extractFileName(filePath);
    // Remove various .md extensions (.snippet.md, .persona.md, .template.md, .md)
    const nameWithoutExt = fileName
      .replace(/\.(snippet|persona|template)\.md$/i, '')
      .replace(/\.md$/i, '');
    return nameWithoutExt
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Extract name from file path for snippets
   */
  private extractNameFromPath(filePath: string): string {
    return this.extractTitleFromPath(filePath);
  }

  /**
   * Validate prompt metadata
   */
  validatePromptMetadata(metadata: unknown): metadata is IPromptMetadata {
    if (!metadata || typeof metadata !== 'object') return false;
    const m = metadata as Record<string, unknown>;
    return (
      typeof m['id'] === 'string' &&
      typeof m['title'] === 'string' &&
      Array.isArray(m['tags']) &&
      typeof m['isFavorite'] === 'boolean' &&
      typeof m['isPinned'] === 'boolean' &&
      typeof m['createdAt'] === 'string' &&
      typeof m['updatedAt'] === 'string' &&
      typeof m['version'] === 'number'
    );
  }

  /**
   * Validate snippet metadata
   */
  validateSnippetMetadata(metadata: unknown): metadata is ISnippetMetadata {
    if (!metadata || typeof metadata !== 'object') return false;
    const m = metadata as Record<string, unknown>;
    return (
      typeof m['id'] === 'string' &&
      typeof m['name'] === 'string' &&
      typeof m['type'] === 'string' &&
      typeof m['shortcut'] === 'string' &&
      Array.isArray(m['tags'])
    );
  }
}

// Singleton instance
let frontmatterServiceInstance: FrontmatterService | null = null;

/**
 * Get the frontmatter service instance
 */
export function getFrontmatterService(): FrontmatterService {
  if (!frontmatterServiceInstance) {
    frontmatterServiceInstance = new FrontmatterService();
  }
  return frontmatterServiceInstance;
}

/**
 * Reset the service instance (for testing)
 */
export function resetFrontmatterService(): void {
  frontmatterServiceInstance = null;
}
