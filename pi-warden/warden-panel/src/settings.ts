import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface WardenSettings {
	readonly useNerdGlyphs?: boolean;
}

export type PiAgentSettingsErrorKind =
	| "unreadable"
	| "invalid-json"
	| "invalid-shape";

export type PiAgentSettingsError = {
	readonly ok: false;
	readonly kind: PiAgentSettingsErrorKind;
	readonly path: string;
	readonly message: string;
};

export type PiAgentSettingsReadResult =
	| { readonly ok: true; readonly settings: Record<string, unknown> }
	| PiAgentSettingsError;

export type PiAgentSettingsWriteResult =
	| { readonly ok: true }
	| { readonly ok: false; readonly settingsError: PiAgentSettingsError };

export function getPiAgentSettingsPath(): string {
	if (process.env.WARDEN_PANEL_TEST_HOME) {
		return join(
			process.env.WARDEN_PANEL_TEST_HOME,
			".pi",
			"agent",
			"settings.json",
		);
	}

	if (process.env.PI_CODING_AGENT_DIR) {
		return join(process.env.PI_CODING_AGENT_DIR, "settings.json");
	}

	return join(homedir(), ".pi", "agent", "settings.json");
}

export function isPlainObject(
	value: unknown,
): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function formatPiAgentSettingsError(
	error: PiAgentSettingsError,
): string {
	return `${error.path}: ${error.message}`;
}

export function readPiAgentSettings(): PiAgentSettingsReadResult {
	const settingsPath = getPiAgentSettingsPath();
	if (!existsSync(settingsPath)) {
		return { ok: true, settings: {} };
	}

	let contents: string;
	try {
		contents = readFileSync(settingsPath, "utf-8");
	} catch (error) {
		return {
			ok: false,
			kind: "unreadable",
			path: settingsPath,
			message: toErrorMessage(error),
		};
	}

	if (contents.trim() === "") {
		return { ok: true, settings: {} };
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(contents);
	} catch (error) {
		return {
			ok: false,
			kind: "invalid-json",
			path: settingsPath,
			message: toErrorMessage(error),
		};
	}

	if (!isPlainObject(parsed)) {
		return {
			ok: false,
			kind: "invalid-shape",
			path: settingsPath,
			message: "settings root must be an object",
		};
	}

	return { ok: true, settings: parsed };
}

export function getWardenSettings(
	settings: Record<string, unknown> | undefined,
): WardenSettings {
	if (!settings || !isPlainObject(settings.warden)) return {};
	const warden = settings.warden;
	return {
		...(typeof warden.useNerdGlyphs === "boolean"
			? { useNerdGlyphs: warden.useNerdGlyphs }
			: {}),
	};
}

export function writeWardenSettings(
	patch: WardenSettings,
): PiAgentSettingsWriteResult {
	const result = readPiAgentSettings();
	if (!result.ok) return { ok: false, settingsError: result };

	const currentWarden = isPlainObject(result.settings.warden)
		? result.settings.warden
		: {};
	const next = {
		...result.settings,
		warden: {
			...currentWarden,
			...patch,
		},
	};

	const settingsPath = getPiAgentSettingsPath();
	let tempPath: string | undefined;
	try {
		mkdirSync(dirname(settingsPath), { recursive: true });
		tempPath = `${settingsPath}.${process.pid}.${Date.now()}.tmp`;
		writeFileSync(tempPath, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
		renameSync(tempPath, settingsPath);
		return { ok: true };
	} catch (error) {
		if (tempPath) rmSync(tempPath, { force: true });
		return {
			ok: false,
			settingsError: {
				ok: false,
				kind: "unreadable",
				path: settingsPath,
				message: toErrorMessage(error),
			},
		};
	}
}
