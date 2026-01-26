<script setup lang="ts">
/**
 * ExplorerTreeNode - Recursive component for rendering tree nodes at any depth
 *
 * This component renders a single tree node (directory or file) and recursively
 * renders its children, enabling unlimited nesting depth.
 */

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

// Define the tree node interface inline to avoid circular imports
interface ITreeNode {
  id: string;
  label: string;
  icon: string;
  type: 'folder' | 'prompt' | 'snippet' | 'project' | 'directory' | 'file';
  filePath?: string;
  children?: ITreeNode[];
  snippetType?: string;
  count?: number;
  isProject?: boolean;
  parentPath?: string;
  depth?: number;
  isDraggable?: boolean;
  isDropTarget?: boolean;
  category?: string;
  isFavorite?: boolean;
}

interface Props {
  node: ITreeNode;
  isExpanded: (id: string) => boolean;
  isDropTargetActive: (node: ITreeNode) => boolean;
  isExternalDropTarget: (node: ITreeNode) => boolean;
  getCategoryLabel: (category: string) => string;
  fileIsInProject: (filePath: string) => boolean;
  fileIsTracked: (filePath: string) => boolean;
  fileIsStaged: (filePath: string) => boolean;
}

interface Emits {
  (e: 'toggle-folder', id: string): void;
  (e: 'open-file', node: ITreeNode): void;
  (e: 'confirm-delete', node: ITreeNode): void;
  (e: 'open-rename-dialog', node: ITreeNode): void;
  (e: 'open-edit-prompt-dialog', node: ITreeNode): void;
  (e: 'toggle-favorite', node: ITreeNode): void;
  (e: 'open-new-prompt-dialog', dirPath: string): void;
  (e: 'open-new-directory-dialog', parentPath: string, parentLabel: string): void;
  (e: 'add-file-to-directory', dirPath: string): void;
  (e: 'add-folder-to-directory', dirPath: string): void;
  (e: 'drag-start', event: DragEvent, node: ITreeNode): void;
  (e: 'drag-end'): void;
  (e: 'drag-over', event: DragEvent, node: ITreeNode): void;
  (e: 'drag-leave', event: DragEvent, node: ITreeNode): void;
  (e: 'drop', event: DragEvent, node: ITreeNode): void;
  (e: 'git-stage', filePath: string): void;
  (e: 'git-unstage', filePath: string): void;
  (e: 'git-commit', filePath: string): void;
  (e: 'git-discard', filePath: string): void;
  (e: 'git-history', filePath: string): void;
  (e: 'export-library', projectPath: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n({ useScope: 'global' });

const isDirectory = computed(
  () => props.node.type === 'directory' || props.node.type === 'project'
);
const hasChildren = computed(() => props.node.children && props.node.children.length > 0);
const paddingLeft = computed(() => `${(props.node.depth ?? 0) * 16 + 24}px`);
const filePaddingLeft = computed(() => `${(props.node.depth ?? 0) * 16 + 32}px`);

function handleToggleFolder() {
  emit('toggle-folder', props.node.id);
}

function handleOpenFile() {
  emit('open-file', props.node);
}

function handleDelete() {
  emit('confirm-delete', props.node);
}

function handleRename() {
  emit('open-rename-dialog', props.node);
}

function handleEditPrompt() {
  emit('open-edit-prompt-dialog', props.node);
}

function handleToggleFavorite() {
  emit('toggle-favorite', props.node);
}

function handleNewPrompt() {
  if (props.node.filePath) {
    emit('open-new-prompt-dialog', props.node.filePath);
  }
}

function handleNewDirectory() {
  if (props.node.filePath) {
    emit('open-new-directory-dialog', props.node.filePath, props.node.label);
  }
}

function handleAddFile() {
  if (props.node.filePath) {
    emit('add-file-to-directory', props.node.filePath);
  }
}

function handleAddFolder() {
  if (props.node.filePath) {
    emit('add-folder-to-directory', props.node.filePath);
  }
}

function handleExportLibrary() {
  if (props.node.filePath && props.node.isProject) {
    emit('export-library', props.node.filePath);
  }
}

function handleDragStart(event: DragEvent) {
  emit('drag-start', event, props.node);
}

function handleDragEnd() {
  emit('drag-end');
}

function handleDragOver(event: DragEvent) {
  // Must call preventDefault to allow dropping (HTML5 drag-and-drop requirement)
  if (props.node.isDropTarget) {
    event.preventDefault();
  }
  emit('drag-over', event, props.node);
}

function handleDragLeave(event: DragEvent) {
  emit('drag-leave', event, props.node);
}

function handleDrop(event: DragEvent) {
  // Prevent browser default handling (e.g., opening dropped files)
  event.preventDefault();
  emit('drop', event, props.node);
}

// Forward all events to parent (for recursive children)
function forwardToggleFolder(id: string) {
  emit('toggle-folder', id);
}

function forwardOpenFile(node: ITreeNode) {
  emit('open-file', node);
}

function forwardConfirmDelete(node: ITreeNode) {
  emit('confirm-delete', node);
}

function forwardOpenRenameDialog(node: ITreeNode) {
  emit('open-rename-dialog', node);
}

function forwardOpenEditPromptDialog(node: ITreeNode) {
  emit('open-edit-prompt-dialog', node);
}

function forwardToggleFavorite(node: ITreeNode) {
  emit('toggle-favorite', node);
}

function forwardOpenNewPromptDialog(dirPath: string) {
  emit('open-new-prompt-dialog', dirPath);
}

function forwardOpenNewDirectoryDialog(parentPath: string, parentLabel: string) {
  emit('open-new-directory-dialog', parentPath, parentLabel);
}

function forwardAddFileToDirectory(dirPath: string) {
  emit('add-file-to-directory', dirPath);
}

function forwardAddFolderToDirectory(dirPath: string) {
  emit('add-folder-to-directory', dirPath);
}

function forwardExportLibrary(projectPath: string) {
  emit('export-library', projectPath);
}

function forwardDragStart(event: DragEvent, node: ITreeNode) {
  emit('drag-start', event, node);
}

function forwardDragEnd() {
  emit('drag-end');
}

function forwardDragOver(event: DragEvent, node: ITreeNode) {
  emit('drag-over', event, node);
}

function forwardDragLeave(event: DragEvent, node: ITreeNode) {
  emit('drag-leave', event, node);
}

function forwardDrop(event: DragEvent, node: ITreeNode) {
  emit('drop', event, node);
}

function forwardGitStage(filePath: string) {
  emit('git-stage', filePath);
}

function forwardGitUnstage(filePath: string) {
  emit('git-unstage', filePath);
}

function forwardGitCommit(filePath: string) {
  emit('git-commit', filePath);
}

function forwardGitDiscard(filePath: string) {
  emit('git-discard', filePath);
}

function forwardGitHistory(filePath: string) {
  emit('git-history', filePath);
}
</script>

<template>
  <!-- Directory node -->
  <template v-if="isDirectory">
    <div
      class="explorer-panel__folder explorer-panel__folder--nested"
      :class="{
        'explorer-panel__folder--drop-target': isDropTargetActive(node),
        'explorer-panel__folder--external-drop-target': isExternalDropTarget(node),
      }"
      :style="{ paddingLeft }"
      :data-node-id="node.id"
      @click="handleToggleFolder"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <q-icon
        :name="isExpanded(node.id) ? 'expand_more' : 'chevron_right'"
        size="18px"
        class="explorer-panel__chevron"
      />
      <q-icon
        :name="isExpanded(node.id) ? 'folder_open' : 'folder'"
        size="18px"
        class="explorer-panel__folder-icon"
      />
      <span class="explorer-panel__folder-label">{{ node.label }}</span>
      <q-badge
        v-if="node.count !== undefined && node.count > 0"
        :label="node.count"
        color="grey-7"
        text-color="white"
        class="explorer-panel__count"
      />

