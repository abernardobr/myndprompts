# Export/Import Prompts - Implementation Document

## Overview

This document describes the implementation of the Export and Import functionality for MyndPrompts. This feature allows users to export all their prompts, snippets, and related files as a ZIP archive and import them back into a different location or on another machine.

---

## 1. Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              UI Layer (Vue)                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    SettingsDialog.vue                                │   │
│  │                    (Storage Tab Section)                             │   │
│  │  ┌─────────────────────┐     ┌─────────────────────┐                │   │
│  │  │   Export Button      │     │   Import Button      │                │   │
│  │  │   - Click triggers   │     │   - Opens file picker│                │   │
│  │  │     export process   │     │   - Selects ZIP file │                │   │
│  │  └──────────┬───────────┘     └──────────┬───────────┘                │   │
│  └─────────────┼──────────────────────────────┼─────────────────────────┘   │
└────────────────┼──────────────────────────────┼─────────────────────────────┘
                 │                              │
                 │ IPC: fs:exportData           │ IPC: fs:importData
                 ▼                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Main Process (Electron)                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   ExportImportService                                │   │
│  │                                                                       │   │
│  │  exportData():                      importData(zipPath):             │   │
│  │  ┌─────────────────────┐           ┌─────────────────────┐          │   │
│  │  │ 1. Read all files    │           │ 1. Extract ZIP      │          │   │
│  │  │    from storage      │           │ 2. Parse index.json │          │   │
│  │  │ 2. Generate index    │           │ 3. Validate files   │          │   │
│  │  │    manifest (JSON)   │           │ 4. Copy to storage  │          │   │
│  │  │ 3. Create ZIP archive│           │ 5. Update stores    │          │   │
│  │  │ 4. Save to user dir  │           │ 6. Notify renderer  │          │   │
│  │  └─────────────────────┘           └─────────────────────┘          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘
                 │                              │
                 ▼                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           File System                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    ~/.myndprompt/                                    │   │
│  │  ├── prompts/           (All prompt .md files)                       │   │
│  │  ├── snippets/          (All snippet files)                          │   │
│  │  ├── personas/          (All persona files)                          │   │
│  │  ├── templates/         (All template files)                         │   │
│  │  ├── projects/          (Project-specific files)                     │   │
│  │  └── backups/           (Backup files)                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Export ZIP Structure

```
MyndPrompts-Export-2024-01-23.zip
├── index.json              # Manifest file with metadata
├── prompts/                # All prompt files with directory structure preserved
│   ├── folder1/
│   │   ├── prompt1.md
│   │   └── prompt2.md
│   └── folder2/
│       └── prompt3.md
├── snippets/               # All snippet files
│   └── snippet1.snippet.md
├── personas/               # All persona files
│   └── dev-persona.persona.md
├── templates/              # All template files
│   └── template1.template.md
└── projects/               # All project files
    └── project1/
        └── config.json
```

### 1.3 index.json Schema

```typescript
interface IExportManifest {
  version: string; // Export format version (e.g., "1.0.0")
  exportedAt: string; // ISO timestamp
  appVersion: string; // MyndPrompts app version
  statistics: {
    totalFiles: number;
    prompts: number;
    snippets: number;
    personas: number;
    templates: number;
    projects: number;
  };
  files: IExportFileEntry[]; // List of all files in the export
}

interface IExportFileEntry {
  relativePath: string; // Path relative to base (e.g., "prompts/folder1/prompt.md")
  type: 'prompt' | 'snippet' | 'persona' | 'template' | 'project' | 'other';
  size: number; // File size in bytes
  checksum?: string; // Optional MD5/SHA256 for integrity
  metadata?: {
    // Extracted frontmatter metadata
    id?: string;
    title?: string;
    category?: string;
    tags?: string[];
  };
}
```

### 1.4 Component Architecture

```
src/
├── electron/
│   └── main/
│       └── services/
│           └── export-import.service.ts     # NEW: Main process export/import logic
├── services/
│   └── export-import/
│       ├── types.ts                         # NEW: Export/Import types
│       └── export-import.service.ts         # NEW: Renderer-side service wrapper
├── components/
│   ├── dialogs/
│   │   └── SettingsDialog.vue               # MODIFY: Add export/import UI
│   └── settings/
│       └── StorageSection.vue               # NEW: Extracted storage settings component
└── i18n/
    └── **/index.ts                          # MODIFY: Add translation keys
```

### 1.5 IPC Communication Flow

#### Export Flow

```
1. User clicks "Export" button in SettingsDialog
2. Renderer calls window.electronAPI.exportData()
3. Main process:
   a. Shows save dialog to user (select destination)
   b. Reads all files from ~/.myndprompt/
   c. Generates index.json manifest
   d. Creates ZIP archive using archiver
   e. Saves ZIP to selected location
   f. Returns { success: true, path: '/path/to/export.zip' }
4. Renderer shows success notification
```

#### Import Flow

