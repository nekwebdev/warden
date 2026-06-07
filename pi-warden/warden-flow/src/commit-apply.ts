import { GIT_EXEC_TIMEOUT_MS } from "./constants.js";
import {
	exactPathSetErrors,
	validateCurrentSnapshotForApply,
	validateWardenCommitApplyInput,
} from "./commit-apply-validation.js";
import {
	buildApplyResult,
	formatFailedCommand,
	formatPathList,
} from "./commit-format.js";
import { splitPathLines } from "./commit-paths.js";
import {
	loadWardenCommitSnapshot,
	resolveSnapshotCwd,
} from "./commit-snapshot.js";
import type {
	CommitGitExec,
	CommitGitExecResult,
	WardenCommitAppliedCommit,
	WardenCommitApplyDetails,
	WardenCommitApplyParams,
	WardenCommitApplyPlanCommit,
	WardenCommitApplyResult,
	WardenCommitFailedCommand,
	WardenCommitRepoDetails,
	WardenCommitSnapshot,
} from "./commit-types.js";

export async function applyWardenCommitPlan(
	exec: CommitGitExec,
	options: { baseCwd: string; input: unknown; signal?: AbortSignal },
): Promise<WardenCommitApplyResult> {
	const validation = validateWardenCommitApplyInput(options.input);
	if (!validation.ok) return invalidInputResult(validation.errors);

	const prepared = await prepareApplyPlan(exec, validation.value, options);
	if (!prepared.ok) return buildApplyResult(prepared.details);
	return commitPlan(exec, prepared, options.signal);
}

type PreparedApplyPlan = {
	ok: true;
	input: WardenCommitApplyParams;
	snapshot: WardenCommitSnapshot;
	repo: WardenCommitRepoDetails;
	currentSnapshotHash: string;
	plannedCommits: WardenCommitApplyPlanCommit[];
};

type FailedPreparedApplyPlan = { ok: false; details: WardenCommitApplyDetails };

type GitPathListResult =
	| { ok: true; paths: string[] }
	| { ok: false; failedCommand: WardenCommitFailedCommand };

type GitScalarResult =
	| { ok: true; value: string }
	| { ok: false; failedCommand: WardenCommitFailedCommand };

async function prepareApplyPlan(
	exec: CommitGitExec,
	input: WardenCommitApplyParams,
	options: { baseCwd: string; signal?: AbortSignal },
): Promise<PreparedApplyPlan | FailedPreparedApplyPlan> {
	const snapshot = await loadCurrentSnapshot(exec, input, options);
	const unavailable = unavailableSnapshotDetails(input, snapshot);
	if (unavailable) return { ok: false, details: unavailable };
	const repo = snapshot.details.repo as WardenCommitRepoDetails;
	const currentSnapshotHash = snapshot.details.snapshotHash as string;
	const refused = validateCurrentSnapshotForApply(
		input,
		snapshot.details,
		currentSnapshotHash,
	);
	if (refused) return { ok: false, details: refused };
	return {
		ok: true,
		input,
		snapshot,
		repo,
		currentSnapshotHash,
		plannedCommits: cloneCommitPlan(input.commits),
	};
}

function invalidInputResult(errors: string[]): WardenCommitApplyResult {
	return buildApplyResult({ ok: false, reason: "invalid-input", errors });
}

function loadCurrentSnapshot(
	exec: CommitGitExec,
	input: WardenCommitApplyParams,
	options: { baseCwd: string; signal?: AbortSignal },
): Promise<WardenCommitSnapshot> {
	return loadWardenCommitSnapshot(exec, {
		cwd: resolveSnapshotCwd(options.baseCwd, input.cwd),
		includeRecentCommits: 0,
		signal: options.signal,
	});
}

function unavailableSnapshotDetails(
	input: WardenCommitApplyParams,
	snapshot: WardenCommitSnapshot,
): WardenCommitApplyDetails | undefined {
	if (snapshot.details.ok && snapshot.details.repo) return undefined;
	return {
		ok: false,
		reason: snapshot.details.reason ?? "snapshot-unavailable",
		requestedSnapshotHash: input.snapshotHash,
		currentSnapshotHash: snapshot.details.snapshotHash,
		errors: snapshot.details.warnings?.map((warning) => warning.message) ?? [
			"current snapshot is unavailable",
		],
	};
}

async function commitPlan(
	exec: CommitGitExec,
	plan: PreparedApplyPlan,
	signal: AbortSignal | undefined,
): Promise<WardenCommitApplyResult> {
	const committed: WardenCommitAppliedCommit[] = [];
	for (const commit of plan.plannedCommits) {
		const result = await commitOnePlan(exec, plan, committed, commit, signal);
		if (result) return result;
	}
	const finalStatus = await gitStatusShort(exec, plan.repo.root, signal);
	return buildApplyResult({
		ok: true,
		reason: "committed",
		repo: plan.repo,
		requestedSnapshotHash: plan.input.snapshotHash,
		currentSnapshotHash: plan.currentSnapshotHash,
		plannedCommits: plan.plannedCommits,
		commits: committed,
		finalStatus,
	});
}

