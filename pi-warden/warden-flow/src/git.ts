import { GIT_DIRTY_SAMPLE_LIMIT, GIT_EXEC_TIMEOUT_MS } from "./constants.js";

export interface GitExecResult {
	stdout: string;
	stderr?: string;
	code?: number | null;
}

export type GitExec = (
	command: string,
	args: string[],
	options?: { timeout?: number },
) => Promise<GitExecResult>;

export interface DirtySummary {
	staged: number;
	unstaged: number;
	untracked: number;
	paths: string[];
	total: number;
}

export interface GitContext {
	branch: string;
	commit: string;
	dirty: DirtySummary;
}

export async function loadGitContext(
	exec: GitExec,
): Promise<GitContext | null> {
	const inside = await safeGit(exec, ["rev-parse", "--is-inside-work-tree"]);
	if (inside?.trim() !== "true") return null;

	const [branchRaw, commitRaw, statusRaw] = await Promise.all([
		safeGit(exec, ["rev-parse", "--abbrev-ref", "HEAD"]),
		safeGit(exec, ["rev-parse", "--short", "HEAD"]),
		safeGit(exec, ["status", "--porcelain=v1"]),
	]);

	const branch = normalizeBranch(branchRaw);
	const commit = commitRaw?.trim() || "no-commit";
	const dirty = parsePorcelainStatus(statusRaw ?? "");
	return { branch, commit, dirty };
}

export function parsePorcelainStatus(
	status: string,
	sampleLimit = GIT_DIRTY_SAMPLE_LIMIT,
): DirtySummary {
	const lines = status.split(/\r?\n/).filter((line) => line.length > 0);
	let staged = 0;
	let unstaged = 0;
	let untracked = 0;
	const paths: string[] = [];

	for (const line of lines) {
		const code = line.slice(0, 2);
		if (code === "??") {
			untracked += 1;
		} else {
			if (code[0] !== " " && code[0] !== "?") staged += 1;
			if (code[1] !== " ") unstaged += 1;
		}

		const path = normalizeStatusPath(line.slice(3).trim());
		if (path && paths.length < sampleLimit) paths.push(path);
	}

	return { staged, unstaged, untracked, paths, total: lines.length };
}

export function gitContextSignature(context: GitContext): string {
	return [
		context.branch,
		context.commit,
		context.dirty.staged,
		context.dirty.unstaged,
		context.dirty.untracked,
		context.dirty.total,
		...context.dirty.paths,
	].join("\n");
}

export function formatGitContext(context: GitContext): string {
	const dirty = context.dirty.total > 0;
	const lines = [
		"## Current Git Context",
		`- Branch: ${context.branch}`,
		`- Commit: ${context.commit}`,
	];
	if (!dirty) {
		lines.push("- Dirty: no");
		return lines.join("\n");
	}

	lines.push(
		`- Dirty: yes — staged ${context.dirty.staged}, unstaged ${context.dirty.unstaged}, untracked ${context.dirty.untracked}`,
	);
	if (context.dirty.paths.length > 0) {
		const remaining = context.dirty.total - context.dirty.paths.length;
		const suffix = remaining > 0 ? ` (+${remaining} more)` : "";
		lines.push(`- Dirty paths: ${context.dirty.paths.join(", ")}${suffix}`);
	}
	return lines.join("\n");
}

export function isGitMutatingCommand(command: string): boolean {
	return /\bgit\s+(checkout|switch|commit|merge|rebase|pull|reset|revert|cherry-pick|worktree|am|stash|add|rm|mv|restore)\b/.test(
		command,
	);
}

export function shouldInvalidateGitContext(
	toolName: string,
	input: unknown,
): boolean {
	if (toolName === "edit" || toolName === "write") return true;
	if (toolName !== "bash") return false;
	const command =
		typeof (input as { command?: unknown } | undefined)?.command === "string"
			? (input as { command: string }).command
			: "";
	// Shell commands can mutate the working tree without looking like git. Clearing
	// only invalidates a tiny cached status probe; it does not add model tool calls.
	return command.length > 0;
}

async function safeGit(exec: GitExec, args: string[]): Promise<string | null> {
	try {
		const result = await exec("git", args, { timeout: GIT_EXEC_TIMEOUT_MS });
		return result.stdout;
	} catch {
		return null;
	}
}

function normalizeBranch(value: string | null): string {
	const branch = value?.trim();
	if (!branch) return "no-branch";
	return branch === "HEAD" ? "detached" : branch;
}

function normalizeStatusPath(value: string): string {
	const renamed = value.includes(" -> ") ? value.split(" -> ").pop() : value;
	return (renamed ?? value).trim();
}
