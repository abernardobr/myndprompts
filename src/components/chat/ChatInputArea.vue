<script setup lang="ts">
/**
 * ChatInputArea Component
 *
 * Multi-line text input with send/stop/attach controls for the chat.
 * Enter sends the message, Shift+Enter inserts a newline.
 * Shows a stop button during streaming and a send button otherwise.
 * Displays a context bar showing attached files as chips.
 */

import { ref, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useChatStore } from '@/stores/chatStore';
import type { IContextFile } from '@/services/chat/types';

interface TabInfo {
  filePath: string;
  fileName: string;
}

const props = defineProps<{
  contextFiles: IContextFile[];
  availableTabs: TabInfo[];
}>();

const emit = defineEmits<{
  send: [text: string];
  stop: [];
  attachPdf: [];
  addContext: [filePath: string, fileName: string];
  removeContext: [filePath: string];
}>();
const { t } = useI18n({ useScope: 'global' });
const chatStore = useChatStore();

const inputText = ref('');
const inputRef = ref<{ focus: () => void } | null>(null);

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    send();
  }
}

function send(): void {
  const text = inputText.value.trim();
  if (!text || chatStore.isStreaming) return;

  emit('send', text);
  inputText.value = '';

  void nextTick(() => {
    inputRef.value?.focus();
  });
}

function stop(): void {
  emit('stop');
}

function attachPdf(): void {
  emit('attachPdf');
}

function addContextFile(tab: TabInfo): void {
  emit('addContext', tab.filePath, tab.fileName);
}

function removeContextFile(filePath: string): void {
  emit('removeContext', filePath);
}
</script>

<template>
  <div class="chat-input-area">
    <!-- Context bar -->
    <div
      v-if="props.contextFiles.length > 0 || props.availableTabs.length > 0"
      class="chat-input-area__context"
    >
      <q-icon
        name="attach_file"
        size="14px"
        class="chat-input-area__context-icon"
      />
      <div class="chat-input-area__context-chips">
        <q-chip
          v-for="file in props.contextFiles"
          :key="file.filePath"
          dense
          removable
          size="sm"
          icon="description"
          class="chat-input-area__context-chip"
          @remove="removeContextFile(file.filePath)"
        >
          {{ file.fileName }}
        </q-chip>
      </div>
      <q-btn
        v-if="props.availableTabs.length > 0"
        flat
        round
        dense
        size="xs"
        icon="add"
        class="chat-input-area__context-add"
        :title="t('chat.addFileContext')"
      >
        <q-menu auto-close>
          <q-list
            dense
            style="min-width: 200px; max-height: 240px; overflow-y: auto"
          >
            <q-item
              v-for="tab in props.availableTabs"
              :key="tab.filePath"
              clickable
              @click="addContextFile(tab)"
            >
              <q-item-section side>
                <q-icon
                  name="description"
                  size="16px"
                />
              </q-item-section>
              <q-item-section>{{ tab.fileName }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </div>

    <!-- Input row -->
    <div class="chat-input-area__row">
      <q-btn
        flat
        round
        dense
        icon="picture_as_pdf"
        class="chat-input-area__attach-btn"
        :title="t('chat.attachPdf')"
        @click="attachPdf"
      />

      <q-input
        ref="inputRef"
        v-model="inputText"
        type="textarea"
        autogrow
        outlined
        dense
        :placeholder="t('chat.inputPlaceholder')"
        class="chat-input-area__input"
        :maxlength="32000"
        @keydown="onKeydown"
      />

      <q-btn
        v-if="chatStore.isStreaming"
        round
        dense
        color="negative"
        icon="stop"
        class="chat-input-area__stop-btn"
        :title="t('chat.stop')"
        @click="stop"
      />
      <q-btn
        v-else
        round
        dense
        color="primary"
        icon="send"
        class="chat-input-area__send-btn"
        :disable="!inputText.trim()"
        :title="t('chat.send')"
        @click="send"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.chat-input-area {
  flex-shrink: 0;
  padding: 10px 16px 14px;
  border-top: 1px solid var(--border-color, #3c3c3c);

  &__context {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 6px;
    min-height: 28px;
    overflow-x: auto;
    scrollbar-width: thin;
  }

  &__context-icon {
    color: var(--context-icon-color, #888888);
    flex-shrink: 0;
  }

  &__context-chips {
    display: flex;
    gap: 4px;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: thin;
  }

  &__context-chip {
    max-width: 160px;

    :deep(.q-chip__content) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &__context-add {
    color: var(--context-add-color, #888888);
    flex-shrink: 0;
  }

  &__row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }

  &__input {
    flex: 1;

    :deep(.q-field__control) {
      border-radius: 12px;
    }

    :deep(textarea) {
      max-height: 120px;
      font-size: 14px;
      line-height: 1.5;
    }
  }

  &__attach-btn {
    color: var(--icon-color, #888888);
    flex-shrink: 0;
  }

  &__send-btn,
  &__stop-btn {
    flex-shrink: 0;
  }
}

.body--light .chat-input-area {
  --border-color: #d4d4d4;
  --icon-color: #666666;
  --context-icon-color: #666666;
  --context-add-color: #666666;
}

.body--dark .chat-input-area {
  --border-color: #3c3c3c;
  --icon-color: #888888;
  --context-icon-color: #888888;
  --context-add-color: #888888;
}
</style>
