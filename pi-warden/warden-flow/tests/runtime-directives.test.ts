import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import {
	WARDEN_FLOW_DIRECTIVE_CUSTOM_TYPE,
	buildWardenFlowDirectiveContent,
	buildWardenFlowDirectiveMessage,
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

function writeDirective(root: string, body: string): void {
	const dir = join(root, "skills", "warden-start", "runtime-directives");
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "auto.md"), body, "utf-8");
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
		writeDirective(root, "Auto mode guidance.\n");

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
