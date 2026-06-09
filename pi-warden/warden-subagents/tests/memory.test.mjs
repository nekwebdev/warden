import assert from "node:assert/strict";
import {
	lstatSync,
	mkdirSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import {
	buildAgentMemoryPromptBlock,
	readMemoryIndex,
	resolveAgentMemoryDirectory,
} from "../index.ts";

function makeTempProject() {
	const root = resolve(
		tmpdir(),
		`warden-subagents-memory-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
	);
	mkdirSync(root, { recursive: true });
	return {
		root,
		cleanup() {
			rmSync(root, { recursive: true, force: true });
		},
	};
}

describe("agent memory helpers", () => {
	it("resolves project, local, and user memory directories exactly", () => {
		const tmp = makeTempProject();
		try {
			const projectRoot = join(tmp.root, "repo");
			const nested = join(projectRoot, "src", "work");
			const agentDir = join(tmp.root, "agent-dir");
			mkdirSync(join(projectRoot, ".pi", "agents"), { recursive: true });
			mkdirSync(nested, { recursive: true });

			assert.equal(
				resolveAgentMemoryDirectory({
					cwd: nested,
					agentDir,
					agentType: "auditor.v1",
					scope: "project",
				}).directory,
				join(projectRoot, ".pi", "agent-memory", "auditor.v1"),
			);
			assert.equal(
				resolveAgentMemoryDirectory({
					cwd: nested,
					agentDir,
					agentType: "auditor.v1",
					scope: "local",
				}).directory,
				join(projectRoot, ".pi", "agent-memory-local", "auditor.v1"),
			);
			assert.equal(
				resolveAgentMemoryDirectory({
					cwd: nested,
					agentDir,
					agentType: "auditor.v1",
					scope: "user",
				}).directory,
				join(agentDir, "agent-memory", "auditor.v1"),
			);
			assert.equal(
				resolveAgentMemoryDirectory({
					cwd: nested,
					agentDir,
					agentType: "auditor/v1",
					scope: "project",
				}).status,
				"disabled",
			);
		} finally {
			tmp.cleanup();
		}
	});

	it("falls back project root to invocation cwd when no .pi/agents ancestor exists", () => {
		const tmp = makeTempProject();
		try {
			const cwd = join(tmp.root, "loose", "cwd");
			mkdirSync(cwd, { recursive: true });
			const resolved = resolveAgentMemoryDirectory({
				cwd,
				agentDir: join(tmp.root, "agent-dir"),
				agentType: "auditor",
				scope: "project",
			});
			assert.equal(
				resolved.directory,
				join(cwd, ".pi", "agent-memory", "auditor"),
			);
		} finally {
			tmp.cleanup();
		}
	});

	it("reads MEMORY.md safely and truncates to 200 lines with visible warning", () => {
		const tmp = makeTempProject();
		try {
			const memoryDir = join(tmp.root, "memory");
			mkdirSync(memoryDir, { recursive: true });
			writeFileSync(
				join(memoryDir, "MEMORY.md"),
				Array.from({ length: 205 }, (_, index) => `line-${index + 1}`).join(
					"\n",
				),
			);

			const index = readMemoryIndex(memoryDir);
			assert.equal(index.status, "found");
			assert.match(index.content, /line-1/);
			assert.match(index.content, /line-200/);
			assert.doesNotMatch(index.content, /line-201/);
			assert.match(index.warning, /truncated to 200 lines/);
		} finally {
			tmp.cleanup();
		}
	});

	it("rejects symlinked memory indexes", () => {
		const tmp = makeTempProject();
		try {
			const memoryDir = join(tmp.root, "memory");
			mkdirSync(memoryDir, { recursive: true });
			writeFileSync(join(tmp.root, "outside.md"), "outside");
			symlinkSync(join(tmp.root, "outside.md"), join(memoryDir, "MEMORY.md"));

			const index = readMemoryIndex(memoryDir);
			assert.equal(index.status, "rejected");
			assert.match(index.warning, /symlink/);
			assert.equal(
				lstatSync(join(memoryDir, "MEMORY.md")).isSymbolicLink(),
				true,
			);
		} finally {
			tmp.cleanup();
		}
	});

	it("builds read-write and read-only memory prompt blocks with exact directory path", () => {
		const block = buildAgentMemoryPromptBlock({
			directory: "/tmp/repo/.pi/agent-memory/auditor",
			access: "read-write",
			index: {
				status: "found",
				content: "# Notes\nRemember project convention.",
			},
		});
		assert.match(block, /^## Agent Memory/);
		assert.match(block, /\/tmp\/repo\/\.pi\/agent-memory\/auditor/);
		assert.match(block, /read and update memory/);
		assert.match(block, /# Notes/);

		const readOnly = buildAgentMemoryPromptBlock({
			directory: "/tmp/repo/.pi/agent-memory/auditor",
			access: "read-only",
			readToolAvailable: false,
			index: { status: "missing" },
		});
		assert.match(readOnly, /read-only/);
		assert.match(readOnly, /read tool is not available/);
	});
});
