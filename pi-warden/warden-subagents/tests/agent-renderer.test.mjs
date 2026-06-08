import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAgentToolDefinition } from "../index.ts";

const plainTheme = {
	fg(_name, value) {
		return value;
	},
	bold(value) {
		return value;
	},
};

describe("Agent tool custom renderer", () => {
	it("renders foreground call and result rows without renaming status vocabulary", () => {
		const tool = createAgentToolDefinition();
		assert.equal(typeof tool.renderCall, "function");
		assert.equal(typeof tool.renderResult, "function");

		const call = tool.renderCall(
			{
				subagent_type: "Explore",
				description: "Inspect files",
			},
			plainTheme,
			{ lastComponent: undefined },
		);
		const result = tool.renderResult(
			{
				content: [{ type: "text", text: "wrapped result" }],
				details: {
					status: "steered",
					agentType: "Explore",
					description: "Inspect files",
				},
			},
			{ expanded: false, isPartial: false },
			plainTheme,
			{ args: {}, lastComponent: undefined },
		);

		assert.match(call.render(80).join("\n"), /Agent Explore/);
		const lines = result.render(80).join("\n");
		assert.match(lines, /wrapped-up/);
		assert.match(lines, /wrapped result/);
	});
});
