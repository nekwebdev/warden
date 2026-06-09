import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

export interface WorktreeDetails {
	enabled: true;
	path: string;
	branch?: string;
	mergeCommand?: string;
	preserved?: boolean;
}

export interface WorktreeIsolationPlan {
	enabled: true;
	runId: string;
	parentCwd: string;
	repoRoot: string;
	worktreePath: string;
	childCwd: string;
	branchBase: string;
}

export interface CreateWorktreeIsolationOptions {
	cwd: string;
	runId: string;
}

export interface CompleteWorktreeIsolationOptions {
	plan: WorktreeIsolationPlan;
	status: "completed" | "fallback" | "steered" | "aborted" | "error";
	description?: string;
	agentType: string;
}

export type WorktreeCompletion =
	| { status: "cleaned"; details: WorktreeDetails; note?: string }
	| { status: "persisted"; details: WorktreeDetails; note: string }
	| { status: "preserved"; details: WorktreeDetails; note: string }
	| { status: "failed"; details: WorktreeDetails; error: string; note: string };

const GIT_TIMEOUT_MS = 30_000;
const WORKTREE_PREFIX = "warden-subagent-worktree-";

export function createWorktreeIsolation(
	options: CreateWorktreeIsolationOptions,
): WorktreeIsolationPlan {
	const parentCwd = options.cwd;
	const repoRoot = gitOut(parentCwd, ["rev-parse", "--show-toplevel"], {
		errorPrefix: "Worktree isolation requires a git repository",
	});
	gitOut(repoRoot, ["rev-parse", "--verify", "HEAD"], {
		errorPrefix:
			"Worktree isolation requires a git repository with at least one commit",
	});
	const dirty = gitOut(
		repoRoot,
		["status", "--porcelain=v1", "--untracked-files=normal"],
		{ errorPrefix: "Worktree isolation could not inspect parent git status" },
	);
	if (dirty.trim()) {
		throw new Error(
			`Worktree isolation requires a clean parent checkout; found uncommitted or untracked files:\n${dirty.trim()}`,
		);
	}

	const runId = sanitizeRunId(options.runId);
	const tempPath = mkdtempSync(join(tmpdir(), `${WORKTREE_PREFIX}${runId}-`));
	rmSync(tempPath, { recursive: true, force: true });
	gitOut(repoRoot, ["worktree", "add", "--detach", tempPath, "HEAD"], {
		errorPrefix: "Worktree isolation failed to create temporary git worktree",
	});

	const relativeCwd = relative(repoRoot, parentCwd);
	const childCwd = relativeCwd ? join(tempPath, relativeCwd) : tempPath;
	return {
		enabled: true,
		runId,
		parentCwd,
		repoRoot,
		worktreePath: tempPath,
		childCwd,
		branchBase: `pi-agent-${runId}`,
	};
}

export function buildWorktreePromptExtra(plan: WorktreeIsolationPlan): string {
	return [
		"## Worktree Isolation",
		`This child agent runs inside temporary git worktree: ${plan.worktreePath}`,
		`Parent invocation cwd: ${plan.parentCwd}`,
		"If changes are produced successfully, Warden stages all worktree changes, commits them, preserves them on a pi-agent-* branch, and reports exact merge guidance.",
		"Temp worktree is created from committed HEAD and contains committed files only; ignored or untracked artifacts such as node_modules may be absent.",
	].join("\n");
}

