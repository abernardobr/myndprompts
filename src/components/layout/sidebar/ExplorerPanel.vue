<script setup lang="ts">
/**
 * ExplorerPanel Component
 *
 * File explorer tree view for browsing and managing prompts, snippets, projects and directories.
 * Supports expanding/collapsing folders, opening files in tabs, context menus, and drag-and-drop.
 */

import { ref, computed, onMounted, watch } from 'vue';
import { useQuasar } from 'quasar';
import { usePromptStore } from '@/stores/promptStore';
import { useSnippetStore } from '@/stores/snippetStore';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { useGitStore } from '@/stores/gitStore';
import type { IPromptFile, ISnippetMetadata } from '@/services/file-system/types';
import NewPromptDialog from '@/components/dialogs/NewPromptDialog.vue';
import NewSnippetDialog from '@/components/dialogs/NewSnippetDialog.vue';
import NewProjectDialog from '@/components/dialogs/NewProjectDialog.vue';
import NewDirectoryDialog from '@/components/dialogs/NewDirectoryDialog.vue';
import DeleteConfirmDialog from '@/components/dialogs/DeleteConfirmDialog.vue';
import RenameDialog from '@/components/dialogs/RenameDialog.vue';
import GitSetupDialog from '@/components/dialogs/GitSetupDialog.vue';
import GitHistoryDialog from '@/components/dialogs/GitHistoryDialog.vue';
import BranchDialog from '@/components/dialogs/BranchDialog.vue';

const $q = useQuasar();

// Stores
const promptStore = usePromptStore();
const snippetStore = useSnippetStore();
const projectStore = useProjectStore();
const uiStore = useUIStore();
const gitStore = useGitStore();

// Check if running in Electron
const isElectron = computed(() => typeof window !== 'undefined' && !!window.fileSystemAPI);

// Dialog state
const showNewSnippetDialog = ref(false);
const showNewPromptDialog = ref(false);
const showNewProjectDialog = ref(false);
const showNewDirectoryDialog = ref(false);
const showDeleteConfirmDialog = ref(false);
const showRenameDialog = ref(false);
const showGitSetupDialog = ref(false);
const showGitHistoryDialog = ref(false);
const showBranchDialog = ref(false);

// Git context for dialogs
const gitProjectPath = ref('');
const gitProjectName = ref('');

// Dialog context
const renameTarget = ref<{ node: ITreeNode; currentName: string } | null>(null);
const deleteTarget = ref<{
  node: ITreeNode;
  contentsCount?: { files: number; directories: number };
} | null>(null);
const newDirectoryParent = ref<{ path: string; name: string } | null>(null);
const newPromptDirectory = ref<string | null>(null);

// Search state
const searchQuery = ref('');

// Expanded folders state
const expandedFolders = ref<Set<string>>(new Set(['prompts']));

// Drag state
const draggedNode = ref<ITreeNode | null>(null);
const dropTarget = ref<ITreeNode | null>(null);

// Directory structure cache (for showing empty directories)
const directoryStructures = ref<Map<string, string[]>>(new Map());
const directoryStructureVersion = ref(0); // Used to trigger reactivity

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
  type: 'folder' | 'prompt' | 'snippet' | 'project' | 'directory';
  filePath?: string;
  children?: ITreeNode[];
  snippetType?: ISnippetMetadata['type'];
  count?: number;
  isProject?: boolean;
  parentPath?: string;
  depth?: number;
  isDraggable?: boolean;
  isDropTarget?: boolean;
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
  void directoryStructureVersion.value;

  const tree: ITreeNode[] = [];

  // Filter prompts based on search
  const filteredPrompts = searchQuery.value.trim()
    ? promptStore.allPrompts.filter(
        (p) =>
          p.metadata.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
          p.fileName.toLowerCase().includes(searchQuery.value.toLowerCase())
      )
    : promptStore.allPrompts;

  // Filter snippets based on search
  const filteredSnippets = searchQuery.value.trim()
    ? snippetStore.allSnippets.filter(
        (s) =>
          s.metadata.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
          s.metadata.shortcut.toLowerCase().includes(searchQuery.value.toLowerCase())
      )
    : snippetStore.allSnippets;

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
  const projects = projectStore.allProjects;

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

  // Add direct prompts
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
      const isProject = projectStore.allProjects.some((p) => p.folderPath === folderId);
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
async function loadDirectoryStructure(dirPath: string): Promise<void> {
  if (!isElectron.value) return;

  try {
    const tree = await projectStore.getDirectoryTree(dirPath);
    // Extract immediate child directories (excluding hidden directories like .git)
    const childDirs = tree.children
      .filter((c) => !c.path.endsWith('.md') && !c.name.startsWith('.'))
      .map((c) => c.path);

    if (childDirs.length > 0) {
      directoryStructures.value.set(dirPath, childDirs);
      directoryStructureVersion.value++;
    }

    // Also recursively load child directories that are expanded
    for (const childDir of childDirs) {
      if (expandedFolders.value.has(childDir)) {
        await loadDirectoryStructure(childDir);
      }
    }
  } catch (err) {
    console.warn('Failed to load directory structure:', err);
  }
}

