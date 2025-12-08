/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Neuroca, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/
// TODO This file needs to be reduced to <500 LOC 
// TODO (extract provider code into athe void_genesis_ide\src\vs\workbench\contrib\void\common\modelCapabilities\providers subfolder into provider specific files)
import { FeatureName, ModelSelectionOptions, OverridesOfModel, ProviderName } from './voidSettingsTypes.js';
import {
 	VoidStaticModelInfo,
 	VoidStaticProviderInfo,
 	SendableReasoningInfo,
 	defaultModelOptions,
 } from './modelCapabilities/types.js';
import {
	getCruxOverlayForModel,
	setCruxModelCapabilitiesOverlayForProvider as _setCruxModelCapabilitiesOverlayForProvider,
} from './modelCapabilities/cruxOverlay.js';

export type {
	VoidStaticModelInfo,
	ModelOverrides,
	ProviderReasoningIOSettings,
	VoidStaticProviderInfo,
	SendableReasoningInfo,
} from './modelCapabilities/types.js';

export { modelOverrideKeys } from './modelCapabilities/types.js';
export { _setCruxModelCapabilitiesOverlayForProvider as setCruxModelCapabilitiesOverlayForProvider };



export const defaultProviderSettings = {
	anthropic: {
		apiKey: '',
	},
	openAI: {
		apiKey: '',
	},
	deepseek: {
		apiKey: '',
	},
	ollama: {
		endpoint: 'http://127.0.0.1:11434',
	},
	vLLM: {
		endpoint: 'http://localhost:8000',
	},
	openRouter: {
		apiKey: '',
	},
	openAICompatible: {
		endpoint: '',
		apiKey: '',
		headersJSON: '{}', // default to {}
	},
	gemini: {
		apiKey: '',
	},
	groq: {
		apiKey: '',
	},
	xAI: {
		apiKey: '',
	},
	mistral: {
		apiKey: '',
	},
	lmStudio: {
		endpoint: 'http://localhost:1234',
	},
	liteLLM: { // https://docs.litellm.ai/docs/providers/openai_compatible
		endpoint: '',
	},
	googleVertex: { // google https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/call-vertex-using-openai-library
		region: 'us-west2',
		project: '',
	},
	microsoftAzure: { // microsoft Azure Foundry
		project: '', // really 'resource'
		apiKey: '',
		azureApiVersion: '2024-05-01-preview',
	},
	awsBedrock: {
		apiKey: '',
		region: 'us-east-1', // add region setting
		endpoint: '', // optionally allow overriding default
	},

} as const




export const defaultModelsOfProvider = {
	// Default lists removed; models come from Crux registry refresh.
	openAI: [],
	anthropic: [],
	xAI: [],
	gemini: [],
	deepseek: [],
	ollama: [], // autodetected
	vLLM: [], // autodetected
	lmStudio: [], // autodetected
	openRouter: [],
	groq: [],
	mistral: [],
	openAICompatible: [], // fallback
	googleVertex: [],
	microsoftAzure: [],
	awsBedrock: [],
	liteLLM: [],
} as const satisfies Record<ProviderName, string[]>



 // Core capability types (`VoidStaticModelInfo`, `ModelOverrides`,
 // `ProviderReasoningIOSettings`, `VoidStaticProviderInfo`,
 // `SendableReasoningInfo`) and `modelOverrideKeys` are defined in
 // [`types.ts`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities/types.ts:1)
 // and imported at the top of this module.


/**
 * NOTE [Crux-ADR-002]:
 *
 * Crux's catalog (YAML + SQLite, exposed via `/api/models`) is the
 * **only source of truth** for per-model behavior (context window, system
 * message semantics, tool format, FIM, reasoning flags, etc.).
 *
 * This module is a thin adapter that:
 *   - Provides `defaultModelOptions` as a structural fallback shape.
 *   - Applies the in-memory Crux capability overlay returned by
 *     `getCruxOverlayForModel(...)`.
 *   - Merges user-facing overrides from `overridesOfModel`.
 *
 * Static per-provider tables (`modelOptions`) are intentionally kept empty
 * and are no longer consulted by `getModelCapabilities()`. Any new model
 * or capability must be added to the Crux catalog under
 * [`crux_providers/catalog/providers`](crux/crux_providers/catalog/providers:1),
 * not here.
 */
 // `defaultModelOptions` is now imported from
 // [`types.ts`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities/types.ts:1).

 // Legacy open-source model capability heuristics for various open-source
 // families (Deepseek, Codestral, Devstral, Qwen, Llama, etc.) used to
 // live in this module. Canonical behavior for these models is now defined
 // in Crux's catalog (YAML + SQLite + `void_profile.apply_void_enrichment()`),
 // and the IDE no longer maintains a separate heuristics table here.




