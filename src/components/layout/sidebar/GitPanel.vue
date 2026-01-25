<script setup lang="ts">
/**
 * GitPanel Component
 *
 * Displays source control status and provides Git operations.
 * Shows staged, modified, and untracked files with actions.
 */

import { ref, computed, onMounted } from 'vue';
import { useGitStore } from '@/stores/gitStore';
import type { IGitFileStatus } from '@/services/git/types';
import { getBasename } from '@/utils/path.utils';

const gitStore = useGitStore();

// Local state
const commitMessage = ref('');
const isCommitting = ref(false);
const showInitDialog = ref(false);
const expandedSections = ref({
  staged: true,
  changes: true,
  untracked: true,
});

// Computed
const isInitialized = computed(() => gitStore.isInitialized);
const isGitInstalled = computed(() => gitStore.isGitInstalled);
const isRepo = computed(() => gitStore.isRepo);
const isLoading = computed(() => gitStore.isLoading);
const error = computed(() => gitStore.error);
const currentBranch = computed(() => gitStore.currentBranch);
const stagedFiles = computed(() => gitStore.stagedFiles);
const modifiedFiles = computed(() => gitStore.modifiedFiles);
const untrackedFiles = computed(() => gitStore.untrackedFiles);
const deletedFiles = computed(() => gitStore.deletedFiles);
const hasChanges = computed(() => gitStore.hasChanges);
const hasStagedChanges = computed(() => gitStore.hasStagedChanges);
const _changeCount = computed(() => gitStore.changeCount);
const aheadBehind = computed(() => gitStore.aheadBehind);

// All unstaged changes (modified + deleted)
const unstagedChanges = computed(() => [...modifiedFiles.value, ...deletedFiles.value]);

// File status icon mapping
function getStatusIcon(status: string): string {
  switch (status) {
    case 'modified':
      return 'edit';
    case 'added':
      return 'add';
    case 'deleted':
      return 'delete';
    case 'renamed':
      return 'drive_file_rename_outline';
    case 'untracked':
      return 'add_circle_outline';
    default:
      return 'description';
  }
}

// File status color mapping
function getStatusColor(status: string): string {
  switch (status) {
    case 'modified':
      return 'warning';
    case 'added':
      return 'positive';
    case 'deleted':
      return 'negative';
    case 'renamed':
      return 'info';
    case 'untracked':
      return 'grey-6';
    default:
      return 'grey';
  }
}

// Get file name from path
function getFileName(filePath: string): string {
  return getBasename(filePath) || filePath;
}

// Stage a single file
async function stageFile(file: IGitFileStatus): Promise<void> {
  await gitStore.stageFiles([file.filePath]);
}

// Unstage a single file
async function unstageFile(file: IGitFileStatus): Promise<void> {
  await gitStore.unstageFiles([file.filePath]);
}

// Stage all files
async function stageAll(): Promise<void> {
  await gitStore.stageFiles('all');
}

// Unstage all files
async function unstageAll(): Promise<void> {
  const files = stagedFiles.value.map((f) => f.filePath);
  await gitStore.unstageFiles(files);
}

// Discard changes in a file
async function discardFile(file: IGitFileStatus): Promise<void> {
  await gitStore.discardChanges(file.filePath);
}

// Commit changes
async function doCommit(): Promise<void> {
  if (!commitMessage.value.trim() || !hasStagedChanges.value) return;

  isCommitting.value = true;
  const success = await gitStore.commit(commitMessage.value.trim());
  if (success) {
    commitMessage.value = '';
  }
  isCommitting.value = false;
}

// Initialize repository
async function initRepo(): Promise<void> {
  const success = await gitStore.initRepository();
  if (success) {
    showInitDialog.value = false;
  }
}

// Refresh status
async function refresh(): Promise<void> {
  await gitStore.refreshStatus();
}

// Push changes
async function push(): Promise<void> {
  await gitStore.push();
}

// Pull changes
async function pull(): Promise<void> {
  await gitStore.pull();
}

