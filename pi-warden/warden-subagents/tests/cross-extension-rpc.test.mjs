import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	AgentManager,
	PROTOCOL_VERSION,
	registerSubagentsRpc,
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

function registry() {
	return { agents: [generalAgent, exploreAgent], diagnostics: [] };
}

function fakeEvents() {
	const handlers = new Map();
	const emitted = [];
	return {
		emitted,
		handlerCount(channel) {
			return handlers.get(channel)?.size ?? 0;
		},
		on(channel, handler) {
			const set = handlers.get(channel) ?? new Set();
			set.add(handler);
			handlers.set(channel, set);
			return () => set.delete(handler);
		},
		emit(channel, payload) {
			emitted.push({ channel, payload });
		},
		async send(channel, payload) {
			for (const handler of handlers.get(channel) ?? []) {
				await handler(payload);
			}
		},
	};
}

async function tick() {
	await new Promise((resolve) => setImmediate(resolve));
}

describe("subagents cross-extension RPC", () => {
	it("registers ping, emits ready after handlers, and unregisters listeners", async () => {
		const events = fakeEvents();
		const unregister = registerSubagentsRpc({
			events,
			manager: new AgentManager(),
			getCtx: () => undefined,
			loadRegistry: () => registry(),
			runAgent: async () => ({
				content: [{ type: "text", text: "unused" }],
				details: { status: "completed" },
			}),
		});

		assert.equal(PROTOCOL_VERSION, 2);
		assert.equal(events.handlerCount("subagents:rpc:ping"), 1);
		assert.equal(events.handlerCount("subagents:rpc:spawn"), 1);
		assert.equal(events.handlerCount("subagents:rpc:stop"), 1);
		assert.deepEqual(events.emitted[0], {
			channel: "subagents:ready",
			payload: {},
		});

		await events.send("subagents:rpc:ping", { requestId: "ping-1" });
		assert.deepEqual(events.emitted.at(-1), {
			channel: "subagents:rpc:ping:reply:ping-1",
			payload: { success: true, data: { version: 2 } },
		});

		unregister();
		assert.equal(events.handlerCount("subagents:rpc:ping"), 0);
		await events.send("subagents:rpc:ping", { requestId: "ping-2" });
		assert.equal(
			events.emitted.some(
				(event) => event.channel === "subagents:rpc:ping:reply:ping-2",
			),
			false,
		);
	});

	it("keeps ping available before session while spawn reports no active session", async () => {
		const events = fakeEvents();
		registerSubagentsRpc({
			events,
			manager: new AgentManager(),
			getCtx: () => undefined,
			loadRegistry: () => registry(),
			runAgent: async () => ({
				content: [{ type: "text", text: "unused" }],
				details: { status: "completed" },
			}),
		});

		await events.send("subagents:rpc:ping", { requestId: "ping-before" });
		await events.send("subagents:rpc:spawn", {
			requestId: "spawn-before",
			type: "Explore",
			prompt: "work",
		});

		assert.deepEqual(
			events.emitted.find(
				(event) => event.channel === "subagents:rpc:ping:reply:ping-before",
			)?.payload,
			{ success: true, data: { version: 2 } },
		);
		assert.deepEqual(
			events.emitted.find(
				(event) => event.channel === "subagents:rpc:spawn:reply:spawn-before",
			)?.payload,
			{ success: false, error: "No active session" },
		);
	});

	it("spawns through AgentManager with upstream request shape and strict model resolution", async () => {
		const events = fakeEvents();
		const manager = new AgentManager({ idFactory: () => "agent-rpc" });
		const seen = [];
		registerSubagentsRpc({
			events,
			manager,
			getCtx: () => ({
				cwd: "/tmp/project",
				modelRegistry: {
					models: [{ provider: "anthropic", id: "claude-sonnet-4-5" }],
				},
			}),
			loadRegistry: ({ cwd }) => {
				assert.equal(cwd, "/tmp/project");
				return registry();
			},
			runAgent: async ({ params }) => {
				seen.push(params);
				return {
					content: [{ type: "text", text: "rpc final" }],
					details: { status: "completed", agentType: params.subagent_type },
				};
			},
		});

		await events.send("subagents:rpc:spawn", {
			requestId: "spawn-1",
			type: "Explore",
			prompt: "Do work.",
			options: { description: "RPC work", model: "sonnet", max_turns: 2 },
		});
		assert.deepEqual(events.emitted.at(-1), {
			channel: "subagents:rpc:spawn:reply:spawn-1",
			payload: {
				success: true,
				data: {
					id: "agent-rpc",
					status: "running",
					type: "Explore",
					description: "RPC work",
				},
			},
		});

		await tick();
		assert.equal(seen[0].subagent_type, "Explore");
		assert.equal(seen[0].prompt, "Do work.");
		assert.equal(seen[0].description, "RPC work");
		assert.equal(seen[0].model, "anthropic/claude-sonnet-4-5");
		assert.equal(seen[0].run_in_background, false);
		assert.equal(
			manager.getResult({ agent_id: "agent-rpc" }).details.status,
			"completed",
		);

		await events.send("subagents:rpc:spawn", {
			requestId: "spawn-bad-model",
			type: "Explore",
			prompt: "Do work.",
			options: { model: "missing-model" },
		});
		assert.deepEqual(events.emitted.at(-1), {
			channel: "subagents:rpc:spawn:reply:spawn-bad-model",
			payload: {
				success: false,
				error: 'Model "missing-model" could not be resolved.',
			},
		});
	});

	it("stops running agents with agentId request shape and reports missing ids", async () => {
		const events = fakeEvents();
		const manager = new AgentManager({ idFactory: () => "agent-stop-rpc" });
		registerSubagentsRpc({
			events,
			manager,
			getCtx: () => ({ cwd: "/tmp/project" }),
			loadRegistry: () => registry(),
			runAgent: async ({ signal }) => {
				await new Promise((resolve) =>
					signal.addEventListener("abort", resolve),
				);
				return {
					content: [{ type: "text", text: "aborted" }],
					details: { status: "aborted", agentType: "Explore" },
				};
			},
		});

		await events.send("subagents:rpc:spawn", {
			requestId: "spawn-stop",
			type: "Explore",
			prompt: "wait",
		});
		await events.send("subagents:rpc:stop", {
			requestId: "stop-1",
			agentId: "agent-stop-rpc",
		});
		assert.deepEqual(events.emitted.at(-1), {
			channel: "subagents:rpc:stop:reply:stop-1",
			payload: {
				success: true,
				data: { id: "agent-stop-rpc", status: "aborted" },
			},
		});

		await events.send("subagents:rpc:stop", {
			requestId: "stop-missing",
			agentId: "missing",
		});
		assert.deepEqual(events.emitted.at(-1), {
			channel: "subagents:rpc:stop:reply:stop-missing",
			payload: {
				success: false,
				error: 'Unknown or expired background agent id "missing".',
			},
		});
	});
});