// Check if folder is expanded
function isExpanded(folderId: string): boolean {
  return expandedFolders.value.has(folderId);
}

// Open file in editor
async function openFile(node: ITreeNode): Promise<void> {
  if (!node.filePath) return;

  try {
    if (node.type === 'prompt') {
      // Load prompt and open tab
      const prompt = await promptStore.loadPrompt(node.filePath);
      uiStore.openTab({
        filePath: prompt.filePath,
        fileName: prompt.fileName,
        title: prompt.metadata.title || prompt.fileName.replace('.md', ''),
        isDirty: false,
        isPinned: false,
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
    if (node.type === 'prompt') {
      await promptStore.deletePrompt(node.filePath);
      uiStore.closeTab(node.filePath);
    } else if (node.type === 'snippet') {
      await snippetStore.deleteSnippet(node.filePath);
      uiStore.closeTab(node.filePath);
    } else if (node.type === 'project') {
      await projectStore.deleteProject(node.filePath, true);
      // Close any tabs for files in this project
      for (const tab of uiStore.openTabs) {
        if (tab.filePath.startsWith(node.filePath + '/')) {
          uiStore.closeTab(tab.id);
        }
      }
    } else if (node.type === 'directory') {
      await projectStore.deleteDirectory(node.filePath, true);
      // Close any tabs for files in this directory
      for (const tab of uiStore.openTabs) {
        if (tab.filePath.startsWith(node.filePath + '/')) {
          uiStore.closeTab(tab.id);
        }
      }
      await promptStore.refreshAllPrompts();
    }
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
    }
  } catch (err) {
    console.error('Failed to rename:', err);
    showError('Failed to rename');
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
    const prompt = promptStore.getCachedPrompt(node.filePath);
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
  if (!node.isDropTarget || !draggedNode.value) return;

  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
  dropTarget.value = node;
}

function handleDragLeave(): void {
  dropTarget.value = null;
}

async function handleDrop(event: DragEvent, targetNode: ITreeNode): Promise<void> {
  event.preventDefault();
  dropTarget.value = null;

  if (!draggedNode.value || !targetNode.isDropTarget) return;

  const sourceFilePath = draggedNode.value.filePath;
  const targetDirPath = targetNode.filePath ?? promptsDir.value;
  const fileName = draggedNode.value.label;

  if (!sourceFilePath || !targetDirPath) return;

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

// Initialize stores (only in Electron)
onMounted(async () => {
  if (!isElectron.value) return;

  try {
    await Promise.all([
      promptStore.initialize(),
      snippetStore.initialize(),
      projectStore.initialize(),
    ]);
    await promptStore.refreshAllPrompts();

    // Load directory structures for all projects
    for (const project of projectStore.allProjects) {
      await loadDirectoryStructure(project.folderPath);
    }
  } catch (err) {
    console.warn('Failed to initialize file stores:', err);
  }
});

// Watch for changes to refresh
watch(
  [
    () => promptStore.allPrompts.length,
    () => snippetStore.allSnippets.length,
    () => projectStore.allProjects.length,
  ],
  () => {
    // Tree will automatically update via computed
  }
);
</script>

<template>
  <div class="explorer-panel">
    <!-- Header with search and actions -->
    <div class="explorer-panel__header">
      <q-input
        v-model="searchQuery"
        placeholder="Search files..."
        outlined
        dense
        clearable
        class="explorer-panel__search"
      />
      <q-btn
        flat
        dense
        round
        icon="refresh"
        size="sm"
        @click="refreshFiles"
      >
        <q-tooltip>Refresh</q-tooltip>
      </q-btn>
      <q-btn
        flat
        dense
        round
        icon="add"
        size="sm"
      >
        <q-tooltip>New file</q-tooltip>
        <q-menu>
          <q-list
            dense
            style="min-width: 150px"
          >
            <q-item
              v-close-popup
              clickable
              @click="showNewPromptDialog = true"
            >
              <q-item-section avatar>
                <q-icon
                  name="description"
                  size="20px"
                />
              </q-item-section>
              <q-item-section>New Prompt</q-item-section>
            </q-item>
            <q-item
              v-close-popup
              clickable
              @click="showNewProjectDialog = true"
            >
              <q-item-section avatar>
                <q-icon
                  name="folder_special"
                  size="20px"
                />
              </q-item-section>
              <q-item-section>New Project</q-item-section>
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
              <q-item-section>New Snippet</q-item-section>
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
              }"
              @click="toggleFolder(folder.id)"
              @dragover="folder.isDropTarget ? handleDragOver($event, folder) : null"
              @dragleave="handleDragLeave"
              @drop="folder.isDropTarget ? handleDrop($event, folder) : null"
            >
              <q-icon
                :name="isExpanded(folder.id) ? 'expand_more' : 'chevron_right'"
                size="18px"
                class="explorer-panel__chevron"
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
                    <q-item-section>New Prompt</q-item-section>
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
                    <q-item-section>New Project</q-item-section>
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
                    <q-item-section>New Snippet</q-item-section>
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
                    <q-item-section>Initialize Personas</q-item-section>
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
                    <q-item-section>Refresh</q-item-section>
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
                  }"
                  :style="{ paddingLeft: `${(child.depth ?? 0) * 16 + 24}px` }"
                  @click="toggleFolder(child.id)"
                  @dragover="handleDragOver($event, child)"
                  @dragleave="handleDragLeave"
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
                        <q-item-section>New Prompt</q-item-section>
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
                        <q-item-section>New Directory</q-item-section>
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
                          <q-item-section>Git</q-item-section>
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
                                <q-item-section>Pull</q-item-section>
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
                                <q-item-section>Push</q-item-section>
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
                                <q-item-section>Fetch</q-item-section>
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
                                <q-item-section>Sync</q-item-section>
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
                                <q-item-section>Branches</q-item-section>
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
                                <q-item-section>History</q-item-section>
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
                                <q-item-section>Settings</q-item-section>
                              </q-item>
                            </q-list>
                          </q-menu>
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
                        <q-item-section>Rename</q-item-section>
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
                        <q-item-section>Delete</q-item-section>
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
                      }"
                      :style="{ paddingLeft: `${(nested.depth ?? 1) * 16 + 24}px` }"
                      @click="toggleFolder(nested.id)"
                      @dragover="handleDragOver($event, nested)"
                      @dragleave="handleDragLeave"
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
                            <q-item-section>New Prompt</q-item-section>
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
                            <q-item-section>New Directory</q-item-section>
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
                            <q-item-section>Rename</q-item-section>
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
                            <q-item-section>Delete</q-item-section>
                          </q-item>
                        </q-list>
                      </q-menu>
                    </div>

                    <!-- Children of nested directory (recursive) -->
                    <template v-if="isExpanded(nested.id) && nested.children">
                      <template
                        v-for="deepNested in nested.children"
                        :key="deepNested.id"
                      >
                        <!-- Deep nested directory -->
                        <div
                          v-if="deepNested.type === 'directory'"
                          class="explorer-panel__folder explorer-panel__folder--nested"
                          :class="{
                            'explorer-panel__folder--drop-target': isDropTargetActive(deepNested),
                          }"
                          :style="{ paddingLeft: `${(deepNested.depth ?? 2) * 16 + 24}px` }"
                          @click="toggleFolder(deepNested.id)"
                          @dragover="handleDragOver($event, deepNested)"
                          @dragleave="handleDragLeave"
                          @drop="handleDrop($event, deepNested)"
                        >
                          <q-icon
                            :name="isExpanded(deepNested.id) ? 'expand_more' : 'chevron_right'"
                            size="18px"
                            class="explorer-panel__chevron"
                          />
                          <q-icon
                            :name="isExpanded(deepNested.id) ? 'folder_open' : 'folder'"
                            size="18px"
                            class="explorer-panel__folder-icon"
                          />
                          <span class="explorer-panel__folder-label">{{ deepNested.label }}</span>
                          <q-badge
                            v-if="deepNested.count !== undefined && deepNested.count > 0"
                            :label="deepNested.count"
                            color="grey-7"
                            text-color="white"
                            class="explorer-panel__count"
                          />

                          <!-- Deep nested directory context menu -->
                          <q-menu context-menu>
                            <q-list
                              dense
                              style="min-width: 150px"
                            >
                              <q-item
                                v-close-popup
                                clickable
                                @click="openNewPromptDialogForDirectory(deepNested.filePath!)"
                              >
                                <q-item-section avatar>
                                  <q-icon
                                    name="add"
                                    size="20px"
                                  />
                                </q-item-section>
                                <q-item-section>New Prompt</q-item-section>
                              </q-item>
                              <q-item
                                v-close-popup
                                clickable
                                @click="
                                  openNewDirectoryDialog(deepNested.filePath!, deepNested.label)
                                "
                              >
                                <q-item-section avatar>
                                  <q-icon
                                    name="create_new_folder"
                                    size="20px"
                                  />
                                </q-item-section>
                                <q-item-section>New Directory</q-item-section>
                              </q-item>
                              <q-separator />
                              <q-item
                                v-close-popup
                                clickable
                                @click="openRenameDialog(deepNested)"
                              >
                                <q-item-section avatar>
                                  <q-icon
                                    name="edit"
                                    size="20px"
                                  />
                                </q-item-section>
                                <q-item-section>Rename</q-item-section>
                              </q-item>
                              <q-separator />
                              <q-item
                                v-close-popup
                                clickable
                                class="text-negative"
                                @click="confirmDelete(deepNested)"
                              >
                                <q-item-section avatar>
                                  <q-icon
                                    name="delete"
                                    size="20px"
                                    color="negative"
                                  />
                                </q-item-section>
                                <q-item-section>Delete</q-item-section>
                              </q-item>
                            </q-list>
                          </q-menu>
                        </div>

                        <!-- File in deep nested directory -->
                        <div
                          v-else
                          class="explorer-panel__file"
                          :style="{ paddingLeft: `${(deepNested.depth ?? 2) * 16 + 32}px` }"
                          draggable="true"
                          @click="openFile(deepNested)"
                          @dblclick="openFile(deepNested)"
                          @dragstart="handleDragStart($event, deepNested)"
                          @dragend="handleDragEnd"
                        >
                          <q-icon
                            :name="deepNested.icon"
                            size="16px"
                            class="explorer-panel__file-icon"
                          />
                          <span class="explorer-panel__file-label">{{ deepNested.label }}</span>

                          <!-- File context menu -->
                          <q-menu context-menu>
                            <q-list
                              dense
                              style="min-width: 180px"
                            >
                              <q-item
                                v-close-popup
                                clickable
                                @click="openFile(deepNested)"
                              >
                                <q-item-section avatar>
                                  <q-icon
                                    name="open_in_new"
                                    size="20px"
                                  />
                                </q-item-section>
                                <q-item-section>Open</q-item-section>
                              </q-item>
                              <q-item
                                v-if="deepNested.type === 'prompt'"
                                v-close-popup
                                clickable
                                @click="toggleFavorite(deepNested)"
                              >
                                <q-item-section avatar>
                                  <q-icon
                                    name="star"
                                    size="20px"
                                  />
                                </q-item-section>
                                <q-item-section>Toggle Favorite</q-item-section>
                              </q-item>
                              <q-item
                                v-close-popup
                                clickable
                                @click="openRenameDialog(deepNested)"
                              >
                                <q-item-section avatar>
                                  <q-icon
                                    name="edit"
                                    size="20px"
                                  />
                                </q-item-section>
                                <q-item-section>Rename</q-item-section>
                              </q-item>

                              <!-- Git submenu for files in projects -->
                              <template
                                v-if="
                                  deepNested.type === 'prompt' &&
                                  deepNested.filePath &&
                                  fileIsInProject(deepNested.filePath)
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
                                  <q-item-section>Git</q-item-section>
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
                                        v-if="fileNeedsAdd(deepNested.filePath)"
                                        v-close-popup
                                        clickable
                                        @click="handleGitAddFile(deepNested.filePath)"
                                      >
                                        <q-item-section avatar>
                                          <q-icon
                                            name="mdi-plus-circle"
                                            size="20px"
                                            color="positive"
                                          />
                                        </q-item-section>
                                        <q-item-section>Add</q-item-section>
                                      </q-item>
                                      <!-- Ignore File (if untracked) -->
                                      <q-item
                                        v-if="fileCanBeIgnored(deepNested.filePath)"
                                        v-close-popup
                                        clickable
                                        @click="handleGitIgnoreFile(deepNested.filePath)"
                                      >
                                        <q-item-section avatar>
                                          <q-icon
                                            name="mdi-eye-off"
                                            size="20px"
                                            color="grey"
                                          />
                                        </q-item-section>
                                        <q-item-section>Ignore</q-item-section>
                                      </q-item>
                                      <!-- Commit File (if staged) -->
                                      <q-item
                                        v-if="fileIsStaged(deepNested.filePath)"
                                        v-close-popup
                                        clickable
                                        @click="handleGitCommitFile(deepNested.filePath)"
                                      >
                                        <q-item-section avatar>
                                          <q-icon
                                            name="mdi-source-commit"
                                            size="20px"
                                          />
                                        </q-item-section>
                                        <q-item-section>Commit</q-item-section>
                                      </q-item>
                                      <!-- Reject/Discard (if staged) -->
                                      <q-item
                                        v-if="fileIsStaged(deepNested.filePath)"
                                        v-close-popup
                                        clickable
                                        @click="handleGitDiscardChanges(deepNested.filePath)"
                                      >
                                        <q-item-section avatar>
                                          <q-icon
                                            name="mdi-undo"
                                            size="20px"
                                            color="negative"
                                          />
                                        </q-item-section>
                                        <q-item-section>Reject</q-item-section>
                                      </q-item>
                                      <!-- History (if tracked - has commits) -->
                                      <q-item
                                        v-if="fileIsTracked(deepNested.filePath)"
                                        v-close-popup
                                        clickable
                                        @click="handleGitHistory(deepNested.filePath)"
                                      >
                                        <q-item-section avatar>
                                          <q-icon
                                            name="mdi-history"
                                            size="20px"
                                          />
                                        </q-item-section>
                                        <q-item-section>History</q-item-section>
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
                                @click="confirmDelete(deepNested)"
                              >
                                <q-item-section avatar>
                                  <q-icon
                                    name="delete"
                                    size="20px"
                                    color="negative"
                                  />
                                </q-item-section>
                                <q-item-section>Delete</q-item-section>
                              </q-item>
                            </q-list>
                          </q-menu>
                        </div>
                      </template>
                    </template>

                    <!-- File in nested directory -->
                    <div
                      v-if="nested.type !== 'directory'"
                      class="explorer-panel__file"
                      :style="{ paddingLeft: `${(nested.depth ?? 1) * 16 + 32}px` }"
                      draggable="true"
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
                            <q-item-section>Open</q-item-section>
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
                            <q-item-section>Toggle Favorite</q-item-section>
                          </q-item>
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
                            <q-item-section>Rename</q-item-section>
                          </q-item>

                          <!-- Git submenu for files in projects -->
                          <template v-if="nested.type === 'prompt' && nested.filePath">
                            <q-separator />
                            <q-item clickable>
                              <q-item-section avatar>
                                <q-icon
                                  name="mdi-git"
                                  size="20px"
                                  color="orange"
                                />
                              </q-item-section>
                              <q-item-section>Git</q-item-section>
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
                                    <q-item-section>Add</q-item-section>
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
                                    <q-item-section>Ignore</q-item-section>
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
                                    <q-item-section>Commit</q-item-section>
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
                                    <q-item-section>Reject</q-item-section>
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
                                    <q-item-section>History</q-item-section>
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
                            <q-item-section>Delete</q-item-section>
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
                        <q-item-section>Open</q-item-section>
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
                        <q-item-section>Toggle Favorite</q-item-section>
                      </q-item>
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
                        <q-item-section>Rename</q-item-section>
                      </q-item>

                      <!-- Git submenu for files in projects -->
                      <template
                        v-if="
                          child.type === 'prompt' &&
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
                          <q-item-section>Git</q-item-section>
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
                                <q-item-section>Add</q-item-section>
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
                                <q-item-section>Ignore</q-item-section>
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
                                <q-item-section>Commit</q-item-section>
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
                                <q-item-section>Reject</q-item-section>
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
                                <q-item-section>History</q-item-section>
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
                        <q-item-section>Delete</q-item-section>
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
}
</style>
