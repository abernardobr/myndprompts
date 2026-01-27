import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db';
import { BaseRepository } from './base.repository';
import type { IChatMessage } from '../entities';
import type { ITokenUsage, IChatMessageMetadata } from '../../chat/types';

/**
 * Repository for managing chat messages within sessions.
 *
 * Supports ordered retrieval by session, branching conversations,
 * and message CRUD operations.
 */
export class ChatMessagesRepository extends BaseRepository<IChatMessage, string> {
  private static instance: ChatMessagesRepository | null = null;

  private constructor() {
    super(getDB().chatMessages);
  }

  static getInstance(): ChatMessagesRepository {
    if (!ChatMessagesRepository.instance) {
      ChatMessagesRepository.instance = new ChatMessagesRepository();
    }
    return ChatMessagesRepository.instance;
  }

  /**
   * Add a message to a session
   */
  async addMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    options?: {
      thinkingContent?: string;
      parentMessageId?: string;
      branchIndex?: number;
      tokenUsage?: ITokenUsage;
      metadata?: IChatMessageMetadata;
    }
  ): Promise<IChatMessage> {
    const message: IChatMessage = {
      id: uuidv4(),
      sessionId,
      role,
      content,
      thinkingContent: options?.thinkingContent,
      parentMessageId: options?.parentMessageId,
      branchIndex: options?.branchIndex ?? 0,
      tokenUsage: options?.tokenUsage,
      metadata: options?.metadata,
      createdAt: new Date(),
    };

    await this.create(message);
    return message;
  }

  /**
   * Get all messages for a session ordered by createdAt
   */
  async getBySession(sessionId: string): Promise<IChatMessage[]> {
    return this.table
      .where('[sessionId+createdAt]')
      .between([sessionId, Dexie.minKey], [sessionId, Dexie.maxKey])
      .toArray();
  }

  /**
   * Get the main conversation thread (branchIndex === 0) for a session
   */
  async getMainThread(sessionId: string): Promise<IChatMessage[]> {
    const messages = await this.getBySession(sessionId);
    return messages.filter((m) => m.branchIndex === 0);
  }

  /**
   * Get all messages branching from a parent message
   */
  async getBranches(parentMessageId: string): Promise<IChatMessage[]> {
    return this.table.where('parentMessageId').equals(parentMessageId).toArray();
  }

  /**
   * Get the most recent message in a session
   */
  async getLastMessage(sessionId: string): Promise<IChatMessage | undefined> {
    const messages = await this.table
      .where('[sessionId+createdAt]')
      .between([sessionId, Dexie.minKey], [sessionId, Dexie.maxKey])
      .reverse()
      .limit(1)
      .toArray();
    return messages[0];
  }

  /**
   * Update message content
   */
  async updateContent(id: string, content: string): Promise<void> {
    await this.update(id, { content });
  }

  /**
   * Delete all messages for a session
   */
  async deleteSessionMessages(sessionId: string): Promise<void> {
    const messages = await this.getBySession(sessionId);
    const ids = messages.map((m) => m.id);
    if (ids.length > 0) {
      await this.deleteMany(ids);
    }
  }

  static resetInstance(): void {
    ChatMessagesRepository.instance = null;
  }
}

// Dexie reference for minKey/maxKey
import Dexie from 'dexie';

/**
 * Get the ChatMessagesRepository singleton
 */
export function getMessagesRepository(): ChatMessagesRepository {
  return ChatMessagesRepository.getInstance();
}
