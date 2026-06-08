import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import {
	AGENTS_COMMAND,
	SUBAGENTS_PANE_ID,
	WARDEN_AGENTS_COMMAND,
	buildSubagentsPaneSnapshot,
	createSubagentsCommandHandler,
	createSubagentsPane,
	registerSubagentsPane,
	renderSubagentsPane,
} from "../src/ui/subagents-pane.ts";

const identityTheme = {
	fg: (_color, text) => text,
	bg: (_color, text) => text,
	bold: (text) => text,
};

function paneContext(overrides = {}) {
	return {
		settings: {},
		draftSettings: {},
		glyphs: { pointer: ">", checkboxOn: "[x]", checkboxOff: "[ ]" },
		theme: identityTheme,
		selectedIndex: 0,
		maxPaneLines: Number.MAX_SAFE_INTEGER,
		updateDraftSettings() {},
		requestRender() {},
		...overrides,
	};
}

function agent(overrides = {}) {
	return {
		type: "Explore",
		name: "Explore",
		displayName: "Explore",
		description: "Read-only explorer",
		prompt: "Inspect safely.",
		enabled: true,
		tools: { kind: "default" },
		extensions: [],
		skills: [],
		disallowedTools: [],
		memory: false,
		isolation: "standalone",
		inheritContext: false,
		promptMode: "replace",
		runInBackground: false,
		source: "default",
		...overrides,
	};
}

function textFrom(lines) {
	return lines.join("\n");
}

describe("Subagents pane rendering", () => {
	it("renders zero activity, agent types, disabled/source indicators, diagnostics, and no future actions", () => {
		const snapshot = {
			activity: { running: [], queued: [], queuedCount: 0 },
			registry: {
				agents: [
					agent({ type: "Explore", displayName: "Explore", source: "default" }),
					agent({
						type: "reviewer",
						displayName: "Reviewer",
						source: "project",
						enabled: false,
					}),
				],
				diagnostics: [
					{
						severity: "warning",
						code: "missing-description",
						message: "Missing description",
					},
					{ severity: "error", code: "bad-yaml", message: "Bad YAML" },
				],
			},
		};

		const lines = renderSubagentsPane(snapshot, paneContext(), 80, true);
		const text = textFrom(lines);

		assert.match(text, /No queued or running background agents\./);
		assert.match(text, /Explore.*default/);
		assert.match(text, /Reviewer.*project.*disabled/);
		assert.match(text, /Diagnostics: 2.*Missing description/);
		for (const forbidden of [
			"Create agent",
			"Edit agent",
			"Delete agent",
			"Stop agent",
			"Settings",
			"Scheduling",
		]) {
			assert.ok(!text.includes(forbidden), `pane should omit ${forbidden}`);
		}
	});

	it("renders active queued and running background-agent summary from manager snapshot", () => {
		const snapshot = buildSubagentsPaneSnapshot({
			activity: {
				running: [
					{
						agentId: "agent-1",
						status: "running",
						agentType: "Explore",
						requestedAgentType: "Explore",
						description: "Inspect tests",
						createdAt: 1,
						updatedAt: 2,
						currentActivity: "reading files",
					},
				],
				queued: [
					{
						agentId: "agent-2",
						status: "queued",
						agentType: "Plan",
						requestedAgentType: "Plan",
						description: "Plan fix",
						createdAt: 3,
						updatedAt: 3,
					},
				],
				queuedCount: 1,
			},
			registry: { agents: [agent()], diagnostics: [] },
		});

		const text = textFrom(
			renderSubagentsPane(snapshot, paneContext(), 80, true),
		);

		assert.match(text, /Running \(1\)/);
		assert.match(text, /agent-1.*Explore.*Inspect tests/);
		assert.match(text, /reading files/);
		assert.match(text, /Queued \(1\)/);
		assert.match(text, /agent-2.*Plan.*Plan fix/);
	});

	it("creates read-only public Warden pane metadata", () => {
		const pane = createSubagentsPane(() => ({
			activity: { running: [], queued: [], queuedCount: 0 },
			registry: { agents: [], diagnostics: [] },
		}));

		assert.equal(pane.id, SUBAGENTS_PANE_ID);
		assert.equal(pane.label, "Subagents");
		assert.equal(pane.command, WARDEN_AGENTS_COMMAND);
		assert.equal(pane.showApplyControl, false);
		assert.equal(pane.itemCount(paneContext()), 0);
		assert.equal(pane.handleInput?.("\n", paneContext()), false);
	});
});

