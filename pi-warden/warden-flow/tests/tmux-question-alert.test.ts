import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerWardenTmuxQuestionAlert } from "../extensions/warden-tmux-question-alert/index.js";
import {
	ASK_USER_PROMPT_EVENT,
	baseRobotWindowName,
	linuxNotificationCommands,
	questionNotificationBody,
	questionNotificationTitle,
	resolveQuestionAgentName,
	sendLinuxNotification,
	robotWindowNameForFrame,
	TmuxQuestionAlert,
	tmuxArgsWithPaneTarget,
	WARDEN_TMUX_READY_ROBOT,
	WARDEN_TMUX_WAITING_ROBOT,
	type TmuxWindowOperations,
} from "../src/tmux-question-alert.js";

type Handler = (event?: unknown, ctx?: unknown) => unknown;

function createFakePi() {
	const handlers = new Map<string, Handler[]>();
	const eventHandlers = new Map<string, Array<(data: unknown) => void>>();
	return {
		handlers,
		eventHandlers,
		on(name: string, handler: Handler) {
			handlers.set(name, [...(handlers.get(name) ?? []), handler]);
		},
		events: {
			on(name: string, handler: (data: unknown) => void) {
				eventHandlers.set(name, [...(eventHandlers.get(name) ?? []), handler]);
				return () => {
					eventHandlers.set(
						name,
						(eventHandlers.get(name) ?? []).filter((h) => h !== handler),
					);
				};
			},
			emit(name: string, data: unknown) {
				for (const handler of eventHandlers.get(name) ?? []) handler(data);
			},
		},
	};
}

function runHandlers(
	pi: ReturnType<typeof createFakePi>,
	name: string,
	event?: unknown,
): void {
	for (const handler of pi.handlers.get(name) ?? []) handler(event, {});
}

