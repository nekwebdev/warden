import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerWardenPanelCommands } from "../../src/commands.js";

export {
	WARDEN_COMMAND,
	openWardenPanel,
	registerWardenPanelCommands,
} from "../../src/commands.js";

export default function wardenPanel(pi: ExtensionAPI): void {
	registerWardenPanelCommands(pi);
}
