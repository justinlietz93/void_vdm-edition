import { CruxModelDescriptor } from './cruxBridge.js';
import { VoidStaticModelInfo } from '../../common/modelCapabilities.js';

/**
 * Derive a `VoidStaticModelInfo` overlay map from a Crux `/api/models` snapshot.
 *
 * This adapter is intentionally provider-agnostic: it only inspects generic
 * capability keys (e.g. `tool_format`, `system_message`, `fim`, `context_window`)
 * that are produced by Crux's internal capability/profile logic. All provider-
 * specific knowledge (e.g. which providers use which formats) lives in Crux.
 */
export function buildCruxCapabilitiesOverlayForModels(
	cruxModels: CruxModelDescriptor[],
): Record<string, Partial<VoidStaticModelInfo>> {
	const overlays: Record<string, Partial<VoidStaticModelInfo>> = Object.create(null);

	for (const m of cruxModels) {
		const raw = ((m.metadata as any)?.raw ?? {}) as any;
		const caps = raw && typeof raw.capabilities === 'object'
			? (raw.capabilities as Record<string, unknown>)
			: undefined;

		const overlay: Partial<VoidStaticModelInfo> = {};

		// Context window from Crux snapshot (tokens).
		if (typeof m.context_window === 'number' && m.context_window > 0) {
			overlay.contextWindow = m.context_window;
		}

		// System message semantics from Crux capability profile.
		const sys = caps && typeof caps['system_message'] === 'string'
			? (caps['system_message'] as string)
			: undefined;

		if (sys === 'developer-role' || sys === 'system-role' || sys === 'separated') {
			overlay.supportsSystemMessage = sys as any;
		} else if (sys === 'none') {
			overlay.supportsSystemMessage = false;
		}

		// Tool format from Crux capability profile -> Void specialToolFormat.
		const tf = caps && typeof caps['tool_format'] === 'string'
			? (caps['tool_format'] as string)
			: undefined;

		if (tf === 'openai') {
			overlay.specialToolFormat = 'openai-style';
		} else if (tf === 'anthropic') {
			overlay.specialToolFormat = 'anthropic-style';
		} else if (tf === 'gemini') {
			overlay.specialToolFormat = 'gemini-style';
		}

		// Fill-in-the-middle support (if Crux knows it).
		if (caps && typeof caps['fim'] === 'boolean') {
			overlay.supportsFIM = caps['fim'] as boolean;
		}

		// Reserved output token space hints from Crux, when present.
		if (caps && typeof caps['reserved_output_token_space'] === 'number') {
			overlay.reservedOutputTokenSpace = caps['reserved_output_token_space'] as number;
		}

		// Reasoning capabilities (if Crux provides them). This is a purely
		// structural mapping of Crux capability fields into the IDE type; all
		// provider- and model-specific semantics live in Crux.
		const reasoning = caps && typeof caps['reasoning'] === 'object'
			? (caps['reasoning'] as any)
			: undefined;

		if (reasoning && reasoning.supports_reasoning === true) {
			const rc: any = {
				supportsReasoning: true as const,
				canTurnOffReasoning:
					typeof reasoning.can_turn_off_reasoning === 'boolean'
						? reasoning.can_turn_off_reasoning
						: true,
				canIOReasoning:
					typeof reasoning.can_io_reasoning === 'boolean'
						? reasoning.can_io_reasoning
						: false,
			};

			// Optional reasoning-specific reserved output space, if Crux defines it.
			if (typeof reasoning.reserved_output_token_space === 'number') {
				rc.reasoningReservedOutputTokenSpace = reasoning.reserved_output_token_space;
			}

			const slider = reasoning.slider;
			if (slider && typeof slider === 'object') {
				// Budget-style slider: numeric min/max/default.
				if (
					typeof slider.min === 'number' &&
					typeof slider.max === 'number' &&
					typeof slider.default === 'number'
				) {
					rc.reasoningSlider = {
						type: 'budget_slider' as const,
						min: slider.min,
						max: slider.max,
						default: slider.default,
					};
				}
				// Effort-style slider: discrete values with a default.
				else if (Array.isArray(slider.values) && slider.values.length > 0) {
					const values = slider.values.map((v: any) => String(v));
					const def =
						typeof slider.default === 'string' && slider.default
							? String(slider.default)
							: values[0];
					rc.reasoningSlider = {
						type: 'effort_slider' as const,
						values,
						default: def,
					};
				}
			}

			overlay.reasoningCapabilities = rc;
		}

		if (Object.keys(overlay).length > 0) {
			overlays[m.id] = overlay;
		}
	}

	return overlays;
}