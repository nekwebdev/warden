import type {
	WardenPanelPane,
	WardenPanelPaneAction,
	WardenPanelPaneContext,
} from "../../src/index.js";
import { readGlobalPackageEntries, type PackageEntry } from "./packages.js";

export const PACKAGES_PANE_ID = "packages";
export const PACKAGES_COMMAND = "warden:packages";
export const PACKAGES_ACTION_INSTALL = "install";
export const PACKAGES_ACTION_REMOVE = "remove";

type PackagesPaneActionId =
	| typeof PACKAGES_ACTION_INSTALL
	| typeof PACKAGES_ACTION_REMOVE;

type PackagesPaneDependencies = {
	readonly readEntries?: () => PackageEntry[];
};

type PaneActivity = { readonly activePane: boolean };
type RowActivity = { readonly active: boolean };
type PackageRowOptions = RowActivity & { readonly selected: boolean };

export type RemovePackagesPayload = {
	readonly sources: string[];
};

export function createPackagesPane(
	dependencies: PackagesPaneDependencies = {},
): WardenPanelPane {
	const readEntries = dependencies.readEntries ?? readGlobalPackageEntries;
	const selectedIds = new Set<string>();

	function entries(): PackageEntry[] {
		const current = readEntries();
		const validIds = new Set(current.map((entry) => entry.id));
		for (const id of selectedIds) {
			if (!validIds.has(id)) selectedIds.delete(id);
		}
		return current;
	}

	function selectedEntries(current: readonly PackageEntry[]): PackageEntry[] {
		return current.filter((entry) => selectedIds.has(entry.id));
	}

	function itemCount(current: readonly PackageEntry[]): number {
		return current.length === 0 ? 1 : current.length + 2;
	}

	return {
		id: PACKAGES_PANE_ID,
		label: "Packages",
		order: 10,
		command: PACKAGES_COMMAND,
		showApplyControl: false,
		itemCount() {
			return itemCount(entries());
		},
		render(ctx, width, activePane) {
			const current = entries();
			return renderPackagesPane(current, selectedIds, ctx, width, {
				activePane,
			});
		},
		handleInput(data, ctx) {
			if (!isActivation(data)) return false;
			const current = entries();
			if (ctx.selectedIndex === 0) return { action: PACKAGES_ACTION_INSTALL };
			if (ctx.selectedIndex === 1) {
				const sources = selectedEntries(current).map((entry) => entry.source);
				if (sources.length === 0) return false;
				return {
					action: PACKAGES_ACTION_REMOVE,
					payload: { sources },
				};
			}
			const entry = current[ctx.selectedIndex - 2];
			if (!entry) return false;
			if (selectedIds.has(entry.id)) selectedIds.delete(entry.id);
			else selectedIds.add(entry.id);
			return true;
		},
	};
}

export function renderPackagesPane(
	entries: readonly PackageEntry[],
	selectedIds: ReadonlySet<string>,
	ctx: WardenPanelPaneContext,
	_width: number,
	activity: PaneActivity,
): string[] {
	const selectedCount = entries.filter((entry) =>
		selectedIds.has(entry.id),
	).length;
	const lines: string[] = [];
	lines.push(
		renderActionRow(
			PACKAGES_ACTION_INSTALL,
			selectedCount,
			{ active: activity.activePane && ctx.selectedIndex === 0 },
			ctx,
		),
	);
	lines.push("");
	if (selectedCount > 0) {
		lines.push(
			renderActionRow(
				PACKAGES_ACTION_REMOVE,
				selectedCount,
				{ active: activity.activePane && ctx.selectedIndex === 1 },
				ctx,
			),
		);
	} else {
		lines.push(
			renderSelectPackagesRow(
				{ active: activity.activePane && ctx.selectedIndex === 1 },
				ctx,
			),
		);
	}
	lines.push("");

	if (entries.length === 0) {
		lines.push(
			ctx.theme.fg(
				"muted",
				"No packages installed. Choose Install new package to add one.",
			),
		);
	} else {
		appendPackageRows(lines, entries, selectedIds, ctx, activity);
	}
	lines.push("");

	return lines;
}

