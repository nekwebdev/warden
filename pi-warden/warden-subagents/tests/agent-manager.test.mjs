import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	AgentManager,
	createGetSubagentResultToolDefinition,
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
	isolation: "standalone",
	inheritContext: false,
	promptMode: "replace",
};

function makeRegistry(extraAgents = []) {
	return {
		agents: [generalAgent, exploreAgent, ...extraAgents],
		diagnostics: [],
	};
}

function deferred() {
	let resolve;
	let reject;
	const promise = new Promise((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

async function tick() {
	await new Promise((resolve) => setImmediate(resolve));
}

describe("AgentManager background lifecycle", () => {
	it("runs up to max concurrency, queues excess work, and repeats terminal results", async () => {
		const gates = [deferred(), deferred()];
		const started = [];
		const manager = new AgentManager({
			maxConcurrency: 1,
			idFactory: () => `agent-${started.length + 1}`,
		});

		const runAgent = async ({ params, signal }) => {
			started.push(params.description);
			const index = started.length - 1;
			await gates[index].promise;
			if (signal.aborted) throw new Error("aborted");
			return {
				content: [{ type: "text", text: `${params.description} final` }],
				details: { status: "completed", agentType: params.subagent_type },
			};
		};

		const first = manager.start({
			params: { subagent_type: "Explore", prompt: "one", description: "one" },
			ctx: { cwd: "/tmp/project" },
			registry: makeRegistry(),
			runAgent,
		});
		const second = manager.start({
			params: { subagent_type: "Explore", prompt: "two", description: "two" },
			ctx: { cwd: "/tmp/project" },
			registry: makeRegistry(),
			runAgent,
		});

		assert.equal(first.details.status, "running");
		assert.equal(second.details.status, "queued");
		assert.equal(manager.getRecordCount(), 2);
		assert.deepEqual(started, ["one"]);
		assert.match(
			manager.getResult({ agent_id: second.details.agentId }).content[0].text,
			/queued/,
		);

		gates[0].resolve();
		await tick();
		assert.deepEqual(started, ["one", "two"]);
		assert.equal(
			manager.getResult({ agent_id: second.details.agentId }).details.status,
			"running",
		);

		gates[1].resolve();
		await tick();
		const completed = manager.getResult({ agent_id: second.details.agentId });
		const repeated = manager.getResult({ agent_id: second.details.agentId });
		assert.equal(completed.details.status, "completed");
		assert.equal(completed.content[0].text, "two final");
		assert.deepEqual(repeated, completed);
	});

	it("keeps unknown background fallback as completed lifecycle status", async () => {
		const manager = new AgentManager({ idFactory: () => "agent-fallback" });
		const launch = manager.start({
			params: {
				subagent_type: "Missing",
				prompt: "work",
				description: "fallback",
			},
			ctx: { cwd: "/tmp/project" },
			registry: makeRegistry(),
			runAgent: async () => ({
				content: [
					{
						type: "text",
						text: 'Unknown agent type "Missing"; using general-purpose.\n\ndone',
					},
				],
				details: {
					status: "fallback",
					agentType: "general-purpose",
					requestedAgentType: "Missing",
					note: 'Unknown agent type "Missing"; using general-purpose.',
				},
			}),
		});

		assert.equal(launch.details.status, "running");
		await tick();
		const result = manager.getResult({ agent_id: launch.details.agentId });
		assert.equal(result.details.status, "completed");
		assert.equal(result.details.agentType, "general-purpose");
		assert.equal(result.details.requestedAgentType, "Missing");
		assert.match(result.details.note, /using general-purpose/);
	});

	it("returns normal error result for unknown ids", () => {
		const manager = new AgentManager();
		const result = manager.getResult({ agent_id: "missing" });
		assert.equal(result.details.status, "error");
		assert.equal(
			result.details.error,
			'Unknown or expired background agent id "missing".',
		);
		assert.match(result.content[0].text, /Unknown or expired/);
	});

	it("waits for terminal result and lets the wait signal cancel waiting only", async () => {
		const gate = deferred();
		const manager = new AgentManager({ idFactory: () => "agent-wait" });
		const launch = manager.start({
			params: { subagent_type: "Explore", prompt: "work", description: "wait" },
			ctx: { cwd: "/tmp/project" },
			registry: makeRegistry(),
			runAgent: async () => {
				await gate.promise;
				return {
					content: [{ type: "text", text: "wait final" }],
					details: { status: "completed", agentType: "Explore" },
				};
			},
		});

		const waiting = manager.waitForResult({
			agent_id: launch.details.agentId,
			wait: true,
		});
		const cancel = new AbortController();
		const canceled = manager.waitForResult(
			{ agent_id: launch.details.agentId, wait: true },
			cancel.signal,
		);
		cancel.abort();
		const canceledResult = await canceled;
		assert.equal(canceledResult.details.status, "running");
		assert.match(canceledResult.details.note, /Wait aborted/);

		gate.resolve();
		const terminal = await waiting;
		assert.equal(terminal.details.status, "completed");
		assert.equal(terminal.content[0].text, "wait final");
	});

	it("aborts queued work before start and aborts running work through its signal", async () => {
		const runningGate = deferred();
		const manager = new AgentManager({
			maxConcurrency: 1,
			idFactory: (() => {
				let next = 0;
				return () => `agent-${++next}`;
			})(),
		});
		const started = [];
		let runningSignal;
		const queuedAbort = new AbortController();
		const runningAbort = new AbortController();

		const first = manager.start({
			params: { subagent_type: "Explore", prompt: "one", description: "one" },
			ctx: { cwd: "/tmp/project" },
			registry: makeRegistry(),
			signal: runningAbort.signal,
			runAgent: async ({ params, signal }) => {
				started.push(params.description);
				runningSignal = signal;
				await runningGate.promise;
				return {
					content: [
						{ type: "text", text: signal.aborted ? "aborted" : "done" },
					],
					details: {
						status: signal.aborted ? "aborted" : "completed",
						agentType: "Explore",
					},
				};
			},
		});
		const second = manager.start({
			params: { subagent_type: "Explore", prompt: "two", description: "two" },
			ctx: { cwd: "/tmp/project" },
			registry: makeRegistry(),
			signal: queuedAbort.signal,
			runAgent: async ({ params }) => {
				started.push(params.description);
				return {
					content: [{ type: "text", text: "should not run" }],
					details: { status: "completed", agentType: "Explore" },
				};
			},
		});

		queuedAbort.abort();
		assert.equal(
			manager.getResult({ agent_id: second.details.agentId }).details.status,
			"aborted",
		);
		assert.deepEqual(started, ["one"]);

		runningAbort.abort();
		assert.equal(runningSignal.aborted, true);
		runningGate.resolve();
		await tick();
		assert.equal(
			manager.getResult({ agent_id: first.details.agentId }).details.status,
			"aborted",
		);
	});

	it("notifies observers with activity snapshots and unconsumed terminal results", async () => {
		const gate = deferred();
		const activities = [];
		const terminals = [];
		const manager = new AgentManager({ idFactory: () => "agent-observed" });
		manager.onActivityChange((snapshot) => activities.push(snapshot));
		manager.onTerminalResult((event) => terminals.push(event));

		const launch = manager.start({
			params: {
				subagent_type: "Explore",
				prompt: "work",
				description: "observed",
			},
			ctx: { cwd: "/tmp/project" },
			registry: makeRegistry(),
			runAgent: async ({ onActivity }) => {
				onActivity?.({
					currentActivity: "calling read",
					turnCount: 1,
					maxTurns: 2,
					toolUseCount: 1,
					usage: { tokens: 42 },
				});
				await gate.promise;
				return {
					content: [{ type: "text", text: "observed final" }],
					details: { status: "completed", agentType: "Explore" },
				};
			},
		});
		await tick();

		assert.equal(launch.details.status, "running");
		assert.equal(
			manager.getActivitySnapshot().running[0].currentActivity,
			"calling read",
		);
		assert.equal(manager.getActivitySnapshot().running[0].turnCount, 1);
		assert.equal(activities.length >= 2, true);

		gate.resolve();
		await tick();
		assert.equal(terminals.length, 1);
		assert.equal(terminals[0].agentId, "agent-observed");
		assert.equal(terminals[0].result.details.status, "completed");
	});

	it("suppresses terminal notification when wait lookup consumes the result", async () => {
		const gate = deferred();
		const terminals = [];
		const manager = new AgentManager({ idFactory: () => "agent-consumed" });
		manager.onTerminalResult((event) => terminals.push(event));
		const launch = manager.start({
			params: {
				subagent_type: "Explore",
				prompt: "work",
				description: "consumed",
			},
			ctx: { cwd: "/tmp/project" },
			registry: makeRegistry(),
			runAgent: async () => {
				await gate.promise;
				return {
					content: [{ type: "text", text: "consumed final" }],
					details: { status: "completed", agentType: "Explore" },
				};
			},
		});
		const waiting = manager.waitForResult({
			agent_id: launch.details.agentId,
			wait: true,
		});

		gate.resolve();
		const result = await waiting;
		await tick();
		assert.equal(result.details.status, "completed");
		assert.deepEqual(terminals, []);
	});

	it("registers result lookup over the same manager and clears records on shutdown", async () => {
		const gate = deferred();
		const manager = new AgentManager({ idFactory: () => "agent-shutdown" });
		const lookup = createGetSubagentResultToolDefinition({ manager });
		let runSignal;
		const launch = manager.start({
			params: {
				subagent_type: "Explore",
				prompt: "work",
				description: "shutdown",
			},
			ctx: { cwd: "/tmp/project" },
			registry: makeRegistry(),
			runAgent: async ({ signal }) => {
				runSignal = signal;
				await gate.promise;
				return {
					content: [{ type: "text", text: "done" }],
					details: { status: "completed", agentType: "Explore" },
				};
			},
		});

		const running = await lookup.execute(
			"tool-lookup",
			{ agent_id: launch.details.agentId },
			undefined,
			undefined,
			{},
		);
		assert.equal(running.details.status, "running");
		manager.shutdown();
		assert.equal(runSignal.aborted, true);
		assert.equal(manager.getRecordCount(), 0);
		const afterShutdown = await lookup.execute(
			"tool-lookup",
			{ agent_id: launch.details.agentId },
			undefined,
			undefined,
			{},
		);
		assert.equal(afterShutdown.details.status, "error");
		gate.resolve();
	});

	it("stops queued and running agents but rejects missing or terminal agents", async () => {
		const runningGate = deferred();
		const manager = new AgentManager({
			maxConcurrency: 1,
			idFactory: (() => {
				let next = 0;
				return () => `agent-stop-${++next}`;
			})(),
		});
		let runningSignal;
		const first = manager.start({
			params: { subagent_type: "Explore", prompt: "one", description: "one" },
			ctx: { cwd: "/tmp/project" },
			registry: makeRegistry(),
			runAgent: async ({ signal }) => {
				runningSignal = signal;
				await runningGate.promise;
				return {
					content: [{ type: "text", text: "done" }],
					details: { status: signal.aborted ? "aborted" : "completed" },
				};
			},
		});
		const second = manager.start({
			params: { subagent_type: "Explore", prompt: "two", description: "two" },
			ctx: { cwd: "/tmp/project" },
			registry: makeRegistry(),
			runAgent: async () => {
				throw new Error("queued agent should not run");
			},
		});

		const stoppedQueued = manager.stop(second.details.agentId);
		assert.equal(stoppedQueued.details.status, "aborted");
		assert.match(stoppedQueued.content[0].text, /stopped before it started/i);
		assert.equal(manager.getActivitySnapshot().queuedCount, 0);

		const stoppedRunning = manager.stop(first.details.agentId);
		assert.equal(stoppedRunning.details.status, "aborted");
		assert.equal(runningSignal.aborted, true);
		runningGate.resolve();
		await tick();
		assert.equal(
			manager.getResult({ agent_id: first.details.agentId }).details.status,
			"aborted",
		);

		const terminalStop = manager.stop(first.details.agentId);
		assert.equal(terminalStop.details.status, "error");
		assert.equal(terminalStop.details.error, "Agent is not running.");
		assert.equal(
			manager.getResult({ agent_id: first.details.agentId }).details.status,
			"aborted",
		);
		assert.equal(
			manager.stop("missing").details.error,
			'Unknown or expired background agent id "missing".',
		);
	});

	it("emits RPC-adjacent lifecycle events with serializable payloads", async () => {
		let now = 1_000;
		const events = [];
		const manager = new AgentManager({
			idFactory: () => "agent-events",
			now: () => now,
		});
		manager.onLifecycleEvent((event) => events.push(event));
		const launch = manager.start({
			params: {
				subagent_type: "Explore",
				prompt: "work",
				description: "eventful",
			},
			ctx: { cwd: "/tmp/project" },
			registry: makeRegistry(),
			runAgent: async ({ onActivity }) => {
				now = 1_250;
				onActivity?.({ toolUseCount: 3, usage: { tokens: 55 } });
				return {
					content: [{ type: "text", text: "event final" }],
					details: {
						status: "completed",
						agentType: "Explore",
						toolUseCount: 4,
						usage: { tokens: 89 },
					},
				};
			},
		});

		assert.equal(launch.details.status, "running");
		await tick();
		assert.deepEqual(
			events.map((event) => event.channel),
			["subagents:created", "subagents:started", "subagents:completed"],
		);
		assert.deepEqual(events[0].payload, {
			id: "agent-events",
			type: "Explore",
			description: "eventful",
			isBackground: true,
		});
		assert.deepEqual(events[1].payload, {
			id: "agent-events",
			type: "Explore",
			description: "eventful",
		});
		assert.deepEqual(events[2].payload, {
			id: "agent-events",
			type: "Explore",
			description: "eventful",
			status: "completed",
			result: "event final",
			durationMs: 250,
			toolUses: 4,
			tokens: 89,
		});
	});

	it("emits failed lifecycle events for error and aborted terminal states", async () => {
		const events = [];
		const manager = new AgentManager({
			maxConcurrency: 1,
			idFactory: (() => {
				let next = 0;
				return () => `agent-failed-${++next}`;
			})(),
		});
		manager.onLifecycleEvent((event) => events.push(event));
		manager.start({
			params: { subagent_type: "Explore", prompt: "one", description: "boom" },
			ctx: { cwd: "/tmp/project" },
			registry: makeRegistry(),
			runAgent: async () => {
				throw new Error("boom");
			},
		});
		const queued = manager.start({
			params: {
				subagent_type: "Explore",
				prompt: "two",
				description: "abort me",
			},
			ctx: { cwd: "/tmp/project" },
			registry: makeRegistry(),
			runAgent: async () => ({
				content: [{ type: "text", text: "should not run" }],
				details: { status: "completed" },
			}),
		});
		manager.stop(queued.details.agentId);
		await tick();

		const failedEvents = events.filter(
			(event) => event.channel === "subagents:failed",
		);
		assert.equal(failedEvents.length, 2);
		assert.equal(failedEvents[0].payload.status, "aborted");
		assert.equal(failedEvents[1].payload.status, "error");
		assert.equal(failedEvents[1].payload.error, "boom");
	});
});
