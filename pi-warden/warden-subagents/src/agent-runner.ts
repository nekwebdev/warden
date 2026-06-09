import {
	createAgentSession,
	DefaultResourceLoader,
	getAgentDir,
	SessionManager,
	type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { buildTaskPrompt } from "./context.ts";
import { enforceAllowedModelScope } from "./enabled-models.ts";
import {
	normalizeMaxTurns,
	resolveForegroundInvocation,
	type ForegroundAgentParams,
} from "./invocation-config.ts";
import { resolveModelRequest } from "./model-resolver.ts";
import {
	buildAgentMemoryPromptBlock,
	buildAgentMemoryWarningBlock,
	ensureWritableMemoryDirectory,
	readMemoryIndex,
	resolveAgentMemoryDirectory,
} from "./memory.ts";
import { buildAgentSystemPrompt } from "./prompts.ts";
import { renderAgentCall, renderAgentResult } from "./ui/agent-renderer.ts";
import {
	buildWorktreePromptExtra,
	completeWorktreeIsolation,
	createWorktreeIsolation,
	type WorktreeDetails,
	type WorktreeIsolationPlan,
} from "./worktree.ts";
import { extractPassiveUsage, type PassiveUsageSnapshot } from "./usage.ts";
import {
	AgentManager,
	type AgentActivityUpdate,
	type AgentToolResultLike,
	createGetSubagentResultToolDefinition,
} from "./agent-manager.ts";
import { loadAgentTypes, resolveAgentType } from "./agent-types.ts";
import type {
	AgentTypeConfig,
	AgentTypeRegistry,
	ToolPolicy,
	ToolSelector,
} from "./types.ts";

export type AgentRunStatus =
	| "queued"
	| "running"
	| "completed"
	| "fallback"
	| "disabled"
	| "unsupported"
	| "steered"
	| "aborted"
	| "error";

export interface AgentToolDetails extends PassiveUsageSnapshot {
	status: AgentRunStatus;
	agentId?: string;
	agentType?: string;
	requestedAgentType?: string;
	description?: string;
	activeTools?: string[];
	note?: string;
	error?: string;
	worktree?: WorktreeDetails;
}

export interface AgentToolResult {
	content: Array<{ type: "text"; text: string }>;
	details: AgentToolDetails;
}

interface ToolLike {
	name: string;
	sourceInfo?: {
		source?: string;
		path?: string;
		baseDir?: string;
	};
}

interface ChildSessionLike {
	getAllTools?: () => ToolLike[];
	setActiveToolsByName?: (names: string[]) => void | Promise<void>;
	setActiveTools?: (names: string[]) => void | Promise<void>;
	prompt: (text: string) => Promise<void>;
	steer?: (text: string) => Promise<void>;
	abort?: () => Promise<void>;
	subscribe?: (
		listener: (event: Record<string, unknown>) => void,
	) => () => void;
	getLastAssistantText?: () => string | undefined;
	messages?: Array<Record<string, unknown>>;
	dispose?: () => void;
}

export type CreateChildSession = (input: {
	cwd: string;
	systemPrompt: string;
	model?: unknown;
	thinking?: string;
	signal?: AbortSignal;
	ctx: Record<string, unknown>;
}) => Promise<ChildSessionLike>;

export interface RunForegroundAgentOptions {
	params: ForegroundAgentParams;
	ctx: Record<string, unknown>;
	registry?: AgentTypeRegistry;
	createChildSession?: CreateChildSession;
	signal?: AbortSignal;
	onActivity?: (update: AgentActivityUpdate) => void;
	runIdFactory?: () => string;
	runId?: string;
}

export interface CreateAgentToolDefinitionOptions {
	loadRegistry?: (ctx: Record<string, unknown>) => AgentTypeRegistry;
	createChildSession?: CreateChildSession;
	manager?: AgentManager;
}

interface AgentMemoryPromptPlan {
	block: string;
	shouldEnsureRead: boolean;
}

const STANDARD_BUILTIN_TOOLS: ToolLike[] = [
	{ name: "read", sourceInfo: { source: "builtin" } },
	{ name: "bash", sourceInfo: { source: "builtin" } },
	{ name: "edit", sourceInfo: { source: "builtin" } },
	{ name: "write", sourceInfo: { source: "builtin" } },
	{ name: "grep", sourceInfo: { source: "builtin" } },
	{ name: "find", sourceInfo: { source: "builtin" } },
	{ name: "ls", sourceInfo: { source: "builtin" } },
];

const AGENT_PARAMETERS_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: ["prompt"],
	properties: {
		subagent_type: {
			type: "string",
			description:
				"Agent type to run. Unknown values fall back to general-purpose.",
		},
		prompt: { type: "string", description: "Task prompt for child agent." },
		description: {
			type: "string",
			description: "Short human-readable delegated task description.",
		},
		model: {
			type: "string",
			description:
				"Optional model request such as provider/modelId, haiku, or sonnet.",
		},
		thinking: {
			type: "string",
			enum: ["off", "minimal", "low", "medium", "high", "xhigh"],
			description: "Optional child thinking level. Agent frontmatter wins.",
		},
		max_turns: {
			type: "integer",
			minimum: 1,
			description:
				"Optional turn limit before wrap-up steer and 3 grace turns.",
		},
		run_in_background: {
			type: "boolean",
			description:
				"When true, start the agent in background and return an agent id immediately.",
		},
		resume: {
			type: "string",
			description: "Reserved for later slices; rejected in foreground mode.",
		},
		isolated: {
			type: "boolean",
			description:
				"Compatibility field; cannot override selected agent isolation in this slice.",
		},
		inherit_context: {
			type: "boolean",
			description:
				"Request parent conversation bridge when selected agent allows it.",
		},
		isolation: {
			type: "string",
			description:
				"Compatibility field; cannot override selected agent isolation in this slice.",
		},
	},
};

