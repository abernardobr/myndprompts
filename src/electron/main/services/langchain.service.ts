/**
 * LangChain Service
 *
 * Runs in the Electron main process. Orchestrates LLM interactions via
 * LangChain.js — model instantiation, memory management, streaming,
 * and abort handling. API keys are retrieved internally from
 * SecureStorageService and never cross the IPC boundary.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-redundant-type-constituents */

import { v4 as uuidv4 } from 'uuid';
import type { WebContents } from 'electron';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatGroq } from '@langchain/groq';
import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BufferMemory, ConversationSummaryBufferMemory } from 'langchain/memory';
import { ChatMessageHistory } from 'langchain/stores/message/in_memory';

import { getSecureStorageService } from './secure-storage.service';
import type { AIProviderType } from '../../../services/storage/entities';
import type {
  MemoryStrategy,
  IMemoryConfig,
  ITokenUsage,
  IChatMessageMetadata,
  IChatInitRequest,
  IChatInitResult,
  IChatStreamRequest,
  IChatSwitchModelRequest,
} from '../../../services/chat/types';

// ================================
// Internal session state
// ================================

interface ISessionState {
  model: BaseChatModel;
  memory: BufferMemory | ConversationSummaryBufferMemory;
  abortController?: AbortController;
  provider: AIProviderType;
  modelId: string;
  webContents?: WebContents;
}

// ================================
// Service
// ================================

export class LangChainService {
  private static instance: LangChainService | null = null;
  private sessions: Map<string, ISessionState> = new Map();

  private constructor() {}

  static getInstance(): LangChainService {
    if (!LangChainService.instance) {
      LangChainService.instance = new LangChainService();
    }
    return LangChainService.instance;
  }

  // ================================
  // Public methods
  // ================================

  /**
   * Initialize or resume a chat session.
   */
  initSession(request: IChatInitRequest, webContents: WebContents): IChatInitResult {
    // Resume existing session
    if (request.sessionId !== undefined && this.sessions.has(request.sessionId)) {
      const session = this.sessions.get(request.sessionId);
      if (session === undefined) throw new Error('Session unexpectedly missing');
      session.webContents = webContents;
      console.log(`[LangChain] Resumed session ${request.sessionId}`);
      return { sessionId: request.sessionId, resumed: true };
    }

    const sessionId = request.sessionId ?? uuidv4();
    const strategy = request.memoryStrategy ?? 'buffer-window';
    const config = request.memoryConfig ?? { windowSize: 10 };

    const model = this.createModel(request.provider, request.modelId);
    const memory = this.createMemory(strategy, config, model);

    this.sessions.set(sessionId, {
      model,
      memory,
      provider: request.provider,
      modelId: request.modelId,
      webContents,
    });

    console.log(
      `[LangChain] Initialized session ${sessionId} (provider=${request.provider}, model=${request.modelId}, memory=${strategy})`
    );

    return { sessionId, resumed: false };
  }

