/**
 * IndexedDB Entity Interfaces
 *
 * IndexedDB is used ONLY for:
 * 1. User authentication state
 * 2. Application configuration
 * 3. UI state (opened tabs, sidebar state, etc.)
 * 4. Project index cache (for fast search)
 * 5. Recently opened files
 * 6. Sync status tracking
 * 7. Git status tracking
 * 8. AI provider configuration
 * 9. Chat sessions, messages, and memory snapshots
 *
 * NOTE: Prompts and snippets are stored as files, not in IndexedDB
 */

import type {
  MemoryStrategy,
  IMemoryConfig,
  ITokenUsage,
  IChatMessageMetadata,
} from '../chat/types';

/**
 * User authentication state
 */
export interface IUserAuth {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  googleAccessToken?: string;
  googleRefreshToken?: string;
  tokenExpiresAt?: Date;
  lastLoginAt: Date;
}

/**
 * Application configuration key-value pairs
 */
export interface IAppConfig {
  key: string;
  value: unknown;
  updatedAt: Date;
}

/**
 * Editor pane configuration for split view support
 */
export interface IEditorPaneConfig {
  id: string;
  tabs: string[]; // File paths of open tabs in this pane
  activeTab?: string;
  size?: number; // Percentage size (0-100)
}

/**
 * Editor split configuration
 */
export interface IEditorSplitConfig {
  panes: IEditorPaneConfig[];
  direction: 'horizontal' | 'vertical';
  activePaneId: string;
}

/**
 * UI state for persisting layout preferences
 */
export interface IUIState {
  id: string;
  openTabs: string[];
  activeTab?: string;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  panelHeight: number;
  panelCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';
  locale: string;
  // Split pane configuration
  editorSplit?: IEditorSplitConfig;
}

/**
 * Recently opened file record
 */
export interface IRecentFile {
  id: string;
  filePath: string;
  fileName: string;
  fileType: 'prompt' | 'snippet' | 'persona';
  lastOpenedAt: Date;
  isPinned: boolean;
}

/**
 * Cached file information for project indexing
 */
export interface ICachedFileInfo {
  path: string;
  relativePath: string;
  name: string;
  extension: string;
  size: number;
  meaning?: string;
  tags: string[];
  contentHash: string;
  lastModified: Date;
}

/**
 * Project index cache for fast search
 */
export interface IProjectIndexCache {
  id: string;
  projectPath: string;
  files: ICachedFileInfo[];
  lastIndexed: Date;
}

/**
 * Sync status for Google Drive synchronization
 */
export interface ISyncStatus {
  id: string;
  filePath: string;
  localHash: string;
  remoteHash?: string;
  lastSyncedHash?: string;
  localModifiedAt: Date;
  remoteModifiedAt?: Date;
  status: SyncStatusType;
  lastSyncedAt?: Date;
}

export type SyncStatusType = 'synced' | 'local-only' | 'remote-only' | 'conflict' | 'pending';

/**
 * Git status for version control tracking
 */
export interface IGitStatus {
  id: string;
  filePath: string;
  status: GitStatusType;
  lastCommitHash?: string;
  lastCommitMessage?: string;
}

export type GitStatusType = 'clean' | 'modified' | 'staged' | 'untracked' | 'deleted';

/**
 * AI provider configuration
 * NOTE: API keys are NEVER stored here - use system keychain
 */
export interface IAIProviderConfig {
  id: string;
  provider: AIProviderType;
  hasApiKey: boolean;
  baseUrl?: string;
  // Legacy fields kept for migration compatibility
  defaultModel?: string;
  isEnabled?: boolean;
  lastUsedAt?: Date;
}

export type AIProviderType = 'anthropic' | 'openai' | 'google' | 'groq' | 'ollama';

/**
 * A model that the user has added to their configured list
 */
export interface IConfiguredModel {
  id: string;
  provider: AIProviderType;
  modelId: string;
  modelName: string;
  isDefault: boolean;
  addedAt: Date;
}

// ================================
// Chat Entities
// ================================

/**
 * Chat session record
 */
export interface IChatSession {
  id: string;
  title: string;
  provider: AIProviderType;
  modelId: string;
  memoryStrategy: MemoryStrategy;
  memoryConfig: IMemoryConfig;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
  messageCount: number;
  tokenUsage: ITokenUsage;
  isArchived: boolean;
}

