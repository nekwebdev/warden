# Warden Map: run-warden

Reviewed: 2026-06-06
Scope: run-warden
Evidence basis: `run-warden/AGENTS.md`, `run-warden/README.md`, `bin/warden`, `lib/*.sh`, `shell/`, `tests/warden.bats`, bounded git history.
Git basis: main@02fb384
Parent map: .warden/map.md

<!-- warden-map:inject:start -->
## Agent Quick Context

- Purpose: `run-warden/` owns Warden command workflows after root `./warden` delegates through mise to `run-warden/bin/warden`.
- Boundaries: Keep dispatch in `bin/warden`, shared behavior in `lib/*.sh`, shell snippets in `shell/`, and Bats in `tests/`. Pi package behavior stays in `pi-warden/<package>/`.
- Safe edits: Preserve consent gates for shell startup-file mutation, reversible bash/zsh guarded blocks, managed fish files, isolated Pi agent installs/updates, flattened `warden.agent.cwd`, and unknown agent settings. Prefer small POSIX shell changes.
- Verification: Run `mise run test:run-warden`; for root delegation interactions also run `mise run test:root` or full `mise run test`.
- Sharp edges: `warden pi <name>` may create missing agents only after confirmation. `warden pi <name> update` uses Warden-managed runtime update, not Pi global self-updater. Agent names reject `/`, `.`, `..`, empty, and unsupported chars. `WARDEN_HOME`, `WARDEN_AGENTS`, `XDG_CONFIG_HOME`, and `HOME` affect paths.
<!-- warden-map:inject:end -->

## Scope Purpose

`run-warden/` is Warden's delegated runner and command implementation boundary. Root bootstrap reaches this scope after resolving `WARDEN_HOME`, ensuring mise, and exporting `run-warden/bin` on `PATH`.

## Local Structure

| Path | Role | Notes |
|---|---|---|
| `bin/warden` | Delegated CLI | Sources libs and dispatches commands. |
| `lib/welcome.sh` | Welcome output | Prints WARDEN_HOME, NixOS config path, and next steps. |
| `lib/doctor.sh` | Readiness checks | Checks WARDEN_HOME, mise, runner, shell integration, Pi agent hints. |
| `lib/shell-integration.sh` | Shell install/status/remove/snippet | Owns bash/zsh/fish mutation safety and consent prompts. |
| `lib/pi-agents.sh` | Pi agent lifecycle | Creates/updates isolated agents, stores cwd settings, launches local Pi. |
| `shell/bash.sh`, `shell/zsh.sh`, `shell/fish.fish` | Activation snippets | Added or printed by shell integration. |
| `tests/warden.bats` | Runner Bats suite | Uses temp HOME/fake npm/fake mise fixtures. |
| `README.md`, `AGENTS.md` | Scope docs/guidance | Must be read before edits in this scope. |

## Local Entry Points

- `run-warden/bin/warden welcome` prints welcome.
- `run-warden/bin/warden doctor` runs readiness checks.
- `run-warden/bin/warden agents new [NAME]` creates isolated Pi agent environment and local npm install.
- `run-warden/bin/warden agents update NAME` updates an existing Warden-managed Pi runtime.
- `run-warden/bin/warden agents set NAME cwd DIR`, `unset`, `show [--json]`, and `list [--json]` manage agent-local settings.
- `run-warden/bin/warden pi NAME [ARGS...]` launches agent-local Pi with cwd settings applied.
- `run-warden/bin/warden pi NAME update` updates Pi packages first, then runs Warden-managed runtime update instead of Pi global self-updater.
- `run-warden/bin/warden shell status|install|remove|snippet SHELL` manages shell integration.
- `run-warden/bin/warden help` prints command help.

## Local Conventions

- POSIX shell with `set -eu` in entry scripts.
- `warden_fail` prints `warden: ...` and exits nonzero.
- Reusable logic belongs in `lib/*.sh`; command dispatch stays thin in `bin/warden`.
- Shell integration must be reversible. Bash/zsh use exact `# warden begin` / `# warden end` blocks; fish files contain `# warden fish ...` markers.
- Agent JSON changes go through embedded Node helpers to preserve unrelated settings and validate shapes. Per-agent cwd is canonical only at `warden.agent.cwd`.

## Dependencies and Integration Points

- Root `./warden` sets `WARDEN_HOME` and delegates here via `mise exec`.
- Agent creation/update calls npm to install `@earendil-works/pi-coding-agent` under `$WARDEN_AGENTS/<name>/npm` with local cache/user/global config files.
- `warden pi` sets `PI_CODING_AGENT_DIR` and `PILENS_DATA_DIR` inside selected agent dir before `exec`ing local Pi.
- Shell snippets source files from `$WARDEN_HOME/run-warden/shell/`.

## Verification for This Scope

Primary:

- `mise run test:run-warden`

Broader checks when root bootstrap or shell integration behavior is touched:

- `mise run test:root`
- `mise run test`

Tests use temp directories, fake `npm`, fake `mise`, and fake Pi executable scripts. Avoid tests that mutate real home directories.

## Safe Edit Notes

- Add Bats coverage for every new command surface.
- Keep consent before startup-file mutation. Non-TTY or declined prompts must fail or skip cleanly.
- Never overwrite unmanaged shell files or existing unrelated agent directories.
- Preserve cwd validation: cwd must be existing absolute path or `~` path.
- Preserve JSON shape validation and unknown settings keys.
- Keep package implementation out of runner shell libraries.

## Recent Evolution from Git History

Recent history shows this scope active since bootstrap groundwork. Notable changes: delegated runner renamed to `run-warden/bin/warden`, shell integration install flow improved, Pi agent environments added, agent settings commands added, tmux window handling added for Pi launch, and Warden-managed Pi runtime update behavior added.

## Open Questions

No open runner architecture questions found in current docs. Future command surfaces should remain small and covered by Bats.
