import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	buildWardenFlowDirectiveMessage,
	parseWardenStartAutoInvocation,
	resolveWardenFlowInteractionMode,
	wardenFlowSkillNameFromText,
	type WardenFlowInteractionMode,
} from "../../src/runtime-directives.js";

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

export function registerWardenDirectives(pi: ExtensionAPI): void {
	let pendingDirective: PendingDirective | undefined;

	function clearPending(): void {
		pendingDirective = undefined;
	}

	pi.on("input", (event: InputEvent) => {
		if (event.source === "extension") return { action: "continue" } as const;

		const explicit = parseWardenStartAutoInvocation(event.text);
		if (explicit) {
			pendingDirective = {
				skillName: explicit.skillName,
				interactionMode: explicit.interactionMode,
			};
			return { action: "transform", text: explicit.transformedText } as const;
		}

		const skillName = wardenFlowSkillNameFromText(event.text);
		const interactionMode = resolveWardenFlowInteractionMode(skillName);
		if (skillName && interactionMode) {
			pendingDirective = { skillName, interactionMode };
		}
		return { action: "continue" } as const;
	});

	pi.on("before_agent_start", (event: BeforeAgentStartEvent) => {
		const directive = pendingDirective ?? directiveFromPrompt(event.prompt);
		clearPending();
		if (!directive) return undefined;
		const message = buildWardenFlowDirectiveMessage(
			directive.skillName,
			directive.interactionMode,
		);
		if (!message) return undefined;
		return { message };
	});

	pi.on("agent_end", clearPending);
	pi.on("session_shutdown", clearPending);
}

export default function wardenDirectives(pi: ExtensionAPI): void {
	registerWardenDirectives(pi);
}

function directiveFromPrompt(prompt: string): PendingDirective | undefined {
	const skillName = wardenFlowSkillNameFromText(prompt);
	const interactionMode = resolveWardenFlowInteractionMode(skillName);
	return skillName && interactionMode
		? { skillName, interactionMode }
		: undefined;
}
