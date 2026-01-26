# Move Storage Feature - Implementation Document

## Overview

This document describes the implementation of the "Move Storage" feature that allows users to relocate their MyndPrompts storage to a different location on the same computer. This is a critical data management feature that requires careful handling to ensure data integrity.

---

## 1. Architecture

### 1.1 Current Storage Architecture

```
~/.myndprompt/                    # Base storage directory (configurable)
├── prompts/                      # Prompt markdown files (.md)
│   └── <project-folders>/        # Project subdirectories
│       ├── prompt1.md
│       └── prompt2.md
├── snippets/                     # Snippet files (*.snippet.md)
├── personas/                     # Persona files (*.persona.md)
├── templates/                    # Template files (*.template.md)
├── projects/                     # Project metadata folder
└── backups/                      # Backup files
```

### 1.2 Data Storage Layers

| Layer         | Technology   | Purpose                                       |
| ------------- | ------------ | --------------------------------------------- |
| File System   | Node.js fs   | Actual file storage (prompts, snippets, etc.) |
| IndexedDB     | Dexie.js     | Metadata, indexes, configuration              |
| Electron Main | IPC Handlers | File operations bridge                        |
| Vue Frontend  | Pinia Stores | Runtime state management                      |

### 1.3 Key Components Involved

| Component              | File Path                                                       | Role                      |
| ---------------------- | --------------------------------------------------------------- | ------------------------- |
| StorageSection         | `src/components/settings/StorageSection.vue`                    | UI for storage management |
| SettingsDialog         | `src/components/dialogs/SettingsDialog.vue`                     | Parent dialog container   |
| FileSystemService      | `src/electron/main/services/file-system.service.ts`             | File operations           |
| ConfigRepository       | `src/services/storage/repositories/config.repository.ts`        | Config persistence        |
| ProjectRepository      | `src/services/storage/repositories/project.repository.ts`       | Project metadata          |
| ProjectIndexRepository | `src/services/storage/repositories/project-index.repository.ts` | File indexing             |
| Preload API            | `src/electron/preload/index.ts`                                 | IPC bridge to renderer    |

### 1.4 Move Storage Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MOVE STORAGE WORKFLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   PHASE 1    │────▶│   PHASE 2    │────▶│   PHASE 3    │────▶│   PHASE 4    │
│  Validation  │     │    Copy      │     │   Update     │     │   Cleanup    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │                    │
       ▼                    ▼                    ▼                    ▼
  • Check dest        • Copy prompts      • Update config      • Ask user to
    is empty          • Copy snippets       repository          delete source
  • Check disk        • Copy personas     • Update project     • Verify success
    space             • Copy templates      paths in DB        • Show summary
  • Validate          • Copy projects     • Update file
    permissions       • Copy backups        indexes
  • User confirm      • Verify each       • Reinitialize
                        file copied         services

                    ┌─────────────────────────────────────┐
                    │         PROGRESS TRACKING           │
                    ├─────────────────────────────────────┤
                    │  • Total files to copy              │
                    │  • Current file being copied        │
                    │  • Bytes transferred                │
                    │  • Current phase/stage              │
                    │  • Cancellation support             │
                    │  • Error handling with rollback     │
                    └─────────────────────────────────────┘
```

### 1.5 Service Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NEW SERVICE: StorageMigrationService                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────┐
│     StorageMigrationService           │
│     (Electron Main Process)           │
├───────────────────────────────────────┤
│  Methods:                             │
│  ─────────────────────────────────    │
│  + validateDestination(path)          │
│  + calculateMigrationPlan()           │
│  + startMigration(source, dest)       │
│  + cancelMigration()                  │
│  + verifyMigration()                  │
│  + updateDatabasePaths(old, new)      │
│  + cleanupSource()                    │
│                                       │
│  Events:                              │
│  ─────────────────────────────────    │
│  → onProgress(phase, current, total)  │
│  → onPhaseChange(phase)               │
│  → onError(error, recoverable)        │
│  → onComplete(summary)                │
│  → onCancelled()                      │
└───────────────────────────────────────┘
         │
         │ Uses
         ▼
┌───────────────────────────────────────┐
│     FileSystemService                 │
│     (Existing)                        │
├───────────────────────────────────────┤
│  + copyDirectoryToDirectory()         │
│  + copyFile()                         │
│  + directoryExists()                  │
│  + listDirectory()                    │
│  + getBasePath()                      │
└───────────────────────────────────────┘
```

### 1.6 IPC Communication Flow

```
┌─────────────┐          ┌─────────────┐          ┌─────────────┐
│  Renderer   │          │   Preload   │          │    Main     │
│  (Vue App)  │          │   (Bridge)  │          │  (Electron) │
└──────┬──────┘          └──────┬──────┘          └──────┬──────┘
       │                        │                        │
       │  selectDirectory()     │                        │
       │───────────────────────▶│   ipc:select-dir       │
       │                        │───────────────────────▶│
       │                        │                        │ showOpenDialog()
       │                        │◀───────────────────────│
       │◀───────────────────────│   returns path         │
       │                        │                        │
       │  validateMigration()   │                        │
       │───────────────────────▶│   fs:validate-migrate  │
       │                        │───────────────────────▶│
       │                        │                        │ checkSpace, perms
       │◀───────────────────────│   returns validation   │
       │                        │                        │
       │  startMigration()      │                        │
       │───────────────────────▶│   fs:start-migration   │
       │                        │───────────────────────▶│
       │                        │                        │ ┌─────────────┐
       │                        │  progress events       │ │ Migration   │
       │◀───────────────────────│◀──────────────────────│ │ in progress │
       │◀───────────────────────│◀──────────────────────│ └─────────────┘
       │                        │  complete/error        │
       │◀───────────────────────│◀──────────────────────│
       │                        │                        │
```

### 1.7 Database Updates Required

```sql
-- Tables that need path updates after migration:

1. appConfig (config key-value pairs)
   UPDATE appConfig
   SET value = REPLACE(value, oldBasePath, newBasePath)
   WHERE key IN ('prompts.directory', 'snippets.directory',
                 'personas.directory', 'templates.directory',
                 'backup.directory');

2. projects (project metadata)
   UPDATE projects
   SET folderPath = REPLACE(folderPath, oldBasePath, newBasePath)
   WHERE folderPath LIKE oldBasePath + '%';

3. fileIndex (file sync indexes)
   UPDATE fileIndex
   SET filePath = REPLACE(filePath, oldBasePath, newBasePath)
   WHERE filePath LIKE oldBasePath + '%';

4. projectFolders (file sync associations)
   UPDATE projectFolders
   SET folderPath = REPLACE(folderPath, oldBasePath, newBasePath)
   WHERE folderPath LIKE oldBasePath + '%';
```

---

## 2. Todos

### Implementation Checklist

- [x] **Task 1**: Create StorageMigrationService in Electron main process
- [x] **Task 2**: Add IPC handlers for migration operations (both entry points)
- [x] **Task 3**: Extend Preload API with migration methods
- [x] **Task 4**: Create MoveStorageDialog component
- [x] **Task 5**: Update StorageSection with Move Storage button
- [x] **Task 6**: Implement progress tracking and cancellation
- [x] **Task 7**: Implement database path update logic
- [x] **Task 8**: Add i18n translations for all languages
- [x] **Task 9**: Add error handling and rollback capabilities
- [x] **Task 10**: Testing and edge case handling