describe("tmux question alert", () => {
	it("maps the ready robot glyph to the waiting robot glyph", () => {
		assert.equal(WARDEN_TMUX_READY_ROBOT, "󱚤");
		assert.equal(WARDEN_TMUX_WAITING_ROBOT, "󱚥");
		assert.equal(baseRobotWindowName("󱚤 sentinel"), "󱚤 sentinel");
		assert.equal(baseRobotWindowName("󱚥 sentinel"), "󱚤 sentinel");
		assert.equal(baseRobotWindowName("shell"), undefined);
		assert.equal(
			robotWindowNameForFrame("󱚤 sentinel", { waiting: true }),
			"󱚥 sentinel",
		);
		assert.equal(
			robotWindowNameForFrame("󱚤 sentinel", { waiting: false }),
			"󱚤 sentinel",
		);
	});

	it("targets the Pi pane when building tmux commands", () => {
		assert.deepEqual(
			tmuxArgsWithPaneTarget(["display-message", "-p", "#W"], "%7"),
			["display-message", "-t", "%7", "-p", "#W"],
		);
		assert.deepEqual(
			tmuxArgsWithPaneTarget(["rename-window", "󱚥 piper"], "%7"),
			["rename-window", "-t", "%7", "󱚥 piper"],
		);
		assert.deepEqual(tmuxArgsWithPaneTarget(["rename-window", "󱚥 piper"], ""), [
			"rename-window",
			"󱚥 piper",
		]);
	});

	it("flashes only prefixed tmux windows and restores the base name", () => {
		const renamed: string[] = [];
		let currentName = "󱚤 piper";
		const operations: TmuxWindowOperations = {
			isAvailable: () => true,
			getWindowName: () => currentName,
			renameWindow: (name) => {
				renamed.push(name);
				currentName = name;
				return true;
			},
		};
		const alert = new TmuxQuestionAlert({ operations, intervalMs: 60_000 });

		alert.start();
		alert.flashOnce();
		alert.stop();

		assert.deepEqual(renamed, ["󱚥 piper", "󱚤 piper", "󱚤 piper"]);
	});

	it("ignores missing tmux and non-Warden window names", () => {
		const renamed: string[] = [];
		const unavailable = new TmuxQuestionAlert({
			operations: {
				isAvailable: () => false,
				getWindowName: () => "󱚤 piper",
				renameWindow: (name) => {
					renamed.push(name);
					return true;
				},
			},
		});
		unavailable.start();
		unavailable.stop();

		const unprefixed = new TmuxQuestionAlert({
			operations: {
				isAvailable: () => true,
				getWindowName: () => "shell",
				renameWindow: (name) => {
					renamed.push(name);
					return true;
				},
			},
		});
		unprefixed.start();
		unprefixed.stop();

		assert.deepEqual(renamed, []);
	});

	it("falls back from notify-send to dms notify", () => {
		assert.deepEqual(linuxNotificationCommands("Title", "Body"), [
			{ command: "notify-send", args: ["Title", "Body"] },
			{ command: "dms", args: ["notify", "Title", "Body"] },
		]);

		const attempts: Array<{ command: string; args: readonly string[] }> = [];
		const ok = sendLinuxNotification("Title", "Body", (command, args) => {
			attempts.push({ command, args });
			if (command === "notify-send") throw new Error("missing");
		});

		assert.equal(ok, true);
		assert.deepEqual(attempts, [
			{ command: "notify-send", args: ["Title", "Body"] },
			{ command: "dms", args: ["notify", "Title", "Body"] },
		]);
	});

	it("formats Linux question notifications", () => {
		assert.equal(
			questionNotificationBody({
				questions: [{ question: "Which path?" }],
			}),
			"Which path?",
		);
		assert.equal(
			questionNotificationBody({
				questions: [{ question: "First?" }, { question: "Second?" }],
			}),
			"1. First?\n2. Second?",
		);
		assert.equal(questionNotificationBody({ questions: [] }), undefined);
		assert.equal(
			questionNotificationTitle("piper"),
			"Question ready from piper",
		);
		assert.equal(
			resolveQuestionAgentName({ PI_CODING_AGENT_DIR: "/tmp/pi-agents/piper" }),
			"piper",
		);
		assert.equal(
			resolveQuestionAgentName({
				WARDEN_AGENT_NAME: "sentinel",
				PI_CODING_AGENT_DIR: "/tmp/pi-agents/piper",
			}),
			"sentinel",
		);
	});

	it("starts and notifies on rpiv ask-user prompt events then stops on completion", () => {
		const calls: string[] = [];
		const notifications: Array<{ title: string; body: string }> = [];
		const pi = createFakePi();
		registerWardenTmuxQuestionAlert(pi as unknown as ExtensionAPI, {
			agentName: "piper",
			alert: {
				start: () => calls.push("start"),
				stop: () => calls.push("stop"),
			},
			notifications: {
				notify: (title, body) => {
					notifications.push({ title, body });
					return true;
				},
			},
		});

		pi.events.emit(ASK_USER_PROMPT_EVENT, {
			questions: [{ question: "Which path should fresh use?" }],
		});
		runHandlers(pi, "tool_result", { toolName: "bash" });
		runHandlers(pi, "tool_result", { toolName: "ask_user_question" });

		assert.deepEqual(calls, ["start", "stop"]);
		assert.deepEqual(notifications, [
			{
				title: "Question ready from piper",
				body: "Which path should fresh use?",
			},
		]);
	});

	it("unsubscribes and clears active flash on shutdown", () => {
		const calls: string[] = [];
		const pi = createFakePi();
		registerWardenTmuxQuestionAlert(pi as unknown as ExtensionAPI, {
			alert: {
				start: () => calls.push("start"),
				stop: () => calls.push("stop"),
			},
		});

		pi.events.emit(ASK_USER_PROMPT_EVENT, { questions: [] });
		runHandlers(pi, "session_shutdown", { reason: "quit" });
		pi.events.emit(ASK_USER_PROMPT_EVENT, { questions: [] });

		assert.deepEqual(calls, ["start", "stop"]);
	});
});
