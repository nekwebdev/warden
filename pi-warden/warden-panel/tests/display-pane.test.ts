import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { getPanelGlyphs } from "../src/glyphs.js";
import {
	clearWardenPanesForTests,
	getWardenPanes,
	type WardenPanelPaneContext,
} from "../src/registry.js";
import {
	createDisplayPane,
	registerDisplayPane,
} from "../extensions/warden-display/pane.js";
import type { WardenSettings } from "../src/settings.js";

const envBefore = process.env.NODE_ENV;
const plainTheme = {
	fg: (_name: string, text: string) => text,
	bg: (_name: string, text: string) => text,
	bold: (text: string) => text,
};

function createContext(initial: WardenSettings = {}): WardenPanelPaneContext {
	let draftSettings = initial;
	return {
		settings: initial,
		get draftSettings() {
			return draftSettings;
		},
		glyphs: getPanelGlyphs(draftSettings.useNerdGlyphs === true),
		theme: plainTheme,
		selectedIndex: 0,
		maxPaneLines: Number.MAX_SAFE_INTEGER,
		updateDraftSettings(patch) {
			draftSettings = { ...draftSettings, ...patch };
		},
		requestRender: mock.fn(),
	};
}

beforeEach(() => {
	process.env.NODE_ENV = "test";
	clearWardenPanesForTests();
});

afterEach(() => {
	clearWardenPanesForTests();
	if (envBefore === undefined) delete process.env.NODE_ENV;
	else process.env.NODE_ENV = envBefore;
});

describe("display pane", () => {
	it("registers the built-in Display pane once", () => {
		registerDisplayPane();
		registerDisplayPane();

		assert.deepEqual(
			getWardenPanes().map((pane) => pane.id),
			["display"],
		);
		assert.equal(getWardenPanes()[0]?.command, "warden:display");
	});

	it("renders the Nerd Glyph draft setting", () => {
		const pane = createDisplayPane();

		assert.deepEqual(
			pane.render(createContext({ useNerdGlyphs: false }), 80, true),
			["> [ ] Use Nerd Glyphs, requires compatible Nerd font"],
		);
		assert.deepEqual(
			pane.render(createContext({ useNerdGlyphs: true }), 80, true),
			[" 󰡖 Use Nerd Glyphs, requires compatible Nerd font"],
		);
	});

	it("omits pointer when pane is inactive", () => {
		const pane = createDisplayPane();

		assert.deepEqual(
			pane.render(createContext({ useNerdGlyphs: false }), 80, false),
			["  [ ] Use Nerd Glyphs, requires compatible Nerd font"],
		);
	});

	it("toggles only draft settings on activation", () => {
		const pane = createDisplayPane();
		const ctx = createContext({ useNerdGlyphs: false });

		assert.equal(pane.handleInput?.(" ", ctx), true);
		assert.deepEqual(ctx.settings, { useNerdGlyphs: false });
		assert.deepEqual(ctx.draftSettings, { useNerdGlyphs: true });
	});

	it("ignores non-activation input", () => {
		const pane = createDisplayPane();
		const ctx = createContext({ useNerdGlyphs: false });

		assert.equal(pane.handleInput?.("x", ctx), false);
		assert.deepEqual(ctx.draftSettings, { useNerdGlyphs: false });
	});
});