```
1. User clicks "Import" button in SettingsDialog
2. Renderer calls window.electronAPI.importData()
3. Main process:
   a. Shows open dialog to user (select ZIP file)
   b. Validates ZIP file structure
   c. Extracts to temporary directory
   d. Reads and validates index.json
   e. Shows confirmation dialog (files to import, conflicts)
   f. Copies files to ~/.myndprompt/ with conflict resolution
   g. Returns { success: true, imported: { prompts: 10, snippets: 5, ... } }
4. Renderer:
   a. Refreshes stores (promptStore, snippetStore, etc.)
   b. Shows success notification with import summary
```

### 1.6 Conflict Resolution Strategy

When importing files that already exist:

1. **Skip**: Keep existing file, don't import
2. **Replace**: Overwrite existing with imported file
3. **Rename**: Import with suffix (e.g., `prompt (imported).md`)
4. **Merge** (Future): Smart merge for certain file types

Default behavior: **Rename** (safe, non-destructive)

### 1.7 Dependencies

**New Dependencies to Add:**

```json
{
  "archiver": "^6.0.1", // ZIP creation
  "extract-zip": "^2.0.1" // ZIP extraction
}
```

**Dev Dependencies:**

```json
{
  "@types/archiver": "^6.0.2"
}
```

---

## 2. Todos

### Checklist

- [x] **Task 1**: Create Export/Import types and interfaces
- [x] **Task 2**: Implement ExportImportService in main process
- [x] **Task 3**: Add IPC handlers for export/import operations
- [x] **Task 4**: Create StorageSection component with Export/Import UI
- [x] **Task 5**: Integrate StorageSection into SettingsDialog
- [x] **Task 6**: Add i18n translation keys for all locales
- [x] **Task 7**: Implement progress tracking and notifications
- [x] **Task 8**: Add error handling and validation
- [x] **Task 9**: Write unit tests for ExportImportService
- [x] **Task 10**: End-to-end testing and documentation

---

## 3. Task Details

### Task 1: Create Export/Import Types and Interfaces

**Purpose**: Define TypeScript interfaces and types that will be used across the export/import functionality.

**Objective**: Create a types file that establishes the contract between the renderer and main process, ensuring type safety and clear data structures.

**Task Architecture Description**:

- Create `src/services/export-import/types.ts` with all necessary interfaces
- Define `IExportManifest` for the index.json structure
- Define `IExportFileEntry` for individual file entries
- Define `IExportOptions` and `IImportOptions` for operation configuration
- Define `IExportResult` and `IImportResult` for operation results
- Define conflict resolution enum

**Full Prompt**:

```
Create a new TypeScript types file at `src/services/export-import/types.ts` for the MyndPrompts export/import functionality.

The file should include the following interfaces and types:

1. `IExportManifest` - The structure of index.json in the export ZIP:
   - version: string (export format version, e.g., "1.0.0")
   - exportedAt: string (ISO timestamp)
   - appVersion: string (from package.json)
   - statistics: object with totalFiles, prompts, snippets, personas, templates, projects counts
   - files: array of IExportFileEntry

2. `IExportFileEntry` - Individual file entry in the manifest:
   - relativePath: string (path relative to base directory)
   - type: union type 'prompt' | 'snippet' | 'persona' | 'template' | 'project' | 'other'
   - size: number (file size in bytes)
   - checksum: optional string (for integrity verification)
   - metadata: optional object with id, title, category, tags from frontmatter

3. `IExportOptions` - Options for export operation:
   - includePrompts: boolean (default true)
   - includeSnippets: boolean (default true)
   - includePersonas: boolean (default true)
   - includeTemplates: boolean (default true)
   - includeProjects: boolean (default true)
   - generateChecksums: boolean (default false)

4. `IImportOptions` - Options for import operation:
   - conflictResolution: ConflictResolution enum
   - targetDirectory: optional string (defaults to base storage dir)
   - validateChecksums: boolean (default false)

5. `ConflictResolution` enum: 'skip' | 'replace' | 'rename'

6. `IExportResult` - Result of export operation:
   - success: boolean
   - error: optional string
   - path: optional string (path to exported ZIP)
   - statistics: same as IExportManifest.statistics

7. `IImportResult` - Result of import operation:
   - success: boolean
   - error: optional string
   - imported: statistics object with counts per type
   - skipped: number
   - conflicts: array of { path: string, resolution: ConflictResolution }

8. `IExportProgress` - Progress tracking:
   - phase: 'reading' | 'compressing' | 'writing'
   - current: number
   - total: number
   - currentFile: optional string

9. `IImportProgress` - Progress tracking:
   - phase: 'extracting' | 'validating' | 'copying'
   - current: number
   - total: number
   - currentFile: optional string

Export all interfaces and types. Add JSDoc comments describing each interface.
```

---

### Task 2: Implement ExportImportService in Main Process

**Purpose**: Create the core service that handles all export and import logic in the Electron main process.

**Objective**: Implement a service class that can read all storage files, create ZIP archives with an index.json manifest, and extract/import ZIP archives back into storage.

**Task Architecture Description**:

- Create `src/electron/main/services/export-import.service.ts`
- Use `archiver` package for ZIP creation
- Use `extract-zip` package for ZIP extraction
- Integrate with existing `FileSystemService` for file operations
- Implement methods: `exportData()`, `importData()`, `validateExport()`
- Handle file reading, manifest generation, ZIP creation/extraction
- Implement progress callbacks for UI feedback

**Full Prompt**:

```
Create a new service file at `src/electron/main/services/export-import.service.ts` for handling export/import operations in the Electron main process.

Requirements:

1. Import dependencies:
   - archiver for ZIP creation
   - extract-zip for ZIP extraction
   - Node.js fs/promises, path, os, crypto modules
   - FileSystemService from ./file-system.service
   - Types from ../../../services/export-import/types

2. Create `ExportImportService` class with:

   Constructor:
   - Accept optional basePath parameter
   - Initialize FileSystemService instance
   - Store package.json version for manifest

   Public Methods:

   a) `async exportData(destPath: string, options?: IExportOptions): Promise<IExportResult>`
      - Read all files from storage directories (prompts, snippets, personas, templates, projects)
      - Generate IExportManifest with file entries and statistics
      - Create ZIP archive containing:
        - index.json at root
        - All files preserving directory structure
      - Save ZIP to destPath
      - Return IExportResult with success status and statistics

   b) `async importData(zipPath: string, options?: IImportOptions): Promise<IImportResult>`
      - Extract ZIP to temporary directory
      - Read and validate index.json
      - Validate file entries exist in ZIP
      - Copy files to storage with conflict resolution
      - Clean up temporary directory
      - Return IImportResult with imported counts and conflicts

   c) `async validateExport(zipPath: string): Promise<{ valid: boolean; errors: string[] }>`
      - Check ZIP structure
      - Validate index.json schema
      - Optionally verify checksums
      - Return validation result

   Private Methods:

   d) `private async readAllStorageFiles(): Promise<IExportFileEntry[]>`
      - Recursively read all files from storage directories
      - Extract metadata from frontmatter where applicable
      - Return array of file entries

   e) `private async generateManifest(files: IExportFileEntry[]): Promise<IExportManifest>`
      - Calculate statistics
      - Build manifest object with current timestamp and app version

   f) `private getFileType(relativePath: string): IExportFileEntry['type']`
      - Determine file type from path (prompts/, snippets/, etc.)

   g) `private async calculateChecksum(filePath: string): Promise<string>`
      - Calculate MD5 hash of file content

   h) `private async resolveConflict(targetPath: string, resolution: ConflictResolution): Promise<string>`
      - Implement skip/replace/rename logic
      - Return final target path

3. Export singleton getter: `getExportImportService(basePath?: string): ExportImportService`

4. Handle errors gracefully with try-catch and meaningful error messages

5. Use progress callbacks where appropriate for long operations

Reference the existing FileSystemService implementation at src/electron/main/services/file-system.service.ts for patterns and style consistency.
```

---

### Task 3: Add IPC Handlers for Export/Import Operations

**Purpose**: Expose the ExportImportService functionality to the renderer process through Electron IPC.

**Objective**: Add IPC handlers in both electron entry points (dev and production) and update the preload script to expose the API to the renderer.

**Task Architecture Description**:

- Add IPC handlers in `src/electron/main/index.ts`
- Add IPC handlers in `src-electron/electron-main.ts`
- Update `src/electron/preload/index.ts` with type definitions and implementations
- Handlers needed: `fs:exportData`, `fs:importData`, `fs:validateExport`, `fs:showSaveDialog`, `fs:showOpenDialog`

**Full Prompt**:

````
Add IPC handlers for the export/import functionality to the MyndPrompts Electron application.

CRITICAL: This project has TWO electron entry points. You MUST add handlers to BOTH files:
1. src/electron/main/index.ts (Development)
2. src-electron/electron-main.ts (Production/Quasar)

Step 1: Add IPC handlers to src/electron/main/index.ts

Add these handlers after the existing IPC handlers:

```typescript
import { getExportImportService } from './services/export-import.service';
import { dialog } from 'electron';

// Export/Import handlers
ipcMain.handle('fs:exportData', async (_event, options?: IExportOptions) => {
  const result = await dialog.showSaveDialog({
    title: 'Export MyndPrompts Data',
    defaultPath: `MyndPrompts-Export-${new Date().toISOString().split('T')[0]}.zip`,
    filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
  });

  if (result.canceled || !result.filePath) {
    return { success: false, error: 'Export cancelled' };
  }

  const service = getExportImportService();
  return service.exportData(result.filePath, options);
});

ipcMain.handle('fs:importData', async (_event, options?: IImportOptions) => {
  const result = await dialog.showOpenDialog({
    title: 'Import MyndPrompts Data',
    filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
    properties: ['openFile']
  });

  if (result.canceled || !result.filePaths.length) {
    return { success: false, error: 'Import cancelled' };
  }

  const service = getExportImportService();
  return service.importData(result.filePaths[0], options);
});

ipcMain.handle('fs:validateExport', async (_event, zipPath: string) => {
  const service = getExportImportService();
  return service.validateExport(zipPath);
});
````

Step 2: Add the SAME handlers to src-electron/electron-main.ts

Copy the exact same handler implementations to the production entry point.

Step 3: Update src/electron/preload/index.ts

Add the export/import API to the electronAPI object:

```typescript
// Add to the IElectronAPI interface:
exportData: (options?: IExportOptions) => Promise<IExportResult>;
importData: (options?: IImportOptions) => Promise<IImportResult>;
validateExport: (zipPath: string) => Promise<{ valid: boolean; errors: string[] }>;

