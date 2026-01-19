# File Sync Implementation Plan

## Overview

This document describes the implementation of the **File Sync** feature for MyndPrompts. This feature enables users to add external folder paths to projects, index all files within those folders, and provide intelligent file path suggestions in the editor when typing `^` or `@` triggers.

### Key Features

- **Local-only folder configuration**: Folder paths stored per-machine (not synced) since paths differ across machines
- **Multi-folder support**: Add multiple external folders per project
- **Real-time sync**: File watcher updates index when files are added, removed, or renamed
- **Background indexing**: Non-blocking indexing on app startup
- **Diacritics-insensitive search**: Search "cafe" matches "café"
- **Language-aware ignore patterns**: Automatically ignores node_modules, **pycache**, target/, etc.
- **Progress tracking**: StatusBar and Settings Panel show indexing progress with cancel option

---

## 1. Architecture

### 1.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              RENDERER PROCESS                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌───────────────────┐    ┌────────────────────┐    ┌───────────────────────┐  │
│  │   UI Components   │    │    Pinia Stores    │    │    Monaco Editor      │  │
│  ├───────────────────┤    ├────────────────────┤    ├───────────────────────┤  │
│  │ - SettingsPanel   │◄──►│ - fileSyncStore    │◄──►│ - FilePathProvider    │  │
│  │ - FileSyncSection │    │   (state mgmt)     │    │   (^ trigger)         │  │
│  │ - StatusBar       │    │ - projectStore     │    │ - SnippetProvider     │  │
│  │ - SnippetsPanel   │    │                    │    │   (@ trigger extended)│  │
│  └───────────────────┘    └─────────┬──────────┘    └───────────────────────┘  │
│                                     │                                           │
│                                     ▼                                           │
│                    ┌─────────────────────────────────────┐                      │
│                    │       IndexedDB (Dexie v3)          │                      │
│                    ├─────────────────────────────────────┤                      │
│                    │ Tables:                             │                      │
│                    │ - projectFolders (folder configs)   │                      │
│                    │ - fileIndex (indexed file metadata) │                      │
│                    │                                     │                      │
│                    │ Repositories:                       │                      │
│                    │ - ProjectFolderRepository           │                      │
│                    │ - FileIndexRepository               │                      │
│                    └─────────────────────────────────────┘                      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ IPC Bridge (contextBridge)
                                       │ - fs:start-indexing
                                       │ - fs:cancel-indexing
                                       │ - fs:index-progress (event)
                                       │ - fs:file-change (event)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               MAIN PROCESS (Electron)                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌───────────────────────────┐    ┌───────────────────────────────────┐        │
│  │   FileIndexerService      │    │      FileWatcherService           │        │
│  ├───────────────────────────┤    ├───────────────────────────────────┤        │
│  │ - detectProjectType()     │    │ - watch() via chokidar            │        │
│  │ - buildIgnorePatterns()   │    │ - Events: add, unlink, change     │        │
│  │ - normalizeFileName()     │    │ - Emits to renderer via IPC       │        │
│  │ - crawlDirectory()        │    │                                   │        │
│  │ - indexDirectory()        │    │                                   │        │
│  │ - cancelIndexing()        │    │                                   │        │
│  └───────────────────────────┘    └───────────────────────────────────┘        │
│                                                                                 │
│  Dependencies: picomatch (glob matching), fs/promises                          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ Node.js fs API
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FILE SYSTEM                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ~/Projects/my-app/                    (External folder added by user)          │
│  ├── src/                                                                       │
│  │   ├── components/                                                            │
│  │   │   ├── Button.tsx        ◄── Indexed                                     │
│  │   │   └── Modal.vue         ◄── Indexed                                     │
│  │   └── utils/                                                                 │
│  │       └── helpers.ts        ◄── Indexed                                     │
│  ├── docs/                                                                      │
│  │   └── README.md             ◄── Indexed                                     │
│  └── node_modules/             ◄── IGNORED (detected via package.json)         │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow Sequence

```
┌──────────┐     ┌─────────────┐     ┌────────────┐     ┌───────────────┐     ┌──────────┐
│   User   │     │SettingsPanel│     │fileSyncStore│    │FileIndexer    │     │ IndexedDB│
└────┬─────┘     └──────┬──────┘     └──────┬─────┘     └───────┬───────┘     └────┬─────┘
     │                  │                   │                   │                  │
     │ 1. Click "Add    │                   │                   │                  │
     │    Folder"       │                   │                   │                  │
     │─────────────────►│                   │                   │                  │
     │                  │                   │                   │                  │
     │                  │ 2. Open native    │                   │                  │
     │                  │    folder picker  │                   │                  │
     │◄─────────────────│                   │                   │                  │
     │                  │                   │                   │                  │
     │ 3. Select folder │                   │                   │                  │
     │─────────────────►│                   │                   │                  │
     │                  │                   │                   │                  │
     │                  │ 4. addFolder()    │                   │                  │
     │                  │──────────────────►│                   │                  │
     │                  │                   │                   │                  │
     │                  │                   │ 5. Save config    │                  │
     │                  │                   │──────────────────────────────────────►
     │                  │                   │                   │                  │
     │                  │                   │ 6. startIndexing()│                  │
     │                  │                   │──────────────────►│                  │
     │                  │                   │                   │                  │
     │                  │                   │   7. Detect       │                  │
     │                  │                   │   project type    │                  │
     │                  │                   │◄──────────────────│                  │
     │                  │                   │                   │                  │
     │                  │ 8. Progress       │   9. Crawl        │                  │
     │                  │    events         │   directory       │                  │
     │                  │◄──────────────────│◄──────────────────│                  │
     │                  │                   │                   │                  │
     │                  │                   │ 10. Save index    │                  │
     │                  │                   │──────────────────────────────────────►
     │                  │                   │                   │                  │
```

### 1.3 Key Design Decisions

| Decision                | Rationale                                                                       |
| ----------------------- | ------------------------------------------------------------------------------- |
| **Local-only storage**  | Folder paths differ per machine; using IndexedDB avoids cloud sync issues       |
| **Background indexing** | Non-blocking UX; uses setTimeout to delay after app load                        |
| **Incremental updates** | File watcher updates single entries instead of full re-index                    |
| **NFD normalization**   | `"café".normalize('NFD').replace(/[\u0300-\u036f]/g, '')` → "cafe"              |
| **Language detection**  | Checks for marker files (package.json, Cargo.toml, etc.) to apply smart ignores |
| **AbortController**     | Standard API for cancellable async operations                                   |
| **Picomatch**           | Fast, well-tested glob pattern matching (used by chokidar)                      |

### 1.4 Ignore Patterns by Language

The indexer automatically detects project types and applies appropriate ignore patterns:

```typescript
const IGNORE_PATTERNS = {
  // Always ignored
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
    '**/.idea/**',
    '**/.vscode/**',
  ],

  // JavaScript/TypeScript
  javascript: [
    '**/bower_components/**',
    '**/.npm/**',
    '**/.yarn/**',
    '**/jspm_packages/**',
    '**/.pnp.*',
    '**/.next/**',
    '**/.nuxt/**',
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
    '**/*.iml',
  ],

  // Go
  go: ['**/vendor/**', '**/*.exe', '**/*.dll', '**/*.so', '**/*.dylib'],

  // Rust
  rust: ['**/target/**', '**/*.rlib', '**/*.rmeta'],

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

### 1.5 IndexedDB Schema

```typescript
// projectFolders table - stores user's folder configurations
interface IProjectFolder {
  id: string; // UUID (primary key)
  projectPath: string; // MyndPrompts project path (e.g., ~/.myndprompt/prompts/my-project)
  folderPath: string; // External folder (e.g., ~/Projects/my-app)
  addedAt: Date;
  lastIndexedAt: Date | null;
  fileCount: number;
  status: 'pending' | 'indexing' | 'indexed' | 'error';
  errorMessage?: string;
}

// fileIndex table - stores indexed file metadata
interface IFileIndexEntry {
  id: string; // UUID (primary key)
  projectFolderId: string; // FK to projectFolders.id
  fileName: string; // Original name: "Café.tsx"
  normalizedName: string; // Searchable: "cafe.tsx"
  fullPath: string; // Absolute: "/Users/me/projects/app/src/Café.tsx"
  relativePath: string; // Relative: "src/Café.tsx"
  extension: string; // ".tsx"
  size: number; // bytes
  modifiedAt: Date;
  indexedAt: Date;
}

