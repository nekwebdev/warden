import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getPiAgentSettingsPath } from "./effort.js";

export const WARDEN_FLOW_DIRECTIVE_CUSTOM_TYPE = "warden-flow-directive";
export const WARDEN_FLOW_DIRECTIVE_TAG = "warden-flow-directive";
export const WARDEN_START_SKILL_NAME = "warden-start";
export const WARDEN_COMMIT_SKILL_NAME = "warden-commit";
export const WARDEN_MAP_SKILL_NAME = "warden-map";
export const WARDEN_FLOW_DIRECTIVE_SKILL_NAMES = [
	WARDEN_START_SKILL_NAME,
	WARDEN_COMMIT_SKILL_NAME,
	WARDEN_MAP_SKILL_NAME,
] as const;
export const WARDEN_FLOW_INTERACTION_MODES = [
	"auto",
	"name",
	"prompt",
] as const;

export type WardenFlowDirectiveSkillName =
	(typeof WARDEN_FLOW_DIRECTIVE_SKILL_NAMES)[number];

export type WardenFlowInteractionMode =
	(typeof WARDEN_FLOW_INTERACTION_MODES)[number];

export type WardenStartAutoInvocation = {
	readonly skillName: typeof WARDEN_START_SKILL_NAME;
	readonly interactionMode: WardenFlowInteractionMode;
	readonly transformedText: string;
};

export type WardenSkillDirectAutoInvocation = {
	readonly skillName:
		| typeof WARDEN_COMMIT_SKILL_NAME
		| typeof WARDEN_MAP_SKILL_NAME;
	readonly interactionMode: "auto";
	readonly transformedText: string;
	readonly cleanedArgs: string;
};

export type WardenSkillDirectAutoInvocationResult =
	| { readonly ok: true; readonly invocation: WardenSkillDirectAutoInvocation }
	| { readonly ok: false; readonly errors: readonly string[] };

export type WardenMapAutoScopeResult =
	| { readonly ok: true; readonly scope: string }
	| { readonly ok: false; readonly errors: readonly string[] };

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

export function parseWardenSkillDirectAutoInvocation(
	text: string,
): WardenSkillDirectAutoInvocationResult | undefined {
	const match = text
		.trimStart()
		.match(/^\/skill:(warden-commit|warden-map)(?:\s+([\s\S]*))?$/);
	if (!match) return undefined;
	const skillName = match[1] as WardenSkillDirectAutoInvocation["skillName"];
	const args = match[2] ?? "";
	const autoMatch = args.match(/^--auto(?:\s+([\s\S]*))?$/);
	if (!autoMatch) return undefined;
	const cleanedArgs = (autoMatch[1] ?? "").trimStart();
	if (skillName === WARDEN_MAP_SKILL_NAME) {
		const scope = parseWardenMapAutoScope(cleanedArgs);
		if (!scope.ok) return { ok: false, errors: scope.errors };
	}
	return {
		ok: true,
		invocation: {
			skillName,
			interactionMode: "auto",
			transformedText: cleanedArgs
				? `/skill:${skillName} ${cleanedArgs}`
				: `/skill:${skillName}`,
			cleanedArgs,
		},
	};
}

export function parseWardenMapAutoScope(
	scopeText: string,
): WardenMapAutoScopeResult {
	const scope = scopeText.trim();
	if (scope === "" || scope === ".") return { ok: true, scope };
	const errors: string[] = [];
	if (/\s/.test(scope)) {
		errors.push("Use empty/root scope or one repo-relative path token.");
	}
	if (scope.startsWith("/")) errors.push("Absolute paths are not allowed.");
	if (scope.startsWith("-")) errors.push("Flag-like scopes are not allowed.");
	if (/[;&|`$<>(){}[\]*?!'"\\~#:]/.test(scope)) {
		errors.push("Shell metacharacters are not allowed in auto scope.");
	}
	const parts = scope.split("/");
	if (parts.some((part) => part === "")) {
		errors.push("Empty path segments are not allowed.");
	}
	if (parts.some((part) => part === "." || part === "..")) {
		errors.push("Dot or parent-directory path segments are not allowed.");
	}
	return errors.length === 0 ? { ok: true, scope } : { ok: false, errors };
}

export function wardenFlowSkillNameFromText(text: string): string | undefined {
	const trimmed = text.trimStart();
	return (
		trimmed.match(
			/^\/skill:(warden-start|warden-commit|warden-map)(?:\s|$)/,
		)?.[1] ??
		trimmed.match(/^<skill name="(warden-start|warden-commit|warden-map)"/)?.[1]
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
	return buildWardenFlowDirectiveMessageWithPrefix(
		skillName,
		interactionMode,
		"",
		packageRoot,
	);
}

export function buildWardenFlowDirectiveMessageWithPrefix(
	skillName: string,
	interactionMode: WardenFlowInteractionMode,
	bodyPrefix: string,
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
	const fullBody = [bodyPrefix.trim(), body.trim()]
		.filter(Boolean)
		.join("\n\n");
	if (fullBody.trim() === "") return undefined;
	return {
		customType: WARDEN_FLOW_DIRECTIVE_CUSTOM_TYPE,
		display: false,
		content: buildWardenFlowDirectiveContent(
			skillName,
			interactionMode,
			fullBody,
		),
	};
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
