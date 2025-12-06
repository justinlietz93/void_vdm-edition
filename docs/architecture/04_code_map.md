# Code Map: Key Modules & Responsibilities

**System:** Void Editor (VDM Edition)  
**Commit:** 7c1f1947e3ea704ba30609c343863d16d5c91185  
**Last Updated:** 2025-11-09

## Overview

This document maps the critical code modules within the Void codebase, detailing their responsibilities, dependencies, and interfaces.

---

## 1. Void Core Services (Application Layer)

### 1.1 Chat Thread Service

**Path:** `src/vs/workbench/contrib/void/browser/chatThreadService.ts`

**Responsibilities:**
- Manage conversation threads between user and LLMs
- Maintain message history and thread state
- Coordinate message sending and receiving
- Handle streaming responses from providers
- Persist conversation state

**Key Interfaces:**
- `IChatThreadService` - Main service interface
- `Thread` - Conversation thread model
- `Message` - Individual message model

**Dependencies:**
- `IVoidSettingsService` - Access provider/model configuration
- `IConvertToLLMMessageService` - Format messages for LLMs
- `IToolsService` - Execute tool calls
- Electron Main (via IPC) - Send requests to LLM providers

**Entry Points:**
- `sendMessage(threadId, content)` - User sends new message
- `streamResponse(threadId, provider, model)` - Receive streaming response
- `getThread(threadId)` - Retrieve thread state

---

### 1.2 Edit Code Service

**Path:** `src/vs/workbench/contrib/void/browser/editCodeService.ts`

**Responsibilities:**
- Orchestrate code editing operations (Apply, Cmd+K)
- Manage diff zones for change visualization
- Support Fast Apply (search/replace blocks) and Slow Apply (full file rewrite)
- Coordinate user approval workflow
- Handle streaming code changes from LLMs

**Key Interfaces:**
- `IEditCodeService` - Main service interface
- `DiffZone` - Represents a region with changes
- `DiffArea` - Abstract line range tracker

**Data Structures:**
- `DiffZone`: `{ startLine, endLine, modelUri, llmCancelToken }`
- Tracks pending changes per file/region
- Manages approval state

**Dependencies:**
- `IVoidModelService` - Write changes to text models
- `IVoidSettingsService` - Get Fast/Slow Apply mode preferences
- Helper: `extractCodeFromResult.ts` - Parse LLM output
- Helper: `findDiffs.ts` - Compute line-by-line diffs

**Critical Paths:**
- **Apply Flow**: User clicks Apply → Create DiffZone → Stream changes → Compute diffs → User approves → Write to model
- **Cmd+K Flow**: User selects code + presses Cmd+K → Create smaller DiffZone → LLM edits selection

---

### 1.3 Context Gathering Service

**Path:** `src/vs/workbench/contrib/void/browser/contextGatheringService.ts`

**Responsibilities:**
- Scan workspace for relevant files and code
- Extract symbols (functions, classes, imports)
- Prioritize context based on relevance to query
- Manage token budgets to stay within LLM limits
- Format context for inclusion in prompts

**Key Methods:**
- `gatherContext(query, tokenLimit)` - Main gathering logic
- `scanWorkspace()` - Find all relevant files
- `extractSymbols(file)` - Parse code structure
- `prioritize(files, query)` - Rank by relevance
- `formatForLLM(context)` - Create prompt-ready format

**Dependencies:**
- `IFileService` (Void) - File filtering and queries
- `IWorkspaceContextService` - Workspace access
- `ITextModelService` - Read file contents
- Helper: `languageHelpers.ts` - Language-specific parsing

**Strategies:**
- File relevance scoring (by name, import paths, recent edits)
- Symbol extraction (AST-based when available)
- Chunking large files to fit token limits
- Caching to avoid repeated scans

---

### 1.4 Tools Service

**Path:** `src/vs/workbench/contrib/void/browser/toolsService.ts`

**Responsibilities:**
- Define tools/functions that LLMs can call
- Execute tool calls requested by LLMs
- Parse and validate tool arguments
- Return results to LLM for continuation

**Supported Tools:**
- `edit_file` - Trigger code editing operations
- `read_file` - Fetch file contents
- `list_files` - List workspace files
- `search_code` - Search codebase
- `run_command` - Execute terminal commands (if enabled)

