import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonPath = resolve(packageRoot, "package.json");

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf-8"));
}

describe("warden-subagents package manifest", () => {
	it("declares independent Pi extension package metadata", () => {
		assert.ok(existsSync(packageJsonPath), "package.json should exist");
		const pkg = readJson(packageJsonPath);

		assert.equal(pkg.name, "@nekwebdev/warden-subagents");
		assert.equal(pkg.version, "0.1.0");
		assert.equal(pkg.type, "module");
		assert.equal(pkg.author, "nekwebdev");
		assert.equal(pkg.license, "MIT");
		assert.equal(pkg.scripts?.test, "node scripts/run-tests.mjs");
		assert.equal(pkg.repository?.directory, "pi-warden/warden-subagents");
		assert.ok(pkg.keywords?.includes("pi-package"));
		assert.ok(pkg.keywords?.includes("warden-subagents"));
	});

	it("declares Pi API import dependencies and package entrypoints", () => {
		const pkg = readJson(packageJsonPath);

		assert.equal(
			pkg.peerDependencies?.["@earendil-works/pi-coding-agent"],
			"*",
		);
		assert.equal(pkg.devDependencies?.["@earendil-works/pi-coding-agent"], "*");
		assert.equal(pkg.devDependencies?.tsx, "^4.20.0");
		assert.equal(
			pkg.dependencies?.["@nekwebdev/warden-panel"],
			"file:../warden-panel",
		);
		assert.equal(pkg.exports?.["."], "./index.ts");
		assert.deepEqual(pkg.pi?.extensions, ["./extensions/subagents/index.ts"]);
	});

	it("packs only intended scaffold resources", () => {
		const requiredEntries = [
			"README.md",
			"AGENTS.md",
			"LICENSE",
			"index.ts",
			"src/agent-manager.ts",
			"src/agent-runner.ts",
			"src/agent-types.ts",
			"src/context.ts",
			"src/custom-agents.ts",
			"src/default-agents.ts",
			"src/enabled-models.ts",
			"src/invocation-config.ts",
			"src/model-resolver.ts",
			"src/prompts.ts",
			"src/status-note.ts",
			"src/types.ts",
			"src/usage.ts",
			"src/ui/agent-renderer.ts",
			"src/ui/agent-widget.ts",
			"src/ui/notification-renderer.ts",
			"src/ui/subagents-pane.ts",
			"extensions/subagents/index.ts",
			"scripts/run-tests.mjs",
			"tests/package-scaffold.test.mjs",
			"tests/agent-types.test.mjs",
			"tests/custom-agents.test.mjs",
			"tests/agent-runner.test.mjs",
			"tests/agent-manager.test.mjs",
			"tests/usage.test.mjs",
			"tests/agent-widget.test.mjs",
			"tests/agent-renderer.test.mjs",
			"tests/notification-renderer.test.mjs",
			"tests/subagents-pane.test.mjs",
		];

		for (const entry of requiredEntries) {
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
		assert.equal(packument.name, "@nekwebdev/warden-subagents");
		assert.deepEqual(packument.files.map((file) => file.path).sort(), [
			"AGENTS.md",
			"LICENSE",
			"README.md",
			"extensions/subagents/index.ts",
			"index.ts",
			"package.json",
			"scripts/run-tests.mjs",
			"src/agent-manager.ts",
			"src/agent-runner.ts",
			"src/agent-types.ts",
			"src/context.ts",
			"src/custom-agents.ts",
			"src/default-agents.ts",
			"src/enabled-models.ts",
			"src/invocation-config.ts",
			"src/model-resolver.ts",
			"src/prompts.ts",
			"src/status-note.ts",
			"src/types.ts",
			"src/ui/agent-renderer.ts",
			"src/ui/agent-widget.ts",
			"src/ui/notification-renderer.ts",
			"src/ui/subagents-pane.ts",
			"src/usage.ts",
			"tests/agent-manager.test.mjs",
			"tests/agent-renderer.test.mjs",
			"tests/agent-runner.test.mjs",
			"tests/agent-types.test.mjs",
			"tests/agent-widget.test.mjs",
			"tests/custom-agents.test.mjs",
			"tests/notification-renderer.test.mjs",
			"tests/package-scaffold.test.mjs",
			"tests/subagents-pane.test.mjs",
			"tests/usage.test.mjs",
		]);
	});
});

describe("warden-subagents extension scaffold", () => {
	it("re-exports package identity and default foreground extension", async () => {
		const mod = await import(pathToFileURL(resolve(packageRoot, "index.ts")));
		assert.equal(mod.WARDEN_SUBAGENTS_PACKAGE, "@nekwebdev/warden-subagents");
		assert.equal(typeof mod.default, "function");
		assert.equal(mod.default, mod.wardenSubagents);
	});

	it("registers shared Agent/result tools and shutdown cleanup without starting runtime work", async () => {
		const mod = await import(
			pathToFileURL(resolve(packageRoot, "extensions/subagents/index.ts"))
		);
		assert.equal(mod.WARDEN_SUBAGENTS_PACKAGE, "@nekwebdev/warden-subagents");
		assert.equal(typeof mod.default, "function");

		const registeredTools = [];
		const registeredCommands = [];
		const handlers = new Map();
		const fakeApi = {
			registerTool(tool) {
				registeredTools.push(tool);
			},
			registerCommand(name) {
				registeredCommands.push(name);
			},
			on(event, handler) {
				handlers.set(event, handler);
			},
		};

		assert.equal(mod.default(fakeApi), undefined);
		assert.deepEqual(
			registeredTools.map((tool) => tool.name),
			["Agent", "get_subagent_result"],
		);
		assert.equal(typeof registeredTools[0].execute, "function");
		assert.equal(typeof registeredTools[1].execute, "function");
		assert.deepEqual(registeredCommands, ["agents", "warden:agents"]);
		assert.equal(typeof handlers.get("session_shutdown"), "function");
	});

	it("documents foreground scope fences and upstream attribution", () => {
		const readme = readFileSync(resolve(packageRoot, "README.md"), "utf-8");
		const agents = readFileSync(resolve(packageRoot, "AGENTS.md"), "utf-8");
		const combined = `${readme}\n${agents}`;

		for (const phrase of [
			"foreground `Agent` tool",
			"background launch/result lookup",
			"read-only Warden Panel Subagents pane",
			"no RPC behavior",
			"no worktree isolation",
			"tintinweb/pi-subagents",
			"2933ca1d8d30e4e229b6c683f20190423fdd1ed3",
			"MIT",
			"no upstream source is vendored",
		]) {
			assert.ok(combined.includes(phrase), `docs should mention ${phrase}`);
		}
	});
});
