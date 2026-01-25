/**
 * Cross-Platform Path Utilities
 *
 * These utilities handle path operations in the renderer process where Node.js
 * path module is not directly available. They normalize Windows backslashes to
 * forward slashes for consistent handling across all platforms.
 *
 * Why this exists:
 * - The renderer process runs in a browser-like environment
 * - Node.js `path` module is not directly available
 * - Windows uses backslashes (\) while Unix uses forward slashes (/)
 * - Hardcoded split('/') breaks on Windows paths
 */

/**
 * Normalize a path by converting all backslashes to forward slashes.
 * This ensures consistent path handling across Windows and Unix systems.
 *
 * @param filePath - The path to normalize
 * @returns The normalized path with forward slashes
 *
 * @example
 * normalizePath('C:\\Users\\name\\folder') // Returns 'C:/Users/name/folder'
 * normalizePath('/home/user/folder')       // Returns '/home/user/folder'
 * normalizePath('C:\\Users/name\\folder')  // Returns 'C:/Users/name/folder' (mixed)
 */
export function normalizePath(filePath: string): string {
  if (!filePath) return '';
  return filePath.replace(/\\/g, '/');
}

/**
 * Remove trailing slashes from a path (except for root paths).
 *
 * @param filePath - The path to process
 * @returns The path without trailing slashes
 */
function removeTrailingSlash(filePath: string): string {
  if (!filePath) return '';
  // Keep root paths intact (/, C:/)
  if (filePath === '/' || /^[A-Za-z]:\/?$/.test(filePath)) {
    return filePath.replace(/\/$/, '');
  }
  return filePath.replace(/\/+$/, '');
}

/**
 * Get the last component of a path (file name or directory name).
 * Equivalent to Node.js path.basename().
 *
 * @param filePath - The path to extract the basename from
 * @returns The last component of the path
 *
 * @example
 * getBasename('C:\\Users\\name\\folder')           // Returns 'folder'
 * getBasename('/home/user/file.txt')               // Returns 'file.txt'
 * getBasename('C:/Users/name/folder/')             // Returns 'folder'
 * getBasename('/')                                 // Returns ''
 * getBasename('C:\\')                              // Returns ''
 * getBasename('C:\\Users\\rhr_c\\.myndprompt\\prompts\\Hexa64\\Change Management')
 *   // Returns 'Change Management'
 */
export function getBasename(filePath: string): string {
  if (!filePath) return '';

  const normalized = removeTrailingSlash(normalizePath(filePath));

  // Handle root paths
  if (normalized === '' || normalized === '/' || /^[A-Za-z]:$/.test(normalized)) {
    return '';
  }

  const parts = normalized.split('/');
  const lastPart = parts[parts.length - 1];
  return lastPart !== undefined && lastPart !== '' ? lastPart : '';
}

/**
 * Get the directory portion of a path.
 * Equivalent to Node.js path.dirname().
 *
 * @param filePath - The path to get the directory from
 * @returns The directory portion of the path
 *
 * @example
 * getDirname('C:\\Users\\name\\file.txt')  // Returns 'C:/Users/name'
 * getDirname('/home/user/file.txt')        // Returns '/home/user'
 * getDirname('/home/user/folder')          // Returns '/home/user'
 * getDirname('/file.txt')                  // Returns '/'
 * getDirname('C:\\file.txt')               // Returns 'C:'
 */
export function getDirname(filePath: string): string {
  if (!filePath) return '';

  const normalized = removeTrailingSlash(normalizePath(filePath));

  // Handle root paths
  if (normalized === '/' || /^[A-Za-z]:$/.test(normalized)) {
    return normalized;
  }

  const lastSlashIndex = normalized.lastIndexOf('/');

  if (lastSlashIndex === -1) {
    // No slash found, return empty or current directory indicator
    return '';
  }

  if (lastSlashIndex === 0) {
    // Root directory on Unix
    return '/';
  }

  // Check for Windows drive letter (C:/)
  if (lastSlashIndex === 2 && /^[A-Za-z]:/.test(normalized)) {
    return normalized.substring(0, 2);
  }

  return normalized.substring(0, lastSlashIndex);
}

/**
 * Join path segments together with forward slashes.
 * Equivalent to Node.js path.join() but always uses forward slashes.
 *
 * @param segments - The path segments to join
 * @returns The joined path with forward slashes
 *
 * @example
 * joinPath('C:/Users', 'name', 'folder')   // Returns 'C:/Users/name/folder'
 * joinPath('/home/', '/user/', 'folder')   // Returns '/home/user/folder'
 * joinPath('C:\\Users', 'name')            // Returns 'C:/Users/name'
 */
