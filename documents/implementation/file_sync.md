# File Sync Implementation Plan

## Overview

This document describes the implementation of the **File Sync** feature for MyndPrompts. This feature enables users to add external folder paths to projects, index all files within those folders, and provide intelligent file path suggestions in the editor when typing `^` or `@` triggers.

---

## Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RENDERER PROCESS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐    │
│  │   UI Components │    │   Pinia Stores   │    │  Monaco Editor      │    │
│  ├─────────────────┤    ├──────────────────┤    ├─────────────────────┤    │
│  │ - SettingsPanel │◄──►│ - fileSyncStore  │◄──►│ - FilePathProvider  │    │
│  │ - StatusBar     │    │ - projectStore   │    │   (^ and @ triggers)│    │
│  │ - SyncProgress  │    │                  │    │                     │    │
│  └─────────────────┘    └────────┬─────────┘    └─────────────────────┘    │
│                                  │                                          │
│                                  ▼                                          │
│                    ┌─────────────────────────────┐                          │
│                    │     IndexedDB (Dexie)       │                          │
│                    ├─────────────────────────────┤                          │
│                    │ - projectFolders            │                          │
│                    │ - fileIndex                 │                          │
│                    │ - syncStatus                │                          │
│                    └─────────────────────────────┘                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ IPC Bridge
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                               MAIN PROCESS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────┐    ┌─────────────────────────────┐            │
│  │   FileIndexerService    │    │    FileWatcherService       │            │
│  ├─────────────────────────┤    ├─────────────────────────────┤            │
│  │ - crawlDirectory()      │    │ - watch() (chokidar)        │            │
│  │ - getIgnorePatterns()   │    │ - on('add', 'unlink', ...)  │            │
│  │ - normalizeFileName()   │    │                             │            │
│  └─────────────────────────┘    └─────────────────────────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ File System
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FILE SYSTEM                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  ~/Projects/my-project/                                                     │
│  ├── src/                                                                   │
│  ├── docs/                                                                  │
│  └── node_modules/ (ignored)                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. User adds folder path in Settings Panel
                    │
                    ▼
2. Path saved to IndexedDB (projectFolders table)
                    │
                    ▼
3. FileIndexerService crawls directory (main process)
   - Applies language-specific ignore patterns
   - Extracts file metadata
                    │
                    ▼
4. Index stored in IndexedDB (fileIndex table)
   - fileName, normalizedName (no diacritics), fullPath
                    │
                    ▼
5. FileWatcherService starts watching folder
   - Events: add, unlink, rename
                    │
                    ▼
6. User types ^ or @ in editor
                    │
                    ▼
7. FilePathProvider searches IndexedDB
   - Diacritics-insensitive search on normalizedName
   - Returns matching file paths as suggestions
```

### Key Design Decisions

1. **Local-Only Storage**: Folder paths are stored per-machine in IndexedDB, not synced to cloud, as paths differ across machines.

2. **Background Indexing**: Initial indexing happens on app startup in a non-blocking manner with progress reporting.

3. **Incremental Updates**: File watcher updates index incrementally (add/remove) rather than full re-index.

4. **Diacritics-Insensitive Search**: File names are normalized (NFD decomposition + diacritics removal) for better search experience.

5. **Language-Aware Ignore Patterns**: Different project types (Node.js, Python, Java, etc.) have different ignore patterns.

6. **Cancellable Operations**: All long-running operations can be cancelled by the user.

### Ignore Patterns by Language

```typescript
const IGNORE_PATTERNS = {
  // Common patterns for all projects
  common: [
    '**/node_modules/**',
    '**/.git/**',
    '**/.svn/**',
    '**/.hg/**',
    '**/CVS/**',
    '**/.DS_Store',
    '**/Thumbs.db',
    '**/*.log',
    '**/.env*',
    '**/dist/**',
    '**/build/**',
    '**/out/**',
    '**/.cache/**',
    '**/coverage/**',
    '**/.nyc_output/**',
    '**/*.min.js',
    '**/*.min.css',
    '**/*.map',
  ],

  // JavaScript/TypeScript (Node.js)
  javascript: [
    '**/bower_components/**',
    '**/.npm/**',
    '**/.yarn/**',
    '**/jspm_packages/**',
    '**/.pnp.*',
  ],

  // Python
  python: [
    '**/__pycache__/**',
    '**/*.pyc',
    '**/*.pyo',
    '**/*.pyd',
    '**/.Python/**',
    '**/env/**',
    '**/venv/**',
    '**/.venv/**',
    '**/pip-wheel-metadata/**',
    '**/*.egg-info/**',
    '**/.eggs/**',
    '**/.mypy_cache/**',
    '**/.pytest_cache/**',
    '**/.tox/**',
  ],

  // Java/Kotlin
  java: [
    '**/target/**',
    '**/*.class',
    '**/*.jar',
    '**/*.war',
    '**/*.ear',
    '**/.gradle/**',
    '**/gradle/**',
    '**/.idea/**',
    '**/*.iml',
  ],

  // Go
  go: ['**/vendor/**', '**/*.exe', '**/*.dll', '**/*.so', '**/*.dylib'],

  // Rust
  rust: ['**/target/**', '**/*.rlib', '**/*.rmeta', '**/Cargo.lock'],

  // C/C++
  cpp: [
    '**/*.o',
    '**/*.obj',
    '**/*.a',
    '**/*.lib',
    '**/*.dll',
    '**/*.so',
    '**/*.dylib',
    '**/cmake-build-*/**',
    '**/.cmake/**',
  ],

  // .NET
  dotnet: [
    '**/bin/**',
    '**/obj/**',
    '**/*.dll',
    '**/*.exe',
    '**/*.pdb',
    '**/packages/**',
    '**/.vs/**',
  ],

  // Ruby
  ruby: ['**/vendor/bundle/**', '**/.bundle/**', '**/*.gem'],

  // PHP
  php: ['**/vendor/**', '**/composer.phar'],
};
```

### IndexedDB Schema Extensions

```typescript
// New table: projectFolders
interface IProjectFolder {
  id: string; // UUID
  projectPath: string; // Project root (e.g., ~/.myndprompt/prompts/my-project)
  folderPath: string; // External folder path (e.g., ~/Projects/my-app)
  addedAt: Date;
  lastIndexedAt: Date | null;
  fileCount: number;
  status: 'pending' | 'indexing' | 'indexed' | 'error';
  errorMessage?: string;
}

