export interface ModelLike {
	provider: string;
	id: string;
	[key: string]: unknown;
}

export interface ModelRegistryLike {
	find?: (provider: string, id: string) => ModelLike | undefined;
	getAll?: () => ModelLike[];
	models?: ModelLike[];
}

export type ModelResolution =
	| { status: "omitted" }
	| { status: "resolved"; model: ModelLike }
	| { status: "unresolved"; request: string; note: string };

const FUZZY_ALIASES: Record<string, Array<[string, string]>> = {
	haiku: [["anthropic", "claude-3-5-haiku-latest"]],
	sonnet: [
		["anthropic", "claude-sonnet-4-5"],
		["anthropic", "claude-sonnet-4-20250514"],
	],
	opus: [["anthropic", "claude-opus-4-5"]],
};

export function resolveModelRequest(
	request?: string,
	registry?: ModelRegistryLike,
): ModelResolution {
	const value = request?.trim();
	if (!value) return { status: "omitted" };

	const exact = resolveExact(value, registry);
	if (exact) return { status: "resolved", model: exact };

	const fuzzy = resolveFuzzy(value, registry);
	if (fuzzy) return { status: "resolved", model: fuzzy };

	return {
		status: "unresolved",
		request: value,
		note: `Model "${value}" was not resolved; child session will use Pi default model.`,
	};
}

function resolveExact(
	request: string,
	registry?: ModelRegistryLike,
): ModelLike | undefined {
	const slash = request.indexOf("/");
	if (slash <= 0 || slash === request.length - 1) return undefined;
	const provider = request.slice(0, slash);
	const id = request.slice(slash + 1);
	return registry?.find?.(provider, id) ?? { provider, id };
}

function resolveFuzzy(
	request: string,
	registry?: ModelRegistryLike,
): ModelLike | undefined {
	const key = request.toLowerCase();
	const all = registry?.getAll?.() ?? registry?.models ?? [];
	const direct = all.find(
		(model) =>
			model.id.toLowerCase() === key ||
			`${model.provider}/${model.id}`.toLowerCase() === key,
	);
	if (direct) return direct;

	for (const [provider, id] of FUZZY_ALIASES[key] ?? []) {
		const found =
			registry?.find?.(provider, id) ??
			all.find((model) => model.provider === provider && model.id === id);
		if (found) return found;
	}

	return all.find((model) => model.id.toLowerCase().includes(key));
}
