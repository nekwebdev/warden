import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
	AgentManager,
	ScheduleStore,
	ScheduledAgentManager,
} from "../index.ts";

const generalAgent = {
	type: "general-purpose",
	description: "General helper",
	prompt: "General prompt.",
	enabled: true,
	tools: { kind: "all" },
	extensions: [],
	skills: [],
	disallowedTools: [],
	memory: false,
	isolation: "parent-twin",
	inheritContext: true,
	promptMode: "append",
	runInBackground: false,
	source: "default",
};

const exploreAgent = {
	...generalAgent,
	type: "Explore",
	description: "Explore helper",
	prompt: "Explore prompt.",
	inheritContext: false,
};

function registry(extraAgents = []) {
	return {
		agents: [generalAgent, exploreAgent, ...extraAgents],
		diagnostics: [],
	};
}

async function schedulerFixture(options = {}) {
	const dir = await mkdtemp(join(tmpdir(), "warden-scheduler-"));
	const timers = [];
	const store = new ScheduleStore({ filePath: join(dir, "session.json") });
	const manager = new AgentManager({ idFactory: () => "agent-1" });
	const scheduler = new ScheduledAgentManager({
		store,
		agentManager: manager,
		now: options.now ?? (() => Date.parse("2026-06-08T12:00:00.000Z")),
		setTimeoutFn(fn, ms) {
			const handle = {
				fn,
				ms,
				unrefCalled: false,
				unref() {
					this.unrefCalled = true;
				},
			};
			timers.push(handle);
			return handle;
		},
		clearTimeoutFn(handle) {
			handle.cleared = true;
		},
		loadRegistry: options.loadRegistry ?? (() => registry()),
		runAgent:
			options.runAgent ??
			(async ({ params }) => ({
				content: [{ type: "text", text: `${params.description} done` }],
				details: { status: "completed", agentType: params.subagent_type },
			})),
	});
	return {
		dir,
		store,
		manager,
		scheduler,
		timers,
		cleanup: () => rm(dir, { recursive: true, force: true }),
	};
}

async function tick() {
	await new Promise((resolve) => setTimeout(resolve, 5));
}

async function waitForJob(store, predicate) {
	for (let attempt = 0; attempt < 20; attempt += 1) {
		const [job] = await store.list();
		if (job && predicate(job)) return job;
		await tick();
	}
	return (await store.list())[0];
}

async function waitForManagerResult(manager, agentId, status) {
	for (let attempt = 0; attempt < 20; attempt += 1) {
		const result = manager.getResult({ agent_id: agentId });
		if (result.details.status === status) return result;
		await tick();
	}
	return manager.getResult({ agent_id: agentId });
}

describe("ScheduledAgentManager", () => {
	it("persists scheduled calls, unrefs timers, and enqueues one-shot jobs through AgentManager when due", async () => {
		const fixture = await schedulerFixture();
		try {
			const result = await fixture.scheduler.schedule(
				{
					subagent_type: "Explore",
					description: "later",
					prompt: "Inspect later.",
					schedule: "+10s",
				},
				{ cwd: "/tmp/project" },
			);

			assert.equal(result.details.status, "scheduled");
			assert.equal(result.details.scheduleId, "schedule-1");
			assert.equal(result.details.nextRunAt, "2026-06-08T12:00:10.000Z");
			assert.equal(fixture.manager.getRecordCount(), 0);
			assert.equal(fixture.timers[0].ms, 10_000);
			assert.equal(fixture.timers[0].unrefCalled, true);

			await fixture.timers[0].fn();
			const job = await waitForJob(
				fixture.store,
				(item) => item.status === "completed",
			);
			assert.equal(job.status, "completed");
			assert.equal(job.lastStatus, "completed");
			assert.equal(job.runCount, 1);
			assert.equal(job.agentId, "agent-1");
			assert.equal(
				(await waitForManagerResult(fixture.manager, "agent-1", "completed"))
					.details.status,
				"completed",
			);
		} finally {
			await fixture.cleanup();
		}
	});

	it("fires due pending jobs once on session rearm and forces no context inheritance", async () => {
		let now = Date.parse("2026-06-08T12:00:00.000Z");
		const seenParams = [];
		const fixture = await schedulerFixture({
			now: () => now,
			runAgent: async ({ params }) => {
				seenParams.push(params);
				return {
					content: [{ type: "text", text: "done" }],
					details: { status: "completed", agentType: params.subagent_type },
				};
			},
		});
		try {
			await fixture.scheduler.schedule(
				{
					subagent_type: "Explore",
					description: "due",
					prompt: "Run later.",
					schedule: "+10s",
				},
				{ cwd: "/tmp/project" },
			);
			now = Date.parse("2026-06-08T12:00:20.000Z");
			await fixture.scheduler.rearm();
			await tick();
			await fixture.scheduler.rearm();
			await tick();

			const [job] = await fixture.store.list();
			assert.equal(job.runCount, 1);
			assert.equal(seenParams[0].inherit_context, false);
			assert.equal(seenParams[0].schedule, undefined);
		} finally {
			await fixture.cleanup();
		}
	});

	it("persists terminal error for disabled, unknown, and registry load failures", async () => {
		const disabled = { ...exploreAgent, enabled: false };
		const cases = [
			{
				name: "disabled",
				subagent_type: "Explore",
				loadRegistry: () => ({
					agents: [generalAgent, disabled],
					diagnostics: [],
				}),
			},
			{
				name: "unknown",
				subagent_type: "Missing",
				loadRegistry: () => registry(),
			},
			{
				name: "registry",
				subagent_type: "Explore",
				loadRegistry: () => {
					throw new Error("boom");
				},
			},
		];

		for (const testCase of cases) {
			let now = Date.parse("2026-06-08T12:00:00.000Z");
			const fixture = await schedulerFixture({
				now: () => now,
				loadRegistry: testCase.loadRegistry,
			});
			try {
				await fixture.scheduler.schedule(
					{
						subagent_type: testCase.subagent_type,
						description: testCase.name,
						prompt: "Run later.",
						schedule: "+1s",
					},
					{ cwd: "/tmp/project" },
				);
				now += 2_000;
				await fixture.scheduler.rearm();
				await tick();

				const [job] = await fixture.store.list();
				assert.equal(job.status, "error", testCase.name);
				assert.match(job.lastMessage, /disabled|Unknown agent type|boom/i);
			} finally {
				await fixture.cleanup();
			}
		}
	});
});
