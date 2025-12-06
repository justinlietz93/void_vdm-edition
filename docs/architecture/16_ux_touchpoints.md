# UX Touchpoints & Product Surface

**System:** Void Editor (VDM Edition)  
**Commit:** 7c1f1947e3ea704ba30609c343863d16d5c91185  
**Date:** 2025-11-09

---

## Executive Summary

This document maps how Void's technical architecture surfaces to end users through UI, APIs, CLI, and interaction patterns.

---

## 1. Primary User Interface

### 1.1 Sidebar Chat Panel

**Technical Component:** `sidebarPane.ts` (React)  
**Architecture Layer:** Presentation  
**Entry Point:** VS Code sidebar (icon in activity bar)

**User Interactions:**
- **Type Message** → Triggers: `ChatThreadService.sendMessage()`
- **Select Provider** → Updates: `VoidSettingsService`
- **View History** → Reads: Thread from local storage
- **Apply Changes** → Triggers: `EditCodeService.apply()`
- **Accept/Reject Diff** → Modifies: Text model via `VoidModelService`

**UX Flow:**
```
User types "Refactor this function"
    ↓
Sidebar captures input
    ↓
Context gathering (workspace scan - shows loading indicator)
    ↓
Send to LLM (shows "Thinking..." state)
    ↓
Stream response (tokens appear word-by-word)
    ↓
Show Apply button (if code detected)
    ↓
User clicks Apply
    ↓
Show diff preview (red/green highlighting)
    ↓
User accepts
    ↓
File modified (unsaved changes marker)
```

**Performance Impact:**
- First interaction latency: 500ms-3s (context gathering + LLM first token)
- Streaming responsiveness: Real-time (some jank possible on fast streams)

---

### 1.2 Settings Panel

**Technical Component:** `voidSettingsPane.ts` (React)  
**Entry Point:** Command palette → "Void: Open Settings"

**User Interactions:**
- **Add API Key** → Saves to: `VoidSettingsService` → Local storage (⚠️ plain text)
- **Select Model** → Updates: Model selection per feature (Chat, Autocomplete, Ctrl+K)
- **Toggle Features** → Fast Apply, Auto Context, Telemetry
- **Configure Endpoints** → Custom API endpoints (e.g., Ollama localhost)

**UX Flow:**
```
User opens settings
    ↓
View providers (OpenAI, Anthropic, Ollama, etc.)
    ↓
Enter API key
    ↓
Test connection (optional - refreshes model list)
    ↓
Select default model
    ↓
Save (immediate effect, no restart required)
```

---

### 1.3 In-Editor Diff Visualization

**Technical Component:** `editCodeService.ts` + VS Code decorations  
**Appears:** Directly in code editor

**User Experience:**
- **Green highlights** - Added lines
- **Red highlights** - Removed lines
- **Side-by-side diff view** - Original vs. proposed
- **Accept/Reject buttons** - Inline or in hover
- **Streaming diffs** - Changes appear as LLM generates

**Visual Feedback:**
- Diff zones rendered with background colors
- Line numbers show changes
- Hover shows original content (for modified lines)
- Cursor automatically scrolls to first change

---

## 2. Keyboard Shortcuts

### 2.1 Primary Actions

| Shortcut | Action | Technical Trigger |
|----------|--------|-------------------|
| `Cmd+L` | Open chat sidebar | `sidebarPane.show()` |
| `Cmd+K` | Quick edit selection | `EditCodeService.quickEdit()` |
| `Cmd+Shift+P` → "Void: Apply" | Apply to file | `EditCodeService.apply()` |
| `Esc` | Cancel streaming | `ChatThreadService.cancelStream()` |

**UX Consideration:**
- Keyboard-first workflow for power users
- Discoverable via Command Palette
- Consistent with VS Code conventions

---

## 3. Command Palette Integration

**Access:** `Cmd+Shift+P` → Type "Void"

**Available Commands:**
- `Void: Open Chat` - Open sidebar
- `Void: Open Settings` - Configure providers
- `Void: Apply to File` - Trigger apply
- `Void: Clear Conversation` - Reset thread
- `Void: Show Debug Panel` (proposed)
- `Void: Export Logs` (proposed)

**Technical:** Registered via `void.contribution.ts` actions

---

## 4. API Surface (Internal)

### 4.1 Service Interfaces (for Extensions)

**Public APIs:**
```typescript
// For extension developers
interface IVoidExtensionAPI {
  // Chat
  sendMessage(content: string): Promise<void>;
  getThread(threadId: string): Thread;
  
  // Code Editing
  applyChanges(uri: URI, changes: CodeChanges): Promise<void>;
  
  // Context
  gatherContext(options: ContextOptions): Promise<Context>;
  
  // Settings
  getProviders(): Provider[];
  setProvider(name: string, config: ProviderConfig): void;
}
```

