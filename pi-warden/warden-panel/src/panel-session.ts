import { Key, matchesKey } from "@earendil-works/pi-tui";
import { getPanelGlyphs } from "./glyphs.js";
import { renderPanel } from "./panel-render.js";
import type {
	PanelControl,
	ShowWardenPanelOptions,
	WardenPanelResult,
	WardenPanelUI,
} from "./panel-types.js";
import type {
	WardenPanelPane,
	WardenPanelPaneAction,
	WardenPanelPaneContext,
} from "./registry.js";
import { writeWardenSettings, type WardenSettings } from "./settings.js";

const MAX_PANEL_HEIGHT_RATIO = 0.7;
const UNBOUNDED_PANE_LINES = Number.MAX_SAFE_INTEGER;

type PanelDone = (result: WardenPanelResult) => void;
type PanelTui = Parameters<Parameters<WardenPanelUI["custom"]>[0]>[0];
type PanelTheme = WardenPanelPaneContext["theme"];

type PanelCache = {
	lines?: string[];
	width?: number;
	height?: number;
};

export function runWardenPanelSession(
	ui: WardenPanelUI,
	settings: WardenSettings,
	panes: readonly WardenPanelPane[],
	options: ShowWardenPanelOptions,
): Promise<WardenPanelResult> {
	let lastTermHeight: number | undefined;
	const visible = (_termWidth: number, termHeight: number) => {
		lastTermHeight = termHeight;
		return true;
	};
	return ui.custom<WardenPanelResult>(
		(tui, theme, _keybindings, done) =>
			new PanelSession({
				done,
				lastTermHeight: () => lastTermHeight,
				options,
				panes,
				settings,
				theme,
				tui,
			}).view(),
		{ overlay: true, overlayOptions: { visible } },
	);
}

class PanelSession {
	private readonly cache: PanelCache = {};
	private readonly done: PanelDone;
	private readonly lastTermHeight: () => number | undefined;
	private readonly panes: readonly WardenPanelPane[];
	private readonly settings: WardenSettings;
	private readonly theme: PanelTheme;
	private readonly tui: PanelTui;
	private activePaneIndex: number;
	private draftSettings: WardenSettings;
	private readonly selectedByPane: Map<string, number>;

	constructor(input: {
		readonly done: PanelDone;
		readonly lastTermHeight: () => number | undefined;
		readonly options: ShowWardenPanelOptions;
		readonly panes: readonly WardenPanelPane[];
		readonly settings: WardenSettings;
		readonly theme: PanelTheme;
		readonly tui: PanelTui;
	}) {
		this.done = input.done;
		this.lastTermHeight = input.lastTermHeight;
		this.panes = input.panes;
		this.settings = input.settings;
		this.theme = input.theme;
		this.tui = input.tui;
		this.draftSettings = input.settings;
		this.activePaneIndex = initialPaneIndex(input.panes, input.options);
		this.selectedByPane = new Map(input.panes.map((pane) => [pane.id, 0]));
	}

	view() {
		return {
			render: (width: number) => this.render(width),
			handleInput: (data: string) => this.handleInput(data),
			invalidate: () => this.invalidate(),
		};
	}

	private activePane(): WardenPanelPane | undefined {
		return this.panes[this.activePaneIndex];
	}

	private selectedIndex(): number {
		const pane = this.activePane();
		return pane ? (this.selectedByPane.get(pane.id) ?? 0) : 0;
	}

	private controlsForPane(pane: WardenPanelPane): PanelControl[] {
		if (pane.showApplyControl === false) return [];
		return hasPendingSettingsChanges(this.settings, this.draftSettings)
			? ["apply"]
			: [];
	}

	private maxPaneLinesFor(pane: WardenPanelPane): number {
		const termHeight = this.lastTermHeight();
		if (termHeight === undefined) return UNBOUNDED_PANE_LINES;
		const maxPanelLines = Math.max(
			6,
			Math.floor(termHeight * MAX_PANEL_HEIGHT_RATIO),
		);
		const chromeLines = this.controlsForPane(pane).length + 6;
		return Math.max(1, maxPanelLines - chromeLines);
	}

	private maxSelectionForPane(pane: WardenPanelPane): number {
		const itemCount = this.itemCountForPane(pane);
		const controlCount = this.controlsForPane(pane).length;
		return Math.max(0, itemCount + controlCount - 1);
	}

	private setSelected(index: number): void {
		const pane = this.activePane();
		if (!pane) return;
		this.selectedByPane.set(
			pane.id,
			clamp(index, 0, this.maxSelectionForPane(pane)),
		);
	}

	private refresh(): void {
		this.invalidate();
		this.tui.requestRender();
	}

	private updateDraftSettings(patch: WardenSettings): void {
		this.draftSettings = mergeWardenSettings(this.draftSettings, patch);
	}

