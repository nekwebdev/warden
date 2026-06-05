# dev-warden Agent Guidance

Repository guidance for coding agents working in `dev-warden/`.

## Instruction order

- Read the repo root `AGENTS.md` first.
- Read this file before changing files under `dev-warden/`.
- Use nearby `map.md` files for orientation only.
- Do not treat `map.md` files as task plans, issue trackers, implementation diaries, or current-work state.

## Boundary

`dev-warden/` is Warden's future developer-environment area. Treat it as a skeleton/product boundary unless the current task explicitly scopes developer-environment product work.

## Rules

- Do not add developer-environment product behavior as bootstrap or runner collateral.
- Keep the subproject independently testable.
- Do not mutate root `./warden` or `run-warden/` from this subtree unless the task explicitly scopes a cross-boundary contract.
- Keep local docs compact: `README.md` for human-facing explanation, `AGENTS.md` for local agent rules.

## Testing

```sh
mise run test:dev-warden
```

Run this task when changing `dev-warden/`. Report unavailable tooling or skipped checks exactly.
