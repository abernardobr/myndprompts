/**
 * Snippet Store Tests
 *
 * Tests for the snippet state management store.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSnippetStore } from '../snippetStore';
import type { ISnippetFile, ISnippetMetadata } from '@/services/file-system/types';

// Mock window.fileSystemAPI to simulate Electron environment
const mockFileSystemAPI = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
  deleteFile: vi.fn(),
};

beforeEach(() => {
  // @ts-expect-error - mocking window.fileSystemAPI
  window.fileSystemAPI = mockFileSystemAPI;
});

afterEach(() => {
  // @ts-expect-error - cleaning up mock
  delete window.fileSystemAPI;
});

// Helper to create mock snippet
function createMockSnippet(
  name: string,
  type: ISnippetMetadata['type'] = 'text',
  overrides: Partial<ISnippetFile> = {}
): ISnippetFile {
  const shortcut = `@${name.toLowerCase().replace(/\s+/g, '-')}`;
  return {
    metadata: {
      id: `id-${name}`,
      name,
      type,
      shortcut,
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    content: `Content for ${name}`,
    filePath: `/test/snippets/${name.toLowerCase().replace(/\s+/g, '-')}.snippet.md`,
    fileName: `${name.toLowerCase().replace(/\s+/g, '-')}.snippet.md`,
    fileType: 'snippet',
    ...overrides,
  };
}

// Mock snippets data
const mockSnippets: ISnippetFile[] = [
  createMockSnippet('Architect', 'persona'),
  createMockSnippet('Designer', 'persona'),
  createMockSnippet('Disclaimer', 'text'),
  createMockSnippet('License', 'text'),
  createMockSnippet('Debug Log', 'code'),
  createMockSnippet('API Template', 'template'),
];

// Mock the file system service
vi.mock('@/services/file-system', () => ({
  getPromptFileService: () => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn().mockResolvedValue(undefined),
    loadSnippet: vi.fn().mockImplementation((filePath: string) => {
      const snippet = mockSnippets.find((s) => s.filePath === filePath);
      if (snippet) {
        return Promise.resolve({ ...snippet });
      }
      return Promise.reject(new Error('Snippet not found'));
    }),
    saveSnippet: vi.fn().mockResolvedValue(undefined),
    createSnippet: vi
      .fn()
      .mockImplementation((name: string, type: ISnippetMetadata['type']) =>
        Promise.resolve(createMockSnippet(name, type))
      ),
    deleteSnippet: vi.fn().mockResolvedValue(undefined),
    listSnippets: vi.fn().mockImplementation((type?: ISnippetMetadata['type']) => {
      if (type) {
        return Promise.resolve(mockSnippets.filter((s) => s.metadata.type === type));
      }
      return Promise.resolve([...mockSnippets]);
    }),
    findSnippetByShortcut: vi.fn().mockImplementation((shortcut: string) => {
      const snippet = mockSnippets.find((s) => s.metadata.shortcut === shortcut);
      return Promise.resolve(snippet ?? null);
    }),
    onFileChange: vi.fn().mockReturnValue(() => {}),
  }),
}));

describe('snippetStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const store = useSnippetStore();

      expect(store.isInitialized).toBe(false);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
      expect(store.allSnippets).toEqual([]);
    });

    it('should initialize successfully', async () => {
      const store = useSnippetStore();

      await store.initialize();

      expect(store.isInitialized).toBe(true);
      expect(store.error).toBeNull();
      expect(store.allSnippets.length).toBe(mockSnippets.length);
    });

    it('should only initialize once', async () => {
      const store = useSnippetStore();

      await store.initialize();
      await store.initialize();

      expect(store.isInitialized).toBe(true);
    });
  });

  describe('computed properties', () => {
    it('should compute snippets by type', async () => {
      const store = useSnippetStore();
      await store.initialize();

      expect(store.personaSnippets.length).toBe(2);
      expect(store.textSnippets.length).toBe(2);
      expect(store.codeSnippets.length).toBe(1);
      expect(store.templateSnippets.length).toBe(1);
    });

    it('should build shortcut map', async () => {
      const store = useSnippetStore();
      await store.initialize();

      const shortcutMap = store.shortcutMap;
      expect(shortcutMap.size).toBe(mockSnippets.length);
      expect(shortcutMap.get('@architect')).toBeDefined();
      expect(shortcutMap.get('@designer')).toBeDefined();
    });
  });

  describe('loading snippets', () => {
    it('should load a snippet from file', async () => {
      const store = useSnippetStore();
      await store.initialize();

      const filePath = mockSnippets[0].filePath;
      const snippet = await store.loadSnippet(filePath);

      expect(snippet.metadata.name).toBe('Architect');
    });

    it('should cache loaded snippets', async () => {
      const store = useSnippetStore();
      await store.initialize();

      const filePath = mockSnippets[0].filePath;
      await store.loadSnippet(filePath);
      const cached = store.getCachedSnippet(filePath);

      expect(cached).toBeDefined();
      expect(cached?.metadata.name).toBe('Architect');
    });

    it('should return cached snippet on second load', async () => {
      const store = useSnippetStore();
      await store.initialize();

      const filePath = mockSnippets[0].filePath;
      const snippet1 = await store.loadSnippet(filePath);
      const snippet2 = await store.loadSnippet(filePath);

      expect(snippet1).toEqual(snippet2);
    });
  });

  describe('content management', () => {
    it('should get snippet content', async () => {
      const store = useSnippetStore();
      await store.initialize();

      const filePath = mockSnippets[0].filePath;
      await store.loadSnippet(filePath);
      const content = store.getSnippetContent(filePath);

      expect(content).toBe('Content for Architect');
    });

    it('should update snippet content', async () => {
      const store = useSnippetStore();
      await store.initialize();

      const filePath = mockSnippets[0].filePath;
      await store.loadSnippet(filePath);
      store.updateSnippetContent(filePath, 'Updated content');

      const content = store.getSnippetContent(filePath);
      expect(content).toBe('Updated content');
    });

    it('should mark snippet as dirty when content changes', async () => {
      const store = useSnippetStore();
      await store.initialize();

      const filePath = mockSnippets[0].filePath;
      await store.loadSnippet(filePath);
      store.updateSnippetContent(filePath, 'Updated content');

      expect(store.isSnippetDirty(filePath)).toBe(true);
    });

    it('should not mark snippet as dirty when content is same', async () => {
      const store = useSnippetStore();
      await store.initialize();

      const filePath = mockSnippets[0].filePath;
      await store.loadSnippet(filePath);
      store.updateSnippetContent(filePath, 'Content for Architect');

      expect(store.isSnippetDirty(filePath)).toBe(false);
    });
  });

  describe('creating snippets', () => {
    it('should create a new snippet', async () => {
      const store = useSnippetStore();
      await store.initialize();

      const snippet = await store.createSnippet('New Snippet', 'text');

      expect(snippet.metadata.name).toBe('New Snippet');
      expect(snippet.metadata.type).toBe('text');
    });

    it('should add new snippet to cache', async () => {
      const store = useSnippetStore();
      await store.initialize();

      const snippet = await store.createSnippet('New Snippet', 'persona');
      const cached = store.getCachedSnippet(snippet.filePath);

      expect(cached).toBeDefined();
    });
  });

  describe('deleting snippets', () => {
    it('should delete a snippet', async () => {
      const store = useSnippetStore();
      await store.initialize();

      const filePath = mockSnippets[0].filePath;
      await store.loadSnippet(filePath);
      await store.deleteSnippet(filePath);

      const cached = store.getCachedSnippet(filePath);
      expect(cached).toBeUndefined();
    });
  });

  describe('searching snippets', () => {
    it('should search snippets by name', async () => {
      const store = useSnippetStore();
      await store.initialize();

      const results = store.searchSnippets('architect');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((s) => s.metadata.name === 'Architect')).toBe(true);
    });

    it('should search snippets by shortcut', async () => {
      const store = useSnippetStore();
      await store.initialize();

      const results = store.searchSnippets('@designer');
      expect(results.some((s) => s.metadata.name === 'Designer')).toBe(true);
    });

    it('should return all snippets for empty query', async () => {
      const store = useSnippetStore();
      await store.initialize();

      const results = store.searchSnippets('');
      expect(results.length).toBe(mockSnippets.length);
    });
  });

  describe('finding by shortcut', () => {
    it('should find snippet by shortcut', async () => {
      const store = useSnippetStore();
      await store.initialize();

      const snippet = store.findByShortcut('@architect');
      expect(snippet).toBeDefined();
      expect(snippet?.metadata.name).toBe('Architect');
    });

    it('should return undefined for unknown shortcut', async () => {
      const store = useSnippetStore();
      await store.initialize();

      const snippet = store.findByShortcut('@unknown');
      expect(snippet).toBeUndefined();
    });
  });

  describe('unloading snippets', () => {
    it('should unload a snippet from cache', async () => {
      const store = useSnippetStore();
      await store.initialize();

      const filePath = mockSnippets[0].filePath;
      await store.loadSnippet(filePath);
      store.unloadSnippet(filePath);

      const cached = store.getCachedSnippet(filePath);
      expect(cached).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should clear error state', async () => {
      const store = useSnippetStore();
      await store.initialize();

      // Manually set an error for testing
      store.error = 'Test error';
      expect(store.error).toBe('Test error');

      store.clearError();
      expect(store.error).toBeNull();
    });
  });
});
