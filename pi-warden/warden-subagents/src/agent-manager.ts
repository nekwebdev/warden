import { resolveAgentType } from "./agent-types.ts";
import type { ForegroundAgentParams } from "./invocation-config.ts";
import type { AgentTypeRegistry } from "./types.ts";

export type BackgroundAgentStatus =
	| "queued"
	| "running"
	| "completed"
	| "error"
	| "aborted";

export interface AgentToolDetailsLike {
	status: string;
	agentId?: string;
	agentType?: string;
	requestedAgentType?: string;
	description?: string;
	activeTools?: string[];
	note?: string;
	error?: string;
}

export interface AgentToolResultLike {
	content: Array<{ type: "text"; text: string }>;
	details: AgentToolDetailsLike;
}

export type BackgroundRunAgent = (input: {
	params: ForegroundAgentParams;
	ctx: Record<string, unknown>;
	registry: AgentTypeRegistry;
	signal: AbortSignal;
}) => Promise<AgentToolResultLike>;

export interface StartBackgroundAgentOptions {
	params: ForegroundAgentParams;
	ctx: Record<string, unknown>;
	registry: AgentTypeRegistry;
	runAgent: BackgroundRunAgent;
	signal?: AbortSignal;
}

export interface GetSubagentResultParams {
	agent_id: string;
	wait?: boolean;
}

export interface AgentManagerOptions {
	maxConcurrency?: number;
	idFactory?: () => string;
}

interface BackgroundRecord {
	id: string;
	status: BackgroundAgentStatus;
	params: ForegroundAgentParams;
	ctx: Record<string, unknown>;
	registry: AgentTypeRegistry;
	runAgent: BackgroundRunAgent;
	requestedAgentType: string;
	agentType: string;
	description?: string;
	note?: string;
	controller: AbortController;
	parentSignal?: AbortSignal;
	parentAbortListener?: () => void;
	result?: AgentToolResultLike;
	waiters: Array<(result: AgentToolResultLike) => void>;
}

const GET_SUBAGENT_RESULT_PARAMETERS_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: ["agent_id"],
	properties: {
		agent_id: {
			type: "string",
			description: "Background agent id returned by Agent.",
		},
		wait: {
			type: "boolean",
			description:
				"When true, wait until the background agent reaches completed, error, or aborted.",
		},
	},
};

export class AgentManager {
	readonly maxConcurrency: number;
	private readonly idFactory: () => string;
	private readonly records = new Map<string, BackgroundRecord>();
	private readonly queue: string[] = [];
	private readonly runningIds = new Set<string>();
	private nextId = 1;

	constructor(options: AgentManagerOptions = {}) {
		this.maxConcurrency = Math.max(1, options.maxConcurrency ?? 4);
		this.idFactory = options.idFactory ?? (() => `agent-${this.nextId++}`);
	}

	start(options: StartBackgroundAgentOptions): AgentToolResultLike {
		const requestedAgentType =
			options.params.subagent_type || "general-purpose";
		const resolution = resolveAgentType(options.registry, requestedAgentType);
		if (resolution.status === "disabled") {
			return textResult(
				"disabled",
				`Agent type "${requestedAgentType}" is disabled. No background agent started.`,
				{ requestedAgentType },
			);
		}

		let agentType = requestedAgentType;
		let note: string | undefined;
		if (resolution.status === "unknown") {
			const fallback = resolveAgentType(options.registry, "general-purpose");
			if (fallback.status !== "found") {
				return textResult(
					"error",
					`Unknown agent type "${requestedAgentType}" and general-purpose fallback is unavailable.`,
					{
						requestedAgentType,
						error: `Unknown agent type "${requestedAgentType}" and general-purpose fallback is unavailable.`,
					},
				);
			}
			agentType = fallback.agent.type;
			note = `Unknown agent type "${requestedAgentType}"; using general-purpose.`;
		} else {
			agentType = resolution.agent.type;
		}

		const record: BackgroundRecord = {
			id: this.idFactory(),
			status: "queued",
			params: { ...options.params, run_in_background: false },
			ctx: options.ctx,
			registry: options.registry,
			runAgent: options.runAgent,
			requestedAgentType,
			agentType,
			description: options.params.description,
			note,
			controller: new AbortController(),
			parentSignal: options.signal,
			waiters: [],
		};

		this.records.set(record.id, record);
		this.queue.push(record.id);
		this.attachParentAbort(record);
		this.schedule();
		return this.launchResult(record);
	}

