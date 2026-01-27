/**
 * Chat Store
 *
 * Pinia store for managing AI chat sessions, messages, streaming state,
 * and PDF references. Coordinates between the UI, the IPC bridge
 * (chatAPI), and IndexedDB repositories.
 */

import { defineStore } from 'pinia';
import { ref, computed, toRaw } from 'vue';
import { getSessionsRepository } from '@/services/storage/repositories/chat-sessions.repository';
import { getMessagesRepository } from '@/services/storage/repositories/chat-messages.repository';
import { getMemorySnapshotsRepository } from '@/services/storage/repositories/memory-snapshots.repository';
import { getPDFDocumentsRepository } from '@/services/storage/repositories/pdf-documents.repository';
import { getPDFAnnotationsRepository } from '@/services/storage/repositories/pdf-annotations.repository';
import type {
  IChatSession,
  IChatMessage,
  IPDFDocument,
  AIProviderType,
} from '@/services/storage/entities';
import type {
  MemoryStrategy,
  IMemoryConfig,
  ITokenUsage,
  IChatMessageMetadata,
  IContextFile,
} from '@/services/chat/types';

export const useChatStore = defineStore('chat', () => {
  const sessionsRepo = getSessionsRepository();
  const messagesRepo = getMessagesRepository();
  const snapshotsRepo = getMemorySnapshotsRepository();
  const pdfDocsRepo = getPDFDocumentsRepository();
  const pdfAnnotationsRepo = getPDFAnnotationsRepository();

  // ================================
  // State
  // ================================

  const sessions = ref<IChatSession[]>([]);
  const activeSessionId = ref<string | null>(null);
  const messages = ref<Map<string, IChatMessage[]>>(new Map());
  const isStreaming = ref(false);
  const streamingMessageId = ref<string | null>(null);
  const streamingText = ref('');
  const thinkingText = ref('');
  const streamError = ref<string | null>(null);
  const isInitialized = ref(false);
  const isLoading = ref(false);
  const pdfDocuments = ref<Map<string, IPDFDocument[]>>(new Map());

  // Cleanup functions for IPC event listeners
  const cleanupFunctions: Array<() => void> = [];

  // ================================
  // Computed / Getters
  // ================================

  const activeSession = computed(() => sessions.value.find((s) => s.id === activeSessionId.value));

  const activeMessages = computed(() => {
    if (activeSessionId.value === null) return [];
    const msgs = messages.value.get(activeSessionId.value);
    if (msgs === undefined) return [];
    return [...msgs].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  });

  const activeMainThread = computed(() => activeMessages.value.filter((m) => m.branchIndex === 0));

  const activePDFs = computed(() => {
    if (activeSessionId.value === null) return [];
    return pdfDocuments.value.get(activeSessionId.value) ?? [];
  });

  const hasActiveStream = computed(() => isStreaming.value);

  const totalTokensUsed = computed(() =>
    sessions.value.reduce((sum, s) => sum + s.tokenUsage.totalTokens, 0)
  );

  // ================================
  // Internal: Streaming Event Handlers
  // ================================

  function _onStreamToken(data: { token: string; messageId: string }): void {
    if (!isStreaming.value) return;
    // Adopt the main-process messageId on first token
    if (streamingMessageId.value !== data.messageId) {
      streamingMessageId.value = data.messageId;
    }
    streamingText.value += data.token;
  }

  function _onStreamThinking(data: { text: string; messageId: string }): void {
    if (!isStreaming.value) return;
    if (streamingMessageId.value !== data.messageId) {
      streamingMessageId.value = data.messageId;
    }
    thinkingText.value += data.text;
  }

  async function _onStreamEnd(data: {
    messageId: string;
    fullText: string;
    thinkingText?: string;
    usage: ITokenUsage;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    const sessionId = activeSessionId.value;
    if (sessionId === null) return;

    // Save assistant message to repository
    const metadata = data.metadata as unknown as IChatMessageMetadata;
    await messagesRepo.addMessage(sessionId, 'assistant', data.fullText, {
      thinkingContent: data.thinkingText,
      tokenUsage: data.usage,
      metadata,
    });

    // Update session stats
    await sessionsRepo.incrementMessageCount(sessionId);
    await sessionsRepo.addTokenUsage(sessionId, data.usage);

    // Refresh session in state
    const updated = await sessionsRepo.getById(sessionId);
    if (updated !== undefined) {
      const idx = sessions.value.findIndex((s) => s.id === sessionId);
      if (idx !== -1) {
        sessions.value[idx] = updated;
      }
    }

    // Reload messages for this session
    const freshMessages = await messagesRepo.getBySession(sessionId);
    messages.value.set(sessionId, freshMessages);

    // Reset streaming state
    isStreaming.value = false;
    streamingMessageId.value = null;
    streamingText.value = '';
    thinkingText.value = '';
  }

  function _onStreamError(data: { messageId: string; error: string }): void {
    console.error(`[ChatStore] Stream error for message ${data.messageId}:`, data.error);
    streamError.value = data.error;
    isStreaming.value = false;
    streamingMessageId.value = null;
    streamingText.value = '';
    thinkingText.value = '';
  }

  // ================================
  // Actions
  // ================================

  /**
   * Initialize the store: load recent sessions and register streaming listeners.
   */
  async function initialize(): Promise<void> {
    if (isInitialized.value) return;
    isLoading.value = true;
    try {
      sessions.value = await sessionsRepo.getRecentSessions();

      // Resume the most recent session if available
      if (sessions.value.length > 0 && activeSessionId.value === null) {
        const mostRecent = sessions.value[0];
        if (mostRecent !== undefined) {
          activeSessionId.value = mostRecent.id;
        }
      }

      // Register streaming event listeners
      cleanupFunctions.push(window.chatAPI.onStreamToken(_onStreamToken));
      cleanupFunctions.push(window.chatAPI.onStreamThinking(_onStreamThinking));
      cleanupFunctions.push(
        window.chatAPI.onStreamEnd((data) => {
          void _onStreamEnd(data);
        })
      );
      cleanupFunctions.push(window.chatAPI.onStreamError(_onStreamError));

      isInitialized.value = true;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Create a new chat session.
   */
  async function createSession(
    provider: AIProviderType,
    modelId: string,
    title?: string,
    memoryStrategy?: MemoryStrategy,
    memoryConfig?: IMemoryConfig
  ): Promise<IChatSession> {
    const strategy = memoryStrategy ?? 'buffer-window';
    const config = memoryConfig ?? { windowSize: 10 };

    const initResult = await window.chatAPI.initSession({
      provider,
      modelId,
      title,
      memoryStrategy: strategy,
      memoryConfig: JSON.parse(JSON.stringify(config)) as Record<string, unknown>,
    });

    // Create in local DB
    const session = await sessionsRepo.createSession(provider, modelId, title, strategy, config);

    // If the main process returned a different sessionId, update
    // (in practice the main process generates its own session tracking)
    sessions.value.unshift(session);
    activeSessionId.value = session.id;
    messages.value.set(session.id, []);

    // Sync the main process session ID if different
    if (initResult.sessionId !== session.id) {
      // The main process tracks its own session; the renderer uses the local DB ID.
      // Both are valid; the IPC layer uses the renderer's session ID.
      await window.chatAPI.initSession({
        sessionId: session.id,
        provider,
        modelId,
        title,
      });
    }

    return session;
  }

  /**
   * Load a session and its messages.
   */
  async function loadSession(sessionId: string): Promise<void> {
    activeSessionId.value = sessionId;

    // Load messages if not already cached
    if (!messages.value.has(sessionId)) {
      const sessionMessages = await messagesRepo.getBySession(sessionId);
      messages.value.set(sessionId, sessionMessages);
    }

    // Load PDFs if not already cached
    if (!pdfDocuments.value.has(sessionId)) {
      const docs = await pdfDocsRepo.getBySession(sessionId);
      pdfDocuments.value.set(sessionId, docs);
    }

    // Initialize the session in the main process
    const session = sessions.value.find((s) => s.id === sessionId);
    if (session !== undefined) {
      const raw = toRaw(session);
      await window.chatAPI.initSession({
        sessionId,
        provider: raw.provider,
        modelId: raw.modelId,
        memoryStrategy: raw.memoryStrategy,
        memoryConfig: JSON.parse(JSON.stringify(raw.memoryConfig)) as Record<string, unknown>,
      });
    }
  }

  /**
   * Send a message in the active session.
   */
  async function sendMessage(
    text: string,
    options?: { parentMessageId?: string; systemPrompt?: string; contextFiles?: IContextFile[] }
  ): Promise<void> {
    const session = activeSession.value;
    if (session === undefined) return;
    const raw = toRaw(session);

    // Create user message in repository
    const userMessage = await messagesRepo.addMessage(raw.id, 'user', text, {
      parentMessageId: options?.parentMessageId,
      branchIndex: 0,
    });

    // Add to reactive state
    const sessionMessages = messages.value.get(raw.id) ?? [];
    sessionMessages.push(userMessage);
    messages.value.set(raw.id, sessionMessages);

    // Update session stats
    await sessionsRepo.incrementMessageCount(raw.id);

    // Set streaming state
    isStreaming.value = true;
    streamingText.value = '';
    thinkingText.value = '';
    streamError.value = null;
    // Generate a placeholder messageId for the assistant response
    streamingMessageId.value = `streaming-${Date.now()}`;

    // Fire-and-forget: streaming events handle the rest
    void window.chatAPI.streamMessage({
      sessionId: raw.id,
      message: text,
      provider: raw.provider,
      modelId: raw.modelId,
      memoryStrategy: raw.memoryStrategy,
      memoryConfig: JSON.parse(JSON.stringify(raw.memoryConfig)) as Record<string, unknown>,
      parentMessageId: options?.parentMessageId,
      systemPrompt: options?.systemPrompt,
      contextFiles: options?.contextFiles
        ? (JSON.parse(JSON.stringify(options.contextFiles)) as Array<{
            filePath: string;
            fileName: string;
          }>)
        : undefined,
    });
  }

  /**
   * Stop the active stream.
   */
  async function stopStreaming(): Promise<void> {
    if (activeSessionId.value === null) return;
    await window.chatAPI.stopStream(activeSessionId.value);
    isStreaming.value = false;
    streamingMessageId.value = null;
    streamingText.value = '';
    thinkingText.value = '';
  }

  /**
   * Switch the AI model for the active session.
   */
  async function switchModel(provider: AIProviderType, modelId: string): Promise<void> {
    const session = activeSession.value;
    if (session === undefined) return;
    const raw = toRaw(session);

    // Ensure session exists in main process before switching
    await window.chatAPI.initSession({
      sessionId: raw.id,
      provider: raw.provider,
      modelId: raw.modelId,
      memoryStrategy: raw.memoryStrategy,
      memoryConfig: JSON.parse(JSON.stringify(raw.memoryConfig)) as Record<string, unknown>,
    });

    await window.chatAPI.switchModel({
      sessionId: raw.id,
      provider,
      modelId,
    });

    await sessionsRepo.updateSessionModel(raw.id, provider, modelId);

    // Update in state
    const idx = sessions.value.findIndex((s) => s.id === raw.id);
    const existing = sessions.value[idx];
    if (idx !== -1 && existing) {
      sessions.value[idx] = { ...existing, provider, modelId };
    }
  }

  /**
   * Change the memory strategy for the active session.
   */
  async function setMemoryStrategy(strategy: MemoryStrategy, config: IMemoryConfig): Promise<void> {
    const session = activeSession.value;
    if (session === undefined) return;

    await window.chatAPI.setMemoryStrategy(
      session.id,
      strategy,
      config as unknown as Record<string, unknown>
    );

    await sessionsRepo.updateMemoryStrategy(session.id, strategy, config);

    // Update in state
    const idx = sessions.value.findIndex((s) => s.id === session.id);
    const existing = sessions.value[idx];
    if (idx !== -1 && existing) {
      sessions.value[idx] = {
        ...existing,
        memoryStrategy: strategy,
        memoryConfig: config,
      };
    }
  }

  /**
   * Delete a session and all related data.
   */
  async function deleteSession(sessionId: string): Promise<void> {
    // Delete from repositories
    await messagesRepo.deleteSessionMessages(sessionId);
    await snapshotsRepo.deleteSessionSnapshots(sessionId);
    await pdfAnnotationsRepo.deleteSessionAnnotations(sessionId);
    await pdfDocsRepo.deleteSessionDocuments(sessionId);
    await sessionsRepo.delete(sessionId);

    // Remove from state
    sessions.value = sessions.value.filter((s) => s.id !== sessionId);
    messages.value.delete(sessionId);
    pdfDocuments.value.delete(sessionId);

    // If we deleted the active session, clear it
    if (activeSessionId.value === sessionId) {
      const first = sessions.value[0];
      activeSessionId.value = first !== undefined ? first.id : null;
      if (activeSessionId.value !== null) {
        await loadSession(activeSessionId.value);
      }
    }
  }

  /**
   * Archive a session (soft delete).
   */
  async function archiveSession(sessionId: string): Promise<void> {
    await sessionsRepo.archiveSession(sessionId);
    sessions.value = sessions.value.filter((s) => s.id !== sessionId);

    if (activeSessionId.value === sessionId) {
      const first = sessions.value[0];
      activeSessionId.value = first !== undefined ? first.id : null;
      if (activeSessionId.value !== null) {
        await loadSession(activeSessionId.value);
      }
    }
  }

  /**
   * Update a session's title.
   */
  async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
    await sessionsRepo.updateTitle(sessionId, title);

    const idx = sessions.value.findIndex((s) => s.id === sessionId);
    const existing = sessions.value[idx];
    if (idx !== -1 && existing) {
      sessions.value[idx] = { ...existing, title };
    }
  }

  /**
   * Clean up IPC event listeners.
   */
  function dispose(): void {
    for (const cleanup of cleanupFunctions) {
      cleanup();
    }
    cleanupFunctions.length = 0;
  }

  return {
    // State
    sessions,
    activeSessionId,
    messages,
    isStreaming,
    streamingMessageId,
    streamingText,
    thinkingText,
    streamError,
    isInitialized,
    isLoading,
    pdfDocuments,

    // Computed
    activeSession,
    activeMessages,
    activeMainThread,
    activePDFs,
    hasActiveStream,
    totalTokensUsed,

    // Actions
    initialize,
    createSession,
    loadSession,
    sendMessage,
    stopStreaming,
    switchModel,
    setMemoryStrategy,
    deleteSession,
    archiveSession,
    updateSessionTitle,
    dispose,
  };
});
