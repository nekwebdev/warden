import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { canonicalMapRoot } from "./map.js";

export const PACKET_TRACKER_RELATIVE_PATH = ".warden/work/packet-tracker.json";
export const PACKET_TRACKER_VERSION = 1;
export const PACKET_TRACKER_SUMMARY_LIMIT = 300;
export const ACTIVE_FLOW_STATUS_NONE = "Active Flow: none";

export const PACKET_TRACKER_STEPS = [
	"warden-start",
	"warden-grill",
	"warden-tdd",
	"warden-close",
] as const;
export const PACKET_TRACKER_STATUSES = [
	"success",
	"failure",
	"aborted",
] as const;
export const PACKET_TRACKER_NEXT_STEPS = [
	...PACKET_TRACKER_STEPS,
	"done",
] as const;

export type PacketTrackerStep = (typeof PACKET_TRACKER_STEPS)[number];
export type PacketTrackerStatus = (typeof PACKET_TRACKER_STATUSES)[number];
export type PacketTrackerNextStep = (typeof PACKET_TRACKER_NEXT_STEPS)[number];

type TddNextStepChoice = "warden-grill" | "warden-close";

type LoadedPacketTrackerState = {
	state?: PacketTrackerState;
	invalid?: true;
	reason?: string;
};

type ResolvedPacketTrackerUpdate = {
	step: PacketTrackerStep;
	status: PacketTrackerStatus;
	packetPath: string;
	packetName: string;
	summary: string;
	now: string;
	repoRoot: string;
	nextStepChoice?: TddNextStepChoice;
};

export interface PacketTrackerEntry {
	packetPath: string;
	packetName: string;
	lastStep: PacketTrackerStep;
	lastStatus: PacketTrackerStatus;
	lastSummary: string;
	nextStep: PacketTrackerNextStep;
	timestamp: string;
}

export interface CompletedPacketTrackerEntry extends PacketTrackerEntry {
	handoffPath: string;
}

export interface PacketTrackerState {
	version: typeof PACKET_TRACKER_VERSION;
	current: PacketTrackerEntry | null;
	queue: PacketTrackerEntry[];
	recentCompleted: CompletedPacketTrackerEntry[];
}

export interface PacketTrackerUpdate {
	cwd: string;
	step: string;
	status: string;
	packetPath?: string;
	packetName?: string;
	output?: string;
	nextStepChoice?: string;
	now: string;
}

export type PacketTrackerUpdateResult =
	| { updated: true; path: string; state: PacketTrackerState }
	| { updated: false; path?: string; reason: string };

export function applyPacketTrackerUpdate(
	update: PacketTrackerUpdate,
): PacketTrackerUpdateResult {
	const valid = validatePacketTrackerUpdate(update);
	if (!valid) return { updated: false, reason: "invalid-update" };

	const repoRoot = canonicalMapRoot(update.cwd);
	const path = packetTrackerPath(repoRoot);
	const loaded = loadPacketTrackerStateFromPath(path);
	if (loaded.invalid)
		return { updated: false, path, reason: loaded.reason ?? "invalid-tracker" };

	const state = cloneState(loaded.state ?? emptyPacketTrackerState());
	const resolved = resolveTrackerUpdate(update, state, repoRoot);
	if (!resolved) return { updated: false, path, reason: "missing-packet-path" };
	if (!transitionPacketState(state, resolved)) {
		return { updated: false, path, reason: "no-matching-packet" };
	}

	writePacketTrackerState(path, state);
	return { updated: true, path, state };
}

export function loadPacketTrackerState(cwd: string): {
	path: string;
	state?: PacketTrackerState;
	invalid?: true;
	reason?: string;
} {
	const repoRoot = canonicalMapRoot(cwd);
	const path = packetTrackerPath(repoRoot);
	return { path, ...loadPacketTrackerStateFromPath(path) };
}

export function loadActiveFlowStatus(cwd: string): {
	path: string;
	text: string;
} {
	const loaded = loadPacketTrackerState(cwd);
	return { path: loaded.path, text: formatActiveFlowStatus(loaded.state) };
}

export function formatActiveFlowStatus(
	state: PacketTrackerState | undefined,
): string {
	const current = state?.current;
	if (!current) return ACTIVE_FLOW_STATUS_NONE;
	return `Active Flow: ${current.packetName} - next: ${current.nextStep}`;
}

export function packetTrackerPath(repoRoot: string): string {
	return join(repoRoot, PACKET_TRACKER_RELATIVE_PATH);
}