async function commitOnePlan(
	exec: CommitGitExec,
	plan: PreparedApplyPlan,
	committed: WardenCommitAppliedCommit[],
	commit: WardenCommitApplyPlanCommit,
	signal: AbortSignal | undefined,
): Promise<WardenCommitApplyResult | undefined> {
	const before = await ensureNoStagedPathsBeforeCommit(
		exec,
		plan,
		committed,
		commit,
		signal,
	);
	if (before) return before;
	const add = await stageCommitPaths(exec, plan, committed, commit, signal);
	if (add) return add;
	const staged = await verifyStagedPaths(exec, plan, committed, commit, signal);
	if (staged) return staged;
	const created = await createGitCommit(exec, plan, committed, commit, signal);
	if (!created.ok) return created.result;
	committed.push(created.commit);
	return undefined;
}

async function ensureNoStagedPathsBeforeCommit(
	exec: CommitGitExec,
	plan: PreparedApplyPlan,
	committed: WardenCommitAppliedCommit[],
	commit: WardenCommitApplyPlanCommit,
	signal: AbortSignal | undefined,
): Promise<WardenCommitApplyResult | undefined> {
	const stagedBefore = await gitPathList(
		exec,
		plan.repo.root,
		["diff", "--name-only", "--cached"],
		signal,
	);
	if (!stagedBefore.ok) {
		return failBeforeOrAfterMutation(exec, plan, committed, {
			reason: "preflight-git-failed",
			errors: ["could not verify staged path set before committing"],
			failedCommand: stagedBefore.failedCommand,
			signal,
		});
	}
	if (stagedBefore.paths.length === 0) return undefined;
	return failBeforeOrAfterMutation(exec, plan, committed, {
		reason: "unexpected-staged-before-commit",
		errors: [
			`staged paths appeared before applying commit ${commit.subject}: ${formatPathList(stagedBefore.paths)}`,
		],
		signal,
	});
}

async function stageCommitPaths(
	exec: CommitGitExec,
	plan: PreparedApplyPlan,
	committed: WardenCommitAppliedCommit[],
	commit: WardenCommitApplyPlanCommit,
	signal: AbortSignal | undefined,
): Promise<WardenCommitApplyResult | undefined> {
	const addArgs = ["add", "--", ...commit.paths];
	const addResult = await runGit(exec, plan.repo.root, addArgs, signal);
	if (isGitSuccess(addResult)) return undefined;
	return failAfterMutation(exec, plan, committed, {
		reason: "git-add-failed",
		errors: [`git add failed for ${formatPathList(commit.paths)}`],
		failedCommand: failedGitCommand(addArgs, addResult),
		signal,
	});
}

async function verifyStagedPaths(
	exec: CommitGitExec,
	plan: PreparedApplyPlan,
	committed: WardenCommitAppliedCommit[],
	commit: WardenCommitApplyPlanCommit,
	signal: AbortSignal | undefined,
): Promise<WardenCommitApplyResult | undefined> {
	const stagedAfter = await gitPathList(
		exec,
		plan.repo.root,
		["diff", "--name-only", "--cached"],
		signal,
	);
	if (!stagedAfter.ok) {
		return failAfterMutation(exec, plan, committed, {
			reason: "staged-path-check-failed",
			errors: ["could not verify staged path set after git add"],
			failedCommand: stagedAfter.failedCommand,
			signal,
		});
	}
	const stagedErrors = exactPathSetErrors(commit.paths, stagedAfter.paths);
	return stagedErrors.length === 0
		? undefined
		: failAfterMutation(exec, plan, committed, {
				reason: "staged-path-mismatch",
				errors: stagedErrors,
				signal,
			});
}

async function createGitCommit(
	exec: CommitGitExec,
	plan: PreparedApplyPlan,
	committed: WardenCommitAppliedCommit[],
	commit: WardenCommitApplyPlanCommit,
	signal: AbortSignal | undefined,
): Promise<
	| { ok: true; commit: WardenCommitAppliedCommit }
	| { ok: false; result: WardenCommitApplyResult }
> {
	const commitArgs = ["commit", "-m", commit.subject];
	if (commit.body !== undefined && commit.body.length > 0)
		commitArgs.push("-m", commit.body);
	const commitResult = await runGit(exec, plan.repo.root, commitArgs, signal);
	if (!isGitSuccess(commitResult)) {
		return {
			ok: false,
			result: await failAfterMutation(exec, plan, committed, {
				reason: "git-commit-failed",
				errors: [`git commit failed for ${commit.subject}`],
				failedCommand: failedGitCommand(commitArgs, commitResult),
				signal,
			}),
		};
	}
	return committedHash(exec, plan, committed, commit, signal);
}

async function committedHash(
	exec: CommitGitExec,
	plan: PreparedApplyPlan,
	committed: WardenCommitAppliedCommit[],
	commit: WardenCommitApplyPlanCommit,
	signal: AbortSignal | undefined,
): Promise<
	| { ok: true; commit: WardenCommitAppliedCommit }
	| { ok: false; result: WardenCommitApplyResult }
