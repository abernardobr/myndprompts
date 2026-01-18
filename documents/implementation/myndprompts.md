# MyndPrompt - AI Prompt Manager

## Project Overview

An open-source (MIT License) desktop application for managing, organizing, and optimizing prompts for AI coding tools. Built as an Electron app with Vue.js/Quasar, featuring a VSCode-inspired interface. **File-based storage** with Google Drive sync and GitHub version control.

---

## Personas

### 🏗️ Architect Persona

You are a **Senior Software Architect** with 20+ years of experience in enterprise software design. When working on this project:

- Design for **scalability**, **maintainability**, and **extensibility**
- Apply **SOLID principles** and **clean architecture** patterns
- Implement **file-based architecture** with metadata caching
- Consider **offline-first** with Google Drive sync
- Document architectural decisions (ADRs) in `/documentation/architecture/decisions/`
- Think about **plugin architecture** for future AI provider additions
- Design **clear separation of concerns**: UI → Services → File System → Sync Layer

### 🎨 UI Designer Persona

When working on UI components:

- Follow **Material Design 3** principles via Quasar
- Ensure **accessibility** (WCAG 2.1 AA compliance)
- Design for **keyboard-first** workflows (power users)
- Maintain **visual consistency** with VSCode aesthetics
- Support **dark/light themes** with system preference detection

### 💻 Developer Persona

When implementing features:

- Write **TypeScript** with strict mode enabled
- Follow **Vue 3 Composition API** patterns
- Create **reusable composables** for shared logic
- Write **unit tests** for business logic
- Document complex functions with JSDoc

---

## Code Style & Standards

### TypeScript Configuration

```typescript
// tsconfig.json essentials
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### Vue Component Structure

```vue
<script setup lang="ts">
// 1. Imports (external, internal, types)
// 2. Props & Emits definitions
// 3. Composables & Stores
// 4. Reactive state
// 5. Computed properties
// 6. Watchers
// 7. Lifecycle hooks
// 8. Methods
</script>

<template>
  <!-- Single root element, semantic HTML -->
</template>

<style lang="scss" scoped>
// BEM naming convention
// Component-specific styles only
</style>
```

### Naming Conventions

| Type                   | Convention                                | Example                 |
| ---------------------- | ----------------------------------------- | ----------------------- |
| Components             | PascalCase                                | `PromptEditor.vue`      |
| Composables            | camelCase with `use` prefix               | `usePromptStorage.ts`   |
| Stores                 | camelCase with `Store` suffix             | `promptStore.ts`        |
| Services               | PascalCase with `Service` suffix          | `AIProviderService.ts`  |
| Types/Interfaces       | PascalCase with `I` prefix for interfaces | `IPrompt`, `PromptType` |
| Constants              | SCREAMING_SNAKE_CASE                      | `MAX_PROMPT_LENGTH`     |
| Files (non-components) | kebab-case                                | `prompt-utils.ts`       |

### Directory Structure

```
src/
├── assets/                 # Static assets
├── boot/                   # Quasar boot files
├── components/             # Reusable Vue components
│   ├── common/            # Generic UI components
│   ├── editor/            # Code editor components
│   ├── prompt/            # Prompt-specific components
│   └── sidebar/           # Sidebar components
├── composables/           # Vue composables
├── layouts/               # Page layouts
├── pages/                 # Route pages
├── router/                # Vue Router config
├── services/              # Business logic services
│   ├── ai/               # AI provider integrations
│   ├── auth/             # Google OAuth service
│   ├── file-system/      # File operations (prompts, snippets)
│   ├── git/              # GitHub integration
│   ├── sync/             # Google Drive sync
│   └── indexer/          # Project file indexer
├── stores/                # Pinia stores
├── types/                 # TypeScript type definitions
├── utils/                 # Utility functions
├── i18n/                  # Localization files
│   ├── en-GB/
│   ├── en-IE/
│   ├── en-US/
│   ├── fr-FR/
│   ├── es-ES/
│   ├── pt-PT/
│   ├── pt-BR/
│   ├── it-IT/
│   ├── de-DE/
│   └── ar-SA/
└── electron/              # Electron-specific code
    ├── main/
    └── preload/
```

---

## Storage Architecture

### File-Based Storage (Primary - Prompts & Snippets)

```typescript
// Prompts and snippets are stored as files on disk
// This enables Git version control and easy portability

interface IFileStorageConfig {
  baseDir: string; // ~/.myndprompt/
  promptsDir: string; // ~/.myndprompt/prompts/
  snippetsDir: string; // ~/.myndprompt/snippets/
  personasDir: string; // ~/.myndprompt/personas/
  templatesDir: string; // ~/.myndprompt/templates/
  projectsDir: string; // ~/.myndprompt/projects/
  backupsDir: string; // ~/.myndprompt/backups/
}

// Prompt File Structure (.md with YAML frontmatter)
// File: ~/.myndprompt/prompts/my-prompt.md
/*
---
id: "uuid-v4"
title: "My Prompt"
description: "Description here"
category: "development"
tags: ["typescript", "vue", "architecture"]
aiProvider: "anthropic"
isFavorite: false
isPinned: false
createdAt: "2025-01-18T10:00:00Z"
updatedAt: "2025-01-18T12:00:00Z"
version: 3
---

# Prompt Content Here

Your actual prompt markdown content...
*/

// Snippet File Structure (.snippet.md)
// File: ~/.myndprompt/snippets/architect.snippet.md
/*
---
id: "uuid-v4"
name: "Architect Persona"
type: "persona"
shortcut: "@architect"
description: "Senior architect persona"
tags: ["persona", "architecture"]
---

You are a Senior Software Architect with 20+ years...
*/
```

### IndexedDB Storage (Metadata & Configuration)

```typescript
import Dexie, { Table } from 'dexie';

// IndexedDB is used ONLY for:
// 1. User authentication state
// 2. Application configuration
// 3. UI state (opened tabs, sidebar state, etc.)
// 4. Project index cache (for fast search)
// 5. Recently opened files
// 6. Sync status tracking

interface IUserAuth {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  googleAccessToken?: string;
  googleRefreshToken?: string;
  tokenExpiresAt?: Date;
  lastLoginAt: Date;
}

interface IAppConfig {
  key: string;
  value: any;
}

interface IUIState {
  id: string;
  openTabs: string[]; // File paths
  activeTab?: string;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  panelHeight: number;
  panelCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';
  locale: string;
}

interface IRecentFile {
  id: string;
  filePath: string;
  fileName: string;
  fileType: 'prompt' | 'snippet' | 'persona';
  lastOpenedAt: Date;
  isPinned: boolean;
}

interface IProjectIndexCache {
  id: string;
  projectPath: string;
  files: ICachedFileInfo[];
  lastIndexed: Date;
}

interface ICachedFileInfo {
  path: string;
  relativePath: string;
  name: string;
  extension: string;
  size: number;
  meaning?: string; // AI-generated description
  tags: string[];
  contentHash: string;
  lastModified: Date;
}

interface ISyncStatus {
  id: string;
  filePath: string;
  localHash: string;
  remoteHash?: string;
  lastSyncedHash?: string; // Hash at last successful sync (for conflict detection)
  localModifiedAt: Date; // Local file modification time
  remoteModifiedAt?: Date; // Remote file modification time (from Google Drive)
  status: 'synced' | 'local-only' | 'remote-only' | 'conflict' | 'pending';
  lastSyncedAt?: Date;
}

interface IGitStatus {
  id: string;
  filePath: string;
  status: 'clean' | 'modified' | 'staged' | 'untracked' | 'deleted';
  lastCommitHash?: string;
  lastCommitMessage?: string;
}

interface IAIProviderConfig {
  id: string;
  provider: 'anthropic' | 'openai' | 'google' | 'xai' | 'ollama';
  // NOTE: API keys are NEVER stored here - use keytar (see ADR-012)
  hasApiKey: boolean; // Flag indicating if key exists in system keychain
  baseUrl?: string; // For Ollama
  defaultModel?: string;
  isEnabled: boolean;
  lastUsedAt?: Date;
}

class MyndPromptDB extends Dexie {
  userAuth!: Table<IUserAuth>;
  appConfig!: Table<IAppConfig>;
  uiState!: Table<IUIState>;
  recentFiles!: Table<IRecentFile>;
  projectIndexCache!: Table<IProjectIndexCache>;
  syncStatus!: Table<ISyncStatus>;
  gitStatus!: Table<IGitStatus>;
  aiProviders!: Table<IAIProviderConfig>;

  constructor() {
    super('MyndPromptDB');
    this.version(1).stores({
      userAuth: 'id, email',
      appConfig: 'key',
      uiState: 'id',
      recentFiles: 'id, filePath, fileType, lastOpenedAt, isPinned',
      projectIndexCache: 'id, projectPath, lastIndexed',
      syncStatus: 'id, filePath, status',
      gitStatus: 'id, filePath, status',
      aiProviders: 'id, provider, isEnabled',
    });
  }
}

export const db = new MyndPromptDB();
```

### Source of Truth Policy

**CRITICAL ARCHITECTURE RULE: The File System is the ABSOLUTE source of truth.**

IndexedDB is strictly a **reactive cache** that must rebuild/update based on file system events.

```typescript
// Source of Truth Hierarchy (in order of authority)
// 1. File System (prompts/*.md files) - AUTHORITATIVE
// 2. Google Drive (remote copy) - SYNC TARGET
// 3. IndexedDB (local cache) - EPHEMERAL, REBUILDABLE

interface ISourceOfTruthPolicy {
  // File system ALWAYS wins over IndexedDB
  readonly fileSystemIsAuthoritative: true;

  // IndexedDB can be rebuilt from file system at any time
  readonly indexedDbIsRebuildable: true;

  // UI must debounce writes to avoid race conditions
  readonly uiWriteDebounceMs: 300;
}
```

#### Conflict Scenario Resolution

**Scenario:** User changes "Category" in UI (updates IndexedDB instantly). Before file writes to disk, user edits file externally in VSCode.

**Resolution Strategy:**

```typescript
// File Watcher takes precedence over pending UI writes

interface IFileWatcherPolicy {
  // When external file change detected:
  // 1. Cancel any pending write operations for that file
  // 2. Reload file from disk
  // 3. Update IndexedDB cache
  // 4. Notify UI to refresh (may discard unsaved UI changes)

  onExternalChange(filePath: string): void;
}

class FileWriteCoordinator {
  private pendingWrites: Map<string, NodeJS.Timeout> = new Map();
  private fileLocks: Set<string> = new Set();

  // Debounced write from UI
  async scheduleWrite(filePath: string, content: string): Promise<void> {
    // Cancel any existing pending write
    const existing = this.pendingWrites.get(filePath);
    if (existing) clearTimeout(existing);

    // Check if file is locked (external edit in progress)
    if (this.fileLocks.has(filePath)) {
      throw new FileLockedError(filePath, 'External edit detected');
    }

    // Schedule debounced write
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(async () => {
        try {
          this.fileLocks.add(filePath);
          await this.atomicWrite(filePath, content);
          resolve();
        } catch (error) {
          reject(error);
        } finally {
          this.fileLocks.delete(filePath);
          this.pendingWrites.delete(filePath);
        }
      }, 300); // 300ms debounce

      this.pendingWrites.set(filePath, timeout);
    });
  }

  // Called by file watcher when external change detected
  onExternalChange(filePath: string): void {
    // Cancel pending write - external change takes precedence
    const pending = this.pendingWrites.get(filePath);
    if (pending) {
      clearTimeout(pending);
      this.pendingWrites.delete(filePath);
    }

    // Lock file briefly to prevent race conditions
    this.fileLocks.add(filePath);

    // Emit event for cache rebuild
    this.emit('external-change', filePath);

    // Unlock after cache is updated
    setTimeout(() => this.fileLocks.delete(filePath), 100);
  }
}
```

#### Cache Rebuild Strategy

```typescript
interface ICacheRebuildService {
  // Full rebuild: Scan all files, rebuild entire IndexedDB cache
  fullRebuild(): Promise<void>;

  // Incremental: Update cache for specific file
  updateCacheForFile(filePath: string): Promise<void>;

  // Verify: Check cache consistency with file system
  verifyCache(): Promise<ICacheVerificationResult>;
}

interface ICacheVerificationResult {
  isConsistent: boolean;
  missingInCache: string[]; // Files on disk but not in cache
  staleInCache: string[]; // Cache entries with wrong hash
  orphanedInCache: string[]; // Cache entries for deleted files
}

// Cache rebuild triggers:
// 1. App startup (verify cache, rebuild if inconsistent)
// 2. File watcher events (incremental update)
// 3. User action: "Rebuild Index" command
// 4. After sync completes (verify downloaded files)

class CacheRebuildService implements ICacheRebuildService {
  async fullRebuild(): Promise<void> {
    // 1. Clear existing cache
    await db.syncStatus.clear();
    await db.recentFiles.clear();

    // 2. Scan file system
    const files = await this.scanPromptDirectory();

    // 3. Parse each file and update cache
    for (const filePath of files) {
      await this.updateCacheForFile(filePath);
    }

    // 4. Rebuild search index
    await searchIndex.rebuild();
  }

  async updateCacheForFile(filePath: string): Promise<void> {
    const content = await fs.readFile(filePath, 'utf8');
    const { frontmatter, body } = parseFrontmatter(content);
    const hash = computeHash(content);

    await db.syncStatus.put({
      id: frontmatter.id,
      filePath,
      localHash: hash,
      localModifiedAt: (await fs.stat(filePath)).mtime,
      status: 'local-only',
    });

    // Update search index
    searchIndex.update(frontmatter.id, { ...frontmatter, body });
  }
}
```

#### UI Optimistic Updates with Rollback

```typescript
// UI can show optimistic updates, but must handle rollback

interface IOptimisticUpdate<T> {
  id: string;
  previousValue: T;
  newValue: T;
  timestamp: Date;
  status: 'pending' | 'committed' | 'rolled_back';
}

class OptimisticUpdateManager {
  private updates: Map<string, IOptimisticUpdate<unknown>> = new Map();

  // Apply optimistic update to UI
  applyOptimistic<T>(id: string, previousValue: T, newValue: T): void {
    this.updates.set(id, {
      id,
      previousValue,
      newValue,
      timestamp: new Date(),
      status: 'pending',
    });
  }

  // Commit when file write succeeds
  commit(id: string): void {
    const update = this.updates.get(id);
    if (update) {
      update.status = 'committed';
      this.updates.delete(id);
    }
  }

  // Rollback when file write fails or external change detected
  rollback(id: string): IOptimisticUpdate<unknown> | null {
    const update = this.updates.get(id);
    if (update) {
      update.status = 'rolled_back';
      this.updates.delete(id);
      // UI should revert to previousValue
      return update;
    }
    return null;
  }
}
```

---

## Frontmatter Schema & Migrations

### Schema Definition (Zod)

```typescript
import { z } from 'zod';

// Current schema version
const FRONTMATTER_VERSION = 2;

// Base prompt frontmatter schema
const PromptFrontmatterV2 = z
  .object({
    // Required fields
    id: z.string().uuid(),
    title: z.string().min(1).max(200),
    version: z.number().int().positive().default(FRONTMATTER_VERSION),

    // Optional fields
    description: z.string().max(500).optional(),
    category: z.string().max(50).optional(),
    tags: z.array(z.string().max(30)).max(20).default([]),
    aiProvider: z.enum(['anthropic', 'openai', 'google', 'xai', 'ollama']).optional(),
    isFavorite: z.boolean().default(false),
    isPinned: z.boolean().default(false),

    // Timestamps
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),

    // Allow unknown keys for plugin extensibility
  })
  .passthrough();

