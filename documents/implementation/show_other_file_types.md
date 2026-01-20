# Implementation: Support for Other File Types

## 1. Architecture

### 1.1 Current Architecture Overview

The MyndPrompts application uses a multi-layered architecture for file display:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                  │
├─────────────────────┬───────────────────────────────────────────────────────┤
│   ExplorerPanel     │                    EditorArea                          │
│   (Left Sidebar)    │  ┌─────────────────────────────────────────────────┐  │
│                     │  │  EditorPane                                      │  │
│  ┌───────────────┐  │  │  ┌─────────────────────────────────────────┐   │  │
│  │  Tree View    │  │  │  │  TabBar                                  │   │  │
│  │  - Projects   │──┼──┼──│  [Tab1] [Tab2] [Tab3*]                  │   │  │
│  │  - Prompts    │  │  │  └─────────────────────────────────────────┘   │  │
│  │  - Snippets   │  │  │  ┌─────────────────────────────────────────┐   │  │
│  └───────────────┘  │  │  │  MonacoEditor / FileViewer (NEW)        │   │  │
│                     │  │  │                                          │   │  │
│  Context Menus:     │  │  │  - Markdown files → Monaco              │   │  │
│  - New Prompt       │  │  │  - Images → ImageViewer (NEW)           │   │  │
│  - New Directory    │  │  │  - Videos → VideoPlayer (NEW)           │   │  │
│  - Add File (NEW)   │  │  │  - Audio → AudioPlayer (NEW)            │   │  │
│  - Add Folder (NEW) │  │  │  - Documents → DocViewer (NEW)          │   │  │
│  - Rename/Delete    │  │  │  - Unknown → FallbackViewer (NEW)       │   │  │
│                     │  │  └─────────────────────────────────────────┘   │  │
└─────────────────────┴──┴─────────────────────────────────────────────────┴──┘
```

### 1.2 Proposed Architecture Changes

#### 1.2.1 New Components

```
src/components/viewers/
├── FileViewer.vue           # Router component - decides which viewer to use
├── ImageViewer.vue          # Displays images (jpg, png, gif, webp, svg)
├── VideoPlayer.vue          # Plays videos (mp4, webm, mov, avi)
├── AudioPlayer.vue          # Plays audio (mp3, wav, ogg, flac)
├── DocumentViewer.vue       # Shows doc icon + external app options
├── SpreadsheetViewer.vue    # Shows spreadsheet icon + external app options
└── FallbackViewer.vue       # Shows incompatible icon + finder option
```

#### 1.2.2 File Type Classification

```typescript
// src/services/file-system/file-types.ts

export enum FileCategory {
  MARKDOWN = 'markdown', // .md files - use Monaco
  IMAGE = 'image', // jpg, png, gif, webp, svg, bmp, ico
  VIDEO = 'video', // mp4, webm, mov, avi, mkv
  AUDIO = 'audio', // mp3, wav, ogg, flac, aac, m4a
  DOCUMENT = 'document', // doc, docx, odt, rtf, pdf
  SPREADSHEET = 'spreadsheet', // xls, xlsx, ods, csv
  UNKNOWN = 'unknown', // Everything else
}

export interface IFileTypeInfo {
  category: FileCategory;
  mimeType: string;
  canPreview: boolean;
  externalApps: IExternalApp[];
}
```

#### 1.2.3 Tab Enhancement

```typescript
// Enhanced IOpenTab interface
interface IOpenTab {
  id: string;
  filePath: string;
  fileName: string;
  title: string;
  isDirty: boolean;
  isPinned: boolean;
  fileCategory: FileCategory; // NEW: determines which viewer to use
  mimeType?: string; // NEW: for media playback
}
```

#### 1.2.4 External App Integration

```typescript
// src/services/external-apps/external-app.service.ts

interface IExternalApp {
  id: string;
  name: string;
  icon: string;
  platform: 'all' | 'darwin' | 'win32' | 'linux';
  protocol?: string;      // e.g., 'googledocs://'
  webUrl?: string;        // e.g., 'https://docs.google.com/document/d/'
  nativeApp?: string;     // e.g., 'Microsoft Word'
}

// Actions
- openInGoogleDocs(filePath: string)
- openInGoogleSheets(filePath: string)
- openInWord(filePath: string)
- openInExcel(filePath: string)
- showInFinder(filePath: string)  // cross-platform
```

#### 1.2.5 Explorer Panel Enhancements

```
New Context Menu Items:
├── Add File...        → Opens file picker, copies selected file
├── Add Folder...      → Opens folder picker, copies folder recursively
└── [Separator]

