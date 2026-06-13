import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	closeWardenBranch,
	registerWardenBranchClose,
	validateBranchCloseArgs,
	type BranchCloseArgs,
	type BranchCloseCommandRunner,
	type BranchCloseCommitAdapter,
	type BranchCloseSnapshotWarning,
} from "../src/index.js";

function baseArgs(overrides: Partial<BranchCloseArgs> = {}): BranchCloseArgs {
	return {
		featureBranch: "feature/one",
		defaultBranch: "main",
		maps: "none",
		mapsScope: "none",
		packetPath: ".warden/work/one/packet.md",
		packetName: "one",
		cwd: "/repo",
		branchCloseDestructiveConsent: true,
		branchCloseAutoCommitConsent: true,
		...overrides,
	};
}

function createRunner(
	options: {
		currentBranch?: string;
		originHead?: string;
		worktrees?: Array<{ path: string; branch: string }>;
		fail?: Record<string, string>;
	} = {},
): BranchCloseCommandRunner & {
	commands: Array<{ cwd: string; args: string[] }>;
} {
	const commands: Array<{ cwd: string; args: string[] }> = [];
	const currentBranch = options.currentBranch ?? "feature/one";
	const worktrees = options.worktrees ?? [
		{ path: "/repo", branch: currentBranch },
	];
	return {
		commands,
		async git(args, cwd) {
			commands.push({ cwd, args });
			const key = args.join(" ");
			if (options.fail?.[key]) {
				return { code: 1, stdout: "", stderr: options.fail[key] };
			}
			if (key === "rev-parse --abbrev-ref HEAD") {
				return { code: 0, stdout: `${currentBranch}\n` };
			}
			if (key === "symbolic-ref --quiet --short refs/remotes/origin/HEAD") {
				return options.originHead
					? { code: 0, stdout: `${options.originHead}\n` }
					: { code: 1, stdout: "", stderr: "" };
			}
			if (key === "worktree list --porcelain") {
				return {
					code: 0,
					stdout: worktrees
						.map(
							(item) =>
								`worktree ${item.path}\nHEAD abc123\nbranch refs/heads/${item.branch}\n`,
						)
						.join("\n"),
				};
			}
			return { code: 0, stdout: "" };
		},
	};
}

function createCommitAdapter(
	options: {
		dirty?: boolean;
		warnings?: BranchCloseSnapshotWarning[];
		buckets?: Array<{ label: string; paths: string[]; reason: string }>;
		files?: Array<{
			path: string;
			state?: string[];
			risks?: string[];
			excludedByDefault?: boolean;
		}>;
		applyOk?: boolean;
	} = {},
): BranchCloseCommitAdapter & { calls: string[] } {
	const calls: string[] = [];
	const dirty = options.dirty ?? false;
	const paths = options.files?.map((file) => file.path) ?? [
		"pi-warden/warden-flow/src/branch-close.ts",
	];
	return {
		calls,
		async snapshot(cwd) {
			calls.push(`snapshot:${cwd}`);
			return {
				ok: true,
				snapshotHash: "snap1",
				dirty: { total: dirty ? paths.length : 0 },
				warnings: options.warnings ?? [],
				files: dirty
					? paths.map((path) => ({
							path,
							state: ["unstaged"],
							risks: [],
							excludedByDefault: false,
							...(options.files?.find((file) => file.path === path) ?? {}),
						}))
					: [],
				suggestedBuckets: dirty
					? (options.buckets ?? [
							{ label: "warden-flow", paths, reason: "single bucket" },
						])
					: [],
			};
		},
		async apply(cwd, plan) {
			calls.push(
				`apply:${cwd}:${plan.commits.map((commit) => commit.paths.join(",")).join("|")}`,
			);
			return { ok: options.applyOk ?? true, summary: "committed" };
		},
	};
}

