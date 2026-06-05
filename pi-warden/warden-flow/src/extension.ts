import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	WARDEN_GIT_CONTEXT_MESSAGE,
	WARDEN_MAP_DEBUG_FLAG,
	WARDEN_MAP_MESSAGE,
} from "./constants.js";
import {
	formatGitContext,
	gitContextSignature,
	loadGitContext,
	shouldInvalidateGitContext,
	type GitContext,
} from "./git.js";
import {
	buildRootMapInjection,
	collectScopedMapInjections,
	type MapInjection,
} from "./map.js";

type MessageContent = Array<{
	type: string;
	text?: string;
	[key: string]: unknown;
}>;

type ToolEvent = {
	toolName: string;
	input?: Record<string, unknown>;
	content?: MessageContent;
};

type ToolContext = { cwd: string };

type PromptMessage = { customType: string; content: string; display: boolean };

let injectedMapHashes = new Map<string, string>();
let gitCache: GitContext | null | undefined;
let lastGitSignature: string | null = null;

export function registerWardenMap(pi: ExtensionAPI): void {
	pi.registerFlag(WARDEN_MAP_DEBUG_FLAG, {
		description: "Show hidden warden-map context injection messages",
		type: "boolean",
		default: false,
	});

	pi.on("session_start", async (_event, ctx) => {
		resetMapInjectionState();
		resetGitContextState();
		injectRootMap(ctx.cwd, pi);
		await sendGitContextIfChanged(pi);
	});

	pi.on("session_compact", async (_event, ctx) => {
		resetMapInjectionState();
		resetGitContextState();
		injectRootMap(ctx.cwd, pi);
		await sendGitContextIfChanged(pi);
	});

	pi.on("session_shutdown", () => {
		resetMapInjectionState();
		resetGitContextState();
	});

	pi.on("tool_call", (event: ToolEvent) => {
		if (shouldInvalidateGitContext(event.toolName, event.input))
			clearGitContextCache();
	});

	// `tool_result` is documented by Pi and lets us append scoped map context to
	// the same tool result, avoiding an extra model-visible read call. Some older
	// type bundles do not include the event overload yet, so the event name is
	// intentionally cast at the registration boundary only.
	(
		pi.on as unknown as (
			name: "tool_result",
			handler: (event: ToolEvent, ctx: ToolContext) => unknown,
		) => void
	)("tool_result", (event, ctx) => {
		const inputPath = toolInputPath(event.input);
		if (!inputPath) return undefined;
		const injections = collectScopedMapInjections(ctx.cwd, inputPath).filter(
			rememberMapInjection,
		);
		if (injections.length === 0) return undefined;
		return {
			content: appendTextContent(
				event.content,
				formatToolResultGuidance(injections),
			),
		};
	});

	pi.on("before_agent_start", async () => {
		const content = await takeGitContextIfChanged(pi);
		if (!content) return undefined;
		return { message: buildGitContextMessage(pi, content) };
	});
}

export function resetMapInjectionState(): void {
	injectedMapHashes = new Map<string, string>();
}

export function resetGitContextState(): void {
	gitCache = undefined;
	lastGitSignature = null;
}

export function clearGitContextCache(): void {
	gitCache = undefined;
}

export function buildMapMessage(
	pi: ExtensionAPI,
	content: string,
): PromptMessage {
	return { customType: WARDEN_MAP_MESSAGE, content, display: isDebug(pi) };
}

export function buildGitContextMessage(
	pi: ExtensionAPI,
	content: string,
): PromptMessage {
	return {
		customType: WARDEN_GIT_CONTEXT_MESSAGE,
		content,
		display: isDebug(pi),
	};
}

export function appendTextContent(
	content: MessageContent | undefined,
	text: string,
): MessageContent {
	return [...(Array.isArray(content) ? content : []), { type: "text", text }];
}

export function toolInputPath(
	input: Record<string, unknown> | undefined,
): string | undefined {
	if (!input) return undefined;
	for (const key of ["path", "file_path", "directory", "cwd"] as const) {
		if (typeof input[key] === "string") return input[key];
	}
	if (Array.isArray(input.paths)) {
		return input.paths.find((item): item is string => typeof item === "string");
	}
	return undefined;
}

async function sendGitContextIfChanged(pi: ExtensionAPI): Promise<void> {
	const content = await takeGitContextIfChanged(pi);
	if (!content) return;
	pi.sendMessage(buildGitContextMessage(pi, content));
}

async function takeGitContextIfChanged(
	pi: ExtensionAPI,
): Promise<string | null> {
	const context = await getGitContext(pi);
	if (!context) return null;
	const signature = gitContextSignature(context);
	if (signature === lastGitSignature) return null;
	lastGitSignature = signature;
	return formatGitContext(context);
}

async function getGitContext(pi: ExtensionAPI): Promise<GitContext | null> {
	if (gitCache !== undefined) return gitCache;
	gitCache = await loadGitContext((command, args, options) =>
		pi.exec(command, args, options),
	);
	return gitCache;
}

function injectRootMap(cwd: string, pi: ExtensionAPI): void {
	const injection = buildRootMapInjection(cwd);
	if (!injection || !rememberMapInjection(injection)) return;
	pi.sendMessage(buildMapMessage(pi, injection.message));
}

function rememberMapInjection(injection: MapInjection): boolean {
	if (injectedMapHashes.get(injection.relativePath) === injection.hash)
		return false;
	injectedMapHashes.set(injection.relativePath, injection.hash);
	return true;
}

function formatToolResultGuidance(injections: MapInjection[]): string {
	return injections.map((injection) => injection.message).join("\n\n---\n\n");
}

function isDebug(pi: ExtensionAPI): boolean {
	try {
		return Boolean(pi.getFlag(WARDEN_MAP_DEBUG_FLAG));
	} catch {
		return false;
	}
}
