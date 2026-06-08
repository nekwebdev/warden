import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildAgentWidgetLines,
	createAgentWidgetController,
} from "../index.ts";

describe("subagent widget formatting", () => {
	it("renders running, queued, elapsed, and passive stats without inventing missing values", () => {
		const lines = buildAgentWidgetLines(
			{
				running: [
					{
						agentId: "agent-1",
						status: "running",
						agentType: "Explore",
						description: "Inspect tests",
						turnCount: 1,
						maxTurns: 3,
						toolUseCount: 2,
						usage: {
							tokens: 1234,
							contextTokens: 4567,
							contextWindow: 100000,
						},
						compactionCount: 1,
						currentActivity: "reading package tests",
						startedAt: 1_000,
					},
				],
				queued: [
					{
						agentId: "agent-2",
						status: "queued",
						agentType: "Plan",
						description: "Plan validation",
						createdAt: 2_000,
					},
				],
				queuedCount: 1,
			},
			{ now: 66_000, spinnerFrame: "⠋" },
		);

		assert.equal(lines[0], "Subagents: 1 running · 1 queued");
		assert.match(lines[1], /⠋ Explore/);
		assert.match(lines[1], /Inspect tests/);
		assert.match(lines[1], /turns 1\/3/);
		assert.match(lines[1], /tools 2/);
		assert.match(lines[1], /tokens 1\.2K/);
		assert.match(lines[1], /context 4\.6K\/100K/);
		assert.match(lines[1], /compactions 1/);
		assert.match(lines[1], /1m 5s/);
		assert.match(lines[1], /reading package tests/);
		assert.match(lines[2], /Queued: 1/);
		assert.doesNotMatch(lines.join("\n"), /undefined|NaN/);
	});

	it("updates and clears the native Pi widget only when UI is available", () => {
		const calls = [];
		const ctx = {
			hasUI: true,
			ui: {
				setWidget(id, value, options) {
					calls.push({ id, value, options });
				},
			},
		};
		const controller = createAgentWidgetController(ctx, {
			widgetId: "test-widget",
			now: () => 10_000,
			spinnerFrame: () => "⠙",
		});

		controller.update({
			running: [
				{
					agentId: "agent-1",
					status: "running",
					agentType: "Explore",
					description: "Work",
					startedAt: 5_000,
				},
			],
			queued: [],
			queuedCount: 0,
		});
		controller.update({ running: [], queued: [], queuedCount: 0 });
		controller.shutdown();

		assert.equal(calls[0].id, "test-widget");
		assert.deepEqual(calls[0].options, { placement: "aboveEditor" });
		assert.match(calls[0].value[1], /⠙ Explore/);
		assert.equal(calls[1].value, undefined);
		assert.equal(calls[2].value, undefined);

		const headless = createAgentWidgetController(
			{ hasUI: false, ui: ctx.ui },
			{ widgetId: "headless" },
		);
		headless.update({
			running: [
				{ agentId: "agent-x", status: "running", agentType: "Explore" },
			],
			queued: [],
			queuedCount: 0,
		});
		assert.equal(calls.length, 3);
	});
});
