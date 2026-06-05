# nix-warden Agent Guidance

Repository guidance for coding agents working in `nix-warden/`.

## Instruction order

- Read the repo root `AGENTS.md` first.
- Read this file before changing files under `nix-warden/`.
- Use nearby `map.md` files for orientation only.
- Do not treat `map.md` files as task plans, issue trackers, implementation diaries, or current-work state.

## Boundary

`nix-warden/` is Warden's future NixOS/system-configuration area. Treat it as a skeleton/product boundary unless the current task explicitly scopes NixOS or system-configuration product work.

After bootstrap, the canonical future config anchor is:

```sh
$WARDEN_HOME/nix-warden
```

## Rules

- Do not add NixOS product behavior as bootstrap or runner collateral.
- Preserve `$WARDEN_HOME/nix-warden` as the active config path anchor.
- Keep the subproject independently testable.
- Do not mutate root `./warden` or `run-warden/` from this subtree unless the task explicitly scopes a cross-boundary contract.
- Keep local docs compact: `README.md` for human-facing explanation, `AGENTS.md` for local agent rules.

## Testing

```sh
mise run test:nix-warden
```

Run this task when changing `nix-warden/`. Report unavailable tooling or skipped checks exactly.