// Dexie schema
projectFolders: '&id, projectPath, folderPath, [projectPath+folderPath], status';
fileIndex: '&id, projectFolderId, normalizedName, fullPath, [projectFolderId+fullPath], extension';
```

---

## 2. Implementation Todos

Track progress by checking off completed tasks:

- [x] **Task 1**: Create IndexedDB schema extensions for projectFolders and fileIndex tables
- [x] **Task 2**: Implement FileIndexerService in Electron main process
- [x] **Task 3**: Add IPC handlers for file indexing operations
- [x] **Task 4**: Create fileSyncStore Pinia store for state management
- [x] **Task 5**: Implement folder management UI in Settings Panel (FileSyncSection component)
- [x] **Task 6**: Add sync progress indicator to StatusBar/Footer
- [x] **Task 7**: Integrate file watcher for real-time index updates
- [x] **Task 8**: Implement FilePathProvider for Monaco editor (`^` trigger)
- [x] **Task 9**: Extend SnippetProvider to include file paths for `@` trigger
- [x] **Task 10**: Add File Sync shortcut help to Snippets Panel (`^` documentation)
- [x] **Task 11**: Implement background indexing on app startup
- [x] **Task 12**: Add localization for all new UI strings (10 languages)

---

## 3. Task Implementations

### Task 1: IndexedDB Schema Extensions

#### Purpose

Extend the existing IndexedDB schema to store project folder configurations and file index data locally.

#### Objective

- Add `projectFolders` table to store user-configured external folder paths per project
- Add `fileIndex` table to store indexed file metadata for fast searching
- Create repository classes following existing patterns

#### Architecture Description

The schema extends the existing Dexie database with two new tables:

1. **projectFolders**: Stores the relationship between MyndPrompts projects and external folders
   - Primary key: `id` (UUID)
   - Indexes: `projectPath`, `folderPath`, `[projectPath+folderPath]` (compound unique)

2. **fileIndex**: Stores indexed file metadata for autocomplete
   - Primary key: `id` (UUID)
   - Indexes: `projectFolderId`, `normalizedName`, `fullPath`, `[projectFolderId+fullPath]`

#### Files to Modify/Create

- `src/services/storage/entities.ts` - Add new interfaces
- `src/services/storage/db.ts` - Add new tables and version migration
- `src/services/storage/repositories/project-folder.repository.ts` - New file
- `src/services/storage/repositories/file-index.repository.ts` - New file
- `src/services/storage/repositories/index.ts` - Export new repositories

#### Full Implementation Prompt

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
export type ProjectFolderStatus = 'pending' | 'indexing' | 'indexed' | 'error';

export interface IProjectFolder {
  id: string;
  projectPath: string;
  folderPath: string;
  addedAt: Date;
  lastIndexedAt: Date | null;
  fileCount: number;
  status: ProjectFolderStatus;
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
   - Increment version number
   - Add tables: `projectFolders` and `fileIndex`
   - Schema for projectFolders: `'&id, projectPath, folderPath, [projectPath+folderPath], status'`
   - Schema for fileIndex: `'&id, projectFolderId, normalizedName, fullPath, [projectFolderId+fullPath], extension'`
   - Add date hooks for converting Date fields (addedAt, lastIndexedAt, modifiedAt, indexedAt)

3. Create `project-folder.repository.ts`:
   - Extend BaseRepository<IProjectFolder, string>
   - Use singleton getInstance() pattern
   - Methods:
     - `getByProjectPath(projectPath: string): Promise<IProjectFolder[]>`
     - `addFolder(projectPath: string, folderPath: string): Promise<IProjectFolder>`
     - `removeFolder(id: string): Promise<void>`
     - `updateStatus(id: string, status: ProjectFolderStatus, errorMessage?: string): Promise<void>`
     - `updateIndexStats(id: string, fileCount: number): Promise<void>`

4. Create `file-index.repository.ts`:
   - Extend BaseRepository<IFileIndexEntry, string>
   - Use singleton getInstance() pattern
   - Methods:
     - `getByProjectFolder(projectFolderId: string): Promise<IFileIndexEntry[]>`
     - `searchByName(projectFolderId: string, query: string): Promise<IFileIndexEntry[]>` - uses normalizedName with .filter() for contains match
     - `searchByNameGlobal(query: string): Promise<IFileIndexEntry[]>` - searches across all folders
     - `addEntries(entries: IFileIndexEntry[]): Promise<void>` - bulk insert using bulkAdd
     - `removeByProjectFolder(projectFolderId: string): Promise<void>` - bulk delete
     - `removeByPath(fullPath: string): Promise<void>`
     - `upsertEntry(entry: IFileIndexEntry): Promise<void>` - put()

5. Export new repositories in `index.ts`

Follow the existing repository patterns exactly. Generate UUIDs with crypto.randomUUID().

```

---

### Task 2: FileIndexerService Implementation

#### Purpose
Create a service in the Electron main process that crawls directories and extracts file metadata while respecting language-specific ignore patterns.

#### Objective
- Implement recursive directory crawling
- Apply smart ignore patterns based on detected project type
- Normalize file names for diacritics-insensitive search
- Support progress reporting and cancellation
- Handle large directories efficiently

#### Architecture Description
The FileIndexerService runs in the main process and:
1. Detects project type by looking for marker files (package.json, requirements.txt, etc.)
2. Combines common + language-specific ignore patterns
3. Uses recursive `fs.readdir` for file discovery
4. Normalizes names using NFD decomposition + diacritics removal
5. Reports progress via IPC events to renderer
6. Supports AbortController for user cancellation

#### Files to Create
- `src/electron/main/services/file-indexer.service.ts`

#### Full Implementation Prompt

```

You are implementing Task 2 of the File Sync feature for MyndPrompts.

## Context

The Electron main process is at `/Users/augustopissarra/dev/myndprompts/gits/myndprompts/src/electron/main/`.
Existing services like FileWatcherService are in `/src/electron/main/services/`.

## Task

Create `file-indexer.service.ts` with:

1. Import dependencies:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import picomatch from 'picomatch';
```

2. Define interfaces:

```typescript
export interface IIndexedFile {
  fileName: string;
  normalizedName: string;
  fullPath: string;
  relativePath: string;
  extension: string;
  size: number;
  modifiedAt: Date;
}

export interface IIndexProgress {
  phase: 'scanning' | 'indexing' | 'complete' | 'cancelled' | 'error';
  current: number;
  total: number;
  currentFile?: string;
  error?: string;
}
```

3. Create FileIndexerService class:

- Singleton pattern with getInstance()
- Store AbortControllers in a Map<string, AbortController> keyed by operationId
- Include the full IGNORE_PATTERNS object from the architecture section above

4. Implement methods:

```typescript
// Detect project type by checking for marker files
private async detectProjectType(folderPath: string): Promise<string[]> {
  const types: string[] = [];
  const markers: Record<string, string[]> = {
    javascript: ['package.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb'],
    python: ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'],
    java: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    go: ['go.mod'],
    rust: ['Cargo.toml'],
    cpp: ['CMakeLists.txt', 'Makefile'],
    dotnet: ['*.csproj', '*.sln'],
    ruby: ['Gemfile'],
    php: ['composer.json'],
  };

  // Check root folder for each marker file
  // Use fs.access() to check existence
  // Add matching type to types array
  return types;
}

// Build ignore patterns combining common + detected types
private buildIgnorePatterns(projectTypes: string[]): picomatch.Matcher {
  const patterns = [...this.IGNORE_PATTERNS.common];
  for (const type of projectTypes) {
    if (this.IGNORE_PATTERNS[type]) {
      patterns.push(...this.IGNORE_PATTERNS[type]);
    }
  }
  return picomatch(patterns, { dot: true });
}

// Normalize file name for search (remove diacritics, lowercase)
private normalizeFileName(fileName: string): string {
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// Main indexing method
public async indexDirectory(
  folderPath: string,
  operationId: string,
  onProgress?: (progress: IIndexProgress) => void
): Promise<IIndexedFile[]> {
  const abortController = new AbortController();
  this.abortControllers.set(operationId, abortController);

  try {
    const projectTypes = await this.detectProjectType(folderPath);
    const isIgnored = this.buildIgnorePatterns(projectTypes);

    const files: IIndexedFile[] = [];
    await this.crawlDirectory(
      folderPath,
      folderPath,
      isIgnored,
      files,
      abortController.signal,
      onProgress
    );

    onProgress?.({ phase: 'complete', current: files.length, total: files.length });
    return files;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      onProgress?.({ phase: 'cancelled', current: 0, total: 0 });
      return [];
    }
    onProgress?.({ phase: 'error', current: 0, total: 0, error: String(error) });
    throw error;
  } finally {
    this.abortControllers.delete(operationId);
  }
}

// Recursive directory crawl
private async crawlDirectory(
  currentPath: string,
  rootPath: string,
  isIgnored: picomatch.Matcher,
  results: IIndexedFile[],
  signal: AbortSignal,
  onProgress?: (progress: IIndexProgress) => void
): Promise<void> {
  if (signal.aborted) {
    throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
  }

  const entries = await fs.readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    if (signal.aborted) {
      throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
    }

    const fullPath = path.join(currentPath, entry.name);
    const relativePath = path.relative(rootPath, fullPath);

    // Check if should be ignored
    if (isIgnored(relativePath)) continue;

    if (entry.isDirectory()) {
      await this.crawlDirectory(fullPath, rootPath, isIgnored, results, signal, onProgress);
    } else if (entry.isFile()) {
      try {
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
          total: -1,
          currentFile: relativePath,
        });
      } catch {
        // Skip files we can't stat (permissions, etc.)
      }
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
```

