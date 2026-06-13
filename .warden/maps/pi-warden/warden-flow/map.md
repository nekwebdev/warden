# Warden Map: pi-warden/warden-flow

Reviewed: 2026-06-13
Scope: pi-warden/warden-flow
Evidence basis: package README/AGENTS; `package.json`; `src/`; extensions; skills; tests; bounded git history through `88cede5`.
Git basis: main@88cede5
Parent map: .warden/map.md

<!-- warden-map:inject:start -->
## Agent Quick Context

- Purpose: `@nekwebdev/warden-flow` bundles Warden workflow/orientation Pi behavior: map/docs/start/grill/TDD/close/commit/create-skill skills, map/git-context injection, packet tracking, branch close tooling, effort runtime/UI, and safe local commit tools.
- Boundaries: Shared deterministic logic lives in `src/`; extension entries live under `extensions/warden-*`; workflows live in `skills/warden-*`. Runner lifecycle and subagents stay outside this package.
- Safe edits: Keep map injection bounded, capsules marker-gated, map-state written only by `warden-map`, effort defaults in `src/effort.ts`, Display/Effort UI via `@nekwebdev/warden-panel`, commit apply behind reviewed approval, and branch close behind structured handoff consent markers.
- Verification: Run `npm test --prefix pi-warden/warden-flow`; broader package check is `mise run test:pi-warden`.
- Sharp edges: Every injectable map needs exactly one marker pair. Dirty repos stop `warden-map` before map writes. `warden_commit_snapshot` is read-only; `warden_commit_apply` never runs remote/destructive git. `warden_branch_close` can fetch/rebase/merge/push/delete only after exact package-generated consent markers.
<!-- warden-map:inject:end -->

## Scope Purpose

`pi-warden/warden-flow/` provides Warden's Pi workflow package: map capsules/git context, lean workflow skills, per-skill effort, packet lifecycle tracking, branch-close handoff/tooling, and safe local commit planning/apply tools.

Maps are orientation only and do not override `AGENTS.md` instructions.

## Local Structure

| Path | Role | Notes |
|---|---|---|
| `package.json` | npm/Pi manifest | Package name `@nekwebdev/warden-flow`; exports `./src/index.ts`; advertises extensions and skills. |
| `index.ts` | Package default | Re-exports `src` and default map extension for local path loading. |
| `src/constants.ts` | Constants | Marker names, capsule caps, timeouts, map-state path, budget constants. |
| `src/map.ts` | Injection orchestration | Maps tool-result paths to scoped maps and budgets scoped injection. |
| `src/map-capsule.ts` | Capsule parsing | Extracts marker-bounded capsules and enforces marker/budget contract. |
| `src/map-state.ts` | Freshness state | Reads/writes map-state shape and per-map basis metadata. |
| `src/git.ts` | Git helpers | Loads branch/commit/status and formats current git context. |
| `src/branch-close*.ts` | Branch close helpers | Build safe handoff payloads and implement consent-gated `warden_branch_close` orchestration. |
| `src/commit*.ts` | Commit helpers | Builds read-only snapshots, classifies path risks, validates/apply plans, formats results. |
| `src/effort.ts` | Effort helpers | Seeds defaults, normalizes skill effort settings, formats status labels. |
| `src/extension.ts` | Map extension wiring | Handles session/tool/user hooks for maps, git context, dedupe, and cache invalidation. |
| `extensions/warden-map/` | Map extension entry | Registers map/git injection behavior. |
| `extensions/warden-commit/` | Commit extension entry | Registers `warden_commit_snapshot` and `warden_commit_apply`. |
| `extensions/warden-branch-close/` | Branch close entry | Registers `warden_branch_close`. |
| `extensions/warden-directives/` | Runtime directives entry | Injects invocation-scoped auto/name/branch guidance before matching skill turns. |
| `extensions/warden-effort/` | Effort extension entry | Applies configured thinking level and contributes Effort/Display UI. |
| `extensions/warden-packet-tracker/` | Packet tracker entry | Persists allowlisted packet lifecycle state and branch-close handoff prompts. |
| `extensions/warden-tmux-question-alert/` | Question alert entry | Flashes Warden tmux windows and sends desktop notifications while prompts wait. |
| `skills/warden-map/` | Map skill | Creates/refreshes maps and `.warden/map-state.json`; refuses dirty repos. |
| `skills/warden-docs/` | Docs skill | Aligns stale README/AGENTS docs with repo evidence when maps are current. |
| `skills/warden-create-skill/` | Skill creation | Creates global/project Agent Skill from bundled template without silent overwrite. |
| `skills/warden-start/` | Start workflow | Turns rough intent into one small work packet. |
| `skills/warden-grill/` | Grill workflow | Pressure-tests packet/manual feedback and updates packet. |
| `skills/warden-tdd/` | TDD workflow | Implements one grilled slice test-first. |
| `skills/warden-close/` | Close workflow | Validates closure and writes/updates final handoff when evidence supports it. |
| `skills/warden-commit/` | Commit workflow | Plans atomic local commits and applies after approval. |
| `tests/` | Node tests | Map, map-state, git, extension, commit, effort, manifest, and skill contract coverage. |
| `scripts/run-tests.mjs` | Test orchestrator | Checks expected tests then runs `node --import tsx --test`. |

