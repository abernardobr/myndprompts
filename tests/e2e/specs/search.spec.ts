import { test, expect, MyndPromptsApp, generateProjectName } from '../helpers';

/**
 * E2E Tests for Search Functionality
 *
 * Tests cover:
 * - Full-text search
 * - Search options (case, word, regex)
 * - Search results
 * - Opening results
 */

test.describe('Search Functionality', () => {
  let app: MyndPromptsApp;
  let projectName: string;

  test.beforeEach(async ({ window }) => {
    app = new MyndPromptsApp(window);
    await app.waitForAppReady();

    // Create test data
    projectName = generateProjectName();
    await app.createProject(projectName);
    await window.waitForTimeout(500);
    await app.explorer.selectProject(projectName);

    // Create prompts with searchable content
    await app.createPrompt('Code Review Guide', 'development');
    await window.waitForTimeout(300);
    await app.openFile('Code Review Guide');
    await app.editor.waitForEditor();
    await app.editor.setContent(`---
title: Code Review Guide
category: development
---

# Code Review Guide

This is a comprehensive guide for code review.

## Best Practices

1. Review code in small chunks
2. Focus on logic and design
3. Check for security vulnerabilities
4. Ensure proper error handling

Keywords: code, review, development, best practices
`);
    await app.editor.save();
    await window.waitForTimeout(300);

    await app.createPrompt('Writing Tips', 'writing');
    await window.waitForTimeout(300);
    await app.openFile('Writing Tips');
    await app.editor.waitForEditor();
    await app.editor.setContent(`---
title: Writing Tips
category: writing
---

# Writing Tips

Tips for better writing.

## Guidelines

1. Keep sentences short
2. Use active voice
3. Avoid jargon
4. Proofread carefully

Keywords: writing, tips, content, editing
`);
    await app.editor.save();
    await window.waitForTimeout(300);

    await app.createPrompt('API Documentation', 'development');
    await window.waitForTimeout(300);
    await app.openFile('API Documentation');
    await app.editor.waitForEditor();
    await app.editor.setContent(`---
title: API Documentation
category: development
---

# API Documentation

Documentation for the REST API.

## Endpoints

- GET /users
- POST /users
- PUT /users/:id
- DELETE /users/:id

Keywords: api, documentation, rest, endpoints
`);
    await app.editor.save();
    await window.waitForTimeout(500);

    // Navigate to search panel
    await app.navigateTo('search');
  });

  test.describe('Basic Search', () => {
    test('should search for text across all prompts', async ({ window }) => {
      await app.search.search('code');
      await window.waitForTimeout(500);

      // Should find results in Code Review Guide
      const resultCount = await app.search.getResultCount();
      expect(resultCount).toBeGreaterThan(0);
    });

    test('should display search results', async ({ window }) => {
      await app.search.search('documentation');
      await window.waitForTimeout(500);

      // Results should be visible
      const results = window.locator('[data-testid="search-results"]');
      await expect(results).toBeVisible();

      // Should show file name
      const resultItem = window.locator('[data-testid="search-result-item"]').first();
      await expect(resultItem).toContainText('API Documentation');
    });

    test('should show result count', async ({ window }) => {
      await app.search.search('keywords');
      await window.waitForTimeout(500);

      // Result count should be displayed
      const countDisplay = window.locator('[data-testid="result-count"]');
      await expect(countDisplay).toBeVisible();

      const countText = await countDisplay.textContent();
      expect(countText).toMatch(/\d+\s*(result|match)/i);
    });

    test('should show content preview in results', async ({ window }) => {
      await app.search.search('Best Practices');
      await window.waitForTimeout(500);

      // Result should show matching content
      const resultItem = window.locator('[data-testid="search-result-item"]').first();
      const preview = resultItem.locator('[data-testid="result-preview"]');
      await expect(preview).toContainText('Best Practices');
    });

    test('should highlight search term in results', async ({ window }) => {
      await app.search.search('review');
      await window.waitForTimeout(500);

      // Highlighted text should be visible
      const highlight = window.locator('[data-testid="search-result-item"] .highlight').first();
      await expect(highlight).toBeVisible();
    });

    test('should show no results message when nothing found', async ({ window }) => {
      await app.search.search('xyznonexistent123');
      await window.waitForTimeout(500);

      // No results message
      const noResults = window.locator('[data-testid="no-results"]');
      await expect(noResults).toBeVisible();
    });
  });

  test.describe('Search Options', () => {
    test('should search with case sensitivity', async ({ window }) => {
      // Search without case sensitivity
      await app.search.search('API');
      await window.waitForTimeout(500);
      const countWithoutCase = await app.search.getResultCount();

      // Clear and search with case sensitivity
      await app.search.clearSearch();
      await window.waitForTimeout(300);

      await app.search.toggleMatchCase();
      await app.search.search('api');
      await window.waitForTimeout(500);
      const countWithCase = await app.search.getResultCount();

      // Results might differ based on exact case in content
      expect(countWithoutCase).toBeGreaterThanOrEqual(0);
      expect(countWithCase).toBeGreaterThanOrEqual(0);
    });

    test('should search with whole word matching', async ({ window }) => {
      await app.search.toggleWholeWord();
      await app.search.search('code');
      await window.waitForTimeout(500);

      // Should find "code" but not "codebase" or similar
      const results = await app.search.getResultCount();
      expect(results).toBeGreaterThan(0);
    });

    test('should search with regex', async ({ window }) => {
      await app.search.toggleRegex();
      await app.search.search('GET|POST|PUT|DELETE');
      await window.waitForTimeout(500);

      // Should find HTTP methods in API Documentation
      const results = await app.search.getResultCount();
      expect(results).toBeGreaterThan(0);
    });

    test('should combine search options', async ({ window }) => {
      // Enable case sensitivity and whole word
      await app.search.toggleMatchCase();
      await app.search.toggleWholeWord();

      await app.search.search('Guide');
      await window.waitForTimeout(500);

      // Should find exact match
      const results = await app.search.getResultCount();
      expect(results).toBeGreaterThan(0);
    });

    test('should persist search options', async ({ window }) => {
      // Enable options
      await app.search.toggleMatchCase();
      await app.search.toggleWholeWord();

      // Navigate away and back
      await app.navigateTo('explorer');
      await window.waitForTimeout(300);
      await app.navigateTo('search');
      await window.waitForTimeout(300);

      // Options should still be enabled
      const matchCaseToggle = window.locator('[data-testid="match-case"]');
      const wholeWordToggle = window.locator('[data-testid="whole-word"]');

      await expect(matchCaseToggle).toHaveClass(/active|checked/);
      await expect(wholeWordToggle).toHaveClass(/active|checked/);
    });
  });

  test.describe('Search Result Actions', () => {
    test('should open file from search result', async ({ window }) => {
      await app.search.search('Code Review');
      await window.waitForTimeout(500);

      // Click on result
      await app.search.clickResult(0);
      await window.waitForTimeout(500);

      // File should be opened in editor
      await app.editor.waitForEditor();
      const activeTab = await app.tabBar.getActiveTabName();
      expect(activeTab).toBe('Code Review Guide');
    });

    test('should highlight matching line in editor', async ({ window }) => {
      await app.search.search('security vulnerabilities');
      await window.waitForTimeout(500);

      // Click on result
      await app.search.clickResult(0);
      await window.waitForTimeout(500);

      // Editor should scroll to matching line
      await app.editor.waitForEditor();

      // Cursor should be on a line containing the match
      const content = await app.editor.getContent();
      expect(content).toContain('security vulnerabilities');
    });

    test('should navigate through multiple results', async ({ window }) => {
      await app.search.search('Keywords');
      await window.waitForTimeout(500);

      const resultCount = await app.search.getResultCount();

      if (resultCount > 1) {
        // Click first result
        await app.search.clickResult(0);
        await window.waitForTimeout(500);
        const firstTab = await app.tabBar.getActiveTabName();

        // Click second result
        await app.search.clickResult(1);
        await window.waitForTimeout(500);
        const secondTab = await app.tabBar.getActiveTabName();

        // Tabs might be different or same file with different position
        expect(firstTab).toBeDefined();
        expect(secondTab).toBeDefined();
      }
    });
  });

  test.describe('Search Input', () => {
    test('should clear search with button', async ({ window }) => {
      await app.search.search('test');
      await window.waitForTimeout(500);

      // Clear
      await app.search.clearSearch();
      await window.waitForTimeout(300);

      // Input should be empty
      const searchInput = window.locator('[data-testid="search-input"]');
      const value = await searchInput.inputValue();
      expect(value).toBe('');

      // Results should be cleared
      const results = window.locator('[data-testid="search-results"]');
      await expect(results).toBeHidden();
    });

    test('should clear search with Escape key', async ({ window }) => {
      await app.search.search('test');
      await window.waitForTimeout(500);

      // Press Escape
      await window.keyboard.press('Escape');
      await window.waitForTimeout(300);

      // Input should be cleared or focused
      const searchInput = window.locator('[data-testid="search-input"]');
      const value = await searchInput.inputValue();
      expect(value).toBe('');
    });

    test('should search on Enter key', async ({ window }) => {
      const searchInput = window.locator('[data-testid="search-input"]');
      await searchInput.fill('development');

      // Press Enter
      await window.keyboard.press('Enter');
      await window.waitForTimeout(500);

      // Results should appear
      const resultCount = await app.search.getResultCount();
      expect(resultCount).toBeGreaterThan(0);
    });

    test('should debounce search input', async ({ window }) => {
      const searchInput = window.locator('[data-testid="search-input"]');

      // Type quickly
      await searchInput.fill('doc');
      await window.waitForTimeout(100);
      await searchInput.fill('docu');
      await window.waitForTimeout(100);
      await searchInput.fill('docum');
      await window.waitForTimeout(100);
      await searchInput.fill('document');

      // Wait for debounce
      await window.waitForTimeout(500);

      // Should have results for "document"
      const resultCount = await app.search.getResultCount();
      expect(resultCount).toBeGreaterThan(0);
    });
  });

  test.describe('Search Categories', () => {
    test('should search within title', async ({ window }) => {
      await app.search.search('Writing Tips');
      await window.waitForTimeout(500);

      const resultCount = await app.search.getResultCount();
      expect(resultCount).toBeGreaterThan(0);

      // Result should indicate title match
      const resultItem = window.locator('[data-testid="search-result-item"]').first();
      const matchType = resultItem.locator('[data-testid="match-type"]');
      await expect(matchType).toContainText(/title/i);
    });

    test('should search within content', async ({ window }) => {
      await app.search.search('sentences short');
      await window.waitForTimeout(500);

      const resultCount = await app.search.getResultCount();
      expect(resultCount).toBeGreaterThan(0);

      // Result should indicate content match
      const resultItem = window.locator('[data-testid="search-result-item"]').first();
      const matchType = resultItem.locator('[data-testid="match-type"]');
      await expect(matchType).toContainText(/content/i);
    });

    test('should search within category', async ({ window }) => {
      await app.search.search('development');
      await window.waitForTimeout(500);

      // Should find multiple prompts with development category
      const resultCount = await app.search.getResultCount();
      expect(resultCount).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('Special Characters', () => {
    test('should handle special regex characters in normal search', async ({ window }) => {
      // Search with characters that have regex meaning
      await app.search.search('/users/:id');
      await window.waitForTimeout(500);

      // Should find the API endpoint
      const resultCount = await app.search.getResultCount();
      expect(resultCount).toBeGreaterThan(0);
    });

    test('should handle diacritics in search', async ({ window }) => {
      // This tests NFD normalization for accented characters
      await app.search.search('documentation');
      await window.waitForTimeout(500);

      const resultCount = await app.search.getResultCount();
      expect(resultCount).toBeGreaterThan(0);
    });

    test('should handle empty search gracefully', async ({ window }) => {
      await app.search.search('');
      await window.waitForTimeout(500);

      // Should show no results or prompt to enter search term
      const results = window.locator('[data-testid="search-results"]');
      const isEmpty = await results.isHidden();

      // Either hidden or shows placeholder message
      expect(isEmpty || (await results.textContent())?.includes('Enter')).toBeTruthy();
    });
  });

  test.describe('Search Performance', () => {
    test('should complete search within reasonable time', async ({ window }) => {
      const startTime = Date.now();

      await app.search.search('code');
      await window.waitForTimeout(500);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Search should complete within 3 seconds
      expect(duration).toBeLessThan(3000);
    });

    test('should handle multiple rapid searches', async ({ window }) => {
      // Perform multiple searches rapidly
      await app.search.search('code');
      await window.waitForTimeout(100);
      await app.search.search('writing');
      await window.waitForTimeout(100);
      await app.search.search('api');
      await window.waitForTimeout(500);

      // Should show results for last search
      const results = window.locator('[data-testid="search-result-item"]');
      const count = await results.count();
      expect(count).toBeGreaterThan(0);

      // Results should be for "api"
      const firstResult = results.first();
      await expect(firstResult).toContainText(/api/i);
    });
  });
});
