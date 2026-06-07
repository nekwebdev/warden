import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import type { WardenPanelPaneContext } from "../src/index.js";
import {
	PACKAGES_ACTION_INSTALL,
	PACKAGES_ACTION_REMOVE,
	PACKAGES_ACTION_UPDATE_TAGGED,
	createPackagesPane,
	renderPackagesPane,
	sourcesFromRemovePayload,
} from "../extensions/warden-packages/pane.js";
import type { PackageEntry } from "../extensions/warden-packages/packages.js";

const plainTheme = {
	fg: (_name: string, text: string) => text,
	bg: (_name: string, text: string) => text,
	bold: (text: string) => text,
};

function entry(index: number, source: string): PackageEntry {
	return {
		id: `${index}:${source}`,
		index,
		source,
		filtered: false,
		raw: source,
	};
}

function context(
	selectedIndex: number,
	maxPaneLines = Number.MAX_SAFE_INTEGER,
): WardenPanelPaneContext {
	return {
		settings: {},
		draftSettings: {},
		glyphs: {
			pointer: "> ",
			checkboxOn: "[x]",
			checkboxOff: "[ ]",
		} as WardenPanelPaneContext["glyphs"],
		theme: plainTheme,
		selectedIndex,
		maxPaneLines,
		updateDraftSettings: mock.fn(),
		requestRender: mock.fn(),
	};
}

describe("packages pane", () => {
	it("renders source-only package rows and install action", () => {
		const lines = renderPackagesPane(
			[entry(0, "npm:@foo/bar@1.0.0"), entry(1, "./local")],
			new Set(),
			context(0),
			80,
			{ activePane: true },
		);

		assert.equal(lines[0], "> Install new package");
		assert.equal(lines[1], "  Update tagged packages");
		assert.equal(lines[2], "");
		assert.equal(lines[3], "  Select packages to remove");
		assert.equal(lines[4], "");
		assert.doesNotMatch(lines.join("\n"), /\d+ installed packages/);
		assert.match(lines.join("\n"), / {2}\[ \] npm:@foo\/bar@1\.0\.0/);
		assert.match(lines.join("\n"), / {2}\[ \] \.\/local/);
		assert.equal(lines.at(-1), "");
		assert.doesNotMatch(lines.join("\n"), /Remove selected/);
	});

	it("toggles multi-select and returns selected remove payload", () => {
		const entries = [entry(0, "npm:a"), entry(1, "git:github.com/u/r")];
		const pane = createPackagesPane({ readEntries: () => entries });

		assert.equal(pane.itemCount(context(0)), 5);
		assert.equal(pane.handleInput?.(" ", context(3)), true);
		assert.equal(pane.itemCount(context(0)), 5);
		assert.match(
			pane.render(context(3), 80, true).join("\n"),
			/ {2}Remove selected \(1\)[\s\S]*> \[x\] npm:a/,
		);

		const result = pane.handleInput?.("\r", context(2));
		assert.deepEqual(result, {
			action: PACKAGES_ACTION_REMOVE,
			payload: { sources: ["npm:a"] },
		});
		assert.deepEqual(sourcesFromRemovePayload(result?.payload), ["npm:a"]);
	});

	it("returns install and update actions from action rows", () => {
		const entries = [entry(0, "npm:a")];
		const pane = createPackagesPane({ readEntries: () => entries });

		assert.deepEqual(pane.handleInput?.("\r", context(0)), {
			action: PACKAGES_ACTION_INSTALL,
		});
		assert.deepEqual(pane.handleInput?.("\r", context(1)), {
			action: PACKAGES_ACTION_UPDATE_TAGGED,
		});
	});

	it("keeps update action available when no packages are installed", () => {
		const pane = createPackagesPane({ readEntries: () => [] });

		assert.equal(pane.itemCount(context(0)), 2);
		const lines = pane.render(context(1), 80, true);
		assert.match(
			lines.join("\n"),
			/ {2}Install new package\n> Update tagged packages[\s\S]*No packages installed\. Choose Install new package to add one\./,
		);
		assert.equal(lines.at(-1), "");
		assert.deepEqual(pane.handleInput?.("\r", context(0)), {
			action: PACKAGES_ACTION_INSTALL,
		});
		assert.deepEqual(pane.handleInput?.("\r", context(1)), {
			action: PACKAGES_ACTION_UPDATE_TAGGED,
		});
	});

	it("renders a scrolling window when entries exceed pane line budget", () => {
		const entries = Array.from({ length: 10 }, (_, index) =>
			entry(index, `npm:p${index}`),
		);
		const lines = renderPackagesPane(entries, new Set(), context(10, 7), 80, {
			activePane: true,
		}).join("\n");

		assert.doesNotMatch(lines, /npm:p0/);
		assert.match(lines, /npm:p7/);
		assert.match(lines, /Showing \d+-\d+ of 10/);
	});
});
