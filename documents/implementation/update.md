# Auto-Update Feature Implementation

## Overview

Implement automatic version checking and app updates for MyndPrompts. The app will check for new versions on startup and allow users to manually check via the Help menu.

**Version Endpoint:** `https://www.myndprompts.com/version`
**Response Format:**

```json
{
  "version": "1.0.0"
}
```

---

## 1. Architecture

### 1.1 System Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Renderer Process                               │
│  ┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐   │
│  │   MainLayout    │───▶│   UpdateDialog   │◀───│    appStore      │   │
│  │ (menu listener) │    │ (user interface) │    │ (version state)  │   │
│  └─────────────────┘    └──────────────────┘    └──────────────────┘   │
│           │                      │                       ▲              │
│           │                      │                       │              │
│           ▼                      ▼                       │              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Preload Bridge (updateAPI)                  │   │
│  │  - checkForUpdates() → Promise<UpdateInfo>                       │   │
│  │  - downloadAndInstallUpdate() → Promise<void>                    │   │
│  │  - onUpdateProgress(callback) → unsubscribe                      │   │
│  │  - onUpdateDownloaded(callback) → unsubscribe                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ IPC
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            Main Process                                  │
│  ┌─────────────────────┐    ┌──────────────────────────────────────┐   │
│  │   Application Menu  │    │         UpdateService                 │   │
│  │  (Check for Updates)│───▶│  - checkForUpdates()                  │   │
│  └─────────────────────┘    │  - downloadUpdate()                   │   │
│                             │  - installUpdate()                    │   │
│                             │  - getCurrentVersion()                │   │
│                             └──────────────────────────────────────┘   │
│                                          │                              │
│                                          ▼                              │
│                             ┌──────────────────────────────────────┐   │
│                             │      Version API (Remote)             │   │
│                             │  https://www.myndprompts.com/version  │   │
│                             └──────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

1. **On App Startup:**
   - Main process fetches version from remote API
   - Compares with current app version (from `package.json`)
   - If update available, sends notification to renderer
   - Renderer shows UpdateDialog

2. **On Manual Check (Menu → Check for Updates):**
   - User clicks "Check for Updates" in Help menu
   - Main process fetches version from remote API
   - Sends result to renderer (update available or up-to-date)
   - Renderer shows appropriate dialog

3. **On Update Confirmation:**
   - User clicks "Update Now" in UpdateDialog
   - Main process downloads update (if using electron-updater) OR
   - Opens download URL in browser (simpler approach)
   - Shows progress in dialog

### 1.3 Key Files to Create/Modify

| File                                           | Action | Description                        |
| ---------------------------------------------- | ------ | ---------------------------------- |
| `src/electron/main/services/update.service.ts` | CREATE | Update checking and download logic |
| `src/electron/preload/index.ts`                | MODIFY | Add updateAPI to exposed APIs      |
| `src-electron/electron-main.ts`                | MODIFY | Add IPC handlers and menu item     |
| `src/components/dialogs/UpdateDialog.vue`      | CREATE | Update notification dialog         |
| `src/stores/appStore.ts`                       | MODIFY | Add update state management        |
| `src/layouts/MainLayout.vue`                   | MODIFY | Add update dialog and listener     |
| `src/i18n/*/index.ts`                          | MODIFY | Add translation keys               |

### 1.4 TypeScript Interfaces

```typescript
// Update info from remote API
interface IRemoteVersionInfo {
  version: string;
}

// Processed update info
interface IUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  downloadUrl?: string;
  releaseNotes?: string;
}

// Update check result
interface IUpdateCheckResult {
  success: boolean;
  updateInfo?: IUpdateInfo;
  error?: string;
}

// Update progress (if implementing download)
interface IUpdateProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}
```

### 1.5 Implementation Approach

**Simple Approach (Recommended for MVP):**

- Fetch version from API
- Compare versions using semver
- If update available, show dialog with "Download" button
- "Download" opens GitHub releases page in browser
- User manually downloads and installs

**Advanced Approach (Future):**

- Use `electron-updater` package
- Auto-download update in background
- Install on quit or immediate restart
- Requires code signing and publishing infrastructure

---

## 2. Todo List

