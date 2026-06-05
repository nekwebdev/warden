# warden-flow Agent Guidance

`warden-flow` is package `@nekwebdev/warden-flow`, Warden's Pi Agent workflow package. It currently bundles the `warden-map` repository-map skill and token-efficient map injection extension.

## Package boundaries

- Package root is `pi-warden/warden-flow/`.
- Shared extension logic lives in `src/`.
- Bundled Pi extension lives in `extensions/warden-map/`.
- Bundled skill lives in `skills/warden-map/` and registers `/skill:warden-map`.
- Tests live in `tests/`.
- Package scripts live in `scripts/`.

## Map model

- Root map path: `.warden/map.md`.
- Scoped map path: `.warden/maps/<repo-relative-scope>/map.md`.
- Map files are repository orientation context, not task plans or implementation artifacts.
- Every auto-injected map must come from the `<!-- warden-map:inject:start -->` / `<!-- warden-map:inject:end -->` capsule.
- Never auto-inject full map files; inject path-only notices when capsules are missing or too large.

## Extension rules

- Keep startup injection bounded: root capsule plus tiny git context only.
- Keep scoped injection path-triggered from tool results so the model does not need extra map-reading tool calls.
- Deduplicate injected maps by path and content hash per session.
- Git context must include branch, short commit, and dirty state when git is available.
- Do not add subagents, workflow runners, sibling package installers, or model override cascades to this package.

## Tests

```sh
npm install --prefix pi-warden/warden-flow
npm test --prefix pi-warden/warden-flow
mise run test:pi-warden
```
