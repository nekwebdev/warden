import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import wardenDisplay from "./extensions/warden-display/index.js";
import wardenPackages from "./extensions/warden-packages/index.js";
import wardenPanelCommands from "./extensions/warden-panel/index.js";

export * from "./src/index.js";

export default function wardenPanel(pi: ExtensionAPI): void {
	wardenPanelCommands(pi);
	wardenDisplay(pi);
	wardenPackages(pi);
}