5. Export singleton:

```typescript
export const getFileIndexerService = (): FileIndexerService => FileIndexerService.getInstance();
```

Add `picomatch` to package.json dependencies if not already present.
Run `npm install picomatch` and `npm install -D @types/picomatch`.

```

---

### Task 3: IPC Handlers for File Indexing

#### Purpose
Create IPC handlers to expose file indexing functionality to the renderer process.

#### Objective
- Add IPC handlers for: startIndexing, cancelIndexing
- Implement progress events via IPC
- Add preload bridge methods for renderer access

#### Architecture Description
IPC communication flow:
1. Renderer calls `window.fileSystemAPI.startIndexing(folderPath, operationId)`
2. Main process invokes FileIndexerService.indexDirectory()
3. Progress updates sent via `fs:index-progress` IPC event
4. Results returned via IPC response

#### Files to Modify
- `src/electron/main/index.ts` - Add IPC handlers
- `src/electron/preload/index.ts` - Add preload bridge methods

#### Full Implementation Prompt

```

You are implementing Task 3 of the File Sync feature for MyndPrompts.

## Context

- Main process IPC handlers are in `/Users/augustopissarra/dev/myndprompts/gits/myndprompts/src/electron/main/index.ts`
- Preload bridge is in `/Users/augustopissarra/dev/myndprompts/gits/myndprompts/src/electron/preload/index.ts`
- FileIndexerService was created in Task 2 at `/src/electron/main/services/file-indexer.service.ts`

## Task

1. Add import to `index.ts`:

```typescript
import { getFileIndexerService } from './services/file-indexer.service';
```

2. Add IPC handlers to `index.ts` (in the File System IPC Handlers section):

```typescript
// File Indexing
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

3. Extend preload bridge in `index.ts`. Find the fileSystemAPI object and add:

```typescript
// File Indexing
startIndexing: (folderPath: string, operationId: string): Promise<any[]> =>
  ipcRenderer.invoke('fs:start-indexing', folderPath, operationId),

cancelIndexing: (operationId: string): Promise<boolean> =>
  ipcRenderer.invoke('fs:cancel-indexing', operationId),

onIndexProgress: (callback: (data: any) => void): (() => void) => {
  const handler = (_event: any, data: any): void => callback(data);
  ipcRenderer.on('fs:index-progress', handler);
  return () => {
    ipcRenderer.removeListener('fs:index-progress', handler);
  };
},
```

4. If there's a TypeScript interface for FileSystemAPI, update it to include the new methods:

```typescript
startIndexing: (folderPath: string, operationId: string) => Promise<any[]>;
cancelIndexing: (operationId: string) => Promise<boolean>;
onIndexProgress: (callback: (data: any) => void) => () => void;
```

Make sure all handlers follow the existing code style in the file.

```

---

### Task 4: FileSyncStore Implementation

#### Purpose
Create a Pinia store to manage file sync state, including folder configurations, indexing status, and search functionality.

#### Objective
- Manage project folder configurations from IndexedDB
- Track indexing progress and status
- Provide search functionality for indexed files
- Coordinate between repositories and IPC

#### Architecture Description
The store acts as the central coordinator:
1. Loads folder configurations from IndexedDB on initialize()
2. Triggers indexing operations via IPC to main process
3. Updates IndexedDB with indexed file entries
4. Provides reactive state for UI components
5. Handles file watcher events for incremental updates

#### Files to Create
- `src/stores/fileSyncStore.ts`

#### Full Implementation Prompt

```

You are implementing Task 4 of the File Sync feature for MyndPrompts.

## Context

- Existing stores are in `/Users/augustopissarra/dev/myndprompts/gits/myndprompts/src/stores/`
- Repositories created in Task 1 are at `/src/services/storage/repositories/`
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
  phase: 'scanning' | 'indexing' | 'complete' | 'cancelled' | 'error';
  current: number;
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
  const cleanupFunctions = ref<(() => void)[]>([]);

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
      isUpToDate: total > 0 && indexed === total && errors === 0,
    };
  });

  const currentOperation = computed(() => {
    const ops = Array.from(activeIndexingOperations.value.values());
    return ops.length > 0 ? ops[0] : null;
  });

  // Initialize store
  async function initialize(): Promise<void> {
    if (isInitialized.value) return;

    isLoading.value = true;
    try {
      const repo = getProjectFolderRepository();
      projectFolders.value = await repo.getAll();

      // Set up progress listener
      if (window.fileSystemAPI?.onIndexProgress) {
        const cleanup = window.fileSystemAPI.onIndexProgress(handleIndexProgress);
        cleanupFunctions.value.push(cleanup);
      }

      isInitialized.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to initialize file sync';
    } finally {
      isLoading.value = false;
    }
  }

  // Add a new folder to sync
  async function addFolder(
    projectPath: string,
    folderPath: string
  ): Promise<IProjectFolder | null> {
    try {
      const repo = getProjectFolderRepository();

      // Check for duplicate
      const existing = projectFolders.value.find(
        (f) => f.projectPath === projectPath && f.folderPath === folderPath
      );
      if (existing) {
        error.value = 'Folder already added';
        return null;
      }

      const folder = await repo.addFolder(projectPath, folderPath);
      projectFolders.value.push(folder);
      return folder;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to add folder';
      return null;
    }
  }

  // Remove a folder
  async function removeFolder(folderId: string): Promise<void> {
    try {
      const folderRepo = getProjectFolderRepository();
      const indexRepo = getFileIndexRepository();

      // Remove all indexed files first
      await indexRepo.removeByProjectFolder(folderId);
      // Remove folder config
      await folderRepo.removeFolder(folderId);

      projectFolders.value = projectFolders.value.filter((f) => f.id !== folderId);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to remove folder';
    }
  }

  // Start indexing a folder
  async function startIndexing(folderId: string): Promise<void> {
    const folder = projectFolders.value.find((f) => f.id === folderId);
    if (!folder) return;
    if (!window.fileSystemAPI) return;

    const operationId = crypto.randomUUID();
    activeIndexingOperations.value.set(operationId, {
      operationId,
      folderId,
      phase: 'scanning',
      current: 0,
    });

    try {
      // Update status to indexing
      const folderRepo = getProjectFolderRepository();
      await folderRepo.updateStatus(folderId, 'indexing');
      folder.status = 'indexing';

      // Start indexing via IPC
      const files = await window.fileSystemAPI.startIndexing(folder.folderPath, operationId);

      // Clear existing entries and save new ones
      const indexRepo = getFileIndexRepository();
      await indexRepo.removeByProjectFolder(folderId);

      const entries: IFileIndexEntry[] = files.map((f) => ({
        id: crypto.randomUUID(),
        projectFolderId: folderId,
        fileName: f.fileName,
        normalizedName: f.normalizedName,
        fullPath: f.fullPath,
        relativePath: f.relativePath,
        extension: f.extension,
        size: f.size,
        modifiedAt: new Date(f.modifiedAt),
        indexedAt: new Date(),
      }));

      if (entries.length > 0) {
        await indexRepo.addEntries(entries);
      }

      // Update folder stats
      await folderRepo.updateIndexStats(folderId, entries.length);
      await folderRepo.updateStatus(folderId, 'indexed');

      folder.status = 'indexed';
      folder.fileCount = entries.length;
      folder.lastIndexedAt = new Date();
      folder.errorMessage = undefined;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Indexing failed';

      if (errorMsg !== 'Aborted') {
        const folderRepo = getProjectFolderRepository();
        await folderRepo.updateStatus(folderId, 'error', errorMsg);
        folder.status = 'error';
        folder.errorMessage = errorMsg;
      }
    } finally {
      activeIndexingOperations.value.delete(operationId);
    }
  }

  // Cancel indexing
  async function cancelIndexing(operationId: string): Promise<void> {
    if (window.fileSystemAPI) {
      await window.fileSystemAPI.cancelIndexing(operationId);
    }
    activeIndexingOperations.value.delete(operationId);
  }

  // Cancel all active indexing operations
  async function cancelAllIndexing(): Promise<void> {
    for (const [operationId] of activeIndexingOperations.value) {
      await cancelIndexing(operationId);
    }
  }

  // Handle progress updates from main process
  function handleIndexProgress(data: {
    operationId: string;
    phase: string;
    current: number;
    currentFile?: string;
    error?: string;
  }): void {
    const operation = activeIndexingOperations.value.get(data.operationId);
    if (operation) {
      operation.phase = data.phase as IIndexingOperation['phase'];
      operation.current = data.current;
      operation.currentFile = data.currentFile;
      operation.error = data.error;
    }
  }

  // Search indexed files
  async function searchFiles(query: string, projectPath?: string): Promise<IFileIndexEntry[]> {
    if (!query.trim()) return [];

    const indexRepo = getFileIndexRepository();
    const normalizedQuery = query
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    let results: IFileIndexEntry[] = [];

    if (projectPath) {
      // Search within specific project's folders
      const foldersToSearch = projectFolders.value.filter((f) => f.projectPath === projectPath);
      for (const folder of foldersToSearch) {
        const folderResults = await indexRepo.searchByName(folder.id, normalizedQuery);
        results.push(...folderResults);
      }
    } else {
      // Search all indexed folders
      results = await indexRepo.searchByNameGlobal(normalizedQuery);
    }

    // Sort by relevance
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

    return results.slice(0, 50);
  }

  // Start background indexing for pending folders
  async function startBackgroundIndexing(): Promise<void> {
    const pendingFolders = projectFolders.value.filter(
      (f) => f.status === 'pending' || f.status === 'error'
    );

    for (const folder of pendingFolders) {
      // Don't overwhelm - index one at a time
      await startIndexing(folder.id);
    }
  }

  // Get folders for a specific project
  function getFoldersForProject(projectPath: string): IProjectFolder[] {
    return projectFolders.value.filter((f) => f.projectPath === projectPath);
  }

  // Cleanup on unmount
  function cleanup(): void {
    for (const fn of cleanupFunctions.value) {
      fn();
    }
    cleanupFunctions.value = [];
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
    currentOperation,

    // Actions
    initialize,
    addFolder,
    removeFolder,
    startIndexing,
    cancelIndexing,
    cancelAllIndexing,
    searchFiles,
    startBackgroundIndexing,
    getFoldersForProject,
    cleanup,
  };
});
```

