import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for MyndPrompts application
 * Provides reusable selectors and actions for E2E tests
 */

/**
 * Activity Bar - Left vertical navigation bar
 */
export class ActivityBar {
  readonly page: Page;
  readonly container: Locator;
  readonly explorerButton: Locator;
  readonly searchButton: Locator;
  readonly snippetsButton: Locator;
  readonly favoritesButton: Locator;
  readonly gitButton: Locator;
  readonly aiButton: Locator;
  readonly settingsButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('[data-testid="activity-bar"]');
    this.explorerButton = page.locator('[data-testid="activity-explorer"]');
    this.searchButton = page.locator('[data-testid="activity-search"]');
    this.snippetsButton = page.locator('[data-testid="activity-snippets"]');
    this.favoritesButton = page.locator('[data-testid="activity-favorites"]');
    this.gitButton = page.locator('[data-testid="activity-git"]');
    this.aiButton = page.locator('[data-testid="activity-ai"]');
    this.settingsButton = page.locator('[data-testid="activity-settings"]');
  }

  async clickExplorer() {
    await this.explorerButton.click();
  }

  async clickSearch() {
    await this.searchButton.click();
  }

  async clickSnippets() {
    await this.snippetsButton.click();
  }

  async clickFavorites() {
    await this.favoritesButton.click();
  }

  async clickGit() {
    await this.gitButton.click();
  }

  async clickAI() {
    await this.aiButton.click();
  }

  async clickSettings() {
    await this.settingsButton.click();
  }
}

/**
 * Sidebar - Collapsible left panel
 */
export class Sidebar {
  readonly page: Page;
  readonly container: Locator;
  readonly header: Locator;
  readonly collapseButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('[data-testid="sidebar"]');
    this.header = page.locator('[data-testid="sidebar-header"]');
    this.collapseButton = page.locator('[data-testid="sidebar-collapse"]');
  }

  async collapse() {
    await this.collapseButton.click();
  }

  async expand() {
    await this.collapseButton.click();
  }

  async isCollapsed(): Promise<boolean> {
    const classList = await this.container.getAttribute('class');
    return classList?.includes('collapsed') ?? false;
  }
}

/**
 * Explorer Panel - File/Project browser
 */
export class ExplorerPanel {
  readonly page: Page;
  readonly container: Locator;
  readonly newProjectButton: Locator;
  readonly newPromptButton: Locator;
  readonly newDirectoryButton: Locator;
  readonly projectTree: Locator;
  readonly searchInput: Locator;
  readonly categoryFilter: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('[data-testid="explorer-panel"]');
    this.newProjectButton = page.locator('[data-testid="new-project-btn"]');
    this.newPromptButton = page.locator('[data-testid="new-prompt-btn"]');
    this.newDirectoryButton = page.locator('[data-testid="new-directory-btn"]');
    this.projectTree = page.locator('[data-testid="project-tree"]');
    this.searchInput = page.locator('[data-testid="explorer-search"]');
    this.categoryFilter = page.locator('[data-testid="category-filter"]');
  }

  async clickNewProject() {
    await this.newProjectButton.click();
  }

  async clickNewPrompt() {
    await this.newPromptButton.click();
  }

  async clickNewDirectory() {
    await this.newDirectoryButton.click();
  }

  async searchFiles(query: string) {
    await this.searchInput.fill(query);
  }

  async clearSearch() {
    await this.searchInput.clear();
  }

  async selectProject(projectName: string) {
    const project = this.page.locator(`[data-testid="project-item"][data-name="${projectName}"]`);
    await project.click();
  }

  async expandProject(projectName: string) {
    const expander = this.page.locator(
      `[data-testid="project-item"][data-name="${projectName}"] [data-testid="expand-icon"]`
    );
    await expander.click();
  }

  async selectFile(fileName: string) {
    const file = this.page.locator(`[data-testid="file-item"][data-name="${fileName}"]`);
    await file.dblclick();
  }

  async rightClickFile(fileName: string) {
    const file = this.page.locator(`[data-testid="file-item"][data-name="${fileName}"]`);
    await file.click({ button: 'right' });
  }

  async getProjectCount(): Promise<number> {
    const projects = this.page.locator('[data-testid="project-item"]');
    return projects.count();
  }

  async getFileCount(): Promise<number> {
    const files = this.page.locator('[data-testid="file-item"]');
    return files.count();
  }
}

