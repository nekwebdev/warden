import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import {
	clearWardenPanesForTests,
	getWardenPanes,
	handleWardenPaneAction,
} from "../src/registry.js";
import wardenPackages, {
	PACKAGES_COMMAND,
	PACKAGES_PANE_ID,
	WARDEN_PACKAGES_REPORT_MESSAGE,
} from "../extensions/warden-packages/index.js";

type CommandRegistration = { description?: string; handler: unknown };
const envBefore = process.env.NODE_ENV;

beforeEach(() => {
	process.env.NODE_ENV = "test";
	clearWardenPanesForTests();
});

afterEach(() => {
	clearWardenPanesForTests();
	if (envBefore === undefined) delete process.env.NODE_ENV;
	else process.env.NODE_ENV = envBefore;
});

describe("wardenPackages extension", () => {
	it("registers Packages pane plus command", () => {
		const commands = new Map<string, CommandRegistration>();
		const renderers = new Set<string>();
		wardenPackages({
			registerCommand(name: string, command: CommandRegistration) {
				commands.set(name, command);
			},
			registerMessageRenderer(customType: string) {
				renderers.add(customType);
			},
		} as unknown as ExtensionAPI);

		assert.deepEqual(
			getWardenPanes().map((pane) => pane.id),
			[PACKAGES_PANE_ID],
		);
		assert.equal(getWardenPanes()[0]?.label, "Packages");
		assert.equal(getWardenPanes()[0]?.command, PACKAGES_COMMAND);
		assert.equal(commands.has(PACKAGES_COMMAND), true);
		assert.equal(
			commands.get(PACKAGES_COMMAND)?.description,
			"Open Warden packages",
		);
		assert.equal(renderers.has(WARDEN_PACKAGES_REPORT_MESSAGE), true);
	});

	it("registers package pane action handler for panels opened through /warden", async () => {
		let inputCalled = false;
		const api = {
			registerCommand() {},
			registerMessageRenderer() {},
		} as unknown as ExtensionAPI;
		wardenPackages(api);

		const handled = await handleWardenPaneAction(
			PACKAGES_PANE_ID,
			{ action: "install" },
			{
				pi: api,
				commandContext: {
					cwd: process.cwd(),
					ui: {
						async input() {
							inputCalled = true;
							return undefined;
						},
						notify() {},
					},
				} as unknown as ExtensionCommandContext,
			},
		);

		assert.equal(handled, true);
		assert.equal(inputCalled, true);
	});

	it("registers Packages pane only once", () => {
		const api = {
			registerCommand() {},
			registerMessageRenderer() {},
		} as unknown as ExtensionAPI;

		wardenPackages(api);
		wardenPackages(api);

		assert.deepEqual(
			getWardenPanes().map((pane) => pane.id),
			[PACKAGES_PANE_ID],
		);
	});
});
