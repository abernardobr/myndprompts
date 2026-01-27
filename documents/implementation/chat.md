# Chat Implementation Plan

This document describes the implementation plan for the AI Chat feature in MyndPrompts. It builds on the existing AI Integration architecture (see `documents/architecture/ai_integration.md`) to add a conversational chat interface with LangChain.js, memory management, streaming with thinking visualization, and a PDF reference canvas.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Todos](#todos)
3. [Task 1: Shared Types & Entity Definitions](#task-1-shared-types--entity-definitions)
4. [Task 2: Database Schema v7 Migration](#task-2-database-schema-v7-migration)
5. [Task 3: Chat Repositories](#task-3-chat-repositories)
6. [Task 4: LangChain Service (Main Process)](#task-4-langchain-service-main-process)
7. [Task 5: Chat IPC Handlers & Preload Bridge](#task-5-chat-ipc-handlers--preload-bridge)
8. [Task 6: Chat Pinia Store](#task-6-chat-pinia-store)
9. [Task 7: Streaming Composable](#task-7-streaming-composable)
10. [Task 8: Core Chat UI Components](#task-8-core-chat-ui-components)
11. [Task 9: Message Rendering Components](#task-9-message-rendering-components)
12. [Task 10: PDF Canvas Components](#task-10-pdf-canvas-components)
13. [Task 11: Memory Strategy UI](#task-11-memory-strategy-ui)
14. [Task 12: Chat Integration in Main Layout](#task-12-chat-integration-in-main-layout)
15. [Task 13: Localization (10 Locales)](#task-13-localization-10-locales)
16. [Task 14: Package Dependencies](#task-14-package-dependencies)
17. [Task 15: Verification & Testing](#task-15-verification--testing)

---

## Architecture

### Overview

The Chat feature allows users to have conversations with AI models directly within MyndPrompts. It leverages the existing AI Integration system (API keys, model configuration, provider management) and adds:

- **LangChain.js** for unified model instantiation, prompt templating, and memory management
- **Conversation memory** with multiple strategies (buffer, buffer-window, summary, summary-buffer, vector)
- **Streaming responses** with extended thinking visualization (Anthropic Claude, OpenAI o1/o3)
- **PDF reference canvas** for side-by-side document viewing during chat
- **Message branching** for exploring alternative responses
- **Token usage tracking** and cost estimation
- **Artifact rendering** (code blocks, Markdown, HTML, SVG, Mermaid diagrams)

### Architecture Layers

```
+------------------------------------------------------------------+
|                        UI (Vue 3 + Quasar)                       |
|  ChatContainer | MessageList | InputArea | PDFCanvas | Memory UI  |
+------------------------------------------------------------------+
|                      Composables                                  |
|  useStreamingMessage (streaming state machine)                    |
+------------------------------------------------------------------+
|                      Pinia Store (chatStore)                      |
|  State: sessions, messages, activeSession, streamingState         |
|  Actions: sendMessage, switchModel, setMemoryStrategy, etc.       |
+------------------------------------------------------------------+
|                    Preload (contextBridge)                        |
|  window.chatAPI (IPC bridge for chat operations)                  |
+------------------------------------------------------------------+
|                    IPC Channels                                    |
|  chat:* (request/response + streaming events via webContents)     |
+------------------------------------------------------------------+
|                 Electron Main Process                              |
|  LangChainService (model instantiation, memory, streaming)        |
|  Uses: SecureStorageService (API keys), AIModelFetcherService     |
+------------------------------------------------------------------+
|                      IndexedDB (Dexie.js)                        |
|  chatSessions | chatMessages | memorySnapshots                   |
|  pdfDocuments | pdfAnnotations                                    |
+------------------------------------------------------------------+
```

### Security Model

- All LLM API calls happen in the **Electron main process** via `LangChainService`
- API keys are retrieved internally via `SecureStorageService.getApiKey()` -- keys **never cross IPC**
- The renderer only sends: `{ sessionId, provider, modelId, message, options }`
- Streaming tokens are pushed from main to renderer via `webContents.send()`

### Streaming Architecture

The streaming system uses a **push model** from main to renderer:

```
Renderer (Store)                 Main Process (LangChainService)
─────────────────                ─────────────────────────────────
chatAPI.streamMessage(req) ──>   ipcMain.handle('chat:stream-message')
                                   │
                                   ├── Instantiate LangChain model
                                   ├── Apply memory strategy
                                   ├── Start streaming via .stream()
                                   │
                                   │   For each token:
                                   ├── webContents.send('chat:stream-token', { token })
                                   │
                                   │   For thinking blocks (Claude/o1):
                                   ├── webContents.send('chat:stream-thinking', { text })
                                   │
                                   │   On completion:
                                   ├── webContents.send('chat:stream-end', { usage, fullText })
                                   │
                                   │   On error:
                                   └── webContents.send('chat:stream-error', { error })
```

The renderer listens for these events via `ipcRenderer.on()` in the preload bridge, forwarding them to callbacks registered by the store/composable.

### Memory System

Memory strategies control how conversation history is managed:

| Strategy         | Description                            | Use Case            |
| ---------------- | -------------------------------------- | ------------------- |
| `buffer`         | Full history, no truncation            | Short conversations |
| `buffer-window`  | Last N messages (configurable)         | General purpose     |
| `summary`        | LLM-generated summary replaces history | Long conversations  |
| `summary-buffer` | Summary + recent N messages            | Balanced approach   |
| `vector`         | Vector similarity search on history    | Knowledge-intensive |

Memory is **persisted** as snapshots in IndexedDB. When switching models mid-conversation, memory is preserved and reattached to the new model instance. The `LangChainService` handles serialization/deserialization of memory state.

### Data Model

#### New IndexedDB Tables (v7)

**`chatSessions`**

```typescript
interface IChatSession {
  id: string; // UUID
  title: string; // Auto-generated or user-defined
  provider: AIProviderType; // Current provider
  modelId: string; // Current model ID
  memoryStrategy: MemoryStrategy;
  memoryConfig: IMemoryConfig; // Strategy-specific params (windowSize, etc.)
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
  messageCount: number;
  tokenUsage: ITokenUsage; // Cumulative { promptTokens, completionTokens, totalTokens }
  isArchived: boolean;
}
```

**`chatMessages`**

```typescript
interface IChatMessage {
  id: string; // UUID
  sessionId: string; // FK to IChatSession
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinkingContent?: string; // Extended thinking text (Claude, o1/o3)
  parentMessageId?: string; // For branching conversations
  branchIndex: number; // 0 = main branch
  tokenUsage?: ITokenUsage;
  metadata?: IChatMessageMetadata; // Provider, model, duration, etc.
  createdAt: Date;
}
```

**`memorySnapshots`**

```typescript
interface IMemorySnapshot {
  id: string;
  sessionId: string;
  strategy: MemoryStrategy;
  serializedState: string; // JSON-serialized LangChain memory state
  createdAt: Date;
}
```

**`pdfDocuments`**

```typescript
interface IPDFDocument {
  id: string;
  sessionId: string;
  filePath: string;
  fileName: string;
  pageCount: number;
  addedAt: Date;
}
```

**`pdfAnnotations`**

```typescript
interface IPDFAnnotation {
  id: string;
  documentId: string; // FK to IPDFDocument
  sessionId: string;
  pageNumber: number;
  type: 'highlight' | 'note' | 'bookmark';
  content?: string;
  position: { x: number; y: number; width: number; height: number };
  color?: string;
  createdAt: Date;
}
```

### LangChain Model Instantiation

The `LangChainService` creates model instances based on provider type:

| Provider  | LangChain Class          | Package                   |
| --------- | ------------------------ | ------------------------- |
| Anthropic | `ChatAnthropic`          | `@langchain/anthropic`    |
| OpenAI    | `ChatOpenAI`             | `@langchain/openai`       |
| Google    | `ChatGoogleGenerativeAI` | `@langchain/google-genai` |
| Groq      | `ChatGroq`               | `@langchain/groq`         |
| Ollama    | `ChatOllama`             | `@langchain/ollama`       |

Each model is instantiated with the API key retrieved from `SecureStorageService` and the `modelId` from the configured models list. For streaming, the service uses LangChain's `.stream()` method and pipes tokens to the renderer.

### IPC Channels

| Channel                    | Direction        | Type   | Description                       |
| -------------------------- | ---------------- | ------ | --------------------------------- |
| `chat:init-session`        | Renderer -> Main | invoke | Create/resume a chat session      |
| `chat:stream-message`      | Renderer -> Main | invoke | Start streaming a message         |
| `chat:stop-stream`         | Renderer -> Main | invoke | Abort current stream              |
| `chat:switch-model`        | Renderer -> Main | invoke | Switch model mid-conversation     |
| `chat:set-memory-strategy` | Renderer -> Main | invoke | Change memory strategy            |
| `chat:stream-token`        | Main -> Renderer | send   | Individual token chunk            |
| `chat:stream-thinking`     | Main -> Renderer | send   | Thinking/reasoning block          |
| `chat:stream-end`          | Main -> Renderer | send   | Stream completed with usage stats |
| `chat:stream-error`        | Main -> Renderer | send   | Stream error                      |

### File Structure

```
src/
├── services/
│   ├── chat/
│   │   └── types.ts                          # Shared types for chat
│   └── storage/
│       ├── entities.ts                        # + new chat entities
│       ├── db.ts                              # + v7 migration
│       └── repositories/
│           ├── chat-sessions.repository.ts    # Session CRUD
│           ├── chat-messages.repository.ts    # Message CRUD + branching
│           ├── memory-snapshots.repository.ts # Memory persistence
│           ├── pdf-documents.repository.ts    # PDF doc tracking
│           └── pdf-annotations.repository.ts  # PDF annotations
├── electron/
│   ├── main/
│   │   ├── index.ts                           # + chat IPC handlers
│   │   └── services/
│   │       └── langchain.service.ts           # LangChain orchestration
│   └── preload/
│       └── index.ts                           # + ChatAPI bridge
├── stores/
│   └── chatStore.ts                           # Chat Pinia store
├── composables/
│   └── useStreamingMessage.ts                 # Streaming state machine
├── components/
│   └── chat/
│       ├── ChatContainer.vue                  # Main layout (messages + input + PDF)
│       ├── ChatMessageList.vue                # Virtualized message list
│       ├── ChatMessageItem.vue                # Single message rendering
│       ├── ChatInputArea.vue                  # Input with send/stop/attach
│       ├── ChatThinkingIndicator.vue          # Thinking animation
│       ├── ChatStreamingText.vue              # Token-by-token text display
│       ├── ChatPDFCanvas.vue                  # PDF viewer sidebar
│       ├── ChatMemorySelector.vue             # Memory strategy dropdown
│       ├── ChatSessionList.vue                # Session history sidebar
│       ├── ChatToolbar.vue                    # Model selector, memory, settings
│       └── ChatArtifactRenderer.vue           # Code/MD/HTML/SVG/Mermaid renderer
└── i18n/
    └── */index.ts                             # + chat i18n keys (10 locales)
```

Also: both Electron entry points:

```
src-electron/
└── electron-main.ts                           # + mirror chat IPC handlers
```

### Package Dependencies

| Package                   | Purpose                            |
| ------------------------- | ---------------------------------- |
| `langchain`               | Core LangChain framework           |
| `@langchain/core`         | Base abstractions                  |
| `@langchain/anthropic`    | Anthropic Claude models            |
| `@langchain/openai`       | OpenAI GPT/o1/o3/o4 models         |
| `@langchain/google-genai` | Google Gemini models               |
| `@langchain/groq`         | Groq models                        |
| `@langchain/ollama`       | Local Ollama models                |
| `pdfjs-dist`              | PDF rendering for canvas           |
| `marked`                  | Markdown rendering in messages     |
| `highlight.js`            | Syntax highlighting in code blocks |
| `date-fns`                | Date formatting for messages       |

---

## Todos

- [x] Task 1: Create shared chat types and entity definitions
- [x] Task 2: Add database schema v7 migration with new tables
- [x] Task 3: Create chat repositories (sessions, messages, memory, PDF)
- [x] Task 4: Implement LangChainService in Electron main process
- [ ] Task 5: Add chat IPC handlers and preload ChatAPI bridge
- [ ] Task 6: Create chat Pinia store
- [ ] Task 7: Create useStreamingMessage composable
- [ ] Task 8: Build core chat UI components (container, input, message list)
- [ ] Task 9: Build message rendering components (streaming text, thinking, artifacts)
- [ ] Task 10: Build PDF canvas components
- [ ] Task 11: Build memory strategy UI
- [ ] Task 12: Integrate chat into main layout
- [ ] Task 13: Add localization for all 10 locales
- [ ] Task 14: Install package dependencies
- [ ] Task 15: Verification and testing

---

## Task 1: Shared Types & Entity Definitions

### Purpose

Define all TypeScript types and interfaces shared between the main process and renderer for the chat feature. This is the foundation that all other tasks depend on.

### Objective

Create `src/services/chat/types.ts` with all chat-related types and update `src/services/storage/entities.ts` with new entity interfaces for IndexedDB persistence.

### Architecture Description

The chat types are split into two files:

- **`src/services/chat/types.ts`** -- Shared types for IPC communication, streaming events, LangChain configuration, and memory strategies. These types are used by both main process and renderer.
- **`src/services/storage/entities.ts`** -- Entity interfaces stored in IndexedDB (chat sessions, messages, memory snapshots, PDF documents, annotations).

The `MemoryStrategy` union type defines all supported memory strategies. `IStreamEvent` defines the discriminated union for all streaming events pushed from main to renderer. `ILangChainConfig` is used internally by the main process to configure model instances.

### Prompt

```
You are a Senior Software Architect implementing the Chat feature for MyndPrompts, a Vue 3 + Quasar + Electron desktop application.

## Context
- Read `documents/architecture/ai_integration.md` for the existing AI architecture
- Read `src/services/storage/entities.ts` for existing entity patterns
- Read `src/services/ai-models/types.ts` for the existing shared types pattern

## Task
Create shared types for the chat feature in two files:

### File 1: `src/services/chat/types.ts`

Create this NEW file with:

1. **MemoryStrategy** type union: `'buffer' | 'buffer-window' | 'summary' | 'summary-buffer' | 'vector'`

2. **IMemoryConfig** interface:
   - `windowSize?: number` (for buffer-window, default 10)
   - `maxTokens?: number` (for summary strategies)
   - `summaryModelId?: string` (optional separate model for summarization)

3. **ITokenUsage** interface:
   - `promptTokens: number`
   - `completionTokens: number`
   - `totalTokens: number`

4. **IChatMessageMetadata** interface:
   - `provider: string`
   - `modelId: string`
   - `modelName: string`
   - `duration: number` (ms)
   - `finishReason?: string`

5. **IStreamTokenEvent**: `{ type: 'token'; token: string; messageId: string }`
6. **IStreamThinkingEvent**: `{ type: 'thinking'; text: string; messageId: string }`
7. **IStreamEndEvent**: `{ type: 'end'; messageId: string; fullText: string; thinkingText?: string; usage: ITokenUsage; metadata: IChatMessageMetadata }`
8. **IStreamErrorEvent**: `{ type: 'error'; messageId: string; error: string }`
9. **IStreamEvent** discriminated union of the four above

10. **IChatStreamRequest** interface:
    - `sessionId: string`
    - `message: string`
    - `provider: string` (AIProviderType)
    - `modelId: string`
    - `memoryStrategy: MemoryStrategy`
    - `memoryConfig: IMemoryConfig`
    - `parentMessageId?: string`
    - `systemPrompt?: string`

11. **IChatInitRequest**: `{ sessionId?: string; provider: string; modelId: string; title?: string; memoryStrategy?: MemoryStrategy; memoryConfig?: IMemoryConfig }`
12. **IChatInitResult**: `{ sessionId: string; resumed: boolean }`
13. **IChatSwitchModelRequest**: `{ sessionId: string; provider: string; modelId: string }`

### File 2: `src/services/storage/entities.ts`

ADD (do not remove existing content) the following interfaces and imports:

1. Import `MemoryStrategy`, `IMemoryConfig`, `ITokenUsage`, `IChatMessageMetadata` from `'../chat/types'`

2. **IChatSession** interface (as described in the architecture section above)
3. **IChatMessage** interface (as described above)
4. **IMemorySnapshot** interface (as described above)
5. **IPDFDocument** interface (as described above)
6. **IPDFAnnotation** interface (as described above)

Follow the existing code style: JSDoc comments on interfaces, exported types.
```

---

## Task 2: Database Schema v7 Migration

### Purpose

Add IndexedDB tables for chat persistence. This extends the existing Dexie.js database with five new tables and proper indexes.

### Objective

Update `src/services/storage/db.ts` to add version 7 with `chatSessions`, `chatMessages`, `memorySnapshots`, `pdfDocuments`, and `pdfAnnotations` tables, including Table type declarations and Dexie creating hooks for automatic date fields.

### Architecture Description

The migration follows the established pattern:

- Add `Table` type declarations as class properties on `MyndPromptDB`
- Define the v7 schema with indexes optimized for common queries (session lookup, message ordering, memory retrieval)
- No upgrade migration is needed (new tables only, no data transformation)
- Add Dexie `creating` hooks for automatic `createdAt`/`addedAt` timestamps

Key indexes:

- `chatSessions`: `&id, updatedAt, isArchived` -- lookup by ID, sort by recent
- `chatMessages`: `&id, sessionId, [sessionId+createdAt], parentMessageId` -- efficient message retrieval by session with ordering
- `memorySnapshots`: `&id, sessionId, [sessionId+createdAt]` -- latest snapshot per session
- `pdfDocuments`: `&id, sessionId` -- documents by session
- `pdfAnnotations`: `&id, documentId, sessionId` -- annotations by document or session

### Prompt

````
You are a Senior Software Architect implementing the Chat feature for MyndPrompts.

## Context
- Read `src/services/storage/db.ts` for the existing database schema pattern (currently v6)
- Read `src/services/storage/entities.ts` for the entity interfaces (including new chat entities from Task 1)
- The project uses Dexie.js for IndexedDB with explicit version migrations

## Task
Update `src/services/storage/db.ts`:

### 1. Add Table type declarations
Add these class properties to `MyndPromptDB`:
```typescript
chatSessions!: Table<IChatSession, string>;
chatMessages!: Table<IChatMessage, string>;
memorySnapshots!: Table<IMemorySnapshot, string>;
pdfDocuments!: Table<IPDFDocument, string>;
pdfAnnotations!: Table<IPDFAnnotation, string>;
````

### 2. Add imports

Import `IChatSession`, `IChatMessage`, `IMemorySnapshot`, `IPDFDocument`, `IPDFAnnotation` from entities.

### 3. Add Version 7

After the existing v6 block, add:

```typescript
// Version 7: Add chat tables
this.version(7).stores({
  // Keep ALL existing tables from v6 exactly as they are
  userAuth: 'id, email',
  appConfig: 'key',
  uiState: 'id',
  recentFiles: 'id, filePath, fileType, lastOpenedAt, isPinned',
  projectIndexCache: 'id, projectPath, lastIndexed',
  syncStatus: 'id, filePath, status',
  gitStatus: 'id, filePath, status',
  aiProviders: 'id, provider',
  configuredModels: '&id, provider, modelId, isDefault, addedAt',
  projects: '&folderPath, id, name, createdAt',
  projectFolders: '&id, projectPath, folderPath, [projectPath+folderPath], status',
  fileIndex:
    '&id, projectFolderId, normalizedName, fullPath, [projectFolderId+fullPath], extension',
  plugins: '&id, version, type, *tags, installedAt, updatedAt',
  // NEW chat tables
  chatSessions: '&id, updatedAt, isArchived',
  chatMessages: '&id, sessionId, [sessionId+createdAt], parentMessageId',
  memorySnapshots: '&id, sessionId, [sessionId+createdAt]',
  pdfDocuments: '&id, sessionId',
  pdfAnnotations: '&id, documentId, sessionId',
});
```

### 4. Add creating hooks

After the existing plugins hooks, add hooks for the new tables:

- `chatSessions`: Set `createdAt` and `updatedAt` to `new Date()` if not present
- `chatMessages`: Set `createdAt` to `new Date()` if not present
- `memorySnapshots`: Set `createdAt` to `new Date()` if not present
- `pdfDocuments`: Set `addedAt` to `new Date()` if not present
- `pdfAnnotations`: Set `createdAt` to `new Date()` if not present

Also add an updating hook for `chatSessions` to auto-set `updatedAt`.

### 5. Add updating hooks

- `chatSessions`: Auto-update `updatedAt` on modification

Follow the exact patterns used for existing hooks. Do NOT modify any existing code.

```

---

## Task 3: Chat Repositories

### Purpose
Create repository classes for all chat-related entities, providing type-safe CRUD operations and query methods following the existing repository pattern.

### Objective
Create five new repository files using the `BaseRepository` pattern, each as a singleton with specialized methods for chat operations.

### Architecture Description
All repositories extend `BaseRepository<T, K>` and follow the singleton pattern established by `ConfiguredModelsRepository`. Key design decisions:

- **ChatSessionsRepository**: Manages session lifecycle. `createSession()` generates UUID, sets defaults. `getRecentSessions()` returns sessions ordered by `updatedAt` descending. `archiveSession()` soft-deletes.
- **ChatMessagesRepository**: Manages messages within sessions. `getBySession(sessionId)` returns messages ordered by `createdAt`. `getBranch(parentMessageId, branchIndex)` supports conversation branching. `getMainThread(sessionId)` returns the main conversation branch (branchIndex = 0).
- **MemorySnapshotsRepository**: Stores serialized LangChain memory state. `getLatest(sessionId)` returns the most recent snapshot. `saveSnapshot()` creates a new snapshot (old ones can be pruned).
- **PDFDocumentsRepository** and **PDFAnnotationsRepository**: Track PDF references and annotations per session.

### Prompt

```

You are a Senior Software Architect implementing the Chat feature for MyndPrompts.

## Context

- Read `src/services/storage/repositories/base.repository.ts` for the base class pattern
- Read `src/services/storage/repositories/configured-models.repository.ts` for the singleton and method patterns
- Read `src/services/storage/entities.ts` for the chat entity interfaces
- Read `src/services/storage/db.ts` for the getDB() pattern

## Task

Create FIVE new repository files:

### File 1: `src/services/storage/repositories/chat-sessions.repository.ts`

Singleton extending `BaseRepository<IChatSession, string>`. Constructor uses `getDB().chatSessions`.

Methods:

- `createSession(provider, modelId, title?, memoryStrategy?, memoryConfig?)` -- Creates a new session with UUID, defaults (messageCount: 0, tokenUsage: {0,0,0}, isArchived: false)
- `getRecentSessions(limit = 50)` -- Returns non-archived sessions ordered by updatedAt desc
- `getArchivedSessions()` -- Returns archived sessions
- `archiveSession(id)` -- Sets isArchived = true
- `unarchiveSession(id)` -- Sets isArchived = false
- `updateSessionModel(id, provider, modelId)` -- Updates current model
- `updateMemoryStrategy(id, strategy, config)` -- Updates memory strategy and config
- `incrementMessageCount(id)` -- Increments messageCount by 1
- `addTokenUsage(id, usage: ITokenUsage)` -- Adds to cumulative token usage
- `updateTitle(id, title)` -- Updates session title

Export `getSessionsRepository()` factory function.

### File 2: `src/services/storage/repositories/chat-messages.repository.ts`

Singleton extending `BaseRepository<IChatMessage, string>`.

Methods:

- `addMessage(sessionId, role, content, options?: { thinkingContent?, parentMessageId?, branchIndex?, tokenUsage?, metadata? })` -- Creates message with UUID
- `getBySession(sessionId)` -- All messages for session, ordered by createdAt
- `getMainThread(sessionId)` -- Messages where branchIndex === 0, ordered by createdAt
- `getBranches(parentMessageId)` -- All messages branching from a parent
- `getLastMessage(sessionId)` -- Most recent message in session
- `updateContent(id, content)` -- Update message content
- `deleteSessionMessages(sessionId)` -- Delete all messages for a session

Export `getMessagesRepository()` factory function.

### File 3: `src/services/storage/repositories/memory-snapshots.repository.ts`

Singleton extending `BaseRepository<IMemorySnapshot, string>`.

Methods:

- `saveSnapshot(sessionId, strategy, serializedState)` -- Creates new snapshot with UUID
- `getLatest(sessionId)` -- Returns most recent snapshot for session
- `getBySession(sessionId)` -- All snapshots for session
- `deleteSessionSnapshots(sessionId)` -- Delete all snapshots for a session
- `pruneOldSnapshots(sessionId, keepCount = 5)` -- Keep only the N most recent snapshots

Export `getMemorySnapshotsRepository()` factory function.

### File 4: `src/services/storage/repositories/pdf-documents.repository.ts`

Singleton extending `BaseRepository<IPDFDocument, string>`.

Methods:

- `addDocument(sessionId, filePath, fileName, pageCount)` -- Creates with UUID
- `getBySession(sessionId)` -- All documents for session
- `removeDocument(id)` -- Removes document and associated annotations
- `deleteSessionDocuments(sessionId)` -- Delete all documents for a session

Export `getPDFDocumentsRepository()` factory function.

### File 5: `src/services/storage/repositories/pdf-annotations.repository.ts`

Singleton extending `BaseRepository<IPDFAnnotation, string>`.

Methods:

- `addAnnotation(documentId, sessionId, pageNumber, type, options?: { content?, position, color? })` -- Creates with UUID
- `getByDocument(documentId)` -- All annotations for a document
- `getByPage(documentId, pageNumber)` -- Annotations for a specific page
- `deleteDocumentAnnotations(documentId)` -- Delete all for a document
- `deleteSessionAnnotations(sessionId)` -- Delete all for a session

Export `getPDFAnnotationsRepository()` factory function.

All repositories must:

- Use `import { v4 as uuidv4 } from 'uuid'` for ID generation
- Follow the exact singleton + static `getInstance()` + `resetInstance()` pattern
- Include JSDoc comments on the class and public methods
- Export both the class and the convenience getter function

```

---

## Task 4: LangChain Service (Main Process)

### Purpose
Create the core AI orchestration service that runs in the Electron main process. This service instantiates LangChain models, manages memory, handles streaming, and coordinates all LLM interactions.

### Objective
Create `src/electron/main/services/langchain.service.ts` -- a singleton service that integrates with `SecureStorageService` for API keys and provides methods for session management, message streaming, model switching, and memory strategy changes.

### Architecture Description
The `LangChainService` is the central coordinator for all chat operations. It runs exclusively in the main process for security (API keys never cross IPC).

**Model Instantiation**: Based on the `provider` field, the service creates the appropriate LangChain chat model class. Each class receives the API key from `SecureStorageService` and the model ID. Models are cached per session to avoid re-instantiation.

**Memory Management**: The service maintains a `Map<sessionId, BaseChatMemory>` of active memory instances. When a session is initialized, it checks for a persisted snapshot in IndexedDB (via the repository) and restores memory state. After each message exchange, the memory state is serialized and saved.

**Streaming**: Uses LangChain's `.stream()` method. The service receives a `BrowserWindow` reference (or `WebContents`) to push `webContents.send()` events for each token. For models that support extended thinking (Anthropic with `thinking` parameter, OpenAI o1/o3), the service detects thinking blocks in the stream and emits separate `chat:stream-thinking` events.

**Abort**: Each active stream is tracked with an `AbortController`. The `stopStream()` method aborts the current stream for a session.

**Session-Model Cache**: `Map<sessionId, { model, memory, abortController? }>`.

### Prompt

```

You are a Senior Software Architect implementing the Chat feature for MyndPrompts.

## Context

- Read `documents/architecture/ai_integration.md` for the existing AI integration architecture
- Read `src/electron/main/services/secure-storage.service.ts` for the SecureStorageService pattern
- Read `src/electron/main/services/ai-model-fetcher.service.ts` for the singleton service pattern and HTTP patterns
- Read `src/services/chat/types.ts` for the chat types (from Task 1)
- Read `src/services/storage/entities.ts` for entity types

## Task

Create `src/electron/main/services/langchain.service.ts`:

### Design

- Singleton with `getInstance()` and `getService()` factory export
- Imports LangChain model classes: `ChatAnthropic` from `@langchain/anthropic`, `ChatOpenAI` from `@langchain/openai`, `ChatGoogleGenerativeAI` from `@langchain/google-genai`, `ChatGroq` from `@langchain/groq`, `ChatOllama` from `@langchain/ollama`
- Imports memory classes: `BufferMemory`, `BufferWindowMemory`, `ConversationSummaryMemory`, `ConversationSummaryBufferMemory` from `langchain/memory`
- Uses `SecureStorageService` to retrieve API keys internally

### Internal State

```typescript
private sessions: Map<string, {
  model: BaseChatModel;
  memory: BaseChatMemory;
  abortController?: AbortController;
  provider: string;
  modelId: string;
}>;
```

### Methods

1. **`initSession(request: IChatInitRequest, webContents: WebContents): IChatInitResult`**
   - If `sessionId` provided and exists in the cache, return `{ sessionId, resumed: true }`
   - Otherwise create new entry: instantiate model, create memory, return `{ sessionId: newUUID, resumed: false }`
   - For resumed sessions, try to restore memory from IndexedDB snapshot

2. **`async streamMessage(request: IChatStreamRequest, webContents: WebContents): Promise<void>`**
   - Get or create session from cache
   - Create user message ID (UUID)
   - Create assistant message ID (UUID)
   - Send `chat:stream-start` event with message IDs
   - Create `AbortController`, store it
   - Call model `.stream()` with the message + memory context
   - For each chunk:
     - Detect if it's a thinking block (Anthropic `type === 'thinking'` or OpenAI reasoning tokens)
     - Send `chat:stream-token` or `chat:stream-thinking` event
   - On completion: send `chat:stream-end` with full text, thinking text, and usage stats
   - On error: send `chat:stream-error`
   - Save memory state to snapshot repository
   - Clean up abort controller

3. **`stopStream(sessionId: string): void`**
   - Call `.abort()` on the session's AbortController

4. **`async switchModel(request: IChatSwitchModelRequest): Promise<void>`**
   - Serialize current memory state
   - Create new model instance for the new provider/model
   - Attach existing memory to new model
   - Update session cache

5. **`async setMemoryStrategy(sessionId: string, strategy: MemoryStrategy, config: IMemoryConfig): Promise<void>`**
   - Create new memory instance with the new strategy
   - If there's existing conversation history, migrate it to the new memory

6. **`destroySession(sessionId: string): void`**
   - Stop any active stream
   - Remove from cache
   - Clean up memory

### Private Helpers

- `createModel(provider, modelId)` -- Switch on provider, create appropriate LangChain class with API key from SecureStorageService. Include streaming: true.
- `createMemory(strategy, config)` -- Switch on strategy, create appropriate memory class
- `getApiKey(provider)` -- Calls SecureStorageService.getApiKey()
- `serializeMemory(memory)` -- Serialize memory state to JSON string
- `deserializeMemory(strategy, serializedState)` -- Restore memory from JSON

### Important Notes

- All API keys are retrieved via `getSecureStorageService().getApiKey(provider)` -- they NEVER come from IPC parameters
- The `webContents` parameter is used for `webContents.send()` to push streaming events
- Use `AbortController` / `AbortSignal` for stream cancellation
- Handle Anthropic thinking blocks by checking the chunk content type
- For Ollama, use the baseUrl from the provider config (passed via request or fetched from repository)
- Include proper error handling with try/catch around all async operations
- Add console.log for key operations (session init, stream start/end, errors) for debugging

Export: `getLangChainService()` factory function.

```

---

## Task 5: Chat IPC Handlers & Preload Bridge

### Purpose
Wire the LangChainService to the renderer process via IPC handlers and the preload contextBridge. This follows the established two-entry-point pattern critical to this project.

### Objective
Add chat IPC handlers to both `src/electron/main/index.ts` and `src-electron/electron-main.ts`, and add the `ChatAPI` interface and implementation to `src/electron/preload/index.ts`.

### Architecture Description
The chat IPC follows two patterns:
1. **Request/Response** (`ipcMain.handle`): For `init-session`, `switch-model`, `set-memory-strategy`, `stop-stream`. The renderer calls these via `ipcRenderer.invoke()`.
2. **Push Events** (`webContents.send`): For streaming events (`stream-token`, `stream-thinking`, `stream-end`, `stream-error`). The LangChainService pushes these directly to the BrowserWindow's webContents. The preload registers `ipcRenderer.on()` listeners that forward to callbacks.

CRITICAL: IPC handlers MUST be added to BOTH `src/electron/main/index.ts` AND `src-electron/electron-main.ts`.

### Prompt

```

You are a Senior Software Architect implementing the Chat feature for MyndPrompts.

## CRITICAL: Two Electron Entry Points

This project has TWO electron main process entry points. ALL IPC handlers MUST be added to BOTH files:

1. `src/electron/main/index.ts` (Development)
2. `src-electron/electron-main.ts` (Production/Quasar)

## Context

- Read `src/electron/main/index.ts` for the existing IPC handler patterns
- Read `src-electron/electron-main.ts` for the production entry point
- Read `src/electron/preload/index.ts` for the preload bridge patterns
- Read `src/services/chat/types.ts` for chat types
- Read `src/electron/main/services/langchain.service.ts` (from Task 4) for the service API

## Task

### Part 1: IPC Handlers (add to BOTH entry points)

Add a new section "Chat IPC Handlers" to both files:

```typescript
// ================================
// Chat IPC Handlers
// ================================

ipcMain.handle('chat:init-session', async (event, request) => {
  const langchain = getLangChainService();
  const webContents = event.sender;
  return langchain.initSession(request, webContents);
});

ipcMain.handle('chat:stream-message', async (event, request) => {
  const langchain = getLangChainService();
  const webContents = event.sender;
  await langchain.streamMessage(request, webContents);
});

ipcMain.handle('chat:stop-stream', async (_event, sessionId: string) => {
  const langchain = getLangChainService();
  langchain.stopStream(sessionId);
});

ipcMain.handle('chat:switch-model', async (_event, request) => {
  const langchain = getLangChainService();
  await langchain.switchModel(request);
});

ipcMain.handle(
  'chat:set-memory-strategy',
  async (_event, sessionId: string, strategy: string, config: unknown) => {
    const langchain = getLangChainService();
    await langchain.setMemoryStrategy(
      sessionId,
      strategy as MemoryStrategy,
      config as IMemoryConfig
    );
  }
);
```

Add the import for `getLangChainService` at the top of both files.
Also import `MemoryStrategy` and `IMemoryConfig` from the chat types.

### Part 2: Preload Bridge

Update `src/electron/preload/index.ts`:

1. Add the `ChatAPI` interface:

```typescript
export interface ChatAPI {
  initSession: (request: {
    sessionId?: string;
    provider: string;
    modelId: string;
    title?: string;
    memoryStrategy?: string;
    memoryConfig?: Record<string, unknown>;
  }) => Promise<{ sessionId: string; resumed: boolean }>;

  streamMessage: (request: {
    sessionId: string;
    message: string;
    provider: string;
    modelId: string;
    memoryStrategy: string;
    memoryConfig: Record<string, unknown>;
    parentMessageId?: string;
    systemPrompt?: string;
  }) => Promise<void>;

  stopStream: (sessionId: string) => Promise<void>;

  switchModel: (request: { sessionId: string; provider: string; modelId: string }) => Promise<void>;

  setMemoryStrategy: (
    sessionId: string,
    strategy: string,
    config: Record<string, unknown>
  ) => Promise<void>;

  // Streaming event listeners (return cleanup function)
  onStreamToken: (callback: (data: { token: string; messageId: string }) => void) => () => void;
  onStreamThinking: (callback: (data: { text: string; messageId: string }) => void) => () => void;
  onStreamEnd: (
    callback: (data: {
      messageId: string;
      fullText: string;
      thinkingText?: string;
      usage: { promptTokens: number; completionTokens: number; totalTokens: number };
      metadata: Record<string, unknown>;
    }) => void
  ) => () => void;
  onStreamError: (callback: (data: { messageId: string; error: string }) => void) => () => void;
}
```

2. Add the implementation:

```typescript
const chatApi: ChatAPI = {
  initSession: (request) => ipcRenderer.invoke('chat:init-session', request),
  streamMessage: (request) => ipcRenderer.invoke('chat:stream-message', request),
  stopStream: (sessionId) => ipcRenderer.invoke('chat:stop-stream', sessionId),
  switchModel: (request) => ipcRenderer.invoke('chat:switch-model', request),
  setMemoryStrategy: (sessionId, strategy, config) =>
    ipcRenderer.invoke('chat:set-memory-strategy', sessionId, strategy, config),

  onStreamToken: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { token: string; messageId: string }
    ) => callback(data);
    ipcRenderer.on('chat:stream-token', handler);
    return () => ipcRenderer.removeListener('chat:stream-token', handler);
  },
  onStreamThinking: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { text: string; messageId: string }
    ) => callback(data);
    ipcRenderer.on('chat:stream-thinking', handler);
    return () => ipcRenderer.removeListener('chat:stream-thinking', handler);
  },
  onStreamEnd: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on('chat:stream-end', handler);
    return () => ipcRenderer.removeListener('chat:stream-end', handler);
  },
  onStreamError: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { messageId: string; error: string }
    ) => callback(data);
    ipcRenderer.on('chat:stream-error', handler);
    return () => ipcRenderer.removeListener('chat:stream-error', handler);
  },
};
```

3. Expose via contextBridge:

```typescript
contextBridge.exposeInMainWorld('chatAPI', chatApi);
```

4. Add to Window type augmentation:

```typescript
chatAPI: ChatAPI;
```

Follow the exact patterns of existing preload code (event listener cleanup functions, type annotations, etc.).

```

---

## Task 6: Chat Pinia Store

### Purpose
Create the centralized state management for all chat operations in the renderer process. This store coordinates between the UI components, the IPC bridge, and the IndexedDB repositories.

### Objective
Create `src/stores/chatStore.ts` -- a Pinia store with setup function syntax that manages chat sessions, messages, streaming state, and PDF references.

### Architecture Description
The chat store is the single source of truth for all chat-related state in the renderer. It follows the established pattern from `aiProviderStore.ts` using Composition API syntax (`defineStore` with setup function).

**State**: Active sessions list, messages per session, active session ID, streaming state (isStreaming, currentMessageId, accumulatedText, thinkingText), PDF documents, memory strategy.

**Initialization**: On mount, loads recent sessions from IndexedDB. Registers IPC event listeners for streaming events (token, thinking, end, error) and stores cleanup functions.

**Message Flow**:
1. UI calls `store.sendMessage(text)`
2. Store creates user message in IndexedDB, adds to reactive state
3. Store calls `chatAPI.streamMessage()` via preload bridge
4. Streaming callbacks (registered on init) update reactive state in real-time
5. On `stream-end`, store saves assistant message to IndexedDB with metadata

**Cleanup**: On store disposal (`onUnmounted` / `$dispose`), call all IPC listener cleanup functions.

### Prompt

```

You are a Senior Software Architect implementing the Chat feature for MyndPrompts.

## Context

- Read `src/stores/aiProviderStore.ts` for the established Pinia store pattern (setup function syntax)
- Read `src/services/chat/types.ts` for all chat types
- Read `src/services/storage/entities.ts` for entity interfaces
- Read `src/electron/preload/index.ts` for the ChatAPI interface

## Task

Create `src/stores/chatStore.ts`:

### State (refs)

- `sessions: ref<IChatSession[]>([])` -- Recent sessions
- `activeSessionId: ref<string | null>(null)` -- Current session
- `messages: ref<Map<string, IChatMessage[]>>(new Map())` -- Messages keyed by sessionId
- `isStreaming: ref(false)` -- Whether currently streaming
- `streamingMessageId: ref<string | null>(null)` -- Message being streamed
- `streamingText: ref('')` -- Accumulated text during streaming
- `thinkingText: ref('')` -- Accumulated thinking text
- `isInitialized: ref(false)`
- `isLoading: ref(false)`
- `pdfDocuments: ref<Map<string, IPDFDocument[]>>(new Map())` -- PDFs per session

### Computed (getters)

- `activeSession` -- Current session object from sessions array
- `activeMessages` -- Messages for active session, sorted by createdAt
- `activeMainThread` -- Active messages filtered to branchIndex === 0
- `activePDFs` -- PDFs for active session
- `hasActiveStream` -- isStreaming boolean
- `totalTokensUsed` -- Sum of all session token usage

### Actions

1. **`initialize()`** -- Load recent sessions from repository, set initialized. Register streaming event listeners.

2. **`createSession(provider, modelId, title?)`** -- Call `chatAPI.initSession()`, create session in repository, add to state, set as active.

3. **`loadSession(sessionId)`** -- Set active, load messages from repository if not already loaded.

4. **`sendMessage(text, options?: { parentMessageId?, systemPrompt? })`**:
   - Create user message via repository
   - Add to reactive state
   - Set streaming state: isStreaming=true, streamingText='', thinkingText=''
   - Call `chatAPI.streamMessage()` (fire-and-forget, events handle the rest)

5. **`stopStreaming()`** -- Call `chatAPI.stopStream(activeSessionId)`, reset streaming state.

6. **`switchModel(provider, modelId)`** -- Call `chatAPI.switchModel()`, update session in repository.

7. **`setMemoryStrategy(strategy, config)`** -- Call `chatAPI.setMemoryStrategy()`, update session in repository.

8. **`deleteSession(sessionId)`** -- Remove from repository, remove messages and snapshots, remove from state.

9. **`archiveSession(sessionId)`** -- Update repository, move from active to archived.

10. **`updateSessionTitle(sessionId, title)`** -- Update in repository and state.

### Internal: Streaming Event Handlers (registered in initialize)

- `_onStreamToken(data)` -- Append token to `streamingText`, update message in state
- `_onStreamThinking(data)` -- Append to `thinkingText`
- `_onStreamEnd(data)` -- Create assistant message in repository with fullText, thinkingText, usage, metadata. Set isStreaming=false. Update session token usage and messageCount.
- `_onStreamError(data)` -- Set isStreaming=false. Create error notification.

### Cleanup

Store cleanup functions from `window.chatAPI.onStreamToken()` etc. Call them when the store is disposed.

Use `import { useQuasar } from 'quasar'` for notifications (or pass $q). Follow the exact patterns from `aiProviderStore.ts`.

```

---

## Task 7: Streaming Composable

### Purpose
Encapsulate the streaming display logic into a reusable Vue composable that manages the token-by-token text rendering, cursor animation, and thinking state visualization.

### Objective
Create `src/composables/useStreamingMessage.ts` -- a composable that provides reactive state for displaying a streaming message, including text cursor, typing animation, and thinking block toggling.

### Architecture Description
The composable is a thin reactive wrapper that observes the chat store's streaming state and provides presentation-ready data for message components:

- **Reactive text with cursor**: Returns the accumulated text with an optional blinking cursor character appended during streaming
- **Thinking state**: Exposes whether thinking is active and the thinking text
- **Auto-scroll trigger**: Emits whenever new content arrives so the message list can scroll to bottom
- **Typing speed simulation**: Optional smoothing to prevent jittery rendering (batch rapid tokens into ~60fps frames)

This composable is consumed by `ChatStreamingText.vue` and `ChatThinkingIndicator.vue`.

### Prompt

```

You are a Senior Software Architect implementing the Chat feature for MyndPrompts.

## Context

- Read `src/stores/chatStore.ts` (from Task 6) for the streaming state
- This is a Vue 3 composable using Composition API

## Task

Create `src/composables/useStreamingMessage.ts`:

```typescript
import { ref, computed, watch, onUnmounted } from 'vue';
import { useChatStore } from '@/stores/chatStore';

export function useStreamingMessage() {
  const chatStore = useChatStore();

  // Presentation state
  const displayText = ref('');
  const displayThinking = ref('');
  const showCursor = ref(false);
  const isThinking = ref(false);
  const scrollTrigger = ref(0); // Increment to trigger scroll

  // Batching for smooth rendering (~60fps)
  let pendingTokens = '';
  let animationFrameId: number | null = null;

  function flushTokens() {
    if (pendingTokens) {
      displayText.value += pendingTokens;
      pendingTokens = '';
      scrollTrigger.value++;
    }
    animationFrameId = null;
  }

  // Watch store streaming state
  watch(
    () => chatStore.streamingText,
    (newText) => {
      if (chatStore.isStreaming) {
        // Calculate delta
        const delta = newText.slice(displayText.value.length);
        if (delta) {
          pendingTokens += delta;
          if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(flushTokens);
          }
        }
      }
    }
  );

  watch(
    () => chatStore.thinkingText,
    (newText) => {
      displayThinking.value = newText;
      isThinking.value = !!newText && chatStore.isStreaming;
      scrollTrigger.value++;
    }
  );

  watch(
    () => chatStore.isStreaming,
    (streaming) => {
      showCursor.value = streaming;
      if (!streaming) {
        // Flush any remaining tokens
        if (pendingTokens) flushTokens();
        // Show final text from store
        displayText.value = chatStore.streamingText;
        isThinking.value = false;
      } else {
        // Reset for new stream
        displayText.value = '';
        displayThinking.value = '';
      }
    }
  );

  onUnmounted(() => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
  });

  return {
    displayText: computed(() => displayText.value),
    displayThinking: computed(() => displayThinking.value),
    showCursor: computed(() => showCursor.value),
    isThinking: computed(() => isThinking.value),
    isStreaming: computed(() => chatStore.isStreaming),
    scrollTrigger: computed(() => scrollTrigger.value),
  };
}
```

Make sure the composable:

- Handles rapid token updates without causing excessive re-renders
- Resets state when a new stream begins
- Properly cleans up requestAnimationFrame on unmount
- Exports read-only computed refs

```

---

## Task 8: Core Chat UI Components

### Purpose
Build the main structural chat UI components: the container layout, the message list, and the input area.

### Objective
Create three Vue components: `ChatContainer.vue` (main layout), `ChatMessageList.vue` (scrollable virtualized message list), and `ChatInputArea.vue` (text input with send/stop/attachment controls).

### Architecture Description
- **ChatContainer.vue**: The root chat layout. Uses a flex column: toolbar at top, message list in the center (flex-grow), input area at bottom. Optionally shows the PDF canvas as a side panel (flex row split). Initializes the chat store on mount.
- **ChatMessageList.vue**: Renders the list of messages. Uses Quasar's `q-virtual-scroll` for performance with large histories. Auto-scrolls to bottom on new messages (watches the `scrollTrigger` from the composable). Shows the streaming message at the bottom when active.
- **ChatInputArea.vue**: Multi-line `q-input` (textarea) with Shift+Enter for newlines, Enter to send. Shows a send button (disabled when empty or streaming), a stop button (visible when streaming), and an attach PDF button. Emits `send` and `stop` events.

### Prompt

```

You are a Senior Software Architect implementing the Chat feature for MyndPrompts.

## Context

- Read `src/components/settings/AIIntegrationSection.vue` for the component style pattern (script setup, scoped SCSS with BEM, light/dark theme variables)
- Read `src/stores/chatStore.ts` (from Task 6) for the store API
- Read `src/composables/useStreamingMessage.ts` (from Task 7) for the composable
- The project uses Vue 3 + Quasar + TypeScript with `<script setup lang="ts">`

## Task

Create THREE components:

### File 1: `src/components/chat/ChatContainer.vue`

Main layout component:

- `<script setup>`: imports chatStore, aiProviderStore, initializes on mount
- Template structure:
  ```
  <div class="chat-container">
    <ChatToolbar />                          <!-- Top bar with model selector -->
    <div class="chat-container__body">
      <div class="chat-container__messages">
        <ChatMessageList />                   <!-- Scrollable message area -->
        <ChatInputArea @send="onSend" @stop="onStop" />  <!-- Input at bottom -->
      </div>
      <ChatPDFCanvas v-if="showPDF" />       <!-- Optional side panel -->
    </div>
  </div>
  ```
- Methods: `onSend(text)` calls `chatStore.sendMessage(text)`, `onStop()` calls `chatStore.stopStreaming()`
- On mount: if no active session, create one with default model from aiProviderStore
- Scoped SCSS with BEM naming `.chat-container`, dark/light theme support

### File 2: `src/components/chat/ChatMessageList.vue`

Scrollable message list:

- Props: none (reads from chatStore)
- Uses `q-scroll-area` with ref for programmatic scrolling
- Renders `ChatMessageItem` for each message in `chatStore.activeMainThread`
- When `chatStore.isStreaming`, renders a streaming `ChatMessageItem` at the bottom using the composable
- Auto-scrolls to bottom when `scrollTrigger` changes (via `watch`)
- Empty state: centered message "Start a conversation" with an icon
- Scoped SCSS

### File 3: `src/components/chat/ChatInputArea.vue`

Message input:

- Uses `q-input` with `type="textarea"` `autogrow` and `outlined`
- Keyboard: Enter sends (unless Shift held), Shift+Enter adds newline
- `v-model` for input text, `ref` for focus management
- Buttons:
  - Send button (`q-btn` with `send` icon): visible when not streaming, disabled when input empty
  - Stop button (`q-btn` with `stop` icon, `color="negative"`): visible when streaming
  - Attach PDF button (`q-btn` with `picture_as_pdf` icon): always visible
- Emits: `send(text: string)`, `stop()`, `attachPdf()`
- After sending, clear input and refocus
- Scoped SCSS

All components should:

- Use `useI18n({ useScope: 'global' })` for translations (use chat.\* keys)
- Follow the dark/light CSS variable pattern from existing components
- Be responsive (flex-based layout)

```

---

## Task 9: Message Rendering Components

### Purpose
Build the components responsible for rendering individual chat messages, including streaming text, thinking indicators, and artifact blocks (code, markdown, etc.).

### Objective
Create `ChatMessageItem.vue`, `ChatStreamingText.vue`, `ChatThinkingIndicator.vue`, and `ChatArtifactRenderer.vue`.

### Architecture Description
- **ChatMessageItem.vue**: Renders a single message bubble. User messages on the right (primary color), assistant on the left (surface color). Shows provider icon, model name, timestamp. For assistant messages, renders content through `ChatArtifactRenderer`. Shows thinking toggle button if `thinkingContent` exists.
- **ChatStreamingText.vue**: Used for the currently streaming message. Displays `displayText` from the composable with a blinking cursor. Renders content progressively as markdown.
- **ChatThinkingIndicator.vue**: Collapsible section showing the model's thinking/reasoning process. Animated "thinking..." indicator while active, full text when complete.
- **ChatArtifactRenderer.vue**: Detects content types (markdown, code blocks with language, HTML, SVG, Mermaid) and renders them appropriately using `marked` for markdown and `highlight.js` for code.

### Prompt

```

You are a Senior Software Architect implementing the Chat feature for MyndPrompts.

## Context

- Read `src/components/settings/AIIntegrationSection.vue` for component patterns
- Read `src/composables/useStreamingMessage.ts` (from Task 7)
- The project uses Vue 3 + Quasar + TypeScript
- Use `marked` for markdown rendering and `highlight.js` for syntax highlighting

## Task

Create FOUR components:

### File 1: `src/components/chat/ChatMessageItem.vue`

Props:

- `message: IChatMessage` (required)
- `isStreaming?: boolean` (default false)

Template:

- Wrapper div with class based on role (user/assistant/system)
- User messages: simple text display, right-aligned, primary color background
- Assistant messages: left-aligned, rendered through ChatArtifactRenderer
- Show provider icon + model name + timestamp in a subtle header
- If `message.thinkingContent` exists, show a toggle button "Show thinking" that expands/collapses `ChatThinkingIndicator`
- If `isStreaming` prop is true, use `ChatStreamingText` instead of static content
- Token usage display (subtle, small text) if available
- Copy button to copy message content

### File 2: `src/components/chat/ChatStreamingText.vue`

No props (uses composable internally):

- Uses `useStreamingMessage()` composable
- Renders `displayText` as markdown (via `marked`)
- Appends blinking cursor span when `showCursor` is true
- Uses `v-html` with sanitized markdown output
- CSS animation for cursor blink

### File 3: `src/components/chat/ChatThinkingIndicator.vue`

Props:

- `text: string` (the thinking content)
- `isActive: boolean` (whether still thinking)

Template:

- Collapsible section (q-expansion-item or custom toggle)
- When `isActive`: animated dots "Thinking..." with a subtle pulsing animation
- When not active: full thinking text displayed as monospace/code-like text
- Muted styling to differentiate from main response

### File 4: `src/components/chat/ChatArtifactRenderer.vue`

Props:

- `content: string` (raw message content)

Template:

- Detect content type:
  - If contains fenced code blocks: extract and render with highlight.js, add copy button per block
  - If contains markdown: render with `marked`
  - If starts with `<svg`: render inline SVG
  - If starts with `<html` or `<!DOCTYPE`: render in sandboxed iframe
  - If contains ```mermaid: render mermaid diagram (or show code block as fallback)
- Default: render as markdown
- Code blocks should have language label and copy-to-clipboard button
- Use `highlight.js` for syntax highlighting with auto-detection

All components: scoped SCSS, dark/light theme variables, BEM naming, i18n for static text.

```

---

## Task 10: PDF Canvas Components

### Purpose
Build the PDF viewer sidebar that allows users to reference documents during chat conversations.

### Objective
Create `ChatPDFCanvas.vue` -- a side panel component that renders PDF documents using `pdfjs-dist`, with page navigation, zoom controls, and basic annotation support.

### Architecture Description
The PDF canvas is an optional side panel in `ChatContainer`. When a user attaches a PDF:
1. The file path is passed to the store
2. The store creates a `pdfDocuments` entry in IndexedDB
3. `ChatPDFCanvas` loads and renders the PDF using `pdfjs-dist`

The canvas uses HTML5 `<canvas>` elements for rendering PDF pages. Navigation includes page forward/back buttons and a page number input. Zoom is controlled via buttons (+/-/fit-width).

### Prompt

```

You are a Senior Software Architect implementing the Chat feature for MyndPrompts.

## Context

- Read the existing component patterns for styling
- Read `src/stores/chatStore.ts` (from Task 6) for PDF document state
- Uses `pdfjs-dist` for PDF rendering

## Task

Create `src/components/chat/ChatPDFCanvas.vue`:

### Features

- Side panel layout (takes ~40% width when visible)
- Header with: document name, close button, page navigation (prev/next/input), zoom controls (+/-/fit)
- Main area: canvas element rendering current PDF page
- Uses `pdfjs-dist` to load and render PDF:
  ```typescript
  import * as pdfjsLib from 'pdfjs-dist';
  // Set worker source
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'path/to/pdf.worker.min.js';
  ```
- Loads document from file path via `window.fileSystemAPI.readFileAsDataUrl()`
- State: currentPage, totalPages, scale, pdfDoc reference
- Methods: loadPDF(), renderPage(), nextPage(), prevPage(), zoomIn(), zoomOut(), fitWidth()
- Emits: `close` event when user closes the panel
- Handle loading state (spinner) and error state

### Style

- Scoped SCSS with BEM naming `.chat-pdf-canvas`
- Dark/light theme support
- Subtle border separating from chat area
- Responsive: collapses on narrow viewports

```

---

## Task 11: Memory Strategy UI

### Purpose
Build the UI for selecting and configuring the conversation memory strategy.

### Objective
Create `ChatMemorySelector.vue` and `ChatToolbar.vue` components.

### Architecture Description
- **ChatToolbar.vue**: Top bar of the chat area. Shows: current model (with provider icon and model name from `aiProviderStore`), model selector dropdown (to switch models), memory strategy selector, session title (editable), and a sessions list toggle button.
- **ChatMemorySelector.vue**: A dropdown/popover that lets users choose a memory strategy and configure its parameters (e.g., window size for buffer-window). Changes are applied via `chatStore.setMemoryStrategy()`.

### Prompt

```

You are a Senior Software Architect implementing the Chat feature for MyndPrompts.

## Context

- Read `src/stores/chatStore.ts` (from Task 6) and `src/stores/aiProviderStore.ts` for store APIs
- Read `src/constants/ai-providers.ts` for provider metadata (icons, names)
- Read `src/services/chat/types.ts` for MemoryStrategy and IMemoryConfig

## Task

Create TWO components:

### File 1: `src/components/chat/ChatToolbar.vue`

Top bar component:

- Model selector: `q-btn-dropdown` showing current model name + provider icon. Dropdown lists all configured models from `aiProviderStore.orderedModels`. Clicking a model calls `chatStore.switchModel()`.
- Memory strategy: embedded `ChatMemorySelector` component
- Session title: inline-editable text (click to edit, Enter to save). Calls `chatStore.updateSessionTitle()`.
- New session button: "+" icon to create a new session
- Sessions list toggle: hamburger icon to show/hide session sidebar (emits event or toggles local state)
- Compact layout, subtle styling

### File 2: `src/components/chat/ChatMemorySelector.vue`

Memory strategy dropdown:

- `q-select` with options for each strategy:
  - Buffer (full history)
  - Buffer Window (last N messages)
  - Summary (LLM-generated summary)
  - Summary Buffer (summary + recent)
  - Vector (similarity search)
- When "Buffer Window" or "Summary Buffer" is selected, show a `q-input` for `windowSize` (number, default 10)
- When "Summary" or "Summary Buffer" is selected, show optional `maxTokens` input
- On change: call `chatStore.setMemoryStrategy(strategy, config)`
- Use i18n keys for strategy names and descriptions
- Compact inline design (fits in toolbar)

Both components: scoped SCSS, dark/light themes, BEM naming, i18n.

```

---

## Task 12: Chat Integration in Main Layout

### Purpose
Integrate the chat feature into the main application layout so users can access it from the bottom panel or as a dedicated view.

### Objective
Add the chat as a tab in the existing bottom panel alongside "Output", "Problems", and "Git Changes". Also add a "Chat" entry in the activity bar for full-view access.

### Architecture Description
The existing `bottomPanel` in the layout already supports tabs. The chat is added as a new tab "AI Chat". When activated, it renders `ChatContainer` within the panel area. The panel can be maximized to give the chat more space.

Additionally, a chat icon is added to the activity bar for quick access. Clicking it opens the bottom panel with the chat tab active (or maximizes it if already open).

### Prompt

```

You are a Senior Software Architect implementing the Chat feature for MyndPrompts.

## Context

- Explore the main layout component that manages the bottom panel and activity bar
- Search for where "bottomPanel" tabs are defined (look for "Output", "Problems", "Git Changes")
- Read the activity bar component to understand how sidebar items are added
- Read `src/i18n/en-US/index.ts` for the existing `bottomPanel.aiChat` key (already exists!)

## Task

1. **Find the bottom panel component** and add the ChatContainer as a new tab:
   - Tab key: 'aiChat'
   - Tab label: uses `t('bottomPanel.aiChat')` (key already exists)
   - Tab icon: 'chat' (Material icon)
   - Tab content: `<ChatContainer />`
   - Import ChatContainer from '@/components/chat/ChatContainer.vue'

2. **Add to activity bar** (if applicable):
   - Add a "Chat" icon button to the activity bar
   - Clicking it should activate the bottom panel with the chat tab
   - Or, if the layout supports it, open chat as a full sidebar view

3. **Keyboard shortcut** (optional):
   - Ctrl/Cmd+Shift+C to toggle the chat panel

Only modify the minimum files necessary. Do NOT restructure existing layout code.

```

---

## Task 13: Localization (10 Locales)

### Purpose
Add translated strings for all chat-related UI text across all 10 supported locales.

### Objective
Add a `chat` section to each locale file with translations for all chat UI components, including session management, messaging, streaming, memory strategies, PDF canvas, toolbar, and error messages.

### Architecture Description
The i18n system uses Vue I18n with per-locale files in `src/i18n/*/index.ts`. Each locale exports a default object with nested keys. The chat feature adds a new top-level `chat` section.

Keys are organized by component area:
- `chat.sessions.*` -- Session list, titles, actions
- `chat.messages.*` -- Message display, roles, timestamps
- `chat.input.*` -- Input area, placeholders, buttons
- `chat.streaming.*` -- Streaming states, thinking indicator
- `chat.memory.*` -- Memory strategy names and descriptions
- `chat.pdf.*` -- PDF canvas controls and labels
- `chat.toolbar.*` -- Toolbar labels and actions
- `chat.errors.*` -- Error messages
- `chat.artifacts.*` -- Artifact rendering (copy code, etc.)

### Prompt

```

You are a Senior Software Architect implementing the Chat feature for MyndPrompts.

## Context

- Read `src/i18n/en-US/index.ts` for the existing i18n structure and patterns
- Read any ONE other locale file (e.g., `src/i18n/pt-BR/index.ts`) to see the translation patterns
- All 10 locale files must be updated: ar-SA, de-DE, en-GB, en-IE, en-US, es-ES, fr-FR, it-IT, pt-BR, pt-PT

## Task

Add a `chat` section to ALL 10 locale files. The English (en-US) version defines the canonical keys:

```typescript
chat: {
  title: 'AI Chat',
  sessions: {
    title: 'Sessions',
    newSession: 'New Session',
    deleteSession: 'Delete Session',
    archiveSession: 'Archive Session',
    deleteConfirm: 'Are you sure you want to delete this session?',
    noSessions: 'No chat sessions yet',
    noSessionsHint: 'Start a new conversation to begin',
    untitled: 'Untitled Session',
    archived: 'Archived',
    messageCount: '{count} message | {count} messages',
  },
  messages: {
    user: 'You',
    assistant: 'Assistant',
    system: 'System',
    copyMessage: 'Copy message',
    copyCode: 'Copy code',
    copied: 'Copied to clipboard',
    branchFrom: 'Branch from here',
    regenerate: 'Regenerate response',
    noMessages: 'Start a conversation',
    noMessagesHint: 'Type a message below to begin chatting with the AI model',
  },
  input: {
    placeholder: 'Type a message...',
    placeholderStreaming: 'Waiting for response...',
    send: 'Send',
    stop: 'Stop',
    attachPdf: 'Attach PDF',
    sendShortcut: 'Enter to send, Shift+Enter for new line',
  },
  streaming: {
    thinking: 'Thinking...',
    showThinking: 'Show thinking',
    hideThinking: 'Hide thinking',
    generating: 'Generating response...',
    stopped: 'Response stopped',
    error: 'Error generating response',
    tokenUsage: '{prompt} prompt + {completion} completion = {total} total tokens',
  },
  memory: {
    title: 'Memory Strategy',
    buffer: 'Buffer',
    bufferDesc: 'Full conversation history',
    bufferWindow: 'Buffer Window',
    bufferWindowDesc: 'Last {count} messages',
    summary: 'Summary',
    summaryDesc: 'LLM-generated summary',
    summaryBuffer: 'Summary + Buffer',
    summaryBufferDesc: 'Summary with recent messages',
    vector: 'Vector',
    vectorDesc: 'Similarity-based retrieval',
    windowSize: 'Window size',
    maxTokens: 'Max tokens',
    strategyChanged: 'Memory strategy updated',
  },
  pdf: {
    title: 'PDF Reference',
    close: 'Close PDF',
    page: 'Page',
    of: 'of',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fitWidth: 'Fit width',
    loading: 'Loading PDF...',
    error: 'Failed to load PDF',
    noDocument: 'No PDF loaded',
    selectFile: 'Select a PDF file to reference during chat',
  },
  toolbar: {
    model: 'Model',
    switchModel: 'Switch Model',
    sessionTitle: 'Session Title',
    editTitle: 'Edit title',
    toggleSessions: 'Toggle sessions',
  },
  errors: {
    sendFailed: 'Failed to send message',
    streamError: 'Streaming error occurred',
    sessionCreateFailed: 'Failed to create session',
    modelSwitchFailed: 'Failed to switch model',
    noModelConfigured: 'No AI model configured. Go to Settings to add a model.',
    connectionFailed: 'Failed to connect to the AI provider',
  },
  artifacts: {
    copyCode: 'Copy code',
    codeCopied: 'Code copied to clipboard',
    openInEditor: 'Open in editor',
    language: 'Language',
    mermaidError: 'Failed to render diagram',
  },
},
```

Translate this ENTIRE section into all 10 locales:

- **en-US**: As shown above (canonical)
- **en-GB**: Same as en-US (minor spelling differences if applicable)
- **en-IE**: Same as en-US
- **pt-BR**: Brazilian Portuguese translations
- **pt-PT**: European Portuguese translations
- **es-ES**: Spanish translations
- **fr-FR**: French translations
- **de-DE**: German translations
- **it-IT**: Italian translations
- **ar-SA**: Arabic translations (RTL layout handled by Quasar)

ADD the `chat` section to each locale file's default export object. Do NOT modify existing keys.

IMPORTANT: Each locale file may have different structure (some may use commas, some may not have trailing commas). Match the existing style of each file when adding the new section.

```

---

## Task 14: Package Dependencies

### Purpose
Install all npm packages required for the chat feature.

### Objective
Add LangChain packages, PDF rendering library, markdown parser, syntax highlighter, and date formatting utility to `package.json`.

### Architecture Description
LangChain packages are split by provider to minimize bundle size. Each `@langchain/*` package provides the chat model class for one provider. The core `langchain` package provides memory classes and shared utilities. `@langchain/core` provides base abstractions.

`pdfjs-dist` is Mozilla's PDF.js, used for client-side PDF rendering. `marked` converts markdown to HTML. `highlight.js` provides syntax highlighting. `date-fns` is a lightweight date formatting library.

### Prompt

```

You are a Senior Software Architect implementing the Chat feature for MyndPrompts.

## Task

Install the following npm packages:

### Production dependencies:

```bash
npm install langchain @langchain/core @langchain/anthropic @langchain/openai @langchain/google-genai @langchain/groq @langchain/ollama pdfjs-dist marked highlight.js date-fns
```

### Dev dependencies (types):

```bash
npm install -D @types/marked
```

After installation:

1. Verify that `package.json` has been updated correctly
2. Run `npx vue-tsc --noEmit` to check for any new type errors introduced by the packages
3. If there are peer dependency warnings, note them but do not force-resolve them

NOTE: `highlight.js` ships its own types. `pdfjs-dist` ships its own types. `date-fns` ships its own types.

```

---

## Task 15: Verification & Testing

### Purpose
Verify that the entire chat feature compiles, the application launches, and the basic flow works end-to-end.

### Objective
Run TypeScript compilation, launch the dev server, and verify the chat UI appears and basic operations work.

### Architecture Description
The verification process:
1. TypeScript check to catch any compile errors across the new files
2. Dev server launch to verify Vite + Quasar + Electron integration
3. Manual walkthrough: open chat panel, create session, send a message (requires a configured AI model), verify streaming works

### Prompt

```

You are a Senior Software Architect verifying the Chat feature implementation.

## Task

### 1. TypeScript Compilation

Run: `npx vue-tsc --noEmit`
Fix any type errors. Common issues:

- Missing imports
- Type mismatches between preload interface and actual API
- Repository method signatures not matching entity types

### 2. Lint Check

Run: `npm run lint` (if available)
Fix any linting issues.

### 3. Dev Server Launch

Run: `npm run dev:electron`
Verify:

- Application launches without errors
- Bottom panel shows "AI Chat" tab
- Clicking "AI Chat" shows the ChatContainer
- Chat toolbar shows model selector (requires configured models)

### 4. Functional Verification

In the running app:

- Open Settings > AI Integration, verify models are configured
- Open AI Chat panel
- Verify a session is auto-created
- Type a message and send
- Verify streaming response appears token-by-token
- Verify thinking indicator appears for Claude models
- Stop a stream mid-response
- Switch models mid-conversation
- Change memory strategy
- Attach a PDF and verify the canvas opens

### 5. Fix any issues found

Document and fix any issues discovered during verification.

```

---

## Summary

This implementation plan consists of 15 tasks that build the Chat feature incrementally:

| Phase | Tasks | Description |
|-------|-------|-------------|
| **Data Layer** | 1-3 | Types, database schema, repositories |
| **Backend** | 4-5 | LangChain service, IPC handlers, preload bridge |
| **State** | 6-7 | Pinia store, streaming composable |
| **UI** | 8-12 | Chat components, PDF canvas, memory UI, layout integration |
| **Polish** | 13-15 | Localization, dependencies, verification |

Each task is self-contained with clear inputs (what to read) and outputs (what to create/modify). Tasks within a phase can be done sequentially. The dependency chain is: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8,9,10,11 (parallel) -> 12 -> 13 -> 14 -> 15.
```