- [x] **Task 1:** Create UpdateService in main process
- [x] **Task 2:** Add IPC handlers for update operations
- [x] **Task 3:** Add updateAPI to preload bridge
- [x] **Task 4:** Add "Check for Updates" menu item
- [x] **Task 5:** Create UpdateDialog component
- [x] **Task 6:** Update appStore with update state
- [x] **Task 7:** Integrate update check on app startup
- [x] **Task 8:** Add i18n translations for update feature
- [ ] **Task 9:** Test and verify update flow

---

## 3. Task Details

### Task 1: Create UpdateService in Main Process

**Purpose:** Centralize all update-related logic in a dedicated service following the existing service pattern.

**Objective:** Create a singleton service that can fetch remote version info, compare versions, and manage update state.

**Architecture Description:**

- Create `src/electron/main/services/update.service.ts`
- Implement singleton pattern matching existing services (FileSystemService, GitService)
- Use native `fetch` (Node 18+) or `https` module for API calls
- Implement semantic version comparison
- Cache last check timestamp to avoid excessive API calls

**File to Create:** `src/electron/main/services/update.service.ts`

**Full Prompt:**

```
Create a new file: src/electron/main/services/update.service.ts

This service should:
1. Follow the singleton pattern used by other services in src/electron/main/services/
2. Implement these methods:
   - getInstance(): UpdateService (static)
   - async checkForUpdates(): Promise<IUpdateCheckResult>
   - async fetchRemoteVersion(): Promise<string>
   - compareVersions(current: string, latest: string): number
   - isUpdateAvailable(current: string, latest: string): boolean
   - getCurrentVersion(): string
   - getDownloadUrl(version: string): string

3. Fetch version from: https://www.myndprompts.com/version
   Response format: { "version": "x.y.z" }

4. Get current version from: app.getVersion() (Electron)

5. Compare versions using semantic versioning (split by '.', compare numerically)

6. Generate download URL: https://github.com/myndprompts/myndprompts/releases/tag/v{version}

7. Add 5-minute cache to prevent excessive API calls

8. Handle errors gracefully with try/catch and return appropriate error messages

9. Add TypeScript interfaces at the top of the file:
   - IRemoteVersionInfo
   - IUpdateInfo
   - IUpdateCheckResult

10. Export a convenience function: getUpdateService(): UpdateService

Reference the existing service patterns in:
- src/electron/main/services/file-system.service.ts
- src/electron/main/services/git.service.ts
```

---

### Task 2: Add IPC Handlers for Update Operations

**Purpose:** Enable communication between renderer and main process for update operations.

**Objective:** Add IPC handlers in both Electron entry points to expose update functionality to the renderer process.

**Architecture Description:**

- Add handlers to BOTH entry points (they serve different purposes):
  - `src/electron/main/index.ts` - Development entry point
  - `src-electron/electron-main.ts` - Production/Quasar entry point
- Follow the existing IPC handler pattern
- Handlers needed:
  - `update:check` - Check for updates
  - `update:get-current-version` - Get current app version
  - `update:open-download-page` - Open download URL in browser

**Files to Modify:**

1. `src/electron/main/index.ts` - Development entry point
2. `src-electron/electron-main.ts` - Production/Quasar entry point

**Full Prompt:**

```
Modify BOTH entry point files to add IPC handlers for update operations:

## File 1: src/electron/main/index.ts (Development)

Add IPC handlers after existing handlers:

1. Import the UpdateService at the top of the file:
   import { getUpdateService } from './services/update.service';

2. Import shell if not already imported:
   import { app, BrowserWindow, ipcMain, shell } from 'electron';

3. Add these IPC handlers after the existing handlers:

   // ==========================================
   // Update Handlers
   // ==========================================

   ipcMain.handle('update:check', async () => {
     const updateService = getUpdateService();
     return updateService.checkForUpdates();
   });

   ipcMain.handle('update:get-current-version', () => {
     return app.getVersion();
   });

   ipcMain.handle('update:open-download-page', async (_, url: string) => {
     await shell.openExternal(url);
   });

## File 2: src-electron/electron-main.ts (Production/Quasar)

Add IPC handlers after existing handlers (around line 715):

1. Import the UpdateService at the top of the file:
   import { getUpdateService } from '../src/electron/main/services/update.service';

2. Add these IPC handlers:

   // Update handlers
   ipcMain.handle('update:check', async () => {
     const updateService = getUpdateService();
     return updateService.checkForUpdates();
   });

   ipcMain.handle('update:get-current-version', () => {
     return app.getVersion();
   });

   ipcMain.handle('update:open-download-page', async (_, url: string) => {
     const { shell } = require('electron');
     await shell.openExternal(url);
   });

Follow the existing error handling patterns used by other handlers in each file.
```

