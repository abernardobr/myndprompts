<script setup lang="ts">
/**
 * PluginContentSelectorDialog Component
 *
 * A reusable dialog for selecting and adding content items from installed plugins.
 * Features:
 * - Tag filtering with multi-select
 * - Multi-select content list with "Select All"
 * - Creates files in the target directory
 * - Loading state during file creation
 */

import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { usePluginStore } from '@/stores/pluginStore';
import { usePromptStore } from '@/stores/promptStore';
import { useSnippetStore } from '@/stores/snippetStore';
import { getPromptFileService } from '@/services/file-system';
import type { PluginType, IPluginItem } from '@/services/storage/entities';
import type { ISnippetMetadata } from '@/services/file-system/types';
import { formatPluginType, getPluginTypeIcon, getPluginTypeColor } from '@/services/plugins/types';

const props = defineProps<{
  modelValue: boolean;
  pluginType: PluginType;
  targetDirectory: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  added: [count: number];
}>();

// File extension constants
const FILE_EXTENSIONS = {
  PROMPT: '.md',
  PERSONA: '.persona.md',
  TEMPLATE: '.template.md',
  SNIPPET: '.snippet.md',
} as const;

/**
 * Content item with additional metadata for display and selection
 */
interface IContentItem extends IPluginItem {
  id: string;
  pluginId: string;
  pluginTags: string[];
}

const { t } = useI18n({ useScope: 'global' });
const $q = useQuasar();
const pluginStore = usePluginStore();
const promptStore = usePromptStore();
const snippetStore = useSnippetStore();

/**
 * Map plugin type to snippet type
 */
const pluginTypeToSnippetType: Record<PluginType, ISnippetMetadata['type'] | null> = {
  persona: 'persona',
  templates: 'template',
  text_snippets: 'text',
  code_snippets: 'code',
};

/**
 * Check if the current plugin type is for snippets
 */
const isSnippetType = computed(() => {
  return pluginTypeToSnippetType[props.pluginType] !== null;
});

/**
 * Get the corresponding snippet type for the current plugin type
 */
const snippetType = computed(() => {
  return pluginTypeToSnippetType[props.pluginType];
});

// File system service for path operations
const promptFileService = getPromptFileService();

// Track names used in current batch to avoid conflicts between items being added
const usedNamesInBatch = ref<Set<string>>(new Set());

/**
 * Sanitize a title for use as filename
 * Matches the logic in prompt-file.service.ts
 */
function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

/**
 * Get the file extension based on snippet type
 */
function getFileExtension(type: ISnippetMetadata['type'] | null): string {
  if (!type) return FILE_EXTENSIONS.PROMPT;

  switch (type) {
    case 'persona':
      return FILE_EXTENSIONS.PERSONA;
    case 'template':
      return FILE_EXTENSIONS.TEMPLATE;
    default:
      return FILE_EXTENSIONS.SNIPPET;
  }
}

/**
 * Check if a file exists at the given path
 */
async function fileExists(filePath: string): Promise<boolean> {
  if (window.fileSystemAPI === null || window.fileSystemAPI === undefined) {
    return false;
  }
  try {
    return await window.fileSystemAPI.fileExists(filePath);
  } catch {
    return false;
  }
}

/**
 * Generate a unique name by adding numeric suffix if needed
 * Handles both existing files and names used in current batch
 */