/**
 * Search Panel - Full-text search
 */
export class SearchPanel {
  readonly page: Page;
  readonly container: Locator;
  readonly searchInput: Locator;
  readonly matchCaseToggle: Locator;
  readonly wholeWordToggle: Locator;
  readonly regexToggle: Locator;
  readonly searchResults: Locator;
  readonly resultCount: Locator;
  readonly clearButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('[data-testid="search-panel"]');
    this.searchInput = page.locator('[data-testid="search-input"]');
    this.matchCaseToggle = page.locator('[data-testid="match-case"]');
    this.wholeWordToggle = page.locator('[data-testid="whole-word"]');
    this.regexToggle = page.locator('[data-testid="use-regex"]');
    this.searchResults = page.locator('[data-testid="search-results"]');
    this.resultCount = page.locator('[data-testid="result-count"]');
    this.clearButton = page.locator('[data-testid="clear-search"]');
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.page.keyboard.press('Enter');
  }

  async toggleMatchCase() {
    await this.matchCaseToggle.click();
  }

  async toggleWholeWord() {
    await this.wholeWordToggle.click();
  }

  async toggleRegex() {
    await this.regexToggle.click();
  }

  async clearSearch() {
    await this.clearButton.click();
  }

  async getResultCount(): Promise<number> {
    const results = this.page.locator('[data-testid="search-result-item"]');
    return results.count();
  }

  async clickResult(index: number) {
    const results = this.page.locator('[data-testid="search-result-item"]');
    await results.nth(index).click();
  }
}

/**
 * Snippets Panel - Snippet management
 */
export class SnippetsPanel {
  readonly page: Page;
  readonly container: Locator;
  readonly newSnippetButton: Locator;
  readonly typeFilter: Locator;
  readonly snippetList: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('[data-testid="snippets-panel"]');
    this.newSnippetButton = page.locator('[data-testid="new-snippet-btn"]');
    this.typeFilter = page.locator('[data-testid="snippet-type-filter"]');
    this.snippetList = page.locator('[data-testid="snippet-list"]');
    this.searchInput = page.locator('[data-testid="snippet-search"]');
  }

  async clickNewSnippet() {
    await this.newSnippetButton.click();
  }

  async filterByType(type: 'all' | 'persona' | 'text' | 'code' | 'template') {
    await this.typeFilter.selectOption(type);
  }

  async searchSnippets(query: string) {
    await this.searchInput.fill(query);
  }

  async selectSnippet(snippetName: string) {
    const snippet = this.page.locator(`[data-testid="snippet-item"][data-name="${snippetName}"]`);
    await snippet.click();
  }

  async getSnippetCount(): Promise<number> {
    const snippets = this.page.locator('[data-testid="snippet-item"]');
    return snippets.count();
  }
}

/**
 * Favorites Panel - Favorite prompts
 */
export class FavoritesPanel {
  readonly page: Page;
  readonly container: Locator;
  readonly favoritesList: Locator;
  readonly categoryFilter: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('[data-testid="favorites-panel"]');
    this.favoritesList = page.locator('[data-testid="favorites-list"]');
    this.categoryFilter = page.locator('[data-testid="favorites-category-filter"]');
    this.searchInput = page.locator('[data-testid="favorites-search"]');
  }

  async selectFavorite(promptName: string) {
    const favorite = this.page.locator(`[data-testid="favorite-item"][data-name="${promptName}"]`);
    await favorite.dblclick();
  }

  async getFavoriteCount(): Promise<number> {
    const favorites = this.page.locator('[data-testid="favorite-item"]');
    return favorites.count();
  }
}

