import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
	buildRootMapInjection,
	collectScopedMapInjections,
	candidateScopeDirs,
	extractInjectableCapsule,
	MAP_STATE_RELATIVE_PATH,
	ROOT_MAP_RELATIVE_PATH,
	SCOPED_CAPSULE_MAX_BYTES,
	shortSha,
} from "../src/index.js";

let cwd = "";

beforeEach(() => {
	cwd = mkdtempSync(join(tmpdir(), "warden-map-"));
});

afterEach(() => {
	if (cwd) rmSync(cwd, { recursive: true, force: true });
	cwd = "";
});

function git(args: string[], root = cwd): string {
	return execFileSync("git", args, { cwd: root, encoding: "utf-8" }).trim();
}

function initGitRepo(root = cwd): void {
	execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
}

function initCommittedGitRepo(root = cwd): string {
	initGitRepo(root);
	git(["config", "user.email", "test@example.com"], root);
	git(["config", "user.name", "Test User"], root);
	writeFileSync(join(root, "README.md"), "# Test\n", "utf-8");
	git(["add", "README.md"], root);
	git(["commit", "-m", "initial"], root);
	return git(["rev-parse", "HEAD"], root);
}

function secondCommit(root = cwd): string {
	writeFileSync(join(root, "README.md"), "# Test\n\nUpdated\n", "utf-8");
	git(["add", "README.md"], root);
	git(["commit", "-m", "second"], root);
	return git(["rev-parse", "HEAD"], root);
}

function writeMap(
	relativePath: string,
	capsule: string,
	body = "## Details\nMore detail",
): void {
	writeMapAt(cwd, relativePath, capsule, body);
}

function writeMapAt(
	base: string,
	relativePath: string,
	capsule: string,
	body = "## Details\nMore detail",
): void {
	const target = join(base, relativePath);
	mkdirSync(join(target, ".."), { recursive: true });
	writeFileSync(
		target,
		[
			"# Test Map",
			"",
			"<!-- warden-map:inject:start -->",
			capsule,
			"<!-- warden-map:inject:end -->",
			"",
			body,
		].join("\n"),
		"utf-8",
	);
}

function writeState(
	root: string,
	head: string,
	maps: Record<string, string>,
): void {
	const target = join(root, MAP_STATE_RELATIVE_PATH);
	mkdirSync(join(target, ".."), { recursive: true });
	writeFileSync(
		target,
		JSON.stringify(
			{
				version: 1,
				head,
				generatedAt: "2026-06-07T00:00:00.000Z",
				maps,
			},
			null,
			2,
		),
		"utf-8",
	);
}

function assertFreshnessBlock(
	message: string,
	freshness: string,
	mapBasis: string,
	currentHead: string,
): void {
	assert.match(
		message,
		new RegExp(
			`Freshness: ${freshness}\\nMap basis: ${mapBasis}\\nCurrent HEAD: ${currentHead}`,
		),
	);
	assert.equal((message.match(/^Freshness: /gm) ?? []).length, 1);
	assert.equal((message.match(/^Map basis: /gm) ?? []).length, 1);
	assert.equal((message.match(/^Current HEAD: /gm) ?? []).length, 1);
	assert.doesNotMatch(message, /Run:\s*\/skill:warden-map/);
}

describe("map capsule extraction", () => {
	it("extracts marked capsule content", () => {
		const result = extractInjectableCapsule(
			"before\n<!-- warden-map:inject:start -->\nhello\n<!-- warden-map:inject:end -->\nafter",
			100,
		);
		assert.equal(result.status, "ok");
		assert.equal(result.content, "hello");
	});

	it("does not fall back to full file when markers are missing", () => {
		const result = extractInjectableCapsule(
			"# Big Useful Map\nNo markers",
			1000,
		);
		assert.equal(result.status, "missing-marker");
		assert.equal(result.content, undefined);
	});

	it("marks oversized capsules instead of truncating silently", () => {
		const result = extractInjectableCapsule(
			`<!-- warden-map:inject:start -->\n${"x".repeat(20)}\n<!-- warden-map:inject:end -->`,
			10,
		);
		assert.equal(result.status, "too-large");
		assert.equal(result.content, undefined);
	});
});

