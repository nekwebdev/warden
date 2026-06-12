import {
	WARDEN_FLOW_DIRECTIVE_CUSTOM_TYPE,
	WARDEN_START_SKILL_NAME,
	buildWardenFlowDirectiveContent,
	type WardenFlowDirectiveMessage,
	type WardenFlowInteractionMode,
} from "./runtime-directives.js";

export const WARDEN_START_BRANCH_TYPES = [
	"feature",
	"bugfix",
	"hotfix",
	"release",
	"docs",
	"test",
	"chore",
] as const;

export type WardenStartBranchType = (typeof WARDEN_START_BRANCH_TYPES)[number];

export type WardenStartSelectionSource =
	| "leading-branch"
	| "leading-name"
	| "current-branch"
	| "deduced";

export type WardenStartSelection = {
	readonly auto: boolean;
	readonly packetType: WardenStartBranchType;
	readonly slug: string;
	readonly branchName: string;
	readonly source: WardenStartSelectionSource;
	readonly roughIntent: string;
	readonly transformedText: string;
	readonly shouldSkipSlugPrompt: boolean;
	readonly shouldSkipBranchPrompt: boolean;
	readonly shouldAutoSwitchBranch: boolean;
};

export type WardenStartSelectionResult =
	| { readonly ok: true; readonly selection: WardenStartSelection }
	| { readonly ok: false; readonly errors: readonly string[] };

export type AnalyzeWardenStartSelectionInput = {
	readonly text: string;
	readonly currentBranch?: string;
	readonly forceAuto?: boolean;
};

export type WardenStartGitExecResult = {
	readonly stdout?: string;
	readonly stderr?: string;
	readonly code?: number | null;
};

export type WardenStartGitExec = (
	command: string,
	args: readonly string[],
	options?: { readonly cwd?: string },
) => Promise<WardenStartGitExecResult>;

export type ExecuteWardenStartAutoBranchOptions = {
	readonly cwd?: string;
	readonly selection: WardenStartSelection;
	readonly currentBranch?: string;
};

export type WardenStartAutoBranchResult = {
	readonly action: "skipped" | "switched" | "created";
	readonly branchName: string;
};

