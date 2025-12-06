# Operability & Observability

**System:** Void Editor (VDM Edition)  
**Commit:** 7c1f1947e3ea704ba30609c343863d16d5c91185  
**Date:** 2025-11-09

---

## 1. Logging

### 1.1 Current State

**Logging Mechanisms:**
- `console.log()` statements scattered throughout codebase
- No structured logging framework
- No log levels (DEBUG, INFO, WARN, ERROR)
- No correlation IDs for request tracing

**Output Destinations:**
- Development: Browser console + Node console
- Production: Electron logs (platform-specific locations)

### 1.2 Gaps

- ❌ No centralized logging service
- ❌ No log aggregation or analysis
- ❌ Difficult to trace request flows across IPC boundary
- ❌ No log rotation or retention policy

### 1.3 Recommendations

**Implement Structured Logging:**

```typescript
interface LogEntry {
  timestamp: Date;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  service: string;
  correlationId: string;
  message: string;
  metadata?: any;
}
```

**Logging Service:**
- Centralized logger with consistent format
- Correlation IDs for tracing requests across services
- Configurable log levels per environment
- Log sanitization (remove API keys, PII)

**Log Destinations:**
- Development: Console (pretty-printed)
- Production: File logs + optional remote logging (Datadog, CloudWatch)

---

## 2. Metrics & Telemetry

### 2.1 Current State

**Analytics:**
- PostHog integration for usage events
- Events tracked: User actions, feature usage

**Gaps:**
- No performance metrics
- No error rate tracking
- No operational health metrics
- No custom dashboards

### 2.2 Key Metrics to Track

**Performance Metrics:**
- LLM request latency (p50, p95, p99)
- Context gathering duration
- Diff computation time
- UI render time
- Token streaming rate

**Reliability Metrics:**
- Error rate by service
- Provider API failure rate
- Retry success rate
- Request timeout rate

**Usage Metrics:**
- Active users (DAU, MAU)
- Messages sent per session
- Apply operations per session
- Provider usage distribution
- Average context size

**Business Metrics:**
- User retention rate
- Feature adoption rate
- Provider API costs per user

### 2.3 Recommended Implementation

**Metrics Service:**
```typescript
interface IMetricsService {
  recordLatency(operation: string, durationMs: number): void;
  incrementCounter(metric: string, tags?: Record<string, string>): void;
  recordGauge(metric: string, value: number): void;
}
```

**Instrumentation Points:**
- Service method entry/exit (duration)
- Error catch blocks (error rate)
- LLM API calls (latency, tokens, cost)
- User interactions (usage tracking)

**Metrics Backend Options:**
- Prometheus + Grafana (self-hosted)
- DataDog (SaaS)
- AWS CloudWatch (if cloud-hosted)

---

## 3. Distributed Tracing

### 3.1 Current State

**Status:** ❌ Not implemented

**Challenge:** Following a request across:
- UI (React) → ChatThreadService → IPC → Electron Main → LLM Provider

### 3.2 Recommendation

**Implement Correlation IDs:**
- Generate unique ID per user action
- Pass through all layers (UI → Service → IPC → Provider)
- Include in logs, metrics, error reports

**Trace Context:**
```typescript
interface TraceContext {
  traceId: string;        // Unique per request
  spanId: string;         // Unique per service hop
  parentSpanId?: string;  // Link to parent
  timestamp: Date;
}
```

**Visualization:**
- OpenTelemetry for instrumentation
- Jaeger or Zipkin for trace visualization
- Example trace: `User sends message [50ms] → Context gathering [2s] → LLM call [5s] → Response render [100ms]`

---

## 4. Health Monitoring

### 4.1 Health Checks

**Recommended Endpoints/Status:**
- Main Process health
- Provider connectivity (ping)
- File system access
- Local storage integrity
- Extension host status

**Health Check API:**
```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    electronMain: boolean;
    llmProviders: Record<string, boolean>;
    fileSystem: boolean;
    storage: boolean;
  };
  timestamp: Date;
}
```

