# warden-flow Agent Guidance

Repository guidance for coding agents working in `pi-warden/warden-flow/`.

## Instruction order

- Read the repo root `AGENTS.md` first.
- Read `pi-warden/AGENTS.md` before package edits.
- Read this file before changing files under `pi-warden/warden-flow/`.
- Use nearby `map.md` files for orientation only.
- Do not treat `map.md` files as task plans, issue trackers, implementation diaries, or current-work state.

## Boundary

`warden-flow/` is package `@nekwebdev/warden-flow`. It owns Warden workflow/orientation Pi behavior.

Package-owned areas:

- shared map, git-context, commit helper, and effort setting logic in `src/`;
- map injection extension in `extensions/warden-map/`;
- commit snapshot/apply extension in `extensions/warden-commit/`;
- effort panel/runtime extension in `extensions/warden-effort/`, which uses the public `@nekwebdev/warden-panel` API;
- `warden-map` skill in `skills/warden-map/`;
- `warden-start` skill in `skills/warden-start/`;
- `warden-grill` skill in `skills/warden-grill/`;
- `warden-commit` skill in `skills/warden-commit/`;
- package tests in `tests/`;
- package scripts in `scripts/`.

This package does not own Warden runner workflows, agent lifecycle commands, sibling package installers, subagents, or model override cascades.

## Map model

- Root map path: `.warden/map.md`.
- Scoped map path: `.warden/maps/<repo-relative-scope>/map.md`.
- Map files are repository orientation context, not task plans or implementation artifacts.
- Only `warden-map` updates `.warden/map.md` and `.warden/maps/**/map.md`; other skills treat maps as possibly stale orientation hints.
- Every auto-injected map must come from the `<!-- warden-map:inject:start -->` / `<!-- warden-map:inject:end -->` capsule.
- Never auto-inject full map files; inject path-only notices when capsules are missing or too large.

## Effort settings

- Maintain Warden Flow skill defaults in `src/effort.ts`.
- New Warden Flow `warden-*` skills need a default effort entry unless there is a clear reason to leave them unmanaged.
- Keep effort source of truth in Pi `settings.json` under `warden.effort.skills`; do not add effort frontmatter or description prefixes.
- Update `extensions/warden-effort/` input-hook behavior when adding Warden Flow skills whose configured effort should apply before `/skill:warden-*` expansion.
- Use Pi's public thinking-level API only; do not add provider-specific effort scales.
- Keep `@nekwebdev/warden-panel` declared as a package dependency when Effort pane code imports its public pane API.

## Extension rules

- Keep startup injection bounded: root capsule plus tiny git context only.
- Keep scoped injection path-triggered from tool results so the model does not need extra map-reading tool calls.
- Deduplicate injected maps by path and content hash per session.
- Git context must include branch, short commit, and dirty state when git is available.
- `warden_commit_snapshot` must stay read-only.
- `warden_commit_apply` may create local commits only after exact user confirmation and matching snapshot-hash validation; it must stage exact paths only and never push, pull, fetch, reset, rebase, amend, tag, stash, checkout, clean, restore, create PRs, or run remote git operations.
- Do not add subagents, workflow runners, sibling package installers, or model override cascades to this package.
- Runtime effort changes must restore the previous thinking level after the agent turn unless Pi exposes a safer verified non-persistent path.

## Testing

```sh
npm install --prefix pi-warden/warden-panel
npm install --prefix pi-warden/warden-flow
npm test --prefix pi-warden/warden-flow
mise run test:pi-warden
```

Run package-local tests for package changes. Run `mise run test:pi-warden` when shared Pi package assumptions or package-area behavior change. Report unavailable tooling or skipped checks exactly.

## Documentation

- `README.md` explains package behavior, commands, map contracts, and local development for humans.
- `AGENTS.md` contains package-specific agent rules and boundaries.
- Do not add active task state or implementation diaries to README, AGENTS, or map files.