async function generateUniqueName(
  baseName: string,
  directory: string,
  extension: string
): Promise<string> {
  const sanitized = sanitizeFileName(baseName);
  let candidate = sanitized;
  let suffix = 1;
  const maxAttempts = 100; // Safety limit

  while (suffix <= maxAttempts) {
    const fileName = `${candidate}${extension}`;
    const filePath = await joinPath(directory, fileName);

    // Check if name is used in current batch
    const batchKey = `${directory}/${fileName}`.toLowerCase();
    if (usedNamesInBatch.value.has(batchKey)) {
      candidate = `${sanitized}-${suffix}`;
      suffix++;
      continue;
    }

    // Check if file exists on disk
    const exists = await fileExists(filePath);
    if (exists) {
      candidate = `${sanitized}-${suffix}`;
      suffix++;
      continue;
    }

    // Mark as used in batch
    usedNamesInBatch.value.add(batchKey);
    return candidate;
  }

  // Fallback with timestamp if too many conflicts
  const timestamp = Date.now();
  const fallback = `${sanitized}-${timestamp}`;
  const batchKey = `${directory}/${fallback}${extension}`.toLowerCase();
  usedNamesInBatch.value.add(batchKey);
  return fallback;
}

/**
 * Join path parts using the file system API
 */
async function joinPath(base: string, fileName: string): Promise<string> {
  if (window.fileSystemAPI?.joinPath !== null && window.fileSystemAPI?.joinPath !== undefined) {
    return await window.fileSystemAPI.joinPath(base, fileName);
  }
  // Fallback for non-Electron environments
  return `${base}/${fileName}`;
}

/**
 * Get the appropriate directory for the plugin type
 */
async function getTargetDirectory(): Promise<string> {
  const config = await promptFileService.getConfig();

  if (isSnippetType.value && snippetType.value) {
    // Route to appropriate directory based on snippet type
    switch (snippetType.value) {
      case 'persona':
        return config.personasDir;
      case 'template':
        return config.templatesDir;
      default:
        // text and code snippets go to snippetsDir
        return config.snippetsDir;
    }
  }

  // For prompts, use the target directory prop
  return props.targetDirectory || config.promptsDir;
}

// Local state
const selectedTags = ref<string[]>([]);
const selectedItems = ref<IContentItem[]>([]);
const selectAll = ref(false);
const isAdding = ref(false);
const addError = ref<string | null>(null);

// Type display info
const typeIcon = computed(() => getPluginTypeIcon(props.pluginType));
const typeColor = computed(() => getPluginTypeColor(props.pluginType));
const typeLabel = computed(() => formatPluginType(props.pluginType));

/**
 * Flatten all items from installed plugins of the specified type
 */
const allItems = computed<IContentItem[]>(() => {
  const plugins = pluginStore.getInstalledByType(props.pluginType);
  const items: IContentItem[] = [];

  for (const plugin of plugins) {
    for (let i = 0; i < plugin.items.length; i++) {
      const item = plugin.items[i];
      items.push({
        ...item,
        id: `${plugin.id}-${i}-${item.title}`,
        pluginId: plugin.id,
        pluginTags: plugin.tags,
      });
    }
  }

  return items;
});

/**
 * Filter items by selected tags
 */
const filteredItems = computed(() => {
  if (selectedTags.value.length === 0) {
    return allItems.value;
  }
  return allItems.value.filter((item) =>
    item.pluginTags.some((tag) => selectedTags.value.includes(tag))
  );
});

/**
 * Get unique tags from all items of this plugin type
 */
const availableTags = computed(() => {
  const tags = new Set<string>();
  allItems.value.forEach((item) => {
    item.pluginTags.forEach((tag) => tags.add(tag));
  });
  return Array.from(tags).sort();
});

/**
 * Toggle select all checkbox
 */
function toggleSelectAll(value: boolean): void {
  if (value) {
    selectedItems.value = [...filteredItems.value];
  } else {
    selectedItems.value = [];
  }
}

/**
 * Sync select all checkbox with selection state
 */
watch(selectedItems, () => {
  selectAll.value =
    selectedItems.value.length === filteredItems.value.length && filteredItems.value.length > 0;
});

/**
 * Reset selection when tags filter changes
 */
watch(selectedTags, () => {
  // Remove items from selection that are no longer in filtered list
  const filteredIds = new Set(filteredItems.value.map((item) => item.id));
  selectedItems.value = selectedItems.value.filter((item) => filteredIds.has(item.id));
});

/**
 * Handle adding selected items
 * Routes to the appropriate store based on plugin type
 * Handles naming conflicts by adding numeric suffixes
 */
