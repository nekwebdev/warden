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

export const WARDEN_EFFORT_LEVELS = [
	"off",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
] as const;

export type WardenEffortLevel = (typeof WARDEN_EFFORT_LEVELS)[number];

export const DEFAULT_WARDEN_SKILL_EFFORTS = {
	"warden-map": "low",
	"warden-start": "medium",
	"warden-grill": "high",
	"warden-tdd": "high",
	"warden-close": "medium",
	"warden-commit": "medium",
	"warden-docs": "medium",
} as const satisfies Record<string, WardenEffortLevel>;

const DEFAULT_WARDEN_SKILL_EFFORT_MAP: Readonly<
	Record<string, WardenEffortLevel>
> = DEFAULT_WARDEN_SKILL_EFFORTS;

export type WardenEffortSettingsResult =
	| { readonly ok: true }
	| { readonly ok: false; readonly error: string; readonly path: string };

export type WardenSkillEffortEntry = {
	readonly skillName: string;
	readonly effort: WardenEffortLevel;
};

export const DEFAULT_WARDEN_SKILL_STATUS_ENABLED = false;

type PiAgentSettingsReadResult =
	| { readonly ok: true; readonly settings: Record<string, unknown> }
	| { readonly ok: false; readonly error: string; readonly path: string };

export function isWardenEffortLevel(
	value: unknown,
): value is WardenEffortLevel {
	return WARDEN_EFFORT_LEVELS.includes(value as WardenEffortLevel);
}

export function cycleWardenEffortLevel(
	level: WardenEffortLevel,
): WardenEffortLevel {
	const index = WARDEN_EFFORT_LEVELS.indexOf(level);
	return WARDEN_EFFORT_LEVELS[(index + 1) % WARDEN_EFFORT_LEVELS.length];
}