### 4.2 Alerting

**Alert Conditions:**
- Error rate > 5% over 5 minutes
- LLM latency p95 > 10 seconds
- Provider failures > 10 in 1 minute
- Main process crashes

**Alert Channels:**
- Development: Console warnings
- Production: Email, Slack, PagerDuty (if applicable)

---

## 5. Configuration Management

### 5.1 Current State

**Configuration Sources:**
- Local storage (user settings)
- `product.json` (application metadata)
- Environment variables (limited use)

**Gaps:**
- No centralized config service
- No config validation on load
- No config versioning or migration
- Hard to test different configs

### 5.2 Recommendations

**Configuration Service:**
```typescript
interface IConfigService {
  get<T>(key: string, defaultValue?: T): T;
  set(key: string, value: any): void;
  validate(): ConfigValidationResult;
}
```

**Configuration Schema:**
```json
{
  "llm": {
    "defaultProvider": "openai",
    "maxTokens": 8192,
    "streamingEnabled": true,
    "timeout": 30000
  },
  "features": {
    "fastApply": true,
    "autoContext": true,
    "telemetry": false
  },
  "performance": {
    "maxWorkspaceFiles": 10000,
    "contextSizeLimit": 100000,
    "cacheTTL": 300000
  }
}
```

**Features:**
- JSON Schema validation
- Environment-specific overrides (dev/prod)
- Hot reload (for non-critical settings)
- Config migration on version upgrades

---

## 6. Feature Flags

### 6.1 Current State

**Status:** Basic feature toggles in settings

**Limitations:**
- No remote feature flags
- No A/B testing capability
- No gradual rollouts
- No user segmentation

### 6.2 Recommendations

**Feature Flag Service:**
```typescript
interface IFeatureFlagService {
  isEnabled(flag: string, userId?: string): boolean;
  getVariant(experiment: string, userId?: string): string;
}
```

**Use Cases:**
- Gradual rollout of new features
- Kill switch for problematic features
- A/B testing (e.g., Fast Apply vs Slow Apply default)
- User-specific feature access (beta testers)

**Implementation Options:**
- Local: Simple boolean flags in config
- Remote: LaunchDarkly, Split.io (for complex needs)

---

## 7. Error Tracking

### 7.1 Current State

**Error Handling:**
- Try-catch blocks with console logging
- No centralized error tracking
- No error aggregation or analytics

**Gaps:**
- Can't see error frequency or trends
- No stack trace aggregation
- No user impact visibility
- No automated alerting

### 7.2 Recommendations

**Error Tracking Service Integration:**
- **Options:** Sentry, Rollbar, Bugsnag
- **Features:** Stack traces, breadcrumbs, user context, release tracking

**Error Service:**
```typescript
interface IErrorService {
  captureException(error: Error, context?: any): void;
  captureMessage(message: string, level: 'info' | 'warning' | 'error'): void;
  setUser(userId: string, metadata?: any): void;
}
```

**Context to Capture:**
- User ID (anonymous or hashed)
- Provider & model in use
- Operation in progress (e.g., "apply", "send_message")
- Workspace size, file count
- Application version

---

## 8. Performance Monitoring

### 8.1 Current State

**Status:** No performance monitoring

**Impact:** Can't identify slow operations or regressions

### 8.2 Recommendations

**Performance Profiling:**
- Built-in: Chrome DevTools (for renderer process)
- Node.js: `--inspect` flag for Main process
- Production: Profiling snapshots on performance degradation

**APM (Application Performance Monitoring):**
- Track slow transactions
- Identify bottlenecks (database, network, CPU)
- Options: New Relic, Datadog APM

**Custom Performance Marks:**
```typescript
performance.mark('context-gathering-start');
// ... gather context
performance.mark('context-gathering-end');
performance.measure('context-gathering', 'context-gathering-start', 'context-gathering-end');
```

---

## 9. Debugging Tools

### 9.1 Built-in Tools

