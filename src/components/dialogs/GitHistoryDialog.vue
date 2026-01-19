<script setup lang="ts">
/**
 * GitHistoryDialog Component
 *
 * Dialog for viewing Git commit history for a project.
 * Shows commit list with details, author, date, and diff preview.
 */

import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { useGitStore } from '@/stores/gitStore';

const props = defineProps<{
  modelValue: boolean;
  projectPath: string;
  projectName: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const { t } = useI18n({ useScope: 'global' });
const $q = useQuasar();
const gitStore = useGitStore();

// Local state
const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

// Loading state
const isLoading = ref(false);
const selectedCommit = ref<string | null>(null);
const commitDiff = ref('');
const isLoadingDiff = ref(false);

// Commits list
const commits = computed(() => gitStore.commits);

// Load history when dialog opens
watch(
  () => props.modelValue,
  async (value) => {
    if (value && props.projectPath) {
      await loadHistory();
    }
  }
);

onMounted(async () => {
  if (props.modelValue && props.projectPath) {
    await loadHistory();
  }
});

// Load commit history
async function loadHistory(): Promise<void> {
  isLoading.value = true;
  selectedCommit.value = null;
  commitDiff.value = '';

  try {
    await gitStore.initialize(props.projectPath);

    if (!gitStore.isRepo) {
      $q.notify({
        type: 'warning',
        message: 'Not a Git repository',
        position: 'top',
        timeout: 3000,
      });
      return;
    }

    await gitStore.loadHistory(50);
  } catch (err) {
    console.error('Failed to load history:', err);
    $q.notify({
      type: 'negative',
      message: 'Failed to load Git history',
      position: 'top',
      timeout: 4000,
    });
  } finally {
    isLoading.value = false;
  }
}

// Select a commit to view details
async function selectCommit(hash: string): Promise<void> {
  if (selectedCommit.value === hash) {
    selectedCommit.value = null;
    commitDiff.value = '';
    return;
  }

  selectedCommit.value = hash;
  isLoadingDiff.value = true;

  try {
    // Get diff for the commit
    const diff = await gitStore.getDiff(undefined, false);
    commitDiff.value = diff;
  } catch (err) {
    console.error('Failed to load diff:', err);
    commitDiff.value = 'Failed to load diff';
  } finally {
    isLoadingDiff.value = false;
  }
}

// Format date
function formatDate(date: Date): string {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays === 1) {
    return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

// Truncate commit hash
function shortHash(hash: string): string {
  return hash.slice(0, 7);
}

// Get first line of commit message
function getCommitTitle(message: string): string {
  const lines = message.split('\n');
  return lines[0] ?? '';
}

// Get commit body (lines after first)
function getCommitBody(message: string): string {
  const lines = message.split('\n');
  return lines.slice(1).join('\n').trim();
}

// Close dialog
function closeDialog(): void {
  isOpen.value = false;
}
</script>

<template>
  <q-dialog
    v-model="isOpen"
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card class="git-history-dialog">
      <!-- Header -->
      <q-card-section class="git-history-dialog__header">
        <div class="git-history-dialog__title-row">
          <q-icon
            name="mdi-history"
            size="28px"
            color="primary"
          />
          <div class="git-history-dialog__title-text">
            <h6 class="q-ma-none">{{ t('dialogs.gitHistory.title') }}</h6>
            <span class="text-caption text-grey">{{ projectName }}</span>
          </div>
          <q-space />
          <q-btn
            flat
            dense
            round
            icon="refresh"
            @click="loadHistory"
          >
            <q-tooltip>{{ t('common.refresh') }}</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            icon="close"
            @click="closeDialog"
          />
        </div>
      </q-card-section>

      <q-separator />

      <!-- Content -->
      <q-card-section class="git-history-dialog__content">
        <!-- Loading state -->
        <div
          v-if="isLoading"
          class="git-history-dialog__loading"
        >
          <q-spinner-dots
            color="primary"
            size="40px"
          />
          <span class="q-mt-md text-grey">{{ t('common.loading') }}</span>
        </div>

        <!-- No commits -->
        <div
          v-else-if="commits.length === 0"
          class="git-history-dialog__empty"
        >
          <q-icon
            name="mdi-source-commit"
            size="64px"
            color="grey-6"
          />
          <h6 class="q-mt-md q-mb-sm">{{ t('dialogs.gitHistory.noCommits') }}</h6>
          <p class="text-grey text-center">{{ t('dialogs.gitHistory.noCommits') }}</p>
        </div>

        <!-- Commits list -->
        <div
          v-else
          class="git-history-dialog__commits"
        >
          <q-list separator>
            <q-item
              v-for="commit in commits"
              :key="commit.hash"
              clickable
              :active="selectedCommit === commit.hash"
              active-class="git-history-dialog__commit--active"
              @click="selectCommit(commit.hash)"
            >
              <q-item-section avatar>
                <q-avatar
                  size="36px"
                  color="primary"
                  text-color="white"
                  class="text-uppercase"
                >
                  {{ commit.author.charAt(0) }}
                </q-avatar>
              </q-item-section>

              <q-item-section>
                <q-item-label class="git-history-dialog__commit-title">
                  {{ getCommitTitle(commit.message) }}
                </q-item-label>
                <q-item-label caption>
                  <span class="text-weight-medium">{{ commit.author }}</span>
                  &middot;
                  <span>{{ formatDate(commit.date) }}</span>
                </q-item-label>
              </q-item-section>

              <q-item-section side>
                <q-chip
                  dense
                  size="sm"
                  color="grey-8"
                  text-color="white"
                  class="git-history-dialog__hash"
                >
                  {{ shortHash(commit.hash) }}
                </q-chip>
              </q-item-section>
            </q-item>
          </q-list>

          <!-- Selected commit details -->
          <div
            v-if="selectedCommit"
            class="git-history-dialog__details"
          >
            <template
              v-for="commit in commits.filter((c) => c.hash === selectedCommit)"
              :key="commit.hash"
            >
              <div class="git-history-dialog__details-header">
                <h6 class="q-ma-none">{{ getCommitTitle(commit.message) }}</h6>
                <p
                  v-if="getCommitBody(commit.message)"
                  class="text-grey q-mt-sm q-mb-none"
                >
                  {{ getCommitBody(commit.message) }}
                </p>
              </div>

              <div class="git-history-dialog__details-meta">
                <q-chip
                  dense
                  icon="person"
                >
                  {{ commit.author }}
                </q-chip>
                <q-chip
                  dense
                  icon="email"
                >
                  {{ commit.authorEmail }}
                </q-chip>
                <q-chip
                  dense
                  icon="schedule"
                >
                  {{ commit.date.toLocaleString() }}
                </q-chip>
              </div>

              <div class="git-history-dialog__details-hash">
                <span class="text-caption text-grey">Commit: </span>
                <code>{{ commit.hash }}</code>
              </div>
            </template>

            <!-- Diff preview -->
            <div
              v-if="isLoadingDiff"
              class="git-history-dialog__diff-loading"
            >
              <q-spinner-dots color="primary" />
              <span class="q-ml-sm text-grey">{{ t('common.loading') }}</span>
            </div>
            <div
              v-else-if="commitDiff"
              class="git-history-dialog__diff"
            >
              <h6 class="q-ma-none q-mb-sm">Changes</h6>
              <pre class="git-history-dialog__diff-content">{{ commitDiff }}</pre>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style lang="scss" scoped>
.git-history-dialog {
  display: flex;
  flex-direction: column;
  max-width: 800px;
  max-height: 90vh;
  margin: auto;

  &__header {
    padding: 16px;
  }

  &__title-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__title-text {
    display: flex;
    flex-direction: column;
  }

  &__content {
    flex: 1;
    overflow: hidden;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  &__loading,
  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px;
    text-align: center;
  }

  &__commits {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  &__commit-title {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__commit--active {
    background-color: var(--active-bg, rgba(0, 120, 212, 0.1));
  }

  &__hash {
    font-family: monospace;
    font-size: 11px;
  }

  &__details {
    border-top: 1px solid var(--border-color, #3c3c3c);
    padding: 16px;
    background: var(--details-bg, rgba(0, 0, 0, 0.02));
    max-height: 50%;
    overflow-y: auto;
  }

  &__details-header {
    margin-bottom: 12px;
  }

  &__details-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  &__details-hash {
    margin-bottom: 16px;

    code {
      font-size: 12px;
      background: var(--code-bg, rgba(0, 0, 0, 0.05));
      padding: 2px 6px;
      border-radius: 4px;
    }
  }

  &__diff-loading {
    display: flex;
    align-items: center;
    padding: 16px 0;
  }

  &__diff {
    margin-top: 16px;
  }

  &__diff-content {
    background: var(--diff-bg, #1e1e1e);
    color: var(--diff-text, #d4d4d4);
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 12px;
    line-height: 1.5;
    max-height: 200px;
    overflow-y: auto;
    margin: 0;
  }
}

// Theme adjustments
.body--dark .git-history-dialog {
  --active-bg: rgba(0, 120, 212, 0.2);
  --border-color: #3c3c3c;
  --details-bg: rgba(255, 255, 255, 0.02);
  --code-bg: rgba(255, 255, 255, 0.1);
  --diff-bg: #1e1e1e;
  --diff-text: #d4d4d4;
}

.body--light .git-history-dialog {
  --active-bg: rgba(0, 120, 212, 0.1);
  --border-color: #e7e7e7;
  --details-bg: rgba(0, 0, 0, 0.02);
  --code-bg: rgba(0, 0, 0, 0.05);
  --diff-bg: #f5f5f5;
  --diff-text: #333333;
}
</style>
