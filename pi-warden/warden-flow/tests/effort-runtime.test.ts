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
import { clearWardenPanesForTests } from "../../warden-panel/src/registry.js";
import wardenEffort from "../extensions/warden-effort/index.js";
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

type Handler = (event?: any, ctx?: any) => any;

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
	pi: ReturnType<typeof createFakePi>,
	name: string,
	event?: any,
): Promise<any> {
	const handler = pi.handlers.get(name)?.[0];
	assert.ok(handler, `${name} handler should be registered`);
	return handler(event, { cwd: process.cwd() });
}

function writeSettings(settings: unknown): void {
	writeFileSync(getPiAgentSettingsPath(), JSON.stringify(settings), "utf-8");
}

function readSettings(): any {
	return JSON.parse(readFileSync(getPiAgentSettingsPath(), "utf-8"));
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
		wardenEffort(pi as any);

		await runFirstHandler(pi, "session_start", { reason: "startup" });

		assert.deepEqual(readSettings().warden, {
			agent: { cwd: "~/work" },
			effort: {
				skills: {
					"warden-map": "low",
					"warden-start": "medium",
					"warden-grill": "high",
					"warden-commit": "medium",
				},
			},
		});
	});

	it("applies low effort by default for /skill:warden-map", async () => {
		const pi = createFakePi("high");
		wardenEffort(pi as any);

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
		wardenEffort(pi as any);

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
		wardenEffort(pi as any);

		assert.deepEqual(
			await runFirstHandler(pi, "input", {
				text: "/skill:warden-grill review packet",
				source: "interactive",
			}),
			{ action: "continue" },
		);
		assert.deepEqual(pi.setCalls, ["high"]);
	});

	it("applies medium effort by default for /skill:warden-commit", async () => {
		const pi = createFakePi("off");
		wardenEffort(pi as any);

		assert.deepEqual(
			await runFirstHandler(pi, "input", {
				text: "/skill:warden-commit",
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
		wardenEffort(pi as any);

		await runFirstHandler(pi, "input", {
			text: "/skill:warden-map",
			source: "interactive",
		});

		assert.deepEqual(pi.setCalls, ["xhigh"]);
	});

	it("ignores non-Warden skills", async () => {
		const pi = createFakePi("medium");
		wardenEffort(pi as any);

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
		wardenEffort(pi as any);

		await runFirstHandler(pi, "input", {
			text: "/skill:warden-map",
			source: "interactive",
		});
		await runFirstHandler(pi, "agent_end", {});

		assert.deepEqual(pi.setCalls, ["low", "high"]);
	});
});
