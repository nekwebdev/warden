import { TEXT_FILE_LIMIT } from "./commit-types.js";
import type {
	WardenCommitApplyDetails,
	WardenCommitApplyResult,
	WardenCommitFailedCommand,
	WardenCommitFile,
	WardenCommitSnapshotDetails,
} from "./commit-types.js";

export function formatWardenCommitSnapshot(
	details: WardenCommitSnapshotDetails,
	fallbackCwd?: string,
): string {
	const lines = ["## Warden Commit Snapshot", ""];

	if (!details.ok) {
		lines.push("Repo:", `- CWD: ${fallbackCwd ?? "unknown"}`);
		lines.push(`- Status: unavailable — ${details.reason ?? "unknown"}`);
		lines.push("", "Warnings:");
		for (const warning of details.warnings ?? []) {
			lines.push(`- ${warning.message}`);
		}
		return lines.join("\n");
	}

	appendSnapshotRepo(lines, details);
	appendSnapshotWarnings(lines, details);
	appendSnapshotFiles(lines, details.files ?? []);
	appendSnapshotBuckets(lines, details);
	appendRecentSubjects(lines, details);
	lines.push(
		"",
		"Snapshot hash:",
		`- ${details.snapshotHash ?? "unavailable"}`,
	);
	return lines.join("\n");
}

export function buildApplyResult(
	details: WardenCommitApplyDetails,
): WardenCommitApplyResult {
	return { text: formatWardenCommitApplyResult(details), details };
}

export function formatWardenCommitApplyResult(
	details: WardenCommitApplyDetails,
): string {
	const lines = ["## Warden Commit Apply", ""];
	lines.push(
		`Status: ${details.ok ? "committed" : `refused — ${details.reason ?? "unknown"}`}`,
	);
	appendApplyRepo(lines, details);
	appendApplySnapshot(lines, details);
	appendApplyErrors(lines, details);
	appendCreatedCommits(lines, details);
	appendFailedCommand(lines, details);
	appendFinalStatus(lines, details);
	return lines.join("\n");
}

export function formatPathList(paths: string[]): string {
	if (paths.length <= 5) return paths.join(", ");
	return `${paths.slice(0, 5).join(", ")} (+${paths.length - 5} more)`;
}

export function formatFailedCommand(
	command: WardenCommitFailedCommand,
): string {
	return `git ${command.args.map(formatCommandArg).join(" ")}`;
}

function appendSnapshotRepo(
	lines: string[],
	details: WardenCommitSnapshotDetails,
): void {
	lines.push("Repo:");
	if (details.repo) {
		lines.push(
			`- Root: ${details.repo.root}`,
			`- CWD: ${details.repo.cwd}`,
			`- Branch: ${details.repo.branch}${details.repo.detached ? " (detached HEAD)" : ""}`,
			`- HEAD: ${details.repo.head}`,
		);
	}
	if (!details.dirty) return;
	lines.push(
		`- Dirty: ${details.dirty.total > 0 ? "yes" : "no"}${dirtyDetails(details.dirty)}`,
	);
}

function dirtyDetails(
	dirty: NonNullable<WardenCommitSnapshotDetails["dirty"]>,
) {
	if (dirty.total === 0) return "";
	return ` — staged ${dirty.staged}, unstaged ${dirty.unstaged}, untracked ${dirty.untracked}`;
}

function appendSnapshotWarnings(
	lines: string[],
	details: WardenCommitSnapshotDetails,
): void {
	lines.push("", "Warnings:");
	const warnings = details.warnings ?? [];
	if (warnings.length === 0) {
		lines.push("- none");
		return;
	}
	for (const warning of warnings) lines.push(`- ${warning.message}`);
}

function appendSnapshotFiles(lines: string[], files: WardenCommitFile[]): void {
	lines.push("", "Changed files:");
	if (files.length === 0) {
		lines.push("- none");
		return;
	}
	const shown = files.slice(0, TEXT_FILE_LIMIT);
	for (const file of shown) appendFileSummary(lines, file);
	const remaining = files.length - shown.length;
	if (remaining > 0) {
		lines.push(`- ... ${remaining} more file(s) omitted from text summary`);
	}
}

