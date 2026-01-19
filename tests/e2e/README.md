# MyndPrompts E2E Tests

End-to-end tests for the MyndPrompts Electron application using Playwright.

## Overview

This test suite provides comprehensive E2E coverage for the MyndPrompts desktop application, testing all major features including:

- **Project Management** - Create, rename, delete projects
- **Prompt Management** - Create, edit, save, delete prompts
- **Snippet Management** - Create and manage snippets with autocomplete
- **Git Operations** - Initialize, commit, branch, push, pull
- **UI Interactions** - Activity bar, sidebar, tabs, panels
- **Settings** - Theme, language, categories
- **Search** - Full-text search with options
- **Editor** - Monaco editor operations

## Prerequisites

1. **Node.js 20+** installed
2. **Application built** - Run `npm run build:electron` first
3. **Playwright installed** - Run `npm install` to install dependencies

## Running Tests

### Install Dependencies

```bash
npm install
npx playwright install
```

### Run All Tests

```bash
npm run test:e2e
```

### Run with UI Mode (Interactive)

```bash
npm run test:e2e:ui
```

### Run in Headed Mode (See Browser)

```bash
npm run test:e2e:headed
```

### Run with Debug Mode

```bash
npm run test:e2e:debug
```

### View Test Report

```bash
npm run test:e2e:report
```

### Run Specific Test File

```bash
npx playwright test tests/e2e/specs/project.spec.ts
```

### Run Tests by Tag/Name

```bash
npx playwright test -g "Project Management"
```

## Project Structure

```
tests/e2e/
├── fixtures/                 # Test data and fixtures
│   ├── test-prompts.ts      # Sample prompt data
│   └── test-data/           # Generated test files
├── helpers/                  # Test utilities
│   ├── electron-fixture.ts  # Electron app fixture
│   ├── global-setup.ts      # Pre-test setup
│   ├── global-teardown.ts   # Post-test cleanup
│   ├── page-objects.ts      # Page Object Models
│   ├── test-utils.ts        # Utility functions
│   └── index.ts             # Exports
├── reports/                  # Test reports (generated)
│   ├── html/                # HTML report
│   ├── artifacts/           # Screenshots, videos
│   └── results.json         # JSON results
├── specs/                    # Test specifications
│   ├── project.spec.ts      # Project management tests
│   ├── prompt.spec.ts       # Prompt management tests
│   ├── snippet.spec.ts      # Snippet management tests
│   ├── git.spec.ts          # Git operations tests
│   ├── ui.spec.ts           # UI interaction tests
│   ├── settings.spec.ts     # Settings tests
│   ├── search.spec.ts       # Search functionality tests
│   └── editor.spec.ts       # Editor tests
└── README.md                # This file
```

## Page Object Models

The test suite uses Page Object Models (POM) for maintainable tests:

```typescript
import { test, expect, MyndPromptsApp } from '../helpers';

test('example test', async ({ window }) => {
  const app = new MyndPromptsApp(window);
  await app.waitForAppReady();

  // Navigate and interact
  await app.navigateTo('explorer');
  await app.createProject('My Project');
  await app.createPrompt('My Prompt', 'general');

  // Verify
  const promptItem = window.locator('[data-testid="file-item"]');
  await expect(promptItem).toBeVisible();
});
```

### Available Page Objects

- **MyndPromptsApp** - Main application wrapper
- **ActivityBar** - Navigation bar
- **Sidebar** - Collapsible side panel
- **ExplorerPanel** - File/project browser
- **SearchPanel** - Search functionality
- **SnippetsPanel** - Snippet management
- **FavoritesPanel** - Favorite prompts
- **GitPanel** - Git operations
- **SettingsPanel** - Application settings
- **TabBar** - Tab management
- **Editor** - Monaco editor wrapper
- **StatusBar** - Bottom status bar
- **BottomPanel** - Output/problems panels
- **Dialogs** - Dialog interactions

## Test Data

Test data is available in `fixtures/test-prompts.ts`:

```typescript
import { testPrompts, generatePromptMarkdown } from '../fixtures/test-prompts';

// Use predefined prompts
const prompt = testPrompts.codeReview;

// Generate markdown with frontmatter
const markdown = generatePromptMarkdown(prompt);
```

## Utilities

Common utilities in `helpers/test-utils.ts`:

```typescript
import {
  generateProjectName,
  generatePromptName,
  generateSnippetName,
  TestData,
  wait,
  retryAction,
} from '../helpers';

// Generate unique names
const projectName = generateProjectName(); // "Test Project test-1234567890-abc123"

// Use test data
const user = TestData.git.user; // { name: 'Test User', email: 'test@example.com' }

// Wait utilities
await wait(1000);

// Retry flaky actions
await retryAction(() => element.click(), 3, 500);
```

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect, MyndPromptsApp } from '../helpers';

test.describe('Feature Name', () => {
  let app: MyndPromptsApp;

  test.beforeEach(async ({ window }) => {
    app = new MyndPromptsApp(window);
    await app.waitForAppReady();
  });

  test('should do something', async ({ window }) => {
    // Arrange
    await app.createProject('Test Project');

    // Act
    await app.explorer.clickNewPrompt();

    // Assert
    await expect(window.locator('[data-testid="new-prompt-dialog"]')).toBeVisible();
  });
});
```

### Test Fixtures

The custom Electron fixture provides:

- `electronApp` - The Electron Application instance
- `window` - The main browser window (Page)
- `testDataPath` - Path to test data directory

### Assertions

Use Playwright's expect with auto-waiting:

```typescript
// Element visibility
await expect(element).toBeVisible();
await expect(element).toBeHidden();

// Text content
await expect(element).toContainText('expected');
await expect(element).toHaveText('exact text');

// Attributes
await expect(element).toHaveClass(/active/);
await expect(element).toHaveAttribute('data-name', 'value');

// Count
const items = window.locator('[data-testid="item"]');
await expect(items).toHaveCount(5);
```

## Configuration

Playwright configuration is in `playwright.config.ts`:

```typescript
export default defineConfig({
  testDir: './tests/e2e/specs',
  timeout: 60000,
  workers: 1, // Sequential for Electron
  reporter: [['html'], ['json'], ['list']],
  use: {
    actionTimeout: 15000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
});
```

## Data Test IDs

Tests rely on `data-testid` attributes. Key patterns:

| Component        | Test ID Pattern         |
| ---------------- | ----------------------- |
| Activity buttons | `activity-{name}`       |
| Panels           | `{name}-panel`          |
| Dialogs          | `{name}-dialog`         |
| Buttons          | `{name}-btn`            |
| Inputs           | `{name}-input`          |
| Items            | `{type}-item`           |
| Context menu     | `context-menu-{action}` |

## Debugging

### Pause Test Execution

```typescript
test('debug example', async ({ window }) => {
  await window.pause(); // Opens Playwright Inspector
});
```

### Take Screenshots

```typescript
await window.screenshot({ path: 'screenshot.png' });
```

### Slow Down Execution

```bash
PWDEBUG=1 npm run test:e2e
```

### View Trace

```bash
npx playwright show-trace tests/e2e/reports/artifacts/trace.zip
```

## CI/CD Integration

For CI environments:

```bash
# Install browsers
npx playwright install --with-deps

# Run tests
npm run test:e2e

# Tests will retry on failure (configured in playwright.config.ts)
```

## Troubleshooting

### App Not Found

Ensure the app is built:

```bash
npm run build:electron
```

### Tests Timeout

- Increase timeout in config
- Check if app is loading correctly
- Use `--debug` mode to investigate

### Flaky Tests

- Add explicit waits for async operations
- Use `retryAction` utility for flaky interactions
- Check for race conditions in state updates

### Element Not Found

- Verify `data-testid` attributes in source code
- Check if element is inside shadow DOM
- Use Playwright Inspector to debug selectors

## Contributing

When adding new tests:

1. Use Page Object Models for reusability
2. Add `data-testid` attributes to new components
3. Follow existing naming conventions
4. Include both positive and negative test cases
5. Clean up test data in afterEach/afterAll hooks