// Snippet frontmatter schema
const SnippetFrontmatterV2 = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    type: z.enum(['file', 'text', 'persona', 'variable']),
    shortcut: z.string().regex(/^[@!$#][a-zA-Z0-9-_]+$/),
    description: z.string().max(500).optional(),
    tags: z.array(z.string()).default([]),
    version: z.number().int().positive().default(FRONTMATTER_VERSION),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .passthrough();

type PromptFrontmatter = z.infer<typeof PromptFrontmatterV2>;
type SnippetFrontmatter = z.infer<typeof SnippetFrontmatterV2>;
```

### Validation Service

```typescript
interface IFrontmatterValidator {
  // Validate frontmatter against schema
  validate(frontmatter: unknown, type: 'prompt' | 'snippet'): ValidationResult;

  // Parse and validate from raw YAML
  parseAndValidate(content: string): ParseResult;

  // Get validation errors in user-friendly format
  formatErrors(errors: z.ZodError): string[];
}

interface ValidationResult {
  valid: boolean;
  data?: PromptFrontmatter | SnippetFrontmatter;
  errors?: string[];
  warnings?: string[]; // For deprecated fields
}

interface ParseResult extends ValidationResult {
  body?: string; // Content after frontmatter
}

// Validation behavior:
// - On file read: Validate, warn on errors but don't block
// - On file save: Validate, block save if invalid with error message
// - On sync: Validate both local and remote, reject invalid files
```

### Migration System

```typescript
interface IFrontmatterMigration {
  fromVersion: number;
  toVersion: number;
  migrate(frontmatter: Record<string, unknown>): Record<string, unknown>;
  description: string;
}

// Migration registry
const MIGRATIONS: IFrontmatterMigration[] = [
  {
    fromVersion: 1,
    toVersion: 2,
    description: 'Add version field, normalize timestamps to ISO 8601',
    migrate(fm) {
      return {
        ...fm,
        version: 2,
        createdAt: new Date(fm.createdAt as string).toISOString(),
        updatedAt: new Date(fm.updatedAt as string).toISOString(),
      };
    },
  },
  // Future migrations added here
];

class FrontmatterMigrator {
  migrate(frontmatter: Record<string, unknown>): Record<string, unknown> {
    let current = { ...frontmatter };
    const fromVersion = (current.version as number) || 1;

    for (const migration of MIGRATIONS) {
      if (migration.fromVersion >= fromVersion) {
        current = migration.migrate(current);
        logger.info(
          `Migrated frontmatter from v${migration.fromVersion} to v${migration.toVersion}`
        );
      }
    }

    return current;
  }
}

// Migration behavior:
// - On file read: Auto-migrate if version < current
// - After migration: Save file with updated frontmatter
// - Show notification: "Upgraded X files to new format"
// - Create backup before migration: {file}.backup-v{oldVersion}
```

### Unknown Keys Policy

```typescript
// Frontmatter allows unknown keys for extensibility
// This enables plugins to store custom metadata

// Example: Plugin adding custom fields
/*
---
id: "uuid"
title: "My Prompt"
version: 2
# ... standard fields ...

# Plugin-added fields (prefixed with plugin name)
myplugin_rating: 5
myplugin_lastUsed: "2025-01-18T10:00:00Z"
---
*/

// Rules for unknown keys:
// 1. MUST be prefixed with plugin/extension name (lowercase + underscore)
// 2. MUST NOT conflict with reserved field names
// 3. Are preserved during save/sync
// 4. Are NOT indexed for search (unless plugin registers them)

const RESERVED_FIELDS = [
  'id',
  'title',
  'description',
  'category',
  'tags',
  'aiProvider',
  'isFavorite',
  'isPinned',
  'createdAt',
  'updatedAt',
  'version',
  'name',
  'type',
  'shortcut', // Snippet fields
];

function validateCustomField(key: string): boolean {
  if (RESERVED_FIELDS.includes(key)) return false;
  if (!/^[a-z][a-z0-9]*_[a-zA-Z0-9_]+$/.test(key)) return false;
  return true;
}
```

---

## Error Handling Strategy

### Error Classification

```typescript
// Error severity levels
enum ErrorSeverity {
  FATAL = 'fatal', // App cannot continue (corrupted DB, critical file missing)
  ERROR = 'error', // Operation failed, user action needed
  WARNING = 'warning', // Operation succeeded with issues
  INFO = 'info', // Informational (e.g., offline mode activated)
}

// Error categories
enum ErrorCategory {
  FILE_SYSTEM = 'file_system',
  NETWORK = 'network',
  AUTH = 'auth',
  SYNC = 'sync',
  GIT = 'git',
  AI_PROVIDER = 'ai_provider',
  VALIDATION = 'validation',
  INTERNAL = 'internal',
}

interface IAppError {
  code: string; // e.g., 'FS_PERMISSION_DENIED'
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string; // User-friendly message
  technicalDetails?: string; // For logging/debugging
  recoveryAction?: RecoveryAction;
  retryable: boolean;
  timestamp: Date;
}

type RecoveryAction =
  | { type: 'RETRY'; maxAttempts: number; backoffMs: number }
  | { type: 'PROMPT_USER'; options: string[] }
  | { type: 'FALLBACK'; fallbackFn: () => Promise<void> }
  | { type: 'IGNORE' }
  | { type: 'RESTART_APP' };
```

### Error Codes & Recovery

| Code                   | Category    | Message                                              | Recovery                       |
| ---------------------- | ----------- | ---------------------------------------------------- | ------------------------------ |
| `FS_PERMISSION_DENIED` | file_system | "Cannot access file. Check permissions."             | Prompt user to grant access    |
| `FS_DISK_FULL`         | file_system | "Disk is full. Free up space to continue."           | Prompt user                    |
| `FS_FILE_LOCKED`       | file_system | "File is locked by another application."             | Retry with backoff             |
| `FS_FILE_NOT_FOUND`    | file_system | "File not found. It may have been moved or deleted." | Remove from cache, refresh     |
| `NET_OFFLINE`          | network     | "You're offline. Changes saved locally."             | Queue for later sync           |
| `NET_TIMEOUT`          | network     | "Request timed out. Check your connection."          | Retry with backoff             |
| `AUTH_TOKEN_EXPIRED`   | auth        | "Session expired. Please sign in again."             | Trigger re-auth flow           |
| `AUTH_REVOKED`         | auth        | "Access was revoked. Please re-authorize."           | Clear tokens, prompt login     |
| `SYNC_CONFLICT`        | sync        | "File was modified elsewhere. Choose version."       | Show conflict resolution UI    |
| `SYNC_QUOTA_EXCEEDED`  | sync        | "Google Drive storage is full."                      | Prompt user                    |
| `GIT_NOT_INSTALLED`    | git         | "Git is not installed on your system."               | Show installation guide        |
| `GIT_NOT_REPO`         | git         | "This folder is not a Git repository."               | Offer to initialize            |
| `GIT_MERGE_CONFLICT`   | git         | "Merge conflict detected."                           | Show diff view                 |
| `AI_RATE_LIMITED`      | ai_provider | "Too many requests. Please wait."                    | Retry with exponential backoff |
| `AI_INVALID_KEY`       | ai_provider | "Invalid API key. Check your settings."              | Open settings                  |
| `AI_SERVICE_DOWN`      | ai_provider | "AI service is temporarily unavailable."             | Retry later                    |

### Global Error Boundary

```typescript
// Vue error boundary component
// src/components/common/ErrorBoundary.vue

interface IErrorBoundaryState {
  hasError: boolean;
  error: IAppError | null;
  errorInfo: string | null;
}

// Usage:
// <ErrorBoundary fallback="Something went wrong">
//   <EditorPanel />
// </ErrorBoundary>
```

### Error Handling Patterns

```typescript
// Service-level error handling
class FileSystemService {
  async readFile(path: string): Promise<Result<string, IAppError>> {
    try {
      const content = await fs.readFile(path, 'utf-8');
      return { ok: true, value: content };
    } catch (error) {
      return {
        ok: false,
        error: this.mapError(error, 'FS_READ_FAILED', path),
      };
    }
  }

  private mapError(error: unknown, code: string, context: string): IAppError {
    // Map native errors to app errors with recovery actions
  }
}

// Result type for explicit error handling
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
```

### Offline Mode Handling

```typescript
interface IOfflineStrategy {
  // Detect network state
  isOnline(): boolean;

  // Queue operations for later
  queueOperation(op: IPendingOperation): void;

  // Process queue when online
  processQueue(): Promise<ISyncResult>;

  // Notify user of offline state
  showOfflineIndicator(): void;
}

interface IPendingOperation {
  id: string;
  type: 'sync' | 'push' | 'ai_request';
  payload: unknown;
  queuedAt: Date;
  retryCount: number;
}
```

---

## Conflict Resolution

### Conflict Detection Algorithm

```typescript
interface IConflictDetector {
  // Compare local and remote versions
  detectConflict(local: IFileVersion, remote: IFileVersion): ConflictType;

  // Get conflict details
  getConflictInfo(filePath: string): Promise<IConflictInfo>;
}

type ConflictType = 'none' | 'content' | 'deleted_locally' | 'deleted_remotely' | 'both_modified';

interface IFileVersion {
  contentHash: string; // SHA-256 of content
  lastModified: Date;
  lastSyncedHash?: string; // Hash at last successful sync (base version)
}

interface IConflictInfo {
  filePath: string;
  promptId: string; // UUID for tracking across renames
  type: ConflictType;
  localVersion: IFileVersion;
  remoteVersion: IFileVersion;
  baseVersion?: IFileVersion; // Common ancestor for three-way merge
  localContent: string;
  remoteContent: string;
  baseContent?: string;
}

// Conflict detection algorithm:
function detectConflict(
  localHash: string,
  remoteHash: string,
  lastSyncedHash: string | null
): ConflictType {
  // Case 1: Hashes match - no conflict
  if (localHash === remoteHash) {
    return 'none';
  }

  // Case 2: Local unchanged since last sync - take remote
  if (localHash === lastSyncedHash) {
    return 'none'; // Remote wins, no conflict
  }

  // Case 3: Remote unchanged since last sync - take local
  if (remoteHash === lastSyncedHash) {
    return 'none'; // Local wins, no conflict
  }

  // Case 4: Both changed - conflict
  return 'both_modified';
}
```

### Hash Strategy

```typescript
// Content hash is computed on the FULL file content (frontmatter + body)
// This ensures any change (metadata or content) triggers conflict detection

interface IHashStrategy {
  // Compute hash of file content
  computeHash(content: string): string;

  // Compare two versions
  areEqual(hash1: string, hash2: string): boolean;
}

class SHA256HashStrategy implements IHashStrategy {
  computeHash(content: string): string {
    // Normalize line endings before hashing (CRLF → LF)
    const normalized = content.replace(/\r\n/g, '\n');
    return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
  }

  areEqual(hash1: string, hash2: string): boolean {
    return hash1 === hash2;
  }
}

// Why full file hash (not separate frontmatter/body):
// - Simpler implementation
// - Any change is detected
// - Avoids edge cases where frontmatter changes but body doesn't
// - Three-way merge handles the complexity of partial changes
```

### Conflict File Naming

```typescript
// When creating conflict backup files, use deterministic naming

interface IConflictNaming {
  // Generate conflict file name
  generateConflictName(originalPath: string, timestamp: Date): string;

  // Parse conflict file to get original name
  parseConflictName(conflictPath: string): IConflictFileInfo | null;

  // Check if file is a conflict file
  isConflictFile(path: string): boolean;
}

// Naming pattern: {basename} (conflict {YYYY-MM-DD HHmmss}).{ext}
// Example: my-prompt (conflict 2025-01-18 143052).md

const CONFLICT_PATTERN = /^(.+) \(conflict (\d{4}-\d{2}-\d{2} \d{6})\)\.(.+)$/;

function generateConflictName(originalPath: string, timestamp: Date): string {
  const dir = path.dirname(originalPath);
  const ext = path.extname(originalPath);
  const basename = path.basename(originalPath, ext);

  // Format: YYYY-MM-DD HHmmss
  const ts = timestamp
    .toISOString()
    .replace('T', ' ')
    .replace(/[-:]/g, '')
    .slice(0, 17)
    .replace(' ', ' ');

  return path.join(dir, `${basename} (conflict ${ts})${ext}`);
}

// Conflict files are:
// - Created when user chooses "Keep Remote" (backup local)
// - NOT synced to Drive (added to .driveIgnore)
// - NOT committed to Git (added to .gitignore)
// - Cleaned up manually or via "Clear Conflicts" action
```

### Conflict Resolution Flow

```
1. User syncs or pulls changes
2. System detects conflict (localHash ≠ remoteHash AND localHash ≠ lastSyncedHash)
3. Show conflict resolution dialog:

   ┌─────────────────────────────────────────────────────────────┐
   │  ⚠ Conflict Detected: my-prompt.md                          │
   ├─────────────────────────────────────────────────────────────┤
   │                                                              │
   │  This file was modified both locally and on Google Drive.   │
   │                                                              │
   │  Local version:  Modified Jan 18, 2025 at 10:30 AM          │
   │  Remote version: Modified Jan 18, 2025 at 10:25 AM          │
   │                                                              │
   │  ┌─────────────────────┬─────────────────────┐              │
   │  │   Local Version     │   Remote Version    │              │
   │  ├─────────────────────┼─────────────────────┤              │
   │  │ Line 5: foo = 1     │ Line 5: foo = 2     │   <-- diff   │
   │  │ Line 12: added      │                     │              │
   │  └─────────────────────┴─────────────────────┘              │
   │                                                              │
   │  [Keep Local] [Keep Remote] [Merge Manually] [View Diff]    │
   │                                                              │
   └─────────────────────────────────────────────────────────────┘

4. Resolution options:
   - Keep Local: Overwrite remote with local version
   - Keep Remote: Overwrite local with remote version
   - Merge Manually: Open three-way merge editor
   - View Diff: Show full side-by-side comparison
```

### Three-Way Merge

```typescript
interface IMergeService {
  // Perform automatic three-way merge
  autoMerge(base: string, local: string, remote: string): IMergeResult;

  // Get merge conflicts for manual resolution
  getMergeConflicts(base: string, local: string, remote: string): IMergeConflict[];

  // Apply manual resolution
  applyResolution(conflicts: IResolvedConflict[]): string;
}

interface IMergeResult {
  success: boolean;
  merged?: string; // Merged content if successful
  conflicts?: IMergeConflict[]; // Conflicts if auto-merge failed
}

interface IMergeConflict {
  id: string;
  lineStart: number;
  lineEnd: number;
  baseContent: string;
  localContent: string;
  remoteContent: string;
}

interface IResolvedConflict {
  id: string;
  resolution: 'local' | 'remote' | 'custom';
  customContent?: string;
}
```

### Uncommitted Local Changes During Pull

```typescript
// Strategy: Stash local changes, pull, then reapply
interface IPullStrategy {
  // Before pull: save uncommitted changes
  stashChanges(): Promise<string>; // Returns stash ID

  // After pull: reapply stashed changes
  popStash(stashId: string): Promise<IStashResult>;
}

interface IStashResult {
  success: boolean;
  conflicts?: string[]; // Files with conflicts after pop
}

// UI Flow:
// 1. User clicks "Pull"
// 2. If uncommitted changes exist:
//    - Show dialog: "You have uncommitted changes. Stash them before pulling?"
//    - [Stash & Pull] [Commit First] [Cancel]
// 3. Stash changes
// 4. Pull remote changes
// 5. Pop stash
// 6. If conflicts: show conflict resolution UI
```

---

## Testing Strategy

### Testing Pyramid

```
                    ┌─────────────┐
                    │    E2E      │  ~10% (Critical user journeys)
                    │  (Playwright)│
                    ├─────────────┤
                    │ Integration │  ~30% (Service interactions)
                    │  (Vitest)   │
                    ├─────────────┤
                    │    Unit     │  ~60% (Business logic, utils)
                    │  (Vitest)   │
                    └─────────────┘
```

### Coverage Requirements

| Layer             | Minimum Coverage | Target Coverage |
| ----------------- | ---------------- | --------------- |
| Unit Tests        | 80%              | 90%             |
| Integration Tests | 60%              | 75%             |
| E2E Tests         | Critical paths   | All user flows  |

### Unit Testing Strategy

```typescript
// Focus areas:
// - Services (business logic)
// - Composables (shared state/logic)
// - Utilities (pure functions)
// - Store actions/getters

// Example: Testing FileSystemService
describe('FileSystemService', () => {
  describe('readPromptFile', () => {
    it('parses YAML frontmatter correctly', async () => {
      // Arrange
      const mockContent = `---
title: Test Prompt
tags: [test]
---
Content here`;

      // Act
      const result = await service.readPromptFile('/path/to/prompt.md');

      // Assert
      expect(result.metadata.title).toBe('Test Prompt');
      expect(result.content).toBe('Content here');
    });

    it('handles missing frontmatter gracefully', async () => {
      /* ... */
    });
    it('returns error for non-existent file', async () => {
      /* ... */
    });
  });
});
```

### Integration Testing Strategy

```typescript
// Focus areas:
// - IPC communication (main <-> renderer)
// - Store + Service interactions
// - IndexedDB operations
// - File system + Git interactions

// Example: Testing sync flow
describe('SyncService Integration', () => {
  it('syncs local changes to Google Drive', async () => {
    // Setup mock Drive API
    const mockDriveApi = createMockDriveApi();

    // Create local file
    await fileService.createPrompt({ title: 'New Prompt' });

    // Trigger sync
    const result = await syncService.syncAll();

    // Verify Drive API was called
    expect(mockDriveApi.files.create).toHaveBeenCalled();
    expect(result.uploaded).toBe(1);
  });
});
```

### E2E Testing Scenarios

```typescript
// Critical user journeys to test:
const E2E_SCENARIOS = [
  'Create new prompt and save',
  'Edit prompt with snippets',
  'Search and open prompt',
  'Sign in with Google',
  'Sync prompts to Drive',
  'Resolve sync conflict',
  'Commit and push to GitHub',
  'Export prompt as Markdown',
  'Switch language/theme',
  'AI rewrite prompt',
];

// Example: Playwright test
test('user can create and save a new prompt', async ({ page }) => {
  await page.click('[data-testid="new-prompt-btn"]');
  await page.fill('[data-testid="prompt-title"]', 'My Test Prompt');
  await page.fill('.monaco-editor', '# Test Content');
  await page.click('[data-testid="save-btn"]');

  // Verify file created
  await expect(page.locator('[data-testid="file-explorer"]')).toContainText('My Test Prompt');
});
```

### Mock Data Strategy

```typescript
// src/tests/mocks/
// ├── fixtures/
// │   ├── prompts.ts           # Sample prompt data
// │   ├── snippets.ts          # Sample snippets
// │   └── user.ts              # Sample user data
// ├── services/
// │   ├── mock-file-system.ts  # Mock FS operations
// │   ├── mock-google-api.ts   # Mock Drive/Auth
// │   └── mock-git.ts          # Mock Git operations
// └── msw/
//     └── handlers.ts          # MSW request handlers

// Factory pattern for test data
const createMockPrompt = (overrides?: Partial<IPrompt>): IPrompt => ({
  id: crypto.randomUUID(),
  title: 'Test Prompt',
  content: '# Test Content',
  category: 'development',
  tags: ['test'],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});
```

---

## Performance Considerations

### Performance Budget

| Metric                       | Target  | Maximum |
| ---------------------------- | ------- | ------- |
| Initial Load (Electron)      | < 2s    | 3s      |
| File Open                    | < 100ms | 200ms   |
| Search Results               | < 200ms | 500ms   |
| Sync Status Update           | < 50ms  | 100ms   |
| Editor Keystroke Latency     | < 16ms  | 50ms    |
| Memory Usage (idle)          | < 150MB | 250MB   |
| Memory Usage (large project) | < 500MB | 750MB   |

### Large Project Handling

```typescript
// Project indexing limits
const INDEX_LIMITS = {
  maxFiles: 50000, // Skip indexing if exceeded
  maxFileSize: 1024 * 1024, // 1MB - skip large files
  maxDepth: 20, // Directory depth limit
  chunkSize: 1000, // Files per indexing batch
  debounceMs: 500, // File watcher debounce
};

// Pagination for large file lists
interface IPaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Virtual scrolling for file explorer
// Use vue-virtual-scroller for lists > 100 items
```

### Optimization Strategies

```typescript
// 1. Lazy loading Monaco Editor
const MonacoEditor = defineAsyncComponent(() => import('@/components/editor/MonacoEditor.vue'));

// 2. Debounced file watcher
const debouncedFileChange = useDebounceFn((path: string) => {
  refreshFile(path);
}, 500);

// 3. Memoized file content hash
const contentHashCache = new Map<string, string>();
const getContentHash = memoize((content: string) =>
  crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))
);

// 4. Incremental search with Web Workers
// Move search indexing to worker thread
const searchWorker = new Worker('/workers/search.worker.js');

// 5. Batch IndexedDB writes
const batchedWrites = useBatchedWrites({
  maxBatchSize: 100,
  flushIntervalMs: 1000,
});
```

### Memory Management

```typescript
// Dispose pattern for editor instances
interface IDisposable {
  dispose(): void;
}

// Limit open tabs
const MAX_OPEN_TABS = 20;

// Clear unused caches
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
setInterval(() => {
  contentHashCache.clear();
  projectIndexCache.pruneStale();
}, CACHE_TTL_MS);
```

---

## Security Architecture

### Threat Model

| Threat                     | Mitigation                                      |
| -------------------------- | ----------------------------------------------- |
| XSS in Markdown preview    | Sanitize HTML with DOMPurify                    |
| API key exposure           | Store in system keychain (electron-keytar)      |
| Malicious prompt injection | Input validation, no eval()                     |
| IPC injection              | Strict IPC channel allowlist                    |
| Local file access          | Sandbox renderer, validate paths                |
| Token theft                | HttpOnly cookies not applicable; secure storage |

### Content Security Policy

```typescript
// electron/main/index.ts
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // Monaco requires inline styles
  "font-src 'self' data:",
  "img-src 'self' data: https:",
  "connect-src 'self' https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com https://www.googleapis.com",
].join('; ');

mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [CSP],
    },
  });
});
```

### IPC Security

```typescript
// Allowlisted IPC channels (preload.ts)
const ALLOWED_CHANNELS = {
  invoke: [
    'fs:read-file',
    'fs:write-file',
    'fs:list-files',
    'git:status',
    'git:commit',
    'auth:login',
    'auth:logout',
    'sync:start',
    'sync:status',
  ],
  on: ['file:changed', 'sync:progress', 'auth:state-changed'],
} as const;

// Validate all IPC calls
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: unknown[]) => {
    if (!ALLOWED_CHANNELS.invoke.includes(channel)) {
      throw new Error(`IPC channel not allowed: ${channel}`);
    }
    return ipcRenderer.invoke(channel, ...args);
  },
});
```

### Input Sanitization

```typescript
// Sanitize Markdown preview
import DOMPurify from 'dompurify';

const sanitizeHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'a',
      'strong',
      'em',
      'code',
      'pre',
      'blockquote',
      'img',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
    ALLOW_DATA_ATTR: false,
  });
};

// Validate file paths
const isPathSafe = (path: string, baseDir: string): boolean => {
  const resolved = path.resolve(baseDir, path);
  return resolved.startsWith(baseDir) && !resolved.includes('..');
};
```

### API Key Encryption

```typescript
// Using electron-keytar (system keychain)
import keytar from 'keytar';

const SERVICE_NAME = 'MyndPrompt';

class SecureStorage {
  async setApiKey(provider: string, key: string): Promise<void> {
    await keytar.setPassword(SERVICE_NAME, `api-key-${provider}`, key);
  }

  async getApiKey(provider: string): Promise<string | null> {
    return keytar.getPassword(SERVICE_NAME, `api-key-${provider}`);
  }

  async deleteApiKey(provider: string): Promise<void> {
    await keytar.deletePassword(SERVICE_NAME, `api-key-${provider}`);
  }
}
```

### Context Isolation

```typescript
// electron/main/index.ts
const mainWindow = new BrowserWindow({
  webPreferences: {
    contextIsolation: true, // REQUIRED: isolate preload from renderer
    nodeIntegration: false, // REQUIRED: no Node in renderer
    sandbox: true, // REQUIRED: sandbox renderer
    preload: path.join(__dirname, 'preload.js'),
    webSecurity: true, // REQUIRED: enforce same-origin policy
  },
});
```

---

## State Management Architecture

### Store Definitions

```typescript
// src/stores/index.ts
// Pinia stores organized by domain

// 1. Auth Store - User authentication state
interface IAuthStore {
  user: IUserAuth | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login(): Promise<void>;
  logout(): Promise<void>;
  refreshToken(): Promise<void>;
}

// 2. UI Store - Application UI state
interface IUIStore {
  theme: 'light' | 'dark' | 'system';
  locale: SupportedLocale;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  panelHeight: number;
  panelCollapsed: boolean;
  activeView: 'explorer' | 'search' | 'snippets' | 'git' | 'ai' | 'settings';

  // Actions
  setTheme(theme: 'light' | 'dark' | 'system'): void;
  toggleSidebar(): void;
  setActiveView(view: string): void;
}

// 3. Editor Store - Open files and tabs
interface IEditorStore {
  openTabs: ITab[];
  activeTabId: string | null;
  unsavedChanges: Map<string, boolean>;

  // Getters
  activeTab: ITab | null;
  hasUnsavedChanges: boolean;

