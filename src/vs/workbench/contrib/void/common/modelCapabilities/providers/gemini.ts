/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Neuroca, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { VoidStaticModelInfo, VoidStaticProviderInfo } from '../types.js';

/**
 * Gemini provider-static capability wiring.
 *
 * Canonical per-model capabilities for Gemini live in Crux's catalog
 * (`crux/crux_providers/catalog/providers/gemini.yaml`) and are surfaced
 * to the IDE via the Crux overlay. This module only provides:
 *
 *   - an (empty) static modelOptions table, kept for structural completeness
 *   - a trivial modelOptionsFallback that always defers to defaults/Crux
 *
 * Gemini-specific truncation and reasoning behavior is handled in the
 * provider adapters (e.g. ThinkingConfig) at send time.
 */
const geminiModelOptions: { [s: string]: VoidStaticModelInfo } = {};

export const geminiSettings: VoidStaticProviderInfo = {
	modelOptions: geminiModelOptions,
	// No provider-specific fallback here: Crux `/api/models` supplies real
	// capabilities for Gemini models. In the absence of Crux data, generic
	// defaults (`defaultModelOptions`) will be used.
	modelOptionsFallback: (_modelName) => {
		return null;
	},
};