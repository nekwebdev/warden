import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	contributeWardenDisplaySetting,
	contributeWardenPaneActionHandler,
	hasWardenDisplaySetting,
	type WardenPanelPaneAction,
	type WardenPanelPaneContext,
} from "@nekwebdev/warden-panel";
import {
	applyPacketTrackerUpdate,
	loadActiveFlowStatus,
	parsePacketName,
	parsePacketPath,
	parsePacketStatus,
	type PacketTrackerStep,
} from "../../src/packet-tracker.js";
import {
	readWardenActiveFlowStatusEnabled,
	setWardenActiveFlowStatusEnabled,
} from "../../src/effort.js";

type InputEvent = {
	readonly text?: string;
	readonly source?: string;
};

type BeforeAgentStartEvent = {
	readonly prompt?: string;
};

type AgentEndEvent = {
	readonly messages?: unknown[];
};

type PacketTrackerContext = {
	readonly cwd?: string;
	readonly hasUI?: boolean;
	readonly ui?: {
		select?: (prompt: string, options: string[]) => Promise<string | undefined>;
		setStatus?: (key: string, text: string | undefined) => void;
	};
};

type PendingInvocation = {
	readonly step: PacketTrackerStep;
	readonly packetPath?: string;
};

type ActiveFlowSettings = {
	readonly showActiveFlowStatus?: boolean;
	readonly [key: string]: unknown;
};

export interface WardenPacketTrackerOptions {
	readonly now?: () => string;
}

export const ACTIVE_FLOW_STATUS_KEY = "warden-flow.active-flow";
export const ACTIVE_FLOW_DISPLAY_SETTING_ID = "warden-flow.active-flow-status";
export const ACTIVE_FLOW_DISPLAY_SETTING_LABEL = "Show active flow status";

const DISPLAY_PANE_ID = "display";
const ACTIVE_FLOW_STATUS_REFRESH_ACTION = "refresh-active-flow-status";

const ALLOWLISTED_STEPS = new Set<PacketTrackerStep>([
	"warden-start",
	"warden-grill",
	"warden-tdd",
	"warden-close",
]);

export function registerWardenPacketTracker(
	pi: ExtensionAPI,
	options: WardenPacketTrackerOptions = {},
): void {
	let pendingInvocation: PendingInvocation | undefined;
	const now = options.now ?? (() => new Date().toISOString());

	registerActiveFlowDisplaySetting();

	function clearPending(): void {
		pendingInvocation = undefined;
	}

	pi.on("input", (event: InputEvent) => {
		if (event.source === "extension") return { action: "continue" } as const;
		const invocation = parseSkillInvocation(event.text ?? "");
		if (invocation) pendingInvocation = invocation;
		return { action: "continue" } as const;
	});

	pi.on("before_agent_start", (event: BeforeAgentStartEvent) => {
		const invocation = parseSkillInvocation(event.prompt ?? "");
		if (invocation) pendingInvocation = invocation;
		return undefined;
	});

	pi.on(
		"agent_end",
		async (event: AgentEndEvent, ctx: PacketTrackerContext) => {
			const invocation = pendingInvocation;
			clearPending();
			if (!invocation) return undefined;

			const output = assistantOutput(event.messages ?? []);
			const status = parsePacketStatus(output);
			if (!status) return undefined;

			const nextStepChoice =
				invocation.step === "warden-tdd" && status === "success"
					? await promptForTddNextStep(ctx)
					: undefined;
			applyPacketTrackerUpdate({
				cwd: ctx.cwd ?? process.cwd(),
				step: invocation.step,
				status,
				packetPath: parsePacketPath(output) ?? invocation.packetPath,
				packetName: parsePacketName(output),
				output,
				nextStepChoice,
				now: now(),
			});
			refreshActiveFlowStatus(ctx);
			return undefined;
		},
	);

	pi.on("session_start", (_event, ctx: PacketTrackerContext) => {
		refreshActiveFlowStatus(ctx);
	});
	pi.on("session_shutdown", clearPending);
}

export default function wardenPacketTracker(pi: ExtensionAPI): void {
	registerWardenPacketTracker(pi);
}

export function refreshActiveFlowStatus(ctx: PacketTrackerContext): void {
	if (!canSetStatus(ctx)) return;
	if (!readWardenActiveFlowStatusEnabled()) {
		ctx.ui.setStatus(ACTIVE_FLOW_STATUS_KEY, undefined);
		return;
	}
	ctx.ui.setStatus(
		ACTIVE_FLOW_STATUS_KEY,
		loadActiveFlowStatus(ctx.cwd ?? process.cwd()).text,
	);
}

function registerActiveFlowDisplaySetting(): void {
	if (!hasWardenDisplaySetting(ACTIVE_FLOW_DISPLAY_SETTING_ID)) {
		contributeWardenDisplaySetting(createActiveFlowDisplaySetting());
	}
	contributeWardenPaneActionHandler(DISPLAY_PANE_ID, async (action, ctx) => {
		if (!isActiveFlowRefreshAction(action)) return;
		refreshActiveFlowStatus(ctx.commandContext);
	});
}