  // Actions
  openFile(filePath: string): Promise<void>;
  closeTab(tabId: string): void;
  saveFile(tabId: string): Promise<void>;
  saveAll(): Promise<void>;
}

// 4. Prompts Store - Prompt data and operations
interface IPromptsStore {
  prompts: IPrompt[];
  snippets: ISnippet[];
  isLoading: boolean;
  searchQuery: string;

  // Getters
  filteredPrompts: IPrompt[];
  favoritePrompts: IPrompt[];
  recentPrompts: IPrompt[];

  // Actions
  loadPrompts(): Promise<void>;
  createPrompt(data: Partial<IPrompt>): Promise<IPrompt>;
  updatePrompt(id: string, data: Partial<IPrompt>): Promise<void>;
  deletePrompt(id: string): Promise<void>;
}

// 5. Sync Store - Google Drive sync state
interface ISyncStore {
  status: 'idle' | 'syncing' | 'error' | 'offline';
  lastSyncedAt: Date | null;
  pendingChanges: number;
  conflicts: IConflictInfo[];

  // Actions
  sync(): Promise<void>;
  resolveConflict(filePath: string, resolution: 'local' | 'remote'): Promise<void>;
}

// 6. Git Store - Git status and operations
interface IGitStore {
  isRepo: boolean;
  branch: string;
  status: IGitFileStatus[];
  remotes: IGitRemote[];

  // Getters
  hasChanges: boolean;
  stagedCount: number;

  // Actions
  refresh(): Promise<void>;
  stage(files: string[]): Promise<void>;
  commit(message: string): Promise<void>;
  push(): Promise<void>;
  pull(): Promise<void>;
}

// 7. AI Store - AI provider configuration
interface IAIStore {
  providers: IAIProviderConfig[];
  activeProvider: string | null;
  activeModel: string | null;

  // Actions
  setApiKey(provider: string, key: string): Promise<void>;
  setActiveProvider(provider: string): void;
  testConnection(provider: string): Promise<boolean>;
}
```

### Store Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Vue Components                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────────┐│
│  │Sidebar  │  │ Editor  │  │ Toolbar │  │     Panels          ││
│  └────┬────┘  └────┬────┘  └────┬────┘  └──────────┬──────────┘│
└───────┼────────────┼────────────┼───────────────────┼───────────┘
        │            │            │                   │
        ▼            ▼            ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Pinia Stores                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌───────┐│
│  │  Auth   │  │ Editor  │  │ Prompts │  │  Sync   │  │  Git  ││
│  │  Store  │  │  Store  │  │  Store  │  │  Store  │  │ Store ││
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └───┬───┘│
└───────┼────────────┼────────────┼────────────┼───────────┼─────┘
        │            │            │            │           │
        ▼            ▼            ▼            ▼           ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Services                                │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌───────┐│
│  │  Auth   │  │   FS    │  │ Prompt  │  │  Drive  │  │  Git  ││
│  │ Service │  │ Service │  │ Service │  │ Service │  │Service││
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └───┬───┘│
└───────┼────────────┼────────────┼────────────┼───────────┼─────┘
        │            │            │            │           │
        ▼            ▼            ▼            ▼           ▼
┌─────────────────────────────────────────────────────────────────┐
│              IPC Bridge (Electron Preload)                       │
└───────┬────────────┬────────────┬────────────┬───────────┬─────┘
        │            │            │            │           │
        ▼            ▼            ▼            ▼           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Electron Main Process / File System                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────────┐│
│  │ Keychain│  │  Files  │  │ Prompts │  │    Google APIs      ││
│  └─────────┘  └─────────┘  │(.md)    │  │  (Drive, OAuth)     ││
│                            └─────────┘  └─────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Reactive Data Flow

```typescript
// File System → Store → UI flow
// 1. File watcher detects change
// 2. IPC sends 'file:changed' event to renderer
// 3. Service updates IndexedDB cache
// 4. Store action refreshes data
// 5. Components reactively update

// Example: File changed externally
// In main process:
watcher.on('change', (path) => {
  mainWindow.webContents.send('file:changed', { path, type: 'modified' });
});

// In renderer (service):
window.electronAPI.on('file:changed', async ({ path, type }) => {
  const content = await fileService.readFile(path);
  promptsStore.updatePromptFromFile(path, content);
});

// Store action triggers reactive update
// Components using usePromptsStore() automatically re-render
```

---

## Core Features

### 1. Prompt Management (File-Based)

- **File Operations**: Create, Read, Update, Delete `.md` files
- **YAML Frontmatter**: Metadata stored in file headers
- **Versioning**: Git-based version control
- **File Watcher**: Auto-reload on external changes
- **Categories**: Folder-based organization
- **Favorites & Pinning**: Stored in frontmatter + IndexedDB cache

### 2. Snippets System

```typescript
type SnippetType = 'file' | 'text' | 'persona' | 'variable';

interface ISnippet {
  id: string;
  name: string;
  type: SnippetType;
  content: string;
  shortcut: string; // e.g., "@architect", "!file:", "$date"
  description?: string;
  tags: string[];
  filePath: string; // Actual file location
  createdAt: Date;
  updatedAt: Date;
}

// Shortcut Prefixes:
// @ - Personas (e.g., @architect, @designer)
// ! - File references (e.g., !file:src/utils.ts)
// $ - Variables (e.g., $date, $project-name)
// # - Text snippets (e.g., #disclaimer, #license)
```

### 3. Project Indexing

```typescript
interface IProjectIndexer {
  // Scan and index project files
  indexProject(projectPath: string): Promise<IProjectIndexCache>;

  // Watch for file changes
  watchProject(projectPath: string): void;

  // Search indexed files
  searchFiles(query: string): Promise<ICachedFileInfo[]>;

  // Get AI-generated file meaning
  analyzeFileMeaning(filePath: string): Promise<string>;

  // Insert file reference in editor
  insertFileReference(filePath: string): string; // Returns @file:path
}

// Respects .gitignore and custom ignore patterns
const DEFAULT_IGNORE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  '*.lock',
  '.env*',
];
```

#### Project Indexer Scalability

**CRITICAL:** Project indexing is computationally expensive. A naive implementation will freeze the UI or crash Electron.

##### Web Worker Architecture

```typescript
// Indexing MUST run in a Web Worker to keep UI thread free

// Main process: Coordinates indexing
// Worker process: Does heavy file scanning and parsing

interface IIndexerWorkerMessage {
  type: 'start' | 'cancel' | 'status';
  payload: {
    projectPath?: string;
    ignorePatterns?: string[];
  };
}

interface IIndexerWorkerResponse {
  type: 'progress' | 'complete' | 'error' | 'file-indexed';
  payload: {
    filesScanned?: number;
    totalFiles?: number;
    currentFile?: string;
    result?: IProjectIndexCache;
    error?: string;
  };
}

// indexer.worker.ts - Runs in Web Worker
class IndexerWorker {
  private abortController: AbortController | null = null;

  async indexProject(projectPath: string, ignorePatterns: string[]): Promise<void> {
    this.abortController = new AbortController();

    // 1. Scan directory structure (breadth-first to allow early cancellation)
    const files = await this.scanDirectory(projectPath, ignorePatterns);

    // 2. Process files in batches to avoid memory pressure
    const BATCH_SIZE = 100;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      if (this.abortController.signal.aborted) break;

      const batch = files.slice(i, i + BATCH_SIZE);
      await this.processBatch(batch);

      // Report progress
      self.postMessage({
        type: 'progress',
        payload: {
          filesScanned: Math.min(i + BATCH_SIZE, files.length),
          totalFiles: files.length,
        },
      });

      // Yield to prevent blocking (even in worker)
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  cancel(): void {
    this.abortController?.abort();
  }
}

// Main thread: IndexerService
class IndexerService {
  private worker: Worker | null = null;

  async indexProject(projectPath: string): Promise<IProjectIndexCache> {
    // Create worker if not exists
    if (!this.worker) {
      this.worker = new Worker(new URL('./indexer.worker.ts', import.meta.url));
    }

    return new Promise((resolve, reject) => {
      this.worker!.onmessage = (event: MessageEvent<IIndexerWorkerResponse>) => {
        switch (event.data.type) {
          case 'progress':
            this.emit('indexing-progress', event.data.payload);
            break;
          case 'complete':
            resolve(event.data.payload.result!);
            break;
          case 'error':
            reject(new Error(event.data.payload.error));
            break;
        }
      };

      this.worker!.postMessage({
        type: 'start',
        payload: { projectPath, ignorePatterns: DEFAULT_IGNORE_PATTERNS },
      });
    });
  }

  cancelIndexing(): void {
    this.worker?.postMessage({ type: 'cancel', payload: {} });
  }
}
```

##### Large Repository Handling

```typescript
// Strategies for handling monorepos with 50k+ files

interface ILargeRepoStrategy {
  // Maximum files to index (safety limit)
  maxFiles: number;

  // Maximum file size to read content (larger files get metadata only)
  maxFileSizeBytes: number;

  // File extensions to prioritize
  priorityExtensions: string[];

  // Directories to scan first (most relevant)
  priorityDirectories: string[];
}

const LARGE_REPO_CONFIG: ILargeRepoStrategy = {
  maxFiles: 10000, // Hard limit
  maxFileSizeBytes: 100 * 1024, // 100KB max per file
  priorityExtensions: [
    '.ts',
    '.tsx',
    '.js',
    '.jsx', // JavaScript/TypeScript
    '.py', // Python
    '.go', // Go
    '.rs', // Rust
    '.java',
    '.kt', // JVM
    '.md',
    '.mdx', // Documentation
  ],
  priorityDirectories: ['src', 'lib', 'app', 'packages', 'components'],
};

// Tiered indexing approach
enum IndexingTier {
  FULL = 'full', // Full content + metadata + AI meaning
  CONTENT = 'content', // Content + metadata (no AI analysis)
  METADATA = 'metadata', // File path, size, modified date only
  SKIP = 'skip', // Ignored
}

function determineIndexingTier(
  filePath: string,
  fileSize: number,
  totalFilesIndexed: number
): IndexingTier {
  // Skip binary files
  if (isBinaryFile(filePath)) return IndexingTier.SKIP;

  // Large files get metadata only
  if (fileSize > LARGE_REPO_CONFIG.maxFileSizeBytes) return IndexingTier.METADATA;

  // Reached file limit? Metadata only for remaining
  if (totalFilesIndexed > LARGE_REPO_CONFIG.maxFiles) return IndexingTier.METADATA;

  // Priority extensions get full treatment
  const ext = path.extname(filePath);
  if (LARGE_REPO_CONFIG.priorityExtensions.includes(ext)) return IndexingTier.FULL;

  // Other text files get content without AI analysis
  return IndexingTier.CONTENT;
}
```

##### Token Limit Strategy for AI Context

```typescript
// When passing indexed files as context to AI, we must respect token limits

interface IContextWindowStrategy {
  // Model's total context window
  modelContextWindow: number;

  // Reserve tokens for user prompt
  reservedForPrompt: number;

  // Reserve tokens for AI response
  reservedForResponse: number;

  // Available for file context
  availableForContext: number;
}

function calculateContextBudget(model: IModel, promptTokens: number): IContextWindowStrategy {
  const reservedForResponse = Math.min(4096, model.contextWindow * 0.25);
  const reservedForPrompt = promptTokens + 500; // Buffer for template

  return {
    modelContextWindow: model.contextWindow,
    reservedForPrompt,
    reservedForResponse,
    availableForContext: model.contextWindow - reservedForPrompt - reservedForResponse,
  };
}

// Context selection strategies
type ContextSelectionStrategy =
  | 'relevance' // AI-ranked relevance to prompt
  | 'recency' // Most recently modified
  | 'explicit' // User-specified files only
  | 'sliding'; // Sliding window over codebase

interface IContextSelector {
  // Select files to include in context
  selectContext(
    prompt: string,
    indexedFiles: ICachedFileInfo[],
    budget: IContextWindowStrategy,
    strategy: ContextSelectionStrategy
  ): ISelectedContext;
}

interface ISelectedContext {
  files: IContextFile[];
  totalTokens: number;
  truncated: boolean;
  truncationReason?: string;
}

interface IContextFile {
  path: string;
  content: string;
  tokenCount: number;
  relevanceScore?: number;
  truncatedContent?: boolean;
}

// Token counting (approximate, for budget estimation)
function estimateTokens(text: string): number {
  // Rule of thumb: ~4 characters per token for code
  return Math.ceil(text.length / 4);
}

// Context assembly with chunking
class ContextAssembler {
  async assembleContext(
    files: ICachedFileInfo[],
    budget: number,
    strategy: ContextSelectionStrategy
  ): Promise<ISelectedContext> {
    const selectedFiles: IContextFile[] = [];
    let totalTokens = 0;

    // Sort files by strategy
    const sortedFiles = this.sortByStrategy(files, strategy);

    for (const file of sortedFiles) {
      const content = await this.readFile(file.path);
      const tokens = estimateTokens(content);

      // Would exceed budget?
      if (totalTokens + tokens > budget) {
        // Try truncating this file
        const remainingBudget = budget - totalTokens;
        if (remainingBudget > 500) {
          // Include truncated version
          const truncated = this.truncateToTokens(content, remainingBudget);
          selectedFiles.push({
            path: file.relativePath,
            content: truncated,
            tokenCount: remainingBudget,
            truncatedContent: true,
          });
          totalTokens = budget;
        }
        break; // Budget exhausted
      }

      selectedFiles.push({
        path: file.relativePath,
        content,
        tokenCount: tokens,
        truncatedContent: false,
      });
      totalTokens += tokens;
    }

    return {
      files: selectedFiles,
      totalTokens,
      truncated: sortedFiles.length > selectedFiles.length,
      truncationReason: totalTokens >= budget ? 'Token budget exceeded' : undefined,
    };
  }

  private truncateToTokens(content: string, maxTokens: number): string {
    // Truncate at line boundaries for readability
    const lines = content.split('\n');
    let result = '';
    let tokens = 0;

    for (const line of lines) {
      const lineTokens = estimateTokens(line + '\n');
      if (tokens + lineTokens > maxTokens) break;
      result += line + '\n';
      tokens += lineTokens;
    }

    return result + '\n// ... truncated ...';
  }
}
```

##### RAG (Retrieval-Augmented Generation) Strategy

```typescript
// For very large codebases, use RAG pattern instead of full context

interface IRAGConfig {
  // Use RAG when indexed files exceed this count
  ragThreshold: number;

  // Chunk size for embedding
  chunkSizeTokens: number;

  // Overlap between chunks
  chunkOverlapTokens: number;

  // Number of relevant chunks to retrieve
  topK: number;
}

const RAG_CONFIG: IRAGConfig = {
  ragThreshold: 500, // Use RAG for 500+ files
  chunkSizeTokens: 512, // ~2KB chunks
  chunkOverlapTokens: 50, // 10% overlap
  topK: 10, // Retrieve top 10 chunks
};

interface ICodeChunk {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  embedding?: number[]; // Vector embedding (if using local embedding)
}

// Chunking strategy for code
function chunkCodeFile(filePath: string, content: string): ICodeChunk[] {
  const chunks: ICodeChunk[] = [];
  const lines = content.split('\n');

  // Chunk at logical boundaries (functions, classes)
  // Fall back to line-based chunking if AST parsing fails

  let currentChunk: string[] = [];
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    currentChunk.push(lines[i]);

    // Check if we've hit chunk size or a logical boundary
    const chunkText = currentChunk.join('\n');
    const tokens = estimateTokens(chunkText);

    const isLogicalBoundary = isTopLevelDeclaration(lines[i + 1]);
    const isChunkFull = tokens >= RAG_CONFIG.chunkSizeTokens;

    if (isChunkFull || (isLogicalBoundary && tokens > RAG_CONFIG.chunkSizeTokens / 2)) {
      chunks.push({
        id: `${filePath}:${startLine}-${i}`,
        filePath,
        startLine,
        endLine: i,
        content: chunkText,
      });

      // Start new chunk with overlap
      const overlapLines = Math.ceil(RAG_CONFIG.chunkOverlapTokens / 10);
      startLine = Math.max(0, i - overlapLines);
      currentChunk = lines.slice(startLine, i + 1);
    }
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push({
      id: `${filePath}:${startLine}-${lines.length - 1}`,
      filePath,
      startLine,
      endLine: lines.length - 1,
      content: currentChunk.join('\n'),
    });
  }

  return chunks;
}

// Retrieval using MiniSearch (keyword-based, no embeddings needed)
class CodeRetriever {
  private searchIndex: MiniSearch;

  constructor() {
    this.searchIndex = new MiniSearch({
      fields: ['content', 'filePath'],
      storeFields: ['id', 'filePath', 'startLine', 'endLine', 'content'],
    });
  }

  addChunks(chunks: ICodeChunk[]): void {
    this.searchIndex.addAll(chunks);
  }

  retrieve(query: string, topK: number = RAG_CONFIG.topK): ICodeChunk[] {
    const results = this.searchIndex.search(query, { limit: topK });
    return results.map((r) => r as unknown as ICodeChunk);
  }
}
```

### 4. AI Integration

```typescript
interface IAIProvider {
  id: string;
  name: string;
  provider: 'anthropic' | 'openai' | 'google' | 'xai' | 'ollama';
  models: IModel[];
  isConfigured: boolean;
}

interface IModel {
  id: string;
  name: string;
  contextWindow: number;
  supportsVision: boolean;
}

// Provider Configurations
const AI_PROVIDERS: IAIProvider[] = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    provider: 'anthropic',
    models: [
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        contextWindow: 200000,
        supportsVision: true,
      },
      {
        id: 'claude-opus-4-0-20250514',
        name: 'Claude Opus 4',
        contextWindow: 200000,
        supportsVision: true,
      },
    ],
    isConfigured: false,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    provider: 'openai',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, supportsVision: true },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextWindow: 128000, supportsVision: true },
    ],
    isConfigured: false,
  },
  {
    id: 'google',
    name: 'Google (Gemini)',
    provider: 'google',
    models: [
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        contextWindow: 1000000,
        supportsVision: true,
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        contextWindow: 1000000,
        supportsVision: true,
      },
    ],
    isConfigured: false,
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    provider: 'xai',
    models: [{ id: 'grok-2', name: 'Grok 2', contextWindow: 128000, supportsVision: false }],
    isConfigured: false,
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    provider: 'ollama',
    models: [], // Dynamically fetched from local Ollama
    isConfigured: false,
  },
];

// Ollama Model Fetching Strategy
interface IOllamaService {
  // Check if Ollama is running
  isRunning(): Promise<boolean>;

  // Fetch available models from local Ollama
  listModels(): Promise<IOllamaModel[]>;

  // Refresh model list (cached for 5 minutes)
  refreshModels(): Promise<IOllamaModel[]>;
}

interface IOllamaModel {
  name: string;
  size: number;
  modified: Date;
  digest: string;
}

// Ollama fetching behavior:
// 1. On app start: Check if Ollama running, if yes, fetch models
// 2. Cache models for 5 minutes to avoid repeated API calls
// 3. If Ollama not running: Show "Ollama not detected" with setup link
// 4. Refresh button in settings to manually re-fetch models
// 5. Default base URL: http://localhost:11434 (configurable)
```

### 5. AI-Powered Features

- **Prompt Rewriter**: AI improves/optimizes prompts (button in toolbar)
- **Auto-Tagging**: AI suggests tags for prompts
- **File Meaning**: AI describes what each indexed file does
- **Quality Scoring**: AI evaluates prompt effectiveness

---

## Authentication & Cloud Sync

### Google OAuth Login

```typescript
interface IGoogleAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

const GOOGLE_AUTH_CONFIG: IGoogleAuthConfig = {
  clientId: process.env.VITE_GOOGLE_CLIENT_ID!,
  clientSecret: process.env.VITE_GOOGLE_CLIENT_SECRET!,
  redirectUri: 'http://localhost:8080/auth/callback', // For Electron
  scopes: [
    'email',
    'profile',
    'https://www.googleapis.com/auth/drive.file', // Read/write app files only
    'https://www.googleapis.com/auth/drive.appdata', // App-specific hidden folder
  ],
};

interface IAuthService {
  // Initiate Google OAuth flow
  login(): Promise<IUserAuth>;

  // Refresh access token
  refreshToken(): Promise<string>;

  // Logout and clear tokens
  logout(): Promise<void>;

  // Get current user
  getCurrentUser(): Promise<IUserAuth | null>;

  // Check if logged in
  isAuthenticated(): boolean;
}
```

**Authentication Flow:**

1. User clicks "Sign in with Google"
2. Electron opens OAuth popup via `shell.openExternal()` or BrowserWindow
3. User authenticates with Google
4. App receives OAuth tokens via redirect/deep link
5. Store tokens securely using `electron-keytar` (system keychain)
6. Enable Google Drive sync features

### Google Drive Sync

```typescript
interface IGoogleDriveSync {
  // Initialize sync (create app folder if needed)
  initialize(): Promise<void>;

