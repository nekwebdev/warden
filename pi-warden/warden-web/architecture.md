# Warden Web Architecture

Status: validated planning baseline for first bootstrap slice; product architecture still WIP.

Date: 2026-06-11

## Purpose

`warden-web` is Warden's planned mobile-first local web UI for Warden-managed Pi agents.

The long-term package should provide a local browser UI and server for:

- browsing configured Warden-managed Pi agents;
- viewing Pi session history grouped by agent and cwd;
- starting or attaching to headless Pi sessions;
- streaming normalized Pi SDK events into chat windows;
- supervising one or more active chat windows from mobile, tablet, or desktop browsers.

This document records validated architecture decisions, reference-repo findings, bootstrap scope, and later-phase notes. It is not final user documentation.

## Current validated direction

The immediate implementation target is **not** the full product. The first implementation slice should bootstrap:

- package skeleton under `pi-warden/warden-web/`;
- package-local dev tooling;
- package-local tests, build, dry pack, and smoke test;
- a minimal local HTTP server;
- Warden agent discovery read model;
- package bins for direct server start;
- runner-owned `warden web` command that starts the server.

The first slice should **not** bootstrap the browser client, assistant-ui, Playwright, Storybook, Vite, WebSocket chat protocol, Pi session workers, prompt streaming, session-history indexing, or remote control plane.

Validated now:

- `warden-web` tooling acts isolated like its own repo, with package-local dependencies and configs.
- `oxlint` and `oxfmt` are locked for `warden-web` package-local lint/format.
- Package metadata, bin entries, peer dependency discipline, split scripts, `verify`, `prepublishOnly`, and `pack:dry` are part of the first slice.
- A package smoke test is part of the first slice, adapted to `warden-web-server` rather than a Pi `/web` extension.
- Playwright/e2e belongs to the first UI slice, not package/server bootstrap.
- Restartable supervisor belongs after UI + reconnect behavior exist.
- Frontend/backend CI split, performance budgets, Storybook, and release artifact matrices are later discipline items, not first slice.

## Product goal

A user starts a web UI server through a Warden command, opens a browser, selects a Pi agent, selects or creates a session, and talks to that agent through a mobile-friendly chat interface.

Expected mature user flow:

1. User runs `warden web` or equivalent Warden command.
2. Server binds locally and prints the actual URL.
3. Server discovers Warden-managed Pi agents from `$WARDEN_AGENTS` or the default agent root.
4. Browser UI opens and shows agents in a left panel/drawer.
5. User selects an agent.
6. Agent pane shows session history for that agent, grouped by cwd.
7. Configured cwd from `settings.json` key `warden.agent.cwd` appears first when present.
8. User selects an existing session or creates a new chat window.
9. Server starts a headless Pi session for that chat window using the same per-agent environment shape as `warden pi <agent>`.
10. Server streams safe-serialized Pi SDK events to browser clients.
11. User sends prompts, aborts runs, switches model/thinking settings, or creates sessions through typed protocol messages.
12. Multiple browser clients can observe a chat window; one client at a time controls mutating actions.

## Repository and package boundaries

`warden-web` owns:

- browser UI code when introduced;
- local web server implementation;
- package-local CLI/bin entrypoints;
- typed client/server/worker protocol;
- Warden agent discovery read model;
- session history read model;
- chat-window registry and worker bridge;
- Pi SDK event normalization for web clients;
- package-local tests, smoke checks, package docs, and package tooling.

`warden-web` does **not** own:

- root `./warden` bootstrap;
- root repo normalization or first-run movement;
- shell integration;
- `warden agents ...` lifecycle behavior;
- `warden pi <agent>` TUI launch behavior;
- Warden-managed Pi agent install/update lifecycle;
- `run-warden/` command dispatch internals except a narrow `warden web` shim;
- Nix/system configuration;
- dev-warden product work.

Runner-owned work for first slice:

- `run-warden/bin/warden` can expose `web [ARGS...]`;
- `run-warden/lib/web.sh` can dispatch to the package server;
- runner must not install dependencies or implement package logic.

Package-area hygiene when `package.json` is added:

- add `warden-web` to `pi-warden/README.md`;
- add `warden-web` to `pi-warden/AGENTS.md` package inventory;
- update `pi-warden/tests/smoke.bats`;
- update GitHub package/area surfaces with `pkg:warden-web`:
  - `.github/workflows/label-issues.yml`;
  - `.github/ISSUE_TEMPLATE/bug_report.yml`;
  - `.github/ISSUE_TEMPLATE/feature_request.yml`;
  - `.github/pull_request_template.md`.

## First bootstrap slice: locked implementation scope

Detailed implementation prompt: `pi-warden/warden-web/bootstrap.md`.

### First-slice objective

Create a solid package/server foundation for later vertical slices.

The slice should prove:

- package metadata is disciplined;
- package-local dev tooling works;
- package-local tests and smoke checks work;
- server starts locally without client assets;
- `/health` and `/api/agents` return stable JSON;
- `warden web` starts the package server through runner-owned command dispatch.

### First-slice package shape

Expected package root:

```text
pi-warden/warden-web/
├── AGENTS.md
├── LICENSE
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.build.json
├── .oxlintrc.json
├── .oxfmtrc.json
├── scripts/
│   ├── run-tests.mjs
│   └── smoke-server.mjs
├── src/
│   ├── index.ts
│   ├── protocol.ts
│   ├── bin/
│   │   └── warden-web.ts
│   └── server/
│       ├── agent-discovery.ts
│       ├── config.ts
│       └── index.ts
└── tests/
    ├── agent-discovery.test.ts
    ├── config.test.ts
    ├── protocol.test.ts
    └── server-smoke.test.ts
```

### First-slice package metadata

Validated package metadata direction:

- package name: `@nekwebdev/warden-web`;
- version: `0.1.0`;
- type: `module`;
- license: MIT;
- author: `nekwebdev`;
- publish config: public;
- repository directory: `pi-warden/warden-web`;
- keywords include `pi-package`, `pi`, `pi-agent`, `warden`, `warden-web`, `web`, `server`;
- package bins:
  - `warden-web` for package CLI;
  - `warden-web-server` for direct server entrypoint;
- `peerDependencies` include `@earendil-works/pi-coding-agent: "*"` once Pi package/SDK imports are present or imminent;
- package-local `devDependencies` include `@earendil-works/pi-coding-agent`, `@types/node`, `tsx`, `typescript`, `oxlint`, and `oxfmt`;
- do not add empty `pi` resources or empty extension folders just for ceremony.

Validated script discipline:

```json
{
  "build": "tsc -p tsconfig.build.json",
  "dev": "tsx src/server/index.ts",
  "format": "oxfmt --check",
  "format:fix": "oxfmt",
  "lint": "oxlint && oxfmt --check",
  "lint:fix": "oxlint --fix && oxfmt",
  "pack:dry": "npm pack --dry-run",
  "prepack": "npm run build",
  "prepublishOnly": "npm run verify",
  "smoke:server": "node scripts/smoke-server.mjs",
  "start": "tsx src/server/index.ts",
  "test": "node scripts/run-tests.mjs",
  "typecheck": "tsc --noEmit",
  "verify": "npm run format && npm run lint && npm run typecheck && npm test && npm run build && npm run smoke:server && npm run pack:dry"
}
```

### First-slice server API

Initial server should use Node's built-in HTTP server unless a real need for Fastify or another dependency appears.

Required config behavior:

- default host: `127.0.0.1`;
- default port: `48737`;
- allow port `0` for tests/smoke;
- support `--host`, `--host=<host>`, `--port`, `--port=<port>`, and `--help`;
- support `WARDEN_WEB_HOST` and `WARDEN_WEB_PORT` env fallbacks;
- write ready JSON to `WARDEN_WEB_READY_FILE` when set;
- print actual URL after listen.

Initial routes:

- `GET /health` returns `{ ok: true, packageName, version, host, port, startedAt }`;
- `GET /api/agents` returns `{ agentsRoot, agents }`;
- unknown `/api/*` returns stable JSON 404;
- non-API routes can return a deterministic placeholder until browser UI exists.

### First-slice acceptance checks

Implementation should run and report:

```sh
npm install --prefix pi-warden/warden-web
npm run verify --prefix pi-warden/warden-web
npm test --prefix pi-warden/warden-web
mise run test:run-warden
mise run test:pi-warden
```

Do not claim verification unless the command actually ran.

## Package-local tooling decision

`warden-web` should isolate tooling as if it were its own repo.

Validated now:

- add `oxlint` and `oxfmt` only to `pi-warden/warden-web/package.json`;
- add `.oxlintrc.json` and `.oxfmtrc.json` under `pi-warden/warden-web/`;
- do not add root-level lint/format dependencies;
- do not reformat existing Warden packages;
- do not add repo-wide pre-commit hooks.

Recommended `oxfmt` behavior:

- use `printWidth: 120` for Warden readability;
- ignore Markdown, YAML, TOML, lockfiles, `dist`, `coverage`, and `node_modules`;
- do not sort package JSON initially unless the package team decides this is worth the churn.

Recommended `oxlint` behavior:

- enable useful TypeScript/server checks;
- treat correctness as errors;
- avoid noisy style/pedantic rule sets during bootstrap;
- add React hook rules later only if/when a React client appears.

Rationale from references:

- `woxQAQ/pi-web` uses simple `fmt`, `fmt:check`, `lint`, and `lint:fix` scripts with package-local `oxlint`/`oxfmt`.
- `assistant-ui` uses the same core script shape and ignores generated/build/docs formats to prevent churn.
- For `warden-web`, assistant-ui's ignore discipline is a better fit than formatting prose or sorting all manifests.

## Package smoke-test decision

Validated now:

- include a package smoke test in the first slice;
- smoke the server package, not real Pi sessions;
- use temp directories and port `0`;
- use a ready file for deterministic startup;
- include stdout/stderr in failure output;
- terminate cleanly.

First smoke should verify:

1. server starts on `127.0.0.1:0`;
2. `WARDEN_WEB_READY_FILE` contains actual URL;
3. `GET /health` returns expected JSON;
4. `GET /api/agents` returns expected fake/temp agents;
5. process stops cleanly on signal.

Later smoke, when Pi-facing resources exist:

- install the package into a real Pi environment;
- invoke the Pi-facing command or extension headlessly;
- verify HTTP and WebSocket behavior;
- shut down through explicit test hooks.

## Network/security posture

Initial server binds to localhost only.

Validated posture:

- bind `127.0.0.1` by default;
- default high uncommon port: `48737`;
- allow `--host` and `--port` but avoid LAN exposure by default;
- print exact URL;
- do not auto-open browser in first slice;
- Tailscale remote access is outside the app at first;
- public internet exposure is a non-goal;
- token auth is deferred until LAN/Tailscale/direct bind becomes a product feature.

Later security work should add:

- WebSocket `Origin`/`Host` checks;
- optional token for non-localhost bind;
- explicit warning when binding outside loopback;
- strict route validation for session/shell APIs.

## Warden agent discovery model

Agent root resolution:

```ts
const agentsRoot =
  process.env.WARDEN_AGENTS
  ?? (process.env.XDG_CONFIG_HOME
    ? `${process.env.XDG_CONFIG_HOME}/pi-agents`
    : `${process.env.HOME}/.config/pi-agents`);
```

Each direct child directory is a candidate agent.

First-slice `AgentSummary` should include at least:

- `agentId`: directory name;
- `agentDir`: full path;
- `settingsPath`: `${agentDir}/settings.json`;
- `piBin`: `${agentDir}/npm/node_modules/.bin/pi`;
- `piLensDir`: `${agentDir}/pi-lens`;
- `contextModeDir`: `${agentDir}/context-mode`;
- `configuredCwd`: `settings.warden.agent.cwd` when present and valid;
- `status`: stable enum such as `ready`, `missing-pi`, `invalid-settings`, or `unreadable`;
- `diagnostics`: stable diagnostics for missing executable, invalid JSON, unreadable settings, invalid cwd, etc.

Discovery rules:

- ignore non-directories;
- be robust around unexpected directories;
- handle missing root as empty result;
- include broken agents with diagnostics rather than crashing whole endpoint;
- do not create, repair, install, or update agents;
- do not write `settings.json`;
- preserve unknown settings;
- do not assume web server's own `PI_CODING_AGENT_DIR` is the selected agent.

Existing runner behavior to mirror later:

```sh
PI_CODING_AGENT_DIR="$agent_dir"
PILENS_DATA_DIR="$agent_dir/pi-lens"
CONTEXT_MODE_DIR="$agent_dir/context-mode"
```

`warden pi <agent>` also resolves `settings.warden.agent.cwd` and `cd`s there before launching Pi when configured. `warden-web` workers must mirror this when workers are added.

## Session history model

This is not first-slice work, but remains part of the target architecture.

Pi sessions live under the selected agent's config directory:

```text
<agentDir>/sessions/<encoded-cwd>/*.jsonl
```

Prefer Pi `SessionManager` over custom JSONL parsing.

For all sessions of an agent:

```ts
const sessions = await SessionManager.listAll(path.join(agentDir, "sessions"));
```

For sessions under one cwd:

```ts
const sessions = await SessionManager.list(cwd, sessionDir);
```

`SessionInfo` includes:

- `path`
- `id`
- `cwd`
- `name`
- `parentSessionPath`
- `created`
- `modified`
- `messageCount`
- `firstMessage`
- `allMessagesText`

Grouping and sort behavior:

- group by `cwd`;
- configured cwd first when present;
- older sessions from other cwd groups remain discoverable;
- sort remaining groups by recent activity;
- sort sessions in each group by modified desc.

Session display title preference:

1. `name` if present;
2. first message preview;
3. session id/path fallback.

## Pi SDK research recap

Relevant package: `@earendil-works/pi-coding-agent`.

Docs/source inspected during planning:

- Pi docs: `docs/sdk.md`
- Pi docs: `docs/rpc.md`
- Pi docs: `docs/sessions.md`
- Pi docs: `docs/session-format.md`
- Type declarations: `dist/core/agent-session.d.ts`
- Type declarations: `dist/core/agent-session-runtime.d.ts`
- Type declarations: `dist/core/session-manager.d.ts`
- Type declarations: `dist/core/sdk.d.ts`
- Type declarations: `node_modules/@earendil-works/pi-agent-core/dist/types.d.ts`
- Type declarations: `node_modules/@earendil-works/pi-ai/dist/types.d.ts`

Primary future SDK import shape:

```ts
import {
  createAgentSession,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
```

`AgentSession` provides:

- `prompt(text, options?)`
- `steer(text, images?)`
- `followUp(text, images?)`
- `subscribe(listener)`
- `setModel(model)`
- `setThinkingLevel(level)`
- `cycleModel()`
- `cycleThinkingLevel()`
- `abort()`
- `compact()` / `abortCompaction()`
- `setSessionName(name)`
- `getSessionStats()`
- `messages`
- `state`
- `sessionFile`
- `sessionId`
- `sessionName`
- `isStreaming`

`AgentSessionRuntime` provides session replacement operations:

- `newSession()`
- `switchSession(sessionPath)`
- `fork(entryId)`
- `importFromJsonl(inputPath, cwdOverride?)`
- `dispose()`

Important runtime behavior:

- `runtime.session` changes after `newSession`, `switchSession`, `fork`, and import flows;
- subscriptions attach to a specific `AgentSession`;
- re-subscribe after every session replacement;
- if extensions are used, re-bind extensions after session replacement.

SDK vs RPC decision:

- Pi also has `pi --mode rpc`, a JSONL protocol over stdin/stdout;
- RPC mode is useful reference material and possible fallback;
- for Node/TypeScript server work, Pi docs recommend `AgentSession` directly;
- `warden-web` should use one worker process per chat window rather than one global SDK session in the web server.

Worker-per-chat rationale:

- Warden-managed agents have per-agent env, package installs, settings, auth, MCP, caches, pi-lens, and context-mode stores;
- worker process env isolates selected agent cleanly;
- main server avoids global `process.env` mutation;
- workers can be stopped independently.

## Proposed mature process architecture

```text
Browser UI(s)
  │
  │ WebSocket JSON protocol
  ▼
warden-web local server
  ├─ agent discovery
  ├─ session history index
  ├─ chat window registry
  ├─ writer/controller lock
  └─ worker bridge(s)
       │ IPC JSON protocol
       ▼
     chat-window worker process
       ├─ env: PI_CODING_AGENT_DIR=<agentDir>
       ├─ env: PILENS_DATA_DIR=<agentDir>/pi-lens
       ├─ env: CONTEXT_MODE_DIR=<agentDir>/context-mode
       ├─ cwd: agent configured cwd or server cwd fallback
       ├─ AgentSessionRuntime
       ├─ AgentSession.subscribe(...)
       └─ safeSerializeEvent(...)
```

First slice implements only:

```text
warden web
  │
  ▼
warden-web local server
  ├─ /health
  └─ /api/agents
```

### Main server responsibilities, mature target

- Start local HTTP/WebSocket server.
- Serve browser client bundle.
- Discover agents from `$WARDEN_AGENTS` or default agent root.
- Read agent metadata/settings safely.
- List sessions for selected agent.
- Group session history by cwd.
- Manage chat windows and attached browser clients.
- Enforce one writer/controller per chat window.
- Spawn/stop chat-window workers.
- Bridge client actions to workers.
- Broadcast worker events to attached clients.
- Send full `stateSync` snapshots on attach/reconnect/major transitions.

### Worker responsibilities, mature target

- Run under one selected agent env.
- Create or open one Pi session.
- Own one `AgentSessionRuntime`.
- Bind/re-bind session subscriptions after replacement.
- Execute prompt/abort/model/session actions.
- Normalize/safe-serialize Pi SDK events.
- Report state snapshots to main server.
- Exit cleanly when disposed.

### Client responsibilities, mature target

- Render mobile-first shell.
- Show agent list.
- Show selected agent session history grouped by cwd.
- Show one or more chat tabs/windows.
- Render live event stream and snapshots.
- Hold or request writer lock.
- Send user actions through typed protocol.
- Reconnect and request state sync after reload/network hiccup.

## UI/session model

Target model:

- one Pi session per chat window;
- UI may show multiple tabs/views per chat window;
- multiple browser UIs may be open at once;
- same chat window may have multiple attached viewers;
- same chat window should have one active writer/controller at a time;
- non-controller clients observe state and live events;
- writer lock can transfer later;
- initial multi-client implementation can use first-writer-wins or explicit acquire/release.

This does not affect first package/server bootstrap except protocol naming should not block this future.

## Protocol shape

Use shared protocol types as first-class package API between client, server, and worker.

First-slice `src/protocol.ts` should stay small:

- `JsonValue`
- `HealthResponse`
- `AgentStatus`
- `AgentDiagnostic`
- `AgentSummary`
- `AgentsResponse`
- `ErrorResponse`

Future WebSocket/client protocol should be versionable and runtime-validated at boundaries.

Potential mature client-to-server action shape:

```ts
type ClientAction =
  | { type: "listAgents"; requestId: string }
  | { type: "selectAgent"; requestId: string; agentId: string }
  | { type: "listSessions"; requestId: string; agentId: string }
  | { type: "openChat"; requestId: string; agentId: string; sessionPath?: string }
  | { type: "newChat"; requestId: string; agentId: string; cwd?: string; model?: ModelRef }
  | { type: "attachChat"; requestId: string; chatId: string }
  | { type: "detachChat"; requestId: string; chatId: string }
  | { type: "acquireWriter"; requestId: string; chatId: string }
  | { type: "releaseWriter"; requestId: string; chatId: string }
  | { type: "prompt"; requestId: string; chatId: string; text: string; streamingBehavior?: "steer" | "followUp" }
  | { type: "abort"; requestId: string; chatId: string }
  | { type: "setModel"; requestId: string; chatId: string; model: ModelRef }
  | { type: "setThinkingLevel"; requestId: string; chatId: string; level: ThinkingLevel }
  | { type: "renameSession"; requestId: string; chatId: string; name: string }
  | { type: "getState"; requestId: string; chatId?: string };
```

Potential mature server-to-client shape:

```ts
type ServerMessage =
  | { type: "response"; requestId: string; ok: true; data?: JsonValue }
  | { type: "response"; requestId: string; ok: false; code: string; message: string; details?: JsonValue }
  | { type: "agents"; agents: AgentSummary[] }
  | { type: "sessions"; agentId: string; groups: SessionGroup[] }
  | { type: "models"; chatId?: string; models: ModelSummary[] }
  | { type: "chatOpened"; chat: ChatSummary }
  | { type: "writerChanged"; chatId: string; writerClientId?: string }
  | { type: "stateSync"; chatId: string; state: ChatStateSnapshot }
  | { type: "sessionChanged"; chatId: string; agentId: string; sessionId: string; sessionFile?: string }
  | { type: "agentEvent"; chatId: string; seq: number; event: SerializedAgentEvent }
  | { type: "workerStatus"; chatId: string; status: "starting" | "ready" | "busy" | "idle" | "stopping" | "stopped" }
  | { type: "error"; requestId?: string; chatId?: string; code: string; message: string; details?: JsonValue };
```

Potential mature server-to-worker shape:

```ts
type WorkerCommand =
  | { type: "open"; agent: AgentLaunchInfo; sessionPath?: string; cwd?: string }
  | { type: "newSession"; cwd?: string; parentSession?: string }
  | { type: "prompt"; text: string; streamingBehavior?: "steer" | "followUp" }
  | { type: "abort" }
  | { type: "setModel"; model: ModelRef }
  | { type: "setThinkingLevel"; level: ThinkingLevel }
  | { type: "renameSession"; name: string }
  | { type: "getState" }
  | { type: "dispose" };
```

Potential mature worker-to-server shape:

```ts
type WorkerEvent =
  | { type: "ready"; state: ChatStateSnapshot }
  | { type: "stateSync"; state: ChatStateSnapshot }
  | { type: "sessionChanged"; sessionId: string; sessionFile?: string }
  | { type: "agentEvent"; seq: number; event: SerializedAgentEvent }
  | { type: "error"; code: string; message: string; details?: JsonValue }
  | { type: "disposed" };
```