  /**
   * Stream a message to an AI model. Tokens are pushed to the renderer
   * via webContents.send().
   */
  async streamMessage(request: IChatStreamRequest, webContents: WebContents): Promise<void> {
    let session = this.sessions.get(request.sessionId);

    // Auto-create session if it doesn't exist yet
    if (session === undefined) {
      const model = this.createModel(request.provider, request.modelId);
      const memory = this.createMemory(request.memoryStrategy, request.memoryConfig, model);
      session = {
        model,
        memory,
        provider: request.provider,
        modelId: request.modelId,
        webContents,
      };
      this.sessions.set(request.sessionId, session);
    }

    session.webContents = webContents;

    const messageId = uuidv4();
    const abortController = new AbortController();
    session.abortController = abortController;

    const startTime = Date.now();
    let fullText = '';
    let thinkingText = '';
    let finishReason = 'stop';
    let promptTokens = 0;
    let completionTokens = 0;

    try {
      // Build messages array
      const messages = await this.buildMessages(session, request.message, request.systemPrompt);

      console.log(`[LangChain] Streaming message in session ${request.sessionId}`);

      // Stream the response
      const stream = await session.model.stream(messages, {
        signal: abortController.signal,
      });

      for await (const chunk of stream) {
        if (abortController.signal.aborted) {
          finishReason = 'abort';
          break;
        }

        // Extract content from the chunk
        const content =
          typeof chunk.content === 'string'
            ? chunk.content
            : Array.isArray(chunk.content)
              ? this.extractContentFromParts(chunk.content)
              : '';

        // Check for thinking content (Anthropic extended thinking)
        const thinking = Array.isArray(chunk.content)
          ? this.extractThinkingFromParts(chunk.content)
          : '';

        if (thinking !== '') {
          thinkingText += thinking;
          webContents.send('chat:stream-thinking', {
            text: thinking,
            messageId,
          });
        }

        if (content !== '') {
          fullText += content;
          webContents.send('chat:stream-token', {
            token: content,
            messageId,
          });
        }

        // Accumulate token usage from chunk metadata if available
        if (chunk.usage_metadata !== undefined && chunk.usage_metadata !== null) {
          const meta = chunk.usage_metadata as {
            input_tokens?: number;
            output_tokens?: number;
          };
          if (meta.input_tokens !== undefined) promptTokens = meta.input_tokens;
          if (meta.output_tokens !== undefined) completionTokens = meta.output_tokens;
        }
      }

      // Save to memory
      await session.memory.chatHistory.addMessage(new HumanMessage(request.message));
      await session.memory.chatHistory.addMessage(new AIMessage(fullText));

      const duration = Date.now() - startTime;
      const totalTokens = promptTokens + completionTokens;

      const usage: ITokenUsage = {
        promptTokens,
        completionTokens,
        totalTokens,
      };

      const metadata: IChatMessageMetadata = {
        provider: session.provider,
        modelId: session.modelId,
        modelName: session.modelId,
        duration,
        finishReason,
      };

      webContents.send('chat:stream-end', {
        messageId,
        fullText,
        thinkingText: thinkingText || undefined,
        usage,
        metadata,
      });

      console.log(
        `[LangChain] Stream completed for session ${request.sessionId} (${totalTokens} tokens, ${duration}ms)`
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown streaming error';

      if (abortController.signal.aborted) {
        console.log(`[LangChain] Stream aborted for session ${request.sessionId}`);
      } else {
        console.error(`[LangChain] Stream error for session ${request.sessionId}:`, err);
      }

      webContents.send('chat:stream-error', {
        messageId,
        error: errorMessage,
      });
    } finally {
      session.abortController = undefined;
    }
  }

  /**
   * Stop an active stream for a session.
   */
  stopStream(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session?.abortController !== undefined) {
      session.abortController.abort();
      console.log(`[LangChain] Aborting stream for session ${sessionId}`);
    }
  }

  /**
   * Switch the AI model for an existing session, preserving memory.
   */
  switchModel(request: IChatSwitchModelRequest): void {
    const session = this.sessions.get(request.sessionId);
    if (session === undefined) {
      throw new Error(`Session ${request.sessionId} not found`);
    }

    const newModel = this.createModel(request.provider, request.modelId);
    session.model = newModel;
    session.provider = request.provider;
    session.modelId = request.modelId;

    console.log(
      `[LangChain] Switched model for session ${request.sessionId} to ${request.provider}/${request.modelId}`
    );
  }

  /**
   * Change the memory strategy for an existing session.
   */
  async setMemoryStrategy(
    sessionId: string,
    strategy: MemoryStrategy,
    config: IMemoryConfig
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session === undefined) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Retrieve existing messages from current memory
    const existingMessages = await session.memory.chatHistory.getMessages();

    // Create new memory with the new strategy
    const newMemory = this.createMemory(strategy, config, session.model);

    // Migrate existing messages to the new memory
    for (const msg of existingMessages) {
      await newMemory.chatHistory.addMessage(msg);
    }

    session.memory = newMemory;

