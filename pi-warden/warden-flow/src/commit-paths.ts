import { stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { formatPathList } from "./commit-format.js";
import {
	BINARY_EXTENSIONS,
	GENERATED_SEGMENTS,
	LARGE_BINARY_WARNING_BYTES,
	type CommitFileState,
	type NormalizeChangedFilesInput,
	type SnapshotWarningLevel,
	type WardenCommitDirtyDetails,
	type WardenCommitFile,
	type WardenCommitSuggestedBucket,
	type WardenCommitWarning,
} from "./commit-types.js";

export function parseCommitPorcelainStatus(status: string): WardenCommitFile[] {
	return normalizeChangedFiles({ porcelainStatus: status });
}

export function normalizeChangedFiles(
	input: NormalizeChangedFilesInput,
): WardenCommitFile[] {
	const filesByPath = new Map<string, MutableCommitFile>();
	for (const line of splitLines(input.porcelainStatus)) {
		mergePorcelainLine(filesByPath, line);
	}
	mergePathList(filesByPath, input.stagedPaths, "staged");
	mergePathList(filesByPath, input.unstagedPaths, "unstaged");
	mergePathList(filesByPath, input.untrackedPaths, "untracked");
	return [...filesByPath.values()]
		.map((file) => finalizeChangedFile(file))
		.sort((left, right) => left.path.localeCompare(right.path));
}

export function classifyWardenBoundary(path: string): string {
	const normalized = normalizeRepoPath(path);
	if (!normalized) return "unknown";
	return (
		classifyWardenStatePath(normalized) ??
		classifyWardenAreaPath(normalized) ??
		classifyRepoTopLevelPath(normalized) ??
		"unknown"
	);
}

export function analyzePathRisk(path: string): {
	risks: string[];
	excludedByDefault: boolean;
	notes: string[];
} {
	const normalized = normalizeRepoPath(path);
	const analysis = emptyRiskAnalysis();
	markRisk(analysis, isSecretLookingPath(normalized), "secret-looking");
	markRisk(
		analysis,
		isGeneratedOrRuntimePath(normalized),
		"generated-cache-build-runtime",
	);
	markBoundaryRisk(analysis, classifyWardenBoundary(normalized));
	return {
		risks: [...new Set(analysis.risks)],
		excludedByDefault: analysis.excludedByDefault,
		notes: [...new Set(analysis.notes)],
	};
}

export function buildSnapshotWarnings(
	files: WardenCommitFile[],
): WardenCommitWarning[] {
	const warnings: WardenCommitWarning[] = [];
	appendMixedStateWarning(warnings, files);
	appendRiskWarning(warnings, files, {
		risk: "secret-looking",
		level: "blocker",
		code: "secret-looking-path",
		message: "Secret-looking paths are blocked by default.",
	});
	appendRiskWarning(warnings, files, {
		risk: "generated-cache-build-runtime",
		level: "warning",
		code: "generated-cache-build-runtime-path",
		message:
			"Generated, cache, build, or runtime paths are excluded by default.",
	});
	appendRiskWarning(warnings, files, {
		risk: "warden-work-state",
		level: "warning",
		code: "warden-work-excluded",
		message:
			".warden/work/** is active Warden slice state and excluded by default.",
	});
	appendRiskWarning(warnings, files, {
		risk: "large-binary",
		level: "warning",
		code: "large-binary-path",
		message:
			"Large binary-looking files need explicit review before commit planning.",
	});
	return warnings;
}

export function buildSuggestedBuckets(
	files: WardenCommitFile[],
): WardenCommitSuggestedBucket[] {
	const buckets = new Map<string, SuggestedBucketDraft>();
	for (const file of files) addFileToBucket(buckets, file);
	return [...buckets.values()]
		.map(finalizeSuggestedBucket)
		.sort((left, right) => left.label.localeCompare(right.label));
}

export function summarizeDirty(
	files: WardenCommitFile[],
): WardenCommitDirtyDetails {
	return {
		total: files.length,
		staged: countFilesWithState(files, "staged"),
		unstaged: countFilesWithState(files, "unstaged"),
		untracked: countFilesWithState(files, "untracked"),
	};
}

export function splitLines(value: string): string[] {
	return value.split(/\r?\n/).filter((line) => line.length > 0);
}

export function splitPathLines(value: string): string[] {
	return splitLines(value).map(normalizeRepoPath).filter(Boolean);
}

export function normalizeRepoPath(path: string): string {
	return path
		.replace(/\\/g, "/")
		.replace(/^@/, "")
		.replace(/^\.\//, "")
		.replace(/\/+/g, "/")
		.replace(/\/+$/, "");
}

export async function addFilesystemRiskNotes(
	files: WardenCommitFile[],
	repoRoot: string,
): Promise<void> {
	await Promise.all(files.map((file) => addFilesystemRiskNote(file, repoRoot)));
}

type MutableCommitFile = {
	path: string;
	indexStatus: string;
	worktreeStatus: string;
	state: Set<CommitFileState>;
};

type RiskAnalysis = {
	risks: string[];
	excludedByDefault: boolean;
	notes: string[];
};

type RiskWarningInput = {
	risk: string;
	level: SnapshotWarningLevel;
	code: string;
	message: string;
};

type SuggestedBucketDraft = {
	label: string;
	paths: string[];
	categories: Set<string>;
};

function mergePorcelainLine(
	filesByPath: Map<string, MutableCommitFile>,
	line: string,
): void {
	const parsed = parsePorcelainLine(line);
	if (!parsed) return;
	const file = upsertFile(filesByPath, parsed.path);
	file.indexStatus = parsed.indexStatus;
	file.worktreeStatus = parsed.worktreeStatus;
	for (const state of parsed.state) file.state.add(state);
}

function mergePathList(
	filesByPath: Map<string, MutableCommitFile>,
	paths: string[] | undefined,
	state: CommitFileState,
): void {
	for (const path of paths ?? [])
		applyPathState(upsertFile(filesByPath, path), state);
}

function applyPathState(file: MutableCommitFile, state: CommitFileState): void {
	file.state.add(state);
	if (state === "staged" && file.indexStatus === " ") file.indexStatus = "M";
	if (state === "unstaged" && file.worktreeStatus === " ") {
		file.worktreeStatus = "M";
	}
	if (state === "untracked") {
		file.indexStatus = "?";
		file.worktreeStatus = "?";
	}
}

function classifyWardenStatePath(normalized: string): string | undefined {
	if (normalized === ".warden/map.md") return "warden-map";
	if (/^\.warden\/maps\/.+\/map\.md$/.test(normalized)) return "warden-map";
	if (normalized === ".warden/work" || normalized.startsWith(".warden/work/")) {
		return "warden-work";
	}
	return undefined;
}

function classifyWardenAreaPath(normalized: string): string | undefined {
	if (normalized === "run-warden" || normalized.startsWith("run-warden/")) {
		return "run-warden";
	}
	if (normalized === "pi-warden") return "pi-warden";
	if (normalized.startsWith("pi-warden/"))
		return classifyPiWardenPath(normalized);
	if (normalized === "nix-warden" || normalized.startsWith("nix-warden/")) {
		return "nix-warden";
	}
	if (normalized === "dev-warden" || normalized.startsWith("dev-warden/")) {
		return "dev-warden";
	}
	return undefined;
}

function classifyRepoTopLevelPath(normalized: string): string | undefined {
	if (normalized === "docs" || normalized.startsWith("docs/")) return "docs";
	if (normalized === "warden" || !normalized.includes("/")) return "root";
	return undefined;
}

function classifyPiWardenPath(normalized: string): string {
	const [, packageName] = normalized.split("/");
	return packageName ? `pi-warden/${packageName}` : "pi-warden";
}

function emptyRiskAnalysis(): RiskAnalysis {
	return { risks: [], excludedByDefault: false, notes: [] };
}

function markRisk(
	analysis: RiskAnalysis,
	condition: boolean,
	risk: string,
): void {
	if (!condition) return;
	analysis.risks.push(risk);
	analysis.excludedByDefault = true;
}

function markBoundaryRisk(analysis: RiskAnalysis, boundary: string): void {
	if (boundary === "warden-work") {
		analysis.risks.push("warden-work-state");
		analysis.notes.push("active Warden slice state; excluded by default");
		analysis.excludedByDefault = true;
	}
	if (boundary === "warden-map") {
		analysis.notes.push(
			"durable Warden orientation context; not active work state",
		);
	}
}

function appendMixedStateWarning(
	warnings: WardenCommitWarning[],
	files: WardenCommitFile[],
): void {
	const mixed = files.filter(hasMixedStagedAndUnstagedState);
	if (mixed.length === 0) return;
	warnings.push({
		level: "warning",
		code: "mixed-staged-unstaged",
		message: `${formatPathList(mixed.map((file) => file.path))} have both staged and unstaged changes.`,
		paths: mixed.map((file) => file.path),
	});
}

function appendRiskWarning(
	warnings: WardenCommitWarning[],
	files: WardenCommitFile[],
	input: RiskWarningInput,
): void {
	const paths = files
		.filter((file) => file.risks.includes(input.risk))
		.map((file) => file.path);
	if (paths.length === 0) return;
	warnings.push({
		level: input.level,
		code: input.code,
		message: `${input.message} Paths: ${formatPathList(paths)}.`,
		paths,
	});
}

function addFileToBucket(
	buckets: Map<string, SuggestedBucketDraft>,
	file: WardenCommitFile,
): void {
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

function finalizeSuggestedBucket(
	bucket: SuggestedBucketDraft,
): WardenCommitSuggestedBucket {
	return {
		label: bucket.label,
		paths: bucket.paths.sort(),
		reason: `${formatCategoryList([...bucket.categories].sort())} under ${bucket.label}`,
	};
}

function countFilesWithState(
	files: WardenCommitFile[],
	state: CommitFileState,
): number {
	return files.filter((file) => file.state.includes(state)).length;
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
	const path = normalizeStatusPath(line.slice(3).trim());
	if (!path) return null;
	if (indexStatus === "?" && worktreeStatus === "?") {
		return { path, indexStatus, worktreeStatus, state: ["untracked"] };
	}
	return {
		path,
		indexStatus,
		worktreeStatus,
		state: porcelainState(indexStatus, worktreeStatus),
	};
}

function porcelainState(
	indexStatus: string,
	worktreeStatus: string,
): CommitFileState[] {
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
	return state;
}

function upsertFile(
	filesByPath: Map<string, MutableCommitFile>,
	path: string,
): MutableCommitFile {
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

function finalizeChangedFile(file: MutableCommitFile): WardenCommitFile {
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

async function addFilesystemRiskNote(
	file: WardenCommitFile,
	repoRoot: string,
): Promise<void> {
	if (!isBinaryLookingPath(file.path)) return;
	try {
		const info = await stat(resolve(repoRoot, file.path));
		if (!info.isFile() || info.size < LARGE_BINARY_WARNING_BYTES) return;
		if (!file.risks.includes("large-binary")) file.risks.push("large-binary");
		file.excludedByDefault = true;
		file.notes.push(
			`binary-looking file over ${LARGE_BINARY_WARNING_BYTES} bytes`,
		);
	} catch {
		// Deleted files and inaccessible paths do not need filesystem risk notes.
	}
}

function isBinaryLookingPath(path: string): boolean {
	const lower = path.toLowerCase();
	const name = basename(lower);
	const extension = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
	return BINARY_EXTENSIONS.has(extension);
}

function bucketLabelForFile(file: WardenCommitFile): string {
	if (isTestPath(file.path)) return `${file.boundary}: tests`;
	return file.boundary;
}

function pathCategory(file: WardenCommitFile): string {
	if (file.risks.includes("secret-looking")) return "secret-looking path";
	if (file.risks.includes("generated-cache-build-runtime")) {
		return "generated/cache/build/runtime output";
	}
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

function hasMixedStagedAndUnstagedState(file: WardenCommitFile): boolean {
	return file.state.includes("staged") && file.state.includes("unstaged");
}

function formatCategoryList(categories: string[]): string {
	return categories.length === 0 ? "changed paths" : categories.join(" and ");
}
