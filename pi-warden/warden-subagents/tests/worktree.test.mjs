import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { describe, it } from "node:test";
import {
	AgentManager,
	createAgentToolDefinition,
	runForegroundAgent,
} from "../index.ts";

const generalAgent = {
	type: "general-purpose",
	description: "General helper",
	prompt: "General prompt.",
	enabled: true,
	tools: { kind: "all" },
	extensions: [],
	skills: [],
	disallowedTools: [],
	memory: false,
	isolation: "parent-twin",
	inheritContext: true,
	promptMode: "append",
	runInBackground: false,
	source: "default",
};

function makeRegistry() {
	return { agents: [generalAgent], diagnostics: [] };
}

describe("worktree isolation", () => {
	it("keeps non-worktree isolation values as compatibility no-ops", async () => {
		const root = resolve(
			tmpdir(),
			`warden-subagents-non-worktree-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
		);
		mkdirSync(root, { recursive: true });
		try {
			let childCwd;
			const result = await runForegroundAgent({
				params: {
					prompt: "No-op isolation",
					description: "compat no-op",
					isolation: "WORKTREE",
				},
				ctx: { cwd: root },
				registry: makeRegistry(),
				createChildSession: async (input) => {
					childCwd = input.cwd;
					return fakeChildSession("normal cwd");
				},
			});

			assert.equal(result.details.status, "completed");
			assert.equal(childCwd, root);
			assert.equal(result.details.worktree, undefined);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("rejects dirty parent checkouts but allows ignored files without starting the child", async () => {
		const repo = makeGitRepo();
		try {
			writeFileSync(join(repo.root, ".gitignore"), "ignored.log\n");
			git(repo.root, "add", ".gitignore");
			git(repo.root, "commit", "-m", "ignore files");
			writeFileSync(join(repo.root, "ignored.log"), "ignored\n");
			let created = 0;
			const cleanWithIgnored = await runForegroundAgent({
				params: {
					prompt: "Do work",
					description: "ignored allowed",
					isolation: "worktree",
				},
				ctx: { cwd: repo.root },
				registry: makeRegistry(),
				runIdFactory: () => "dirty-ignored",
				createChildSession: async () => {
					created += 1;
					return fakeChildSession("done");
				},
			});

			assert.equal(cleanWithIgnored.details.status, "completed");
			assert.equal(created, 1);

			writeFileSync(join(repo.root, "untracked.txt"), "untracked\n");
			const dirtyUntracked = await runForegroundAgent({
				params: {
					prompt: "Do work",
					description: "dirty untracked",
					isolation: "worktree",
				},
				ctx: { cwd: repo.root },
				registry: makeRegistry(),
				runIdFactory: () => "dirty-untracked",
				createChildSession: async () => {
					created += 1;
					throw new Error("should not start child");
				},
			});

			assert.equal(dirtyUntracked.details.status, "error");
			assert.match(dirtyUntracked.content[0].text, /uncommitted or untracked/);
			assert.equal(created, 1);
		} finally {
			repo.cleanup();
		}
	});

	it("runs children from matching worktree cwd, injects only system-prompt notice, and cleans unchanged worktrees", async () => {
		const repo = makeGitRepo();
		try {
			mkdirSync(join(repo.root, "pkg"));
			writeFileSync(join(repo.root, "pkg", "file.txt"), "pkg\n");
			git(repo.root, "add", ".");
			git(repo.root, "commit", "-m", "add pkg");
			const received = {};
			const result = await runForegroundAgent({
				params: {
					prompt: "Delegated task stays exact.",
					description: "no changes",
					isolation: "worktree",
				},
				ctx: { cwd: join(repo.root, "pkg") },
				registry: makeRegistry(),
				runIdFactory: () => "no-change",
				createChildSession: async (input) => {
					received.cwd = input.cwd;
					received.systemPrompt = input.systemPrompt;
					return fakeChildSession("no changes", [], undefined, input);
				},
			});

			assert.equal(result.details.status, "completed");
			assert.equal(basename(received.cwd), "pkg");
			assert.notEqual(received.cwd, join(repo.root, "pkg"));
			assert.match(received.systemPrompt, /## Worktree Isolation/);
			assert.match(received.systemPrompt, /committed files only/);
			assert.deepEqual(result.details.worktree, {
				enabled: true,
				path: result.details.worktree.path,
				preserved: false,
			});
			assert.equal(existsSync(result.details.worktree.path), false);
			assert.equal(
				readdirSync(tmpdir()).some((name) => name.includes("no-change")),
				false,
			);
		} finally {
			repo.cleanup();
		}
	});

	it("stages all child changes, commits with hook bypass, creates collision-safe branch, and reports merge guidance", async () => {
		const repo = makeGitRepo();
		try {
			git(repo.root, "branch", "pi-agent-change-run");
			writeFileSync(
				join(repo.root, ".git", "hooks", "pre-commit"),
				"#!/bin/sh\nexit 1\n",
				{ mode: 0o755 },
			);
			const result = await runForegroundAgent({
				params: {
					prompt: "Change files",
					description: "change run",
					isolation: "worktree",
				},
				ctx: { cwd: repo.root },
				registry: makeRegistry(),
				runIdFactory: () => "change-run",
				createChildSession: async (input) => {
					writeFileSync(join(input.cwd, "tracked.txt"), "modified\n");
					writeFileSync(join(input.cwd, "new.txt"), "new\n");
					rmSync(join(input.cwd, "delete.txt"));
					return fakeChildSession("changed");
				},
			});

			assert.equal(result.details.status, "completed");
			assert.equal(result.details.worktree.branch, "pi-agent-change-run-2");
			assert.equal(
				result.details.worktree.mergeCommand,
				"git merge pi-agent-change-run-2",
			);
			assert.equal(existsSync(result.details.worktree.path), false);
			assert.match(result.content[0].text, /git merge pi-agent-change-run-2/);
			const commitSubject = gitOut(
				repo.root,
				"log",
				"-1",
				"--pretty=%s",
				"pi-agent-change-run-2",
			);
			assert.equal(commitSubject, "Subagent change-run: change run");
			assert.equal(
				gitOut(
					repo.root,
					"show",
					"--name-status",
					"--pretty=",
					"pi-agent-change-run-2",
				).trim(),
				["D\tdelete.txt", "A\tnew.txt", "M\ttracked.txt"].join("\n"),
			);
			assert.equal(
				readFileSync(join(repo.root, "tracked.txt"), "utf-8"),
				"initial\n",
			);
		} finally {
			repo.cleanup();
		}
	});

	it("preserves changed worktrees for child errors and never auto-commits them", async () => {
		const repo = makeGitRepo();
		try {
			const result = await runForegroundAgent({
				params: {
					prompt: "Fail after write",
					description: "error recovery",
					isolation: "worktree",
				},
				ctx: { cwd: repo.root },
				registry: makeRegistry(),
				runIdFactory: () => "error-run",
				createChildSession: async (input) => ({
					getAllTools: () => [],
					setActiveToolsByName: () => {},
					async prompt() {
						writeFileSync(join(input.cwd, "failed.txt"), "recover me\n");
						throw new Error("child exploded");
					},
					dispose() {},
				}),
			});

			assert.equal(result.details.status, "error");
			assert.match(result.content[0].text, /child exploded/);
			assert.equal(result.details.worktree.preserved, true);
			assert.equal(
				existsSync(join(result.details.worktree.path, "failed.txt")),
				true,
			);
			assert.equal(
				gitOut(repo.root, "branch", "--list", "pi-agent-error-run"),
				"",
			);
		} finally {
			repo.cleanup();
		}
	});

	it("defers background worktree setup until queued run starts", async () => {
		const repo = makeGitRepo();
		try {
			writeFileSync(join(repo.root, "dirty.txt"), "dirty\n");
			let created = 0;
			const manager = new AgentManager({
				maxConcurrency: 1,
				idFactory: (() => {
					let next = 0;
					return () => `agent-${++next}`;
				})(),
			});
			const gate = deferred();
			const tool = createAgentToolDefinition({
				manager,
				loadRegistry: () => makeRegistry(),
				createChildSession: async () => {
					created += 1;
					if (created === 1)
						return fakeChildSession("blocked", [], gate.promise);
					throw new Error("dirty child should not start");
				},
			});

			const first = await tool.execute(
				"first",
				{
					prompt: "block",
					description: "blocker",
					run_in_background: true,
				},
				undefined,
				undefined,
				{ cwd: repo.root },
			);
			const second = await tool.execute(
				"second",
				{
					prompt: "dirty",
					description: "dirty queued",
					run_in_background: true,
					isolation: "worktree",
				},
				undefined,
				undefined,
				{ cwd: repo.root },
			);

			assert.equal(first.details.status, "running");
			assert.equal(second.details.status, "queued");
			assert.ok(created <= 1);
			await tick();
			assert.equal(created, 1);
			gate.resolve();
			await tick();
			await tick();
			const dirty = await manager.waitForResult({
				agent_id: second.details.agentId,
				wait: true,
			});
			assert.equal(dirty.details.status, "error");
			assert.match(dirty.content[0].text, /uncommitted or untracked/);
			assert.equal(created, 1);
		} finally {
			repo.cleanup();
		}
	});
});

function fakeChildSession(
	finalText,
	calls = [],
	promptGate = undefined,
	input = undefined,
) {
	const expectedPrompt = input ? "Delegated task stays exact." : undefined;
	return {
		getAllTools() {
			return [
				{ name: "read", sourceInfo: { source: "builtin" } },
				{ name: "bash", sourceInfo: { source: "builtin" } },
				{ name: "edit", sourceInfo: { source: "builtin" } },
				{ name: "write", sourceInfo: { source: "builtin" } },
			];
		},
		setActiveToolsByName(names) {
			calls.push(["setActiveToolsByName", names]);
		},
		async prompt(text) {
			calls.push(["prompt", text]);
			if (expectedPrompt) assert.equal(text, expectedPrompt);
			await promptGate;
		},
		getLastAssistantText() {
			return finalText;
		},
		dispose() {},
		input,
	};
}

function makeGitRepo() {
	const root = resolve(
		tmpdir(),
		`warden-subagents-worktree-test-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
	);
	mkdirSync(root, { recursive: true });
	git(root, "init");
	git(root, "config", "user.name", "Warden Test");
	git(root, "config", "user.email", "warden@example.invalid");
	writeFileSync(join(root, "tracked.txt"), "initial\n");
	writeFileSync(join(root, "delete.txt"), "delete\n");
	git(root, "add", ".");
	git(root, "commit", "-m", "initial commit");
	return {
		root,
		cleanup() {
			rmSync(root, { recursive: true, force: true });
		},
	};
}

function git(cwd, ...args) {
	const result = spawnSync("git", args, { cwd, encoding: "utf-8" });
	assert.equal(result.status, 0, result.stderr || result.stdout);
	return result;
}

function gitOut(cwd, ...args) {
	return git(cwd, ...args).stdout.trim();
}

function deferred() {
	let resolve;
	let reject;
	const promise = new Promise((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

async function tick() {
	await new Promise((resolve) => setImmediate(resolve));
}
