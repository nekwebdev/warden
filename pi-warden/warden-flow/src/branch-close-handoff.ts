import { execFileSync } from "node:child_process";
import { relative } from "node:path";
import type {
	WardenCloseMapFieldsParseResult,
	WardenCloseMapImpact,
} from "./packet-tracker.js";

export const BRANCH_CLOSE_WORKFLOW = "warden_branch_close";
export const BRANCH_CLOSE_ENGINE_PACKET =
	".warden/work/warden-branch-close-engine/packet.md";

export type BranchCloseContext =
	| {
			status: "feature-branch";
			featureBranch: string;
			defaultBranch: string;
	  }
	| {
			status: "default-branch";
			currentBranch: string;
			defaultBranch: string;
	  }
	| { status: "detached-head"; defaultBranch: string };

export interface BranchCloseHandoffPayload {
	workflow: typeof BRANCH_CLOSE_WORKFLOW;
	featureBranch: string;
	defaultBranch: string;
	maps: WardenCloseMapImpact;
	mapsScope: string;
	packetPath?: string;
	packetName?: string;
	cwd: string;
	branchCloseDestructiveConsent?: true;
	branchCloseAutoCommitConsent?: true;
}

export interface MakeBranchCloseHandoffPayloadInput {
	cwd: string;
	featureBranch: string;
	defaultBranch: string;
	mapFields: Extract<WardenCloseMapFieldsParseResult, { status: "valid" }>;
	packetPath?: string;
	packetName?: string;
}

export type BranchCloseGitRead = (args: string[], cwd: string) => string | null;

export function branchCloseContextFromNames(
	currentBranch: string | undefined,
	defaultBranch: string | undefined,
): BranchCloseContext {
	const normalizedDefault = defaultBranch?.trim() || "main";
	const normalizedCurrent = currentBranch?.trim();
	if (!normalizedCurrent || normalizedCurrent === "HEAD") {
		return { status: "detached-head", defaultBranch: normalizedDefault };
	}
	if (normalizedCurrent === normalizedDefault) {
		return {
			status: "default-branch",
			currentBranch: normalizedCurrent,
			defaultBranch: normalizedDefault,
		};
	}
	return {
		status: "feature-branch",
		featureBranch: normalizedCurrent,
		defaultBranch: normalizedDefault,
	};
}

export function loadBranchCloseContext(
	cwd: string,
	readGit: BranchCloseGitRead = defaultBranchCloseGitRead,
): BranchCloseContext {
	const currentBranch = readGit(
		["symbolic-ref", "--quiet", "--short", "HEAD"],
		cwd,
	);
	const remoteDefault = readGit(
		["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"],
		cwd,
	)?.replace(/^origin\//, "");
	const configuredDefault = readGit(
		["config", "--get", "init.defaultBranch"],
		cwd,
	);
	const localDefault =
		readGit(["show-ref", "--verify", "--quiet", "refs/heads/main"], cwd) !==
		null
			? "main"
			: readGit(
						["show-ref", "--verify", "--quiet", "refs/heads/master"],
						cwd,
					) !== null
				? "master"
				: undefined;
	return branchCloseContextFromNames(
		currentBranch ?? undefined,
		remoteDefault ?? configuredDefault ?? localDefault ?? "main",
	);
}

export function isSafeBranchCloseBranchName(branch: string): boolean {
	if (!branch || branch.startsWith("-") || branch.startsWith("/")) return false;
	if (branch.endsWith("/") || branch.includes("\\")) return false;
	if (!/^[A-Za-z0-9._/-]+$/.test(branch)) return false;
	if (/[\s\x00-\x1f;&|`$<>()[\]{}*!?~#]/.test(branch)) return false;
	if (branch.includes("..") || branch.includes("@{")) return false;
	if (branch.includes("//")) return false;
	if (
		branch.split("/").some((part) => !part || part === "." || part === "..")
	) {
		return false;
	}
	if (branch.split("/").some((part) => part.endsWith(".lock"))) {
		return false;
	}
	return !relative(".", branch).startsWith("..");
}

export function makeBranchCloseHandoffPayload(
	input: MakeBranchCloseHandoffPayloadInput,
): BranchCloseHandoffPayload {
	return {
		workflow: BRANCH_CLOSE_WORKFLOW,
		featureBranch: input.featureBranch,
		defaultBranch: input.defaultBranch,
		maps: input.mapFields.maps,
		mapsScope: input.mapFields.mapsScope,
		...(input.packetPath ? { packetPath: input.packetPath } : {}),
		...(input.packetName ? { packetName: input.packetName } : {}),
		cwd: input.cwd,
	};
}

export function addBranchCloseConsentMarkers(
	payload: BranchCloseHandoffPayload,
): BranchCloseHandoffPayload {
	return {
		...payload,
		branchCloseDestructiveConsent: true,
		branchCloseAutoCommitConsent: true,
	};
}

export function formatBranchCloseManualNextStep(
	payload: BranchCloseHandoffPayload,
): string {
	return `Manual next step: ${BRANCH_CLOSE_WORKFLOW} ${JSON.stringify(
		payload,
	)} after ${BRANCH_CLOSE_ENGINE_PACKET} lands.`;
}

export function formatBranchClosePrompt(
	featureBranch: string,
	defaultBranch: string,
): string {
	return `Close branch ${featureBranch}? Warden Branch Close will push ${defaultBranch}, delete remote feature branch ${featureBranch}, delete local feature branch ${featureBranch}, and may remove its feature worktree.`;
}

function defaultBranchCloseGitRead(args: string[], cwd: string): string | null {
	try {
		return execFileSync("git", args, {
			cwd,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		return null;
	}
}
