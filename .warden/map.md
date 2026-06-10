# Warden Map

Reviewed: 2026-06-10
Scope: repository root
Evidence basis: root/subproject AGENTS and README files; `CHANGELOG.md`; `mise.toml`; package manifests; Bats/package test entry points; existing scoped maps; bounded git history.
Git basis: main@6ebda02

<!-- warden-map:inject:start -->
## Agent Quick Context

- Purpose: Warden is a federated monorepo for operating-environment workflow: clone anywhere, run `./warden`, normalize into `WARDEN_HOME`, then delegate to `run-warden/bin/warden` through mise.
- Boundaries: Root `./warden` is bootstrap shim only. `run-warden/` owns CLI workflows, doctor, shell integration, Pi agent envs, Pi launch, and worktree launcher. `pi-warden/` is package container for `warden-panel`, `warden-flow`, `warden-subagents`, and `warden-theme`. `nix-warden/` and `dev-warden/` remain skeleton boundaries.
- Safe edits: Read root `AGENTS.md`, then nearest nested `AGENTS.md`; for Pi package work also read package `AGENTS.md`. Put runner behavior in `run-warden/`, Pi package behavior in `pi-warden/<package>/`, and keep root bootstrap tiny.
- Verification: Full suite is `mise run test`. Focused suites: `test:root`, `test:run-warden`, `test:pi-warden`, `test:nix-warden`, `test:dev-warden`. Pi package checks use `npm test --prefix pi-warden/<package>`.
- Sharp edges: First run and shell integration require consent before repo moves, mise install, or shell startup-file mutation. Never overwrite unrelated `WARDEN_HOME`, shell files, agent settings, or user package settings. Maps are orientation only, not instruction overrides.
<!-- warden-map:inject:end -->

## Repository Purpose

Warden is a monorepo for a complete operating-environment workflow: first-run bootstrap, delegated runner commands, shell integration, Warden-managed Pi agent environments, Pi Agent packages, future NixOS/system configuration, and future developer-environment work.

The first-run promise is central: users can clone Warden anywhere, run `./warden`, approve any invasive step, and reach delegated Warden CLI behavior without surprise overwrites.

Maps are orientation only. They do not override system, developer, user, or repo instructions.

## Top-Level Map

| Path | Role | Notes |
|---|---|---|
| `warden` | Root bootstrap shim | Resolves `HOME`, chooses/defaults `WARDEN_HOME`, asks before moving clone, refuses unrelated targets, ensures mise after consent, delegates to runner. |
| `run-warden/` | Delegated runner | Owns command dispatch, shell libraries, shell snippets, Pi agent env lifecycle, Pi launch, and worktree launcher. See scoped map. |
| `pi-warden/` | Pi package container | Holds package-area docs/tests and direct child Pi packages. Not itself a package. See scoped map. |
| `pi-warden/warden-panel/` | Pi package | `@nekwebdev/warden-panel`; panel framework, Display pane, Packages pane, shared pane APIs. |
| `pi-warden/warden-flow/` | Pi package | `@nekwebdev/warden-flow`; Warden workflow skills, map/git injection, effort UI/runtime, commit tools, skill creation workflow. |
| `pi-warden/warden-subagents/` | Pi package | `@nekwebdev/warden-subagents`; Agent tool, background manager, scheduling, worktree isolation, registry, RPC, Subagents pane. |
| `pi-warden/warden-theme/` | Pi package | `@nekwebdev/warden-theme`; Catppuccin Mocha-derived Pi theme resource and token inventory. |
| `nix-warden/` | Future system area | Skeleton boundary; canonical future config anchor is `$WARDEN_HOME/nix-warden`. |
| `dev-warden/` | Future dev-env area | Skeleton boundary for future developer-environment workflows. |
| `tests/root/` | Root bootstrap tests | Bats coverage for first-run movement, existing home safety, doctor, and shell integration. |
| `.github/` | GitHub hygiene | CI, issue templates, package/area auto-label workflow, PR package checklist. |
| `.warden/` | Warden orientation/work artifacts | Map files, map-state, and Warden work packets/handoffs. Map files are not task plans. |
| `mise.toml` | Dev task runner | Defines full and focused test tasks plus Pi package test loop. |