export function createAgentToolDefinition(
	options: CreateAgentToolDefinitionOptions = {},
) {
	return {
		name: "Agent",
		label: "Agent",
		description:
			"Delegate a task to a Warden subagent. Foreground returns final text inline; run_in_background returns an agent id immediately for get_subagent_result.",
		promptSnippet:
			"Delegate work to a Warden subagent with Agent; use run_in_background for asynchronous work that should return an id immediately.",
		promptGuidelines: [
			"Agent with run_in_background: true returns an agent id immediately; use get_subagent_result with wait: true for completion instead of sleep or poll loops.",
			"Agent accepts subagent_type, prompt, description, model, thinking, max_turns, run_in_background, resume, isolated, inherit_context, and isolation.",
		],
		parameters: AGENT_PARAMETERS_SCHEMA,
		renderCall: renderAgentCall,
		renderResult: renderAgentResult,
		async execute(
			_toolCallId: string,
			params: ForegroundAgentParams,
			signal?: AbortSignal,
			_onUpdate?: unknown,
			ctx?: Record<string, unknown>,
		): Promise<AgentToolResult> {
			const safeCtx = ctx ?? {};
			const registry =
				options.loadRegistry?.(safeCtx) ??
				loadAgentTypes({ cwd: String(safeCtx.cwd ?? process.cwd()) });
			if (params.run_in_background === true) {
				if (!options.manager) {
					return textResult(
						"error",
						"Background Agent manager is unavailable. No background agent started.",
						{ error: "Background Agent manager is unavailable." },
					);
				}
				return options.manager.start({
					params,
					ctx: safeCtx,
					registry,
					signal,
					runAgent: ({
						params: runParams,
						ctx,
						registry,
						signal,
						onActivity,
						agentId,
					}) =>
						runForegroundAgent({
							params: runParams,
							ctx,
							registry,
							createChildSession: options.createChildSession,
							signal,
							onActivity,
							runId: agentId,
						}) as Promise<AgentToolResultLike>,
				}) as AgentToolResult;
			}
			return runForegroundAgent({
				params,
				ctx: safeCtx,
				registry,
				createChildSession: options.createChildSession,
				signal,
			});
		},
	};
}

