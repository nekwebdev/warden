import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import wardenCommit from "../extensions/warden-commit/index.js";
import { validateWardenCommitApplyInput as validateWardenCommitApplyInputFromHelper } from "../src/commit-apply-validation.ts";
import {
	analyzePathRisk,
	applyWardenCommitPlan,
	buildSnapshotHash,
	buildSnapshotWarnings,
	classifyWardenBoundary,
	loadWardenCommitSnapshot,
	normalizeChangedFiles,
	parseCommitPorcelainStatus,
	validateWardenCommitApplyInput,
	type CommitGitExec,
	type CommitGitExecResult,
	type ToolDefinition,
	type WardenCommitFile,
} from "../src/index.js";

function byPath(files: WardenCommitFile[]): Map<string, WardenCommitFile> {
	return new Map(files.map((file) => [file.path, file]));
}

function validApplyInput() {
	return {
		snapshotHash: "a".repeat(64),
		confirmedUserIntent: "Commit",
		commits: [
			{ subject: "feat(warden-flow): test apply", paths: ["src/a.ts"] },
		],
	};
}

function assertInvalidApplyInput(input: unknown, pattern: RegExp): void {
	const result = validateWardenCommitApplyInput(input);
	assert.equal(result.ok, false);
	if (!result.ok) assert.match(result.errors.join("\n"), pattern);
}

function schemaRequiredParameters(tool: ToolDefinition | undefined): unknown {
	const parameters = tool?.parameters;
	if (!parameters || typeof parameters !== "object") return undefined;
	if (!("required" in parameters)) return undefined;
	return (parameters as { required?: unknown }).required;
}

function createStaticSnapshotExec(options: {
	status: string;
	staged?: string;
	unstaged?: string;
	untracked?: string;
	root?: string;
}): CommitGitExec {
	const root = options.root ?? "/repo";
	return async (_command, args) => {
		const key = args.join(" ");
		if (key === "rev-parse --is-inside-work-tree") return { stdout: "true\n" };
		if (key === "rev-parse --show-toplevel") return { stdout: `${root}\n` };
		if (key === "rev-parse --abbrev-ref HEAD") return { stdout: "main\n" };
		if (key === "rev-parse --short HEAD") return { stdout: "abc1234\n" };
		if (key === "status --porcelain=v1") return { stdout: options.status };
		if (key === "diff --name-only --staged") {
			return { stdout: options.staged ?? "" };
		}
		if (key === "diff --name-only") return { stdout: options.unstaged ?? "" };
		if (key === "ls-files --others --exclude-standard") {
			return { stdout: options.untracked ?? "" };
		}
		if (key.startsWith("log --oneline -n ")) return { stdout: "" };
		throw new Error(`unexpected git args: ${key}`);
	};
}

interface SuccessfulApplyState {
	stagedPaths: string[];
	committed: boolean;
}

function successfulApplyProbeResponse(
	key: string,
	path: string,
	state: SuccessfulApplyState,
): CommitGitExecResult | null {
	const status = ` M ${path}`;
	if (key === "rev-parse --is-inside-work-tree") return { stdout: "true\n" };
	if (key === "rev-parse --show-toplevel") return { stdout: "/repo\n" };
	if (key === "rev-parse --abbrev-ref HEAD") return { stdout: "main\n" };
	if (key === "rev-parse --short HEAD") return { stdout: "abc1234\n" };
	if (key === "status --porcelain=v1") {
		return { stdout: state.committed ? "" : status };
	}
	if (key === "diff --name-only --staged") return { stdout: "" };
	if (key === "diff --name-only") {
		return { stdout: state.committed ? "" : `${path}\n` };
	}
	if (key === "ls-files --others --exclude-standard") return { stdout: "" };
	if (key.startsWith("log --oneline -n ")) return { stdout: "" };
	return null;
}