Drag & Drop Support:
├── External files → Drop on project/directory → Copy file
└── External folders → Drop on project/directory → Copy folder recursively
```

### 1.3 Data Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           FILE OPENING FLOW                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  User clicks file in Explorer                                            │
│         │                                                                │
│         ▼                                                                │
│  ┌─────────────────────┐                                                │
│  │ getFileCategory()   │  ← Determines file type from extension         │
│  └─────────────────────┘                                                │
│         │                                                                │
│         ▼                                                                │
│  ┌─────────────────────┐                                                │
│  │ uiStore.openTab()   │  ← Creates tab with fileCategory               │
│  └─────────────────────┘                                                │
│         │                                                                │
│         ▼                                                                │
│  ┌─────────────────────┐                                                │
│  │ EditorPane          │  ← Checks fileCategory                         │
│  └─────────────────────┘                                                │
│         │                                                                │
│         ├── MARKDOWN ──────► MonacoEditor                               │
│         ├── IMAGE ─────────► ImageViewer                                │
│         ├── VIDEO ─────────► VideoPlayer                                │
│         ├── AUDIO ─────────► AudioPlayer                                │
│         ├── DOCUMENT ──────► DocumentViewer                             │
│         ├── SPREADSHEET ───► SpreadsheetViewer                          │
│         └── UNKNOWN ───────► FallbackViewer                             │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.4 Component Responsibilities

| Component               | Responsibility                                       |
| ----------------------- | ---------------------------------------------------- |
| `FileViewer.vue`        | Routes to appropriate viewer based on `fileCategory` |
| `ImageViewer.vue`       | Displays images with zoom, fit-to-window controls    |
| `VideoPlayer.vue`       | HTML5 video player with controls                     |
| `AudioPlayer.vue`       | HTML5 audio player with waveform visualization       |
| `DocumentViewer.vue`    | Shows file icon, name, and external app buttons      |
| `SpreadsheetViewer.vue` | Shows file icon, name, and external app buttons      |
| `FallbackViewer.vue`    | Shows broken file icon and "Show in Finder" button   |

### 1.5 IPC Channels (New)

```typescript
// Main Process Handlers
'fs:copy-file'; // Copy file to destination
'fs:copy-directory'; // Copy directory recursively
'fs:show-in-folder'; // Open Finder/Explorer at path
'fs:open-with-app'; // Open file with specific application
'fs:get-file-metadata'; // Get file size, type, dates
'dialog:open-file'; // Native file picker
'dialog:open-directory'; // Native folder picker
```

---

## 2. Todo List

### Phase 1: Foundation

- [x] Task 1: Create file type classification service
- [x] Task 2: Create FileViewer router component
- [x] Task 3: Enhance IOpenTab interface with file category

### Phase 2: Media Viewers

- [x] Task 4: Create ImageViewer component
- [x] Task 5: Create VideoPlayer component
- [x] Task 6: Create AudioPlayer component

### Phase 3: Document Integration

- [x] Task 7: Create external app service
- [x] Task 8: Create DocumentViewer component
- [x] Task 9: Create SpreadsheetViewer component
- [x] Task 10: Create FallbackViewer component

### Phase 4: Explorer Enhancements

- [x] Task 11: Add file/folder copy IPC handlers
- [x] Task 12: Add "Add File" context menu action
- [x] Task 13: Add "Add Folder" context menu action
- [x] Task 14: Implement drag-and-drop for external files

### Phase 5: Integration

- [x] Task 15: Update EditorPane to use FileViewer
- [x] Task 16: Update openFile function to detect file types
- [ ] Task 17: Testing and polish

---

## 3. Task Details

---

### Task 1: Create File Type Classification Service

**Purpose:**
Establish a centralized service that classifies files by their extension into categories (image, video, audio, document, spreadsheet, markdown, unknown). This service will be the foundation for deciding which viewer component to use.

**Objective:**
Create `src/services/file-system/file-types.ts` with:

- FileCategory enum
- Extension-to-category mapping
- Helper functions for file type detection
- MIME type mapping for media files

**Architecture Description:**
The file type service is a pure TypeScript module with no dependencies on Vue or Electron. It exports:

1. `FileCategory` enum for type safety
2. `getFileCategory(filePath: string): FileCategory` - main detection function
3. `getMimeType(filePath: string): string` - for HTML5 media elements
4. `getFileTypeInfo(filePath: string): IFileTypeInfo` - complete file info
5. `canPreviewInApp(filePath: string): boolean` - quick check for viewability

**Full Prompt:**

````
Create a new file type classification service for the MyndPrompts Electron application.

## File to Create
`src/services/file-system/file-types.ts`

## Requirements

1. Create a FileCategory enum with values:
   - MARKDOWN
   - IMAGE
   - VIDEO
   - AUDIO
   - DOCUMENT
   - SPREADSHEET
   - UNKNOWN

2. Create extension mappings:
   - MARKDOWN: ['.md']
   - IMAGE: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.tiff']
   - VIDEO: ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v']
   - AUDIO: ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma']
   - DOCUMENT: ['.doc', '.docx', '.odt', '.rtf', '.pdf', '.pages']
   - SPREADSHEET: ['.xls', '.xlsx', '.ods', '.csv', '.numbers']

3. Create MIME type mappings for media files (needed for HTML5 elements)

4. Create interfaces:
   ```typescript
   interface IFileTypeInfo {
     category: FileCategory;
     extension: string;
     mimeType: string;
     canPreview: boolean;  // true for markdown, image, video, audio
     icon: string;         // Material icon name
   }
````

5. Export functions:
   - getFileCategory(filePath: string): FileCategory
   - getMimeType(filePath: string): string
   - getFileTypeInfo(filePath: string): IFileTypeInfo
   - canPreviewInApp(filePath: string): boolean
   - getIconForFile(filePath: string): string

6. Handle case-insensitive extensions (.JPG should work like .jpg)

7. Add JSDoc comments for all exports

Do NOT create any Vue components or modify other files. Only create this single TypeScript service file.

```

---

### Task 2: Create FileViewer Router Component

**Purpose:**
Create a central routing component that receives a file path and renders the appropriate viewer component based on the file's category.

**Objective:**
Create `src/components/viewers/FileViewer.vue` that:
- Accepts filePath and fileCategory as props
- Dynamically renders the correct viewer component
- Provides a consistent container/wrapper for all viewers
- Handles loading and error states

**Architecture Description:**
FileViewer acts as a smart router component using Vue's dynamic component feature (`<component :is="...">`). It imports all viewer components and maps FileCategory to the appropriate component. This centralizes the viewer selection logic and provides a single integration point for EditorPane.

**Full Prompt:**
```

Create the FileViewer router component for the MyndPrompts application.

## File to Create

`src/components/viewers/FileViewer.vue`

## Requirements

1. Props:
   - filePath: string (required) - Full path to the file
   - fileCategory: FileCategory (required) - From file-types.ts
   - fileName: string (required) - Display name

2. Use Vue 3 Composition API with <script setup lang="ts">

3. Import the FileCategory enum from '@services/file-system/file-types'

4. Create a computed property that maps FileCategory to component names:
   - MARKDOWN → null (will still use MonacoEditor in EditorPane)
   - IMAGE → 'ImageViewer'
   - VIDEO → 'VideoPlayer'
   - AUDIO → 'AudioPlayer'
   - DOCUMENT → 'DocumentViewer'
   - SPREADSHEET → 'SpreadsheetViewer'
   - UNKNOWN → 'FallbackViewer'

5. Template structure:

   ```vue
   <template>
     <div class="file-viewer">
       <component
         v-if="viewerComponent"
         :is="viewerComponent"
         :file-path="filePath"
         :file-name="fileName"
       />
       <div
         v-else
         class="file-viewer__unsupported"
       >
         <q-icon
           name="error"
           size="48px"
         />
         <p>Unable to display this file type</p>
       </div>
     </div>
   </template>
   ```

6. Styling:
   - Full height/width container
   - Centered content for error state
   - Dark mode support using CSS variables

7. For now, use placeholder components that just show the component name.
   The actual viewer components will be created in subsequent tasks.

8. Use defineAsyncComponent for lazy loading viewer components

Do NOT modify any existing files. Create only this new component.

