// Database
export { getDB, resetDB, closeDB } from './db';
export type { MyndPromptDB } from './db';

// Entities
export * from './entities';

// Repositories
export * from './repositories';

// Migrations
export { runMigrations, needsInitialization } from './migrations';

/**
 * Initialize the storage layer
 *
 * This should be called on app startup to ensure the database
 * is properly set up with default values.
 */
export async function initializeStorage(): Promise<void> {
  const { runMigrations } = await import('./migrations');
  await runMigrations();
}
