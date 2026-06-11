import { execFileSync } from "node:child_process";
import { basename } from "node:path";

export const ASK_USER_PROMPT_EVENT = "rpiv:ask-user:prompt";
export const WARDEN_TMUX_READY_ROBOT = "󱚤";
export const WARDEN_TMUX_WAITING_ROBOT = "󱚥";

export interface TmuxWindowOperations {
	readonly isAvailable: () => boolean;
	readonly getWindowName: () => string | undefined;
	readonly renameWindow: (name: string) => boolean;
}

export interface TmuxQuestionAlertOptions {
	readonly intervalMs?: number;
	readonly readyGlyph?: string;
	readonly waitingGlyph?: string;
	readonly operations?: TmuxWindowOperations;
}

export interface LinuxNotificationOperations {
	readonly notify: (title: string, body: string) => boolean;
}

export interface LinuxNotificationCommand {
	readonly command: string;
	readonly args: readonly string[];
}

export type LinuxNotificationExecutor = (
	command: string,
	args: readonly string[],
) => void;

export interface AskUserPromptPayload {
	readonly questions?: ReadonlyArray<{
		readonly question?: unknown;
	}>;
}

type TimerHandle = ReturnType<typeof setInterval>;

export class TmuxQuestionAlert {
	private readonly intervalMs: number;
	private readonly readyGlyph: string;
	private readonly waitingGlyph: string;
	private readonly operations: TmuxWindowOperations;
	private timer: TimerHandle | undefined;
	private baseWindowName: string | undefined;
	private showingWaitingGlyph = false;

	constructor(options: TmuxQuestionAlertOptions = {}) {
		this.intervalMs = options.intervalMs ?? 700;
		this.readyGlyph = options.readyGlyph ?? WARDEN_TMUX_READY_ROBOT;
		this.waitingGlyph = options.waitingGlyph ?? WARDEN_TMUX_WAITING_ROBOT;
		this.operations = options.operations ?? createTmuxWindowOperations();
	}

	start(): void {
		if (this.timer) return;
		if (!this.operations.isAvailable()) return;

		const currentName = this.operations.getWindowName();
		const baseName = baseRobotWindowName(
			currentName,
			this.readyGlyph,
			this.waitingGlyph,
		);
		if (!baseName) return;

		this.baseWindowName = baseName;
		this.showingWaitingGlyph = false;
		this.flashOnce();
		this.timer = setInterval(() => this.flashOnce(), this.intervalMs);
		this.timer.unref?.();
	}

	flashOnce(): void {
		if (!this.baseWindowName) return;
		this.showingWaitingGlyph = !this.showingWaitingGlyph;
		this.operations.renameWindow(
			robotWindowNameForFrame(this.baseWindowName, {
				readyGlyph: this.readyGlyph,
				waitingGlyph: this.waitingGlyph,
				waiting: this.showingWaitingGlyph,
			}),
		);
	}

	stop(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = undefined;
		}
		const baseName = this.baseWindowName;
		this.baseWindowName = undefined;
		this.showingWaitingGlyph = false;
		if (baseName) this.operations.renameWindow(baseName);
	}
}

export function createTmuxWindowOperations(): TmuxWindowOperations {
	return {
		isAvailable: () => Boolean(process.env.TMUX),
		getWindowName: () => {
			try {
				return execFileSync(
					"tmux",
					tmuxArgsWithPaneTarget(["display-message", "-p", "#W"]),
					{
						encoding: "utf-8",
						stdio: ["ignore", "pipe", "ignore"],
					},
				).trimEnd();
			} catch {
				return undefined;
			}
		},
		renameWindow: (name: string) => {
			try {
				execFileSync("tmux", tmuxArgsWithPaneTarget(["rename-window", name]), {
					stdio: "ignore",
				});
				return true;
			} catch {
				return false;
			}
		},
	};
}

export function tmuxArgsWithPaneTarget(
	args: readonly string[],
	pane = process.env.TMUX_PANE,
): string[] {
	if (!pane) return [...args];
	const [command, ...rest] = args;
	return command ? [command, "-t", pane, ...rest] : [];
}

export function createLinuxNotificationOperations(): LinuxNotificationOperations {
	return {
		notify: (title: string, body: string) => sendLinuxNotification(title, body),
	};
}

export function sendLinuxNotification(
	title: string,
	body: string,
	execCommand: LinuxNotificationExecutor = execLinuxNotificationCommand,
): boolean {
	for (const { command, args } of linuxNotificationCommands(title, body)) {
		try {
			execCommand(command, args);
			return true;
		} catch {
			// Try next notifier.
		}
	}
	return false;
}

export function linuxNotificationCommands(
	title: string,
	body: string,
): LinuxNotificationCommand[] {
	return [
		{ command: "notify-send", args: [title, body] },
		{ command: "dms", args: ["notify", title, body] },
	];
}

function execLinuxNotificationCommand(
	command: string,
	args: readonly string[],
): void {
	execFileSync(command, [...args], { stdio: "ignore" });
}

export function questionNotificationBody(payload: unknown): string | undefined {
	const questions = (payload as AskUserPromptPayload | undefined)?.questions;
	if (!Array.isArray(questions)) return undefined;
	const questionText = questions
		.map((question) =>
			typeof question.question === "string" ? question.question.trim() : "",
		)
		.filter((question) => question.length > 0);
	if (questionText.length === 0) return undefined;
	if (questionText.length === 1) return questionText[0];
	return questionText
		.map((question, index) => `${index + 1}. ${question}`)
		.join("\n");
}

export function questionNotificationTitle(
	agentName: string | undefined,
): string {
	const displayName = agentName?.trim() || "unknown agent";
	return `Question ready from ${displayName}`;
}

export function resolveQuestionAgentName(
	env: Record<string, string | undefined> = process.env,
): string | undefined {
	const explicit = env.WARDEN_AGENT_NAME?.trim();
	if (explicit) return explicit;
	const agentDir = env.PI_CODING_AGENT_DIR?.trim();
	if (!agentDir) return undefined;
	const name = basename(agentDir).trim();
	return name || undefined;
}

export function baseRobotWindowName(
	name: string | undefined,
	readyGlyph = WARDEN_TMUX_READY_ROBOT,
	waitingGlyph = WARDEN_TMUX_WAITING_ROBOT,
): string | undefined {
	if (!name) return undefined;
	if (name.startsWith(readyGlyph)) return name;
	if (name.startsWith(waitingGlyph)) {
		return `${readyGlyph}${name.slice(waitingGlyph.length)}`;
	}
	return undefined;
}

export function robotWindowNameForFrame(
	baseName: string,
	options: {
		readonly waiting: boolean;
		readonly readyGlyph?: string;
		readonly waitingGlyph?: string;
	} = { waiting: false },
): string {
	const readyGlyph = options.readyGlyph ?? WARDEN_TMUX_READY_ROBOT;
	const waitingGlyph = options.waitingGlyph ?? WARDEN_TMUX_WAITING_ROBOT;
	const normalized = baseRobotWindowName(baseName, readyGlyph, waitingGlyph);
	const suffix = normalized ? normalized.slice(readyGlyph.length) : baseName;
	return `${options.waiting ? waitingGlyph : readyGlyph}${suffix}`;
}
