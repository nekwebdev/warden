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

function codes(registry) {
	return registry.diagnostics.map((diagnostic) => diagnostic.code);
}

describe("custom agent loading", () => {
	it("uses nearest project agents, global agents, and project-over-global precedence", async () => {
		const { loadAgentTypes, resolveAgentType } = await registryModule();
		const tmp = makeTempProject();
		try {
			const globalDir = join(tmp.root, "global", "agents");
			const farProjectDir = join(tmp.root, ".pi", "agents");
			const nearProjectDir = join(tmp.root, "repo", ".pi", "agents");
			const cwd = join(tmp.root, "repo", "nested", "work");
			mkdirSync(cwd, { recursive: true });

			writeAgent(
				globalDir,
				"helper.md",
				`---\nname: Global Helper\ndescription: global desc\ntools: read\n---\nGlobal prompt.`,
			);
			writeAgent(
				farProjectDir,
				"far.md",
				`---\ndescription: far desc\n---\nFar prompt.`,
			);
			writeAgent(
				nearProjectDir,
				"helper.md",
				`---\nname: Display Only\ndisplay_name: Project Helper\ndescription: project desc\ntools: bash\n---\nProject prompt.`,
			);

			const registry = await loadAgentTypes({
				cwd,
				globalAgentsDir: globalDir,
			});
			const helper = resolveAgentType(registry, "HELPER");
			assert.equal(helper.status, "found");
			assert.equal(helper.agent.type, "helper");
			assert.equal(helper.agent.name, "Display Only");
			assert.equal(helper.agent.displayName, "Project Helper");
			assert.equal(helper.agent.description, "project desc");
			assert.equal(helper.agent.prompt, "Project prompt.");
			assert.deepEqual(helper.agent.tools, {
				kind: "allow",
				selectors: [{ kind: "builtin", name: "bash" }],
			});
			assert.equal(resolveAgentType(registry, "far").status, "unknown");
		} finally {
			tmp.cleanup();
		}
	});

	it("uses PI_CODING_AGENT_DIR/agents for global agents when no global dir is injected", async () => {
		const { loadAgentTypes, resolveAgentType } = await registryModule();
		const tmp = makeTempProject();
		const previous = process.env.PI_CODING_AGENT_DIR;
		try {
			process.env.PI_CODING_AGENT_DIR = join(tmp.root, "pi-agent-dir");
			writeAgent(
				join(process.env.PI_CODING_AGENT_DIR, "agents"),
				"global-only.md",
				`---\ndescription: env global\n---\nEnv prompt.`,
			);

			const registry = await loadAgentTypes({ cwd: tmp.root });
			const resolved = resolveAgentType(registry, "GLOBAL-ONLY");
			assert.equal(resolved.status, "found");
			assert.equal(resolved.agent.prompt, "Env prompt.");
		} finally {
			if (previous === undefined) {
				delete process.env.PI_CODING_AGENT_DIR;
			} else {
				process.env.PI_CODING_AGENT_DIR = previous;
			}
			tmp.cleanup();
		}
	});

	it("keeps same-directory case-fold duplicates deterministic with warnings", async () => {
		const { loadAgentTypes, resolveAgentType } = await registryModule();
		const tmp = makeTempProject();
		try {
			const projectDir = join(tmp.root, "agents");
			writeAgent(
				projectDir,
				"Alpha.md",
				`---\ndescription: first\n---\nFirst prompt.`,
			);
			writeAgent(
				projectDir,
				"alpha.md",
				`---\ndescription: second\n---\nSecond prompt.`,
			);

			const registry = await loadAgentTypes({
				cwd: tmp.root,
				globalAgentsDir: join(tmp.root, "missing"),
				projectAgentsDir: projectDir,
			});
			const resolved = resolveAgentType(registry, "alpha");
			assert.equal(resolved.status, "found");
			assert.equal(resolved.agent.prompt, "First prompt.");
			assert.ok(codes(registry).includes("duplicate-agent-type"));
		} finally {
			tmp.cleanup();
		}
	});

	it("lets disabled higher-precedence custom agents mask lower definitions", async () => {
		const { loadAgentTypes, resolveAgentType } = await registryModule();
		const tmp = makeTempProject();
		try {
			const globalDir = join(tmp.root, "global");
			const projectDir = join(tmp.root, "project");
			writeAgent(
				globalDir,
				"worker.md",
				`---\ndescription: enabled lower\n---\nEnabled prompt.`,
			);
			writeAgent(
				projectDir,
				"worker.md",
				`---\ndescription: disabled higher\nenabled: false\n---\nDisabled prompt.`,
			);

			const registry = await loadAgentTypes({
				cwd: tmp.root,
				globalAgentsDir: globalDir,
				projectAgentsDir: projectDir,
			});
			assert.deepEqual(resolveAgentType(registry, "worker"), {
				status: "disabled",
				name: "worker",
			});
		} finally {
			tmp.cleanup();
		}
	});
});