function successfulApplyMutationResponse(
	key: string,
	args: string[],
	state: SuccessfulApplyState,
): CommitGitExecResult | null {
	if (key === "diff --name-only --cached") {
		return { stdout: state.stagedPaths.map((item) => `${item}\n`).join("") };
	}
	if (args[0] === "add" && args[1] === "--") {
		state.stagedPaths = args.slice(2);
		return { stdout: "", code: 0 };
	}
	if (args[0] === "commit") {
		state.committed = true;
		state.stagedPaths = [];
		return { stdout: "[main fedcba9] test commit\n", code: 0 };
	}
	if (key === "rev-parse HEAD") return { stdout: `${"f".repeat(40)}\n` };
	return null;
}

function createSuccessfulApplyExec(path: string): CommitGitExec {
	const state: SuccessfulApplyState = { stagedPaths: [], committed: false };
	return async (_command, args) => {
		const key = args.join(" ");
		const response =
			successfulApplyProbeResponse(key, path, state) ??
			successfulApplyMutationResponse(key, args, state);
		if (response) return response;
		if (key === "status --short")
			return { stdout: state.committed ? "" : ` M ${path}` };
		throw new Error(`unexpected git args: ${key}`);
	};
}

function createSuccessfulStagedRenameApplyExec(path: string): CommitGitExec {
	const state: SuccessfulApplyState = { stagedPaths: [path], committed: false };
	return async (_command, args) => {
		const key = args.join(" ");
		if (key === "rev-parse --is-inside-work-tree") return { stdout: "true\n" };
		if (key === "rev-parse --show-toplevel") return { stdout: "/repo\n" };
		if (key === "rev-parse --abbrev-ref HEAD") return { stdout: "main\n" };
		if (key === "rev-parse --short HEAD") return { stdout: "abc1234\n" };
		if (key === "status --porcelain=v1") {
			return { stdout: state.committed ? "" : `R  src/old.ts -> ${path}` };
		}
		if (key === "diff --name-only --staged") {
			return { stdout: state.committed ? "" : `${path}\n` };
		}
		if (key === "diff --name-only") return { stdout: "" };
		if (key === "ls-files --others --exclude-standard") return { stdout: "" };
		if (key.startsWith("log --oneline -n ")) return { stdout: "" };
		const response = successfulApplyMutationResponse(key, args, state);
		if (response) return response;
		if (key === "status --short") {
			return { stdout: state.committed ? "" : `R  ${path}` };
		}
		throw new Error(`unexpected git args: ${key}`);
	};
}

async function snapshotHash(exec: CommitGitExec): Promise<string> {
	const snapshot = await loadWardenCommitSnapshot(exec, {
		cwd: "/repo",
		includeRecentCommits: 0,
	});
	assert.equal(snapshot.details.ok, true);
	assert.ok(snapshot.details.snapshotHash);
	return snapshot.details.snapshotHash;
}

function hasGit(): boolean {
	return spawnSync("git", ["--version"], { encoding: "utf-8" }).status === 0;
}

function runGit(cwd: string, args: string[]): string {
	const result = spawnSync("git", args, { cwd, encoding: "utf-8" });
	assert.equal(result.status, 0, result.stderr || result.stdout);
	return result.stdout.trim();
}

const realGitExec: CommitGitExec = async (command, args, options) => {
	const result = spawnSync(command, args, {
		cwd: options?.cwd,
		encoding: "utf-8",
		timeout: options?.timeout,
	});
	return {
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? result.error?.message,
		code: result.status,
		killed: Boolean(result.signal),
	};
};

