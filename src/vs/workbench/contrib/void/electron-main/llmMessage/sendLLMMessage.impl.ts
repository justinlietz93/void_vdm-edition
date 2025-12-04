import {
	LLMChatMessage,
	LLMFIMMessage,
	ModelListParams,
	OnError,
	OnFinalMessage,
	OnText,
	RawToolCallObj,
	RawToolParamsObj,
} from '../../common/sendLLMMessageTypes.js';
import {
	ChatMode,
	ModelSelectionOptions,
	OverridesOfModel,
	ProviderName,
	SettingsOfProvider,
} from '../../common/voidSettingsTypes.js';
import { getModelCapabilities } from '../../common/modelCapabilities.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { cruxGetModelsForProvider, cruxPostKeys, cruxStreamChat, CruxChatRequest } from './cruxBridge.js';

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

// Map Void providerName to Crux env var for API key persistence
const cruxEnvVarOfProvider: Partial<Record<ProviderName, string>> = {
	openAI: 'OPENAI_API_KEY',
	openAICompatible: 'OPENAI_API_KEY',
	openRouter: 'OPENROUTER_API_KEY',
	anthropic: 'ANTHROPIC_API_KEY',
	deepseek: 'DEEPSEEK_API_KEY',
	gemini: 'GEMINI_API_KEY',
	xAI: 'XAI_API_KEY',
};

const cruxKeyCache: Record<string, string | undefined> = {};

const ensureCruxHasKey = async (
	providerName: ProviderName,
	settingsOfProvider: SettingsOfProvider,
): Promise<void> => {
	const envName = cruxEnvVarOfProvider[providerName];
	if (!envName) return;

	const key = (settingsOfProvider as any)?.[providerName]?.apiKey as string | undefined;
	if (!key) return;

	if (cruxKeyCache[envName] === key) return;

	await cruxPostKeys({ [envName]: key });
	cruxKeyCache[envName] = key;
};

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

const toolCallFromCruxParts = (parts: any[]): RawToolCallObj | null => {
	if (!Array.isArray(parts)) return null;
	const toolPart = parts.find((p) => p && typeof p === 'object' && p.type === 'tool_call');
	if (!toolPart || typeof toolPart !== 'object') return null;

	const data: any = (toolPart as any).data || {};
	const name = typeof data.name === 'string' ? data.name : '';
	const args = typeof data.arguments === 'object' && data.arguments !== null ? data.arguments : {};
	const id = typeof data.id === 'string' && data.id ? data.id : generateUuid();

	const rawParams: RawToolParamsObj = args;
	return {
		id,
		name,
		rawParams,
		doneParams: Object.keys(rawParams),
		isDone: true,
	};
};

const textFromCruxResponse = (response: any): string => {
	if (typeof response?.text === 'string') {
		return response.text;
	}
	if (Array.isArray(response?.parts)) {
		return response.parts
			.map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
			.join('');
	}
	return '';
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

	await ensureCruxHasKey(providerName, settingsOfProvider);

	const { modelName } = getModelCapabilities(providerName, modelNameFromUser, overridesOfModel);

	const request: CruxChatRequest = {
		provider: cruxProvider,
		model: modelName,
		messages: buildCruxMessages(messages, separateSystemMessage),
		extra: { feature: 'Chat' },
	};

	try {
		const controller = new AbortController();
		_setAborter(() => controller.abort());

		let fullText = '';
		let toolCall: RawToolCallObj | null = null;
		let finalSeen = false;
		let errored = false;

		await cruxStreamChat(
			request,
			(chunk) => {
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
		const message = error instanceof Error ? `${error}` : String(error);
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

type CruxListedModel = {
	id: string;
	created: number;
	object: string;
	owned_by: string;
};

const listModelsViaCrux = async <TModel extends CruxListedModel>({
	providerName,
	settingsOfProvider,
	onSuccess: onSuccess_,
	onError: onError_,
}: ListParams_Internal<TModel>) => {
	const onSuccess = ({ models }: { models: TModel[] }) => onSuccess_({ models });
	const onError = ({ error }: { error: string }) => onError_({ error });

	const cruxProvider = toCruxProviderName(providerName);
	if (!cruxSupportedProviders.has(cruxProvider)) {
		onError({ error: `Crux does not yet support provider "${providerName}".` });
		return;
	}

	await ensureCruxHasKey(providerName, settingsOfProvider);

	try {
		const cruxModels = await cruxGetModelsForProvider(cruxProvider, true);
		const models: TModel[] = cruxModels.map((m) => {
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
			} as unknown as TModel;
		});

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