/**
 * Git Panel - Version control
 */
export class GitPanel {
  readonly page: Page;
  readonly container: Locator;
  readonly initButton: Locator;
  readonly commitInput: Locator;
  readonly commitButton: Locator;
  readonly pushButton: Locator;
  readonly pullButton: Locator;
  readonly branchSelector: Locator;
  readonly stagedFiles: Locator;
  readonly changedFiles: Locator;
  readonly historyButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('[data-testid="git-panel"]');
    this.initButton = page.locator('[data-testid="git-init-btn"]');
    this.commitInput = page.locator('[data-testid="commit-message"]');
    this.commitButton = page.locator('[data-testid="commit-btn"]');
    this.pushButton = page.locator('[data-testid="push-btn"]');
    this.pullButton = page.locator('[data-testid="pull-btn"]');
    this.branchSelector = page.locator('[data-testid="branch-selector"]');
    this.stagedFiles = page.locator('[data-testid="staged-files"]');
    this.changedFiles = page.locator('[data-testid="changed-files"]');
    this.historyButton = page.locator('[data-testid="git-history-btn"]');
  }

  async initRepository() {
    await this.initButton.click();
  }

  async commit(message: string) {
    await this.commitInput.fill(message);
    await this.commitButton.click();
  }

  async push() {
    await this.pushButton.click();
  }

  async pull() {
    await this.pullButton.click();
  }

  async selectBranch(branchName: string) {
    await this.branchSelector.click();
    await this.page.locator(`[data-testid="branch-option"][data-value="${branchName}"]`).click();
  }

  async stageFile(fileName: string) {
    const file = this.page.locator(`[data-testid="changed-file"][data-name="${fileName}"]`);
    await file.locator('[data-testid="stage-btn"]').click();
  }

  async unstageFile(fileName: string) {
    const file = this.page.locator(`[data-testid="staged-file"][data-name="${fileName}"]`);
    await file.locator('[data-testid="unstage-btn"]').click();
  }

  async stageAll() {
    await this.page.locator('[data-testid="stage-all-btn"]').click();
  }

  async viewHistory() {
    await this.historyButton.click();
  }

  async getStagedCount(): Promise<number> {
    const staged = this.page.locator('[data-testid="staged-file"]');
    return staged.count();
  }

  async getChangedCount(): Promise<number> {
    const changed = this.page.locator('[data-testid="changed-file"]');
    return changed.count();
  }
}

/**
 * Settings Panel - Application settings
 */
export class SettingsPanel {
  readonly page: Page;
  readonly container: Locator;
  readonly themeSelector: Locator;
  readonly languageSelector: Locator;
  readonly categoryEditor: Locator;
  readonly addCategoryButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('[data-testid="settings-panel"]');
    this.themeSelector = page.locator('[data-testid="theme-selector"]');
    this.languageSelector = page.locator('[data-testid="language-selector"]');
    this.categoryEditor = page.locator('[data-testid="category-editor"]');
    this.addCategoryButton = page.locator('[data-testid="add-category-btn"]');
  }

  async selectTheme(theme: 'light' | 'dark' | 'system') {
    await this.themeSelector.click();
    await this.page.locator(`[data-testid="theme-option"][data-value="${theme}"]`).click();
  }

  async selectLanguage(locale: string) {
    await this.languageSelector.click();
    await this.page.locator(`[data-testid="language-option"][data-value="${locale}"]`).click();
  }

  async addCategory(categoryName: string) {
    await this.addCategoryButton.click();
    await this.page.locator('[data-testid="new-category-input"]').fill(categoryName);
    await this.page.locator('[data-testid="save-category-btn"]').click();
  }

  async deleteCategory(categoryName: string) {
    const category = this.page.locator(
      `[data-testid="category-item"][data-name="${categoryName}"]`
    );
    await category.locator('[data-testid="delete-category-btn"]').click();
  }
}

