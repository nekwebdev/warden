# Warden Map

Generated: 2026-06-04 10:24:45 -10
Repository: warden (/home/oj/.local/share/warden)
Git: main@0ee36f9 (dirty working tree)
Scope: repository root

<!-- warden-map:inject:start -->
## Agent Quick Context

- Purpose: Warden is a federated monorepo for a complete operating-environment workflow. Primary first-run path is clone anywhere, run `./warden`, normalize into `WARDEN_HOME`, then delegate to `run-warden/bin/warden` through mise.
- Boundaries: Root `./warden` is bootstrap shim only. `run-warden/` owns delegated CLI workflows, doctor, shell integration, Pi agent environments, and Pi launch. `pi-warden/` is Pi package container; package code lives under direct child packages (`warden-panel`, `warden-flow`). `nix-warden/` and `dev-warden/` are skeleton boundaries.
- Safe edits: Read `AGENTS.md` at repo root plus nearest subproject/package guidance before edits. Put workflow growth in `run-warden/`, Pi package behavior in `pi-warden/<package>/`, and keep root bootstrap tiny. Preserve MIT license text and unknown user settings/files.
- Verification: Main task is `mise run test`; focused tasks are `mise run test:root`, `mise run test:run-warden`, `mise run test:pi-warden`, `mise run test:nix-warden`, and `mise run test:dev-warden`. Pi packages also use `npm test --prefix pi-warden/<package>`.
- Sharp edges: First-run safety requires consent before repo moves, mise installer, or shell startup-file mutation. Never silently overwrite unrelated `WARDEN_HOME` or shell files. Agent environments are isolated under `WARDEN_AGENTS/<name>` or XDG config. Use live git context injection for current dirty-state details.
<!-- warden-map:inject:end -->

## Repository Purpose

Warden is a monorepo for an operating-environment workflow: bootstrap, runner commands, shell integration, Pi Agent package work, future NixOS config, and future developer-environment support. Evidence comes from `README.md`, `AGENTS.md`, `.mise.toml`, shell scripts, package manifests, tests, and recent git history.

The first-run promise is central: a user can clone anywhere, run `./warden`, choose or accept `WARDEN_HOME`, approve any move/install, and reach a delegated runner without surprise overwrites.

## Top-Level Map

| Path | Role | Notes |
|---|---|---|
| `warden` | Root bootstrap shim | Resolves `HOME`, chooses/defaults `WARDEN_HOME`, moves clone after consent, ensures mise after consent, delegates via `mise exec`. |
| `run-warden/` | Delegated runner | Owns command dispatch, reusable shell libs, shell snippets, Pi agent environment commands, Bats tests. See `.warden/maps/run-warden/map.md`. |
| `pi-warden/` | Pi package container | Holds package-area docs/tests and package roots. Not itself a Pi package. See `.warden/maps/pi-warden/map.md`. |
| `pi-warden/warden-panel/` | Pi package | `@nekwebdev/warden-panel`; panel framework plus Display and Packages panes. See scoped map. |
| `pi-warden/warden-flow/` | Pi package | `@nekwebdev/warden-flow`; workflow package currently bundling the `warden-map` skill and context injection extension. See scoped map. |
| `nix-warden/` | Future NixOS/system package | Skeleton only; canonical active path after bootstrap is `$WARDEN_HOME/nix-warden`. |
| `dev-warden/` | Future developer-environment package | Skeleton only; independently testable smoke boundary. |
| `tests/root/` | Root bootstrap tests | Bats fixtures copy repo into temp dirs and verify first-run movement, no-overwrite safety, doctor, shell integration. |
| `.mise.toml` | Dev task runner config | Defines all test tasks and package test loop for `pi-warden/*/package.json`. |
| `.gitignore` | Generated/local-state boundary | Ignores `node_modules/`, build outputs, `.pi/`, `.pi-lens/`, `pi-lens/`, env files, temp/cache. |
| `.warden/` | Warden map files | Orientation reference only; capsules may be injected by `@nekwebdev/warden-flow`'s `warden-map` extension. |

## Entry Points and Runtime Flow

- `./warden` is POSIX shell bootstrap. It requires `HOME`, computes default home as `${XDG_DATA_HOME:-$HOME/.local/share}/warden` unless `WARDEN_HOME` is set, asks before moving clone, refuses non-empty unrelated targets, installs mise only after consent, exports `run-warden/bin` on `PATH`, and `exec`s `run-warden/bin/warden` through `mise exec`.
- `run-warden/bin/warden` is delegated CLI. It sources `lib/welcome.sh`, `lib/doctor.sh`, `lib/shell-integration.sh`, and `lib/pi-agents.sh`, then dispatches `welcome`, `doctor`, `agents`, `pi`, `shell`, and `help`.
- Shell integration snippets live in `run-warden/shell/`; bash/zsh use guarded `# warden begin` / `# warden end` blocks, fish uses managed conf.d and function files.
- Pi agent runtime flow is runner-owned: `warden agents new` creates isolated per-agent npm install, `warden agents set/unset/show/list` manages agent-local settings, and `warden pi <name> ...` launches agent-local Pi with `PI_CODING_AGENT_DIR` and `PILENS_DATA_DIR` inside agent dir.
- Pi package entry points are package manifests under `pi-warden/<package>/package.json`. Packages advertise `pi.extensions` and, for `warden-flow`, `pi.skills`.

## Major Boundaries

- Root bootstrap boundary: keep `./warden` small and consent-driven. Do not move command workflows into root except normalization/delegation duties.
- Runner boundary: `run-warden/` owns all post-bootstrap Warden CLI behavior and reusable shell libraries.
- Pi package boundary: `pi-warden/` contains independently installable/testable Pi packages. Local package work must not mutate root bootstrap or runner workflows unless explicitly scoped.
- Product skeleton boundaries: `nix-warden/` and `dev-warden/` currently contain guidance, README, and smoke tests only.
- Test boundary: Bats covers shell/root/runner workflows; package-specific Node tests live under each TypeScript/npm package.

