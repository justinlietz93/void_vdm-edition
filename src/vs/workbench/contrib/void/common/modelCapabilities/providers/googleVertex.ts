/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Neuroca, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { VoidStaticModelInfo, VoidStaticProviderInfo } from '../types.js';
import { openAICompatIncludeInPayloadReasoning } from '../shared.js';

/**
 * Google Vertex provider-static capability wiring (OpenAI-compatible facade).
 *
 * Canonical per-model capabilities for Vertex-backed models live in Crux's
 * catalog and are surfaced to the IDE via the Crux registry overlay.
 *
 * This module is intentionally minimal and MUST NOT become a second source
 * of truth for capabilities. It provides only:
 *
 *   - an (empty) static `modelOptions` table, kept for structural completeness;
 *   - a `modelOptionsFallback` that always defers to Crux/defaults;
 *   - provider-level reasoning I/O hints to mirror the OpenAI-compatible
 *     reasoning payload format already used elsewhere.
 */
const googleVertexModelOptions: { [s: string]: VoidStaticModelInfo } = {};

/**
 * Provider metadata for Google Vertex in the IDE.
 *
 * All real behavior (context window, tools, reasoning, etc.) must come from
 * Crux's registry and overlays. The IDE uses this struct purely as a thin
 * adapter so functions like `getModelCapabilities()` have a well-typed
 * provider entry, and so the build pipeline can generate a valid sourcemap
 * for `providers/googleVertex.js`.
 */
export const googleVertexSettings: VoidStaticProviderInfo = {
	modelOptions: googleVertexModelOptions,

	// Defer entirely to Crux for capabilities of Vertex models. Unknown
	// models are not given any local defaults here.
	modelOptionsFallback: (_modelName: string) => {
		return null;
	},

	// Reasoning payload format is the same OpenAI-compatible wiring already
	// used for other providers (openAI, xAI, etc.).
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
};