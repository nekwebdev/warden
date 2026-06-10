# Warden Map: pi-warden/warden-subagents

Reviewed: 2026-06-10
Scope: pi-warden/warden-subagents
Evidence basis: package README/AGENTS; `package.json`; `index.ts`; `extensions/subagents`; `src/`; tests; bounded git history.
Git basis: main@6ebda02
Parent map: .warden/map.md

<!-- warden-map:inject:start -->
## Agent Quick Context

- Purpose: `@nekwebdev/warden-subagents` owns Warden's Pi subagent package: `Agent`, `get_subagent_result`, background manager, scheduling, worktree isolation, memory prompts, RPC/events, widget/notifications, and read-only pane.
- Boundaries: Code lives in `src/` and `extensions/subagents/`; UI helpers in `src/ui/`; tests are package-local `.mjs`. It must not implement root bootstrap, runner `warden agents`/`warden pi`, shell integration, Nix, or dev-env behavior.
- Safe edits: Keep `Agent`/background state in package-local `AgentManager`; keep RPC via `pi.events`; schedules one-shot/session-scoped only; memory explicit `project|local|user`; worktree isolation caller-requested only.
- Verification: Run `npm test --prefix pi-warden/warden-subagents`; run `npm pack --dry-run --prefix pi-warden/warden-subagents` for manifest/publish-list changes; broader check is `mise run test:pi-warden`.
- Sharp edges: Background lookup status vocabulary differs from foreground. Worktree isolation requires clean committed parent repo. Scheduled jobs need compatible live/rearmed session runtime. No background steering, resume, retention, cron/interval, conversation overlay, panel admin, transcript streaming, or broad orphan pruning.
<!-- warden-map:inject:end -->

## Scope Purpose

`pi-warden/warden-subagents/` packages Warden's subagent-type registry and Pi subagent runtime integration: foreground delegation, background result lookup, one-shot schedules, package-local RPC/events, caller-requested worktree isolation, explicit memory prompt extras, and read-only UI.

Maps are orientation only and do not override `AGENTS.md` instructions.

## Local Structure

| Path | Role | Notes |
|---|---|---|
| `package.json` | npm/Pi manifest | Exports `index.ts`; advertises `extensions/subagents/index.ts`; depends on `warden-panel`. |
| `index.ts` | Public API barrel | Re-exports registry, runner, manager, schedule, memory, worktree, RPC, usage, and UI helpers. |
| `extensions/subagents/index.ts` | Pi extension entry | Registers tools, commands, pane, notifications, RPC, scheduler, widget, and lifecycle hooks. |
| `src/agent-runner.ts` | Foreground runner/tool | Registers `Agent` and runs child Pi sessions in-process. |
| `src/agent-manager.ts` | Background manager | Queues/runs background agents and implements `get_subagent_result`. |
| `src/agent-types.ts`, `custom-agents.ts`, `default-agents.ts` | Registry | Loads defaults/custom `.pi/agents` markdown and resolves types. |
| `src/invocation-config.ts`, `prompts.ts`, `context.ts`, `model-resolver.ts` | Invocation helpers | Normalize caller/frontmatter precedence, prompt/context, and model requests. |
| `src/memory.ts` | Custom-agent memory | Adds prompt blocks, safe index reads, and selected dir creation when write-capable. |
| `src/worktree.ts` | Worktree isolation | Validates parent repo, maps cwd, creates temp worktree, commits/persists successful changes. |
| `src/schedule.ts`, `schedule-store.ts`, `scheduler.ts` | One-shot scheduling | Parses values, persists jobs under session storage, rearms compatible runtime. |
| `src/cross-extension-rpc.ts`, `events.ts` | Interop | Package-local RPC channels and lifecycle/scheduler event payloads. |
| `src/ui/` | UI helpers | Widget, renderers, notifications, read-only Subagents pane. |
| `tests/` | Node tests | Registry, memory, runner, manager, RPC, scheduling, worktree, UI, scaffold. |
| `scripts/run-tests.mjs` | Test orchestrator | Checks expected tests then runs `node --import tsx --test`. |

## Local Entry Points

