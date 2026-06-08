import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { wardenSubagentsRegister } from "../../src/agent-runner.ts";

export const WARDEN_SUBAGENTS_PACKAGE = "@nekwebdev/warden-subagents";

export function wardenSubagents(pi: ExtensionAPI): void {
	wardenSubagentsRegister(pi);
}

export default wardenSubagents;
