// Core model capability types and shared constants for Void Genesis IDE.
//
// This module is the canonical home for:
//   - VoidStaticModelInfo (per-model capabilities)
//   - ModelOverrides and modelOverrideKeys
//   - ProviderReasoningIOSettings / VoidStaticProviderInfo
//   - SendableReasoningInfo
//   - defaultModelOptions
//
// Other modules (including the legacy façade
// [`modelCapabilities.ts`](./modelCapabilities.ts)) should import from here
// instead of duplicating type definitions.

/**
 * Static, provider-agnostic description of a model's capabilities.
 *
 * Void uses this information to decide how to talk to a model:
 *   - context window & reserved output space
 *   - system message semantics
 *   - tool-calling format
 *   - FIM (fill-in-middle) support
 *   - reasoning/tokens behavior
 *   - indicative pricing and download hints
 */
export type VoidStaticModelInfo = {
	// ---- core token window characteristics ----

	/** Maximum supported input tokens (context window). */
	contextWindow: number;

	/**
	 * Reserved portion of the context window for output tokens.
	 * If null, a default (e.g. 4096) is applied at call sites.
	 */
	reservedOutputTokenSpace: number | null;

	// ---- system message behavior ----

	/**
	 * How this model accepts system instructions.
	 *
	 * false          → no native system channel; must inline into user content.
	 * 'system-role'  → standard OpenAI-style system role.
	 * 'developer-role' → OpenAI "developer" channel (o1/o3-style).
	 * 'separated'    → separate system field (e.g. Anthropic, Gemini).
	 */
	supportsSystemMessage: false | 'system-role' | 'developer-role' | 'separated';

	/**
	 * Tool invocation format, when tools are supported.
	 *
	 * 'openai-style'    → OpenAI function/tool calling JSON schema.
	 * 'anthropic-style' → Anthropic tool_use / tool_result content blocks.
	 * 'gemini-style'    → Gemini functionCall / functionResponse parts.
	 *
	 * If omitted, the IDE falls back to XML-based tools.
	 */
	specialToolFormat?: 'openai-style' | 'anthropic-style' | 'gemini-style';

	/** Whether the model natively supports FIM / autocomplete flows. */
	supportsFIM: boolean;

	/**
	 * Extra payload keys to include for OpenAI-compatible requests
	 * (ollama, vLLM, openrouter, etc.).
	 */
	additionalOpenAIPayload?: { [key: string]: string };

	// ---- reasoning options ----

	reasoningCapabilities:
		| false
		| {
				/** For clarity, must be true when this object is present. */
				readonly supportsReasoning: true;

				/** Whether the user can disable reasoning mode. */
				readonly canTurnOffReasoning: boolean;

				/**
				 * Whether the model produces user-visible reasoning output the
				 * IDE can surface (vs internal-only reasoning).
				 */
				readonly canIOReasoning: boolean;

				/**
				 * Optional override for reserved output space when reasoning
				 * mode is enabled.
				 */
				readonly reasoningReservedOutputTokenSpace?: number;

				/**
				 * Reasoning "control surface" exposed to the user:
				 *
				 * - budget_slider → token budget slider (Anthropic/Gemini-style).
				 * - effort_slider → qualitative effort slider (OpenAI-style).
				 */
				readonly reasoningSlider?:
					| undefined
					| { type: 'budget_slider'; min: number; max: number; default: number }
					| { type: 'effort_slider'; values: string[]; default: string };

				/**
				 * For open-source models that emit explicit think tags, specify
				 * the tag pair so the IDE can strip them from final output.
				 */
				readonly openSourceThinkTags?: [string, string];

				// Provider-specific I/O handling is carried separately via
				// ProviderReasoningIOSettings and not encoded here.
		  };

	// ---- informative fields (not configurable in settings UI) ----

	cost: {
		input: number;
		output: number;
		cache_read?: number;
		cache_write?: number;
	};

	downloadable:
		| false
		| {
				/**
				 * Approximate model size in GiB when downloadable / local.
				 * 'not-known' is allowed when exact size is unknown.
				 */
				sizeGb: number | 'not-known';
		  };
};

