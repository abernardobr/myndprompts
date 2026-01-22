# Plugin System Implementation - v1.0

## Executive Summary

This document outlines the implementation of a plugin system for MyndPrompts that allows users to discover, install, and manage plugins from a centralized marketplace. The system integrates with IndexedDB for local storage and provides a seamless UI experience within the Settings dialog.

---

## 1. Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MyndPrompts App                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐  │
│  │  Settings       │    │  Explorer       │    │  Plugin Content         │  │
│  │  Dialog         │    │  Panel          │    │  Selector Dialog        │  │
│  │  ┌───────────┐  │    │  ┌───────────┐  │    │  (Common Component)     │  │
│  │  │ Plugins   │  │    │  │ Context   │  │    │  ┌───────────────────┐  │  │
│  │  │ Section   │  │    │  │ Menu      │  │    │  │ - Filter by tags  │  │  │
│  │  │┌─────────┐│  │    │  │"Add from  │  │    │  │ - Multi-select    │  │  │
│  │  ││Market-  ││  │    │  │ Library"  │  │    │  │ - Select all      │  │  │
│  │  ││place    ││  │    │  └───────────┘  │    │  │ - Cancel/Add      │  │  │
│  │  │├─────────┤│  │    │                 │    │  └───────────────────┘  │  │
│  │  ││Installed││  │    │                 │    │                         │  │
│  │  │└─────────┘│  │    │                 │    │                         │  │
│  │  └───────────┘  │    │                 │    │                         │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────────┤
│                              Service Layer                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        Plugin Service                                │    │
│  │  - fetchMarketplacePlugins()    - installPlugin()                   │    │
│  │  - getInstalledPlugins()        - uninstallPlugin()                 │    │
│  │  - updatePlugin()               - getPluginContent()                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────────┤
│                              Store Layer (Pinia)                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        pluginStore                                   │    │
│  │  State: marketplace[], installed[], loading, error                  │    │
│  │  Actions: fetch, install, uninstall, update, filter                 │    │
│  │  Getters: availablePlugins, hasUpdates, byType, byTags              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────────┤
│                              Storage Layer                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     IndexedDB (Dexie)                                │    │
│  │  Table: plugins                                                      │    │
│  │  Schema: &id, version, type, *tags, installedAt, updatedAt          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTPS
                                      ▼
                    ┌─────────────────────────────────┐
                    │   https://myndprompts.com       │
                    │   GET /plugins                  │
                    │   Returns: Plugin[]             │
                    └─────────────────────────────────┘
```

### 1.2 Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   User       │     │   UI Layer   │     │   Store      │     │   Service    │
│   Action     │────▶│   Component  │────▶│   (Pinia)    │────▶│   Layer      │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                      │
                           ┌──────────────────────────────────────────┘
                           │
                           ▼
               ┌──────────────────────┐
               │  External API        │◀─── Marketplace data
               │  (myndprompts.com)   │
               └──────────────────────┘
                           │
                           ▼
               ┌──────────────────────┐
               │  IndexedDB           │◀─── Installed plugins
               │  (Local Storage)     │
               └──────────────────────┘
```

### 1.3 Plugin Data Model

```typescript
// Plugin from Marketplace API
interface IMarketplacePlugin {
  id: string; // UUID
  version: string; // Semantic version (e.g., "1.0.0")
  type: PluginType; // 'persona' | 'text_snippets' | 'code_snippets' | 'templates'
  tags: string[]; // e.g., ["Development", "Backend"]
  items: IPluginItem[]; // Content items
}

interface IPluginItem {
  title: string; // Display name / file title
  content: string; // Full markdown content
  language?: string; // Language code (default: 'en')
}

// Installed Plugin (extends marketplace with metadata)
interface IInstalledPlugin extends IMarketplacePlugin {
  installedAt: Date; // Installation timestamp
  updatedAt: Date; // Last update timestamp
}

// Plugin Types Enum
type PluginType = 'persona' | 'text_snippets' | 'code_snippets' | 'templates';

// Type to Explorer Directory Mapping
const PLUGIN_TYPE_DIRECTORY_MAP: Record<PluginType, string> = {
  persona: 'Personas', // ~/.myndprompt/prompts/Personas/
  text_snippets: 'Snippets', // ~/.myndprompt/snippets/ (text)
  code_snippets: 'Snippets', // ~/.myndprompt/snippets/ (code)
  templates: 'Templates', // ~/.myndprompt/prompts/Templates/
};
```

### 1.4 IndexedDB Schema

```typescript
// Dexie Schema Extension
interface MyndPromptDB extends Dexie {
  plugins: Table<IInstalledPlugin, string>;
}

// Schema definition
db.version(X).stores({
  // ... existing tables
  plugins: '&id, version, type, *tags, installedAt, updatedAt',
});
```

### 1.5 Component Hierarchy

```
SettingsDialog.vue
└── PluginsSection.vue
    ├── PluginsMarketplace.vue
    │   ├── PluginSearchBar.vue
    │   ├── PluginFilters.vue (type, tags)
    │   └── PluginCard.vue (with Install button)
    │
    └── PluginsInstalled.vue
        └── InstalledPluginCard.vue (with Update/Uninstall)

ExplorerPanel.vue
└── Context Menu → "Add from Library"
    └── PluginContentSelectorDialog.vue (reusable)
        ├── TagFilter.vue
        ├── ContentList.vue (multi-select)
        └── ActionButtons (Cancel/Add Selected)
```

---

## 2. UI Mockups (Text-Based)