async function handleAdd(): Promise<void> {
  if (selectedItems.value.length === 0) return;

  isAdding.value = true;
  addError.value = null;

  // Clear batch tracking for this operation
  usedNamesInBatch.value = new Set();

  try {
    let addedCount = 0;
    const targetDir = await getTargetDirectory();
    const extension = getFileExtension(snippetType.value);

    for (const item of selectedItems.value) {
      try {
        // Generate unique name to avoid conflicts
        const uniqueName = await generateUniqueName(item.title, targetDir, extension);

        if (isSnippetType.value && snippetType.value) {
          // Create as snippet with unique name
          await snippetStore.createSnippet(uniqueName, snippetType.value, item.content);
        } else {
          // Create as prompt in target directory with unique name
          await promptStore.createPromptInDirectory(
            props.targetDirectory,
            uniqueName,
            item.content
          );
        }
        addedCount++;
      } catch (err) {
        console.error(`Failed to create file for "${item.title}":`, err);
        // Continue with other items even if one fails
      }
    }

    const totalSelected = selectedItems.value.length;
    const failedCount = totalSelected - addedCount;

    if (addedCount > 0) {
      // Show success notification
      if (failedCount === 0) {
        $q.notify({
          type: 'positive',
          message:
            t('plugins.contentAddedSuccess', { count: addedCount }) ||
            `Added ${addedCount} item(s) from library`,
          icon: 'mdi-check-circle',
          position: 'bottom-right',
        });
      } else {
        // Partial success
        $q.notify({
          type: 'warning',
          message: `Added ${addedCount} item(s), ${failedCount} failed`,
          icon: 'mdi-alert',
          position: 'bottom-right',
        });
      }
      emit('added', addedCount);
      closeDialog();
    } else {
      addError.value = t('plugins.contentAddedError') || 'Failed to add items from library';
      $q.notify({
        type: 'negative',
        message: t('plugins.contentAddedError') || 'Failed to add items from library',
        icon: 'mdi-alert-circle',
        position: 'bottom-right',
      });
    }
  } catch (err) {
    console.error('Failed to add items:', err);
    addError.value = err instanceof Error ? err.message : 'Failed to add items';
    $q.notify({
      type: 'negative',
      message: t('plugins.contentAddedError') || 'Failed to add items from library',
      caption: err instanceof Error ? err.message : undefined,
      icon: 'mdi-alert-circle',
      position: 'bottom-right',
    });
  } finally {
    isAdding.value = false;
    // Clear batch tracking
    usedNamesInBatch.value = new Set();
  }
}

/**
 * Close the dialog
 */
function closeDialog(): void {
  emit('update:modelValue', false);
}