### Progress Summary

| Task    | Status | Description             |
| ------- | ------ | ----------------------- |
| Task 1  | [x]    | StorageMigrationService |
| Task 2  | [x]    | IPC Handlers            |
| Task 3  | [x]    | Preload API             |
| Task 4  | [x]    | MoveStorageDialog       |
| Task 5  | [x]    | StorageSection Update   |
| Task 6  | [x]    | Progress Tracking       |
| Task 7  | [x]    | Database Updates        |
| Task 8  | [x]    | i18n Translations       |
| Task 9  | [x]    | Error Handling          |
| Task 10 | [x]    | Testing                 |

---

## 3. Task Details

---

### Task 1: Create StorageMigrationService

#### Purpose

Create the core backend service that handles all storage migration operations in the Electron main process.

#### Objective

Implement a robust service that can:

- Validate destination directories
- Copy all storage content with progress tracking
- Verify data integrity after copying
- Support cancellation at any point
- Handle errors gracefully

#### Task Architecture Description

The `StorageMigrationService` will be a singleton service in the Electron main process that orchestrates the entire migration workflow. It will:

1. **Validation Phase**: Check destination path validity, available disk space, write permissions
2. **Planning Phase**: Calculate total files, sizes, and create a migration manifest
3. **Copy Phase**: Recursively copy all directories with progress events
4. **Verification Phase**: Compare source and destination file counts and sizes
5. **Completion Phase**: Signal success or provide rollback capability

```typescript
interface IMigrationProgress {
  phase: 'validating' | 'planning' | 'copying' | 'verifying' | 'completing';
  totalFiles: number;
  copiedFiles: number;
  totalBytes: number;
  copiedBytes: number;
  currentFile: string;
  currentDirectory: string;
  canCancel: boolean;
}

interface IMigrationResult {
  success: boolean;
  sourcePath: string;
  destinationPath: string;
  filesCopied: number;
  bytesCopied: number;
  duration: number;
  errors: string[];
}
```

#### Full Prompt

````
# Task: Create StorageMigrationService

## Context
You are working on MyndPrompts, a Vue 3 + Quasar + Electron desktop application. You need to create a new service in the Electron main process to handle storage migration.

## Files to Create
- `src/electron/main/services/storage-migration.service.ts`

## Requirements

1. Create a singleton service class `StorageMigrationService` with the following:

2. **Interfaces** (define at top of file):
   - `IMigrationProgress`: phase, totalFiles, copiedFiles, totalBytes, copiedBytes, currentFile, currentDirectory, canCancel
   - `IMigrationResult`: success, sourcePath, destinationPath, filesCopied, bytesCopied, duration, errors
   - `IMigrationPlan`: directories to copy, estimated size, file count per directory

3. **Constructor**:
   - Accept `fileSystemService: FileSystemService` as dependency
   - Initialize cancellation token
   - Set up event emitter for progress

4. **Methods to implement**:

   a. `async validateDestination(destPath: string): Promise<{valid: boolean, error?: string, availableSpace?: number}>`
      - Check if path exists or can be created
      - Check write permissions
      - Check available disk space (use Node.js `fs.statfs` or similar)
      - Ensure destination is not inside source
      - Ensure destination is empty or doesn't exist

   b. `async calculateMigrationPlan(sourcePath: string): Promise<IMigrationPlan>`
      - List all directories: prompts, snippets, personas, templates, projects, backups
      - Count files in each directory recursively
      - Calculate total size
      - Return structured plan

   c. `async startMigration(sourcePath: string, destPath: string, onProgress: (progress: IMigrationProgress) => void): Promise<IMigrationResult>`
      - Create destination directory structure
      - Copy directories in order: prompts, snippets, personas, templates, projects, backups
      - Emit progress events during copy
      - Check cancellation token between operations
      - Return result with statistics

   d. `async verifyMigration(sourcePath: string, destPath: string): Promise<{verified: boolean, discrepancies: string[]}>`
      - Compare file counts in each directory
      - Compare file sizes
      - Return verification result

   e. `cancelMigration(): void`
      - Set cancellation token
      - Stop current operations gracefully

   f. `async cleanupSource(sourcePath: string): Promise<void>`
      - Delete source directory after user confirmation
      - This should only be called after successful migration

5. **Helper methods**:
   - `private async copyDirectoryWithProgress(source: string, dest: string, onProgress: callback)`
   - `private async countFilesRecursive(dirPath: string): Promise<number>`
   - `private async calculateDirectorySize(dirPath: string): Promise<number>`

6. **Export singleton**:
   ```typescript
   let instance: StorageMigrationService | null = null;
   export function getStorageMigrationService(fileSystemService: FileSystemService): StorageMigrationService {
     if (!instance) {
       instance = new StorageMigrationService(fileSystemService);
     }
     return instance;
   }
````

## Reference Files

- Look at `src/electron/main/services/export-import.service.ts` for progress tracking patterns
- Look at `src/electron/main/services/file-system.service.ts` for file operations

## Code Style

- Use TypeScript with explicit return types
- Use async/await consistently
- Add JSDoc comments for public methods
- Use proper error handling with try/catch
- Follow existing code patterns in the codebase

```

---

### Task 2: Add IPC Handlers for Migration Operations

#### Purpose
Create IPC handlers in both Electron entry points to expose the migration service to the renderer process.

#### Objective
Add IPC handlers that:
- Expose migration service methods to the frontend
- Handle progress events via WebContents
- Support both development and production builds

#### Task Architecture Description

As per CLAUDE.md, MyndPrompts has TWO Electron entry points that must BOTH be updated:
1. `src/electron/main/index.ts` - Development entry point
2. `src-electron/electron-main.ts` - Production/Quasar entry point

The IPC handlers will use:
- `ipcMain.handle()` for request/response patterns
- `webContents.send()` for progress event streaming

#### Full Prompt