**Access Pattern:**
```typescript
const voidAPI = vscode.extensions.getExtension('void-editor')?.exports;
await voidAPI.sendMessage('Hello, Void!');
```

**Use Cases:**
- Third-party extensions integrating with Void
- Custom automation scripts
- Testing harnesses

---

### 4.2 Event Bus (Internal)

**Events Emitted:**
- `void.messageReceived` - New LLM response token
- `void.applyStarted` - Apply operation begins
- `void.applyCompleted` - Apply operation ends
- `void.contextGathered` - Context gathering complete
- `void.providerChanged` - User switches provider

**Subscribers:**
- UI components (for reactive updates)
- Analytics service (for telemetry)
- Debug panel (for logging)

---

## 5. CLI Interface (Limited)

**Current State:** Void CLI primarily for launching the editor

**Commands:**
```bash
# Launch Void
./void

# Open specific file
./void path/to/file.ts

# Install extension
./void --install-extension <extension-id>
```

**Proposed Enhancements:**
- `void chat "message"` - Send message from terminal
- `void apply <file>` - Apply AI suggestions to file
- `void context <dir>` - Gather context and output to stdout

**Technical:** Uses `cli/` directory, Node.js runtime

---

## 6. Status Bar & Notifications

### 6.1 Status Bar Items

**Left Side:**
- **LLM Status** - "Claude 3.5 Sonnet" (shows active model)
- **Streaming Indicator** - Animated icon when LLM responding

**Right Side:**
- **Token Count** (proposed) - Show context size
- **Error Indicator** - Red icon on API failures

### 6.2 Notifications

**Types:**
- **Info:** "Context gathered (1,234 tokens)"
- **Warning:** "Large workspace detected, context may be incomplete"
- **Error:** "Failed to connect to OpenAI API. Check your API key."
- **Success:** "Applied 3 changes to example.ts"

**Technical:** Uses `INotificationService` from VS Code

---

## 7. Onboarding Flow

### 7.1 First Run Experience

**Current:**
1. User installs Void
2. Opens editor
3. Sees sidebar with "Configure Provider" prompt
4. Must manually enter API key
5. No guided setup

**Proposed Enhancement:**
```
First Launch
    ↓
Welcome Modal
    ↓
Choose: "I have API keys" or "Use Ollama (local)"
    ↓
[If API keys] → Setup Wizard (provider selection, key input, test connection)
    ↓
[If Ollama] → Download Ollama, install models, connect
    ↓
Example Chat ("Try: Explain this code")
    ↓
Ready to use
```

**UX Goal:** Reduce time-to-first-message from 5 minutes to 60 seconds

---

## 8. Error States & Recovery

### 8.1 Common Error Scenarios

**Scenario 1: Invalid API Key**
- **User Sees:** "Authentication failed. Please check your API key in settings."
- **Action Button:** "Open Settings"
- **Technical:** `ProviderError` caught, displayed via notification

**Scenario 2: Network Timeout**
- **User Sees:** "Request timed out. Retrying... (Attempt 2/3)"
- **Technical:** Automatic retry with exponential backoff (when implemented)

**Scenario 3: Context Too Large**
- **User Sees:** "Workspace is very large. Only 10,000 most relevant files included."
- **Action Button:** "Configure Filters"
- **Technical:** Context gathering hits limit, shows warning

**Scenario 4: Streaming Interrupted**
- **User Sees:** "Connection lost. Partial response received."
- **Action Button:** "Retry"
- **Technical:** IPC disconnect, stream aborted

---

## 9. Loading & Progress Indicators

### 9.1 Operations with Feedback

| Operation | Indicator | Duration |
|-----------|-----------|----------|
| Context Gathering | Spinner + "Gathering context..." | 0.5-5s |
| LLM First Token | "Thinking..." | 0.5-3s |
| Streaming Response | Animated icon | 2-30s |
| Applying Changes | Progress bar (?) | <1s |
| Refreshing Models | Spinner in settings | 1-2s |

**UX Principle:** Show progress for operations >500ms

---

## 10. Accessibility

### 10.1 Screen Reader Support

**Current State:**
- Inherits VS Code's excellent accessibility
- Sidebar chat area keyboard-navigable
- Diff highlights announced (basic)

**Gaps:**
- Custom React components may lack ARIA labels
- Streaming responses may flood screen readers
- Diff visualization could be more descriptive

**Recommendations:**
- Add ARIA live regions for streaming text
- Announce "LLM is typing" state
- Provide text summary of diffs (e.g., "5 lines added, 2 removed")

### 10.2 Keyboard-Only Workflow

