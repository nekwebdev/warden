import type { AgentPromptMode } from "./types.ts";

export interface BuildAgentSystemPromptOptions {
	agentPrompt: string;
	promptMode: AgentPromptMode;
	parentSystemPrompt?: string;
	promptExtras?: string[];
}

export function buildAgentSystemPrompt(
	options: BuildAgentSystemPromptOptions,
): string {
	const parts = [
		options.agentPrompt.trim(),
		...(options.promptExtras ?? [])
			.map((extra) => extra.trim())
			.filter(Boolean),
	];
	const agentPrompt = parts.join("\n\n");
	if (options.promptMode === "replace") return agentPrompt;

	const parent = options.parentSystemPrompt?.trim();
	if (!parent) return agentPrompt;
	return `${agentPrompt}\n\n## Parent Prompt Bridge\n${parent}`;
}
