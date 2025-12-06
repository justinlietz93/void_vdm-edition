# Refactor Plan & Technical Debt Roadmap

**System:** Void Editor (VDM Edition)  
**Commit:** 7c1f1947e3ea704ba30609c343863d16d5c91185  
**Date:** 2025-11-09

---

## Executive Summary

This document provides a **prioritized refactoring roadmap** organized by effort level (Quick Wins → Medium → Strategic) with estimated timelines, effort, and expected impact.

---

## 1. Quick Wins (1-2 Days Each)

### QW-001: Implement Secure API Key Storage ⚠️ HIGH PRIORITY

**Current State:** API keys stored in plain text in local storage  
**Target State:** Use OS-level secure storage (Keychain, Credential Manager, Secret Service)

**Implementation:**
```typescript
// Use electron-store with encryption or OS keychain
import keytar from 'keytar';

async function setApiKey(provider: string, key: string): Promise<void> {
  await keytar.setPassword('void-editor', `${provider}-api-key`, key);
}

async function getApiKey(provider: string): Promise<string | null> {
  return await keytar.getPassword('void-editor', `${provider}-api-key`);
}
```

**Files to Modify:**
- `voidSettingsService.ts` - Update get/set provider methods
- Add `keytar` or similar dependency

**Effort:** 1 day  
**Impact:** HIGH (Security vulnerability mitigation)  
**Owner:** Security-focused developer

---

### QW-002: Add Correlation IDs for Request Tracing

**Current State:** No way to trace requests across services  
**Target State:** Every operation has a unique correlation ID

**Implementation:**
```typescript
// Add to service method signatures
interface ServiceContext {
  correlationId: string;
  timestamp: Date;
}

function sendMessage(threadId: string, content: string, ctx: ServiceContext) {
  logger.info('Sending message', { correlationId: ctx.correlationId, threadId });
  // ...
}
```

**Files to Modify:**
- All service methods
- Add correlation ID middleware/interceptor

**Effort:** 1-2 days  
**Impact:** MEDIUM (Improved debugging)  
**Owner:** Backend developer

---

### QW-003: Normalize Error Handling

**Current State:** Inconsistent error handling, cryptic error messages  
**Target State:** Error taxonomy with user-friendly messages

**Implementation:**
```typescript
// Define error classes
class VoidError extends Error {
  constructor(
    public code: string,
    message: string,
    public userMessage: string,
    public details?: any
  ) {
    super(message);
  }
}

class ProviderError extends VoidError {
  constructor(provider: string, originalError: Error) {
    super(
      'PROVIDER_ERROR',
      `Provider ${provider} failed: ${originalError.message}`,
      `Unable to connect to ${provider}. Please check your API key and internet connection.`,
      { provider, originalError }
    );
  }
}
```

**Files to Modify:**
- Create `errors.ts` with error taxonomy
- Update all catch blocks to use typed errors
- Display `userMessage` in UI

**Effort:** 1 day  
**Impact:** MEDIUM (Better UX)  
**Owner:** Any developer

---

### QW-004: Add Loading Indicators for Long Operations

**Current State:** No feedback during context gathering, apply operations  
**Target State:** Progress bars and loading states

**Implementation:**
- `ContextGatheringService`: Emit progress events (10%, 20%, ...)
- UI: Show progress bar during context gathering
- Apply: Show "Computing diffs..." indicator

**Files to Modify:**
- `contextGatheringService.ts` - Add progress events
- `sidebarPane.ts` - Add progress UI

**Effort:** 1 day  
**Impact:** MEDIUM (Better UX)  
**Owner:** Frontend developer

---

### QW-005: Implement Request Rate Limiting

**Current State:** No rate limiting on LLM requests  
**Target State:** Configurable rate limits per provider

**Implementation:**
```typescript
class RateLimiter {
  private tokens: Map<string, number> = new Map();
  
  async acquire(key: string, maxPerMinute: number): Promise<void> {
    // Token bucket algorithm
    const now = Date.now();
    const tokens = this.tokens.get(key) || maxPerMinute;
    
    if (tokens <= 0) {
      await this.wait(60000 / maxPerMinute);
    }
    
    this.tokens.set(key, tokens - 1);
    // Refill tokens over time
  }
}
```

**Files to Modify:**
- Add rate limiter to LLM communication module
- Configure limits per provider

**Effort:** 1 day  
**Impact:** MEDIUM (Cost control, API compliance)  
**Owner:** Backend developer

---

### QW-006: Add JSDoc Comments to Public APIs

**Current State:** Minimal documentation  
**Target State:** All public interfaces and methods documented

