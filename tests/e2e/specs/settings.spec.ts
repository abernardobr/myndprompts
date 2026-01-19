import { test, expect, MyndPromptsApp, TestData } from '../helpers';

/**
 * E2E Tests for Settings
 *
 * Tests cover:
 * - Theme selection
 * - Language selection
 * - Category management
 * - Settings persistence
 */

test.describe('Settings', () => {
  let app: MyndPromptsApp;

  test.beforeEach(async ({ window }) => {
    app = new MyndPromptsApp(window);
    await app.waitForAppReady();
    await app.navigateTo('settings');
  });

  test.describe('Theme Selection', () => {
    test('should switch to light theme', async ({ window }) => {
      await app.settings.selectTheme('light');
      await window.waitForTimeout(500);

      // Body should have light theme class
      const body = window.locator('body');
      await expect(body).toHaveClass(/body--light/);
    });

    test('should switch to dark theme', async ({ window }) => {
      await app.settings.selectTheme('dark');
      await window.waitForTimeout(500);

      // Body should have dark theme class
      const body = window.locator('body');
      await expect(body).toHaveClass(/body--dark/);
    });

    test('should switch to system theme', async ({ window }) => {
      await app.settings.selectTheme('system');
      await window.waitForTimeout(500);

      // Should follow system preference (either light or dark)
      const body = window.locator('body');
      const classList = await body.getAttribute('class');
      expect(classList).toMatch(/body--light|body--dark/);
    });

    test('should persist theme after navigation', async ({ window }) => {
      await app.settings.selectTheme('dark');
      await window.waitForTimeout(500);

      // Navigate away
      await app.navigateTo('explorer');
      await window.waitForTimeout(300);

      // Navigate back
      await app.navigateTo('settings');
      await window.waitForTimeout(300);

      // Theme should still be dark
      const body = window.locator('body');
      await expect(body).toHaveClass(/body--dark/);
    });

    test('should show theme preview', async ({ window }) => {
      // Click on theme selector to see options
      await app.settings.themeSelector.click();
      await window.waitForTimeout(300);

      // Theme options should be visible
      const lightOption = window.locator('[data-testid="theme-option"][data-value="light"]');
      const darkOption = window.locator('[data-testid="theme-option"][data-value="dark"]');
      const systemOption = window.locator('[data-testid="theme-option"][data-value="system"]');

      await expect(lightOption).toBeVisible();
      await expect(darkOption).toBeVisible();
      await expect(systemOption).toBeVisible();
    });
  });

  test.describe('Language Selection', () => {
    test('should switch to Spanish', async ({ window }) => {
      await app.settings.selectLanguage('es-ES');
      await window.waitForTimeout(500);

      // UI text should be in Spanish
      const settingsHeader = window.locator('[data-testid="settings-header"]');
      await expect(settingsHeader).toContainText(/Configuración|Ajustes/i);
    });

    test('should switch to French', async ({ window }) => {
      await app.settings.selectLanguage('fr-FR');
      await window.waitForTimeout(500);

      // UI text should be in French
      const settingsHeader = window.locator('[data-testid="settings-header"]');
      await expect(settingsHeader).toContainText(/Paramètres|Configuration/i);
    });

    test('should switch to Portuguese (Brazil)', async ({ window }) => {
      await app.settings.selectLanguage('pt-BR');
      await window.waitForTimeout(500);

      // UI text should be in Portuguese
      const settingsHeader = window.locator('[data-testid="settings-header"]');
      await expect(settingsHeader).toContainText(/Configurações/i);
    });

    test('should switch to German', async ({ window }) => {
      await app.settings.selectLanguage('de-DE');
      await window.waitForTimeout(500);

      // UI text should be in German
      const settingsHeader = window.locator('[data-testid="settings-header"]');
      await expect(settingsHeader).toContainText(/Einstellungen/i);
    });

    test('should switch back to English', async ({ window }) => {
      // Switch to another language first
      await app.settings.selectLanguage('es-ES');
      await window.waitForTimeout(500);

      // Switch back to English
      await app.settings.selectLanguage('en-US');
      await window.waitForTimeout(500);

      // UI text should be in English
      const settingsHeader = window.locator('[data-testid="settings-header"]');
      await expect(settingsHeader).toContainText(/Settings/i);
    });

    test('should persist language after navigation', async ({ window }) => {
      await app.settings.selectLanguage('fr-FR');
      await window.waitForTimeout(500);

      // Navigate away and back
      await app.navigateTo('explorer');
      await window.waitForTimeout(300);
      await app.navigateTo('settings');
      await window.waitForTimeout(300);

      // Language should still be French
      const settingsHeader = window.locator('[data-testid="settings-header"]');
      await expect(settingsHeader).toContainText(/Paramètres|Configuration/i);
    });

    test('should update status bar language indicator', async ({ window }) => {
      await app.settings.selectLanguage('es-ES');
      await window.waitForTimeout(500);

      // Status bar should show Spanish
      const languageIndicator = window.locator('[data-testid="current-language"]');
      await expect(languageIndicator).toContainText(/es|ES|Español/i);
    });
  });

  test.describe('Category Management', () => {
    test('should display default categories', async ({ window }) => {
      // Default categories should be visible
      const categoryList = window.locator('[data-testid="category-list"]');
      await expect(categoryList).toBeVisible();

      // Should have some default categories
      const categoryItems = window.locator('[data-testid="category-item"]');
      const count = await categoryItems.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should add a new category', async ({ window }) => {
      const newCategoryName = 'Custom Category';

      await app.settings.addCategory(newCategoryName);
      await window.waitForTimeout(500);

      // New category should appear
      const categoryItem = window.locator(
        `[data-testid="category-item"][data-name="${newCategoryName}"]`
      );
      await expect(categoryItem).toBeVisible();
    });

    test('should show validation error for empty category name', async ({ window }) => {
      await app.settings.addCategoryButton.click();
      await window.waitForTimeout(300);

      // Try to save empty name
      await window.locator('[data-testid="save-category-btn"]').click();

      // Error should appear
      const errorMessage = window.locator('[data-testid="category-name-error"]');
      await expect(errorMessage).toBeVisible();
    });

    test('should show validation error for duplicate category name', async ({ window }) => {
      // Add a category
      await app.settings.addCategory('Unique Category');
      await window.waitForTimeout(500);

      // Try to add same name again
      await app.settings.addCategoryButton.click();
      await window.locator('[data-testid="new-category-input"]').fill('Unique Category');
      await window.locator('[data-testid="save-category-btn"]').click();

      // Error should appear
      const errorMessage = window.locator('[data-testid="category-name-error"]');
      await expect(errorMessage).toBeVisible();
    });

    test('should delete a category', async ({ window }) => {
      // Add a category first
      const categoryToDelete = 'Delete Me';
      await app.settings.addCategory(categoryToDelete);
      await window.waitForTimeout(500);

      const initialCount = await window.locator('[data-testid="category-item"]').count();

      // Delete it
      await app.settings.deleteCategory(categoryToDelete);
      await window.waitForTimeout(500);

      // Category should be gone
      const categoryItem = window.locator(
        `[data-testid="category-item"][data-name="${categoryToDelete}"]`
      );
      await expect(categoryItem).toBeHidden();

      // Count should decrease
      const newCount = await window.locator('[data-testid="category-item"]').count();
      expect(newCount).toBe(initialCount - 1);
    });

    test('should confirm before deleting category', async ({ window }) => {
      // Add a category
      await app.settings.addCategory('Confirm Delete');
      await window.waitForTimeout(500);

      // Click delete button
      const categoryItem = window.locator(
        '[data-testid="category-item"][data-name="Confirm Delete"]'
      );
      await categoryItem.locator('[data-testid="delete-category-btn"]').click();

      // Confirmation should appear
      const confirmDialog = window.locator('[data-testid="delete-confirm-dialog"]');
      await expect(confirmDialog).toBeVisible();
    });

    test('should edit category name', async ({ window }) => {
      // Add a category
      const originalName = 'Original Name';
      await app.settings.addCategory(originalName);
      await window.waitForTimeout(500);

      // Click edit button
      const categoryItem = window.locator(
        `[data-testid="category-item"][data-name="${originalName}"]`
      );
      await categoryItem.locator('[data-testid="edit-category-btn"]').click();

      // Enter new name
      const newName = 'Edited Name';
      await window.locator('[data-testid="edit-category-input"]').fill(newName);
      await window.locator('[data-testid="save-category-btn"]').click();

      await window.waitForTimeout(500);

      // New name should appear
      const editedItem = window.locator(`[data-testid="category-item"][data-name="${newName}"]`);
      await expect(editedItem).toBeVisible();

      // Old name should be gone
      const oldItem = window.locator(`[data-testid="category-item"][data-name="${originalName}"]`);
      await expect(oldItem).toBeHidden();
    });

    test('should reorder categories by drag and drop', async ({ window }) => {
      // Ensure we have multiple categories
      await app.settings.addCategory('Category A');
      await app.settings.addCategory('Category B');
      await app.settings.addCategory('Category C');
      await window.waitForTimeout(500);

      // Get initial order
      const categoryItems = window.locator('[data-testid="category-item"]');
      const initialFirst = await categoryItems.first().getAttribute('data-name');

      // Find drag handle for first category
      const dragHandle = categoryItems.first().locator('[data-testid="drag-handle"]');

      // Drag to second position
      const secondCategory = categoryItems.nth(1);
      await dragHandle.dragTo(secondCategory);

      await window.waitForTimeout(500);

      // First item should have changed
      const newFirst = await categoryItems.first().getAttribute('data-name');
      expect(newFirst).not.toBe(initialFirst);
    });

    test('should reset categories to defaults', async ({ window }) => {
      // Add custom categories
      await app.settings.addCategory('Custom 1');
      await app.settings.addCategory('Custom 2');
      await window.waitForTimeout(500);

      // Click reset button
      const resetButton = window.locator('[data-testid="reset-categories-btn"]');
      await resetButton.click();

      // Confirm reset
      const confirmDialog = window.locator('[data-testid="reset-confirm-dialog"]');
      await expect(confirmDialog).toBeVisible();
      await window.locator('[data-testid="confirm-reset-btn"]').click();

      await window.waitForTimeout(500);

      // Custom categories should be gone
      const custom1 = window.locator('[data-testid="category-item"][data-name="Custom 1"]');
      const custom2 = window.locator('[data-testid="category-item"][data-name="Custom 2"]');
      await expect(custom1).toBeHidden();
      await expect(custom2).toBeHidden();
    });
  });

  test.describe('Settings Persistence', () => {
    test('should persist theme preference', async ({ window }) => {
      await app.settings.selectTheme('dark');
      await window.waitForTimeout(500);

      // Reload (simulate by closing and reopening settings)
      await app.navigateTo('explorer');
      await window.waitForTimeout(500);
      await app.navigateTo('settings');
      await window.waitForTimeout(500);

      // Theme should still be dark
      const body = window.locator('body');
      await expect(body).toHaveClass(/body--dark/);
    });

    test('should persist language preference', async ({ window }) => {
      await app.settings.selectLanguage('pt-BR');
      await window.waitForTimeout(500);

      // Navigate away and back
      await app.navigateTo('explorer');
      await window.waitForTimeout(500);
      await app.navigateTo('settings');
      await window.waitForTimeout(500);

      // Language should be Portuguese
      const languageSelector = window.locator('[data-testid="language-selector"]');
      await expect(languageSelector).toContainText(/pt-BR|Português/i);
    });

    test('should persist category changes', async ({ window }) => {
      // Add a custom category
      await app.settings.addCategory('Persistent Category');
      await window.waitForTimeout(500);

      // Navigate away and back
      await app.navigateTo('explorer');
      await window.waitForTimeout(500);
      await app.navigateTo('settings');
      await window.waitForTimeout(500);

      // Category should still exist
      const categoryItem = window.locator(
        '[data-testid="category-item"][data-name="Persistent Category"]'
      );
      await expect(categoryItem).toBeVisible();
    });
  });

  test.describe('Settings UI', () => {
    test('should display settings sections', async ({ window }) => {
      // Appearance section
      const appearanceSection = window.locator('[data-testid="appearance-section"]');
      await expect(appearanceSection).toBeVisible();

      // Language section
      const languageSection = window.locator('[data-testid="language-section"]');
      await expect(languageSection).toBeVisible();

      // Categories section
      const categoriesSection = window.locator('[data-testid="categories-section"]');
      await expect(categoriesSection).toBeVisible();
    });

    test('should have accessible theme options', async ({ window }) => {
      // Each theme option should be keyboard accessible
      await app.settings.themeSelector.focus();
      await window.keyboard.press('Enter');
      await window.waitForTimeout(300);

      // Options should be visible
      const themeOptions = window.locator('[data-testid="theme-option"]');
      const count = await themeOptions.count();
      expect(count).toBe(3); // light, dark, system
    });

    test('should display current settings values', async ({ window }) => {
      // Theme selector should show current theme
      const themeSelector = window.locator('[data-testid="theme-selector"]');
      const themeValue = await themeSelector.textContent();
      expect(themeValue).toMatch(/Light|Dark|System/i);

      // Language selector should show current language
      const languageSelector = window.locator('[data-testid="language-selector"]');
      const langValue = await languageSelector.textContent();
      expect(langValue?.length).toBeGreaterThan(0);
    });
  });
});
