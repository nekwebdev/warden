import type { Component } from "@earendil-works/pi-tui";
import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { clearWardenPanesForTests, contributeWardenPane } from "../src/registry.js";
import { registerSettingsPane } from "../src/panes/settings.js";
import { getPiAgentSettingsPath } from "../src/settings.js";
import { showWardenPanel, type WardenPanelUI } from "../src/panel.js";

const envBefore = process.env.NODE_ENV;
const plainTheme = {
	fg: (_name: string, text: string) => text,
	bg: (_name: string, text: string) => text,
	bold: (text: string) => text,
};

type RenderableComponent = Component & { render(width: number): string[] };

function renderText(component: Component, width = 100): string {
	return (component as RenderableComponent).render(width).join("\n");
}

function testUI(
	run: (component: Component, resolve: (value: unknown) => void) => void,
): WardenPanelUI {
	return {
		custom: async (factory: any) =>
			await new Promise((resolve) => {
				Promise.resolve(
					factory({ requestRender: mock.fn() }, plainTheme, undefined, resolve),
				).then((component) => run(component, resolve));
			}),
	} as unknown as WardenPanelUI;
}

async function withTempSettings(
	contents: unknown,
	test: () => Promise<void>,
): Promise<void> {
	const originalTestHome = process.env.WARDEN_PANEL_TEST_HOME;
	const testHome = mkdtempSync(join(tmpdir(), "warden-panel-ui-"));
	process.env.WARDEN_PANEL_TEST_HOME = testHome;
	const settingsPath = getPiAgentSettingsPath();
	if (contents !== undefined) {
		mkdirSync(dirname(settingsPath), { recursive: true });
		writeFileSync(settingsPath, JSON.stringify(contents), "utf-8");
	}

	try {
		await test();
	} finally {
		if (originalTestHome === undefined)
			delete process.env.WARDEN_PANEL_TEST_HOME;
		else process.env.WARDEN_PANEL_TEST_HOME = originalTestHome;
		rmSync(testHome, { recursive: true, force: true });
	}
}

beforeEach(() => {
	process.env.NODE_ENV = "test";
	clearWardenPanesForTests();
	registerSettingsPane();
});

afterEach(() => {
	clearWardenPanesForTests();
	if (envBefore === undefined) delete process.env.NODE_ENV;
	else process.env.NODE_ENV = envBefore;
});

describe("warden panel", () => {
	it("renders Settings pane with unicode glyphs", async () => {
		await withTempSettings({ warden: { useNerdGlyphs: false } }, async () => {
			const ui = testUI((component, resolve) => {
				const text = renderText(component);
				assert.match(text, /^┏━━ Warden configuration ━+┓$/m);
				assert.match(text, /Settings/);
				assert.match(text, /> \[ \] Use Nerd Glyphs/);
				assert.match(text, /Apply|No changes/);
				resolve({ action: "close" });
			});

			assert.deepEqual(
				await showWardenPanel(ui, { initialPaneId: "settings" }),
				{ action: "close" },
			);
		});
	});

	it("renders Nerd glyphs when enabled", async () => {
		await withTempSettings({ warden: { useNerdGlyphs: true } }, async () => {
			const ui = testUI((component, resolve) => {
				const text = renderText(component);
				assert.match(text, / 󰡖 Use Nerd Glyphs/);
				assert.doesNotMatch(text, /> \[ \] Use Nerd Glyphs/);
				resolve({ action: "close" });
			});

			assert.deepEqual(
				await showWardenPanel(ui, { initialPaneId: "settings" }),
				{ action: "close" },
			);
		});
	});

	it("keeps panel frame at narrow widths", async () => {
		await withTempSettings({ warden: { useNerdGlyphs: false } }, async () => {
			const ui = testUI((component, resolve) => {
				const text = renderText(component, 40);
				assert.match(text, /^┏━━ Warden configuration/m);
				assert.match(text, /┃/);
				resolve({ action: "close" });
			});

			assert.deepEqual(await showWardenPanel(ui), { action: "close" });
		});
	});

	it("cycles panes forward and backward", async () => {
		contributeWardenPane({
			id: "extra",
			label: "Extra",
			order: 10,
			itemCount: () => 0,
			render: () => ["Extra pane"],
		});
		await withTempSettings({ warden: { useNerdGlyphs: false } }, async () => {
			const ui = testUI((component, resolve) => {
				assert.match(renderText(component), /Settings \| Extra/);
				component.handleInput?.("\t");
				assert.match(renderText(component), /Extra pane/);
				component.handleInput?.("\x1b[Z");
				assert.match(renderText(component), /Use Nerd Glyphs/);
				resolve({ action: "close" });
			});

			assert.deepEqual(await showWardenPanel(ui), { action: "close" });
		});
	});

	it("toggles draft Nerd Glyphs without writing until Apply", async () => {
		await withTempSettings(
			{
				warden: {
					agents: { sentinel: { cwd: "~/work" } },
					useNerdGlyphs: false,
				},
			},
			async () => {
				const ui = testUI((component) => {
					component.handleInput?.(" ");
					assert.equal(
						JSON.parse(readFileSync(getPiAgentSettingsPath(), "utf-8")).warden
							.useNerdGlyphs,
						false,
					);
					component.handleInput?.("\x1b[B");
					component.handleInput?.("\r");
				});

				const result = await showWardenPanel(ui, { initialPaneId: "settings" });
				assert.deepEqual(result, {
					action: "applied",
					settings: { useNerdGlyphs: true },
				});
				assert.deepEqual(
					JSON.parse(readFileSync(getPiAgentSettingsPath(), "utf-8")).warden,
					{
						agents: { sentinel: { cwd: "~/work" } },
						useNerdGlyphs: true,
					},
				);
			},
		);
	});

	it("keeps documented keyboard controls visible in footer", async () => {
		await withTempSettings({ warden: { useNerdGlyphs: false } }, async () => {
			const ui = testUI((component, resolve) => {
				const text = renderText(component);
				assert.match(text, /↑↓ navigate/);
				assert.match(text, /Space\/Enter select/);
				assert.match(text, /Tab\/Shift\+Tab pane/);
				assert.match(text, /Esc close/);
				resolve({ action: "close" });
			});

			assert.deepEqual(await showWardenPanel(ui), { action: "close" });
		});
	});

	it("closes on Escape without writing", async () => {
		await withTempSettings({ warden: { useNerdGlyphs: false } }, async () => {
			const ui = testUI((component) => {
				component.handleInput?.(" ");
				component.handleInput?.("\x1b");
			});

			assert.deepEqual(await showWardenPanel(ui), { action: "close" });
			assert.equal(
				JSON.parse(readFileSync(getPiAgentSettingsPath(), "utf-8")).warden
					.useNerdGlyphs,
				false,
			);
		});
	});
});
