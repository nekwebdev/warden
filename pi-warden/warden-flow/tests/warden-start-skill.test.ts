import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillPath = resolve(packageRoot, "skills/warden-start/SKILL.md");

function skillContent(): string {
	return readFileSync(skillPath, "utf-8");
}

test("warden-start skill file exists", () => {
	assert.equal(existsSync(skillPath), true);
});

test("warden-start skill frontmatter contains identity and license", () => {
	const content = skillContent();
	assert.match(content, /^---\n[\s\S]*?\n---/);
	assert.match(content, /^name:\s*warden-start$/m);
	assert.match(content, /^license:\s*MIT$/m);
});

test("warden-start skill contains work packet write contract", () => {
	const content = skillContent();
	for (const phrase of [
		"create or update",
		".warden/work/<slug>/packet.md",
		"file-editing tools",
		"preview",
		"dry run",
	]) {
		assert.ok(content.includes(phrase), `${phrase} should be present`);
	}
});

test("warden-start skill contains all packet sections", () => {
	const content = skillContent();
	for (const section of [
		"Intent",
		"Non-goals",
		"Current slice",
		"Acceptance behavior",
		"Work area",
		"Likely files",
		"Files not to touch",
		"Test strategy",
		"Manual verification",
		"Boundary notes",
		"Map freshness notes",
		"External research notes",
		"Decisions",
		"Next safe step",
	]) {
		assert.ok(content.includes(section), `${section} should be present`);
	}
});

test("warden-start skill contains external research rules", () => {
	const content = skillContent();
	for (const phrase of [
		"External research",
		"local repo evidence",
		"web research",
		"facts outside the repository",
		"likely to have changed",
		"official or primary sources",
		"Do not browse",
		"source",
		"decision impact",
		"External research notes",
	]) {
		assert.ok(content.includes(phrase), `${phrase} should be present`);
	}
});

test("warden-start skill tightens boundary notes", () => {
	const content = skillContent();
	for (const phrase of [
		"primary agent",
		"expected cwd",
		"owned work area",
		"handoffs",
		"package locality",
		"rejected cross-boundary work",
	]) {
		assert.ok(content.includes(phrase), `${phrase} should be present`);
	}
});

test("warden-start skill contains map freshness rules", () => {
	const content = skillContent();
	for (const phrase of [
		"maps are orientation only",
		"map information may be stale",
		"Only /skill:warden-map updates map files",
	]) {
		assert.ok(content.includes(phrase), `${phrase} should be present`);
	}
});

test("warden-start skill rejects planning bloat", () => {
	const content = skillContent();
	for (const phrase of [
		"Do not create PRDs",
		"Do not create issue trackers",
		"Do not create lifecycle state machines",
		"Do not create implementation diaries",
	]) {
		assert.ok(content.includes(phrase), `${phrase} should be present`);
	}
});

test("warden-start skill keeps lean-slice behavior", () => {
	const content = skillContent();
	for (const phrase of [
		"Prefer one small vertical slice",
		"State assumptions instead of blocking unless implementation safety is truly blocked",
		"# Warden Start Result",
	]) {
		assert.ok(content.includes(phrase), `${phrase} should be present`);
	}
});
