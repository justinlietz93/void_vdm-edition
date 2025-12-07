// TODO This file needs to be reduced to <500 LOC (extract code into a subfolder with separate files)
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
 * The tables and defaults in this module are currently the **authoritative
 * Void-side description** of per-model behavior (context window, system
 * message semantics, tool format, FIM, reasoning flags, etc.).
 *
 * Per the Crux integration ADRs, these definitions are being **lifted into
 * the embedded Crux provider layer** by exporting them into a structured
 * catalog (for example a YAML file in the Crux repo) and loading that into
 * Crux's SQLite-backed model registry via a loader script.
 *
 * At runtime, the embedded Crux service exposes this catalog via `/api/models`,
 * and the IDE overlays those capabilities back on top of these tables so that
 * both sides stay consistent during the migration. Once the catalog is
 * stable, this file is expected to shrink into a thin adapter (or be removed
 * entirely in favor of the Crux-backed catalog).
 */
 // `defaultModelOptions` is now imported from
 // [`types.ts`](void_genesis_ide/src/vs/workbench/contrib/void/common/modelCapabilities/types.ts:1).

// TODO!!! double check all context sizes below
// TODO!!! add openrouter common models
// TODO!!! allow user to modify capabilities and tell them if autodetected model or falling back
const openSourceModelOptions_assumingOAICompat = {
	'deepseekR1': {
		supportsFIM: false,
		supportsSystemMessage: false,
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: true, openSourceThinkTags: ['<think>', '</think>'] },
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	'deepseekCoderV3': {
		supportsFIM: false,
		supportsSystemMessage: false, // unstable
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	'deepseekCoderV2': {
		supportsFIM: false,
		supportsSystemMessage: false, // unstable
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	'codestral': {
		supportsFIM: true,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	'devstral': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 131_000, reservedOutputTokenSpace: 8_192,
	},
	'openhands-lm-32b': { // https://www.all-hands.dev/blog/introducing-openhands-lm-32b----a-strong-open-coding-agent-model
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false, // built on qwen 2.5 32B instruct
		contextWindow: 128_000, reservedOutputTokenSpace: 4_096
	},

	// really only phi4-reasoning supports reasoning... simpler to combine them though
	'phi4': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: true, canIOReasoning: true, openSourceThinkTags: ['<think>', '</think>'] },
		contextWindow: 16_000, reservedOutputTokenSpace: 4_096,
	},

	'gemma': { // https://news.ycombinator.com/item?id=43451406
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	// llama 4 https://ai.meta.com/blog/llama-4-multimodal-intelligence/
	'llama4-scout': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 10_000_000, reservedOutputTokenSpace: 4_096,
	},
	'llama4-maverick': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 10_000_000, reservedOutputTokenSpace: 4_096,
	},

	// llama 3
	'llama3': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	'llama3.1': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	'llama3.2': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	'llama3.3': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	// qwen
	'qwen2.5coder': {
		supportsFIM: true,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	'qwq': {
		supportsFIM: false, // no FIM, yes reasoning
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: true, openSourceThinkTags: ['<think>', '</think>'] },
		contextWindow: 128_000, reservedOutputTokenSpace: 8_192,
	},
	'qwen3': {
		supportsFIM: false, // replaces QwQ
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: true, canIOReasoning: true, openSourceThinkTags: ['<think>', '</think>'] },
		contextWindow: 32_768, reservedOutputTokenSpace: 8_192,
	},
	// FIM only
	'starcoder2': {
		supportsFIM: true,
		supportsSystemMessage: false,
		reasoningCapabilities: false,
		contextWindow: 128_000, reservedOutputTokenSpace: 8_192,

	},
	'codegemma:2b': {
		supportsFIM: true,
		supportsSystemMessage: false,
		reasoningCapabilities: false,
		contextWindow: 128_000, reservedOutputTokenSpace: 8_192,

	},
	'quasar': { // openrouter/quasar-alpha
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 1_000_000, reservedOutputTokenSpace: 32_000,
	}
} as const satisfies { [s: string]: Partial<VoidStaticModelInfo> }




 // keep modelName, but use the fallback's defaults
