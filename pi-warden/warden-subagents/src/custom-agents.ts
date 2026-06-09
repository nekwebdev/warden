import { getAgentDir, parseFrontmatter } from "@earendil-works/pi-coding-agent";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type {
	AgentIsolation,
	AgentMemoryScope,
	AgentPromptMode,
	AgentSource,
	AgentThinkingLevel,
	AgentTypeConfig,
	AgentTypeDiagnostic,
	BuiltinToolName,
	LoadAgentTypesOptions,
	ToolPolicy,
	ToolSelector,
} from "./types.ts";

const BUILTIN_TOOLS = new Set<BuiltinToolName>([
	"read",
	"bash",
	"edit",
	"write",
	"grep",
	"find",
	"ls",
]);
const THINKING_LEVELS = new Set<AgentThinkingLevel>([
	"off",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
]);
const PROMPT_MODES = new Set<AgentPromptMode>(["replace", "append"]);
const ISOLATION_MODES = new Set<AgentIsolation>(["standalone", "parent-twin"]);
const MEMORY_SCOPES = new Set<AgentMemoryScope>(["project", "local", "user"]);

interface LoadedCustomAgents {
	agents: AgentTypeConfig[];
	diagnostics: AgentTypeDiagnostic[];
}

interface LoadDirectoryOptions {
	dir: string;
	source: AgentSource;
}