  // Sync all prompts to Google Drive
  syncAll(): Promise<ISyncResult>;

  // Sync single file
  syncFile(filePath: string): Promise<ISyncStatus>;

  // Pull changes from Drive
  pullChanges(): Promise<IFileChange[]>;

  // Push local changes to Drive
  pushChanges(): Promise<ISyncResult>;

  // Resolve sync conflict
  resolveConflict(filePath: string, resolution: 'local' | 'remote' | 'merge'): Promise<void>;

  // Get sync status for all files
  getSyncStatus(): Promise<ISyncStatus[]>;
}

interface ISyncResult {
  uploaded: number;
  downloaded: number;
  conflicts: string[];
  errors: string[];
}

// Google Drive folder structure:
// My Drive/
// └── MyndPrompt/              (or App Data hidden folder)
//     ├── prompts/
//     ├── snippets/
//     ├── personas/
//     └── sync-metadata.json   // Sync state only, NO secrets
```

### Drive Sync Security Filter

**CRITICAL SECURITY RULE: API keys and secrets are NEVER synced to Google Drive.**

```typescript
// Files and patterns that are NEVER synced to Google Drive
const DRIVE_SYNC_BLOCKLIST: ISyncBlocklist = {
  // Patterns to NEVER upload
  patterns: [
    '**/.env*', // Environment files
    '**/secrets/**', // Secrets directory
    '**/*.key', // Key files
    '**/*.pem', // Certificates
    '**/credentials.json', // Credential files
    '**/config.local.json', // Local-only config
    '**/.git/**', // Git internals
    '**/node_modules/**', // Dependencies
    '**/*.bak', // Backup files
    '**/*.tmp', // Temp files
    '**/*conflict*', // Conflict backup files
  ],

  // Specific files to NEVER sync (by name)
  files: ['.myndprompt-secrets', 'api-keys.json', '.keytar-backup'],

  // Content patterns - if file contains these, BLOCK sync
  contentPatterns: [
    /sk-[a-zA-Z0-9]{48}/, // OpenAI API key pattern
    /sk-ant-[a-zA-Z0-9-]{95}/, // Anthropic API key pattern
    /AIza[a-zA-Z0-9_-]{35}/, // Google API key pattern
    /ghp_[a-zA-Z0-9]{36}/, // GitHub PAT pattern
    /gho_[a-zA-Z0-9]{36}/, // GitHub OAuth token
    /xai-[a-zA-Z0-9]{48}/, // xAI API key pattern (hypothetical)
  ],
};

interface ISyncBlocklist {
  patterns: string[];
  files: string[];
  contentPatterns: RegExp[];
}

// Validation BEFORE any file is uploaded
class SyncSecurityValidator {
  shouldSync(filePath: string, content?: string): ISyncValidation {
    // 1. Check file path against blocklist patterns
    for (const pattern of DRIVE_SYNC_BLOCKLIST.patterns) {
      if (minimatch(filePath, pattern)) {
        return {
          allowed: false,
          reason: `File matches blocked pattern: ${pattern}`,
          severity: 'block',
        };
      }
    }

    // 2. Check file name
    const fileName = path.basename(filePath);
    if (DRIVE_SYNC_BLOCKLIST.files.includes(fileName)) {
      return {
        allowed: false,
        reason: `File is in blocklist: ${fileName}`,
        severity: 'block',
      };
    }

    // 3. If content provided, scan for secrets
    if (content) {
      for (const pattern of DRIVE_SYNC_BLOCKLIST.contentPatterns) {
        if (pattern.test(content)) {
          return {
            allowed: false,
            reason: 'File appears to contain API keys or secrets',
            severity: 'block',
          };
        }
      }
    }

    return { allowed: true };
  }
}

interface ISyncValidation {
  allowed: boolean;
  reason?: string;
  severity?: 'block' | 'warn';
}

// Integration with sync service
class SecureDriveSync implements IGoogleDriveSync {
  private validator = new SyncSecurityValidator();

  async syncFile(filePath: string): Promise<ISyncStatus> {
    // Read file content
    const content = await fs.readFile(filePath, 'utf8');

    // Validate BEFORE sync
    const validation = this.validator.shouldSync(filePath, content);

    if (!validation.allowed) {
      logger.warn(`Blocked sync for ${filePath}: ${validation.reason}`);

      // Return blocked status (do NOT throw - just skip this file)
      return {
        id: generateId(),
        filePath,
        localHash: computeHash(content),
        status: 'blocked',
        blockedReason: validation.reason,
      };
    }

    // Proceed with sync...
    return this.performSync(filePath, content);
  }
}
```

### What IS Synced vs What is NOT

| Data Type                      | Synced to Drive? | Storage Location         |
| ------------------------------ | ---------------- | ------------------------ |
| Prompt files (.md)             | ✅ Yes           | Drive + Local            |
| Snippet files                  | ✅ Yes           | Drive + Local            |
| Persona files                  | ✅ Yes           | Drive + Local            |
| User preferences (theme, etc.) | ✅ Yes           | Drive + Local            |
| **API Keys**                   | ❌ **NEVER**     | System Keychain (keytar) |
| **OAuth Tokens**               | ❌ **NEVER**     | System Keychain (keytar) |
| **GitHub PAT**                 | ❌ **NEVER**     | System Keychain (keytar) |
| IndexedDB cache                | ❌ No            | Local only (ephemeral)   |
| Search index                   | ❌ No            | Local only (rebuilt)     |
| Git repository (.git/)         | ❌ No            | Local only               |
| Conflict backup files          | ❌ No            | Local only               |

### User Notification on Blocked Sync

```typescript
// If a file is blocked from sync, notify the user

interface IBlockedSyncNotification {
  filePath: string;
  reason: string;
  action: 'skipped' | 'removed_secret';
}

function notifyBlockedSync(blocked: IBlockedSyncNotification): void {
  showNotification({
    type: 'warning',
    title: 'File Not Synced',
    message: `"${path.basename(blocked.filePath)}" was not synced: ${blocked.reason}`,
    action: {
      label: 'Learn More',
      handler: () => openDocs('sync-security'),
    },
  });
}
```

---

## GitHub Integration

### Git Version Control

```typescript
interface IGitService {
  // Prerequisites check
  isGitInstalled(): Promise<boolean>;
  isGitRepo(path: string): Promise<boolean>;
  getGitVersion(): Promise<string | null>;

  // Initialize git repo in prompts directory
  init(path: string): Promise<void>;

  // Clone existing repo
  clone(repoUrl: string, path: string): Promise<void>;

  // Get current status
  status(): Promise<IGitFileStatus[]>;

  // Stage files
  add(files: string[] | 'all'): Promise<void>;

  // Commit changes
  commit(message: string): Promise<string>; // Returns commit hash

  // Push to remote
  push(remote?: string, branch?: string): Promise<void>;

  // Pull from remote
  pull(remote?: string, branch?: string): Promise<void>;

  // Get commit history for a file
  log(filePath?: string, limit?: number): Promise<IGitCommit[]>;

  // Get diff for a file
  diff(filePath: string, commitHash?: string): Promise<string>;

  // Checkout specific version
  checkout(commitHash: string, filePath?: string): Promise<void>;

  // Branch operations
  branches(): Promise<string[]>;
  createBranch(name: string): Promise<void>;
  switchBranch(name: string): Promise<void>;

  // Remote operations
  addRemote(name: string, url: string): Promise<void>;
  getRemotes(): Promise<IGitRemote[]>;

  // Stash operations (for handling uncommitted changes during pull)
  stash(message?: string): Promise<string>; // Returns stash ID
  stashPop(): Promise<IStashResult>;
  stashList(): Promise<IStashEntry[]>;
}

interface IStashEntry {
  id: string;
  message: string;
  date: Date;
}

interface IStashResult {
  success: boolean;
  conflicts?: string[];
}

interface IGitFileStatus {
  filePath: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'staged';
  staged: boolean;
}

interface IGitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: Date;
}

interface IGitRemote {
  name: string;
  url: string;
  type: 'fetch' | 'push';
}

// Use simple-git or isomorphic-git for implementation
// Consider nodegit for more advanced features
```

### GitHub Authentication

```typescript
interface IGitHubAuth {
  // OAuth flow for GitHub
  authenticate(): Promise<IGitHubUser>;

  // Personal Access Token setup
  setToken(token: string): Promise<void>;

  // Get authenticated user
  getUser(): Promise<IGitHubUser | null>;

  // List user repositories
  listRepos(): Promise<IGitHubRepo[]>;

  // Create new repo for prompts
  createRepo(name: string, isPrivate: boolean): Promise<IGitHubRepo>;
}

interface IGitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatarUrl: string;
}

interface IGitHubRepo {
  id: number;
  name: string;
  fullName: string;
  isPrivate: boolean;
  cloneUrl: string;
  sshUrl: string;
}
```

---

## Sharing Features

### Copy & Export (Simple Sharing)

```typescript
interface IShareService {
  // Copy prompt content to clipboard
  copyAsText(promptPath: string): Promise<void>;

  // Copy as formatted Markdown
  copyAsMarkdown(promptPath: string): Promise<void>;

  // Copy with metadata (YAML frontmatter included)
  copyWithMetadata(promptPath: string): Promise<void>;

  // Copy formatted for specific AI tool
  copyForTool(promptPath: string, tool: 'claude' | 'chatgpt' | 'gemini'): Promise<void>;

  // Export single prompt to file
  exportToFile(promptPath: string, format: 'md' | 'txt' | 'json'): Promise<string>;

  // Export multiple prompts
  exportBulk(promptPaths: string[], format: 'md' | 'json' | 'zip'): Promise<string>;

  // Import from text/file
  importFromText(content: string): Promise<string>; // Returns new file path
  importFromFile(filePath: string): Promise<string>;
}

// Keyboard shortcuts for sharing
const SHARE_SHORTCUTS = {
  copyAsText: 'Ctrl+Shift+C', // Cmd+Shift+C on Mac
  copyAsMarkdown: 'Ctrl+Shift+M', // Cmd+Shift+M on Mac
  copyForTool: 'Ctrl+Shift+T', // Cmd+Shift+T on Mac (opens tool picker)
};

// Copy formats
interface ICopyFormat {
  text: string; // Plain text, no metadata
  markdown: string; // Full markdown with code blocks preserved
  withMetadata: string; // Includes YAML frontmatter
  forClaude: string; // Optimized format for Claude
  forChatGPT: string; // Optimized format for ChatGPT
  forGemini: string; // Optimized format for Gemini
}
```

---

## Missing Features Detail

### Onboarding / First-Run Experience

```typescript
interface IOnboardingFlow {
  steps: IOnboardingStep[];
  currentStep: number;
  isComplete: boolean;
}

interface IOnboardingStep {
  id: string;
  title: string;
  description: string;
  component: string; // Vue component to render
  isRequired: boolean;
  isComplete: boolean;
}

const ONBOARDING_STEPS: IOnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to MyndPrompt',
    description: 'Your AI prompt management companion',
    component: 'OnboardingWelcome',
    isRequired: true,
    isComplete: false,
  },
  {
    id: 'storage-location',
    title: 'Choose Storage Location',
    description: 'Where should we store your prompts?',
    component: 'OnboardingStorageLocation',
    isRequired: true,
    isComplete: false,
  },
  {
    id: 'ai-providers',
    title: 'Configure AI Providers',
    description: 'Add your API keys (optional, can do later)',
    component: 'OnboardingAIProviders',
    isRequired: false,
    isComplete: false,
  },
  {
    id: 'google-signin',
    title: 'Sign in with Google',
    description: 'Enable cloud sync (optional)',
    component: 'OnboardingGoogleSignin',
    isRequired: false,
    isComplete: false,
  },
  {
    id: 'create-first-prompt',
    title: 'Create Your First Prompt',
    description: 'Get started with a sample prompt',
    component: 'OnboardingFirstPrompt',
    isRequired: true,
    isComplete: false,
  },
];
```

### First-Run Flow

```
1. App launches for first time
2. Detect if ~/.myndprompt/ exists
   - If not: Show onboarding wizard
   - If yes: Check for migration needs, then load app
3. Onboarding wizard steps:
   a. Welcome screen with feature overview
   b. Storage location picker (default or custom)
   c. Optional: AI provider setup
   d. Optional: Google sign-in
   e. Create first prompt (with template)
4. Mark onboarding complete in IndexedDB
5. Load main app
```

### Settings UI Specification

```
Settings Page Layout:
┌─────────────────────────────────────────────────────────────┐
│  Settings                                              [×]  │
├───────────────┬─────────────────────────────────────────────┤
│               │                                             │
│  General      │  General Settings                           │
│  ─────────    │  ─────────────────                          │
│  Appearance   │                                             │
│  Editor       │  Language: [English (US)        ▼]          │
│  AI Providers │                                             │
│  Sync         │  Storage Location:                          │
│  Git          │  [~/.myndprompt/              ] [Browse]    │
│  Keyboard     │                                             │
│  About        │  ☑ Launch at startup                        │
│               │  ☑ Check for updates automatically          │
│               │                                             │
│               │  ─────────────────────────────────────────  │
│               │                                             │
│               │  Data Management                            │
│               │  [Export All Data] [Import Data] [Reset]    │
│               │                                             │
└───────────────┴─────────────────────────────────────────────┘

Settings Sections:
├── General
│   ├── Language
│   ├── Storage location
│   ├── Launch at startup
│   └── Update settings
├── Appearance
│   ├── Theme (Light/Dark/System)
│   ├── Font family
│   ├── Font size
│   └── Minimap toggle
├── Editor
│   ├── Tab size
│   ├── Word wrap
│   ├── Line numbers
│   ├── Auto-save settings
│   └── Default template
├── AI Providers
│   ├── Anthropic (API key, default model)
│   ├── OpenAI (API key, default model)
│   ├── Google (API key, default model)
│   ├── xAI (API key, default model)
│   └── Ollama (base URL, model list)
├── Sync
│   ├── Google account status
│   ├── Sync frequency
│   ├── Conflict resolution default
│   └── Selective sync (folders to include/exclude)
├── Git
│   ├── Default commit message template
│   ├── Auto-commit on save
│   └── Remote repository settings
├── Keyboard
│   └── Customize shortcuts
└── About
    ├── Version info
    ├── Licenses
    └── Support links
```

### AI Chat Panel

```typescript
interface IAIChatPanel {
  // Chat history for current session
  messages: IChatMessage[];

  // Active AI provider/model
  provider: string;
  model: string;

  // Context from current prompt
  contextPrompt?: string;

  // Operations
  sendMessage(content: string): Promise<IChatMessage>;
  clearHistory(): void;
  exportChat(): string;
  insertResponseToEditor(): void;
}

interface IChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokenCount?: number;
}

// Chat panel UI
// ┌─────────────────────────────────────────┐
// │ AI Chat                      [Model ▼]  │
// ├─────────────────────────────────────────┤
// │ ┌─────────────────────────────────────┐ │
// │ │ User: How can I improve this prompt │ │
// │ └─────────────────────────────────────┘ │
// │ ┌─────────────────────────────────────┐ │
// │ │ Assistant: Here are suggestions...  │ │
// │ │ [Insert to Editor] [Copy]           │ │
// │ └─────────────────────────────────────┘ │
// ├─────────────────────────────────────────┤
// │ [Type message...              ] [Send]  │
// │ ☑ Include current prompt as context     │
// └─────────────────────────────────────────┘
```

### Auto-Save Behavior

```typescript
interface IAutoSaveConfig {
  enabled: boolean;
  mode: 'afterDelay' | 'onFocusLoss' | 'onWindowChange';
  delayMs: number; // For 'afterDelay' mode
  showIndicator: boolean; // Show "Saving..." in status bar
}

const DEFAULT_AUTO_SAVE: IAutoSaveConfig = {
  enabled: true,
  mode: 'afterDelay',
  delayMs: 1000, // 1 second after last keystroke
  showIndicator: true,
};

// Auto-save flow:
// 1. User types in editor
// 2. Start/restart debounce timer (1000ms default)
// 3. After delay with no typing:
//    a. Show "Saving..." indicator
//    b. Write file to disk
//    c. Update IndexedDB cache
//    d. Show "Saved" indicator (fade after 2s)
// 4. If error: show error notification, keep unsaved indicator

// Visual indicators:
// - Unsaved: Tab shows dot (●)
// - Saving: Status bar shows "Saving..."
// - Saved: Status bar shows "Saved" then fades
// - Error: Red indicator, notification
```

### Backup & Restore Flow

```typescript
interface IBackupService {
  // Create backup of all data
  createBackup(): Promise<IBackup>;

  // List available backups
  listBackups(): Promise<IBackup[]>;

  // Restore from backup
  restoreBackup(backupId: string): Promise<void>;

  // Delete old backups (retention policy)
  pruneBackups(keepCount: number): Promise<void>;

  // Export backup to file
  exportBackup(backupId: string, path: string): Promise<void>;

  // Import backup from file
  importBackup(path: string): Promise<IBackup>;
}

interface IBackup {
  id: string;
  createdAt: Date;
  size: number;
  promptCount: number;
  snippetCount: number;
  version: string; // App version at backup time
  isAutomatic: boolean;
}

// Backup storage: ~/.myndprompt/backups/
// Format: backup-{timestamp}.zip containing:
// - prompts/ (all .md files)
// - snippets/ (all .snippet.md files)
// - personas/ (all persona files)
// - config.json (IndexedDB export)
// - manifest.json (backup metadata)

// Automatic backups:
// - Before major operations (migration, restore)
// - Weekly (configurable)
// - Keep last 5 automatic backups
```

### Data Migration

```typescript
interface IMigrationService {
  // Export all data for transfer
  exportAll(path: string): Promise<IExportResult>;

  // Import data from another installation
  importAll(path: string): Promise<IImportResult>;

  // Migrate from older version
  migrateFromVersion(fromVersion: string): Promise<void>;
}

interface IExportResult {
  path: string;
  promptCount: number;
  snippetCount: number;
  configIncluded: boolean;
  credentialsExcluded: boolean; // Never export API keys
}

interface IImportResult {
  promptsImported: number;
  snippetsImported: number;
  conflicts: string[]; // Files that already existed
  errors: string[];
}

// Migration UI flow:
// 1. Settings → Data Management → Export/Import
// 2. Export creates portable .zip file
// 3. Import on new machine:
//    a. Select .zip file
//    b. Choose merge strategy (overwrite/skip/rename)
//    c. Import files
//    d. Prompt to re-enter API keys
```

### Full-Text Search Implementation

```typescript
interface ISearchService {
  // Build search index
  buildIndex(): Promise<void>;

  // Search prompts and snippets
  search(query: string, options?: ISearchOptions): Promise<ISearchResult[]>;

  // Update index for single file
  updateIndex(filePath: string): Promise<void>;

  // Remove from index
  removeFromIndex(filePath: string): Promise<void>;
}

interface ISearchOptions {
  types?: ('prompt' | 'snippet' | 'persona')[];
  tags?: string[];
  category?: string;
  limit?: number;
  includeContent?: boolean; // Return matching content snippets
}

interface ISearchResult {
  filePath: string;
  type: 'prompt' | 'snippet' | 'persona';
  title: string;
  score: number; // Relevance score
  matches: ISearchMatch[]; // Highlighted matches
}

interface ISearchMatch {
  field: 'title' | 'content' | 'tags';
  snippet: string; // Context around match
  positions: [number, number][]; // Start/end positions
}

// Implementation: Use MiniSearch (lightweight, fast)
// Index fields: title, content, tags, description
// Features: fuzzy matching, prefix search, field boosting
```

### Token Count Algorithm

```typescript
interface ITokenCounter {
  // Count tokens for text
  countTokens(text: string, model?: string): number;

  // Estimate cost based on provider pricing
  estimateCost(tokenCount: number, provider: string, model: string): number;
}

// Token counting strategy by provider:
// - OpenAI: Use tiktoken library (cl100k_base for GPT-4)
// - Anthropic: Use tiktoken (cl100k_base approximation) or API
// - Google: Character-based estimation (4 chars ≈ 1 token)
// - Ollama: Model-specific, default to GPT-4 estimation

