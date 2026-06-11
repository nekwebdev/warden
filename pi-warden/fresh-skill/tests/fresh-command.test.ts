import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
	buildFreshReplayMessage,
	getFreshSkillCompletions,
	handleFreshCommand,
	parseFreshArguments,
	selectFreshSkillCommands,
} from "../src/index.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function command(name: string, source = "skill", description?: string) {
	return {
		name,
		description,
		source,
		sourceInfo: {
			path: `/tmp/${name}`,
			source,
			scope: "temporary",
			origin: "top-level",
		},
	};
}

function createHarness(
	options: {
		args?: string;
		commands?: ReturnType<typeof command>[];
		idle?: boolean;
		cancelled?: boolean;
	} = {},
) {
	const notifications: Array<{ message: string; level: string }> = [];
	const sent: string[] = [];
	const newSessionCalls: unknown[] = [];
	const parentSession = "/tmp/old-session.jsonl";
	const ctx = {
		isIdle: () => options.idle ?? true,
		ui: {
			notify: (message: string, level: string) =>
				notifications.push({ message, level }),
		},
		sessionManager: {
			getSessionFile: () => parentSession,
		},
		newSession: async (opts: {
			parentSession?: string;
			withSession?: (ctx: {
				sendUserMessage(message: string): Promise<void>;
			}) => Promise<void>;
		}) => {
			newSessionCalls.push(opts);
			if (options.cancelled) return { cancelled: true };
			await opts.withSession?.({
				sendUserMessage: async (message: string) => {
					sent.push(message);
				},
			});
			return { cancelled: false };
		},
	};
	const pi = {
		getCommands: () =>
			options.commands ?? [
				command("skill:warden-start", "skill", "Start work"),
			],
	};
	return { ctx, pi, notifications, sent, newSessionCalls, parentSession };
}

describe("fresh-skill package manifest", () => {
	it("declares a standalone Pi extension package", () => {
		const pkg = JSON.parse(
			readFileSync(resolve(packageRoot, "package.json"), "utf-8"),
		);
		assert.equal(pkg.name, "@nekwebdev/fresh-skill");
		assert.equal(pkg.type, "module");
		assert.equal(pkg.scripts?.test, "node scripts/run-tests.mjs");
		assert.deepEqual(pkg.pi?.extensions, ["./extensions/fresh/index.ts"]);
		assert.ok(pkg.keywords?.includes("pi-package"));
	});

	it("packs only intended package resources", () => {
		for (const entry of [
			"README.md",
			"AGENTS.md",
			"LICENSE",
			"extensions/fresh/index.ts",
			"src/index.ts",
			"scripts/run-tests.mjs",
			"tests/fresh-command.test.ts",
		]) {
			assert.ok(
				existsSync(resolve(packageRoot, entry)),
				`${entry} should exist`,
			);
		}

		const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
			cwd: packageRoot,
			encoding: "utf-8",
		});
		assert.equal(result.status, 0, result.stderr || result.stdout);
		const [packument] = JSON.parse(result.stdout);
		assert.equal(packument.name, "@nekwebdev/fresh-skill");
		assert.deepEqual(
			packument.files.map((file: { path: string }) => file.path).sort(),
			[
				"AGENTS.md",
				"LICENSE",
				"README.md",
				"extensions/fresh/index.ts",
				"package.json",
				"scripts/run-tests.mjs",
				"src/index.ts",
				"tests/fresh-command.test.ts",
			],
		);
	});
});

describe("fresh command parsing", () => {
	it("normalizes bare and skill-prefixed names while preserving exact remainder", () => {
		assert.deepEqual(
			parseFreshArguments("warden-start implement new extension"),
			{
				skillName: "warden-start",
				remainder: " implement new extension",
			},
		);
		assert.deepEqual(parseFreshArguments("skill:warden-start   args  kept "), {
			skillName: "warden-start",
			remainder: "   args  kept ",
		});
		assert.equal(
			buildFreshReplayMessage("warden-start", " implement new extension"),
			"/skill:warden-start implement new extension",
		);
		assert.equal(
			buildFreshReplayMessage("warden-start", ""),
			"/skill:warden-start",
		);
	});
});

