<script setup lang="ts">
/**
 * ExplorerPanel Component
 *
 * File explorer tree view for browsing and managing prompts, snippets, projects and directories.
 * Supports expanding/collapsing folders, opening files in tabs, context menus, and drag-and-drop.
 */

import { ref, computed, onMounted, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { usePromptStore } from '@/stores/promptStore';
import { useSnippetStore } from '@/stores/snippetStore';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUIStore } from '@/stores/uiStore';
import { useGitStore } from '@/stores/gitStore';
import type { IPromptFile, ISnippetMetadata } from '@/services/file-system/types';
import {
  getFileCategory,
  getMimeType,
  getIconForFile,
  FileCategory,
} from '@services/file-system/file-types';
import NewPromptDialog from '@/components/dialogs/NewPromptDialog.vue';
import NewSnippetDialog from '@/components/dialogs/NewSnippetDialog.vue';
import NewProjectDialog from '@/components/dialogs/NewProjectDialog.vue';
import NewDirectoryDialog from '@/components/dialogs/NewDirectoryDialog.vue';
import DeleteConfirmDialog from '@/components/dialogs/DeleteConfirmDialog.vue';
import RenameDialog from '@/components/dialogs/RenameDialog.vue';
import EditPromptDialog from '@/components/dialogs/EditPromptDialog.vue';
import GitSetupDialog from '@/components/dialogs/GitSetupDialog.vue';
import GitHistoryDialog from '@/components/dialogs/GitHistoryDialog.vue';
import BranchDialog from '@/components/dialogs/BranchDialog.vue';
import FileSyncDialog from '@/components/dialogs/FileSyncDialog.vue';
import ExplorerTreeNode from '@/components/layout/sidebar/ExplorerTreeNode.vue';

const $q = useQuasar();
const { t } = useI18n({ useScope: 'global' });

// Stores
const promptStore = usePromptStore();
const snippetStore = useSnippetStore();
const projectStore = useProjectStore();
const settingsStore = useSettingsStore();
const uiStore = useUIStore();
const gitStore = useGitStore();

// Extract reactive refs from stores for proper reactivity in computed
const { allPrompts } = storeToRefs(promptStore);
const { allSnippets } = storeToRefs(snippetStore);
const { allProjects } = storeToRefs(projectStore);

// Check if running in Electron
const isElectron = computed(() => typeof window !== 'undefined' && !!window.fileSystemAPI);

// Dialog state
const showNewSnippetDialog = ref(false);
const showNewPromptDialog = ref(false);
const showNewProjectDialog = ref(false);
const showNewDirectoryDialog = ref(false);
const showDeleteConfirmDialog = ref(false);
const showRenameDialog = ref(false);
const showEditPromptDialog = ref(false);
const showGitSetupDialog = ref(false);
const showGitHistoryDialog = ref(false);
const showBranchDialog = ref(false);
const showFileSyncDialog = ref(false);
const fileSyncProjectPath = ref('');

// Git context for dialogs
const gitProjectPath = ref('');
const gitProjectName = ref('');

// Dialog context
const renameTarget = ref<{ node: ITreeNode; currentName: string } | null>(null);
const editPromptTarget = ref<{
  node: ITreeNode;
  currentName: string;
  currentCategory?: string;
} | null>(null);
const deleteTarget = ref<{
  node: ITreeNode;
  contentsCount?: { files: number; directories: number };
} | null>(null);
const newDirectoryParent = ref<{ path: string; name: string } | null>(null);
const newPromptDirectory = ref<string | null>(null);

// Search state
const searchQuery = ref('');
const categoryFilter = ref<string | null>(null);

// Expanded folders state
const expandedFolders = ref<Set<string>>(new Set(['prompts']));

// Drag state
const draggedNode = ref<ITreeNode | null>(null);
const dropTarget = ref<ITreeNode | null>(null);

// External file drop state
const externalDropTargetId = ref<string | null>(null);

// Directory structure cache (for showing empty directories)
const directoryStructures = ref<Map<string, string[]>>(new Map());
const directoryStructureVersion = ref(0); // Used to trigger reactivity

// Non-markdown files cache (for showing in tree)
interface INonMarkdownFile {
  path: string;
  name: string;
}
const directoryFiles = ref<Map<string, INonMarkdownFile[]>>(new Map());

// Branch cache per project (projectPath -> branchName)
const projectBranches = ref<Map<string, string>>(new Map());

// File status cache per project (projectPath -> { staged: Set, modified: Set, untracked: Set, tracked: Set })
interface IFileStatusCache {
  staged: Set<string>;
  modified: Set<string>;
  untracked: Set<string>;
  tracked: Set<string>; // Files that have been committed to git (from git ls-files)
}
const projectFileStatuses = ref<Map<string, IFileStatusCache>>(new Map());

// Tree node interface
interface ITreeNode {
  id: string;
  label: string;
  icon: string;
  type: 'folder' | 'prompt' | 'snippet' | 'project' | 'directory' | 'file';
  filePath?: string;
  children?: ITreeNode[];
  snippetType?: ISnippetMetadata['type'];
  count?: number;
  isProject?: boolean;
  parentPath?: string;
  depth?: number;
  isDraggable?: boolean;
  isDropTarget?: boolean;
  category?: string;
}

// Prompts directory path
const promptsDir = ref<string>('');

// Load prompts directory path on mount
onMounted(async () => {
  if (isElectron.value) {
    try {
      const config = await window.fileSystemAPI.getConfig();
      promptsDir.value = config.promptsDir;
    } catch (err) {
      console.warn('Failed to get prompts directory:', err);
    }
  }
});

// Build tree structure
const fileTree = computed<ITreeNode[]>(() => {
  // Depend on directoryStructureVersion for reactivity when empty dirs are added
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const version = directoryStructureVersion.value;

  const tree: ITreeNode[] = [];

  // Filter prompts based on search (includes title, fileName, and category) and category filter
  const searchLower = searchQuery.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;

  // Use reactive refs from storeToRefs for proper reactivity
  let filteredPrompts = [...allPrompts.value];

  // Apply text search filter
  if (searchLower) {
    filteredPrompts = filteredPrompts.filter((p) => {
      const titleMatch = p.metadata.title.toLowerCase().includes(searchLower);
      const fileNameMatch = p.fileName.toLowerCase().includes(searchLower);
      const categoryLabel = p.metadata.category
        ? (getCategoryLabel(p.metadata.category)?.toLowerCase() ?? '')
        : '';
      const categoryMatch = categoryLabel.includes(searchLower);
      return titleMatch || fileNameMatch || categoryMatch;
    });
  }

  // Apply category filter
  if (selectedCategory) {
    filteredPrompts = filteredPrompts.filter((p) => p.metadata.category === selectedCategory);
  }

  // Filter snippets based on search (use reactive ref)
  const snippetsList = [...allSnippets.value];
  const filteredSnippets = searchLower
    ? snippetsList.filter(
        (s) =>
          s.metadata.name.toLowerCase().includes(searchLower) ||
          s.metadata.shortcut.toLowerCase().includes(searchLower)
      )
    : snippetsList;

  // Build prompts folder with projects and standalone prompts
  const promptsFolder = buildPromptsFolder(filteredPrompts);
  tree.push(promptsFolder);

  // Snippets section with sub-folders
  const personas = filteredSnippets.filter((s) => s.metadata.type === 'persona');
  const textSnippets = filteredSnippets.filter((s) => s.metadata.type === 'text');
  const codeSnippets = filteredSnippets.filter((s) => s.metadata.type === 'code');
  const templates = filteredSnippets.filter((s) => s.metadata.type === 'template');

  // Personas folder
  tree.push({
    id: 'personas',
    label: 'Personas',
    icon: 'folder',
    type: 'folder',
    count: personas.length,
    children: personas.map((snippet) => ({
      id: snippet.filePath,
      label: snippet.metadata.name,
      icon: 'person',
      type: 'snippet' as const,
      filePath: snippet.filePath,
      snippetType: snippet.metadata.type,
    })),
  });

  // Text Snippets folder
  tree.push({
    id: 'text-snippets',
    label: 'Text Snippets',
    icon: 'folder',
    type: 'folder',
    count: textSnippets.length,
    children: textSnippets.map((snippet) => ({
      id: snippet.filePath,
      label: snippet.metadata.name,
      icon: 'text_snippet',
      type: 'snippet' as const,
      filePath: snippet.filePath,
      snippetType: snippet.metadata.type,
    })),
  });

  // Code Snippets folder
  tree.push({
    id: 'code-snippets',
    label: 'Code Snippets',
    icon: 'folder',
    type: 'folder',
    count: codeSnippets.length,
    children: codeSnippets.map((snippet) => ({
      id: snippet.filePath,
      label: snippet.metadata.name,
      icon: 'code',
      type: 'snippet' as const,
      filePath: snippet.filePath,
      snippetType: snippet.metadata.type,
    })),
  });

  // Templates folder
  tree.push({
    id: 'templates',
    label: 'Templates',
    icon: 'folder',
    type: 'folder',
    count: templates.length,
    children: templates.map((snippet) => ({
      id: snippet.filePath,
      label: snippet.metadata.name,
      icon: 'article',
      type: 'snippet' as const,
      filePath: snippet.filePath,
      snippetType: snippet.metadata.type,
    })),
  });

  return tree;
});

// Build prompts folder with projects and standalone prompts
function buildPromptsFolder(prompts: IPromptFile[]): ITreeNode {
  // Use reactive ref for proper reactivity
  const projects = [...allProjects.value];

  // Separate standalone prompts from project prompts
  const standalonePrompts: IPromptFile[] = [];
  const projectPrompts = new Map<string, IPromptFile[]>();

  for (const prompt of prompts) {
    let foundProject = false;
    for (const project of projects) {
      if (prompt.filePath.startsWith(project.folderPath + '/')) {
        const existing = projectPrompts.get(project.folderPath) ?? [];
        existing.push(prompt);
        projectPrompts.set(project.folderPath, existing);
        foundProject = true;
        break;
      }
    }
    if (!foundProject) {
      standalonePrompts.push(prompt);
    }
  }

  // Build children
  const children: ITreeNode[] = [];

  // Add projects
  for (const project of projects) {
    const projectPromptsList = projectPrompts.get(project.folderPath) ?? [];
    children.push({
      id: project.folderPath,
      label: project.name,
      icon: 'folder_special',
      type: 'project',
      filePath: project.folderPath,
      isProject: true,
      isDropTarget: true,
      count: projectPromptsList.length,
      children: buildDirectoryChildren(project.folderPath, projectPromptsList, 1),
    });
  }

  // Add standalone prompts
  for (const prompt of standalonePrompts) {
    children.push({
      id: prompt.filePath,
      label: prompt.metadata.title || prompt.fileName.replace('.md', ''),
      icon: getPromptIcon(prompt),
      type: 'prompt',
      filePath: prompt.filePath,
      isDraggable: true,
      category: prompt.metadata.category,
    });
  }

  return {
    id: 'prompts',
    label: 'Prompts',
    icon: 'folder',
    type: 'folder',
    count: prompts.length,
    isDropTarget: true,
    children,
  };
}

