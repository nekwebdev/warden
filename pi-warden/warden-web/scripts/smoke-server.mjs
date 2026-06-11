import { spawn } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = await mkdtemp(path.join(tmpdir(), "warden-web-smoke-"));
const agentsRoot = path.join(root, "agents");
const readyFile = path.join(root, "ready.json");
const agentDir = path.join(agentsRoot, "smoke");
const piBin = path.join(agentDir, "npm", "node_modules", ".bin", "pi");
let child;
let stdout = "";
let stderr = "";

async function fail(message) {
  if (child && child.exitCode === null) child.kill("SIGTERM");
  await rm(root, { recursive: true, force: true });
  console.error(`${message}\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`);
  process.exit(1);
}

async function readReadyFile() {
  return JSON.parse(await readFile(readyFile, "utf8"));
}

async function waitForReady() {
  const deadline = Date.now() + 10_000;
  return new Promise((resolve) => {
    const poll = () => {
      if (child?.exitCode !== null) {
        void fail(`server exited before writing ready file: ${child?.exitCode}`);
        return;
      }

      void readReadyFile()
        .then((ready) => {
          resolve(ready);
          return undefined;
        })
        .catch(() => {
          if (Date.now() >= deadline) {
            void fail("timed out waiting for ready file");
            return undefined;
          }
          setTimeout(poll, 100);
          return undefined;
        });
    };
    poll();
  });
}

try {
  await mkdir(path.dirname(piBin), { recursive: true });
  await writeFile(piBin, "#!/usr/bin/env sh\nexit 0\n");
  await chmod(piBin, 0o755);
  await writeFile(path.join(agentDir, "settings.json"), JSON.stringify({ warden: { agent: { cwd: root } } }));

  child = spawn(process.execPath, ["dist/server/index.js", "--host", "127.0.0.1", "--port", "0"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      WARDEN_AGENTS: agentsRoot,
      WARDEN_WEB_READY_FILE: readyFile,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const ready = await waitForReady();
  if (!ready.url || ready.host !== "127.0.0.1" || !Number.isInteger(ready.port) || ready.pid !== child.pid) {
    await fail(`invalid ready file: ${JSON.stringify(ready)}`);
  }

  const healthResponse = await fetch(`${ready.url}/health`);
  if (healthResponse.status !== 200) await fail(`health status ${healthResponse.status}`);
  const health = await healthResponse.json();
  if (health.ok !== true || health.port !== ready.port) await fail(`invalid health: ${JSON.stringify(health)}`);

  const agentsResponse = await fetch(`${ready.url}/api/agents`);
  if (agentsResponse.status !== 200) await fail(`agents status ${agentsResponse.status}`);
  const agents = await agentsResponse.json();
  if (agents.agentsRoot !== agentsRoot || agents.agents?.[0]?.agentId !== "smoke") {
    await fail(`invalid agents: ${JSON.stringify(agents)}`);
  }

  child.kill("SIGTERM");
  await new Promise((resolve) => child.once("exit", resolve));
  await rm(root, { recursive: true, force: true });
} catch (error) {
  await fail(error instanceof Error ? (error.stack ?? error.message) : String(error));
}