**Tool Definition Format:**
```typescript
{
  name: 'edit_file',
  description: 'Edit code in a file',
  parameters: {
    filePath: { type: 'string', required: true },
    changes: { type: 'string', required: true }
  }
}
```

**Dependencies:**
- `IEditCodeService` - Execute edit operations
- `IContextGatheringService` - Gather additional context
- `ITerminalService` - Run terminal commands

---

### 1.5 Message Converter Service

**Path:** `src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts`

**Responsibilities:**
- Transform Void messages into provider-specific formats
- Inject context into prompts
- Add system prompts and instructions
- Handle different message types (user, assistant, system)

**Provider Formats:**
- OpenAI: `{ role: 'user' | 'assistant' | 'system', content: string }`
- Anthropic: `{ role: 'user' | 'assistant', content: [...blocks] }`
- Mistral, Gemini: Similar variations

**Key Methods:**
- `convertThread(thread, provider)` - Convert full thread
- `injectContext(message, context)` - Add workspace context
- `formatTools(tools, provider)` - Format tool definitions

---

## 2. Infrastructure Services

### 2.1 Void Settings Service

**Path:** `src/vs/workbench/contrib/void/common/voidSettingsService.ts`

**Responsibilities:**
- Store and retrieve user settings
- Manage LLM provider configurations (API keys, endpoints)
- Track model selections per feature (Chat, Autocomplete, Ctrl+K)
- Handle feature flags and preferences

**Settings Structure:**
```typescript
{
  providers: {
    openai: { apiKey: string, endpoint?: string },
    anthropic: { apiKey: string },
    ollama: { endpoint: string }
  },
  modelSelections: {
    chat: { provider: 'openai', model: 'gpt-4' },
    autocomplete: { provider: 'anthropic', model: 'claude-3-5-sonnet' }
  },
  features: {
    fastApply: boolean,
    autoContext: boolean,
    telemetry: boolean
  }
}
```

**Storage:** Local storage via VS Code settings infrastructure

**Dependencies:**
- `IStorageService` - Persist to local storage
- `IConfigurationService` - VS Code config integration

---

### 2.2 Void Model Service

**Path:** `src/vs/workbench/contrib/void/browser/voidModelService.ts` (inferred)

**Responsibilities:**
- Manage text model lifecycle
- Handle URI to model mapping
- Write changes without explicit save/load
- Coordinate model updates across editors

**Key Methods:**
- `getModel(uri)` - Get or create model
- `writeToModel(uri, edits)` - Apply text edits
- `closeModel(uri)` - Release model resources

**Critical Details:**
- Text models are shared across split editors
- Writes are immediate (no save required)
- Background URI/model lifecycle handled transparently

---

### 2.3 Refresh Model Service

**Path:** `src/vs/workbench/contrib/void/common/refreshModelService.ts`

**Responsibilities:**
- Poll LLM providers for available models
- Update dynamic model lists (e.g., Ollama local models)
- Notify UI when models change
- Cache model lists with TTL

**Refresh Strategy:**
- On provider configuration change
- Periodic polling (configurable interval)
- On-demand refresh from UI

**Dependencies:**
- Electron Main (via IPC) - Query provider APIs
- `IVoidSettingsService` - Get provider endpoints

---

### 2.4 File Service (Void)

**Path:** `src/vs/workbench/contrib/void/browser/fileService.ts`

**Responsibilities:**
- Filter workspace files by patterns
- Exclude node_modules, .git, etc.
- Query files by type, name, path
- Provide file metadata for context gathering

**Key Methods:**
- `getWorkspaceFiles(pattern?)` - List files matching pattern
- `filterByExtension(extensions)` - Filter by file type
- `excludePatterns(patterns)` - Apply exclusion rules

---

## 3. Electron Main Process

### 3.1 LLM Communication Module

**Path:** `src/vs/code/electron-main/llm/` (inferred)

**Responsibilities:**
- Make actual HTTP requests to LLM providers
- Handle streaming responses
- Manage API keys securely (currently via settings)
- Retry logic and error handling

**Provider Clients:**
- OpenAI Client (`openai` npm package)
- Anthropic Client (`@anthropic-ai/sdk`)
- Mistral Client (`@mistralai/mistralai`)
- Google Gemini Client (`@google/genai`)
- Ollama Client (`ollama`)
- Groq Client (`groq-sdk`)

