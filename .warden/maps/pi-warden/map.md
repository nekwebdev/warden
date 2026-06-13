# Warden Map: pi-warden

Reviewed: 2026-06-13
Scope: pi-warden
Evidence basis: `pi-warden/AGENTS.md`; `pi-warden/README.md`; package READMEs/AGENTS; package manifests; `pi-warden/tests/smoke.bats`; child scoped maps; bounded git history through `88cede5`.
Git basis: main@88cede5
Parent map: .warden/map.md

<!-- warden-map:inject:start -->
## Agent Quick Context

- Purpose: `pi-warden/` is Warden's Pi Agent package area. It is a container, not itself a Pi package.
- Boundaries: Package manifests/source/tests live only under direct child package folders. Current packages: `fresh-skill`, `warden-panel`, `warden-flow`, `warden-subagents`, `warden-theme`, and `warden-web`. Runner-owned `warden agents`, `warden pi`, and `warden worktree` workflows remain in `run-warden/`.
- Safe edits: Read root `AGENTS.md`, `pi-warden/AGENTS.md`, then package-local `AGENTS.md` before package edits. Do not place package manifests/source/build systems at `pi-warden/` root. Declare sibling package dependencies explicitly.
- Verification: Run `mise run test:pi-warden`; focused package checks are `npm test --prefix pi-warden/<package>`. Install package deps first when needed.
- Sharp edges: Package roots may contain ignored `node_modules/`. `warden-panel` absorbed former `warden-packages`; do not recreate that package. `warden-subagents` must not implement runner lifecycle commands. Only `warden-map` writes `.warden/map-state.json`.
<!-- warden-map:inject:end -->

## Scope Purpose

`pi-warden/` owns Warden's Pi Agent package ecosystem in this repo. It provides package-area guidance, smoke tests, and direct child package roots that can be locally loaded or installed by Pi.

Maps are orientation only and do not override repo or package `AGENTS.md` instructions.

## Local Structure

| Path | Role | Notes |
|---|---|---|
| `README.md` | Package-area docs | Explains package model, package list, local loading/install commands. |
| `AGENTS.md` | Package-area guidance | Defines container/package rules, skill/code split, effort defaults, package boundaries. |
| `tests/smoke.bats` | Package-area smoke tests | Verifies package folders, manifests, resource dirs, and folded `warden-packages` state. |
| `fresh-skill/` | Pi package | Standalone `/fresh` clean-session skill replay extension. |
| `warden-panel/` | Pi package | Panel framework plus Display and Packages panes. See child scoped map. |
| `warden-flow/` | Pi package | Workflow, map, docs, create-skill, commit, and effort package. See child scoped map. |
| `warden-subagents/` | Pi package | Subagent registry/runtime/RPC/pane package. See child scoped map. |
| `warden-theme/` | Pi package | Catppuccin Mocha-derived Pi theme package. See child scoped map. |
| `warden-web/` | Pi package | Local web server package and future browser UI for Warden-managed Pi agents. |

Expected package shape uses only needed folders: `package.json`, `README.md`, `AGENTS.md`, `src/`, `extensions/`, `skills/`, `prompts/`, `themes/`, `hooks/`, `tests/`, and `scripts/` as package role requires.

## Local Entry Points

- `mise run test:pi-warden` runs package-area smoke tests and `npm test --prefix` for each direct child `package.json`.
- Pi can load package roots during development:
  - `pi -e ./pi-warden/warden-panel`
  - `pi -e ./pi-warden/warden-flow`
  - `pi -e ./pi-warden/warden-subagents`
  - `pi -e ./pi-warden/warden-theme`
- Package manifests advertise resources:
  - `fresh-skill`: `pi.extensions: ["./extensions/*/index.ts"]`
  - `warden-panel`: `pi.extensions: ["./extensions/*/index.ts"]`
  - `warden-flow`: `pi.extensions`, `pi.skills: ["./skills"]`
  - `warden-subagents`: `pi.extensions: ["./extensions/subagents/index.ts"]`
  - `warden-theme`: `pi.themes: ["./themes"]`
  - `warden-web`: package bins for local web server workflows

## Local Conventions

- Top-level `pi-warden/` remains docs/guidance/tests only.
- Each direct package must stay independently installable and testable.
- Deterministic, repeated, safety-sensitive behavior belongs in package `src/` and tests, not only skill prose.
- `extensions/` are for Pi runtime integration: startup hooks, tools, commands, panes, renderers, context injection, or ambient behavior.
- `skills/` are thin model-facing workflows: instructions, acceptance behavior, and verification expectations.
- New `warden-*` skills need effort defaults under `warden.effort.skills` unless intentionally unmanaged.
- When one Warden package imports another Warden package API, declare the dependency in the importing package manifest.
- Do not add package folders, extensions, or resource dirs just for ceremony.

