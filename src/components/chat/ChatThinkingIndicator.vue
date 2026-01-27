<script setup lang="ts">
/**
 * ChatThinkingIndicator Component
 *
 * Collapsible section showing the model's thinking/reasoning process.
 * Displays an animated "Thinking..." indicator while active, and the
 * full thinking text (monospace) when complete.
 */

import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

defineProps<{
  text: string;
  isActive: boolean;
}>();

const { t } = useI18n({ useScope: 'global' });

const expanded = ref(false);
</script>

<template>
  <div class="chat-thinking">
    <button
      class="chat-thinking__toggle"
      @click="expanded = !expanded"
    >
      <q-icon
        :name="expanded ? 'expand_less' : 'expand_more'"
        size="16px"
      />
      <span
        v-if="isActive"
        class="chat-thinking__label chat-thinking__label--active"
      >
        <q-spinner-dots
          size="14px"
          color="grey-6"
        />
        {{ t('chat.thinking') }}
      </span>
      <span
        v-else
        class="chat-thinking__label"
      >
        {{ t('chat.showThinking') }}
      </span>
    </button>

    <div
      v-if="expanded"
      class="chat-thinking__content"
    >
      <pre class="chat-thinking__text">{{ text }}</pre>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.chat-thinking {
  margin-bottom: 8px;
  border-radius: 6px;
  background-color: var(--thinking-bg, rgba(255, 255, 255, 0.04));

  &__toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--toggle-color, #888888);
    font-size: 12px;
    width: 100%;
    text-align: left;

    &:hover {
      color: var(--toggle-hover, #bbbbbb);
    }
  }

  &__label {
    font-style: italic;

    &--active {
      display: flex;
      align-items: center;
      gap: 6px;
    }
  }

  &__content {
    padding: 8px 12px;
    border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
    max-height: 300px;
    overflow-y: auto;
  }

  &__text {
    font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-color, #999999);
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
  }
}

.body--light .chat-thinking {
  --thinking-bg: rgba(0, 0, 0, 0.03);
  --toggle-color: #777777;
  --toggle-hover: #444444;
  --border-color: rgba(0, 0, 0, 0.08);
  --text-color: #666666;
}

.body--dark .chat-thinking {
  --thinking-bg: rgba(255, 255, 255, 0.04);
  --toggle-color: #888888;
  --toggle-hover: #bbbbbb;
  --border-color: rgba(255, 255, 255, 0.08);
  --text-color: #999999;
}
</style>