Make sure to follow the existing code style in the stores directory.

```

---

### Task 5: Settings Panel UI (FileSyncSection)

#### Purpose
Add a "File Sync" section to the Settings Panel for managing project folders.

#### Objective
- Display list of configured folders with status badges
- Allow adding/removing folders
- Show sync progress and status
- Provide manual "Sync Now" button

#### Architecture Description
The UI extends SettingsPanel.vue with a new collapsible section that:
- Shows folders added for the current project
- Displays status (pending/indexing/indexed/error) with color-coded badges
- Provides add folder button that opens native directory picker
- Shows file count per folder
- Includes remove button per folder
- Shows progress during indexing
- Has "Sync Now" button when folders need re-indexing

#### Files to Create/Modify
- `src/components/settings/FileSyncSection.vue` - New component
- `src/components/layout/sidebar/SettingsPanel.vue` - Add section

#### Full Implementation Prompt

```

You are implementing Task 5 of the File Sync feature for MyndPrompts.

## Context

- SettingsPanel is at `/Users/augustopissarra/dev/myndprompts/gits/myndprompts/src/components/layout/sidebar/SettingsPanel.vue`
- Settings components are in `/src/components/settings/`
- Use Quasar components (q-list, q-item, q-btn, q-linear-progress, q-badge)
- The fileSyncStore was created in Task 4
- The projectStore has currentProject info

## Task

1. Create `src/components/settings/FileSyncSection.vue`:

```vue
<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFileSyncStore } from '@/stores/fileSyncStore';
import { useProjectStore } from '@/stores/projectStore';
import type { IProjectFolder } from '@/services/storage/entities';

const { t } = useI18n({ useScope: 'global' });
const fileSyncStore = useFileSyncStore();
const projectStore = useProjectStore();

// Check if running in Electron
const isElectron = computed(() => typeof window !== 'undefined' && !!window.fileSystemAPI);

// Get current project path
const currentProjectPath = computed(() => projectStore.currentProject?.folderPath ?? null);

// Get folders for current project
const folders = computed(() => {
  if (!currentProjectPath.value) return [];
  return fileSyncStore.getFoldersForProject(currentProjectPath.value);
});

const syncStatus = computed(() => fileSyncStore.syncStatus);
const hasActiveIndexing = computed(() => fileSyncStore.hasActiveIndexing);
const currentOperation = computed(() => fileSyncStore.currentOperation);

// Initialize store
onMounted(async () => {
  if (isElectron.value && !fileSyncStore.isInitialized) {
    await fileSyncStore.initialize();
  }
});

async function addFolder(): Promise<void> {
  if (!currentProjectPath.value || !window.electronAPI) return;

  const result = await window.electronAPI.openDialog({
    properties: ['openDirectory'],
    title: t('fileSync.selectFolder'),
  });

  if (!result.canceled && result.filePaths[0]) {
    const folder = await fileSyncStore.addFolder(currentProjectPath.value, result.filePaths[0]);
    if (folder) {
      await fileSyncStore.startIndexing(folder.id);
    }
  }
}

async function removeFolder(folder: IProjectFolder): Promise<void> {
  await fileSyncStore.removeFolder(folder.id);
}

async function syncFolder(folder: IProjectFolder): Promise<void> {
  await fileSyncStore.startIndexing(folder.id);
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

function getStatusIcon(status: string): string {
  switch (status) {
    case 'indexed':
      return 'check_circle';
    case 'indexing':
      return 'sync';
    case 'error':
      return 'error';
    default:
      return 'schedule';
  }
}

function formatPath(fullPath: string): string {
  // Show abbreviated path
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (fullPath.startsWith(home)) {
    return '~' + fullPath.slice(home.length);
  }
  return fullPath;
}
</script>

<template>
  <div class="file-sync-section">
    <!-- Browser mode message -->
    <div
      v-if="!isElectron"
      class="file-sync-section__browser-mode"
    >
      <q-icon
        name="info"
        size="24px"
        class="text-grey-6 q-mr-sm"
      />
      <span class="text-grey-6 text-caption">
        {{ t('fileSync.browserMode') }}
      </span>
    </div>

    <!-- No project selected -->
    <div
      v-else-if="!currentProjectPath"
      class="file-sync-section__no-project"
    >
      <q-icon
        name="folder_off"
        size="24px"
        class="text-grey-6 q-mr-sm"
      />
      <span class="text-grey-6 text-caption">
        {{ t('fileSync.noProject') }}
      </span>
    </div>

    <template v-else>
      <!-- Status summary -->
      <div class="file-sync-section__status">
        <div class="file-sync-section__status-badge">
          <q-badge
            :color="syncStatus.isUpToDate ? 'positive' : folders.length === 0 ? 'grey' : 'warning'"
          >
            <q-icon
              :name="
                syncStatus.isUpToDate
                  ? 'cloud_done'
                  : folders.length === 0
                    ? 'cloud_off'
                    : 'cloud_sync'
              "
              size="12px"
              class="q-mr-xs"
            />
            {{
              syncStatus.isUpToDate
                ? t('fileSync.upToDate')
                : folders.length === 0
                  ? t('fileSync.noFolders')
                  : t('fileSync.needsSync')
            }}
          </q-badge>
        </div>
        <span class="text-caption text-grey">
          {{ t('fileSync.folderCount', folders.length) }}
        </span>
      </div>

      <!-- Progress bar when indexing -->
      <div
        v-if="hasActiveIndexing && currentOperation"
        class="file-sync-section__progress"
      >
        <q-linear-progress
          indeterminate
          color="primary"
          class="q-mb-xs"
        />
        <div class="text-caption text-grey">
          {{ t('fileSync.indexing') }}
          <span
            v-if="currentOperation.currentFile"
            class="text-primary"
          >
            {{ currentOperation.currentFile }}
          </span>
          <span v-if="currentOperation.current > 0">
            ({{ currentOperation.current }} {{ t('fileSync.filesIndexed') }})
          </span>
        </div>
      </div>

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
            <q-icon
              :name="getStatusIcon(folder.status)"
              :color="getStatusColor(folder.status)"
            />
          </q-item-section>

          <q-item-section>
            <q-item-label class="ellipsis">
              {{ formatPath(folder.folderPath) }}
            </q-item-label>
            <q-item-label caption>
              <span v-if="folder.status === 'indexed'">
                {{ t('fileSync.fileCount', folder.fileCount) }}
              </span>
              <span
                v-else-if="folder.status === 'error'"
                class="text-negative"
              >
                {{ folder.errorMessage || t('fileSync.status.error') }}
              </span>
              <span v-else>
                {{ t(`fileSync.status.${folder.status}`) }}
              </span>
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <div class="row items-center q-gutter-xs">
              <q-btn
                v-if="folder.status !== 'indexing'"
                flat
                dense
                round
                size="sm"
                icon="refresh"
                @click="syncFolder(folder)"
              >
                <q-tooltip>{{ t('fileSync.syncNow') }}</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                size="sm"
                icon="delete"
                color="negative"
                @click="removeFolder(folder)"
              >
                <q-tooltip>{{ t('common.remove') }}</q-tooltip>
              </q-btn>
            </div>
          </q-item-section>
        </q-item>

        <!-- Empty state -->
        <q-item
          v-if="folders.length === 0"
          class="file-sync-section__empty"
        >
          <q-item-section>
            <q-item-label class="text-grey-6 text-center">
              {{ t('fileSync.noFolders') }}
            </q-item-label>
            <q-item-label
              caption
              class="text-grey-7 text-center"
            >
              {{ t('fileSync.addFolderHint') }}
            </q-item-label>
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
          v-if="folders.length > 0 && !syncStatus.isUpToDate"
          flat
          dense
          no-caps
          icon="sync"
          :label="t('fileSync.syncAll')"
          :loading="hasActiveIndexing"
          @click="syncAll"
        />
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.file-sync-section {
  padding: 8px 0;

  &__browser-mode,
  &__no-project {
    display: flex;
    align-items: center;
    padding: 16px 8px;
    color: var(--text-secondary);
  }

  &__status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px 8px;
  }

  &__progress {
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

  &__empty {
    padding: 16px;
  }

  &__actions {
    display: flex;
    gap: 8px;
    padding: 8px;
    border-top: 1px solid var(--border-color, #3c3c3c);
  }
}

.body--light .file-sync-section {
  --item-hover-bg: #e8e8e8;
  --border-color: #e7e7e7;
}

.body--dark .file-sync-section {
  --item-hover-bg: #2a2d2e;
  --border-color: #3c3c3c;
}
</style>
```

