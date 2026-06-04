import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { clearWardenPanesForTests, getWardenPanes } from "../src/registry.js";
import wardenPanel from "../index.js";
import { WARDEN_PACKAGES_REPORT_MESSAGE } from "../extensions/warden-packages/index.js";

type CommandRegistration = {
	description?: string;
	handler: (args: string, ctx: ExtensionCommandContext) => unknown;
};
type TestComponent = { render(width: number): string[] };
type TestCustomFactory = (
	tui: { requestRender(): void },
	theme: typeof plainTheme,
	keybindings: unknown,
	done: (value: unknown) => void,
) => TestComponent | Promise<TestComponent>;

const envBefore = process.env.NODE_ENV;
const testHomeBefore = process.env.WARDEN_PANEL_TEST_HOME;
let testHome: string | undefined;
const plainTheme = {
	fg: (_name: string, text: string) => text,
	bg: (_name: string, text: string) => text,
	bold: (text: string) => text,
};

beforeEach(() => {
	process.env.NODE_ENV = "test";
	testHome = mkdtempSync(join(tmpdir(), "warden-panel-index-"));
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

describe("wardenPanel package extension bundle", () => {
	it("registers bundled panes, commands, and renderers", () => {
		const commands = new Map<string, CommandRegistration>();
		const renderers = new Set<string>();
		wardenPanel({
			registerCommand(name: string, command: CommandRegistration) {
				commands.set(name, command);
			},
			registerMessageRenderer(customType: string) {
				renderers.add(customType);
			},
		} as unknown as ExtensionAPI);

		assert.deepEqual(
			getWardenPanes().map((pane) => pane.id),
			["display", "packages"],
		);
		assert.deepEqual([...commands.keys()].sort(), [
			"warden",
			"warden:display",
			"warden:packages",
		]);
		assert.equal(commands.has("warden:settings"), false);
		assert.equal(commands.get("warden")?.description, "Open Warden panel");
		assert.equal(
			commands.get("warden:display")?.description,
			"Open Warden display settings",
		);
		assert.equal(
			commands.get("warden:packages")?.description,
			"Open Warden packages",
		);
		assert.equal(renderers.has(WARDEN_PACKAGES_REPORT_MESSAGE), true);
	});

	it("opens first available pane from /warden", async () => {
		const commands = new Map<string, CommandRegistration>();
		wardenPanel({
			registerCommand(name: string, command: CommandRegistration) {
				commands.set(name, command);
			},
			registerMessageRenderer() {},
		} as unknown as ExtensionAPI);

		let rendered = "";
		await commands.get("warden")?.handler("", {
			hasUI: true,
			cwd: process.cwd(),
			ui: {
				custom: async (factory: TestCustomFactory) => {
					const component = await factory(
						{ requestRender() {} },
						plainTheme,
						undefined,
						() => {},
					);
					rendered = component.render(100).join("\n");
					return { action: "close" };
				},
				notify() {},
			},
		} as unknown as ExtensionCommandContext);

		assert.match(rendered, /Display \| Packages/);
		assert.match(rendered, /Use Nerd Glyphs/);
	});
});
