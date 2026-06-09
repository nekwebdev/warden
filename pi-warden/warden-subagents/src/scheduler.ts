import type {
	AgentManager,
	AgentToolResultLike,
	BackgroundRunAgent,
} from "./agent-manager.ts";
import {
	loadAgentTypes as loadAgentTypesDefault,
	resolveAgentType,
} from "./agent-types.ts";
import {
	scheduledPayload,
	schedulerReadyPayload,
	type SubagentSchedulerEvent,
} from "./events.ts";
import type { ForegroundAgentParams } from "./invocation-config.ts";
import {
	parseOneShotSchedule,
	scheduleErrorResult,
	scheduledTextResult,
	validateScheduledAgentParams,
} from "./schedule.ts";
import type {
	ScheduleJob,
	ScheduleJobStatus,
	ScheduleStore,
} from "./schedule-store.ts";
import type { AgentTypeRegistry } from "./types.ts";

export interface ScheduledAgentManagerOptions {
	store: ScheduleStore;
	agentManager: AgentManager;
	now?: () => number;
	setTimeoutFn?: (
		callback: () => void | Promise<void>,
		ms: number,
	) => TimerHandle;
	clearTimeoutFn?: (handle: TimerHandle) => void;
	loadRegistry?: (input: { cwd: string }) => AgentTypeRegistry;
	sessionId?: string;
	onEvent?: (event: SubagentSchedulerEvent) => void;
	runAgent: BackgroundRunAgent;
}

type TimerHandle = {
	unref?: () => void;
	[key: string]: unknown;
};

const TERMINAL = new Set<ScheduleJobStatus>(["completed", "error", "aborted"]);

export class ScheduledAgentManager {
	private readonly store: ScheduleStore;
	private readonly agentManager: AgentManager;
	private readonly now: () => number;
	private readonly setTimer: (
		callback: () => void | Promise<void>,
		ms: number,
	) => TimerHandle;
	private readonly clearTimer: (handle: TimerHandle) => void;
	private readonly loadRegistry: (input: { cwd: string }) => AgentTypeRegistry;
	private readonly sessionId?: string;
	private readonly eventCallbacks = new Set<
		(event: SubagentSchedulerEvent) => void
	>();
	private readonly runAgent: BackgroundRunAgent;
	private timer?: TimerHandle;
	private firing = new Set<string>();

	constructor(options: ScheduledAgentManagerOptions) {
		this.store = options.store;
		this.agentManager = options.agentManager;
		this.now = options.now ?? (() => Date.now());
		this.setTimer =
			options.setTimeoutFn ??
			((callback, ms) => setTimeout(callback, ms) as unknown as TimerHandle);
		this.clearTimer =
			options.clearTimeoutFn ??
			((handle) =>
				clearTimeout(handle as unknown as ReturnType<typeof setTimeout>));
		this.loadRegistry = options.loadRegistry ?? loadAgentTypesDefault;
		this.sessionId = options.sessionId;
		if (options.onEvent) this.eventCallbacks.add(options.onEvent);
		this.runAgent = options.runAgent;
	}

	async schedule(
		params: ForegroundAgentParams,
		ctx: Record<string, unknown>,
	): Promise<AgentToolResultLike> {
		const validation = validateScheduledAgentParams(params);
		if (validation.status === "error")
			return scheduleErrorResult(validation.message);
		const parsed = parseOneShotSchedule(String(params.schedule), {
			now: this.now(),
		});
		if (parsed.status === "error") return scheduleErrorResult(parsed.message);

		const nowIso = new Date(this.now()).toISOString();
		const storedParams = sanitizeScheduledParams(params);
		const job = await this.store.add({
			params: storedParams,
			cwd: String(ctx.cwd ?? process.cwd()),
			nextRunAt: parsed.runAt,
			createdAt: nowIso,
		});
		this.notifyScheduled(job, "created");
		await this.rearm();
		return scheduledTextResult({
			status: "scheduled",
			scheduleId: job.id,
			nextRunAt: job.nextRunAt,
			agentType: job.params.subagent_type,
			requestedAgentType: job.params.subagent_type,
			description: job.params.description,
		});
	}

	async rearm(): Promise<void> {
		if (this.timer) {
			this.clearTimer(this.timer);
			this.timer = undefined;
		}
		const pending = (await this.store.list()).filter(
			(job) => job.status === "pending",
		);
		this.notifySchedulerReady(pending.length);
		if (pending.length === 0) return;
		const now = this.now();
		const due = pending.filter((job) => Date.parse(job.nextRunAt) <= now);
		if (due.length > 0) {
			await Promise.all(due.map((job) => this.fire(job)));
			return;
		}
		const next = pending.reduce((earliest, job) =>
			Date.parse(job.nextRunAt) < Date.parse(earliest.nextRunAt)
				? job
				: earliest,
		);
		const delayMs = Math.max(0, Date.parse(next.nextRunAt) - now);
		this.timer = this.setTimer(() => this.fire(next), delayMs);
		this.timer.unref?.();
	}

