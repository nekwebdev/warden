# Warden Map: pi-warden

Generated: 2026-06-04 10:24:45 -10
Scope: pi-warden
Parent map: .warden/map.md

<!-- warden-map:inject:start -->
## Agent Quick Context

- Purpose: `pi-warden/` is Warden's Pi Agent package area. It is a container, not itself a Pi package.
- Boundaries: Package manifests/source/tests live under direct child package folders. Current packages are `warden-panel` (`@nekwebdev/warden-panel`) and `warden-flow` (`@nekwebdev/warden-flow`, bundling the `warden-map` skill/extension). Runner-owned `warden agents` and `warden pi` workflows remain in `run-warden/`.
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
| `warden-flow/` | Pi package | Workflow package currently bundling the `warden-map` repository-map skill and map/git injection extension. See scoped map. |

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

Recent commits show Pi package work became active after bootstrap/runner groundwork: panel package added, packages extension package added, then former `warden-packages` folded into `warden-panel/extensions/warden-packages`. Current package set includes the newer `warden-flow` package, which currently bundles `warden-map` repository mapping and context injection resources.

## Open Questions

Future package release/build workflow is not documented beyond current npm manifests, package-locks, and test scripts.