/**
 * Keys from VoidStaticModelInfo that may be overridden per model via the
 * user-facing "Model Overrides" UI.
 */
export const modelOverrideKeys = [
	'contextWindow',
	'reservedOutputTokenSpace',
	'supportsSystemMessage',
	'specialToolFormat',
	'supportsFIM',
	'reasoningCapabilities',
	'additionalOpenAIPayload',
] as const;

export type ModelOverrides = Pick<VoidStaticModelInfo, (typeof modelOverrideKeys)[number]>;

/**
 * Provider-level reasoning I/O wiring.
 *
 * This describes how to:
 *   - inject reasoning controls into outgoing payloads (input)
 *   - extract reasoning content from streaming deltas (output)
 *
 * It is interpreted in conjunction with per-model reasoningCapabilities.
 */
export type ProviderReasoningIOSettings = {
	/**
	 * Include reasoning-related flags in the outgoing request payload.
	 * Implementations return either null (no change) or a partial payload
	 * object to be merged into the request body.
	 */
	input?: {
		includeInPayload?: (reasoningState: SendableReasoningInfo) => null | { [key: string]: any };
	};

	/**
	 * How to read reasoning content from streaming responses:
	 *
	 * - nameOfFieldInDelta → path key in delta object.
	 * - needsManualParse   → tells the IDE to strip <think> tags manually.
	 */
	output?:
		| { nameOfFieldInDelta?: string; needsManualParse?: undefined }
		| { nameOfFieldInDelta?: undefined; needsManualParse?: true };
};

/**
 * Static, non-stateful provider metadata used by the capability system.
 *
 * This is intentionally minimal: it only encodes information that Void
 * cannot currently derive from the Crux catalog (e.g. provider-specific
 * reasoning I/O wiring) plus the local static model tables.
 */
export type VoidStaticProviderInfo = {
	/** Optional provider-level reasoning I/O hints. */
	providerReasoningIOSettings?: ProviderReasoningIOSettings;

	/** Static per-model capability tables for the provider. */
	modelOptions: { [key: string]: VoidStaticModelInfo };

	/**
	 * Provider-specific model name fallback logic.
	 *
	 * Used when the user selects or types a model name that is not in
	 * modelOptions but is recognizably close to a known one.
	 */
	modelOptionsFallback: (
		modelName: string,
		fallbackKnownValues?: Partial<VoidStaticModelInfo>,
	) =>
		| (VoidStaticModelInfo & {
				modelName: string;
				recognizedModelName: string;
		  })
		| null;
};

/**
 * Reasoning control surface as seen by provider adapters.
 *
 * This is the "sendable" view of reasoning configuration after combining:
 *   - model capabilities
 *   - per-feature overrides (e.g. Chat vs Autocomplete)
 *   - user-selected slider values
 */
export type SendableReasoningInfo =
	| {
			type: 'budget_slider_value';
			isReasoningEnabled: true;
			reasoningBudget: number;
	  }
	| {
			type: 'effort_slider_value';
			isReasoningEnabled: true;
			reasoningEffort: string;
	  }
	| null;

/**
 * Default per-model capability record used as a structural fallback when
 * the IDE has no better information (no static table entry and no Crux
 * overlay).
 *
 * These defaults are intentionally conservative and low-cost; real models
 * should always be described either in Crux's catalog or the static tables.
 */
export const defaultModelOptions = {
	contextWindow: 128_000,
	reservedOutputTokenSpace: 8_192,
	cost: { input: 0, output: 0 },
	downloadable: false,
	supportsSystemMessage: false,
	supportsFIM: false,
	reasoningCapabilities: false,
} as const satisfies VoidStaticModelInfo;