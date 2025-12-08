/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Neuroca, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { VoidStaticModelInfo, VoidStaticProviderInfo } from '../types.js';
import { extensiveModelOptionsFallback, openAICompatIncludeInPayloadReasoning } from '../shared.js';

/**
 * OpenAI provider-static capability wiring.
 *
 * Canonical per-model capabilities for OpenAI live in Crux's catalog
 * (`crux/crux_providers/catalog/providers/openai.yaml`) and are surfaced
 * to the IDE via the Crux overlay. This module only provides:
 *
 *   - an (empty) static modelOptions table, kept for structural completeness
 *   - provider-level reasoning I/O hints
 *   - a generic modelOptionsFallback that defers to Crux/defaults
 */
const openAIModelOptions: { [s: string]: VoidStaticModelInfo } = {};

/**
 * Provider metadata for OpenAI, including reasoning I/O wiring.
 *
 * This is functionally equivalent to the previous `openAISettings` block
 * that lived in [`modelCapabilities.ts`](../modelCapabilities.ts), but
 * refactored into a provider-specific module so `modelCapabilities.ts`
 * can stay under the 500-line AMOS limit.
 */
export const openAISettings: VoidStaticProviderInfo = {
	modelOptions: openAIModelOptions,
	// Use the shared heuristic fallback so that OpenAI model capabilities are
	// primarily driven by Crux's catalog (via overlay) plus the generic
	// `extensiveModelOptionsFallback` logic.
	modelOptionsFallback: (modelName) => extensiveModelOptionsFallback(modelName),
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
};