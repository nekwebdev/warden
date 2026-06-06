# warden-panel Agent Guidance

Repository guidance for coding agents working in `pi-warden/warden-panel/`.

## Instruction order

- Read the repo root `AGENTS.md` first.
- Read `pi-warden/AGENTS.md` before package edits.
- Read this file before changing files under `pi-warden/warden-panel/`.
- Use nearby `map.md` files for orientation only.
- Do not treat `map.md` files as task plans, issue trackers, implementation diaries, or current-work state.

## Boundary

`warden-panel/` is package `@nekwebdev/warden-panel`. It owns Warden panel-related Pi behavior.

Package-owned areas:

- shared panel framework/public API in `src/`;
- bundled Pi extensions in `extensions/`;
- aggregate local-path loader in root `index.ts`;
- package tests in `tests/`;
- package scripts in `scripts/`.

Bundled extensions:

- `extensions/warden-panel/` registers `/warden`.
- `extensions/warden-display/` contributes the Display pane and `/warden:display`.
- `extensions/warden-packages/` contributes the Packages pane/actions and `/warden:packages`.

This package does not own Warden runner workflows. `warden agents ...` and `warden pi ...` behavior belongs in `run-warden/`.

## Rules

- Keep Pi manifest pointed at `./extensions/*/index.ts`.
- Keep package export pointed at `./src/index.ts`.
- Keep public pane registry, Display setting contribution registry, and `showWardenPanel` exports importable from `@nekwebdev/warden-panel`.
- Keep pane registry, Display setting registry, and action-handler state shared through `globalThis` so separately loaded Warden packages see one registry.
- Register `/warden` as the main exact Pi command and make it open the first available pane.
- Register `/warden:display` and `/warden:packages` as exact Pi commands.
- Do not register `/warden:settings`.
- Persist only Warden panel preferences under `settings.warden`; preserve unknown root keys and unknown `warden` keys.
- Display pane changes, including contributed Display settings from sibling packages, write inline without Apply. Esc must not roll back already toggled Display settings.
- Keep package-manager behavior in `extensions/warden-packages/`, not in core `src/` panel framework.
- Do not change root bootstrap or `run-warden/` agent workflows from this package.

## Testing

```sh
npm install --prefix pi-warden/warden-panel
npm test --prefix pi-warden/warden-panel
mise run test:pi-warden
```

Run package-local tests for package changes. Run `mise run test:pi-warden` when shared Pi package assumptions or package-area behavior change. Report unavailable tooling or skipped checks exactly.

## Documentation

- `README.md` explains package behavior, commands, APIs, and local development for humans.
- `AGENTS.md` contains package-specific agent rules and boundaries.
- Do not add active task state or implementation diaries to README, AGENTS, or map files.
