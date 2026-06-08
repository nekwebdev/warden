import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { AgentManager } from "../../src/agent-manager.ts";
import { wardenSubagentsRegister } from "../../src/agent-runner.ts";

export const WARDEN_SUBAGENTS_PACKAGE = "@nekwebdev/warden-subagents";

export function wardenSubagents(pi: ExtensionAPI): void {
	const manager = new AgentManager();
	wardenSubagentsRegister(pi, { manager });
	pi.on("session_shutdown", async () => {
		manager.shutdown();
	});
}

export default wardenSubagents;
