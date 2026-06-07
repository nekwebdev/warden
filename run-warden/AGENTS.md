# run-warden Agent Guidance

Repository guidance for coding agents working in `run-warden/`.

`run-warden/` owns Warden command workflows after root `./warden` delegates to `run-warden/bin/warden` through `mise`.

## Instruction order

- Read the repo root `AGENTS.md` first.
- Read this file before changing files under `run-warden/`.
- Use `.warden/maps/run-warden/map.md` for orientation when needed.
- Do not treat `map.md` files as task plans, issue trackers, implementation diaries, or current-work state.

## Boundary

- Keep delegated command dispatch in `bin/warden`.
- Put reusable shell behavior in `lib/*.sh`.
- Put shell-specific activation snippets in `shell/`.
- Put Bats coverage in `tests/`.
- Keep root `./warden` focused on bootstrap normalization, consent gates, `mise`, and delegation.
- Keep Pi package implementation under `pi-warden/<package>/`, not in runner code.

## Safety rules

- Preserve consent gates before shell startup-file mutation.
- Keep bash/zsh integration reversible with `# warden begin` and `# warden end` guarded blocks.
- Keep fish integration reversible with managed `conf.d/plugin-warden.fish` and `functions/warden.fish` files.
- Preserve non-interactive safety and clear failure messages.
- Keep Pi agent installs isolated under `WARDEN_AGENTS/<name>` or `${XDG_CONFIG_HOME:-$HOME/.config}/pi-agents/<name>`.
- `warden pi <name> ...` must run agent-local Pi with `PI_CODING_AGENT_DIR` and `PILENS_DATA_DIR` pointed inside the agent directory.
- Store the per-agent launch cwd only as `warden.agent.cwd`.
- Preserve unknown agent settings when writing Warden-owned settings keys.

## Testing

```sh
mise run test:run-warden
```

Expectations:

- Add or update Bats coverage for new command surfaces.
- Run `mise run test:root` too when a change touches root delegation or bootstrap contracts.
- Report unavailable tooling or skipped checks exactly.

## Documentation

- `run-warden/README.md` explains runner commands and behavior for humans.
- `run-warden/AGENTS.md` contains local agent rules and safety boundaries.
- Do not add active task state or implementation diaries to README, AGENTS, or map files.
