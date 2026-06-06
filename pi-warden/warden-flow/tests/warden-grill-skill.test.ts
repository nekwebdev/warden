import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillPath = resolve(packageRoot, "skills/warden-grill/SKILL.md");

function skillContent(): string {
	return readFileSync(skillPath, "utf-8");
}

test("warden-grill skill file exists", () => {
	assert.equal(existsSync(skillPath), true);
});

test("warden-grill skill frontmatter contains identity and license", () => {
	const content = skillContent();
	assert.match(content, /^---\n[\s\S]*?\n---/);
	assert.match(content, /^name:\s*warden-grill$/m);
	assert.match(content, /^license:\s*MIT$/m);
});

test("warden-grill skill contains verdicts and packet target", () => {
	const content = skillContent();
	for (const phrase of [
		"Go",
		"Adjust",
		"Stop",
		".warden/work/<slug>/packet.md",
		"# Warden Grill",
	]) {
		assert.ok(content.includes(phrase), `${phrase} should be present`);
	}
});

test("warden-grill skill contains required output sections", () => {
	const content = skillContent();
	for (const section of [
		"What holds up",
		"What breaks",
		"Boundary check",
		"Slice check",
		"Acceptance check",
		"Verification check",
		"External research check",
		"Map check",
		"Durable-docs check",
		"Tightened next safe step",
	]) {
		assert.ok(content.includes(section), `${section} should be present`);
	}
});

test("warden-grill skill redirects rough intent to warden-start", () => {
	const content = skillContent();
	for (const phrase of [
		"Do not secretly become `warden-start`",
		"recommend `/skill:warden-start`",
	]) {
		assert.ok(content.includes(phrase), `${phrase} should be present`);
	}
});

test("warden-grill skill contains map handling rules", () => {
	const content = skillContent();
	for (const phrase of [
		"maps are orientation only",
		"map information may be stale",
		"Only `/skill:warden-map` updates map files",
	]) {
		assert.ok(content.includes(phrase), `${phrase} should be present`);
	}
});

test("warden-grill skill contains external research rules", () => {
	const content = skillContent();
	for (const phrase of [
		"Repo facts come from local repo evidence",
		"External/current facts use web research",
		"official or primary sources",
		"Do not browse to rediscover local repo facts",
	]) {
		assert.ok(content.includes(phrase), `${phrase} should be present`);
	}
});

test("warden-grill skill rejects bloat and subagents", () => {
	const content = skillContent();
	for (const phrase of [
		"Reject PRDs, issue trackers, implementation diaries, and lifecycle state machines",
		"Do not add subagents",
	]) {
		assert.ok(content.includes(phrase), `${phrase} should be present`);
	}
});
