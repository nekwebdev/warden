import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
	clearWardenPanesForTests,
	contributeWardenDisplaySetting,
	contributeWardenPane,
	getWardenDisplaySettings,
	getWardenPane,
	getWardenPanes,
	hasWardenDisplaySetting,
	type WardenPanelPane,
} from "../src/registry.js";

const envBefore = process.env.NODE_ENV;

function testPane(overrides: Partial<WardenPanelPane>): WardenPanelPane {
	return {
		id: "pane",
		label: "Pane",
		itemCount: () => 0,
		render: () => [],
		...overrides,
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

describe("warden pane registry", () => {
	it("returns panes sorted by order, label, then id", () => {
		contributeWardenPane(testPane({ id: "z", label: "Zulu", order: 20 }));
		contributeWardenPane(testPane({ id: "b", label: "Beta", order: 10 }));
		contributeWardenPane(testPane({ id: "a", label: "Alpha", order: 10 }));

		assert.deepEqual(
			getWardenPanes().map((pane) => pane.id),
			["a", "b", "z"],
		);
	});

	it("rejects duplicate pane ids", () => {
		contributeWardenPane(testPane({ id: "settings", label: "Settings" }));
		assert.throws(
			() => contributeWardenPane(testPane({ id: "settings", label: "Other" })),
			/Duplicate Warden pane: settings/,
		);
	});

	it("rejects invalid descriptors", () => {
		assert.throws(
			() => contributeWardenPane(testPane({ id: "" })),
			/id is required/,
		);
		assert.throws(
			() => contributeWardenPane(testPane({ label: "" })),
			/label is required/,
		);
		assert.throws(
			() =>
				contributeWardenPane(
					testPane({ command: "bad" as `warden:${string}` }),
				),
			/must start with warden:/,
		);
	});

	it("returns a registered pane by id", () => {
		const pane = testPane({ id: "settings", label: "Settings" });
		contributeWardenPane(pane);
		assert.equal(getWardenPane("settings"), pane);
		assert.equal(getWardenPane("missing"), undefined);
	});

	it("returns display settings sorted by order then id", () => {
		contributeWardenDisplaySetting({
			id: "zed",
			order: 20,
			itemCount: () => 0,
			render: () => [],
		});
		contributeWardenDisplaySetting({
			id: "alpha",
			order: 10,
			itemCount: () => 0,
			render: () => [],
		});

		assert.equal(hasWardenDisplaySetting("alpha"), true);
		assert.deepEqual(
			getWardenDisplaySettings().map((setting) => setting.id),
			["alpha", "zed"],
		);
	});

	it("rejects duplicate display setting ids", () => {
		const setting = {
			id: "toggle",
			itemCount: () => 0,
			render: () => [],
		};
		contributeWardenDisplaySetting(setting);
		assert.throws(
			() => contributeWardenDisplaySetting(setting),
			/Duplicate Warden display setting: toggle/,
		);
	});
});
