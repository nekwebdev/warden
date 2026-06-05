import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillPath = resolve(packageRoot, "skills/warden-map/SKILL.md");

function skillContent(): string {
	return readFileSync(skillPath, "utf-8");
}

test("warden-map skill file exists", () => {
	assert.equal(existsSync(skillPath), true);
});

test("warden-map skill frontmatter contains identity and license", () => {
	const content = skillContent();
	assert.match(content, /^---\n[\s\S]*?\n---/);
	assert.match(content, /^name:\s*warden-map$/m);
	assert.match(content, /^license:\s*MIT$/m);
});

test("warden-map skill contains required map paths", () => {
	const content = skillContent();
	assert.ok(content.includes(".warden/map.md"));
	assert.ok(content.includes(".warden/maps/<repo-relative-scope>/map.md"));
});

test("warden-map skill contains exact injection markers", () => {
	const content = skillContent();
	assert.ok(content.includes("<!-- warden-map:inject:start -->"));
	assert.ok(content.includes("<!-- warden-map:inject:end -->"));
});

test("warden-map skill contains capsule fields", () => {
	const content = skillContent();
	for (const field of [
		"Purpose",
		"Boundaries",
		"Safe edits",
		"Verification",
		"Sharp edges",
	]) {
		assert.ok(content.includes(field), `${field} should be present`);
	}
});

test("warden-map skill contains lean-contract sections", () => {
	const content = skillContent();
	for (const phrase of [
		"Discovery Budget",
		"Relationship to Durable Docs",
		"Refresh Modes",
		"Full Map Body Budget",
		"Git and Changelog Use",
		"Map Health Check",
	]) {
		assert.ok(content.includes(phrase), `${phrase} should be present`);
	}
});

test("warden-map skill contains explicit lean-contract prohibitions", () => {
	const content = skillContent();
	for (const phrase of [
		"Do not read every file",
		"Do not summarize every file",
		"Do not write changelog entries from this skill",
		"Do not full-remap by default",
		"Do not duplicate commit history",
	]) {
		assert.ok(content.includes(phrase), `${phrase} should be present`);
	}
});

test("warden-map skill keeps anti-bloat language", () => {
	const content = skillContent();
	for (const phrase of [
		"not a task plan",
		"issue tracker",
		"implementation artifact",
	]) {
		assert.ok(content.includes(phrase), `${phrase} should be present`);
	}
});
