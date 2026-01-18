import { getDB, type MyndPromptDB } from '../db';
import { migrateV1 } from './v1';

/**
 * Migration registry - maps version numbers to migration functions
 */
const migrations: Record<number, (db: MyndPromptDB) => Promise<void>> = {
  1: migrateV1,
};

/**
 * Run all pending migrations
 *
 * This function is called on app startup to ensure the database
 * is properly initialized with default data.
 */
export async function runMigrations(): Promise<void> {
  const db = getDB();

  // Dexie handles schema migrations automatically.
  // This function is for data migrations (seeding defaults, etc.)

  try {
    // Run v1 migration (initial setup)
    await migrateV1(db);

    console.log('[Migrations] All migrations completed successfully');
  } catch (error) {
    console.error('[Migrations] Migration failed:', error);
    throw error;
  }
}

/**
 * Check if database needs initialization
 */
export async function needsInitialization(): Promise<boolean> {
  const db = getDB();
  const providerCount = await db.aiProviders.count();
  const uiStateCount = await db.uiState.count();

  return providerCount === 0 || uiStateCount === 0;
}

export { migrations };
