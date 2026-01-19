import {
  test,
  expect,
  MyndPromptsApp,
  TestData,
  generateProjectName,
  generatePromptName,
} from '../helpers';

/**
 * E2E Tests for Git Operations
 *
 * Tests cover:
 * - Git initialization
 * - Staging and committing
 * - Branch management
 * - Git status display
 * - History viewing
 */

test.describe('Git Operations', () => {
  let app: MyndPromptsApp;
  let projectName: string;

  test.beforeEach(async ({ window }) => {
    app = new MyndPromptsApp(window);
    await app.waitForAppReady();

    // Create a test project
    projectName = generateProjectName();
    await app.createProject(projectName);
    await window.waitForTimeout(500);
    await app.explorer.selectProject(projectName);
  });

  test.describe('Initialize Repository', () => {
    test('should initialize a new Git repository', async ({ window }) => {
      await app.navigateTo('git');
      await window.waitForTimeout(300);

      // Click init button
      await app.git.initRepository();

      // Git setup dialog should appear
      await app.dialogs.waitForDialog('git-setup-dialog');

      // Fill user info
      await app.dialogs.fillGitSetupDialog(TestData.git.user.name, TestData.git.user.email);

      // Confirm
      await app.dialogs.confirmDialog();

      await window.waitForTimeout(1000);

      // Init button should disappear or be replaced
      const initButton = window.locator('[data-testid="git-init-btn"]');
      await expect(initButton).toBeHidden();

      // Git status should be visible
      const statusArea = window.locator('[data-testid="git-status"]');
      await expect(statusArea).toBeVisible();
    });

    test('should show branch name after init', async ({ window }) => {
      await app.navigateTo('git');
      await app.git.initRepository();
      await app.dialogs.waitForDialog('git-setup-dialog');
      await app.dialogs.fillGitSetupDialog(TestData.git.user.name, TestData.git.user.email);
      await app.dialogs.confirmDialog();

      await window.waitForTimeout(1000);

      // Branch selector should show 'main' or 'master'
      const branchSelector = window.locator('[data-testid="branch-selector"]');
      const branchText = await branchSelector.textContent();
      expect(branchText).toMatch(/main|master/);
    });

    test('should cancel Git initialization', async ({ window }) => {
      await app.navigateTo('git');
      await app.git.initRepository();
      await app.dialogs.waitForDialog('git-setup-dialog');

      // Cancel
      await app.dialogs.cancelDialog();

      await window.waitForTimeout(500);

      // Init button should still be visible
      const initButton = window.locator('[data-testid="git-init-btn"]');
      await expect(initButton).toBeVisible();
    });
  });

  test.describe('Git Status', () => {
    test.beforeEach(async ({ window }) => {
      // Initialize Git for these tests
      await app.navigateTo('git');
      await app.git.initRepository();
      await app.dialogs.waitForDialog('git-setup-dialog');
      await app.dialogs.fillGitSetupDialog(TestData.git.user.name, TestData.git.user.email);
      await app.dialogs.confirmDialog();
      await window.waitForTimeout(1000);
    });

    test('should show untracked files', async ({ window }) => {
      // Create a new prompt
      await app.navigateTo('explorer');
      await app.createPrompt('Untracked Prompt', 'general');
      await window.waitForTimeout(500);

      // Check Git panel
      await app.navigateTo('git');
      await window.waitForTimeout(500);

      // Should show untracked file
      const changedCount = await app.git.getChangedCount();
      expect(changedCount).toBeGreaterThan(0);
    });

    test('should show modified files', async ({ window }) => {
      // Create and save a prompt
      await app.navigateTo('explorer');
      await app.createPrompt('Modified Prompt', 'general');
      await window.waitForTimeout(500);

      // Stage and commit the prompt
      await app.navigateTo('git');
      await app.git.stageAll();
      await app.git.commit('Initial commit');
      await window.waitForTimeout(500);

      // Modify the prompt
      await app.navigateTo('explorer');
      await app.openFile('Modified Prompt');
      await app.editor.typeContent('\nAdded content');
      await app.editor.save();
      await window.waitForTimeout(500);

      // Check Git panel for modified file
      await app.navigateTo('git');
      await window.waitForTimeout(500);

      const changedCount = await app.git.getChangedCount();
      expect(changedCount).toBeGreaterThan(0);
    });

    test('should display change count badge', async ({ window }) => {
      // Create prompts
      await app.navigateTo('explorer');
      await app.createPrompt('File 1', 'general');
      await app.createPrompt('File 2', 'general');
      await window.waitForTimeout(500);

      // Check activity bar badge
      const gitButton = window.locator('[data-testid="activity-git"]');
      const badge = gitButton.locator('[data-testid="change-count-badge"]');
      await expect(badge).toBeVisible();

      const badgeText = await badge.textContent();
      expect(parseInt(badgeText || '0')).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('Staging and Committing', () => {
    test.beforeEach(async ({ window }) => {
      // Initialize Git
      await app.navigateTo('git');
      await app.git.initRepository();
      await app.dialogs.waitForDialog('git-setup-dialog');
      await app.dialogs.fillGitSetupDialog(TestData.git.user.name, TestData.git.user.email);
      await app.dialogs.confirmDialog();
      await window.waitForTimeout(1000);
    });

    test('should stage a single file', async ({ window }) => {
      // Create a prompt
      await app.navigateTo('explorer');
      await app.createPrompt('Stage Test', 'general');
      await window.waitForTimeout(500);

      // Stage the file
      await app.navigateTo('git');
      await window.waitForTimeout(300);
      await app.git.stageFile('Stage Test');
      await window.waitForTimeout(500);

      // Staged count should increase
      const stagedCount = await app.git.getStagedCount();
      expect(stagedCount).toBeGreaterThan(0);
    });

    test('should unstage a file', async ({ window }) => {
      // Create and stage a prompt
      await app.navigateTo('explorer');
      await app.createPrompt('Unstage Test', 'general');
      await window.waitForTimeout(500);

      await app.navigateTo('git');
      await app.git.stageFile('Unstage Test');
      await window.waitForTimeout(500);

      const initialStaged = await app.git.getStagedCount();

      // Unstage
      await app.git.unstageFile('Unstage Test');
      await window.waitForTimeout(500);

      const newStaged = await app.git.getStagedCount();
      expect(newStaged).toBeLessThan(initialStaged);
    });

    test('should stage all files', async ({ window }) => {
      // Create multiple prompts
      await app.navigateTo('explorer');
      await app.createPrompt('Bulk 1', 'general');
      await app.createPrompt('Bulk 2', 'general');
      await window.waitForTimeout(500);

      // Stage all
      await app.navigateTo('git');
      await window.waitForTimeout(300);
      await app.git.stageAll();
      await window.waitForTimeout(500);

      // All files should be staged
      const changedCount = await app.git.getChangedCount();
      expect(changedCount).toBe(0);

      const stagedCount = await app.git.getStagedCount();
      expect(stagedCount).toBeGreaterThan(0);
    });

    test('should commit staged files', async ({ window }) => {
      // Create and stage a prompt
      await app.navigateTo('explorer');
      await app.createPrompt('Commit Test', 'general');
      await window.waitForTimeout(500);

      await app.navigateTo('git');
      await app.git.stageAll();
      await window.waitForTimeout(500);

      // Commit
      const commitMessage = 'Test commit message';
      await app.git.commit(commitMessage);
      await window.waitForTimeout(1000);

      // Staged files should be cleared
      const stagedCount = await app.git.getStagedCount();
      expect(stagedCount).toBe(0);

      // Toast notification should appear
      const toast = window.locator('.q-notification', { hasText: 'committed' });
      await expect(toast).toBeVisible({ timeout: 3000 });
    });

    test('should show commit message validation', async ({ window }) => {
      // Create and stage a prompt
      await app.navigateTo('explorer');
      await app.createPrompt('Validation Test', 'general');
      await window.waitForTimeout(500);

      await app.navigateTo('git');
      await app.git.stageAll();
      await window.waitForTimeout(500);

      // Try to commit with empty message
      await app.git.commit('');
      await window.waitForTimeout(500);

      // Error should appear or button should be disabled
      const commitButton = window.locator('[data-testid="commit-btn"]');
      const isDisabled = await commitButton.isDisabled();
      expect(isDisabled).toBe(true);
    });
  });

  test.describe('Branch Management', () => {
    test.beforeEach(async ({ window }) => {
      // Initialize Git and make initial commit
      await app.navigateTo('git');
      await app.git.initRepository();
      await app.dialogs.waitForDialog('git-setup-dialog');
      await app.dialogs.fillGitSetupDialog(TestData.git.user.name, TestData.git.user.email);
      await app.dialogs.confirmDialog();
      await window.waitForTimeout(1000);

      // Create initial commit
      await app.navigateTo('explorer');
      await app.createPrompt('Initial Prompt', 'general');
      await window.waitForTimeout(500);
      await app.navigateTo('git');
      await app.git.stageAll();
      await app.git.commit('Initial commit');
      await window.waitForTimeout(1000);
    });

    test('should create a new branch', async ({ window }) => {
      // Open branch dialog
      await app.git.branchSelector.click();
      await window.locator('[data-testid="new-branch-option"]').click();

      await app.dialogs.waitForDialog('branch-dialog');

      // Create branch
      const branchName = 'feature/test-branch';
      await app.dialogs.createBranch(branchName);

      await window.waitForTimeout(1000);

      // Branch selector should show new branch
      const branchText = await app.git.branchSelector.textContent();
      expect(branchText).toContain('test-branch');
    });

    test('should switch branches', async ({ window }) => {
      // Create a new branch
      await app.git.branchSelector.click();
      await window.locator('[data-testid="new-branch-option"]').click();
      await app.dialogs.waitForDialog('branch-dialog');
      await app.dialogs.createBranch('feature/switch-test');
      await window.waitForTimeout(1000);

      // Switch back to main
      await app.git.selectBranch('main');
      await window.waitForTimeout(500);

      // Verify we're on main
      const branchText = await app.git.branchSelector.textContent();
      expect(branchText).toMatch(/main|master/);
    });

    test('should list all branches', async ({ window }) => {
      // Create multiple branches
      await app.git.branchSelector.click();
      await window.locator('[data-testid="new-branch-option"]').click();
      await app.dialogs.waitForDialog('branch-dialog');
      await app.dialogs.createBranch('feature/branch-1');
      await window.waitForTimeout(500);

      await app.git.branchSelector.click();
      await window.locator('[data-testid="new-branch-option"]').click();
      await app.dialogs.waitForDialog('branch-dialog');
      await app.dialogs.createBranch('feature/branch-2');
      await window.waitForTimeout(500);

      // Open branch dropdown
      await app.git.branchSelector.click();

      // Both branches should be listed
      const branchOptions = window.locator('[data-testid="branch-option"]');
      const count = await branchOptions.count();
      expect(count).toBeGreaterThanOrEqual(3); // main + 2 features
    });

    test('should prevent switching with uncommitted changes', async ({ window }) => {
      // Make uncommitted changes
      await app.navigateTo('explorer');
      await app.createPrompt('Uncommitted Prompt', 'general');
      await window.waitForTimeout(500);

      // Try to switch branches
      await app.navigateTo('git');
      await app.git.selectBranch('feature/test');

      // Warning dialog should appear
      const warningDialog = window.locator('[data-testid="uncommitted-changes-warning"]');
      await expect(warningDialog).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Git History', () => {
    test.beforeEach(async ({ window }) => {
      // Initialize Git and make commits
      await app.navigateTo('git');
      await app.git.initRepository();
      await app.dialogs.waitForDialog('git-setup-dialog');
      await app.dialogs.fillGitSetupDialog(TestData.git.user.name, TestData.git.user.email);
      await app.dialogs.confirmDialog();
      await window.waitForTimeout(1000);

      // Make multiple commits
      await app.navigateTo('explorer');
      await app.createPrompt('Commit 1', 'general');
      await window.waitForTimeout(300);
      await app.navigateTo('git');
      await app.git.stageAll();
      await app.git.commit('First commit');
      await window.waitForTimeout(500);

      await app.navigateTo('explorer');
      await app.createPrompt('Commit 2', 'general');
      await window.waitForTimeout(300);
      await app.navigateTo('git');
      await app.git.stageAll();
      await app.git.commit('Second commit');
      await window.waitForTimeout(500);
    });

    test('should open Git history dialog', async ({ window }) => {
      await app.git.viewHistory();

      await app.dialogs.waitForDialog('git-history-dialog');

      const dialog = window.locator('[data-testid="git-history-dialog"]');
      await expect(dialog).toBeVisible();
    });

    test('should display commit list', async ({ window }) => {
      await app.git.viewHistory();
      await app.dialogs.waitForDialog('git-history-dialog');

      // Should show commits
      const commitItems = window.locator('[data-testid="commit-item"]');
      const count = await commitItems.count();
      expect(count).toBeGreaterThanOrEqual(2);
    });

    test('should display commit details', async ({ window }) => {
      await app.git.viewHistory();
      await app.dialogs.waitForDialog('git-history-dialog');

      // First commit should have message, author, date
      const firstCommit = window.locator('[data-testid="commit-item"]').first();

      const message = firstCommit.locator('[data-testid="commit-message"]');
      await expect(message).toBeVisible();

      const author = firstCommit.locator('[data-testid="commit-author"]');
      await expect(author).toContainText(TestData.git.user.name);

      const date = firstCommit.locator('[data-testid="commit-date"]');
      await expect(date).toBeVisible();
    });

    test('should show commit hash', async ({ window }) => {
      await app.git.viewHistory();
      await app.dialogs.waitForDialog('git-history-dialog');

      const commitHash = window.locator('[data-testid="commit-hash"]').first();
      const hashText = await commitHash.textContent();

      // Hash should be 7+ characters
      expect(hashText?.length).toBeGreaterThanOrEqual(7);
    });
  });

  test.describe('Status Bar Integration', () => {
    test('should show Git branch in status bar', async ({ window }) => {
      // Initialize Git
      await app.navigateTo('git');
      await app.git.initRepository();
      await app.dialogs.waitForDialog('git-setup-dialog');
      await app.dialogs.fillGitSetupDialog(TestData.git.user.name, TestData.git.user.email);
      await app.dialogs.confirmDialog();
      await window.waitForTimeout(1000);

      // Check status bar
      const gitBranch = await app.statusBar.getGitBranch();
      expect(gitBranch).toMatch(/main|master/);
    });

    test('should update status bar when changing branches', async ({ window }) => {
      // Initialize Git and commit
      await app.navigateTo('git');
      await app.git.initRepository();
      await app.dialogs.waitForDialog('git-setup-dialog');
      await app.dialogs.fillGitSetupDialog(TestData.git.user.name, TestData.git.user.email);
      await app.dialogs.confirmDialog();
      await window.waitForTimeout(1000);

      await app.navigateTo('explorer');
      await app.createPrompt('Test', 'general');
      await window.waitForTimeout(300);
      await app.navigateTo('git');
      await app.git.stageAll();
      await app.git.commit('Initial');
      await window.waitForTimeout(500);

      // Create and switch to new branch
      await app.git.branchSelector.click();
      await window.locator('[data-testid="new-branch-option"]').click();
      await app.dialogs.waitForDialog('branch-dialog');
      await app.dialogs.createBranch('feature/status-test');
      await window.waitForTimeout(1000);

      // Status bar should update
      const gitBranch = await app.statusBar.getGitBranch();
      expect(gitBranch).toContain('status-test');
    });
  });
});
