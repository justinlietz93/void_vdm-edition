# Crux Swap Tracking

Log of the work done to move the Void IDE provider layer to the embedded Crux module. Newest entries at the top.

## 2025-12-05

- Root cause for missing streaming and model refresh: the IDE was talking to stale system Python uvicorn processes on port 8091 (no `/api/chat/stream`, 500s on `/api/models`). Killed the orphan `multiprocessing.spawn` workers and started Crux from the repo venv; verified `/openapi.json` now includes `/api/chat/stream`.
- Verified `/api/models?provider=openai&refresh=true` now returns JSON (empty snapshot when no key) instead of a 500, so `RefreshModelService` should stop erroring once the provider key is supplied.
- Updated CruxSupervisor to start uvicorn with reload disabled (single process) and to kill the full process tree on Windows using `taskkill /T /F` so the spawned Crux server is always torn down with the IDE.
- Cleaned Crux model refresh discovery to only load from `crux_providers.<provider>.get_<provider>_models` (removed legacy src paths) and added refresh metadata to model snapshots so callers can see when refresh falls back to cache.
- Fixed provider key resolution: KeysRepository now reads from the embedded key_vault SQLite (`crux_providers/key_vault/providers.db`) and promotes stored keys to env for adapters, so IDE-sent keys are actually used during model refresh (no more MissingAPIKey fallback).
- Refactored `voidSettingsService` helpers into `common/voidSettings/`, removed unused imports and circular type references, and aligned UI state typing with `VoidSettingsStateShape` to clean up settings compilation errors.
- Removed deprecated provider artifacts (e.g., `openai_legacy.py`; legacy JSON registries are not used in the DB-first flow). OpenAI model refresh now falls back to observed-capability data when the SDK/key path fails, and CruxSupervisor spawn forces UTF-8 (`PYTHONIOENCODING` + `PYTHONUTF8`) to avoid ASCII codec crashes.
- Crux inventory: refreshers present for openai/anthropic/gemini/deepseek/xai; ollama/vllm/lmStudio rely on autodetect; openrouter/groq/mistral pending refresh modules (UI will show nothing until implemented). Placeholder JSON registries are ignored (DB-first). Key vault path: `crux_providers/key_vault/providers.db`.
- Deleted lingering placeholder registry file `crux_providers/openrouter/openrouter-models.json` (unused in DB-first flow). Added UTF-8 retry guard to OpenAI model refresh to avoid UnicodeEncodeError on Windows consoles.

## 2025-12-04

- Replaced `sendLLMMessage.impl.ts` with a Crux-only implementation. All provider dispatch now routes chat and model listing calls through the Crux HTTP bridge; provider SDK calls were removed.
- Added defensive provider mapping and support checks so unsupported providers fail fast with a clear message instead of silently falling back to legacy code.
- Normalized Crux chat responses (text + tool-call parts) back into the existing Void callback shape; FIM now surfaces a clear "unsupported via Crux" error.
- Model listing now exclusively uses Crux `/api/models` snapshots for every provider entry to keep the IDE in sync with Crux''s registry.
- Noted key storage lives under `crux_providers/key_vault` (multiple SQLite files, e.g., `providers.db`), aligning with the embedded Crux persistence layout.
- Removed incorrect Glass/Neuroca header banner from `sendLLMMessage.impl.ts` to keep branding clean.
- Tightened list model typing in `sendLLMMessage.impl.ts` to satisfy TypeScript after the Crux swap.
- Added key sync from IDE provider settings to Crux (`cruxPostKeys`) before chat/list calls; caches per env var to avoid repeat writes.
- Removed the unused `llmMessage/providers/openAIProvider.ts` stub and cleaned obsolete not-implemented references in `cruxBridge.ts` now that all routing is Crux-backed.
- Added Crux streaming endpoint (`/api/chat/stream`) and IDE streaming client wiring via `cruxStreamChat` so chat now streams NDJSON from Crux.
