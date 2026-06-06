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
	seedWardenEffortDefaults,
} from "../src/index.js";

const envBefore = process.env.WARDEN_FLOW_TEST_HOME;

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
			"off",
			"minimal",
			"low",
			"medium",
			"high",
			"xhigh",
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
				["off", "minimal"],
				["minimal", "low"],
				["low", "medium"],
				["medium", "high"],
				["high", "xhigh"],
				["xhigh", "off"],
			],
		);
	});

	it("seeds missing Warden Flow effort defaults", async () => {
		await withTempSettings({}, () => {
			assert.deepEqual(DEFAULT_WARDEN_SKILL_EFFORTS, {
				"warden-map": "low",
				"warden-start": "medium",
				"warden-commit": "medium",
			});

			assert.deepEqual(seedWardenEffortDefaults(), { ok: true });
			assert.deepEqual(readSettings(), {
				warden: {
					effort: {
						skills: {
							"warden-map": "low",
							"warden-start": "medium",
							"warden-commit": "medium",
						},
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
							skills: {
								"warden-map": "low",
								"warden-start": "medium",
								"warden-commit": "medium",
							},
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
							"warden-map": "high",
							"warden-start": "medium",
							"warden-commit": "medium",
						},
					},
				});
			},
		);
	});
});
