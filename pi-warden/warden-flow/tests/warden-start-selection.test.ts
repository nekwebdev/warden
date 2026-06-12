import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	analyzeWardenStartSelection,
	executeWardenStartAutoBranch,
} from "../src/index.js";

describe("Warden start branch-aware selection", () => {
	it("parses leading flags in any order before rough intent", () => {
		const result = analyzeWardenStartSelection({
			text: "/skill:warden-start --auto --branch chore/branch-aware-start add branch-aware start",
			currentBranch: "main",
		});

		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.equal(result.selection.auto, true);
		assert.equal(result.selection.packetType, "chore");
		assert.equal(result.selection.slug, "branch-aware-start");
		assert.equal(result.selection.branchName, "chore/branch-aware-start");
		assert.equal(
			result.selection.transformedText,
			"/skill:warden-start add branch-aware start",
		);
	});

	it("treats flag-looking tokens after rough intent as prose", () => {
		const result = analyzeWardenStartSelection({
			text: "/skill:warden-start add docs --name from-prose",
			currentBranch: "main",
		});

		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.equal(result.selection.packetType, "docs");
		assert.equal(result.selection.slug, "add-docs-name-from-prose");
		assert.equal(
			result.selection.transformedText,
			"/skill:warden-start add docs --name from-prose",
		);
	});

	it("uses valid current branch context and skips slug and branch prompts", () => {
		const result = analyzeWardenStartSelection({
			text: "/skill:warden-start tighten packet flow",
			currentBranch: "feature/branch-aware-start",
		});

		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.equal(result.selection.packetType, "feature");
		assert.equal(result.selection.slug, "branch-aware-start");
		assert.equal(result.selection.source, "current-branch");
		assert.equal(result.selection.shouldSkipSlugPrompt, true);
		assert.equal(result.selection.shouldSkipBranchPrompt, true);
	});

	it("fails when current branch has valid type prefix and invalid slug", () => {
		const result = analyzeWardenStartSelection({
			text: "/skill:warden-start tighten packet flow",
			currentBranch: "feature/Bad_Slug",
		});

		assert.equal(result.ok, false);
		if (result.ok) return;
		assert.match(result.errors.join("\n"), /invalid slug/i);
	});

	it("rejects malformed and conflicting leading flags before packet write", () => {
		const result = analyzeWardenStartSelection({
			text: "/skill:warden-start --name a --branch feature/b add thing",
			currentBranch: "main",
		});

		assert.equal(result.ok, false);
		if (result.ok) return;
		assert.match(result.errors.join("\n"), /mutually exclusive/i);
	});

	it("refuses auto branch switching when the repo is dirty", async () => {
		const result = analyzeWardenStartSelection({
			text: "/skill:warden-start --auto --branch chore/branch-aware-start add branch-aware start",
			currentBranch: "main",
		});
		assert.equal(result.ok, true);
		if (!result.ok) return;

		const calls: string[] = [];
		await assert.rejects(
			executeWardenStartAutoBranch(
				async (_command, args) => {
					calls.push(args.join(" "));
					if (args.join(" ") === "status --porcelain") {
						return { stdout: " M dirty.ts\n", code: 0 };
					}
					throw new Error(`unexpected git args: ${args.join(" ")}`);
				},
				{ cwd: "/repo", selection: result.selection, currentBranch: "main" },
			),
			/dirty/i,
		);
		assert.deepEqual(calls, ["status --porcelain"]);
	});

	it("switches to existing local branch or creates it in auto mode when clean", async () => {
		const result = analyzeWardenStartSelection({
			text: "/skill:warden-start --branch chore/branch-aware-start --auto add branch-aware start",
			currentBranch: "main",
		});
		assert.equal(result.ok, true);
		if (!result.ok) return;

		const calls: string[] = [];
		await executeWardenStartAutoBranch(
			async (_command, args) => {
				calls.push(args.join(" "));
				if (args.join(" ") === "status --porcelain")
					return { stdout: "", code: 0 };
				if (
					args.join(" ") ===
					"show-ref --verify --quiet refs/heads/chore/branch-aware-start"
				) {
					return { stdout: "", code: 1 };
				}
				if (args.join(" ") === "switch -c chore/branch-aware-start") {
					return { stdout: "", code: 0 };
				}
				throw new Error(`unexpected git args: ${args.join(" ")}`);
			},
			{ cwd: "/repo", selection: result.selection, currentBranch: "main" },
		);

		assert.deepEqual(calls, [
			"status --porcelain",
			"show-ref --verify --quiet refs/heads/chore/branch-aware-start",
			"switch -c chore/branch-aware-start",
		]);
	});
});