export function parsePacketStatus(
	output: string,
): PacketTrackerStatus | undefined {
	const match = topTrackerBlock(output).match(
		/(?:^|\n)\s*(?:[-*]\s*)?(?:tracker\s+status|status)\s*:\s*(success|failure|aborted)\b/i,
	);
	const value = match?.[1]?.toLowerCase();
	return isPacketTrackerStatus(value) ? value : undefined;
}

export function parsePacketPath(output: string): string | undefined {
	return trackerFieldFromOutput(output, "packet path");
}

export function parsePacketName(output: string): string | undefined {
	return trackerFieldFromOutput(output, "packet name");
}

export function parsePacketSummary(output: string): string | undefined {
	const summary = trackerFieldFromOutput(output, "summary");
	return summary ? truncateSummary(normalizeSummaryLine(summary)) : undefined;
}

export function summarizePacketOutput(output: string): string {
	const explicitSummary = parsePacketSummary(output);
	if (explicitSummary) return explicitSummary;

	const lines = topTrackerBlock(output)
		.split(/\r?\n/)
		.map(normalizeSummaryLine)
		.filter(Boolean);
	const preferred = lines
		.map((line) => line.match(/^(?:result|verdict)\s*:\s*(.+)$/i)?.[1]?.trim())
		.find(Boolean);
	const fallback = lines.find((line) => !isSummaryBoilerplate(line));
	return truncateSummary(preferred ?? fallback ?? "No summary provided.");
}

