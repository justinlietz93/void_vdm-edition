// Thin façade over Crux bridge submodules.
//
// IMPORTANT:
// This file is intentionally kept <500 LOC. All implementation details live
// in the `./crux` subfolder. Other parts of the IDE should continue to import
// from this module as before; the exported surface area is preserved.

/**
 * Base URL resolver (owned by CruxSupervisor configuration).
 */
export { getCruxBaseUrl } from './crux/cruxBase.js'; // TODO This file doesn't exist

/**
 * Shared Crux types.
 */
export type {
	CruxChatFeature,
	CruxChatMetadata,
	CruxChatRequest,
	CruxChatStreamEventType,
	CruxChatStreamChunk,
	CruxChatStreamDelta,
	CruxModelDescriptor,
	CruxProviderDescriptor,
	CruxHealthStatus,
	CruxHealthResponse,
} from './crux/types.js';

/**
 * Chat endpoints: `/api/chat` and `/api/chat/stream`.
 */
export { cruxPostChat, cruxStreamChat } from './crux/chat.js';

/**
 * Key management endpoint: `/api/keys`.
 */
export { cruxPostKeys, cruxDeleteProviderKey } from './crux/keys.js';

/**
 * Model and provider registry endpoints: `/api/models`, `/api/providers`.
 */
export { cruxGetModelsForProvider, cruxGetProviders } from './crux/models.js';

/**
 * Health endpoint: `/api/health`.
 */
export { cruxGetHealth } from './crux/health.js';
