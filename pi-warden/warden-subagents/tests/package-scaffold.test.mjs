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
		assert.equal(pkg.exports?.["."], "./index.ts");
		assert.deepEqual(pkg.pi?.extensions, ["./extensions/subagents/index.ts"]);
	});

	it("packs only intended scaffold resources", () => {
		const requiredEntries = [
			"README.md",
			"AGENTS.md",
			"LICENSE",
			"index.ts",
			"src/agent-types.ts",
			"src/custom-agents.ts",
			"src/default-agents.ts",
			"src/types.ts",
			"extensions/subagents/index.ts",
			"scripts/run-tests.mjs",
			"tests/package-scaffold.test.mjs",
			"tests/agent-types.test.mjs",
			"tests/custom-agents.test.mjs",
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
			"src/agent-types.ts",
			"src/custom-agents.ts",
			"src/default-agents.ts",
			"src/types.ts",
			"tests/agent-types.test.mjs",
			"tests/custom-agents.test.mjs",
			"tests/package-scaffold.test.mjs",
		]);
	});
});

describe("warden-subagents extension scaffold", () => {
	it("re-exports package identity and default no-op extension", async () => {
		const mod = await import(pathToFileURL(resolve(packageRoot, "index.ts")));
		assert.equal(mod.WARDEN_SUBAGENTS_PACKAGE, "@nekwebdev/warden-subagents");
		assert.equal(typeof mod.default, "function");
		assert.equal(mod.default, mod.wardenSubagents);
	});

	it("loads without touching Pi registration or runtime APIs", async () => {
		const mod = await import(
			pathToFileURL(resolve(packageRoot, "extensions/subagents/index.ts"))
		);
		assert.equal(mod.WARDEN_SUBAGENTS_PACKAGE, "@nekwebdev/warden-subagents");
		assert.equal(typeof mod.default, "function");

		const touched = [];
		const fakeApi = new Proxy(
			{},
			{
				get(_target, property) {
					touched.push(String(property));
					throw new Error(`unexpected Pi API access: ${String(property)}`);
				},
			},
		);

		assert.equal(mod.default(fakeApi), undefined);
		assert.deepEqual(touched, []);
	});

	it("documents scope fences and upstream attribution", () => {
		const readme = readFileSync(resolve(packageRoot, "README.md"), "utf-8");
		const agents = readFileSync(resolve(packageRoot, "AGENTS.md"), "utf-8");
		const combined = `${readme}\n${agents}`;

		for (const phrase of [
			"no Agent runtime",
			"no background execution",
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