2. Update `SettingsPanel.vue`:
   - Import FileSyncSection component
   - Add 'fileSync' to the settingsSections computed array
   - Add the section rendering similar to 'categories'

Add to imports:

```typescript
import FileSyncSection from '@/components/settings/FileSyncSection.vue';
```

Add to settingsSections:

```typescript
{
  id: 'fileSync',
  label: t('fileSync.title'),
  icon: 'sync',
  type: 'fileSync',
},
```

Add to template (similar to categories section):

```vue
<!-- File Sync section -->
<div
  v-if="section.type === 'fileSync'"
  v-show="isSectionExpanded(section.id)"
  class="settings-panel__file-sync"
>
  <FileSyncSection />
</div>
```

```

---

### Task 6: StatusBar Progress Indicator

#### Purpose
Add a sync progress indicator to the application footer/status bar.

#### Objective
- Show indexing progress when active with cancel option
- Show "up to date" indicator when idle
- Show warning indicator when errors exist

#### Files to Modify
- `src/components/layout/StatusBar.vue`

#### Full Implementation Prompt

```

You are implementing Task 6 of the File Sync feature for MyndPrompts.

## Context

- StatusBar is at `/Users/augustopissarra/dev/myndprompts/gits/myndprompts/src/components/layout/StatusBar.vue`
- The fileSyncStore was created in Task 4

## Task

1. Import fileSyncStore:

```typescript
import { useFileSyncStore } from '@/stores/fileSyncStore';
```

2. In setup, initialize the store:

```typescript
const fileSyncStore = useFileSyncStore();

// Check if in Electron
const isElectron = computed(() => typeof window !== 'undefined' && !!window.fileSystemAPI);

// Initialize on mount
onMounted(async () => {
  if (isElectron.value && !fileSyncStore.isInitialized) {
    await fileSyncStore.initialize();
  }
});
```

3. Add computed properties:

```typescript
const syncStatus = computed(() => fileSyncStore.syncStatus);
const hasActiveIndexing = computed(() => fileSyncStore.hasActiveIndexing);
const currentOperation = computed(() => fileSyncStore.currentOperation);
```

4. Add cancel function:

```typescript
async function cancelIndexing(): Promise<void> {
  await fileSyncStore.cancelAllIndexing();
}
```

5. Add to the template (find an appropriate location in the status bar, likely on the right side):

```vue
<!-- File Sync Status -->
<div v-if="isElectron" class="status-bar__sync">
  <!-- Up to date -->
  <div
    v-if="syncStatus.isUpToDate && !hasActiveIndexing"
    class="status-bar__sync-status"
  >
    <q-icon
      name="cloud_done"
      size="14px"
      class="text-positive"
    />
    <q-tooltip>{{ t('fileSync.upToDate') }}</q-tooltip>
  </div>

  <!-- Indexing in progress -->
  <div
    v-else-if="hasActiveIndexing"
    class="status-bar__sync-progress"
  >
    <q-spinner-ios size="12px" color="primary" />
    <span class="status-bar__sync-text">
      {{ t('fileSync.indexing') }}
      <template v-if="currentOperation?.current">
        ({{ currentOperation.current }})
      </template>
    </span>
    <q-btn
      flat
      dense
      round
      size="xs"
      icon="close"
      class="status-bar__sync-cancel"
      @click="cancelIndexing"
    >
      <q-tooltip>{{ t('fileSync.cancelIndexing') }}</q-tooltip>
    </q-btn>
  </div>

  <!-- Has errors -->
  <div
    v-else-if="syncStatus.errors > 0"
    class="status-bar__sync-status status-bar__sync-status--error"
  >
    <q-icon
      name="cloud_off"
      size="14px"
      class="text-negative"
    />
    <q-tooltip>{{ t('fileSync.hasErrors', syncStatus.errors) }}</q-tooltip>
  </div>

  <!-- Needs sync (pending folders) -->
  <div
    v-else-if="syncStatus.pending > 0"
    class="status-bar__sync-status"
  >
    <q-icon
      name="cloud_sync"
      size="14px"
      class="text-warning"
    />
    <q-tooltip>{{ t('fileSync.needsSync') }}</q-tooltip>
  </div>
</div>
```

6. Add styles:

```scss
&__sync {
  display: flex;
  align-items: center;
  padding: 0 8px;
}

&__sync-status {
  display: flex;
  align-items: center;
  cursor: default;

  &--error {
    cursor: pointer;
  }
}

&__sync-progress {
  display: flex;
  align-items: center;
  gap: 6px;
}

&__sync-text {
  font-size: 11px;
  color: var(--text-secondary);
}

&__sync-cancel {
  margin-left: 4px;
  opacity: 0.7;

  &:hover {
    opacity: 1;
  }
}
```

```

---

### Task 7: File Watcher Integration

#### Purpose
Integrate file watching to keep the index updated in real-time when files are added, removed, or renamed.

#### Objective
- Watch all indexed folders for changes
- Update index incrementally (add/remove entries)
- Handle file system events from existing FileWatcherService

#### Files to Modify
- `src/stores/fileSyncStore.ts` - Add watcher management and event handling

#### Full Implementation Prompt

```

You are implementing Task 7 of the File Sync feature for MyndPrompts.

## Context

- FileWatcherService exists at `/src/electron/main/services/file-watcher.service.ts`
- The `fs:file-change` IPC event is already implemented for prompts
- Preload bridge has `watchPath` and `unwatchPath` methods
- fileSyncStore was created in Task 4

## Task

1. Add new state to fileSyncStore:

```typescript
const activeWatchers = ref<Map<string, string>>(new Map()); // folderId -> watcherId
```

2. Add normalize function (same as in FileIndexerService):

```typescript
function normalizeFileName(fileName: string): string {
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
```

3. Add watcher management methods:

```typescript
async function startWatching(folderId: string): Promise<void> {
  const folder = projectFolders.value.find((f) => f.id === folderId);
  if (!folder || activeWatchers.value.has(folderId)) return;
  if (!window.fileSystemAPI?.watchPath) return;

  try {
    const watcherId = await window.fileSystemAPI.watchPath(folder.folderPath, {
      persistent: true,
      ignoreInitial: true,
      depth: 99,
    });
    activeWatchers.value.set(folderId, watcherId);
  } catch (err) {
    console.error('Failed to start watcher for folder:', folderId, err);
  }
}

async function stopWatching(folderId: string): Promise<void> {
  const watcherId = activeWatchers.value.get(folderId);
  if (watcherId && window.fileSystemAPI?.unwatchPath) {
    try {
      await window.fileSystemAPI.unwatchPath(watcherId);
    } catch (err) {
      console.error('Failed to stop watcher:', watcherId, err);
    }
    activeWatchers.value.delete(folderId);
  }
}

async function stopAllWatchers(): Promise<void> {
  for (const [folderId] of activeWatchers.value) {
    await stopWatching(folderId);
  }
}
```

