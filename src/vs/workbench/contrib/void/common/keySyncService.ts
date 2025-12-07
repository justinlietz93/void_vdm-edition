// Renderer-side key sync service for pushing provider API keys into Crux via the
// 'void-channel-keys' main-process IPC channel.

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { ProviderName } from './voidSettingsTypes.js';

export interface IKeySyncService {
	readonly _serviceBrand: undefined;

	/**
	 * Push the given provider's API key into Crux via the main-process key sync channel.
	 *
	 * The underlying main-process logic (syncCruxKey) is responsible for:
	 * - Mapping providerName to the correct Crux environment variable name.
	 * - Ignoring empty, whitespace-only, masked ("*****"), or non-ASCII values.
	 * - Caching identical values to avoid redundant POSTs.
	 */
	syncProviderKey(providerName: ProviderName, apiKey: string | undefined): Promise<void>;

	/**
	 * Explicitly delete a provider's key from Crux via the key-sync channel.
	 *
	 * This is surfaced as a separate gesture from "empty string" so that the UI
	 * can distinguish between "clear the field locally" and "remove from Crux".
	 */
	deleteProviderKey(providerName: ProviderName): Promise<void>;
}

export const IKeySyncService = createDecorator<IKeySyncService>('keySyncService');

class KeySyncService implements IKeySyncService {
	declare readonly _serviceBrand: undefined;

	private readonly channel: IChannel;

	constructor(
		@IMainProcessService private readonly mainProcessService: IMainProcessService,
	) {
		// This channel is registered in the main process as 'void-channel-keys'.
		this.channel = this.mainProcessService.getChannel('void-channel-keys');
	}

	async syncProviderKey(providerName: ProviderName, apiKey: string | undefined): Promise<void> {
		try {
			await this.channel.call('syncProviderKey', { providerName, apiKey });
		} catch (err) {
			// Keep failures visible during development without breaking the UI.
			console.error('[Void][KeySyncService] syncProviderKey failed:', err);
		}
	}

	async deleteProviderKey(providerName: ProviderName): Promise<void> {
		try {
			await this.channel.call('deleteProviderKey', { providerName });
		} catch (err) {
			console.error('[Void][KeySyncService] deleteProviderKey failed:', err);
		}
	}
}

// Eager so that the channel registration happens early and consistently, mirroring
// patterns used by ILLMMessageService and IMCPService.
registerSingleton(IKeySyncService, KeySyncService, InstantiationType.Eager);