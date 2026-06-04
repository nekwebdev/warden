import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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

function advertisedExtensionEntries(): string[] {
	return (pkg.pi?.extensions ?? []).flatMap((entry) => {
		if (entry === "./extensions/*/index.ts") {
			return readdirSync(resolve(packageRoot, "extensions"), {
				withFileTypes: true,
			})
				.filter((dirent) => dirent.isDirectory())
				.map((dirent) => join("extensions", dirent.name, "index.ts"));
		}
		return [entry];
	});
}

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

	it("advertises bundled extension entrypoints and core exports", () => {
		assert.deepEqual(pkg.pi?.extensions, ["./extensions/*/index.ts"]);
		assert.equal(pkg.exports?.["."], "./src/index.ts");
		assert.equal(pkg.files?.includes("index.ts"), true);
		assert.equal(pkg.files?.includes("src/**/*.ts"), true);
		assert.equal(pkg.files?.includes("extensions/**/*.ts"), true);
		assert.equal(pkg.files?.includes("!**/*.test.ts"), true);
	});

	it("loads all bundled extension families", () => {
		assert.deepEqual(advertisedExtensionEntries().sort(), [
			"extensions/warden-display/index.ts",
			"extensions/warden-packages/index.ts",
			"extensions/warden-panel/index.ts",
		]);
	});

	it("all advertised Pi resources and package exports exist", () => {
		const entries = [
			...advertisedExtensionEntries(),
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
