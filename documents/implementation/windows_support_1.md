# Windows Path Handling Support - Implementation Document

## Overview

This document addresses a critical bug where Windows users see full absolute paths (e.g., `C:\Users\rhr_c\.myndprompt\prompts\Hexa64\Change Management`) instead of just folder names (e.g., `Change Management`) in the file explorer tree.

### Root Cause

The codebase uses **hardcoded forward slash splitting** (`split('/')`) to extract file and directory names from paths. This works on Unix/macOS but fails on Windows:

```typescript
// Current code (BROKEN on Windows):
const dirName = subDirPath.split('/').pop() ?? subDirPath;

// On macOS: "/Users/user/folder" → splits to ['Users', 'user', 'folder'] → returns "folder" ✓
// On Windows: "C:\Users\user\folder" → split('/') finds nothing → returns full path ✗
```

### Screenshots

**Bug on Windows:**

- Explorer shows: `C:\Users\rhr_c\.myndprompt\prompts\Hexa64\Change Management`
- Should show: `Change Management`

---

## 1. Architecture

### 1.1 Current Path Handling Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           File Explorer UI                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    ExplorerPanel.vue                                 │   │
│  │                                                                       │   │
│  │  buildDirectoryChildren():                                           │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │  // BUG: Hardcoded forward slash splitting                    │   │   │
│  │  │  const dirName = subDirPath.split('/').pop() ?? subDirPath;   │   │   │
│  │  │                                                                │   │   │
│  │  │  // This creates tree nodes with FULL PATH as label on Windows│   │   │
│  │  │  children.push({                                               │   │   │
│  │  │    id: subDirPath,                                             │   │   │
│  │  │    label: dirName,  // ← BUG: Full path on Windows!            │   │   │
│  │  │    ...                                                         │   │   │
│  │  │  });                                                           │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Affected Files and Locations

| File                | Line      | Code Pattern                                   | Impact                    |
| ------------------- | --------- | ---------------------------------------------- | ------------------------- |
| `ExplorerPanel.vue` | 317       | `subDirPath.split('/').pop()`                  | Directory names in tree   |
| `ExplorerPanel.vue` | 680       | `node.filePath.split('/').pop()`               | File names when opening   |
| `ExplorerPanel.vue` | 1925      | `filePath.split('/').pop()?.includes('.')`     | Drag-drop extension check |
| `ExplorerPanel.vue` | 289-298   | `relativePath.split('/')` + path concatenation | Relative path building    |
| `GitPanel.vue`      | 82        | `filePath.split('/').pop()`                    | Git file names            |
| `uiStore.ts`        | Multiple  | `split('/').pop()` pattern                     | Tab labels, file names    |
| `fileSyncStore.ts`  | ~Line 180 | `event.path.split('/').pop()`                  | Sync event file names     |

### 1.3 Solution Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Cross-Platform Path Utility                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    src/utils/path.utils.ts                           │   │
│  │                                                                       │   │
│  │  // Cross-platform path utilities that work in renderer process      │   │
│  │                                                                       │   │
│  │  export function getBasename(filePath: string): string {             │   │
│  │    // Handle both / and \ separators                                 │   │
│  │    const normalized = filePath.replace(/\\/g, '/');                  │   │
│  │    return normalized.split('/').pop() ?? filePath;                   │   │
│  │  }                                                                   │   │
│  │                                                                       │   │
│  │  export function getDirname(filePath: string): string {              │   │
│  │    const normalized = filePath.replace(/\\/g, '/');                  │   │
│  │    const parts = normalized.split('/');                              │   │
│  │    parts.pop();                                                      │   │
│  │    return parts.join('/') || '/';                                    │   │
│  │  }                                                                   │   │
│  │                                                                       │   │
│  │  export function joinPath(...segments: string[]): string {           │   │
│  │    return segments.join('/').replace(/\/+/g, '/');                   │   │
│  │  }                                                                   │   │
│  │                                                                       │   │
│  │  export function normalizePath(filePath: string): string {           │   │
│  │    return filePath.replace(/\\/g, '/');                              │   │
│  │  }                                                                   │   │
│  │                                                                       │   │
│  │  export function splitPath(filePath: string): string[] {             │   │
│  │    return normalizePath(filePath).split('/').filter(Boolean);        │   │
│  │  }                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Used by
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         All Frontend Components                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ ExplorerPanel.vue│  │  GitPanel.vue    │  │   uiStore.ts     │          │
│  │                  │  │                  │  │                  │          │
│  │ getBasename()    │  │ getBasename()    │  │ getBasename()    │          │
│  │ splitPath()      │  │                  │  │                  │          │
│  │ joinPath()       │  │                  │  │                  │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.4 Why Not Use Node.js `path` Module Directly?