function appendFileSummary(lines: string[], file: WardenCommitFile): void {
	lines.push(`- \`${formatStatusCode(file)}\` ${file.path}`);
	lines.push(`  - state: ${file.state.join(", ") || "none"}`);
	lines.push(`  - boundary: ${file.boundary}`);
	lines.push(
		`  - risk: ${file.risks.length > 0 ? file.risks.join(", ") : "none"}`,
	);
	if (file.excludedByDefault) lines.push("  - excluded by default: yes");
	if (file.notes.length > 0) lines.push(`  - notes: ${file.notes.join("; ")}`);
}

function appendSnapshotBuckets(
	lines: string[],
	details: WardenCommitSnapshotDetails,
): void {
	lines.push("", "Suggested deterministic buckets:");
	const buckets = details.suggestedBuckets ?? [];
	if (buckets.length === 0) {
		lines.push("- none");
		return;
	}
	for (const bucket of buckets) {
		lines.push(`- ${bucket.label}: ${bucket.reason}`);
		lines.push(`  - paths: ${formatPathList(bucket.paths)}`);
	}
}

function appendRecentSubjects(
	lines: string[],
	details: WardenCommitSnapshotDetails,
): void {
	lines.push("", "Recent commit subjects:");
	const subjects = details.recentCommitSubjects ?? [];
	if (subjects.length === 0) {
		lines.push("- none");
		return;
	}
	for (const subject of subjects) lines.push(`- ${subject}`);
}

function appendApplyRepo(
	lines: string[],
	details: WardenCommitApplyDetails,
): void {
	if (!details.repo) return;
	lines.push(
		"",
		"Repo:",
		`- Root: ${details.repo.root}`,
		`- Branch: ${details.repo.branch}`,
		`- HEAD before apply: ${details.repo.head}`,
	);
}

function appendApplySnapshot(
	lines: string[],
	details: WardenCommitApplyDetails,
): void {
	if (!details.requestedSnapshotHash && !details.currentSnapshotHash) return;
	lines.push("", "Snapshot:");
	if (details.requestedSnapshotHash) {
		lines.push(`- requested: ${details.requestedSnapshotHash}`);
	}
	if (details.currentSnapshotHash) {
		lines.push(`- current: ${details.currentSnapshotHash}`);
	}
}

function appendApplyErrors(
	lines: string[],
	details: WardenCommitApplyDetails,
): void {
	const errors = details.errors ?? [];
	if (errors.length === 0) return;
	lines.push("", "Errors:");
	for (const error of errors) lines.push(`- ${error}`);
}

function appendCreatedCommits(
	lines: string[],
	details: WardenCommitApplyDetails,
): void {
	const commits = details.commits ?? [];
	if (commits.length === 0) return;
	lines.push("", "Commits created:");
	for (const commit of commits) {
		lines.push(`- ${commit.hash} ${commit.subject}`);
		lines.push(`  - paths: ${formatPathList(commit.paths)}`);
	}
}

function appendFailedCommand(
	lines: string[],
	details: WardenCommitApplyDetails,
): void {
	if (!details.failedCommand) return;
	lines.push("", "Failed command:");
	lines.push(`- ${formatFailedCommand(details.failedCommand)}`);
	if (details.failedCommand.stderr) {
		lines.push(`- stderr: ${details.failedCommand.stderr}`);
	}
}

function appendFinalStatus(
	lines: string[],
	details: WardenCommitApplyDetails,
): void {
	if (details.finalStatus !== undefined) {
		lines.push("", "Final git status --short:", "```text");
		lines.push(
			details.finalStatus.length > 0 ? details.finalStatus : "(clean)",
		);
		lines.push("```");
		return;
	}
	if (!details.ok) {
		lines.push("", "Mutation:", "- no git state was changed before refusal");
	}
}

function formatStatusCode(file: WardenCommitFile): string {
	if (file.state.includes("untracked")) return "??";
	return `${file.indexStatus || " "}${file.worktreeStatus || " "}`;
}

function formatCommandArg(arg: string): string {
	if (/^[A-Za-z0-9_./:=@,+-]+$/.test(arg)) return arg;
	return JSON.stringify(arg);
}
