import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
	PACKET_TRACKER_RELATIVE_PATH,
	applyPacketTrackerUpdate,
	loadPacketTrackerState,
	packetNameFromPath,
	parsePacketName,
	parsePacketPath,
	parsePacketStatus,
	summarizePacketOutput,
	type PacketTrackerState,
} from "../src/index.js";

let cwd = "";
let nestedCwd = "";
const now = "2026-06-10T12:00:00.000Z";

beforeEach(() => {
	cwd = mkdtempSync(join(tmpdir(), "warden-packet-tracker-"));
	initGitRepo(cwd);
	nestedCwd = join(cwd, "pi-warden", "warden-flow");
	mkdirSync(nestedCwd, { recursive: true });
	mkdirSync(join(cwd, ".warden", "work", "one"), { recursive: true });
	writeFileSync(
		join(cwd, ".warden", "work", "one", "packet.md"),
		"# One\n",
		"utf-8",
	);
});

afterEach(() => {
	if (cwd) rmSync(cwd, { recursive: true, force: true });
	cwd = "";
	nestedCwd = "";
});

function initGitRepo(root: string): void {
	execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
}

function trackerPath(): string {
	return join(cwd, PACKET_TRACKER_RELATIVE_PATH);
}

function readTracker(): PacketTrackerState {
	return JSON.parse(readFileSync(trackerPath(), "utf-8")) as PacketTrackerState;
}

function writeTracker(state: unknown): void {
	mkdirSync(join(trackerPath(), ".."), { recursive: true });
	writeFileSync(trackerPath(), JSON.stringify(state, null, 2), "utf-8");
}

function existingEntry(packetPath: string, step = "warden-start") {
	return {
		packetPath,
		packetName: packetNameFromPath(packetPath),
		lastStep: step,
		lastStatus: "success",
		lastSummary: "old",
		nextStep: "warden-grill",
		timestamp: "2026-06-09T00:00:00.000Z",
	};
}

