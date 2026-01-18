export interface IPrompt {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  aiProvider: string;
  isFavorite: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export type PromptCategory =
  | 'development'
  | 'architecture'
  | 'debugging'
  | 'documentation'
  | 'testing'
  | 'refactoring'
  | 'review'
  | 'other';

export type AIProvider = 'anthropic' | 'openai' | 'google' | 'azure' | 'local';
