# Warden

Warden is a federated monorepo for operating-environment automation, runner tooling, Pi Agent packages, developer environments, and future system configuration.

The main experience is the whole repo:

1. Clone Warden anywhere.
2. Run `./warden`.
3. Let bootstrap normalize the clone into canonical `WARDEN_HOME`.
4. Use the delegated `warden` CLI for workflows after bootstrap.

Each `*-warden` subproject should stay independently testable and packageable over time.

## Quick start

```sh
git clone https://github.com/nekwebdev/warden.git
cd warden
./warden
```

Default `WARDEN_HOME`:

```sh
${XDG_DATA_HOME:-$HOME/.local/share}/warden
```

Use a custom home:

```sh
WARDEN_HOME=/path/to/warden ./warden
```

## First run

`./warden` is the root bootstrap shim.

On first run it may:

1. show the selected `WARDEN_HOME`;
2. move the clone into canonical `WARDEN_HOME` after consent;
3. refuse to overwrite unrelated existing target directories;
4. install `mise` after consent when missing;
5. delegate through `mise exec` to `run-warden/bin/warden`;
6. show the delegated Warden welcome/help output.

Bootstrap is intentionally small. Product workflows belong in `run-warden/`, not in root `./warden`.

## Commands

Before shell integration, run commands through the root shim:

```sh
./warden
./warden help
./warden doctor
./warden shell install
```

After shell integration, `run-warden/bin` is on `PATH` and the delegated CLI is available as `warden`:

```sh
warden help
warden doctor
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

Fish uses managed files under:

```sh
${XDG_CONFIG_HOME:-$HOME/.config}/fish/conf.d/plugin-warden.fish
${XDG_CONFIG_HOME:-$HOME/.config}/fish/functions/warden.fish
```

Warden must not mutate shell startup files without consent.

## Pi agent environments

Warden-managed Pi agent environments are isolated from repo package development.

Agent directories live under:

```sh
$WARDEN_AGENTS/<name>
```

or, when `WARDEN_AGENTS` is not set:

```sh
${XDG_CONFIG_HOME:-$HOME/.config}/pi-agents/<name>
```

Agent names may contain letters, numbers, `.`, `_`, and `-`.

Rejected names include:

```text
/
.
..
<empty>
```

`warden agents new <name>` creates an isolated Pi environment and installs the Pi runtime into that agent's local npm prefix.

`warden agents set <name> cwd <dir>` stores the launch cwd for that agent in its local settings file as `warden.agents.<name>.cwd`.

Example settings shape:

```json
{
  "warden": {
    "agents": {
      "sentinel": {
        "cwd": "~/work/warden"
      }
    }
  }
}
```

`warden pi <name> ...` runs the agent-local Pi executable with agent-local data paths:

```sh
PI_CODING_AGENT_DIR="$AGENT_DIR"
PILENS_DATA_DIR="$AGENT_DIR/pi-lens"
```

If no cwd is configured, Warden preserves the caller's current working directory. When run inside tmux, `warden pi <name> ...` renames the current tmux window to `󱚤 <name>` before launch, then restores the previous window name and automatic rename setting after Pi exits; missing or failing tmux commands are ignored.

## Repository layout

```text
.
├── warden          # root bootstrap shim
├── run-warden/    # delegated runner and command workflows
├── pi-warden/     # Pi Agent package container
├── nix-warden/    # future NixOS/system configuration area
├── dev-warden/    # future developer-environment area
├── AGENTS.md      # repo-wide agent guidance
├── README.md      # human-facing project entrypoint
└── .mise.toml     # dev tool and test task definitions
```

## Subproject boundaries

### `./warden`

Root bootstrap shim only.

It may choose/normalize `WARDEN_HOME`, move/re-exec after consent, ensure `mise` after consent, and delegate to `run-warden/bin/warden`.

It must stay small.

### `run-warden/`

Owns workflows after root bootstrap:

- delegated command dispatch;
- doctor checks;
- shell integration;
- Pi agent environment lifecycle commands;
- Pi launch plumbing.

### `pi-warden/`

Container for independently installable and testable Pi Agent packages.

Package code belongs under:

```text
pi-warden/<package>/
```

Current package areas include:

```text
pi-warden/warden-panel/
pi-warden/warden-flow/
```

`pi-warden/warden-flow/` contains Warden flow/orientation work, including the `warden-map` skill and related context-injection extension.

### `nix-warden/`

Future NixOS/system-configuration area.

Currently treat as a skeleton/product boundary unless its own guidance or the current task says otherwise.

### `dev-warden/`

Future developer-environment area.

Currently treat as a skeleton/product boundary unless its own guidance or the current task says otherwise.

## Development tests

Tests are for development, not required for first-time bootstrap users.

Run all available suites:

```sh
mise run test
```

Run focused suites:

```sh
mise run test:root
mise run test:run-warden
mise run test:nix-warden
mise run test:pi-warden
mise run test:dev-warden
```

The root and runner suites use Bats where present.

The `pi-warden` task runs package test suites for package folders that contain `package.json`.

## Agent guidance

Before editing, agents should read:

1. root `AGENTS.md`;
2. the nearest nested `AGENTS.md` for the subtree being changed;
3. nearby `map.md` files when orientation is needed.

`AGENTS.md` files define agent-facing project rules, safety boundaries, conventions, and test expectations.

`map.md` files are durable orientation context. They are not task plans, issue trackers, implementation diaries, or current-work state.

Role identity and long-lived agent behavior belong outside the repo in each agent environment config.

## License

MIT. See `LICENSE`.