### 2.1 Settings Dialog - Plugins Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Settings                                                              [X]   │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐  ┌──────────────────────────────────────────────────────┐  │
│ │ General      │  │  Plugins                                             │  │
│ │ Appearance   │  │  ┌────────────────────┬───────────────────────────┐  │  │
│ │ Editor       │  │  │ [Marketplace]      │ [Installed (3)]           │  │  │
│ │ Keyboard     │  │  ├────────────────────┴───────────────────────────┤  │  │
│ │ Git          │  │  │                                                 │  │  │
│ │ [Plugins] ◄──│  │  │  ┌─────────────────────────────────────────┐   │  │  │
│ │ Sync         │  │  │  │ 🔍 Search plugins...                    │   │  │  │
│ │              │  │  │  └─────────────────────────────────────────┘   │  │  │
│ │              │  │  │                                                 │  │  │
│ │              │  │  │  Type: [All ▼] [Persona] [Templates] [Code]    │  │  │
│ │              │  │  │  Tags: [Development ×] [Backend ×] [+ Add]     │  │  │
│ │              │  │  │                                                 │  │  │
│ │              │  │  │  ┌───────────────────────────────────────────┐ │  │  │
│ │              │  │  │  │ 📦 Development Personas           v1.0.0  │ │  │  │
│ │              │  │  │  │ Type: persona                             │ │  │  │
│ │              │  │  │  │ Tags: [Development] [Roles]               │ │  │  │
│ │              │  │  │  │ 10 items                    [INSTALL]     │ │  │  │
│ │              │  │  │  └───────────────────────────────────────────┘ │  │  │
│ │              │  │  │                                                 │  │  │
│ │              │  │  │  ┌───────────────────────────────────────────┐ │  │  │
│ │              │  │  │  │ 📦 Code Snippets Library          v1.0.0  │ │  │  │
│ │              │  │  │  │ Type: code_snippets                       │ │  │  │
│ │              │  │  │  │ Tags: [Development] [TypeScript]          │ │  │  │
│ │              │  │  │  │ 8 items                     [INSTALL]     │ │  │  │
│ │              │  │  │  └───────────────────────────────────────────┘ │  │  │
│ │              │  │  │                                                 │  │  │
│ └──────────────┘  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Settings Dialog - Installed Tab

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  │  ┌────────────────────┬───────────────────────────┐  │
│  │  │ [Marketplace]      │ [Installed (3)] ◄────────│  │
│  │  ├────────────────────┴───────────────────────────┤  │
│  │  │                                                 │  │
│  │  │  ┌───────────────────────────────────────────┐ │  │
│  │  │  │ 📦 Development Personas           v1.0.0  │ │  │
│  │  │  │ Type: persona                             │ │  │
│  │  │  │ Tags: [Development] [Roles]               │ │  │
│  │  │  │ Installed: Jan 15, 2026                   │ │  │
│  │  │  │                   [UPDATE v1.1.0] [UNINSTALL] │ │  │
│  │  │  └───────────────────────────────────────────┘ │  │
│  │  │                                                 │  │
│  │  │  ┌───────────────────────────────────────────┐ │  │
│  │  │  │ 📦 Code Snippets Library          v1.0.0  │ │  │
│  │  │  │ Type: code_snippets                       │ │  │
│  │  │  │ Tags: [Development] [TypeScript]          │ │  │
│  │  │  │ Installed: Jan 14, 2026                   │ │  │
│  │  │  │                               [UNINSTALL] │ │  │
│  │  │  └───────────────────────────────────────────┘ │  │
│  │  │                                                 │  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Plugin Content Selector Dialog (Reusable)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Add from Library - Personas                                           [X]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Tags: [All ▼] [Development ×] [+ Add tag]                                  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ [✓] Select All (10 items)                                           │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ [✓] Software Architect                                              │   │
│  │     Tags: Development, Architecture                                 │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ [✓] Senior Backend Developer                                        │   │
│  │     Tags: Development, Backend                                      │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ [ ] Senior Frontend Developer                                       │   │
│  │     Tags: Development, Frontend                                     │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ [ ] DevOps Engineer                                                 │   │
│  │     Tags: Development, DevOps                                       │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ [✓] QA Engineer                                                     │   │
│  │     Tags: Development, Testing                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  3 of 10 selected                                                           │
│                                                                             │
│                                        [CANCEL]    [ADD SELECTED (3)]       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Explorer Panel Context Menu

```
┌─────────────────────────────┐
│  > Personas              [3]│
├─────────────────────────────┤
│  Right-click menu:          │
│  ┌───────────────────────┐  │
│  │ New Prompt            │  │
│  │ New Directory         │  │
│  │ ─────────────────────│  │
│  │ Add from Library  ◄───│──│── Opens PluginContentSelectorDialog
│  │ ─────────────────────│  │
│  │ Refresh               │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

---

## 3. Todo List

### Phase 1: Core Infrastructure

- [x] **Task 1**: Create IndexedDB entity and repository for plugins
- [x] **Task 2**: Create Plugin Service for API and local operations
- [x] **Task 3**: Create Plugin Store (Pinia) for state management

### Phase 2: Settings UI

- [x] **Task 4**: Add Plugins section to Settings Dialog navigation
- [x] **Task 5**: Create PluginsSection component with tab navigation
- [x] **Task 6**: Create PluginsMarketplace component with search and filters
- [x] **Task 7**: Create PluginsInstalled component with update/uninstall

### Phase 3: Content Integration

- [x] **Task 8**: Create reusable PluginContentSelectorDialog component
- [x] **Task 9**: Add "Add from Library" context menu to Explorer Panel
- [x] **Task 10**: Implement file creation from plugin content

### Phase 4: Polish & i18n

- [x] **Task 11**: Add i18n translations for all plugin-related strings
- [x] **Task 12**: Add loading states, error handling, and toast notifications

---

## 4. Task Details

---

### Task 1: Create IndexedDB Entity and Repository for Plugins

#### Purpose

Establish the data persistence layer for installed plugins using IndexedDB via Dexie.js, following the existing repository pattern in the codebase.

#### Objective

- Define the `IPlugin` entity interface
- Update the Dexie database schema to include the `plugins` table
- Create `PluginRepository` class with CRUD operations

#### Architecture Description

```
src/services/storage/
├── entities.ts          # Add IPlugin interface
├── db.ts                # Add plugins table to schema
└── repositories/
    └── plugin.repository.ts  # NEW: Plugin CRUD operations
```

**Database Schema Addition:**

```typescript
plugins: '&id, version, type, *tags, installedAt, updatedAt';
```

**Repository Methods:**

- `getAll(): Promise<IPlugin[]>`
- `getById(id: string): Promise<IPlugin | undefined>`
- `getByType(type: PluginType): Promise<IPlugin[]>`
- `install(plugin: IPlugin): Promise<void>`
- `update(plugin: IPlugin): Promise<void>`
- `uninstall(id: string): Promise<void>`
- `isInstalled(id: string): Promise<boolean>`

#### Full Prompt

````
You are implementing the data persistence layer for a plugin system in MyndPrompts.

## Context
- MyndPrompts uses IndexedDB via Dexie.js for local storage
- The existing pattern uses entities defined in `src/services/storage/entities.ts`
- Database is configured in `src/services/storage/db.ts`
- Repositories follow the pattern in `src/services/storage/repositories/`

## Files to Modify

### 1. src/services/storage/entities.ts
Add the following interfaces:

```typescript
export type PluginType = 'persona' | 'text_snippets' | 'code_snippets' | 'templates';

export interface IPluginItem {
  title: string;
  content: string;
  language?: string;
}

export interface IPlugin {
  id: string;
  version: string;
  type: PluginType;
  tags: string[];
  items: IPluginItem[];
  installedAt: Date;
  updatedAt: Date;
}
````

### 2. src/services/storage/db.ts

Add the plugins table to the Dexie schema. Increment the version number and add:

```typescript
plugins: '&id, version, type, *tags, installedAt, updatedAt';
```

### 3. src/services/storage/repositories/plugin.repository.ts (NEW FILE)

Create a new repository following the existing BaseRepository pattern with these methods:

- `getAll()` - Get all installed plugins
- `getById(id)` - Get a specific plugin
- `getByType(type)` - Get plugins by type
- `getByTags(tags)` - Get plugins matching any of the given tags
- `install(plugin)` - Save a new plugin (set installedAt and updatedAt to now)
- `update(plugin)` - Update an existing plugin (update updatedAt)
- `uninstall(id)` - Delete a plugin by ID
- `isInstalled(id)` - Check if a plugin is installed

## Requirements