      <!-- Directory context menu -->
      <q-menu context-menu>
        <q-list
          dense
          style="min-width: 150px"
        >
          <q-item
            v-close-popup
            clickable
            @click="handleNewPrompt"
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
            @click="handleNewDirectory"
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
            @click="handleAddFile"
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
            @click="handleAddFolder"
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
            v-if="node.isProject"
            v-close-popup
            clickable
            @click="handleExportLibrary"
          >
            <q-item-section avatar>
              <q-icon
                name="file_download"
                size="20px"
              />
            </q-item-section>
            <q-item-section>{{ t('explorer.exportLibrary') }}</q-item-section>
          </q-item>
          <q-separator />
          <q-item
            v-close-popup
            clickable
            @click="handleRename"
          >
            <q-item-section avatar>
              <q-icon
                name="edit"
                size="20px"
              />
            </q-item-section>
            <q-item-section>{{ t('common.rename') }}</q-item-section>
          </q-item>
          <q-item
            v-close-popup
            clickable
            class="text-negative"
            @click="handleDelete"
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

    <!-- Recursively render children when expanded -->
    <template v-if="isExpanded(node.id) && hasChildren">
      <ExplorerTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :is-expanded="isExpanded"
        :is-drop-target-active="isDropTargetActive"
        :is-external-drop-target="isExternalDropTarget"
        :get-category-label="getCategoryLabel"
        :file-is-in-project="fileIsInProject"
        :file-is-tracked="fileIsTracked"
        :file-is-staged="fileIsStaged"
        @toggle-folder="forwardToggleFolder"
        @open-file="forwardOpenFile"
        @confirm-delete="forwardConfirmDelete"
        @open-rename-dialog="forwardOpenRenameDialog"
        @open-edit-prompt-dialog="forwardOpenEditPromptDialog"
        @toggle-favorite="forwardToggleFavorite"
        @open-new-prompt-dialog="forwardOpenNewPromptDialog"
        @open-new-directory-dialog="forwardOpenNewDirectoryDialog"
        @add-file-to-directory="forwardAddFileToDirectory"
        @add-folder-to-directory="forwardAddFolderToDirectory"
        @export-library="forwardExportLibrary"
        @drag-start="forwardDragStart"
        @drag-end="forwardDragEnd"
        @drag-over="forwardDragOver"
        @drag-leave="forwardDragLeave"
        @drop="forwardDrop"
        @git-stage="forwardGitStage"
        @git-unstage="forwardGitUnstage"
        @git-commit="forwardGitCommit"
        @git-discard="forwardGitDiscard"
        @git-history="forwardGitHistory"
      />
    </template>
  </template>