**Available:**
- VSCode debugger (TypeScript debugging)
- Electron DevTools (Browser process)
- Node.js Inspector (Main process)

**Gaps:**
- No LLM request/response inspector
- No context gathering visualizer
- No diff computation debugger

### 9.2 Recommended Debug Features

**Debug Panel UI:**
- Show recent LLM requests/responses
- Display gathered context with token counts
- Visualize diff computation steps
- Performance timeline for operations

**Debug Mode:**
- Enable via setting: `void.debug.enabled`
- Verbose logging to file
- Record all LLM interactions
- Dump state on errors

**Development Commands:**
```
Cmd+Shift+P → "Void: Show Debug Panel"
Cmd+Shift+P → "Void: Export Logs"
Cmd+Shift+P → "Void: Clear Cache"
```

---

## 10. Incident Response

### 10.1 Runbook

**Common Issues & Resolutions:**

**Issue: LLM requests timing out**
- Check: Provider API status
- Check: Network connectivity
- Check: API key validity
- Action: Retry with exponential backoff

**Issue: Context gathering slow**
- Check: Workspace size
- Check: Number of open files
- Action: Reduce context scope, implement file limits

**Issue: Diff visualization broken**
- Check: File size (very large files may fail)
- Check: Character encoding issues
- Action: Fall back to Slow Apply mode

### 10.2 Diagnostics Command

**Void Health Check:**
```
Cmd+Shift+P → "Void: Run Health Check"
```

**Output:**
```
✅ Electron Main: Healthy
✅ VS Code Workbench: Healthy
⚠️ OpenAI Provider: API key not set
✅ File System: Healthy
✅ Local Storage: Healthy
⚠️ Workspace: 15,234 files (consider filtering)
```

---

## 11. Deployment & Release

### 11.1 Release Process

**Current State:** Manual builds and releases (inferred)

**Recommendations:**
- Semantic versioning (MAJOR.MINOR.PATCH)
- Automated builds via CI/CD
- Auto-update mechanism (Electron Updater)
- Staged rollouts (beta → stable)

### 11.2 Release Artifacts

- Installers: `.exe` (Windows), `.dmg` (macOS), `.AppImage` (Linux)
- Checksums: SHA-256 for verification
- Release notes: Changelog with features, fixes, breaking changes

### 11.3 Rollback Strategy

- Keep previous version installer available
- Auto-update can revert to previous version
- User data migrations should be reversible

---

## 12. Operational Dashboard

### 12.1 Recommended Metrics Dashboard

**Real-Time:**
- Active users (current)
- LLM requests per minute
- Error rate (last 15 minutes)
- Average latency (last hour)

**Trends:**
- Daily active users (30 days)
- Provider usage distribution
- Error types frequency
- Feature adoption over time

**Alerts:**
- Critical errors in last hour
- Provider outages detected
- Performance degradation alerts

---

## 13. Summary & Roadmap

### Current Operability Maturity: Level 1/5 (Basic)

**Level 1 (Current):** Basic logging, minimal telemetry  
**Level 2 (Target - 3 months):** Structured logging, core metrics, error tracking  
**Level 3 (Target - 6 months):** Distributed tracing, health checks, alerting  
**Level 4 (Target - 12 months):** APM, feature flags, comprehensive dashboards  
**Level 5 (Future):** Full observability, predictive analytics, auto-remediation  

### Immediate Actions

1. ✅ Implement structured logging with correlation IDs
2. ✅ Integrate error tracking (Sentry or equivalent)
3. ✅ Add core performance metrics (latency, error rate)
4. ✅ Create debug panel for LLM interactions
5. ✅ Document operational runbook

### Long-Term Investments

6. Distributed tracing with OpenTelemetry
7. Comprehensive metrics dashboard (Grafana)
8. Automated alerting and incident response
9. Feature flag system with remote control
10. APM for production performance monitoring

---

**Conclusion:** Improving operability is critical for scaling Void. Investing in logging, metrics, and error tracking will significantly reduce debugging time and improve user experience.