describe("commit status normalization", () => {
	it("parses porcelain rows into stable changed-file details", () => {
		const files = parseCommitPorcelainStatus(
			[
				"M  src/staged.ts",
				" M src/unstaged.ts",
				"MM src/mixed.ts",
				"?? src/new.ts",
				"R  src/old.ts -> src/renamed.ts",
			].join("\n"),
		);
		const filesByPath = byPath(files);

		assert.deepEqual(filesByPath.get("src/staged.ts")?.state, ["staged"]);
		assert.deepEqual(filesByPath.get("src/unstaged.ts")?.state, ["unstaged"]);
		assert.deepEqual(filesByPath.get("src/mixed.ts")?.state, [
			"staged",
			"unstaged",
		]);
		assert.deepEqual(filesByPath.get("src/new.ts")?.state, ["untracked"]);
		assert.deepEqual(filesByPath.get("src/renamed.ts")?.state, ["staged"]);
	});

	it("merges staged, unstaged, and untracked name lists when needed", () => {
		const files = normalizeChangedFiles({
			porcelainStatus: "",
			stagedPaths: ["src/a.ts"],
			unstagedPaths: ["src/a.ts", "src/b.ts"],
			untrackedPaths: ["src/new.ts"],
		});
		const filesByPath = byPath(files);

		assert.deepEqual(filesByPath.get("src/a.ts")?.state, [
			"staged",
			"unstaged",
		]);
		assert.deepEqual(filesByPath.get("src/b.ts")?.state, ["unstaged"]);
		assert.deepEqual(filesByPath.get("src/new.ts")?.state, ["untracked"]);
	});

	it("warns when one file has both staged and unstaged changes", () => {
		const files = parseCommitPorcelainStatus("MM src/mixed.ts");
		const warnings = buildSnapshotWarnings(files);

		assert.equal(warnings[0]?.code, "mixed-staged-unstaged");
		assert.deepEqual(warnings[0]?.paths, ["src/mixed.ts"]);
	});
});

describe("commit path classification", () => {
	it("classifies Warden repository boundaries deterministically", () => {
		assert.equal(classifyWardenBoundary("./warden"), "root");
		assert.equal(classifyWardenBoundary("README.md"), "root");
		assert.equal(classifyWardenBoundary("run-warden/bin/warden"), "run-warden");
		assert.equal(
			classifyWardenBoundary("pi-warden/warden-flow/src/commit.ts"),
			"pi-warden/warden-flow",
		);
		assert.equal(
			classifyWardenBoundary("pi-warden/warden-panel/src/index.ts"),
			"pi-warden/warden-panel",
		);
		assert.equal(
			classifyWardenBoundary("pi-warden/example/src/index.ts"),
			"pi-warden/example",
		);
		assert.equal(classifyWardenBoundary("nix-warden/README.md"), "nix-warden");
		assert.equal(classifyWardenBoundary("dev-warden/README.md"), "dev-warden");
		assert.equal(classifyWardenBoundary("docs/usage.md"), "docs");
		assert.equal(classifyWardenBoundary("src/free.ts"), "unknown");
	});

	it("treats durable map files differently from active work state", () => {
		const mapRisk = analyzePathRisk(".warden/map.md");
		const scopedMapRisk = analyzePathRisk(".warden/maps/pi-warden/map.md");
		const workRisk = analyzePathRisk(".warden/work/slice/packet.md");

		assert.equal(classifyWardenBoundary(".warden/map.md"), "warden-map");
		assert.equal(
			classifyWardenBoundary(".warden/maps/pi-warden/map.md"),
			"warden-map",
		);
		assert.equal(mapRisk.excludedByDefault, false);
		assert.equal(scopedMapRisk.excludedByDefault, false);
		assert.match(mapRisk.notes.join("\n"), /durable Warden orientation/);

		assert.equal(
			classifyWardenBoundary(".warden/work/slice/packet.md"),
			"warden-work",
		);
		assert.equal(workRisk.excludedByDefault, true);
		assert.deepEqual(workRisk.risks, ["warden-work-state"]);
	});

	it("flags secret-looking paths by path only", () => {
		for (const path of [
			".env",
			".env.local",
			"config/private.key",
			"certs/client.pem",
			".ssh/id_rsa",
			"src/token-store.ts",
			"docs/credentials.md",
		]) {
			const risk = analyzePathRisk(path);
			assert.equal(risk.excludedByDefault, true, path);
			assert.equal(risk.risks.includes("secret-looking"), true, path);
		}
	});

	it("flags generated, cache, build, and runtime paths", () => {
		for (const path of [
			"node_modules/pkg/index.js",
			"dist/app.js",
			"build/output.js",
			"coverage/coverage-final.json",
			".cache/tool/state.json",
			".turbo/cache.bin",
			".next/server/app.js",
			".vite/deps/app.js",
			".parcel-cache/data",
			"tmp/file",
			"temp/file",
			".DS_Store",
		]) {
			const risk = analyzePathRisk(path);
			assert.equal(risk.excludedByDefault, true, path);
			assert.equal(
				risk.risks.includes("generated-cache-build-runtime"),
				true,
				path,
			);
		}
	});
});

