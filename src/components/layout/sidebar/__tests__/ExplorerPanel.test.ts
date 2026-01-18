/**
 * ExplorerPanel Tests
 *
 * Tests for the file explorer panel functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePromptStore } from '@/stores/promptStore';
import { useSnippetStore } from '@/stores/snippetStore';
import { useUIStore } from '@/stores/uiStore';
import type { IPromptFile, ISnippetFile, ISnippetMetadata } from '@/services/file-system/types';

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

// Helper to create mock prompt
function createMockPrompt(title: string, overrides: Partial<IPromptFile> = {}): IPromptFile {
  const fileName = `${title.toLowerCase().replace(/\s+/g, '-')}.md`;
  return {
    metadata: {
      id: `prompt-${title}`,
      title,
      tags: [],
      isFavorite: false,
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    },
    content: `Content for ${title}`,
    filePath: `/test/prompts/${fileName}`,
    fileName,
    fileType: 'prompt',
    ...overrides,
  };
}

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

// Mock prompts data
const mockPrompts: IPromptFile[] = [
  createMockPrompt('Getting Started'),
  createMockPrompt('Code Review', {
    metadata: { ...createMockPrompt('Code Review').metadata, isFavorite: true },
  }),
  createMockPrompt('Bug Fix'),
];

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
    loadPrompt: vi.fn().mockImplementation((filePath: string) => {
      const prompt = mockPrompts.find((p) => p.filePath === filePath);
      if (prompt) return Promise.resolve({ ...prompt });
      return Promise.reject(new Error('Prompt not found'));
    }),
    savePrompt: vi.fn().mockResolvedValue(undefined),
    createPrompt: vi
      .fn()
      .mockImplementation((title: string) => Promise.resolve(createMockPrompt(title))),
    deletePrompt: vi.fn().mockResolvedValue(undefined),
    listPrompts: vi.fn().mockResolvedValue([...mockPrompts]),
    updatePromptMetadata: vi.fn().mockResolvedValue(undefined),
    onFileChange: vi.fn().mockReturnValue(() => {}),
    loadSnippet: vi.fn().mockImplementation((filePath: string) => {
      const snippet = mockSnippets.find((s) => s.filePath === filePath);
      if (snippet) return Promise.resolve({ ...snippet });
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
  }),
}));

// Mock storage repositories
vi.mock('@/services/storage', () => ({
  getRecentFilesRepository: () => ({
    getRecentFiles: vi.fn().mockResolvedValue([]),
    addRecentFile: vi.fn().mockResolvedValue(undefined),
    removeRecentFile: vi.fn().mockResolvedValue(undefined),
    clearRecentFiles: vi.fn().mockResolvedValue(undefined),
  }),
  getUIStateRepository: () => ({
    getState: vi.fn().mockResolvedValue(null),
    updateState: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('ExplorerPanel Logic', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('promptStore integration', () => {
    it('should initialize prompt store', async () => {
      const store = usePromptStore();
      await store.initialize();
      expect(store.isInitialized).toBe(true);
    });

    it('should list all prompts', async () => {
      const store = usePromptStore();
      await store.initialize();
      await store.refreshAllPrompts();

      expect(store.allPrompts.length).toBe(mockPrompts.length);
    });

    it('should load a prompt by path', async () => {
      const store = usePromptStore();
      await store.initialize();

      const prompt = await store.loadPrompt(mockPrompts[0].filePath);
      expect(prompt.metadata.title).toBe('Getting Started');
    });

    it('should create a new prompt', async () => {
      const store = usePromptStore();
      await store.initialize();

      const prompt = await store.createPrompt('New Test Prompt');
      expect(prompt.metadata.title).toBe('New Test Prompt');
    });
  });

  describe('snippetStore integration', () => {
    it('should initialize snippet store', async () => {
      const store = useSnippetStore();
      await store.initialize();
      expect(store.isInitialized).toBe(true);
    });

    it('should list all snippets', async () => {
      const store = useSnippetStore();
      await store.initialize();

      expect(store.allSnippets.length).toBe(mockSnippets.length);
    });

    it('should filter snippets by type', async () => {
      const store = useSnippetStore();
      await store.initialize();

      expect(store.personaSnippets.length).toBe(2);
      expect(store.textSnippets.length).toBe(2);
      expect(store.codeSnippets.length).toBe(1);
      expect(store.templateSnippets.length).toBe(1);
    });
  });

  describe('uiStore tab management', () => {
    it('should open a new tab', () => {
      const store = useUIStore();

      store.openTab({
        filePath: '/test/prompts/test.md',
        fileName: 'test.md',
        title: 'Test Prompt',
        isDirty: false,
        isPinned: false,
      });

      expect(store.openTabs.length).toBe(1);
      expect(store.activeTabId).toBe('/test/prompts/test.md');
    });

    it('should not duplicate existing tab', () => {
      const store = useUIStore();

      store.openTab({
        filePath: '/test/prompts/test.md',
        fileName: 'test.md',
        title: 'Test Prompt',
        isDirty: false,
        isPinned: false,
      });

      store.openTab({
        filePath: '/test/prompts/test.md',
        fileName: 'test.md',
        title: 'Test Prompt',
        isDirty: false,
        isPinned: false,
      });

      expect(store.openTabs.length).toBe(1);
    });

    it('should close a tab', () => {
      const store = useUIStore();

      store.openTab({
        filePath: '/test/prompts/test.md',
        fileName: 'test.md',
        title: 'Test Prompt',
        isDirty: false,
        isPinned: false,
      });

      store.closeTab('/test/prompts/test.md');

      expect(store.openTabs.length).toBe(0);
      expect(store.activeTabId).toBeUndefined();
    });

    it('should activate previous tab when closing current', () => {
      const store = useUIStore();

      store.openTab({
        filePath: '/test/prompts/first.md',
        fileName: 'first.md',
        title: 'First',
        isDirty: false,
        isPinned: false,
      });

      store.openTab({
        filePath: '/test/prompts/second.md',
        fileName: 'second.md',
        title: 'Second',
        isDirty: false,
        isPinned: false,
      });

      store.closeTab('/test/prompts/second.md');

      expect(store.openTabs.length).toBe(1);
      expect(store.activeTabId).toBe('/test/prompts/first.md');
    });

    it('should close all tabs', () => {
      const store = useUIStore();

      store.openTab({
        filePath: '/test/prompts/first.md',
        fileName: 'first.md',
        title: 'First',
        isDirty: false,
        isPinned: false,
      });

      store.openTab({
        filePath: '/test/prompts/second.md',
        fileName: 'second.md',
        title: 'Second',
        isDirty: false,
        isPinned: false,
      });

      store.closeAllTabs();

      expect(store.openTabs.length).toBe(0);
      expect(store.activeTabId).toBeUndefined();
    });
  });

  describe('file tree building', () => {
    it('should build correct folder structure for prompts', async () => {
      const promptStore = usePromptStore();
      await promptStore.initialize();
      await promptStore.refreshAllPrompts();

      // Simulate tree building logic
      const prompts = promptStore.allPrompts;

      expect(prompts.length).toBe(3);
      expect(prompts.some((p) => p.metadata.title === 'Getting Started')).toBe(true);
      expect(prompts.some((p) => p.metadata.title === 'Code Review')).toBe(true);
      expect(prompts.some((p) => p.metadata.title === 'Bug Fix')).toBe(true);
    });

    it('should build correct folder structure for snippets', async () => {
      const snippetStore = useSnippetStore();
      await snippetStore.initialize();

      const personas = snippetStore.personaSnippets;
      const textSnippets = snippetStore.textSnippets;
      const codeSnippets = snippetStore.codeSnippets;
      const templates = snippetStore.templateSnippets;

      expect(personas.length).toBe(2);
      expect(textSnippets.length).toBe(2);
      expect(codeSnippets.length).toBe(1);
      expect(templates.length).toBe(1);
    });
  });

  describe('search functionality', () => {
    it('should filter prompts by title', async () => {
      const store = usePromptStore();
      await store.initialize();
      await store.refreshAllPrompts();

      const searchQuery = 'code';
      const filtered = store.allPrompts.filter((p) =>
        p.metadata.title.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(filtered.length).toBe(1);
      expect(filtered[0].metadata.title).toBe('Code Review');
    });

    it('should filter snippets by name', async () => {
      const store = useSnippetStore();
      await store.initialize();

      const results = store.searchSnippets('architect');
      expect(results.length).toBe(1);
      expect(results[0].metadata.name).toBe('Architect');
    });

    it('should return all items for empty search', async () => {
      const store = useSnippetStore();
      await store.initialize();

      const results = store.searchSnippets('');
      expect(results.length).toBe(mockSnippets.length);
    });
  });

  describe('file operations', () => {
    it('should delete prompt and close associated tab', async () => {
      const promptStore = usePromptStore();
      const uiStore = useUIStore();

      await promptStore.initialize();

      // Open a tab for the prompt
      const filePath = mockPrompts[0].filePath;
      uiStore.openTab({
        filePath,
        fileName: mockPrompts[0].fileName,
        title: mockPrompts[0].metadata.title,
        isDirty: false,
        isPinned: false,
      });

      expect(uiStore.openTabs.length).toBe(1);

      // Delete the prompt
      await promptStore.deletePrompt(filePath);

      // Close the tab (as the component would)
      uiStore.closeTab(filePath);

      expect(uiStore.openTabs.length).toBe(0);
    });

    it('should delete snippet and close associated tab', async () => {
      const snippetStore = useSnippetStore();
      const uiStore = useUIStore();

      await snippetStore.initialize();

      // Open a tab for the snippet
      const filePath = mockSnippets[0].filePath;
      uiStore.openTab({
        filePath,
        fileName: mockSnippets[0].fileName,
        title: mockSnippets[0].metadata.name,
        isDirty: false,
        isPinned: false,
      });

      expect(uiStore.openTabs.length).toBe(1);

      // Delete the snippet
      await snippetStore.deleteSnippet(filePath);

      // Close the tab (as the component would)
      uiStore.closeTab(filePath);

      expect(uiStore.openTabs.length).toBe(0);
    });
  });

  describe('favorite prompts', () => {
    it('should identify favorite prompts', async () => {
      const store = usePromptStore();
      await store.initialize();
      await store.refreshAllPrompts();

      const favorites = store.allPrompts.filter((p) => p.metadata.isFavorite);
      expect(favorites.length).toBe(1);
      expect(favorites[0].metadata.title).toBe('Code Review');
    });
  });
});
