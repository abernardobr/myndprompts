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
import type { BaseMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';

import * as fs from 'fs';
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
  IContextFile,
} from '../../../services/chat/types';

// ================================
// Internal session state
// ================================

interface ISessionState {
  model: BaseChatModel;
  chatHistory: InMemoryChatMessageHistory;
  memoryStrategy: MemoryStrategy;
  memoryConfig: IMemoryConfig;
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

    this.sessions.set(sessionId, {
      model,
      chatHistory: new InMemoryChatMessageHistory(),
      memoryStrategy: strategy,
      memoryConfig: config,
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
      session = {
        model,
        chatHistory: new InMemoryChatMessageHistory(),
        memoryStrategy: request.memoryStrategy,
        memoryConfig: request.memoryConfig,
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
      const messages = await this.buildMessages(
        session,
        request.message,
        request.systemPrompt,
        request.contextFiles
      );

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

      // Save to chat history
      await session.chatHistory.addMessage(new HumanMessage(request.message));
      await session.chatHistory.addMessage(new AIMessage(fullText));

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
      if (abortController.signal.aborted) {
        console.log(`[LangChain] Stream aborted for session ${request.sessionId}`);
        return;
      }

      console.error(`[LangChain] Stream error for session ${request.sessionId}:`, err);

      // Extract a user-friendly error message from API errors
      const errorMessage = this.extractErrorMessage(err);

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
  setMemoryStrategy(sessionId: string, strategy: MemoryStrategy, config: IMemoryConfig): void {
    const session = this.sessions.get(sessionId);
    if (session === undefined) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Update strategy and config — chat history is preserved as-is
    session.memoryStrategy = strategy;
    session.memoryConfig = config;

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
          model: modelId,
        });

      case 'groq':
        return new ChatGroq({
          apiKey: apiKey ?? undefined,
          model: modelId,
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
   * Build the messages array for a model call, applying the memory strategy
   * to limit context window as needed.
   */
  private async buildMessages(
    session: ISessionState,
    userMessage: string,
    systemPrompt?: string,
    contextFiles?: IContextFile[]
  ): Promise<Array<HumanMessage | SystemMessage | AIMessage>> {
    const messages: Array<HumanMessage | SystemMessage | AIMessage> = [];

    // Add system prompt if provided
    if (systemPrompt !== undefined && systemPrompt !== '') {
      messages.push(new SystemMessage(systemPrompt));
    }

    // Add file context if provided
    if (contextFiles && contextFiles.length > 0) {
      const fileContextParts: string[] = [];
      for (const file of contextFiles) {
        try {
          const content = fs.readFileSync(file.filePath, 'utf-8');
          fileContextParts.push(`--- ${file.fileName} ---\n${content}\n---`);
        } catch (err) {
          console.warn(`[LangChain] Failed to read context file: ${file.filePath}`, err);
        }
      }
      if (fileContextParts.length > 0) {
        messages.push(
          new SystemMessage(
            `The user has attached the following files as context:\n\n${fileContextParts.join('\n\n')}`
          )
        );
      }
    }

    // Get history from chat history store
    let historyMessages: BaseMessage[] = await session.chatHistory.getMessages();

    // Apply windowing based on memory strategy
    historyMessages = this.applyMemoryWindow(
      historyMessages,
      session.memoryStrategy,
      session.memoryConfig
    );

    messages.push(...(historyMessages as Array<HumanMessage | AIMessage>));

    // Add the current user message
    messages.push(new HumanMessage(userMessage));

    return messages;
  }

  /**
   * Apply memory windowing strategy to limit the number of history messages.
   */
  private applyMemoryWindow(
    messages: BaseMessage[],
    strategy: MemoryStrategy,
    config: IMemoryConfig
  ): BaseMessage[] {
    switch (strategy) {
      case 'buffer':
        // Full buffer — return all messages
        return messages;

      case 'buffer-window': {
        // Keep only the last N message pairs (windowSize * 2 for human+AI pairs)
        const windowSize = config.windowSize ?? 10;
        const maxMessages = windowSize * 2;
        if (messages.length > maxMessages) {
          return messages.slice(-maxMessages);
        }
        return messages;
      }

      case 'summary':
      case 'summary-buffer': {
        // For now, treat like buffer-window with maxTokens as a rough message limit
        const maxTokens = config.maxTokens ?? 2000;
        // Rough heuristic: ~4 chars per token, limit message count accordingly
        const approxMaxMessages = Math.max(4, Math.floor(maxTokens / 100));
        if (messages.length > approxMaxMessages) {
          return messages.slice(-approxMaxMessages);
        }
        return messages;
      }

      case 'vector':
        // Vector memory not yet implemented — fall back to buffer-window
        console.warn('[LangChain] Vector memory not yet implemented, using buffer-window');
        return messages.length > 20 ? messages.slice(-20) : messages;

      default:
        return messages;
    }
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

  /**
   * Extract a user-friendly error message from API errors.
   */
  private extractErrorMessage(err: unknown): string {
    if (!(err instanceof Error)) return 'Unknown streaming error';

    // Many LLM SDK errors have a nested error object with a message
    const errObj = err as Record<string, unknown>;
    if (errObj.error !== undefined && typeof errObj.error === 'object' && errObj.error !== null) {
      const nested = errObj.error as Record<string, unknown>;
      if (nested.error !== undefined && typeof nested.error === 'object' && nested.error !== null) {
        const innerMsg = (nested.error as Record<string, unknown>).message;
        if (typeof innerMsg === 'string') return innerMsg;
      }
      const nestedMsg = nested.message;
      if (typeof nestedMsg === 'string') return nestedMsg;
    }

    // Try status code prefix for context
    const status = errObj.status;
    if (typeof status === 'number') {
      return `API error (${String(status)}): ${err.message}`;
    }

    return err.message;
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
