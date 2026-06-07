import {
	getMarkdownTheme,
	type ExtensionAPI,
	type ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { Markdown } from "@earendil-works/pi-tui";
import {
	contributeWardenPane,
	contributeWardenPaneActionHandler,
	getWardenPane,
	openWardenPanel,
	type WardenPanelPaneAction,
} from "../../src/index.js";
import {
	formatPackageOperationReport,
	formatTaggedPackageUpdateReport,
	installPackage,
	removePackages,
	updateTaggedNpmPackages,
	type PackageOperationResult,
} from "./operations.js";
import {
	PACKAGES_ACTION_INSTALL,
	PACKAGES_ACTION_REMOVE,
	PACKAGES_ACTION_UPDATE_TAGGED,
	PACKAGES_COMMAND,
	PACKAGES_PANE_ID,
	createPackagesPane,
	isPackagesPaneAction,
	sourcesFromRemovePayload,
} from "./pane.js";
import { validateInstallSource } from "./packages.js";

export {
	formatPackageOperationReport,
	formatTaggedPackageUpdateReport,
	installPackage,
	removePackages,
	updateTaggedNpmPackages,
} from "./operations.js";
export {
	PACKAGES_ACTION_INSTALL,
	PACKAGES_ACTION_REMOVE,
	PACKAGES_ACTION_UPDATE_TAGGED,
	PACKAGES_COMMAND,
	PACKAGES_PANE_ID,
	createPackagesPane,
} from "./pane.js";
export {
	normalizePackageEntries,
	readGlobalPackageEntries,
	validateInstallSource,
	type PackageEntry,
} from "./packages.js";

export const WARDEN_PACKAGES_REPORT_MESSAGE = "warden-packages-report";

export default function wardenPackages(pi: ExtensionAPI): void {
	registerPackagesPane();
	registerPackagesPaneActionHandler();
	registerReportRenderer(pi);

	pi.registerCommand(PACKAGES_COMMAND, {
		description: "Open Warden packages",
		handler: async (_args, ctx) => {
			await openPackagesPanel(pi, ctx);
		},
	});
}

export function registerPackagesPane(): void {
	if (getWardenPane(PACKAGES_PANE_ID)) return;
	contributeWardenPane(createPackagesPane());
}

export function registerPackagesPaneActionHandler(): void {
	contributeWardenPaneActionHandler(PACKAGES_PANE_ID, async (action, ctx) => {
		await handlePackagesPaneAction(ctx.pi, ctx.commandContext, action);
	});
}

function registerReportRenderer(pi: ExtensionAPI): void {
	pi.registerMessageRenderer<{ results: PackageOperationResult[] }>(
		WARDEN_PACKAGES_REPORT_MESSAGE,
		(message) => {
			const content =
				typeof message.content === "string" ? message.content : "";
			return new Markdown(content, 1, 0, getMarkdownTheme());
		},
	);
}

export async function openPackagesPanel(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext,
): Promise<void> {
	await openWardenPanel(pi, ctx, { initialPaneId: PACKAGES_PANE_ID });
}

export async function handlePackagesPaneAction(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext,
	action: WardenPanelPaneAction,
): Promise<void> {
	if (!isPackagesPaneAction(action)) return;
	await waitForPanelTeardown();
	if (action.action === PACKAGES_ACTION_INSTALL) {
		await handleInstall(pi, ctx);
		return;
	}
	if (action.action === PACKAGES_ACTION_UPDATE_TAGGED) {
		await handleUpdateTagged(pi, ctx);
		return;
	}
	if (action.action === PACKAGES_ACTION_REMOVE) {
		await handleRemove(pi, ctx, action.payload);
	}
}

async function handleInstall(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext,
): Promise<void> {
	const input = await ctx.ui.input(
		"Install trusted Pi package",
		"npm:@foo/bar@1.0.0",
	);
	if (input === undefined) return;
	const validation = validateInstallSource(input);
	if (!validation.ok) {
		ctx.ui.notify(validation.message, "error");
		return;
	}
	const result = await installPackage(validation.source, { cwd: ctx.cwd });
	sendReport(pi, [result]);
}

async function handleUpdateTagged(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext,
): Promise<void> {
	const results = await updateTaggedNpmPackages({ cwd: ctx.cwd });
	sendReport(pi, results, formatTaggedPackageUpdateReport(results));
}

async function handleRemove(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext,
	payload: unknown,
): Promise<void> {
	const sources = sourcesFromRemovePayload(payload);
	if (sources.length === 0) return;
	const confirmed = await ctx.ui.confirm(
		`Remove ${sources.length} package${sources.length === 1 ? "" : "s"}?`,
		sources.map((source) => `- ${source}`).join("\n"),
	);
	if (!confirmed) return;
	const results = await removePackages(sources, { cwd: ctx.cwd });
	sendReport(pi, results);
}

async function waitForPanelTeardown(): Promise<void> {
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function sendReport(
	pi: ExtensionAPI,
	results: readonly PackageOperationResult[],
	content = formatPackageOperationReport(results),
): void {
	pi.sendMessage<{ results: readonly PackageOperationResult[] }>({
		customType: WARDEN_PACKAGES_REPORT_MESSAGE,
		content,
		display: true,
		details: { results },
	});
}
