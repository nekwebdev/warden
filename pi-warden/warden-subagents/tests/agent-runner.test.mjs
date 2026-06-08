import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildAgentSystemPrompt,
	buildTaskPrompt,
	createAgentToolDefinition,
	enforceAllowedModelScope,
	normalizeMaxTurns,
	resolveForegroundInvocation,
	resolveModelRequest,
	runForegroundAgent,
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
	model: "anthropic/claude-sonnet-4-5",
	thinking: "high",
	maxTurns: 2,
	source: "default",
};

const exploreAgent = {
	...generalAgent,
	type: "Explore",
	description: "Explore helper",
	prompt: "Explore prompt.",
	tools: {
		kind: "allow",
		selectors: [
			{ kind: "builtin", name: "read" },
			{ kind: "extension", extension: "warden-tools" },
		],
	},
	disallowedTools: [{ kind: "builtin", name: "bash" }],
	isolation: "standalone",
	inheritContext: false,
	promptMode: "replace",
	model: undefined,
	thinking: undefined,
	maxTurns: undefined,
};

function makeRegistry(extraAgents = []) {
	return {
		agents: [generalAgent, exploreAgent, ...extraAgents],
		diagnostics: [],
	};
}

function makeCtx(entries = []) {
	return {
		cwd: "/tmp/project",
		getSystemPrompt: () => "Parent system prompt.",
		sessionManager: {
			getBranch: () => entries,
		},
		modelRegistry: {
			find(provider, id) {
				return { provider, id };
			},
			getAll() {
				return [
					{ provider: "anthropic", id: "claude-3-5-haiku-latest" },
					{ provider: "anthropic", id: "claude-sonnet-4-5" },
				];
			},
		},
	};
}

describe("foreground invocation normalization", () => {
	it("lets agent frontmatter model and thinking override caller fields", () => {
		const invocation = resolveForegroundInvocation({
			agent: generalAgent,
			params: {
				prompt: "Do work",
				description: "short task",
				model: "anthropic/claude-3-5-haiku-latest",
				thinking: "low",
				max_turns: 8,
			},
		});

		assert.equal(invocation.modelRequest, "anthropic/claude-sonnet-4-5");
		assert.equal(invocation.thinking, "high");
		assert.equal(invocation.maxTurns, 2);
	});

	it("normalizes max turn wrap and grace behavior without defaulting omitted limits", () => {
		assert.deepEqual(normalizeMaxTurns(undefined), {
			limit: undefined,
			graceTurns: 3,
		});
		assert.deepEqual(normalizeMaxTurns(4), { limit: 4, graceTurns: 3 });
	});
});