describe("commit snapshot hashing", () => {
	const base = {
		repoRoot: "/repo",
		cwd: "/repo/pi-warden",
		branch: "main",
		head: "abc1234",
		detached: false,
		statusLines: [" M src/a.ts"],
		files: [
			{
				path: "src/a.ts",
				indexStatus: " ",
				worktreeStatus: "M",
				state: ["unstaged" as const],
			},
		],
	};

	it("is stable for identical metadata", () => {
		assert.equal(buildSnapshotHash(base), buildSnapshotHash({ ...base }));
	});

	it("changes when status metadata changes", () => {
		assert.notEqual(
			buildSnapshotHash(base),
			buildSnapshotHash({
				...base,
				statusLines: [" M src/b.ts"],
				files: [{ ...base.files[0], path: "src/b.ts" }],
			}),
		);
	});
});

describe("commit apply validation", () => {
	it("keeps input validation in a package-local helper", () => {
		const result = validateWardenCommitApplyInputFromHelper(validApplyInput());

		assert.equal(result.ok, true);
		if (result.ok) assert.equal(result.value.confirmedUserIntent, "Commit");
	});

	it("rejects missing snapshot hash and confirmation intent", () => {
		const missingHash = validApplyInput() as Record<string, unknown>;
		delete missingHash.snapshotHash;
		assertInvalidApplyInput(missingHash, /snapshotHash is required/);

		const missingIntent = validApplyInput() as Record<string, unknown>;
		delete missingIntent.confirmedUserIntent;
		assertInvalidApplyInput(missingIntent, /confirmedUserIntent/);

		assertInvalidApplyInput(
			{ ...validApplyInput(), confirmedUserIntent: "commit" },
			/confirmedUserIntent/,
		);
	});

	it("rejects invalid commit message and empty commit shapes", () => {
		assertInvalidApplyInput(
			{ ...validApplyInput(), commits: [] },
			/at least one commit/,
		);
		assertInvalidApplyInput(
			{
				...validApplyInput(),
				commits: [{ subject: "", paths: ["src/a.ts"] }],
			},
			/subject must be non-empty/,
		);
		assertInvalidApplyInput(
			{
				...validApplyInput(),
				commits: [{ subject: "feat: bad\nsubject", paths: ["src/a.ts"] }],
			},
			/subject must not contain newlines/,
		);
		assertInvalidApplyInput(
			{
				...validApplyInput(),
				commits: [{ subject: "feat: no paths", paths: [] }],
			},
			/paths must contain at least one path/,
		);
	});

	it("rejects unsafe path syntax", () => {
		for (const [path, pattern] of [
			["/abs/file.ts", /not absolute/],
			["../escape.ts", /must not contain . or .. segments/],
			["src/*.ts", /glob or pathspec/],
			[":(glob)src/*", /glob or pathspec/],
		] as const) {
			assertInvalidApplyInput(
				{
					...validApplyInput(),
					commits: [{ subject: "feat: bad path", paths: [path] }],
				},
				pattern,
			);
		}
	});

	it("rejects duplicate paths within or across commits", () => {
		assertInvalidApplyInput(
			{
				...validApplyInput(),
				commits: [
					{ subject: "feat: duplicate", paths: ["src/a.ts", "src/a.ts"] },
				],
			},
			/duplicate path src\/a\.ts/,
		);
		assertInvalidApplyInput(
			{
				...validApplyInput(),
				commits: [
					{ subject: "feat: first", paths: ["src/a.ts"] },
					{ subject: "feat: second", paths: ["src/a.ts"] },
				],
			},
			/appears in both commit 1 and commit 2/,
		);
	});
});

