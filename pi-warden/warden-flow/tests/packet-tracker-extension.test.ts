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
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	clearWardenPanesForTests,
	getWardenDisplaySettings,
	handleWardenPaneAction,
	type WardenPanelPaneAction,
	type WardenPanelPaneContext,
} from "../../warden-panel/src/registry.js";
import wardenPacketTracker, {
	ACTIVE_FLOW_DISPLAY_SETTING_ID,
	ACTIVE_FLOW_STATUS_KEY,
	registerWardenPacketTracker,
} from "../extensions/warden-packet-tracker/index.js";
import {
	PACKET_TRACKER_RELATIVE_PATH,
	getPiAgentSettingsPath,
	type BranchCloseHandoffPayload,
	type PacketTrackerState,
} from "../src/index.js";

type Handler = (event?: unknown, ctx?: unknown) => unknown | Promise<unknown>;
type FakePi = ReturnType<typeof createFakePi>;
type StatusUpdate = { readonly key: string; readonly text: string | undefined };

const envBefore = {
	NODE_ENV: process.env.NODE_ENV,
	PI_CODING_AGENT_DIR: process.env.PI_CODING_AGENT_DIR,
	WARDEN_FLOW_TEST_HOME: process.env.WARDEN_FLOW_TEST_HOME,
	WARDEN_PANEL_TEST_HOME: process.env.WARDEN_PANEL_TEST_HOME,
};
const plainTheme = {
	fg: (_name: string, text: string) => text,
	bg: (_name: string, text: string) => text,
	bold: (text: string) => text,
};

let cwd = "";
const now = "2026-06-10T12:00:00.000Z";

beforeEach(() => {
	process.env.NODE_ENV = "test";
	delete process.env.WARDEN_FLOW_TEST_HOME;
	delete process.env.WARDEN_PANEL_TEST_HOME;
	cwd = mkdtempSync(join(tmpdir(), "warden-packet-tracker-extension-"));
	process.env.PI_CODING_AGENT_DIR = join(cwd, "pi-agent");
	execFileSync("git", ["init"], { cwd, stdio: "ignore" });
	writePacket("one");
	writePacket("two");
	clearWardenPanesForTests();
});