// New table: fileIndex
interface IFileIndexEntry {
  id: string; // UUID
  projectFolderId: string; // FK to projectFolders
  fileName: string; // Original file name
  normalizedName: string; // Diacritics-removed, lowercase
  fullPath: string; // Absolute path
  relativePath: string; // Path relative to project folder
  extension: string;
  size: number;
  modifiedAt: Date;
  indexedAt: Date;
}
```

---

## Implementation Todos

- [ ] **Task 1**: Create IndexedDB schema extensions for projectFolders and fileIndex tables
- [ ] **Task 2**: Implement FileIndexerService in Electron main process
- [ ] **Task 3**: Add IPC handlers for file indexing operations
- [ ] **Task 4**: Create fileSyncStore Pinia store for state management
- [ ] **Task 5**: Implement folder management UI in Settings Panel
- [ ] **Task 6**: Add sync progress indicator to StatusBar/Footer
- [ ] **Task 7**: Integrate file watcher for real-time index updates
- [ ] **Task 8**: Implement FilePathProvider for Monaco editor suggestions
- [ ] **Task 9**: Add ^ trigger support alongside @ for file path suggestions
- [ ] **Task 10**: Add File Sync shortcut help to Snippets Panel
- [ ] **Task 11**: Implement background indexing on app startup
- [ ] **Task 12**: Add localization for all new UI strings (10 languages)

---

## Task 1: IndexedDB Schema Extensions

### Purpose

Extend the existing IndexedDB schema to store project folder configurations and file index data locally.

### Objective

- Add `projectFolders` table to store user-configured external folder paths per project
- Add `fileIndex` table to store indexed file metadata for fast searching
- Create repository classes following existing patterns

### Architecture Description

The schema extends the existing Dexie database with two new tables:

1. **projectFolders**: Stores the relationship between MyndPrompts projects and external folders
   - Primary key: `id` (UUID)
   - Indexes: `projectPath`, `folderPath`, `[projectPath+folderPath]` (compound unique)

2. **fileIndex**: Stores indexed file metadata for autocomplete
   - Primary key: `id` (UUID)
   - Indexes: `projectFolderId`, `normalizedName`, `fullPath`, `[projectFolderId+fullPath]`

### Files to Modify/Create

- `src/services/storage/entities.ts` - Add new interfaces
- `src/services/storage/db.ts` - Add new tables and version migration
- `src/services/storage/repositories/project-folder.repository.ts` - New file
- `src/services/storage/repositories/file-index.repository.ts` - New file
- `src/services/storage/repositories/index.ts` - Export new repositories

### Full Implementation Prompt

````
You are implementing Task 1 of the File Sync feature for MyndPrompts.

## Context
MyndPrompts uses Dexie (IndexedDB wrapper) for local storage. The current schema is in:
- `/Users/augustopissarra/dev/myndprompts/gits/myndprompts/src/services/storage/entities.ts`
- `/Users/augustopissarra/dev/myndprompts/gits/myndprompts/src/services/storage/db.ts`
- `/Users/augustopissarra/dev/myndprompts/gits/myndprompts/src/services/storage/repositories/`

## Task
1. Add these interfaces to `entities.ts`:

```typescript
export interface IProjectFolder {
  id: string;
  projectPath: string;
  folderPath: string;
  addedAt: Date;
  lastIndexedAt: Date | null;
  fileCount: number;
  status: 'pending' | 'indexing' | 'indexed' | 'error';
  errorMessage?: string;
}

export interface IFileIndexEntry {
  id: string;
  projectFolderId: string;
  fileName: string;
  normalizedName: string;
  fullPath: string;
  relativePath: string;
  extension: string;
  size: number;
  modifiedAt: Date;
  indexedAt: Date;
}
````

2. Update `db.ts`:
   - Increment version to 3
   - Add tables: `projectFolders` and `fileIndex`
   - Schema for projectFolders: `'&id, projectPath, folderPath, [projectPath+folderPath], status'`
   - Schema for fileIndex: `'&id, projectFolderId, normalizedName, fullPath, [projectFolderId+fullPath], extension'`
   - Add date hooks for new tables

3. Create `project-folder.repository.ts`:
   - Extend BaseRepository<IProjectFolder, string>
   - Methods:
     - `getByProjectPath(projectPath: string): Promise<IProjectFolder[]>`
     - `addFolder(projectPath: string, folderPath: string): Promise<IProjectFolder>`
     - `removeFolder(id: string): Promise<void>`
     - `updateStatus(id: string, status: IProjectFolder['status'], errorMessage?: string): Promise<void>`
     - `updateIndexStats(id: string, fileCount: number): Promise<void>`

4. Create `file-index.repository.ts`:
   - Extend BaseRepository<IFileIndexEntry, string>
   - Methods:
     - `getByProjectFolder(projectFolderId: string): Promise<IFileIndexEntry[]>`
     - `searchByName(projectFolderId: string, query: string): Promise<IFileIndexEntry[]>` - searches normalizedName
     - `addEntries(entries: IFileIndexEntry[]): Promise<void>` - bulk insert
     - `removeByProjectFolder(projectFolderId: string): Promise<void>` - bulk delete
     - `removeByPath(fullPath: string): Promise<void>`
     - `upsertEntry(entry: IFileIndexEntry): Promise<void>`

5. Export new repositories in `index.ts`

Follow the existing repository patterns exactly. Use singleton getInstance() pattern.

```

---

## Task 2: FileIndexerService Implementation

### Purpose
Create a service in the Electron main process that crawls directories and extracts file metadata while respecting language-specific ignore patterns.

### Objective
- Implement recursive directory crawling with configurable depth
- Apply smart ignore patterns based on detected project type
- Normalize file names for diacritics-insensitive search
- Support progress reporting and cancellation
- Handle large directories efficiently with batching

### Architecture Description

The FileIndexerService runs in the main process and:
1. Detects project type by looking for marker files (package.json, requirements.txt, etc.)
2. Combines common + language-specific ignore patterns
3. Uses `fast-glob` or recursive `fs.readdir` for file discovery
4. Normalizes names using NFD decomposition
5. Reports progress via IPC events
6. Supports AbortController for cancellation

### Files to Create

- `src/electron/main/services/file-indexer.service.ts`

### Full Implementation Prompt

```

