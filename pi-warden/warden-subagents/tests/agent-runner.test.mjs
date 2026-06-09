import assert from "node:assert/strict";
import {
	existsSync,
	mkdirSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import {
	buildAgentSystemPrompt,
	AgentManager,
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
	it("starts background runs immediately with an agent id while resume stays unsupported", async () => {
		let created = 0;
		const manager = new AgentManager({ idFactory: () => "agent-bg" });
		const tool = createAgentToolDefinition({
			manager,
			loadRegistry: () => makeRegistry(),
			createChildSession: async () => {
				created += 1;
				return fakeChildSession("background done");
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

		assert.equal(background.details.status, "running");
		assert.equal(background.details.agentId, "agent-bg");
		assert.match(
			background.content[0].text,
			/Background agent agent-bg is running/,
		);
		assert.equal(resume.details.status, "unsupported");
		assert.match(
			resume.content[0].text,
			/foreground slice does not support resume/,
		);
		await new Promise((resolve) => setImmediate(resolve));
		assert.equal(created, 1);
	});

	it("lets foreground agents bypass the background queue", async () => {
		const gate = deferred();
		let created = 0;
		const manager = new AgentManager({
			maxConcurrency: 1,
			idFactory: () => "agent-blocked",
		});
		const backgroundAbort = new AbortController();
		const tool = createAgentToolDefinition({
			manager,
			loadRegistry: () => makeRegistry(),
			createChildSession: async () => {
				created += 1;
				if (created === 1) {
					return fakeChildSession("background final", [], gate.promise);
				}
				return fakeChildSession("foreground final");
			},
		});

		const background = await tool.execute(
			"tool-background",
			{
				subagent_type: "Explore",
				prompt: "Background",
				description: "blocked",
				run_in_background: true,
			},
			backgroundAbort.signal,
			undefined,
			makeCtx(),
		);
		await new Promise((resolve) => setImmediate(resolve));
		const foreground = await tool.execute(
			"tool-foreground",
			{
				subagent_type: "Explore",
				prompt: "Foreground",
				description: "inline",
			},
			undefined,
			undefined,
			makeCtx(),
		);

		assert.equal(background.details.status, "running");
		assert.equal(foreground.details.status, "completed");
		assert.equal(foreground.content[0].text, "foreground final");
		assert.equal(created, 2);
		backgroundAbort.abort();
		gate.resolve();
	});

	it("returns disabled status without starting child sessions or background records", async () => {
		let created = 0;
		const disabled = { ...exploreAgent, type: "Audit", enabled: false };
		const registry = makeRegistry([disabled]);
		const manager = new AgentManager();
		const backgroundTool = createAgentToolDefinition({
			manager,
			loadRegistry: () => registry,
			createChildSession: async () => {
				created += 1;
				throw new Error("should not create child session");
			},
		});
		const foreground = await runForegroundAgent({
			params: { subagent_type: "Audit", prompt: "Audit", description: "check" },
			ctx: makeCtx(),
			registry,
			createChildSession: async () => {
				created += 1;
				throw new Error("should not create child session");
			},
		});
		const background = await backgroundTool.execute(
			"tool-disabled",
			{
				subagent_type: "Audit",
				prompt: "Audit",
				description: "check",
				run_in_background: true,
			},
			undefined,
			undefined,
			makeCtx(),
		);

		assert.equal(created, 0);
		assert.equal(foreground.details.status, "disabled");
		assert.equal(background.details.status, "disabled");
		assert.equal(background.details.agentId, undefined);
		assert.equal(manager.getRecordCount(), 0);
		assert.match(background.content[0].text, /disabled/);
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

	it("injects project memory between agent prompt and parent bridge for write-capable agents", async () => {
		const tmp = makeTempProject();
		try {
			const projectRoot = join(tmp.root, "repo");
			const cwd = join(projectRoot, "work");
			mkdirSync(join(projectRoot, ".pi", "agents"), { recursive: true });
			mkdirSync(cwd, { recursive: true });
			const memoryAgent = {
				...generalAgent,
				type: "MemoryWriter",
				prompt: "Memory writer prompt.",
				memory: "project",
			};
			let receivedSystemPrompt = "";
			const calls = [];
			const result = await runForegroundAgent({
				params: {
					subagent_type: "MemoryWriter",
					prompt: "Use memory",
					description: "memory write",
				},
				ctx: { ...makeCtx(), cwd },
				registry: makeRegistry([memoryAgent]),
				createChildSession: async (input) => {
					receivedSystemPrompt = input.systemPrompt;
					return fakeChildSession(
						"memory done",
						calls,
						undefined,
						writableTools(),
					);
				},
			});

			const memoryDir = join(
				projectRoot,
				".pi",
				"agent-memory",
				"MemoryWriter",
			);
			assert.equal(result.details.status, "completed");
			assert.equal(existsSync(memoryDir), true);
			assert.equal(existsSync(join(memoryDir, "MEMORY.md")), false);
			assert.match(
				receivedSystemPrompt,
				/^Memory writer prompt\.\n\n## Agent Memory/,
			);
			assert.match(receivedSystemPrompt, new RegExp(escapeRegExp(memoryDir)));
			assert.ok(
				receivedSystemPrompt.indexOf("## Agent Memory") <
					receivedSystemPrompt.indexOf("## Parent Prompt Bridge"),
			);
			assert.deepEqual(calls[0], [
				"setActiveToolsByName",
				["read", "bash", "edit", "write"],
			]);
		} finally {
			tmp.cleanup();
		}
	});

	it("uses read-only memory fallback without creating missing memory dirs", async () => {
		const tmp = makeTempProject();
		try {
			const cwd = join(tmp.root, "repo");
			mkdirSync(join(cwd, ".pi", "agents"), { recursive: true });
			const readOnlyAgent = {
				...exploreAgent,
				type: "MemoryReader",
				memory: "local",
				tools: { kind: "allow", selectors: [] },
				disallowedTools: [],
			};
			let receivedSystemPrompt = "";
			const calls = [];
			await runForegroundAgent({
				params: {
					subagent_type: "MemoryReader",
					prompt: "Read memory",
					description: "memory read",
				},
				ctx: { ...makeCtx(), cwd },
				registry: makeRegistry([readOnlyAgent]),
				createChildSession: async (input) => {
					receivedSystemPrompt = input.systemPrompt;
					return fakeChildSession(
						"memory read",
						calls,
						undefined,
						writableTools(),
					);
				},
			});

			const memoryDir = join(cwd, ".pi", "agent-memory-local", "MemoryReader");
			assert.equal(existsSync(memoryDir), false);
			assert.match(receivedSystemPrompt, /read-only/);
			assert.match(receivedSystemPrompt, new RegExp(escapeRegExp(memoryDir)));
			assert.deepEqual(calls[0], ["setActiveToolsByName", ["read"]]);
		} finally {
			tmp.cleanup();
		}
	});

	it("injects existing MEMORY.md when read is denied without re-adding read", async () => {
		const tmp = makeTempProject();
		try {
			const agentDir = join(tmp.root, "pi-agent-dir");
			const memoryDir = join(agentDir, "agent-memory", "MemoryNoRead");
			mkdirSync(memoryDir, { recursive: true });
			writeFileSync(
				join(memoryDir, "MEMORY.md"),
				"# Durable note\nUse safe path rules.",
			);
			const noReadAgent = {
				...generalAgent,
				type: "MemoryNoRead",
				memory: "user",
				disallowedTools: [
					{ kind: "builtin", name: "read" },
					{ kind: "builtin", name: "edit" },
					{ kind: "builtin", name: "write" },
				],
			};
			let receivedSystemPrompt = "";
			const calls = [];
			await runForegroundAgent({
				params: {
					subagent_type: "MemoryNoRead",
					prompt: "Use index",
					description: "memory denied read",
				},
				ctx: { ...makeCtx(), cwd: tmp.root, agentDir },
				registry: makeRegistry([noReadAgent]),
				createChildSession: async (input) => {
					receivedSystemPrompt = input.systemPrompt;
					return fakeChildSession(
						"memory no read",
						calls,
						undefined,
						writableTools(),
					);
				},
			});

			assert.match(receivedSystemPrompt, /# Durable note/);
			assert.match(receivedSystemPrompt, /read tool is not available/);
			assert.deepEqual(calls[0], ["setActiveToolsByName", ["bash"]]);
		} finally {
			tmp.cleanup();
		}
	});

	it("rejects symlinked memory dirs before write-capable memory instructions", async () => {
		const tmp = makeTempProject();
		try {
			const projectRoot = join(tmp.root, "repo");
			const cwd = join(projectRoot, "work");
			const outside = join(tmp.root, "outside-memory");
			const memoryParent = join(projectRoot, ".pi", "agent-memory");
			mkdirSync(join(projectRoot, ".pi", "agents"), { recursive: true });
			mkdirSync(cwd, { recursive: true });
			mkdirSync(outside, { recursive: true });
			mkdirSync(memoryParent, { recursive: true });
			symlinkSync(outside, join(memoryParent, "MemorySymlink"));
			const memoryAgent = {
				...generalAgent,
				type: "MemorySymlink",
				memory: "project",
			};
			let receivedSystemPrompt = "";
			await runForegroundAgent({
				params: {
					subagent_type: "MemorySymlink",
					prompt: "Use memory",
					description: "symlink memory",
				},
				ctx: { ...makeCtx(), cwd },
				registry: makeRegistry([memoryAgent]),
				createChildSession: async (input) => {
					receivedSystemPrompt = input.systemPrompt;
					return fakeChildSession(
						"symlink warning",
						[],
						undefined,
						writableTools(),
					);
				},
			});

			assert.match(receivedSystemPrompt, /symlink/);
			assert.doesNotMatch(receivedSystemPrompt, /read and update memory/);
		} finally {
			tmp.cleanup();
		}
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

function makeTempProject() {
	const root = resolve(
		tmpdir(),
		`warden-subagents-runner-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
	);
	mkdirSync(root, { recursive: true });
	return {
		root,
		cleanup() {
			rmSync(root, { recursive: true, force: true });
		},
	};
}

function writableTools() {
	return [
		{ name: "read", sourceInfo: { source: "builtin" } },
		{ name: "bash", sourceInfo: { source: "builtin" } },
		{ name: "edit", sourceInfo: { source: "builtin" } },
		{ name: "write", sourceInfo: { source: "builtin" } },
	];
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function fakeChildSession(
	finalText,
	calls = [],
	promptGate = undefined,
	tools = undefined,
) {
	return {
		getAllTools() {
			return (
				tools ?? [
					{ name: "read", sourceInfo: { source: "builtin" } },
					{ name: "bash", sourceInfo: { source: "builtin" } },
					{ name: "ext_status", sourceInfo: { source: "warden-tools" } },
				]
			);
		},
		setActiveToolsByName(names) {
			calls.push(["setActiveToolsByName", names]);
		},
		async prompt(text) {
			calls.push(["prompt", text]);
			await promptGate;
		},
		getLastAssistantText() {
			return finalText;
		},
		dispose() {},
	};
}