describe("packet tracker core", () => {
	it("initializes missing tracker and normalizes packet paths from nested cwd", () => {
		const result = applyPacketTrackerUpdate({
			cwd: nestedCwd,
			step: "warden-start",
			status: "success",
			packetPath: join(cwd, ".warden", "work", "one", "packet.md"),
			output: "Summary: created packet",
			now,
		});

		assert.equal(result.updated, true);
		const state = readTracker();
		assert.deepEqual(state.queue, []);
		assert.deepEqual(state.recentCompleted, []);
		assert.equal(state.current?.packetPath, ".warden/work/one/packet.md");
		assert.equal(state.current?.packetName, "one");
		assert.equal(state.current?.lastStep, "warden-start");
		assert.equal(state.current?.lastStatus, "success");
		assert.equal(state.current?.lastSummary, "created packet");
		assert.equal(state.current?.nextStep, "warden-grill");
		assert.equal(state.current?.timestamp, now);
	});

	it("queues old current on successful start and advances grill without parsing output next step", () => {
		writeTracker({
			version: 1,
			current: existingEntry(".warden/work/old/packet.md"),
			queue: [],
			recentCompleted: [],
		});
		mkdirSync(join(cwd, ".warden", "work", "two"), { recursive: true });
		writeFileSync(
			join(cwd, ".warden", "work", "two", "packet.md"),
			"# Two\n",
			"utf-8",
		);

		applyPacketTrackerUpdate({
			cwd,
			step: "warden-start",
			status: "success",
			packetPath: ".warden/work/two/packet.md",
			output: "Result: new current",
			now,
		});
		applyPacketTrackerUpdate({
			cwd,
			step: "warden-grill",
			status: "success",
			packetPath: ".warden/work/two/packet.md",
			output: "Result: grilled\nNext step: warden-close",
			now,
		});

		const state = readTracker();
		assert.equal(state.current?.packetPath, ".warden/work/two/packet.md");
		assert.equal(state.current?.packetName, "two");
		assert.equal(state.current?.nextStep, "warden-tdd");
		assert.equal(state.queue[0]?.packetPath, ".warden/work/old/packet.md");
		assert.equal(state.queue[0]?.packetName, "old");
	});

	it("uses extension-owned tdd next-step choice and falls back to grill", () => {
		writeTracker({
			version: 1,
			current: existingEntry(".warden/work/one/packet.md", "warden-grill"),
			queue: [],
			recentCompleted: [],
		});

		applyPacketTrackerUpdate({
			cwd,
			step: "warden-tdd",
			status: "success",
			packetPath: ".warden/work/one/packet.md",
			output: "Result: green\nNext step: warden-close",
			now,
		});
		assert.equal(readTracker().current?.nextStep, "warden-grill");

		applyPacketTrackerUpdate({
			cwd,
			step: "warden-tdd",
			status: "success",
			packetPath: ".warden/work/one/packet.md",
			output: "Result: green",
			nextStepChoice: "warden-close",
			now,
		});
		assert.equal(readTracker().current?.nextStep, "warden-close");
	});

	it("promotes queued packet before applying non-start updates", () => {
		writeTracker({
			version: 1,
			current: existingEntry(".warden/work/current/packet.md"),
			queue: [existingEntry(".warden/work/one/packet.md")],
			recentCompleted: [],
		});

		applyPacketTrackerUpdate({
			cwd,
			step: "warden-grill",
			status: "success",
			packetPath: ".warden/work/one/packet.md",
			output: "Summary: promoted",
			now,
		});

		const state = readTracker();
		assert.equal(state.current?.packetPath, ".warden/work/one/packet.md");
		assert.equal(state.queue[0]?.packetPath, ".warden/work/current/packet.md");
		assert.equal(state.current?.nextStep, "warden-tdd");
	});

	it("closes only with handoff, trims recent completed, and promotes queue", () => {
		mkdirSync(join(cwd, ".warden", "work", "one"), { recursive: true });
		writeFileSync(
			join(cwd, ".warden", "work", "one", "handoff.md"),
			"# Handoff\n",
			"utf-8",
		);
		writeTracker({
			version: 1,
			current: existingEntry(".warden/work/one/packet.md", "warden-tdd"),
			queue: [existingEntry(".warden/work/two/packet.md")],
			recentCompleted: [0, 1, 2, 3, 4].map((index) => ({
				...existingEntry(
					`.warden/work/done-${index}/packet.md`,
					"warden-close",
				),
				handoffPath: `.warden/work/done-${index}/handoff.md`,
			})),
		});

		applyPacketTrackerUpdate({
			cwd,
			step: "warden-close",
			status: "success",
			packetPath: ".warden/work/one/packet.md",
			output: "Result: closed",
			now,
		});

		const state = readTracker();
		assert.equal(state.current?.packetPath, ".warden/work/two/packet.md");
		assert.equal(state.recentCompleted.length, 5);
		assert.equal(
			state.recentCompleted[0]?.packetPath,
			".warden/work/one/packet.md",
		);
		assert.equal(state.recentCompleted[0]?.packetName, "one");
		assert.equal(
			state.recentCompleted[0]?.handoffPath,
			".warden/work/one/handoff.md",
		);
	});

	it("keeps current close as failure when handoff is missing", () => {
		writeTracker({
			version: 1,
			current: existingEntry(".warden/work/one/packet.md", "warden-tdd"),
			queue: [],
			recentCompleted: [],
		});

		applyPacketTrackerUpdate({
			cwd,
			step: "warden-close",
			status: "success",
			packetPath: ".warden/work/one/packet.md",
			output: "Result: closed",
			now,
		});

		const state = readTracker();
		assert.equal(state.current?.packetPath, ".warden/work/one/packet.md");
		assert.equal(state.current?.lastStatus, "failure");
		assert.equal(state.current?.nextStep, "warden-close");
		assert.equal(state.recentCompleted.length, 0);
	});

	it("retries failed non-close steps and ignores failed start without packet path", () => {
		applyPacketTrackerUpdate({
			cwd,
			step: "warden-start",
			status: "failure",
			output: "Result: no packet",
			now,
		});
		assert.equal(existsSync(trackerPath()), false);

		writeTracker({
			version: 1,
			current: existingEntry(".warden/work/one/packet.md", "warden-start"),
			queue: [],
			recentCompleted: [],
		});
		applyPacketTrackerUpdate({
			cwd,
			step: "warden-tdd",
			status: "aborted",
			packetPath: ".warden/work/one/packet.md",
			output: "Result: user stopped",
			now,
		});

		const state = readTracker();
		assert.equal(state.current?.lastStatus, "aborted");
		assert.equal(state.current?.nextStep, "warden-tdd");
	});

	it("leaves malformed or invalid tracker JSON unchanged", () => {
		mkdirSync(join(trackerPath(), ".."), { recursive: true });
		writeFileSync(trackerPath(), "{not json", "utf-8");
		const malformed = readFileSync(trackerPath(), "utf-8");

		const result = applyPacketTrackerUpdate({
			cwd,
			step: "warden-start",
			status: "success",
			packetPath: ".warden/work/one/packet.md",
			output: "Result: created",
			now,
		});

		assert.equal(result.updated, false);
		assert.equal(readFileSync(trackerPath(), "utf-8"), malformed);

		writeTracker({
			version: 1,
			current: { packetPath: "x" },
			queue: [],
			recentCompleted: [],
		});
		const invalid = readFileSync(trackerPath(), "utf-8");
		assert.equal(
			applyPacketTrackerUpdate({
				cwd,
				step: "warden-start",
				status: "success",
				packetPath: ".warden/work/one/packet.md",
				output: "Result: created",
				now,
			}).updated,
			false,
		);
		assert.equal(readFileSync(trackerPath(), "utf-8"), invalid);
	});

	it("rejects invalid status/step/nextStep and bounds summaries", () => {
		assert.equal(parsePacketStatus("Status: success"), "success");
		assert.equal(parsePacketStatus("Status: closed"), undefined);
		const trackerOutput =
			"# Warden Start Result\n\nTracker status: success\nPacket name: Display Name / user text\nPacket path: .warden/work/one/packet.md\nSummary: Ready for implementation.\n\n## Summary\nTracker status: failure\nPacket name: ignored\nPacket path: .warden/work/two/packet.md\nSummary: ignored";
		assert.equal(parsePacketStatus(trackerOutput), "success");
		assert.equal(parsePacketName(trackerOutput), "Display Name / user text");
		assert.equal(parsePacketPath(trackerOutput), ".warden/work/one/packet.md");
		assert.equal(
			summarizePacketOutput(trackerOutput),
			"Ready for implementation.",
		);
		assert.equal(
			summarizePacketOutput("# Title\n\nSummary: " + "x".repeat(500)).length,
			300,
		);
		assert.equal(
			summarizePacketOutput(
				"Verdict: Packet solid for TDD\nSummary: Ready for implementation.",
			),
			"Ready for implementation.",
		);
		assert.equal(
			summarizePacketOutput(
				"# Warden Start Result\n\nTracker status: success\nPacket path: .warden/work/one/packet.md\n\n## Summary\nCreated one packet for TDD.\n\n## Assumptions\nNone.",
			),
			"No summary provided.",
		);

		assert.equal(
			applyPacketTrackerUpdate({
				cwd,
				step: "warden-docs",
				status: "success",
				packetPath: ".warden/work/one/packet.md",
				output: "Result: no",
				now,
			}).updated,
			false,
		);
		assert.equal(loadPacketTrackerState(cwd).state, undefined);
	});
});
