# AI Integration Architecture

This document describes the architecture of the AI integration system in MyndPrompts. It covers API key management, model configuration, provider APIs, and the data flow between Electron's main process and the renderer.

---

## Table of Contents

1. [Overview](#overview)
2. [Supported Providers](#supported-providers)
3. [Architecture Layers](#architecture-layers)
4. [API Key Management](#api-key-management)
5. [Model Fetching](#model-fetching)
6. [Data Model](#data-model)
7. [IPC Communication](#ipc-communication)
8. [Pinia Store](#pinia-store)
9. [UI Components](#ui-components)
10. [Adding a New Provider](#adding-a-new-provider)
11. [File Reference](#file-reference)

---

## Overview

The AI integration allows users to:

- Configure API keys for cloud AI providers (Anthropic, OpenAI, Google, Groq)
- Connect to local Ollama instances
- Fetch available models dynamically from each provider's API
- Build a curated list of configured models
- Set a default model for chat interactions

**Key design principles:**

- **API keys never leave the main process.** Keys are encrypted and stored on disk. The renderer process never sees raw keys.
- **Models are fetched dynamically.** There is no hardcoded model list. The app queries each provider's API to get the current model catalog.
- **Separation of concerns.** Provider metadata (icons, docs URLs) lives in constants. Persistent state lives in IndexedDB. Secrets live in encrypted storage. API calls happen in the main process.

---

## Supported Providers

| Provider  | Type        | Requires API Key |            Requires Base URL            | API Endpoint                                              |
| --------- | ----------- | :--------------: | :-------------------------------------: | --------------------------------------------------------- |
| Anthropic | `anthropic` |       Yes        |                   No                    | `https://api.anthropic.com/v1/models`                     |
| OpenAI    | `openai`    |       Yes        |                   No                    | `https://api.openai.com/v1/models`                        |
| Google    | `google`    |       Yes        |                   No                    | `https://generativelanguage.googleapis.com/v1beta/models` |
| Groq      | `groq`      |       Yes        |                   No                    | `https://api.groq.com/openai/v1/models`                   |
| Ollama    | `ollama`    |        No        | Yes (default: `http://localhost:11434`) | `{baseUrl}/api/tags`                                      |

Provider metadata is defined in `src/constants/ai-providers.ts`:

```typescript
export interface IAIProviderMeta {
  type: AIProviderType;
  icon: string; // Material icon name
  requiresApiKey: boolean;
  requiresBaseUrl: boolean;
  defaultBaseUrl?: string;
  docsUrl: string;
}
```

The `AI_PROVIDER_ORDER` array defines the display order in the UI.

---

## Architecture Layers

```
+------------------------------------------------------------------+
|                        UI (Vue 3 + Quasar)                       |
|  AIIntegrationSection  |  AddModelWizard  |  ConfiguredModelsList |
+------------------------------------------------------------------+
|                      Pinia Store (aiProviderStore)                |
|  State: providers[], configuredModels[], isInitialized, isLoading |
|  Actions: saveApiKey, deleteApiKey, fetchProviderModels,          |
|           addModel, removeModel, setDefaultModel                  |
+------------------------------------------------------------------+
|                    Preload (contextBridge)                        |
|  window.secureStorageAPI  |  window.aiModelsAPI                  |
+------------------------------------------------------------------+
|                    IPC (ipcMain.handle)                           |
|  secure-storage:*         |  ai-models:fetch                     |
+------------------------------------------------------------------+
|                 Electron Main Process Services                    |
|  SecureStorageService     |  AIModelFetcherService                |
+------------------------------------------------------------------+
|                      IndexedDB (Dexie.js)                        |
|  aiProviders table        |  configuredModels table               |
+------------------------------------------------------------------+
|                   Encrypted File Storage                          |
|  {userData}/secure-keys.json (OS-level encryption)                |
+------------------------------------------------------------------+
```

---

## API Key Management

### Storage

API keys are managed by the `SecureStorageService` singleton, which runs exclusively in the Electron main process.

**File:** `src/electron/main/services/secure-storage.service.ts`

**Storage location:** `{app.getPath('userData')}/secure-keys.json`

**Encryption strategy:**

1. **Primary (recommended):** Uses Electron's `safeStorage.encryptString()` / `safeStorage.decryptString()`. This leverages OS-level credential storage:
   - macOS: Keychain
   - Windows: DPAPI
   - Linux: libsecret / kwallet
2. **Fallback:** If OS encryption is unavailable, keys are base64-encoded with a `plain:` prefix. A warning is logged.

**Data format on disk:**

```json
{
  "anthropic": "<base64-encrypted-key>",
  "openai": "<base64-encrypted-key>",
  "ollama": "plain:<base64-encoded-key>"
}
```

### API

The `SecureStorageService` exposes four methods:

| Method                      | Description                            |
| --------------------------- | -------------------------------------- |
| `saveApiKey(provider, key)` | Encrypts and persists a key            |
| `getApiKey(provider)`       | Decrypts and returns a key (or `null`) |
| `deleteApiKey(provider)`    | Removes a key from the store           |
| `hasApiKey(provider)`       | Checks if a key exists                 |

### IPC Exposure

These methods are exposed to the renderer via IPC handlers and the preload script:

```
Renderer                    Preload (contextBridge)              Main Process
---------                   -----------------------              ------------
window.secureStorageAPI  -> ipcRenderer.invoke(channel, args) -> ipcMain.handle(channel)
  .saveApiKey(p, k)            'secure-storage:save-api-key'       SecureStorageService
  .getApiKey(p)                'secure-storage:get-api-key'            .saveApiKey()
  .deleteApiKey(p)             'secure-storage:delete-api-key'         .getApiKey()
  .hasApiKey(p)                'secure-storage:has-api-key'            .deleteApiKey()
                                                                       .hasApiKey()
```

**Interface (defined in preload):**

```typescript
interface SecureStorageAPI {
  saveApiKey: (provider: string, key: string) => Promise<void>;
  getApiKey: (provider: string) => Promise<string | null>;
  deleteApiKey: (provider: string) => Promise<boolean>;
  hasApiKey: (provider: string) => Promise<boolean>;
}
```

### Key Presence Tracking

IndexedDB tracks _whether_ a provider has a key configured (the `hasApiKey` boolean on `IAIProviderConfig`), but never the key itself. When a key is saved or deleted via the store, the `hasApiKey` flag is updated in parallel.

---

## Model Fetching

### Service

Model fetching is handled by the `AIModelFetcherService` singleton in the main process.

**File:** `src/electron/main/services/ai-model-fetcher.service.ts`

**Key characteristics:**

- Retrieves API keys internally via `SecureStorageService.getApiKey()` (keys never cross IPC)
- Uses Node's built-in `fetch` (Electron >= 28)
- 10-second timeout via `AbortController`
- Returns a standardized `IFetchModelsResult`

### Provider-Specific Logic

| Provider      | Auth Method                                          | Model Filtering                                                                     |
| ------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **OpenAI**    | `Authorization: Bearer <key>`                        | Filters to chat models (prefixes: `gpt-4`, `gpt-3.5`, `o1`, `o3`, `o4`, `chatgpt-`) |
| **Anthropic** | `x-api-key: <key>` + `anthropic-version: 2023-06-01` | Returns all models from `/v1/models`                                                |
| **Google**    | Query param `?key=<key>`                             | Filters to models supporting `generateContent`. Strips `models/` prefix.            |
| **Groq**      | `Authorization: Bearer <key>`                        | Returns all models from OpenAI-compatible endpoint                                  |
| **Ollama**    | None (local)                                         | Returns all models from `/api/tags`                                                 |

### Return Type

```typescript
interface IFetchModelsResult {
  success: boolean;
  models: IProviderModel[];
  error?: string;
}

interface IProviderModel {
  id: string; // e.g. 'claude-sonnet-4-20250514'
  name: string; // display name
  provider: AIProviderType;
}
```

### IPC Exposure

```
Renderer                    Preload                          Main Process
---------                   -------                          ------------
window.aiModelsAPI       -> ipcRenderer.invoke               -> ipcMain.handle
  .fetchModels(p, url?)     'ai-models:fetch', p, url?         AIModelFetcherService
                                                                  .fetchModels(p, url?)
```

**Interface:**

```typescript
interface AIModelsAPI {
  fetchModels: (
    provider: string,
    baseUrl?: string
  ) => Promise<{
    success: boolean;
    models: Array<{ id: string; name: string; provider: string }>;
    error?: string;
  }>;
}
```

---

## Data Model

### IndexedDB Schema (Dexie.js)

**Database:** `MyndPromptDB` (file: `src/services/storage/db.ts`)

**Current version:** 6

#### `aiProviders` table

Stores provider configuration metadata. API keys are NOT stored here.

```typescript
interface IAIProviderConfig {
  id: string; // UUID primary key
  provider: AIProviderType; // 'anthropic' | 'openai' | 'google' | 'groq' | 'ollama'
  hasApiKey: boolean; // Whether an API key exists in secure storage
  baseUrl?: string; // Custom base URL (used by Ollama)
  // Legacy fields (kept for migration compatibility):
  defaultModel?: string;
  isEnabled?: boolean;
  lastUsedAt?: Date;
}
```

**Indexes:** `id`, `provider`

**Initialization:** On first run, `AIProvidersRepository.initializeDefaults()` creates entries for all 5 providers with `hasApiKey: false`.

#### `configuredModels` table

Stores the user's curated list of AI models.

```typescript
interface IConfiguredModel {
  id: string; // UUID primary key
  provider: AIProviderType;
  modelId: string; // Provider's model identifier (e.g. 'claude-sonnet-4-20250514')
  modelName: string; // Display name
  isDefault: boolean; // Only one model can be default
  addedAt: Date; // Auto-set by Dexie hook
}
```

**Indexes:** `&id`, `provider`, `modelId`, `isDefault`, `addedAt`

### Migration (v5 -> v6)

The v6 migration:

1. Creates the `configuredModels` table
2. Removes the `isEnabled` index from `aiProviders`
3. Migrates existing data: for each provider that had `isEnabled: true` and a `defaultModel`, creates a `configuredModel` entry. The first migrated model becomes the default.

### Repositories

Both tables use the Repository pattern (extending `BaseRepository<T, K>`).

#### `AIProvidersRepository`

**File:** `src/services/storage/repositories/ai-providers.repository.ts`

| Method                     | Description                                        |
| -------------------------- | -------------------------------------------------- |
| `initializeDefaults()`     | Creates default provider entries if table is empty |
| `getByProvider(type)`      | Get config for a specific provider                 |
| `setHasApiKey(type, has)`  | Update the key presence flag                       |
| `setBaseUrl(type, url)`    | Update base URL (Ollama)                           |
| `getConfiguredProviders()` | Get providers that have API keys                   |

#### `ConfiguredModelsRepository`

**File:** `src/services/storage/repositories/configured-models.repository.ts`

| Method                                   | Description                                                        |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `addModel(provider, modelId, modelName)` | Add a model. First model becomes default.                          |
| `removeModel(id)`                        | Remove a model. If it was default, the next model becomes default. |
| `getDefaultModel()`                      | Get the current default model                                      |
| `setDefaultModel(id)`                    | Set a model as default (transaction: unsets all others first)      |
| `modelExists(provider, modelId)`         | Check if a model is already configured                             |
| `getByProvider(provider)`                | Get all models for a provider                                      |

---

## IPC Communication

All AI-related IPC channels:

| Channel                         | Direction        | Description                    |
| ------------------------------- | ---------------- | ------------------------------ |
| `secure-storage:save-api-key`   | Renderer -> Main | Save encrypted API key         |
| `secure-storage:get-api-key`    | Renderer -> Main | Retrieve decrypted API key     |
| `secure-storage:delete-api-key` | Renderer -> Main | Delete API key                 |
| `secure-storage:has-api-key`    | Renderer -> Main | Check key existence            |
| `ai-models:fetch`               | Renderer -> Main | Fetch models from provider API |

**CRITICAL:** IPC handlers must be registered in **both** Electron entry points:

- `src/electron/main/index.ts` (development)
- `src-electron/electron-main.ts` (production/Quasar build)

Both files import the same service singletons from `src/electron/main/services/`.

---

## Pinia Store

**File:** `src/stores/aiProviderStore.ts`

The `aiProviders` store is the single source of truth for the renderer process.

### State

| Property           | Type                  | Description                            |
| ------------------ | --------------------- | -------------------------------------- |
| `providers`        | `IAIProviderConfig[]` | All provider configs from IndexedDB    |
| `configuredModels` | `IConfiguredModel[]`  | User's configured models               |
| `isInitialized`    | `boolean`             | Whether `initialize()` has been called |
| `isLoading`        | `boolean`             | Loading state                          |

### Computed

| Getter                | Description                                           |
| --------------------- | ----------------------------------------------------- |
| `configuredProviders` | Providers with API keys (or those not requiring keys) |
| `orderedProviders`    | Providers in display order                            |
| `defaultModel`        | The current default model                             |
| `modelsByProvider`    | Models grouped by provider type                       |
| `orderedModels`       | Models sorted: default first, then by `addedAt`       |

### Actions

| Action                                    | Description                                               |
| ----------------------------------------- | --------------------------------------------------------- |
| `initialize()`                            | Load providers and models from DB (called once on mount)  |
| `refreshProviders()`                      | Reload provider configs from DB                           |
| `refreshConfiguredModels()`               | Reload models from DB                                     |
| `saveApiKey(provider, key)`               | Save key via `secureStorageAPI` + update `hasApiKey` flag |
| `deleteApiKey(provider)`                  | Delete key + update flag                                  |
| `getApiKey(provider)`                     | Retrieve key from secure storage                          |
| `setBaseUrl(provider, url)`               | Update base URL in DB                                     |
| `getProviderConfig(provider)`             | Get config from reactive state                            |
| `fetchProviderModels(provider, baseUrl?)` | Fetch models via `aiModelsAPI` IPC                        |
| `addModel(provider, modelId, name)`       | Add model to configured list                              |
| `removeModel(id)`                         | Remove a configured model                                 |
| `setDefaultModel(id)`                     | Set model as default                                      |
| `modelExists(provider, modelId)`          | Check if model already configured                         |

### Data Flow: Saving an API Key

```
1. User enters key in UI
2. Store.saveApiKey(provider, key)
   a. window.secureStorageAPI.saveApiKey(provider, key)
      -> IPC -> SecureStorageService.saveApiKey() -> encrypts -> writes to disk
   b. providerRepo.setHasApiKey(provider, true)
      -> updates IndexedDB
   c. refreshProviders()
      -> re-reads all providers from IndexedDB -> updates reactive state
3. UI updates automatically via Vue reactivity
```

### Data Flow: Fetching and Adding a Model

```
1. User selects provider in wizard, enters/confirms API key
2. Store.fetchProviderModels(provider, baseUrl)
   -> window.aiModelsAPI.fetchModels(provider, baseUrl)
   -> IPC -> AIModelFetcherService.fetchModels()
      -> SecureStorageService.getApiKey(provider) [internal, no IPC]
      -> HTTP GET to provider API
      -> Returns { success, models[], error? }
3. UI displays model list
4. User clicks "Add" on a model
5. Store.addModel(provider, modelId, modelName)
   -> ConfiguredModelsRepository.addModel()
      -> Creates IConfiguredModel in IndexedDB
      -> First model auto-becomes default
   -> refreshConfiguredModels()
6. Model appears in ConfiguredModelsList via reactivity
```

---

## UI Components

### AIIntegrationSection

**File:** `src/components/settings/AIIntegrationSection.vue`

The main settings section. Has three rendering states:

1. **Loading** (`aiStore.isLoading`): Shows a spinner
2. **Wizard active** (`showWizard`): Renders `AddModelWizard` inline, hiding all other content
3. **Main content** (default): Shows description, models header with "Add Model" button, `ConfiguredModelsList`, and a collapsible API Keys section

The API Keys section (`q-expansion-item`) shows per-provider key status:

- Providers with keys: shows a masked indicator + delete button
- Providers without keys: shows an input field + save button
- Ollama: shows "No API key required" hint

### AddModelWizard

**File:** `src/components/dialogs/AddModelDialog.vue`

An inline 3-step wizard (not a dialog). When active, it replaces the main AI Integration content.

**Step 1 - Select Provider:** Grid of clickable provider cards showing icons and names.

**Step 2 - API Key / Base URL:**

- If provider requires API key and one exists: shows "Already configured" + Continue
- If provider requires API key and none exists: shows key input + Save & Continue
- If provider is Ollama (no key): shows base URL input + Continue

**Step 3 - Select Models:**

- Fetches models on step enter
- Shows searchable list (search appears when > 5 models)
- Each model shows Add button or "Already added" badge
- Back button returns to step 2, Done closes the wizard

**Events emitted:** `close`, `modelAdded`

### ConfiguredModelsList

**File:** `src/components/settings/ConfiguredModelsList.vue`

Displays the user's configured models.

- **Empty state:** Icon + "No models configured yet" message
- **Model list:** Each row shows provider icon, model name, provider name. Actions: "Set as default" button, "Default" badge, delete button with confirmation dialog.
- Models are sorted via `aiStore.orderedModels` (default first, then by add date).

---

## Adding a New Provider

To add a new AI provider (e.g., `mistral`), follow these steps:

### 1. Update the type union

**File:** `src/services/storage/entities.ts`

```typescript
export type AIProviderType = 'anthropic' | 'openai' | 'google' | 'groq' | 'ollama' | 'mistral';
```

Add a default config entry:

```typescript
export const DEFAULT_AI_PROVIDERS: Omit<IAIProviderConfig, 'id'>[] = [
  // ... existing providers
  { provider: 'mistral', hasApiKey: false },
];
```

### 2. Add provider metadata

**File:** `src/constants/ai-providers.ts`

```typescript
export const AI_PROVIDER_META: Record<AIProviderType, IAIProviderMeta> = {
  // ... existing providers
  mistral: {
    type: 'mistral',
    icon: 'air',
    requiresApiKey: true,
    requiresBaseUrl: false,
    docsUrl: 'https://docs.mistral.ai/',
  },
};

export const AI_PROVIDER_ORDER: AIProviderType[] = [
  'anthropic',
  'openai',
  'google',
  'groq',
  'ollama',
  'mistral',
];
```

### 3. Add the fetcher

**File:** `src/electron/main/services/ai-model-fetcher.service.ts`

Add a case in `fetchModels()` and implement the fetch method:

```typescript
case 'mistral':
  return await this.fetchMistralModels();
```

```typescript
private async fetchMistralModels(): Promise<IFetchModelsResult> {
  const apiKey = await this.getKey('mistral');
  if (!apiKey) return { success: false, models: [], error: 'No API key for Mistral' };

  const res = await this.httpGet('https://api.mistral.ai/v1/models', {
    Authorization: `Bearer ${apiKey}`,
  });

  const body = JSON.parse(res) as { data: Array<{ id: string }> };
  const models = body.data.map((m) => ({
    id: m.id, name: m.id, provider: 'mistral' as AIProviderType,
  }));

  return { success: true, models };
}
```

### 4. Add i18n translations

**All 10 locale files** in `src/i18n/*/index.ts`:

```typescript
ai: {
  providers: {
    // ... existing
    mistral: 'Mistral',
  },
}
```

### 5. Database migration (if needed)

If the new provider needs to be present for existing users, create a new Dexie version in `src/services/storage/db.ts` with an upgrade that inserts the new provider row.

For brand-new installs, `AIProvidersRepository.initializeDefaults()` handles it automatically since it reads from `DEFAULT_AI_PROVIDERS`.

---

## File Reference

| File                                                                | Layer        | Purpose                                                   |
| ------------------------------------------------------------------- | ------------ | --------------------------------------------------------- |
| `src/services/ai-models/types.ts`                                   | Shared       | `IProviderModel`, `IFetchModelsResult` types              |
| `src/electron/main/services/secure-storage.service.ts`              | Main Process | Encrypts/decrypts API keys using OS keychain              |
| `src/electron/main/services/ai-model-fetcher.service.ts`            | Main Process | Fetches models from provider APIs                         |
| `src/electron/main/index.ts`                                        | Main Process | IPC handlers (dev entry point)                            |
| `src-electron/electron-main.ts`                                     | Main Process | IPC handlers (production entry point)                     |
| `src/electron/preload/index.ts`                                     | Preload      | `SecureStorageAPI` and `AIModelsAPI` bridge interfaces    |
| `src/services/storage/entities.ts`                                  | Data         | `IAIProviderConfig`, `IConfiguredModel`, `AIProviderType` |
| `src/services/storage/db.ts`                                        | Data         | Dexie DB schema, v6 migration for `configuredModels`      |
| `src/services/storage/repositories/ai-providers.repository.ts`      | Data         | CRUD for provider configs                                 |
| `src/services/storage/repositories/configured-models.repository.ts` | Data         | CRUD for configured models                                |
| `src/stores/aiProviderStore.ts`                                     | Store        | Pinia store combining all AI state and actions            |
| `src/constants/ai-providers.ts`                                     | Constants    | Provider metadata (icons, URLs, requirements)             |
| `src/components/settings/AIIntegrationSection.vue`                  | UI           | Main settings section                                     |
| `src/components/dialogs/AddModelDialog.vue`                         | UI           | 3-step wizard for adding models                           |
| `src/components/settings/ConfiguredModelsList.vue`                  | UI           | Configured models list with actions                       |
| `src/i18n/*/index.ts` (10 files)                                    | i18n         | Translations for wizard, models, providers                |
