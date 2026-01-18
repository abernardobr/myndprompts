/**
 * Git Service (Main Process)
 *
 * Provides Git operations using simple-git library.
 * Runs in the Electron main process.
 */

import simpleGit, { SimpleGit, StatusResult, LogResult } from 'simple-git';
import { exec } from 'child_process';
import { promisify } from 'util';
import pathModule from 'path';
import type {
  IGitFileStatus,
  IGitCommit,
  IGitRemote,
  IGitBranch,
  IGitStatusSummary,
  IGitInitResult,
  IGitCloneResult,
  IGitCommitResult,
  IGitOperationResult,
  IGitLogOptions,
  IGitCheckResult,
  IGitRepoCheckResult,
  IStashEntry,
  IStashResult,
} from '../../../services/git/types';

const execAsync = promisify(exec);

/**
 * Git Service class
 */
export class GitService {
  private static instance: GitService | null = null;
  private git: SimpleGit | null = null;
  private currentPath: string | null = null;

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
   * Set the working directory for Git operations
   */
  setWorkingDirectory(path: string): void {
    this.currentPath = path;
    this.git = simpleGit(path);
  }

  /**
   * Get the current working directory
   */
  getWorkingDirectory(): string | null {
    return this.currentPath;
  }

  /**
   * Check if Git is installed on the system
   */
  async isGitInstalled(): Promise<IGitCheckResult> {
    try {
      const { stdout } = await execAsync('git --version');
      const versionMatch = stdout.match(/git version (\d+\.\d+\.\d+)/);
      return {
        isInstalled: true,
        version: versionMatch ? versionMatch[1] : stdout.trim(),
      };
    } catch {
      return {
        isInstalled: false,
        error: 'Git is not installed or not in PATH',
      };
    }
  }