4. Add file change handler:

```typescript
async function handleFileChange(event: { type: string; path: string }): Promise<void> {
  // Find which folder this file belongs to
  const folder = projectFolders.value.find((f) => event.path.startsWith(f.folderPath + '/'));
  if (!folder || folder.status !== 'indexed') return;

  const indexRepo = getFileIndexRepository();
  const fileName = event.path.split('/').pop() || '';

  // Skip common ignored files
  if (fileName.startsWith('.') || fileName === 'node_modules') return;

  try {
    switch (event.type) {
      case 'add': {
        // Add new file to index
        const entry: IFileIndexEntry = {
          id: crypto.randomUUID(),
          projectFolderId: folder.id,
          fileName: fileName,
          normalizedName: normalizeFileName(fileName),
          fullPath: event.path,
          relativePath: event.path.slice(folder.folderPath.length + 1),
          extension: fileName.includes('.') ? '.' + fileName.split('.').pop()!.toLowerCase() : '',
          size: 0,
          modifiedAt: new Date(),
          indexedAt: new Date(),
        };
        await indexRepo.upsertEntry(entry);
        folder.fileCount++;
        break;
      }

      case 'unlink': {
        // Remove file from index
        await indexRepo.removeByPath(event.path);
        folder.fileCount = Math.max(0, folder.fileCount - 1);
        break;
      }

      case 'change': {
        // Update modification time (optional)
        // Could re-index content if needed
        break;
      }
    }
  } catch (err) {
    console.error('Failed to handle file change:', event, err);
  }
}
```

5. Update initialize() to set up file change listener:

```typescript
// In initialize(), add:
if (window.fileSystemAPI?.onFileChange) {
  const cleanup = window.fileSystemAPI.onFileChange(handleFileChange);
  cleanupFunctions.value.push(cleanup);
}
```

6. Update startIndexing() to start watching after successful index:

```typescript
// At the end of successful indexing (before finally block):
await startWatching(folderId);
```

7. Update removeFolder() to stop watching:

```typescript
// At the beginning of removeFolder():
await stopWatching(folderId);
```

8. Update cleanup() to stop all watchers:

```typescript
function cleanup(): void {
  stopAllWatchers();
  for (const fn of cleanupFunctions.value) {
    fn();
  }
  cleanupFunctions.value = [];
}
```

9. Export new methods:

```typescript
return {
  // ... existing exports
  startWatching,
  stopWatching,
  stopAllWatchers,
};
```

```

---

### Task 8: FilePathProvider for Monaco Editor

#### Purpose
Create a completion provider for Monaco editor that suggests file paths when typing `^`.

#### Objective
- Register completion provider with `^` trigger character
- Search indexed files using diacritics-insensitive matching
- Show file path suggestions with appropriate icons
- Insert full file path on selection

#### Files to Create/Modify
- `src/components/editor/file-path-provider.ts` - New file
- `src/components/layout/EditorPane.vue` - Register provider

#### Full Implementation Prompt

```

You are implementing Task 8 of the File Sync feature for MyndPrompts.

## Context

- Existing snippet provider is at `/src/components/editor/snippet-provider.ts`
- Editor setup is in `/src/components/layout/EditorPane.vue`
- Use monaco-editor completion provider pattern
- fileSyncStore provides searchFiles() method

## Task

1. Create `src/components/editor/file-path-provider.ts`:

```typescript
import * as monaco from 'monaco-editor';
import { useFileSyncStore } from '@/stores/fileSyncStore';

/**
 * Creates a Monaco completion provider for file path suggestions.
 * Triggered by the ^ character.
 */
export function createFilePathProvider(): monaco.languages.CompletionItemProvider {
  return {
    triggerCharacters: ['^'],

    async provideCompletionItems(
      model: monaco.editor.ITextModel,
      position: monaco.Position,
      _context: monaco.languages.CompletionContext,
      _token: monaco.CancellationToken
    ): Promise<monaco.languages.CompletionList> {
      const fileSyncStore = useFileSyncStore();

      // Get text on current line up to cursor
      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      // Check if triggered by ^
      const triggerMatch = textUntilPosition.match(/\^([^\s]*)$/);
      if (!triggerMatch) {
        return { suggestions: [] };
      }

      const query = triggerMatch[1] || '';

      // Search indexed files
      let files;
      try {
        files = await fileSyncStore.searchFiles(query);
      } catch {
        return { suggestions: [] };
      }

      if (files.length === 0) {
        return { suggestions: [] };
      }

      // Calculate replacement range (from ^ to cursor)
      const range: monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: position.column - triggerMatch[0].length,
        endColumn: position.column,
      };

      // Create suggestions
      const suggestions: monaco.languages.CompletionItem[] = files.map((file, index) => ({
        label: {
          label: file.fileName,
          description: file.relativePath,
        },
        kind: getFileKind(file.extension),
        insertText: file.fullPath,
        detail: file.relativePath,
        documentation: {
          value: [
            `**File:** ${file.fileName}`,
            `**Path:** \`${file.fullPath}\``,
            `**Size:** ${formatFileSize(file.size)}`,
            `**Modified:** ${file.modifiedAt.toLocaleDateString()}`,
          ].join('\n\n'),
        },
        range,
        sortText: String(index).padStart(4, '0'), // Preserve relevance order from store
        filterText: `^${file.normalizedName}`,
      }));

      return { suggestions };
    },
  };
}

/**
 * Get appropriate CompletionItemKind based on file extension.
 */
function getFileKind(extension: string): monaco.languages.CompletionItemKind {
  const codeExtensions = [
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.vue',
    '.svelte',
    '.py',
    '.rb',
    '.php',
    '.java',
    '.kt',
    '.scala',
    '.go',
    '.rs',
    '.c',
    '.cpp',
    '.h',
    '.hpp',
    '.cs',
    '.fs',
    '.swift',
    '.m',
    '.sh',
    '.bash',
    '.zsh',
    '.sql',
  ];

  const textExtensions = [
    '.md',
    '.mdx',
    '.txt',
    '.rst',
    '.json',
    '.yaml',
    '.yml',
    '.toml',
    '.xml',
    '.html',
    '.htm',
    '.css',
    '.scss',
    '.sass',
    '.less',
    '.env',
    '.ini',
    '.conf',
    '.cfg',
  ];

  if (codeExtensions.includes(extension)) {
    return monaco.languages.CompletionItemKind.File;
  }
  if (textExtensions.includes(extension)) {
    return monaco.languages.CompletionItemKind.Text;
  }
  return monaco.languages.CompletionItemKind.File;
}

/**
 * Format file size for display.
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

2. Register the provider in EditorPane.vue.

Find where Monaco editor is initialized (likely in onMounted or a setup function) and add:

```typescript
import { createFilePathProvider } from '@/components/editor/file-path-provider';

// During Monaco initialization, after editor is created:
// Register file path provider for markdown
monaco.languages.registerCompletionItemProvider('markdown', createFilePathProvider());
```

Make sure the fileSyncStore is initialized before the provider is used. The provider calls searchFiles() which requires the store to be initialized.

```

---

### Task 9: Extend @ Trigger for File Paths

#### Purpose
Extend the existing `@` trigger to show file path suggestions alongside snippets.

#### Objective
- When user types `@`, show both snippets AND file paths
- File paths appear after snippets in the list
- Visually distinguish file suggestions from snippets

#### Files to Modify
- `src/components/editor/snippet-provider.ts`

#### Full Implementation Prompt

```

You are implementing Task 9 of the File Sync feature for MyndPrompts.

## Context

- Snippet provider is at `/Users/augustopissarra/dev/myndprompts/gits/myndprompts/src/components/editor/snippet-provider.ts`
- The `@` trigger already provides snippet suggestions
- fileSyncStore provides searchFiles() method
- Need to add file path suggestions to the `@` results

## Task

1. Import fileSyncStore at the top:

```typescript
import { useFileSyncStore } from '@/stores/fileSyncStore';
```

2. Find the provideCompletionItems function in the snippet provider.

3. After the existing snippet suggestions are built, add file suggestions when triggered by `@`:

```typescript
// At the end of provideCompletionItems, before returning suggestions:

// Check if triggered by @ and add file suggestions
if (triggerChar === '@') {
  try {
    const fileSyncStore = useFileSyncStore();

    // Only if initialized
    if (fileSyncStore.isInitialized) {
      const query = search || ''; // search is the text after @
      const files = await fileSyncStore.searchFiles(query);

      // Add file suggestions with sortText that puts them after snippets
      for (const file of files) {
        suggestions.push({
          label: {
            label: file.fileName,
            description: 'File',
            detail: file.relativePath,
          },
          kind: monaco.languages.CompletionItemKind.File,
          insertText: file.fullPath,
          detail: file.relativePath,
          documentation: {
            value: `**Insert file path:**\n\`${file.fullPath}\``,
          },
          range,
          // sortText starting with '2' puts files after snippets (which start with '0' or '1')
          sortText: `2_${file.normalizedName}`,
          filterText: `@${file.normalizedName}`,
        });
      }
    }
  } catch (err) {
    // Silently fail - file suggestions are optional enhancement
    console.warn('Failed to get file suggestions:', err);
  }
}
```

4. Make sure the search variable is accessible. Look at how the existing code extracts the text after the trigger character and use the same approach.

The key points:

- File suggestions use sortText starting with '2' so they appear after snippets
- Files are labeled with "File" in the description
- Files use CompletionItemKind.File icon
- Insert the full path, not the filename
- Filter text includes @ prefix for consistent filtering

```

---

### Task 10: Snippets Panel Help Update

#### Purpose
Add keyboard shortcut documentation to the Snippets Panel for the new `^` trigger.

#### Objective
- Update the help tooltip in Snippets Panel footer
- Document `^` for file path suggestions

#### Files to Modify
- `src/components/layout/sidebar/SnippetsPanel.vue`
- `src/i18n/*/index.ts` (all locales)

#### Full Implementation Prompt

```

