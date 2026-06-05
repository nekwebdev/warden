import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { GIT_EXEC_TIMEOUT_MS } from "./constants.js";

type ToolDefinition = Parameters<ExtensionAPI["registerTool"]>[0];

export type CommitFileState = "staged" | "unstaged" | "untracked";
export type SnapshotWarningLevel = "info" | "warning" | "blocker";

export interface CommitGitExecResult {
	stdout: string;
	stderr?: string;
	code?: number | null;
	killed?: boolean;
}

export type CommitGitExec = (
	command: string,
	args: string[],
	options?: { cwd?: string; signal?: AbortSignal; timeout?: number },
) => Promise<CommitGitExecResult>;

export interface WardenCommitSnapshotParams {
	cwd?: string;
	includeRecentCommits?: number;
}

export interface WardenCommitRepoDetails {
	root: string;
	cwd: string;
	branch: string;
	head: string;
	detached: boolean;
}

export interface WardenCommitDirtyDetails {
	total: number;
	staged: number;
	unstaged: number;
	untracked: number;
}

export interface WardenCommitFile {
	path: string;
	indexStatus: string;
	worktreeStatus: string;
	state: CommitFileState[];
	boundary: string;
	risks: string[];
	excludedByDefault: boolean;
	notes: string[];
}

export interface WardenCommitWarning {
	level: SnapshotWarningLevel;
	code: string;
	message: string;
	paths?: string[];
}

export interface WardenCommitSuggestedBucket {
	label: string;
	paths: string[];
	reason: string;
}

export interface WardenCommitSnapshotDetails {
	ok: boolean;
	reason?: string;
	repo?: WardenCommitRepoDetails;
	dirty?: WardenCommitDirtyDetails;
	files?: WardenCommitFile[];
	warnings?: WardenCommitWarning[];
	suggestedBuckets?: WardenCommitSuggestedBucket[];
	recentCommitSubjects?: string[];
	snapshotHash?: string;
}

export interface WardenCommitSnapshot {
	text: string;
	details: WardenCommitSnapshotDetails;
}

export interface WardenCommitApplyPlanCommit {
	subject: string;
	body?: string;
	paths: string[];
}

export interface WardenCommitApplyParams {
	cwd?: string;
	snapshotHash: string;
	confirmedUserIntent: "Commit";
	commits: WardenCommitApplyPlanCommit[];
}

export interface WardenCommitApplyValidationOk {
	ok: true;
	value: WardenCommitApplyParams;
}

export interface WardenCommitApplyValidationError {
	ok: false;
	errors: string[];
}

export type WardenCommitApplyValidation =
	| WardenCommitApplyValidationOk
	| WardenCommitApplyValidationError;

export interface WardenCommitAppliedCommit {
	subject: string;
	paths: string[];
	hash: string;
}

export interface WardenCommitFailedCommand {
	command: "git";
	args: string[];
	code?: number | null;
	killed?: boolean;
	stderr?: string;
}

export interface WardenCommitApplyDetails {
	ok: boolean;
	reason?: string;
	repo?: WardenCommitRepoDetails;
	requestedSnapshotHash?: string;
	currentSnapshotHash?: string;
	plannedCommits?: WardenCommitApplyPlanCommit[];
	commits?: WardenCommitAppliedCommit[];
	finalStatus?: string;
	errors?: string[];
	failedCommand?: WardenCommitFailedCommand;
}

export interface WardenCommitApplyResult {
	text: string;
	details: WardenCommitApplyDetails;
}

export interface NormalizeChangedFilesInput {
	porcelainStatus: string;
	stagedPaths?: string[];
	unstagedPaths?: string[];
	untrackedPaths?: string[];
}

export interface SnapshotHashInput {
	repoRoot: string;
	cwd: string;
	branch: string;
	head: string;
	detached: boolean;
	statusLines: string[];
	files: Array<{
		path: string;
		indexStatus: string;
		worktreeStatus: string;
		state: CommitFileState[];
	}>;
}

const WARDEN_COMMIT_SNAPSHOT_PARAMETERS = {
	type: "object",
	additionalProperties: false,
	properties: {
		cwd: {
			type: "string",
			description:
				"Optional working directory to inspect. Relative paths resolve from the current Pi cwd.",
		},
		includeRecentCommits: {
			type: "number",
			description:
				"Optional count of recent commit subjects for message style inference. Defaults to 10.",
			minimum: 0,
			maximum: 25,
		},
	},
} as ToolDefinition["parameters"];

const WARDEN_COMMIT_APPLY_PARAMETERS = {
	type: "object",
	additionalProperties: false,
	required: ["snapshotHash", "confirmedUserIntent", "commits"],
	properties: {
		cwd: {
			type: "string",
			description:
				"Optional working directory for commit execution. Relative paths resolve from the current Pi cwd.",
		},
		snapshotHash: {
			type: "string",
			description:
				"Snapshot hash returned by the reviewed warden_commit_snapshot call.",
			minLength: 1,
		},
		confirmedUserIntent: {
			type: "string",
			description:
				"Must equal exactly Commit after explicit user confirmation.",
			enum: ["Commit"],
		},
		commits: {
			type: "array",
			description: "Explicit local commits to create in order.",
			minItems: 1,
			items: {
				type: "object",
				additionalProperties: false,
				required: ["subject", "paths"],
				properties: {
					subject: {
						type: "string",
						description: "Exact commit subject. Newlines are rejected.",
						minLength: 1,
					},
					body: {
						type: "string",
						description: "Optional exact commit body.",
					},
					paths: {
						type: "array",
						description:
							"Exact repo-relative file paths from the matching snapshot.",
						minItems: 1,
						items: { type: "string", minLength: 1 },
					},
				},
			},
		},
	},
} as ToolDefinition["parameters"];

const DEFAULT_RECENT_COMMITS = 10;
const MAX_RECENT_COMMITS = 25;
const TEXT_FILE_LIMIT = 80;
const LARGE_BINARY_WARNING_BYTES = 1024 * 1024;

