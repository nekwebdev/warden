# Warden Map: run-warden

Reviewed: 2026-06-10
Scope: run-warden
Evidence basis: `run-warden/AGENTS.md`; `run-warden/README.md`; `bin/warden`; `lib/*.sh`; `shell/`; `templates/`; `tests/warden.bats`; bounded git history.
Git basis: main@6ebda02
Parent map: .warden/map.md

<!-- warden-map:inject:start -->
## Agent Quick Context

- Purpose: `run-warden/` owns Warden command workflows after root `./warden` delegates through mise to `run-warden/bin/warden`.
- Boundaries: Keep dispatch in `bin/warden`, reusable POSIX shell behavior in `lib/*.sh`, shell snippets in `shell/`, templates in `templates/`, and Bats in `tests/`. Pi package implementation stays in `pi-warden/<package>/`.
- Safe edits: Preserve consent gates, reversible shell integration, isolated Pi installs/updates, `PI_CODING_AGENT_DIR`/`PILENS_DATA_DIR`/`CONTEXT_MODE_DIR` inside agent dirs, flattened `warden.agent.cwd`, unknown settings, and name-first agent command forms.
- Verification: Run `mise run test:run-warden`; also run `mise run test:root` when root delegation/bootstrap contracts are touched.
- Sharp edges: `warden worktree AGENT` can add `origin`, fetch `origin/main`, create and push branches after prompts. Agent names reject reserved/unsafe values. `HOME`, `WARDEN_HOME`, `WARDEN_AGENTS`, `XDG_CONFIG_HOME`, tmux, npm, mise, and git affect behavior.
<!-- warden-map:inject:end -->

## Scope Purpose

`run-warden/` is Warden's delegated CLI and shell-workflow implementation boundary. Root bootstrap reaches this scope after choosing/normalizing `WARDEN_HOME`, ensuring mise, and exporting `run-warden/bin` on `PATH`.

Maps are orientation only and do not override repo or local `AGENTS.md` instructions.

## Local Structure

| Path | Role | Notes |
|---|---|---|
| `bin/warden` | Delegated CLI | Sources libs and dispatches final command forms. |
| `lib/welcome.sh` | Welcome output | Prints Warden paths and next steps. |
| `lib/doctor.sh` | Readiness checks | Checks home, mise, runner, shell integration, and Pi agent hints. |
| `lib/shell-integration.sh` | Shell integration | Owns status/install/remove/init and consent prompts. |
| `lib/pi-agents.sh` | Pi agent lifecycle | Creates/updates agents, validates names, writes cwd settings, launches local Pi. |
| `lib/worktree.sh` | Agent worktree launcher | Lists existing Git worktrees and can create/push new branch worktrees for an agent. |
| `shell/bash.sh`, `shell/zsh.sh`, `shell/fish.fish` | Activation snippets | Installed or printed by shell integration. |
| `templates/AGENTS-template.md` | Agent guidance template | Seeded into fresh Pi agent environments with agent-name substitution only. |
| `tests/warden.bats` | Runner Bats suite | Uses temp HOME/fake npm/fake mise/fake Pi fixtures. |
| `README.md`, `AGENTS.md` | Scope docs/guidance | Read before edits in this scope. |

## Local Entry Points

`run-warden/bin/warden` dispatches:

- `welcome`, `help`, and `doctor`.
- `shell status`, `shell install`, `shell remove`, and `shell init bash|zsh|fish`.
- `agents new [NAME]` to create an isolated Pi agent environment and install the Pi runtime locally.
- `agents list [--json]` to list agent environments.
- `agents NAME update-pi` to update Warden-managed Pi runtime inside an existing agent.
- `agents NAME cwd DIR` to write the launch cwd to `settings.json` at `warden.agent.cwd`.
- `agents NAME show [--json]` to show agent paths, effective cwd, and settings.
- `pi NAME [ARGS...]` to run agent-local Pi with environment variables pointed inside the agent dir.
- `@NAME [ARGS...]` as direct alias for `pi NAME [ARGS...]`.
- `worktree AGENT` to select or create a Git worktree, then launch Pi from that worktree without changing stored cwd.

Removed or unsupported command forms should fail through normal usage/unsupported-command behavior; do not revive older `agents set/unset/update NAME` forms without explicit scope.

## Local Conventions

- POSIX shell is the implementation baseline; entry scripts use `set -eu`.
- `warden_fail` prints `warden: ...` and exits nonzero.
- Command dispatch stays in `bin/warden`; reusable behavior belongs in `lib/*.sh`.
- Shell integration must stay reversible. Bash/zsh use exact `# warden begin` / `# warden end` blocks; fish uses managed Warden files.
- Per-agent cwd is canonical only at `warden.agent.cwd` and must be existing absolute path or `~` path when set.
- JSON writes use embedded Node helpers to preserve unknown root keys and unknown Warden/Pi settings.
- Agent launch in tmux may rename the current window to `󱚤 NAME`, then restore previous name and automatic rename setting; missing/failing tmux commands are ignored.

## Dependencies and Integration Points

- Root `./warden` sets `WARDEN_HOME` and delegates here through `mise exec`.
- Agent creation/update calls npm to install `@earendil-works/pi-coding-agent@latest` under an agent-local npm prefix with local cache/user/global config files.
- `warden pi` exports `PI_CODING_AGENT_DIR`, `PILENS_DATA_DIR=$PI_CODING_AGENT_DIR/pi-lens`, and `CONTEXT_MODE_DIR=$PI_CODING_AGENT_DIR/context-mode` before running agent-local Pi.
- Shell snippets source files from `$WARDEN_HOME/run-warden/shell/`.
- `warden worktree` depends on git worktree commands, an agent configured cwd, and remote `origin/main` for new worktrees. If `origin` is missing, it prompts for a Git URL.
- Fresh `warden agents new` copies `templates/AGENTS-template.md` into the agent environment and substitutes only the agent name.

## Verification for This Scope

Primary:

- `mise run test:run-warden`

Broader checks when root bootstrap, delegation, or shell integration contracts are touched:

- `mise run test:root`
- `mise run test`

Tests should use temp directories, fake npm/mise/Pi executables, and isolated agent dirs. Never write tests that mutate a real home directory or real shell startup file.

## Safe Edit Notes

- Add Bats coverage for new command surfaces, new prompt behavior, or path safety rules.
- Preserve consent before shell startup-file mutation, external installers, repo moves, adding `origin`, or other invasive actions.
- Non-TTY or declined prompts must fail or skip cleanly unless explicit opt-in says otherwise.
- Never overwrite unmanaged shell files, existing unrelated agent dirs, unrelated settings keys, or unrelated worktree paths.
- Keep Pi package behavior out of runner libraries; runner owns lifecycle/plumbing, not package internals.
- Keep worktree name validation strict: lowercase letters/numbers with single hyphens, no spaces/slashes/underscores/uppercase or repeated/edge hyphens.

## Recent Evolution from Git History

Recent commits finalized name-first agent command forms, direct `@NAME` launch parity, and removed old forms from docs/tests. Runner now seeds fresh Pi agent environments with `AGENTS.md`, points context-mode storage inside each agent dir, and includes `warden worktree AGENT` for existing/new worktree launch. New worktree flow creates `${type}/${name}` from `origin/main`, pushes upstream, and launches without rewriting agent settings.

## Open Questions

No open runner architecture question found in current docs. Future command surfaces should remain small, consent-aware, and Bats-covered.
