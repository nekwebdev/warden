import {
	writeWardenSettings,
	type WardenSettings,
} from "../../src/settings.js";
import {
	contributeWardenPane,
	getWardenDisplaySettings,
	hasWardenPane,
	type WardenDisplaySettingContribution,
	type WardenPanelPane,
	type WardenPanelPaneContext,
} from "../../src/registry.js";

export const DISPLAY_PANE_ID = "display";
export const DISPLAY_COMMAND = "warden:display";

const NERD_GLYPHS_SETTING_ID = "use-nerd-glyphs";

export function createDisplayPane(): WardenPanelPane {
	return {
		id: DISPLAY_PANE_ID,
		label: "Display",
		order: 0,
		command: DISPLAY_COMMAND,
		showApplyControl: false,
		itemCount: (ctx) =>
			displaySettings().reduce(
				(count, setting) => count + setting.itemCount(ctx),
				0,
			),
		render(ctx, width, activePane) {
			return renderDisplaySettings(displaySettings(), ctx, width, {
				activePane,
			});
		},
		handleInput(data, ctx) {
			if (!isActivation(data)) return false;
			return handleSelectedDisplaySetting(displaySettings(), data, ctx);
		},
	};
}

export function registerDisplayPane(): void {
	if (hasWardenPane(DISPLAY_PANE_ID)) return;
	contributeWardenPane(createDisplayPane());
}

function displaySettings(): WardenDisplaySettingContribution[] {
	return [createNerdGlyphsSetting(), ...getWardenDisplaySettings()];
}

function renderDisplaySettings(
	settings: WardenDisplaySettingContribution[],
	ctx: WardenPanelPaneContext,
	width: number,
	activity: { readonly activePane: boolean },
): string[] {
	return displaySettingSelections(settings, ctx).flatMap((selection) =>
		selection.setting.render(
			contextWithSelectedIndex(ctx, selection.selectedIndex),
			width,
			activity.activePane && selection.active,
		),
	);
}

function handleSelectedDisplaySetting(
	settings: WardenDisplaySettingContribution[],
	data: string,
	ctx: WardenPanelPaneContext,
): ReturnType<NonNullable<WardenDisplaySettingContribution["handleInput"]>> {
	const selection = displaySettingSelections(settings, ctx).find(
		(item) => item.active,
	);
	if (!selection) return false;
	return handleDisplaySettingInput(
		selection.setting,
		data,
		contextWithSelectedIndex(ctx, selection.selectedIndex),
	);
}

function displaySettingSelections(
	settings: WardenDisplaySettingContribution[],
	ctx: WardenPanelPaneContext,
): Array<{
	readonly setting: WardenDisplaySettingContribution;
	readonly selectedIndex: number;
	readonly active: boolean;
}> {
	let offset = 0;
	return settings.map((setting) => {
		const itemCount = setting.itemCount(ctx);
		const selectedIndex = ctx.selectedIndex - offset;
		const active = selectedIndex >= 0 && selectedIndex < itemCount;
		offset += itemCount;
		return { setting, selectedIndex, active };
	});
}

function createNerdGlyphsSetting(): WardenDisplaySettingContribution {
	return {
		id: NERD_GLYPHS_SETTING_ID,
		order: 0,
		itemCount: () => 1,
		render(ctx, _width, active) {
			const mark =
				ctx.draftSettings.useNerdGlyphs === true
					? ctx.glyphs.checkboxOn
					: ctx.glyphs.checkboxOff;
			return [
				renderSelectableRow(
					`${mark} Use Nerd Glyphs, requires compatible Nerd font`,
					active && ctx.selectedIndex === 0,
					ctx,
				),
			];
		},
		handleInput(_data, ctx) {
			if (ctx.selectedIndex !== 0) return false;
			ctx.updateDraftSettings({
				useNerdGlyphs: ctx.draftSettings.useNerdGlyphs !== true,
			});
			ctx.requestRender();
			return true;
		},
	};
}

export function renderSelectableRow(
	text: string,
	active: boolean,
	ctx: WardenPanelPaneContext,
): string {
	const prefix = active
		? ctx.theme.bold(ctx.theme.fg("text", ctx.glyphs.pointer))
		: "  ";
	const row = `${prefix}${text}`;
	return active
		? ctx.theme.bold(ctx.theme.fg("text", row))
		: ctx.theme.fg("text", row);
}

function handleDisplaySettingInput(
	setting: WardenDisplaySettingContribution,
	data: string,
	ctx: WardenPanelPaneContext,
): ReturnType<NonNullable<WardenDisplaySettingContribution["handleInput"]>> {
	let nextSettings = ctx.draftSettings;
	const inlineCtx: WardenPanelPaneContext = {
		...ctx,
		get draftSettings() {
			return nextSettings;
		},
		updateDraftSettings(patch) {
			nextSettings = mergeWardenSettings(nextSettings, patch);
		},
		requestRender() {},
	};
	const result = setting.handleInput?.(data, inlineCtx);
	if (result !== true) return result;
	const writeResult = writeWardenSettings(nextSettings);
	if (!writeResult.ok) return false;
	ctx.updateDraftSettings(nextSettings);
	ctx.requestRender();
	return true;
}

function contextWithSelectedIndex(
	ctx: WardenPanelPaneContext,
	selectedIndex: number,
): WardenPanelPaneContext {
	return { ...ctx, selectedIndex };
}

function isActivation(data: string): boolean {
	return data === " " || data === "\r" || data === "\n";
}

export function mergeWardenSettings(
	settings: WardenSettings,
	patch: WardenSettings,
): WardenSettings {
	return {
		...settings,
		...patch,
		...(patch.effort
			? { effort: { ...settings.effort, ...patch.effort } }
			: {}),
	};
}
