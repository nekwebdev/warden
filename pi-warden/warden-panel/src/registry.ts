import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionUIContext,
} from "@earendil-works/pi-coding-agent";
import type { PanelGlyphs } from "./glyphs.js";
import type { WardenSettings } from "./settings.js";

type ExtensionCustomFactory = Parameters<ExtensionUIContext["custom"]>[0];

export type WardenPanelTheme = Pick<
	Parameters<ExtensionCustomFactory>[1],
	"fg" | "bg" | "bold"
>;

export type WardenPanelPaneAction = {
	readonly action: string;
	readonly payload?: unknown;
};

export type WardenPanelPaneInputResult = boolean | void | WardenPanelPaneAction;

export type WardenPanelPaneActionContext = {
	readonly pi: ExtensionAPI;
	readonly commandContext: ExtensionCommandContext;
};

export type WardenPanelPaneActionHandler = (
	action: WardenPanelPaneAction,
	ctx: WardenPanelPaneActionContext,
) => void | Promise<void>;

export type WardenDisplaySettingContribution = {
	readonly id: string;
	readonly order?: number;
	itemCount(ctx: WardenPanelPaneContext): number;
	render(ctx: WardenPanelPaneContext, width: number, active: boolean): string[];
	handleInput?(
		data: string,
		ctx: WardenPanelPaneContext,
	): WardenPanelPaneInputResult;
};

export type WardenPanelPaneContext = {
	readonly settings: WardenSettings;
	readonly draftSettings: WardenSettings;
	readonly glyphs: PanelGlyphs;
	readonly theme: WardenPanelTheme;
	readonly selectedIndex: number;
	readonly maxPaneLines: number;
	updateDraftSettings(patch: WardenSettings): void;
	requestRender(): void;
};

export type WardenPanelPane = {
	readonly id: string;
	readonly label: string;
	readonly order?: number;
	readonly command?: `warden:${string}`;
	readonly showApplyControl?: boolean;
	readonly footerHint?: string;
	itemCount(ctx: WardenPanelPaneContext): number;
	render(ctx: WardenPanelPaneContext, width: number, active: boolean): string[];
	handleInput?(
		data: string,
		ctx: WardenPanelPaneContext,
	): WardenPanelPaneInputResult;
};

const REGISTRY_KEY = Symbol.for("@nekwebdev/warden-panel/panes");
const ACTION_HANDLERS_KEY = Symbol.for(
	"@nekwebdev/warden-panel/pane-action-handlers",
);
const DISPLAY_SETTINGS_KEY = Symbol.for(
	"@nekwebdev/warden-panel/display-settings",
);
const globalRegistry = globalThis as typeof globalThis & {
	[REGISTRY_KEY]?: Map<string, WardenPanelPane>;
	[ACTION_HANDLERS_KEY]?: Map<string, WardenPanelPaneActionHandler>;
	[DISPLAY_SETTINGS_KEY]?: Map<string, WardenDisplaySettingContribution>;
};
const panes = (globalRegistry[REGISTRY_KEY] ??= new Map<
	string,
	WardenPanelPane
>());
const actionHandlers = (globalRegistry[ACTION_HANDLERS_KEY] ??= new Map<
	string,
	WardenPanelPaneActionHandler
>());
const displaySettings = (globalRegistry[DISPLAY_SETTINGS_KEY] ??= new Map<
	string,
	WardenDisplaySettingContribution
>());

export function contributeWardenPane(pane: WardenPanelPane): void {
	validatePane(pane);
	if (panes.has(pane.id)) throw new Error(`Duplicate Warden pane: ${pane.id}`);
	panes.set(pane.id, pane);
}

export function hasWardenPane(id: string): boolean {
	const normalizedId = id.trim();
	return normalizedId.length > 0 && panes.has(normalizedId);
}

export function getWardenPane(id: string): WardenPanelPane | undefined {
	const normalizedId = id.trim();
	return normalizedId.length > 0 ? panes.get(normalizedId) : undefined;
}

export function getWardenPanes(): WardenPanelPane[] {
	return [...panes.values()].sort(comparePanes);
}

export function contributeWardenPaneActionHandler(
	paneId: string,
	handler: WardenPanelPaneActionHandler,
): void {
	if (paneId.trim() === "") throw new Error("Warden pane id is required");
	actionHandlers.set(paneId, handler);
}

export async function handleWardenPaneAction(
	paneId: string,
	action: WardenPanelPaneAction,
	ctx: WardenPanelPaneActionContext,
): Promise<boolean> {
	const handler = actionHandlers.get(paneId);
	if (!handler) return false;
	await handler(action, ctx);
	return true;
}

export function contributeWardenDisplaySetting(
	setting: WardenDisplaySettingContribution,
): void {
	validateDisplaySetting(setting);
	if (displaySettings.has(setting.id)) {
		throw new Error(`Duplicate Warden display setting: ${setting.id}`);
	}
	displaySettings.set(setting.id, setting);
}

export function hasWardenDisplaySetting(id: string): boolean {
	const normalizedId = id.trim();
	return normalizedId.length > 0 && displaySettings.has(normalizedId);
}

export function getWardenDisplaySettings(): WardenDisplaySettingContribution[] {
	return [...displaySettings.values()].sort(compareDisplaySettings);
}

export function clearWardenPanesForTests(): void {
	if (process.env.NODE_ENV !== "test") {
		throw new Error(
			"clearWardenPanesForTests is only available under NODE_ENV=test",
		);
	}
	panes.clear();
	actionHandlers.clear();
	displaySettings.clear();
}

function comparePanes(a: WardenPanelPane, b: WardenPanelPane): number {
	const order = (a.order ?? 1000) - (b.order ?? 1000);
	if (order !== 0) return order;
	return a.label.localeCompare(b.label) || a.id.localeCompare(b.id);
}

function compareDisplaySettings(
	a: WardenDisplaySettingContribution,
	b: WardenDisplaySettingContribution,
): number {
	const order = (a.order ?? 1000) - (b.order ?? 1000);
	if (order !== 0) return order;
	return a.id.localeCompare(b.id);
}

function validatePane(pane: WardenPanelPane): void {
	if (pane.id.trim() === "") throw new Error("Warden pane id is required");
	if (pane.label.trim() === "")
		throw new Error("Warden pane label is required");
	if (pane.command !== undefined && !pane.command.startsWith("warden:")) {
		throw new Error(
			`Warden pane command must start with warden:: ${pane.command}`,
		);
	}
}

function validateDisplaySetting(
	setting: WardenDisplaySettingContribution,
): void {
	if (setting.id.trim() === "") {
		throw new Error("Warden display setting id is required");
	}
}
