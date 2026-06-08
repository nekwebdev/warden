import type { AgentThinkingLevel, AgentTypeConfig } from "./types.ts";

export interface ForegroundAgentParams {
	subagent_type?: string;
	prompt: string;
	description?: string;
	model?: string;
	thinking?: AgentThinkingLevel;
	max_turns?: number;
	run_in_background?: boolean;
	resume?: string;
	isolated?: boolean;
	inherit_context?: boolean;
	isolation?: string;
}

export interface ForegroundInvocation {
	agent: AgentTypeConfig;
	prompt: string;
	description?: string;
	modelRequest?: string;
	thinking?: AgentThinkingLevel;
	maxTurns?: number;
	inheritContext: boolean;
}

export interface MaxTurnPlan {
	limit?: number;
	graceTurns: number;
}

export function resolveForegroundInvocation(options: {
	agent: AgentTypeConfig;
	params: ForegroundAgentParams;
}): ForegroundInvocation {
	return {
		agent: options.agent,
		prompt: options.params.prompt,
		description: options.params.description,
		modelRequest: options.agent.model ?? options.params.model,
		thinking: options.agent.thinking ?? options.params.thinking,
		maxTurns: options.agent.maxTurns ?? options.params.max_turns,
		inheritContext:
			options.agent.inheritContext || options.params.inherit_context === true,
	};
}

export function normalizeMaxTurns(maxTurns?: number): MaxTurnPlan {
	const limit =
		typeof maxTurns === "number" && Number.isInteger(maxTurns) && maxTurns > 0
			? maxTurns
			: undefined;
	return {
		limit,
		graceTurns: 3,
	};
}
