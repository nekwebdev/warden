import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import {
	contributeWardenPane,
	getWardenPane,
	openWardenPanel,
	type ShowWardenPanelOptions,
	type WardenPanelPane,
	type WardenPanelPaneContext,
} from "@nekwebdev/warden-panel";
import { loadAgentTypes as loadAgentTypesDefault } from "../agent-types.ts";
import type { AgentManager } from "../agent-manager.ts";
import type { AgentActivitySnapshot } from "./agent-widget.ts";
import type { AgentTypeConfig, AgentTypeRegistry } from "../types.ts";

export const SUBAGENTS_PANE_ID = "subagents";
export const AGENTS_COMMAND = "agents";
export const WARDEN_AGENTS_COMMAND = "warden:agents";

export type SubagentsPaneSnapshot = {
	readonly activity: AgentActivitySnapshot;
	readonly registry: AgentTypeRegistry;
};

type SnapshotReader = () => SubagentsPaneSnapshot;

type SubagentsPanelManager = Pick<AgentManager, "getActivitySnapshot">;

type LoadAgentTypes = typeof loadAgentTypesDefault;

type OpenWardenPanelLike = (
	pi: ExtensionAPI | undefined,
	ctx: ExtensionCommandContext,
	options: ShowWardenPanelOptions,
) => Promise<void>;

export type CreateSubagentsCommandHandlerOptions = {
	readonly pi?: ExtensionAPI;
	readonly manager: SubagentsPanelManager;
	readonly loadAgentTypes?: LoadAgentTypes;
	readonly openPanel?: OpenWardenPanelLike;
	readonly commandLabel?: `/${string}`;
};

const emptySnapshot: SubagentsPaneSnapshot = {
	activity: { running: [], queued: [], queuedCount: 0 },
	registry: { agents: [], diagnostics: [] },
};

let cachedSnapshot: SubagentsPaneSnapshot = emptySnapshot;

export function getSubagentsPaneSnapshot(): SubagentsPaneSnapshot {
	return cachedSnapshot;
}

export function setSubagentsPaneSnapshot(
	snapshot: SubagentsPaneSnapshot,
): void {
	cachedSnapshot = snapshot;
}

export function buildSubagentsPaneSnapshot(input: {
	readonly activity: AgentActivitySnapshot;
	readonly registry: AgentTypeRegistry;
}): SubagentsPaneSnapshot {
	return {
		activity: {
			running: [...input.activity.running],
			queued: [...input.activity.queued],
			queuedCount: input.activity.queuedCount,
		},
		registry: {
			agents: [...input.registry.agents],
			diagnostics: [...input.registry.diagnostics],
		},
	};
}

export function createSubagentsPane(
	readSnapshot: SnapshotReader = getSubagentsPaneSnapshot,
): WardenPanelPane {
	return {
		id: SUBAGENTS_PANE_ID,
		label: "Subagents",
		order: 20,
		command: WARDEN_AGENTS_COMMAND,
		showApplyControl: false,
		footerHint: "Read-only • Admin actions deferred • Esc close",
		itemCount: () => 0,
		render(ctx, width, active) {
			return renderSubagentsPane(readSnapshot(), ctx, width, active);
		},
		handleInput: () => false,
	};
}

export function registerSubagentsPane(): void {
	if (getWardenPane(SUBAGENTS_PANE_ID)) return;
	contributeWardenPane(createSubagentsPane());
}

export function registerSubagentsCommands(
	pi: ExtensionAPI,
	manager: SubagentsPanelManager,
): void {
	pi.registerCommand(AGENTS_COMMAND, {
		description: "Open Warden subagents",
		handler: createSubagentsCommandHandler({
			pi,
			manager,
			commandLabel: "/agents",
		}),
	});
	pi.registerCommand(WARDEN_AGENTS_COMMAND, {
		description: "Open Warden subagents",
		handler: createSubagentsCommandHandler({
			pi,
			manager,
			commandLabel: "/warden:agents",
		}),
	});
}

