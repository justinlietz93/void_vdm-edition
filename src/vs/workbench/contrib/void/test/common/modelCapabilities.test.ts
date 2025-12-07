/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Neuroca, Inc. All rights reserved.
 *  Void Genesis IDE - Crux-backed model capabilities tests
 * --------------------------------------------------------------------------------------------
 *  Author: Justin K. Lietz
 *  Date: December 7, 2025
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';

import {
	getModelCapabilities,
	setCruxModelCapabilitiesOverlayForProvider,
} from '../../common/modelCapabilities.js';
import type { ProviderName } from '../../common/voidSettingsTypes.js';

/**
 * NOTE:
 * These tests are focused on the *interaction* between the static
 * `modelCapabilities` tables and the Crux-backed overlay exposed via
 * `setCruxModelCapabilitiesOverlayForProvider`. They do not hit the network
 * or call Crux directly; instead they simulate `/api/models` results by
 * injecting overlays and asserting how `getModelCapabilities` resolves the
 * final capability record.
 */

suite('Void - modelCapabilities Crux overlay', () => {

	function clearOverlay(provider: ProviderName) {
		// Setting an empty object effectively clears the provider overlay.
		setCruxModelCapabilitiesOverlayForProvider(provider, Object.create(null));
	}

	test('Crux overlay overrides static table fields for a known model', () => {
		// Arrange: start from a clean slate for xAI.
		clearOverlay('xAI');

		// Static table for xAI/grok-2 defines:
		// - contextWindow: 131_072
		// - supportsSystemMessage: "system-role"
		// - specialToolFormat: "openai-style"
		//
		// Simulate Crux advertising updated capabilities for grok-2.
		setCruxModelCapabilitiesOverlayForProvider('xAI', {
			'grok-2': {
				contextWindow: 999_999,
				supportsSystemMessage: 'developer-role',
			},
		});

		// Act
		const caps = getModelCapabilities('xAI', 'grok-2', /*overridesOfModel*/ undefined);

		// Assert: we still recognize the model by its canonical id.
		assert.strictEqual(caps.recognizedModelName, 'grok-2');
		assert.strictEqual(caps.isUnrecognizedModel, false);

		// Crux overlay must override the static context window and system-message semantics.
		assert.strictEqual(caps.contextWindow, 999_999);
		assert.strictEqual(caps.supportsSystemMessage, 'developer-role');

		// Fields not present in the overlay (e.g. specialToolFormat) should
		// remain as defined in the static table.
		assert.strictEqual(caps.specialToolFormat, 'openai-style');
	});

	test('Crux overlay alone marks a model as recognized for providers without static tables', () => {
		// Arrange: awsBedrock has no static `modelOptions` and no provider-specific fallback.
		clearOverlay('awsBedrock');

		setCruxModelCapabilitiesOverlayForProvider('awsBedrock', {
			'anthropic.claude-4': {
				contextWindow: 200_000,
				supportsSystemMessage: 'system-role',
				specialToolFormat: 'openai-style',
			},
		});

		// Act
		const caps = getModelCapabilities('awsBedrock', 'anthropic.claude-4', /*overridesOfModel*/ undefined);

		// Assert: even though there is no static table entry, the presence of a
		// Crux overlay means the model is treated as recognized.
		assert.strictEqual(caps.modelName, 'anthropic.claude-4');
		assert.strictEqual(caps.recognizedModelName, 'anthropic.claude-4');
		assert.strictEqual(caps.isUnrecognizedModel, false);

		assert.strictEqual(caps.contextWindow, 200_000);
		assert.strictEqual(caps.supportsSystemMessage, 'system-role');
		assert.strictEqual(caps.specialToolFormat, 'openai-style');
	});

	test('Unknown model without Crux overlay falls back to default options and is marked unrecognized', () => {
		// Arrange
		clearOverlay('awsBedrock');

		// Act
		const caps = getModelCapabilities('awsBedrock', 'completely-unknown-model', /*overridesOfModel*/ undefined);

		// Assert: with no static entry and no overlay, capabilities come from
		// `defaultModelOptions` and the model is explicitly marked unrecognized.
		assert.strictEqual(caps.modelName, 'completely-unknown-model');
		assert.strictEqual(caps.isUnrecognizedModel, true);
		// `recognizedModelName` should be absent/undefined in this case.
		assert.strictEqual((caps as any).recognizedModelName, undefined);
	});

	test('User overrides win over both Crux overlay and static tables', () => {
		// Arrange
		clearOverlay('xAI');

		setCruxModelCapabilitiesOverlayForProvider('xAI', {
			'grok-2': {
				contextWindow: 999_999,
			},
		});

		// Shape of OverridesOfModel is not critical for runtime; we construct
		// the minimal object expected by `getModelCapabilities`:
		const overrides: any = {
			xAI: {
				'grok-2': {
					contextWindow: 123_456,
				},
			},
		};

		// Act
		const caps = getModelCapabilities('xAI', 'grok-2', overrides);

		// Assert: override value must win over both the static entry and the overlay.
		assert.strictEqual(caps.contextWindow, 123_456);
	});
});