# Warden Map: pi-warden/warden-panel

Reviewed: 2026-06-06
Scope: pi-warden/warden-panel
Evidence basis: package README/AGENTS, `package.json`, public `src/`, bundled extensions, tests, existing map, bounded git history.
Git basis: main@02fb384
Parent map: .warden/map.md

<!-- warden-map:inject:start -->
## Agent Quick Context

- Purpose: `@nekwebdev/warden-panel` is Warden's Pi Agent panel framework and bundled panel-extension package.
- Boundaries: Shared public API lives in `src/`; bundled extensions live in `extensions/warden-panel`, `extensions/warden-display`, and `extensions/warden-packages`; root `index.ts` aggregates bundled extensions for local-path loading. Runner workflows stay in `run-warden/`.
- Safe edits: Keep manifest `pi.extensions` at `./extensions/*/index.ts` and package export at `./src/index.ts`. Preserve global pane/action/display registries via `globalThis`, exact commands `/warden`, `/warden:display`, `/warden:packages`, and no `/warden:settings`.
- Verification: Run `npm test --prefix pi-warden/warden-panel`; broader package check is `mise run test:pi-warden`.
- Sharp edges: Settings writes must preserve unknown root keys and unknown `settings.warden` keys. Display pane writes toggled settings inline and Esc does not roll back already-written changes. Package-manager behavior belongs in `extensions/warden-packages/`, not core panel framework.
<!-- warden-map:inject:end -->

## Scope Purpose

`pi-warden/warden-panel/` packages Warden panel behavior for Pi Agent: shared pane framework plus bundled commands/panes for Display and Packages settings.

## Local Structure

| Path | Role | Notes |
|---|---|---|
| `package.json` | npm/Pi manifest | Package name `@nekwebdev/warden-panel`; exports `./src/index.ts`; Pi extensions glob. |
| `index.ts` | Aggregate local-path loader | Registers panel, display, and packages extensions; re-exports public API. |
| `src/index.ts` | Public API barrel | Exports pane registry, display-setting registry, panel helpers, command helpers, settings types. |
| `src/registry.ts` | Pane/action/display registry | Uses `globalThis` symbols so separately loaded packages share registry. |
| `src/panel.ts` | Panel UI core | Renders/handles Warden panel. |
| `src/settings.ts` | Pi settings helpers | Reads/writes Warden panel settings safely. |
| `extensions/warden-panel/` | Main command extension | Registers `/warden`. |
| `extensions/warden-display/` | Display pane extension | Registers pane and `/warden:display`; manages display settings. |
| `extensions/warden-packages/` | Packages pane extension | Installs/removes Pi packages and registers `/warden:packages`. |
| `tests/` | Node tests | Manifest, registry, panel, display, packages, settings, glyphs. |
| `scripts/run-tests.mjs` | Test orchestrator | Checks expected test files then runs `node --import tsx --test`. |

## Local Entry Points

- Package load: default export from root `index.ts` registers all bundled extensions.
- Public import: `@nekwebdev/warden-panel` resolves to `src/index.ts`.
- Commands: `/warden`, `/warden:display`, `/warden:packages`.
- Extension entry files: `extensions/*/index.ts` per `package.json` Pi manifest.

## Local Conventions

- Pane contributions use `contributeWardenPane` and optional `contributeWardenPaneActionHandler`.
- Display setting contributions use `contributeWardenDisplaySetting`.
- Pane IDs and Display setting IDs must be unique; duplicate IDs throw.
- Pane command names must start with `warden:`.
- `showWardenPanel()` opens first available pane or requested pane.
- Package report renderer uses custom message type `warden-packages-report`.
- Packages pane V1 reads global Pi packages from `$PI_CODING_AGENT_DIR/settings.json` and ignores project-local `.pi/settings.json` packages.

## Dependencies and Integration Points

- Peer/dev dependencies: `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`.
- Uses Pi command registration, UI prompts/confirm/notify, message renderer, and Markdown renderer.
- Settings path is `$PI_CODING_AGENT_DIR/settings.json` when available, test override `WARDEN_PANEL_TEST_HOME`, otherwise home Pi agent settings path.
- `extensions/warden-packages` manipulates Pi package settings and tells users to restart Pi after install/remove.
- `warden-flow` imports public pane/display APIs to contribute Effort pane and Display skill-status toggle.

## Verification for This Scope

Primary:

- `npm test --prefix pi-warden/warden-panel`

Broader:

- `mise run test:pi-warden`
- `mise run test`

`tests/package-manifest.test.ts` protects manifest/export/extension paths. `scripts/run-tests.mjs` fails if reviewed tests are missing.

## Safe Edit Notes

- Preserve settings write safety: only patch owned Warden keys, keep unknown keys, write atomically with temp+rename.
- Display pane setting toggles write inline; Esc exits without rolling back changes already written.
- Keep package-management code isolated to `extensions/warden-packages/`.
- Do not change root bootstrap or runner-owned agent workflows from this package.
- Keep public registry APIs stable for sibling packages unless tests/docs update together.

## Recent Evolution from Git History

Recent history added `warden-panel`, added former `warden-packages`, then folded package management into `warden-panel/extensions/warden-packages` while preserving exact commands. Former settings pane path was renamed to Display. Later package-area work added `warden-flow` and public Display setting contributions. Recent panel work extracted panel session rendering and tightened package-pane tests; no evidence moves runner-owned agent lifecycle into `warden-panel`.

## Open Questions

No package-internal open questions found. Future external panes should use exported registry APIs rather than reaching into internals.