  /**
   * Check if a path is a Git repository
   */
  async isGitRepo(path: string): Promise<IGitRepoCheckResult> {
    try {
      const git = simpleGit(path);
      const isRepo = await git.checkIsRepo();
      const rootPath = isRepo ? await git.revparse(['--show-toplevel']) : undefined;
      return {
        isRepo,
        path: rootPath?.trim(),
      };
    } catch (error) {
      return {
        isRepo: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Initialize a new Git repository
   */
  async init(path: string): Promise<IGitInitResult> {
    try {
      const git = simpleGit(path);
      await git.init();
      this.setWorkingDirectory(path);
      return {
        success: true,
        path,
      };
    } catch (error) {
      return {
        success: false,
        path,
        error: error instanceof Error ? error.message : 'Failed to initialize repository',
      };
    }
  }

  /**
   * Clone a repository
   */
  async clone(repoUrl: string, targetPath: string): Promise<IGitCloneResult> {
    try {
      const git = simpleGit();
      await git.clone(repoUrl, targetPath);
      this.setWorkingDirectory(targetPath);
      return {
        success: true,
        path: targetPath,
      };
    } catch (error) {
      return {
        success: false,
        path: targetPath,
        error: error instanceof Error ? error.message : 'Failed to clone repository',
      };
    }
  }

  /**
   * Get the current Git status
   */
  async status(path?: string): Promise<IGitStatusSummary> {
    const workingPath = path ?? this.currentPath;
    if (!workingPath) {
      throw new Error('No working directory set');
    }

    const git = simpleGit(workingPath);
    const isRepo = await git.checkIsRepo();

    if (!isRepo) {
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

    const statusResult: StatusResult = await git.status();

    const _mapStatus = (files: string[], status: string, staged: boolean): IGitFileStatus[] =>
      files.map((filePath) => ({
        filePath,
        status: status as IGitFileStatus['status'],
        staged,
        index: staged ? status : '',
        working_dir: staged ? '' : status,
      }));

    // Parse the detailed file status
    const staged: IGitFileStatus[] = [];
    const modified: IGitFileStatus[] = [];
    const deleted: IGitFileStatus[] = [];
    const untracked: IGitFileStatus[] = [];
    const conflicted: IGitFileStatus[] = [];

    // Files staged for commit
    for (const file of statusResult.staged) {
      staged.push({
        filePath: file,
        status: 'added',
        staged: true,
        index: 'A',
        working_dir: '',
      });
    }

    // Modified files (not staged)
    for (const file of statusResult.modified) {
      if (!statusResult.staged.includes(file)) {
        modified.push({
          filePath: file,
          status: 'modified',
          staged: false,
          index: '',
          working_dir: 'M',
        });
      }
    }

    // Deleted files
    for (const file of statusResult.deleted) {
      deleted.push({
        filePath: file,
        status: 'deleted',
        staged: statusResult.staged.includes(file),
        index: statusResult.staged.includes(file) ? 'D' : '',
        working_dir: statusResult.staged.includes(file) ? '' : 'D',
      });
    }

    // Untracked files
    for (const file of statusResult.not_added) {
      untracked.push({
        filePath: file,
        status: 'untracked',
        staged: false,
        index: '',
        working_dir: '?',
      });
    }

    // Conflicted files
    for (const file of statusResult.conflicted) {
      conflicted.push({
        filePath: file,
        status: 'unmerged',
        staged: false,
        index: 'U',
        working_dir: 'U',
      });
    }

    return {
      isRepo: true,
      branch: statusResult.current ?? 'HEAD',
      tracking: statusResult.tracking ?? undefined,
      ahead: statusResult.ahead,
      behind: statusResult.behind,
      staged,
      modified,
      deleted,
      untracked,
      conflicted,
      isClean: statusResult.isClean(),
    };
  }

  /**
   * Stage files for commit
   */
  async add(files: string[] | 'all', path?: string): Promise<IGitOperationResult> {
    const workingPath = path ?? this.currentPath;
    if (!workingPath) {
      return { success: false, error: 'No working directory set' };
    }

    try {
      const git = simpleGit(workingPath);
      if (files === 'all') {
        await git.add('.');
      } else {
        await git.add(files);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stage files',
      };
    }
  }

  /**
   * Unstage files
   */
  async unstage(files: string[], path?: string): Promise<IGitOperationResult> {
    const workingPath = path ?? this.currentPath;
    if (!workingPath) {
      return { success: false, error: 'No working directory set' };
    }

    try {
      const git = simpleGit(workingPath);
      await git.reset(['HEAD', '--', ...files]);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unstage files',
      };
    }
  }

  /**
   * Commit staged changes
   */
  async commit(message: string, path?: string): Promise<IGitCommitResult> {
    const workingPath = path ?? this.currentPath;
    if (!workingPath) {
      return { success: false, error: 'No working directory set' };
    }

    try {
      const git = simpleGit(workingPath);
      const result = await git.commit(message);
      return {
        success: true,
        hash: result.commit,
        message: message,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to commit',
      };
    }
  }

  /**
   * Push to remote
   * Uses --set-upstream to ensure tracking is configured
   */
  async push(
    remote: string = 'origin',
    branch?: string,
    path?: string
  ): Promise<IGitOperationResult> {
    const workingPath = path ?? this.currentPath;
    if (!workingPath) {
      return { success: false, error: 'No working directory set' };
    }

    try {
      const git = simpleGit(workingPath);

      // Get current branch if not specified
      let targetBranch = branch;
      if (!targetBranch) {
        const branchSummary = await git.branch();
        targetBranch = branchSummary.current;
      }

      // Use -u flag to set upstream tracking (safe for both first push and subsequent pushes)
      await git.push(['-u', remote, targetBranch]);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to push',
      };
    }
  }

  /**
   * Pull from remote
   * Automatically determines current branch if not specified
   */
  async pull(
    remote: string = 'origin',
    branch?: string,
    path?: string
  ): Promise<IGitOperationResult> {
    const workingPath = path ?? this.currentPath;
    if (!workingPath) {
      return { success: false, error: 'No working directory set' };
    }

    try {
      const git = simpleGit(workingPath);

      // Get current branch if not specified
      let targetBranch = branch;
      if (!targetBranch) {
        const branchSummary = await git.branch();
        targetBranch = branchSummary.current;
      }

      await git.pull(remote, targetBranch);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pull',
      };
    }
  }

  /**
   * Fetch from remote
   */
  async fetch(remote: string = 'origin', path?: string): Promise<IGitOperationResult> {
    const workingPath = path ?? this.currentPath;
    if (!workingPath) {
      return { success: false, error: 'No working directory set' };
    }

    try {
      const git = simpleGit(workingPath);
      await git.fetch(remote);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch',
      };
    }
  }

