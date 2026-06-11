export const PROTOCOL_VERSION = 1 as const;
export const PACKAGE_NAME = "@nekwebdev/warden-web" as const;
export const PACKAGE_VERSION = "0.1.0" as const;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface HealthResponse {
  ok: true;
  packageName: typeof PACKAGE_NAME;
  version: typeof PACKAGE_VERSION;
  host: string;
  port: number;
  startedAt: string;
}

export const AGENT_STATUSES = ["ready", "missing-pi", "invalid-settings", "unreadable"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export interface AgentDiagnostic {
  code: string;
  message: string;
  path?: string;
  severity?: "info" | "warning" | "error";
}

export interface AgentSummary {
  agentId: string;
  agentDir: string;
  settingsPath: string;
  piBin: string;
  piLensDir: string;
  contextModeDir: string;
  configuredCwd?: string;
  status: AgentStatus;
  diagnostics: AgentDiagnostic[];
}

export interface AgentsResponse {
  agentsRoot: string;
  agents: AgentSummary[];
}

export interface ErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: JsonValue;
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isAgentStatus(value: unknown): value is AgentStatus {
  return typeof value === "string" && AGENT_STATUSES.includes(value as AgentStatus);
}

export function isErrorResponse(value: unknown): value is ErrorResponse {
  if (!isRecord(value) || value.ok !== false || !isRecord(value.error)) return false;
  return typeof value.error.code === "string" && typeof value.error.message === "string";
}
