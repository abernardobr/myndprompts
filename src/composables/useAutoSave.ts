/**
 * Auto-Save Composable
 *
 * Provides auto-save functionality for the editor.
 * Debounces content changes and automatically saves after a configurable delay.
 */

import { ref, onUnmounted, watch } from 'vue';
import { debounce, type DebouncedFunction } from '@/utils/debounce';
import { getConfigRepository, ConfigKeys } from '@/services/storage/repositories/config.repository';
import { DEFAULT_APP_CONFIG } from '@/types/config';

interface AutoSaveOptions {
  /** Function to call when saving */
  onSave: (filePath: string) => Promise<void>;
  /** Called when auto-save starts */
  onSaveStart?: (filePath: string) => void;
  /** Called when auto-save completes successfully */
  onSaveComplete?: (filePath: string) => void;
  /** Called when auto-save fails */
  onSaveError?: (filePath: string, error: Error) => void;
}

interface AutoSaveState {
  /** Whether auto-save is enabled */
  enabled: boolean;
  /** Delay in milliseconds before saving */
  delay: number;
  /** Whether a save is currently in progress */
  isSaving: boolean;
  /** File path currently being saved */
  savingFilePath: string | null;
}

export function useAutoSave(options: AutoSaveOptions) {
  const configRepo = getConfigRepository();

  // State
  const state = ref<AutoSaveState>({
    enabled: DEFAULT_APP_CONFIG.autoSave,
    delay: DEFAULT_APP_CONFIG.autoSaveDelay,
    isSaving: false,
    savingFilePath: null,
  });

  // Track pending saves per file path
  const pendingSaves = new Map<string, DebouncedFunction<(filePath: string) => Promise<void>>>();

  // Track if composable is still active (not unmounted)
  let isActive = true;

  /**
   * Load auto-save settings from config
   */
  async function loadSettings(): Promise<void> {
    try {
      const [enabled, delay] = await Promise.all([
        configRepo.getOrDefault<boolean>(ConfigKeys.AUTO_SAVE, DEFAULT_APP_CONFIG.autoSave),
        configRepo.getOrDefault<number>(
          ConfigKeys.AUTO_SAVE_DELAY,
          DEFAULT_APP_CONFIG.autoSaveDelay
        ),
      ]);

      state.value.enabled = enabled;
      state.value.delay = delay;
    } catch (error) {
      console.warn('Failed to load auto-save settings, using defaults:', error);
    }
  }

  /**
   * Create a debounced save function for a specific file
   */
  function getOrCreateDebouncedSave(
    filePath: string
  ): DebouncedFunction<(filePath: string) => Promise<void>> {
    let debouncedSave = pendingSaves.get(filePath);

    if (!debouncedSave) {
      const saveFunction = async (fp: string): Promise<void> => {
        if (!isActive) return;

        state.value.isSaving = true;
        state.value.savingFilePath = fp;
        options.onSaveStart?.(fp);

        try {
          await options.onSave(fp);
          if (isActive) {
            options.onSaveComplete?.(fp);
          }
        } catch (error) {
          if (isActive) {
            options.onSaveError?.(fp, error instanceof Error ? error : new Error(String(error)));
          }
        } finally {
          if (isActive) {
            state.value.isSaving = false;
            state.value.savingFilePath = null;
          }
        }
      };

      debouncedSave = debounce(saveFunction, state.value.delay);
      pendingSaves.set(filePath, debouncedSave);
    }

    return debouncedSave;
  }

  /**
   * Schedule an auto-save for a file
   */
  function scheduleAutoSave(filePath: string): void {
    if (!state.value.enabled) return;

    const debouncedSave = getOrCreateDebouncedSave(filePath);
    debouncedSave(filePath);
  }

  /**
   * Cancel a pending auto-save for a file
   */
  function cancelAutoSave(filePath: string): void {
    const debouncedSave = pendingSaves.get(filePath);
    if (debouncedSave) {
      debouncedSave.cancel();
    }
  }

  /**
   * Cancel all pending auto-saves
   */
  function cancelAllAutoSaves(): void {
    for (const debouncedSave of pendingSaves.values()) {
      debouncedSave.cancel();
    }
  }

  /**
   * Force immediate save for a file (flushes pending save)
   */
  function flushAutoSave(filePath: string): void {
    const debouncedSave = pendingSaves.get(filePath);
    if (debouncedSave) {
      debouncedSave.flush();
    }
  }

  /**
   * Check if a file has a pending auto-save
   */
  function hasPendingAutoSave(filePath: string): boolean {
    const debouncedSave = pendingSaves.get(filePath);
    return debouncedSave?.pending() ?? false;
  }

  /**
   * Update auto-save settings
   */
  async function updateSettings(enabled?: boolean, delay?: number): Promise<void> {
    if (enabled !== undefined) {
      state.value.enabled = enabled;
      await configRepo.set(ConfigKeys.AUTO_SAVE, enabled);

      // If disabled, cancel all pending saves
      if (!enabled) {
        cancelAllAutoSaves();
      }
    }

    if (delay !== undefined) {
      state.value.delay = delay;
      await configRepo.set(ConfigKeys.AUTO_SAVE_DELAY, delay);

      // Clear existing debounced functions so they'll be recreated with new delay
      pendingSaves.clear();
    }
  }

  /**
   * Clean up a specific file's auto-save (call when closing a file)
   */
  function cleanupFile(filePath: string): void {
    cancelAutoSave(filePath);
    pendingSaves.delete(filePath);
  }

  // Load settings on initialization
  void loadSettings();

  // Watch for setting changes (if they're modified elsewhere)
  const unwatchEnabled = watch(
    () => state.value.enabled,
    (newEnabled) => {
      if (!newEnabled) {
        cancelAllAutoSaves();
      }
    }
  );

  // Cleanup on unmount
  onUnmounted(() => {
    isActive = false;
    cancelAllAutoSaves();
    pendingSaves.clear();
    unwatchEnabled();
  });

  return {
    // State
    state,

    // Actions
    scheduleAutoSave,
    cancelAutoSave,
    cancelAllAutoSaves,
    flushAutoSave,
    hasPendingAutoSave,
    updateSettings,
    cleanupFile,
    loadSettings,
  };
}
