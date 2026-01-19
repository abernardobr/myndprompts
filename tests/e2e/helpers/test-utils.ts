import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Test utilities and helper functions for E2E tests
 */

/**
 * Wait for a specific amount of time
 */
export async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a unique test ID
 */
export function generateTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique project name for testing
 */
export function generateProjectName(): string {
  return `Test Project ${generateTestId()}`;
}

/**
 * Generate a unique prompt name for testing
 */
export function generatePromptName(): string {
  return `Test Prompt ${generateTestId()}`;
}

/**
 * Generate a unique snippet name for testing
 */
export function generateSnippetName(): string {
  return `Test Snippet ${generateTestId()}`;
}

/**
 * Create a test file in the test data directory
 */
export function createTestFile(testDataPath: string, fileName: string, content: string): string {
  const filePath = path.join(testDataPath, fileName);
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Read a test file from the test data directory
 */
export function readTestFile(testDataPath: string, fileName: string): string {
  const filePath = path.join(testDataPath, fileName);
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Delete a test file from the test data directory
 */
export function deleteTestFile(testDataPath: string, fileName: string): void {
  const filePath = path.join(testDataPath, fileName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Clean up test directory
 */
export function cleanTestDirectory(testDataPath: string): void {
  if (fs.existsSync(testDataPath)) {
    const files = fs.readdirSync(testDataPath);
    for (const file of files) {
      const filePath = path.join(testDataPath, file);
      fs.rmSync(filePath, { recursive: true, force: true });
    }
  }
}

/**
 * Create a sample prompt markdown file
 */
export function createSamplePrompt(
  testDataPath: string,
  title: string,
  category: string = 'general'
): string {
  const content = `---
id: "${generateTestId()}"
title: "${title}"
description: "A test prompt for E2E testing"
category: "${category}"
tags: ["test", "e2e"]
aiProvider: "anthropic"
isFavorite: false
isPinned: false
createdAt: "${new Date().toISOString()}"
updatedAt: "${new Date().toISOString()}"
version: 1
---

# ${title}

This is a sample prompt for testing purposes.

## Instructions

1. Step one
2. Step two
3. Step three
`;

  const fileName = `${title.toLowerCase().replace(/\s+/g, '-')}.md`;
  return createTestFile(testDataPath, fileName, content);
}

/**
 * Create a sample snippet markdown file
 */
export function createSampleSnippet(
  testDataPath: string,
  title: string,
  type: 'persona' | 'text' | 'code' | 'template',
  shortcut: string
): string {
  const typeExtension = {
    persona: '.persona.md',
    text: '.text.md',
    code: '.code.md',
    template: '.template.md',
  };

  const content = `---
id: "${generateTestId()}"
title: "${title}"
description: "A test ${type} snippet for E2E testing"
type: "${type}"
shortcut: "${shortcut}"
createdAt: "${new Date().toISOString()}"
updatedAt: "${new Date().toISOString()}"
---

# ${title}

This is a sample ${type} snippet for testing.

## Content

Sample content here.
`;

  const fileName = `${title.toLowerCase().replace(/\s+/g, '-')}${typeExtension[type]}`;
  return createTestFile(testDataPath, `snippets/${fileName}`, content);
}

/**
 * Wait for network to be idle
 */
export async function waitForNetworkIdle(page: Page, timeout: number = 5000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Wait for animations to complete
 */
export async function waitForAnimations(page: Page): Promise<void> {
  await page.waitForTimeout(300);
}

/**
 * Take a screenshot with timestamp
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: `tests/e2e/reports/screenshots/${name}-${timestamp}.png`,
    fullPage: true,
  });
}

/**
 * Get all visible text on the page
 */
export async function getPageText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.innerText);
}

/**
 * Check if an element is visible
 */
export async function isElementVisible(page: Page, selector: string): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { state: 'visible', timeout: 1000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if an element exists in the DOM
 */
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  const element = await page.$(selector);
  return element !== null;
}

/**
 * Get element attribute value
 */
export async function getElementAttribute(
  page: Page,
  selector: string,
  attribute: string
): Promise<string | null> {
  const element = await page.$(selector);
  if (!element) return null;
  return element.getAttribute(attribute);
}

/**
 * Retry an action until it succeeds or times out
 */
export async function retryAction<T>(
  action: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await action();
    } catch (error) {
      lastError = error as Error;
      await wait(delayMs);
    }
  }

  throw lastError;
}

/**
 * Mock file system for testing
 */
export class MockFileSystem {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  createFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  readFile(path: string): string | undefined {
    return this.files.get(path);
  }

  deleteFile(path: string): void {
    this.files.delete(path);
  }

  fileExists(path: string): boolean {
    return this.files.has(path);
  }

  createDirectory(path: string): void {
    this.directories.add(path);
  }

  directoryExists(path: string): boolean {
    return this.directories.has(path);
  }

  listFiles(): string[] {
    return Array.from(this.files.keys());
  }

  clear(): void {
    this.files.clear();
    this.directories.clear();
  }
}

/**
 * Test data generators
 */
export const TestData = {
  projects: {
    valid: {
      name: 'My Test Project',
      description: 'A project for testing purposes',
    },
    withSpecialChars: {
      name: 'Project with spaces',
      description: 'Contains spaces and punctuation!',
    },
    invalid: {
      name: 'Invalid<Project>Name',
      description: 'Contains invalid characters',
    },
  },

  prompts: {
    simple: {
      title: 'Simple Test Prompt',
      category: 'general',
      content: '# Simple Prompt\n\nThis is a simple test prompt.',
    },
    complex: {
      title: 'Complex Test Prompt',
      category: 'development',
      content: `# Complex Prompt

## Context
Detailed context here.

## Instructions
1. First step
2. Second step
3. Third step

## Expected Output
- Item 1
- Item 2
`,
    },
    withFrontmatter: {
      title: 'Prompt With Frontmatter',
      category: 'writing',
      tags: ['test', 'frontmatter', 'e2e'],
      content: '# Test\n\nContent here.',
    },
  },

  snippets: {
    persona: {
      title: 'Test Persona',
      type: 'persona' as const,
      shortcut: '@test-persona',
      content: 'You are a helpful test assistant.',
    },
    template: {
      title: 'Test Template',
      type: 'template' as const,
      shortcut: '!test-template',
      content: '## Template\n\n{{variable}}',
    },
    code: {
      title: 'Test Code',
      type: 'code' as const,
      shortcut: '$test-code',
      content: 'console.log("test");',
    },
    text: {
      title: 'Test Text',
      type: 'text' as const,
      shortcut: '#test-text',
      content: 'Sample text snippet.',
    },
  },

  git: {
    user: {
      name: 'Test User',
      email: 'test@example.com',
    },
    commits: {
      initial: 'Initial commit',
      feature: 'Add new feature',
      fix: 'Fix bug',
    },
    branches: {
      main: 'main',
      feature: 'feature/test',
      bugfix: 'bugfix/test',
    },
  },

  settings: {
    themes: ['light', 'dark', 'system'] as const,
    locales: ['en-US', 'es-ES', 'fr-FR', 'pt-BR', 'de-DE'] as const,
    categories: ['General', 'Development', 'Writing', 'Research', 'Creative'],
  },
};

/**
 * Assertion helpers
 */
export const Assertions = {
  /**
   * Assert that a toast notification appeared with specific text
   */
  async toastAppeared(page: Page, text: string): Promise<boolean> {
    try {
      const toast = page.locator('.q-notification', { hasText: text });
      await toast.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Assert that a dialog is visible
   */
  async dialogVisible(page: Page, testId: string): Promise<boolean> {
    try {
      await page.waitForSelector(`[data-testid="${testId}"]`, {
        state: 'visible',
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Assert that a dialog is hidden
   */
  async dialogHidden(page: Page, testId: string): Promise<boolean> {
    try {
      await page.waitForSelector(`[data-testid="${testId}"]`, {
        state: 'hidden',
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  },
};
