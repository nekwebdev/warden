import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { openWardenPanel } from "../../src/commands.js";
import {
	DISPLAY_COMMAND,
	DISPLAY_PANE_ID,
	registerDisplayPane,
} from "./pane.js";

export {
	DISPLAY_COMMAND,
	DISPLAY_PANE_ID,
	createDisplayPane,
	registerDisplayPane,
} from "./pane.js";

export default function wardenDisplay(pi: ExtensionAPI): void {
	registerDisplayPane();
	pi.registerCommand(DISPLAY_COMMAND, {
		description: "Open Warden display settings",
		handler: async (_args, ctx) => {
			await openWardenPanel(pi, ctx, { initialPaneId: DISPLAY_PANE_ID });
		},
	});
}
