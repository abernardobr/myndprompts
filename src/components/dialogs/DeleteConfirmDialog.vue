<script setup lang="ts">
/**
 * DeleteConfirmDialog Component
 *
 * Dialog for confirming deletion of items (prompts, snippets, directories, projects).
 * Shows additional warnings for non-empty directories.
 */

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

interface Props {
  modelValue: boolean;
  itemName: string;
  itemType: 'prompt' | 'snippet' | 'directory' | 'project';
  contentsCount?: { files: number; directories: number };
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirm'): void;
}

const props = withDefaults(defineProps<Props>(), {
  contentsCount: undefined,
});
const emit = defineEmits<Emits>();

const { t } = useI18n({ useScope: 'global' });

// Check if the item has contents
const hasContents = computed(() => {
  if (!props.contentsCount) return false;
  return props.contentsCount.files > 0 || props.contentsCount.directories > 0;
});

// Generate contents description
const contentsDescription = computed(() => {
  if (!props.contentsCount) return '';

  const parts: string[] = [];
  if (props.contentsCount.files > 0) {
    parts.push(`${props.contentsCount.files} file${props.contentsCount.files === 1 ? '' : 's'}`);
  }
  if (props.contentsCount.directories > 0) {
    parts.push(
      `${props.contentsCount.directories} ${props.contentsCount.directories === 1 ? 'subdirectory' : 'subdirectories'}`
    );
  }
  return parts.join(' and ');
});

// Title based on item type
const dialogTitle = computed(() => {
  switch (props.itemType) {
    case 'prompt':
      return t('dialogs.delete.deletePrompt');
    case 'snippet':
      return t('dialogs.delete.deleteSnippet');
    case 'directory':
      return t('dialogs.delete.deleteDirectory');
    case 'project':
      return t('dialogs.delete.deleteProject');
    default:
      return t('dialogs.delete.title');
  }
});

// Icon based on item type
const itemIcon = computed(() => {
  switch (props.itemType) {
    case 'prompt':
      return 'description';
    case 'snippet':
      return 'code';
    case 'directory':
      return 'folder';
    case 'project':
      return 'folder_special';
    default:
      return 'delete';
  }
});

function handleClose(): void {
  emit('update:modelValue', false);
}

function handleConfirm(): void {
  emit('confirm');
  emit('update:modelValue', false);
}
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card class="delete-confirm-dialog">
      <q-card-section class="row items-center q-pb-none">
        <q-icon
          name="warning"
          color="negative"
          size="24px"
          class="q-mr-sm"
        />
        <div class="text-h6">{{ dialogTitle }}</div>
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

      <q-card-section class="q-pt-lg">
        <div class="delete-confirm-dialog__item">
          <q-icon
            :name="itemIcon"
            size="20px"
            class="q-mr-sm"
          />
          <span class="text-weight-medium">{{ itemName }}</span>
        </div>

        <div class="text-body2 q-mt-md">
          {{ t('dialogs.delete.confirmMessage', { name: itemName }) }}
        </div>

        <!-- Warning for non-empty directories/projects -->
        <q-banner
          v-if="hasContents"
          class="bg-warning-1 text-warning q-mt-md"
          rounded
        >
          <template #avatar>
            <q-icon
              name="warning"
              color="warning"
            />
          </template>
          <div class="text-body2">
            This {{ itemType }} contains {{ contentsDescription }}.
            <strong>All contents will be permanently deleted.</strong>
          </div>
        </q-banner>

        <div class="text-caption text-grey q-mt-md">{{ t('dialogs.delete.cannotUndo') }}</div>
      </q-card-section>

      <q-card-actions
        align="right"
        class="q-px-md q-pb-md"
      >
        <q-btn
          flat
          :label="t('common.cancel')"
          color="grey"
          @click="handleClose"
        />
        <q-btn
          unelevated
          :label="t('common.delete')"
          color="negative"
          @click="handleConfirm"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style lang="scss" scoped>
.delete-confirm-dialog {
  min-width: 400px;
  max-width: 500px;

  &__item {
    display: flex;
    align-items: center;
    padding: 12px;
    background-color: var(--item-bg, rgba(0, 0, 0, 0.05));
    border-radius: 8px;
  }
}

.body--dark .delete-confirm-dialog {
  &__item {
    --item-bg: rgba(255, 255, 255, 0.05);
  }
}

.bg-warning-1 {
  background-color: rgba(255, 193, 7, 0.1) !important;
}
</style>