const GENERATED_SEGMENTS = new Set([
	"node_modules",
	"dist",
	"build",
	"coverage",
	".cache",
	".turbo",
	".next",
	".vite",
	".parcel-cache",
	"tmp",
	"temp",
]);

const BINARY_EXTENSIONS = new Set([
	".7z",
	".bin",
	".class",
	".db",
	".dll",
	".dmg",
	".exe",
	".gif",
	".gz",
	".ico",
	".jar",
	".jpeg",
	".jpg",
	".mov",
	".mp4",
	".p12",
	".pdf",
	".pfx",
	".png",
	".sqlite",
	".tar",
	".tgz",
	".webp",
	".zip",
]);

export function registerWardenCommit(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "warden_commit_snapshot",
		label: "Warden Commit Snapshot",
		description:
			"Return a compact, read-only git working-tree snapshot for safe Warden commit planning.",
		promptSnippet:
			"Inspect git status, path risks, Warden boundaries, and recent commit style for commit planning.",
		promptGuidelines: [
			"Use warden_commit_snapshot before proposing Warden commit plans; it is read-only and never stages, commits, pushes, pulls, fetches, rebases, resets, amends, tags, or creates PRs.",
		],
		parameters: WARDEN_COMMIT_SNAPSHOT_PARAMETERS,
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const input = normalizeSnapshotParams(
				params as WardenCommitSnapshotParams,
			);
			const cwd = resolveSnapshotCwd(ctx.cwd, input.cwd);
			const snapshot = await loadWardenCommitSnapshot(
				(command, args, options) =>
					pi.exec(command, args, {
						...options,
						signal: options?.signal ?? signal,
					}),
				{
					cwd,
					includeRecentCommits: input.includeRecentCommits,
					signal,
				},
			);
			return {
				content: [{ type: "text", text: snapshot.text }],
				details: snapshot.details,
			};
		},
	});

	pi.registerTool({
		name: "warden_commit_apply",
		label: "Warden Commit Apply",
		description:
			"Create local git commits from an explicit, user-confirmed commit plan that was based on a matching Warden commit snapshot.",
		promptSnippet:
			"Create local commits only from reviewed Warden commit plans after exact Commit confirmation and snapshot-hash validation.",
		promptGuidelines: [
			"Use warden_commit_apply only after warden_commit_snapshot and after the user replies exactly Commit to a fully displayed commit plan.",
			"warden_commit_apply stages only exact repo-relative paths from the matching snapshot, refuses risky or mixed staged paths, creates local commits, and never pushes, pulls, fetches, rebases, resets, amends, tags, stashes, checks out, or creates PRs.",
		],
		parameters: WARDEN_COMMIT_APPLY_PARAMETERS,
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const result = await applyWardenCommitPlan(
				(command, args, options) =>
					pi.exec(command, args, {
						...options,
						signal: options?.signal ?? signal,
					}),
				{
					baseCwd: ctx.cwd,
					input: params,
					signal,
				},
			);
			return {
				content: [{ type: "text", text: result.text }],
				details: result.details,
			};
		},
	});
}

export async function loadWardenCommitSnapshot(
	exec: CommitGitExec,
	options: {
		cwd: string;
		includeRecentCommits?: number;
		signal?: AbortSignal;
	},
): Promise<WardenCommitSnapshot> {
	const targetCwd = resolve(options.cwd);
	const recentCount = normalizeRecentCommitCount(options.includeRecentCommits);
	const inside = await safeGit(
		exec,
		targetCwd,
		["rev-parse", "--is-inside-work-tree"],
		options.signal,
	);

	if (inside?.trim() !== "true") {
		const details: WardenCommitSnapshotDetails = {
			ok: false,
			reason: "not-a-git-repo",
			warnings: [
				{
					level: "blocker",
					code: "not-a-git-repo",
					message: `${targetCwd} is not inside a git repository.`,
				},
			],
		};
		return { text: formatWardenCommitSnapshot(details, targetCwd), details };
	}

	const root =
		(
			await safeGit(
				exec,
				targetCwd,
				["rev-parse", "--show-toplevel"],
				options.signal,
			)
		)?.trim() || targetCwd;
	const [
		branchRaw,
		headRaw,
		statusRaw,
		stagedRaw,
		unstagedRaw,
		untrackedRaw,
		logRaw,
	] = await Promise.all([
		safeGit(exec, root, ["rev-parse", "--abbrev-ref", "HEAD"], options.signal),
		safeGit(exec, root, ["rev-parse", "--short", "HEAD"], options.signal),
		safeGit(exec, root, ["status", "--porcelain=v1"], options.signal),
		safeGit(exec, root, ["diff", "--name-only", "--staged"], options.signal),
		safeGit(exec, root, ["diff", "--name-only"], options.signal),
		safeGit(
			exec,
			root,
			["ls-files", "--others", "--exclude-standard"],
			options.signal,
		),
		recentCount > 0
			? safeGit(
					exec,
					root,
					["log", "--oneline", "-n", String(recentCount)],
					options.signal,
				)
			: Promise.resolve(""),
	]);

	const branchValue = branchRaw?.trim() || "unknown";
	const detached = branchValue === "HEAD";
	const repo: WardenCommitRepoDetails = {
		root,
		cwd: targetCwd,
		branch: detached ? "detached" : branchValue,
		head: headRaw?.trim() || "no-commit",
		detached,
	};

	const statusLines = splitLines(statusRaw ?? "");
	const files = normalizeChangedFiles({
		porcelainStatus: statusRaw ?? "",
		stagedPaths: splitPathLines(stagedRaw ?? ""),
		unstagedPaths: splitPathLines(unstagedRaw ?? ""),
		untrackedPaths: splitPathLines(untrackedRaw ?? ""),
	});
	await addFilesystemRiskNotes(files, root);

	const dirty = summarizeDirty(files);
	const details: WardenCommitSnapshotDetails = {
		ok: true,
		repo,
		dirty,
		files,
		warnings: buildSnapshotWarnings(files),
		suggestedBuckets: buildSuggestedBuckets(files),
		recentCommitSubjects: parseRecentCommitSubjects(logRaw ?? ""),
		snapshotHash: buildSnapshotHash({
			repoRoot: repo.root,
			cwd: repo.cwd,
			branch: repo.branch,
			head: repo.head,
			detached: repo.detached,
			statusLines,
			files: files.map((file) => ({
				path: file.path,
				indexStatus: file.indexStatus,
				worktreeStatus: file.worktreeStatus,
				state: file.state,
			})),
		}),
	};

	return { text: formatWardenCommitSnapshot(details), details };
}

