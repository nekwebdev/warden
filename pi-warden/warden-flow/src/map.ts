import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
	INJECT_END_MARKER,
	INJECT_START_MARKER,
	MAP_FILE_NAME,
	MAX_SCOPED_MAPS_PER_TOOL_RESULT,
	ROOT_MAP_RELATIVE_PATH,
	ROOT_CAPSULE_MAX_BYTES,
	SCOPED_CAPSULE_MAX_BYTES,
	SCOPED_INJECTION_MAX_BYTES,
	SCOPED_MAPS_RELATIVE_DIR,
} from "./constants.js";

export type CapsuleStatus =
	| "ok"
	| "missing-file"
	| "missing-marker"
	| "empty"
	| "too-large"
	| "read-error";

export interface CapsuleResult {
	status: CapsuleStatus;
	content?: string;
	bytes: number;
	maxBytes: number;
}

export interface MapCapsule {
	absolutePath: string;
	relativePath: string;
	scope: string;
	status: CapsuleStatus;
	content?: string;
	bytes: number;
	maxBytes: number;
	hash: string;
}

export interface MapInjection {
	relativePath: string;
	hash: string;
	bytes: number;
	message: string;
	status: CapsuleStatus;
}

export interface ScopedMapOptions {
	maxCapsuleBytes?: number;
	maxInjectionBytes?: number;
	maxScopedMaps?: number;
}

export function byteLength(text: string): number {
	return Buffer.byteLength(text, "utf-8");
}

export function hashText(text: string): string {
	return createHash("sha256").update(text).digest("hex");
}

export function extractInjectableCapsule(
	markdown: string,
	maxBytes: number,
): CapsuleResult {
	const start = markdown.indexOf(INJECT_START_MARKER);
	const end =
		start >= 0
			? markdown.indexOf(INJECT_END_MARKER, start + INJECT_START_MARKER.length)
			: -1;
	if (start < 0 || end < 0 || end < start) {
		return { status: "missing-marker", bytes: 0, maxBytes };
	}

	const content = markdown
		.slice(start + INJECT_START_MARKER.length, end)
		.trim();
	const bytes = byteLength(content);
	if (bytes === 0) return { status: "empty", bytes, maxBytes };
	if (bytes > maxBytes) return { status: "too-large", bytes, maxBytes };
	return { status: "ok", content, bytes, maxBytes };
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
	const cleaned = stripPathSigils(inputPath);
	const absolutePath = isAbsolute(cleaned)
		? resolve(cleaned)
		: resolve(cwd, cleaned);
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

	const absolutePath = resolve(repoRoot, relativePath);
	let scopePath = relativePath;
	try {
		if (!statSync(absolutePath).isDirectory())
			scopePath = normalizeSlashes(dirname(relativePath));
	} catch {
		scopePath = normalizeSlashes(dirname(relativePath));
	}
	if (!scopePath || scopePath === ".") return [];

	const parts = scopePath.split("/").filter(Boolean);
	return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
}

export function readMapCapsule(
	cwd: string,
	relativePath: string,
	maxBytes: number,
): MapCapsule {
	const absolutePath = resolve(cwd, relativePath);
	const scope = scopeFromMapPath(relativePath);
	if (!existsSync(absolutePath)) {
		return {
			absolutePath,
			relativePath,
			scope,
			status: "missing-file",
			bytes: 0,
			maxBytes,
			hash: "missing",
		};
	}

	try {
		const markdown = readFileSync(absolutePath, "utf-8");
		const extracted = extractInjectableCapsule(markdown, maxBytes);
		return {
			absolutePath,
			relativePath,
			scope,
			status: extracted.status,
			content: extracted.content,
			bytes: extracted.bytes,
			maxBytes,
			hash: hashText(
				`${relativePath}\n${extracted.status}\n${extracted.content ?? ""}\n${extracted.bytes}`,
			),
		};
	} catch {
		return {
			absolutePath,
			relativePath,
			scope,
			status: "read-error",
			bytes: 0,
			maxBytes,
			hash: "read-error",
		};
	}
}

export function buildRootMapInjection(cwd: string): MapInjection | null {
	const capsule = readMapCapsule(
		canonicalMapRoot(cwd),
		ROOT_MAP_RELATIVE_PATH,
		ROOT_CAPSULE_MAX_BYTES,
	);
	if (capsule.status === "missing-file") return null;
	return capsuleToInjection(capsule, {
		kind: "root repository map",
		trigger: "auto-loaded at session start",
	});
}