describe("fresh command skill discovery and autocomplete", () => {
	const commands = [
		command("template:review", "prompt", "Prompt template"),
		command("fresh", "extension", "Fresh command"),
		command("skill:warden-start", "skill", "Start work"),
		command("skill:warden-tdd", "skill", "Implement packet"),
		command("skill:warden-commit", "skill", "Commit changes"),
		command("warden-local", "skill", "Local skill"),
	];

	it("selects only loaded skill commands as bare names", () => {
		assert.deepEqual(selectFreshSkillCommands(commands), [
			{ name: "warden-start", description: "Start work" },
			{ name: "warden-tdd", description: "Implement packet" },
			{ name: "warden-commit", description: "Commit changes" },
			{ name: "warden-local", description: "Local skill" },
		]);
	});

	it("autocompletes fuzzy-matching bare skill names and normalizes typed skill prefix", () => {
		assert.deepEqual(getFreshSkillCompletions(commands, "war"), [
			{
				value: "warden-start",
				label: "warden-start",
				description: "Start work",
			},
			{
				value: "warden-tdd",
				label: "warden-tdd",
				description: "Implement packet",
			},
			{
				value: "warden-commit",
				label: "warden-commit",
				description: "Commit changes",
			},
			{
				value: "warden-local",
				label: "warden-local",
				description: "Local skill",
			},
		]);
		assert.deepEqual(getFreshSkillCompletions(commands, "comm"), [
			{
				value: "warden-commit",
				label: "warden-commit",
				description: "Commit changes",
			},
		]);
		assert.deepEqual(getFreshSkillCompletions(commands, "skill:comm"), [
			{
				value: "warden-commit",
				label: "warden-commit",
				description: "Commit changes",
			},
		]);
	});

	it("stops skill autocomplete after first argument so Pi defaults can handle prompt input", () => {
		assert.equal(getFreshSkillCompletions(commands, "warden-start "), null);
		assert.equal(
			getFreshSkillCompletions(commands, "skill:warden-start ./src"),
			null,
		);
		assert.equal(
			getFreshSkillCompletions(commands, "warden-start @README.md"),
			null,
		);
	});
});

describe("fresh command handler", () => {
	it("creates a replacement session and sends the replay through replacement context", async () => {
		const harness = createHarness({
			args: "warden-start implement new extension",
		});
		await handleFreshCommand(
			harness.pi,
			"warden-start implement new extension",
			harness.ctx,
		);

		assert.equal(harness.newSessionCalls.length, 1);
		assert.equal(
			(harness.newSessionCalls[0] as { parentSession?: string }).parentSession,
			harness.parentSession,
		);
		assert.deepEqual(harness.sent, [
			"/skill:warden-start implement new extension",
		]);
		assert.deepEqual(harness.notifications, []);
	});

	it("accepts skill-prefixed input and normalizes replay", async () => {
		const harness = createHarness({ args: "skill:warden-start args" });
		await handleFreshCommand(
			harness.pi,
			"skill:warden-start args",
			harness.ctx,
		);

		assert.deepEqual(harness.sent, ["/skill:warden-start args"]);
	});

	it("rejects missing, unknown, and busy requests without creating a session", async () => {
		for (const [args, options] of [
			["", {}],
			["missing args", {}],
			["warden-start args", { idle: false }],
		] as const) {
			const harness = createHarness(options);
			await handleFreshCommand(harness.pi, args, harness.ctx);
			assert.equal(
				harness.newSessionCalls.length,
				0,
				`${args} should not create session`,
			);
			assert.equal(harness.sent.length, 0, `${args} should not send replay`);
			assert.equal(
				harness.notifications.length,
				1,
				`${args} should notify once`,
			);
			assert.equal(harness.notifications[0].level, "error");
		}
	});

	it("reports cleanly when new session is cancelled", async () => {
		const harness = createHarness({ cancelled: true });
		await handleFreshCommand(harness.pi, "warden-start args", harness.ctx);

		assert.equal(harness.newSessionCalls.length, 1);
		assert.deepEqual(harness.sent, []);
		assert.deepEqual(harness.notifications, [
			{ message: "New session cancelled", level: "info" },
		]);
	});
});
