# warden-web

`@nekwebdev/warden-web` is Warden's local web server package for future mobile-first browser access to Warden-managed Pi agents.

First bootstrap slice only provides:

- package-local TypeScript tooling;
- Node HTTP server;
- `GET /health`;
- `GET /api/agents`;
- `warden-web` and `warden-web-server` bins;
- smoke test using temp fake agents.

No browser client, React/Vite, WebSocket chat, Pi session worker, or remote control plane exists in this slice.

## Commands

From the repository root:

```sh
npm install --prefix pi-warden/warden-web
npm run verify --prefix pi-warden/warden-web
npm test --prefix pi-warden/warden-web
```

Run server directly during development:

```sh
npm run start --prefix pi-warden/warden-web -- --host 127.0.0.1 --port 48737
```

After runner wiring, Warden starts the same package server with:

```sh
warden web [ARGS...]
```

## Server options

- `--host <host>` or `--host=<host>`; defaults to `127.0.0.1`.
- `--port <port>` or `--port=<port>`; defaults to `48737`; `0` requests an OS-assigned port.
- `WARDEN_WEB_HOST` and `WARDEN_WEB_PORT` provide env fallbacks.
- `WARDEN_WEB_READY_FILE` writes startup JSON with `url`, `host`, `port`, and `pid`.

## Agent discovery

Agent root resolves as:

```text
WARDEN_AGENTS
  ?? ${XDG_CONFIG_HOME}/pi-agents
  ?? ${HOME}/.config/pi-agents
```

The server reads direct child directories only. It does not follow agent symlinks, create agents, repair agents, install packages, or write `settings.json`.

Each agent summary includes paths for `settings.json`, local `pi`, `pi-lens`, `context-mode`, optional configured cwd from `settings.warden.agent.cwd`, status, and diagnostics.
