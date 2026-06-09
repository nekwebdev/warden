import type {
	AgentToolResultLike,
	BackgroundAgentStatus,
} from "./agent-manager.ts";
import type { ScheduleJob } from "./schedule-store.ts";

export type SubagentLifecycleChannel =
	| "subagents:created"
	| "subagents:started"
	| "subagents:completed"
	| "subagents:failed";

export interface SubagentLifecycleEvent {
	channel: SubagentLifecycleChannel;
	payload: Record<string, unknown>;
}

export type SubagentSchedulerChannel =
	| "subagents:scheduled"
	| "subagents:scheduler_ready";

export interface SubagentSchedulerEvent {
	channel: SubagentSchedulerChannel;
	payload: Record<string, unknown>;
}

export type SubagentEvent = SubagentLifecycleEvent | SubagentSchedulerEvent;

export function createdPayload(input: {
	id: string;
	type: string;
	description?: string;
}): Record<string, unknown> {
	return compactPayload({
		id: input.id,
		type: input.type,
		description: input.description,
		isBackground: true,
	});
}

export function startedPayload(input: {
	id: string;
	type: string;
	description?: string;
}): Record<string, unknown> {
	return compactPayload({
		id: input.id,
		type: input.type,
		description: input.description,
	});
}

export function terminalPayload(input: {
	id: string;
	type: string;
	description?: string;
	status: BackgroundAgentStatus;
	result?: AgentToolResultLike;
	startedAt?: number;
	completedAt?: number;
	error?: string;
}): Record<string, unknown> {
	const resultText = input.result?.content[0]?.text;
	const details = input.result?.details;
	const durationMs =
		typeof input.startedAt === "number" && typeof input.completedAt === "number"
			? Math.max(0, input.completedAt - input.startedAt)
			: undefined;
	return compactPayload({
		id: input.id,
		type: input.type,
		description: input.description,
		status: input.status,
		result: resultText,
		error: input.error ?? details?.error,
		durationMs,
		toolUses: details?.toolUseCount,
		tokens: details?.usage?.tokens,
	});
}

export function scheduledPayload(
	job: ScheduleJob,
	change: string,
): Record<string, unknown> {
	return { job, change };
}

export function schedulerReadyPayload(input: {
	sessionId: string;
	jobCount: number;
}): Record<string, unknown> {
	return { sessionId: input.sessionId, jobCount: input.jobCount };
}

function compactPayload(
	payload: Record<string, unknown>,
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(payload).filter(([, value]) => value !== undefined),
	);
}
