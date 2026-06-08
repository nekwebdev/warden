import { statusNote } from "../status-note.ts";
import { buildNotificationPreview } from "../usage.ts";

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
	setText(text: string): void {
		this.text = text;
	}
	render(_width: number): string[] {
		return this.text.split("\n");
	}
	invalidate(): void {}
}

export function renderAgentCall(
	args: Record<string, unknown>,
	theme: ThemeLike,
	context: { lastComponent?: unknown } = {},
): ComponentLike {
	const component = reusableText(context.lastComponent);
	const agentType = stringValue(args.subagent_type) ?? "general-purpose";
	const description = stringValue(args.description);
	const background = args.run_in_background === true ? " background" : "";
	component.setText(
		[
			color(theme, "toolTitle", bold(theme, `Agent ${agentType}`)),
			background ? color(theme, "muted", background) : undefined,
			description ? color(theme, "dim", ` — ${description}`) : undefined,
		]
			.filter(Boolean)
			.join(""),
	);
	return component;
}

export function renderAgentResult(
	result: {
		content?: Array<{ type: string; text?: string }>;
		details?: Record<string, unknown>;
	},
	options: { expanded?: boolean; isPartial?: boolean } = {},
	theme: ThemeLike,
	context: { lastComponent?: unknown } = {},
): ComponentLike {
	const component = reusableText(context.lastComponent);
	if (options.isPartial) {
		component.setText(color(theme, "warning", "Agent running…"));
		return component;
	}
	const details = result.details ?? {};
	const status = stringValue(details.status) ?? "completed";
	const label = statusNote(status);
	const agentType = stringValue(details.agentType);
	const description = stringValue(details.description);
	const output = resultText(result);
	const shown = options.expanded ? output : buildNotificationPreview(output);
	const lines = [
		`${statusColor(theme, status, label)}${agentType ? ` · ${agentType}` : ""}${description ? ` · ${description}` : ""}`,
	];
	if (shown) lines.push(shown);
	component.setText(lines.join("\n"));
	return component;
}

function resultText(result: {
	content?: Array<{ type: string; text?: string }>;
}): string {
	return (result.content ?? [])
		.map((part) => (part.type === "text" && part.text ? part.text : ""))
		.filter(Boolean)
		.join("\n");
}

function statusColor(theme: ThemeLike, status: string, text: string): string {
	if (status === "completed" || status === "fallback") {
		return color(theme, "success", text);
	}
	if (status === "error" || status === "aborted") {
		return color(theme, "error", text);
	}
	if (
		status === "steered" ||
		status === "unsupported" ||
		status === "disabled"
	) {
		return color(theme, "warning", text);
	}
	return color(theme, "muted", text);
}

function reusableText(component: unknown): StaticText {
	return component instanceof StaticText ? component : new StaticText("");
}

function stringValue(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value : undefined;
}

function color(theme: ThemeLike, name: string, value: string): string {
	return theme.fg ? theme.fg(name, value) : value;
}

function bold(theme: ThemeLike, value: string): string {
	return theme.bold ? theme.bold(value) : value;
}