```

# Task: Add IPC Handlers for Migration Operations

## Context

You are working on MyndPrompts, a Vue 3 + Quasar + Electron application.

CRITICAL: This project has TWO electron main process entry points. You MUST add handlers to BOTH files:

1. `src/electron/main/index.ts` - Development entry point
2. `src-electron/electron-main.ts` - Production/Quasar entry point

## Requirements

1. **Import the StorageMigrationService** in both files:

   ```typescript
   import { getStorageMigrationService } from './services/storage-migration.service';
   // or for src-electron:
   import { getStorageMigrationService } from '../src/electron/main/services/storage-migration.service';
   ```

2. **Add the following IPC handlers** to BOTH files:

   a. `fs:validate-migration-destination`

   ```typescript
   ipcMain.handle('fs:validate-migration-destination', async (_event, destPath: string) => {
     const migrationService = getStorageMigrationService(fileSystemService);
     return migrationService.validateDestination(destPath);
   });
   ```

   b. `fs:calculate-migration-plan`

   ```typescript
   ipcMain.handle('fs:calculate-migration-plan', async (_event) => {
     const migrationService = getStorageMigrationService(fileSystemService);
     const sourcePath = fileSystemService.getBasePath();
     return migrationService.calculateMigrationPlan(sourcePath);
   });
   ```

   c. `fs:start-migration`

   ```typescript
   ipcMain.handle('fs:start-migration', async (event, destPath: string) => {
     const migrationService = getStorageMigrationService(fileSystemService);
     const sourcePath = fileSystemService.getBasePath();

     return migrationService.startMigration(sourcePath, destPath, (progress) => {
       // Send progress to renderer
       event.sender.send('fs:migration-progress', progress);
     });
   });
   ```

   d. `fs:cancel-migration`

   ```typescript
   ipcMain.handle('fs:cancel-migration', async () => {
     const migrationService = getStorageMigrationService(fileSystemService);
     migrationService.cancelMigration();
     return { cancelled: true };
   });
   ```

   e. `fs:verify-migration`

   ```typescript
   ipcMain.handle('fs:verify-migration', async (_event, destPath: string) => {
     const migrationService = getStorageMigrationService(fileSystemService);
     const sourcePath = fileSystemService.getBasePath();
     return migrationService.verifyMigration(sourcePath, destPath);
   });
   ```

   f. `fs:cleanup-old-storage`

   ```typescript
   ipcMain.handle('fs:cleanup-old-storage', async (_event, sourcePath: string) => {
     const migrationService = getStorageMigrationService(fileSystemService);
     await migrationService.cleanupSource(sourcePath);
     return { success: true };
   });
   ```

   g. `fs:select-migration-folder` (folder picker dialog)

   ```typescript
   ipcMain.handle('fs:select-migration-folder', async () => {
     const { dialog } = require('electron');
     const result = await dialog.showOpenDialog({
       properties: ['openDirectory', 'createDirectory'],
       title: 'Select New Storage Location',
       buttonLabel: 'Select Folder',
     });

     if (result.canceled || result.filePaths.length === 0) {
       return { cancelled: true, path: null };
     }
     return { cancelled: false, path: result.filePaths[0] };
   });
   ```

3. **Add these handlers after existing fs: handlers** in both files

4. **Ensure proper initialization order** - the migration service depends on fileSystemService being initialized first

## Files to Modify

- `src/electron/main/index.ts`
- `src-electron/electron-main.ts`

## Verification

After adding handlers, search for 'fs:start-migration' in both files to confirm they exist.

```

---

### Task 3: Extend Preload API with Migration Methods

#### Purpose
Expose the migration IPC handlers to the renderer process through the preload bridge.

#### Objective
Add typed methods to the preload API that the Vue frontend can call to interact with the migration service.

#### Task Architecture Description

The preload script (`src/electron/preload/index.ts`) acts as a secure bridge between the renderer and main processes. It exposes a `window.api` object with typed methods.

#### Full Prompt

```

# Task: Extend Preload API with Migration Methods

## Context

You are working on MyndPrompts, a Vue 3 + Quasar + Electron application. The preload script exposes IPC methods to the renderer process.

## File to Modify

- `src/electron/preload/index.ts`

## Requirements

1. **Add TypeScript interfaces** for migration types (add near other interfaces):

   ```typescript
   interface IMigrationProgress {
     phase: 'validating' | 'planning' | 'copying' | 'verifying' | 'completing';
     totalFiles: number;
     copiedFiles: number;
     totalBytes: number;
     copiedBytes: number;
     currentFile: string;
     currentDirectory: string;
     canCancel: boolean;
   }

   interface IMigrationValidation {
     valid: boolean;
     error?: string;
     availableSpace?: number;
   }

   interface IMigrationPlan {
     directories: Array<{ name: string; fileCount: number; size: number }>;
     totalFiles: number;
     totalSize: number;
   }

   interface IMigrationResult {
     success: boolean;
     sourcePath: string;
     destinationPath: string;
     filesCopied: number;
     bytesCopied: number;
     duration: number;
     errors: string[];
   }

   interface IVerificationResult {
     verified: boolean;
     discrepancies: string[];
   }
   ```

2. **Add to FileSystemAPI interface** (find existing interface and extend):

   ```typescript
   interface FileSystemAPI {
     // ... existing methods ...

     // Storage Migration
     selectMigrationFolder: () => Promise<{ cancelled: boolean; path: string | null }>;
     validateMigrationDestination: (destPath: string) => Promise<IMigrationValidation>;
     calculateMigrationPlan: () => Promise<IMigrationPlan>;
     startMigration: (destPath: string) => Promise<IMigrationResult>;
     cancelMigration: () => Promise<{ cancelled: boolean }>;
     verifyMigration: (destPath: string) => Promise<IVerificationResult>;
     cleanupOldStorage: (sourcePath: string) => Promise<{ success: boolean }>;
     onMigrationProgress: (callback: (progress: IMigrationProgress) => void) => () => void;
   }
   ```

3. **Add implementations** in the `contextBridge.exposeInMainWorld('api', {...})` object:

   ```typescript
   // Storage Migration
   selectMigrationFolder: () => ipcRenderer.invoke('fs:select-migration-folder'),

   validateMigrationDestination: (destPath: string) =>
     ipcRenderer.invoke('fs:validate-migration-destination', destPath),

   calculateMigrationPlan: () =>
     ipcRenderer.invoke('fs:calculate-migration-plan'),

   startMigration: (destPath: string) =>
     ipcRenderer.invoke('fs:start-migration', destPath),

   cancelMigration: () =>
     ipcRenderer.invoke('fs:cancel-migration'),

   verifyMigration: (destPath: string) =>
     ipcRenderer.invoke('fs:verify-migration', destPath),

   cleanupOldStorage: (sourcePath: string) =>
     ipcRenderer.invoke('fs:cleanup-old-storage', sourcePath),

   onMigrationProgress: (callback: (progress: IMigrationProgress) => void) => {
     const handler = (_event: Electron.IpcRendererEvent, progress: IMigrationProgress) => {
       callback(progress);
     };
     ipcRenderer.on('fs:migration-progress', handler);
     // Return cleanup function
     return () => {
       ipcRenderer.removeListener('fs:migration-progress', handler);
     };
   },
   ```

4. **Export the interfaces** for use in Vue components:
   - Add exports at the bottom of the file or in a separate types file

## Verification

- Check that all methods are properly typed
- Ensure the return types match what the IPC handlers return

```

---

### Task 4: Create MoveStorageDialog Component

#### Purpose
Create a Vue dialog component that guides users through the storage migration process.

#### Objective
Build an intuitive dialog that:
- Lets users select a new storage location
- Shows a confirmation before starting
- Displays real-time progress during migration
- Handles errors and cancellation
- Provides a summary on completion

#### Task Architecture Description

The dialog will be a multi-step wizard:
1. **Select Destination**: Folder picker + validation display
2. **Confirm**: Show migration plan (files, size) + confirm button
3. **Progress**: Real-time progress bar + current file + cancel button
4. **Complete**: Summary + option to delete source

#### Full Prompt