**Implementation:**
```typescript
/**
 * Sends a message to the LLM and streams the response.
 * 
 * @param threadId - Unique identifier for the conversation thread
 * @param content - User's message content
 * @returns Promise that resolves when streaming is complete
 * @throws {ProviderError} If the LLM provider fails to respond
 * @example
 * ```typescript
 * await chatService.sendMessage('thread-123', 'Explain recursion');
 * ```
 */
async sendMessage(threadId: string, content: string): Promise<void> {
  // ...
}
```

**Files to Modify:**
- All service files
- Generate TypeDoc output

**Effort:** 2 days  
**Impact:** LOW (Developer experience)  
**Owner:** Any developer

---

## 2. Medium-Term Improvements (1-2 Weeks Each)

### MT-001: Extract Large Services

**Current State:** `editCodeService.ts` (~800 LOC), `chatThreadService.ts` (~600 LOC)  
**Target State:** Smaller, focused services

**Refactoring Strategy:**

**Edit Code Service → Multiple Services:**
- `ApplyService` - Handles apply operations
- `DiffZoneManager` - Manages diff zones
- `FastApplyStrategy` / `SlowApplyStrategy` - Strategy pattern for apply modes

**Chat Thread Service → Decomposition:**
- `ThreadRepository` - Thread CRUD operations
- `MessageStreamHandler` - Streaming logic
- `ToolExecutor` - Tool call execution

**Effort:** 1-2 weeks  
**Impact:** MEDIUM (Maintainability)  
**Owner:** Experienced developer

---

### MT-002: Implement Comprehensive Test Suite

**Current State:** 0% test coverage  
**Target State:** 70% coverage for core services

**Test Strategy:**

**Phase 1: Unit Tests for Helpers (Week 1)**
- `extractCodeFromResult.ts` - 100% coverage
- `findDiffs.ts` - 100% coverage
- `languageHelpers.ts` - 90% coverage

**Phase 2: Service Tests (Week 2)**
- `contextGatheringService.ts` - Mock file system, test filtering logic
- `voidSettingsService.ts` - Test CRUD operations
- `toolsService.ts` - Test tool definitions and execution

**Phase 3: Integration Tests (Week 3)**
- LLM message pipeline with mocked provider
- Apply pipeline end-to-end
- Context gathering with test workspace

**Test Framework Setup:**
```typescript
// Use Mocha + Sinon
import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

describe('ContextGatheringService', () => {
  let service: ContextGatheringService;
  let fileServiceStub: sinon.SinonStub;
  
  beforeEach(() => {
    fileServiceStub = sinon.stub();
    service = new ContextGatheringService(fileServiceStub);
  });
  
  it('should gather context within token limit', async () => {
    // Test implementation
  });
});
```

**Effort:** 3 weeks  
**Impact:** HIGH (Quality, confidence in refactoring)  
**Owner:** QA-focused developer

---

### MT-003: Add Provider Failover & Retry Logic

**Current State:** Single provider request, fails immediately on error  
**Target State:** Automatic retry with exponential backoff, optional failover provider

**Implementation:**
```typescript
interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  failoverProvider?: string;
}

async function sendWithRetry(
  provider: string,
  request: LLMRequest,
  config: RetryConfig
): Promise<LLMResponse> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await sendRequest(provider, request);
    } catch (error) {
      lastError = error;
      if (isTransientError(error) && attempt < config.maxAttempts) {
        const delay = Math.min(
          config.initialDelayMs * Math.pow(2, attempt - 1),
          config.maxDelayMs
        );
        await sleep(delay);
      }
    }
  }
  
  // Try failover provider if configured
  if (config.failoverProvider) {
    return await sendRequest(config.failoverProvider, request);
  }
  
  throw lastError;
}
```

**Effort:** 1 week  
**Impact:** HIGH (Reliability)  
**Owner:** Backend developer

---

### MT-004: Implement Caching Layer

**Current State:** No caching, repeated operations waste resources  
**Target State:** Multi-level caching with TTL

**Cache Strategy:**

**Level 1: In-Memory Cache**
- Model capabilities (static data)
- Parsed workspace symbols (5 min TTL)
- File lists (1 min TTL)

**Level 2: Persistent Cache**
- LLM responses for identical prompts (optional, 1 day TTL)
- Workspace metadata (until file change)

**Implementation:**
```typescript
interface CacheEntry<T> {
  value: T;
  expiresAt: Date;
}

class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  
  set<T>(key: string, value: T, ttlMs: number): void {
    this.cache.set(key, {
      value,
      expiresAt: new Date(Date.now() + ttlMs)
    });
  }
  
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    if (entry.expiresAt < new Date()) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.value;
  }
}
```

