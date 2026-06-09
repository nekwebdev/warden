import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	createAgentToolDefinition,
	parseOneShotSchedule,
	validateScheduledAgentParams,
} from "../index.ts";

const NOW = Date.parse("2026-06-08T12:00:00.000Z");

function okRunAt(value) {
	const parsed = parseOneShotSchedule(value, { now: NOW });
	assert.equal(parsed.status, "ok", value);
	return parsed.runAt;
}

describe("one-shot schedule parsing", () => {
	it("accepts positive relative s/m/h/d values and timezone-explicit ISO dates", () => {
		assert.equal(okRunAt("+10s"), "2026-06-08T12:00:10.000Z");
		assert.equal(okRunAt("+5m"), "2026-06-08T12:05:00.000Z");
		assert.equal(okRunAt("+2h"), "2026-06-08T14:00:00.000Z");
		assert.equal(okRunAt("+1d"), "2026-06-09T12:00:00.000Z");
		assert.equal(
			okRunAt("2026-06-08T13:30:00+01:00"),
			"2026-06-08T12:30:00.000Z",
		);
		assert.equal(okRunAt("2026-06-08T12:30:00Z"), "2026-06-08T12:30:00.000Z");
	});

	it("rejects invalid one-shot values while naming deferred cron and interval formats", () => {
		for (const value of [
			"+0s",
			"+-1s",
			"+1.5m",
			"+1w",
			"2026-06-08T12:30:00",
			"2026-06-08T11:59:00Z",
		]) {
			const parsed = parseOneShotSchedule(value, { now: NOW });
			assert.equal(parsed.status, "error", value);
		}
		assert.match(
			parseOneShotSchedule("0 12 * * *", { now: NOW }).message,
			/cron.*deferred/i,
		);
		assert.match(
			parseOneShotSchedule("every 5m", { now: NOW }).message,
			/interval.*deferred/i,
		);
	});
});

describe("scheduled Agent params", () => {
	it("rejects schedule combinations that would bridge or already background work", () => {
		for (const extra of [
			{ inherit_context: true },
			{ inherit_context: false },
			{ resume: "agent-1" },
			{ run_in_background: true },
			{ run_in_background: false },
		]) {
			const result = validateScheduledAgentParams({
				prompt: "work",
				schedule: "+10s",
				...extra,
			});
			assert.equal(result.status, "error", JSON.stringify(extra));
		}
	});

	it("persists scheduled calls through scheduler and starts no child session", async () => {
		let created = 0;
		const scheduled = [];
		const tool = createAgentToolDefinition({
			loadRegistry: () => ({ agents: [], diagnostics: [] }),
			createChildSession: async () => {
				created += 1;
				throw new Error("child should not start");
			},
			scheduler: {
				async schedule(params, ctx) {
					scheduled.push({ params, ctx });
					return {
						content: [
							{
								type: "text",
								text: "Scheduled agent schedule-1 for 2026-06-08T12:00:10.000Z.",
							},
						],
						details: {
							status: "scheduled",
							scheduleId: "schedule-1",
							nextRunAt: "2026-06-08T12:00:10.000Z",
						},
					};
				},
			},
		});

		const result = await tool.execute(
			"tool-1",
			{
				subagent_type: "Explore",
				description: "later",
				prompt: "Inspect later.",
				schedule: "+10s",
			},
			undefined,
			undefined,
			{ cwd: "/tmp/project" },
		);

		assert.equal(result.details.status, "scheduled");
		assert.equal(result.details.scheduleId, "schedule-1");
		assert.equal(result.details.nextRunAt, "2026-06-08T12:00:10.000Z");
		assert.equal(created, 0);
		assert.equal(scheduled[0].params.inherit_context, undefined);
	});
});