---

### Task 3: Add updateAPI to Preload Bridge

**Purpose:** Securely expose update functionality to the renderer process through the context bridge.

**Objective:** Add updateAPI to the preload script following the existing API exposure pattern.

**Architecture Description:**

- Add to `src/electron/preload/index.ts`
- Follow existing pattern (fileSystemAPI, gitAPI, etc.)
- Expose methods that invoke IPC handlers
- Add TypeScript interface declarations

**File to Modify:** `src/electron/preload/index.ts`

**Full Prompt:**

```
Modify: src/electron/preload/index.ts

1. Add UpdateAPI interface after existing interfaces:

   interface IUpdateCheckResult {
     success: boolean;
     updateInfo?: {
       currentVersion: string;
       latestVersion: string;
       updateAvailable: boolean;
       downloadUrl?: string;
     };
     error?: string;
   }

   interface UpdateAPI {
     checkForUpdates: () => Promise<IUpdateCheckResult>;
     getCurrentVersion: () => Promise<string>;
     openDownloadPage: (url: string) => Promise<void>;
   }

2. Add updateAPI to contextBridge.exposeInMainWorld after existing APIs:

   updateAPI: {
     checkForUpdates: () => ipcRenderer.invoke('update:check'),
     getCurrentVersion: () => ipcRenderer.invoke('update:get-current-version'),
     openDownloadPage: (url: string) => ipcRenderer.invoke('update:open-download-page', url),
   } as UpdateAPI,

3. Update the global Window interface declaration:

   declare global {
     interface Window {
       electronAPI: ElectronAPI;
       fileSystemAPI: FileSystemAPI;
       externalAppsAPI: ExternalAppsAPI;
       gitAPI: GitAPI;
       menuAPI: MenuAPI;
       updateAPI: UpdateAPI;  // Add this line
     }
   }

Follow the existing patterns in the file for consistency.
```

---

### Task 4: Add "Check for Updates" Menu Item

**Purpose:** Allow users to manually check for updates from the application menu.

**Objective:** Add a "Check for Updates..." menu item in the Help menu that triggers an update check.

**Architecture Description:**

- Modify `createApplicationMenu()` in `src-electron/electron-main.ts`
- Add menu item before or after existing Help menu items
- Send IPC message to renderer when clicked
- Follow existing menu item patterns

**File to Modify:** `src-electron/electron-main.ts`

**Full Prompt:**

```
Modify: src-electron/electron-main.ts

In the createApplicationMenu() function, add a "Check for Updates..." menu item to the Help menu:

1. Find the Help menu definition (around line 180-200)

2. Add a new menu item at the beginning of the Help submenu:
   {
     label: 'Check for Updates...',
     click: () => {
       mainWindow?.webContents.send('menu:check-for-updates');
     },
   },
   { type: 'separator' },

3. This should appear BEFORE the existing Help menu items (Documentation, Report Issue, etc.)

The pattern follows the existing menu items that send IPC messages like 'menu:settings', 'menu:new-prompt', etc.
```

---

### Task 5: Create UpdateDialog Component

**Purpose:** Provide a user interface for displaying update information and actions.

**Objective:** Create a dialog component that shows update availability, version info, and action buttons.

**Architecture Description:**

- Create `src/components/dialogs/UpdateDialog.vue`
- Follow existing dialog patterns (v-model, q-dialog, etc.)
- States: checking, update-available, up-to-date, error
- Show current version, new version, release notes link
- Actions: "Download Update", "Remind Me Later", "Skip This Version"

**File to Create:** `src/components/dialogs/UpdateDialog.vue`

**Full Prompt:**

