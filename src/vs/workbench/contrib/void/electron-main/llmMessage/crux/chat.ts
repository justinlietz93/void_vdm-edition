// Chat-related HTTP helpers for Crux `/api/chat` and `/api/chat/stream`.

import { getCruxBaseUrl } from './cruxBase.js';
import { CruxChatRequest, CruxChatStreamDelta } from './types.js';

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
			`[CruxBridge] Failed to parse JSON from /api/chat (${response.status} ${response.statusText}): ${err}`,
		);
	}

	if (!response.ok) {
		const message =
			data && typeof data === 'object' && 'detail' in data
				? (data as any).detail
				: JSON.stringify(data);
		throw new Error(
			`[CruxBridge] Crux /api/chat returned ${response.status} ${response.statusText}: ${message}`,
		);
	}

	if (!data || typeof data !== 'object' || (data as any).ok !== true || !(data as any).response) {
		throw new Error(
			`[CruxBridge] /api/chat response missing "ok: true" or "response" field: ${JSON.stringify(
				data,
			)}`,
		);
	}

	return data;
}

/**
 * Streaming chat bridge (NDJSON).
 *
 * Streams chunks from Crux `/api/chat/stream` and calls `onChunk` for each parsed
 * JSON line. Throws on HTTP errors or parse failures.
 */
export async function cruxStreamChat(
	request: CruxChatRequest,
	onChunk: (chunk: CruxChatStreamDelta) => void,
	signal?: AbortSignal,
): Promise<void> {
	const baseUrl = getCruxBaseUrl();
	const url = `${baseUrl}/api/chat/stream`;

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(request),
		signal,
	});

	if (!response.ok) {
		const text = await response.text().catch(() => '');
		throw new Error(
			`[CruxBridge] Crux /api/chat/stream returned ${response.status} ${response.statusText}: ${
				text || 'no body'
			}`,
		);
	}

	if (!response.body) {
		throw new Error(`[CruxBridge] /api/chat/stream returned no body (${response.status})`);
	}

	const reader = (response.body as any).getReader ? (response.body as any).getReader() : null;
	const decoder = new TextDecoder();
	let buffer = '';

	const flushBuffer = () => {
		const parts = buffer.split('\n');
		buffer = parts.pop() ?? '';
		for (const line of parts) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			onChunk(JSON.parse(trimmed));
		}
	};

	if (reader) {
		// Web stream (Node fetch in Electron main)
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			flushBuffer();
		}
		buffer += decoder.decode();
		flushBuffer();
	} else {
		// Fallback for async iterable bodies (older runtimes)
		for await (const chunk of response.body as any) {
			const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
			buffer += text;
			flushBuffer();
		}
		flushBuffer();
	}
}