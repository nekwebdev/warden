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
warden shell install
warden shell status
warden shell remove
warden shell snippet bash
warden shell snippet zsh
warden shell snippet fish
```

Pi agent environment commands:

```sh
warden agents new [name]
warden agents update <name>
warden agents set <name> cwd <dir>
warden agents unset <name> cwd
warden agents show <name> [--json]
warden agents list [--json]
warden pi <name> ...
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

`warden agents new [name]` creates an isolated Pi agent directory. When `WARDEN_AGENTS` is set, agents live under `$WARDEN_AGENTS/<name>`. Otherwise they live under `${XDG_CONFIG_HOME:-$HOME/.config}/pi-agents/<name>`.

`warden agents update <name>` installs `@earendil-works/pi-coding-agent@latest` into that existing agent's local npm prefix. `warden pi <name> update` updates Pi packages first, then uses the same Warden-managed runtime update path instead of Pi's global self-updater.

`warden agents set <name> cwd <dir>` writes `warden.agent.cwd` to the agent-local `settings.json`, preserving unrelated Pi settings. `dir` must already exist and must be absolute or start with `~`.

`warden agents show` prints the agent dir, Pi executable, Pi Lens dir, settings path, effective cwd, and the complete formatted `settings.json`. `--json` emits the same information as JSON. `warden agents list --json` emits an array of agent summaries.

`warden pi <name> ...` reads configured cwd from agent-local settings, changes to it when present, then runs the local Pi executable with `PI_CODING_AGENT_DIR` and `PILENS_DATA_DIR` pointed inside the agent directory. Without configured cwd, it preserves the caller's current working directory. Inside tmux, it renames the current window to `󱚤 <name>` before launch, then restores the previous window name and automatic rename setting after Pi exits; missing or failing tmux commands are ignored.

## Scope boundary

`run-warden/` owns runner workflows, shell integration, Pi agent environment lifecycle commands, and Pi launch plumbing.

It does not own Pi package implementation. Package behavior belongs under `pi-warden/<package>/`.

## Development tests

```sh
mise run test:run-warden
```