/**
 * Fallback for unknown models when Crux does not yet expose explicit
 * capabilities. This intentionally does **not** encode any provider- or
 * model-specific heuristics; it returns `null` so that callers fall back to
 * `defaultModelOptions` plus whatever Crux overlay is available.
 *
 * Canonical provider/model behavior must live in Crux (YAML + SQLite +
 * `void_profile.apply_void_enrichment()`), not in this TypeScript layer.
 */
const extensiveModelOptionsFallback: VoidStaticProviderInfo['modelOptionsFallback'] =
 (_modelName, _fallbackKnownValues) => {
 	return null;
 };






// Static per-provider model tables (ANTHROPIC first, others below).
//
// These tables currently encode Void's intended semantics for each model.
// They are in the process of being extracted into the embedded Crux model
// catalog (YAML + loader → SQLite), so that the same information lives in
// one place and is served over `/api/models` to all Void components.
//
// Do not treat these as a long-term second brain for providers. When adding
// or adjusting production models, update the embedded Crux catalog and its
// tests, and keep this file in sync only as long as it is needed for the
// migration.
 // ---------------- ANTHROPIC ----------------
// Canonical Anthropic model capabilities now live in Crux's catalog
// (`crux/crux_providers/catalog/providers/anthropic.yaml`). This table is kept
// empty so that capabilities come from Crux via the overlay.
const anthropicModelOptions: { [s: string]: VoidStaticModelInfo } = {};

const anthropicSettings: VoidStaticProviderInfo = {
	providerReasoningIOSettings: {
		input: {
			includeInPayload: (reasoningInfo) => {
				if (!reasoningInfo?.isReasoningEnabled) return null

				if (reasoningInfo.type === 'budget_slider_value') {
					return { thinking: { type: 'enabled', budget_tokens: reasoningInfo.reasoningBudget } }
				}
				return null
			}
		},
	},
	modelOptions: anthropicModelOptions,
	modelOptionsFallback: extensiveModelOptionsFallback,
}


 // ---------------- OPENAI ----------------
 // Canonical OpenAI model capabilities now live in Crux's catalog
 // (`crux/crux_providers/catalog/providers/openai.yaml`). This table is kept
 // empty so that capabilities come from Crux via the overlay and
 // `extensiveModelOptionsFallback` heuristics for OpenAI‑compatible endpoints.
const openAIModelOptions: { [s: string]: VoidStaticModelInfo } = {};


// https://platform.openai.com/docs/guides/reasoning?api-mode=chat
const openAICompatIncludeInPayloadReasoning = (reasoningInfo: SendableReasoningInfo) => {
	if (!reasoningInfo?.isReasoningEnabled) return null
	if (reasoningInfo.type === 'effort_slider_value') {
		return { reasoning_effort: reasoningInfo.reasoningEffort }
	}
	return null

}

const openAISettings: VoidStaticProviderInfo = {
	modelOptions: openAIModelOptions,
	// Use the shared heuristic fallback so that OpenAI model capabilities are
	// primarily driven by Crux's catalog (via overlay) plus the generic
	// `extensiveModelOptionsFallback` logic for GPT/o*-style ids.
	modelOptionsFallback: (modelName) => extensiveModelOptionsFallback(modelName),
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
}

 // ---------------- XAI ----------------
 // Canonical xAI model capabilities now live in Crux's catalog
 // (`crux/crux_providers/catalog/providers/xai.yaml`). Keep this
 // table empty so capabilities come from Crux via the overlay.
 // Any future heuristics for unknown xAI models should be handled
 // in Crux or via generic open‑source fallbacks, not here.