export function normalizePacketPath(
	cwd: string,
	inputPath: string,
	repoRoot = canonicalMapRoot(cwd),
): string | undefined {
	const cleaned = inputPath.replace(/^file:\/\//, "").replace(/^@/, "");
	const absolute = isAbsolute(cleaned)
		? resolve(cleaned)
		: resolve(cwd, cleaned);
	const relativePath = relative(repoRoot, absolute);
	if (isExternalOrEmptyPath(relativePath)) return undefined;
	return normalizeSlashes(relativePath);
}

function validatePacketTrackerUpdate(
	update: PacketTrackerUpdate,
): update is PacketTrackerUpdate & {
	step: PacketTrackerStep;
	status: PacketTrackerStatus;
} {
	return (
		isPacketTrackerStep(update.step) &&
		isPacketTrackerStatus(update.status) &&
		isIsoUtcTimestamp(update.now)
	);
}

function resolveTrackerUpdate(
	update: PacketTrackerUpdate & {
		step: PacketTrackerStep;
		status: PacketTrackerStatus;
	},
	state: PacketTrackerState,
	repoRoot: string,
): ResolvedPacketTrackerUpdate | undefined {
	const packetPath = update.packetPath
		? normalizePacketPath(update.cwd, update.packetPath, repoRoot)
		: fallbackPacketPath(update, state);
	if (!packetPath) return undefined;

	const packetName =
		update.packetName ??
		parsePacketName(update.output ?? "") ??
		packetNameFromPath(packetPath);

	return {
		step: update.step,
		status: update.status,
		packetPath,
		packetName,
		summary: summarizePacketOutput(update.output ?? ""),
		now: update.now,
		repoRoot,
		nextStepChoice: isTddChoice(update.nextStepChoice)
			? update.nextStepChoice
			: undefined,
	};
}

function fallbackPacketPath(
	update: Pick<ResolvedPacketTrackerUpdate, "step" | "status">,
	state: PacketTrackerState,
): string | undefined {
	return update.step === "warden-start" && update.status !== "success"
		? undefined
		: state.current?.packetPath;
}

function loadPacketTrackerStateFromPath(
	path: string,
): LoadedPacketTrackerState {
	if (!existsSync(path)) return {};
	try {
		const parsed = JSON.parse(readFileSync(path, "utf-8"));
		return isPacketTrackerState(parsed)
			? { state: parsed }
			: { invalid: true, reason: "invalid-schema" };
	} catch {
		return { invalid: true, reason: "malformed-json" };
	}
}

function transitionPacketState(
	state: PacketTrackerState,
	update: ResolvedPacketTrackerUpdate,
): boolean {
	if (update.step === "warden-start") return applyStartUpdate(state, update);
	if (!makeCurrent(state, update.packetPath, update.status === "success")) {
		return false;
	}
	if (update.step === "warden-close") return applyCloseUpdate(state, update);
	state.current = entryFromUpdate(update, nextStepForNonClose(update));
	return true;
}

function applyStartUpdate(
	state: PacketTrackerState,
	update: ResolvedPacketTrackerUpdate,
): boolean {
	if (update.status !== "success") {
		return updateCurrentIfPresent(state, update, "warden-start");
	}
	makeCurrent(state, update.packetPath, true);
	state.current = entryFromUpdate(update, "warden-grill");
	return true;
}

function applyCloseUpdate(
	state: PacketTrackerState,
	update: ResolvedPacketTrackerUpdate,
): boolean {
	if (!state.current) return false;
	if (update.status !== "success") {
		state.current = entryFromUpdate(update, "warden-close");
		return true;
	}

	const handoffPath = siblingHandoffPath(update.packetPath);
	if (!existsSync(join(update.repoRoot, handoffPath))) {
		state.current = entryFromUpdate(
			{ ...update, status: "failure" },
			"warden-close",
		);
		return true;
	}

	completeCurrentPacket(state, update, handoffPath);
	return true;
}

function completeCurrentPacket(
	state: PacketTrackerState,
	update: ResolvedPacketTrackerUpdate,
	handoffPath: string,
): void {
	const completed: CompletedPacketTrackerEntry = {
		...entryFromUpdate(update, "done"),
		handoffPath,
	};
	state.recentCompleted = [
		completed,
		...state.recentCompleted.filter(
			(entry) => entry.packetPath !== completed.packetPath,
		),
	].slice(0, 5);
	state.current = state.queue.shift() ?? null;
}

function updateCurrentIfPresent(
	state: PacketTrackerState,
	update: ResolvedPacketTrackerUpdate,
	nextStep: PacketTrackerNextStep,
): boolean {
	if (!makeCurrent(state, update.packetPath, false)) return false;
	state.current = entryFromUpdate(update, nextStep);
	return true;
}

function makeCurrent(
	state: PacketTrackerState,
	packetPath: string,
	allowCreate: boolean,
): boolean {
	if (state.current?.packetPath === packetPath) return true;
	const queueIndex = state.queue.findIndex(
		(entry) => entry.packetPath === packetPath,
	);
	if (queueIndex >= 0) {
		const [queued] = state.queue.splice(queueIndex, 1);
		if (state.current) state.queue.unshift(state.current);
		state.current = queued ?? null;
		return true;
	}
	if (!allowCreate) return false;
	if (state.current) state.queue.unshift(state.current);
	state.queue = state.queue.filter((entry) => entry.packetPath !== packetPath);
	state.current = newPacketTrackerEntry(packetPath);
	return true;
}

function entryFromUpdate(
	update: Pick<
		ResolvedPacketTrackerUpdate,
		"step" | "status" | "packetPath" | "packetName" | "summary" | "now"
	>,
	nextStep: PacketTrackerNextStep,
): PacketTrackerEntry {
	return {
		packetPath: update.packetPath,
		packetName: update.packetName,
		lastStep: update.step,
		lastStatus: update.status,
		lastSummary: update.summary,
		nextStep,
		timestamp: update.now,
	};
}

function newPacketTrackerEntry(packetPath: string): PacketTrackerEntry {
	return {
		packetPath,
		packetName: packetNameFromPath(packetPath),
		lastStep: "warden-start",
		lastStatus: "success",
		lastSummary: "",
		nextStep: "warden-grill",
		timestamp: "1970-01-01T00:00:00.000Z",
	};
}

function nextStepForNonClose(
	update: ResolvedPacketTrackerUpdate,
): PacketTrackerNextStep {
	if (update.status !== "success") return update.step;
	if (update.step === "warden-grill") return "warden-tdd";
	if (update.step === "warden-tdd") {
		return update.nextStepChoice ?? "warden-grill";
	}
	return "warden-grill";
}

function writePacketTrackerState(
	path: string,
	state: PacketTrackerState,
): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}

function emptyPacketTrackerState(): PacketTrackerState {
	return {
		version: PACKET_TRACKER_VERSION,
		current: null,
		queue: [],
		recentCompleted: [],
	};
}

function cloneState(state: PacketTrackerState): PacketTrackerState {
	return JSON.parse(JSON.stringify(state)) as PacketTrackerState;
}

function siblingHandoffPath(packetPath: string): string {
	return normalizeSlashes(join(dirname(packetPath), "handoff.md"));
}

export function packetNameFromPath(packetPath: string): string {
	return (
		normalizeSlashes(dirname(packetPath))
			.split("/")
			.filter((part) => part && part !== ".")
			.at(-1) ?? ""
	);
}

