import { GIT_EXEC_TIMEOUT_MS } from "./constants.js";
import {
	buildApplyResult,
	formatFailedCommand,
	formatPathList,
} from "./commit-format.js";
import { normalizeRepoPath, splitPathLines } from "./commit-paths.js";
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
	WardenCommitApplyValidation,
	WardenCommitFailedCommand,
	WardenCommitRepoDetails,
	WardenCommitSnapshot,
	WardenCommitSnapshotDetails,
} from "./commit-types.js";

export function validateWardenCommitApplyInput(
	input: unknown,
): WardenCommitApplyValidation {
	if (!isRecord(input))
		return { ok: false, errors: ["input must be an object"] };
	const errors = validateApplyInputRoot(input);
	const commitValidation = validateApplyInputCommits(input.commits);
	errors.push(...commitValidation.errors);
	if (errors.length > 0) return { ok: false, errors };
	return {
		ok: true,
		value: {
			cwd: typeof input.cwd === "string" ? input.cwd : undefined,
			snapshotHash: input.snapshotHash as string,
			confirmedUserIntent: "Commit",
			commits: commitValidation.commits,
		},
	};
}

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

type CommitValidation = {
	commits: WardenCommitApplyPlanCommit[];
	errors: string[];
};

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

function validateApplyInputRoot(input: Record<string, unknown>): string[] {
	const errors: string[] = [];
	if (
		typeof input.snapshotHash !== "string" ||
		input.snapshotHash.length === 0
	) {
		errors.push("snapshotHash is required");
	}
	if (input.confirmedUserIntent !== "Commit") {
		errors.push('confirmedUserIntent must equal exactly "Commit"');
	}
	if (input.cwd !== undefined && typeof input.cwd !== "string") {
		errors.push("cwd must be a string when provided");
	}
	return errors;
}

function validateApplyInputCommits(value: unknown): CommitValidation {
	if (!Array.isArray(value) || value.length === 0) {
		return {
			commits: [],
			errors: ["commits must contain at least one commit"],
		};
	}
	const validation: CommitValidation = { commits: [], errors: [] };
	const globalPaths = new Map<string, number>();
	value.forEach((commitInput, commitIndex) => {
		validateApplyCommit(commitInput, commitIndex, globalPaths, validation);
	});
	return validation;
}

function validateApplyCommit(
	commitInput: unknown,
	commitIndex: number,
	globalPaths: Map<string, number>,
	validation: CommitValidation,
): void {
	const label = `commit ${commitIndex + 1}`;
	if (!isRecord(commitInput)) {
		validation.errors.push(`${label} must be an object`);
		return;
	}
	const subject = validateCommitSubject(commitInput.subject, label);
	const body = validateCommitBody(commitInput.body, label, validation.errors);
	if (!subject.ok) validation.errors.push(...subject.errors);
	const paths = validateCommitPaths(
		commitInput.paths,
		label,
		commitIndex,
		globalPaths,
		validation.errors,
	);
	if (subject.ok && Array.isArray(commitInput.paths)) {
		const commit: WardenCommitApplyPlanCommit = {
			subject: subject.value,
			paths,
		};
		if (typeof body === "string") commit.body = body;
		validation.commits.push(commit);
	}
}

function validateCommitSubject(
	value: unknown,
	label: string,
): { ok: true; value: string } | { ok: false; errors: string[] } {
	if (typeof value !== "string" || value.trim().length === 0) {
		return { ok: false, errors: [`${label} subject must be non-empty`] };
	}
	const errors: string[] = [];
	if (/\r|\n/.test(value))
		errors.push(`${label} subject must not contain newlines`);
	if (value.length > 120)
		errors.push(`${label} subject must be 120 characters or fewer`);
	if (containsForbiddenAttribution(value)) {
		errors.push(`${label} subject must not contain AI attribution`);
	}
	return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}

function validateCommitBody(
	value: unknown,
	label: string,
	errors: string[],
): string | undefined {
	if (value !== undefined && typeof value !== "string") {
		errors.push(`${label} body must be a string when provided`);
		return undefined;
	}
	if (typeof value === "string" && containsForbiddenAttribution(value)) {
		errors.push(`${label} body must not contain AI attribution`);
	}
	return typeof value === "string" ? value : undefined;
}