// Display in status bar:
// "Tokens: 1,234 (~$0.02)"  // With cost estimate
// Updates on every editor change (debounced 200ms)
```

---

## UI Specification

### Layout (VSCode-inspired)

```
┌─────────────────────────────────────────────────────────────────┐
│ Menu Bar                                              [─][□][×] │
├─────────────────────────────────────────────────────────────────┤
│ Toolbar: [New] [Save] [Run] [AI Rewrite] | Search...  | [Sync] [Git] [User] │
├──────────────┬──────────────────────────────────────────────────┤
│              │ Tab Bar: [Prompt1.md ×] [Prompt2.md ×] [+]       │
│  Activity    ├──────────────────────────────────────────────────┤
│    Bar       │                                                  │
│              │                                                  │
│  [Explorer]  │              Editor Area                         │
│  [Search]    │                                                  │
│  [Snippets]  │         (Monaco Editor / CodeMirror)             │
│  [Git]       │                                                  │
│  [AI]        │                                                  │
│  [Settings]  │                                                  │
│              │                                                  │
├──────────────┼──────────────────────────────────────────────────┤
│              │ Panel: [Output] [Problems] [Git Changes] [AI Chat] │
│  Sidebar     ├──────────────────────────────────────────────────┤
│  (Context)   │ Panel Content                                    │
│              │                                                  │
├──────────────┴──────────────────────────────────────────────────┤
│ Status Bar: ● Synced | main | Ln 42, Col 15 | UTF-8 | Tokens: 1,234 │
└─────────────────────────────────────────────────────────────────┘
```

### Activity Bar Views

1. **Explorer**: File tree of prompts, snippets, personas
2. **Search**: Full-text search across all prompts and indexed projects
3. **Snippets**: Quick access to all snippets by type
4. **Git**: Source control panel (staged, changes, history)
5. **AI**: AI provider settings and chat panel
6. **Settings**: App configuration

### Status Bar Indicators

- **Sync Status**: ● Synced | ○ Syncing... | ⚠ Conflict | ○ Offline
- **Git Branch**: Current branch name
- **Git Status**: Clean | Modified (count)
- **Cursor Position**: Ln X, Col Y
- **File Encoding**: UTF-8
- **Token Count**: Estimated tokens for current prompt

### Keyboard Shortcuts

| Action                | Windows/Linux | macOS       |
| --------------------- | ------------- | ----------- |
| New Prompt            | Ctrl+N        | Cmd+N       |
| Save                  | Ctrl+S        | Cmd+S       |
| Save All              | Ctrl+Shift+S  | Cmd+Shift+S |
| Find                  | Ctrl+F        | Cmd+F       |
| Find in Files         | Ctrl+Shift+F  | Cmd+Shift+F |
| Command Palette       | Ctrl+Shift+P  | Cmd+Shift+P |
| Insert Snippet        | Ctrl+Space    | Cmd+Space   |
| Insert File Reference | Ctrl+Shift+I  | Cmd+Shift+I |
| AI Rewrite            | Ctrl+Shift+R  | Cmd+Shift+R |
| Copy as Text          | Ctrl+Shift+C  | Cmd+Shift+C |
| Copy as Markdown      | Ctrl+Shift+M  | Cmd+Shift+M |
| Toggle Sidebar        | Ctrl+B        | Cmd+B       |
| Git: Commit           | Ctrl+Enter    | Cmd+Enter   |
| Git: Push             | Ctrl+Shift+P  | Cmd+Shift+P |
| Git: Pull             | Ctrl+Shift+L  | Cmd+Shift+L |
| Sync with Drive       | Ctrl+Shift+Y  | Cmd+Shift+Y |

### Editor Features

- **Syntax Highlighting**: Markdown, code blocks, YAML frontmatter
- **Code Folding**: Collapse sections, frontmatter
- **Multi-cursor**: Edit multiple lines
- **Minimap**: Overview of document
- **Bracket Matching**: Highlight pairs
- **Auto-completion**: Snippets (`@`, `!`, `$`, `#` triggers)
- **Find & Replace**: With regex support
- **Diff View**: Compare versions (Git history)
- **Split View**: Compare two prompts side by side

---

## Localization

### Supported Languages

```typescript
const SUPPORTED_LOCALES = {
  'en-GB': 'English (UK)',
  'en-IE': 'English (Ireland)',
  'en-US': 'English (US)',
  'fr-FR': 'Français',
  'es-ES': 'Español',
  'pt-PT': 'Português',
  'pt-BR': 'Português (Brasil)',
  'it-IT': 'Italiano',
  'de-DE': 'Deutsch',
  'ar-SA': 'العربية',
} as const;

type SupportedLocale = keyof typeof SUPPORTED_LOCALES;
```

### RTL Support

- Arabic (ar-SA) requires RTL layout
- Use CSS logical properties (`margin-inline-start` vs `margin-left`)
- Mirror UI elements for RTL locales
- Monaco Editor has built-in RTL support

### i18n File Structure

```typescript
// src/i18n/en-US/index.ts
export default {
  app: {
    name: 'MyndPrompt',
    tagline: 'AI Prompt Manager',
  },
  menu: {
    file: 'File',
    edit: 'Edit',
    view: 'View',
    git: 'Git',
    help: 'Help',
  },
  prompts: {
    new: 'New Prompt',
    save: 'Save',
    delete: 'Delete',
    duplicate: 'Duplicate',
    copyAsText: 'Copy as Text',
    copyAsMarkdown: 'Copy as Markdown',
  },
  git: {
    commit: 'Commit',
    push: 'Push',
    pull: 'Pull',
    stage: 'Stage',
    unstage: 'Unstage',
    history: 'History',
  },
  sync: {
    synced: 'Synced',
    syncing: 'Syncing...',
    conflict: 'Conflict',
    offline: 'Offline',
  },
  // ...
};
```

---

## Technology Stack

### Core

| Technology     | Purpose                                  |
| -------------- | ---------------------------------------- |
| Vue 3.4+       | UI Framework                             |
| Quasar 2.x     | Component Library & Electron integration |
| TypeScript 5.x | Type Safety                              |
| Pinia          | State Management                         |
| Vue Router 4   | Navigation                               |
| Dexie.js       | IndexedDB wrapper (config/cache only)    |

### Editor

| Technology    | Purpose                             |
| ------------- | ----------------------------------- |
| Monaco Editor | Primary code editor (VSCode engine) |

### File System & Git

| Technology    | Purpose                  |
| ------------- | ------------------------ |
| chokidar      | File watching            |
| gray-matter   | YAML frontmatter parsing |
| simple-git    | Git operations           |
| @octokit/rest | GitHub API               |

### Electron

| Technology       | Purpose                   |
| ---------------- | ------------------------- |
| Electron 28+     | Desktop wrapper           |
| electron-builder | Packaging & distribution  |
| electron-keytar  | Secure credential storage |
| electron-updater | Auto-updates              |

### Cloud Services

| Technology          | Purpose          |
| ------------------- | ---------------- |
| googleapis          | Google Drive API |
| google-auth-library | OAuth 2.0        |

### AI SDKs

```json
{
  "@anthropic-ai/sdk": "^0.24.0",
  "openai": "^4.47.0",
  "@google/generative-ai": "^0.7.0",
  "ollama": "^0.5.0"
}
```

### Testing

| Technology     | Purpose           |
| -------------- | ----------------- |
| Vitest         | Unit testing      |
| Vue Test Utils | Component testing |
| Playwright     | E2E testing       |
| MSW            | API mocking       |

---

## Build & Development

### Scripts

```json
{
  "scripts": {
    "dev": "quasar dev",
    "dev:electron": "quasar dev -m electron",
    "build:web": "quasar build",
    "build:electron": "quasar build -m electron",
    "build:electron:win": "quasar build -m electron -T win32",
    "build:electron:mac": "quasar build -m electron -T darwin",
    "build:electron:linux": "quasar build -m electron -T linux",
    "test": "vitest",
    "test:e2e": "playwright test",
    "lint": "eslint --ext .ts,.vue src",
    "type-check": "vue-tsc --noEmit"
  }
}
```

### Environment Variables

```env
# .env.development
VITE_APP_NAME=MyndPrompt
VITE_APP_VERSION=1.0.0

# Google OAuth
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=your-client-secret

# GitHub OAuth (optional, can use PAT instead)
VITE_GITHUB_CLIENT_ID=your-github-client-id
VITE_GITHUB_CLIENT_SECRET=your-github-client-secret

# Default AI Keys (optional, users add their own)
VITE_ANTHROPIC_API_KEY=
VITE_OPENAI_API_KEY=
VITE_GOOGLE_AI_API_KEY=
```

---

## Operational Concerns

### Logging Strategy

```typescript
interface ILogService {
  // Log levels
  debug(message: string, context?: object): void;
  info(message: string, context?: object): void;
  warn(message: string, context?: object): void;
  error(message: string, error?: Error, context?: object): void;

  // Get logs for debugging
  getLogs(level?: LogLevel, limit?: number): ILogEntry[];

  // Export logs
  exportLogs(path: string): Promise<void>;
}

interface ILogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: object;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// Log storage: ~/.myndprompt/logs/
// - app.log (current session)
// - app.{date}.log (rotated daily, keep 7 days)
// - Max file size: 10MB before rotation

// What to log:
// - App startup/shutdown
// - User actions (sanitized, no content)
// - File operations (paths only)
// - Sync operations (status, not content)
// - Errors with stack traces
// - Performance metrics (slow operations > 1s)

// What NOT to log:
// - Prompt content
// - API keys (even partial)
// - Personal information
// - File contents
```

### Crash Reporting

```typescript
interface ICrashReporter {
  // Initialize crash reporting
  initialize(): void;

  // Capture exception
  captureException(error: Error, context?: object): void;

  // Set user context (opt-in only)
  setUser(userId?: string): void;

  // Add breadcrumb for debugging
  addBreadcrumb(message: string, category: string): void;
}

// Implementation options:
// 1. Local-only: Store crash reports in ~/.myndprompt/crashes/
// 2. Opt-in remote: Sentry.io (privacy-respecting config)

// Crash report contents:
// - Error message and stack trace
// - App version
// - OS and Electron version
// - Breadcrumbs (user actions before crash)
// - NOT: file contents, API keys, personal data

// User notification on crash:
// ┌────────────────────────────────────────────┐
// │ MyndPrompt encountered an error            │
// ├────────────────────────────────────────────┤
// │                                            │
// │ The app needs to restart.                  │
// │                                            │
// │ ☐ Send anonymous crash report to help      │
// │   improve MyndPrompt                       │
// │                                            │
// │ [View Details]  [Restart Now]              │
// └────────────────────────────────────────────┘
```

### Auto-Update Flow

```typescript
interface IUpdateService {
  // Check for updates
  checkForUpdates(): Promise<IUpdateInfo | null>;

  // Download update
  downloadUpdate(): Promise<void>;

  // Install update (requires restart)
  installUpdate(): void;

  // Get update progress
  getProgress(): IUpdateProgress;
}

interface IUpdateInfo {
  version: string;
  releaseDate: Date;
  releaseNotes: string;
  size: number;
  isMandatory: boolean;
}

interface IUpdateProgress {
  status: 'checking' | 'downloading' | 'ready' | 'error';
  percent?: number;
  bytesDownloaded?: number;
  totalBytes?: number;
}

// Update UI flow:
// 1. Check for updates on app start (if enabled)
// 2. If update available, show notification:
//    "Update available: v1.2.0 [Download] [Later]"
// 3. Download in background
// 4. When ready: "Update ready. [Restart Now] [Later]"
// 5. On next app start, apply update if pending

// Update notification (status bar):
// "● Update available" → "Downloading 45%..." → "Update ready"
```

### Analytics (Opt-In)

```typescript
interface IAnalyticsService {
  // Track event (only if user opted in)
  track(event: string, properties?: object): void;

  // Set opt-in status
  setOptIn(optedIn: boolean): void;

  // Check opt-in status
  isOptedIn(): boolean;
}

// What we track (if opted in):
// - Feature usage (which features are used)
// - App crashes (anonymous)
// - Performance metrics
// - NOT: content, personal data, file names

// Opt-in prompt (first run or settings):
// ┌────────────────────────────────────────────┐
// │ Help improve MyndPrompt                    │
// ├────────────────────────────────────────────┤
// │                                            │
// │ Share anonymous usage data to help us      │
// │ understand how MyndPrompt is used and      │
// │ where to focus improvements.               │
// │                                            │
// │ We never collect:                          │
// │ • Your prompts or content                  │
// │ • API keys or credentials                  │
// │ • Personal information                     │
// │                                            │
// │ [Yes, I'll help] [No thanks]               │
// └────────────────────────────────────────────┘
```

---

## Implementation Plan

### MVP Definition (v1.0)

**Minimum Viable Product includes:**

- Core prompt management (create, edit, delete, organize)
- Monaco editor with Markdown support
- File-based storage with YAML frontmatter
- Local Git integration (commit, history, diff)
- Basic snippets system
- Dark/light theme
- English localization only

**Explicitly excluded from MVP:**

- Google Drive sync
- AI features (rewriter, auto-tagging)
- Project indexer
- Multiple languages
- GitHub remote integration

### Task Dependency Graph

```
Task 1 (Project Setup)
    │
    ├──► Task 2 (IndexedDB)
    │        │
    │        └──► Task 4 (UI Shell)
    │                 │
    │                 ├──► Task 4.1 (Theme System) - Dark/Light/System mode
    │                 │
    │                 ├──► Task 5 (Monaco Editor)
    │                 │        │
    │                 │        └──► Task 6 (Prompt CRUD)
    │                 │                 │
    │                 │                 ├──► Task 7 (Snippets)
    │                 │                 │
    │                 │                 └──► Task 15 (Sharing)
    │                 │
    │                 └──► Task 8 (File Explorer)
    │
    └──► Task 3 (File System)
             │
             ├──► Task 6 (Prompt CRUD)
             │
             └──► Task 11 (Git Integration)
                      │
                      └──► Task 9 (Google OAuth)
                               │
                               └──► Task 10 (Google Drive Sync)

Task 12 (AI Provider) ──► Task 13 (Prompt Rewriter)
                    └──► Task 14 (Project Indexer)

Task 4.1 (Theme System) - Can start immediately after Task 4
Task 16 (i18n) - Independent, can start after Task 4
Task 17 (Packaging) - After all features complete
Task 18 (Testing) - Parallel with all tasks
```

### Phase Milestones

#### Phase 1: Foundation (Milestone: "App Shell")

| Task                   | Dependencies | Deliverable                     | Status |
| ---------------------- | ------------ | ------------------------------- | ------ |
| Task 1: Project Setup  | None         | Quasar + Electron running       | [x]    |
| Task 2: IndexedDB      | Task 1       | Working database layer          | [x]    |
| Task 3: File System    | Task 1       | File read/write working         | [x]    |
| Task 4: UI Shell       | Task 1, 2    | VSCode-like layout visible      | [x]    |
| Task 4.1: Theme System | Task 4       | Dark/light/system theme working | [x]    |

**Exit Criteria:** App launches, shows empty shell, can persist settings, theme preference works.

#### Phase 2: Core Features (Milestone: "Local Editor")

| Task                  | Dependencies | Deliverable                 | Status |
| --------------------- | ------------ | --------------------------- | ------ |
| Task 5: Monaco Editor | Task 4       | Editor with MD highlighting | [x]    |
| Task 6: Prompt CRUD   | Task 3, 5    | Create/edit/save prompts    | [x]    |
| Task 7: Snippets      | Task 6       | Snippet insertion working   | [x]    |
| Task 8: File Explorer | Task 4, 6    | Browse and open prompts     | [x]    |

**Exit Criteria:** Users can create, edit, and organize prompts locally.

#### Phase 3: Version Control (Milestone: "MVP Ready")

| Task                     | Dependencies | Deliverable           | Status |
| ------------------------ | ------------ | --------------------- | ------ |
| Task 11: Git Integration | Task 3       | Commit, diff, history | [ ]    |
| Task 15: Sharing         | Task 6       | Copy to clipboard     | [ ]    |

**Exit Criteria:** MVP complete. Users can manage prompts with Git versioning.

#### Phase 4: Cloud & AI (Milestone: "Full Product")

| Task                     | Dependencies | Deliverable        | Status |
| ------------------------ | ------------ | ------------------ | ------ |
| Task 9: Google OAuth     | Task 11      | Sign in working    | [ ]    |
| Task 10: Google Drive    | Task 9       | Sync working       | [ ]    |
| Task 12: AI Provider     | Task 1       | API connections    | [ ]    |
| Task 13: Prompt Rewriter | Task 12      | AI rewrite feature | [ ]    |
| Task 14: Project Indexer | Task 12      | File analysis      | [ ]    |

**Exit Criteria:** All features working, ready for beta.

#### Phase 5: Polish (Milestone: "Release")

| Task                  | Dependencies | Deliverable                  | Status |
| --------------------- | ------------ | ---------------------------- | ------ |
| Task 16: Localization | Task 4       | Multi-language support       | [ ]    |
| Task 17: Packaging    | All tasks    | Installers for all platforms | [ ]    |
| Task 18: Testing      | All tasks    | 80%+ coverage, E2E passing   | [ ]    |

**Exit Criteria:** Production-ready release.

### Risk Assessment

| Risk                              | Impact | Likelihood | Mitigation                             |
| --------------------------------- | ------ | ---------- | -------------------------------------- |
| Monaco Editor bundle size         | Medium | High       | Lazy load, tree-shake unused languages |
| Google OAuth rejection            | High   | Medium     | Apply early, have PAT fallback         |
| Electron security vulnerabilities | High   | Low        | Keep updated, follow best practices    |
| IndexedDB storage limits          | Medium | Low        | Implement cleanup, warn at 80%         |
| Git not installed on user machine | Medium | Medium     | Detect and show setup guide            |
| Large prompt files (>1MB)         | Low    | Low        | Warn users, implement streaming        |
| Sync conflicts data loss          | High   | Medium     | Always backup before resolve           |
| AI API rate limits                | Medium | Medium     | Queue requests, show retry UI          |

### Detailed Task Specifications

#### Task 1: Project Setup & Configuration

**Dependencies:** None

**Objective:**

- Initialize Quasar project with Vue 3, TypeScript, and Electron
- Configure ESLint (strict), Prettier, Husky pre-commit hooks
- Set up directory structure as specified
- Configure environment variables
- Set up GitHub repository with MIT license

**Key Files:**

```
myndprompt/
├── package.json
├── tsconfig.json
├── .eslintrc.js
├── .prettierrc
├── quasar.config.js
├── src/
│   ├── App.vue
│   ├── electron/
│   │   ├── main/index.ts
│   │   └── preload/index.ts
│   └── ...
└── .github/
    └── workflows/ci.yml
```

**Acceptance Criteria:**

- `npm run dev` starts web dev server
- `npm run dev:electron` starts Electron app
- All linting passes
- TypeScript compiles without errors
- CI pipeline runs on push

---

#### Task 2: IndexedDB Schema & Services

**Dependencies:** Task 1

**Objective:**

- Set up Dexie.js with TypeScript
- Create all tables as specified in Storage Architecture
- Implement repository pattern for each entity
- Add migration system for schema updates

**Key Files:**

```
src/services/storage/
├── db.ts                        # Dexie database instance
├── migrations/
│   └── v1.ts                    # Initial schema
└── repositories/
    ├── base.repository.ts       # Generic CRUD
    ├── auth.repository.ts
    ├── config.repository.ts
    ├── ui-state.repository.ts
    ├── recent-files.repository.ts
    └── ...
```

**Acceptance Criteria:**

- Can save and retrieve all entity types
- Migrations run automatically on version bump
- TypeScript types match database schema
- Unit tests pass for all repositories

---

#### Task 3: File System Service

**Dependencies:** Task 1

**Objective:**

- Create IPC-safe file system service
- Implement YAML frontmatter parsing (gray-matter)
- Set up file watcher (chokidar) for external changes
- Validate file paths for security

**Key Files:**

```
src/electron/main/services/
├── file-system.service.ts       # Node.js file operations
└── file-watcher.service.ts      # Chokidar wrapper

src/electron/preload/
└── file-system.bridge.ts        # IPC API

src/services/file-system/
├── prompt-file.service.ts       # Renderer-side service
└── frontmatter.service.ts       # YAML parsing
```

**Acceptance Criteria:**

- Can read/write files from renderer via IPC
- File changes trigger events in renderer
- Path traversal attacks prevented
- YAML frontmatter correctly parsed/serialized

---

#### Task 4: UI Shell & Layout

**Dependencies:** Task 1, Task 2

**Objective:**

- Implement VSCode-like layout with Quasar
- Activity bar, sidebar, editor area, panels
- Tab management for open files
- Theme support (light/dark/system)

**Key Components:**

