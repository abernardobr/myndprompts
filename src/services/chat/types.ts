/**
 * Shared types for AI Chat.
 * Used by both the Electron main process and the renderer.
 */

import type { AIProviderType } from '@/services/storage/entities';

/**
 * Supported memory strategies for conversation history management.
 */
export type MemoryStrategy = 'buffer' | 'buffer-window' | 'summary' | 'summary-buffer' | 'vector';

/**
 * Configuration for a memory strategy.
 */
export interface IMemoryConfig {
  /** Number of recent messages to keep (for buffer-window and summary-buffer). Default: 10 */
  windowSize?: number;
  /** Maximum token count for summary strategies */
  maxTokens?: number;
  /** Optional separate model for summarization */
  summaryModelId?: string;
}

/**
 * Token usage statistics for a single message or cumulative session.
 */
export interface ITokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Metadata attached to an assistant message after generation.
 */
export interface IChatMessageMetadata {
  provider: AIProviderType;
  modelId: string;
  modelName: string;
  /** Response duration in milliseconds */
  duration: number;
  finishReason?: string;
}

// ================================
// Streaming Events (Main -> Renderer)
// ================================

/** A single token chunk pushed during streaming */
export interface IStreamTokenEvent {
  type: 'token';
  token: string;
  messageId: string;
}

/** Extended thinking/reasoning content pushed during streaming */
export interface IStreamThinkingEvent {
  type: 'thinking';
  text: string;
  messageId: string;
}

/** Sent when streaming completes successfully */
export interface IStreamEndEvent {
  type: 'end';
  messageId: string;
  fullText: string;
  thinkingText?: string;
  usage: ITokenUsage;
  metadata: IChatMessageMetadata;
}

/** Sent when streaming encounters an error */
export interface IStreamErrorEvent {
  type: 'error';
  messageId: string;
  error: string;
}

/** Discriminated union of all streaming events */
export type IStreamEvent =
  | IStreamTokenEvent
  | IStreamThinkingEvent
  | IStreamEndEvent
  | IStreamErrorEvent;

// ================================
// IPC Request / Response Types
// ================================

/**
 * Request to start streaming a message to an AI model.
 */
export interface IChatStreamRequest {
  sessionId: string;
  message: string;
  provider: AIProviderType;
  modelId: string;
  memoryStrategy: MemoryStrategy;
  memoryConfig: IMemoryConfig;
  parentMessageId?: string;
  systemPrompt?: string;
}

/**
 * Request to initialize or resume a chat session.
 */
export interface IChatInitRequest {
  sessionId?: string;
  provider: AIProviderType;
  modelId: string;
  title?: string;
  memoryStrategy?: MemoryStrategy;
  memoryConfig?: IMemoryConfig;
}

/**
 * Result of initializing a chat session.
 */
export interface IChatInitResult {
  sessionId: string;
  resumed: boolean;
}

/**
 * Request to switch the AI model mid-conversation.
 */
export interface IChatSwitchModelRequest {
  sessionId: string;
  provider: AIProviderType;
  modelId: string;
}
