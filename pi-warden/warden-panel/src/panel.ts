import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import {
	Key,
	matchesKey,
	truncateToWidth,
	visibleWidth,
} from "@earendil-works/pi-tui";
import { getPanelGlyphs, renderPanelBorder } from "./glyphs.js";
import {
	getWardenPanes,
	type WardenPanelPane,
	type WardenPanelPaneAction,
	type WardenPanelPaneContext,
} from "./registry.js";
import {
	formatPiAgentSettingsError,
	getWardenSettings,
	readPiAgentSettings,
	writeWardenSettings,
	type PiAgentSettingsError,
	type WardenSettings,
} from "./settings.js";

export type WardenPanelUI = Pick<ExtensionUIContext, "custom">;

export type WardenPanelResult =
	| { readonly action: "close" }
	| { readonly action: "applied"; readonly settings: WardenSettings }
	| {
			readonly action: "settings-error";
			readonly settingsError: PiAgentSettingsError;
	  }
	| {
			readonly action: "pane-action";
			readonly paneId: string;
			readonly paneAction: WardenPanelPaneAction;
	  };

export type ShowWardenPanelOptions = { readonly initialPaneId?: string };

type PanelControl = "apply";

const PANEL_TITLE = "Pi Warden";
const FOOTER =
	"↑↓ navigate • Space/Enter select • Tab/Shift+Tab pane • Esc close";
const MAX_PANEL_HEIGHT_RATIO = 0.7;
const UNBOUNDED_PANE_LINES = Number.MAX_SAFE_INTEGER;

