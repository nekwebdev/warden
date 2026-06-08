import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const WARDEN_SUBAGENTS_PACKAGE = "@nekwebdev/warden-subagents";

export function wardenSubagents(_pi: ExtensionAPI): void {
	// Scaffold slice only: no Pi API access, registrations, or runtime behavior.
}

export default wardenSubagents;
