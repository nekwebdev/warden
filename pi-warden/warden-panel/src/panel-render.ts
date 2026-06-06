import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { getPanelGlyphs, renderPanelBorder } from "./glyphs.js";
import type { WardenPanelPane, WardenPanelPaneContext } from "./registry.js";
import type { PanelControl, PanelTheme } from "./panel-types.js";
import type { WardenSettings } from "./settings.js";

const PANEL_TITLE = "Pi Warden";
const FOOTER =
	"↑↓ navigate • Space/Enter select • Tab/Shift+Tab pane • Esc close";

export type PanelRenderInput = {
	readonly width: number;
	readonly termHeight: number | undefined;
	readonly panes: readonly WardenPanelPane[];
	readonly activePaneIndex: number;
	readonly draftSettings: WardenSettings;
	readonly theme: PanelTheme;
	activePane(): WardenPanelPane | undefined;
	contextFor(pane: WardenPanelPane): WardenPanelPaneContext;
	controlsForPane(pane: WardenPanelPane): PanelControl[];
	itemCountForPane(pane: WardenPanelPane): number;
	selectedIndex(): number;
};

export function renderPanel(input: PanelRenderInput): string[] {
	const geometry = panelGeometry(input.width, input.termHeight);
	const chrome = panelChrome(input, geometry.innerWidth);
	const lines: string[] = [];
	const addInner = (line: string) => {
		lines.push(
			chrome.leftBorder + padLine(line, geometry) + chrome.rightBorder,
		);
	};

	lines.push(chrome.topBorder());
	addPanelBody(addInner, input, geometry.innerContentWidth);
	padToMinimumPanelHeight(lines, addInner, input.termHeight);
	lines.push(chrome.bottomBorder());
	return lines;
}

export function renderPaneStrip(
	panes: readonly WardenPanelPane[],
	activePaneIndex: number,
	theme: PanelTheme,
): string {
	if (panes.length === 0) return theme.fg("muted", "No panes");
	return panes
		.map((pane, index) => renderPaneTab(pane, index === activePaneIndex, theme))
		.join(theme.fg("muted", " | "));
}

export function renderControlRow(
	label: string,
	active: boolean,
	theme: PanelTheme,
	glyphs: ReturnType<typeof getPanelGlyphs>,
): string {
	const prefix = active ? theme.bold(theme.fg("text", glyphs.pointer)) : "  ";
	const styled = theme.fg("text", label);
	return active ? theme.bold(prefix + styled) : prefix + styled;
}

function addPanelBody(
	addInner: (line: string) => void,
	input: PanelRenderInput,
	innerContentWidth: number,
): void {
	addInner("");
	addInner(renderPaneStrip(input.panes, input.activePaneIndex, input.theme));
	addInner("");
	const pane = input.activePane();
	if (!pane) {
		addInner(input.theme.fg("muted", "No Warden panes registered."));
		return;
	}
	for (const line of pane.render(
		input.contextFor(pane),
		innerContentWidth,
		true,
	)) {
		addInner(line);
	}
	addControlSection(addInner, input, pane);
}

function addControlSection(
	addInner: (line: string) => void,
	input: PanelRenderInput,
	pane: WardenPanelPane,
): void {
	const controls = input.controlsForPane(pane);
	if (controls.length === 0) return;
	addInner("");
	const paneItemCount = input.itemCountForPane(pane);
	const glyphs = getPanelGlyphs(input.draftSettings.useNerdGlyphs === true);
	controls.forEach((control, controlIndex) => {
		const selected = input.selectedIndex() === paneItemCount + controlIndex;
		if (control === "apply") {
			addInner(renderControlRow("Apply", selected, input.theme, glyphs));
		}
	});
}

function panelGeometry(width: number, termHeight: number | undefined) {
	const boxWidth = Math.max(4, width);
	const innerWidth = Math.max(1, boxWidth - 2);
	const padX = 2;
	return {
		boxWidth,
		innerWidth,
		innerContentWidth: Math.max(1, innerWidth - padX * 2),
		padX,
		termHeight,
	};
}

function panelChrome(input: PanelRenderInput, innerWidth: number) {
	const glyphs = getPanelGlyphs(input.draftSettings.useNerdGlyphs === true);
	const border = renderPanelBorder(glyphs.border, innerWidth);
	const horizontal = (count: number) =>
		count <= 0
			? ""
			: input.theme.fg("text", glyphs.border.horizontal.repeat(count));
	return {
		leftBorder: input.theme.fg("text", border.left),
		rightBorder: input.theme.fg("text", border.right),
		topBorder: () => topBorder(input.theme, glyphs, horizontal, innerWidth),
		bottomBorder: () => bottomBorder(input, glyphs, horizontal, innerWidth),
	};
}

function topBorder(
	theme: PanelTheme,
	glyphs: ReturnType<typeof getPanelGlyphs>,
	horizontal: (count: number) => string,
	innerWidth: number,
): string {
	const label = ` ${PANEL_TITLE} `;
	const leftWidth = 2;
	const rightWidth = Math.max(0, innerWidth - leftWidth - visibleWidth(label));
	return (
		theme.fg("text", glyphs.border.topLeft) +
		horizontal(leftWidth) +
		theme.bold(theme.fg("border", label)) +
		horizontal(rightWidth) +
		theme.fg("text", glyphs.border.topRight)
	);
}

function bottomBorder(
	input: PanelRenderInput,
	glyphs: ReturnType<typeof getPanelGlyphs>,
	horizontal: (count: number) => string,
	innerWidth: number,
): string {
	const label = ` ${input.activePane()?.footerHint ?? FOOTER} `;
	const remainingWidth = Math.max(0, innerWidth - visibleWidth(label));
	const leftWidth = Math.floor(remainingWidth / 2);
	return (
		input.theme.fg("text", glyphs.border.bottomLeft) +
		horizontal(leftWidth) +
		input.theme.fg("dim", label) +
		horizontal(remainingWidth - leftWidth) +
		input.theme.fg("text", glyphs.border.bottomRight)
	);
}

function padLine(
	line: string,
	geometry: ReturnType<typeof panelGeometry>,
): string {
	const truncated = truncateToWidth(line, geometry.innerContentWidth);
	return (
		" ".repeat(geometry.padX) +
		truncated +
		" ".repeat(
			Math.max(0, geometry.innerContentWidth - visibleWidth(truncated)),
		) +
		" ".repeat(geometry.padX)
	);
}

function padToMinimumPanelHeight(
	lines: string[],
	addInner: (line: string) => void,
	termHeight: number | undefined,
): void {
	if (termHeight === undefined) return;
	const minBoxHeight = Math.max(6, Math.ceil(termHeight * 0.3));
	const missingLines = Math.max(
		0,
		Math.max(1, minBoxHeight - 2) - (lines.length - 1),
	);
	for (let index = 0; index < missingLines; index++) addInner("");
}

function renderPaneTab(
	pane: WardenPanelPane,
	active: boolean,
	theme: PanelTheme,
): string {
	return active
		? theme.bold(theme.fg("text", pane.label))
		: theme.fg("muted", pane.label);
}