describe("custom agent frontmatter normalization", () => {
	it("normalizes list fields, tool selectors, execution shape, model, and thinking", async () => {
		const { loadAgentTypes, resolveAgentType } = await registryModule();
		const tmp = makeTempProject();
		try {
			const projectDir = join(tmp.root, "agents");
			writeAgent(
				projectDir,
				"reviewer.md",
				`---\nname: Review Display\ndescription: Review code\ntools:\n  - read\n  - bash\n  - ext:review/check\n  - ext:lint\n  - read\n  - 42\nextensions: ui, status, ui\nskills:\n  - warden-start\n  - warden-close\n  - 13\ndisallowed_tools: edit, ext:danger/delete, edit\nmemory: project
isolation: parent-twin\nisolated: true\nmodel: claude-4\nthinking: high\nmax_turns: 3\nprompt_mode: append\ninherit_context: true\nrun_in_background: true\n---\nReview prompt.`,
			);

			const registry = await loadAgentTypes({
				cwd: tmp.root,
				globalAgentsDir: join(tmp.root, "missing"),
				projectAgentsDir: projectDir,
			});
			const resolved = resolveAgentType(registry, "reviewer");
			assert.equal(resolved.status, "found");
			assert.deepEqual(resolved.agent.tools, {
				kind: "allow",
				selectors: [
					{ kind: "builtin", name: "read" },
					{ kind: "builtin", name: "bash" },
					{ kind: "extension-tool", extension: "review", tool: "check" },
					{ kind: "extension", extension: "lint" },
				],
			});
			assert.deepEqual(resolved.agent.extensions, ["ui", "status"]);
			assert.deepEqual(resolved.agent.skills, ["warden-start", "warden-close"]);
			assert.deepEqual(resolved.agent.disallowedTools, [
				{ kind: "builtin", name: "edit" },
				{ kind: "extension-tool", extension: "danger", tool: "delete" },
			]);
			assert.equal(resolved.agent.memory, "project");
			assert.equal(resolved.agent.isolation, "parent-twin");
			assert.equal(resolved.agent.model, "claude-4");
			assert.equal(resolved.agent.thinking, "high");
			assert.equal(resolved.agent.maxTurns, 3);
			assert.equal(resolved.agent.promptMode, "append");
			assert.equal(resolved.agent.inheritContext, true);
			assert.equal(resolved.agent.runInBackground, true);
			assert.ok(codes(registry).includes("invalid-list-entry"));
			assert.ok(codes(registry).includes("isolation-overrides-isolated"));
		} finally {
			tmp.cleanup();
		}
	});

	it("warns without enabling memory for legacy boolean and invalid values", async () => {
		const { loadAgentTypes, resolveAgentType } = await registryModule();
		const tmp = makeTempProject();
		try {
			const projectDir = join(tmp.root, "agents");
			writeAgent(
				projectDir,
				"legacy.md",
				`---\ndescription: legacy memory\nmemory: true\n---\nLegacy prompt.`,
			);
			writeAgent(
				projectDir,
				"invalid.md",
				`---\ndescription: invalid memory\nmemory: shared\n---\nInvalid prompt.`,
			);

			const registry = await loadAgentTypes({
				cwd: tmp.root,
				globalAgentsDir: join(tmp.root, "missing"),
				projectAgentsDir: projectDir,
			});
			assert.equal(
				resolveAgentType(registry, "legacy").agent.memory,
				undefined,
			);
			assert.equal(
				resolveAgentType(registry, "invalid").agent.memory,
				undefined,
			);
			assert.ok(codes(registry).includes("legacy-memory-boolean"));
			assert.ok(codes(registry).includes("invalid-memory-scope"));
		} finally {
			tmp.cleanup();
		}
	});

	it("normalizes missing and special tool fields", async () => {
		const { loadAgentTypes, resolveAgentType } = await registryModule();
		const tmp = makeTempProject();
		try {
			const projectDir = join(tmp.root, "agents");
			writeAgent(
				projectDir,
				"default-tools.md",
				`---\ndescription: default tools\n---\nDefault tools prompt.`,
			);
			writeAgent(
				projectDir,
				"no-tools.md",
				`---\ndescription: no tools\ntools: none\n---\nNo tools prompt.`,
			);
			writeAgent(
				projectDir,
				"all-tools.md",
				`---\ndescription: all tools\ntools: all\n---\nAll tools prompt.`,
			);

			const registry = await loadAgentTypes({
				cwd: tmp.root,
				globalAgentsDir: join(tmp.root, "missing"),
				projectAgentsDir: projectDir,
			});
			assert.equal(
				resolveAgentType(registry, "default-tools").agent.tools.kind,
				"default",
			);
			assert.deepEqual(resolveAgentType(registry, "no-tools").agent.tools, {
				kind: "allow",
				selectors: [],
			});
			assert.deepEqual(resolveAgentType(registry, "all-tools").agent.tools, {
				kind: "all",
			});
		} finally {
			tmp.cleanup();
		}
	});

	it("keeps agents with invalid scalar fields using defaults plus warnings", async () => {
		const { loadAgentTypes, resolveAgentType } = await registryModule();
		const tmp = makeTempProject();
		try {
			const projectDir = join(tmp.root, "agents");
			writeAgent(
				projectDir,
				"loose.md",
				`---\ntools: unknown-tool\nmemory: sometimes\nenabled: yes\ninherit_context: yes\nrun_in_background: later\nisolated: yes\nmodel: ""\nthinking: huge\nmax_turns: 0\nprompt_mode: merge\nisolation: shared\n---\nLoose prompt.`,
			);

			const registry = await loadAgentTypes({
				cwd: tmp.root,
				globalAgentsDir: join(tmp.root, "missing"),
				projectAgentsDir: projectDir,
			});
			const resolved = resolveAgentType(registry, "loose");
			assert.equal(resolved.status, "found");
			assert.equal(resolved.agent.description, "");
			assert.equal(resolved.agent.memory, undefined);
			assert.equal(resolved.agent.enabled, true);
			assert.equal(resolved.agent.isolation, "standalone");
			assert.equal(resolved.agent.inheritContext, false);
			assert.equal(resolved.agent.promptMode, "replace");
			assert.equal(resolved.agent.runInBackground, false);
			assert.equal(resolved.agent.model, undefined);
			assert.equal(resolved.agent.thinking, undefined);
			assert.equal(resolved.agent.maxTurns, undefined);
			for (const code of [
				"missing-description",
				"unknown-tool-selector",
				"invalid-scalar",
			]) {
				assert.ok(codes(registry).includes(code), `expected ${code}`);
			}
		} finally {
			tmp.cleanup();
		}
	});

	it("skips unreadable, malformed, non-object-frontmatter, and empty-prompt files", async () => {
		const { loadAgentTypes, resolveAgentType } = await registryModule();
		const tmp = makeTempProject();
		try {
			const projectDir = join(tmp.root, "agents");
			writeAgent(
				projectDir,
				"malformed.md",
				`---\nname: [unterminated\n---\nPrompt.`,
			);
			writeAgent(projectDir, "array-shape.md", `---\n- nope\n---\nPrompt.`);
			writeAgent(projectDir, "empty.md", `---\ndescription: empty\n---\n   `);

			const registry = await loadAgentTypes({
				cwd: tmp.root,
				globalAgentsDir: join(tmp.root, "missing"),
				projectAgentsDir: projectDir,
			});
			assert.equal(resolveAgentType(registry, "malformed").status, "unknown");
			assert.equal(resolveAgentType(registry, "array-shape").status, "unknown");
			assert.equal(resolveAgentType(registry, "empty").status, "unknown");
			for (const code of ["invalid-frontmatter", "empty-prompt"]) {
				assert.ok(codes(registry).includes(code), `expected ${code}`);
			}
		} finally {
			tmp.cleanup();
		}
	});
});
