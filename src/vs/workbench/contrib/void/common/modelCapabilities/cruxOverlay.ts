// Crux-backed model capability overlay.
//
// This module stores a per-provider, per-model overlay of capability
// information derived from Crux `/api/models`. The overlay is applied
// on top of local static tables and defaultModelOptions so that Crux
// remains the source of truth for model behavior during the migration
// away from static TS tables.

import type { ProviderName } from '../voidSettingsTypes.js';
import type { VoidStaticModelInfo } from './types.js';

/**
 * In-memory overlay of model capabilities derived from Crux `/api/models`.
 *
 * Keys:
 *   - providerName: IDE-side provider identifier (e.g. "openAI", "anthropic").
 *   - modelName: Crux model `id` as seen by the IDE (usually the same as the
 *     user-entered model string or the canonical static model id).
 *
 * Values:
 *   - Partial `VoidStaticModelInfo` fragments (e.g., contextWindow,
 *     supportsSystemMessage, specialToolFormat, supportsFIM) that should
 *     override the static tables when present.
 */
export type CruxOverlayMap = {
	[provider in ProviderName]?: Record<string, Partial<VoidStaticModelInfo>>;
};

/**
 * Global overlay cache shared within the renderer/main process. This is
 * updated by main-process code after fetching `/api/models` snapshots from
 * the embedded Crux service.
 */
const cruxModelCapabilitiesOverlay: CruxOverlayMap = Object.create(null);

/**
 * Replace the Crux-derived capability overlay for a single provider.
 *
 * This is intended to be called by main-process code after fetching a fresh
 * snapshot from Crux `/api/models` for the corresponding provider.
 */
export function setCruxModelCapabilitiesOverlayForProvider(
	providerName: ProviderName,
	overlays: Record<string, Partial<VoidStaticModelInfo>>,
): void {
	cruxModelCapabilitiesOverlay[providerName] = overlays;
}

/**
 * Look up a Crux-derived overlay for a resolved model name.
 *
 * Callers should pass the *resolved* model name when available
 * (i.e. the recognized/canonical model id), falling back to the
 * user-specified `modelName` when necessary.
 */
export function getCruxOverlayForModel(
	providerName: ProviderName,
	resolvedModelName: string,
): Partial<VoidStaticModelInfo> | undefined {
	const providerOverlays = cruxModelCapabilitiesOverlay[providerName];
	if (!providerOverlays) {
		return undefined;
	}
	return (
		providerOverlays[resolvedModelName] ??
		providerOverlays[resolvedModelName.toString()]
	);
}