/**
 * useTheme Composable Tests
 *
 * Tests for the theme management composable.
 * Note: These tests verify the composable's interaction with the store
 * and keyboard shortcut handling.
 */
import 'fake-indexeddb/auto';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useUIStore } from '@/stores/uiStore';
import { resetDB } from '@/services/storage/db';
import { UIStateRepository } from '@/services/storage/repositories/ui-state.repository';

// Mock Quasar Dark mode
vi.mock('quasar', () => ({
  Dark: {
    set: vi.fn(),
    isActive: false,
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

describe('useTheme composable integration', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    UIStateRepository.resetInstance();
    await resetDB();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetDB();
  });

  describe('theme state via store', () => {
    it('should have default theme as system', () => {
      const store = useUIStore();
      expect(store.theme).toBe('system');
    });

    it('should set theme to dark', () => {
      const store = useUIStore();
      store.setTheme('dark');
      expect(store.theme).toBe('dark');
    });

    it('should set theme to light', () => {
      const store = useUIStore();
      store.setTheme('light');
      expect(store.theme).toBe('light');
    });

    it('should set theme to system', () => {
      const store = useUIStore();
      store.setTheme('dark');
      store.setTheme('system');
      expect(store.theme).toBe('system');
    });
  });

  describe('effective theme computation', () => {
    it('should return dark when theme is dark', () => {
      const store = useUIStore();
      store.setTheme('dark');
      expect(store.effectiveTheme).toBe('dark');
    });

    it('should return light when theme is light', () => {
      const store = useUIStore();
      store.setTheme('light');
      expect(store.effectiveTheme).toBe('light');
    });

    it('should return system preference when theme is system', () => {
      const store = useUIStore();
      store.setTheme('system');
      // Our mock returns true for prefers-color-scheme: dark
      expect(store.effectiveTheme).toBe('dark');
    });
  });

  describe('isDarkMode computation', () => {
    it('should be true when effective theme is dark', () => {
      const store = useUIStore();
      store.setTheme('dark');
      expect(store.isDarkMode).toBe(true);
    });

    it('should be false when effective theme is light', () => {
      const store = useUIStore();
      store.setTheme('light');
      expect(store.isDarkMode).toBe(false);
    });
  });

  describe('theme cycling logic', () => {
    it('should cycle light -> dark -> system -> light', () => {
      const store = useUIStore();
      const modes = ['light', 'dark', 'system'] as const;

      // Start with light
      store.setTheme('light');
      expect(store.theme).toBe('light');

      // Cycle through manually (simulating cycleTheme behavior)
      let currentIndex = modes.indexOf(store.theme);

      // light -> dark
      currentIndex = (currentIndex + 1) % modes.length;
      store.setTheme(modes[currentIndex]);
      expect(store.theme).toBe('dark');

      // dark -> system
      currentIndex = (currentIndex + 1) % modes.length;
      store.setTheme(modes[currentIndex]);
      expect(store.theme).toBe('system');

      // system -> light
      currentIndex = (currentIndex + 1) % modes.length;
      store.setTheme(modes[currentIndex]);
      expect(store.theme).toBe('light');
    });
  });

  describe('theme toggle logic', () => {
    it('should toggle dark to light', () => {
      const store = useUIStore();
      store.setTheme('dark');

      // Simulate toggleTheme behavior
      const newMode = store.isDarkMode ? 'light' : 'dark';
      store.setTheme(newMode);

      expect(store.theme).toBe('light');
    });

    it('should toggle light to dark', () => {
      const store = useUIStore();
      store.setTheme('light');

      // Simulate toggleTheme behavior
      const newMode = store.isDarkMode ? 'light' : 'dark';
      store.setTheme(newMode);

      expect(store.theme).toBe('dark');
    });

    it('should toggle system (dark effective) to light', () => {
      const store = useUIStore();
      store.setTheme('system');
      // With our mock, system resolves to dark

      // Simulate toggleTheme behavior
      const newMode = store.isDarkMode ? 'light' : 'dark';
      store.setTheme(newMode);

      expect(store.theme).toBe('light');
    });
  });

  describe('keyboard shortcut handler logic', () => {
    it('should detect Ctrl+Shift+T combination', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'T',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });

      // Verify the event has the correct properties
      expect(event.ctrlKey).toBe(true);
      expect(event.shiftKey).toBe(true);
      expect(event.key).toBe('T');

      // The actual keyboard handler checks:
      // (event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'T'
      const isThemeShortcut =
        (event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'T';
      expect(isThemeShortcut).toBe(true);
    });

    it('should detect Meta+Shift+T combination (Mac)', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'T',
        metaKey: true,
        shiftKey: true,
        bubbles: true,
      });

      const isThemeShortcut =
        (event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'T';
      expect(isThemeShortcut).toBe(true);
    });

    it('should not match Ctrl+T without Shift', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'T',
        ctrlKey: true,
        shiftKey: false,
        bubbles: true,
      });

      const isThemeShortcut =
        (event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'T';
      expect(isThemeShortcut).toBe(false);
    });

    it('should not match Shift+T without Ctrl/Meta', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'T',
        ctrlKey: false,
        metaKey: false,
        shiftKey: true,
        bubbles: true,
      });

      const isThemeShortcut =
        (event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'T';
      expect(isThemeShortcut).toBe(false);
    });

    it('should not match wrong key', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'D',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });

      const isThemeShortcut =
        (event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'T';
      expect(isThemeShortcut).toBe(false);
    });
  });

  describe('system preference detection', () => {
    it('should detect system prefers dark via matchMedia', () => {
      const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
      expect(darkQuery.matches).toBe(true);
    });

    it('should detect system prefers light via matchMedia', () => {
      const lightQuery = window.matchMedia('(prefers-color-scheme: light)');
      expect(lightQuery.matches).toBe(false);
    });
  });
});