export function completeWorktreeIsolation(
	options: CompleteWorktreeIsolationOptions,
): WorktreeCompletion {
	const plan = options.plan;
	const changed = hasWorktreeChanges(plan);
	if (!changed) {
		cleanupWorktree(plan);
		return {
			status: "cleaned",
			details: { enabled: true, path: plan.worktreePath, preserved: false },
		};
	}

	if (options.status === "error" || options.status === "aborted") {
		return preserveWorktree(
			plan,
			`Worktree changes were preserved for manual recovery at ${plan.worktreePath}. No auto-commit was created because child status was ${options.status}.`,
		);
	}

	const subject = commitSubject({
		runId: plan.runId,
		description: options.description,
		agentType: options.agentType,
	});
	try {
		gitOut(plan.worktreePath, ["add", "-A"], {
			errorPrefix: "Worktree isolation failed to stage child changes",
		});
		gitOut(plan.worktreePath, ["commit", "--no-verify", "-m", subject], {
			errorPrefix: "Worktree isolation failed to commit child changes",
		});
		const branch = nextAvailableBranch(plan.repoRoot, plan.branchBase);
		gitOut(plan.worktreePath, ["branch", branch, "HEAD"], {
			errorPrefix: "Worktree isolation failed to create persistence branch",
		});
		cleanupWorktree(plan);
		return {
			status: "persisted",
			details: {
				enabled: true,
				path: plan.worktreePath,
				branch,
				mergeCommand: `git merge ${branch}`,
				preserved: false,
			},
			note: `Worktree changes committed to branch ${branch}. Merge with: git merge ${branch}`,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			status: "failed",
			details: { enabled: true, path: plan.worktreePath, preserved: true },
			error: message,
			note: `Worktree persistence failed: ${message}\nWorktree preserved for manual recovery at ${plan.worktreePath}.`,
		};
	}
}

export function cleanupWorktree(plan: WorktreeIsolationPlan): void {
	try {
		gitOut(
			plan.repoRoot,
			["worktree", "remove", "--force", plan.worktreePath],
			{
				errorPrefix: "Worktree cleanup failed",
			},
		);
	} catch {
		// Best effort fallback; cleanup must not hide primary result.
	}
	rmSync(plan.worktreePath, { recursive: true, force: true });
}

function preserveWorktree(
	plan: WorktreeIsolationPlan,
	note: string,
): WorktreeCompletion {
	return {
		status: "preserved",
		details: { enabled: true, path: plan.worktreePath, preserved: true },
		note,
	};
}

function hasWorktreeChanges(plan: WorktreeIsolationPlan): boolean {
	return Boolean(
		gitOut(
			plan.worktreePath,
			["status", "--porcelain=v1", "--untracked-files=all"],
			{
				errorPrefix: "Worktree isolation could not inspect child git status",
			},
		).trim(),
	);
}

function nextAvailableBranch(cwd: string, base: string): string {
	let index = 1;
	let branch = base;
	while (branchExists(cwd, branch)) {
		index += 1;
		branch = `${base}-${index}`;
	}
	return branch;
}

function branchExists(cwd: string, branch: string): boolean {
	const result = runGit(cwd, [
		"show-ref",
		"--verify",
		"--quiet",
		`refs/heads/${branch}`,
	]);
	return result.status === 0;
}

function commitSubject(input: {
	runId: string;
	description?: string;
	agentType: string;
}): string {
	const description = (input.description || input.agentType)
		.replace(/[\r\n]+/g, " ")
		.trim();
	return `Subagent ${input.runId}: ${description}`;
}

function sanitizeRunId(runId: string): string {
	return (
		(runId || "run")
			.trim()
			.replace(/[^A-Za-z0-9._-]+/g, "-")
			.replace(/^-+|-+$/g, "") || "run"
	);
}

function gitOut(
	cwd: string,
	args: string[],
	options: { errorPrefix: string },
): string {
	const result = runGit(cwd, args);
	if (result.status !== 0) {
		const stderr = result.stderr.trim();
		const stdout = result.stdout.trim();
		const error = result.error?.message;
		const detail =
			stderr ||
			stdout ||
			error ||
			`git ${args.join(" ")} exited ${result.status}`;
		throw new Error(`${options.errorPrefix}: ${detail}`);
	}
	return result.stdout.trimEnd();
}

function runGit(cwd: string, args: string[]) {
	return spawnSync("git", args, {
		cwd,
		encoding: "utf-8",
		timeout: GIT_TIMEOUT_MS,
		maxBuffer: 10 * 1024 * 1024,
	});
}
