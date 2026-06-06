import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { getPanelGlyphs } from "../src/glyphs.js";
import {
	clearWardenPanesForTests,
	contributeWardenDisplaySetting,
	getWardenPanes,
	type WardenPanelPaneContext,
} from "../src/registry.js";
import {
	createDisplayPane,
	registerDisplayPane,
} from "../extensions/warden-display/pane.js";
import {
	getPiAgentSettingsPath,
	type WardenSettings,
} from "../src/settings.js";

const envBefore = process.env.NODE_ENV;
const testHomeBefore = process.env.WARDEN_PANEL_TEST_HOME;
let testHome: string | undefined;
const plainTheme = {
	fg: (_name: string, text: string) => text,
	bg: (_name: string, text: string) => text,
	bold: (text: string) => text,
};

function createContext(
	initial: WardenSettings = {},
	selectedIndex = 0,
): WardenPanelPaneContext {
	let draftSettings = initial;
	return {
		settings: initial,
		get draftSettings() {
			return draftSettings;
		},
		glyphs: getPanelGlyphs(draftSettings.useNerdGlyphs === true),
		theme: plainTheme,
		selectedIndex,
		maxPaneLines: Number.MAX_SAFE_INTEGER,
		updateDraftSettings(patch) {
			draftSettings = { ...draftSettings, ...patch };
		},
		requestRender: mock.fn(),
	};
}

beforeEach(() => {
	process.env.NODE_ENV = "test";
	testHome = mkdtempSync(join(tmpdir(), "warden-panel-display-"));
	process.env.WARDEN_PANEL_TEST_HOME = testHome;
	clearWardenPanesForTests();
});

afterEach(() => {
	clearWardenPanesForTests();
	if (envBefore === undefined) delete process.env.NODE_ENV;
	else process.env.NODE_ENV = envBefore;
	if (testHomeBefore === undefined) delete process.env.WARDEN_PANEL_TEST_HOME;
	else process.env.WARDEN_PANEL_TEST_HOME = testHomeBefore;
	if (testHome) rmSync(testHome, { recursive: true, force: true });
	testHome = undefined;
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

	it("toggles and writes Nerd Glyph setting inline", () => {
		const pane = createDisplayPane();
		const ctx = createContext({ useNerdGlyphs: false });
		assert.equal(pane.showApplyControl, false);

		assert.equal(pane.handleInput?.(" ", ctx), true);
		assert.deepEqual(ctx.settings, { useNerdGlyphs: false });
		assert.deepEqual(ctx.draftSettings, { useNerdGlyphs: true });
		assert.deepEqual(
			JSON.parse(readFileSync(getPiAgentSettingsPath(), "utf-8")),
			{ warden: { useNerdGlyphs: true } },
		);
	});

	it("renders and writes contributed display settings inline", () => {
		contributeWardenDisplaySetting({
			id: "skill-status",
			order: 20,
			itemCount: () => 1,
			render: (ctx, _width, active) => [
				`${active && ctx.selectedIndex === 0 ? ">" : " "} Skill status`,
			],
			handleInput: (_data, ctx) => {
				ctx.updateDraftSettings({
					effort: {
						...ctx.draftSettings.effort,
						showSkillStatus: true,
					},
				});
				return true;
			},
		});
		const pane = createDisplayPane();
		const ctx = createContext(
			{ effort: { skills: { "warden-map": "low" } } },
			1,
		);

		assert.equal(pane.itemCount(ctx), 2);
		assert.deepEqual(pane.render(ctx, 80, true), [
			"  [ ] Use Nerd Glyphs, requires compatible Nerd font",
			"> Skill status",
		]);

		assert.equal(pane.handleInput?.(" ", ctx), true);
		assert.deepEqual(ctx.draftSettings.effort, {
			skills: { "warden-map": "low" },
			showSkillStatus: true,
		});
		assert.deepEqual(
			JSON.parse(readFileSync(getPiAgentSettingsPath(), "utf-8")),
			{
				warden: {
					effort: {
						skills: { "warden-map": "low" },
						showSkillStatus: true,
					},
				},
			},
		);
	});

	it("ignores non-activation input", () => {
		const pane = createDisplayPane();
		const ctx = createContext({ useNerdGlyphs: false });

		assert.equal(pane.handleInput?.("x", ctx), false);
		assert.deepEqual(ctx.draftSettings, { useNerdGlyphs: false });
	});
});