**Effort:** 1 week  
**Impact:** MEDIUM (Performance)  
**Owner:** Backend developer

---

### MT-005: Performance Optimization for Large Workspaces

**Current State:** Context gathering blocks UI on large workspaces  
**Target State:** Asynchronous, cancellable operations with progress

**Optimizations:**

1. **Async File Scanning:**
   - Use Web Worker or separate process for file traversal
   - Yield control to UI thread periodically

2. **File Limit Cap:**
   - Default: Max 10,000 files scanned
   - Configurable in settings

3. **Incremental Loading:**
   - Load file list incrementally (batches of 1000)
   - Allow cancellation at any point

4. **Indexing (Future):**
   - Build and maintain workspace index
   - Update incrementally on file changes

**Effort:** 1-2 weeks  
**Impact:** HIGH (UX on large projects)  
**Owner:** Performance-focused developer

---

### MT-006: Extract Provider Client Factory

**Current State:** Provider client instantiation scattered  
**Target State:** Centralized factory with consistent error handling

**Implementation:**
```typescript
interface LLMProvider {
  name: string;
  sendRequest(request: LLMRequest): Promise<LLMResponse>;
  streamRequest(request: LLMRequest): AsyncIterator<LLMDelta>;
}

class ProviderFactory {
  createProvider(config: ProviderConfig): LLMProvider {
    switch (config.name) {
      case 'openai':
        return new OpenAIProvider(config.apiKey, config.endpoint);
      case 'anthropic':
        return new AnthropicProvider(config.apiKey);
      // ...
      default:
        throw new Error(`Unknown provider: ${config.name}`);
    }
  }
}
```

**Effort:** 1 week  
**Impact:** MEDIUM (Extensibility)  
**Owner:** Backend developer

---

## 3. Strategic Initiatives (1-3 Months)

### STR-001: Extract Core AI Logic into Standalone Library

**Vision:** Void's AI capabilities as a reusable library

**Structure:**
```
@void/ai-core
  ├── providers/      # LLM provider abstractions
  ├── context/        # Context gathering
  ├── tools/          # Tool definitions and execution
  ├── diff/           # Diff computation
  └── streaming/      # Streaming handlers
```

**Benefits:**
- Reusable in other projects (CLI, web app, VSCode extension)
- Easier to test in isolation
- Clear API boundaries

**Effort:** 2-3 months  
**Impact:** HIGH (Reusability, architecture)  
**Owner:** Team lead + 2 developers

---

### STR-002: Implement VSCode Adapter Layer

**Current State:** Direct dependencies on VSCode internals  
**Target State:** Abstraction layer for VSCode APIs

**Rationale:**
- Easier to upgrade VSCode base
- Potential to support other editors (JetBrains, etc.)
- Clearer architectural boundaries

**Adapter Interfaces:**
```typescript
interface IEditorAdapter {
  getActiveFile(): URI;
  writeToFile(uri: URI, content: string): void;
  addDecoration(uri: URI, ranges: Range[], style: DecorationType): void;
}

interface IWorkspaceAdapter {
  listFiles(pattern?: string): Promise<URI[]>;
  readFile(uri: URI): Promise<string>;
  getWorkspaceRoot(): URI;
}
```

**Effort:** 2 months  
**Impact:** MEDIUM (Maintainability, portability)  
**Owner:** Senior developer

---

### STR-003: Build Comprehensive Developer Documentation

**Goal:** Make Void contribution-friendly

**Documentation Package:**

1. **Architecture Guide** (✅ This document series)
2. **Contributing Guide:**
   - How to add a new LLM provider (step-by-step)
   - How to add a new tool
   - How to build and test locally
   - Code review process

3. **API Reference:**
   - Generated from JSDoc (TypeDoc)
   - Public interfaces clearly marked
   - Examples for each major API

4. **Video Tutorials:**
   - Codebase walkthrough
   - "Add your first provider" tutorial
   - Debugging techniques

**Effort:** 1 month (initial), ongoing maintenance  
**Impact:** MEDIUM (Community growth)  
**Owner:** Technical writer + developer

---

### STR-004: Microservices for LLM Communication (Optional)

**Vision:** Separate LLM communication into standalone service

**Architecture:**
```
Void Electron App (UI + Editor)
    ↓ HTTP/WebSocket
Void AI Service (Node.js/Go)
    ↓ HTTPS
LLM Providers
```

**Benefits:**
- Language-agnostic (can use Go for better performance)
- Easier horizontal scaling
- Shared service across multiple editor instances
- Better resource isolation

**Challenges:**
- Increased complexity
- Deployment overhead
- Requires robust IPC/RPC