```
Create a new file: src/components/dialogs/UpdateDialog.vue

This dialog should:

1. Follow the existing dialog pattern from src/components/dialogs/SettingsDialog.vue and DeleteConfirmDialog.vue

2. Props:
   - modelValue: boolean (v-model for dialog open state)
   - updateInfo: IUpdateInfo | null (the update information)
   - isChecking: boolean (show loading state)
   - error: string | null (error message if check failed)

3. Emits:
   - update:modelValue (standard v-model emit)
   - download (user wants to download)
   - remind-later (user wants to be reminded later)
   - skip-version (user wants to skip this version)

4. Template structure:
   - Header: "Update Available" or "You're Up to Date" or "Checking for Updates..."
   - Icon: appropriate icon for each state (update available, up-to-date, checking, error)
   - Content:
     - If checking: show spinner
     - If error: show error message with retry button
     - If update available: show current version → new version, "A new version is available"
     - If up-to-date: show "You're running the latest version"
   - Actions:
     - If update available: "Download Update" (primary), "Remind Me Later", "Skip This Version"
     - If up-to-date or error: "Close" button

5. Use Quasar components: q-dialog, q-card, q-card-section, q-card-actions, q-btn, q-spinner, q-icon

6. Use i18n for all text strings: t('dialogs.update.xxx')

7. Style with scoped SCSS following existing dialog patterns

8. Dialog width: min-width 400px, max-width 500px

Reference existing dialogs for the exact styling and structure patterns.
```

---

### Task 6: Update appStore with Update State

**Purpose:** Centralize update-related state management in the application store.

**Objective:** Add update state, actions, and getters to appStore for managing update flow.

**Architecture Description:**

- Modify `src/stores/appStore.ts`
- Add state: updateInfo, isCheckingUpdate, updateError, lastUpdateCheck
- Add actions: checkForUpdates, dismissUpdate, skipVersion
- Store skipped versions in localStorage

**File to Modify:** `src/stores/appStore.ts`

**Full Prompt:**

```
Modify: src/stores/appStore.ts

Add update-related state and actions:

1. Add interfaces at the top (or import from types file):

   interface IUpdateInfo {
     currentVersion: string;
     latestVersion: string;
     updateAvailable: boolean;
     downloadUrl?: string;
   }

2. Add state refs:

   const updateInfo = ref<IUpdateInfo | null>(null);
   const isCheckingUpdate = ref(false);
   const updateError = ref<string | null>(null);
   const showUpdateDialog = ref(false);
   const skippedVersions = ref<string[]>([]);

3. Add initialization for skipped versions from localStorage:

   In initialize():
   const storedSkipped = localStorage.getItem('myndprompts:skippedVersions');
   if (storedSkipped) {
     skippedVersions.value = JSON.parse(storedSkipped);
   }

4. Add actions:

   async function checkForUpdates(showDialogIfNoUpdate = false): Promise<void> {
     if (!window.updateAPI) return;

     isCheckingUpdate.value = true;
     updateError.value = null;

     try {
       const result = await window.updateAPI.checkForUpdates();

       if (result.success && result.updateInfo) {
         updateInfo.value = result.updateInfo;

         // Show dialog if update available and not skipped
         if (result.updateInfo.updateAvailable &&
             !skippedVersions.value.includes(result.updateInfo.latestVersion)) {
           showUpdateDialog.value = true;
         } else if (showDialogIfNoUpdate) {
           showUpdateDialog.value = true;
         }
       } else if (result.error) {
         updateError.value = result.error;
         if (showDialogIfNoUpdate) {
           showUpdateDialog.value = true;
         }
       }
     } catch (err) {
       updateError.value = err instanceof Error ? err.message : 'Failed to check for updates';
       if (showDialogIfNoUpdate) {
         showUpdateDialog.value = true;
       }
     } finally {
       isCheckingUpdate.value = false;
     }
   }

   function dismissUpdateDialog(): void {
     showUpdateDialog.value = false;
   }

   function skipVersion(version: string): void {
     if (!skippedVersions.value.includes(version)) {
       skippedVersions.value.push(version);
       localStorage.setItem('myndprompts:skippedVersions', JSON.stringify(skippedVersions.value));
     }
     showUpdateDialog.value = false;
   }

   async function openDownloadPage(): Promise<void> {
     if (updateInfo.value?.downloadUrl && window.updateAPI) {
       await window.updateAPI.openDownloadPage(updateInfo.value.downloadUrl);
     }
     showUpdateDialog.value = false;
   }

5. Return all new state and actions from the store setup function.

Reference the existing store patterns in the file.
```