You are implementing Task 2 of the File Sync feature for MyndPrompts.

## Context

The Electron main process is at `/Users/augustopissarra/dev/myndprompts/gits/myndprompts/src/electron/main/`.
Existing services like FileWatcherService are in `/src/electron/main/services/`.

## Task

Create `file-indexer.service.ts` with the following implementation:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { BrowserWindow } from 'electron';

// Type for indexed file
interface IIndexedFile {
  fileName: string;
  normalizedName: string;
  fullPath: string;
  relativePath: string;
  extension: string;
  size: number;
  modifiedAt: Date;
}

// Progress callback type
interface IIndexProgress {
  phase: 'scanning' | 'indexing' | 'complete' | 'cancelled' | 'error';
  current: number;
  total: number;
  currentFile?: string;
  error?: string;
}

class FileIndexerService {
  private static instance: FileIndexerService;
  private abortControllers: Map<string, AbortController> = new Map();

  // Ignore patterns by project type (include the full IGNORE_PATTERNS object from architecture section)
  private readonly IGNORE_PATTERNS = {
    common: [...],
    javascript: [...],
    python: [...],
    // ... etc
  };

  private constructor() {}

  public static getInstance(): FileIndexerService {
    if (!FileIndexerService.instance) {
      FileIndexerService.instance = new FileIndexerService();
    }
    return FileIndexerService.instance;
  }

  // Detect project type from marker files
  private async detectProjectType(folderPath: string): Promise<string[]> {
    const types: string[] = [];
    const markers = {
      javascript: ['package.json', 'yarn.lock', 'pnpm-lock.yaml'],
      python: ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'],
      java: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
      go: ['go.mod', 'go.sum'],
      rust: ['Cargo.toml'],
      cpp: ['CMakeLists.txt', 'Makefile', '*.vcxproj'],
      dotnet: ['*.csproj', '*.sln', '*.fsproj'],
      ruby: ['Gemfile', '*.gemspec'],
      php: ['composer.json'],
    };

    // Check for marker files and add detected types
    // Return array of detected types
  }

  // Build ignore patterns based on detected project types
  private buildIgnorePatterns(projectTypes: string[]): string[] {
    const patterns = [...this.IGNORE_PATTERNS.common];
    for (const type of projectTypes) {
      if (this.IGNORE_PATTERNS[type]) {
        patterns.push(...this.IGNORE_PATTERNS[type]);
      }
    }
    return patterns;
  }

  // Normalize file name for diacritics-insensitive search
  private normalizeFileName(fileName: string): string {
    return fileName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  // Check if path matches any ignore pattern
  private shouldIgnore(filePath: string, patterns: string[]): boolean {
    // Use minimatch or picomatch for glob pattern matching
  }

  // Crawl directory recursively
  public async indexDirectory(
    folderPath: string,
    operationId: string,
    onProgress?: (progress: IIndexProgress) => void
  ): Promise<IIndexedFile[]> {
    const abortController = new AbortController();
    this.abortControllers.set(operationId, abortController);

    try {
      // 1. Detect project type
      const projectTypes = await this.detectProjectType(folderPath);
      const ignorePatterns = this.buildIgnorePatterns(projectTypes);

      // 2. Scan for files
      const files: IIndexedFile[] = [];
      await this.crawlDirectory(
        folderPath,
        folderPath,
        ignorePatterns,
        files,
        abortController.signal,
        onProgress
      );

      // 3. Report completion
      onProgress?.({
        phase: 'complete',
        current: files.length,
        total: files.length,
      });

      return files;
    } catch (error) {
      if (error.name === 'AbortError') {
        onProgress?.({ phase: 'cancelled', current: 0, total: 0 });
        return [];
      }
      throw error;
    } finally {
      this.abortControllers.delete(operationId);
    }
  }

  // Recursive crawl helper
  private async crawlDirectory(
    currentPath: string,
    rootPath: string,
    ignorePatterns: string[],
    results: IIndexedFile[],
    signal: AbortSignal,
    onProgress?: (progress: IIndexProgress) => void
  ): Promise<void> {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(rootPath, fullPath);

      if (this.shouldIgnore(relativePath, ignorePatterns)) continue;

      if (entry.isDirectory()) {
        await this.crawlDirectory(fullPath, rootPath, ignorePatterns, results, signal, onProgress);
      } else if (entry.isFile()) {
        const stats = await fs.stat(fullPath);
        results.push({
          fileName: entry.name,
          normalizedName: this.normalizeFileName(entry.name),
          fullPath,
          relativePath,
          extension: path.extname(entry.name).toLowerCase(),
          size: stats.size,
          modifiedAt: stats.mtime,
        });

        onProgress?.({
          phase: 'indexing',
          current: results.length,
          total: -1, // Unknown total during scan
          currentFile: relativePath,
        });
      }
    }
  }

  // Cancel an indexing operation
  public cancelIndexing(operationId: string): boolean {
    const controller = this.abortControllers.get(operationId);
    if (controller) {
      controller.abort();
      return true;
    }
    return false;
  }
}

export const getFileIndexerService = () => FileIndexerService.getInstance();
```

Include the full IGNORE_PATTERNS object from the architecture section.
Use `picomatch` for glob pattern matching (add to dependencies if needed).

```

---

## Task 3: IPC Handlers for File Indexing

### Purpose
Create IPC handlers to expose file indexing functionality to the renderer process.

### Objective
- Add IPC handlers for: startIndexing, cancelIndexing, getIndexStatus
- Implement progress events via IPC
- Add preload bridge methods

### Architecture Description

IPC communication flow:
1. Renderer calls `fileSystemAPI.startIndexing(folderPath)`
2. Main process starts FileIndexerService.indexDirectory()
3. Progress updates sent via `fs:index-progress` event
4. Renderer receives results via IPC response

