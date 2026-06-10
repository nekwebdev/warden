# Warden Map: pi-warden/warden-panel

Reviewed: 2026-06-10
Scope: pi-warden/warden-panel
Evidence basis: package README/AGENTS; `package.json`; public `src/`; bundled extensions; tests; bounded git history.
Git basis: main@6ebda02
Parent map: .warden/map.md

<!-- warden-map:inject:start -->
## Agent Quick Context

- Purpose: `@nekwebdev/warden-panel` is Warden's Pi Agent panel framework and bundled panel-extension package.
- Boundaries: Public API lives in `src/`; bundled extensions live in `extensions/warden-panel`, `extensions/warden-display`, and `extensions/warden-packages`; root `index.ts` aggregates bundled extensions for local-path loading. Runner workflows stay in `run-warden/`.
- Safe edits: Keep manifest `pi.extensions` at `./extensions/*/index.ts` and export at `./src/index.ts`. Preserve `globalThis` registries, exact commands `/warden`, `/warden:display`, `/warden:packages`, and no `/warden:settings`.
- Verification: Run `npm test --prefix pi-warden/warden-panel`; broader package check is `mise run test:pi-warden`.
- Sharp edges: Settings writes must preserve unknown root keys and unknown `settings.warden` keys. Display toggles write inline; Esc does not roll back. Package-manager behavior belongs in `extensions/warden-packages/`, not core panel framework.
<!-- warden-map:inject:end -->

## Scope Purpose

`pi-warden/warden-panel/` packages Warden panel behavior for Pi Agent: shared pane framework plus bundled commands/panes for Warden panel, Display settings, and Packages settings.

Maps are orientation only and do not override repo or package `AGENTS.md` instructions.

## Local Structure

| Path | Role | Notes |
|---|---|---|
| `package.json` | npm/Pi manifest | Package name `@nekwebdev/warden-panel`; exports public API; advertises extension glob. |
| `index.ts` | Aggregate local-path loader | Registers bundled panel/display/packages extensions and re-exports API. |
| `src/index.ts` | Public API barrel | Exports pane registry, display-setting registry, panel helpers, command helpers, settings types. |
| `src/registry.ts` | Shared registries | Uses `globalThis` so separately loaded packages share pane/action/display registries. |
| `src/panel.ts` | Panel UI core | Builds Warden panel behavior. |
| `src/panel-session.ts` | Session renderer/input loop | Coordinates render/input lifecycle for panes. |
| `src/panel-render.ts` | Render helpers | Renders panel layout. |
| `src/settings.ts` | Pi settings helpers | Reads/writes Warden settings safely. |
| `src/commands.ts` | Command helpers | Shared command registration/opening helpers. |
| `src/glyphs.ts` | Glyph helpers | Supports nerd-glyph/plain display choices. |
| `extensions/warden-panel/` | Main extension | Registers `/warden`. |
| `extensions/warden-display/` | Display extension | Registers Display pane and `/warden:display`. |
| `extensions/warden-packages/` | Packages extension | Installs/removes/updates global Pi packages and registers `/warden:packages`. |
| `tests/` | Node tests | Manifest, registry, panel, display, packages, settings, glyphs coverage. |
| `scripts/run-tests.mjs` | Test orchestrator | Checks expected tests then runs `node --import tsx --test`. |

## Local Entry Points

- Package load: default export from root `index.ts` registers bundled extensions for local path loading.
- Public import: `@nekwebdev/warden-panel` resolves to `src/index.ts`.
- Commands: `/warden`, `/warden:display`, `/warden:packages`.
- Manifest extension entries: `./extensions/*/index.ts`.
- Public contribution APIs include `contributeWardenPane`, `contributeWardenPaneActionHandler`, `contributeWardenDisplaySetting`, and `showWardenPanel`.

## Local Conventions

- Pane IDs and Display setting IDs must be unique; duplicates throw.
- Pane command names start with `warden:`.
- Registries and action-handler state are shared through `globalThis`, not per module instance.
- `/warden` opens the first available pane; no `/warden:settings` command exists.
- Display pane manages `warden.useNerdGlyphs` and accepts contributed Display settings from sibling packages.
- Display settings write inline on Space/Enter; Esc exits without rolling back changes already written.
- Packages pane reads global Pi `packages` from `$PI_CODING_AGENT_DIR/settings.json`; project-local `.pi/settings.json` packages are outside scope.
- After install/remove/update package actions, report to chat and tell user to restart Pi. Do not auto-reload Pi.

## Dependencies and Integration Points

- Peer/dev dependencies: `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui`.
- Uses Pi command registration, UI prompts/confirm/notify, message renderer, and Markdown renderer APIs.
- Settings path prefers `$PI_CODING_AGENT_DIR/settings.json`, uses test override `WARDEN_PANEL_TEST_HOME`, then home Pi settings fallback.
- `extensions/warden-packages` delegates install/update validation to Pi package-manager behavior, then persists exact settings changes it owns.
- `warden-flow` imports public pane/display APIs for Effort pane and skill-status Display toggle.
- `warden-subagents` imports public panel APIs for read-only Subagents pane and `/agents`/`/warden:agents` openers.

## Verification for This Scope

Primary:

- `npm test --prefix pi-warden/warden-panel`

Broader:

- `mise run test:pi-warden`
- `mise run test`

`tests/package-manifest.test.ts` protects manifest/export/extension paths. Package tests cover registry behavior, settings preservation, Display inline writes, package install/remove/update operations, pane rendering, and glyph behavior.

## Safe Edit Notes

- Preserve settings write safety: patch only owned Warden/global-package settings, keep unknown keys, and write atomically with temp+rename.
- Keep package-management logic in `extensions/warden-packages/`; core `src/` should stay framework/shared API.
- Keep exact commands stable unless tests/docs update together.
- Keep public registry APIs stable for sibling packages unless package dependents update together.
- Do not implement runner-owned `warden agents`, `warden pi`, shell integration, or bootstrap behavior in this package.

## Recent Evolution from Git History

Recent history added tagged npm package update behavior to the Packages pane. Older orientation-relevant history added `warden-panel`, folded former `warden-packages` into `extensions/warden-packages`, renamed the old settings pane to Display, extracted panel session rendering, and enabled sibling packages to contribute Display settings and panes through public APIs.

## Open Questions

No package-internal open question found. Future external panes should use exported registry APIs instead of reaching into internals.
