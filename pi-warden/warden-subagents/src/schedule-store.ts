import {
	mkdir,
	open,
	readFile,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ForegroundAgentParams } from "./invocation-config.ts";

export type ScheduleJobStatus =
	| "pending"
	| "queued"
	| "running"
	| "completed"
	| "error"
	| "aborted";

export interface ScheduleJob {
	id: string;
	status: ScheduleJobStatus;
	params: ForegroundAgentParams;
	cwd: string;
	nextRunAt: string;
	createdAt: string;
	updatedAt: string;
	runCount: number;
	lastStatus?: ScheduleJobStatus;
	lastMessage?: string;
	agentId?: string;
	agentType?: string;
	requestedAgentType?: string;
	description?: string;
}

export interface AddScheduleJobInput {
	params: ForegroundAgentParams;
	cwd: string;
	nextRunAt: string;
	createdAt: string;
}

export type ScheduleJobUpdate = Partial<
	Pick<
		ScheduleJob,
		| "status"
		| "updatedAt"
		| "runCount"
		| "lastStatus"
		| "lastMessage"
		| "agentId"
		| "agentType"
		| "requestedAgentType"
		| "description"
	>
>;

export interface ScheduleStoreOptions {
	filePath: string;
	lockWaitMs?: number;
	lockRetryMs?: number;
	lockStaleMs?: number;
}

interface StoreData {
	jobs: ScheduleJob[];
}

export class ScheduleStore {
	readonly filePath: string;
	private readonly lockPath: string;
	private readonly lockWaitMs: number;
	private readonly lockRetryMs: number;
	private readonly lockStaleMs: number;

	constructor(options: ScheduleStoreOptions) {
		this.filePath = options.filePath;
		this.lockPath = `${options.filePath}.lock`;
		this.lockWaitMs = options.lockWaitMs ?? 5_000;
		this.lockRetryMs = options.lockRetryMs ?? 5;
		this.lockStaleMs = options.lockStaleMs ?? 30_000;
	}

	async list(): Promise<ScheduleJob[]> {
		return (await this.readData()).jobs;
	}

	async add(input: AddScheduleJobInput): Promise<ScheduleJob> {
		return this.withLock(async () => {
			const data = await this.readData();
			const job: ScheduleJob = {
				id: nextScheduleId(data.jobs),
				status: "pending",
				params: { ...input.params },
				cwd: input.cwd,
				nextRunAt: input.nextRunAt,
				createdAt: input.createdAt,
				updatedAt: input.createdAt,
				runCount: 0,
				requestedAgentType: input.params.subagent_type ?? "general-purpose",
				description: input.params.description,
			};
			data.jobs.push(job);
			await this.writeData(data);
			return job;
		});
	}

	async update(
		id: string,
		update: ScheduleJobUpdate,
	): Promise<ScheduleJob | undefined> {
		return this.withLock(async () => {
			const data = await this.readData();
			const index = data.jobs.findIndex((job) => job.id === id);
			if (index < 0) return undefined;
			const job = { ...data.jobs[index], ...update };
			data.jobs[index] = job;
			await this.writeData(data);
			return job;
		});
	}

	private async withLock<T>(callback: () => Promise<T>): Promise<T> {
		await mkdir(dirname(this.filePath), { recursive: true });
		const start = Date.now();
		let handle: Awaited<ReturnType<typeof open>> | undefined;
		while (!handle) {
			try {
				handle = await open(this.lockPath, "wx");
				await handle.writeFile(String(process.pid));
			} catch (error) {
				if (
					!(await this.removeStaleLock()) &&
					Date.now() - start > this.lockWaitMs
				) {
					throw new Error(
						`Timed out acquiring schedule store lock ${this.lockPath}.`,
					);
				}
				await delay(this.lockRetryMs);
			}
		}
		try {
			return await callback();
		} finally {
			await handle.close();
			await rm(this.lockPath, { force: true });
		}
	}

	private async removeStaleLock(): Promise<boolean> {
		try {
			const info = await stat(this.lockPath);
			if (Date.now() - info.mtimeMs <= this.lockStaleMs) return false;
			await rm(this.lockPath, { force: true });
			return true;
		} catch {
			return false;
		}
	}

	private async readData(): Promise<StoreData> {
		try {
			const raw = await readFile(this.filePath, "utf8");
			const parsed = JSON.parse(raw) as Partial<StoreData>;
			return {
				jobs: Array.isArray(parsed.jobs)
					? parsed.jobs.filter(isScheduleJob)
					: [],
			};
		} catch {
			return { jobs: [] };
		}
	}

	private async writeData(data: StoreData): Promise<void> {
		await mkdir(dirname(this.filePath), { recursive: true });
		const tmpPath = `${this.filePath}.${process.pid}.${Date.now()}.${Math.random()
			.toString(36)
			.slice(2)}.tmp`;
		await writeFile(
			tmpPath,
			`${JSON.stringify({ jobs: data.jobs }, null, 2)}\n`,
			"utf8",
		);
		await rename(tmpPath, this.filePath);
	}
}

export function resolveScheduleStorePath(ctx: unknown): string | undefined {
	if (!ctx || typeof ctx !== "object") return undefined;
	const manager = (ctx as { sessionManager?: unknown }).sessionManager;
	if (!manager || typeof manager !== "object") return undefined;
	const getSessionDir = (manager as { getSessionDir?: unknown }).getSessionDir;
	const getSessionId = (manager as { getSessionId?: unknown }).getSessionId;
	if (
		typeof getSessionDir !== "function" ||
		typeof getSessionId !== "function"
	) {
		return undefined;
	}
	const sessionDir = getSessionDir.call(manager);
	const sessionId = getSessionId.call(manager);
	if (typeof sessionDir !== "string" || typeof sessionId !== "string") {
		return undefined;
	}
	return join(sessionDir, "warden-subagent-schedules", `${sessionId}.json`);
}

function nextScheduleId(jobs: readonly ScheduleJob[]): string {
	let max = 0;
	for (const job of jobs) {
		const match = /^schedule-(\d+)$/.exec(job.id);
		if (match) max = Math.max(max, Number(match[1]));
	}
	return `schedule-${max + 1}`;
}

function isScheduleJob(value: unknown): value is ScheduleJob {
	return Boolean(
		value &&
			typeof value === "object" &&
			typeof (value as ScheduleJob).id === "string" &&
			typeof (value as ScheduleJob).nextRunAt === "string" &&
			typeof (value as ScheduleJob).cwd === "string",
	);
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
