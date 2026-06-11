import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	ASK_USER_PROMPT_EVENT,
	createLinuxNotificationOperations,
	questionNotificationBody,
	questionNotificationTitle,
	resolveQuestionAgentName,
	TmuxQuestionAlert,
	type LinuxNotificationOperations,
	type TmuxQuestionAlertOptions,
} from "../../src/tmux-question-alert.js";

type ToolCompletionEvent = {
	readonly toolName?: string;
};

export interface WardenTmuxQuestionAlertOptions
	extends TmuxQuestionAlertOptions {
	readonly alert?: Pick<TmuxQuestionAlert, "start" | "stop">;
	readonly agentName?: string;
	readonly env?: Record<string, string | undefined>;
	readonly notifications?: LinuxNotificationOperations;
}

export function registerWardenTmuxQuestionAlert(
	pi: ExtensionAPI,
	options: WardenTmuxQuestionAlertOptions = {},
): void {
	const alert = options.alert ?? new TmuxQuestionAlert(options);
	const notifications =
		options.notifications ?? createLinuxNotificationOperations();
	let active = false;
	let unsubscribePrompt: (() => void) | undefined;

	function startAlert(payload: unknown): void {
		active = true;
		alert.start();
		notifyQuestionReady(payload);
	}

	function notifyQuestionReady(payload: unknown): void {
		const body = questionNotificationBody(payload);
		if (!body) return;
		const agentName =
			options.agentName ?? resolveQuestionAgentName(options.env);
		notifications.notify(questionNotificationTitle(agentName), body);
	}

	function stopAlert(): void {
		if (!active) return;
		active = false;
		alert.stop();
	}

	function stopForAskUserQuestion(event: ToolCompletionEvent): void {
		if (event.toolName === "ask_user_question") stopAlert();
	}

	unsubscribePrompt = pi.events.on(ASK_USER_PROMPT_EVENT, startAlert);
	pi.on("tool_result", stopForAskUserQuestion);
	pi.on("tool_execution_end", stopForAskUserQuestion);
	pi.on("agent_end", stopAlert);
	pi.on("session_shutdown", () => {
		unsubscribePrompt?.();
		unsubscribePrompt = undefined;
		stopAlert();
	});
}

export default function wardenTmuxQuestionAlert(pi: ExtensionAPI): void {
	registerWardenTmuxQuestionAlert(pi);
}
