import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const pkg = JSON.parse(
	readFileSync(resolve(packageRoot, "package.json"), "utf-8"),
) as {
	name?: string;
	type?: string;
	files?: string[];
	scripts?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	exports?: Record<string, string>;
	pi?: { extensions?: string[] };
};

describe("package pi resources", () => {
	it("declares warden-panel package identity", () => {
		assert.equal(pkg.name, "@nekwebdev/warden-panel");
		assert.equal(pkg.type, "module");
		assert.equal(pkg.scripts?.test, "node scripts/run-tests.mjs");
	});

	it("declares Pi extension runtime dependencies", () => {
		assert.equal(
			pkg.peerDependencies?.["@earendil-works/pi-coding-agent"],
			"*",
		);
		assert.equal(pkg.peerDependencies?.["@earendil-works/pi-tui"], "*");
		assert.equal(pkg.devDependencies?.tsx, "^4.20.0");
	});

	it("advertises the warden-panel extension entrypoint", () => {
		assert.deepEqual(pkg.pi?.extensions, ["./index.ts"]);
		assert.equal(pkg.exports?.["."], "./src/index.ts");
		assert.equal(pkg.files?.includes("index.ts"), true);
		assert.equal(pkg.files?.includes("src/**/*.ts"), true);
		assert.equal(pkg.files?.includes("!**/*.test.ts"), true);
	});

	it("keeps Pi package entrypoint at the package root for startup labels", () => {
		assert.equal(pkg.pi?.extensions?.[0], "./index.ts");
		assert.notEqual(pkg.pi?.extensions?.[0], "./src/index.ts");
	});

	it("all advertised Pi resources and package exports exist", () => {
		const entries = [
			...(pkg.pi?.extensions ?? []),
			...(pkg.exports ? Object.values(pkg.exports) : []),
		];
		assert.ok(
			entries.length > 0,
			"expected advertised Pi resources and exports",
		);

		for (const entry of entries) {
			assert.equal(
				existsSync(resolve(packageRoot, entry)),
				true,
				`${entry} should exist`,
			);
		}
	});

	it("package dry-run succeeds", () => {
		const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
			cwd: packageRoot,
			encoding: "utf-8",
		});

		assert.equal(result.status, 0, result.stderr || result.stdout);
		assert.match(result.stdout, /@nekwebdev\/warden-panel/);
	});
});