/**
 * Tab Bar - Open file tabs
 */
export class TabBar {
  readonly page: Page;
  readonly container: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('[data-testid="tab-bar"]');
  }

  async selectTab(fileName: string) {
    const tab = this.page.locator(`[data-testid="tab"][data-name="${fileName}"]`);
    await tab.click();
  }

  async closeTab(fileName: string) {
    const tab = this.page.locator(`[data-testid="tab"][data-name="${fileName}"]`);
    await tab.locator('[data-testid="close-tab"]').click();
  }

  async closeAllTabs() {
    await this.container.click({ button: 'right' });
    await this.page.locator('[data-testid="close-all-tabs"]').click();
  }

  async getTabCount(): Promise<number> {
    const tabs = this.page.locator('[data-testid="tab"]');
    return tabs.count();
  }

  async isTabDirty(fileName: string): Promise<boolean> {
    const tab = this.page.locator(`[data-testid="tab"][data-name="${fileName}"]`);
    const classList = await tab.getAttribute('class');
    return classList?.includes('dirty') ?? false;
  }

  async getActiveTabName(): Promise<string | null> {
    const activeTab = this.page.locator('[data-testid="tab"].active');
    return activeTab.getAttribute('data-name');
  }
}

/**
 * Editor - Monaco Editor wrapper
 */
export class Editor {
  readonly page: Page;
  readonly container: Locator;
  readonly monacoEditor: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('[data-testid="editor-pane"]');
    this.monacoEditor = page.locator('.monaco-editor');
  }

  async waitForEditor() {
    await this.monacoEditor.waitFor({ state: 'visible', timeout: 10000 });
  }

  async typeContent(content: string) {
    await this.monacoEditor.click();
    await this.page.keyboard.type(content);
  }

  async clearContent() {
    await this.monacoEditor.click();
    await this.page.keyboard.press('Meta+A');
    await this.page.keyboard.press('Delete');
  }

  async setContent(content: string) {
    await this.clearContent();
    await this.typeContent(content);
  }

  async getContent(): Promise<string> {
    // Monaco editor content is in the view lines
    const lines = this.page.locator('.monaco-editor .view-line');
    const texts = await lines.allTextContents();
    return texts.join('\n');
  }

  async save() {
    await this.page.keyboard.press('Meta+S');
  }

  async undo() {
    await this.page.keyboard.press('Meta+Z');
  }

  async redo() {
    await this.page.keyboard.press('Meta+Shift+Z');
  }

  async triggerSnippet(trigger: string) {
    await this.monacoEditor.click();
    await this.page.keyboard.type(trigger);
    // Wait for autocomplete
    await this.page.waitForTimeout(500);
  }

  async selectAutocomplete(index: number = 0) {
    // Navigate to the desired autocomplete option
    for (let i = 0; i < index; i++) {
      await this.page.keyboard.press('ArrowDown');
    }
    await this.page.keyboard.press('Enter');
  }
}

/**
 * Status Bar - Bottom status information
 */
export class StatusBar {
  readonly page: Page;
  readonly container: Locator;
  readonly cursorPosition: Locator;
  readonly gitBranch: Locator;
  readonly language: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('[data-testid="status-bar"]');
    this.cursorPosition = page.locator('[data-testid="cursor-position"]');
    this.gitBranch = page.locator('[data-testid="git-branch"]');
    this.language = page.locator('[data-testid="current-language"]');
  }

  async getCursorPosition(): Promise<string | null> {
    return this.cursorPosition.textContent();
  }

  async getGitBranch(): Promise<string | null> {
    return this.gitBranch.textContent();
  }
}

/**
 * Bottom Panel - Output, Problems, Git Changes, AI Chat
 */