// Build children for a directory (recursive for nested directories)
function buildDirectoryChildren(
  dirPath: string,
  prompts: IPromptFile[],
  depth: number
): ITreeNode[] {
  const children: ITreeNode[] = [];

  // Group prompts by immediate subdirectory
  const subDirs = new Map<string, IPromptFile[]>();
  const directPrompts: IPromptFile[] = [];

  for (const prompt of prompts) {
    const relativePath = prompt.filePath.slice(dirPath.length + 1);
    const parts = relativePath.split('/');

    if (parts.length === 1) {
      // Direct child
      directPrompts.push(prompt);
    } else {
      // In a subdirectory
      const subDir = parts[0];
      const subDirPath = `${dirPath}/${subDir}`;
      const existing = subDirs.get(subDirPath) ?? [];
      existing.push(prompt);
      subDirs.set(subDirPath, existing);
    }
  }

  // Also include empty directories from the structure cache
  const emptyDirs = directoryStructures.value.get(dirPath) ?? [];
  for (const emptyDirPath of emptyDirs) {
    if (!subDirs.has(emptyDirPath)) {
      subDirs.set(emptyDirPath, []);
    }
  }

  // Add subdirectories (sorted alphabetically)
  const sortedSubDirs = Array.from(subDirs.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  for (const [subDirPath, subPrompts] of sortedSubDirs) {
    const dirName = subDirPath.split('/').pop() ?? subDirPath;
    children.push({
      id: subDirPath,
      label: dirName,
      icon: 'folder',
      type: 'directory',
      filePath: subDirPath,
      parentPath: dirPath,
      depth,
      isDropTarget: true,
      count: subPrompts.length,
      children: buildDirectoryChildren(subDirPath, subPrompts, depth + 1),
    });
  }

  // Add direct prompts (markdown files)
  for (const prompt of directPrompts) {
    children.push({
      id: prompt.filePath,
      label: prompt.metadata.title || prompt.fileName.replace('.md', ''),
      icon: getPromptIcon(prompt),
      type: 'prompt',
      filePath: prompt.filePath,
      parentPath: dirPath,
      depth,
      isDraggable: true,
      category: prompt.metadata.category,
    });
  }

  // Add non-markdown files from the cache
  const nonMdFiles = directoryFiles.value.get(dirPath) ?? [];
  for (const file of nonMdFiles) {
    children.push({
      id: file.path,
      label: file.name,
      icon: getIconForFile(file.path),
      type: 'file',
      filePath: file.path,
      parentPath: dirPath,
      depth,
      isDraggable: true,
    });
  }

  return children;
}

// Get icon for prompt based on metadata
function getPromptIcon(prompt: IPromptFile): string {
  if (prompt.metadata.isFavorite) return 'star';
  if (prompt.metadata.isPinned) return 'push_pin';
  return 'description';
}

// Get category label from value
function getCategoryLabel(categoryValue: string | undefined): string | undefined {
  if (!categoryValue) return undefined;
  const category = settingsStore.getCategoryByValue(categoryValue);
  return category?.label ?? categoryValue;
}

// Toggle folder expansion
async function toggleFolder(folderId: string): Promise<void> {
  if (expandedFolders.value.has(folderId)) {
    expandedFolders.value.delete(folderId);
  } else {
    expandedFolders.value.add(folderId);
    // Load directory structure when expanding a project or directory
    if (folderId.startsWith('/')) {
      await loadDirectoryStructure(folderId);
      // Load branch info and file statuses for projects
      const isProject = allProjects.value.some((p) => p.folderPath === folderId);
      if (isProject) {
        await loadProjectBranch(folderId);
        await loadProjectFileStatuses(folderId);
      }
    }
  }
  // Also toggle in project store for persistence
  if (folderId.startsWith('/')) {
    projectStore.toggleDirectoryExpanded(folderId);
  }
  // Trigger reactivity
  expandedFolders.value = new Set(expandedFolders.value);
}

// Load current branch for a project
async function loadProjectBranch(projectPath: string): Promise<void> {
  if (!isElectron.value) return;
  try {
    // Quick check if it's a git repo and get branch
    await gitStore.initialize(projectPath);
    if (gitStore.isRepo) {
      await gitStore.refreshStatus();
      projectBranches.value.set(projectPath, gitStore.currentBranch);
    }
  } catch (err) {
    console.warn('Failed to load branch for project:', err);
  }
}

// Get the current branch for a project
function getProjectBranch(projectPath: string): string | undefined {
  return projectBranches.value.get(projectPath);
}

// Load file statuses for a project
async function loadProjectFileStatuses(projectPath: string): Promise<void> {
  if (!isElectron.value) return;
  try {
    await gitStore.initialize(projectPath);
    if (gitStore.isRepo) {
      await gitStore.refreshStatus();

      // Build sets of file paths for each status
      const staged = new Set<string>();
      const modified = new Set<string>();
      const untracked = new Set<string>();
      const tracked = new Set<string>();

      for (const file of gitStore.stagedFiles) {
        staged.add(`${projectPath}/${file.filePath}`);
      }
      for (const file of gitStore.modifiedFiles) {
        modified.add(`${projectPath}/${file.filePath}`);
      }
      for (const file of gitStore.untrackedFiles) {
        untracked.add(`${projectPath}/${file.filePath}`);
      }

      // Get tracked files from git ls-files
      const trackedFiles = await gitStore.getTrackedFiles();
      for (const filePath of trackedFiles) {
        tracked.add(filePath);
      }

      projectFileStatuses.value.set(projectPath, { staged, modified, untracked, tracked });
    }
  } catch (err) {
    console.warn('Failed to load file statuses for project:', err);
  }
}

// Get file status for a specific file
function getFileStatus(filePath: string): {
  isStaged: boolean;
  isModified: boolean;
  isUntracked: boolean;
  isInProject: boolean;
  isTracked: boolean;
} {
  const project = projectStore.getProjectForPath(filePath);
  if (!project) {
    return {
      isStaged: false,
      isModified: false,
      isUntracked: false,
      isInProject: false,
      isTracked: false,
    };
  }

  const statuses = projectFileStatuses.value.get(project.folderPath);
  if (!statuses) {
    // No status loaded yet - default to NOT tracked (safe default)
    return {
      isStaged: false,
      isModified: false,
      isUntracked: false,
      isInProject: true,
      isTracked: false,
    };
  }

  const isStaged = statuses.staged.has(filePath);
  const isModified = statuses.modified.has(filePath);
  const isUntracked = statuses.untracked.has(filePath);

  // File is tracked if it's in the tracked set (from git ls-files)
  const isTracked = statuses.tracked.has(filePath);

  return {
    isStaged,
    isModified,
    isUntracked,
    isInProject: true,
    isTracked,
  };
}

// Check if file needs to be added (modified or untracked, but not staged)
function fileNeedsAdd(filePath: string): boolean {
  const status = getFileStatus(filePath);
  return status.isInProject && (status.isModified || status.isUntracked) && !status.isStaged;
}

// Check if file is staged (ready to commit)
function fileIsStaged(filePath: string): boolean {
  const status = getFileStatus(filePath);
  return status.isStaged;
}

// Check if file can be ignored (untracked only)
function fileCanBeIgnored(filePath: string): boolean {
  const status = getFileStatus(filePath);
  return status.isUntracked;
}

// Check if file is in a project
function fileIsInProject(filePath: string): boolean {
  const status = getFileStatus(filePath);
  return status.isInProject;
}

// Check if file is tracked (committed to git, has history)
function fileIsTracked(filePath: string): boolean {
  const status = getFileStatus(filePath);
  return status.isInProject && status.isTracked;
}

// Load directory structure from file system
// When recursive=true, loads all nested directories (used when adding folders)
// When skipCache=true, bypasses the cache to get fresh data
async function loadDirectoryStructure(
  dirPath: string,
  recursive = false,
  skipCache = false
): Promise<void> {
  if (!isElectron.value) return;

  try {
    // When loading recursively or skipCache is true, bypass the cache to get fresh data
    const useCache = !(recursive || skipCache);
    const tree = await projectStore.getDirectoryTree(dirPath, useCache);
    // Extract immediate child directories (excluding hidden directories like .git)
    const childDirs = tree.children
      .filter((c) => !c.path.endsWith('.md') && !c.name.startsWith('.'))
      .map((c) => c.path);

    // Extract non-markdown files (excluding hidden files)
    const nonMdFiles: INonMarkdownFile[] = tree.files
      .filter((f) => !f.name.startsWith('.') && !f.name.endsWith('.md'))
      .map((f) => ({ path: f.path, name: f.name }));

    // Create new Map instances to ensure Vue reactivity detects the change
    const newDirStructures = new Map(directoryStructures.value);
    if (childDirs.length > 0) {
      newDirStructures.set(dirPath, childDirs);
    }
    directoryStructures.value = newDirStructures;

    const newDirFiles = new Map(directoryFiles.value);
    if (nonMdFiles.length > 0) {
      newDirFiles.set(dirPath, nonMdFiles);
    } else {
      // Clear if no files (in case directory was emptied)
      newDirFiles.delete(dirPath);
    }
    directoryFiles.value = newDirFiles;

    directoryStructureVersion.value++;

    // Recursively load child directories
    // When recursive=true: load ALL children (for newly added folders)
    // When recursive=false: only load already expanded children
    for (const childDir of childDirs) {
      if (recursive || expandedFolders.value.has(childDir)) {
        // Auto-expand when loading recursively so the tree shows the contents
        if (recursive) {
          expandedFolders.value.add(childDir);
        }
        await loadDirectoryStructure(childDir, recursive, skipCache);
      }
    }
  } catch (err) {
    console.warn('Failed to load directory structure:', err);
  }
}

// Clear a deleted directory from the local cache
function clearDirectoryFromCache(deletedPath: string): void {
  // Remove the directory itself from any parent's list
  directoryStructures.value.forEach((childDirs, parentPath) => {
    const filtered = childDirs.filter((d) => d !== deletedPath && !d.startsWith(deletedPath + '/'));
    if (filtered.length !== childDirs.length) {
      directoryStructures.value.set(parentPath, filtered);
    }
  });

  // Remove any entries where the deleted path was the parent
  directoryStructures.value.delete(deletedPath);
  directoryFiles.value.delete(deletedPath);

  // Also remove any nested paths under the deleted directory
  const keysToDelete: string[] = [];
  directoryStructures.value.forEach((_, key) => {
    if (key.startsWith(deletedPath + '/')) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach((key) => {
    directoryStructures.value.delete(key);
    directoryFiles.value.delete(key);
  });

  // Trigger reactivity
  directoryStructureVersion.value++;
}

// Check if folder is expanded (auto-expand all when searching or filtering)
function isExpanded(folderId: string): boolean {
  // Auto-expand all folders when search or category filter is active
  if (searchQuery.value.trim() || categoryFilter.value) {
    return true;
  }
  return expandedFolders.value.has(folderId);
}

// Open file in editor
async function openFile(node: ITreeNode): Promise<void> {
  if (!node.filePath) return;

  try {
    const fileCategory = getFileCategory(node.filePath);
    const mimeType = getMimeType(node.filePath);

    if (node.type === 'prompt') {
      // Load prompt and open tab
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
      // Load snippet and open tab
      const snippet = await snippetStore.loadSnippet(node.filePath);
      uiStore.openTab({
        filePath: snippet.filePath,
        fileName: snippet.fileName,
        title: snippet.metadata.name,
        isDirty: false,
        isPinned: false,
        fileCategory: FileCategory.MARKDOWN,
      });
    } else {
      // Non-markdown files - open directly without loading content
      const fileName = node.filePath.split('/').pop() ?? 'Unknown';
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

// Delete file or directory
async function confirmDelete(node: ITreeNode): Promise<void> {
  if (!node.filePath) return;

  if (node.type === 'project' || node.type === 'directory') {
    // Get contents count for warning
    try {
      const count = await projectStore.getDirectoryContentsCount(node.filePath);
      deleteTarget.value = { node, contentsCount: count };
    } catch {
      deleteTarget.value = { node };
    }
  } else {
    deleteTarget.value = { node };
  }
  showDeleteConfirmDialog.value = true;
}

// Handle delete confirmation
async function handleDeleteConfirm(): Promise<void> {
  if (!deleteTarget.value) return;
  const { node } = deleteTarget.value;
  if (!node.filePath) return;

  try {
    const parentDir = node.parentPath;

    if (node.type === 'prompt') {
      await promptStore.deletePrompt(node.filePath);
      uiStore.closeTab(node.filePath);
      // Refresh tree to update the explorer
      await refreshFiles();
      // Also reload parent directory structure for non-markdown files
      if (parentDir) {
        // Invalidate cache so we get fresh data from file system
        projectStore.invalidateTreeCache(parentDir);
        await loadDirectoryStructure(parentDir);
      }
    } else if (node.type === 'snippet') {
      await snippetStore.deleteSnippet(node.filePath);
      uiStore.closeTab(node.filePath);
      // Refresh tree to update the explorer
      await refreshFiles();
    } else if (node.type === 'project') {
      await projectStore.deleteProject(node.filePath, true);
      // Close any tabs for files in this project
      for (const tab of uiStore.openTabs) {
        if (tab.filePath.startsWith(node.filePath + '/')) {
          uiStore.closeTab(tab.id);
        }
      }
      // Clear the deleted project from the local cache
      clearDirectoryFromCache(node.filePath);
      // Refresh tree to update the explorer
      await refreshFiles();
    } else if (node.type === 'directory') {
      await projectStore.deleteDirectory(node.filePath, true);
      // Close any tabs for files in this directory
      for (const tab of uiStore.openTabs) {
        if (tab.filePath.startsWith(node.filePath + '/')) {
          uiStore.closeTab(tab.id);
        }
      }
      // Clear the deleted directory from the local cache
      clearDirectoryFromCache(node.filePath);
      // Refresh tree to update the explorer
      await refreshFiles();
    } else if (node.type === 'file') {
      // Delete non-markdown file
      await window.fileSystemAPI.deleteFile(node.filePath);
      uiStore.closeTab(node.filePath);
      // Refresh tree and directory structure to update the explorer
      await refreshFiles();
      if (parentDir) {
        // Invalidate cache so we get fresh data from file system
        projectStore.invalidateTreeCache(parentDir);
        await loadDirectoryStructure(parentDir);
      }
    }

    // Force reactivity update for the file tree
    directoryStructureVersion.value++;
    showSuccess(`Deleted "${node.label}"`);
  } catch (err) {
    console.error('Failed to delete:', err);
    showError('Failed to delete');
  }
}

// Open rename dialog
function openRenameDialog(node: ITreeNode): void {
  if (!node.filePath) return;
  renameTarget.value = {
    node,
    currentName: node.label,
  };
  showRenameDialog.value = true;
}

// Get item type for rename dialog
function getRenameItemType(
  node: ITreeNode
): 'prompt' | 'snippet' | 'persona' | 'template' | 'text' | 'project' | 'directory' {
  if (node.type === 'prompt') return 'prompt';
  if (node.type === 'project') return 'project';
  if (node.type === 'directory') return 'directory';
  if (node.snippetType === 'persona') return 'persona';
  if (node.snippetType === 'template') return 'template';
  if (node.snippetType === 'text') return 'text';
  return 'snippet';
}

// Handle rename
async function handleRename(newName: string): Promise<void> {
  if (!renameTarget.value) return;
  const { node } = renameTarget.value;
  const filePath = node.filePath;
  if (!filePath) return;

  try {
    if (node.type === 'prompt') {
      await promptStore.renamePrompt(filePath, newName);
    } else if (node.type === 'snippet') {
      await snippetStore.renameSnippet(filePath, newName);
    } else if (node.type === 'project') {
      await projectStore.renameProject(filePath, newName);
      await promptStore.refreshAllPrompts();
    } else if (node.type === 'directory') {
      const newPath = await projectStore.renameDirectory(filePath, newName);
      // Update any open tabs that were in this directory
      for (const tab of uiStore.openTabs) {
        if (tab.filePath.startsWith(filePath + '/')) {
          const newTabPath = tab.filePath.replace(filePath, newPath);
          uiStore.updateTabFilePath(tab.filePath, newTabPath, tab.title);
        }
      }
      await promptStore.refreshAllPrompts();
    } else if (node.type === 'file') {
      // Rename non-markdown file (using moveFile which handles rename)
      const parentDir = node.parentPath ?? filePath.substring(0, filePath.lastIndexOf('/'));
      const newPath = `${parentDir}/${newName}`;
      await window.fileSystemAPI.moveFile(filePath, newPath);
      // Update tab if file is open
      uiStore.updateTabFilePath(filePath, newPath, newName);
      // Refresh directory to update tree
      if (parentDir) {
        // Invalidate cache so we get fresh data from file system
        projectStore.invalidateTreeCache(parentDir);
        await loadDirectoryStructure(parentDir);
      }
    }
  } catch (err) {
    console.error('Failed to rename:', err);
    showError('Failed to rename');
  }
}

// Open edit prompt dialog
function openEditPromptDialog(node: ITreeNode): void {
  if (!node.filePath || node.type !== 'prompt') return;
  editPromptTarget.value = {
    node,
    currentName: node.label,
    currentCategory: node.category,
  };
  showEditPromptDialog.value = true;
}

// Handle edit prompt save
async function handleEditPromptSave(data: { name: string; category?: string }): Promise<void> {
  if (!editPromptTarget.value) return;
  const { node, currentName, currentCategory } = editPromptTarget.value;
  const filePath = node.filePath;
  if (!filePath) return;

  try {
    const nameChanged = data.name !== currentName;
    const categoryChanged = (data.category ?? '') !== (currentCategory ?? '');

    // Update category if changed
    if (categoryChanged) {
      await promptStore.updatePromptMetadata(filePath, { category: data.category });
    }

    // Rename if name changed
    if (nameChanged) {
      await promptStore.renamePrompt(filePath, data.name);
    }

    // Refresh if anything changed
    if (nameChanged || categoryChanged) {
      await promptStore.refreshAllPrompts();
      // Refresh recent files list (for welcome screen)
      await promptStore.refreshRecentFiles();
    }
  } catch (err) {
    console.error('Failed to edit prompt:', err);
    showError('Failed to edit prompt');
  }
}

// Handle new prompt creation from dialog
async function handleCreatePrompt(data: { title: string; category?: string }): Promise<void> {
  try {
    let prompt: IPromptFile;

    if (newPromptDirectory.value) {
      // Create in specific directory
      prompt = await promptStore.createPromptInDirectory(newPromptDirectory.value, data.title, '');
    } else {
      // Create in prompts root
      prompt = await promptStore.createPrompt(data.title, '', data.category);
    }

    // Open the new prompt
    uiStore.openTab({
      filePath: prompt.filePath,
      fileName: prompt.fileName,
      title: prompt.metadata.title,
      isDirty: false,
      isPinned: false,
    });

    // Expand prompts folder
    expandedFolders.value.add('prompts');
    if (newPromptDirectory.value) {
      expandedFolders.value.add(newPromptDirectory.value);
    }
    expandedFolders.value = new Set(expandedFolders.value);

    newPromptDirectory.value = null;
  } catch (err) {
    console.error('Failed to create prompt:', err);
    showError('Failed to create prompt');
  }
}

// Handle new snippet creation from dialog
async function handleCreateSnippet(data: {
  name: string;
  type: ISnippetMetadata['type'];
  description: string;
}): Promise<void> {
  try {
    const snippet = await snippetStore.createSnippet(data.name, data.type, '');

    // Open the new snippet
    uiStore.openTab({
      filePath: snippet.filePath,
      fileName: snippet.fileName,
      title: snippet.metadata.name,
      isDirty: false,
      isPinned: false,
    });

    // Expand appropriate folder
    const folderId = getFolderIdForSnippetType(data.type);
    expandedFolders.value.add(folderId);
    expandedFolders.value = new Set(expandedFolders.value);
  } catch (err) {
    console.error('Failed to create snippet:', err);
    showError('Failed to create snippet');
  }
}

// Handle new project creation
async function handleCreateProject(data: { name: string; description?: string }): Promise<void> {
  try {
    const project = await projectStore.createProject(data.name, data.description);

    // Expand prompts and the new project
    expandedFolders.value.add('prompts');
    expandedFolders.value.add(project.folderPath);
    expandedFolders.value = new Set(expandedFolders.value);
  } catch (err) {
    console.error('Failed to create project:', err);
    showError('Failed to create project');
  }
}

// Handle new directory creation
async function handleCreateDirectory(data: { name: string; parentPath: string }): Promise<void> {
  try {
    const newPath = await projectStore.createDirectory(data.parentPath, data.name);

    // Add new directory to the structure cache
    const existingDirs = directoryStructures.value.get(data.parentPath) ?? [];
    if (!existingDirs.includes(newPath)) {
      existingDirs.push(newPath);
      directoryStructures.value.set(data.parentPath, existingDirs);
      directoryStructureVersion.value++; // Trigger reactivity
    }

    // Expand parent and new directory
    expandedFolders.value.add(data.parentPath);
    expandedFolders.value.add(newPath);
    expandedFolders.value = new Set(expandedFolders.value);

    await promptStore.refreshAllPrompts();

    $q.notify({
      type: 'positive',
      message: `Directory "${data.name}" created`,
      position: 'top',
      timeout: 2000,
    });
  } catch (err) {
    console.error('Failed to create directory:', err);
    showError('Failed to create directory');
  }
}

// Open new directory dialog
function openNewDirectoryDialog(parentPath: string, parentName: string): void {
  newDirectoryParent.value = { path: parentPath, name: parentName };
  showNewDirectoryDialog.value = true;
}

// Open new prompt dialog for specific directory
function openNewPromptDialogForDirectory(dirPath: string): void {
  newPromptDirectory.value = dirPath;
  showNewPromptDialog.value = true;
}

// Add file(s) to a directory
async function addFileToDirectory(targetDir: string): Promise<void> {
  if (!targetDir) {
    targetDir = promptsDir.value;
  }

  if (!targetDir) {
    $q.notify({
      type: 'negative',
      message: t('explorer.errorNoTargetDirectory'),
    });
    return;
  }

  // Open file dialog (multi-select allowed)
  const result = await window.electronAPI.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    title: t('explorer.selectFilesToAdd'),
  });

  if (result.canceled || !result.filePaths.length) return;

  let successCount = 0;
  let errorCount = 0;

  // Copy each file
  for (const filePath of result.filePaths) {
    const copyResult = await window.fileSystemAPI.copyFileToDirectory(filePath, targetDir);
    if (copyResult.success) {
      successCount++;
    } else {
      errorCount++;
      console.error(`Failed to copy file: ${copyResult.error}`);
    }
  }

  // Refresh tree and reload directory structure for non-markdown files
  await refreshFiles();
  // Invalidate cache so we get fresh data from file system
  projectStore.invalidateTreeCache(targetDir);
  // Also reload the specific directory to update non-markdown files cache
  await loadDirectoryStructure(targetDir);
  // Auto-expand the parent folder so user can see the new files
  expandedFolders.value.add(targetDir);
  // Trigger Vue reactivity by creating a new Set reference
  expandedFolders.value = new Set(expandedFolders.value);

  // Show notification
  if (successCount > 0) {
    $q.notify({
      type: 'positive',
      message: t('explorer.filesAdded', { count: successCount }),
    });
  }
  if (errorCount > 0) {
    $q.notify({
      type: 'negative',
      message: t('explorer.filesAddError', { count: errorCount }),
    });
  }
}

// Add folder to a directory
async function addFolderToDirectory(targetDir: string): Promise<void> {
  if (!targetDir) {
    targetDir = promptsDir.value;
  }

  if (!targetDir) {
    $q.notify({
      type: 'negative',
      message: t('explorer.errorNoTargetDirectory'),
    });
    return;
  }

  // Open folder dialog
  const result = await window.electronAPI.showOpenDialog({
    properties: ['openDirectory'],
    title: t('explorer.selectFolderToAdd'),
  });

  if (result.canceled || !result.filePaths.length) return;

  const folderPath = result.filePaths[0];

  // Show loading indicator
  $q.loading.show({ message: t('explorer.copyingFolder') });

  try {
    const copyResult = await window.fileSystemAPI.copyDirectory(folderPath, targetDir);

    if (copyResult.success) {
      // Refresh tree and reload directory structure for non-markdown files
      await refreshFiles();
      // Invalidate cache so we get fresh data from file system
      projectStore.invalidateTreeCache(targetDir);
      // Also reload the specific directory to update non-markdown files cache
      await loadDirectoryStructure(targetDir);

      // Also load the newly copied folder's structure recursively so all nested contents are available
      if (copyResult.newPath) {
        projectStore.invalidateTreeCache(copyResult.newPath);
        // Auto-expand the parent folder (targetDir) so user can see the new folder
        expandedFolders.value.add(targetDir);
        // Auto-expand the newly added folder
        expandedFolders.value.add(copyResult.newPath);
        // Load recursively to get all nested subdirectories and files
        await loadDirectoryStructure(copyResult.newPath, true);
        // Trigger Vue reactivity by creating a new Set reference
        expandedFolders.value = new Set(expandedFolders.value);
      }

      $q.notify({
        type: 'positive',
        message: t('explorer.folderAdded'),
      });
    } else {
      $q.notify({
        type: 'negative',
        message: t('explorer.folderAddError'),
      });
      console.error(`Failed to copy folder: ${copyResult.error}`);
    }
  } finally {
    $q.loading.hide();
  }
}

// Get folder ID for snippet type
function getFolderIdForSnippetType(type: ISnippetMetadata['type']): string {
  switch (type) {
    case 'persona':
      return 'personas';
    case 'text':
      return 'text-snippets';
    case 'code':
      return 'code-snippets';
    case 'template':
      return 'templates';
    default:
      return 'text-snippets';
  }
}

// Refresh all files
async function refreshFiles(): Promise<void> {
  await Promise.all([
    promptStore.refreshAllPrompts(),
    snippetStore.refreshAllSnippets(),
    projectStore.refreshProjects(),
  ]);
}

// Initialize default personas
async function handleInitializePersonas(): Promise<void> {
  try {
    await snippetStore.initializePersonas();
    expandedFolders.value.add('personas');
    expandedFolders.value = new Set(expandedFolders.value);
    $q.notify({
      type: 'positive',
      message: 'Default personas created successfully',
      position: 'top',
      timeout: 3000,
    });
  } catch (err) {
    console.error('Failed to initialize personas:', err);
    showError('Failed to initialize personas');
  }
}

// ================================
// Git Operations
// ================================

// Open Git setup dialog for a project
function openGitSetup(projectPath: string, projectName: string): void {
  gitProjectPath.value = projectPath;
  gitProjectName.value = projectName;
  showGitSetupDialog.value = true;
}

// Quick Git push for a project
async function handleGitPush(projectPath: string): Promise<void> {
  try {
    await gitStore.initialize(projectPath);

    if (!gitStore.isRepo) {
      showError('Not a Git repository');
      return;
    }

    const success = await gitStore.push();
    if (success) {
      $q.notify({
        type: 'positive',
        message: 'Pushed to remote successfully',
        position: 'top',
        timeout: 3000,
      });
    } else {
      showError(gitStore.error ?? 'Failed to push');
    }
  } catch (err) {
    console.error('Failed to push:', err);
    showError('Failed to push to remote');
  }
}

// Quick Git pull for a project
async function handleGitPull(projectPath: string): Promise<void> {
  try {
    await gitStore.initialize(projectPath);

    if (!gitStore.isRepo) {
      showError('Not a Git repository');
      return;
    }

    const success = await gitStore.pull();
    if (success) {
      $q.notify({
        type: 'positive',
        message: 'Pulled from remote successfully',
        position: 'top',
        timeout: 3000,
      });
      // Refresh prompts in case files changed
      await promptStore.refreshAllPrompts();
    } else {
      showError(gitStore.error ?? 'Failed to pull');
    }
  } catch (err) {
    console.error('Failed to pull:', err);
    showError('Failed to pull from remote');
  }
}

// Quick Git fetch for a project
async function handleGitFetch(projectPath: string): Promise<void> {
  try {
    await gitStore.initialize(projectPath);

    if (!gitStore.isRepo) {
      showError('Not a Git repository');
      return;
    }

    const success = await gitStore.fetch();
    if (success) {
      $q.notify({
        type: 'positive',
        message: 'Fetched from remote successfully',
        position: 'top',
        timeout: 3000,
      });
    } else {
      showError(gitStore.error ?? 'Failed to fetch');
    }
  } catch (err) {
    console.error('Failed to fetch:', err);
    showError('Failed to fetch from remote');
  }
}

// Git sync (pull then push)
async function handleGitSync(projectPath: string): Promise<void> {
  try {
    await gitStore.initialize(projectPath);

    if (!gitStore.isRepo) {
      showError('Not a Git repository');
      return;
    }

    // First pull
    const pullSuccess = await gitStore.pull();
    if (!pullSuccess) {
      showError(gitStore.error ?? 'Failed to pull during sync');
      return;
    }

    // Then push
    const pushSuccess = await gitStore.push();
    if (pushSuccess) {
      $q.notify({
        type: 'positive',
        message: 'Synced with remote successfully',
        position: 'top',
        timeout: 3000,
      });
      await promptStore.refreshAllPrompts();
    } else {
      showError(gitStore.error ?? 'Failed to push during sync');
    }
  } catch (err) {
    console.error('Failed to sync:', err);
    showError('Failed to sync with remote');
  }
}

// Open the File Sync dialog for a project
function openFileSyncDialog(projectPath: string): void {
  fileSyncProjectPath.value = projectPath;
  showFileSyncDialog.value = true;
}

// Open branch dialog for a project
function openBranchDialog(projectPath: string, projectName: string): void {
  gitProjectPath.value = projectPath;
  gitProjectName.value = projectName;
  showBranchDialog.value = true;
}

// Handle branch change - refresh the branch cache
async function handleBranchChanged(): Promise<void> {
  if (gitProjectPath.value) {
    projectBranches.value.set(gitProjectPath.value, gitStore.currentBranch);
    // Refresh prompts in case files changed
    await promptStore.refreshAllPrompts();
  }
}

// Stage and commit a single file
async function handleGitCommitFile(filePath: string): Promise<void> {
  try {
    // Get the project path for this file
    const project = projectStore.getProjectForPath(filePath);
    if (!project) {
      showError('File is not in a project');
      return;
    }

    await gitStore.initialize(project.folderPath);

    if (!gitStore.isRepo) {
      showError('Not a Git repository');
      return;
    }

    // Get relative path from project root
    const relativePath = filePath.slice(project.folderPath.length + 1);

    // Stage the file
    const stageSuccess = await gitStore.stageFiles([relativePath]);
    if (!stageSuccess) {
      showError(gitStore.error ?? 'Failed to stage file');
      return;
    }

    // Prompt for commit message
    $q.dialog({
      title: 'Commit File',
      message: `Enter commit message for: ${relativePath}`,
      prompt: {
        model: '',
        type: 'text',
        placeholder: 'Commit message...',
      },
      cancel: true,
      persistent: true,
    }).onOk((message: string) => {
      if (!message.trim()) {
        showError('Commit message is required');
        return;
      }

      void gitStore.commit(message).then((commitSuccess) => {
        if (commitSuccess) {
          $q.notify({
            type: 'positive',
            message: 'File committed successfully',
            position: 'top',
            timeout: 3000,
          });
        } else {
          showError(gitStore.error ?? 'Failed to commit');
        }
      });
    });
  } catch (err) {
    console.error('Failed to commit file:', err);
    showError('Failed to commit file');
  }
}

// View Git history for a file (opens project history)
function handleGitHistory(filePath: string): void {
  const project = projectStore.getProjectForPath(filePath);
  if (!project) {
    showError('File is not in a project');
    return;
  }

  gitProjectPath.value = project.folderPath;
  gitProjectName.value = project.name;
  showGitHistoryDialog.value = true;
}

// View Git history for an entire project
function handleProjectGitHistory(projectPath: string, projectName: string): void {
  gitProjectPath.value = projectPath;
  gitProjectName.value = projectName;
  showGitHistoryDialog.value = true;
}

// Discard changes in a file
async function handleGitDiscardChanges(filePath: string): Promise<void> {
  try {
    const project = projectStore.getProjectForPath(filePath);
    if (!project) {
      showError('File is not in a project');
      return;
    }

    await gitStore.initialize(project.folderPath);

    if (!gitStore.isRepo) {
      showError('Not a Git repository');
      return;
    }

    // Confirm discard
    $q.dialog({
      title: 'Discard Changes',
      message: 'Are you sure you want to discard all changes to this file? This cannot be undone.',
      cancel: true,
      persistent: true,
      color: 'negative',
    }).onOk(() => {
      const relativePath = filePath.slice(project.folderPath.length + 1);
      void gitStore.discardChanges(relativePath).then((success) => {
        if (success) {
          $q.notify({
            type: 'positive',
            message: 'Changes discarded',
            position: 'top',
            timeout: 3000,
          });
          // Refresh to show updated content
          void promptStore.refreshAllPrompts();
        } else {
          showError(gitStore.error ?? 'Failed to discard changes');
        }
      });
    });
  } catch (err) {
    console.error('Failed to discard changes:', err);
    showError('Failed to discard changes');
  }
}

// Stage a file (git add)
async function handleGitAddFile(filePath: string): Promise<void> {
  try {
    const project = projectStore.getProjectForPath(filePath);
    if (!project) {
      showError('File is not in a project');
      return;
    }

    await gitStore.initialize(project.folderPath);

    if (!gitStore.isRepo) {
      showError('Not a Git repository');
      return;
    }

    const relativePath = filePath.slice(project.folderPath.length + 1);
    const success = await gitStore.stageFiles([relativePath]);

    if (success) {
      $q.notify({
        type: 'positive',
        message: 'File staged for commit',
        position: 'top',
        timeout: 3000,
      });
      // Refresh file statuses
      await loadProjectFileStatuses(project.folderPath);
    } else {
      showError(gitStore.error ?? 'Failed to stage file');
    }
  } catch (err) {
    console.error('Failed to stage file:', err);
    showError('Failed to stage file');
  }
}

// Unstage a file (git reset)
async function handleGitUnstageFile(filePath: string): Promise<void> {
  try {
    const project = projectStore.getProjectForPath(filePath);
    if (!project) {
      showError('File is not in a project');
      return;
    }

    await gitStore.initialize(project.folderPath);

    if (!gitStore.isRepo) {
      showError('Not a Git repository');
      return;
    }

    const relativePath = filePath.slice(project.folderPath.length + 1);
    const success = await gitStore.unstageFiles([relativePath]);

    if (success) {
      $q.notify({
        type: 'positive',
        message: 'File unstaged',
        position: 'top',
        timeout: 3000,
      });
      // Refresh file statuses
      await loadProjectFileStatuses(project.folderPath);
    } else {
      showError(gitStore.error ?? 'Failed to unstage file');
    }
  } catch (err) {
    console.error('Failed to unstage file:', err);
    showError('Failed to unstage file');
  }
}

// Add file to .gitignore
async function handleGitIgnoreFile(filePath: string): Promise<void> {
  try {
    const project = projectStore.getProjectForPath(filePath);
    if (!project) {
      showError('File is not in a project');
      return;
    }

    await gitStore.initialize(project.folderPath);

    if (!gitStore.isRepo) {
      showError('Not a Git repository');
      return;
    }

    const relativePath = filePath.slice(project.folderPath.length + 1);
    const gitignorePath = `${project.folderPath}/.gitignore`;

    // Read existing .gitignore or create new
    let gitignoreContent = '';
    try {
      const exists = await window.fileSystemAPI.fileExists(gitignorePath);
      if (exists) {
        const result = await window.fileSystemAPI.readFile(gitignorePath);
        if (result.success && result.content) {
          gitignoreContent = result.content as string;
        }
      }
    } catch {
      // File doesn't exist, start with empty content
    }

    // Check if already in gitignore
    const lines = gitignoreContent.split('\n');
    if (lines.some((line) => line.trim() === relativePath)) {
      $q.notify({
        type: 'info',
        message: 'File is already in .gitignore',
        position: 'top',
        timeout: 3000,
      });
      return;
    }

    // Add to gitignore
    const newContent = gitignoreContent.trim()
      ? `${gitignoreContent.trim()}\n${relativePath}\n`
      : `${relativePath}\n`;

    const writeResult = await window.fileSystemAPI.writeFile(gitignorePath, newContent);
    if (writeResult.success) {
      $q.notify({
        type: 'positive',
        message: 'File added to .gitignore',
        position: 'top',
        timeout: 3000,
      });
      // Refresh file statuses
      await loadProjectFileStatuses(project.folderPath);
    } else {
      showError(writeResult.error ?? 'Failed to update .gitignore');
    }
  } catch (err) {
    console.error('Failed to add to .gitignore:', err);
    showError('Failed to add file to .gitignore');
  }
}

// Check if a project is a Git repository (for conditional menu items)
async function _checkProjectIsGitRepo(projectPath: string): Promise<boolean> {
  try {
    await gitStore.initialize(projectPath);
    return gitStore.isRepo;
  } catch {
    return false;
  }
}

// Toggle favorite
async function toggleFavorite(node: ITreeNode): Promise<void> {
  if (!node.filePath || node.type !== 'prompt') return;

  try {
    // Try to get from cache first, otherwise load it
    let prompt = promptStore.getCachedPrompt(node.filePath);
    if (!prompt) {
      prompt = await promptStore.loadPrompt(node.filePath);
    }
    if (prompt) {
      await promptStore.updatePromptMetadata(node.filePath, {
        isFavorite: !prompt.metadata.isFavorite,
      });
      await promptStore.refreshAllPrompts();
    }
  } catch (err) {
    console.error('Failed to toggle favorite:', err);
  }
}

// Drag and drop handlers
function handleDragStart(event: DragEvent, node: ITreeNode): void {
  if (!node.isDraggable || !node.filePath) return;

  draggedNode.value = node;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', node.filePath);
  }
}

function handleDragOver(event: DragEvent, node: ITreeNode): void {
  // Check if dragging external files from file manager
  const isExternalFileDrag = event.dataTransfer?.types.includes('Files');

  if (isExternalFileDrag && node.isDropTarget) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    externalDropTargetId.value = node.id;
    return;
  }

  // Internal drag (moving prompts within the app)
  if (!node.isDropTarget || !draggedNode.value) return;

  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
  dropTarget.value = node;
}

function handleDragLeave(event: DragEvent, node: ITreeNode): void {
  // Only clear if leaving the node (not entering a child)
  const relatedTarget = event.relatedTarget as HTMLElement;
  if (relatedTarget?.closest(`[data-node-id="${node.id}"]`)) {
    return;
  }
  dropTarget.value = null;
  externalDropTargetId.value = null;
}

// Check if node is external drop target
function isExternalDropTarget(node: ITreeNode): boolean {
  return externalDropTargetId.value === node.id;
}

async function handleDrop(event: DragEvent, targetNode: ITreeNode): Promise<void> {
  event.preventDefault();
  dropTarget.value = null;
  externalDropTargetId.value = null;

  const targetDirPath = targetNode.filePath ?? promptsDir.value;

  if (!targetDirPath || !targetNode.isDropTarget) {
    return;
  }

  // Check if this is an external file drop (from file manager)
  const files = event.dataTransfer?.files;
  if (files && files.length > 0 && !draggedNode.value) {
    await handleExternalFileDrop(files, targetDirPath);
    return;
  }

  // Internal drag (moving prompts within the app)
  if (!draggedNode.value) return;

  const sourceFilePath = draggedNode.value.filePath;
  const fileName = draggedNode.value.label;

  if (!sourceFilePath) return;

  // Don't drop on same directory
  const sourceDir = sourceFilePath.substring(0, sourceFilePath.lastIndexOf('/'));
  if (sourceDir === targetDirPath) {
    draggedNode.value = null;
    return;
  }

  try {
    await promptStore.movePrompt(sourceFilePath, targetDirPath);
    projectStore.invalidateTreeCache(targetDirPath);

    $q.notify({
      type: 'positive',
      message: 'File moved successfully',
      position: 'top',
      timeout: 2000,
    });
  } catch (err) {
    // Check if it's a FILE_EXISTS error
    const error = err as Error & { code?: string };
    if (error.code === 'FILE_EXISTS') {
      // Show confirmation dialog
      $q.dialog({
        title: 'File Already Exists',
        message: `A file named "${fileName}" already exists in the target location. Do you want to replace it?`,
        cancel: {
          label: 'Cancel',
          flat: true,
        },
        ok: {
          label: 'Replace',
          color: 'negative',
        },
        persistent: true,
      }).onOk(() => {
        void promptStore
          .movePrompt(sourceFilePath, targetDirPath, true)
          .then(() => {
            projectStore.invalidateTreeCache(targetDirPath);

            $q.notify({
              type: 'positive',
              message: 'File replaced successfully',
              position: 'top',
              timeout: 2000,
            });
          })
          .catch((retryErr) => {
            console.error('Failed to replace file:', retryErr);
            showError('Failed to replace file');
          });
      });
    } else {
      console.error('Failed to move prompt:', err);
      showError('Failed to move prompt');
    }
  }

  draggedNode.value = null;
}

// Handle external file drop from file manager
async function handleExternalFileDrop(files: FileList, targetDir: string): Promise<void> {
  $q.loading.show({ message: t('explorer.copyingFiles') });

  let successCount = 0;
  let errorCount = 0;

  const copiedDirPaths: string[] = [];

  try {
    for (const file of Array.from(files)) {
      // Use Electron's webUtils.getPathForFile to get the file path (more reliable than file.path)
      let filePath: string | undefined;
      try {
        filePath = window.fileSystemAPI.getPathForFile(file);
      } catch {
        // Fallback to file.path if getPathForFile is not available
        filePath = (file as File & { path?: string }).path;
      }

      // If file.path is not available (e.g., dragging from certain apps or sandboxed locations),
      // fall back to reading the file content via the File API
      if (!filePath) {
        // Directories can't be read via File API, so we can only handle files here
        // Check if it might be a directory (heuristic: no extension, empty type, size 0)
        const hasExtension = file.name.includes('.');
        if (!hasExtension && file.type === '' && file.size === 0) {
          errorCount++;
          continue;
        }

        try {
          // Read file content using the File API
          const arrayBuffer = await file.arrayBuffer();
          const content = new Uint8Array(arrayBuffer);

          // Write the file to the target directory
          const result = await window.fileSystemAPI.writeBinaryFileToDirectory(
            targetDir,
            file.name,
            content
          );

          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (readError) {
          // NotFoundError typically means it's a directory (can't read directories via File API)
          const isNotFoundError =
            readError instanceof Error &&
            (readError.name === 'NotFoundError' ||
              readError.message.includes('could not be found'));

          if (isNotFoundError) {
            $q.notify({
              type: 'warning',
              message: t('explorer.cannotCopyFolderFromSource', { name: file.name }),
              position: 'top',
              timeout: 4000,
            });
          }
          errorCount++;
        }
        continue;
      }

      // Check if it's a file or directory using the file path
      let isDirectory = false;

      // Try to get file info via IPC
      if (window.fileSystemAPI.getExternalFileInfo) {
        const fileInfo = await window.fileSystemAPI.getExternalFileInfo(filePath);
        isDirectory = fileInfo?.isDirectory ?? false;
      } else {
        // Fallback: directories typically have no extension and empty type
        const hasExtension = filePath.split('/').pop()?.includes('.') ?? false;
        isDirectory = !hasExtension && file.type === '' && file.size === 0;
      }

      if (isDirectory) {
        const result = await window.fileSystemAPI.copyDirectory(filePath, targetDir);
        if (result.success) {
          successCount++;
          // Track copied directory paths for loading their contents
          if (result.newPath) {
            copiedDirPaths.push(result.newPath);
          }
        } else {
          errorCount++;
        }
      } else {
        const result = await window.fileSystemAPI.copyFileToDirectory(filePath, targetDir);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      }
    }

    // Refresh tree and reload directory structure for non-markdown files
    await refreshFiles();
    // Invalidate cache so we get fresh data from file system
    projectStore.invalidateTreeCache(targetDir);
    // Also reload the specific directory to update non-markdown files cache
    await loadDirectoryStructure(targetDir);

    // Auto-expand the parent folder so user can see the new items
    expandedFolders.value.add(targetDir);

    // Load contents of copied directories recursively and auto-expand them
    for (const dirPath of copiedDirPaths) {
      projectStore.invalidateTreeCache(dirPath);
      expandedFolders.value.add(dirPath);
      // Load recursively to get all nested subdirectories and files
      await loadDirectoryStructure(dirPath, true);
    }

    // Trigger Vue reactivity by creating a new Set reference
    expandedFolders.value = new Set(expandedFolders.value);

    // Show notification
    if (successCount > 0) {
      $q.notify({
        type: 'positive',
        message: t('explorer.itemsAdded', { count: successCount }),
        position: 'top',
        timeout: 2000,
      });
    }
    if (errorCount > 0) {
      $q.notify({
        type: 'negative',
        message: t('explorer.itemsAddError', { count: errorCount }),
        position: 'top',
        timeout: 4000,
      });
    }
  } catch (err) {
    console.error('Failed to copy files:', err);
    showError(t('explorer.dropError'));
  } finally {
    $q.loading.hide();
  }
}

function handleDragEnd(): void {
  draggedNode.value = null;
  dropTarget.value = null;
}

// Check if node is drop target
function isDropTargetActive(node: ITreeNode): boolean {
  return dropTarget.value?.id === node.id;
}

// Show error notification
function showError(message: string): void {
  $q.notify({
    type: 'negative',
    message,
    position: 'top',
    timeout: 4000,
  });
}

function showSuccess(message: string): void {
  $q.notify({
    type: 'positive',
    message,
    position: 'top',
    timeout: 2000,
  });
}

// Initialize stores (only in Electron)
onMounted(async () => {
  if (!isElectron.value) return;

  try {
    await Promise.all([
      promptStore.initialize(),
      snippetStore.initialize(),
      projectStore.initialize(),
      settingsStore.initialize(),
    ]);
    await promptStore.refreshAllPrompts();

    // Load directory structures for all projects
    for (const project of allProjects.value) {
      await loadDirectoryStructure(project.folderPath);
    }
  } catch (err) {
    console.warn('Failed to initialize file stores:', err);
  }
});

// Watch for changes to refresh the tree (using reactive refs for proper tracking)
watch(
  [() => allPrompts.value.length, () => allSnippets.value.length, () => allProjects.value.length],
  () => {
    // Tree will automatically update via computed
    // Force reactivity update
    directoryStructureVersion.value++;
  }
);
</script>

<template>
  <div
    class="explorer-panel"
    data-testid="explorer-panel"
  >
    <!-- Header with search and actions -->
    <div class="explorer-panel__header">
      <q-input
        v-model="searchQuery"
        placeholder="Search files..."
        outlined
        dense
        clearable
        class="explorer-panel__search"
        data-testid="explorer-search"
      />
      <q-btn
        flat
        dense
        round
        :icon="categoryFilter ? 'filter_alt' : 'filter_alt_off'"
        :color="categoryFilter ? 'primary' : undefined"
        size="sm"
        data-testid="category-filter"
      >
        <q-tooltip>{{
          categoryFilter ? `Filter: ${getCategoryLabel(categoryFilter)}` : 'Filter by category'
        }}</q-tooltip>
        <q-menu>
          <q-list
            dense
            style="min-width: 150px"
          >
            <q-item-label header>Filter by Category</q-item-label>
            <q-item
              v-close-popup
              clickable
              :active="!categoryFilter"
              @click="categoryFilter = null"
            >
              <q-item-section>{{ t('explorer.allCategories') }}</q-item-section>
            </q-item>
            <q-separator />
            <q-item
              v-for="cat in settingsStore.categories"
              :key="cat.value"
              v-close-popup
              clickable
              :active="categoryFilter === cat.value"
              @click="categoryFilter = cat.value"
            >
              <q-item-section>{{ cat.label }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
      <q-btn
        flat
        dense
        round
        icon="refresh"
        size="sm"
        @click="refreshFiles"
      >
        <q-tooltip>{{ t('common.refresh') }}</q-tooltip>
      </q-btn>
      <q-btn
        flat
        dense
        round
        icon="add"
        size="sm"
      >
        <q-tooltip>{{ t('tooltips.newFile') }}</q-tooltip>
        <q-menu>
          <q-list
            dense
            style="min-width: 150px"
          >
            <q-item
              v-close-popup
              clickable
              data-testid="new-prompt-btn"
              @click="showNewPromptDialog = true"
            >
              <q-item-section avatar>
                <q-icon
                  name="description"
                  size="20px"
                />
              </q-item-section>
              <q-item-section>{{ t('explorer.newPrompt') }}</q-item-section>
            </q-item>
            <q-item
              v-close-popup
              clickable
              data-testid="new-project-btn"
              @click="showNewProjectDialog = true"
            >
              <q-item-section avatar>
                <q-icon
                  name="folder_special"
                  size="20px"
                />
              </q-item-section>
              <q-item-section>{{ t('explorer.newProject') }}</q-item-section>
            </q-item>
            <q-separator />
            <q-item
              v-close-popup
              clickable
              @click="showNewSnippetDialog = true"
            >
              <q-item-section avatar>
                <q-icon
                  name="code"
                  size="20px"
                />
              </q-item-section>
              <q-item-section>{{ t('snippetsPanel.createNew') }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </div>

    <!-- Tree view -->
    <div class="explorer-panel__content">
      <q-scroll-area class="explorer-panel__scroll">
        <!-- Browser mode message -->
        <div
          v-if="!isElectron"
          class="explorer-panel__browser-mode"
        >
          <q-icon
            name="info"
            size="32px"
            class="text-grey-6 q-mb-sm"
          />
          <p class="text-grey-6 text-caption text-center">
            File explorer is available in the desktop app.
          </p>
          <p class="text-grey-7 text-caption text-center q-mt-sm">
            Running in browser preview mode.
          </p>
        </div>

        <!-- Loading state -->
        <div
          v-else-if="promptStore.isLoading || snippetStore.isLoading"
          class="explorer-panel__loading"
        >
          <q-spinner-dots
            color="primary"
            size="32px"
          />
        </div>

        <!-- Tree nodes -->
        <div
          v-else
          class="explorer-panel__tree"
          data-testid="project-tree"
        >
          <template
            v-for="folder in fileTree"
            :key="folder.id"
          >
            <!-- Folder node -->
            <div
              class="explorer-panel__folder"
              :class="{
                'explorer-panel__folder--drop-target': isDropTargetActive(folder),
                'explorer-panel__folder--external-drop-target': isExternalDropTarget(folder),
              }"
              :data-testid="`folder-${folder.id}`"
              :data-node-id="folder.id"
              @click="toggleFolder(folder.id)"
              @dragover="folder.isDropTarget ? handleDragOver($event, folder) : null"
              @dragleave="handleDragLeave($event, folder)"
              @drop="folder.isDropTarget ? handleDrop($event, folder) : null"
            >
              <q-icon
                :name="isExpanded(folder.id) ? 'expand_more' : 'chevron_right'"
                size="18px"
                class="explorer-panel__chevron"
                data-testid="expand-icon"
              />
              <q-icon
                :name="isExpanded(folder.id) ? 'folder_open' : 'folder'"
                size="18px"
                class="explorer-panel__folder-icon"
              />
              <span class="explorer-panel__folder-label">{{ folder.label }}</span>
              <q-badge
                v-if="folder.count !== undefined && folder.count > 0"
                :label="folder.count"
                color="grey-7"
                text-color="white"
                class="explorer-panel__count"
              />

              <!-- Folder context menu -->
              <q-menu context-menu>
                <q-list
                  dense
                  style="min-width: 150px"
                >
                  <q-item
                    v-if="folder.id === 'prompts'"
                    v-close-popup
                    clickable
                    @click="showNewPromptDialog = true"
                  >
                    <q-item-section avatar>
                      <q-icon
                        name="add"
                        size="20px"
                      />
                    </q-item-section>
                    <q-item-section>{{ t('explorer.newPrompt') }}</q-item-section>
                  </q-item>
                  <q-item
                    v-if="folder.id === 'prompts'"
                    v-close-popup
                    clickable
                    @click="showNewProjectDialog = true"
                  >
                    <q-item-section avatar>
                      <q-icon
                        name="create_new_folder"
                        size="20px"
                      />
                    </q-item-section>
                    <q-item-section>{{ t('explorer.newProject') }}</q-item-section>
                  </q-item>
                  <q-item
                    v-if="folder.id === 'prompts'"
                    v-close-popup
                    clickable
                    @click="addFileToDirectory(promptsDir)"
                  >
                    <q-item-section avatar>
                      <q-icon
                        name="note_add"
                        size="20px"
                      />
                    </q-item-section>
                    <q-item-section>{{ t('explorer.addFile') }}</q-item-section>
                  </q-item>
                  <q-item
                    v-if="folder.id === 'prompts'"
                    v-close-popup
                    clickable
                    @click="addFolderToDirectory(promptsDir)"
                  >
                    <q-item-section avatar>
                      <q-icon
                        name="folder_copy"
                        size="20px"
                      />
                    </q-item-section>
                    <q-item-section>{{ t('explorer.addFolder') }}</q-item-section>
                  </q-item>
                  <q-item
                    v-if="folder.id !== 'prompts'"
                    v-close-popup
                    clickable
                    @click="showNewSnippetDialog = true"
                  >
                    <q-item-section avatar>
                      <q-icon
                        name="add"
                        size="20px"
                      />
                    </q-item-section>
                    <q-item-section>{{ t('snippetsPanel.createNew') }}</q-item-section>
                  </q-item>
                  <q-item
                    v-if="folder.id === 'personas' && folder.children?.length === 0"
                    v-close-popup
                    clickable
                    @click="handleInitializePersonas"
                  >
                    <q-item-section avatar>
                      <q-icon
                        name="auto_awesome"
                        size="20px"
                      />
                    </q-item-section>
                    <q-item-section>{{ t('explorer.initializePersonas') }}</q-item-section>
                  </q-item>
                  <q-separator />
                  <q-item
                    v-close-popup
                    clickable
                    @click="refreshFiles"
                  >
                    <q-item-section avatar>
                      <q-icon
                        name="refresh"
                        size="20px"
                      />
                    </q-item-section>
                    <q-item-section>{{ t('common.refresh') }}</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </div>

            <!-- Child nodes (recursive) -->
            <template v-if="isExpanded(folder.id) && folder.children">
              <template
                v-for="child in folder.children"
                :key="child.id"
              >
                <!-- Project or Directory node -->
                <div
                  v-if="child.type === 'project' || child.type === 'directory'"
                  class="explorer-panel__folder"
                  :class="{
                    'explorer-panel__folder--nested': true,
                    'explorer-panel__folder--drop-target': isDropTargetActive(child),
                    'explorer-panel__folder--external-drop-target': isExternalDropTarget(child),
                  }"
                  :style="{ paddingLeft: `${(child.depth ?? 0) * 16 + 24}px` }"
                  :data-testid="child.type === 'project' ? 'project-item' : 'directory-item'"
                  :data-node-id="child.id"
                  @click="toggleFolder(child.id)"
                  @dragover="handleDragOver($event, child)"
                  @dragleave="handleDragLeave($event, child)"
                  @drop="handleDrop($event, child)"
                >
                  <q-icon
                    :name="isExpanded(child.id) ? 'expand_more' : 'chevron_right'"
                    size="18px"
                    class="explorer-panel__chevron"
                  />
                  <q-icon
                    :name="
                      child.type === 'project'
                        ? 'folder_special'
                        : isExpanded(child.id)
                          ? 'folder_open'
                          : 'folder'
                    "
                    size="18px"
                    class="explorer-panel__folder-icon"
                  />
                  <span class="explorer-panel__folder-label">{{ child.label }}</span>
                  <!-- Branch indicator for projects -->
                  <q-chip
                    v-if="child.type === 'project' && getProjectBranch(child.filePath!)"
                    dense
                    size="sm"
                    color="grey-8"
                    text-color="white"
                    icon="mdi-source-branch"
                    class="explorer-panel__branch-chip"
                    clickable
                    @click.stop="openBranchDialog(child.filePath!, child.label)"
                  >
                    {{ getProjectBranch(child.filePath!) }}
                    <q-tooltip>Click to switch branches</q-tooltip>
                  </q-chip>
                  <q-badge
                    v-if="child.count !== undefined && child.count > 0"
                    :label="child.count"
                    color="grey-7"
                    text-color="white"
                    class="explorer-panel__count"
                  />

                  <!-- Project/Directory context menu -->
                  <q-menu context-menu>
                    <q-list
                      dense
                      style="min-width: 180px"
                    >
                      <q-item
                        v-close-popup
                        clickable
                        @click="openNewPromptDialogForDirectory(child.filePath!)"
                      >
                        <q-item-section avatar>
                          <q-icon
                            name="add"
                            size="20px"
                          />
                        </q-item-section>
                        <q-item-section>{{ t('explorer.newPrompt') }}</q-item-section>
                      </q-item>
                      <q-item
                        v-close-popup
                        clickable
                        @click="openNewDirectoryDialog(child.filePath!, child.label)"
                      >
                        <q-item-section avatar>
                          <q-icon
                            name="create_new_folder"
                            size="20px"
                          />
                        </q-item-section>
                        <q-item-section>{{ t('explorer.newDirectory') }}</q-item-section>
                      </q-item>
                      <q-item
                        v-close-popup
                        clickable
                        @click="addFileToDirectory(child.filePath!)"
                      >
                        <q-item-section avatar>
                          <q-icon
                            name="note_add"
                            size="20px"
                          />
                        </q-item-section>
                        <q-item-section>{{ t('explorer.addFile') }}</q-item-section>
                      </q-item>
                      <q-item
                        v-close-popup
                        clickable
                        @click="addFolderToDirectory(child.filePath!)"
                      >
                        <q-item-section avatar>
                          <q-icon
                            name="folder_copy"
                            size="20px"
                          />
                        </q-item-section>
                        <q-item-section>{{ t('explorer.addFolder') }}</q-item-section>
                      </q-item>

                      <!-- Git submenu for projects -->
                      <template v-if="child.type === 'project'">
                        <q-separator />
                        <q-item clickable>
                          <q-item-section avatar>
                            <q-icon
                              name="mdi-git"
                              size="20px"
                              color="orange"
                            />
                          </q-item-section>
                          <q-item-section>{{ t('gitPanel.title') }}</q-item-section>
                          <q-item-section side>
                            <q-icon name="keyboard_arrow_right" />
                          </q-item-section>

                          <!-- Git submenu -->
                          <q-menu
                            anchor="top end"
                            self="top start"
                          >
                            <q-list
                              dense
                              style="min-width: 160px"
                            >
                              <q-item
                                v-close-popup
                                clickable
                                @click="handleGitPull(child.filePath!)"
                              >
                                <q-item-section avatar>
                                  <q-icon
                                    name="mdi-arrow-down"
                                    size="20px"
                                  />
                                </q-item-section>
                                <q-item-section>{{ t('gitPanel.pull') }}</q-item-section>
                              </q-item>
                              <q-item
                                v-close-popup
                                clickable
                                @click="handleGitPush(child.filePath!)"
                              >
                                <q-item-section avatar>
                                  <q-icon
                                    name="mdi-arrow-up"
                                    size="20px"
                                  />
                                </q-item-section>
                                <q-item-section>{{ t('gitPanel.push') }}</q-item-section>
                              </q-item>
                              <q-item
                                v-close-popup
                                clickable
                                @click="handleGitFetch(child.filePath!)"
                              >
                                <q-item-section avatar>
                                  <q-icon
                                    name="mdi-cloud-download"
                                    size="20px"
                                  />
                                </q-item-section>
                                <q-item-section>{{ t('gitPanel.fetch') }}</q-item-section>
                              </q-item>
                              <q-item
                                v-close-popup
                                clickable
                                @click="handleGitSync(child.filePath!)"
                              >
                                <q-item-section avatar>
                                  <q-icon
                                    name="mdi-sync"
                                    size="20px"
                                  />
                                </q-item-section>
                                <q-item-section>{{ t('gitPanel.sync') }}</q-item-section>
                              </q-item>
                              <q-separator />
                              <q-item
                                v-close-popup
                                clickable
                                @click="openBranchDialog(child.filePath!, child.label)"
                              >
                                <q-item-section avatar>
                                  <q-icon
                                    name="mdi-source-branch"
                                    size="20px"
                                  />
                                </q-item-section>
                                <q-item-section>{{ t('gitPanel.branches') }}</q-item-section>
                              </q-item>
                              <q-item
                                v-close-popup
                                clickable
                                @click="handleProjectGitHistory(child.filePath!, child.label)"
                              >
                                <q-item-section avatar>
                                  <q-icon
                                    name="mdi-history"
                                    size="20px"
                                  />
                                </q-item-section>
                                <q-item-section>{{ t('gitPanel.viewHistory') }}</q-item-section>
                              </q-item>
                              <q-separator />
                              <q-item
                                v-close-popup
                                clickable
                                @click="openGitSetup(child.filePath!, child.label)"
                              >
                                <q-item-section avatar>
                                  <q-icon
                                    name="mdi-cog"
                                    size="20px"
                                  />
                                </q-item-section>
                                <q-item-section>{{ t('activityBar.settings') }}</q-item-section>
                              </q-item>
                            </q-list>
                          </q-menu>
                        </q-item>
                      </template>

                      <!-- File Sync option for projects -->
                      <template v-if="child.type === 'project' && isElectron">
                        <q-item
                          v-close-popup
                          clickable
                          @click="openFileSyncDialog(child.filePath!)"
                        >
                          <q-item-section avatar>
                            <q-icon
                              name="mdi-folder-sync"
                              size="20px"
                              color="primary"
                            />
                          </q-item-section>
                          <q-item-section>{{ t('fileSync.folders') }}</q-item-section>
                        </q-item>
                      </template>

                      <q-separator />
                      <q-item
                        v-close-popup
                        clickable
                        @click="openRenameDialog(child)"
                      >
                        <q-item-section avatar>
                          <q-icon
                            name="edit"
                            size="20px"
                          />
                        </q-item-section>
                        <q-item-section>{{ t('common.rename') }}</q-item-section>
                      </q-item>
                      <q-separator />
                      <q-item
                        v-close-popup
                        clickable
                        class="text-negative"
                        @click="confirmDelete(child)"
                      >
                        <q-item-section avatar>
                          <q-icon
                            name="delete"
                            size="20px"
                            color="negative"
                          />
                        </q-item-section>
                        <q-item-section>{{ t('common.delete') }}</q-item-section>
                      </q-item>
                    </q-list>
                  </q-menu>
                </div>

                <!-- Nested children of project/directory -->
                <template
                  v-if="
                    (child.type === 'project' || child.type === 'directory') &&
                    isExpanded(child.id) &&
                    child.children
                  "
                >
                  <template
                    v-for="nested in child.children"
                    :key="nested.id"
                  >
                    <!-- Nested directory -->
                    <div
                      v-if="nested.type === 'directory'"
                      class="explorer-panel__folder explorer-panel__folder--nested"
                      :class="{
                        'explorer-panel__folder--drop-target': isDropTargetActive(nested),
                        'explorer-panel__folder--external-drop-target':
                          isExternalDropTarget(nested),
                      }"
                      :style="{ paddingLeft: `${(nested.depth ?? 1) * 16 + 24}px` }"
                      :data-node-id="nested.id"
                      @click="toggleFolder(nested.id)"
                      @dragover="handleDragOver($event, nested)"
                      @dragleave="handleDragLeave($event, nested)"
                      @drop="handleDrop($event, nested)"
                    >
                      <q-icon
                        :name="isExpanded(nested.id) ? 'expand_more' : 'chevron_right'"
                        size="18px"
                        class="explorer-panel__chevron"
                      />
                      <q-icon
                        :name="isExpanded(nested.id) ? 'folder_open' : 'folder'"
                        size="18px"
                        class="explorer-panel__folder-icon"
                      />
                      <span class="explorer-panel__folder-label">{{ nested.label }}</span>
                      <q-badge
                        v-if="nested.count !== undefined && nested.count > 0"
                        :label="nested.count"
                        color="grey-7"
                        text-color="white"
                        class="explorer-panel__count"
                      />

                      <!-- Nested directory context menu -->
                      <q-menu context-menu>
                        <q-list
                          dense
                          style="min-width: 150px"
                        >
                          <q-item
                            v-close-popup
                            clickable
                            @click="openNewPromptDialogForDirectory(nested.filePath!)"
                          >
                            <q-item-section avatar>
                              <q-icon
                                name="add"
                                size="20px"
                              />
                            </q-item-section>
                            <q-item-section>{{ t('explorer.newPrompt') }}</q-item-section>
                          </q-item>
                          <q-item
                            v-close-popup
                            clickable
                            @click="openNewDirectoryDialog(nested.filePath!, nested.label)"
                          >
                            <q-item-section avatar>
                              <q-icon
                                name="create_new_folder"
                                size="20px"
                              />
                            </q-item-section>
                            <q-item-section>{{ t('explorer.newDirectory') }}</q-item-section>
                          </q-item>
                          <q-item
                            v-close-popup
                            clickable
                            @click="addFileToDirectory(nested.filePath!)"
                          >
                            <q-item-section avatar>
                              <q-icon
                                name="note_add"
                                size="20px"
                              />
                            </q-item-section>
                            <q-item-section>{{ t('explorer.addFile') }}</q-item-section>
                          </q-item>
                          <q-item
                            v-close-popup
                            clickable
                            @click="addFolderToDirectory(nested.filePath!)"
                          >
                            <q-item-section avatar>
                              <q-icon
                                name="folder_copy"
                                size="20px"
                              />
                            </q-item-section>
                            <q-item-section>{{ t('explorer.addFolder') }}</q-item-section>
                          </q-item>
                          <q-separator />
                          <q-item
                            v-close-popup
                            clickable
                            @click="openRenameDialog(nested)"
                          >
                            <q-item-section avatar>
                              <q-icon
                                name="edit"
                                size="20px"
                              />
                            </q-item-section>
                            <q-item-section>{{ t('common.rename') }}</q-item-section>
                          </q-item>
                          <q-separator />
                          <q-item
                            v-close-popup
                            clickable
                            class="text-negative"
                            @click="confirmDelete(nested)"
                          >
                            <q-item-section avatar>
                              <q-icon
                                name="delete"
                                size="20px"
                                color="negative"
                              />
                            </q-item-section>
                            <q-item-section>{{ t('common.delete') }}</q-item-section>
                          </q-item>
                        </q-list>
                      </q-menu>
                    </div>

                    <!-- Children of nested directory (recursive via ExplorerTreeNode) -->
                    <template v-if="isExpanded(nested.id) && nested.children">
                      <ExplorerTreeNode
                        v-for="deepChild in nested.children"
                        :key="deepChild.id"
                        :node="deepChild"
                        :is-expanded="isExpanded"
                        :is-drop-target-active="isDropTargetActive"
                        :is-external-drop-target="isExternalDropTarget"
                        :get-category-label="getCategoryLabel"
                        :file-is-in-project="fileIsInProject"
                        :file-is-tracked="fileIsTracked"
                        :file-is-staged="fileIsStaged"
                        @toggle-folder="toggleFolder"
                        @open-file="openFile"
                        @confirm-delete="confirmDelete"
                        @open-rename-dialog="openRenameDialog"
                        @open-edit-prompt-dialog="openEditPromptDialog"
                        @toggle-favorite="toggleFavorite"
                        @open-new-prompt-dialog="openNewPromptDialogForDirectory"
                        @open-new-directory-dialog="openNewDirectoryDialog"
                        @add-file-to-directory="addFileToDirectory"
                        @add-folder-to-directory="addFolderToDirectory"
                        @drag-start="handleDragStart"
                        @drag-end="handleDragEnd"
                        @drag-over="handleDragOver"
                        @drag-leave="handleDragLeave"
                        @drop="handleDrop"
                        @git-stage="handleGitAddFile"
                        @git-unstage="handleGitUnstageFile"
                        @git-commit="handleGitCommitFile"
                        @git-discard="handleGitDiscardChanges"
                        @git-history="handleGitHistory"
                      />
                    </template>

                    <!-- File in nested directory -->
                    <div
                      v-if="nested.type !== 'directory'"
                      class="explorer-panel__file"
                      :style="{ paddingLeft: `${(nested.depth ?? 1) * 16 + 32}px` }"
                      draggable="true"
                      data-testid="file-item"
                      @click="openFile(nested)"
                      @dblclick="openFile(nested)"
                      @dragstart="handleDragStart($event, nested)"
                      @dragend="handleDragEnd"
                    >
                      <q-icon
                        :name="nested.icon"
                        size="16px"
                        class="explorer-panel__file-icon"
                      />
                      <span class="explorer-panel__file-label">{{ nested.label }}</span>
                      <q-badge
                        v-if="nested.type === 'prompt' && nested.category"
                        :label="getCategoryLabel(nested.category)"
                        color="grey-7"
                        text-color="white"
                        class="explorer-panel__category-badge"
                      />

                      <!-- File context menu -->
                      <q-menu context-menu>
                        <q-list
                          dense
                          style="min-width: 180px"
                        >
                          <q-item
                            v-close-popup
                            clickable
                            @click="openFile(nested)"
                          >
                            <q-item-section avatar>
                              <q-icon
                                name="open_in_new"
                                size="20px"
                              />
                            </q-item-section>
                            <q-item-section>{{ t('common.open') }}</q-item-section>
                          </q-item>
                          <q-item
                            v-if="nested.type === 'prompt'"
                            v-close-popup
                            clickable
                            @click="toggleFavorite(nested)"
                          >
                            <q-item-section avatar>
                              <q-icon
                                name="star"
                                size="20px"
                              />
                            </q-item-section>
                            <q-item-section>{{ t('explorer.toggleFavorite') }}</q-item-section>
                          </q-item>
                          <!-- Edit for prompts -->
                          <q-item
                            v-if="nested.type === 'prompt'"
                            v-close-popup
                            clickable
                            @click="openEditPromptDialog(nested)"
                          >
                            <q-item-section avatar>
                              <q-icon
                                name="edit"
                                size="20px"
                              />
                            </q-item-section>
                            <q-item-section>{{ t('common.edit') }}</q-item-section>
                          </q-item>
                          <!-- Rename for snippets -->
                          <q-item
                            v-else
                            v-close-popup
                            clickable
                            @click="openRenameDialog(nested)"
                          >
                            <q-item-section avatar>
                              <q-icon
                                name="edit"
                                size="20px"
                              />
                            </q-item-section>
                            <q-item-section>{{ t('common.rename') }}</q-item-section>
                          </q-item>

                          <!-- Git submenu for files in projects -->
                          <template
                            v-if="
                              (nested.type === 'prompt' || nested.type === 'file') &&
                              nested.filePath
                            "
                          >
                            <q-separator />
                            <q-item clickable>
                              <q-item-section avatar>
                                <q-icon
                                  name="mdi-git"
                                  size="20px"
                                  color="orange"
                                />
                              </q-item-section>
                              <q-item-section>{{ t('gitPanel.title') }}</q-item-section>
                              <q-item-section side>
                                <q-icon name="keyboard_arrow_right" />
                              </q-item-section>

                              <!-- Git submenu -->
                              <q-menu
                                anchor="top end"
                                self="top start"
                              >
                                <q-list
                                  dense
                                  style="min-width: 160px"
                                >
                                  <!-- Add File (if not staged) -->
                                  <q-item
                                    v-if="fileNeedsAdd(nested.filePath)"
                                    v-close-popup
                                    clickable
                                    @click="handleGitAddFile(nested.filePath)"
                                  >
                                    <q-item-section avatar>
                                      <q-icon
                                        name="mdi-plus-circle"
                                        size="20px"
                                        color="positive"
                                      />
                                    </q-item-section>
                                    <q-item-section>{{ t('common.add') }}</q-item-section>
                                  </q-item>
                                  <!-- Ignore File (if untracked) -->
                                  <q-item
                                    v-if="fileCanBeIgnored(nested.filePath)"
                                    v-close-popup
                                    clickable
                                    @click="handleGitIgnoreFile(nested.filePath)"
                                  >
                                    <q-item-section avatar>
                                      <q-icon
                                        name="mdi-eye-off"
                                        size="20px"
                                        color="grey"
                                      />
                                    </q-item-section>
                                    <q-item-section>{{ t('explorer.ignore') }}</q-item-section>
                                  </q-item>
                                  <!-- Commit File (if staged) -->
                                  <q-item
                                    v-if="fileIsStaged(nested.filePath)"
                                    v-close-popup
                                    clickable
                                    @click="handleGitCommitFile(nested.filePath)"
                                  >
                                    <q-item-section avatar>
                                      <q-icon
                                        name="mdi-source-commit"
                                        size="20px"
                                      />
                                    </q-item-section>
                                    <q-item-section>{{ t('gitPanel.commit') }}</q-item-section>
                                  </q-item>
                                  <!-- Reject/Discard (if staged) -->
                                  <q-item
                                    v-if="fileIsStaged(nested.filePath)"
                                    v-close-popup
                                    clickable
                                    @click="handleGitDiscardChanges(nested.filePath)"
                                  >
                                    <q-item-section avatar>
                                      <q-icon
                                        name="mdi-undo"
                                        size="20px"
                                        color="negative"
                                      />
                                    </q-item-section>
                                    <q-item-section>{{ t('gitPanel.discard') }}</q-item-section>
                                  </q-item>
                                  <!-- History (if tracked - has commits) -->
                                  <q-item
                                    v-if="fileIsTracked(nested.filePath)"
                                    v-close-popup
                                    clickable
                                    @click="handleGitHistory(nested.filePath)"
                                  >
                                    <q-item-section avatar>
                                      <q-icon
                                        name="mdi-history"
                                        size="20px"
                                      />
                                    </q-item-section>
                                    <q-item-section>{{ t('gitPanel.viewHistory') }}</q-item-section>
                                  </q-item>
                                </q-list>
                              </q-menu>
                            </q-item>
                          </template>

                          <q-separator />
                          <q-item
                            v-close-popup
                            clickable
                            class="text-negative"
                            @click="confirmDelete(nested)"
                          >
                            <q-item-section avatar>
                              <q-icon
                                name="delete"
                                size="20px"
                                color="negative"
                              />
                            </q-item-section>
                            <q-item-section>{{ t('common.delete') }}</q-item-section>
                          </q-item>
                        </q-list>
                      </q-menu>
                    </div>
                  </template>

                  <!-- Empty project/directory message -->
                  <div
                    v-if="child.children?.length === 0"
                    class="explorer-panel__empty-folder"
                    :style="{ paddingLeft: `${(child.depth ?? 0) * 16 + 40}px` }"
                  >
                    <span class="text-grey-6 text-caption">No files</span>
                  </div>
                </template>

                <!-- File node (prompts or snippets) -->
                <div
                  v-if="child.type !== 'project' && child.type !== 'directory'"
                  class="explorer-panel__file"
                  :style="{ paddingLeft: `${(child.depth ?? 0) * 16 + 32}px` }"
                  :draggable="child.isDraggable ? 'true' : 'false'"
                  data-testid="file-item"
                  @click="openFile(child)"
                  @dblclick="openFile(child)"
                  @dragstart="child.isDraggable ? handleDragStart($event, child) : null"
                  @dragend="handleDragEnd"
                >
                  <q-icon
                    :name="child.icon"
                    size="16px"
                    class="explorer-panel__file-icon"
                  />
                  <span class="explorer-panel__file-label">{{ child.label }}</span>
                  <q-badge
                    v-if="child.type === 'prompt' && child.category"
                    :label="getCategoryLabel(child.category)"
                    color="grey-7"
                    text-color="white"
                    class="explorer-panel__category-badge"
                  />

                  <!-- File context menu -->
                  <q-menu context-menu>
                    <q-list
                      dense
                      style="min-width: 180px"
                    >
                      <q-item
                        v-close-popup
                        clickable
                        @click="openFile(child)"
                      >
                        <q-item-section avatar>
                          <q-icon
                            name="open_in_new"
                            size="20px"
                          />
                        </q-item-section>
                        <q-item-section>{{ t('common.open') }}</q-item-section>
                      </q-item>
                      <q-item
                        v-if="child.type === 'prompt'"
                        v-close-popup
                        clickable
                        @click="toggleFavorite(child)"
                      >
                        <q-item-section avatar>
                          <q-icon
                            name="star"
                            size="20px"
                          />
                        </q-item-section>
                        <q-item-section>{{ t('explorer.toggleFavorite') }}</q-item-section>
                      </q-item>
                      <!-- Edit for prompts -->
                      <q-item
                        v-if="child.type === 'prompt'"
                        v-close-popup
                        clickable
                        @click="openEditPromptDialog(child)"
                      >
                        <q-item-section avatar>
                          <q-icon
                            name="edit"
                            size="20px"
                          />
                        </q-item-section>
                        <q-item-section>{{ t('common.edit') }}</q-item-section>
                      </q-item>
                      <!-- Rename for snippets -->
                      <q-item
                        v-else
                        v-close-popup
                        clickable
                        @click="openRenameDialog(child)"
                      >
                        <q-item-section avatar>
                          <q-icon
                            name="edit"
                            size="20px"
                          />
                        </q-item-section>
                        <q-item-section>{{ t('common.rename') }}</q-item-section>
                      </q-item>

                      <!-- Git submenu for files in projects -->
                      <template
                        v-if="
                          (child.type === 'prompt' || child.type === 'file') &&
                          child.filePath &&
                          fileIsInProject(child.filePath)
                        "
                      >
                        <q-separator />
                        <q-item clickable>
                          <q-item-section avatar>
                            <q-icon
                              name="mdi-git"
                              size="20px"
                              color="orange"
                            />
                          </q-item-section>
                          <q-item-section>{{ t('gitPanel.title') }}</q-item-section>
                          <q-item-section side>
                            <q-icon name="keyboard_arrow_right" />
                          </q-item-section>

                          <!-- Git submenu -->
                          <q-menu
                            anchor="top end"
                            self="top start"
                          >
                            <q-list
                              dense
                              style="min-width: 160px"
                            >
                              <!-- Add File (if not staged) -->
                              <q-item
                                v-if="fileNeedsAdd(child.filePath)"
                                v-close-popup
                                clickable
                                @click="handleGitAddFile(child.filePath)"
                              >
                                <q-item-section avatar>
                                  <q-icon
                                    name="mdi-plus-circle"
                                    size="20px"
                                    color="positive"
                                  />
                                </q-item-section>
                                <q-item-section>{{ t('common.add') }}</q-item-section>
                              </q-item>
                              <!-- Ignore File (if untracked) -->
                              <q-item
                                v-if="fileCanBeIgnored(child.filePath)"
                                v-close-popup
                                clickable
                                @click="handleGitIgnoreFile(child.filePath)"
                              >
                                <q-item-section avatar>
                                  <q-icon
                                    name="mdi-eye-off"
                                    size="20px"
                                    color="grey"
                                  />
                                </q-item-section>
                                <q-item-section>{{ t('explorer.ignore') }}</q-item-section>
                              </q-item>
                              <q-separator
                                v-if="
                                  fileNeedsAdd(child.filePath) || fileCanBeIgnored(child.filePath)
                                "
                              />
                              <!-- Commit File (if staged) -->
                              <q-item
                                v-if="fileIsStaged(child.filePath)"
                                v-close-popup
                                clickable
                                @click="handleGitCommitFile(child.filePath)"
                              >
                                <q-item-section avatar>
                                  <q-icon
                                    name="mdi-source-commit"
                                    size="20px"
                                  />
                                </q-item-section>
                                <q-item-section>{{ t('gitPanel.commit') }}</q-item-section>
                              </q-item>
                              <!-- Reject/Discard (if staged) -->
                              <q-item
                                v-if="fileIsStaged(child.filePath)"
                                v-close-popup
                                clickable
                                @click="handleGitDiscardChanges(child.filePath)"
                              >
                                <q-item-section avatar>
                                  <q-icon
                                    name="mdi-undo"
                                    size="20px"
                                    color="negative"
                                  />
                                </q-item-section>
                                <q-item-section>{{ t('gitPanel.discard') }}</q-item-section>
                              </q-item>
                              <!-- History (if tracked - has commits) -->
                              <q-item
                                v-if="fileIsTracked(child.filePath)"
                                v-close-popup
                                clickable
                                @click="handleGitHistory(child.filePath)"
                              >
                                <q-item-section avatar>
                                  <q-icon
                                    name="mdi-history"
                                    size="20px"
                                  />
                                </q-item-section>
                                <q-item-section>{{ t('gitPanel.viewHistory') }}</q-item-section>
                              </q-item>
                            </q-list>
                          </q-menu>
                        </q-item>
                      </template>

                      <q-separator />
                      <q-item
                        v-close-popup
                        clickable
                        class="text-negative"
                        @click="confirmDelete(child)"
                      >
                        <q-item-section avatar>
                          <q-icon
                            name="delete"
                            size="20px"
                            color="negative"
                          />
                        </q-item-section>
                        <q-item-section>{{ t('common.delete') }}</q-item-section>
                      </q-item>
                    </q-list>
                  </q-menu>
                </div>
              </template>

              <!-- Empty folder message -->
              <div
                v-if="folder.children.length === 0"
                class="explorer-panel__empty-folder"
              >
                <span class="text-grey-6 text-caption">No files</span>
              </div>
            </template>
          </template>
        </div>
      </q-scroll-area>
    </div>

    <!-- Dialogs -->
    <NewPromptDialog
      v-model="showNewPromptDialog"
      @create="handleCreatePrompt"
    />

    <NewSnippetDialog
      v-model="showNewSnippetDialog"
      @create="handleCreateSnippet"
    />

    <NewProjectDialog
      v-model="showNewProjectDialog"
      @create="handleCreateProject"
    />

    <NewDirectoryDialog
      v-model="showNewDirectoryDialog"
      :parent-path="newDirectoryParent?.path ?? ''"
      :parent-name="newDirectoryParent?.name"
      @create="handleCreateDirectory"
    />

    <DeleteConfirmDialog
      v-model="showDeleteConfirmDialog"
      :item-name="deleteTarget?.node.label ?? ''"
      :item-type="
        deleteTarget?.node.type === 'project'
          ? 'project'
          : deleteTarget?.node.type === 'directory'
            ? 'directory'
            : deleteTarget?.node.type === 'snippet'
              ? 'snippet'
              : deleteTarget?.node.type === 'file'
                ? 'file'
                : 'prompt'
      "
      :contents-count="deleteTarget?.contentsCount"
      @confirm="handleDeleteConfirm"
    />

    <RenameDialog
      v-model="showRenameDialog"
      :current-name="renameTarget?.currentName ?? ''"
      :item-type="renameTarget?.node ? getRenameItemType(renameTarget.node) : 'prompt'"
      @rename="handleRename"
    />

    <EditPromptDialog
      v-model="showEditPromptDialog"
      :current-name="editPromptTarget?.currentName ?? ''"
      :current-category="editPromptTarget?.currentCategory"
      @save="handleEditPromptSave"
    />

    <GitSetupDialog
      v-model="showGitSetupDialog"
      :project-path="gitProjectPath"
      :project-name="gitProjectName"
      @setup-complete="refreshFiles"
    />

    <GitHistoryDialog
      v-if="showGitHistoryDialog"
      v-model="showGitHistoryDialog"
      :project-path="gitProjectPath"
      :project-name="gitProjectName"
    />

    <BranchDialog
      v-if="showBranchDialog"
      v-model="showBranchDialog"
      :project-path="gitProjectPath"
      :project-name="gitProjectName"
      @branch-changed="handleBranchChanged"
    />

    <!-- File Sync Dialog -->
    <FileSyncDialog
      v-model="showFileSyncDialog"
      :project-path="fileSyncProjectPath"
    />
  </div>
</template>

<style lang="scss" scoped>
.explorer-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 8px 8px 12px;
    border-bottom: 1px solid var(--border-color, #3c3c3c);
  }

  &__search {
    flex: 1;

    :deep(.q-field__control) {
      height: 28px;
      min-height: 28px;
    }

    :deep(.q-field__native) {
      font-size: 12px;
      padding: 0;
    }
  }

  &__content {
    flex: 1;
    overflow: hidden;
  }

  &__scroll {
    height: 100%;
  }

  &__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100px;
  }

  &__browser-mode {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
  }

  &__tree {
    padding: 4px 0;
  }

  &__folder {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    cursor: pointer;
    user-select: none;
    transition: background-color 0.1s;

    &:hover {
      background-color: var(--folder-hover, #2a2d2e);
    }

    &--drop-target {
      background-color: var(--drop-target-bg, rgba(0, 120, 212, 0.2)) !important;
      outline: 1px dashed var(--drop-target-border, #0078d4);
    }

    &--external-drop-target {
      background-color: var(--external-drop-bg, rgba(34, 139, 34, 0.2)) !important;
      outline: 2px dashed var(--external-drop-border, #228b22);
    }
  }

  &__chevron {
    flex-shrink: 0;
    color: var(--chevron-color, #858585);
  }

  &__folder-icon {
    flex-shrink: 0;
    color: var(--folder-icon-color, #dcb67a);
  }

  &__folder-label {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
    color: var(--folder-text, #cccccc);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__count {
    font-size: 10px;
    padding: 2px 6px;
  }

  &__category-badge {
    font-size: 9px;
    padding: 1px 5px;
    margin-left: auto;
    flex-shrink: 0;
  }

  &__branch-chip {
    margin-left: 4px;
    font-size: 10px;
    height: 18px;
    max-width: 100px;

    :deep(.q-chip__content) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &__file {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px 3px 32px;
    cursor: pointer;
    user-select: none;
    transition: background-color 0.1s;

    &:hover {
      background-color: var(--file-hover, #2a2d2e);
    }

    &[draggable='true'] {
      cursor: grab;

      &:active {
        cursor: grabbing;
      }
    }
  }

  &__file-icon {
    flex-shrink: 0;
    color: var(--file-icon-color, #c5c5c5);
  }

  &__file-label {
    flex: 1;
    font-size: 13px;
    color: var(--file-text, #cccccc);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__empty-folder {
    padding: 8px 8px 8px 36px;
  }
}

// Light theme
.body--light .explorer-panel {
  --border-color: #e7e7e7;
  --folder-hover: #e8e8e8;
  --folder-text: #3b3b3b;
  --folder-icon-color: #c09553;
  --chevron-color: #616161;
  --file-hover: #e8e8e8;
  --file-text: #3b3b3b;
  --file-icon-color: #424242;
  --drop-target-bg: rgba(0, 120, 212, 0.1);
  --drop-target-border: #0078d4;
  --external-drop-bg: rgba(34, 139, 34, 0.15);
  --external-drop-border: #228b22;
}

// Dark theme
.body--dark .explorer-panel {
  --border-color: #3c3c3c;
  --folder-hover: #2a2d2e;
  --folder-text: #cccccc;
  --folder-icon-color: #dcb67a;
  --chevron-color: #858585;
  --file-hover: #2a2d2e;
  --file-text: #cccccc;
  --file-icon-color: #c5c5c5;
  --drop-target-bg: rgba(0, 120, 212, 0.2);
  --drop-target-border: #0078d4;
  --external-drop-bg: rgba(34, 139, 34, 0.25);
  --external-drop-border: #32cd32;
}
</style>
