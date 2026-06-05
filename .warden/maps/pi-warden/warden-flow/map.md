# Warden Map: pi-warden/warden-flow

Generated: 2026-06-04 10:24:45 -10
Scope: pi-warden/warden-flow
Parent map: .warden/map.md

<!-- warden-map:inject:start -->
## Agent Quick Context

- Purpose: `@nekwebdev/warden-flow` bundles Pi workflow resources; current resources include `/skill:warden-map` with bounded map/git-context injection, and `/skill:warden-commit` with safe local commit snapshot/apply tools.
- Boundaries: Shared logic lives in `src/`; extension entries are `extensions/warden-map/` and `extensions/warden-commit/`; skill workflows live in `skills/warden-map/` and `skills/warden-commit/`. Map files are orientation reference only, not task plans or instruction overrides.
- Safe edits: Keep injection bounded: root capsule at session start, scoped capsules from relevant tool-result paths, git context only when changed. Keep commit apply behind exact `Commit` confirmation and snapshot-hash validation. Never auto-inject full map bodies. Do not add subagents, workflow runners, sibling package installers, or model override cascades.
- Verification: Run `npm test --prefix pi-warden/warden-flow`; broader package check is `mise run test:pi-warden`.
- Sharp edges: Every injectable map needs exactly one `warden-map:inject` marker pair. Root/scoped capsule hard caps are enforced; missing/oversize capsules produce notices. Use live git context injection for current dirty-state details.
<!-- warden-map:inject:end -->

## Scope Purpose

`pi-warden/warden-flow/` provides Pi workflow resources. Current bundled `warden-map` resources provide durable repository orientation for Pi sessions: a skill creates/refreshes `.warden` map files, and an extension injects only small relevant capsules plus git dirty context. Current bundled `warden-commit` resources provide safe local commit planning: a skill guides atomic commit plans, and an extension exposes read-only snapshots plus guarded local commit apply.

## Local Structure

| Path | Role | Notes |
|---|---|---|
| `package.json` | npm/Pi manifest | Package name `@nekwebdev/warden-flow`; exports `./src/index.ts`; advertises extensions and skills. |
| `index.ts` | Package barrel/default | Re-exports `src` and default extension. |
| `src/constants.ts` | Limits and path constants | Marker names, capsule caps, git timeouts, scoped-map limits. |
| `src/map.ts` | Map capsule loading/injection | Extracts capsules, maps paths to scopes, budgets scoped injections. |
| `src/git.ts` | Git context helpers | Loads branch/commit/status and formats dirty summary. |
| `src/commit.ts` | Commit helper logic | Builds read-only snapshots, classifies path risks, validates plans, and applies local commits safely. |
| `src/extension.ts` | Map extension wiring | Hooks session start/compact/shutdown, tool calls/results, before-agent start. |
| `extensions/warden-map/index.ts` | Map Pi extension entry | Calls `registerWardenMap`. |
| `extensions/warden-commit/index.ts` | Commit Pi extension entry | Calls `registerWardenCommit` and exports commit registration helpers. |
| `skills/warden-map/SKILL.md` | Map skill workflow | Defines how to create/update root and scoped maps. |
| `skills/warden-commit/SKILL.md` | Commit skill workflow | Defines safe commit planning, confirmation, and apply behavior. |
| `tests/` | Node tests | Manifest, map, git, extension behavior. |
| `scripts/run-tests.mjs` | Test orchestrator | Checks expected test files then runs `node --import tsx --test`. |

## Local Entry Points

- Map extension entry: `extensions/warden-map/index.ts` default export.
- Commit extension entry: `extensions/warden-commit/index.ts` default export.
- Package default export: root `index.ts` default from map extension entry.
- Public API: `src/index.ts` re-exports constants, extension, git, map, and commit helpers.
- Skill registration: package manifest `pi.skills: ["./skills"]`; skill files register `/skill:warden-map` and `/skill:warden-commit` through Pi package loading conventions.

## Local Conventions

- Root map path is `.warden/map.md`.
- Scoped map path is `.warden/maps/<repo-relative-scope>/map.md`.
- Injection capsule markers are HTML comments named `warden-map:inject:start` and `warden-map:inject:end`; avoid duplicating full marker lines outside the capsule.
- Root capsule target/max: 3 KB / 8 KB. Scoped capsule target/max: 1.5 KB / 4 KB. One scoped injection event max: 6 KB. Session-start total max: 10 KB.
- Scoped map injection is path-triggered from tool result inputs and capped to nearest maps.
- Git context includes branch, short commit, dirty counts, and sampled dirty paths.

## Dependencies and Integration Points

- Peer/dev dependency: `@earendil-works/pi-coding-agent`.
- Uses Pi extension events: `session_start`, `session_compact`, `session_shutdown`, `tool_call`, `tool_result`, and `before_agent_start`.
- Uses Pi exec wrapper for `git` commands with timeout.
- Reads `.warden` map files from current working directory; does not write maps itself.
- The map skill workflow writes map files through agent tools, not extension runtime.
- Commit tools use git locally only; snapshot is read-only, while apply requires exact confirmation, matching snapshot hash, exact repo-relative paths, and clean staging assumptions.

## Verification for This Scope

Primary:

- `npm test --prefix pi-warden/warden-flow`

Broader:

- `mise run test:pi-warden`
- `mise run test`

`tests/map.test.ts` should protect marker extraction, scope path selection, budgets, and notice behavior. `tests/git.test.ts` should protect dirty parsing/formatting. `tests/extension.test.ts` should protect event wiring and deduplication. `tests/commit.test.ts` should protect snapshot hashing, path-risk classification, apply validation, and local git safety invariants.

## Safe Edit Notes

- Preserve exact marker contract and budget constants unless changing tests/docs together.
- Keep missing/oversize capsule behavior as path-only notices, not full body injection.
- Avoid injecting maps from `.warden` paths themselves to prevent recursive noise.
- Clear git cache after tool calls that might mutate working tree.
- Deduplicate injected maps by path and content hash per session.
- Keep maps as reference material; generated content must state it does not override instructions.
- Keep `warden_commit_snapshot` read-only and `warden_commit_apply` limited to exact user-confirmed local commits; never add remote git operations.

## Recent Evolution from Git History

This package is new relative to the recent committed baseline, so package-specific committed history may be shallow until the first `warden-flow` commit lands. Root recent history shows Pi package infrastructure and panel package work are active.

## Open Questions

No persisted release/build workflow beyond current npm manifest/test script. Future agents should use live git context to confirm current staging/commit state before treating new package work as established baseline.
