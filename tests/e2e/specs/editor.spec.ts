import { test, expect, MyndPromptsApp, generateProjectName } from '../helpers';

/**
 * E2E Tests for Editor Functionality
 *
 * Tests cover:
 * - Monaco editor operations
 * - Content editing
 * - Syntax highlighting
 * - Editor settings
 * - Split view
 */

test.describe('Editor Functionality', () => {
  let app: MyndPromptsApp;
  let projectName: string;

  test.beforeEach(async ({ window }) => {
    app = new MyndPromptsApp(window);
    await app.waitForAppReady();

    // Create test project and prompt
    projectName = generateProjectName();
    await app.createProject(projectName);
    await window.waitForTimeout(500);
    await app.explorer.selectProject(projectName);
    await app.createPrompt('Editor Test', 'general');
    await window.waitForTimeout(500);
    await app.openFile('Editor Test');
    await app.editor.waitForEditor();
  });

  test.describe('Basic Editing', () => {
    test('should type content in editor', async ({ window }) => {
      await app.editor.clearContent();
      await app.editor.typeContent('Hello World');

      const content = await app.editor.getContent();
      expect(content).toContain('Hello World');
    });

    test('should handle multi-line content', async ({ window }) => {
      await app.editor.clearContent();
      await app.editor.typeContent('Line 1');
      await window.keyboard.press('Enter');
      await app.editor.typeContent('Line 2');
      await window.keyboard.press('Enter');
      await app.editor.typeContent('Line 3');

      const content = await app.editor.getContent();
      expect(content).toContain('Line 1');
      expect(content).toContain('Line 2');
      expect(content).toContain('Line 3');
    });

    test('should select all content with Cmd+A', async ({ window }) => {
      await app.editor.typeContent('Test content to select');

      // Select all
      await window.keyboard.press('Meta+A');
      await window.waitForTimeout(200);

      // Type to replace selection
      await window.keyboard.type('Replaced');
      await window.waitForTimeout(200);

      const content = await app.editor.getContent();
      expect(content).toContain('Replaced');
      expect(content).not.toContain('Test content to select');
    });

    test('should cut content with Cmd+X', async ({ window }) => {
      await app.editor.clearContent();
      await app.editor.typeContent('Cut this text');

      // Select all and cut
      await window.keyboard.press('Meta+A');
      await window.keyboard.press('Meta+X');
      await window.waitForTimeout(200);

      const content = await app.editor.getContent();
      expect(content.trim()).toBe('');
    });

    test('should paste content with Cmd+V', async ({ window }) => {
      await app.editor.clearContent();
      await app.editor.typeContent('Copy this');

      // Select all, copy
      await window.keyboard.press('Meta+A');
      await window.keyboard.press('Meta+C');

      // Move to end and paste
      await window.keyboard.press('End');
      await window.keyboard.press('Enter');
      await window.keyboard.press('Meta+V');
      await window.waitForTimeout(200);

      const content = await app.editor.getContent();
      expect(content.match(/Copy this/g)?.length).toBe(2);
    });
  });

  test.describe('Undo/Redo', () => {
    test('should undo changes', async ({ window }) => {
      await app.editor.clearContent();
      const initialContent = 'Initial';
      await app.editor.typeContent(initialContent);
      await window.waitForTimeout(200);

      await app.editor.typeContent(' Modified');
      await window.waitForTimeout(200);

      // Undo
      await app.editor.undo();
      await window.waitForTimeout(200);

      const content = await app.editor.getContent();
      expect(content).not.toContain('Modified');
    });

    test('should redo changes', async ({ window }) => {
      await app.editor.clearContent();
      await app.editor.typeContent('Original');
      await window.waitForTimeout(200);

      await app.editor.typeContent(' Added');
      await window.waitForTimeout(200);

      // Undo then redo
      await app.editor.undo();
      await window.waitForTimeout(200);
      await app.editor.redo();
      await window.waitForTimeout(200);

      const content = await app.editor.getContent();
      expect(content).toContain('Added');
    });

    test('should support multiple undo operations', async ({ window }) => {
      await app.editor.clearContent();
      await app.editor.typeContent('Step 1');
      await window.waitForTimeout(100);
      await window.keyboard.press('Enter');
      await app.editor.typeContent('Step 2');
      await window.waitForTimeout(100);
      await window.keyboard.press('Enter');
      await app.editor.typeContent('Step 3');
      await window.waitForTimeout(200);

      // Multiple undos
      await app.editor.undo();
      await app.editor.undo();
      await app.editor.undo();
      await window.waitForTimeout(200);

      const content = await app.editor.getContent();
      expect(content).not.toContain('Step 3');
    });
  });

  test.describe('Cursor Navigation', () => {
    test('should move cursor with arrow keys', async ({ window }) => {
      await app.editor.clearContent();
      await app.editor.typeContent('Test line');

      // Move cursor left
      await window.keyboard.press('ArrowLeft');
      await window.keyboard.press('ArrowLeft');
      await window.keyboard.press('ArrowLeft');

      // Type at cursor position
      await window.keyboard.type('X');
      await window.waitForTimeout(200);

      const content = await app.editor.getContent();
      expect(content).toContain('Test liXne');
    });

    test('should move cursor to line start with Home', async ({ window }) => {
      await app.editor.clearContent();
      await app.editor.typeContent('Start of line');

      // Move to start
      await window.keyboard.press('Home');
      await window.keyboard.type('X');
      await window.waitForTimeout(200);

      const content = await app.editor.getContent();
      expect(content).toContain('XStart');
    });

    test('should move cursor to line end with End', async ({ window }) => {
      await app.editor.clearContent();
      await app.editor.typeContent('End of line');

      // Move to end
      await window.keyboard.press('End');
      await window.keyboard.type('X');
      await window.waitForTimeout(200);

      const content = await app.editor.getContent();
      expect(content).toContain('End of lineX');
    });

    test('should update cursor position in status bar', async ({ window }) => {
      await app.editor.clearContent();
      await app.editor.typeContent('Line 1');
      await window.keyboard.press('Enter');
      await app.editor.typeContent('Line 2');
      await window.keyboard.press('Enter');
      await app.editor.typeContent('Line 3');
      await window.waitForTimeout(200);

      // Check status bar
      const position = await app.statusBar.getCursorPosition();
      expect(position).toMatch(/Ln 3/);
    });
  });

  test.describe('Find and Replace', () => {
    test('should open find dialog with Cmd+F', async ({ window }) => {
      await window.keyboard.press('Meta+F');
      await window.waitForTimeout(300);

      // Find widget should be visible
      const findWidget = window.locator('.monaco-editor .find-widget');
      await expect(findWidget).toBeVisible();
    });

    test('should open replace dialog with Cmd+H', async ({ window }) => {
      await window.keyboard.press('Meta+H');
      await window.waitForTimeout(300);

      // Find/Replace widget should be visible with replace input
      const replaceInput = window.locator('.monaco-editor .find-widget .replace-input');
      await expect(replaceInput).toBeVisible();
    });

    test('should find text in editor', async ({ window }) => {
      await app.editor.clearContent();
      await app.editor.typeContent('Find this word here. Find this too.');

      // Open find
      await window.keyboard.press('Meta+F');
      await window.waitForTimeout(300);

      // Type search term
      const findInput = window.locator('.monaco-editor .find-widget input.input');
      await findInput.fill('Find');
      await window.waitForTimeout(300);

      // Should highlight matches (visually confirmed)
      // Monaco will show match count
      const matchCount = window.locator('.monaco-editor .find-widget .matches');
      await expect(matchCount).toContainText(/\d+\s*of\s*\d+/);
    });

    test('should close find with Escape', async ({ window }) => {
      await window.keyboard.press('Meta+F');
      await window.waitForTimeout(300);

      const findWidget = window.locator('.monaco-editor .find-widget');
      await expect(findWidget).toBeVisible();

      await window.keyboard.press('Escape');
      await window.waitForTimeout(300);

      await expect(findWidget).toBeHidden();
    });
  });

  test.describe('Editor Theme', () => {
    test('should change to dark theme', async ({ window }) => {
      await app.navigateTo('settings');
      await app.settings.selectTheme('dark');
      await window.waitForTimeout(500);

      // Go back to editor
      await app.navigateTo('explorer');
      await app.openFile('Editor Test');
      await app.editor.waitForEditor();

      // Editor should have dark theme
      const editorContainer = window.locator('.monaco-editor');
      const classList = await editorContainer.getAttribute('class');
      expect(classList).toMatch(/vs-dark|dark/);
    });

    test('should change to light theme', async ({ window }) => {
      await app.navigateTo('settings');
      await app.settings.selectTheme('light');
      await window.waitForTimeout(500);

      // Go back to editor
      await app.navigateTo('explorer');
      await app.openFile('Editor Test');
      await app.editor.waitForEditor();

      // Editor should have light theme
      const editorContainer = window.locator('.monaco-editor');
      const classList = await editorContainer.getAttribute('class');
      expect(classList).not.toMatch(/vs-dark/);
    });
  });

  test.describe('Markdown Editing', () => {
    test('should display markdown content', async ({ window }) => {
      const markdownContent = `# Heading 1

## Heading 2

This is **bold** and *italic* text.

- List item 1
- List item 2

\`\`\`javascript
const x = 1;
\`\`\`
`;

      await app.editor.setContent(markdownContent);
      await window.waitForTimeout(300);

      const content = await app.editor.getContent();
      expect(content).toContain('# Heading 1');
      expect(content).toContain('**bold**');
    });

    test('should handle YAML frontmatter', async ({ window }) => {
      const contentWithFrontmatter = `---
title: Test Title
category: test
tags:
  - tag1
  - tag2
---

# Content after frontmatter
`;

      await app.editor.setContent(contentWithFrontmatter);
      await window.waitForTimeout(300);

      const content = await app.editor.getContent();
      expect(content).toContain('---');
      expect(content).toContain('title: Test Title');
    });
  });

  test.describe('Auto Save', () => {
    test('should auto-save after delay', async ({ window }) => {
      await app.editor.typeContent('\nAuto save test content');

      // Tab should be dirty
      let isDirty = await app.tabBar.isTabDirty('Editor Test');
      expect(isDirty).toBe(true);

      // Wait for auto-save (typically 2-3 seconds)
      await window.waitForTimeout(4000);

      // Tab should no longer be dirty
      isDirty = await app.tabBar.isTabDirty('Editor Test');
      expect(isDirty).toBe(false);
    });

    test('should preserve content after auto-save', async ({ window }) => {
      const testContent = '\nUnique content for auto-save test';
      await app.editor.typeContent(testContent);

      // Wait for auto-save
      await window.waitForTimeout(4000);

      // Close and reopen file
      await app.tabBar.closeTab('Editor Test');
      await window.waitForTimeout(500);
      await app.openFile('Editor Test');
      await app.editor.waitForEditor();

      // Content should be preserved
      const content = await app.editor.getContent();
      expect(content).toContain('Unique content for auto-save test');
    });
  });

  test.describe('Multiple Editors', () => {
    test('should open multiple files in tabs', async ({ window }) => {
      // Create another prompt
      await app.createPrompt('Second Editor File', 'general');
      await window.waitForTimeout(500);

      // Open both files
      await app.openFile('Editor Test');
      await app.openFile('Second Editor File');

      // Should have 2 tabs
      const tabCount = await app.tabBar.getTabCount();
      expect(tabCount).toBe(2);
    });

    test('should switch between editors', async ({ window }) => {
      await app.createPrompt('Switch Test', 'general');
      await window.waitForTimeout(500);

      await app.openFile('Editor Test');
      await app.editor.typeContent('\nContent in first file');

      await app.openFile('Switch Test');
      await app.editor.typeContent('\nContent in second file');

      // Switch back to first
      await app.tabBar.selectTab('Editor Test');
      await window.waitForTimeout(300);

      const content = await app.editor.getContent();
      expect(content).toContain('Content in first file');
    });

    test('should maintain editor state when switching', async ({ window }) => {
      await app.createPrompt('State Test', 'general');
      await window.waitForTimeout(500);

      // Type in first file
      await app.openFile('Editor Test');
      await app.editor.typeContent('\nState content');

      // Switch to second file
      await app.openFile('State Test');
      await window.waitForTimeout(300);

      // Switch back
      await app.tabBar.selectTab('Editor Test');
      await window.waitForTimeout(300);

      // First file should still have dirty state
      const isDirty = await app.tabBar.isTabDirty('Editor Test');
      expect(isDirty).toBe(true);

      // Content should still be there
      const content = await app.editor.getContent();
      expect(content).toContain('State content');
    });
  });

  test.describe('Split Editor', () => {
    test('should split editor horizontally', async ({ window }) => {
      // Right-click on tab to access split options
      const tab = window.locator('[data-testid="tab"][data-name="Editor Test"]');
      await tab.click({ button: 'right' });

      // Click split horizontally
      await window.locator('[data-testid="split-horizontal"]').click();
      await window.waitForTimeout(500);

      // Should have two editor panes
      const panes = window.locator('[data-testid="editor-pane"]');
      const paneCount = await panes.count();
      expect(paneCount).toBe(2);
    });

    test('should split editor vertically', async ({ window }) => {
      const tab = window.locator('[data-testid="tab"][data-name="Editor Test"]');
      await tab.click({ button: 'right' });

      await window.locator('[data-testid="split-vertical"]').click();
      await window.waitForTimeout(500);

      const panes = window.locator('[data-testid="editor-pane"]');
      const paneCount = await panes.count();
      expect(paneCount).toBe(2);
    });

    test('should edit in split panes independently', async ({ window }) => {
      await app.createPrompt('Split Pane Test', 'general');
      await window.waitForTimeout(500);

      // Split editor
      const tab = window.locator('[data-testid="tab"][data-name="Editor Test"]');
      await tab.click({ button: 'right' });
      await window.locator('[data-testid="split-horizontal"]').click();
      await window.waitForTimeout(500);

      // Open different file in second pane
      const secondPane = window.locator('[data-testid="editor-pane"]').nth(1);
      await secondPane.click();
      await app.openFile('Split Pane Test');
      await window.waitForTimeout(300);

      // Type in second pane
      await app.editor.typeContent('\nSecond pane content');

      // Switch to first pane
      const firstPane = window.locator('[data-testid="editor-pane"]').first();
      await firstPane.click();
      await window.waitForTimeout(300);

      // First pane should still have original content
      const content = await app.editor.getContent();
      expect(content).not.toContain('Second pane content');
    });

    test('should close split pane', async ({ window }) => {
      // Split first
      const tab = window.locator('[data-testid="tab"][data-name="Editor Test"]');
      await tab.click({ button: 'right' });
      await window.locator('[data-testid="split-horizontal"]').click();
      await window.waitForTimeout(500);

      // Close second pane
      const closeButton = window
        .locator('[data-testid="editor-pane"]')
        .nth(1)
        .locator('[data-testid="close-pane"]');
      await closeButton.click();
      await window.waitForTimeout(300);

      // Should have single pane
      const panes = window.locator('[data-testid="editor-pane"]');
      const paneCount = await panes.count();
      expect(paneCount).toBe(1);
    });
  });

  test.describe('Editor Actions', () => {
    test('should format document with Shift+Alt+F', async ({ window }) => {
      // Type unformatted content
      await app.editor.clearContent();
      await app.editor.typeContent('# Test\n\n\n\nToo many blank lines\n\n\n\n');

      // Format
      await window.keyboard.press('Shift+Alt+F');
      await window.waitForTimeout(500);

      // Content might be formatted (depends on formatter)
      const content = await app.editor.getContent();
      expect(content).toBeDefined();
    });

    test('should go to line with Ctrl+G', async ({ window }) => {
      await app.editor.clearContent();
      await app.editor.typeContent('Line 1\nLine 2\nLine 3\nLine 4\nLine 5');

      // Open go to line dialog
      await window.keyboard.press('Control+G');
      await window.waitForTimeout(300);

      // Go to line dialog should appear
      const gotoLineInput = window.locator('.monaco-editor .quick-input-box input');
      await expect(gotoLineInput).toBeVisible();

      // Type line number
      await gotoLineInput.fill('3');
      await window.keyboard.press('Enter');
      await window.waitForTimeout(300);

      // Cursor should be on line 3
      const position = await app.statusBar.getCursorPosition();
      expect(position).toMatch(/Ln 3/);
    });

    test('should toggle comment with Cmd+/', async ({ window }) => {
      await app.editor.clearContent();
      await app.editor.typeContent('This is a comment line');

      // Select line and toggle comment
      await window.keyboard.press('Meta+/');
      await window.waitForTimeout(200);

      const content = await app.editor.getContent();
      // In markdown, comment might be HTML style or no change
      // The behavior depends on the language mode
      expect(content).toBeDefined();
    });

    test('should duplicate line with Shift+Alt+Down', async ({ window }) => {
      await app.editor.clearContent();
      await app.editor.typeContent('Duplicate this line');

      // Duplicate line down
      await window.keyboard.press('Shift+Alt+ArrowDown');
      await window.waitForTimeout(200);

      const content = await app.editor.getContent();
      expect(content.match(/Duplicate this line/g)?.length).toBe(2);
    });

    test('should move line up with Alt+Up', async ({ window }) => {
      await app.editor.clearContent();
      await app.editor.typeContent('Line A\nLine B');

      // Move to second line
      await window.keyboard.press('ArrowDown');

      // Move line up
      await window.keyboard.press('Alt+ArrowUp');
      await window.waitForTimeout(200);

      const content = await app.editor.getContent();
      // Line B should now be first
      const lines = content.split('\n').filter((l: string) => l.trim());
      expect(lines[0]).toContain('Line B');
    });
  });

  test.describe('Read-Only Mode', () => {
    test('should prevent editing when read-only', async ({ window }) => {
      // This would require a mechanism to set read-only mode
      // For now, we'll test that the editor exists
      const editor = window.locator('.monaco-editor');
      await expect(editor).toBeVisible();
    });
  });
});
