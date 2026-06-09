import type {
	AgentManager,
	AgentToolResultLike,
	BackgroundRunAgent,
} from "./agent-manager.ts";
import { loadAgentTypes as loadAgentTypesDefault } from "./agent-types.ts";
import type { ForegroundAgentParams } from "./invocation-config.ts";
import {
	resolveModelRequest,
	type ModelRegistryLike,
} from "./model-resolver.ts";
import { runForegroundAgent } from "./agent-runner.ts";
import type { AgentTypeRegistry } from "./types.ts";

export const PROTOCOL_VERSION = 2;

export type RpcEnvelope<T = unknown> =
	| { success: true; data?: T }
	| { success: false; error: string };

export interface EventBusLike {
	on(
		channel: string,
		handler: (payload: unknown) => void | Promise<void>,
	): () => void;
	emit(channel: string, payload: unknown): void;
}

export interface RegisterSubagentsRpcOptions {
	events: EventBusLike;
	manager: AgentManager;
	getCtx: () => Record<string, unknown> | undefined;
	loadRegistry?: (input: { cwd: string }) => AgentTypeRegistry;
	runAgent?: BackgroundRunAgent;
}

interface RpcRequest {
	requestId?: unknown;
}

interface SpawnRequest extends RpcRequest {
	type?: unknown;
	prompt?: unknown;
	options?: Record<string, unknown>;
}

interface StopRequest extends RpcRequest {
	agentId?: unknown;
}

const CHANNELS = {
	ping: "subagents:rpc:ping",
	spawn: "subagents:rpc:spawn",
	stop: "subagents:rpc:stop",
} as const;

export function registerSubagentsRpc(
	options: RegisterSubagentsRpcOptions,
): () => void {
	const unsubscribes = [
		options.events.on(CHANNELS.ping, (payload) => {
			const request = asRecord(payload) as RpcRequest | undefined;
			reply(options.events, CHANNELS.ping, request?.requestId, {
				success: true,
				data: { version: PROTOCOL_VERSION },
			});
		}),
		options.events.on(CHANNELS.spawn, async (payload) => {
			const request = asRecord(payload) as SpawnRequest | undefined;
			await handleSpawn(options, request);
		}),
		options.events.on(CHANNELS.stop, (payload) => {
			const request = asRecord(payload) as StopRequest | undefined;
			handleStop(options, request);
		}),
	];
	options.events.emit("subagents:ready", {});
	return () => {
		for (const unsubscribe of unsubscribes.splice(0)) unsubscribe();
	};
}

async function handleSpawn(
	options: RegisterSubagentsRpcOptions,
	request: SpawnRequest | undefined,
): Promise<void> {
	const requestId = request?.requestId;
	const ctx = options.getCtx();
	if (!ctx) {
		reply(options.events, CHANNELS.spawn, requestId, {
			success: false,
			error: "No active session",
		});
		return;
	}
	const type = stringOr(request?.type, "general-purpose");
	const prompt =
		typeof request?.prompt === "string" ? request.prompt : undefined;
	if (!prompt) {
		reply(options.events, CHANNELS.spawn, requestId, {
			success: false,
			error: "Spawn prompt is required.",
		});
		return;
	}
	const model = resolveRpcModel(
		stringOr(request?.options?.model, undefined),
		modelRegistryOf(ctx),
	);
	if (model.status === "error") {
		reply(options.events, CHANNELS.spawn, requestId, {
			success: false,
			error: model.error,
		});
		return;
	}
	const cwd = String(ctx.cwd ?? process.cwd());
	const registry = (options.loadRegistry ?? loadAgentTypesDefault)({ cwd });
	const params: ForegroundAgentParams = {
		subagent_type: type,
		prompt,
		description: stringOr(request?.options?.description, prompt),
		run_in_background: true,
	};
	if (model.status === "resolved") params.model = model.model;
	if (typeof request?.options?.thinking === "string") {
		params.thinking = request.options
			.thinking as ForegroundAgentParams["thinking"];
	}
	if (typeof request?.options?.max_turns === "number") {
		params.max_turns = request.options.max_turns;
	}
	const launch = options.manager.start({
		params,
		ctx,
		registry,
		runAgent:
			options.runAgent ??
			((input) => runForegroundAgent(input) as Promise<AgentToolResultLike>),
	});
	if (!launch.details.agentId || launch.details.status === "error") {
		reply(options.events, CHANNELS.spawn, requestId, {
			success: false,
			error: launch.details.error ?? launch.content[0]?.text ?? "Spawn failed.",
		});
		return;
	}
	reply(options.events, CHANNELS.spawn, requestId, {
		success: true,
		data: {
			id: launch.details.agentId,
			status: launch.details.status,
			type: launch.details.agentType ?? type,
			description: launch.details.description,
		},
	});
}

function handleStop(
	options: RegisterSubagentsRpcOptions,
	request: StopRequest | undefined,
): void {
	const agentId = typeof request?.agentId === "string" ? request.agentId : "";
	if (!agentId) {
		reply(options.events, CHANNELS.stop, request?.requestId, {
			success: false,
			error: "agentId is required.",
		});
		return;
	}
	const result = options.manager.stop(agentId);
	if (result.details.status === "error") {
		reply(options.events, CHANNELS.stop, request?.requestId, {
			success: false,
			error: result.details.error ?? result.content[0]?.text ?? "Stop failed.",
		});
		return;
	}
	reply(options.events, CHANNELS.stop, request?.requestId, {
		success: true,
		data: { id: agentId, status: result.details.status },
	});
}

function reply<T>(
	events: EventBusLike,
	channel: string,
	requestId: unknown,
	envelope: RpcEnvelope<T>,
): void {
	if (typeof requestId !== "string" || requestId.length === 0) return;
	events.emit(`${channel}:reply:${requestId}`, envelope);
}

function resolveRpcModel(
	request: string | undefined,
	registry: ModelRegistryLike | undefined,
):
	| { status: "omitted" }
	| { status: "resolved"; model: string }
	| { status: "error"; error: string } {
	const value = request?.trim();
	if (!value) return { status: "omitted" };
	const slash = value.indexOf("/");
	if (slash > 0 && slash < value.length - 1) {
		const provider = value.slice(0, slash);
		const id = value.slice(slash + 1);
		const found =
			registry?.find?.(provider, id) ??
			(registry?.getAll?.() ?? registry?.models ?? []).find(
				(model) => model.provider === provider && model.id === id,
			);
		if (found)
			return { status: "resolved", model: `${found.provider}/${found.id}` };
		return {
			status: "error",
			error: `Model "${value}" could not be resolved.`,
		};
	}
	const resolved = resolveModelRequest(value, registry);
	if (resolved.status === "resolved") {
		return {
			status: "resolved",
			model: `${resolved.model.provider}/${resolved.model.id}`,
		};
	}
	return { status: "error", error: `Model "${value}" could not be resolved.` };
}

function modelRegistryOf(
	ctx: Record<string, unknown>,
): ModelRegistryLike | undefined {
	const registry = ctx.modelRegistry;
	if (!registry || typeof registry !== "object") return undefined;
	return registry as ModelRegistryLike;
}

function stringOr(value: unknown, fallback: string): string;
function stringOr(value: unknown, fallback: undefined): string | undefined;
function stringOr(
	value: unknown,
	fallback: string | undefined,
): string | undefined {
	return typeof value === "string" && value.trim() ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === "object"
		? (value as Record<string, unknown>)
		: undefined;
}
