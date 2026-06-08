import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildSubagentNotificationPayload,
	renderSubagentNotification,
	sendSubagentNotification,
} from "../index.ts";

const plainTheme = {
	fg(_name, value) {
		return value;
	},
	bold(value) {
		return value;
	},
};

describe("subagent completion notifications", () => {
	it("builds parseable task-notification content with capped preview and no transcript path", () => {
		const payload = buildSubagentNotificationPayload({
			content: [{ type: "text", text: "x".repeat(650) }],
			details: {
				status: "completed",
				agentId: "agent-1",
				agentType: "Explore",
				description: "Inspect package tests",
				usage: { tokens: 1234 },
			},
		});

		assert.match(payload.content, /^<task-notification>/);
		assert.match(payload.content, /<agent-id>agent-1<\/agent-id>/);
		assert.match(payload.content, /<status>completed<\/status>/);
		assert.match(
			payload.content,
			/<transcript>transcript unavailable in this slice<\/transcript>/,
		);
		assert.equal([...payload.details.resultPreview].length, 600);
		assert.equal(payload.details.transcriptPath, null);
		assert.equal(payload.details.statusNote, "completed");
	});

	it("sends follow-up notifications only when message API and UI are available", () => {
		const sent = [];
		const pi = {
			sendMessage(message, options) {
				sent.push({ message, options });
			},
		};
		const result = {
			content: [{ type: "text", text: "done" }],
			details: {
				status: "error",
				agentId: "agent-2",
				agentType: "Plan",
				description: "Plan work",
				error: "boom",
			},
		};

		assert.equal(sendSubagentNotification(pi, { hasUI: false }, result), false);
		assert.equal(sendSubagentNotification(pi, { hasUI: true }, result), true);
		assert.equal(sent.length, 1);
		assert.equal(sent[0].message.customType, "subagent-notification");
		assert.equal(sent[0].message.display, true);
		assert.deepEqual(sent[0].options, {
			deliverAs: "followUp",
			triggerTurn: true,
		});
	});

	it("renders styled notification details from structured details", () => {
		const payload = buildSubagentNotificationPayload({
			content: [{ type: "text", text: "short result" }],
			details: {
				status: "aborted",
				agentId: "agent-3",
				agentType: "Explore",
				description: "Stop work",
			},
		});
		const component = renderSubagentNotification(
			{
				customType: "subagent-notification",
				content: payload.content,
				details: payload.details,
			},
			{ expanded: true },
			plainTheme,
		);

		const lines = component.render(80).join("\n");
		assert.match(lines, /Subagent agent-3 aborted/);
		assert.match(lines, /Stop work/);
		assert.match(lines, /transcript unavailable in this slice/);
	});
});
