export interface PassiveUsageStats {
	tokens?: number;
	contextTokens?: number;
	contextWindow?: number;
}

export interface PassiveUsageSnapshot {
	turnCount?: number;
	maxTurns?: number;
	toolUseCount?: number;
	usage?: PassiveUsageStats;
	compactionCount?: number;
	currentActivity?: string;
}

export function extractPassiveUsage(input: unknown): PassiveUsageSnapshot {
	const source = asRecord(input);
	if (!source) return {};
	const usage = asRecord(source.usage) ?? asRecord(source.contextUsage);
	const extractedUsage = usage
		? compactUsage({
				tokens: numberFrom(
					usage.tokens,
					usage.totalTokens,
					usage.inputTokens,
					usage.outputTokens,
				),
				contextTokens: numberFrom(
					usage.contextTokens,
					usage.usedTokens,
					usage.tokensUsed,
				),
				contextWindow: numberFrom(
					usage.contextWindow,
					usage.maxTokens,
					usage.limit,
				),
			})
		: undefined;

	return compactSnapshot({
		turnCount: numberFrom(source.turnCount, source.turns),
		maxTurns: numberFrom(source.maxTurns, source.max_turns),
		toolUseCount: numberFrom(source.toolUseCount, source.toolUses),
		usage: extractedUsage,
		compactionCount: numberFrom(source.compactionCount, source.compactions),
		currentActivity: stringFrom(source.currentActivity, source.activity),
	});
}

export function mergePassiveUsage(
	base: PassiveUsageSnapshot = {},
	update: PassiveUsageSnapshot = {},
): PassiveUsageSnapshot {
	return compactSnapshot({
		turnCount: update.turnCount ?? base.turnCount,
		maxTurns: update.maxTurns ?? base.maxTurns,
		toolUseCount: update.toolUseCount ?? base.toolUseCount,
		usage: compactUsage({
			...base.usage,
			...update.usage,
		}),
		compactionCount: update.compactionCount ?? base.compactionCount,
		currentActivity: update.currentActivity ?? base.currentActivity,
	});
}

export function buildNotificationPreview(text: string, limit = 600): string {
	const chars = [...String(text ?? "")];
	if (chars.length <= limit) return chars.join("");
	if (limit <= 1) return "…";
	return `${chars.slice(0, limit - 1).join("")}…`;
}

export function formatCompactNumber(value: number): string {
	if (!Number.isFinite(value)) return "—";
	const abs = Math.abs(value);
	if (abs < 1000) return String(Math.round(value));
	if (abs < 10000) return `${trimOneDecimal(value / 1000)}K`;
	if (abs < 1_000_000) return `${Math.round(value / 1000)}K`;
	if (abs < 10_000_000) return `${trimOneDecimal(value / 1_000_000)}M`;
	return `${Math.round(value / 1_000_000)}M`;
}

function trimOneDecimal(value: number): string {
	return value.toFixed(1).replace(/\.0$/, "");
}

function compactSnapshot(snapshot: PassiveUsageSnapshot): PassiveUsageSnapshot {
	return Object.fromEntries(
		Object.entries(snapshot).filter(([, value]) => {
			if (value === undefined) return false;
			if (typeof value === "object" && Object.keys(value).length === 0) {
				return false;
			}
			return true;
		}),
	) as PassiveUsageSnapshot;
}

function compactUsage(usage: PassiveUsageStats): PassiveUsageStats | undefined {
	const compacted = Object.fromEntries(
		Object.entries(usage).filter(([, value]) => value !== undefined),
	) as PassiveUsageStats;
	return Object.keys(compacted).length > 0 ? compacted : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === "object"
		? (value as Record<string, unknown>)
		: undefined;
}

function numberFrom(...values: unknown[]): number | undefined {
	for (const value of values) {
		if (typeof value === "number" && Number.isFinite(value)) return value;
	}
	return undefined;
}

function stringFrom(...values: unknown[]): string | undefined {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) return value;
	}
	return undefined;
}
