/**
 * Git Service (Renderer Process)
 *
 * Wraps the Git API exposed by the preload script.
 * Provides a typed interface for Git operations in the renderer process.
 */

import type {
  IGitStatusSummary,
  IGitCommit,
  IGitBranch,
  IGitRemote,
  IGitCheckResult,
  IGitRepoCheckResult,
  IGitInitResult,
  IGitCloneResult,
  IGitCommitResult,
  IGitOperationResult,
  IGitLogOptions,
  IStashEntry,
  IStashResult,
} from './types';

/**
 * Check if running in Electron environment
 */
function isElectron(): boolean {
  return window?.gitAPI !== undefined;
}

/**
 * Git Service class for renderer process
 */
class GitService {
  private static instance: GitService | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): GitService {
    if (!GitService.instance) {
      GitService.instance = new GitService();
    }
    return GitService.instance;
  }

  /**
   * Check if Git is installed
   */
  async isInstalled(): Promise<IGitCheckResult> {
    if (!isElectron()) {
      return { isInstalled: false, error: 'Not running in Electron' };
    }
    return window.gitAPI.isInstalled();
  }

  /**
   * Check if a path is a Git repository
   */
  async isRepo(path: string): Promise<IGitRepoCheckResult> {
    if (!isElectron()) {
      return { isRepo: false, error: 'Not running in Electron' };
    }
    return window.gitAPI.isRepo(path);
  }

  /**
   * Initialize a new Git repository
   */
  async init(path: string): Promise<IGitInitResult> {
    if (!isElectron()) {
      return { success: false, path, error: 'Not running in Electron' };
    }
    return window.gitAPI.init(path);
  }

  /**
   * Clone a repository
   */
  async clone(repoUrl: string, targetPath: string): Promise<IGitCloneResult> {
    if (!isElectron()) {
      return { success: false, path: targetPath, error: 'Not running in Electron' };
    }
    return window.gitAPI.clone(repoUrl, targetPath);
  }

  /**
   * Set the working directory for Git operations
   */
  async setWorkingDirectory(path: string): Promise<void> {
    if (!isElectron()) {
      return;
    }
    return window.gitAPI.setWorkingDirectory(path);
  }

  /**
   * Get Git status
   */
  async status(path?: string): Promise<IGitStatusSummary> {
    if (!isElectron()) {
      return {
        isRepo: false,
        branch: '',
        ahead: 0,
        behind: 0,
        staged: [],
        modified: [],
        deleted: [],
        untracked: [],
        conflicted: [],
        isClean: true,
      };
    }
    return window.gitAPI.status(path);
  }

  /**
   * Stage files for commit
   */
  async add(files: string[] | 'all', path?: string): Promise<IGitOperationResult> {
    if (!isElectron()) {
      return { success: false, error: 'Not running in Electron' };
    }
    return window.gitAPI.add(files, path);
  }

  /**
   * Unstage files
   */
  async unstage(files: string[], path?: string): Promise<IGitOperationResult> {
    if (!isElectron()) {
      return { success: false, error: 'Not running in Electron' };
    }
    return window.gitAPI.unstage(files, path);
  }

  /**
   * Commit staged changes
   */
  async commit(message: string, path?: string): Promise<IGitCommitResult> {
    if (!isElectron()) {
      return { success: false, error: 'Not running in Electron' };
    }
    return window.gitAPI.commit(message, path);
  }

  /**
   * Get commit history
   */
  async log(options?: IGitLogOptions, path?: string): Promise<IGitCommit[]> {
    if (!isElectron()) {
      return [];
    }
    return window.gitAPI.log(options, path);
  }

  /**
   * Get diff for a file
   */
  async diff(
    filePath?: string,
    commitHash?: string,
    cached: boolean = false,
    path?: string
  ): Promise<string> {
    if (!isElectron()) {
      return '';
    }
    return window.gitAPI.diff(filePath, commitHash, cached, path);
  }

  /**
   * Discard changes in a file
   */
  async discardChanges(filePath: string, path?: string): Promise<IGitOperationResult> {
    if (!isElectron()) {
      return { success: false, error: 'Not running in Electron' };
    }
    return window.gitAPI.discardChanges(filePath, path);
  }

  /**
   * Push to remote
   */
  async push(remote?: string, branch?: string, path?: string): Promise<IGitOperationResult> {
    if (!isElectron()) {
      return { success: false, error: 'Not running in Electron' };
    }
    return window.gitAPI.push(remote, branch, path);
  }

  /**
   * Pull from remote
   */
  async pull(remote?: string, branch?: string, path?: string): Promise<IGitOperationResult> {
    if (!isElectron()) {
      return { success: false, error: 'Not running in Electron' };
    }
    return window.gitAPI.pull(remote, branch, path);
  }

  /**
   * Fetch from remote
   */
  async fetch(remote?: string, path?: string): Promise<IGitOperationResult> {
    if (!isElectron()) {
      return { success: false, error: 'Not running in Electron' };
    }
    return window.gitAPI.fetch(remote, path);
  }

  /**
   * Get list of remotes
   */
  async remotes(path?: string): Promise<IGitRemote[]> {
    if (!isElectron()) {
      return [];
    }
    return window.gitAPI.remotes(path);
  }

  /**
   * Add a remote
   */
  async addRemote(name: string, url: string, path?: string): Promise<IGitOperationResult> {
    if (!isElectron()) {
      return { success: false, error: 'Not running in Electron' };
    }
    return window.gitAPI.addRemote(name, url, path);
  }

  /**
   * Remove a remote
   */
  async removeRemote(name: string, path?: string): Promise<IGitOperationResult> {
    if (!isElectron()) {
      return { success: false, error: 'Not running in Electron' };
    }
    return window.gitAPI.removeRemote(name, path);
  }

  /**
   * Get list of branches
   */
  async branches(path?: string): Promise<IGitBranch[]> {
    if (!isElectron()) {
      return [];
    }
    return window.gitAPI.branches(path);
  }

  /**
   * Create a new branch
   */
  async createBranch(name: string, path?: string): Promise<IGitOperationResult> {
    if (!isElectron()) {
      return { success: false, error: 'Not running in Electron' };
    }
    return window.gitAPI.createBranch(name, path);
  }

  /**
   * Switch to a branch
   */
  async switchBranch(name: string, path?: string): Promise<IGitOperationResult> {
    if (!isElectron()) {
      return { success: false, error: 'Not running in Electron' };
    }
    return window.gitAPI.switchBranch(name, path);
  }

  /**
   * Delete a branch
   */
  async deleteBranch(
    name: string,
    force: boolean = false,
    path?: string
  ): Promise<IGitOperationResult> {
    if (!isElectron()) {
      return { success: false, error: 'Not running in Electron' };
    }
    return window.gitAPI.deleteBranch(name, force, path);
  }

  /**
   * Stash changes
   */
  async stash(message?: string, path?: string): Promise<IGitOperationResult> {
    if (!isElectron()) {
      return { success: false, error: 'Not running in Electron' };
    }
    return window.gitAPI.stash(message, path);
  }

  /**
   * Pop stash
   */
  async stashPop(path?: string): Promise<IStashResult> {
    if (!isElectron()) {
      return { success: false };
    }
    return window.gitAPI.stashPop(path);
  }

  /**
   * List stash entries
   */
  async stashList(path?: string): Promise<IStashEntry[]> {
    if (!isElectron()) {
      return [];
    }
    return window.gitAPI.stashList(path);
  }

  /**
   * Get Git configuration
   */
  async getConfig(path?: string): Promise<{ name?: string; email?: string }> {
    if (!isElectron()) {
      return {};
    }
    return window.gitAPI.getConfig(path);
  }

  /**
   * Set Git configuration
   */
  async setConfig(
    name: string,
    email: string,
    global: boolean = false,
    path?: string
  ): Promise<IGitOperationResult> {
    if (!isElectron()) {
      return { success: false, error: 'Not running in Electron' };
    }
    return window.gitAPI.setConfig(name, email, global, path);
  }

  /**
   * Get list of tracked files (files that have been committed)
   */
  async getTrackedFiles(path?: string): Promise<string[]> {
    if (!isElectron()) {
      return [];
    }
    return window.gitAPI.getTrackedFiles(path);
  }
}

// Export singleton getter
export function getGitService(): GitService {
  return GitService.getInstance();
}

// Export the class for type usage
export { GitService };
