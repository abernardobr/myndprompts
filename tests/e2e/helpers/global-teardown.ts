import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Global teardown for E2E tests
 * Runs once after all tests
 */
async function globalTeardown(config: FullConfig) {
  console.log('\n🧹 Cleaning up test environment...\n');

  // Clean up test data directory
  const testDataDir = path.join(__dirname, '../fixtures/test-data');
  if (fs.existsSync(testDataDir)) {
    // Keep the directory but remove contents
    const files = fs.readdirSync(testDataDir);
    for (const file of files) {
      const filePath = path.join(testDataDir, file);
      fs.rmSync(filePath, { recursive: true, force: true });
    }
  }

  console.log('✅ Test cleanup complete\n');
  console.log('📊 Test reports available in tests/e2e/reports/\n');
}

export default globalTeardown;