**Supported:**
- Open chat: `Cmd+L`
- Navigate messages: `Tab`, `Shift+Tab`
- Send message: `Enter`
- Multi-line message: `Shift+Enter`
- Accept diff: `Cmd+Enter` (proposed)
- Reject diff: `Esc`

**Score: 8/10** (Good, but could add more shortcuts)

---

## 11. Theme & Branding

### 11.1 Visual Design

**Colors:**
- Inherits from VS Code theme (light/dark mode)
- Custom accent colors for Void-specific UI
- Diff highlights: Green (#27AE60), Red (#E74C3C)

**Typography:**
- Uses VS Code's default fonts
- Code blocks: Monospace font from theme
- UI text: Sans-serif from theme

**Iconography:**
- Void logo in activity bar
- LLM provider logos in settings (OpenAI, Anthropic, etc.)
- Lucide React icons for UI elements

---

## 12. User Preferences & Customization

### 12.1 Configurable Settings

**Available:**
- Provider & model selection per feature
- Fast Apply vs. Slow Apply default
- Auto context gathering (on/off)
- Telemetry opt-in/out
- Custom API endpoints

**Not Yet Available (Proposed):**
- Context size limits
- File exclusion patterns
- Custom system prompts
- Keyboard shortcut customization
- UI theme customization

---

## 13. Multi-User Considerations

**Current Scope:** Single-user desktop application

**No Multi-Tenant Features:**
- No user accounts
- No shared conversations
- No team workspaces
- No permissions/roles

**Collaboration Pattern:**
- Users can share conversation history manually (export/import)
- Code changes integrated via Git (standard workflow)

---

## 14. Mobile & Web Support

**Current:** Desktop only (Electron)

**Not Supported:**
- Web browser version
- Mobile apps (iOS, Android)
- Tablet interfaces

**Blocker:** Tight coupling to Electron Main process for LLM communication

**Future Possibility:**
- Web version requires architectural changes (ports & adapters)
- Could use server-side proxy for LLM calls

---

## 15. UX Metrics (Proposed)

### 15.1 Key Performance Indicators

**Speed:**
- Time to first LLM token: <2s (p95)
- Context gathering latency: <1s (p95)
- Apply diff computation: <200ms (p95)

**Engagement:**
- Messages per session: 5-10 (avg)
- Apply operations per session: 2-3 (avg)
- Session duration: 15-30 minutes (avg)

**Quality:**
- Apply acceptance rate: >70%
- Error rate: <5%
- User retention (D7): >50%

---

## 16. Product Roadmap Alignment

### 16.1 UX Enhancements

**Short-Term (Q1):**
- Onboarding wizard
- Better error messages
- Loading indicators for all operations
- Keyboard shortcuts cheat sheet

**Medium-Term (Q2-Q3):**
- Voice input (speech-to-text)
- Multi-modal support (images, screenshots)
- Collaborative features (share threads)
- Web version (architecture permitting)

**Long-Term (Q4+):**
- Mobile companion app
- IDE plugins (JetBrains, etc.)
- Custom UI themes and layouts

---

## 17. Competitive Comparison

### 17.1 vs. Cursor

| Feature | Void | Cursor |
|---------|------|--------|
| Provider choice | ✅ 6+ providers | ❌ Proprietary |
| Privacy | ✅ Direct API | ⚠️ Proxied |
| Open source | ✅ Yes | ❌ No |
| Onboarding | ⚠️ Manual | ✅ Guided |
| Chat UI | ✅ Good | ✅ Excellent |
| Apply flow | ✅ Diff preview | ✅ Similar |

**Void's UX Strengths:**
- Provider flexibility
- Transparent data flow
- Community-driven

**Void's UX Gaps:**
- Onboarding experience
- Polish and refinement
- Advanced features (voice, images)

---

## 18. Conclusion

### UX Maturity: Level 3/5 (Functional)

**Levels:**
1. **Unusable** - Broken flows
2. **Functional** - Works but clunky
3. **Usable** - Core workflows smooth ← **Void is here**
4. **Delightful** - Polished, intuitive
5. **Exceptional** - Best-in-class

**Next Steps to Level 4:**
1. ✅ Add onboarding wizard
2. ✅ Improve error messaging
3. ✅ Add keyboard shortcuts for all actions
4. ✅ Polish loading states and animations
5. ✅ Comprehensive accessibility audit

**User-Facing Impact of Architecture:**
- ✅ Fast message send (<100ms)
- ⚠️ Context gathering can block UI (needs async)
- ✅ Streaming is smooth (mostly)
- ⚠️ Errors are cryptic (needs user-friendly messages)
- ✅ Apply flow is intuitive (diff preview works well)

---

**Overall UX Score: 7/10 (Good, with clear improvement path)**