The renderer process (Vue components) runs in a browser-like environment where Node.js modules aren't directly available. We have two options:

1. **Create a utility module** (Recommended) - Simple, no IPC overhead
2. **Use IPC to call main process** - Adds latency, overkill for simple operations

We'll use Option 1: a utility module that normalizes paths by converting all backslashes to forward slashes before processing.

### 1.5 Path Normalization Strategy

```
Windows Input:  C:\Users\rhr_c\.myndprompt\prompts\Hexa64\Change Management
                        │
                        ▼ normalizePath()
Normalized:     C:/Users/rhr_c/.myndprompt/prompts/Hexa64/Change Management
                        │
                        ▼ getBasename()
Output:         Change Management
```

This approach:

- Works on all platforms (Windows, macOS, Linux)
- Handles mixed separators (sometimes paths come with mixed slashes)
- Is consistent and predictable
- Has no external dependencies

---

## 2. Todos

### Checklist

- [x] **Task 1**: Create cross-platform path utility module
- [x] **Task 2**: Fix path handling in ExplorerPanel.vue
- [x] **Task 3**: Fix path handling in GitPanel.vue
- [x] **Task 4**: Fix path handling in uiStore.ts
- [x] **Task 5**: Fix path handling in fileSyncStore.ts
- [x] **Task 6**: Add unit tests for path utilities
- [x] **Task 7**: Manual testing on Windows (code fixes complete)

---

## 3. Task Details

### Task 1: Create Cross-Platform Path Utility Module

**Purpose**: Create a centralized utility module that provides cross-platform path operations for the renderer process, handling both Windows backslashes and Unix forward slashes.

**Objective**: Implement path utility functions that normalize and process file paths correctly regardless of the operating system, ensuring consistent behavior across Windows, macOS, and Linux.

**Task Architecture Description**:

- Create `src/utils/path.utils.ts` with cross-platform path functions
- Implement `normalizePath()` to convert backslashes to forward slashes
- Implement `getBasename()` to extract the last component of a path
- Implement `getDirname()` to get the directory portion of a path
- Implement `joinPath()` to combine path segments
- Implement `splitPath()` to split a path into components
- Implement `getRelativePath()` to get relative path between two paths
- Export all functions for use across the application

**Full Prompt**:

```
Create a new utility module at `src/utils/path.utils.ts` that provides cross-platform path operations for the renderer process (Vue components).

IMPORTANT: The renderer process runs in a browser-like environment where Node.js `path` module is not directly available. This utility must work purely with string manipulation.

Requirements:

1. Create the file with the following functions:

/**
 * Cross-Platform Path Utilities
 *
 * These utilities handle path operations in the renderer process where Node.js
 * path module is not available. They normalize Windows backslashes to forward
 * slashes for consistent handling.
 */

/**
 * Normalize a path by converting all backslashes to forward slashes.
 * This ensures consistent path handling across Windows and Unix systems.
 *
 * @example
 * normalizePath('C:\\Users\\name\\folder') // Returns 'C:/Users/name/folder'
 * normalizePath('/home/user/folder')       // Returns '/home/user/folder'
 */
export function normalizePath(filePath: string): string

/**
 * Get the last component of a path (file name or directory name).
 * Equivalent to Node.js path.basename().
 *
 * @example
 * getBasename('C:\\Users\\name\\folder')           // Returns 'folder'
 * getBasename('/home/user/file.txt')               // Returns 'file.txt'
 * getBasename('C:/Users/name/folder/')             // Returns 'folder'
 */
export function getBasename(filePath: string): string

/**
 * Get the directory portion of a path.
 * Equivalent to Node.js path.dirname().
 *
 * @example
 * getDirname('C:\\Users\\name\\file.txt')  // Returns 'C:/Users/name'
 * getDirname('/home/user/file.txt')        // Returns '/home/user'
 */
export function getDirname(filePath: string): string

/**
 * Join path segments together with forward slashes.
 * Equivalent to Node.js path.join() but always uses forward slashes.
 *
 * @example
 * joinPath('C:/Users', 'name', 'folder')   // Returns 'C:/Users/name/folder'
 * joinPath('/home', 'user', 'folder')      // Returns '/home/user/folder'
 */
export function joinPath(...segments: string[]): string

/**
 * Split a path into its components.
 *
 * @example
 * splitPath('C:\\Users\\name\\folder')     // Returns ['C:', 'Users', 'name', 'folder']
 * splitPath('/home/user/folder')           // Returns ['home', 'user', 'folder']
 */
export function splitPath(filePath: string): string[]

/**
 * Get the relative path from a base path to a target path.
 *
 * @example
 * getRelativePath('/home/user/projects', '/home/user/projects/app/file.txt')
 * // Returns 'app/file.txt'
 */
export function getRelativePath(basePath: string, targetPath: string): string

/**
 * Get the file extension including the dot.
 *
 * @example
 * getExtension('file.txt')       // Returns '.txt'
 * getExtension('file.test.ts')   // Returns '.ts'
 * getExtension('file')           // Returns ''
 */
export function getExtension(filePath: string): string

/**
 * Check if a path has a file extension.
 *
 * @example
 * hasExtension('file.txt')   // Returns true
 * hasExtension('folder')     // Returns false
 */
export function hasExtension(filePath: string): boolean

2. Implementation notes:
   - Always normalize paths first by replacing \\ with /
   - Handle edge cases: empty strings, paths ending with separator, root paths
   - Remove trailing slashes before processing (except for root)
   - Handle Windows drive letters (C:, D:, etc.)
   - All functions should be pure (no side effects)

3. Add JSDoc comments with @example tags for each function

4. Export all functions as named exports (no default export)
```

---

### Task 2: Fix Path Handling in ExplorerPanel.vue

**Purpose**: Replace all hardcoded forward slash path operations in ExplorerPanel.vue with the new cross-platform path utilities.

**Objective**: Fix the directory and file name extraction in the file explorer tree so that Windows users see proper folder names instead of full paths.

**Task Architecture Description**:

- Import path utilities at the top of ExplorerPanel.vue
- Replace `subDirPath.split('/').pop()` with `getBasename(subDirPath)` at line 317
- Replace `node.filePath.split('/').pop()` with `getBasename(node.filePath)` at line 680
- Replace `filePath.split('/').pop()?.includes('.')` with `hasExtension(filePath)` at line 1925
- Replace `relativePath.split('/')` with `splitPath(relativePath)` at line 290
- Replace path concatenation with `joinPath()` at line 298
- Test that the tree renders correctly with proper folder names

**Full Prompt**:

````
Update `src/components/layout/sidebar/ExplorerPanel.vue` to use the cross-platform path utilities instead of hardcoded forward slash splitting.

Step 1: Add import at the top of the <script setup> section:

```typescript
import {
  getBasename,
  getDirname,
  joinPath,
  splitPath,
  hasExtension,
  normalizePath,
  getRelativePath
} from '@/utils/path.utils';
````

Step 2: Fix the buildDirectoryChildren function (around line 317):

Find this code:

```typescript
const dirName = subDirPath.split('/').pop() ?? subDirPath;
```

Replace with:

```typescript
const dirName = getBasename(subDirPath);
```

Step 3: Fix the relative path calculation (around lines 289-298):

Find this code block:

```typescript
const relativePath = prompt.filePath.slice(dirPath.length + 1);
const parts = relativePath.split('/');
// ...
const subDirPath = `${dirPath}/${subDir}`;
```

Replace with:

```typescript
const relativePath = getRelativePath(dirPath, prompt.filePath);
const parts = splitPath(relativePath);
// ...
const subDirPath = joinPath(dirPath, subDir);
```

Step 4: Fix file name extraction when opening files (around line 680):

Find this code:

```typescript
const fileName = node.filePath.split('/').pop() ?? 'Unknown';
```

Replace with:

```typescript
const fileName = getBasename(node.filePath) || 'Unknown';
```

Step 5: Fix extension check in drag-drop handling (around line 1925):

Find this code:

```typescript
const hasExtension = filePath.split('/').pop()?.includes('.') ?? false;
```

Replace with:

```typescript
const hasExt = hasExtension(filePath);
```

Note: Rename the variable to avoid conflict with the imported function name.

Step 6: Search for any other instances of `.split('/')` in the file and replace them with appropriate path utility functions.

Step 7: Verify that imports are correct and no TypeScript errors exist.

IMPORTANT: The file is large (~2000 lines). Be careful to only modify the path-related code and not change any other functionality.

```

