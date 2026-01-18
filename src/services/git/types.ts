/**
 * Git Service Types
 *
 * Types and interfaces for Git integration.
 * Based on simple-git library.
 */

/**
 * Git file status
 */
export interface IGitFileStatus {
  filePath: string;
  status: GitFileStatusType;
  staged: boolean;
  index: string; // Status in index (staging area)
  working_dir: string; // Status in working directory
}

export type GitFileStatusType =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked'
  | 'ignored'
  | 'unmerged';

/**
 * Git commit information
 */
export interface IGitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  authorEmail: string;
  date: Date;
  body?: string;
}

/**
 * Git remote information
 */
export interface IGitRemote {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}

/**
 * Git branch information
 */
export interface IGitBranch {
  name: string;
  current: boolean;
  commit?: string;
  tracking?: string;
}

/**
 * Git stash entry
 */
export interface IStashEntry {
  index: number;
  message: string;
  date: Date;
}

/**
 * Git stash result
 */
export interface IStashResult {
  success: boolean;
  conflicts?: string[];
}

/**
 * Git status summary
 */
export interface IGitStatusSummary {
  isRepo: boolean;
  branch: string;
  tracking?: string;
  ahead: number;
  behind: number;
  staged: IGitFileStatus[];
  modified: IGitFileStatus[];
  deleted: IGitFileStatus[];
  untracked: IGitFileStatus[];
  conflicted: IGitFileStatus[];
  isClean: boolean;
}

/**
 * Git initialization result
 */
export interface IGitInitResult {
  success: boolean;
  path: string;
  error?: string;
}

/**
 * Git clone result
 */
export interface IGitCloneResult {
  success: boolean;
  path: string;
  error?: string;
}

/**
 * Git commit result
 */
export interface IGitCommitResult {
  success: boolean;
  hash?: string;
  message?: string;
  error?: string;
}

/**
 * Git operation result
 */
export interface IGitOperationResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Git log options
 */
export interface IGitLogOptions {
  filePath?: string;
  maxCount?: number;
  from?: string;
  to?: string;
}

/**
 * Git diff options
 */
export interface IGitDiffOptions {
  filePath?: string;
  commitHash?: string;
  cached?: boolean;
}

/**
 * Git service check result
 */
export interface IGitCheckResult {
  isInstalled: boolean;
  version?: string;
  error?: string;
}

/**
 * Git repo check result
 */
export interface IGitRepoCheckResult {
  isRepo: boolean;
  path?: string;
  error?: string;
}
