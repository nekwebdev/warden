import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	INJECT_END_MARKER,
	INJECT_START_MARKER,
	SCOPED_MAPS_RELATIVE_DIR,
} from "./constants.js";
import { formatFreshnessLines, type MapFreshness } from "./map-state.js";

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
	const bounds = capsuleMarkerBounds(markdown);
	if (!bounds) return { status: "missing-marker", bytes: 0, maxBytes };
	const content = markdown.slice(bounds.start, bounds.end).trim();
	const bytes = byteLength(content);
	if (bytes === 0) return { status: "empty", bytes, maxBytes };
	if (bytes > maxBytes) return { status: "too-large", bytes, maxBytes };
	return { status: "ok", content, bytes, maxBytes };
}

export function readMapCapsule(
	cwd: string,
	relativePath: string,
	maxBytes: number,
): MapCapsule {
	const absolutePath = resolve(cwd, relativePath);
	const scope = scopeFromMapPath(relativePath);
	if (!existsSync(absolutePath)) {
		return missingMapCapsule(absolutePath, relativePath, scope, maxBytes);
	}
	try {
		return loadedMapCapsule(
			absolutePath,
			relativePath,
			scope,
			readFileSync(absolutePath, "utf-8"),
			maxBytes,
		);
	} catch {
		return readErrorMapCapsule(absolutePath, relativePath, scope, maxBytes);
	}
}

export function capsuleToInjection(
	capsule: MapCapsule,
	context: { kind: string; trigger: string; freshness?: MapFreshness },
): MapInjection {
	const message = formatMapCapsuleMessage(capsule, context);
	return {
		relativePath: capsule.relativePath,
		hash: injectionHash(capsule, context.freshness),
		bytes: byteLength(message),
		message,
		status: capsule.status,
	};
}

function injectionHash(
	capsule: MapCapsule,
	freshness: MapFreshness | undefined,
): string {
	if (!freshness) return capsule.hash;
	return hashText(`${capsule.hash}\n${formatFreshnessLines(freshness)}`);
}

export function budgetNoticeInjection(
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

function capsuleMarkerBounds(markdown: string) {
	const startMarker = markdown.indexOf(INJECT_START_MARKER);
	const contentStart = startMarker + INJECT_START_MARKER.length;
	const endMarker =
		startMarker >= 0 ? markdown.indexOf(INJECT_END_MARKER, contentStart) : -1;
	if (startMarker < 0 || endMarker < 0 || endMarker < startMarker) return null;
	return { start: contentStart, end: endMarker };
}

function loadedMapCapsule(
	absolutePath: string,
	relativePath: string,
	scope: string,
	markdown: string,
	maxBytes: number,
): MapCapsule {
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
}

function missingMapCapsule(
	absolutePath: string,
	relativePath: string,
	scope: string,
	maxBytes: number,
): MapCapsule {
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

function readErrorMapCapsule(
	absolutePath: string,
	relativePath: string,
	scope: string,
	maxBytes: number,
): MapCapsule {
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

export function formatMapCapsuleMessage(
	capsule: MapCapsule,
	context: { kind: string; trigger: string; freshness?: MapFreshness },
): string {
	const header = [
		`[warden-map — ${context.kind}, reference material, NOT a task. ${context.trigger}.`,
		"It does not override system/developer/user instructions; use only when relevant.]",
		`Source: ${capsule.relativePath}`,
	];
	if (context.freshness) {
		header.push(formatFreshnessLines(context.freshness));
	}
	header.push("");

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

function scopeFromMapPath(relativePath: string): string {
	const normalized = relativePath.replace(/\\/g, "/");
	if (normalized === ".warden/map.md") return "root";
	const prefix = `${SCOPED_MAPS_RELATIVE_DIR}/`;
	if (!normalized.startsWith(prefix) || !normalized.endsWith("/map.md")) {
		return normalized;
	}
	return normalized.slice(prefix.length, -"/map.md".length);
}