```

---

### Task 3: Enhance IOpenTab Interface with File Category

**Purpose:**
Extend the tab interface to include file category information so EditorPane knows which viewer to render.

**Objective:**
Update `src/stores/uiStore.ts` to:
- Add fileCategory field to IOpenTab interface
- Add mimeType optional field for media files
- Update openTab function to accept these new fields
- Ensure backward compatibility with existing tabs

**Architecture Description:**
The IOpenTab interface is the contract between ExplorerPanel (which opens files) and EditorPane (which displays them). By adding fileCategory to this interface, we enable EditorPane to make rendering decisions without re-detecting the file type.

**Full Prompt:**
```

Enhance the IOpenTab interface in uiStore to support different file types.

## File to Modify

`src/stores/uiStore.ts`

## Requirements

1. Import FileCategory from '@services/file-system/file-types'

2. Update the IOpenTab interface:

   ```typescript
   interface IOpenTab {
     id: string;
     filePath: string;
     fileName: string;
     title: string;
     isDirty: boolean;
     isPinned: boolean;
     fileCategory: FileCategory; // NEW - required
     mimeType?: string; // NEW - optional, for media files
   }
   ```

3. Update the openTab function signature to require fileCategory:

   ```typescript
   function openTab(tab: {
     filePath: string;
     fileName: string;
     title: string;
     isDirty?: boolean;
     isPinned?: boolean;
     fileCategory: FileCategory;
     mimeType?: string;
   }): void;
   ```

4. Ensure the tab creation logic includes fileCategory in the new tab object

5. For backward compatibility, if any existing code calls openTab without fileCategory,
   default to FileCategory.MARKDOWN (since existing code only opens .md files)

6. Update updateTabFilePath if it exists to preserve fileCategory

7. Add a helper function:
   ```typescript
   function getTabsByCategory(category: FileCategory): IOpenTab[];
   ```

Only modify the uiStore.ts file. Do not modify other files yet.

```

---

### Task 4: Create ImageViewer Component

**Purpose:**
Create a component that displays image files with zoom controls and fit-to-window functionality.

**Objective:**
Create `src/components/viewers/ImageViewer.vue` that:
- Displays images using native HTML img element
- Provides zoom in/out controls
- Provides fit-to-window toggle
- Shows image dimensions and file size
- Supports dark mode background

**Architecture Description:**
ImageViewer is a presentational component that receives a file path and renders the image. It converts the file path to a file:// URL for the img src. The component manages its own zoom state and provides a toolbar for user controls.

**Full Prompt:**
```

Create the ImageViewer component for displaying image files in MyndPrompts.

## File to Create

`src/components/viewers/ImageViewer.vue`

## Requirements

1. Props:
   - filePath: string (required) - Full path to the image file
   - fileName: string (required) - Display name

2. Use Vue 3 Composition API with <script setup lang="ts">

3. Features:
   - Display the image centered in the container
   - Zoom controls: zoom in (+), zoom out (-), reset (100%), fit to window
   - Pan support when zoomed in (click and drag)
   - Display image info: dimensions, file size
   - Checkerboard background for images with transparency

4. Template structure:

   ```vue
   <template>
     <div class="image-viewer">
       <!-- Toolbar -->
       <div class="image-viewer__toolbar">
         <q-btn
           flat
           dense
           icon="zoom_out"
           @click="zoomOut"
         />
         <span class="image-viewer__zoom-level">{{ zoomLevel }}%</span>
         <q-btn
           flat
           dense
           icon="zoom_in"
           @click="zoomIn"
         />
         <q-btn
           flat
           dense
           icon="fit_screen"
           @click="fitToWindow"
         />
         <q-btn
           flat
           dense
           icon="crop_free"
           @click="resetZoom"
         />
         <q-separator vertical />
         <span class="image-viewer__info">{{ imageInfo }}</span>
       </div>

       <!-- Image container -->
       <div
         class="image-viewer__container"
         ref="containerRef"
         @wheel="handleWheel"
         @mousedown="startPan"
       >
         <img
           ref="imageRef"
           :src="imageUrl"
           :style="imageStyle"
           @load="onImageLoad"
           @error="onImageError"
         />
       </div>

       <!-- Error state -->
       <div
         v-if="hasError"
         class="image-viewer__error"
       >
         <q-icon
           name="broken_image"
           size="64px"
         />
         <p>Failed to load image</p>
       </div>
     </div>
   </template>
   ```

5. Zoom implementation:
   - Zoom levels: 10%, 25%, 50%, 75%, 100%, 150%, 200%, 300%, 400%
   - Mouse wheel zooms centered on cursor position
   - Smooth zoom transitions

6. Pan implementation:
   - Click and drag to pan when zoomed in
   - Cursor changes to 'grab' / 'grabbing'

7. Styling:
   - Checkerboard background (for transparency)
   - Dark toolbar matching app theme
   - Smooth transitions for zoom

8. Convert file path to file:// URL:

   ```typescript
   const imageUrl = computed(() => `file://${props.filePath}`);
   ```

9. Use Quasar components (q-btn, q-icon, q-separator)

Create only this component file.

```

---

### Task 5: Create VideoPlayer Component

**Purpose:**
Create a component that plays video files with standard playback controls.

**Objective:**
Create `src/components/viewers/VideoPlayer.vue` that:
- Plays videos using HTML5 video element
- Provides play/pause, seek, volume controls
- Shows video duration and current time
- Supports fullscreen mode

**Architecture Description:**
VideoPlayer wraps an HTML5 video element with custom controls styled to match the app theme. It receives the file path, converts it to a file:// URL, and uses the mimeType for proper codec handling.

