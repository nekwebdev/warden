import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { applyWardenCommitPlan } from "./commit-apply.js";
import {
	loadWardenCommitSnapshot,
	normalizeSnapshotParams,
	resolveSnapshotCwd,
} from "./commit-snapshot.js";
import type {
	ToolDefinition,
	WardenCommitApplyParams,
	WardenCommitSnapshotParams,
} from "./commit-types.js";

export * from "./commit-apply.js";
export { validateWardenCommitApplyInput } from "./commit-apply-validation.js";
export * from "./commit-format.js";
export * from "./commit-paths.js";
export * from "./commit-snapshot.js";
export * from "./commit-types.js";

const WARDEN_COMMIT_SNAPSHOT_PARAMETERS = {
	type: "object",
	additionalProperties: false,
	properties: {
		cwd: {
			type: "string",
			description:
				"Optional working directory to inspect. Relative paths resolve from the current Pi cwd.",
		},
		includeRecentCommits: {
			type: "number",
			description:
				"Optional count of recent commit subjects for message style inference. Defaults to 10.",
			minimum: 0,
			maximum: 25,
		},
	},
} as ToolDefinition["parameters"];

const WARDEN_COMMIT_APPLY_PARAMETERS = {
	type: "object",
	additionalProperties: false,
	required: ["snapshotHash", "commits"],
	properties: {
		cwd: {
			type: "string",
			description:
				"Optional working directory for commit execution. Relative paths resolve from the current Pi cwd.",
		},
		snapshotHash: {
			type: "string",
			description:
				"Snapshot hash returned by the reviewed warden_commit_snapshot call.",
			minLength: 1,
		},
		commits: {
			type: "array",
			description: "Explicit local commits to create in order.",
			minItems: 1,
			items: {
				type: "object",
				additionalProperties: false,
				required: ["subject", "paths"],
				properties: {
					subject: {
						type: "string",
						description: "Exact commit subject. Newlines are rejected.",
						minLength: 1,
					},
					body: {
						type: "string",
						description: "Optional exact commit body.",
					},
					paths: {
						type: "array",
						description:
							"Exact repo-relative file paths from the matching snapshot.",
						minItems: 1,
						items: { type: "string", minLength: 1 },
					},
				},
			},
		},
	},
} as ToolDefinition["parameters"];

export function registerWardenCommit(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "warden_commit_snapshot",
		label: "Warden Commit Snapshot",
		description:
			"Return a compact, read-only git working-tree snapshot for safe Warden commit planning.",
		promptSnippet:
			"Inspect git status, path risks, Warden boundaries, and recent commit style for commit planning.",
		promptGuidelines: [
			"Use warden_commit_snapshot before proposing Warden commit plans; it is read-only and never stages, commits, pushes, pulls, fetches, rebases, resets, amends, tags, or creates PRs.",
		],
		parameters: WARDEN_COMMIT_SNAPSHOT_PARAMETERS,
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const input = normalizeSnapshotParams(
				params as WardenCommitSnapshotParams,
			);
			const cwd = resolveSnapshotCwd(ctx.cwd, input.cwd);
			const snapshot = await loadWardenCommitSnapshot(
				(command, args, options) =>
					pi.exec(command, args, {
						...options,
						signal: options?.signal ?? signal,
					}),
				{ cwd, includeRecentCommits: input.includeRecentCommits, signal },
			);
			return {
				content: [{ type: "text", text: snapshot.text }],
				details: snapshot.details,
			};
		},
	});

	pi.registerTool({
		name: "warden_commit_apply",
		label: "Warden Commit Apply",
		description:
			"Create local git commits from a reviewed commit plan that was based on a matching Warden commit snapshot.",
		promptSnippet:
			"Create local commits only from reviewed Warden commit plans after confirmation and snapshot-hash validation.",
		promptGuidelines: [
			"Use warden_commit_apply only after warden_commit_snapshot and after the user approves a fully displayed commit plan.",
			"warden_commit_apply stages only exact repo-relative paths from the matching snapshot, allows snapshot-verified staged renames only when their destination paths are in the first planned commit, refuses risky or mixed staged paths, creates local commits, and never pushes, pulls, fetches, rebases, resets, amends, tags, stashes, checks out, or creates PRs.",
		],
		parameters: WARDEN_COMMIT_APPLY_PARAMETERS,
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const result = await applyWardenCommitPlan(
				(command, args, options) =>
					pi.exec(command, args, {
						...options,
						signal: options?.signal ?? signal,
					}),
				{
					baseCwd: ctx.cwd,
					input: params as WardenCommitApplyParams,
					signal,
				},
			);
			return {
				content: [{ type: "text", text: result.text }],
				details: result.details,
			};
		},
	});
}