```
src/components/
├── layout/
│   ├── MainLayout.vue
│   ├── ActivityBar.vue
│   ├── Sidebar.vue
│   ├── EditorArea.vue
│   ├── TabBar.vue
│   ├── Panel.vue
│   └── StatusBar.vue
└── ...
```

**Acceptance Criteria:**

- Layout matches specification wireframe
- Sidebar resizable and collapsible
- Tabs can be opened, closed, reordered
- Theme switches correctly
- Layout state persists across sessions

---

#### Task 4.1: Theme System (Dark/Light Mode)

**Dependencies:** Task 4

**Objective:**

- Implement theme switching (light/dark/system)
- Detect and respect system color scheme preference
- Persist user's theme preference
- Apply theme consistently across all components
- Support real-time theme switching without reload

**Key Components:**

```
src/
├── composables/
│   └── useTheme.ts              # Theme management composable
├── stores/
│   └── uiStore.ts               # Theme state (already exists, extend)
├── css/
│   ├── app.scss                 # Global styles with CSS variables
│   └── themes/
│       ├── _variables.scss      # CSS custom properties
│       ├── _light.scss          # Light theme overrides
│       └── _dark.scss           # Dark theme overrides
└── components/
    └── settings/
        └── ThemeSelector.vue    # Theme selection UI component
```

**Implementation Details:**

```typescript
// src/composables/useTheme.ts
import { computed, watch, onMounted } from 'vue';
import { Dark } from 'quasar';
import { useUIStore } from '@/stores/uiStore';

export type ThemeMode = 'light' | 'dark' | 'system';

export function useTheme() {
  const uiStore = useUIStore();

  // Current theme preference (user choice)
  const themeMode = computed(() => uiStore.theme);

  // Actual applied theme (resolved from system if needed)
  const isDark = computed(() => Dark.isActive);

  // Detect system preference
  const systemPrefersDark = computed(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Set theme mode
  function setTheme(mode: ThemeMode) {
    uiStore.setTheme(mode);
    applyTheme(mode);
  }

  // Apply theme based on mode
  function applyTheme(mode: ThemeMode) {
    if (mode === 'system') {
      Dark.set(systemPrefersDark.value);
    } else {
      Dark.set(mode === 'dark');
    }
  }

  // Toggle between light and dark
  function toggleTheme() {
    const newMode = isDark.value ? 'light' : 'dark';
    setTheme(newMode);
  }

  // Listen for system preference changes
  function watchSystemPreference() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      if (themeMode.value === 'system') {
        Dark.set(e.matches);
      }
    });
  }

  // Initialize theme on mount
  onMounted(() => {
    applyTheme(themeMode.value);
    watchSystemPreference();
  });

  return {
    themeMode,
    isDark,
    systemPrefersDark,
    setTheme,
    toggleTheme,
  };
}
```

```typescript
// Extend src/stores/uiStore.ts
interface UIState {
  // ... existing fields
  theme: 'light' | 'dark' | 'system';
}

// Add to actions
setTheme(theme: 'light' | 'dark' | 'system') {
  this.theme = theme;
  // Persist to IndexedDB
}
```

```scss
// src/css/themes/_variables.scss
:root {
  // Light theme (default)
  --mp-bg-primary: #ffffff;
  --mp-bg-secondary: #f5f5f5;
  --mp-bg-tertiary: #e0e0e0;
  --mp-text-primary: #1a1a1a;
  --mp-text-secondary: #666666;
  --mp-text-muted: #999999;
  --mp-border-color: #e0e0e0;
  --mp-accent-color: #7c3aed;
  --mp-accent-hover: #6d28d9;
  --mp-sidebar-bg: #f8f8f8;
  --mp-editor-bg: #ffffff;
  --mp-panel-bg: #f5f5f5;
  --mp-status-bar-bg: #7c3aed;
  --mp-activity-bar-bg: #2d2d2d;
}

.body--dark {
  // Dark theme
  --mp-bg-primary: #1e1e1e;
  --mp-bg-secondary: #252526;
  --mp-bg-tertiary: #333333;
  --mp-text-primary: #e0e0e0;
  --mp-text-secondary: #a0a0a0;
  --mp-text-muted: #666666;
  --mp-border-color: #3c3c3c;
  --mp-accent-color: #9d7aed;
  --mp-accent-hover: #a78bfa;
  --mp-sidebar-bg: #252526;
  --mp-editor-bg: #1e1e1e;
  --mp-panel-bg: #1e1e1e;
  --mp-status-bar-bg: #7c3aed;
  --mp-activity-bar-bg: #1a1a1a;
}
```

```vue
<!-- src/components/settings/ThemeSelector.vue -->
<script setup lang="ts">
import { useTheme, type ThemeMode } from '@/composables/useTheme';

const { themeMode, setTheme } = useTheme();

const themeOptions = [
  { value: 'light', label: 'Light', icon: 'mdi-white-balance-sunny' },
  { value: 'dark', label: 'Dark', icon: 'mdi-moon-waning-crescent' },
  { value: 'system', label: 'System', icon: 'mdi-laptop' },
] as const;
</script>

<template>
  <q-btn-toggle
    :model-value="themeMode"
    @update:model-value="setTheme($event as ThemeMode)"
    :options="themeOptions"
    toggle-color="primary"
    flat
    spread
  />
</template>
```

**Keyboard Shortcuts:**
| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+T` / `Cmd+Shift+T` | Toggle light/dark theme |

**Quasar Integration:**

- Use Quasar's built-in `Dark` plugin (already configured in `quasar.config.ts`)
- Leverage `dark: 'auto'` for initial system preference detection
- Use `.body--dark` CSS class for dark mode styling
- Quasar components automatically adapt to dark mode

**Acceptance Criteria:**

- [x] Theme can be set to light, dark, or system
- [x] System preference is detected and applied when "system" is selected
- [x] Theme changes are applied immediately without page reload
- [x] Theme preference persists in IndexedDB across sessions
- [x] All components respect the current theme
- [x] CSS custom properties are used for consistent theming
- [x] Keyboard shortcut works to toggle theme
- [x] Theme selector is accessible in settings/preferences (StatusBar icon)

**Exit Criteria:**

- Theme switching works correctly between light, dark, and system modes
- System preference changes are detected in real-time when "system" is selected
- Theme preference is saved and restored on app restart

---

#### Task 5: Monaco Editor Integration

**Dependencies:** Task 4

**Objective:**

- Integrate Monaco Editor
- Markdown syntax highlighting
- YAML frontmatter highlighting
- Custom snippets autocomplete

**Key Files:**

```
src/components/editor/
├── MonacoEditor.vue
├── editor-config.ts
├── markdown-language.ts
└── snippet-provider.ts
```

**Acceptance Criteria:**

- Editor loads without blocking app
- Markdown and code blocks highlighted
- Snippets trigger on prefix characters
- Editor state (cursor, scroll) persists

---

[Tasks 6-18 follow same detailed format...]

---

## What To Do Now

1. **Read this specification completely**
2. **Create the project structure** following the directory layout above
3. **Initialize the Quasar project** with TypeScript and Electron support
4. **Create the implementation plan** at `/documentation/implementation/myndprompt_implementation.md`
5. **Start with Task 1** and proceed sequentially

### First Commands to Run:

```bash
# Create project directory
mkdir myndprompt && cd myndprompt

# Initialize Quasar project
npm init quasar

# Select options:
# - Quasar v2
# - TypeScript
# - Composition API
# - Pinia
# - Vue Router
# - Sass with SCSS syntax
# - ESLint + Prettier

# Create documentation structure
mkdir -p documentation/implementation documentation/architecture/decisions

# Create the implementation plan file
touch documentation/implementation/myndprompt_implementation.md

# Initialize git
git init
echo "node_modules/\ndist/\n.env*\n*.local" > .gitignore

# Add MIT license
touch LICENSE
```

---

## Architecture Decision Records (ADRs)

### ADR-001: File-Based Storage over SQLite

**Status:** Accepted
**Date:** 2025-01-18

**Context:**
We need to store user prompts and snippets. Options considered:

1. SQLite database
2. File system with YAML frontmatter
3. JSON files
4. IndexedDB only

**Decision:**
Use file system with Markdown files containing YAML frontmatter.

**Rationale:**

- **Git integration**: Files can be version-controlled with standard Git
- **Portability**: Users can copy files to any machine
- **Editability**: Users can edit prompts in any text editor (VSCode, vim, etc.)
- **Standard format**: Markdown is widely supported, YAML frontmatter is common (Jekyll, Hugo)
- **Backup simplicity**: Just copy a folder
- **No lock-in**: Data is human-readable, not in proprietary format

**Consequences:**

- Slower than SQLite for large collections (acceptable for expected usage)
- Need to implement file watching for external changes
- Need to handle file system errors (permissions, disk full)
- Search requires reading files or maintaining an index

**Alternatives Rejected:**

- SQLite: Better performance but not portable, not Git-friendly, requires tooling to inspect
- JSON: Less readable, no native support for long-form content
- IndexedDB: Browser-specific, not portable, harder to backup

---

### ADR-002: Monaco Editor over CodeMirror

**Status:** Accepted
**Date:** 2025-01-18

**Context:**
We need a code editor for writing prompts. Options considered:

1. Monaco Editor (VSCode engine)
2. CodeMirror 6
3. Ace Editor
4. Custom textarea with syntax highlighting

**Decision:**
Use Monaco Editor.

**Rationale:**

- **Familiarity**: Same engine as VSCode, most developers know it
- **Features**: Built-in diff view, minimap, multi-cursor, find/replace
- **Markdown support**: Native Markdown highlighting and preview
- **Autocomplete**: Robust completion API for snippets
- **Maintenance**: Microsoft actively maintains it
- **Ecosystem**: Large community, many plugins/themes

**Consequences:**

- Large bundle size (~2MB minified) - mitigate with lazy loading
- Memory footprint higher than CodeMirror
- Some features require configuration to disable

**Alternatives Rejected:**

- CodeMirror 6: Lighter weight but less feature-complete, smaller community
- Ace: Dated, less active maintenance
- Custom: Would require significant development effort

---

### ADR-003: Google Drive over Dropbox/iCloud

**Status:** Accepted
**Date:** 2025-01-18

**Context:**
We need cloud sync for prompts. Options considered:

1. Google Drive
2. Dropbox
3. iCloud
4. Custom backend
5. No cloud sync

**Decision:**
Use Google Drive with OAuth.

**Rationale:**

- **Market share**: Google accounts are ubiquitous
- **API quality**: Well-documented, stable API
- **App folder**: Can use appDataFolder for hidden storage
- **OAuth reuse**: Same auth can be used for other Google services
- **Cost**: Free tier is generous (15GB shared)
- **Cross-platform**: Works on Windows, Mac, Linux

**Consequences:**

- Dependency on Google's API availability
- Need to handle Google's OAuth consent screen approval
- Users need Google account

**Alternatives Rejected:**

- Dropbox: Smaller market share, separate auth needed
- iCloud: Apple-only, poor Windows support
- Custom backend: Requires infrastructure, ongoing costs, user trust
- No cloud: Users requested sync as a key feature

---

### ADR-004: Electron over Web-First

**Status:** Accepted
**Date:** 2025-01-18

**Context:**
We need to decide the primary platform. Options considered:

1. Electron desktop app
2. Web app with PWA
3. Web app with optional Electron
4. Native apps (separate for each platform)

**Decision:**
Build Electron desktop app first, web version later if needed.

**Rationale:**

- **File system access**: Direct file access needed for Git integration
- **Secure storage**: System keychain for API keys (not possible in web)
- **Offline-first**: Full functionality without internet
- **Performance**: No network latency for file operations
- **Native feel**: System shortcuts, menus, notifications
- **Git integration**: Can shell out to git CLI

**Consequences:**

- Larger app size (~100MB)
- Need to handle Electron security carefully
- No browser-based access (initially)
- Need separate builds for Windows, Mac, Linux

**Alternatives Rejected:**

- Web-first: Can't access file system, can't use system keychain
- Hybrid: Complexity of maintaining both, feature parity issues
- Native: Massive development effort, separate codebases

---

### ADR-005: Pinia over Vuex

**Status:** Accepted
**Date:** 2025-01-18

**Context:**
We need state management for the Vue application.

**Decision:**
Use Pinia (official Vue 3 state management).

**Rationale:**

- **Official recommendation**: Pinia is the recommended state management for Vue 3
- **TypeScript support**: First-class TypeScript support
- **Simpler API**: No mutations, just actions
- **Composition API**: Works naturally with Vue 3 Composition API
- **DevTools**: Full Vue DevTools integration
- **Tree-shakeable**: Unused stores don't increase bundle size

**Consequences:**

- Team needs to learn Pinia patterns
- Less community resources than Vuex (but growing)

**Alternatives Rejected:**

- Vuex: Deprecated for Vue 3, more verbose
- Plain composables: Lacks DevTools integration, harder to debug

---

### ADR-006: electron-keytar for Credential Storage

**Status:** Accepted
**Date:** 2025-01-18

**Context:**
We need to securely store API keys and OAuth tokens.

**Decision:**
Use electron-keytar to store credentials in the system keychain.

**Rationale:**

- **Security**: Uses OS-level encryption (Keychain on Mac, Credential Vault on Windows)
- **Standard practice**: Same approach used by VS Code, Slack, and other Electron apps
- **No custom encryption**: Don't need to manage encryption keys
- **User familiar**: Credentials appear in system keychain apps

**Consequences:**

- Native module, requires rebuild for Electron version
- Adds ~1MB to app size
- Different behavior per platform (acceptable)

**Alternatives Rejected:**

- IndexedDB with encryption: Key management problem, not truly secure
- Environment variables: Not user-friendly, visible in process list
- Plain file storage: Insecure, even with basic encryption

---

### ADR-007: simple-git over isomorphic-git

**Status:** Accepted
**Date:** 2025-01-18

**Context:**
We need Git integration for version control.

**Decision:**
Use simple-git (wrapper around git CLI).

**Rationale:**

- **Full Git**: All Git features available via CLI
- **Reliability**: Git CLI is battle-tested
- **SSH support**: Works with SSH keys configured on system
- **Simplicity**: Thin wrapper, predictable behavior
- **Authentication**: Uses system's credential helpers

**Consequences:**

- Requires Git installed on user's machine
- Need to detect and guide installation if missing
- Shell execution has security considerations

**Alternatives Rejected:**

- isomorphic-git: Pure JS but limited features, no SSH support
- nodegit: Native module, complex setup, deprecated
- dugite: Bundles Git binary (large), less active

---

### ADR-008: Drive and Git Coexistence Strategy

**Status:** Accepted
**Date:** 2025-01-18

**Context:**
We have two "sources of truth managers" touching the same files:

1. Google Drive sync (cloud backup/sync)
2. Git (version control)

These can conflict. We need explicit rules for their interaction.

**Decision:**
Git is the primary version control system; Drive is a secondary backup/sync layer.

**Rules:**

1. **What Drive syncs:**
   - `prompts/` directory
   - `snippets/` directory
   - `personas/` directory
   - `templates/` directory
   - **NOT** `.git/` directory (never sync Git internals)
   - **NOT** `node_modules/`, `logs/`, `backups/`

2. **Sync triggers:**
   - Drive sync is triggered manually or on a schedule (not on every file save)
   - Git commits are independent of Drive sync

3. **When Drive pulls remote changes with local uncommitted changes:**

   ```
   Scenario: User has uncommitted local changes, Drive has newer remote version

   Resolution:
   1. Detect conflict (localHash ≠ remoteHash AND localHash ≠ lastSyncedHash)
   2. Do NOT auto-overwrite local changes
   3. Show conflict resolution UI
   4. Options:
      a. Keep local (mark remote as "seen", don't download)
      b. Keep remote (backup local to .conflict file, download remote)
      c. Merge manually (open diff view)
   5. After resolution, user can commit the result to Git
   ```

4. **Auto-commit policy:**
   - Drive sync does NOT auto-commit to Git
   - After Drive sync, show notification: "X files updated from cloud. Review and commit when ready."
   - UI clearly marks files as "Changed by sync" (distinct from "Modified locally")

5. **Divergence handling:**
   - Git and Drive CAN diverge (different commit history vs sync history)
   - This is acceptable: Git tracks detailed history, Drive tracks "last known good state"
   - Users who want Git+Drive parity should push to GitHub and use Drive only as backup

6. **Conflict file naming:**
   ```
   Original: my-prompt.md
   Conflict: my-prompt (conflict 2025-01-18 143052).md
   ```

**Consequences:**

- More complex sync logic
- Need clear UI to show sync vs Git status separately
- Users must understand the two systems are independent

**Alternatives Rejected:**

- Auto-commit on sync: Too magical, users lose control
- Sync .git/: Would corrupt Git state across machines
- Single source of truth: Would limit flexibility

---

### ADR-009: File Identity and Rename Strategy

**Status:** Accepted
**Date:** 2025-01-18

**Context:**
Files have both a `path` (location on disk) and an `id` (UUID in frontmatter).
We need to decide which is the canonical identity for:

- UI tabs and history
- Sync status tracking
- Git tracking

**Decision:**
Use `id` (UUID) as the canonical identity; `path` is a display/location attribute.

**Rules:**

1. **Identity source:**

   ```typescript
   // Canonical identity
   interface IPromptIdentity {
     id: string; // UUID from frontmatter - NEVER changes
     currentPath: string; // Current file location - can change
   }
   ```

2. **Rename/move handling:**
   - When user renames/moves a file, the `id` stays the same
   - Sync status table keyed by `id`, not `path`
   - UI tabs track by `id`, update display path on rename

3. **Sync status schema (updated):**

   ```typescript
   interface ISyncStatus {
     id: string; // Prompt UUID (primary key)
     currentPath: string; // Current file path
     previousPaths: string[]; // History of paths (for tracking renames)
     localHash: string;
     remoteHash?: string;
     lastSyncedHash?: string;
     status: SyncStatusType;
     lastSyncedAt?: Date;
   }
   ```

4. **Detecting renames:**
   - On file watcher "delete" event: Don't immediately mark as deleted
   - Wait 500ms, check if same `id` appears at new path
   - If yes: Update path, not delete+create
   - If no: Mark as deleted

5. **Drive sync with renames:**
   - Store `id` in Drive file metadata (appProperties)
   - On sync, match by `id` first, then by `path`
   - Renames sync correctly across devices

**Consequences:**

- More robust rename handling
- Slightly more complex sync logic
- Need to ensure `id` is always present in frontmatter

**Alternatives Rejected:**

- Path as identity: Renames break sync status, tab history
- Filename as identity: Not unique, renames still break

---

### ADR-010: Electron Security Baseline

**Status:** Accepted
**Date:** 2025-01-18

**Context:**
Electron apps have significant security surface area. We need explicit, non-negotiable security requirements.

**Decision:**
Implement defense-in-depth with the following mandatory requirements.

**Hard Requirements (MUST):**

1. **BrowserWindow configuration:**

   ```typescript
   const mainWindow = new BrowserWindow({
     webPreferences: {
       contextIsolation: true, // MUST: isolate preload
       nodeIntegration: false, // MUST: no Node in renderer
       sandbox: true, // MUST: OS-level sandbox
       webSecurity: true, // MUST: same-origin policy
       allowRunningInsecureContent: false,
       preload: path.join(__dirname, 'preload.js'),
     },
   });
   ```

2. **Preload bridge allowlist:**

   ```typescript
   // ONLY these methods exposed to renderer
   const ALLOWED_IPC_METHODS = {
     // File operations (scoped to app directory)
     'fs:read-prompt': true,
     'fs:write-prompt': true,
     'fs:list-prompts': true,
     'fs:delete-prompt': true,

     // Git operations
     'git:status': true,
     'git:commit': true,
     'git:log': true,

     // NO arbitrary file access
     // NO shell execution from renderer
     // NO eval or dynamic code
   } as const;
   ```

3. **Path validation (CRITICAL):**

   ```typescript
   // All file operations MUST validate paths
   function validatePath(requestedPath: string, allowedBase: string): boolean {
     const resolved = path.resolve(allowedBase, requestedPath);
     const normalized = path.normalize(resolved);

     // Must be within allowed directory
     if (!normalized.startsWith(allowedBase)) {
       throw new SecurityError('Path traversal attempt blocked');
     }

     // No symbolic links outside base
     const real = fs.realpathSync(normalized);
     if (!real.startsWith(allowedBase)) {
       throw new SecurityError('Symlink escape attempt blocked');
     }

     return true;
   }
   ```

4. **Content Security Policy:**

   ```typescript
   const CSP = [
     "default-src 'self'",
     "script-src 'self'",
     "style-src 'self' 'unsafe-inline'", // Monaco needs this
     "font-src 'self' data:",
     "img-src 'self' data: https:",
     "connect-src 'self' https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com https://www.googleapis.com https://api.github.com",
     "worker-src 'self' blob:", // Monaco workers
   ].join('; ');
   ```

5. **Auto-updater security:**

   ```typescript
   // MUST use signed updates
   autoUpdater.setFeedURL({
     provider: 'github',
     owner: 'myndprompt',
     repo: 'myndprompt',
     // Updates MUST be signed
   });

   // Verify signature before install
   autoUpdater.on('update-downloaded', (info) => {
     if (!info.signature) {
       throw new Error('Unsigned update rejected');
     }
   });
   ```

6. **Forbidden patterns:**
   - NO `eval()` anywhere
   - NO `new Function()` with user input
   - NO `shell.openExternal()` with unvalidated URLs
   - NO `webContents.executeJavaScript()` with user input
   - NO loading remote content in main window

**Consequences:**

- More boilerplate for IPC
- Some Monaco features may need CSP adjustments
- Security review required for any new IPC method

---

### ADR-011: Local Search Index Strategy

**Status:** Accepted
**Date:** 2025-01-18

**Context:**
We need full-text search across prompts. Options:

1. Scan files on-demand (slow for large collections)
2. Store content in IndexedDB (bloats DB, sync issues)
3. Use dedicated search index library

**Decision:**
Use MiniSearch as an in-memory search index with persistence.

**Implementation:**

1. **Search index library:** MiniSearch
   - Lightweight (~10KB)
   - Fast (millions of documents)
   - Supports fuzzy matching, prefix search, field boosting
   - Can serialize/deserialize index

2. **Index schema:**

   ```typescript
   const searchIndex = new MiniSearch({
     fields: ['title', 'content', 'tags', 'description'],
     storeFields: ['title', 'path', 'type'],
     searchOptions: {
       boost: { title: 2, tags: 1.5 },
       fuzzy: 0.2,
       prefix: true,
     },
   });
   ```

3. **Indexing strategy:**

   ```typescript
   interface ISearchIndexer {
     // Build full index (on app start or manual refresh)
     buildFullIndex(): Promise<void>;

     // Incremental updates
     addDocument(doc: ISearchableDocument): void;
     updateDocument(doc: ISearchableDocument): void;
     removeDocument(id: string): void;

     // Persistence
     saveIndex(): Promise<void>; // Save to ~/.myndprompt/cache/search-index.json
     loadIndex(): Promise<boolean>; // Returns false if rebuild needed
   }
   ```

4. **Incremental indexing:**
   - On file change: Update single document in index
   - Use file mtime + content hash to detect changes
   - Debounce updates (500ms) to batch rapid changes

5. **Index persistence:**
   - Save serialized index to `~/.myndprompt/cache/search-index.json`
   - Load on app start (fast)
   - Rebuild if: index file missing, version mismatch, or >24h old

6. **Performance limits:**
   ```typescript
   const SEARCH_LIMITS = {
     maxDocuments: 10000, // Warn user above this
     maxContentLength: 100000, // Truncate content for indexing
     maxResults: 100, // Default result limit
     debounceMs: 500, // Update debounce
     staleAfterMs: 86400000, // 24 hours
   };
   ```

**Consequences:**

- Fast search (<50ms for typical queries)
- Memory usage ~1MB per 1000 documents
- Need to handle index corruption gracefully

**Alternatives Rejected:**

- SQLite FTS: Overkill, adds native dependency
- Lunr: Larger, no longer maintained
- FlexSearch: Larger bundle size
- On-demand scan: Too slow for >100 files

---

### ADR-012: Secrets Storage Strategy

**Status:** Accepted
**Date:** 2025-01-18

**Context:**
We need to securely store:

- AI provider API keys
- OAuth tokens (Google)
- GitHub PAT (if used)

**Decision:**
Use electron-keytar (system keychain) as the ONLY secrets storage.

**Implementation:**

1. **Storage location:**
   - macOS: Keychain
   - Windows: Credential Vault
   - Linux: libsecret (GNOME Keyring / KWallet)

2. **Key naming convention:**

   ```typescript
   const SERVICE_NAME = 'MyndPrompt';

   // Key names
   const KEYS = {
     anthropicApiKey: 'api-key-anthropic',
     openaiApiKey: 'api-key-openai',
     googleAiApiKey: 'api-key-google-ai',
     xaiApiKey: 'api-key-xai',
     googleOAuthAccess: 'oauth-google-access',
     googleOAuthRefresh: 'oauth-google-refresh',
     githubPat: 'github-pat',
   };
   ```

3. **API:**

   ```typescript
   class SecureStorage {
     async setSecret(key: string, value: string): Promise<void> {
       await keytar.setPassword(SERVICE_NAME, key, value);
     }

     async getSecret(key: string): Promise<string | null> {
       return keytar.getPassword(SERVICE_NAME, key);
     }

     async deleteSecret(key: string): Promise<void> {
       await keytar.deletePassword(SERVICE_NAME, key);
     }

     async hasSecret(key: string): Promise<boolean> {
       const value = await this.getSecret(key);
       return value !== null;
     }
   }
   ```

4. **What we DON'T do:**
   - NO storing secrets in IndexedDB
   - NO storing secrets in config files
   - NO custom encryption (no key management problem)
   - NO environment variables for secrets

5. **Backup/export behavior:**
   - Secrets are NEVER included in backup exports
   - User must re-enter API keys on new device
   - Show clear message: "API keys are stored securely and cannot be exported"

6. **Error handling:**
   ```typescript
   // If keytar fails (e.g., no keychain available)
   async function getSecretWithFallback(key: string): Promise<string | null> {
     try {
       return await keytar.getPassword(SERVICE_NAME, key);
     } catch (error) {
       // Log error, show user notification
       logger.error('Keychain access failed', error);
       showNotification({
         type: 'error',
         message: 'Unable to access secure storage. Please check system keychain.',
       });
       return null;
     }
   }
   ```

**Consequences:**

- Secrets protected by OS-level security
- No secrets in app data (safe to backup/share ~/.myndprompt)
- Requires keychain access (may need user permission on some systems)

---

## Summary of Key Architectural Decisions

| Decision         | Choice              | Rationale                                         |
| ---------------- | ------------------- | ------------------------------------------------- |
| Prompt Storage   | File System (.md)   | Git version control, portability, standard format |
| Metadata Storage | IndexedDB           | Fast queries, offline-first, caching              |
| Cloud Sync       | Google Drive        | User owns data, no backend needed                 |
| Version Control  | Git + GitHub        | Industry standard, familiar UX                    |
| Sharing          | Clipboard (text/md) | Simple, no infrastructure needed                  |
| Editor           | Monaco              | VSCode engine, full-featured, familiar            |
| Auth             | Google OAuth        | Single sign-on for Drive access                   |
| Credentials      | electron-keytar     | System keychain, secure storage                   |

---

## Plugin Architecture

### Overview

MyndPrompt supports extensibility through a plugin system that allows adding new AI providers, export formats, and custom features without modifying core code.

### Plugin Types

```typescript
// Plugin type definitions
type PluginType = 'ai-provider' | 'exporter' | 'theme' | 'snippet-pack';

interface IPluginManifest {
  id: string; // Unique plugin ID (npm package style)
  name: string; // Display name
  version: string; // SemVer
  type: PluginType;
  author: string;
  description: string;
  homepage?: string;
  repository?: string;
  license: string;
  main: string; // Entry point file
  minAppVersion: string; // Minimum MyndPrompt version required
  permissions: PluginPermission[]; // Required permissions
}

type PluginPermission =
  | 'network' // Make HTTP requests
  | 'filesystem:read' // Read files in workspace
  | 'filesystem:write' // Write files in workspace
  | 'clipboard' // Access clipboard
  | 'notifications'; // Show system notifications
```

### AI Provider Plugin Interface

```typescript
interface IAIProviderPlugin {
  // Plugin metadata
  readonly id: string;
  readonly name: string;
  readonly icon: string; // Base64 or URL
  readonly supportedModels: IModelInfo[];

  // Lifecycle
  initialize(config: IPluginConfig): Promise<void>;
  dispose(): Promise<void>;

  // Configuration
  getSettingsSchema(): ISettingsSchema;
  validateSettings(settings: Record<string, unknown>): IValidationResult;

  // Core functionality
  chat(request: IChatRequest): AsyncIterable<IChatChunk>;
  complete(request: ICompletionRequest): Promise<ICompletionResponse>;

  // Optional capabilities
  supportsStreaming(): boolean;
  supportsVision(): boolean;
  estimateTokens?(text: string): number;
}

interface IModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  inputPricePerMillion?: number;
  outputPricePerMillion?: number;
  supportsVision: boolean;
  supportsStreaming: boolean;
}