export function validateWardenCommitApplyInput(
	input: unknown,
): WardenCommitApplyValidation {
	const errors: string[] = [];
	if (!isRecord(input)) {
		return { ok: false, errors: ["input must be an object"] };
	}

	const snapshotHash = input.snapshotHash;
	if (typeof snapshotHash !== "string" || snapshotHash.length === 0) {
		errors.push("snapshotHash is required");
	}

	if (input.confirmedUserIntent !== "Commit") {
		errors.push('confirmedUserIntent must equal exactly "Commit"');
	}

	if (input.cwd !== undefined && typeof input.cwd !== "string") {
		errors.push("cwd must be a string when provided");
	}

	const commitsInput = input.commits;
	if (!Array.isArray(commitsInput) || commitsInput.length === 0) {
		errors.push("commits must contain at least one commit");
	}

	const commits: WardenCommitApplyPlanCommit[] = [];
	const globalPaths = new Map<string, number>();
	if (Array.isArray(commitsInput)) {
		commitsInput.forEach((commitInput, commitIndex) => {
			const label = `commit ${commitIndex + 1}`;
			if (!isRecord(commitInput)) {
				errors.push(`${label} must be an object`);
				return;
			}

			const subject = commitInput.subject;
			if (typeof subject !== "string" || subject.trim().length === 0) {
				errors.push(`${label} subject must be non-empty`);
			} else {
				if (/\r|\n/.test(subject)) {
					errors.push(`${label} subject must not contain newlines`);
				}
				if (subject.length > 120) {
					errors.push(`${label} subject must be 120 characters or fewer`);
				}
				if (containsForbiddenAttribution(subject)) {
					errors.push(`${label} subject must not contain AI attribution`);
				}
			}

			const body = commitInput.body;
			if (body !== undefined && typeof body !== "string") {
				errors.push(`${label} body must be a string when provided`);
			}
			if (typeof body === "string" && containsForbiddenAttribution(body)) {
				errors.push(`${label} body must not contain AI attribution`);
			}

			const pathsInput = commitInput.paths;
			const paths: string[] = [];
			if (!Array.isArray(pathsInput) || pathsInput.length === 0) {
				errors.push(`${label} paths must contain at least one path`);
			} else {
				const commitPaths = new Set<string>();
				pathsInput.forEach((pathInput, pathIndex) => {
					const pathLabel = `${label} path ${pathIndex + 1}`;
					const pathResult = validateApplyPath(pathInput, pathLabel);
					if (!pathResult.ok) {
						errors.push(pathResult.error);
						return;
					}
					const path = pathResult.path;
					if (commitPaths.has(path)) {
						errors.push(`${label} has duplicate path ${path}`);
						return;
					}
					const existingCommit = globalPaths.get(path);
					if (existingCommit !== undefined) {
						errors.push(
							`${path} appears in both commit ${existingCommit + 1} and ${label}`,
						);
						return;
					}
					commitPaths.add(path);
					globalPaths.set(path, commitIndex);
					paths.push(path);
				});
			}

			if (typeof subject === "string" && Array.isArray(pathsInput)) {
				const commit: WardenCommitApplyPlanCommit = { subject, paths };
				if (typeof body === "string") commit.body = body;
				commits.push(commit);
			}
		});
	}

	if (errors.length > 0) return { ok: false, errors };
	return {
		ok: true,
		value: {
			cwd: typeof input.cwd === "string" ? input.cwd : undefined,
			snapshotHash: snapshotHash as string,
			confirmedUserIntent: "Commit",
			commits,
		},
	};
}

