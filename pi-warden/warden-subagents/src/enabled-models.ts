import type { ModelLike } from "./model-resolver.ts";

export type ModelScopeEnforcement =
	| { status: "allowed"; model?: ModelLike }
	| { status: "blocked"; model?: ModelLike; note: string };

export interface EnforceAllowedModelScopeOptions {
	model?: ModelLike;
	enabled?: boolean;
	allowedModels?: string[];
}

export function enforceAllowedModelScope(
	options: EnforceAllowedModelScopeOptions,
): ModelScopeEnforcement {
	if (!options.enabled || !options.model) {
		return { status: "allowed", model: options.model };
	}

	const key = `${options.model.provider}/${options.model.id}`;
	if ((options.allowedModels ?? []).includes(key)) {
		return { status: "allowed", model: options.model };
	}

	return {
		status: "blocked",
		model: options.model,
		note: `Model "${key}" is outside enabled model scope.`,
	};
}
