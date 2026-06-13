import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { applyWardenCommitPlan } from "./commit-apply.js";
import { loadWardenCommitSnapshot } from "./commit-snapshot.js";
import type { CommitGitExec, ToolDefinition } from "./commit-types.js";
import { isSafeBranchCloseBranchName } from "./branch-close-handoff.js";

export type BranchCloseMapImpact = "none" | "scoped-refresh" | "root-refresh";
export type BranchCloseResultStatus =
	| "closed"
	| "needs_map_refresh"
	| "blocked"
	| "partial_success";

export interface BranchCloseArgs {
	featureBranch: string;
	defaultBranch?: string;
	maps: BranchCloseMapImpact;
	mapsScope: string;
	packetPath?: string;
	packetName?: string;
	cwd: string;
	branchCloseDestructiveConsent?: boolean;
	branchCloseAutoCommitConsent?: boolean;
}

export interface BranchCloseGitResult {
	code?: number | null;
	stdout: string;
	stderr?: string;
}

export interface BranchCloseCommandRunner {
	git(args: string[], cwd: string): Promise<BranchCloseGitResult>;
}

export interface BranchCloseSnapshotFile {
	path: string;
	state?: string[];
	risks?: string[];
	excludedByDefault?: boolean;
}

export interface BranchCloseSnapshotBucket {
	label: string;
	paths: string[];
	reason: string;
}

export interface BranchCloseSnapshotWarning {
	level?: string;
	code?: string;
	message?: string;
}

export interface BranchCloseSnapshot {
	ok: boolean;
	reason?: string;
	snapshotHash?: string;
	dirty?: { total?: number };
	warnings?: BranchCloseSnapshotWarning[];
	files?: BranchCloseSnapshotFile[];
	suggestedBuckets?: BranchCloseSnapshotBucket[];
}

export interface BranchCloseApplyPlan {
	snapshotHash: string;
	commits: Array<{ subject: string; paths: string[]; body?: string }>;
}

export interface BranchCloseApplyResult {
	ok: boolean;
	summary?: string;
	reason?: string;
}

export interface BranchCloseCommitAdapter {
	snapshot(cwd: string): Promise<BranchCloseSnapshot>;
	apply(
		cwd: string,
		plan: BranchCloseApplyPlan,
	): Promise<BranchCloseApplyResult>;
}

export interface BranchCloseResult {
	status: BranchCloseResultStatus;
	summary: string;
	commandsRun: string[];
	commandPlan: string[];
	nextSafeCommand?: string;
	failedStep?: string;
	warning?: string;
}

export interface BranchCloseDependencies {
	runner: BranchCloseCommandRunner;
	commit: BranchCloseCommitAdapter;
}

export type BranchCloseValidation =
	| { ok: true; value: BranchCloseArgs }
	| { ok: false; errors: string[] };

const GENERATED_AUTO_COMMIT_SEGMENTS = new Set([
	"node_modules",
	"dist",
	"build",
	"coverage",
]);

const SECRET_LOOKING_PATH_PATTERN =
	/(^|[/._-])(secret|secrets|token|credential|credentials|password|passwd|api[_-]?key|private[_-]?key|\.env)([/._-]|$)/i;

const BRANCH_CLOSE_PARAMETERS = {
	type: "object",
	additionalProperties: false,
	required: ["featureBranch", "maps", "mapsScope", "cwd"],
	properties: {
		featureBranch: { type: "string", minLength: 1 },
		defaultBranch: { type: "string" },
		maps: { enum: ["none", "scoped-refresh", "root-refresh"] },
		mapsScope: { type: "string", minLength: 1 },
		packetPath: { type: "string" },
		packetName: { type: "string" },
		cwd: { type: "string", minLength: 1 },
		branchCloseDestructiveConsent: { type: "boolean" },
		branchCloseAutoCommitConsent: { type: "boolean" },
	},
} as ToolDefinition["parameters"];

