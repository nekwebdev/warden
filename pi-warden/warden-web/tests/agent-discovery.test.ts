import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { discoverAgents, resolveAgentsRoot } from "../src/server/agent-discovery.js";

async function makeTempRoot(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "warden-web-agents-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function makePiBin(agentDir: string): Promise<void> {
  const binDir = path.join(agentDir, "npm", "node_modules", ".bin");
  await mkdir(binDir, { recursive: true });
  const piBin = path.join(binDir, "pi");
  await writeFile(piBin, "#!/usr/bin/env sh\nexit 0\n");
  await chmod(piBin, 0o755);
}

test("resolveAgentsRoot honors WARDEN_AGENTS before XDG and HOME", () => {
  assert.equal(resolveAgentsRoot({ WARDEN_AGENTS: "/custom", XDG_CONFIG_HOME: "/xdg", HOME: "/home/test" }), "/custom");
  assert.equal(resolveAgentsRoot({ XDG_CONFIG_HOME: "/xdg", HOME: "/home/test" }), "/xdg/pi-agents");
  assert.equal(resolveAgentsRoot({ HOME: "/home/test" }), "/home/test/.config/pi-agents");
});

test("discoverAgents returns empty list for missing agent root", async (t) => {
  const root = path.join(await makeTempRoot(t), "missing");
  assert.deepEqual(await discoverAgents({ env: { WARDEN_AGENTS: root } }), { agentsRoot: root, agents: [] });
});

test("discoverAgents lists valid direct agents and configured cwd", async (t) => {
  const root = await makeTempRoot(t);
  const cwd = await makeTempRoot(t);
  const agentDir = path.join(root, "ada");
  await mkdir(agentDir);
  await makePiBin(agentDir);
  await writeFile(path.join(agentDir, "settings.json"), JSON.stringify({ warden: { agent: { cwd } }, keep: true }));
  await writeFile(path.join(root, "not-a-directory"), "ignore me");

  const result = await discoverAgents({ env: { WARDEN_AGENTS: root } });

  assert.equal(result.agentsRoot, root);
  assert.equal(result.agents.length, 1);
  assert.deepEqual(result.agents[0], {
    agentId: "ada",
    agentDir,
    settingsPath: path.join(agentDir, "settings.json"),
    piBin: path.join(agentDir, "npm", "node_modules", ".bin", "pi"),
    piLensDir: path.join(agentDir, "pi-lens"),
    contextModeDir: path.join(agentDir, "context-mode"),
    configuredCwd: cwd,
    status: "ready",
    diagnostics: [],
  });
});

test("discoverAgents reports broken agents without throwing", async (t) => {
  const root = await makeTempRoot(t);
  await mkdir(path.join(root, "broken-json"));
  await writeFile(path.join(root, "broken-json", "settings.json"), "{bad json");
  await mkdir(path.join(root, "missing-pi"));
  await writeFile(path.join(root, "missing-pi", "settings.json"), JSON.stringify({ warden: { agent: { cwd: 42 } } }));
  await symlink(path.join(root, "missing-pi"), path.join(root, "linked-agent"));

  const result = await discoverAgents({ env: { WARDEN_AGENTS: root } });

  assert.deepEqual(
    result.agents.map((agent) => [agent.agentId, agent.status]),
    [
      ["broken-json", "invalid-settings"],
      ["missing-pi", "missing-pi"],
    ],
  );
  assert.ok(result.agents[0]?.diagnostics.some((diagnostic) => diagnostic.code === "invalid-settings-json"));
  assert.ok(result.agents[1]?.diagnostics.some((diagnostic) => diagnostic.code === "missing-pi"));
  assert.ok(result.agents[1]?.diagnostics.some((diagnostic) => diagnostic.code === "invalid-configured-cwd"));
});
