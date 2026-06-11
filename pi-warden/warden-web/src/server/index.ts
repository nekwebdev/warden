#!/usr/bin/env node
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import type { AgentsResponse, ErrorResponse, HealthResponse, JsonValue } from "../protocol.js";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../protocol.js";
import { discoverAgents } from "./agent-discovery.js";
import { ConfigError, formatHelpText, parseServerConfig, type Env, type ServerConfig } from "./config.js";

export interface StartWardenWebServerOptions {
  host: string;
  port: number;
}

export interface StartWardenWebServerContext {
  env?: Env;
}

export interface StartedWardenWebServer {
  server: Server;
  url: string;
  host: string;
  port: number;
  startedAt: string;
}

interface ServerState {
  env: Env;
  host: string;
  port: number;
  startedAt: string;
}

export async function startWardenWebServer(
  options: StartWardenWebServerOptions,
  context: StartWardenWebServerContext = {},
): Promise<StartedWardenWebServer> {
  const state: ServerState = {
    env: context.env ?? process.env,
    host: options.host,
    port: options.port,
    startedAt: new Date().toISOString(),
  };
  const server = createServer((request, response) => {
    void handleRequest(request, response, state).catch((error: unknown) => {
      sendJson(response, 500, errorResponse("internal-error", error instanceof Error ? error.message : String(error)));
    });
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen(options.port, options.host, () => {
      server.off("error", onError);
      resolve();
    });
  });

  const address = server.address();
  if (typeof address !== "object" || address === null) throw new Error("server did not expose a TCP address");
  state.port = address.port;
  const url = `http://${formatHostForUrl(options.host)}:${address.port}`;

  await writeReadyFile(state.env.WARDEN_WEB_READY_FILE, {
    url,
    host: options.host,
    port: address.port,
    pid: process.pid,
  });

  return {
    server,
    url,
    host: options.host,
    port: address.port,
    startedAt: state.startedAt,
  };
}

export async function main(argv: readonly string[] = process.argv.slice(2), env: Env = process.env): Promise<number> {
  let config;
  try {
    config = parseServerConfig(argv, env);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`warden-web: ${error.message}`);
      return 2;
    }
    throw error;
  }

  if (config.help) {
    process.stdout.write(formatHelpText());
    return 0;
  }

  try {
    const started = await startWardenWebServer(toStartOptions(config), { env });
    console.log(`warden-web listening on ${started.url}`);
    bindShutdown(started.server);
    return 0;
  } catch (error) {
    console.error(`warden-web: failed to start server: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

async function handleRequest(request: IncomingMessage, response: ServerResponse, state: ServerState): Promise<void> {
  const requestUrl = new URL(request.url ?? "/", `http://${state.host}`);
  if (request.method === "GET" && requestUrl.pathname === "/health") {
    sendJson(response, 200, healthResponse(state));
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/agents") {
    const agents: AgentsResponse = await discoverAgents({ env: state.env });
    sendJson(response, 200, agents);
    return;
  }

  if (requestUrl.pathname.startsWith("/api/")) {
    sendJson(response, 404, errorResponse("not-found", `No API route for ${requestUrl.pathname}`));
    return;
  }

  response.writeHead(200, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end("Warden Web server is running. Browser UI is not implemented in this bootstrap slice.\n");
}

function healthResponse(state: ServerState): HealthResponse {
  return {
    ok: true,
    packageName: PACKAGE_NAME,
    version: PACKAGE_VERSION,
    host: state.host,
    port: state.port,
    startedAt: state.startedAt,
  };
}

function errorResponse(code: string, message: string, details?: JsonValue): ErrorResponse {
  const response: ErrorResponse = { ok: false, error: { code, message } };
  if (details !== undefined) response.error.details = details;
  return response;
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: JsonValue | HealthResponse | AgentsResponse | ErrorResponse,
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function toStartOptions(config: ServerConfig): StartWardenWebServerOptions {
  return { host: config.host, port: config.port };
}

function formatHostForUrl(host: string): string {
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}

async function writeReadyFile(readyFile: string | undefined, payload: JsonValue): Promise<void> {
  if (readyFile === undefined || readyFile.length === 0) return;
  await writeFile(readyFile, `${JSON.stringify(payload)}\n`);
}

function bindShutdown(server: Server): void {
  const closeAndExit = () => {
    server.close(() => process.exit(0));
  };
  process.once("SIGINT", closeAndExit);
  process.once("SIGTERM", closeAndExit);
}

function isDirectRun(importMetaUrl: string): boolean {
  const entry = process.argv[1];
  return entry !== undefined && importMetaUrl === pathToFileURL(entry).href;
}

if (isDirectRun(import.meta.url)) {
  void (async () => {
    const code = await main();
    if (code !== 0) process.exitCode = code;
  })();
}
