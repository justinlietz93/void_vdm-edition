import {
	LLMChatMessage,
	LLMFIMMessage,
	ModelListParams,
	OnError,
	OnFinalMessage,
	OnText,
	RawToolCallObj,
} from '../../common/sendLLMMessageTypes.js';
import {
	ChatMode,
	ModelSelectionOptions,
	OverridesOfModel,
	ProviderName,
	SettingsOfProvider,
} from '../../common/voidSettingsTypes.js';
import { getModelCapabilities, setCruxModelCapabilitiesOverlayForProvider } from '../../common/modelCapabilities.js';
import { cruxGetModelsForProvider, cruxPostChat, cruxStreamChat, CruxChatRequest } from './cruxBridge.js';
import { buildCruxCapabilitiesOverlayForModels } from './cruxModelOverlay.js';
import { ensureCruxHasKeyFromSettings } from './cruxKeySync.js';

/**
 * Streaming timeout configuration for Crux chat.
 *
 * These bounds are intentionally conservative and are meant to:
 * - prevent the UI from hanging indefinitely on misbehaving streams
 * - allow long-running, but active, streams to proceed (e.g. tool-heavy flows)
 *
 * Idle timeout:
 *   Abort when no data is received for this many milliseconds.
 *
 * Total timeout:
 *   Hard upper bound on wall-clock duration of a single streaming request.
 */
const STREAM_IDLE_TIMEOUT_MS = 30_000; // 30s of no activity is treated as an error.
const STREAM_TOTAL_TIMEOUT_MS = 5 * 60_000; // 5 minutes total per request.

type InternalCommonMessageParams = {
	onText: OnText;
	onFinalMessage: OnFinalMessage;
	onError: OnError;
	providerName: ProviderName;
	settingsOfProvider: SettingsOfProvider;
	modelSelectionOptions: ModelSelectionOptions | undefined;
	overridesOfModel: OverridesOfModel | undefined;
	modelName: string;
	_setAborter: (aborter: () => void) => void;
};

type SendChatParams_Internal = InternalCommonMessageParams & {
	messages: LLMChatMessage[];
	separateSystemMessage: string | undefined;
	chatMode: ChatMode | null;
	mcpTools: any[] | undefined;
};

type SendFIMParams_Internal = InternalCommonMessageParams & {
	messages: LLMFIMMessage;
	separateSystemMessage: string | undefined;
};

export type ListParams_Internal<ModelResponse> = ModelListParams<ModelResponse>;

type CallFnOfProvider = {
	[providerName in ProviderName]: {
		sendChat: (params: SendChatParams_Internal) => Promise<void>;
		sendFIM: ((params: SendFIMParams_Internal) => void) | null;
		list: ((params: ListParams_Internal<any>) => void) | null;
	};
};

const cruxProviderMap: Partial<Record<ProviderName, string>> = {
	openAI: 'openai',
	openRouter: 'openrouter',
	xAI: 'xai',
	googleVertex: 'googlevertex',
	microsoftAzure: 'microsoftazure',
	awsBedrock: 'awsbedrock',
	liteLLM: 'litellm',
	vLLM: 'vllm',
	lmStudio: 'lmstudio',
	openAICompatible: 'openai',
};

const cruxSupportedProviders = new Set<string>([
	'openai',
	'anthropic',
	'gemini',
	'deepseek',
	'openrouter',
	'ollama',
	'xai',
]);

const toCruxProviderName = (providerName: ProviderName): string => {
	return cruxProviderMap[providerName] ?? providerName.toLowerCase();
};

 // Key synchronization for Crux (provider -> env var) is handled by helpers in ./cruxKeySync.ts.

const ensureCruxProviderSupported = (
	providerName: ProviderName,
	onError: OnError,
): string | null => {
	const cruxProvider = toCruxProviderName(providerName);
	if (!cruxSupportedProviders.has(cruxProvider)) {
		onError({
			message: `Crux does not yet support provider "${providerName}".`,
			fullError: null,
		});
		return null;
	}
	return cruxProvider;
};

const buildCruxMessages = (
	messages: LLMChatMessage[],
	separateSystemMessage: string | undefined,
): { role: string; content: unknown }[] => {
	const cruxMessages: { role: string; content: unknown }[] = [];

	if (separateSystemMessage) {
		cruxMessages.push({ role: 'system', content: separateSystemMessage });
	}

	for (const m of messages as any[]) {
		cruxMessages.push({ role: m.role, content: m.content });
	}

	return cruxMessages;
};

