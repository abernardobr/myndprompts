<script setup lang="ts">
/**
 * BranchDialog Component
 *
 * Dialog for viewing and switching Git branches for a project.
 * Allows switching between existing branches and creating new ones.
 */

import { ref, computed, watch, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { useGitStore } from '@/stores/gitStore';

const props = defineProps<{
  modelValue: boolean;
  projectPath: string;
  projectName: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'branchChanged'): void;
}>();

const $q = useQuasar();
const gitStore = useGitStore();

// Local state
const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

// Loading states
const isLoading = ref(false);
const isSwitching = ref(false);
const isCreating = ref(false);

// New branch form
const showNewBranchForm = ref(false);
const newBranchName = ref('');
const newBranchInput = ref<HTMLInputElement | null>(null);

// Computed
const currentBranch = computed(() => gitStore.currentBranch);
const branches = computed(() => gitStore.branches);

const localBranches = computed(() =>
  branches.value
    .filter((b) => !b.isRemote)
    .sort((a, b) => {
      // Current branch first, then alphabetically
      if (a.name === currentBranch.value) return -1;
      if (b.name === currentBranch.value) return 1;
      return a.name.localeCompare(b.name);
    })
);

const remoteBranches = computed(() =>
  branches.value.filter((b) => b.isRemote).sort((a, b) => a.name.localeCompare(b.name))
);

// Validation
const branchNameError = computed(() => {
  const name = newBranchName.value.trim();
  if (!name) return 'Branch name is required';
  if (!/^[a-zA-Z0-9_\-/]+$/.test(name)) {
    return 'Invalid characters. Use only letters, numbers, -, _, /';
  }
  if (branches.value.some((b) => b.name === name)) {
    return 'Branch already exists';
  }
  return '';
});

const isNewBranchValid = computed(() => !branchNameError.value);

// Load branches when dialog opens
watch(
  () => props.modelValue,
  async (value) => {
    if (value && props.projectPath) {
      await loadBranches();
    }
  }
);

onMounted(async () => {
  if (props.modelValue && props.projectPath) {
    await loadBranches();
  }
});

async function loadBranches(): Promise<void> {
  isLoading.value = true;
  showNewBranchForm.value = false;
  newBranchName.value = '';

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

    await gitStore.loadBranches();
  } catch (err) {
    console.error('Failed to load branches:', err);
    $q.notify({
      type: 'negative',
      message: 'Failed to load branches',
      position: 'top',
      timeout: 4000,
    });
  } finally {
    isLoading.value = false;
  }
}

async function switchToBranch(branchName: string): Promise<void> {
  if (branchName === currentBranch.value) return;

  isSwitching.value = true;

  try {
    const success = await gitStore.switchBranch(branchName);
    if (success) {
      $q.notify({
        type: 'positive',
        message: `Switched to branch "${branchName}"`,
        position: 'top',
        timeout: 3000,
      });
      emit('branchChanged');
    } else {
      $q.notify({
        type: 'negative',
        message: gitStore.error ?? 'Failed to switch branch',
        position: 'top',
        timeout: 4000,
      });
    }
  } catch (err) {
    console.error('Failed to switch branch:', err);
    $q.notify({
      type: 'negative',
      message: 'Failed to switch branch',
      position: 'top',
      timeout: 4000,
    });
  } finally {
    isSwitching.value = false;
  }
}

async function createBranch(): Promise<void> {
  if (!isNewBranchValid.value) return;

  isCreating.value = true;
  const name = newBranchName.value.trim();

  try {
    const success = await gitStore.createBranch(name);
    if (success) {
      // Switch to the new branch
      await gitStore.switchBranch(name);

      $q.notify({
        type: 'positive',
        message: `Created and switched to branch "${name}"`,
        position: 'top',
        timeout: 3000,
      });

      showNewBranchForm.value = false;
      newBranchName.value = '';
      emit('branchChanged');
    } else {
      $q.notify({
        type: 'negative',
        message: gitStore.error ?? 'Failed to create branch',
        position: 'top',
        timeout: 4000,
      });
    }
  } catch (err) {
    console.error('Failed to create branch:', err);
    $q.notify({
      type: 'negative',
      message: 'Failed to create branch',
      position: 'top',
      timeout: 4000,
    });
  } finally {
    isCreating.value = false;
  }
}

function showCreateForm(): void {
  showNewBranchForm.value = true;
  setTimeout(() => {
    newBranchInput.value?.focus();
  }, 100);
}

function cancelCreate(): void {
  showNewBranchForm.value = false;
  newBranchName.value = '';
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && isNewBranchValid.value && showNewBranchForm.value) {
    void createBranch();
  } else if (event.key === 'Escape' && showNewBranchForm.value) {
    cancelCreate();
  }
}

function closeDialog(): void {
  isOpen.value = false;
}
</script>