```

# Task: Create MoveStorageDialog Component

## Context

You are working on MyndPrompts, a Vue 3 + Quasar + Electron application. Create a dialog component for moving storage to a new location.

## File to Create

- `src/components/dialogs/MoveStorageDialog.vue`

## Requirements

1. **Component Structure** using Vue 3 Composition API with `<script setup lang="ts">`:

2. **Props and Emits**:

   ```typescript
   const props = defineProps<{
     modelValue: boolean; // v-model for dialog visibility
   }>();

   const emit = defineEmits<{
     (e: 'update:modelValue', value: boolean): void;
     (e: 'migration-complete', newPath: string): void;
   }>();
   ```

3. **State Management**:

   ```typescript
   type DialogStep = 'select' | 'confirm' | 'progress' | 'complete' | 'error';

   const step = ref<DialogStep>('select');
   const destinationPath = ref<string>('');
   const validationResult = ref<IMigrationValidation | null>(null);
   const migrationPlan = ref<IMigrationPlan | null>(null);
   const progress = ref<IMigrationProgress | null>(null);
   const result = ref<IMigrationResult | null>(null);
   const error = ref<string | null>(null);
   const sourcePath = ref<string>('');
   ```

4. **Methods**:
   - `selectFolder()`: Open folder picker, validate selection
   - `startMigration()`: Begin migration process
   - `cancelMigration()`: Cancel ongoing migration
   - `deleteSource()`: Clean up old storage location
   - `close()`: Close dialog and reset state
   - `formatBytes(bytes: number)`: Format file sizes

5. **Template Structure** using Quasar components:

   ```vue
   <template>
     <q-dialog
       :model-value="modelValue"
       persistent
       @update:model-value="close"
     >
       <q-card style="min-width: 500px; max-width: 600px">
         <q-card-section class="row items-center">
           <q-icon
             name="drive_file_move"
             size="28px"
             color="primary"
             class="q-mr-sm"
           />
           <div class="text-h6">{{ t('storage.moveStorage.title') }}</div>
           <q-space />
           <q-btn
             v-if="step !== 'progress'"
             icon="close"
             flat
             round
             dense
             @click="close"
           />
         </q-card-section>

         <q-separator />

         <!-- Step 1: Select Destination -->
         <q-card-section v-if="step === 'select'">
           <!-- Current location display -->
           <!-- Folder picker button -->
           <!-- Validation status -->
         </q-card-section>

         <!-- Step 2: Confirm -->
         <q-card-section v-else-if="step === 'confirm'">
           <!-- Migration plan summary -->
           <!-- Warning message -->
           <!-- Confirm/Cancel buttons -->
         </q-card-section>

         <!-- Step 3: Progress -->
         <q-card-section v-else-if="step === 'progress'">
           <!-- Phase indicator -->
           <!-- Progress bar -->
           <!-- Current file display -->
           <!-- Cancel button -->
         </q-card-section>

         <!-- Step 4: Complete -->
         <q-card-section v-else-if="step === 'complete'">
           <!-- Success message -->
           <!-- Summary statistics -->
           <!-- Option to delete source -->
           <!-- Close button -->
         </q-card-section>

         <!-- Step 5: Error -->
         <q-card-section v-else-if="step === 'error'">
           <!-- Error message -->
           <!-- Retry/Close buttons -->
         </q-card-section>
       </q-card>
     </q-dialog>
   </template>
   ```

6. **Lifecycle**:
   - On mount: Get current storage path via `window.api.getBasePath()`
   - On progress event: Subscribe to `window.api.onMigrationProgress()`
   - On unmount: Cleanup progress listener

7. **UI Details**:
   - Use `q-linear-progress` for progress bar
   - Use `q-stepper` or step indicators to show current phase
   - Show file count: "Copying file 45 of 230"
   - Show current file name (truncated if too long)
   - Show phase name: "Copying prompts...", "Verifying files..."
   - Disable close button during migration
   - Show warning about not closing app during migration

8. **Styling**:
   - Use Quasar's built-in classes
   - Match existing dialog styles in the app
   - Add appropriate spacing and icons

## Reference

- Look at `src/components/dialogs/ExportLibraryDialog.vue` for dialog patterns
- Look at `src/components/dialogs/SettingsDialog.vue` for styling

## i18n Keys to Use

Use keys under `storage.moveStorage.*` - these will be added in Task 8

```

---

### Task 5: Update StorageSection with Move Storage Button

#### Purpose
Add a "Move Storage" button to the existing StorageSection component in the Settings dialog.

#### Objective
Integrate the MoveStorageDialog into the settings UI, allowing users to initiate storage migration from the Storage settings section.

#### Task Architecture Description

The StorageSection component already exists and displays the current storage location. We'll add:
- A "Move Storage" button next to the current location display
- Import and use the MoveStorageDialog component
- Handle the migration-complete event to refresh the displayed path

#### Full Prompt

```

# Task: Update StorageSection with Move Storage Button

## Context

You are working on MyndPrompts, a Vue 3 + Quasar + Electron application. Update the StorageSection component to include the Move Storage functionality.

## File to Modify

- `src/components/settings/StorageSection.vue`

## Requirements

1. **Import the MoveStorageDialog**:

   ```typescript
   import MoveStorageDialog from '@/components/dialogs/MoveStorageDialog.vue';
   ```

2. **Add state for dialog visibility**:

   ```typescript
   const showMoveDialog = ref(false);
   ```

3. **Add handler for migration complete**:

   ```typescript
   async function handleMigrationComplete(newPath: string): void {
     // Refresh the displayed storage path
     storagePath.value = newPath;
     // Show success notification
     $q.notify({
       type: 'positive',
       message: t('storage.moveStorage.successNotification'),
       position: 'bottom',
       timeout: 3000,
     });
   }
   ```

4. **Update the template** to add the Move Storage button:
   - Find where the current storage path is displayed
   - Add a button with icon "drive_file_move" or "folder_open"
   - Add the MoveStorageDialog component at the bottom of the template

   ```vue
   <!-- In the storage path display section -->
   <div class="row items-center q-gutter-sm">
     <div class="storage-path">{{ storagePath }}</div>
     <q-btn
       flat
       dense
       icon="drive_file_move"
       color="primary"
       @click="showMoveDialog = true"
     >
       <q-tooltip>{{ t('storage.moveStorage.button') }}</q-tooltip>
     </q-btn>
   </div>

   <!-- At the bottom of template, before closing tag -->
   <MoveStorageDialog
     v-model="showMoveDialog"
     @migration-complete="handleMigrationComplete"
   />
   ```

5. **Alternative: Add as a separate section**:

   ```vue
   <q-separator class="q-my-md" />

   <div class="text-subtitle2 q-mb-sm">{{ t('storage.moveStorage.sectionTitle') }}</div>
   <div class="text-caption text-grey q-mb-sm">
     {{ t('storage.moveStorage.description') }}
   </div>
   <q-btn
     outline
     color="primary"
     icon="drive_file_move"
     :label="t('storage.moveStorage.button')"
     @click="showMoveDialog = true"
   />
   ```

## Verification

- The Move Storage button should be visible in Settings > Storage
- Clicking it should open the MoveStorageDialog
- After successful migration, the displayed path should update

```

---

### Task 6: Implement Progress Tracking and Cancellation

#### Purpose
Enhance the migration service with robust progress tracking and cancellation support.

#### Objective
Implement:
- Granular progress updates during file copying
- Cancellation checks between operations
- Graceful handling of cancellation mid-operation
- Progress persistence for UI updates