## Event serialization

Pi SDK emits rich `AgentSessionEvent` objects. Some can contain circular refs or non-serializable data now or later.

Never make raw `AgentSessionEvent` the browser contract.

Use a `safeSerializeEvent` wrapper when event streaming is introduced:

1. Extract known fields into stable JSON-friendly shape.
2. Convert rich messages/tool args/results through JSON-safe normalization.
3. Try cycle-safe JSON serialization.
4. If serialization fails, send simplified fallback instead of dropping event.
5. Include enough metadata for debugging.

Suggested shape:

```ts
type SerializedAgentEvent = {
  kind: string;
  at: string;
  text?: string;
  role?: string;
  message?: SerializedAgentMessage;
  delta?: SerializedAssistantDelta;
  toolCall?: SerializedToolCall;
  toolResult?: SerializedToolResult;
  queue?: { steering: string[]; followUp: string[] };
  raw?: JsonValue;
  fallback?: {
    reason: string;
    constructorName?: string;
    keys?: string[];
    preview?: string;
  };
};
```

Important Pi event kinds:

- `agent_start`
- `agent_end`
- `turn_start`
- `turn_end`
- `message_start`
- `message_update`
- `message_end`
- `tool_execution_start`
- `tool_execution_update`
- `tool_execution_end`
- `queue_update`
- `session_info_changed`
- `thinking_level_changed`
- `compaction_start`
- `compaction_end`
- `auto_retry_start`
- `auto_retry_end`

Important assistant streaming delta kinds from Pi AI:

- `start`
- `text_start`
- `text_delta`
- `text_end`
- `thinking_start`
- `thinking_delta`
- `thinking_end`
- `toolcall_start`
- `toolcall_delta`
- `toolcall_end`
- `done`
- `error`

UI should depend on normalized fields such as `kind`, `message`, `delta`, `toolCall`, `toolResult`, and `queue`, not `raw`.

## Client state model, future

Recommended client state entities:

```ts
type WebUiState = {
  agents: AgentSummary[];
  selectedAgentId?: string;
  sessionGroupsByAgent: Record<string, SessionGroup[]>;
  chats: Record<string, ChatClientState>;
  activeChatId?: string;
};
```

```ts
type ChatClientState = {
  chatId: string;
  agentId: string;
  sessionId?: string;
  sessionFile?: string;
  sessionName?: string;
  cwd?: string;
  model?: ModelSummary;
  thinkingLevel?: ThinkingLevel;
  isStreaming: boolean;
  isCompacting: boolean;
  pendingMessageCount: number;
  writerClientId?: string;
  messages: ChatMessageView[];
  events: SerializedAgentEvent[];
  lastSeq: number;
};
```

For first UI slices, storing full event arrays in client state is acceptable. Later, derive compact message views and keep raw event history bounded.

## UI layout, future

Initial mobile-first layout:

- left/drawer panel: agent list and session groups;
- top bar: selected agent, session title, connection/writer status;
- tab strip: open chat windows;
- central chat panel: messages/tool cards/event stream;
- bottom composer: prompt input, send/steer/follow-up behavior, abort button;
- model/thinking controls reachable from top bar or drawer.

Desktop can show persistent left side panel. Mobile should use drawer/sheet navigation.

## Assistant UI decision

`assistant-ui` remains useful as frontend reference and possible accelerator, not core architecture.

Useful later:

- chat primitives;
- composer behavior;
- streaming message rendering;
- tool call UI patterns;
- retries/abort affordances;
- mobile chat layout ideas;
- accessibility and keyboard handling lessons;
- oxlint/oxfmt package-local tooling pattern.

Constraints:

- Warden server owns source of truth;
- Pi SDK and Warden chat-window workers own session lifecycle;
- avoid Assistant Cloud for Warden local-first session history;
- avoid default AI SDK runtime unless Warden intentionally matches that contract;
- if adopted, use assistant-ui as React render primitives with Warden-owned external store/runtime.

Recommended position:

- build first slices around Warden protocol + Pi SDK headless runner;
- add assistant-ui only after message/event shapes stabilize;
- prefer `ExternalStoreRuntime` or custom render integration if assistant-ui is used.

## Restartable dev supervisor, later

Validated later item from `ashwin-pc/pi-web`.

A supervisor is a stable parent process that:

- owns the public URL/port;
- starts a child app server on a private child port;
- proxies HTTP and WebSocket traffic to the child;
- exposes a restart endpoint such as `POST /api/restart`;
- kills/restarts the child when server code changes or crashes;
- keeps the public URL alive while the child restarts;
- allows the browser to reconnect instead of losing the whole app.

Why Warden probably wants this later:

- `warden-web` will be edited by agents from inside `warden-web`;
- server-side changes should not require manual terminal restarts;
- mobile browsers keep the same URL;
- WebSocket reconnect behavior is exercised constantly;
- active session/worker state can be kept outside the restartable child if needed.

Why not first slice:

- no UI yet to preserve;
- no WebSocket client yet;
- no reconnect path yet;
- no server hot-edit workflow yet;
- adds proxy/restart/auth/port complexity too early.

Future shape:

```text
supervisor public port 48737
  ├─ /api/restart
  ├─ /__supervisor/status
  └─ proxy HTTP/WS to child app server
        └─ restartable warden-web server
```

## Playwright/e2e, later

Validated later item from `ashwin-pc/pi-web`.

Add Playwright when a minimal browser shell exists, not before.

First e2e suite should use mock mode and avoid real Pi sessions:

- server starts in mock mode;
- page loads;
- agent list is visible;
- selecting an agent works;
- composer disabled/enabled states are sane;
- WebSocket connects and reconnects;
- abort/stop affordance is visible when streaming mock data.

Do not use Playwright for the package/server bootstrap slice. Server smoke test is enough for now.

## Frontend CI, performance budgets, Storybook, later

Validated later discipline from `Epsilondelta-ai/pi-web`.

Apply after frontend exists:

- separate frontend/backend CI if client dependencies make CI slow/noisy;
- frontend path filters for client-only checks;
- backend path filters for server-only checks;
- `build-storybook` once components exist;
- performance budgets after the first real UI bundle;
- mock API server for budget checks;
- Lighthouse/Puppeteer startup and user-flow budgets;
- visual/story fixtures for important UI states.

Do not add these in first slice.

Coverage seriousness:

- start with focused meaningful tests now;
- aim for high coverage on deterministic backend/protocol modules;
- do not add coverage theatre;
- consider hard thresholds once the module boundaries stabilize.

## Release artifact matrix, much later

Validated much-later item from `Epsilondelta-ai/pi-web`.

Release artifact matrices are useful if Warden ships standalone binaries/installers. For first `warden-web` npm package work:

- `pack:dry` is enough;
- CI package artifact upload can come later;
- OS/arch binary matrix is not needed until product distribution changes.

## Plugin system, later

Reference findings from `jmfederico/pi-web` and `Epsilondelta-ai/pi-web` show useful plugin patterns, but Warden should defer this.

Potential future plugin model:

- trusted local browser-side plugins;
- explicit `wardenWeb.plugins` metadata;
- stable contribution points after UI architecture settles;
- no plugin server hooks until API surface is stable;
- plugin code is trusted, not sandboxed.

Why defer:

- no stable Warden web UI extension points yet;
- protocol/message shape still needs to settle;
- plugin compatibility promise is costly;
- first product value is agent/session control, not arbitrary UI extension.

## Remote machine control plane, later

Reference findings from `jmfederico/pi-web` and `Epsilondelta-ai/pi-web` include remote/federated machine control planes.

Warden position:

- remote machine control is out of scope for bootstrap;
- Tailscale/Tailnet policy handles remote access outside the app initially;
- `warden-web` should bind localhost by default;
- do not add machine federation until local agent/session model works.

Potential much-later shape:

- trusted remote Warden web endpoint registry;
- server-to-server proxying;
- explicit token/header handling;
- health/runtime endpoint checks;
- machine-scoped plugins or capabilities.

## Reference research findings

### `jmfederico/pi-web`

Commit inspected: `577594a6220de51b04f3a0c83b69986a815385c6`.

Useful now:

- package metadata discipline;
- multiple bin entries (`pi-web`, `pi-web-server`, `pi-web-sessiond`);
- `verify`, `prepublishOnly`, `pack:dry`, `prepack`;
- split `build`, `typecheck`, `lint`, `test` scripts;
- peer dependency discipline for Pi runtime packages;
- small local state/config file pattern.

Defer:

- plugin system;
- remote machine control plane;
- long-lived session daemon/service installer;
- project/workspace model.

Important difference:

- `jmfederico/pi-web` model is Machine → Project → Workspace → Session;
- Warden model should be Agent → cwd group → Pi session/chat window.

Useful evidence:

- package bins/scripts/guards: `https://github.com/jmfederico/pi-web/blob/577594a6220de51b04f3a0c83b69986a815385c6/package.json#L8-L43`
- peer deps: `https://github.com/jmfederico/pi-web/blob/577594a6220de51b04f3a0c83b69986a815385c6/package.json#L102-L104`
- local config/data: `https://github.com/jmfederico/pi-web/blob/577594a6220de51b04f3a0c83b69986a815385c6/src/config.ts#L20-L32`
- plugin metadata parser: `https://github.com/jmfederico/pi-web/blob/577594a6220de51b04f3a0c83b69986a815385c6/src/server/piWebPluginService.ts#L254-L266`
- remote proxy: `https://github.com/jmfederico/pi-web/blob/577594a6220de51b04f3a0c83b69986a815385c6/src/server/machines/machineProxyRoutes.ts#L21-L75`

### `ashwin-pc/pi-web`

Commit inspected: `57f93b16fabfe294339ee9be30b62db2036ade7f`.

Useful later:

- restartable local supervisor;
- public port + child app port;
- restart/status endpoints;
- WebSocket proxy through supervisor;
- Playwright smoke/e2e with mock server;
- mock API mode for deterministic e2e.

Validated decision:

- supervisor later, not bootstrap;
- Playwright/e2e at UI phase;
- mock mode is important when e2e arrives.

Useful evidence:

- supervisor env/ports: `https://github.com/ashwin-pc/pi-web/blob/57f93b16fabfe294339ee9be30b62db2036ade7f/supervisor.ts#L5-L10`
- child spawn/restart loop: `https://github.com/ashwin-pc/pi-web/blob/57f93b16fabfe294339ee9be30b62db2036ade7f/supervisor.ts#L36-L72`
- restart/status endpoints: `https://github.com/ashwin-pc/pi-web/blob/57f93b16fabfe294339ee9be30b62db2036ade7f/supervisor.ts#L135-L150`
- Playwright mock servers: `https://github.com/ashwin-pc/pi-web/blob/57f93b16fabfe294339ee9be30b62db2036ade7f/playwright.config.ts#L21-L38`
- API test spawn/wait: `https://github.com/ashwin-pc/pi-web/blob/57f93b16fabfe294339ee9be30b62db2036ade7f/tests/api.test.ts#L63-L72`
- server WS replay/hello + Vite HMR: `https://github.com/ashwin-pc/pi-web/blob/57f93b16fabfe294339ee9be30b62db2036ade7f/server.ts#L2114-L2164`

### `Epsilondelta-ai/pi-web`

Commit inspected: `53e9461c1ab10f11265ec970bc4d05dcc9fb7af3`.

Useful later:

- split frontend/backend CI;
- frontend path filters;
- backend path filters;
- performance budget checks;
- Storybook and `build-storybook` discipline;
- release artifact matrix;
- strict coverage culture.

Validated decision:

- serious tests start now;
- frontend/backend CI split later;
- perf budgets later;
- Storybook later;
- release matrix much later;
- avoid hard coverage theatre before boundaries stabilize.

Useful evidence:

- frontend CI: `https://github.com/Epsilondelta-ai/pi-web/blob/53e9461c1ab10f11265ec970bc4d05dcc9fb7af3/.github/workflows/frontend.yml#L1-L76`
- backend CI: `https://github.com/Epsilondelta-ai/pi-web/blob/53e9461c1ab10f11265ec970bc4d05dcc9fb7af3/.github/workflows/backend.yml#L1-L39`
- release matrix: `https://github.com/Epsilondelta-ai/pi-web/blob/53e9461c1ab10f11265ec970bc4d05dcc9fb7af3/.github/workflows/release.yml#L13-L58`
- package scripts: `https://github.com/Epsilondelta-ai/pi-web/blob/53e9461c1ab10f11265ec970bc4d05dcc9fb7af3/package.json#L24-L37`
- Vitest coverage thresholds: `https://github.com/Epsilondelta-ai/pi-web/blob/53e9461c1ab10f11265ec970bc4d05dcc9fb7af3/vitest.config.ts#L17-L34`
- startup budget script: `https://github.com/Epsilondelta-ai/pi-web/blob/53e9461c1ab10f11265ec970bc4d05dcc9fb7af3/scripts/measure-startup.mjs#L15-L23`
- Storybook config: `https://github.com/Epsilondelta-ai/pi-web/blob/53e9461c1ab10f11265ec970bc4d05dcc9fb7af3/.storybook/main.ts#L1-L18`

### `woxQAQ/pi-web`

Commit inspected: `e6d4e04e1e21645a6eb48cb8edfdc832ac24fa15`.

Useful now:

- package-local `oxlint` + `oxfmt`;
- simple lint/format scripts;
- package smoke test pattern;
- ready-file based startup check;
- clean failure output with stdout/stderr;
- CI pack step.

Useful later:

- real Pi install smoke across OSes;
- headless Pi extension command smoke;
- WebSocket smoke once Warden has WS route.

Validated decision:

- lock `oxlint` + `oxfmt` now for `warden-web` only;
- add package smoke test now;
- defer real Pi install smoke until Pi-facing package resources exist.

Useful evidence:

- ox scripts: `https://github.com/woxQAQ/pi-web/blob/e6d4e04e1e21645a6eb48cb8edfdc832ac24fa15/package.json#L46-L52`
- ox deps: `https://github.com/woxQAQ/pi-web/blob/e6d4e04e1e21645a6eb48cb8edfdc832ac24fa15/package.json#L66-L67`
- oxlint config: `https://github.com/woxQAQ/pi-web/blob/e6d4e04e1e21645a6eb48cb8edfdc832ac24fa15/oslint.config.ts#L1-L10`
- oxfmt config: `https://github.com/woxQAQ/pi-web/blob/e6d4e04e1e21645a6eb48cb8edfdc832ac24fa15/oxfmt.config.ts#L1-L14`
- smoke startup and ready-file flow: `https://github.com/woxQAQ/pi-web/blob/e6d4e04e1e21645a6eb48cb8edfdc832ac24fa15/scripts/smoke-pi-web.mjs#L106-L173`
- CI pack artifact: `https://github.com/woxQAQ/pi-web/blob/e6d4e04e1e21645a6eb48cb8edfdc832ac24fa15/.github/workflows/ci.yml#L31-L47`
- Pi install smoke: `https://github.com/woxQAQ/pi-web/blob/e6d4e04e1e21645a6eb48cb8edfdc832ac24fa15/.github/workflows/pi-install.yml#L33-L44`