You are implementing Task 10 of the File Sync feature for MyndPrompts.

## Context

- SnippetsPanel is at `/Users/augustopissarra/dev/myndprompts/gits/myndprompts/src/components/layout/sidebar/SnippetsPanel.vue`
- There's already a help section in the footer showing trigger characters
- Locale files need updating for the new string

## Task

1. Find the trigger help section in SnippetsPanel.vue (search for "triggerHelp").

2. Add a new row for the `^` trigger. The existing structure shows:

- @ - All snippets
- # - Text snippets
- $ - Code snippets
- ! - Templates

Add:

- ^ - Project files

The HTML structure should match the existing rows. Example:

```vue
<div class="snippets-panel__trigger-row">
  <kbd>^</kbd>
  <span>{{ t('snippetsPanel.triggerHelp.files') }}</span>
</div>
```

3. Update ALL locale files to add the new translation key.

Add to `snippetsPanel.triggerHelp` object in each file:

**en-US/en-GB/en-IE:**

```typescript
files: 'Project files',
```

**pt-BR:**

```typescript
files: 'Arquivos do projeto',
```

**pt-PT:**

```typescript
files: 'Ficheiros do projeto',
```

**es-ES:**

```typescript
files: 'Archivos del proyecto',
```

**fr-FR:**

```typescript
files: 'Fichiers du projet',
```

**de-DE:**

```typescript
files: 'Projektdateien',
```

**it-IT:**

```typescript
files: 'File del progetto',
```

**ar-SA:**

```typescript
files: 'ملفات المشروع',
```

Locale files are at:

- `/src/i18n/en-US/index.ts`
- `/src/i18n/en-GB/index.ts`
- `/src/i18n/en-IE/index.ts`
- `/src/i18n/pt-BR/index.ts`
- `/src/i18n/pt-PT/index.ts`
- `/src/i18n/es-ES/index.ts`
- `/src/i18n/fr-FR/index.ts`
- `/src/i18n/de-DE/index.ts`
- `/src/i18n/it-IT/index.ts`
- `/src/i18n/ar-SA/index.ts`

```

---

### Task 11: Background Indexing on Startup

#### Purpose
Implement automatic background indexing when the application starts.

#### Objective
- Check for pending/stale indexes on app boot
- Start indexing in background without blocking UI
- Index folders sequentially to avoid overwhelming the system

#### Files to Create/Modify
- `src/boot/file-sync.ts` - New boot file
- `quasar.config.ts` - Register boot file

#### Full Implementation Prompt

```

You are implementing Task 11 of the File Sync feature for MyndPrompts.

## Context

- Boot files are in `/src/boot/`
- quasar.config.ts has a boot array listing boot files
- fileSyncStore has startBackgroundIndexing() method

## Task

1. Create `src/boot/file-sync.ts`:

```typescript
import { boot } from 'quasar/wrappers';
import { useFileSyncStore } from '@/stores/fileSyncStore';

export default boot(async () => {
  // Only run in Electron environment
  if (typeof window === 'undefined' || !window.fileSystemAPI) {
    return;
  }

  const fileSyncStore = useFileSyncStore();

  try {
    // Initialize store (loads folder configs from IndexedDB)
    await fileSyncStore.initialize();

    // Start background indexing after a delay
    // This ensures the main UI is fully loaded first
    setTimeout(() => {
      void fileSyncStore.startBackgroundIndexing();
    }, 3000); // 3 second delay
  } catch (err) {
    console.error('Failed to initialize file sync:', err);
  }
});
```

2. Update `quasar.config.ts`:

Find the `boot` array and add 'file-sync':

```typescript
boot: [
  'i18n',
  // ... other boot files
  'file-sync',
],
```

3. Update startBackgroundIndexing() in fileSyncStore to be smarter:

```typescript
async function startBackgroundIndexing(): Promise<void> {
  // Get folders that need indexing
  const foldersToIndex = projectFolders.value.filter((f) => {
    // Index pending folders
    if (f.status === 'pending') return true;

    // Re-index folders with errors
    if (f.status === 'error') return true;

    // Re-index if last indexed more than 24 hours ago
    if (f.status === 'indexed' && f.lastIndexedAt) {
      const hoursSinceLastIndex =
        (Date.now() - new Date(f.lastIndexedAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastIndex > 24) return true;
    }

    return false;
  });

  // Index sequentially to avoid overwhelming the system
  for (const folder of foldersToIndex) {
    // Check if we've been cancelled
    if (!isInitialized.value) break;

    try {
      await startIndexing(folder.id);
    } catch (err) {
      console.error('Background indexing failed for folder:', folder.folderPath, err);
    }

    // Small delay between folders
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
```

```

---

### Task 12: Localization

#### Purpose
Add translation keys for all new File Sync UI strings in all 10 supported languages.

#### Objective
- Add complete `fileSync` section to all locale files
- Ensure all strings support pluralization where needed

#### Files to Modify
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

#### Full Implementation Prompt

```

You are implementing Task 12 of the File Sync feature for MyndPrompts.

## Context

- Locale files are at `/src/i18n/{locale}/index.ts`
- Follow the existing structure and patterns
- Use vue-i18n pluralization syntax: `{count} file | {count} files`
- Remember: escape @ as {'@'} if used

## Task

Add the `fileSync` section to ALL locale files:

### en-US (Base):

```typescript
fileSync: {
  title: 'File Sync',
  selectFolder: 'Select Folder',
  addFolder: 'Add Folder',
  removeFolder: 'Remove Folder',
  syncNow: 'Sync Now',
  syncAll: 'Sync All',
  upToDate: 'Up to date',
  needsSync: 'Needs sync',
  indexing: 'Indexing...',
  filesIndexed: 'files indexed',
  folderCount: '{count} folder | {count} folders',
  fileCount: '{count} file | {count} files',
  hasErrors: '{count} sync error | {count} sync errors',
  cancelIndexing: 'Cancel indexing',
  noFolders: 'No folders configured',
  noProject: 'Select a project first',
  addFolderHint: 'Add external folders to enable file path suggestions in the editor',
  browserMode: 'File sync is available in the desktop app',
  status: {
    pending: 'Pending',
    indexing: 'Indexing',
    indexed: 'Indexed',
    error: 'Error',
  },
},
```

### en-GB / en-IE:

Same as en-US (British spelling is the same for these terms)

### pt-BR:

```typescript
fileSync: {
  title: 'Sincronização de Arquivos',
  selectFolder: 'Selecionar Pasta',
  addFolder: 'Adicionar Pasta',
  removeFolder: 'Remover Pasta',
  syncNow: 'Sincronizar Agora',
  syncAll: 'Sincronizar Tudo',
  upToDate: 'Atualizado',
  needsSync: 'Precisa sincronizar',
  indexing: 'Indexando...',
  filesIndexed: 'arquivos indexados',
  folderCount: '{count} pasta | {count} pastas',
  fileCount: '{count} arquivo | {count} arquivos',
  hasErrors: '{count} erro de sincronização | {count} erros de sincronização',
  cancelIndexing: 'Cancelar indexação',
  noFolders: 'Nenhuma pasta configurada',
  noProject: 'Selecione um projeto primeiro',
  addFolderHint: 'Adicione pastas externas para habilitar sugestões de caminho de arquivo no editor',
  browserMode: 'Sincronização de arquivos disponível no aplicativo desktop',
  status: {
    pending: 'Pendente',
    indexing: 'Indexando',
    indexed: 'Indexado',
    error: 'Erro',
  },
},
```

### pt-PT:

```typescript
fileSync: {
  title: 'Sincronização de Ficheiros',
  selectFolder: 'Selecionar Pasta',
  addFolder: 'Adicionar Pasta',
  removeFolder: 'Remover Pasta',
  syncNow: 'Sincronizar Agora',
  syncAll: 'Sincronizar Tudo',
  upToDate: 'Atualizado',
  needsSync: 'Necessita sincronização',
  indexing: 'A indexar...',
  filesIndexed: 'ficheiros indexados',
  folderCount: '{count} pasta | {count} pastas',
  fileCount: '{count} ficheiro | {count} ficheiros',
  hasErrors: '{count} erro de sincronização | {count} erros de sincronização',
  cancelIndexing: 'Cancelar indexação',
  noFolders: 'Nenhuma pasta configurada',
  noProject: 'Selecione um projeto primeiro',
  addFolderHint: 'Adicione pastas externas para ativar sugestões de caminho de ficheiro no editor',
  browserMode: 'Sincronização de ficheiros disponível na aplicação desktop',
  status: {
    pending: 'Pendente',
    indexing: 'A indexar',
    indexed: 'Indexado',
    error: 'Erro',
  },
},
```

### es-ES:

```typescript
fileSync: {
  title: 'Sincronización de Archivos',
  selectFolder: 'Seleccionar Carpeta',
  addFolder: 'Añadir Carpeta',
  removeFolder: 'Eliminar Carpeta',
  syncNow: 'Sincronizar Ahora',
  syncAll: 'Sincronizar Todo',
  upToDate: 'Actualizado',
  needsSync: 'Necesita sincronización',
  indexing: 'Indexando...',
  filesIndexed: 'archivos indexados',
  folderCount: '{count} carpeta | {count} carpetas',
  fileCount: '{count} archivo | {count} archivos',
  hasErrors: '{count} error de sincronización | {count} errores de sincronización',
  cancelIndexing: 'Cancelar indexación',
  noFolders: 'No hay carpetas configuradas',
  noProject: 'Seleccione un proyecto primero',
  addFolderHint: 'Añade carpetas externas para habilitar sugerencias de rutas de archivos en el editor',
  browserMode: 'La sincronización de archivos está disponible en la aplicación de escritorio',
  status: {
    pending: 'Pendiente',
    indexing: 'Indexando',
    indexed: 'Indexado',
    error: 'Error',
  },
},
```

### fr-FR:

```typescript
fileSync: {
  title: 'Synchronisation des Fichiers',
  selectFolder: 'Sélectionner un Dossier',
  addFolder: 'Ajouter un Dossier',
  removeFolder: 'Supprimer le Dossier',
  syncNow: 'Synchroniser Maintenant',
  syncAll: 'Tout Synchroniser',
  upToDate: 'À jour',
  needsSync: 'Synchronisation nécessaire',
  indexing: 'Indexation...',
  filesIndexed: 'fichiers indexés',
  folderCount: '{count} dossier | {count} dossiers',
  fileCount: '{count} fichier | {count} fichiers',
  hasErrors: '{count} erreur de synchronisation | {count} erreurs de synchronisation',
  cancelIndexing: "Annuler l'indexation",
  noFolders: 'Aucun dossier configuré',
  noProject: "Sélectionnez d'abord un projet",
  addFolderHint: "Ajoutez des dossiers externes pour activer les suggestions de chemins de fichiers dans l'éditeur",
  browserMode: "La synchronisation des fichiers est disponible dans l'application de bureau",
  status: {
    pending: 'En attente',
    indexing: 'Indexation',
    indexed: 'Indexé',
    error: 'Erreur',
  },
},
```

### de-DE:

```typescript
fileSync: {
  title: 'Dateisynchronisierung',
  selectFolder: 'Ordner auswählen',
  addFolder: 'Ordner hinzufügen',
  removeFolder: 'Ordner entfernen',
  syncNow: 'Jetzt synchronisieren',
  syncAll: 'Alle synchronisieren',
  upToDate: 'Aktuell',
  needsSync: 'Synchronisierung erforderlich',
  indexing: 'Indizierung...',
  filesIndexed: 'Dateien indiziert',
  folderCount: '{count} Ordner | {count} Ordner',
  fileCount: '{count} Datei | {count} Dateien',
  hasErrors: '{count} Synchronisierungsfehler | {count} Synchronisierungsfehler',
  cancelIndexing: 'Indizierung abbrechen',
  noFolders: 'Keine Ordner konfiguriert',
  noProject: 'Bitte wählen Sie zuerst ein Projekt',
  addFolderHint: 'Fügen Sie externe Ordner hinzu, um Dateipfad-Vorschläge im Editor zu aktivieren',
  browserMode: 'Dateisynchronisierung ist in der Desktop-App verfügbar',
  status: {
    pending: 'Ausstehend',
    indexing: 'Indizierung',
    indexed: 'Indiziert',
    error: 'Fehler',
  },
},
```

### it-IT:

```typescript
fileSync: {
  title: 'Sincronizzazione File',
  selectFolder: 'Seleziona Cartella',
  addFolder: 'Aggiungi Cartella',
  removeFolder: 'Rimuovi Cartella',
  syncNow: 'Sincronizza Ora',
  syncAll: 'Sincronizza Tutto',
  upToDate: 'Aggiornato',
  needsSync: 'Sincronizzazione necessaria',
  indexing: 'Indicizzazione...',
  filesIndexed: 'file indicizzati',
  folderCount: '{count} cartella | {count} cartelle',
  fileCount: '{count} file | {count} file',
  hasErrors: '{count} errore di sincronizzazione | {count} errori di sincronizzazione',
  cancelIndexing: "Annulla l'indicizzazione",
  noFolders: 'Nessuna cartella configurata',
  noProject: 'Seleziona prima un progetto',
  addFolderHint: "Aggiungi cartelle esterne per abilitare i suggerimenti dei percorsi file nell'editor",
  browserMode: "La sincronizzazione file è disponibile nell'app desktop",
  status: {
    pending: 'In attesa',
    indexing: 'Indicizzazione',
    indexed: 'Indicizzato',
    error: 'Errore',
  },
},
```

### ar-SA:

```typescript
fileSync: {
  title: 'مزامنة الملفات',
  selectFolder: 'اختر مجلد',
  addFolder: 'إضافة مجلد',
  removeFolder: 'إزالة المجلد',
  syncNow: 'مزامنة الآن',
  syncAll: 'مزامنة الكل',
  upToDate: 'محدث',
  needsSync: 'يحتاج مزامنة',
  indexing: 'جاري الفهرسة...',
  filesIndexed: 'ملفات مفهرسة',
  folderCount: '{count} مجلد | {count} مجلدات',
  fileCount: '{count} ملف | {count} ملفات',
  hasErrors: '{count} خطأ مزامنة | {count} أخطاء مزامنة',
  cancelIndexing: 'إلغاء الفهرسة',
  noFolders: 'لا توجد مجلدات مُعدة',
  noProject: 'اختر مشروعاً أولاً',
  addFolderHint: 'أضف مجلدات خارجية لتفعيل اقتراحات مسارات الملفات في المحرر',
  browserMode: 'مزامنة الملفات متوفرة في تطبيق سطح المكتب',
  status: {
    pending: 'قيد الانتظار',
    indexing: 'فهرسة',
    indexed: 'مفهرس',
    error: 'خطأ',
  },
},
```

Make sure to add the `fileSync` section in the same location in each file (after an existing section, maintaining alphabetical order is nice but not required).

```

---

## 4. Summary

This implementation plan provides a comprehensive approach to adding File Sync functionality to MyndPrompts. The feature consists of:

| Layer | Tasks | Description |
|-------|-------|-------------|
| **Data** | 1, 4 | IndexedDB schema and Pinia store for state management |
| **Backend** | 2, 3, 7 | Main process indexer service, IPC handlers, file watching |
| **UI** | 5, 6, 10 | Settings panel, status bar, help documentation |
| **Editor** | 8, 9 | Monaco completion providers for `^` and `@` triggers |
| **Startup** | 11 | Background indexing boot file |
| **i18n** | 12 | Localization for 10 languages |

### Implementation Order

Recommended order based on dependencies:

1. **Task 1** - Schema (foundation)
2. **Task 2** - FileIndexerService (backend)
3. **Task 3** - IPC handlers (connect backend to frontend)
4. **Task 4** - FileSyncStore (state management)
5. **Task 12** - Localization (needed for UI)
6. **Task 5** - Settings UI
7. **Task 6** - StatusBar progress
8. **Task 8** - FilePathProvider (^ trigger)
9. **Task 9** - Extend @ trigger
10. **Task 10** - Help documentation
11. **Task 7** - File watcher integration
12. **Task 11** - Background indexing

Each task is self-contained with clear dependencies and can be implemented incrementally.
```
