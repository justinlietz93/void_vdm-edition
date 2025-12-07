// IPC channel for synchronizing provider API keys into Crux via /api/keys.
//
// This channel is intentionally minimal:
// - Renderer sends { providerName, apiKey }.
// - Channel delegates to syncCruxKey(), which owns all validation/masking logic.
// - No events are exposed; this is strictly a command channel.

import { IServerChannel } from '../../../../../base/parts/ipc/common/ipc.js';
import { Event } from '../../../../../base/common/event.js';

import { ProviderName } from '../../common/voidSettingsTypes.js';
import { syncCruxKey, deleteCruxKey } from './cruxKeySync.js';

type SyncProviderKeyArgs = {
	providerName: ProviderName;
	apiKey: string | undefined;
};

export class KeySyncChannel implements IServerChannel {

	// No events are currently exposed for key sync.
	// Any attempt to listen will throw a clear error.
	listen(_context: unknown, event: string): Event<any> {
		throw new Error(`KeySyncChannel: Event not found: ${event}`);
	}

	async call(_context: unknown, command: string, args?: any): Promise<any> {
		try {
			if (command === 'syncProviderKey') {
				const { providerName, apiKey } = (args ?? {}) as SyncProviderKeyArgs;

				// Defensive check: require a providerName; apiKey may be undefined
				// (syncCruxKey handles undefined/empty/masked cases).
				if (!providerName) {
					throw new Error('KeySyncChannel: "providerName" is required for syncProviderKey.');
				}

				await syncCruxKey(providerName, apiKey);
				return;
			}

			if (command === 'deleteProviderKey') {
				const { providerName } = (args ?? {}) as SyncProviderKeyArgs;

				if (!providerName) {
					throw new Error('KeySyncChannel: "providerName" is required for deleteProviderKey.');
				}

				await deleteCruxKey(providerName);
				return;
			}

			throw new Error(`KeySyncChannel: command "${command}" not recognized.`);
		} catch (err) {
			// Keep errors visible in main-process logs without crashing the IPC stack.
			console.error('[Void][KeySyncChannel] Call Error:', err);
		}
	}
}