describe("Subagents command and pane registration", () => {
	it("registers /agents and /warden:agents aliases for same Subagents pane idempotently", async () => {
		process.env.NODE_ENV = "test";
		const registryPath = resolve("../warden-panel/src/registry.ts");
		const registry = await import(pathToFileURL(registryPath));
		registry.clearWardenPanesForTests();

		registerSubagentsPane();
		registerSubagentsPane();

		assert.equal(registry.getWardenPane(SUBAGENTS_PANE_ID)?.label, "Subagents");
	});

	it("loads registry from command cwd before opening pane for both aliases", async () => {
		const calls = [];
		const opened = [];
		const manager = {
			getActivitySnapshot() {
				return { running: [], queued: [], queuedCount: 0 };
			},
		};
		const handler = createSubagentsCommandHandler({
			manager,
			loadAgentTypes(options) {
				calls.push(options.cwd);
				return {
					agents: [agent({ type: "custom", source: "project" })],
					diagnostics: [],
				};
			},
			openPanel: async (_pi, _ctx, options) => {
				opened.push(options.initialPaneId);
			},
		});
		const ctx = { hasUI: true, cwd: "/tmp/project", ui: { notify() {} } };

		await handler([], ctx);
		await handler([], ctx);

		assert.deepEqual(calls, ["/tmp/project", "/tmp/project"]);
		assert.deepEqual(opened, [SUBAGENTS_PANE_ID, SUBAGENTS_PANE_ID]);
	});

	it("notifies instead of throwing in non-interactive mode", async () => {
		const notifications = [];
		let loaded = false;
		let opened = false;
		const handler = createSubagentsCommandHandler({
			manager: {
				getActivitySnapshot: () => ({
					running: [],
					queued: [],
					queuedCount: 0,
				}),
			},
			loadAgentTypes() {
				loaded = true;
				return { agents: [], diagnostics: [] };
			},
			openPanel: async () => {
				opened = true;
			},
		});

		await handler([], {
			hasUI: false,
			cwd: "/tmp/project",
			ui: {
				notify: (message, level) => notifications.push({ message, level }),
			},
		});

		assert.equal(loaded, false);
		assert.equal(opened, false);
		assert.deepEqual(notifications, [
			{ message: "/agents requires interactive mode", level: "error" },
		]);
	});

	it("extension registers aliases that both notify in non-interactive mode", async () => {
		const mod = await import(
			pathToFileURL(resolve("extensions/subagents/index.ts"))
		);
		const commands = new Map();
		const notifications = [];
		const fakeApi = {
			registerTool() {},
			registerCommand(name, definition) {
				commands.set(name, definition);
			},
			on() {},
		};

		mod.default(fakeApi);

		assert.ok(commands.has(AGENTS_COMMAND));
		assert.ok(commands.has(WARDEN_AGENTS_COMMAND));
		assert.equal(
			commands.get(AGENTS_COMMAND).description,
			"Open Warden subagents",
		);
		assert.equal(
			commands.get(WARDEN_AGENTS_COMMAND).description,
			"Open Warden subagents",
		);

		const ctx = {
			hasUI: false,
			cwd: "/tmp/project",
			ui: {
				notify: (message, level) => notifications.push({ message, level }),
			},
		};
		await commands.get(AGENTS_COMMAND).handler([], ctx);
		await commands.get(WARDEN_AGENTS_COMMAND).handler([], ctx);

		assert.deepEqual(notifications, [
			{ message: "/agents requires interactive mode", level: "error" },
			{ message: "/warden:agents requires interactive mode", level: "error" },
		]);
	});
});
