import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
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
	const restoreThinkingLevel = () => {
		if (!restoreLevel) return;
		pi.setThinkingLevel(restoreLevel.level);
		restoreLevel = undefined;
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
		const skillName = wardenSkillNameFromInput(event.text);
		if (!skillName) return undefined;
		const effort = resolveWardenSkillEffort(skillName);
		if (!effort) return undefined;
		if (!restoreLevel) {
			restoreLevel = { level: pi.getThinkingLevel() as WardenEffortLevel };
		}
		pi.setThinkingLevel(effort);
		return { action: "continue" } as const;
	});
	pi.on("agent_end", restoreThinkingLevel);
	pi.on("session_shutdown", restoreThinkingLevel);
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

function wardenSkillNameFromInput(text: string): string | undefined {
	return text.trimStart().match(/^\/skill:(warden-\S*)/)?.[1];
}