// Toggle section
function toggleSection(section: 'staged' | 'changes' | 'untracked'): void {
  expandedSections.value[section] = !expandedSections.value[section];
}

// Initialize Git store when mounted
onMounted(async () => {
  // GitPanel doesn't initialize git by itself - projects have their own git status
  // The gitStore is initialized per-project when needed
});

// Watch for app initialization - not needed as git is initialized per-project
// const _watchAppInit = watch(
//   () => appStore.isInitialized,
//   async (_initialized) => {}
// );
</script>

<template>
  <div
    class="git-panel"
    data-testid="git-panel"
  >
    <!-- Loading state -->
    <div
      v-if="!isInitialized || isLoading"
      class="git-panel__loading"
    >
      <q-spinner-dots
        size="40px"
        color="primary"
      />
      <p class="text-grey-6 q-mt-md">Loading Git status...</p>
    </div>

    <!-- Git not installed -->
    <div
      v-else-if="!isGitInstalled"
      class="git-panel__empty"
    >
      <q-icon
        name="warning"
        size="48px"
        class="text-warning q-mb-md"
      />
      <h6 class="text-grey-5 q-mb-sm">Git Not Found</h6>
      <p class="text-grey-6 text-caption q-mb-md">Git is not installed or not in your PATH.</p>
      <q-btn
        flat
        dense
        no-caps
        color="primary"
        label="Learn More"
        href="https://git-scm.com/downloads"
        target="_blank"
      />
    </div>

    <!-- Not a Git repository -->
    <div
      v-else-if="!isRepo"
      class="git-panel__empty"
    >
      <q-icon
        name="source"
        size="48px"
        class="text-grey-6 q-mb-md"
      />
      <h6 class="text-grey-5 q-mb-sm">Not a Git Repository</h6>
      <p class="text-grey-6 text-caption q-mb-md">
        Initialize a Git repository to track changes to your prompts.
      </p>
      <q-btn
        flat
        dense
        no-caps
        color="primary"
        icon="add"
        label="Initialize Repository"
        data-testid="git-init-btn"
        @click="showInitDialog = true"
      />

      <!-- Init dialog -->
      <q-dialog v-model="showInitDialog">
        <q-card style="min-width: 300px">
          <q-card-section>
            <div class="text-h6">Initialize Git Repository</div>
          </q-card-section>

          <q-card-section>
            <p class="text-body2">
              This will create a new Git repository in your prompts directory. You can then commit
              changes and optionally push to a remote.
            </p>
          </q-card-section>

          <q-card-actions align="right">
            <q-btn
              v-close-popup
              flat
              label="Cancel"
            />
            <q-btn
              flat
              color="primary"
              label="Initialize"
              :loading="isLoading"
              @click="initRepo"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>

    <!-- Main Git panel -->
    <div
      v-else
      class="git-panel__content"
    >
      <!-- Header with branch info -->
      <div class="git-panel__header">
        <div
          class="git-panel__branch"
          data-testid="branch-selector"
        >
          <q-icon
            name="account_tree"
            size="16px"
          />
          <span class="git-panel__branch-name">{{ currentBranch }}</span>
          <template v-if="aheadBehind.ahead > 0 || aheadBehind.behind > 0">
            <q-badge
              v-if="aheadBehind.ahead > 0"
              color="positive"
              :label="`↑${aheadBehind.ahead}`"
              class="q-ml-xs"
            />
            <q-badge
              v-if="aheadBehind.behind > 0"
              color="warning"
              :label="`↓${aheadBehind.behind}`"
              class="q-ml-xs"
            />
          </template>
        </div>
        <div class="git-panel__actions">
          <q-btn
            flat
            dense
            round
            size="sm"
            icon="refresh"
            :loading="isLoading"
            @click="refresh"
          >
            <q-tooltip>Refresh</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            size="sm"
            icon="cloud_upload"
            :disable="aheadBehind.ahead === 0"
            data-testid="push-btn"
            @click="push"
          >
            <q-tooltip>Push</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            size="sm"
            icon="cloud_download"
            :disable="aheadBehind.behind === 0"
            data-testid="pull-btn"
            @click="pull"
          >
            <q-tooltip>Pull</q-tooltip>
          </q-btn>
        </div>
      </div>

      <!-- Error display -->
      <q-banner
        v-if="error"
        dense
        class="bg-negative text-white q-mb-sm"
      >
        {{ error }}
        <template #action>
          <q-btn
            flat
            dense
            label="Dismiss"
            @click="gitStore.clearError()"
          />
        </template>
      </q-banner>

      <!-- Commit input -->
      <div class="git-panel__commit">
        <q-input
          v-model="commitMessage"
          dense
          outlined
          placeholder="Commit message"
          :disable="!hasStagedChanges"
          data-testid="commit-message"
          @keyup.enter="doCommit"
        >
          <template #append>
            <q-btn
              flat
              dense
              round
              icon="check"
              :disable="!commitMessage.trim() || !hasStagedChanges"
              :loading="isCommitting"
              data-testid="commit-btn"
              @click="doCommit"
            >
              <q-tooltip>Commit</q-tooltip>
            </q-btn>
          </template>
        </q-input>
      </div>

      <!-- File sections -->
      <div class="git-panel__sections">
        <!-- Staged Changes -->
        <div
          v-if="stagedFiles.length > 0"
          class="git-panel__section"
        >
          <div
            class="git-panel__section-header"
            @click="toggleSection('staged')"
          >
            <q-icon
              :name="expandedSections.staged ? 'expand_more' : 'chevron_right'"
              size="18px"
            />
            <span>Staged Changes</span>
            <q-badge
              color="positive"
              :label="stagedFiles.length"
            />
            <q-space />
            <q-btn
              flat
              dense
              round
              size="xs"
              icon="remove"
              @click.stop="unstageAll"
            >
              <q-tooltip>Unstage All</q-tooltip>
            </q-btn>
          </div>
          <q-slide-transition>
            <div
              v-show="expandedSections.staged"
              class="git-panel__files"
              data-testid="staged-files"
            >
              <div
                v-for="file in stagedFiles"
                :key="file.filePath"
                class="git-panel__file"
              >
                <q-icon
                  :name="getStatusIcon(file.status)"
                  :color="getStatusColor(file.status)"
                  size="16px"
                />
                <span
                  class="git-panel__file-name"
                  :title="file.filePath"
                >
                  {{ getFileName(file.filePath) }}
                </span>
                <q-space />
                <q-btn
                  flat
                  dense
                  round
                  size="xs"
                  icon="remove"
                  @click="unstageFile(file)"
                >
                  <q-tooltip>Unstage</q-tooltip>
                </q-btn>
              </div>
            </div>
          </q-slide-transition>
        </div>

        <!-- Changes (Modified + Deleted) -->
        <div
          v-if="unstagedChanges.length > 0"
          class="git-panel__section"
        >
          <div
            class="git-panel__section-header"
            @click="toggleSection('changes')"
          >
            <q-icon
              :name="expandedSections.changes ? 'expand_more' : 'chevron_right'"
              size="18px"
            />
            <span>Changes</span>
            <q-badge
              color="warning"
              :label="unstagedChanges.length"
            />
            <q-space />
            <q-btn
              flat
              dense
              round
              size="xs"
              icon="add"
              @click.stop="stageAll"
            >
              <q-tooltip>Stage All</q-tooltip>
            </q-btn>
          </div>
          <q-slide-transition>
            <div
              v-show="expandedSections.changes"
              class="git-panel__files"
              data-testid="changed-files"
            >
              <div
                v-for="file in unstagedChanges"
                :key="file.filePath"
                class="git-panel__file"
              >
                <q-icon
                  :name="getStatusIcon(file.status)"
                  :color="getStatusColor(file.status)"
                  size="16px"
                />
                <span
                  class="git-panel__file-name"
                  :title="file.filePath"
                >
                  {{ getFileName(file.filePath) }}
                </span>
                <q-space />
                <q-btn
                  flat
                  dense
                  round
                  size="xs"
                  icon="undo"
                  @click="discardFile(file)"
                >
                  <q-tooltip>Discard Changes</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  dense
                  round
                  size="xs"
                  icon="add"
                  @click="stageFile(file)"
                >
                  <q-tooltip>Stage</q-tooltip>
                </q-btn>
              </div>
            </div>
          </q-slide-transition>
        </div>

        <!-- Untracked Files -->
        <div
          v-if="untrackedFiles.length > 0"
          class="git-panel__section"
        >
          <div
            class="git-panel__section-header"
            @click="toggleSection('untracked')"
          >
            <q-icon
              :name="expandedSections.untracked ? 'expand_more' : 'chevron_right'"
              size="18px"
            />
            <span>Untracked</span>
            <q-badge
              color="grey-6"
              :label="untrackedFiles.length"
            />
            <q-space />
            <q-btn
              flat
              dense
              round
              size="xs"
              icon="add"
              @click.stop="stageAll"
            >
              <q-tooltip>Stage All</q-tooltip>
            </q-btn>
          </div>
          <q-slide-transition>
            <div
              v-show="expandedSections.untracked"
              class="git-panel__files"
            >
              <div
                v-for="file in untrackedFiles"
                :key="file.filePath"
                class="git-panel__file"
              >
                <q-icon
                  name="add_circle_outline"
                  color="grey-6"
                  size="16px"
                />
                <span
                  class="git-panel__file-name"
                  :title="file.filePath"
                >
                  {{ getFileName(file.filePath) }}
                </span>
                <q-space />
                <q-btn
                  flat
                  dense
                  round
                  size="xs"
                  icon="add"
                  @click="stageFile(file)"
                >
                  <q-tooltip>Stage</q-tooltip>
                </q-btn>
              </div>
            </div>
          </q-slide-transition>
        </div>

        <!-- No changes -->
        <div
          v-if="!hasChanges"
          class="git-panel__no-changes"
        >
          <q-icon
            name="check_circle"
            size="32px"
            color="positive"
          />
          <p class="text-grey-6 q-mt-sm">No changes</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.git-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-width: 0;
  overflow: hidden;

  &__loading,
  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 24px;
    text-align: center;

    h6 {
      font-size: 14px;
      font-weight: 500;
      margin: 0;
    }

    p {
      margin: 0;
      max-width: 200px;
    }
  }

  &__content {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color, #3c3c3c);
  }

  &__branch {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-color, #cccccc);
  }

  &__branch-name {
    font-weight: 500;
  }

  &__actions {
    display: flex;
    gap: 2px;
  }

  &__commit {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color, #3c3c3c);
  }

  &__sections {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  &__section {
    margin-bottom: 4px;
  }

  &__section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--section-header-color, #bbbbbb);
    cursor: pointer;

    &:hover {
      background-color: var(--hover-bg, #2a2d2e);
    }
  }

  &__files {
    padding: 0 4px;
  }

  &__file {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px 4px 24px;
    border-radius: 4px;
    cursor: pointer;

    &:hover {
      background-color: var(--hover-bg, #2a2d2e);
    }
  }

  &__file-name {
    flex: 1;
    font-size: 12px;
    color: var(--file-color, #cccccc);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__no-changes {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    text-align: center;
  }
}

// Light theme
.body--light .git-panel {
  --border-color: #e7e7e7;
  --text-color: #3b3b3b;
  --section-header-color: #6f6f6f;
  --hover-bg: #e8e8e8;
  --file-color: #3b3b3b;
}

// Dark theme
.body--dark .git-panel {
  --border-color: #3c3c3c;
  --text-color: #cccccc;
  --section-header-color: #bbbbbb;
  --hover-bg: #2a2d2e;
  --file-color: #cccccc;
}
</style>