export async function applyWardenCommitPlan(
	exec: CommitGitExec,
	options: { baseCwd: string; input: unknown; signal?: AbortSignal },
): Promise<WardenCommitApplyResult> {
	const validation = validateWardenCommitApplyInput(options.input);
	if (!validation.ok) {
		return buildApplyResult({
			ok: false,
			reason: "invalid-input",
			errors: validation.errors,
		});
	}

	const input = validation.value;
	const cwd = resolveSnapshotCwd(options.baseCwd, input.cwd);
	const snapshot = await loadWardenCommitSnapshot(exec, {
		cwd,
		includeRecentCommits: 0,
		signal: options.signal,
	});

	if (!snapshot.details.ok || !snapshot.details.repo) {
		return buildApplyResult({
			ok: false,
			reason: snapshot.details.reason ?? "snapshot-unavailable",
			requestedSnapshotHash: input.snapshotHash,
			currentSnapshotHash: snapshot.details.snapshotHash,
			errors: snapshot.details.warnings?.map((warning) => warning.message) ?? [
				"current snapshot is unavailable",
			],
		});
	}

	const currentSnapshotHash = snapshot.details.snapshotHash;
	if (!currentSnapshotHash) {
		return buildApplyResult({
			ok: false,
			reason: "snapshot-hash-unavailable",
			repo: snapshot.details.repo,
			requestedSnapshotHash: input.snapshotHash,
			errors: ["current snapshot did not include a snapshot hash"],
		});
	}

	if (currentSnapshotHash !== input.snapshotHash) {
		return buildApplyResult({
			ok: false,
			reason: "snapshot-hash-mismatch",
			repo: snapshot.details.repo,
			requestedSnapshotHash: input.snapshotHash,
			currentSnapshotHash,
			errors: [
				"current working-tree snapshot hash does not match reviewed plan",
			],
		});
	}

	const planErrors = validateApplyPlanAgainstSnapshot(input, snapshot.details);
	if (planErrors.length > 0) {
		return buildApplyResult({
			ok: false,
			reason: "unsafe-plan",
			repo: snapshot.details.repo,
			requestedSnapshotHash: input.snapshotHash,
			currentSnapshotHash,
			plannedCommits: cloneCommitPlan(input.commits),
			errors: planErrors,
		});
	}

	const repoRoot = snapshot.details.repo.root;
	const committed: WardenCommitAppliedCommit[] = [];
	const plannedCommits = cloneCommitPlan(input.commits);

	for (const commit of plannedCommits) {
		const stagedBefore = await gitPathList(
			exec,
			repoRoot,
			["diff", "--name-only", "--cached"],
			options.signal,
		);
		if (!stagedBefore.ok) {
			const errors = ["could not verify staged path set before committing"];
			if (committed.length > 0) {
				return failAfterMutation(exec, snapshot.details.repo, {
					reason: "preflight-git-failed",
					requestedSnapshotHash: input.snapshotHash,
					currentSnapshotHash,
					plannedCommits,
					committed,
					errors,
					failedCommand: stagedBefore.failedCommand,
					signal: options.signal,
				});
			}
			return buildApplyResult({
				ok: false,
				reason: "preflight-git-failed",
				repo: snapshot.details.repo,
				requestedSnapshotHash: input.snapshotHash,
				currentSnapshotHash,
				plannedCommits,
				commits: committed,
				errors,
				failedCommand: stagedBefore.failedCommand,
			});
		}
		if (stagedBefore.paths.length > 0) {
			const errors = [
				`staged paths appeared before applying commit ${commit.subject}: ${formatPathList(stagedBefore.paths)}`,
			];
			if (committed.length > 0) {
				return failAfterMutation(exec, snapshot.details.repo, {
					reason: "unexpected-staged-before-commit",
					requestedSnapshotHash: input.snapshotHash,
					currentSnapshotHash,
					plannedCommits,
					committed,
					errors,
					signal: options.signal,
				});
			}
			return buildApplyResult({
				ok: false,
				reason: "unexpected-staged-before-commit",
				repo: snapshot.details.repo,
				requestedSnapshotHash: input.snapshotHash,
				currentSnapshotHash,
				plannedCommits,
				commits: committed,
				errors,
			});
		}

		const addArgs = ["add", "--", ...commit.paths];
		const addResult = await runGit(exec, repoRoot, addArgs, options.signal);
		if (!isGitSuccess(addResult)) {
			return failAfterMutation(exec, snapshot.details.repo, {
				reason: "git-add-failed",
				requestedSnapshotHash: input.snapshotHash,
				currentSnapshotHash,
				plannedCommits,
				committed,
				errors: [`git add failed for ${formatPathList(commit.paths)}`],
				failedCommand: failedGitCommand(addArgs, addResult),
				signal: options.signal,
			});
		}

		// Exact staged-set model: after staging current commit paths, the index must
		// contain exactly those paths and nothing else. No subset or broad pathspecs.
		const stagedAfter = await gitPathList(
			exec,
			repoRoot,
			["diff", "--name-only", "--cached"],
			options.signal,
		);
		if (!stagedAfter.ok) {
			return failAfterMutation(exec, snapshot.details.repo, {
				reason: "staged-path-check-failed",
				requestedSnapshotHash: input.snapshotHash,
				currentSnapshotHash,
				plannedCommits,
				committed,
				errors: ["could not verify staged path set after git add"],
				failedCommand: stagedAfter.failedCommand,
				signal: options.signal,
			});
		}
		const stagedErrors = exactPathSetErrors(commit.paths, stagedAfter.paths);
		if (stagedErrors.length > 0) {
			return failAfterMutation(exec, snapshot.details.repo, {
				reason: "staged-path-mismatch",
				requestedSnapshotHash: input.snapshotHash,
				currentSnapshotHash,
				plannedCommits,
				committed,
				errors: stagedErrors,
				signal: options.signal,
			});
		}

		const commitArgs = ["commit", "-m", commit.subject];
		if (commit.body !== undefined && commit.body.length > 0) {
			commitArgs.push("-m", commit.body);
		}
		const commitResult = await runGit(
			exec,
			repoRoot,
			commitArgs,
			options.signal,
		);
		if (!isGitSuccess(commitResult)) {
			return failAfterMutation(exec, snapshot.details.repo, {
				reason: "git-commit-failed",
				requestedSnapshotHash: input.snapshotHash,
				currentSnapshotHash,
				plannedCommits,
				committed,
				errors: [`git commit failed for ${commit.subject}`],
				failedCommand: failedGitCommand(commitArgs, commitResult),
				signal: options.signal,
			});
		}

		const hashResult = await gitScalar(
			exec,
			repoRoot,
			["rev-parse", "HEAD"],
			options.signal,
		);
		if (!hashResult.ok) {
			return failAfterMutation(exec, snapshot.details.repo, {
				reason: "commit-hash-failed",
				requestedSnapshotHash: input.snapshotHash,
				currentSnapshotHash,
				plannedCommits,
				committed,
				errors: ["commit created, but git rev-parse HEAD failed"],
				failedCommand: hashResult.failedCommand,
				signal: options.signal,
			});
		}
		committed.push({
			subject: commit.subject,
			paths: [...commit.paths],
			hash: hashResult.value,
		});
	}

	const finalStatus = await gitStatusShort(exec, repoRoot, options.signal);
	return buildApplyResult({
		ok: true,
		reason: "committed",
		repo: snapshot.details.repo,
		requestedSnapshotHash: input.snapshotHash,
		currentSnapshotHash,
		plannedCommits,
		commits: committed,
		finalStatus,
	});
}

export function parseCommitPorcelainStatus(status: string): WardenCommitFile[] {
	return normalizeChangedFiles({ porcelainStatus: status });
}

