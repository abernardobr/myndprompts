/**
 * UI Store Tests
 *
 * Tests for the UI state management store.
 */
import 'fake-indexeddb/auto';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useUIStore, type IOpenTab } from '../uiStore';
import { resetDB } from '@/services/storage/db';
import { UIStateRepository } from '@/services/storage/repositories/ui-state.repository';

// Mock Quasar Dark mode
vi.mock('quasar', () => ({
  Dark: {
    set: vi.fn(),
  },
}));

// Mock window.matchMedia
const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: query === '(prefers-color-scheme: dark)',
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
});

describe('uiStore', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    UIStateRepository.resetInstance();
    await resetDB();
  });

  afterEach(async () => {
    await resetDB();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const store = useUIStore();

      expect(store.sidebarWidth).toBe(280);
      expect(store.sidebarCollapsed).toBe(false);
      expect(store.panelHeight).toBe(200);
      expect(store.panelCollapsed).toBe(true);
      expect(store.theme).toBe('system');
      expect(store.activeActivity).toBe('explorer');
      expect(store.activePanel).toBe('output');
      expect(store.openTabs).toEqual([]);
      expect(store.activeTabId).toBeUndefined();
    });

    it('should call initialize only once', async () => {
      const store = useUIStore();

      // Initialize twice
      await store.initialize();
      await store.initialize();

      expect(store.isInitialized).toBe(true);
    });
  });

  describe('theme management', () => {
    it('should set theme', () => {
      const store = useUIStore();

      store.setTheme('dark');
      expect(store.theme).toBe('dark');

      store.setTheme('light');
      expect(store.theme).toBe('light');

      store.setTheme('system');
      expect(store.theme).toBe('system');
    });

    it('should compute effective theme correctly', () => {
      const store = useUIStore();

      store.setTheme('dark');
      expect(store.effectiveTheme).toBe('dark');

      store.setTheme('light');
      expect(store.effectiveTheme).toBe('light');

      // System theme depends on matchMedia mock
      store.setTheme('system');
      expect(store.effectiveTheme).toBe('dark'); // Because our mock returns dark
    });

    it('should compute isDarkMode correctly', () => {
      const store = useUIStore();

      store.setTheme('dark');
      expect(store.isDarkMode).toBe(true);

      store.setTheme('light');
      expect(store.isDarkMode).toBe(false);
    });
  });

  describe('sidebar management', () => {
    it('should toggle sidebar', () => {
      const store = useUIStore();

      expect(store.sidebarCollapsed).toBe(false);

      store.toggleSidebar();
      expect(store.sidebarCollapsed).toBe(true);

      store.toggleSidebar();
      expect(store.sidebarCollapsed).toBe(false);
    });

    it('should set sidebar width within bounds', () => {
      const store = useUIStore();

      store.setSidebarWidth(300);
      expect(store.sidebarWidth).toBe(300);

      // Test minimum bound
      store.setSidebarWidth(100);
      expect(store.sidebarWidth).toBe(200);

      // Test maximum bound
      store.setSidebarWidth(800);
      expect(store.sidebarWidth).toBe(600);
    });

    it('should set sidebar collapsed state directly', () => {
      const store = useUIStore();

      store.setSidebarCollapsed(true);
      expect(store.sidebarCollapsed).toBe(true);

      store.setSidebarCollapsed(false);
      expect(store.sidebarCollapsed).toBe(false);
    });
  });

  describe('activity bar management', () => {
    it('should set active activity and expand sidebar', () => {
      const store = useUIStore();
      store.sidebarCollapsed = true;

      store.setActiveActivity('search');
      expect(store.activeActivity).toBe('search');
      expect(store.sidebarCollapsed).toBe(false);
    });

    it('should collapse sidebar when clicking same activity', () => {
      const store = useUIStore();

      // First switch to a different activity
      store.setActiveActivity('search');
      expect(store.activeActivity).toBe('search');
      expect(store.sidebarCollapsed).toBe(false);

      // Click same activity again - should collapse
      store.setActiveActivity('search');
      expect(store.sidebarCollapsed).toBe(true);
    });
  });

  describe('panel management', () => {
    it('should toggle panel', () => {
      const store = useUIStore();

      expect(store.panelCollapsed).toBe(true);

      store.togglePanel();
      expect(store.panelCollapsed).toBe(false);

      store.togglePanel();
      expect(store.panelCollapsed).toBe(true);
    });

    it('should set panel height within bounds', () => {
      const store = useUIStore();

      store.setPanelHeight(250);
      expect(store.panelHeight).toBe(250);

      // Test minimum bound
      store.setPanelHeight(50);
      expect(store.panelHeight).toBe(100);

      // Test maximum bound
      store.setPanelHeight(600);
      expect(store.panelHeight).toBe(500);
    });

    it('should set active panel and expand if collapsed', () => {
      const store = useUIStore();
      store.panelCollapsed = true;

      store.setActivePanel('problems');
      expect(store.activePanel).toBe('problems');
      expect(store.panelCollapsed).toBe(false);
    });
  });

  describe('tab management', () => {
    const mockTab: Omit<IOpenTab, 'id'> = {
      filePath: '/path/to/file.md',
      fileName: 'file.md',
      title: 'File',
      isDirty: false,
      isPinned: false,
    };

    it('should open new tab', () => {
      const store = useUIStore();

      store.openTab(mockTab);
      expect(store.openTabs).toHaveLength(1);
      expect(store.openTabs[0].filePath).toBe('/path/to/file.md');
      expect(store.activeTabId).toBe('/path/to/file.md');
    });

    it('should activate existing tab instead of duplicating', () => {
      const store = useUIStore();

      store.openTab(mockTab);
      store.openTab({ ...mockTab, filePath: '/path/to/other.md', fileName: 'other.md' });

      expect(store.openTabs).toHaveLength(2);
      expect(store.activeTabId).toBe('/path/to/other.md');

      // Open first tab again
      store.openTab(mockTab);
      expect(store.openTabs).toHaveLength(2);
      expect(store.activeTabId).toBe('/path/to/file.md');
    });

    it('should close tab', () => {
      const store = useUIStore();

      store.openTab(mockTab);
      store.openTab({ ...mockTab, filePath: '/path/to/other.md', fileName: 'other.md' });

      store.closeTab('/path/to/file.md');
      expect(store.openTabs).toHaveLength(1);
      expect(store.openTabs[0].filePath).toBe('/path/to/other.md');
    });

    it('should update active tab when closing active tab', () => {
      const store = useUIStore();

      store.openTab(mockTab);
      store.openTab({ ...mockTab, filePath: '/path/to/other.md', fileName: 'other.md' });

      // Active tab is second one
      expect(store.activeTabId).toBe('/path/to/other.md');

      store.closeTab('/path/to/other.md');
      expect(store.activeTabId).toBe('/path/to/file.md');
    });

    it('should clear active tab when closing last tab', () => {
      const store = useUIStore();

      store.openTab(mockTab);
      store.closeTab('/path/to/file.md');

      expect(store.openTabs).toHaveLength(0);
      expect(store.activeTabId).toBeUndefined();
    });

    it('should close all tabs', () => {
      const store = useUIStore();

      store.openTab(mockTab);
      store.openTab({ ...mockTab, filePath: '/path/to/other.md', fileName: 'other.md' });

      store.closeAllTabs();
      expect(store.openTabs).toHaveLength(0);
      expect(store.activeTabId).toBeUndefined();
    });

    it('should close other tabs', () => {
      const store = useUIStore();

      store.openTab(mockTab);
      store.openTab({ ...mockTab, filePath: '/path/to/second.md', fileName: 'second.md' });
      store.openTab({ ...mockTab, filePath: '/path/to/third.md', fileName: 'third.md' });

      store.closeOtherTabs('/path/to/second.md');
      expect(store.openTabs).toHaveLength(1);
      expect(store.openTabs[0].filePath).toBe('/path/to/second.md');
      expect(store.activeTabId).toBe('/path/to/second.md');
    });

    it('should set tab dirty state', () => {
      const store = useUIStore();

      store.openTab(mockTab);
      expect(store.openTabs[0].isDirty).toBe(false);

      store.setTabDirty('/path/to/file.md', true);
      expect(store.openTabs[0].isDirty).toBe(true);

      store.setTabDirty('/path/to/file.md', false);
      expect(store.openTabs[0].isDirty).toBe(false);
    });

    it('should compute hasUnsavedChanges correctly', () => {
      const store = useUIStore();

      store.openTab(mockTab);
      expect(store.hasUnsavedChanges).toBe(false);

      store.setTabDirty('/path/to/file.md', true);
      expect(store.hasUnsavedChanges).toBe(true);
    });

    it('should pin and unpin tabs', () => {
      const store = useUIStore();

      store.openTab(mockTab);
      store.openTab({ ...mockTab, filePath: '/path/to/second.md', fileName: 'second.md' });

      // Pin second tab - it should move to beginning
      store.pinTab('/path/to/second.md');
      expect(store.openTabs[0].filePath).toBe('/path/to/second.md');
      expect(store.openTabs[0].isPinned).toBe(true);

      store.unpinTab('/path/to/second.md');
      expect(store.openTabs[0].isPinned).toBe(false);
    });

    it('should reorder tabs', () => {
      const store = useUIStore();

      store.openTab(mockTab);
      store.openTab({ ...mockTab, filePath: '/path/to/second.md', fileName: 'second.md' });
      store.openTab({ ...mockTab, filePath: '/path/to/third.md', fileName: 'third.md' });

      // Move first tab to last position
      store.reorderTabs(0, 2);
      expect(store.openTabs[0].filePath).toBe('/path/to/second.md');
      expect(store.openTabs[1].filePath).toBe('/path/to/third.md');
      expect(store.openTabs[2].filePath).toBe('/path/to/file.md');
    });
  });

  describe('computed properties', () => {
    it('should compute activeTab correctly', () => {
      const store = useUIStore();

      expect(store.activeTab).toBeUndefined();

      store.openTab({
        filePath: '/path/to/file.md',
        fileName: 'file.md',
        title: 'File',
        isDirty: false,
        isPinned: false,
      });

      expect(store.activeTab).toBeDefined();
      expect(store.activeTab?.filePath).toBe('/path/to/file.md');
    });
  });

  describe('locale management', () => {
    it('should set locale', () => {
      const store = useUIStore();

      expect(store.locale).toBe('en-US');

      store.setLocale('pt-BR');
      expect(store.locale).toBe('pt-BR');
    });
  });
});
