import type { AgentPromptMode } from "./types.ts";

export interface BuildAgentSystemPromptOptions {
	agentPrompt: string;
	promptMode: AgentPromptMode;
	parentSystemPrompt?: string;
}

export function buildAgentSystemPrompt(
	options: BuildAgentSystemPromptOptions,
): string {
	const agentPrompt = options.agentPrompt.trim();
	if (options.promptMode === "replace") return agentPrompt;

	const parent = options.parentSystemPrompt?.trim();
	if (!parent) return agentPrompt;
	return `${agentPrompt}\n\n## Parent Prompt Bridge\n${parent}`;
}