export async function runForegroundAgent(
	options: RunForegroundAgentOptions,
): Promise<AgentToolResult> {
	const requestedAgentType = options.params.subagent_type || "general-purpose";
	if (options.params.resume) {
		return textResult(
			"unsupported",
			"Agent foreground slice does not support resume. No child session started.",
			{ requestedAgentType },
		);
	}

	const resolution = resolveAgentType(
		options.registry ?? loadAgentTypes({ cwd: cwdOf(options.ctx) }),
		requestedAgentType,
	);
	if (resolution.status === "disabled") {
		return textResult(
			"disabled",
			`Agent type "${requestedAgentType}" is disabled. No child session started.`,
			{ requestedAgentType },
		);
	}

	let status: AgentRunStatus = "completed";
	let note: string | undefined;
	let agent: AgentTypeConfig;
	if (resolution.status === "unknown") {
		const fallback = resolveAgentType(
			options.registry ?? loadAgentTypes({ cwd: cwdOf(options.ctx) }),
			"general-purpose",
		);
		if (fallback.status !== "found") {
			return textResult(
				"error",
				`Unknown agent type "${requestedAgentType}" and general-purpose fallback is unavailable.`,
				{ requestedAgentType },
			);
		}
		status = "fallback";
		note = `Unknown agent type "${requestedAgentType}"; using general-purpose.`;
		agent = fallback.agent;
	} else {
		agent = resolution.agent;
	}

	const invocation = resolveForegroundInvocation({
		agent,
		params: options.params,
	});
	const modelResolution = resolveModelRequest(
		invocation.modelRequest,
		modelRegistryOf(options.ctx),
	);
	const scopedModel =
		modelResolution.status === "resolved"
			? enforceAllowedModelScope({ model: modelResolution.model })
			: undefined;
	const memoryPromptPlan = buildMemoryPromptPlan({
		agent,
		cwd: cwdOf(options.ctx),
		agentDir: agentDirOf(options.ctx),
	});
	let worktree: WorktreeIsolationPlan | undefined;
	if (options.params.isolation === "worktree") {
		try {
			worktree = createWorktreeIsolation({
				cwd: cwdOf(options.ctx),
				runId: options.runId ?? options.runIdFactory?.() ?? defaultRunId(),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(
				"error",
				`Agent worktree isolation failed: ${message}`,
				{
					agentType: agent.type,
					requestedAgentType,
					description: options.params.description,
					error: message,
				},
			);
		}
	}
	const promptExtras = [
		...(memoryPromptPlan ? [memoryPromptPlan.block] : []),
		...(worktree ? [buildWorktreePromptExtra(worktree)] : []),
	];
	const systemPrompt = buildAgentSystemPrompt({
		agentPrompt: agent.prompt,
		promptMode: agent.promptMode,
		parentSystemPrompt: getParentSystemPrompt(options.ctx),
		promptExtras: promptExtras.length > 0 ? promptExtras : undefined,
	});
	const taskPrompt = buildTaskPrompt({
		prompt: invocation.prompt,
		inheritContext: invocation.inheritContext,
		parentEntries: parentEntriesOf(options.ctx),
	});

	let child: ChildSessionLike | undefined;
	let activeTools: string[] = [];
	let steered = false;
	let aborted = false;
	let turns = 0;
	let toolUses = 0;
	let latestActivity: PassiveUsageSnapshot = {};
	let unsubscribe: (() => void) | undefined;
	let abortListener: (() => void) | undefined;
	try {
		child = await (options.createChildSession ?? createPiChildSession)({
			cwd: worktree?.childCwd ?? cwdOf(options.ctx),
			systemPrompt,
			model: scopedModel?.status === "allowed" ? scopedModel.model : undefined,
			thinking: invocation.thinking,
			signal: options.signal,
			ctx: options.ctx,
		});

		abortListener = () => {
			aborted = true;
			void child?.abort?.();
		};
		if (options.signal?.aborted) abortListener();
		else
			options.signal?.addEventListener("abort", abortListener, { once: true });

		activeTools = await enforceToolPolicy(child, agent, {
			ensureRead: memoryPromptPlan?.shouldEnsureRead ?? false,
		});
		options.onActivity?.({
			currentActivity: "child session ready",
			maxTurns: invocation.maxTurns,
		});

		const maxTurnPlan = normalizeMaxTurns(invocation.maxTurns);
		if (child.subscribe && (maxTurnPlan.limit || options.onActivity)) {
			unsubscribe = child.subscribe((event) => {
				const eventActivity = activityFromChildEvent(event, {
					turns,
					toolUses,
					maxTurns: invocation.maxTurns,
				});
				if (event.type === "turn_end") turns += 1;
				if (event.type === "tool_execution_start") toolUses += 1;
				latestActivity = {
					...latestActivity,
					...eventActivity,
					turnCount:
						event.type === "turn_end" ? turns : eventActivity.turnCount,
					toolUseCount:
						event.type === "tool_execution_start"
							? toolUses
							: eventActivity.toolUseCount,
				};
				options.onActivity?.(latestActivity);
				if (event.type !== "turn_end") return;
				if (turns === maxTurnPlan.limit && child?.steer) {
					steered = true;
					void child.steer(
						"You reached the requested max_turns limit. Wrap up now with final answer and cite any incomplete work.",
					);
				}
				if (
					maxTurnPlan.limit &&
					turns > maxTurnPlan.limit + maxTurnPlan.graceTurns &&
					child?.abort
				) {
					aborted = true;
					void child.abort();
				}
			});
		}

		await child.prompt(taskPrompt);
		const finalText =
			getFinalAssistantText(child) ||
			"Agent completed without final assistant text.";
		const prefix = note ? `${note}\n\n` : "";
		const finalStatus = aborted
			? "aborted"
			: steered && status === "completed"
				? "steered"
				: status;
		return finalizeWorktreeResult(
			{
				content: [{ type: "text", text: `${prefix}${finalText}` }],
				details: {
					...latestActivity,
					status: finalStatus,
					agentType: agent.type,
					requestedAgentType,
					description: options.params.description,
					activeTools,
					note:
						note ??
						(modelResolution.status === "unresolved"
							? modelResolution.note
							: undefined),
				},
			},
			{ worktree, agentType: agent.type },
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (aborted || options.signal?.aborted) {
			return finalizeWorktreeResult(
				textResult("aborted", "Agent aborted.", {
					agentType: agent.type,
					requestedAgentType,
					description: options.params.description,
				}),
				{ worktree, agentType: agent.type },
			);
		}
		return finalizeWorktreeResult(
			textResult("error", `Agent failed: ${message}`, {
				agentType: agent.type,
				requestedAgentType,
				description: options.params.description,
				error: message,
			}),
			{ worktree, agentType: agent.type },
		);
	} finally {
		unsubscribe?.();
		if (abortListener) {
			options.signal?.removeEventListener("abort", abortListener);
		}
		child?.dispose?.();
	}
}

export function wardenSubagentsRegister(
	pi: Pick<ExtensionAPI, "registerTool">,
	options: { manager?: AgentManager } = {},
): void {
	const manager = options.manager ?? new AgentManager();
	pi.registerTool(
		createAgentToolDefinition({ manager }) as unknown as Parameters<
			ExtensionAPI["registerTool"]
		>[0],
	);
	pi.registerTool(
		createGetSubagentResultToolDefinition({ manager }) as unknown as Parameters<
			ExtensionAPI["registerTool"]
		>[0],
	);
}

function finalizeWorktreeResult(
	result: AgentToolResult,
	input: { worktree?: WorktreeIsolationPlan; agentType: string },
): AgentToolResult {
	if (!input.worktree) return result;
	const completion = completeWorktreeIsolation({
		plan: input.worktree,
		status: result.details.status as Extract<
			AgentRunStatus,
			"completed" | "fallback" | "steered" | "aborted" | "error"
		>,
		description: result.details.description,
		agentType: input.agentType,
	});
	const text = result.content[0]?.text ?? "";
	if (completion.status === "failed") {
		return {
			content: [
				{
					type: "text",
					text: `${completion.note}\n\nChild result before persistence failure:\n${text}`,
				},
			],
			details: {
				...result.details,
				status: "error",
				error: completion.error,
				worktree: completion.details,
			},
		};
	}
	return {
		content: [
			{
				type: "text",
				text: [text, completion.note].filter(Boolean).join("\n\n"),
			},
		],
		details: { ...result.details, worktree: completion.details },
	};
}

function defaultRunId(): string {
	return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createPiChildSession(input: {
	cwd: string;
	systemPrompt: string;
	model?: unknown;
	thinking?: string;
	signal?: AbortSignal;
	ctx: Record<string, unknown>;
}): Promise<ChildSessionLike> {
	const agentDir =
		typeof input.ctx.agentDir === "string" ? input.ctx.agentDir : getAgentDir();
	const loader = new DefaultResourceLoader({
		cwd: input.cwd,
		agentDir,
		systemPromptOverride: () => input.systemPrompt,
		appendSystemPromptOverride: () => [],
	});
	await loader.reload();
	const result = await createAgentSession({
		cwd: input.cwd,
		agentDir,
		resourceLoader: loader,
		sessionManager: SessionManager.inMemory(input.cwd),
		model: input.model as never,
		thinkingLevel: input.thinking as never,
	});
	return result.session as unknown as ChildSessionLike;
}

function activityFromChildEvent(
	event: Record<string, unknown>,
	state: { turns: number; toolUses: number; maxTurns?: number },
): PassiveUsageSnapshot {
	const passive = extractPassiveUsage(event);
	const type = typeof event.type === "string" ? event.type : undefined;
	const toolName =
		typeof event.toolName === "string" ? event.toolName : undefined;
	return {
		...passive,
		turnCount: type === "turn_end" ? state.turns + 1 : passive.turnCount,
		maxTurns: passive.maxTurns ?? state.maxTurns,
		toolUseCount:
			type === "tool_execution_start"
				? state.toolUses + 1
				: passive.toolUseCount,
		currentActivity:
			passive.currentActivity ??
			(type === "tool_execution_start" && toolName
				? `using ${toolName}`
				: undefined),
	};
}

async function enforceToolPolicy(
	child: ChildSessionLike,
	agent: AgentTypeConfig,
	options: { ensureRead?: boolean } = {},
): Promise<string[]> {
	const allTools = child.getAllTools?.() ?? [];
	const names = maybeAddReadTool(
		applyDisallowedTools(
			resolveAllowedToolNames(agent.tools, allTools),
			agent.disallowedTools,
			allTools,
		),
		{ allTools, ensureRead: options.ensureRead === true },
	);
	if (child.setActiveToolsByName) {
		await child.setActiveToolsByName(names);
	} else if (child.setActiveTools) {
		await child.setActiveTools(names);
	}
	return names;
}

function buildMemoryPromptPlan(input: {
	agent: AgentTypeConfig;
	cwd: string;
	agentDir?: string;
}): AgentMemoryPromptPlan | undefined {
	if (!input.agent.memory) return undefined;
	const directory = resolveAgentMemoryDirectory({
		cwd: input.cwd,
		agentDir: input.agentDir,
		agentType: input.agent.type,
		scope: input.agent.memory,
	});
	if (directory.status === "disabled") {
		return {
			block: buildAgentMemoryWarningBlock(directory.warning),
			shouldEnsureRead: false,
		};
	}

	const effectiveBuiltinNames = applyDisallowedTools(
		resolveAllowedToolNames(input.agent.tools, STANDARD_BUILTIN_TOOLS),
		input.agent.disallowedTools,
		STANDARD_BUILTIN_TOOLS,
	);
	const readDenied = isBuiltinToolDenied("read", input.agent.disallowedTools);
	const access = hasMemoryWriteCapability(effectiveBuiltinNames)
		? "read-write"
		: "read-only";
	if (access === "read-write") {
		const writeWarning = ensureWritableMemoryDirectory(directory.directory);
		if (writeWarning) {
			return {
				block: buildAgentMemoryWarningBlock(writeWarning),
				shouldEnsureRead: false,
			};
		}
	}

	return {
		block: buildAgentMemoryPromptBlock({
			directory: directory.directory,
			access,
			readToolAvailable: !readDenied,
			index: readMemoryIndex(directory.directory),
		}),
		shouldEnsureRead: !readDenied,
	};
}

function hasMemoryWriteCapability(names: string[]): boolean {
	return names.includes("write") || names.includes("edit");
}

function maybeAddReadTool(
	names: string[],
	options: { allTools: ToolLike[]; ensureRead: boolean },
): string[] {
	if (!options.ensureRead || names.includes("read")) return names;
	const hasReadTool = options.allTools.some(
		(tool) => tool.name === "read" && tool.sourceInfo?.source === "builtin",
	);
	return hasReadTool ? unique([...names, "read"]) : names;
}

function isBuiltinToolDenied(
	name: string,
	disallowed: ToolSelector[],
): boolean {
	return disallowed.some(
		(selector) => selector.kind === "builtin" && selector.name === name,
	);
}

function resolveAllowedToolNames(
	policy: ToolPolicy,
	allTools: ToolLike[],
): string[] {
	if (policy.kind === "none") return [];
	if (policy.kind === "all") return unique(allTools.map((tool) => tool.name));
	if (policy.kind === "default") return ["read", "bash", "edit", "write"];
	return unique(
		allTools
			.filter((tool) =>
				policy.selectors.some((selector) =>
					selectorMatchesTool(selector, tool),
				),
			)
			.map((tool) => tool.name),
	);
}

function applyDisallowedTools(
	names: string[],
	disallowed: ToolSelector[],
	allTools: ToolLike[],
): string[] {
	if (disallowed.length === 0) return names;
	const blocked = new Set(
		allTools
			.filter((tool) =>
				disallowed.some((selector) => selectorMatchesTool(selector, tool)),
			)
			.map((tool) => tool.name),
	);
	return names.filter((name) => !blocked.has(name));
}

function selectorMatchesTool(selector: ToolSelector, tool: ToolLike): boolean {
	if (selector.kind === "builtin") {
		return tool.name === selector.name && tool.sourceInfo?.source === "builtin";
	}
	if (selector.kind === "extension-tool") {
		return (
			tool.name === selector.tool ||
			tool.name === `${selector.extension}/${selector.tool}`
		);
	}
	return (
		sourceMatches(selector.extension, tool.sourceInfo) &&
		tool.sourceInfo?.source !== "builtin"
	);
}

function sourceMatches(
	extension: string,
	sourceInfo?: ToolLike["sourceInfo"],
): boolean {
	if (!sourceInfo) return false;
	return [sourceInfo.source, sourceInfo.path, sourceInfo.baseDir]
		.filter((value): value is string => typeof value === "string")
		.some((value) => value.includes(extension));
}

function getFinalAssistantText(child: ChildSessionLike): string | undefined {
	const direct = child.getLastAssistantText?.();
	if (direct) return direct;
	const lastAssistant = [...(child.messages ?? [])]
		.reverse()
		.find((message) => message.role === "assistant");
	return extractMessageText(lastAssistant?.content);
}

function textResult(
	status: AgentRunStatus,
	text: string,
	details: Omit<AgentToolDetails, "status"> = {},
): AgentToolResult {
	return {
		content: [{ type: "text", text }],
		details: { status, ...details },
	};
}

function cwdOf(ctx: Record<string, unknown>): string {
	return typeof ctx.cwd === "string" ? ctx.cwd : process.cwd();
}

function getParentSystemPrompt(
	ctx: Record<string, unknown>,
): string | undefined {
	const getter = ctx.getSystemPrompt;
	return typeof getter === "function" ? String(getter.call(ctx)) : undefined;
}

function parentEntriesOf(
	ctx: Record<string, unknown>,
): Array<Record<string, unknown>> {
	const sessionManager = ctx.sessionManager as
		| { getBranch?: () => Array<Record<string, unknown>> }
		| undefined;
	return sessionManager?.getBranch?.() ?? [];
}

function modelRegistryOf(ctx: Record<string, unknown>) {
	return ctx.modelRegistry as Parameters<typeof resolveModelRequest>[1];
}

function agentDirOf(ctx: Record<string, unknown>): string | undefined {
	return typeof ctx.agentDir === "string" ? ctx.agentDir : undefined;
}

function extractMessageText(content: unknown): string | undefined {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return undefined;
	const text = content
		.map((part) => {
			if (!part || typeof part !== "object") return "";
			const value = (part as Record<string, unknown>).text;
			return typeof value === "string" ? value : "";
		})
		.filter(Boolean)
		.join("\n");
	return text || undefined;
}

function unique(values: string[]): string[] {
	return [...new Set(values)];
}