const xAIModelOptions: { [s: string]: VoidStaticModelInfo } = {};

const xAISettings: VoidStaticProviderInfo = {
	modelOptions: xAIModelOptions,
	// Defer to Crux for all known xAI models. For unknown model ids,
	// do not attempt client-side heuristics; treat them as generic
	// unrecognized models.
	modelOptionsFallback: (_modelName) => { return null },
	// same implementation as openai
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
}


 // ---------------- GEMINI ----------------
 // Canonical Gemini model capabilities now live in Crux's catalog
 // (`crux/crux_providers/catalog/providers/gemini.yaml`). This table is kept
 // empty so that capabilities come from Crux via the overlay. Gemini-specific
 // truncation and reasoning behavior is handled via provider-level adapters
 // (e.g. ThinkingConfig) in the send path.
 const geminiModelOptions: { [s: string]: VoidStaticModelInfo } = {};

 const geminiSettings: VoidStaticProviderInfo = {
 	modelOptions: geminiModelOptions,
 	// No provider-specific fallback here: Crux `/api/models` supplies real
 	// capabilities for Gemini models. In the absence of Crux data, generic
 	// defaults (`defaultModelOptions`) will be used.
 	modelOptionsFallback: (modelName) => { return null },
 }



// ---------------- DEEPSEEK API ----------------
// Canonical Deepseek model capabilities now live in Crux's catalog
// ([`deepseek.yaml`](crux/crux_providers/catalog/providers/deepseek.yaml:1)). Keep this
// table empty so capabilities come from Crux via the overlay.
const deepseekModelOptions: { [s: string]: VoidStaticModelInfo } = {};

const deepseekSettings: VoidStaticProviderInfo = {
	modelOptions: deepseekModelOptions,
	modelOptionsFallback: (_modelName) => { return null },
	providerReasoningIOSettings: {
		// reasoning: OAICompat + response.choices[0].delta.reasoning_content
		// https://api-docs.deepseek.com/guides/reasoning_model
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { nameOfFieldInDelta: 'reasoning_content' },
	},
}



// ---------------- MISTRAL ----------------
// Canonical Mistral model capabilities now live in Crux's catalog
// ([`mistral.yaml`](crux/crux_providers/catalog/providers/mistral.yaml:1)). Keep this
// table empty so capabilities come from Crux via the overlay.
const mistralModelOptions: { [s: string]: VoidStaticModelInfo } = {};

const mistralSettings: VoidStaticProviderInfo = {
	modelOptions: mistralModelOptions,
	modelOptionsFallback: (_modelName) => { return null },
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
}


// ---------------- GROQ ----------------
//
// Canonical Groq model capabilities now live in Crux's catalog
// (`crux/crux_providers/catalog/providers/groq.yaml`). This table is kept
// empty so that capabilities come from Crux via the overlay. Groq-specific
// reasoning I/O behavior remains encoded in `groqSettings`.
const groqModelOptions: { [s: string]: VoidStaticModelInfo } = {};

const groqSettings: VoidStaticProviderInfo = {
	modelOptions: groqModelOptions,
	modelOptionsFallback: (modelName) => { return null },
	providerReasoningIOSettings: {
		// Must be set to either parsed or hidden when using tool calling https://console.groq.com/docs/reasoning
		input: {
			includeInPayload: (reasoningInfo) => {
				if (!reasoningInfo?.isReasoningEnabled) return null
				if (reasoningInfo.type === 'budget_slider_value') {
					return { reasoning_format: 'parsed' }
				}
				return null
			}
		},
		output: { nameOfFieldInDelta: 'reasoning' },
	},
}


// ---------------- GOOGLE VERTEX ----------------
const googleVertexModelOptions = {
} as const satisfies Record<string, VoidStaticModelInfo>
const googleVertexSettings: VoidStaticProviderInfo = {
	modelOptions: googleVertexModelOptions,
	modelOptionsFallback: (modelName) => { return null },
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
}