/**
 * Chat message record
 */
export interface IChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinkingContent?: string;
  parentMessageId?: string;
  branchIndex: number;
  tokenUsage?: ITokenUsage;
  metadata?: IChatMessageMetadata;
  createdAt: Date;
}

/**
 * Serialized memory state snapshot for a session
 */
export interface IMemorySnapshot {
  id: string;
  sessionId: string;
  strategy: MemoryStrategy;
  serializedState: string;
  createdAt: Date;
}

/**
 * PDF document reference attached to a chat session
 */
export interface IPDFDocument {
  id: string;
  sessionId: string;
  filePath: string;
  fileName: string;
  pageCount: number;
  addedAt: Date;
}

/**
 * PDF annotation within a document
 */
export interface IPDFAnnotation {
  id: string;
  documentId: string;
  sessionId: string;
  pageNumber: number;
  type: 'highlight' | 'note' | 'bookmark';
  content?: string;
  position: { x: number; y: number; width: number; height: number };
  color?: string;
  createdAt: Date;
}

/**
 * Plugin types
 */
export type PluginType = 'persona' | 'text_snippets' | 'code_snippets' | 'templates';

/**
 * Plugin item content
 */
export interface IPluginItem {
  title: string;
  description?: string;
  content: string;
  language?: string;
  tags?: string[];
  type?: PluginType;
}

/**
 * Installed plugin stored in IndexedDB
 */
export interface IPlugin {
  id: string;
  name: string;
  description?: string;
  version: string;
  type?: PluginType;
  language?: string;
  tags: string[];
  items: IPluginItem[];
  installedAt: Date;
  updatedAt: Date;
}

/**
 * File Sync - Project folder status
 */
export type ProjectFolderStatus = 'pending' | 'indexing' | 'indexed' | 'error';

/**
 * File Sync - Project folder configuration
 * Stores the relationship between MyndPrompts projects and external folders
 */
export interface IProjectFolder {
  id: string;
  projectPath: string; // MyndPrompts project path (e.g., ~/.myndprompt/prompts/my-project)
  folderPath: string; // External folder path (e.g., ~/Projects/my-app)
  addedAt: Date;
  lastIndexedAt: Date | null;
  fileCount: number;
  status: ProjectFolderStatus;
  errorMessage?: string;
}

/**
 * File Sync - Indexed file entry
 * Stores metadata for indexed files for fast autocomplete search
 */
export interface IFileIndexEntry {
  id: string;
  projectFolderId: string; // FK to IProjectFolder.id
  fileName: string; // Original name: "Café.tsx"
  normalizedName: string; // Searchable: "cafe.tsx" (NFD normalized, diacritics removed)
  fullPath: string; // Absolute path: "/Users/me/projects/app/src/Café.tsx"
  relativePath: string; // Relative to folder: "src/Café.tsx"
  extension: string; // File extension: ".tsx"
  size: number; // File size in bytes
  modifiedAt: Date; // File modification date
  indexedAt: Date; // When the file was indexed
}

/**
 * Project metadata stored in IndexedDB
 * Projects are directories on the file system, but metadata is stored here
 */
export interface IProject {
  id: string;
  folderPath: string; // Primary key - actual path on disk
  name: string; // Display name (can differ from folder name)
  description?: string;
  associatedFolders: string[]; // Paths for future Project Indexer
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Default values for entities
 */
export const DEFAULT_UI_STATE: Omit<IUIState, 'id'> = {
  openTabs: [],
  activeTab: undefined,
  sidebarWidth: 280,
  sidebarCollapsed: false,
  panelHeight: 200,
  panelCollapsed: true,
  theme: 'system',
  locale: 'en-US',
};

export const DEFAULT_AI_PROVIDERS: Omit<IAIProviderConfig, 'id'>[] = [
  {
    provider: 'anthropic',
    hasApiKey: false,
  },
  {
    provider: 'openai',
    hasApiKey: false,
  },
  {
    provider: 'google',
    hasApiKey: false,
  },
  {
    provider: 'groq',
    hasApiKey: false,
  },
  {
    provider: 'ollama',
    hasApiKey: false,
    baseUrl: 'http://localhost:11434',
  },
];
