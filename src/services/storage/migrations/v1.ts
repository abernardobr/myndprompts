import type { MyndPromptDB } from '../db';
import { DEFAULT_AI_PROVIDERS } from '../entities';
import { v4 as uuidv4 } from 'uuid';

/**
 * Version 1 Migration - Initial Schema
 *
 * This migration sets up the initial database schema and default data.
 */
export async function migrateV1(db: MyndPromptDB): Promise<void> {
  // Initialize default AI providers
  const existingProviders = await db.aiProviders.count();

  if (existingProviders === 0) {
    const providers = DEFAULT_AI_PROVIDERS.map((p) => ({
      ...p,
      id: uuidv4(),
    }));
    await db.aiProviders.bulkAdd(providers);
  }

  // Initialize default UI state
  const existingUIState = await db.uiState.count();

  if (existingUIState === 0) {
    await db.uiState.add({
      id: 'default',
      openTabs: [],
      activeTab: undefined,
      sidebarWidth: 280,
      sidebarCollapsed: false,
      panelHeight: 200,
      panelCollapsed: true,
      theme: 'system',
      locale: 'en-US',
    });
  }

  console.log('[Migration] v1 completed successfully');
}
