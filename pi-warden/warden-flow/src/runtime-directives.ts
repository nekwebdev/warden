import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getPiAgentSettingsPath } from "./effort.js";

export const WARDEN_FLOW_DIRECTIVE_CUSTOM_TYPE = "warden-flow-directive";
export const WARDEN_FLOW_DIRECTIVE_TAG = "warden-flow-directive";
export const WARDEN_START_SKILL_NAME = "warden-start";
export const WARDEN_FLOW_INTERACTION_MODES = ["auto"] as const;

export type WardenFlowInteractionMode =
	(typeof WARDEN_FLOW_INTERACTION_MODES)[number];

export type WardenStartAutoInvocation = {
	readonly skillName: typeof WARDEN_START_SKILL_NAME;
	readonly interactionMode: WardenFlowInteractionMode;
	readonly transformedText: string;
};

export type WardenFlowDirectiveMessage = {
	readonly customType: typeof WARDEN_FLOW_DIRECTIVE_CUSTOM_TYPE;
	readonly display: false;
	readonly content: string;
};

const DEFAULT_PACKAGE_ROOT = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"..",
);

export function parseWardenStartAutoInvocation(
	text: string,
): WardenStartAutoInvocation | undefined {
	const match = text
		.trimStart()
		.match(/^\/skill:warden-start(?:\s+([\s\S]*))?$/);
	if (!match) return undefined;
	const args = match[1] ?? "";
	const autoMatch = args.match(/^--auto(?:\s+([\s\S]*))?$/);
	if (!autoMatch) return undefined;
	const cleanedArgs = (autoMatch[1] ?? "").trimStart();
	return {
		skillName: WARDEN_START_SKILL_NAME,
		interactionMode: "auto",
		transformedText: cleanedArgs
			? `/skill:${WARDEN_START_SKILL_NAME} ${cleanedArgs}`
			: `/skill:${WARDEN_START_SKILL_NAME}`,
	};
}

export function wardenFlowSkillNameFromText(text: string): string | undefined {
	const trimmed = text.trimStart();
	return (
		trimmed.match(/^\/skill:(warden-start)(?:\s|$)/)?.[1] ??
		trimmed.match(/^<skill name="(warden-start)"/)?.[1]
	);
}

export function readWardenFlowInteractionModeSetting(): string | undefined {
	const settingsPath = getPiAgentSettingsPath();
	if (!existsSync(settingsPath)) return undefined;
	let parsed: unknown;
	try {
		const contents = readFileSync(settingsPath, "utf-8");
		if (contents.trim() === "") return undefined;
		parsed = JSON.parse(contents);
	} catch {
		return undefined;
	}
	if (!isPlainObject(parsed)) return undefined;
	const warden = isPlainObject(parsed.warden) ? parsed.warden : undefined;
	const flow = isPlainObject(warden?.flow) ? warden.flow : undefined;
	return typeof flow?.interactionMode === "string"
		? flow.interactionMode
		: undefined;
}

export function resolveWardenFlowInteractionMode(
	skillName: string | undefined,
	explicitMode?: string,
	settingsMode = readWardenFlowInteractionModeSetting(),
): WardenFlowInteractionMode | undefined {
	if (skillName !== WARDEN_START_SKILL_NAME) return undefined;
	if (explicitMode === "auto") return "auto";
	if (settingsMode === "auto") return "auto";
	return undefined;
}

export function getWardenFlowDirectivePath(
	skillName: string,
	interactionMode: WardenFlowInteractionMode,
	packageRoot = DEFAULT_PACKAGE_ROOT,
): string {
	return join(
		packageRoot,
		"skills",
		skillName,
		"runtime-directives",
		`${interactionMode}.md`,
	);
}

export function buildWardenFlowDirectiveContent(
	skillName: string,
	interactionMode: WardenFlowInteractionMode,
	body: string,
): string {
	return `<${WARDEN_FLOW_DIRECTIVE_TAG} skill="${skillName}" interactionMode="${interactionMode}">\n${body.trim()}\n</${WARDEN_FLOW_DIRECTIVE_TAG}>`;
}

export function buildWardenFlowDirectiveMessage(
	skillName: string,
	interactionMode: WardenFlowInteractionMode,
	packageRoot = DEFAULT_PACKAGE_ROOT,
): WardenFlowDirectiveMessage | undefined {
	const path = getWardenFlowDirectivePath(
		skillName,
		interactionMode,
		packageRoot,
	);
	let body: string;
	try {
		body = readFileSync(path, "utf-8");
	} catch {
		return undefined;
	}
	if (body.trim() === "") return undefined;
	return {
		customType: WARDEN_FLOW_DIRECTIVE_CUSTOM_TYPE,
		display: false,
		content: buildWardenFlowDirectiveContent(skillName, interactionMode, body),
	};
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
