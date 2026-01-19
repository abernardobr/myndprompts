import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Global setup for E2E tests
 * Runs once before all tests
 */
async function globalSetup(config: FullConfig) {
  console.log('\n🚀 Starting MyndPrompts E2E Test Suite...\n');

  // Create test data directory
  const testDataDir = path.join(__dirname, '../fixtures/test-data');
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }

  // Create reports directory
  const reportsDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // Clean up previous test artifacts
  const artifactsDir = path.join(reportsDir, 'artifacts');
  if (fs.existsSync(artifactsDir)) {
    fs.rmSync(artifactsDir, { recursive: true, force: true });
  }

  console.log('✅ Test environment prepared\n');
}

export default globalSetup;