export async function showWardenPanel(
	ui: WardenPanelUI,
	options: ShowWardenPanelOptions = {},
): Promise<WardenPanelResult> {
	const settingsResult = readPiAgentSettings();
	if (!settingsResult.ok)
		return { action: "settings-error", settingsError: settingsResult };

	const settings = getWardenSettings(settingsResult.settings);
	const panes = getWardenPanes();
	let lastTermHeight: number | undefined;

	return ui.custom<WardenPanelResult>(
		(tui, theme, _keybindings, done) => {
			let draftSettings = settings;
			let cachedLines: string[] | undefined;
			let cachedWidth: number | undefined;
			let cachedHeight: number | undefined;
			let activePaneIndex = panes.findIndex(
				(pane) => pane.id === options.initialPaneId,
			);
			if (activePaneIndex < 0) activePaneIndex = 0;
			const selectedByPane = new Map<string, number>(
				panes.map((pane) => [pane.id, 0]),
			);

			function activePane(): WardenPanelPane | undefined {
				return panes[activePaneIndex];
			}

			function selectedIndex(): number {
				const pane = activePane();
				return pane ? (selectedByPane.get(pane.id) ?? 0) : 0;
			}

			function controlsForPane(pane: WardenPanelPane): PanelControl[] {
				if (pane.showApplyControl === false) return [];
				return hasPendingSettingsChanges(settings, draftSettings)
					? ["apply"]
					: [];
			}

			function maxPaneLinesFor(pane: WardenPanelPane): number {
				if (lastTermHeight === undefined) return UNBOUNDED_PANE_LINES;
				const controls = controlsForPane(pane).length;
				const maxPanelLines = Math.max(
					6,
					Math.floor(lastTermHeight * MAX_PANEL_HEIGHT_RATIO),
				);
				const chromeLines = controls + 6;
				return Math.max(1, maxPanelLines - chromeLines);
			}

			function maxSelectionForPane(pane: WardenPanelPane): number {
				return Math.max(
					0,
					itemCountForPane(pane) + controlsForPane(pane).length - 1,
				);
			}

			function setSelected(index: number): void {
				const pane = activePane();
				if (pane)
					selectedByPane.set(
						pane.id,
						clamp(index, 0, maxSelectionForPane(pane)),
					);
			}

			function refresh(): void {
				cachedLines = undefined;
				cachedWidth = undefined;
				cachedHeight = undefined;
				tui.requestRender();
			}

			function updateDraftSettings(patch: WardenSettings): void {
				draftSettings = {
					...draftSettings,
					...patch,
					...(patch.effort
						? { effort: { ...draftSettings.effort, ...patch.effort } }
						: {}),
				};
			}

			function contextFor(pane: WardenPanelPane): WardenPanelPaneContext {
				return {
					settings,
					draftSettings,
					glyphs: getPanelGlyphs(draftSettings.useNerdGlyphs === true),
					theme,
					selectedIndex: selectedIndex(),
					maxPaneLines: maxPaneLinesFor(pane),
					updateDraftSettings,
					requestRender: refresh,
				};
			}

			function itemCountForPane(pane: WardenPanelPane): number {
				return pane.itemCount(contextFor(pane));
			}

			function switchPane(delta: -1 | 1): void {
				if (panes.length === 0) return;
				activePaneIndex =
					(activePaneIndex + delta + panes.length) % panes.length;
				const pane = activePane();
				if (pane) setSelected(selectedIndex());
				refresh();
			}

			function moveSelected(delta: -1 | 1): void {
				if (!activePane()) return;
				setSelected(selectedIndex() + delta);
				refresh();
			}

			function apply(): void {
				const result = writeWardenSettings(draftSettings);
				if (!result.ok)
					done({
						action: "settings-error",
						settingsError: result.settingsError,
					});
				else done({ action: "applied", settings: draftSettings });
			}

			function activateCurrent(data: string): void {
				const pane = activePane();
				if (!pane) return;
				const paneItemCount = itemCountForPane(pane);
				if (selectedIndex() < paneItemCount) {
					const result = pane.handleInput?.(data, contextFor(pane));
					if (isPaneAction(result)) {
						done({
							action: "pane-action",
							paneId: pane.id,
							paneAction: result,
						});
						return;
					}
					if (result === true) refresh();
					return;
				}
				const control = controlsForPane(pane)[selectedIndex() - paneItemCount];
				if (control === "apply") apply();
			}

			function handleInput(data: string): void {
				if (matchesKey(data, Key.tab)) return switchPane(1);
				if (matchesKey(data, Key.shift("tab"))) return switchPane(-1);
				if (matchesKey(data, Key.up)) return moveSelected(-1);
				if (matchesKey(data, Key.down)) return moveSelected(1);
				if (matchesKey(data, Key.escape)) return done({ action: "close" });
				if (matchesKey(data, Key.enter) || matchesKey(data, Key.space))
					activateCurrent(data);
			}

			function render(width: number): string[] {
				if (
					cachedLines &&
					cachedWidth === width &&
					cachedHeight === lastTermHeight
				)
					return cachedLines;
				const glyphs = getPanelGlyphs(draftSettings.useNerdGlyphs === true);
				const boxWidth = Math.max(4, width);
				const innerWidth = Math.max(1, boxWidth - 2);
				const border = renderPanelBorder(glyphs.border, innerWidth);
				const leftBorder = theme.fg("text", border.left);
				const rightBorder = theme.fg("text", border.right);
				const padX = 2;
				const innerContentWidth = Math.max(1, innerWidth - padX * 2);
				const lines: string[] = [];
				const horizontal = (count: number) =>
					count <= 0
						? ""
						: theme.fg("text", glyphs.border.horizontal.repeat(count));
				const topBorder = () => {
					const label = ` ${PANEL_TITLE} `;
					const leftWidth = 2;
					const rightWidth = Math.max(
						0,
						innerWidth - leftWidth - visibleWidth(label),
					);
					return (
						theme.fg("text", glyphs.border.topLeft) +
						horizontal(leftWidth) +
						theme.bold(theme.fg("border", label)) +
						horizontal(rightWidth) +
						theme.fg("text", glyphs.border.topRight)
					);
				};
				const bottomBorder = () => {
					const label = ` ${activePane()?.footerHint ?? FOOTER} `;
					const remainingWidth = Math.max(0, innerWidth - visibleWidth(label));
					const leftWidth = Math.floor(remainingWidth / 2);
					return (
						theme.fg("text", glyphs.border.bottomLeft) +
						horizontal(leftWidth) +
						theme.fg("dim", label) +
						horizontal(remainingWidth - leftWidth) +
						theme.fg("text", glyphs.border.bottomRight)
					);
				};
				const withPadding = (line: string) => {
					const truncated = truncateToWidth(line, innerContentWidth);
					return (
						" ".repeat(padX) +
						truncated +
						" ".repeat(
							Math.max(0, innerContentWidth - visibleWidth(truncated)),
						) +
						" ".repeat(padX)
					);
				};
				const addInner = (line: string) =>
					lines.push(leftBorder + withPadding(line) + rightBorder);

				lines.push(topBorder());
				addInner("");
				addInner(renderPaneStrip(panes, activePaneIndex, theme));
				addInner("");
				const pane = activePane();
				if (!pane) {
					addInner(theme.fg("muted", "No Warden panes registered."));
				} else {
					for (const line of pane.render(
						contextFor(pane),
						innerContentWidth,
						true,
					))
						addInner(line);
					const controls = controlsForPane(pane);
					if (controls.length > 0) {
						addInner("");
						const paneItemCount = itemCountForPane(pane);
						for (const [controlIndex, control] of controls.entries()) {
							const selected = selectedIndex() === paneItemCount + controlIndex;
							if (control === "apply") {
								addInner(renderControlRow("Apply", selected, theme, glyphs));
							}
						}
					}
				}
				const minBoxHeight =
					lastTermHeight === undefined
						? undefined
						: Math.max(6, Math.ceil(lastTermHeight * 0.3));
				if (minBoxHeight !== undefined) {
					for (
						let i = 0;
						i < Math.max(0, Math.max(1, minBoxHeight - 2) - (lines.length - 1));
						i++
					)
						addInner("");
				}
				lines.push(bottomBorder());
				cachedLines = lines;
				cachedWidth = width;
				cachedHeight = lastTermHeight;
				return lines;
			}

			return {
				render,
				handleInput,
				invalidate() {
					cachedLines = undefined;
					cachedWidth = undefined;
					cachedHeight = undefined;
				},
			};
		},
		{
			overlay: true,
			overlayOptions: {
				visible: (_termWidth, termHeight) => {
					lastTermHeight = termHeight;
					return true;
				},
			},
		},
	);
}

function renderPaneStrip(
	panes: readonly WardenPanelPane[],
	activePaneIndex: number,
	theme: WardenPanelPaneContext["theme"],
): string {
	if (panes.length === 0) return theme.fg("muted", "No panes");
	return panes
		.map((pane, index) =>
			index === activePaneIndex
				? theme.bold(theme.fg("text", pane.label))
				: theme.fg("muted", pane.label),
		)
		.join(theme.fg("muted", " | "));
}

function renderControlRow(
	label: string,
	active: boolean,
	theme: WardenPanelPaneContext["theme"],
	glyphs: ReturnType<typeof getPanelGlyphs>,
): string {
	const prefix = active ? theme.bold(theme.fg("text", glyphs.pointer)) : "  ";
	const styled = theme.fg("text", label);
	return active ? theme.bold(prefix + styled) : prefix + styled;
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

export function formatWardenPanelResult(result: WardenPanelResult): string {
	if (result.action === "applied") return "Warden settings saved.";
	if (result.action === "settings-error")
		return `Warden settings error: ${formatPiAgentSettingsError(result.settingsError)}`;
	if (result.action === "pane-action")
		return `Warden pane action: ${result.paneId}.${result.paneAction.action}`;
	return "Warden panel closed.";
}