export class BottomPanel {
  readonly page: Page;
  readonly container: Locator;
  readonly outputTab: Locator;
  readonly problemsTab: Locator;
  readonly gitChangesTab: Locator;
  readonly aiChatTab: Locator;
  readonly collapseButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('[data-testid="bottom-panel"]');
    this.outputTab = page.locator('[data-testid="output-tab"]');
    this.problemsTab = page.locator('[data-testid="problems-tab"]');
    this.gitChangesTab = page.locator('[data-testid="git-changes-tab"]');
    this.aiChatTab = page.locator('[data-testid="ai-chat-tab"]');
    this.collapseButton = page.locator('[data-testid="panel-collapse"]');
  }

  async clickOutput() {
    await this.outputTab.click();
  }

  async clickProblems() {
    await this.problemsTab.click();
  }

  async clickGitChanges() {
    await this.gitChangesTab.click();
  }

  async clickAIChat() {
    await this.aiChatTab.click();
  }

  async collapse() {
    await this.collapseButton.click();
  }

  async expand() {
    await this.collapseButton.click();
  }
}

/**
 * Dialog helpers - Common dialog interactions
 */
export class Dialogs {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async waitForDialog(testId: string) {
    await this.page.locator(`[data-testid="${testId}"]`).waitFor({ state: 'visible' });
  }

  async closeDialog() {
    await this.page.keyboard.press('Escape');
  }

  async confirmDialog() {
    await this.page.locator('[data-testid="dialog-confirm"]').click();
  }

  async cancelDialog() {
    await this.page.locator('[data-testid="dialog-cancel"]').click();
  }

  // New Project Dialog
  async fillNewProjectDialog(name: string, description?: string) {
    await this.page.locator('[data-testid="project-name-input"]').fill(name);
    if (description) {
      await this.page.locator('[data-testid="project-description-input"]').fill(description);
    }
  }

  // New Prompt Dialog
  async fillNewPromptDialog(title: string, category?: string) {
    await this.page.locator('[data-testid="prompt-title-input"]').fill(title);
    if (category) {
      await this.page.locator('[data-testid="prompt-category-select"]').selectOption(category);
    }
  }

  // New Snippet Dialog
  async fillNewSnippetDialog(
    title: string,
    type: 'persona' | 'text' | 'code' | 'template',
    shortcut?: string
  ) {
    await this.page.locator('[data-testid="snippet-title-input"]').fill(title);
    await this.page.locator('[data-testid="snippet-type-select"]').selectOption(type);
    if (shortcut) {
      await this.page.locator('[data-testid="snippet-shortcut-input"]').fill(shortcut);
    }
  }

  // Rename Dialog
  async fillRenameDialog(newName: string) {
    await this.page.locator('[data-testid="rename-input"]').fill(newName);
  }

  // Delete Confirm Dialog
  async confirmDelete() {
    await this.page.locator('[data-testid="confirm-delete-btn"]').click();
  }

  // Git Setup Dialog
  async fillGitSetupDialog(userName: string, userEmail: string, remoteUrl?: string) {
    await this.page.locator('[data-testid="git-user-name"]').fill(userName);
    await this.page.locator('[data-testid="git-user-email"]').fill(userEmail);
    if (remoteUrl) {
      await this.page.locator('[data-testid="git-remote-url"]').fill(remoteUrl);
    }
  }

  // Branch Dialog
  async createBranch(branchName: string) {
    await this.page.locator('[data-testid="new-branch-input"]').fill(branchName);
    await this.page.locator('[data-testid="create-branch-btn"]').click();
  }
}

/**
 * Main Application Page Object
 * Combines all components for easy access
 */
export class MyndPromptsApp {
  readonly page: Page;
  readonly activityBar: ActivityBar;
  readonly sidebar: Sidebar;
  readonly explorer: ExplorerPanel;
  readonly search: SearchPanel;
  readonly snippets: SnippetsPanel;
  readonly favorites: FavoritesPanel;
  readonly git: GitPanel;
  readonly settings: SettingsPanel;
  readonly tabBar: TabBar;
  readonly editor: Editor;
  readonly statusBar: StatusBar;
  readonly bottomPanel: BottomPanel;
  readonly dialogs: Dialogs;

