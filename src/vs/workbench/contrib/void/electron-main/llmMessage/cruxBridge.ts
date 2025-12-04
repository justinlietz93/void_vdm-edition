/**
 * Crux HTTP bridge.
 *
 * Main-process integration point for the embedded Crux service. All provider chat/list
 * calls should flow through this module.
 */

import { getCruxConfig } from './cruxConfig.js';

/**
 * High-level feature classification for chat requests sent from the IDE into Crux.
 * These strings should match the values described in `CRUX_IDE_INTEGRATION_SPEC.md`.
 */
export type CruxChatFeature = 'Chat' | 'Agent-Code' | 'Agent-Lab' | 'System';

export interface CruxChatMetadata {
	workspaceId?: string;
	agentId?: string;
	feature?: CruxChatFeature;
	runId?: string;
	experimentId?: string;
}

/**
 * Provider-agnostic chat request payload shape aligned with the Crux `/api/chat`
 * endpoint. This mirrors the FastAPI `ChatBody` model: provider, model, messages,
 * and optional generation / formatting parameters. IDE-specific metadata should
 * be attached under `extra` so Crux can persist or forward it as needed.
 */
export interface CruxChatRequest {
	provider: string;
	model: string;
	messages: { role: string; content: unknown }[];
	max_tokens?: number;
	temperature?: number;
	response_format?: string;
	json_schema?: Record<string, unknown>;
	tools?: Record<string, unknown>[];
	extra?: Record<string, unknown>;
}

/**
 * Minimal streaming event taxonomy. The exact structure of the `payload` field
 * will be refined when wiring Crux responses into the existing Void streaming
 * pipeline (see Phase 1 of the migration plan).
 */
export type CruxChatStreamEventType = 'delta' | 'final' | 'error';

export interface CruxChatStreamChunk {
	type: CruxChatStreamEventType;
	payload: unknown;
}

/**
 * Normalized model descriptor as returned by Crux `/api/models` (current FastAPI service).
 * This is intentionally generic; specific fields can be promoted into
 * richer TypeScript types as UI and behavior begin to rely on them.
 * The higher-level IDE integration spec still refers to a future `/v1/models` façade.
 */
export interface CruxModelDescriptor {
	id: string;
	provider: string;
	family?: string;
	context_window?: number;
	supports_tools?: boolean;
	supports_system_message?: boolean;
	supports_streaming?: boolean;
	pricing?: Record<string, unknown>;
	tags?: string[];
	metadata?: Record<string, unknown>;
}

/**
 * Health status and component-level diagnostics for Crux `/api/health`
 * as implemented by the current FastAPI service (future façade name `/v1/health` in the spec).
 */
export type CruxHealthStatus = 'ok' | 'degraded' | 'down';

export interface CruxHealthResponse {
	status: CruxHealthStatus;
	components?: Record<string, { status: CruxHealthStatus; detail?: string }>;
}

/**
 * Resolve the Crux HTTP base URL from the shared main-process Crux config.
 *
 * Historically this function read from process.env, but Crux is now treated as
 * an embedded service with a single URL owned by CruxSupervisor. The config
 * module is the only source of truth.
 *
 * The returned string is normalized to have no trailing slash.
 */
export function getCruxBaseUrl(): string {
	const { baseUrl } = getCruxConfig();
	return baseUrl.replace(/\/+$/, '');
}

/**
 * Crux chat bridge.
 *
 * This function POSTs a provider-agnostic chat request to Crux `/api/chat`
 * and returns the parsed JSON payload. It is intentionally conservative in
 * its assumptions:
 *
 *   - Relies on Crux's global exception handler to always return JSON (even
 *     on HTTP 500) so that IDE-side JSON parsing is stable.
 *   - Requires `{ ok: true, response: {...} }` in the body; any other shape
 *     is treated as an error.
 *
 * Callers (for example, the OpenAI provider implementation) are expected to
 * interpret the returned `response` object according to the Crux
 * `ChatResponse.to_dict()` schema.
 */
