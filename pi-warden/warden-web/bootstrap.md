# Warden Web Bootstrap Slice Prompt

Status: validated implementation prompt for the first `warden-web` slice.
Date: 2026-06-11

Use this prompt to start implementation after this planning packet is accepted. It is intentionally narrow: package/server/bootstrap only, no browser client.

## Prompt

Implement the first solid bootstrap slice for `pi-warden/warden-web`.

### Orientation requirements

Before editing, read:

1. `AGENTS.md`
2. `pi-warden/AGENTS.md`
3. `run-warden/AGENTS.md` before runner changes
4. `pi-warden/warden-web/architecture.md`

Use `map.md` files only as orientation. They are not task plans.

### Goal

Create the first independently testable `warden-web` package and wire a `warden web` server command.

This slice must prove:

- `warden-web` is a real package under `pi-warden/warden-web/`;
- package-local dev tooling works without adding root-level dependencies;
- package metadata, bins, scripts, tests, build, dry pack, and smoke checks exist;
- `warden web` starts the local server through runner-owned command dispatch;
- server can answer `/health` and list Warden-managed Pi agents via `/api/agents`;
- no browser client, worker runtime, Pi session streaming, assistant-ui integration, or remote control plane is introduced yet.

### Non-negotiable boundaries

- Keep package implementation under `pi-warden/warden-web/`.
- Keep runner command dispatch under `run-warden/`.
- Do not edit root `./warden`.
- Do not add package manifests, package source, package tests, or package build systems directly under `pi-warden/`.
- Do not create or repair Warden agents from the web server.
- Do not mutate shell startup files, Pi settings, agent settings, or user files.
- Do not install dependencies from runner code.
- Do not add React, Vite, assistant-ui, Playwright, Storybook, WebSocket chat, worker processes, or session-history indexing in this slice.
- Treat `warden-web` tooling as isolated like its own repo: package-local `package.json`, `package-lock.json`, configs, scripts, and `node_modules`.

### Required package shape

Create:

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

Adjust file names only if a simpler structure is clearly better, but keep the same behavior and tests.

### Package metadata

`package.json` requirements:

- name: `@nekwebdev/warden-web`
- version: `0.1.0`
- type: `module`
- description: local web server and future mobile-first web UI for Warden-managed Pi agents
- keywords include `pi-package`, `pi`, `pi-agent`, `warden`, `warden-web`, `web`, `server`
- author/license/repository/homepage/bugs/publishConfig consistent with other Warden packages
- engines: Node `>=22`
- files whitelist: `dist`, `src/**/*.ts` only if needed, `scripts/**/*.mjs`, `README.md`, `AGENTS.md`, `LICENSE`
- exports: `.` to package API
- bins:
  - `warden-web` -> built CLI entrypoint
  - `warden-web-server` -> built server entrypoint
- peerDependencies: `@earendil-works/pi-coding-agent: "*"`
- devDependencies include package-local `@earendil-works/pi-coding-agent`, `@types/node`, `tsx`, `typescript`, `oxlint`, and `oxfmt`
- do not add an empty `pi` manifest or empty extension directory; add `pi` resources only when real Pi package resources exist

Use TypeScript source with `.js` local import specifiers so built output and `tsx` both work.

### Scripts

Add package-local scripts:

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

If `format` and `lint` overlap because `lint` already runs `oxfmt --check`, keep both scripts anyway for explicit developer workflow.

### Oxlint and oxfmt

Use package-local configs in `pi-warden/warden-web/`.

Recommended `.oxlintrc.json` direction:

- enable TypeScript, import, node, promise plugins where supported;
- make correctness errors strict;
- keep style/pedantic low-noise;
- ignore `dist`, `node_modules`, `coverage`;
- prefer warnings or errors that catch real server bugs.

Recommended `.oxfmtrc.json` direction:

- `printWidth: 120` for Warden readability;
- semicolons on, double quotes, trailing commas;
- ignore `dist`, `node_modules`, `coverage`, lockfiles, Markdown, YAML, TOML;
- `sortPackageJson: false` initially to avoid noisy package manifest churn;
- do not format repo-level files outside `pi-warden/warden-web`.

### Server behavior

Implement a small Node HTTP server; avoid Fastify or other server dependencies for this bootstrap unless truly needed.

Required CLI/server options:

- `--host <host>` or `--host=<host>`
- `--port <port>` or `--port=<port>`
- `--help`
- env fallback `WARDEN_WEB_HOST`
- env fallback `WARDEN_WEB_PORT`
- default host `127.0.0.1`
- default port `48737`
- allow port `0` for tests/smoke to request an OS-assigned port
- write ready JSON to `WARDEN_WEB_READY_FILE` when set:

```json
{
  "url": "http://127.0.0.1:<actual-port>",
  "host": "127.0.0.1",
  "port": <actual-port>,
  "pid": <process-id>
}
```

Required routes:

- `GET /health`
  - returns JSON `{ ok: true, packageName, version, host, port, startedAt }`
- `GET /api/agents`
  - returns JSON `{ agentsRoot, agents }`
- any other `/api/*`
  - returns JSON 404 with a stable error shape
- non-API path in this slice
  - can return plain text explaining that browser UI is not implemented yet, or 404 JSON; keep deterministic for tests

Print the actual URL after listening.

### Agent discovery behavior

Implement `src/server/agent-discovery.ts` with tests.

Agent root resolution:

```ts
WARDEN_AGENTS
  ?? `${XDG_CONFIG_HOME}/pi-agents`
  ?? `${HOME}/.config/pi-agents`
```

For each direct child directory, return an `AgentSummary` containing at least:

- `agentId`: directory name
- `agentDir`: absolute path
- `settingsPath`
- `piBin`: `<agentDir>/npm/node_modules/.bin/pi`
- `piLensDir`: `<agentDir>/pi-lens`
- `contextModeDir`: `<agentDir>/context-mode`
- `configuredCwd`: `settings.warden.agent.cwd` when it is a string
- `status`: stable enum such as `ready`, `missing-pi`, `invalid-settings`, `unreadable`
- `diagnostics`: array of stable diagnostic objects or strings

Rules:

- ignore non-directories;
- do not follow directory symlinks unless there is a clear safe reason;
- handle missing agent root as empty list;
- handle invalid JSON without throwing the whole endpoint;
- preserve unknown settings; never write `settings.json`;
- do not create `pi-lens`, `context-mode`, `npm`, or session directories.

### Protocol/API types

Create `src/protocol.ts` with shared types for this first slice:

- `JsonValue`
- `HealthResponse`
- `AgentStatus`
- `AgentDiagnostic`
- `AgentSummary`
- `AgentsResponse`
- `ErrorResponse`

Add minimal runtime helpers or type guards where useful. Keep protocol versionable; do not design the entire future WebSocket protocol in code yet.

### Runner command

Add `warden web [ARGS...]` in `run-warden/`.

Required changes:

- source a new `run-warden/lib/web.sh` from `run-warden/bin/warden`;
- add `web [ARGS...]` to usage;
- dispatch `web)` to `warden_web "$@"`;
- `warden_web` resolves `${WARDEN_HOME}/pi-warden/warden-web`;
- fail clearly if package folder or `package.json` is missing;
- fail clearly if `npm` or `node` is missing;
- do not install dependencies;
- execute package start command with forwarded args, likely:

```sh
npm run start --prefix "$package_dir" -- "$@"
```

Use `exec` when appropriate so signals reach the server.

Add Bats coverage to `run-warden/tests/warden.bats`:

- help includes `web [ARGS...]`;
- unknown forms still fail normally;
- `warden web --help` dispatches to package start command with forwarded args, using a fake `npm` in test PATH;
- missing package/deps fail with clear messages where practical.

### Package-area and GitHub hygiene

Because adding `pi-warden/warden-web/package.json` creates a new package-like unit, update all package/area inventories in the same implementation slice:

- `pi-warden/README.md`
- `pi-warden/AGENTS.md`
- `pi-warden/tests/smoke.bats`
- `.github/workflows/label-issues.yml`
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/feature_request.yml`
- `.github/pull_request_template.md`

Use exact label slug `pkg:warden-web`.

Do not update maps unless durable orientation materially changes and the map workflow allows it.

### Tests and smoke checks

Package tests should cover:

- config parsing and defaults;
- invalid ports/hosts handling;
- agent root fallback behavior;
- valid agent discovery;
- missing/broken/invalid agents;
- `/health` route;
- `/api/agents` route;
- 404 error shape.

Package smoke script should:

1. create a temp `WARDEN_AGENTS` root;
2. create at least one minimal fake agent directory;
3. start the built server or built bin on `127.0.0.1:0`;
4. wait via `WARDEN_WEB_READY_FILE`;
5. fetch `/health`;
6. fetch `/api/agents`;
7. confirm JSON shape;
8. terminate the server cleanly;
9. include stdout/stderr in failure messages.

Prefer no real Pi session in this smoke test. Real `pi install .` smoke belongs later when Pi-facing extension behavior exists.

### Required verification commands

After implementation, run and report exact results:

```sh
npm install --prefix pi-warden/warden-web
npm run verify --prefix pi-warden/warden-web
npm test --prefix pi-warden/warden-web
mise run test:run-warden
mise run test:pi-warden
```

If any command cannot run, report the exact reason. Do not claim verification unless it ran.

### Explicit non-goals for this slice

Do not implement:

- React/Vite/browser client;
- assistant-ui integration;
- Playwright;
- Storybook;
- performance budgets;
- dev supervisor;
- WebSocket chat protocol;
- chat-window workers;
- Pi SDK `AgentSessionRuntime` usage;
- prompt streaming;
- session history indexing;
- model/thinking controls;
- writer locks;
- remote machines;
- plugin system;
- service installer/daemon;
- Tailscale/LAN bind flow;
- creating, updating, deleting, or repairing agents.

### Carry-forward notes from reference research

Use these decisions now:

- metadata/bin/script discipline from `jmfederico/pi-web`;
- package-local `oxlint`/`oxfmt` from `woxQAQ/pi-web` and `assistant-ui`;
- package smoke test from `woxQAQ/pi-web`, adapted to `warden-web-server` rather than `/web` Pi extension;
- serious package-local tests from first slice.

Document but defer:

- `ashwin-pc/pi-web` restartable supervisor;
- Playwright smoke/e2e until UI exists;
- `Epsilondelta-ai/pi-web` split frontend/backend CI, performance budgets, Storybook, release artifact matrix;
- plugin system;
- remote machine control plane;
- assistant-ui UI primitives.

### Expected final handoff

Final response should include:

- files changed;
- exact commands run;
- exact tests not run and why;
- any deviations from this prompt;
- next safe slice suggestion.
