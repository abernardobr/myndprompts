import {
  test,
  expect,
  MyndPromptsApp,
  TestData,
  generateProjectName,
  generatePromptName,
} from '../helpers';
import { testPrompts } from '../fixtures/test-prompts';

/**
 * E2E Tests for Prompt Management
 *
 * Tests cover:
 * - Creating prompts
 * - Opening prompts in editor
 * - Editing prompt content
 * - Saving prompts
 * - Deleting prompts
 * - Favorites management
 * - Prompt metadata
 */

test.describe('Prompt Management', () => {
  let app: MyndPromptsApp;
  let projectName: string;

  test.beforeEach(async ({ window }) => {
    app = new MyndPromptsApp(window);
    await app.waitForAppReady();

    // Create a test project for prompts
    projectName = generateProjectName();
    await app.createProject(projectName);
    await window.waitForTimeout(500);
    await app.explorer.selectProject(projectName);
  });

  test.describe('Create Prompt', () => {
    test('should create a new prompt with title and category', async ({ window }) => {
      const promptTitle = generatePromptName();

      await app.explorer.clickNewPrompt();
      await app.dialogs.waitForDialog('new-prompt-dialog');

      await app.dialogs.fillNewPromptDialog(promptTitle, 'development');
      await app.dialogs.confirmDialog();

      await window.waitForTimeout(500);

      // Verify prompt appears in explorer
      const promptItem = window.locator(`[data-testid="file-item"][data-name="${promptTitle}"]`);
      await expect(promptItem).toBeVisible({ timeout: 5000 });
    });

    test('should create a prompt with default category', async ({ window }) => {
      const promptTitle = generatePromptName();

      await app.explorer.clickNewPrompt();
      await app.dialogs.waitForDialog('new-prompt-dialog');

      // Only fill title, leave category as default
      await window.locator('[data-testid="prompt-title-input"]').fill(promptTitle);
      await app.dialogs.confirmDialog();

      await window.waitForTimeout(500);

      // Verify prompt was created
      const promptItem = window.locator(`[data-testid="file-item"][data-name="${promptTitle}"]`);
      await expect(promptItem).toBeVisible({ timeout: 5000 });
    });

    test('should show validation error for empty title', async ({ window }) => {
      await app.explorer.clickNewPrompt();
      await app.dialogs.waitForDialog('new-prompt-dialog');

      // Submit without title
      await app.dialogs.confirmDialog();

      // Error message should appear
      const errorMessage = window.locator('[data-testid="prompt-title-error"]');
      await expect(errorMessage).toBeVisible();
    });

    test('should show validation error for title too long', async ({ window }) => {
      await app.explorer.clickNewPrompt();
      await app.dialogs.waitForDialog('new-prompt-dialog');

      // Enter title exceeding 100 characters
      const longTitle = 'A'.repeat(101);
      await window.locator('[data-testid="prompt-title-input"]').fill(longTitle);
      await app.dialogs.confirmDialog();

      // Error message should appear
      const errorMessage = window.locator('[data-testid="prompt-title-error"]');
      await expect(errorMessage).toBeVisible();
    });

    test('should auto-generate filename from title', async ({ window }) => {
      const promptTitle = 'My Test Prompt';
      const expectedFileName = 'my-test-prompt.md';

      await app.explorer.clickNewPrompt();
      await app.dialogs.waitForDialog('new-prompt-dialog');
      await app.dialogs.fillNewPromptDialog(promptTitle, 'general');
      await app.dialogs.confirmDialog();

      await window.waitForTimeout(500);

      // File should be created with kebab-case name
      const promptItem = window.locator(
        `[data-testid="file-item"][data-filename="${expectedFileName}"]`
      );
      await expect(promptItem).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Open and Edit Prompt', () => {
    test('should open prompt in editor on double-click', async ({ window }) => {
      // Create a prompt
      const promptTitle = generatePromptName();
      await app.createPrompt(promptTitle, 'general');
      await window.waitForTimeout(500);

      // Double-click to open
      await app.explorer.selectFile(promptTitle);

      // Wait for editor to load
      await app.editor.waitForEditor();

      // Tab should appear
      const tab = window.locator(`[data-testid="tab"][data-name="${promptTitle}"]`);
      await expect(tab).toBeVisible();
    });

    test('should display prompt content in editor', async ({ window }) => {
      const promptTitle = generatePromptName();
      await app.createPrompt(promptTitle, 'general');
      await window.waitForTimeout(500);

      // Open the prompt
      await app.explorer.selectFile(promptTitle);
      await app.editor.waitForEditor();

      // Editor should have content (at least the frontmatter)
      const content = await app.editor.getContent();
      expect(content).toContain(promptTitle);
    });

    test('should mark tab as dirty when content is modified', async ({ window }) => {
      const promptTitle = generatePromptName();
      await app.createPrompt(promptTitle, 'general');
      await window.waitForTimeout(500);

      await app.explorer.selectFile(promptTitle);
      await app.editor.waitForEditor();

      // Modify content
      await app.editor.typeContent('\nNew content added');

      // Tab should show dirty indicator
      const isDirty = await app.tabBar.isTabDirty(promptTitle);
      expect(isDirty).toBe(true);
    });

    test('should save prompt with Cmd+S', async ({ window }) => {
      const promptTitle = generatePromptName();
      await app.createPrompt(promptTitle, 'general');
      await window.waitForTimeout(500);

      await app.explorer.selectFile(promptTitle);
      await app.editor.waitForEditor();

      // Modify content
      await app.editor.typeContent('\nModified content');

      // Save
      await app.editor.save();
      await window.waitForTimeout(500);

      // Tab should no longer be dirty
      const isDirty = await app.tabBar.isTabDirty(promptTitle);
      expect(isDirty).toBe(false);
    });

    test('should support undo/redo operations', async ({ window }) => {
      const promptTitle = generatePromptName();
      await app.createPrompt(promptTitle, 'general');
      await window.waitForTimeout(500);

      await app.explorer.selectFile(promptTitle);
      await app.editor.waitForEditor();

      const originalContent = await app.editor.getContent();

      // Add content
      await app.editor.typeContent('\nUndoable content');
      const modifiedContent = await app.editor.getContent();
      expect(modifiedContent).toContain('Undoable content');

      // Undo
      await app.editor.undo();
      await window.waitForTimeout(300);

      // Content should be restored (approximately)
      const undoneContent = await app.editor.getContent();
      expect(undoneContent).not.toContain('Undoable content');
    });
  });

  test.describe('Delete Prompt', () => {
    test('should delete prompt with confirmation', async ({ window }) => {
      const promptTitle = generatePromptName();
      await app.createPrompt(promptTitle, 'general');
      await window.waitForTimeout(500);

      // Right-click and delete
      await app.explorer.rightClickFile(promptTitle);
      await window.locator('[data-testid="context-menu-delete"]').click();

      // Confirm deletion
      await app.dialogs.waitForDialog('delete-confirm-dialog');
      await app.dialogs.confirmDelete();

      await window.waitForTimeout(500);

      // Prompt should be removed
      const promptItem = window.locator(`[data-testid="file-item"][data-name="${promptTitle}"]`);
      await expect(promptItem).toBeHidden();
    });

    test('should close tab when deleting open prompt', async ({ window }) => {
      const promptTitle = generatePromptName();
      await app.createPrompt(promptTitle, 'general');
      await window.waitForTimeout(500);

      // Open the prompt
      await app.explorer.selectFile(promptTitle);
      await app.editor.waitForEditor();

      // Verify tab is open
      const tab = window.locator(`[data-testid="tab"][data-name="${promptTitle}"]`);
      await expect(tab).toBeVisible();

      // Delete the prompt
      await app.explorer.rightClickFile(promptTitle);
      await window.locator('[data-testid="context-menu-delete"]').click();
      await app.dialogs.waitForDialog('delete-confirm-dialog');
      await app.dialogs.confirmDelete();

      await window.waitForTimeout(500);

      // Tab should be closed
      await expect(tab).toBeHidden();
    });

    test('should cancel prompt deletion', async ({ window }) => {
      const promptTitle = generatePromptName();
      await app.createPrompt(promptTitle, 'general');
      await window.waitForTimeout(500);

      // Right-click and delete
      await app.explorer.rightClickFile(promptTitle);
      await window.locator('[data-testid="context-menu-delete"]').click();

      // Cancel deletion
      await app.dialogs.waitForDialog('delete-confirm-dialog');
      await app.dialogs.cancelDialog();

      await window.waitForTimeout(500);

      // Prompt should still exist
      const promptItem = window.locator(`[data-testid="file-item"][data-name="${promptTitle}"]`);
      await expect(promptItem).toBeVisible();
    });
  });

  test.describe('Favorites', () => {
    test('should add prompt to favorites', async ({ window }) => {
      const promptTitle = generatePromptName();
      await app.createPrompt(promptTitle, 'general');
      await window.waitForTimeout(500);

      // Right-click and add to favorites
      await app.explorer.rightClickFile(promptTitle);
      await window.locator('[data-testid="context-menu-add-favorite"]').click();

      await window.waitForTimeout(500);

      // Navigate to favorites panel
      await app.navigateTo('favorites');

      // Prompt should appear in favorites
      const favoriteItem = window.locator(
        `[data-testid="favorite-item"][data-name="${promptTitle}"]`
      );
      await expect(favoriteItem).toBeVisible({ timeout: 5000 });
    });

    test('should remove prompt from favorites', async ({ window }) => {
      const promptTitle = generatePromptName();
      await app.createPrompt(promptTitle, 'general');
      await window.waitForTimeout(500);

      // Add to favorites
      await app.explorer.rightClickFile(promptTitle);
      await window.locator('[data-testid="context-menu-add-favorite"]').click();
      await window.waitForTimeout(500);

      // Navigate to favorites
      await app.navigateTo('favorites');
      await window.waitForTimeout(300);

      // Remove from favorites
      const favoriteItem = window.locator(
        `[data-testid="favorite-item"][data-name="${promptTitle}"]`
      );
      await favoriteItem.click({ button: 'right' });
      await window.locator('[data-testid="context-menu-remove-favorite"]').click();

      await window.waitForTimeout(500);

      // Prompt should be removed from favorites
      await expect(favoriteItem).toBeHidden();
    });

    test('should open favorite prompt in editor', async ({ window }) => {
      const promptTitle = generatePromptName();
      await app.createPrompt(promptTitle, 'general');
      await window.waitForTimeout(500);

      // Add to favorites
      await app.explorer.rightClickFile(promptTitle);
      await window.locator('[data-testid="context-menu-add-favorite"]').click();
      await window.waitForTimeout(500);

      // Navigate to favorites and open
      await app.navigateTo('favorites');
      await app.favorites.selectFavorite(promptTitle);

      // Editor should open with the prompt
      await app.editor.waitForEditor();
      const activeTab = await app.tabBar.getActiveTabName();
      expect(activeTab).toBe(promptTitle);
    });
  });

  test.describe('Prompt Metadata', () => {
    test('should edit prompt metadata via dialog', async ({ window }) => {
      const promptTitle = generatePromptName();
      await app.createPrompt(promptTitle, 'general');
      await window.waitForTimeout(500);

      // Right-click and edit metadata
      await app.explorer.rightClickFile(promptTitle);
      await window.locator('[data-testid="context-menu-edit-metadata"]').click();

      // Edit metadata dialog should appear
      await app.dialogs.waitForDialog('edit-prompt-dialog');

      // Change category
      await window.locator('[data-testid="edit-category-select"]').selectOption('development');

      // Add tags
      await window.locator('[data-testid="edit-tags-input"]').fill('test, e2e, automation');

      // Save
      await app.dialogs.confirmDialog();

      await window.waitForTimeout(500);

      // Reopen dialog to verify changes
      await app.explorer.rightClickFile(promptTitle);
      await window.locator('[data-testid="context-menu-edit-metadata"]').click();
      await app.dialogs.waitForDialog('edit-prompt-dialog');

      // Verify category changed
      const categoryValue = await window
        .locator('[data-testid="edit-category-select"]')
        .inputValue();
      expect(categoryValue).toBe('development');
    });

    test('should display category badge in explorer', async ({ window }) => {
      const promptTitle = generatePromptName();
      await app.createPrompt(promptTitle, 'development');
      await window.waitForTimeout(500);

      // Category badge should be visible
      const promptItem = window.locator(`[data-testid="file-item"][data-name="${promptTitle}"]`);
      const categoryBadge = promptItem.locator('[data-testid="category-badge"]');
      await expect(categoryBadge).toContainText('development');
    });
  });

  test.describe('Copy Operations', () => {
    test('should copy prompt content to clipboard', async ({ window }) => {
      const promptTitle = generatePromptName();
      await app.createPrompt(promptTitle, 'general');
      await window.waitForTimeout(500);

      // Open prompt
      await app.explorer.selectFile(promptTitle);
      await app.editor.waitForEditor();

      // Right-click and copy content
      await app.explorer.rightClickFile(promptTitle);
      await window.locator('[data-testid="context-menu-copy-content"]').click();

      // Toast notification should appear
      const toast = window.locator('.q-notification', { hasText: 'Copied' });
      await expect(toast).toBeVisible({ timeout: 3000 });
    });

    test('should copy prompt path to clipboard', async ({ window }) => {
      const promptTitle = generatePromptName();
      await app.createPrompt(promptTitle, 'general');
      await window.waitForTimeout(500);

      // Right-click and copy path
      await app.explorer.rightClickFile(promptTitle);
      await window.locator('[data-testid="context-menu-copy-path"]').click();

      // Toast notification should appear
      const toast = window.locator('.q-notification', { hasText: 'path' });
      await expect(toast).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Rename Prompt', () => {
    test('should rename prompt', async ({ window }) => {
      const originalTitle = generatePromptName();
      await app.createPrompt(originalTitle, 'general');
      await window.waitForTimeout(500);

      // Right-click and rename
      await app.explorer.rightClickFile(originalTitle);
      await window.locator('[data-testid="context-menu-rename"]').click();

      // Enter new name
      await app.dialogs.waitForDialog('rename-dialog');
      const newTitle = generatePromptName();
      await app.dialogs.fillRenameDialog(newTitle);
      await app.dialogs.confirmDialog();

      await window.waitForTimeout(500);

      // New name should appear
      const renamedPrompt = window.locator(`[data-testid="file-item"][data-name="${newTitle}"]`);
      await expect(renamedPrompt).toBeVisible({ timeout: 5000 });

      // Old name should be gone
      const oldPrompt = window.locator(`[data-testid="file-item"][data-name="${originalTitle}"]`);
      await expect(oldPrompt).toBeHidden();
    });

    test('should update tab name when renaming open prompt', async ({ window }) => {
      const originalTitle = generatePromptName();
      await app.createPrompt(originalTitle, 'general');
      await window.waitForTimeout(500);

      // Open the prompt
      await app.explorer.selectFile(originalTitle);
      await app.editor.waitForEditor();

      // Verify tab name
      let tab = window.locator(`[data-testid="tab"][data-name="${originalTitle}"]`);
      await expect(tab).toBeVisible();

      // Rename
      await app.explorer.rightClickFile(originalTitle);
      await window.locator('[data-testid="context-menu-rename"]').click();
      await app.dialogs.waitForDialog('rename-dialog');
      const newTitle = generatePromptName();
      await app.dialogs.fillRenameDialog(newTitle);
      await app.dialogs.confirmDialog();

      await window.waitForTimeout(500);

      // Tab should have new name
      const newTab = window.locator(`[data-testid="tab"][data-name="${newTitle}"]`);
      await expect(newTab).toBeVisible();
    });
  });

  test.describe('Category Filtering', () => {
    test('should filter prompts by category', async ({ window }) => {
      // Create prompts with different categories
      const devPrompt = 'Development Prompt';
      const writePrompt = 'Writing Prompt';

      await app.createPrompt(devPrompt, 'development');
      await app.createPrompt(writePrompt, 'writing');
      await window.waitForTimeout(500);

      // Filter by development category
      await window.locator('[data-testid="category-filter"]').selectOption('development');
      await window.waitForTimeout(300);

      // Only development prompt should be visible
      const devItem = window.locator(`[data-testid="file-item"][data-name="${devPrompt}"]`);
      const writeItem = window.locator(`[data-testid="file-item"][data-name="${writePrompt}"]`);

      await expect(devItem).toBeVisible();
      await expect(writeItem).toBeHidden();
    });

    test('should show all prompts when filter is cleared', async ({ window }) => {
      // Create prompts
      const prompt1 = 'Prompt One';
      const prompt2 = 'Prompt Two';

      await app.createPrompt(prompt1, 'development');
      await app.createPrompt(prompt2, 'writing');
      await window.waitForTimeout(500);

      // Apply filter
      await window.locator('[data-testid="category-filter"]').selectOption('development');
      await window.waitForTimeout(300);

      // Clear filter (select "all")
      await window.locator('[data-testid="category-filter"]').selectOption('');
      await window.waitForTimeout(300);

      // Both prompts should be visible
      const item1 = window.locator(`[data-testid="file-item"][data-name="${prompt1}"]`);
      const item2 = window.locator(`[data-testid="file-item"][data-name="${prompt2}"]`);

      await expect(item1).toBeVisible();
      await expect(item2).toBeVisible();
    });
  });
});