// Add to the contextBridge.exposeInMainWorld('electronAPI', {...}):
exportData: (options) => ipcRenderer.invoke('fs:exportData', options),
importData: (options) => ipcRenderer.invoke('fs:importData', options),
validateExport: (zipPath) => ipcRenderer.invoke('fs:validateExport', zipPath),
```

Step 4: Import the types in preload

Add import for the export/import types at the top of the preload file.

Ensure all type imports are correct and the API is fully typed.

```

---

### Task 4: Create StorageSection Component with Export/Import UI

**Purpose**: Create a dedicated Vue component for the Storage settings section that includes the export and import functionality.

**Objective**: Build a reusable component that displays storage information and provides buttons for export/import operations with progress feedback.

**Task Architecture Description**:
- Create `src/components/settings/StorageSection.vue`
- Display current storage location
- Add "Export All Data" button with icon
- Add "Import Data" button with icon
- Show loading states during operations
- Display success/error notifications
- Use Quasar components for consistent styling

**Full Prompt**:
```

Create a new Vue component at `src/components/settings/StorageSection.vue` for the Storage settings section with export/import functionality.

Requirements:

1. Component Structure:
   - Use Vue 3 Composition API with <script setup lang="ts">
   - Import useI18n for translations
   - Import Quasar's useQuasar for notifications

2. Template Layout:
   a) Storage Location Display:
   - Label: "Storage Location" (translated)
   - Value: "~/.myndprompt" (from store or config)
   - Small info text explaining this is where all data is stored

   b) Export Section:
   - Section header: "Export Data"
   - Description text explaining export creates a ZIP with all prompts, snippets, etc.
   - "Export All Data" button (primary color, download icon)
   - When exporting: show loading spinner, disable button
   - On success: show notification with file path
   - On error: show error notification

   c) Import Section:
   - Section header: "Import Data"
   - Description text explaining import will add data from a ZIP file
   - Warning text about potential conflicts
   - "Import Data" button (secondary color, upload icon)
   - When importing: show loading spinner, disable button
   - On success: show notification with import summary (X prompts, Y snippets imported)
   - On error: show error notification

3. Functionality:

   ```typescript
   const isExporting = ref(false);
   const isImporting = ref(false);

   async function handleExport() {
     isExporting.value = true;
     try {
       const result = await window.electronAPI.exportData();
       if (result.success) {
         $q.notify({
           type: 'positive',
           message: t('settings.storage.exportSuccess'),
           caption: result.path,
         });
       } else if (result.error !== 'Export cancelled') {
         throw new Error(result.error);
       }
     } catch (error) {
       $q.notify({
         type: 'negative',
         message: t('settings.storage.exportError'),
         caption: error.message,
       });
     } finally {
       isExporting.value = false;
     }
   }

   async function handleImport() {
     isImporting.value = true;
     try {
       const result = await window.electronAPI.importData();
       if (result.success) {
         // Refresh stores
         await promptStore.loadPrompts();
         await snippetStore.loadSnippets();

         $q.notify({
           type: 'positive',
           message: t('settings.storage.importSuccess'),
           caption: `${result.imported.prompts} prompts, ${result.imported.snippets} snippets imported`,
         });
       } else if (result.error !== 'Import cancelled') {
         throw new Error(result.error);
       }
     } catch (error) {
       $q.notify({
         type: 'negative',
         message: t('settings.storage.importError'),
         caption: error.message,
       });
     } finally {
       isImporting.value = false;
     }
   }
   ```

4. Styling:
   - Use consistent spacing (margin-bottom: 16px between sections)
   - Use Quasar's q-btn with appropriate props (flat/outlined as needed)
   - Support both light and dark themes
   - Match the styling pattern from SettingsDialog.vue

5. Props: None needed (component is self-contained)

6. Emits: None needed (notifications handle feedback)

Use Quasar components: q-btn, q-spinner, q-icon, and standard HTML elements for layout.

```

---

### Task 5: Integrate StorageSection into SettingsDialog

**Purpose**: Replace the inline storage section in SettingsDialog with the new StorageSection component.

**Objective**: Update SettingsDialog.vue to import and use the StorageSection component, maintaining the existing settings structure.

**Task Architecture Description**:
- Import StorageSection component in SettingsDialog.vue
- Replace the template v-if="selectedCategory === 'storage'" section with <StorageSection />
- Ensure the component receives any necessary props
- Test that the integration works with the category selection