export function sourcesFromRemovePayload(payload: unknown): string[] {
	if (!isPlainObject(payload) || !Array.isArray(payload.sources)) return [];
	return payload.sources.filter(
		(source): source is string => typeof source === "string",
	);
}

function appendPackageRows(
	lines: string[],
	entries: readonly PackageEntry[],
	selectedIds: ReadonlySet<string>,
	ctx: WardenPanelPaneContext,
	activity: PaneActivity,
): void {
	const packageIndexOffset = 2;
	const window = packageWindow(entries.length, ctx);
	for (let index = window.start; index < window.end; index++) {
		const entry = entries[index];
		if (!entry) continue;
		lines.push(
			renderPackageRow(
				entry,
				{
					selected: selectedIds.has(entry.id),
					active:
						activity.activePane &&
						ctx.selectedIndex === packageIndexOffset + index,
				},
				ctx,
			),
		);
	}
	if (window.end - window.start >= entries.length) return;
	lines.push(
		ctx.theme.fg(
			"dim",
			`Showing ${window.start + 1}-${window.end} of ${entries.length}`,
		),
	);
}

function packageWindow(totalEntries: number, ctx: WardenPanelPaneContext) {
	const maxPaneLines = finitePaneLines(ctx.maxPaneLines);
	const needsScrollProbe = totalEntries > Math.max(1, maxPaneLines - 5);
	const fixedLines = 5 + (needsScrollProbe ? 1 : 0);
	const listBudget = Math.max(1, maxPaneLines - fixedLines);
	const selectedPackageIndex = clamp(
		ctx.selectedIndex - 2,
		0,
		totalEntries - 1,
	);
	return visibleWindow(totalEntries, selectedPackageIndex, listBudget);
}

function renderSelectPackagesRow(
	activity: RowActivity,
	ctx: WardenPanelPaneContext,
): string {
	return selectableRow("Select packages to remove", activity, "muted", ctx);
}

function renderPackageRow(
	entry: PackageEntry,
	options: PackageRowOptions,
	ctx: WardenPanelPaneContext,
): string {
	const mark = options.selected
		? ctx.glyphs.checkboxOn
		: ctx.glyphs.checkboxOff;
	return selectableRow(`${mark} ${entry.source}`, options, "text", ctx);
}

function renderActionRow(
	action: PackagesPaneActionId,
	selectedCount: number,
	activity: RowActivity,
	ctx: WardenPanelPaneContext,
): string {
	const label =
		action === PACKAGES_ACTION_REMOVE
			? `Remove selected (${selectedCount})`
			: "Install new package";
	return selectableRow(label, activity, "text", ctx);
}

function selectableRow(
	label: string,
	activity: RowActivity,
	color: "muted" | "text",
	ctx: WardenPanelPaneContext,
): string {
	const pointer = activity.active
		? ctx.theme.bold(ctx.theme.fg("text", ctx.glyphs.pointer))
		: "  ";
	const row = `${pointer}${label}`;
	return activity.active
		? ctx.theme.bold(ctx.theme.fg(color, row))
		: ctx.theme.fg(color, row);
}

function visibleWindow(
	total: number,
	selectedIndex: number,
	budget: number,
): { readonly start: number; readonly end: number } {
	const size = Math.max(1, Math.min(total, budget));
	const target = clamp(Math.min(selectedIndex, total - 1), 0, total - 1);
	const start = clamp(
		target - Math.floor(size / 2),
		0,
		Math.max(0, total - size),
	);
	return { start, end: start + size };
}

function finitePaneLines(value: number): number {
	return Number.isFinite(value) && value < Number.MAX_SAFE_INTEGER
		? Math.max(1, Math.floor(value))
		: Number.MAX_SAFE_INTEGER;
}

function isActivation(data: string): boolean {
	return data === " " || data === "\r" || data === "\n";
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isPackagesPaneAction(
	action: WardenPanelPaneAction,
): action is WardenPanelPaneAction & { action: PackagesPaneActionId } {
	return (
		action.action === PACKAGES_ACTION_INSTALL ||
		action.action === PACKAGES_ACTION_REMOVE
	);
}
