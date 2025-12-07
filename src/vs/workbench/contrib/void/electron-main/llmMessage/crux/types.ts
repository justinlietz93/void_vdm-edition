// Shared Crux types used by main-process bridge modules.
//
// These are intentionally generic and mirror the FastAPI service DTOs.
// IDE UI and behavior code can promote specific fields into richer
// TypeScript types as needed.

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
 * Minimal streaming event taxonomy used by `/api/chat/stream`.
 */
export type CruxChatStreamEventType = 'delta' | 'final' | 'error';

export interface CruxChatStreamChunk {
	type: CruxChatStreamEventType;
	payload: unknown;
}

/**
 * Normalized streaming delta event as emitted by Crux and consumed by the IDE.
 */
export type CruxChatStreamDelta = {
	type: 'delta' | 'final' | 'error';
	delta?: string | null;
	structured?: any;
	finish?: boolean;
	error?: string | null;
};

/**
 * Normalized model descriptor as returned by Crux `/api/models`.
 *
 * This is intentionally generic; specific fields can be promoted into
 * richer TypeScript types as UI and behavior begin to rely on them.
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
 * Normalized provider descriptor as returned by Crux `/api/providers`.
 *
 * This mirrors the backend registry projection. The shape is intentionally
 * conservative; UI code should tolerate additional fields on `metadata`.
 */
export interface CruxProviderDescriptor {
	id: string;
	display_name: string;
	aliases: string[];
	model_count: number;
	enabled: boolean;
	metadata?: Record<string, unknown>;
}

/**
 * Health status and component-level diagnostics for Crux `/api/health`.
 */
export type CruxHealthStatus = 'ok' | 'degraded' | 'down';

export interface CruxHealthResponse {
	status: CruxHealthStatus;
	components?: Record<string, { status: CruxHealthStatus; detail?: string }>;
}