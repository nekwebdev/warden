import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type ToolDefinition = Parameters<ExtensionAPI["registerTool"]>[0];

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

export const DEFAULT_RECENT_COMMITS = 10;
export const MAX_RECENT_COMMITS = 25;
export const TEXT_FILE_LIMIT = 80;
export const LARGE_BINARY_WARNING_BYTES = 1024 * 1024;

export const GENERATED_SEGMENTS = new Set([
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

export const BINARY_EXTENSIONS = new Set([
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
