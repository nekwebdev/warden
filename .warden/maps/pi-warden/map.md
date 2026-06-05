# Warden Map: pi-warden

Reviewed: 2026-06-05
Scope: pi-warden
Evidence basis: `pi-warden/AGENTS.md`, `pi-warden/README.md`, package READMEs/AGENTS, package manifests, `pi-warden/tests/smoke.bats`, existing child maps, bounded git history.
Git basis: main@e604271
Parent map: .warden/map.md

<!-- warden-map:inject:start -->
## Agent Quick Context

- Purpose: `pi-warden/` is Warden's Pi Agent package area. It is a container, not itself a Pi package.
- Boundaries: Package manifests/source/tests live under direct child package folders. Current packages are `warden-panel` (`@nekwebdev/warden-panel`) and `warden-flow` (`@nekwebdev/warden-flow`, bundling `warden-map` and `warden-commit` skills/extensions). Runner-owned `warden agents` and `warden pi` workflows remain in `run-warden/`.
- Safe edits: Read `pi-warden/AGENTS.md` and package `AGENTS.md` before package edits. Do not place package manifests/source at `pi-warden/` root. Package behavior must not mutate root bootstrap or runner workflows unless explicitly scoped.
- Verification: Run `mise run test:pi-warden`; package-specific checks are `npm test --prefix pi-warden/warden-panel` and `npm test --prefix pi-warden/warden-flow` after install.
- Sharp edges: Package roots may contain ignored `node_modules/`. `warden-panel` absorbed former `warden-packages`; do not recreate `pi-warden/warden-packages`. Use live git context injection for current dirty-state details.
<!-- warden-map:inject:end -->

## Scope Purpose

`pi-warden/` owns Warden's Pi Agent package work. It provides package-area guidance, smoke tests, and child package roots that Pi can install or load.

## Local Structure

| Path | Role | Notes |
|---|---|---|
| `AGENTS.md` | Package-area guidance | Defines container/package rules. |
| `README.md` | Package-area docs | Lists current packages and package shape. |
| `tests/smoke.bats` | Smoke tests | Checks package folders/manifests/resources and former package fold-in. |
| `warden-panel/` | Pi package | Panel framework plus bundled panel/display/packages extensions. See scoped map. |
| `warden-flow/` | Pi package | Workflow package currently bundling `warden-map` repository-map resources and `warden-commit` safe local commit resources. See scoped map. |

Expected package shape from guidance:

- `package.json`, `README.md`, `AGENTS.md`
- `src/` for shared code/public API when needed
- `extensions/` for Pi extensions
- `skills/`, `prompts/`, `themes/`, `hooks/`, `docs/`, `bin/`, `configs/`, `web/` only when needed
- `tests/` and `scripts/` for verification support

## Local Entry Points

- `mise run test:pi-warden` runs package-area smoke tests and each package's `npm test` via `.mise.toml` package loop.
- Package manifests advertise Pi resources:
  - `warden-panel/package.json` has `pi.extensions: ["./extensions/*/index.ts"]`.
  - `warden-flow/package.json` has `pi.extensions` and `pi.skills: ["./skills"]`.
- Pi can load packages by install or local path depending on Pi workflow outside this repo.

## Local Conventions

- Top-level `pi-warden/` remains docs/guidance/tests only.
- Each package is independently installable/testable with npm when TypeScript/npm-based.
- Package code and assets stay under package root.
- Add package-specific `AGENTS.md` for any new package.
- Preserve package manifests' Pi resource paths when moving files.

## Dependencies and Integration Points

- `run-warden/` creates/launches Pi agent environments, but does not implement package behavior in this scope.
- Packages depend on Pi APIs through peer/dev dependencies such as `@earendil-works/pi-coding-agent` and, for panel TUI, `@earendil-works/pi-tui`.
- Package tests use Node's test runner with `tsx` through package-local `scripts/run-tests.mjs`.

## Verification for This Scope

Primary:

- `mise run test:pi-warden`

Focused package commands:

- `npm install --prefix pi-warden/warden-panel`
- `npm test --prefix pi-warden/warden-panel`
- `npm install --prefix pi-warden/warden-flow`
- `npm test --prefix pi-warden/warden-flow`

## Safe Edit Notes

- Do not put `package.json`, TypeScript source, or Pi extension assets directly in `pi-warden/` root.
- Do not mutate root `./warden` or `run-warden/` from package work without explicit cross-boundary scope.
- Keep smoke tests aligned with current package list and removed/folded packages.
- Preserve MIT license files in packages.

## Recent Evolution from Git History

Recent git history shows the Pi package area shifted from panel-only to a workflow + panel package set. `warden-panel` added bundled panel extensions and folded former `warden-packages` into `extensions/warden-packages`. `warden-flow` was then added for durable maps/git context, gained `warden-commit` snapshot/apply tooling, and had its `warden-map` skill contract tightened. Package-area docs and smoke tests now name only `warden-panel` and `warden-flow`.

## Open Questions

Future package release/build workflow is not documented beyond current npm manifests, package-locks, and test scripts.