- Pi extension entry: `extensions/subagents/index.ts` default export.
- Public package import: `@nekwebdev/warden-subagents` resolves to `index.ts`.
- Tools: `Agent` and `get_subagent_result`.
- Commands/pane: `/agents` and `/warden:agents` open Warden Panel on read-only Subagents pane.
- RPC channels: `subagents:rpc:ping`, `subagents:rpc:spawn`, and `subagents:rpc:stop` with versioned replies.
- Lifecycle/scheduler events: created, started, completed, failed, scheduled, scheduler-ready, and ready payloads.

## Local Conventions

- Unknown agent types fall back to `general-purpose` with visible note. Disabled types start no child session.
- Foreground statuses include `completed`, `fallback`, `disabled`, `unsupported`, `steered`, `aborted`, and `error`; scheduled launch may return `scheduled`; background lifecycle uses `queued`, `running`, `completed`, `error`, and `aborted`.
- Agent frontmatter `model`, `thinking`, and `max_turns` win over caller fields.
- Exact caller `isolation: "worktree"` enables temp worktree isolation. Other `isolated`/`isolation` values are no-ops.
- Tool policy applies before first child prompt by creating child session, expanding selectors, and setting active tools when available.
- Parent context inheritance includes recent visible user/assistant text only, excludes tools, caps at 6000 chars, and marks truncation.
- Filename stem is canonical type key; frontmatter `name` is display metadata only.
- Registry loader does IO; `resolveAgentType` stays pure over a loaded registry.

## Dependencies and Integration Points

- Peer/dev dependency: `@earendil-works/pi-coding-agent`.
- Package dependency: `@nekwebdev/warden-panel` for Subagents pane registration/opening.
- Uses Pi child-session APIs, tool registration, event bus, model registry, session manager, UI status/widget/message renderer, and command registration where available.
- Schedules persist under session storage `warden-subagent-schedules/<sessionId>.json` using lock plus temp-file rename.
- Custom agents load from nearest project `.pi/agents/` and global Pi agent dir; project overrides by filename stem.
- Memory scopes use project `.pi/agent-memory/`, `.pi/agent-memory-local/`, or agent-dir memory paths.
- Worktree isolation uses local git only and reports merge guidance for `pi-agent-<id>` branches.
- RPC/event contract ideas are attributed to `tintinweb/pi-subagents` MIT reference; no upstream source is vendored.

## Verification for This Scope

Primary: `npm test --prefix pi-warden/warden-subagents`.

Manifest/publish-list changes: `npm pack --dry-run --prefix pi-warden/warden-subagents`.

Broader checks: `mise run test:pi-warden` or `mise run test`.

Tests cover scaffold, registry/custom agents, memory, runner/manager, RPC, schedules, worktree, usage, UI, and pane.

## Safe Edit Notes

- Keep background launch/result lookup through package-local `AgentManager`, `Agent({ run_in_background: true })`, and `get_subagent_result`.
- Keep widget, terminal notifications, and `/agents` read-only pane package-local; no pane admin controls in this slice.
- Keep schedules one-shot/session-scoped and reject cron/interval or incompatible foreground/background/context options.
- Memory is explicit `project|local|user` only; do not mutate `.gitignore` or create starter `MEMORY.md` content.
- Worktree isolation must validate a clean committed parent checkout and preserve failed changed worktrees.
- Do not add global bridges, network services, cross-process state, runner lifecycle commands, root/shell/Nix/dev-env behavior, custom-agent worktree frontmatter, transcript streaming, steering, resume, retention, recurrence, overlays, or broad orphan pruning without separate accepted scope.

## Recent Evolution from Git History

Recent commits added this package scaffold, then registry APIs, foreground/background `Agent`, activity UI, notifications, read-only pane, memory prompts, worktree isolation, one-shot scheduling, and package-local RPC. Docs/tests keep these package-owned while runner lifecycle and shell workflows remain out of scope.

## Open Questions

Deferred: background steering, resume, retention, cron/interval recurrence, conversation overlay, custom-agent worktree frontmatter, transcript streaming, broad orphan pruning, and panel admin controls.