**Effort:** 3 months  
**Impact:** MEDIUM (Scalability, optional optimization)  
**Owner:** Team lead + 2 developers

---

### STR-005: Plugin System for Tools and Capabilities

**Vision:** User-extensible tool system

**Features:**
- User can define custom tools via JSON/TypeScript
- Tools can be packaged as extensions
- Marketplace for community-contributed tools

**Example Tool Definition:**
```typescript
// ~/.void/tools/my-tool.ts
export const tool: ToolDefinition = {
  name: 'search_documentation',
  description: 'Search project documentation',
  parameters: {
    query: { type: 'string', required: true }
  },
  execute: async (args) => {
    // Custom implementation
    return searchDocs(args.query);
  }
};
```

**Effort:** 2 months  
**Impact:** HIGH (Extensibility, community)  
**Owner:** Senior developer

---

## 4. Prioritization Matrix

| Initiative | Effort | Impact | Priority | Timeline |
|------------|--------|--------|----------|----------|
| QW-001: Secure API Keys | Low | High | **P0** | Week 1 |
| QW-003: Error Handling | Low | Med | **P1** | Week 1 |
| MT-002: Test Suite | High | High | **P0** | Month 1-2 |
| MT-003: Failover & Retry | Med | High | **P1** | Month 2 |
| MT-005: Performance Opt | Med | High | **P1** | Month 2-3 |
| QW-002: Correlation IDs | Low | Med | **P2** | Month 1 |
| QW-005: Rate Limiting | Low | Med | **P2** | Month 1 |
| MT-001: Extract Services | Med | Med | **P2** | Month 3 |
| MT-004: Caching | Med | Med | **P2** | Month 3 |
| MT-006: Provider Factory | Med | Med | **P3** | Month 4 |
| STR-001: AI Core Library | High | High | **P2** | Month 4-6 |
| STR-002: VSCode Adapter | High | Med | **P3** | Month 6-8 |
| STR-003: Documentation | Med | Med | **P2** | Ongoing |
| STR-005: Plugin System | High | High | **P3** | Month 8-10 |
| STR-004: Microservices | High | Med | **P4** | Future |

---

## 5. Execution Plan

### Month 1: Foundation

- ✅ Secure API key storage
- ✅ Error handling normalization
- ✅ Correlation IDs
- ✅ Rate limiting
- ⏱️ Begin test suite (helpers)

### Month 2: Quality & Reliability

- ⏱️ Complete test suite (services)
- ✅ Failover & retry logic
- ✅ Performance optimizations (context gathering)
- ⏱️ Begin integration tests

### Month 3: Architecture Improvements

- ✅ Caching layer
- ✅ Extract large services
- ⏱️ E2E test suite
- ⏱️ Begin AI core library extraction

### Months 4-6: Strategic Initiatives

- ⏱️ Complete AI core library
- ⏱️ Developer documentation
- ⏱️ Plugin system foundation

### Months 6+: Advanced Features

- ⏱️ VSCode adapter layer
- ⏱️ Plugin marketplace
- ⏱️ Consider microservices (if needed)

---

## 6. Success Metrics

| Metric | Baseline | 3-Month Target | 6-Month Target |
|--------|----------|----------------|----------------|
| Test Coverage | 0% | 70% | 85% |
| Security Score | 4/10 | 7/10 | 9/10 |
| Service File Size (avg LOC) | 600 | 400 | 300 |
| Error Resolution Time | Unknown | < 1 day | < 4 hours |
| Contributor Onboarding Time | Unknown | 1 day | 2 hours |

---

## 7. Risk Mitigation

### Risk: Breaking Changes During Refactoring

**Mitigation:**
- Comprehensive test suite before major refactors
- Feature flags for new implementations
- Gradual rollout (beta channel)

### Risk: Scope Creep

**Mitigation:**
- Strict prioritization (P0/P1 first)
- Time-boxed initiatives
- Regular review of progress vs. plan

### Risk: Dependency on External Services

**Mitigation:**
- Provider abstraction layer
- Retry and failover logic
- Local-first features (Ollama)

---

## Conclusion

This refactor plan balances **immediate security and quality needs** (Quick Wins) with **long-term architectural improvements** (Strategic Initiatives). By following this roadmap, Void will achieve:

✅ Production-grade security and reliability  
✅ 70%+ test coverage for confidence in changes  
✅ Improved performance on large workspaces  
✅ Clear, maintainable architecture  
✅ Extensible plugin system for community growth

**Recommended Start:** Begin with QW-001 (Secure API Keys) and MT-002 (Test Suite) immediately.