function diagnostic(
	severity: AgentTypeDiagnostic["severity"],
	code: string,
	message: string,
	filePath?: string,
	agentName?: string,
): AgentTypeDiagnostic {
	return { severity, code, message, filePath, agentName };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stem(fileName: string): string {
	return basename(fileName, ".md");
}

function hasDirectory(path: string): boolean {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}

export function findNearestProjectAgentsDir(cwd: string): string | undefined {
	let current = resolve(cwd);
	while (true) {
		const candidate = join(current, ".pi", "agents");
		if (hasDirectory(candidate)) return candidate;
		const parent = dirname(current);
		if (parent === current) return undefined;
		current = parent;
	}
}

export function resolveAgentDirectories(options: LoadAgentTypesOptions): {
	globalAgentsDir: string;
	projectAgentsDir?: string;
} {
	return {
		globalAgentsDir: options.globalAgentsDir ?? join(getAgentDir(), "agents"),
		projectAgentsDir:
			options.projectAgentsDir ?? findNearestProjectAgentsDir(options.cwd),
	};
}

function addUnique(values: string[], value: string): void {
	if (!values.includes(value)) values.push(value);
}

function normalizeListField(
	value: unknown,
	field: string,
	diagnostics: AgentTypeDiagnostic[],
	filePath: string,
	agentName: string,
): string[] | undefined {
	if (value === undefined) return undefined;
	const rawValues =
		typeof value === "string"
			? value.split(",")
			: Array.isArray(value)
				? value
				: [value];
	const normalized: string[] = [];
	for (const rawValue of rawValues) {
		if (typeof rawValue !== "string") {
			diagnostics.push(
				diagnostic(
					"warning",
					"invalid-list-entry",
					`${field} entries must be strings; ignored non-string entry.`,
					filePath,
					agentName,
				),
			);
			continue;
		}
		const trimmed = rawValue.trim();
		if (trimmed.length > 0) addUnique(normalized, trimmed);
	}
	return normalized;
}

function parseToolSelector(
	value: string,
	diagnostics: AgentTypeDiagnostic[],
	filePath: string,
	agentName: string,
): ToolSelector | undefined {
	const normalized = value.trim();
	const lower = normalized.toLowerCase();
	if (BUILTIN_TOOLS.has(lower as BuiltinToolName)) {
		return { kind: "builtin", name: lower as BuiltinToolName };
	}
	if (lower.startsWith("ext:")) {
		const rest = normalized.slice(4).trim();
		const [extension, tool, extra] = rest.split("/");
		if (extension && !extra) {
			return tool
				? { kind: "extension-tool", extension, tool }
				: { kind: "extension", extension };
		}
	}
	diagnostics.push(
		diagnostic(
			"warning",
			"unknown-tool-selector",
			`Unknown tool selector '${value}' ignored.`,
			filePath,
			agentName,
		),
	);
	return undefined;
}

function selectorKey(selector: ToolSelector): string {
	return JSON.stringify(selector);
}

function uniqueSelectors(selectors: ToolSelector[]): ToolSelector[] {
	const seen = new Set<string>();
	return selectors.filter((selector) => {
		const key = selectorKey(selector);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function parseToolPolicy(
	value: unknown,
	diagnostics: AgentTypeDiagnostic[],
	filePath: string,
	agentName: string,
): ToolPolicy {
	const entries = normalizeListField(
		value,
		"tools",
		diagnostics,
		filePath,
		agentName,
	);
	if (entries === undefined) return { kind: "default" };
	if (entries.length === 1 && entries[0]?.toLowerCase() === "none")
		return { kind: "allow", selectors: [] };
	if (entries.some((entry) => entry === "*" || entry.toLowerCase() === "all"))
		return { kind: "all" };
	const selectors = uniqueSelectors(
		entries
			.filter((entry) => entry.toLowerCase() !== "none")
			.map((entry) =>
				parseToolSelector(entry, diagnostics, filePath, agentName),
			)
			.filter((selector): selector is ToolSelector => selector !== undefined),
	);
	return { kind: "allow", selectors };
}

function parseSelectorList(
	value: unknown,
	field: string,
	diagnostics: AgentTypeDiagnostic[],
	filePath: string,
	agentName: string,
): ToolSelector[] {
	const entries =
		normalizeListField(value, field, diagnostics, filePath, agentName) ?? [];
	return uniqueSelectors(
		entries
			.map((entry) =>
				parseToolSelector(entry, diagnostics, filePath, agentName),
			)
			.filter((selector): selector is ToolSelector => selector !== undefined),
	);
}

function parseStringList(
	value: unknown,
	field: string,
	diagnostics: AgentTypeDiagnostic[],
	filePath: string,
	agentName: string,
): string[] {
	return (
		normalizeListField(value, field, diagnostics, filePath, agentName) ?? []
	);
}

function optionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: undefined;
}

function parseBoolean(
	frontmatter: Record<string, unknown>,
	field: string,
	defaultValue: boolean,
	diagnostics: AgentTypeDiagnostic[],
	filePath: string,
	agentName: string,
): boolean {
	const value = frontmatter[field];
	if (value === undefined) return defaultValue;
	if (typeof value === "boolean") return value;
	diagnostics.push(
		diagnostic(
			"warning",
			"invalid-scalar",
			`${field} must be a boolean; using default.`,
			filePath,
			agentName,
		),
	);
	return defaultValue;
}

function parseEnum<T extends string>(
	frontmatter: Record<string, unknown>,
	field: string,
	allowed: Set<T>,
	defaultValue: T,
	diagnostics: AgentTypeDiagnostic[],
	filePath: string,
	agentName: string,
): T {
	const value = frontmatter[field];
	if (value === undefined) return defaultValue;
	if (typeof value === "string" && allowed.has(value as T)) return value as T;
	diagnostics.push(
		diagnostic(
			"warning",
			"invalid-scalar",
			`${field} has invalid value; using default.`,
			filePath,
			agentName,
		),
	);
	return defaultValue;
}

function parseOptionalEnum<T extends string>(
	frontmatter: Record<string, unknown>,
	field: string,
	allowed: Set<T>,
	diagnostics: AgentTypeDiagnostic[],
	filePath: string,
	agentName: string,
): T | undefined {
	const value = frontmatter[field];
	if (value === undefined) return undefined;
	if (typeof value === "string" && allowed.has(value as T)) return value as T;
	diagnostics.push(
		diagnostic(
			"warning",
			"invalid-scalar",
			`${field} has invalid value; ignored.`,
			filePath,
			agentName,
		),
	);
	return undefined;
}

function parseMaxTurns(
	frontmatter: Record<string, unknown>,
	diagnostics: AgentTypeDiagnostic[],
	filePath: string,
	agentName: string,
): number | undefined {
	const value = frontmatter.max_turns;
	if (value === undefined) return undefined;
	if (Number.isInteger(value) && typeof value === "number" && value > 0)
		return value;
	diagnostics.push(
		diagnostic(
			"warning",
			"invalid-scalar",
			"max_turns must be a positive integer; ignored.",
			filePath,
			agentName,
		),
	);
	return undefined;
}

function parseModel(
	frontmatter: Record<string, unknown>,
	diagnostics: AgentTypeDiagnostic[],
	filePath: string,
	agentName: string,
): string | undefined {
	const value = frontmatter.model;
	if (value === undefined) return undefined;
	if (typeof value === "string" && value.trim().length > 0) return value.trim();
	diagnostics.push(
		diagnostic(
			"warning",
			"invalid-scalar",
			"model must be a non-empty string; ignored.",
			filePath,
			agentName,
		),
	);
	return undefined;
}

function parseMemoryScope(
	frontmatter: Record<string, unknown>,
	diagnostics: AgentTypeDiagnostic[],
	filePath: string,
	agentName: string,
): AgentMemoryScope | undefined {
	const value = frontmatter.memory;
	if (value === undefined || value === false) return undefined;
	if (
		typeof value === "string" &&
		MEMORY_SCOPES.has(value as AgentMemoryScope)
	) {
		return value as AgentMemoryScope;
	}
	if (value === true) {
		diagnostics.push(
			diagnostic(
				"warning",
				"legacy-memory-boolean",
				"memory: true is legacy metadata and does not enable persistent memory; use memory: project, memory: local, or memory: user.",
				filePath,
				agentName,
			),
		);
		return undefined;
	}
	diagnostics.push(
		diagnostic(
			"warning",
			"invalid-memory-scope",
			"memory must be one of project, local, or user; memory disabled.",
			filePath,
			agentName,
		),
	);
	return undefined;
}

function parseIsolation(
	frontmatter: Record<string, unknown>,
	diagnostics: AgentTypeDiagnostic[],
	filePath: string,
	agentName: string,
): AgentIsolation {
	if (
		frontmatter.isolation !== undefined &&
		frontmatter.isolated !== undefined
	) {
		diagnostics.push(
			diagnostic(
				"warning",
				"isolation-overrides-isolated",
				"isolation is canonical; isolated alias ignored.",
				filePath,
				agentName,
			),
		);
	}
	if (frontmatter.isolation !== undefined) {
		return parseEnum(
			frontmatter,
			"isolation",
			ISOLATION_MODES,
			"standalone",
			diagnostics,
			filePath,
			agentName,
		);
	}
	if (frontmatter.isolated !== undefined) {
		if (typeof frontmatter.isolated === "boolean") return "standalone";
		diagnostics.push(
			diagnostic(
				"warning",
				"invalid-scalar",
				"isolated must be a boolean; using default.",
				filePath,
				agentName,
			),
		);
	}
	return "standalone";
}

function toAgentConfig(
	agentName: string,
	filePath: string,
	source: AgentSource,
	frontmatter: Record<string, unknown>,
	body: string,
	diagnostics: AgentTypeDiagnostic[],
): AgentTypeConfig | undefined {
	const prompt = body.trim();
	if (prompt.length === 0) {
		diagnostics.push(
			diagnostic(
				"error",
				"empty-prompt",
				"Custom agent prompt body is empty; file skipped.",
				filePath,
				agentName,
			),
		);
		return undefined;
	}

	const description = optionalString(frontmatter.description);
	if (!description) {
		diagnostics.push(
			diagnostic(
				"warning",
				"missing-description",
				"Custom agent has no description; using empty description.",
				filePath,
				agentName,
			),
		);
	}

	return {
		type: agentName,
		name: optionalString(frontmatter.name),
		displayName: optionalString(frontmatter.display_name),
		description: description ?? "",
		prompt,
		enabled: parseBoolean(
			frontmatter,
			"enabled",
			true,
			diagnostics,
			filePath,
			agentName,
		),
		tools: parseToolPolicy(frontmatter.tools, diagnostics, filePath, agentName),
		extensions: parseStringList(
			frontmatter.extensions,
			"extensions",
			diagnostics,
			filePath,
			agentName,
		),
		skills: parseStringList(
			frontmatter.skills,
			"skills",
			diagnostics,
			filePath,
			agentName,
		),
		disallowedTools: parseSelectorList(
			frontmatter.disallowed_tools,
			"disallowed_tools",
			diagnostics,
			filePath,
			agentName,
		),
		memory: parseMemoryScope(frontmatter, diagnostics, filePath, agentName),
		isolation: parseIsolation(frontmatter, diagnostics, filePath, agentName),
		inheritContext: parseBoolean(
			frontmatter,
			"inherit_context",
			false,
			diagnostics,
			filePath,
			agentName,
		),
		promptMode: parseEnum(
			frontmatter,
			"prompt_mode",
			PROMPT_MODES,
			"replace",
			diagnostics,
			filePath,
			agentName,
		),
		runInBackground: parseBoolean(
			frontmatter,
			"run_in_background",
			false,
			diagnostics,
			filePath,
			agentName,
		),
		model: parseModel(frontmatter, diagnostics, filePath, agentName),
		thinking: parseOptionalEnum(
			frontmatter,
			"thinking",
			THINKING_LEVELS,
			diagnostics,
			filePath,
			agentName,
		),
		maxTurns: parseMaxTurns(frontmatter, diagnostics, filePath, agentName),
		source,
		filePath,
	};
}

function readCustomAgent(
	filePath: string,
	source: AgentSource,
	agentName: string,
): LoadedCustomAgents {
	const diagnostics: AgentTypeDiagnostic[] = [];
	let content: string;
	try {
		content = readFileSync(filePath, "utf-8");
	} catch (error) {
		diagnostics.push(
			diagnostic(
				"error",
				"unreadable-agent-file",
				`Unable to read custom agent file: ${(error as Error).message}`,
				filePath,
				agentName,
			),
		);
		return { agents: [], diagnostics };
	}

	let parsed: { frontmatter: Record<string, unknown>; body: string };
	try {
		parsed = parseFrontmatter<Record<string, unknown>>(content);
	} catch (error) {
		diagnostics.push(
			diagnostic(
				"error",
				"invalid-frontmatter",
				`Invalid YAML frontmatter: ${(error as Error).message}`,
				filePath,
				agentName,
			),
		);
		return { agents: [], diagnostics };
	}
	if (!isPlainObject(parsed.frontmatter)) {
		diagnostics.push(
			diagnostic(
				"error",
				"invalid-frontmatter",
				"Frontmatter must be a YAML object; file skipped.",
				filePath,
				agentName,
			),
		);
		return { agents: [], diagnostics };
	}

	const agent = toAgentConfig(
		agentName,
		filePath,
		source,
		parsed.frontmatter,
		parsed.body,
		diagnostics,
	);
	return { agents: agent ? [agent] : [], diagnostics };
}

function listMarkdownFiles(dir: string): string[] {
	if (!existsSync(dir) || !hasDirectory(dir)) return [];
	return readdirSync(dir)
		.filter((entry) => entry.toLowerCase().endsWith(".md"))
		.sort();
}

function loadCustomAgentDirectory({
	dir,
	source,
}: LoadDirectoryOptions): LoadedCustomAgents {
	const agents: AgentTypeConfig[] = [];
	const diagnostics: AgentTypeDiagnostic[] = [];
	const seen = new Set<string>();

	for (const fileName of listMarkdownFiles(dir)) {
		const agentName = stem(fileName);
		const key = agentName.toLowerCase();
		const filePath = join(dir, fileName);
		if (seen.has(key)) {
			diagnostics.push(
				diagnostic(
					"warning",
					"duplicate-agent-type",
					`Duplicate agent type '${agentName}' ignored; first sorted filename wins within directory.`,
					filePath,
					agentName,
				),
			);
			continue;
		}
		seen.add(key);
		const loaded = readCustomAgent(filePath, source, agentName);
		agents.push(...loaded.agents);
		diagnostics.push(...loaded.diagnostics);
	}
	return { agents, diagnostics };
}

export function loadCustomAgents(
	options: LoadAgentTypesOptions,
): LoadedCustomAgents {
	const directories = resolveAgentDirectories(options);
	const diagnostics: AgentTypeDiagnostic[] = [];
	const agents: AgentTypeConfig[] = [];

	const globalLoaded = loadCustomAgentDirectory({
		dir: directories.globalAgentsDir,
		source: "global",
	});
	agents.push(...globalLoaded.agents);
	diagnostics.push(...globalLoaded.diagnostics);

	if (directories.projectAgentsDir) {
		const projectLoaded = loadCustomAgentDirectory({
			dir: directories.projectAgentsDir,
			source: "project",
		});
		agents.push(...projectLoaded.agents);
		diagnostics.push(...projectLoaded.diagnostics);
	}

	return { agents, diagnostics };
}