export function normalizeChangedFiles(
	input: NormalizeChangedFilesInput,
): WardenCommitFile[] {
	const filesByPath = new Map<
		string,
		{
			path: string;
			indexStatus: string;
			worktreeStatus: string;
			state: Set<CommitFileState>;
		}
	>();

	for (const line of splitLines(input.porcelainStatus)) {
		const parsed = parsePorcelainLine(line);
		if (!parsed) continue;
		const file = upsertFile(filesByPath, parsed.path);
		file.indexStatus = parsed.indexStatus;
		file.worktreeStatus = parsed.worktreeStatus;
		for (const state of parsed.state) file.state.add(state);
	}

	for (const path of input.stagedPaths ?? []) {
		const file = upsertFile(filesByPath, path);
		file.state.add("staged");
		if (file.indexStatus === " ") file.indexStatus = "M";
	}
	for (const path of input.unstagedPaths ?? []) {
		const file = upsertFile(filesByPath, path);
		file.state.add("unstaged");
		if (file.worktreeStatus === " ") file.worktreeStatus = "M";
	}
	for (const path of input.untrackedPaths ?? []) {
		const file = upsertFile(filesByPath, path);
		file.state.add("untracked");
		file.indexStatus = "?";
		file.worktreeStatus = "?";
	}

	return [...filesByPath.values()]
		.map((file) => finalizeChangedFile(file))
		.sort((left, right) => left.path.localeCompare(right.path));
}

export function classifyWardenBoundary(path: string): string {
	const normalized = normalizeRepoPath(path);
	if (!normalized) return "unknown";

	if (normalized === ".warden/map.md") return "warden-map";
	if (/^\.warden\/maps\/.+\/map\.md$/.test(normalized)) return "warden-map";
	if (normalized === ".warden/work" || normalized.startsWith(".warden/work/"))
		return "warden-work";
	if (normalized === "run-warden" || normalized.startsWith("run-warden/"))
		return "run-warden";
	if (normalized === "pi-warden") return "pi-warden";
	if (normalized.startsWith("pi-warden/")) {
		const [, packageName] = normalized.split("/");
		return packageName ? `pi-warden/${packageName}` : "pi-warden";
	}
	if (normalized === "nix-warden" || normalized.startsWith("nix-warden/"))
		return "nix-warden";
	if (normalized === "dev-warden" || normalized.startsWith("dev-warden/"))
		return "dev-warden";
	if (normalized === "docs" || normalized.startsWith("docs/")) return "docs";
	if (normalized === "warden" || !normalized.includes("/")) return "root";
	return "unknown";
}

export function analyzePathRisk(path: string): {
	risks: string[];
	excludedByDefault: boolean;
	notes: string[];
} {
	const normalized = normalizeRepoPath(path);
	const risks: string[] = [];
	const notes: string[] = [];
	let excludedByDefault = false;

	if (isSecretLookingPath(normalized)) {
		risks.push("secret-looking");
		excludedByDefault = true;
	}
	if (isGeneratedOrRuntimePath(normalized)) {
		risks.push("generated-cache-build-runtime");
		excludedByDefault = true;
	}

	const boundary = classifyWardenBoundary(normalized);
	if (boundary === "warden-work") {
		risks.push("warden-work-state");
		notes.push("active Warden slice state; excluded by default");
		excludedByDefault = true;
	}
	if (boundary === "warden-map") {
		notes.push("durable Warden orientation context; not active work state");
	}

	return {
		risks: [...new Set(risks)],
		excludedByDefault,
		notes: [...new Set(notes)],
	};
}

export function buildSnapshotWarnings(
	files: WardenCommitFile[],
): WardenCommitWarning[] {
	const warnings: WardenCommitWarning[] = [];
	const mixed = files.filter(
		(file) => file.state.includes("staged") && file.state.includes("unstaged"),
	);
	if (mixed.length > 0) {
		warnings.push({
			level: "warning",
			code: "mixed-staged-unstaged",
			message: `${formatPathList(mixed.map((file) => file.path))} have both staged and unstaged changes.`,
			paths: mixed.map((file) => file.path),
		});
	}

	pushRiskWarning(
		warnings,
		files,
		"secret-looking",
		"blocker",
		"secret-looking-path",
		"Secret-looking paths are blocked by default.",
	);
	pushRiskWarning(
		warnings,
		files,
		"generated-cache-build-runtime",
		"warning",
		"generated-cache-build-runtime-path",
		"Generated, cache, build, or runtime paths are excluded by default.",
	);
	pushRiskWarning(
		warnings,
		files,
		"warden-work-state",
		"warning",
		"warden-work-excluded",
		".warden/work/** is active Warden slice state and excluded by default.",
	);
	pushRiskWarning(
		warnings,
		files,
		"large-binary",
		"warning",
		"large-binary-path",
		"Large binary-looking files need explicit review before commit planning.",
	);

	return warnings;
}

export function buildSuggestedBuckets(
	files: WardenCommitFile[],
): WardenCommitSuggestedBucket[] {
	const buckets = new Map<
		string,
		{ label: string; paths: string[]; categories: Set<string> }
	>();

	for (const file of files) {
		const label = bucketLabelForFile(file);
		const bucket = buckets.get(label) ?? {
			label,
			paths: [],
			categories: new Set<string>(),
		};
		bucket.paths.push(file.path);
		bucket.categories.add(pathCategory(file));
		buckets.set(label, bucket);
	}

	return [...buckets.values()]
		.map((bucket) => ({
			label: bucket.label,
			paths: bucket.paths.sort(),
			reason: `${formatCategoryList([...bucket.categories].sort())} under ${bucket.label}`,
		}))
		.sort((left, right) => left.label.localeCompare(right.label));
}

