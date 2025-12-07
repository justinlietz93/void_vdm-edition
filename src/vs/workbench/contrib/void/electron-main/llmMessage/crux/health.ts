// Health-check helper for Crux `/api/health`.

import { getCruxBaseUrl } from './cruxBase.js';
import { CruxHealthResponse } from './types.js';

/**
 * Crux-backed health check helper.
 *
 * This calls Crux `/api/health` and returns a normalized health response. The
 * FastAPI implementation currently returns a very small payload:
 *
 *   { "ok": true }
 *
 * We map that into the richer `CruxHealthResponse` shape used by the IDE.
 */
export async function cruxGetHealth(): Promise<CruxHealthResponse> {
	const baseUrl = getCruxBaseUrl();
	const url = `${baseUrl}/api/health`;

	let response: any;
	try {
		response = await fetch(url, { method: 'GET' });
	} catch (err) {
		throw new Error(`[CruxBridge] Failed to fetch /api/health from Crux at "${url}": ${err}`);
	}

	let data: any;
	try {
		data = await response.json();
	} catch (err) {
		throw new Error(
			`[CruxBridge] Failed to parse JSON from /api/health (${response.status} ${response.statusText}): ${err}`,
		);
	}

	if (!response.ok) {
		const message =
			data && typeof data === 'object' && 'error' in data
				? (data as any).error
				: JSON.stringify(data);
		throw new Error(
			`[CruxBridge] Crux /api/health returned ${response.status} ${response.statusText}: ${message}`,
		);
	}

	// Current FastAPI implementation: { ok: true } on success.
	if (data && typeof data === 'object' && (data as any).ok === true) {
		return { status: 'ok' };
	}

	// If the shape is different but the request succeeded, conservatively
	// classify as degraded and attach the raw payload as component detail.
	return {
		status: 'degraded',
		components: {
			crux: {
				status: 'degraded',
				detail: JSON.stringify(data),
			},
		},
	};
}