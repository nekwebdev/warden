export type DiagnosticSeverity = "warning" | "error";

export interface AgentTypeDiagnostic {
	severity: DiagnosticSeverity;
	code: string;
	message: string;
	filePath?: string;
	agentName?: string;
}

export type BuiltinToolName =
	| "read"
	| "bash"
	| "edit"
	| "write"
	| "grep"
	| "find"
	| "ls";

export type ToolSelector =
	| { kind: "builtin"; name: BuiltinToolName }
	| { kind: "extension"; extension: string }
	| { kind: "extension-tool"; extension: string; tool: string };

export type ToolPolicy =
	| { kind: "default" }
	| { kind: "all" }
	| { kind: "none" }
	| { kind: "allow"; selectors: ToolSelector[] };

export type AgentIsolation = "standalone" | "parent-twin";
export type AgentPromptMode = "replace" | "append";
export type AgentThinkingLevel =
	| "off"
	| "minimal"
	| "low"
	| "medium"
	| "high"
	| "xhigh";
export type AgentSource = "default" | "global" | "project";

export interface AgentTypeConfig {
	type: string;
	name?: string;
	displayName?: string;
	description: string;
	prompt: string;
	enabled: boolean;
	tools: ToolPolicy;
	extensions: string[];
	skills: string[];
	disallowedTools: ToolSelector[];
	memory: boolean;
	isolation: AgentIsolation;
	inheritContext: boolean;
	promptMode: AgentPromptMode;
	runInBackground: boolean;
	model?: string;
	thinking?: AgentThinkingLevel;
	maxTurns?: number;
	source: AgentSource;
	filePath?: string;
}

export interface AgentTypeRegistry {
	agents: AgentTypeConfig[];
	diagnostics: AgentTypeDiagnostic[];
}

export type AgentTypeResolution =
	| { status: "found"; agent: AgentTypeConfig }
	| { status: "disabled"; name: string }
	| { status: "unknown"; name: string };

export interface LoadAgentTypesOptions {
	cwd: string;
	globalAgentsDir?: string;
	projectAgentsDir?: string;
}
