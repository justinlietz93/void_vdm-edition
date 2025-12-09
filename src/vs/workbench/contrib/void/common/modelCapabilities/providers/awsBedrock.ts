/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Neuroca, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { VoidStaticModelInfo, VoidStaticProviderInfo } from '../types.js';

/**
 * AWS Bedrock aggregator provider-static capability wiring.
 *
 * Canonical per-model capabilities for Bedrock-backed models live in Crux's
 * catalog (for example under `crux/crux_providers/catalog/providers`) and are
 * surfaced to the IDE via the Crux registry overlay.
 *
 * This module is intentionally minimal and MUST NOT become a second source
 * of truth for capabilities. It provides only:
 *
 *   - an (empty) static `modelOptions` table, kept for structural completeness;
 *   - a `modelOptionsFallback` that always defers to Crux/defaults;
 *   - no provider-specific reasoning I/O hints (these are determined by the
 *     underlying providers inside Crux, not the IDE).
 */
const awsBedrockModelOptions: { [s: string]: VoidStaticModelInfo } = {};

/**
 * Provider metadata for AWS Bedrock in the IDE.
 *
 * All real behavior (context window, tools, reasoning, etc.) must come from
 * Crux's registry and overlays. The IDE uses this struct purely as a thin
 * adapter so functions like `getModelCapabilities()` have a well-typed
 * provider entry, and so the build pipeline can generate a valid sourcemap
 * for `providers/awsBedrock.js`.
 */
export const awsBedrockSettings: VoidStaticProviderInfo = {
	modelOptions: awsBedrockModelOptions,

	// For Bedrock we rely entirely on the Crux overlay; unknown models are
	// not given any local defaults here.
	modelOptionsFallback: (_modelName: string) => {
		return null;
	},

	// Reasoning/tool encoding for Bedrock-routed models is determined by the
	// underlying upstream providers inside Crux (e.g., Anthropic via Bedrock),
	// not by the IDE. Leave this undefined so higher-level helpers treat
	// Bedrock as having no special client-side reasoning I/O rules.
	providerReasoningIOSettings: undefined,
};
