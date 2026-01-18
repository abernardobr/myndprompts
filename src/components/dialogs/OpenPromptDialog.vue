<script setup lang="ts">
/**
 * OpenPromptDialog Component
 *
 * Dialog for opening an existing prompt from the prompts directory
 * or browsing for a file using the native file dialog.
 */

import { ref, computed, watch, onMounted } from 'vue';
import { usePromptStore } from '@/stores/promptStore';
import type { IPromptFile } from '@/services/file-system/types';

interface Props {
  modelValue: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'open', filePath: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const promptStore = usePromptStore();

// State
const searchQuery = ref('');
const selectedPrompt = ref<IPromptFile | null>(null);
const isLoading = ref(false);

// Filtered prompts based on search
const filteredPrompts = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  if (!query) {
    return promptStore.allPrompts;
  }

  return promptStore.allPrompts.filter(
    (p) =>
      p.metadata.title.toLowerCase().includes(query) ||
      (p.metadata.description?.toLowerCase().includes(query) ?? false) ||
      p.metadata.tags.some((t) => t.toLowerCase().includes(query))
  );
});

// Refresh prompts list when dialog opens
watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen) {
      searchQuery.value = '';
      selectedPrompt.value = null;
      isLoading.value = true;
      try {
        await promptStore.refreshAllPrompts();
      } finally {
        isLoading.value = false;
      }
    }
  }
);

// Initial load
onMounted(async () => {
  await promptStore.refreshAllPrompts();
});

function handleClose(): void {
  emit('update:modelValue', false);
}

function handleSelect(prompt: IPromptFile): void {
  selectedPrompt.value = prompt;
}

function handleOpen(): void {
  if (selectedPrompt.value) {
    emit('open', selectedPrompt.value.filePath);
    emit('update:modelValue', false);
  }
}

function handleDoubleClick(prompt: IPromptFile): void {
  emit('open', prompt.filePath);
  emit('update:modelValue', false);
}

async function handleBrowse(): Promise<void> {
  const electronAPI = window.electronAPI;
  if (electronAPI?.showOpenDialog === undefined) {
    console.warn('File dialog not available (not in Electron)');
    return;
  }

  try {
    const result = await electronAPI.showOpenDialog({
      title: 'Open Prompt',
      filters: [{ name: 'Markdown files', extensions: ['md'] }],
      properties: ['openFile'],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      if (filePath !== undefined && filePath !== '') {
        emit('open', filePath);
        emit('update:modelValue', false);
      }
    }
  } catch (error) {
    console.error('Failed to open file dialog:', error);
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card class="open-prompt-dialog">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Open Prompt</div>
        <q-space />
        <q-btn
          v-close-popup
          icon="close"
          flat
          round
          dense
          @click="handleClose"
        />
      </q-card-section>

      <q-card-section>
        <q-input
          v-model="searchQuery"
          placeholder="Search prompts..."
          outlined
          dense
          clearable
          autofocus
        >
          <template #prepend>
            <q-icon name="search" />
          </template>
        </q-input>
      </q-card-section>

      <q-card-section class="q-pt-none prompt-list-section">
        <q-scroll-area class="prompt-list-scroll">
          <q-list
            v-if="!isLoading && filteredPrompts.length > 0"
            bordered
            separator
          >
            <q-item
              v-for="prompt in filteredPrompts"
              :key="prompt.filePath"
              clickable
              :active="selectedPrompt?.filePath === prompt.filePath"
              active-class="bg-primary text-white"
              @click="handleSelect(prompt)"
              @dblclick="handleDoubleClick(prompt)"
            >
              <q-item-section avatar>
                <q-icon name="description" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ prompt.metadata.title }}</q-item-label>
                <q-item-label
                  v-if="prompt.metadata.description"
                  caption
                  lines="1"
                >
                  {{ prompt.metadata.description }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-item-label caption>
                  {{ formatDate(prompt.metadata.updatedAt) }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <div
            v-else-if="!isLoading && filteredPrompts.length === 0"
            class="text-center q-pa-lg text-grey-6"
          >
            <q-icon
              name="folder_open"
              size="48px"
              class="q-mb-md"
            />
            <div v-if="searchQuery">No prompts match your search</div>
            <div v-else>No prompts found. Create your first prompt!</div>
          </div>

          <div
            v-else
            class="text-center q-pa-lg"
          >
            <q-spinner-dots
              color="primary"
              size="40px"
            />
          </div>
        </q-scroll-area>
      </q-card-section>

      <q-card-actions
        align="right"
        class="q-px-md q-pb-md"
      >
        <q-btn
          flat
          label="Browse..."
          color="grey"
          icon="folder_open"
          @click="handleBrowse"
        />
        <q-space />
        <q-btn
          flat
          label="Cancel"
          color="grey"
          @click="handleClose"
        />
        <q-btn
          unelevated
          label="Open"
          color="primary"
          :disable="!selectedPrompt"
          @click="handleOpen"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style lang="scss" scoped>
.open-prompt-dialog {
  min-width: 500px;
  max-width: 700px;
  width: 100%;
}

.prompt-list-section {
  padding-top: 0;
}

.prompt-list-scroll {
  height: 300px;
}
</style>