type LeadingFlags = {
	auto: boolean;
	name?: string;
	branch?: string;
	roughIntent: string;
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const WARDEN_START_INVOCATION_PATTERN =
	/^\/skill:warden-start(?:\s+([\s\S]*))?$/;

export function analyzeWardenStartSelection(
	input: AnalyzeWardenStartSelectionInput,
): WardenStartSelectionResult {
	const match = input.text.trimStart().match(WARDEN_START_INVOCATION_PATTERN);
	if (!match) {
		return { ok: false, errors: ["Not a /skill:warden-start invocation."] };
	}

	const flagResult = parseLeadingFlags(match[1] ?? "");
	if (!flagResult.ok) return flagResult;
	const flags = {
		...flagResult.flags,
		auto: flagResult.flags.auto || input.forceAuto === true,
	};
	const errors: string[] = [];

	if (flags.name && flags.branch) {
		errors.push("Leading --name and --branch are mutually exclusive.");
	}

	let packetType: WardenStartBranchType | undefined;
	let slug: string | undefined;
	let source: WardenStartSelectionSource = "deduced";
	let branchContextHandled = false;

	if (flags.branch) {
		const branch = parseTypedBranch(flags.branch);
		if (!branch.ok) errors.push(...branch.errors);
		else {
			packetType = branch.packetType;
			slug = branch.slug;
			source = "leading-branch";
		}
	} else if (flags.name) {
		const slugError = validateWardenStartSlug(flags.name);
		if (slugError) errors.push(slugError);
		else {
			slug = flags.name;
			source = "leading-name";
		}
	} else {
		const branch = branchContextFromCurrentBranch(input.currentBranch);
		if (!branch.ok) errors.push(...branch.errors);
		else if (branch.branch) {
			packetType = branch.branch.packetType;
			slug = branch.branch.slug;
			source = "current-branch";
			branchContextHandled = true;
		}
	}

	packetType ??= deduceWardenStartBranchType(flags.roughIntent);
	slug ??= slugFromIntent(flags.roughIntent);
	const generatedSlugError = validateWardenStartSlug(slug);
	if (generatedSlugError) errors.push(generatedSlugError);

	if (errors.length > 0) return { ok: false, errors };

	const branchName = `${packetType}/${slug}`;
	const transformedText = flags.roughIntent
		? `/skill:${WARDEN_START_SKILL_NAME} ${flags.roughIntent}`
		: `/skill:${WARDEN_START_SKILL_NAME}`;
	const shouldAutoSwitchBranch =
		flags.auto && !branchContextHandled && input.currentBranch !== branchName;

	return {
		ok: true,
		selection: {
			auto: flags.auto,
			packetType,
			slug,
			branchName,
			source,
			roughIntent: flags.roughIntent,
			transformedText,
			shouldSkipSlugPrompt:
				flags.auto ||
				source === "leading-name" ||
				source === "leading-branch" ||
				source === "current-branch",
			shouldSkipBranchPrompt: flags.auto || source === "current-branch",
			shouldAutoSwitchBranch,
		},
	};
}

export function validateWardenStartSlug(slug: string): string | undefined {
	if (SLUG_PATTERN.test(slug)) return undefined;
	return `Invalid slug: ${slug}. Use lowercase letters, numbers, and single dashes only; no slashes, underscores, uppercase, leading dashes, trailing dashes, or repeated dashes.`;
}

export function deduceWardenStartBranchType(
	intent: string,
): WardenStartBranchType {
	const text = intent.toLowerCase();
	if (/\b(hotfix|urgent|production|prod|security|critical)\b/.test(text)) {
		return "hotfix";
	}
	if (/\b(release|version|tag|changelog)\b/.test(text)) return "release";
	if (/\b(docs?|readme|guide|documentation)\b/.test(text)) return "docs";
	if (/\b(tests?|specs?|coverage|assertions?)\b/.test(text)) return "test";
	if (/\b(bug|bugfix|fix|failure|error|crash|regression)\b/.test(text)) {
		return "bugfix";
	}
	if (
		/\b(chore|cleanup|maintenance|deps?|dependencies|refactor)\b/.test(text)
	) {
		return "chore";
	}
	return "feature";
}

export async function executeWardenStartAutoBranch(
	exec: WardenStartGitExec,
	options: ExecuteWardenStartAutoBranchOptions,
): Promise<WardenStartAutoBranchResult> {
	const branchName = options.selection.branchName;
	if (!options.selection.shouldAutoSwitchBranch) {
		return { action: "skipped", branchName };
	}
	if (options.currentBranch === branchName) {
		return { action: "skipped", branchName };
	}

	const status = await execGit(exec, ["status", "--porcelain"], options.cwd);
	if ((status.code ?? 0) !== 0) {
		throw new Error(
			`warden-start: failed to verify clean Git status before auto branch switch: ${formatGitError(status)}`,
		);
	}
	if ((status.stdout ?? "").trim() !== "") {
		throw new Error(
			`warden-start: refusing --auto branch switch/create because repo is dirty. Clean repo before retrying ${branchName}.`,
		);
	}

	const exists = await execGit(
		exec,
		["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`],
		options.cwd,
	);
	if ((exists.code ?? 0) === 0) {
		const switched = await execGit(exec, ["switch", branchName], options.cwd);
		if ((switched.code ?? 0) !== 0) {
			throw new Error(
				`warden-start: failed to switch to existing local branch ${branchName}: ${formatGitError(switched)}`,
			);
		}
		return { action: "switched", branchName };
	}
	if ((exists.code ?? 0) !== 1) {
		throw new Error(
			`warden-start: failed to verify local branch ${branchName}: ${formatGitError(exists)}`,
		);
	}

	const created = await execGit(
		exec,
		["switch", "-c", branchName],
		options.cwd,
	);
	if ((created.code ?? 0) !== 0) {
		throw new Error(
			`warden-start: failed to create local branch ${branchName}: ${formatGitError(created)}`,
		);
	}
	return { action: "created", branchName };
}

export function buildWardenStartSelectionDirectiveMessage(
	selection: WardenStartSelection,
	directiveBodies: readonly string[] = [],
): WardenFlowDirectiveMessage {
	const interactionMode = wardenStartDirectiveMode(selection);
	const body = [
		...directiveBodies.map((body) => body.trim()).filter(Boolean),
		formatWardenStartSelectionDirective(selection),
	].join("\n\n");
	return {
		customType: WARDEN_FLOW_DIRECTIVE_CUSTOM_TYPE,
		display: false,
		content: buildWardenFlowDirectiveContent(
			WARDEN_START_SKILL_NAME,
			interactionMode,
			body,
		),
	};
}

export function wardenStartDirectiveMode(
	selection: WardenStartSelection,
): WardenFlowInteractionMode {
	if (selection.auto) return "auto";
	return selection.source === "leading-name" ||
		selection.source === "leading-branch"
		? "name"
		: "prompt";
}

function parseLeadingFlags(
	args: string,
):
	| { readonly ok: true; readonly flags: LeadingFlags }
	| { readonly ok: false; readonly errors: readonly string[] } {
	const tokens = args.trimStart() === "" ? [] : args.trimStart().split(/\s+/);
	const errors: string[] = [];
	const seen = new Set<string>();
	let auto = false;
	let name: string | undefined;
	let branch: string | undefined;
	let index = 0;

	while (index < tokens.length) {
		const token = tokens[index];
		if (token === "--auto") {
			if (seen.has("--auto")) errors.push("Duplicate leading --auto flag.");
			seen.add("--auto");
			auto = true;
			index += 1;
			continue;
		}
		if (token === "--name" || token === "--branch") {
			if (seen.has(token)) errors.push(`Duplicate leading ${token} flag.`);
			seen.add(token);
			const value = tokens[index + 1];
			if (!value || value.startsWith("--")) {
				errors.push(`Missing value for leading ${token} flag.`);
				index += 1;
				continue;
			}
			if (token === "--name") name = value;
			else branch = value;
			index += 2;
			continue;
		}
		break;
	}

	if (errors.length > 0) return { ok: false, errors };
	return {
		ok: true,
		flags: {
			auto,
			name,
			branch,
			roughIntent: tokens.slice(index).join(" "),
		},
	};
}

function parseTypedBranch(branchName: string):
	| {
			readonly ok: true;
			readonly packetType: WardenStartBranchType;
			readonly slug: string;
	  }
	| { readonly ok: false; readonly errors: readonly string[] } {
	const parts = branchName.split("/");
	const [type, slug] = parts;
	const errors: string[] = [];
	if (parts.length !== 2 || !type || !slug) {
		errors.push(
			`Malformed branch: ${branchName}. Use <type>/<slug> with exactly one slash.`,
		);
		return { ok: false, errors };
	}
	if (!isWardenStartBranchType(type)) {
		errors.push(
			`Invalid branch type: ${type}. Use one of ${WARDEN_START_BRANCH_TYPES.join(", ")}.`,
		);
	}
	const slugError = validateWardenStartSlug(slug);
	if (slugError) errors.push(slugError);
	return errors.length === 0
		? { ok: true, packetType: type as WardenStartBranchType, slug }
		: { ok: false, errors };
}

function branchContextFromCurrentBranch(currentBranch: string | undefined):
	| {
			readonly ok: true;
			readonly branch?: {
				readonly packetType: WardenStartBranchType;
				readonly slug: string;
			};
	  }
	| { readonly ok: false; readonly errors: readonly string[] } {
	if (
		!currentBranch ||
		currentBranch === "main" ||
		currentBranch === "master"
	) {
		return { ok: true };
	}
	const type = currentBranch.split("/")[0];
	if (!isWardenStartBranchType(type)) return { ok: true };
	const parsed = parseTypedBranch(currentBranch);
	if (!parsed.ok) return parsed;
	return {
		ok: true,
		branch: { packetType: parsed.packetType, slug: parsed.slug },
	};
}

function isWardenStartBranchType(
	value: string,
): value is WardenStartBranchType {
	return WARDEN_START_BRANCH_TYPES.includes(value as WardenStartBranchType);
}

function slugFromIntent(intent: string): string {
	return intent
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

async function execGit(
	exec: WardenStartGitExec,
	args: readonly string[],
	cwd: string | undefined,
): Promise<WardenStartGitExecResult> {
	return exec("git", args, cwd ? { cwd } : undefined);
}

function formatGitError(result: WardenStartGitExecResult): string {
	return (
		result.stderr ??
		result.stdout ??
		`exit ${result.code ?? "unknown"}`
	).trim();
}

function formatWardenStartSelectionDirective(
	selection: WardenStartSelection,
): string {
	return [
		"## Deterministic warden-start selection",
		"Use this package-computed selection before drafting packet path or prompts.",
		`- Packet type: ${selection.packetType}`,
		`- Packet slug: ${selection.slug}`,
		`- Branch name: ${selection.branchName}`,
		`- Selection source: ${selection.source}`,
		`- Cleaned rough intent: ${selection.roughIntent || "(empty)"}`,
		`- Skip slug prompt: ${selection.shouldSkipSlugPrompt ? "yes" : "no"}`,
		`- Skip create/switch branch prompt: ${selection.shouldSkipBranchPrompt ? "yes" : "no"}`,
		selection.shouldAutoSwitchBranch
			? "- Auto branch action: local branch switch/create already gated by clean repo before this turn; do not ask another create/switch prompt."
			: "- Auto branch action: none; do not perform Git branch mutation from skill prose.",
		"- Slug format: lowercase letters, numbers, and single dashes only; no slashes, underscores, uppercase, leading dashes, trailing dashes, or repeated dashes.",
	].join("\n");
}