/**
 * Reset state when dialog opens
 */
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      selectedTags.value = [];
      selectedItems.value = [];
      selectAll.value = false;
      addError.value = null;
      usedNamesInBatch.value = new Set();
    }
  }
);
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card class="plugin-content-selector">
      <!-- Header -->
      <q-card-section class="row items-center q-pb-none">
        <q-icon
          :name="typeIcon"
          :color="typeColor"
          size="24px"
          class="q-mr-sm"
        />
        <div class="text-h6">
          {{ t('plugins.addFromLibrary') || 'Add from Library' }} - {{ typeLabel }}
        </div>
        <q-space />
        <q-btn
          icon="mdi-close"
          flat
          round
          dense
          @click="closeDialog"
        />
      </q-card-section>

      <q-card-section>
        <!-- Empty state if no plugins of this type -->
        <div
          v-if="allItems.length === 0"
          class="plugin-content-selector__empty"
        >
          <q-icon
            name="mdi-puzzle-outline"
            size="48px"
            color="grey-5"
          />
          <div class="text-body1 text-grey q-mt-md">
            {{ t('plugins.noPluginsOfType') || 'No installed plugins of this type' }}
          </div>
          <div class="text-caption text-grey">
            {{
              t('plugins.installFromMarketplace') || 'Install plugins from the Marketplace first'
            }}
          </div>
        </div>

        <template v-else>
          <!-- Tag Filter -->
          <div class="q-mb-md">
            <div class="text-caption text-grey q-mb-xs">
              {{ t('plugins.filterByTags') || 'Filter by tags' }}:
            </div>
            <q-select
              v-model="selectedTags"
              :options="availableTags"
              multiple
              dense
              outlined
              use-chips
              clearable
              :placeholder="t('plugins.allTags') || 'All tags'"
              class="plugin-content-selector__tag-select"
            >
              <template #option="{ opt, selected, toggleOption }">
                <q-item
                  clickable
                  @click="toggleOption(opt)"
                >
                  <q-item-section side>
                    <q-checkbox
                      :model-value="selected"
                      @update:model-value="toggleOption(opt)"
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ opt }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
          </div>

          <!-- Select All -->
          <div class="plugin-content-selector__select-all">
            <q-checkbox
              v-model="selectAll"
              :label="`${t('plugins.selectAll') || 'Select All'} (${filteredItems.length} ${t('plugins.items') || 'items'})`"
              @update:model-value="toggleSelectAll"
            />
          </div>

          <q-separator class="q-my-sm" />

          <!-- Content List -->
          <q-scroll-area class="plugin-content-selector__list">
            <q-list separator>
              <q-item
                v-for="item in filteredItems"
                :key="item.id"
                tag="label"
                clickable
              >
                <q-item-section side>
                  <q-checkbox
                    v-model="selectedItems"
                    :val="item"
                  />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ item.title }}</q-item-label>
                  <q-item-label caption>
                    <q-chip
                      v-for="tag in item.pluginTags"
                      :key="tag"
                      dense
                      size="xs"
                      class="q-mr-xs"
                    >
                      {{ tag }}
                    </q-chip>
                  </q-item-label>
                </q-item-section>
                <q-item-section
                  v-if="item.language"
                  side
                >
                  <q-badge
                    outline
                    color="grey"
                    :label="item.language"
                  />
                </q-item-section>
              </q-item>
            </q-list>
          </q-scroll-area>

          <!-- Error message -->
          <div
            v-if="addError"
            class="text-negative q-mt-sm"
          >
            <q-icon
              name="mdi-alert-circle"
              size="16px"
              class="q-mr-xs"
            />
            {{ addError }}
          </div>
        </template>
      </q-card-section>

      <!-- Actions -->
      <q-card-section
        v-if="allItems.length > 0"
        class="row items-center justify-between q-pt-none"
      >
        <div class="text-caption text-grey">
          {{ selectedItems.length }} {{ t('plugins.of') || 'of' }} {{ filteredItems.length }}
          {{ t('plugins.selected') || 'selected' }}
        </div>
        <div>
          <q-btn
            flat
            :label="t('common.cancel') || 'Cancel'"
            class="q-mr-sm"
            @click="closeDialog"
          />
          <q-btn
            color="primary"
            :label="`${t('plugins.addSelected') || 'Add Selected'} (${selectedItems.length})`"
            :disable="selectedItems.length === 0"
            :loading="isAdding"
            @click="handleAdd"
          />
        </div>
      </q-card-section>

      <!-- Close button for empty state -->
      <q-card-actions
        v-else
        align="right"
      >
        <q-btn
          flat
          :label="t('common.close') || 'Close'"
          @click="closeDialog"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style lang="scss" scoped>
.plugin-content-selector {
  width: 600px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    text-align: center;
  }

  &__tag-select {
    :deep(.q-field__control) {
      min-height: 36px;
    }
  }

  &__select-all {
    padding: 8px 0;
  }

  &__list {
    height: 300px;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 4px;
  }
}

.body--light .plugin-content-selector {
  --border-color: #e0e0e0;
}

.body--dark .plugin-content-selector {
  --border-color: #3c3c3c;
}
</style>
