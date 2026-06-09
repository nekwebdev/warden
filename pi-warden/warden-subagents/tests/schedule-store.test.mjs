import assert from "node:assert/strict";
import { mkdtemp, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { ScheduleStore, resolveScheduleStorePath } from "../index.ts";

async function tempStore() {
	const dir = await mkdtemp(join(tmpdir(), "warden-schedules-"));
	return {
		dir,
		filePath: join(dir, "session-1.json"),
		cleanup: () => rm(dir, { recursive: true, force: true }),
	};
}

const baseJob = {
	params: { subagent_type: "Explore", prompt: "work", description: "later" },
	cwd: "/tmp/project",
	nextRunAt: "2026-06-08T12:00:10.000Z",
	createdAt: "2026-06-08T12:00:00.000Z",
};

describe("ScheduleStore", () => {
	it("resolves Warden-named session-scoped paths under Pi session storage", () => {
		const filePath = resolveScheduleStorePath({
			sessionManager: {
				getSessionDir: () => "/tmp/pi-session",
				getSessionId: () => "abc123",
			},
		});
		assert.equal(
			filePath,
			"/tmp/pi-session/warden-subagent-schedules/abc123.json",
		);
	});

	it("allocates schedule-<n> ids and serializes concurrent add writes", async () => {
		const temp = await tempStore();
		try {
			const store = new ScheduleStore({ filePath: temp.filePath });
			const jobs = await Promise.all([
				store.add(baseJob),
				store.add({
					...baseJob,
					params: { ...baseJob.params, description: "two" },
				}),
				store.add({
					...baseJob,
					params: { ...baseJob.params, description: "three" },
				}),
			]);

			assert.deepEqual(jobs.map((job) => job.id).sort(), [
				"schedule-1",
				"schedule-2",
				"schedule-3",
			]);
			const saved = await store.list();
			assert.deepEqual(
				saved.map((job) => job.id),
				["schedule-1", "schedule-2", "schedule-3"],
			);
			await assert.rejects(stat(`${temp.filePath}.tmp`));
		} finally {
			await temp.cleanup();
		}
	});

	it("recovers stale locks and treats corrupt store data as empty before atomic rewrite", async () => {
		const temp = await tempStore();
		try {
			await writeFile(temp.filePath, "not json", "utf8");
			await writeFile(`${temp.filePath}.lock`, "stale", "utf8");
			const stale = new Date(Date.now() - 120_000);
			await utimes(`${temp.filePath}.lock`, stale, stale);

			const store = new ScheduleStore({
				filePath: temp.filePath,
				lockStaleMs: 1,
			});
			assert.deepEqual(await store.list(), []);
			const job = await store.add(baseJob);

			assert.equal(job.id, "schedule-1");
			assert.deepEqual(
				(await store.list()).map((item) => item.id),
				["schedule-1"],
			);
			await assert.rejects(stat(`${temp.filePath}.lock`));
		} finally {
			await temp.cleanup();
		}
	});

	it("updates listable status fields for /agents visibility", async () => {
		const temp = await tempStore();
		try {
			const store = new ScheduleStore({ filePath: temp.filePath });
			const job = await store.add(baseJob);
			await store.update(job.id, {
				status: "running",
				lastStatus: "running",
				runCount: 1,
				agentId: "agent-1",
				updatedAt: "2026-06-08T12:00:11.000Z",
			});

			const [saved] = await store.list();
			assert.equal(saved.status, "running");
			assert.equal(saved.lastStatus, "running");
			assert.equal(saved.runCount, 1);
			assert.equal(saved.agentId, "agent-1");
		} finally {
			await temp.cleanup();
		}
	});
});
