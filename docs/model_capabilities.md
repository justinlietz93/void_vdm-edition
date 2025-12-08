# Void Genesis IDE — Model Capabilities Matrix

_Canonical source of truth: Crux model catalog (YAML + SQLite) and `/api/models`, consumed by [`modelCapabilities.ts`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1) and associated provider settings._

This document summarizes how Void Genesis IDE understands different LLM providers and models. It is a human-readable mirror of the **Crux-backed** model capability surface as seen by the IDE, implemented across:

- Crux provider/model catalog YAMLs (for example, [`openai.yaml`](crux/crux_providers/catalog/providers/openai.yaml:1), [`xai.yaml`](crux/crux_providers/catalog/providers/xai.yaml:1))
- Crux HTTP surface for metadata (for example, [`/api/models`](crux/crux_providers/service/app.py:1), [`/api/providers`](crux/crux_providers/service/app.py:1))
- IDE adapter and budgeting logic:
  - [`modelCapabilities.ts`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1)
  - Truncation and budgeting logic in [`convertToLLMMessageService.ts`](void_genesis_ide/src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts:243)

The registry drives:

- **Prompt budgeting / truncation** — via `contextWindow` and `reservedOutputTokenSpace`.
- **System message routing** — via `supportsSystemMessage`.
- **Tool format selection** — via `specialToolFormat` (`openai-style`, `anthropic-style`, or `gemini-style`).
- **Reasoning support** — via `reasoningCapabilities`.
- **Provider-specific reasoning I/O** — via `providerReasoningIOSettings`.

When you change any capabilities here, you **must** re-run the GPT‑5.1 manual test protocol in:

- [`gpt51_testing.md`](void_genesis_ide/docs/gpt51_testing.md:1)

and update this document as necessary.

---

## 1. Global Defaults and Fallback Logic

### 1.1 Default provider settings

The default per-provider configuration (API endpoints, keys, etc.) is defined at the top of:

- [`modelCapabilities.ts`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:12)

These are mainly used for UI defaults and are not replicated here.

### 1.2 `VoidStaticModelInfo`

Every model capability entry conforms to `VoidStaticModelInfo`:

- Definition: [`VoidStaticModelInfo`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities/types.ts:1)
- Key fields:

  - `contextWindow: number`  
    Number of tokens in the model’s context window.

  - `reservedOutputTokenSpace: number | null`  
    Desired number of tokens reserved for model output. This is used in prompt budgeting in conjunction with `contextWindow`.

  - `supportsSystemMessage: false | 'system-role' | 'developer-role' | 'separated'`  
    How system messages are delivered:
    - `'system-role'`: as a `system` message.
    - `'developer-role'`: as a `developer` message (used by OpenAI chat models).
    - `'separated'`: separate `system` field (Anthropic, Gemini).
    - `false`: no explicit system field; system text is prepended into the first user message.

  - `specialToolFormat?: 'openai-style' | 'anthropic-style' | 'gemini-style'`  
    Native tool encoding used when calling the provider:
    - `openai-style`: JSON `tools` array (OpenAI-style function calling).
    - `anthropic-style`: `tools` and `tool_choice` fields (Anthropic).
    - `gemini-style`: Gemini tools / function declarations.
    - `undefined`: No native tools; tools are expressed via XML in the system prompt.

  - `supportsFIM: boolean`  
    Whether the model supports fill-in-the-middle (FIM) use cases.

  - `additionalOpenAIPayload?: { [key: string]: string }`  
    Provider- or model-specific payload fields to be injected into OpenAI-compatible requests.

  - `reasoningCapabilities: false | { ... }`  
    Indicates whether and how a model supports a “reasoning mode” (think tokens, reasoning slider / effort).

  - `cost: { input, output, cache_read?, cache_write? }`  
    Informational; used for display and potential future analytics.

  - `downloadable: false | { sizeGb: number | 'not-known' }`  
    Informational; whether an open-source model can be downloaded and approximate size.

### 1.3 `defaultModelOptions` for truly unknown models

