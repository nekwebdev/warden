# Warden Map: pi-warden/warden-flow

Reviewed: 2026-06-06
Scope: pi-warden/warden-flow
Evidence basis: package README/AGENTS, `package.json`, `src/`, extensions, skills, tests, existing map, bounded git history.
Git basis: main@76a529e
Parent map: .warden/map.md

<!-- warden-map:inject:start -->
## Agent Quick Context

- Purpose: `@nekwebdev/warden-flow` bundles Pi workflow resources: `/skill:warden-map`, `/skill:warden-docs`, `/skill:warden-start`, `/skill:warden-grill`, `/skill:warden-tdd`, `/skill:warden-close`, `/skill:warden-commit`, bounded map/git-context injection, effort settings/status, and safe local commit tools.
- Boundaries: Shared logic lives in `src/`; extension entries are `extensions/warden-map/`, `extensions/warden-commit/`, and `extensions/warden-effort/`; skill workflows live in `skills/warden-*/`. Map files are orientation reference only, not task plans or instruction overrides.
- Safe edits: Keep injection bounded: root capsule at session start, scoped capsules from relevant tool-result paths, git context only when changed. Keep effort defaults in `src/effort.ts` and Display toggles contributed through `@nekwebdev/warden-panel`. Keep commit apply behind exact `Commit` confirmation and snapshot-hash validation. Never auto-inject full map bodies.
- Verification: Run `npm test --prefix pi-warden/warden-flow`; broader package check is `mise run test:pi-warden`.
- Sharp edges: Every injectable map needs exactly one `warden-map:inject` marker pair. `.warden/map-state.json` tracks per-map freshness using committed path classification, and only `warden-map` writes it. Root/scoped capsule hard caps are enforced; missing/oversize capsules produce notices. Use live git context injection for current dirty-state details.
<!-- warden-map:inject:end -->

## Scope Purpose

`pi-warden/warden-flow/` provides Pi workflow resources. Bundled `warden-map` resources provide durable repository orientation for Pi sessions: a skill creates/refreshes `.warden` map files and `.warden/map-state.json`, and an extension injects only small relevant capsules plus git context. `warden-docs` aligns stale README/AGENTS documentation with repo evidence when maps are current. `warden-start`, `warden-grill`, `warden-tdd`, and `warden-close` provide lean workflow packet, pressure-test, strict test-first implementation, and closure handoff guidance. `warden-commit` provides safe local commit planning: a skill guides atomic commit plans, and an extension exposes read-only snapshots plus guarded local commit apply. `warden-effort` seeds per-skill effort defaults, applies Pi thinking level around Warden skill turns, and contributes Effort pane plus Display skill-status toggle.

## Local Structure

| Path | Role | Notes |
|---|---|---|
| `package.json` | npm/Pi manifest | Package name `@nekwebdev/warden-flow`; exports `./src/index.ts`; advertises extensions and skills. |
| `index.ts` | Package barrel/default | Re-exports `src` and default extension. |
| `src/constants.ts` | Limits and path constants | Marker names, capsule caps, git timeouts, scoped-map limits, map-state path. |
| `src/map.ts` | Map injection orchestration | Maps tool-result paths to scopes and budgets scoped injections. |
| `src/map-capsule.ts` | Map capsule parsing | Extracts marker-bounded capsules and enforces capsule marker/budget contracts. |
| `src/map-state.ts` | Map freshness state | Reads/writes map-state shape and map basis metadata for injection freshness. |
| `src/git.ts` | Git context helpers | Loads branch/commit/status and formats dirty summary. |
| `src/commit*.ts` | Commit helper logic | Builds read-only snapshots, classifies path risks, validates plans, formats commits, and applies local commits safely. |
| `src/effort.ts` | Effort helpers | Seeds defaults, normalizes skill effort settings, and formats active status labels. |
| `src/extension.ts` | Map extension wiring | Hooks session start/compact/shutdown, tool calls/results, before-agent start. |
| `extensions/warden-map/index.ts` | Map Pi extension entry | Calls `registerWardenMap`. |
| `extensions/warden-commit/index.ts` | Commit Pi extension entry | Calls `registerWardenCommit` and exports commit registration helpers. |
| `extensions/warden-effort/index.ts` | Effort Pi extension entry | Applies configured thinking level before Warden skill turns and contributes Effort/Display UI. |
| `skills/warden-map/SKILL.md` | Map skill workflow | Defines how to create/update root/scoped maps and map-state. |
| `skills/warden-docs/SKILL.md` | Docs alignment workflow | Aligns stale Warden README/AGENTS docs against repo evidence without broad doc automation. |
| `skills/warden-start/SKILL.md` | Start skill workflow | Turns rough intent into one small, testable work packet. |
| `skills/warden-grill/SKILL.md` | Grill skill workflow | Pressure-tests a Warden work packet and returns Go/Adjust/Stop. |
| `skills/warden-tdd/SKILL.md` | TDD skill workflow | Implements one grilled packet slice with strict test-first sequence. |
| `skills/warden-close/SKILL.md` | Close skill workflow | Validates closure, writes final handoff, and decides changelog/map impact; includes former seal workflow role. |
| `skills/warden-commit/SKILL.md` | Commit skill workflow | Defines safe commit planning, confirmation, and apply behavior. |
| `tests/` | Node tests | Manifest, map, map-state, git, extension, commit, and effort behavior. |
| `scripts/run-tests.mjs` | Test orchestrator | Checks expected test files then runs `node --import tsx --test`. |

