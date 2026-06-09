import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { mkdirSync, readFileSync, statSync, lstatSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { AgentMemoryScope } from "./types.ts";

export type AgentMemoryAccess = "read-write" | "read-only";

export interface ResolveAgentMemoryDirectoryOptions {
	cwd: string;
	agentType: string;
	scope: AgentMemoryScope;
	agentDir?: string;
}

export type AgentMemoryDirectoryResolution =
	| { status: "enabled"; directory: string }
	| { status: "disabled"; warning: string };

export type MemoryIndexReadResult =
	| { status: "missing" }
	| { status: "found"; content: string; warning?: string }
	| { status: "rejected"; warning: string };

export interface BuildAgentMemoryPromptBlockOptions {
	directory: string;
	access: AgentMemoryAccess;
	index: MemoryIndexReadResult;
	readToolAvailable?: boolean;
}

const SAFE_AGENT_MEMORY_SEGMENT = /^[A-Za-z0-9._-]+$/;
const MEMORY_INDEX_LINE_LIMIT = 200;

function hasDirectory(path: string): boolean {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}

function findNearestProjectRoot(cwd: string): string {
	let current = resolve(cwd);
	while (true) {
		if (hasDirectory(join(current, ".pi", "agents"))) return current;
		const parent = dirname(current);
		if (parent === current) return resolve(cwd);
		current = parent;
	}
}

function isSafeAgentMemorySegment(agentType: string): boolean {
	return (
		agentType !== "." &&
		agentType !== ".." &&
		SAFE_AGENT_MEMORY_SEGMENT.test(agentType)
	);
}

export function resolveAgentMemoryDirectory(
	options: ResolveAgentMemoryDirectoryOptions,
): AgentMemoryDirectoryResolution {
	if (!isSafeAgentMemorySegment(options.agentType)) {
		return {
			status: "disabled",
			warning: `Agent memory disabled: unsafe agent memory directory segment '${options.agentType}'. Allowed characters are A-Z, a-z, 0-9, '.', '_', and '-'.`,
		};
	}

	if (options.scope === "user") {
		return {
			status: "enabled",
			directory: join(
				options.agentDir ?? getAgentDir(),
				"agent-memory",
				options.agentType,
			),
		};
	}

	const projectRoot = findNearestProjectRoot(options.cwd);
	const scopeDir =
		options.scope === "project" ? "agent-memory" : "agent-memory-local";
	return {
		status: "enabled",
		directory: join(projectRoot, ".pi", scopeDir, options.agentType),
	};
}

export function ensureWritableMemoryDirectory(
	directory: string,
): string | undefined {
	try {
		const dirStat = lstatSync(directory);
		if (dirStat.isSymbolicLink()) {
			return "Agent memory directory is a symlink; memory disabled.";
		}
		if (!dirStat.isDirectory()) {
			return "Agent memory path is not a directory; memory disabled.";
		}
		return undefined;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			return `Unable to inspect agent memory directory: ${(error as Error).message}`;
		}
	}
	mkdirSync(directory, { recursive: true });
	return undefined;
}

export function readMemoryIndex(memoryDir: string): MemoryIndexReadResult {
	try {
		const dirStat = lstatSync(memoryDir);
		if (dirStat.isSymbolicLink()) {
			return {
				status: "rejected",
				warning:
					"Agent memory directory is a symlink; MEMORY.md index rejected.",
			};
		}
		if (!dirStat.isDirectory()) {
			return {
				status: "rejected",
				warning:
					"Agent memory path is not a directory; MEMORY.md index rejected.",
			};
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT")
			return { status: "missing" };
		return {
			status: "rejected",
			warning: `Unable to inspect agent memory directory: ${(error as Error).message}`,
		};
	}

	const indexPath = join(memoryDir, "MEMORY.md");
	try {
		const indexStat = lstatSync(indexPath);
		if (indexStat.isSymbolicLink()) {
			return {
				status: "rejected",
				warning: "Agent MEMORY.md is a symlink; index rejected.",
			};
		}
		if (!indexStat.isFile()) {
			return {
				status: "rejected",
				warning: "Agent MEMORY.md is not a regular file; index rejected.",
			};
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT")
			return { status: "missing" };
		return {
			status: "rejected",
			warning: `Unable to inspect agent MEMORY.md: ${(error as Error).message}`,
		};
	}

	try {
		const lines = readFileSync(indexPath, "utf-8").split(/\r?\n/);
		const truncated = lines.length > MEMORY_INDEX_LINE_LIMIT;
		return {
			status: "found",
			content: lines.slice(0, MEMORY_INDEX_LINE_LIMIT).join("\n"),
			warning: truncated
				? `Agent MEMORY.md index truncated to ${MEMORY_INDEX_LINE_LIMIT} lines.`
				: undefined,
		};
	} catch (error) {
		return {
			status: "rejected",
			warning: `Unable to read agent MEMORY.md: ${(error as Error).message}`,
		};
	}
}

export function buildAgentMemoryPromptBlock(
	options: BuildAgentMemoryPromptBlockOptions,
): string {
	const lines = [
		"## Agent Memory",
		`Memory directory: ${options.directory}`,
		`Memory access: ${options.access}.`,
	];

	if (options.access === "read-write") {
		lines.push(
			"You may read and update memory in this directory when it helps this delegated task.",
			"Create or edit memory files only inside this directory. Do not create starter MEMORY.md content unless task work requires a real note.",
		);
	} else {
		lines.push(
			"Memory is read-only for this run. Do not create or update memory files.",
		);
	}

	if (options.readToolAvailable === false) {
		lines.push(
			"Warning: read tool is not available, so no further memory reads are available through tools in this child run.",
		);
	}

	if (options.index.status === "found") {
		if (options.index.warning) lines.push(`Warning: ${options.index.warning}`);
		lines.push("", "### MEMORY.md Index", options.index.content);
	} else if (options.index.status === "rejected") {
		lines.push(`Warning: ${options.index.warning}`);
	}

	return lines.join("\n").trim();
}

export function buildAgentMemoryWarningBlock(warning: string): string {
	return `## Agent Memory Warning\n${warning}`;
}
