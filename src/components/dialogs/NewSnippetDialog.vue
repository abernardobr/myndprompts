<script setup lang="ts">
/**
 * NewSnippetDialog Component
 *
 * Dialog for creating a new snippet with name, type, and description.
 * Generates the appropriate shortcut prefix based on the selected type.
 */

import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ISnippetMetadata } from '@/services/file-system/types';

interface Props {
  modelValue: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'create', data: { name: string; type: ISnippetMetadata['type']; description: string }): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n({ useScope: 'global' });

// Form state
const snippetName = ref('');
const snippetType = ref<ISnippetMetadata['type']>('text');
const snippetDescription = ref('');

// Type options with trigger characters
const typeOptions = computed(() => [
  {
    value: 'persona',
    label: t('dialogs.newSnippet.persona'),
    trigger: '@',
    description: t('dialogs.newSnippet.personaDesc'),
  },
  {
    value: 'text',
    label: t('dialogs.newSnippet.textSnippet'),
    trigger: '#',
    description: t('dialogs.newSnippet.textSnippetDesc'),
  },
  {
    value: 'code',
    label: t('dialogs.newSnippet.codeSnippet'),
    trigger: '$',
    description: t('dialogs.newSnippet.codeSnippetDesc'),
  },
  {
    value: 'template',
    label: t('dialogs.newSnippet.template'),
    trigger: '!',
    description: t('dialogs.newSnippet.templateDesc'),
  },
]);

// Get current trigger character
const currentTrigger = computed(() => {
  const option = typeOptions.value.find((o) => o.value === snippetType.value);
  return option?.trigger ?? '@';
});

// Preview shortcut
const previewShortcut = computed(() => {
  if (!snippetName.value.trim()) return `${currentTrigger.value}...`;
  const normalized = snippetName.value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  return `${currentTrigger.value}${normalized}`;
});

// Validation
const isValid = computed(() => {
  return snippetName.value.trim().length >= 1 && snippetName.value.trim().length <= 50;
});

// Reset form when dialog opens
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      snippetName.value = '';
      snippetType.value = 'text';
      snippetDescription.value = '';
    }
  }
);

function handleClose(): void {
  emit('update:modelValue', false);
}

function handleCreate(): void {
  if (!isValid.value) return;

  emit('create', {
    name: snippetName.value.trim(),
    type: snippetType.value,
    description: snippetDescription.value.trim(),
  });

  emit('update:modelValue', false);
}
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card class="new-snippet-dialog">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">{{ t('dialogs.newSnippet.title') }}</div>
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
        <!-- Snippet Type -->
        <div class="q-mb-md">
          <div class="text-caption text-grey q-mb-xs">{{ t('dialogs.newSnippet.type') }}</div>
          <q-btn-toggle
            v-model="snippetType"
            spread
            no-caps
            rounded
            unelevated
            toggle-color="primary"
            color="grey-8"
            text-color="white"
            :options="typeOptions.map((o) => ({ value: o.value, label: o.label }))"
          />
          <div class="text-caption text-grey-6 q-mt-xs">
            {{ typeOptions.find((o) => o.value === snippetType)?.description }}
          </div>
        </div>

        <!-- Snippet Name -->
        <q-input
          v-model="snippetName"
          :label="t('dialogs.newSnippet.name')"
          :placeholder="t('dialogs.newSnippet.namePlaceholder')"
          outlined
          autofocus
          :rules="[
            (val) => !!val?.trim() || t('validation.required'),
            (val) => val.trim().length <= 50 || t('validation.maxLength', { max: 50 }),
          ]"
          class="q-mb-md"
        >
          <template #hint>
            <div class="row items-center">
              <span>Shortcut: </span>
              <code class="q-ml-xs">{{ previewShortcut }}</code>
            </div>
          </template>
        </q-input>

        <!-- Description (optional) -->
        <q-input
          v-model="snippetDescription"
          :label="t('dialogs.newSnippet.description')"
          :placeholder="t('dialogs.newSnippet.descriptionPlaceholder')"
          outlined
          type="textarea"
          rows="2"
          maxlength="200"
        />
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
          :label="t('common.create')"
          color="primary"
          :disable="!isValid"
          @click="handleCreate"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style lang="scss" scoped>
.new-snippet-dialog {
  min-width: 400px;
  max-width: 500px;
  width: 100%;
}

code {
  font-family: 'Fira Code', 'Consolas', monospace;
  background-color: var(--code-bg, #3c3c3c);
  padding: 2px 6px;
  border-radius: 3px;
  color: var(--code-color, #9cdcfe);
}

// Light theme
.body--light {
  code {
    --code-bg: #e8e8e8;
    --code-color: #0550ae;
  }
}

// Dark theme
.body--dark {
  code {
    --code-bg: #3c3c3c;
    --code-color: #9cdcfe;
  }
}
</style>