## Local Entry Points

- Map extension entry: `extensions/warden-map/index.ts` default export.
- Commit extension entry: `extensions/warden-commit/index.ts` default export.
- Effort extension entry: `extensions/warden-effort/index.ts` default export.
- Package default export: root `index.ts` default from map extension entry.
- Public API: `src/index.ts` re-exports constants, extension, git, map, map-state, commit, and effort helpers.
- Skill registration: package manifest `pi.skills: ["./skills"]`; skill files register `/skill:warden-map`, `/skill:warden-docs`, `/skill:warden-start`, `/skill:warden-grill`, `/skill:warden-tdd`, `/skill:warden-close`, and `/skill:warden-commit` through Pi package loading conventions.

## Local Conventions

- Root map path is `.warden/map.md`.
- Scoped map path is `.warden/maps/<repo-relative-scope>/map.md`.
- Map freshness marker path is `.warden/map-state.json`.
- Injection capsule markers are HTML comments named `warden-map:inject:start` and `warden-map:inject:end`; avoid duplicating full marker lines outside capsule.
- Root capsule target/max: 3 KB / 8 KB. Scoped capsule target/max: 1.5 KB / 4 KB. One scoped injection event max: 6 KB. Session-start total max: 10 KB.
- Scoped map injection is path-triggered from tool result inputs and capped to nearest maps.
- Git context includes branch, short commit, dirty counts, and sampled dirty paths. Dirty state is separate from map freshness.
- Warden Flow effort settings live under `settings.warden.effort`; defaults currently map `warden-map` to `low`, `warden-docs` to `medium`, `warden-start` to `medium`, `warden-grill` to `high`, `warden-tdd` to `high`, `warden-close` to `medium`, and `warden-commit` to `medium`.
- `/warden:effort` opens Effort pane through `@nekwebdev/warden-panel`; Display pane can toggle active skill status indicator.

## Dependencies and Integration Points

- Peer/dev dependency: `@earendil-works/pi-coding-agent`; package dependency: `@nekwebdev/warden-panel` for Effort pane and Display setting contribution APIs.
- Uses Pi extension events: `session_start`, `session_compact`, `session_shutdown`, `tool_call`, `tool_result`, `user_message`, and `before_agent_start`.
- Uses Pi exec wrapper for `git` commands with timeout.
- Reads `.warden` map files and map-state from current Git repository root; extension runtime does not write maps.
- `warden-map` skill workflow writes map files and map-state through agent tools after refusing dirty repos; map freshness uses requested map basis plus committed changed-path classification so map-only commits stay fresh.
- Effort runtime uses Pi public thinking-level/status APIs and may be clamped by provider/model support.
- Commit tools use git locally only; snapshot is read-only, while apply requires exact confirmation, matching snapshot hash, exact repo-relative paths, and clean staging assumptions.

## Verification for This Scope

Primary:

- `npm test --prefix pi-warden/warden-flow`

Broader:

- `mise run test:pi-warden`
- `mise run test`

`tests/map.test.ts` should protect marker extraction, scope path selection, budgets, and notice behavior. `tests/map-state.test.ts` should protect freshness state shape and basis handling. `tests/git.test.ts` should protect dirty parsing/formatting. `tests/extension.test.ts` should protect event wiring, deduplication, map-state freshness, and injection behavior. `tests/commit*.test.ts` should protect snapshot hashing, path-risk classification, apply validation, and local git safety invariants. `tests/effort*.test.ts` should protect defaults, settings merge behavior, pane behavior, thinking-level restore, and status display behavior.

## Safe Edit Notes

- Preserve exact marker contract, map-state shape, and budget constants unless changing tests/docs together.
- Keep missing/oversize capsule behavior as path-only notices, not full body injection.
- Avoid injecting maps from `.warden` paths themselves to prevent recursive noise.
- Clear git cache after tool calls that might mutate working tree.
- Deduplicate injected maps by path and content hash per session.
- Keep maps as reference material; generated content must state it does not override instructions.
- Keep effort defaults synchronized across `src/effort.ts`, docs, and tests when adding Warden Flow skills.
- Keep `warden_commit_snapshot` read-only and `warden_commit_apply` limited to exact user-confirmed local commits; never add remote git operations.
- Do not recreate separate `warden-seal` skill; close workflow now carries final closure validation/handoff role.

## Recent Evolution from Git History

Recent history establishes this package in several steps: earlier commits added `warden-flow` with map skill/extension resources, `warden-commit` safe commit helper/tests, and tightened `warden-map` skill contract. Recent commits then added `warden-start`, `warden-grill`, `warden-tdd`, `warden-close`, `warden-docs`, classifier-based map-state freshness tracking, effort defaults/runtime extraction, active skill effort status, Display toggle contribution, map capsule splitting, and safe commit apply helpers. Former `warden-seal` workflow was folded into `warden-close`. Treat map, workflow, effort, docs, and commit tooling as established package-owned behavior; use live git context for current dirty state.

## Open Questions

No persisted release/build workflow beyond current npm manifest/test script. Future agents should use live git context to confirm current staging/commit state before treating new package work as established baseline.