### Files to Modify/Create

- `src/electron/main/index.ts` - Add IPC handlers
- `src/electron/preload/index.ts` - Add preload bridge methods

### Full Implementation Prompt

```

You are implementing Task 3 of the File Sync feature for MyndPrompts.

## Context

- Main process IPC handlers are in `/Users/augustopissarra/dev/myndprompts/gits/myndprompts/src/electron/main/index.ts`
- Preload bridge is in `/Users/augustopissarra/dev/myndprompts/gits/myndprompts/src/electron/preload/index.ts`
- FileIndexerService is in `/src/electron/main/services/file-indexer.service.ts`

## Task

1. Add these IPC handlers to `index.ts`:

```typescript
// Import
import { getFileIndexerService } from './services/file-indexer.service';

// Handlers
ipcMain.handle('fs:start-indexing', async (event, folderPath: string, operationId: string) => {
  const indexer = getFileIndexerService();
  const window = BrowserWindow.fromWebContents(event.sender);

  const files = await indexer.indexDirectory(folderPath, operationId, (progress) => {
    window?.webContents.send('fs:index-progress', { operationId, ...progress });
  });

  return files;
});

ipcMain.handle('fs:cancel-indexing', async (_, operationId: string) => {
  const indexer = getFileIndexerService();
  return indexer.cancelIndexing(operationId);
});
```

2. Extend preload bridge in `index.ts`:

```typescript
// Add to fileSystemAPI object
startIndexing: (folderPath: string, operationId: string) =>
  ipcRenderer.invoke('fs:start-indexing', folderPath, operationId),

cancelIndexing: (operationId: string) =>
  ipcRenderer.invoke('fs:cancel-indexing', operationId),

onIndexProgress: (callback: (data: any) => void) => {
  const handler = (_: any, data: any) => callback(data);
  ipcRenderer.on('fs:index-progress', handler);
  return () => ipcRenderer.removeListener('fs:index-progress', handler);
},
```

3. Update TypeScript types for the preload API in the appropriate type definition file.

```

---

## Task 4: FileSyncStore Implementation

### Purpose
Create a Pinia store to manage file sync state, including folder configurations, indexing status, and search functionality.

### Objective
- Manage project folder configurations
- Track indexing progress and status
- Provide search functionality for indexed files
- Coordinate with repositories and IPC

### Architecture Description

The store acts as the central coordinator:
1. Loads folder configurations from IndexedDB on init
2. Triggers indexing operations via IPC
3. Updates local IndexedDB with indexed files
4. Provides reactive state for UI components
5. Handles file watcher events for incremental updates

### Files to Create

- `src/stores/fileSyncStore.ts`

### Full Implementation Prompt

```

You are implementing Task 4 of the File Sync feature for MyndPrompts.

## Context

- Existing stores are in `/Users/augustopissarra/dev/myndprompts/gits/myndprompts/src/stores/`
- Repositories are in `/src/services/storage/repositories/`
- Follow the pattern from `promptStore.ts` or `snippetStore.ts`

## Task

Create `fileSyncStore.ts`:

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getProjectFolderRepository } from '@/services/storage/repositories/project-folder.repository';
import { getFileIndexRepository } from '@/services/storage/repositories/file-index.repository';
import type { IProjectFolder, IFileIndexEntry } from '@/services/storage/entities';

interface IIndexingOperation {
  operationId: string;
  folderId: string;
  progress: number;
  phase: 'scanning' | 'indexing' | 'complete' | 'cancelled' | 'error';
  currentFile?: string;
  error?: string;
}

export const useFileSyncStore = defineStore('fileSync', () => {
  // State
  const isInitialized = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const projectFolders = ref<IProjectFolder[]>([]);
  const activeIndexingOperations = ref<Map<string, IIndexingOperation>>(new Map());
  const fileIndexCache = ref<Map<string, IFileIndexEntry[]>>(new Map());

  // Computed
  const hasActiveIndexing = computed(() => activeIndexingOperations.value.size > 0);

  const syncStatus = computed(() => {
    const total = projectFolders.value.length;
    const indexed = projectFolders.value.filter((f) => f.status === 'indexed').length;
    const pending = projectFolders.value.filter((f) => f.status === 'pending').length;
    const indexing = projectFolders.value.filter((f) => f.status === 'indexing').length;
    const errors = projectFolders.value.filter((f) => f.status === 'error').length;
    return {
      total,
      indexed,
      pending,
      indexing,
      errors,
      isUpToDate: indexed === total && errors === 0,
    };
  });

  // Actions
  async function initialize(): Promise<void> {
    if (isInitialized.value) return;
    isLoading.value = true;
    try {
      const repo = getProjectFolderRepository();
      projectFolders.value = await repo.getAll();

      // Set up progress listener
      if (window.fileSystemAPI?.onIndexProgress) {
        window.fileSystemAPI.onIndexProgress(handleIndexProgress);
      }

      isInitialized.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to initialize';
    } finally {
      isLoading.value = false;
    }
  }

  async function addFolder(
    projectPath: string,
    folderPath: string
  ): Promise<IProjectFolder | null> {
    try {
      const repo = getProjectFolderRepository();
      const folder = await repo.addFolder(projectPath, folderPath);
      projectFolders.value.push(folder);
      return folder;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to add folder';
      return null;
    }
  }

  async function removeFolder(folderId: string): Promise<void> {
    try {
      const folderRepo = getProjectFolderRepository();
      const indexRepo = getFileIndexRepository();

      await indexRepo.removeByProjectFolder(folderId);
      await folderRepo.removeFolder(folderId);

      projectFolders.value = projectFolders.value.filter((f) => f.id !== folderId);
      fileIndexCache.value.delete(folderId);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to remove folder';
    }
  }

  async function startIndexing(folderId: string): Promise<void> {
    const folder = projectFolders.value.find((f) => f.id === folderId);
    if (!folder) return;

    const operationId = crypto.randomUUID();
    activeIndexingOperations.value.set(operationId, {
      operationId,
      folderId,
      progress: 0,
      phase: 'scanning',
    });

    try {
      // Update status
      const folderRepo = getProjectFolderRepository();
      await folderRepo.updateStatus(folderId, 'indexing');
      folder.status = 'indexing';

      // Start indexing
      const files = await window.fileSystemAPI.startIndexing(folder.folderPath, operationId);

      // Save to IndexedDB
      const indexRepo = getFileIndexRepository();
      await indexRepo.removeByProjectFolder(folderId);

      const entries: IFileIndexEntry[] = files.map((f) => ({
        id: crypto.randomUUID(),
        projectFolderId: folderId,
        ...f,
        indexedAt: new Date(),
      }));

      await indexRepo.addEntries(entries);
      await folderRepo.updateIndexStats(folderId, entries.length);
      await folderRepo.updateStatus(folderId, 'indexed');

      folder.status = 'indexed';
      folder.fileCount = entries.length;
      folder.lastIndexedAt = new Date();

      fileIndexCache.value.set(folderId, entries);
    } catch (err) {
      const folderRepo = getProjectFolderRepository();
      const errorMsg = err instanceof Error ? err.message : 'Indexing failed';
      await folderRepo.updateStatus(folderId, 'error', errorMsg);
      folder.status = 'error';
      folder.errorMessage = errorMsg;
    } finally {
      activeIndexingOperations.value.delete(operationId);
    }
  }

  async function cancelIndexing(operationId: string): Promise<void> {
    await window.fileSystemAPI.cancelIndexing(operationId);
  }

  function handleIndexProgress(data: any): void {
    const operation = activeIndexingOperations.value.get(data.operationId);
    if (operation) {
      operation.phase = data.phase;
      operation.progress = data.current;
      operation.currentFile = data.currentFile;
      if (data.error) operation.error = data.error;
    }
  }

  async function searchFiles(query: string, projectPath?: string): Promise<IFileIndexEntry[]> {
    const indexRepo = getFileIndexRepository();
    const normalizedQuery = query
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    let results: IFileIndexEntry[] = [];

    const foldersToSearch = projectPath
      ? projectFolders.value.filter((f) => f.projectPath === projectPath)
      : projectFolders.value;

    for (const folder of foldersToSearch) {
      const folderResults = await indexRepo.searchByName(folder.id, normalizedQuery);
      results.push(...folderResults);
    }

    // Sort by relevance (exact match first, then starts with, then contains)
    results.sort((a, b) => {
      const aExact = a.normalizedName === normalizedQuery;
      const bExact = b.normalizedName === normalizedQuery;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      const aStarts = a.normalizedName.startsWith(normalizedQuery);
      const bStarts = b.normalizedName.startsWith(normalizedQuery);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      return a.fileName.localeCompare(b.fileName);
    });

    return results.slice(0, 50); // Limit results
  }

  async function startBackgroundIndexing(): Promise<void> {
    const pendingFolders = projectFolders.value.filter(
      (f) => f.status === 'pending' || f.status === 'error'
    );

    for (const folder of pendingFolders) {
      await startIndexing(folder.id);
    }
  }

  return {
    // State
    isInitialized,
    isLoading,
    error,
    projectFolders,
    activeIndexingOperations,

    // Computed
    hasActiveIndexing,
    syncStatus,

    // Actions
    initialize,
    addFolder,
    removeFolder,
    startIndexing,
    cancelIndexing,
    searchFiles,
    startBackgroundIndexing,
  };
});
```

