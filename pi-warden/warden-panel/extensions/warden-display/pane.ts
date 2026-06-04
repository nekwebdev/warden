import type { WardenSettings } from "../../src/settings.js";
import {
	contributeWardenPane,
	hasWardenPane,
	type WardenPanelPane,
} from "../../src/registry.js";

export const DISPLAY_PANE_ID = "display";
export const DISPLAY_COMMAND = "warden:display";

export function createDisplayPane(): WardenPanelPane {
	return {
		id: DISPLAY_PANE_ID,
		label: "Display",
		order: 0,
		command: DISPLAY_COMMAND,
		itemCount: () => 1,
		render(ctx, _width, activePane) {
			const active = activePane && ctx.selectedIndex === 0;
			const mark =
				ctx.draftSettings.useNerdGlyphs === true
					? ctx.glyphs.checkboxOn
					: ctx.glyphs.checkboxOff;
			const prefix = active
				? ctx.theme.bold(ctx.theme.fg("text", ctx.glyphs.pointer))
				: "  ";
			const row = `${prefix}${mark} Use Nerd Glyphs, requires compatible Nerd font`;
			return [
				active
					? ctx.theme.bold(ctx.theme.fg("text", row))
					: ctx.theme.fg("text", row),
			];
		},
		handleInput(data, ctx) {
			if (ctx.selectedIndex !== 0) return false;
			if (!isActivation(data)) return false;
			ctx.updateDraftSettings({
				useNerdGlyphs: ctx.draftSettings.useNerdGlyphs !== true,
			});
			ctx.requestRender();
			return true;
		},
	};
}

export function registerDisplayPane(): void {
	if (hasWardenPane(DISPLAY_PANE_ID)) return;
	contributeWardenPane(createDisplayPane());
}

function isActivation(data: string): boolean {
	return data === " " || data === "\r" || data === "\n";
}

export function mergeWardenSettings(
	settings: WardenSettings,
	patch: WardenSettings,
): WardenSettings {
	return { ...settings, ...patch };
}