describe("warden_branch_close core", () => {
	it("rejects unsafe branch names and invalid map pairs before command planning", async () => {
		const runner = createRunner();
		const invalidBranch = validateBranchCloseArgs(
			baseArgs({ featureBranch: "feature;rm" }),
		);
		assert.equal(invalidBranch.ok, false);
		assert.match(invalidBranch.errors.join("\n"), /featureBranch/);

		const invalidMap = await closeWardenBranch(
			baseArgs({ maps: "root-refresh", mapsScope: "pi-warden" }),
			{ runner, commit: createCommitAdapter() },
		);

		assert.equal(invalidMap.status, "blocked");
		assert.equal(runner.commands.length, 0);
		assert.match(invalidMap.summary, /invalid map/i);
	});

	it("blocks every mutation without exact destructive consent", async () => {
		const runner = createRunner();
		const result = await closeWardenBranch(
			baseArgs({ branchCloseDestructiveConsent: false }),
			{ runner, commit: createCommitAdapter({ dirty: true }) },
		);

		assert.equal(result.status, "blocked");
		assert.equal(runner.commands.length, 0);
		assert.match(result.nextSafeCommand ?? "", /rerun \/skill:warden-close/i);
		assert.match(result.summary, /destructive consent/i);
	});

	it("blocks dirty work without exact auto-commit consent but allows clean no-op inspection", async () => {
		const dirty = await closeWardenBranch(
			baseArgs({ branchCloseAutoCommitConsent: false }),
			{ runner: createRunner(), commit: createCommitAdapter({ dirty: true }) },
		);
		assert.equal(dirty.status, "blocked");
		assert.deepEqual(dirty.commandsRun, ["warden_commit_snapshot"]);
		assert.match(
			dirty.nextSafeCommand ?? "",
			/\/skill:warden-commit --auto one/,
		);

		const cleanRunner = createRunner();
		const clean = await closeWardenBranch(
			baseArgs({ branchCloseAutoCommitConsent: false }),
			{ runner: cleanRunner, commit: createCommitAdapter({ dirty: false }) },
		);
		assert.equal(clean.status, "closed");
		assert.deepEqual(
			cleanRunner.commands.map((command) => command.args.join(" ")),
			[
				"rev-parse --abbrev-ref HEAD",
				"worktree list --porcelain",
				"fetch origin",
				"rebase origin/main",
				"switch main",
				"merge --ff-only origin/main",
				"merge --no-ff --no-edit feature/one",
				"push origin main",
				"branch -d feature/one",
				"push origin --delete feature/one",
			],
		);
	});

	it("stops for map refresh before fetch/rebase/merge/push", async () => {
		const runner = createRunner();
		const result = await closeWardenBranch(
			baseArgs({ maps: "scoped-refresh", mapsScope: "pi-warden/warden-flow" }),
			{ runner, commit: createCommitAdapter({ dirty: false }) },
		);

		assert.equal(result.status, "needs_map_refresh");
		assert.deepEqual(
			runner.commands.map((command) => command.args.join(" ")),
			["rev-parse --abbrev-ref HEAD"],
		);
		assert.match(
			result.nextSafeCommand ?? "",
			/\/skill:warden-map --auto pi-warden\/warden-flow/,
		);
		assert.match(result.nextSafeCommand ?? "", /\/skill:warden-commit/);
		assert.match(result.nextSafeCommand ?? "", /rerun warden_branch_close/);
	});

	it("safe-auto commits only one clean bucket and refuses warning or multi-bucket snapshots", async () => {
		const okCommit = createCommitAdapter({ dirty: true });
		const ok = await closeWardenBranch(baseArgs(), {
			runner: createRunner(),
			commit: okCommit,
		});
		assert.equal(ok.status, "closed");
		assert.deepEqual(okCommit.calls, [
			"snapshot:/repo",
			"apply:/repo:pi-warden/warden-flow/src/branch-close.ts",
		]);

		const refused = await closeWardenBranch(baseArgs(), {
			runner: createRunner(),
			commit: createCommitAdapter({
				dirty: true,
				warnings: [{ level: "warning", code: "risky", message: "risky" }],
			}),
		});
		assert.equal(refused.status, "blocked");
		assert.match(refused.nextSafeCommand ?? "", /\/skill:warden-commit/);

		const multi = await closeWardenBranch(baseArgs(), {
			runner: createRunner(),
			commit: createCommitAdapter({
				dirty: true,
				buckets: [
					{ label: "a", paths: ["a.ts"], reason: "a" },
					{ label: "b", paths: ["b.ts"], reason: "b" },
				],
			}),
		});
		assert.equal(multi.status, "blocked");
	});

	it("refuses hidden generated and secret-looking dirty paths before auto-commit", async () => {
		for (const path of [".env", "node_modules/cache.js", "secrets/token.txt"]) {
			const result = await closeWardenBranch(baseArgs(), {
				runner: createRunner(),
				commit: createCommitAdapter({
					dirty: true,
					files: [{ path }],
					buckets: [{ label: "unsafe", paths: [path], reason: "unsafe" }],
				}),
			});
			assert.equal(result.status, "blocked", path);
			assert.match(result.summary, /hidden|generated|secret/i, path);
		}
	});

	it("detects default branch from origin/HEAD and falls back to main", async () => {
		const detectedRunner = createRunner({ originHead: "origin/trunk" });
		const detected = await closeWardenBranch(
			baseArgs({ defaultBranch: undefined }),
			{ runner: detectedRunner, commit: createCommitAdapter() },
		);
		assert.equal(detected.status, "closed");
		assert.ok(
			detectedRunner.commands.some(
				(command) => command.args.join(" ") === "merge --ff-only origin/trunk",
			),
		);

		const fallbackRunner = createRunner();
		const fallback = await closeWardenBranch(
			baseArgs({ defaultBranch: undefined }),
			{ runner: fallbackRunner, commit: createCommitAdapter() },
		);
		assert.equal(fallback.status, "closed");
		assert.ok(
			fallbackRunner.commands.some(
				(command) => command.args.join(" ") === "merge --ff-only origin/main",
			),
		);
	});

	it("cleans multi-worktree branches only after default push and reports partial cleanup failure", async () => {
		const runner = createRunner({
			worktrees: [
				{ path: "/repo", branch: "main" },
				{ path: "/repo-feature", branch: "feature/one" },
			],
			fail: { "branch -d feature/one": "branch checked out elsewhere" },
		});
		const result = await closeWardenBranch(baseArgs({ cwd: "/repo-feature" }), {
			runner,
			commit: createCommitAdapter({ dirty: false }),
		});

		assert.equal(result.status, "partial_success");
		assert.match(result.summary, /cleanup incomplete/i);
		assert.match(result.nextSafeCommand ?? "", /git branch -d feature\/one/);
		assert.match(
			result.warning ?? "",
			/current worktree removed; close this worktree pi agent/,
		);
		assert.deepEqual(
			runner.commands.map(
				(command) => `${command.cwd}: git ${command.args.join(" ")}`,
			),
			[
				"/repo-feature: git rev-parse --abbrev-ref HEAD",
				"/repo-feature: git worktree list --porcelain",
				"/repo-feature: git fetch origin",
				"/repo: git merge --ff-only origin/main",
				"/repo-feature: git rebase origin/main",
				"/repo: git merge --no-ff --no-edit feature/one",
				"/repo: git push origin main",
				"/repo: git worktree remove /repo-feature",
				"/repo: git branch -d feature/one",
			],
		);
	});
});

describe("warden_branch_close extension", () => {
	it("registers structured tool arguments", () => {
		const tools: Array<{ name: string; parameters: unknown }> = [];
		const pi = {
			registerTool(tool: { name: string; parameters: unknown }) {
				tools.push(tool);
			},
		} as unknown as ExtensionAPI;

		registerWardenBranchClose(pi);

		assert.equal(tools.length, 1);
		assert.equal(tools[0]?.name, "warden_branch_close");
		assert.match(
			JSON.stringify(tools[0]?.parameters),
			/branchCloseDestructiveConsent/,
		);
		assert.match(
			JSON.stringify(tools[0]?.parameters),
			/branchCloseAutoCommitConsent/,
		);
	});
});
