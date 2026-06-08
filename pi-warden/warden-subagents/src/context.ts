const PARENT_CONTEXT_LIMIT = 6000;
const TRUNCATION_MARKER = "[parent conversation truncated to 6000 chars]";

type AnyEntry = Record<string, unknown>;

export interface BuildTaskPromptOptions {
	prompt: string;
	inheritContext: boolean;
	parentEntries?: AnyEntry[];
	limit?: number;
}

export function buildTaskPrompt(options: BuildTaskPromptOptions): string {
	const prompt = options.prompt.trim();
	if (!options.inheritContext) return prompt;

	const bridge = buildParentConversationBridge(
		options.parentEntries ?? [],
		options.limit ?? PARENT_CONTEXT_LIMIT,
	);
	if (!bridge) return prompt;
	return `${bridge}\n\n## Delegated Task\n${prompt}`;
}

export function buildParentConversationBridge(
	entries: AnyEntry[],
	limit = PARENT_CONTEXT_LIMIT,
): string {
	const visible = entries
		.map(extractVisibleMessage)
		.filter((value): value is string => value.length > 0);
	if (visible.length === 0) return "";

	let body = visible.join("\n\n");
	if (body.length > limit) {
		body = `${TRUNCATION_MARKER}\n${body.slice(body.length - limit)}`;
	}
	return `## Parent Conversation Bridge\n${body}`;
}

function extractVisibleMessage(entry: AnyEntry): string {
	const message = (entry.message ?? entry) as Record<string, unknown>;
	const role = message.role;
	if (role !== "user" && role !== "assistant") return "";
	const text = extractText(message.content);
	if (!text) return "";
	return `${role}: ${text}`;
}

function extractText(content: unknown): string {
	if (typeof content === "string") return content.trim();
	if (!Array.isArray(content)) return "";
	return content
		.map((part) => {
			if (!part || typeof part !== "object") return "";
			const maybeText = (part as Record<string, unknown>).text;
			return typeof maybeText === "string" ? maybeText : "";
		})
		.filter(Boolean)
		.join("\n")
		.trim();
}
