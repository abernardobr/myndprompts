<script setup lang="ts">
/**
 * ChatToolbar Component
 *
 * Top bar for the chat area. Shows model selector dropdown, memory
 * strategy selector, inline-editable session title, new session
 * button, and sessions list toggle.
 */

import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useChatStore } from '@/stores/chatStore';
import { useAIProviderStore } from '@/stores/aiProviderStore';
import { AI_PROVIDER_META } from '@/constants/ai-providers';
import type { IConfiguredModel } from '@/services/storage/entities';

const emit = defineEmits<{
  toggleSessions: [];
  newSession: [];
}>();
const { t } = useI18n({ useScope: 'global' });
const chatStore = useChatStore();
const aiStore = useAIProviderStore();

// Inline title editing
const isEditingTitle = ref(false);
const editTitle = ref('');
const titleInputRef = ref<{ focus: () => void; select: () => void } | null>(null);

function startEditTitle(): void {
  editTitle.value = chatStore.activeSession?.title ?? '';
  isEditingTitle.value = true;
  setTimeout(() => {
    titleInputRef.value?.focus();
  }, 50);
}

async function saveTitle(): Promise<void> {
  isEditingTitle.value = false;
  const trimmed = editTitle.value.trim();
  if (!trimmed || !chatStore.activeSessionId) return;
  if (trimmed !== chatStore.activeSession?.title) {
    await chatStore.updateSessionTitle(chatStore.activeSessionId, trimmed);
  }
}

function cancelEditTitle(): void {
  isEditingTitle.value = false;
}

// Model switching
async function onSelectModel(model: IConfiguredModel): Promise<void> {
  await chatStore.switchModel(model.provider, model.modelId);
}

// Current model display
function currentModelName(): string {
  const session = chatStore.activeSession;
  if (!session) return t('chat.toolbar.noModel');
  // Find configured model name
  const found = aiStore.configuredModels.find(
    (m) => m.provider === session.provider && m.modelId === session.modelId
  );
  return found?.modelName ?? session.modelId;
}

function currentProviderIcon(): string {
  const session = chatStore.activeSession;
  if (!session) return 'smart_toy';
  return AI_PROVIDER_META[session.provider]?.icon ?? 'smart_toy';
}
</script>

<template>
  <div class="chat-toolbar">
    <!-- Sessions toggle -->
    <q-btn
      flat
      round
      dense
      size="sm"
      icon="menu"
      class="chat-toolbar__menu-btn"
      :title="t('chat.toolbar.toggleSessions')"
      @click="emit('toggleSessions')"
    />

    <!-- Model selector -->
    <q-btn-dropdown
      flat
      dense
      no-caps
      class="chat-toolbar__model-btn"
      :title="t('chat.toolbar.switchModel')"
    >
      <template #label>
        <div class="chat-toolbar__model-label">
          <q-icon
            :name="currentProviderIcon()"
            size="16px"
          />
          <span>{{ currentModelName() }}</span>
        </div>
      </template>
      <q-list dense>
        <q-item
          v-for="model in aiStore.orderedModels"
          :key="model.id"
          v-close-popup
          clickable
          @click="onSelectModel(model)"
        >
          <q-item-section avatar>
            <q-icon
              :name="AI_PROVIDER_META[model.provider]?.icon ?? 'smart_toy'"
              size="18px"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ model.modelName }}</q-item-label>
            <q-item-label caption>{{ t(`ai.providers.${model.provider}`) }}</q-item-label>
          </q-item-section>
          <q-item-section
            v-if="model.isDefault"
            side
          >
            <q-badge
              color="primary"
              :label="t('chat.toolbar.default')"
            />
          </q-item-section>
        </q-item>
        <q-item v-if="aiStore.orderedModels.length === 0">
          <q-item-section>
            <q-item-label caption>{{ t('chat.toolbar.noModels') }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-btn-dropdown>

    <!-- Spacer -->
    <div class="chat-toolbar__spacer" />

    <!-- Session title (inline editable) -->
    <q-input
      v-if="isEditingTitle"
      ref="titleInputRef"
      v-model="editTitle"
      dense
      outlined
      class="chat-toolbar__title-input"
      @keydown.enter="saveTitle"
      @keydown.escape="cancelEditTitle"
      @blur="saveTitle"
    />
    <span
      v-else
      class="chat-toolbar__title"
      :title="t('chat.toolbar.editTitle')"
      @click="startEditTitle"
    >
      {{ chatStore.activeSession?.title ?? t('chat.toolbar.newChat') }}
    </span>

    <!-- New session -->
    <q-btn
      flat
      round
      dense
      size="sm"
      icon="add"
      class="chat-toolbar__new-btn"
      :title="t('chat.toolbar.newSession')"
      @click="emit('newSession')"
    />
  </div>
</template>

<style lang="scss" scoped>
.chat-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border-color, #3c3c3c);
  min-height: 44px;
  flex-shrink: 0;

  &__menu-btn {
    color: var(--icon-color, #888888);
  }

  &__model-btn {
    color: var(--text-color, #cccccc);
    font-size: 13px;

    :deep(.q-btn__content) {
      flex-wrap: nowrap;
    }
  }

  &__model-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }

  &__spacer {
    flex: 1;
  }

  &__title {
    font-size: 13px;
    font-weight: 500;
    color: var(--title-color, #cccccc);
    cursor: pointer;
    padding: 2px 8px;
    border-radius: 4px;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &:hover {
      background-color: var(--title-hover-bg, rgba(255, 255, 255, 0.06));
    }
  }

  &__title-input {
    max-width: 200px;

    :deep(.q-field__control) {
      min-height: 28px;
      height: 28px;
    }

    :deep(input) {
      font-size: 13px;
      padding: 0 6px;
    }
  }

  &__new-btn {
    color: var(--icon-color, #888888);
  }
}

.body--light .chat-toolbar {
  --border-color: #d4d4d4;
  --icon-color: #666666;
  --text-color: #333333;
  --title-color: #333333;
  --title-hover-bg: rgba(0, 0, 0, 0.04);
}

.body--dark .chat-toolbar {
  --border-color: #3c3c3c;
  --icon-color: #888888;
  --text-color: #cccccc;
  --title-color: #cccccc;
  --title-hover-bg: rgba(255, 255, 255, 0.06);
}
</style>