export function validateBranchCloseArgs(input: unknown): BranchCloseValidation {
	const errors: string[] = [];
	if (!isPlainObject(input)) {
		return { ok: false, errors: ["input must be an object"] };
	}
	const args = input as Record<string, unknown>;
	const featureBranch = readString(args.featureBranch);
	const defaultBranch = readOptionalString(args.defaultBranch);
	const maps = args.maps;
	const mapsScope = readString(args.mapsScope);
	const cwd = readString(args.cwd);
	if (!featureBranch || !isSafeBranchCloseBranchName(featureBranch)) {
		errors.push("featureBranch is not a safe branch name");
	}
	if (
		defaultBranch !== undefined &&
		!isSafeBranchCloseBranchName(defaultBranch)
	) {
		errors.push("defaultBranch is not a safe branch name");
	}
	if (maps !== "none" && maps !== "scoped-refresh" && maps !== "root-refresh") {
		errors.push("maps must be none, scoped-refresh, or root-refresh");
	}
	if (!cwd) errors.push("cwd is required");
	if (typeof maps === "string" && !isValidMapPair(maps, mapsScope)) {
		errors.push("invalid map pair");
	}
	if (errors.length > 0) return { ok: false, errors };
	return {
		ok: true,
		value: {
			featureBranch,
			...(defaultBranch ? { defaultBranch } : {}),
			maps: maps as BranchCloseMapImpact,
			mapsScope,
			...(readOptionalString(args.packetPath)
				? { packetPath: readOptionalString(args.packetPath) }
				: {}),
			...(readOptionalString(args.packetName)
				? { packetName: readOptionalString(args.packetName) }
				: {}),
			cwd,
			branchCloseDestructiveConsent:
				args.branchCloseDestructiveConsent === true,
			branchCloseAutoCommitConsent: args.branchCloseAutoCommitConsent === true,
		},
	};
}