#### Task Architecture Description

Progress tracking will use an event-based pattern where the service emits progress updates that flow through IPC to the renderer. Cancellation will use an AbortController-like pattern with checks at safe points.

#### Full Prompt

```

# Task: Implement Progress Tracking and Cancellation

## Context

This task enhances the StorageMigrationService (created in Task 1) with detailed progress tracking and cancellation support.

## File to Modify

- `src/electron/main/services/storage-migration.service.ts`

## Requirements

1. **Add cancellation support**:

   ```typescript
   private cancellationRequested = false;

   cancelMigration(): void {
     this.cancellationRequested = true;
   }

   private checkCancellation(): void {
     if (this.cancellationRequested) {
       throw new MigrationCancelledError('Migration cancelled by user');
     }
   }

   private resetCancellation(): void {
     this.cancellationRequested = false;
   }
   ```

2. **Create custom error class**:

   ```typescript
   class MigrationCancelledError extends Error {
     constructor(message: string) {
       super(message);
       this.name = 'MigrationCancelledError';
     }
   }
   ```

3. **Implement detailed progress tracking in copyDirectoryWithProgress**:

   ```typescript
   private async copyDirectoryWithProgress(
     sourcePath: string,
     destPath: string,
     directoryName: string,
     onProgress: (progress: IMigrationProgress) => void,
     currentPhase: IMigrationProgress['phase'],
     baseProgress: { copiedFiles: number; copiedBytes: number; totalFiles: number; totalBytes: number }
   ): Promise<{ filesCopied: number; bytesCopied: number }> {
     // Implementation:
     // 1. List all files recursively
     // 2. For each file:
     //    a. Check cancellation
     //    b. Copy file
     //    c. Update progress
     //    d. Emit progress event
     // 3. Return statistics
   }
   ```

4. **Progress calculation helper**:

   ```typescript
   private calculateProgress(
     phase: IMigrationProgress['phase'],
     copiedFiles: number,
     totalFiles: number,
     copiedBytes: number,
     totalBytes: number,
     currentFile: string,
     currentDirectory: string
   ): IMigrationProgress {
     return {
       phase,
       totalFiles,
       copiedFiles,
       totalBytes,
       copiedBytes,
       currentFile: this.truncateFileName(currentFile, 50),
       currentDirectory,
       canCancel: phase === 'copying', // Can only cancel during copy phase
     };
   }
   ```

5. **File traversal with progress**:

   ```typescript
   private async* walkDirectory(dir: string): AsyncGenerator<{path: string; size: number}> {
     const entries = await fs.readdir(dir, { withFileTypes: true });
     for (const entry of entries) {
       const fullPath = path.join(dir, entry.name);
       if (entry.isDirectory()) {
         yield* this.walkDirectory(fullPath);
       } else {
         const stats = await fs.stat(fullPath);
         yield { path: fullPath, size: stats.size };
       }
     }
   }
   ```

6. **Update startMigration to handle cancellation**:

   ```typescript
   async startMigration(...): Promise<IMigrationResult> {
     this.resetCancellation();
     const startTime = Date.now();

     try {
       // ... migration logic with checkCancellation() calls
     } catch (error) {
       if (error instanceof MigrationCancelledError) {
         return {
           success: false,
           cancelled: true,
           // ... partial results
         };
       }
       throw error;
     }
   }
   ```

7. **Progress update frequency**:
   - Update every file for small migrations (< 100 files)
   - Update every 10 files for medium migrations (100-1000 files)
   - Update every 50 files for large migrations (> 1000 files)
   - Always update on directory change

## Testing Considerations

- Test cancellation at various points
- Test with large file counts
- Test progress accuracy
- Test error handling during copy

```

---

### Task 7: Implement Database Path Update Logic

#### Purpose
Update all database records (IndexedDB) to reflect the new storage path after migration.

#### Objective
Create methods to:
- Update all project paths in the projects table
- Update file index entries
- Update configuration values
- Ensure data consistency

#### Task Architecture Description

The database update must be atomic - either all paths update successfully, or none do. We'll use Dexie.js transaction support to ensure consistency.

#### Full Prompt

```

# Task: Implement Database Path Update Logic

## Context

After files are copied to the new location, all database records containing the old path must be updated to the new path.

## Files to Create/Modify

- Create: `src/services/storage/repositories/migration.repository.ts`
- Modify: `src/electron/main/services/storage-migration.service.ts` (to use the repository)

## Requirements

1. **Create MigrationRepository** (`src/services/storage/repositories/migration.repository.ts`):

   ```typescript
   import { db } from '../db';

   export class MigrationRepository {
     /**
      * Update all paths in the database from old base path to new base path.
      * Uses a transaction to ensure atomicity.
      */
     async updateAllPaths(
       oldBasePath: string,
       newBasePath: string
     ): Promise<{
       projectsUpdated: number;
       configsUpdated: number;
       fileIndexesUpdated: number;
       projectFoldersUpdated: number;
     }> {
       return db.transaction(
         'rw',
         [db.projects, db.appConfig, db.fileIndex, db.projectFolders],
         async () => {
           const results = {
             projectsUpdated: 0,
             configsUpdated: 0,
             fileIndexesUpdated: 0,
             projectFoldersUpdated: 0,
           };

           // 1. Update projects table
           const projects = await db.projects.toArray();
           for (const project of projects) {
             if (project.folderPath.startsWith(oldBasePath)) {
               const newPath = project.folderPath.replace(oldBasePath, newBasePath);
               await db.projects.update(project.folderPath, { folderPath: newPath });
               results.projectsUpdated++;
             }
           }

           // 2. Update appConfig table (storage directories)
           const configKeys = [
             'prompts.directory',
             'snippets.directory',
             'personas.directory',
             'templates.directory',
             'backup.directory',
           ];
           for (const key of configKeys) {
             const config = await db.appConfig.get(key);
             if (
               config &&
               typeof config.value === 'string' &&
               config.value.startsWith(oldBasePath)
             ) {
               await db.appConfig.update(key, {
                 value: config.value.replace(oldBasePath, newBasePath),
               });
               results.configsUpdated++;
             }
           }

           // 3. Update fileIndex table
           const fileIndexes = await db.fileIndex.toArray();
           for (const entry of fileIndexes) {
             if (entry.filePath.startsWith(oldBasePath)) {
               const newPath = entry.filePath.replace(oldBasePath, newBasePath);
               await db.fileIndex.update(entry.id, { filePath: newPath });
               results.fileIndexesUpdated++;
             }
           }

           // 4. Update projectFolders table
           const projectFolders = await db.projectFolders.toArray();
           for (const folder of projectFolders) {
             if (folder.folderPath.startsWith(oldBasePath)) {
               const newPath = folder.folderPath.replace(oldBasePath, newBasePath);
               await db.projectFolders.update(folder.id, { folderPath: newPath });
               results.projectFoldersUpdated++;
             }
           }

           return results;
         }
       );
     }

     /**
      * Verify all paths in the database point to the new location
      */
     async verifyPaths(newBasePath: string): Promise<{ valid: boolean; invalidPaths: string[] }> {
       const invalidPaths: string[] = [];

       // Check projects
       const projects = await db.projects.toArray();
       for (const project of projects) {
         if (!project.folderPath.startsWith(newBasePath)) {
           invalidPaths.push(`Project: ${project.folderPath}`);
         }
       }

       // Check file indexes
       const fileIndexes = await db.fileIndex.toArray();
       for (const entry of fileIndexes) {
         if (!entry.filePath.startsWith(newBasePath)) {
           invalidPaths.push(`FileIndex: ${entry.filePath}`);
         }
       }

       return {
         valid: invalidPaths.length === 0,
         invalidPaths,
       };
     }
   }

   export const migrationRepository = new MigrationRepository();
   ```

2. **Add IPC handler for database update** (in both entry points):

   ```typescript
   ipcMain.handle('db:update-migration-paths', async (_event, oldPath: string, newPath: string) => {
     // This needs to be called from renderer where Dexie runs
     // Return acknowledgment
     return { acknowledged: true };
   });
   ```

3. **Integration in MoveStorageDialog**:
   - After file copy completes successfully
   - Before showing completion screen
   - Call `migrationRepository.updateAllPaths(oldPath, newPath)`
   - Show any errors in the UI

4. **Handle the storage base path update**:
   - The base path is stored in the app config
   - Need to reinitialize FileSystemService with new path
   - This requires app restart or hot-reload of services

## Important Notes

- Database operations run in the RENDERER process (IndexedDB)
- File operations run in the MAIN process (Node.js fs)
- Coordinate between processes via IPC
- Consider app restart after migration for clean state

```

