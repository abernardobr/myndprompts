<script setup lang="ts">
/**
 * ChatContainer Component
 *
 * Root layout for the AI chat feature. Arranges ChatToolbar at top,
 * ChatMessageList in the center, and ChatInputArea at the bottom.
 * Optionally shows ChatPDFCanvas as a side panel and ChatSessionsPanel
 * as a left drawer for session management.
 */

import { ref, computed, onMounted, watch } from 'vue';
import { useChatStore } from '@/stores/chatStore';
import { useAIProviderStore } from '@/stores/aiProviderStore';
import { useUIStore } from '@/stores/uiStore';
import type { IContextFile } from '@/services/chat/types';
import ChatToolbar from './ChatToolbar.vue';
import ChatMessageList from './ChatMessageList.vue';
import ChatInputArea from './ChatInputArea.vue';
import ChatPDFCanvas from './ChatPDFCanvas.vue';
import ChatSessionsPanel from './ChatSessionsPanel.vue';

const chatStore = useChatStore();
const aiStore = useAIProviderStore();
const uiStore = useUIStore();

const activePdfPath = ref<string | null>(null);
const showPDF = computed(() => activePdfPath.value !== null);
const showSessions = ref(false);

// File context management
const contextFiles = ref<IContextFile[]>([]);

// Available tabs not yet in context
const availableTabs = computed(() =>
  uiStore.openTabs.filter((tab) => !contextFiles.value.some((cf) => cf.filePath === tab.filePath))
);

// Auto-attach active editor tab
watch(
  () => uiStore.activeTab,
  (tab) => {
    if (tab && !contextFiles.value.some((cf) => cf.filePath === tab.filePath)) {
      contextFiles.value = [{ filePath: tab.filePath, fileName: tab.fileName }];
    }
  },
  { immediate: true }
);

function onAddContext(filePath: string, fileName: string): void {
  if (!contextFiles.value.some((cf) => cf.filePath === filePath)) {
    contextFiles.value.push({ filePath, fileName });
  }
}

function onRemoveContext(filePath: string): void {
  contextFiles.value = contextFiles.value.filter((cf) => cf.filePath !== filePath);
}

onMounted(async () => {
  if (!chatStore.isInitialized) {
    await chatStore.initialize();
  }
  if (!aiStore.isInitialized) {
    await aiStore.initialize();
  }

  // Resume the most recent session or create a new one
  if (chatStore.activeSessionId !== null) {
    await chatStore.loadSession(chatStore.activeSessionId);
  } else {
    const defaultModel = aiStore.defaultModel;
    if (defaultModel) {
      await chatStore.createSession(
        defaultModel.provider,
        defaultModel.modelId,
        undefined,
        aiStore.chatDefaults.memoryStrategy,
        aiStore.getDefaultMemoryConfig()
      );
    }
  }
});

async function onSend(text: string): Promise<void> {
  const files = contextFiles.value.length > 0 ? [...contextFiles.value] : undefined;
  await chatStore.sendMessage(text, { contextFiles: files });
}

async function onStop(): Promise<void> {
  await chatStore.stopStreaming();
}

function onAttachPdf(): void {
  // TODO: open file dialog and set activePdfPath
}

function onClosePdf(): void {
  activePdfPath.value = null;
}

function onToggleSessions(): void {
  showSessions.value = !showSessions.value;
}

async function onNewSession(): Promise<void> {
  const defaultModel = aiStore.defaultModel;
  if (defaultModel) {
    await chatStore.createSession(
      defaultModel.provider,
      defaultModel.modelId,
      undefined,
      aiStore.chatDefaults.memoryStrategy,
      aiStore.getDefaultMemoryConfig()
    );
  }
}

async function onSelectSession(sessionId: string): Promise<void> {
  await chatStore.loadSession(sessionId);
  showSessions.value = false;
}
</script>

<template>
  <div class="chat-container">
    <ChatToolbar
      @toggle-sessions="onToggleSessions"
      @new-session="onNewSession"
    />

    <div class="chat-container__body">
      <!-- Sessions panel (left drawer) -->
      <ChatSessionsPanel
        v-if="showSessions"
        @close="showSessions = false"
        @select-session="onSelectSession"
        @new-session="onNewSession"
      />

      <!-- Main chat area -->
      <div class="chat-container__messages">
        <ChatMessageList />
        <ChatInputArea
          :context-files="contextFiles"
          :available-tabs="availableTabs"
          @send="onSend"
          @stop="onStop"
          @attach-pdf="onAttachPdf"
          @add-context="onAddContext"
          @remove-context="onRemoveContext"
        />
      </div>

      <!-- PDF side panel -->
      <ChatPDFCanvas
        v-if="showPDF"
        :file-path="activePdfPath!"
        @close="onClosePdf"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;

  &__body {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  &__messages {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
  }
}

.body--light .chat-container {
  --border-color: #d4d4d4;
}

.body--dark .chat-container {
  --border-color: #3c3c3c;
}
</style>