	getResult(params: GetSubagentResultParams): AgentToolResultLike {
		const record = this.records.get(params.agent_id);
		if (!record) return unknownIdResult(params.agent_id);
		return record.result ?? this.nonTerminalResult(record);
	}

	async waitForResult(
		params: GetSubagentResultParams,
		signal?: AbortSignal,
	): Promise<AgentToolResultLike> {
		const record = this.records.get(params.agent_id);
		if (!record) return unknownIdResult(params.agent_id);
		if (!params.wait || isTerminal(record.status))
			return this.getResult(params);
		if (signal?.aborted) return this.waitAbortedResult(record);

		return new Promise((resolve) => {
			const waitSignal = signal;
			let settled = false;
			const waiter = (result: AgentToolResultLike) => finish(result);
			const removeWaiter = () => {
				const index = record.waiters.indexOf(waiter);
				if (index >= 0) record.waiters.splice(index, 1);
			};
			const finish = (result: AgentToolResultLike) => {
				if (settled) return;
				settled = true;
				removeWaiter();
				if (waitSignal && onAbort) {
					waitSignal.removeEventListener("abort", onAbort);
				}
				resolve(result);
			};
			const onAbort = waitSignal
				? () => finish(this.waitAbortedResult(record))
				: undefined;
			record.waiters.push(waiter);
			if (waitSignal && onAbort) {
				waitSignal.addEventListener("abort", onAbort, { once: true });
			}
		});
	}

	shutdown(): void {
		for (const record of this.records.values()) {
			if (!isTerminal(record.status)) {
				this.markAborted(
					record,
					"Background agent aborted during session shutdown.",
				);
			}
		}
		this.queue.length = 0;
		this.runningIds.clear();
		this.records.clear();
	}

	getRecordCount(): number {
		return this.records.size;
	}

	private schedule(): void {
		while (
			this.runningIds.size < this.maxConcurrency &&
			this.queue.length > 0
		) {
			const id = this.queue.shift();
			if (!id) return;
			const record = this.records.get(id);
			if (!record || record.status !== "queued") continue;
			this.runRecord(record);
		}
	}

	private runRecord(record: BackgroundRecord): void {
		if (record.parentSignal?.aborted) {
			this.markAborted(record, "Background agent aborted before it started.");
			return;
		}
		record.status = "running";
		this.runningIds.add(record.id);
		void (async () => {
			try {
				const result = await record.runAgent({
					params: record.params,
					ctx: record.ctx,
					registry: record.registry,
					signal: record.controller.signal,
				});
				if (record.status === "aborted") return;
				const lifecycleStatus = terminalLifecycleStatus(result.details.status);
				record.status = lifecycleStatus;
				record.result = withLifecycleDetails(result, record, lifecycleStatus);
				this.resolveWaiters(record);
			} catch (error) {
				if (record.status === "aborted" || record.controller.signal.aborted) {
					this.markAborted(record, "Background agent aborted.");
					return;
				}
				const message = error instanceof Error ? error.message : String(error);
				record.status = "error";
				record.result = textResult(
					"error",
					`Background agent ${record.id} failed: ${message}`,
					this.baseDetails(record, { error: message }),
				);
				this.resolveWaiters(record);
			} finally {
				if (this.runningIds.delete(record.id)) this.schedule();
			}
		})();
	}

	private attachParentAbort(record: BackgroundRecord): void {
		const parentSignal = record.parentSignal;
		if (!parentSignal) return;
		const abort = () => {
			if (record.status === "queued") {
				this.removeFromQueue(record.id);
				this.markAborted(record, "Background agent aborted before it started.");
				return;
			}
			if (record.status === "running") {
				record.controller.abort();
				this.markAborted(record, "Background agent aborted.");
			}
		};
		record.parentAbortListener = abort;
		if (parentSignal.aborted) abort();
		else parentSignal.addEventListener("abort", abort, { once: true });
	}

	private removeFromQueue(id: string): void {
		const index = this.queue.indexOf(id);
		if (index >= 0) this.queue.splice(index, 1);
	}

	private markAborted(record: BackgroundRecord, text: string): void {
		if (isTerminal(record.status) && record.status !== "aborted") return;
		record.status = "aborted";
		record.controller.abort();
		record.result = textResult(
			"aborted",
			`${text} Agent ID: ${record.id}.`,
			this.baseDetails(record),
		);
		this.resolveWaiters(record);
	}