export async function cruxPostChat(request: CruxChatRequest): Promise<any> {
	const baseUrl = getCruxBaseUrl();
	const url = `${baseUrl}/api/chat`;

	let response: any;
	try {
		response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(request),
		});
	} catch (err) {
		throw new Error(`[CruxBridge] Failed to POST /api/chat to Crux at "${url}": ${err}`);
	}

	// Crux's global exception handler guarantees JSON responses even on error,
	// but we still protect against unexpected shapes or parse failures.
	let data: any;
	try {
		data = await response.json();
	} catch (err) {
		throw new Error(
			`[CruxBridge] Failed to parse JSON from /api/chat (${response.status} ${response.statusText}): ${err}`
		);
	}

	if (!response.ok) {
		const message =
			data && typeof data === 'object' && 'detail' in data
				? (data as any).detail
				: JSON.stringify(data);
		throw new Error(
			`[CruxBridge] Crux /api/chat returned ${response.status} ${response.statusText}: ${message}`
		);
	}

	if (!data || typeof data !== 'object' || (data as any).ok !== true || !(data as any).response) {
		throw new Error(
			`[CruxBridge] /api/chat response missing "ok: true" or "response" field: ${JSON.stringify(data)}`
		);
	}

	return data;
}

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
			`[CruxBridge] Failed to parse JSON from /api/keys (${response.status} ${response.statusText}): ${err}`
		);
	}

	if (!response.ok || !data || typeof data !== 'object' || (data as any).ok !== true) {
		const message =
			data && typeof data === 'object' && 'error' in data
				? (data as any).error
				: JSON.stringify(data);
		throw new Error(
			`[CruxBridge] Crux /api/keys returned ${response.status} ${response.statusText}: ${message}`
		);
	}
}

/**
 * Fetch a registry snapshot for a single provider from Crux `/api/models`.
 *
 * This function is intentionally conservative in what it assumes about the
 * snapshot; it only normalizes a handful of stable fields and leaves the
 * rest on `metadata` for future UI/behavior work.
 */
export async function cruxGetModelsForProvider(provider: string, refresh: boolean = false): Promise<CruxModelDescriptor[]> {
	const baseUrl = getCruxBaseUrl();
	const url = `${baseUrl}/api/models?provider=${encodeURIComponent(provider)}&refresh=${refresh ? 'true' : 'false'}`;

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
	const contentType = response.headers && typeof response.headers.get === 'function'
		? response.headers.get('content-type')
		: null;
	const isJson = typeof contentType === 'string' && contentType.toLowerCase().includes('application/json');

	let data: any;
	if (isJson) {
		try {
			data = await response.json();
		} catch (err) {
			throw new Error(`[CruxBridge] Failed to parse JSON from /api/models (${response.status} ${response.statusText}): ${err}`);
		}
	} else {
		let rawText = '';
		try {
			rawText = await response.text();
		} catch (err) {
			rawText = `<failed to read body: ${err}>`;
		}
		throw new Error(
			`[CruxBridge] Crux /api/models returned non-JSON ${response.status} ${response.statusText} with content-type "${contentType || 'unknown'}": ${rawText.slice(0, 512)}`
		);
	}

	if (!response.ok || !data || typeof data !== 'object') {
		const message =
			data && typeof data === 'object' && 'error' in data
				? (data as any).error
				: JSON.stringify(data);
		throw new Error(`[CruxBridge] Crux /api/models returned ${response.status} ${response.statusText}: ${message}`);
	}

	if ((data as any).ok !== true || !(data as any).snapshot) {
		const message =
			data && typeof data === 'object' && 'error' in data
				? (data as any).error
				: 'Missing or invalid snapshot.';
		throw new Error(`[CruxBridge] /api/models response did not contain a valid snapshot: ${message}`);
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

		const caps = m && typeof m.capabilities === 'object'
			? (m.capabilities as Record<string, unknown>)
			: undefined;

		const supportsTools =
			caps && (
				caps['tools'] === true ||
				caps['tool_use'] === true ||
				caps['tool_calls'] === true ||
				caps['functions'] === true
			)
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
				? (m.tags as any[]).map(t => String(t))
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
		throw new Error(`[CruxBridge] Failed to parse JSON from /api/health (${response.status} ${response.statusText}): ${err}`);
	}

	if (!response.ok) {
		const message =
			data && typeof data === 'object' && 'error' in data
				? (data as any).error
				: JSON.stringify(data);
		throw new Error(`[CruxBridge] Crux /api/health returned ${response.status} ${response.statusText}: ${message}`);
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