afterEach(() => {
	clearWardenPanesForTests();
	if (cwd) rmSync(cwd, { recursive: true, force: true });
	cwd = "";
	for (const [key, value] of Object.entries(envBefore)) {
		if (value === undefined) delete process.env[key as keyof NodeJS.ProcessEnv];
		else process.env[key as keyof NodeJS.ProcessEnv] = value;
	}
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

function writeSettings(settings: unknown): void {
	const settingsPath = getPiAgentSettingsPath();
	mkdirSync(dirname(settingsPath), { recursive: true });
	writeFileSync(settingsPath, JSON.stringify(settings), "utf-8");
}

function readSettings(): Record<string, unknown> {
	return JSON.parse(readFileSync(getPiAgentSettingsPath(), "utf-8"));
}

function statusCtx(statuses: StatusUpdate[]) {
	return {
		cwd,
		hasUI: true,
		ui: {
			theme: plainTheme,
			setStatus: (key: string, text: string | undefined) =>
				statuses.push({ key, text }),
		},
	};
}

function displayCtx(
	draftSettings: WardenPanelPaneContext["draftSettings"],
): WardenPanelPaneContext {
	let nextDraft = draftSettings;
	return {
		settings: draftSettings,
		get draftSettings() {
			return nextDraft;
		},
		glyphs: {
			pointer: "> ",
			checkboxOn: "[x]",
			checkboxOff: "[ ]",
		} as WardenPanelPaneContext["glyphs"],
		theme: plainTheme,
		selectedIndex: 0,
		maxPaneLines: Number.MAX_SAFE_INTEGER,
		updateDraftSettings(patch) {
			const currentFlow =
				(nextDraft as { flow?: Record<string, unknown> }).flow ?? {};
			const patchFlow = (patch as { flow?: Record<string, unknown> }).flow;
			nextDraft = {
				...nextDraft,
				...patch,
				...(patchFlow ? { flow: { ...currentFlow, ...patchFlow } } : {}),
			};
		},
		requestRender() {},
	};
}

function activeFlowSetting() {
	const setting = getWardenDisplaySettings().find(
		(item) => item.id === ACTIVE_FLOW_DISPLAY_SETTING_ID,
	);
	assert.ok(setting);
	return setting;
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

function prepareClosablePacket(): void {
	mkdirSync(join(cwd, ".warden", "work", "one"), { recursive: true });
	writeFileSync(
		join(cwd, ".warden", "work", "one", "handoff.md"),
		"# Handoff\n",
		"utf-8",
	);
	writeFileSync(
		join(cwd, PACKET_TRACKER_RELATIVE_PATH),
		JSON.stringify({
			version: 1,
			current: {
				packetPath: ".warden/work/one/packet.md",
				packetName: "one",
				lastStep: "warden-tdd",
				lastStatus: "success",
				lastSummary: "green",
				nextStep: "warden-close",
				timestamp: now,
			},
			queue: [],
			recentCompleted: [],
		}),
		"utf-8",
	);
}

function wardenCloseOutput(extra = "Maps: none\nMaps scope: none"): string {
	return `# Warden Close Result\n\nTracker status: success\nPacket name: one\nPacket path: .warden/work/one/packet.md\nStatus: Closed\nSummary: Closed one.\n${extra}`;
}

function branchCloseCtx(options: {
	readonly choice?: string;
	readonly hasUI?: boolean;
	readonly dispatch?: (payload: BranchCloseHandoffPayload) => void;
	readonly branchStatus?: "feature-branch" | "default-branch" | "detached-head";
}) {
	const prompts: { prompt: string; options: string[] }[] = [];
	const results: unknown[] = [];
	return {
		ctx: {
			cwd,
			hasUI: options.hasUI ?? true,
			ui: {
				async select(prompt: string, choices: string[]) {
					prompts.push({ prompt, options: choices });
					return options.choice;
				},
			},
			branchClose: {
				onResult: (result: unknown) => results.push(result),
				detectContext: () => {
					if (options.branchStatus === "default-branch") {
						return {
							status: "default-branch" as const,
							currentBranch: "main",
							defaultBranch: "main",
						};
					}
					if (options.branchStatus === "detached-head") {
						return { status: "detached-head" as const, defaultBranch: "main" };
					}
					return {
						status: "feature-branch" as const,
						featureBranch: "feature/one",
						defaultBranch: "main",
					};
				},
				dispatch: options.dispatch,
			},
		},
		prompts,
		results,
	};
}

describe("warden packet tracker extension", () => {
	it("registers default extension factory", () => {
		const pi = createFakePi();
		wardenPacketTracker(pi as unknown as ExtensionAPI);
		assert.ok(pi.handlers.has("input"));
		assert.ok(pi.handlers.has("before_agent_start"));
		assert.ok(pi.handlers.has("agent_end"));
		assert.ok(pi.handlers.has("session_start"));
	});

	it("sets active-flow status on session start and after tracker updates by default", async () => {
		const statuses: StatusUpdate[] = [];
		const pi = createFakePi();
		registerWardenPacketTracker(pi as unknown as ExtensionAPI, {
			now: () => now,
		});

		await runFirstHandler(
			pi,
			"session_start",
			{ reason: "startup" },
			statusCtx(statuses),
		);
		assert.deepEqual(statuses.at(-1), {
			key: ACTIVE_FLOW_STATUS_KEY,
			text: "Active Flow: none",
		});

		await runFirstHandler(pi, "input", {
			text: "/skill:warden-start .warden/work/one/packet.md",
			source: "interactive",
		});
		await runFirstHandler(
			pi,
			"agent_end",
			assistantEnd(
				"Tracker status: success\nPacket name: foo\nPacket path: .warden/work/one/packet.md\nSummary: created",
			),
			statusCtx(statuses),
		);

		assert.deepEqual(statuses.at(-1), {
			key: ACTIVE_FLOW_STATUS_KEY,
			text: "Active Flow: foo - next: warden-grill",
		});
	});

	it("clears and skips active-flow status when explicitly disabled", async () => {
		writeSettings({
			warden: { flow: { showActiveFlowStatus: false } },
		});
		const statuses: StatusUpdate[] = [];
		const pi = createFakePi();
		registerWardenPacketTracker(pi as unknown as ExtensionAPI, {
			now: () => now,
		});

		await runFirstHandler(
			pi,
			"session_start",
			{ reason: "startup" },
			statusCtx(statuses),
		);
		await runFirstHandler(pi, "input", {
			text: "/skill:warden-start .warden/work/one/packet.md",
			source: "interactive",
		});
		await runFirstHandler(
			pi,
			"agent_end",
			assistantEnd(
				"Status: success\nPacket name: foo\nPacket path: .warden/work/one/packet.md",
			),
			statusCtx(statuses),
		);

		assert.deepEqual(statuses, [
			{ key: ACTIVE_FLOW_STATUS_KEY, text: undefined },
			{ key: ACTIVE_FLOW_STATUS_KEY, text: undefined },
		]);
	});

	it("contributes active-flow Display toggle that preserves flow keys and refreshes immediately", async () => {
		const statuses: StatusUpdate[] = [];
		const pi = createFakePi();
		registerWardenPacketTracker(pi as unknown as ExtensionAPI, {
			now: () => now,
		});
		const setting = activeFlowSetting();
		writeSettings({ warden: { flow: { interactionMode: "auto" } } });
		const offCtx = displayCtx({ flow: { interactionMode: "auto" } });

		assert.deepEqual(setting.render(offCtx, 80, true), [
			"> [x] Show active flow status",
			"",
		]);
		const offAction = setting.handleInput?.(" ", offCtx);
		assert.deepEqual(readSettings().warden, {
			flow: { interactionMode: "auto", showActiveFlowStatus: false },
		});
		await handleWardenPaneAction(
			"display",
			offAction as WardenPanelPaneAction,
			{
				pi: pi as unknown as ExtensionAPI,
				commandContext: statusCtx(statuses) as never,
			},
		);
		assert.deepEqual(statuses.at(-1), {
			key: ACTIVE_FLOW_STATUS_KEY,
			text: undefined,
		});

		writeFileSync(
			join(cwd, PACKET_TRACKER_RELATIVE_PATH),
			JSON.stringify({
				version: 1,
				current: {
					packetPath: ".warden/work/one/packet.md",
					packetName: "foo",
					lastStep: "warden-tdd",
					lastStatus: "success",
					lastSummary: "green",
					nextStep: "warden-close",
					timestamp: now,
				},
				queue: [],
				recentCompleted: [],
			}),
			"utf-8",
		);
		const onAction = setting.handleInput?.(
			" ",
			displayCtx({
				flow: { interactionMode: "auto", showActiveFlowStatus: false },
			}),
		);
		assert.deepEqual(readSettings().warden, {
			flow: { interactionMode: "auto", showActiveFlowStatus: true },
		});
		await handleWardenPaneAction("display", onAction as WardenPanelPaneAction, {
			pi: pi as unknown as ExtensionAPI,
			commandContext: statusCtx(statuses) as never,
		});
		assert.deepEqual(statuses.at(-1), {
			key: ACTIVE_FLOW_STATUS_KEY,
			text: "Active Flow: foo - next: warden-close",
		});
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

	it("prompts after successful close on a feature branch and dispatches structured branch close", async () => {
		prepareClosablePacket();
		const pi = createFakePi();
		const dispatched: BranchCloseHandoffPayload[] = [];
		registerWardenPacketTracker(pi as unknown as ExtensionAPI, {
			now: () => now,
		});
		await runFirstHandler(pi, "input", {
			text: "/skill:warden-close .warden/work/one/packet.md",
		});
		const { ctx, prompts, results } = branchCloseCtx({
			choice: "close-branch",
			dispatch: (payload) => dispatched.push(payload),
		});

		await runFirstHandler(
			pi,
			"agent_end",
			assistantEnd(
				wardenCloseOutput(
					"Maps: scoped-refresh\nMaps scope: pi-warden/warden-flow",
				),
			),
			ctx,
		);

		assert.equal(prompts.length, 1);
		assert.match(prompts[0]?.prompt ?? "", /Close branch feature\/one\?/);
		assert.match(prompts[0]?.prompt ?? "", /push main/);
		assert.match(
			prompts[0]?.prompt ?? "",
			/delete remote feature branch feature\/one/,
		);
		assert.match(
			prompts[0]?.prompt ?? "",
			/delete local feature branch feature\/one/,
		);
		assert.match(prompts[0]?.prompt ?? "", /may remove its feature worktree/);
		assert.deepEqual(prompts[0]?.options, [
			"close-branch",
			"skip-branch-close",
		]);
		assert.deepEqual(dispatched, [
			{
				workflow: "warden_branch_close",
				featureBranch: "feature/one",
				defaultBranch: "main",
				maps: "scoped-refresh",
				mapsScope: "pi-warden/warden-flow",
				packetPath: ".warden/work/one/packet.md",
				packetName: "one",
				cwd,
			},
		]);
		assert.deepEqual(results, [
			{ action: "dispatched", payload: dispatched[0] },
		]);
		assert.equal(
			readTracker().recentCompleted[0]?.packetPath,
			".warden/work/one/packet.md",
		);
	});

	it("skips branch close prompt on default branch, detached head, missing maps, or declined prompt", async () => {
		for (const [branchStatus, output, choice, reason] of [
			["default-branch", wardenCloseOutput(), "close-branch", "default-branch"],
			["detached-head", wardenCloseOutput(), "close-branch", "detached-head"],
			[
				"feature-branch",
				wardenCloseOutput(""),
				"close-branch",
				"missing-map-fields",
			],
			["feature-branch", wardenCloseOutput(), "skip-branch-close", "declined"],
		] as const) {
			prepareClosablePacket();
			const pi = createFakePi();
			const dispatched: BranchCloseHandoffPayload[] = [];
			registerWardenPacketTracker(pi as unknown as ExtensionAPI, {
				now: () => now,
			});
			await runFirstHandler(pi, "input", {
				text: "/skill:warden-close .warden/work/one/packet.md",
			});
			const { ctx, prompts, results } = branchCloseCtx({
				choice,
				branchStatus,
				dispatch: (payload) => dispatched.push(payload),
			});

			await runFirstHandler(pi, "agent_end", assistantEnd(output), ctx);

			assert.deepEqual(dispatched, []);
			const result = results.at(-1);
			assert.equal(
				result && typeof result === "object" && "reason" in result
					? result.reason
					: undefined,
				reason,
			);
			assert.equal(prompts.length, reason === "declined" ? 1 : 0);
		}
	});

	it("fails closed with manual next step when branch-close UI or dispatcher is unavailable", async () => {
		for (const [hasUI, choice, dispatch, reason] of [
			[false, "close-branch", undefined, "ui-unavailable"],
			[true, undefined, undefined, "ui-dismissed"],
			[true, "close-branch", undefined, "dispatcher-unavailable"],
		] as const) {
			prepareClosablePacket();
			const pi = createFakePi();
			registerWardenPacketTracker(pi as unknown as ExtensionAPI, {
				now: () => now,
			});
			await runFirstHandler(pi, "input", {
				text: "/skill:warden-close .warden/work/one/packet.md",
			});

			const { ctx, results } = branchCloseCtx({ hasUI, choice, dispatch });
			await runFirstHandler(
				pi,
				"agent_end",
				assistantEnd(wardenCloseOutput()),
				ctx,
			);
			const result = results.at(-1);

			assert.equal(
				result && typeof result === "object" && "reason" in result
					? result.reason
					: undefined,
				reason,
			);
			assert.match(
				result && typeof result === "object" && "manualNextStep" in result
					? String(result.manualNextStep)
					: "",
				/^Manual next step: warden_branch_close /,
			);
		}
	});

	it("rejects unsafe feature branch names before prompt or handoff", async () => {
		prepareClosablePacket();
		const pi = createFakePi();
		registerWardenPacketTracker(pi as unknown as ExtensionAPI, {
			now: () => now,
		});
		await runFirstHandler(pi, "input", {
			text: "/skill:warden-close .warden/work/one/packet.md",
		});
		const { ctx, prompts, results } = branchCloseCtx({
			choice: "close-branch",
			dispatch: () => assert.fail("unsafe branch should not dispatch"),
		});
		const unsafeCtx = {
			...ctx,
			branchClose: {
				...ctx.branchClose,
				detectContext: () => ({
					status: "feature-branch" as const,
					featureBranch: "feature;rm-rf",
					defaultBranch: "main",
				}),
			},
		};

		await runFirstHandler(
			pi,
			"agent_end",
			assistantEnd(wardenCloseOutput()),
			unsafeCtx,
		);
		const result = results.at(-1);

		assert.deepEqual(prompts, []);
		assert.deepEqual(result, {
			action: "skipped",
			reason: "unsafe-branch-name",
			branch: "feature;rm-rf",
		});
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
