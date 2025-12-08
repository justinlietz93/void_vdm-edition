/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Neuroca, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { VoidStaticModelInfo, VoidStaticProviderInfo } from '../types.js';
import { openAICompatIncludeInPayloadReasoning } from '../shared.js';

/**
 * xAI (Grok) provider-static capability wiring.
 *
 * Canonical per-model capabilities for xAI live in Crux's catalog
 * (`crux/crux_providers/catalog/providers/xai.yaml`) and are surfaced
 * to the IDE via the Crux overlay. This module only provides:
 *
 *   - an (empty) static modelOptions table, kept for structural completeness
 *   - provider-level reasoning I/O hints
 *   - a trivial modelOptionsFallback that always defers to defaults/Crux
 */
const xAIModelOptions: { [s: string]: VoidStaticModelInfo } = {};

export const xAISettings: VoidStaticProviderInfo = {
	modelOptions: xAIModelOptions,
	// Defer to Crux for all known xAI models. For unknown model ids,
	// do not attempt client-side heuristics; treat them as generic
	// unrecognized models.
	modelOptionsFallback: (_modelName) => {
		return null;
	},
	// Same reasoning payload format as OpenAI-compatible providers.
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
};