describe("root map selection", () => {
	it("includes fresh map-state status in root capsule", () => {
		const head = initCommittedGitRepo();
		writeMap(
			".warden/map.md",
			"## Agent Quick Context\n\n- Purpose: Fresh root context",
		);
		writeState(cwd, head, { ".warden/map.md": head });

		const injection = buildRootMapInjection(cwd);

		assert.ok(injection);
		assertFreshnessBlock(
			injection.message,
			"fresh",
			shortSha(head),
			shortSha(head),
		);
	});

	it("includes unknown map-state status when marker is missing", () => {
		const head = initCommittedGitRepo();
		writeMap(
			".warden/map.md",
			"## Agent Quick Context\n\n- Purpose: Unknown root context",
		);

		const injection = buildRootMapInjection(cwd);

		assert.ok(injection);
		assertFreshnessBlock(
			injection.message,
			"unknown",
			"unknown",
			shortSha(head),
		);
	});

	it("loads root map from git top-level when cwd is nested", () => {
		initGitRepo();
		const nestedCwd = join(cwd, "pi-warden");
		mkdirSync(nestedCwd, { recursive: true });
		writeMapAt(
			cwd,
			".warden/map.md",
			"## Agent Quick Context\n\n- Purpose: Git root context",
		);
		writeMapAt(
			nestedCwd,
			".warden/map.md",
			"## Agent Quick Context\n\n- Purpose: Nested cwd context",
		);

		const injection = buildRootMapInjection(nestedCwd);

		assert.ok(injection);
		assert.equal(injection.relativePath, ".warden/map.md");
		assert.match(injection.message, /Purpose: Git root context/);
		assert.doesNotMatch(injection.message, /Purpose: Nested cwd context/);
	});
});

describe("scoped map selection", () => {
	it("includes stale map-state status in scoped capsule", () => {
		const oldHead = initCommittedGitRepo();
		writeMap(
			".warden/maps/src/map.md",
			"## Agent Quick Context\n\n- Purpose: Stale source scope",
		);
		writeState(cwd, oldHead, { ".warden/maps/src/map.md": oldHead });
		const currentHead = secondCommit();

		const [injection] = collectScopedMapInjections(cwd, "src/file.ts");

		assert.ok(injection);
		assertFreshnessBlock(
			injection.message,
			"stale",
			shortSha(oldHead),
			shortSha(currentHead),
		);
	});

	it("derives parent-to-child scope candidates for a touched path", () => {
		assert.deepEqual(candidateScopeDirs(cwd, "a/b/c/file.ts"), [
			"a",
			"a/b",
			"a/b/c",
		]);
	});

	it("skips paths inside .warden to avoid recursive map injection", () => {
		assert.deepEqual(candidateScopeDirs(cwd, ROOT_MAP_RELATIVE_PATH), []);
	});

	it("loads scoped maps from git top-level using repo-relative touched paths", () => {
		initGitRepo();
		const nestedCwd = join(cwd, "pi-warden");
		const touchedDir = join(nestedCwd, "warden-flow/src");
		mkdirSync(touchedDir, { recursive: true });
		writeFileSync(join(touchedDir, "effort.ts"), "export {};\n", "utf-8");
		writeMapAt(
			cwd,
			".warden/maps/pi-warden/warden-flow/map.md",
			"## Agent Quick Context\n\n- Purpose: Git root scoped context",
		);
		writeMapAt(
			nestedCwd,
			".warden/maps/warden-flow/map.md",
			"## Agent Quick Context\n\n- Purpose: Nested cwd scoped context",
		);

		const injections = collectScopedMapInjections(
			nestedCwd,
			"warden-flow/src/effort.ts",
		);

		assert.deepEqual(
			injections.map((item) => item.relativePath),
			[".warden/maps/pi-warden/warden-flow/map.md"],
		);
		assert.match(injections[0].message, /Purpose: Git root scoped context/);
		assert.doesNotMatch(
			injections[0].message,
			/Purpose: Nested cwd scoped context/,
		);
	});

	it("collects nearest scoped maps within configured count", () => {
		writeMap(".warden/maps/a/map.md", "## Agent Quick Context\n\n- Purpose: A");
		writeMap(
			".warden/maps/a/b/map.md",
			"## Agent Quick Context\n\n- Purpose: B",
		);
		writeMap(
			".warden/maps/a/b/c/map.md",
			"## Agent Quick Context\n\n- Purpose: C",
		);

		const injections = collectScopedMapInjections(cwd, "a/b/c/file.ts", {
			maxScopedMaps: 2,
		});
		assert.deepEqual(
			injections.map((item) => item.relativePath),
			[".warden/maps/a/b/map.md", ".warden/maps/a/b/c/map.md"],
		);
		assert.match(injections[0].message, /Purpose: B/);
		assert.match(injections[1].message, /Purpose: C/);
	});

	it("injects path-only notice when a scoped capsule exceeds max bytes", () => {
		writeMap(".warden/maps/a/map.md", "x".repeat(SCOPED_CAPSULE_MAX_BYTES + 1));
		const [injection] = collectScopedMapInjections(cwd, "a/file.ts");
		assert.equal(injection.status, "too-large");
		assert.match(
			injection.message,
			/injectable capsule is unavailable \(too-large/,
		);
		assert.doesNotMatch(injection.message, /x{80}/);
	});
});
