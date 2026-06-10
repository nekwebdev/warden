import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import {
	DEFAULT_WARDEN_SKILL_EFFORTS,
	WARDEN_EFFORT_LEVELS,
	cycleWardenEffortLevel,
	getPiAgentSettingsPath,
	isWardenEffortLevel,
	readWardenSkillStatusEnabled,
	seedWardenEffortDefaults,
	setWardenSkillStatusEnabled,
} from "../src/index.js";

const envBefore = process.env.WARDEN_FLOW_TEST_HOME;
const EFFORT_OFF = "off";
const EFFORT_MINIMAL = "minimal";
const EFFORT_LOW = "low";
const EFFORT_MEDIUM = "medium";
const EFFORT_HIGH = "high";
const EFFORT_XHIGH = "xhigh";
const SEEDED_SKILL_EFFORTS = {
	"warden-map": EFFORT_LOW,
	"warden-start": EFFORT_MEDIUM,
	"warden-grill": EFFORT_HIGH,
	"warden-tdd": EFFORT_HIGH,
	"warden-close": EFFORT_MEDIUM,
	"warden-commit": EFFORT_MEDIUM,
	"warden-create-skill": EFFORT_HIGH,
	"warden-docs": EFFORT_MEDIUM,
} as const;

async function withTempSettings(
	contents: unknown,
	test: () => Promise<void> | void,
): Promise<void> {
	const testHome = mkdtempSync(join(tmpdir(), "warden-flow-effort-"));
	process.env.WARDEN_FLOW_TEST_HOME = testHome;
	const settingsPath = getPiAgentSettingsPath();
	if (contents !== undefined) {
		mkdirSync(dirname(settingsPath), { recursive: true });
		writeFileSync(settingsPath, JSON.stringify(contents), "utf-8");
	}

	try {
		await test();
	} finally {
		if (envBefore === undefined) delete process.env.WARDEN_FLOW_TEST_HOME;
		else process.env.WARDEN_FLOW_TEST_HOME = envBefore;
		rmSync(testHome, { recursive: true, force: true });
	}
}

function readSettings(): Record<string, unknown> {
	return JSON.parse(readFileSync(getPiAgentSettingsPath(), "utf-8"));
}

describe("Warden skill effort settings", () => {
	afterEach(() => {
		if (envBefore === undefined) delete process.env.WARDEN_FLOW_TEST_HOME;
		else process.env.WARDEN_FLOW_TEST_HOME = envBefore;
	});

	it("defines and validates the exact ordered effort scale", () => {
		assert.deepEqual(WARDEN_EFFORT_LEVELS, [
			EFFORT_OFF,
			EFFORT_MINIMAL,
			EFFORT_LOW,
			EFFORT_MEDIUM,
			EFFORT_HIGH,
			EFFORT_XHIGH,
		]);
		for (const level of WARDEN_EFFORT_LEVELS) {
			assert.equal(isWardenEffortLevel(level), true, level);
		}
		for (const value of ["", "x-low", "maximum", null, 0]) {
			assert.equal(isWardenEffortLevel(value), false, String(value));
		}
	});

	it("cycles effort levels in configured order", () => {
		assert.deepEqual(
			WARDEN_EFFORT_LEVELS.map((level) => [
				level,
				cycleWardenEffortLevel(level),
			]),
			[
				[EFFORT_OFF, EFFORT_MINIMAL],
				[EFFORT_MINIMAL, EFFORT_LOW],
				[EFFORT_LOW, EFFORT_MEDIUM],
				[EFFORT_MEDIUM, EFFORT_HIGH],
				[EFFORT_HIGH, EFFORT_XHIGH],
				[EFFORT_XHIGH, EFFORT_OFF],
			],
		);
	});

	it("seeds missing Warden Flow effort defaults", async () => {
		await withTempSettings({}, () => {
			assert.deepEqual(DEFAULT_WARDEN_SKILL_EFFORTS, SEEDED_SKILL_EFFORTS);

			assert.deepEqual(seedWardenEffortDefaults(), { ok: true });
			assert.deepEqual(readSettings(), {
				warden: {
					effort: {
						skills: SEEDED_SKILL_EFFORTS,
					},
				},
			});
		});
	});

	it("preserves unrelated root, warden, and effort settings while seeding", async () => {
		await withTempSettings(
			{
				model: "test-model",
				warden: {
					agent: { cwd: "~/work" },
					useNerdGlyphs: true,
					effort: { profiles: { careful: true } },
				},
			},
			() => {
				assert.deepEqual(seedWardenEffortDefaults(), { ok: true });
				assert.deepEqual(readSettings(), {
					model: "test-model",
					warden: {
						agent: { cwd: "~/work" },
						useNerdGlyphs: true,
						effort: {
							profiles: { careful: true },
							skills: SEEDED_SKILL_EFFORTS,
						},
					},
				});
			},
		);
	});

	it("does not overwrite user-selected effort values", async () => {
		await withTempSettings(
			{
				warden: {
					effort: {
						skills: {
							"warden-map": "high",
						},
					},
				},
			},
			() => {
				assert.deepEqual(seedWardenEffortDefaults(), { ok: true });
				assert.deepEqual(readSettings().warden, {
					effort: {
						skills: {
							...SEEDED_SKILL_EFFORTS,
							"warden-map": EFFORT_HIGH,
						},
					},
				});
			},
		);
	});

	it("reads and writes Warden skill status indicator toggle", async () => {
		await withTempSettings(
			{
				model: "test-model",
				warden: {
					agent: { cwd: "~/work" },
					effort: {
						profiles: { careful: true },
						skills: { "warden-map": "low" },
					},
				},
			},
			() => {
				assert.equal(readWardenSkillStatusEnabled(), false);

				assert.deepEqual(setWardenSkillStatusEnabled(true), { ok: true });
				assert.equal(readWardenSkillStatusEnabled(), true);
				assert.deepEqual(readSettings(), {
					model: "test-model",
					warden: {
						agent: { cwd: "~/work" },
						effort: {
							profiles: { careful: true },
							showSkillStatus: true,
							skills: { "warden-map": "low" },
						},
					},
				});

				assert.deepEqual(setWardenSkillStatusEnabled(false), { ok: true });
				assert.equal(readWardenSkillStatusEnabled(), false);
				assert.deepEqual(readSettings(), {
					model: "test-model",
					warden: {
						agent: { cwd: "~/work" },
						effort: {
							profiles: { careful: true },
							showSkillStatus: false,
							skills: { "warden-map": "low" },
						},
					},
				});
			},
		);
	});
});
