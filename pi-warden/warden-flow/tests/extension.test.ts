import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import wardenMap from "../extensions/warden-map/index.js";
import {
	WARDEN_GIT_CONTEXT_MESSAGE,
	WARDEN_MAP_DEBUG_FLAG,
	WARDEN_MAP_MESSAGE,
} from "../src/index.js";

type SentMessage = {
	customType: string;
	display?: boolean;
	content: string;
};
type ToolResultUpdate = { content: Array<{ type: string; text: string }> };
type MessageUpdate = { message: SentMessage };
type HandlerResult = ToolResultUpdate | MessageUpdate | undefined;
type Handler = (
	event?: unknown,
	ctx?: unknown,
) => HandlerResult | Promise<HandlerResult>;

type FakePi = ReturnType<typeof createFakePi>;

let cwd = "";

beforeEach(() => {
	cwd = mkdtempSync(join(tmpdir(), "warden-map-extension-"));
});

afterEach(() => {
	if (cwd) rmSync(cwd, { recursive: true, force: true });
	cwd = "";
});

function initGitRepo(root = cwd): void {
	execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
}

function writeMap(relativePath: string, capsule: string): void {
	writeMapAt(cwd, relativePath, capsule);
}

function writeMapAt(base: string, relativePath: string, capsule: string): void {
	const target = join(base, relativePath);
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
	const messages: SentMessage[] = [];
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
		sendMessage(message: SentMessage) {
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
	event?: unknown,
	ctx?: unknown,
): Promise<HandlerResult> {
	const handler = pi.handlers.get(name)?.[0];
	assert.ok(handler, `${name} handler should be registered`);
	return handler(event, ctx);
}

function assertToolResultUpdate(
	value: HandlerResult,
): asserts value is ToolResultUpdate {
	assert.ok(value && "content" in value, "expected tool result update");
}

function assertMessageUpdate(
	value: HandlerResult,
): asserts value is MessageUpdate {
	assert.ok(value && "message" in value, "expected message update");
}

describe("warden-map extension", () => {
	it("injects root map capsule and git context on session start", async () => {
		writeMap(
			".warden/map.md",
			"## Agent Quick Context\n\n- Purpose: Root context",
		);
		const pi = createFakePi();
		wardenMap(pi as unknown as ExtensionAPI);

		await runHandler(pi, "session_start", {}, { cwd });

		assert.equal(pi.messages.length, 2);
		assert.equal(pi.messages[0].customType, WARDEN_MAP_MESSAGE);
		assert.equal(pi.messages[0].display, false);
		assert.match(pi.messages[0].content, /Purpose: Root context/);
		assert.equal(pi.messages[1].customType, WARDEN_GIT_CONTEXT_MESSAGE);
		assert.match(pi.messages[1].content, /Dirty: no/);
	});

	it("injects root map from git top-level when cwd is nested", async () => {
		initGitRepo();
		const nestedCwd = join(cwd, "pi-warden");
		mkdirSync(nestedCwd, { recursive: true });
		writeMapAt(
			cwd,
			".warden/map.md",
			"## Agent Quick Context\n\n- Purpose: Git root context",
		);
		writeMapAt(
			nestedCwd,
			".warden/map.md",
			"## Agent Quick Context\n\n- Purpose: Nested cwd context",
		);
		const pi = createFakePi();
		wardenMap(pi as unknown as ExtensionAPI);

		await runHandler(pi, "session_start", {}, { cwd: nestedCwd });

		assert.equal(pi.messages[0].customType, WARDEN_MAP_MESSAGE);
		assert.match(pi.messages[0].content, /Purpose: Git root context/);
		assert.doesNotMatch(pi.messages[0].content, /Purpose: Nested cwd context/);
	});

	it("appends scoped map capsule to matching tool results and dedupes", async () => {
		writeMap(
			".warden/maps/src/map.md",
			"## Agent Quick Context\n\n- Purpose: Source scope",
		);
		const pi = createFakePi();
		wardenMap(pi as unknown as ExtensionAPI);
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
		assertToolResultUpdate(first);
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

	it("appends scoped maps from git top-level when cwd is nested", async () => {
		initGitRepo();
		const nestedCwd = join(cwd, "pi-warden");
		const touchedDir = join(nestedCwd, "warden-flow/src");
		mkdirSync(touchedDir, { recursive: true });
		writeFileSync(join(touchedDir, "effort.ts"), "export {};\n", "utf-8");
		writeMapAt(
			cwd,
			".warden/maps/pi-warden/warden-flow/map.md",
			"## Agent Quick Context\n\n- Purpose: Git root scoped context",
		);
		writeMapAt(
			nestedCwd,
			".warden/maps/warden-flow/map.md",
			"## Agent Quick Context\n\n- Purpose: Nested cwd scoped context",
		);
		const pi = createFakePi();
		wardenMap(pi as unknown as ExtensionAPI);
		await runHandler(pi, "session_start", {}, { cwd: nestedCwd });

		const result = await runHandler(
			pi,
			"tool_result",
			{
				toolName: "read",
				input: { path: "warden-flow/src/effort.ts" },
				content: [{ type: "text", text: "file content" }],
			},
			{ cwd: nestedCwd },
		);

		assertToolResultUpdate(result);
		assert.equal(result.content.length, 2);
		assert.match(result.content[1].text, /Purpose: Git root scoped context/);
		assert.doesNotMatch(
			result.content[1].text,
			/Purpose: Nested cwd scoped context/,
		);
		assert.match(
			result.content[1].text,
			/Source: \.warden\/maps\/pi-warden\/warden-flow\/map\.md/,
		);
	});

	it("re-injects git context before an agent turn when dirty state changes", async () => {
		const pi = createFakePi();
		wardenMap(pi as unknown as ExtensionAPI);
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

		assertMessageUpdate(update);
		assert.equal(update.message.customType, WARDEN_GIT_CONTEXT_MESSAGE);
		assert.match(
			update.message.content ?? "",
			/Dirty: yes — staged 0, unstaged 1, untracked 0/,
		);
		assert.match(update.message.content ?? "", /Dirty paths: src\/changed.ts/);
	});
});