  /**
   * Get commit history
   */
  async log(options: IGitLogOptions = {}, path?: string): Promise<IGitCommit[]> {
    const workingPath = path ?? this.currentPath;
    if (!workingPath) {
      throw new Error('No working directory set');
    }

    try {
      const git = simpleGit(workingPath);
      const logOptions: string[] = [];

      if (options.maxCount) {
        logOptions.push(`-n${options.maxCount}`);
      }
      if (options.from && options.to) {
        logOptions.push(`${options.from}..${options.to}`);
      }
      if (options.filePath) {
        logOptions.push('--', options.filePath);
      }

      const result: LogResult = await git.log(logOptions);

      return result.all.map((commit) => ({
        hash: commit.hash,
        shortHash: commit.hash.substring(0, 7),
        message: commit.message,
        author: commit.author_name,
        authorEmail: commit.author_email,
        date: new Date(commit.date),
        body: commit.body,
      }));
    } catch (error) {
      console.error('Git log error:', error);
      return [];
    }
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
    const workingPath = path ?? this.currentPath;
    if (!workingPath) {
      throw new Error('No working directory set');
    }

    try {
      const git = simpleGit(workingPath);
      const args: string[] = [];

      if (cached) {
        args.push('--cached');
      }
      if (commitHash) {
        args.push(commitHash);
      }
      if (filePath) {
        args.push('--', filePath);
      }

      const result = await git.diff(args);
      return result;
    } catch (error) {
      console.error('Git diff error:', error);
      return '';
    }
  }

