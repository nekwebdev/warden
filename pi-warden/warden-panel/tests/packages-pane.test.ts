import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import type { WardenPanelPaneContext } from "../src/index.js";
import {
	PACKAGES_ACTION_INSTALL,
	PACKAGES_ACTION_REMOVE,
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
			true,
		);

		assert.equal(lines[0], "> Install new package");
		assert.equal(lines[1], "");
		assert.equal(lines[2], "  Select packages to remove");
		assert.equal(lines[3], "");
		assert.doesNotMatch(lines.join("\n"), /\d+ installed packages/);
		assert.match(lines.join("\n"), / {2}\[ \] npm:@foo\/bar@1\.0\.0/);
		assert.match(lines.join("\n"), / {2}\[ \] \.\/local/);
		assert.equal(lines.at(-1), "");
		assert.doesNotMatch(lines.join("\n"), /Remove selected/);
	});

	it("toggles multi-select and returns selected remove payload", () => {
		const entries = [entry(0, "npm:a"), entry(1, "git:github.com/u/r")];
		const pane = createPackagesPane({ readEntries: () => entries });

		assert.equal(pane.itemCount(context(0)), 4);
		assert.equal(pane.handleInput?.(" ", context(2)), true);
		assert.equal(pane.itemCount(context(0)), 4);
		assert.match(
			pane.render(context(2), 80, true).join("\n"),
			/ {2}Remove selected \(1\)[\s\S]*> \[x\] npm:a/,
		);

		const result = pane.handleInput?.("\r", context(1));
		assert.deepEqual(result, {
			action: PACKAGES_ACTION_REMOVE,
			payload: { sources: ["npm:a"] },
		});
		assert.deepEqual(sourcesFromRemovePayload(result?.payload), ["npm:a"]);
	});

	it("returns install action from the install row", () => {
		const entries = [entry(0, "npm:a")];
		const pane = createPackagesPane({ readEntries: () => entries });

		assert.deepEqual(pane.handleInput?.("\r", context(0)), {
			action: PACKAGES_ACTION_INSTALL,
		});
	});

	it("uses install as the only action when no packages are installed", () => {
		const pane = createPackagesPane({ readEntries: () => [] });

		assert.equal(pane.itemCount(context(0)), 1);
		const lines = pane.render(context(0), 80, true);
		assert.match(
			lines.join("\n"),
			/> Install new package[\s\S]*Select packages to remove[\s\S]*No packages installed\. Choose Install new package to add one\./,
		);
		assert.equal(lines.at(-1), "");
		assert.deepEqual(pane.handleInput?.("\r", context(0)), {
			action: PACKAGES_ACTION_INSTALL,
		});
	});

	it("renders a scrolling window when entries exceed pane line budget", () => {
		const entries = Array.from({ length: 10 }, (_, index) =>
			entry(index, `npm:p${index}`),
		);
		const lines = renderPackagesPane(
			entries,
			new Set(),
			context(9, 7),
			80,
			true,
		).join("\n");

		assert.doesNotMatch(lines, /npm:p0/);
		assert.match(lines, /npm:p7/);
		assert.match(lines, /Showing \d+-\d+ of 10/);
	});
});
