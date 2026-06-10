import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { WardenPanelPaneContext } from "../../warden-panel/src/index.js";
import {
	clearWardenPanesForTests,
	getWardenDisplaySettings,
	getWardenPane,
} from "../../warden-panel/src/registry.js";
import wardenEffort, {
	EFFORT_COMMAND,
	EFFORT_FOOTER_HINT,
	EFFORT_PANE_ID,
	SKILL_STATUS_DISPLAY_SETTING_ID,
	SKILL_STATUS_SETTING_LABEL,
	createEffortPane,
} from "../extensions/warden-effort/index.js";
import { getPiAgentSettingsPath } from "../src/effort.js";

const envBefore = {
	NODE_ENV: process.env.NODE_ENV,
	PI_CODING_AGENT_DIR: process.env.PI_CODING_AGENT_DIR,
	WARDEN_FLOW_TEST_HOME: process.env.WARDEN_FLOW_TEST_HOME,
	WARDEN_PANEL_TEST_HOME: process.env.WARDEN_PANEL_TEST_HOME,
};
const plainTheme = {
	fg: (_name: string, text: string) => text,
	bg: (_name: string, text: string) => text,
	bold: (text: string) => text,
};

type Component = {
	render?(width: number): string[];
	handleInput?(data: string): void;
};
type RenderableComponent = Component & { render(width: number): string[] };
type RegisteredCommandOptions = Parameters<ExtensionAPI["registerCommand"]>[1];
type RegisteredCommand = {
	name: string;
	handler: RegisteredCommandOptions["handler"];
};
type CustomFactory = (
	api: { requestRender(): void },
	theme: typeof plainTheme,
	initial: undefined,
	close: (result: unknown) => void,
) => Component | Promise<Component>;

type TestSettings = {
	warden?: {
		effort?: {
			skills?: Record<string, string>;
		};
	};
};

function renderText(component: Component, width = 100): string {
	return (component as RenderableComponent).render(width).join("\n");
}

function context(selectedIndex: number): WardenPanelPaneContext {
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
		maxPaneLines: Number.MAX_SAFE_INTEGER,
		updateDraftSettings: mock.fn(),
		requestRender: mock.fn(),
	};
}

function writeSettings(settings: unknown): void {
	writeFileSync(getPiAgentSettingsPath(), JSON.stringify(settings), "utf-8");
}

function readSettings(): TestSettings {
	return JSON.parse(
		readFileSync(getPiAgentSettingsPath(), "utf-8"),
	) as TestSettings;
}

function readSkillEffort(skillName: string): string | undefined {
	return readSettings().warden?.effort?.skills?.[skillName];
}

function linesFor(settings: unknown, selectedIndex = 0): string[] {
	writeSettings(settings);
	return createEffortPane().render(context(selectedIndex), 80, true);
}

beforeEach(() => {
	process.env.NODE_ENV = "test";
	delete process.env.WARDEN_FLOW_TEST_HOME;
	delete process.env.WARDEN_PANEL_TEST_HOME;
	process.env.PI_CODING_AGENT_DIR = mkdtempSync(
		join(tmpdir(), "warden-effort-pane-"),
	);
	mkdirSync(process.env.PI_CODING_AGENT_DIR, { recursive: true });
	clearWardenPanesForTests();
});

afterEach(() => {
	clearWardenPanesForTests();
	if (process.env.PI_CODING_AGENT_DIR)
		rmSync(process.env.PI_CODING_AGENT_DIR, { recursive: true, force: true });
	for (const [key, value] of Object.entries(envBefore)) {
		if (value === undefined) delete process.env[key as keyof NodeJS.ProcessEnv];
		else process.env[key as keyof NodeJS.ProcessEnv] = value;
	}
});