describe("commit apply safety", () => {
	it("refuses when current snapshot hash differs", async () => {
		const exec = createStaticSnapshotExec({
			status: " M src/a.ts",
			unstaged: "src/a.ts\n",
		});
		const result = await applyWardenCommitPlan(exec, {
			baseCwd: "/repo",
			input: {
				...validApplyInput(),
				snapshotHash: "bad-hash",
			},
		});

		assert.equal(result.details.ok, false);
		assert.equal(result.details.reason, "snapshot-hash-mismatch");
		assert.match(result.text, /no git state was changed/);
	});

	it("refuses paths absent from the snapshot changed-file set", async () => {
		const exec = createStaticSnapshotExec({
			status: " M src/a.ts",
			unstaged: "src/a.ts\n",
		});
		const hash = await snapshotHash(exec);
		const result = await applyWardenCommitPlan(exec, {
			baseCwd: "/repo",
			input: {
				...validApplyInput(),
				snapshotHash: hash,
				commits: [{ subject: "feat: missing", paths: ["src/missing.ts"] }],
			},
		});

		assert.equal(result.details.ok, false);
		assert.match(result.details.errors?.join("\n") ?? "", /not present/);
	});

	it("refuses risky or excluded paths by default", async () => {
		for (const path of [
			".env.local",
			"dist/file.js",
			".warden/work/foo/packet.md",
		]) {
			const exec = createStaticSnapshotExec({
				status: `?? ${path}`,
				untracked: `${path}\n`,
			});
			const hash = await snapshotHash(exec);
			const result = await applyWardenCommitPlan(exec, {
				baseCwd: "/repo",
				input: {
					...validApplyInput(),
					snapshotHash: hash,
					commits: [{ subject: "feat: risky", paths: [path] }],
				},
			});

			assert.equal(result.details.ok, false, path);
			assert.match(result.details.errors?.join("\n") ?? "", /risky|excluded/);
		}
	});

	it("allows durable map files when otherwise safe", async () => {
		const exec = createSuccessfulApplyExec(".warden/map.md");
		const hash = await snapshotHash(exec);
		const result = await applyWardenCommitPlan(exec, {
			baseCwd: "/repo",
			input: {
				...validApplyInput(),
				snapshotHash: hash,
				commits: [
					{
						subject: "docs(warden-flow): update durable map",
						paths: [".warden/map.md"],
					},
				],
			},
		});

		assert.equal(result.details.ok, true);
		assert.equal(result.details.commits?.length, 1);
		assert.equal(result.details.finalStatus, "");
	});

	it("refuses mixed staged and unstaged paths", async () => {
		const exec = createStaticSnapshotExec({
			status: "MM src/a.ts",
			staged: "src/a.ts\n",
			unstaged: "src/a.ts\n",
		});
		const hash = await snapshotHash(exec);
		const result = await applyWardenCommitPlan(exec, {
			baseCwd: "/repo",
			input: { ...validApplyInput(), snapshotHash: hash },
		});

		assert.equal(result.details.ok, false);
		assert.match(result.details.errors?.join("\n") ?? "", /mixed staged/);
	});

	it("refuses pre-existing staged changes", async () => {
		const exec = createStaticSnapshotExec({
			status: ["M  src/staged.ts", " M src/a.ts"].join("\n"),
			staged: "src/staged.ts\n",
			unstaged: "src/a.ts\n",
		});
		const hash = await snapshotHash(exec);
		const result = await applyWardenCommitPlan(exec, {
			baseCwd: "/repo",
			input: { ...validApplyInput(), snapshotHash: hash },
		});

		assert.equal(result.details.ok, false);
		assert.match(
			result.details.errors?.join("\n") ?? "",
			/pre-existing staged/,
		);
	});

	it("allows a planned staged rename in the first commit", async () => {
		const exec = createSuccessfulStagedRenameApplyExec("src/new.ts");
		const hash = await snapshotHash(exec);
		const result = await applyWardenCommitPlan(exec, {
			baseCwd: "/repo",
			input: {
				...validApplyInput(),
				snapshotHash: hash,
				commits: [{ subject: "chore: rename fixture", paths: ["src/new.ts"] }],
			},
		});

		assert.equal(result.details.ok, true, result.text);
		assert.equal(result.details.commits?.length, 1);
		assert.equal(result.details.finalStatus, "");
	});

	it("refuses a staged rename outside the first planned commit", async () => {
		const exec = createStaticSnapshotExec({
			status: ["R  src/old.ts -> src/new.ts", " M src/a.ts"].join("\n"),
			staged: "src/new.ts\n",
			unstaged: "src/a.ts\n",
		});
		const hash = await snapshotHash(exec);
		const result = await applyWardenCommitPlan(exec, {
			baseCwd: "/repo",
			input: {
				...validApplyInput(),
				snapshotHash: hash,
				commits: [
					{ subject: "feat: first", paths: ["src/a.ts"] },
					{ subject: "chore: rename fixture", paths: ["src/new.ts"] },
				],
			},
		});

		assert.equal(result.details.ok, false);
		assert.match(
			result.details.errors?.join("\n") ?? "",
			/first planned commit/,
		);
	});

	it("creates one local commit in a temporary git repo", {
		skip: hasGit() ? false : "git unavailable",
	}, async () => {
		const repo = mkdtempSync(join(tmpdir(), "warden-commit-apply-"));
		try {
			runGit(repo, ["init"]);
			runGit(repo, ["config", "user.name", "Warden Test"]);
			runGit(repo, ["config", "user.email", "warden-test@example.invalid"]);
			writeFileSync(join(repo, "README.md"), "initial\n", "utf-8");
			runGit(repo, ["add", "--", "README.md"]);
			runGit(repo, ["commit", "-m", "chore: initial"]);

			writeFileSync(join(repo, "README.md"), "initial\nchanged\n", "utf-8");
			const snapshot = await loadWardenCommitSnapshot(realGitExec, {
				cwd: repo,
				includeRecentCommits: 0,
			});
			assert.ok(snapshot.details.snapshotHash);
			const result = await applyWardenCommitPlan(realGitExec, {
				baseCwd: repo,
				input: {
					snapshotHash: snapshot.details.snapshotHash,
					confirmedUserIntent: "Commit",
					commits: [
						{
							subject: "feat(warden-flow): test local apply",
							paths: ["README.md"],
						},
					],
				},
			});

			assert.equal(result.details.ok, true, result.text);
			assert.equal(result.details.commits?.length, 1);
			assert.equal(result.details.finalStatus, "");
			assert.equal(runGit(repo, ["rev-list", "--count", "HEAD"]), "2");
		} finally {
			rmSync(repo, { recursive: true, force: true });
		}
	});

	it("creates one local commit for a staged rename", {
		skip: hasGit() ? false : "git unavailable",
	}, async () => {
		const repo = mkdtempSync(join(tmpdir(), "warden-commit-rename-"));
		try {
			runGit(repo, ["init"]);
			runGit(repo, ["config", "user.name", "Warden Test"]);
			runGit(repo, ["config", "user.email", "warden-test@example.invalid"]);
			writeFileSync(join(repo, "old-name.txt"), "initial\n", "utf-8");
			runGit(repo, ["add", "--", "old-name.txt"]);
			runGit(repo, ["commit", "-m", "chore: initial"]);
			runGit(repo, ["mv", "old-name.txt", "new-name.txt"]);

			const snapshot = await loadWardenCommitSnapshot(realGitExec, {
				cwd: repo,
				includeRecentCommits: 0,
			});
			assert.ok(snapshot.details.snapshotHash);
			assert.equal(snapshot.details.files?.[0]?.path, "new-name.txt");
			assert.equal(snapshot.details.files?.[0]?.indexStatus, "R");

			const result = await applyWardenCommitPlan(realGitExec, {
				baseCwd: repo,
				input: {
					snapshotHash: snapshot.details.snapshotHash,
					confirmedUserIntent: "Commit",
					commits: [
						{
							subject: "chore(warden-flow): test staged rename apply",
							paths: ["new-name.txt"],
						},
					],
				},
			});

			assert.equal(result.details.ok, true, result.text);
			assert.equal(result.details.commits?.length, 1);
			assert.equal(result.details.finalStatus, "");
			assert.match(
				runGit(repo, [
					"diff-tree",
					"--no-commit-id",
					"--name-status",
					"-r",
					"-M",
					"HEAD",
				]),
				/R\d+\s+old-name\.txt\s+new-name\.txt/,
			);
		} finally {
			rmSync(repo, { recursive: true, force: true });
		}
	});
});

