import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
	readWardenSkillStatusEnabled,
	resolveWardenSkillEffort,
	type WardenEffortLevel,
} from "../../src/effort.js";

type SkillStatusRenderer = (
	skillName: string,
	effort: WardenEffortLevel,
	theme: ExtensionContext["ui"]["theme"],
) => string;

type WardenSkillRuntime = {
	readonly skillName: string;
	readonly effort: WardenEffortLevel;
};

export function createWardenSkillRuntimeController(
	pi: ExtensionAPI,
	statusKey: string,
	renderStatus: SkillStatusRenderer,
) {
	let restoreLevel: { readonly level: WardenEffortLevel } | undefined;
	let pendingSkillRuntime: WardenSkillRuntime | undefined;
	let skillStatusActive = false;

	function apply(runtime: WardenSkillRuntime): void {
		if (!restoreLevel) {
			restoreLevel = { level: pi.getThinkingLevel() as WardenEffortLevel };
		}
		pi.setThinkingLevel(runtime.effort);
	}

	function prepareFromInput(text: string, streamingBehavior: unknown) {
		const runtime = wardenSkillRuntimeFromText(text);
		if (!runtime) return undefined;
		pendingSkillRuntime = runtime;
		if (!streamingBehavior) apply(runtime);
		return { action: "continue" } as const;
	}

	function applyBeforeAgent(prompt: string, ctx: ExtensionContext | undefined) {
		const runtime = pendingSkillRuntime ?? wardenSkillRuntimeFromText(prompt);
		if (!runtime) return undefined;
		apply(runtime);
		pendingSkillRuntime = undefined;
		showStatus(ctx, runtime);
		return undefined;
	}

	function restore(ctx?: ExtensionContext): void {
		if (restoreLevel) {
			pi.setThinkingLevel(restoreLevel.level);
			restoreLevel = undefined;
		}
		pendingSkillRuntime = undefined;
		clearStatus(ctx);
	}

	function showStatus(
		ctx: ExtensionContext | undefined,
		runtime: WardenSkillRuntime,
	): void {
		if (!canSetStatus(ctx) || !readWardenSkillStatusEnabled()) return;
		ctx.ui.setStatus(
			statusKey,
			renderStatus(runtime.skillName, runtime.effort, ctx.ui.theme),
		);
		skillStatusActive = true;
	}

	function clearStatus(ctx: ExtensionContext | undefined): void {
		if (skillStatusActive && canSetStatus(ctx))
			ctx.ui.setStatus(statusKey, undefined);
		skillStatusActive = false;
	}

	return { applyBeforeAgent, prepareFromInput, restore };
}

function canSetStatus(
	ctx: ExtensionContext | undefined,
): ctx is ExtensionContext {
	return ctx?.ui !== undefined && ctx.hasUI !== false;
}

function wardenSkillRuntimeFromText(
	text: string,
): WardenSkillRuntime | undefined {
	const skillName = wardenSkillNameFromText(text);
	if (!skillName) return undefined;
	const effort = resolveWardenSkillEffort(skillName);
	return effort ? { skillName, effort } : undefined;
}

function wardenSkillNameFromText(text: string): string | undefined {
	const trimmed = text.trimStart();
	return (
		trimmed.match(/^\/skill:(warden-\S*)/)?.[1] ??
		trimmed.match(/^<skill name="(warden-[^"]+)"/)?.[1]
	);
}