Note: the repo path is `oslint.config.ts`, but the tool is `oxlint`.

### `assistant-ui/assistant-ui`

Commit inspected: `59d252fa09c1511acd7e31c9d8178514c5a5cb77`.

Useful now:

- package-local `oxlint` + `oxfmt` scripts;
- `lint`, `lint:fix`, `format`, `format:fix` shape;
- `oxfmt` ignore discipline for build output, docs, yaml, lockfiles;
- do not let format tools churn docs/prose;
- assistant-ui remains reference only for UI primitives later.

Useful later:

- React hook lint rules if React client is added;
- assistant-ui render primitives after Warden protocol stabilizes.

Validated decision:

- use `oxlint` + `oxfmt` inside `warden-web` only;
- prefer assistant-ui ignore discipline over wox's prose wrapping;
- no assistant-ui runtime dependency in first slice.

Useful evidence:

- scripts: `https://github.com/assistant-ui/assistant-ui/blob/59d252fa09c1511acd7e31c9d8178514c5a5cb77/package.json#L13-L16`
- deps/lint-staged: `https://github.com/assistant-ui/assistant-ui/blob/59d252fa09c1511acd7e31c9d8178514c5a5cb77/package.json#L27-L39`
- oxlint config: `https://github.com/assistant-ui/assistant-ui/blob/59d252fa09c1511acd7e31c9d8178514c5a5cb77/.oxlintrc.json#L1-L44`
- oxfmt ignores: `https://github.com/assistant-ui/assistant-ui/blob/59d252fa09c1511acd7e31c9d8178514c5a5cb77/.oxfmtrc.json#L19-L43`
- CI step: `https://github.com/assistant-ui/assistant-ui/blob/59d252fa09c1511acd7e31c9d8178514c5a5cb77/.github/workflows/code-quality.yaml#L56-L60`
- starter template scripts: `https://github.com/assistant-ui/assistant-ui/blob/59d252fa09c1511acd7e31c9d8178514c5a5cb77/templates/default/package.json#L9-L12`
- starter template deps: `https://github.com/assistant-ui/assistant-ui/blob/59d252fa09c1511acd7e31c9d8178514c5a5cb77/templates/default/package.json#L45-L46`

## Suggested vertical slices after bootstrap

These are planning slices, not active tasks.

### Slice 1: package/server bootstrap

Status: current locked first implementation target.

Outputs:

- package skeleton;
- package-local `oxlint`/`oxfmt`;
- package-local tests/build/smoke/pack;
- `warden-web` and `warden-web-server` bins;
- `GET /health`;
- `GET /api/agents`;
- `warden web` runner shim;
- package inventory/GitHub hygiene updates.

### Slice 2: session history index

Goal: server lists sessions for one selected agent grouped by cwd.

Outputs:

- `src/server/session-index.ts`;
- `SessionManager.listAll(<agentDir>/sessions)`;
- configured cwd group first;
- tests with temp sessions or mocked SessionManager;
- `GET /api/agents/:agentId/sessions` or equivalent.

### Slice 3: worker proof

Goal: spawn one worker for one agent and produce a state snapshot without browser UI.

Outputs:

- worker process entrypoint;
- per-agent env injection;
- minimal `AgentSessionRuntime` open/new flow;
- IPC ready/state messages;
- mocked worker tests.

### Slice 4: prompt streaming vertical

Goal: prompt reaches worker Pi session and event stream returns to server.

Outputs:

- prompt command path;
- `safeSerializeEvent`;
- ordered `agentEvent` sequence numbers;
- abort path;
- serializer tests and mocked worker tests.

### Slice 5: minimal browser shell

Goal: UI lists agents, lists sessions, opens a chat, and can send prompt through mocked server/worker.

Outputs:

- React/Vite or chosen client stack;
- WebSocket client;
- drawer/list layout;
- central event panel;
- composer;
- package-local Playwright smoke/e2e with mock mode.

### Slice 6: reconnect and writer lock

Goal: multi-client semantics work.

Outputs:

- client id assignment;
- acquire/release writer;
- one-writer enforcement;
- `stateSync` on attach/reconnect;
- viewer-only UI state.

### Slice 7: dev supervisor

Goal: server-side code can restart without losing public URL.

Outputs:

- stable supervisor;
- child server process;
- restart/status endpoints;
- HTTP/WS proxy;
- reconnect tests.

### Slice 8: frontend quality gates

Goal: UI discipline after UI exists.

Outputs:

- Playwright e2e suite;
- Storybook;
- `build-storybook` check;
- frontend path-filtered CI if useful;
- performance budget checks.

## Open design questions for later

These do not block first bootstrap:

- Should `warden web` auto-open a browser?
- Should `warden web` support `--open` later?
- Should the mature server support direct Tailnet bind, Tailscale Serve instructions only, or both?
- Should chat windows persist independently from Pi session files?
- What idle timeout should worker processes use?
- Should chat windows be shareable by URL path?
- Should assistant-ui be used as render primitives after protocol stabilizes?
- Should UI show full Pi event log, simplified chat transcript, or both?
- How much session tree navigation (`/tree`, fork, clone) belongs in first UI?
- How should extension UI prompts/dialogs appear in browser?
- Should local plugins exist, and what stable extension points would they use?

## Non-goals for first bootstrap

- Browser client.
- React/Vite setup.
- Assistant-ui integration.
- Playwright.
- Storybook.
- Performance budgets.
- Dev supervisor.
- WebSocket chat protocol.
- Chat-window workers.
- Pi SDK `AgentSessionRuntime` execution.
- Prompt streaming.
- Session history indexing.
- Model/thinking controls.
- Writer locks.
- Remote machine control plane.
- Plugin system.
- Service installer/daemon.
- Public internet exposure.
- Tailscale bind flow.
- Creating/updating/deleting Warden agents from web UI.
- Installing Pi packages from web UI.
- Replacing `warden pi <agent>` interactive TUI behavior.
- Full settings panel.
- Full session tree editor.

## Implementation cautions

- Keep runner behavior out of `warden-web`; package code can expose server/CLI entrypoints, but `run-warden/` owns Warden command dispatch.
- Do not assume `$PI_CODING_AGENT_DIR` of the web server is the selected agent.
- Do not mutate global `process.env` to switch selected agents.
- Do not trust raw session JSONL shape without using Pi `SessionManager` where possible.
- Do not make raw `AgentSessionEvent` browser API.
- Include `seq` on streamed events when streaming is introduced.
- Send full `stateSync` after major transitions: worker ready, session switch, new session, reconnect, model/thinking change, writer change.
- Keep first protocol small but versionable.
- Keep tests deterministic and temp-dir based.
- Keep package dependencies local to `pi-warden/warden-web`.
- Do not add root lint/format tooling for this package.
- Do not reformat existing docs/packages as a side effect.

## Useful source paths

Warden:

- `AGENTS.md` — root repo rules.
- `pi-warden/AGENTS.md` — package-area rules.
- `run-warden/AGENTS.md` — runner rules.
- `run-warden/lib/pi-agents.sh` — current agent discovery/launch env behavior.
- `run-warden/bin/warden` — runner command dispatch.
- `pi-warden/README.md` — package-area conventions.
- `pi-warden/tests/smoke.bats` — package-area smoke inventory.

Pi SDK installation docs/types on this machine:

- `/home/oj/.config/pi-agents/piper/npm/node_modules/@earendil-works/pi-coding-agent/docs/sdk.md`
- `/home/oj/.config/pi-agents/piper/npm/node_modules/@earendil-works/pi-coding-agent/docs/rpc.md`
- `/home/oj/.config/pi-agents/piper/npm/node_modules/@earendil-works/pi-coding-agent/docs/sessions.md`
- `/home/oj/.config/pi-agents/piper/npm/node_modules/@earendil-works/pi-coding-agent/docs/session-format.md`
- `/home/oj/.config/pi-agents/piper/npm/node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.d.ts`
- `/home/oj/.config/pi-agents/piper/npm/node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session-runtime.d.ts`
- `/home/oj/.config/pi-agents/piper/npm/node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.d.ts`

Reference repos:

- `https://github.com/jmfederico/pi-web`
- `https://github.com/ashwin-pc/pi-web`
- `https://github.com/Epsilondelta-ai/pi-web`
- `https://github.com/woxQAQ/pi-web`
- `https://github.com/assistant-ui/assistant-ui`

## Implementation report: first bootstrap slice

Date: 2026-06-11

Status: implemented and verified.

This report records what was implemented from `pi-warden/warden-web/bootstrap.md`. It is appended after the original planning baseline because the architecture body above remains useful as planning evidence and future-slice guidance.

### Summary

The first `warden-web` bootstrap slice is now a real package and local server foundation.

Implemented:

- independent package at `pi-warden/warden-web/`;
- package-local TypeScript build, typecheck, test runner, lint, format, smoke, and dry-pack tooling;
- Node HTTP server with stable first-slice routes;
- typed protocol surface for health, agent summaries, diagnostics, agents response, and errors;
- Warden-managed Pi agent discovery read model;
- package bins `warden-web` and `warden-web-server`;
- runner-owned `warden web [ARGS...]` dispatch shim;
- package-area inventory and GitHub package-label hygiene updates.

Not implemented, by design:

- browser client;
- React/Vite;
- assistant-ui;
- Playwright;
- Storybook;
- WebSocket protocol;
- chat-window workers;
- Pi SDK session execution;
- prompt streaming;
- session history indexing;
- model/thinking controls;
- writer locks;
- remote control plane;
- service installer/daemon;
- agent create/update/delete/repair flows.

### Package files added

`pi-warden/warden-web/` now contains:

```text
AGENTS.md
LICENSE
README.md
package.json
package-lock.json
tsconfig.json
tsconfig.build.json
.oxlintrc.json
.oxfmtrc.json
scripts/run-tests.mjs
scripts/smoke-server.mjs
src/index.ts
src/protocol.ts
src/bin/warden-web.ts
src/server/agent-discovery.ts
src/server/config.ts
src/server/index.ts
tests/agent-discovery.test.ts
tests/config.test.ts
tests/protocol.test.ts
tests/server-smoke.test.ts
```

Existing planning files retained:

```text
architecture.md
bootstrap.md
```

### Package manifest and tooling

`package.json` now defines package `@nekwebdev/warden-web` version `0.1.0` with:

- `type: "module"`;
- Node engine `>=22`;
- MIT license and Warden repository metadata;
- package bins:
  - `warden-web` → `./dist/bin/warden-web.js`;
  - `warden-web-server` → `./dist/server/index.js`;
- package API export `.` → built `dist/index.js` plus declarations;
- peer dependency `@earendil-works/pi-coding-agent: "*"`;
- package-local dev dependencies for Pi runtime types, Node types, `tsx`, `typescript`, `oxlint`, and `oxfmt`;
- no `pi` manifest and no empty extension/resource directories.

Scripts implemented:

```json
{
  "build": "tsc -p tsconfig.build.json",
  "dev": "tsx src/server/index.ts",
  "format": "oxfmt --check",
  "format:fix": "oxfmt",
  "lint": "oxlint && oxfmt --check",
  "lint:fix": "oxlint --fix && oxfmt",
  "pack:dry": "npm pack --dry-run",
  "prepack": "npm run build",
  "prepublishOnly": "npm run verify",
  "smoke:server": "node scripts/smoke-server.mjs",
  "start": "tsx src/server/index.ts",
  "test": "node scripts/run-tests.mjs",
  "typecheck": "tsc --noEmit",
  "verify": "npm run format && npm run lint && npm run typecheck && npm test && npm run build && npm run smoke:server && npm run pack:dry"
}
```

Tooling scope:

- `oxlint` and `oxfmt` are package-local only;
- configs ignore `dist`, `node_modules`, and `coverage`;
- formatter ignores lockfiles and prose/config formats that should not churn;
- no root lint/format dependencies were added.

### Server config implementation

`src/server/config.ts` implements:

- default host `127.0.0.1`;
- default port `48737`;
- port `0` support for tests and smoke checks;
- `--host <host>`;
- `--host=<host>`;
- `--port <port>`;
- `--port=<port>`;
- `--help` and `-h`;
- env fallback `WARDEN_WEB_HOST`;
- env fallback `WARDEN_WEB_PORT`;
- deterministic validation errors through `ConfigError`;
- help text through `formatHelpText()`.

Validation behavior:

- host must be present and not whitespace-only;
- port must be integer `0..65535`;
- unknown options fail with exit code `2` in the CLI path;
- help returns before env validation, so broken env values do not block `--help`.

### HTTP server implementation

`src/server/index.ts` implements the local Node HTTP server with no external server framework.

Server behavior:

- starts through `startWardenWebServer({ host, port }, context)`;
- listens on configured host/port;
- resolves actual OS-assigned port when port is `0`;
- prints actual URL in CLI path;
- writes ready JSON to `WARDEN_WEB_READY_FILE` when set:

```json
{
  "url": "http://127.0.0.1:<actual-port>",
  "host": "127.0.0.1",
  "port": <actual-port>,
  "pid": <process-id>
}
```

Routes:

- `GET /health` returns stable JSON with `ok`, `packageName`, `version`, `host`, `port`, and `startedAt`;
- `GET /api/agents` returns stable JSON with `agentsRoot` and `agents`;
- unknown `/api/*` routes return JSON `404` with stable error shape;
- non-API paths return deterministic plaintext explaining browser UI is not implemented yet.

Shutdown behavior:

- CLI path binds `SIGINT` and `SIGTERM` to close server and exit cleanly.

### Agent discovery implementation

`src/server/agent-discovery.ts` implements read-only Warden-managed Pi agent discovery.

Agent root resolution:

```ts
WARDEN_AGENTS
  ?? `${XDG_CONFIG_HOME}/pi-agents`
  ?? `${HOME}/.config/pi-agents`
```

Discovery behavior:

- reads direct child directories only;
- ignores files and symlinks because `Dirent.isDirectory()` is required;
- handles missing or unreadable agent root as empty list;
- never creates directories;
- never repairs agents;
- never installs Pi;
- never writes `settings.json`;
- preserves unknown settings by only reading known paths.

Each `AgentSummary` includes:

- `agentId`;
- `agentDir`;
- `settingsPath`;
- `piBin`;
- `piLensDir`;
- `contextModeDir`;
- optional `configuredCwd` when `settings.warden.agent.cwd` is string;
- `status`;
- `diagnostics`.

Current status values:

- `ready`;
- `missing-pi`;
- `invalid-settings`;
- `unreadable`.

Diagnostic coverage includes:

- missing or non-executable local Pi binary;
- invalid `settings.json` JSON;
- unreadable `settings.json`;
- non-object settings root;
- non-string `settings.warden.agent.cwd`.

Broken agents are included with diagnostics instead of crashing the endpoint.

### Protocol implementation

`src/protocol.ts` defines first-slice shared protocol types and helpers:

- `PROTOCOL_VERSION`;
- `PACKAGE_NAME`;
- `PACKAGE_VERSION`;
- `JsonPrimitive`;
- `JsonValue`;
- `HealthResponse`;
- `AGENT_STATUSES`;
- `AgentStatus`;
- `AgentDiagnostic`;
- `AgentSummary`;
- `AgentsResponse`;
- `ErrorResponse`;
- `isRecord()`;
- `isAgentStatus()`;
- `isErrorResponse()`.

The protocol intentionally stops at first-slice HTTP/read-model types. Future WebSocket, worker, session, and event-stream protocol remains planning-only in this document.

### CLI/bin implementation

`src/bin/warden-web.ts` delegates to `main()` from `src/server/index.ts`.

`src/server/index.ts` is also executable as the `warden-web-server` entrypoint after build.

Both entrypoint paths support the same options through `main()`.

### Smoke implementation

`scripts/smoke-server.mjs` performs package-local server smoke verification:

1. creates a temp root;
2. creates temp `WARDEN_AGENTS` root;
3. creates one fake agent with executable local `pi`;
4. writes minimal agent settings with configured cwd;
5. starts built server on `127.0.0.1:0`;
6. waits for `WARDEN_WEB_READY_FILE`;
7. fetches `/health`;
8. fetches `/api/agents`;
9. validates JSON shape;
10. terminates server with `SIGTERM`;
11. removes temp files;
12. prints captured stdout/stderr on failure.

Lint warning correction:

- an earlier version disabled `eslint/no-await-in-loop` to quiet smoke polling warnings;
- that lint-rule suppression was removed;
- polling was rewritten in `scripts/smoke-server.mjs` so `npm run lint --prefix pi-warden/warden-web` reports `0 warnings and 0 errors` without weakening rules.

### Tests added

Package tests:

- `tests/config.test.ts` covers defaults, CLI/env precedence, split and equals forms, help behavior, invalid ports, invalid hosts, and unknown options.
- `tests/agent-discovery.test.ts` covers root fallback order, missing roots, valid agents, configured cwd, ignored files/symlinks, invalid JSON, missing Pi, and invalid configured cwd diagnostics.
- `tests/protocol.test.ts` covers protocol version, status guard, and error response guard.
- `tests/server-smoke.test.ts` starts the server on port `0` and covers `/health`, `/api/agents`, non-API placeholder, and API 404 shape.

Runner tests:

- help includes `web [ARGS...]`;
- `warden web --help --port 0` dispatches through fake `npm` to package `start` with forwarded args;
- missing package fails clearly;
- missing npm fails clearly;
- README command tests include `warden web [ARGS...]`.

Package-area smoke tests:

- `pi-warden/tests/smoke.bats` checks `warden-web` package folder, manifest, server source folder, bin entry, and absence of a `pi` manifest.

### Runner integration

`run-warden/lib/web.sh` adds `warden_web()`.

Runner behavior:

- resolves package at `${WARDEN_HOME}/pi-warden/warden-web`;
- fails clearly if package folder or package manifest is missing;
- fails clearly if `node` is missing;
- fails clearly if `npm` is missing;
- does not install dependencies;
- uses `exec npm run start --prefix "$package_dir" -- "$@"` so signals reach the server process;
- forwards all args after `warden web`.

`run-warden/bin/warden` now:

- sources `lib/web.sh`;
- lists `web [ARGS...]` in usage;
- dispatches `web)` to `warden_web "$@"`.

`run-warden/README.md` documents the command and runner boundary.

### Package-area and GitHub hygiene

Because `pi-warden/warden-web/package.json` creates a new package-like unit, these inventories were updated:

- `README.md`;
- `AGENTS.md`;
- `pi-warden/README.md`;
- `pi-warden/AGENTS.md`;
- `pi-warden/tests/smoke.bats`;
- `run-warden/README.md`;
- `.github/workflows/label-issues.yml`;
- `.github/ISSUE_TEMPLATE/bug_report.yml`;
- `.github/ISSUE_TEMPLATE/feature_request.yml`;
- `.github/pull_request_template.md`.

New GitHub label slug expected by hygiene surfaces:

```text
pkg:warden-web
```

### TDD evidence

Red checks were run before implementation:

- `npm test --prefix pi-warden/warden-web` failed because source modules did not exist yet.
- `mise run test:run-warden` failed because `web [ARGS...]` help and dispatch did not exist yet.

Implementation then made package tests and runner tests pass.

A later lint correction was also validated by command:

- `npm run lint --prefix pi-warden/warden-web` → `Found 0 warnings and 0 errors`.

### Verification run

Commands run and verified after implementation:

```sh
npm install --prefix pi-warden/warden-web
npm run verify --prefix pi-warden/warden-web
npm test --prefix pi-warden/warden-web
mise run test:run-warden
mise run test:pi-warden
```

Observed final results:

- `npm install --prefix pi-warden/warden-web` → exit `0`;
- `npm run verify --prefix pi-warden/warden-web` → exit `0`;
- `npm test --prefix pi-warden/warden-web` → 14 tests passed, exit `0`;
- `mise run test:run-warden` → 63 tests passed, exit `0`;
- `mise run test:pi-warden` → exit `0`.

Additional post-correction verification:

```sh
npm run verify --prefix pi-warden/warden-web
```

Observed post-correction result:

- `format` passed;
- `lint` passed with `0 warnings and 0 errors`;
- `typecheck` passed;
- package tests passed;
- build passed;
- server smoke passed;
- dry pack passed;
- command exit `0`.

### Deviations from bootstrap prompt

No product-scope deviations were introduced.

Small implementation details:

- config rejects hosts containing whitespace as an extra guard;
- missing or unreadable agent root returns empty agents list, matching missing-root requirement and keeping endpoint robust;
- agent symlinks are ignored through `Dirent.isDirectory()` rather than followed;
- smoke polling uses promise/timer recursion to satisfy lint without disabling warnings;
- `@earendil-works/pi-coding-agent` remains a peer/dev dependency even though SDK imports are deferred, because first-slice package metadata intentionally prepares for imminent Pi SDK use.

### Boundary confirmation

Preserved boundaries:

- no root `./warden` changes;
- no package manifests/source/tests/build systems directly under `pi-warden/` root;
- no Warden agent create/update/delete/repair behavior in `warden-web`;
- no shell startup-file mutation;
- no Pi settings or agent settings writes;
- no dependency installation from runner code;
- no browser client or WebSocket behavior;
- no worker process or Pi session runtime behavior;
- no root lint/format tooling.

### Known follow-up

Next safe vertical slice remains session history indexing:

- add `src/server/session-index.ts`;
- use Pi `SessionManager` where practical;
- group sessions by cwd;
- put configured cwd first;
- add temp-dir/mocked tests;
- expose a read-only sessions endpoint for a selected agent.