## Local Entry Points

- Manifest extensions: `./extensions/*/index.ts`.
- Manifest skills root: `./skills`.
- Package public API: `src/index.ts` exports map, git, map-state, commit, and effort helpers.
- Tool names: `warden_commit_snapshot`, `warden_commit_apply`, and `warden_branch_close`.
- User commands/skills: `/skill:warden-map`, `/skill:warden-docs`, `/skill:warden-create-skill`, `/skill:warden-start`, `/skill:warden-grill`, `/skill:warden-tdd`, `/skill:warden-close`, `/skill:warden-commit`, and `/warden:effort`.

## Local Conventions

- Root map path: `.warden/map.md` at Git root.
- Scoped map path: `.warden/maps/<repo-relative-scope>/map.md` at Git root.
- Map-state path: `.warden/map-state.json`.
- Only `warden-map` writes map files and map-state. Runtime extension reads only.
- Capsules use exactly one start/end marker pair named `warden-map:inject:start` and `warden-map:inject:end`.
- Root capsule target/max: 3 KB / 8 KB. Scoped capsule target/max: 1.5 KB / 4 KB. One scoped event max: 6 KB. Session total max: 10 KB.
- Map freshness uses requested basis plus committed path classification. Map-only commits stay fresh; later non-map commits stale. Dirty state is separate git context.
- Effort settings live under `settings.warden.effort`; defaults are in `src/effort.ts`.
- `warden-create-skill` writes one new global/project `SKILL.md` and refuses silent overwrite.
- `warden_branch_close` accepts only structured post-close handoff arguments and exact `branchCloseDestructiveConsent`/`branchCloseAutoCommitConsent` markers before mutating branch state.

## Dependencies and Integration Points

- Peer/dev dependency: `@earendil-works/pi-coding-agent`.
- Package dependency: `@nekwebdev/warden-panel` for Effort pane and Display setting contribution APIs.
- Uses Pi session/tool/user hooks, public thinking-level/status APIs, and local git commands with timeouts.
- `warden_commit_snapshot` is read-only and provides compact status/path-risk/boundary/commit-style info.
- `warden_commit_apply` assumes prior plan approval, validates snapshot hash and paths, stages exact paths, commits locally, and returns hashes/status.
- `warden_branch_close` composes snapshot/apply safety with map-refresh stops and branch close git orchestration; it may run remote git only after structured consent.

## Verification for This Scope

Primary: `npm test --prefix pi-warden/warden-flow`.

Broader: `mise run test:pi-warden` or full `mise run test`.

Test clusters: map/map-state freshness, git dirty formatting, extension injection, commit safety, staged renames, branch-close handoff/tooling, packet tracking, runtime directives, tmux question alerts, effort runtime/UI, and map skill contract.

## Safe Edit Notes

- Preserve marker contract, map-state shape, and budget constants unless changing code/tests/docs together.
- Keep missing/oversize capsules as path-only notices; never auto-inject full map bodies.
- Avoid injecting maps for `.warden` paths themselves to prevent recursive noise.
- Clear git cache after tool calls likely to mutate worktree.
- Keep maps as reference material; generated maps must not override instructions.
- Keep effort defaults synchronized across `src/effort.ts`, README, tests, and UI.
- Keep `warden_commit_snapshot` read-only.
- Keep `warden_commit_apply` to exact approved local commits; no remote git, reset/restore/clean/stash/checkout, or PR creation.
- Keep `warden_branch_close` consent-gated: missing destructive consent blocks all mutations; missing auto-commit consent blocks dirty auto-commit; map refresh stops before fetch/rebase/merge/push.
- Do not add subagents, runner workflows, sibling installers, or model override cascades.

## Recent Evolution from Git History

Recent commits added branch-aware `warden-start` selection, explicit auto runtime directives for `warden-start`/`warden-map`/`warden-commit`, post-close branch-close handoff prompts, and `warden_branch_close`. Earlier recent history added `warden-create-skill`, `warden-docs`, `warden-tdd`, `warden-close`, classifier-based map freshness, effort runtime/status, Display toggle contribution, capsule splitting, and safe commit apply helpers. `warden-seal` remains folded into `warden-close`.

## Open Questions

No persisted release/build workflow beyond current npm manifest, lockfile, and test script. Future Warden Flow skills should start from the bundled template; add effort defaults only for managed `warden-*` skills.