    console.log(`[LangChain] Changed memory strategy for session ${sessionId} to ${strategy}`);
  }

  /**
   * Destroy a session and clean up resources.
   */
  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session !== undefined) {
      if (session.abortController !== undefined) {
        session.abortController.abort();
      }
      this.sessions.delete(sessionId);
      console.log(`[LangChain] Destroyed session ${sessionId}`);
    }
  }

  // ================================
  // Private helpers
  // ================================

  /**
   * Create a LangChain chat model for the given provider and model ID.
   */
  private createModel(provider: AIProviderType, modelId: string): BaseChatModel {
    const apiKey = this.getApiKey(provider);

    switch (provider) {
      case 'anthropic':
        return new ChatAnthropic({
          anthropicApiKey: apiKey ?? undefined,
          modelName: modelId,
          streaming: true,
        });

      case 'openai':
        return new ChatOpenAI({
          openAIApiKey: apiKey ?? undefined,
          modelName: modelId,
          streaming: true,
        });

      case 'google':
        return new ChatGoogleGenerativeAI({
          apiKey: apiKey ?? undefined,
          modelName: modelId,
        });

      case 'groq':
        return new ChatGroq({
          apiKey: apiKey ?? undefined,
          modelName: modelId,
        });

      case 'ollama':
        return new ChatOllama({
          model: modelId,
          baseUrl: 'http://localhost:11434',
        });

      default:
        throw new Error(`Unsupported provider: ${provider as string}`);
    }
  }

  /**
   * Create a memory instance for the given strategy.
   */
  private createMemory(
    strategy: MemoryStrategy,
    config: IMemoryConfig,
    model: BaseChatModel
  ): BufferMemory | ConversationSummaryBufferMemory {
    const chatHistory = new ChatMessageHistory();

    switch (strategy) {
      case 'buffer':
        return new BufferMemory({
          chatHistory,
          returnMessages: true,
        });

      case 'buffer-window':
        return new BufferMemory({
          chatHistory,
          returnMessages: true,
          // BufferWindowMemory is handled by limiting messages in buildMessages
        });

      case 'summary':
      case 'summary-buffer':
        return new ConversationSummaryBufferMemory({
          llm: model,
          chatHistory,
          returnMessages: true,
          maxTokenLimit: config.maxTokens ?? 2000,
        });

      case 'vector':
        // Vector memory requires additional setup; fall back to buffer-window
        console.warn('[LangChain] Vector memory not yet implemented, using buffer-window');
        return new BufferMemory({
          chatHistory,
          returnMessages: true,
        });

      default:
        return new BufferMemory({
          chatHistory,
          returnMessages: true,
        });
    }
  }

  /**
   * Build the messages array for a model call, applying the memory strategy.
   */
  private async buildMessages(
    session: ISessionState,
    userMessage: string,
    systemPrompt?: string
  ): Promise<Array<HumanMessage | SystemMessage | AIMessage>> {
    const messages: Array<HumanMessage | SystemMessage | AIMessage> = [];

    // Add system prompt if provided
    if (systemPrompt !== undefined && systemPrompt !== '') {
      messages.push(new SystemMessage(systemPrompt));
    }

    // Get history from memory
    const historyMessages = await session.memory.chatHistory.getMessages();
    messages.push(...(historyMessages as Array<HumanMessage | AIMessage>));

    // Add the current user message
    messages.push(new HumanMessage(userMessage));

    return messages;
  }

  /**
   * Extract text content from multi-part chunk content (LangChain format).
   */
  private extractContentFromParts(parts: unknown[]): string {
    let text = '';
    for (const part of parts) {
      if (typeof part === 'string') {
        text += part;
      } else if (part !== null && typeof part === 'object' && 'type' in part) {
        const typed = part as { type: string; text?: string };
        if (typed.type === 'text' && typed.text !== undefined) {
          text += typed.text;
        }
      }
    }
    return text;
  }

  /**
   * Extract thinking/reasoning content from multi-part chunk content.
   * Anthropic extended thinking uses a 'thinking' type content block.
   */
  private extractThinkingFromParts(parts: unknown[]): string {
    let thinking = '';
    for (const part of parts) {
      if (part !== null && typeof part === 'object' && 'type' in part) {
        const typed = part as { type: string; thinking?: string; text?: string };
        if (typed.type === 'thinking') {
          thinking += typed.thinking ?? typed.text ?? '';
        }
      }
    }
    return thinking;
  }

  /**
   * Retrieve an API key from SecureStorageService.
   */
  private getApiKey(provider: AIProviderType): string | null {
    if (provider === 'ollama') return null; // Ollama doesn't need a key
    return getSecureStorageService().getApiKey(provider);
  }

  static resetInstance(): void {
    LangChainService.instance = null;
  }
}

/**
 * Get the LangChainService singleton
 */
export function getLangChainService(): LangChainService {
  return LangChainService.getInstance();
}