## Dependencies and Integration Points

- `run-warden/` creates/updates/launches Warden-managed Pi agent environments; package code in this scope runs only after Pi loads/installs it.
- Packages depend on Pi APIs through peer/dev dependencies such as `@earendil-works/pi-coding-agent` and, for TUI panel pieces, `@earendil-works/pi-tui`.
- `warden-flow` depends on `@nekwebdev/warden-panel` for Effort pane and Display skill-status contribution.
- `warden-subagents` depends on `@nekwebdev/warden-panel` for the read-only Subagents pane and commands.
- Package tests use Node's test runner, `tsx` for TypeScript packages, and package-local `scripts/run-tests.mjs` expected-test guards.
- Root GitHub issue/PR package hygiene tracks direct Pi packages with exact `pkg:<slug>` labels.

## Current Packages

### `fresh-skill/`

Package `@nekwebdev/fresh-skill`. Owns standalone `/fresh` Pi extension for clean-session skill replay, including argument preservation and loaded-skill validation.

### `warden-panel/`

Package `@nekwebdev/warden-panel`. Owns Warden panel framework, `/warden`, `/warden:display`, `/warden:packages`, public pane/action/display registries, safe Warden settings writes, and Packages pane install/remove/update behavior.

### `warden-flow/`

Package `@nekwebdev/warden-flow`. Owns `/skill:warden-map`, `/skill:warden-docs`, `/skill:warden-create-skill`, `/skill:warden-start`, `/skill:warden-grill`, `/skill:warden-tdd`, `/skill:warden-close`, `/skill:warden-commit`, `warden_branch_close`, map/git injection, packet tracking, safe commit snapshot/apply tools, effort defaults/runtime, and Effort/Display contributions.

### `warden-subagents/`

Package `@nekwebdev/warden-subagents`. Owns `Agent` and `get_subagent_result` tools, foreground/background subagent runner, agent-type registry, custom agents, explicit memory prompt extras, worktree isolation, one-shot scheduling, package-local RPC/events, activity UI, notifications, and read-only Subagents pane. It does not own `warden agents ...`, `warden pi ...`, shell integration, or runner lifecycle.

### `warden-theme/`

Package `@nekwebdev/warden-theme`. Owns `themes/warden-catppuccin-mocha.json`, Catppuccin Mocha palette/token inventory docs, and theme validation. It does not own runner lifecycle or terminal probing.

### `warden-web/`

Package `@nekwebdev/warden-web`. Owns Warden's local web server package and future mobile-first browser UI for Warden-managed Pi agents. Runner dispatch shims remain narrow cross-boundary integration points.

## Verification for This Scope

Primary: `mise run test:pi-warden`.

Focused package checks: `npm test --prefix pi-warden/warden-panel`, `warden-flow`, `warden-subagents`, or `warden-theme`. Install package deps first when missing. Run `npm pack --dry-run --prefix pi-warden/warden-subagents` for subagents manifest/publish-list changes.

## Safe Edit Notes

- Do not put `package.json`, TypeScript source, Pi resource assets, package scripts, or package tests directly in `pi-warden/` root.
- Do not mutate root `./warden` or `run-warden/` from package work unless task explicitly scopes a cross-boundary contract.
- Keep package-area smoke tests aligned with package list and removed/folded package state.
- Preserve package MIT license files and package manifests.
- Do not add active task state, implementation diaries, or TODO forests to package READMEs, AGENTS, or maps.

## Recent Evolution from Git History

Recent history expanded the package area beyond `warden-panel` and `warden-flow` into `fresh-skill`, `warden-subagents`, `warden-theme`, and `warden-web`. `warden-subagents` developed registry, foreground/background Agent, activity UI, read-only pane, memory prompts, worktree isolation, one-shot scheduling, and event-bus RPC. `warden-theme` was added and switched to Catppuccin Mocha resources. `warden-panel` added tagged package update behavior. `warden-flow` added `warden-create-skill`, branch-aware/auto workflow directives, post-close branch-close handoff, `warden_branch_close`, packet tracking, and strengthened commit-plan/apply safety.

## Open Questions

- Future package release/build workflow is not documented beyond current npm manifests, lockfiles, and tests.
- `nix-warden/` and `dev-warden/` are outside this package area and remain skeleton boundaries.
