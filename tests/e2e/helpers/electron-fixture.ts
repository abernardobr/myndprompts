import { test as base, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Extended test fixture for Electron application testing
 */
export type TestFixtures = {
  electronApp: ElectronApplication;
  window: Page;
  testDataPath: string;
};

/**
 * Custom test fixture that launches the Electron app
 */
export const test = base.extend<TestFixtures>({
  electronApp: async ({}, use) => {
    // Path to the built Electron app
    const appPath = path.join(__dirname, '../../../dist/electron/Packaged');

    // Determine the correct executable path based on platform
    let executablePath: string;
    if (process.platform === 'darwin') {
      executablePath = path.join(appPath, 'mac-arm64/MyndPrompts.app/Contents/MacOS/MyndPrompts');
      // Fallback to Intel Mac if ARM doesn't exist
      if (!fs.existsSync(executablePath)) {
        executablePath = path.join(appPath, 'mac/MyndPrompts.app/Contents/MacOS/MyndPrompts');
      }
    } else if (process.platform === 'win32') {
      executablePath = path.join(appPath, 'win-unpacked/MyndPrompts.exe');
    } else {
      executablePath = path.join(appPath, 'linux-unpacked/myndprompts');
    }

    // If packaged app doesn't exist, use development mode
    if (!fs.existsSync(executablePath)) {
      console.log('📦 Packaged app not found, using development mode...');
      // Launch from source using electron
      const electronPath = require('electron');
      const mainPath = path.join(__dirname, '../../../dist/electron/UnPackaged/electron-main.js');

      if (!fs.existsSync(mainPath)) {
        throw new Error(
          'Neither packaged app nor development build found. Run "npm run build:electron" first.'
        );
      }

      const app = await electron.launch({
        args: [mainPath],
        executablePath: electronPath as unknown as string,
        env: {
          ...process.env,
          NODE_ENV: 'test',
          PLAYWRIGHT_TEST: 'true',
        },
      });

      await use(app);
      await app.close();
      return;
    }

    // Launch the packaged Electron app
    const app = await electron.launch({
      executablePath,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PLAYWRIGHT_TEST: 'true',
      },
    });

    await use(app);
    await app.close();
  },

  window: async ({ electronApp }, use) => {
    // Wait for the first window to open
    const window = await electronApp.firstWindow();

    // Wait for the app to be fully loaded
    await window.waitForLoadState('domcontentloaded');

    // Wait for Vue app to mount (look for the app container)
    await window.waitForSelector('#q-app', { timeout: 30000 });

    // Additional wait for initial data loading
    await window.waitForTimeout(2000);

    await use(window);
  },

  testDataPath: async ({}, use) => {
    const testDataPath = path.join(__dirname, '../fixtures/test-data');

    // Ensure the directory exists
    if (!fs.existsSync(testDataPath)) {
      fs.mkdirSync(testDataPath, { recursive: true });
    }

    await use(testDataPath);
  },
});

export { expect } from '@playwright/test';
