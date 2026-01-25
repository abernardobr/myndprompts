/**
 * Project Store
 *
 * Pinia store for managing projects and directories.
 * Projects are directories in the prompts folder with metadata stored in IndexedDB.
 */

import { defineStore } from 'pinia';
import { ref, computed, shallowRef } from 'vue';
import { getPromptFileService } from '@/services/file-system';
import { getProjectRepository } from '@/services/storage';
import type { IProject } from '@/services/storage';
import type { IDirectoryInfo, IDirectoryContentsCount } from '@/services/file-system/types';
import { splitPath, joinPath, getRelativePath } from '@/utils/path.utils';

export const useProjectStore = defineStore('projects', () => {
  // Check if running in Electron environment
  const isElectron = () => typeof window !== 'undefined' && !!window.fileSystemAPI;

  // Services
  const fileService = getPromptFileService();
  const projectRepository = getProjectRepository();

  // State
  const isInitialized = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // All projects (from IndexedDB)
  const allProjects = ref<IProject[]>([]);

  // Directory tree cache (using shallowRef for Map)
  const directoryTreeCache = shallowRef<Map<string, IDirectoryInfo>>(new Map());

  // Expanded directory paths (for UI)
  const expandedDirectories = ref<Set<string>>(new Set());

  // Computed: project paths for quick lookup
  const projectPaths = computed(() => new Set(allProjects.value.map((p) => p.folderPath)));

  /**
   * Initialize the store
   */
  async function initialize(): Promise<void> {
    if (isInitialized.value) return;

    try {
      isLoading.value = true;
      error.value = null;

      await refreshProjects();

      isInitialized.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to initialize project store';
      console.error('Failed to initialize project store:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Refresh the list of all projects
   * Also syncs projects from file system (creates entries for directories not in IndexedDB)
   */
  async function refreshProjects(): Promise<void> {
    try {
      isLoading.value = true;

      // First sync projects from file system
      await syncProjectsFromFileSystem();

      // Then load all projects from IndexedDB
      allProjects.value = await projectRepository.getAllProjects();
    } catch (err) {
      console.error('Failed to refresh projects:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Sync projects from file system
   * Creates project entries for directories in prompts folder that aren't in IndexedDB
   */
  async function syncProjectsFromFileSystem(): Promise<void> {
    if (!isElectron()) return;

    try {
      // Get the prompts directory path
      const config = await window.fileSystemAPI.getConfig();
      const promptsDir = config.promptsDir;

      // Read the prompts directory
      const dirListing = await window.fileSystemAPI.readDirectory(promptsDir);

      // Get existing project paths from IndexedDB
      const existingProjects = await projectRepository.getAllProjects();
      const existingPaths = new Set(existingProjects.map((p) => p.folderPath));

      // Find directories that aren't tracked as projects
      for (const dir of dirListing.directories) {
        const fullPath = dir.path;

        if (!existingPaths.has(fullPath)) {
          // Create a project entry for this directory
          console.log(`Auto-creating project for directory: ${dir.name}`);
          await projectRepository.createProject(fullPath, dir.name);
        }
      }
    } catch (err) {
      console.error('Failed to sync projects from file system:', err);
      // Don't throw - this is a best-effort sync
    }
  }

  /**
   * Create a new project
   */
  async function createProject(name: string, description?: string): Promise<IProject> {
    if (!isElectron()) {
      throw new Error('Creating projects is only available in the desktop app');
    }

    try {
      isLoading.value = true;
      error.value = null;

      // Create the directory on the file system
      const folderPath = await fileService.createProjectDirectory(name);

      // Create the project entry in IndexedDB
      const project = await projectRepository.createProject(folderPath, name, description);

      // Refresh projects list
      await refreshProjects();

      return project;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create project';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Delete a project
   */
  async function deleteProject(folderPath: string, deleteFiles: boolean = true): Promise<void> {
    if (!isElectron()) {
      throw new Error('Deleting projects is only available in the desktop app');
    }

    try {
      isLoading.value = true;
      error.value = null;

      // Delete from IndexedDB first
      await projectRepository.deleteProject(folderPath);

      // Delete the directory if requested
      if (deleteFiles) {
        await fileService.deleteDirectory(folderPath, true);
      }

      // Clear from cache
      const newCache = new Map(directoryTreeCache.value);
      newCache.delete(folderPath);
      directoryTreeCache.value = newCache;

      // Refresh projects list
      await refreshProjects();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete project';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Rename a project
   */
  async function renameProject(folderPath: string, newName: string): Promise<IProject> {
    if (!isElectron()) {
      throw new Error('Renaming projects is only available in the desktop app');
    }

    try {
      isLoading.value = true;
      error.value = null;

      // Rename the directory on the file system
      const newPath = await fileService.renameDirectory(folderPath, newName);

      // Update project in IndexedDB
      const updatedProject = await projectRepository.updateProjectPath(
        folderPath,
        newPath,
        newName
      );

      // Update cache
      const newCache = new Map(directoryTreeCache.value);
      newCache.delete(folderPath);
      directoryTreeCache.value = newCache;

      // Refresh projects list
      await refreshProjects();

      return updatedProject;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to rename project';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Update project metadata
   */
  async function updateProjectMetadata(
    folderPath: string,
    updates: Partial<Omit<IProject, 'id' | 'folderPath' | 'createdAt'>>
  ): Promise<IProject> {
    try {
      isLoading.value = true;
      error.value = null;

      const updatedProject = await projectRepository.updateProject(folderPath, updates);
      await refreshProjects();

      return updatedProject;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update project';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Get a project by folder path
   */
  async function getProject(folderPath: string): Promise<IProject | undefined> {
    return projectRepository.getByFolderPath(folderPath);
  }

  /**
   * Check if a path is a project
   */
  function isProject(folderPath: string): boolean {
    return projectPaths.value.has(folderPath);
  }

  /**
   * Get the project that contains a file path
   */
  function getProjectForPath(filePath: string): IProject | null {
    for (const project of allProjects.value) {
      if (filePath.startsWith(project.folderPath)) {
        return project;
      }
    }
    return null;
  }

  /**
   * Check if a file path is inside any project
   */
  function isPathInProject(filePath: string): boolean {
    return getProjectForPath(filePath) !== null;
  }

  // ================================
  // Directory Operations
  // ================================

  /**
   * Create a directory inside a project or nested directory
   */
  async function createDirectory(parentPath: string, name: string): Promise<string> {
    if (!isElectron()) {
      throw new Error('Creating directories is only available in the desktop app');
    }

    try {
      isLoading.value = true;
      error.value = null;

      const newPath = await fileService.createNestedDirectory(parentPath, name);

      // Clear cache for parent
      invalidateTreeCache(parentPath);

      return newPath;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create directory';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Delete a directory
   */
  async function deleteDirectory(dirPath: string, recursive: boolean = false): Promise<void> {
    if (!isElectron()) {
      throw new Error('Deleting directories is only available in the desktop app');
    }

    try {
      isLoading.value = true;
      error.value = null;

      await fileService.deleteDirectory(dirPath, recursive);

      // Clear cache
      invalidateTreeCache(dirPath);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete directory';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Rename a directory
   */
  async function renameDirectory(dirPath: string, newName: string): Promise<string> {
    if (!isElectron()) {
      throw new Error('Renaming directories is only available in the desktop app');
    }

    try {
      isLoading.value = true;
      error.value = null;

      const newPath = await fileService.renameDirectory(dirPath, newName);

      // Clear cache
      invalidateTreeCache(dirPath);

      return newPath;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to rename directory';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Get directory tree for a path
   */
  async function getDirectoryTree(
    dirPath: string,
    useCache: boolean = true
  ): Promise<IDirectoryInfo> {
    if (!isElectron()) {
      throw new Error('Directory operations are only available in the desktop app');
    }

    // Check cache first
    if (useCache) {
      const cached = directoryTreeCache.value.get(dirPath);
      if (cached) {
        return cached;
      }
    }

    const tree = await fileService.getDirectoryTree(dirPath);

    // Update cache
    const newCache = new Map(directoryTreeCache.value);
    newCache.set(dirPath, tree);
    directoryTreeCache.value = newCache;

    return tree;
  }

  /**
   * Get directory contents count
   */
  async function getDirectoryContentsCount(dirPath: string): Promise<IDirectoryContentsCount> {
    if (!isElectron()) {
      throw new Error('Directory operations are only available in the desktop app');
    }

    return fileService.getDirectoryContentsCount(dirPath);
  }

  /**
   * Check if a directory is empty
   */
  async function isDirectoryEmpty(dirPath: string): Promise<boolean> {
    if (!isElectron()) {
      throw new Error('Directory operations are only available in the desktop app');
    }

    return fileService.isDirectoryEmpty(dirPath);
  }

  /**
   * Check if a directory exists
   */
  async function directoryExists(dirPath: string): Promise<boolean> {
    if (!isElectron()) {
      return false;
    }

    return fileService.directoryExists(dirPath);
  }

  /**
   * Invalidate tree cache for a path and its parents
   */
  function invalidateTreeCache(path: string): void {
    const newCache = new Map<string, IDirectoryInfo>();

    directoryTreeCache.value.forEach((value, key) => {
      // Remove if the key starts with the path or the path starts with the key
      if (!key.startsWith(path) && !path.startsWith(key)) {
        newCache.set(key, value);
      }
    });

    directoryTreeCache.value = newCache;
  }

  /**
   * Clear all tree cache
   */
  function clearTreeCache(): void {
    directoryTreeCache.value = new Map();
  }

  // ================================
  // UI State
  // ================================

  /**
   * Toggle directory expanded state
   */
  function toggleDirectoryExpanded(dirPath: string): void {
    const newSet = new Set(expandedDirectories.value);
    if (newSet.has(dirPath)) {
      newSet.delete(dirPath);
    } else {
      newSet.add(dirPath);
    }
    expandedDirectories.value = newSet;
  }

  /**
   * Check if directory is expanded
   */
  function isDirectoryExpanded(dirPath: string): boolean {
    return expandedDirectories.value.has(dirPath);
  }

  /**
   * Set multiple directories as expanded
   */
  function setDirectoriesExpanded(paths: string[]): void {
    expandedDirectories.value = new Set(paths);
  }

  /**
   * Expand all directories up to a specific path
   */
  function expandToPath(targetPath: string): void {
    const newSet = new Set(expandedDirectories.value);

    // Find all parent paths
    for (const project of allProjects.value) {
      if (targetPath.startsWith(project.folderPath)) {
        // Add project path
        newSet.add(project.folderPath);

        // Add all intermediate paths
        let currentPath = project.folderPath;
        const relativePath = getRelativePath(project.folderPath, targetPath);
        const segments = splitPath(relativePath);

        for (let i = 0; i < segments.length - 1; i++) {
          currentPath = joinPath(currentPath, segments[i]);
          newSet.add(currentPath);
        }
      }
    }

    expandedDirectories.value = newSet;
  }

  /**
   * Clear error state
   */
  function clearError(): void {
    error.value = null;
  }

  return {
    // State
    isInitialized,
    isLoading,
    error,
    allProjects,
    expandedDirectories,

    // Computed
    projectPaths,

    // Project Actions
    initialize,
    refreshProjects,
    createProject,
    deleteProject,
    renameProject,
    updateProjectMetadata,
    getProject,
    isProject,
    getProjectForPath,
    isPathInProject,

    // Directory Actions
    createDirectory,
    deleteDirectory,
    renameDirectory,
    getDirectoryTree,
    getDirectoryContentsCount,
    isDirectoryEmpty,
    directoryExists,
    invalidateTreeCache,
    clearTreeCache,

    // UI State
    toggleDirectoryExpanded,
    isDirectoryExpanded,
    setDirectoriesExpanded,
    expandToPath,

    // Utilities
    clearError,
  };
});
