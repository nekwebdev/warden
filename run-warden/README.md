# run-warden

`run-warden` owns Warden command workflows after root bootstrap completes. Its delegated executable is `bin/warden`.

The root `./warden` script stays tiny: it normalizes `WARDEN_HOME`, handles safety/consent gates, activates mise, and delegates to `run-warden/bin/warden`. Welcome output, doctor checks, shell integration, Pi agent environment bootstrap, and future workflow commands belong in `run-warden`.

## Pi agent commands

```sh
warden agents new [name]
warden agents update <name>
warden agents set <name> cwd <dir>
warden agents unset <name> cwd
warden agents show <name> [--json]
warden agents list [--json]
warden pi <name> ...
```

`agents new` installs the registry Pi coding-agent package into the selected agent directory's local `npm/node_modules`.

`agents update <name>` installs `@earendil-works/pi-coding-agent@latest` into that existing agent's local npm prefix. `pi <name> update` updates Pi packages first, then uses the same Warden-managed runtime update path instead of Pi's global self-updater.

`agents set <name> cwd <dir>` writes `warden.agents.<name>.cwd` to the agent-local `$WARDEN_AGENTS/<name>/settings.json`, preserving unrelated Pi settings. `dir` must already exist and must be absolute or start with `~`.

`agents show` prints the agent dir, Pi executable, Pi Lens dir, settings path, effective cwd, and the complete formatted `settings.json`; `--json` emits the same information as JSON. `agents list` summarizes every agent directory; `--json` emits an array.

`pi` reads the configured cwd from the agent-local settings file, changes to it when present, then runs the local executable with `PI_CODING_AGENT_DIR` and `PILENS_DATA_DIR` pointed inside the agent directory. Without a configured cwd, it preserves the caller's current working directory. Inside tmux, `pi` renames the current window to the agent name before launch; missing or failing tmux commands are ignored.

## Dev test

```sh
mise run test:run-warden
```
