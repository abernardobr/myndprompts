import { describe, it, expect, beforeEach } from 'vitest';
import {
  FrontmatterService,
  getFrontmatterService,
  resetFrontmatterService,
} from '../frontmatter.service';
import type { IPromptMetadata, ISnippetMetadata } from '../types';

describe('FrontmatterService', () => {
  let service: FrontmatterService;

  beforeEach(() => {
    resetFrontmatterService();
    service = getFrontmatterService();
  });

  describe('parse', () => {
    it('should parse YAML frontmatter from markdown content', () => {
      const content = `---
title: Test Prompt
tags:
  - test
  - example
---

# Content Here

This is the content.`;

      const result = service.parse<{ title: string; tags: string[] }>(content);

      expect(result.metadata.title).toBe('Test Prompt');
      expect(result.metadata.tags).toEqual(['test', 'example']);
      expect(result.content).toContain('# Content Here');
      expect(result.content).toContain('This is the content.');
    });

    it('should handle content without frontmatter', () => {
      const content = '# Just Content\n\nNo frontmatter here.';

      const result = service.parse<Record<string, unknown>>(content);

      expect(result.metadata).toEqual({});
      expect(result.content).toContain('# Just Content');
    });

    it('should handle empty content', () => {
      const content = '';

      const result = service.parse<Record<string, unknown>>(content);

      expect(result.metadata).toEqual({});
      expect(result.content).toBe('');
    });
  });

  describe('serialize', () => {
    it('should serialize metadata and content to markdown with frontmatter', () => {
      const metadata = { title: 'Test', count: 5 };
      const content = '# Hello World';

      const result = service.serialize(metadata, content);

      expect(result).toContain('---');
      expect(result).toContain('title: Test');
      expect(result).toContain('count: 5');
      expect(result).toContain('# Hello World');
    });

    it('should handle arrays in metadata', () => {
      const metadata = { tags: ['one', 'two', 'three'] };
      const content = 'Content';

      const result = service.serialize(metadata, content);

      expect(result).toContain('tags:');
      expect(result).toContain('- one');
      expect(result).toContain('- two');
      expect(result).toContain('- three');
    });
  });

  describe('parsePromptFile', () => {
    it('should parse a complete prompt file', () => {
      const content = `---
id: "123"
title: "My Prompt"
description: "A test prompt"
category: "development"
tags: ["typescript", "vue"]
aiProvider: "anthropic"
isFavorite: true
isPinned: false
createdAt: "2025-01-18T10:00:00Z"
updatedAt: "2025-01-18T12:00:00Z"
version: 3
---

# Prompt Content

This is my prompt.`;

      const result = service.parsePromptFile(content, '/path/to/my-prompt.md');

      expect(result.metadata.id).toBe('123');
      expect(result.metadata.title).toBe('My Prompt');
      expect(result.metadata.description).toBe('A test prompt');
      expect(result.metadata.category).toBe('development');
      expect(result.metadata.tags).toEqual(['typescript', 'vue']);
      expect(result.metadata.aiProvider).toBe('anthropic');
      expect(result.metadata.isFavorite).toBe(true);
      expect(result.metadata.isPinned).toBe(false);
      expect(result.metadata.version).toBe(3);
      expect(result.content).toContain('# Prompt Content');
      expect(result.filePath).toBe('/path/to/my-prompt.md');
      expect(result.fileName).toBe('my-prompt.md');
      expect(result.fileType).toBe('prompt');
    });

    it('should provide defaults for missing fields', () => {
      const content = `---
title: "Minimal Prompt"
---

Content here.`;

      const result = service.parsePromptFile(content, '/path/to/minimal.md');

      expect(result.metadata.id).toBeDefined();
      expect(result.metadata.title).toBe('Minimal Prompt');
      expect(result.metadata.tags).toEqual([]);
      expect(result.metadata.isFavorite).toBe(false);
      expect(result.metadata.isPinned).toBe(false);
      expect(result.metadata.version).toBe(1);
      expect(result.metadata.createdAt).toBeDefined();
      expect(result.metadata.updatedAt).toBeDefined();
    });

    it('should extract title from filename if not in frontmatter', () => {
      const content = '# Just content';

      const result = service.parsePromptFile(content, '/path/to/my-awesome-prompt.md');

      expect(result.metadata.title).toBe('My Awesome Prompt');
    });
  });

  describe('parseSnippetFile', () => {
    it('should parse a complete snippet file', () => {
      const content = `---
id: "456"
name: "Architect Persona"
type: "persona"
shortcut: "@architect"
description: "Senior architect persona"
tags: ["persona", "architecture"]
---

You are a Senior Software Architect...`;

      const result = service.parseSnippetFile(content, '/path/to/architect.snippet.md');

      expect(result.metadata.id).toBe('456');
      expect(result.metadata.name).toBe('Architect Persona');
      expect(result.metadata.type).toBe('persona');
      expect(result.metadata.shortcut).toBe('@architect');
      expect(result.metadata.description).toBe('Senior architect persona');
      expect(result.metadata.tags).toEqual(['persona', 'architecture']);
      expect(result.content).toContain('You are a Senior Software Architect');
      expect(result.fileType).toBe('snippet');
    });

    it('should provide defaults for missing fields', () => {
      const content = `---
name: "Test Snippet"
---

Content`;

      const result = service.parseSnippetFile(content, '/path/to/test.snippet.md');

      expect(result.metadata.id).toBeDefined();
      expect(result.metadata.name).toBe('Test Snippet');
      expect(result.metadata.type).toBe('text');
      expect(result.metadata.shortcut).toBe('@test');
      expect(result.metadata.tags).toEqual([]);
    });
  });

  describe('serializePromptFile', () => {
    it('should serialize a prompt file and update timestamp', () => {
      const prompt = {
        metadata: {
          id: '123',
          title: 'Test',
          tags: ['test'],
          isFavorite: false,
          isPinned: false,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          version: 1,
        } as IPromptMetadata,
        content: '# Content',
        filePath: '/path/to/test.md',
        fileName: 'test.md',
        fileType: 'prompt' as const,
      };

      const result = service.serializePromptFile(prompt);

      // gray-matter uses single quotes for strings
      expect(result).toContain("id: '123'");
      expect(result).toContain('title: Test');
      expect(result).toContain('# Content');
      // updatedAt should be updated (original createdAt should still be there)
      expect(result).toContain("createdAt: '2025-01-01T00:00:00Z'");
    });
  });

  describe('serializeSnippetFile', () => {
    it('should serialize a snippet file and update timestamp', () => {
      const snippet = {
        metadata: {
          id: '456',
          name: 'Test Snippet',
          type: 'text',
          shortcut: '@test',
          tags: [],
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        } as ISnippetMetadata,
        content: 'Snippet content',
        filePath: '/path/to/test.snippet.md',
        fileName: 'test.snippet.md',
        fileType: 'snippet' as const,
      };

      const result = service.serializeSnippetFile(snippet);

      expect(result).toContain('name: Test Snippet');
      // gray-matter uses single quotes for strings with special characters
      expect(result).toContain("shortcut: '@test'");
      expect(result).toContain('Snippet content');
    });
  });

  describe('createNewPrompt', () => {
    it('should create a new prompt with default metadata', () => {
      const result = service.createNewPrompt('My New Prompt', '# Content');

      expect(result.metadata.id).toBeDefined();
      expect(result.metadata.title).toBe('My New Prompt');
      expect(result.metadata.tags).toEqual([]);
      expect(result.metadata.isFavorite).toBe(false);
      expect(result.metadata.isPinned).toBe(false);
      expect(result.metadata.version).toBe(1);
      expect(result.metadata.createdAt).toBeDefined();
      expect(result.metadata.updatedAt).toBeDefined();
      expect(result.content).toBe('# Content');
    });

    it('should create an empty prompt when no content provided', () => {
      const result = service.createNewPrompt('Empty Prompt');

      expect(result.content).toBe('');
    });
  });

  describe('createNewSnippet', () => {
    it('should create a new snippet with default metadata', () => {
      const result = service.createNewSnippet('Test Snippet', 'code', 'console.log("Hello")');

      expect(result.metadata.id).toBeDefined();
      expect(result.metadata.name).toBe('Test Snippet');
      expect(result.metadata.type).toBe('code');
      expect(result.metadata.shortcut).toBe('@test-snippet');
      expect(result.metadata.tags).toEqual([]);
      expect(result.content).toBe('console.log("Hello")');
    });

    it('should generate shortcut from name', () => {
      const result = service.createNewSnippet('My Great Snippet');

      expect(result.metadata.shortcut).toBe('@my-great-snippet');
    });
  });

  describe('updatePromptVersion', () => {
    it('should increment version and update timestamp', () => {
      const metadata: IPromptMetadata = {
        id: '123',
        title: 'Test',
        tags: [],
        isFavorite: false,
        isPinned: false,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        version: 1,
      };

      const result = service.updatePromptVersion(metadata);

      expect(result.version).toBe(2);
      expect(result.updatedAt).not.toBe('2025-01-01T00:00:00Z');
    });
  });

  describe('validatePromptMetadata', () => {
    it('should return true for valid prompt metadata', () => {
      const metadata: IPromptMetadata = {
        id: '123',
        title: 'Test',
        tags: [],
        isFavorite: false,
        isPinned: false,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        version: 1,
      };

      expect(service.validatePromptMetadata(metadata)).toBe(true);
    });

    it('should return false for invalid prompt metadata', () => {
      expect(service.validatePromptMetadata(null)).toBe(false);
      expect(service.validatePromptMetadata({})).toBe(false);
      expect(service.validatePromptMetadata({ id: '123' })).toBe(false);
    });
  });

  describe('validateSnippetMetadata', () => {
    it('should return true for valid snippet metadata', () => {
      const metadata: ISnippetMetadata = {
        id: '123',
        name: 'Test',
        type: 'text',
        shortcut: '@test',
        tags: [],
      };

      expect(service.validateSnippetMetadata(metadata)).toBe(true);
    });

    it('should return false for invalid snippet metadata', () => {
      expect(service.validateSnippetMetadata(null)).toBe(false);
      expect(service.validateSnippetMetadata({})).toBe(false);
      expect(service.validateSnippetMetadata({ id: '123' })).toBe(false);
    });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      const instance1 = getFrontmatterService();
      const instance2 = getFrontmatterService();

      expect(instance1).toBe(instance2);
    });

    it('should reset the instance', () => {
      const instance1 = getFrontmatterService();
      resetFrontmatterService();
      const instance2 = getFrontmatterService();

      expect(instance1).not.toBe(instance2);
    });
  });
});
