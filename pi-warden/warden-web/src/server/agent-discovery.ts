import { constants } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import type { AgentDiagnostic, AgentStatus, AgentSummary, AgentsResponse } from "../protocol.js";
import { isRecord } from "../protocol.js";
import type { Env } from "./config.js";

interface DiscoverAgentsOptions {
  env?: Env;
  agentsRoot?: string;
}

interface SettingsReadResult {
  configuredCwd?: string;
  hasInvalidSettings: boolean;
  hasUnreadableSettings: boolean;
  diagnostics: AgentDiagnostic[];
}

export function resolveAgentsRoot(env: Env = process.env): string {
  if (env.WARDEN_AGENTS !== undefined) return env.WARDEN_AGENTS;
  if (env.XDG_CONFIG_HOME !== undefined && env.XDG_CONFIG_HOME.length > 0)
    return path.join(env.XDG_CONFIG_HOME, "pi-agents");
  return path.join(env.HOME ?? homedir(), ".config", "pi-agents");
}

export async function discoverAgents(options: DiscoverAgentsOptions = {}): Promise<AgentsResponse> {
  const env = options.env ?? process.env;
  const agentsRoot = options.agentsRoot ?? resolveAgentsRoot(env);
  const entries = await readAgentRootEntries(agentsRoot);
  const agents = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => discoverAgent(path.join(agentsRoot, entry.name), entry.name)),
  );

  agents.sort((left, right) => left.agentId.localeCompare(right.agentId));
  return { agentsRoot, agents };
}

async function readAgentRootEntries(agentsRoot: string) {
  try {
    return await readdir(agentsRoot, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function discoverAgent(agentDir: string, agentId: string): Promise<AgentSummary> {
  const settingsPath = path.join(agentDir, "settings.json");
  const piBin = path.join(agentDir, "npm", "node_modules", ".bin", "pi");
  const piLensDir = path.join(agentDir, "pi-lens");
  const contextModeDir = path.join(agentDir, "context-mode");
  const settings = await readSettings(settingsPath);
  const missingPi = !(await isExecutable(piBin));
  const diagnostics = [...settings.diagnostics];

  if (missingPi) {
    diagnostics.push({
      code: "missing-pi",
      message: "Pi executable missing or not executable",
      path: piBin,
      severity: "error",
    });
  }

  const status = chooseStatus(settings, missingPi);
  const summary: AgentSummary = {
    agentId,
    agentDir,
    settingsPath,
    piBin,
    piLensDir,
    contextModeDir,
    status,
    diagnostics,
  };
  if (settings.configuredCwd !== undefined) summary.configuredCwd = settings.configuredCwd;
  return summary;
}

function chooseStatus(settings: SettingsReadResult, missingPi: boolean): AgentStatus {
  if (settings.hasUnreadableSettings) return "unreadable";
  if (settings.hasInvalidSettings) return "invalid-settings";
  if (missingPi) return "missing-pi";
  if (settings.diagnostics.some((diagnostic) => diagnostic.code === "invalid-configured-cwd"))
    return "invalid-settings";
  return "ready";
}

async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function readSettings(settingsPath: string): Promise<SettingsReadResult> {
  const diagnostics: AgentDiagnostic[] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(await readFile(settingsPath, "utf8"));
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return { hasInvalidSettings: false, hasUnreadableSettings: false, diagnostics };
    }
    if (error instanceof SyntaxError) {
      diagnostics.push({
        code: "invalid-settings-json",
        message: "settings.json contains invalid JSON",
        path: settingsPath,
        severity: "error",
      });
      return { hasInvalidSettings: true, hasUnreadableSettings: false, diagnostics };
    }
    diagnostics.push({
      code: "unreadable-settings",
      message: "settings.json could not be read",
      path: settingsPath,
      severity: "error",
    });
    return { hasInvalidSettings: false, hasUnreadableSettings: true, diagnostics };
  }

  if (!isRecord(parsed)) {
    diagnostics.push({
      code: "invalid-settings-root",
      message: "settings.json must contain a JSON object",
      path: settingsPath,
      severity: "error",
    });
    return { hasInvalidSettings: true, hasUnreadableSettings: false, diagnostics };
  }

  const configuredCwd = getConfiguredCwd(parsed);
  if (configuredCwd === undefined) return { hasInvalidSettings: false, hasUnreadableSettings: false, diagnostics };
  if (typeof configuredCwd === "string") {
    return { configuredCwd, hasInvalidSettings: false, hasUnreadableSettings: false, diagnostics };
  }

  diagnostics.push({
    code: "invalid-configured-cwd",
    message: "settings.warden.agent.cwd must be a string when present",
    path: settingsPath,
    severity: "warning",
  });
  return { hasInvalidSettings: false, hasUnreadableSettings: false, diagnostics };
}

function getConfiguredCwd(settings: Record<string, unknown>): unknown {
  const warden = settings.warden;
  if (!isRecord(warden)) return undefined;
  const agent = warden.agent;
  if (!isRecord(agent) || !("cwd" in agent)) return undefined;
  return agent.cwd;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
