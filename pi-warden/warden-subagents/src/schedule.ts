import type { ForegroundAgentParams } from "./invocation-config.ts";
import type { AgentToolResultLike } from "./agent-manager.ts";

export type ScheduleParseResult =
	| {
			status: "ok";
			runAt: string;
			delayMs: number;
			kind: "relative" | "absolute";
	  }
	| { status: "error"; message: string; deferred?: "cron" | "interval" };

export type ScheduledAgentParamsValidation =
	| { status: "ok" }
	| { status: "error"; message: string };

export interface ScheduledAgentDetails {
	status: "scheduled";
	scheduleId: string;
	nextRunAt: string;
	agentType?: string;
	requestedAgentType?: string;
	description?: string;
}

const RELATIVE_UNITS: Record<string, number> = {
	s: 1_000,
	m: 60_000,
	h: 60 * 60_000,
	d: 24 * 60 * 60_000,
};

export function parseOneShotSchedule(
	value: string,
	options: { now?: number } = {},
): ScheduleParseResult {
	const now = options.now ?? Date.now();
	const input = String(value ?? "").trim();
	if (isCronSchedule(input)) {
		return {
			status: "error",
			deferred: "cron",
			message:
				"Cron schedules are deferred; use a one-shot +Ns/+Nm/+Nh/+Nd or timezone-explicit ISO timestamp.",
		};
	}
	if (isIntervalSchedule(input)) {
		return {
			status: "error",
			deferred: "interval",
			message:
				"Interval schedules are deferred; use a one-shot +Ns/+Nm/+Nh/+Nd or timezone-explicit ISO timestamp.",
		};
	}

	const relative = /^\+([1-9]\d*)([smhd])$/.exec(input);
	if (relative) {
		const amount = Number(relative[1]);
		const delayMs = amount * RELATIVE_UNITS[relative[2]];
		return {
			status: "ok",
			kind: "relative",
			delayMs,
			runAt: new Date(now + delayMs).toISOString(),
		};
	}

	if (looksLikeIso(input)) {
		if (!hasExplicitTimezone(input)) {
			return {
				status: "error",
				message:
					"Absolute schedule values must include an explicit timezone (`Z` or offset).",
			};
		}
		const runAtMs = Date.parse(input);
		if (!Number.isFinite(runAtMs)) {
			return {
				status: "error",
				message: "Invalid absolute schedule timestamp.",
			};
		}
		if (runAtMs <= now) {
			return {
				status: "error",
				message: "Schedule time must be in the future.",
			};
		}
		return {
			status: "ok",
			kind: "absolute",
			delayMs: runAtMs - now,
			runAt: new Date(runAtMs).toISOString(),
		};
	}

	return {
		status: "error",
		message:
			"Invalid schedule. Use positive one-shot values like +10s, +5m, +2h, +1d, or timezone-explicit ISO timestamps.",
	};
}

export function validateScheduledAgentParams(
	params: ForegroundAgentParams,
): ScheduledAgentParamsValidation {
	if (!params.schedule) return { status: "ok" };
	if (Object.hasOwn(params, "inherit_context")) {
		return {
			status: "error",
			message:
				"schedule cannot combine with inherit_context; scheduled agents never inherit parent context.",
		};
	}
	if (params.resume) {
		return {
			status: "error",
			message:
				"schedule cannot combine with resume; scheduled resume is deferred.",
		};
	}
	if (Object.hasOwn(params, "run_in_background")) {
		return {
			status: "error",
			message:
				"schedule cannot combine with run_in_background; scheduled agents run later in background automatically.",
		};
	}
	return { status: "ok" };
}

export function scheduledTextResult(
	details: ScheduledAgentDetails,
): AgentToolResultLike {
	return {
		content: [
			{
				type: "text",
				text: `Scheduled agent ${details.scheduleId} for ${details.nextRunAt}.`,
			},
		],
		details,
	};
}

export function scheduleErrorResult(message: string): AgentToolResultLike {
	return {
		content: [{ type: "text", text: message }],
		details: { status: "error", error: message },
	};
}

function isCronSchedule(input: string): boolean {
	if (/^cron:/i.test(input)) return true;
	const fields = input.split(/\s+/).filter(Boolean);
	return (
		fields.length >= 5 &&
		fields.every((field) => /^[\d*/?,#L\-A-Z]+$/i.test(field))
	);
}

function isIntervalSchedule(input: string): boolean {
	return /^(every|interval:|repeat:)/i.test(input) || /^\*\//.test(input);
}

function looksLikeIso(input: string): boolean {
	return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(input);
}

function hasExplicitTimezone(input: string): boolean {
	return /(Z|[+-]\d{2}:\d{2})$/i.test(input);
}
