/**
 * Prompt Store Tests
 *
 * Tests for the prompt state management store.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePromptStore } from '../promptStore';
import type { IPromptFile } from '@/services/file-system/types';

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

// Mock the file system service
vi.mock('@/services/file-system', () => ({
  getPromptFileService: () => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn().mockResolvedValue(undefined),
    loadPrompt: vi.fn().mockImplementation((filePath: string) =>
      Promise.resolve({
        metadata: {
          id: 'test-id',
          title: 'Test Prompt',
          tags: ['test'],
          isFavorite: false,
          isPinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        },
        content: '# Test Content',
        filePath,
        fileName: 'test-prompt.md',
        fileType: 'prompt' as const,
      })
    ),
    savePrompt: vi.fn().mockResolvedValue(undefined),
    createPrompt: vi.fn().mockImplementation((title: string) =>
      Promise.resolve({
        metadata: {
          id: 'new-id',
          title,
          tags: [],
          isFavorite: false,
          isPinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        },
        content: '',
        filePath: `/test/prompts/${title.toLowerCase().replace(/\s+/g, '-')}.md`,
        fileName: `${title.toLowerCase().replace(/\s+/g, '-')}.md`,
        fileType: 'prompt' as const,
      })
    ),
    deletePrompt: vi.fn().mockResolvedValue(undefined),
    listPrompts: vi.fn().mockResolvedValue([]),
    updatePromptMetadata: vi
      .fn()
      .mockImplementation((filePath: string, updates: Partial<IPromptFile['metadata']>) =>
        Promise.resolve({
          metadata: {
            id: 'test-id',
            title: updates.title ?? 'Test Prompt',
            tags: updates.tags ?? ['test'],
            isFavorite: updates.isFavorite ?? false,
            isPinned: updates.isPinned ?? false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
          },
          content: '# Test Content',
          filePath,
          fileName: 'test-prompt.md',
          fileType: 'prompt' as const,
        })
      ),
    onFileChange: vi.fn().mockReturnValue(() => {}),
  }),
}));

// Mock the recent files repository
vi.mock('@/services/storage', () => ({
  getRecentFilesRepository: () => ({
    getRecentFiles: vi.fn().mockResolvedValue([]),
    addRecentFile: vi.fn().mockResolvedValue(undefined),
    removeRecentFile: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('promptStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const store = usePromptStore();

      expect(store.isInitialized).toBe(false);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
      expect(store.recentFiles).toEqual([]);
      expect(store.allPrompts).toEqual([]);
    });

    it('should initialize successfully', async () => {
      const store = usePromptStore();

      await store.initialize();

      expect(store.isInitialized).toBe(true);
      expect(store.error).toBeNull();
    });

    it('should only initialize once', async () => {
      const store = usePromptStore();

      await store.initialize();
      await store.initialize();

      expect(store.isInitialized).toBe(true);
    });
  });

  describe('loading prompts', () => {
    it('should load a prompt from file', async () => {
      const store = usePromptStore();
      await store.initialize();

      const prompt = await store.loadPrompt('/test/path/prompt.md');

      expect(prompt.metadata.title).toBe('Test Prompt');
      expect(prompt.filePath).toBe('/test/path/prompt.md');
    });

    it('should cache loaded prompts', async () => {
      const store = usePromptStore();
      await store.initialize();

      await store.loadPrompt('/test/path/prompt.md');
      const cached = store.getCachedPrompt('/test/path/prompt.md');

      expect(cached).toBeDefined();
      expect(cached?.metadata.title).toBe('Test Prompt');
    });

    it('should return cached prompt on second load', async () => {
      const store = usePromptStore();
      await store.initialize();

      const prompt1 = await store.loadPrompt('/test/path/prompt.md');
      const prompt2 = await store.loadPrompt('/test/path/prompt.md');

      expect(prompt1).toEqual(prompt2);
    });
  });

  describe('content management', () => {
    it('should get prompt content', async () => {
      const store = usePromptStore();
      await store.initialize();

      await store.loadPrompt('/test/path/prompt.md');
      const content = store.getPromptContent('/test/path/prompt.md');

      expect(content).toBe('# Test Content');
    });

    it('should update prompt content', async () => {
      const store = usePromptStore();
      await store.initialize();

      await store.loadPrompt('/test/path/prompt.md');
      store.updatePromptContent('/test/path/prompt.md', '# Updated Content');

      const content = store.getPromptContent('/test/path/prompt.md');
      expect(content).toBe('# Updated Content');
    });

    it('should mark prompt as dirty when content changes', async () => {
      const store = usePromptStore();
      await store.initialize();

      await store.loadPrompt('/test/path/prompt.md');
      store.updatePromptContent('/test/path/prompt.md', '# Updated Content');

      expect(store.isPromptDirty('/test/path/prompt.md')).toBe(true);
    });

    it('should not mark prompt as dirty when content is same', async () => {
      const store = usePromptStore();
      await store.initialize();

      await store.loadPrompt('/test/path/prompt.md');
      store.updatePromptContent('/test/path/prompt.md', '# Test Content');

      expect(store.isPromptDirty('/test/path/prompt.md')).toBe(false);
    });
  });

  describe('creating prompts', () => {
    it('should create a new prompt', async () => {
      const store = usePromptStore();
      await store.initialize();

      const prompt = await store.createPrompt('New Prompt');

      expect(prompt.metadata.title).toBe('New Prompt');
      expect(prompt.filePath).toContain('new-prompt.md');
    });

    it('should add new prompt to cache', async () => {
      const store = usePromptStore();
      await store.initialize();

      const prompt = await store.createPrompt('New Prompt');
      const cached = store.getCachedPrompt(prompt.filePath);

      expect(cached).toBeDefined();
    });
  });

  describe('saving prompts', () => {
    it('should save a prompt', async () => {
      const store = usePromptStore();
      await store.initialize();

      await store.loadPrompt('/test/path/prompt.md');
      store.updatePromptContent('/test/path/prompt.md', '# Updated Content');

      await store.savePrompt('/test/path/prompt.md');

      expect(store.isPromptDirty('/test/path/prompt.md')).toBe(false);
    });

    it('should throw error when saving non-loaded prompt', async () => {
      const store = usePromptStore();
      await store.initialize();

      await expect(store.savePrompt('/unknown/path.md')).rejects.toThrow('Prompt not loaded');
    });
  });

  describe('deleting prompts', () => {
    it('should delete a prompt', async () => {
      const store = usePromptStore();
      await store.initialize();

      await store.loadPrompt('/test/path/prompt.md');
      await store.deletePrompt('/test/path/prompt.md');

      const cached = store.getCachedPrompt('/test/path/prompt.md');
      expect(cached).toBeUndefined();
    });
  });

  describe('computed properties', () => {
    it('should track loaded prompt paths', async () => {
      const store = usePromptStore();
      await store.initialize();

      await store.loadPrompt('/test/path/prompt1.md');
      await store.loadPrompt('/test/path/prompt2.md');

      expect(store.loadedPromptPaths).toContain('/test/path/prompt1.md');
      expect(store.loadedPromptPaths).toContain('/test/path/prompt2.md');
    });

    it('should track unsaved prompts', async () => {
      const store = usePromptStore();
      await store.initialize();

      await store.loadPrompt('/test/path/prompt.md');
      store.updatePromptContent('/test/path/prompt.md', '# Updated');

      expect(store.hasUnsavedPrompts).toBe(true);
      expect(store.unsavedPromptPaths).toContain('/test/path/prompt.md');
    });
  });

  describe('unloading prompts', () => {
    it('should unload a prompt from cache', async () => {
      const store = usePromptStore();
      await store.initialize();

      await store.loadPrompt('/test/path/prompt.md');
      store.unloadPrompt('/test/path/prompt.md');

      const cached = store.getCachedPrompt('/test/path/prompt.md');
      expect(cached).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should clear error state', async () => {
      const store = usePromptStore();
      await store.initialize();

      // Manually set an error for testing
      store.error = 'Test error';
      expect(store.error).toBe('Test error');

      store.clearError();
      expect(store.error).toBeNull();
    });
  });
});