// ---------------- MICROSOFT AZURE ----------------
const microsoftAzureModelOptions = {
} as const satisfies Record<string, VoidStaticModelInfo>
const microsoftAzureSettings: VoidStaticProviderInfo = {
	modelOptions: microsoftAzureModelOptions,
	modelOptionsFallback: (modelName) => { return null },
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
}

// ---------------- AWS BEDROCK ----------------
const awsBedrockModelOptions = {
} as const satisfies Record<string, VoidStaticModelInfo>

const awsBedrockSettings: VoidStaticProviderInfo = {
	modelOptions: awsBedrockModelOptions,
	modelOptionsFallback: (modelName) => { return null },
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
}


// ---------------- VLLM, OLLAMA, OPENAICOMPAT (self-hosted / local) ----------------
// Canonical Ollama model capabilities now live in Crux's catalog
// (`crux/crux_providers/catalog/providers/ollama.yaml`). This table is kept
// empty so that capabilities come from Crux via the overlay. The
// `ollamaRecommendedModels` list is retained as an IDE-local hint for which
// models to install first when setting up a local environment.
const ollamaModelOptions: { [s: string]: VoidStaticModelInfo } = {};

export const ollamaRecommendedModels = ['qwen2.5-coder:1.5b', 'llama3.1', 'qwq', 'deepseek-r1', 'devstral:latest'] as const satisfies string[]


const vLLMSettings: VoidStaticProviderInfo = {
	modelOptionsFallback: (modelName) => extensiveModelOptionsFallback(modelName, { downloadable: { sizeGb: 'not-known' } }),
	modelOptions: {},
	providerReasoningIOSettings: {
		// reasoning: OAICompat + response.choices[0].delta.reasoning_content // https://docs.vllm.ai/en/stable/features/reasoning_outputs.html#streaming-chat-completions
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { nameOfFieldInDelta: 'reasoning_content' },
	},
}

const lmStudioSettings: VoidStaticProviderInfo = {
	modelOptionsFallback: (modelName) => extensiveModelOptionsFallback(modelName, { downloadable: { sizeGb: 'not-known' }, contextWindow: 4_096 }),
	modelOptions: {},
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { needsManualParse: true },
	},
}

const ollamaSettings: VoidStaticProviderInfo = {
	modelOptionsFallback: (modelName) => extensiveModelOptionsFallback(modelName, { downloadable: { sizeGb: 'not-known' } }),
	modelOptions: ollamaModelOptions,
	providerReasoningIOSettings: {
		// reasoning: we need to filter out reasoning <think> tags manually
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { needsManualParse: true },
	},
}

const openaiCompatible: VoidStaticProviderInfo = {
	modelOptionsFallback: (modelName) => extensiveModelOptionsFallback(modelName),
	modelOptions: {},
	providerReasoningIOSettings: {
		// reasoning: we have no idea what endpoint they used, so we can't consistently parse out reasoning
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { nameOfFieldInDelta: 'reasoning_content' },
	},
}

const liteLLMSettings: VoidStaticProviderInfo = { // https://docs.litellm.ai/docs/reasoning_content
	modelOptionsFallback: (modelName) => extensiveModelOptionsFallback(modelName, { downloadable: { sizeGb: 'not-known' } }),
	modelOptions: {},
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { nameOfFieldInDelta: 'reasoning_content' },
	},
}


 // ---------------- OPENROUTER ----------------
 // Canonical OpenRouter model capabilities now live in Crux's catalog
 // ([`openrouter.yaml`](crux/crux_providers/catalog/providers/openrouter.yaml:1)).
 // Keep this table empty so capabilities come from Crux via the overlay.
 const openRouterModelOptions_assumingOpenAICompat: { [s: string]: VoidStaticModelInfo } = {};

