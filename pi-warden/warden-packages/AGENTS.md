# warden-packages Agent Guidance

`warden-packages` is package `@nekwebdev/warden-packages`, Warden's global Pi package-manager pane.

## Package boundaries

- Package root is `pi-warden/warden-packages/`.
- Runtime source lives in `src/`.
- Root `index.ts` re-exports `src/index.ts` so Pi startup labels local path packages as `warden-packages`, not `src`.
- Tests live in `tests/`.
- Package scripts live in `scripts/`.

## Rules

- Keep Pi manifest pointed at `./index.ts`; keep package export pointed at `./src/index.ts`.
- Keep package-manager behavior in this package, not `warden-panel`.
- Use `@nekwebdev/warden-panel` public pane and pane-action-handler APIs for UI integration so both `/warden` and `/warden:packages` can run package actions.
- Register `/warden:packages` as an exact Pi command.
- V1 scope is global settings only: `$PI_CODING_AGENT_DIR/settings.json` through Pi's global settings manager.
- Display installed package rows as exact package sources from settings.
- Install source validation should reject only blank or multiline input; let Pi's package manager validate source formats.
- Remove actions must require confirmation listing exact selected sources.
- Install/remove operations must report concise results in chat and tell user to restart Pi to load changes.
- Do not auto-reload Pi after install/remove.
- Do not mutate root bootstrap or `run-warden/` workflows from this package.

## Tests

```sh
npm install --prefix pi-warden/warden-packages
npm test --prefix pi-warden/warden-packages
mise run test:pi-warden
```