**Full Prompt:**
```

Create the VideoPlayer component for playing video files in MyndPrompts.

## File to Create

`src/components/viewers/VideoPlayer.vue`

## Requirements

1. Props:
   - filePath: string (required) - Full path to the video file
   - fileName: string (required) - Display name
   - mimeType: string (optional) - MIME type for the video

2. Use Vue 3 Composition API with <script setup lang="ts">

3. Features:
   - HTML5 video element with native controls as fallback
   - Custom overlay controls (play/pause, progress bar, volume, fullscreen)
   - Time display: current / total
   - Keyboard shortcuts: Space (play/pause), Arrow keys (seek), M (mute), F (fullscreen)
   - Loading spinner while video loads
   - Error state for unsupported formats

4. Template structure:

   ```vue
   <template>
     <div
       class="video-player"
       ref="playerRef"
     >
       <video
         ref="videoRef"
         :src="videoUrl"
         :type="mimeType"
         @loadedmetadata="onMetadataLoaded"
         @timeupdate="onTimeUpdate"
         @ended="onEnded"
         @error="onError"
         @waiting="isBuffering = true"
         @canplay="isBuffering = false"
       />

       <!-- Custom controls overlay -->
       <div
         class="video-player__controls"
         v-show="showControls"
       >
         <q-btn
           flat
           round
           :icon="isPlaying ? 'pause' : 'play_arrow'"
           @click="togglePlay"
         />
         <div class="video-player__progress">
           <q-slider
             v-model="progress"
             :min="0"
             :max="duration"
             @change="seek"
           />
         </div>
         <span class="video-player__time"
           >{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span
         >
         <q-btn
           flat
           round
           :icon="isMuted ? 'volume_off' : 'volume_up'"
           @click="toggleMute"
         />
         <q-slider
           v-model="volume"
           :min="0"
           :max="100"
           style="width: 80px"
         />
         <q-btn
           flat
           round
           icon="fullscreen"
           @click="toggleFullscreen"
         />
       </div>

       <!-- Loading state -->
       <div
         v-if="isBuffering"
         class="video-player__loading"
       >
         <q-spinner size="48px" />
       </div>

       <!-- Error state -->
       <div
         v-if="hasError"
         class="video-player__error"
       >
         <q-icon
           name="error"
           size="64px"
         />
         <p>Unable to play this video format</p>
         <q-btn
           label="Show in Finder"
           @click="showInFinder"
         />
       </div>
     </div>
   </template>
   ```

5. Control behavior:
   - Auto-hide controls after 3 seconds of inactivity
   - Show controls on mouse move
   - Click video to toggle play/pause
   - Double-click for fullscreen

6. Styling:
   - Dark semi-transparent control bar
   - Centered video in container
   - Responsive sizing

7. Convert file path to file:// URL

8. Include showInFinder function that emits an event (to be handled by parent)

Create only this component file.

```

---

### Task 6: Create AudioPlayer Component

**Purpose:**
Create a component that plays audio files with playback controls and optional waveform visualization.

**Objective:**
Create `src/components/viewers/AudioPlayer.vue` that:
- Plays audio using HTML5 audio element
- Provides play/pause, seek, volume controls
- Shows audio artwork if available (ID3 tags) or file icon
- Optional simple waveform visualization

**Architecture Description:**
AudioPlayer provides a music-player-like interface centered in the viewing area. It uses the HTML5 audio element for playback and can optionally show a basic waveform using the Web Audio API.

**Full Prompt:**
```

Create the AudioPlayer component for playing audio files in MyndPrompts.

## File to Create

`src/components/viewers/AudioPlayer.vue`

## Requirements

1. Props:
   - filePath: string (required) - Full path to the audio file
   - fileName: string (required) - Display name
   - mimeType: string (optional) - MIME type for the audio

2. Use Vue 3 Composition API with <script setup lang="ts">

3. Features:
   - HTML5 audio element (hidden, controlled programmatically)
   - Large centered player card UI
   - Album art placeholder (music note icon)
   - Play/pause button (large, centered)
   - Progress bar with seek capability
   - Time display: current / total
   - Volume control with mute toggle
   - Keyboard shortcuts: Space (play/pause), Arrow keys (seek)

4. Template structure:

   ```vue
   <template>
     <div class="audio-player">
       <audio
         ref="audioRef"
         :src="audioUrl"
         @loadedmetadata="onLoad"
         @timeupdate="onTimeUpdate"
       />

       <div class="audio-player__card">
         <!-- Artwork / Icon -->
         <div class="audio-player__artwork">
           <q-icon
             name="music_note"
             size="96px"
           />
         </div>

         <!-- File name -->
         <div class="audio-player__title">{{ fileName }}</div>

         <!-- Progress -->
         <div class="audio-player__progress">
           <span>{{ formatTime(currentTime) }}</span>
           <q-slider
             v-model="progress"
             :min="0"
             :max="duration"
             @change="seek"
           />
           <span>{{ formatTime(duration) }}</span>
         </div>

         <!-- Controls -->
         <div class="audio-player__controls">
           <q-btn
             flat
             round
             icon="skip_previous"
             @click="restart"
           />
           <q-btn
             round
             color="primary"
             size="lg"
             :icon="isPlaying ? 'pause' : 'play_arrow'"
             @click="togglePlay"
           />
           <q-btn
             flat
             round
             :icon="isMuted ? 'volume_off' : 'volume_up'"
             @click="toggleMute"
           />
         </div>

         <!-- Volume slider -->
         <div class="audio-player__volume">
           <q-icon name="volume_down" />
           <q-slider
             v-model="volume"
             :min="0"
             :max="100"
           />
           <q-icon name="volume_up" />
         </div>
       </div>

       <!-- Error state -->
       <div
         v-if="hasError"
         class="audio-player__error"
       >
         <q-icon
           name="error"
           size="48px"
         />
         <p>Unable to play this audio format</p>
         <q-btn
           label="Show in Finder"
           @click="showInFinder"
         />
       </div>
     </div>
   </template>
   ```

5. Styling:
   - Centered card design (max-width: 400px)
   - Rounded corners, subtle shadow
   - Dark mode support
   - Large play button with primary color

6. formatTime helper: converts seconds to MM:SS format

7. Convert file path to file:// URL

Create only this component file.

```

---

### Task 7: Create External App Service

**Purpose:**
Create a service that handles opening files in external applications and showing files in the system file manager.

**Objective:**
Create `src/services/external-apps/external-app.service.ts` and corresponding IPC handlers that:
- Open files in system default application
- Open files in specific applications (Word, Excel, etc.)
- Open files in web applications (Google Docs, Sheets)
- Show files in Finder/Explorer

**Architecture Description:**
This service has two parts:
1. Renderer service: provides API for Vue components
2. Main process IPC handlers: execute shell commands

The renderer service calls through the IPC bridge to the main process, which uses Electron's shell module and child_process to open applications.

**Full Prompt:**
```

Create the external application service for opening files in external apps.

## Files to Create/Modify

### 1. Create: `src/services/external-apps/external-app.service.ts`

Renderer-side service that provides:

```typescript
interface IExternalAppService {
  // Show file in system file manager
  showInFolder(filePath: string): Promise<void>;

  // Open with system default app
  openWithDefault(filePath: string): Promise<void>;

  // Open in specific applications
  openInGoogleDocs(filePath: string): Promise<void>;
  openInGoogleSheets(filePath: string): Promise<void>;
  openInWord(filePath: string): Promise<void>;
  openInExcel(filePath: string): Promise<void>;

  // Get platform-specific label
  getFileManagerName(): string; // "Finder" | "Explorer" | "Files"
}
```

Implementation calls through window.externalAppsAPI (to be added to preload).

### 2. Create: `src/services/external-apps/index.ts`

Export the service instance.

### 3. Modify: `src/electron/preload/index.ts`

Add externalAppsAPI to the context bridge:

```typescript
externalAppsAPI: {
  showInFolder: (filePath: string) => ipcRenderer.invoke('external-apps:show-in-folder', filePath),
  openWithDefault: (filePath: string) => ipcRenderer.invoke('external-apps:open-default', filePath),
  openInApp: (filePath: string, appId: string) => ipcRenderer.invoke('external-apps:open-in-app', filePath, appId),
}
```

### 4. Modify: `src/electron/main/index.ts`

Add IPC handlers:

```typescript
import { shell } from 'electron';
import { exec } from 'child_process';

// Show in folder
ipcMain.handle('external-apps:show-in-folder', async (_, filePath: string) => {
  shell.showItemInFolder(filePath);
});

// Open with default app
ipcMain.handle('external-apps:open-default', async (_, filePath: string) => {
  await shell.openPath(filePath);
});

// Open in specific app
ipcMain.handle('external-apps:open-in-app', async (_, filePath: string, appId: string) => {
  // Platform-specific logic for opening in Word, Excel, etc.
  // Use 'open -a' on macOS, 'start' on Windows
});
```

### 5. For Google Docs/Sheets:

- Upload file to Google Drive first would require OAuth - skip for now
- Instead, just show option to copy file path and provide link to Google Docs

The service should gracefully handle errors and provide meaningful error messages.

```

---

### Task 8: Create DocumentViewer Component

**Purpose:**
Create a component that displays document files (Word, PDF, etc.) with options to open in external applications.

**Objective:**
Create `src/components/viewers/DocumentViewer.vue` that:
- Shows a large document icon
- Displays file name and size
- Provides buttons to open in external apps
- Shows "Show in Finder" option

**Architecture Description:**
DocumentViewer is a simple presentational component that doesn't try to render the document content. Instead, it provides a clean interface for opening the file in appropriate external applications.

**Full Prompt:**
```

Create the DocumentViewer component for document files in MyndPrompts.

## File to Create

`src/components/viewers/DocumentViewer.vue`

## Requirements

1. Props:
   - filePath: string (required) - Full path to the document
   - fileName: string (required) - Display name

2. Use Vue 3 Composition API with <script setup lang="ts">

3. Import and use the external app service from '@services/external-apps'

4. Features:
   - Large centered card with document icon
   - File name and extension badge
   - File size display (call main process to get)
   - Action buttons:
     - "Open in Google Docs" (for .doc, .docx)
     - "Open in Microsoft Word" (if available)
     - "Open with Default App"
     - "Show in [Finder/Explorer]" (use platform-specific name)

5. Template structure:

   ```vue
   <template>
     <div class="document-viewer">
       <div class="document-viewer__card">
         <!-- Icon -->
         <div class="document-viewer__icon">
           <q-icon
             :name="documentIcon"
             size="96px"
             color="primary"
           />
           <q-badge
             :label="fileExtension"
             floating
           />
         </div>

         <!-- File info -->
         <div class="document-viewer__name">{{ fileName }}</div>
         <div class="document-viewer__size">{{ fileSize }}</div>

         <!-- Actions -->
         <div class="document-viewer__actions">
           <q-btn
             v-for="action in availableActions"
             :key="action.id"
             :label="action.label"
             :icon="action.icon"
             outline
             @click="action.handler"
             class="q-ma-sm"
           />
         </div>
       </div>
     </div>
   </template>
   ```

6. Document icons based on extension:
   - .doc/.docx → 'description' or custom Word icon
   - .pdf → 'picture_as_pdf'
   - .odt → 'description'
   - .rtf → 'article'

7. availableActions computed property that returns appropriate actions
   based on file type and platform

8. Styling:
   - Centered card (max-width: 500px)
   - Clean, minimal design
   - Dark mode support

Create only this component file.

```

---

### Task 9: Create SpreadsheetViewer Component

**Purpose:**
Create a component that displays spreadsheet files with options to open in external applications.

**Objective:**
Create `src/components/viewers/SpreadsheetViewer.vue` similar to DocumentViewer but for spreadsheet files.

**Architecture Description:**
Nearly identical to DocumentViewer but with spreadsheet-specific icons and actions (Google Sheets, Excel).

**Full Prompt:**
```

Create the SpreadsheetViewer component for spreadsheet files in MyndPrompts.

## File to Create

`src/components/viewers/SpreadsheetViewer.vue`

## Requirements

1. Props:
   - filePath: string (required)
   - fileName: string (required)

2. Use Vue 3 Composition API with <script setup lang="ts">

3. Structure identical to DocumentViewer but with:
   - Spreadsheet-specific icon (grid_on, table_chart)
   - Actions: "Open in Google Sheets", "Open in Excel", "Open with Default", "Show in Finder"

4. Template similar to DocumentViewer with spreadsheet theming

5. Icons based on extension:
   - .xls/.xlsx → 'grid_on' or custom Excel icon
   - .ods → 'table_chart'
   - .csv → 'view_list'

6. Green color theme (Excel-like) instead of blue

Create only this component file.

```

---

### Task 10: Create FallbackViewer Component

**Purpose:**
Create a component for files that cannot be previewed, showing only the option to open in system file manager.

**Objective:**
Create `src/components/viewers/FallbackViewer.vue` that:
- Shows an "incompatible" icon
- Displays file name and type
- Provides only "Show in Finder/Explorer" option

**Architecture Description:**
FallbackViewer is the catch-all viewer for any file type not handled by other viewers. It provides a clean message explaining the file can't be previewed and offers to show it in the system file manager.

**Full Prompt:**
```

Create the FallbackViewer component for unsupported file types in MyndPrompts.

## File to Create

`src/components/viewers/FallbackViewer.vue`

## Requirements

1. Props:
   - filePath: string (required)
   - fileName: string (required)

2. Use Vue 3 Composition API with <script setup lang="ts">

3. Features:
   - Large "broken/incompatible" icon
   - Message: "This file type cannot be previewed"
   - File name display
   - Single action: "Show in [Finder/Explorer]"

4. Template:

   ```vue
   <template>
     <div class="fallback-viewer">
       <div class="fallback-viewer__card">
         <q-icon
           name="block"
           size="96px"
           color="grey"
         />
         <div class="fallback-viewer__message">This file type cannot be previewed</div>
         <div class="fallback-viewer__filename">{{ fileName }}</div>
         <q-btn
           :label="`Show in ${fileManagerName}`"
           icon="folder_open"
           color="primary"
           @click="showInFolder"
         />
       </div>
     </div>
   </template>
   ```

5. Minimal, centered styling

Create only this component file.

```

---

### Task 11: Add File/Folder Copy IPC Handlers

**Purpose:**
Add IPC handlers in the main process to support copying files and folders into projects.

**Objective:**
Add to `src/electron/main/services/file-system.service.ts`:
- copyFile(source, destination) method
- copyDirectory(source, destination, recursive) method
Add corresponding IPC handlers in main/index.ts.

**Architecture Description:**
These handlers use Node.js fs module to copy files and directories. The copyDirectory function recursively copies all contents. Both functions validate paths to prevent security issues.

**Full Prompt:**
```

Add file and folder copy functionality to the file system service.

## Files to Modify

### 1. `src/electron/main/services/file-system.service.ts`

Add methods:

```typescript
/**
 * Copy a file to a destination directory
 * @param sourcePath - Full path to source file
 * @param destDir - Destination directory path
 * @returns New file path or error
 */
async copyFile(sourcePath: string, destDir: string): Promise<{ success: boolean; newPath?: string; error?: string }> {
  // Validate paths
  // Get file name from source
  // Check if destination already exists (add number suffix if so)
  // Use fs.copyFile
  // Return new path
}

/**
 * Copy a directory recursively to a destination
 * @param sourcePath - Full path to source directory
 * @param destDir - Destination parent directory
 * @returns New directory path or error
 */
async copyDirectory(sourcePath: string, destDir: string): Promise<{ success: boolean; newPath?: string; error?: string }> {
  // Validate paths
  // Get directory name from source
  // Check if destination already exists
  // Use fs.cp with recursive option (Node 16.7+)
  // Return new path
}
```

### 2. `src/electron/main/index.ts`

Add IPC handlers:

```typescript
ipcMain.handle('fs:copy-file', async (_, sourcePath: string, destDir: string) => {
  return fileSystemService.copyFile(sourcePath, destDir);
});

ipcMain.handle('fs:copy-directory', async (_, sourcePath: string, destDir: string) => {
  return fileSystemService.copyDirectory(sourcePath, destDir);
});
```

### 3. `src/electron/preload/index.ts`

Add to fileSystemAPI:

```typescript
copyFile: (sourcePath: string, destDir: string) =>
  ipcRenderer.invoke('fs:copy-file', sourcePath, destDir),
copyDirectory: (sourcePath: string, destDir: string) =>
  ipcRenderer.invoke('fs:copy-directory', sourcePath, destDir),
```

### 4. Update type definitions if needed

Handle edge cases:

- Source file/folder doesn't exist
- Destination is not a directory
- Name collision (append " (1)", " (2)", etc.)
- Permission errors

```

---

### Task 12: Add "Add File" Context Menu Action

**Purpose:**
Add an "Add File..." option to the context menu of projects and directories in ExplorerPanel.

**Objective:**
Modify `src/components/layout/sidebar/ExplorerPanel.vue` to:
- Add "Add File..." menu item to project/directory context menus
- Open native file picker dialog
- Copy selected file(s) to the target directory
- Refresh the tree view

**Architecture Description:**
The context menu item triggers a function that:
1. Opens Electron's native file dialog
2. Gets selected file path(s)
3. Calls the copyFile IPC handler for each file
4. Refreshes the explorer tree

**Full Prompt:**
```

Add "Add File..." context menu option to ExplorerPanel.

## File to Modify

`src/components/layout/sidebar/ExplorerPanel.vue`

## Requirements

1. Add "Add File..." menu item to context menus for:
   - Projects (type === 'project')
   - Directories (type === 'directory')
   - The main "Prompts" folder

2. Menu item:

   ```vue
   <q-item clickable v-close-popup @click="addFileToDirectory(node)">
     <q-item-section avatar>
       <q-icon name="note_add" />
     </q-item-section>
     <q-item-section>Add File...</q-item-section>
   </q-item>
   ```

3. Implement addFileToDirectory function:

   ```typescript
   async function addFileToDirectory(node: ITreeNode): Promise<void> {
     // Get target directory path
     const targetDir = node.filePath || node.parentPath;
     if (!targetDir) return;

     // Open file dialog (multi-select allowed)
     const result = await window.dialogAPI.showOpenDialog({
       properties: ['openFile', 'multiSelections'],
       title: 'Select files to add',
     });

     if (result.canceled || !result.filePaths.length) return;

     // Copy each file
     for (const filePath of result.filePaths) {
       const copyResult = await window.fileSystemAPI.copyFile(filePath, targetDir);
       if (!copyResult.success) {
         showError(`Failed to copy ${path.basename(filePath)}: ${copyResult.error}`);
       }
     }

     // Refresh tree
     await refreshTree();

     // Show success notification
     $q.notify({
       type: 'positive',
       message: `Added ${result.filePaths.length} file(s)`,
     });
   }
   ```

4. Add dialogAPI to preload if not exists:

   ```typescript
   dialogAPI: {
     showOpenDialog: (options) => ipcRenderer.invoke('dialog:show-open', options),
   }
   ```

5. Add IPC handler for dialog in main process:
   ```typescript
   ipcMain.handle('dialog:show-open', async (_, options) => {
     return dialog.showOpenDialog(options);
   });
   ```

Place the menu item after "New Prompt" and "New Directory" options.

```

---

### Task 13: Add "Add Folder" Context Menu Action

**Purpose:**
Add an "Add Folder..." option to the context menu of projects and directories in ExplorerPanel.

**Objective:**
Similar to Task 12 but for folders, with recursive copy.

**Architecture Description:**
Same pattern as "Add File" but uses directory selection and copyDirectory function.

**Full Prompt:**
```

Add "Add Folder..." context menu option to ExplorerPanel.

## File to Modify

`src/components/layout/sidebar/ExplorerPanel.vue`

## Requirements

1. Add "Add Folder..." menu item after "Add File..." in:
   - Projects
   - Directories
   - Main "Prompts" folder

2. Menu item:

   ```vue
   <q-item clickable v-close-popup @click="addFolderToDirectory(node)">
     <q-item-section avatar>
       <q-icon name="create_new_folder" />
     </q-item-section>
     <q-item-section>Add Folder...</q-item-section>
   </q-item>
   ```

3. Implement addFolderToDirectory function:

   ```typescript
   async function addFolderToDirectory(node: ITreeNode): Promise<void> {
     const targetDir = node.filePath || node.parentPath;
     if (!targetDir) return;

     // Open folder dialog
     const result = await window.dialogAPI.showOpenDialog({
       properties: ['openDirectory'],
       title: 'Select folder to add',
     });

     if (result.canceled || !result.filePaths.length) return;

     const folderPath = result.filePaths[0];

     // Show loading indicator
     $q.loading.show({ message: 'Copying folder...' });

     try {
       const copyResult = await window.fileSystemAPI.copyDirectory(folderPath, targetDir);

       if (copyResult.success) {
         await refreshTree();
         $q.notify({
           type: 'positive',
           message: `Folder added successfully`,
         });
       } else {
         showError(`Failed to copy folder: ${copyResult.error}`);
       }
     } finally {
       $q.loading.hide();
     }
   }
   ```

4. Add separator between file operations and rename/delete:
   ```vue
   <q-separator />
   ```

```

---

### Task 14: Implement Drag-and-Drop for External Files

**Purpose:**
Allow users to drag files and folders from their system file manager and drop them onto projects/directories in the ExplorerPanel.

**Objective:**
Modify ExplorerPanel to:
- Accept drop events on project and directory nodes
- Detect if dropped items are files or folders
- Copy them to the target directory
- Provide visual feedback during drag

**Architecture Description:**
HTML5 drag-and-drop API is used. The tree nodes that are valid drop targets get `@dragover`, `@dragleave`, and `@drop` event handlers. When files are dropped, the dataTransfer object contains file paths which are passed to the copy functions.

**Full Prompt:**
```

Implement drag-and-drop support for external files in ExplorerPanel.

## File to Modify

`src/components/layout/sidebar/ExplorerPanel.vue`

## Requirements

1. Add drop zone styling and events to project/directory tree items:

   ```vue
   <q-item
     :class="{ 'drop-target-active': isDropTarget(node) }"
     @dragover.prevent="onDragOver($event, node)"
     @dragleave="onDragLeave($event, node)"
     @drop.prevent="onDrop($event, node)"
   >
   ```

2. Track which node is being dragged over:

   ```typescript
   const dropTargetNode = ref<string | null>(null);

   function isDropTarget(node: ITreeNode): boolean {
     return dropTargetNode.value === node.id;
   }
   ```

3. Implement drag handlers:

   ```typescript
   function onDragOver(event: DragEvent, node: ITreeNode): void {
     // Only allow drop on projects and directories
     if (node.type !== 'project' && node.type !== 'directory' && node.type !== 'folder') {
       return;
     }

     // Check if dragging files from outside the app
     if (event.dataTransfer?.types.includes('Files')) {
       event.dataTransfer.dropEffect = 'copy';
       dropTargetNode.value = node.id;
     }
   }

   function onDragLeave(event: DragEvent, node: ITreeNode): void {
     // Only clear if leaving the node (not entering a child)
     const relatedTarget = event.relatedTarget as HTMLElement;
     if (!relatedTarget?.closest(`[data-node-id="${node.id}"]`)) {
       dropTargetNode.value = null;
     }
   }

   async function onDrop(event: DragEvent, node: ITreeNode): Promise<void> {
     dropTargetNode.value = null;

     const targetDir = node.filePath;
     if (!targetDir) return;

     const files = event.dataTransfer?.files;
     if (!files || files.length === 0) return;

     $q.loading.show({ message: 'Copying files...' });

     try {
       for (const file of Array.from(files)) {
         // file.path contains the full path (Electron-specific)
         const filePath = (file as any).path;

         // Check if it's a directory
         const stats = await window.fileSystemAPI.getStats(filePath);

         if (stats.isDirectory) {
           await window.fileSystemAPI.copyDirectory(filePath, targetDir);
         } else {
           await window.fileSystemAPI.copyFile(filePath, targetDir);
         }
       }

       await refreshTree();

       $q.notify({
         type: 'positive',
         message: `${files.length} item(s) added`,
       });
     } catch (error) {
       showError('Failed to copy some files');
     } finally {
       $q.loading.hide();
     }
   }
   ```

4. Add CSS for drop target visual feedback:

   ```scss
   .drop-target-active {
     background-color: rgba(var(--q-primary-rgb), 0.2);
     border: 2px dashed var(--q-primary);
     border-radius: 4px;
   }
   ```

5. Add getStats to fileSystemAPI if not exists

6. Ensure the drop works for both single files and multiple files

```

---

### Task 15: Update EditorPane to Use FileViewer

**Purpose:**
Modify EditorPane to render the appropriate viewer based on file category instead of always showing MonacoEditor.

**Objective:**
Update `src/components/layout/EditorPane.vue` to:
- Check the active tab's fileCategory
- Render MonacoEditor for markdown files
- Render FileViewer for all other file types

**Architecture Description:**
EditorPane becomes the decision point for which viewer to show. It uses a v-if/v-else structure to either show MonacoEditor (for markdown) or FileViewer (for everything else).

**Full Prompt:**
```

Update EditorPane to support different file type viewers.

## File to Modify

`src/components/layout/EditorPane.vue`

## Requirements

1. Import FileViewer and FileCategory:

   ```typescript
   import FileViewer from '@/components/viewers/FileViewer.vue';
   import { FileCategory } from '@services/file-system/file-types';
   ```

2. Add computed property to check if active tab is markdown:

   ```typescript
   const isMarkdownFile = computed(() => {
     return activeTab.value?.fileCategory === FileCategory.MARKDOWN;
   });
   ```

3. Update template to conditionally render:

   ```vue
   <template>
     <div class="editor-pane">
       <TabBar ... />

       <div class="editor-pane__content">
         <!-- Monaco Editor for Markdown files -->
         <MonacoEditor
           v-if="isMarkdownFile && activeTab"
           :file-path="activeTab.filePath"
           ...
         />

         <!-- FileViewer for other file types -->
         <FileViewer
           v-else-if="activeTab"
           :file-path="activeTab.filePath"
           :file-name="activeTab.fileName"
           :file-category="activeTab.fileCategory"
         />

         <!-- Empty state when no tab is open -->
         <div
           v-else
           class="editor-pane__empty"
         >
           ...
         </div>
       </div>
     </div>
   </template>
   ```

4. Ensure FileViewer has same sizing/positioning as MonacoEditor

5. Handle the case where fileCategory is undefined (legacy tabs) - default to MARKDOWN

```

---

### Task 16: Update openFile Function to Detect File Types

**Purpose:**
Modify the openFile function in ExplorerPanel to detect file categories and pass them when opening tabs.

**Objective:**
Update `src/components/layout/sidebar/ExplorerPanel.vue` openFile function to:
- Detect file category using the file-types service
- Pass fileCategory and mimeType when calling uiStore.openTab
- Handle non-markdown files appropriately

**Architecture Description:**
The openFile function is the entry point for opening files from the explorer. By adding file type detection here, we ensure all files are opened with proper category information.

**Full Prompt:**
```

Update openFile function to detect and pass file type information.

## File to Modify

`src/components/layout/sidebar/ExplorerPanel.vue`

## Requirements

1. Import file type utilities:

   ```typescript
   import { getFileCategory, getMimeType, FileCategory } from '@services/file-system/file-types';
   ```

2. Update openFile function:

   ```typescript
   async function openFile(node: ITreeNode): Promise<void> {
     if (!node.filePath) return;

     try {
       const fileCategory = getFileCategory(node.filePath);
       const mimeType = getMimeType(node.filePath);

       if (fileCategory === FileCategory.MARKDOWN) {
         // Existing logic for prompts/snippets
         if (node.type === 'prompt') {
           const prompt = await promptStore.loadPrompt(node.filePath);
           uiStore.openTab({
             filePath: prompt.filePath,
             fileName: prompt.fileName,
             title: prompt.metadata.title || prompt.fileName.replace('.md', ''),
             isDirty: false,
             isPinned: false,
             fileCategory: FileCategory.MARKDOWN,
           });
         } else if (node.type === 'snippet') {
           // Similar for snippets
         }
       } else {
         // Non-markdown files - open directly without loading content
         const fileName = node.filePath.split('/').pop() || 'Unknown';
         const title = fileName;

         uiStore.openTab({
           filePath: node.filePath,
           fileName: fileName,
           title: title,
           isDirty: false,
           isPinned: false,
           fileCategory: fileCategory,
           mimeType: mimeType,
         });
       }
     } catch (err) {
       console.error('Failed to open file:', err);
       showError('Failed to open file');
     }
   }
   ```

3. Update the tree building to include non-markdown files:
   - Currently only .md files are shown
   - Update the filter to show all files in projects/directories
   - Use appropriate icons based on file type

4. Add helper to get icon for file type:
   ```typescript
   function getIconForNode(node: ITreeNode): string {
     if (node.filePath) {
       return getIconForFile(node.filePath); // from file-types service
     }
     return 'folder';
   }
   ```

```

---

### Task 17: Testing and Polish

**Purpose:**
Test all implemented features and fix any issues.

**Objective:**
Create a testing checklist and verify:
- All file types open correctly
- Viewers display properly
- Context menus work
- Drag-and-drop works
- External app integration works
- Error handling works

**Architecture Description:**
This is a verification and polish task, not new feature development.

**Full Prompt:**
```

Test and polish the file type viewing implementation.

## Testing Checklist

### File Type Detection

- [ ] .md files → MonacoEditor
- [ ] .jpg, .png, .gif → ImageViewer
- [ ] .mp4, .webm → VideoPlayer
- [ ] .mp3, .wav → AudioPlayer
- [ ] .doc, .docx, .pdf → DocumentViewer
- [ ] .xls, .xlsx, .csv → SpreadsheetViewer
- [ ] .zip, .exe, .unknown → FallbackViewer

### ImageViewer

- [ ] Images display correctly
- [ ] Zoom in/out works
- [ ] Fit to window works
- [ ] Pan when zoomed works
- [ ] Transparent images show checkerboard
- [ ] Large images don't break layout

### VideoPlayer

- [ ] Videos play correctly
- [ ] Play/pause works
- [ ] Seek works
- [ ] Volume control works
- [ ] Fullscreen works
- [ ] Unsupported formats show error

### AudioPlayer

- [ ] Audio plays correctly
- [ ] Play/pause works
- [ ] Seek works
- [ ] Volume control works
- [ ] Time display is accurate

### Document/Spreadsheet Viewers

- [ ] Icons display correctly
- [ ] File info is accurate
- [ ] "Show in Finder" works
- [ ] "Open with Default" works
- [ ] External app buttons work (if apps installed)

### Explorer Enhancements

- [ ] "Add File..." appears in context menu
- [ ] "Add Folder..." appears in context menu
- [ ] File dialog opens correctly
- [ ] Files copy to correct location
- [ ] Folders copy recursively
- [ ] Tree refreshes after adding
- [ ] Drag-and-drop visual feedback works
- [ ] Dropping files copies them
- [ ] Dropping folders copies them

### Edge Cases

- [ ] Files with spaces in names
- [ ] Files with special characters
- [ ] Very large files
- [ ] Read-only files
- [ ] Missing files (deleted while tab open)
- [ ] Network paths (if applicable)

### Dark Mode

- [ ] All viewers look good in dark mode
- [ ] All viewers look good in light mode

### Performance

- [ ] Large images don't freeze UI
- [ ] Video playback is smooth
- [ ] Tree doesn't lag with many files

## Fixes to Apply

Document any issues found and fix them.

```

---

## Appendix: File Extension Reference

### Image Extensions
`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`, `.bmp`, `.ico`, `.tiff`, `.tif`

### Video Extensions
`.mp4`, `.webm`, `.mov`, `.avi`, `.mkv`, `.m4v`, `.wmv`, `.flv`

### Audio Extensions
`.mp3`, `.wav`, `.ogg`, `.flac`, `.aac`, `.m4a`, `.wma`, `.opus`

### Document Extensions
`.doc`, `.docx`, `.odt`, `.rtf`, `.pdf`, `.pages`, `.tex`

### Spreadsheet Extensions
`.xls`, `.xlsx`, `.ods`, `.csv`, `.numbers`, `.tsv`

### Archive Extensions (Fallback)
`.zip`, `.rar`, `.7z`, `.tar`, `.gz`, `.bz2`

### Code Extensions (Could use Monaco)
`.js`, `.ts`, `.py`, `.java`, `.cpp`, `.c`, `.h`, `.css`, `.html`, `.json`, `.xml`, `.yaml`, `.yml`
```
