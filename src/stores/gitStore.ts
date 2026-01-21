/**
 * Git Store
 *
 * Pinia store for managing Git state in the application.
 * Provides reactive state for Git status, history, and operations.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getGitService } from '@/services/git';
import type {
  IGitStatusSummary,
  IGitCommit,
  IGitBranch,
  IGitRemote,
  IGitFileStatus,
  IGitCheckResult,
} from '@/services/git/types';

export const useGitStore = defineStore('git', () => {
  // ================================
  // State
  // ================================

  const isInitialized = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Git installation status
  const gitCheckResult = ref<IGitCheckResult | null>(null);

  // Repository state
  const isRepo = ref(false);
  const repoPath = ref<string | null>(null);

  // Current status
  const statusSummary = ref<IGitStatusSummary | null>(null);

  // History
  const commits = ref<IGitCommit[]>([]);
  const isLoadingHistory = ref(false);

  // Branches
  const branches = ref<IGitBranch[]>([]);
  const currentBranch = ref<string>('');

  // Remotes
  const remotes = ref<IGitRemote[]>([]);

  // User config
  const userConfig = ref<{ name?: string; email?: string }>({});

  // ================================
  // Computed
  // ================================

  const isGitInstalled = computed(() => gitCheckResult.value?.isInstalled ?? false);
  const gitVersion = computed(() => gitCheckResult.value?.version);

  const stagedFiles = computed((): IGitFileStatus[] => statusSummary.value?.staged ?? []);
  const modifiedFiles = computed((): IGitFileStatus[] => statusSummary.value?.modified ?? []);
  const untrackedFiles = computed((): IGitFileStatus[] => statusSummary.value?.untracked ?? []);
  const deletedFiles = computed((): IGitFileStatus[] => statusSummary.value?.deleted ?? []);
  const conflictedFiles = computed((): IGitFileStatus[] => statusSummary.value?.conflicted ?? []);

  const hasChanges = computed(
    () =>
      stagedFiles.value.length > 0 ||
      modifiedFiles.value.length > 0 ||
      untrackedFiles.value.length > 0 ||
      deletedFiles.value.length > 0
  );

  const hasStagedChanges = computed(() => stagedFiles.value.length > 0);
  const hasUnstagedChanges = computed(
    () =>
      modifiedFiles.value.length > 0 ||
      untrackedFiles.value.length > 0 ||
      deletedFiles.value.length > 0
  );

  const hasConflicts = computed(() => conflictedFiles.value.length > 0);

  const changeCount = computed(
    () =>
      stagedFiles.value.length +
      modifiedFiles.value.length +
      untrackedFiles.value.length +
      deletedFiles.value.length
  );

  const aheadBehind = computed(() => ({
    ahead: statusSummary.value?.ahead ?? 0,
    behind: statusSummary.value?.behind ?? 0,
  }));

  const trackingBranch = computed(() => statusSummary.value?.tracking);

  // ================================
  // Actions
  // ================================

  const gitService = getGitService();

  /**
   * Initialize the Git store for a specific path.
   * If the path is different from the current one, reinitialize for the new path.
   */
  async function initialize(promptsPath: string): Promise<void> {
    // If path changed, we need to reinitialize for the new path
    const pathChanged = repoPath.value !== promptsPath;
    if (isInitialized.value && !pathChanged) return;

    isLoading.value = true;
    error.value = null;

    try {
      // Check if Git is installed (only need to check once)
      if (gitCheckResult.value === null) {
        gitCheckResult.value = await gitService.isInstalled();
      }

      if (!gitCheckResult.value.isInstalled) {
        isInitialized.value = true;
        return;
      }

      // Set the working directory
      repoPath.value = promptsPath;

      // Check if the prompts directory is a Git repo
      const repoCheck = await gitService.isRepo(promptsPath);
      isRepo.value = repoCheck.isRepo;

      if (isRepo.value) {
        await gitService.setWorkingDirectory(promptsPath);
        await refreshStatus();
        await loadUserConfig();
      } else {
        // Reset git state when not a repo
        currentBranch.value = '';
        statusSummary.value = null;
        branches.value = [];
        commits.value = [];
        remotes.value = [];
      }

      isInitialized.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to initialize Git';
      console.error('Git initialization error:', err);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Initialize a new Git repository
   */
  async function initRepository(path?: string): Promise<boolean> {
    const targetPath = path ?? repoPath.value;
    if (!targetPath) {
      error.value = 'No path specified';
      return false;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const result = await gitService.init(targetPath);
      if (result.success) {
        isRepo.value = true;
        repoPath.value = targetPath;
        await refreshStatus();
        return true;
      } else {
        error.value = result.error ?? 'Failed to initialize repository';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to initialize repository';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Refresh Git status
   */
  async function refreshStatus(): Promise<void> {
    if (!isRepo.value) return;

    try {
      statusSummary.value = await gitService.status();
      currentBranch.value = statusSummary.value.branch;
    } catch (err) {
      console.error('Error refreshing Git status:', err);
    }
  }

  /**
   * Stage files
   */
  async function stageFiles(files: string[] | 'all'): Promise<boolean> {
    if (!isRepo.value) return false;

    isLoading.value = true;
    error.value = null;

    try {
      const result = await gitService.add(files);
      if (result.success) {
        await refreshStatus();
        return true;
      } else {
        error.value = result.error ?? 'Failed to stage files';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to stage files';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Unstage files
   */
  async function unstageFiles(files: string[]): Promise<boolean> {
    if (!isRepo.value) return false;

    isLoading.value = true;
    error.value = null;

    try {
      const result = await gitService.unstage(files);
      if (result.success) {
        await refreshStatus();
        return true;
      } else {
        error.value = result.error ?? 'Failed to unstage files';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to unstage files';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Commit staged changes
   */
  async function commit(message: string): Promise<boolean> {
    if (!isRepo.value || !hasStagedChanges.value) return false;

    isLoading.value = true;
    error.value = null;

    try {
      const result = await gitService.commit(message);
      if (result.success) {
        await refreshStatus();
        await loadHistory();
        return true;
      } else {
        error.value = result.error ?? 'Failed to commit';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to commit';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Discard changes in a file
   */
  async function discardChanges(filePath: string): Promise<boolean> {
    if (!isRepo.value) return false;

    isLoading.value = true;
    error.value = null;

    try {
      const result = await gitService.discardChanges(filePath);
      if (result.success) {
        await refreshStatus();
        return true;
      } else {
        error.value = result.error ?? 'Failed to discard changes';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to discard changes';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Load commit history
   */
  async function loadHistory(limit: number = 50): Promise<void> {
    if (!isRepo.value) return;

    isLoadingHistory.value = true;

    try {
      commits.value = await gitService.log({ maxCount: limit });
    } catch (err) {
      console.error('Error loading Git history:', err);
    } finally {
      isLoadingHistory.value = false;
    }
  }

  /**
   * Get diff for a file
   */
  async function getDiff(filePath?: string, cached: boolean = false): Promise<string> {
    if (!isRepo.value) return '';

    try {
      return await gitService.diff(filePath, undefined, cached);
    } catch (err) {
      console.error('Error getting diff:', err);
      return '';
    }
  }

  /**
   * Push to remote
   */
  async function push(remote?: string, branch?: string): Promise<boolean> {
    if (!isRepo.value) return false;

    isLoading.value = true;
    error.value = null;

    try {
      const result = await gitService.push(remote, branch);
      if (result.success) {
        await refreshStatus();
        return true;
      } else {
        error.value = result.error ?? 'Failed to push';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to push';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Pull from remote
   */
  async function pull(remote?: string, branch?: string): Promise<boolean> {
    if (!isRepo.value) return false;

    isLoading.value = true;
    error.value = null;

    try {
      const result = await gitService.pull(remote, branch);
      if (result.success) {
        await refreshStatus();
        await loadHistory();
        return true;
      } else {
        error.value = result.error ?? 'Failed to pull';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to pull';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Fetch from remote
   */
  async function fetch(remote?: string): Promise<boolean> {
    if (!isRepo.value) return false;

    isLoading.value = true;
    error.value = null;

    try {
      const result = await gitService.fetch(remote);
      if (result.success) {
        await refreshStatus();
        return true;
      } else {
        error.value = result.error ?? 'Failed to fetch';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Load branches
   */
  async function loadBranches(): Promise<void> {
    if (!isRepo.value) return;

    try {
      branches.value = await gitService.branches();
    } catch (err) {
      console.error('Error loading branches:', err);
    }
  }

  /**
   * Create a new branch
   */
  async function createBranch(name: string): Promise<boolean> {
    if (!isRepo.value) return false;

    isLoading.value = true;
    error.value = null;

    try {
      const result = await gitService.createBranch(name);
      if (result.success) {
        await loadBranches();
        await refreshStatus();
        return true;
      } else {
        error.value = result.error ?? 'Failed to create branch';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create branch';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Switch to a branch
   */
  async function switchBranch(name: string): Promise<boolean> {
    if (!isRepo.value) return false;

    isLoading.value = true;
    error.value = null;

    try {
      const result = await gitService.switchBranch(name);
      if (result.success) {
        await refreshStatus();
        await loadHistory();
        return true;
      } else {
        error.value = result.error ?? 'Failed to switch branch';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to switch branch';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Load remotes
   */
  async function loadRemotes(): Promise<void> {
    if (!isRepo.value) return;

    try {
      remotes.value = await gitService.remotes();
    } catch (err) {
      console.error('Error loading remotes:', err);
    }
  }

  /**
   * Add a remote
   */
  async function addRemote(name: string, url: string): Promise<boolean> {
    if (!isRepo.value) return false;

    isLoading.value = true;
    error.value = null;

    try {
      const result = await gitService.addRemote(name, url);
      if (result.success) {
        await loadRemotes();
        return true;
      } else {
        error.value = result.error ?? 'Failed to add remote';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to add remote';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Load user config
   */
  async function loadUserConfig(): Promise<void> {
    try {
      userConfig.value = await gitService.getConfig();
    } catch (err) {
      console.error('Error loading user config:', err);
    }
  }

  /**
   * Set user config
   */
  async function setUserConfig(
    name: string,
    email: string,
    global: boolean = false
  ): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const result = await gitService.setConfig(name, email, global);
      if (result.success) {
        await loadUserConfig();
        return true;
      } else {
        error.value = result.error ?? 'Failed to set config';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to set config';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Clear error
   */
  function clearError(): void {
    error.value = null;
  }

  /**
   * Remove Git repository (delete .git folder)
   */
  async function removeGit(path?: string): Promise<boolean> {
    const targetPath = path ?? repoPath.value;
    if (!targetPath) {
      error.value = 'No path specified';
      return false;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const result = await gitService.removeGit(targetPath);
      if (result.success) {
        // Reset state after removing git
        isRepo.value = false;
        repoPath.value = null;
        currentBranch.value = '';
        statusSummary.value = null;
        branches.value = [];
        commits.value = [];
        remotes.value = [];
        userConfig.value = {};
        return true;
      } else {
        error.value = result.error ?? 'Failed to remove Git repository';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to remove Git repository';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Get list of tracked files (files that have been committed)
   */
  async function getTrackedFiles(): Promise<string[]> {
    if (!isRepo.value) return [];

    try {
      return await gitService.getTrackedFiles();
    } catch (err) {
      console.error('Error getting tracked files:', err);
      return [];
    }
  }

  return {
    // State
    isInitialized,
    isLoading,
    error,
    gitCheckResult,
    isRepo,
    repoPath,
    statusSummary,
    commits,
    isLoadingHistory,
    branches,
    currentBranch,
    remotes,
    userConfig,

    // Computed
    isGitInstalled,
    gitVersion,
    stagedFiles,
    modifiedFiles,
    untrackedFiles,
    deletedFiles,
    conflictedFiles,
    hasChanges,
    hasStagedChanges,
    hasUnstagedChanges,
    hasConflicts,
    changeCount,
    aheadBehind,
    trackingBranch,

    // Actions
    initialize,
    initRepository,
    refreshStatus,
    stageFiles,
    unstageFiles,
    commit,
    discardChanges,
    loadHistory,
    getDiff,
    push,
    pull,
    fetch,
    loadBranches,
    createBranch,
    switchBranch,
    loadRemotes,
    addRemote,
    loadUserConfig,
    setUserConfig,
    clearError,
    getTrackedFiles,
    removeGit,
  };
});
