import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	formatGitContext,
	gitContextSignature,
	isGitMutatingCommand,
	loadGitContext,
	parsePorcelainStatus,
	shouldInvalidateGitContext,
	type GitExec,
} from "../src/index.js";

describe("git dirty parsing", () => {
	it("counts staged, unstaged, and untracked porcelain rows", () => {
		const dirty = parsePorcelainStatus(
			[
				"M  staged.ts",
				" M unstaged.ts",
				"?? new.ts",
				"R  old.ts -> renamed.ts",
			].join("\n"),
		);
		assert.equal(dirty.staged, 2);
		assert.equal(dirty.unstaged, 1);
		assert.equal(dirty.untracked, 1);
		assert.equal(dirty.total, 4);
		assert.deepEqual(dirty.paths, [
			"staged.ts",
			"unstaged.ts",
			"new.ts",
			"renamed.ts",
		]);
	});

	it("formats clean and dirty git context", () => {
		assert.equal(
			formatGitContext({
				branch: "main",
				commit: "abc1234",
				dirty: parsePorcelainStatus(""),
			}),
			[
				"## Current Git Context",
				"- Branch: main",
				"- Commit: abc1234",
				"- Dirty: no",
			].join("\n"),
		);

		const dirtyText = formatGitContext({
			branch: "feature",
			commit: "def5678",
			dirty: parsePorcelainStatus(" M src/a.ts\n?? docs/b.md"),
		});
		assert.match(dirtyText, /Dirty: yes — staged 0, unstaged 1, untracked 1/);
		assert.match(dirtyText, /Dirty paths: src\/a.ts, docs\/b.md/);
	});

	it("uses dirty state in the context signature", () => {
		const clean = {
			branch: "main",
			commit: "abc",
			dirty: parsePorcelainStatus(""),
		};
		const dirty = {
			branch: "main",
			commit: "abc",
			dirty: parsePorcelainStatus(" M file.ts"),
		};
		assert.notEqual(gitContextSignature(clean), gitContextSignature(dirty));
	});
});

describe("git context loading", () => {
	it("loads branch, commit, and dirty summary through git exec", async () => {
		const exec: GitExec = async (_command, args) => {
			const key = args.join(" ");
			if (key === "rev-parse --is-inside-work-tree")
				return { stdout: "true\n" };
			if (key === "rev-parse --abbrev-ref HEAD") return { stdout: "HEAD\n" };
			if (key === "rev-parse --short HEAD") return { stdout: "abc1234\n" };
			if (key === "status --porcelain=v1") return { stdout: "?? new.ts\n" };
			throw new Error(`unexpected git args: ${key}`);
		};

		const context = await loadGitContext(exec);
		assert.deepEqual(context, {
			branch: "detached",
			commit: "abc1234",
			dirty: {
				staged: 0,
				unstaged: 0,
				untracked: 1,
				paths: ["new.ts"],
				total: 1,
			},
		});
	});

	it("returns null outside a git work tree", async () => {
		const context = await loadGitContext(async () => ({ stdout: "false\n" }));
		assert.equal(context, null);
	});
});

describe("git invalidation", () => {
	it("recognizes git mutating commands", () => {
		assert.equal(isGitMutatingCommand("git switch feature"), true);
		assert.equal(isGitMutatingCommand("git status --short"), false);
	});

	it("invalidates after file mutation tools and shell commands", () => {
		assert.equal(shouldInvalidateGitContext("edit", { path: "x" }), true);
		assert.equal(shouldInvalidateGitContext("write", { path: "x" }), true);
		assert.equal(
			shouldInvalidateGitContext("bash", { command: "printf x > file" }),
			true,
		);
		assert.equal(shouldInvalidateGitContext("read", { path: "x" }), false);
	});
});
