# warden-panel Agent Guidance

`warden-panel` is package `@nekwebdev/warden-panel`, Warden's Pi Agent configuration panel framework.

## Package boundaries

- Package root is `pi-warden/warden-panel/`.
- Runtime source lives in `src/`.
- Root `index.ts` is a tiny Pi manifest shim that re-exports `src/index.ts` so Pi startup labels local path packages as `warden-panel`, not `src`.
- Tests live in `tests/`.
- Package scripts live in `scripts/`.
- Add other folders (`skills/`, `hooks/`, `docs/`, `bin/`, `configs/`, `web/`) only when the extension needs them.

## Rules

- Keep Pi manifest pointed at `./index.ts`; keep package export pointed at `./src/index.ts`.
- Keep public pane registry exports importable from `@nekwebdev/warden-panel`.
- Register `/warden` and `/warden:settings` as separate exact Pi commands.
- Persist only Warden panel preferences under `settings.warden`; preserve unknown root keys and unknown `warden` keys.
- Settings pane changes stay draft-only until Apply; Close/Esc must not write.
- Do not add old package-manager, dependency installer, MCP config mutation, or update-report behavior here.
- Do not change root bootstrap or `run-warden/` agent workflows from this package.

## Tests

```sh
npm install --prefix pi-warden/warden-panel
npm test --prefix pi-warden/warden-panel
mise run test:pi-warden
```
