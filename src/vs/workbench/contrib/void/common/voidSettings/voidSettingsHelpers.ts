import { deepClone } from '../../../../../base/common/objects.js';
import { getModelCapabilities, defaultProviderSettings } from '../modelCapabilities.js';
import {
	defaultSettingsOfProvider,
	defaultGlobalSettings,
	defaultOverridesOfModel,
	providerNames,
	featureNames,
	VoidStatefulModelInfo,
	ModelSelection,
	FeatureName,
	ChatMode,
	OverridesOfModel,
	modelSelectionsEqual,
	SettingsOfProvider,
	ModelSelectionOfFeature,
	GlobalSettings,
	MCPUserStateOfName,
	OptionsOfModelSelection,
} from '../voidSettingsTypes.js';

// Minimal shape to avoid circular type import from voidSettingsService
export type VoidSettingsStateShape = {
	settingsOfProvider: SettingsOfProvider;
	modelSelectionOfFeature: ModelSelectionOfFeature;
	optionsOfModelSelection: OptionsOfModelSelection;
	overridesOfModel: OverridesOfModel;
	globalSettings: GlobalSettings;
	_modelOptions: ModelOption[];
	mcpUserStateOfName: MCPUserStateOfName;
};

export type ModelOption = { name: string; selection: ModelSelection };

export const modelsWithSwappedInNewModels = (options: { existingModels: VoidStatefulModelInfo[]; models: string[]; type: 'autodetected' | 'default' }) => {
	const { existingModels, models, type } = options;

	const existingModelsMap: Record<string, VoidStatefulModelInfo> = {};
	for (const existingModel of existingModels) {
		existingModelsMap[existingModel.modelName] = existingModel;
	}

	const newDefaultModels = models.map((modelName) => {
		const prev = existingModelsMap[modelName];
		// Only carry over hidden state when the prior entry was the same type.
		const isHidden = prev && prev.type === type ? !!prev.isHidden : false;
		return { modelName, type, isHidden };
	});

	return [
		...newDefaultModels, // swap out all the models of this type for the new models of this type
		...existingModels.filter(m => m.type !== type),
	];
};

export const modelFilterOfFeatureName: {
	[featureName in FeatureName]: {
		filter: (
			o: ModelSelection,
			opts: { chatMode: ChatMode; overridesOfModel: OverridesOfModel }
		) => boolean;
		emptyMessage: null | { message: string; priority: 'always' | 'fallback' };
	}
} = {
	Autocomplete: { filter: (o, opts) => getModelCapabilities(o.providerName, o.modelName, opts.overridesOfModel).supportsFIM, emptyMessage: { message: 'No models support FIM', priority: 'always' } },
	Chat: { filter: o => true, emptyMessage: null },
	'Ctrl+K': { filter: o => true, emptyMessage: null },
	Apply: { filter: o => true, emptyMessage: null },
	SCM: { filter: o => true, emptyMessage: null },
};

export const stateWithMergedDefaultModels = (state: VoidSettingsStateShape): VoidSettingsStateShape => {
	let newSettingsOfProvider = state.settingsOfProvider;

	// recompute default models
	for (const providerName of providerNames) {
		const defaultModels = defaultSettingsOfProvider[providerName]?.models ?? [];
		const currentModels = newSettingsOfProvider[providerName]?.models ?? [];
		const defaultModelNames = defaultModels.map(m => m.modelName);
		const newModels = modelsWithSwappedInNewModels({ existingModels: currentModels, models: defaultModelNames, type: 'default' });
		newSettingsOfProvider = {
			...newSettingsOfProvider,
			[providerName]: {
				...newSettingsOfProvider[providerName],
				models: newModels,
			},
		};
	}
	return {
		...state,
		settingsOfProvider: newSettingsOfProvider,
	};
};

export const validatedModelState = (state: Omit<VoidSettingsStateShape, '_modelOptions'>): VoidSettingsStateShape => {
	let newSettingsOfProvider = state.settingsOfProvider;

	// recompute _didFillInProviderSettings
	for (const providerName of providerNames) {
		const settingsAtProvider = newSettingsOfProvider[providerName];

		const didFillInProviderSettings = Object.keys(defaultProviderSettings[providerName]).every(key => !!settingsAtProvider[key as keyof typeof settingsAtProvider]);

		if (didFillInProviderSettings === settingsAtProvider._didFillInProviderSettings) continue;

		newSettingsOfProvider = {
			...newSettingsOfProvider,
			[providerName]: {
				...settingsAtProvider,
				_didFillInProviderSettings: didFillInProviderSettings,
			},
		};
	}

	// update model options
	let newModelOptions: ModelOption[] = [];
	for (const providerName of providerNames) {
		const providerTitle = providerName;
		if (!newSettingsOfProvider[providerName]._didFillInProviderSettings) continue; // if disabled, don't display model options
		for (const { modelName, isHidden } of newSettingsOfProvider[providerName].models) {
			if (isHidden) continue;
			newModelOptions.push({ name: `${modelName} (${providerTitle})`, selection: { providerName, modelName } });
		}
	}

	// now that model options are updated, make sure the selection is valid
	// if the user-selected model is no longer in the list, update the selection for each feature that needs it to something relevant (the 0th model available, or null)
	let newModelSelectionOfFeature = state.modelSelectionOfFeature;
	for (const featureName of featureNames) {
		const { filter } = modelFilterOfFeatureName[featureName];
		const filterOpts = { chatMode: state.globalSettings.chatMode, overridesOfModel: state.overridesOfModel };
		const modelOptionsForThisFeature = newModelOptions.filter((o) => filter(o.selection, filterOpts));

		const modelSelectionAtFeature = newModelSelectionOfFeature[featureName];
		const selnIdx = modelSelectionAtFeature === null ? -1 : modelOptionsForThisFeature.findIndex(m => modelSelectionsEqual(m.selection, modelSelectionAtFeature));

		if (selnIdx !== -1) continue; // no longer in list, so update to 1st in list or null

		newModelSelectionOfFeature = {
			...newModelSelectionOfFeature,
			[featureName]: modelOptionsForThisFeature.length === 0 ? null : modelOptionsForThisFeature[0].selection,
		};
	}

	const newState = {
		...state,
		settingsOfProvider: newSettingsOfProvider,
		modelSelectionOfFeature: newModelSelectionOfFeature,
		overridesOfModel: state.overridesOfModel,
		_modelOptions: newModelOptions,
	} satisfies VoidSettingsStateShape;

	return newState;
};

export const defaultState = (): VoidSettingsStateShape => {
	const d: VoidSettingsStateShape = {
		settingsOfProvider: deepClone(defaultSettingsOfProvider),
		modelSelectionOfFeature: { Chat: null, 'Ctrl+K': null, Autocomplete: null, Apply: null, SCM: null },
		globalSettings: deepClone(defaultGlobalSettings),
		optionsOfModelSelection: { Chat: {}, 'Ctrl+K': {}, Autocomplete: {}, Apply: {}, SCM: {} },
		overridesOfModel: deepClone(defaultOverridesOfModel),
		_modelOptions: [], // computed later
		mcpUserStateOfName: {},
	};
	return d;
};
