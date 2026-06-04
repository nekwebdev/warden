import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPanelGlyphs, renderPanelBorder } from "../src/glyphs.js";

describe("getPanelGlyphs", () => {
	it("returns unicode panel glyphs when nerd glyphs are disabled", () => {
		assert.deepEqual(getPanelGlyphs(false), {
			border: {
				topLeft: "┏",
				topRight: "┓",
				bottomLeft: "┗",
				bottomRight: "┛",
				horizontal: "━",
				vertical: "┃",
			},
			pointer: "> ",
			checkboxOn: "[x]",
			checkboxOff: "[ ]",
			bullet: "•",
		});
	});

	it("returns nerd panel glyphs when nerd glyphs are enabled", () => {
		assert.deepEqual(getPanelGlyphs(true), {
			border: {
				topLeft: "┏",
				topRight: "┓",
				bottomLeft: "┗",
				bottomRight: "┛",
				horizontal: "━",
				vertical: "┃",
			},
			pointer: " ",
			checkboxOn: "󰡖",
			checkboxOff: "󰄱",
			bullet: "•",
		});
	});
});

describe("renderPanelBorder", () => {
	it("renders border strings from glyph map", () => {
		assert.deepEqual(renderPanelBorder(getPanelGlyphs(false).border, 4), {
			top: "┏━━━━┓",
			bottom: "┗━━━━┛",
			left: "┃",
			right: "┃",
		});
	});
});
