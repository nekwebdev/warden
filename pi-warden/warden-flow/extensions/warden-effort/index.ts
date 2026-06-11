import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
	contributeWardenDisplaySetting,
	contributeWardenPane,
	getWardenPane,
	hasWardenDisplaySetting,
	openWardenPanel,
	type WardenPanelPane,
	type WardenPanelPaneContext,
} from "@nekwebdev/warden-panel";
import {
	cycleWardenEffortLevel,
	readWardenSkillEffortEntries,
	seedWardenEffortDefaults,
	setWardenSkillEffort,
	type WardenEffortLevel,
	type WardenSkillEffortEntry,
} from "../../src/effort.js";
import { createWardenSkillRuntimeController } from "./runtime.js";

export const EFFORT_PANE_ID = "effort";
export const EFFORT_COMMAND = "warden:effort";
export const EFFORT_FOOTER_HINT =
	"↑↓ navigate • Space/Enter cycle effort • Tab/Shift+Tab pane • Esc close";
export const WARDEN_SKILL_STATUS_KEY = "warden-flow.skill";
export const SKILL_STATUS_DISPLAY_SETTING_ID = "warden-flow.skill-status";
export const SKILL_STATUS_SETTING_LABEL = "Show skill status indicator";

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
	const runtime = createWardenSkillRuntimeController(
		pi,
		WARDEN_SKILL_STATUS_KEY,
		renderWardenSkillStatus,
	);
	registerEffortPaneAndDisplaySetting();
	registerEffortCommand(pi);
	pi.on("session_start", () => {
		seedWardenEffortDefaults();
	});
	pi.on("input", (event) =>
		runtime.prepareFromInput(event.text, event.streamingBehavior),
	);
	pi.on("before_agent_start", (event, ctx) =>
		runtime.applyBeforeAgent(event.prompt, ctx),
	);
	pi.on("agent_end", (_event, ctx) => runtime.restore(ctx));
	pi.on("session_shutdown", (_event, ctx) => runtime.restore(ctx));
}

export default function wardenEffort(pi: ExtensionAPI): void {
	registerWardenEffort(pi);
}

function registerEffortPaneAndDisplaySetting(): void {
	if (!getWardenPane(EFFORT_PANE_ID)) contributeWardenPane(createEffortPane());
	if (!hasWardenDisplaySetting(SKILL_STATUS_DISPLAY_SETTING_ID)) {
		contributeWardenDisplaySetting(createSkillStatusDisplaySetting());
	}
}

function registerEffortCommand(pi: ExtensionAPI): void {
	pi.registerCommand(EFFORT_COMMAND, {
		description: "Configure Warden skill effort levels",
		handler: async (_args, ctx) => {
			await openWardenPanel(pi, ctx, { initialPaneId: EFFORT_PANE_ID });
		},
	});
}

function createSkillStatusDisplaySetting() {
	return {
		id: SKILL_STATUS_DISPLAY_SETTING_ID,
		order: 20,
		itemCount: () => 1,
		render: (ctx: WardenPanelPaneContext, _width: number, active: boolean) => [
			renderSkillStatusSettingRow(
				ctx.draftSettings.effort?.showSkillStatus !== false,
				active && ctx.selectedIndex === 0,
				ctx,
			),
			"",
		],
		handleInput: (_data: string, ctx: WardenPanelPaneContext) => {
			ctx.updateDraftSettings({
				effort: {
					...ctx.draftSettings.effort,
					showSkillStatus: ctx.draftSettings.effort?.showSkillStatus === false,
				},
			});
			ctx.requestRender();
			return true;
		},
	};
}

function renderSkillStatusSettingRow(
	enabled: boolean,
	active: boolean,
	ctx: WardenPanelPaneContext,
): string {
	const mark = enabled ? ctx.glyphs.checkboxOn : ctx.glyphs.checkboxOff;
	return renderSelectableRow(
		`${mark} ${SKILL_STATUS_SETTING_LABEL}`,
		active,
		ctx,
	);
}

function renderEffortRow(
	entry: WardenSkillEffortEntry,
	active: boolean,
	ctx: WardenPanelPaneContext,
): string {
	return renderSelectableRow(
		`${entry.skillName}: ${entry.effort}`,
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

function isActivation(data: string): boolean {
	return data === " " || data === "\r" || data === "\n";
}