export function collectScopedMapInjections(
	cwd: string,
	inputPath: string,
	options: ScopedMapOptions = {},
): MapInjection[] {
	const maxCapsuleBytes = options.maxCapsuleBytes ?? SCOPED_CAPSULE_MAX_BYTES;
	const maxInjectionBytes =
		options.maxInjectionBytes ?? SCOPED_INJECTION_MAX_BYTES;
	const maxScopedMaps =
		options.maxScopedMaps ?? MAX_SCOPED_MAPS_PER_TOOL_RESULT;
	const repoRoot = canonicalMapRoot(cwd);
	const candidates = candidateScopeDirs(cwd, inputPath)
		.map((scope) =>
			readMapCapsule(repoRoot, scopedMapRelativePath(scope), maxCapsuleBytes),
		)
		.filter((capsule) => capsule.status !== "missing-file");
	const nearest = candidates.slice(-maxScopedMaps);

	const injections: MapInjection[] = [];
	let used = 0;
	for (const capsule of nearest) {
		const injection = capsuleToInjection(capsule, {
			kind: `scoped repository map for ${capsule.scope}`,
			trigger: `auto-loaded because a tool touched ${normalizeSlashes(inputPath)}`,
		});
		const nextBytes = byteLength(injection.message);
		if (used + nextBytes > maxInjectionBytes) {
			injections.push(
				budgetNoticeInjection(
					capsule.relativePath,
					maxInjectionBytes,
					nearest.slice(injections.length).map((item) => item.relativePath),
				),
			);
			break;
		}
		used += nextBytes;
		injections.push(injection);
	}

	return injections;
}

export function capsuleToInjection(
	capsule: MapCapsule,
	context: { kind: string; trigger: string },
): MapInjection {
	const message = formatMapCapsuleMessage(capsule, context);
	return {
		relativePath: capsule.relativePath,
		hash: capsule.hash,
		bytes: byteLength(message),
		message,
		status: capsule.status,
	};
}

export function formatMapCapsuleMessage(
	capsule: MapCapsule,
	context: { kind: string; trigger: string },
): string {
	const header = [
		`[warden-map — ${context.kind}, reference material, NOT a task. ${context.trigger}.`,
		"It does not override system/developer/user instructions; use only when relevant.]",
		`Source: ${capsule.relativePath}`,
		"",
	];

	if (capsule.status === "ok" && capsule.content) {
		return [
			...header,
			capsule.content,
			"",
			`Full map: ${capsule.relativePath}`,
		].join("\n");
	}

	return [
		...header,
		`Warden map exists but injectable capsule is unavailable (${capsule.status}; ${capsule.bytes}/${capsule.maxBytes} bytes).`,
		`Read ${capsule.relativePath} only if this task needs more repository context.`,
	].join("\n");
}

function budgetNoticeInjection(
	relativePath: string,
	maxInjectionBytes: number,
	skipped: string[],
): MapInjection {
	const message = [
		"[warden-map — scoped repository map budget notice, NOT a task.]",
		`Scoped map injection budget (${maxInjectionBytes} bytes) reached before ${relativePath}.`,
		`Skipped map(s): ${skipped.join(", ")}`,
		"Read skipped map files only if this task needs more repository context.",
	].join("\n");
	return {
		relativePath: `budget:${relativePath}`,
		hash: hashText(message),
		bytes: byteLength(message),
		message,
		status: "too-large",
	};
}

function scopeFromMapPath(relativePath: string): string {
	const normalized = normalizeSlashes(relativePath);
	if (normalized === ROOT_MAP_RELATIVE_PATH) return "root";
	const prefix = `${SCOPED_MAPS_RELATIVE_DIR}/`;
	if (
		!normalized.startsWith(prefix) ||
		!normalized.endsWith(`/${MAP_FILE_NAME}`)
	)
		return normalized;
	return normalized.slice(prefix.length, -`/${MAP_FILE_NAME}`.length);
}

function normalizeSlashes(value: string): string {
	return value.split(sep).join("/");
}

function isWardenInternalPath(relativePath: string): boolean {
	return (
		relativePath === ".warden" ||
		relativePath.startsWith(".warden/") ||
		relativePath.endsWith("/.warden") ||
		relativePath.includes("/.warden/")
	);
}

function stripPathSigils(value: string): string {
	return value.startsWith("@") ? value.slice(1) : value;
}