---

### Task 7: Integrate Update Check on App Startup

**Purpose:** Automatically check for updates when the application starts.

**Objective:** Add update check to MainLayout initialization and handle menu events for manual checks.

**Architecture Description:**

- Modify `src/layouts/MainLayout.vue`
- Import and use UpdateDialog component
- Add menu listener for 'menu:check-for-updates'
- Trigger update check after app initialization (with delay)
- Show UpdateDialog based on appStore state

**File to Modify:** `src/layouts/MainLayout.vue`

**Full Prompt:**

```
Modify: src/layouts/MainLayout.vue

1. Import UpdateDialog and appStore update functions:

   import UpdateDialog from '@/components/dialogs/UpdateDialog.vue';

   // In setup:
   const {
     showUpdateDialog,
     updateInfo,
     isCheckingUpdate,
     updateError,
     checkForUpdates,
     dismissUpdateDialog,
     skipVersion,
     openDownloadPage
   } = storeToRefs(appStore);  // or use appStore directly

2. Add menu listener for check-for-updates in onMounted:

   // Add to existing menu listener setup
   if (window.menuAPI) {
     // ... existing listeners ...

     // Listen for check for updates from menu
     window.electronAPI?.onMenuEvent?.('menu:check-for-updates', () => {
       appStore.checkForUpdates(true); // true = show dialog even if up-to-date
     });
   }

   // Alternative if using ipcRenderer directly in preload:
   // This may need adjustment based on how menu events are currently handled

3. Add automatic update check after initialization (with 3-second delay):

   onMounted(async () => {
     await Promise.all([appStore.initialize(), uiStore.initialize()]);

     // ... existing code ...

     // Check for updates after a short delay (don't block startup)
     setTimeout(() => {
       appStore.checkForUpdates(false); // false = only show if update available
     }, 3000);
   });

4. Add UpdateDialog to template (after SettingsDialog):

   <!-- Update Dialog -->
   <UpdateDialog
     v-model="appStore.showUpdateDialog"
     :update-info="appStore.updateInfo"
     :is-checking="appStore.isCheckingUpdate"
     :error="appStore.updateError"
     @download="appStore.openDownloadPage"
     @remind-later="appStore.dismissUpdateDialog"
     @skip-version="appStore.skipVersion(appStore.updateInfo?.latestVersion)"
   />

Reference existing dialog integration patterns in the file.
```

---

### Task 8: Add i18n Translations for Update Feature

**Purpose:** Provide localized strings for the update feature UI.

**Objective:** Add translation keys for all update-related text in all supported locales.

**Architecture Description:**

- Modify all locale files in `src/i18n/*/index.ts`
- Add `dialogs.update` section with all required keys
- Locales: en-US, en-GB, en-IE, pt-BR, pt-PT, es-ES, fr-FR, de-DE, it-IT, ar-SA

**Files to Modify:** All `src/i18n/*/index.ts` files

**Full Prompt:**