## Entry Points and Runtime Flow

- `./warden` is POSIX shell bootstrap. It requires `HOME`, computes default home as `${XDG_DATA_HOME:-$HOME/.local/share}/warden` unless `WARDEN_HOME` is set, asks before moving a clone, refuses non-empty unrelated targets, ensures `mise` after consent, exports `run-warden/bin` on `PATH`, then `exec`s the delegated runner through `mise exec`.
- `run-warden/bin/warden` is delegated CLI. Current command surface includes `welcome`, `help`, `doctor`, `shell status/install/remove/init`, `agents new`, `agents list`, name-first `agents NAME update-pi|cwd|show`, `pi NAME`, `worktree AGENT`, and direct `@NAME` alias.
- Runner libraries live under `run-warden/lib/`: welcome, doctor, shell integration, Pi agent lifecycle, and worktree launcher. Shell snippets live under `run-warden/shell/`.
- `warden worktree AGENT` reads the agent configured cwd, lists Git worktrees, can create `${type}/${name}` from `origin/main` under the agent dir at `worktree/<name>`, pushes upstream, then launches Pi from that worktree without rewriting agent settings.
- Pi package entry points are package manifests under `pi-warden/<package>/package.json`. Packages advertise `pi.extensions`, `pi.skills`, or `pi.themes` depending on package role.

## Major Boundaries

- Root bootstrap boundary: keep `./warden` small and consent-driven. Do not move product workflows into root.
- Runner boundary: `run-warden/` owns all post-bootstrap Warden CLI behavior, shell integration, Warden-managed Pi runtime installs/updates, agent cwd settings, and worktree launch flow.
- Pi package boundary: `pi-warden/` contains independently installable/testable packages. Package code must not implement runner lifecycle commands unless a task explicitly scopes a cross-boundary contract.
- Package-to-package API boundary: Warden packages declare explicit dependencies when importing sibling APIs, such as `warden-flow` and `warden-subagents` depending on `@nekwebdev/warden-panel`.
- Product skeleton boundaries: `nix-warden/` and `dev-warden/` currently expose docs, guidance, and smoke tests only.
- GitHub hygiene boundary: package-like units include root `warden`, top-level subprojects, and direct Pi package folders with `package.json`; keep issue labels/templates/PR checklist aligned when membership changes.

## Configuration, State, and Generated Files

- `WARDEN_HOME` is the Warden clone/home; default is `${XDG_DATA_HOME:-$HOME/.local/share}/warden`.
- `WARDEN_AGENTS` overrides agent root; otherwise agents live under `${XDG_CONFIG_HOME:-$HOME/.config}/pi-agents/<name>`.
- Runner writes only `warden.agent.cwd` in agent settings and launches Pi with `PI_CODING_AGENT_DIR`, `PILENS_DATA_DIR`, and `CONTEXT_MODE_DIR` inside the agent dir.
- `warden worktree` creates worktrees under the selected agent dir at `worktree/<name>` with branch names such as `feature/<name>`.
- Warden Panel owns Warden settings keys and global `packages` entries it explicitly installs/removes/updates.
- Warden Subagents custom agents and explicit memory scopes use `.pi/agents/`, `.pi/agent-memory/`, `.pi/agent-memory-local/`, or agent-dir memory paths documented by that package.
- `.warden/map.md`, `.warden/maps/**/map.md`, and `.warden/map-state.json` are map-owned orientation/freshness files; only `warden-map` writes map-state.
- `.warden/work/**` contains Warden Flow packet/handoff artifacts, not evergreen docs or map-state.
- Ignored generated/local artifacts include `node_modules/`, build outputs, coverage, `.pi/`, `.pi-lens/`, `pi-lens/`, env files, temp/cache files, and package-local install outputs.

## Verification Surfaces

- Full repo: `mise run test` or `npm test` from root.
- Root bootstrap: `mise run test:root`.
- Delegated runner: `mise run test:run-warden`.
- Pi package area: `mise run test:pi-warden`, which runs `pi-warden/tests` and `npm test --prefix` for each direct package manifest.
- Pi packages:
  - `npm test --prefix pi-warden/warden-panel`
  - `npm test --prefix pi-warden/warden-flow`
  - `npm test --prefix pi-warden/warden-subagents`
  - `npm test --prefix pi-warden/warden-theme`