describe("commit snapshot tool", () => {
	it("registers snapshot and apply tools", () => {
		const tools: ToolDefinition[] = [];
		const pi = {
			registerTool: (tool: ToolDefinition) => tools.push(tool),
		} as unknown as ExtensionAPI;
		wardenCommit(pi);

		assert.deepEqual(
			tools.map((tool) => tool.name),
			["warden_commit_snapshot", "warden_commit_apply"],
		);
		const applyTool = tools.find((tool) => tool.name === "warden_commit_apply");
		assert.deepEqual(schemaRequiredParameters(applyTool), [
			"snapshotHash",
			"confirmedUserIntent",
			"commits",
		]);
	});

	it("returns a clean not-a-git-repo result", async () => {
		const snapshot = await loadWardenCommitSnapshot(
			async () => ({ stdout: "", code: 128 }),
			{ cwd: "/tmp/not-a-repo", includeRecentCommits: 0 },
		);

		assert.equal(snapshot.details.ok, false);
		assert.equal(snapshot.details.reason, "not-a-git-repo");
		assert.match(snapshot.text, /not-a-git-repo/);
	});

	it("builds compact text and structured details from read-only git probes", async () => {
		const exec: CommitGitExec = async (_command, args) => {
			const key = args.join(" ");
			if (key === "rev-parse --is-inside-work-tree")
				return { stdout: "true\n" };
			if (key === "rev-parse --show-toplevel") return { stdout: "/repo\n" };
			if (key === "rev-parse --abbrev-ref HEAD") return { stdout: "main\n" };
			if (key === "rev-parse --short HEAD") return { stdout: "abc1234\n" };
			if (key === "status --porcelain=v1") {
				return {
					stdout: [
						"MM src/mixed.ts",
						" M .warden/map.md",
						"?? .env.local",
						"?? pi-warden/warden-flow/skills/warden-commit/SKILL.md",
					].join("\n"),
				};
			}
			if (key === "diff --name-only --staged")
				return { stdout: "src/mixed.ts\n" };
			if (key === "diff --name-only") {
				return { stdout: "src/mixed.ts\n.warden/map.md\n" };
			}
			if (key === "ls-files --others --exclude-standard") {
				return {
					stdout:
						".env.local\npi-warden/warden-flow/skills/warden-commit/SKILL.md\n",
				};
			}
			if (key === "log --oneline -n 2") {
				return { stdout: "abc123 feat(warden-flow): old change\n" };
			}
			throw new Error(`unexpected git args: ${key}`);
		};

		const snapshot = await loadWardenCommitSnapshot(exec, {
			cwd: "/repo/pi-warden",
			includeRecentCommits: 2,
		});

		assert.equal(snapshot.details.ok, true);
		assert.equal(snapshot.details.repo?.root, "/repo");
		assert.deepEqual(snapshot.details.dirty, {
			total: 4,
			staged: 1,
			unstaged: 2,
			untracked: 2,
		});
		assert.equal(snapshot.details.snapshotHash?.length, 64);
		assert.deepEqual(snapshot.details.recentCommitSubjects, [
			"feat(warden-flow): old change",
		]);
		assert.equal(
			snapshot.details.warnings?.some(
				(warning) => warning.code === "secret-looking-path",
			),
			true,
		);
		assert.match(snapshot.text, /## Warden Commit Snapshot/);
		assert.match(snapshot.text, /pi-warden\/warden-flow: skills/);
		assert.doesNotMatch(snapshot.text, /diff --git/);
	});
});