```
Modify all locale files in src/i18n/*/index.ts

Add the following translation keys under dialogs section:

For English (en-US, en-GB, en-IE):
update: {
  title: 'Software Update',
  checking: 'Checking for Updates...',
  available: 'Update Available',
  upToDate: "You're Up to Date",
  errorTitle: 'Update Check Failed',
  newVersion: 'A new version of MyndPrompts is available.',
  currentVersion: 'Current version',
  latestVersion: 'Latest version',
  releaseNotes: 'Release Notes',
  downloadBtn: 'Download Update',
  remindLater: 'Remind Me Later',
  skipVersion: 'Skip This Version',
  close: 'Close',
  retry: 'Retry',
  upToDateMessage: "You're running the latest version of MyndPrompts.",
},

For Portuguese (pt-BR, pt-PT):
update: {
  title: 'Atualização de Software',
  checking: 'Verificando atualizações...',
  available: 'Atualização Disponível',
  upToDate: 'Você está atualizado',
  errorTitle: 'Falha na Verificação',
  newVersion: 'Uma nova versão do MyndPrompts está disponível.',
  currentVersion: 'Versão atual',
  latestVersion: 'Última versão',
  releaseNotes: 'Notas de Lançamento',
  downloadBtn: 'Baixar Atualização',
  remindLater: 'Lembrar Depois',
  skipVersion: 'Pular Esta Versão',
  close: 'Fechar',
  retry: 'Tentar Novamente',
  upToDateMessage: 'Você está usando a versão mais recente do MyndPrompts.',
},

For Spanish (es-ES):
update: {
  title: 'Actualización de Software',
  checking: 'Buscando actualizaciones...',
  available: 'Actualización Disponible',
  upToDate: 'Estás Actualizado',
  errorTitle: 'Error al Verificar',
  newVersion: 'Una nueva versión de MyndPrompts está disponible.',
  currentVersion: 'Versión actual',
  latestVersion: 'Última versión',
  releaseNotes: 'Notas de la Versión',
  downloadBtn: 'Descargar Actualización',
  remindLater: 'Recordar Más Tarde',
  skipVersion: 'Omitir Esta Versión',
  close: 'Cerrar',
  retry: 'Reintentar',
  upToDateMessage: 'Estás usando la última versión de MyndPrompts.',
},

For French (fr-FR):
update: {
  title: 'Mise à jour du logiciel',
  checking: 'Recherche de mises à jour...',
  available: 'Mise à jour disponible',
  upToDate: 'Vous êtes à jour',
  errorTitle: 'Échec de la vérification',
  newVersion: 'Une nouvelle version de MyndPrompts est disponible.',
  currentVersion: 'Version actuelle',
  latestVersion: 'Dernière version',
  releaseNotes: 'Notes de version',
  downloadBtn: 'Télécharger la mise à jour',
  remindLater: 'Me rappeler plus tard',
  skipVersion: 'Ignorer cette version',
  close: 'Fermer',
  retry: 'Réessayer',
  upToDateMessage: 'Vous utilisez la dernière version de MyndPrompts.',
},

For German (de-DE):
update: {
  title: 'Software-Update',
  checking: 'Suche nach Updates...',
  available: 'Update verfügbar',
  upToDate: 'Sie sind auf dem neuesten Stand',
  errorTitle: 'Updateprüfung fehlgeschlagen',
  newVersion: 'Eine neue Version von MyndPrompts ist verfügbar.',
  currentVersion: 'Aktuelle Version',
  latestVersion: 'Neueste Version',
  releaseNotes: 'Versionshinweise',
  downloadBtn: 'Update herunterladen',
  remindLater: 'Später erinnern',
  skipVersion: 'Diese Version überspringen',
  close: 'Schließen',
  retry: 'Erneut versuchen',
  upToDateMessage: 'Sie verwenden die neueste Version von MyndPrompts.',
},

For Italian (it-IT):
update: {
  title: 'Aggiornamento Software',
  checking: 'Controllo aggiornamenti...',
  available: 'Aggiornamento Disponibile',
  upToDate: 'Sei Aggiornato',
  errorTitle: 'Controllo Fallito',
  newVersion: 'Una nuova versione di MyndPrompts è disponibile.',
  currentVersion: 'Versione attuale',
  latestVersion: 'Ultima versione',
  releaseNotes: 'Note di Rilascio',
  downloadBtn: 'Scarica Aggiornamento',
  remindLater: 'Ricordamelo Dopo',
  skipVersion: 'Salta Questa Versione',
  close: 'Chiudi',
  retry: 'Riprova',
  upToDateMessage: 'Stai usando l\'ultima versione di MyndPrompts.',
},

For Arabic (ar-SA):
update: {
  title: 'تحديث البرنامج',
  checking: 'جارٍ البحث عن تحديثات...',
  available: 'تحديث متاح',
  upToDate: 'أنت محدّث',
  errorTitle: 'فشل التحقق من التحديث',
  newVersion: 'يتوفر إصدار جديد من MyndPrompts.',
  currentVersion: 'الإصدار الحالي',
  latestVersion: 'أحدث إصدار',
  releaseNotes: 'ملاحظات الإصدار',
  downloadBtn: 'تنزيل التحديث',
  remindLater: 'ذكرني لاحقاً',
  skipVersion: 'تخطي هذا الإصدار',
  close: 'إغلاق',
  retry: 'إعادة المحاولة',
  upToDateMessage: 'أنت تستخدم أحدث إصدار من MyndPrompts.',
},

Add these under the existing 'dialogs' object in each locale file.
```