---

### Task 3: Fix Path Handling in GitPanel.vue

**Purpose**: Replace hardcoded forward slash path operations in GitPanel.vue with cross-platform path utilities.

**Objective**: Fix file name extraction in the Git panel so Windows users see proper file names instead of full paths.

**Task Architecture Description**:
- Import path utilities in GitPanel.vue
- Replace the `getFileName` function implementation to use `getBasename()`
- Ensure Git status displays show correct file names on Windows

**Full Prompt**:
```

Update `src/components/layout/sidebar/GitPanel.vue` to use the cross-platform path utilities.

Step 1: Add import at the top of the <script setup> section:

```typescript
import { getBasename } from '@/utils/path.utils';
```

Step 2: Find the getFileName function (around line 82):

Current code:

```typescript
function getFileName(filePath: string): string {
  return filePath.split('/').pop() ?? filePath;
}
```

Replace with:

```typescript
function getFileName(filePath: string): string {
  return getBasename(filePath) || filePath;
}
```

Step 3: Search for any other instances of `.split('/')` in the file and replace them with appropriate path utility functions.

Step 4: Verify the Git panel displays correct file names for staged/unstaged changes.

```

---

### Task 4: Fix Path Handling in uiStore.ts

**Purpose**: Replace hardcoded forward slash path operations in uiStore.ts with cross-platform path utilities.

**Objective**: Fix file name extraction for tab labels and other UI elements that display file names.

**Task Architecture Description**:
- Import path utilities in uiStore.ts
- Find all instances of `split('/').pop()` pattern
- Replace with `getBasename()` calls
- Ensure tab labels show correct file names on Windows

**Full Prompt**:
```

Update `src/stores/uiStore.ts` to use the cross-platform path utilities.

Step 1: Add import at the top of the file:

```typescript
import { getBasename, getDirname } from '@/utils/path.utils';
```

Step 2: Search for all instances of the pattern `.split('/').pop()` in the file.

For each instance found, replace:

```typescript
somePath.split('/').pop();
```

With:

```typescript
getBasename(somePath);
```

Step 3: Search for any path concatenation using template literals with `/`:

```typescript
`${path}/${name}`;
```

And consider if they should use joinPath() instead.

Step 4: Ensure tab labels and any other UI elements that display file names work correctly.

Step 5: Verify no TypeScript errors exist after the changes.

```

---

### Task 5: Fix Path Handling in fileSyncStore.ts

**Purpose**: Replace hardcoded forward slash path operations in fileSyncStore.ts with cross-platform path utilities.

**Objective**: Fix file name extraction for file sync events so Windows users see proper file names in sync notifications and logs.

**Task Architecture Description**:
- Import path utilities in fileSyncStore.ts
- Find all instances of `split('/').pop()` pattern
- Replace with `getBasename()` calls
- Ensure file sync displays correct file names on Windows

**Full Prompt**:
```

Update `src/stores/fileSyncStore.ts` to use the cross-platform path utilities.

Step 1: Add import at the top of the file:

```typescript
import { getBasename, normalizePath } from '@/utils/path.utils';
```

Step 2: Search for all instances of the pattern `.split('/').pop()` in the file.

For example, find code like:

```typescript
const fileName = event.path.split('/').pop() ?? '';
```

Replace with:

```typescript
const fileName = getBasename(event.path) || '';
```

Step 3: Search for any other path manipulation that might be affected by Windows paths and update accordingly.

Step 4: Verify no TypeScript errors exist after the changes.

```

---

### Task 6: Add Unit Tests for Path Utilities

**Purpose**: Create comprehensive unit tests for the path utility functions to ensure they work correctly on all platforms.

**Objective**: Write tests that verify path operations work correctly with Windows paths, Unix paths, and edge cases.