interface ISettingsSchema {
  type: 'object';
  properties: Record<
    string,
    {
      type: 'string' | 'number' | 'boolean' | 'select';
      label: string;
      description?: string;
      required?: boolean;
      secret?: boolean; // If true, stored in keytar
      options?: { label: string; value: string }[];
      default?: unknown;
    }
  >;
}
```

### Exporter Plugin Interface

```typescript
interface IExporterPlugin {
  readonly id: string;
  readonly name: string;
  readonly fileExtension: string;
  readonly mimeType: string;

  // Export a single prompt
  exportPrompt(prompt: IPrompt, options: IExportOptions): Promise<Blob>;

  // Export multiple prompts (e.g., as zip)
  exportBatch(prompts: IPrompt[], options: IExportOptions): Promise<Blob>;

  // Preview export (optional)
  preview?(prompt: IPrompt): Promise<string>;
}

interface IExportOptions {
  includeMetadata: boolean;
  includeTags: boolean;
  format: 'single' | 'batch';
}

// Built-in exporters
// - Markdown (.md) - default
// - Plain Text (.txt)
// - JSON (.json)
// - PDF (.pdf) - via html-pdf or puppeteer
```

### Plugin Loading & Sandboxing

```typescript
interface IPluginLoader {
  // Load plugins from directory
  loadPlugins(pluginDir: string): Promise<ILoadedPlugin[]>;

  // Enable/disable plugin
  enablePlugin(pluginId: string): Promise<void>;
  disablePlugin(pluginId: string): Promise<void>;

  // Get plugin instance
  getPlugin<T>(pluginId: string): T | null;

  // List all plugins
  listPlugins(): IPluginInfo[];
}

interface ILoadedPlugin {
  manifest: IPluginManifest;
  instance: unknown;
  status: 'active' | 'disabled' | 'error';
  error?: string;
}

// Security: Plugins run in renderer process with limited IPC
// - NO access to Node.js APIs directly
// - NO access to file system outside workspace
// - All network requests logged
// - Permission prompts for sensitive operations
```

### Plugin Installation

```typescript
interface IPluginManager {
  // Install from npm registry or local path
  install(source: string): Promise<IPluginManifest>;

  // Uninstall plugin
  uninstall(pluginId: string): Promise<void>;

  // Update plugin
  update(pluginId: string): Promise<IPluginManifest>;

  // Check for updates
  checkUpdates(): Promise<IPluginUpdate[]>;
}

// Plugin storage location: ~/.myndprompt/plugins/{plugin-id}/
// Plugin config location: ~/.myndprompt/plugin-config/{plugin-id}.json
```

### Built-in vs Plugin Providers

```typescript
// Core providers (built-in, always available)
const BUILT_IN_PROVIDERS = ['anthropic', 'openai', 'google', 'xai', 'ollama'];

// Plugin providers discovered at runtime
const pluginProviders = pluginLoader
  .listPlugins()
  .filter((p) => p.type === 'ai-provider')
  .map((p) => p.instance as IAIProviderPlugin);

// Unified provider registry
class AIProviderRegistry {
  private providers: Map<string, IAIProviderPlugin> = new Map();

  register(provider: IAIProviderPlugin): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): IAIProviderPlugin | undefined {
    return this.providers.get(id);
  }

  list(): IAIProviderPlugin[] {
    return Array.from(this.providers.values());
  }
}
```

---

## Power User UX Workflows

### Command Palette

```typescript
// VSCode-style command palette (Ctrl+Shift+P / Cmd+Shift+P)

interface ICommand {
  id: string; // Unique command ID
  title: string; // Display title
  category?: string; // Category for grouping (e.g., "File", "Edit", "View")
  keybinding?: string; // Default keyboard shortcut
  when?: string; // Context expression for when command is available
  handler: () => void | Promise<void>;
}

interface ICommandRegistry {
  // Register a command
  register(command: ICommand): IDisposable;

  // Execute a command by ID
  execute(commandId: string, ...args: unknown[]): Promise<void>;

  // Get all registered commands
  getCommands(): ICommand[];

  // Search commands by text
  search(query: string): ICommand[];
}

// Built-in commands
const BUILT_IN_COMMANDS: ICommand[] = [
  // File commands
  { id: 'file.newPrompt', title: 'New Prompt', category: 'File', keybinding: 'Ctrl+N' },
  { id: 'file.newSnippet', title: 'New Snippet', category: 'File', keybinding: 'Ctrl+Shift+N' },
  { id: 'file.save', title: 'Save', category: 'File', keybinding: 'Ctrl+S' },
  { id: 'file.saveAll', title: 'Save All', category: 'File', keybinding: 'Ctrl+Shift+S' },
  { id: 'file.delete', title: 'Delete Prompt', category: 'File' },

  // Edit commands
  { id: 'edit.undo', title: 'Undo', category: 'Edit', keybinding: 'Ctrl+Z' },
  { id: 'edit.redo', title: 'Redo', category: 'Edit', keybinding: 'Ctrl+Shift+Z' },
  { id: 'edit.find', title: 'Find', category: 'Edit', keybinding: 'Ctrl+F' },
  { id: 'edit.replace', title: 'Find and Replace', category: 'Edit', keybinding: 'Ctrl+H' },
  {
    id: 'edit.copyPrompt',
    title: 'Copy Prompt to Clipboard',
    category: 'Edit',
    keybinding: 'Ctrl+Shift+C',
  },

  // View commands
  { id: 'view.sidebar', title: 'Toggle Sidebar', category: 'View', keybinding: 'Ctrl+B' },
  { id: 'view.terminal', title: 'Toggle AI Chat Panel', category: 'View', keybinding: 'Ctrl+`' },
  { id: 'view.zen', title: 'Toggle Zen Mode', category: 'View', keybinding: 'Ctrl+K Z' },
  { id: 'view.splitRight', title: 'Split Editor Right', category: 'View' },

  // Prompt commands
  { id: 'prompt.run', title: 'Run Prompt', category: 'Prompt', keybinding: 'Ctrl+Enter' },
  {
    id: 'prompt.runWithProvider',
    title: 'Run Prompt With...',
    category: 'Prompt',
    keybinding: 'Ctrl+Shift+Enter',
  },
  { id: 'prompt.favorite', title: 'Toggle Favorite', category: 'Prompt' },
  { id: 'prompt.pin', title: 'Toggle Pin', category: 'Prompt' },
  { id: 'prompt.export', title: 'Export Prompt...', category: 'Prompt' },

  // Sync commands
  { id: 'sync.now', title: 'Sync Now', category: 'Sync', keybinding: 'Ctrl+Shift+Y' },
  { id: 'sync.status', title: 'Show Sync Status', category: 'Sync' },
  { id: 'sync.conflicts', title: 'Show Conflicts', category: 'Sync' },

  // Git commands
  { id: 'git.commit', title: 'Commit Changes', category: 'Git' },
  { id: 'git.push', title: 'Push to Remote', category: 'Git' },
  { id: 'git.pull', title: 'Pull from Remote', category: 'Git' },
  { id: 'git.history', title: 'Show File History', category: 'Git' },

  // Settings commands
  { id: 'settings.open', title: 'Open Settings', category: 'Settings', keybinding: 'Ctrl+,' },
  {
    id: 'settings.keyboard',
    title: 'Keyboard Shortcuts',
    category: 'Settings',
    keybinding: 'Ctrl+K Ctrl+S',
  },
  { id: 'settings.themes', title: 'Color Theme', category: 'Settings' },
];

// Command Palette UI component
interface ICommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: ICommand[];
  recentCommands: string[]; // Recently used command IDs
}
```

### Quick Open (Ctrl+P / Cmd+P)

```typescript
// Fast file/prompt navigation

interface IQuickOpenItem {
  id: string;
  label: string; // Primary display text
  description?: string; // Secondary text (path, category)
  icon?: string; // Icon name or component
  score?: number; // Relevance score for sorting
  handler: () => void;
}

interface IQuickOpenProvider {
  // Provide items for a given query
  provideItems(query: string): Promise<IQuickOpenItem[]>;

  // Optional: prefix to trigger this provider (e.g., ">" for commands)
  prefix?: string;
}

// Built-in providers
const quickOpenProviders: IQuickOpenProvider[] = [
  {
    // Default: file/prompt search
    async provideItems(query: string): Promise<IQuickOpenItem[]> {
      const prompts = await promptStore.search(query);
      return prompts.map((p) => ({
        id: p.id,
        label: p.title,
        description: p.category || 'Uncategorized',
        icon: 'description',
        handler: () => editorStore.openPrompt(p.id),
      }));
    },
  },
  {
    prefix: '>', // Ctrl+Shift+P or type ">" in quick open
    async provideItems(query: string): Promise<IQuickOpenItem[]> {
      // Command palette mode
      return commandRegistry.search(query.slice(1)).map((cmd) => ({
        id: cmd.id,
        label: cmd.title,
        description: cmd.category,
        icon: 'terminal',
        handler: () => commandRegistry.execute(cmd.id),
      }));
    },
  },
  {
    prefix: '@', // Go to symbol
    async provideItems(query: string): Promise<IQuickOpenItem[]> {
      // Navigate to snippets/sections in current file
      const symbols = await editorStore.getDocumentSymbols();
      return symbols
        .filter((s) => s.name.includes(query.slice(1)))
        .map((s) => ({
          id: s.id,
          label: s.name,
          description: s.type,
          icon: 'code',
          handler: () => editorStore.goToLine(s.line),
        }));
    },
  },
  {
    prefix: '#', // Search by tag
    async provideItems(query: string): Promise<IQuickOpenItem[]> {
      const tag = query.slice(1);
      const prompts = await promptStore.findByTag(tag);
      return prompts.map((p) => ({
        id: p.id,
        label: p.title,
        description: p.tags.join(', '),
        icon: 'label',
        handler: () => editorStore.openPrompt(p.id),
      }));
    },
  },
  {
    prefix: ':', // Go to line
    async provideItems(query: string): Promise<IQuickOpenItem[]> {
      const line = parseInt(query.slice(1), 10);
      if (isNaN(line)) return [];
      return [
        {
          id: 'goto-line',
          label: `Go to line ${line}`,
          icon: 'arrow_forward',
          handler: () => editorStore.goToLine(line),
        },
      ];
    },
  },
];

// Fuzzy matching algorithm using fzf-style scoring
interface IFuzzyMatcher {
  match(query: string, target: string): IFuzzyMatch | null;
}

interface IFuzzyMatch {
  score: number;
  indices: number[]; // Matched character indices for highlighting
}
```

### Go to Symbol (Ctrl+Shift+O / Cmd+Shift+O)

````typescript
// Document outline / symbol navigation

interface IDocumentSymbol {
  id: string;
  name: string;
  type: SymbolType;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  children?: IDocumentSymbol[];
}

type SymbolType =
  | 'heading' // Markdown headings
  | 'snippet' // @snippet references
  | 'variable' // {{variable}} placeholders
  | 'codeblock' // Code blocks with language
  | 'frontmatter'; // YAML frontmatter section

// Symbol extraction for markdown prompts
function extractSymbols(content: string): IDocumentSymbol[] {
  const symbols: IDocumentSymbol[] = [];

  // Extract headings
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  // Extract snippet references
  const snippetRegex = /@(\w+)/g;
  // Extract variables
  const variableRegex = /\{\{(\w+)\}\}/g;
  // Extract code blocks
  const codeBlockRegex = /```(\w+)?[\s\S]*?```/g;

  // ... parse and return symbols
  return symbols;
}
````

### Keyboard Shortcut Manager

```typescript
interface IKeybinding {
  command: string; // Command ID
  key: string; // Keyboard shortcut (e.g., "Ctrl+Shift+P")
  when?: string; // Context when binding is active
  mac?: string; // macOS-specific shortcut
}

interface IKeybindingService {
  // Register a keybinding
  register(binding: IKeybinding): IDisposable;

  // Get keybinding for command
  getKeybinding(commandId: string): string | undefined;

  // Resolve key event to command
  resolveKeyEvent(event: KeyboardEvent): string | undefined;

