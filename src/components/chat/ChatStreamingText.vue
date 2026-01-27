<script setup lang="ts">
/**
 * ChatStreamingText Component
 *
 * Renders the currently streaming message text progressively as markdown.
 * Uses the useStreamingMessage composable for batched display updates
 * and shows a blinking cursor while streaming is active.
 * When waiting for the first token, displays a spinner with rotating
 * status messages to give visual feedback.
 */

import { ref, computed, watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStreamingMessage } from '@/composables/useStreamingMessage';
import { marked } from 'marked';

const { t } = useI18n({ useScope: 'global' });
const streaming = useStreamingMessage();

marked.setOptions({
  breaks: true,
  gfm: true,
});

const renderedHtml = computed(() => {
  const text = streaming.displayText.value;
  if (!text) return '';
  return marked.parse(text) as string;
});

// Waiting state: streaming active but no text yet
const isWaiting = computed(() => streaming.isStreaming.value && !streaming.displayText.value);

// Rotating status messages
const waitingMessages = computed(() => [
  t('chat.waiting.connecting'),
  t('chat.waiting.thinking'),
  t('chat.waiting.analyzing'),
  t('chat.waiting.preparing'),
  t('chat.waiting.processing'),
  t('chat.waiting.almostReady'),
]);

const currentMessageIndex = ref(0);
let rotateInterval: ReturnType<typeof setInterval> | null = null;

const currentWaitingMessage = computed(
  () => waitingMessages.value[currentMessageIndex.value] ?? ''
);

watch(
  isWaiting,
  (waiting) => {
    if (waiting) {
      currentMessageIndex.value = 0;
      rotateInterval = setInterval(() => {
        currentMessageIndex.value = (currentMessageIndex.value + 1) % waitingMessages.value.length;
      }, 2500);
    } else {
      if (rotateInterval !== null) {
        clearInterval(rotateInterval);
        rotateInterval = null;
      }
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  if (rotateInterval !== null) {
    clearInterval(rotateInterval);
  }
});
</script>

<template>
  <div class="chat-streaming-text">
    <!-- Waiting indicator: spinner + rotating messages -->
    <div
      v-if="isWaiting"
      class="chat-streaming-text__waiting"
    >
      <div class="chat-streaming-text__spinner">
        <div class="chat-streaming-text__spinner-ring" />
      </div>
      <span class="chat-streaming-text__waiting-text">
        {{ currentWaitingMessage }}
      </span>
    </div>

    <!-- Streamed content -->
    <template v-else>
      <div
        class="chat-streaming-text__content"
        v-html="renderedHtml"
      />
      <span
        v-if="streaming.showCursor.value"
        class="chat-streaming-text__cursor"
      />
    </template>
  </div>
</template>

<style lang="scss" scoped>
@use '@/assets/markdown-body' as md;

.chat-streaming-text {
  line-height: 1.6;
  word-break: break-word;

  &__content {
    @include md.markdown-body-styles;
  }

  &__cursor {
    display: inline-block;
    width: 2px;
    height: 16px;
    background-color: currentColor;
    margin-left: 1px;
    vertical-align: text-bottom;
    animation: streaming-cursor-blink 1s steps(1) infinite;
  }

  // Waiting state
  &__waiting {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 0;
  }

  &__spinner {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  &__spinner-ring {
    width: 100%;
    height: 100%;
    border: 2px solid var(--spinner-track, rgba(255, 255, 255, 0.15));
    border-top-color: var(--spinner-color, #4fc3f7);
    border-radius: 50%;
    animation: spinner-rotate 0.8s linear infinite;
  }

  &__waiting-text {
    font-size: 13px;
    color: var(--waiting-text-color, #aaaaaa);
    animation: waiting-text-fade 2.5s ease-in-out infinite;
  }
}

@keyframes streaming-cursor-blink {
  0%,
  50% {
    opacity: 1;
  }
  51%,
  100% {
    opacity: 0;
  }
}

@keyframes spinner-rotate {
  to {
    transform: rotate(360deg);
  }
}

@keyframes waiting-text-fade {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

.body--light .chat-streaming-text {
  @include md.markdown-body-light-vars;
  --spinner-track: rgba(0, 0, 0, 0.1);
  --spinner-color: #1976d2;
  --waiting-text-color: #777777;
}

.body--dark .chat-streaming-text {
  @include md.markdown-body-dark-vars;
  --spinner-track: rgba(255, 255, 255, 0.15);
  --spinner-color: #4fc3f7;
  --waiting-text-color: #aaaaaa;
}
</style>