  /**
   * Discard changes in a file
   */
  async discardChanges(filePath: string, path?: string): Promise<IGitOperationResult> {
    const workingPath = path ?? this.currentPath;
    if (!workingPath) {
      return { success: false, error: 'No working directory set' };
    }

    try {
      const git = simpleGit(workingPath);
      await git.checkout(['--', filePath]);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to discard changes',
      };
    }
  }

  /**
   * Get list of branches
   */
  async branches(path?: string): Promise<IGitBranch[]> {
    const workingPath = path ?? this.currentPath;
    if (!workingPath) {
      throw new Error('No working directory set');
    }

    try {
      const git = simpleGit(workingPath);
      const result = await git.branchLocal();

      return Object.entries(result.branches).map(([name, branch]) => ({
        name,
        current: branch.current,
        commit: branch.commit,
      }));
    } catch (error) {
      console.error('Git branches error:', error);
      return [];
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(name: string, path?: string): Promise<IGitOperationResult> {
    const workingPath = path ?? this.currentPath;
    if (!workingPath) {
      return { success: false, error: 'No working directory set' };
    }

    try {
      const git = simpleGit(workingPath);
      await git.checkoutLocalBranch(name);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create branch',
      };
    }
  }

  /**
   * Switch to a branch
   */
  async switchBranch(name: string, path?: string): Promise<IGitOperationResult> {
    const workingPath = path ?? this.currentPath;
    if (!workingPath) {
      return { success: false, error: 'No working directory set' };
    }

    try {
      const git = simpleGit(workingPath);
      await git.checkout(name);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to switch branch',
      };
    }
  }

  /**
   * Delete a branch
   */
  async deleteBranch(
    name: string,
    force: boolean = false,
    path?: string
  ): Promise<IGitOperationResult> {
    const workingPath = path ?? this.currentPath;
    if (!workingPath) {
      return { success: false, error: 'No working directory set' };
    }

    try {
      const git = simpleGit(workingPath);
      await git.deleteLocalBranch(name, force);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete branch',
      };
    }
  }

  /**
   * Get list of remotes
   */
  async remotes(path?: string): Promise<IGitRemote[]> {
    const workingPath = path ?? this.currentPath;
    if (!workingPath) {
      throw new Error('No working directory set');
    }

    try {
      const git = simpleGit(workingPath);
      const result = await git.getRemotes(true);

      return result.map((remote) => ({
        name: remote.name,
        fetchUrl: remote.refs.fetch ?? '',
        pushUrl: remote.refs.push ?? '',
      }));
    } catch (error) {
      console.error('Git remotes error:', error);
      return [];
    }
  }

  /**
   * Add a remote
   */
  async addRemote(name: string, url: string, path?: string): Promise<IGitOperationResult> {
    const workingPath = path ?? this.currentPath;
    if (!workingPath) {
      return { success: false, error: 'No working directory set' };
    }

    try {
      const git = simpleGit(workingPath);
      await git.addRemote(name, url);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add remote',
      };
    }
  }

  /**
   * Remove a remote
   */
  async removeRemote(name: string, path?: string): Promise<IGitOperationResult> {
    const workingPath = path ?? this.currentPath;
    if (!workingPath) {
      return { success: false, error: 'No working directory set' };
    }

    try {
      const git = simpleGit(workingPath);
      await git.removeRemote(name);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove remote',
      };
    }
  }

  /**
   * Stash changes
   */
  async stash(message?: string, path?: string): Promise<IGitOperationResult> {
    const workingPath = path ?? this.currentPath;
    if (!workingPath) {
      return { success: false, error: 'No working directory set' };
    }

    try {
      const git = simpleGit(workingPath);
      if (message) {
        await git.stash(['push', '-m', message]);
      } else {
        await git.stash(['push']);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stash',
      };
    }
  }

  /**
   * Pop stash
   */
  async stashPop(path?: string): Promise<IStashResult> {
    const workingPath = path ?? this.currentPath;
    if (!workingPath) {
      return { success: false };
    }

    try {
      const git = simpleGit(workingPath);
      await git.stash(['pop']);
      return { success: true };
    } catch (error) {
      // Check for conflicts
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('conflict')) {
        const status = await this.status(workingPath);
        return {
          success: false,
          conflicts: status.conflicted.map((f) => f.filePath),
        };
      }
      return { success: false };
    }
  }

  /**
   * List stash entries
   */
  async stashList(path?: string): Promise<IStashEntry[]> {
    const workingPath = path ?? this.currentPath;
    if (!workingPath) {
      return [];
    }

    try {
      const git = simpleGit(workingPath);
      const result = await git.stashList();

      return result.all.map((entry, index) => ({
        index,
        message: entry.message,
        date: new Date(entry.date),
      }));
    } catch (error) {
      console.error('Git stash list error:', error);
      return [];
    }
  }

  /**
   * Get current user configuration
   */
  async getConfig(path?: string): Promise<{ name?: string; email?: string }> {
    const workingPath = path ?? this.currentPath;
    if (!workingPath) {
      return {};
    }

    try {
      const git = simpleGit(workingPath);
      const name = await git.getConfig('user.name');
      const email = await git.getConfig('user.email');
      return {
        name: name.value ?? undefined,
        email: email.value ?? undefined,
      };
    } catch {
      return {};
    }
  }

  /**
   * Set user configuration
   */
  async setConfig(
    name: string,
    email: string,
    global: boolean = false,
    path?: string
  ): Promise<IGitOperationResult> {
    const workingPath = path ?? this.currentPath;
    if (!workingPath && !global) {
      return { success: false, error: 'No working directory set' };
    }

    try {
      const git = workingPath ? simpleGit(workingPath) : simpleGit();
      const scope = global ? '--global' : '--local';
      await git.addConfig('user.name', name, false, scope);
      await git.addConfig('user.email', email, false, scope);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set config',
      };
    }
  }

  /**
   * Get list of tracked files in the repository
   * Returns all files that are tracked by git (have been committed at least once)
   */
  async getTrackedFiles(path?: string): Promise<string[]> {
    const workingPath = path ?? this.currentPath;
    if (!workingPath) {
      return [];
    }

    try {
      const git = simpleGit(workingPath);
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return [];
      }

      // git ls-files returns all tracked files
      const result = await git.raw(['ls-files']);
      const files = result
        .split('\n')
        .filter((f) => f.trim().length > 0)
        .map((f) => pathModule.join(workingPath, f));

      return files;
    } catch (error) {
      console.error('Git ls-files error:', error);
      return [];
    }
  }
}

// Export singleton getter
export function getGitService(): GitService {
  return GitService.getInstance();
}
