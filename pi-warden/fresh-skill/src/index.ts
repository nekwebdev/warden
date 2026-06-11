import { fuzzyFilter } from "@earendil-works/pi-tui";

export type FreshCommandEntry = {
	name?: string;
	description?: string;
	source?: string;
};

export type FreshSkillCommand = {
	name: string;
	description?: string;
};

export type FreshCompletionItem = {
	value: string;
	label: string;
	description?: string;
};

export type ParsedFreshArguments = {
	skillName: string;
	remainder: string;
};

export function normalizeFreshSkillName(input: string): string {
	return input.startsWith("skill:") ? input.slice("skill:".length) : input;
}

export function parseFreshArguments(args: string): ParsedFreshArguments | null {
	const match = args.match(/^\s*(\S+)([\s\S]*)$/);
	if (!match) return null;
	const skillName = normalizeFreshSkillName(match[1]);
	if (!skillName) return null;
	return { skillName, remainder: match[2] ?? "" };
}

export function buildFreshReplayMessage(
	skillName: string,
	remainder: string,
): string {
	return `/skill:${skillName}${remainder}`;
}

export function selectFreshSkillCommands(
	commands: FreshCommandEntry[],
): FreshSkillCommand[] {
	return commands
		.filter((command) => command.source === "skill")
		.map((command) => ({
			name: normalizeFreshSkillName(command.name ?? ""),
			description: command.description,
		}))
		.filter((command) => command.name.length > 0);
}

function firstArgumentPrefix(prefix: string): string | null {
	const match = prefix.match(/^\s*(\S*)([\s\S]*)$/);
	if (!match) return "";
	const firstToken = match[1] ?? "";
	const remainder = match[2] ?? "";
	if (firstToken && /\s/.test(remainder)) return null;
	return normalizeFreshSkillName(firstToken);
}

export function getFreshSkillCompletions(
	commands: FreshCommandEntry[],
	prefix: string,
): FreshCompletionItem[] | null {
	const normalizedPrefix = firstArgumentPrefix(prefix);
	if (normalizedPrefix === null) return null;
	const matches = fuzzyFilter(
		selectFreshSkillCommands(commands),
		normalizedPrefix,
		(command) => command.name,
	).map((command) => ({
		value: command.name,
		label: command.name,
		description: command.description,
	}));
	return matches.length > 0 ? matches : null;
}

export async function handleFreshCommand(
	pi: {
		getCommands(): FreshCommandEntry[];
	},
	args: string,
	ctx: {
		isIdle(): boolean;
		ui: { notify(message: string, level: "info" | "warning" | "error"): void };
		sessionManager: { getSessionFile(): string | undefined };
		newSession(options: {
			parentSession?: string;
			withSession(ctx: {
				sendUserMessage(message: string): Promise<void>;
			}): Promise<void>;
		}): Promise<{ cancelled?: boolean }>;
	},
): Promise<void> {
	const parsed = parseFreshArguments(args);
	if (!parsed) {
		ctx.ui.notify("Usage: /fresh <skill> [args...]", "error");
		return;
	}

	const loadedSkillNames = new Set(
		selectFreshSkillCommands(pi.getCommands()).map((skill) => skill.name),
	);
	if (!loadedSkillNames.has(parsed.skillName)) {
		ctx.ui.notify(`Unknown skill: ${parsed.skillName}`, "error");
		return;
	}

	if (!ctx.isIdle()) {
		ctx.ui.notify(
			"Agent is busy. Wait until current turn finishes before /fresh.",
			"error",
		);
		return;
	}

	const replayMessage = buildFreshReplayMessage(
		parsed.skillName,
		parsed.remainder,
	);
	const parentSession = ctx.sessionManager.getSessionFile();
	const result = await ctx.newSession({
		parentSession,
		withSession: async (replacementCtx) => {
			await replacementCtx.sendUserMessage(replayMessage);
		},
	});

	if (result.cancelled) {
		ctx.ui.notify("New session cancelled", "info");
	}
}
