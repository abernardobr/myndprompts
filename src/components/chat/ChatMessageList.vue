<script setup lang="ts">
/**
 * ChatMessageList Component
 *
 * Scrollable message list that renders messages from the active
 * chat session via ChatMessageItem. Uses q-scroll-area with
 * auto-scroll on new messages. Shows a streaming ChatMessageItem
 * at the bottom when the AI is responding.
 * Displays an empty state when no messages exist.
 */

import { ref, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useChatStore } from '@/stores/chatStore';
import { useStreamingMessage } from '@/composables/useStreamingMessage';
import type { IChatMessage } from '@/services/storage/entities';
import ChatMessageItem from './ChatMessageItem.vue';

const { t } = useI18n({ useScope: 'global' });
const chatStore = useChatStore();
const streaming = useStreamingMessage();

const scrollAreaRef = ref<{
  setScrollPosition: (axis: string, offset: number, duration?: number) => void;
  getScroll: () => { verticalSize: number };
} | null>(null);

// Placeholder message object for the streaming assistant response
const streamingPlaceholder: IChatMessage = {
  id: '__streaming__',
  sessionId: '',
  role: 'assistant',
  content: '',
  branchIndex: 0,
  createdAt: new Date(),
};

function scrollToBottom(): void {
  if (scrollAreaRef.value) {
    const scroll = scrollAreaRef.value.getScroll();
    scrollAreaRef.value.setScrollPosition('vertical', scroll.verticalSize, 200);
  }
}

// Auto-scroll when new messages arrive
watch(
  () => chatStore.activeMainThread.length,
  async () => {
    await nextTick();
    scrollToBottom();
  }
);

// Auto-scroll during streaming
watch(
  () => streaming.scrollTrigger.value,
  async () => {
    await nextTick();
    scrollToBottom();
  }
);
</script>

<template>
  <q-scroll-area
    ref="scrollAreaRef"
    class="chat-message-list"
  >
    <!-- Empty state -->
    <div
      v-if="
        chatStore.activeMainThread.length === 0 && !chatStore.isStreaming && !chatStore.streamError
      "
      class="chat-message-list__empty"
    >
      <q-icon
        name="chat_bubble_outline"
        size="48px"
        class="chat-message-list__empty-icon"
      />
      <p class="chat-message-list__empty-text">
        {{ t('chat.emptyState') }}
      </p>
    </div>

    <!-- Messages -->
    <div
      v-else
      class="chat-message-list__messages"
    >
      <ChatMessageItem
        v-for="message in chatStore.activeMainThread"
        :key="message.id"
        :message="message"
      />

      <!-- Streaming message -->
      <ChatMessageItem
        v-if="chatStore.isStreaming"
        :message="streamingPlaceholder"
        is-streaming
      />

      <!-- Stream error -->
      <div
        v-if="chatStore.streamError"
        class="chat-message-list__error"
      >
        <q-icon
          name="error_outline"
          size="20px"
          color="negative"
        />
        <span>{{ chatStore.streamError }}</span>
      </div>
    </div>
  </q-scroll-area>
</template>

<style lang="scss" scoped>
.chat-message-list {
  flex: 1;
  min-height: 0;

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 32px;
    gap: 12px;
  }

  &__empty-icon {
    color: var(--empty-icon-color, #666666);
    opacity: 0.5;
  }

  &__empty-text {
    font-size: 14px;
    color: var(--empty-text-color, #888888);
  }

  &__messages {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }

  &__error {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 8px;
    background-color: var(--error-bg, rgba(244, 67, 54, 0.1));
    color: var(--error-text, #ef5350);
    font-size: 13px;
    line-height: 1.5;
    word-break: break-word;
  }
}

.body--light .chat-message-list {
  --empty-icon-color: #999999;
  --empty-text-color: #666666;
  --error-bg: rgba(244, 67, 54, 0.08);
  --error-text: #d32f2f;
}

.body--dark .chat-message-list {
  --empty-icon-color: #666666;
  --empty-text-color: #888888;
  --error-bg: rgba(244, 67, 54, 0.12);
  --error-text: #ef5350;
}
</style>
