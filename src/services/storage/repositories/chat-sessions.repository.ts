import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db';
import { BaseRepository } from './base.repository';
import type { IChatSession, AIProviderType } from '../entities';
import type { MemoryStrategy, IMemoryConfig, ITokenUsage } from '../../chat/types';

/**
 * Repository for managing chat sessions.
 *
 * Handles session lifecycle including creation, archiving,
 * model switching, memory strategy updates, and token tracking.
 */
export class ChatSessionsRepository extends BaseRepository<IChatSession, string> {
  private static instance: ChatSessionsRepository | null = null;

  private constructor() {
    super(getDB().chatSessions);
  }

  static getInstance(): ChatSessionsRepository {
    if (!ChatSessionsRepository.instance) {
      ChatSessionsRepository.instance = new ChatSessionsRepository();
    }
    return ChatSessionsRepository.instance;
  }

  /**
   * Create a new chat session
   */
  async createSession(
    provider: AIProviderType,
    modelId: string,
    title?: string,
    memoryStrategy?: MemoryStrategy,
    memoryConfig?: IMemoryConfig
  ): Promise<IChatSession> {
    const now = new Date();
    const session: IChatSession = {
      id: uuidv4(),
      title: title ?? 'Untitled Session',
      provider,
      modelId,
      memoryStrategy: memoryStrategy ?? 'buffer-window',
      memoryConfig: memoryConfig ?? { windowSize: 10 },
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      messageCount: 0,
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      isArchived: false,
    };

    await this.create(session);
    return session;
  }

  /**
   * Get recent non-archived sessions ordered by updatedAt descending
   */
  async getRecentSessions(limit = 50): Promise<IChatSession[]> {
    return this.table
      .where('isArchived')
      .equals(0) // Dexie stores booleans as 0/1
      .reverse()
      .sortBy('updatedAt')
      .then((sessions) => sessions.slice(0, limit));
  }

  /**
   * Get archived sessions
   */
  async getArchivedSessions(): Promise<IChatSession[]> {
    return this.filter((s) => s.isArchived);
  }

  /**
   * Archive a session (soft delete)
   */
  async archiveSession(id: string): Promise<void> {
    await this.update(id, { isArchived: true });
  }

  /**
   * Unarchive a session
   */
  async unarchiveSession(id: string): Promise<void> {
    await this.update(id, { isArchived: false });
  }

  /**
   * Update the current model for a session
   */
  async updateSessionModel(id: string, provider: AIProviderType, modelId: string): Promise<void> {
    await this.update(id, { provider, modelId });
  }

  /**
   * Update memory strategy and config for a session
   */
  async updateMemoryStrategy(
    id: string,
    strategy: MemoryStrategy,
    config: IMemoryConfig
  ): Promise<void> {
    await this.update(id, { memoryStrategy: strategy, memoryConfig: config });
  }

  /**
   * Increment message count by 1
   */
  async incrementMessageCount(id: string): Promise<void> {
    const session = await this.getById(id);
    if (session === undefined) return;
    await this.update(id, {
      messageCount: session.messageCount + 1,
      lastMessageAt: new Date(),
    });
  }

  /**
   * Add token usage to the cumulative session total
   */
  async addTokenUsage(id: string, usage: ITokenUsage): Promise<void> {
    const session = await this.getById(id);
    if (session === undefined) return;
    await this.update(id, {
      tokenUsage: {
        promptTokens: session.tokenUsage.promptTokens + usage.promptTokens,
        completionTokens: session.tokenUsage.completionTokens + usage.completionTokens,
        totalTokens: session.tokenUsage.totalTokens + usage.totalTokens,
      },
    });
  }

  /**
   * Update session title
   */
  async updateTitle(id: string, title: string): Promise<void> {
    await this.update(id, { title });
  }

  static resetInstance(): void {
    ChatSessionsRepository.instance = null;
  }
}

/**
 * Get the ChatSessionsRepository singleton
 */
export function getSessionsRepository(): ChatSessionsRepository {
  return ChatSessionsRepository.getInstance();
}