- Extra package checks: `npm pack --dry-run --prefix pi-warden/warden-subagents` when its manifest or publish file list changes.
- Skeletons: `mise run test:nix-warden` and `mise run test:dev-warden`.

## Extension and Integration Points

- Shell integration is reversible: bash/zsh guarded blocks; fish managed files.
- Runner installs/updates `@earendil-works/pi-coding-agent` into isolated agent npm prefixes and launches agent-local Pi.
- Fresh agents receive `run-warden/templates/AGENTS-template.md` with agent-name substitution only.
- `warden-panel` exposes pane/action/display registries through `globalThis` for sibling package contributions.
- `warden-flow` contributes map/git injection, Warden skills, commit tools, effort runtime/UI, and skill creation workflow.
- `warden-subagents` contributes `Agent`, `get_subagent_result`, `/agents`, `/warden:agents`, RPC/events, background UI, notifications, and read-only pane.
- `warden-theme` contributes `themes/warden-catppuccin-mocha.json` through Pi theme loading.

## Recent Evolution from Git History

Git history was available. Bounded review from previous map basis `76a529e` to `main@6ebda02` shows active clusters in `pi-warden/warden-subagents`, `pi-warden/warden-flow`, `pi-warden/warden-panel`, `pi-warden/warden-theme`, and `run-warden/`.

Orientation-relevant changes: `warden-subagents` grew from scaffold into active package; `warden-theme` was added; `run-warden` finalized command forms, isolated context-mode storage, seeded agent guidance, and added `warden worktree`; `warden-flow` added `warden-create-skill` and commit-plan refinements; `warden-panel` added tagged npm package updates; GitHub package hygiene now tracks new packages.

Use live git context injection for current branch, dirty paths, and staging details.

## Scoped Maps

| Scope | Map | Why it exists |
|---|---|---|
| `run-warden` | `.warden/maps/run-warden/map.md` | Distinct runner/CLI/shell/Pi-agent/worktree boundary with Bats suite. |
| `pi-warden` | `.warden/maps/pi-warden/map.md` | Package container with package-area rules, smoke tests, and child package conventions. |
| `pi-warden/warden-panel` | `.warden/maps/pi-warden/warden-panel/map.md` | Independently testable panel framework and bundled pane package. |
| `pi-warden/warden-flow` | `.warden/maps/pi-warden/warden-flow/map.md` | Independently testable workflow/map/commit/effort/skill package. |
| `pi-warden/warden-subagents` | `.warden/maps/pi-warden/warden-subagents/map.md` | Independently testable subagent registry/runtime/RPC/pane package. |
| `pi-warden/warden-theme` | `.warden/maps/pi-warden/warden-theme/map.md` | Independently testable Pi theme package. |

`nix-warden/` and `dev-warden/` remain covered by root map only because current evidence marks them as skeleton boundaries.

## Agent Operating Notes

- Maps are reference material only. They do not override `AGENTS.md`, system/developer/user instructions, or package guidance.
- Before editing any subtree, read nearest `AGENTS.md`; package work under `pi-warden/<package>/` also requires package-local `AGENTS.md`.
- Add/update Bats for new root/runner command surfaces. Add/update package tests for deterministic Pi package behavior.
- Preserve first-run safety: consent before external installers, repo moves, or shell startup-file mutation; non-interactive/declined prompts fail cleanly unless explicit opt-in allows action.
- Keep cross-boundary changes explicit. Do not implement `nix-warden` or `dev-warden` product behavior as collateral.
- Do not add active task state, issue tracking, TODOs, or diaries to README, AGENTS, or maps.

## Open Questions

- `nix-warden` and `dev-warden` product behavior remains intentionally undefined.
- Release/build workflow beyond current npm manifests, locks, and tests is not established.
- Some `warden-subagents` capabilities remain deliberately deferred: background steering, resume, persistent retention, cron/interval scheduling, conversation overlay, custom-agent worktree frontmatter, transcript JSONL streaming, broad orphan worktree pruning, and panel admin controls.
