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
import { buildAgentSystemPrompt } from "./prompts.ts";
import {
	AgentManager,
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

export interface AgentToolDetails {
	status: AgentRunStatus;
	agentId?: string;
	agentType?: string;
	requestedAgentType?: string;
	description?: string;
	activeTools?: string[];
	note?: string;
	error?: string;
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
}

export interface CreateAgentToolDefinitionOptions {
	loadRegistry?: (ctx: Record<string, unknown>) => AgentTypeRegistry;
	createChildSession?: CreateChildSession;
	manager?: AgentManager;
}

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
					runAgent: ({ params: runParams, ctx, registry, signal }) =>
						runForegroundAgent({
							params: runParams,
							ctx,
							registry,
							createChildSession: options.createChildSession,
							signal,
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
	const systemPrompt = buildAgentSystemPrompt({
		agentPrompt: agent.prompt,
		promptMode: agent.promptMode,
		parentSystemPrompt: getParentSystemPrompt(options.ctx),
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
	let unsubscribe: (() => void) | undefined;
	let abortListener: (() => void) | undefined;
	try {
		child = await (options.createChildSession ?? createPiChildSession)({
			cwd: cwdOf(options.ctx),
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

		activeTools = await enforceToolPolicy(child, agent);

		const maxTurnPlan = normalizeMaxTurns(invocation.maxTurns);
		if (maxTurnPlan.limit && child.subscribe) {
			let turns = 0;
			unsubscribe = child.subscribe((event) => {
				if (event.type !== "turn_end") return;
				turns += 1;
				if (turns === maxTurnPlan.limit && child?.steer) {
					steered = true;
					void child.steer(
						"You reached the requested max_turns limit. Wrap up now with final answer and cite any incomplete work.",
					);
				}
				if (
					turns > maxTurnPlan.limit! + maxTurnPlan.graceTurns &&
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
		return {
			content: [{ type: "text", text: `${prefix}${finalText}` }],
			details: {
				status: aborted
					? "aborted"
					: steered && status === "completed"
						? "steered"
						: status,
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
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (aborted || options.signal?.aborted) {
			return textResult("aborted", "Agent aborted.", {
				agentType: agent.type,
				requestedAgentType,
				description: options.params.description,
			});
		}
		return textResult("error", `Agent failed: ${message}`, {
			agentType: agent.type,
			requestedAgentType,
			description: options.params.description,
			error: message,
		});
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

async function enforceToolPolicy(
	child: ChildSessionLike,
	agent: AgentTypeConfig,
): Promise<string[]> {
	const allTools = child.getAllTools?.() ?? [];
	const names = applyDisallowedTools(
		resolveAllowedToolNames(agent.tools, allTools),
		agent.disallowedTools,
		allTools,
	);
	if (child.setActiveToolsByName) {
		await child.setActiveToolsByName(names);
	} else if (child.setActiveTools) {
		await child.setActiveTools(names);
	}
	return names;
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
