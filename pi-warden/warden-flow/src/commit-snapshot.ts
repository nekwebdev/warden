import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { GIT_EXEC_TIMEOUT_MS } from "./constants.js";
import { formatWardenCommitSnapshot } from "./commit-format.js";
import {
	addFilesystemRiskNotes,
	buildSnapshotWarnings,
	buildSuggestedBuckets,
	normalizeChangedFiles,
	splitLines,
	splitPathLines,
	summarizeDirty,
} from "./commit-paths.js";
import {
	DEFAULT_RECENT_COMMITS,
	MAX_RECENT_COMMITS,
	type CommitGitExec,
	type SnapshotHashInput,
	type WardenCommitFile,
	type WardenCommitRepoDetails,
	type WardenCommitSnapshot,
	type WardenCommitSnapshotDetails,
	type WardenCommitSnapshotParams,
} from "./commit-types.js";

export async function loadWardenCommitSnapshot(
	exec: CommitGitExec,
	options: {
		cwd: string;
		includeRecentCommits?: number;
		signal?: AbortSignal;
	},
): Promise<WardenCommitSnapshot> {
	const targetCwd = resolve(options.cwd);
	const git = gitSnapshotProbe(exec, options.signal);
	if (!(await git.isInsideWorkTree(targetCwd))) {
		return unavailableSnapshot(targetCwd, "not-a-git-repo");
	}

	const root = (await git.repoRoot(targetCwd)) ?? targetCwd;
	const raw = await git.snapshotRawData(root, options.includeRecentCommits);
	const repo = repoDetails(root, targetCwd, raw.branch, raw.head);
	const files = normalizeChangedFiles({
		porcelainStatus: raw.status,
		stagedPaths: splitPathLines(raw.staged),
		unstagedPaths: splitPathLines(raw.unstaged),
		untrackedPaths: splitPathLines(raw.untracked),
	});
	await addFilesystemRiskNotes(files, root);

	const details: WardenCommitSnapshotDetails = {
		ok: true,
		repo,
		dirty: summarizeDirty(files),
		files,
		warnings: buildSnapshotWarnings(files),
		suggestedBuckets: buildSuggestedBuckets(files),
		recentCommitSubjects: parseRecentCommitSubjects(raw.log),
		snapshotHash: buildSnapshotHash({
			repoRoot: repo.root,
			cwd: repo.cwd,
			branch: repo.branch,
			head: repo.head,
			detached: repo.detached,
			statusLines: splitLines(raw.status),
			files: files.map(snapshotHashFileInput),
		}),
	};
	return { text: formatWardenCommitSnapshot(details), details };
}

export function buildSnapshotHash(input: SnapshotHashInput): string {
	const stable = {
		repoRoot: input.repoRoot,
		cwd: input.cwd,
		branch: input.branch,
		head: input.head,
		detached: input.detached,
		statusLines: [...input.statusLines].sort(),
		files: input.files.map(stableSnapshotFile).sort(compareSnapshotFiles),
	};
	return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export function normalizeSnapshotParams(
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

export function resolveSnapshotCwd(
	baseCwd: string,
	requestedCwd: string | undefined,
): string {
	if (!requestedCwd) return resolve(baseCwd);
	const normalized = requestedCwd.startsWith("@")
		? requestedCwd.slice(1)
		: requestedCwd;
	return resolve(baseCwd, normalized);
}

type SnapshotRawData = {
	branch: string;
	head: string;
	status: string;
	staged: string;
	unstaged: string;
	untracked: string;
	log: string;
};

function gitSnapshotProbe(
	exec: CommitGitExec,
	signal: AbortSignal | undefined,
) {
	const safe = (cwd: string, args: string[]) =>
		safeGit(exec, cwd, args, signal);
	return {
		async isInsideWorkTree(cwd: string) {
			return (
				(await safe(cwd, ["rev-parse", "--is-inside-work-tree"]))?.trim() ===
				"true"
			);
		},
		repoRoot(cwd: string) {
			return safe(cwd, ["rev-parse", "--show-toplevel"]).then(
				(value) => value?.trim() || null,
			);
		},
		async snapshotRawData(root: string, includeRecentCommits?: number) {
			const recentCount = normalizeRecentCommitCount(includeRecentCommits);
			const [branch, head, status, staged, unstaged, untracked, log] =
				await Promise.all([
					safe(root, ["rev-parse", "--abbrev-ref", "HEAD"]),
					safe(root, ["rev-parse", "--short", "HEAD"]),
					safe(root, ["status", "--porcelain=v1"]),
					safe(root, ["diff", "--name-only", "--staged"]),
					safe(root, ["diff", "--name-only"]),
					safe(root, ["ls-files", "--others", "--exclude-standard"]),
					recentLog(safe, root, recentCount),
				]);
			return {
				branch: branch ?? "",
				head: head ?? "",
				status: status ?? "",
				staged: staged ?? "",
				unstaged: unstaged ?? "",
				untracked: untracked ?? "",
				log: log ?? "",
			} satisfies SnapshotRawData;
		},
	};
}

function unavailableSnapshot(
	targetCwd: string,
	reason: string,
): WardenCommitSnapshot {
	const details: WardenCommitSnapshotDetails = {
		ok: false,
		reason,
		warnings: [
			{
				level: "blocker",
				code: reason,
				message: `${targetCwd} is not inside a git repository.`,
			},
		],
	};
	return { text: formatWardenCommitSnapshot(details, targetCwd), details };
}

function repoDetails(
	root: string,
	targetCwd: string,
	branchRaw: string,
	headRaw: string,
): WardenCommitRepoDetails {
	const branchValue = branchRaw.trim() || "unknown";
	const detached = branchValue === "HEAD";
	return {
		root,
		cwd: targetCwd,
		branch: detached ? "detached" : branchValue,
		head: headRaw.trim() || "no-commit",
		detached,
	};
}

function snapshotHashFileInput(
	file: WardenCommitFile,
): SnapshotHashInput["files"][number] {
	return {
		path: file.path,
		indexStatus: file.indexStatus,
		worktreeStatus: file.worktreeStatus,
		state: file.state,
	};
}

function stableSnapshotFile(file: SnapshotHashInput["files"][number]) {
	return {
		path: file.path,
		indexStatus: file.indexStatus,
		worktreeStatus: file.worktreeStatus,
		state: [...file.state].sort(),
	};
}

function compareSnapshotFiles(
	left: ReturnType<typeof stableSnapshotFile>,
	right: ReturnType<typeof stableSnapshotFile>,
): number {
	return left.path.localeCompare(right.path);
}

function normalizeRecentCommitCount(value: number | undefined): number {
	if (!Number.isFinite(value)) return DEFAULT_RECENT_COMMITS;
	return Math.max(0, Math.min(MAX_RECENT_COMMITS, Math.floor(value ?? 0)));
}

function recentLog(
	safe: (cwd: string, args: string[]) => Promise<string | null>,
	root: string,
	recentCount: number,
): Promise<string | null> {
	return recentCount > 0
		? safe(root, ["log", "--oneline", "-n", String(recentCount)])
		: Promise.resolve("");
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
		if (
			typeof result.code === "number" &&
			result.code !== 0 &&
			!result.stdout
		) {
			return null;
		}
		return result.stdout ?? "";
	} catch {
		return null;
	}
}

function parseRecentCommitSubjects(logOutput: string): string[] {
	return splitLines(logOutput)
		.map((line) => line.replace(/^[0-9a-f]+\s+/, "").trim())
		.filter(Boolean);
}