<template>
  <q-dialog
    v-model="isOpen"
    persistent
  >
    <q-card
      class="branch-dialog"
      @keydown="handleKeydown"
    >
      <!-- Header -->
      <q-card-section class="branch-dialog__header">
        <div class="branch-dialog__title-row">
          <q-icon
            name="mdi-source-branch"
            size="24px"
            color="primary"
          />
          <div class="branch-dialog__title-text">
            <div class="text-h6">Branches</div>
            <div class="text-caption text-grey">{{ projectName }}</div>
          </div>
          <q-space />
          <q-btn
            flat
            dense
            round
            icon="refresh"
            :loading="isLoading"
            @click="loadBranches"
          >
            <q-tooltip>Refresh</q-tooltip>
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

      <!-- Current branch indicator -->
      <q-card-section class="branch-dialog__current">
        <div class="text-caption text-grey q-mb-xs">Current Branch</div>
        <q-chip
          icon="mdi-source-branch-check"
          color="primary"
          text-color="white"
          size="md"
        >
          {{ currentBranch || 'Unknown' }}
        </q-chip>
      </q-card-section>

      <q-separator />

      <!-- Content -->
      <q-card-section class="branch-dialog__content">
        <!-- Loading state -->
        <div
          v-if="isLoading"
          class="branch-dialog__loading"
        >
          <q-spinner-dots
            color="primary"
            size="32px"
          />
          <span class="q-mt-sm text-grey">Loading branches...</span>
        </div>

        <!-- Branches list -->
        <div v-else>
          <!-- New branch form -->
          <div
            v-if="showNewBranchForm"
            class="branch-dialog__new-form q-mb-md"
          >
            <q-input
              ref="newBranchInput"
              v-model="newBranchName"
              label="New branch name"
              outlined
              dense
              autofocus
              :error="!!branchNameError && newBranchName.length > 0"
              :error-message="branchNameError"
            >
              <template #append>
                <q-btn
                  flat
                  dense
                  round
                  icon="close"
                  size="sm"
                  @click="cancelCreate"
                >
                  <q-tooltip>Cancel</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  dense
                  round
                  icon="check"
                  size="sm"
                  color="positive"
                  :disable="!isNewBranchValid"
                  :loading="isCreating"
                  @click="createBranch"
                >
                  <q-tooltip>Create</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </div>

          <!-- Create branch button -->
          <q-btn
            v-else
            flat
            no-caps
            color="primary"
            icon="add"
            label="Create new branch"
            class="q-mb-md full-width"
            @click="showCreateForm"
          />

          <!-- Local branches -->
          <div class="text-caption text-grey q-mb-xs">Local Branches</div>
          <q-list
            separator
            class="branch-dialog__list"
          >
            <q-item
              v-for="branch in localBranches"
              :key="branch.name"
              clickable
              :active="branch.name === currentBranch"
              active-class="branch-dialog__branch--active"
              :disable="isSwitching"
              @click="switchToBranch(branch.name)"
            >
              <q-item-section avatar>
                <q-icon
                  :name="
                    branch.name === currentBranch ? 'mdi-source-branch-check' : 'mdi-source-branch'
                  "
                  :color="branch.name === currentBranch ? 'primary' : 'grey'"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ branch.name }}</q-item-label>
              </q-item-section>
              <q-item-section
                v-if="branch.name === currentBranch"
                side
              >
                <q-badge
                  color="primary"
                  label="current"
                />
              </q-item-section>
              <q-item-section
                v-if="isSwitching"
                side
              >
                <q-spinner
                  size="16px"
                  color="primary"
                />
              </q-item-section>
            </q-item>

            <q-item v-if="localBranches.length === 0">
              <q-item-section class="text-grey text-center">
                No local branches found
              </q-item-section>
            </q-item>
          </q-list>

          <!-- Remote branches -->
          <template v-if="remoteBranches.length > 0">
            <div class="text-caption text-grey q-mt-md q-mb-xs">Remote Branches</div>
            <q-list
              separator
              class="branch-dialog__list"
            >
              <q-item
                v-for="branch in remoteBranches"
                :key="branch.name"
                clickable
                :disable="isSwitching"
                @click="switchToBranch(branch.name)"
              >
                <q-item-section avatar>
                  <q-icon
                    name="mdi-source-branch-remote"
                    color="grey"
                  />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ branch.name }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </template>
        </div>
      </q-card-section>

      <!-- Footer -->
      <q-card-actions
        align="right"
        class="q-px-md q-pb-md"
      >
        <q-btn
          flat
          label="Close"
          color="grey"
          @click="closeDialog"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style lang="scss" scoped>
.branch-dialog {
  min-width: 400px;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;

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

  &__current {
    padding: 12px 16px;
  }

  &__content {
    flex: 1;
    overflow-y: auto;
    max-height: 400px;
  }

  &__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px;
  }

  &__new-form {
    padding: 8px;
    background: var(--form-bg, rgba(0, 0, 0, 0.02));
    border-radius: 8px;
  }

  &__list {
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 8px;
    overflow: hidden;
  }

  &__branch--active {
    background-color: var(--active-bg, rgba(0, 120, 212, 0.1));
  }
}

// Theme adjustments
.body--dark .branch-dialog {
  --form-bg: rgba(255, 255, 255, 0.05);
  --border-color: #3c3c3c;
  --active-bg: rgba(0, 120, 212, 0.2);
}

.body--light .branch-dialog {
  --form-bg: rgba(0, 0, 0, 0.02);
  --border-color: #e0e0e0;
  --active-bg: rgba(0, 120, 212, 0.1);
}
</style>