function trackerFieldFromOutput(
	output: string,
	fieldName: string,
): string | undefined {
	const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return topTrackerBlock(output)
		.match(
			new RegExp(
				`(?:^|\\n)\\s*(?:[-*]\\s*)?${escaped}\\s*:\\s*(.+?)(?=\\r?\\n|$)`,
				"i",
			),
		)?.[1]
		?.trim();
}

function topTrackerBlock(output: string): string {
	const lines = output.split(/\r?\n/);
	const endIndex = lines.findIndex((line) => /^##\s+/.test(line));
	return (endIndex >= 0 ? lines.slice(0, endIndex) : lines).join("\n");
}

function isSummaryBoilerplate(line: string): boolean {
	return /^(?:warden\s+(?:start|grill|tdd|close)(?:\s+result)?|tracker\s+status|packet\s+(?:name|path|action)|next\s+(?:action|step))\b/i.test(
		line,
	);
}

function normalizeSummaryLine(line: string): string {
	const trimmed = line
		.replace(/^\s*[-*]\s+/, "")
		.replace(/^#+\s*/, "")
		.trim();
	if (!trimmed || trimmed === "```") return "";
	return trimmed.replace(/\s+/g, " ");
}

function truncateSummary(summary: string): string {
	return summary.length > PACKET_TRACKER_SUMMARY_LIMIT
		? summary.slice(0, PACKET_TRACKER_SUMMARY_LIMIT)
		: summary;
}

function isPacketTrackerState(value: unknown): value is PacketTrackerState {
	if (!isPlainObject(value)) return false;
	if (!hasExactKeys(value, ["version", "current", "queue", "recentCompleted"]))
		return false;
	if (value.version !== PACKET_TRACKER_VERSION) return false;
	if (value.current !== null && !isPacketTrackerEntry(value.current)) {
		return false;
	}
	if (!Array.isArray(value.queue) || !value.queue.every(isPacketTrackerEntry)) {
		return false;
	}
	return (
		Array.isArray(value.recentCompleted) &&
		value.recentCompleted.every(isCompletedPacketTrackerEntry)
	);
}

function isPacketTrackerEntry(value: unknown): value is PacketTrackerEntry {
	if (!isPlainObject(value)) return false;
	return (
		hasExactKeys(value, [
			"packetPath",
			"packetName",
			"lastStep",
			"lastStatus",
			"lastSummary",
			"nextStep",
			"timestamp",
		]) &&
		typeof value.packetPath === "string" &&
		typeof value.packetName === "string" &&
		isPacketTrackerStep(value.lastStep) &&
		isPacketTrackerStatus(value.lastStatus) &&
		typeof value.lastSummary === "string" &&
		value.lastSummary.length <= PACKET_TRACKER_SUMMARY_LIMIT &&
		isPacketTrackerNextStep(value.nextStep) &&
		typeof value.timestamp === "string"
	);
}

function isCompletedPacketTrackerEntry(
	value: unknown,
): value is CompletedPacketTrackerEntry {
	if (!isPlainObject(value)) return false;
	const { handoffPath, ...entry } = value;
	return (
		hasExactKeys(value, [
			"packetPath",
			"packetName",
			"lastStep",
			"lastStatus",
			"lastSummary",
			"nextStep",
			"timestamp",
			"handoffPath",
		]) &&
		typeof handoffPath === "string" &&
		isPacketTrackerEntry(entry)
	);
}

function isPacketTrackerStep(value: unknown): value is PacketTrackerStep {
	return PACKET_TRACKER_STEPS.includes(value as PacketTrackerStep);
}

function isPacketTrackerStatus(value: unknown): value is PacketTrackerStatus {
	return PACKET_TRACKER_STATUSES.includes(value as PacketTrackerStatus);
}

function isPacketTrackerNextStep(
	value: unknown,
): value is PacketTrackerNextStep {
	return PACKET_TRACKER_NEXT_STEPS.includes(value as PacketTrackerNextStep);
}

function isTddChoice(value: unknown): value is TddNextStepChoice {
	return value === "warden-grill" || value === "warden-close";
}

function isIsoUtcTimestamp(value: string): boolean {
	return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value);
}

function isExternalOrEmptyPath(value: string): boolean {
	return !value || value.startsWith("..") || isAbsolute(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
	const actual = Object.keys(value).sort();
	const expected = [...keys].sort();
	return (
		actual.length === expected.length &&
		actual.every((key, index) => key === expected[index])
	);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSlashes(value: string): string {
	return value.replace(/\\/g, "/");
}