---

### Task 8: Add i18n Translations for All Languages

#### Purpose
Add all necessary translation strings for the Move Storage feature to all supported languages.

#### Objective
Add translations for:
- Dialog titles and descriptions
- Button labels
- Progress messages
- Error messages
- Success messages

#### Task Architecture Description

MyndPrompts supports 10 languages. All translation files are in `src/i18n/` directory.

#### Full Prompt

```

# Task: Add i18n Translations for All Languages

## Context

You are working on MyndPrompts which supports 10 languages. Add translations for the Move Storage feature.

## Files to Modify

All files in `src/i18n/`:

- `en-US/index.ts` (English US - primary, create full translations)
- `en-GB/index.ts` (English UK)
- `en-IE/index.ts` (English Ireland)
- `pt-BR/index.ts` (Portuguese Brazil)
- `pt-PT/index.ts` (Portuguese Portugal)
- `es-ES/index.ts` (Spanish)
- `fr-FR/index.ts` (French)
- `de-DE/index.ts` (German)
- `it-IT/index.ts` (Italian)
- `ar-SA/index.ts` (Arabic)

## Translation Keys to Add

Add under the `storage` object (create if doesn't exist):

```typescript
storage: {
  // ... existing keys ...

  moveStorage: {
    // Section in settings
    sectionTitle: 'Move Storage Location',
    description: 'Move all your prompts, snippets, and projects to a new location on your computer.',
    button: 'Move Storage',

    // Dialog
    title: 'Move Storage',
    currentLocation: 'Current Location',
    newLocation: 'New Location',
    selectFolder: 'Select Folder',
    noFolderSelected: 'No folder selected',

    // Validation
    validating: 'Validating destination...',
    validDestination: 'Destination is valid',
    invalidDestination: 'Invalid destination',
    notEnoughSpace: 'Not enough disk space. Required: {required}, Available: {available}',
    destinationNotEmpty: 'Destination folder must be empty',
    destinationInsideSource: 'Destination cannot be inside the current storage location',
    noWritePermission: 'No write permission for selected folder',

    // Confirmation
    confirmTitle: 'Confirm Migration',
    confirmMessage: 'This will copy all your data to the new location. The process may take several minutes depending on the amount of data.',
    migrationPlan: 'Migration Plan',
    totalFiles: 'Total files',
    totalSize: 'Total size',
    directories: 'Directories',
    warningMessage: 'Do not close the application during migration.',

    // Progress
    progressTitle: 'Moving Storage',
    phase: {
      validating: 'Validating...',
      planning: 'Planning migration...',
      copying: 'Copying files...',
      verifying: 'Verifying files...',
      completing: 'Completing migration...',
    },
    copyingDirectory: 'Copying {directory}...',
    fileProgress: 'File {current} of {total}',
    bytesProgress: '{copied} of {total}',
    currentFile: 'Current file',

    // Completion
    completeTitle: 'Migration Complete',
    successMessage: 'Your storage has been successfully moved to the new location.',
    summary: 'Summary',
    filesCopied: 'Files copied',
    duration: 'Duration',
    seconds: 'seconds',

    // Cleanup
    cleanupTitle: 'Clean Up Old Location',
    cleanupMessage: 'Would you like to delete the old storage location to free up disk space?',
    deleteOldStorage: 'Delete Old Storage',
    keepOldStorage: 'Keep Old Storage',
    cleanupWarning: 'This action cannot be undone.',

    // Errors
    errorTitle: 'Migration Failed',
    errorMessage: 'An error occurred during migration: {error}',
    partialMigration: 'Some files may have been copied. Please check both locations.',
    retry: 'Retry',

    // Cancellation
    cancelConfirm: 'Are you sure you want to cancel the migration?',
    cancelWarning: 'Files already copied will remain in the destination folder.',
    cancelled: 'Migration cancelled',

    // Buttons
    cancel: 'Cancel',
    move: 'Move',
    confirm: 'Confirm',
    close: 'Close',

    // Notifications
    successNotification: 'Storage successfully moved to new location',
    errorNotification: 'Failed to move storage',
  },
},
```

## Instructions

1. Start with `en-US/index.ts` to define all keys
2. Copy to other English variants (en-GB, en-IE) - they can be identical
3. Translate to other languages:
   - pt-BR: Brazilian Portuguese
   - pt-PT: European Portuguese
   - es-ES: Spanish
   - fr-FR: French
   - de-DE: German
   - it-IT: Italian
   - ar-SA: Arabic (RTL language)

4. For translations, maintain:
   - Placeholder syntax: {variable}
   - Similar tone and formality as existing translations
   - Technical accuracy

## Note

If you're not confident about a translation, use English as fallback - the team can review later.

```

---

### Task 9: Add Error Handling and Rollback Capabilities

#### Purpose
Implement robust error handling and rollback mechanisms to ensure data safety during migration.

#### Objective
Handle:
- Disk full errors during copy
- Permission errors
- Network interruptions (if storage is on network drive)
- Partial migration failures
- Provide rollback capability

#### Task Architecture Description

Error handling will include:
1. Pre-migration validation
2. Error catching during copy
3. Partial rollback on failure
4. User notification with recovery options

#### Full Prompt

```

# Task: Add Error Handling and Rollback Capabilities

## Context

Storage migration is a critical operation. If it fails midway, users could lose data. Implement robust error handling.

## Files to Modify

- `src/electron/main/services/storage-migration.service.ts`
- `src/components/dialogs/MoveStorageDialog.vue`

## Requirements

### 1. Error Types and Handling

Create custom error classes:

```typescript
// In storage-migration.service.ts