export function joinPath(...segments: string[]): string {
  if (segments.length === 0) return '';

  // Normalize all segments and filter empty ones
  const normalizedSegments = segments
    .map((segment) => normalizePath(segment))
    .filter((segment) => segment !== '');

  if (normalizedSegments.length === 0) return '';

  // Join with forward slashes and clean up multiple slashes
  const joined = normalizedSegments.join('/');

  // Replace multiple consecutive slashes with single slash (except after protocol like file://)
  return joined.replace(/([^:])\/+/g, '$1/');
}

/**
 * Split a path into its components.
 *
 * @param filePath - The path to split
 * @returns An array of path components
 *
 * @example
 * splitPath('C:\\Users\\name\\folder')     // Returns ['C:', 'Users', 'name', 'folder']
 * splitPath('/home/user/folder')           // Returns ['home', 'user', 'folder']
 * splitPath('')                            // Returns []
 */
export function splitPath(filePath: string): string[] {
  if (!filePath) return [];

  const normalized = normalizePath(filePath);
  const parts = normalized.split('/').filter((part) => part !== '');

  return parts;
}

/**
 * Get the relative path from a base path to a target path.
 *
 * @param basePath - The base path
 * @param targetPath - The target path
 * @returns The relative path from base to target
 *
 * @example
 * getRelativePath('/home/user/projects', '/home/user/projects/app/file.txt')
 *   // Returns 'app/file.txt'
 * getRelativePath(
 *   'C:\\Users\\name\\.myndprompt\\prompts',
 *   'C:\\Users\\name\\.myndprompt\\prompts\\folder\\file.md'
 * )
 *   // Returns 'folder/file.md'
 */
export function getRelativePath(basePath: string, targetPath: string): string {
  if (!basePath || !targetPath) return targetPath || '';

  const normalizedBase = removeTrailingSlash(normalizePath(basePath));
  const normalizedTarget = normalizePath(targetPath);

  // Check if target starts with base
  if (!normalizedTarget.startsWith(normalizedBase)) {
    return normalizedTarget;
  }

  // Remove base path and leading slash
  let relative = normalizedTarget.slice(normalizedBase.length);
  if (relative.startsWith('/')) {
    relative = relative.slice(1);
  }

  return relative;
}

/**
 * Get the file extension including the dot.
 *
 * @param filePath - The path or filename to get the extension from
 * @returns The extension including the dot, or empty string if none
 *
 * @example
 * getExtension('file.txt')       // Returns '.txt'
 * getExtension('file.test.ts')   // Returns '.ts'
 * getExtension('file')           // Returns ''
 * getExtension('.gitignore')     // Returns '' (dotfile, not extension)
 * getExtension('.env.local')     // Returns '.local'
 */
export function getExtension(filePath: string): string {
  if (!filePath) return '';

  const basename = getBasename(filePath);
  if (!basename) return '';

  // Handle dotfiles (files starting with dot but no other dot)
  if (basename.startsWith('.') && basename.indexOf('.', 1) === -1) {
    return '';
  }

  const lastDotIndex = basename.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === 0) {
    return '';
  }

  return basename.slice(lastDotIndex);
}

/**
 * Check if a path has a file extension.
 *
 * @param filePath - The path or filename to check
 * @returns True if the path has an extension, false otherwise
 *
 * @example
 * hasExtension('file.txt')       // Returns true
 * hasExtension('folder')         // Returns false
 * hasExtension('.gitignore')     // Returns false (dotfile)
 * hasExtension('.env.local')     // Returns true
 */
export function hasExtension(filePath: string): boolean {
  return getExtension(filePath) !== '';
}

/**
 * Check if two paths are equal after normalization.
 *
 * @param path1 - First path
 * @param path2 - Second path
 * @returns True if paths are equal after normalization
 *
 * @example
 * pathsEqual('C:\\Users\\name', 'C:/Users/name')  // Returns true
 * pathsEqual('/home/user/', '/home/user')         // Returns true
 */
export function pathsEqual(path1: string, path2: string): boolean {
  const normalized1 = removeTrailingSlash(normalizePath(path1));
  const normalized2 = removeTrailingSlash(normalizePath(path2));
  return normalized1 === normalized2;
}

/**
 * Check if a path is a child of another path.
 *
 * @param parentPath - The potential parent path
 * @param childPath - The potential child path
 * @returns True if childPath is under parentPath
 *
 * @example
 * isChildPath('/home/user', '/home/user/file.txt')     // Returns true
 * isChildPath('/home/user', '/home/other/file.txt')    // Returns false
 * isChildPath('C:\\Users', 'C:\\Users\\name\\file')    // Returns true
 */
export function isChildPath(parentPath: string, childPath: string): boolean {
  const normalizedParent = removeTrailingSlash(normalizePath(parentPath));
  const normalizedChild = normalizePath(childPath);

  if (!normalizedParent || !normalizedChild) return false;

  // Child must start with parent path followed by a slash
  return normalizedChild.startsWith(normalizedParent + '/') || normalizedChild === normalizedParent;
}
