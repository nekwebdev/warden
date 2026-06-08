import { formatCompactNumber, type PassiveUsageSnapshot } from "../usage.ts";
import type { BackgroundAgentStatus } from "../agent-manager.ts";

export const SUBAGENT_WIDGET_ID = "warden-subagents";

export interface AgentActivityItem extends PassiveUsageSnapshot {
	agentId: string;
	status: BackgroundAgentStatus;
	agentType: string;
	requestedAgentType?: string;
	description?: string;
	createdAt?: number;
	startedAt?: number;
	updatedAt?: number;
	completedAt?: number;
}

export interface AgentActivitySnapshot {
	running: AgentActivityItem[];
	queued: AgentActivityItem[];
	queuedCount: number;
}

export interface BuildAgentWidgetOptions {
	now?: number;
	spinnerFrame?: string;
}

export interface AgentWidgetController {
	update(snapshot: AgentActivitySnapshot): void;
	shutdown(): void;
}

export function buildAgentWidgetLines(
	snapshot: AgentActivitySnapshot,
	options: BuildAgentWidgetOptions = {},
): string[] {
	const now = options.now ?? Date.now();
	const frame = options.spinnerFrame ?? "⠋";
	const running = snapshot.running ?? [];
	const queued = snapshot.queued ?? [];
	if (running.length === 0 && queued.length === 0) return [];

	const lines = [
		`Subagents: ${running.length} running · ${snapshot.queuedCount ?? queued.length} queued`,
	];
	for (const item of running) {
		lines.push(`${frame} ${formatActivityItem(item, now)}`);
	}
	if (queued.length > 0) {
		lines.push(
			`Queued: ${queued.length} ${queued
				.slice(0, 3)
				.map(
					(item) =>
						`${item.agentType}${item.description ? ` — ${item.description}` : ""}`,
				)
				.join("; ")}`,
		);
	}
	return lines;
}

export function createAgentWidgetController(
	ctx: unknown,
	options: {
		widgetId?: string;
		now?: () => number;
		spinnerFrame?: () => string;
	} = {},
): AgentWidgetController {
	const widgetId = options.widgetId ?? SUBAGENT_WIDGET_ID;
	const ui = uiFrom(ctx);
	const canRender = Boolean(ui && hasUi(ctx));
	return {
		update(snapshot) {
			if (!canRender || !ui) return;
			const lines = buildAgentWidgetLines(snapshot, {
				now: options.now?.() ?? Date.now(),
				spinnerFrame: options.spinnerFrame?.(),
			});
			ui.setWidget(widgetId, lines.length > 0 ? lines : undefined, {
				placement: "aboveEditor",
			});
		},
		shutdown() {
			if (!canRender || !ui) return;
			ui.setWidget(widgetId, undefined);
		},
	};
}

function formatActivityItem(item: AgentActivityItem, now: number): string {
	return [
		item.agentType,
		item.description ? `— ${item.description}` : undefined,
		formatTurns(item),
		formatTools(item),
		formatUsage(item),
		formatCompactions(item),
		formatElapsed(item, now),
		item.currentActivity,
	]
		.filter(Boolean)
		.join(" · ");
}

function formatTurns(item: AgentActivityItem): string | undefined {
	if (item.turnCount === undefined && item.maxTurns === undefined)
		return undefined;
	return `turns ${item.turnCount ?? "—"}/${item.maxTurns ?? "—"}`;
}

function formatTools(item: AgentActivityItem): string | undefined {
	return item.toolUseCount === undefined
		? undefined
		: `tools ${item.toolUseCount}`;
}

function formatUsage(item: AgentActivityItem): string | undefined {
	const parts = [];
	if (item.usage?.tokens !== undefined) {
		parts.push(`tokens ${formatCompactNumber(item.usage.tokens)}`);
	}
	if (
		item.usage?.contextTokens !== undefined ||
		item.usage?.contextWindow !== undefined
	) {
		parts.push(
			`context ${item.usage.contextTokens === undefined ? "—" : formatCompactNumber(item.usage.contextTokens)}/${
				item.usage.contextWindow === undefined
					? "—"
					: formatCompactNumber(item.usage.contextWindow)
			}`,
		);
	}
	return parts.length > 0 ? parts.join(" · ") : undefined;
}

function formatCompactions(item: AgentActivityItem): string | undefined {
	return item.compactionCount === undefined
		? undefined
		: `compactions ${item.compactionCount}`;
}

function formatElapsed(
	item: AgentActivityItem,
	now: number,
): string | undefined {
	const started = item.startedAt ?? item.createdAt;
	if (started === undefined) return undefined;
	const seconds = Math.max(0, Math.floor((now - started) / 1000));
	const minutes = Math.floor(seconds / 60);
	const remainder = seconds % 60;
	return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function uiFrom(
	ctx: unknown,
):
	| {
			setWidget: (
				id: string,
				value: string[] | undefined,
				options?: unknown,
			) => void;
	  }
	| undefined {
	if (!ctx || typeof ctx !== "object") return undefined;
	const ui = (ctx as { ui?: unknown }).ui;
	if (!ui || typeof ui !== "object") return undefined;
	const setWidget = (ui as { setWidget?: unknown }).setWidget;
	return typeof setWidget === "function"
		? ({ setWidget: setWidget.bind(ui) } as {
				setWidget: (
					id: string,
					value: string[] | undefined,
					options?: unknown,
				) => void;
			})
		: undefined;
}

function hasUi(ctx: unknown): boolean {
	return Boolean(
		ctx &&
			typeof ctx === "object" &&
			(ctx as { hasUI?: unknown }).hasUI !== false,
	);
}