const sendChatViaCrux = async (params: SendChatParams_Internal) => {
	const {
		messages,
		separateSystemMessage,
		onText,
		onFinalMessage,
		onError,
		settingsOfProvider,
		overridesOfModel,
		modelName: modelNameFromUser,
		providerName,
		_setAborter,
	} = params;

	const cruxProvider = ensureCruxProviderSupported(providerName, onError);
	if (!cruxProvider) return;

	await ensureCruxHasKeyFromSettings(providerName, settingsOfProvider);

	const { modelName } = getModelCapabilities(providerName, modelNameFromUser, overridesOfModel);

	const request: CruxChatRequest = {
		provider: cruxProvider,
		model: modelName,
		messages: buildCruxMessages(messages, separateSystemMessage),
		extra: { feature: 'Chat' },
	};

	const nonStreamingFallback = async () => {
		const payload = await cruxPostChat(request);
		const resp: any = (payload as any).response;
		const fullText = typeof resp?.text === 'string'
			? resp.text
			: Array.isArray(resp?.parts)
				? resp.parts.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('')
				: '';

		if (!fullText) {
			onError({ message: 'Void: Response from Crux /api/chat was empty.', fullError: null });
			return;
		}

		onText({ fullText, fullReasoning: '', toolCall: undefined });
		onFinalMessage({
			fullText,
			fullReasoning: '',
			anthropicReasoning: null,
		});
	};

	try {
		const controller = new AbortController();
		_setAborter(() => controller.abort());

		let fullText = '';
		let toolCall: RawToolCallObj | null = null;
		let finalSeen = false;
		let errored = false;

		let idleTimer: any = null;
		let totalTimer: any = null;

		const clearTimers = () => {
			if (idleTimer) {
				clearTimeout(idleTimer);
				idleTimer = null;
			}
			if (totalTimer) {
				clearTimeout(totalTimer);
				totalTimer = null;
			}
		};

		const scheduleIdleTimer = () => {
			if (idleTimer) {
				clearTimeout(idleTimer);
			}
			idleTimer = setTimeout(() => {
				if (errored || finalSeen) {
					return;
				}
				errored = true;
				onError({
					message: 'Void: LLM stream timed out due to inactivity.',
					fullError: null,
				});
				controller.abort();
			}, STREAM_IDLE_TIMEOUT_MS);
		};

		// Hard wall-clock limit for the entire streaming request.
		totalTimer = setTimeout(() => {
			if (errored || finalSeen) {
				return;
			}
			errored = true;
			onError({
				message: 'Void: LLM stream exceeded maximum duration.',
				fullError: null,
			});
			controller.abort();
		}, STREAM_TOTAL_TIMEOUT_MS);

		// Arm the idle timer before starting the stream.
		scheduleIdleTimer();

		await cruxStreamChat(
			request,
			(chunk) => {
				// Any chunk (delta or control) counts as activity and resets the idle timer.
				scheduleIdleTimer();

				if (chunk.error) {
					errored = true;
					onError({ message: chunk.error, fullError: null });
					controller.abort();
					return;
				}
				const delta = typeof chunk.delta === 'string' ? chunk.delta : '';
				if (delta) {
					fullText += delta;
					onText({ fullText, fullReasoning: '', toolCall: toolCall ?? undefined });
				}
				if (chunk.finish || chunk.type === 'final') {
					finalSeen = true;
				}
			},
			controller.signal,
		);

		clearTimers();

		if (errored) return;

		if (!finalSeen && !fullText && !toolCall) {
			onError({ message: 'Void: Response from Crux /api/chat was empty.', fullError: null });
			return;
		}

		const toolCallObj = toolCall ? { toolCall } : {};

		onFinalMessage({
			fullText,
			fullReasoning: '',
			anthropicReasoning: null,
			...toolCallObj,
		});
	} catch (error) {
		// Ensure timers are cleared on any failure path.
		// If we already surfaced an error via a timeout/abort, avoid double-reporting.
		// Many runtimes surface aborts as an Error with name "AbortError".
		const errName = (error as any)?.name;
		if (errName === 'AbortError') {
			// timers may have already been cleared in the success path, but calling again is safe
			// eslint-disable-next-line no-unsafe-finally
			return;
		}

		// If the streaming endpoint is missing (older Crux), fall back to non-streaming chat.
		const message = error instanceof Error ? `${error}` : String(error);
		if (message.includes('/api/chat/stream') && message.includes('404')) {
			try {
				await nonStreamingFallback();
				return;
			} catch (fallbackError) {
				const fallbackMsg = fallbackError instanceof Error ? `${fallbackError}` : String(fallbackError);
				onError({ message: fallbackMsg, fullError: fallbackError instanceof Error ? fallbackError : null });
				return;
			}
		}
		onError({ message, fullError: error instanceof Error ? error : null });
	}
};

const sendFIMViaCruxUnsupported = ({ onError, providerName, _setAborter }: SendFIMParams_Internal) => {
	_setAborter(() => { /* no-op abort */ });
	onError({
		message: `Crux does not support fill-in-the-middle for provider "${providerName}".`,
		fullError: null,
	});
};

