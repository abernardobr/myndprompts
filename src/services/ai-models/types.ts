/**
 * Shared types for AI model fetching.
 * Used by both the Electron main process and the renderer.
 */

import type { AIProviderType } from '@/services/storage/entities';

export interface IProviderModel {
  id: string; // e.g. 'claude-sonnet-4-20250514'
  name: string; // display name
  provider: AIProviderType;
}

export interface IFetchModelsResult {
  success: boolean;
  models: IProviderModel[];
  error?: string;
}
