import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerWardenPanelCommands } from "./commands.js";
import { registerSettingsPane } from "./panes/settings.js";

export type {
	WardenPanelPane,
	WardenPanelPaneAction,
	WardenPanelPaneActionContext,
	WardenPanelPaneActionHandler,
	WardenPanelPaneContext,
	WardenPanelPaneInputResult,
	WardenPanelTheme,
} from "./registry.js";
export {
	contributeWardenPane,
	contributeWardenPaneActionHandler,
	getWardenPane,
	getWardenPanes,
	handleWardenPaneAction,
} from "./registry.js";
export type {
	ShowWardenPanelOptions,
	WardenPanelResult,
	WardenPanelUI,
} from "./panel.js";
export { formatWardenPanelResult, showWardenPanel } from "./panel.js";
export { registerSettingsPane, SETTINGS_PANE_ID } from "./panes/settings.js";
export type { WardenSettings } from "./settings.js";

export default function wardenPanel(pi: ExtensionAPI): void {
	registerSettingsPane();
	registerWardenPanelCommands(pi);
}
