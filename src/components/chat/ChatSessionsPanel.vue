<script setup lang="ts">
/**
 * ChatSessionsPanel Component
 *
 * Slide-out side panel listing all chat sessions. Supports search/filter,
 * session selection, context menu with settings/delete, and a settings
 * dialog for rename + memory configuration.
 */

import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { useChatStore } from '@/stores/chatStore';
import type { IChatSession } from '@/services/storage/entities';
import ChatMemorySelector from './ChatMemorySelector.vue';

const emit = defineEmits<{
  close: [];
  selectSession: [sessionId: string];
  newSession: [];
}>();

const { t } = useI18n({ useScope: 'global' });
const $q = useQuasar();
const chatStore = useChatStore();

const searchQuery = ref('');
const showConfigDialog = ref(false);
const configSession = ref<IChatSession | null>(null);
const dialogTitle = ref('');

const filteredSessions = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  const sessions = chatStore.sessions.filter((s) => !s.isArchived);
  if (!query) return sessions;
  return sessions.filter(
    (s) => s.title.toLowerCase().includes(query) || s.modelId.toLowerCase().includes(query)
  );
});

function selectSession(session: IChatSession): void {
  emit('selectSession', session.id);
}

function isActive(session: IChatSession): boolean {
  return session.id === chatStore.activeSessionId;
}

