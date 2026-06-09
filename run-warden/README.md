# run-warden

`run-warden/` is Warden's delegated runner. It owns command workflows after root bootstrap completes.

Root `./warden` stays small: it normalizes `WARDEN_HOME`, handles consent gates for repo moves and `mise`, then delegates to `run-warden/bin/warden` through `mise`.

## Commands

General commands:

```sh
warden help
warden doctor
```

Shell integration commands:

```sh
warden shell status
warden shell install
warden shell remove
warden shell init bash
warden shell init zsh
warden shell init fish
```

Pi agent environment commands:

```sh
warden agents new [NAME]
warden agents list [--json]
warden agents NAME update-pi
warden agents NAME cwd DIR
warden agents NAME show [--json]
warden pi NAME [ARGS...]
warden worktree AGENT
warden @NAME [ARGS...]
```

## Shell integration

Shell integration is consent-driven and reversible.

Bash and zsh use guarded blocks:

```sh
# warden begin
# ...
# warden end
```

Fish uses managed files under the user's fish config directory:

```text
conf.d/plugin-warden.fish
functions/warden.fish
```

## Pi agent environments

`warden agents new [NAME]` creates an isolated Pi agent directory. When `WARDEN_AGENTS` is set, agents live under `$WARDEN_AGENTS/NAME`. Otherwise they live under `${XDG_CONFIG_HOME:-$HOME/.config}/pi-agents/NAME`. Agent names `new` and `list` are reserved for Warden commands.

`warden agents NAME update-pi` installs `@earendil-works/pi-coding-agent@latest` into that existing agent's local npm prefix. `warden pi NAME update` updates Pi packages first, then uses the same Warden-managed runtime update path instead of Pi's global self-updater.

`warden agents NAME cwd DIR` writes `warden.agent.cwd` to the agent-local `settings.json`, preserving unrelated Pi settings. `DIR` must already exist and must be absolute or start with `~`.

`warden agents NAME show` prints the agent dir, Pi executable, Pi Lens dir, context-mode dir, settings path, effective cwd, and the complete formatted `settings.json`. `--json` emits the same information as JSON. `warden agents list --json` emits an array of agent summaries.

`warden pi NAME ...` reads configured cwd from agent-local settings, changes to it when present, then runs the local Pi executable with `PI_CODING_AGENT_DIR`, `PILENS_DATA_DIR`, and `CONTEXT_MODE_DIR` pointed inside the agent directory. `PILENS_DATA_DIR` is `$PI_CODING_AGENT_DIR/pi-lens`; `CONTEXT_MODE_DIR` is `$PI_CODING_AGENT_DIR/context-mode`. Without configured cwd, it preserves the caller's current working directory. `warden @NAME ...` is a direct alias for `warden pi NAME ...` after stripping `@`. Inside tmux, launch renames the current window to `󱚤 NAME`, then restores the previous window name and automatic rename setting after Pi exits; missing or failing tmux commands are ignored.

`warden worktree AGENT` reads that agent's configured cwd, lists existing Git worktrees as `branch - path`, then launches `warden pi AGENT` from the selected worktree without rewriting `settings.json`. Its new-worktree option is dry-run only in this slice: it validates a lowercase hyphenated name, captures a type, prints the captured values, and creates no branch or worktree.

## Scope boundary

`run-warden/` owns runner workflows, shell integration, Pi agent environment lifecycle commands, and Pi launch plumbing.

It does not own Pi package implementation. Package behavior belongs under `pi-warden/<package>/`.

## Development tests

```sh
mise run test:run-warden
```