export function getPiAgentSettingsPath(): string {
	if (process.env.WARDEN_FLOW_TEST_HOME) {
		return join(
			process.env.WARDEN_FLOW_TEST_HOME,
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

export function seedWardenEffortDefaults(
	defaults: Readonly<
		Record<string, WardenEffortLevel>
	> = DEFAULT_WARDEN_SKILL_EFFORTS,
): WardenEffortSettingsResult {
	const result = readPiAgentSettings();
	if (!result.ok) return result;

	const { currentWarden, currentEffort, currentSkills } = settingsParts(
		result.settings,
	);
	let changed = false;
	const nextSkills: Record<string, unknown> = { ...currentSkills };
	for (const [skillName, effort] of Object.entries(defaults)) {
		if (!(skillName in nextSkills)) {
			nextSkills[skillName] = effort;
			changed = true;
		}
	}
	if (!changed) return { ok: true };

	return writePiAgentSettings(
		withWardenSkillEfforts(
			result.settings,
			currentWarden,
			currentEffort,
			nextSkills,
		),
	);
}

export function readWardenSkillEffortEntries(): WardenSkillEffortEntry[] {
	const result = readPiAgentSettings();
	if (!result.ok) return [];
	const { currentSkills } = settingsParts(result.settings);
	return Object.entries(currentSkills)
		.filter(
			(entry): entry is [string, WardenEffortLevel] =>
				isWardenSkillName(entry[0]) && isWardenEffortLevel(entry[1]),
		)
		.map(([skillName, effort]) => ({ skillName, effort }))
		.sort(compareSkillEffortEntries);
}

export function readWardenSkillStatusEnabled(): boolean {
	const result = readPiAgentSettings();
	if (!result.ok) return DEFAULT_WARDEN_SKILL_STATUS_ENABLED;
	const { currentEffort } = settingsParts(result.settings);
	return currentEffort.showSkillStatus === true;
}

export function setWardenSkillStatusEnabled(
	enabled: boolean,
): WardenEffortSettingsResult {
	const result = readPiAgentSettings();
	if (!result.ok) return result;
	const { currentWarden, currentEffort } = settingsParts(result.settings);
	return writePiAgentSettings(
		withWardenEffortSettings(result.settings, currentWarden, {
			...currentEffort,
			showSkillStatus: enabled,
		}),
	);
}

export function resolveWardenSkillEffort(
	skillName: string,
): WardenEffortLevel | undefined {
	if (!isWardenSkillName(skillName)) return undefined;
	const result = readPiAgentSettings();
	if (result.ok) {
		const configured = settingsParts(result.settings).currentSkills[skillName];
		if (isWardenEffortLevel(configured)) return configured;
	}
	return DEFAULT_WARDEN_SKILL_EFFORT_MAP[skillName];
}

export function setWardenSkillEffort(
	skillName: string,
	effort: WardenEffortLevel,
): WardenEffortSettingsResult {
	if (!isWardenSkillName(skillName)) {
		return {
			ok: false,
			path: getPiAgentSettingsPath(),
			error: `invalid Warden skill name: ${skillName}`,
		};
	}
	const result = readPiAgentSettings();
	if (!result.ok) return result;
	const { currentWarden, currentEffort, currentSkills } = settingsParts(
		result.settings,
	);
	return writePiAgentSettings(
		withWardenSkillEfforts(result.settings, currentWarden, currentEffort, {
			...currentSkills,
			[skillName]: effort,
		}),
	);
}

export function isWardenSkillName(value: string): boolean {
	return value.startsWith("warden-") && value.length > "warden-".length;
}

function readPiAgentSettings(): PiAgentSettingsReadResult {
	const settingsPath = getPiAgentSettingsPath();
	if (!existsSync(settingsPath)) return { ok: true, settings: {} };

	let contents: string;
	try {
		contents = readFileSync(settingsPath, "utf-8");
	} catch (error) {
		return { ok: false, path: settingsPath, error: toErrorMessage(error) };
	}

	if (contents.trim() === "") return { ok: true, settings: {} };

	let parsed: unknown;
	try {
		parsed = JSON.parse(contents);
	} catch (error) {
		return { ok: false, path: settingsPath, error: toErrorMessage(error) };
	}

	if (!isPlainObject(parsed)) {
		return {
			ok: false,
			path: settingsPath,
			error: "settings root must be an object",
		};
	}

	return { ok: true, settings: parsed };
}

function writePiAgentSettings(
	settings: Record<string, unknown>,
): WardenEffortSettingsResult {
	const settingsPath = getPiAgentSettingsPath();
	const tempPath = tempSettingsPath(settingsPath);
	try {
		writeSettingsJson(settingsPath, tempPath, settings);
		return { ok: true };
	} catch (error) {
		rmSync(tempPath, { force: true });
		return { ok: false, path: settingsPath, error: toErrorMessage(error) };
	}
}

function tempSettingsPath(settingsPath: string): string {
	return `${settingsPath}.${process.pid}.${Date.now()}.tmp`;
}

function writeSettingsJson(
	settingsPath: string,
	tempPath: string,
	settings: Record<string, unknown>,
): void {
	mkdirSync(dirname(settingsPath), { recursive: true });
	writeFileSync(tempPath, `${JSON.stringify(settings, null, 2)}\n`, "utf-8");
	renameSync(tempPath, settingsPath);
}

function settingsParts(settings: Record<string, unknown>): {
	readonly currentWarden: Record<string, unknown>;
	readonly currentEffort: Record<string, unknown>;
	readonly currentSkills: Record<string, unknown>;
} {
	const currentWarden = isPlainObject(settings.warden) ? settings.warden : {};
	const currentEffort = isPlainObject(currentWarden.effort)
		? currentWarden.effort
		: {};
	const currentSkills = isPlainObject(currentEffort.skills)
		? currentEffort.skills
		: {};
	return { currentWarden, currentEffort, currentSkills };
}

function withWardenSkillEfforts(
	settings: Record<string, unknown>,
	currentWarden: Record<string, unknown>,
	currentEffort: Record<string, unknown>,
	skills: Record<string, unknown>,
): Record<string, unknown> {
	return withWardenEffortSettings(settings, currentWarden, {
		...currentEffort,
		skills,
	});
}

function withWardenEffortSettings(
	settings: Record<string, unknown>,
	currentWarden: Record<string, unknown>,
	effort: Record<string, unknown>,
): Record<string, unknown> {
	return {
		...settings,
		warden: {
			...currentWarden,
			effort,
		},
	};
}

function compareSkillEffortEntries(
	left: WardenSkillEffortEntry,
	right: WardenSkillEffortEntry,
): number {
	const knownOrder = Object.keys(DEFAULT_WARDEN_SKILL_EFFORTS);
	const leftKnown = knownOrder.indexOf(left.skillName);
	const rightKnown = knownOrder.indexOf(right.skillName);
	if (leftKnown !== -1 || rightKnown !== -1) {
		if (leftKnown === -1) return 1;
		if (rightKnown === -1) return -1;
		return leftKnown - rightKnown;
	}
	return left.skillName.localeCompare(right.skillName);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
