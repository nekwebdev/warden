# warden-web Agent Guidance

Repository guidance for coding agents working in `pi-warden/warden-web/`.

## Instruction order

- Read repo root `AGENTS.md` first.
- Read `pi-warden/AGENTS.md` before package edits.
- Read this file before changing files under `pi-warden/warden-web/`.
- Read `run-warden/AGENTS.md` before changing runner command dispatch.
- Use nearby `map.md` files for orientation only.
- Do not treat planning docs as active task state after implementation starts.

## Boundary

`warden-web/` is package `@nekwebdev/warden-web`.

Package-owned areas:

- package-local server, CLI bins, protocol types, tests, smoke script, docs, and tooling;
- Warden-managed Pi agent discovery read model;
- future browser UI, session history read model, WebSocket protocol, and worker bridge after dedicated slices.

This package does not own root bootstrap, shell integration, Warden agent lifecycle commands, `warden pi` TUI launch, or runner command internals beyond the narrow `run-warden/` shim that starts this package.

## First-slice rules

- Keep implementation under `pi-warden/warden-web/`.
- Keep dependencies package-local.
- Do not add React, Vite, assistant-ui, Playwright, Storybook, WebSocket chat, worker processes, or Pi session streaming until a later slice.
- Do not create, update, delete, repair, or install Warden-managed agents from this server.
- Do not mutate shell startup files, Pi settings, agent settings, or user files.
- Preserve unknown agent settings by never writing `settings.json`.
- Bind localhost by default.

## Testing

```sh
npm install --prefix pi-warden/warden-web
npm run verify --prefix pi-warden/warden-web
npm test --prefix pi-warden/warden-web
mise run test:pi-warden
```

Run package-local tests for package changes. Run `mise run test:run-warden` when touching runner dispatch. Run `mise run test:pi-warden` when package-area assumptions or inventories change.

## Documentation

- `README.md` explains package behavior, routes, options, and local development.
- `AGENTS.md` contains package-specific boundaries and test expectations.
- Keep planning docs (`architecture.md`, `bootstrap.md`) as reference, not current task state.