	private contextFor(pane: WardenPanelPane): WardenPanelPaneContext {
		return {
			settings: this.settings,
			draftSettings: this.draftSettings,
			glyphs: getPanelGlyphs(this.draftSettings.useNerdGlyphs === true),
			theme: this.theme,
			selectedIndex: this.selectedIndex(),
			maxPaneLines: this.maxPaneLinesFor(pane),
			updateDraftSettings: (patch) => this.updateDraftSettings(patch),
			requestRender: () => this.refresh(),
		};
	}

	private itemCountForPane(pane: WardenPanelPane): number {
		return pane.itemCount(this.contextFor(pane));
	}

	private switchPane(delta: -1 | 1): void {
		if (this.panes.length === 0) return;
		this.activePaneIndex =
			(this.activePaneIndex + delta + this.panes.length) % this.panes.length;
		this.setSelected(this.selectedIndex());
		this.refresh();
	}

	private moveSelected(delta: -1 | 1): void {
		if (!this.activePane()) return;
		this.setSelected(this.selectedIndex() + delta);
		this.refresh();
	}

	private apply(): void {
		const result = writeWardenSettings(this.draftSettings);
		if (!result.ok) {
			this.done({
				action: "settings-error",
				settingsError: result.settingsError,
			});
			return;
		}
		this.done({ action: "applied", settings: this.draftSettings });
	}

	private activateCurrent(data: string): void {
		const pane = this.activePane();
		if (!pane) return;
		const paneItemCount = this.itemCountForPane(pane);
		if (this.selectedIndex() < paneItemCount) {
			this.handlePaneActivation(pane, data);
			return;
		}
		this.activateControl(pane, paneItemCount);
	}

	private handlePaneActivation(pane: WardenPanelPane, data: string): void {
		const result = pane.handleInput?.(data, this.contextFor(pane));
		if (isPaneAction(result)) {
			this.done({ action: "pane-action", paneId: pane.id, paneAction: result });
			return;
		}
		if (result === true) this.refresh();
	}

	private activateControl(pane: WardenPanelPane, paneItemCount: number): void {
		const control =
			this.controlsForPane(pane)[this.selectedIndex() - paneItemCount];
		if (control === "apply") this.apply();
	}

	private handleInput(data: string): void {
		const action = panelInputAction(data);
		if (action === "next-pane") return this.switchPane(1);
		if (action === "previous-pane") return this.switchPane(-1);
		if (action === "up") return this.moveSelected(-1);
		if (action === "down") return this.moveSelected(1);
		if (action === "close") return this.done({ action: "close" });
		if (action === "activate") this.activateCurrent(data);
	}

	private render(width: number): string[] {
		const termHeight = this.lastTermHeight();
		if (
			this.cache.lines &&
			this.cache.width === width &&
			this.cache.height === termHeight
		) {
			return this.cache.lines;
		}
		const lines = renderPanel({
			width,
			termHeight,
			panes: this.panes,
			activePaneIndex: this.activePaneIndex,
			draftSettings: this.draftSettings,
			theme: this.theme,
			activePane: () => this.activePane(),
			contextFor: (pane) => this.contextFor(pane),
			controlsForPane: (pane) => this.controlsForPane(pane),
			itemCountForPane: (pane) => this.itemCountForPane(pane),
			selectedIndex: () => this.selectedIndex(),
		});
		this.cache.lines = lines;
		this.cache.width = width;
		this.cache.height = termHeight;
		return lines;
	}

	private invalidate(): void {
		this.cache.lines = undefined;
		this.cache.width = undefined;
		this.cache.height = undefined;
	}
}

function initialPaneIndex(
	panes: readonly WardenPanelPane[],
	options: ShowWardenPanelOptions,
): number {
	const index = panes.findIndex((pane) => pane.id === options.initialPaneId);
	return index < 0 ? 0 : index;
}

function panelInputAction(data: string) {
	if (matchesKey(data, Key.tab)) return "next-pane";
	if (matchesKey(data, Key.shift("tab"))) return "previous-pane";
	if (matchesKey(data, Key.up)) return "up";
	if (matchesKey(data, Key.down)) return "down";
	if (matchesKey(data, Key.escape)) return "close";
	if (matchesKey(data, Key.enter) || matchesKey(data, Key.space))
		return "activate";
	return "ignore";
}

function mergeWardenSettings(
	settings: WardenSettings,
	patch: WardenSettings,
): WardenSettings {
	return {
		...settings,
		...patch,
		...(patch.effort
			? { effort: { ...settings.effort, ...patch.effort } }
			: {}),
	};
}

function hasPendingSettingsChanges(
	settings: WardenSettings,
	draft: WardenSettings,
): boolean {
	return JSON.stringify(settings) !== JSON.stringify(draft);
}

function isPaneAction(
	result: boolean | void | WardenPanelPaneAction,
): result is WardenPanelPaneAction {
	return (
		typeof result === "object" &&
		result !== null &&
		!Array.isArray(result) &&
		typeof result.action === "string"
	);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}