  constructor(page: Page) {
    this.page = page;
    this.activityBar = new ActivityBar(page);
    this.sidebar = new Sidebar(page);
    this.explorer = new ExplorerPanel(page);
    this.search = new SearchPanel(page);
    this.snippets = new SnippetsPanel(page);
    this.favorites = new FavoritesPanel(page);
    this.git = new GitPanel(page);
    this.settings = new SettingsPanel(page);
    this.tabBar = new TabBar(page);
    this.editor = new Editor(page);
    this.statusBar = new StatusBar(page);
    this.bottomPanel = new BottomPanel(page);
    this.dialogs = new Dialogs(page);
  }

  /**
   * Wait for the application to be fully loaded
   */
  async waitForAppReady() {
    await this.page.waitForSelector('#q-app', { timeout: 30000 });
    await this.page.waitForSelector('[data-testid="activity-bar"]', { timeout: 10000 });
  }

  /**
   * Navigate to a specific view
   */
  async navigateTo(view: 'explorer' | 'search' | 'snippets' | 'favorites' | 'git' | 'settings') {
    switch (view) {
      case 'explorer':
        await this.activityBar.clickExplorer();
        break;
      case 'search':
        await this.activityBar.clickSearch();
        break;
      case 'snippets':
        await this.activityBar.clickSnippets();
        break;
      case 'favorites':
        await this.activityBar.clickFavorites();
        break;
      case 'git':
        await this.activityBar.clickGit();
        break;
      case 'settings':
        await this.activityBar.clickSettings();
        break;
    }
  }

  /**
   * Create a new project with given name
   */
  async createProject(name: string, description?: string) {
    await this.navigateTo('explorer');
    await this.explorer.clickNewProject();
    await this.dialogs.waitForDialog('new-project-dialog');
    await this.dialogs.fillNewProjectDialog(name, description);
    await this.dialogs.confirmDialog();
  }

  /**
   * Create a new prompt
   */
  async createPrompt(title: string, category?: string) {
    await this.navigateTo('explorer');
    await this.explorer.clickNewPrompt();
    await this.dialogs.waitForDialog('new-prompt-dialog');
    await this.dialogs.fillNewPromptDialog(title, category);
    await this.dialogs.confirmDialog();
  }

  /**
   * Create a new snippet
   */
  async createSnippet(
    title: string,
    type: 'persona' | 'text' | 'code' | 'template',
    shortcut?: string
  ) {
    await this.navigateTo('snippets');
    await this.snippets.clickNewSnippet();
    await this.dialogs.waitForDialog('new-snippet-dialog');
    await this.dialogs.fillNewSnippetDialog(title, type, shortcut);
    await this.dialogs.confirmDialog();
  }

  /**
   * Open a file in the editor
   */
  async openFile(fileName: string) {
    await this.navigateTo('explorer');
    await this.explorer.selectFile(fileName);
    await this.editor.waitForEditor();
  }

  /**
   * Save the current file
   */
  async saveCurrentFile() {
    await this.editor.save();
  }

  /**
   * Change application theme
   */
  async setTheme(theme: 'light' | 'dark' | 'system') {
    await this.navigateTo('settings');
    await this.settings.selectTheme(theme);
  }

  /**
   * Change application language
   */
  async setLanguage(locale: string) {
    await this.navigateTo('settings');
    await this.settings.selectLanguage(locale);
  }

  /**
   * Initialize Git repository
   */
  async initGitRepo(userName: string, userEmail: string) {
    await this.navigateTo('git');
    await this.git.initRepository();
    await this.dialogs.waitForDialog('git-setup-dialog');
    await this.dialogs.fillGitSetupDialog(userName, userEmail);
    await this.dialogs.confirmDialog();
  }
}