const openRouterSettings: VoidStaticProviderInfo = {
	modelOptions: openRouterModelOptions_assumingOpenAICompat,
	modelOptionsFallback: (modelName) => {
		const res = extensiveModelOptionsFallback(modelName)
		// openRouter does not support gemini-style, use openai-style instead
		if (res?.specialToolFormat === 'gemini-style') {
			res.specialToolFormat = 'openai-style'
		}
		return res
	},
	providerReasoningIOSettings: {
		// reasoning: OAICompat + response.choices[0].delta.reasoning : payload should have {include_reasoning: true} https://openrouter.ai/announcements/reasoning-tokens-for-thinking-models
		input: {
			// https://openrouter.ai/docs/use-cases/reasoning-tokens
			includeInPayload: (reasoningInfo) => {
				if (!reasoningInfo?.isReasoningEnabled) return null

				if (reasoningInfo.type === 'budget_slider_value') {
					return {
						reasoning: {
							max_tokens: reasoningInfo.reasoningBudget
						}
					}
				}
				if (reasoningInfo.type === 'effort_slider_value')
					return {
						reasoning: {
							effort: reasoningInfo.reasoningEffort
						}
					}
				return null
			}
		},
		output: { nameOfFieldInDelta: 'reasoning' },
	},
}




 // ---------------- model settings of everything above ----------------

const modelSettingsOfProvider: { [providerName in ProviderName]: VoidStaticProviderInfo } = {
	openAI: openAISettings,
	anthropic: anthropicSettings,
	xAI: xAISettings,
	gemini: geminiSettings,

	// open source models
	deepseek: deepseekSettings,
	groq: groqSettings,

	// open source models + providers (mixture of everything)
	openRouter: openRouterSettings,
	vLLM: vLLMSettings,
	ollama: ollamaSettings,
	openAICompatible: openaiCompatible,
	mistral: mistralSettings,

	liteLLM: liteLLMSettings,
	lmStudio: lmStudioSettings,

	googleVertex: googleVertexSettings,
	microsoftAzure: microsoftAzureSettings,
	awsBedrock: awsBedrockSettings,
} as const;



 // ---------------- Crux-backed model capability overlay ----------------
 // Implementation moved to [`cruxOverlay.ts`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities/cruxOverlay.ts:1).



// ---------------- exports ----------------

/**
 * Returns model capabilities and the adjusted model name for a given
 * `(providerName, modelName)` selection.
 *
 * Crux's `/api/models` is the single source of truth for model semantics.
 * This function:
 *
 *   1. Looks up a Crux-derived capability overlay for
 *      `(providerName, modelName)` via `getCruxOverlayForModel(...)`.
 *   2. Uses `defaultModelOptions` as a structural fallback shape.
 *   3. Marks models as recognized when Crux provides an overlay and as
 *      `isUnrecognizedModel: true` otherwise.
 *
 * In all cases, user overrides from `overridesOfModel` are merged last so
 * that explicit configuration wins over both defaults and Crux metadata.
 */
export const getModelCapabilities = (
	providerName: ProviderName,
	modelName: string,
	overridesOfModel: OverridesOfModel | undefined,
): VoidStaticModelInfo & (
	| { modelName: string; recognizedModelName: string; isUnrecognizedModel: false }
	| { modelName: string; recognizedModelName?: undefined; isUnrecognizedModel: true }
) => {

	// User overrides are always applied last.
	const overrides = overridesOfModel?.[providerName]?.[modelName];

	// Crux-backed overlay for this provider/model pair, if present.
	const overlay = getCruxOverlayForModel(providerName, modelName) ?? {};
	const hasOverlay = Object.keys(overlay).length > 0;

	if (hasOverlay) {
		// Crux knows about this model. Treat it as recognized and let
		// Crux capabilities drive behavior, using `defaultModelOptions`
		// only as a structural fallback.
		const base = {
			...defaultModelOptions,
			modelName,
			recognizedModelName: modelName,
			isUnrecognizedModel: false as const,
		};
		const merged = { ...base, ...overlay, ...overrides };
		return merged;
	}

	// No Crux entry yet: fall back to structural defaults only.
	const base = {
		...defaultModelOptions,
		modelName,
		isUnrecognizedModel: true as const,
	};
	const merged = { ...base, ...overrides };
	return merged;
}

// non-model settings
export const getProviderCapabilities = (providerName: ProviderName) => {
	const { providerReasoningIOSettings } = modelSettingsOfProvider[providerName]
	return { providerReasoningIOSettings }
}


 // `SendableReasoningInfo` is now exported from
 // [`types.ts`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities/types.ts:1).