export class MigrationError extends Error {
  constructor(
    message: string,
    public readonly code: MigrationErrorCode,
    public readonly recoverable: boolean,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}

export enum MigrationErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  DISK_FULL = 'DISK_FULL',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  FILE_IN_USE = 'FILE_IN_USE',
  COPY_FAILED = 'COPY_FAILED',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  DATABASE_UPDATE_FAILED = 'DATABASE_UPDATE_FAILED',
  CANCELLED = 'CANCELLED',
  UNKNOWN = 'UNKNOWN',
}
```

### 2. Pre-Migration Backup

Before starting migration, create a manifest:

```typescript
interface IMigrationManifest {
  startedAt: Date;
  sourcePath: string;
  destinationPath: string;
  expectedFiles: number;
  copiedFiles: string[];
  status: 'in_progress' | 'completed' | 'failed' | 'cancelled';
}

async createManifest(source: string, dest: string): Promise<void> {
  const manifest: IMigrationManifest = {
    startedAt: new Date(),
    sourcePath: source,
    destinationPath: dest,
    expectedFiles: await this.countFilesRecursive(source),
    copiedFiles: [],
    status: 'in_progress',
  };

  // Save manifest to both locations
  await fs.writeFile(
    path.join(dest, '.migration-manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
}
```

### 3. Rollback Implementation

```typescript
async rollbackMigration(manifest: IMigrationManifest): Promise<void> {
  // 1. Delete all copied files from destination
  for (const filePath of manifest.copiedFiles) {
    try {
      await fs.unlink(filePath);
    } catch (e) {
      // Log but continue
    }
  }

  // 2. Remove destination directory if empty
  await this.removeEmptyDirectories(manifest.destinationPath);

  // 3. Update manifest status
  manifest.status = 'cancelled';
  await this.updateManifest(manifest);
}
```

### 4. Recovery from Interrupted Migration

On app startup, check for incomplete migrations:

```typescript
async checkForIncompleteMigration(): Promise<IMigrationManifest | null> {
  const basePath = this.fileSystemService.getBasePath();
  const manifestPath = path.join(basePath, '.migration-manifest.json');

  try {
    const content = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(content) as IMigrationManifest;

    if (manifest.status === 'in_progress') {
      return manifest;
    }
  } catch {
    // No manifest found
  }

  return null;
}
```

### 5. Error Handling in Copy Operation

```typescript
private async safeCopyFile(source: string, dest: string): Promise<void> {
  try {
    await fs.copyFile(source, dest);
  } catch (error) {
    if (error.code === 'ENOSPC') {
      throw new MigrationError(
        'Disk full',
        MigrationErrorCode.DISK_FULL,
        false,
        { source, dest }
      );
    }
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      throw new MigrationError(
        'Permission denied',
        MigrationErrorCode.PERMISSION_DENIED,
        true,
        { source, dest }
      );
    }
    if (error.code === 'EBUSY') {
      throw new MigrationError(
        'File in use',
        MigrationErrorCode.FILE_IN_USE,
        true,
        { source, dest }
      );
    }
    throw new MigrationError(
      `Copy failed: ${error.message}`,
      MigrationErrorCode.COPY_FAILED,
      true,
      { source, dest, originalError: error.message }
    );
  }
}
```

### 6. UI Error Display

In MoveStorageDialog.vue, show appropriate error messages:

```vue
<template>
  <!-- Error step -->
  <q-card-section v-if="step === 'error'">
    <div class="text-center q-mb-md">
      <q-icon
        name="error"
        size="64px"
        color="negative"
      />
    </div>

    <div class="text-h6 text-center text-negative q-mb-sm">
      {{ t('storage.moveStorage.errorTitle') }}
    </div>

    <q-banner
      class="bg-red-1 text-negative q-mb-md"
      rounded
    >
      {{ errorMessage }}
    </q-banner>

    <div
      v-if="errorRecoverable"
      class="text-caption text-grey q-mb-md"
    >
      {{ t('storage.moveStorage.partialMigration') }}
    </div>

    <div class="row justify-center q-gutter-sm">
      <q-btn
        v-if="errorRecoverable"
        outline
        color="primary"
        :label="t('storage.moveStorage.retry')"
        @click="retryMigration"
      />
      <q-btn
        outline
        color="grey"
        :label="t('storage.moveStorage.close')"
        @click="close"
      />
    </div>
  </q-card-section>
</template>
```

### 7. Logging

Add detailed logging for debugging:

```typescript
private log(level: 'info' | 'warn' | 'error', message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [Migration] [${level.toUpperCase()}] ${message}`;

  if (data) {
    console.log(logEntry, data);
  } else {
    console.log(logEntry);
  }

  // Optionally write to log file
}
```

## Testing Scenarios

1. Disk full during copy
2. Permission denied on destination
3. Source file deleted during migration
4. App crash during migration (test recovery)
5. Network drive disconnection
6. Cancellation at various stages

```

---

### Task 10: Testing and Edge Case Handling

#### Purpose
Ensure the Move Storage feature works correctly under all conditions.

#### Objective
Test:
- Normal migration flow
- Large data sets
- Edge cases (empty storage, single file, etc.)
- Error scenarios
- Recovery scenarios

#### Task Architecture Description

Testing will include:
1. Unit tests for service methods
2. Integration tests for IPC flow
3. Manual testing checklist
4. Edge case documentation

#### Full Prompt

```

# Task: Testing and Edge Case Handling

## Context

Comprehensive testing is critical for a data migration feature. Users trust us with their data.

## Files to Create

- `src/electron/main/services/__tests__/storage-migration.service.test.ts`
- `documents/testing/move-storage-test-plan.md`

## Requirements

### 1. Unit Tests

Create test file with the following test cases:

```typescript
// storage-migration.service.test.ts

import { StorageMigrationService } from '../storage-migration.service';
import { FileSystemService } from '../file-system.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('StorageMigrationService', () => {
  let service: StorageMigrationService;
  let tempSource: string;
  let tempDest: string;

  beforeEach(async () => {
    // Create temp directories
    tempSource = await fs.mkdtemp(path.join(os.tmpdir(), 'migration-test-source-'));
    tempDest = await fs.mkdtemp(path.join(os.tmpdir(), 'migration-test-dest-'));

    // Create test file structure
    await createTestStructure(tempSource);

    // Initialize service
    const fsService = new FileSystemService(tempSource);
    service = new StorageMigrationService(fsService);
  });

  afterEach(async () => {
    // Cleanup
    await fs.rm(tempSource, { recursive: true, force: true });
    await fs.rm(tempDest, { recursive: true, force: true });
  });

  describe('validateDestination', () => {
    it('should accept empty directory', async () => {
      const result = await service.validateDestination(tempDest);
      expect(result.valid).toBe(true);
    });

    it('should reject non-empty directory', async () => {
      await fs.writeFile(path.join(tempDest, 'file.txt'), 'content');
      const result = await service.validateDestination(tempDest);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject destination inside source', async () => {
      const insideDest = path.join(tempSource, 'subdir');
      await fs.mkdir(insideDest);
      const result = await service.validateDestination(insideDest);
      expect(result.valid).toBe(false);
    });

    it('should create non-existent directory', async () => {
      const newDest = path.join(tempDest, 'new-folder');
      const result = await service.validateDestination(newDest);
      expect(result.valid).toBe(true);
    });
  });

  describe('calculateMigrationPlan', () => {
    it('should count all files correctly', async () => {
      const plan = await service.calculateMigrationPlan(tempSource);
      expect(plan.totalFiles).toBeGreaterThan(0);
    });

    it('should calculate total size', async () => {
      const plan = await service.calculateMigrationPlan(tempSource);
      expect(plan.totalSize).toBeGreaterThan(0);
    });
  });

  describe('startMigration', () => {
    it('should copy all files', async () => {
      const progressUpdates: any[] = [];

      const result = await service.startMigration(tempSource, tempDest, (progress) =>
        progressUpdates.push(progress)
      );

      expect(result.success).toBe(true);
      expect(result.filesCopied).toBeGreaterThan(0);
    });

    it('should emit progress updates', async () => {
      const progressUpdates: any[] = [];

      await service.startMigration(tempSource, tempDest, (progress) =>
        progressUpdates.push(progress)
      );

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0]).toHaveProperty('phase');
      expect(progressUpdates[0]).toHaveProperty('copiedFiles');
    });

    it('should handle cancellation', async () => {
      const progressUpdates: any[] = [];

      // Start migration
      const migrationPromise = service.startMigration(tempSource, tempDest, (progress) => {
        progressUpdates.push(progress);
        // Cancel after first progress update
        if (progressUpdates.length === 1) {
          service.cancelMigration();
        }
      });

      const result = await migrationPromise;
      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
    });
  });

  describe('verifyMigration', () => {
    it('should verify successful migration', async () => {
      await service.startMigration(tempSource, tempDest, () => {});

      const verification = await service.verifyMigration(tempSource, tempDest);
      expect(verification.verified).toBe(true);
      expect(verification.discrepancies).toHaveLength(0);
    });
  });
});

async function createTestStructure(basePath: string): Promise<void> {
  // Create directory structure matching app storage
  const dirs = ['prompts', 'snippets', 'personas', 'templates', 'projects', 'backups'];

  for (const dir of dirs) {
    const dirPath = path.join(basePath, dir);
    await fs.mkdir(dirPath, { recursive: true });

    // Add test files
    await fs.writeFile(path.join(dirPath, 'test1.md'), '# Test 1');
    await fs.writeFile(path.join(dirPath, 'test2.md'), '# Test 2');
  }

  // Add nested directories
  const nestedDir = path.join(basePath, 'prompts', 'project1');
  await fs.mkdir(nestedDir, { recursive: true });
  await fs.writeFile(path.join(nestedDir, 'nested.md'), '# Nested');
}
```

### 2. Manual Test Plan

Create `documents/testing/move-storage-test-plan.md`:

```markdown
# Move Storage - Manual Test Plan

## Prerequisites

- [ ] Development build running
- [ ] Test data created (prompts, snippets, personas, templates)
- [ ] At least one project with multiple files

## Test Cases

### TC-001: Happy Path Migration

1. Open Settings > Storage
2. Click "Move Storage"
3. Select empty folder as destination
4. Confirm migration
5. Wait for completion
6. Verify all files appear in new location
7. Verify app functions correctly with new location

**Expected**: All data migrated successfully, app works normally

### TC-002: Cancel During Migration

1. Start migration with large dataset
2. Click Cancel during progress
3. Confirm cancellation

**Expected**: Migration stops, partial files may exist in destination, source untouched

### TC-003: Disk Full Error

1. Select destination on drive with limited space
2. Attempt migration larger than available space

**Expected**: Clear error message about insufficient space

### TC-004: Permission Denied

1. Select destination in protected directory
2. Attempt migration

**Expected**: Clear error message about permissions

### TC-005: App Restart After Migration

1. Complete migration successfully
2. Close and reopen app
3. Verify all functionality

**Expected**: App uses new storage location correctly

### TC-006: Delete Old Storage

1. Complete migration
2. Choose to delete old storage
3. Confirm deletion

**Expected**: Old storage deleted, new storage works

### TC-007: Keep Old Storage

1. Complete migration
2. Choose to keep old storage
3. Verify both locations exist

**Expected**: Both locations have data

### TC-008: Empty Storage Migration

1. Start with empty storage (new installation)
2. Attempt migration

**Expected**: Handles gracefully, possibly with "nothing to migrate" message

### TC-009: Large File Handling

1. Add large files (>100MB) to storage
2. Perform migration

**Expected**: Progress updates, successful copy

### TC-010: Special Characters in Filenames

1. Create files with special characters: "test (1).md", "über.md", "日本語.md"
2. Perform migration

**Expected**: All files copied correctly with names preserved
```

### 3. Edge Cases to Handle

Document and handle these edge cases:

1. **Empty storage**: No files to migrate
2. **Single file**: Only one prompt exists
3. **Deep nesting**: Directories nested 10+ levels
4. **Symbolic links**: Handle or skip symlinks
5. **Hidden files**: Copy .dot files
6. **Large files**: Files > 1GB
7. **Many small files**: 10,000+ tiny files
8. **Unicode filenames**: Non-ASCII characters
9. **Long paths**: Paths > 260 chars (Windows)
10. **Read-only files**: Source files with no write permission
11. **Locked files**: Files open in another app
12. **Network drives**: Slow or unreliable connection
13. **Same drive vs different drive**: Move vs copy behavior
14. **Case sensitivity**: macOS vs Windows path handling

### 4. Performance Benchmarks

Test and document performance:

- 100 files: Expected < 5 seconds
- 1,000 files: Expected < 30 seconds
- 10,000 files: Expected < 5 minutes
- 1GB total: Expected < 2 minutes (SSD)

## Deliverables

1. Unit test file with all tests passing
2. Manual test plan document
3. Edge case handling in code
4. Performance benchmark results

```

---

## 4. Implementation Order

The recommended implementation order is:

1. **Task 1** - StorageMigrationService (core backend)
2. **Task 2** - IPC Handlers (connect backend to frontend)
3. **Task 3** - Preload API (expose to renderer)
4. **Task 8** - i18n Translations (needed before UI)
5. **Task 4** - MoveStorageDialog (main UI)
6. **Task 5** - StorageSection Update (integration)
7. **Task 6** - Progress Tracking (enhance UX)
8. **Task 7** - Database Updates (critical data logic)
9. **Task 9** - Error Handling (robustness)
10. **Task 10** - Testing (quality assurance)

---

## 5. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Data loss during migration | Create manifest, verify before cleanup |
| App crash mid-migration | Recovery mechanism on startup |
| Insufficient disk space | Pre-check available space |
| Permission issues | Validate before starting |
| Database inconsistency | Atomic transactions, verification |
| User confusion | Clear progress UI, confirmations |

---

## 6. Acceptance Criteria

The feature is complete when:

1. [ ] Users can select a new storage location
2. [ ] Migration shows real-time progress
3. [ ] Users can cancel migration at any time
4. [ ] All files are verified after copy
5. [ ] Database paths are updated correctly
6. [ ] Users can optionally delete old storage
7. [ ] Errors are handled gracefully with clear messages
8. [ ] Feature works on Windows, macOS, and Linux
9. [ ] All 10 languages have translations
10. [ ] Unit tests pass
11. [ ] Manual test plan completed successfully
```
