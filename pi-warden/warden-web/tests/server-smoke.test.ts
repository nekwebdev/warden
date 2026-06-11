import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import type { AgentsResponse, ErrorResponse, HealthResponse } from "../src/protocol.js";
import { startWardenWebServer } from "../src/server/index.js";

async function closeServer(server: { close: (callback: (error?: Error) => void) => void }): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

test("server answers health, agents, placeholder, and API 404", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "warden-web-server-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const agentDir = path.join(root, "ada");
  const piBin = path.join(agentDir, "npm", "node_modules", ".bin", "pi");
  await mkdir(path.dirname(piBin), { recursive: true });
  await writeFile(piBin, "#!/usr/bin/env sh\nexit 0\n");
  await chmod(piBin, 0o755);

  const started = await startWardenWebServer({ host: "127.0.0.1", port: 0 }, { env: { WARDEN_AGENTS: root } });
  t.after(() => closeServer(started.server));

  const healthResponse = await fetch(`${started.url}/health`);
  assert.equal(healthResponse.status, 200);
  const health = (await healthResponse.json()) as HealthResponse;
  assert.equal(health.ok, true);
  assert.equal(health.packageName, "@nekwebdev/warden-web");
  assert.equal(health.host, "127.0.0.1");
  assert.equal(health.port, started.port);

  const agentsResponse = await fetch(`${started.url}/api/agents`);
  assert.equal(agentsResponse.status, 200);
  const agents = (await agentsResponse.json()) as AgentsResponse;
  assert.equal(agents.agentsRoot, root);
  assert.equal(agents.agents[0]?.agentId, "ada");
  assert.equal(agents.agents[0]?.status, "ready");

  const placeholderResponse = await fetch(`${started.url}/`);
  assert.equal(placeholderResponse.status, 200);
  assert.match(await placeholderResponse.text(), /browser UI is not implemented/i);

  const missingResponse = await fetch(`${started.url}/api/missing`);
  assert.equal(missingResponse.status, 404);
  const missing = (await missingResponse.json()) as ErrorResponse;
  assert.equal(missing.ok, false);
  assert.equal(missing.error.code, "not-found");
});
