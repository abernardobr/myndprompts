import {
  test,
  expect,
  MyndPromptsApp,
  TestData,
  generateSnippetName,
  generatePromptName,
  generateProjectName,
} from '../helpers';

/**
 * E2E Tests for Snippet Management
 *
 * Tests cover:
 * - Creating snippets (persona, text, code, template)
 * - Snippet shortcuts
 * - Snippet autocomplete in editor
 * - Filtering snippets by type
 * - Editing and deleting snippets
 */

test.describe('Snippet Management', () => {
  let app: MyndPromptsApp;

  test.beforeEach(async ({ window }) => {
    app = new MyndPromptsApp(window);
    await app.waitForAppReady();
    await app.navigateTo('snippets');
  });

  test.describe('Create Snippet', () => {
    test('should create a persona snippet', async ({ window }) => {
      const snippetTitle = generateSnippetName();

      await app.snippets.clickNewSnippet();
      await app.dialogs.waitForDialog('new-snippet-dialog');

      await app.dialogs.fillNewSnippetDialog(snippetTitle, 'persona');
      await app.dialogs.confirmDialog();

      await window.waitForTimeout(500);

      // Verify snippet appears in list
      const snippetItem = window.locator(
        `[data-testid="snippet-item"][data-name="${snippetTitle}"]`
      );
      await expect(snippetItem).toBeVisible({ timeout: 5000 });

      // Verify type badge
      const typeBadge = snippetItem.locator('[data-testid="snippet-type-badge"]');
      await expect(typeBadge).toContainText('persona');
    });

    test('should create a text snippet', async ({ window }) => {
      const snippetTitle = generateSnippetName();

      await app.snippets.clickNewSnippet();
      await app.dialogs.waitForDialog('new-snippet-dialog');

      await app.dialogs.fillNewSnippetDialog(snippetTitle, 'text');
      await app.dialogs.confirmDialog();

      await window.waitForTimeout(500);

      const snippetItem = window.locator(
        `[data-testid="snippet-item"][data-name="${snippetTitle}"]`
      );
      await expect(snippetItem).toBeVisible({ timeout: 5000 });

      const typeBadge = snippetItem.locator('[data-testid="snippet-type-badge"]');
      await expect(typeBadge).toContainText('text');
    });

    test('should create a code snippet', async ({ window }) => {
      const snippetTitle = generateSnippetName();

      await app.snippets.clickNewSnippet();
      await app.dialogs.waitForDialog('new-snippet-dialog');

      await app.dialogs.fillNewSnippetDialog(snippetTitle, 'code');
      await app.dialogs.confirmDialog();

      await window.waitForTimeout(500);

      const snippetItem = window.locator(
        `[data-testid="snippet-item"][data-name="${snippetTitle}"]`
      );
      await expect(snippetItem).toBeVisible({ timeout: 5000 });

      const typeBadge = snippetItem.locator('[data-testid="snippet-type-badge"]');
      await expect(typeBadge).toContainText('code');
    });

    test('should create a template snippet', async ({ window }) => {
      const snippetTitle = generateSnippetName();

      await app.snippets.clickNewSnippet();
      await app.dialogs.waitForDialog('new-snippet-dialog');

      await app.dialogs.fillNewSnippetDialog(snippetTitle, 'template');
      await app.dialogs.confirmDialog();

      await window.waitForTimeout(500);

      const snippetItem = window.locator(
        `[data-testid="snippet-item"][data-name="${snippetTitle}"]`
      );
      await expect(snippetItem).toBeVisible({ timeout: 5000 });

      const typeBadge = snippetItem.locator('[data-testid="snippet-type-badge"]');
      await expect(typeBadge).toContainText('template');
    });

    test('should auto-generate shortcut from title', async ({ window }) => {
      const snippetTitle = 'My Custom Persona';
      const expectedShortcut = '@my-custom-persona';

      await app.snippets.clickNewSnippet();
      await app.dialogs.waitForDialog('new-snippet-dialog');

      // Fill only title and type
      await window.locator('[data-testid="snippet-title-input"]').fill(snippetTitle);
      await window.locator('[data-testid="snippet-type-select"]').selectOption('persona');

      // Check auto-generated shortcut
      const shortcutInput = window.locator('[data-testid="snippet-shortcut-input"]');
      const shortcutValue = await shortcutInput.inputValue();
      expect(shortcutValue).toBe(expectedShortcut);
    });

    test('should allow custom shortcut', async ({ window }) => {
      const snippetTitle = generateSnippetName();
      const customShortcut = '@custom-trigger';

      await app.snippets.clickNewSnippet();
      await app.dialogs.waitForDialog('new-snippet-dialog');

      await app.dialogs.fillNewSnippetDialog(snippetTitle, 'persona', customShortcut);
      await app.dialogs.confirmDialog();

      await window.waitForTimeout(500);

      // Verify shortcut is displayed
      const snippetItem = window.locator(
        `[data-testid="snippet-item"][data-name="${snippetTitle}"]`
      );
      const shortcutDisplay = snippetItem.locator('[data-testid="snippet-shortcut"]');
      await expect(shortcutDisplay).toContainText(customShortcut);
    });

    test('should validate empty title', async ({ window }) => {
      await app.snippets.clickNewSnippet();
      await app.dialogs.waitForDialog('new-snippet-dialog');

      // Select type but leave title empty
      await window.locator('[data-testid="snippet-type-select"]').selectOption('persona');
      await app.dialogs.confirmDialog();

      // Error should appear
      const errorMessage = window.locator('[data-testid="snippet-title-error"]');
      await expect(errorMessage).toBeVisible();
    });

    test('should validate shortcut format', async ({ window }) => {
      await app.snippets.clickNewSnippet();
      await app.dialogs.waitForDialog('new-snippet-dialog');

      await window.locator('[data-testid="snippet-title-input"]').fill('Test Snippet');
      await window.locator('[data-testid="snippet-type-select"]').selectOption('persona');

      // Enter invalid shortcut (should start with trigger character)
      await window.locator('[data-testid="snippet-shortcut-input"]').fill('invalid-shortcut');
      await app.dialogs.confirmDialog();

      // Error should appear
      const errorMessage = window.locator('[data-testid="snippet-shortcut-error"]');
      await expect(errorMessage).toBeVisible();
    });
  });

  test.describe('Filter Snippets', () => {
    test.beforeEach(async ({ window }) => {
      // Create snippets of each type
      await app.createSnippet('Test Persona', 'persona');
      await app.createSnippet('Test Text', 'text');
      await app.createSnippet('Test Code', 'code');
      await app.createSnippet('Test Template', 'template');
      await window.waitForTimeout(500);
    });

    test('should filter by persona type', async ({ window }) => {
      await app.snippets.filterByType('persona');
      await window.waitForTimeout(300);

      // Only persona snippets should be visible
      const personaItem = window.locator('[data-testid="snippet-item"][data-name="Test Persona"]');
      const textItem = window.locator('[data-testid="snippet-item"][data-name="Test Text"]');
      const codeItem = window.locator('[data-testid="snippet-item"][data-name="Test Code"]');
      const templateItem = window.locator(
        '[data-testid="snippet-item"][data-name="Test Template"]'
      );

      await expect(personaItem).toBeVisible();
      await expect(textItem).toBeHidden();
      await expect(codeItem).toBeHidden();
      await expect(templateItem).toBeHidden();
    });

    test('should filter by text type', async ({ window }) => {
      await app.snippets.filterByType('text');
      await window.waitForTimeout(300);

      const textItem = window.locator('[data-testid="snippet-item"][data-name="Test Text"]');
      await expect(textItem).toBeVisible();

      const personaItem = window.locator('[data-testid="snippet-item"][data-name="Test Persona"]');
      await expect(personaItem).toBeHidden();
    });

    test('should filter by code type', async ({ window }) => {
      await app.snippets.filterByType('code');
      await window.waitForTimeout(300);

      const codeItem = window.locator('[data-testid="snippet-item"][data-name="Test Code"]');
      await expect(codeItem).toBeVisible();

      const personaItem = window.locator('[data-testid="snippet-item"][data-name="Test Persona"]');
      await expect(personaItem).toBeHidden();
    });

    test('should filter by template type', async ({ window }) => {
      await app.snippets.filterByType('template');
      await window.waitForTimeout(300);

      const templateItem = window.locator(
        '[data-testid="snippet-item"][data-name="Test Template"]'
      );
      await expect(templateItem).toBeVisible();

      const personaItem = window.locator('[data-testid="snippet-item"][data-name="Test Persona"]');
      await expect(personaItem).toBeHidden();
    });

    test('should show all snippets when filter is cleared', async ({ window }) => {
      // Apply filter
      await app.snippets.filterByType('persona');
      await window.waitForTimeout(300);

      // Clear filter
      await app.snippets.filterByType('all');
      await window.waitForTimeout(300);

      // All snippets should be visible
      const count = await app.snippets.getSnippetCount();
      expect(count).toBeGreaterThanOrEqual(4);
    });
  });

  test.describe('Snippet Search', () => {
    test('should search snippets by title', async ({ window }) => {
      await app.createSnippet('Alpha Snippet', 'persona');
      await app.createSnippet('Beta Snippet', 'text');
      await window.waitForTimeout(500);

      await app.snippets.searchSnippets('Alpha');
      await window.waitForTimeout(300);

      const alphaItem = window.locator('[data-testid="snippet-item"][data-name="Alpha Snippet"]');
      const betaItem = window.locator('[data-testid="snippet-item"][data-name="Beta Snippet"]');

      await expect(alphaItem).toBeVisible();
      await expect(betaItem).toBeHidden();
    });

    test('should search snippets by shortcut', async ({ window }) => {
      await app.createSnippet('Custom Snippet', 'persona', '@custom-search');
      await window.waitForTimeout(500);

      await app.snippets.searchSnippets('custom-search');
      await window.waitForTimeout(300);

      const snippetItem = window.locator(
        '[data-testid="snippet-item"][data-name="Custom Snippet"]'
      );
      await expect(snippetItem).toBeVisible();
    });
  });

  test.describe('Edit Snippet', () => {
    test('should open snippet for editing', async ({ window }) => {
      const snippetTitle = generateSnippetName();
      await app.createSnippet(snippetTitle, 'persona');
      await window.waitForTimeout(500);

      // Click on snippet to open
      await app.snippets.selectSnippet(snippetTitle);
      await window.waitForTimeout(500);

      // Editor should open
      await app.editor.waitForEditor();

      // Tab should show snippet name
      const tab = window.locator(`[data-testid="tab"][data-name="${snippetTitle}"]`);
      await expect(tab).toBeVisible();
    });

    test('should save snippet changes', async ({ window }) => {
      const snippetTitle = generateSnippetName();
      await app.createSnippet(snippetTitle, 'text');
      await window.waitForTimeout(500);

      // Open snippet
      await app.snippets.selectSnippet(snippetTitle);
      await app.editor.waitForEditor();

      // Modify content
      await app.editor.typeContent('\nNew snippet content');

      // Save
      await app.editor.save();
      await window.waitForTimeout(500);

      // Tab should not be dirty
      const isDirty = await app.tabBar.isTabDirty(snippetTitle);
      expect(isDirty).toBe(false);
    });
  });

  test.describe('Delete Snippet', () => {
    test('should delete snippet with confirmation', async ({ window }) => {
      const snippetTitle = generateSnippetName();
      await app.createSnippet(snippetTitle, 'persona');
      await window.waitForTimeout(500);

      const initialCount = await app.snippets.getSnippetCount();

      // Right-click and delete
      const snippetItem = window.locator(
        `[data-testid="snippet-item"][data-name="${snippetTitle}"]`
      );
      await snippetItem.click({ button: 'right' });
      await window.locator('[data-testid="context-menu-delete"]').click();

      // Confirm deletion
      await app.dialogs.waitForDialog('delete-confirm-dialog');
      await app.dialogs.confirmDelete();

      await window.waitForTimeout(500);

      // Snippet should be removed
      await expect(snippetItem).toBeHidden();

      // Count should decrease
      const newCount = await app.snippets.getSnippetCount();
      expect(newCount).toBe(initialCount - 1);
    });

    test('should cancel snippet deletion', async ({ window }) => {
      const snippetTitle = generateSnippetName();
      await app.createSnippet(snippetTitle, 'text');
      await window.waitForTimeout(500);

      const initialCount = await app.snippets.getSnippetCount();

      // Right-click and delete
      const snippetItem = window.locator(
        `[data-testid="snippet-item"][data-name="${snippetTitle}"]`
      );
      await snippetItem.click({ button: 'right' });
      await window.locator('[data-testid="context-menu-delete"]').click();

      // Cancel deletion
      await app.dialogs.waitForDialog('delete-confirm-dialog');
      await app.dialogs.cancelDialog();

      await window.waitForTimeout(500);

      // Snippet should still exist
      await expect(snippetItem).toBeVisible();

      // Count should be unchanged
      const newCount = await app.snippets.getSnippetCount();
      expect(newCount).toBe(initialCount);
    });
  });

  test.describe('Snippet Autocomplete in Editor', () => {
    test.beforeEach(async ({ window }) => {
      // Create a project and prompt for testing autocomplete
      const projectName = generateProjectName();
      await app.navigateTo('explorer');
      await app.createProject(projectName);
      await window.waitForTimeout(500);

      // Create test snippets
      await app.navigateTo('snippets');
      await app.createSnippet('Code Assistant', 'persona', '@code-assistant');
      await app.createSnippet('Quick Text', 'text', '#quick-text');
      await app.createSnippet('Logger', 'code', '$logger');
      await app.createSnippet('Review Template', 'template', '!review-template');
      await window.waitForTimeout(500);

      // Create and open a prompt
      await app.navigateTo('explorer');
      await app.explorer.selectProject(projectName);
      await app.createPrompt('Test Prompt', 'general');
      await window.waitForTimeout(500);
      await app.openFile('Test Prompt');
    });

    test('should trigger persona autocomplete with @', async ({ window }) => {
      await app.editor.triggerSnippet('@');

      // Autocomplete menu should appear
      const autocomplete = window.locator('.monaco-editor .suggest-widget');
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      // Should contain persona snippet
      const suggestion = window.locator('.monaco-editor .suggest-widget', {
        hasText: 'code-assistant',
      });
      await expect(suggestion).toBeVisible();
    });

    test('should trigger text autocomplete with #', async ({ window }) => {
      await app.editor.triggerSnippet('#');

      // Autocomplete menu should appear
      const autocomplete = window.locator('.monaco-editor .suggest-widget');
      await expect(autocomplete).toBeVisible({ timeout: 3000 });
    });

    test('should trigger code autocomplete with $', async ({ window }) => {
      await app.editor.triggerSnippet('$');

      // Autocomplete menu should appear
      const autocomplete = window.locator('.monaco-editor .suggest-widget');
      await expect(autocomplete).toBeVisible({ timeout: 3000 });
    });

    test('should trigger template autocomplete with !', async ({ window }) => {
      await app.editor.triggerSnippet('!');

      // Autocomplete menu should appear
      const autocomplete = window.locator('.monaco-editor .suggest-widget');
      await expect(autocomplete).toBeVisible({ timeout: 3000 });
    });

    test('should insert snippet on selection', async ({ window }) => {
      await app.editor.triggerSnippet('@code');

      // Wait for autocomplete
      const autocomplete = window.locator('.monaco-editor .suggest-widget');
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      // Select first suggestion
      await app.editor.selectAutocomplete();
      await window.waitForTimeout(500);

      // Content should contain snippet content
      const content = await app.editor.getContent();
      expect(content.length).toBeGreaterThan(10); // Some content was inserted
    });

    test('should filter autocomplete suggestions while typing', async ({ window }) => {
      // Type partial shortcut
      await app.editor.triggerSnippet('@code-');

      // Autocomplete should show filtered results
      const autocomplete = window.locator('.monaco-editor .suggest-widget');
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      // Should show matching suggestion
      const matchingSuggestion = window.locator('.monaco-editor .suggest-widget', {
        hasText: 'code-assistant',
      });
      await expect(matchingSuggestion).toBeVisible();
    });
  });

  test.describe('Snippet Type Icons', () => {
    test('should display correct icon for persona snippet', async ({ window }) => {
      await app.createSnippet('Icon Test Persona', 'persona');
      await window.waitForTimeout(500);

      const snippetItem = window.locator(
        '[data-testid="snippet-item"][data-name="Icon Test Persona"]'
      );
      const icon = snippetItem.locator('[data-testid="snippet-icon"]');
      await expect(icon).toHaveAttribute('data-type', 'persona');
    });

    test('should display correct icon for code snippet', async ({ window }) => {
      await app.createSnippet('Icon Test Code', 'code');
      await window.waitForTimeout(500);

      const snippetItem = window.locator(
        '[data-testid="snippet-item"][data-name="Icon Test Code"]'
      );
      const icon = snippetItem.locator('[data-testid="snippet-icon"]');
      await expect(icon).toHaveAttribute('data-type', 'code');
    });
  });
});
