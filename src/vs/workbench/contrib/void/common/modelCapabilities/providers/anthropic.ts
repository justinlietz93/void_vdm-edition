/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Neuroca, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type {
	VoidStaticModelInfo,
	VoidStaticProviderInfo,
	SendableReasoningInfo,
} from '../types.js';
import { extensiveModelOptionsFallback } from '../shared.js';

/**
 * Anthropic provider-static capability wiring.
 *
 * Canonical per-model capabilities for Anthropic live in Crux's catalog
 * (`crux/crux_providers/catalog/providers/anthropic.yaml`) and are surfaced
 * to the IDE via the Crux overlay. This module only provides:
 *
 *   - an (empty) static modelOptions table, kept for structural completeness
 *   - provider-level reasoning I/O hints
 *   - a generic modelOptionsFallback that defers to Crux/defaults
 */
const anthropicModelOptions: { [s: string]: VoidStaticModelInfo } = {};

export const anthropicSettings: VoidStaticProviderInfo = {
	providerReasoningIOSettings: {
		input: {
			includeInPayload: (reasoningInfo: SendableReasoningInfo) => {
				if (!reasoningInfo?.isReasoningEnabled) {
					return null;
				}

				if (reasoningInfo.type === 'budget_slider_value') {
					return {
						thinking: {
							type: 'enabled',
							budget_tokens: reasoningInfo.reasoningBudget,
						},
					};
				}

				return null;
			},
		},
	},
	modelOptions: anthropicModelOptions,
	modelOptionsFallback: extensiveModelOptionsFallback,
};