When a model cannot be resolved from Crux’s catalog overlay (for example, a provider/model pair that `/api/models` does not know about), Void uses:

- [`defaultModelOptions`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities/types.ts:1)

Configured as:

- `contextWindow = 128_000`
- `reservedOutputTokenSpace = 8_192`
- `supportsSystemMessage = false`
- `supportsFIM = false`
- `reasoningCapabilities = false`

This is a **safe fallback** that prevents the previous pathological behavior where:

- Unknown models were treated as 4096/4096 (0 effective input budget).

Now, even unknown models get a reasonably large context and some reserved output, so they can still function without immediately truncating nearly all input.

### 1.4 Generic OpenAI Chat Behavior (GPT‑5.1 and future GPTs)

As of the Crux-first migration, [`getModelCapabilities()`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1) no longer implements any TypeScript-side “generic GPT chat” heuristics. Instead:

- GPT‑5.1 and other OpenAI chat models must be explicitly represented in Crux’s OpenAI catalog:
  - [`openai.yaml`](crux/crux_providers/catalog/providers/openai.yaml:1)
- The IDE treats a model as **recognized** only when Crux exposes a capability overlay for its `(provider, model)` pair via `/api/models`. In that case:
  - [`getModelCapabilities()`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1) starts from [`defaultModelOptions`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities/types.ts:1),
  - Merges in the Crux overlay,
  - Then applies any user overrides from `overridesOfModel`,
  - And marks `isUnrecognizedModel: false` with `recognizedModelName = modelName`.
- If Crux does **not** know about a model, [`getModelCapabilities()`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1):
  - Builds a capability object from `defaultModelOptions` plus user overrides,
  - Marks `isUnrecognizedModel: true`,
  - Makes no additional assumptions about tools, reasoning mode, or system-message semantics.

This design ensures that GPT‑5.1 and future OpenAI chat models behave correctly **only when** their capabilities are modeled in Crux, keeping provider/model semantics centralized and avoiding divergent heuristics in the IDE.

---

## 2. Truncation and Budgeting Behavior

Prompt construction and truncation for OpenAI/Anthropic/Gemini is implemented in:

- [`convertToLLMMessageService.ts`](void_genesis_ide/src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts:243)

Key behavior:

1. **Effective input budget**:

   ```ts
   const charsNeedToTrim = totalLen - Math.max(
     (contextWindow - reservedOutputTokenSpace) * CHARS_PER_TOKEN,
     5_000
   )
   ```

   Where:

   - `CHARS_PER_TOKEN = 4`
   - `totalLen` is the total character length of messages plus system content.

2. **Output reservation clamping**:

   In `prepareOpenAIOrAnthropicMessages`:

   - [`prepareOpenAIOrAnthropicMessages`](void_genesis_ide/src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts:243)

   ```ts
   reservedOutputTokenSpace = Math.max(
     contextWindow * 1 / 2,
     reservedOutputTokenSpace ?? 8_192
   )
   const maxReserved = Math.floor(contextWindow * 0.75)
   if (reservedOutputTokenSpace > maxReserved) {
     reservedOutputTokenSpace = maxReserved
   }
   ```

   This ensures:

   - At least half the context is reserved for output _if_ a model configuration requests a very small `reservedOutputTokenSpace`.
   - At most 75% of the context is reserved for output, leaving at least 25% for system + user input.
   - Prevents the “zero input budget” scenario that previously caused heavy truncation.

3. **Tool format routing**:

   - `specialToolFormat` determines whether tools are:

     - Encoded as JSON tools (`openai-style` / `anthropic-style` / `gemini-style`), or
     - Expressed as XML instructions and parsed via wrappers when `specialToolFormat` is undefined.

---

## 3. Provider Summary

This section summarizes per-provider defaults and special characteristics **as encoded in Crux’s provider/model catalog**. Canonical values live in the Crux YAML files and SQLite-backed registry; TypeScript’s `*ModelOptions` maps are **not** authoritative and may be empty or partial. [`getModelCapabilities()`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1) now derives semantics from Crux overlays (via `/api/models`) merged with [`defaultModelOptions`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities/types.ts:1) and user overrides.

