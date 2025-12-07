// Crux key synchronization helpers shared between sendLLMMessage and the key-sync IPC channel.

import { ProviderName, SettingsOfProvider } from '../../common/voidSettingsTypes.js';
import { cruxPostKeys, cruxDeleteProviderKey } from './cruxBridge.js';

// Map Void providerName to Crux env var for API key persistence.
// Shared between sendLLMMessage and the key-sync IPC channel.
export const cruxEnvVarOfProvider: Partial<Record<ProviderName, string>> = {
	openAI: 'OPENAI_API_KEY',
	openAICompatible: 'OPENAI_API_KEY',
	openRouter: 'OPENROUTER_API_KEY',
	anthropic: 'ANTHROPIC_API_KEY',
	deepseek: 'DEEPSEEK_API_KEY',
	gemini: 'GEMINI_API_KEY',
	xAI: 'XAI_API_KEY',
};

// Simple in-memory cache to avoid re-sending unchanged keys to Crux.
const cruxKeyCache: Record<string, string | undefined> = {};

/**
 * Ensure Crux has a valid key for the given provider by reading from the
 * full SettingsOfProvider map. This mirrors the historical logic inside
 * sendLLMMessage.impl.ts but is now factored into a shared helper.
 */
export async function ensureCruxHasKeyFromSettings(
	providerName: ProviderName,
	settingsOfProvider: SettingsOfProvider,
): Promise<void> {
	const providerSettings = (settingsOfProvider as any)[providerName] as { apiKey?: string } | undefined;
	const uiKey = providerSettings?.apiKey;

	// Only the UI-provided key participates in the sync pipeline. Environment
	// variables and .env-based seeding are handled exclusively inside Crux
	// so that the IDE does not need to inspect process.env (ADR-003).
	const candidate: string | undefined = uiKey;

	await syncCruxKey(providerName, candidate);
}

/**
 * Normalize and push a single provider API key into Crux via /api/keys.
 *
 * This function is intentionally defensive:
 *  - If the provider is not mapped to an env var, it is a no-op.
 *  - Empty, whitespace-only, non-ASCII, or masked ("*****") values are ignored.
 *  - Identical repeat values are cached and not re-sent.
 */
export async function syncCruxKey(
	providerName: ProviderName,
	apiKey: string | undefined,
): Promise<void> {
	const envName = cruxEnvVarOfProvider[providerName];
	if (!envName) {
		return;
	}

	if (!apiKey) {
		return;
	}

	const trimmed = apiKey.trim();
	if (!trimmed) {
		return;
	}

	// Never push masked or non-ASCII values (prevents clobbering Crux with "*****").
	if (!/^[\x00-\x7F]+$/.test(trimmed)) {
		return;
	}
	if (/^\*+$/.test(trimmed)) {
		return;
	}

	if (cruxKeyCache[envName] === trimmed) {
		return;
	}

	// Visible in main-process logs so we can confirm keys are actually being pushed.
	console.log('[Void][CruxKeySync] Posting key to Crux', { providerName, envName });

	await cruxPostKeys({ [envName]: trimmed });
	cruxKeyCache[envName] = trimmed;
}

/**
 * Explicitly delete a provider's key from Crux via `/api/keys` DELETE.
 *
 * This helper maps the IDE provider name to Crux's canonical provider identifier
 * (lowercase) before calling the HTTP bridge.
 */
export async function deleteCruxKey(providerName: ProviderName): Promise<void> {
	// Canonical provider identifiers are lowercase in Crux. Normalize a few
	// well-known aliases that differ between IDE naming and Crux.
	let providerId = providerName.toLowerCase();
	if (providerName === 'openAICompatible') {
		providerId = 'openai';
	} else if (providerName === 'openAI') {
		providerId = 'openai';
	} else if (providerName === 'openRouter') {
		providerId = 'openrouter';
	} else if (providerName === 'xAI') {
		providerId = 'xai';
	}

	try {
		await cruxDeleteProviderKey(providerId);
	} catch (err) {
		console.error('[Void][CruxKeySync] Failed to delete key in Crux', { providerName, providerId, err });
	}
}