describe("foreground prompts and inherited context", () => {
	it("builds replace and append system prompts with parent bridge below agent prompt", () => {
		assert.equal(
			buildAgentSystemPrompt({
				agentPrompt: "Agent only.",
				promptMode: "replace",
				parentSystemPrompt: "Parent.",
			}),
			"Agent only.",
		);
		assert.equal(
			buildAgentSystemPrompt({
				agentPrompt: "Agent.",
				promptMode: "append",
				parentSystemPrompt: "Parent.",
			}),
			"Agent.\n\n## Parent Prompt Bridge\nParent.",
		);
	});

	it("prepends visible parent conversation only and marks truncation at 6000 chars", () => {
		const longText = "x".repeat(6100);
		const task = buildTaskPrompt({
			prompt: "Child task.",
			inheritContext: true,
			parentEntries: [
				{
					type: "message",
					message: {
						role: "toolResult",
						content: [{ type: "text", text: "secret tool payload" }],
					},
				},
				{
					type: "message",
					message: {
						role: "user",
						content: [{ type: "text", text: longText }],
					},
				},
				{
					type: "message",
					message: {
						role: "assistant",
						content: [{ type: "text", text: "assistant note" }],
					},
				},
			],
		});

		assert.match(task, /^## Parent Conversation Bridge/);
		assert.match(task, /\[parent conversation truncated to 6000 chars\]/);
		assert.match(task, /assistant note/);
		assert.doesNotMatch(task, /secret tool payload/);
		assert.match(task, /## Delegated Task\nChild task\.$/);
	});
});

describe("foreground model helpers", () => {
	it("resolves exact provider/model and fuzzy aliases", () => {
		const registry = makeCtx().modelRegistry;
		assert.deepEqual(
			resolveModelRequest("anthropic/claude-sonnet-4-5", registry),
			{
				status: "resolved",
				model: { provider: "anthropic", id: "claude-sonnet-4-5" },
			},
		);
		assert.deepEqual(resolveModelRequest("haiku", registry), {
			status: "resolved",
			model: { provider: "anthropic", id: "claude-3-5-haiku-latest" },
		});
	});

	it("keeps model scope enforcement off by default", () => {
		assert.deepEqual(
			enforceAllowedModelScope({ model: { provider: "x", id: "y" } }),
			{
				status: "allowed",
				model: { provider: "x", id: "y" },
			},
		);
	});
});

describe("foreground Agent execution", () => {
	it("blocks background and resume without starting child sessions", async () => {
		let created = 0;
		const tool = createAgentToolDefinition({
			loadRegistry: () => makeRegistry(),
			createChildSession: async () => {
				created += 1;
				throw new Error("should not create child session");
			},
		});

		const background = await tool.execute(
			"tool-1",
			{
				subagent_type: "Explore",
				prompt: "List files",
				description: "read-only",
				run_in_background: true,
			},
			undefined,
			undefined,
			makeCtx(),
		);
		const resume = await tool.execute(
			"tool-2",
			{
				resume: "agent-123",
				prompt: "Continue",
				description: "resume",
			},
			undefined,
			undefined,
			makeCtx(),
		);

		assert.equal(created, 0);
		assert.equal(background.details.status, "unsupported");
		assert.match(
			background.content[0].text,
			/foreground slice does not support run_in_background/,
		);
		assert.equal(resume.details.status, "unsupported");
		assert.match(
			resume.content[0].text,
			/foreground slice does not support resume/,
		);
	});

	it("returns disabled status without starting child sessions", async () => {
		let created = 0;
		const disabled = { ...exploreAgent, type: "Audit", enabled: false };
		const result = await runForegroundAgent({
			params: { subagent_type: "Audit", prompt: "Audit", description: "check" },
			ctx: makeCtx(),
			registry: makeRegistry([disabled]),
			createChildSession: async () => {
				created += 1;
				throw new Error("should not create child session");
			},
		});

		assert.equal(created, 0);
		assert.equal(result.details.status, "disabled");
		assert.match(result.content[0].text, /disabled/);
	});

	it("falls back unknown agent types to general-purpose with visible note", async () => {
		const result = await runForegroundAgent({
			params: {
				subagent_type: "Missing",
				prompt: "Do work",
				description: "fallback",
			},
			ctx: makeCtx(),
			registry: makeRegistry(),
			createChildSession: async () => fakeChildSession("done"),
		});

		assert.equal(result.details.status, "fallback");
		assert.equal(result.details.agentType, "general-purpose");
		assert.match(result.content[0].text, /Unknown agent type "Missing"/);
		assert.match(result.content[0].text, /done/);
	});

	it("enforces tool policy before first child prompt", async () => {
		const calls = [];
		const session = fakeChildSession("child final", calls);
		const result = await runForegroundAgent({
			params: {
				subagent_type: "Explore",
				prompt: "Explore",
				description: "read-only",
			},
			ctx: makeCtx(),
			registry: makeRegistry(),
			createChildSession: async () => session,
		});

		assert.equal(result.details.status, "completed");
		assert.deepEqual(calls, [
			["setActiveToolsByName", ["read", "ext_status"]],
			["prompt", "Explore"],
		]);
	});
});

function fakeChildSession(finalText, calls = []) {
	return {
		getAllTools() {
			return [
				{ name: "read", sourceInfo: { source: "builtin" } },
				{ name: "bash", sourceInfo: { source: "builtin" } },
				{ name: "ext_status", sourceInfo: { source: "warden-tools" } },
			];
		},
		setActiveToolsByName(names) {
			calls.push(["setActiveToolsByName", names]);
		},
		async prompt(text) {
			calls.push(["prompt", text]);
		},
		getLastAssistantText() {
			return finalText;
		},
		dispose() {},
	};
}
