# Changelog

All notable Warden changes are recorded here.

## Unreleased

### Added

- Added `@nekwebdev/warden-flow` active-flow footer status showing current packet tracker state through a default-on Display setting.
- Added `@nekwebdev/warden-flow` packet tracker extension for allowlisted packet lifecycle state in `.warden/work/packet-tracker.json`.
- Added `@nekwebdev/warden-flow` invocation-scoped runtime directives for `warden-start` auto mode through `/skill:warden-start --auto` and `warden.flow.interactionMode = "auto"`.
- Added `@nekwebdev/warden-subagents` package-local Pi event-bus RPC for `subagents:rpc:ping`, `subagents:rpc:spawn`, and `subagents:rpc:stop`, plus focused lifecycle events for cross-extension interop.
- Added `@nekwebdev/warden-subagents` session-scoped one-shot `Agent({ schedule })` jobs with Warden-named Pi session storage, `/agents` visibility, and headless-safe immediate return behavior.
- Added `@nekwebdev/warden-subagents` caller-requested `Agent({ isolation: "worktree" })` temporary git worktree isolation with strict clean-check validation, worktree cwd mapping, auto-commit branch persistence, and merge guidance.
- Added `@nekwebdev/warden-subagents` custom-agent memory prompt extras for explicit `memory: project|local|user` scopes with safe index reads, read-only fallback, and selected-directory creation for write-capable subagent runs.
- Added `@nekwebdev/warden-subagents` read-only Warden Panel Subagents pane opened by `/agents` and `/warden:agents`.
- Added `@nekwebdev/warden-subagents` background `Agent` launch and `get_subagent_result` lookup with queued/running/completed/error/aborted lifecycle state.
- Added `@nekwebdev/warden-subagents` native Pi background activity widget, Agent renderers, and one-per-unconsumed-terminal completion notifications.
- Added `@nekwebdev/warden-subagents` agent-type registry APIs for default agents and custom `.pi/agents/<name>.md` loading while preserving inert runtime scope.
- Added inert `@nekwebdev/warden-subagents` Pi package scaffold for future subagents extension work.
- `warden agents new` seeds fresh Pi agent environments with an `AGENTS.md` guidance template that substitutes only the agent name.
- Warden Panel Packages pane can update tagged npm package entries from global Pi settings, reconcile changed installs, and report `old -> new` source changes.

### Changed

- `warden worktree AGENT` new-worktree flow now creates `${type}/${name}` from `origin/main`, pushes upstream, and launches the agent from the created worktree while preserving agent settings.
- `run-warden` CLI dispatch now documents and accepts final command forms: `warden shell init`, name-first `warden agents NAME ...`, and direct `warden @NAME`, while removed forms fail through the normal unsupported-command path.
- Warden Flow map freshness now uses the requested map's per-map basis and committed changes since that basis, so commits containing only map-owned files keep refreshed maps fresh while later non-map commits mark them stale.
- Warden Flow docs and `warden-docs` guidance now describe classifier-based map freshness instead of direct map-state SHA equality with `HEAD`.

### Tests

- Added `run-warden` Bats coverage for final CLI forms, removed command forms, reserved agent names, `@NAME` launch parity, and README command docs.
- Added Warden Flow coverage for map-only commits, non-map commits, same-HEAD freshness, invalid or missing state, unreachable bases, and formatted freshness metadata.
- Added Warden Panel coverage for tagged npm package update parsing, settings rewrites, pane row order, and update reports.
