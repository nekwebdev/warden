import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import {
	formatWardenPanelResult,
	showWardenPanel,
	type ShowWardenPanelOptions,
} from "./panel.js";
import { handleWardenPaneAction } from "./registry.js";

export const WARDEN_COMMAND = "warden";

export function registerWardenPanelCommands(pi: ExtensionAPI): void {
	pi.registerCommand(WARDEN_COMMAND, {
		description: "Open Warden panel",
		handler: async (_args, ctx) => {
			await openWardenPanel(pi, ctx);
		},
	});
}

export async function openWardenPanel(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext,
	options: ShowWardenPanelOptions = {},
): Promise<void> {
	if (!ctx.hasUI) {
		ctx.ui.notify("/warden requires interactive mode", "error");
		return;
	}
	const result = await showWardenPanel(ctx.ui, options);
	if (result.action === "settings-error")
		ctx.ui.notify(formatWardenPanelResult(result), "error");
	else if (result.action === "applied")
		ctx.ui.notify(formatWardenPanelResult(result), "info");
	else if (result.action === "pane-action")
		await handleWardenPaneAction(result.paneId, result.paneAction, {
			pi,
			commandContext: ctx,
		});
}