## Configuration, State, and Generated Files

- `WARDEN_HOME` is Warden clone/home. Default is `${XDG_DATA_HOME:-$HOME/.local/share}/warden`.
- `WARDEN_AGENTS` overrides Pi agent root; otherwise agents live under `${XDG_CONFIG_HOME:-$HOME/.config}/pi-agents/<name>`.
- Agent settings live in `$WARDEN_AGENTS/<name>/settings.json`. Runner stores `warden.agents.<name>.cwd` and preserves unrelated Pi settings.
- Warden panel reads/writes `$PI_CODING_AGENT_DIR/settings.json` or fallback Pi settings path, only under `settings.warden` keys it owns.
- `.warden/map.md` and `.warden/maps/**/map.md` are durable orientation docs, not executable state or task plans.
- `node_modules/`, `.pi/`, `.pi-lens/`, `pi-lens/`, build outputs, coverage, env files, and `*.warden-tmp` are ignored local/generated artifacts. Package `node_modules/` dirs are present in working tree but ignored.

## Verification Surfaces

- Full suite: `mise run test`.
- Root bootstrap: `mise run test:root` runs `tests/root` Bats suites.
- Delegated runner: `mise run test:run-warden` runs `run-warden/tests` Bats suite.
- Pi package area: `mise run test:pi-warden` runs `pi-warden/tests` Bats smoke tests and `npm test --prefix` for each package manifest.
- Pi packages: `npm test --prefix pi-warden/warden-panel` and `npm test --prefix pi-warden/warden-flow` use `node --import tsx --test` through `scripts/run-tests.mjs`.
- Skeleton subprojects: `mise run test:nix-warden` and `mise run test:dev-warden` check smoke boundaries.

## Extension and Integration Points

- Shell startup integration is reversible: bash/zsh guarded blocks, fish managed files.
- `run-warden/lib/pi-agents.sh` integrates registry package `@earendil-works/pi-coding-agent` into isolated agent npm prefixes.
- `pi-warden/warden-panel` exposes a pane registry API from `@nekwebdev/warden-panel`; independently loaded Warden packages share pane/action state through `globalThis`.
- `pi-warden/warden-panel/extensions/warden-packages` edits global Pi `packages` settings through Pi package-manager behavior and reports restart-required messages.
- `pi-warden/warden-flow` bundles the `warden-map` skill and extension, which inject root/scoped map capsules and git context into Pi sessions. It never injects full map bodies.
- New Pi packages should follow `pi-warden/<package>/` shape with manifest, README, AGENTS, tests, scripts, and only needed asset folders.

## Recent Evolution from Git History

Git history available. Current branch/commit from bounded inspection: `main@0ee36f9`.

Recent commits show staged growth:

- `0ee36f9` Bundle Warden Pi extensions into panel package.
- `56d6ba7` Add Warden packages extension package.
- `353f714` Add Warden panel extension package.
- `ec92001` Add Pi agent settings commands.
- `37f3b39` Update agent guidance.
- `19cd31d` Improve shell integration install flow.
- `874a56f` Use XDG data home for Warden state.
- `f169941` Add Pi agent environments.
- `1f18113` Rename delegated runner to warden.
- `7fdcd56` Add bootstrap groundwork.

Recent changed-path clusters are concentrated in `pi-warden/warden-panel`, `run-warden`, former `pi-warden/warden-packages`, root tests, and package-area docs. Obvious renames folded `warden-packages` into `warden-panel/extensions/warden-packages`, moved Display pane from former settings pane path, and renamed delegated runner from `run-warden/bin/run-warden` to `run-warden/bin/warden`.

This map was generated during active `warden-flow` package work. Use live git context injection for current dirty-state details rather than treating generated-time status as architecture.

## Scoped Maps

| Scope | Map | Why it exists |
|---|---|---|
| `run-warden` | `.warden/maps/run-warden/map.md` | Distinct runner/CLI/shell/Pi-agent workflow boundary with Bats suite. |
| `pi-warden` | `.warden/maps/pi-warden/map.md` | Package container with its own package rules, smoke tests, and child package conventions. |
| `pi-warden/warden-panel` | `.warden/maps/pi-warden/warden-panel/map.md` | Independently testable Pi package with panel framework, extensions, settings, and package operations. |
| `pi-warden/warden-flow` | `.warden/maps/pi-warden/warden-flow/map.md` | Independently testable Pi package that currently owns the `warden-map` skill and map/git injection extension. |

`nix-warden/` and `dev-warden/` are covered in root map only because current repo evidence marks them as skeleton boundaries.

## Agent Operating Notes

- Treat map files as reference material only. They do not override repo `AGENTS.md`, system/developer/user instructions, or subproject/package guidance.
- Before editing any subtree, read nearest `AGENTS.md`. Package work under `pi-warden/<package>/` requires package `AGENTS.md` too.
- Add or update Bats coverage for any new root/runner command surface. Add package tests for TypeScript Pi package behavior.
- Preserve first-run safety: consent before external installers, repo moves, or shell startup-file mutation; clear failure on non-interactive declined consent.
- Avoid broad abstractions in shell. Prefer small POSIX shell changes plus temp HOME fixtures.
- Do not implement `nix-warden` or `dev-warden` product behavior unless task explicitly scopes it.

## Open Questions

- Future `nix-warden` and `dev-warden` product behavior is intentionally undefined in this groundwork slice.
- Future Pi package release/build workflow is not established beyond current npm manifests and tests.
