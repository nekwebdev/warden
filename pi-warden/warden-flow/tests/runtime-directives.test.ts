import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import {
	WARDEN_FLOW_DIRECTIVE_CUSTOM_TYPE,
	buildWardenFlowDirectiveContent,
	buildWardenFlowDirectiveMessage,
	parseWardenMapAutoScope,
	parseWardenSkillDirectAutoInvocation,
	parseWardenStartAutoInvocation,
	resolveWardenFlowInteractionMode,
} from "../src/index.js";

let tempRoots: string[] = [];

afterEach(() => {
	for (const root of tempRoots) rmSync(root, { recursive: true, force: true });
	tempRoots = [];
});

function makePackageRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "warden-flow-directives-"));
	tempRoots.push(root);
	return root;
}

function writeDirective(
	root: string,
	skillName: string,
	body: string,
	mode = "auto",
): void {
	const dir = join(root, "skills", skillName, "runtime-directives");
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, `${mode}.md`), body, "utf-8");
}

describe("Warden Flow runtime directives", () => {
	it("parses explicit warden-start --auto input as control syntax", () => {
		assert.deepEqual(
			parseWardenStartAutoInvocation("/skill:warden-start --auto add X"),
			{
				skillName: "warden-start",
				interactionMode: "auto",
				transformedText: "/skill:warden-start add X",
			},
		);
	});

	it("leaves non-auto warden-start input unparsed", () => {
		assert.equal(
			parseWardenStartAutoInvocation("/skill:warden-start add X"),
			undefined,
		);
	});

	it("parses direct warden-commit --auto input as control syntax", () => {
		assert.deepEqual(
			parseWardenSkillDirectAutoInvocation(
				"/skill:warden-commit --auto finish packet",
			),
			{
				ok: true,
				invocation: {
					skillName: "warden-commit",
					interactionMode: "auto",
					transformedText: "/skill:warden-commit finish packet",
					cleanedArgs: "finish packet",
				},
			},
		);
	});

	it("parses direct warden-map --auto input and validates safe scopes", () => {
		assert.deepEqual(
			parseWardenSkillDirectAutoInvocation(
				"/skill:warden-map --auto pi-warden/warden-flow",
			),
			{
				ok: true,
				invocation: {
					skillName: "warden-map",
					interactionMode: "auto",
					transformedText: "/skill:warden-map pi-warden/warden-flow",
					cleanedArgs: "pi-warden/warden-flow",
				},
			},
		);
		assert.deepEqual(parseWardenMapAutoScope(""), { ok: true, scope: "" });
		assert.deepEqual(parseWardenMapAutoScope("."), { ok: true, scope: "." });
		assert.deepEqual(parseWardenMapAutoScope("pi-warden"), {
			ok: true,
			scope: "pi-warden",
		});
	});

	it("rejects unsafe warden-map --auto scope text before injection", () => {
		for (const scope of [
			"/tmp/repo",
			"../outside",
			"pi-warden/../run-warden",
			"pi-warden//warden-flow",
			"pi-warden;rm",
			"map this repo",
		]) {
			const result = parseWardenSkillDirectAutoInvocation(
				`/skill:warden-map --auto ${scope}`,
			);
			assert.ok(result, scope);
			assert.equal(result.ok, false, scope);
		}
	});

	it("does not treat non-leading --auto text as commit or map control syntax", () => {
		assert.equal(
			parseWardenSkillDirectAutoInvocation(
				"/skill:warden-commit finish --auto packet",
			),
			undefined,
		);
		assert.equal(
			parseWardenSkillDirectAutoInvocation(
				"/skill:warden-map pi-warden --auto",
			),
			undefined,
		);
	});

	it("keeps commit auto directive safety-critical constraints explicit", () => {
		const body = readFileSync(
			new URL(
				"../skills/warden-commit/runtime-directives/auto.md",
				import.meta.url,
			),
			"utf-8",
		);
		assert.match(body, /warden_commit_snapshot/);
		assert.match(body, /warden_commit_apply/);
		assert.match(body, /directAutoCommitConsent=true/);
		assert.match(body, /branchCloseAutoCommitConsent=true/);
		assert.match(body, /Plain user prose[\s\S]+do not count/);
		assert.match(body, /one clear user intent/);
		assert.match(body, /Snapshot deterministic buckets may be merged/);
		assert.match(body, /Unrelated buckets[\s\S]+normal approval/);
		assert.match(body, /No remote or destructive Git operations/);
	});

	it("keeps map auto directive dirty-repo and scope safety explicit", () => {
		const body = readFileSync(
			new URL(
				"../skills/warden-map/runtime-directives/auto.md",
				import.meta.url,
			),
			"utf-8",
		);
		assert.match(body, /empty\/root scope/);
		assert.match(body, /safe repo-relative scope/);
		assert.match(body, /git status --porcelain/);
		assert.match(body, /repository is dirty/);
		assert.match(body, /without editing maps or map-state/);
		assert.match(body, /\.warden\/\*\*/);
	});

	it("resolves explicit auto before settings", () => {
		assert.equal(
			resolveWardenFlowInteractionMode("warden-start", "auto"),
			"auto",
		);
		assert.equal(
			resolveWardenFlowInteractionMode("warden-start", "auto", "interactive"),
			"auto",
		);
	});

	it("resolves settings auto for warden-start only", () => {
		assert.equal(
			resolveWardenFlowInteractionMode("warden-start", undefined, "auto"),
			"auto",
		);
		assert.equal(
			resolveWardenFlowInteractionMode("warden-commit", undefined, "auto"),
			undefined,
		);
		assert.equal(
			resolveWardenFlowInteractionMode("warden-map", undefined, "auto"),
			undefined,
		);
		assert.equal(
			resolveWardenFlowInteractionMode("warden-grill", undefined, "auto"),
			undefined,
		);
		assert.equal(
			resolveWardenFlowInteractionMode("warden-start", undefined, "robot"),
			undefined,
		);
	});

	it("wraps directive body with stable custom message fields", () => {
		const content = buildWardenFlowDirectiveContent(
			"warden-start",
			"auto",
			"Auto mode guidance.\n",
		);

		assert.equal(
			content,
			'<warden-flow-directive skill="warden-start" interactionMode="auto">\nAuto mode guidance.\n</warden-flow-directive>',
		);
	});

	it("loads directives from skill runtime-directives folder", () => {
		const root = makePackageRoot();
		writeDirective(root, "warden-start", "Auto mode guidance.\n");

		assert.deepEqual(
			buildWardenFlowDirectiveMessage("warden-start", "auto", root),
			{
				customType: WARDEN_FLOW_DIRECTIVE_CUSTOM_TYPE,
				display: false,
				content:
					'<warden-flow-directive skill="warden-start" interactionMode="auto">\nAuto mode guidance.\n</warden-flow-directive>',
			},
		);
	});

	it("fails safe when directive file is missing", () => {
		const root = makePackageRoot();

		assert.equal(
			buildWardenFlowDirectiveMessage("warden-start", "auto", root),
			undefined,
		);
	});
});
