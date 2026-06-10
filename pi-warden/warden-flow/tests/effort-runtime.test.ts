import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { clearWardenPanesForTests } from "../../warden-panel/src/registry.js";
import wardenEffort, {
	WARDEN_SKILL_STATUS_KEY,
	renderWardenSkillStatus,
} from "../extensions/warden-effort/index.js";
import {
	getPiAgentSettingsPath,
	type WardenEffortLevel,
} from "../src/effort.js";

const envBefore = {
	NODE_ENV: process.env.NODE_ENV,
	PI_CODING_AGENT_DIR: process.env.PI_CODING_AGENT_DIR,
	WARDEN_FLOW_TEST_HOME: process.env.WARDEN_FLOW_TEST_HOME,
	WARDEN_PANEL_TEST_HOME: process.env.WARDEN_PANEL_TEST_HOME,
};

type Handler = (event?: unknown, ctx?: unknown) => unknown;
type StatusUpdate = { readonly key: string; readonly text: string | undefined };
type StatusTheme = Parameters<typeof renderWardenSkillStatus>[2];
type FakePi = ReturnType<typeof createFakePi>;

type TestSettings = {
	warden?: {
		agent?: { cwd?: string };
		effort?: {
			showSkillStatus?: boolean;
			skills?: Record<string, WardenEffortLevel>;
		};
	};
};

const statusTheme = {
	fg: (name: string, text: string) => `<${name}>${text}</${name}>`,
	bg: (name: string, text: string) => `{${name}}${text}{/${name}}`,
} as unknown as StatusTheme;

function createStatusContext(statuses: StatusUpdate[]) {
	return {
		cwd: process.cwd(),
		hasUI: true,
		ui: {
			theme: statusTheme,
			setStatus: mock.fn((key: string, text: string | undefined) =>
				statuses.push({ key, text }),
			),
		},
	};
}

function createFakePi(initialLevel: WardenEffortLevel = "off") {
	const handlers = new Map<string, Handler[]>();
	let thinkingLevel = initialLevel;
	const setCalls: WardenEffortLevel[] = [];
	return {
		handlers,
		setCalls,
		registerCommand: mock.fn(),
		on(name: string, handler: Handler) {
			handlers.set(name, [...(handlers.get(name) ?? []), handler]);
		},
		getThinkingLevel() {
			return thinkingLevel;
		},
		setThinkingLevel(level: WardenEffortLevel) {
			setCalls.push(level);
			thinkingLevel = level;
		},
	};
}

async function runFirstHandler(
	pi: FakePi,
	name: string,
	event?: unknown,
	ctx: unknown = { cwd: process.cwd() },
): Promise<unknown> {
	const handler = pi.handlers.get(name)?.[0];
	assert.ok(handler, `${name} handler should be registered`);
	return handler(event, ctx);
}

function writeSettings(settings: unknown): void {
	writeFileSync(getPiAgentSettingsPath(), JSON.stringify(settings), "utf-8");
}

function readSettings(): TestSettings {
	return JSON.parse(
		readFileSync(getPiAgentSettingsPath(), "utf-8"),
	) as TestSettings;
}

beforeEach(() => {
	process.env.NODE_ENV = "test";
	delete process.env.WARDEN_FLOW_TEST_HOME;
	delete process.env.WARDEN_PANEL_TEST_HOME;
	process.env.PI_CODING_AGENT_DIR = mkdtempSync(
		join(tmpdir(), "warden-effort-runtime-"),
	);
	mkdirSync(process.env.PI_CODING_AGENT_DIR, { recursive: true });
	clearWardenPanesForTests();
});

afterEach(() => {
	clearWardenPanesForTests();
	if (process.env.PI_CODING_AGENT_DIR)
		rmSync(process.env.PI_CODING_AGENT_DIR, { recursive: true, force: true });
	for (const [key, value] of Object.entries(envBefore)) {
		if (value === undefined) delete process.env[key as keyof NodeJS.ProcessEnv];
		else process.env[key as keyof NodeJS.ProcessEnv] = value;
	}
});

