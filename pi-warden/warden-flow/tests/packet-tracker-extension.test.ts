import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import wardenPacketTracker, {
	registerWardenPacketTracker,
} from "../extensions/warden-packet-tracker/index.js";
import {
	PACKET_TRACKER_RELATIVE_PATH,
	type PacketTrackerState,
} from "../src/index.js";

type Handler = (event?: unknown, ctx?: unknown) => unknown | Promise<unknown>;
type FakePi = ReturnType<typeof createFakePi>;

let cwd = "";
const now = "2026-06-10T12:00:00.000Z";

beforeEach(() => {
	cwd = mkdtempSync(join(tmpdir(), "warden-packet-tracker-extension-"));
	execFileSync("git", ["init"], { cwd, stdio: "ignore" });
	writePacket("one");
	writePacket("two");
});

afterEach(() => {
	if (cwd) rmSync(cwd, { recursive: true, force: true });
	cwd = "";
});

function createFakePi() {
	const handlers = new Map<string, Handler[]>();
	return {
		handlers,
		on(name: string, handler: Handler) {
			handlers.set(name, [...(handlers.get(name) ?? []), handler]);
		},
	};
}

async function runFirstHandler(
	pi: FakePi,
	name: string,
	event?: unknown,
	ctx: unknown = { cwd },
): Promise<unknown> {
	const handler = pi.handlers.get(name)?.[0];
	assert.ok(handler, `${name} handler should be registered`);
	return handler(event, ctx);
}

function writePacket(slug: string): void {
	const dir = join(cwd, ".warden", "work", slug);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "packet.md"), `# ${slug}\n`, "utf-8");
}

function readTracker(): PacketTrackerState {
	return JSON.parse(
		readFileSync(join(cwd, PACKET_TRACKER_RELATIVE_PATH), "utf-8"),
	) as PacketTrackerState;
}

function assistantEnd(text: string) {
	return {
		messages: [
			{
				role: "assistant",
				content: [{ type: "text", text }],
			},
		],
	};
}

function uiCtx(choice?: string) {
	return {
		cwd,
		hasUI: choice !== undefined,
		ui: {
			async select(_prompt: string, options: string[]) {
				assert.deepEqual(options, ["warden-grill", "warden-close"]);
				return choice;
			},
		},
	};
}

describe("warden packet tracker extension", () => {
	it("registers default extension factory", () => {
		const pi = createFakePi();
		wardenPacketTracker(pi as unknown as ExtensionAPI);
		assert.ok(pi.handlers.has("input"));
		assert.ok(pi.handlers.has("before_agent_start"));
		assert.ok(pi.handlers.has("agent_end"));
	});

	it("captures allowlisted skill input and updates only at agent_end", async () => {
		const pi = createFakePi();
		registerWardenPacketTracker(pi as unknown as ExtensionAPI, {
			now: () => now,
		});

		await runFirstHandler(pi, "input", {
			text: "/skill:warden-start packet.md",
			source: "interactive",
		});
		assert.throws(() => readTracker(), /ENOENT/);

		await runFirstHandler(
			pi,
			"agent_end",
			assistantEnd(
				"# Warden Start Result\n\nTracker status: success\nPacket name: output-one\nPacket path: .warden/work/one/packet.md\nSummary: Created output-one packet for TDD.\n\n## Summary\nTracker status: failure\nPacket name: ignored\nPacket path: .warden/work/two/packet.md\nSummary: ignored",
			),
			{ cwd },
		);

		const state = readTracker();
		assert.equal(state.current?.packetPath, ".warden/work/one/packet.md");
		assert.equal(state.current?.packetName, "output-one");
		assert.equal(state.current?.lastStep, "warden-start");
		assert.equal(state.current?.lastStatus, "success");
		assert.equal(
			state.current?.lastSummary,
			"Created output-one packet for TDD.",
		);
		assert.equal(state.current?.nextStep, "warden-grill");
	});

	it("captures expanded skill prompt and prompts for tdd next step after success", async () => {
		const pi = createFakePi();
		registerWardenPacketTracker(pi as unknown as ExtensionAPI, {
			now: () => now,
		});
		await runFirstHandler(pi, "input", {
			text: "/skill:warden-start .warden/work/one/packet.md",
		});
		await runFirstHandler(pi, "agent_end", assistantEnd("Status: success"), {
			cwd,
		});

		await runFirstHandler(pi, "before_agent_start", {
			prompt:
				'<skill name="warden-tdd" location="/tmp/SKILL.md">body</skill>\n\n.w/ignored\n.warden/work/one/packet.md',
		});
		await runFirstHandler(
			pi,
			"agent_end",
			assistantEnd("Status: success\nResult: green\nNext step: warden-grill"),
			uiCtx("warden-close"),
		);

		const state = readTracker();
		assert.equal(state.current?.lastStep, "warden-tdd");
		assert.equal(state.current?.nextStep, "warden-close");
	});

	it("falls back to grill when tdd prompt is unavailable and ignores output next-step prose", async () => {
		const pi = createFakePi();
		registerWardenPacketTracker(pi as unknown as ExtensionAPI, {
			now: () => now,
		});
		await runFirstHandler(pi, "before_agent_start", {
			prompt:
				'<skill name="warden-start" location="/tmp/SKILL.md">body</skill>\n.warden/work/two/packet.md',
		});
		await runFirstHandler(pi, "agent_end", assistantEnd("Status: success"), {
			cwd,
		});
		await runFirstHandler(pi, "before_agent_start", {
			prompt:
				'<skill name="warden-tdd" location="/tmp/SKILL.md">body</skill>\n.warden/work/two/packet.md',
		});

		await runFirstHandler(
			pi,
			"agent_end",
			assistantEnd("Status: success\nNext step: warden-close"),
			{ cwd, hasUI: false },
		);

		assert.equal(readTracker().current?.nextStep, "warden-grill");
	});

	it("ignores non-allowlisted skills and unknown status words", async () => {
		const pi = createFakePi();
		registerWardenPacketTracker(pi as unknown as ExtensionAPI, {
			now: () => now,
		});

		await runFirstHandler(pi, "input", {
			text: "/skill:warden-docs .warden/work/one/packet.md",
		});
		await runFirstHandler(pi, "agent_end", assistantEnd("Status: success"), {
			cwd,
		});
		assert.throws(() => readTracker(), /ENOENT/);

		await runFirstHandler(pi, "input", {
			text: "/skill:warden-start .warden/work/one/packet.md",
		});
		await runFirstHandler(pi, "agent_end", assistantEnd("Status: closed"), {
			cwd,
		});
		assert.throws(() => readTracker(), /ENOENT/);
	});
});