### 3.1 OpenAI (`openAI`)

- Default models: [`defaultModelsOfProvider.openAI`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:74)

  - `gpt-4.1`
  - `gpt-4.1-mini`
  - `gpt-4.1-nano`
  - `o3`
  - `o4-mini`

- Model capability table (structural only, no longer consulted by `getModelCapabilities()`): [`openAIModelOptions`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:605)

  Canonical OpenAI model semantics (including GPT‑5.1) live in the Crux catalog:

  - [`openai.yaml`](crux/crux_providers/catalog/providers/openai.yaml:1)

  and are surfaced to the IDE via `/api/models` and the Crux overlay merge in [`modelCapabilities.ts`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1).

Key models:

- `o3`:
  - `contextWindow = 1_047_576`
  - `reservedOutputTokenSpace = 32_768`
  - `specialToolFormat = 'openai-style'`
  - `supportsSystemMessage = 'developer-role'`
  - `reasoningCapabilities`: enabled (effort slider; can’t turn off reasoning output).

- `o4-mini`:
  - Same pattern: 1M+ context, 32_768 reserved output.
  - `specialToolFormat = 'openai-style'`
  - `supportsSystemMessage = 'developer-role'`
  - Reasoning supported via effort slider.

- `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`:
  - `contextWindow = 1_047_576`
  - `reservedOutputTokenSpace = 32_768`
  - `specialToolFormat = 'openai-style'`
  - `supportsSystemMessage = 'developer-role'`
  - `reasoningCapabilities = false` (no special reasoning mode).

- `o1`, `o1-mini`, `o3-mini`:
  - `supportsSystemMessage`:
    - `o1`: `'developer-role'`
    - `o1-mini`: `false` (no system; instructions must be in user content).
  - High reserved output budgets (100k+), designed for reasoning.
  - `reasoningCapabilities`: enabled.

- `gpt-4o`, `gpt-4o-mini`:
  - `contextWindow = 128_000`
  - `reservedOutputTokenSpace = 16_384`
  - `specialToolFormat = 'openai-style'`
  - `supportsSystemMessage`:
    - `gpt-4o`: `'system-role'`
    - `gpt-4o-mini`: `'system-role'`

**OpenAI reasoning payloads:**

- Provider reasoning I/O settings: [`openAISettings`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:716)
- Input payload for reasoning (OpenAI’s `reasoning_effort`):

  ```ts
  openAICompatIncludeInPayloadReasoning(...)
  ```

### 3.2 Anthropic (`anthropic`)

- Default models: [`defaultModelsOfProvider.anthropic`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:86)

  - `claude-opus-4-0`
  - `claude-sonnet-4-0`
  - `claude-3-7-sonnet-latest`
  - `claude-3-5-sonnet-latest`
  - `claude-3-5-haiku-latest`
  - `claude-3-opus-latest`

- Model table (structural only, kept for documentation/tests; `getModelCapabilities()` ignores it): [`anthropicModelOptions`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:479)

Crux as source of truth:

- Canonical Anthropic model metadata (context windows, reasoning budgets, tool formats) is defined in the Crux catalog:
  - [`anthropic.yaml`](crux/crux_providers/catalog/providers/anthropic.yaml:1)
- The IDE receives these values via `/api/models` and merges them through the Crux overlay in [`modelCapabilities.ts`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1).

Common properties:

- `contextWindow = 200_000` for all listed Claude 3.5/3.7 and Opus models.
- `reservedOutputTokenSpace` typically `8_192` or `4_096`.
- `specialToolFormat = 'anthropic-style'`.
- `supportsSystemMessage = 'separated'`:
  - System prompt is supplied in the separate `system` field for Anthropic.
- Reasoning:
  - For `claude-3-7-sonnet-*`, `claude-opus-4-*`, `claude-sonnet-4-*`:
    - `reasoningCapabilities.supportsReasoning = true`.
    - `reasoningSlider` is a budget slider (`min: 1024`, `max: 8192`, `default: 1024`).
    - `reasoningReservedOutputTokenSpace` is typically `8192`.