describe("Warden effort runtime hook", () => {
	it("seeds missing defaults on session start", async () => {
		writeSettings({ warden: { agent: { cwd: "~/work" } } });
		const pi = createFakePi();
		wardenEffort(pi as unknown as ExtensionAPI);

		await runFirstHandler(pi, "session_start", { reason: "startup" });

		assert.deepEqual(readSettings().warden, {
			agent: { cwd: "~/work" },
			effort: {
				skills: {
					"warden-map": "low",
					"warden-start": "medium",
					"warden-grill": "high",
					"warden-tdd": "high",
					"warden-close": "medium",
					"warden-commit": "medium",
					"warden-create-skill": "high",
					"warden-docs": "medium",
				},
			},
		});
	});

	it("applies low effort by default for /skill:warden-map", async () => {
		const pi = createFakePi("high");
		wardenEffort(pi as unknown as ExtensionAPI);

		assert.deepEqual(
			await runFirstHandler(pi, "input", {
				text: "/skill:warden-map refresh repo map",
				source: "interactive",
			}),
			{ action: "continue" },
		);
		assert.deepEqual(pi.setCalls, ["low"]);
	});

	it("applies medium effort by default for /skill:warden-start", async () => {
		const pi = createFakePi("off");
		wardenEffort(pi as unknown as ExtensionAPI);

		assert.deepEqual(
			await runFirstHandler(pi, "input", {
				text: "/skill:warden-start add lean packet",
				source: "interactive",
			}),
			{ action: "continue" },
		);
		assert.deepEqual(pi.setCalls, ["medium"]);
	});

	it("applies high effort by default for /skill:warden-grill", async () => {
		const pi = createFakePi("off");
		wardenEffort(pi as unknown as ExtensionAPI);

		assert.deepEqual(
			await runFirstHandler(pi, "input", {
				text: "/skill:warden-grill review packet",
				source: "interactive",
			}),
			{ action: "continue" },
		);
		assert.deepEqual(pi.setCalls, ["high"]);
	});

	it("applies high effort by default for /skill:warden-tdd", async () => {
		const pi = createFakePi("off");
		wardenEffort(pi as unknown as ExtensionAPI);

		assert.deepEqual(
			await runFirstHandler(pi, "input", {
				text: "/skill:warden-tdd .warden/work/example/packet.md",
				source: "interactive",
			}),
			{ action: "continue" },
		);
		assert.deepEqual(pi.setCalls, ["high"]);
	});

	it("applies medium effort by default for /skill:warden-close", async () => {
		const pi = createFakePi("off");
		wardenEffort(pi as unknown as ExtensionAPI);

		assert.deepEqual(
			await runFirstHandler(pi, "input", {
				text: "/skill:warden-close .warden/work/example/packet.md",
				source: "interactive",
			}),
			{ action: "continue" },
		);
		assert.deepEqual(pi.setCalls, ["medium"]);
	});

	it("applies medium effort by default for /skill:warden-commit", async () => {
		const pi = createFakePi("off");
		wardenEffort(pi as unknown as ExtensionAPI);

		assert.deepEqual(
			await runFirstHandler(pi, "input", {
				text: "/skill:warden-commit",
				source: "interactive",
			}),
			{ action: "continue" },
		);
		assert.deepEqual(pi.setCalls, ["medium"]);
	});

	it("applies high effort by default for /skill:warden-create-skill", async () => {
		const pi = createFakePi("off");
		wardenEffort(pi as unknown as ExtensionAPI);

		assert.deepEqual(
			await runFirstHandler(pi, "input", {
				text: "/skill:warden-create-skill browser automation",
				source: "interactive",
			}),
			{ action: "continue" },
		);
		assert.deepEqual(pi.setCalls, ["high"]);
	});

	it("applies medium effort by default for /skill:warden-docs", async () => {
		const pi = createFakePi("off");
		wardenEffort(pi as unknown as ExtensionAPI);

		assert.deepEqual(
			await runFirstHandler(pi, "input", {
				text: "/skill:warden-docs",
				source: "interactive",
			}),
			{ action: "continue" },
		);
		assert.deepEqual(pi.setCalls, ["medium"]);
	});

	it("uses user-configured effort overrides", async () => {
		writeSettings({
			warden: { effort: { skills: { "warden-map": "xhigh" } } },
		});
		const pi = createFakePi("minimal");
		wardenEffort(pi as unknown as ExtensionAPI);

		await runFirstHandler(pi, "input", {
			text: "/skill:warden-map",
			source: "interactive",
		});

		assert.deepEqual(pi.setCalls, ["xhigh"]);
	});

	it("shows a themed footer capsule when a Warden skill starts", async () => {
		writeSettings({ warden: { effort: { showSkillStatus: true } } });
		const statuses: StatusUpdate[] = [];
		const ctx = createStatusContext(statuses);
		const pi = createFakePi("high");
		wardenEffort(pi as unknown as ExtensionAPI);

		await runFirstHandler(
			pi,
			"input",
			{
				text: "/skill:warden-commit",
				source: "interactive",
			},
			ctx,
		);
		assert.deepEqual(statuses, []);

		await runFirstHandler(
			pi,
			"before_agent_start",
			{
				prompt:
					'<skill name="warden-commit" location="/tmp/SKILL.md">commit workflow</skill>',
			},
			ctx,
		);

		const expected = renderWardenSkillStatus(
			"warden-commit",
			"medium",
			statusTheme,
		);
		assert.deepEqual(statuses[0], {
			key: WARDEN_SKILL_STATUS_KEY,
			text: expected,
		});
		assert.match(expected, /<thinkingMedium>medium<\/thinkingMedium>/);
		assert.match(expected, /<customMessageLabel>skill<\/customMessageLabel>/);
		assert.doesNotMatch(expected, /customMessageBg/);

		await runFirstHandler(pi, "agent_end", {}, ctx);

		assert.deepEqual(statuses[statuses.length - 1], {
			key: WARDEN_SKILL_STATUS_KEY,
			text: undefined,
		});
	});

	it("applies effort and status for already-expanded Warden skill blocks", async () => {
		writeSettings({ warden: { effort: { showSkillStatus: true } } });
		const statuses: StatusUpdate[] = [];
		const ctx = createStatusContext(statuses);
		const pi = createFakePi("minimal");
		wardenEffort(pi as unknown as ExtensionAPI);

		await runFirstHandler(
			pi,
			"before_agent_start",
			{
				prompt:
					'<skill name="warden-grill" location="/tmp/SKILL.md">grill workflow</skill>',
			},
			ctx,
		);

		assert.deepEqual(pi.setCalls, ["high"]);
		assert.deepEqual(statuses[0], {
			key: WARDEN_SKILL_STATUS_KEY,
			text: renderWardenSkillStatus("warden-grill", "high", statusTheme),
		});
	});

	it("skips skill status indicator when disabled", async () => {
		writeSettings({
			warden: {
				effort: {
					showSkillStatus: false,
					skills: { "warden-grill": "high" },
				},
			},
		});
		const statuses: StatusUpdate[] = [];
		const ctx = createStatusContext(statuses);
		const pi = createFakePi("minimal");
		wardenEffort(pi as unknown as ExtensionAPI);

		await runFirstHandler(
			pi,
			"before_agent_start",
			{
				prompt:
					'<skill name="warden-grill" location="/tmp/SKILL.md">grill workflow</skill>',
			},
			ctx,
		);
		await runFirstHandler(pi, "agent_end", {}, ctx);

		assert.deepEqual(pi.setCalls, ["high", "minimal"]);
		assert.deepEqual(statuses, []);
	});

	it("ignores non-Warden skills", async () => {
		const pi = createFakePi("medium");
		wardenEffort(pi as unknown as ExtensionAPI);

		assert.equal(
			await runFirstHandler(pi, "input", {
				text: "/skill:other-skill",
				source: "interactive",
			}),
			undefined,
		);
		assert.deepEqual(pi.setCalls, []);
	});

	it("restores the previous thinking level after the agent turn", async () => {
		const pi = createFakePi("high");
		wardenEffort(pi as unknown as ExtensionAPI);

		await runFirstHandler(pi, "input", {
			text: "/skill:warden-map",
			source: "interactive",
		});
		await runFirstHandler(pi, "agent_end", {});

		assert.deepEqual(pi.setCalls, ["low", "high"]);
	});
});
