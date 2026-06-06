import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import type {
	WardenPanelPaneAction,
	WardenPanelPaneContext,
} from "./registry.js";
import type { PiAgentSettingsError, WardenSettings } from "./settings.js";

export type WardenPanelUI = Pick<ExtensionUIContext, "custom">;

export type WardenPanelResult =
	| { readonly action: "close" }
	| { readonly action: "applied"; readonly settings: WardenSettings }
	| {
			readonly action: "settings-error";
			readonly settingsError: PiAgentSettingsError;
	  }
	| {
			readonly action: "pane-action";
			readonly paneId: string;
			readonly paneAction: WardenPanelPaneAction;
	  };

export type ShowWardenPanelOptions = { readonly initialPaneId?: string };

export type PanelControl = "apply";

export type PanelTheme = WardenPanelPaneContext["theme"];