  <!-- File/Prompt/Snippet node -->
  <template v-else>
    <div
      class="explorer-panel__file"
      :style="{ paddingLeft: filePaddingLeft }"
      :draggable="node.isDraggable ? 'true' : 'false'"
      data-testid="file-item"
      @click="handleOpenFile"
      @dblclick="handleOpenFile"
      @dragstart="node.isDraggable ? handleDragStart($event) : null"
      @dragend="handleDragEnd"
    >
      <q-icon
        :name="node.icon"
        size="16px"
        class="explorer-panel__file-icon"
      />
      <span class="explorer-panel__file-label">{{ node.label }}</span>
      <q-badge
        v-if="node.type === 'prompt' && node.category"
        :label="getCategoryLabel(node.category)"
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
            @click="handleOpenFile"
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
            v-if="node.type === 'prompt'"
            v-close-popup
            clickable
            @click="handleToggleFavorite"
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
            v-if="node.type === 'prompt'"
            v-close-popup
            clickable
            @click="handleEditPrompt"
          >
            <q-item-section avatar>
              <q-icon
                name="edit"
                size="20px"
              />
            </q-item-section>
            <q-item-section>{{ t('common.edit') }}</q-item-section>
          </q-item>
          <!-- Rename for other files -->
          <q-item
            v-else
            v-close-popup
            clickable
            @click="handleRename"
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
              (node.type === 'prompt' || node.type === 'file') &&
              node.filePath &&
              fileIsInProject(node.filePath)
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
                  style="min-width: 150px"
                >
                  <!-- Stage (if not staged) -->
                  <q-item
                    v-if="!fileIsStaged(node.filePath)"
                    v-close-popup
                    clickable
                    @click="forwardGitStage(node.filePath!)"
                  >
                    <q-item-section avatar>
                      <q-icon
                        name="mdi-plus"
                        size="20px"
                        color="positive"
                      />
                    </q-item-section>
                    <q-item-section>{{ t('gitPanel.stage') }}</q-item-section>
                  </q-item>
                  <!-- Unstage (if staged) -->
                  <q-item
                    v-if="fileIsStaged(node.filePath)"
                    v-close-popup
                    clickable
                    @click="forwardGitUnstage(node.filePath!)"
                  >
                    <q-item-section avatar>
                      <q-icon
                        name="mdi-minus"
                        size="20px"
                        color="warning"
                      />
                    </q-item-section>
                    <q-item-section>{{ t('gitPanel.unstage') }}</q-item-section>
                  </q-item>
                  <!-- Commit (if staged) -->
                  <q-item
                    v-if="fileIsStaged(node.filePath)"
                    v-close-popup
                    clickable
                    @click="forwardGitCommit(node.filePath!)"
                  >
                    <q-item-section avatar>
                      <q-icon
                        name="mdi-check"
                        size="20px"
                        color="positive"
                      />
                    </q-item-section>
                    <q-item-section>{{ t('gitPanel.commit') }}</q-item-section>
                  </q-item>
                  <!-- Discard (if staged) -->
                  <q-item
                    v-if="fileIsStaged(node.filePath)"
                    v-close-popup
                    clickable
                    @click="forwardGitDiscard(node.filePath!)"
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
                  <!-- History (if tracked) -->
                  <q-item
                    v-if="fileIsTracked(node.filePath)"
                    v-close-popup
                    clickable
                    @click="forwardGitHistory(node.filePath!)"
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
            @click="handleDelete"
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
</template>

<style lang="scss" scoped>
// Folder/directory styles
.explorer-panel__folder {
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

.explorer-panel__chevron {
  flex-shrink: 0;
  color: var(--chevron-color, #858585);
}

.explorer-panel__folder-icon {
  flex-shrink: 0;
  color: var(--folder-icon-color, #dcb67a);
}

.explorer-panel__folder-label {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--folder-text, #cccccc);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.explorer-panel__count {
  font-size: 10px;
  padding: 2px 6px;
}

// File styles
.explorer-panel__file {
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

.explorer-panel__file-icon {
  flex-shrink: 0;
  color: var(--file-icon-color, #c5c5c5);
}

.explorer-panel__file-label {
  flex: 1;
  font-size: 13px;
  color: var(--file-text, #cccccc);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.explorer-panel__category-badge {
  font-size: 9px;
  padding: 1px 5px;
  margin-left: auto;
  flex-shrink: 0;
}
</style>