---

### Task 9: Test and Verify Update Flow

**Purpose:** Ensure the update feature works correctly across all scenarios.

**Objective:** Test all update flow scenarios and fix any issues.

**Architecture Description:**

- Manual testing checklist
- Test scenarios for different states
- Verify error handling
- Test menu integration

**Test Checklist:**

```
[ ] 1. App startup update check
    - Start app with internet connection
    - Verify update check runs after 3 seconds
    - Verify dialog appears if update available
    - Verify dialog does NOT appear if up-to-date

[ ] 2. Manual update check (up-to-date)
    - Click Help → Check for Updates
    - Verify dialog shows "You're Up to Date"
    - Verify Close button works

[ ] 3. Manual update check (update available)
    - Mock remote version > current version
    - Verify dialog shows update info
    - Verify current and new versions display correctly
    - Verify Download button opens browser

[ ] 4. Skip version
    - Click "Skip This Version"
    - Verify dialog closes
    - Restart app
    - Verify update dialog does NOT appear for skipped version

[ ] 5. Remind later
    - Click "Remind Me Later"
    - Verify dialog closes
    - Restart app
    - Verify update dialog appears again

[ ] 6. Error handling
    - Disconnect internet
    - Click Help → Check for Updates
    - Verify error message displays
    - Verify Retry button works

[ ] 7. Menu integration
    - Verify "Check for Updates..." appears in Help menu
    - Verify it's positioned correctly (before other items)
    - Verify keyboard shortcut works (if applicable)

[ ] 8. Cross-platform
    - Test on macOS
    - Test on Windows
    - Test on Linux
```

**Full Prompt:**

```
Test the update feature implementation:

1. Run the app in development mode: npm run dev

2. Open DevTools console to see any errors

3. Test each scenario from the checklist above

4. For testing "update available" state, temporarily modify the version comparison or mock the API response

5. Document any issues found and fix them

6. Verify all i18n translations appear correctly (switch languages in settings)

7. Test edge cases:
   - Very slow network
   - API returns invalid JSON
   - API returns unexpected format
   - Version comparison edge cases (1.0.0 vs 1.0.0-beta)

Report any issues and their fixes.
```

---

## 4. Dependencies

**No new dependencies required for MVP approach.**

For future advanced auto-update (optional):

```json
{
  "electron-updater": "^6.1.7"
}
```

---

## 5. Future Enhancements

1. **Auto-download:** Download update in background, install on quit
2. **Release notes:** Display changelog in dialog
3. **Update channels:** Stable, beta, canary
4. **Differential updates:** Delta updates for faster downloads
5. **Silent updates:** Update without user interaction (with setting)
6. **Rollback:** Ability to rollback to previous version

---

## 6. Security Considerations

1. **HTTPS only:** Version endpoint must use HTTPS
2. **Version validation:** Validate version format before comparison
3. **Download URL validation:** Only allow downloads from trusted domains
4. **Code signing:** Future auto-updates require signed binaries
5. **Update integrity:** Future updates should verify checksums

---

## 7. Estimated Effort

| Task                           | Complexity | Estimate       |
| ------------------------------ | ---------- | -------------- |
| Task 1: UpdateService          | Medium     | 1-2 hours      |
| Task 2: IPC Handlers           | Low        | 30 min         |
| Task 3: Preload Bridge         | Low        | 30 min         |
| Task 4: Menu Item              | Low        | 15 min         |
| Task 5: UpdateDialog           | Medium     | 1-2 hours      |
| Task 6: appStore               | Medium     | 1 hour         |
| Task 7: MainLayout Integration | Low        | 30 min         |
| Task 8: i18n Translations      | Low        | 1 hour         |
| Task 9: Testing                | Medium     | 1-2 hours      |
| **Total**                      |            | **7-10 hours** |