const extensiveModelOptionsFallback: VoidStaticProviderInfo['modelOptionsFallback'] = (modelName, fallbackKnownValues) => {

	const lower = modelName.toLowerCase();

	const toFallback = <
		T extends { [s: string]: Omit<VoidStaticModelInfo, 'cost' | 'downloadable'> },
	>(
		obj: T,
		recognizedModelName: string & keyof T,
	): VoidStaticModelInfo & { modelName: string; recognizedModelName: string } => {

		const opts = obj[recognizedModelName];

		// If we do not have a static table entry (because canonical model
		// capabilities now live in Crux), fall back to the generic defaults
		// and let the Crux overlay supply real metadata when available.
		if (!opts) {
			return {
				...defaultModelOptions,
				recognizedModelName,
				modelName,
				...fallbackKnownValues,
			};
		}

		const supportsSystemMessage =
			opts.supportsSystemMessage === 'separated'
				? 'system-role'
				: opts.supportsSystemMessage;

		return {
			recognizedModelName,
			modelName,
			...opts,
			supportsSystemMessage,
			cost: { input: 0, output: 0 },
			downloadable: false,
			...fallbackKnownValues,
		};
	};

	// Heuristics for common open‑source / OpenAI‑compatible model families.
	if (lower.includes('gemini') && (lower.includes('2.5') || lower.includes('2-5')))
		return toFallback(geminiModelOptions, 'gemini-2.5-pro-exp-03-25');

	if (lower.includes('claude-3-5') || lower.includes('claude-3.5'))
		return toFallback(anthropicModelOptions, 'claude-3-5-sonnet-20241022');
	if (lower.includes('claude'))
		return toFallback(anthropicModelOptions, 'claude-3-7-sonnet-20250219');

	if (lower.includes('grok-2') || lower.includes('grok2'))
		return toFallback(xAIModelOptions, 'grok-2');
	if (lower.includes('grok'))
		return toFallback(xAIModelOptions, 'grok-3');

	if (lower.includes('deepseek-r1') || lower.includes('deepseek-reasoner'))
		return toFallback(openSourceModelOptions_assumingOAICompat, 'deepseekR1');
	if (lower.includes('deepseek') && lower.includes('v2'))
		return toFallback(openSourceModelOptions_assumingOAICompat, 'deepseekCoderV2');
	if (lower.includes('deepseek'))
		return toFallback(openSourceModelOptions_assumingOAICompat, 'deepseekCoderV3');

	if (lower.includes('llama3'))
		return toFallback(openSourceModelOptions_assumingOAICompat, 'llama3');
	if (lower.includes('llama3.1'))
		return toFallback(openSourceModelOptions_assumingOAICompat, 'llama3.1');
	if (lower.includes('llama3.2'))
		return toFallback(openSourceModelOptions_assumingOAICompat, 'llama3.2');
	if (lower.includes('llama3.3'))
		return toFallback(openSourceModelOptions_assumingOAICompat, 'llama3.3');
	if (lower.includes('llama') || lower.includes('scout'))
		return toFallback(openSourceModelOptions_assumingOAICompat, 'llama4-scout');
	if (lower.includes('maverick'))
		return toFallback(openSourceModelOptions_assumingOAICompat, 'llama4-maverick');

	if (lower.includes('qwen') && lower.includes('2.5') && lower.includes('coder'))
		return toFallback(openSourceModelOptions_assumingOAICompat, 'qwen2.5coder');
	if (lower.includes('qwen') && lower.includes('3'))
		return toFallback(openSourceModelOptions_assumingOAICompat, 'qwen3');
	if (lower.includes('qwen'))
		return toFallback(openSourceModelOptions_assumingOAICompat, 'qwen3');
	if (lower.includes('qwq'))
		return toFallback(openSourceModelOptions_assumingOAICompat, 'qwq');
	if (lower.includes('phi4'))
		return toFallback(openSourceModelOptions_assumingOAICompat, 'phi4');
	if (lower.includes('codestral'))
		return toFallback(openSourceModelOptions_assumingOAICompat, 'codestral');
	if (lower.includes('devstral'))
		return toFallback(openSourceModelOptions_assumingOAICompat, 'devstral');

	if (lower.includes('gemma'))
		return toFallback(openSourceModelOptions_assumingOAICompat, 'gemma');

	if (lower.includes('starcoder2'))
		return toFallback(openSourceModelOptions_assumingOAICompat, 'starcoder2');

	if (lower.includes('openhands'))
		return toFallback(openSourceModelOptions_assumingOAICompat, 'openhands-lm-32b'); // max output unclear

	if (lower.includes('quasar') || lower.includes('quaser'))
		return toFallback(openSourceModelOptions_assumingOAICompat, 'quasar');

	// Heuristics for GPT / o*-style ids when used via generic OpenAI‑compatible endpoints.
	if (lower.includes('gpt') && lower.includes('mini') && (lower.includes('4.1') || lower.includes('4-1')))
		return toFallback(openAIModelOptions, 'gpt-4.1-mini');
	if (lower.includes('gpt') && lower.includes('nano') && (lower.includes('4.1') || lower.includes('4-1')))
		return toFallback(openAIModelOptions, 'gpt-4.1-nano');
	if (lower.includes('gpt') && (lower.includes('4.1') || lower.includes('4-1')))
		return toFallback(openAIModelOptions, 'gpt-4.1');

	if (lower.includes('4o') && lower.includes('mini'))
		return toFallback(openAIModelOptions, 'gpt-4o-mini');
	if (lower.includes('4o'))
		return toFallback(openAIModelOptions, 'gpt-4o');

	if (lower.includes('o1') && lower.includes('mini'))
		return toFallback(openAIModelOptions, 'o1-mini');
	if (lower.includes('o1'))
		return toFallback(openAIModelOptions, 'o1');
	if (lower.includes('o3') && lower.includes('mini'))
		return toFallback(openAIModelOptions, 'o3-mini');
	if (lower.includes('o3'))
		return toFallback(openAIModelOptions, 'o3');
	if (lower.includes('o4') && lower.includes('mini'))
		return toFallback(openAIModelOptions, 'o4-mini');

	// Direct lookup against our open‑source table by key.
	if (Object.keys(openSourceModelOptions_assumingOAICompat).map(k => k.toLowerCase()).includes(lower))
		return toFallback(
			openSourceModelOptions_assumingOAICompat,
			lower as keyof typeof openSourceModelOptions_assumingOAICompat,
		);

	return null;
}






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
const xAIModelOptions = {
	// https://docs.x.ai/docs/guides/reasoning#reasoning
	// https://docs.x.ai/docs/models#models-and-pricing
	'grok-2': {
		contextWindow: 131_072,
		reservedOutputTokenSpace: null,
		cost: { input: 2.00, output: 10.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style',
		reasoningCapabilities: false,
	},
	'grok-3': {
		contextWindow: 131_072,
		reservedOutputTokenSpace: null,
		cost: { input: 3.00, output: 15.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style',
		reasoningCapabilities: false,
	},
	'grok-3-fast': {
		contextWindow: 131_072,
		reservedOutputTokenSpace: null,
		cost: { input: 5.00, output: 25.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style',
		reasoningCapabilities: false,
	},
	// only mini supports thinking
	'grok-3-mini': {
		contextWindow: 131_072,
		reservedOutputTokenSpace: null,
		cost: { input: 0.30, output: 0.50 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style',
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: false, reasoningSlider: { type: 'effort_slider', values: ['low', 'high'], default: 'low' } },
	},
	'grok-3-mini-fast': {
		contextWindow: 131_072,
		reservedOutputTokenSpace: null,
		cost: { input: 0.60, output: 4.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style',
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: false, reasoningSlider: { type: 'effort_slider', values: ['low', 'high'], default: 'low' } },
	},
} as const satisfies { [s: string]: VoidStaticModelInfo }

const xAISettings: VoidStaticProviderInfo = {
	modelOptions: xAIModelOptions,
	modelOptionsFallback: (modelName) => {
		const lower = modelName.toLowerCase()
		let fallbackName: keyof typeof xAIModelOptions | null = null
		if (lower.includes('grok-2')) fallbackName = 'grok-2'
		if (lower.includes('grok-3')) fallbackName = 'grok-3'
		if (lower.includes('grok')) fallbackName = 'grok-3'
		if (fallbackName) return { modelName: fallbackName, recognizedModelName: fallbackName, ...xAIModelOptions[fallbackName] }
		return null
	},
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
const deepseekModelOptions = {
	'deepseek-chat': {
		...openSourceModelOptions_assumingOAICompat.deepseekR1,
		contextWindow: 64_000, // https://api-docs.deepseek.com/quick_start/pricing
		reservedOutputTokenSpace: 8_000, // 8_000,
		cost: { cache_read: .07, input: .27, output: 1.10, },
		downloadable: false,
	},
	'deepseek-reasoner': {
		...openSourceModelOptions_assumingOAICompat.deepseekCoderV2,
		contextWindow: 64_000,
		reservedOutputTokenSpace: 8_000, // 8_000,
		cost: { cache_read: .14, input: .55, output: 2.19, },
		downloadable: false,
	},
} as const satisfies { [s: string]: VoidStaticModelInfo }


const deepseekSettings: VoidStaticProviderInfo = {
	modelOptions: deepseekModelOptions,
	modelOptionsFallback: (modelName) => { return null },
	providerReasoningIOSettings: {
		// reasoning: OAICompat +  response.choices[0].delta.reasoning_content // https://api-docs.deepseek.com/guides/reasoning_model
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { nameOfFieldInDelta: 'reasoning_content' },
	},
}



// ---------------- MISTRAL ----------------

const mistralModelOptions = { // https://mistral.ai/products/la-plateforme#pricing https://docs.mistral.ai/getting-started/models/models_overview/#premier-models
	'mistral-large-latest': {
		contextWindow: 131_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 2.00, output: 6.00 },
		supportsFIM: false,
		downloadable: { sizeGb: 73 },
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'mistral-medium-latest': { // https://openrouter.ai/mistralai/mistral-medium-3
		contextWindow: 131_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0.40, output: 2.00 },
		supportsFIM: false,
		downloadable: { sizeGb: 'not-known' },
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'codestral-latest': {
		contextWindow: 256_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0.30, output: 0.90 },
		supportsFIM: true,
		downloadable: { sizeGb: 13 },
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'magistral-medium-latest': {
		contextWindow: 256_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0.30, output: 0.90 }, // TODO: check this
		supportsFIM: true,
		downloadable: { sizeGb: 13 },
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true, canTurnOffReasoning: false, openSourceThinkTags: ['<think>', '</think>'] },
	},
	'magistral-small-latest': {
		contextWindow: 40_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0.30, output: 0.90 }, // TODO: check this
		supportsFIM: true,
		downloadable: { sizeGb: 13 },
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true, canTurnOffReasoning: false, openSourceThinkTags: ['<think>', '</think>'] },
	},
	'devstral-small-latest': { //https://openrouter.ai/mistralai/devstral-small:free
		contextWindow: 131_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0, output: 0 },
		supportsFIM: false,
		downloadable: { sizeGb: 14 }, //https://ollama.com/library/devstral
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'ministral-8b-latest': { // ollama 'mistral'
		contextWindow: 131_000,
		reservedOutputTokenSpace: 4_096,
		cost: { input: 0.10, output: 0.10 },
		supportsFIM: false,
		downloadable: { sizeGb: 4.1 },
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'ministral-3b-latest': {
		contextWindow: 131_000,
		reservedOutputTokenSpace: 4_096,
		cost: { input: 0.04, output: 0.04 },
		supportsFIM: false,
		downloadable: { sizeGb: 'not-known' },
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
} as const satisfies { [s: string]: VoidStaticModelInfo }

const mistralSettings: VoidStaticProviderInfo = {
	modelOptions: mistralModelOptions,
	modelOptionsFallback: (modelName) => { return null },
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
const openRouterModelOptions_assumingOpenAICompat = {
	'qwen/qwen3-235b-a22b': {
		contextWindow: 40_960,
		reservedOutputTokenSpace: null,
		cost: { input: .10, output: .10 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true, canTurnOffReasoning: false },
	},
	'microsoft/phi-4-reasoning-plus:free': { // a 14B model...
		contextWindow: 32_768,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true, canTurnOffReasoning: false },
	},
	'mistralai/mistral-small-3.1-24b-instruct:free': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'google/gemini-2.0-flash-lite-preview-02-05:free': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'google/gemini-2.0-pro-exp-02-05:free': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'google/gemini-2.0-flash-exp:free': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'deepseek/deepseek-r1': {
		...openSourceModelOptions_assumingOAICompat.deepseekR1,
		contextWindow: 128_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0.8, output: 2.4 },
		downloadable: false,
	},
	'anthropic/claude-opus-4': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: null,
		cost: { input: 15.00, output: 75.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'anthropic/claude-sonnet-4': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: null,
		cost: { input: 15.00, output: 75.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'anthropic/claude-3.7-sonnet:thinking': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: null,
		cost: { input: 3.00, output: 15.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { // same as anthropic, see above
			supportsReasoning: true,
			canTurnOffReasoning: false,
			canIOReasoning: true,
			reasoningReservedOutputTokenSpace: 8192,
			reasoningSlider: { type: 'budget_slider', min: 1024, max: 8192, default: 1024 }, // they recommend batching if max > 32_000.
		},
	},
	'anthropic/claude-3.7-sonnet': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: null,
		cost: { input: 3.00, output: 15.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false, // stupidly, openrouter separates thinking from non-thinking
	},
	'anthropic/claude-3.5-sonnet': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: null,
		cost: { input: 3.00, output: 15.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'mistralai/codestral-2501': {
		...openSourceModelOptions_assumingOAICompat.codestral,
		contextWindow: 256_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0.3, output: 0.9 },
		downloadable: false,
		reasoningCapabilities: false,
	},
	'mistralai/devstral-small:free': {
		...openSourceModelOptions_assumingOAICompat.devstral,
		contextWindow: 130_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: false,
		reasoningCapabilities: false,
	},
	'qwen/qwen-2.5-coder-32b-instruct': {
		...openSourceModelOptions_assumingOAICompat['qwen2.5coder'],
		contextWindow: 33_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0.07, output: 0.16 },
		downloadable: false,
	},
	'qwen/qwq-32b': {
		...openSourceModelOptions_assumingOAICompat['qwq'],
		contextWindow: 33_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0.07, output: 0.16 },
		downloadable: false,
	}
} as const satisfies { [s: string]: VoidStaticModelInfo }

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
 * Today, the per-provider tables in this module plus `defaultModelOptions`
 * are the primary description of behavior inside the IDE. The embedded Crux
 * provider layer is being populated from the same information, and, when
 * available, its `/api/models` responses are applied as an overlay so that
 * Crux and the IDE stay in sync during the migration to a single catalog.
 *
 * Resolution order (conceptual):
 *
 *   1. Use the per-provider static tables in this module (including each
 *      provider's `modelOptionsFallback`) to obtain a base record when
 *      possible.
 *   2. Apply a Crux capability overlay for the resolved model name, if
 *      present in the in-memory overlay cache.
 *   3. For OpenAI, fall back to a generic GPT/o*-style chat configuration
 *      when the model id looks like a future chat model that is not yet in
 *      the static tables.
 *   4. For completely unknown models, fall back to `defaultModelOptions`.
 *
 * In all cases, user overrides from `overridesOfModel` are merged last so
 * that explicit configuration wins over both static tables and Crux metadata.
 */
export const getModelCapabilities = (
	providerName: ProviderName,
	modelName: string,
	overridesOfModel: OverridesOfModel | undefined,
): VoidStaticModelInfo & (
	| { modelName: string; recognizedModelName: string; isUnrecognizedModel: false }
	| { modelName: string; recognizedModelName?: undefined; isUnrecognizedModel: true }
) => {

	const lowercaseModelName = modelName.toLowerCase();
	const { modelOptions, modelOptionsFallback } = modelSettingsOfProvider[providerName];

	// User overrides are always applied last.
	const overrides = overridesOfModel?.[providerName]?.[modelName];

	// ---- 1) Static tables: exact match ----
	for (const modelName_ in modelOptions) {
		const lowercaseModelName_ = modelName_.toLowerCase();
		if (lowercaseModelName === lowercaseModelName_) {
			const base = {
				// Use the canonical table entry for the matched key, not the
				// user-supplied modelName (which may differ in case or alias).
				...modelOptions[modelName_],
				modelName,
				recognizedModelName: modelName_,
				isUnrecognizedModel: false as const,
			};
			const resolvedName = base.recognizedModelName ?? base.modelName;
			const overlay = getCruxOverlayForModel(providerName, resolvedName) ?? {};
			const merged = { ...base, ...overlay, ...overrides };
			return merged;
		}
	}

	// ---- 2) Static tables: provider-specific fallback ----
	const fallback = modelOptionsFallback(modelName);
	if (fallback) {
		const base = {
			...fallback,
			modelName: fallback.modelName,
			recognizedModelName: fallback.recognizedModelName ?? fallback.modelName,
			isUnrecognizedModel: false as const,
		};
		const resolvedName = base.recognizedModelName ?? base.modelName;
		const overlay = getCruxOverlayForModel(providerName, resolvedName) ?? {};
		const merged = { ...base, ...overlay, ...overrides };
		return merged;
	}

	// ---- 3) Generic OpenAI chat fallback for future GPT/o* ids ----
	if (providerName === 'openAI') {
		const genericLower = lowercaseModelName;
		if (genericLower.startsWith('gpt-') || genericLower.startsWith('o') || genericLower.includes('chatgpt')) {
			const generic: VoidStaticModelInfo = {
				contextWindow: 1_000_000,
				reservedOutputTokenSpace: 32_768,
				cost: { input: 0, output: 0 },
				downloadable: false,
				supportsSystemMessage: 'developer-role',
				specialToolFormat: 'openai-style',
				supportsFIM: false,
				reasoningCapabilities: false,
			};
			const base = {
				...generic,
				modelName,
				recognizedModelName: modelName,
				isUnrecognizedModel: false as const,
			};
			const resolvedName = base.recognizedModelName ?? base.modelName;
			const overlay = getCruxOverlayForModel(providerName, resolvedName) ?? {};
			const merged = { ...base, ...overlay, ...overrides };
			return merged;
		}
	}

	// ---- 4) Completely unknown model: default options only ----
	const resolvedName = modelName;
	const overlay = getCruxOverlayForModel(providerName, resolvedName) ?? {};
	const hasOverlay = Object.keys(overlay).length > 0;

	if (hasOverlay) {
		// Crux knows about this model even though the local tables do not.
		// Treat it as recognized and let Crux capabilities drive behavior,
		// using `defaultModelOptions` only as a structural fallback.
		const base = {
			...defaultModelOptions,
			modelName,
			recognizedModelName: resolvedName,
			isUnrecognizedModel: false as const,
		};
		const merged = { ...base, ...overlay, ...overrides };
		return merged;
	}

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
