import { test, expect, MyndPromptsApp, TestData, generateProjectName } from '../helpers';

/**
 * E2E Tests for Project Management
 *
 * Tests cover:
 * - Creating projects
 * - Renaming projects
 * - Deleting projects
 * - Project validation
 * - Project navigation
 */

test.describe('Project Management', () => {
  let app: MyndPromptsApp;

  test.beforeEach(async ({ window }) => {
    app = new MyndPromptsApp(window);
    await app.waitForAppReady();
    await app.navigateTo('explorer');
  });

  test.describe('Create Project', () => {
    test('should create a new project with valid name', async ({ window }) => {
      const projectName = generateProjectName();

      // Click new project button
      await app.explorer.clickNewProject();

      // Wait for dialog to appear
      await app.dialogs.waitForDialog('new-project-dialog');

      // Fill in project details
      await app.dialogs.fillNewProjectDialog(projectName, 'Test project description');

      // Confirm creation
      await app.dialogs.confirmDialog();

      // Wait for dialog to close
      await window.waitForTimeout(500);

      // Verify project appears in explorer
      const projectItem = window.locator(
        `[data-testid="project-item"][data-name="${projectName}"]`
      );
      await expect(projectItem).toBeVisible({ timeout: 5000 });
    });

    test('should create a project without description', async ({ window }) => {
      const projectName = generateProjectName();

      await app.explorer.clickNewProject();
      await app.dialogs.waitForDialog('new-project-dialog');
      await app.dialogs.fillNewProjectDialog(projectName);
      await app.dialogs.confirmDialog();

      await window.waitForTimeout(500);

      const projectItem = window.locator(
        `[data-testid="project-item"][data-name="${projectName}"]`
      );
      await expect(projectItem).toBeVisible({ timeout: 5000 });
    });

    test('should show validation error for empty project name', async ({ window }) => {
      await app.explorer.clickNewProject();
      await app.dialogs.waitForDialog('new-project-dialog');

      // Try to submit with empty name
      await app.dialogs.fillNewProjectDialog('');
      await app.dialogs.confirmDialog();

      // Error should be visible
      const errorMessage = window.locator('[data-testid="project-name-error"]');
      await expect(errorMessage).toBeVisible();
    });

    test('should show validation error for invalid characters in name', async ({ window }) => {
      await app.explorer.clickNewProject();
      await app.dialogs.waitForDialog('new-project-dialog');

      // Try name with invalid characters
      await app.dialogs.fillNewProjectDialog('Invalid<>Project');
      await app.dialogs.confirmDialog();

      // Error should be visible
      const errorMessage = window.locator('[data-testid="project-name-error"]');
      await expect(errorMessage).toBeVisible();
    });

    test('should show validation error for name exceeding max length', async ({ window }) => {
      await app.explorer.clickNewProject();
      await app.dialogs.waitForDialog('new-project-dialog');

      // Try name exceeding 100 characters
      const longName = 'A'.repeat(101);
      await app.dialogs.fillNewProjectDialog(longName);
      await app.dialogs.confirmDialog();

      // Error should be visible
      const errorMessage = window.locator('[data-testid="project-name-error"]');
      await expect(errorMessage).toBeVisible();
    });

    test('should cancel project creation', async ({ window }) => {
      const initialCount = await app.explorer.getProjectCount();

      await app.explorer.clickNewProject();
      await app.dialogs.waitForDialog('new-project-dialog');
      await app.dialogs.fillNewProjectDialog('Cancelled Project');
      await app.dialogs.cancelDialog();

      await window.waitForTimeout(500);

      // Project count should remain the same
      const newCount = await app.explorer.getProjectCount();
      expect(newCount).toBe(initialCount);
    });

    test('should close dialog with Escape key', async ({ window }) => {
      await app.explorer.clickNewProject();
      await app.dialogs.waitForDialog('new-project-dialog');

      // Press Escape
      await window.keyboard.press('Escape');

      // Dialog should be hidden
      const dialog = window.locator('[data-testid="new-project-dialog"]');
      await expect(dialog).toBeHidden({ timeout: 2000 });
    });
  });

  test.describe('Rename Project', () => {
    test('should rename an existing project', async ({ window }) => {
      // First create a project
      const originalName = generateProjectName();
      await app.createProject(originalName);
      await window.waitForTimeout(500);

      // Right-click on project to open context menu
      const projectItem = window.locator(
        `[data-testid="project-item"][data-name="${originalName}"]`
      );
      await projectItem.click({ button: 'right' });

      // Click rename option
      await window.locator('[data-testid="context-menu-rename"]').click();

      // Wait for rename dialog
      await app.dialogs.waitForDialog('rename-dialog');

      // Enter new name
      const newName = generateProjectName();
      await app.dialogs.fillRenameDialog(newName);
      await app.dialogs.confirmDialog();

      await window.waitForTimeout(500);

      // Verify new name appears
      const renamedProject = window.locator(`[data-testid="project-item"][data-name="${newName}"]`);
      await expect(renamedProject).toBeVisible({ timeout: 5000 });

      // Verify old name is gone
      const oldProject = window.locator(
        `[data-testid="project-item"][data-name="${originalName}"]`
      );
      await expect(oldProject).toBeHidden();
    });

    test('should show validation error for invalid rename', async ({ window }) => {
      // Create a project
      const originalName = generateProjectName();
      await app.createProject(originalName);
      await window.waitForTimeout(500);

      // Right-click and rename
      const projectItem = window.locator(
        `[data-testid="project-item"][data-name="${originalName}"]`
      );
      await projectItem.click({ button: 'right' });
      await window.locator('[data-testid="context-menu-rename"]').click();

      await app.dialogs.waitForDialog('rename-dialog');

      // Try invalid name
      await app.dialogs.fillRenameDialog('Invalid/Name');
      await app.dialogs.confirmDialog();

      // Error should be visible
      const errorMessage = window.locator('[data-testid="rename-error"]');
      await expect(errorMessage).toBeVisible();
    });
  });

  test.describe('Delete Project', () => {
    test('should delete a project with confirmation', async ({ window }) => {
      // Create a project
      const projectName = generateProjectName();
      await app.createProject(projectName);
      await window.waitForTimeout(500);

      const initialCount = await app.explorer.getProjectCount();

      // Right-click and delete
      const projectItem = window.locator(
        `[data-testid="project-item"][data-name="${projectName}"]`
      );
      await projectItem.click({ button: 'right' });
      await window.locator('[data-testid="context-menu-delete"]').click();

      // Confirm deletion
      await app.dialogs.waitForDialog('delete-confirm-dialog');
      await app.dialogs.confirmDelete();

      await window.waitForTimeout(500);

      // Verify project is removed
      const deletedProject = window.locator(
        `[data-testid="project-item"][data-name="${projectName}"]`
      );
      await expect(deletedProject).toBeHidden();

      // Verify count decreased
      const newCount = await app.explorer.getProjectCount();
      expect(newCount).toBe(initialCount - 1);
    });

    test('should cancel project deletion', async ({ window }) => {
      // Create a project
      const projectName = generateProjectName();
      await app.createProject(projectName);
      await window.waitForTimeout(500);

      const initialCount = await app.explorer.getProjectCount();

      // Right-click and delete
      const projectItem = window.locator(
        `[data-testid="project-item"][data-name="${projectName}"]`
      );
      await projectItem.click({ button: 'right' });
      await window.locator('[data-testid="context-menu-delete"]').click();

      // Cancel deletion
      await app.dialogs.waitForDialog('delete-confirm-dialog');
      await app.dialogs.cancelDialog();

      await window.waitForTimeout(500);

      // Verify project still exists
      await expect(projectItem).toBeVisible();

      // Verify count unchanged
      const newCount = await app.explorer.getProjectCount();
      expect(newCount).toBe(initialCount);
    });
  });

  test.describe('Project Navigation', () => {
    test('should expand project to show contents', async ({ window }) => {
      // Create a project with a prompt
      const projectName = generateProjectName();
      await app.createProject(projectName);
      await window.waitForTimeout(500);

      // Create a prompt in the project
      await app.explorer.selectProject(projectName);
      await app.createPrompt('Test Prompt');
      await window.waitForTimeout(500);

      // Collapse and expand the project
      await app.explorer.expandProject(projectName);

      // Verify prompt is visible
      const promptItem = window.locator('[data-testid="file-item"][data-name="Test Prompt"]');
      await expect(promptItem).toBeVisible({ timeout: 5000 });
    });

    test('should collapse project to hide contents', async ({ window }) => {
      // Create a project with a prompt
      const projectName = generateProjectName();
      await app.createProject(projectName);
      await window.waitForTimeout(500);

      await app.explorer.selectProject(projectName);
      await app.createPrompt('Test Prompt');
      await window.waitForTimeout(500);

      // Collapse the project (click expand icon which toggles)
      await app.explorer.expandProject(projectName);
      await window.waitForTimeout(300);
      await app.explorer.expandProject(projectName); // Collapse

      // Verify prompt is hidden
      const promptItem = window.locator('[data-testid="file-item"][data-name="Test Prompt"]');
      await expect(promptItem).toBeHidden();
    });

    test('should search projects by name', async ({ window }) => {
      // Create multiple projects
      const project1 = 'Alpha Project';
      const project2 = 'Beta Project';
      const project3 = 'Gamma Project';

      await app.createProject(project1);
      await app.createProject(project2);
      await app.createProject(project3);
      await window.waitForTimeout(500);

      // Search for specific project
      await app.explorer.searchFiles('Alpha');

      // Only Alpha should be visible
      const alphaProject = window.locator(`[data-testid="project-item"][data-name="${project1}"]`);
      await expect(alphaProject).toBeVisible();

      // Others should be filtered out
      const betaProject = window.locator(`[data-testid="project-item"][data-name="${project2}"]`);
      const gammaProject = window.locator(`[data-testid="project-item"][data-name="${project3}"]`);
      await expect(betaProject).toBeHidden();
      await expect(gammaProject).toBeHidden();
    });

    test('should clear search filter', async ({ window }) => {
      // Create projects
      const project1 = 'Project One';
      const project2 = 'Project Two';

      await app.createProject(project1);
      await app.createProject(project2);
      await window.waitForTimeout(500);

      // Search
      await app.explorer.searchFiles('One');
      await window.waitForTimeout(300);

      // Clear search
      await app.explorer.clearSearch();
      await window.waitForTimeout(300);

      // Both should be visible
      const projectOne = window.locator(`[data-testid="project-item"][data-name="${project1}"]`);
      const projectTwo = window.locator(`[data-testid="project-item"][data-name="${project2}"]`);
      await expect(projectOne).toBeVisible();
      await expect(projectTwo).toBeVisible();
    });
  });

  test.describe('Project Context Menu', () => {
    test('should show context menu on right-click', async ({ window }) => {
      const projectName = generateProjectName();
      await app.createProject(projectName);
      await window.waitForTimeout(500);

      // Right-click on project
      const projectItem = window.locator(
        `[data-testid="project-item"][data-name="${projectName}"]`
      );
      await projectItem.click({ button: 'right' });

      // Context menu should appear with options
      const contextMenu = window.locator('[data-testid="context-menu"]');
      await expect(contextMenu).toBeVisible();

      // Verify menu options
      await expect(window.locator('[data-testid="context-menu-rename"]')).toBeVisible();
      await expect(window.locator('[data-testid="context-menu-delete"]')).toBeVisible();
      await expect(window.locator('[data-testid="context-menu-new-prompt"]')).toBeVisible();
      await expect(window.locator('[data-testid="context-menu-new-directory"]')).toBeVisible();
    });

    test('should create new prompt from context menu', async ({ window }) => {
      const projectName = generateProjectName();
      await app.createProject(projectName);
      await window.waitForTimeout(500);

      // Right-click on project
      const projectItem = window.locator(
        `[data-testid="project-item"][data-name="${projectName}"]`
      );
      await projectItem.click({ button: 'right' });

      // Click new prompt option
      await window.locator('[data-testid="context-menu-new-prompt"]').click();

      // New prompt dialog should appear
      await app.dialogs.waitForDialog('new-prompt-dialog');
      await expect(window.locator('[data-testid="new-prompt-dialog"]')).toBeVisible();
    });

    test('should create new directory from context menu', async ({ window }) => {
      const projectName = generateProjectName();
      await app.createProject(projectName);
      await window.waitForTimeout(500);

      // Right-click on project
      const projectItem = window.locator(
        `[data-testid="project-item"][data-name="${projectName}"]`
      );
      await projectItem.click({ button: 'right' });

      // Click new directory option
      await window.locator('[data-testid="context-menu-new-directory"]').click();

      // New directory dialog should appear
      await app.dialogs.waitForDialog('new-directory-dialog');
      await expect(window.locator('[data-testid="new-directory-dialog"]')).toBeVisible();
    });
  });
});
