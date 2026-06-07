import { formatPathList } from "./commit-format.js";
import { normalizeRepoPath } from "./commit-paths.js";
import type {
	WardenCommitApplyDetails,
	WardenCommitApplyParams,
	WardenCommitApplyPlanCommit,
	WardenCommitApplyValidation,
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

export function validateCurrentSnapshotForApply(
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

function cloneCommitPlan(
	commits: WardenCommitApplyPlanCommit[],
): WardenCommitApplyPlanCommit[] {
	return commits.map((commit) => ({
		subject: commit.subject,
		...(commit.body !== undefined ? { body: commit.body } : {}),
		paths: [...commit.paths],
	}));
}

export function exactPathSetErrors(
	expected: string[],
	actual: string[],
): string[] {
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

type CommitValidation = {
	commits: WardenCommitApplyPlanCommit[];
	errors: string[];
};

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
