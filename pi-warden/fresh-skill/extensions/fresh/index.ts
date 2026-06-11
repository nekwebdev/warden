import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
	getFreshSkillCompletions,
	handleFreshCommand,
} from "../../src/index.ts";

export default function freshSkillExtension(pi: ExtensionAPI): void {
	pi.registerCommand("fresh", {
		description: "Start a clean session and replay a loaded skill",
		getArgumentCompletions: (prefix) =>
			getFreshSkillCompletions(pi.getCommands(), prefix),
		handler: async (args, ctx) => {
			await handleFreshCommand(pi, args, ctx);
		},
	});
}