export function createSubagentsCommandHandler(
	options: CreateSubagentsCommandHandlerOptions,
) {
	const loadAgentTypes = options.loadAgentTypes ?? loadAgentTypesDefault;
	const openPanel = options.openPanel ?? openDefaultPanel;
	return async (
		_args: unknown,
		ctx: ExtensionCommandContext,
	): Promise<void> => {
		if (!ctx.hasUI) {
			ctx.ui.notify(
				`${options.commandLabel ?? "/agents"} requires interactive mode`,
				"error",
			);
			return;
		}
		const registry = loadAgentTypes({ cwd: ctx.cwd });
		setSubagentsPaneSnapshot(
			buildSubagentsPaneSnapshot({
				activity: options.manager.getActivitySnapshot(),
				registry,
			}),
		);
		await openPanel(options.pi, ctx, { initialPaneId: SUBAGENTS_PANE_ID });
	};
}

async function openDefaultPanel(
	pi: ExtensionAPI | undefined,
	ctx: ExtensionCommandContext,
	options: ShowWardenPanelOptions,
): Promise<void> {
	await openWardenPanel(
		pi as unknown as Parameters<typeof openWardenPanel>[0],
		ctx as unknown as Parameters<typeof openWardenPanel>[1],
		options,
	);
}

export function renderSubagentsPane(
	snapshot: SubagentsPaneSnapshot,
	ctx: WardenPanelPaneContext,
	_width: number,
	_active: boolean,
): string[] {
	const lines: string[] = [];
	lines.push(ctx.theme.bold(ctx.theme.fg("text", "Active background agents")));
	appendActivityLines(lines, snapshot.activity, ctx);
	lines.push("");
	lines.push(ctx.theme.bold(ctx.theme.fg("text", "Agent types")));
	appendAgentTypeLines(lines, snapshot.registry.agents, ctx);
	appendDiagnosticsLine(lines, snapshot.registry, ctx);
	lines.push("");
	lines.push(ctx.theme.fg("muted", "Admin actions deferred."));
	return lines;
}

function appendActivityLines(
	lines: string[],
	activity: AgentActivitySnapshot,
	ctx: WardenPanelPaneContext,
): void {
	if (activity.running.length === 0 && activity.queued.length === 0) {
		lines.push(
			ctx.theme.fg("muted", "No queued or running background agents."),
		);
		return;
	}
	if (activity.running.length > 0) {
		lines.push(ctx.theme.fg("text", `Running (${activity.running.length})`));
		for (const item of activity.running)
			lines.push(formatActivityItem(item, ctx));
	}
	if (activity.queued.length > 0) {
		lines.push(ctx.theme.fg("text", `Queued (${activity.queued.length})`));
		for (const item of activity.queued)
			lines.push(formatActivityItem(item, ctx));
	}
}

function formatActivityItem(
	item: AgentActivitySnapshot["running"][number],
	ctx: WardenPanelPaneContext,
): string {
	const description = item.description ? ` — ${item.description}` : "";
	const activity = item.currentActivity ? ` (${item.currentActivity})` : "";
	return ctx.theme.fg(
		"text",
		`  ${item.agentId} [${item.status}] ${item.agentType}${description}${activity}`,
	);
}

function appendAgentTypeLines(
	lines: string[],
	agents: readonly AgentTypeConfig[],
	ctx: WardenPanelPaneContext,
): void {
	if (agents.length === 0) {
		lines.push(ctx.theme.fg("muted", "No agent types loaded."));
		return;
	}
	for (const agent of agents) lines.push(formatAgentType(agent, ctx));
}

function formatAgentType(
	agent: AgentTypeConfig,
	ctx: WardenPanelPaneContext,
): string {
	const label = agent.displayName || agent.name || agent.type;
	const status = agent.enabled ? agent.source : `${agent.source}, disabled`;
	const description = agent.description ? ` — ${agent.description}` : "";
	return ctx.theme.fg(
		"text",
		`  ${label} (${agent.type}) [${status}]${description}`,
	);
}

function appendDiagnosticsLine(
	lines: string[],
	registry: AgentTypeRegistry,
	ctx: WardenPanelPaneContext,
): void {
	if (registry.diagnostics.length === 0) return;
	const first = registry.diagnostics[0];
	lines.push(
		ctx.theme.fg(
			"muted",
			`Diagnostics: ${registry.diagnostics.length} — ${first.message}`,
		),
	);
}