function formatDate(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return t('chat.sessions.yesterday');
  if (diffDays < 7) return `${String(diffDays)}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function confirmDelete(session: IChatSession): void {
  $q.dialog({
    title: t('chat.sessions.deleteSession'),
    message: t('chat.sessions.deleteConfirm'),
    cancel: {
      label: t('common.cancel'),
      flat: true,
    },
    ok: {
      label: t('common.delete'),
      color: 'negative',
    },
    persistent: false,
  }).onOk(() => {
    void chatStore.deleteSession(session.id);
  });
}

function sessionTitle(session: IChatSession): string {
  return session.title || t('chat.sessions.untitled');
}

async function openSessionConfig(session: IChatSession): Promise<void> {
  // Activate the session so ChatMemorySelector reads its config,
  // but don't emit selectSession (which closes the panel)
  await chatStore.loadSession(session.id);
  configSession.value = session;
  dialogTitle.value = session.title || '';
  showConfigDialog.value = true;
}

async function saveDialogTitle(): Promise<void> {
  if (!configSession.value) return;
  const trimmed = dialogTitle.value.trim();
  if (trimmed && trimmed !== configSession.value.title) {
    await chatStore.updateSessionTitle(configSession.value.id, trimmed);
  }
}
</script>

<template>
  <div class="chat-sessions-panel">
    <!-- Header -->
    <div class="chat-sessions-panel__header">
      <span class="chat-sessions-panel__title">{{ t('chat.sessions.title') }}</span>
      <q-btn
        flat
        round
        dense
        size="sm"
        icon="close"
        class="chat-sessions-panel__close-btn"
        @click="emit('close')"
      />
    </div>

    <!-- Session settings dialog -->
    <q-dialog
      v-model="showConfigDialog"
      @hide="saveDialogTitle"
    >
      <q-card class="chat-sessions-panel__config-dialog">
        <q-card-section class="chat-sessions-panel__config-dialog-header">
          <span class="chat-sessions-panel__config-dialog-title">{{
            t('chat.sessions.chatConfig')
          }}</span>
          <q-btn
            flat
            round
            dense
            size="sm"
            icon="close"
            @click="showConfigDialog = false"
          />
        </q-card-section>
        <q-card-section class="chat-sessions-panel__config-dialog-body">
          <q-input
            v-model="dialogTitle"
            dense
            outlined
            :label="t('chat.sessions.sessionName')"
            class="q-mb-md"
          />
          <ChatMemorySelector />
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Search -->
    <div class="chat-sessions-panel__search">
      <q-input
        v-model="searchQuery"
        dense
        outlined
        clearable
        :placeholder="t('chat.sessions.search')"
        class="chat-sessions-panel__search-input"
      >
        <template #prepend>
          <q-icon
            name="search"
            size="18px"
          />
        </template>
      </q-input>
    </div>

    <!-- New session button -->
    <div class="chat-sessions-panel__new">
      <q-btn
        flat
        dense
        no-caps
        icon="add"
        :label="t('chat.sessions.newSession')"
        class="chat-sessions-panel__new-btn"
        @click="emit('newSession')"
      />
    </div>

    <!-- Sessions list -->
    <div class="chat-sessions-panel__list">
      <div
        v-if="filteredSessions.length === 0"
        class="chat-sessions-panel__empty"
      >
        <q-icon
          name="chat_bubble_outline"
          size="32px"
          class="chat-sessions-panel__empty-icon"
        />
        <span>{{
          searchQuery ? t('chat.sessions.noResults') : t('chat.sessions.noSessions')
        }}</span>
        <span
          v-if="!searchQuery"
          class="chat-sessions-panel__empty-hint"
        >
          {{ t('chat.sessions.noSessionsHint') }}
        </span>
      </div>

      <div
        v-for="session in filteredSessions"
        :key="session.id"
        :class="[
          'chat-sessions-panel__item',
          { 'chat-sessions-panel__item--active': isActive(session) },
        ]"
        @click="selectSession(session)"
      >
        <div class="chat-sessions-panel__item-content">
          <div class="chat-sessions-panel__item-title">
            {{ sessionTitle(session) }}
          </div>
          <div class="chat-sessions-panel__item-meta">
            <span>{{ session.modelId }}</span>
            <span class="chat-sessions-panel__item-sep">&middot;</span>
            <span>{{ formatDate(session.updatedAt) }}</span>
            <span
              v-if="session.messageCount > 0"
              class="chat-sessions-panel__item-sep"
              >&middot;</span
            >
            <span v-if="session.messageCount > 0">{{ session.messageCount }} msgs</span>
          </div>
        </div>

        <!-- Context menu button -->
        <q-btn
          flat
          round
          dense
          size="xs"
          icon="more_vert"
          class="chat-sessions-panel__item-menu-btn"
          @click.stop
        >
          <q-menu auto-close>
            <q-list
              dense
              style="min-width: 160px"
            >
              <q-item
                clickable
                @click="openSessionConfig(session)"
              >
                <q-item-section side>
                  <q-icon
                    name="settings"
                    size="18px"
                  />
                </q-item-section>
                <q-item-section>{{ t('chat.sessions.chatConfig') }}</q-item-section>
              </q-item>
              <q-separator />
              <q-item
                clickable
                class="text-negative"
                @click="confirmDelete(session)"
              >
                <q-item-section side>
                  <q-icon
                    name="delete_outline"
                    size="18px"
                    color="negative"
                  />
                </q-item-section>
                <q-item-section>{{ t('chat.sessions.deleteSession') }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.chat-sessions-panel {
  display: flex;
  flex-direction: column;
  width: 280px;
  min-width: 240px;
  max-width: 320px;
  height: 100%;
  border-right: 1px solid var(--border-color, #3c3c3c);
  background-color: var(--panel-bg, #1a1a1a);
  flex-shrink: 0;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-color, #3c3c3c);
    flex-shrink: 0;
  }

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: var(--title-color, #cccccc);
  }

  &__close-btn {
    color: var(--icon-color, #888888);
  }

  &__search {
    padding: 8px 12px 0;
    flex-shrink: 0;
  }

  &__search-input {
    :deep(.q-field__control) {
      min-height: 32px;
      height: 32px;
    }

    :deep(input) {
      font-size: 13px;
    }
  }

  &__new {
    padding: 8px 12px;
    flex-shrink: 0;
  }

  &__new-btn {
    width: 100%;
    color: var(--accent-color, #42a5f5);
    font-size: 13px;
    justify-content: flex-start;
  }

  &__list {
    flex: 1;
    overflow-y: auto;
    padding: 0 8px 8px;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 32px 16px;
    text-align: center;
    font-size: 13px;
    color: var(--empty-color, #888888);
  }

  &__empty-icon {
    opacity: 0.4;
  }

  &__empty-hint {
    font-size: 12px;
    opacity: 0.6;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.15s ease;

    &:hover {
      background-color: var(--item-hover-bg, rgba(255, 255, 255, 0.06));
    }

    &--active {
      background-color: var(--item-active-bg, rgba(255, 255, 255, 0.1));
    }
  }

  &__item-content {
    flex: 1;
    min-width: 0;
  }

  &__item-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--item-title-color, #cccccc);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__item-meta {
    font-size: 11px;
    color: var(--item-meta-color, #888888);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
  }

  &__item-sep {
    margin: 0 3px;
  }

  &__item-menu-btn {
    opacity: 0;
    transition: opacity 0.15s ease;
    flex-shrink: 0;
    color: var(--icon-color, #888888);
  }

  &__item:hover &__item-menu-btn {
    opacity: 1;
  }

  &__config-dialog {
    min-width: 360px;
    max-width: 420px;
  }

  &__config-dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 0;
  }

  &__config-dialog-title {
    font-size: 15px;
    font-weight: 600;
  }

  &__config-dialog-body {
    padding-top: 16px;
  }
}

.body--light .chat-sessions-panel {
  --border-color: #d4d4d4;
  --panel-bg: #f5f5f5;
  --title-color: #333333;
  --icon-color: #666666;
  --accent-color: #1976d2;
  --empty-color: #666666;
  --item-hover-bg: rgba(0, 0, 0, 0.04);
  --item-active-bg: rgba(0, 0, 0, 0.08);
  --item-title-color: #333333;
  --item-meta-color: #777777;
}

.body--dark .chat-sessions-panel {
  --border-color: #3c3c3c;
  --panel-bg: #1a1a1a;
  --title-color: #cccccc;
  --icon-color: #888888;
  --accent-color: #42a5f5;
  --empty-color: #888888;
  --item-hover-bg: rgba(255, 255, 255, 0.06);
  --item-active-bg: rgba(255, 255, 255, 0.1);
  --item-title-color: #cccccc;
  --item-meta-color: #888888;
}
</style>
