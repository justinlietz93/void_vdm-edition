# Crux Swap Tracking

Log of the work done to move the Void IDE provider layer to the embedded Crux module. Newest entries at the top.

## 2025-12-04

- Replaced `sendLLMMessage.impl.ts` with a Crux-only implementation. All provider dispatch now routes chat and model listing calls through the Crux HTTP bridge; provider SDK calls were removed.
- Added defensive provider mapping and support checks so unsupported providers fail fast with a clear message instead of silently falling back to legacy code.
- Normalized Crux chat responses (text + tool-call parts) back into the existing Void callback shape; FIM now surfaces a clear "unsupported via Crux" error.
- Model listing now exclusively uses Crux `/api/models` snapshots for every provider entry to keep the IDE in sync with Crux’s registry.
- Noted key storage lives under `crux_providers/key_vault` (multiple SQLite files, e.g., `providers.db`), aligning with the embedded Crux persistence layout.
- Removed incorrect Glass/Neuroca header banner from `sendLLMMessage.impl.ts` to keep branding clean.
- Tightened list model typing in `sendLLMMessage.impl.ts` to satisfy TypeScript after the Crux swap.
- Added key sync from IDE provider settings to Crux (`cruxPostKeys`) before chat/list calls; caches per env var to avoid repeat writes.
- Removed the unused `llmMessage/providers/openAIProvider.ts` stub and cleaned obsolete “not implemented” references in `cruxBridge.ts` now that all routing is Crux-backed.