const listModelsViaCrux = async ({
	providerName,
	settingsOfProvider,
	onSuccess: onSuccess_,
	onError: onError_,
}: ListParams_Internal<any>) => {
	const onSuccess = ({ models }: { models: any[] }) => onSuccess_({ models });
	const onError = ({ error }: { error: string }) => onError_({ error });

	const cruxProvider = toCruxProviderName(providerName);
	if (!cruxSupportedProviders.has(cruxProvider)) {
		onError({ error: `Crux does not yet support provider "${providerName}".` });
		return;
	}

	await ensureCruxHasKeyFromSettings(providerName, settingsOfProvider);

	try {
		const cruxModels = await cruxGetModelsForProvider(cruxProvider, true);

		// Update the in-memory capability overlay for this provider so that
		// subsequent calls to `getModelCapabilities` can rely on Crux as the
		// primary source of truth for high-level behavior (system messages,
		// tool format, FIM support, context window, etc.).
		try {
			const overlays = buildCruxCapabilitiesOverlayForModels(cruxModels);
			setCruxModelCapabilitiesOverlayForProvider(providerName, overlays);
		} catch (err) {
			console.error('[Void][CruxModelOverlay] Failed to build or register overlay for provider', providerName, err);
		}

		const models: any[] = cruxModels.map((m) => {
			const raw = ((m.metadata as any)?.raw ?? {}) as any;

			const created =
				typeof raw?.created === 'number'
					? raw.created
					: typeof raw?.created_at === 'number'
						? raw.created_at
						: 0;

			const owned_by =
				typeof raw?.owned_by === 'string' ? raw.owned_by : m.provider || 'crux';

			return {
				id: m.id,
				created,
				object: 'model',
				owned_by,
			};
		}) as any[];

		onSuccess({ models });
	} catch (error) {
		onError({ error: String(error) });
	}
};

export const sendLLMMessageToProviderImplementation = {
	anthropic: {
		sendChat: sendChatViaCrux,
		sendFIM: sendFIMViaCruxUnsupported,
		list: listModelsViaCrux,
	},
	openAI: {
		sendChat: sendChatViaCrux,
		sendFIM: sendFIMViaCruxUnsupported,
		list: listModelsViaCrux,
	},
	xAI: {
		sendChat: sendChatViaCrux,
		sendFIM: sendFIMViaCruxUnsupported,
		list: listModelsViaCrux,
	},
	gemini: {
		sendChat: sendChatViaCrux,
		sendFIM: sendFIMViaCruxUnsupported,
		list: listModelsViaCrux,
	},
	mistral: {
		sendChat: sendChatViaCrux,
		sendFIM: sendFIMViaCruxUnsupported,
		list: listModelsViaCrux,
	},
	ollama: {
		sendChat: sendChatViaCrux,
		sendFIM: sendFIMViaCruxUnsupported,
		list: listModelsViaCrux,
	},
	openAICompatible: {
		sendChat: sendChatViaCrux,
		sendFIM: sendFIMViaCruxUnsupported,
		list: listModelsViaCrux,
	},
	openRouter: {
		sendChat: sendChatViaCrux,
		sendFIM: sendFIMViaCruxUnsupported,
		list: listModelsViaCrux,
	},
	vLLM: {
		sendChat: sendChatViaCrux,
		sendFIM: sendFIMViaCruxUnsupported,
		list: listModelsViaCrux,
	},
	deepseek: {
		sendChat: sendChatViaCrux,
		sendFIM: sendFIMViaCruxUnsupported,
		list: listModelsViaCrux,
	},
	groq: {
		sendChat: sendChatViaCrux,
		sendFIM: sendFIMViaCruxUnsupported,
		list: listModelsViaCrux,
	},
	lmStudio: {
		sendChat: sendChatViaCrux,
		sendFIM: sendFIMViaCruxUnsupported,
		list: listModelsViaCrux,
	},
	liteLLM: {
		sendChat: sendChatViaCrux,
		sendFIM: sendFIMViaCruxUnsupported,
		list: listModelsViaCrux,
	},
	googleVertex: {
		sendChat: sendChatViaCrux,
		sendFIM: sendFIMViaCruxUnsupported,
		list: listModelsViaCrux,
	},
	microsoftAzure: {
		sendChat: sendChatViaCrux,
		sendFIM: sendFIMViaCruxUnsupported,
		list: listModelsViaCrux,
	},
	awsBedrock: {
		sendChat: sendChatViaCrux,
		sendFIM: sendFIMViaCruxUnsupported,
		list: listModelsViaCrux,
	},
} satisfies CallFnOfProvider;
