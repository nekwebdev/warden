import type { WardenSettings } from "../settings.js";
import {
	contributeWardenPane,
	hasWardenPane,
	type WardenPanelPane,
} from "../registry.js";

export const SETTINGS_PANE_ID = "settings";
export const SETTINGS_COMMAND = "warden:settings";

export function createSettingsPane(): WardenPanelPane {
	return {
		id: SETTINGS_PANE_ID,
		label: "Settings",
		order: 0,
		command: SETTINGS_COMMAND,
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

export function registerSettingsPane(): void {
	if (hasWardenPane(SETTINGS_PANE_ID)) return;
	contributeWardenPane(createSettingsPane());
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