export async function closeWardenBranch(
	input: unknown,
	deps: BranchCloseDependencies,
): Promise<BranchCloseResult> {
	const validation = validateBranchCloseArgs(input);
	if (!validation.ok)
		return blocked(
			`invalid arguments: ${validation.errors.join("; ")}`,
			[],
			[],
			"Fix structured warden_branch_close arguments and rerun.",
		);
	const args = validation.value;
	const commandsRun: string[] = [];
	const commandPlan: string[] = [];

	if (args.branchCloseDestructiveConsent !== true) {
		return blocked(
			"blocked: missing branch-close destructive consent",
			commandsRun,
			commandPlan,
			`Rerun /skill:warden-close ${args.packetPath ?? "<packet.md>"} and accept branch close to produce branchCloseDestructiveConsent: true.`,
		);
	}

	const snapshot = await deps.commit.snapshot(args.cwd);
	commandsRun.push("warden_commit_snapshot");
	if (!snapshot.ok) {
		return blocked(
			`snapshot unavailable: ${snapshot.reason ?? "unknown"}`,
			commandsRun,
			commandPlan,
			commitNextSafeCommand(args),
		);
	}
	const dirtyTotal = snapshot.dirty?.total ?? 0;
	if (dirtyTotal > 0) {
		if (args.branchCloseAutoCommitConsent !== true) {
			return blocked(
				"blocked: dirty work requires branch-close auto-commit consent",
				commandsRun,
				commandPlan,
				commitNextSafeCommand(args, true),
			);
		}
		const safeCommit = safeAutoCommitPlan(snapshot, args);
		if (!safeCommit.ok) {
			return blocked(
				`blocked: ${safeCommit.reason}`,
				commandsRun,
				commandPlan,
				commitNextSafeCommand(args),
			);
		}
		const applied = await deps.commit.apply(args.cwd, safeCommit.plan);
		commandsRun.push("warden_commit_apply");
		if (!applied.ok) {
			return blocked(
				`blocked: auto-commit failed: ${applied.reason ?? applied.summary ?? "unknown"}`,
				commandsRun,
				commandPlan,
				commitNextSafeCommand(args),
			);
		}
	}

	const defaultBranch =
		args.defaultBranch ?? (await detectDefaultBranch(deps.runner, args.cwd));
	if (!isSafeBranchCloseBranchName(defaultBranch)) {
		return blocked(
			"blocked: detected default branch is unsafe",
			commandsRun,
			commandPlan,
			"Provide a safe explicit defaultBranch and rerun warden_branch_close.",
		);
	}
	const currentBranch = await currentBranchName(deps.runner, args.cwd);
	commandPlan.push("git rev-parse --abbrev-ref HEAD");
	if (!currentBranch || currentBranch === "HEAD") {
		return blocked(
			"blocked: detached HEAD",
			commandsRun,
			commandPlan,
			"Switch to the feature branch and rerun warden_branch_close.",
		);
	}
	if (currentBranch === defaultBranch) {
		return blocked(
			"blocked: current branch is the default branch",
			commandsRun,
			commandPlan,
			"Switch to the feature branch and rerun warden_branch_close.",
		);
	}
	if (currentBranch !== args.featureBranch) {
		return blocked(
			"blocked: current branch does not match featureBranch",
			commandsRun,
			commandPlan,
			"Rerun warden_branch_close from the supplied feature branch worktree.",
		);
	}

	if (args.maps !== "none") {
		return {
			status: "needs_map_refresh",
			summary: "map refresh required before branch close",
			commandsRun,
			commandPlan,
			nextSafeCommand: mapRefreshNextSafeCommand(args),
		};
	}

	const worktrees = await loadWorktrees(deps.runner, args.cwd);
	commandPlan.push("git worktree list --porcelain");
	const defaultWorktree = worktrees.find(
		(item) => item.branch === defaultBranch,
	);
	const featureWorktree = worktrees.find(
		(item) => item.branch === args.featureBranch,
	);
	const isMultiWorktree = worktrees.length > 1;
	const defaultCwd = defaultWorktree?.path ?? args.cwd;
	const featureCwd = featureWorktree?.path ?? args.cwd;
	if (isMultiWorktree && !defaultWorktree) {
		return blocked(
			"blocked: missing default worktree",
			commandsRun,
			commandPlan,
			`Open or create a ${defaultBranch} worktree, then rerun warden_branch_close.`,
		);
	}

	const fetch = await runGitStep(
		deps.runner,
		args.cwd,
		["fetch", "origin"],
		commandsRun,
		commandPlan,
	);
	if (!fetch.ok)
		return stepBlocked("git fetch origin", fetch, commandsRun, commandPlan);

	if (defaultWorktree) {
		const sync = await runGitStep(
			deps.runner,
			defaultCwd,
			["merge", "--ff-only", `origin/${defaultBranch}`],
			commandsRun,
			commandPlan,
		);
		if (!sync.ok)
			return stepBlocked(
				`git merge --ff-only origin/${defaultBranch}`,
				sync,
				commandsRun,
				commandPlan,
				"Default branch is not fast-forward-only syncable; resolve divergence manually.",
			);
		const rebase = await runGitStep(
			deps.runner,
			featureCwd,
			["rebase", `origin/${defaultBranch}`],
			commandsRun,
			commandPlan,
		);
		if (!rebase.ok)
			return stepBlocked(
				`git rebase origin/${defaultBranch}`,
				rebase,
				commandsRun,
				commandPlan,
			);
	} else {
		const rebase = await runGitStep(
			deps.runner,
			featureCwd,
			["rebase", `origin/${defaultBranch}`],
			commandsRun,
			commandPlan,
		);
		if (!rebase.ok)
			return stepBlocked(
				`git rebase origin/${defaultBranch}`,
				rebase,
				commandsRun,
				commandPlan,
			);
		const switched = await runGitStep(
			deps.runner,
			args.cwd,
			["switch", defaultBranch],
			commandsRun,
			commandPlan,
		);
		if (!switched.ok)
			return stepBlocked(
				`git switch ${defaultBranch}`,
				switched,
				commandsRun,
				commandPlan,
			);
		const sync = await runGitStep(
			deps.runner,
			args.cwd,
			["merge", "--ff-only", `origin/${defaultBranch}`],
			commandsRun,
			commandPlan,
		);
		if (!sync.ok)
			return stepBlocked(
				`git merge --ff-only origin/${defaultBranch}`,
				sync,
				commandsRun,
				commandPlan,
				"Default branch is not fast-forward-only syncable; resolve divergence manually.",
			);
	}

	const merge = await runGitStep(
		deps.runner,
		defaultCwd,
		["merge", "--no-ff", "--no-edit", args.featureBranch],
		commandsRun,
		commandPlan,
	);
	if (!merge.ok)
		return stepBlocked(
			`git merge --no-ff --no-edit ${args.featureBranch}`,
			merge,
			commandsRun,
			commandPlan,
		);
	const push = await runGitStep(
		deps.runner,
		defaultCwd,
		["push", "origin", defaultBranch],
		commandsRun,
		commandPlan,
	);
	if (!push.ok)
		return stepBlocked(
			`git push origin ${defaultBranch}`,
			push,
			commandsRun,
			commandPlan,
		);

	const cleanup = await cleanupBranch(args, deps.runner, {
		commandsRun,
		commandPlan,
		defaultCwd,
		featureCwd,
		removeFeatureWorktree: Boolean(
			defaultWorktree && featureCwd !== defaultCwd,
		),
	});
	if (cleanup.status === "partial_success") return cleanup;
	return {
		status: "closed",
		summary: "branch closed, default branch pushed, cleanup complete",
		commandsRun,
		commandPlan,
		...(cleanup.warning ? { warning: cleanup.warning } : {}),
	};
}

