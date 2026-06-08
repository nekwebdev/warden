import type { AgentTypeConfig, ToolSelector } from "./types.ts";

const READ_ONLY_BUILTINS: ToolSelector[] = [
	{ kind: "builtin", name: "read" },
	{ kind: "builtin", name: "grep" },
	{ kind: "builtin", name: "find" },
	{ kind: "builtin", name: "ls" },
];

export const DEFAULT_AGENT_TYPES: AgentTypeConfig[] = [
	{
		type: "general-purpose",
		name: "general-purpose",
		displayName: "General Purpose",
		description: "General Warden helper that mirrors parent context metadata.",
		prompt:
			"You are Warden's general-purpose helper. Continue parent intent with full context awareness while staying inside assigned scope.",
		enabled: true,
		tools: { kind: "all" },
		extensions: [],
		skills: [],
		disallowedTools: [],
		memory: false,
		isolation: "parent-twin",
		inheritContext: true,
		promptMode: "append",
		runInBackground: false,
		source: "default",
	},
	{
		type: "Explore",
		name: "Explore",
		displayName: "Explore",
		description:
			"Read-only Warden helper for repository discovery and evidence gathering.",
		prompt:
			"Explore repository evidence with read-only tools. Report facts, risks, and relevant paths without changing files.",
		enabled: true,
		tools: { kind: "allow", selectors: READ_ONLY_BUILTINS },
		extensions: [],
		skills: [],
		disallowedTools: [],
		memory: false,
		isolation: "standalone",
		inheritContext: false,
		promptMode: "replace",
		runInBackground: false,
		source: "default",
	},
	{
		type: "Plan",
		name: "Plan",
		displayName: "Plan",
		description:
			"Read-only Warden helper for planning narrow implementation steps.",
		prompt:
			"Plan one narrow Warden slice from repository evidence. Keep boundaries explicit and avoid execution.",
		enabled: true,
		tools: { kind: "allow", selectors: READ_ONLY_BUILTINS },
		extensions: [],
		skills: [],
		disallowedTools: [],
		memory: false,
		isolation: "standalone",
		inheritContext: false,
		promptMode: "replace",
		runInBackground: false,
		source: "default",
	},
];
