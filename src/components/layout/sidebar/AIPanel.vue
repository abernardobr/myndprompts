<script setup lang="ts">
/**
 * AIPanel Component
 *
 * AI Assistant sidebar for quick interactions.
 * This is a placeholder that will be implemented in Task 12.
 */

import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t: _t } = useI18n({ useScope: 'global' });

const chatInput = ref('');
const chatHistory = ref<{ role: 'user' | 'assistant'; content: string }[]>([]);

function sendMessage(): void {
  if (!chatInput.value.trim()) return;

  chatHistory.value.push({
    role: 'user',
    content: chatInput.value,
  });

  // Placeholder response
  chatHistory.value.push({
    role: 'assistant',
    content: 'AI integration will be implemented in Task 12.',
  });

  chatInput.value = '';
}
</script>

<template>
  <div class="ai-panel">
    <div class="ai-panel__messages">
      <div
        v-if="chatHistory.length === 0"
        class="ai-panel__empty"
      >
        <q-icon
          name="smart_toy"
          size="48px"
          class="text-grey-6 q-mb-md"
        />
        <h6 class="text-grey-5 q-mb-sm">AI Assistant</h6>
        <p class="text-grey-6 text-caption">
          Chat with AI to get help with your prompts and snippets.
        </p>
        <p class="text-grey-7 text-caption q-mt-sm">
          Full AI integration will be available in Task 12.
        </p>
      </div>

      <div
        v-for="(msg, index) in chatHistory"
        :key="index"
        :class="['ai-panel__message', `ai-panel__message--${msg.role}`]"
      >
        <q-icon
          :name="msg.role === 'user' ? 'person' : 'smart_toy'"
          size="20px"
          class="ai-panel__avatar"
        />
        <div class="ai-panel__content">
          {{ msg.content }}
        </div>
      </div>
    </div>

    <div class="ai-panel__input-area">
      <q-input
        v-model="chatInput"
        dense
        outlined
        placeholder="Ask AI..."
        class="ai-panel__input"
        @keyup.enter="sendMessage"
      >
        <template #append>
          <q-btn
            flat
            dense
            round
            icon="send"
            size="sm"
            :disable="!chatInput.trim()"
            @click="sendMessage"
          />
        </template>
      </q-input>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ai-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;

  &__messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;

    h6 {
      font-size: 14px;
      font-weight: 500;
      margin: 0;
    }

    p {
      margin: 0;
      max-width: 200px;
    }
  }

  &__message {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
    padding: 8px;
    border-radius: 8px;

    &--user {
      background-color: var(--user-msg-bg, #2d2d2d);
    }

    &--assistant {
      background-color: var(--assistant-msg-bg, #1e1e1e);
    }
  }

  &__avatar {
    flex-shrink: 0;
    color: var(--avatar-color, #858585);
  }

  &__content {
    font-size: 13px;
    line-height: 1.5;
    color: var(--message-text, #cccccc);
  }

  &__input-area {
    padding: 12px;
    border-top: 1px solid var(--border-color, #3c3c3c);
  }

  &__input {
    :deep(.q-field__control) {
      background-color: var(--input-bg, #3c3c3c);
    }

    :deep(.q-field__native) {
      color: var(--input-text, #cccccc);
      font-size: 13px;
    }
  }
}

// Light theme
.body--light .ai-panel {
  --user-msg-bg: #e8e8e8;
  --assistant-msg-bg: #f3f3f3;
  --avatar-color: #6f6f6f;
  --message-text: #3b3b3b;
  --border-color: #e7e7e7;
  --input-bg: #ffffff;
  --input-text: #3b3b3b;
}

// Dark theme
.body--dark .ai-panel {
  --user-msg-bg: #2d2d2d;
  --assistant-msg-bg: #1e1e1e;
  --avatar-color: #858585;
  --message-text: #cccccc;
  --border-color: #3c3c3c;
  --input-bg: #3c3c3c;
  --input-text: #cccccc;
}
</style>
