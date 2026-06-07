import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { GIT_EXEC_TIMEOUT_MS, MAP_STATE_RELATIVE_PATH } from "./constants.js";

export type MapFreshnessVerdict = "fresh" | "stale" | "unknown";

export interface MapState {
	version: 1;
	head: string;
	generatedAt: string;
	maps: Record<string, string>;
}

export type MapStateLoadStatus = "ok" | "missing" | "invalid" | "unsupported";

export interface LoadedMapState {
	repoRoot: string;
	status: MapStateLoadStatus;
	state: MapState | null;
}

export interface MapFreshnessContext extends LoadedMapState {
	currentHead: string | null;
}

export interface MapFreshness {
	verdict: MapFreshnessVerdict;
	mapBasis: string | null;
	currentHead: string | null;
}

export function loadMapState(cwd: string): LoadedMapState {
	const repoRoot = resolveMapStateRoot(cwd);
	const markerPath = join(repoRoot, MAP_STATE_RELATIVE_PATH);
	if (!existsSync(markerPath)) {
		return { repoRoot, status: "missing", state: null };
	}

	try {
		const parsed = JSON.parse(readFileSync(markerPath, "utf-8")) as unknown;
		const shape = parseMapStateShape(parsed);
		if (shape.status !== "ok") {
			return { repoRoot, status: shape.status, state: null };
		}
		return { repoRoot, status: "ok", state: shape.state };
	} catch {
		return { repoRoot, status: "invalid", state: null };
	}
}

export function loadMapFreshnessContext(cwd: string): MapFreshnessContext {
	const loaded = loadMapState(cwd);
	return {
		...loaded,
		currentHead: readCurrentGitHead(loaded.repoRoot),
	};
}

export function classifyMapFreshness(
	relativeMapPath: string,
	context: MapFreshnessContext,
): MapFreshness {
	if (!context.currentHead || context.status !== "ok" || !context.state) {
		return unknownFreshness(context.currentHead);
	}

	const mapBasis =
		context.state.maps[normalizeSlashes(relativeMapPath)] ?? null;
	if (!mapBasis) {
		return unknownFreshness(context.currentHead);
	}

	if (
		context.state.head !== context.currentHead ||
		mapBasis !== context.currentHead
	) {
		return { verdict: "stale", mapBasis, currentHead: context.currentHead };
	}

	return { verdict: "fresh", mapBasis, currentHead: context.currentHead };
}

export function formatFreshnessLines(freshness: MapFreshness): string {
	return [
		`Freshness: ${freshness.verdict}`,
		`Map basis: ${shortSha(freshness.mapBasis)}`,
		`Current HEAD: ${shortSha(freshness.currentHead)}`,
	].join("\n");
}

export function shortSha(sha: string | null | undefined): string {
	return sha ? sha.slice(0, 7) : "unknown";
}

function parseMapStateShape(
	value: unknown,
): { status: "ok"; state: MapState } | { status: "invalid" | "unsupported" } {
	if (!isRecord(value)) return { status: "invalid" };
	if (value.version !== 1) return { status: "unsupported" };
	if (typeof value.head !== "string") return { status: "invalid" };
	if (typeof value.generatedAt !== "string") return { status: "invalid" };
	if (!isRecord(value.maps)) return { status: "invalid" };

	const maps: Record<string, string> = {};
	for (const [key, mapHead] of Object.entries(value.maps)) {
		if (typeof mapHead !== "string") return { status: "invalid" };
		maps[normalizeSlashes(key)] = mapHead;
	}

	return {
		status: "ok",
		state: {
			version: 1,
			head: value.head,
			generatedAt: value.generatedAt,
			maps,
		},
	};
}

function readCurrentGitHead(repoRoot: string): string | null {
	const result = spawnSync("git", ["rev-parse", "HEAD"], {
		cwd: repoRoot,
		encoding: "utf-8",
		timeout: GIT_EXEC_TIMEOUT_MS,
	});
	if (result.status !== 0 || result.error) return null;
	const head = result.stdout.trim();
	return head || null;
}

function resolveMapStateRoot(cwd: string): string {
	const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
		cwd,
		encoding: "utf-8",
		timeout: GIT_EXEC_TIMEOUT_MS,
	});
	if (result.status !== 0 || result.error) return resolve(cwd);
	const repoRoot = result.stdout.trim();
	return repoRoot ? resolve(repoRoot) : resolve(cwd);
}

function unknownFreshness(currentHead: string | null): MapFreshness {
	return { verdict: "unknown", mapBasis: null, currentHead };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSlashes(value: string): string {
	return value.replace(/\\/g, "/");
}
