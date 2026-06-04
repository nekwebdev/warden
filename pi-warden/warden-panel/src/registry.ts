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
const globalRegistry = globalThis as typeof globalThis & {
	[REGISTRY_KEY]?: Map<string, WardenPanelPane>;
	[ACTION_HANDLERS_KEY]?: Map<string, WardenPanelPaneActionHandler>;
};
const panes = (globalRegistry[REGISTRY_KEY] ??= new Map<
	string,
	WardenPanelPane
>());
const actionHandlers = (globalRegistry[ACTION_HANDLERS_KEY] ??= new Map<
	string,
	WardenPanelPaneActionHandler
>());

export function contributeWardenPane(pane: WardenPanelPane): void {
	validatePane(pane);
	if (panes.has(pane.id)) throw new Error(`Duplicate Warden pane: ${pane.id}`);
	panes.set(pane.id, pane);
}

export function hasWardenPane(id: string): boolean {
	return panes.has(id);
}

export function getWardenPane(id: string): WardenPanelPane | undefined {
	return panes.get(id);
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

export function clearWardenPanesForTests(): void {
	if (process.env.NODE_ENV !== "test") {
		throw new Error(
			"clearWardenPanesForTests is only available under NODE_ENV=test",
		);
	}
	panes.clear();
	actionHandlers.clear();
}

function comparePanes(a: WardenPanelPane, b: WardenPanelPane): number {
	const order = (a.order ?? 1000) - (b.order ?? 1000);
	if (order !== 0) return order;
	return a.label.localeCompare(b.label) || a.id.localeCompare(b.id);
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
