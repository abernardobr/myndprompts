<script setup lang="ts">
/**
 * ChatMessageItem Component
 *
 * Renders a single chat message bubble. User messages are right-aligned
 * with primary color background. Assistant messages are left-aligned,
 * rendered through ChatArtifactRenderer. Shows a thinking toggle if
 * thinkingContent exists, token usage, and a copy button.
 */

import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import type { IChatMessage } from '@/services/storage/entities';
import ChatArtifactRenderer from './ChatArtifactRenderer.vue';
import ChatStreamingText from './ChatStreamingText.vue';
import ChatThinkingIndicator from './ChatThinkingIndicator.vue';

const props = withDefaults(
  defineProps<{
    message: IChatMessage;
    isStreaming?: boolean;
  }>(),
  {
    isStreaming: false,
  }
);
const { t } = useI18n({ useScope: 'global' });
const $q = useQuasar();

const _showThinking = ref(false);

function formatTimestamp(date: Date): string {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function copyContent(): void {
  void navigator.clipboard.writeText(props.message.content).then(() => {
    $q.notify({ type: 'positive', message: t('chat.copied'), timeout: 1500 });
  });
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
</script>

<template>
  <div :class="['chat-message-item', `chat-message-item--${message.role}`]">
    <!-- Header: role + timestamp -->
    <div class="chat-message-item__header">
      <span class="chat-message-item__role">
        {{ message.role === 'user' ? t('chat.you') : t('chat.assistant') }}
      </span>
      <span class="chat-message-item__time">
        {{ formatTimestamp(message.createdAt) }}
      </span>
    </div>

    <!-- Thinking indicator -->
    <ChatThinkingIndicator
      v-if="message.thinkingContent"
      :text="message.thinkingContent"
      :is-active="false"
    />

    <!-- Content -->
    <div class="chat-message-item__content">
      <!-- Streaming: use streaming text component -->
      <ChatStreamingText v-if="isStreaming" />

      <!-- User messages: plain text -->
      <div
        v-else-if="message.role === 'user'"
        class="chat-message-item__text"
      >
        {{ message.content }}
      </div>

      <!-- Assistant messages: rendered through artifact renderer -->
      <ChatArtifactRenderer
        v-else
        :content="message.content"
      />
    </div>

    <!-- Footer: token usage + copy -->
    <div
      v-if="!isStreaming"
      class="chat-message-item__footer"
    >
      <span
        v-if="message.tokenUsage"
        class="chat-message-item__tokens"
      >
        {{ formatTokens(message.tokenUsage.totalTokens) }} tokens
      </span>
      <q-btn
        flat
        round
        dense
        size="xs"
        icon="content_copy"
        class="chat-message-item__copy-btn"
        :title="t('chat.copy')"
        @click="copyContent"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.chat-message-item {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  position: relative;

  &--user {
    align-self: flex-end;
    background-color: var(--user-bg, #1976d2);
    color: var(--user-text, #ffffff);
    border-bottom-right-radius: 4px;
  }

  &--assistant {
    align-self: flex-start;
    background-color: var(--assistant-bg, #2d2d2d);
    color: var(--assistant-text, #e0e0e0);
    border-bottom-left-radius: 4px;
  }

  &--system {
    align-self: center;
    background-color: var(--system-bg, #1a1a2e);
    color: var(--system-text, #aaaaaa);
    font-style: italic;
    font-size: 13px;
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  &__role {
    font-size: 12px;
    font-weight: 600;
    opacity: 0.7;
  }

  &__time {
    font-size: 11px;
    opacity: 0.5;
  }

  &__content {
    word-break: break-word;
  }

  &__text {
    white-space: pre-wrap;
  }

  &__footer {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
    justify-content: flex-end;
  }

  &__tokens {
    font-size: 11px;
    opacity: 0.5;
  }

  &__copy-btn {
    opacity: 0;
    transition: opacity 0.15s ease;
    color: inherit;
  }

  &:hover &__copy-btn {
    opacity: 0.6;
  }

  &__copy-btn:hover {
    opacity: 1 !important;
  }
}

.body--light .chat-message-item {
  --user-bg: #1976d2;
  --user-text: #ffffff;
  --assistant-bg: #f0f0f0;
  --assistant-text: #333333;
  --system-bg: #e8e8f0;
  --system-text: #666666;
}

.body--dark .chat-message-item {
  --user-bg: #1565c0;
  --user-text: #ffffff;
  --assistant-bg: #2d2d2d;
  --assistant-text: #e0e0e0;
  --system-bg: #1a1a2e;
  --system-text: #aaaaaa;
}
</style>