describe("Effort pane", () => {
	it("registers /warden:effort and opens the Effort pane", async () => {
		writeSettings({
			warden: { effort: { skills: { "warden-map": "low" } } },
		});
		const commands: RegisteredCommand[] = [];
		const pi = {
			registerCommand: (name: string, options: RegisteredCommandOptions) =>
				commands.push({ name, handler: options.handler }),
			on: mock.fn(),
		} as unknown as ExtensionAPI;
		wardenEffort(pi);

		assert.equal(getWardenPane(EFFORT_PANE_ID)?.label, "Effort");
		const command = commands.find((item) => item.name === EFFORT_COMMAND);
		assert.ok(command);

		await command.handler("", {
			hasUI: true,
			ui: {
				custom: async (factory: unknown) =>
					await new Promise((resolve) => {
						assert.equal(typeof factory, "function");
						const buildComponent = factory as CustomFactory;
						Promise.resolve(
							buildComponent(
								{ requestRender: mock.fn() },
								plainTheme,
								undefined,
								resolve,
							),
						).then((component) => {
							const text = renderText(component);
							assert.match(text, /Effort/);
							assert.match(text, /warden-map:\s+low/);
							resolve({ action: "close" });
						});
					}),
				notify: mock.fn(),
			},
		} as unknown as Parameters<RegisteredCommand["handler"]>[1]);
	});

	it("lists valid warden-* entries from effort settings", () => {
		const lines = linesFor({
			warden: {
				effort: {
					skills: {
						"warden-map": "low",
						"warden-extra": "high",
						"other-skill": "medium",
						"warden-bad": "maximum",
					},
				},
			},
		}).join("\n");

		assert.match(lines, /warden-map:\s+low/);
		assert.match(lines, /warden-extra:\s+high/);
		assert.doesNotMatch(lines, /other-skill/);
		assert.doesNotMatch(lines, /warden-bad/);
	});

	it("sorts seeded skills before unknown valid warden-* entries", () => {
		const lines = linesFor({
			warden: {
				effort: {
					skills: {
						"warden-zed": "high",
						"warden-commit": "medium",
						"warden-create-skill": "high",
						"warden-docs": "medium",
						"warden-alpha": "minimal",
						"warden-map": "low",
					},
				},
			},
		});

		assert.deepEqual(
			lines.filter((line) => /warden-/.test(line)).map((line) => line.trim()),
			[
				"> warden-map: low",
				"warden-commit: medium",
				"warden-create-skill: high",
				"warden-docs: medium",
				"warden-alpha: minimal",
				"warden-zed: high",
			],
		);
	});

	it("contributes skill status indicator toggle to the Display pane", () => {
		wardenEffort({
			registerCommand: mock.fn(),
			on: mock.fn(),
		} as unknown as ExtensionAPI);
		const setting = getWardenDisplaySettings().find(
			(item) => item.id === SKILL_STATUS_DISPLAY_SETTING_ID,
		);
		assert.ok(setting);
		let draftSettings: WardenPanelPaneContext["draftSettings"] = {
			effort: {
				profiles: { careful: true },
				skills: { "warden-map": "low" },
			},
		};
		const ctx: WardenPanelPaneContext = {
			...context(0),
			get draftSettings() {
				return draftSettings;
			},
			updateDraftSettings(patch) {
				draftSettings = { ...draftSettings, ...patch };
			},
		};

		assert.deepEqual(setting.render(ctx, 80, true), [
			"> [ ] Show skill status indicator",
			"",
		]);
		assert.ok(
			setting
				.render(ctx, 80, true)
				.join("\n")
				.includes(SKILL_STATUS_SETTING_LABEL),
		);
		assert.equal(setting.handleInput?.(" ", ctx), true);
		assert.deepEqual(draftSettings.effort, {
			profiles: { careful: true },
			showSkillStatus: true,
			skills: { "warden-map": "low" },
		});
	});

	it("cycles and saves selected effort inline without Apply", () => {
		writeSettings({
			warden: { effort: { skills: { "warden-map": "low" } } },
		});
		const pane = createEffortPane();
		assert.equal(pane.showApplyControl, false);

		assert.equal(pane.handleInput?.(" ", context(0)), true);
		assert.equal(readSkillEffort("warden-map"), "medium");
		assert.equal(pane.handleInput?.("\r", context(0)), true);
		assert.equal(readSkillEffort("warden-map"), "high");
	});

	it("uses the custom Effort footer hint", () => {
		const pane = createEffortPane();
		assert.equal(pane.footerHint, EFFORT_FOOTER_HINT);
		assert.equal(
			EFFORT_FOOTER_HINT,
			"↑↓ navigate • Space/Enter cycle effort • Tab/Shift+Tab pane • Esc close",
		);
	});
});
