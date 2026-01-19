import { test, expect, MyndPromptsApp, generateProjectName, generatePromptName } from '../helpers';

/**
 * E2E Tests for UI Interactions
 *
 * Tests cover:
 * - Activity Bar navigation
 * - Sidebar operations
 * - Tab management
 * - Bottom panel
 * - Status bar
 * - Keyboard shortcuts
 */

test.describe('UI Interactions', () => {
  let app: MyndPromptsApp;

  test.beforeEach(async ({ window }) => {
    app = new MyndPromptsApp(window);
    await app.waitForAppReady();
  });

  test.describe('Activity Bar', () => {
    test('should navigate to Explorer view', async ({ window }) => {
      await app.activityBar.clickExplorer();
      await window.waitForTimeout(300);

      const explorerPanel = window.locator('[data-testid="explorer-panel"]');
      await expect(explorerPanel).toBeVisible();
    });

    test('should navigate to Search view', async ({ window }) => {
      await app.activityBar.clickSearch();
      await window.waitForTimeout(300);

      const searchPanel = window.locator('[data-testid="search-panel"]');
      await expect(searchPanel).toBeVisible();
    });

    test('should navigate to Snippets view', async ({ window }) => {
      await app.activityBar.clickSnippets();
      await window.waitForTimeout(300);

      const snippetsPanel = window.locator('[data-testid="snippets-panel"]');
      await expect(snippetsPanel).toBeVisible();
    });

    test('should navigate to Favorites view', async ({ window }) => {
      await app.activityBar.clickFavorites();
      await window.waitForTimeout(300);

      const favoritesPanel = window.locator('[data-testid="favorites-panel"]');
      await expect(favoritesPanel).toBeVisible();
    });

    test('should navigate to Git view', async ({ window }) => {
      await app.activityBar.clickGit();
      await window.waitForTimeout(300);

      const gitPanel = window.locator('[data-testid="git-panel"]');
      await expect(gitPanel).toBeVisible();
    });

    test('should navigate to Settings view', async ({ window }) => {
      await app.activityBar.clickSettings();
      await window.waitForTimeout(300);

      const settingsPanel = window.locator('[data-testid="settings-panel"]');
      await expect(settingsPanel).toBeVisible();
    });

    test('should highlight active activity button', async ({ window }) => {
      await app.activityBar.clickSearch();
      await window.waitForTimeout(300);

      const searchButton = window.locator('[data-testid="activity-search"]');
      await expect(searchButton).toHaveClass(/active/);

      // Other buttons should not be active
      const explorerButton = window.locator('[data-testid="activity-explorer"]');
      await expect(explorerButton).not.toHaveClass(/active/);
    });
  });

  test.describe('Sidebar', () => {
    test('should collapse sidebar', async ({ window }) => {
      // Ensure sidebar is visible first
      const sidebar = window.locator('[data-testid="sidebar"]');
      await expect(sidebar).toBeVisible();

      // Collapse
      await app.sidebar.collapse();
      await window.waitForTimeout(300);

      // Sidebar should have collapsed class or reduced width
      const isCollapsed = await app.sidebar.isCollapsed();
      expect(isCollapsed).toBe(true);
    });

    test('should expand collapsed sidebar', async ({ window }) => {
      // Collapse first
      await app.sidebar.collapse();
      await window.waitForTimeout(300);

      // Expand
      await app.sidebar.expand();
      await window.waitForTimeout(300);

      // Sidebar should be expanded
      const isCollapsed = await app.sidebar.isCollapsed();
      expect(isCollapsed).toBe(false);
    });

    test('should resize sidebar by dragging', async ({ window }) => {
      const sidebar = window.locator('[data-testid="sidebar"]');
      const initialWidth = await sidebar.evaluate((el) => el.getBoundingClientRect().width);

      // Find resize handle
      const resizeHandle = window.locator('[data-testid="sidebar-resize-handle"]');

      // Drag to resize
      await resizeHandle.dragTo(window.locator('body'), {
        targetPosition: { x: 350, y: 300 },
      });

      await window.waitForTimeout(300);

      // Width should have changed
      const newWidth = await sidebar.evaluate((el) => el.getBoundingClientRect().width);
      expect(newWidth).not.toBe(initialWidth);
    });

    test('should persist sidebar width', async ({ window }) => {
      // Resize sidebar
      const resizeHandle = window.locator('[data-testid="sidebar-resize-handle"]');
      await resizeHandle.dragTo(window.locator('body'), {
        targetPosition: { x: 400, y: 300 },
      });
      await window.waitForTimeout(500);

      const sidebar = window.locator('[data-testid="sidebar"]');
      const widthAfterResize = await sidebar.evaluate((el) => el.getBoundingClientRect().width);

      // Reload the app (simulate by switching views and back)
      await app.activityBar.clickSettings();
      await window.waitForTimeout(300);
      await app.activityBar.clickExplorer();
      await window.waitForTimeout(300);

      // Width should be preserved
      const widthAfterSwitch = await sidebar.evaluate((el) => el.getBoundingClientRect().width);
      expect(widthAfterSwitch).toBeCloseTo(widthAfterResize, -1);
    });
  });

  test.describe('Tab Management', () => {
    test.beforeEach(async ({ window }) => {
      // Create a project and prompts
      const projectName = generateProjectName();
      await app.createProject(projectName);
      await window.waitForTimeout(500);
      await app.explorer.selectProject(projectName);

      await app.createPrompt('Tab Test 1', 'general');
      await app.createPrompt('Tab Test 2', 'general');
      await app.createPrompt('Tab Test 3', 'general');
      await window.waitForTimeout(500);
    });

    test('should open file in new tab', async ({ window }) => {
      await app.openFile('Tab Test 1');

      const tab = window.locator('[data-testid="tab"][data-name="Tab Test 1"]');
      await expect(tab).toBeVisible();
    });

    test('should open multiple files in tabs', async ({ window }) => {
      await app.openFile('Tab Test 1');
      await app.openFile('Tab Test 2');
      await app.openFile('Tab Test 3');

      const tabCount = await app.tabBar.getTabCount();
      expect(tabCount).toBe(3);
    });

    test('should switch between tabs', async ({ window }) => {
      await app.openFile('Tab Test 1');
      await app.openFile('Tab Test 2');

      // Switch to first tab
      await app.tabBar.selectTab('Tab Test 1');
      await window.waitForTimeout(300);

      const activeTab = await app.tabBar.getActiveTabName();
      expect(activeTab).toBe('Tab Test 1');
    });

    test('should close a tab', async ({ window }) => {
      await app.openFile('Tab Test 1');
      await app.openFile('Tab Test 2');

      const initialCount = await app.tabBar.getTabCount();

      // Close first tab
      await app.tabBar.closeTab('Tab Test 1');
      await window.waitForTimeout(300);

      const newCount = await app.tabBar.getTabCount();
      expect(newCount).toBe(initialCount - 1);

      // Tab should be gone
      const closedTab = window.locator('[data-testid="tab"][data-name="Tab Test 1"]');
      await expect(closedTab).toBeHidden();
    });

    test('should close all tabs', async ({ window }) => {
      await app.openFile('Tab Test 1');
      await app.openFile('Tab Test 2');
      await app.openFile('Tab Test 3');

      await app.tabBar.closeAllTabs();
      await window.waitForTimeout(300);

      const tabCount = await app.tabBar.getTabCount();
      expect(tabCount).toBe(0);
    });

    test('should show dirty indicator on modified tab', async ({ window }) => {
      await app.openFile('Tab Test 1');
      await app.editor.waitForEditor();

      // Modify content
      await app.editor.typeContent('\nModified');

      // Tab should show dirty indicator
      const isDirty = await app.tabBar.isTabDirty('Tab Test 1');
      expect(isDirty).toBe(true);
    });

    test('should remove dirty indicator after save', async ({ window }) => {
      await app.openFile('Tab Test 1');
      await app.editor.waitForEditor();

      // Modify and save
      await app.editor.typeContent('\nModified');
      await app.editor.save();
      await window.waitForTimeout(500);

      // Dirty indicator should be gone
      const isDirty = await app.tabBar.isTabDirty('Tab Test 1');
      expect(isDirty).toBe(false);
    });

    test('should prompt to save unsaved changes when closing tab', async ({ window }) => {
      await app.openFile('Tab Test 1');
      await app.editor.waitForEditor();

      // Modify content
      await app.editor.typeContent('\nUnsaved changes');

      // Try to close tab
      await app.tabBar.closeTab('Tab Test 1');

      // Save prompt should appear
      const saveDialog = window.locator('[data-testid="unsaved-changes-dialog"]');
      await expect(saveDialog).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Bottom Panel', () => {
    test('should toggle bottom panel visibility', async ({ window }) => {
      const bottomPanel = window.locator('[data-testid="bottom-panel"]');

      // Initially may or may not be visible, toggle it
      await app.bottomPanel.collapse();
      await window.waitForTimeout(300);

      // Expand
      await app.bottomPanel.expand();
      await window.waitForTimeout(300);

      await expect(bottomPanel).toBeVisible();
    });

    test('should switch between panel tabs', async ({ window }) => {
      // Ensure panel is visible
      await app.bottomPanel.expand();
      await window.waitForTimeout(300);

      // Switch to Output tab
      await app.bottomPanel.clickOutput();
      await window.waitForTimeout(200);

      const outputContent = window.locator('[data-testid="output-content"]');
      await expect(outputContent).toBeVisible();

      // Switch to Problems tab
      await app.bottomPanel.clickProblems();
      await window.waitForTimeout(200);

      const problemsContent = window.locator('[data-testid="problems-content"]');
      await expect(problemsContent).toBeVisible();
    });

    test('should resize bottom panel', async ({ window }) => {
      await app.bottomPanel.expand();
      await window.waitForTimeout(300);

      const bottomPanel = window.locator('[data-testid="bottom-panel"]');
      const initialHeight = await bottomPanel.evaluate((el) => el.getBoundingClientRect().height);

      // Find resize handle
      const resizeHandle = window.locator('[data-testid="panel-resize-handle"]');

      // Drag to resize
      await resizeHandle.dragTo(window.locator('body'), {
        targetPosition: { x: 500, y: 400 },
      });

      await window.waitForTimeout(300);

      // Height should have changed
      const newHeight = await bottomPanel.evaluate((el) => el.getBoundingClientRect().height);
      expect(newHeight).not.toBe(initialHeight);
    });
  });

  test.describe('Status Bar', () => {
    test('should display cursor position', async ({ window }) => {
      // Open a file
      const projectName = generateProjectName();
      await app.createProject(projectName);
      await window.waitForTimeout(500);
      await app.explorer.selectProject(projectName);
      await app.createPrompt('Status Test', 'general');
      await window.waitForTimeout(500);
      await app.openFile('Status Test');
      await app.editor.waitForEditor();

      // Cursor position should be displayed
      const cursorPosition = await app.statusBar.getCursorPosition();
      expect(cursorPosition).toMatch(/Ln \d+, Col \d+/);
    });

    test('should update cursor position when moving in editor', async ({ window }) => {
      // Setup
      const projectName = generateProjectName();
      await app.createProject(projectName);
      await window.waitForTimeout(500);
      await app.explorer.selectProject(projectName);
      await app.createPrompt('Cursor Test', 'general');
      await window.waitForTimeout(500);
      await app.openFile('Cursor Test');
      await app.editor.waitForEditor();

      // Get initial position
      const initialPosition = await app.statusBar.getCursorPosition();

      // Move cursor (press arrow keys)
      await window.keyboard.press('ArrowDown');
      await window.keyboard.press('ArrowDown');
      await window.waitForTimeout(200);

      // Position should have changed
      const newPosition = await app.statusBar.getCursorPosition();
      expect(newPosition).not.toBe(initialPosition);
    });

    test('should display current language', async ({ window }) => {
      const languageIndicator = window.locator('[data-testid="current-language"]');
      await expect(languageIndicator).toBeVisible();

      // Should show a locale
      const text = await languageIndicator.textContent();
      expect(text).toMatch(/en|es|fr|pt|de|it|ar/i);
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test.beforeEach(async ({ window }) => {
      // Setup test data
      const projectName = generateProjectName();
      await app.createProject(projectName);
      await window.waitForTimeout(500);
      await app.explorer.selectProject(projectName);
      await app.createPrompt('Shortcut Test', 'general');
      await window.waitForTimeout(500);
      await app.openFile('Shortcut Test');
      await app.editor.waitForEditor();
    });

    test('should save with Cmd+S', async ({ window }) => {
      // Modify content
      await app.editor.typeContent('\nTest content');

      // Save with shortcut
      await window.keyboard.press('Meta+S');
      await window.waitForTimeout(500);

      // Tab should not be dirty
      const isDirty = await app.tabBar.isTabDirty('Shortcut Test');
      expect(isDirty).toBe(false);
    });

    test('should undo with Cmd+Z', async ({ window }) => {
      // Type something
      await app.editor.typeContent('Undoable text');
      const contentBefore = await app.editor.getContent();

      // Undo
      await window.keyboard.press('Meta+Z');
      await window.waitForTimeout(300);

      const contentAfter = await app.editor.getContent();
      expect(contentAfter).not.toBe(contentBefore);
    });

    test('should redo with Cmd+Shift+Z', async ({ window }) => {
      // Type something
      await app.editor.typeContent('Redoable text');

      // Undo
      await window.keyboard.press('Meta+Z');
      await window.waitForTimeout(300);

      const contentAfterUndo = await app.editor.getContent();

      // Redo
      await window.keyboard.press('Meta+Shift+Z');
      await window.waitForTimeout(300);

      const contentAfterRedo = await app.editor.getContent();
      expect(contentAfterRedo).not.toBe(contentAfterUndo);
    });

    test('should close tab with Cmd+W', async ({ window }) => {
      const initialCount = await app.tabBar.getTabCount();

      // Close with shortcut
      await window.keyboard.press('Meta+W');
      await window.waitForTimeout(300);

      const newCount = await app.tabBar.getTabCount();
      expect(newCount).toBe(initialCount - 1);
    });

    test('should open command palette with Cmd+Shift+P', async ({ window }) => {
      await window.keyboard.press('Meta+Shift+P');
      await window.waitForTimeout(300);

      const commandPalette = window.locator('[data-testid="command-palette"]');
      await expect(commandPalette).toBeVisible();
    });

    test('should toggle sidebar with Cmd+B', async ({ window }) => {
      const sidebar = window.locator('[data-testid="sidebar"]');
      const initiallyCollapsed = await app.sidebar.isCollapsed();

      // Toggle
      await window.keyboard.press('Meta+B');
      await window.waitForTimeout(300);

      const isNowCollapsed = await app.sidebar.isCollapsed();
      expect(isNowCollapsed).not.toBe(initiallyCollapsed);

      // Toggle back
      await window.keyboard.press('Meta+B');
      await window.waitForTimeout(300);

      const isFinallyCollapsed = await app.sidebar.isCollapsed();
      expect(isFinallyCollapsed).toBe(initiallyCollapsed);
    });
  });

  test.describe('Welcome Screen', () => {
    test('should display welcome screen when no files are open', async ({ window }) => {
      // Ensure no tabs are open
      await app.tabBar.closeAllTabs();
      await window.waitForTimeout(300);

      // Welcome screen should be visible
      const welcomeScreen = window.locator('[data-testid="welcome-screen"]');
      await expect(welcomeScreen).toBeVisible();
    });

    test('should show recent files on welcome screen', async ({ window }) => {
      // Create and open a file first
      const projectName = generateProjectName();
      await app.createProject(projectName);
      await window.waitForTimeout(500);
      await app.explorer.selectProject(projectName);
      await app.createPrompt('Recent File Test', 'general');
      await window.waitForTimeout(500);
      await app.openFile('Recent File Test');
      await window.waitForTimeout(500);

      // Close all tabs to show welcome screen
      await app.tabBar.closeAllTabs();
      await window.waitForTimeout(300);

      // Recent files section should show the file
      const recentFiles = window.locator('[data-testid="recent-files"]');
      await expect(recentFiles).toContainText('Recent File Test');
    });

    test('should open recent file from welcome screen', async ({ window }) => {
      // Setup
      const projectName = generateProjectName();
      await app.createProject(projectName);
      await window.waitForTimeout(500);
      await app.explorer.selectProject(projectName);
      await app.createPrompt('Open From Welcome', 'general');
      await window.waitForTimeout(500);
      await app.openFile('Open From Welcome');
      await window.waitForTimeout(500);
      await app.tabBar.closeAllTabs();
      await window.waitForTimeout(300);

      // Click on recent file
      const recentFileItem = window.locator('[data-testid="recent-file-item"]', {
        hasText: 'Open From Welcome',
      });
      await recentFileItem.click();
      await window.waitForTimeout(500);

      // File should be opened
      await app.editor.waitForEditor();
      const activeTab = await app.tabBar.getActiveTabName();
      expect(activeTab).toBe('Open From Welcome');
    });
  });

  test.describe('Context Menus', () => {
    test('should show context menu on right-click in explorer', async ({ window }) => {
      const projectName = generateProjectName();
      await app.createProject(projectName);
      await window.waitForTimeout(500);

      // Right-click on project
      const projectItem = window.locator(
        `[data-testid="project-item"][data-name="${projectName}"]`
      );
      await projectItem.click({ button: 'right' });

      // Context menu should appear
      const contextMenu = window.locator('[data-testid="context-menu"]');
      await expect(contextMenu).toBeVisible();
    });

    test('should close context menu on Escape', async ({ window }) => {
      const projectName = generateProjectName();
      await app.createProject(projectName);
      await window.waitForTimeout(500);

      // Right-click
      const projectItem = window.locator(
        `[data-testid="project-item"][data-name="${projectName}"]`
      );
      await projectItem.click({ button: 'right' });

      const contextMenu = window.locator('[data-testid="context-menu"]');
      await expect(contextMenu).toBeVisible();

      // Press Escape
      await window.keyboard.press('Escape');
      await window.waitForTimeout(300);

      // Context menu should be hidden
      await expect(contextMenu).toBeHidden();
    });

    test('should close context menu on click outside', async ({ window }) => {
      const projectName = generateProjectName();
      await app.createProject(projectName);
      await window.waitForTimeout(500);

      // Right-click
      const projectItem = window.locator(
        `[data-testid="project-item"][data-name="${projectName}"]`
      );
      await projectItem.click({ button: 'right' });

      const contextMenu = window.locator('[data-testid="context-menu"]');
      await expect(contextMenu).toBeVisible();

      // Click outside
      await window.locator('body').click({ position: { x: 10, y: 10 } });
      await window.waitForTimeout(300);

      // Context menu should be hidden
      await expect(contextMenu).toBeHidden();
    });
  });
});