**Full Prompt**:
```

Update `src/components/dialogs/SettingsDialog.vue` to integrate the new StorageSection component.

Changes needed:

1. Add import statement at the top of <script setup>:

   ```typescript
   import StorageSection from '@/components/settings/StorageSection.vue';
   ```

2. Replace the existing storage template section (approximately lines 422-432):

   Current code:

   ```html
   <!-- Storage -->
   <template v-if="selectedCategory === 'storage'">
     <div class="settings-dialog__section">
       <div class="settings-dialog__section-title">{{ t('settingsPanel.storage') }}</div>
       <div class="settings-dialog__setting">
         <span class="settings-dialog__setting-label"
           >{{ t('settingsPanel.storageLocation') }}:</span
         >
         <span class="settings-dialog__setting-value">~/.myndprompt</span>
       </div>
     </div>
   </template>
   ```

   Replace with:

   ```html
   <!-- Storage -->
   <template v-if="selectedCategory === 'storage'">
     <div class="settings-dialog__section">
       <div class="settings-dialog__section-title">{{ t('settingsPanel.storage') }}</div>
       <StorageSection />
     </div>
   </template>
   ```

3. Verify the import is added alongside other component imports (CategoryListEditor, FileSyncSection).

4. No additional props or events need to be passed - StorageSection is self-contained.

The StorageSection component will handle:

- Displaying the storage location
- Export functionality with button and notifications
- Import functionality with button and notifications
- Loading states and error handling

```

---

### Task 6: Add i18n Translation Keys for All Locales

**Purpose**: Add all necessary translation keys for the export/import feature across all supported languages.

**Objective**: Update all 10 locale files with translation keys for labels, buttons, messages, and error texts.

**Task Architecture Description**:
- Update locale files: en-US, en-GB, en-IE, pt-BR, pt-PT, es-ES, fr-FR, de-DE, it-IT, ar-SA
- Add keys under `settings.storage` namespace
- Include keys for: export/import buttons, descriptions, success messages, error messages, progress states

**Full Prompt**:
```

Add i18n translation keys for the export/import functionality to all locale files in `src/i18n/`.

Add the following keys to the `settings.storage` section in each locale file. I'll provide the English (en-US) translations - translate appropriately for each language:

```typescript
settings: {
  storage: {
    // Storage section
    title: 'Storage',
    location: 'Storage Location',
    locationDescription: 'All your prompts, snippets, and settings are stored in this location.',

    // Export section
    exportTitle: 'Export Data',
    exportDescription: 'Export all your prompts, snippets, personas, and templates as a ZIP archive.',
    exportButton: 'Export All Data',
    exportSuccess: 'Data exported successfully',
    exportError: 'Failed to export data',
    exporting: 'Exporting...',

    // Import section
    importTitle: 'Import Data',
    importDescription: 'Import prompts and other data from a previously exported ZIP archive.',
    importWarning: 'Existing files with the same name will be renamed to avoid conflicts.',
    importButton: 'Import Data',
    importSuccess: 'Data imported successfully',
    importError: 'Failed to import data',
    importing: 'Importing...',

    // Summary messages
    importSummary: '{prompts} prompts, {snippets} snippets, {personas} personas imported',
    conflictsResolved: '{count} file conflicts were resolved by renaming',
  }
}
```

Files to update:

1. src/i18n/en-US/index.ts
2. src/i18n/en-GB/index.ts
3. src/i18n/en-IE/index.ts
4. src/i18n/pt-BR/index.ts
5. src/i18n/pt-PT/index.ts
6. src/i18n/es-ES/index.ts
7. src/i18n/fr-FR/index.ts
8. src/i18n/de-DE/index.ts
9. src/i18n/it-IT/index.ts
10. src/i18n/ar-SA/index.ts

For each language, provide accurate translations maintaining the meaning and context. Ensure placeholders like {prompts}, {snippets}, {count} are preserved in the translated strings.

If a `settings` or `storage` section doesn't exist in a locale file, add it. Match the existing structure and formatting of each locale file.

```

---

### Task 7: Implement Progress Tracking and Notifications

**Purpose**: Add progress feedback during export/import operations so users can see the operation status.

**Objective**: Implement progress events that are sent from main process to renderer, updating the UI with current operation status.

**Task Architecture Description**:
- Add IPC event emitters in ExportImportService for progress updates
- Listen to progress events in StorageSection component
- Display progress bar or status text during operations
- Show file count and current file being processed

**Full Prompt**:
```

Enhance the export/import functionality with progress tracking.

Part 1: Update ExportImportService (src/electron/main/services/export-import.service.ts)

Add progress event emission during export/import operations:

```typescript
import { BrowserWindow } from 'electron';

// In exportData method, emit progress events:
private emitProgress(progress: IExportProgress | IImportProgress) {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.webContents.send('export-import:progress', progress);
  }
}

// During file reading:
this.emitProgress({
  phase: 'reading',
  current: index + 1,
  total: totalFiles,
  currentFile: file.name
});

