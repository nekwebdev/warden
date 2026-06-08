import { statusNote } from "../status-note.ts";
import {
	buildNotificationPreview,
	extractPassiveUsage,
	mergePassiveUsage,
	type PassiveUsageSnapshot,
} from "../usage.ts";

export const SUBAGENT_NOTIFICATION_TYPE = "subagent-notification";

interface ThemeLike {
	fg?: (name: string, value: string) => string;
	bold?: (value: string) => string;
}

interface ComponentLike {
	render(width: number): string[];
	invalidate(): void;
}

class StaticText implements ComponentLike {
	constructor(private text: string) {}
	render(_width: number): string[] {
		return this.text.split("\n");
	}
	invalidate(): void {}
}

export interface SubagentNotificationDetails extends PassiveUsageSnapshot {
	agentId: string;
	status: string;
	statusNote: string;
	agentType?: string;
	requestedAgentType?: string;
	description?: string;
	resultPreview: string;
	error?: string;
	transcriptPath: string | null;
	transcriptNote: string;
}

export interface SubagentNotificationPayload {
	customType: typeof SUBAGENT_NOTIFICATION_TYPE;
	content: string;
	display: true;
	details: SubagentNotificationDetails;
}

export function buildSubagentNotificationPayload(result: {
	content?: Array<{ type: string; text?: string }>;
	details?: object;
}): SubagentNotificationPayload {
	const details = (result.details ?? {}) as Record<string, unknown>;
	const status = stringValue(details.status) ?? "completed";
	const agentId = stringValue(details.agentId) ?? "unknown";
	const preview = buildNotificationPreview(resultText(result));
	const passive = mergePassiveUsage(
		extractPassiveUsage(details),
		extractPassiveUsage({ usage: details.usage }),
	);
	const notificationDetails: SubagentNotificationDetails = {
		...passive,
		agentId,
		status,
		statusNote: statusNote(status),
		agentType: stringValue(details.agentType),
		requestedAgentType: stringValue(details.requestedAgentType),
		description: stringValue(details.description),
		resultPreview: preview,
		error: stringValue(details.error),
		transcriptPath: null,
		transcriptNote: "transcript unavailable in this slice",
	};

	return {
		customType: SUBAGENT_NOTIFICATION_TYPE,
		content: buildTaskNotificationContent(notificationDetails),
		display: true,
		details: notificationDetails,
	};
}

export function sendSubagentNotification(
	pi: unknown,
	ctx: unknown,
	result: {
		content?: Array<{ type: string; text?: string }>;
		details?: object;
	},
): boolean {
	const sender =
		pi && typeof pi === "object"
			? (pi as { sendMessage?: unknown }).sendMessage
			: undefined;
	if (typeof sender !== "function" || !uiPermitsNotification(ctx)) return false;
	sender.call(pi, buildSubagentNotificationPayload(result), {
		deliverAs: "followUp",
		triggerTurn: true,
	});
	return true;
}

export function renderSubagentNotification(
	message: { content?: string; details?: object },
	options: { expanded?: boolean } = {},
	theme: ThemeLike = {},
): ComponentLike {
	const details = (message.details ??
		{}) as Partial<SubagentNotificationDetails>;
	const status = details.status ?? "completed";
	const heading = `${color(theme, status === "completed" ? "success" : status === "error" ? "error" : "warning", `Subagent ${details.agentId ?? "unknown"} ${details.statusNote ?? statusNote(status)}`)}`;
	const lines = [heading];
	if (details.description) lines.push(`Task: ${details.description}`);
	if (details.agentType) lines.push(`Agent: ${details.agentType}`);
	if (details.resultPreview) lines.push(`Result: ${details.resultPreview}`);
	if (details.error) lines.push(`Error: ${details.error}`);
	lines.push(details.transcriptNote ?? "transcript unavailable in this slice");
	if (options.expanded && message.content) lines.push("", message.content);
	return new StaticText(lines.join("\n"));
}

function buildTaskNotificationContent(
	details: SubagentNotificationDetails,
): string {
	return [
		"<task-notification>",
		tag("agent-id", details.agentId),
		tag("status", details.status),
		tag("status-note", details.statusNote),
		tag("agent-type", details.agentType ?? ""),
		tag("description", details.description ?? ""),
		tag("result-preview", details.resultPreview),
		tag("transcript", details.transcriptNote),
		"</task-notification>",
	].join("\n");
}

function tag(name: string, value: string): string {
	return `<${name}>${escapeXml(value)}</${name}>`;
}

function escapeXml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

function resultText(result: {
	content?: Array<{ type: string; text?: string }>;
}): string {
	return (result.content ?? [])
		.map((part) => (part.type === "text" && part.text ? part.text : ""))
		.filter(Boolean)
		.join("\n");
}

function stringValue(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value : undefined;
}

function color(theme: ThemeLike, name: string, value: string): string {
	return theme.fg ? theme.fg(name, value) : value;
}

function uiPermitsNotification(ctx: unknown): boolean {
	if (!ctx || typeof ctx !== "object") return false;
	const hasUI = (ctx as { hasUI?: unknown }).hasUI;
	const mode = (ctx as { mode?: unknown }).mode;
	return hasUI !== false && mode !== "print" && mode !== "json";
}
