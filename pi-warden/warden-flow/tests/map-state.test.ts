import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
	classifyMapFreshness,
	formatFreshnessLines,
	loadMapFreshnessContext,
	MAP_STATE_RELATIVE_PATH,
	shortSha,
} from "../src/index.js";

let cwd = "";

beforeEach(() => {
	cwd = mkdtempSync(join(tmpdir(), "warden-map-state-"));
});

afterEach(() => {
	if (cwd) rmSync(cwd, { recursive: true, force: true });
	cwd = "";
});

function git(args: string[], root = cwd): string {
	return execFileSync("git", args, { cwd: root, encoding: "utf-8" }).trim();
}

function initGitRepo(root = cwd): string {
	git(["init"], root);
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

function commitAll(message: string, root = cwd): string {
	git(["add", "."], root);
	git(["commit", "-m", message], root);
	return git(["rev-parse", "HEAD"], root);
}

function writeState(root: string, state: unknown): void {
	const target = join(root, MAP_STATE_RELATIVE_PATH);
	mkdirSync(join(target, ".."), { recursive: true });
	writeFileSync(target, JSON.stringify(state, null, 2), "utf-8");
}

function classify(relativePath = ".warden/map.md") {
	return classifyMapFreshness(relativePath, loadMapFreshnessContext(cwd));
}

describe("map-state freshness", () => {
	it("returns unknown when marker is missing", () => {
		const head = initGitRepo();
		const freshness = classify();

		assert.equal(freshness.verdict, "unknown");
		assert.equal(freshness.mapBasis, null);
		assert.equal(freshness.currentHead, head);
	});

	it("returns unknown when marker contains invalid JSON", () => {
		initGitRepo();
		const target = join(cwd, MAP_STATE_RELATIVE_PATH);
		mkdirSync(join(target, ".."), { recursive: true });
		writeFileSync(target, "{not-json", "utf-8");

		assert.equal(classify().verdict, "unknown");
	});

	it("returns unknown when marker version is unsupported", () => {
		const head = initGitRepo();
		writeState(cwd, {
			version: 2,
			head,
			generatedAt: "2026-06-07T00:00:00.000Z",
			maps: { ".warden/map.md": head },
		});

		assert.equal(classify().verdict, "unknown");
	});

	it("returns fresh when state head, map basis, and current HEAD match", () => {
		const head = initGitRepo();
		writeState(cwd, {
			version: 1,
			head,
			generatedAt: "2026-06-07T00:00:00.000Z",
			maps: { ".warden/map.md": head },
		});

		assert.deepEqual(classify(), {
			verdict: "fresh",
			mapBasis: head,
			currentHead: head,
		});
	});

	it("returns fresh when only map-owned files changed since map basis", () => {
		const mapBasis = initGitRepo();
		mkdirSync(join(cwd, ".warden", "maps", "src"), { recursive: true });
		writeFileSync(join(cwd, ".warden", "map.md"), "# Root map\n", "utf-8");
		writeFileSync(
			join(cwd, ".warden", "maps", "src", "map.md"),
			"# Scoped map\n",
			"utf-8",
		);
		writeState(cwd, {
			version: 1,
			head: mapBasis,
			generatedAt: "2026-06-07T00:00:00.000Z",
			maps: {
				".warden/map.md": mapBasis,
				".warden/maps/src/map.md": mapBasis,
			},
		});
		const currentHead = commitAll("refresh maps");

		assert.deepEqual(classify(), {
			verdict: "fresh",
			mapBasis,
			currentHead,
		});
	});

	it("returns stale when non-map files changed since map basis", () => {
		const oldHead = initGitRepo();
		writeState(cwd, {
			version: 1,
			head: oldHead,
			generatedAt: "2026-06-07T00:00:00.000Z",
			maps: { ".warden/map.md": oldHead },
		});
		const currentHead = secondCommit();

		assert.deepEqual(classify(), {
			verdict: "stale",
			mapBasis: oldHead,
			currentHead,
		});
	});

	it("returns stale when per-map SHA differs from current HEAD after non-map changes", () => {
		const oldHead = initGitRepo();
		const currentHead = secondCommit();
		writeState(cwd, {
			version: 1,
			head: currentHead,
			generatedAt: "2026-06-07T00:00:00.000Z",
			maps: { ".warden/map.md": oldHead },
		});

		assert.deepEqual(classify(), {
			verdict: "stale",
			mapBasis: oldHead,
			currentHead,
		});
	});

	it("returns unknown when map path is not listed", () => {
		const head = initGitRepo();
		writeState(cwd, {
			version: 1,
			head,
			generatedAt: "2026-06-07T00:00:00.000Z",
			maps: { ".warden/maps/src/map.md": head },
		});

		const freshness = classify();

		assert.equal(freshness.verdict, "unknown");
		assert.equal(freshness.mapBasis, null);
		assert.equal(freshness.currentHead, head);
	});

	it("returns unknown when current Git HEAD is unavailable", () => {
		writeState(cwd, {
			version: 1,
			head: "abcdef1234567890abcdef1234567890abcdef12",
			generatedAt: "2026-06-07T00:00:00.000Z",
			maps: { ".warden/map.md": "abcdef1234567890abcdef1234567890abcdef12" },
		});

		assert.deepEqual(classify(), {
			verdict: "unknown",
			mapBasis: null,
			currentHead: null,
		});
	});

	it("returns unknown when map basis is unreachable", () => {
		const head = initGitRepo();
		const unreachable = "abcdef1234567890abcdef1234567890abcdef12";
		writeState(cwd, {
			version: 1,
			head: unreachable,
			generatedAt: "2026-06-07T00:00:00.000Z",
			maps: { ".warden/map.md": unreachable },
		});

		assert.deepEqual(classify(), {
			verdict: "unknown",
			mapBasis: unreachable,
			currentHead: head,
		});
	});

	it("reads marker from Git root .warden/map-state.json", () => {
		const head = initGitRepo();
		const nestedCwd = join(cwd, "pi-warden", "warden-flow");
		mkdirSync(nestedCwd, { recursive: true });
		writeState(cwd, {
			version: 1,
			head,
			generatedAt: "2026-06-07T00:00:00.000Z",
			maps: { ".warden/map.md": head },
		});
		writeState(join(cwd, "pi-warden"), {
			version: 1,
			head: "0000000000000000000000000000000000000000",
			generatedAt: "2026-06-07T00:00:00.000Z",
			maps: { ".warden/map.md": "0000000000000000000000000000000000000000" },
		});

		const freshness = classifyMapFreshness(
			".warden/map.md",
			loadMapFreshnessContext(nestedCwd),
		);

		assert.equal(freshness.verdict, "fresh");
		assert.equal(freshness.mapBasis, head);
	});

	it("formats known SHAs with a 7-character prefix", () => {
		assert.equal(
			shortSha("abcdef1234567890abcdef1234567890abcdef12"),
			"abcdef1",
		);
	});

	it("renders unknown basis and current HEAD as unknown", () => {
		assert.equal(shortSha(null), "unknown");
		assert.equal(
			formatFreshnessLines({
				verdict: "unknown",
				mapBasis: null,
				currentHead: null,
			}),
			[
				"Freshness: unknown",
				"Map basis: unknown",
				"Current HEAD: unknown",
			].join("\n"),
		);
	});
});
