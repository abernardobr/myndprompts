/**
 * Theme Composable
 *
 * Provides theme management functionality including:
 * - Light/dark/system theme modes
 * - Theme toggle functionality
 * - System preference detection
 * - Keyboard shortcut support
 */

import { computed, onMounted, onUnmounted } from 'vue';
import { useUIStore, type Theme } from '@/stores/uiStore';

export type ThemeMode = Theme;

export function useTheme() {
  const uiStore = useUIStore();

  // Current theme preference (user choice)
  const themeMode = computed(() => uiStore.theme);

  // Actual applied theme (resolved from system if needed)
  const effectiveTheme = computed(() => uiStore.effectiveTheme);

  // Whether dark mode is active
  const isDark = computed(() => uiStore.isDarkMode);

  // Detect system preference
  const systemPrefersDark = computed(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  /**
   * Set theme mode
   */
  function setTheme(mode: ThemeMode): void {
    uiStore.setTheme(mode);
  }

  /**
   * Toggle between light and dark themes
   * If currently in system mode, switches to the opposite of current effective theme
   */
  function toggleTheme(): void {
    const newMode = isDark.value ? 'light' : 'dark';
    setTheme(newMode);
  }

  /**
   * Cycle through themes: light -> dark -> system -> light
   */
  function cycleTheme(): void {
    const modes: ThemeMode[] = ['light', 'dark', 'system'];
    const currentIndex = modes.indexOf(themeMode.value);
    const nextIndex = (currentIndex + 1) % modes.length;
    setTheme(modes[nextIndex]);
  }

  /**
   * Handle keyboard shortcut for theme toggle
   */
  function handleKeyboardShortcut(event: KeyboardEvent): void {
    // Ctrl+Shift+T (Windows/Linux) or Cmd+Shift+T (Mac)
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'T') {
      event.preventDefault();
      toggleTheme();
    }
  }

  /**
   * Setup keyboard shortcut listener
   */
  function setupKeyboardShortcut(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyboardShortcut);
    }
  }

  /**
   * Cleanup keyboard shortcut listener
   */
  function cleanupKeyboardShortcut(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleKeyboardShortcut);
    }
  }

  // Setup and cleanup keyboard shortcut on mount/unmount
  onMounted(() => {
    setupKeyboardShortcut();
  });

  onUnmounted(() => {
    cleanupKeyboardShortcut();
  });

  return {
    // State
    themeMode,
    effectiveTheme,
    isDark,
    systemPrefersDark,

    // Actions
    setTheme,
    toggleTheme,
    cycleTheme,
  };
}
