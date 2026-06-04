# warden-panel Agent Guidance

`warden-panel` is package `@nekwebdev/warden-panel`, Warden's Pi Agent configuration panel framework and bundled panel-extension suite.

## Package boundaries

- Package root is `pi-warden/warden-panel/`.
- Shared panel framework/public API lives in `src/`.
- Bundled Pi extensions live in `extensions/`:
  - `extensions/warden-panel/` registers `/warden`.
  - `extensions/warden-display/` contributes Display pane and `/warden:display`.
  - `extensions/warden-packages/` contributes Packages pane/actions and `/warden:packages`.
- Root `index.ts` aggregates bundled extensions for direct local-path loading.
- Tests live in `tests/`.
- Package scripts live in `scripts/`.
- Add other folders (`skills/`, `hooks/`, `docs/`, `bin/`, `configs/`, `web/`) only when the package needs them.

## Rules

- Keep Pi manifest pointed at `./extensions/*/index.ts`; keep package export pointed at `./src/index.ts`.
- Keep public pane registry and `showWardenPanel` exports importable from `@nekwebdev/warden-panel`.
- Keep pane registry and action-handler state shared through `globalThis` so separately loaded Warden packages see one registry and `/warden` can dispatch contributed pane actions.
- Register `/warden` as the main exact Pi command and make it open the first available pane.
- Register `/warden:display` and `/warden:packages` as exact Pi commands; do not register `/warden:settings`.
- Persist only Warden panel preferences under `settings.warden`; preserve unknown root keys and unknown `warden` keys.
- Display pane changes stay draft-only until Apply; show Apply only when changes are pending; Esc must not write.
- Keep package-manager behavior in `extensions/warden-packages/`, not in core `src/` panel framework.
- Do not change root bootstrap or `run-warden/` agent workflows from this package.

## Tests

```sh
npm install --prefix pi-warden/warden-panel
npm test --prefix pi-warden/warden-panel
mise run test:pi-warden
```