export const getIsReasoningEnabledState = (
	featureName: FeatureName,
	providerName: ProviderName,
	modelName: string,
	modelSelectionOptions: ModelSelectionOptions | undefined,
	overridesOfModel: OverridesOfModel | undefined,
) => {
	const { supportsReasoning, canTurnOffReasoning } = getModelCapabilities(providerName, modelName, overridesOfModel).reasoningCapabilities || {}
	if (!supportsReasoning) return false

	// default to enabled if can't turn off, or if the featureName is Chat.
	const defaultEnabledVal = featureName === 'Chat' || !canTurnOffReasoning

	const isReasoningEnabled = modelSelectionOptions?.reasoningEnabled ?? defaultEnabledVal
	return isReasoningEnabled
}


export const getReservedOutputTokenSpace = (providerName: ProviderName, modelName: string, opts: { isReasoningEnabled: boolean, overridesOfModel: OverridesOfModel | undefined }) => {
	const {
		reasoningCapabilities,
		reservedOutputTokenSpace,
	} = getModelCapabilities(providerName, modelName, opts.overridesOfModel)
	return opts.isReasoningEnabled && reasoningCapabilities ? reasoningCapabilities.reasoningReservedOutputTokenSpace : reservedOutputTokenSpace
}

// used to force reasoning state (complex) into something simple we can just read from when sending a message
export const getSendableReasoningInfo = (
	featureName: FeatureName,
	providerName: ProviderName,
	modelName: string,
	modelSelectionOptions: ModelSelectionOptions | undefined,
	overridesOfModel: OverridesOfModel | undefined,
): SendableReasoningInfo => {

	const { reasoningSlider: reasoningBudgetSlider } = getModelCapabilities(providerName, modelName, overridesOfModel).reasoningCapabilities || {}
	const isReasoningEnabled = getIsReasoningEnabledState(featureName, providerName, modelName, modelSelectionOptions, overridesOfModel)
	if (!isReasoningEnabled) return null

	// check for reasoning budget
	const reasoningBudget = reasoningBudgetSlider?.type === 'budget_slider' ? modelSelectionOptions?.reasoningBudget ?? reasoningBudgetSlider?.default : undefined
	if (reasoningBudget) {
		return { type: 'budget_slider_value', isReasoningEnabled: isReasoningEnabled, reasoningBudget: reasoningBudget }
	}

	// check for reasoning effort
	const reasoningEffort = reasoningBudgetSlider?.type === 'effort_slider' ? modelSelectionOptions?.reasoningEffort ?? reasoningBudgetSlider?.default : undefined
	if (reasoningEffort) {
		return { type: 'effort_slider_value', isReasoningEnabled: isReasoningEnabled, reasoningEffort: reasoningEffort }
	}

	return null
}

/**
 * Determine whether tools are enabled for a given `(providerName, modelName)`
 * pair after combining static tables, Crux overlay, and user overrides.
 *
 * When Crux has not yet populated the `toolsSupported` capability for a
 * model, this helper falls back to `true` so behavior matches the
 * pre-Crux IDE semantics (tools available unless explicitly disabled).
 */
export const getToolsEnabledForModel = (
	providerName: ProviderName,
	modelName: string,
	overridesOfModel: OverridesOfModel | undefined,
): boolean => {
	const caps = getModelCapabilities(providerName, modelName, overridesOfModel);
	if (typeof caps.toolsSupported === 'boolean') {
		return caps.toolsSupported;
	}
	// Backwards-compatible default.
	return true;
};

/**
 * Retrieve the Crux-derived soft cap on tool calls per logical turn for
 * a given model, if present and sane. A return value of `undefined`
 * means "no explicit per-model cap" (or an invalid value), and callers
 * should fall back to orchestrator-wide defaults.
 */
export const getMaxToolCallsPerTurnForModel = (
	providerName: ProviderName,
	modelName: string,
	overridesOfModel: OverridesOfModel | undefined,
): number | undefined => {
	const caps = getModelCapabilities(providerName, modelName, overridesOfModel);
	const value = caps.maxToolCallsPerTurn;
	if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
		return value;
	}
	return undefined;
}
