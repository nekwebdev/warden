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
	dependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	exports?: Record<string, string>;
	pi?: { extensions?: string[]; skills?: string[] };
};

function directoryNames(relativeDir: string): string[] {
	return readdirSync(resolve(packageRoot, relativeDir), { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name)
		.sort();
}

function extensionEntries(): string[] {
	return directoryNames("extensions").map((name) =>
		join("extensions", name, "index.ts"),
	);
}

function skillEntries(): string[] {
	return directoryNames("skills").map((name) =>
		join("skills", name, "SKILL.md"),
	);
}

function advertisedExtensionEntries(): string[] {
	return (pkg.pi?.extensions ?? []).flatMap((entry) => {
		if (entry === "./extensions/*/index.ts") return extensionEntries();
		return [entry];
	});
}

describe("package pi resources", () => {
	it("declares warden-flow package identity", () => {
		assert.equal(pkg.name, "@nekwebdev/warden-flow");
		assert.equal(pkg.type, "module");
		assert.equal(pkg.scripts?.test, "node scripts/run-tests.mjs");
	});

	it("declares Pi extension runtime dependencies", () => {
		assert.equal(
			pkg.dependencies?.["@nekwebdev/warden-panel"],
			"file:../warden-panel",
		);
		assert.equal(
			pkg.peerDependencies?.["@earendil-works/pi-coding-agent"],
			"*",
		);
		assert.equal(pkg.devDependencies?.tsx, "^4.20.0");
	});

	it("advertises bundled extension, skill, and exports", () => {
		assert.deepEqual(pkg.pi?.extensions, ["./extensions/*/index.ts"]);
		assert.deepEqual(pkg.pi?.skills, ["./skills"]);
		assert.equal(pkg.exports?.["."], "./src/index.ts");
		assert.equal(pkg.files?.includes("index.ts"), true);
		assert.equal(pkg.files?.includes("src/**/*.ts"), true);
		assert.equal(pkg.files?.includes("extensions/**/*.ts"), true);
		assert.equal(pkg.files?.includes("skills/**"), true);
		assert.equal(pkg.files?.includes("!**/*.test.ts"), true);
	});

	it("all advertised Pi resources and package exports exist", () => {
		const entries = [
			...advertisedExtensionEntries(),
			...(pkg.pi?.skills ?? []),
			...skillEntries(),
			...(pkg.exports ? Object.values(pkg.exports) : []),
		];
		assert.ok(
			entries.length > 0,
			"expected advertised Pi resources and exports",
		);

		for (const entry of entries) {
			const target = entry.startsWith(packageRoot)
				? entry
				: resolve(packageRoot, entry);
			assert.equal(existsSync(target), true, `${entry} should exist`);
		}
	});

	it("all extension directories expose index.ts", () => {
		const entries = extensionEntries();
		assert.ok(entries.length > 0, "expected at least one bundled extension");
		assert.deepEqual(advertisedExtensionEntries().sort(), entries);
		for (const entry of entries) {
			assert.equal(
				existsSync(resolve(packageRoot, entry)),
				true,
				`${entry} should exist`,
			);
		}
	});

	it("all skill directories contain SKILL.md with minimal frontmatter", () => {
		const entries = skillEntries();
		assert.ok(entries.length > 0, "expected at least one bundled skill");
		for (const entry of entries) {
			const target = resolve(packageRoot, entry);
			assert.equal(existsSync(target), true, `${entry} should exist`);
			const content = readFileSync(target, "utf-8");
			assert.match(content, /^---\n[\s\S]*?\n---/);
			assert.match(content, /^name:\s*\S+/m);
			assert.match(content, /^license:\s*MIT/m);
		}
	});

	it("package dry-run succeeds", () => {
		const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
			cwd: packageRoot,
			encoding: "utf-8",
		});

		assert.equal(result.status, 0, result.stderr || result.stdout);
		assert.match(result.stdout, /@nekwebdev\/warden-flow/);
	});
});