- Follow the existing code style and patterns
- Add proper TypeScript types
- Export the repository from the repositories index file
- Handle errors gracefully

```

---

### Task 2: Create Plugin Service for API and Local Operations

#### Purpose
Create a service layer that handles both fetching plugins from the marketplace API and managing locally installed plugins.

#### Objective
- Fetch available plugins from `https://www.myndprompts.com/plugins`
- Provide methods for install, update, and uninstall operations
- Compare versions to detect available updates
- Filter marketplace plugins to exclude already installed ones

#### Architecture Description

```

src/services/plugins/
├── index.ts # Export barrel
├── types.ts # Plugin-specific types
└── plugin.service.ts # Main service class

```

**Service Methods:**
- `fetchMarketplace(): Promise<IMarketplacePlugin[]>`
- `getAvailablePlugins(): Promise<IMarketplacePlugin[]>` (excludes installed)
- `installPlugin(plugin: IMarketplacePlugin): Promise<void>`
- `updatePlugin(plugin: IMarketplacePlugin): Promise<void>`
- `uninstallPlugin(id: string): Promise<void>`
- `getInstalledPlugins(): Promise<IPlugin[]>`
- `checkForUpdates(): Promise<Map<string, string>>` (id -> new version)
- `hasUpdate(installedVersion: string, marketplaceVersion: string): boolean`

#### Full Prompt

```

You are implementing a Plugin Service for MyndPrompts that handles marketplace API calls and local plugin management.

## Context

- Marketplace API: GET https://www.myndprompts.com/plugins returns Plugin[]
- Local storage uses the PluginRepository (created in Task 1)
- Need to handle network errors gracefully
- Use semantic versioning comparison for updates

## Files to Create

### 1. src/services/plugins/types.ts

```typescript
import type { PluginType, IPluginItem } from '../storage/entities';

// Plugin from marketplace (no install metadata)
export interface IMarketplacePlugin {
  id: string;
  version: string;
  type: PluginType;
  tags: string[];
  items: IPluginItem[];
}

// Update check result
export interface IPluginUpdateInfo {
  pluginId: string;
  currentVersion: string;
  availableVersion: string;
}
```

### 2. src/services/plugins/plugin.service.ts

Create a PluginService class with:

```typescript
class PluginService {
  private static instance: PluginService;
  private repository: PluginRepository;
  private marketplaceUrl = 'https://www.myndprompts.com/plugins';

  // Singleton pattern
  static getInstance(): PluginService;

  // Marketplace operations
  async fetchMarketplace(): Promise<IMarketplacePlugin[]>;
  async getAvailablePlugins(): Promise<IMarketplacePlugin[]>; // Excludes installed

  // Local operations
  async getInstalledPlugins(): Promise<IPlugin[]>;
  async installPlugin(plugin: IMarketplacePlugin): Promise<void>;
  async updatePlugin(plugin: IMarketplacePlugin): Promise<void>;
  async uninstallPlugin(id: string): Promise<void>;

  // Update checking
  async checkForUpdates(): Promise<IPluginUpdateInfo[]>;
  hasUpdate(installed: string, marketplace: string): boolean; // semver compare
}

export function getPluginService(): PluginService;
```

### 3. src/services/plugins/index.ts

Export barrel file.

## Requirements

- Use fetch API for HTTP requests
- Implement proper error handling with try/catch
- Use semver comparison (can use simple string compare for v1 since all are 1.0.0)
- Cache marketplace data for 5 minutes to avoid excessive API calls
- Filter out installed plugins from marketplace list
- Follow existing service patterns in the codebase

```

---

### Task 3: Create Plugin Store (Pinia) for State Management

#### Purpose
Create a Pinia store to manage plugin state across the application, providing reactive access to marketplace and installed plugins.

#### Objective
- Manage marketplace and installed plugins state
- Handle loading and error states
- Provide computed getters for filtering
- Actions for install, update, uninstall operations

#### Architecture Description

```

src/stores/
└── pluginStore.ts # NEW: Plugin state management

````

**State:**
```typescript
{
  marketplace: IMarketplacePlugin[];
  installed: IPlugin[];
  isLoading: boolean;
  error: string | null;
  selectedType: PluginType | null;
  selectedTags: string[];
  searchQuery: string;
}
````

**Getters:**

- `availablePlugins` - Marketplace minus installed
- `filteredMarketplace` - Filtered by type, tags, search
- `pluginsByType(type)` - Installed plugins of a type
- `hasUpdates` - Boolean if any updates available
- `updateCount` - Number of available updates
- `allTags` - Unique tags from all plugins

**Actions:**

- `initialize()` - Load installed, fetch marketplace
- `refreshMarketplace()` - Force refresh from API
- `installPlugin(plugin)` - Install and refresh lists
- `updatePlugin(plugin)` - Update and refresh
- `uninstallPlugin(id)` - Uninstall and refresh
- `setFilters(type, tags, search)` - Update filter state

#### Full Prompt

````
You are implementing a Pinia store for plugin management in MyndPrompts.

## Context
- MyndPrompts uses Pinia for state management
- Follow the existing store patterns (see promptStore.ts, projectStore.ts)
- Use the PluginService created in Task 2
- Need reactive state for UI binding

## File to Create

### src/stores/pluginStore.ts

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getPluginService } from '@/services/plugins';
import type { IPlugin, PluginType } from '@/services/storage/entities';
import type { IMarketplacePlugin, IPluginUpdateInfo } from '@/services/plugins/types';

