/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Neuroca, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { VoidStaticModelInfo, VoidStaticProviderInfo } from '../types.js';
import { openAICompatIncludeInPayloadReasoning } from '../shared.js';

/**
 * DeepSeek provider-static capability wiring.
 *
 * Canonical per-model capabilities for DeepSeek live in Crux's catalog
 * (`crux/crux_providers/catalog/providers/deepseek.yaml`) and are surfaced
 * to the IDE via the Crux overlay. This module only provides:
 *
 *   - an (empty) static modelOptions table, kept for structural completeness
 *   - provider-level reasoning I/O hints
 *   - a trivial modelOptionsFallback that always defers to defaults/Crux
 */
const deepseekModelOptions: { [s: string]: VoidStaticModelInfo } = {};

export const deepseekSettings: VoidStaticProviderInfo = {
	modelOptions: deepseekModelOptions,
	modelOptionsFallback: (_modelName) => {
		return null;
	},
	providerReasoningIOSettings: {
		// reasoning: OAICompat + response.choices[0].delta.reasoning_content
		// https://api-docs.deepseek.com/guides/reasoning_model
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { nameOfFieldInDelta: 'reasoning_content' },
	},
};