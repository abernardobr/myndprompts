<script setup lang="ts">
/**
 * GitSetupDialog Component
 *
 * Dialog for setting up Git/GitHub integration for a project.
 * Allows initializing a Git repo, connecting to GitHub, and configuring remotes.
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
  (e: 'setup-complete'): void;
}>();

const { t } = useI18n({ useScope: 'global' });
const $q = useQuasar();
const gitStore = useGitStore();

// Local state
const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

// Tab state
const activeTab = ref('status');

// Form state
const remoteUrl = ref('');
const remoteName = ref('origin');
const gitUserName = ref('');
const gitUserEmail = ref('');
const commitMessage = ref('Initial commit');

// Loading state
const isCheckingRepo = ref(false);
const isInitializing = ref(false);
const isAddingRemote = ref(false);
const isCommitting = ref(false);
const isPushing = ref(false);
const isPulling = ref(false);
const isFetching = ref(false);
const isConfiguringUser = ref(false);

// Git status
const isGitRepo = ref(false);
const currentBranch = ref('');
const remotes = ref<{ name: string; url: string }[]>([]);
const hasUncommittedChanges = ref(false);
const stagedCount = ref(0);
const unstagedCount = ref(0);
const untrackedCount = ref(0);
const aheadCount = ref(0);
const behindCount = ref(0);

// Check Git status when dialog opens
watch(
  () => props.modelValue,
  async (value) => {
    if (value && props.projectPath) {
      await checkGitStatus();
    }
  }
);

onMounted(async () => {
  if (props.modelValue && props.projectPath) {
    await checkGitStatus();
  }
});

// Check the Git status of the project directory
async function checkGitStatus(): Promise<void> {
  if (!props.projectPath) return;

  isCheckingRepo.value = true;

  try {
    // Initialize Git store for this path
    await gitStore.initialize(props.projectPath);

    isGitRepo.value = gitStore.isRepo;
    currentBranch.value = gitStore.currentBranch;

    if (isGitRepo.value) {
      // Get status details
      stagedCount.value = gitStore.stagedFiles.length;
      unstagedCount.value = gitStore.modifiedFiles.length;
      untrackedCount.value = gitStore.untrackedFiles.length;
      hasUncommittedChanges.value = gitStore.hasChanges;
      aheadCount.value = gitStore.aheadBehind.ahead;
      behindCount.value = gitStore.aheadBehind.behind;

      // Load remotes
      await gitStore.loadRemotes();
      remotes.value = gitStore.remotes.map((r) => ({
        name: r.name,
        url: r.fetchUrl ?? r.pushUrl ?? '',
      }));

      // Load user config
      await gitStore.loadUserConfig();
      gitUserName.value = gitStore.userConfig.name ?? '';
      gitUserEmail.value = gitStore.userConfig.email ?? '';
    }
  } catch (err) {
    console.error('Failed to check Git status:', err);
  } finally {
    isCheckingRepo.value = false;
  }
}

// Initialize a new Git repository
async function initRepository(): Promise<void> {
  if (!props.projectPath) return;

  isInitializing.value = true;

  try {
    const success = await gitStore.initRepository(props.projectPath);

    if (success) {
      $q.notify({
        type: 'positive',
        message: 'Git repository initialized successfully',
        position: 'top',
        timeout: 3000,
      });
      await checkGitStatus();
    } else {
      $q.notify({
        type: 'negative',
        message: gitStore.error ?? 'Failed to initialize Git repository',
        position: 'top',
        timeout: 4000,
      });
    }
  } catch (err) {
    console.error('Failed to init repository:', err);
    $q.notify({
      type: 'negative',
      message: 'Failed to initialize Git repository',
      position: 'top',
      timeout: 4000,
    });
  } finally {
    isInitializing.value = false;
  }
}

// Add a remote
async function addRemote(): Promise<void> {
  if (!remoteUrl.value.trim() || !remoteName.value.trim()) {
    $q.notify({
      type: 'warning',
      message: 'Please enter remote name and URL',
      position: 'top',
      timeout: 3000,
    });
    return;
  }

  isAddingRemote.value = true;

  try {
    const success = await gitStore.addRemote(remoteName.value, remoteUrl.value);

    if (success) {
      $q.notify({
        type: 'positive',
        message: `Remote '${remoteName.value}' added successfully`,
        position: 'top',
        timeout: 3000,
      });
      remoteUrl.value = '';
      await checkGitStatus();
    } else {
      $q.notify({
        type: 'negative',
        message: gitStore.error ?? 'Failed to add remote',
        position: 'top',
        timeout: 4000,
      });
    }
  } catch (err) {
    console.error('Failed to add remote:', err);
    $q.notify({
      type: 'negative',
      message: 'Failed to add remote',
      position: 'top',
      timeout: 4000,
    });
  } finally {
    isAddingRemote.value = false;
  }
}

// Configure Git user
async function configureUser(): Promise<void> {
  if (!gitUserName.value.trim() || !gitUserEmail.value.trim()) {
    $q.notify({
      type: 'warning',
      message: 'Please enter name and email',
      position: 'top',
      timeout: 3000,
    });
    return;
  }

  isConfiguringUser.value = true;

  try {
    const success = await gitStore.setUserConfig(gitUserName.value, gitUserEmail.value, false);

    if (success) {
      $q.notify({
        type: 'positive',
        message: 'Git user configured successfully',
        position: 'top',
        timeout: 3000,
      });
    } else {
      $q.notify({
        type: 'negative',
        message: gitStore.error ?? 'Failed to configure Git user',
        position: 'top',
        timeout: 4000,
      });
    }
  } catch (err) {
    console.error('Failed to configure user:', err);
    $q.notify({
      type: 'negative',
      message: 'Failed to configure Git user',
      position: 'top',
      timeout: 4000,
    });
  } finally {
    isConfiguringUser.value = false;
  }
}

// Stage all changes and commit
async function commitAll(): Promise<void> {
  if (!commitMessage.value.trim()) {
    $q.notify({
      type: 'warning',
      message: 'Please enter a commit message',
      position: 'top',
      timeout: 3000,
    });
    return;
  }

  isCommitting.value = true;

  try {
    // Stage all changes
    await gitStore.stageFiles('all');

    // Commit
    const success = await gitStore.commit(commitMessage.value);

    if (success) {
      $q.notify({
        type: 'positive',
        message: 'Changes committed successfully',
        position: 'top',
        timeout: 3000,
      });
      commitMessage.value = '';
      await checkGitStatus();
    } else {
      $q.notify({
        type: 'negative',
        message: gitStore.error ?? 'Failed to commit changes',
        position: 'top',
        timeout: 4000,
      });
    }
  } catch (err) {
    console.error('Failed to commit:', err);
    $q.notify({
      type: 'negative',
      message: 'Failed to commit changes',
      position: 'top',
      timeout: 4000,
    });
  } finally {
    isCommitting.value = false;
  }
}

// Push to remote
async function pushToRemote(): Promise<void> {
  isPushing.value = true;

  try {
    const success = await gitStore.push();

    if (success) {
      $q.notify({
        type: 'positive',
        message: 'Pushed to remote successfully',
        position: 'top',
        timeout: 3000,
      });
      await checkGitStatus();
    } else {
      $q.notify({
        type: 'negative',
        message: gitStore.error ?? 'Failed to push to remote',
        position: 'top',
        timeout: 4000,
      });
    }
  } catch (err) {
    console.error('Failed to push:', err);
    $q.notify({
      type: 'negative',
      message: 'Failed to push to remote',
      position: 'top',
      timeout: 4000,
    });
  } finally {
    isPushing.value = false;
  }
}

// Pull from remote
async function pullFromRemote(): Promise<void> {
  isPulling.value = true;

  try {
    const success = await gitStore.pull();

    if (success) {
      $q.notify({
        type: 'positive',
        message: 'Pulled from remote successfully',
        position: 'top',
        timeout: 3000,
      });
      await checkGitStatus();
      emit('setup-complete');
    } else {
      $q.notify({
        type: 'negative',
        message: gitStore.error ?? 'Failed to pull from remote',
        position: 'top',
        timeout: 4000,
      });
    }
  } catch (err) {
    console.error('Failed to pull:', err);
    $q.notify({
      type: 'negative',
      message: 'Failed to pull from remote',
      position: 'top',
      timeout: 4000,
    });
  } finally {
    isPulling.value = false;
  }
}

// Fetch from remote
async function fetchFromRemote(): Promise<void> {
  isFetching.value = true;

  try {
    const success = await gitStore.fetch();

    if (success) {
      $q.notify({
        type: 'positive',
        message: 'Fetched from remote successfully',
        position: 'top',
        timeout: 3000,
      });
      await checkGitStatus();
    } else {
      $q.notify({
        type: 'negative',
        message: gitStore.error ?? 'Failed to fetch from remote',
        position: 'top',
        timeout: 4000,
      });
    }
  } catch (err) {
    console.error('Failed to fetch:', err);
    $q.notify({
      type: 'negative',
      message: 'Failed to fetch from remote',
      position: 'top',
      timeout: 4000,
    });
  } finally {
    isFetching.value = false;
  }
}

// Close dialog
function closeDialog(): void {
  isOpen.value = false;
  emit('setup-complete');
}

// Computed
const hasRemote = computed(() => remotes.value.length > 0);
const canPush = computed(
  () => hasRemote.value && (aheadCount.value > 0 || !hasUncommittedChanges.value)
);
const canPull = computed(() => hasRemote.value);
const totalChanges = computed(() => stagedCount.value + unstagedCount.value + untrackedCount.value);
</script>

<template>
  <q-dialog
    v-model="isOpen"
    persistent
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card
      class="git-setup-dialog"
      data-testid="git-setup-dialog"
    >
      <!-- Header -->
      <q-card-section class="git-setup-dialog__header">
        <div class="git-setup-dialog__title-row">
          <q-icon
            name="mdi-git"
            size="28px"
            color="orange"
          />
          <div class="git-setup-dialog__title-text">
            <h6 class="q-ma-none">{{ t('dialogs.gitSetup.title') }}</h6>
            <span class="text-caption text-grey">{{ projectName }}</span>
          </div>
          <q-space />
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
      <q-card-section class="git-setup-dialog__content">
        <!-- Loading state -->
        <div
          v-if="isCheckingRepo"
          class="git-setup-dialog__loading"
        >
          <q-spinner-dots
            color="primary"
            size="40px"
          />
          <span class="q-mt-md text-grey">{{ t('common.loading') }}</span>
        </div>

        <!-- Not a Git repository -->
        <div
          v-else-if="!isGitRepo"
          class="git-setup-dialog__init"
        >
          <q-icon
            name="mdi-source-repository"
            size="64px"
            color="grey-6"
          />
          <h6 class="q-mt-md q-mb-sm">{{ t('gitPanel.notInitialized') }}</h6>
          <p class="text-grey text-center">
            {{ t('gitPanel.notInitialized') }}
          </p>
          <q-btn
            color="primary"
            :label="t('gitPanel.initializeRepo')"
            icon="mdi-source-repository"
            :loading="isInitializing"
            @click="initRepository"
          />
        </div>

        <!-- Git repository view -->
        <div
          v-else
          class="git-setup-dialog__repo"
        >
          <!-- Status bar -->
          <div class="git-setup-dialog__status-bar">
            <q-chip
              dense
              color="primary"
              text-color="white"
              icon="mdi-source-branch"
            >
              {{ currentBranch || 'main' }}
            </q-chip>

            <q-chip
              v-if="totalChanges > 0"
              dense
              color="orange"
              text-color="white"
              icon="mdi-file-edit"
            >
              {{ totalChanges }} change{{ totalChanges > 1 ? 's' : '' }}
            </q-chip>

            <q-chip
              v-if="aheadCount > 0"
              dense
              color="positive"
              text-color="white"
              icon="mdi-arrow-up"
            >
              {{ aheadCount }} ahead
            </q-chip>

            <q-chip
              v-if="behindCount > 0"
              dense
              color="warning"
              text-color="white"
              icon="mdi-arrow-down"
            >
              {{ behindCount }} behind
            </q-chip>

            <q-chip
              v-if="hasRemote"
              dense
              color="grey-7"
              text-color="white"
              icon="mdi-cloud"
            >
              {{ remotes[0]?.name }}
            </q-chip>

            <q-space />

            <q-btn
              flat
              dense
              round
              icon="refresh"
              @click="checkGitStatus"
            >
              <q-tooltip>{{ t('common.refresh') }}</q-tooltip>
            </q-btn>
          </div>

          <!-- Tabs -->
          <q-tabs
            v-model="activeTab"
            dense
            class="git-setup-dialog__tabs"
            active-color="primary"
            indicator-color="primary"
            align="left"
          >
            <q-tab
              name="status"
              :label="t('common.info')"
              icon="mdi-information"
            />
            <q-tab
              name="commit"
              :label="t('gitPanel.commit')"
              icon="mdi-source-commit"
            />
            <q-tab
              name="remotes"
              :label="t('gitPanel.branches')"
              icon="mdi-cloud"
            />
            <q-tab
              name="settings"
              :label="t('settingsPanel.title')"
              icon="mdi-cog"
            />
          </q-tabs>

          <q-separator />

          <!-- Tab panels -->
          <q-tab-panels
            v-model="activeTab"
            animated
            class="git-setup-dialog__panels"
          >
            <!-- Status panel -->
            <q-tab-panel name="status">
              <div class="git-setup-dialog__panel-content">
                <!-- Quick actions -->
                <div class="git-setup-dialog__quick-actions">
                  <q-btn
                    outline
                    color="primary"
                    icon="mdi-arrow-down"
                    :label="t('gitPanel.pull')"
                    :loading="isPulling"
                    :disable="!canPull"
                    @click="pullFromRemote"
                  />
                  <q-btn
                    outline
                    color="primary"
                    icon="mdi-arrow-up"
                    :label="t('gitPanel.push')"
                    :loading="isPushing"
                    :disable="!canPush"
                    @click="pushToRemote"
                  />
                  <q-btn
                    outline
                    color="grey"
                    icon="mdi-cloud-download"
                    :label="t('gitPanel.fetch')"
                    :loading="isFetching"
                    :disable="!hasRemote"
                    @click="fetchFromRemote"
                  />
                </div>

                <!-- Changes summary -->
                <div
                  v-if="hasUncommittedChanges"
                  class="git-setup-dialog__changes"
                >
                  <h6 class="q-ma-none q-mb-sm">{{ t('gitPanel.changes') }}</h6>
                  <div class="git-setup-dialog__changes-grid">
                    <div
                      v-if="stagedCount > 0"
                      class="git-setup-dialog__change-item"
                    >
                      <q-icon
                        name="mdi-plus-circle"
                        color="positive"
                      />
                      <span>{{ stagedCount }} staged</span>
                    </div>
                    <div
                      v-if="unstagedCount > 0"
                      class="git-setup-dialog__change-item"
                    >
                      <q-icon
                        name="mdi-pencil-circle"
                        color="orange"
                      />
                      <span>{{ unstagedCount }} modified</span>
                    </div>
                    <div
                      v-if="untrackedCount > 0"
                      class="git-setup-dialog__change-item"
                    >
                      <q-icon
                        name="mdi-help-circle"
                        color="grey"
                      />
                      <span>{{ untrackedCount }} untracked</span>
                    </div>
                  </div>
                </div>

                <!-- No changes message -->
                <div
                  v-else
                  class="git-setup-dialog__no-changes"
                >
                  <q-icon
                    name="mdi-check-circle"
                    size="48px"
                    color="positive"
                  />
                  <span class="q-mt-sm text-grey">{{ t('gitPanel.noChanges') }}</span>
                </div>

                <!-- Remote info -->
                <div
                  v-if="hasRemote"
                  class="git-setup-dialog__remote-info q-mt-lg"
                >
                  <h6 class="q-ma-none q-mb-sm">{{ t('dialogs.branch.remote') }}</h6>
                  <div
                    v-for="remote in remotes"
                    :key="remote.name"
                    class="git-setup-dialog__remote-item"
                  >
                    <q-icon
                      name="mdi-cloud"
                      color="grey"
                    />
                    <div class="git-setup-dialog__remote-details">
                      <span class="text-weight-medium">{{ remote.name }}</span>
                      <span class="text-caption text-grey">{{ remote.url }}</span>
                    </div>
                  </div>
                </div>

                <!-- No remote message -->
                <div
                  v-else
                  class="git-setup-dialog__no-remote q-mt-lg"
                >
                  <q-icon
                    name="mdi-cloud-off-outline"
                    size="32px"
                    color="grey-6"
                  />
                  <span class="text-grey q-mt-sm">No remote configured</span>
                  <q-btn
                    flat
                    color="primary"
                    :label="t('common.add')"
                    @click="activeTab = 'remotes'"
                  />
                </div>
              </div>
            </q-tab-panel>

            <!-- Commit panel -->
            <q-tab-panel name="commit">
              <div class="git-setup-dialog__panel-content">
                <div
                  v-if="!hasUncommittedChanges"
                  class="git-setup-dialog__no-changes"
                >
                  <q-icon
                    name="mdi-check-circle"
                    size="48px"
                    color="positive"
                  />
                  <span class="q-mt-sm text-grey">{{ t('gitPanel.noChanges') }}</span>
                </div>

                <div
                  v-else
                  class="git-setup-dialog__commit-form"
                >
                  <p class="text-grey q-mb-md">
                    Stage and commit all {{ totalChanges }} change{{ totalChanges > 1 ? 's' : '' }}
                  </p>

                  <q-input
                    v-model="commitMessage"
                    outlined
                    type="textarea"
                    :label="t('gitPanel.commitMessage')"
                    :placeholder="t('gitPanel.commitPlaceholder')"
                    :rows="4"
                    autogrow
                    class="q-mb-md"
                  />

                  <q-btn
                    color="primary"
                    icon="mdi-source-commit"
                    :label="t('gitPanel.commit')"
                    :loading="isCommitting"
                    :disable="!commitMessage.trim()"
                    @click="commitAll"
                  />
                </div>
              </div>
            </q-tab-panel>

            <!-- Remotes panel -->
            <q-tab-panel name="remotes">
              <div class="git-setup-dialog__panel-content">
                <!-- Existing remotes -->
                <div
                  v-if="remotes.length > 0"
                  class="q-mb-lg"
                >
                  <h6 class="q-ma-none q-mb-sm">{{ t('dialogs.branch.remote') }}</h6>
                  <q-list
                    bordered
                    separator
                  >
                    <q-item
                      v-for="remote in remotes"
                      :key="remote.name"
                    >
                      <q-item-section avatar>
                        <q-icon
                          name="mdi-cloud"
                          color="primary"
                        />
                      </q-item-section>
                      <q-item-section>
                        <q-item-label>{{ remote.name }}</q-item-label>
                        <q-item-label caption>{{ remote.url }}</q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </div>

                <!-- Add remote form -->
                <h6 class="q-ma-none q-mb-sm">{{ t('common.add') }}</h6>
                <p class="text-caption text-grey q-mb-md">
                  {{ t('dialogs.branch.remote') }}
                </p>

                <q-input
                  v-model="remoteName"
                  outlined
                  dense
                  :label="t('dialogs.branch.branchName')"
                  placeholder="origin"
                  class="q-mb-sm"
                />

                <q-input
                  v-model="remoteUrl"
                  outlined
                  dense
                  label="URL"
                  placeholder="https://github.com/user/repo.git"
                  class="q-mb-md"
                />

                <q-btn
                  color="primary"
                  icon="mdi-plus"
                  :label="t('common.add')"
                  :loading="isAddingRemote"
                  :disable="!remoteUrl.trim() || !remoteName.trim()"
                  @click="addRemote"
                />
              </div>
            </q-tab-panel>

            <!-- Settings panel -->
            <q-tab-panel name="settings">
              <div class="git-setup-dialog__panel-content">
                <h6 class="q-ma-none q-mb-sm">{{ t('dialogs.gitSetup.configureGit') }}</h6>
                <p class="text-caption text-grey q-mb-md">
                  {{ t('dialogs.gitSetup.configureGit') }}
                </p>

                <q-input
                  v-model="gitUserName"
                  outlined
                  dense
                  :label="t('dialogs.gitSetup.userName')"
                  :placeholder="t('dialogs.gitSetup.userNamePlaceholder')"
                  class="q-mb-sm"
                />

                <q-input
                  v-model="gitUserEmail"
                  outlined
                  dense
                  :label="t('dialogs.gitSetup.userEmail')"
                  :placeholder="t('dialogs.gitSetup.userEmailPlaceholder')"
                  class="q-mb-md"
                />

                <q-btn
                  color="primary"
                  icon="mdi-content-save"
                  :label="t('common.save')"
                  :loading="isConfiguringUser"
                  :disable="!gitUserName.trim() || !gitUserEmail.trim()"
                  @click="configureUser"
                />
              </div>
            </q-tab-panel>
          </q-tab-panels>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style lang="scss" scoped>
.git-setup-dialog {
  display: flex;
  flex-direction: column;
  max-width: 600px;
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
  }

  &__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px;
  }

  &__init {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px;
    text-align: center;
  }

  &__repo {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  &__status-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    flex-wrap: wrap;
  }

  &__tabs {
    background: transparent;
  }

  &__panels {
    flex: 1;
    overflow: auto;
  }

  &__panel-content {
    padding: 16px;
  }

  &__quick-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
  }

  &__changes {
    background: var(--changes-bg, rgba(255, 152, 0, 0.1));
    border-radius: 8px;
    padding: 16px;
  }

  &__changes-grid {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  &__change-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__no-changes {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px;
  }

  &__remote-info {
    background: var(--remote-bg, rgba(0, 0, 0, 0.05));
    border-radius: 8px;
    padding: 16px;
  }

  &__remote-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 8px 0;
  }

  &__remote-details {
    display: flex;
    flex-direction: column;
  }

  &__no-remote {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px;
    background: var(--no-remote-bg, rgba(0, 0, 0, 0.05));
    border-radius: 8px;
  }

  &__commit-form {
    max-width: 500px;
  }
}

// Theme adjustments
.body--dark .git-setup-dialog {
  --changes-bg: rgba(255, 152, 0, 0.15);
  --remote-bg: rgba(255, 255, 255, 0.05);
  --no-remote-bg: rgba(255, 255, 255, 0.05);
}

.body--light .git-setup-dialog {
  --changes-bg: rgba(255, 152, 0, 0.1);
  --remote-bg: rgba(0, 0, 0, 0.03);
  --no-remote-bg: rgba(0, 0, 0, 0.03);
}
</style>