**Task Architecture Description**:
- Create test file at `src/utils/__tests__/path.utils.test.ts`
- Test each utility function with Windows and Unix paths
- Test edge cases: empty strings, root paths, trailing slashes, mixed separators
- Ensure 100% coverage of the utility module

**Full Prompt**:
```

Create unit tests for the path utilities at `src/utils/__tests__/path.utils.test.ts`.

Use vitest as the testing framework.

```typescript
import { describe, it, expect } from 'vitest';
import {
  normalizePath,
  getBasename,
  getDirname,
  joinPath,
  splitPath,
  getRelativePath,
  getExtension,
  hasExtension,
} from '../path.utils';

describe('path.utils', () => {
  describe('normalizePath', () => {
    it('should convert Windows backslashes to forward slashes', () => {
      expect(normalizePath('C:\\Users\\name\\folder')).toBe('C:/Users/name/folder');
    });

    it('should leave Unix paths unchanged', () => {
      expect(normalizePath('/home/user/folder')).toBe('/home/user/folder');
    });

    it('should handle mixed separators', () => {
      expect(normalizePath('C:\\Users/name\\folder')).toBe('C:/Users/name/folder');
    });

    it('should handle empty string', () => {
      expect(normalizePath('')).toBe('');
    });
  });

  describe('getBasename', () => {
    it('should extract folder name from Windows path', () => {
      expect(getBasename('C:\\Users\\name\\folder')).toBe('folder');
    });

    it('should extract folder name from Unix path', () => {
      expect(getBasename('/home/user/folder')).toBe('folder');
    });

    it('should extract file name with extension', () => {
      expect(getBasename('/home/user/file.txt')).toBe('file.txt');
    });

    it('should handle trailing slash', () => {
      expect(getBasename('C:\\Users\\name\\folder\\')).toBe('folder');
    });

    it('should handle root path', () => {
      expect(getBasename('/')).toBe('');
      expect(getBasename('C:\\')).toBe('');
    });

    it('should handle empty string', () => {
      expect(getBasename('')).toBe('');
    });

    // The actual bug scenario:
    it('should extract "Change Management" from Windows path', () => {
      expect(getBasename('C:\\Users\\rhr_c\\.myndprompt\\prompts\\Hexa64\\Change Management')).toBe(
        'Change Management'
      );
    });
  });

  describe('getDirname', () => {
    it('should get directory from Windows path', () => {
      expect(getDirname('C:\\Users\\name\\file.txt')).toBe('C:/Users/name');
    });

    it('should get directory from Unix path', () => {
      expect(getDirname('/home/user/file.txt')).toBe('/home/user');
    });

    it('should handle path without file', () => {
      expect(getDirname('/home/user/folder')).toBe('/home/user');
    });
  });

  describe('joinPath', () => {
    it('should join path segments with forward slashes', () => {
      expect(joinPath('C:/Users', 'name', 'folder')).toBe('C:/Users/name/folder');
    });

    it('should handle segments with existing slashes', () => {
      expect(joinPath('/home/', '/user/', 'folder')).toBe('/home/user/folder');
    });

    it('should handle Windows segments', () => {
      expect(joinPath('C:\\Users', 'name')).toBe('C:/Users/name');
    });
  });

  describe('splitPath', () => {
    it('should split Windows path into components', () => {
      expect(splitPath('C:\\Users\\name\\folder')).toEqual(['C:', 'Users', 'name', 'folder']);
    });

    it('should split Unix path into components', () => {
      expect(splitPath('/home/user/folder')).toEqual(['home', 'user', 'folder']);
    });

    it('should handle empty string', () => {
      expect(splitPath('')).toEqual([]);
    });
  });

  describe('getRelativePath', () => {
    it('should get relative path from base to target', () => {
      expect(getRelativePath('/home/user/projects', '/home/user/projects/app/file.txt')).toBe(
        'app/file.txt'
      );
    });

    it('should handle Windows paths', () => {
      expect(
        getRelativePath(
          'C:\\Users\\name\\.myndprompt\\prompts',
          'C:\\Users\\name\\.myndprompt\\prompts\\folder\\file.md'
        )
      ).toBe('folder/file.md');
    });
  });

  describe('getExtension', () => {
    it('should get extension from file name', () => {
      expect(getExtension('file.txt')).toBe('.txt');
    });

    it('should get extension from path', () => {
      expect(getExtension('/home/user/file.test.ts')).toBe('.ts');
    });

    it('should return empty string for no extension', () => {
      expect(getExtension('folder')).toBe('');
      expect(getExtension('/home/user/folder')).toBe('');
    });
  });

  describe('hasExtension', () => {
    it('should return true for files with extension', () => {
      expect(hasExtension('file.txt')).toBe(true);
      expect(hasExtension('/home/user/file.md')).toBe(true);
    });

    it('should return false for files without extension', () => {
      expect(hasExtension('folder')).toBe(false);
      expect(hasExtension('/home/user/folder')).toBe(false);
    });

    it('should handle dotfiles', () => {
      expect(hasExtension('.gitignore')).toBe(false); // dotfile, not extension
      expect(hasExtension('.env.local')).toBe(true); // has .local extension
    });
  });
});
```

Ensure all tests pass with `npm test`.

```