export function registerWardenBranchClose(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "warden_branch_close",
		label: "Warden Branch Close",
		description:
			"Safely close a Warden feature branch after accepted packet close handoff.",
		promptSnippet:
			"Close a Warden feature branch only from structured post-close handoff arguments and exact consent markers.",
		promptGuidelines: [
			"Missing branchCloseDestructiveConsent blocks all mutating branch-close commands.",
			"Missing branchCloseAutoCommitConsent blocks auto-commit when dirty work exists.",
		],
		parameters: BRANCH_CLOSE_PARAMETERS,
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const result = await closeWardenBranch(params, {
				runner: {
					git: async (args, cwd) =>
						pi.exec("git", args, {
							cwd,
							signal,
						}) as Promise<BranchCloseGitResult>,
				},
				commit: createPiCommitAdapter(pi, ctx.cwd, signal),
			});
			return {
				content: [{ type: "text", text: formatBranchCloseResult(result) }],
				details: result,
			};
		},
	});
}

function createPiCommitAdapter(
	pi: ExtensionAPI,
	baseCwd: string,
	signal: AbortSignal | undefined,
): BranchCloseCommitAdapter {
	const exec: CommitGitExec = (command, args, options) =>
		pi.exec(command, args, { ...options, signal: options?.signal ?? signal });
	return {
		async snapshot(cwd) {
			const snapshot = await loadWardenCommitSnapshot(exec, {
				cwd,
				includeRecentCommits: 0,
				signal,
			});
			return snapshot.details as BranchCloseSnapshot;
		},
		async apply(cwd, plan) {
			const result = await applyWardenCommitPlan(exec, {
				baseCwd,
				input: { cwd, ...plan },
				signal,
			});
			return {
				ok: result.details.ok,
				summary: result.text,
				reason: result.details.reason,
			};
		},
	};
}

