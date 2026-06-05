import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import wardenMap from "../extensions/warden-map/index.js";
import {
	WARDEN_GIT_CONTEXT_MESSAGE,
	WARDEN_MAP_DEBUG_FLAG,
	WARDEN_MAP_MESSAGE,
} from "../src/index.js";

type Handler = (event?: any, ctx?: any) => any;

type FakePi = ReturnType<typeof createFakePi>;

let cwd = "";

beforeEach(() => {
	cwd = mkdtempSync(join(tmpdir(), "warden-map-extension-"));
});

afterEach(() => {
	if (cwd) rmSync(cwd, { recursive: true, force: true });
	cwd = "";
});

function writeMap(relativePath: string, capsule: string): void {
	const target = join(cwd, relativePath);
	mkdirSync(join(target, ".."), { recursive: true });
	writeFileSync(
		target,
		[
			"# Test Map",
			"",
			"<!-- warden-map:inject:start -->",
			capsule,
			"<!-- warden-map:inject:end -->",
			"",
			"## Full Detail",
			"Deeper context stays on disk.",
		].join("\n"),
		"utf-8",
	);
}

function createFakePi(status = "") {
	const handlers = new Map<string, Handler[]>();
	const messages: any[] = [];
	let statusText = status;
	const pi = {
		handlers,
		messages,
		setStatusText(next: string) {
			statusText = next;
		},
		registerFlag(name: string, spec: unknown) {
			assert.equal(name, WARDEN_MAP_DEBUG_FLAG);
			assert.ok(spec);
		},
		on(name: string, handler: Handler) {
			handlers.set(name, [...(handlers.get(name) ?? []), handler]);
		},
		sendMessage(message: any) {
			messages.push(message);
		},
		getFlag() {
			return false;
		},
		async exec(_command: string, args: string[]) {
			const key = args.join(" ");
			if (key === "rev-parse --is-inside-work-tree")
				return { stdout: "true\n" };
			if (key === "rev-parse --abbrev-ref HEAD") return { stdout: "main\n" };
			if (key === "rev-parse --short HEAD") return { stdout: "abc1234\n" };
			if (key === "status --porcelain=v1") return { stdout: statusText };
			throw new Error(`unexpected exec: ${key}`);
		},
	};
	return pi;
}

async function runHandler(
	pi: FakePi,
	name: string,
	event?: any,
	ctx?: any,
): Promise<any> {
	const handler = pi.handlers.get(name)?.[0];
	assert.ok(handler, `${name} handler should be registered`);
	return handler(event, ctx);
}

describe("warden-map extension", () => {
	it("injects root map capsule and git context on session start", async () => {
		writeMap(
			".warden/map.md",
			"## Agent Quick Context\n\n- Purpose: Root context",
		);
		const pi = createFakePi();
		wardenMap(pi as any);

		await runHandler(pi, "session_start", {}, { cwd });

		assert.equal(pi.messages.length, 2);
		assert.equal(pi.messages[0].customType, WARDEN_MAP_MESSAGE);
		assert.equal(pi.messages[0].display, false);
		assert.match(pi.messages[0].content, /Purpose: Root context/);
		assert.equal(pi.messages[1].customType, WARDEN_GIT_CONTEXT_MESSAGE);
		assert.match(pi.messages[1].content, /Dirty: no/);
	});

	it("appends scoped map capsule to matching tool results and dedupes", async () => {
		writeMap(
			".warden/maps/src/map.md",
			"## Agent Quick Context\n\n- Purpose: Source scope",
		);
		const pi = createFakePi();
		wardenMap(pi as any);
		await runHandler(pi, "session_start", {}, { cwd });

		const first = await runHandler(
			pi,
			"tool_result",
			{
				toolName: "read",
				input: { path: "src/file.ts" },
				content: [{ type: "text", text: "file content" }],
			},
			{ cwd },
		);
		assert.equal(first.content.length, 2);
		assert.match(first.content[1].text, /Purpose: Source scope/);

		const second = await runHandler(
			pi,
			"tool_result",
			{
				toolName: "read",
				input: { path: "src/other.ts" },
				content: [{ type: "text", text: "file content" }],
			},
			{ cwd },
		);
		assert.equal(second, undefined);
	});

	it("re-injects git context before an agent turn when dirty state changes", async () => {
		const pi = createFakePi();
		wardenMap(pi as any);
		await runHandler(pi, "session_start", {}, { cwd });
		pi.setStatusText(" M src/changed.ts\n");

		await runHandler(
			pi,
			"tool_call",
			{ toolName: "edit", input: { path: "src/changed.ts" } },
			{ cwd },
		);
		const update = await runHandler(
			pi,
			"before_agent_start",
			{ prompt: "continue" },
			{ cwd },
		);

		assert.equal(update.message.customType, WARDEN_GIT_CONTEXT_MESSAGE);
		assert.match(
			update.message.content,
			/Dirty: yes — staged 0, unstaged 1, untracked 0/,
		);
		assert.match(update.message.content, /Dirty paths: src\/changed.ts/);
	});
});
