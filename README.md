# warden

Warden is a federated monorepo for a complete operating-environment workflow: OS config, framework tooling, dotfiles, runners, Pi Agent packages, dev environments, and related automation.

The primary experience is the whole monorepo: clone anywhere, run `./warden`, and let bootstrap normalize the clone into canonical `WARDEN_HOME`. Each `*-warden` subproject stays independently testable and packageable over time.

## Bootstrap quick start

```sh
git clone <repo-url> warden
cd warden
./warden
```

On first run, `./warden`:

1. Shows default `WARDEN_HOME`.
2. Moves the clone into `WARDEN_HOME` after consent.
3. Refuses to overwrite unrelated existing target directories.
4. Installs mise with consent when missing using `curl https://mise.run | sh`.
5. Delegates to `run-warden/bin/warden` through `mise exec`.
6. Prints welcome output.

Default `WARDEN_HOME`:

```sh
${XDG_DATA_HOME:-$HOME/.local/share}/warden
```

Use a custom home:

```sh
WARDEN_HOME=/path/to/warden ./warden
```

## NixOS active location

After bootstrap, the owner/operator NixOS config anchor is:

```sh
$WARDEN_HOME/nix-warden
```

`nix-warden` is skeleton-only in this groundwork slice; actual NixOS product behavior comes later.

## Commands

`./warden` is the root bootstrap shim. It delegates to `run-warden/bin/warden` through mise. After shell integration, `run-warden/bin` is on PATH and the delegated CLI is `warden`:

```sh
./warden                    # bootstrap if needed, then show welcome
./warden shell install      # install PATH/shell integration before `warden` is available
warden help                 # show command help after shell integration
warden doctor               # readiness checks, including non-fatal Pi agent hints
warden agents new [name]             # create isolated Pi agent environment
warden agents set <name> cwd <dir>   # pin Pi launch cwd for an agent
warden agents unset <name> cwd       # remove pinned launch cwd
warden agents show <name> [--json]   # show agent dirs and complete settings.json
warden agents list [--json]          # list agent environments
warden pi <name> ...                 # run Pi from that isolated agent environment
warden shell status                  # show shell integration state
warden shell remove
warden shell snippet bash|zsh|fish
```

## Pi agent environments

`warden agents new [name]` creates a local Pi agent environment under `WARDEN_AGENTS/<name>` when `WARDEN_AGENTS` is set; otherwise it uses `${XDG_CONFIG_HOME:-$HOME/.config}/pi-agents/<name>`. If `name` is omitted, Warden prompts for it interactively.

Agent names may contain letters, numbers, `.`, `_`, and `-`; `/`, `.`, `..`, and empty names are rejected. Existing agent directories are not overwritten.

Warden installs the registry package `@earendil-works/pi-coding-agent` with agent-local npm settings:

```sh
npm install \
  --prefix "$WARDEN_AGENTS/<name>/npm" \
  --cache "$WARDEN_AGENTS/<name>/npm/.npm-cache" \
  --userconfig "$WARDEN_AGENTS/<name>/npm/.npmrc" \
  --globalconfig "$WARDEN_AGENTS/<name>/npm/.npm-globalrc" \
  @earendil-works/pi-coding-agent
```

`warden agents set <name> cwd <dir>` stores the agent launch working directory in the agent-local Pi settings file:

```json
{
  "warden": {
    "agents": {
      "<name>": {
        "cwd": "~/work/project"
      }
    }
  }
}
```

The file lives at `$WARDEN_AGENTS/<name>/settings.json` (for example `${XDG_CONFIG_HOME:-$HOME/.config}/pi-agents/sentinel/settings.json`). `cwd` must be an existing absolute path or a `~` path. Warden preserves unrelated Pi settings when setting or unsetting this key.

Useful inspection commands:

```sh
warden agents show <name>
warden agents show <name> --json
warden agents list
warden agents list --json
```

`warden agents show` prints the agent dir, Pi executable, Pi Lens dir, settings path, effective cwd, and the complete formatted `settings.json`.

`warden pi <name> ...` resolves `$WARDEN_AGENTS/<name>/settings.json`, reads `warden.agents.<name>.cwd`, changes to that directory when configured, then runs `$WARDEN_AGENTS/<name>/npm/node_modules/.bin/pi` with:

```sh
PI_CODING_AGENT_DIR="$WARDEN_AGENTS/<name>"
PILENS_DATA_DIR="$WARDEN_AGENTS/<name>/pi-lens"
```

If no cwd is configured, Warden preserves the caller's current working directory.

Shell integration changes startup files only after consent. `./warden shell install` detects the current shell, defaults that prompt to yes, and defaults additional shell prompts to no. Extra shell prompts are shown only when their config target already exists (`~/.bashrc`, zsh rc under `$ZDOTDIR` when present, or the fish config dir); missing shell environments are reported as skipped. Existing Warden bash/zsh guarded blocks or fish managed files are reported as already installed and not overwritten. Bash/zsh use reversible guarded blocks; fish writes managed files under `${XDG_CONFIG_HOME:-$HOME/.config}/fish/conf.d/plugin-warden.fish` and `functions/warden.fish`.

## Dev tests

Tests are for development, not required for first-time bootstrap users.

```sh
mise run test
mise run test:root
mise run test:run-warden
mise run test:nix-warden
mise run test:pi-warden
mise run test:dev-warden
```

The root suite uses Bats with temp HOME/clone fixtures to verify bootstrap movement, no-overwrite safety, doctor output, and shell integration. Subproject suites are independently runnable smoke tests.

## Subproject boundaries

- `run-warden/` owns command workflows after root bootstrap.
- `nix-warden/` will own NixOS/system configuration.
- `pi-warden/` owns Pi Agent packages. It is a container: each package lives in its own folder. Current package `pi-warden/warden-panel/` (`@nekwebdev/warden-panel`) bundles multiple panel-related Pi extensions.
- `dev-warden/` will own developer-environment work.

Current groundwork does not implement product features for `nix-warden` or `dev-warden`. `pi-warden/warden-panel/` contains the current scoped Pi Agent package; runner-owned agent environment workflows remain in `run-warden/`.

## Agent guidance

Read `AGENTS.md` at repo root and within each subproject before editing. Guidance files define bootstrap boundaries, test expectations, and product-scope exclusions.

## License

MIT. See `LICENSE`.
