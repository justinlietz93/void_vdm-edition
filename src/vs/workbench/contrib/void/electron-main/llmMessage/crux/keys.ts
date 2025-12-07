// Key-management HTTP helpers for Crux `/api/keys`.

import { getCruxBaseUrl } from './cruxBase.js';

/**
 * Persist provider API keys in Crux.
 *
 * Accepts an env-var-style mapping (e.g., { OPENAI_API_KEY: "sk-..." }) and
 * delegates to Crux `/api/keys`. Crux handles canonical/alias normalization.
 */
export async function cruxPostKeys(keys: Record<string, string>): Promise<void> {
	const baseUrl = getCruxBaseUrl();
	const url = `${baseUrl}/api/keys`;

	let response: any;
	try {
		response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ keys }),
		});
	} catch (err) {
		throw new Error(`[CruxBridge] Failed to POST /api/keys to Crux at "${url}": ${err}`);
	}

	let data: any;
	try {
		data = await response.json();
	} catch (err) {
		throw new Error(
			`[CruxBridge] Failed to parse JSON from /api/keys (${response.status} ${response.statusText}): ${err}`,
		);
	}

	if (!response.ok || !data || typeof data !== 'object' || (data as any).ok !== true) {
		const message =
			data && typeof data === 'object' && 'error' in data
				? (data as any).error
				: JSON.stringify(data);
		throw new Error(
			`[CruxBridge] Crux /api/keys returned ${response.status} ${response.statusText}: ${message}`,
		);
	}
}

/**
 * Delete a stored provider key in Crux.
 *
 * This calls Crux `/api/keys` (DELETE) with a `provider` query parameter. The
 * `provider` identifier must match the canonical provider key used by Crux
 * (for example, "openai", "anthropic").
 */
export async function cruxDeleteProviderKey(provider: string): Promise<void> {
	const baseUrl = getCruxBaseUrl();
	const url = `${baseUrl}/api/keys?provider=${encodeURIComponent(provider)}`;

	let response: any;
	try {
		response = await fetch(url, {
			method: 'DELETE',
		});
	} catch (err) {
		throw new Error(
			`[CruxBridge] Failed to DELETE /api/keys for provider "${provider}" at "${url}": ${err}`,
		);
	}

	let data: any;
	try {
		data = await response.json();
	} catch (err) {
		throw new Error(
			`[CruxBridge] Failed to parse JSON from DELETE /api/keys (${response.status} ${response.statusText}): ${err}`,
		);
	}

	if (!response.ok || !data || typeof data !== 'object' || (data as any).ok !== true) {
		const message =
			data && typeof data === 'object' && 'error' in data
				? (data as any).error
				: JSON.stringify(data);
		throw new Error(
			`[CruxBridge] Crux DELETE /api/keys returned ${response.status} ${response.statusText}: ${message}`,
		);
	}
}