function readString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(value: unknown): string | undefined {
	const text = readString(value);
	return text || undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidMapPair(maps: string, mapsScope: string): boolean {
	if (maps === "none") return mapsScope === "none";
	if (maps === "root-refresh") return mapsScope === "root";
	if (maps === "scoped-refresh") return isSafeMapScope(mapsScope);
	return false;
}

function isSafeMapScope(scope: string): boolean {
	if (!scope || scope === "none" || scope === "root") return false;
	if (scope.startsWith("/") || scope.startsWith("-") || scope.endsWith("/"))
		return false;
	if (!/^[A-Za-z0-9._/-]+$/.test(scope)) return false;
	if (scope.includes("..") || scope.includes("//") || scope.includes("\\"))
		return false;
	return scope
		.split("/")
		.every((part) => part && part !== "." && part !== "..");
}

function blocked(
	summary: string,
	commandsRun: string[],
	commandPlan: string[],
	nextSafeCommand: string,
): BranchCloseResult {
	return {
		status: "blocked",
		summary,
		commandsRun,
		commandPlan,
		nextSafeCommand,
	};
}

function commitNextSafeCommand(args: BranchCloseArgs, auto = false): string {
	const target = args.packetName ?? args.packetPath ?? args.featureBranch;
	return auto
		? `/skill:warden-commit --auto ${target}`
		: `/skill:warden-commit ${target}`;
}

function mapRefreshNextSafeCommand(args: BranchCloseArgs): string {
	const mapCommand =
		args.maps === "root-refresh"
			? "/skill:warden-map --auto"
			: `/skill:warden-map --auto ${args.mapsScope}`;
	return `${mapCommand}; then /skill:warden-commit --auto map refresh; then rerun warden_branch_close with same structured arguments.`;
}

function safeAutoCommitPlan(
	snapshot: BranchCloseSnapshot,
	args: BranchCloseArgs,
): { ok: true; plan: BranchCloseApplyPlan } | { ok: false; reason: string } {
	const warnings = snapshot.warnings ?? [];
	if (warnings.some((warning) => warning.level !== "info")) {
		return { ok: false, reason: "snapshot has warnings" };
	}
	const files = snapshot.files ?? [];
	if (
		files.some(
			(file) => file.excludedByDefault || (file.risks ?? []).length > 0,
		)
	) {
		return { ok: false, reason: "snapshot has risky or excluded paths" };
	}
	if (files.some((file) => isUnsafeAutoCommitPath(file.path))) {
		return {
			ok: false,
			reason: "snapshot has hidden, generated, or secret-looking paths",
		};
	}
	if (
		files.some(
			(file) =>
				(file.state ?? []).includes("staged") &&
				(file.state ?? []).includes("unstaged"),
		)
	) {
		return { ok: false, reason: "snapshot has staged and unstaged ambiguity" };
	}
	const buckets = snapshot.suggestedBuckets ?? [];
	if (buckets.length !== 1)
		return {
			ok: false,
			reason: "snapshot does not have exactly one safe bucket",
		};
	const bucket = buckets[0];
	if (!bucket || bucket.paths.length === 0)
		return { ok: false, reason: "safe bucket is empty" };
	const filePaths = new Set(files.map((file) => file.path));
	if (bucket.paths.some((path) => !filePaths.has(path))) {
		return { ok: false, reason: "bucket paths do not match snapshot files" };
	}
	if (!snapshot.snapshotHash)
		return { ok: false, reason: "snapshot hash missing" };
	return {
		ok: true,
		plan: {
			snapshotHash: snapshot.snapshotHash,
			commits: [
				{
					subject: `Close ${args.packetName ?? args.featureBranch} packet work`,
					paths: bucket.paths,
				},
			],
		},
	};
}

function isUnsafeAutoCommitPath(path: string): boolean {
	const segments = path.split("/").filter(Boolean);
	if (segments.some((segment) => segment.startsWith("."))) return true;
	if (segments.some((segment) => GENERATED_AUTO_COMMIT_SEGMENTS.has(segment))) {
		return true;
	}
	return SECRET_LOOKING_PATH_PATTERN.test(path);
}

async function detectDefaultBranch(
	runner: BranchCloseCommandRunner,
	cwd: string,
): Promise<string> {
	const result = await runner.git(
		["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"],
		cwd,
	);
	if ((result.code ?? 0) === 0) {
		const branch = result.stdout.trim().replace(/^origin\//, "");
		if (branch) return branch;
	}
	return "main";
}

async function currentBranchName(
	runner: BranchCloseCommandRunner,
	cwd: string,
): Promise<string | undefined> {
	const result = await runner.git(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
	if ((result.code ?? 0) !== 0) return undefined;
	return result.stdout.trim() || undefined;
}

interface WorktreeEntry {
	path: string;
	branch: string;
}

async function loadWorktrees(
	runner: BranchCloseCommandRunner,
	cwd: string,
): Promise<WorktreeEntry[]> {
	const result = await runner.git(["worktree", "list", "--porcelain"], cwd);
	if ((result.code ?? 0) !== 0) return [{ path: cwd, branch: "" }];
	const entries: WorktreeEntry[] = [];
	let path: string | undefined;
	for (const line of result.stdout.split(/\r?\n/)) {
		if (line.startsWith("worktree "))
			path = line.slice("worktree ".length).trim();
		if (line.startsWith("branch ") && path) {
			entries.push({
				path,
				branch: line
					.slice("branch ".length)
					.trim()
					.replace(/^refs\/heads\//, ""),
			});
			path = undefined;
		}
	}
	return entries.length > 0 ? entries : [{ path: cwd, branch: "" }];
}

async function runGitStep(
	runner: BranchCloseCommandRunner,
	cwd: string,
	args: string[],
	commandsRun: string[],
	commandPlan: string[],
): Promise<BranchCloseGitResult & { ok: boolean }> {
	commandPlan.push(`git ${args.join(" ")}`);
	const result = await runner.git(args, cwd);
	commandsRun.push(`git ${args.join(" ")}`);
	return { ...result, ok: (result.code ?? 0) === 0 };
}

function stepBlocked(
	step: string,
	result: BranchCloseGitResult,
	commandsRun: string[],
	commandPlan: string[],
	nextSafeCommand = "Resolve the failed git step manually, then rerun warden_branch_close.",
): BranchCloseResult {
	return {
		status: "blocked",
		summary: `blocked: ${step} failed${result.stderr ? `: ${result.stderr}` : ""}`,
		commandsRun,
		commandPlan,
		failedStep: step,
		nextSafeCommand,
	};
}

async function cleanupBranch(
	args: BranchCloseArgs,
	runner: BranchCloseCommandRunner,
	ctx: {
		commandsRun: string[];
		commandPlan: string[];
		defaultCwd: string;
		featureCwd: string;
		removeFeatureWorktree: boolean;
	},
): Promise<BranchCloseResult | { status: "clean"; warning?: string }> {
	const warning = ctx.removeFeatureWorktree
		? "current worktree removed; close this worktree pi agent"
		: undefined;
	const cleanupSteps: Array<{ args: string[]; manual: string }> = [];
	if (ctx.removeFeatureWorktree) {
		cleanupSteps.push({
			args: ["worktree", "remove", ctx.featureCwd],
			manual: `git worktree remove ${ctx.featureCwd}`,
		});
	}
	cleanupSteps.push(
		{
			args: ["branch", "-d", args.featureBranch],
			manual: `git branch -d ${args.featureBranch}`,
		},
		{
			args: ["push", "origin", "--delete", args.featureBranch],
			manual: `git push origin --delete ${args.featureBranch}`,
		},
	);
	for (const step of cleanupSteps) {
		const result = await runGitStep(
			runner,
			ctx.defaultCwd,
			step.args,
			ctx.commandsRun,
			ctx.commandPlan,
		);
		if (!result.ok) {
			return {
				status: "partial_success",
				summary: `merge/push succeeded; cleanup incomplete at ${step.manual}`,
				commandsRun: ctx.commandsRun,
				commandPlan: ctx.commandPlan,
				failedStep: step.manual,
				nextSafeCommand: step.manual,
				...(warning ? { warning } : {}),
			};
		}
	}
	return { status: "clean", warning };
}

function formatBranchCloseResult(result: BranchCloseResult): string {
	const lines = [
		`Status: ${result.status}`,
		`Summary: ${result.summary}`,
		`Commands run: ${result.commandsRun.length > 0 ? result.commandsRun.join("; ") : "none"}`,
		`Command plan: ${result.commandPlan.length > 0 ? result.commandPlan.join("; ") : "none"}`,
	];
	if (result.nextSafeCommand)
		lines.push(`Next safe command: ${result.nextSafeCommand}`);
	if (result.failedStep) lines.push(`Failed step: ${result.failedStep}`);
	if (result.warning) lines.push(`Warning: ${result.warning}`);
	return lines.join("\n");
}