export const usePluginStore = defineStore('plugins', () => {
  // State
  const marketplace = ref<IMarketplacePlugin[]>([]);
  const installed = ref<IPlugin[]>([]);
  const updates = ref<IPluginUpdateInfo[]>([]);
  const isLoading = ref(false);
  const isInitialized = ref(false);
  const error = ref<string | null>(null);

  // Filter state
  const searchQuery = ref('');
  const selectedTypes = ref<PluginType[]>([]);
  const selectedTags = ref<string[]>([]);

  // Getters
  const availablePlugins = computed(() => {
    const installedIds = new Set(installed.value.map(p => p.id));
    return marketplace.value.filter(p => !installedIds.has(p.id));
  });

  const filteredMarketplace = computed(() => {
    let result = availablePlugins.value;

    // Filter by search query (diacritics-insensitive)
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      result = result.filter(p => {
        const name = p.type.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const tags = p.tags.join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return name.includes(query) || tags.includes(query);
      });
    }

    // Filter by type
    if (selectedTypes.value.length > 0) {
      result = result.filter(p => selectedTypes.value.includes(p.type));
    }

    // Filter by tags
    if (selectedTags.value.length > 0) {
      result = result.filter(p =>
        p.tags.some(tag => selectedTags.value.includes(tag))
      );
    }

    return result;
  });

  const allTags = computed(() => {
    const tags = new Set<string>();
    [...marketplace.value, ...installed.value].forEach(p => {
      p.tags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  });

  const hasUpdates = computed(() => updates.value.length > 0);
  const updateCount = computed(() => updates.value.length);

  // Actions
  async function initialize(): Promise<void>;
  async function refreshMarketplace(): Promise<void>;
  async function refreshInstalled(): Promise<void>;
  async function checkForUpdates(): Promise<void>;
  async function installPlugin(plugin: IMarketplacePlugin): Promise<boolean>;
  async function updatePlugin(plugin: IMarketplacePlugin): Promise<boolean>;
  async function uninstallPlugin(id: string): Promise<boolean>;
  function setSearchQuery(query: string): void;
  function setSelectedTypes(types: PluginType[]): void;
  function setSelectedTags(tags: string[]): void;
  function clearFilters(): void;
  function getInstalledByType(type: PluginType): IPlugin[];
  function getUpdateForPlugin(id: string): IPluginUpdateInfo | undefined;

  return {
    // State
    marketplace,
    installed,
    updates,
    isLoading,
    isInitialized,
    error,
    searchQuery,
    selectedTypes,
    selectedTags,

    // Getters
    availablePlugins,
    filteredMarketplace,
    allTags,
    hasUpdates,
    updateCount,

    // Actions
    initialize,
    refreshMarketplace,
    refreshInstalled,
    checkForUpdates,
    installPlugin,
    updatePlugin,
    uninstallPlugin,
    setSearchQuery,
    setSelectedTypes,
    setSelectedTags,
    clearFilters,
    getInstalledByType,
    getUpdateForPlugin,
  };
});
````

## Requirements

- Follow the composition API pattern used in other stores
- Implement diacritics-insensitive search using normalize('NFD')
- Handle loading and error states properly
- Clear error state before each operation
- Return boolean from install/update/uninstall to indicate success

```

---

### Task 4: Add Plugins Section to Settings Dialog Navigation

#### Purpose
Add a new "Plugins" navigation item to the Settings dialog sidebar, positioned after "Git" section.

#### Objective
- Add Plugins menu item with appropriate icon
- Create the component slot/tab for plugins content
- Wire up navigation to show plugins section

#### Architecture Description

Modify `src/components/dialogs/SettingsDialog.vue`:
- Add `plugins` to the settings tabs list
- Add navigation item with `mdi-puzzle` or `mdi-package-variant` icon
- Add `<PluginsSection>` component in the content area

#### Full Prompt

```

You are adding a Plugins section to the Settings dialog in MyndPrompts.

## Context

- Settings dialog is in `src/components/dialogs/SettingsDialog.vue`
- It uses a tab-based navigation with sections like General, Appearance, Editor, etc.
- Need to add Plugins after the Git section

## File to Modify

### src/components/dialogs/SettingsDialog.vue

1. Add 'plugins' to the tabs/sections list
2. Add navigation item in the sidebar:
   - Icon: `mdi-puzzle-outline` (or `mdi-package-variant-closed`)
   - Label: Use i18n key `settings.plugins.title` (will add translations in Task 11)
   - For now, use literal 'Plugins' as fallback

3. Add the component import and usage:

```typescript
import PluginsSection from './settings/PluginsSection.vue';
```

4. Add the content section that shows when plugins tab is active:

```vue
<PluginsSection v-if="activeTab === 'plugins'" />
```

## Requirements

- Position Plugins after Git in the navigation order
- Use consistent styling with other navigation items
- The PluginsSection component will be created in Task 5
- For now, create a placeholder component if needed

```

---

### Task 5: Create PluginsSection Component with Tab Navigation

#### Purpose
Create the main Plugins section component with Marketplace and Installed tabs.

#### Objective
- Two-tab layout: Marketplace and Installed
- Tab badge showing installed count
- Container for sub-components

#### Architecture Description

```

src/components/dialogs/settings/
└── PluginsSection.vue # NEW: Main plugins container

```

#### Full Prompt

```

You are creating the main PluginsSection component for the Settings dialog.

## Context

- This component goes in `src/components/dialogs/settings/PluginsSection.vue`
- Uses Quasar components (q-tabs, q-tab, q-tab-panels, q-tab-panel)
- Should integrate with the pluginStore

## File to Create

### src/components/dialogs/settings/PluginsSection.vue

```vue
<template>
  <div class="plugins-section">
    <q-tabs
      v-model="activeTab"
      dense
      class="text-grey"
      active-color="primary"
      indicator-color="primary"
      align="left"
      narrow-indicator
    >
      <q-tab
        name="marketplace"
        label="Marketplace"
      />
      <q-tab name="installed">
        <div class="row items-center no-wrap">
          <span>Installed</span>
          <q-badge
            v-if="pluginStore.installed.length > 0"
            color="primary"
            :label="pluginStore.installed.length"
            class="q-ml-sm"
          />
          <q-badge
            v-if="pluginStore.hasUpdates"
            color="orange"
            :label="pluginStore.updateCount"
            class="q-ml-xs"
          >
            <q-tooltip>Updates available</q-tooltip>
          </q-badge>
        </div>
      </q-tab>
    </q-tabs>

    <q-separator />

    <q-tab-panels
      v-model="activeTab"
      animated
      class="plugins-section__panels"
    >
      <q-tab-panel
        name="marketplace"
        class="q-pa-none"
      >
        <PluginsMarketplace />
      </q-tab-panel>

      <q-tab-panel
        name="installed"
        class="q-pa-none"
      >
        <PluginsInstalled />
      </q-tab-panel>
    </q-tab-panels>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { usePluginStore } from '@/stores/pluginStore';
import PluginsMarketplace from './PluginsMarketplace.vue';
import PluginsInstalled from './PluginsInstalled.vue';

const pluginStore = usePluginStore();
const activeTab = ref('marketplace');

onMounted(async () => {
  if (!pluginStore.isInitialized) {
    await pluginStore.initialize();
  }
});
</script>

<style lang="scss" scoped>
.plugins-section {
  height: 100%;
  display: flex;
  flex-direction: column;

  &__panels {
    flex: 1;
    overflow: hidden;
  }
}
</style>
```

## Requirements

- Initialize plugin store on mount
- Show loading state while fetching
- Show badge with installed count
- Show update count badge in orange if updates available
- Use Quasar components consistently
- Create placeholder components for PluginsMarketplace and PluginsInstalled if they don't exist yet

```

---

### Task 6: Create PluginsMarketplace Component with Search and Filters

#### Purpose
Create the Marketplace tab content showing available plugins with search and filtering capabilities.

#### Objective
- Search bar with diacritics-insensitive search
- Type filter (multi-select chips)
- Tags filter (multi-select)
- Plugin cards with install button
- Loading and empty states

#### Architecture Description

```

src/components/dialogs/settings/
├── PluginsMarketplace.vue # NEW: Marketplace tab content
└── PluginCard.vue # NEW: Reusable plugin card

```

#### Full Prompt

```

You are creating the Marketplace component for the plugin system.

## Context

- Component location: `src/components/dialogs/settings/PluginsMarketplace.vue`
- Uses pluginStore for data and filtering
- Must support diacritics-insensitive search (e.g., "cafe" matches "café")
- Use Quasar components

## Files to Create

### 1. src/components/dialogs/settings/PluginsMarketplace.vue

```vue
<template>
  <div class="plugins-marketplace">
    <!-- Search Bar -->
    <div class="plugins-marketplace__search q-pa-md">
      <q-input
        v-model="searchQuery"
        dense
        outlined
        placeholder="Search plugins..."
        clearable
        @update:model-value="onSearchChange"
      >
        <template #prepend>
          <q-icon name="mdi-magnify" />
        </template>
      </q-input>
    </div>

    <!-- Filters -->
    <div class="plugins-marketplace__filters q-px-md q-pb-md">
      <!-- Type Filter -->
      <div class="q-mb-sm">
        <span class="text-caption text-grey">Type:</span>
        <q-chip
          v-for="type in pluginTypes"
          :key="type.value"
          :selected="selectedTypes.includes(type.value)"
          clickable
          dense
          outline
          color="primary"
          @click="toggleType(type.value)"
        >
          {{ type.label }}
        </q-chip>
      </div>

      <!-- Tags Filter -->
      <div>
        <span class="text-caption text-grey">Tags:</span>
        <q-chip
          v-for="tag in pluginStore.allTags"
          :key="tag"
          :selected="selectedTags.includes(tag)"
          clickable
          dense
          outline
          color="secondary"
          removable
          @click="toggleTag(tag)"
          @remove="removeTag(tag)"
        >
          {{ tag }}
        </q-chip>
      </div>
    </div>

    <q-separator />

    <!-- Plugin List -->
    <div class="plugins-marketplace__list q-pa-md">
      <!-- Loading State -->
      <div
        v-if="pluginStore.isLoading"
        class="text-center q-pa-lg"
      >
        <q-spinner
          size="lg"
          color="primary"
        />
        <div class="q-mt-md text-grey">Loading plugins...</div>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="pluginStore.filteredMarketplace.length === 0"
        class="text-center q-pa-lg"
      >
        <q-icon
          name="mdi-package-variant-closed"
          size="64px"
          color="grey-5"
        />
        <div class="q-mt-md text-grey">No plugins found</div>
        <div class="text-caption text-grey">Try adjusting your filters</div>
      </div>

      <!-- Plugin Cards -->
      <div
        v-else
        class="row q-col-gutter-md"
      >
        <div
          v-for="plugin in pluginStore.filteredMarketplace"
          :key="plugin.id"
          class="col-12"
        >
          <PluginCard
            :plugin="plugin"
            :installing="installingIds.has(plugin.id)"
            @install="handleInstall"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Implementation with:
// - Search with debounce
// - Type and tag filtering
// - Install handling with loading state per plugin
</script>
```

### 2. src/components/dialogs/settings/PluginCard.vue

```vue
<template>
  <q-card
    flat
    bordered
    class="plugin-card"
  >
    <q-card-section>
      <div class="row items-center justify-between">
        <div class="col">
          <div class="row items-center q-gutter-sm">
            <q-icon
              :name="typeIcon"
              size="24px"
              :color="typeColor"
            />
            <span class="text-subtitle1 text-weight-medium">{{ displayName }}</span>
            <q-chip
              dense
              size="sm"
              outline
              >v{{ plugin.version }}</q-chip
            >
          </div>
          <div class="text-caption text-grey q-mt-xs">
            Type: {{ formatType(plugin.type) }} · {{ plugin.items.length }} items
          </div>
          <div class="q-mt-sm">
            <q-chip
              v-for="tag in plugin.tags"
              :key="tag"
              dense
              size="sm"
              color="grey-3"
              text-color="grey-8"
            >
              {{ tag }}
            </q-chip>
          </div>
        </div>
        <div class="col-auto">
          <q-btn
            :loading="installing"
            color="primary"
            label="Install"
            @click="$emit('install', plugin)"
          />
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>
```

## Requirements

- Debounce search input (300ms)
- Show loading spinner while fetching
- Show appropriate empty state when no results
- Type icons: persona=mdi-account, templates=mdi-file-document, code_snippets=mdi-code-braces, text_snippets=mdi-text
- Show installing state per plugin card
- Format type names nicely (e.g., 'code_snippets' -> 'Code Snippets')

```

---

### Task 7: Create PluginsInstalled Component with Update/Uninstall

#### Purpose
Create the Installed tab content showing installed plugins with update and uninstall capabilities.

#### Objective
- List of installed plugins
- Update button (shown only if update available)
- Uninstall button with confirmation
- Empty state when no plugins installed

#### Architecture Description

```

src/components/dialogs/settings/
└── PluginsInstalled.vue # NEW: Installed tab content

```

#### Full Prompt

```

You are creating the Installed plugins component for the plugin system.

## Context

- Component location: `src/components/dialogs/settings/PluginsInstalled.vue`
- Uses pluginStore for installed plugins and update info
- Should show Update button only when an update is available
- Uninstall should require confirmation

## File to Create

### src/components/dialogs/settings/PluginsInstalled.vue

```vue
<template>
  <div class="plugins-installed">
    <!-- Empty State -->
    <div
      v-if="pluginStore.installed.length === 0"
      class="text-center q-pa-xl"
    >
      <q-icon
        name="mdi-puzzle-outline"
        size="64px"
        color="grey-5"
      />
      <div class="q-mt-md text-grey text-h6">No plugins installed</div>
      <div class="text-caption text-grey">
        Visit the Marketplace to discover and install plugins
      </div>
    </div>

    <!-- Installed Plugin List -->
    <div
      v-else
      class="q-pa-md"
    >
      <div class="row q-col-gutter-md">
        <div
          v-for="plugin in pluginStore.installed"
          :key="plugin.id"
          class="col-12"
        >
          <InstalledPluginCard
            :plugin="plugin"
            :update-info="pluginStore.getUpdateForPlugin(plugin.id)"
            :updating="updatingIds.has(plugin.id)"
            :uninstalling="uninstallingIds.has(plugin.id)"
            @update="handleUpdate"
            @uninstall="confirmUninstall"
          />
        </div>
      </div>
    </div>

    <!-- Uninstall Confirmation Dialog -->
    <q-dialog
      v-model="showUninstallDialog"
      persistent
    >
      <q-card style="min-width: 350px">
        <q-card-section class="row items-center">
          <q-icon
            name="mdi-alert"
            color="warning"
            size="md"
            class="q-mr-sm"
          />
          <span class="text-h6">Uninstall Plugin?</span>
        </q-card-section>

        <q-card-section>
          Are you sure you want to uninstall <strong>{{ pluginToUninstall?.type }}</strong
          >? This will not delete any files you've already added from this plugin.
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            flat
            label="Cancel"
            v-close-popup
          />
          <q-btn
            flat
            label="Uninstall"
            color="negative"
            :loading="uninstalling"
            @click="handleUninstall"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
// Implementation with:
// - Update handling with loading state
// - Uninstall confirmation dialog
// - Toast notifications for success/error
</script>
```

### Also create: src/components/dialogs/settings/InstalledPluginCard.vue

Similar to PluginCard but with:

- Installation date display
- Update button (conditional)
- Uninstall button
- Shows new version number on update button

## Requirements

- Show "Installed: {date}" formatted nicely
- Update button shows "Update to v{version}" when available
- Uninstall requires confirmation dialog
- Show loading states during operations
- Show toast notifications on success/error
- Files created from plugins are NOT deleted when uninstalling

```

---

### Task 8: Create Reusable PluginContentSelectorDialog Component

#### Purpose
Create a reusable dialog for selecting and adding content items from installed plugins to the file system.

#### Objective
- Generic component that works for all plugin types
- Tag filtering
- Multi-select with Select All
- Cancel and Add Selected buttons
- Creates files in the appropriate directory

#### Architecture Description

```

src/components/dialogs/
└── PluginContentSelectorDialog.vue # NEW: Reusable content selector

```

**Props:**
- `modelValue: boolean` - Dialog visibility
- `pluginType: PluginType` - Which type to show
- `targetDirectory: string` - Where to create files

**Emits:**
- `update:modelValue` - Close dialog
- `added` - Files were added successfully

#### Full Prompt

```

You are creating a reusable dialog for selecting plugin content to add to the file system.

## Context

- This dialog is used from Explorer panel context menu
- Works for all plugin types (persona, templates, code_snippets, text_snippets)
- Must filter by tags
- Must support multi-select with "Select All"
- Creates markdown files in the target directory

## File to Create

### src/components/dialogs/PluginContentSelectorDialog.vue

```vue
<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <q-card
      class="plugin-content-selector"
      style="width: 600px; max-width: 90vw;"
    >
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Add from Library - {{ formatType(pluginType) }}</div>
        <q-space />
        <q-btn
          icon="mdi-close"
          flat
          round
          dense
          v-close-popup
        />
      </q-card-section>

      <q-card-section>
        <!-- Tag Filter -->
        <div class="q-mb-md">
          <span class="text-caption text-grey">Filter by tags:</span>
          <q-select
            v-model="selectedTags"
            :options="availableTags"
            multiple
            dense
            outlined
            use-chips
            clearable
            placeholder="All tags"
          />
        </div>

        <!-- Select All -->
        <q-checkbox
          v-model="selectAll"
          :label="`Select All (${filteredItems.length} items)`"
          @update:model-value="toggleSelectAll"
        />

        <q-separator class="q-my-sm" />

        <!-- Content List -->
        <q-scroll-area style="height: 300px;">
          <q-list>
            <q-item
              v-for="item in filteredItems"
              :key="item.id"
              tag="label"
              clickable
            >
              <q-item-section side>
                <q-checkbox
                  v-model="selectedItems"
                  :val="item"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ item.title }}</q-item-label>
                <q-item-label caption>
                  <q-chip
                    v-for="tag in item.tags"
                    :key="tag"
                    dense
                    size="xs"
                  >
                    {{ tag }}
                  </q-chip>
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-scroll-area>
      </q-card-section>

      <q-card-section class="row items-center justify-between">
        <div class="text-caption text-grey">
          {{ selectedItems.length }} of {{ filteredItems.length }} selected
        </div>
        <div>
          <q-btn
            flat
            label="Cancel"
            v-close-popup
            class="q-mr-sm"
          />
          <q-btn
            color="primary"
            :label="`Add Selected (${selectedItems.length})`"
            :disable="selectedItems.length === 0"
            :loading="isAdding"
            @click="handleAdd"
          />
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { usePluginStore } from '@/stores/pluginStore';
import { usePromptStore } from '@/stores/promptStore';
import type { PluginType, IPluginItem } from '@/services/storage/entities';

interface ContentItem extends IPluginItem {
  id: string;
  pluginId: string;
  tags: string[];
}

const props = defineProps<{
  modelValue: boolean;
  pluginType: PluginType;
  targetDirectory: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  added: [count: number];
}>();

const pluginStore = usePluginStore();
const promptStore = usePromptStore();

const selectedTags = ref<string[]>([]);
const selectedItems = ref<ContentItem[]>([]);
const selectAll = ref(false);
const isAdding = ref(false);

// Flatten all items from installed plugins of this type
const allItems = computed<ContentItem[]>(() => {
  const plugins = pluginStore.getInstalledByType(props.pluginType);
  const items: ContentItem[] = [];

  for (const plugin of plugins) {
    for (const item of plugin.items) {
      items.push({
        ...item,
        id: `${plugin.id}-${item.title}`,
        pluginId: plugin.id,
        tags: plugin.tags,
      });
    }
  }

  return items;
});

// Filter by selected tags
const filteredItems = computed(() => {
  if (selectedTags.value.length === 0) {
    return allItems.value;
  }
  return allItems.value.filter((item) => item.tags.some((tag) => selectedTags.value.includes(tag)));
});

// Available tags from items of this type
const availableTags = computed(() => {
  const tags = new Set<string>();
  allItems.value.forEach((item) => {
    item.tags.forEach((tag) => tags.add(tag));
  });
  return Array.from(tags).sort();
});

// Toggle select all
function toggleSelectAll(value: boolean) {
  if (value) {
    selectedItems.value = [...filteredItems.value];
  } else {
    selectedItems.value = [];
  }
}

// Watch for select all sync
watch(selectedItems, () => {
  selectAll.value =
    selectedItems.value.length === filteredItems.value.length && filteredItems.value.length > 0;
});

// Handle add selected
async function handleAdd() {
  isAdding.value = true;
  try {
    for (const item of selectedItems.value) {
      // Create file with title as filename and content
      await promptStore.createPrompt(item.title, item.content, props.targetDirectory);
    }
    emit('added', selectedItems.value.length);
    emit('update:modelValue', false);
  } catch (error) {
    console.error('Failed to add items:', error);
  } finally {
    isAdding.value = false;
  }
}

function formatType(type: PluginType): string {
  const map: Record<PluginType, string> = {
    persona: 'Personas',
    templates: 'Templates',
    code_snippets: 'Code Snippets',
    text_snippets: 'Text Snippets',
  };
  return map[type] || type;
}

// Reset state when dialog opens
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      selectedTags.value = [];
      selectedItems.value = [];
      selectAll.value = false;
    }
  }
);
</script>

<style lang="scss" scoped>
.plugin-content-selector {
  // Styles
}
</style>
```

## Requirements

- Filter items by plugin type
- Multi-select with checkboxes
- Select All checkbox that syncs with selection
- Tag filtering with multi-select dropdown
- Show selection count
- Disable "Add Selected" when nothing selected
- Create files using promptStore.createPrompt or appropriate method
- Reset state when dialog opens
- Show loading state during file creation
- Close dialog on success

````

---

### Task 9: Add "Add from Library" Context Menu to Explorer Panel

#### Purpose
Add context menu option to appropriate directories in Explorer Panel that opens the PluginContentSelectorDialog.

#### Objective
- Add "Add from Library" to context menu for Personas, Templates, and Snippets directories
- Map directory type to plugin type
- Only show if there are installed plugins of that type

#### Architecture Description

Modify `src/components/layout/sidebar/ExplorerPanel.vue`:
- Add context menu item
- Determine plugin type from directory
- Open PluginContentSelectorDialog

**Directory to Plugin Type Mapping:**
```typescript
{
  'Personas': 'persona',
  'Templates': 'templates',
  'Snippets': ['code_snippets', 'text_snippets'], // Special case
}
````

#### Full Prompt

````
You are adding "Add from Library" context menu option to the Explorer Panel.

## Context
- Explorer Panel is in `src/components/layout/sidebar/ExplorerPanel.vue`
- It has context menus for different node types (folder, project, file)
- Need to add option for specific directories that map to plugin types

## File to Modify

### src/components/layout/sidebar/ExplorerPanel.vue

1. Import the PluginContentSelectorDialog and pluginStore

2. Add state for the dialog:
```typescript
const showPluginContentDialog = ref(false);
const pluginContentDialogType = ref<PluginType | null>(null);
const pluginContentDialogTarget = ref<string>('');
````

3. Add mapping function:

```typescript
function getPluginTypeForDirectory(dirName: string): PluginType | null {
  const map: Record<string, PluginType> = {
    Personas: 'persona',
    Templates: 'templates',
    // For Snippets, we'll show both code and text snippets
  };
  return map[dirName] || null;
}

function hasInstalledPluginsForType(type: PluginType): boolean {
  return pluginStore.getInstalledByType(type).length > 0;
}
```

4. Add to folder context menu (where appropriate):

```vue
<q-item
  v-if="canAddFromLibrary(contextMenuNode)"
  clickable
  v-close-popup
  @click="openPluginContentSelector(contextMenuNode)"
>
  <q-item-section side>
    <q-icon name="mdi-puzzle-plus-outline" />
  </q-item-section>
  <q-item-section>Add from Library</q-item-section>
</q-item>
```

5. Add the dialog component:

```vue
<PluginContentSelectorDialog
  v-model="showPluginContentDialog"
  :plugin-type="pluginContentDialogType!"
  :target-directory="pluginContentDialogTarget"
  @added="onPluginContentAdded"
/>
```

6. Implement the helper functions:

```typescript
function canAddFromLibrary(node: ITreeNode | null): boolean {
  if (!node || node.type !== 'folder') return false;

  const dirName = node.label;
  const pluginType = getPluginTypeForDirectory(dirName);

  if (!pluginType) return false;

  return hasInstalledPluginsForType(pluginType);
}

function openPluginContentSelector(node: ITreeNode) {
  const pluginType = getPluginTypeForDirectory(node.label);
  if (!pluginType) return;

  pluginContentDialogType.value = pluginType;
  pluginContentDialogTarget.value = node.filePath!;
  showPluginContentDialog.value = true;
}

function onPluginContentAdded(count: number) {
  // Show toast notification
  $q.notify({
    type: 'positive',
    message: `Added ${count} item${count > 1 ? 's' : ''} from library`,
  });

  // Refresh the prompts/files list
  void promptStore.refreshAllPrompts();
}
```

## Requirements

- Only show "Add from Library" for directories that have a mapping
- Only show if there are installed plugins of that type
- Pass correct target directory path to the dialog
- Show notification on success
- Refresh file list after adding
- Use appropriate icon (mdi-puzzle-plus-outline or similar)

```

---

### Task 10: Implement File Creation from Plugin Content

#### Purpose
Ensure the file creation logic properly handles plugin content, creating markdown files with appropriate naming and content.

#### Objective
- Create markdown files from plugin items
- Handle naming conflicts (add suffix if file exists)
- Support different file locations based on plugin type

#### Architecture Description

This task may require updates to:
- `src/stores/promptStore.ts` - Add method for creating from plugin
- `src/services/file-system/prompt-file.service.ts` - Handle file creation

**File Creation Logic:**
1. Sanitize title for filename
2. Check if file exists
3. If exists, add numeric suffix
4. Write content to file
5. Refresh file list

#### Full Prompt

```

You are implementing file creation logic for the plugin content system.

## Context

- Plugin items have `title` and `content` fields
- Need to create markdown files from these items
- Files go to different directories based on plugin type:
  - persona → ~/.myndprompt/prompts/Personas/
  - templates → ~/.myndprompt/prompts/Templates/
  - code_snippets → ~/.myndprompt/snippets/
  - text_snippets → ~/.myndprompt/snippets/

## Files to Modify/Check

### 1. Check promptStore.ts for existing createPrompt method

If it exists, ensure it:

- Sanitizes the title for use as filename
- Handles file naming conflicts
- Writes the content correctly

If it doesn't exist or needs enhancement, add:

```typescript
async function createPromptFromPlugin(
  title: string,
  content: string,
  targetDirectory: string
): Promise<string> {
  // Sanitize title for filename
  const sanitizedTitle = title
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid chars
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();

  let fileName = `${sanitizedTitle}.md`;
  let filePath = `${targetDirectory}/${fileName}`;

  // Check for conflicts and add suffix if needed
  let suffix = 1;
  while (await fileService.fileExists(filePath)) {
    fileName = `${sanitizedTitle} (${suffix}).md`;
    filePath = `${targetDirectory}/${fileName}`;
    suffix++;
  }

  // Write the file
  await fileService.writeFile(filePath, content);

  // Refresh the prompts list
  await refreshAllPrompts();

  return filePath;
}
```

### 2. Update PluginContentSelectorDialog to use this method

The handleAdd function should call the appropriate creation method based on the plugin type.

## Requirements

- Sanitize filenames to remove invalid characters
- Handle naming conflicts by adding numeric suffix
- Preserve the original content exactly
- Files should be .md extension
- Refresh file listings after creation
- Return the created file path for potential navigation

```

---

### Task 11: Add i18n Translations for All Plugin-Related Strings

#### Purpose
Add internationalization support for all plugin-related UI strings across all supported languages.

#### Objective
- Add English translations first
- Structure for easy translation to other languages
- Cover all plugin UI strings

#### Architecture Description

Add to each language file in `src/i18n/`:
- `en-US/index.ts`
- `en-GB/index.ts`
- `en-IE/index.ts`
- `pt-BR/index.ts`
- `pt-PT/index.ts`
- `es-ES/index.ts`
- `fr-FR/index.ts`
- `de-DE/index.ts`
- `it-IT/index.ts`
- `ar-SA/index.ts`

#### Full Prompt

```

You are adding i18n translations for the plugin system.

## Context

- i18n files are in `src/i18n/{locale}/index.ts`
- Follow the existing structure and patterns
- Add a new `plugins` section to the translations

## Translation Keys to Add

Add under `settings` or as a new top-level `plugins` section:

```typescript
plugins: {
  // Section title
  title: 'Plugins',

  // Tabs
  marketplace: 'Marketplace',
  installed: 'Installed',

  // Search and filters
  searchPlaceholder: 'Search plugins...',
  filterByType: 'Type',
  filterByTags: 'Tags',
  allTypes: 'All',

  // Plugin types
  types: {
    persona: 'Persona',
    templates: 'Templates',
    code_snippets: 'Code Snippets',
    text_snippets: 'Text Snippets',
  },

  // Plugin card
  version: 'Version',
  items: 'items',
  installedOn: 'Installed',

  // Actions
  install: 'Install',
  installing: 'Installing...',
  update: 'Update',
  updateTo: 'Update to v{version}',
  updating: 'Updating...',
  uninstall: 'Uninstall',
  uninstalling: 'Uninstalling...',

  // Confirmation dialog
  uninstallConfirmTitle: 'Uninstall Plugin?',
  uninstallConfirmMessage: 'Are you sure you want to uninstall {name}? This will not delete any files you\'ve already added from this plugin.',

  // Empty states
  noPluginsFound: 'No plugins found',
  noPluginsFoundHint: 'Try adjusting your filters',
  noPluginsInstalled: 'No plugins installed',
  noPluginsInstalledHint: 'Visit the Marketplace to discover and install plugins',

  // Content selector dialog
  addFromLibrary: 'Add from Library',
  selectAll: 'Select All',
  itemsSelected: '{count} of {total} selected',
  addSelected: 'Add Selected ({count})',
  cancel: 'Cancel',

  // Notifications
  installSuccess: 'Plugin installed successfully',
  installError: 'Failed to install plugin',
  updateSuccess: 'Plugin updated successfully',
  updateError: 'Failed to update plugin',
  uninstallSuccess: 'Plugin uninstalled successfully',
  uninstallError: 'Failed to uninstall plugin',
  contentAddedSuccess: 'Added {count} item(s) from library',
  contentAddedError: 'Failed to add items from library',

  // Loading states
  loadingPlugins: 'Loading plugins...',
  updatesAvailable: 'Updates available',
}
```

## Files to Modify

Add translations to all locale files:

1. en-US/index.ts (primary)
2. en-GB/index.ts
3. en-IE/index.ts
4. pt-BR/index.ts
5. pt-PT/index.ts
6. es-ES/index.ts
7. fr-FR/index.ts
8. de-DE/index.ts
9. it-IT/index.ts
10. ar-SA/index.ts

## Requirements

- Use consistent terminology across the app
- Use interpolation for dynamic values ({count}, {version}, {name})
- Escape special characters properly (especially @ symbol as {'@'})
- Maintain the same key structure across all locales
- For non-English locales, translate appropriately for each language

```

---

### Task 12: Add Loading States, Error Handling, and Toast Notifications

#### Purpose
Polish the plugin system with proper loading states, error handling, and user feedback through toast notifications.

#### Objective
- Loading spinners during async operations
- Error states with retry options
- Toast notifications for success/error
- Graceful degradation on network failure

#### Architecture Description

Update components:
- `PluginsSection.vue` - Initial loading state
- `PluginsMarketplace.vue` - Loading, error, empty states
- `PluginsInstalled.vue` - Loading states for operations
- `PluginContentSelectorDialog.vue` - Loading during file creation

#### Full Prompt

```

You are adding polish to the plugin system with loading states and error handling.

## Context

- Use Quasar's q-spinner for loading states
- Use Quasar's $q.notify for toast notifications
- Handle network errors gracefully
- Show retry options where appropriate

## Requirements

### 1. Loading States

Add loading indicators for:

- Initial plugin list fetch
- Plugin installation
- Plugin update
- Plugin uninstallation
- Content file creation

Use skeleton loaders for lists when appropriate.

### 2. Error Handling

Handle these error scenarios:

- Network failure fetching marketplace
- Plugin installation failure
- File creation failure
- Invalid plugin data

Show user-friendly error messages with:

- Error icon
- Brief description
- Retry button where applicable

### 3. Toast Notifications

Use Quasar notify for:

```typescript
// Success
$q.notify({
  type: 'positive',
  message: t('plugins.installSuccess'),
  icon: 'mdi-check-circle',
});

// Error
$q.notify({
  type: 'negative',
  message: t('plugins.installError'),
  caption: error.message,
  icon: 'mdi-alert-circle',
});

// Info/Warning
$q.notify({
  type: 'warning',
  message: t('plugins.updatesAvailable'),
  icon: 'mdi-update',
});
```

### 4. Network Error Handling

```typescript
async function fetchMarketplace() {
  isLoading.value = true;
  error.value = null;

  try {
    const response = await fetch(MARKETPLACE_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    marketplace.value = await response.json();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Network error';
    // Show offline message if appropriate
    if (!navigator.onLine) {
      error.value = 'You appear to be offline. Please check your connection.';
    }
  } finally {
    isLoading.value = false;
  }
}
```

### 5. Retry Mechanism

```vue
<div v-if="error" class="text-center q-pa-lg">
  <q-icon name="mdi-alert-circle-outline" size="64px" color="negative" />
  <div class="q-mt-md text-negative">{{ error }}</div>
  <q-btn
    class="q-mt-md"
    color="primary"
    label="Retry"
    icon="mdi-refresh"
    @click="retry"
  />
</div>
```

## Files to Update

- PluginsSection.vue
- PluginsMarketplace.vue
- PluginsInstalled.vue
- PluginContentSelectorDialog.vue
- pluginStore.ts (error state management)

## Requirements

- Consistent loading indicator style across components
- User-friendly error messages (not technical jargon)
- Retry buttons for recoverable errors
- Toast notifications positioned consistently (top-right or bottom)
- Don't block UI unnecessarily during background operations
- Show progress for batch operations if applicable

````

---

## 5. Implementation Notes

### Version Comparison
For v1, all plugins are version 1.0.0. Simple string comparison works. For future versions, implement proper semver comparison:

```typescript
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1;
    if (parts1[i] < parts2[i]) return -1;
  }
  return 0;
}

function hasUpdate(installed: string, available: string): boolean {
  return compareVersions(available, installed) > 0;
}
````

### Caching Strategy

- Cache marketplace data for 5 minutes
- Refresh on explicit user action (pull-to-refresh or refresh button)
- Invalidate cache on install/uninstall

### File Naming

When creating files from plugin content:

1. Use the item's `title` as the base filename
2. Sanitize: remove `<>:"/\|?*` characters
3. Add `.md` extension
4. If file exists, append ` (1)`, ` (2)`, etc.

### Security Considerations

- Sanitize all content before writing to disk
- Validate plugin structure from API
- Don't execute any code from plugins (content only)

---

## 6. Testing Checklist

### Unit Tests

- [ ] PluginRepository CRUD operations
- [ ] PluginService API calls (mock fetch)
- [ ] PluginStore state management
- [ ] Version comparison logic
- [ ] Filename sanitization

### Integration Tests

- [ ] Install plugin flow
- [ ] Update plugin flow
- [ ] Uninstall plugin flow
- [ ] Add content from library flow

### E2E Tests

- [ ] Navigate to Settings > Plugins
- [ ] Search and filter marketplace
- [ ] Install a plugin
- [ ] Add content to Personas folder
- [ ] Uninstall plugin

---

## 7. Future Enhancements (Out of Scope for v1)

1. **Plugin Preview** - Preview content before installing
2. **Custom Plugins** - Allow users to create their own plugins
3. **Plugin Sync** - Sync installed plugins across devices
4. **Plugin Ratings** - Community ratings and reviews
5. **Dependency Management** - Plugins that depend on other plugins
6. **Auto-Update** - Background update checking and installation
