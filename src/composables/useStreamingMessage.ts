/**
 * Streaming Message Composable
 *
 * Provides presentation-ready reactive state for displaying a streaming
 * chat message. Batches rapid token updates into ~60fps animation frames
 * to prevent jittery rendering, manages cursor visibility, and exposes
 * a scroll trigger for auto-scrolling the message list.
 */

import { ref, computed, watch, onUnmounted } from 'vue';
import { useChatStore } from '@/stores/chatStore';

export function useStreamingMessage() {
  const chatStore = useChatStore();

  // Presentation state
  const displayText = ref('');
  const displayThinking = ref('');
  const showCursor = ref(false);
  const isThinking = ref(false);
  const scrollTrigger = ref(0); // Increment to trigger scroll

  // Batching for smooth rendering (~60fps)
  let pendingTokens = '';
  let animationFrameId: number | null = null;

  function flushTokens(): void {
    if (pendingTokens) {
      displayText.value += pendingTokens;
      pendingTokens = '';
      scrollTrigger.value++;
    }
    animationFrameId = null;
  }

  // Watch store streaming state
  watch(
    () => chatStore.streamingText,
    (newText) => {
      if (chatStore.isStreaming) {
        // Calculate delta
        const delta = newText.slice(displayText.value.length);
        if (delta) {
          pendingTokens += delta;
          if (animationFrameId === null) {
            animationFrameId = requestAnimationFrame(flushTokens);
          }
        }
      }
    }
  );

  watch(
    () => chatStore.thinkingText,
    (newText) => {
      displayThinking.value = newText;
      isThinking.value = !!newText && chatStore.isStreaming;
      scrollTrigger.value++;
    }
  );

  watch(
    () => chatStore.isStreaming,
    (streaming) => {
      showCursor.value = streaming;
      if (!streaming) {
        // Flush any remaining tokens
        if (pendingTokens) flushTokens();
        // Show final text from store
        displayText.value = chatStore.streamingText;
        isThinking.value = false;
      } else {
        // Reset for new stream
        displayText.value = '';
        displayThinking.value = '';
      }
    }
  );

  onUnmounted(() => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
  });

  return {
    displayText: computed(() => displayText.value),
    displayThinking: computed(() => displayThinking.value),
    showCursor: computed(() => showCursor.value),
    isThinking: computed(() => isThinking.value),
    isStreaming: computed(() => chatStore.isStreaming),
    scrollTrigger: computed(() => scrollTrigger.value),
  };
}
