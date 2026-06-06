import assert from "node:assert/strict";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import {
	getPiAgentSettingsPath,
	getWardenSettings,
	readPiAgentSettings,
	writeWardenSettings,
} from "../src/settings.js";

function withTempSettings(contents: unknown, test: () => void): void {
	const originalTestHome = process.env.WARDEN_PANEL_TEST_HOME;
	const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
	const testHome = mkdtempSync(join(tmpdir(), "warden-panel-settings-"));
	process.env.WARDEN_PANEL_TEST_HOME = testHome;

	try {
		if (contents !== undefined) {
			const settingsPath = getPiAgentSettingsPath();
			mkdirSync(dirname(settingsPath), { recursive: true });
			writeFileSync(
				settingsPath,
				typeof contents === "string" ? contents : JSON.stringify(contents),
				"utf-8",
			);
		}
		test();
	} finally {
		if (originalTestHome === undefined)
			delete process.env.WARDEN_PANEL_TEST_HOME;
		else process.env.WARDEN_PANEL_TEST_HOME = originalTestHome;
		if (originalAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
		else process.env.PI_CODING_AGENT_DIR = originalAgentDir;
		rmSync(testHome, { recursive: true, force: true });
	}
}

describe("getPiAgentSettingsPath", () => {
	it("uses PI_CODING_AGENT_DIR when present", () => {
		const originalTestHome = process.env.WARDEN_PANEL_TEST_HOME;
		const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
		delete process.env.WARDEN_PANEL_TEST_HOME;
		process.env.PI_CODING_AGENT_DIR = "/tmp/pi-agent-dir";

		try {
			assert.equal(
				getPiAgentSettingsPath(),
				join("/tmp/pi-agent-dir", "settings.json"),
			);
		} finally {
			if (originalTestHome === undefined)
				delete process.env.WARDEN_PANEL_TEST_HOME;
			else process.env.WARDEN_PANEL_TEST_HOME = originalTestHome;
			if (originalAgentDir === undefined)
				delete process.env.PI_CODING_AGENT_DIR;
			else process.env.PI_CODING_AGENT_DIR = originalAgentDir;
		}
	});

	it("keeps test home override ahead of PI_CODING_AGENT_DIR", () => {
		const originalTestHome = process.env.WARDEN_PANEL_TEST_HOME;
		const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
		process.env.WARDEN_PANEL_TEST_HOME = "/tmp/warden-panel-test-home";
		process.env.PI_CODING_AGENT_DIR = "/tmp/pi-agent-dir";

		try {
			assert.equal(
				getPiAgentSettingsPath(),
				join("/tmp/warden-panel-test-home", ".pi", "agent", "settings.json"),
			);
		} finally {
			if (originalTestHome === undefined)
				delete process.env.WARDEN_PANEL_TEST_HOME;
			else process.env.WARDEN_PANEL_TEST_HOME = originalTestHome;
			if (originalAgentDir === undefined)
				delete process.env.PI_CODING_AGENT_DIR;
			else process.env.PI_CODING_AGENT_DIR = originalAgentDir;
		}
	});
});

describe("Warden settings", () => {
	it("treats missing settings as empty and creates the file on write", () => {
		withTempSettings(undefined, () => {
			const readResult = readPiAgentSettings();
			assert.deepEqual(readResult, { ok: true, settings: {} });

			const writeResult = writeWardenSettings({ useNerdGlyphs: true });
			assert.deepEqual(writeResult, { ok: true });
			assert.equal(existsSync(getPiAgentSettingsPath()), true);
			assert.deepEqual(
				JSON.parse(readFileSync(getPiAgentSettingsPath(), "utf-8")),
				{
					warden: { useNerdGlyphs: true },
				},
			);
		});
	});

	it("returns invalid-json for corrupt settings", () => {
		withTempSettings("{not json", () => {
			const result = readPiAgentSettings();
			assert.equal(result.ok, false);
			if (!result.ok) assert.equal(result.kind, "invalid-json");
		});
	});

	it("returns invalid-shape when settings root is not an object", () => {
		withTempSettings([], () => {
			const result = readPiAgentSettings();
			assert.equal(result.ok, false);
			if (!result.ok) assert.equal(result.kind, "invalid-shape");
		});
	});

	it("reads Warden display settings", () => {
		assert.deepEqual(getWardenSettings({ warden: { useNerdGlyphs: true } }), {
			useNerdGlyphs: true,
		});
		assert.deepEqual(getWardenSettings({ warden: { useNerdGlyphs: false } }), {
			useNerdGlyphs: false,
		});
		assert.deepEqual(
			getWardenSettings({
				warden: {
					effort: {
						profiles: { careful: true },
						showSkillStatus: true,
					},
				},
			}),
			{
				effort: {
					profiles: { careful: true },
					showSkillStatus: true,
				},
			},
		);
		assert.deepEqual(
			getWardenSettings({ warden: { useNerdGlyphs: "yes" } }),
			{},
		);
		assert.deepEqual(getWardenSettings({ warden: true }), {});
		assert.deepEqual(getWardenSettings(undefined), {});
	});

	it("writes warden settings while preserving root and existing warden keys", () => {
		withTempSettings(
			{
				packages: ["npm:example"],
				other: { keep: true },
				warden: {
					agents: { sentinel: { cwd: "~/work/project" } },
					existing: "value",
				},
			},
			() => {
				const result = writeWardenSettings({
					effort: { showSkillStatus: true },
					useNerdGlyphs: true,
				});
				assert.deepEqual(result, { ok: true });
				assert.deepEqual(
					JSON.parse(readFileSync(getPiAgentSettingsPath(), "utf-8")),
					{
						packages: ["npm:example"],
						other: { keep: true },
						warden: {
							agents: { sentinel: { cwd: "~/work/project" } },
							effort: { showSkillStatus: true },
							existing: "value",
							useNerdGlyphs: true,
						},
					},
				);
			},
		);
	});

	it("refuses writes when existing settings are invalid", () => {
		withTempSettings("{not json", () => {
			const result = writeWardenSettings({ useNerdGlyphs: true });
			assert.equal(result.ok, false);
			if (!result.ok) assert.equal(result.settingsError.kind, "invalid-json");
		});
	});
});