Provider reasoning settings: [`anthropicSettings`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:572)

- Input payload: `thinking: { type: 'enabled', budget_tokens: ... }` when reasoning is enabled.

### 3.3 xAI (`xAI`)

- Default models: [`defaultModelsOfProvider.xAI`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:94)

  - `grok-2`
  - `grok-3`
  - `grok-3-mini`
  - `grok-3-fast`
  - `grok-3-mini-fast`

- Model table: [`xAIModelOptions`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:733)

Common properties:

- `contextWindow = 131_072`.
- `reservedOutputTokenSpace = null` (treated as default later).
- `supportsSystemMessage = 'system-role'`.
- `specialToolFormat = 'openai-style'`.

Reasoning:

- `grok-3-mini` and `grok-3-mini-fast`:
  - `reasoningCapabilities.supportsReasoning = true`.
  - Effort-based slider (`low`, `high`).

xAI shares OpenAI-style reasoning input behavior via:

- `providerReasoningIOSettings` referencing `openAICompatIncludeInPayloadReasoning`.

Crux as source of truth:

- Canonical Grok model metadata (context windows, tool formats, reasoning support) lives in the Crux catalog:
  - [`xai.yaml`](crux/crux_providers/catalog/providers/xai.yaml:1)
- The IDE’s [`xAIModelOptions`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:733) entry is now a **thin adapter / fallback** over Crux:
  - Per-model semantics flow from Crux via [`/api/models`](crux/crux_providers/service/app.py:1) and the Crux overlay in [`modelCapabilities.ts`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1).

### 3.4 Gemini (`gemini`)

- Default models: [`defaultModelsOfProvider.gemini`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:101)

  - `gemini-2.5-pro-exp-03-25`
  - `gemini-2.5-flash-preview-04-17`
  - `gemini-2.0-flash`
  - `gemini-2.0-flash-lite`
  - `gemini-2.5-pro-preview-05-06`

- Model table: [`geminiModelOptions`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:808)

Common properties:

- Most models:
  - `contextWindow = 1_048_576` (1M tokens) or `2_097_152` for `gemini-1.5-pro`.
  - `reservedOutputTokenSpace = 8_192`.
  - `supportsSystemMessage = 'separated'`.
  - `specialToolFormat = 'gemini-style'`.
  - Reasoning (for 2.5 models and some flash variants):
    - `supportsReasoning = true`.
    - `reasoningSlider` is a budget slider.

Provider settings: [`geminiSettings`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:920)