// During compression:
this.emitProgress({
  phase: 'compressing',
  current: bytesWritten,
  total: totalBytes
});
```

Part 2: Update preload (src/electron/preload/index.ts)

Add progress event listener:

```typescript
onExportImportProgress: (callback: (progress: IExportProgress | IImportProgress) => void) => {
  const handler = (_event: IpcRendererEvent, progress: IExportProgress | IImportProgress) => {
    callback(progress);
  };
  ipcRenderer.on('export-import:progress', handler);
  return () => {
    ipcRenderer.removeListener('export-import:progress', handler);
  };
};
```

Part 3: Update StorageSection component

Add progress tracking state and UI:

```typescript
const progress = ref<IExportProgress | IImportProgress | null>(null);

onMounted(() => {
  const unsubscribe = window.electronAPI.onExportImportProgress((p) => {
    progress.value = p;
  });

  onUnmounted(() => {
    unsubscribe();
  });
});
```

In template, show progress when exporting/importing:

```html
<div
  v-if="isExporting && progress"
  class="progress-info"
>
  <q-linear-progress :value="progress.current / progress.total" />
  <span>{{ progress.phase }}: {{ progress.current }}/{{ progress.total }}</span>
  <span v-if="progress.currentFile">{{ progress.currentFile }}</span>
</div>
```

Add appropriate styling for the progress indicator.

```

---

### Task 8: Add Error Handling and Validation

**Purpose**: Implement comprehensive error handling and input validation for robust export/import operations.

**Objective**: Add validation for ZIP files, handle edge cases, provide meaningful error messages, and ensure data integrity.

**Task Architecture Description**:
- Validate ZIP file structure before import
- Check for required index.json
- Validate manifest version compatibility
- Handle corrupted files gracefully
- Provide specific error messages for different failure modes
- Add file size limits and warnings for large exports

**Full Prompt**:
```

Enhance the export/import functionality with comprehensive error handling and validation.

Part 1: Update ExportImportService with validation methods

Add these validation methods to src/electron/main/services/export-import.service.ts:

```typescript
// Validate ZIP file before import
async validateZipFile(zipPath: string): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Check file exists
    await fs.access(zipPath);

    // Check file extension
    if (!zipPath.endsWith('.zip')) {
      errors.push('File must be a ZIP archive');
    }

    // Check file size (warn if > 100MB)
    const stats = await fs.stat(zipPath);
    if (stats.size > 100 * 1024 * 1024) {
      errors.push('Warning: Large file may take time to process');
    }

    // Extract to temp and validate structure
    const tempDir = await this.extractToTemp(zipPath);

    // Check for index.json
    const indexPath = path.join(tempDir, 'index.json');
    if (!await this.fileExists(indexPath)) {
      errors.push('Missing index.json manifest file');
    } else {
      // Validate manifest
      const manifest = JSON.parse(await fs.readFile(indexPath, 'utf-8'));
      const manifestErrors = this.validateManifest(manifest);
      errors.push(...manifestErrors);
    }

    // Clean up temp
    await fs.rm(tempDir, { recursive: true });

  } catch (error) {
    errors.push(`Validation error: ${error.message}`);
  }

  return { valid: errors.length === 0, errors };
}

// Validate manifest schema
private validateManifest(manifest: unknown): string[] {
  const errors: string[] = [];

  if (!manifest || typeof manifest !== 'object') {
    return ['Invalid manifest format'];
  }

  const m = manifest as Record<string, unknown>;

  if (!m.version) errors.push('Missing version field');
  if (!m.exportedAt) errors.push('Missing exportedAt field');
  if (!Array.isArray(m.files)) errors.push('Missing or invalid files array');

  // Check version compatibility
  if (m.version && !this.isVersionCompatible(m.version as string)) {
    errors.push(`Incompatible export version: ${m.version}`);
  }

  return errors;
}

// Version compatibility check
private isVersionCompatible(version: string): boolean {
  const [major] = version.split('.').map(Number);
  return major === 1; // Accept all 1.x versions
}
```

Part 2: Update import method with validation

Before importing, validate the ZIP:

```typescript
async importData(zipPath: string, options?: IImportOptions): Promise<IImportResult> {
  // Validate first
  const validation = await this.validateZipFile(zipPath);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.errors.join('; '),
      imported: { prompts: 0, snippets: 0, personas: 0, templates: 0, projects: 0 },
      skipped: 0,
      conflicts: []
    };
  }

  // Continue with import...
}
```

Part 3: Add specific error types

Create error classes for different failure modes:

```typescript
export class ExportError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'ExportError';
  }
}

export class ImportError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'ImportError';
  }
}

// Error codes
export const ERROR_CODES = {
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  INVALID_ZIP: 'INVALID_ZIP',
  MISSING_MANIFEST: 'MISSING_MANIFEST',
  INVALID_MANIFEST: 'INVALID_MANIFEST',
  VERSION_INCOMPATIBLE: 'VERSION_INCOMPATIBLE',
  WRITE_ERROR: 'WRITE_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
} as const;
```

Part 4: Update StorageSection with error display

Show specific error messages to users:

```typescript
function getErrorMessage(error: Error): string {
  if (error instanceof ImportError) {
    switch (error.code) {
      case 'INVALID_ZIP':
        return t('settings.storage.errors.invalidZip');
      case 'MISSING_MANIFEST':
        return t('settings.storage.errors.missingManifest');
      // ... etc
    }
  }
  return error.message;
}
```

```

