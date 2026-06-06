import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
	contributeWardenPane,
	getWardenPane,
	openWardenPanel,
	type WardenPanelPane,
	type WardenPanelPaneContext,
} from "@nekwebdev/warden-panel";
import {
	cycleWardenEffortLevel,
	readWardenSkillEffortEntries,
	resolveWardenSkillEffort,
	seedWardenEffortDefaults,
	setWardenSkillEffort,
	type WardenEffortLevel,
	type WardenSkillEffortEntry,
} from "../../src/effort.js";

export const EFFORT_PANE_ID = "effort";
export const EFFORT_COMMAND = "warden:effort";
export const EFFORT_FOOTER_HINT =
	"↑↓ navigate • Space/Enter cycle effort • Tab/Shift+Tab pane • Esc close";
export const WARDEN_SKILL_STATUS_KEY = "warden-flow.skill";

type WardenStatusTheme = ExtensionContext["ui"]["theme"];
type WardenThemeColor = Parameters<WardenStatusTheme["fg"]>[0];

const EFFORT_STATUS_COLORS = {
	off: "thinkingOff",
	minimal: "thinkingMinimal",
	low: "thinkingLow",
	medium: "thinkingMedium",
	high: "thinkingHigh",
	xhigh: "thinkingXhigh",
} as const satisfies Record<WardenEffortLevel, WardenThemeColor>;

type WardenSkillRuntime = {
	readonly skillName: string;
	readonly effort: WardenEffortLevel;
};

export function renderWardenSkillStatus(
	skillName: string,
	effort: WardenEffortLevel,
	theme: WardenStatusTheme,
): string {
	return [
		" ",
		theme.fg("customMessageLabel", "skill"),
		theme.fg("dim", " "),
		theme.fg("text", skillName),
		theme.fg("dim", " · "),
		theme.fg("muted", "effort "),
		theme.fg(EFFORT_STATUS_COLORS[effort], effort),
		" ",
	].join("");
}

export function createEffortPane(): WardenPanelPane {
	return {
		id: EFFORT_PANE_ID,
		label: "Effort",
		order: 20,
		command: EFFORT_COMMAND,
		showApplyControl: false,
		footerHint: EFFORT_FOOTER_HINT,
		itemCount: () => readWardenSkillEffortEntries().length,
		render: (ctx, _width, activePane) => {
			const entries = readWardenSkillEffortEntries();
			if (entries.length === 0)
				return [ctx.theme.fg("muted", "No Warden effort settings configured.")];
			return entries.map((entry, index) =>
				renderEffortRow(entry, activePane && ctx.selectedIndex === index, ctx),
			);
		},
		handleInput: (data, ctx) => {
			if (!isActivation(data)) return false;
			const entry = readWardenSkillEffortEntries()[ctx.selectedIndex];
			if (!entry) return false;
			const result = setWardenSkillEffort(
				entry.skillName,
				cycleWardenEffortLevel(entry.effort),
			);
			if (!result.ok) return false;
			ctx.requestRender();
			return true;
		},
	};
}

export function registerWardenEffort(pi: ExtensionAPI): void {
	let restoreLevel: { readonly level: WardenEffortLevel } | undefined;
	let pendingSkillRuntime: WardenSkillRuntime | undefined;
	let skillStatusActive = false;
	const canSetStatus = (
		ctx: ExtensionContext | undefined,
	): ctx is ExtensionContext => ctx?.ui !== undefined && ctx.hasUI !== false;
	const applySkillEffort = (runtime: WardenSkillRuntime): void => {
		if (!restoreLevel) {
			restoreLevel = { level: pi.getThinkingLevel() as WardenEffortLevel };
		}
		pi.setThinkingLevel(runtime.effort);
	};
	const showSkillStatus = (
		ctx: ExtensionContext | undefined,
		runtime: WardenSkillRuntime,
	): void => {
		if (!canSetStatus(ctx)) return;
		ctx.ui.setStatus(
			WARDEN_SKILL_STATUS_KEY,
			renderWardenSkillStatus(runtime.skillName, runtime.effort, ctx.ui.theme),
		);
		skillStatusActive = true;
	};
	const restoreSkillRuntime = (ctx?: ExtensionContext) => {
		if (restoreLevel) {
			pi.setThinkingLevel(restoreLevel.level);
			restoreLevel = undefined;
		}
		pendingSkillRuntime = undefined;
		if (skillStatusActive && canSetStatus(ctx)) {
			ctx.ui.setStatus(WARDEN_SKILL_STATUS_KEY, undefined);
		}
		skillStatusActive = false;
	};

	if (!getWardenPane(EFFORT_PANE_ID)) contributeWardenPane(createEffortPane());
	pi.registerCommand(EFFORT_COMMAND, {
		description: "Configure Warden skill effort levels",
		handler: async (_args, ctx) => {
			await openWardenPanel(pi, ctx, { initialPaneId: EFFORT_PANE_ID });
		},
	});
	pi.on("session_start", () => {
		seedWardenEffortDefaults();
	});
	pi.on("input", (event) => {
		const runtime = wardenSkillRuntimeFromText(event.text);
		if (!runtime) return undefined;
		pendingSkillRuntime = runtime;
		if (!event.streamingBehavior) applySkillEffort(runtime);
		return { action: "continue" } as const;
	});
	pi.on("before_agent_start", (event, ctx) => {
		const runtime =
			pendingSkillRuntime ?? wardenSkillRuntimeFromText(event.prompt);
		if (!runtime) return undefined;
		applySkillEffort(runtime);
		pendingSkillRuntime = undefined;
		showSkillStatus(ctx, runtime);
		return undefined;
	});
	pi.on("agent_end", (_event, ctx) => restoreSkillRuntime(ctx));
	pi.on("session_shutdown", (_event, ctx) => restoreSkillRuntime(ctx));
}

export default function wardenEffort(pi: ExtensionAPI): void {
	registerWardenEffort(pi);
}

function renderEffortRow(
	entry: WardenSkillEffortEntry,
	active: boolean,
	ctx: WardenPanelPaneContext,
): string {
	const pointer = active
		? ctx.theme.bold(ctx.theme.fg("text", ctx.glyphs.pointer))
		: "  ";
	const row = `${pointer}${entry.skillName}: ${entry.effort}`;
	return active
		? ctx.theme.bold(ctx.theme.fg("text", row))
		: ctx.theme.fg("text", row);
}

function isActivation(data: string): boolean {
	return data === " " || data === "\r" || data === "\n";
}

function wardenSkillRuntimeFromText(
	text: string,
): WardenSkillRuntime | undefined {
	const skillName = wardenSkillNameFromText(text);
	if (!skillName) return undefined;
	const effort = resolveWardenSkillEffort(skillName);
	return effort ? { skillName, effort } : undefined;
}

function wardenSkillNameFromText(text: string): string | undefined {
	const trimmed = text.trimStart();
	return (
		trimmed.match(/^\/skill:(warden-\S*)/)?.[1] ??
		trimmed.match(/^<skill name="(warden-[^"]+)"/)?.[1]
	);
}