> {
	const hashResult = await gitScalar(
		exec,
		plan.repo.root,
		["rev-parse", "HEAD"],
		signal,
	);
	if (!hashResult.ok) {
		return {
			ok: false,
			result: await failAfterMutation(exec, plan, committed, {
				reason: "commit-hash-failed",
				errors: ["commit created, but git rev-parse HEAD failed"],
				failedCommand: hashResult.failedCommand,
				signal,
			}),
		};
	}
	return {
		ok: true,
		commit: {
			subject: commit.subject,
			paths: [...commit.paths],
			hash: hashResult.value,
		},
	};
}

async function failBeforeOrAfterMutation(
	exec: CommitGitExec,
	plan: PreparedApplyPlan,
	committed: WardenCommitAppliedCommit[],
	input: FailureInput,
): Promise<WardenCommitApplyResult> {
	if (committed.length > 0)
		return failAfterMutation(exec, plan, committed, input);
	return buildApplyResult(failureDetails(plan, committed, input));
}

type FailureInput = {
	reason: string;
	errors: string[];
	failedCommand?: WardenCommitFailedCommand;
	signal?: AbortSignal;
};

async function failAfterMutation(
	exec: CommitGitExec,
	plan: PreparedApplyPlan,
	committed: WardenCommitAppliedCommit[],
	input: FailureInput,
): Promise<WardenCommitApplyResult> {
	const finalStatus = await gitStatusShort(exec, plan.repo.root, input.signal);
	return buildApplyResult({
		...failureDetails(plan, committed, input),
		finalStatus,
	});
}

function failureDetails(
	plan: PreparedApplyPlan,
	committed: WardenCommitAppliedCommit[],
	input: FailureInput,
): WardenCommitApplyDetails {
	return {
		ok: false,
		reason: input.reason,
		repo: plan.repo,
		requestedSnapshotHash: plan.input.snapshotHash,
		currentSnapshotHash: plan.currentSnapshotHash,
		plannedCommits: plan.plannedCommits,
		commits: committed,
		errors: input.errors,
		failedCommand: input.failedCommand,
	};
}

function cloneCommitPlan(
	commits: WardenCommitApplyPlanCommit[],
): WardenCommitApplyPlanCommit[] {
	return commits.map((commit) => ({
		subject: commit.subject,
		...(commit.body !== undefined ? { body: commit.body } : {}),
		paths: [...commit.paths],
	}));
}

async function gitPathList(
	exec: CommitGitExec,
	cwd: string,
	args: string[],
	signal: AbortSignal | undefined,
): Promise<GitPathListResult> {
	const result = await runGit(exec, cwd, args, signal);
	if (!isGitSuccess(result)) {
		return { ok: false, failedCommand: failedGitCommand(args, result) };
	}
	return { ok: true, paths: splitPathLines(result.stdout ?? "") };
}

async function gitScalar(
	exec: CommitGitExec,
	cwd: string,
	args: string[],
	signal: AbortSignal | undefined,
): Promise<GitScalarResult> {
	const result = await runGit(exec, cwd, args, signal);
	if (!isGitSuccess(result) || !result.stdout?.trim()) {
		return { ok: false, failedCommand: failedGitCommand(args, result) };
	}
	return { ok: true, value: result.stdout.trim() };
}

async function gitStatusShort(
	exec: CommitGitExec,
	cwd: string,
	signal: AbortSignal | undefined,
): Promise<string> {
	const result = await runGit(exec, cwd, ["status", "--short"], signal);
	if (isGitSuccess(result)) return (result.stdout ?? "").trimEnd();
	const failed = failedGitCommand(["status", "--short"], result);
	return `status unavailable: ${failed.stderr ?? formatFailedCommand(failed)}`;
}

async function runGit(
	exec: CommitGitExec,
	cwd: string,
	args: string[],
	signal: AbortSignal | undefined,
): Promise<CommitGitExecResult> {
	try {
		return await exec("git", args, {
			cwd,
			signal,
			timeout: GIT_EXEC_TIMEOUT_MS,
		});
	} catch (error) {
		return {
			stdout: "",
			stderr: error instanceof Error ? error.message : String(error),
			code: 1,
		};
	}
}

function isGitSuccess(result: CommitGitExecResult): boolean {
	return (
		!result.killed &&
		(result.code === undefined || result.code === null || result.code === 0)
	);
}

function failedGitCommand(
	args: string[],
	result: CommitGitExecResult,
): WardenCommitFailedCommand {
	const stderr = (result.stderr || result.stdout || "").trim();
	return {
		command: "git",
		args: [...args],
		code: result.code,
		killed: result.killed,
		...(stderr ? { stderr: trimForDetails(stderr) } : {}),
	};
}

function trimForDetails(value: string): string {
	const limit = 2000;
	return value.length <= limit ? value : `${value.slice(0, limit)}…`;
}
