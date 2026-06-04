import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { clearWardenPanesForTests, getWardenPanes } from "../src/registry.js";
import wardenPanel from "../src/index.js";

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

describe("wardenPanel extension", () => {
	it("registers Settings pane and command aliases", () => {
		const commands = new Map<string, CommandRegistration>();
		wardenPanel({
			registerCommand(name: string, command: CommandRegistration) {
				commands.set(name, command);
			},
		} as unknown as ExtensionAPI);

		assert.deepEqual(
			getWardenPanes().map((pane) => pane.id),
			["settings"],
		);
		assert.equal(commands.has("warden"), true);
		assert.equal(commands.has("warden:settings"), true);
		assert.equal(commands.get("warden")?.description, "Open Warden panel");
		assert.equal(
			commands.get("warden:settings")?.description,
			"Open Warden settings",
		);
	});

	it("keeps documented command aliases stable", () => {
		const commands = new Map<string, CommandRegistration>();
		wardenPanel({
			registerCommand(name: string, command: CommandRegistration) {
				commands.set(name, command);
			},
		} as unknown as ExtensionAPI);

		assert.deepEqual([...commands.keys()].sort(), [
			"warden",
			"warden:settings",
		]);
	});
});
