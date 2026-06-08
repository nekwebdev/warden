import { loadCustomAgents } from "./custom-agents.ts";
import { DEFAULT_AGENT_TYPES } from "./default-agents.ts";
import type {
	AgentTypeConfig,
	AgentTypeRegistry,
	AgentTypeResolution,
	LoadAgentTypesOptions,
} from "./types.ts";

function keyFor(name: string): string {
	return name.toLowerCase();
}

function copyAgent(agent: AgentTypeConfig): AgentTypeConfig {
	return {
		...agent,
		extensions: [...agent.extensions],
		skills: [...agent.skills],
		disallowedTools: [...agent.disallowedTools],
		tools:
			agent.tools.kind === "allow"
				? { kind: "allow", selectors: [...agent.tools.selectors] }
				: { ...agent.tools },
	};
}

export function loadAgentTypes(
	options: LoadAgentTypesOptions,
): AgentTypeRegistry {
	const merged = new Map<string, AgentTypeConfig>();
	for (const agent of DEFAULT_AGENT_TYPES) {
		merged.set(keyFor(agent.type), copyAgent(agent));
	}

	const custom = loadCustomAgents(options);
	for (const agent of custom.agents) {
		merged.set(keyFor(agent.type), agent);
	}

	return {
		agents: [...merged.values()],
		diagnostics: custom.diagnostics,
	};
}

export function resolveAgentType(
	registry: AgentTypeRegistry,
	name: string,
): AgentTypeResolution {
	const key = keyFor(name);
	const agent = registry.agents.find(
		(candidate) => keyFor(candidate.type) === key,
	);
	if (!agent) return { status: "unknown", name };
	if (!agent.enabled) return { status: "disabled", name };
	return { status: "found", agent };
}

export { DEFAULT_AGENT_TYPES } from "./default-agents.ts";
export type {
	AgentIsolation,
	AgentPromptMode,
	AgentSource,
	AgentThinkingLevel,
	AgentTypeConfig,
	AgentTypeDiagnostic,
	AgentTypeRegistry,
	AgentTypeResolution,
	BuiltinToolName,
	DiagnosticSeverity,
	LoadAgentTypesOptions,
	ToolPolicy,
	ToolSelector,
} from "./types.ts";
