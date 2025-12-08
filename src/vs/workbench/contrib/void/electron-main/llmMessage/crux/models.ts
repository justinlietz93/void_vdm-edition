// Model and provider registry HTTP helpers (`/api/models`, `/api/providers`).

import { getCruxBaseUrl } from './cruxBase.js';
import { CruxModelDescriptor, CruxProviderDescriptor } from './types.js';

/**
 * Fetch a registry snapshot for a single provider from Crux `/api/models`.
 *
 * This function is intentionally conservative in what it assumes about the
 * snapshot; it only normalizes a handful of stable fields and leaves the
 * rest on `metadata` for future UI/behavior work.
 */
export async function cruxGetModelsForProvider(
	provider: string,
	refresh: boolean = false,
): Promise<CruxModelDescriptor[]> {
	const baseUrl = getCruxBaseUrl();
	const url = `${baseUrl}/api/models?provider=${encodeURIComponent(provider)}&refresh=${
		refresh ? 'true' : 'false'
	}`;

	// Diagnostic logging so we can see exactly which URL the IDE is using for
	// `/api/models` calls at runtime (e.g. to distinguish 8091 vs 8092 and
	// confirm that CruxSupervisor / env overrides are taking effect).
	// This will print into the Electron main-process console.
	console.log('[CruxBridge] cruxGetModelsForProvider', { provider, refresh, url });

	let response: any;
	try {
		response = await fetch(url, { method: 'GET' });
	} catch (err) {
		throw new Error(`[CruxBridge] Failed to fetch /api/models from Crux at "${url}": ${err}`);
	}

	// Be defensive about response content type. In some failure modes the
	// FastAPI/Uvicorn stack may return a plain "Internal Server Error" text
	// payload instead of JSON, which would cause response.json() to throw and
	// surface as a confusing SyntaxError in the IDE. We explicitly detect
	// non-JSON responses and surface a clearer error message.
	const contentType =
		response.headers && typeof response.headers.get === 'function'
			? response.headers.get('content-type')
			: null;
	const isJson = typeof contentType === 'string' && contentType.toLowerCase().includes('application/json');

	let data: any;
	if (isJson) {
		try {
			data = await response.json();
		} catch (err) {
			throw new Error(
				`[CruxBridge] Failed to parse JSON from /api/models (${response.status} ${response.statusText}): ${err}`,
			);
		}
	} else {
		let rawText = '';
		try {
			rawText = await response.text();
		} catch (err) {
			rawText = `<failed to read body: ${err}>`;
		}
		throw new Error(
			`[CruxBridge] Crux /api/models returned non-JSON ${response.status} ${response.statusText} with content-type "${
				contentType || 'unknown'
			}": ${rawText.slice(0, 512)}`,
		);
	}

	if (!response.ok || !data || typeof data !== 'object') {
		const message =
			data && typeof data === 'object' && 'error' in data
				? (data as any).error
				: JSON.stringify(data);
		throw new Error(
			`[CruxBridge] Crux /api/models returned ${response.status} ${response.statusText}: ${message}`,
		);
	}

	if ((data as any).ok !== true || !(data as any).snapshot) {
		const message =
			data && typeof data === 'object' && 'error' in data
				? (data as any).error
				: 'Missing or invalid snapshot.';
		throw new Error(
			`[CruxBridge] /api/models response did not contain a valid snapshot: ${message}`,
		);
	}

	const snapshot = (data as any).snapshot;
	const snapshotProvider: string =
		(typeof snapshot.provider === 'string' && snapshot.provider) || provider;

	const models = Array.isArray(snapshot.models) ? (snapshot.models as any[]) : [];

	return models.map((m: any): CruxModelDescriptor => {
		const id = String(m.id ?? m.model ?? m.name ?? '');
		const family = typeof m.family === 'string' ? m.family : undefined;

		const contextWindow =
			typeof m.context_length === 'number'
				? m.context_length
				: typeof m.context_window === 'number'
					? m.context_window
					: undefined;

		const caps =
			m && typeof m.capabilities === 'object'
				? (m.capabilities as Record<string, unknown>)
				: undefined;

		const supportsTools =
			caps &&
			(caps['tools'] === true ||
				caps['tool_use'] === true ||
				caps['tool_calls'] === true ||
				caps['functions'] === true)
				? true
				: undefined;

		const supportsStreaming =
			caps && (caps['streaming'] === true || caps['stream'] === true)
				? true
				: undefined;

		const supportsSystemMessage =
			caps && typeof caps['system_message'] === 'string'
				? (caps['system_message'] as string as any)
				: undefined;

		const pricing =
			m && typeof m.pricing === 'object'
				? (m.pricing as Record<string, unknown>)
				: undefined;

		const tags =
			Array.isArray(m?.tags)
				? (m.tags as any[]).map((t) => String(t))
				: undefined;

		const metadata: Record<string, unknown> = {};
		if (m && typeof m === 'object') {
			metadata.raw = m;
		}
		if (snapshot && typeof snapshot.metadata === 'object') {
			metadata.snapshot = snapshot.metadata;
		}

		return {
			id,
			provider: snapshotProvider,
			family,
			context_window: contextWindow,
			supports_tools: supportsTools,
			supports_system_message: supportsSystemMessage,
			supports_streaming: supportsStreaming,
			pricing,
			tags,
			metadata,
		};
	});
}

