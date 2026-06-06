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

const expectedSkillEntries = [
	join("skills", "warden-close", "SKILL.md"),
	join("skills", "warden-commit", "SKILL.md"),
	join("skills", "warden-grill", "SKILL.md"),
	join("skills", "warden-map", "SKILL.md"),
	join("skills", "warden-start", "SKILL.md"),
	join("skills", "warden-tdd", "SKILL.md"),
];

const requiredWardenSkillBodyTags = [
	"argument-handling",
	"scope-gates",
	"safety",
	"context-sources",
	"workflow",
	"review-checks",
	"output-format",
];

function advertisedExtensionEntries(): string[] {
	return (pkg.pi?.extensions ?? []).flatMap((entry) => {
		if (entry === "./extensions/*/index.ts") return extensionEntries();
		return [entry];
	});
}

function skillContent(skillName: string): string {
	return readFileSync(
		resolve(packageRoot, "skills", skillName, "SKILL.md"),
		"utf-8",
	);
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

	it("includes expected Warden Flow skill resources", () => {
		assert.deepEqual(skillEntries(), expectedSkillEntries);
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

	it("warden-grill supports optional manual feedback evidence", () => {
		const content = skillContent("warden-grill");

		assert.match(
			content,
			/^argument-hint:\s*\[work packet\.md path, manual feedback\]$/m,
		);
		assert.match(
			content,
			/remaining argument text as optional manual feedback evidence/,
		);
		assert.match(content, /ask_user_question/);
		assert.match(content, /Grill packet alone/);
		assert.match(content, /Status: Packet solid for TDD/);
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
			assert.match(content, /^description:\s*\S+/m);
			assert.match(content, /^argument-hint:\s*\[[^\n]+\]$/m);
			assert.match(content, /^license:\s*MIT/m);
		}
	});

	it("all Warden Flow skills follow the package body tag template", () => {
		const entries = skillEntries();
		for (const entry of entries) {
			const target = resolve(packageRoot, entry);
			const content = readFileSync(target, "utf-8");
			const tags = [...content.matchAll(/^<([a-z-]+)>$/gm)].map(
				(match) => match[1],
			);
			for (const tag of requiredWardenSkillBodyTags) {
				assert.ok(
					tags.includes(tag),
					`${entry} should include <${tag}> body tag`,
				);
				assert.match(
					content,
					new RegExp(`^<${tag}>\\n[\\s\\S]*?\\n</${tag}>`, "m"),
					`${entry} should close <${tag}> body tag`,
				);
			}
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