```

---

## Task 5: Settings Panel UI for Folder Management

### Purpose
Add a "File Sync" section to the Settings Panel for managing project folders.

### Objective
- Display configured folders with status
- Allow adding/removing folders
- Show sync progress and status
- Provide manual sync button

### Architecture Description

The UI extends SettingsPanel.vue with a new collapsible section:
- List of configured folders with status badges
- Add folder button (opens directory picker)
- Remove folder button per entry
- Progress bar during indexing
- "Sync Now" button when not up to date

### Files to Modify/Create

- `src/components/layout/sidebar/SettingsPanel.vue` - Add File Sync section
- `src/components/settings/FileSyncSection.vue` - New component

### Full Implementation Prompt

```

You are implementing Task 5 of the File Sync feature for MyndPrompts.

## Context

- SettingsPanel is at `/Users/augustopissarra/dev/myndprompts/gits/myndprompts/src/components/layout/sidebar/SettingsPanel.vue`
- Settings components are in `/src/components/settings/`
- Use Quasar components (q-list, q-item, q-btn, q-linear-progress, q-badge)
- Use the fileSyncStore for state

## Task

1. Create `FileSyncSection.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFileSyncStore } from '@/stores/fileSyncStore';
import { useProjectStore } from '@/stores/projectStore';

const { t } = useI18n({ useScope: 'global' });
const fileSyncStore = useFileSyncStore();
const projectStore = useProjectStore();

// Get current project path
const currentProjectPath = computed(() => {
  // Determine current project context
  return projectStore.currentProject?.folderPath ?? null;
});

const folders = computed(() => {
  if (!currentProjectPath.value) return [];
  return fileSyncStore.projectFolders.filter((f) => f.projectPath === currentProjectPath.value);
});

const syncStatus = computed(() => fileSyncStore.syncStatus);
const hasActiveIndexing = computed(() => fileSyncStore.hasActiveIndexing);

async function addFolder(): Promise<void> {
  if (!currentProjectPath.value) return;

  const result = await window.electronAPI.openDialog({
    properties: ['openDirectory'],
    title: t('fileSync.selectFolder'),
  });

  if (!result.canceled && result.filePaths[0]) {
    await fileSyncStore.addFolder(currentProjectPath.value, result.filePaths[0]);
    await fileSyncStore.startIndexing(
      fileSyncStore.projectFolders[fileSyncStore.projectFolders.length - 1].id
    );
  }
}

async function removeFolder(folderId: string): Promise<void> {
  await fileSyncStore.removeFolder(folderId);
}

async function syncAll(): Promise<void> {
  for (const folder of folders.value) {
    if (folder.status !== 'indexing') {
      await fileSyncStore.startIndexing(folder.id);
    }
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'indexed':
      return 'positive';
    case 'indexing':
      return 'warning';
    case 'error':
      return 'negative';
    default:
      return 'grey';
  }
}

function getStatusLabel(status: string): string {
  return t(`fileSync.status.${status}`);
}
</script>

<template>
  <div class="file-sync-section">
    <!-- Status summary -->
    <div class="file-sync-section__status">
      <q-badge
        :color="syncStatus.isUpToDate ? 'positive' : 'warning'"
        :label="syncStatus.isUpToDate ? t('fileSync.upToDate') : t('fileSync.needsSync')"
      />
      <span class="text-caption text-grey">
        {{ t('fileSync.folderCount', { count: folders.length }) }}
      </span>
    </div>

    <!-- Progress bar when indexing -->
    <q-linear-progress
      v-if="hasActiveIndexing"
      indeterminate
      color="primary"
      class="q-my-sm"
    />

    <!-- Folder list -->
    <q-list
      dense
      class="file-sync-section__list"
    >
      <q-item
        v-for="folder in folders"
        :key="folder.id"
        class="file-sync-section__item"
      >
        <q-item-section avatar>
          <q-icon name="folder" />
        </q-item-section>

        <q-item-section>
          <q-item-label>{{ folder.folderPath }}</q-item-label>
          <q-item-label caption>
            {{ t('fileSync.fileCount', { count: folder.fileCount }) }}
          </q-item-label>
        </q-item-section>

        <q-item-section side>
          <div class="row items-center q-gutter-xs">
            <q-badge
              :color="getStatusColor(folder.status)"
              :label="getStatusLabel(folder.status)"
            />
            <q-btn
              flat
              dense
              round
              size="sm"
              icon="delete"
              color="negative"
              @click="removeFolder(folder.id)"
            >
              <q-tooltip>{{ t('common.remove') }}</q-tooltip>
            </q-btn>
          </div>
        </q-item-section>
      </q-item>
    </q-list>

    <!-- Actions -->
    <div class="file-sync-section__actions">
      <q-btn
        flat
        dense
        no-caps
        icon="add"
        :label="t('fileSync.addFolder')"
        @click="addFolder"
      />
      <q-btn
        v-if="!syncStatus.isUpToDate"
        flat
        dense
        no-caps
        icon="sync"
        :label="t('fileSync.syncNow')"
        :loading="hasActiveIndexing"
        @click="syncAll"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.file-sync-section {
  padding: 8px 0;

  &__status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px 8px;
  }

  &__list {
    max-height: 200px;
    overflow-y: auto;
  }

  &__item {
    border-radius: 4px;

    &:hover {
      background-color: var(--item-hover-bg, #2a2d2e);
    }
  }

  &__actions {
    display: flex;
    gap: 8px;
    padding: 8px;
    border-top: 1px solid var(--border-color, #3c3c3c);
  }
}
</style>
```