---

### Task 9: Write Unit Tests for ExportImportService

**Purpose**: Create comprehensive unit tests for the ExportImportService to ensure reliability.

**Objective**: Write tests covering export, import, validation, and error handling scenarios.

**Task Architecture Description**:
- Create test file at `src/electron/main/services/__tests__/export-import.service.test.ts`
- Use vitest for testing
- Mock file system operations
- Test export with various file configurations
- Test import with valid and invalid ZIPs
- Test conflict resolution strategies
- Test error handling

**Full Prompt**:
```

Create unit tests for the ExportImportService at `src/electron/main/services/__tests__/export-import.service.test.ts`.

Use vitest as the testing framework. Tests should cover:

1. Export functionality:
   - Export with all file types (prompts, snippets, personas, templates)
   - Export with options to exclude certain types
   - Export generates valid index.json
   - Export creates valid ZIP structure
   - Export with empty storage directory
   - Export with nested folder structure

2. Import functionality:
   - Import valid ZIP file
   - Import with conflict resolution: skip
   - Import with conflict resolution: replace
   - Import with conflict resolution: rename
   - Import updates statistics correctly
   - Import handles missing files gracefully

3. Validation:
   - Validate valid ZIP passes
   - Validate ZIP without index.json fails
   - Validate ZIP with invalid manifest fails
   - Validate incompatible version fails
   - Validate corrupted ZIP fails

4. Error handling:
   - Handle non-existent ZIP file
   - Handle permission errors
   - Handle disk full scenario
   - Handle invalid paths

Example test structure:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExportImportService } from '../export-import.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('ExportImportService', () => {
  let service: ExportImportService;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'myndprompts-test-'));
    service = new ExportImportService(tempDir);

    // Create test file structure
    await fs.mkdir(path.join(tempDir, 'prompts'), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, 'prompts', 'test.md'),
      '---\nid: test-1\ntitle: Test Prompt\n---\nContent'
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('exportData', () => {
    it('should create a valid ZIP file with index.json', async () => {
      const exportPath = path.join(tempDir, 'export.zip');
      const result = await service.exportData(exportPath);

      expect(result.success).toBe(true);
      expect(result.path).toBe(exportPath);
      expect(result.statistics.prompts).toBe(1);

      // Verify ZIP exists
      const exists = await fs
        .access(exportPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    // More tests...
  });

  describe('importData', () => {
    it('should import files from valid ZIP', async () => {
      // Create export first
      const exportPath = path.join(tempDir, 'export.zip');
      await service.exportData(exportPath);

      // Clear storage
      await fs.rm(path.join(tempDir, 'prompts'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'prompts'));

      // Import
      const result = await service.importData(exportPath);

      expect(result.success).toBe(true);
      expect(result.imported.prompts).toBe(1);
    });

    // More tests...
  });

  describe('validateExport', () => {
    it('should pass validation for valid export', async () => {
      const exportPath = path.join(tempDir, 'export.zip');
      await service.exportData(exportPath);

      const validation = await service.validateExport(exportPath);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    // More tests...
  });
});
```

Ensure tests are isolated and don't affect the actual user's storage directory.

```

---

### Task 10: End-to-End Testing and Documentation

**Purpose**: Perform end-to-end testing of the complete export/import feature and create user documentation.

**Objective**: Verify the feature works correctly in all scenarios, update README, and create user-facing documentation.

**Task Architecture Description**:
- Manual testing checklist for all scenarios
- Create E2E tests using Playwright if applicable
- Update README with export/import feature description
- Create user documentation for the feature

**Full Prompt**:
```

Complete the export/import feature implementation with E2E testing and documentation.

Part 1: Manual Testing Checklist

Test the following scenarios:

Export Testing:
[ ] Export with prompts only
[ ] Export with all file types
[ ] Export with nested folder structures
[ ] Export with special characters in filenames
[ ] Export to different locations
[ ] Cancel export dialog
[ ] Export large number of files (100+)
[ ] Verify ZIP can be opened by standard tools
[ ] Verify index.json contents are correct

Import Testing:
[ ] Import to empty storage
[ ] Import with existing files (test rename conflict resolution)
[ ] Import from export created on same machine
[ ] Import from export created on different machine (cross-platform)
[ ] Import corrupted ZIP (should show error)
[ ] Import ZIP without index.json (should show error)
[ ] Import and verify all files are accessible
[ ] Cancel import dialog
[ ] Import large export (100+ files)

UI Testing:
[ ] Export button shows loading state
[ ] Import button shows loading state
[ ] Success notifications appear correctly
[ ] Error notifications appear correctly
[ ] Progress indicator works (if implemented)
[ ] Translations work in all languages
[ ] Dark/light theme support

Part 2: Update Documentation

Add a section to the project README or create a user guide:

```markdown
## Export and Import

MyndPrompts allows you to export all your data as a ZIP archive and import it back later or on another machine.

### Exporting Data

1. Open Settings (gear icon in the sidebar or Cmd/Ctrl + ,)
2. Navigate to the "Storage" section
3. Click "Export All Data"
4. Choose a location to save the ZIP file
5. Wait for the export to complete

The export includes:

- All prompts with their folder structure
- Snippets
- Personas
- Templates
- Project configurations

### Importing Data

1. Open Settings
2. Navigate to the "Storage" section
3. Click "Import Data"
4. Select a previously exported ZIP file
5. Wait for the import to complete

**Note:** If a file already exists with the same name, it will be renamed to avoid conflicts (e.g., `prompt.md` becomes `prompt (imported).md`).

### Export File Format

The export is a standard ZIP file containing:

- `index.json` - Manifest with file metadata
- `prompts/` - All prompt files
- `snippets/` - All snippet files
- `personas/` - All persona files
- `templates/` - All template files
- `projects/` - Project configurations
```

Part 3: Code Review Checklist

Before considering the feature complete, verify:
[ ] All TypeScript types are correct
[ ] No ESLint errors
[ ] No console errors in dev tools
[ ] Memory is not leaking (check with repeated exports)
[ ] IPC handlers are in BOTH entry points
[ ] Translations exist in all 10 locales
[ ] Error messages are user-friendly
[ ] Loading states prevent double-clicks

````

---

## Appendix: Dependencies Installation

Run the following commands to install required dependencies:

```bash
# Production dependencies
npm install archiver extract-zip

# Dev dependencies
npm install -D @types/archiver
````

## Appendix: File Checklist

Files created:

- [x] `src/services/export-import/types.ts`
- [x] `src/electron/main/services/export-import.service.ts`
- [x] `src/components/settings/StorageSection.vue`
- [x] `src/electron/main/services/__tests__/export-import.service.test.ts`

Files modified:

- [x] `src/electron/main/index.ts` (add IPC handlers)
- [x] `src-electron/electron-main.ts` (add IPC handlers)
- [x] `src/electron/preload/index.ts` (add API exposure)
- [x] `src/components/dialogs/SettingsDialog.vue` (integrate StorageSection)
- [x] `src/i18n/en-US/index.ts` (add translations)
- [x] `src/i18n/en-GB/index.ts` (add translations)
- [x] `src/i18n/en-IE/index.ts` (add translations)
- [x] `src/i18n/pt-BR/index.ts` (add translations)
- [x] `src/i18n/pt-PT/index.ts` (add translations)
- [x] `src/i18n/es-ES/index.ts` (add translations)
- [x] `src/i18n/fr-FR/index.ts` (add translations)
- [x] `src/i18n/de-DE/index.ts` (add translations)
- [x] `src/i18n/it-IT/index.ts` (add translations)
- [x] `src/i18n/ar-SA/index.ts` (add translations)
- [x] `package.json` (add archiver, extract-zip dependencies)
- [x] `README.md` (add export/import documentation)

---

## Appendix: Implementation Completion Report

### Code Review Checklist (Completed)

- [x] All TypeScript types are correct (no type errors in export-import files)
- [x] No critical ESLint errors (only formatting warnings remain)
- [x] IPC handlers are in BOTH entry points (src/electron/main/index.ts and src-electron/electron-main.ts)
- [x] Translations exist in all 10 locales
- [x] Error messages are user-friendly with localized error codes
- [x] Loading states prevent double-clicks (buttons disabled during operations)

### Unit Test Results

**26 tests passing** covering:

1. **Export functionality** (6 tests)
   - Creates valid ZIP file with index.json
   - Includes correct statistics in export result
   - Exports with options to exclude certain types
   - Handles empty storage directory
   - Preserves nested folder structure
   - Handles export with empty storage gracefully

2. **Import functionality** (6 tests)
   - Imports files from valid ZIP
   - Handles conflict resolution: skip
   - Handles conflict resolution: replace
   - Handles conflict resolution: rename
   - Tracks conflicts in result
   - Fails gracefully with invalid ZIP

3. **Validation tests** (8 tests)
   - Passes validation for valid export
   - Fails validation for non-existent file (FILE_NOT_FOUND)
   - Fails validation for empty file (EMPTY_FILE)
   - Fails validation for ZIP without index.json (MISSING_MANIFEST)
   - Fails validation for invalid manifest JSON (INVALID_MANIFEST)
   - Fails validation for incompatible version (VERSION_INCOMPATIBLE)
   - Fails validation for corrupted ZIP (CORRUPTED_ZIP)
   - Returns warnings for large files

4. **Error handling** (4 tests)
   - Includes error code for file not found
   - Detects error codes from import result
   - Returns correct error for invalid ZIP file
   - Handles missing files in ZIP gracefully

5. **Singleton tests** (2 tests)
   - Returns the same instance
   - Resets the instance

### Documentation Added

- Export/Import section added to `README.md` with:
  - Step-by-step export instructions
  - Step-by-step import instructions
  - Export file format description
  - Conflict resolution behavior
- Roadmap updated to mark export/import feature as complete
