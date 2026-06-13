import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");

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
	join("skills", "warden-create-skill", "SKILL.md"),
	join("skills", "warden-docs", "SKILL.md"),
	join("skills", "warden-grill", "SKILL.md"),
	join("skills", "warden-map", "SKILL.md"),
	join("skills", "warden-prompt", "SKILL.md"),
	join("skills", "warden-start", "SKILL.md"),
	join("skills", "warden-tdd", "SKILL.md"),
];

const packetTrackerSkillNames = [
	"warden-start",
	"warden-grill",
	"warden-tdd",
	"warden-close",
];

const requiredHeadingSkillSections = [
	"When to use",
	"Outcome",
	"Execution tracking",
	"Procedure",
	"Output format",
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

function agentTemplateContent(): string {
	return readFileSync(
		resolve(repoRoot, "run-warden", "templates", "AGENTS-template.md"),
		"utf-8",
	);
}

function bodyTagNames(content: string): string[] {
	return [...content.matchAll(/^<([a-z-]+)>$/gm)].map(
		(match) => match[1] ?? "",
	);
}

function headingNames(content: string): string[] {
	return [...content.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1] ?? "");
}

function hasHeadingSkillShape(content: string): boolean {
	const headings = headingNames(content);
	return requiredHeadingSkillSections.every((section) =>
		headings.includes(section),
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
		assert.match(content, /Verdict: Packet solid for TDD/);
	});

	it("warden-start requests packet-ready fine-tuning through active workflow", () => {
		const content = skillContent("warden-start");

		assert.match(content, /late fine-tuning checkpoint/i);
		assert.match(content, /at least two fine-tuning questions/i);
		assert.match(
			content,
			/Once the packet appears ready, request at least two fine-tuning questions through the active user-input workflow/,
		);
		assert.match(content, /answers incorporated/i);
		assert.match(content, /git status --porcelain/);
		assert.match(content, /commit, stash, or otherwise clean/);
	});

	it("centralizes user-question tool policy in the agent template", () => {
		const template = agentTemplateContent();
		const forbiddenSkillQuestionTerms =
			/ask_user_question|questionnaire|structured choice UI|structured confirmation/i;

		assert.match(template, /ask_user_question/);
		assert.match(template, /stricter exact-confirmation workflows override/i);

		for (const entry of skillEntries()) {
			const content = readFileSync(resolve(packageRoot, entry), "utf-8");
			assert.doesNotMatch(
				content,
				forbiddenSkillQuestionTerms,
				`${entry} should not name question-tool or UI-specific policy`,
			);
		}
	});

	it("warden-close validates existing handoffs or creates missing ones", () => {
		const content = skillContent("warden-close");

		assert.match(
			content,
			/^argument-hint:\s*\[packet\.md or handoff\.md path\]$/m,
		);
		assert.match(content, /Close an accepted Warden work packet/);
		assert.match(content, /If `handoff\.md` exists, validate it/);
		assert.match(content, /If `handoff\.md` is missing.*create it/s);
		assert.match(content, /Status: Closed \| Not ready \| Blocked/);
	});

	it("warden-close emits deterministic map-impact tracker fields after Summary", () => {
		const content = skillContent("warden-close");
		const trackerFieldBlock =
			/Summary: Put a one-line summary\nMaps: none \| scoped-refresh \| root-refresh\nMaps scope: none \| <repo-relative-scope> \| root/g;

		assert.equal([...content.matchAll(trackerFieldBlock)].length, 2);
	});

	it("packet tracker skills expose exact final status contract", () => {
		for (const skillName of packetTrackerSkillNames) {
			const content = skillContent(skillName);

			assert.match(
				content,
				/Tracker status: success \| failure \| aborted/,
				`${skillName} should expose tracker status field`,
			);
			assert.match(
				content,
				/Packet name: <slug>/,
				`${skillName} should expose tracker packetName field`,
			);
			assert.match(
				content,
				/Packet path: \.warden\/work\/<slug>\/packet\.md/,
				`${skillName} should expose tracker packetPath field`,
			);
			assert.match(
				content,
				/Summary: Put a one-line summary/,
				`${skillName} should expose tracker lastSummary field`,
			);
			assert.doesNotMatch(
				content,
				/nextStep:/,
				`${skillName} should keep tracker nextStep extension-owned`,
			);
		}
	});

	it("warden-flow skills use repo-root placeholder consistently", () => {
		for (const entry of skillEntries()) {
			const content = readFileSync(resolve(packageRoot, entry), "utf-8");
			assert.doesNotMatch(
				content,
				/<git-root>/,
				`${entry} should use <repo-root>`,
			);
		}
	});

	it("warden-docs aligns stale README and AGENTS docs only", () => {
		const content = skillContent("warden-docs");

		assert.match(content, /^name:\s*warden-docs$/m);
		assert.match(content, /Git repository as the scan scope/);
		assert.match(content, /walk.*`README\.md`.*`AGENTS\.md`/s);
		assert.match(
			content,
			/code, tests, package manifests, maps, and repo evidence/,
		);
		assert.match(content, /default edits.*`README\.md` and `AGENTS\.md` only/s);
		assert.match(content, /Do not edit source code/);
		assert.match(content, /Do not edit.*\.warden\/map-state\.json/s);
		assert.match(content, /Do not edit maps/);
		assert.match(content, /Do not edit changelogs/);
		assert.match(content, /Do not edit work packets/);
		assert.match(content, /Do not edit generated files/);
		assert.match(content, /Do not edit secrets/);
		assert.match(content, /Do not edit runner files/);
		assert.match(content, /Do not create PRDs/);
		assert.match(content, /Inspect `git status --short` before doc edits/);
		assert.match(content, /avoid editing already-dirty target docs/);
		assert.match(content, /map freshness is stale or unknown.*stop/s);
		assert.match(content, /recommend.*\/skill:warden-map/s);
		assert.match(content, /must not auto-run `\/skill:warden-map`/);
		assert.match(content, /support extension.*README\/AGENTS discovery/s);
	});

	it("warden-create-skill creates global or project skills from the bundled template", () => {
		const content = skillContent("warden-create-skill");

		assert.match(content, /^name:\s*warden-create-skill$/m);
		assert.match(content, /^argument-hint:\s*\[skill name or intent\]$/m);
		assert.match(content, /\$PI_CODING_AGENT_DIR\/\.agents\/skills\//);
		assert.match(content, /<repo-root>\/\.agents\/skills\//);
		assert.match(content, /templates\/SKILL-template\.md/);
		assert.match(content, /ask the user to choose exactly one scope/i);
		assert.match(content, /### Step 1: Choose scope/);
		assert.match(content, /### Step 2: Read template/);
		assert.match(content, /### Step 3: Collect inputs and grill skill shape/);
		assert.match(content, /Grill the user one unresolved decision at a time/);
		assert.match(content, /For each question, provide your recommended answer/);
		assert.match(content, /Never silently overwrite an existing/);
		assert.match(content, /<skill-name>\/SKILL\.md/);
	});

	it("warden-prompt workshops rough intent without executing workflows", () => {
		const content = skillContent("warden-prompt");

		assert.match(content, /^name:\s*warden-prompt$/m);
		assert.match(content, /^argument-hint:\s*\[rough work idea\]$/m);
		assert.match(content, /^disable-model-invocation:\s*true$/m);
		assert.match(content, /must not implement code/i);
		assert.match(content, /must not edit project files/i);
		assert.match(content, /must not run workflows automatically/i);
		assert.match(content, /Explore, Lock, and Start-prompt modes/);
		assert.match(content, /Current goal/);
		assert.match(content, /Locked decisions/);
		assert.match(content, /Open questions/);
		assert.match(content, /Rejected options/);
		assert.match(content, /Acceptance\/checklist notes/);
		assert.match(content, /decision compression/i);
		assert.match(content, /confirm.*concept.*locked/is);
		assert.match(content, /confirm.*ready for `warden-start`/is);
		assert.match(
			content,
			/must not invoke, hand off to, or auto-run `warden-start`/,
		);
		assert.match(content, /final comprehensive `warden-start` prompt/);
		assert.match(
			content,
			/inspect relevant existing files\/docs before implementation/,
		);
		assert.match(content, /must not carry unresolved open questions/);
		assert.doesNotMatch(content, /Tracker status:/);
		assert.equal(packetTrackerSkillNames.includes("warden-prompt"), false);
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

	it("all Warden Flow skills use heading-based workflow shape", () => {
		const entries = skillEntries();
		for (const entry of entries) {
			const target = resolve(packageRoot, entry);
			const content = readFileSync(target, "utf-8");
			assert.deepEqual(
				bodyTagNames(content),
				[],
				`${entry} should not use legacy body tags`,
			);
			assert.ok(
				hasHeadingSkillShape(content),
				`${entry} should use the heading-based skill shape`,
			);
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