function createActiveFlowDisplaySetting() {
	return {
		id: ACTIVE_FLOW_DISPLAY_SETTING_ID,
		order: 10,
		itemCount: () => 1,
		render: (ctx: WardenPanelPaneContext, _width: number, active: boolean) => [
			renderActiveFlowSettingRow(
				wardenFlowSettings(ctx.draftSettings).showActiveFlowStatus !== false,
				active && ctx.selectedIndex === 0,
				ctx,
			),
			"",
		],
		handleInput: (_data: string, ctx: WardenPanelPaneContext) => {
			if (ctx.selectedIndex !== 0) return false;
			const currentFlow = wardenFlowSettings(ctx.draftSettings);
			const enabled = currentFlow.showActiveFlowStatus === false;
			const result = setWardenActiveFlowStatusEnabled(enabled);
			if (!result.ok) return false;
			ctx.updateDraftSettings({
				flow: {
					...currentFlow,
					showActiveFlowStatus: enabled,
				},
			});
			return { action: ACTIVE_FLOW_STATUS_REFRESH_ACTION };
		},
	};
}

function wardenFlowSettings(
	settings: WardenPanelPaneContext["draftSettings"],
): ActiveFlowSettings {
	const flow = (settings as { readonly flow?: unknown }).flow;
	return isPlainObject(flow) ? flow : {};
}

function renderActiveFlowSettingRow(
	enabled: boolean,
	active: boolean,
	ctx: WardenPanelPaneContext,
): string {
	const mark = enabled ? ctx.glyphs.checkboxOn : ctx.glyphs.checkboxOff;
	return renderSelectableRow(
		`${mark} ${ACTIVE_FLOW_DISPLAY_SETTING_LABEL}`,
		active,
		ctx,
	);
}

function renderSelectableRow(
	text: string,
	active: boolean,
	ctx: WardenPanelPaneContext,
): string {
	const pointer = active
		? ctx.theme.bold(ctx.theme.fg("text", ctx.glyphs.pointer))
		: "  ";
	const row = `${pointer}${text}`;
	return active
		? ctx.theme.bold(ctx.theme.fg("text", row))
		: ctx.theme.fg("text", row);
}

function isActiveFlowRefreshAction(action: WardenPanelPaneAction): boolean {
	return action.action === ACTIVE_FLOW_STATUS_REFRESH_ACTION;
}

function canSetStatus(
	ctx: PacketTrackerContext,
): ctx is PacketTrackerContext & {
	readonly ui: {
		readonly setStatus: (key: string, text: string | undefined) => void;
	};
} {
	return ctx.hasUI !== false && typeof ctx.ui?.setStatus === "function";
}

export function parseSkillInvocation(
	text: string,
): PendingInvocation | undefined {
	const slash = text
		.trimStart()
		.match(
			/^\/skill:(warden-start|warden-grill|warden-tdd|warden-close)(?:\s+([\s\S]*))?$/,
		);
	if (slash) return invocationFromParts(slash[1], slash[2] ?? "");

	const expanded = text.match(
		/^<skill\s+name="(warden-start|warden-grill|warden-tdd|warden-close)"[^>]*>[\s\S]*?<\/skill>([\s\S]*)$/,
	);
	if (expanded) return invocationFromParts(expanded[1], expanded[2] ?? "");

	return undefined;
}

function invocationFromParts(
	step: string | undefined,
	argumentsText: string,
): PendingInvocation | undefined {
	if (!isAllowlistedStep(step)) return undefined;
	return { step, packetPath: packetPathFromText(argumentsText) };
}

function packetPathFromText(text: string): string | undefined {
	const matches = [
		...text.matchAll(/(?:^|\s)([^\s`'"<>]*packet\.md)(?=$|\s|[`'"<>])/g),
	]
		.map((match) => match[1])
		.filter((value): value is string => Boolean(value));
	return matches.find((value) => value.includes(".warden/work/")) ?? matches[0];
}

function assistantOutput(messages: unknown[]): string {
	const assistantMessages = messages
		.map(messageText)
		.filter((item): item is { role: string; text: string } => Boolean(item))
		.filter((item) => item.role === "assistant");
	return assistantMessages.at(-1)?.text ?? "";
}

function messageText(
	message: unknown,
): { role: string; text: string } | undefined {
	if (!isPlainObject(message) || typeof message.role !== "string")
		return undefined;
	const content = message.content;
	if (typeof content === "string") return { role: message.role, text: content };
	if (!Array.isArray(content)) return undefined;
	return {
		role: message.role,
		text: content
			.map((part) =>
				isPlainObject(part) && typeof part.text === "string" ? part.text : "",
			)
			.filter(Boolean)
			.join("\n"),
	};
}

async function promptForTddNextStep(
	ctx: PacketTrackerContext,
): Promise<"warden-grill" | "warden-close" | undefined> {
	if (!ctx.hasUI || !ctx.ui?.select) return undefined;
	try {
		const choice = await ctx.ui.select(
			"Warden TDD finished. Choose packet tracker next step.",
			["warden-grill", "warden-close"],
		);
		return choice === "warden-close" ? "warden-close" : "warden-grill";
	} catch {
		return undefined;
	}
}

function isAllowlistedStep(value: unknown): value is PacketTrackerStep {
	return (
		typeof value === "string" &&
		ALLOWLISTED_STEPS.has(value as PacketTrackerStep)
	);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