/**
 * Fetch the list of known providers from Crux `/api/providers`.
 *
 * The response is a thin projection over the model registry; the IDE
 * should tolerate additional fields on each provider descriptor.
 */
export async function cruxGetProviders(): Promise<CruxProviderDescriptor[]> {
	const baseUrl = getCruxBaseUrl();
	const url = `${baseUrl}/api/providers`;

	let response: any;
	try {
		response = await fetch(url, { method: 'GET' });
	} catch (err) {
		throw new Error(`[CruxBridge] Failed to fetch /api/providers from Crux at "${url}": ${err}`);
	}

	const contentType =
		response.headers && typeof response.headers.get === 'function'
			? response.headers.get('content-type')
			: null;
	const isJson = typeof contentType === 'string' && contentType.toLowerCase().includes('application/json');

	let data: any;
	if (isJson) {
		try {
			data = await response.json();
		} catch (err) {
			throw new Error(
				`[CruxBridge] Failed to parse JSON from /api/providers (${response.status} ${response.statusText}): ${err}`,
			);
		}
	} else {
		let rawText = '';
		try {
			rawText = await response.text();
		} catch (err) {
			rawText = `<failed to read body: ${err}>`;
		}
		throw new Error(
			`[CruxBridge] Crux /api/providers returned non-JSON ${response.status} ${response.statusText} with content-type "${
				contentType || 'unknown'
			}": ${rawText.slice(0, 512)}`,
		);
	}

	if (!response.ok || !data || typeof data !== 'object') {
		const message =
			data && typeof data === 'object' && 'error' in data
				? (data as any).error
				: JSON.stringify(data);
		throw new Error(
			`[CruxBridge] Crux /api/providers returned ${response.status} ${response.statusText}: ${message}`,
		);
	}

	if ((data as any).ok !== true || !Array.isArray((data as any).providers)) {
		const message =
			data && typeof data === 'object' && 'error' in data
				? (data as any).error
				: 'Missing or invalid providers array.';
		throw new Error(
			`[CruxBridge] /api/providers response did not contain a valid providers array: ${message}`,
		);
	}

	const providers = (data as any).providers as any[];

	return providers.map((p: any): CruxProviderDescriptor => {
		const id =
			(typeof p.id === 'string' && p.id) ||
			(typeof p.provider === 'string' && p.provider) ||
			'';

		const displayName =
			(typeof p.display_name === 'string' && p.display_name) || id;

		const aliases = Array.isArray(p.aliases)
			? (p.aliases as any[]).map((a) => String(a))
			: [];

		let modelCount = 0;
		if (typeof p.model_count === 'number') {
			modelCount = p.model_count;
		} else if (p.model_count != null) {
			const n = Number(p.model_count);
			if (!Number.isNaN(n) && n >= 0) {
				modelCount = n;
			}
		}

		const enabled =
			typeof p.enabled === 'boolean'
				? p.enabled
				: true;

		const metadata =
			p && typeof p.metadata === 'object'
				? (p.metadata as Record<string, unknown>)
				: undefined;

		return {
			id,
			display_name: displayName,
			aliases,
			model_count: modelCount,
			enabled,
			metadata,
		};
	});
}