**IPC Interface:**
- Renderer sends: `{ provider, model, messages, tools, stream: true }`
- Main responds: Stream of `{ delta: string }` or `{ done: true, usage: {...} }`

---

## 4. Helper Utilities (Domain Layer)

### 4.1 Extract Code from Result

**Path:** `src/vs/workbench/contrib/void/common/helpers/extractCodeFromResult.ts`

**Responsibilities:**
- Parse LLM output for code blocks
- Extract Fast Apply search/replace blocks
- Identify code fences (```language)
- Clean and normalize code

**Patterns Detected:**
- Markdown code blocks: ` ```language ... ``` `
- Fast Apply blocks: ` <<<<<<< ORIGINAL ... ======= ... >>>>>>> UPDATED `

---

### 4.2 Find Diffs

**Path:** `src/vs/workbench/contrib/void/browser/helpers/findDiffs.ts`

**Responsibilities:**
- Compute line-by-line diffs between original and modified text
- Identify added, removed, and modified lines
- Generate diff data structure for visualization
- Support various diff algorithms (Myers, patience)

**Output Format:**
```typescript
{
  changes: [
    { type: 'add', line: 10, content: '...' },
    { type: 'remove', line: 12, content: '...' },
    { type: 'modify', line: 15, oldContent: '...', newContent: '...' }
  ]
}
```

---

### 4.3 Language Helpers

**Path:** `src/vs/workbench/contrib/void/common/helpers/languageHelpers.ts`

**Responsibilities:**
- Detect language from file extension or content
- Language-specific symbol extraction
- Comment style detection
- Syntax-aware code chunking

---

## 5. UI Components (Presentation Layer)

### 5.1 Sidebar Pane

**Path:** `src/vs/workbench/contrib/void/browser/sidebarPane.ts`

**Responsibilities:**
- Render chat interface (React)
- Display conversation threads
- Handle user input (text, files, selections)
- Show streaming responses
- Render diff previews
- Apply/Reject buttons

**React Component Structure:**
- `SidebarPane` - Main container
- `ThreadList` - List of conversations
- `MessageList` - Messages in active thread
- `MessageInput` - User input field
- `DiffPreview` - Inline diff display

---

### 5.2 Settings Pane

**Path:** `src/vs/workbench/contrib/void/browser/voidSettingsPane.ts`

**Responsibilities:**
- Provider configuration UI
- Model selection dropdowns
- API key input fields
- Feature toggle switches
- Save/reset functionality

---

## 6. Model Capabilities

**Path:** `src/vs/workbench/contrib/void/common/modelCapabilities.ts` (inferred)

**Responsibilities:**
- Define token limits per model
- Feature support flags (tools, streaming, vision)
- Pricing information (optional)
- Model release dates for deprecation

**Example Data:**
```typescript
{
  'gpt-4': {
    maxTokens: 8192,
    supportsTools: true,
    supportsStreaming: true,
    costPer1kTokens: { input: 0.03, output: 0.06 }
  },
  'claude-3-5-sonnet-20241022': {
    maxTokens: 200000,
    supportsTools: true,
    supportsStreaming: true
  }
}
```

**Critical:** Must be updated when providers release new models

---

## 7. External Dependencies

### 7.1 VS Code Platform Services

Used by Void components:

- `ITextModelService` - Access to text models
- `ICodeEditorService` - Access to editors
- `IWorkspaceContextService` - Workspace information
- `IStorageService` - Persistent storage
- `IConfigurationService` - Settings
- `ITerminalService` - Terminal integration
- `INotificationService` - User notifications

### 7.2 Third-Party Libraries

**LLM SDKs:**
- `openai@^4.96.0` - OpenAI API client
- `@anthropic-ai/sdk@^0.40.0` - Anthropic API client
- `@mistralai/mistralai@^1.6.0` - Mistral AI client
- `@google/genai@^0.13.0` - Google Gemini client
- `groq-sdk@^0.20.1` - Groq API client
- `ollama@^0.5.15` - Ollama local client

**UI Libraries:**
- `react@^19.1.0` - UI framework
- `react-dom@^19.1.0` - React rendering
- `lucide-react@^0.503.0` - Icon library
- `marked@^15.0.11` - Markdown parsing

**Utilities:**
- `diff@^7.0.0` - Text diff algorithm
- `ajv@^8.17.1` - JSON schema validation
- `cross-spawn@^7.0.6` - Cross-platform process spawning

**Analytics:**
- `posthog-node@^4.14.0` - Usage telemetry

---

## 8. File Organization

### Directory Structure

```
src/vs/workbench/contrib/void/
├── browser/                    # Renderer process code
│   ├── sidebarPane.ts         # Main UI
│   ├── chatThreadService.ts   # Chat logic
│   ├── editCodeService.ts     # Apply logic
│   ├── contextGatheringService.ts
│   ├── toolsService.ts
│   ├── voidSettingsPane.ts
│   ├── convertToLLMMessageService.ts
│   ├── helpers/
│   │   ├── findDiffs.ts
│   │   └── ...
│   └── react/                 # React components
│       ├── build.js           # React build script
│       └── ...
├── common/                     # Shared code (main + renderer)
│   ├── voidSettingsService.ts
│   ├── voidSettingsTypes.ts
│   ├── refreshModelService.ts
│   └── helpers/
│       ├── extractCodeFromResult.ts
│       ├── languageHelpers.ts
│       └── ...
└── electron-main/             # Main process code (inferred)
    └── llm/                   # LLM provider communication
```

---

## 9. Key Entry Points

### User Actions → Code Paths

1. **Send Chat Message**
   - `SidebarPane` (user input) → `ChatThreadService.sendMessage()`
   - → `ContextGatheringService.gatherContext()`
   - → `ConvertToLLMMessageService.convertThread()`
   - → IPC to Electron Main → LLM Provider API
   - ← Stream response back to `ChatThreadService`
   - → Update `SidebarPane` UI

2. **Click Apply**
   - `SidebarPane` (Apply button) → `EditCodeService.apply()`
   - → `extractCodeFromResult()` parse LLM output
   - → `findDiffs()` compute changes
   - → Create `DiffZone`, render in editor
   - → User approves → `VoidModelService.writeToModel()`

3. **Cmd+K (Quick Edit)**
   - Keybinding → `EditCodeService.quickEdit(selection)`
   - → Create small `DiffZone` for selection
   - → Stream LLM response → `findDiffs()` → Render
   - → User approves → Write to model

4. **Configure Provider**
   - `SettingsPane` (input API key) → `VoidSettingsService.setProvider()`
   - → Save to local storage
   - → Trigger `RefreshModelService.refresh()`
   - → Update model dropdown

---

## 10. Data Flow Summary

```
User Input
    ↓
[Presentation Layer: Sidebar, Settings]
    ↓
[Application Layer: ChatThread, EditCode, ContextGather, Tools]
    ↓
[Infrastructure Layer: Settings, VoidModel, FileService]
    ↓
[Domain Layer: Helpers, Model Capabilities]
    ↓
IPC to Electron Main
    ↓
[Main Process: LLM Communication]
    ↓
External LLM Provider APIs
    ↓
← Streaming Response
    ↓
[Renderer: Update UI, Apply Changes]
```

---

## 11. Testing & Observability

### Current State

**Tests:**
- Limited test infrastructure observed
- No dedicated test directory for Void services
- VS Code base has extensive tests, but Void-specific coverage is minimal

**Logging:**
- Console logs scattered throughout
- No structured logging framework
- PostHog analytics for usage events

### Recommendations

1. Add unit tests for services (ChatThread, EditCode, ContextGather)
2. Mock LLM responses for integration tests
3. Implement structured logging with correlation IDs
4. Add performance metrics for context gathering and LLM calls
5. Error tracking with stack traces

---

## 12. Links to Source

All paths relative to repository root:

- **Void Core:** [src/vs/workbench/contrib/void/](../../../src/vs/workbench/contrib/void/)
- **Chat Service:** [src/vs/workbench/contrib/void/browser/chatThreadService.ts](../../../src/vs/workbench/contrib/void/browser/chatThreadService.ts)
- **Edit Service:** [src/vs/workbench/contrib/void/browser/editCodeService.ts](../../../src/vs/workbench/contrib/void/browser/editCodeService.ts)
- **Context Service:** [src/vs/workbench/contrib/void/browser/contextGatheringService.ts](../../../src/vs/workbench/contrib/void/browser/contextGatheringService.ts)
- **Settings Service:** [src/vs/workbench/contrib/void/common/voidSettingsService.ts](../../../src/vs/workbench/contrib/void/common/voidSettingsService.ts)

---

*This code map is a living document. Update as new services and modules are added.*