  // User customizations (stored in ~/.myndprompt/keybindings.json)
  loadUserKeybindings(): void;
  saveUserKeybindings(bindings: IKeybinding[]): void;
}

// Default keybindings (Windows/Linux)
const DEFAULT_KEYBINDINGS: IKeybinding[] = [
  { command: 'file.newPrompt', key: 'Ctrl+N' },
  { command: 'file.save', key: 'Ctrl+S' },
  { command: 'edit.find', key: 'Ctrl+F' },
  { command: 'view.commandPalette', key: 'Ctrl+Shift+P', mac: 'Cmd+Shift+P' },
  { command: 'view.quickOpen', key: 'Ctrl+P', mac: 'Cmd+P' },
  { command: 'view.goToSymbol', key: 'Ctrl+Shift+O', mac: 'Cmd+Shift+O' },
  { command: 'prompt.run', key: 'Ctrl+Enter' },
  { command: 'sync.now', key: 'Ctrl+Shift+Y' },
];
```

---

## Sync Diagnostics

### Sync Status Page

```typescript
// Dedicated page for sync health monitoring

interface ISyncDiagnostics {
  // Overall sync health
  status: 'healthy' | 'warning' | 'error';
  lastSyncTime: Date | null;
  lastSyncDuration: number; // milliseconds

  // Drive connection
  driveConnected: boolean;
  driveQuota: {
    used: number;
    total: number;
  };

  // Recent sync operations
  recentOperations: ISyncOperation[];

  // Current conflicts
  conflicts: IConflictInfo[];

  // Pending changes
  pendingUploads: number;
  pendingDownloads: number;

  // Error log
  recentErrors: ISyncError[];
}

interface ISyncOperation {
  id: string; // UUID for tracking
  type: 'upload' | 'download' | 'delete' | 'conflict';
  filePath: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  requestId?: string; // Google API request ID
}

interface ISyncError {
  id: string;
  timestamp: Date;
  operation: string;
  filePath?: string;
  errorCode: string;
  errorMessage: string;
  requestId?: string; // Google API request ID for support
  retryable: boolean;
  retryCount: number;
}
```

### Sync Diagnostics UI

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Sync Diagnostics                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Status: ✅ Healthy              Last Sync: 2 minutes ago               │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Google Drive                                                     │   │
│  │ Connected as: user@gmail.com                                     │   │
│  │ Storage: 2.3 GB / 15 GB used                                    │   │
│  │ MyndPrompt folder: /MyndPrompt                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Pending Changes                                                        │
│  ├─ ⬆️ 2 files to upload                                               │
│  └─ ⬇️ 0 files to download                                              │
│                                                                         │
│  Recent Operations                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ✅ 10:32 AM  Uploaded  my-prompt.md                              │   │
│  │ ✅ 10:32 AM  Uploaded  another-prompt.md                         │   │
│  │ ⚠️ 10:30 AM  Conflict  shared-prompt.md    [Resolve]             │   │
│  │ ✅ 10:28 AM  Downloaded new-prompt.md                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Conflicts (1)                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ shared-prompt.md                                                 │   │
│  │ Local: Modified Jan 18, 10:30 AM                                 │   │
│  │ Remote: Modified Jan 18, 10:25 AM                                │   │
│  │ [Keep Local] [Keep Remote] [Merge] [View Diff]                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Recent Errors (0)                                                      │
│  No errors in the last 24 hours                                         │
│                                                                         │
│  [Force Sync Now]  [Clear Cache]  [Disconnect Drive]                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Sync Logging

```typescript
interface ISyncLogger {
  // Log sync operation
  logOperation(operation: ISyncOperation): void;

  // Log error with context
  logError(error: ISyncError): void;

  // Get recent logs
  getRecentLogs(limit: number): ISyncLogEntry[];

  // Export logs for debugging
  exportLogs(): Promise<Blob>;
}

interface ISyncLogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: 'sync' | 'drive' | 'git' | 'conflict';
  message: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
}

// Log storage: IndexedDB (last 7 days, max 10,000 entries)
// Log rotation: Automatic cleanup of old entries
```

---

## Cross-Platform Filesystem Handling

### Path Normalization

```typescript
interface IPathService {
  // Normalize path separators to forward slashes (internal storage)
  normalize(path: string): string;

  // Convert to platform-specific path (for OS operations)
  toPlatformPath(normalizedPath: string): string;

  // Join paths safely
  join(...parts: string[]): string;

  // Get relative path from base
  relative(from: string, to: string): string;
}

// Implementation
class PathService implements IPathService {
  normalize(path: string): string {
    // Convert backslashes to forward slashes
    return path.replace(/\\/g, '/');
  }

  toPlatformPath(normalizedPath: string): string {
    if (process.platform === 'win32') {
      return normalizedPath.replace(/\//g, '\\');
    }
    return normalizedPath;
  }

  join(...parts: string[]): string {
    return this.normalize(path.join(...parts));
  }

  relative(from: string, to: string): string {
    return this.normalize(path.relative(from, to));
  }
}

// Rule: Always store paths with forward slashes internally
// Convert to platform-specific only when calling OS APIs
```

### Case Sensitivity

```typescript
interface ICaseSensitivityConfig {
  // Detect filesystem case sensitivity
  isFileSystemCaseSensitive(): boolean;

  // Compare paths accounting for case sensitivity
  pathsEqual(path1: string, path2: string): boolean;

  // Check for potential conflicts on case-insensitive filesystems
  findCaseConflicts(paths: string[]): ICaseConflict[];
}

interface ICaseConflict {
  path1: string;
  path2: string;
  normalizedPath: string;
}

// Implementation
class CaseSensitivityHandler {
  private caseSensitive: boolean;

  constructor() {
    // Detect at startup
    this.caseSensitive = this.detectCaseSensitivity();
  }

  private detectCaseSensitivity(): boolean {
    if (process.platform === 'win32') return false;
    if (process.platform === 'darwin') {
      // macOS: usually case-insensitive (APFS default)
      // Could detect by creating temp files with different cases
      return false;
    }
    // Linux: usually case-sensitive
    return true;
  }

  pathsEqual(path1: string, path2: string): boolean {
    if (this.caseSensitive) {
      return path1 === path2;
    }
    return path1.toLowerCase() === path2.toLowerCase();
  }

  // Warn user if they create files that would conflict on other platforms
  findCaseConflicts(paths: string[]): ICaseConflict[] {
    const conflicts: ICaseConflict[] = [];
    const seen = new Map<string, string>();

    for (const p of paths) {
      const normalized = p.toLowerCase();
      const existing = seen.get(normalized);
      if (existing && existing !== p) {
        conflicts.push({ path1: existing, path2: p, normalizedPath: normalized });
      } else {
        seen.set(normalized, p);
      }
    }

    return conflicts;
  }
}
```

### Illegal Filename Characters

```typescript
interface IFilenameValidator {
  // Check if filename is valid on all supported platforms
  isValidFilename(filename: string): boolean;

  // Sanitize filename for cross-platform compatibility
  sanitize(filename: string): string;

  // Get validation errors
  getValidationErrors(filename: string): string[];
}

// Illegal characters by platform
const ILLEGAL_CHARS = {
  windows: ['<', '>', ':', '"', '|', '?', '*', '\\', '/'],
  macos: [':', '/'],
  linux: ['/'],
  // For cross-platform compatibility, use union of all
  crossPlatform: ['<', '>', ':', '"', '|', '?', '*', '\\', '/'],
};

// Reserved names (Windows)
const RESERVED_NAMES = [
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
];

class FilenameValidator implements IFilenameValidator {
  isValidFilename(filename: string): boolean {
    return this.getValidationErrors(filename).length === 0;
  }

  getValidationErrors(filename: string): string[] {
    const errors: string[] = [];

    // Check for illegal characters
    for (const char of ILLEGAL_CHARS.crossPlatform) {
      if (filename.includes(char)) {
        errors.push(`Contains illegal character: ${char}`);
      }
    }

    // Check for reserved names (Windows)
    const baseName = filename.replace(/\.[^.]*$/, '').toUpperCase();
    if (RESERVED_NAMES.includes(baseName)) {
      errors.push(`'${baseName}' is a reserved name on Windows`);
    }

    // Check for trailing dots/spaces (Windows)
    if (filename.endsWith('.') || filename.endsWith(' ')) {
      errors.push('Filename cannot end with a dot or space');
    }

    // Check length (255 bytes is common limit)
    if (Buffer.byteLength(filename, 'utf8') > 255) {
      errors.push('Filename too long (max 255 bytes)');
    }

    return errors;
  }

  sanitize(filename: string): string {
    let sanitized = filename;

    // Replace illegal characters with underscore
    for (const char of ILLEGAL_CHARS.crossPlatform) {
      sanitized = sanitized.split(char).join('_');
    }

    // Remove trailing dots/spaces
    sanitized = sanitized.replace(/[. ]+$/, '');

    // Handle reserved names
    const baseName = sanitized.replace(/\.[^.]*$/, '').toUpperCase();
    if (RESERVED_NAMES.includes(baseName)) {
      sanitized = '_' + sanitized;
    }

    // Truncate if too long
    while (Buffer.byteLength(sanitized, 'utf8') > 255) {
      sanitized = sanitized.slice(0, -1);
    }

    return sanitized;
  }
}
```

### Atomic File Writes

```typescript
interface IAtomicWriter {
  // Write file atomically (write to temp, then rename)
  writeFileAtomic(filePath: string, content: string, encoding?: BufferEncoding): Promise<void>;

  // Write with backup
  writeFileWithBackup(filePath: string, content: string): Promise<void>;
}

class AtomicWriter implements IAtomicWriter {
  async writeFileAtomic(
    filePath: string,
    content: string,
    encoding: BufferEncoding = 'utf8'
  ): Promise<void> {
    const dir = path.dirname(filePath);
    const tempPath = path.join(dir, `.${path.basename(filePath)}.tmp.${Date.now()}`);

    try {
      // Write to temp file
      await fs.promises.writeFile(tempPath, content, encoding);

      // Ensure data is flushed to disk (fsync)
      const fd = await fs.promises.open(tempPath, 'r');
      await fd.sync();
      await fd.close();

      // Atomic rename
      await fs.promises.rename(tempPath, filePath);
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.promises.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  async writeFileWithBackup(filePath: string, content: string): Promise<void> {
    const backupPath = `${filePath}.bak`;

    // Create backup of existing file
    try {
      await fs.promises.copyFile(filePath, backupPath);
    } catch {
      // File might not exist, that's OK
    }

    try {
      await this.writeFileAtomic(filePath, content);
      // Success: remove backup
      try {
        await fs.promises.unlink(backupPath);
      } catch {
        // Ignore
      }
    } catch (error) {
      // Restore from backup
      try {
        await fs.promises.rename(backupPath, filePath);
      } catch {
        // Backup restore failed too, report both errors
      }
      throw error;
    }
  }
}

// Why atomic writes:
// 1. Prevents data corruption on crash/power loss
// 2. Ensures file is either fully written or not written at all
// 3. Other processes always see complete file content
```

---

## Definition of Done Checklist

### Phase 1: Core Editor (MVP)

**Target:** Usable local prompt editor with file-based storage

| Task                      | Acceptance Criteria                                  | Done |
| ------------------------- | ---------------------------------------------------- | ---- |
| Monaco Editor integration | Editor loads, syntax highlighting works, save works  | ☐    |
| File-based storage        | Prompts saved as .md files in ~/.myndprompt/prompts/ | ☐    |
| YAML frontmatter parsing  | Frontmatter read/written correctly, schema validated | ☐    |
| Prompt CRUD               | Create, read, update, delete prompts via UI          | ☐    |
| Sidebar navigation        | Tree view of prompts, folders expandable             | ☐    |
| Basic search              | Full-text search across prompts (local only)         | ☐    |
| Tab management            | Open multiple prompts in tabs, close/switch tabs     | ☐    |
| Dark/light theme          | Theme switching works, respects system preference    | ☐    |
| Settings storage          | User preferences persisted in IndexedDB              | ☐    |
| **Testing**               | Unit tests for services, >80% coverage on core logic | ☐    |
| **Build**                 | Electron app builds for Windows, macOS, Linux        | ☐    |

### Phase 2: Cloud Sync & Git

**Target:** Prompts sync across devices and have version history

| Task                   | Acceptance Criteria                                 | Done |
| ---------------------- | --------------------------------------------------- | ---- |
| Google OAuth           | Sign in/out works, tokens stored securely in keytar | ☐    |
| Drive folder setup     | Creates /MyndPrompt folder on Drive if not exists   | ☐    |
| Initial sync           | Downloads all prompts from Drive on first login     | ☐    |
| Bi-directional sync    | Local changes upload, remote changes download       | ☐    |
| Conflict detection     | Detects when both local and remote changed          | ☐    |
| Conflict resolution UI | User can choose local/remote/merge                  | ☐    |
| Three-way merge        | Automatic merge when possible                       | ☐    |
| Offline mode           | Works offline, queues changes for later sync        | ☐    |
| Sync status indicator  | Shows sync status in UI (synced/syncing/error)      | ☐    |
| Git initialization     | Init git repo in ~/.myndprompt/                     | ☐    |
| Auto-commit            | Commits changes with meaningful messages            | ☐    |
| GitHub push/pull       | Connect to GitHub repo, push/pull changes           | ☐    |
| Git history viewer     | View file history, diff between versions            | ☐    |
| **Testing**            | Integration tests for sync scenarios                | ☐    |
| **Testing**            | Conflict resolution tested with edge cases          | ☐    |

### Phase 3: AI Integration

**Target:** Run prompts against AI providers from within the app

| Task                   | Acceptance Criteria                     | Done |
| ---------------------- | --------------------------------------- | ---- |
| Provider config UI     | Configure API keys for each provider    | ☐    |
| Secure key storage     | Keys stored in system keychain (keytar) | ☐    |
| Anthropic integration  | Claude API calls work, streaming works  | ☐    |
| OpenAI integration     | GPT API calls work, streaming works     | ☐    |
| Google AI integration  | Gemini API calls work                   | ☐    |
| xAI integration        | Grok API calls work                     | ☐    |
| Ollama integration     | Local model list, inference works       | ☐    |
| Chat panel UI          | Side panel shows AI responses           | ☐    |
| Response history       | Chat history persisted per prompt       | ☐    |
| Variable interpolation | {{variables}} replaced in prompts       | ☐    |
| Snippet expansion      | @snippet syntax expanded before send    | ☐    |
| Token estimation       | Show estimated tokens before send       | ☐    |
| **Testing**            | Mock AI responses in tests              | ☐    |
| **Testing**            | Error handling for API failures         | ☐    |

### Phase 4: Polish & Power Features

**Target:** Professional-grade UX for power users

| Task                  | Acceptance Criteria                     | Done |
| --------------------- | --------------------------------------- | ---- |
| Command Palette       | Ctrl+Shift+P opens, commands searchable | ☐    |
| Quick Open            | Ctrl+P opens, fuzzy search works        | ☐    |
| Go to Symbol          | Ctrl+Shift+O shows document outline     | ☐    |
| Keyboard shortcuts    | All major actions have shortcuts        | ☐    |
| Custom keybindings    | User can customize shortcuts            | ☐    |
| Sync diagnostics page | Shows sync health, errors, conflicts    | ☐    |
| Backup/restore        | Export/import all data                  | ☐    |
| Auto-update           | App checks for updates, installs them   | ☐    |
| Onboarding flow       | First-run wizard for setup              | ☐    |
| i18n (English)        | All strings externalized                | ☐    |
| Accessibility         | WCAG 2.1 AA compliance                  | ☐    |
| **Testing**           | E2E tests for critical flows            | ☐    |
| **Performance**       | Cold start <3s, large file <500ms       | ☐    |

### Per-Feature Checklist

For any new feature, verify:

- [ ] **Functionality**: Feature works as specified
- [ ] **Error handling**: Graceful failure, user-friendly messages
- [ ] **Loading states**: UI shows progress for async operations
- [ ] **Offline behavior**: Works or degrades gracefully offline
- [ ] **Keyboard accessible**: Can be used without mouse
- [ ] **Screen reader**: Appropriate ARIA labels
- [ ] **i18n ready**: All user-facing strings use i18n
- [ ] **Dark mode**: Works in both light and dark themes
- [ ] **Unit tests**: Core logic tested
- [ ] **Documentation**: API documented, README updated if needed

---

## OSS Operational Details

### CONTRIBUTING.md

````markdown
# Contributing to MyndPrompt

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

1. Prerequisites:
   - Node.js 20+
   - pnpm 8+
   - Git

2. Clone and install:
   ```bash
   git clone https://github.com/YOUR_ORG/myndprompt.git
   cd myndprompt
   pnpm install
   ```
````

3. Run in development mode:
   ```bash
   pnpm dev
   ```

## Code Style

- We use TypeScript with strict mode
- Vue 3 Composition API (`<script setup>`)
- ESLint + Prettier for formatting
- Run `pnpm lint` before committing

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Run tests: `pnpm test`
5. Run linting: `pnpm lint`
6. Commit with conventional commits: `feat: add new feature`
7. Push and create a Pull Request

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Formatting, no code change
- `refactor:` - Code restructuring
- `test:` - Adding tests
- `chore:` - Maintenance

## Testing

- Unit tests: `pnpm test:unit`
- E2E tests: `pnpm test:e2e`
- Coverage: `pnpm test:coverage`

## Questions?

- Open a [Discussion](https://github.com/YOUR_ORG/myndprompt/discussions)
- Check existing [Issues](https://github.com/YOUR_ORG/myndprompt/issues)

````

### CODE_OF_CONDUCT.md
```markdown
# Code of Conduct

## Our Pledge

We pledge to make participation in our project a harassment-free experience
for everyone, regardless of age, body size, disability, ethnicity, gender
identity, level of experience, nationality, personal appearance, race,
religion, or sexual identity and orientation.

## Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Respecting differing viewpoints
- Accepting constructive criticism gracefully
- Focusing on what's best for the community

**Unacceptable behavior includes:**
- Harassment, trolling, or personal attacks
- Publishing others' private information
- Other conduct reasonably considered inappropriate

## Enforcement

Project maintainers may remove, edit, or reject contributions not aligned
with this Code of Conduct. Violations may be reported to: conduct@myndprompt.app

## Attribution

Adapted from the [Contributor Covenant](https://www.contributor-covenant.org/),
version 2.1.
````

### SECURITY.md

```markdown
# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub issues.**

Instead, please email: security@myndprompt.app

Include:

- Type of vulnerability
- Full path to source file(s)
- Location of affected code (tag/branch/commit)
- Step-by-step reproduction instructions
- Proof-of-concept or exploit code (if possible)
- Impact assessment

## Response Timeline

- **24 hours:** Initial response acknowledging receipt
- **72 hours:** Preliminary assessment
- **7 days:** Detailed response with plan
- **90 days:** Fix released (or public disclosure)

## Security Measures

MyndPrompt implements:

- Electron security best practices (sandbox, contextIsolation)
- Content Security Policy
- Secure credential storage via system keychain
- No remote code execution
- Regular dependency audits

## Bug Bounty

We do not currently offer a bug bounty program, but we deeply appreciate
responsible disclosure and will credit reporters in our release notes
(unless anonymity is requested).
```

### LICENSE (MIT)

```
MIT License

Copyright (c) 2025 MyndPrompt Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### GitHub Issue Templates

**.github/ISSUE_TEMPLATE/bug_report.md**

```markdown
---
name: Bug Report
about: Report a bug to help us improve
title: '[BUG] '
labels: bug
assignees: ''
---

**Describe the bug**
A clear description of what the bug is.

**To Reproduce**

1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**

- OS: [e.g., Windows 11, macOS 14, Ubuntu 22.04]
- App Version: [e.g., 1.0.0]

**Additional context**
Any other context about the problem.
```

**.github/ISSUE_TEMPLATE/feature_request.md**

```markdown
---
name: Feature Request
about: Suggest an idea for MyndPrompt
title: '[FEATURE] '
labels: enhancement
assignees: ''
---

**Is your feature request related to a problem?**
A clear description of the problem. Ex. I'm frustrated when [...]

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Other solutions or features you've considered.

**Additional context**
Any other context or screenshots about the feature request.
```

### Pull Request Template

**.github/PULL_REQUEST_TEMPLATE.md**

```markdown
## Description

Brief description of changes.

## Type of Change

- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Documentation update

## Checklist

- [ ] My code follows the project style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have added tests that prove my fix/feature works
- [ ] New and existing tests pass locally
- [ ] I have updated documentation as needed

## Screenshots (if applicable)

## Related Issues

Fixes #(issue number)
```
