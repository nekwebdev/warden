import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";

const packageRoot = resolve(import.meta.dirname, "..");
const entrypoint = pathToFileURL(resolve(packageRoot, "index.ts"));

async function registryModule() {
	return import(entrypoint.href);
}

function makeTempProject() {
	const root = mkdtempSync(join(tmpdir(), "warden-subagents-"));
	return {
		root,
		cleanup() {
			rmSync(root, { recursive: true, force: true });
		},
	};
}

function writeAgent(dir, fileName, content) {
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, fileName), content);
}

describe("default agent registry", () => {
	it("exports functional registry API alongside inert extension export", async () => {
		const mod = await registryModule();
		assert.equal(typeof mod.default, "function");
		assert.equal(typeof mod.loadAgentTypes, "function");
		assert.equal(typeof mod.resolveAgentType, "function");
		assert.ok(Array.isArray(mod.DEFAULT_AGENT_TYPES));
	});

	it("registers Warden-owned default agent types", async () => {
		const { loadAgentTypes, resolveAgentType } = await registryModule();
		const tmp = makeTempProject();
		try {
			const registry = await loadAgentTypes({
				cwd: tmp.root,
				globalAgentsDir: join(tmp.root, "missing-global"),
			});

			for (const name of ["general-purpose", "Explore", "Plan"]) {
				const resolved = resolveAgentType(registry, name.toUpperCase());
				assert.equal(resolved.status, "found");
				assert.equal(resolved.agent.enabled, true);
				assert.ok(
					resolved.agent.prompt.trim().length > 0,
					`${name} prompt should not be empty`,
				);
			}

			const general = resolveAgentType(registry, "GENERAL-PURPOSE");
			assert.equal(general.status, "found");
			assert.equal(general.agent.promptMode, "append");
			assert.equal(general.agent.inheritContext, true);
			assert.equal(general.agent.isolation, "parent-twin");
			assert.equal(general.agent.tools.kind, "all");

			for (const name of ["explore", "plan"]) {
				const resolved = resolveAgentType(registry, name);
				assert.equal(resolved.status, "found");
				assert.equal(resolved.agent.isolation, "standalone");
				assert.equal(resolved.agent.inheritContext, false);
				assert.equal(resolved.agent.promptMode, "replace");
				assert.deepEqual(resolved.agent.tools, {
					kind: "allow",
					selectors: [
						{ kind: "builtin", name: "read" },
						{ kind: "builtin", name: "grep" },
						{ kind: "builtin", name: "find" },
						{ kind: "builtin", name: "ls" },
					],
				});
			}
		} finally {
			tmp.cleanup();
		}
	});
});

describe("agent type resolution", () => {
	it("returns discriminated found, disabled, and unknown results without filesystem IO", async () => {
		const { loadAgentTypes, resolveAgentType } = await registryModule();
		const tmp = makeTempProject();
		try {
			writeAgent(
				join(tmp.root, "project-agents"),
				"helper.md",
				`---\ndescription: Hidden helper\nenabled: false\n---\nMasked prompt.`,
			);
			const registry = await loadAgentTypes({
				cwd: tmp.root,
				globalAgentsDir: join(tmp.root, "missing-global"),
				projectAgentsDir: join(tmp.root, "project-agents"),
			});

			assert.equal(resolveAgentType(registry, "Explore").status, "found");
			assert.deepEqual(resolveAgentType(registry, "HELPER"), {
				status: "disabled",
				name: "HELPER",
			});
			assert.deepEqual(resolveAgentType(registry, "missing"), {
				status: "unknown",
				name: "missing",
			});
		} finally {
			tmp.cleanup();
		}
	});
});