	private resolveWaiters(record: BackgroundRecord): void {
		if (record.parentSignal && record.parentAbortListener) {
			record.parentSignal.removeEventListener(
				"abort",
				record.parentAbortListener,
			);
			record.parentAbortListener = undefined;
		}
		const result = record.result ?? this.nonTerminalResult(record);
		const waiters = record.waiters.splice(0);
		for (const waiter of waiters) waiter(result);
	}

	private launchResult(record: BackgroundRecord): AgentToolResultLike {
		const text = [
			`Background agent ${record.id} is ${record.status}.`,
			`Status: ${record.status}.`,
			`Use get_subagent_result({"agent_id":"${record.id}"}) to check status or get_subagent_result({"agent_id":"${record.id}","wait":true}) to wait for completion.`,
		]
			.concat(record.note ? [`Note: ${record.note}`] : [])
			.join("\n");
		return textResult(record.status, text, this.baseDetails(record));
	}

	private nonTerminalResult(record: BackgroundRecord): AgentToolResultLike {
		const text = [
			`Background agent ${record.id} is ${record.status}.`,
			`Description: ${record.description ?? "(none)"}.`,
			`Agent type: ${record.agentType}.`,
			"No final result available yet.",
			`Use get_subagent_result({"agent_id":"${record.id}","wait":true}) to wait for completion.`,
		]
			.concat(record.note ? [`Note: ${record.note}`] : [])
			.join("\n");
		return textResult(record.status, text, this.baseDetails(record));
	}

	private waitAbortedResult(record: BackgroundRecord): AgentToolResultLike {
		const result = this.nonTerminalResult(record);
		return {
			...result,
			details: {
				...result.details,
				note: [result.details.note, "Wait aborted before final result."]
					.filter(Boolean)
					.join(" "),
			},
		};
	}

	private baseDetails(
		record: BackgroundRecord,
		extra: Partial<AgentToolDetailsLike> = {},
	): Partial<AgentToolDetailsLike> {
		return {
			agentId: record.id,
			agentType: record.agentType,
			requestedAgentType: record.requestedAgentType,
			description: record.description,
			note: record.note,
			...extra,
		};
	}
}

export function createGetSubagentResultToolDefinition(options: {
	manager: AgentManager;
}) {
	return {
		name: "get_subagent_result",
		label: "Get Subagent Result",
		description:
			"Return queued/running/completed/error/aborted state and final text for a background Agent id.",
		promptSnippet:
			"Look up a background Agent run by id, optionally waiting for completion.",
		promptGuidelines: [
			"Use get_subagent_result with wait: true when you need a background Agent final result; do not sleep or poll in loops.",
		],
		parameters: GET_SUBAGENT_RESULT_PARAMETERS_SCHEMA,
		async execute(
			_toolCallId: string,
			params: GetSubagentResultParams,
			signal?: AbortSignal,
		): Promise<AgentToolResultLike> {
			return options.manager.waitForResult(params, signal);
		},
	};
}

function withLifecycleDetails(
	result: AgentToolResultLike,
	record: BackgroundRecord,
	status: BackgroundAgentStatus,
): AgentToolResultLike {
	return {
		content: result.content,
		details: {
			...result.details,
			status,
			agentId: record.id,
			agentType: result.details.agentType ?? record.agentType,
			requestedAgentType:
				result.details.requestedAgentType ?? record.requestedAgentType,
			description: result.details.description ?? record.description,
			note: uniqueNotes(record.note, result.details.note),
		},
	};
}

function uniqueNotes(...notes: Array<string | undefined>): string | undefined {
	const unique = [
		...new Set(notes.filter((note): note is string => Boolean(note))),
	];
	return unique.join(" ") || undefined;
}

function terminalLifecycleStatus(status: string): BackgroundAgentStatus {
	if (status === "error") return "error";
	if (status === "aborted") return "aborted";
	return "completed";
}

function textResult(
	status: string,
	text: string,
	details: Partial<AgentToolDetailsLike> = {},
): AgentToolResultLike {
	return {
		content: [{ type: "text", text }],
		details: { status, ...details },
	};
}

function unknownIdResult(agentId: string): AgentToolResultLike {
	const error = `Unknown or expired background agent id "${agentId}".`;
	return textResult("error", error, { agentId, error });
}

function isTerminal(status: BackgroundAgentStatus): boolean {
	return status === "completed" || status === "error" || status === "aborted";
}
