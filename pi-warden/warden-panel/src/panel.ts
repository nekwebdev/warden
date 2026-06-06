import { runWardenPanelSession } from "./panel-session.js";
import type {
	ShowWardenPanelOptions,
	WardenPanelResult,
	WardenPanelUI,
} from "./panel-types.js";
import {
	formatPiAgentSettingsError,
	getWardenSettings,
	readPiAgentSettings,
} from "./settings.js";
import { getWardenPanes } from "./registry.js";

export type {
	ShowWardenPanelOptions,
	WardenPanelResult,
	WardenPanelUI,
} from "./panel-types.js";

export function showWardenPanel(
	ui: WardenPanelUI,
	options: ShowWardenPanelOptions = {},
): Promise<WardenPanelResult> {
	const settingsResult = readPiAgentSettings();
	if (!settingsResult.ok) {
		return Promise.resolve({
			action: "settings-error",
			settingsError: settingsResult,
		});
	}

	return Promise.resolve(
		runWardenPanelSession(
			ui,
			getWardenSettings(settingsResult.settings),
			getWardenPanes(),
			options,
		),
	);
}

export function formatWardenPanelResult(result: WardenPanelResult): string {
	if (result.action === "applied") return "Warden settings saved.";
	if (result.action === "settings-error") {
		return `Warden settings error: ${formatPiAgentSettingsError(result.settingsError)}`;
	}
	if (result.action === "pane-action") {
		return `Warden pane action: ${result.paneId}.${result.paneAction.action}`;
	}
	return "Warden panel closed.";
}
