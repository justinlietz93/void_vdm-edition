/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Neuroca, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { VoidStaticProviderInfo, SendableReasoningInfo } from './types.js';

/**
 * Fallback for unknown models when Crux does not yet expose explicit
 * capabilities. This intentionally does **not** encode any provider- or
 * model-specific heuristics; it returns `null` so that callers fall back to
 * `defaultModelOptions` plus whatever Crux overlay is available.
 *
 * Canonical provider/model behavior must live in Crux (YAML + SQLite +
 * `void_profile.apply_void_enrichment()`), not in this TypeScript layer.
 */
export const extensiveModelOptionsFallback: VoidStaticProviderInfo['modelOptionsFallback'] =
	(_modelName, _fallbackKnownValues) => {
		return null;
	};

/**
 * Helper for encoding reasoning controls for OpenAI-compatible providers
 * (OpenAI, Deepseek, Mistral, vLLM, etc.).
 *
 * This mirrors the previous inline implementation in
 * [`modelCapabilities.ts`](./modelCapabilities.ts) and is shared by any
 * provider that uses an OpenAI-style `reasoning_effort` field.
 */
export const openAICompatIncludeInPayloadReasoning = (reasoningInfo: SendableReasoningInfo) => {
	if (!reasoningInfo?.isReasoningEnabled) {
		return null;
	}

	if (reasoningInfo.type === 'effort_slider_value') {
		return { reasoning_effort: reasoningInfo.reasoningEffort };
	}

	return null;
};