function validateCommitPaths(
	value: unknown,
	label: string,
	commitIndex: number,
	globalPaths: Map<string, number>,
	errors: string[],
): string[] {
	if (!Array.isArray(value) || value.length === 0) {
		errors.push(`${label} paths must contain at least one path`);
		return [];
	}
	const paths: string[] = [];
	const commitPaths = new Set<string>();
	value.forEach((pathInput, pathIndex) => {
		const path = validateCommitPath(
			pathInput,
			`${label} path ${pathIndex + 1}`,
			errors,
		);
		if (
			!path ||
			isDuplicateCommitPath(path, label, commitPaths, globalPaths, errors)
		) {
			return;
		}
		commitPaths.add(path);
		globalPaths.set(path, commitIndex);
		paths.push(path);
	});
	return paths;
}

function validateCommitPath(
	pathInput: unknown,
	pathLabel: string,
	errors: string[],
): string | undefined {
	const pathResult = validateApplyPath(pathInput, pathLabel);
	if (!pathResult.ok) {
		errors.push(pathResult.error);
		return undefined;
	}
	return pathResult.path;
}

function isDuplicateCommitPath(
	path: string,
	label: string,
	commitPaths: Set<string>,
	globalPaths: Map<string, number>,
	errors: string[],
): boolean {
	if (commitPaths.has(path)) {
		errors.push(`${label} has duplicate path ${path}`);
		return true;
	}
	const existingCommit = globalPaths.get(path);
	if (existingCommit === undefined) return false;
	errors.push(
		`${path} appears in both commit ${existingCommit + 1} and ${label}`,
	);
	return true;
}

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
	const refused = validateCurrentSnapshot(
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

function validateCurrentSnapshot(
	input: WardenCommitApplyParams,
	details: WardenCommitSnapshotDetails,
	currentSnapshotHash: string,
): WardenCommitApplyDetails | undefined {
	if (!currentSnapshotHash) return missingSnapshotHash(input, details);
	if (currentSnapshotHash !== input.snapshotHash) {
		return snapshotHashMismatch(input, details, currentSnapshotHash);
	}
	const planErrors = validateApplyPlanAgainstSnapshot(input, details);
	return planErrors.length > 0
		? unsafePlanDetails(input, details, currentSnapshotHash, planErrors)
		: undefined;
}

function missingSnapshotHash(
	input: WardenCommitApplyParams,
	details: WardenCommitSnapshotDetails,
): WardenCommitApplyDetails {
	return {
		ok: false,
		reason: "snapshot-hash-unavailable",
		repo: details.repo,
		requestedSnapshotHash: input.snapshotHash,
		errors: ["current snapshot did not include a snapshot hash"],
	};
}

function snapshotHashMismatch(
	input: WardenCommitApplyParams,
	details: WardenCommitSnapshotDetails,
	currentSnapshotHash: string,
): WardenCommitApplyDetails {
	return {
		ok: false,
		reason: "snapshot-hash-mismatch",
		repo: details.repo,
		requestedSnapshotHash: input.snapshotHash,
		currentSnapshotHash,
		errors: ["current working-tree snapshot hash does not match reviewed plan"],
	};
}

function unsafePlanDetails(
	input: WardenCommitApplyParams,
	details: WardenCommitSnapshotDetails,
	currentSnapshotHash: string,
	errors: string[],
): WardenCommitApplyDetails {
	return {
		ok: false,
		reason: "unsafe-plan",
		repo: details.repo,
		requestedSnapshotHash: input.snapshotHash,
		currentSnapshotHash,
		plannedCommits: cloneCommitPlan(input.commits),
		errors,
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

function validateApplyPlanAgainstSnapshot(
	input: WardenCommitApplyParams,
	details: WardenCommitSnapshotDetails,
): string[] {
	const errors: string[] = [];
	const files = new Map((details.files ?? []).map((file) => [file.path, file]));
	for (const commit of input.commits) {
		for (const path of commit.paths) validateSnapshotPath(path, files, errors);
	}
	appendPreexistingStagedErrors(details, errors);
	return errors;
}

function validateSnapshotPath(
	path: string,
	files: Map<string, NonNullable<WardenCommitSnapshotDetails["files"]>[number]>,
	errors: string[],
): void {
	const file = files.get(path);
	if (!file) {
		errors.push(
			`${path} is not present in the current snapshot changed-file set`,
		);
		return;
	}
	if (file.excludedByDefault || file.risks.length > 0) {
		errors.push(
			`${path} is risky or excluded by default: ${file.risks.length > 0 ? file.risks.join(", ") : "excluded"}`,
		);
	}
	if (file.state.includes("staged") && file.state.includes("unstaged")) {
		errors.push(`${path} has mixed staged and unstaged changes`);
	}
}

function appendPreexistingStagedErrors(
	details: WardenCommitSnapshotDetails,
	errors: string[],
): void {
	const stagedFiles = (details.files ?? []).filter((file) =>
		file.state.includes("staged"),
	);
	if (stagedFiles.length === 0) return;
	errors.push(
		`pre-existing staged changes are not allowed by warden_commit_apply v2. Staged paths: ${formatPathList(stagedFiles.map((file) => file.path))}`,
	);
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

function exactPathSetErrors(expected: string[], actual: string[]): string[] {
	const expectedSet = new Set(expected);
	const actualSet = new Set(actual);
	const missing = expected.filter((path) => !actualSet.has(path));
	const extra = actual.filter((path) => !expectedSet.has(path));
	const errors: string[] = [];
	if (missing.length > 0) {
		errors.push(`expected staged paths missing: ${formatPathList(missing)}`);
	}
	if (extra.length > 0) {
		errors.push(`unexpected staged paths present: ${formatPathList(extra)}`);
	}
	return errors;
}

function validateApplyPath(
	value: unknown,
	label: string,
): { ok: true; path: string } | { ok: false; error: string } {
	if (typeof value !== "string")
		return { ok: false, error: `${label} must be a string` };
	const invalid = invalidApplyPathReason(value, label);
	if (invalid) return { ok: false, error: invalid };
	const normalized = normalizeRepoPath(value);
	if (normalized !== value || normalized === ".") {
		return {
			ok: false,
			error: `${label} must be a normalized repo-relative path`,
		};
	}
	const segmentError = validateApplyPathSegments(normalized, label);
	if (segmentError) return { ok: false, error: segmentError };
	return { ok: true, path: normalized };
}

function invalidApplyPathReason(
	value: string,
	label: string,
): string | undefined {
	if (value.length === 0 || value.trim().length === 0)
		return `${label} must not be empty`;
	if (/\0|\r|\n/.test(value))
		return `${label} must not contain control characters`;
	if (isAbsoluteApplyPath(value))
		return `${label} must be repo-relative, not absolute`;
	if (value.startsWith("@")) return `${label} must omit leading @ path marker`;
	if (value.includes("\\")) return `${label} must use forward slashes`;
	return undefined;
}

function validateApplyPathSegments(
	normalized: string,
	label: string,
): string | undefined {
	const segments = normalized.split("/");
	if (segments.some((segment) => segment === ".." || segment === ".")) {
		return `${label} must not contain . or .. segments`;
	}
	if (segments.includes(".git"))
		return `${label} must not target .git internals`;
	if (containsPathspecMagic(normalized))
		return `${label} must not use glob or pathspec syntax`;
	return undefined;
}

function isAbsoluteApplyPath(path: string): boolean {
	return (
		path.startsWith("/") ||
		path.startsWith("~/") ||
		path === "~" ||
		/^[A-Za-z]:[\\/]/.test(path) ||
		path.startsWith("\\\\")
	);
}

function containsPathspecMagic(path: string): boolean {
	return path.startsWith(":") || /[*?[\]{}]/.test(path);
}

function containsForbiddenAttribution(value: string): boolean {
	return (
		/co-authored-by\s*:/i.test(value) ||
		/generated\s+with/i.test(value) ||
		/generated\s+by\s+ai/i.test(value) ||
		/ai-generated/i.test(value)
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function trimForDetails(value: string): string {
	const limit = 2000;
	return value.length <= limit ? value : `${value.slice(0, limit)}…`;
}
