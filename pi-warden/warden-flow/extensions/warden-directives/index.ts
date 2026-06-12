import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	buildWardenFlowDirectiveMessage,
	resolveWardenFlowInteractionMode,
	wardenFlowSkillNameFromText,
	type WardenFlowDirectiveMessage,
	type WardenFlowInteractionMode,
} from "../../src/runtime-directives.js";
import {
	analyzeWardenStartSelection,
	buildWardenStartSelectionDirectiveMessage,
	executeWardenStartAutoBranch,
	type WardenStartGitExec,
	type WardenStartSelection,
} from "../../src/warden-start-selection.js";

type PendingDirective = {
	readonly skillName: string;
	readonly interactionMode: WardenFlowInteractionMode;
};

type InputEvent = {
	readonly text: string;
	readonly source?: string;
};

type BeforeAgentStartEvent = {
	readonly prompt: string;
};

type EventContext = {
	readonly cwd?: string;
};

type PreparedWardenStartDirective = {
	readonly message: WardenFlowDirectiveMessage;
	readonly transformedText: string;
};

export function registerWardenDirectives(pi: ExtensionAPI): void {
	let pendingDirective: PendingDirective | undefined;
	let pendingMessage: WardenFlowDirectiveMessage | undefined;

	function clearPending(): void {
		pendingDirective = undefined;
		pendingMessage = undefined;
	}

	pi.on("input", async (event: InputEvent, ctx?: EventContext) => {
		if (event.source === "extension") return { action: "continue" } as const;

		const prepared = await prepareWardenStartDirective(
			pi,
			event.text,
			ctx?.cwd,
		);
		if (prepared) {
			pendingMessage = prepared.message;
			return prepared.transformedText === event.text
				? ({ action: "continue" } as const)
				: ({ action: "transform", text: prepared.transformedText } as const);
		}

		const skillName = wardenFlowSkillNameFromText(event.text);
		const interactionMode = resolveWardenFlowInteractionMode(skillName);
		if (skillName && interactionMode) {
			pendingDirective = { skillName, interactionMode };
		}
		return { action: "continue" } as const;
	});

	pi.on("before_agent_start", (event: BeforeAgentStartEvent) => {
		const message = pendingMessage;
		const directive = pendingDirective ?? directiveFromPrompt(event.prompt);
		clearPending();
		if (message) return { message };
		if (!directive) return undefined;
		const directiveMessage = buildWardenFlowDirectiveMessage(
			directive.skillName,
			directive.interactionMode,
		);
		if (!directiveMessage) return undefined;
		return { message: directiveMessage };
	});

	pi.on("agent_end", clearPending);
	pi.on("session_shutdown", clearPending);
}

export default function wardenDirectives(pi: ExtensionAPI): void {
	registerWardenDirectives(pi);
}

async function prepareWardenStartDirective(
	pi: ExtensionAPI,
	text: string,
	cwd: string | undefined,
): Promise<PreparedWardenStartDirective | undefined> {
	if (wardenFlowSkillNameFromText(text) !== "warden-start") return undefined;

	const currentBranch = await readCurrentBranch(pi, cwd);
	const forceAuto = resolveWardenFlowInteractionMode("warden-start") === "auto";
	const result = analyzeWardenStartSelection({
		text,
		currentBranch,
		forceAuto,
	});
	if (!result.ok) {
		throw new Error(`warden-start: ${result.errors.join(" ")}`);
	}

	if (result.selection.auto && currentBranch === undefined) {
		throw new Error(
			"warden-start: --auto requires verified Git branch context before local branch switch/create.",
		);
	}

	await executeWardenStartAutoBranch(asGitExec(pi), {
		cwd,
		selection: result.selection,
		currentBranch,
	});

	return {
		message: buildWardenStartSelectionDirectiveMessage(
			result.selection,
			loadWardenStartDirectiveBodies(result.selection),
		),
		transformedText: result.selection.transformedText,
	};
}

function loadWardenStartDirectiveBodies(
	selection: WardenStartSelection,
): readonly string[] {
	const modes: WardenFlowInteractionMode[] = ["prompt"];
	if (
		selection.source === "leading-name" ||
		selection.source === "leading-branch"
	) {
		modes.push("name");
	}
	if (selection.auto) modes.push("auto");
	return modes
		.map((mode) => directiveBody("warden-start", mode))
		.filter((body): body is string => typeof body === "string");
}

function directiveBody(
	skillName: string,
	interactionMode: WardenFlowInteractionMode,
): string | undefined {
	const message = buildWardenFlowDirectiveMessage(skillName, interactionMode);
	return message?.content
		.replace(/^<warden-flow-directive[^>]*>\n/, "")
		.replace(/\n<\/warden-flow-directive>$/, "");
}

async function readCurrentBranch(
	pi: ExtensionAPI,
	cwd: string | undefined,
): Promise<string | undefined> {
	try {
		const result = await pi.exec(
			"git",
			["rev-parse", "--abbrev-ref", "HEAD"],
			cwd ? { cwd } : undefined,
		);
		if ((result.code ?? 0) !== 0) return undefined;
		const branch = result.stdout.trim();
		return branch === "" || branch === "HEAD" ? undefined : branch;
	} catch {
		return undefined;
	}
}

function asGitExec(pi: ExtensionAPI): WardenStartGitExec {
	return async (command, args, options) => pi.exec(command, [...args], options);
}

function directiveFromPrompt(prompt: string): PendingDirective | undefined {
	const skillName = wardenFlowSkillNameFromText(prompt);
	const interactionMode = resolveWardenFlowInteractionMode(skillName);
	return skillName && interactionMode
		? { skillName, interactionMode }
		: undefined;
}