- No current provider-level reasoning input mapping (Gemini-specific reasoning handled via `ThinkingConfig` in:
  - [`sendLLMMessage.impl.ts`](void_genesis_ide/src/vs/workbench/contrib/void/electron-main/llmMessage/sendLLMMessage.impl.ts:717)

Crux as source of truth:

- Canonical Gemini model semantics live in the Crux catalog:
  - [`gemini.yaml`](crux/crux_providers/catalog/providers/gemini.yaml:1)
- The IDE’s [`geminiModelOptions`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:808) map is intentionally thin (and may be empty); per-model details are expected to come from Crux via [`/api/models`](crux/crux_providers/service/app.py:1) and the Crux overlay.

### 3.5 Deepseek (`deepseek`)

- Default models: [`defaultModelsOfProvider.deepseek`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:108)

  - `deepseek-chat`
  - `deepseek-reasoner`

- Model table: [`deepseekModelOptions`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:928)

Common properties:

- `deepseek-chat`:
  - `contextWindow = 64_000`
  - `reservedOutputTokenSpace = 8_000`
  - Reasoning mirrored from `openSourceModelOptions_assumingOAICompat.deepseekR1`.

- `deepseek-reasoner`:
  - Also `contextWindow = 64_000`
  - `reservedOutputTokenSpace = 8_000`
  - Stronger reasoning configuration.

Provider reasoning mapping:

- Uses OpenAI-compatible reasoning payload and expects `reasoning_content` on output:
  - [`deepseekSettings`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:946)

Crux as source of truth:

- Deepseek per-model metadata (context windows, reasoning flags) is defined in:
  - [`deepseek.yaml`](crux/crux_providers/catalog/providers/deepseek.yaml:1)
- The IDE’s [`deepseekModelOptions`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:928) entry is kept minimal; capability semantics should be updated in Crux first and will flow into the IDE via [`/api/models`](crux/crux_providers/service/app.py:1).

### 3.6 Mistral (`mistral`)

- Default models: [`defaultModelsOfProvider.mistral`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:143)

  - `codestral-latest`
  - `devstral-small-latest`
  - `mistral-large-latest`
  - `mistral-medium-latest`
  - `ministral-3b-latest`
  - `ministral-8b-latest`

- Model table: [`mistralModelOptions`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:960)

Common properties:

- `mistral-large-latest`, `mistral-medium-latest`:
  - `contextWindow = 131_000`
  - `reservedOutputTokenSpace = 8_192`
  - `supportsSystemMessage = 'system-role'`
  - No reasoning (except Magistral variants).

- `codestral-latest`:
  - `contextWindow = 256_000`
  - `reservedOutputTokenSpace = 8_192`
  - `supportsFIM = true`.

- Reasoning-enabled variants:
  - `magistral-medium-latest`, `magistral-small-latest`:
    - `supportsReasoning = true`
    - `openSourceThinkTags = ['<think>', '</think>']`

Provider reasoning mapping:

- Uses OpenAI-compatible reasoning input for open-source reasoning models:
  - [`mistralSettings`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1035)

Crux as source of truth:

- Mistral model capabilities (including Magistral variants) are cataloged in Crux:
  - [`mistral.yaml`](crux/crux_providers/catalog/providers/mistral.yaml:1)
- The IDE’s [`mistralModelOptions`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:960) map is now a thin adapter / fallback; canonical values should be changed in Crux and consumed via [`/api/models`](crux/crux_providers/service/app.py:1).

### 3.7 Groq (`groq`)

- Default models: [`defaultModelsOfProvider.groq`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:137)

  - `qwen-qwq-32b`
  - `llama-3.3-70b-versatile`
  - `llama-3.1-8b-instant`

- Model table: [`groqModelOptions`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1045)

Common properties:

- `contextWindow` typically `128_000`.
- Reasoning support for `qwen-qwq-32b` with `openSourceThinkTags`.

Provider reasoning:

- Requires `reasoning_format: 'parsed'` on input and exposes `reasoning` field on output:
  - [`groqSettings`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1082)

Crux as source of truth:

- Groq models (Qwen/QwQ, Llama variants, etc.) are defined in:
  - [`groq.yaml`](crux/crux_providers/catalog/providers/groq.yaml:1)
- The IDE-side [`groqModelOptions`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1045) map has been slimmed to rely on Crux metadata delivered via [`/api/models`](crux/crux_providers/service/app.py:1).

### 3.8 OpenRouter (`openRouter`)

- Default models: [`defaultModelsOfProvider.openRouter`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:118)

Includes a mix of:

- Anthropic Claude models.
- Qwen/QwQ.
- Deepseek R1.
- Mistral codestral/devstral.
- Gemini proxies.

Model table:

- [`openRouterModelOptions_assumingOpenAICompat`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1267)

Characteristics:

- Assumes OpenAI-compatible endpoints (tool calling, reasoning payloads).
- For Gemini-style models, `specialToolFormat` is normalized to `'openai-style'` in the fallback:
  - [`openRouterSettings`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1412)

Reasoning:

- Reasoning payload is encoded under `reasoning` as per OpenRouter’s API:
  - Supports both budget-based and effort-based reasoning sliders.

Crux as source of truth:

- Canonical OpenRouter model entries (Claude, Qwen/QwQ, Deepseek, Mistral, Gemini proxies, etc.) live in:
  - [`openrouter.yaml`](crux/crux_providers/catalog/providers/openrouter.yaml:1)
- The IDE’s [`openRouterModelOptions_assumingOpenAICompat`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1267) map is treated as an adapter over Crux metadata, not an independent registry; new models should be added to the Crux catalog and then surfaced via [`/api/models`](crux/crux_providers/service/app.py:1).

### 3.9 Self-hosted / Local Providers

These **used to** rely on the TypeScript-side `extensiveModelOptionsFallback` heuristics to infer capabilities for many open-source models (Llama, Qwen, Phi, etc.). As of the Crux-first migration, canonical behavior for these models lives in Crux’s catalog, and [`extensiveModelOptionsFallback()`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:157) has been intentionally neutered to return `null` so that unknown models fall back to `defaultModelOptions` plus Crux overlays instead of IDE-maintained heuristics.

#### 3.9.1 vLLM (`vLLM`)

- Settings: [`vLLMSettings`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:377)
- Capabilities now come from Crux’s `/api/models` for known models. `vLLMSettings.modelOptionsFallback` still delegates to [`extensiveModelOptionsFallback()`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:157), but since that helper now returns `null`, vLLM effectively falls back to `defaultModelOptions` plus any Crux overlay, with no additional TypeScript-side heuristics.
- Applies:

  - `downloadable: { sizeGb: 'not-known' }`
  - OpenAI-compatible reasoning payload.
  - Reasoning output under `reasoning_content` (if exposed by vLLM).

#### 3.9.2 Ollama (`ollama`)

- Canonical model catalog:

  - Per-model semantics (context windows, tool formats, reasoning support, download sizes) live in Crux’s catalog:
    - [`ollama.yaml`](crux/crux_providers/catalog/providers/ollama.yaml:1)
  - Served to the IDE via [`/api/models`](crux/crux_providers/service/app.py:1) and merged in through the Crux overlay in [`modelCapabilities.ts`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1).

- IDE adapter & recommendations:

  - `ollamaModelOptions` in [`modelCapabilities.ts`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:372) is intentionally minimal and primarily serves as a structural map; per-model semantics come from Crux. When Crux has no entry yet, Ollama models fall back to the generic defaults defined in [`modelCapabilities/types.ts`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities/types.ts), with no additional TypeScript-side capability heuristics.
  - [`ollamaRecommendedModels`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:374) is an IDE-local list of suggested model names for the UI:

    - `['qwen2.5-coder:1.5b', 'llama3.1', 'qwq', 'deepseek-r1', 'devstral:latest']`

- Reasoning:

  - Many open-source models use `openSourceThinkTags` and require manual removal of `<think>` tags on output.

Provider reasoning:

- Input: OpenAI-compatible reasoning payload.
- Output: `needsManualParse: true` for reasoning content.

#### 3.9.3 OpenAI-compatible Proxies (`openAICompatible`, `liteLLM`, `googleVertex`, `microsoftAzure`, `awsBedrock`)

- These providers now primarily consume Crux’s `/api/models` responses for capabilities. Their `modelOptionsFallback` functions still call [`extensiveModelOptionsFallback()`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:157), but since that helper now returns `null`, they effectively fall back to `defaultModelOptions` plus any Crux overlay, rather than IDE-maintained heuristics.

  - `openAICompatible`: no extra `downloadable` info; generic OpenAI-compatible reasoning payload.
  - `liteLLM`: like `openAICompatible`, but explicitly expects `reasoning_content` in output.
  - `googleVertex` and `microsoftAzure`: act as OpenAI-compatible wrappers with distinct base URLs, but share similar reasoning input semantics.
  - `awsBedrock`: designed to be used through an OpenAI-compatible proxy (LiteLLM or Bedrock access gateways), not the native Bedrock runtime.

---

## 4. Reasoning Capability Model

Reasoning state is normalized via:

- [`getIsReasoningEnabledState`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1554)
- [`getSendableReasoningInfo`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1580)

The main pattern:

- If `reasoningCapabilities.supportsReasoning` is `false`:
  - No reasoning payload is sent; reasoning is off.
- If reasoning is supported:
  - Check model selection options (`reasoningEnabled`, `reasoningBudget`, `reasoningEffort`).
  - Determine a simple `SendableReasoningInfo`:
    - `type: 'budget_slider_value'` for Anthropic & Gemini-type budgets.
    - `type: 'effort_slider_value'` for OpenAI/xAI-style efforts.

Each provider’s `providerReasoningIOSettings` maps `SendableReasoningInfo` into appropriate request fields.

---

## 5. Maintenance Guidelines

When modifying model capabilities:

1. **Preferred change process**

   - Make canonical provider/model changes in **Crux**:
     - Edit or add catalog entries under [`crux_providers/catalog/providers/*.yaml`](crux/crux_providers/catalog/providers/openai.yaml:1).
     - Ensure they are loaded into SQLite and exposed via [`/api/models`](crux/crux_providers/service/app.py:1) / [`/api/providers`](crux/crux_providers/service/app.py:1). See [`CRUX_INTEGRATION.md`](docs/crux_integration/CRUX_INTEGRATION.md:1) for details.
   - In the IDE, adjust only the adapter layer when necessary:
     - [`modelCapabilities.ts`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1) for provider settings, heuristics, and reasoning I/O.
     - [`convertToLLMMessageService.ts`](void_genesis_ide/src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts:243) for truncation and budgeting behavior.
     - [`sendLLMMessage.impl.ts`](void_genesis_ide/src/vs/workbench/contrib/void/electron-main/llmMessage/sendLLMMessage.impl.ts:273) for request wiring and provider-specific message shapes.
   - Update this document to reflect:
     - New models or providers.
     - Changes to `contextWindow`, `reservedOutputTokenSpace`, or tool formats.
     - Changes to reasoning capability or provider-level reasoning I/O.

2. **Testing requirements**

   - Always re-run:
     - [`gpt51_testing.md`](void_genesis_ide/docs/gpt51_testing.md:1) for OpenAI GPT‑5.1 (and similar).
   - Optionally extend that protocol for:
     - Other critical providers (Anthropic, Gemini, major open-source providers via vLLM / Ollama).

3. **Adding new providers**

   - When adding a new provider, start in **Crux**:
     - Add a new provider catalog file under [`crux_providers/catalog/providers`](crux/crux_providers/catalog/providers/openai.yaml:1) and wire it into the catalog loader.
     - Expose the provider and its models via [`/api/providers`](crux/crux_providers/service/app.py:1) and [`/api/models`](crux/crux_providers/service/app.py:1).
   - Then, in the IDE (adapter layer only):
     - Implement a `VoidStaticProviderInfo` entry in `modelSettingsOfProvider` inside [`modelCapabilities.ts`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1).
     - Decide:
       - Any provider-specific defaults that are not present in Crux (for example, UI defaults).
       - `modelOptionsFallback` behavior (heuristics for unknown/legacy names).
       - `providerReasoningIOSettings`.
     - Document the new provider and any default models here.

4. **Adding new models**

   - For most providers, add new models to the **Crux catalog YAML** and let them flow into the IDE via the Crux overlay (`/api/models` + overlay merge logic in [`modelCapabilities.ts`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1)).
   - Only add explicit entries in `*ModelOptions` when:
     - You need adapter-local overrides or special-cased behavior for a specific model.
     - You need robust behavior across many minor variants and Crux metadata alone is insufficient.

5. **Fallback sanity checks**

   - Ensure that:
     - [`defaultModelOptions`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities/types.ts:1) stays generous and safe for truly unknown models.
   - When adding new widely used model families or OpenAI releases (for example GPT‑5.1 successors), prefer:
     - Extending the Crux catalog YAMLs and `/api/models` tests, rather than adding new TypeScript heuristics.
   - `extensiveModelOptionsFallback()` in [`modelCapabilities.ts`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1) is intentionally a no-op; do **not** reintroduce IDE-side capability brains there.

By keeping this document synchronized with the implementation in [`modelCapabilities.ts`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities.ts:1), Void Genesis IDE maintains a clear and auditable model capability surface for both human developers and future automated agents.