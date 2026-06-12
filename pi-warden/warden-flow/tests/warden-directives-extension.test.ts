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
	const execCalls: string[] = [];
	return {
		handlers,
		execCalls,
		on(name: string, handler: Handler) {
			handlers.set(name, [...(handlers.get(name) ?? []), handler]);
		},
		async exec(_command: string, args: string[]) {
			execCalls.push(args.join(" "));
			const key = args.join(" ");
			if (key === "rev-parse --abbrev-ref HEAD")
				return { stdout: "main\n", code: 0 };
			if (key === "status --porcelain") return { stdout: "", code: 0 };
			if (key.startsWith("show-ref --verify --quiet refs/heads/")) {
				return { stdout: "", code: 1 };
			}
			if (key.startsWith("switch -c ")) return { stdout: "", code: 0 };
			if (key.startsWith("switch ")) return { stdout: "", code: 0 };
			throw new Error(`unexpected git args: ${key}`);
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

	it("transforms direct warden-commit --auto input and injects consent marker", async () => {
		const pi = createFakePi();
		wardenDirectives(pi as unknown as ExtensionAPI);

		assert.deepEqual(
			await runFirstHandler(pi, "input", {
				text: "/skill:warden-commit --auto finish packet",
				source: "interactive",
			}),
			{ action: "transform", text: "/skill:warden-commit finish packet" },
		);

		const result = await runFirstHandler(pi, "before_agent_start", {
			prompt:
				'<skill name="warden-commit" location="/tmp/SKILL.md">commit</skill>',
		});

		assertMessageResult(result);
		assert.equal(result.message.customType, WARDEN_FLOW_DIRECTIVE_CUSTOM_TYPE);
		assert.equal(result.message.display, false);
		assert.match(
			result.message.content,
			/^<warden-flow-directive skill="warden-commit" interactionMode="auto">/,
		);
		assert.match(result.message.content, /directAutoCommitConsent=true/);
		assert.doesNotMatch(result.message.content, /--auto finish packet/);
	});

	it("transforms direct warden-map --auto input and injects hidden directive", async () => {
		const pi = createFakePi();
		wardenDirectives(pi as unknown as ExtensionAPI);

		assert.deepEqual(
			await runFirstHandler(pi, "input", {
				text: "/skill:warden-map --auto pi-warden/warden-flow",
				source: "interactive",
			}),
			{ action: "transform", text: "/skill:warden-map pi-warden/warden-flow" },
		);

		const result = await runFirstHandler(pi, "before_agent_start", {
			prompt: '<skill name="warden-map" location="/tmp/SKILL.md">map</skill>',
		});

		assertMessageResult(result);
		assert.equal(result.message.customType, WARDEN_FLOW_DIRECTIVE_CUSTOM_TYPE);
		assert.match(
			result.message.content,
			/^<warden-flow-directive skill="warden-map" interactionMode="auto">/,
		);
	});

	it("rejects unsafe warden-map --auto scope before directive injection", async () => {
		const pi = createFakePi();
		wardenDirectives(pi as unknown as ExtensionAPI);

		await assert.rejects(
			runFirstHandler(pi, "input", {
				text: "/skill:warden-map --auto ../outside",
				source: "interactive",
			}),
			/warden-map: --auto scope/i,
		);
	});

	it("does not use settings fallback for commit or map auto mode", async () => {
		writeSettings({ warden: { flow: { interactionMode: "auto" } } });
		const pi = createFakePi();
		wardenDirectives(pi as unknown as ExtensionAPI);

		for (const skillName of ["warden-commit", "warden-map"]) {
			assert.deepEqual(
				await runFirstHandler(pi, "input", {
					text: `/skill:${skillName} normal intent`,
					source: "interactive",
				}),
				{ action: "continue" },
			);
			assert.equal(
				await runFirstHandler(pi, "before_agent_start", {
					prompt: `<skill name="${skillName}" location="/tmp/SKILL.md">body</skill>`,
				}),
				undefined,
			);
		}
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

	it("injects deterministic selection while keeping interactive prompts by default", async () => {
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
		assert.match(result.message.content, /interactionMode="prompt"/);
		assert.match(result.message.content, /Warden Start Prompt Selection/);
		assert.match(result.message.content, /Packet type: feature/);
		assert.match(
			result.message.content,
			/Skip create\/switch branch prompt: no/,
		);
	});

	it("injects name directive for leading name flag", async () => {
		const pi = createFakePi();
		wardenDirectives(pi as unknown as ExtensionAPI);

		assert.deepEqual(
			await runFirstHandler(pi, "input", {
				text: "/skill:warden-start --name branch-aware-start add X",
				source: "interactive",
			}),
			{ action: "transform", text: "/skill:warden-start add X" },
		);
		const result = await runFirstHandler(pi, "before_agent_start", {
			prompt:
				'<skill name="warden-start" location="/tmp/SKILL.md">start</skill>',
		});

		assertMessageResult(result);
		assert.match(result.message.content, /interactionMode="name"/);
		assert.match(result.message.content, /Warden Start Name Selection/);
		assert.match(result.message.content, /Packet slug: branch-aware-start/);
	});

	it("clears pending explicit directive on agent end and shutdown", async () => {
		const pi = createFakePi();
		wardenDirectives(pi as unknown as ExtensionAPI);

		await runFirstHandler(pi, "input", {
			text: "/skill:warden-commit --auto finish packet",
			source: "interactive",
		});
		await runFirstHandler(pi, "agent_end", {});
		assert.equal(
			await runFirstHandler(pi, "before_agent_start", {
				prompt:
					'<skill name="warden-commit" location="/tmp/SKILL.md">commit</skill>',
			}),
			undefined,
		);

		await runFirstHandler(pi, "input", {
			text: "/skill:warden-map --auto pi-warden",
			source: "interactive",
		});
		await runFirstHandler(pi, "session_shutdown", {});
		assert.equal(
			await runFirstHandler(pi, "before_agent_start", {
				prompt: '<skill name="warden-map" location="/tmp/SKILL.md">map</skill>',
			}),
			undefined,
		);
	});
});