export function buildSnapshotHash(input: SnapshotHashInput): string {
	const stable = {
		repoRoot: input.repoRoot,
		cwd: input.cwd,
		branch: input.branch,
		head: input.head,
		detached: input.detached,
		statusLines: [...input.statusLines].sort(),
		files: input.files
			.map((file) => ({
				path: file.path,
				indexStatus: file.indexStatus,
				worktreeStatus: file.worktreeStatus,
				state: [...file.state].sort(),
			}))
			.sort((left, right) => left.path.localeCompare(right.path)),
	};
	return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export function formatWardenCommitSnapshot(
	details: WardenCommitSnapshotDetails,
	fallbackCwd?: string,
): string {
	const lines = ["## Warden Commit Snapshot", ""];

	if (!details.ok) {
		lines.push("Repo:", `- CWD: ${fallbackCwd ?? "unknown"}`);
		lines.push(`- Status: unavailable — ${details.reason ?? "unknown"}`);
		lines.push("", "Warnings:");
		for (const warning of details.warnings ?? [])
			lines.push(`- ${warning.message}`);
		return lines.join("\n");
	}

	const repo = details.repo;
	const dirty = details.dirty;
	lines.push("Repo:");
	if (repo) {
		lines.push(
			`- Root: ${repo.root}`,
			`- CWD: ${repo.cwd}`,
			`- Branch: ${repo.branch}${repo.detached ? " (detached HEAD)" : ""}`,
			`- HEAD: ${repo.head}`,
		);
	}
	if (dirty) {
		lines.push(
			`- Dirty: ${dirty.total > 0 ? "yes" : "no"}${
				dirty.total > 0
					? ` — staged ${dirty.staged}, unstaged ${dirty.unstaged}, untracked ${dirty.untracked}`
					: ""
			}`,
		);
	}

	lines.push("", "Warnings:");
	if ((details.warnings ?? []).length === 0) {
		lines.push("- none");
	} else {
		for (const warning of details.warnings ?? [])
			lines.push(`- ${warning.message}`);
	}

	const files = details.files ?? [];
	lines.push("", "Changed files:");
	if (files.length === 0) {
		lines.push("- none");
	} else {
		const shown = files.slice(0, TEXT_FILE_LIMIT);
		for (const file of shown) {
			lines.push(`- \`${formatStatusCode(file)}\` ${file.path}`);
			lines.push(`  - state: ${file.state.join(", ") || "none"}`);
			lines.push(`  - boundary: ${file.boundary}`);
			lines.push(
				`  - risk: ${file.risks.length > 0 ? file.risks.join(", ") : "none"}`,
			);
			if (file.excludedByDefault) lines.push("  - excluded by default: yes");
			if (file.notes.length > 0)
				lines.push(`  - notes: ${file.notes.join("; ")}`);
		}
		const remaining = files.length - shown.length;
		if (remaining > 0)
			lines.push(`- ... ${remaining} more file(s) omitted from text summary`);
	}

	lines.push("", "Suggested deterministic buckets:");
	if ((details.suggestedBuckets ?? []).length === 0) {
		lines.push("- none");
	} else {
		for (const bucket of details.suggestedBuckets ?? []) {
			lines.push(`- ${bucket.label}: ${bucket.reason}`);
			lines.push(`  - paths: ${formatPathList(bucket.paths)}`);
		}
	}

	lines.push("", "Recent commit subjects:");
	if ((details.recentCommitSubjects ?? []).length === 0) {
		lines.push("- none");
	} else {
		for (const subject of details.recentCommitSubjects ?? [])
			lines.push(`- ${subject}`);
	}

	lines.push("", "Snapshot hash:");
	lines.push(`- ${details.snapshotHash ?? "unavailable"}`);
	return lines.join("\n");
}

function buildApplyResult(
	details: WardenCommitApplyDetails,
): WardenCommitApplyResult {
	return { text: formatWardenCommitApplyResult(details), details };
}

function formatWardenCommitApplyResult(
	details: WardenCommitApplyDetails,
): string {
	const lines = ["## Warden Commit Apply", ""];
	lines.push(
		`Status: ${details.ok ? "committed" : `refused — ${details.reason ?? "unknown"}`}`,
	);

	if (details.repo) {
		lines.push(
			"",
			"Repo:",
			`- Root: ${details.repo.root}`,
			`- Branch: ${details.repo.branch}`,
			`- HEAD before apply: ${details.repo.head}`,
		);
	}
	if (details.requestedSnapshotHash || details.currentSnapshotHash) {
		lines.push("", "Snapshot:");
		if (details.requestedSnapshotHash)
			lines.push(`- requested: ${details.requestedSnapshotHash}`);
		if (details.currentSnapshotHash)
			lines.push(`- current: ${details.currentSnapshotHash}`);
	}
	if ((details.errors ?? []).length > 0) {
		lines.push("", "Errors:");
		for (const error of details.errors ?? []) lines.push(`- ${error}`);
	}
	if ((details.commits ?? []).length > 0) {
		lines.push("", "Commits created:");
		for (const commit of details.commits ?? []) {
			lines.push(`- ${commit.hash} ${commit.subject}`);
			lines.push(`  - paths: ${formatPathList(commit.paths)}`);
		}
	}
	if (details.failedCommand) {
		lines.push("", "Failed command:");
		lines.push(`- ${formatFailedCommand(details.failedCommand)}`);
		if (details.failedCommand.stderr) {
			lines.push(`- stderr: ${details.failedCommand.stderr}`);
		}
	}
	if (details.finalStatus !== undefined) {
		lines.push("", "Final git status --short:", "```text");
		lines.push(
			details.finalStatus.length > 0 ? details.finalStatus : "(clean)",
		);
		lines.push("```");
	} else if (!details.ok) {
		lines.push("", "Mutation:", "- no git state was changed before refusal");
	}
	return lines.join("\n");
}

function validateApplyPlanAgainstSnapshot(
	input: WardenCommitApplyParams,
	details: WardenCommitSnapshotDetails,
): string[] {
	const errors: string[] = [];
	const files = new Map((details.files ?? []).map((file) => [file.path, file]));

	for (const commit of input.commits) {
		for (const path of commit.paths) {
			const file = files.get(path);
			if (!file) {
				errors.push(
					`${path} is not present in the current snapshot changed-file set`,
				);
				continue;
			}
			if (file.excludedByDefault || file.risks.length > 0) {
				errors.push(
					`${path} is risky or excluded by default: ${
						file.risks.length > 0 ? file.risks.join(", ") : "excluded"
					}`,
				);
			}
			if (file.state.includes("staged") && file.state.includes("unstaged")) {
				errors.push(`${path} has mixed staged and unstaged changes`);
			}
		}
	}

	const stagedFiles = (details.files ?? []).filter((file) =>
		file.state.includes("staged"),
	);
	if (stagedFiles.length > 0) {
		errors.push(
			`pre-existing staged changes are not allowed by warden_commit_apply v2. Staged paths: ${formatPathList(
				stagedFiles.map((file) => file.path),
			)}`,
		);
	}

	return errors;
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

async function failAfterMutation(
	exec: CommitGitExec,
	repo: WardenCommitRepoDetails,
	options: {
		reason: string;
		requestedSnapshotHash: string;
		currentSnapshotHash: string;
		plannedCommits: WardenCommitApplyPlanCommit[];
		committed: WardenCommitAppliedCommit[];
		errors: string[];
		failedCommand?: WardenCommitFailedCommand;
		signal?: AbortSignal;
	},
): Promise<WardenCommitApplyResult> {
	const finalStatus = await gitStatusShort(exec, repo.root, options.signal);
	return buildApplyResult({
		ok: false,
		reason: options.reason,
		repo,
		requestedSnapshotHash: options.requestedSnapshotHash,
		currentSnapshotHash: options.currentSnapshotHash,
		plannedCommits: options.plannedCommits,
		commits: options.committed,
		finalStatus,
		errors: options.errors,
		failedCommand: options.failedCommand,
	});
}

type GitPathListResult =
	| { ok: true; paths: string[] }
	| { ok: false; failedCommand: WardenCommitFailedCommand };

type GitScalarResult =
	| { ok: true; value: string }
	| { ok: false; failedCommand: WardenCommitFailedCommand };

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
	if (typeof value !== "string") {
		return { ok: false, error: `${label} must be a string` };
	}
	if (value.length === 0 || value.trim().length === 0) {
		return { ok: false, error: `${label} must not be empty` };
	}
	if (/\0|\r|\n/.test(value)) {
		return { ok: false, error: `${label} must not contain control characters` };
	}
	if (isAbsoluteApplyPath(value)) {
		return { ok: false, error: `${label} must be repo-relative, not absolute` };
	}
	if (value.startsWith("@")) {
		return { ok: false, error: `${label} must omit leading @ path marker` };
	}
	if (value.includes("\\")) {
		return { ok: false, error: `${label} must use forward slashes` };
	}
	const normalized = normalizeRepoPath(value);
	if (normalized !== value || normalized === ".") {
		return {
			ok: false,
			error: `${label} must be a normalized repo-relative path`,
		};
	}
	const segments = normalized.split("/");
	if (segments.some((segment) => segment === ".." || segment === ".")) {
		return { ok: false, error: `${label} must not contain . or .. segments` };
	}
	if (segments.includes(".git")) {
		return { ok: false, error: `${label} must not target .git internals` };
	}
	if (containsPathspecMagic(normalized)) {
		return {
			ok: false,
			error: `${label} must not use glob or pathspec syntax`,
		};
	}
	return { ok: true, path: normalized };
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

function formatFailedCommand(command: WardenCommitFailedCommand): string {
	return `git ${command.args.map(formatCommandArg).join(" ")}`;
}

function formatCommandArg(arg: string): string {
	if (/^[A-Za-z0-9_./:=@,+-]+$/.test(arg)) return arg;
	return JSON.stringify(arg);
}

function normalizeSnapshotParams(
	params: WardenCommitSnapshotParams | undefined,
): WardenCommitSnapshotParams {
	if (!params || typeof params !== "object") return {};
	return {
		cwd: typeof params.cwd === "string" ? params.cwd : undefined,
		includeRecentCommits:
			typeof params.includeRecentCommits === "number"
				? params.includeRecentCommits
				: undefined,
	};
}

function resolveSnapshotCwd(
	baseCwd: string,
	requestedCwd: string | undefined,
): string {
	if (!requestedCwd) return resolve(baseCwd);
	const normalized = requestedCwd.startsWith("@")
		? requestedCwd.slice(1)
		: requestedCwd;
	return resolve(baseCwd, normalized);
}

function normalizeRecentCommitCount(value: number | undefined): number {
	if (!Number.isFinite(value)) return DEFAULT_RECENT_COMMITS;
	return Math.max(0, Math.min(MAX_RECENT_COMMITS, Math.floor(value ?? 0)));
}

async function safeGit(
	exec: CommitGitExec,
	cwd: string,
	args: string[],
	signal: AbortSignal | undefined,
): Promise<string | null> {
	try {
		const result = await exec("git", args, {
			cwd,
			signal,
			timeout: GIT_EXEC_TIMEOUT_MS,
		});
		if (typeof result.code === "number" && result.code !== 0 && !result.stdout)
			return null;
		return result.stdout ?? "";
	} catch {
		return null;
	}
}

function parsePorcelainLine(line: string): {
	path: string;
	indexStatus: string;
	worktreeStatus: string;
	state: CommitFileState[];
} | null {
	if (line.length < 3) return null;
	const indexStatus = line[0] ?? " ";
	const worktreeStatus = line[1] ?? " ";
	const rawPath = line.slice(3).trim();
	const path = normalizeStatusPath(rawPath);
	if (!path) return null;

	if (indexStatus === "?" && worktreeStatus === "?") {
		return { path, indexStatus, worktreeStatus, state: ["untracked"] };
	}

	const state: CommitFileState[] = [];
	if (indexStatus !== " " && indexStatus !== "?" && indexStatus !== "!") {
		state.push("staged");
	}
	if (
		worktreeStatus !== " " &&
		worktreeStatus !== "?" &&
		worktreeStatus !== "!"
	) {
		state.push("unstaged");
	}
	return { path, indexStatus, worktreeStatus, state };
}

function upsertFile(
	filesByPath: Map<
		string,
		{
			path: string;
			indexStatus: string;
			worktreeStatus: string;
			state: Set<CommitFileState>;
		}
	>,
	path: string,
): {
	path: string;
	indexStatus: string;
	worktreeStatus: string;
	state: Set<CommitFileState>;
} {
	const normalized = normalizeRepoPath(path);
	const current = filesByPath.get(normalized);
	if (current) return current;
	const next = {
		path: normalized,
		indexStatus: " ",
		worktreeStatus: " ",
		state: new Set<CommitFileState>(),
	};
	filesByPath.set(normalized, next);
	return next;
}

function finalizeChangedFile(file: {
	path: string;
	indexStatus: string;
	worktreeStatus: string;
	state: Set<CommitFileState>;
}): WardenCommitFile {
	const risk = analyzePathRisk(file.path);
	const state = orderedState(file.state);
	const notes = [...risk.notes];
	if (state.includes("staged") && state.includes("unstaged")) {
		notes.push("both staged and unstaged changes are present");
	}
	return {
		path: file.path,
		indexStatus: file.indexStatus,
		worktreeStatus: file.worktreeStatus,
		state,
		boundary: classifyWardenBoundary(file.path),
		risks: risk.risks,
		excludedByDefault: risk.excludedByDefault,
		notes: [...new Set(notes)],
	};
}

function orderedState(state: Set<CommitFileState>): CommitFileState[] {
	return (["staged", "unstaged", "untracked"] as const).filter((item) =>
		state.has(item),
	);
}

function summarizeDirty(files: WardenCommitFile[]): WardenCommitDirtyDetails {
	return {
		total: files.length,
		staged: files.filter((file) => file.state.includes("staged")).length,
		unstaged: files.filter((file) => file.state.includes("unstaged")).length,
		untracked: files.filter((file) => file.state.includes("untracked")).length,
	};
}

function splitLines(value: string): string[] {
	return value.split(/\r?\n/).filter((line) => line.length > 0);
}

function splitPathLines(value: string): string[] {
	return splitLines(value).map(normalizeRepoPath).filter(Boolean);
}

function normalizeStatusPath(value: string): string {
	const renamed = value.includes(" -> ") ? value.split(" -> ").pop() : value;
	return normalizeRepoPath(unquoteGitPath((renamed ?? value).trim()));
}

function unquoteGitPath(value: string): string {
	if (!value.startsWith('"') || !value.endsWith('"')) return value;
	try {
		return JSON.parse(value) as string;
	} catch {
		return value.slice(1, -1);
	}
}

function normalizeRepoPath(path: string): string {
	return path
		.replace(/\\/g, "/")
		.replace(/^@/, "")
		.replace(/^\.\//, "")
		.replace(/\/+/g, "/")
		.replace(/\/$/, "");
}

function isSecretLookingPath(path: string): boolean {
	const lower = path.toLowerCase();
	const segments = lower.split("/");
	const name = segments.at(-1) ?? lower;
	return (
		name === ".env" ||
		name.startsWith(".env.") ||
		/\.(pem|key|p12|pfx)$/.test(name) ||
		segments.includes(".ssh") ||
		lower.includes("secret") ||
		lower.includes("credential") ||
		lower.includes("token") ||
		lower.includes("private")
	);
}

function isGeneratedOrRuntimePath(path: string): boolean {
	const lower = path.toLowerCase();
	const segments = lower.split("/");
	const name = segments.at(-1) ?? lower;
	return (
		name === ".ds_store" ||
		segments.some((segment) => GENERATED_SEGMENTS.has(segment))
	);
}

async function addFilesystemRiskNotes(
	files: WardenCommitFile[],
	repoRoot: string,
): Promise<void> {
	await Promise.all(
		files.map(async (file) => {
			if (!isBinaryLookingPath(file.path)) return;
			try {
				const info = await stat(resolve(repoRoot, file.path));
				if (!info.isFile() || info.size < LARGE_BINARY_WARNING_BYTES) return;
				if (!file.risks.includes("large-binary"))
					file.risks.push("large-binary");
				file.excludedByDefault = true;
				file.notes.push(
					`binary-looking file over ${LARGE_BINARY_WARNING_BYTES} bytes`,
				);
			} catch {
				// Deleted files and inaccessible paths do not need filesystem risk notes.
			}
		}),
	);
}

function isBinaryLookingPath(path: string): boolean {
	const lower = path.toLowerCase();
	const name = basename(lower);
	const extension = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
	return BINARY_EXTENSIONS.has(extension);
}

function pushRiskWarning(
	warnings: WardenCommitWarning[],
	files: WardenCommitFile[],
	risk: string,
	level: SnapshotWarningLevel,
	code: string,
	message: string,
): void {
	const paths = files
		.filter((file) => file.risks.includes(risk))
		.map((file) => file.path);
	if (paths.length === 0) return;
	warnings.push({
		level,
		code,
		message: `${message} Paths: ${formatPathList(paths)}.`,
		paths,
	});
}

function bucketLabelForFile(file: WardenCommitFile): string {
	if (isTestPath(file.path)) return `${file.boundary}: tests`;
	return file.boundary;
}

function pathCategory(file: WardenCommitFile): string {
	if (file.risks.includes("secret-looking")) return "secret-looking path";
	if (file.risks.includes("generated-cache-build-runtime"))
		return "generated/cache/build/runtime output";
	if (file.boundary === "warden-work") return "active Warden work state";
	if (file.boundary === "warden-map") return "durable map orientation docs";
	if (isTestPath(file.path)) return "test coverage";
	if (/(^|\/)skills\//.test(file.path)) return "skills";
	if (/(^|\/)extensions\//.test(file.path)) return "extensions";
	if (/(^|\/)src\//.test(file.path)) return "source";
	if (/(^|\/)(readme|agents|changelog)\.md$/i.test(file.path)) return "docs";
	if (/(^|\/)package(-lock)?\.json$/.test(file.path)) return "package metadata";
	return "changed paths";
}

function isTestPath(path: string): boolean {
	return (
		/(^|\/)(tests?|__tests__)\//.test(path) ||
		/\.test\.[cm]?[jt]sx?$/.test(path)
	);
}

function formatCategoryList(categories: string[]): string {
	return categories.length === 0 ? "changed paths" : categories.join(" and ");
}

function formatPathList(paths: string[]): string {
	if (paths.length <= 5) return paths.join(", ");
	return `${paths.slice(0, 5).join(", ")} (+${paths.length - 5} more)`;
}

function parseRecentCommitSubjects(logOutput: string): string[] {
	return splitLines(logOutput)
		.map((line) => line.replace(/^[0-9a-f]+\s+/, "").trim())
		.filter(Boolean);
}

function formatStatusCode(file: WardenCommitFile): string {
	if (file.state.includes("untracked")) return "??";
	return `${file.indexStatus || " "}${file.worktreeStatus || " "}`;
}