2. Add the section to SettingsPanel.vue:
   - Add 'fileSync' to settingsSections computed array with id, label, icon
   - Import and use FileSyncSection component
   - Add conditional rendering similar to categories section

```

---

## Task 6: StatusBar Progress Indicator

### Purpose
Add a sync progress indicator to the application footer/status bar.

### Objective
- Show indexing progress when active
- Allow cancellation from status bar
- Subtle indicator when idle

### Files to Modify

- `src/components/layout/StatusBar.vue` - Add sync indicator

### Full Implementation Prompt

```

You are implementing Task 6 of the File Sync feature for MyndPrompts.

## Context

- StatusBar is at `/Users/augustopissarra/dev/myndprompts/gits/myndprompts/src/components/layout/StatusBar.vue`
- Use fileSyncStore for state

## Task

Add a sync progress indicator to StatusBar.vue:

1. Import and use fileSyncStore
2. Add a new section to the status bar that shows:
   - When idle and up to date: Small cloud-check icon (subtle)
   - When indexing: Spinning sync icon + "Indexing..." text + progress + cancel button
   - When has errors: Warning icon with error count

```vue
<!-- Add to StatusBar template -->
<div class="status-bar__sync">
  <!-- Up to date -->
  <q-icon
    v-if="fileSyncStore.syncStatus.isUpToDate && !fileSyncStore.hasActiveIndexing"
    name="cloud_done"
    size="14px"
    class="text-positive"
  >
    <q-tooltip>{{ t('fileSync.upToDate') }}</q-tooltip>
  </q-icon>

  <!-- Indexing -->
  <div
    v-else-if="fileSyncStore.hasActiveIndexing"
    class="status-bar__sync-progress"
  >
    <q-spinner-ios size="12px" color="primary" />
    <span class="text-caption">{{ t('fileSync.indexing') }}</span>
    <q-btn
      flat
      dense
      round
      size="xs"
      icon="close"
      @click="cancelAllIndexing"
    >
      <q-tooltip>{{ t('common.cancel') }}</q-tooltip>
    </q-btn>
  </div>

  <!-- Has errors -->
  <q-icon
    v-else-if="fileSyncStore.syncStatus.errors > 0"
    name="warning"
    size="14px"
    class="text-warning"
  >
    <q-tooltip>{{ t('fileSync.hasErrors', { count: fileSyncStore.syncStatus.errors }) }}</q-tooltip>
  </q-icon>
</div>
```

Add styling for the sync section.

```

---

## Task 7: File Watcher Integration

### Purpose
Integrate file watching to keep the index updated in real-time when files are added, removed, or renamed.

### Objective
- Watch all indexed folders for changes
- Update index incrementally (not full re-index)
- Handle rename detection

### Files to Modify

- `src/stores/fileSyncStore.ts` - Add watcher management
- `src/electron/main/index.ts` - Ensure watcher events are properly emitted

### Full Implementation Prompt

```

You are implementing Task 7 of the File Sync feature for MyndPrompts.

## Context

- FileWatcherService exists at `/src/electron/main/services/file-watcher.service.ts`
- The `fs:file-change` IPC event is already implemented
- preload bridge has `watchPath` and `unwatchPath` methods

## Task

1. Extend fileSyncStore to manage file watchers:

```typescript
// Add to fileSyncStore.ts
const activeWatchers = ref<Map<string, string>>(new Map()); // folderId -> watcherId

async function startWatching(folderId: string): Promise<void> {
  const folder = projectFolders.value.find((f) => f.id === folderId);
  if (!folder || activeWatchers.value.has(folderId)) return;

  const watcherId = await window.fileSystemAPI.watchPath(folder.folderPath, {
    persistent: true,
    ignoreInitial: true,
    depth: 99,
  });

  activeWatchers.value.set(folderId, watcherId);
}

async function stopWatching(folderId: string): Promise<void> {
  const watcherId = activeWatchers.value.get(folderId);
  if (watcherId) {
    await window.fileSystemAPI.unwatchPath(watcherId);
    activeWatchers.value.delete(folderId);
  }
}

function handleFileChange(event: { type: string; path: string }): void {
  // Find which folder this file belongs to
  const folder = projectFolders.value.find((f) => event.path.startsWith(f.folderPath));
  if (!folder) return;

  const indexRepo = getFileIndexRepository();

  switch (event.type) {
    case 'add':
      // Add new file to index
      indexRepo.upsertEntry({
        id: crypto.randomUUID(),
        projectFolderId: folder.id,
        fileName: path.basename(event.path),
        normalizedName: normalizeFileName(path.basename(event.path)),
        fullPath: event.path,
        relativePath: path.relative(folder.folderPath, event.path),
        extension: path.extname(event.path).toLowerCase(),
        size: 0, // Would need to fetch
        modifiedAt: new Date(),
        indexedAt: new Date(),
      });
      break;

    case 'unlink':
      // Remove file from index
      indexRepo.removeByPath(event.path);
      break;

    case 'change':
      // Update modified time
      // Could re-index if needed
      break;
  }
}
```

2. Set up file change listener in initialize():

```typescript
if (window.fileSystemAPI?.onFileChange) {
  window.fileSystemAPI.onFileChange(handleFileChange);
}
```

3. Start watchers after indexing completes in startIndexing().

```

---

## Task 8: FilePathProvider for Monaco Editor

### Purpose
Create a completion provider for Monaco editor that suggests file paths when typing `^` or `@`.

### Objective
- Register completion provider for `^` trigger character
- Search indexed files using diacritics-insensitive matching
- Show file path suggestions with icons

### Files to Create/Modify

- `src/components/editor/file-path-provider.ts` - New file
- `src/components/editor/EditorPane.vue` - Register provider

### Full Implementation Prompt

```

You are implementing Task 8 of the File Sync feature for MyndPrompts.

## Context

- Existing snippet provider is at `/src/components/editor/snippet-provider.ts`
- Editor setup is in `/src/components/editor/EditorPane.vue`
- Use monaco-editor completion provider pattern

## Task

1. Create `file-path-provider.ts`:

```typescript
import * as monaco from 'monaco-editor';
import { useFileSyncStore } from '@/stores/fileSyncStore';
import type { IFileIndexEntry } from '@/services/storage/entities';

// File type icons
const FILE_ICONS: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'react',
  '.js': 'javascript',
  '.jsx': 'react',
  '.vue': 'vue',
  '.py': 'python',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.md': 'markdown',
  '.json': 'json',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'sass',
  // ... more extensions
};

function getFileIcon(extension: string): monaco.languages.CompletionItemKind {
  // Return appropriate icon kind
  return monaco.languages.CompletionItemKind.File;
}

export function createFilePathProvider(): monaco.languages.CompletionItemProvider {
  return {
    triggerCharacters: ['^'],

    async provideCompletionItems(
      model: monaco.editor.ITextModel,
      position: monaco.Position,
      context: monaco.languages.CompletionContext
    ): Promise<monaco.languages.CompletionList> {
      const fileSyncStore = useFileSyncStore();

      // Get text before cursor
      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      // Check if triggered by ^
      const match = textUntilPosition.match(/\^(\S*)$/);
      if (!match) {
        return { suggestions: [] };
      }

      const query = match[1];
      const files = await fileSyncStore.searchFiles(query);

      const word = model.getWordUntilPosition(position);
      const range: monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: position.column - match[0].length,
        endColumn: position.column,
      };

      const suggestions: monaco.languages.CompletionItem[] = files.map((file) => ({
        label: file.fileName,
        kind: getFileIcon(file.extension),
        insertText: file.fullPath,
        detail: file.relativePath,
        documentation: {
          value: `**Path:** ${file.fullPath}\n\n**Size:** ${formatFileSize(file.size)}\n\n**Modified:** ${file.modifiedAt.toLocaleDateString()}`,
        },
        range,
        sortText: file.normalizedName.startsWith(query.toLowerCase()) ? '0' : '1',
      }));

      return { suggestions };
    },
  };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

2. Register the provider in EditorPane.vue during editor initialization:

```typescript
import { createFilePathProvider } from './file-path-provider';

// In onMounted or editor setup
monaco.languages.registerCompletionItemProvider('markdown', createFilePathProvider());
```

```

---

## Task 9: Add ^ Trigger Alongside @ for File Suggestions

### Purpose
Extend the existing `@` trigger to also show file path suggestions alongside snippets.

### Objective
- When user types `@`, show both snippets AND file paths
- `^` is dedicated for file paths only
- Clearly distinguish between snippet and file suggestions

### Files to Modify

- `src/components/editor/snippet-provider.ts` - Extend to include file paths for `@` trigger

### Full Implementation Prompt

```

You are implementing Task 9 of the File Sync feature for MyndPrompts.

## Context

- Snippet provider is at `/src/components/editor/snippet-provider.ts`
- The `@` trigger already provides snippet suggestions
- Need to add file path suggestions to the same results

## Task

Modify `snippet-provider.ts` to include file path suggestions when `@` is typed:

1. Import fileSyncStore
2. When `@` is triggered, search both snippets AND files
3. Add file suggestions with a different sortText prefix so they appear after snippets
4. Use a visual indicator (icon or label) to distinguish file suggestions

```typescript
// In createUserSnippetsProvider

