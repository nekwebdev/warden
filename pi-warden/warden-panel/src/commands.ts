import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { SETTINGS_PANE_ID } from "./panes/settings.js";
import { formatWardenPanelResult, showWardenPanel } from "./panel.js";
import { handleWardenPaneAction } from "./registry.js";

export const WARDEN_COMMAND = "warden";
export const WARDEN_SETTINGS_COMMAND = "warden:settings";

export function registerWardenPanelCommands(pi: ExtensionAPI): void {
	const openSettings = async (_args: string, ctx: ExtensionCommandContext) => {
		if (!ctx.hasUI) {
			ctx.ui.notify("/warden requires interactive mode", "error");
			return;
		}
		const result = await showWardenPanel(ctx.ui, {
			initialPaneId: SETTINGS_PANE_ID,
		});
		if (result.action === "settings-error")
			ctx.ui.notify(formatWardenPanelResult(result), "error");
		else if (result.action === "applied")
			ctx.ui.notify(formatWardenPanelResult(result), "info");
		else if (result.action === "pane-action")
			await handleWardenPaneAction(result.paneId, result.paneAction, {
				pi,
				commandContext: ctx,
			});
	};

	pi.registerCommand(WARDEN_COMMAND, {
		description: "Open Warden panel",
		handler: openSettings,
	});
	pi.registerCommand(WARDEN_SETTINGS_COMMAND, {
		description: "Open Warden settings",
		handler: openSettings,
	});
}
