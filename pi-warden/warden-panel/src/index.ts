import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerWardenPanelCommands } from "./commands.js";
import { registerSettingsPane } from "./panes/settings.js";

export type {
	WardenPanelPane,
	WardenPanelPaneContext,
	WardenPanelTheme,
} from "./registry.js";
export {
	contributeWardenPane,
	getWardenPane,
	getWardenPanes,
} from "./registry.js";
export type { WardenSettings } from "./settings.js";

export default function wardenPanel(pi: ExtensionAPI): void {
	registerSettingsPane();
	registerWardenPanelCommands(pi);
}