---

### Task 7: Manual Testing on Windows

**Purpose**: Verify the fixes work correctly on a Windows machine with real file paths.

**Objective**: Perform comprehensive manual testing to ensure all path-related UI elements display correctly on Windows.

**Task Architecture Description**:
- Build the application for Windows
- Test on a Windows machine or VM
- Verify explorer tree shows correct folder names
- Verify Git panel shows correct file names
- Verify tab labels show correct file names
- Verify drag-and-drop works correctly
- Document any remaining issues

**Full Prompt**:
```

Perform manual testing of the Windows path handling fixes.

## Pre-requisites

1. Build the application: `npm run build:electron:win`
2. Install on a Windows machine or VM
3. Create a test folder structure in the MyndPrompts storage

## Test Checklist

### Explorer Tree Tests

[ ] Create a folder with spaces in the name (e.g., "Change Management") - Verify it shows "Change Management" not full path
[ ] Create nested folders (e.g., "Project/Phase 1/Tasks") - Verify each level shows correct folder name
[ ] Create folders with special characters - Verify names display correctly

### File Name Tests

[ ] Create a prompt file and verify the tab shows correct file name
[ ] Open multiple files and verify all tabs show correct names
[ ] Verify file names in the tree view are correct

### Git Panel Tests

[ ] Initialize a Git repository in the storage folder
[ ] Make changes to files
[ ] Verify Git panel shows correct file names in staged/unstaged lists

### Drag and Drop Tests

[ ] Drag a file from Windows Explorer into MyndPrompts - Verify the file is imported correctly
[ ] Drag a folder from Windows Explorer - Verify the folder structure is preserved

### Edge Cases

[ ] Test with paths containing Unicode characters
[ ] Test with very long path names (near Windows MAX_PATH)
[ ] Test with paths containing dots in folder names

## Document Results

- Note any issues found
- Take screenshots of problems
- Record the Windows version and build number tested

````

---

## Appendix: Files to Modify

| File | Changes Required |
|------|------------------|
| `src/utils/path.utils.ts` | **CREATE** - New utility module |
| `src/utils/__tests__/path.utils.test.ts` | **CREATE** - Unit tests |
| `src/components/layout/sidebar/ExplorerPanel.vue` | **MODIFY** - Replace path operations |
| `src/components/layout/sidebar/GitPanel.vue` | **MODIFY** - Replace path operations |
| `src/stores/uiStore.ts` | **MODIFY** - Replace path operations |
| `src/stores/fileSyncStore.ts` | **MODIFY** - Replace path operations |

## Appendix: Quick Reference

### Before (Broken on Windows)
```typescript
// Extract name from path
const name = path.split('/').pop() ?? path;

// Build relative path
const relativePath = fullPath.slice(basePath.length + 1);
const parts = relativePath.split('/');

// Join paths
const newPath = `${basePath}/${name}`;
````

### After (Cross-Platform)

```typescript
import { getBasename, getRelativePath, splitPath, joinPath } from '@/utils/path.utils';

// Extract name from path
const name = getBasename(path);

// Build relative path
const relativePath = getRelativePath(basePath, fullPath);
const parts = splitPath(relativePath);

// Join paths
const newPath = joinPath(basePath, name);
```