	async listScheduledJobs(): Promise<ScheduleJob[]> {
		return this.store.list();
	}

	shutdown(): void {
		if (this.timer) this.clearTimer(this.timer);
		this.timer = undefined;
		this.firing.clear();
	}

	private async fire(job: ScheduleJob): Promise<void> {
		if (this.firing.has(job.id) || TERMINAL.has(job.status)) return;
		this.firing.add(job.id);
		try {
			await this.updateJob(
				job.id,
				{
					status: "queued",
					lastStatus: "queued",
					updatedAt: new Date(this.now()).toISOString(),
				},
				"queued",
			);
			let registry: AgentTypeRegistry;
			try {
				registry = this.loadRegistry({ cwd: job.cwd });
			} catch (error) {
				await this.persistError(
					job,
					error instanceof Error ? error.message : String(error),
				);
				return;
			}
			const requestedAgentType = job.params.subagent_type ?? "general-purpose";
			const resolution = resolveAgentType(registry, requestedAgentType);
			if (resolution.status === "disabled") {
				await this.persistError(
					job,
					`Agent type "${requestedAgentType}" is disabled.`,
				);
				return;
			}
			if (resolution.status === "unknown") {
				await this.persistError(
					job,
					`Unknown agent type "${requestedAgentType}".`,
				);
				return;
			}

			const launch = this.agentManager.start({
				params: job.params,
				ctx: { cwd: job.cwd },
				registry,
				runAgent: async (input) => {
					await this.updateJob(
						job.id,
						{
							status: "running",
							lastStatus: "running",
							runCount: job.runCount + 1,
							agentId: input.agentId,
							agentType: resolution.agent.type,
							requestedAgentType,
							description: job.description,
							updatedAt: new Date(this.now()).toISOString(),
						},
						"running",
					);
					try {
						const result = await this.runAgent({
							...input,
							params: sanitizeScheduledParams(input.params),
						});
						const finalStatus = terminalScheduleStatus(result.details.status);
						await this.updateJob(
							job.id,
							{
								status: finalStatus,
								lastStatus: finalStatus,
								runCount: job.runCount + 1,
								agentId: input.agentId,
								agentType: result.details.agentType ?? resolution.agent.type,
								requestedAgentType,
								description: job.description,
								lastMessage: result.content[0]?.text,
								updatedAt: new Date(this.now()).toISOString(),
							},
							finalStatus,
						);
						return result;
					} catch (error) {
						await this.updateJob(
							job.id,
							{
								status: "error",
								lastStatus: "error",
								runCount: job.runCount + 1,
								agentId: input.agentId,
								agentType: resolution.agent.type,
								requestedAgentType,
								description: job.description,
								lastMessage:
									error instanceof Error ? error.message : String(error),
								updatedAt: new Date(this.now()).toISOString(),
							},
							"error",
						);
						throw error;
					}
				},
			});
			if (launch.details.status === "queued") {
				await this.updateJob(
					job.id,
					{
						status: "queued",
						lastStatus: "queued",
						agentId: launch.details.agentId,
						agentType: resolution.agent.type,
						requestedAgentType,
						description: job.description,
						updatedAt: new Date(this.now()).toISOString(),
					},
					"queued",
				);
			}
		} finally {
			this.firing.delete(job.id);
			await this.rearm();
		}
	}

	private async persistError(job: ScheduleJob, message: string): Promise<void> {
		await this.updateJob(
			job.id,
			{
				status: "error",
				lastStatus: "error",
				lastMessage: message,
				updatedAt: new Date(this.now()).toISOString(),
			},
			"error",
		);
	}

	private async updateJob(
		id: string,
		update: Parameters<ScheduleStore["update"]>[1],
		change: string,
	): Promise<ScheduleJob | undefined> {
		const job = await this.store.update(id, update);
		if (job) this.notifyScheduled(job, change);
		return job;
	}

	private notifyScheduled(job: ScheduleJob, change: string): void {
		this.notify({
			channel: "subagents:scheduled",
			payload: scheduledPayload(job, change),
		});
	}

	private notifySchedulerReady(jobCount: number): void {
		if (!this.sessionId) return;
		this.notify({
			channel: "subagents:scheduler_ready",
			payload: schedulerReadyPayload({ sessionId: this.sessionId, jobCount }),
		});
	}

	private notify(event: SubagentSchedulerEvent): void {
		for (const callback of this.eventCallbacks) callback(event);
	}
}

export function sanitizeScheduledParams(
	params: ForegroundAgentParams,
): ForegroundAgentParams {
	const {
		schedule: _schedule,
		resume: _resume,
		run_in_background: _background,
		inherit_context: _inherit,
		...rest
	} = params;
	return { ...rest, inherit_context: false };
}

function terminalScheduleStatus(
	status: string,
): Extract<ScheduleJobStatus, "completed" | "error" | "aborted"> {
	if (status === "error") return "error";
	if (status === "aborted") return "aborted";
	return "completed";
}
