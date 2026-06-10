import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import wardenDirectives from "../extensions/warden-directives/index.js";
import { WARDEN_FLOW_DIRECTIVE_CUSTOM_TYPE } from "../src/index.js";

const envBefore = {
	NODE_ENV: process.env.NODE_ENV,
	PI_CODING_AGENT_DIR: process.env.PI_CODING_AGENT_DIR,
	WARDEN_FLOW_TEST_HOME: process.env.WARDEN_FLOW_TEST_HOME,
};

type Handler = (event?: unknown, ctx?: unknown) => unknown;
type FakePi = ReturnType<typeof createFakePi>;

type MessageResult = {
	readonly message: {
		readonly customType: string;
		readonly display: boolean;
		readonly content: string;
	};
};

function createFakePi() {
	const handlers = new Map<string, Handler[]>();
	return {
		handlers,
		on(name: string, handler: Handler) {
			handlers.set(name, [...(handlers.get(name) ?? []), handler]);
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

function assertMessageResult(value: unknown): asserts value is MessageResult {
	assert.ok(value && typeof value === "object" && "message" in value);
}

function writeSettings(settings: unknown): void {
	assert.ok(process.env.PI_CODING_AGENT_DIR);
	writeFileSync(
		join(process.env.PI_CODING_AGENT_DIR, "settings.json"),
		JSON.stringify(settings),
		"utf-8",
	);
}

beforeEach(() => {
	process.env.NODE_ENV = "test";
	delete process.env.WARDEN_FLOW_TEST_HOME;
	process.env.PI_CODING_AGENT_DIR = mkdtempSync(
		join(tmpdir(), "warden-directives-extension-"),
	);
	mkdirSync(process.env.PI_CODING_AGENT_DIR, { recursive: true });
});

afterEach(() => {
	if (process.env.PI_CODING_AGENT_DIR)
		rmSync(process.env.PI_CODING_AGENT_DIR, { recursive: true, force: true });
	for (const [key, value] of Object.entries(envBefore)) {
		if (value === undefined) delete process.env[key as keyof NodeJS.ProcessEnv];
		else process.env[key as keyof NodeJS.ProcessEnv] = value;
	}
});

describe("Warden directives extension", () => {
	it("transforms explicit warden-start --auto input and injects hidden directive", async () => {
		const pi = createFakePi();
		wardenDirectives(pi as unknown as ExtensionAPI);

		assert.deepEqual(
			await runFirstHandler(pi, "input", {
				text: "/skill:warden-start --auto add X",
				source: "interactive",
			}),
			{ action: "transform", text: "/skill:warden-start add X" },
		);

		const result = await runFirstHandler(pi, "before_agent_start", {
			prompt:
				'<skill name="warden-start" location="/tmp/SKILL.md">start</skill>',
		});

		assertMessageResult(result);
		assert.equal(result.message.customType, WARDEN_FLOW_DIRECTIVE_CUSTOM_TYPE);
		assert.equal(result.message.display, false);
		assert.match(
			result.message.content,
			/^<warden-flow-directive skill="warden-start" interactionMode="auto">/,
		);
		assert.match(result.message.content, /skip optional/i);
		assert.doesNotMatch(result.message.content, /--auto add X/);
	});

	it("uses settings fallback without transforming plain warden-start intent", async () => {
		writeSettings({ warden: { flow: { interactionMode: "auto" } } });
		const pi = createFakePi();
		wardenDirectives(pi as unknown as ExtensionAPI);

		assert.deepEqual(
			await runFirstHandler(pi, "input", {
				text: "/skill:warden-start add X",
				source: "interactive",
			}),
			{ action: "continue" },
		);

		const result = await runFirstHandler(pi, "before_agent_start", {
			prompt:
				'<skill name="warden-start" location="/tmp/SKILL.md">start</skill>',
		});

		assertMessageResult(result);
		assert.equal(result.message.customType, WARDEN_FLOW_DIRECTIVE_CUSTOM_TYPE);
	});

	it("uses settings fallback for already-expanded warden-start prompts", async () => {
		writeSettings({ warden: { flow: { interactionMode: "auto" } } });
		const pi = createFakePi();
		wardenDirectives(pi as unknown as ExtensionAPI);

		const result = await runFirstHandler(pi, "before_agent_start", {
			prompt:
				'<skill name="warden-start" location="/tmp/SKILL.md">start</skill>',
		});

		assertMessageResult(result);
		assert.match(result.message.content, /interactionMode="auto"/);
	});

	it("keeps interactive default when no flag or settings exist", async () => {
		const pi = createFakePi();
		wardenDirectives(pi as unknown as ExtensionAPI);

		assert.deepEqual(
			await runFirstHandler(pi, "input", {
				text: "/skill:warden-start add X",
				source: "interactive",
			}),
			{ action: "continue" },
		);
		assert.equal(
			await runFirstHandler(pi, "before_agent_start", {
				prompt:
					'<skill name="warden-start" location="/tmp/SKILL.md">start</skill>',
			}),
			undefined,
		);
	});

	it("clears pending explicit directive on agent end and shutdown", async () => {
		const pi = createFakePi();
		wardenDirectives(pi as unknown as ExtensionAPI);

		await runFirstHandler(pi, "input", {
			text: "/skill:warden-start --auto add X",
			source: "interactive",
		});
		await runFirstHandler(pi, "agent_end", {});
		assert.equal(
			await runFirstHandler(pi, "before_agent_start", {
				prompt:
					'<skill name="warden-start" location="/tmp/SKILL.md">start</skill>',
			}),
			undefined,
		);

		await runFirstHandler(pi, "input", {
			text: "/skill:warden-start --auto add X",
			source: "interactive",
		});
		await runFirstHandler(pi, "session_shutdown", {});
		assert.equal(
			await runFirstHandler(pi, "before_agent_start", {
				prompt:
					'<skill name="warden-start" location="/tmp/SKILL.md">start</skill>',
			}),
			undefined,
		);
	});
});
