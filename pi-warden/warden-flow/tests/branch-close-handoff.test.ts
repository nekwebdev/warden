import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	branchCloseContextFromNames,
	formatBranchCloseManualNextStep,
	isSafeBranchCloseBranchName,
	makeBranchCloseHandoffPayload,
	parseWardenCloseMapFields,
} from "../src/index.js";

describe("branch close handoff helpers", () => {
	it("classifies default, feature, and detached branch contexts", () => {
		assert.deepEqual(branchCloseContextFromNames("main", "main"), {
			status: "default-branch",
			currentBranch: "main",
			defaultBranch: "main",
		});
		assert.deepEqual(branchCloseContextFromNames("feature/one", "main"), {
			status: "feature-branch",
			featureBranch: "feature/one",
			defaultBranch: "main",
		});
		assert.deepEqual(branchCloseContextFromNames(undefined, "main"), {
			status: "detached-head",
			defaultBranch: "main",
		});
	});

	it("validates conservative branch names before prompts or payloads", () => {
		for (const branch of ["feature/one", "bugfix.foo", "release_2026-06"]) {
			assert.equal(isSafeBranchCloseBranchName(branch), true, branch);
		}
		for (const branch of [
			"",
			"feature branch",
			"-feature",
			"feature;rm-rf",
			"feature..bad",
			"feature.lock",
			"feature@{bad}",
			"feature\\bad",
			"/feature",
			"feature/../main",
			"feature/",
		]) {
			assert.equal(isSafeBranchCloseBranchName(branch), false, branch);
		}
	});

	it("builds exact branch-close handoff payload and manual next step", () => {
		const mapFields = parseWardenCloseMapFields(
			"Maps: scoped-refresh\nMaps scope: pi-warden/warden-flow",
		);
		assert.equal(mapFields.status, "valid");
		const payload = makeBranchCloseHandoffPayload({
			cwd: "/repo",
			featureBranch: "feature/one",
			defaultBranch: "main",
			mapFields,
			packetPath: ".warden/work/one/packet.md",
			packetName: "one",
		});
		assert.deepEqual(payload, {
			workflow: "warden_branch_close",
			featureBranch: "feature/one",
			defaultBranch: "main",
			maps: "scoped-refresh",
			mapsScope: "pi-warden/warden-flow",
			packetPath: ".warden/work/one/packet.md",
			packetName: "one",
			cwd: "/repo",
		});
		assert.equal(
			formatBranchCloseManualNextStep(payload),
			'Manual next step: warden_branch_close {"workflow":"warden_branch_close","featureBranch":"feature/one","defaultBranch":"main","maps":"scoped-refresh","mapsScope":"pi-warden/warden-flow","packetPath":".warden/work/one/packet.md","packetName":"one","cwd":"/repo"} after .warden/work/warden-branch-close-engine/packet.md lands.',
		);
	});
});
