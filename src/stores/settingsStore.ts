/**
 * Settings Store
 *
 * Manages application settings including prompt categories.
 * Settings are persisted to IndexedDB via ConfigRepository.
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getConfigRepository, ConfigKeys } from '@/services/storage/repositories/config.repository';

/**
 * Category interface for prompt categorization
 */
export interface ICategory {
  label: string;
  value: string;
}

/**
 * Default categories provided on first run
 */
const DEFAULT_CATEGORIES: ICategory[] = [
  { label: 'General', value: 'general' },
  { label: 'Development', value: 'development' },
  { label: 'Writing', value: 'writing' },
  { label: 'Analysis', value: 'analysis' },
  { label: 'Creative', value: 'creative' },
  { label: 'Business', value: 'business' },
];

export const useSettingsStore = defineStore('settings', () => {
  // State
  const isInitialized = ref(false);
  const isLoading = ref(false);
  const categories = ref<ICategory[]>([]);

  // Repository
  const configRepository = getConfigRepository();

  /**
   * Initialize the store by loading settings from IndexedDB
   */
  async function initialize(): Promise<void> {
    if (isInitialized.value) return;

    try {
      isLoading.value = true;

      // Load categories from storage
      const storedCategories = await configRepository.get<ICategory[]>(
        ConfigKeys.PROMPT_CATEGORIES
      );

      if (storedCategories && storedCategories.length > 0) {
        categories.value = storedCategories;
      } else {
        // Initialize with defaults on first run
        categories.value = [...DEFAULT_CATEGORIES];
        await saveCategories();
      }

      isInitialized.value = true;
    } catch (error) {
      console.error('Failed to initialize settings store:', error);
      // Fall back to defaults
      categories.value = [...DEFAULT_CATEGORIES];
      isInitialized.value = true;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Save categories to IndexedDB
   */
  async function saveCategories(): Promise<void> {
    try {
      // Convert reactive array to plain objects for IndexedDB storage
      const plainCategories = categories.value.map((c) => ({
        label: c.label,
        value: c.value,
      }));
      await configRepository.set(ConfigKeys.PROMPT_CATEGORIES, plainCategories);
    } catch (error) {
      console.error('Failed to save categories:', error);
      throw error;
    }
  }

  /**
   * Add a new category
   */
  async function addCategory(label: string): Promise<ICategory> {
    const value = label
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    // Check for duplicates
    if (categories.value.some((c) => c.value === value)) {
      throw new Error(`Category "${label}" already exists`);
    }

    const newCategory: ICategory = { label: label.trim(), value };
    categories.value.push(newCategory);
    await saveCategories();
    return newCategory;
  }

  /**
   * Update an existing category
   */
  async function updateCategory(oldValue: string, newLabel: string): Promise<ICategory> {
    const index = categories.value.findIndex((c) => c.value === oldValue);
    if (index === -1) {
      throw new Error(`Category not found: ${oldValue}`);
    }

    const newValue = newLabel
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    // Check for duplicates (excluding current category)
    if (categories.value.some((c, i) => c.value === newValue && i !== index)) {
      throw new Error(`Category "${newLabel}" already exists`);
    }

    const updatedCategory: ICategory = { label: newLabel.trim(), value: newValue };
    categories.value[index] = updatedCategory;
    await saveCategories();
    return updatedCategory;
  }

  /**
   * Remove a category
   */
  async function removeCategory(value: string): Promise<void> {
    const index = categories.value.findIndex((c) => c.value === value);
    if (index === -1) {
      throw new Error(`Category not found: ${value}`);
    }

    categories.value.splice(index, 1);
    await saveCategories();
  }

  /**
   * Reorder categories
   */
  async function reorderCategories(fromIndex: number, toIndex: number): Promise<void> {
    if (fromIndex < 0 || fromIndex >= categories.value.length) return;
    if (toIndex < 0 || toIndex >= categories.value.length) return;

    const [moved] = categories.value.splice(fromIndex, 1);
    if (moved) {
      categories.value.splice(toIndex, 0, moved);
      await saveCategories();
    }
  }

  /**
   * Reset categories to defaults
   */
  async function resetCategoriesToDefaults(): Promise<void> {
    categories.value = [...DEFAULT_CATEGORIES];
    await saveCategories();
  }

  /**
   * Get category by value
   */
  function getCategoryByValue(value: string): ICategory | undefined {
    return categories.value.find((c) => c.value === value);
  }

  return {
    // State
    isInitialized,
    isLoading,
    categories,

    // Actions
    initialize,
    addCategory,
    updateCategory,
    removeCategory,
    reorderCategories,
    resetCategoriesToDefaults,
    getCategoryByValue,
  };
});
