import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
	MAP_FILE_NAME,
	MAX_SCOPED_MAPS_PER_TOOL_RESULT,
	ROOT_CAPSULE_MAX_BYTES,
	ROOT_MAP_RELATIVE_PATH,
	SCOPED_CAPSULE_MAX_BYTES,
	SCOPED_INJECTION_MAX_BYTES,
	SCOPED_MAPS_RELATIVE_DIR,
} from "./constants.js";
import {
	budgetNoticeInjection,
	byteLength,
	capsuleToInjection,
	readMapCapsule,
	type MapCapsule,
	type MapInjection,
} from "./map-capsule.js";
import {
	classifyMapFreshness,
	loadMapFreshnessContext,
	type MapFreshnessContext,
} from "./map-state.js";

export * from "./map-capsule.js";
export * from "./map-state.js";

export interface ScopedMapOptions {
	maxCapsuleBytes?: number;
	maxInjectionBytes?: number;
	maxScopedMaps?: number;
}

export function resolveRepoRoot(cwd: string): string | null {
	const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
		cwd,
		encoding: "utf-8",
		timeout: 1000,
	});
	if (result.status !== 0 || result.error) return null;
	const repoRoot = result.stdout.trim();
	return repoRoot ? resolve(repoRoot) : null;
}

export function canonicalMapRoot(cwd: string): string {
	return resolveRepoRoot(cwd) ?? resolve(cwd);
}

export function toRepoRelativePath(
	cwd: string,
	inputPath: string,
	repoRoot = canonicalMapRoot(cwd),
): string | null {
	const absolutePath = absoluteInputPath(cwd, stripPathSigils(inputPath));
	const relativePath = relative(repoRoot, absolutePath);
	if (!relativePath || relativePath === "") return "";
	if (relativePath.startsWith("..") || isAbsolute(relativePath)) return null;
	return normalizeSlashes(relativePath);
}

export function rootMapPath(cwd: string): string {
	return join(canonicalMapRoot(cwd), ROOT_MAP_RELATIVE_PATH);
}

export function scopedMapRelativePath(scope: string): string {
	return scope
		? `${SCOPED_MAPS_RELATIVE_DIR}/${scope}/${MAP_FILE_NAME}`
		: ROOT_MAP_RELATIVE_PATH;
}

export function candidateScopeDirs(cwd: string, inputPath: string): string[] {
	const repoRoot = canonicalMapRoot(cwd);
	const relativePath = toRepoRelativePath(cwd, inputPath, repoRoot);
	if (relativePath === null || relativePath === "") return [];
	if (isWardenInternalPath(relativePath)) return [];
	const scopePath = scopePathForRelativePath(repoRoot, relativePath);
	if (!scopePath || scopePath === ".") return [];
	return ancestorScopePaths(scopePath);
}

export function buildRootMapInjection(cwd: string): MapInjection | null {
	const repoRoot = canonicalMapRoot(cwd);
	const freshnessContext = loadMapFreshnessContext(repoRoot);
	const capsule = readMapCapsule(
		repoRoot,
		ROOT_MAP_RELATIVE_PATH,
		ROOT_CAPSULE_MAX_BYTES,
	);
	if (capsule.status === "missing-file") return null;
	return capsuleToInjection(capsule, {
		kind: "root repository map",
		trigger: "auto-loaded at session start",
		freshness: classifyMapFreshness(capsule.relativePath, freshnessContext),
	});
}

export function collectScopedMapInjections(
	cwd: string,
	inputPath: string,
	options: ScopedMapOptions = {},
): MapInjection[] {
	const limits = scopedMapLimits(options);
	const repoRoot = canonicalMapRoot(cwd);
	const freshnessContext = loadMapFreshnessContext(repoRoot);
	const nearest = scopedMapCandidates(cwd, inputPath, repoRoot, limits);
	const injections: MapInjection[] = [];
	let used = 0;
	for (const [index, capsule] of nearest.entries()) {
		const result = nextScopedInjection(
			capsule,
			inputPath,
			used,
			limits,
			remainingCapsulePaths(nearest, index),
			freshnessContext,
		);
		injections.push(result.injection);
		if (!result.included) break;
		used += result.bytes;
	}
	return injections;
}

function absoluteInputPath(cwd: string, cleanedPath: string): string {
	return isAbsolute(cleanedPath)
		? resolve(cleanedPath)
		: resolve(cwd, cleanedPath);
}

function scopePathForRelativePath(
	repoRoot: string,
	relativePath: string,
): string {
	const absolutePath = resolve(repoRoot, relativePath);
	try {
		return statSync(absolutePath).isDirectory()
			? relativePath
			: normalizeSlashes(dirname(relativePath));
	} catch {
		return normalizeSlashes(dirname(relativePath));
	}
}

function ancestorScopePaths(scopePath: string): string[] {
	const parts = scopePath.split("/").filter(Boolean);
	return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
}

function scopedMapLimits(options: ScopedMapOptions) {
	return {
		maxCapsuleBytes: options.maxCapsuleBytes ?? SCOPED_CAPSULE_MAX_BYTES,
		maxInjectionBytes: options.maxInjectionBytes ?? SCOPED_INJECTION_MAX_BYTES,
		maxScopedMaps: options.maxScopedMaps ?? MAX_SCOPED_MAPS_PER_TOOL_RESULT,
	};
}

function scopedMapCandidates(
	cwd: string,
	inputPath: string,
	repoRoot: string,
	limits: ReturnType<typeof scopedMapLimits>,
): MapCapsule[] {
	return candidateScopeDirs(cwd, inputPath)
		.map((scope) =>
			readMapCapsule(
				repoRoot,
				scopedMapRelativePath(scope),
				limits.maxCapsuleBytes,
			),
		)
		.filter((capsule) => capsule.status !== "missing-file")
		.slice(-limits.maxScopedMaps);
}

function nextScopedInjection(
	capsule: MapCapsule,
	inputPath: string,
	used: number,
	limits: ReturnType<typeof scopedMapLimits>,
	remainingPaths: string[],
	freshnessContext: MapFreshnessContext,
): { injection: MapInjection; bytes: number; included: boolean } {
	const injection = capsuleToInjection(capsule, {
		kind: `scoped repository map for ${capsule.scope}`,
		trigger: `auto-loaded because a tool touched ${normalizeSlashes(inputPath)}`,
		freshness: classifyMapFreshness(capsule.relativePath, freshnessContext),
	});
	const bytes = byteLength(injection.message);
	if (used + bytes <= limits.maxInjectionBytes) {
		return { injection, bytes, included: true };
	}
	return {
		injection: budgetNoticeInjection(
			capsule.relativePath,
			limits.maxInjectionBytes,
			remainingPaths,
		),
		bytes: 0,
		included: false,
	};
}

function remainingCapsulePaths(
	capsules: readonly MapCapsule[],
	start: number,
): string[] {
	return capsules.slice(start).map((capsule) => capsule.relativePath);
}

function normalizeSlashes(value: string): string {
	return value.replace(/\\/g, "/");
}

function isWardenInternalPath(relativePath: string): boolean {
	const normalized = normalizeSlashes(relativePath);
	return (
		normalized === ROOT_MAP_RELATIVE_PATH ||
		normalized.startsWith(`${SCOPED_MAPS_RELATIVE_DIR}/`)
	);
}

function stripPathSigils(inputPath: string): string {
	return inputPath.replace(/^file:\/\//, "").replace(/^@/, "");
}
