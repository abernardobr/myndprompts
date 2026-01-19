# MyndPrompts Architecture Document

**Version**: 0.1.0
**Last Updated**: January 2026
**License**: MIT

---

## Table of Contents

1. [Overview](#1-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Directory Structure](#4-directory-structure)
5. [Component Architecture](#5-component-architecture)
6. [State Management](#6-state-management)
7. [Data Flow & Communication](#7-data-flow--communication)
8. [Electron Integration](#8-electron-integration)
9. [Services Layer](#9-services-layer)
10. [Data Persistence](#10-data-persistence)
11. [Internationalization](#11-internationalization)
12. [Build & Configuration](#12-build--configuration)
13. [Security Considerations](#13-security-considerations)
14. [Architectural Patterns](#14-architectural-patterns)
15. [Future Considerations](#15-future-considerations)

---

## 1. Overview

### 1.1 Purpose

MyndPrompts is a desktop application designed for managing, organizing, and optimizing prompts for AI coding tools. It serves as an "AI Prompt Manager" that enables developers to:

- Create and organize AI prompts into projects and categories
- Manage reusable snippets (personas, templates, code snippets, text snippets)
- Integrate with Git for version control of prompts
- Support multiple AI providers (Anthropic, OpenAI, Google, XAI, Ollama)
- Persist data locally with IndexedDB and file system storage

### 1.2 Key Features

- **VSCode-like Interface**: Familiar IDE layout with activity bar, sidebar, editor area, and panels
- **Monaco Editor Integration**: Professional code editing with syntax highlighting and IntelliSense
- **Git Integration**: Full version control support for prompts and projects
- **Multi-language Support**: 10 supported languages
- **Cross-platform**: Runs on macOS, Windows, and Linux
- **Offline-first**: All data stored locally with optional cloud sync capabilities

### 1.3 Target Users

- Software developers using AI coding assistants
- Prompt engineers managing prompt libraries
- Teams collaborating on AI-assisted development workflows

---

## 2. Technology Stack

### 2.1 Core Framework & UI

| Technology | Version | Purpose                              |
| ---------- | ------- | ------------------------------------ |
| Vue 3      | 3.4.18  | Progressive JavaScript framework     |
| TypeScript | 5.3.3   | Static typing                        |
| Quasar     | 2.14.2  | Vue 3 UI framework (Material Design) |
| Vue Router | 4.2.5   | Client-side routing                  |
| Pinia      | 2.1.7   | State management                     |
| Vue I18n   | 9.9.0   | Internationalization                 |

### 2.2 Desktop & IPC

| Technology       | Version | Purpose                       |
| ---------------- | ------- | ----------------------------- |
| Electron         | 40.0.0  | Desktop application framework |
| Electron Builder | 24.9.1  | Build and packaging           |
| Simple-git       | 3.30.0  | Git operations                |
| Chokidar         | 3.6.0   | File system watching          |

### 2.3 Editor & Code Support

| Technology    | Version | Purpose                       |
| ------------- | ------- | ----------------------------- |
| Monaco Editor | 0.55.1  | Code editor (VSCode's editor) |
| Gray-matter   | 4.0.3   | YAML frontmatter parsing      |
| Splitpanes    | 3.2.0   | Resizable pane components     |

### 2.4 Data Persistence

| Technology | Version | Purpose                    |
| ---------- | ------- | -------------------------- |
| Dexie      | 4.0.1   | IndexedDB wrapper          |
| Buffer     | 6.0.3   | Node.js Buffer for browser |

### 2.5 Build & Development Tools

| Technology       | Version | Purpose                 |
| ---------------- | ------- | ----------------------- |
| @quasar/app-vite | 2.0.9   | Quasar Vite integration |
| Vite             | 5.0.12  | Modern build tool       |
| Vitest           | 1.2.1   | Unit testing            |
| ESLint           | 8.56.0  | Code linting            |
| Prettier         | 3.2.4   | Code formatting         |
| Husky            | 9.0.6   | Git hooks               |
| Sass             | 1.70.0  | CSS preprocessing       |

---

## 3. System Architecture

### 3.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MyndPrompts Desktop Application                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │              Vue 3 Renderer Process (UI Layer)              │    │
│  │  ┌────────────────────────────────────────────────────┐    │    │
│  │  │        MainLayout (VSCode-like Structure)          │    │    │
│  │  │  ├─ ActivityBar     │ Fixed 48px left bar          │    │    │
│  │  │  ├─ Sidebar         │ Resizable 280px panel        │    │    │
│  │  │  ├─ EditorArea      │ Split pane Monaco editors    │    │    │
│  │  │  ├─ BottomPanel     │ Resizable 200px panel        │    │    │
│  │  │  └─ StatusBar       │ Fixed 22px bottom bar        │    │    │
│  │  └────────────────────────────────────────────────────┘    │    │
│  └────────────────────────────────────────────────────────────┘    │
│                               │                                      │
│                               ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │              Pinia State Management (8 Stores)              │    │
│  │  appStore │ projectStore │ promptStore │ snippetStore       │    │
│  │  gitStore │ uiStore │ settingsStore                         │    │
│  └────────────────────────────────────────────────────────────┘    │
│                               │                                      │
│                               ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                   Service Layer                             │    │
│  │  PromptFileService │ GitService │ FrontmatterService        │    │
│  │  Storage Repositories (8 repositories)                      │    │
│  └────────────────────────────────────────────────────────────┘    │
│                               │                                      │
│                               ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │           Preload Script (Secure IPC Bridge)                │    │
│  │  electronAPI │ fileSystemAPI │ gitAPI                       │    │
│  └────────────────────────────────────────────────────────────┘    │
│                               │                                      │
├───────────────────────────────┼──────────────────────────────────────┤
│                               ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │            Electron Main Process (Node.js)                  │    │
│  │  FileSystemService │ FileWatcherService │ GitService        │    │
│  │  IPC Handlers │ Application Menu                            │    │
│  └────────────────────────────────────────────────────────────┘    │
│                               │                                      │
│                               ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                 Data Storage Layer                          │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │    │
│  │  │   IndexedDB  │  │ File System  │  │     Git      │     │    │
│  │  │   (Dexie)    │  │ (~/.mynd*)   │  │ Repositories │     │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Process Architecture

MyndPrompts follows Electron's multi-process architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                     Main Process                             │
│  ├─ Application lifecycle management                        │
│  ├─ Native OS integration (menus, dialogs)                  │
│  ├─ File system operations (Node.js fs)                     │
│  ├─ Git operations (simple-git)                             │
│  └─ IPC message handling                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                    IPC (Inter-Process Communication)
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Preload Script                            │
│  ├─ Secure bridge between main and renderer                 │
│  ├─ Exposes controlled APIs via contextBridge               │
│  └─ Validates and sanitizes data                            │
└─────────────────────────────────────────────────────────────┘
                              │
                    contextBridge API
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Renderer Process                           │
│  ├─ Vue 3 application                                       │
│  ├─ UI rendering and interaction                            │
│  ├─ State management (Pinia)                                │
│  └─ Business logic services                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Directory Structure

```
myndprompts/
├── src/                              # Main source code
│   ├── assets/                       # Static assets (images, icons)
│   ├── boot/                         # Quasar boot files
│   │   ├── i18n.ts                  # Internationalization setup
│   │   └── error-handler.ts         # Global error handling
│   ├── components/                   # Vue components (28+ components)
│   │   ├── common/                  # Shared components
│   │   ├── dialogs/                 # Modal dialogs (13 types)
│   │   ├── editor/                  # Editor components
│   │   ├── layout/                  # Layout components
│   │   │   ├── sidebar/            # Sidebar panels (7 panels)
│   │   │   └── *.vue               # Main layout components
│   │   ├── prompt/                  # Prompt-specific components
│   │   └── settings/                # Settings components
│   ├── composables/                 # Vue composables
│   │   ├── useAutoSave.ts          # Auto-save functionality
│   │   ├── usePrompts.ts           # Prompt operations
│   │   └── useTheme.ts             # Theme management
│   ├── css/                         # Global styles
│   ├── electron/                    # Electron-specific code
│   │   ├── main/                   # Main process services
│   │   │   └── services/           # Backend services
│   │   └── preload/                # Preload script
│   ├── i18n/                        # Internationalization (10 locales)
│   ├── layouts/                     # Page layouts
│   ├── pages/                       # Page components
│   ├── router/                      # Vue Router configuration
│   ├── services/                    # Business logic services
│   │   ├── ai/                     # AI provider services
│   │   ├── file-system/            # File operations
│   │   ├── git/                    # Git integration
│   │   ├── storage/                # IndexedDB persistence
│   │   │   ├── repositories/       # Data access objects (8 repos)
│   │   │   └── migrations/         # Database migrations
│   │   └── sync/                   # Cloud sync (placeholder)
│   ├── stores/                      # Pinia stores (8 stores)
│   ├── types/                       # TypeScript definitions
│   └── utils/                       # Utility functions
│
├── src-electron/                    # Electron main process entry
│   ├── electron-main.ts            # Main entry point
│   └── icons/                      # Application icons
│
├── scripts/                         # Build scripts
├── documents/                       # Documentation
│   └── architecture/               # Architecture docs
│
├── Configuration files:
│   ├── quasar.config.ts            # Quasar build config
│   ├── tsconfig.json               # TypeScript config
│   ├── vitest.config.ts            # Test config
│   ├── .eslintrc.cjs               # ESLint rules
│   ├── .prettierrc                 # Prettier config
│   └── package.json                # Dependencies
│
└── dist/                            # Build output
```

---

## 5. Component Architecture

### 5.1 Layout System

The application uses a VSCode-inspired layout with resizable panes:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Window                        │
├──────┬──────────────────────────────────────────────────────────┤
│      │                                                          │
│  A   │                     EditorArea                           │
│  c   │  ┌─────────────────────────────────────────────────┐   │
│  t   │  │                    TabBar                        │   │
│  i   │  ├─────────────────────────────────────────────────┤   │
│  v   │  │                                                  │   │
│  i   │  │               EditorPane                         │   │
│  t   │  │            (Monaco Editor)                       │   │
│  y   │  │                                                  │   │
│  B   │  │                                                  │   │
│  a   │  └─────────────────────────────────────────────────┘   │
│  r   │                                                          │
│      ├──────────────────────────────────────────────────────────┤
│ 48px │                    BottomPanel                           │
│      │        (Output, Problems, Git Changes, AI Chat)          │
├──────┴──────────────────────────────────────────────────────────┤
│                         StatusBar (22px)                         │
└─────────────────────────────────────────────────────────────────┘
     │
     │  Sidebar (280px, collapsible)
     │  ┌─────────────────────┐
     │  │   Panel Content     │
     │  │   (Context-based)   │
     │  │   - Explorer        │
     │  │   - Search          │
     │  │   - Snippets        │
     │  │   - Favorites       │
     │  │   - Git             │
     │  │   - AI              │
     │  │   - Settings        │
     │  └─────────────────────┘
```

### 5.2 Component Hierarchy

```
App.vue
└── MainLayout.vue
    ├── ActivityBar.vue           # Navigation icons
    ├── Sidebar.vue               # Dynamic panel container
    │   ├── ExplorerPanel.vue    # File/project browser
    │   ├── SearchPanel.vue      # Search functionality
    │   ├── SnippetsPanel.vue    # Snippet library
    │   ├── FavoritesPanel.vue   # Favorite prompts
    │   ├── GitPanel.vue         # Git operations
    │   ├── AIPanel.vue          # AI provider config
    │   └── SettingsPanel.vue    # App settings
    ├── EditorArea.vue           # Main content
    │   ├── TabBar.vue           # Open file tabs
    │   └── EditorPane.vue       # Editor instances
    │       └── MonacoEditor.vue # Monaco wrapper
    ├── BottomPanel.vue          # Collapsible panels
    └── StatusBar.vue            # Status information
```

### 5.3 Dialog Components

| Dialog              | Purpose                   |
| ------------------- | ------------------------- |
| NewPromptDialog     | Create new prompt file    |
| EditPromptDialog    | Edit prompt metadata      |
| NewProjectDialog    | Create new project        |
| NewDirectoryDialog  | Create subdirectory       |
| NewSnippetDialog    | Create snippet            |
| RenameDialog        | Rename files/directories  |
| DeleteConfirmDialog | Confirm deletion          |
| OpenPromptDialog    | File open dialog          |
| GitSetupDialog      | Initialize Git repository |
| GitHistoryDialog    | View commit history       |
| BranchDialog        | Branch management         |

---

## 6. State Management

### 6.1 Store Architecture

MyndPrompts uses Pinia for state management with 8 specialized stores:

```
┌─────────────────────────────────────────────────────────────┐
│                      Pinia Stores                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  appStore   │  │projectStore │  │ promptStore │        │
│  │  ─────────  │  │  ─────────  │  │  ─────────  │        │
│  │ • isLoading │  │ • projects  │  │ • prompts   │        │
│  │ • version   │  │ • dirCache  │  │ • cache     │        │
│  │ • platform  │  │ • expanded  │  │ • recent    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │snippetStore │  │  gitStore   │  │   uiStore   │        │
│  │  ─────────  │  │  ─────────  │  │  ─────────  │        │
│  │ • snippets  │  │ • status    │  │ • sidebar   │        │
│  │ • cache     │  │ • commits   │  │ • panel     │        │
│  │ • shortcuts │  │ • branches  │  │ • tabs      │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                              │
│  ┌─────────────┐                                            │
│  │settingsStore│                                            │
│  │  ─────────  │                                            │
│  │ • categories│                                            │
│  │ • config    │                                            │
│  └─────────────┘                                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Store Details

#### appStore

- **Purpose**: Application-level state
- **State**: `isLoading`, `appVersion`, `platform`, `userDataPath`
- **Actions**: `initialize()`, `setLoading()`

#### projectStore

- **Purpose**: Project and directory management
- **State**: `allProjects`, `directoryTreeCache`, `expandedDirectories`
- **Features**: Auto-sync from filesystem, directory tree caching, CRUD operations

#### promptStore

- **Purpose**: Prompt file management
- **State**: `promptCache`, `allPrompts`, `recentFiles`, `hasUnsavedPrompts`
- **Features**: File change watching, recent files tracking, favorites

#### snippetStore

- **Purpose**: Snippet management
- **State**: `allSnippets`, `snippetCache`, `shortcutMap`
- **Computed**: `personaSnippets`, `textSnippets`, `codeSnippets`, `templateSnippets`
- **Features**: Monaco editor snippet provider, type filtering

#### gitStore

- **Purpose**: Git repository state
- **State**: `isRepo`, `statusSummary`, `commits`, `branches`, `currentBranch`, `remotes`
- **Computed**: `hasChanges`, `hasStagedChanges`, `changeCount`, `aheadBehind`
- **Actions**: 20+ Git operations

#### uiStore

- **Purpose**: UI layout and theme
- **State**: `sidebarWidth`, `panelHeight`, `activeActivity`, `theme`, `locale`, `openTabs`
- **Features**: Auto-persistence to IndexedDB

#### settingsStore

- **Purpose**: Application settings
- **State**: `categories`
- **Features**: Category CRUD, reordering

### 6.3 State Flow

```
┌──────────────┐    Action     ┌──────────────┐    Service    ┌──────────────┐
│  Component   │ ───────────▶ │    Store     │ ───────────▶ │   Service    │
└──────────────┘              └──────────────┘              └──────────────┘
       ▲                             │                             │
       │                             │                             ▼
       │                             │                      ┌──────────────┐
       │          Reactive           │         IPC          │    Main      │
       │◀──────── Update ────────────│◀─────────────────────│   Process    │
       │                             │                      └──────────────┘
```

---

## 7. Data Flow & Communication

### 7.1 IPC Communication Pattern

```
Renderer Process                    Main Process
┌─────────────────────┐            ┌─────────────────────┐
│                     │            │                     │
│  Vue Component      │            │  IPC Handler        │
│        │            │            │        │            │
│        ▼            │            │        ▼            │
│  Store Action       │            │  Service Method     │
│        │            │            │        │            │
│        ▼            │            │        ▼            │
│  Service Call       │   IPC      │  Node.js API        │
│        │            │ ────────▶ │        │            │
│        │            │            │        │            │
│        │            │   Result   │        ▼            │
│        │            │ ◀──────── │  Return Data        │
│        ▼            │            │                     │
│  Update State       │            │                     │
│                     │            │                     │
└─────────────────────┘            └─────────────────────┘
```

### 7.2 File System Operations

```
Vue Component
     │
     ▼
promptStore.loadPrompt(path)
     │
     ▼
PromptFileService.read(path)
     │
     ▼
window.fileSystemAPI.readFile(path)
     │
     ▼ (IPC)
FileSystemService.readFile(path)
     │
     ▼
fs.readFile(validatedPath)
     │
     ▼ (Response)
FrontmatterService.parse(content)
     │
     ▼
Return typed Prompt object
```

### 7.3 File Watching Flow

```
File System Change
     │
     ▼
FileWatcherService (chokidar)
     │
     ▼
IPC Event Broadcast
     │
     ▼
Preload: onFileChange callback
     │
     ▼
promptStore.handleFileChange()
     │
     ▼
Update cache & UI
```

---

## 8. Electron Integration

### 8.1 Main Process Entry

**File**: `src-electron/electron-main.ts`

**Responsibilities**:

- Create and manage BrowserWindow
- Set up platform-specific application menu
- Initialize main process services
- Register IPC handlers
- Handle application lifecycle events

### 8.2 Preload Script APIs

**File**: `src/electron/preload/index.ts`

Three APIs exposed via `contextBridge`:

#### electronAPI

```typescript
interface ElectronAPI {
  getVersion(): Promise<string>;
  getPlatform(): Promise<string>;
  getUserDataPath(): Promise<string>;
  showOpenDialog(options): Promise<OpenDialogReturnValue>;
  showSaveDialog(options): Promise<SaveDialogReturnValue>;
}
```

#### fileSystemAPI

```typescript
interface FileSystemAPI {
  // File operations
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  copyFile(src: string, dest: string): Promise<void>;
  moveFile(src: string, dest: string): Promise<void>;

  // Directory operations
  listDirectory(path: string): Promise<FileEntry[]>;
  createDirectory(path: string): Promise<void>;
  deleteDirectory(path: string): Promise<void>;
  renameDirectory(oldPath: string, newPath: string): Promise<void>;

  // Path utilities
  joinPath(...paths: string[]): Promise<string>;
  resolvePath(...paths: string[]): Promise<string>;
  getExtension(path: string): Promise<string>;

  // File watching
  watchDirectory(path: string): Promise<void>;
  unwatchDirectory(path: string): Promise<void>;
  onFileChange(callback: (event, path) => void): void;

  // Directory tree
  listDirectoryTree(path: string): Promise<DirectoryTree>;
  listMarkdownFiles(path: string): Promise<string[]>;
}
```

#### gitAPI

```typescript
interface GitAPI {
  // Repository
  init(path: string): Promise<void>;
  clone(url: string, path: string): Promise<void>;
  isRepo(path: string): Promise<boolean>;
  setWorkingDirectory(path: string): Promise<void>;

  // Status
  status(): Promise<StatusResult>;
  getFileStatus(path: string): Promise<FileStatus>;

  // Staging
  add(files: string[]): Promise<void>;
  unstage(files: string[]): Promise<void>;
  commit(message: string): Promise<void>;

  // History
  log(options?: LogOptions): Promise<Commit[]>;
  diff(options?: DiffOptions): Promise<string>;

  // Branches
  listBranches(): Promise<BranchSummary>;
  createBranch(name: string): Promise<void>;
  deleteBranch(name: string): Promise<void>;
  checkout(branch: string): Promise<void>;
  merge(branch: string): Promise<void>;

  // Remotes
  listRemotes(): Promise<Remote[]>;
  addRemote(name: string, url: string): Promise<void>;
  removeRemote(name: string): Promise<void>;
  push(remote?: string, branch?: string): Promise<void>;
  pull(remote?: string, branch?: string): Promise<void>;

  // Stash
  stash(): Promise<void>;
  stashPop(): Promise<void>;
  stashList(): Promise<StashEntry[]>;
}
```

### 8.3 Main Process Services

#### FileSystemService

- Path validation (prevents traversal attacks)
- Directory initialization
- CRUD operations for files and directories
- Security: Restricts operations to base directory

#### FileWatcherService

- Uses Chokidar for file monitoring
- Event aggregation with debouncing
- Multiple watcher management
- IPC event broadcasting to renderer

#### GitService

- Wraps simple-git library
- Status parsing and normalization
- Commit history retrieval
- Branch and remote management

### 8.4 Application Menu

Platform-specific menus:

| Platform | Features                             |
| -------- | ------------------------------------ |
| macOS    | App menu with Services, Hide, Quit   |
| All      | File, Edit, View, Window, Help menus |
| Dev      | Developer Tools toggle               |

Menu actions trigger IPC events to renderer process.

---

## 9. Services Layer

### 9.1 Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Services                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              PromptFileService                       │   │
│  │  • High-level file API                              │   │
│  │  • YAML frontmatter parsing                         │   │
│  │  • File caching                                     │   │
│  │  • Change notification                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              FrontmatterService                      │   │
│  │  • Uses gray-matter library                         │   │
│  │  • Parses YAML metadata                             │   │
│  │  • Serializes back to markdown                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              GitService (Frontend)                   │   │
│  │  • Wrapper for gitAPI                               │   │
│  │  • Typed return values                              │   │
│  │  • Electron detection                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                     Preload Bridge
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Backend Services                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              FileSystemService                       │   │
│  │  • Path validation                                  │   │
│  │  • File I/O operations                              │   │
│  │  • Directory management                             │   │
│  │  • Security enforcement                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              FileWatcherService                      │   │
│  │  • Chokidar integration                             │   │
│  │  • Event debouncing                                 │   │
│  │  • Multi-path watching                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              GitService (Backend)                    │   │
│  │  • simple-git integration                           │   │
│  │  • Repository operations                            │   │
│  │  • Status and history                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 Repository Pattern

All storage repositories inherit from `BaseRepository<T, K>`:

```typescript
abstract class BaseRepository<T, K> {
  abstract tableName: string;

  async getAll(): Promise<T[]>;
  async getById(id: K): Promise<T | undefined>;
  async create(entity: T): Promise<K>;
  async update(id: K, changes: Partial<T>): Promise<number>;
  async delete(id: K): Promise<number>;
}
```

**Repositories**:

| Repository             | Purpose                       |
| ---------------------- | ----------------------------- |
| AuthRepository         | User authentication state     |
| ConfigRepository       | App configuration (key-value) |
| UIStateRepository      | Layout preferences            |
| RecentFilesRepository  | Recently opened files         |
| SyncStatusRepository   | Cloud sync tracking           |
| GitStatusRepository    | Git state cache               |
| AIProvidersRepository  | AI provider configuration     |
| ProjectIndexRepository | Project search index          |
| ProjectRepository      | Project metadata              |

---

## 10. Data Persistence

### 10.1 Storage Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Data Persistence                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              IndexedDB (via Dexie)                   │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │ userAuth      │ User authentication state     │  │   │
│  │  │ appConfig     │ Key-value configuration       │  │   │
│  │  │ uiState       │ Layout preferences            │  │   │
│  │  │ recentFiles   │ Recently opened files         │  │   │
│  │  │ projects      │ Project metadata              │  │   │
│  │  │ projectIndex  │ Cached project index          │  │   │
│  │  │ syncStatus    │ Sync state                    │  │   │
│  │  │ gitStatus     │ Git status tracking           │  │   │
│  │  │ aiProviders   │ AI provider config            │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              File System                             │   │
│  │  ~/.myndprompts/                                    │   │
│  │  ├── prompts/       # Prompt files (.md)           │   │
│  │  ├── snippets/      # Snippet files (.md)          │   │
│  │  │   ├── personas/  # Persona snippets             │   │
│  │  │   ├── templates/ # Template snippets            │   │
│  │  │   ├── code/      # Code snippets                │   │
│  │  │   └── text/      # Text snippets                │   │
│  │  ├── projects/      # User project directories     │   │
│  │  └── backups/       # Backup files                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Git Repositories                        │   │
│  │  • Version control for prompt files                 │   │
│  │  • Branch-based workflow support                    │   │
│  │  • Remote synchronization                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 File Format

All prompts and snippets use Markdown with YAML frontmatter:

```markdown
---
id: '550e8400-e29b-41d4-a716-446655440000'
title: 'Code Review Assistant'
description: 'A prompt for conducting thorough code reviews'
category: 'development'
tags: ['code-review', 'quality', 'best-practices']
aiProvider: 'anthropic'
isFavorite: true
isPinned: false
createdAt: '2024-01-19T10:00:00.000Z'
updatedAt: '2024-01-19T15:30:00.000Z'
version: 2
---

# Code Review Assistant

You are an expert code reviewer. When reviewing code, focus on:

1. **Code Quality**: Check for clean code principles
2. **Performance**: Identify potential bottlenecks
3. **Security**: Look for vulnerabilities
4. **Best Practices**: Ensure patterns are followed

## Instructions

When I share code with you, provide a structured review...
```

### 10.3 Database Migrations

Migrations are managed through version-specific files:

```
src/services/storage/migrations/
├── v1.ts        # Initial schema
└── index.ts     # Migration runner
```

---

## 11. Internationalization

### 11.1 Supported Locales

| Code  | Language   | Region         |
| ----- | ---------- | -------------- |
| en-US | English    | United States  |
| en-GB | English    | United Kingdom |
| en-IE | English    | Ireland        |
| pt-BR | Portuguese | Brazil         |
| pt-PT | Portuguese | Portugal       |
| es-ES | Spanish    | Spain          |
| fr-FR | French     | France         |
| de-DE | German     | Germany        |
| it-IT | Italian    | Italy          |
| ar-SA | Arabic     | Saudi Arabia   |

### 11.2 Implementation

**Framework**: Vue-i18n 9.9.0 (Composition API mode)

**Configuration** (`src/boot/i18n.ts`):

```typescript
const i18n = createI18n({
  locale: 'en-US',
  fallbackLocale: 'en-US',
  legacy: false,
  globalInjection: true,
  missingWarn: false,
  fallbackWarn: false,
  messages,
});
```

### 11.3 Translation Structure

```typescript
// src/i18n/en-US/index.ts
export default {
  app: {
    name: 'MyndPrompts',
    tagline: 'AI Prompt Manager',
  },
  welcome: {
    title: 'Welcome to MyndPrompts',
    subtitle: 'Your AI Prompt Companion',
  },
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    // ...
  },
  activityBar: {
    explorer: 'Explorer',
    search: 'Search',
    // ...
  },
  // Additional sections...
};
```

### 11.4 Usage in Components

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t, locale } = useI18n({ useScope: 'global' });
</script>

<template>
  <h1>{{ t('welcome.title') }}</h1>
  <button>{{ t('common.save') }}</button>
</template>
```

---

## 12. Build & Configuration

### 12.1 Build Configuration

**quasar.config.ts** key settings:

```typescript
{
  build: {
    target: {
      browser: ['es2022', 'chrome100', 'firefox100', 'safari15'],
      node: 'node20'
    },
    typescript: { strict: true }
  },

  electron: {
    bundler: 'builder',
    builder: {
      appId: 'com.myndprompt.app',
      productName: 'MyndPrompts',

      mac: {
        category: 'public.app-category.developer-tools',
        target: ['dmg', 'zip'],
        icon: 'src-electron/icons/icon.icns'
      },

      win: {
        target: ['nsis', 'portable'],
        icon: 'src-electron/icons/icon.ico'
      },

      linux: {
        category: 'Development',
        target: ['AppImage', 'deb'],
        icon: 'src-electron/icons/icon.png'
      }
    }
  }
}
```

### 12.2 Path Aliases

```typescript
{
  '@': './src',
  '@components': './src/components',
  '@composables': './src/composables',
  '@services': './src/services',
  '@stores': './src/stores',
  '@types': './src/types',
  '@utils': './src/utils'
}
```

### 12.3 NPM Scripts

| Script                 | Description               |
| ---------------------- | ------------------------- |
| `dev`                  | Development server (web)  |
| `dev:electron`         | Development with Electron |
| `build`                | Production build          |
| `build:electron`       | Build Electron app        |
| `build:electron:mac`   | macOS build               |
| `build:electron:win`   | Windows build             |
| `build:electron:linux` | Linux build               |
| `build:electron:all`   | All platforms             |
| `lint`                 | Run ESLint                |
| `lint:fix`             | Fix linting issues        |
| `format`               | Format with Prettier      |
| `type-check`           | TypeScript checking       |
| `test`                 | Run Vitest                |
| `test:coverage`        | Test with coverage        |

### 12.4 TypeScript Configuration

**tsconfig.json** highlights:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "strict": true,
    "jsx": "preserve",
    "jsxImportSource": "vue",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

---

## 13. Security Considerations

### 13.1 Electron Security

- **Context Isolation**: Enabled (renderer cannot directly access Node.js)
- **Node Integration**: Disabled in renderer
- **Preload Script**: Only exposes specific, validated APIs
- **Path Validation**: All file operations validate paths to prevent traversal

### 13.2 Path Traversal Prevention

```typescript
// FileSystemService validates all paths
validatePath(path: string): string {
  const resolved = resolve(this.baseDir, path);
  if (!resolved.startsWith(this.baseDir)) {
    throw new Error('Path traversal attempt detected');
  }
  return resolved;
}
```

### 13.3 IPC Security

- All IPC channels are explicitly defined
- Data is validated before processing
- Error messages don't expose system information

### 13.4 Data Protection

- All data stored locally (no cloud by default)
- No sensitive data in logs
- Git credentials handled by system Git

---

## 14. Architectural Patterns

### 14.1 Design Patterns Used

| Pattern         | Usage                                             |
| --------------- | ------------------------------------------------- |
| **Singleton**   | Service instances (GitService, FileSystemService) |
| **Repository**  | Data access abstraction                           |
| **Observer**    | File watching and events                          |
| **Composition** | Vue composables for reusable logic                |
| **Bridge**      | IPC communication between processes               |
| **Factory**     | Component creation                                |
| **Strategy**    | AI provider implementations                       |

### 14.2 State Management Patterns

- **Single Source of Truth**: All state in Pinia stores
- **Unidirectional Data Flow**: Actions → State → View
- **Computed Properties**: Derived state via getters
- **Watchers**: Side effects and persistence

### 14.3 Component Patterns

- **Composition API**: All components use `<script setup>`
- **Props Down, Events Up**: Parent-child communication
- **Provide/Inject**: Deep component tree communication
- **Slots**: Component composition

---

## 15. Future Considerations

### 15.1 Planned Features

- **Cloud Sync**: Optional synchronization with cloud storage
- **AI Chat Integration**: Direct AI interaction within the app
- **Team Collaboration**: Shared prompt libraries
- **Prompt Templates**: Parameterized prompt templates
- **Analytics**: Usage statistics and insights

### 15.2 Technical Improvements

- **Plugin System**: Extensibility via plugins
- **Custom Themes**: User-defined color schemes
- **Keyboard Shortcuts**: Customizable shortcuts
- **Performance**: Virtual scrolling for large lists
- **Testing**: Expanded test coverage

### 15.3 Architecture Evolution

- **Micro-frontend**: Modular UI components
- **Worker Threads**: Background processing
- **WebSocket**: Real-time collaboration
- **Native Modules**: Platform-specific features

---

## Appendix A: File Types

### Prompt File (.md)

```yaml
---
id: string (UUID)
title: string
description: string
category: string
tags: string[]
aiProvider: string
isFavorite: boolean
isPinned: boolean
createdAt: ISO date string
updatedAt: ISO date string
version: number
---
```

### Snippet File (.md)

```yaml
---
id: string (UUID)
title: string
description: string
type: 'persona' | 'template' | 'code' | 'text'
shortcut: string (optional)
language: string (for code snippets)
createdAt: ISO date string
updatedAt: ISO date string
---
```

---

## Appendix B: API Reference

See the dedicated API documentation for complete endpoint and method references.

---

## Appendix C: Glossary

| Term             | Definition                                       |
| ---------------- | ------------------------------------------------ |
| **Prompt**       | An AI instruction stored as a markdown file      |
| **Snippet**      | Reusable content (persona, template, code, text) |
| **Project**      | A directory containing related prompts           |
| **Activity Bar** | Vertical icon bar for navigation                 |
| **Sidebar**      | Collapsible panel showing activity content       |
| **Pane**         | Resizable section of the UI                      |
| **Frontmatter**  | YAML metadata at the start of markdown files     |

---

_This document is maintained as part of the MyndPrompts project. For updates and contributions, please refer to the project repository._