async provideCompletionItems(...) {
  // ... existing snippet logic

  // If triggered by @, also include file suggestions
  if (triggerChar === '@') {
    const fileSyncStore = useFileSyncStore();
    const files = await fileSyncStore.searchFiles(search || '');

    for (const file of files) {
      suggestions.push({
        label: {
          label: file.fileName,
          description: 'File',
        },
        kind: monaco.languages.CompletionItemKind.File,
        insertText: file.fullPath,
        detail: file.relativePath,
        documentation: `Insert path: ${file.fullPath}`,
        range,
        sortText: `2_${file.fileName}`, // After snippets (which start with 1_)
      });
    }
  }

  return { suggestions };
}
```

```

---

## Task 10: Snippets Panel Help for File Sync

### Purpose
Add keyboard shortcut documentation to the Snippets Panel for the new `^` trigger.

### Objective
- Update the help tooltip in Snippets Panel footer
- Document `^` for file paths

### Files to Modify

- `src/components/layout/sidebar/SnippetsPanel.vue`

### Full Implementation Prompt

```

You are implementing Task 10 of the File Sync feature for MyndPrompts.

## Context

- SnippetsPanel is at `/src/components/layout/sidebar/SnippetsPanel.vue`
- There's already a help tooltip in the footer explaining triggers

## Task

Update the help tooltip in SnippetsPanel.vue to include the `^` trigger:

```vue
<!-- Update the snippets-help section in the template -->
<div class="snippets-help__row">
  <kbd>^</kbd>
  <span>{{ t('snippetsPanel.triggerHelp.files') }}</span>
</div>
```

The existing help shows:

- `@` - All snippets
- `#` - Text snippets
- `$` - Code snippets
- `!` - Templates

Add:

- `^` - Project files

Update locale files to add:

```typescript
triggerHelp: {
  // ... existing
  files: 'Project files',
},
```

```

---

## Task 11: Background Indexing on Startup

### Purpose
Implement automatic background indexing when the application starts.

### Objective
- Check for pending/stale indexes on app boot
- Start indexing in background without blocking UI
- Show subtle progress indicator

### Files to Modify

- `src/boot/init.ts` or main app initialization
- `src/stores/fileSyncStore.ts` - Add startup indexing logic

### Full Implementation Prompt

```

You are implementing Task 11 of the File Sync feature for MyndPrompts.

## Context

- App initialization happens in boot files at `/src/boot/`
- The fileSyncStore has `startBackgroundIndexing()` method

## Task

1. Create or modify a boot file to initialize file sync on startup:

```typescript
// src/boot/file-sync.ts
import { boot } from 'quasar/wrappers';
import { useFileSyncStore } from '@/stores/fileSyncStore';

export default boot(async ({ app }) => {
  // Only run in Electron
  if (!window.fileSystemAPI) return;

  const fileSyncStore = useFileSyncStore();

  // Initialize store (loads folder configs from IndexedDB)
  await fileSyncStore.initialize();

  // Start background indexing after a short delay to not block initial render
  setTimeout(() => {
    fileSyncStore.startBackgroundIndexing();
  }, 2000);
});
```

2. Register the boot file in `quasar.config.ts`:

```typescript
boot: [
  'i18n',
  'init',
  'file-sync', // Add this
],
```

3. Update `startBackgroundIndexing()` in fileSyncStore to:
   - Process folders sequentially (not all at once)
   - Skip folders that are already up-to-date (indexed within last 24 hours?)
   - Re-index folders that have errors

```

---

## Task 12: Localization

### Purpose
Add translation keys for all new UI strings in all 10 supported languages.

### Objective
- Add `fileSync` section to all locale files
- Translate all new strings

### Files to Modify

- `src/i18n/en-US/index.ts`
- `src/i18n/en-GB/index.ts`
- `src/i18n/en-IE/index.ts`
- `src/i18n/pt-BR/index.ts`
- `src/i18n/pt-PT/index.ts`
- `src/i18n/es-ES/index.ts`
- `src/i18n/fr-FR/index.ts`
- `src/i18n/de-DE/index.ts`
- `src/i18n/it-IT/index.ts`
- `src/i18n/ar-SA/index.ts`

### Full Implementation Prompt

```

You are implementing Task 12 of the File Sync feature for MyndPrompts.

## Context

- Locale files are at `/src/i18n/{locale}/index.ts`
- Follow the existing structure and patterns

## Task

Add the following translations to ALL 10 locale files:

### English (en-US) - Base translations:

```typescript
// Add to the locale file
fileSync: {
  title: 'File Sync',
  selectFolder: 'Select Folder',
  addFolder: 'Add Folder',
  removeFolder: 'Remove Folder',
  syncNow: 'Sync Now',
  upToDate: 'Up to date',
  needsSync: 'Needs sync',
  indexing: 'Indexing...',
  folderCount: '{count} folder | {count} folders',
  fileCount: '{count} file | {count} files',
  hasErrors: '{count} error | {count} errors',
  status: {
    pending: 'Pending',
    indexing: 'Indexing',
    indexed: 'Indexed',
    error: 'Error',
  },
  cancelIndexing: 'Cancel indexing',
  noFolders: 'No folders configured',
  addFolderHint: 'Add external folders to enable file path suggestions',
},

// Also add to snippetsPanel.triggerHelp:
files: 'Project files',
```

### Translate to all other languages:

- en-GB, en-IE: Same as en-US (British spelling where applicable)
- pt-BR: Portuguese (Brazil)
- pt-PT: Portuguese (Portugal)
- es-ES: Spanish
- fr-FR: French
- de-DE: German
- it-IT: Italian
- ar-SA: Arabic

Important: Remember to escape `@` as `{'@'}` if used in any translation.

```

---

## Summary

This implementation plan provides a comprehensive approach to adding File Sync functionality to MyndPrompts. The feature consists of:

1. **Data Layer** (Tasks 1, 4): IndexedDB schema and Pinia store for state management
2. **Indexing Engine** (Tasks 2, 3, 7, 11): Main process service with file watching and background indexing
3. **User Interface** (Tasks 5, 6, 10): Settings panel, status bar, and help documentation
4. **Editor Integration** (Tasks 8, 9): Monaco completion providers for `^` and `@` triggers
5. **Localization** (Task 12): Full i18n support for 10 languages

Each task is self-contained with clear dependencies and can be implemented incrementally. The architecture leverages existing patterns in the codebase for consistency and maintainability.
```
